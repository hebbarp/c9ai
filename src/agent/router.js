"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { z } = require("../util/zod");
const { toolRegistry, getToolSummaries, toolSchemaByName } = require("../tools/registry");

// Helper: relax args even when the model sends odd shapes
function normalizeArgs(tool, rawArgs) {
  if (tool === "shell.run" && typeof rawArgs === "string") return { cmd: rawArgs };
  if (tool === "fs.write" && typeof rawArgs === "string") return { path: rawArgs, content: "" };

  const aliasMap = {
    "web.search": { query: "q", num_results: "num", k: "num", top_k: "num" },
    "ffmpeg.run": { file: "input", in: "input", out: "output", outfile: "output" },
    "pdflatex.run": { file: "input", src: "input" },
    "whatsapp.send": { msg: "text", message: "text", body: "text" },
    "cream.mail": { msg: "body", message: "body", text: "body", sub: "subject", subj: "subject" },
    "cream.post": { msg: "content", message: "content", text: "content", vis: "visibility" },
    "email.send": { msg: "text", message: "text", body: "text", sub: "subject", subj: "subject" },
    "gh.issues": { repository: "repo", repo_name: "repo" }
  };

  if (rawArgs && typeof rawArgs === "object" && aliasMap[tool]) {
    const out = { ...rawArgs };
    const aliases = aliasMap[tool];
    for (const [alias, canonical] of Object.entries(aliases)) {
      if (out[alias] != null && out[canonical] == null) out[canonical] = out[alias];
    }
    return out;
  }
  return rawArgs || {};
}

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

async function detectTool(provider, prompt, ctx = {}) {
  try {
    const tools = toolRegistry.map(t => t.name);
    const summaries = getToolSummaries();
    const system = render(loadPrompt("prompts/passA_classifier.system.md"), { TOOL_NAMES: tools.join(", ") });
    
    // If grammar is available, constrain output to one token from the set.
    const grammar = provider.supportsGrammar
      ? `root ::= "${tools.concat("none").join('" | "')}"`
      : undefined;
    
    const out = await provider.call({
    model: provider.defaultModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `User request:\n${prompt}` }
    ],
    temperature: 0,
    top_p: 1,
    max_tokens: 3,
    grammar,
    modelsDir: ctx.modelsDir // Pass through for auto-server management
  });
  
  let t = (out.text || "").trim();
  // Normalize any accidental punctuation/quotes
  t = t.replace(/^["'`]|["'`]$/g, "").trim();
  
  if (tools.includes(t)) {
    return t;
  }
  
  // Heuristic fallback router (when tiny models dither)
  const p = prompt.toLowerCase();
  
  if (/(create|write|append|save)\b/.test(p)) {
    return "fs.write";
  }
  if (/\b(read|open|show|display)\b/.test(p) && /\bfile\b/.test(p)) {
    return "fs.read";
  }
  if (/\b(run|execute|build|test|npm|yarn|pnpm|make)\b/.test(p)) {
    return "shell.run";
  }
  if (/\bscript(s)?\b/.test(p)) {
    return "script.run";
  }
  
  return "none";
  
  } catch (error) {
    console.error("🚨 detectTool failed:", error?.message || error);
    // Fallback to heuristic detection
    const p = prompt.toLowerCase();
    if (p.includes("file") || p.includes("read") || p.includes("open")) {
      return "fs.read";
    }
    if (p.includes("write") || p.includes("create") || p.includes("save")) {
      return "fs.write";
    }
    if (/\b(run|execute|build|test|npm|yarn|pnpm|make)\b/.test(p)) {
      return "shell.run";
    }
    if (p.includes("search") || p.includes("google") || p.includes("web")) {
      return "web.search";
    }
    return "none";
  }
}

