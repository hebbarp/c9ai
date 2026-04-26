import type { Provider } from './providers/types.js';
import type { ChatMessage } from './core/types.js';
import { Guards, type GuardOptions, type GuardTripReason } from './agent/guards.js';

export interface AutonomousOptions extends GuardOptions {
  doneSentinel?: string;
  onStep?: (iter: number, output: string) => void;
}

export interface AutonomousResult {
  ok: boolean;
  reason: 'done' | GuardTripReason | 'error';
  iterations: number;
  elapsedMs: number;
  finalOutput: string;
}

const DEFAULT_SENTINEL = '<<DONE>>';

/**
 * Tool-call wiring is not yet in the chat path (Phase 1 ships providers
 * and a tool registry, not joint execution). This loop accepts a goal,
 * keeps prompting until the model emits the done sentinel, and trips on
 * the standard guards. Once tools land in the chat path, the same Guards
 * instance can supervise tool-execution iterations.
 */
export async function runAutonomous(
  provider: Provider,
  goal: string,
  opts: AutonomousOptions = {}
): Promise<AutonomousResult> {
  const sentinel = opts.doneSentinel ?? DEFAULT_SENTINEL;
  const guards = new Guards(opts);
  const conversation: ChatMessage[] = [
    {
      role: 'user',
      content:
        `${goal}\n\n` +
        `When you have completed the task or cannot make further progress, ` +
        `emit the literal token ${sentinel} on its own line.`,
    },
  ];

  let lastOutput = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const guard = guards.tick(`turn:${conversation.length}`);
    if (guard.tripped) {
      return {
        ok: false,
        reason: guard.tripped,
        iterations: guard.iteration,
        elapsedMs: guard.elapsedMs,
        finalOutput: lastOutput,
      };
    }

    let buf = '';
    const result = await provider.chat(conversation, chunk => {
      buf += chunk;
    });
    lastOutput = buf;
    opts.onStep?.(guard.iteration, buf);

    if (result.exitCode !== 0) {
      return {
        ok: false,
        reason: 'error',
        iterations: guard.iteration,
        elapsedMs: guards.snapshot().elapsedMs,
        finalOutput: buf,
      };
    }

    conversation.push({ role: 'assistant', content: buf });

    if (buf.includes(sentinel)) {
      return {
        ok: true,
        reason: 'done',
        iterations: guard.iteration,
        elapsedMs: guards.snapshot().elapsedMs,
        finalOutput: buf,
      };
    }

    conversation.push({
      role: 'user',
      content: 'Continue. If the task is complete, emit ' + sentinel + '.',
    });
  }
}
