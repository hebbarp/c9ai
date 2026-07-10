import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Static, Text, useApp, useInput, useStdout } from 'ink';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MessageView } from './tui/MessageView.js';
import { Prompt } from './tui/Prompt.js';
import { formatToolCall, createThoughtFilter, type ThoughtFilter } from './tui/format.js';
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
import { runResearch } from './research.js';
import { loadHistory, saveHistory, pushHistory } from './history.js';
import {
  appendTurn,
  appendTurns,
  createSession,
  pruneSessions,
  type SessionTurn,
} from './sessions.js';
import { loadProfile, formatProfileForSystem } from './profile.js';
import { getRunner } from './matsya/poller.js';
import { setUserEnvVar } from './core/envFile.js';
import {
  ONBOARD_KEY_PROVIDERS,
  keyPrompt,
  maskKey,
  morePrompt,
  validateKey,
  type OnboardState,
} from './tui/onboarding.js';
import {
  loadEvalRun,
  writeInteractiveReview,
  type OverallReview,
  type QuestionReview,
  type ReviewQuestion,
} from './models/review.js';

let lineSeq = 0;
function nextId(): string {
  lineSeq += 1;
  return `${Date.now()}-${lineSeq}`;
}

// Picked once when chat starts; gives the busy line a tiny bit of character.
// Kept stable for the whole turn — the elapsed counter does the moving.
const THINKING_VERBS = [
  'thinking',
  'crunching',
  'pondering',
  'brewing',
  'cooking',
  'plotting',
  'mulling',
  'spelunking',
  'untangling',
  'newspapering',
];
function pickVerb(): string {
  return THINKING_VERBS[Math.floor(Math.random() * THINKING_VERBS.length)]!;
}

function redactInputForHistory(input: string): { text: string; redacted: boolean } {
  if (/^matsya\s+setup\s+\S+/i.test(input)) {
    return { text: 'matsya setup <redacted>', redacted: true };
  }
  const providerKey = input.match(/^(config\s+(?:openai|gpt|kimi|deepseek|openrouter)\s+)(?!model\b|base\b|baseurl\b|url\b)(\S+)/i);
  if (providerKey) {
    return { text: `${providerKey[1]}<redacted>`, redacted: true };
  }
  return { text: input, redacted: false };
}

// Gentle reassurance once the wait gets long. Threshold ladders prevent the
// user from wondering whether the spinner is stuck.
function elapsedHint(seconds: number): string {
  if (seconds >= 120) return ' · still going';
  if (seconds >= 45) return ' · still working';
  if (seconds >= 15) return ' · thinking more';
  return '';
}

export interface AppProps {
  initialConfig: AppConfig;
}

type ReviewPhase =
  | 'score'
  | 'notes'
  | 'overall-style'
  | 'overall-faithfulness'
  | 'overall-usefulness'
  | 'overall-quote'
  | 'overall-impersonation'
  | 'overall-notes';

interface ReviewState {
  runPath: string;
  questions: ReviewQuestion[];
  index: number;
  phase: ReviewPhase;
  reviews: QuestionReview[];
  pendingScore?: string;
  overall: Partial<OverallReview>;
}

function isScore(s: string): boolean {
  return /^[1-5]$/.test(s.trim());
}

