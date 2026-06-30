/**
 * On-demand Matsya queue runner. No background polling — the user triggers
 * a fetch via `matsya check` (or `matsya list` to peek without claiming).
 *
 * The configured singleton holds tools/provider/cwd that App.tsx pre-populates
 * whenever they change, so the command is just a thin trigger.
 */

import os from 'node:os';
import type { Tool } from '../tools/types.js';
import type { ProviderName } from '../core/types.js';
import { getProvider } from '../providers/registry.js';
import { runAgent } from '../agent/loop.js';
import { MatsyaAPI, loadMatsyaConfig, type QueueItem } from './api.js';
import { createPagingConfirm } from './pager.js';

export interface RunnerEvent {
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface RunnerStatus {
  configured: boolean;
  hasKey: boolean;
  workerId: string;
  baseUrl: string | null;
  lastCheckAt: number | null;
  lastError: string | null;
}

export interface ProcessResult {
  id: number;
  ok: boolean;
  output?: string;
  error?: string;
  skipped?: boolean;
}

export interface RunnerOptions {
  provider: ProviderName;
  tools: Map<string, Tool>;
  cwd: string;
}

class MatsyaRunner {
  private workerId = process.env.C9AI_WORKER_ID || `c9ai-${os.hostname()}-${process.pid}`;
  private opts: RunnerOptions | null = null;
  private lastCheckAt: number | null = null;
  private lastError: string | null = null;

  configure(opts: RunnerOptions): void {
    this.opts = opts;
  }

  status(): RunnerStatus {
    const cfg = loadMatsyaConfig();
    return {
      configured: !!this.opts,
      hasKey: !!cfg,
      workerId: this.workerId,
      baseUrl: cfg?.baseUrl ?? null,
      lastCheckAt: this.lastCheckAt,
      lastError: this.lastError,
    };
  }

  /** Fetch pending items without claiming any. */
  async list(): Promise<{ ok: true; items: QueueItem[] } | { ok: false; reason: string }> {
    const cfg = loadMatsyaConfig();
    if (!cfg) return { ok: false, reason: 'MATSYA_API_KEY not set — run `matsya setup <key>`' };
    try {
      const items = await new MatsyaAPI(cfg).getQueueItems();
      this.lastCheckAt = Date.now();
      this.lastError = null;
      return { ok: true, items };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: this.lastError };
    }
  }

  /** Fetch pending items, claim and process the first available. */
  async checkAndProcessOne(
    onEvent?: (e: RunnerEvent) => void
  ): Promise<{ ok: true; processed: ProcessResult | null } | { ok: false; reason: string }> {
    const list = await this.list();
    if (!list.ok) return { ok: false, reason: list.reason };
    if (list.items.length === 0) return { ok: true, processed: null };

    for (const item of list.items) {
      const r = await this.processOne(item, onEvent);
      if (!r.skipped) return { ok: true, processed: r };
    }
    return { ok: true, processed: null };
  }

  async processOne(
    item: QueueItem,
    onEvent?: (e: RunnerEvent) => void
  ): Promise<ProcessResult> {
    if (!this.opts) {
      return { id: item.id, ok: false, error: 'runner not configured (open the TUI first)' };
    }
    const cfg = loadMatsyaConfig();
    if (!cfg) return { id: item.id, ok: false, error: 'MATSYA_API_KEY not set' };

    const api = new MatsyaAPI(cfg);
    try {
      const claimed = await api.claimQueueItem(item.id, this.workerId);
      if (!claimed) {
        onEvent?.({ level: 'info', text: `matsya: #${item.id} already claimed by another worker` });
        return { id: item.id, ok: false, skipped: true };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onEvent?.({ level: 'error', text: `matsya: claim #${item.id} failed: ${msg}` });
      return { id: item.id, ok: false, error: msg };
    }

    onEvent?.({ level: 'info', text: `matsya: processing #${item.id} (${item.item_type})` });
    if (item.task_id) {
      void api.addTaskComment(item.task_id, `c9ai started (${this.workerId})`);
    }

    const goal = (item.instructions || item.message_content || '').trim();
    let resultText = '';
    let providerName = '';
    let error: string | null = null;

    try {
      const provider = getProvider(this.opts.provider);
      providerName = provider.name;
      const ok = await provider.available();
      if (!ok) throw new Error(`provider ${provider.name} not available`);
      if (!goal) throw new Error('queue item has no instructions');

      const ctrl = new AbortController();
      // Unattended runner: no keyboard for confirm-tier commands. Instead of
      // auto-denying, page the Matsya phone UI and act on its allow/deny.
      // Fail-closed (no key / no listeners / timeout → deny) lives in the helper.
      const confirm = createPagingConfirm({
        cwd: this.opts.cwd,
        sessionId: `matsya-item-${item.id}`,
        onEvent,
      });

      await runAgent(
        provider,
        goal,
        this.opts.tools,
        evt => {
          if (evt.type === 'thought') resultText += evt.chunk;
          if (evt.type === 'turn-end' && resultText && !resultText.endsWith('\n')) {
            resultText += '\n';
          }
        },
        {
          cwd: this.opts.cwd,
          signal: ctrl.signal,
          confirm,
          scope: { roots: [] },
        }
      );
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    try {
      if (error) {
        await api.updateQueueItem(item.id, 'failed', error, { worker_id: this.workerId });
        onEvent?.({ level: 'error', text: `matsya: #${item.id} failed: ${error}` });
        if (item.task_id) {
          void api.addTaskComment(item.task_id, `c9ai failed: ${error}`);
        }
        return { id: item.id, ok: false, error };
      }
      await api.updateQueueItem(item.id, 'completed', resultText.trim(), {
        worker_id: this.workerId,
        model_used: providerName,
      });
      onEvent?.({ level: 'info', text: `matsya: #${item.id} completed (${resultText.length} chars)` });
      if (item.task_id) {
        const summary = resultText.length > 200 ? resultText.slice(0, 200) + '…' : resultText;
        void api.addTaskComment(item.task_id, `c9ai completed — ${summary}`);
      }
      return { id: item.id, ok: true, output: resultText.trim() };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onEvent?.({ level: 'error', text: `matsya: update #${item.id} failed: ${msg}` });
      return { id: item.id, ok: false, error: msg };
    }
  }
}

let singleton: MatsyaRunner | null = null;

export function getRunner(): MatsyaRunner {
  if (!singleton) singleton = new MatsyaRunner();
  return singleton;
}