async function planTool(provider, prompt, contextSnippet = "", grammarGBNF, ctx = {}) {
  try {
    const sys = render(loadPrompt("prompts/passB_planner.system.md"),
      { TOOL_SUMMARY: getToolSummaries().join("\n") });
    const messages = [
      { role: "system", content: sys },
      { role: "user", content: `User request:\n${prompt}\n\nProject context (optional):\n${contextSnippet}` }
    ];
    const callOpts = { 
      model: provider.defaultModel, 
      messages, 
      temperature: 0, 
      top_p: 1, 
      max_tokens: 512,
      modelsDir: ctx.modelsDir // Pass through for auto-server management
    };
    if (provider.supportsGrammar && grammarGBNF) callOpts.grammar = grammarGBNF;
    
    const raw = await provider.call(callOpts);
  let json;
  
  // Clean up the response - remove markdown code blocks if present
  let cleanText = (raw.text || "").trim();
  // Remove various markdown patterns
  cleanText = cleanText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
  // Remove any leading/trailing text that's not JSON
  const jsonMatch = cleanText.match(/\{.*\}/s);
  if (jsonMatch) {
    cleanText = jsonMatch[0];
  }
  
  console.log("🔧 Raw model output:", raw.text);
  console.log("🔧 Cleaned JSON:", cleanText);
  
  try { 
    json = JSON.parse(cleanText); 
  }
  catch (parseError) {
    console.log("🔧 JSON parse failed, attempting simple repairs...");
    
    // Try simple repairs first
    let repaired = cleanText
      .replace(/,\s*}/g, '}')  // Remove trailing commas
      .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
      .replace(/'/g, '"')      // Replace single quotes with double quotes
      .replace(/(\w+):/g, '"$1":'); // Quote unquoted keys
    
    try {
      json = JSON.parse(repaired);
      console.log("🔧 Simple repair successful!");
    } catch (repairError) {
      console.log("🔧 Simple repair failed, calling model for help...");
      const repairSys = loadPrompt("prompts/json_repair.system.md");
      const rep = await provider.call({
      model: provider.defaultModel,
      temperature: 0,
      messages: [
        { role: "system", content: repairSys },
        { role: "user", content: `Original (malformed):\n${cleanText}\n\nSchema error:\nInvalid JSON` }
      ],
      max_tokens: 512,
      modelsDir: ctx.modelsDir // Pass through for auto-server management
    });
    
      // Clean the repaired JSON response too
      let repairedText = (rep.text || "").trim();
      repairedText = repairedText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      try {
        json = JSON.parse(repairedText);
        console.log("🔧 Model repair successful!");
      } catch (modelRepairError) {
        console.warn("🚨 Model repair also failed:", modelRepairError.message);
        // Fallback to a safe default
        json = {
          tool: "none",
          args: {},
          confidence: 0.0,
          reason: "JSON parsing failed after multiple repair attempts"
        };
      }
    }
  }
  
  // 1) Validate/repair top-level ToolCall shape permissively
  const safeTop = ToolCall.safeParse(json);
  let parsed = safeTop.success ? safeTop.data : {
    tool: (typeof json?.tool === "string" ? json.tool : "none"),
    args: (json?.args ?? {}),
    confidence: (typeof json?.confidence === "number" ? json.confidence : 0.0),
    reason: (typeof json?.reason === "string" ? json.reason : "Schema repair fallback")
  };

  // 2) Normalize args and run schema validation (handle mixed schema formats)
  const schema = toolSchemaByName(parsed.tool);
  const normalized = normalizeArgs(parsed.tool, parsed.args);
  
  console.log(`🔧 After normalization:`, normalized);
  
  if (schema) {
    console.log(`🔧 Schema for ${parsed.tool}:`, typeof schema, Object.keys(schema || {}));
    
    // Check if it's a valid Zod schema with safeParse
    if (schema && typeof schema.safeParse === 'function') {
      try {
        const safe = schema.safeParse(normalized);
        if (safe.success) {
          console.log("✅ Schema validation passed");
          parsed.args = safe.data;
        } else {
          console.error("❌ Tool args validation failed (non-fatal):", safe.error?.message || safe.error);
          console.error("❌ Full error details:", JSON.stringify(safe.error?.issues || [], null, 2));
          parsed.args = normalized;
          parsed.confidence = Math.min(parsed.confidence ?? 0.0, 0.4);
        }
      } catch (zodError) {
        console.error("❌ Zod safeParse error:", zodError.message);
        parsed.args = normalized;
        parsed.confidence = Math.min(parsed.confidence ?? 0.0, 0.4);
      }
    }
    // Check if it's a legacy schema object with .schema property
    else if (schema.schema && typeof schema.schema.safeParse === 'function') {
      try {
        const safe = schema.schema.safeParse(normalized);
        if (safe.success) {
          parsed.args = safe.data;
        } else {
          console.error("❌ Legacy schema validation failed (non-fatal):", safe.error?.message);
          parsed.args = normalized;
          parsed.confidence = Math.min(parsed.confidence ?? 0.0, 0.4);
        }
      } catch (zodError) {
        console.error("❌ Legacy schema error:", zodError.message);
        parsed.args = normalized;
        parsed.confidence = Math.min(parsed.confidence ?? 0.0, 0.4);
      }
    }
    // Unknown schema format - skip validation but warn
    else {
      console.error("⚠️ Unknown schema format for", parsed.tool, "- skipping validation");
      parsed.args = normalized;
      parsed.confidence = Math.min(parsed.confidence ?? 0.0, 0.5); // Slight confidence reduction
    }
  } else {
    // No schema found - use normalized args
    parsed.args = normalized;
  }
  return parsed;
  
  } catch (error) {
    console.error("🚨 planTool failed:", error?.message || error);
    // Return a safe fallback
    return {
      tool: "none",
      args: {},
      confidence: 0.0,
      reason: `Planning failed: ${error?.message || "Unknown error"}`
    };
  }
}

function buildGrammarFromTemplate() {
  const tmpl = fs.readFileSync(path.resolve("prompts/toolcall.gbnf.tmpl"), "utf-8");
  const enumVals = toolRegistry.map(t => `"${t.name}"`).join(" | ");
  return tmpl.replace("{{TOOL_ENUM}}", enumVals);
}

module.exports = { detectTool, planTool, buildGrammarFromTemplate };