import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Static, Text, useApp, useInput, useStdout } from 'ink';
import { MessageView } from './tui/MessageView.js';
import { Prompt } from './tui/Prompt.js';
import type { AppConfig, ChatMessage, Message } from './core/types.js';
import type { Tool, ConfirmRequest, ConfirmResponse } from './tools/types.js';
import type { AliasMap } from './aliases.js';
import { saveConfig as persistConfig } from './core/config.js';
import { logEvent } from './core/logger.js';
import { routeInput } from './core/router.js';
import { buildCommandRegistry } from './commands/registry.js';
import { getProvider } from './providers/registry.js';
import { runShell } from './shell.js';
import { parseSigilArgs } from './tools/parse.js';
import { buildToolRegistry } from './tools/registry.js';
import { loadAliases } from './aliases.js';
import { configureOllama } from './providers/ollama.js';
import { runAgent } from './agent/loop.js';
import { loadHistory, saveHistory, pushHistory } from './history.js';
import {
  appendTurn,
  appendTurns,
  createSession,
  pruneSessions,
  type SessionTurn,
} from './sessions.js';
import { loadProfile, formatProfileForSystem } from './profile.js';
import { loadScope, type Scope } from './scope.js';

let lineSeq = 0;
function nextId(): string {
  lineSeq += 1;
  return `${Date.now()}-${lineSeq}`;
}

export interface AppProps {
  initialConfig: AppConfig;
}