function isPassFail(s: string): boolean {
  return /^(pass|fail)$/i.test(s.trim());
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
  const messageHistoryRef = useRef<Message[]>([]);
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
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [onboard, setOnboard] = useState<OnboardState | null>(null);
  // Live elapsed-seconds counter while busy. Ticks at 1s; resets on idle.
  const [busyElapsed, setBusyElapsed] = useState(0);
  useEffect(() => {
    if (!busy) {
      setBusyElapsed(0);
      return;
    }
    const start = Date.now();
    setBusyElapsed(0);
    const timer = setInterval(() => {
      setBusyElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [busy]);
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
  const currentDirScope = useMemo(() => ({ roots: [] }), []);

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
    // Profile load is fire-and-forget; chat path re-reads profile each
    // turn so a mid-session edit takes effect on the next message.
    loadProfile().then(p => {
      if (!cancelled) profileRef.current = p;
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

  // Keep the Matsya runner pre-wired with current tools/provider/cwd so
  // `matsya check` (an on-demand command, not a background loop) can fire
  // without re-plumbing args. No background polling — fetch only when asked.
  useEffect(() => {
    if (tools.size === 0) return;
    getRunner().configure({
      provider: config.defaultModel,
      tools,
      cwd: process.cwd(),
    });
  }, [tools, config.defaultModel]);

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
    messageHistoryRef.current = messages;
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
      const next = { ...msg, id: nextId(), ts };
      messageHistoryRef.current = [...messageHistoryRef.current, next];
      setHistory(prev => [...prev, next]);
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

    messageHistoryRef.current = [...messageHistoryRef.current, completedMsg];
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
      messageHistoryRef.current = [...messageHistoryRef.current, finalized];
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

  const exportHistory = useCallback(async (outputPath?: string): Promise<{ path: string; count: number }> => {
    const messages = [...messageHistoryRef.current];
    if (streamingRef.current?.text) {
      messages.push(streamingRef.current);
    }
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const outPath = path.resolve(process.cwd(), outputPath || path.join('outputs', `c9ai-conversation-${stamp}.md`));
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const lines: string[] = [
      '# c9ai Conversation',
      '',
      `Saved: ${new Date().toISOString()}`,
      `Messages: ${messages.length}`,
      '',
    ];
    for (const msg of messages) {
      lines.push(`## ${msg.kind}`);
      lines.push('');
      lines.push(`Time: ${new Date(msg.ts).toISOString()}`);
      lines.push('');
      lines.push(msg.text.trimEnd() || '(empty)');
      lines.push('');
    }
    await fs.writeFile(outPath, lines.join('\n'), 'utf8');
    return { path: outPath, count: messages.length };
  }, []);

  /**
   * Flatten the TUI message history into a clean ChatMessage array for LLM
   * consumption. Merges consecutive same-role turns into a single turn
   * (separated by newlines) since most providers reject same-role runs.
   */
  const buildConversation = useCallback((messages: Message[]): ChatMessage[] => {
    const conversation: ChatMessage[] = [];
    for (const m of messages) {
      if (m.kind !== 'user' && m.kind !== 'provider') continue;
      const role: 'user' | 'assistant' = m.kind === 'user' ? 'user' : 'assistant';
      const last = conversation[conversation.length - 1];
      if (last && last.role === role) {
        last.content = `${last.content}\n${m.text}`;
      } else {
        conversation.push({ role, content: m.text });
      }
    }
    return conversation;
  }, []);

  const showReviewQuestion = useCallback(
    (state: ReviewState) => {
      const q = state.questions[state.index]!;
      pushMessage({
        kind: 'system',
        text:
          `------------------------------\n` +
          `review ${state.index + 1}/${state.questions.length}\n\n` +
          `Prompt:\n${q.prompt}\n\n` +
          `Answer:\n${q.answer}\n\n` +
          `Score 1-5:`,
      });
    },
    [pushMessage]
  );

  const startReview = useCallback(
    async (name: string, runId?: string) => {
      if (!name) {
        pushMessage({ kind: 'error', text: 'usage: models review <name> [run-file]' });
        return;
      }
      try {
        const run = await loadEvalRun(name, runId);
        const estimated = Math.max(3, Math.ceil(run.questions.length * 0.75));
        const state: ReviewState = {
          runPath: run.path,
          questions: run.questions,
          index: 0,
          phase: 'score',
          reviews: [],
          overall: {},
        };
        setReviewState(state);
        pushMessage({
          kind: 'system',
          text:
            `review start: ${run.path}\n` +
            `questions: ${run.questions.length}\n` +
            `estimated time: ${estimated}-${estimated + 5} minutes\n` +
            `enter scores as 1-5; use '-' for empty notes.`,
        });
        showReviewQuestion(state);
      } catch (err) {
        pushMessage({ kind: 'error', text: `models review: ${err instanceof Error ? err.message : String(err)}` });
      }
    },
    [pushMessage, showReviewQuestion]
  );

  const handleReviewInput = useCallback(
    async (input: string) => {
      if (!reviewState) return;
      const value = input.trim();
      if (/^(cancel|quit)$/i.test(value)) {
        pushMessage({ kind: 'system', text: 'review cancelled' });
        setReviewState(null);
        return;
      }
      const noteValue = value === '-' ? '' : value;

      if (reviewState.phase === 'score') {
        if (!isScore(value)) {
          pushMessage({ kind: 'error', text: 'enter a score from 1 to 5' });
          return;
        }
        const next = { ...reviewState, phase: 'notes' as ReviewPhase, pendingScore: value };
        setReviewState(next);
        const q = reviewState.questions[reviewState.index]!;
        pushMessage({ kind: 'system', text: `notes for question ${q.id} (or '-' to skip):` });
        return;
      }

      if (reviewState.phase === 'notes') {
        const q = reviewState.questions[reviewState.index]!;
        const reviews = [
          ...reviewState.reviews,
          { id: q.id, score: reviewState.pendingScore ?? '0', notes: noteValue },
        ];
        if (reviewState.index + 1 < reviewState.questions.length) {
          const next: ReviewState = {
            ...reviewState,
            index: reviewState.index + 1,
            phase: 'score',
            reviews,
            pendingScore: undefined,
          };
          setReviewState(next);
          showReviewQuestion(next);
          return;
        }
        const next: ReviewState = {
          ...reviewState,
          phase: 'overall-style',
          reviews,
          pendingScore: undefined,
        };
        setReviewState(next);
        pushMessage({ kind: 'system', text: '------------------------------\noverall review\n\nstyle score 1-5:' });
        return;
      }

      if (reviewState.phase === 'overall-style') {
        if (!isScore(value)) {
          pushMessage({ kind: 'error', text: 'enter a score from 1 to 5' });
          return;
        }
        setReviewState({ ...reviewState, phase: 'overall-faithfulness', overall: { ...reviewState.overall, style: value } });
        pushMessage({ kind: 'system', text: 'overall faithfulness score 1-5:' });
        return;
      }
      if (reviewState.phase === 'overall-faithfulness') {
        if (!isScore(value)) {
          pushMessage({ kind: 'error', text: 'enter a score from 1 to 5' });
          return;
        }
        setReviewState({ ...reviewState, phase: 'overall-usefulness', overall: { ...reviewState.overall, faithfulness: value } });
        pushMessage({ kind: 'system', text: 'overall usefulness score 1-5:' });
        return;
      }
      if (reviewState.phase === 'overall-usefulness') {
        if (!isScore(value)) {
          pushMessage({ kind: 'error', text: 'enter a score from 1 to 5' });
          return;
        }
        setReviewState({ ...reviewState, phase: 'overall-quote', overall: { ...reviewState.overall, usefulness: value } });
        pushMessage({ kind: 'system', text: 'quote honesty pass/fail:' });
        return;
      }
      if (reviewState.phase === 'overall-quote') {
        if (!isPassFail(value)) {
          pushMessage({ kind: 'error', text: 'enter pass or fail' });
          return;
        }
        setReviewState({ ...reviewState, phase: 'overall-impersonation', overall: { ...reviewState.overall, quoteHonesty: value.toLowerCase() } });
        pushMessage({ kind: 'system', text: 'impersonation pass/fail:' });
        return;
      }
      if (reviewState.phase === 'overall-impersonation') {
        if (!isPassFail(value)) {
          pushMessage({ kind: 'error', text: 'enter pass or fail' });
          return;
        }
        setReviewState({ ...reviewState, phase: 'overall-notes', overall: { ...reviewState.overall, impersonation: value.toLowerCase() } });
        pushMessage({ kind: 'system', text: "overall notes (or '-' to skip):" });
        return;
      }

      const overall: OverallReview = {
        style: reviewState.overall.style ?? '0',
        faithfulness: reviewState.overall.faithfulness ?? '0',
        usefulness: reviewState.overall.usefulness ?? '0',
        quoteHonesty: reviewState.overall.quoteHonesty ?? 'fail',
        impersonation: reviewState.overall.impersonation ?? 'fail',
        notes: noteValue,
      };
      await writeInteractiveReview(reviewState.runPath, reviewState.reviews, overall);
      pushMessage({ kind: 'system', text: `review saved: ${reviewState.runPath}` });
      setReviewState(null);
    },
    [pushMessage, reviewState, showReviewQuestion]
  );

  // First-run setup wizard. Walks Matsya → Claude → optional extra providers,
  // writing keys to ~/.c9ai/.env. Input is intercepted in handleSubmit before
  // it reaches history/routing, so pasted secrets never get persisted.
  const startOnboarding = useCallback(() => {
    setOnboard({ step: 'matsya', configured: [] });
    pushMessage({
      kind: 'system',
      text: [
        '── Welcome to c9ai ──',
        'Quick setup — press Enter to skip any step; type `cancel` to bail out.',
        'Keys are stored in ~/.c9ai/.env. Re-run anytime with `setup`.',
        '',
        keyPrompt('Matsya', 'msk_…', process.env.MATSYA_API_KEY),
      ].join('\n'),
    });
  }, [pushMessage]);

  const finishOnboarding = useCallback(
    async (configured: string[]) => {
      const patch: Partial<AppConfig> = { onboardedAt: new Date().toISOString() };
      // Claude is the default provider but needs a key. If the user skipped it
      // yet set up a hosted alternative, point the default at that instead so
      // the first chat works without a manual `switch`.
      if (!process.env.ANTHROPIC_API_KEY) {
        const fallback = (['openai', 'kimi', 'deepseek', 'openrouter'] as const).find(
          p => process.env[ONBOARD_KEY_PROVIDERS[p]!.envKey]
        );
        if (fallback) patch.defaultModel = fallback;
      }
      await saveConfig(patch);
      setOnboard(null);
      const summary = configured.length
        ? `Configured: ${configured.join(', ')}.`
        : 'No keys set yet — add them later with `config <provider> <key>` or `matsya setup <key>`.';
      pushMessage({
        kind: 'system',
        text: [
          '✓ Setup complete.',
          summary,
          `Default model: ${patch.defaultModel ?? config.defaultModel}.`,
          '',
          'Type `help` to get started, or just start chatting. No API key? `switch ollama` for a local model.',
        ].join('\n'),
      });
    },
    [pushMessage, saveConfig, config.defaultModel]
  );

  const handleOnboardInput = useCallback(
    async (raw: string) => {
      if (!onboard) return;
      const value = raw.trim();
      const isSkip = value === '' || /^skip$/i.test(value);
      if (/^(cancel|quit)$/i.test(value)) {
        await saveConfig({ onboardedAt: new Date().toISOString() });
        setOnboard(null);
        pushMessage({ kind: 'system', text: 'Setup cancelled — run `setup` anytime to resume.' });
        return;
      }

      switch (onboard.step) {
        case 'matsya': {
          const configured = [...onboard.configured];
          if (!isSkip) {
            const check = validateKey('matsya', value);
            if (!check.ok) {
              pushMessage({
                kind: 'error',
                text: `That doesn't look like a Matsya key — ${check.reason}\n\n${keyPrompt('Matsya', 'msk_…', process.env.MATSYA_API_KEY)}`,
              });
              return; // stay on this step; nothing saved
            }
            await setUserEnvVar('MATSYA_API_KEY', value);
            configured.push('Matsya');
            pushMessage({ kind: 'system', text: `✓ Matsya key saved (${maskKey(value)}).` });
          }
          setOnboard({ step: 'claude', configured });
          pushMessage({
            kind: 'system',
            text: keyPrompt('Anthropic (Claude)', 'sk-ant-…', process.env.ANTHROPIC_API_KEY),
          });
          return;
        }
        case 'claude': {
          const configured = [...onboard.configured];
          if (!isSkip) {
            const check = validateKey('claude', value);
            if (!check.ok) {
              pushMessage({
                kind: 'error',
                text: `That doesn't look like a Claude key — ${check.reason}\n\n${keyPrompt('Anthropic (Claude)', 'sk-ant-…', process.env.ANTHROPIC_API_KEY)}`,
              });
              return; // stay on this step; nothing saved
            }
            await setUserEnvVar('ANTHROPIC_API_KEY', value);
            configured.push('Claude');
            pushMessage({ kind: 'system', text: `✓ Claude key saved (${maskKey(value)}).` });
          }
          setOnboard({ step: 'more', configured });
          pushMessage({ kind: 'system', text: morePrompt() });
          return;
        }
        case 'more': {
          if (isSkip || /^(done|finish|no|n)$/i.test(value)) {
            await finishOnboarding(onboard.configured);
            return;
          }
          const name = value.toLowerCase();
          if (name === 'gemini') {
            pushMessage({
              kind: 'system',
              text: 'Gemini uses the Gemini CLI — install it, then `switch gemini`. No key needed.\n\n' + morePrompt(),
            });
            return;
          }
          if (name === 'ollama') {
            pushMessage({
              kind: 'system',
              text: 'Ollama runs locally — pull a model, then `switch ollama`. No key needed.\n\n' + morePrompt(),
            });
            return;
          }
          const prov = ONBOARD_KEY_PROVIDERS[name];
          if (!prov) {
            pushMessage({ kind: 'error', text: `Unknown provider: ${value}\n\n${morePrompt()}` });
            return;
          }
          setOnboard({ ...onboard, step: 'more-key', pendingProvider: name });
          pushMessage({ kind: 'system', text: keyPrompt(prov.label, prov.hint, process.env[prov.envKey]) });
          return;
        }
        case 'more-key': {
          const name = onboard.pendingProvider!;
          const prov = ONBOARD_KEY_PROVIDERS[name]!;
          const configured = [...onboard.configured];
          if (!isSkip) {
            const check = validateKey(name, value);
            if (!check.ok) {
              pushMessage({
                kind: 'error',
                text: `That doesn't look like a ${prov.label} key — ${check.reason}\n\n${keyPrompt(prov.label, prov.hint, process.env[prov.envKey])}`,
              });
              return; // stay on this step; nothing saved
            }
            await setUserEnvVar(prov.envKey, value);
            configured.push(prov.label);
            pushMessage({ kind: 'system', text: `✓ ${prov.label} key saved (${maskKey(value)}).` });
          }
          setOnboard({ step: 'more', configured });
          pushMessage({ kind: 'system', text: morePrompt() });
          return;
        }
      }
    },
    [onboard, pushMessage, saveConfig, finishOnboarding]
  );

  const handleSubmit = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      // Onboarding runs before the empty guard so a bare Enter means "skip".
      // Intercepting here (and returning) keeps pasted keys out of prompt
      // history, the session file, and the event log.
      if (onboard) {
        setPromptValue('');
        historyIndexRef.current = -1;
        draftRef.current = '';
        await handleOnboardInput(raw);
        return;
      }
      if (!trimmed) return;
      // Manual re-entry into the setup wizard.
      if (!reviewState && /^(setup|welcome|onboard(ing)?)$/i.test(trimmed)) {
        setPromptValue('');
        historyIndexRef.current = -1;
        draftRef.current = '';
        startOnboarding();
        return;
      }
      if (reviewState) {
        setPromptValue('');
        historyIndexRef.current = -1;
        draftRef.current = '';
        await handleReviewInput(trimmed);
        return;
      }
      const visibleInput = redactInputForHistory(trimmed);

      // Reset prompt + history navigation, then persist the new entry.
      setPromptValue('');
      historyIndexRef.current = -1;
      draftRef.current = '';
      const nextHistory = pushHistory(historyRef.current, visibleInput.text);
      historyRef.current = nextHistory;
      void saveHistory(nextHistory);

      pushMessage({ kind: 'user', text: visibleInput.text });
      logEvent('input', { raw: visibleInput.text, redacted: visibleInput.redacted });

      let action = routeInput(trimmed, {
        defaultProvider: config.defaultModel,
        commands,
      });

      // If we are in agentMode, any standard chat prompt is promoted to an
      // agent goal. sigils, shell commands, and explicit c9ai commands
      // (!cd, switch, config, etc) still take precedence.
      if (action.kind === 'chat' && config.agentMode) {
        action = { kind: 'agent', provider: action.provider, goal: action.prompt };
      }

      switch (action.kind) {
        case 'empty':
          return;
        case 'exit':
          pushMessage({ kind: 'system', text: 'bye.' });
          setTimeout(() => exit(), 50);
          return;
        case 'shell': {
          const startedAt = Date.now();
          setBusy(true);
          setBusyLabel(`shell: ${action.command}`);
          beginStream('shell');
          const ctrl = new AbortController();
          abortControllerRef.current = ctrl;
          try {
            await runShell(action.command, chunk => appendStream(chunk), {
              cwd: process.cwd(),
              signal: ctrl.signal,
              confirm: requestConfirm,
            });
            endStream();
            const elapsedS = (Date.now() - startedAt) / 1000;
            if (elapsedS >= 1) {
              pushMessage({ kind: 'system', text: `(${elapsedS.toFixed(1)}s)` });
            }
          } finally {
            abortControllerRef.current = null;
            setBusy(false);
          }
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

          const startedAt = Date.now();
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
              scope: currentDirScope,
              emit: chunk => appendStream(chunk),
            });
            endStream();
            const elapsedS = (Date.now() - startedAt) / 1000;
            if (elapsedS >= 1) {
              pushMessage({ kind: 'system', text: `(${elapsedS.toFixed(1)}s)` });
            }
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
              exportHistory,
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
        case 'model-review': {
          await startReview(action.name, action.runId);
          return;
        }
        case 'agent': {
          if (!action.goal) {
            const nextMode = !config.agentMode;
            await saveConfig({ agentMode: nextMode });
            pushMessage({
              kind: 'system',
              text: `agent mode: ${nextMode ? 'ON' : 'OFF'}\n(standard prompts will now run as autonomous goals)`,
            });
            return;
          }
          const provider = getProvider(action.provider ?? config.defaultModel);
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

          // Safety: If in persistent agentMode, ask for confirmation before
          // letting the model loose on the autonomous loop.
          if (config.agentMode) {
            const ok = await requestConfirm({
              command: `agent goal: ${action.goal}`,
              reason: 'agent.start',
            });
            if (ok !== 'allow' && ok !== 'allow-session') {
              pushMessage({ kind: 'system', text: 'agent run cancelled' });
              setBusy(false);
              return;
            }
          }

          // Refresh profile so agent sees edits since launch.
          profileRef.current = await loadProfile();
          const convHistory = buildConversation(messageHistoryRef.current);
          let inThought = false;
          let inToolOutput = false;
          let thoughtFilter: ThoughtFilter | null = null;
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
              case 'thought': {
                if (!inThought) {
                  if (inToolOutput) endStream();
                  inThought = true;
                  inToolOutput = false;
                  thoughtFilter = createThoughtFilter();
                }
                const cleaned = thoughtFilter!.filter(evt.chunk);
                if (cleaned) {
                  if (!streamingRef.current) beginStream('provider');
                  appendStream(cleaned);
                }
                break;
              }
              case 'turn-end': {
                if (inThought) {
                  if (thoughtFilter) {
                    const tail = thoughtFilter.flush();
                    if (tail) {
                      if (!streamingRef.current) beginStream('provider');
                      appendStream(tail);
                    }
                  }
                  thoughtFilter = null;
                  if (streamingRef.current) endStream();
                  inThought = false;
                }
                break;
              }
              case 'tool-call':
                pushMessage({
                  kind: 'tool',
                  text: formatToolCall(evt.name, evt.args),
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
            scope: currentDirScope,
            profile: profileRef.current,
            history: convHistory,
          });
          abortControllerRef.current = null;
          setBusy(false);
          return;
        }
        case 'research': {
          if (!action.input) {
            pushMessage({
              kind: 'system',
              text: 'usage: research <topic-or-file>  — bounded autoresearch iteration; writes a memo to outputs/',
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
              text: 'no tools registered — research has nothing to call',
            });
            return;
          }
          setBusy(true);
          setBusyLabel(`research: ${provider.name} (Esc to cancel)`);
          profileRef.current = await loadProfile();
          let inThought = false;
          let inToolOutput = false;
          let thoughtFilter: ThoughtFilter | null = null;
          const ctrl = new AbortController();
          abortControllerRef.current = ctrl;
          try {
            const result = await runResearch({
              input: action.input,
              cwd: process.cwd(),
              provider,
              tools,
              scope: currentDirScope,
              profile: profileRef.current,
              signal: ctrl.signal,
              confirm: requestConfirm,
              onEvent: evt => {
                switch (evt.type) {
                  case 'start':
                    pushMessage({
                      kind: 'system',
                      text: `research start (${evt.provider}) — input: ${action.input}`,
                    });
                    break;
                  case 'thought': {
                    if (!inThought) {
                      if (inToolOutput) endStream();
                      inThought = true;
                      inToolOutput = false;
                      thoughtFilter = createThoughtFilter();
                    }
                    const cleaned = thoughtFilter!.filter(evt.chunk);
                    if (cleaned) {
                      if (!streamingRef.current) beginStream('provider');
                      appendStream(cleaned);
                    }
                    break;
                  }
                  case 'turn-end': {
                    if (inThought) {
                      if (thoughtFilter) {
                        const tail = thoughtFilter.flush();
                        if (tail) {
                          if (!streamingRef.current) beginStream('provider');
                          appendStream(tail);
                        }
                      }
                      thoughtFilter = null;
                      if (streamingRef.current) endStream();
                      inThought = false;
                    }
                    break;
                  }
                  case 'tool-call':
                    pushMessage({
                      kind: 'tool',
                      text: formatToolCall(evt.name, evt.args),
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
                    // Defer the final summary line — we want to print verdict + path
                    // after the memo is parsed, not the raw agent finish reason.
                    break;
                }
              },
            });
            pushMessage({
              kind: 'system',
              text:
                `research finish: verdict=${result.verdict} ` +
                `(iter=${result.iterations}, ${Math.round(result.elapsedMs / 1000)}s)\n` +
                `memo: ${result.outputPath}`,
            });
          } catch (err) {
            pushMessage({
              kind: 'error',
              text: `research failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
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

          const conversation: ChatMessage[] = [];
          if (profile) {
            conversation.push({ role: 'system', content: formatProfileForSystem(profile) });
          }
          conversation.push(...buildConversation(messageHistoryRef.current));
          conversation.push({ role: 'user', content: action.prompt });
          const startedAt = Date.now();
          setBusy(true);
          setBusyLabel(`${provider.name} ${pickVerb()} (Esc to cancel)`);
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
            const elapsedS = (Date.now() - startedAt) / 1000;
            if (result.aborted) {
              pushMessage({
                kind: 'system',
                text: `(cancelled after ${elapsedS.toFixed(1)}s)`,
              });
            } else if (elapsedS >= 1) {
              pushMessage({ kind: 'system', text: `(${elapsedS.toFixed(1)}s)` });
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
      currentDirScope,
      endStream,
      exit,
      history,
      handleReviewInput,
      onboard,
      handleOnboardInput,
      startOnboarding,
      pushMessage,
      requestConfirm,
      saveConfig,
      reviewState,
      startReview,
      tools,
    ]
  );

  // First launch ever (no onboardedAt in config.json) → run the setup wizard.
  useEffect(() => {
    if (!initialConfig.onboardedAt) {
      startOnboarding();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <Text color="yellow">
              … {busyLabel}
              {busyElapsed > 0
                ? ` — ${busyElapsed}s${elapsedHint(busyElapsed)}`
                : ''}
            </Text>
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
          <Box>
            <Text color="gray" dimColor>
              help · agent · ! shell · @tool · exit
            </Text>
            {config.agentMode && (
              <Text color="yellow" bold>
                {' '}· agent mode
              </Text>
            )}
          </Box>
          <Text color="gray" dimColor>
            {config.defaultModel}
          </Text>
        </Box>
      </Box>
    </>
  );
}
