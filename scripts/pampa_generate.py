#!/usr/bin/env python
"""Generate text from a trained Pampa tiny LM checkpoint."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List


DEFAULT_MODEL_DIR = Path("outputs/pampa-tiny-lm")
DEFAULT_PAMPA_ROOT = Path("D:/pampa")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate from Pampa tiny LM.")
    parser.add_argument("prompt", nargs="?", default="ಪಂಪ", help="Prompt text")
    parser.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR), help="Directory containing Pampa tiny LM artifacts")
    parser.add_argument("--pampa-root", default=str(DEFAULT_PAMPA_ROOT), help="Pampa project root")
    parser.add_argument("--tokens", type=int, default=180, help="Max new tokens")
    parser.add_argument("--temperature", type=float, default=0.85, help="Sampling temperature")
    parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"])
    return parser.parse_args()


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


def build_model(torch, nn, vocab_size: int, embed_dim: int, hidden_dim: int, layers: int, dropout: float):
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
            return self.output(out), hidden

    return Model()


def generate(torch, F, model, tokenizer: Dict[str, Any], prompt: str, max_new_tokens: int, device: str, temperature: float) -> str:
    ids = prompt_to_ids(prompt, tokenizer)
    generated = list(ids)
    x = torch.tensor([ids], dtype=torch.long, device=device)
    hidden = None
    model.eval()
    with torch.no_grad():
        _logits, hidden = model(x, hidden)
        current = x[:, -1:]
        for _ in range(max_new_tokens):
            logits, hidden = model(current, hidden)
            probs = F.softmax(logits[:, -1, :] / max(temperature, 1e-6), dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            value = int(next_id.item())
            generated.append(value)
            current = next_id
            if tokenizer["id_to_token"].get(str(value)) == "<eos>":
                break
    return decode(generated, tokenizer)


def main() -> int:
    args = parse_args()
    model_dir = Path(args.model_dir)
    setup_pampa(Path(args.pampa_root))
    torch, nn, F = require_torch()
    device = choose_device(torch, args.device)

    tokenizer_path = model_dir / "pampa_tokenizer.json"
    checkpoint_path = model_dir / "pampa_tiny_lm.pt"
    if not tokenizer_path.exists():
        raise FileNotFoundError(f"Missing tokenizer: {tokenizer_path}")
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Missing checkpoint: {checkpoint_path}")

    tokenizer = json.loads(tokenizer_path.read_text(encoding="utf-8"))
    checkpoint = torch.load(checkpoint_path, map_location=device)
    cfg = checkpoint["config"]
    model = build_model(
        torch,
        nn,
        vocab_size=int(checkpoint["vocab_size"]),
        embed_dim=int(cfg["embed_dim"]),
        hidden_dim=int(cfg["hidden_dim"]),
        layers=int(cfg["layers"]),
        dropout=float(cfg["dropout"]),
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])

    text = generate(torch, F, model, tokenizer, args.prompt, args.tokens, device, args.temperature)
    print(text)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"pampa_generate: {exc}", file=sys.stderr)
        raise SystemExit(1)
