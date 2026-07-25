#!/usr/bin/env python
"""Generate text from a trained Pampa transformer LM checkpoint."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_MODEL_DIR = Path("outputs/pampa-transformer-lm")
DEFAULT_PAMPA_ROOT = Path("D:/pampa")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Generate from Pampa transformer LM.")
    p.add_argument("prompt", nargs="?", default="ಪಂಪ", help="Prompt text")
    p.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR), help="Directory containing transformer artifacts")
    p.add_argument("--pampa-root", default=str(DEFAULT_PAMPA_ROOT), help="Pampa project root")
    p.add_argument("--tokens", type=int, default=200, help="Max new tokens")
    p.add_argument("--temperature", type=float, default=0.85, help="Sampling temperature")
    p.add_argument("--top-k", type=int, default=0, help="Top-k filter (0 disables)")
    p.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    return p.parse_args()


def require_torch():
    try:
        import torch
        import torch.nn as nn
        import torch.nn.functional as F
    except ImportError as exc:
        raise RuntimeError("PyTorch is required for Pampa generation") from exc
    return torch, nn, F


def setup_pampa(root: Path) -> None:
    if root.exists():
        sys.path.insert(0, str(root))


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


def choose_device(torch, requested: str) -> str:
    if requested == "cuda":
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA requested but not available")
        return "cuda"
    if requested == "auto" and torch.cuda.is_available():
        return "cuda"
    return "cpu"


def decode(ids, tokenizer: Dict[str, Any], skip_special: bool = True) -> str:
    id_to_token = tokenizer["id_to_token"]
    special = {"<pad>", "<unk>", "<bos>", "<eos>"}
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
    ids = [token_to_id.get(token, unk) for token in tokenize_text_preserve_boundaries(prompt)]
    return ids or [token_to_id["<bos>"]]


def build_model(torch, nn, vocab_size: int, d_model: int, n_heads: int, n_layers: int, ffn_dim: int, max_seq_len: int, dropout: float):
    class TransformerLM(nn.Module):
        def __init__(self):
            super().__init__()
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

        def forward(self, x):
            t = x.size(1)
            pos = torch.arange(t, device=x.device).unsqueeze(0)
            h = self.token_emb(x) + self.pos_emb(pos)
            h = self.drop(h)
            mask = nn.Transformer.generate_square_subsequent_mask(t).to(x.device)
            h = self.transformer(h, mask=mask, is_causal=True)
            h = self.ln_f(h)
            return self.head(h)

    return TransformerLM()


def generate(torch, F, model, tokenizer: Dict[str, Any], prompt: str, max_new_tokens: int, device: str, max_seq_len: int, temperature: float, top_k: int) -> str:
    model.eval()
    ids = prompt_to_ids(prompt, tokenizer)
    eos_id = tokenizer["token_to_id"]["<eos>"]
    generated = list(ids)
    with torch.no_grad():
        for _ in range(max_new_tokens):
            ctx = generated[-max_seq_len:]
            x = torch.tensor([ctx], dtype=torch.long, device=device)
            logits = model(x)[:, -1, :] / max(temperature, 1e-6)
            if top_k and top_k > 0:
                vals, _idx = torch.topk(logits, k=min(top_k, logits.size(-1)))
                cutoff = vals[:, -1:].expand_as(logits)
                logits = torch.where(logits < cutoff, torch.full_like(logits, float("-inf")), logits)
            probs = F.softmax(logits, dim=-1)
            nxt = int(torch.multinomial(probs, num_samples=1).item())
            generated.append(nxt)
            if nxt == eos_id:
                break
    return decode(generated, tokenizer)


def main() -> int:
    args = parse_args()
    model_dir = Path(args.model_dir)
    setup_pampa(Path(args.pampa_root))
    torch, nn, F = require_torch()
    device = choose_device(torch, args.device)

    tokenizer_path = model_dir / "pampa_tokenizer.json"
    checkpoint_path = model_dir / "pampa_transformer_lm.pt"
    if not tokenizer_path.exists():
        raise FileNotFoundError(f"Missing tokenizer: {tokenizer_path}")
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Missing checkpoint: {checkpoint_path}")

    tokenizer = json.loads(tokenizer_path.read_text(encoding="utf-8"))
    checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)
    cfg = checkpoint["config"]
    model = build_model(
        torch, nn,
        vocab_size=int(checkpoint["vocab_size"]),
        d_model=int(cfg["d_model"]),
        n_heads=int(cfg["n_heads"]),
        n_layers=int(cfg["n_layers"]),
        ffn_dim=int(cfg["ffn_dim"]),
        max_seq_len=int(cfg["seq_len"]),
        dropout=float(cfg["dropout"]),
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])

    text = generate(
        torch, F, model, tokenizer, args.prompt, args.tokens, device,
        max_seq_len=int(cfg["seq_len"]),
        temperature=args.temperature,
        top_k=args.top_k,
    )
    print(text)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_generate_transformer: {exc}", file=sys.stderr)
        raise SystemExit(1)
