# Tiny Dickinson

Tiny Dickinson is the first Small Language Foundry sample project.

It is intentionally modest. The goal is to learn the loop:

1. Collect a small public-domain corpus.
2. Write a posture/system prompt.
3. Create simple eval questions.
4. Generate training pairs.
5. Fine-tune or adapter-train with an external trainer.
6. Package as an Ollama model.
7. Register and switch to it from c9ai.

This sample does not ship trained weights. It is a project shape and a learning path.

Suggested c9ai setup:

```text
models init tiny-dickinson
models inspect tiny-dickinson
switch tiny-dickinson
```

Use only public-domain source text, and keep a provenance note for every corpus file you add.
