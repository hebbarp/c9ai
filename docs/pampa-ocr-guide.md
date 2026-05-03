# Pampa OCR and Corpus Extraction Guide

Pampa corpus extraction should prefer local, repeatable processing first, with external AI OCR used only when it clearly adds value.

## Recommended Order

1. **Embedded PDF text / `pdftotext`**
   - Use first for Archive.org PDFs and other PDFs that already contain OCR text.
   - Fast, local, free, and easy to reproduce.
   - Best default for bulk extraction.

2. **Local Tesseract OCR**
   - Use when a PDF is scanned-only or embedded text quality is poor.
   - Keep this local for privacy and reproducibility.
   - `pytesseract` is only the Python wrapper; the machine also needs the Tesseract binary and Kannada trained data such as `kan.traineddata`.

3. **Gemini Vision / Gemini API**
   - Use selectively for hard pages: noisy scans, title pages, tables of contents, mixed layouts, uncertain passages, or quality checks.
   - Do not use as the default bulk OCR engine.
   - Load API keys from local env files without printing them.
   - Treat API use as external processing: review privacy, copyright, cost, and rate-limit implications before sending content.

## Source Policy

- Wikipedia and clearly public-domain or copyright-free Kannada material can be used for training.
- Newspaper articles and blogs are usually copyrighted by default.
- If license or permission is unclear, keep the source out of training. It can be marked `reference-only` or `eval-only` if legally appropriate.

## Provenance Fields

Every extracted document should carry source metadata:

- `source_path` or `source_url`
- `title`
- `author` or editor, if known
- `publisher` or site
- `license`
- `date_accessed`
- `usage`: `train`, `eval`, `reference-only`, or `blocked`
- `extraction_method`: `pdftotext`, `tesseract`, `gemini`, or `manual`
- `quality_notes`

## Practical Rule

Use Gemini as a rescue and QA layer, not the foundation of the corpus pipeline. The main Pampa corpus should be buildable from local files with documented extraction steps.
