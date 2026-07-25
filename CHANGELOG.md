# Changelog

All notable changes to c9ai v4 are listed here.
Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [4.0.3] - 2026-07-25

### Fixed
- **Command router and onboarding no longer swallow natural language** - plain-English prompts that merely start with a command-like word are routed to the model instead of being misparsed as commands.

### Removed
- **Legacy `autonomous.ts` loop** - the pre-tool-wiring agent loop (no tool execution, DONE-sentinel re-prompting) is deleted; `agent/loop.ts` has been the real agent since 4.0.0 and nothing imported the old file.

### Housekeeping
- The from-scratch akshara transformer trainer/sampler (`scripts/pampa_train_transformer.py`, `scripts/pampa_generate_transformer.py`) is now tracked in the repo.
- Local-only strategy docs, `site/`, `bin/`, and `GEMINI.md` are gitignored so they can't reach the public repo or the npm package.

## [4.0.2] - 2026-07-01

### Added
- **`help html`** - generates a self-contained, task-grouped HTML cheat-sheet at `~/.c9ai/help.html` and opens it in the default browser (offline, no assets). It leads with the five things people ask first — start a conversation, reach settings, connect to the Lab, check todos, get the coding agent to write a program — then groups the rest by task (providers local/lab/cloud, settings, agent, todos, tools, Foundry). Aliases: `help web`, `help open`. Cross-platform open (Windows/macOS/Linux) with the file path printed as a fallback.

### Changed
- **Decluttered in-TUI `help`** - the default `help` now prints a short, scannable, task-grouped summary instead of the full 90-line reference. `help full` shows the complete command reference; `help <topic>` still opens the man-page-style pages. Reduces the "too many signals" wall on first look.

## [4.0.1] - 2026-06-30

### Added
- **Web Search (`web.search`)** - Zero-configuration, high-performance web search using DuckDuckGo HTML scraping. No API keys required.
- **Web Fetch (`web.fetch`)** - Plain-text web page content scraper with automatic HTML tag cleaning and token-safe character capping.
- **Maya NewsFeed RAG (`maya.news`)** - Curated news retrieval client pointing to the public Knobly Cream Landing Page Concierge RAG API.

## [4.0.0] - 2026-06-30

