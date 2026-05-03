#!/usr/bin/env python
"""Train a tiny akshara-level Pampa language model with PyTorch."""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence


DEFAULT_TRAIN = Path("outputs/pampa-training-corpus/train.jsonl")
DEFAULT_EVAL = Path("outputs/pampa-training-corpus/eval.jsonl")
DEFAULT_OUT = Path("outputs/pampa-tiny-lm")
DEFAULT_PAMPA_ROOT = Path("D:/pampa")

SPECIAL_TOKENS = ["<pad>", "<unk>", "<bos>", "<eos>"]
BOUNDARY_TOKENS = {"<sp>", "<nl>"}


@dataclass
class TrainConfig:
    train: str
    eval: str
    out: str
    pampa_root: str
    seed: int
    seq_len: int
    batch_size: int
    max_steps: int
    eval_batches: int
    eval_every: int
    embed_dim: int
    hidden_dim: int
    layers: int
    dropout: float
    learning_rate: float
    sample_every: int
    sample_tokens: int
    prompt: str
    device: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a tiny Pampa akshara LM.")
    parser.add_argument("--train", default=str(DEFAULT_TRAIN), help="Train akshara/maatra JSONL")
    parser.add_argument("--eval", default=str(DEFAULT_EVAL), help="Eval akshara/maatra JSONL")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output directory")
    parser.add_argument("--pampa-root", default=str(DEFAULT_PAMPA_ROOT), help="Pampa root for prompt akshara splitting")
    parser.add_argument("--seed", type=int, default=902)
    parser.add_argument("--seq-len", type=int, default=64)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--max-steps", type=int, default=250)
    parser.add_argument("--eval-batches", type=int, default=24)
    parser.add_argument("--eval-every", type=int, default=50)
    parser.add_argument("--embed-dim", type=int, default=64)
    parser.add_argument("--hidden-dim", type=int, default=128)
    parser.add_argument("--layers", type=int, default=1)
    parser.add_argument("--dropout", type=float, default=0.0)
    parser.add_argument("--learning-rate", type=float, default=0.003)
    parser.add_argument("--sample-every", type=int, default=50)
    parser.add_argument("--sample-tokens", type=int, default=160)
    parser.add_argument("--prompt", default="ಪಂಪ")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    return parser.parse_args()


def require_torch():
    try:
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
    except ImportError as exc:
        raise RuntimeError("PyTorch is required for pampa_train_tiny_lm.py") from exc
    return torch, nn, F


def setup_pampa(root: Path) -> None:
    if root.exists():
        sys.path.insert(0, str(root))


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
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


def split_aksharas_safe(text: str) -> List[str]:
    try:
        from core import split_aksharas  # type: ignore
        return list(split_aksharas(text))
    except Exception:
        return list(text)


def tokenize_text_preserve_boundaries(text: str) -> List[str]:
    tokens: List[str] = []
    current = []
    for char in text or "":
        if char == "\n":
            if current:
                tokens.extend(split_aksharas_safe("".join(current)))
                current = []
            tokens.append("<nl>")
        elif char.isspace():
            if current:
                tokens.extend(split_aksharas_safe("".join(current)))
                current = []
            tokens.append("<sp>")
        else:
            current.append(char)
    if current:
        tokens.extend(split_aksharas_safe("".join(current)))
    return tokens


def record_tokens(record: Dict[str, Any]) -> List[str]:
    text = record.get("cleaned_text") or record.get("text")
    if text:
        return tokenize_text_preserve_boundaries(str(text))
    return list(record.get("aksharas") or [])


