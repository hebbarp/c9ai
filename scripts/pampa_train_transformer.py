#!/usr/bin/env python
"""Train a small Pampa akshara-level decoder-only transformer LM."""

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
DEFAULT_OUT = Path("outputs/pampa-transformer-lm")
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
    d_model: int
    n_heads: int
    n_layers: int
    ffn_dim: int
    dropout: float
    learning_rate: float
    weight_decay: float
    warmup_steps: int
    grad_clip: float
    sample_every: int
    sample_tokens: int
    sample_temperature: float
    prompt: str
    device: str
    amp: bool


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train a small Pampa akshara-level transformer LM.")
    p.add_argument("--train", default=str(DEFAULT_TRAIN))
    p.add_argument("--eval", default=str(DEFAULT_EVAL))
    p.add_argument("--out", default=str(DEFAULT_OUT))
    p.add_argument("--pampa-root", default=str(DEFAULT_PAMPA_ROOT))
    p.add_argument("--seed", type=int, default=902)
    p.add_argument("--seq-len", type=int, default=256)
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--max-steps", type=int, default=5000)
    p.add_argument("--eval-batches", type=int, default=32)
    p.add_argument("--eval-every", type=int, default=250)
    p.add_argument("--d-model", type=int, default=256)
    p.add_argument("--n-heads", type=int, default=8)
    p.add_argument("--n-layers", type=int, default=6)
    p.add_argument("--ffn-dim", type=int, default=1024)
    p.add_argument("--dropout", type=float, default=0.1)
    p.add_argument("--learning-rate", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=0.1)
    p.add_argument("--warmup-steps", type=int, default=200)
    p.add_argument("--grad-clip", type=float, default=1.0)
    p.add_argument("--sample-every", type=int, default=500)
    p.add_argument("--sample-tokens", type=int, default=160)
    p.add_argument("--sample-temperature", type=float, default=0.9)
    p.add_argument("--prompt", default="ಪಂಪ")
    p.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    p.add_argument("--amp", dest="amp", action="store_true", default=True)
    p.add_argument("--no-amp", dest="amp", action="store_false")
    return p.parse_args()


def require_torch():
    try:
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
    except ImportError as exc:
        raise RuntimeError("PyTorch is required for pampa_train_transformer.py") from exc
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
    current: List[str] = []
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
    out: List[str] = []
    for idx in ids:
        token = id_to_token.get(str(int(idx)), "<unk>")
        if skip_special and token in special:
            continue
        if token == "<sp>":
            out.append(" ")
        elif token == "<nl>":
            out.append("\n")
        else:
            out.append(token)
    return "".join(out)


def prompt_to_ids(prompt: str, tokenizer: Dict[str, Any]) -> List[int]:
    token_to_id = tokenizer["token_to_id"]
    unk = token_to_id["<unk>"]
    tokens = tokenize_text_preserve_boundaries(prompt)
    ids = [token_to_id.get(token, unk) for token in tokens]
    return ids or [token_to_id["<bos>"]]


def build_model(torch, nn, vocab_size: int, d_model: int, n_heads: int, n_layers: int, ffn_dim: int, max_seq_len: int, dropout: float):
    class TransformerLM(nn.Module):
        def __init__(self):
            super().__init__()
            self.d_model = d_model
            self.max_seq_len = max_seq_len
            self.token_emb = nn.Embedding(vocab_size, d_model)
            self.pos_emb = nn.Embedding(max_seq_len, d_model)
            self.drop = nn.Dropout(dropout)
            layer = nn.TransformerEncoderLayer(
                d_model=d_model,
                nhead=n_heads,
                dim_feedforward=ffn_dim,
                dropout=dropout,
                activation="gelu",
                batch_first=True,
                norm_first=True,
            )
            self.transformer = nn.TransformerEncoder(layer, num_layers=n_layers)
            self.ln_f = nn.LayerNorm(d_model)
            self.head = nn.Linear(d_model, vocab_size, bias=False)
            self.head.weight = self.token_emb.weight
            self.apply(self._init_weights)

        @staticmethod
        def _init_weights(module):
            if isinstance(module, nn.Linear):
                nn.init.normal_(module.weight, mean=0.0, std=0.02)
                if module.bias is not None:
                    nn.init.zeros_(module.bias)
            elif isinstance(module, nn.Embedding):
                nn.init.normal_(module.weight, mean=0.0, std=0.02)

        def forward(self, x):
            t = x.size(1)
            if t > self.max_seq_len:
                raise RuntimeError(f"Sequence length {t} exceeds max_seq_len {self.max_seq_len}")
            pos = torch.arange(t, device=x.device).unsqueeze(0)
            h = self.token_emb(x) + self.pos_emb(pos)
            h = self.drop(h)
            mask = nn.Transformer.generate_square_subsequent_mask(t).to(x.device)
            h = self.transformer(h, mask=mask, is_causal=True)
            h = self.ln_f(h)
            return self.head(h)

    return TransformerLM()


