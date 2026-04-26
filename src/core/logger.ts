import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LOGS_DIR, ensureDirs } from './config.js';

export interface LogEvent {
  ts: number;
  kind: string;
  data: unknown;
}

function todayLogPath(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.join(LOGS_DIR, `${y}-${m}-${day}.jsonl`);
}

let writeQueue: Promise<void> = Promise.resolve();

export function logEvent(kind: string, data: unknown): void {
  const event: LogEvent = { ts: Date.now(), kind, data };
  const line = JSON.stringify(event) + '\n';
  writeQueue = writeQueue
    .then(async () => {
      await ensureDirs();
      await fs.appendFile(todayLogPath(), line, 'utf8');
    })
    .catch(() => {
      /* swallow logging errors */
    });
}

export async function flushLogs(): Promise<void> {
  await writeQueue;
}
