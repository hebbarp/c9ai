/**
 * Minimal TypeScript port of the v3 MatsyaAPI client. Covers only what the
 * v4 poller needs: queue list/claim/update + status heartbeat. Document
 * upload, search, todos, etc. are intentionally not ported — they were used
 * by the v3 Express endpoints, not the queue worker.
 */

export interface MatsyaConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

export interface QueueItem {
  id: number;
  item_type: string;
  instructions?: string;
  message_content?: string;
  task_id?: number | null;
  workspace_id?: number | null;
  user_id?: number | null;
  status?: string;
}

export interface UpdateMetadata {
  worker_id?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  model_used?: string;
  console_output?: string;
}

export function loadMatsyaConfig(): MatsyaConfig | null {
  const apiKey = process.env.MATSYA_API_KEY;
  if (!apiKey) return null;
  const baseUrl = (process.env.MATSYA_BASE_URL || 'https://matsyaai.com').replace(/\/+$/, '');
  const timeoutMs = Number(process.env.MATSYA_TIMEOUT_MS || 30000);
  return { baseUrl, apiKey, timeoutMs };
}

function buildUrl(cfg: MatsyaConfig, endpoint: string): string {
  // Matsya rewrites /api/foo.php → /api/foo and bounces .php URLs through an
  // http leg before redirecting back to https. Hit the canonical extensionless
  // path directly so Authorization never rides on the redirect chain.
  const clean = endpoint.replace(/^\/+/, '').replace(/\.php$/, '');
  return `${cfg.baseUrl}/api/${clean}`;
}

function jsonHeaders(cfg: MatsyaConfig): Record<string, string> {
  return {
    'Authorization': `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Manual redirect handling so Authorization header survives a 30x. We
    // refuse to send Authorization over plain http — if a redirect tries to
    // downgrade us, drop the header for that hop. (Matsya bounces .php URLs
    // through http briefly; better to lose auth and 401 than leak the token.)
    let current = url;
    let opts: RequestInit = { ...init, signal: ctrl.signal, redirect: 'manual' };
    for (let hops = 0; hops < 5; hops++) {
      const res = await fetch(current, opts);
      if (res.status < 300 || res.status >= 400) return res;
      const loc = res.headers.get('location');
      if (!loc) return res;
      const next = new URL(loc, current).href;
      if (next.startsWith('http://') && opts.headers) {
        const h: Record<string, string> = { ...(opts.headers as Record<string, string>) };
        delete h.Authorization;
        delete h.authorization;
        opts = { ...opts, headers: h };
      }
      current = next;
    }
    throw new Error(`too many redirects from ${url}`);
  } finally {
    clearTimeout(t);
  }
}

export class MatsyaAPI {
  constructor(private cfg: MatsyaConfig) {}

  /** Pending queue items targeted at local workers (worker_target IN ('local','any')). */
  async getQueueItems(): Promise<QueueItem[]> {
    const res = await fetchWithTimeout(
      buildUrl(this.cfg, 'bru-queue.php'),
      {
        method: 'GET',
        headers: { ...jsonHeaders(this.cfg), 'X-Bru-Worker-Type': 'local' },
      },
      this.cfg.timeoutMs
    );
    if (!res.ok) throw new Error(`matsya queue fetch: HTTP ${res.status}`);
    const data: any = await res.json();
    if (data?.status !== 'success') throw new Error(data?.message || 'queue fetch failed');
    return (data.data ?? []) as QueueItem[];
  }

  /** Atomic claim. Returns false on 409 (already taken by another worker). */
  async claimQueueItem(id: number, workerId: string): Promise<boolean> {
    const res = await fetchWithTimeout(
      `${buildUrl(this.cfg, 'bru-queue.php')}?id=${id}`,
      {
        method: 'PUT',
        headers: jsonHeaders(this.cfg),
        body: JSON.stringify({ status: 'processing', worker_id: workerId }),
      },
      this.cfg.timeoutMs
    );
    if (res.status === 409) return false;
    if (!res.ok) throw new Error(`matsya queue claim: HTTP ${res.status}`);
    const data: any = await res.json();
    return data?.status === 'success';
  }

  async updateQueueItem(
    id: number,
    status: 'completed' | 'failed',
    result: string | null,
    metadata: UpdateMetadata = {}
  ): Promise<void> {
    const payload: Record<string, unknown> = { status };
    if (result != null) payload.result = result;
    for (const [k, v] of Object.entries(metadata)) {
      if (v != null) payload[k] = v;
    }
    const res = await fetchWithTimeout(
      `${buildUrl(this.cfg, 'bru-queue.php')}?id=${id}`,
      {
        method: 'PUT',
        headers: jsonHeaders(this.cfg),
        body: JSON.stringify(payload),
      },
      this.cfg.timeoutMs
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const detail = body ? ` — ${body.slice(0, 300).replace(/\s+/g, ' ').trim()}` : '';
      throw new Error(`matsya queue update: HTTP ${res.status}${detail}`);
    }
  }

  async addTaskComment(taskId: number, comment: string): Promise<void> {
    try {
      await fetchWithTimeout(
        `${buildUrl(this.cfg, 'tasks.php')}?id=${taskId}&action=comment`,
        {
          method: 'POST',
          headers: jsonHeaders(this.cfg),
          body: JSON.stringify({ comment }),
        },
        this.cfg.timeoutMs
      );
    } catch {
      // Comments are best-effort; don't break processing if Matsya is flaky.
    }
  }

  async sendHeartbeat(): Promise<void> {
    try {
      await fetchWithTimeout(
        `${buildUrl(this.cfg, 'bru-status.php')}?action=heartbeat`,
        { method: 'POST', headers: jsonHeaders(this.cfg) },
        this.cfg.timeoutMs
      );
    } catch {
      // Heartbeat failures are not actionable from here.
    }
  }

  async sendOfflineStatus(): Promise<void> {
    try {
      await fetchWithTimeout(
        `${buildUrl(this.cfg, 'bru-status.php')}?action=offline`,
        { method: 'POST', headers: jsonHeaders(this.cfg) },
        5000
      );
    } catch {
      // Shutdown best-effort.
    }
  }

  /** Quick connectivity probe used by `matsya status`. */
  async probe(): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(
        buildUrl(this.cfg, 'workspaces.php'),
        { method: 'GET', headers: jsonHeaders(this.cfg) },
        10000
      );
      return res.ok;
    } catch {
      return false;
    }
  }
}
