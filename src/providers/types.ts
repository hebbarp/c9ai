import type { ChatMessage, ProviderName } from '../core/types.js';

export interface ChatResult {
  exitCode: number;
  /** True if the run was cancelled via the AbortSignal. */
  aborted?: boolean;
}

export interface Provider {
  name: ProviderName;
  bin: string;
  available: () => Promise<boolean>;
  /**
   * Send the full conversation history and stream the assistant response.
   * Providers that don't natively support multi-turn (e.g. CLI subprocess)
   * may fall back to using only the last user message.
   *
   * If `signal` is provided and aborts mid-stream, the call returns with
   * `aborted: true` (no exception). Buffered chunks may still be emitted
   * via onChunk before the abort takes effect.
   */
  chat: (
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ) => Promise<ChatResult>;
}
