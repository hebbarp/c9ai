# Changelog

All notable changes to c9ai v4 are listed here.
Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/spec/v2.0.0.html).

## [4.0.0-alpha.1] — 2026-04-26

### Added
- **Autoresearch (`research <topic-or-file>`)** — bounded autoresearch iteration, ported from v3 Electron's `src/brain/autoresearch.js`. Reads a markdown program file or synthesizes one from a topic, runs the autonomous agent with the iteration prompt, writes a memo to `outputs/autoresearch-<slug>-<runId>.md`, and appends a record to `~/.c9ai/brain/autoresearch/runs.jsonl`. Verdict parser: keep / discard / needs-review / crash.
- **Scope-content awareness** in the agent system prompt. When `~/.c9ai/scope.json` lists roots, every `agent` and `research` run now includes a `## What's in your scoped folders` block listing each file with size + first markdown heading or first non-blank line. Capped via `C9AI_SCOPE_LIST_MAX_FILES` (default 100) and `C9AI_SCOPE_LIST_MAX_DEPTH` (default 3); skips `node_modules`, `.git`, `dist`, etc. Drop a new note into scope → next agent run sees it without `@fs.glob`.
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
