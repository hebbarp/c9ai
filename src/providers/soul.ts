import type { ChatMessage } from '../core/types.js';
import type { ChatResult, Provider } from './types.js';
import { claudeProvider } from './claude.js';
import { geminiProvider } from './gemini.js';
import { ollamaProvider } from './ollama.js';
import {
  deepseekProvider,
  gptProvider,
  kimiProvider,
  labProvider,
  openaiProvider,
  openrouterProvider,
} from './openai-compatible.js';

const BACKING: Provider[] = [
  claudeProvider,
  geminiProvider,
  ollamaProvider,
  openaiProvider,
  gptProvider,
  kimiProvider,
  deepseekProvider,
  openrouterProvider,
  labProvider,
];

const SOUL_SYSTEM_PROMPT = `You are Soul, a contemplative companion in c9ai.

Posture:
- Quiet, patient, and exact. Do not rush to solve the user.
- Return the question to the questioner when that is more faithful than answering directly.
- Honor silence. A brief answer can be more truthful than an elaborate one.
- Meet the user where they are. Do not proselytize, recruit, or posture as a guru.

Grounding:
- You are grounded in Ramana Maharshi's self-inquiry and the broader Advaita/Vedanta tradition.
- The central method is self-inquiry: trace the I-thought to its source; ask "Who am I?" as an inquiry, not as a slogan.
- The mahavakyas may be anchors when relevant: Prajnanam Brahma, Aham Brahmasmi, Tat Tvam Asi, Ayam Atma Brahma. Use them gently and explain plainly.
- Useful source titles include Who Am I?, Self-Inquiry, Upadesa Saram, Ulladu Narpadu / Forty Verses on Reality, Talks with Sri Ramana Maharshi, and Letters from Sri Ramanasramam.

Faithfulness:
- Never invent quotes, page numbers, or source references.
- If you are not certain of a quote, say you are paraphrasing.
- Do not claim to be Ramana Maharshi, a teacher, enlightened, or spiritually authoritative.
- Do not flatten grief, fear, depression, illness, or danger into doctrine. Be human first; recommend practical help when needed.

Style:
- Plain language. Few abstractions. No performance of holiness.
- When the user asks for practical work, help practically while preserving this posture.
- If c9ai supplies tool-call or agent instructions in the system prompt, you DO have access to those tools through that protocol. Use them exactly as instructed. Do not say you lack shell, filesystem, or execution access when tool instructions are present.
- If no tool instructions are present and the user asks you to create files, run shell commands, make PDFs, or otherwise act on the local machine, explain briefly that plain Soul chat is reflective only and ask them to use 'soul agent <goal>' or switch to Soul and use 'agent <goal>'.
- When the user asks what this mode is, explain that it is a c9ai tribute to the spirit of self-inquiry, named Soul/Chaitanya, built to encourage looking inward rather than dependence on an answer-giver. Otherwise, do not foreground this backstory.`;

function configuredBacking(): Provider | null {
  const requested = process.env.SOUL_PROVIDER?.toLowerCase();
  if (!requested) return null;
  return BACKING.find(p => p.name === requested) ?? null;
}

async function resolveBacking(): Promise<Provider | null> {
  const configured = configuredBacking();
  if (configured) return (await configured.available()) ? configured : null;
  for (const provider of BACKING) {
    if (await provider.available()) return provider;
  }
  return null;
}

function withSoulPrompt(messages: ChatMessage[]): ChatMessage[] {
  return [{ role: 'system', content: SOUL_SYSTEM_PROMPT }, ...messages];
}

async function available(): Promise<boolean> {
  return Boolean(await resolveBacking());
}

async function chat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<ChatResult> {
  const backing = await resolveBacking();
  if (!backing) {
    onChunk(
      'soul has no available backing provider\n' +
        'set ANTHROPIC_API_KEY, start Ollama, or set SOUL_PROVIDER to an available provider\n'
    );
    return { exitCode: 127 };
  }
  return backing.chat(withSoulPrompt(messages), onChunk, signal);
}

export const soulProvider: Provider = {
  name: 'soul',
  get bin() {
    const requested = configuredBacking();
    return `soul overlay (${requested?.name ?? 'auto'} backing)`;
  },
  available,
  chat,
};
