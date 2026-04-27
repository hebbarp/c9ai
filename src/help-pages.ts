// Man-page-style long-form help, one entry per topic.
// Convention: NAME / SYNOPSIS / DESCRIPTION / [OPTIONS] / [EXAMPLES] /
// [FILES] / [SEE ALSO] sections, plain text, ~30-50 lines each.

export const TOPIC_HELP: Record<string, string> = {
  // ─── Commands ────────────────────────────────────────────────────────────

  help: `NAME
  help — show overview or a topic's detailed page

SYNOPSIS
  help
  help topics
  help <topic>

DESCRIPTION
  With no argument, prints the overview reference card. 'help topics'
  lists every available detailed page. 'help <topic>' shows the
  man-page-style entry for that topic — works for commands (switch,
  todos, etc.), input shapes (agent, research, shell, sigil), and
  concepts (scope, profile, env).

EXAMPLES
  help
  help topics
  help research
  help scope
`,

  switch: `NAME
  switch — change the default model or the ollama model name

SYNOPSIS
  switch
  switch <claude|gemini|ollama>
  switch ollama <model-name>
  switch ollama list

DESCRIPTION
  With no args, prints current default + ollama settings. With a
  provider name, sets that as the default for free-form chat and
  for 'agent' and 'research' runs. With 'ollama <name>', also pins
  the ollama model in ~/.c9ai/config.json (overrides OLLAMA_MODEL
  from .env going forward).

  'switch ollama list' queries /api/tags and shows what's actually
  installed locally — useful when you need to know which models
  are pullable without leaving the TUI.

  Persistence: choices are saved to ~/.c9ai/config.json. Restart
  the TUI and the same default sticks.

PRECEDENCE
  ollama model resolution: config.ollamaModel > $OLLAMA_MODEL >
  auto-detect (falls back to the only installed model, or asks if
  there are several).

EXAMPLES
  switch claude
  switch ollama gemma:4
  switch ollama list

SEE ALSO
  config, env
`,

  todos: `NAME
  todos — manage GitHub Issues as a work backlog

SYNOPSIS
  todos
  todos list
  todos add <title>
  todos sync

DESCRIPTION
  c9ai's backlog is GitHub Issues. 'todos list' shows the latest
  20 open issues for the current repo (whatever 'gh repo view'
  resolves to). 'todos add' creates a new one with the given title
  and an empty body. 'todos sync' is a no-op — issues are GitHub-
  backed already, no local cache to reconcile.

REQUIREMENTS
  The 'gh' CLI installed and authenticated (gh auth login). c9ai
  shells out to gh; it does not call the GitHub API directly.

EXAMPLES
  todos list
  todos add wire matsya queue auto-processing

SEE ALSO
  resume, agent
`,

  resume: `NAME
  resume — replay a prior conversation into the current TUI

SYNOPSIS
  resume
  resume list
  resume <n>

DESCRIPTION
  Sessions are written to ~/.c9ai/sessions/<ISO>.jsonl, one file per
  TUI run. 'resume list' shows the latest sessions with timestamps
  and turn counts. 'resume' alone replays the most recent. 'resume
  <n>' replays the n-th most recent (1 = most recent, matching the
  ordering in 'resume list').

  Replay loads prior user/provider turns into the live history
  buffer and rotates a new session file, so the resumed conversation
  continues in a separate file from the original.

EXAMPLES
  resume list
  resume                (latest)
  resume 3              (third-most-recent)

FILES
  ~/.c9ai/sessions/*.jsonl

SEE ALSO
  clear
`,

  clear: `NAME
  clear — wipe the in-memory conversation, start a fresh session

SYNOPSIS
  clear

DESCRIPTION
  Clears the live history buffer and rotates to a new session file.
  The previous session file is left intact on disk; you can still
  'resume' it later.

  Useful when starting an unrelated task and you don't want the
  old context bleeding into the next provider call.

SEE ALSO
  resume
`,

  config: `NAME
  config — show current configuration

SYNOPSIS
  config

DESCRIPTION
  Prints the path to ~/.c9ai/config.json plus the resolved values
  for defaultModel, ollamaModel, ollamaUrl, lastUpdated. Read-only
  command — to change values, use 'switch'.

FILES
  ~/.c9ai/config.json

SEE ALSO
  switch, env
`,

  tools: `NAME
  tools — list providers, registered tools, and aliases

SYNOPSIS
  tools

DESCRIPTION
  Three sections:

   - Providers: the model backends in src/providers/ — claude,
     gemini, ollama. Includes which one is the current default.

   - Tools: every '@name' the agent and the sigil dispatcher can
     call. Built-ins (fs.*, date.now, env.*, shell.run) plus
     anything from ~/.c9ai/tools-registry.json.

   - Aliases: shorthand sigils from ~/.c9ai/aliases.json.

SEE ALSO
  sigil, shell, agent
`,

  analytics: `NAME
  analytics — interaction stats (stub)

SYNOPSIS
  analytics

DESCRIPTION
  Placeholder. Eventually: per-provider call counts, token totals,
  cost estimates, agent run histograms. Currently prints a stub line.
`,

  // ─── Action kinds (input shapes) ───────────────────────────────────────

  agent: `NAME
  agent — autonomous tool-use loop

SYNOPSIS
  agent <goal>

DESCRIPTION
  Runs the model in a loop. Each turn the model emits ONE tool call
  in the form '@<tool> <args>'; c9ai executes it and returns the output
  as an observation in the next turn. The loop ends when the model
  emits the literal token <<DONE>> on its own line, or when a guard
  trips (max iterations, wall-clock, repeated stall).

  The system prompt is LEAN by default — just the tool list. Add these
  sigils anywhere in the goal to opt extra context in:

   @profile   include your profile (~/.c9ai/profile.md)
   @scope     list files in the current working directory

  Both are opt-in because they add prefill cost that hurts small/local
  models. Tools still get full scope.roots for read permissions either
  way — opt-in only controls what the model sees up-front.

  Cancel mid-run with Esc.

GUARDS
  C9AI_MAX_ITER         hard cap on iterations (default 25)
  C9AI_MAX_WALL_SEC     hard cap on wall-clock seconds (default 600)
  C9AI_STALL_REPEATS    same-action repeats before stop (default 3)

EXAMPLES
  agent write today's date to today.txt
  agent @scope summarize the markdown files in 5 bullets
  agent @scope @profile find work that matches my goals

SEE ALSO
  research, scope, profile, tools, sigil
`,

  research: `NAME
  research — bounded autoresearch iteration

SYNOPSIS
  research <topic-or-file>

DESCRIPTION
  Runs ONE bounded iteration of the agent loop with a structured
  research prompt. If the argument is an existing markdown file, it
  is read as the program (brief / bounds / evaluator). Otherwise a
  brief is synthesized from the topic string.

  The agent uses tools to gather evidence (@fs.read for known paths,
  @fs.grep / @fs.glob across scoped folders), then writes ONE memo
  via @fs.write. The memo MUST end with a "## Verdict" section
  containing one of: keep | discard | needs-review.

  c9ai parses the verdict and appends a record to the run ledger.

OUTPUT
  Memo:   outputs/autoresearch-<slug>-<runId>.md
  Ledger: ~/.c9ai/brain/autoresearch/runs.jsonl
  Per-run JSON: ~/.c9ai/brain/autoresearch/runs/<runId>.json

EXAMPLES
  research what's in my notes about Q1 planning
  research ./programs/competitive-analysis.md
  research compare deepseek vs claude for coding tasks

SEE ALSO
  agent, scope, profile
`,

  shell: `NAME
  shell — run a shell command from the TUI

SYNOPSIS
  ! <command>

DESCRIPTION
  Anything starting with '!' is sent to the shell, NOT the model.
  Output streams into the TUI. Stays in the same working directory
  as the c9ai process; 'cd' is handled specially so the cwd persists
  for subsequent ! invocations.

  Catastrophic patterns (rm -rf /, fork bombs, etc.) are hard-blocked
  with no override. Risky-but-recoverable patterns (rm -rf <dir>,
  destructive git operations) prompt for confirmation: [y]es once,
  [s]ession (allow this pattern for the rest of the session), [n]o.

ENV
  C9AI_SHELL_TIMEOUT_SEC   per-command timeout (default 120)
  C9AI_ALLOW_DESTRUCTIVE   set to 1 to bypass risky-pattern prompts

EXAMPLES
  !ls -la
  !git status
  !cd subdir          (changes cwd for next ! command)

SEE ALSO
  tools, sigil
`,

  sigil: `NAME
  sigil — invoke a registered tool by its @name

SYNOPSIS
  @<tool-name> <args...>

DESCRIPTION
  Anything starting with '@' invokes a tool from the registry. Args
  can be passed positionally (in the order the tool declares) or
  named (key=value). Quote any value containing spaces.

  For tools that take a single 'content' or 'body' arg, you can use a
  heredoc on subsequent lines:

    @fs.write path=plan.md
    <<<
    # My Plan

    - First step
    - Second step
    >>>

ALIAS RESOLUTION
  Sigils are resolved against ~/.c9ai/aliases.json BEFORE the tool
  registry, so you can rebind '@x' to a longer tool name with extra
  default args.

BUILTIN TOOLS
  @fs.read <path>                read file content
  @fs.write path=<p> content=<>  write file (heredoc supported)
  @fs.list [<path>]              list directory entries
  @fs.glob <pattern>             glob match within scope
  @fs.grep <pattern> [glob=...]  ripgrep across scope
  @date.now                      current ISO timestamp
  @env.cwd / @env.platform       process info
  @shell.run <cmd>               run shell command (same safety
                                 rules as ! shell handler)

USER TOOLS
  Add entries to ~/.c9ai/tools-registry.json to register custom
  shell-wrapped tools.

SEE ALSO
  tools, shell, agent
`,

  chat: `NAME
  chat — talk to a specific provider, one shot

SYNOPSIS
  claude <prompt>
  gemini <prompt>
  ollama <prompt>
  @claude <prompt>     (sigil form)

DESCRIPTION
  Sends the prompt to a specific provider regardless of the current
  default model. Output streams. Useful when you want to compare
  answers across providers, or briefly use a non-default for one
  message without running 'switch'.

  Anything that doesn't match a provider keyword, command, or sigil
  goes to the current default model.

EXAMPLES
  claude what changed in this PR?
  ollama summarize this in 3 bullets
  @gemini same question but local-first

SEE ALSO
  switch, agent
`,

  // ─── Concepts ────────────────────────────────────────────────────────────

  scope: `NAME
  scope — folders the agent may read across

SYNOPSIS
  ~/.c9ai/scope.json
  { "roots": ["/abs/path/1", "/abs/path/2"] }

DESCRIPTION
  fs.* tools refuse to read files outside the current working
  directory by default. Adding a folder to scope.roots widens that
  sandbox: fs.read / fs.list / fs.glob / fs.grep accept paths under
  any scoped root. Writes follow the same boundary.

  Scope is also the foundation of c9ai's "passive context" model:
  every agent and research run includes a system-prompt block listing
  every file under each scope root with its size and either the first
  markdown '#' heading or first non-blank line. The model sees what's
  there before deciding which files to read.

  Drop a new note into a scoped folder; the next agent run sees it
  automatically — no need to glob first.

CAPS
  C9AI_SCOPE_LIST_MAX_FILES   files listed in the prompt (default 100)
  C9AI_SCOPE_LIST_MAX_DEPTH   max walk depth (default 3)

  node_modules, .git, dist, build, .venv, .cache, etc. are skipped.

EXAMPLES
  echo '{"roots":["/Users/me/notes","/Users/me/work"]}' > ~/.c9ai/scope.json

SEE ALSO
  profile, agent, research
`,

  profile: `NAME
  profile — your standing context, auto-injected as system prompt

SYNOPSIS
  ~/.c9ai/profile.md

DESCRIPTION
  Plain markdown describing who you are, what you're working on, your
  preferences. Auto-injected as the leading system prompt for every
  chat turn and agent run, so you don't have to restate it.

  Re-read on each turn — edits take effect on the next message
  without a TUI restart.

  Good content: role, current projects, tools/stack, communication
  style preferences, things you've already explained.

  Bad content: secrets (use .env), one-off context (just say it in
  the prompt), encyclopedic detail (the more there is, the more
  expensive every turn).

EXAMPLES
  cat > ~/.c9ai/profile.md <<EOF
  # Profile

  ## Role
  Founder, Knobly (CRM platform). Engineer's mindset, trained as PM.

  ## Stack
  TypeScript, Node, PHP/MySQL on the Matsya side. Python for ML.

  ## Style
  Direct. Skip preamble. Code over prose.
  EOF

SEE ALSO
  scope, agent, research
`,

  env: `NAME
  env — environment variables c9ai reads

SYNOPSIS
  Loaded from .env files (walking cwd → home), then ~/.c9ai/.env.
  Shell exports always win.

VARIABLES
  Providers
    ANTHROPIC_API_KEY            Claude credential
    CLAUDE_MODEL                 Claude model id (default opus-4-7)
    OLLAMA_URL                   Ollama server (default localhost:11434)
    OLLAMA_MODEL                 Ollama model; if unset, c9ai
                                 auto-detects via /api/tags
    GEMINI_BIN                   Gemini CLI binary (default 'gemini')

  Agent guards
    C9AI_MAX_ITER                hard cap on iterations (25)
    C9AI_MAX_WALL_SEC            wall-clock cap in seconds (600)
    C9AI_STALL_REPEATS           same-action stop threshold (3)

  Shell tool
    C9AI_SHELL_TIMEOUT_SEC       per-command timeout (120)
    C9AI_ALLOW_DESTRUCTIVE       1 to skip risky-pattern prompts

  Scope content layer
    C9AI_SCOPE_LIST_MAX_FILES    files in prompt block (100)
    C9AI_SCOPE_LIST_MAX_DEPTH    max walk depth (3)

PRECEDENCE
  Shell exports > nearest .env walking up from cwd > ~/.c9ai/.env

SEE ALSO
  config, switch, scope
`,
};

/** All topic keys in a stable display order, grouped by category. */
export const TOPIC_GROUPS: Array<{ heading: string; topics: string[] }> = [
  {
    heading: 'Commands',
    topics: ['help', 'switch', 'todos', 'resume', 'clear', 'config', 'tools', 'analytics'],
  },
  {
    heading: 'Input shapes',
    topics: ['agent', 'research', 'shell', 'sigil', 'chat'],
  },
  {
    heading: 'Concepts',
    topics: ['scope', 'profile', 'env'],
  },
];

export function listTopics(commandNames: string[]): string {
  const lines: string[] = [];
  lines.push('Available help topics. Use `help <topic>` to read.');
  lines.push('');
  for (const group of TOPIC_GROUPS) {
    lines.push(group.heading);
    const known = group.topics.filter(
      t => TOPIC_HELP[t] !== undefined || commandNames.includes(t)
    );
    for (const t of known) {
      lines.push(`  ${t}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}
