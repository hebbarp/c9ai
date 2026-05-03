#!/usr/bin/env python
"""Annotate extracted Pampa corpus JSONL with akshara/maatra metadata."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List


DEFAULT_INPUT = Path("outputs/pampa-corpus-extract/documents.jsonl")
DEFAULT_OUT = Path("outputs/pampa-corpus-annotated")
DEFAULT_PAMPA_ROOT = Path("D:/pampa")


URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
HORIZONTAL_WS_RE = re.compile(r"[ \t]+")
BLANK_LINES_RE = re.compile(r"\n{4,}")
KANNADA_RE = re.compile(r"[\u0C80-\u0CFF]")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Annotate Pampa corpus JSONL.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input documents.jsonl")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output directory")
    parser.add_argument("--pampa-root", default=str(DEFAULT_PAMPA_ROOT), help="Pampa project root")
    parser.add_argument("--usage", default="train", help="Usage value to write into output records")
    parser.add_argument(
        "--min-kannada-chars",
        type=int,
        default=100,
        help="Skip records below this Kannada character count",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Annotate only the first N kept records; 0 means all",
    )
    return parser.parse_args()


def setup_pampa(root: Path) -> None:
    if not root.exists():
        raise FileNotFoundError(f"Pampa root not found: {root}")
    sys.path.insert(0, str(root))


def load_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL at {path}:{line_no}: {exc}") from exc


def count_kannada(text: str) -> int:
    return len(KANNADA_RE.findall(text))


def clean_text_preserve_lines(text: str) -> str:
    text = unicodedata.normalize("NFC", text or "")
    text = URL_RE.sub(" ", text)
    text = EMAIL_RE.sub(" ", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = "\n".join(HORIZONTAL_WS_RE.sub(" ", line).strip() for line in text.split("\n"))
    text = BLANK_LINES_RE.sub("\n\n\n", text)
    return text.strip()


def build_record(doc: Dict[str, Any], annotation: Any, cleaned_text: str, usage: str) -> Dict[str, Any]:
    aksharas: List[str] = list(annotation.aksharas)
    maatras: List[int] = list(annotation.maatras)
    source = {
        "source_path": doc.get("source_path"),
        "relative_path": doc.get("relative_path"),
        "source_url": doc.get("source_url"),
        "source_title": doc.get("source_title"),
        "work": doc.get("work"),
        "page": doc.get("page"),
        "page_count": doc.get("page_count"),
        "author_or_editor": doc.get("author_or_editor"),
        "publisher": doc.get("publisher"),
        "date_accessed": doc.get("date_accessed"),
        "extraction_method": doc.get("extraction_method"),
        "extraction_quality": doc.get("extraction_quality"),
    }
    return {
        "id": doc.get("id"),
        "usage": usage,
        "license": doc.get("license", "unknown"),
        "text": doc.get("text", ""),
        "cleaned_text": cleaned_text,
        "source": source,
        "stats": {
            "chars": len(cleaned_text),
            "kannada_chars": count_kannada(cleaned_text),
            "line_count": len([line for line in cleaned_text.split("\n") if line.strip()]),
            "word_count": annotation.word_count,
            "akshara_count": annotation.akshara_count,
            "total_maatras": annotation.total_maatras,
        },
        "prosody": {
            "script": annotation.script,
            "aksharas": aksharas,
            "maatras": maatras,
            "maatra_pattern": annotation.maatra_pattern,
        },
        "annotated_at": datetime.now(timezone.utc).isoformat(),
    }


def write_jsonl(path: Path, records: Iterable[Dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    return count


def write_report(out_dir: Path, args: argparse.Namespace, stats: Dict[str, Any]) -> None:
    lines = [
        "# Pampa Corpus Annotation",
        "",
        f"Input: `{Path(args.input).resolve()}`",
        f"Pampa root: `{Path(args.pampa_root).resolve()}`",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Summary",
        "",
        f"- Records read: {stats['read']}",
        f"- Records written: {stats['written']}",
        f"- Skipped low Kannada text: {stats['skipped_low_kannada']}",
        f"- Usage written: `{args.usage}`",
        f"- Min Kannada chars: {args.min_kannada_chars}",
        f"- Total chars: {stats['chars']}",
        f"- Kannada chars: {stats['kannada_chars']}",
        f"- Aksharas: {stats['aksharas']}",
        f"- Maatras: {stats['maatras']}",
        "",
        "## Outputs",
        "",
        "- `annotated.jsonl`",
        "- `report.md`",
        "",
        "The records keep source provenance and include raw text, cleaned text, and Pampa akshara/maatra metadata.",
    ]
    (out_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    out_dir = Path(args.out)
    pampa_root = Path(args.pampa_root)

    setup_pampa(pampa_root)
    from pipeline.annotator import MaatraAnnotator  # type: ignore

    if not input_path.exists():
        raise FileNotFoundError(f"Input JSONL not found: {input_path}")

    out_dir.mkdir(parents=True, exist_ok=True)
    annotator = MaatraAnnotator()
    output_path = out_dir / "annotated.jsonl"

    stats: Dict[str, Any] = {
        "read": 0,
        "written": 0,
        "skipped_low_kannada": 0,
        "chars": 0,
        "kannada_chars": 0,
        "aksharas": 0,
        "maatras": 0,
    }

    def records() -> Iterable[Dict[str, Any]]:
        for doc in load_jsonl(input_path):
            stats["read"] += 1
            cleaned = clean_text_preserve_lines(doc.get("text", ""))
            kannada_chars = count_kannada(cleaned)
            if kannada_chars < args.min_kannada_chars:
                stats["skipped_low_kannada"] += 1
                continue
            annotation = annotator.annotate(cleaned)
            record = build_record(doc, annotation, cleaned, args.usage)
            stats["chars"] += record["stats"]["chars"]
            stats["kannada_chars"] += record["stats"]["kannada_chars"]
            stats["aksharas"] += record["stats"]["akshara_count"]
            stats["maatras"] += record["stats"]["total_maatras"]
            yield record
            if args.limit and stats["written"] >= args.limit:
                break

    def counted_records() -> Iterable[Dict[str, Any]]:
        for record in records():
            stats["written"] += 1
            yield record

    write_jsonl(output_path, counted_records())
    write_report(out_dir, args, stats)

    print("Pampa corpus annotation complete")
    print(f"records: {stats['written']}")
    print(f"out: {out_dir.resolve()}")
    print(f"report: {(out_dir / 'report.md').resolve()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_annotate: {exc}", file=sys.stderr)
        raise SystemExit(1)