def build_tokenizer(records: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    counts: Dict[str, int] = {}
    for record in records:
        for token in record_tokens(record):
            counts[token] = counts.get(token, 0) + 1

    token_to_id = {token: idx for idx, token in enumerate(SPECIAL_TOKENS)}
    for token in ["<sp>", "<nl>"]:
        token_to_id[token] = len(token_to_id)
    for token, _count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        if token not in token_to_id:
            token_to_id[token] = len(token_to_id)

    id_to_token = {str(idx): token for token, idx in token_to_id.items()}
    return {
        "type": "pampa-akshara-vocab",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "special_tokens": {
            "pad": "<pad>",
            "unk": "<unk>",
            "bos": "<bos>",
            "eos": "<eos>",
        },
        "token_to_id": token_to_id,
        "id_to_token": id_to_token,
        "vocab_size": len(token_to_id),
    }


def encode_record(record: Dict[str, Any], tokenizer: Dict[str, Any]) -> List[int]:
    token_to_id = tokenizer["token_to_id"]
    unk = token_to_id["<unk>"]
    ids = [token_to_id["<bos>"]]
    ids.extend(token_to_id.get(token, unk) for token in record_tokens(record))
    ids.append(token_to_id["<eos>"])
    return ids


def encode_records(records: Sequence[Dict[str, Any]], tokenizer: Dict[str, Any]) -> List[int]:
    ids: List[int] = []
    for record in records:
        ids.extend(encode_record(record, tokenizer))
    return ids


def decode(ids: Iterable[int], tokenizer: Dict[str, Any], skip_special: bool = True) -> str:
    id_to_token = tokenizer["id_to_token"]
    special = set(SPECIAL_TOKENS)
    tokens: List[str] = []
    for idx in ids:
        token = id_to_token.get(str(int(idx)), "<unk>")
        if skip_special and token in special:
            continue
        if token == "<sp>":
            tokens.append(" ")
        elif token == "<nl>":
            tokens.append("\n")
        else:
            tokens.append(token)
    return "".join(tokens)


def prompt_to_ids(prompt: str, tokenizer: Dict[str, Any]) -> List[int]:
    token_to_id = tokenizer["token_to_id"]
    unk = token_to_id["<unk>"]
    tokens = tokenize_text_preserve_boundaries(prompt)
    ids = [token_to_id.get(token, unk) for token in tokens]
    return ids or [token_to_id["<bos>"]]


class TinyAksharaLM:
    def __init__(self, torch, nn, vocab_size: int, embed_dim: int, hidden_dim: int, layers: int, dropout: float):
        class Model(nn.Module):
            def __init__(self):
                super().__init__()
                self.embedding = nn.Embedding(vocab_size, embed_dim)
                self.rnn = nn.GRU(
                    embed_dim,
                    hidden_dim,
                    num_layers=layers,
                    dropout=dropout if layers > 1 else 0.0,
                    batch_first=True,
                )
                self.output = nn.Linear(hidden_dim, vocab_size)

            def forward(self, x, hidden=None):
                emb = self.embedding(x)
                out, hidden = self.rnn(emb, hidden)
                logits = self.output(out)
                return logits, hidden

        self.model = Model()


def choose_device(torch, requested: str) -> str:
    if requested == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA requested but not available")
        return "cuda"
    if requested == "auto" and torch.cuda.is_available():
        return "cuda"
    return "cpu"


def make_batch(torch, data: List[int], seq_len: int, batch_size: int, device: str):
    max_start = len(data) - seq_len - 1
    if max_start <= 0:
        raise RuntimeError("Training data is too short for configured seq_len")
    starts = [random.randint(0, max_start) for _ in range(batch_size)]
    x = [data[start:start + seq_len] for start in starts]
    y = [data[start + 1:start + seq_len + 1] for start in starts]
    return (
        torch.tensor(x, dtype=torch.long, device=device),
        torch.tensor(y, dtype=torch.long, device=device),
    )


def evaluate(torch, F, model, data: List[int], seq_len: int, batch_size: int, batches: int, device: str) -> float:
    model.eval()
    losses: List[float] = []
    with torch.no_grad():
        for _ in range(batches):
            x, y = make_batch(torch, data, seq_len, batch_size, device)
            logits, _hidden = model(x)
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1))
            losses.append(float(loss.item()))
    model.train()
    return sum(losses) / len(losses) if losses else float("nan")


