# c9ai v4

Local-first AI CLI built as an Ink-powered TUI in TypeScript.

This is a clean restoration of [c9ai v1](https://www.npmjs.com/package/c9ai/v/1.0.1) (the original
51 KB CLI from 2024 — a thin shell over Claude CLI + Gemini CLI with GitHub Issues as the backlog),
rewritten in TypeScript with [Ink](https://github.com/vadimdemedes/ink) for live streaming output,
and scaffolded for future growth (skills, artifacts, Matsya registry).

v2 (sigils, JIT, BASIC, executive forms) and v3 (Electron desktop app) are archived and serve as a
reference catalog of ideas to port back as **skills** later — not as the next codebase.

## Install

```bash
npm install -g c9ai@alpha
c9ai
```

Requires Node 18+.

## Quickstart

c9ai talks to whichever AI backends you have. Pick at least one:

### Local model — no API key needed

1. Install [Ollama](https://ollama.com) and pull a model:
   ```bash
   ollama pull llama3.2
   ```
2. Start `c9ai` and type:
   ```
   switch ollama
   ```
   With exactly one model installed it's auto-detected. Otherwise `switch ollama list` to see
   what's installed, then `switch ollama <name>`.

Other local OpenAI-compatible servers (LM Studio, llama.cpp server, vLLM) work too — point the
base URL at them and no API key is required:

```bash
OPENAI_BASE_URL=http://localhost:1234/v1   # e.g. LM Studio
```

then `switch openai` inside c9ai.

### Hosted providers

- **Claude** — set `ANTHROPIC_API_KEY` (in your shell, a `.env` file in the directory you run
  c9ai from, or `~/.c9ai/.env`), then `switch claude`. Or inside c9ai: `config claude <api-key>`.
- **OpenAI / Kimi / DeepSeek / OpenRouter** — inside c9ai: `config openai <api-key>` (same for
  `kimi`, `deepseek`, `openrouter`), then `switch <provider>`.
- **Gemini** — install the [Gemini CLI](https://github.com/google-gemini/gemini-cli) so `gemini`
  is on your PATH, then `switch gemini`.
- **Lab** — a self-hosted GPU node exposing an OpenAI-compatible endpoint, gated by a Matsya API
  key (it reuses `MATSYA_API_KEY` — no separate credential). `switch lab`. Override the node with
  `LAB_BASE_URL` and pin a model with `LAB_MODEL` (default `auto`).

The default provider is `claude`; whatever you `switch` to persists in `~/.c9ai/config.json`.
Providers fall into three tiers: **local** (`ollama`), **lab** (a self-hosted GPU node), and
**cloud** (`claude`, `gemini`, `openai`, `gpt`, `kimi`, `deepseek`, `openrouter`).

## Status

Alpha. Phase 0 = restore v1 shape.

| Layer | Status |
|---|---|
| Ink TUI shell | ✅ |
| Built-in commands (help, switch, todos, resume, save, clear, exit, tools, config) | ✅ |
| Cross-session conversation memory (`~/.c9ai/sessions/*.jsonl` + `resume`/`clear`) | ✅ |
| Prompt history (↑/↓ arrows, persisted in `~/.c9ai/history.json`) | ✅ |
| Personal AI: `profile.md`, current-directory scope-aware agent prompt | ✅ |
| Scope-content awareness (`agent @scope` lists current-directory files with snippets) | ✅ |
| Autoresearch (`research <topic-or-file>` → memo in `outputs/` + ledger) | ✅ |
| Claude provider (Anthropic SDK, streaming + cache) | ✅ |
| Gemini provider (CLI subprocess) | ✅ |
| Ollama provider (HTTP, streaming, friendly 404 with installed-models list) | ✅ |
| OpenAI-compatible providers (`openai`, `gpt`, `kimi`, `deepseek`, `openrouter`) | ✅ |
| Lab provider (self-hosted GPU node, OpenAI-compatible, Matsya-key gated) | ✅ |
| First-run onboarding wizard (Matsya → Claude → optional providers) | ✅ |
| `skill` command — author/validate Bru skills for the Matsya marketplace | ✅ |
| `tunnels` command — preview-share tunnel worker (frpc-driven) | ✅ |
| Small Language Foundry model workflow (`models init/list/inspect/status/doctor/corpus/pairs/build/eval/review/compare/export/switch`) | ✅ |
| Small Language Foundry LoRA training recipe (`models train` + GGUF/Ollama packaging path) | ✅ |
| `!shell` runner | ✅ |
| GitHub Issues backlog via `gh` CLI (`todos list/add`) | ✅ |
| Tools: `fs.*`, `date.now`, `env.{cwd,platform}`, `shell.run` (with destructive-pattern blocklist) + `~/.c9ai/tools-registry.json` | ✅ |
| Sigil dispatch (`@<tool>`) | ✅ |
| Aliases (`~/.c9ai/aliases.json`) | ✅ |
| Autonomous loop guards (max-iter, wall-clock, stall) | ✅ |
| Autonomous loop wired to TUI (`agent <goal>`) | ✅ |
| Skills authoring (`skill new/validate/list`) | ✅ |
| Skills publish/install (marketplace round-trip) | deferred (awaits Matsya bru-store endpoint) |
| Artifacts ledger | deferred |
| Matsya queue worker (on-demand runner + paging-confirm) | ✅ |

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
│   ├── openai-compatible.ts (OpenAI / Kimi / DeepSeek / OpenRouter HTTP streaming)
│   └── registry.ts
├── tools/                 ← @sigil-dispatched tools
│   ├── fs.ts              (fs.read/write/list, path-sandboxed to cwd)
│   ├── parse.ts           (sigil arg parser: key=val + positional)
│   ├── registry.ts        (builtins + ~/.c9ai/tools-registry.json)
│   └── types.ts
├── agent/
│   ├── guards.ts          (max-iter, wall-clock, stall detection)
│   ├── prompt.ts          (system-prompt builder + scope-content listing)
│   ├── extract.ts         (parse @tool sigil calls from model output)
│   └── loop.ts            (autonomous chat+tool loop, emits AgentEvent stream)
├── research.ts            ← autoresearch: program → bounded run → memo + ledger
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
OPENAI_API_KEY           OpenAI credential
OPENAI_MODEL             OpenAI model ID (default gpt-4o)
OPENAI_BASE_URL          OpenAI-compatible base URL override
KIMI_API_KEY             Kimi credential
KIMI_MODEL               Kimi model ID (default moonshot-v1-128k)
KIMI_BASE_URL            Kimi-compatible base URL override
DEEPSEEK_API_KEY         DeepSeek credential
DEEPSEEK_MODEL           DeepSeek model ID (default deepseek-chat)
DEEPSEEK_BASE_URL        DeepSeek-compatible base URL override
OPENROUTER_API_KEY       OpenRouter credential
OPENROUTER_MODEL         OpenRouter model ID (default openai/gpt-4o)
OPENROUTER_BASE_URL      OpenRouter-compatible base URL override
OLLAMA_URL               Ollama server (default http://localhost:11434)
OLLAMA_MODEL             Ollama model; if unset, c9ai auto-detects from /api/tags

# When a *_BASE_URL points at a local OpenAI-compatible server (LM Studio,
# llama.cpp, vLLM), the matching *_API_KEY becomes optional.
GEMINI_BIN               Gemini CLI binary (default 'gemini' on PATH)
C9AI_LLAMA_CPP           llama.cpp checkout (or converter script path) for `models package`
                         (default ./external/llama.cpp relative to cwd)
C9AI_MAX_ITER            Agent max iterations (default 25)
C9AI_MAX_WALL_SEC        Agent wall-clock cap in seconds (default 600)
C9AI_STALL_REPEATS       Same-action repeats before agent stops (default 3)
C9AI_SCOPE_LIST_MAX_FILES  Current-directory files listed in system prompt (default 100)
C9AI_SCOPE_LIST_MAX_DEPTH  Max depth when walking current directory (default 3)
```

Inside c9ai, hosted-provider keys can be saved without editing environment files:

```
config openai <api-key>
config kimi <api-key>
config deepseek <api-key>
config openrouter <api-key>
config openai model gpt-4o
config kimi model moonshot-v1-128k
config deepseek model deepseek-chat
config openrouter model openai/gpt-4o
```

### Small Language Foundry

Guide: [`docs/create-your-models.md`](docs/create-your-models.md)

```
models samples
models init tiny-dickinson
models status tiny-dickinson
models doctor tiny-dickinson
models corpus tiny-dickinson add ./my-public-domain-poems
models corpus tiny-dickinson list

# Generate (prompt, completion) training pairs from corpus
models pairs tiny-dickinson generate
models pairs tiny-dickinson audit
models pairs tiny-dickinson list

# Bake system prompt + pairs into a runnable Ollama tag (few-shot)
models build tiny-dickinson --create

# Optional: train a LoRA adapter, then package it for Ollama
models train tiny-dickinson
models package tiny-dickinson
models package tiny-dickinson --versioned --test "Who are you?"
models package tiny-dickinson --promote

models eval tiny-dickinson
models evals-list tiny-dickinson
models review tiny-dickinson
models compare tiny-dickinson
models export tiny-dickinson
models inspect tiny-dickinson
switch tiny-dickinson
```

Model projects live under `~/.c9ai/models/<name>/` with `model.json`, `prompts/`, `corpus/`, `pairs/`, `build/Modelfile`, `train/` (scaffolded recipe), `eval/`, and notes. The first bundled sample is `tiny-dickinson` — it ships the project shape (system prompt, eval questions, corpus guidelines) but no corpus text; add 20–50 public-domain poems per `corpus/README.md`, then `models pairs ... generate` and `models build ... --create` complete the few-shot loop. The `train` recipe (real LoRA fine-tuning) writes the dataset, Python trainer, and requirements; after training, convert the PEFT adapter to GGUF with llama.cpp and register it with Ollama using `ADAPTER`. The full packaging walkthrough is in `docs/create-your-models.md`.

For Ollama specifically: c9ai never assumes a particular model is installed. With no `OLLAMA_MODEL` env or `ollamaModel` in config, it lists `/api/tags` and either uses the only installed model or asks you to pick (`switch ollama list`, then `switch ollama <name>`).

### Autoresearch

```
research <topic-or-file>
```

If the argument is an existing markdown file, it's read as the program (brief / bounds / evaluator). Otherwise a brief is synthesized from the topic string. The agent runs one bounded iteration, writes the memo to `outputs/autoresearch-<slug>-<runId>.md`, and appends a record to `~/.c9ai/brain/autoresearch/runs.jsonl` with verdict (keep / discard / needs-review / crash).

`agent`, `research`, and `fs.*` tools are bounded to the current working directory. Use `!cd <dir>` before a run to change that boundary. Add `@scope` to an agent goal when you want the prompt to list current-directory files with size + first heading, capped via `C9AI_SCOPE_LIST_MAX_*`.

### Extension points (wired now, implemented later)

- **Skills** — load from `~/.c9ai/skills/*/skill.json`, register sigils into the router (will subsume `tools-registry.json`)
- **Artifacts** — every interaction logged in `~/.c9ai/logs/` becomes an artifact entry
- **Registry** — `c9ai skills install <id>` pulls from the Matsya skill registry
- **Matsya queue worker** — on `matsya-integration` branch (HTTP client + manual queue commands + polling lifecycle); merges back when Matsya UI surfaces local-targeted items
