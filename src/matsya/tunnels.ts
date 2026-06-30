/**
 * Preview-share tunnel manager.
 *
 * Brings local app/page previews online by driving a bundled `frpc` against the
 * Matsya frp relay. Unlike the on-demand queue runner, tunnels need a persistent
 * background loop: frpc must stay alive for the life of the share.
 *
 * Flow (per poll tick, default 20s):
 *   GET preview-share?action=agent_poll  -> { start:[...], stop:[slug] }
 *   for each start not already running   -> write frpc config, spawn, report active/error
 *   for each stop slug                   -> kill frpc, report stopped
 *   for each running active tunnel       -> report heartbeat (keeps last_seen fresh)
 *
 * frpc resolution order: C9AI_FRPC_PATH env -> bundled c9ai/bin/frpc[.exe] -> PATH.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatsyaAPI, loadMatsyaConfig, type TunnelStart } from './api.js';

const FRPC_HELP =
  'frpc not found. Install frp (https://github.com/fatedier/frp/releases) and either add ' +
  'frpc to PATH or set C9AI_FRPC_PATH=<path to frpc>. (frp is not bundled — Windows Defender ' +
  'flags it as a PUA, so C9AI relies on a user-provided frpc.)';

export interface TunnelEvent {
  level: 'info' | 'warn' | 'error';
  text: string;
}

interface RunningTunnel {
  slug: string;
  child: ChildProcess;
  cfgPath: string;
  publicUrl: string;
  localPort: number;
  active: boolean;     // frpc reported "start proxy success"
  reported: boolean;   // we've already told Matsya active/error for this spawn
}

const FRPC_NAME = process.platform === 'win32' ? 'frpc.exe' : 'frpc';
const SPAWN_TIMEOUT_MS = 15000;

function resolveFrpc(): string {
  const fromEnv = process.env.C9AI_FRPC_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // dist/matsya/tunnels.js -> c9ai/bin
    path.join(here, '..', '..', 'bin', FRPC_NAME),
    // src/matsya/tunnels.ts (dev) -> c9ai/bin
    path.join(here, '..', '..', '..', 'bin', FRPC_NAME),
    path.join(process.cwd(), 'bin', FRPC_NAME),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'frpc'; // last resort: rely on PATH
}

/** Probe whether frpc is actually runnable (used by `tunnels status`/`once`). */
export function checkFrpc(): { path: string; ok: boolean; version?: string; help?: string } {
  const p = resolveFrpc();
  try {
    const r = spawnSync(p, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (r.error || r.status !== 0) return { path: p, ok: false, help: FRPC_HELP };
    return { path: p, ok: true, version: (r.stdout || '').trim() };
  } catch {
    return { path: p, ok: false, help: FRPC_HELP };
  }
}

class TunnelManager {
  private workerId = process.env.C9AI_WORKER_ID || `c9ai-${os.hostname()}-${process.pid}`;
  private running = new Map<string, RunningTunnel>();
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private onEvent: ((e: TunnelEvent) => void) | null = null;
  private cleanupHooked = false;
  private lastError: string | null = null;
  private lastPollAt: number | null = null;

  private emit(e: TunnelEvent): void {
    this.onEvent?.(e);
  }

  setEventSink(fn: ((e: TunnelEvent) => void) | null): void {
    this.onEvent = fn;
  }

  status() {
    const frpc = checkFrpc();
    return {
      workerId: this.workerId,
      looping: this.timer !== null,
      frpc: { path: frpc.path, ok: frpc.ok, version: frpc.version },
      running: [...this.running.values()].map(t => ({
        slug: t.slug, publicUrl: t.publicUrl, localPort: t.localPort, active: t.active,
      })),
      lastPollAt: this.lastPollAt,
      lastError: this.lastError,
    };
  }

  /** Start the background poll loop. Safe to call repeatedly. */
  startLoop(intervalMs = 20000): { ok: boolean; reason?: string } {
    const cfg = loadMatsyaConfig();
    if (!cfg) return { ok: false, reason: 'MATSYA_API_KEY not set — run `matsya setup <key>`' };
    this.hookCleanup();
    if (this.timer) return { ok: true };
    this.timer = setInterval(() => void this.poll(), intervalMs);
    void this.poll(); // kick immediately
    return { ok: true };
  }

  stopLoop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** One reconcile pass. Exposed for `tunnels once` and used by the loop. */
  async poll(): Promise<{ ok: boolean; reason?: string }> {
    if (this.polling) return { ok: true };
    const cfg = loadMatsyaConfig();
    if (!cfg) return { ok: false, reason: 'MATSYA_API_KEY not set' };
    this.polling = true;
    const api = new MatsyaAPI(cfg);
    try {
      const { start, stop } = await api.agentPollTunnels();
      this.lastPollAt = Date.now();
      this.lastError = null;

      for (const slug of stop) await this.stopTunnel(api, slug);
      for (const t of start) {
        if (!this.running.has(t.slug)) this.spawnTunnel(api, t);
      }
      // Heartbeat the live ones.
      for (const t of this.running.values()) {
        if (t.active) {
          api.agentReportTunnel({ slug: t.slug, status: 'heartbeat', worker_id: this.workerId })
            .catch(() => {});
        }
      }
      return { ok: true };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: this.lastError };
    } finally {
      this.polling = false;
    }
  }

  private spawnTunnel(api: MatsyaAPI, t: TunnelStart): void {
    // Fail fast with a helpful message if frpc isn't installed.
    const probe = checkFrpc();
    if (!probe.ok) {
      this.emit({ level: 'error', text: `tunnel ${t.slug}: ${probe.help}` });
      api.agentReportTunnel({ slug: t.slug, status: 'error', worker_id: this.workerId, error: FRPC_HELP }).catch(() => {});
      return;
    }

    const dir = path.join(os.tmpdir(), 'c9ai-tunnels');
    fs.mkdirSync(dir, { recursive: true });
    const cfgPath = path.join(dir, `${t.slug}.toml`);
    const toml = [
      `serverAddr = "${t.server_addr}"`,
      `serverPort = ${t.server_port}`,
      `auth.method = "token"`,
      `auth.token = "${t.frp_token}"`,
      ``,
      `[[proxies]]`,
      `name = "${t.slug}"`,
      `type = "http"`,
      `localPort = ${t.local_port}`,
      `subdomain = "${t.subdomain}"`,
      ``,
    ].join('\n');
    fs.writeFileSync(cfgPath, toml, { mode: 0o600 });

    const frpc = resolveFrpc();
    let child: ChildProcess;
    try {
      child = spawn(frpc, ['-c', cfgPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      const msg = `spawn frpc failed: ${err instanceof Error ? err.message : String(err)}`;
      this.emit({ level: 'error', text: `tunnel ${t.slug}: ${msg}` });
      api.agentReportTunnel({ slug: t.slug, status: 'error', worker_id: this.workerId, error: msg }).catch(() => {});
      return;
    }

    const rec: RunningTunnel = {
      slug: t.slug, child, cfgPath, publicUrl: t.public_url,
      localPort: t.local_port, active: false, reported: false,
    };
    this.running.set(t.slug, rec);
    this.emit({ level: 'info', text: `tunnel ${t.slug}: starting -> localhost:${t.local_port}` });

    const onSuccess = () => {
      if (rec.reported) return;
      rec.active = true; rec.reported = true;
      this.emit({ level: 'info', text: `tunnel ${t.slug}: live at ${t.public_url}` });
      api.agentReportTunnel({
        slug: t.slug, status: 'active', worker_id: this.workerId, public_url: t.public_url,
      }).catch(() => {});
    };
    const fail = (reason: string) => {
      if (rec.reported) return;
      rec.reported = true;
      this.emit({ level: 'error', text: `tunnel ${t.slug}: ${reason}` });
      api.agentReportTunnel({ slug: t.slug, status: 'error', worker_id: this.workerId, error: reason }).catch(() => {});
      this.killRec(rec);
      this.running.delete(t.slug);
    };

    let buf = '';
    const watch = (chunk: Buffer) => {
      buf += chunk.toString();
      if (/start proxy success/i.test(buf)) onSuccess();
      else if (/(login to server error|start error|proxy.*error|connect to server error)/i.test(buf)) {
        fail(buf.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 200) || 'frpc reported an error');
      }
    };
    child.stdout?.on('data', watch);
    child.stderr?.on('data', watch);

    const timeout = setTimeout(() => {
      if (!rec.reported) fail('timed out waiting for frpc to connect (is the relay reachable?)');
    }, SPAWN_TIMEOUT_MS);

    child.on('error', err => fail(`frpc process error: ${err.message}`));
    child.on('exit', code => {
      clearTimeout(timeout);
      if (!rec.reported) fail(`frpc exited (code ${code}) before connecting`);
      // If it dies after going active, drop it from the running set so a later
      // poll can be reconciled by the server (status stays 'active' until reaper).
      this.running.delete(t.slug);
      this.cleanupCfg(rec.cfgPath);
    });
  }

  private async stopTunnel(api: MatsyaAPI, slug: string): Promise<void> {
    const rec = this.running.get(slug);
    if (rec) {
      this.killRec(rec);
      this.running.delete(slug);
      this.cleanupCfg(rec.cfgPath);
      this.emit({ level: 'info', text: `tunnel ${slug}: stopped` });
    }
    // Report stopped even if we weren't hosting it, so the server finalizes.
    await api.agentReportTunnel({ slug, status: 'stopped', worker_id: this.workerId }).catch(() => {});
  }

  private killRec(rec: RunningTunnel): void {
    try { rec.child.kill(); } catch { /* already gone */ }
  }

  private cleanupCfg(p: string): void {
    try { fs.unlinkSync(p); } catch { /* ignore */ }
  }

  /** Kill all frpc children. Best-effort report stopped (used on shutdown). */
  async shutdownAll(report = true): Promise<void> {
    this.stopLoop();
    const cfg = loadMatsyaConfig();
    const api = cfg ? new MatsyaAPI(cfg) : null;
    const slugs = [...this.running.keys()];
    for (const rec of this.running.values()) {
      this.killRec(rec);
      this.cleanupCfg(rec.cfgPath);
    }
    this.running.clear();
    if (report && api) {
      await Promise.allSettled(
        slugs.map(slug => api.agentReportTunnel({ slug, status: 'stopped', worker_id: this.workerId }))
      );
    }
  }

  private hookCleanup(): void {
    if (this.cleanupHooked) return;
    this.cleanupHooked = true;
    // Synchronous kill on process exit (can't await network here).
    process.on('exit', () => {
      for (const rec of this.running.values()) {
        try { rec.child.kill(); } catch { /* ignore */ }
      }
    });
    // Graceful on termination signals (don't bind SIGINT — the TUI owns Ctrl-C).
    process.on('SIGTERM', () => { void this.shutdownAll(true); });
  }
}

let singleton: TunnelManager | null = null;
export function getTunnelManager(): TunnelManager {
  if (!singleton) singleton = new TunnelManager();
  return singleton;
}
