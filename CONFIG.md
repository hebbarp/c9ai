# c9ai configuration reference

Every external dependency is overridable. Precedence: **env var > `~/.c9ai/config.json` > built-in default**.

## Environment variables

### Providers

| Var | Default | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for Claude. Set in shell or in a `.env` Claude reads. |
| `CLAUDE_MODEL` | `claude-opus-4-7` | Claude model ID. Override if Anthropic deprecates the default. |
| `OPENAI_API_KEY` | — | Required for `switch openai` / `switch gpt`. |
| `OPENAI_MODEL` | `gpt-4o` | OpenAI model ID. |
| `KIMI_API_KEY` | - | Required for `switch kimi`. |
| `KIMI_MODEL` | `moonshot-v1-128k` | Kimi / Moonshot model ID. |
| `KIMI_BASE_URL` | `https://api.moonshot.cn/v1` | Override for Kimi-compatible endpoints. |
| `DEEPSEEK_API_KEY` | - | Required for `switch deepseek`. |
| `DEEPSEEK_MODEL` | `deepseek-chat` | DeepSeek model ID. |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Override for DeepSeek-compatible endpoints. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override for OpenAI-compatible endpoints. |
| `OPENROUTER_API_KEY` | — | Required for `switch openrouter`. |
| `OPENROUTER_MODEL` | `openai/gpt-4o` | OpenRouter model slug. |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | Override for OpenRouter-compatible endpoints. |
| `SOUL_PROVIDER` | *(auto)* | Optional backing provider for Soul mode. |
| `OLLAMA_URL` | `http://localhost:11434` | Point at a remote Ollama box if needed. |
| `OLLAMA_MODEL` | *(auto-detect)* | If unset, c9ai lists `/api/tags` and uses the only installed model, or asks you to pick. |
| `GEMINI_BIN` | `gemini` | Path to the Gemini CLI. Override if not on `PATH`. |

### Agent loop guards

| Var | Default | Notes |
|---|---|---|
| `C9AI_MAX_ITER` | `25` | Hard cap on tool-call iterations per `agent` run. |
| `C9AI_MAX_WALL_SEC` | `600` | Wall-clock cap in seconds. No upper limit; effectively unbounded above ~9 quadrillion. |
| `C9AI_STALL_REPEATS` | `3` | Identical tool calls in a row before the loop bails. |

### Shell tool

| Var | Default | Notes |
|---|---|---|
| `C9AI_SHELL_TIMEOUT_SEC` | `120` | Per-command timeout. Long-running installs may need `300`+. |
| `C9AI_ALLOW_DESTRUCTIVE` | *(unset)* | Set to `1` to bypass *all* shell safety (hard block + confirm). **Use with care.** |

`@shell.run` uses a two-tier safety model:

**Hard-block (always refused unless `C9AI_ALLOW_DESTRUCTIVE=1`):**
- `format <drive>:`, `dd of=`, `mkfs`
- `> /dev/sd*|hd*|nvme*|disk*` (raw device write)
- `> /etc/...` (system config overwrite)
- Fork-bomb signature `:(){:|:&};:`

**Confirm-tier (interactive prompt: `[y]es once / [s]ession / [n]o`):**
- `rm -rf`, `del /s|/q`, `rmdir /s`, `rd /s`
- `sudo`, `su`
- `curl ... | sh|bash|zsh|fish`, `wget ... | sh|bash`
- `git push --force` / `-f`, `git reset --hard`, `git clean -f`
- `npm publish`, `cargo publish`
- `taskkill /F`, `kill -9`
- `chmod -R`, `chmod 777`, `chown`

Confirm-tier in non-interactive mode (one-shot CLI, no `confirm` callback) fails closed with a clear error.

Session approvals (`s` key) are remembered for the run only — they don't persist across c9ai restarts.

Single-file `rm file.txt` / `del file.txt` and unflagged commands like `ps`, `ls`, `npm install`, `git status` are NOT gated.

#### Wall-clock sizing

| Value | Use case |
|---|---|
| `60` | Quick local-model tasks |
| `600` | Default — sensible for most agent runs |
| `3600` | Long research / multi-file refactors |
| `86400` | Effectively "no time limit" |
| `999999999` | Truly disable; rely on `C9AI_MAX_ITER` + stall detection |

## `~/.c9ai/config.json`

Persisted preferences set via the `switch` command (or by hand).

