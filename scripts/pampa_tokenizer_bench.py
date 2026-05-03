#!/usr/bin/env python
"""Benchmark and export Pampa akshara/prosody token streams."""

from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple


DEFAULT_TRAIN = Path("outputs/pampa-training-corpus/train.jsonl")
DEFAULT_EVAL = Path("outputs/pampa-training-corpus/eval.jsonl")
DEFAULT_OUT = Path("outputs/pampa-tokenizer-bench")
DOC_SEP = "<|pampa_doc_sep|>"
WS_RE = re.compile(r"\s+")
KANNADA_RE = re.compile(r"[\u0C80-\u0CFF]")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark Pampa tokenizer streams.")
    parser.add_argument("--train", default=str(DEFAULT_TRAIN), help="Prepared train JSONL")
    parser.add_argument("--eval", default=str(DEFAULT_EVAL), help="Prepared eval JSONL")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output directory")
    parser.add_argument(
        "--top",
        type=int,
        default=80,
        help="Number of top aksharas/maatra patterns to include. Default: 80",
    )
    return parser.parse_args()


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    records = []
    with path.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL at {path}:{line_no}: {exc}") from exc
    return records


def non_ws(text: str) -> str:
    return WS_RE.sub("", text or "")


def count_kannada(text: str) -> int:
    return len(KANNADA_RE.findall(text or ""))


def safe_div(num: float, den: float) -> float:
    return num / den if den else 0.0


def quantiles(values: List[int]) -> Dict[str, float]:
    if not values:
        return {"min": 0, "p50": 0, "p90": 0, "p95": 0, "max": 0, "avg": 0}
    values_sorted = sorted(values)

    def percentile(p: float) -> float:
        idx = round((len(values_sorted) - 1) * p)
        return float(values_sorted[idx])

    return {
        "min": float(values_sorted[0]),
        "p50": percentile(0.50),
        "p90": percentile(0.90),
        "p95": percentile(0.95),
        "max": float(values_sorted[-1]),
        "avg": round(statistics.mean(values_sorted), 3),
    }


def get_aksharas(record: Dict[str, Any]) -> List[str]:
    return list(((record.get("prosody") or {}).get("aksharas")) or [])


def get_maatras(record: Dict[str, Any]) -> List[int]:
    return [int(v) for v in (((record.get("prosody") or {}).get("maatras")) or [])]


def get_text(record: Dict[str, Any]) -> str:
    return str(record.get("cleaned_text") or record.get("text") or "")


def get_work(record: Dict[str, Any]) -> str:
    return str(((record.get("source") or {}).get("work")) or "unknown")


def get_source(record: Dict[str, Any]) -> str:
    source = record.get("source") or {}
    return str(source.get("relative_path") or source.get("source_path") or "unknown")