def generate(torch, F, model, tokenizer: Dict[str, Any], prompt: str, max_new_tokens: int, device: str, temperature: float = 0.9) -> str:
    model.eval()
    ids = prompt_to_ids(prompt, tokenizer)
    generated = list(ids)
    x = torch.tensor([ids], dtype=torch.long, device=device)
    hidden = None
    with torch.no_grad():
        logits, hidden = model(x, hidden)
        current = x[:, -1:]
        for _ in range(max_new_tokens):
            logits, hidden = model(current, hidden)
            next_logits = logits[:, -1, :] / max(temperature, 1e-6)
            probs = F.softmax(next_logits, dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            value = int(next_id.item())
            generated.append(value)
            current = next_id
            if tokenizer["id_to_token"].get(str(value)) == "<eos>":
                break
    model.train()
    return decode(generated, tokenizer)


def write_report(out_dir: Path, config: TrainConfig, tokenizer: Dict[str, Any], metrics: List[Dict[str, Any]], samples: List[Dict[str, Any]], elapsed: float) -> None:
    final = metrics[-1] if metrics else {}
    lines = [
        "# Pampa Tiny LM",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Summary",
        "",
        f"- Vocab size: {tokenizer['vocab_size']}",
        f"- Steps: {config.max_steps}",
        f"- Final train loss: {final.get('train_loss')}",
        f"- Final eval loss: {final.get('eval_loss')}",
        f"- Final eval perplexity: {final.get('eval_ppl')}",
        f"- Device: `{config.device}`",
        f"- Elapsed seconds: {round(elapsed, 2)}",
        "",
        "## Samples",
        "",
    ]
    for item in samples[-5:]:
        lines.append(f"### Step {item['step']}")
        lines.append("")
        lines.append("```text")
        lines.append(item["text"])
        lines.append("```")
        lines.append("")
    lines.extend([
        "## Outputs",
        "",
        "- `pampa_tokenizer.json`",
        "- `pampa_tiny_lm.pt`",
        "- `metrics.jsonl`",
        "- `samples.jsonl`",
        "- `report.md`",
    ])
    (out_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    setup_pampa(Path(args.pampa_root))
    torch, nn, F = require_torch()

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    device = choose_device(torch, args.device)
    config = TrainConfig(
        train=args.train,
        eval=args.eval,
        out=args.out,
        pampa_root=args.pampa_root,
        seed=args.seed,
        seq_len=args.seq_len,
        batch_size=args.batch_size,
        max_steps=args.max_steps,
        eval_batches=args.eval_batches,
        eval_every=args.eval_every,
        embed_dim=args.embed_dim,
        hidden_dim=args.hidden_dim,
        layers=args.layers,
        dropout=args.dropout,
        learning_rate=args.learning_rate,
        sample_every=args.sample_every,
        sample_tokens=args.sample_tokens,
        prompt=args.prompt,
        device=device,
    )

    train_path = Path(args.train)
    eval_path = Path(args.eval)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    train_records = load_jsonl(train_path)
    eval_records = load_jsonl(eval_path)
    tokenizer = build_tokenizer(train_records + eval_records)
    train_ids = encode_records(train_records, tokenizer)
    eval_ids = encode_records(eval_records, tokenizer)

    (out_dir / "pampa_tokenizer.json").write_text(
        json.dumps(tokenizer, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (out_dir / "config.json").write_text(
        json.dumps(asdict(config), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    lm = TinyAksharaLM(
        torch,
        nn,
        vocab_size=tokenizer["vocab_size"],
        embed_dim=args.embed_dim,
        hidden_dim=args.hidden_dim,
        layers=args.layers,
        dropout=args.dropout,
    )
    model = lm.model.to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate)

    metrics: List[Dict[str, Any]] = []
    samples: List[Dict[str, Any]] = []
    start = time.time()

    initial_eval = evaluate(torch, F, model, eval_ids, args.seq_len, args.batch_size, min(args.eval_batches, 8), device)
    metrics.append({
        "step": 0,
        "train_loss": None,
        "eval_loss": round(initial_eval, 6),
        "eval_ppl": round(math.exp(min(initial_eval, 20)), 4),
    })

    model.train()
    last_loss = None
    for step in range(1, args.max_steps + 1):
        x, y = make_batch(torch, train_ids, args.seq_len, args.batch_size, device)
        logits, _hidden = model(x)
        loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1))
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        last_loss = float(loss.item())

        if step % args.eval_every == 0 or step == args.max_steps:
            eval_loss = evaluate(torch, F, model, eval_ids, args.seq_len, args.batch_size, args.eval_batches, device)
            metric = {
                "step": step,
                "train_loss": round(last_loss, 6),
                "eval_loss": round(eval_loss, 6),
                "eval_ppl": round(math.exp(min(eval_loss, 20)), 4),
                "elapsed_seconds": round(time.time() - start, 2),
            }
            metrics.append(metric)
            print(
                f"step {step}/{args.max_steps} "
                f"train_loss={metric['train_loss']} eval_loss={metric['eval_loss']} "
                f"eval_ppl={metric['eval_ppl']}"
            )

        if step % args.sample_every == 0 or step == args.max_steps:
            text = generate(torch, F, model, tokenizer, args.prompt, args.sample_tokens, device)
            samples.append({"step": step, "prompt": args.prompt, "text": text})

    checkpoint = {
        "model_state_dict": model.state_dict(),
        "config": asdict(config),
        "vocab_size": tokenizer["vocab_size"],
        "tokenizer_path": "pampa_tokenizer.json",
    }
    torch.save(checkpoint, out_dir / "pampa_tiny_lm.pt")

    with (out_dir / "metrics.jsonl").open("w", encoding="utf-8") as fh:
        for metric in metrics:
            fh.write(json.dumps(metric, ensure_ascii=False) + "\n")
    with (out_dir / "samples.jsonl").open("w", encoding="utf-8") as fh:
        for sample in samples:
            fh.write(json.dumps(sample, ensure_ascii=False) + "\n")

    elapsed = time.time() - start
    write_report(out_dir, config, tokenizer, metrics, samples, elapsed)

    print("Pampa tiny LM training complete")
    print(f"vocab_size: {tokenizer['vocab_size']}")
    print(f"steps: {args.max_steps}")
    print(f"out: {out_dir.resolve()}")
    print(f"report: {(out_dir / 'report.md').resolve()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_train_tiny_lm: {exc}", file=sys.stderr)
        raise SystemExit(1)
