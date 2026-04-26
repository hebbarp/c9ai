# c9ai v4

Local-first AI CLI built as an Ink-powered TUI in TypeScript.

This is a clean restoration of [c9ai v1](https://www.npmjs.com/package/c9ai/v/1.0.1) (the original
51 KB CLI from 2024 — a thin shell over Claude CLI + Gemini CLI with GitHub Issues as the backlog),
rewritten in TypeScript with [Ink](https://github.com/vadimdemedes/ink) for live streaming output,
and scaffolded for future growth (skills, artifacts, Matsya registry).

v2 (sigils, JIT, BASIC, executive forms) and v3 (Electron, builder, IDE) live in `D:\C9AI\c9ai-v3electron\`
(archived, frozen at v3.1.3) and serve as a reference catalog of ideas to port back as **skills**
later — not as the next codebase.

## Status

Alpha. Phase 0 = restore v1 shape.

| Layer | Status |
|---|---|
| Ink TUI shell | ✅ |
| Built-in commands (help, switch, todos, resume, clear, exit, tools, config) | ✅ |
| Cross-session conversation memory (`~/.c9ai/sessions/*.jsonl` + `resume`/`clear`) | ✅ |
| Personal AI: `profile.md`, `scope.json`, `fs.glob`/`fs.grep` (autoresearch) | ✅ |
| Claude provider (Anthropic SDK, streaming + cache) | ✅ |
| Gemini provider (CLI subprocess) | ✅ |
| Ollama provider (HTTP, streaming) | ✅ |
| `!shell` runner | ✅ |
| GitHub Issues backlog via `gh` CLI | ✅ |
| Tools: `fs.*`, `date.now`, `env.{cwd,platform}`, `shell.run` (with destructive-pattern blocklist) + `~/.c9ai/tools-registry.json` | ✅ |
| Sigil dispatch (`@<tool>`) | ✅ |
| Aliases (`~/.c9ai/aliases.json`) | ✅ |
| Autonomous loop guards (max-iter, wall-clock, stall) | ✅ |
| Autonomous loop wired to TUI (`agent <goal>`) | ✅ |
| Skills system (manifests, install/share) | deferred |
| Artifacts ledger | deferred |
| Matsya registry | deferred |

## Develop

```bash
npm install
npm run dev          # tsx src/index.tsx
npm run typecheck
npm run build && npm start
```

## Architecture

```
src/
├── index.tsx              ← entry: parses argv, picks interactive vs one-shot
├── App.tsx                ← Ink root component
├── core/
│   ├── types.ts           ← shared types
│   ├── config.ts          ← ~/.c9ai/config.json
│   ├── logger.ts          ← ~/.c9ai/logs/
│   └── router.ts          ← input → action classification
├── tui/                   ← Ink components (MessageView, Prompt, printBanner)
├── commands/              ← pluggable command registry
│   ├── registry.ts        (help · switch · todos · config · analytics · tools)
│   └── *.ts
├── providers/             ← LLM backends
│   ├── claude.ts          (Anthropic SDK, streaming, prompt caching)
│   ├── gemini.ts          (CLI subprocess)
│   ├── ollama.ts          (HTTP streaming, configurable model + URL)
│   └── registry.ts
├── tools/                 ← @sigil-dispatched tools
│   ├── fs.ts              (fs.read/write/list, path-sandboxed to cwd)
│   ├── parse.ts           (sigil arg parser: key=val + positional)
│   ├── registry.ts        (builtins + ~/.c9ai/tools-registry.json)
│   └── types.ts
├── agent/
│   ├── guards.ts          (max-iter, wall-clock, stall detection)
│   ├── prompt.ts          (system-prompt builder; ~/.c9ai/agent-prompt.md override)
│   ├── extract.ts         (parse @tool sigil calls from model output)
│   └── loop.ts            (autonomous chat+tool loop, emits AgentEvent stream)
├── aliases.ts             ← ~/.c9ai/aliases.json → tool dispatch
├── shell.ts               ← ! handler, cd
└── autonomous.ts          ← agent loop scaffold (uses guards)
```

### User config (`~/.c9ai/`)

```
config.json            { defaultModel, ollamaModel?, ollamaUrl? }
aliases.json           { "<sigil>": { "tool": "<name>", "positional": "<key>", "extra": {...} } }
tools-registry.json    { "tools": { "<name>": { "command": "<shell>", "positional": "<key>" } } }
agent-prompt.md        custom system prompt for `agent` (use {{tools}} and {{goal}})
logs/                  one JSONL file per session
```

### Env knobs (every external dep is overridable)

```
ANTHROPIC_API_KEY        Claude credential
CLAUDE_MODEL             Claude model ID (default claude-opus-4-7)
OLLAMA_URL               Ollama server (default http://localhost:11434)
OLLAMA_MODEL             Ollama model; if unset, c9ai auto-detects from /api/tags
GEMINI_BIN               Gemini CLI binary (default 'gemini' on PATH)
C9AI_MAX_ITER            Agent max iterations (default 25)
C9AI_MAX_WALL_SEC        Agent wall-clock cap in seconds (default 600)
C9AI_STALL_REPEATS       Same-action repeats before agent stops (default 3)
```

For Ollama specifically: c9ai never assumes a particular model is installed. With no `OLLAMA_MODEL` env or `ollamaModel` in config, it lists `/api/tags` and either uses the only installed model or asks you to pick (`switch ollama list`, then `switch ollama <name>`).

### Extension points (wired now, implemented later)

- **Skills** — load from `~/.c9ai/skills/*/skill.json`, register sigils into the router (will subsume `tools-registry.json`)
- **Artifacts** — every interaction logged in `~/.c9ai/logs/` becomes an artifact entry
- **Registry** — `c9ai skills install <id>` pulls from the Matsya skill registry
- **Autonomous loop** — `Guards` already in `src/agent/guards.ts`; needs joint chat+tool execution to actually iterate
