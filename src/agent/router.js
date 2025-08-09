"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { z } = require("zod");
const { toolRegistry, getToolSummaries, toolSchemaByName } = require("../tools/registry");

const ToolCall = z.object({
  tool: z.string(),
  args: z.record(z.any()),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1)
});

function loadPrompt(file) {
  return fs.readFileSync(path.resolve(file), "utf-8");
}
function render(tmpl, vars) {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ""));
}

async function detectTool(provider, prompt) {
  const system = render(loadPrompt("prompts/passA_classifier.system.md"),
    { TOOL_NAMES: toolRegistry.map(t => t.name).join(", ") });
  const out = await provider.call({
    model: provider.defaultModel,
    messages: [{ role: "system", content: system }, { role: "user", content: `User request:\n${prompt}` }],
    temperature: 0.1, max_tokens: 3
  });
  const t = (out.text || "").trim();
  return toolRegistry.some(x => x.name === t) ? t : "none";
}

async function planTool(provider, prompt, contextSnippet = "", grammarGBNF) {
  const sys = render(loadPrompt("prompts/passB_planner.system.md"),
    { TOOL_SUMMARY: getToolSummaries().join("\n") });
  const messages = [
    { role: "system", content: sys },
    { role: "user", content: `User request:\n${prompt}\n\nProject context (optional):\n${contextSnippet}` }
  ];
  const callOpts = { model: provider.defaultModel, messages, temperature: 0, top_p: 1, max_tokens: 512 };
  if (provider.supportsGrammar && grammarGBNF) callOpts.grammar = grammarGBNF;
  const raw = await provider.call(callOpts);
  let json;
  try { json = JSON.parse(raw.text || "{}"); }
  catch {
    const repairSys = loadPrompt("prompts/json_repair.system.md");
    const rep = await provider.call({
      model: provider.defaultModel,
      temperature: 0,
      messages: [
        { role: "system", content: repairSys },
        { role: "user", content: `Original (malformed):\n${raw.text}\n\nSchema error:\nInvalid JSON` }
      ],
      max_tokens: 512
    });
    json = JSON.parse(rep.text || "{}");
  }
  const parsed = ToolCall.parse(json);
  const schema = toolSchemaByName(parsed.tool);
  if (schema) schema.parse(parsed.args);
  return parsed;
}

function buildGrammarFromTemplate() {
  const tmpl = fs.readFileSync(path.resolve("prompts/toolcall.gbnf.tmpl"), "utf-8");
  const enumVals = toolRegistry.map(t => `"${t.name}"`).join(" | ");
  return tmpl.replace("{{TOOL_ENUM}}", enumVals);
}

module.exports = { detectTool, planTool, buildGrammarFromTemplate };