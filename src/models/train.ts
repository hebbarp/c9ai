import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadModel, readSystemPrompt } from './registry.js';
import { listPairs } from './pairs.js';
import { sha256File } from './status.js';

export interface TrainScaffoldOptions {
  huggingfaceModel?: string;
  epochs?: number;
}

export interface TrainScaffoldResult {
  trainDir: string;
  datasetPath: string;
  scriptPath: string;
  requirementsPath: string;
  readmePath: string;
  pairCount: number;
  validationCount: number;
  huggingfaceModel: string;
  epochs: number;
  metadataPath: string;
}

const DEFAULT_HF = 'Qwen/Qwen2.5-1.5B-Instruct';
const DEFAULT_EPOCHS = 3;
const DEFAULT_VALIDATION_SPLIT = 0.1;

interface TrainParams {
  epochs: number;
  learningRate: number;
  loraRank: number;
  loraAlpha: number;
  loraDropout: number;
  maxSeqLen: number;
  validationSplit: number;
  perDeviceTrainBatchSize: number;
  gradientAccumulationSteps: number;
  saveTotalLimit: number;
}

interface MessagesRecord {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  source: string;
}

export async function scaffoldTrainRecipe(
  name: string,
  opts: TrainScaffoldOptions = {}
): Promise<TrainScaffoldResult> {
  const model = await loadModel(name);
  if (!model) throw new Error(`model not found: ${name}`);

  const system = (await readSystemPrompt(name)) ?? '';
  const { pairs } = await listPairs(name);
  if (pairs.length === 0) {
    throw new Error(
      `no training pairs for ${name}; run \`models pairs ${name} generate\` first`
    );
  }

  const huggingfaceModel =
    opts.huggingfaceModel ?? model.spec.huggingfaceModel ?? DEFAULT_HF;
  const specTraining = model.spec.training ?? {};
  const params: TrainParams = {
    epochs: Math.max(1, Math.floor(opts.epochs ?? specTraining.epochs ?? DEFAULT_EPOCHS)),
    learningRate: specTraining.learningRate ?? 2e-4,
    loraRank: Math.max(1, Math.floor(specTraining.loraRank ?? 16)),
    loraAlpha: Math.max(1, Math.floor(specTraining.loraAlpha ?? 32)),
    loraDropout: specTraining.loraDropout ?? 0.05,
    maxSeqLen: Math.max(128, Math.floor(specTraining.maxSeqLen ?? 2048)),
    validationSplit: Math.max(0, Math.min(0.5, specTraining.validationSplit ?? DEFAULT_VALIDATION_SPLIT)),
    perDeviceTrainBatchSize: Math.max(1, Math.floor(specTraining.perDeviceTrainBatchSize ?? 1)),
    gradientAccumulationSteps: Math.max(1, Math.floor(specTraining.gradientAccumulationSteps ?? 4)),
    saveTotalLimit: Math.max(1, Math.floor(specTraining.saveTotalLimit ?? 2)),
  };

  const trainDir = path.join(model.dir, 'train');
  await fs.mkdir(trainDir, { recursive: true });

  const datasetPath = path.join(trainDir, 'dataset.jsonl');
  const datasetLines: string[] = [];
  for (const p of pairs) {
    const messages: MessagesRecord['messages'] = [];
    if (system.trim()) messages.push({ role: 'system', content: system.trim() });
    messages.push({ role: 'user', content: p.prompt });
    messages.push({ role: 'assistant', content: p.completion });
    const record: MessagesRecord = { messages, source: p.source };
    datasetLines.push(JSON.stringify(record));
  }
  await fs.writeFile(datasetPath, datasetLines.join('\n') + '\n', 'utf8');
  const validationCount =
    datasetLines.length >= 10 ? Math.max(1, Math.floor(datasetLines.length * params.validationSplit)) : 0;
  const trainLines = validationCount > 0 ? datasetLines.slice(0, -validationCount) : datasetLines;
  const validationLines = validationCount > 0 ? datasetLines.slice(-validationCount) : [];
  await fs.writeFile(path.join(trainDir, 'dataset.train.jsonl'), trainLines.join('\n') + '\n', 'utf8');
  await fs.writeFile(
    path.join(trainDir, 'dataset.validation.jsonl'),
    validationLines.length > 0 ? validationLines.join('\n') + '\n' : '',
    'utf8'
  );

  const scriptPath = path.join(trainDir, 'train.py');
  await fs.writeFile(scriptPath, renderTrainScript(huggingfaceModel, params), 'utf8');

  const requirementsPath = path.join(trainDir, 'requirements.txt');
  await fs.writeFile(requirementsPath, RENDER_REQUIREMENTS, 'utf8');

  const readmePath = path.join(trainDir, 'README.md');
  await fs.writeFile(
    readmePath,
    renderTrainReadme(model.spec.name, model.spec.ollamaModel, model.spec.baseModel, huggingfaceModel, pairs.length, params),
    'utf8'
  );
  const metadataPath = path.join(trainDir, 'metadata.json');
  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        runId: new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14),
        createdAt: new Date().toISOString(),
        model: model.spec.name,
        ollamaModel: model.spec.ollamaModel,
        huggingfaceModel,
        pairCount: pairs.length,
        trainCount: trainLines.length,
        validationCount,
        pairHash: await sha256File(path.join(model.dir, 'pairs', 'pairs.jsonl')),
        params,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return {
    trainDir,
    datasetPath,
    scriptPath,
    requirementsPath,
    readmePath,
    pairCount: pairs.length,
    validationCount,
    huggingfaceModel,
    epochs: params.epochs,
    metadataPath,
  };
}

