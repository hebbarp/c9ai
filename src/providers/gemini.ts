import { spawn } from 'node:child_process';
import os from 'node:os';
import type { ChatMessage } from '../core/types.js';
import type { Provider, ChatResult } from './types.js';

const DEFAULT_BIN = 'gemini';

function getBin(): string {
  return process.env.GEMINI_BIN || DEFAULT_BIN;
}

async function available(): Promise<boolean> {
  return new Promise(resolve => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(getBin(), ['--version'], { shell: true });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('exit', code => resolve(code === 0));
  });
}

function chat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResult> {
  return new Promise(resolve => {
    // Gemini CLI is single-turn: take the most recent user message and
    // drop earlier history. (To get true multi-turn, migrate to the
    // @google/genai SDK as we did for Claude.)
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) {
      onChunk('(no user message to send)\n');
      resolve({ exitCode: 2 });
      return;
    }

    // Flatten any system messages onto the user prompt — Gemini CLI has no
    // system-role parameter, so prepending is the only way to thread the
    // profile / agent prompt through.
    const systemParts = messages.filter(m => m.role === 'system').map(m => m.content);
    const prompt = systemParts.length > 0
      ? `${systemParts.join('\n\n')}\n\n---\n\n${lastUser.content}`
      : lastUser.content;

    const child = spawn(getBin(), ['-p', prompt], {
      shell: true,
      cwd: os.homedir(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let abortHandler: (() => void) | null = null;
    if (signal) {
      if (signal.aborted) {
        child.kill();
        resolve({ exitCode: 0, aborted: true });
        return;
      }
      abortHandler = () => child.kill();
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    child.stdin?.end();

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (data: string) => onChunk(data));
    child.stderr?.on('data', (data: string) => onChunk(data));

    child.on('error', err => {
      if (abortHandler) signal?.removeEventListener('abort', abortHandler);
      onChunk(`\n[gemini spawn error: ${err.message}]\n`);
      resolve({ exitCode: -1 });
    });
    child.on('exit', code => {
      if (abortHandler) signal?.removeEventListener('abort', abortHandler);
      if (signal?.aborted) {
        resolve({ exitCode: 0, aborted: true });
      } else {
        resolve({ exitCode: code ?? -1 });
      }
    });
  });
}

export const geminiProvider: Provider = {
  name: 'gemini',
  get bin() {
    return getBin();
  },
  available,
  chat,
};
