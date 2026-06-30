/**
 * Bru skill manifest — authoring, the capability taxonomy, and the client-side
 * validator. This is the c9ai pre-flight mirror of the authoritative Matsya
 * compiler (see c9ai/docs/bru-skill-spec.md). Authors get feedback locally; the
 * server re-runs the same checks on publish and is the source of truth.
 *
 * A skill is declarative data: input schema + natural-language `instructions`
 * (run by the BRU agent) + output schema. The one security-critical field is
 * `capabilities` — the entitlements the skill is allowed to exercise.
 */

import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from '../core/config.js';

export const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
export const MANIFEST_FILE = 'skill.bru.json';

export type CapabilityTier = 'auto' | 'review' | 'denied';

export interface CapabilitySpec {
  tier: CapabilityTier;
  tool: string;
  description: string;
}

/**
 * The capability taxonomy (mirrors docs/bru-skill-spec.md §2). `auto` is granted
 * on a clean compile; `review` is declarable but needs human approval before a
 * skill is published; `denied` is hard-blocked for partner skills.
 * A declared capability may carry a `:arg` suffix (e.g. `model.infer:tiny-dickinson`)
 * which is matched against the base key.
 */
export const CAPABILITIES: Record<string, CapabilitySpec> = {
  'web.fetch':        { tier: 'auto',   tool: 'web_fetch',        description: 'Fetch a web page' },
  'web.search':       { tier: 'auto',   tool: 'web_search',       description: 'Search the web' },
  'doc.pdf':          { tier: 'auto',   tool: 'create_pdf',       description: 'Create a PDF document' },
  'doc.excel':        { tier: 'auto',   tool: 'create_excel',     description: 'Create a spreadsheet' },
  'doc.convert':      { tier: 'auto',   tool: 'convert_document', description: 'Convert document formats' },
  'fs.read:sandbox':  { tier: 'auto',   tool: 'read_file',        description: 'Read files inside the sandbox' },
  'fs.write:sandbox': { tier: 'auto',   tool: 'write_file',       description: 'Write files inside the sandbox' },
  'media.process':    { tier: 'auto',   tool: 'process_media',    description: 'Process audio/video/images' },
  'matsya.task':      { tier: 'auto',   tool: 'matsya_*',         description: 'Tenant-scoped Matsya tasks/todos/search' },
  'model.infer':      { tier: 'auto',   tool: '-',                description: 'Run inference on a bundled model' },
  'email.send':       { tier: 'review', tool: 'send_email',       description: 'Send email' },
  'whatsapp.send':    { tier: 'review', tool: 'send_whatsapp',    description: 'Send WhatsApp messages' },
  'system.shell':     { tier: 'review', tool: 'bash_execute',     description: 'Run shell commands' },
  'system.ssh':       { tier: 'review', tool: 'ssh_execute',      description: 'Run commands over SSH' },
  'system.sftp':      { tier: 'review', tool: 'sftp_*',           description: 'Transfer files over SFTP' },
  'system.git':       { tier: 'review', tool: 'git',              description: 'Run git commands' },
  'fs.write:host':    { tier: 'review', tool: 'write_file',       description: 'Write to the host filesystem' },
  'net.arbitrary':    { tier: 'review', tool: '-',                description: 'Open arbitrary network connections' },
};

export function lookupCapability(decl: string): CapabilitySpec | undefined {
  if (CAPABILITIES[decl]) return CAPABILITIES[decl];
  const i = decl.indexOf(':');
  if (i > 0) return CAPABILITIES[decl.slice(0, i)];
  return undefined;
}

export type SkillType = 'checklist' | 'input_output' | 'document' | 'model';
export type PricingModel = 'free' | 'per_run' | 'per_install';

export interface SkillManifest {
  id: string;
  name: string;
  version: string;
  author?: string;
  category?: string;
  description?: string;
  type: SkillType;
  pricing?: { model: PricingModel; price_credits?: number };
  capabilities: string[];
  inputs?: unknown;
  outputs?: unknown;
  instructions: string;
}

export type Verdict = 'pass' | 'needs_review' | 'fail';
export interface Finding {
  level: 'error' | 'warn' | 'info';
  message: string;
}
export interface ValidationResult {
  verdict: Verdict;
  findings: Finding[];
  reviewCaps: string[];
}

