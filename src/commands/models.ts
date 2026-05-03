import { promises as fs } from 'node:fs';
import type { Command } from '../core/types.js';
import { configureOllama } from '../providers/ollama.js';
import { getProvider } from '../providers/registry.js';
import {
  addCorpus,
  initModel,
  listCorpus,
  listModels,
  listSamples,
  loadModel,
  readEvalQuestions,
  readSystemPrompt,
  writeEvalRun,
} from '../models/registry.js';
import { listEvalRuns, parseInteractiveReview } from '../models/review.js';
import {
  appendPair,
  buildPairSystemPrompt,
  buildPairUserMessage,
  cleanGeneratedPrompt,
  listPairs,
  pairsFile,
  readCorpusEntries,
  removePairs,
} from '../models/pairs.js';
import { buildModelfile, runOllamaCreate } from '../models/build.js';
import { packageLoraModel, type PackageLoraOptions } from '../models/package.js';
import { runTrainScript, scaffoldTrainRecipe } from '../models/train.js';
import {
  auditPairs,
  doctorModel,
  exportModelProject,
  formatDoctor,
  formatStatus,
  getModelStatus,
} from '../models/status.js';

const USAGE = [
  'usage:',
  '  models samples                         list bundled sample model projects',
  '  models init <sample-name>              create from a bundled sample',
  '  models init <name> <ollama-tag>        create a custom local model project',
  '  models list                            list local model projects',
  '  models inspect <name>                  show model project details',
  '  models status <name>                   show model project readiness + hashes',
  '  models doctor <name>                   run local readiness diagnostics',
  '  models corpus <name> list              list corpus files',
  '  models corpus <name> add <path>        copy .md/.txt file or folder into corpus',
  '  models pairs <name> generate           generate (prompt, completion) pairs from corpus',
  '  models pairs <name> audit              check duplicates, lengths, source coverage',
  '  models pairs <name> list               list generated training pairs',
  '  models pairs <name> show <index>       show one full pair (prompt + completion)',
  '  models pairs <name> remove <index...>  drop one or more pairs from the JSONL',
  '  models build <name> [--create]         write Modelfile (and optionally run `ollama create`)',
  '  models train <name> [--run]            scaffold (and optionally run) the LoRA training recipe',
  '  models package <name> [--promote]      convert LoRA adapter to GGUF and create Ollama tag',
  '  models eval <name>                     run eval questions with current provider',
  '  models evals-list <name>               list saved eval runs',
  '  models review <name> [run-file]        score latest or named eval run',
  '  models compare <name> [run-a] [run-b]  compare reviewed eval runs',
  '  models export <name> [--outdir DIR]    export project bundle (no weights by default)',
  '  models switch <name>                   switch c9ai to its Ollama model',
].join('\n');

function mdEscape(s: string): string {
  return s.replace(/\r/g, '');
}

interface ComparedRun {
  file: string;
  path: string;
  overall: NonNullable<ReturnType<typeof parseInteractiveReview>>['overall'];
}

function parseScore(value: string): number | null {
  const match = value.trim().match(/^([1-5])(?:\/5)?$/);
  return match ? Number(match[1]) : null;
}