def benchmark_split(name: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    akshara_freq: Counter[str] = Counter()
    maatra_freq: Counter[int] = Counter()
    pattern_freq: Counter[str] = Counter()
    line_pattern_freq: Counter[str] = Counter()
    by_work: Counter[str] = Counter()
    by_source: Counter[str] = Counter()

    chars_per_record: List[int] = []
    non_ws_chars_per_record: List[int] = []
    words_per_record: List[int] = []
    aksharas_per_record: List[int] = []
    maatras_per_record: List[int] = []
    lines_per_record: List[int] = []
    reconstruction_pass = 0

    totals = {
        "records": len(records),
        "chars": 0,
        "non_ws_chars": 0,
        "kannada_chars": 0,
        "utf8_bytes": 0,
        "words": 0,
        "lines": 0,
        "aksharas": 0,
        "maatras": 0,
    }

    for record in records:
      text = get_text(record)
      aksharas = get_aksharas(record)
      maatras = get_maatras(record)
      pattern = str((record.get("prosody") or {}).get("maatra_pattern") or "")
      words = [w for w in WS_RE.split(text.strip()) if w]
      lines = [line for line in text.splitlines() if line.strip()]
      reconstructed = "".join(aksharas)

      chars = len(text)
      non_ws_chars = len(non_ws(text))
      kannada_chars = count_kannada(text)
      utf8_bytes = len(text.encode("utf-8"))
      word_count = len(words)
      line_count = len(lines)
      akshara_count = len(aksharas)
      maatra_total = sum(maatras)

      totals["chars"] += chars
      totals["non_ws_chars"] += non_ws_chars
      totals["kannada_chars"] += kannada_chars
      totals["utf8_bytes"] += utf8_bytes
      totals["words"] += word_count
      totals["lines"] += line_count
      totals["aksharas"] += akshara_count
      totals["maatras"] += maatra_total

      chars_per_record.append(chars)
      non_ws_chars_per_record.append(non_ws_chars)
      words_per_record.append(word_count)
      aksharas_per_record.append(akshara_count)
      maatras_per_record.append(maatra_total)
      lines_per_record.append(line_count)

      akshara_freq.update(aksharas)
      maatra_freq.update(maatras)
      if pattern:
          pattern_freq[pattern] += 1
      for line in lines:
          line_maatras = get_line_maatra_pattern(line)
          if line_maatras:
              line_pattern_freq[line_maatras] += 1
      by_work[get_work(record)] += 1
      by_source[get_source(record)] += 1
      if non_ws(reconstructed) == non_ws(text):
          reconstruction_pass += 1

    return {
        "name": name,
        "totals": totals,
        "unique": {
            "aksharas": len(akshara_freq),
            "maatra_values": len(maatra_freq),
            "record_maatra_patterns": len(pattern_freq),
            "line_maatra_patterns": len(line_pattern_freq),
        },
        "ratios": {
            "chars_per_akshara": round(safe_div(totals["chars"], totals["aksharas"]), 4),
            "non_ws_chars_per_akshara": round(safe_div(totals["non_ws_chars"], totals["aksharas"]), 4),
            "utf8_bytes_per_akshara": round(safe_div(totals["utf8_bytes"], totals["aksharas"]), 4),
            "akshara_compression_vs_chars": round(safe_div(totals["aksharas"], totals["chars"]), 4),
            "akshara_compression_vs_non_ws_chars": round(safe_div(totals["aksharas"], totals["non_ws_chars"]), 4),
            "aksharas_per_word": round(safe_div(totals["aksharas"], totals["words"]), 4),
            "maatras_per_akshara": round(safe_div(totals["maatras"], totals["aksharas"]), 4),
            "kannada_char_share": round(safe_div(totals["kannada_chars"], totals["chars"]), 4),
            "reconstruction_non_ws_pass_rate": round(safe_div(reconstruction_pass, len(records)), 4),
        },
        "distributions": {
            "chars_per_record": quantiles(chars_per_record),
            "non_ws_chars_per_record": quantiles(non_ws_chars_per_record),
            "words_per_record": quantiles(words_per_record),
            "aksharas_per_record": quantiles(aksharas_per_record),
            "maatras_per_record": quantiles(maatras_per_record),
            "lines_per_record": quantiles(lines_per_record),
        },
        "by_work": dict(sorted(by_work.items())),
        "by_source": dict(sorted(by_source.items())),
        "_counters": {
            "akshara_freq": akshara_freq,
            "maatra_freq": maatra_freq,
            "pattern_freq": pattern_freq,
            "line_pattern_freq": line_pattern_freq,
        },
    }


def get_line_maatra_pattern(line: str) -> str:
    # Use a simple local approximation over Kannada vowels/marks for line-level shape.
    # The authoritative full-record pattern remains the one produced by Pampa.
    short_marks = {"", "\u0cbf", "\u0cc1", "\u0cc6", "\u0cca"}
    long_marks = {"\u0cbe", "\u0cc0", "\u0cc2", "\u0cc7", "\u0cc8", "\u0ccb", "\u0ccc"}
    pattern: List[str] = []
    i = 0
    while i < len(line):
        ch = line[i]
        if "\u0c80" <= ch <= "\u0cff":
            nxt = line[i + 1] if i + 1 < len(line) else ""
            if nxt in long_marks:
                pattern.append("2")
                i += 2
                continue
            if nxt in short_marks:
                pattern.append("1")
        i += 1
    return "".join(pattern)


def counter_top(counter: Counter[Any], limit: int) -> List[Dict[str, Any]]:
    return [{"token": token, "count": count} for token, count in counter.most_common(limit)]


def strip_counters(split_stats: Dict[str, Any], top: int) -> Dict[str, Any]:
    counters = split_stats.pop("_counters")
    split_stats["top"] = {
        "aksharas": counter_top(counters["akshara_freq"], top),
        "maatras": counter_top(counters["maatra_freq"], top),
        "record_maatra_patterns": counter_top(counters["pattern_freq"], top),
        "line_maatra_patterns": counter_top(counters["line_pattern_freq"], top),
    }
    return split_stats


def write_token_streams(out_dir: Path, split_name: str, records: List[Dict[str, Any]]) -> None:
    akshara_path = out_dir / f"akshara_{split_name}.txt"
    maatra_path = out_dir / f"maatra_{split_name}.txt"
    paired_path = out_dir / f"akshara_maatra_{split_name}.jsonl"

    with akshara_path.open("w", encoding="utf-8", newline="\n") as ak_fh, \
         maatra_path.open("w", encoding="utf-8", newline="\n") as ma_fh, \
         paired_path.open("w", encoding="utf-8", newline="\n") as pair_fh:
        for record in records:
            aksharas = get_aksharas(record)
            maatras = get_maatras(record)
            ak_fh.write(" ".join(aksharas) + f"\n{DOC_SEP}\n")
            ma_fh.write(" ".join(str(v) for v in maatras) + f"\n{DOC_SEP}\n")
            pair_fh.write(json.dumps({
                "id": record.get("id"),
                "aksharas": aksharas,
                "maatras": maatras,
                "source": record.get("source"),
            }, ensure_ascii=False) + "\n")


def write_vocab(out_dir: Path, train_stats: Dict[str, Any], eval_stats: Dict[str, Any]) -> None:
    train_counter = train_stats["_counters"]["akshara_freq"]
    eval_counter = eval_stats["_counters"]["akshara_freq"]
    combined = train_counter + eval_counter
    vocab = [
        {"id": idx, "token": token, "count": count}
        for idx, (token, count) in enumerate(combined.most_common())
    ]
    (out_dir / "akshara_vocab.json").write_text(
        json.dumps(vocab, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def write_report(out_dir: Path, stats: Dict[str, Any]) -> None:
    train = stats["train"]
    eval_ = stats["eval"]
    lines = [
        "# Pampa Tokenizer Benchmark",
        "",
        f"Generated: {stats['created_at']}",
        "",
        "## Summary",
        "",
        f"- Train records: {train['totals']['records']}",
        f"- Eval records: {eval_['totals']['records']}",
        f"- Train Kannada chars: {train['totals']['kannada_chars']}",
        f"- Eval Kannada chars: {eval_['totals']['kannada_chars']}",
        f"- Train aksharas: {train['totals']['aksharas']}",
        f"- Eval aksharas: {eval_['totals']['aksharas']}",
        f"- Unique aksharas: {stats['combined']['unique_aksharas']}",
        "",
        "## Compression / Structure",
        "",
        "| Split | chars/akshara | non-ws chars/akshara | akshara/non-ws chars | maatras/akshara | reconstruction pass |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for split in [train, eval_]:
        r = split["ratios"]
        lines.append(
            f"| {split['name']} | {r['chars_per_akshara']} | {r['non_ws_chars_per_akshara']} | "
            f"{r['akshara_compression_vs_non_ws_chars']} | {r['maatras_per_akshara']} | "
            f"{r['reconstruction_non_ws_pass_rate']} |"
        )
    lines.extend([
        "",
        "## Top Train Aksharas",
        "",
    ])
    for item in train["top"]["aksharas"][:30]:
        lines.append(f"- `{item['token']}`: {item['count']}")
    lines.extend([
        "",
        "## Outputs",
        "",
        "- `stats.json`",
        "- `akshara_vocab.json`",
        "- `akshara_train.txt` / `akshara_eval.txt`",
        "- `maatra_train.txt` / `maatra_eval.txt`",
        "- `akshara_maatra_train.jsonl` / `akshara_maatra_eval.jsonl`",
        "",
        "This benchmark is descriptive. It does not yet train a tokenizer model.",
    ])
    (out_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    train_path = Path(args.train)
    eval_path = Path(args.eval)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not train_path.exists():
        raise FileNotFoundError(f"train JSONL not found: {train_path}")
    if not eval_path.exists():
        raise FileNotFoundError(f"eval JSONL not found: {eval_path}")

    train_records = load_jsonl(train_path)
    eval_records = load_jsonl(eval_path)

    train_stats = benchmark_split("train", train_records)
    eval_stats = benchmark_split("eval", eval_records)
    write_vocab(out_dir, train_stats, eval_stats)

    combined_aksharas = train_stats["_counters"]["akshara_freq"] + eval_stats["_counters"]["akshara_freq"]
    stats = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "inputs": {
            "train": str(train_path),
            "eval": str(eval_path),
        },
        "combined": {
            "unique_aksharas": len(combined_aksharas),
            "total_aksharas": sum(combined_aksharas.values()),
        },
        "train": strip_counters(train_stats, args.top),
        "eval": strip_counters(eval_stats, args.top),
    }

    write_token_streams(out_dir, "train", train_records)
    write_token_streams(out_dir, "eval", eval_records)
    (out_dir / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_report(out_dir, stats)

    print("Pampa tokenizer benchmark complete")
    print(f"train records: {len(train_records)}")
    print(f"eval records: {len(eval_records)}")
    print(f"unique aksharas: {stats['combined']['unique_aksharas']}")
    print(f"out: {out_dir.resolve()}")
    print(f"report: {(out_dir / 'report.md').resolve()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_tokenizer_bench: {exc}", file=sys.stderr)
        raise SystemExit(1)
