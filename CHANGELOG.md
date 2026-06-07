# Changelog

All notable changes to c9ai v4 are listed here.
Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [4.0.0-alpha.4] - 2026-06-07

### Added
- **Keyless local OpenAI-compatible servers** - when `OPENAI_BASE_URL` (or `KIMI_BASE_URL`, `DEEPSEEK_BASE_URL`, `OPENROUTER_BASE_URL`) points at a local server such as LM Studio, llama.cpp server, or vLLM, the matching `*_API_KEY` is now optional. Previously the provider refused to start without a key even though local servers don't need one.
- **Install + Quickstart in README** - first-run path for npm users: install via `npm install -g c9ai@alpha`, connect a local model (Ollama or any OpenAI-compatible server) with no API key, or configure a hosted provider.

### Fixed
- The missing-`ANTHROPIC_API_KEY` error no longer references a developer-machine path; it now points to `.env` / `~/.c9ai/.env` and suggests `switch ollama` for keyless local use.
- The banner version is read from `package.json` at runtime instead of a hardcoded constant that had drifted (showed alpha.2 while alpha.3 was installed).

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
