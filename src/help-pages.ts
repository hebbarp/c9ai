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
  switch <claude|gemini|ollama|soul|openai|gpt|kimi|deepseek|openrouter>
  switch ollama <model-name>
  switch ollama list
  switch openai list
  switch kimi list
  switch deepseek list
  switch openrouter list

DESCRIPTION
  With no args, prints current default + ollama settings. With a
  provider name, sets that as the default for free-form chat and
  for 'agent' and 'research' runs. With 'ollama <name>', also pins
  the ollama model in ~/.c9ai/config.json (overrides OLLAMA_MODEL
  from .env going forward).

  'switch ollama list' queries /api/tags and shows what's actually
  installed locally. Hosted presets (openai/gpt/kimi/deepseek/openrouter)
  query /v1/models when the corresponding API key is configured.

  Persistence: choices are saved to ~/.c9ai/config.json. Restart
  the TUI and the same default sticks.

PRECEDENCE
  ollama model resolution: config.ollamaModel > $OLLAMA_MODEL >
  auto-detect (falls back to the only installed model, or asks if
  there are several).

EXAMPLES
  switch claude
  switch soul
  switch chaitanya
  switch openai
  switch openai list
  switch kimi
  switch deepseek
  switch openrouter
  switch openrouter list
  switch ollama gemma:4
  switch ollama list

SEE ALSO
  config, env
`,

  models: `NAME
  models - Small Language Foundry model projects

SYNOPSIS
  models samples
  models init <sample-name>
  models init <name> <ollama-tag>
  models list
  models inspect <name>
  models status <name>
  models doctor <name>
  models corpus <name> add <file-or-folder>
  models corpus <name> list
  models pairs <name> generate [--limit N]
  models pairs <name> audit
  models pairs <name> list
  models pairs <name> show <index>
  models pairs <name> remove <index> [<index>...]
  models build <name> [--examples N] [--base TAG] [--create]
  models train <name> [--epochs N] [--hf <id>] [--run] [--python <bin>]
  models package <name> [--promote] [--versioned] [--test <prompt>] [--no-create] [--python <bin>]
  models eval <name>
  models evals-list <name>
  models review <name> [run-file]
  models compare <name> [run-a] [run-b]
  models export <name> [--outdir DIR] [--include-weights]
  models switch <name>
  switch <name>

DESCRIPTION
  The models command gives small local models a home in c9ai.
  A model project stores metadata, prompts, corpus files, eval files,
  and notes under ~/.c9ai/models/<name>/.

  Bundled samples can be initialized by name:

    models init tiny-dickinson

  Custom projects need an Ollama tag:

    models init dvg c9ai-dvg:latest

  The first name is the friendly c9ai project name. The Ollama tag is
  the local runtime model c9ai will use when switching.

CORPUS
  Corpus import is intentionally conservative. It copies only .md and
  .txt files into the model project's corpus folder.

    models corpus tiny-dickinson add ./poems
    models corpus tiny-dickinson list

PAIRS
  Pair generation turns each corpus file into one (prompt, completion)
  training pair using the current provider. The provider is shown the
  model project's prompts/system.md as voice context, plus the passage,
  and asked to invent the user request that would naturally produce a
  passage like it. The corpus body becomes the completion.

    models pairs tiny-dickinson generate
    models pairs tiny-dickinson generate --limit 5
    models pairs tiny-dickinson list
    models pairs tiny-dickinson show 2
    models pairs tiny-dickinson remove 2 5

  Generated pairs are appended to ~/.c9ai/models/<name>/pairs/pairs.jsonl.
  'generate' skips corpus files that already have a pair, so to redo a
  pair, 'remove' it and run 'generate' again.

  Audit checks duplicate prompts/completions/sources, missing source
  fields, and extreme prompt/completion lengths before training.

    models pairs tiny-dickinson audit

STATUS / DOCTOR
  Status summarizes corpus, pair, build, train, package, eval, and
  hash metadata. Doctor adds local readiness checks for provider auth,
  Python, GPU visibility, llama.cpp, Ollama tags, and pair quality.

    models status tiny-dickinson
    models doctor tiny-dickinson

BUILD
  Build writes an Ollama Modelfile from the model project's system
  prompt plus the first N pairs as few-shot examples (default 4). The
  Modelfile is written to ~/.c9ai/models/<name>/build/Modelfile.

  By default the 'ollama create' command is printed for you to run.
  Pass --create to have build run it directly as a child process and
  stream output.

    models build tiny-dickinson
    models build tiny-dickinson --create
    models build tiny-dickinson --examples 8
    models build tiny-dickinson --base llama3.2:1b

  Note: 'ollama create ...' typed bare in the c9ai prompt would be
  routed to the ollama provider as a chat message. To run it as a
  shell command, prefix with '!' (e.g. '!ollama create ...') or pass
  --create to models build.

  This is not real fine-tuning — it bakes prompt + examples into a
  custom Ollama tag. The base model defaults to model.json's baseModel
  (qwen2.5:1.5b for the bundled sample) and falls back to qwen2.5:1.5b
  if absent. Smaller bases (e.g. qwen2.5:0.5b) tend to ignore style
  guidance from few-shot at this size. For real weight updates, see
  TRAIN.

