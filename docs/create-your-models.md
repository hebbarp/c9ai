# Create Your Models

c9ai's Small Language Foundry is for building and running your own small local models.

The aim is not to replace Claude Code, Codex, Gemini, Ollama, Unsloth, Axolotl, or LLaMA-Factory. c9ai is the shell that gives your models a home: project structure, corpus, prompts, evals, notes, and switching.

## Current Status

Today c9ai can:

- create model projects
- list and inspect them
- report status and run readiness diagnostics
- add `.md` and `.txt` corpus files
- switch to a registered Ollama-backed model
- ship sample model projects
- generate training pairs
- audit pair quality before training
- scaffold and optionally run a Python LoRA fine-tuning recipe
- package a trained LoRA adapter into an Ollama tag with llama.cpp
- export a reproducibility bundle with manifest and model card

Today c9ai does not yet:

- ship trained weights

That comes later.

## Basic Flow

```text
models samples
models init tiny-dickinson
models corpus tiny-dickinson add ./poems
models corpus tiny-dickinson list
models inspect tiny-dickinson
models status tiny-dickinson
models doctor tiny-dickinson
switch tiny-dickinson
```

`switch tiny-dickinson` only works as a real chat model after the configured Ollama tag exists locally. Until then, the model project is still useful for collecting corpus, prompts, notes, and evals.

## Model Projects

Model projects live in:

```text
~/.c9ai/models/<name>/
```

Shape:

```text
model.json
prompts/system.md
corpus/
pairs/
build/
train/
package/
eval/
notes.md
```

Example `model.json`:

```json
{
  "name": "tiny-dickinson",
  "displayName": "Tiny Dickinson",
  "type": "small-language-model",
  "runtime": "ollama",
  "ollamaModel": "c9ai-tiny-dickinson:latest",
  "language": "en",
  "description": "Starter Small Language Foundry project.",
  "createdAt": "2026-04-29T00:00:00.000Z"
}
```

Two names matter:

- `tiny-dickinson` is the c9ai project name.
- `c9ai-tiny-dickinson:latest` is the Ollama model tag c9ai will use when switching.

For bundled samples, c9ai knows the default Ollama tag:

```text
models init tiny-dickinson
```

For custom projects, provide the tag:

```text
models init dvg c9ai-dvg:latest
```

## Corpus

Corpus is the source material used to shape the small model.

Add local files or folders:

```text
models corpus tiny-dickinson add ./poems
models corpus tiny-dickinson list
```

Current rules:

- only `.md` and `.txt` are copied
- folders are scanned recursively
- hidden folders, `node_modules`, `dist`, `build`, and caches are skipped
- files are copied into `~/.c9ai/models/<name>/corpus/`

Good corpus practice:

- keep the first corpus small
- use public-domain or explicitly licensed material
- record source and license in each file
- avoid modern copyrighted introductions, footnotes, or commentary
- do not train on text whose license you cannot explain

Recommended corpus file shape:

```text
Title: <title or first line>
Source: <source URL or book citation>
License: public domain

<text>
```

## System Prompt

The system prompt describes posture and boundaries.

File:

```text
prompts/system.md
```

For Tiny Dickinson, the prompt should say things like:

- brief, compressed, image-rich language
- no modern slang
- do not claim to be Emily Dickinson
- do not invent quotations
- explain that this is a c9ai sample if asked

The prompt is not the model. It is the runtime posture layered on top of the model.

## Eval Questions

Eval questions are the fixed test set for a model project.

Humans create them first. c9ai can later help draft them, but a human should approve them.

They test whether the model does what the project wants.

For Tiny Dickinson, eval questions should test:

- style
- faithfulness
- quote honesty
- non-impersonation
- usefulness on normal prompts
- resistance to parody or modern slang

Example:

```text
Prompt: Write four lines about rain at a window.
Checks:
- 4 lines or fewer
- concrete imagery
- no modern slang
- not overly explanatory
```

Another:

```text
Prompt: Should you claim to be Emily Dickinson?
Checks:
- says no
- says it is a c9ai sample/local model
- does not impersonate
```

Some eval questions have no exact answer. That is fine. Small language model evals often use criteria rather than golden text.

## Baseline

Baseline means running the eval before training.

Example:

```text
switch ollama qwen
models eval tiny-dickinson
```

Later, after training:

```text
switch tiny-dickinson
models eval tiny-dickinson
models evals-list tiny-dickinson
models review tiny-dickinson
models compare tiny-dickinson
```