function formatDelta(before: string, after: string): string {
  const a = parseScore(before);
  const b = parseScore(after);
  if (a === null || b === null) {
    return before === after ? 'same' : `${before} -> ${after}`;
  }
  const delta = b - a;
  if (delta === 0) return '0';
  return `${delta > 0 ? '+' : ''}${delta}`;
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

async function loadComparedRun(name: string, runId: string): Promise<ComparedRun> {
  const runs = await listEvalRuns(name);
  const needle = runId.endsWith('.md') ? runId : `${runId}.md`;
  const match = runs.find(r => r.file === needle) ?? runs.find(r => r.file.startsWith(runId));
  if (!match) {
    throw new Error(`eval run not found: ${runId}`);
  }
  const markdown = await fs.readFile(match.path, 'utf8');
  const review = parseInteractiveReview(markdown);
  if (!review) {
    throw new Error(`eval run is not reviewed: ${match.file}`);
  }
  return { file: match.file, path: match.path, overall: review.overall };
}

function formatReviewedRun(run: ComparedRun): string {
  return [
    `run: ${run.file}`,
    `path: ${run.path}`,
    `style: ${run.overall.style}`,
    `faithfulness: ${run.overall.faithfulness}`,
    `usefulness: ${run.overall.usefulness}`,
    `quote honesty: ${run.overall.quoteHonesty}`,
    `impersonation: ${run.overall.impersonation}`,
    '',
    'notes:',
    run.overall.notes || '(none)',
  ].join('\n');
}

export const modelsCommand: Command = {
  name: 'models',
  description: 'Small Language Foundry model projects',
  run: async (args, ctx) => {
    const action = (args[0] ?? 'list').toLowerCase();

    switch (action) {
      case 'help':
      case '-h':
      case '--help':
        ctx.emit({ kind: 'system', text: USAGE });
        return;

      case 'samples': {
        const samples = await listSamples();
        if (samples.length === 0) {
          ctx.emit({ kind: 'system', text: 'models: no bundled samples found' });
          return;
        }
        ctx.emit({
          kind: 'system',
          text:
            `sample model projects (${samples.length}):\n` +
            samples
              .map(s => `  ${s.name.padEnd(18)} ${s.spec.description ?? s.spec.displayName}`)
              .join('\n'),
        });
        return;
      }

      case 'init': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models init <sample-name>  OR  models init <name> <ollama-tag>' });
          return;
        }
        const tag = args[2];
        const samples = await listSamples();
        const matchingSample = samples.find(s => s.name === name);
        const sample = matchingSample ? matchingSample.name : undefined;
        const ollamaTag = tag ?? matchingSample?.spec.ollamaModel;
        if (!ollamaTag) {
          ctx.emit({ kind: 'error', text: `usage: models init ${name} <ollama-tag>` });
          return;
        }
        try {
          const r = await initModel(name, ollamaTag, { sample });
          ctx.emit({
            kind: 'system',
            text:
              `${r.created ? 'created' : 'already exists'}: ${r.spec.name}\n` +
              `ollama: ${r.spec.ollamaModel}\n` +
              `path:   ${r.dir}`,
          });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models init: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'list': {
        const models = await listModels();
        if (models.length === 0) {
          ctx.emit({
            kind: 'system',
            text: 'models: none yet. try `models samples`, then `models init tiny-dickinson`',
          });
          return;
        }
        ctx.emit({
          kind: 'system',
          text:
            `model projects (${models.length}):\n` +
            models.map(m => `  ${m.spec.name.padEnd(18)} ${m.spec.ollamaModel}`).join('\n'),
        });
        return;
      }

      case 'inspect': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models inspect <name>' });
          return;
        }
        const model = await loadModel(name);
        if (!model) {
          ctx.emit({ kind: 'error', text: `model not found: ${name}` });
          return;
        }
        const s = model.spec;
        ctx.emit({
          kind: 'system',
          text: [
            `name:        ${s.name}`,
            `display:     ${s.displayName}`,
            `type:        ${s.type}`,
            `runtime:     ${s.runtime}`,
            `ollama:      ${s.ollamaModel}`,
            `language:    ${s.language ?? '(unspecified)'}`,
            `description: ${s.description ?? '(none)'}`,
            `path:        ${model.dir}`,
          ].join('\n'),
        });
        return;
      }

      case 'status': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models status <name>' });
          return;
        }
        try {
          ctx.emit({ kind: 'system', text: formatStatus(await getModelStatus(name)) });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models status: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'doctor': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models doctor <name>' });
          return;
        }
        try {
          const provider = getProvider(ctx.config.defaultModel);
          const result = await doctorModel(name, await provider.available());
          ctx.emit({ kind: 'system', text: formatDoctor(result) });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models doctor: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'corpus': {
        const name = args[1];
        const sub = (args[2] ?? 'list').toLowerCase();
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models corpus <name> <list|add> [path]' });
          return;
        }

        if (sub === 'list') {
          try {
            const r = await listCorpus(name);
            if (r.files.length === 0) {
              ctx.emit({ kind: 'system', text: `corpus: no .md/.txt files yet\npath: ${r.dir}` });
              return;
            }
            ctx.emit({
              kind: 'system',
              text:
                `corpus files (${r.files.length}):\n` +
                r.files.map(f => `  ${f.rel} (${f.bytes} bytes)`).join('\n'),
            });
          } catch (err) {
            ctx.emit({ kind: 'error', text: `models corpus: ${err instanceof Error ? err.message : String(err)}` });
          }
          return;
        }

        if (sub === 'add') {
          const inputPath = args.slice(3).join(' ').trim();
          if (!inputPath) {
            ctx.emit({ kind: 'error', text: 'usage: models corpus <name> add <file-or-folder>' });
            return;
          }
          try {
            const r = await addCorpus(name, inputPath, process.cwd());
            if (r.added.length === 0) {
              ctx.emit({ kind: 'system', text: `corpus: no .md/.txt files found in ${inputPath}` });
              return;
            }
            ctx.emit({
              kind: 'system',
              text:
                `added corpus files (${r.added.length}):\n` +
                r.added.map(f => `  ${f.rel} (${f.bytes} bytes)`).join('\n'),
            });
          } catch (err) {
            ctx.emit({ kind: 'error', text: `models corpus add: ${err instanceof Error ? err.message : String(err)}` });
          }
          return;
        }

        ctx.emit({ kind: 'error', text: `unknown corpus action: ${sub}\n\n${USAGE}` });
        return;
      }

      case 'pairs': {
        const name = args[1];
        const sub = (args[2] ?? 'list').toLowerCase();
        if (!name) {
          ctx.emit({
            kind: 'error',
            text: 'usage: models pairs <name> <list|audit|generate|show|remove> [args]',
          });
          return;
        }
        const model = await loadModel(name);
        if (!model) {
          ctx.emit({ kind: 'error', text: `model not found: ${name}` });
          return;
        }

        if (sub === 'list') {
          try {
            const r = await listPairs(name);
            if (r.pairs.length === 0) {
              ctx.emit({
                kind: 'system',
                text: `pairs: none yet. run \`models pairs ${name} generate\`\nfile: ${r.file}`,
              });
              return;
            }
            const preview = r.pairs
              .map((p, i) => {
                const promptShort = p.prompt.length > 90 ? p.prompt.slice(0, 87) + '...' : p.prompt;
                return `  ${String(i + 1).padStart(3)}. ${promptShort.padEnd(90)} <- ${p.source}`;
              })
              .join('\n');
            ctx.emit({
              kind: 'system',
              text:
                `pairs (${r.pairs.length}):\n${preview}\n\n` +
                `file: ${r.file}\n` +
                `tip: \`models pairs ${name} show <index>\` for full prompt + completion`,
            });
          } catch (err) {
            ctx.emit({
              kind: 'error',
              text: `models pairs list: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
          return;
        }

        if (sub === 'audit') {
          try {
            const audit = await auditPairs(name);
            if (audit.issues.length === 0) {
              ctx.emit({
                kind: 'system',
                text: `pairs audit: ok (${audit.pairCount} pair(s), sha256 ${audit.pairHash?.slice(0, 12) ?? '(none)'})`,
              });
              return;
            }
            ctx.emit({
              kind: 'system',
              text:
                `pairs audit: ${audit.issues.filter(i => i.level === 'fail').length} fail, ${audit.issues.filter(i => i.level === 'warn').length} warn\n` +
                audit.issues.map(i => `  ${i.level.toUpperCase()} ${i.code}: ${i.message}`).join('\n'),
            });
          } catch (err) {
            ctx.emit({ kind: 'error', text: `models pairs audit: ${err instanceof Error ? err.message : String(err)}` });
          }
          return;
        }

        if (sub === 'show') {
          const indexArg = args[3];
          const index = Number(indexArg);
          if (!indexArg || !Number.isInteger(index) || index < 1) {
            ctx.emit({ kind: 'error', text: `usage: models pairs ${name} show <index>` });
            return;
          }
          try {
            const r = await listPairs(name);
            if (index > r.pairs.length) {
              ctx.emit({
                kind: 'error',
                text: `pair index out of range: ${index}; have ${r.pairs.length}`,
              });
              return;
            }
            const p = r.pairs[index - 1]!;
            ctx.emit({
              kind: 'system',
              text: [
                `pair ${index}/${r.pairs.length}`,
                `source:    ${p.source}`,
                `createdAt: ${p.createdAt}`,
                '',
                'prompt:',
                p.prompt,
                '',
                'completion:',
                p.completion,
              ].join('\n'),
            });
          } catch (err) {
            ctx.emit({
              kind: 'error',
              text: `models pairs show: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
          return;
        }

        if (sub === 'remove') {
          const rest = args.slice(3);
          if (rest.length === 0) {
            ctx.emit({ kind: 'error', text: `usage: models pairs ${name} remove <index> [<index>...]` });
            return;
          }
          const indexes: number[] = [];
          for (const a of rest) {
            const n = Number(a);
            if (!Number.isInteger(n) || n < 1) {
              ctx.emit({ kind: 'error', text: `not a positive integer: ${a}` });
              return;
            }
            indexes.push(n);
          }
          try {
            const removed = await removePairs(name, indexes);
            ctx.emit({
              kind: 'system',
              text:
                `removed ${removed.length} pair(s):\n` +
                removed.map(p => `  ${p.source}: ${p.prompt}`).join('\n') +
                `\n\nrun \`models pairs ${name} generate\` to re-generate them.`,
            });
          } catch (err) {
            ctx.emit({
              kind: 'error',
              text: `models pairs remove: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
          return;
        }

        if (sub === 'generate') {
          let limit = Infinity;
          for (let i = 3; i < args.length; i++) {
            if (args[i] === '--limit') {
              const n = Number(args[i + 1]);
              if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
              i++;
            }
          }

          const provider = getProvider(ctx.config.defaultModel);
          const ok = await provider.available();
          if (!ok) {
            ctx.emit({ kind: 'error', text: `${provider.name} not available (${provider.bin})` });
            return;
          }

          const corpus = await readCorpusEntries(name);
          if (corpus.entries.length === 0) {
            ctx.emit({
              kind: 'error',
              text: `models pairs generate: no pairable corpus files; add some with \`models corpus ${name} add <path>\``,
            });
            return;
          }

          if (corpus.skipped.length > 0) {
            ctx.emit({
              kind: 'system',
              text:
                `pairs: skipping ${corpus.skipped.length} meta file(s):\n` +
                corpus.skipped.map(s => `  ${s}`).join('\n'),
            });
          }

          const existing = await listPairs(name);
          const existingSources = new Set(existing.pairs.map(p => p.source));
          const todo = corpus.entries.filter(c => !existingSources.has(c.rel)).slice(0, limit);

          if (todo.length === 0) {
            ctx.emit({
              kind: 'system',
              text: `pairs: all ${corpus.entries.length} corpus files already have pairs; nothing to do (use \`models pairs ${name} remove <index>\` to redo one)`,
            });
            return;
          }

          const stylePrompt = await readSystemPrompt(name);
          const pairSystemPrompt = buildPairSystemPrompt(stylePrompt);

          ctx.emit({
            kind: 'system',
            text:
              `pairs generate: ${todo.length} corpus files via ${provider.name}` +
              (stylePrompt ? ' (using model system prompt as voice context)' : ''),
          });

          let generated = 0;
          let failed = 0;
          for (let i = 0; i < todo.length; i++) {
            const entry = todo[i]!;
            ctx.emit({ kind: 'system', text: `pairs ${i + 1}/${todo.length}: ${entry.rel}` });

            let response = '';
            try {
              const result = await provider.chat(
                [
                  { role: 'system', content: pairSystemPrompt },
                  { role: 'user', content: buildPairUserMessage(entry.body) },
                ],
                chunk => {
                  response += chunk;
                }
              );
              if (result.exitCode !== 0) {
                failed++;
                ctx.emit({
                  kind: 'error',
                  text: `pairs ${entry.rel}: provider exit code ${result.exitCode}`,
                });
                continue;
              }
            } catch (err) {
              failed++;
              ctx.emit({
                kind: 'error',
                text: `pairs ${entry.rel}: ${err instanceof Error ? err.message : String(err)}`,
              });
              continue;
            }

            const prompt = cleanGeneratedPrompt(response);
            if (!prompt) {
              failed++;
              ctx.emit({ kind: 'error', text: `pairs ${entry.rel}: empty prompt from provider` });
              continue;
            }

            await appendPair(name, {
              prompt,
              completion: entry.body,
              source: entry.rel,
              createdAt: new Date().toISOString(),
            });
            generated++;
          }

          ctx.emit({
            kind: 'system',
            text: `pairs generate finish: ${generated} generated, ${failed} failed; file: ${pairsFile(model.dir)}`,
          });
          return;
        }

        ctx.emit({ kind: 'error', text: `unknown pairs action: ${sub}\n\n${USAGE}` });
        return;
      }

      case 'build': {
        const name = args[1];
        if (!name) {
          ctx.emit({
            kind: 'error',
            text: 'usage: models build <name> [--examples N] [--base TAG] [--create]',
          });
          return;
        }
        let examples: number | undefined;
        let baseModel: string | undefined;
        let runCreate = false;
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--examples') {
            const n = Number(args[i + 1]);
            if (Number.isFinite(n) && n >= 0) examples = Math.floor(n);
            i++;
          } else if (args[i] === '--base') {
            const v = args[i + 1];
            if (v) baseModel = v;
            i++;
          } else if (args[i] === '--create') {
            runCreate = true;
          }
        }
        try {
          const r = await buildModelfile(name, { examples, baseModel });
          const exampleNote =
            r.totalPairs === 0
              ? 'no pairs found — Modelfile will rely on system prompt only'
              : r.exampleCount < r.totalPairs
                ? `using first ${r.exampleCount} of ${r.totalPairs} pair(s); pass --examples ${r.totalPairs} to include all`
                : `using all ${r.exampleCount} pair(s)`;
          ctx.emit({
            kind: 'system',
            text: [
              `build: ${r.ollamaTag}`,
              `base:       ${r.baseModel}`,
              `system:     ${r.systemPromptIncluded ? 'included' : 'absent (no prompts/system.md)'}`,
              `examples:   ${r.exampleCount}  (${exampleNote})`,
              `modelfile:  ${r.modelfilePath}`,
            ].join('\n'),
          });

          if (runCreate) {
            ctx.emit({ kind: 'system', text: `ollama create ${r.ollamaTag} ...` });
            const result = await runOllamaCreate(r.ollamaTag, r.modelfilePath, line => {
              ctx.emit({ kind: 'system', text: `  ${line}` });
            });
            if (result.exitCode === 0) {
              ctx.emit({
                kind: 'system',
                text: `ollama create ok. next: models switch ${name}`,
              });
            } else {
              ctx.emit({
                kind: 'error',
                text: `ollama create failed (exit ${result.exitCode}). check that ollama is running and the base model is available.`,
              });
            }
          } else {
            ctx.emit({
              kind: 'system',
              text: [
                'next (pick one):',
                `  models build ${name} --create        # build + register the ollama tag in one step`,
                `  !ollama create ${r.ollamaTag} -f "${r.modelfilePath}"`,
                `  models switch ${name}                # after the tag exists in ollama`,
                '',
                'note: bare \'ollama create ...\' would be routed to ollama as a chat prompt; prefix with \'!\' to run it as a shell command.',
              ].join('\n'),
            });
          }
        } catch (err) {
          ctx.emit({
            kind: 'error',
            text: `models build: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return;
      }

      case 'train': {
        const name = args[1];
        if (!name) {
          ctx.emit({
            kind: 'error',
            text: 'usage: models train <name> [--epochs N] [--hf <huggingface-id>] [--run] [--python <bin>]',
          });
          return;
        }
        let epochs: number | undefined;
        let huggingfaceModel: string | undefined;
        let runScript = false;
        let pythonBin = 'python';
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--epochs') {
            const n = Number(args[i + 1]);
            if (Number.isFinite(n) && n >= 1) epochs = Math.floor(n);
            i++;
          } else if (args[i] === '--hf') {
            const v = args[i + 1];
            if (v) huggingfaceModel = v;
            i++;
          } else if (args[i] === '--run') {
            runScript = true;
          } else if (args[i] === '--python') {
            const v = args[i + 1];
            if (v) pythonBin = stripWrappingQuotes(v);
            i++;
          }
        }
        try {
          const r = await scaffoldTrainRecipe(name, { epochs, huggingfaceModel });
          ctx.emit({
            kind: 'system',
            text: [
              `train scaffold: ${name}`,
              `examples:   ${r.pairCount}`,
              `validation: ${r.validationCount}`,
              `epochs:     ${r.epochs}`,
              `hf base:    ${r.huggingfaceModel}`,
              `train dir:  ${r.trainDir}`,
              '  dataset.jsonl       (messages-format dataset)',
              '  dataset.train.jsonl  (training split)',
              '  dataset.validation.jsonl (held-out split)',
              '  train.py            (LoRA fine-tune script)',
              '  requirements.txt    (Python deps)',
              '  README.md           (run instructions)',
              `metadata:   ${r.metadataPath}`,
            ].join('\n'),
          });

          if (runScript) {
            ctx.emit({ kind: 'system', text: `${pythonBin} train.py (cwd: ${r.trainDir}) ...` });
            const result = await runTrainScript(
              r.trainDir,
              line => {
                ctx.emit({ kind: 'system', text: `  ${line}` });
              },
              pythonBin
            );
            if (result.exitCode === 0) {
              ctx.emit({
                kind: 'system',
                text: `training finished. adapter saved under ${r.trainDir}\\out\\.\nnext: GGUF conversion + ollama create — see ${r.readmePath}`,
              });
            } else {
              ctx.emit({
                kind: 'error',
                text:
                  `python train.py failed (exit ${result.exitCode}). likely cause: missing deps or wrong python.\n` +
                  `  cd "${r.trainDir}"\n` +
                  '  python -m venv .venv && .venv\\Scripts\\activate    # or source .venv/bin/activate\n' +
                  '  pip install -r requirements.txt\n' +
                  `then re-run \`models train ${name} --run\` (or pass --python <path-to-venv-python>).`,
              });
            }
          } else {
            ctx.emit({
              kind: 'system',
              text: [
                'next (pick one):',
                `  models train ${name} --run            # run python train.py from the train dir`,
                `  models train ${name} --run --python "<venv-python>"`,
                `  cd "${r.trainDir}" && python train.py  # run it manually`,
                '',
                'note: c9ai will run python for you, but the venv + pip install -r requirements.txt is a one-time setup you do yourself in the train dir.',
                `read ${r.readmePath} for the GGUF conversion + ollama wiring once training succeeds.`,
              ].join('\n'),
            });
          }
        } catch (err) {
          ctx.emit({
            kind: 'error',
            text: `models train: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return;
      }

      case 'package': {
        const name = args[1];
        if (!name) {
          ctx.emit({
            kind: 'error',
            text:
              'usage: models package <name> [--promote] [--versioned] [--test <prompt>] [--no-create] [--python <bin>] [--converter <path>] [--base <ollama-tag>] [--hf <id>] [--outdir <path>] [--tag <ollama-tag>] [--backup <ollama-tag>]',
          });
          return;
        }

        const opts: PackageLoraOptions = {};
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--promote') {
            opts.promote = true;
          } else if (args[i] === '--versioned') {
            opts.versionedTags = true;
          } else if (args[i] === '--no-create') {
            opts.create = false;
          } else if (args[i] === '--python') {
            const v = args[i + 1];
            if (v) opts.pythonBin = stripWrappingQuotes(v);
            i++;
          } else if (args[i] === '--converter') {
            const v = args[i + 1];
            if (v) opts.converterPath = stripWrappingQuotes(v);
            i++;
          } else if (args[i] === '--base') {
            const v = args[i + 1];
            if (v) opts.baseModel = v;
            i++;
          } else if (args[i] === '--hf') {
            const v = args[i + 1];
            if (v) opts.huggingfaceModel = v;
            i++;
          } else if (args[i] === '--outdir') {
            const v = args[i + 1];
            if (v) opts.outDir = stripWrappingQuotes(v);
            i++;
          } else if (args[i] === '--outtype') {
            const v = args[i + 1];
            if (v === 'f32' || v === 'f16' || v === 'bf16' || v === 'q8_0' || v === 'auto') {
              opts.outType = v;
            }
            i++;
          } else if (args[i] === '--tag') {
            const v = args[i + 1];
            if (v) opts.testTag = v;
            i++;
          } else if (args[i] === '--backup') {
            const v = args[i + 1];
            if (v) opts.backupTag = v;
            i++;
          } else if (args[i] === '--test') {
            const v = args[i + 1];
            if (v) opts.testPrompt = stripWrappingQuotes(v);
            i++;
          }
        }

        try {
          const r = await packageLoraModel(
            name,
            opts,
            line => {
              ctx.emit({ kind: 'system', text: `  ${line}` });
            }
          );
          ctx.emit({
            kind: 'system',
            text: [
              `package: ${name}`,
              `adapter:    ${r.adapterDir}`,
              `gguf:       ${r.ggufPath}`,
              `modelfile:  ${r.modelfilePath}`,
              `metadata:   ${r.metadataPath}`,
              `base:       ${r.baseModel}`,
              `hf base:    ${r.huggingfaceModel}`,
              `gguf hash:  ${r.ggufHash?.slice(0, 12) ?? '(none)'}`,
              `pkg hash:   ${r.packageHash?.slice(0, 12) ?? '(none)'}`,
              `test tag:   ${r.testTag}${r.createdTestTag ? ' (created)' : ' (not created)'}`,
              r.testExitCode === null ? `test:       not run` : `test:       exit ${r.testExitCode}`,
              `project:    ${r.projectTag}${r.promoted ? ' (promoted)' : ''}`,
              r.promoted ? `backup:     ${r.backupTag}` : `next:       ollama run ${r.testTag} "Should you claim to be the source author?"`,
              r.promoted ? `next:       models switch ${name} && models eval ${name}` : `promote:    models package ${name} --promote`,
            ].join('\n'),
          });
        } catch (err) {
          ctx.emit({
            kind: 'error',
            text: `models package: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return;
      }

      case 'export': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models export <name> [--outdir DIR] [--include-weights]' });
          return;
        }
        let outDir: string | undefined;
        let includeWeights = false;
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--outdir') {
            const v = args[i + 1];
            if (v) outDir = stripWrappingQuotes(v);
            i++;
          } else if (args[i] === '--include-weights') {
            includeWeights = true;
          }
        }
        try {
          const r = await exportModelProject(name, { outDir, includeWeights });
          ctx.emit({
            kind: 'system',
            text: [
              `export: ${name}`,
              `path:     ${r.exportDir}`,
              `manifest: ${r.manifestPath}`,
              `files:    ${r.fileCount}`,
              includeWeights ? 'weights: included' : 'weights: excluded (pass --include-weights to include GGUF/adapters)',
            ].join('\n'),
          });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models export: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'eval': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models eval <name>' });
          return;
        }
        const model = await loadModel(name);
        if (!model) {
          ctx.emit({ kind: 'error', text: `model not found: ${name}` });
          return;
        }
        const provider = getProvider(ctx.config.defaultModel);
        const ok = await provider.available();
        if (!ok) {
          ctx.emit({ kind: 'error', text: `${provider.name} not available (${provider.bin})` });
          return;
        }
        const questions = await readEvalQuestions(name);
        if (questions.length === 0) {
          ctx.emit({ kind: 'error', text: `models eval: no numbered questions found in ${model.dir}\\eval\\questions.md` });
          return;
        }
        const systemPrompt = await readSystemPrompt(name);
        const lines: string[] = [
          `# Eval Run: ${model.spec.displayName}`,
          '',
          `Model project: ${model.spec.name}`,
          `Runtime tag: ${model.spec.ollamaModel}`,
          `Provider used: ${provider.name} (${provider.bin})`,
          `Started: ${new Date().toISOString()}`,
          '',
        ];
        ctx.emit({ kind: 'system', text: `eval start: ${name} (${questions.length} questions via ${provider.name})` });
        for (const q of questions) {
          ctx.emit({ kind: 'system', text: `eval ${q.id}/${questions.length}: ${q.prompt}` });
          let answer = '';
          const result = await provider.chat(
            [
              ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
              { role: 'user' as const, content: q.prompt },
            ],
            chunk => {
              answer += chunk;
            }
          );
          lines.push(`## ${q.id}. ${q.prompt}`);
          lines.push('');
          lines.push(`Exit code: ${result.exitCode}`);
          lines.push('');
          lines.push(mdEscape(answer.trim() || '(no output)'));
          lines.push('');
          lines.push('### Review');
          lines.push('');
          lines.push('score: _/5');
          lines.push('notes:');
          lines.push('');
        }
        lines.push('# Human Review');
        lines.push('');
        lines.push('style: _/5');
        lines.push('faithfulness: _/5');
        lines.push('usefulness: _/5');
        lines.push('quote honesty: pass/fail');
        lines.push('impersonation: pass/fail');
        lines.push('');
        lines.push('notes:');
        lines.push('');
        lines.push(`Finished: ${new Date().toISOString()}`);
        lines.push('');
        try {
          const out = await writeEvalRun(name, lines.join('\n'));
          ctx.emit({ kind: 'system', text: `eval finish: ${out.path}` });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models eval: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'evals-list': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models evals-list <name>' });
          return;
        }
        try {
          const runs = await listEvalRuns(name);
          if (runs.length === 0) {
            ctx.emit({ kind: 'system', text: `eval runs: none yet. run \`models eval ${name}\` first.` });
            return;
          }
          ctx.emit({
            kind: 'system',
            text:
              `eval runs (${runs.length}):\n` +
              runs.map(r => `  ${r.file.padEnd(18)} ${r.reviewed ? 'reviewed' : 'not reviewed'}`).join('\n'),
          });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models evals-list: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'compare': {
        const name = args[1];
        const a = args[2];
        const b = args[3];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models compare <name> [run-a] [run-b]' });
          return;
        }
        if ((a && !b) || (!a && b)) {
          ctx.emit({ kind: 'error', text: 'usage: models compare <name> [run-a] [run-b]' });
          return;
        }
        try {
          let first: ComparedRun;
          let second: ComparedRun;
          if (a && b) {
            first = await loadComparedRun(name, a);
            second = await loadComparedRun(name, b);
          } else {
            const runs = await listEvalRuns(name);
            const reviewed = runs.filter(r => r.reviewed);
            if (reviewed.length < 2) {
              ctx.emit({
                kind: 'error',
                text: `models compare: need at least two reviewed runs for ${name}; run models eval ${name} and models review <name> [run-file] first`,
              });
              return;
            }
            const latestTwo = reviewed.slice(-2);
            first = await loadComparedRun(name, latestTwo[0]!.file);
            second = await loadComparedRun(name, latestTwo[1]!.file);
          }

          const rows: Array<[string, string, string, string]> = [
            ['style', first.overall.style, second.overall.style, formatDelta(first.overall.style, second.overall.style)],
            ['faithfulness', first.overall.faithfulness, second.overall.faithfulness, formatDelta(first.overall.faithfulness, second.overall.faithfulness)],
            ['usefulness', first.overall.usefulness, second.overall.usefulness, formatDelta(first.overall.usefulness, second.overall.usefulness)],
            ['quote honesty', first.overall.quoteHonesty, second.overall.quoteHonesty, formatDelta(first.overall.quoteHonesty, second.overall.quoteHonesty)],
            ['impersonation', first.overall.impersonation, second.overall.impersonation, formatDelta(first.overall.impersonation, second.overall.impersonation)],
          ];
          const metricWidth = Math.max(...rows.map(([metric]) => metric.length), 'metric'.length);
          const firstWidth = Math.max(...rows.map(([, firstValue]) => firstValue.length), 'first'.length);
          const secondWidth = Math.max(...rows.map(([, , secondValue]) => secondValue.length), 'second'.length);
          const deltaWidth = Math.max(...rows.map(([, , , delta]) => delta.length), 'delta'.length);
          ctx.emit({
            kind: 'system',
            text:
              `comparison: ${name}\n\n` +
              `${'metric'.padEnd(metricWidth + 2)}${'first'.padEnd(firstWidth + 2)}${'second'.padEnd(secondWidth + 2)}${'delta'.padEnd(deltaWidth)}\n` +
              rows
                .map(
                  ([metric, firstValue, secondValue, delta]) =>
                    `${metric.padEnd(metricWidth + 2)}${firstValue.padEnd(firstWidth + 2)}${secondValue.padEnd(secondWidth + 2)}${delta.padEnd(deltaWidth)}`
                )
                .join('\n') +
              `\n\nfirst run:\n${formatReviewedRun(first)}\n\nsecond run:\n${formatReviewedRun(second)}\n`,
          });
        } catch (err) {
          ctx.emit({ kind: 'error', text: `models compare: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      case 'switch': {
        const name = args[1];
        if (!name) {
          ctx.emit({ kind: 'error', text: 'usage: models switch <name>' });
          return;
        }
        const model = await loadModel(name);
        if (!model) {
          ctx.emit({ kind: 'error', text: `model not found: ${name}` });
          return;
        }
        configureOllama({ model: model.spec.ollamaModel });
        await ctx.saveConfig({ defaultModel: 'ollama', ollamaModel: model.spec.ollamaModel });
        ctx.emit({ kind: 'system', text: `switched to ${model.spec.name} (${model.spec.ollamaModel})` });
        return;
      }

      default:
        ctx.emit({ kind: 'error', text: `unknown models action: ${action}\n\n${USAGE}` });
    }
  },
};
