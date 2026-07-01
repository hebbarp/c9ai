import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { Command } from '../core/types.js';
import { TOPIC_HELP, listTopics } from '../help-pages.js';
import { CONFIG_DIR } from '../core/config.js';
import { buildHelpHtml } from '../help-html.js';

const require = createRequire(import.meta.url);

function appVersion(): string {
  try {
    return (require('../../package.json') as { version?: string }).version ?? '4.0.0';
  } catch {
    return '4.0.0';
  }
}

/** Open a file with the OS default handler, detached so the TUI keeps running. */
function openInBrowser(target: string): void {
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', target]]
      : process.platform === 'darwin'
        ? ['open', [target]]
        : ['xdg-open', [target]];
  try {
    const child = spawn(cmd, args as string[], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {
    /* fall back to the printed path below */
  }
}

/** Generate the HTML cheat-sheet, write it to ~/.c9ai, and open it. */
async function openHtmlHelp(ctx: Parameters<Command['run']>[1]): Promise<void> {
  const outPath = path.join(CONFIG_DIR, 'help.html');
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(outPath, buildHelpHtml(appVersion()), 'utf8');
  } catch (e) {
    ctx.emit({ kind: 'error', text: `help: could not write ${outPath}: ${e instanceof Error ? e.message : String(e)}` });
    return;
  }
  openInBrowser(outPath);
  ctx.emit({ kind: 'system', text: `help: opened ${outPath} in your browser (open it manually if it didn't pop up)` });
}

const HELP_SHORT = `c9ai — quick help    ·    help html (visual page)  ·  help full (everything)  ·  help <topic> (detail)

Talk to a model
  <message>                   chat with the default model
  claude|gemini|lab <msg>     one-shot to a specific provider
  clear · resume · save       new session · reopen a past one · export transcript

Providers   (local · lab · cloud)
  switch ollama <name>        LOCAL model on your machine   (switch ollama list)
  switch lab                  your office GPU               (switch lab list)
  switch claude               CLOUD  (also gemini, openai, gpt, kimi, deepseek, openrouter)

Settings & keys
  config                      show what's configured
  config <provider> <key>     save a key (claude, openai, lab, …)
  setup                       re-run the guided first-run wizard

Coding agent
  agent <goal>                autonomous: writes files, runs shell, searches the web
  agent                       toggle persistent agent mode (every message = a goal)
  research <topic>            bounded research → cited memo in outputs/

Todos, web & tools
  todos list · todos add      GitHub-Issues backlog (needs gh signed in)
  @web.search <query>         search the web
  @fs.read <path> · !<cmd>    file tools · run a shell command
  tools                       list every provider, tool, and alias

Your own models
  models list · pampa         Small Language Foundry (guide: docs/create-your-models.md)

Keys:  ↑/↓ prompt history   ·   Esc cancel a run   ·   Ctrl+C quit
`;

const HELP_FULL = `c9ai commands:  (short version: help  ·  visual page: help html)
  help                            show the short quick-help
  help full                       show this full reference
  help html                       open a scannable, task-grouped help page in your browser
  switch <provider>               change default model
  switch ollama <model>           also pin the ollama model
  switch ollama list              show installed ollama models
  switch openai|kimi|deepseek|openrouter|lab list
                                  show hosted provider models
                                  (tiers: local=ollama · lab=office GPU · cloud=rest)
  todos [list|add|sync]           manage GitHub Issues backlog
  resume [<n> | list]             resume a prior conversation (default: most recent)
  save [path]                     export current visible conversation to markdown
  clear                           wipe in-memory history; start a fresh session
  config                          show current config
  config openai <key>             save OpenAI API key
  config kimi <key>               save Kimi API key
  config deepseek <key>           save DeepSeek API key
  config openrouter <key>         save OpenRouter API key
  config lab <key>                save Matsya key for the Lab GPU
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
  openai|gpt|kimi|deepseek|openrouter|lab <prompt>
                                  one-shot OpenAI-compatible chat (lab = office GPU)
  @claude | @gemini | @ollama     provider sigil form
  agent                           toggle persistent agent mode (prompts become goals)
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
  MATSYA_API_KEY (Lab auth), LAB_MODEL (default 'auto'), LAB_BASE_URL (default https://lab.knobly.com/gpu/v1)
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
      ctx.emit({ kind: 'system', text: HELP_SHORT });
      return;
    }
    if (topic === 'full' || topic === 'all' || topic === 'everything') {
      ctx.emit({ kind: 'system', text: HELP_FULL });
      return;
    }
    if (topic === 'html' || topic === 'web' || topic === '--html' || topic === 'open') {
      await openHtmlHelp(ctx);
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