function renderTrainScript(hfModel: string, params: TrainParams): string {
  return `"""LoRA fine-tune script generated by c9ai.

Run from this directory after installing requirements.txt.
Adjust hyper-parameters as needed.
"""

import json
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

BASE_MODEL = "${hfModel}"
TRAIN_DATASET_PATH = Path(__file__).parent / "dataset.train.jsonl"
VALIDATION_DATASET_PATH = Path(__file__).parent / "dataset.validation.jsonl"
OUTPUT_DIR = Path(__file__).parent / "out"
EPOCHS = ${params.epochs}
MAX_SEQ_LEN = ${params.maxSeqLen}
LEARNING_RATE = ${params.learningRate}
LORA_RANK = ${params.loraRank}
LORA_ALPHA = ${params.loraAlpha}
LORA_DROPOUT = ${params.loraDropout}
PER_DEVICE_BATCH = ${params.perDeviceTrainBatchSize}
GRAD_ACCUM = ${params.gradientAccumulationSteps}
SAVE_TOTAL_LIMIT = ${params.saveTotalLimit}


def load_dataset(path: Path) -> Dataset:
    records = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return Dataset.from_list(records)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"loading tokenizer + model: {BASE_MODEL}")
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        device_map="auto" if torch.cuda.is_available() else None,
    )

    print("configuring LoRA adapter")
    lora = LoraConfig(
        r=16,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules="all-linear",
        task_type="CAUSAL_LM",
    )

    print(f"loading train dataset: {TRAIN_DATASET_PATH}")
    ds = load_dataset(TRAIN_DATASET_PATH)
    print(f"  {len(ds)} examples")
    eval_ds = None
    if VALIDATION_DATASET_PATH.exists() and VALIDATION_DATASET_PATH.read_text(encoding="utf-8").strip():
        print(f"loading validation dataset: {VALIDATION_DATASET_PATH}")
        eval_ds = load_dataset(VALIDATION_DATASET_PATH)
        print(f"  {len(eval_ds)} validation examples")

    args = SFTConfig(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=PER_DEVICE_BATCH,
        gradient_accumulation_steps=GRAD_ACCUM,
        learning_rate=LEARNING_RATE,
        max_length=MAX_SEQ_LEN,
        logging_steps=1,
        eval_strategy="epoch" if eval_ds is not None else "no",
        save_strategy="epoch",
        save_total_limit=SAVE_TOTAL_LIMIT,
        bf16=torch.cuda.is_available(),
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=ds,
        eval_dataset=eval_ds,
        processing_class=tok,
        peft_config=lora,
    )

    print("starting training")
    train_result = trainer.train()
    trainer.save_model(str(OUTPUT_DIR))
    metrics_path = Path(__file__).parent / "metrics.json"
    metrics_path.write_text(
        json.dumps(
            {
                "train_result": getattr(train_result, "metrics", {}),
                "log_history": trainer.state.log_history,
            },
            indent=2,
        )
        + "\\n",
        encoding="utf-8",
    )
    print(f"metrics saved to {metrics_path}")
    print(f"adapter saved to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
`;
}