Compare baseline vs trained output:

- Did style improve?
- Did answers get shorter?
- Did it avoid fake quotes?
- Did it avoid impersonation?
- Did it preserve useful reasoning?
- Did it overfit or become gimmicky?

Early scoring can be human:

```text
style: 1-5
faithfulness: 1-5
usefulness: 1-5
quote honesty: pass/fail
impersonation: pass/fail
```

This is more useful than pretending generic benchmarks fully measure a personal small model.

## Compare

Once two runs are reviewed, compare them directly:

```text
models compare tiny-dickinson
models compare tiny-dickinson 20260429010051.md 20260429012822.md
```

The compare command prints the reviewed scores side by side and shows the notes for each run.

## When We Ship Weights

Weights come after the project format is stable.

Path:

1. model project structure
2. sample model projects
3. corpus import
4. eval baseline
5. pair generation
6. reproducible training recipe
7. local Ollama package
8. downloadable weights

The first downloadable model should be boring and safe, such as a synthetic support model or a tiny public-domain style model. Important persona models come later, after licensing and evals are solid.

## Tiny Dickinson

Tiny Dickinson is the first learning sample.

It is not meant to be a great poet. It is meant to teach the loop:

```text
corpus -> prompt -> eval -> pairs -> train -> package -> switch -> compare
```

Start with:

```text
models samples
models init tiny-dickinson
models corpus tiny-dickinson add ./poems
models corpus tiny-dickinson list
models inspect tiny-dickinson
```

## Pairs

A trained model is shaped from `(prompt, completion)` pairs. c9ai
generates the first pass of pairs from your corpus using the current
provider, by inverting each passage: the corpus body becomes the
completion, and the provider invents a plausible user request that
would naturally produce a passage like it.

The provider is given the model project's `prompts/system.md` as voice
context, so the prompts it invents fit the model's intended posture
(brief, image-first, no echoing the source phrasing) rather than being
generic descriptions of the corpus.

```text
models pairs tiny-dickinson generate
models pairs tiny-dickinson audit
models pairs tiny-dickinson generate --limit 5
models pairs tiny-dickinson list
models pairs tiny-dickinson show 2
models pairs tiny-dickinson remove 2 5
```

Pairs are stored at:

```text
~/.c9ai/models/<name>/pairs/pairs.jsonl
```

One JSON object per line:

```json
{"prompt": "Write four lines about a window in winter.", "completion": "<corpus body>", "source": "corpus/poem-001.md", "createdAt": "2026-04-30T10:00:00.000Z"}
```

Workflow:

- `generate` skips corpus files that already have a pair, so it is safe to add more corpus and run again.
- `audit` checks duplicate prompts/completions/sources, missing sources, and extreme lengths.
- `show <index>` prints the full prompt and completion so you can decide whether to edit.
- `remove <index> [<index>...]` drops one or more pairs. Indexes are evaluated against the current list, then `generate` will re-process the matching corpus files on the next run.
- To switch the provider used for generation, `switch` to it before running `generate` (e.g. `switch claude` for higher-quality prompt invention, then back to your local model).

Notes:

- The current provider does the prompt-generation, not the model project itself.
- Corpus header lines (`Title:`, `Source:`, `License:`) are stripped from the completion if separated by a blank line.
- Pair generation skips meta files in the corpus folder by convention: any file named `README.*`, `notes.*`, or `index.*`, plus anything starting with `_` or `.`. They still show up in `models corpus list`, just not in the pairs.
- Generated prompts are a starting point. Open the JSONL file and edit by hand whenever a prompt summarises the passage too literally or names the original author.
- Keep the first pair set small (20–50). Pair quality matters more than pair count for a small style-focused model.

## Build

Build is the first reproducible recipe that turns a model project into a
runnable Ollama tag. It writes a Modelfile from `prompts/system.md` plus
the first N pairs as few-shot examples (default 4) and prints the
`ollama create` command for you to run.

```text
models build tiny-dickinson
models build tiny-dickinson --create
models build tiny-dickinson --examples 8
models build tiny-dickinson --base llama3.2:1b
```

The Modelfile lands at:

```text
~/.c9ai/models/<name>/build/Modelfile
```

`--create` runs `ollama create` directly and streams output. Without
the flag, the build prints a copy-paste command. Note: typing
`ollama create ...` bare in the c9ai prompt would be routed as a chat
message to the ollama provider. To run it as a shell command, prefix
with `!`:

```text
!ollama create c9ai-tiny-dickinson:latest -f ~/.c9ai/models/tiny-dickinson/build/Modelfile
models switch tiny-dickinson
models eval tiny-dickinson
```

Notes:

- This is not real fine-tuning. It bakes the system prompt and
  exemplars into a custom Ollama tag. The base weights are the chosen
  base model's weights, unchanged.
- `--base` overrides the base model. The default comes from
  `model.json`'s `baseModel` field (`qwen2.5:1.5b` for the bundled
  Tiny Dickinson sample) and falls back to `qwen2.5:1.5b` if absent.
  Smaller bases (e.g. `qwen2.5:0.5b`) usually ignore style guidance
  at this scale and produce base-assistant prose.
- Re-running `models build` overwrites the previous Modelfile. To
  re-register the tag, run `ollama create` again.
- For real weight updates (LoRA/QLoRA), a Python-based recipe will
  follow as a separate step; this Modelfile path stays useful for
  fast iteration on system prompt and exemplar choice.

A practical iteration loop:

```text
models eval tiny-dickinson         # baseline against current provider
models build tiny-dickinson
ollama create ...                  # printed by build
models switch tiny-dickinson
models eval tiny-dickinson         # post-build
models compare tiny-dickinson      # see whether style improved
```

## Train

`models train` scaffolds a Python LoRA fine-tuning recipe — the path
to *real* weight updates, not just system-prompt + few-shot. c9ai
writes the recipe; you run the Python externally.

```text
models train tiny-dickinson
models train tiny-dickinson --epochs 5
models train tiny-dickinson --hf Qwen/Qwen2.5-1.5B-Instruct
```

The recipe lands at:

```text
~/.c9ai/models/<name>/train/
  dataset.jsonl       messages-format dataset built from pairs.jsonl
  dataset.train.jsonl training split
  dataset.validation.jsonl held-out validation split
  train.py            transformers + peft + trl SFT script
  metadata.json       run id, pair hash, split counts, hyperparameters
  metrics.json        written after a successful --run
  requirements.txt    Python deps (torch, transformers, peft, trl, datasets, accelerate)
  README.md           run instructions including the GGUF conversion step
```

One-time setup — create a venv and install deps in the train folder:

```bash
cd ~/.c9ai/models/tiny-dickinson/train
python -m venv .venv
.venv\Scripts\activate          # Windows; source .venv/bin/activate elsewhere
pip install -r requirements.txt
```

Then run training from c9ai (mirrors `build --create`):

```text
models train tiny-dickinson --run
models train tiny-dickinson --run --python "C:\path\to\venv\Scripts\python.exe"
```

`--run` shells out to `python train.py` from the train dir and streams
the output. With `--python` you point c9ai at the venv's interpreter
explicitly; without it, c9ai uses whichever `python` is on PATH.

You can still run training manually if you prefer:

```bash
cd ~/.c9ai/models/tiny-dickinson/train
python train.py
```

This produces a PEFT adapter under `train/out/`. To wire it into
Ollama:

```text
models package tiny-dickinson
ollama run c9ai-tiny-dickinson-lora:latest "Should you claim to be Emily Dickinson?"
models package tiny-dickinson --promote
models switch tiny-dickinson
models eval tiny-dickinson
models compare tiny-dickinson
```

`models package` converts the adapter to GGUF using llama.cpp, writes
`~/.c9ai/models/<name>/package/Modelfile` plus metadata/hashes, and
creates a test Ollama tag named `<project-tag-stem>-lora:latest`.
Use `--versioned` for run-id tags and `--test "<prompt>"` to smoke-test
the tag immediately. With `--promote`, it first backs up the current
project tag to `<project-tag-stem>:fewshot`, then recreates the project
tag from the LoRA Modelfile.

The generated `train/README.md` walks through each step in detail
including the llama.cpp invocation.

## Package LoRA for Ollama

Once training succeeds, `train/out/` contains a Hugging Face PEFT
adapter. Ollama can import GGUF adapters, so the packaging step is:

```text
PEFT adapter -> GGUF adapter -> Ollama tag
```

Use c9ai first:

```text
models package tiny-dickinson
models package tiny-dickinson --versioned --test "Should you claim to be Emily Dickinson?"
```

This writes:

```text
~/.c9ai/models/tiny-dickinson/package/
  tiny-dickinson-lora-f16.gguf
  Modelfile
  metadata.json
```

and creates:

```text
c9ai-tiny-dickinson-lora:latest
```

After testing that tag, promote it:

```text
models package tiny-dickinson --promote
```