TRAIN
  Train scaffolds a self-contained Python LoRA fine-tuning recipe in
  ~/.c9ai/models/<name>/train/. It writes:

    dataset.jsonl      full messages-format dataset built from pairs.jsonl
    dataset.train.jsonl / dataset.validation.jsonl
    train.py           transformers + peft + trl SFT script
    metadata.json      run id, pair hash, split counts, hyperparameters
    requirements.txt   Python deps
    README.md          run instructions including GGUF conversion

  Pass --run to also execute 'python train.py' from the train dir
  and stream output (mirrors 'build --create'). The Python venv +
  pip install is still a one-time setup you do in the train dir;
  c9ai does not install Python deps for you.

    models train tiny-dickinson
    models train tiny-dickinson --run
    models train tiny-dickinson --run --python "C:\\path\\to\\venv\\Scripts\\python.exe"
    models train tiny-dickinson --epochs 5
    models train tiny-dickinson --hf Qwen/Qwen2.5-1.5B-Instruct

PACKAGE
  Package converts the trained PEFT adapter under train/out/ to GGUF
  with llama.cpp, writes ~/.c9ai/models/<name>/package/Modelfile and
  metadata.json, then creates a test Ollama tag named
  <project-tag-stem>-lora:latest.

    models package tiny-dickinson
    models package tiny-dickinson --python "C:\\path\\to\\venv\\Scripts\\python.exe"
    models package tiny-dickinson --converter D:\\tools\\llama.cpp\\convert_lora_to_gguf.py
    models package tiny-dickinson --versioned --test "Who are you?"
    models package tiny-dickinson --promote

  Pass --promote after the test tag works. c9ai first copies the
  current project tag to <project-tag-stem>:fewshot, then recreates
  the project tag from the LoRA Modelfile. After that, normal
  'models switch <name>' points at the LoRA-backed tag.

EVAL
  Eval reads numbered questions from eval/questions.md, runs them
  against the current provider/model, and writes a markdown run under
  eval/runs/.

    switch ollama qwen
    models eval tiny-dickinson

  List saved eval runs:

    models evals-list tiny-dickinson

REVIEW
  Review walks through the latest eval run one answer at a time,
  asks for per-question scores/notes, then asks for overall scores.

    models review tiny-dickinson
    models review tiny-dickinson 20260429010051.md
    models review tiny-dickinson 20260429010051

  Use models evals-list <name> to see available run files.

COMPARE
  Compare the latest two reviewed eval runs, or two explicit run files.

    models compare tiny-dickinson
    models compare tiny-dickinson 20260429010051.md 20260429012822.md

EXPORT
  Export copies the reproducibility surface to an export directory:
  model.json, prompts, corpus, pairs, evals, build/train/package
  metadata, manifest.json, and MODEL_CARD.md. Weight files are excluded
  unless --include-weights is explicit.

    models export tiny-dickinson
    models export tiny-dickinson --outdir ./bundle
    models export tiny-dickinson --include-weights

FILES
  ~/.c9ai/models/<name>/model.json
  ~/.c9ai/models/<name>/prompts/system.md
  ~/.c9ai/models/<name>/corpus/
  ~/.c9ai/models/<name>/pairs/pairs.jsonl
  ~/.c9ai/models/<name>/build/Modelfile
  ~/.c9ai/models/<name>/build/metadata.json
  ~/.c9ai/models/<name>/train/dataset.jsonl
  ~/.c9ai/models/<name>/train/metadata.json
  ~/.c9ai/models/<name>/train/metrics.json
  ~/.c9ai/models/<name>/train/train.py
  ~/.c9ai/models/<name>/package/metadata.json
  ~/.c9ai/models/<name>/eval/
  ~/.c9ai/models/<name>/notes.md

GUIDE
  docs/create-your-models.md

SEE ALSO
  switch, config, env
`,

  chaitanya: `NAME
  chaitanya - hidden note on Soul mode

SYNOPSIS
  switch soul
  switch chaitanya
  soul <prompt>
  chaitanya <prompt>
  soul agent <goal>
  chaitanya agent <goal>

DESCRIPTION
  Soul is a c9ai contemplative companion mode. It is not a new model
  backend. It is a careful system-prompt overlay over an available
  backing provider, grounded in Ramana Maharshi's self-inquiry and the
  broader Advaita/Vedanta tradition.

  Chaitanya means consciousness. Here it is a quiet tribute to inquiry:
  not an answer-machine pretending to be a teacher, but a mode that
  encourages looking at the one who asks.

POSTURE
  - patient, plain, and unsentimental
  - returns questions to the questioner when appropriate
  - never invents quotes or citations
  - never claims to be Ramana Maharshi or spiritually authoritative
  - does not proselytize

BACKING PROVIDER
  By default Soul uses the first available provider in this order:
  Claude, Gemini, Ollama, OpenAI, GPT, Kimi, DeepSeek, OpenRouter.
  Set SOUL_PROVIDER to pin one backing provider.

