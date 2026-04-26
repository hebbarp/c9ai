# Personal AI: profile, scope, autoresearch

This is the design behind c9ai's "knows me, knows my work" features. Captured 2026-04-26.

## The three layers of context

A useful local AI assistant has three increasingly broad context layers:

1. **Conversation context** — what was said in this session. Solved by multi-turn chat (existing).
2. **Cross-session memory** — what was said in past sessions. Solved by `~/.c9ai/sessions/` + `resume` (existing).
3. **Identity + corpus context** — who the user is, what they work on, what's in their files. The subject of this doc.

## Profile: the simplest "who am I" answer

A markdown file at `~/.c9ai/profile.md` is the minimum viable identity context. The user writes it themselves; c9ai injects it as a system-role prompt on every chat and agent call.

Why markdown over a structured form:
- Zero schema lock-in — the model reads natural language well
- The user can include anything they want (LinkedIn-style summary, current projects, personal preferences, sounding-board style, "don't be sycophantic", etc.)
- Edits are an editor session, not a CLI flow

LinkedIn integration is intentionally **not** automated. LinkedIn's terms forbid scraping and there's no usable public API. The clean path: export your LinkedIn data (Settings → Get a copy of your data), drop the JSON/CSV into a scoped folder, and let autoresearch index it like any other file.

## Why autoresearch, not RAG, at personal scale

| | RAG | Autoresearch (agent loop + fs.grep / fs.glob) |
|---|---|---|
| Setup | Embedding model (~500 MB–1.5 GB), vector DB, indexing pipeline that must stay fresh | None — uses what's already there |
| Query quality | Brittle to chunk boundaries and query-vs-chunk wording mismatch | Reads actual files; agent's reasoning chain shows you what it looked at |
| Failure mode | Silently bad chunks; no good debug surface | Visible in the agent loop's tool-call stream; user can intervene |
| Scale ceiling | Millions of docs | ~10 K files comfortably; ~100 K with ripgrep |
| Local-model fit | Embeddings need their own model on disk | Reuses whatever LLM is configured |
| Citation | Returns chunks; original line numbers are lossy | Cites the exact file path the agent read |

For a single user's personal corpus — typically 100s to ~10 K documents — autoresearch wins on every axis except theoretical asymptotic speed. The agent organically does: glob → read candidates → grep deeper → answer with the file paths it consulted. That's also a much better debugging surface when an answer goes sideways.

We re-evaluate this if/when someone hits a real scale wall. Until then, no embeddings, no vector DB, no indexing daemon.

## Scope: explicit folder allowlist

Letting an agent loop read arbitrary files on the user's machine is a footgun. The scope file at `~/.c9ai/scope.json` is the explicit consent surface:

```json
{
  "roots": [
    "D:/work",
    "C:/Users/Admin/Documents/projects"
  ]
}
```

Only paths under one of these roots (or under the current working directory) are readable by the `fs.*` tools. Outside the allowlist, tools refuse with a clear error pointing at this file.

The user opts in folders deliberately. We don't auto-scan their home dir.

## On indexing as a separate process / window

We considered an Everything-style background indexer with a separate window for index status. Decision: **don't build it yet**. Reasons:

- ripgrep on a personal corpus is sub-second. The "feels slow" threshold is far away.
- A persistent index introduces real maintenance burden: re-index on file change, stale-index bugs, format migrations across c9ai versions, lock files when two c9ai instances run.
- Cross-platform "spawn a new terminal window" is a portability rabbit hole — `wt` on Windows, `osascript` on macOS, `gnome-terminal` / `xterm` / `alacritty` / `kitty` on Linux. Different argv styles each.
- Multi-window UX splits the user's mental model and complicates cancellation across surfaces.

If indexing ever earns its keep at our actual scale, the better architecture is in-process async via `fork()` for a worker child, with status surfaced as a single line in the existing TUI. One window, one mental model, fully cancellable. No new dependencies.

## What's in scope right now

1. `~/.c9ai/profile.md` — auto-injected system prompt (chat + agent)
2. `~/.c9ai/scope.json` — folder allowlist for `fs.*` tools
3. `fs.glob` and `fs.grep` builtins, with ripgrep used when present
4. Subtle agent system-prompt nudge: prefer searching scoped folders before answering personal questions

Total LOC budget: ~300. No new runtime dependencies.

## What's deferred (until evidence it's needed)

- Embedding-based RAG
- Persistent file index
- LinkedIn / web profile scraping
- Background indexer with separate UI surface
- Cross-folder search ranking (BM25, etc.) — agent ordering is good enough at this scale