/** Patterns in `instructions` that indicate malicious or risky intent. */
const RISK_PATTERNS: { re: RegExp; level: 'error' | 'warn'; message: string }[] = [
  { re: /\brm\s+-rf\b/i,                                  level: 'error', message: 'destructive filesystem command (rm -rf)' },
  { re: /curl[^\n]*\|\s*(sh|bash)|wget[^\n]*\|\s*(sh|bash)/i, level: 'error', message: 'pipe-to-shell download execution' },
  { re: /\bexfiltrat|send (all|every|the) .*\bfiles?\b/i, level: 'error', message: 'possible data exfiltration' },
  { re: /\.ssh\/id_|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|private key/i, level: 'error', message: 'attempts to read private keys' },
  { re: /\bignore (all )?(previous|prior) (instructions|prompts?)\b/i, level: 'error', message: 'prompt-injection phrasing' },
  { re: /\b(password|secret|api[_-]?key|access[_-]?token)s?\b/i, level: 'warn', message: 'references credentials/secrets — verify intent' },
  { re: /base64\s+-d|atob\s*\(/i,                         level: 'warn', message: 'base64 decoding — possible obfuscation' },
];

/** Heuristic: instructions that look like they use a tool whose capability isn't declared. */
const TOOL_HINTS: { re: RegExp; cap: string; label: string }[] = [
  { re: /\b(ssh|scp)\b/i,                       cap: 'system.ssh',   label: 'SSH' },
  { re: /\bsftp\b/i,                            cap: 'system.sftp',  label: 'SFTP' },
  { re: /\b(bash|shell command|terminal)\b/i,   cap: 'system.shell', label: 'shell' },
  { re: /\bgit (clone|push|pull|commit)\b/i,    cap: 'system.git',   label: 'git' },
  { re: /\bsend (an? )?email\b|\bemail (it|them|the)\b/i, cap: 'email.send', label: 'email' },
];

export function validateManifest(m: any): ValidationResult {
  const findings: Finding[] = [];
  const reviewCaps: string[] = [];
  const err = (message: string) => findings.push({ level: 'error', message });
  const warn = (message: string) => findings.push({ level: 'warn', message });

  for (const f of ['id', 'name', 'version', 'type', 'instructions'] as const) {
    if (!m || typeof m[f] !== 'string' || !m[f].trim()) err(`missing required field: ${f}`);
  }
  const types: SkillType[] = ['checklist', 'input_output', 'document', 'model'];
  if (m?.type && !types.includes(m.type)) {
    err(`invalid type: ${m.type} (expected ${types.join(' | ')})`);
  }
  if (m?.id && !/^[a-z0-9][a-z0-9-]*$/.test(m.id)) {
    err('id must be lowercase letters, numbers, and hyphens');
  }

  const caps: unknown = m?.capabilities;
  const declared = new Set<string>();
  if (!Array.isArray(caps)) {
    err('capabilities must be an array (use [] for none)');
  } else {
    for (const c of caps) {
      if (typeof c !== 'string') { err(`capability must be a string: ${JSON.stringify(c)}`); continue; }
      declared.add(c);
      const spec = lookupCapability(c);
      if (!spec) err(`unknown capability: ${c}`);
      else if (spec.tier === 'denied') err(`capability not allowed for partner skills: ${c}`);
      else if (spec.tier === 'review') reviewCaps.push(c);
    }
  }

  if (m?.pricing) {
    const models: PricingModel[] = ['free', 'per_run', 'per_install'];
    if (!models.includes(m.pricing.model)) err(`invalid pricing.model: ${m.pricing.model}`);
    else if (m.pricing.model !== 'free' && !(typeof m.pricing.price_credits === 'number' && m.pricing.price_credits > 0)) {
      err('paid pricing requires a positive price_credits');
    }
  }

  const instr = typeof m?.instructions === 'string' ? m.instructions : '';
  for (const p of RISK_PATTERNS) {
    if (p.re.test(instr)) findings.push({ level: p.level, message: `instructions: ${p.message}` });
  }
  for (const h of TOOL_HINTS) {
    if (h.re.test(instr) && !declared.has(h.cap)) {
      warn(`instructions look like they use ${h.label}, but '${h.cap}' is not declared`);
    }
  }

  const hasError = findings.some(f => f.level === 'error');
  const hasWarn = findings.some(f => f.level === 'warn');
  const verdict: Verdict = hasError ? 'fail' : (reviewCaps.length > 0 || hasWarn) ? 'needs_review' : 'pass';
  return { verdict, findings, reviewCaps };
}

function titleCase(id: string): string {
  return id.split('-').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

/** Scaffold a new skill manifest under ~/.c9ai/skills/<id>/. Returns the file path. */
export async function scaffoldSkill(id: string): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error('skill id must be lowercase letters, numbers, and hyphens (e.g. link-checker)');
  }
  const dir = path.join(SKILLS_DIR, id);
  const file = path.join(dir, MANIFEST_FILE);
  if (existsSync(file)) throw new Error(`skill already exists: ${file}`);

  const template: SkillManifest = {
    id,
    name: titleCase(id),
    version: '0.1.0',
    author: '',
    category: 'custom',
    description: '',
    type: 'input_output',
    pricing: { model: 'free' },
    capabilities: ['web.fetch'],
    inputs: { fields: [{ id: 'url', type: 'url', label: 'URL', required: true }] },
    outputs: { type: 'text' },
    instructions: 'Describe what this skill should do. Reference inputs like {input.url}.',
  };

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(template, null, 2) + '\n', 'utf8');
  return file;
}

export function resolveManifestPath(idOrPath: string): string {
  if (idOrPath.endsWith('.json') || idOrPath.includes('/') || idOrPath.includes('\\')) {
    return path.resolve(idOrPath);
  }
  return path.join(SKILLS_DIR, idOrPath, MANIFEST_FILE);
}

export async function loadManifest(idOrPath: string): Promise<{ path: string; manifest: any }> {
  const p = resolveManifestPath(idOrPath);
  const raw = await fs.readFile(p, 'utf8');
  let manifest: unknown;
  try {
    manifest = JSON.parse(raw);
  } catch (e) {
    throw new Error(`invalid JSON in ${p}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { path: p, manifest };
}

export async function listSkills(): Promise<string[]> {
  try {
    const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() && existsSync(path.join(SKILLS_DIR, e.name, MANIFEST_FILE)))
      .map(e => e.name)
      .sort();
  } catch {
    return [];
  }
}
