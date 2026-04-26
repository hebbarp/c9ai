import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './core/config.js';

export const SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');
const MAX_SESSIONS = 100;

/**
 * On-disk format: one JSON object per line in `~/.c9ai/sessions/<id>.jsonl`.
 * Only `user` and `provider` turns are persisted — those are the ones that
 * matter for replaying as multi-turn conversation context. System messages,
 * shell output, errors, tool outputs are not session-relevant.
 */
export interface SessionTurn {
  kind: 'user' | 'provider';
  text: string;
  ts: number;
}

export interface SessionMeta {
  id: string; // filename stem (no extension)
  path: string;
  mtime: number;
  firstPrompt: string;
  turnCount: number;
}

export async function ensureSessionsDir(): Promise<void> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

function newSessionId(): string {
  // ISO timestamp made filesystem-safe (no `:` or `.`)
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function createSession(): Promise<string> {
  await ensureSessionsDir();
  const id = newSessionId();
  await fs.writeFile(path.join(SESSIONS_DIR, `${id}.jsonl`), '', 'utf8');
  return id;
}

export async function appendTurn(id: string, turn: SessionTurn): Promise<void> {
  try {
    await fs.appendFile(
      path.join(SESSIONS_DIR, `${id}.jsonl`),
      JSON.stringify(turn) + '\n',
      'utf8'
    );
  } catch {
    // best-effort persistence; never block UX
  }
}

export async function appendTurns(id: string, turns: SessionTurn[]): Promise<void> {
  if (turns.length === 0) return;
  const body = turns.map(t => JSON.stringify(t)).join('\n') + '\n';
  try {
    await fs.appendFile(path.join(SESSIONS_DIR, `${id}.jsonl`), body, 'utf8');
  } catch {
    // ignore
  }
}

export async function listSessions(): Promise<SessionMeta[]> {
  try {
    await ensureSessionsDir();
  } catch {
    return [];
  }
  let entries: string[];
  try {
    entries = await fs.readdir(SESSIONS_DIR);
  } catch {
    return [];
  }

  const metas: SessionMeta[] = [];
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue;
    const p = path.join(SESSIONS_DIR, name);
    try {
      const stat = await fs.stat(p);
      const raw = await fs.readFile(p, 'utf8');
      const lines = raw.split('\n').filter(l => l.trim() !== '');
      let firstPrompt = '';
      for (const line of lines) {
        try {
          const obj = JSON.parse(line) as SessionTurn;
          if (obj.kind === 'user') {
            firstPrompt = obj.text;
            break;
          }
        } catch {
          /* skip malformed line */
        }
      }
      metas.push({
        id: name.slice(0, -'.jsonl'.length),
        path: p,
        mtime: stat.mtimeMs,
        firstPrompt,
        turnCount: lines.length,
      });
    } catch {
      /* skip unreadable file */
    }
  }
  metas.sort((a, b) => b.mtime - a.mtime); // newest first
  return metas;
}

export async function loadSession(id: string): Promise<SessionTurn[]> {
  const p = path.join(SESSIONS_DIR, `${id}.jsonl`);
  let raw: string;
  try {
    raw = await fs.readFile(p, 'utf8');
  } catch {
    return [];
  }
  const out: SessionTurn[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line) as SessionTurn;
      if ((obj.kind === 'user' || obj.kind === 'provider') && typeof obj.text === 'string') {
        out.push({ kind: obj.kind, text: obj.text, ts: typeof obj.ts === 'number' ? obj.ts : 0 });
      }
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

export async function pruneSessions(keep: number = MAX_SESSIONS): Promise<number> {
  const sessions = await listSessions();
  if (sessions.length <= keep) return 0;
  // listSessions returns newest-first; oldest are at the end
  const toDelete = sessions.slice(keep);
  let deleted = 0;
  for (const s of toDelete) {
    try {
      await fs.unlink(s.path);
      deleted += 1;
    } catch {
      /* skip */
    }
  }
  return deleted;
}

export function formatAgo(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}