export interface RunTrainResult {
  exitCode: number;
}

export async function runTrainScript(
  trainDir: string,
  onLine: (line: string) => void,
  pythonBin = 'python'
): Promise<RunTrainResult> {
  return new Promise(resolve => {
    let child;
    try {
      child = spawn(pythonBin, ['train.py'], {
        cwd: trainDir,
        env: {
          ...process.env,
          PYTHONUTF8: process.env.PYTHONUTF8 ?? '1',
          PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? 'utf-8',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      onLine(`error: ${err instanceof Error ? err.message : String(err)}`);
      resolve({ exitCode: 1 });
      return;
    }

    let buffer = '';
    const flushLines = (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (line.trim()) onLine(line);
      }
    };

    child.stdout?.on('data', flushLines);
    child.stderr?.on('data', flushLines);
    child.on('error', err => {
      onLine(`error: ${err.message}`);
      resolve({ exitCode: 1 });
    });
    child.on('close', code => {
      const tail = buffer.replace(/\r/g, '').trim();
      if (tail) onLine(tail);
      resolve({ exitCode: code ?? 0 });
    });
  });
}

const RENDER_REQUIREMENTS = `# LoRA training deps for c9ai-generated train.py
# Pin loosely; tighten once a known-good combination is established.
torch>=2.2
transformers>=4.41
peft>=0.11
trl>=0.14
datasets>=2.18
accelerate>=0.30
`;

function renderTrainReadme(
  projectName: string,
  ollamaTag: string,
  baseModel: string | undefined,
  huggingfaceModel: string,
  pairCount: number,
  params: TrainParams
): string {
  const baseLine = baseModel ?? '(unset)';
  return `# Train recipe — ${projectName}

Generated by c9ai. This folder contains a self-contained Python LoRA
fine-tuning recipe that consumes \`dataset.jsonl\` (built from your
\`pairs/pairs.jsonl\`) and produces a PEFT adapter under \`out/\`.

| | |
|---|---|
| Project | \`${projectName}\` |
| Ollama tag | \`${ollamaTag}\` |
| Base (Ollama) | \`${baseLine}\` |
| Base (HuggingFace) | \`${huggingfaceModel}\` |
| Examples | ${pairCount} |
| Epochs | ${params.epochs} |
| Learning rate | ${params.learningRate} |
| LoRA rank/alpha/dropout | ${params.loraRank}/${params.loraAlpha}/${params.loraDropout} |
| Validation split | ${params.validationSplit} |

## What this is

A real LoRA fine-tune that updates a low-rank adapter on top of the
base model. Different from \`models build\`, which only bakes the
system prompt + few-shot examples into a Modelfile.

## What this isn't

A plug-and-play training pipeline. You will need:

- a working Python environment (3.10+ recommended)
- a CUDA-capable GPU for reasonable throughput on a 1.5B model
  (CPU-only training works but will be very slow)
- bandwidth to pull the base model weights from HuggingFace on first run

c9ai will run \`python train.py\` for you (\`models train ${projectName} --run\`),
but the venv + \`pip install\` is a one-time setup you do here in the
train dir.

## One-time setup

\`\`\`bash
cd "$(dirname "$0")"            # this train/ folder
python -m venv .venv
.venv\\Scripts\\activate          # Windows; use 'source .venv/bin/activate' on macOS/Linux
pip install -r requirements.txt
\`\`\`

## Run training

From inside c9ai:

\`\`\`text
models train ${projectName} --run
models train ${projectName} --run --python "<path-to-venv-python>"
\`\`\`

Or manually:

\`\`\`bash
python train.py
\`\`\`

The adapter is saved to \`./out/\` (PEFT format). Package it for
Ollama with c9ai:

\`\`\`text
models package ${projectName}
ollama run ${ollamaTag.replace(/:latest$/, '')}-lora:latest "Should you claim to be the source author?"
models package ${projectName} --promote
\`\`\`

\`models package\` converts the adapter to GGUF, writes a Modelfile,
and creates a test Ollama tag. \`--promote\` backs up the current
project tag to \`${ollamaTag.replace(/:latest$/, '')}:fewshot\` and
recreates \`${ollamaTag}\` from the LoRA package.

## Convert adapter to GGUF (for Ollama)

Manual fallback: Ollama's \`Modelfile ADAPTER\` directive expects a
GGUF-format adapter. Use llama.cpp's converter. The same Python
environment used for training is usually enough:

\`\`\`powershell
git clone --depth 1 https://github.com/ggml-org/llama.cpp.git external/llama.cpp
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
\`\`\`

If the Hugging Face base model was cached during training, prefer the
local snapshot path:

\`\`\`powershell
$base = "$env:USERPROFILE\\.cache\\huggingface\\hub\\models--Qwen--Qwen2.5-1.5B-Instruct\\snapshots\\<snapshot-id>"
$adapter = "<this-train-folder>\\out"
$python = "<this-train-folder>\\.venv\\Scripts\\python.exe"
& $python external\\llama.cpp\\convert_lora_to_gguf.py --outtype f16 --outfile outputs\\${projectName}-lora\\${projectName}-lora-f16.gguf --base $base $adapter
\`\`\`

If you do not have a local snapshot, try the remote base id:

\`\`\`powershell
& $python external\\llama.cpp\\convert_lora_to_gguf.py --outtype f16 --outfile outputs\\${projectName}-lora\\${projectName}-lora-f16.gguf --base-model-id ${huggingfaceModel} $adapter
\`\`\`

Some Hugging Face repos or network setups may make the remote path
fail. The local snapshot path is more reliable after one successful
training run.

## Wire the adapter into Ollama

Build a fresh Modelfile that uses the adapter:

\`\`\`text
FROM ${baseLine}
ADAPTER D:/path/to/outputs/${projectName}-lora/${projectName}-lora-f16.gguf
SYSTEM """<system prompt>"""
\`\`\`

Create a separate test tag first:

\`\`\`bash
ollama create ${ollamaTag.replace(/:latest$/, '')}-lora:latest -f outputs/${projectName}-lora/Modelfile
ollama run ${ollamaTag.replace(/:latest$/, '')}-lora:latest "Should you claim to be the source author?"
\`\`\`

When it works, preserve the previous few-shot tag and move the project
tag to the LoRA package:

\`\`\`bash
ollama cp ${ollamaTag} ${ollamaTag.replace(/:latest$/, '')}:fewshot
ollama create ${ollamaTag} -f Modelfile
\`\`\`

In c9ai:

\`\`\`text
models switch ${projectName}
models eval ${projectName}
models compare ${projectName}
\`\`\`

## Iterating

- Re-run \`models pairs ${projectName} generate\` after adding more corpus.
- Re-run \`models train ${projectName}\` to refresh \`dataset.jsonl\` (the
  Python script and requirements are overwritten too — keep edits in
  a copy or version-control this folder).
- Tune \`training\` in \`model.json\` and rerun \`models train ${projectName}\`
  to regenerate the recipe.
`;
}
