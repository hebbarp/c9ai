# Pampa Corpus Pipeline

This is the working path for turning local Pampa source material into a reviewed corpus for tokenizer and model experiments.

## Current Seed Folder

Local source folder:

```powershell
D:\karavebooks\pampa
```

Current contents:

- 5 PDF files, about 185 MB total.
- `PAMPA_NOTES.md` with research notes and Archive.org source URLs.

## Audit First

Run the audit without PDF extraction:

```powershell
npm run pampa:audit -- --no-pdf-tools
```

Run the audit with PDF metadata/text sampling when `pdfinfo` and `pdftotext` are available:

```powershell
npm run pampa:audit
```

Useful options:

```powershell
npm run pampa:audit -- --input D:\karavebooks\pampa --out outputs\pampa-corpus-audit
npm run pampa:audit -- --sample-pages 5
```

The audit writes:

```text
outputs/pampa-corpus-audit/
  manifest.jsonl
  manifest.pretty.json
  report.md
  samples/
```

## Manifest Review

Each manifest row is intentionally conservative. PDFs start as:

```json
"usage": "needs-review",
"license": "unknown"
```

Promote a source to `train` only after checking license/provenance. If license is unclear, use `reference-only`, `eval-only`, or `blocked`.

## Extraction Plan

1. Use `pdftotext` samples to see which PDFs already contain usable Kannada text.
2. For scanned or poor-quality pages, try local Tesseract OCR with Kannada trained data.
3. Use Gemini only for difficult pages or QA, not bulk OCR.
4. Convert approved text into provenance-rich JSONL.
5. Run Pampa's existing text processor and maatra annotator.
6. Train/evaluate tokenizer variants before model training.

## Extract Review Candidates

After a successful audit with PDF sampling, extract page-level candidate documents:

```powershell
npm run pampa:extract
```

Useful options:

```powershell
npm run pampa:extract -- --manifest outputs\pampa-corpus-audit\manifest.jsonl
npm run pampa:extract -- --min-kannada-chars 50
```

The extraction step reads only PDFs that the audit marked `kannada-text-present`. It writes:

```text
outputs/pampa-corpus-extract/
  documents.jsonl
  documents.pretty.json
  report.md
```

The output is still a review candidate set. It preserves the manifest's `usage` and `license` values; it does not promote anything to training data.

The default extraction threshold is `--min-kannada-chars 100` per page to avoid most title-page/front-matter OCR noise. Lower it only when reviewing short passages manually.

## Annotate For Training

After extraction, annotate records with Pampa akshara/maatra metadata:

```powershell
npm run pampa:annotate
```

Useful options:

```powershell
npm run pampa:annotate -- --input outputs\pampa-corpus-extract\documents.jsonl
npm run pampa:annotate -- --usage train
npm run pampa:annotate -- --limit 25
```

The annotation step writes:

```text
outputs/pampa-corpus-annotated/
  annotated.jsonl
  report.md
```

Records include:

- raw extracted text
- cleaned text with line breaks preserved
- source provenance
- akshara list
- maatra list
- maatra pattern
- aggregate stats

The default usage is `train` because this local corpus is now being treated as the first Pampa training corpus.

## Prepare Train/Eval Corpus

Merge annotated sources, deduplicate by normalized text hash, and create deterministic train/eval splits:

```powershell
npm run pampa:prepare
```

Useful options:

```powershell
npm run pampa:prepare -- --eval-ratio 0.10 --seed 902
npm run pampa:prepare -- --input outputs\pampa-corpus-annotated\annotated.jsonl --input outputs\pampa-adipurana-narasimha-annotated\annotated.jsonl
```

The preparation step writes:

```text
outputs/pampa-training-corpus/
  train.jsonl
  eval.jsonl
  train.txt
  eval.txt
  manifest.json
  report.md
```

Use `train.jsonl` / `eval.jsonl` when the tokenizer or model code needs source/prosody metadata. Use `train.txt` / `eval.txt` for plain text tokenizer experiments.

## Benchmark Tokenizer Streams

Measure the current corpus and export akshara/maatra streams:

```powershell
npm run pampa:tokenizer-bench
```

Useful options:

```powershell
npm run pampa:tokenizer-bench -- --train outputs\pampa-training-corpus\train.jsonl --eval outputs\pampa-training-corpus\eval.jsonl
```

The benchmark writes:

```text
outputs/pampa-tokenizer-bench/
  stats.json
  report.md
  akshara_vocab.json
  akshara_train.txt
  akshara_eval.txt
  maatra_train.txt
  maatra_eval.txt
  akshara_maatra_train.jsonl
  akshara_maatra_eval.jsonl
```

This does not train a tokenizer yet. It measures the text/akshara/prosody shape and exports deterministic streams for the next tokenizer experiment.

## Train Tiny LM Baseline

Train a small akshara-level GRU language model with PyTorch:

```powershell
npm run pampa:train-tiny
```

Useful smoke-test option:

```powershell
npm run pampa:train-tiny -- --max-steps 20 --out outputs\pampa-tiny-lm-smoke
```

Default output:

```text
outputs/pampa-tiny-lm/
  pampa_tokenizer.json
  pampa_tiny_lm.pt
  config.json
  metrics.jsonl
  samples.jsonl
  report.md
```

This is the first Pampa language-model experiment. It is an akshara-level baseline, not a chat/instruction model.
The trainer uses `train.jsonl` / `eval.jsonl` by default and preserves word/newline boundaries as `<sp>` and `<nl>` tokens.

## Use In c9ai

After restarting c9ai or rebuilding the app, the tiny baseline is available as a local command:

```text
pampa status
pampa sample ಪಂಪ
pampa sample --tokens 80 --temperature 0.8 ಪಂಪ
```

This command calls `scripts/pampa_generate.py` against `outputs/pampa-tiny-lm/`. It is for sampling the tiny akshara LM, not for chat.

## First Audit Result

The first no-PDF-tools audit completed successfully:

```text
files: 6
out: D:\C9AI\c9ai\outputs\pampa-corpus-audit
```

Because it skipped PDF tools, the next meaningful pass is PDF text sampling. On Windows, MiKTeX's `pdftotext` may need normal filesystem access so it can write its own logs.

The first PDF sampling pass found:

- 3 Pampa Bharata PDFs with embedded Kannada text.
- 2 Adipurana PDFs with no extractable embedded text; these need OCR.