def count_parameters(model) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


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
    x = [data[s:s + seq_len] for s in starts]
    y = [data[s + 1:s + seq_len + 1] for s in starts]
    return (
        torch.tensor(x, dtype=torch.long, device=device),
        torch.tensor(y, dtype=torch.long, device=device),
    )


def evaluate(torch, F, model, data: List[int], seq_len: int, batch_size: int, batches: int, device: str, use_amp: bool) -> float:
    model.eval()
    losses: List[float] = []
    autocast = torch.amp.autocast
    with torch.no_grad():
        for _ in range(batches):
            x, y = make_batch(torch, data, seq_len, batch_size, device)
            with autocast(device_type="cuda", enabled=(use_amp and device == "cuda")):
                logits = model(x)
                loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1))
            losses.append(float(loss.item()))
    model.train()
    return sum(losses) / len(losses) if losses else float("nan")


def generate(torch, F, model, tokenizer: Dict[str, Any], prompt: str, max_new_tokens: int, device: str, max_seq_len: int, temperature: float = 0.9) -> str:
    model.eval()
    ids = prompt_to_ids(prompt, tokenizer)
    eos_id = tokenizer["token_to_id"]["<eos>"]
    generated = list(ids)
    with torch.no_grad():
        for _ in range(max_new_tokens):
            ctx = generated[-max_seq_len:]
            x = torch.tensor([ctx], dtype=torch.long, device=device)
            logits = model(x)[:, -1, :] / max(temperature, 1e-6)
            probs = F.softmax(logits, dim=-1)
            nxt = int(torch.multinomial(probs, num_samples=1).item())
            generated.append(nxt)
            if nxt == eos_id:
                break
    model.train()
    return decode(generated, tokenizer)


def lr_at_step(step: int, warmup: int, max_steps: int, peak_lr: float) -> float:
    if step < warmup:
        return peak_lr * (step + 1) / max(1, warmup)
    progress = (step - warmup) / max(1, max_steps - warmup)
    progress = min(progress, 1.0)
    return peak_lr * (0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * progress)))


