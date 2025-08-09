*** Begin Patch
*** Add File: prompts/passA_classifier.system.md
+Role: Tool-Use Classifier
+
+You have access to the following tools: {{TOOL_NAMES}}
+Examples:
+Q: "What does this code do: src/index.ts?"
+A: fs.read
+Q: "Explain what a hash map is."
+A: none
+Q: "Run the tests and tell me what failed."
+A: shell.run
+
+Decide if the user's request REQUIRES a tool to be executed correctly.
+- If YES, reply with EXACTLY one tool name from {{TOOL_NAMES}}.
+- If NO, reply with EXACTLY: none
+No punctuation, no extra words.
+
+Rules:
+- Prefer reading files over guessing their contents.
+- If the user asks to run code/commands, that is a tool need.
+- If the user asks general knowledge or explanation without external actions, respond: none.
*** End Patch
*** Begin Patch
*** Add File: prompts/passB_planner.system.md
+Role: Tool Call Planner
+
+You must return STRICT JSON for a SINGLE action:
+{"tool":"<name>","args":{...},"confidence":0.00-1.00,"reason":"<one sentence>"}
+
+Tools available (name → JSON args schema summary):
+{{TOOL_SUMMARY}}
+
+Rules:
+1) If a tool is NOT needed, return:
+   {"tool":"none","args":{},"confidence":0.60,"reason":"General knowledge."}
+2) If a tool IS needed, pick exactly ONE tool, fill only REQUIRED args.
+3) Confidence is 0..1. Be honest; <0.6 means “ask for confirmation”.
+4) No extra text. JSON only.
+5) Prefer reading files before making claims about them.
+
+Few-shot:
+{"tool":"none","args":{},"confidence":0.74,"reason":"Answerable without external actions."}
+{"tool":"fs.read","args":{"path":"src/index.ts"},"confidence":0.78,"reason":"Need to inspect file content."}
+{"tool":"shell.run","args":{"cmd":"npm test -- --reporter json","timeout":300000},"confidence":0.83,"reason":"Must obtain real test failures."}
+{"tool":"fs.write","args":{"path":"README.md","content":"# Project overview...","createDirs":true},"confidence":0.69,"reason":"Requested to write a new file."}
*** End Patch
*** Begin Patch
*** Add File: prompts/json_repair.system.md
+Role: JSON Repair Assistant
+You fix malformed JSON objects into valid JSON that matches the caller's schema.
+Return JSON only. No commentary. Never add fields not in the original intent.
*** End Patch
*** Begin Patch
*** Add File: prompts/toolcall.gbnf.tmpl
+root ::= ws object ws
+object ::= "{" ws members ws "}"
+members ::= member (ws "," ws member)*
+
+member ::= key_tool | key_args | key_conf | key_reason
+
+key_tool ::= "\"tool\"" ws ":" ws tool_name
+tool_name ::= "\"" ( {{TOOL_ENUM}} | "none" ) "\""
+
+key_args ::= "\"args\"" ws ":" ws args_obj
+; NOTE: by default we allow generic JSON; optionally replace args_obj with per-tool grammars.
+args_obj ::= "{" ws (pair (ws "," ws pair)*)? ws "}"
+pair ::= string ws ":" ws value
+
+key_conf ::= "\"confidence\"" ws ":" ws number
+key_reason ::= "\"reason\"" ws ":" ws string
+
+value ::= string | number | obj | arr | "true" | "false" | "null"
+obj ::= "{" ws (pair (ws "," ws pair)*)? ws "}"
+arr ::= "[" ws (value (ws "," ws value)*)? ws "]"
+string ::= "\"" chars "\""
+chars ::= ([^"\\] | escape)*
+escape ::= "\\" ["\\/bfnrt] | "\\u" hex hex hex hex
+hex ::= [0-9a-fA-F]
+number ::= "-"? int frac? exp?
+int ::= "0" | [1-9][0-9]*
+frac ::= "." [0-9]+
+exp ::= [eE] [-+]? [0-9]+
+ws ::= [ \t\n\r]*
*** End Patch
*** Begin Patch
*** Add File: src/providers/types.js
+"use strict";
+/**
+ * Generic provider interface used by the agent router.
+ * Implement this via a thin shim over your existing local/cloud providers.
+ */
+module.exports.ChatProvider = {};
+// JSDoc typing (CommonJS friendly)
+/**
+ * @typedef {{ role: "system"|"user"|"assistant", content: string }} Msg
+ * @typedef {{ name: string, description: string, schema: object }} ToolSpec
+ * @typedef {Object} ProviderCallOpts
+ * @property {string} model
+ * @property {Msg[]} messages
+ * @property {number} [temperature]
+ * @property {number} [top_p]
+ * @property {number} [max_tokens]
+ * @property {string} [grammar]
+ * @property {ToolSpec[]} [tools]
+ * @property {(chunk:string)=>void} [onToken]
+ */
*** End Patch
*** Begin Patch
*** Add File: src/tools/registry.js
+"use strict";
+const { z } = require("zod");
+
+// Schemas for tool args
+const shellRunSchema = z.object({
+  cmd: z.string(),
+  timeout: z.number().int().positive().optional()
+});
+const scriptRunSchema = z.object({
+  path: z.string(),
+  args: z.array(z.string()).optional(),
+  timeout: z.number().int().positive().optional()
+});
+const fsReadSchema = z.object({
+  path: z.string(),
+  encoding: z.enum(["utf-8","base64"]).optional()
+});
+const fsWriteSchema = z.object({
+  path: z.string(),
+  content: z.string(),
+  createDirs: z.boolean().optional()
+});
+
+const toolRegistry = [
+  { name: "shell.run",  description: "Run a shell command", schema: shellRunSchema },
+  { name: "script.run", description: "Run a local script file", schema: scriptRunSchema },
+  { name: "fs.read",    description: "Read a file", schema: fsReadSchema },
+  { name: "fs.write",   description: "Write a file", schema: fsWriteSchema }
+];
+
+function getToolSummaries() {
+  return [
+    `shell.run → {"cmd": string, "timeout"?: number}`,
+    `script.run → {"path": string, "args"?: string[], "timeout"?: number}`,
+    `fs.read → {"path": string, "encoding"?: "utf-8"|"base64"}`,
+    `fs.write → {"path": string, "content": string, "createDirs"?: boolean}`
+  ];
+}
+
+function toolSchemaByName(name) {
+  const t = toolRegistry.find(t => t.name === name);
+  return t ? t.schema : undefined;
+}
+
+module.exports = { toolRegistry, getToolSummaries, toolSchemaByName };
*** End Patch
*** Begin Patch
*** Add File: src/tools/runner.js
+"use strict";
+const fs = require("node:fs");
+const path = require("node:path");
+const { spawn } = require("node:child_process");
+
+function runShell(cmd, timeout) {
+  return new Promise((resolve, reject) => {
+    const child = spawn(cmd, { shell: true, stdio: ["ignore","pipe","pipe"], timeout });
+    let out = "", err = "";
+    child.stdout.on("data", d => out += d.toString());
+    child.stderr.on("data", d => err += d.toString());
+    child.on("error", reject);
+    child.on("close", code => resolve({ code, stdout: out.trim(), stderr: err.trim() }));
+  });
+}
+
+function runScript(p, args = [], timeout) {
+  return new Promise((resolve, reject) => {
+    const abs = path.resolve(p);
+    const child = spawn(abs, args, { stdio: ["ignore","pipe","pipe"], timeout });
+    let out = "", err = "";
+    child.stdout.on("data", d => out += d.toString());
+    child.stderr.on("data", d => err += d.toString());
+    child.on("error", reject);
+    child.on("close", code => resolve({ code, stdout: out.trim(), stderr: err.trim() }));
+  });
+}
+
+async function runTool(name, args) {
+  if (name === "shell.run") {
+    return await runShell(args.cmd, args.timeout);
+  }
+  if (name === "script.run") {
+    return await runScript(args.path, args.args || [], args.timeout);
+  }
+  if (name === "fs.read") {
+    const enc = args.encoding || "utf-8";
+    const p = path.resolve(args.path);
+    return { path: p, content: fs.readFileSync(p, enc) };
+  }
+  if (name === "fs.write") {
+    const p = path.resolve(args.path);
+    if (args.createDirs) fs.mkdirSync(path.dirname(p), { recursive: true });
+    fs.writeFileSync(p, args.content, "utf-8");
+    return { path: p, ok: true };
+  }
+  throw new Error(`Unknown tool: ${name}`);
+}
+
+module.exports = { runTool };
*** End Patch
*** Begin Patch
*** Add File: src/agent/router.js
+"use strict";
+const fs = require("node:fs");
+const path = require("node:path");
+const { z } = require("zod");
+const { toolRegistry, getToolSummaries, toolSchemaByName } = require("../tools/registry");
+
+const ToolCall = z.object({
+  tool: z.string(),
+  args: z.record(z.any()),
+  confidence: z.number().min(0).max(1),
+  reason: z.string().min(1)
+});
+
+function loadPrompt(file) {
+  return fs.readFileSync(path.resolve(file), "utf-8");
+}
+function render(tmpl, vars) {
+  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ""));
+}
+
+async function detectTool(provider, prompt) {
+  const system = render(loadPrompt("prompts/passA_classifier.system.md"),
+    { TOOL_NAMES: toolRegistry.map(t => t.name).join(", ") });
+  const out = await provider.call({
+    model: provider.defaultModel,
+    messages: [{ role: "system", content: system }, { role: "user", content: `User request:\n${prompt}` }],
+    temperature: 0.1, max_tokens: 3
+  });
+  const t = (out.text || "").trim();
+  return toolRegistry.some(x => x.name === t) ? t : "none";
+}
+
+async function planTool(provider, prompt, contextSnippet = "", grammarGBNF) {
+  const sys = render(loadPrompt("prompts/passB_planner.system.md"),
+    { TOOL_SUMMARY: getToolSummaries().join("\n") });
+  const messages = [
+    { role: "system", content: sys },
+    { role: "user", content: `User request:\n${prompt}\n\nProject context (optional):\n${contextSnippet}` }
+  ];
+  const callOpts = { model: provider.defaultModel, messages, temperature: 0, top_p: 1, max_tokens: 512 };
+  if (provider.supportsGrammar && grammarGBNF) callOpts.grammar = grammarGBNF;
+  const raw = await provider.call(callOpts);
+  let json;
+  try { json = JSON.parse(raw.text || "{}"); }
+  catch {
+    const repairSys = loadPrompt("prompts/json_repair.system.md");
+    const rep = await provider.call({
+      model: provider.defaultModel,
+      temperature: 0,
+      messages: [
+        { role: "system", content: repairSys },
+        { role: "user", content: `Original (malformed):\n${raw.text}\n\nSchema error:\nInvalid JSON` }
+      ],
+      max_tokens: 512
+    });
+    json = JSON.parse(rep.text || "{}");
+  }
+  const parsed = ToolCall.parse(json);
+  const schema = toolSchemaByName(parsed.tool);
+  if (schema) schema.parse(parsed.args);
+  return parsed;
+}
+
+function buildGrammarFromTemplate() {
+  const tmpl = fs.readFileSync(path.resolve("prompts/toolcall.gbnf.tmpl"), "utf-8");
+  const enumVals = toolRegistry.map(t => `"${t.name}"`).join(" | ");
+  return tmpl.replace("{{TOOL_ENUM}}", enumVals);
+}
+
+module.exports = { detectTool, planTool, buildGrammarFromTemplate };
*** End Patch
*** Begin Patch
*** Add File: src/agent/runStep.js
+"use strict";
+const { detectTool, planTool, buildGrammarFromTemplate } = require("./router");
+
+/**
+ * @param {*} provider ChatProvider-like object with .defaultModel and .call()
+ * @param {string} prompt
+ * @param {{ allowedTools: string[], maxSteps?: number, confirmThreshold?: number,
+ *           runTool: (name:string,args:any)=>Promise<any>,
+ *           synthesize: (prompt:string, toolName:string|"none", toolResult?:any)=>Promise<string> }} ctx
+ */
+async function agentStep(provider, prompt, ctx) {
+  const choice = await detectTool(provider, prompt);
+  if (choice === "none") return ctx.synthesize(prompt, "none");
+
+  const grammar = provider.supportsGrammar ? buildGrammarFromTemplate() : undefined;
+  const plan = await planTool(provider, prompt, "", grammar);
+  if (plan.tool === "none") return ctx.synthesize(prompt, "none");
+
+  if (!ctx.allowedTools.includes(plan.tool) || (plan.confidence ?? 0) < (ctx.confirmThreshold ?? 0.6)) {
+    return `I propose to run **${plan.tool}** with:\n\`\`\`json\n${JSON.stringify(plan.args, null, 2)}\n\`\`\`\nProceed? (y/n)`;
+  }
+  const result = await ctx.runTool(plan.tool, plan.args);
+  return ctx.synthesize(prompt, plan.tool, result);
+}
+
+module.exports = { agentStep };
*** End Patch
*** Begin Patch
*** Add File: src/agent/synthesize.js
+"use strict";
+function makeSynthesizer(provider, model) {
+  return async (prompt, toolName, toolResult) => {
+    const system = "You are a results synthesizer. Use the tool output verbatim for facts. If content is missing, ask for another tool step. Be concise and actionable.";
+    const body = (toolResult ? (typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult, null, 2)) : "(no tool run)");
+    const user = `User request:\n${prompt}\n\nTool run:\n[${toolName} result]\n${body}`;
+    const out = await provider.call({
+      model: model || provider.defaultModel,
+      messages: [{ role: "system", content: system }, { role: "user", content: user }],
+      temperature: 0.4
+    });
+    return out.text || "";
+  };
+}
+module.exports = { makeSynthesizer };
*** End Patch
