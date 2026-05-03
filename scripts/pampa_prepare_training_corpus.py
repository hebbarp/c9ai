#!/usr/bin/env python
"""Merge annotated Pampa corpora and create train/eval splits."""

from __future__ import annotations

import argparse
import hashlib
import json
import random
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


DEFAULT_INPUTS = [
    Path("outputs/pampa-corpus-annotated/annotated.jsonl"),
    Path("outputs/pampa-adipurana-narasimha-annotated/annotated.jsonl"),
]
DEFAULT_OUT = Path("outputs/pampa-training-corpus")
WS_RE = re.compile(r"\s+")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare merged Pampa training corpus.")
    parser.add_argument(
        "--input",
        action="append",
        default=[],
        help="Annotated JSONL input. May be passed multiple times. Defaults to current Pampa outputs.",
    )
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output directory")
    parser.add_argument("--eval-ratio", type=float, default=0.10, help="Eval split ratio. Default: 0.10")
    parser.add_argument("--seed", type=int, default=902, help="Deterministic shuffle seed. Default: 902")
    parser.add_argument(
        "--min-kannada-chars",
        type=int,
        default=100,
        help="Drop records below this Kannada char count. Default: 100",
    )
    return parser.parse_args()


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


def normalize_for_hash(text: str) -> str:
    return WS_RE.sub(" ", (text or "").strip())


def text_hash(text: str) -> str:
    return hashlib.sha256(normalize_for_hash(text).encode("utf-8")).hexdigest()


def record_sort_key(record: Dict[str, Any]) -> Tuple[str, int, str]:
    source = record.get("source") or {}
    return (
        str(source.get("relative_path") or ""),
        int(source.get("page") or 0),
        str(record.get("id") or ""),
    )


def read_and_dedupe(paths: List[Path], min_kannada_chars: int) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    seen: Dict[str, str] = {}
    records: List[Dict[str, Any]] = []
    stats = {
        "input_files": [str(p) for p in paths],
        "records_read": 0,
        "records_kept": 0,
        "duplicates_dropped": 0,
        "low_kannada_dropped": 0,
        "missing_inputs": [],
    }

    for path in paths:
        if not path.exists():
            stats["missing_inputs"].append(str(path))
            continue
        for record in load_jsonl(path):
            stats["records_read"] += 1
            cleaned = record.get("cleaned_text") or record.get("text") or ""
            kannada_chars = int((record.get("stats") or {}).get("kannada_chars") or 0)
            if kannada_chars < min_kannada_chars:
                stats["low_kannada_dropped"] += 1
                continue
            digest = text_hash(cleaned)
            if digest in seen:
                stats["duplicates_dropped"] += 1
                continue
            record["corpus_hash"] = digest
            seen[digest] = str(record.get("id") or "")
            records.append(record)

    records.sort(key=record_sort_key)
    stats["records_kept"] = len(records)
    return records, stats


