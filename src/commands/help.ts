import type { Command } from '../core/types.js';

const HELP_TEXT = `c9ai commands:
  help                            show this help
  switch <claude|gemini|ollama>   change default model
  switch ollama <model>           also pin the ollama model
  switch ollama list              show installed ollama models
  todos [list|add|sync]           manage GitHub Issues backlog
  resume [<n> | list]             resume a prior conversation (default: most recent)
  clear                           wipe in-memory history; start a fresh session
  config                          show current config
  analytics                       show interaction stats (stub)
  tools                           list providers, tools, and aliases
  exit | quit                     leave c9ai

Keys:
  ↑ / ↓                           cycle through prompt history (persisted in ~/.c9ai/history.json)
  Esc                             cancel the current run (chat or agent), or deny a confirm prompt
  Ctrl+C                          quit c9ai

Input shapes:
  claude|gemini|ollama <prompt>   one-shot chat to a specific provider
  @claude | @gemini | @ollama     same as above (sigil form)
  agent <goal>                    autonomous loop: model uses tools until done
  research <topic-or-file>        bounded autoresearch iteration → memo in outputs/
  @<tool> <args>                  run a registered tool (see "tools")
  !<shell command>                run a shell command (cd is handled)
  <anything else>                 chat with the default model

Tools:
  fs:     @fs.read <path>, @fs.write path=<p> content=<text>, @fs.list [<path>]
  search: @fs.glob <pattern>, @fs.grep <pattern> [glob=...] [root=...]
  meta:   @date.now, @env.cwd, @env.platform
  shell:  @shell.run <cmd>     (catastrophic patterns hard-block; risky ones prompt for [y/s/n])

Personalization:
  Profile:       ~/.c9ai/profile.md       (auto-injected as system prompt for chat + agent)
  Scope:         ~/.c9ai/scope.json       ({"roots": ["..."]} folders fs.* may read)
  User tools:    ~/.c9ai/tools-registry.json
  Aliases:       ~/.c9ai/aliases.json
  Agent prompt:  ~/.c9ai/agent-prompt.md  (use {{tools}} and {{goal}})

Env knobs:
  ANTHROPIC_API_KEY, CLAUDE_MODEL
  OLLAMA_URL (default http://localhost:11434), OLLAMA_MODEL
  GEMINI_BIN (default 'gemini')
  C9AI_MAX_ITER (default 25), C9AI_MAX_WALL_SEC (default 600), C9AI_STALL_REPEATS (default 3)
  C9AI_SHELL_TIMEOUT_SEC (default 120), C9AI_ALLOW_DESTRUCTIVE (set to 1 to bypass shell.run safety)
  C9AI_SCOPE_LIST_MAX_FILES (default 100), C9AI_SCOPE_LIST_MAX_DEPTH (default 3)
`;

export const helpCommand: Command = {
  name: 'help',
  description: 'Show available commands',
  run: async (_args, ctx) => {
    ctx.emit({ kind: 'system', text: HELP_TEXT });
  },
};