AGENTIC USE
  Plain 'soul <prompt>' is reflective chat. It cannot act on files or
  run shell commands unless c9ai has entered the agent loop. For local
  work, use:

    soul agent make a PDF from notes.md
    chaitanya agent create a summary file for this folder

  If you have already run 'switch soul', normal 'agent <goal>' also
  uses Soul as the agent provider.

SEE ALSO
  switch, env
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
  save, clear
`,

  save: `NAME
  save - export the current visible conversation to markdown

SYNOPSIS
  save
  save <path>

DESCRIPTION
  c9ai auto-saves resumable user/provider turns to
  ~/.c9ai/sessions/*.jsonl. The save command is for a readable export
  of the current visible transcript, including system, shell, tool,
  and error lines that are not part of resumable model context.

  With no path, save writes:

    outputs/c9ai-conversation-<timestamp>.md

  Paths are resolved from the current working directory.

EXAMPLES
  save
  save notes/my-session.md

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
  config - show current configuration and save hosted-provider keys

SYNOPSIS
  config
  config openai <api-key>
  config kimi <api-key>
  config deepseek <api-key>
  config openrouter <api-key>
  config openai model <model>
  config kimi model <model>
  config deepseek model <model>
  config openrouter model <model>
  config openai base <url>
  config kimi base <url>
  config deepseek base <url>
  config openrouter base <url>

DESCRIPTION
  Prints the path to ~/.c9ai/config.json plus the resolved values
  for defaultModel, ollamaModel, ollamaUrl, lastUpdated.

  Also saves OpenAI-compatible API keys and model/base-url settings
  into ~/.c9ai/.env so users do not have to edit environment variables
  by hand. API-key setup commands are redacted from prompt history.

FILES
  ~/.c9ai/config.json
  ~/.c9ai/.env

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
     gemini, ollama, openai, gpt, kimi, deepseek, openrouter.
     Includes availability.

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
  soul agent <goal>

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
  models. Tools are restricted to the current working directory; use
  !cd to move the working root before running a broader task.

  Cancel mid-run with Esc.

  Prefix a provider before 'agent' to force that provider for one run:
  'soul agent <goal>' keeps the Soul posture while using the normal
  c9ai tools.

GUARDS
  C9AI_MAX_ITER         hard cap on iterations (default 25)
  C9AI_MAX_WALL_SEC     hard cap on wall-clock seconds (default 600)
  C9AI_STALL_REPEATS    same-action repeats before stop (default 3)

EXAMPLES
  agent write today's date to today.txt
  soul agent make a PDF-ready markdown brief from notes.md
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
  @fs.grep / @fs.glob across the current working directory), then writes ONE memo
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
  @fs.glob <pattern>             glob match within the current directory
  @fs.grep <pattern> [glob=...]  ripgrep within the current directory
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
  openai <prompt>
  gpt <prompt>
  kimi <prompt>
  deepseek <prompt>
  openrouter <prompt>
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
  openai summarize this in 3 bullets
  kimi summarize this in 3 bullets
  deepseek compare these two options
  openrouter compare two implementation options
  ollama summarize this in 3 bullets
  @gemini same question but local-first

SEE ALSO
  switch, agent
`,

  // ─── Concepts ────────────────────────────────────────────────────────────

  scope: `NAME
  scope — current working directory boundary

SYNOPSIS
  fs.* tools operate inside process.cwd()
  !cd <dir> changes process.cwd() for later tool and agent runs

DESCRIPTION
  fs.* tools refuse to read files outside the current working
  directory. This keeps glob/grep/research bounded to the folder you
  intentionally launched from or changed into.

  @scope is an agent goal sigil that lists files in the current
  working directory only. It does not read ~/.c9ai/scope.json.

CAPS
  C9AI_SCOPE_LIST_MAX_FILES   current-directory files listed in prompt (default 100)
  C9AI_SCOPE_LIST_MAX_DEPTH   max current-directory walk depth (default 3)

  node_modules, .git, dist, build, .venv, .cache, etc. are skipped.

EXAMPLES
  !cd ~/work/project
  agent @scope summarize the markdown files

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
    OPENAI_API_KEY               OpenAI credential
    OPENAI_MODEL                 OpenAI model id (default gpt-4o)
    OPENAI_BASE_URL              Override OpenAI-compatible base URL
    KIMI_API_KEY                 Kimi credential
    KIMI_MODEL                   Kimi model id (default moonshot-v1-128k)
    KIMI_BASE_URL                Override Kimi-compatible base URL
    DEEPSEEK_API_KEY             DeepSeek credential
    DEEPSEEK_MODEL               DeepSeek model id (default deepseek-chat)
    DEEPSEEK_BASE_URL            Override DeepSeek-compatible base URL
    OPENROUTER_API_KEY           OpenRouter credential
    OPENROUTER_MODEL             OpenRouter model id (default openai/gpt-4o)
    OPENROUTER_BASE_URL          Override OpenRouter-compatible base URL
    SOUL_PROVIDER                Optional backing provider for soul mode
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
    topics: ['help', 'switch', 'models', 'todos', 'resume', 'save', 'clear', 'config', 'tools', 'analytics'],
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
