export interface ConfirmRequest {
  /** Human-readable pattern name, e.g. "rm -rf" or "git push --force". */
  reason: string;
  /** Full command string the tool wants to execute. */
  command: string;
}

export type ConfirmResponse = 'allow' | 'allow-session' | 'deny';

export interface ToolContext {
  cwd: string;
  emit: (chunk: string) => void;
  /** Aborts a long-running tool call. shell.run honors this; fast tools may ignore it. */
  signal?: AbortSignal;
  /**
   * Interactive permission gate. If undefined (e.g. one-shot CLI mode), tools
   * that need confirmation should fail closed. The TUI provides this with a
   * y/s/n prompt and an in-session allowlist.
   */
  confirm?: (req: ConfirmRequest) => Promise<ConfirmResponse>;
  /**
   * Folders the user has explicitly opted in to via `~/.c9ai/scope.json`.
   * fs.* tools refuse to operate outside `cwd ∪ scope.roots`. Empty roots
   * means "cwd only" — same default as before scope existed.
   */
  scope?: { roots: string[] };
}

export interface ToolResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export interface ToolArg {
  name: string;
  description: string;
  required?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  /** Default param name when the sigil is invoked with bare positional text. */
  positional?: string;
  /**
   * Full arg surface — used to render accurate usage strings in the agent
   * system prompt. Without this, models guess the format and frequently
   * collapse multi-arg calls into a single positional blob.
   */
  args?: ToolArg[];
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface ToolRegistryEntry {
  /** Shell command template — `{{positional}}` and `{{key}}` are substituted. */
  command: string;
  description?: string;
  positional?: string;
}

export interface ToolRegistryFile {
  tools: Record<string, ToolRegistryEntry>;
}
