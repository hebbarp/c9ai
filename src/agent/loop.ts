import type { Provider } from '../providers/types.js';
import type { Tool, ConfirmRequest, ConfirmResponse } from '../tools/types.js';
import type { ChatMessage } from '../core/types.js';
import { Guards, type GuardOptions, type GuardTripReason } from './guards.js';
import { buildAgentPrompt, DONE_SENTINEL } from './prompt.js';
import { extractFirstToolCall } from './extract.js';

export type AgentEvent =
  | { type: 'start'; goal: string; provider: string }
  | { type: 'thought'; chunk: string }
  | { type: 'turn-end' }
  | { type: 'tool-call'; name: string; args: Record<string, unknown> }
  | { type: 'tool-output'; chunk: string }
  | { type: 'tool-result'; ok: boolean; error?: string }
  | {
      type: 'finish';
      reason: 'done' | GuardTripReason | 'no-tool-call' | 'error' | 'aborted';
      iterations: number;
      elapsedMs: number;
    };

export interface AgentOptions extends GuardOptions {
  cwd?: string;
  signal?: AbortSignal;
  confirm?: (req: ConfirmRequest) => Promise<ConfirmResponse>;
  /** User-scoped folders the agent's fs tools may read from. */
  scope?: { roots: string[] };
  /**
   * Optional user profile injected into the agent's system prompt as
   * background. Refreshed by the host on each agent invocation.
   */
  profile?: string | null;
}

const OBSERVATION_CAP = 8000;

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

export async function runAgent(
  provider: Provider,
  goal: string,
  tools: Map<string, Tool>,
  emit: (e: AgentEvent) => void,
  opts: AgentOptions = {}
): Promise<void> {
  const cwd = opts.cwd ?? process.cwd();
  const signal = opts.signal;
  const scope = opts.scope ?? { roots: [] };
  const guards = new Guards(opts);
  const systemPrompt = await buildAgentPrompt(goal, tools, opts.profile ?? null, scope);

  // System role is now real (providers know how to translate it). The
  // goal goes as the first user message so every provider has a user
  // turn to respond to (Ollama in particular needs this).
  const conversation: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: goal },
  ];

  emit({ type: 'start', goal, provider: provider.name });

  const finishAborted = () => {
    const snap = guards.snapshot();
    emit({
      type: 'finish',
      reason: 'aborted',
      iterations: snap.iteration,
      elapsedMs: snap.elapsedMs,
    });
  };

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) {
      finishAborted();
      return;
    }

    let buf = '';
    const result = await provider.chat(
      conversation,
      chunk => {
        buf += chunk;
        emit({ type: 'thought', chunk });
      },
      signal
    );
    emit({ type: 'turn-end' });

    if (result.aborted || signal?.aborted) {
      finishAborted();
      return;
    }
    if (result.exitCode !== 0) {
      emit({
        type: 'finish',
        reason: 'error',
        iterations: guards.snapshot().iteration,
        elapsedMs: guards.snapshot().elapsedMs,
      });
      return;
    }

    conversation.push({ role: 'assistant', content: buf });

    // Extract tool call BEFORE checking DONE. Small models routinely emit
    // both `@tool ...` and `<<DONE>>` in the same turn ("I'll do this last
    // thing and be done"). Honoring DONE first would silently skip the
    // tool — exactly the bug we hit on `agent write today's date to today.txt`.
    const call = extractFirstToolCall(buf, tools);
    const sawDone = buf.includes(DONE_SENTINEL);

    if (!call) {
      const snap = guards.snapshot();
      emit({
        type: 'finish',
        reason: sawDone ? 'done' : 'no-tool-call',
        iterations: snap.iteration,
        elapsedMs: snap.elapsedMs,
      });
      return;
    }

    const guard = guards.tick(`${call.name}:${JSON.stringify(call.args)}`);
    if (guard.tripped) {
      emit({
        type: 'finish',
        reason: guard.tripped,
        iterations: guard.iteration,
        elapsedMs: guard.elapsedMs,
      });
      return;
    }

    emit({ type: 'tool-call', name: call.name, args: call.args });
    const tool = tools.get(call.name)!;
    let observation = '';
    const toolResult = await tool.run(call.args, {
      cwd,
      signal,
      confirm: opts.confirm,
      scope,
      emit: chunk => {
        observation += chunk;
        emit({ type: 'tool-output', chunk });
      },
    });
    emit({ type: 'tool-result', ok: toolResult.ok, error: toolResult.error });

    if (signal?.aborted) {
      finishAborted();
      return;
    }

    // If the model emitted DONE alongside the tool call, the tool has now
    // run — honor the done signal without forcing another turn.
    if (sawDone) {
      const snap = guards.snapshot();
      emit({
        type: 'finish',
        reason: 'done',
        iterations: snap.iteration,
        elapsedMs: snap.elapsedMs,
      });
      return;
    }

    const obsBody = toolResult.ok
      ? clip(observation || toolResult.output || '(no output)', OBSERVATION_CAP)
      : `error: ${toolResult.error ?? 'unknown'}`;

    conversation.push({
      role: 'user',
      content: `<observation>\n${obsBody}\n</observation>`,
    });
  }
}
