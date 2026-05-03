import type { Command } from '../core/types.js';
import { TOPIC_HELP, listTopics } from '../help-pages.js';

const HELP_TEXT = `c9ai commands:
  help                            show this help
  switch <provider>               change default model
  switch ollama <model>           also pin the ollama model
  switch ollama list              show installed ollama models
  switch openai|kimi|deepseek|openrouter list
                                  show hosted provider models
  todos [list|add|sync]           manage GitHub Issues backlog
  resume [<n> | list]             resume a prior conversation (default: most recent)
  save [path]                     export current visible conversation to markdown
  clear                           wipe in-memory history; start a fresh session
  config                          show current config
  config openai <key>             save OpenAI API key
  config kimi <key>               save Kimi API key
  config deepseek <key>           save DeepSeek API key
  config openrouter <key>         save OpenRouter API key
  models [list|samples]           manage Small Language Foundry projects
  pampa [status|sample]           generate from local Pampa tiny LM baseline
  models init <sample>            create a bundled sample model project
  models init <name> <tag>        register a custom Ollama-backed model
  models status <name>            readiness summary + hashes
  models doctor <name>            local diagnostics for training/package
  models corpus <name> add <path> copy .md/.txt files into model corpus
  models pairs <name> audit       check pair quality issues
  models eval <name>              run eval questions with current provider
  models evals-list <name>        list saved eval runs
  models review <name> [run-file] score latest or named eval run
  models compare <name> [run-a] [run-b]
                                  compare reviewed eval runs
  models export <name>            export model project bundle
  models switch <name>            switch to a registered local model
  switch <model-name>             switch to a registered local model
  analytics                       show interaction stats (stub)
  tools                           list providers, tools, and aliases
  exit | quit                     leave c9ai

Keys:
  ↑ / ↓                           cycle through prompt history (persisted in ~/.c9ai/history.json)
  Esc                             cancel the current run (chat or agent), or deny a confirm prompt
  Ctrl+C                          quit c9ai

Input shapes:
  claude|gemini|ollama|soul <prompt>
                                  one-shot chat to a specific provider
  openai|gpt|kimi|deepseek|openrouter <prompt>
                                  one-shot OpenAI-compatible chat
  @claude | @gemini | @ollama     provider sigil form
  agent <goal>                    autonomous loop: model uses tools until done
  soul agent <goal>               autonomous loop with Soul posture
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
  Scope:         current working dir      (use !cd to change the tool boundary)
  User tools:    ~/.c9ai/tools-registry.json
  Aliases:       ~/.c9ai/aliases.json
  Agent prompt:  ~/.c9ai/agent-prompt.md  (use {{tools}} and {{goal}})

Env knobs:
  ANTHROPIC_API_KEY, CLAUDE_MODEL
  OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL
  KIMI_API_KEY, KIMI_MODEL, KIMI_BASE_URL
  DEEPSEEK_API_KEY, DEEPSEEK_MODEL, DEEPSEEK_BASE_URL
  OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL
  OLLAMA_URL (default http://localhost:11434), OLLAMA_MODEL
  GEMINI_BIN (default 'gemini')
  C9AI_MAX_ITER (default 25), C9AI_MAX_WALL_SEC (default 600), C9AI_STALL_REPEATS (default 3)
  C9AI_SHELL_TIMEOUT_SEC (default 120), C9AI_ALLOW_DESTRUCTIVE (set to 1 to bypass shell.run safety)
  C9AI_SCOPE_LIST_MAX_FILES (default 100), C9AI_SCOPE_LIST_MAX_DEPTH (default 3)

For a detailed page on any command, input shape, or concept:
  help topics                    list all available pages
  help <topic>                   man-page-style detail (e.g. help research)

Small Language Foundry guide:
  docs/create-your-models.md
`; 

export const helpCommand: Command = {
  name: 'help',
  description: 'Show available commands or a specific topic page',
  run: async (args, ctx) => {
    const topic = (args[0] ?? '').toLowerCase();
    if (!topic) {
      ctx.emit({ kind: 'system', text: HELP_TEXT });
      return;
    }
    if (topic === 'topics' || topic === 'list') {
      ctx.emit({ kind: 'system', text: listTopics(Object.keys(TOPIC_HELP)) });
      return;
    }
    const page = TOPIC_HELP[topic];
    if (page) {
      ctx.emit({ kind: 'system', text: page });
      return;
    }
    ctx.emit({
      kind: 'error',
      text: `no help for '${topic}'. try: help topics`,
    });
  },
};
