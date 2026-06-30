import type { Command } from '../core/types.js';
import {
  scaffoldSkill,
  loadManifest,
  validateManifest,
  listSkills,
  SKILLS_DIR,
  type ValidationResult,
} from '../skills/manifest.js';

const USAGE = [
  'usage:',
  '  skill new <id>             scaffold a Bru skill manifest in ~/.c9ai/skills/<id>/',
  '  skill validate <id|path>   check manifest + capabilities + static safety scan',
  '  skill list                 list local skills',
  '',
  '  (skill publish lands once the Matsya bru-store endpoint is built)',
].join('\n');

function formatReport(r: ValidationResult): string {
  const icon = (lvl: string) => (lvl === 'error' ? '✗' : lvl === 'warn' ? '⚠' : '•');
  const head =
    r.verdict === 'pass'
      ? 'PASS — clean, auto-grant only (eligible for fast-track)'
      : r.verdict === 'needs_review'
        ? 'NEEDS REVIEW — human approval required before publish'
        : 'FAIL — fix the errors below';
  const lines = [head];
  if (r.reviewCaps.length) lines.push(`  review-gated: ${r.reviewCaps.join(', ')}`);
  for (const f of r.findings) lines.push(`  ${icon(f.level)} ${f.message}`);
  return lines.join('\n');
}

export const skillCommand: Command = {
  name: 'skill',
  description: 'Author Bru skills for the Matsya marketplace (new | validate | list)',
  run: async (args, ctx) => {
    const action = (args[0] ?? 'help').toLowerCase();

    switch (action) {
      case 'new': {
        const id = (args[1] ?? '').trim();
        if (!id) {
          ctx.emit({ kind: 'error', text: 'usage: skill new <id>' });
          return;
        }
        try {
          const file = await scaffoldSkill(id);
          ctx.emit({
            kind: 'system',
            text: `skill: created ${file}\nedit the manifest, then run \`skill validate ${id}\``,
          });
        } catch (e) {
          ctx.emit({ kind: 'error', text: `skill: ${e instanceof Error ? e.message : String(e)}` });
        }
        return;
      }

      case 'validate': {
        const target = (args[1] ?? '').trim();
        if (!target) {
          ctx.emit({ kind: 'error', text: 'usage: skill validate <id|path>' });
          return;
        }
        try {
          const { path: p, manifest } = await loadManifest(target);
          const result = validateManifest(manifest);
          ctx.emit({
            kind: result.verdict === 'fail' ? 'error' : 'system',
            text: `skill validate: ${p}\n${formatReport(result)}`,
          });
        } catch (e) {
          ctx.emit({ kind: 'error', text: `skill: ${e instanceof Error ? e.message : String(e)}` });
        }
        return;
      }

      case 'list': {
        const ids = await listSkills();
        ctx.emit({
          kind: 'system',
          text: ids.length ? ids.map(i => `  ${i}`).join('\n') : `no skills yet — create one with \`skill new <id>\`\n(skills live in ${SKILLS_DIR})`,
        });
        return;
      }

      case 'help':
      case '-h':
      case '--help':
        ctx.emit({ kind: 'system', text: USAGE });
        return;

      default:
        ctx.emit({ kind: 'error', text: `unknown action: ${action}\n\n${USAGE}` });
    }
  },
};