def split_records(records: List[Dict[str, Any]], eval_ratio: float, seed: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    if not 0 <= eval_ratio < 1:
        raise ValueError("--eval-ratio must be >= 0 and < 1")
    shuffled = list(records)
    rng = random.Random(seed)
    rng.shuffle(shuffled)
    eval_count = int(round(len(shuffled) * eval_ratio))
    eval_records = sorted(shuffled[:eval_count], key=record_sort_key)
    train_records = sorted(shuffled[eval_count:], key=record_sort_key)
    return train_records, eval_records


def write_jsonl(path: Path, records: Iterable[Dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            count += 1
    return count


def write_text(path: Path, records: Iterable[Dict[str, Any]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8", newline="\n") as fh:
        for record in records:
            text = (record.get("cleaned_text") or record.get("text") or "").strip()
            if not text:
                continue
            fh.write(text)
            fh.write("\n\n<|pampa_doc_sep|>\n\n")
            count += 1
    return count


def aggregate(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_work = Counter()
    by_source = Counter()
    total_chars = 0
    kannada_chars = 0
    aksharas = 0
    maatras = 0

    for record in records:
        source = record.get("source") or {}
        stats = record.get("stats") or {}
        by_work[str(source.get("work") or "unknown")] += 1
        by_source[str(source.get("relative_path") or source.get("source_path") or "unknown")] += 1
        total_chars += int(stats.get("chars") or 0)
        kannada_chars += int(stats.get("kannada_chars") or 0)
        aksharas += int(stats.get("akshara_count") or 0)
        maatras += int(stats.get("total_maatras") or 0)

    return {
        "records": len(records),
        "total_chars": total_chars,
        "kannada_chars": kannada_chars,
        "aksharas": aksharas,
        "maatras": maatras,
        "avg_chars": round(total_chars / len(records), 2) if records else 0,
        "avg_kannada_chars": round(kannada_chars / len(records), 2) if records else 0,
        "by_work": dict(sorted(by_work.items())),
        "by_source": dict(sorted(by_source.items())),
    }


def write_manifest(out_dir: Path, args: argparse.Namespace, read_stats: Dict[str, Any], train: List[Dict[str, Any]], eval_: List[Dict[str, Any]]) -> Dict[str, Any]:
    all_records = train + eval_
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "inputs": read_stats["input_files"],
        "out_dir": str(out_dir.resolve()),
        "seed": args.seed,
        "eval_ratio": args.eval_ratio,
        "min_kannada_chars": args.min_kannada_chars,
        "read": read_stats,
        "all": aggregate(all_records),
        "train": aggregate(train),
        "eval": aggregate(eval_),
        "files": {
            "train_jsonl": "train.jsonl",
            "eval_jsonl": "eval.jsonl",
            "train_text": "train.txt",
            "eval_text": "eval.txt",
            "manifest": "manifest.json",
            "report": "report.md",
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_report(out_dir: Path, manifest: Dict[str, Any]) -> None:
    lines = [
        "# Pampa Training Corpus",
        "",
        f"Generated: {manifest['created_at']}",
        "",
        "## Summary",
        "",
        f"- Records read: {manifest['read']['records_read']}",
        f"- Records kept after dedupe/filter: {manifest['read']['records_kept']}",
        f"- Duplicates dropped: {manifest['read']['duplicates_dropped']}",
        f"- Low-Kannada records dropped: {manifest['read']['low_kannada_dropped']}",
        f"- Train records: {manifest['train']['records']}",
        f"- Eval records: {manifest['eval']['records']}",
        f"- Total Kannada chars: {manifest['all']['kannada_chars']}",
        f"- Total aksharas: {manifest['all']['aksharas']}",
        f"- Total maatras: {manifest['all']['maatras']}",
        "",
        "## Sources",
        "",
    ]
    for source, count in manifest["all"]["by_source"].items():
        lines.append(f"- {source}: {count}")
    lines.extend([
        "",
        "## Outputs",
        "",
        "- `train.jsonl` / `eval.jsonl`: full annotated records.",
        "- `train.txt` / `eval.txt`: cleaned text-only exports for tokenizer experiments.",
        "- `manifest.json`: machine-readable stats and split metadata.",
        "",
        "The split is deterministic from the configured seed.",
    ])
    (out_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    inputs = [Path(p) for p in args.input] if args.input else DEFAULT_INPUTS
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    records, read_stats = read_and_dedupe(inputs, args.min_kannada_chars)
    if read_stats["missing_inputs"]:
        print(f"warning: missing inputs: {read_stats['missing_inputs']}", file=sys.stderr)
    if not records:
        raise RuntimeError("No records available after filtering")

    train, eval_ = split_records(records, args.eval_ratio, args.seed)
    write_jsonl(out_dir / "train.jsonl", train)
    write_jsonl(out_dir / "eval.jsonl", eval_)
    write_text(out_dir / "train.txt", train)
    write_text(out_dir / "eval.txt", eval_)
    manifest = write_manifest(out_dir, args, read_stats, train, eval_)
    write_report(out_dir, manifest)

    print("Pampa training corpus prepared")
    print(f"records: {manifest['all']['records']}")
    print(f"train: {manifest['train']['records']}")
    print(f"eval: {manifest['eval']['records']}")
    print(f"out: {out_dir.resolve()}")
    print(f"report: {(out_dir / 'report.md').resolve()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_prepare_training_corpus: {exc}", file=sys.stderr)
        raise SystemExit(1)