First stable v4 release. Drops the `alpha` prerelease line and publishes to the `latest` npm tag — `npm install c9ai` now installs v4 instead of the legacy 2.2.5. Note: `4.0.0-alpha.4` and `-alpha.5` were prepared but never published to npm (the registry's alpha line stopped at `alpha.3`); all of their changes are included here.

### Added
- **Lab provider** - a self-hosted GPU node exposed as an OpenAI-compatible endpoint and gated by a Matsya API key. `switch lab` / `@lab` / `lab <prompt>` / `switch lab list` all work. It reuses `MATSYA_API_KEY` (no separate credential); `LAB_MODEL` defaults to `auto` (the node serves its loaded model) and `LAB_BASE_URL` repoints at another node. Providers now read as three tiers — local (`ollama`), lab, and cloud (`claude`/`gemini`/`openai`/`gpt`/`kimi`/`deepseek`/`openrouter`). Configurable via `config lab <key|model|base>`.
- **First-run onboarding wizard** - on first launch c9ai walks Matsya → Claude → optional extra providers. Pasted keys never land in prompt history, the session file, or the event log. Completion is recorded as `onboardedAt` in `~/.c9ai/config.json` so it runs once.
- **`skill` command** - author Bru skills for the Matsya marketplace: `skill new <id>` scaffolds a manifest, `skill validate <id|path>` runs a manifest + capability + static safety scan (pass / needs-review / fail), `skill list` shows local skills. Publish lands once the Matsya bru-store endpoint exists.
- **`tunnels` command** - preview-share tunnel worker (`status` / `start` / `stop` / `once`) that drives `frpc` to expose a local port over the Matsya tunnel. frp is not bundled (Defender flags it as a PUA); install it or set `C9AI_FRPC_PATH`.
- **Matsya queue worker (on-demand)** - the queue runner is ported and wired into the TUI. It is trigger-based (`matsya check`/`list`), not background polling. Confirm-tier commands in an unattended run now **page** the matsyaai.com mobile UI for allow/deny instead of auto-denying; fail-closed (no key / no listener / timeout → deny).

### Changed
- README documents the lab provider, the local/lab/cloud tiers, and the new onboarding/`skill`/`tunnels` surfaces; the status table reflects the ported Matsya queue worker.

## [4.0.0-alpha.4] - 2026-06-07

### Added
- **Keyless local OpenAI-compatible servers** - when `OPENAI_BASE_URL` (or `KIMI_BASE_URL`, `DEEPSEEK_BASE_URL`, `OPENROUTER_BASE_URL`) points at a local server such as LM Studio, llama.cpp server, or vLLM, the matching `*_API_KEY` is now optional. Previously the provider refused to start without a key even though local servers don't need one.
- **Install + Quickstart in README** - first-run path for npm users: install via `npm install -g c9ai@alpha`, connect a local model (Ollama or any OpenAI-compatible server) with no API key, or configure a hosted provider.

### Fixed
- The missing-`ANTHROPIC_API_KEY` error no longer references a developer-machine path; it now points to `.env` / `~/.c9ai/.env` and suggests `switch ollama` for keyless local use.
- The banner version is read from `package.json` at runtime instead of a hardcoded constant that had drifted (showed alpha.2 while alpha.3 was installed).
- **`models package` works on macOS/Linux** - the default venv Python path was hardcoded to the Windows layout (`.venv\Scripts\python.exe`); it now resolves `.venv/bin/python` on non-Windows platforms.
- **`C9AI_LLAMA_CPP` env knob** - `models package` and `models doctor` previously only looked for the llama.cpp converter at `./external/llama.cpp` relative to the directory c9ai was launched from; the checkout (or converter script) location is now overridable via env.
- README no longer claims the `tiny-dickinson` sample runs end-to-end out of the box; the sample ships the project shape without corpus text (you add public-domain poems first).

## [4.0.0-alpha.3] - 2026-05-14

### Added
- **Claude configuration support** - added `config claude <api-key>`, `config claude model <model>`, and `config claude base <url>` to the `config` command for easy credential management.
- **Persistent Agent Mode** - added an `agentMode` toggle (type `agent` without arguments) that automatically promotes standard chat prompts to autonomous agent goals, with a status indicator in the TUI footer.
- **History-aware agents** - the autonomous agent loop now inherits prior chat history context, enabling a seamless "chat first, then delegate" workflow.
- **Agent start confirmation** - added a mandatory safety confirmation prompt before beginning an autonomous loop when `agentMode` is active to prevent accidental tool execution.

## [4.0.0-alpha.2] - 2026-05-03

### Added
- **Small Language Foundry (`models ...`)** - model project commands for bundled samples, project init/list/inspect/status/doctor, corpus import, pair generation/audit, Ollama Modelfile builds, eval runs, interactive review, compare, export, and switching to a model project.
- **LoRA training and packaging recipe** - `models train` scaffolds a PEFT/TRL fine-tune recipe from generated pairs with train/validation split, metadata, configurable LoRA hyperparameters, and persisted metrics; `models package` converts trained adapters to GGUF and creates/promotes Ollama tags with package metadata, hashes, versioned tags, and optional smoke test.
- **OpenAI-compatible providers** - `openai`, `gpt`, `kimi`, `deepseek`, and `openrouter` provider support, including config helpers and model listing.
- **Bundled sample model project** - `samples/models/tiny-dickinson` ships as the starter Small Language Foundry project.

### Changed
- README and help pages now document the Small Language Foundry workflow and current-directory scope behavior.

## [4.0.0-alpha.1] — 2026-04-26

### Added
- **Autoresearch (`research <topic-or-file>`)** — bounded autoresearch iteration, ported from v3 Electron's `src/brain/autoresearch.js`. Reads a markdown program file or synthesizes one from a topic, runs the autonomous agent with the iteration prompt, writes a memo to `outputs/autoresearch-<slug>-<runId>.md`, and appends a record to `~/.c9ai/brain/autoresearch/runs.jsonl`. Verdict parser: keep / discard / needs-review / crash.
- **Scope-content awareness** in the agent system prompt. When `~/.c9ai/scope.json` lists roots, every `agent` and `research` run now includes a `## What's in your scoped folders` block listing each file with size + first markdown heading or first non-blank line. Capped via `C9AI_SCOPE_LIST_MAX_FILES` (default 100) and `C9AI_SCOPE_LIST_MAX_DEPTH` (default 3); skips `node_modules`, `.git`, `dist`, etc. Drop a new note into scope → next agent run sees it without `@fs.glob`.
- **Man-page-style help** — `help topics` lists every detailed page, `help <topic>` shows the man-page-style entry. 16 topics covering 8 commands (help, switch, todos, resume, clear, config, tools, analytics), 5 input shapes (agent, research, shell, sigil, chat), and 3 concepts (scope, profile, env). Each page follows NAME / SYNOPSIS / DESCRIPTION / EXAMPLES / SEE ALSO convention. Lives in `src/help-pages.ts`.
- Friendly Ollama 404 handling — when the configured model isn't installed locally, the chat call now hits `/api/tags` and prints either `switch ollama <name>` (single installed) or the full installed list, instead of dying with raw `HTTP 404`.

### Changed
- `agent/prompt.ts` scope block now lists actual files, not just root paths.

### Deferred
- Matsya queue worker (Phase 1: HTTP client + manual queue commands; Phase 2a: polling lifecycle + heartbeat) — preserved on the `matsya-integration` branch. Merges back when Matsya UI surfaces local-targeted items.

## [4.0.0-alpha.0] — 2026-04-25

### Added
- Initial v4 release — clean restoration of c9ai v1's CLI shape in TypeScript with [Ink](https://github.com/vadimdemedes/ink).
- Ink TUI shell with streaming output, prompt history (↑/↓), confirm prompts, abort-on-Escape.
- Built-in commands: `help`, `switch`, `todos`, `config`, `analytics`, `tools`, `resume`, `clear`, `exit`.
- Multi-provider: Claude (Anthropic SDK, streaming + cache), Gemini (CLI subprocess), Ollama (HTTP, streaming, auto-detect installed model).
- Cross-session conversation memory: `~/.c9ai/sessions/*.jsonl` written per session, replayable via `resume [<n> | list]`.
- Personal AI surface: `~/.c9ai/profile.md` (auto-injected as system prompt), `~/.c9ai/scope.json` (folders fs.* may read).
- Tools: `fs.read`, `fs.write`, `fs.list`, `fs.glob`, `fs.grep`, `date.now`, `env.cwd`, `env.platform`, `shell.run` (with destructive-pattern blocklist).
- Sigil dispatch (`@<tool> <args>`), aliases (`~/.c9ai/aliases.json`), user tools (`~/.c9ai/tools-registry.json`).
- Autonomous loop (`agent <goal>`) with guards: `C9AI_MAX_ITER`, `C9AI_MAX_WALL_SEC`, `C9AI_STALL_REPEATS`.
- GitHub Issues backlog via `gh` CLI (`todos list/add`).
- One-shots: `c9ai claude "<prompt>"`, `c9ai gemini "<prompt>"`, `c9ai ollama "<prompt>"`.
