/**
 * Matsya paging-confirm — the inbound mirror of the remote-run poller.
 *
 * When the agent hits a confirm-tier command (rm -rf, git push --force, …) it
 * normally needs a human at the keyboard. The unattended Matsya runner has no
 * keyboard, so historically it auto-denied every confirm. This module instead
 * *pages* the matsyaai.com mobile UI — the very same `/api/claude-pager`
 * request/poll protocol the standalone Claude Code hook (hook.js) uses — and
 * blocks until the phone returns allow/deny.
 *
 * Fail-closed by design: no key, no listeners, network down, or timeout all
 * resolve to 'deny', matching the previous safe-by-default behaviour.
 *
 * Env:
 *   MATSYA_PAGER_URL         override endpoint (default <base>/api/claude-pager)
 *   MATSYA_PAGER_KEY         override bearer (default MATSYA_API_KEY)
 *   MATSYA_PAGER_TIMEOUT_MS  total wall-time before giving up (default 5min)
 */

import os from 'node:os';
import crypto from 'node:crypto';
import type { ConfirmRequest, ConfirmResponse } from '../tools/types.js';
import { loadMatsyaConfig, fetchWithTimeout } from './api.js';

const POLL_WAIT_S = 12;
// Kept under the agent's default wall-clock guard (C9AI_MAX_WALL_SEC, 600s) so
// a single long page doesn't blow the whole run's budget.
const DEFAULT_TOTAL_MS = 5 * 60 * 1000;
// Connection-level failures: nobody home, bail immediately (don't burn the
// full timeout polling a dead host).
const HARD_NET_ERRORS = new Set(['ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN']);

export interface PagerEvent {
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface PagingConfirmOptions {
  cwd: string;
  sessionId?: string | null;
  totalTimeoutMs?: number;
  onEvent?: (e: PagerEvent) => void;
}

interface PagerCallResult {
  status?: number;
  json?: any;
  error?: string;
}

function pagerUrl(baseUrl: string): string {
  return process.env.MATSYA_PAGER_URL || `${baseUrl}/api/claude-pager`;
}

function pagerKey(apiKey: string): string {
  return process.env.MATSYA_PAGER_KEY || apiKey;
}

async function pagerCall(
  url: string,
  key: string,
  method: 'GET' | 'POST',
  { body, query }: { body?: unknown; query?: Record<string, string | number> }
): Promise<PagerCallResult> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { error: 'bad_url' };
  }
  if (query) for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  const init: RequestInit = { method, headers };
  if (body != null) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  try {
    // Give the long-poll its full server-side wait plus slack before aborting.
    const res = await fetchWithTimeout(u.href, init, (POLL_WAIT_S + 10) * 1000);
    const text = await res.text().catch(() => '');
    try {
      return { status: res.status, json: JSON.parse(text || '{}') };
    } catch {
      return { status: res.status, error: 'bad_json' };
    }
  } catch (err: any) {
    const code = err?.cause?.code || err?.code;
    return { error: code || (err instanceof Error ? err.message : String(err)) };
  }
}

/** True only on an explicit allow; everything else is treated as a deny. */
function decisionAllows(data: any): boolean {
  const decision = String(data?.decision || data?.status || '').toLowerCase();
  if (decision === 'allow' || decision === 'allow-session') return true;
  const pd = data?.hook_output?.hookSpecificOutput?.permissionDecision;
  return pd === 'allow';
}

/**
 * Build a `confirm` callback that pages Matsya for an allow/deny decision.
 * Drop-in replacement for the auto-deny stub in the unattended runner.
 */
export function createPagingConfirm(
  opts: PagingConfirmOptions
): (req: ConfirmRequest) => Promise<ConfirmResponse> {
  return async (req: ConfirmRequest): Promise<ConfirmResponse> => {
    const cfg = loadMatsyaConfig();
    if (!cfg) {
      opts.onEvent?.({ level: 'warn', text: 'matsya pager: no API key — denying' });
      return 'deny';
    }

    const url = pagerUrl(cfg.baseUrl);
    const key = pagerKey(cfg.apiKey);
    const requestId = crypto.randomUUID();
    const totalMs = opts.totalTimeoutMs
      ?? Number(process.env.MATSYA_PAGER_TIMEOUT_MS || DEFAULT_TOTAL_MS);

    const body = {
      request_id: requestId,
      session_id: opts.sessionId ?? null,
      host: os.hostname(),
      cwd: opts.cwd,
      // Reuse the Claude-pager schema so the existing phone UI renders it.
      tool_name: 'Bash',
      tool_input: { command: req.command },
      title: req.reason ? `${req.reason}: ${req.command}` : req.command,
      wait: POLL_WAIT_S,
    };

    opts.onEvent?.({ level: 'info', text: `matsya pager: paging phone for "${req.reason}"` });

    const start = Date.now();
    let res = await pagerCall(url, key, 'POST', { body, query: { action: 'request' } });

    while (Date.now() - start < totalMs) {
      if (res.json && res.json.status === 'success') {
        const d = res.json.data || {};
        if (d.status === 'no_listeners') {
          opts.onEvent?.({ level: 'info', text: 'matsya pager: no devices listening — denying' });
          return 'deny';
        }
        if (d.status && d.status !== 'pending') {
          const allowed = decisionAllows(d);
          opts.onEvent?.({
            level: 'info',
            text: `matsya pager: phone said ${allowed ? 'allow' : 'deny'}`,
          });
          return allowed ? 'allow' : 'deny';
        }
      } else if (res.error) {
        if (HARD_NET_ERRORS.has(res.error)) {
          opts.onEvent?.({ level: 'warn', text: `matsya pager: unreachable (${res.error}) — denying` });
          return 'deny';
        }
        // Transient (timeout / bad_json / 5xx blip): brief backoff, then re-poll.
        await new Promise(r => setTimeout(r, 1500));
      }
      res = await pagerCall(url, key, 'GET', {
        query: { action: 'poll', request_id: requestId, wait: POLL_WAIT_S },
      });
    }

    opts.onEvent?.({ level: 'info', text: 'matsya pager: timed out waiting for phone — denying' });
    return 'deny';
  };
}