def write_report(out_dir: Path, config: TrainConfig, tokenizer: Dict[str, Any], param_count: int, metrics: List[Dict[str, Any]], samples: List[Dict[str, Any]], elapsed: float) -> None:
    final = metrics[-1] if metrics else {}
    lines = [
        "# Pampa Transformer LM",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Summary",
        "",
        f"- Vocab size: {tokenizer['vocab_size']}",
        f"- Parameters: {param_count:,}",
        f"- Steps: {config.max_steps}",
        f"- Final train loss: {final.get('train_loss')}",
        f"- Final eval loss: {final.get('eval_loss')}",
        f"- Final eval perplexity: {final.get('eval_ppl')}",
        f"- Device: `{config.device}`",
        f"- AMP: {config.amp}",
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
        "- `pampa_transformer_lm.pt`",
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
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    device = choose_device(torch, args.device)
    use_amp = bool(args.amp and device == "cuda")

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
        d_model=args.d_model,
        n_heads=args.n_heads,
        n_layers=args.n_layers,
        ffn_dim=args.ffn_dim,
        dropout=args.dropout,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_steps=args.warmup_steps,
        grad_clip=args.grad_clip,
        sample_every=args.sample_every,
        sample_tokens=args.sample_tokens,
        sample_temperature=args.sample_temperature,
        prompt=args.prompt,
        device=device,
        amp=use_amp,
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

    model = build_model(
        torch, nn,
        vocab_size=tokenizer["vocab_size"],
        d_model=args.d_model,
        n_heads=args.n_heads,
        n_layers=args.n_layers,
        ffn_dim=args.ffn_dim,
        max_seq_len=args.seq_len,
        dropout=args.dropout,
    ).to(device)
    param_count = count_parameters(model)

    decay, no_decay = [], []
    for n, p in model.named_parameters():
        if not p.requires_grad:
            continue
        if p.dim() < 2 or n.endswith(".bias") or "ln" in n.lower() or "norm" in n.lower():
            no_decay.append(p)
        else:
            decay.append(p)
    optimizer = torch.optim.AdamW(
        [
            {"params": decay, "weight_decay": args.weight_decay},
            {"params": no_decay, "weight_decay": 0.0},
        ],
        lr=args.learning_rate,
        betas=(0.9, 0.95),
    )
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    metrics: List[Dict[str, Any]] = []
    samples: List[Dict[str, Any]] = []
    start = time.time()

    initial_eval = evaluate(torch, F, model, eval_ids, args.seq_len, args.batch_size, min(args.eval_batches, 8), device, use_amp)
    metrics.append({
        "step": 0,
        "train_loss": None,
        "eval_loss": round(initial_eval, 6),
        "eval_ppl": round(math.exp(min(initial_eval, 20)), 4),
    })
    print(
        f"init params={param_count:,} vocab={tokenizer['vocab_size']} "
        f"device={device} amp={use_amp} eval_loss={metrics[0]['eval_loss']} "
        f"eval_ppl={metrics[0]['eval_ppl']}"
    )

    model.train()
    last_loss = None
    for step in range(1, args.max_steps + 1):
        lr = lr_at_step(step - 1, args.warmup_steps, args.max_steps, args.learning_rate)
        for group in optimizer.param_groups:
            group["lr"] = lr

        x, y = make_batch(torch, train_ids, args.seq_len, args.batch_size, device)
        with torch.amp.autocast(device_type="cuda", enabled=use_amp):
            logits = model(x)
            loss = F.cross_entropy(logits.reshape(-1, logits.size(-1)), y.reshape(-1))

        optimizer.zero_grad(set_to_none=True)
        if use_amp:
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
            scaler.step(optimizer)
            scaler.update()
        else:
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), args.grad_clip)
            optimizer.step()
        last_loss = float(loss.item())

        if step % args.eval_every == 0 or step == args.max_steps:
            eval_loss = evaluate(torch, F, model, eval_ids, args.seq_len, args.batch_size, args.eval_batches, device, use_amp)
            metric = {
                "step": step,
                "lr": round(lr, 6),
                "train_loss": round(last_loss, 6),
                "eval_loss": round(eval_loss, 6),
                "eval_ppl": round(math.exp(min(eval_loss, 20)), 4),
                "elapsed_seconds": round(time.time() - start, 2),
            }
            metrics.append(metric)
            print(
                f"step {step}/{args.max_steps} lr={metric['lr']} "
                f"train_loss={metric['train_loss']} eval_loss={metric['eval_loss']} "
                f"eval_ppl={metric['eval_ppl']} elapsed={metric['elapsed_seconds']}s"
            )

        if step % args.sample_every == 0 or step == args.max_steps:
            text = generate(
                torch, F, model, tokenizer, args.prompt,
                args.sample_tokens, device, args.seq_len, args.sample_temperature,
            )
            samples.append({"step": step, "prompt": args.prompt, "text": text})

    checkpoint = {
        "model_state_dict": model.state_dict(),
        "config": asdict(config),
        "vocab_size": tokenizer["vocab_size"],
        "tokenizer_path": "pampa_tokenizer.json",
        "param_count": param_count,
        "model_kind": "pampa-transformer-lm",
    }
    torch.save(checkpoint, out_dir / "pampa_transformer_lm.pt")

    with (out_dir / "metrics.jsonl").open("w", encoding="utf-8") as fh:
        for metric in metrics:
            fh.write(json.dumps(metric, ensure_ascii=False) + "\n")
    with (out_dir / "samples.jsonl").open("w", encoding="utf-8") as fh:
        for sample in samples:
            fh.write(json.dumps(sample, ensure_ascii=False) + "\n")

    elapsed = time.time() - start
    write_report(out_dir, config, tokenizer, param_count, metrics, samples, elapsed)

    print("Pampa transformer LM training complete")
    print(f"params: {param_count:,}")
    print(f"vocab_size: {tokenizer['vocab_size']}")
    print(f"steps: {args.max_steps}")
    print(f"out: {out_dir.resolve()}")
    print(f"report: {(out_dir / 'report.md').resolve()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_train_transformer: {exc}", file=sys.stderr)
        raise SystemExit(1)