export function App({ initialConfig }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [cols, setCols] = useState(stdout?.columns ?? 80);
  useEffect(() => {
    if (!stdout) return;
    const handler = () => setCols(stdout.columns ?? 80);
    stdout.on('resize', handler);
    return () => {
      stdout.off('resize', handler);
    };
  }, [stdout]);
  const rule = useMemo(() => '─'.repeat(Math.max(0, cols)), [cols]);
  const [config, setConfig] = useState<AppConfig>(initialConfig);
  const [history, setHistory] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState<Message | null>(null);
  const streamingRef = useRef<Message | null>(null);
  const pendingChunkRef = useRef<string>('');
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Full accumulated text of the streaming turn, even though it gets split
  // into many history entries during render. Used to persist ONE session
  // turn at endStream rather than N partial-line turns.
  const currentTurnTextRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  // Session allowlist: pattern names the user has approved for this run.
  // Cleared on app exit; persistent allowlist is a future feature.
  const sessionAllowedRef = useRef<Set<string>>(new Set());
  const [confirmReq, setConfirmReq] = useState<{
    req: ConfirmRequest;
    resolve: (r: ConfirmResponse) => void;
  } | null>(null);
  // Prompt history (up/down arrows). Refs because navigation reads but
  // doesn't drive renders directly — the displayed text lives in promptValue.
  const [promptValue, setPromptValue] = useState('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1); // -1 = editing the live draft
  const draftRef = useRef<string>(''); // saved when first stepping into history
  // Active on-disk session file. New file created on App mount; rotated by
  // `replaceHistory` (called from `resume` / `clear`).
  const sessionIdRef = useRef<string | null>(null);
  const profileRef = useRef<string | null>(null);
  const scopeRef = useRef<Scope>({ roots: [] });

  useEffect(() => {
    let cancelled = false;
    loadHistory().then(h => {
      if (!cancelled) historyRef.current = h;
    });
    // Boot a fresh session file. Prune oldest in the background so the
    // ~/.c9ai/sessions/ directory doesn't grow forever.
    createSession().then(id => {
      if (!cancelled) sessionIdRef.current = id;
    });
    void pruneSessions();
    // Profile + scope load fire-and-forget; chat path re-reads profile each
    // turn so a mid-session edit takes effect on the next message.
    loadProfile().then(p => {
      if (!cancelled) profileRef.current = p;
    });
    loadScope().then(s => {
      if (!cancelled) scopeRef.current = s;
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const commands = useMemo(() => buildCommandRegistry(), []);
  const [tools, setTools] = useState<Map<string, Tool>>(new Map());
  const [aliases, setAliases] = useState<AliasMap>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, a] = await Promise.all([buildToolRegistry(), loadAliases()]);
      if (!cancelled) {
        setTools(t);
        setAliases(a);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestConfirm = useCallback(
    (req: ConfirmRequest): Promise<ConfirmResponse> => {
      if (sessionAllowedRef.current.has(req.reason)) {
        return Promise.resolve('allow' as ConfirmResponse);
      }
      return new Promise<ConfirmResponse>(resolve => {
        setConfirmReq({ req, resolve });
      });
    },
    []
  );

  const replaceHistory = useCallback(async (messages: Message[]): Promise<void> => {
    const newId = await createSession();
    const turns: SessionTurn[] = messages
      .filter((m): m is Message & { kind: 'user' | 'provider' } => m.kind === 'user' || m.kind === 'provider')
      .map(m => ({ kind: m.kind, text: m.text, ts: m.ts }));
    await appendTurns(newId, turns);
    sessionIdRef.current = newId;
    setHistory(messages);
  }, []);

  const handlePromptChange = useCallback((v: string) => {
    // Any keystroke breaks history navigation — your edit becomes the
    // live draft and up/down resume from -1 (no auto-jump back).
    if (historyIndexRef.current !== -1) {
      historyIndexRef.current = -1;
    }
    draftRef.current = v;
    setPromptValue(v);
  }, []);

  const navigateHistory = useCallback(
    (dir: 'up' | 'down') => {
      const hist = historyRef.current;
      if (hist.length === 0) return;
      let idx = historyIndexRef.current;
      if (dir === 'up') {
        if (idx === -1) draftRef.current = promptValue;
        idx = Math.min(idx + 1, hist.length - 1);
      } else {
        idx = Math.max(idx - 1, -1);
      }
      historyIndexRef.current = idx;
      setPromptValue(idx === -1 ? draftRef.current : hist[hist.length - 1 - idx]!);
    },
    [promptValue]
  );

  // Esc cancels the current run while busy. Ctrl+C still falls through to
  // Ink's default exit handler and quits the whole app. While a confirm
  // prompt is showing, y/s/n drive that and Esc denies.
  useInput((input, key) => {
    if (confirmReq) {
      const ch = (input || '').toLowerCase();
      if (ch === 'y') {
        confirmReq.resolve('allow');
        setConfirmReq(null);
      } else if (ch === 's') {
        sessionAllowedRef.current.add(confirmReq.req.reason);
        confirmReq.resolve('allow-session');
        setConfirmReq(null);
      } else if (ch === 'n' || key.escape) {
        confirmReq.resolve('deny');
        setConfirmReq(null);
      }
      return;
    }
    if (busy && key.escape && abortControllerRef.current) {
      abortControllerRef.current.abort();
      return;
    }
    if (!busy && !confirmReq) {
      if (key.upArrow) {
        navigateHistory('up');
      } else if (key.downArrow) {
        navigateHistory('down');
      }
    }
  });

  const persistTurn = useCallback((kind: Message['kind'], text: string, ts: number) => {
    if (kind !== 'user' && kind !== 'provider') return;
    if (!text) return;
    const id = sessionIdRef.current;
    if (!id) return;
    void appendTurn(id, { kind, text, ts });
  }, []);

  const pushMessage = useCallback(
    (msg: Omit<Message, 'id' | 'ts'>) => {
      const ts = Date.now();
      setHistory(prev => [...prev, { ...msg, id: nextId(), ts }]);
      persistTurn(msg.kind, msg.text, ts);
    },
    [persistTurn]
  );

  // Stream chunks coalesce into ~30fps batches to keep React renders sane.
  // Per-token setState was causing visible flicker on Windows Terminal as the
  // bottom UI block (rule + busy + prompt + footer) repainted on every chunk.
  const FLUSH_MS = 33;

  // On each flush we promote completed lines (everything up to the last
  // newline) into history. <Static> never re-renders past entries, so the
  // live re-paint stays bounded to the partial tail line — no matter how
  // long the response grows. Without this, a 500-line agent response means
  // every flush repaints all 500 lines and the whole bottom UI flickers.
  const flushPending = useCallback(() => {
    flushTimerRef.current = null;
    const chunk = pendingChunkRef.current;
    pendingChunkRef.current = '';
    if (!chunk || !streamingRef.current) return;

    currentTurnTextRef.current += chunk;
    const combined = streamingRef.current.text + chunk;
    const lastNl = combined.lastIndexOf('\n');

    if (lastNl === -1) {
      const next: Message = { ...streamingRef.current, text: combined };
      streamingRef.current = next;
      setStreaming(next);
      return;
    }

    const completedText = combined.slice(0, lastNl);
    const tailText = combined.slice(lastNl + 1);

    const completedMsg: Message = {
      id: streamingRef.current.id,
      kind: streamingRef.current.kind,
      text: completedText,
      ts: streamingRef.current.ts,
    };
    const tailMsg: Message = {
      id: nextId(),
      kind: streamingRef.current.kind,
      text: tailText,
      ts: Date.now(),
    };

    setHistory(prev => [...prev, completedMsg]);
    streamingRef.current = tailMsg;
    setStreaming(tailMsg);
  }, []);

  const beginStream = useCallback((kind: Message['kind']) => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    pendingChunkRef.current = '';
    currentTurnTextRef.current = '';
    const msg: Message = { id: nextId(), kind, text: '', ts: Date.now() };
    streamingRef.current = msg;
    setStreaming(msg);
  }, []);

  const appendStream = useCallback(
    (chunk: string) => {
      if (!streamingRef.current) return;
      pendingChunkRef.current += chunk;
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(flushPending, FLUSH_MS);
    },
    [flushPending]
  );

  const endStream = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    // Drain any tail chunks into the final message before promoting to history.
    const tail = pendingChunkRef.current;
    pendingChunkRef.current = '';
    let final = streamingRef.current;
    if (final && tail) {
      final = { ...final, text: final.text + tail };
    }
    streamingRef.current = null;
    if (final) {
      const finalized = final;
      setHistory(prev => [...prev, finalized]);
      // Streaming history-promotion is also a turn boundary for the session
      // file: persist the FULL turn here (currentTurnTextRef accumulated all
      // chunks across split-promotion). Per-line history entries don't get
      // their own session turns.
      persistTurn(finalized.kind, currentTurnTextRef.current, finalized.ts);
    }
    currentTurnTextRef.current = '';
    setStreaming(null);
  }, [persistTurn]);

  const saveConfig = useCallback(
    async (next: Partial<AppConfig>) => {
      const merged: AppConfig = { ...config, ...next, lastUpdated: new Date().toISOString() };
      setConfig(merged);
      await persistConfig(merged);
    },
    [config]
  );

  const handleSubmit = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      // Reset prompt + history navigation, then persist the new entry.
      setPromptValue('');
      historyIndexRef.current = -1;
      draftRef.current = '';
      const nextHistory = pushHistory(historyRef.current, trimmed);
      historyRef.current = nextHistory;
      void saveHistory(nextHistory);

      pushMessage({ kind: 'user', text: trimmed });
      logEvent('input', { raw: trimmed });

      const action = routeInput(trimmed, {
        defaultProvider: config.defaultModel,
        commands,
      });

      switch (action.kind) {
        case 'empty':
          return;
        case 'exit':
          pushMessage({ kind: 'system', text: 'bye.' });
          setTimeout(() => exit(), 50);
          return;
        case 'shell': {
          setBusy(true);
          setBusyLabel(`shell: ${action.command}`);
          beginStream('shell');
          await runShell(action.command, chunk => appendStream(chunk));
          endStream();
          setBusy(false);
          return;
        }
        case 'sigil': {
          // Resolve alias → tool, falling back to direct tool lookup.
          const alias = aliases.get(action.sigil);
          const toolName = alias?.tool ?? action.sigil;
          const tool = tools.get(toolName);
          if (!tool) {
            pushMessage({
              kind: 'error',
              text: `unknown sigil: @${action.sigil} (no tool or alias). type 'tools' to list.`,
            });
            return;
          }
          const positional = alias?.positional ?? tool.positional;
          const parsed = parseSigilArgs(action.args, {
            positional,
            args: tool.args,
          });
          const args: Record<string, unknown> = { ...(alias?.extra ?? {}), ...parsed };

          setBusy(true);
          setBusyLabel(`tool: ${tool.name} (Esc to cancel)`);
          beginStream('tool');
          const ctrl = new AbortController();
          abortControllerRef.current = ctrl;
          try {
            const result = await tool.run(args, {
              cwd: process.cwd(),
              signal: ctrl.signal,
              confirm: requestConfirm,
              scope: scopeRef.current,
              emit: chunk => appendStream(chunk),
            });
            endStream();
            if (!result.ok && result.error) {
              pushMessage({ kind: 'error', text: `${tool.name}: ${result.error}` });
            }
          } finally {
            abortControllerRef.current = null;
            setBusy(false);
          }
          return;
        }
        case 'command': {
          const cmd = commands.get(action.name);
          if (!cmd) {
            pushMessage({ kind: 'error', text: `command not found: ${action.name}` });
            return;
          }
          setBusy(true);
          setBusyLabel(action.name);
          try {
            await cmd.run(action.args, {
              config,
              saveConfig,
              emit: pushMessage,
              replaceHistory,
            });
          } catch (err) {
            pushMessage({
              kind: 'error',
              text: `${action.name} failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
          setBusy(false);
          return;
        }
        case 'agent': {
          if (!action.goal) {
            pushMessage({
              kind: 'system',
              text: 'usage: agent <goal>  — runs autonomous loop with tools',
            });
            return;
          }
          const provider = getProvider(config.defaultModel);
          const ok = await provider.available();
          if (!ok) {
            pushMessage({
              kind: 'error',
              text: `${provider.name} not available (${provider.bin})`,
            });
            return;
          }
          if (tools.size === 0) {
            pushMessage({
              kind: 'error',
              text: 'no tools registered — agent has nothing to call',
            });
            return;
          }
          setBusy(true);
          setBusyLabel(`agent: ${provider.name} (Esc to cancel)`);
          // Refresh profile and scope so agent sees edits since launch.
          profileRef.current = await loadProfile();
          scopeRef.current = await loadScope();
          let inThought = false;
          let inToolOutput = false;
          const ctrl = new AbortController();
          abortControllerRef.current = ctrl;
          await runAgent(provider, action.goal, tools, evt => {
            switch (evt.type) {
              case 'start':
                pushMessage({
                  kind: 'system',
                  text: `agent start (${evt.provider}) — goal: ${evt.goal}`,
                });
                break;
              case 'thought':
                if (!inThought) {
                  if (inToolOutput) endStream();
                  beginStream('provider');
                  inThought = true;
                  inToolOutput = false;
                }
                appendStream(evt.chunk);
                break;
              case 'turn-end':
                if (inThought) {
                  endStream();
                  inThought = false;
                }
                break;
              case 'tool-call':
                pushMessage({
                  kind: 'tool',
                  text: `${evt.name} ${JSON.stringify(evt.args)}`,
                });
                break;
              case 'tool-output':
                if (!inToolOutput) {
                  beginStream('tool');
                  inToolOutput = true;
                }
                appendStream(evt.chunk);
                break;
              case 'tool-result':
                if (inToolOutput) {
                  endStream();
                  inToolOutput = false;
                }
                if (!evt.ok && evt.error) {
                  pushMessage({ kind: 'error', text: `tool: ${evt.error}` });
                }
                break;
              case 'finish':
                pushMessage({
                  kind: 'system',
                  text: `agent finish: ${evt.reason} (iter=${evt.iterations}, ${Math.round(
                    evt.elapsedMs / 1000
                  )}s)`,
                });
                break;
            }
          }, {
            cwd: process.cwd(),
            signal: ctrl.signal,
            confirm: requestConfirm,
            scope: scopeRef.current,
            profile: profileRef.current,
          });
          abortControllerRef.current = null;
          setBusy(false);
          return;
        }
        case 'chat': {
          if (!action.prompt) {
            pushMessage({
              kind: 'system',
              text: `(empty prompt — type ${action.provider} <something>)`,
            });
            return;
          }
          const provider = getProvider(action.provider);
          const ok = await provider.available();
          if (!ok) {
            pushMessage({
              kind: 'error',
              text: `${provider.name} not available (${provider.bin})`,
            });
            return;
          }
          // Re-read profile each turn so edits take effect immediately.
          const profile = await loadProfile();
          profileRef.current = profile;

          // Build the conversation: optional system prompt (profile), then
          // prior user/provider turns from history merged across split-line
          // entries (streaming line-promotion creates multiple consecutive
          // `provider` entries — providers reject consecutive same-role).
          const conversation: ChatMessage[] = [];
          if (profile) {
            conversation.push({ role: 'system', content: formatProfileForSystem(profile) });
          }
          for (const m of history) {
            if (m.kind !== 'user' && m.kind !== 'provider') continue;
            const role: 'user' | 'assistant' = m.kind === 'user' ? 'user' : 'assistant';
            const last = conversation[conversation.length - 1];
            if (last && last.role === role) {
              last.content = `${last.content}\n${m.text}`;
            } else {
              conversation.push({ role, content: m.text });
            }
          }
          conversation.push({ role: 'user', content: action.prompt });
          setBusy(true);
          setBusyLabel(`${provider.name} thinking (Esc to cancel)`);
          beginStream('provider');
          logEvent('provider_call', {
            provider: provider.name,
            turns: conversation.length,
          });
          const ctrl = new AbortController();
          abortControllerRef.current = ctrl;
          try {
            const result = await provider.chat(
              conversation,
              chunk => appendStream(chunk),
              ctrl.signal
            );
            endStream();
            if (result.aborted) {
              pushMessage({ kind: 'system', text: '(cancelled)' });
            }
          } finally {
            abortControllerRef.current = null;
            setBusy(false);
          }
          return;
        }
      }
    },
    [
      aliases,
      appendStream,
      beginStream,
      commands,
      config,
      endStream,
      exit,
      history,
      pushMessage,
      saveConfig,
      tools,
    ]
  );

  useEffect(() => {
    logEvent('session_start', { model: config.defaultModel });
    if (config.ollamaModel || config.ollamaUrl) {
      configureOllama({
        ...(config.ollamaModel ? { model: config.ollamaModel } : {}),
        ...(config.ollamaUrl ? { url: config.ollamaUrl } : {}),
      });
    }
    return () => {
      logEvent('session_end', {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Static items={history}>
        {item => <MessageView key={item.id} kind={item.kind} text={item.text} />}
      </Static>

      {streaming && <MessageView kind={streaming.kind} text={streaming.text} />}

      <Box flexDirection="column" marginTop={1}>
        {busy && (
          <Box paddingX={1}>
            <Text color="yellow">… {busyLabel}</Text>
          </Box>
        )}
        {confirmReq && (
          <Box paddingX={1} flexDirection="column">
            <Text color="yellow">⚠ permission needed</Text>
            <Text>
              <Text color="gray">  cmd:     </Text>
              <Text>{confirmReq.req.command}</Text>
            </Text>
            <Text>
              <Text color="gray">  matches: </Text>
              <Text color="yellow">{confirmReq.req.reason}</Text>
            </Text>
            <Text color="gray">  [y]es once · [s]ession · [n]o (Esc)</Text>
          </Box>
        )}
        <Text color="gray" dimColor>{rule}</Text>
        <Box paddingX={1}>
          <Prompt
            disabled={busy}
            value={promptValue}
            onChange={handlePromptChange}
            onSubmit={handleSubmit}
          />
        </Box>
        <Text color="gray" dimColor>{rule}</Text>
        <Box paddingX={1} justifyContent="space-between">
          <Text color="gray" dimColor>
            help · agent · ! shell · @tool · exit
          </Text>
          <Text color="gray" dimColor>
            {config.defaultModel}
          </Text>
        </Box>
      </Box>
    </>
  );
}