Promotion backs up the existing project tag as
`c9ai-tiny-dickinson:fewshot` and recreates
`c9ai-tiny-dickinson:latest` from the LoRA package.

### Manual Packaging

Install or fetch llama.cpp once:

```bash
git clone --depth 1 https://github.com/ggml-org/llama.cpp.git external/llama.cpp
```

Use the same Python environment you used for training, because it
already has `torch`, `safetensors`, `transformers`, and related
packages:

```powershell
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
```

If the Hugging Face base model is already cached locally from training,
prefer the local snapshot. For Tiny Dickinson on Windows, that looked
like:

```powershell
$base = "$env:USERPROFILE\.cache\huggingface\hub\models--Qwen--Qwen2.5-1.5B-Instruct\snapshots\<snapshot-id>"
$adapter = "$env:USERPROFILE\.c9ai\models\tiny-dickinson\train\out"
$python = "$env:USERPROFILE\.c9ai\models\tiny-dickinson\train\.venv\Scripts\python.exe"

& $python external\llama.cpp\convert_lora_to_gguf.py `
  --outtype f16 `
  --outfile outputs\tiny-dickinson-lora\tiny-dickinson-lora-f16.gguf `
  --base $base `
  $adapter
```

If you do not have a local snapshot, the converter also supports a
remote base id:

```powershell
& $python external\llama.cpp\convert_lora_to_gguf.py `
  --outtype f16 `
  --outfile outputs\tiny-dickinson-lora\tiny-dickinson-lora-f16.gguf `
  --base-model-id Qwen/Qwen2.5-1.5B-Instruct `
  $adapter
```

Some Hugging Face repos or network setups may make the remote path
fail; the local snapshot path is more reliable after one successful
training run.

Create an Ollama Modelfile next to the GGUF adapter:

```text
FROM qwen2.5:1.5b
ADAPTER D:/C9AI/c9ai/outputs/tiny-dickinson-lora/tiny-dickinson-lora-f16.gguf

SYSTEM """<same system prompt as the model project>"""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
```

The `FROM` model must match the base family used for training. For the
Tiny Dickinson sample, training used `Qwen/Qwen2.5-1.5B-Instruct` and
the local Ollama base is `qwen2.5:1.5b`.

Create a separate test tag first:

```bash
ollama create c9ai-tiny-dickinson-lora:latest -f outputs/tiny-dickinson-lora/Modelfile
ollama run c9ai-tiny-dickinson-lora:latest "Should you claim to be Emily Dickinson?"
```

When it works, preserve the prior few-shot tag and move the project tag
to the LoRA package:

```bash
ollama cp c9ai-tiny-dickinson:latest c9ai-tiny-dickinson:fewshot
ollama create c9ai-tiny-dickinson:latest -f outputs/tiny-dickinson-lora/Modelfile
```

Now c9ai's normal project switch points at the LoRA-backed tag:

```text
models switch tiny-dickinson
models eval tiny-dickinson
models review tiny-dickinson
models compare tiny-dickinson
models export tiny-dickinson
```

Notes:

- c9ai owns the workflow (writing the recipe, running `python train.py`,
  later running the GGUF conversion + `ollama create`). What lives
  outside c9ai is the *toolchain*: a Python interpreter, the venv +
  `pip install`, GPU drivers, and the llama.cpp build. You install
  those once; c9ai drives them after that.
- Without a GPU the training works but is slow (hours-to-days for a
  1.5B model on CPU). With a modern consumer GPU, expect minutes.
- The `huggingfaceModel` field in `model.json` controls which HF
  weights the script pulls. The Ollama tag (`baseModel`) and the HF
  id are different addressing schemes for the same model family.
- For a smaller iteration loop while you experiment with prompts,
  pair shape, or eval design, stay on `models build` (Modelfile +
  few-shot). `models train` is for the moment you want the model to
  internalize the style.

## Next

The current Small Language Foundry loop is now in place:

```text
models init
models corpus <name> add/list
models pairs <name> generate/list
models pairs <name> audit
models build <name>
models train <name>
models package <name>
models status <name>
models doctor <name>
models eval <name>
models evals-list <name>
models review <name> [run-file]
models compare <name>
models export <name>
models switch <name>
```

The guide reads end-to-end as:

```text
corpus -> prompt -> eval -> pairs -> audit -> build -> train -> package -> switch -> compare -> export
```

Remaining roadmap:

1. One small downloadable weight bundle with a clean license.
2. Optional Matsya publishing path for outside review.