```json
{
  "defaultModel": "claude" | "gemini" | "ollama" | "soul" | "openai" | "gpt" | "kimi" | "deepseek" | "openrouter",
  "ollamaModel": "<name>",
  "ollamaUrl": "http://...",
  "lastUpdated": "<iso>"
}
```

`switch` commands that write here:

```
switch claude
switch gemini
switch soul
switch openai
switch openai list            — show models from /v1/models
switch kimi
switch kimi list              — show models from /v1/models
switch deepseek
switch deepseek list          — show models from /v1/models
switch openrouter
switch openrouter list        — show models from /v1/models
switch ollama                 — set provider, leave model auto-detect
switch ollama <model>         — also pin a specific model
switch ollama list            — show installed models (read-only)
```

Hosted-provider setup from inside c9ai:

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

Small Language Foundry model projects:

```
models samples
models init tiny-dickinson
models status tiny-dickinson
models doctor tiny-dickinson
models corpus tiny-dickinson add ./corpus
models corpus tiny-dickinson list
models pairs tiny-dickinson audit
models eval tiny-dickinson
models export tiny-dickinson
models list
models inspect tiny-dickinson
models switch tiny-dickinson
```

## Optional user files in `~/.c9ai/`

### `profile.md`

A markdown file describing who you are. Auto-injected as a system prompt for both chat and agent. Re-read on every turn, so editing it mid-session takes effect on the next message.

```markdown
# About me

I'm Prashanth Hebbar — software/product builder, currently working on c9ai (a local-first AI CLI) and Matsya (cloud SaaS). Based in Bangalore.

Style preferences:
- Direct, no preamble. Don't open with "Great question!"
- When you don't know, say so. No hallucinations.
- Sounding-board mode: push back on ideas, don't just validate.
```

LinkedIn integration is intentional left manual: export your data (Settings → Get a copy of your data) and drop the JSON into a scoped folder for autoresearch to pick up.

### `scope.json`

Folder allowlist for `fs.*` tools. Without scope, the agent can only read inside the cwd c9ai was launched from.

```json
{
  "roots": [
    "D:/work",
    "C:/Users/Admin/Documents/projects"
  ]
}
```

Outside these roots (and cwd), tools refuse with an error pointing at this file. This is the explicit consent surface for letting the agent loose on your filesystem.

### `aliases.json`

Map custom sigils to existing tools.

```json
{
  "ls":   { "tool": "fs.list", "positional": "path" },
  "cat":  { "tool": "fs.read", "positional": "path" },
  "grep": { "tool": "shell.run", "positional": "cmd",
            "extra": { "prefix": "grep -rn" } }
}
```

Then `@ls src` runs `fs.list({ path: "src" })`.

### `tools-registry.json`

Add user-defined tools as shell-command templates.

```json
{
  "tools": {
    "shell.run": {
      "command": "{{cmd}}",
      "description": "Run an arbitrary shell command",
      "positional": "cmd"
    },
    "git.status": {
      "command": "git status -sb",
      "description": "Short git status"
    }
  }
}
```

`{{key}}` substitutes from the parsed sigil args.

### `agent-prompt.md`

Override the system prompt for `agent <goal>` runs. Use these placeholders:

- `{{tools}}` — auto-generated list of registered tools
- `{{goal}}` — the user's goal

If the file is absent, c9ai uses the built-in template (see `src/agent/prompt.ts`).

## Common setups

### Solo dev, default everything

Nothing to do. Run `c9ai`, type `switch claude`, set `ANTHROPIC_API_KEY`.

### Local-only with Ollama

```bash
ollama pull llama3.2
# then in c9ai:
switch ollama llama3.2
```

### Mixed: Claude for chat, local Ollama for agent runs

```bash
# in shell:
export ANTHROPIC_API_KEY=sk-ant-...
export OLLAMA_MODEL=qwen2.5-coder
# in c9ai:
switch claude            # default chat goes to Claude
agent <goal>             # uses claude (the default)
# to use Ollama for the agent specifically:
switch ollama qwen2.5-coder
agent <goal>
switch claude            # back to Claude
```

### Long-running research agent

```bash
export C9AI_MAX_ITER=100
export C9AI_MAX_WALL_SEC=7200
export C9AI_STALL_REPEATS=5
c9ai
agent "research X, write findings to report.md"
```

### Remote Ollama on another machine

```bash
export OLLAMA_URL=http://gpu-box.local:11434
export OLLAMA_MODEL=qwen2.5-coder:32b
c9ai
```
