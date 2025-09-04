// Commander subcommand: `c9ai agent`
const { getLocalProvider } = require("../providers");
const { agentStep } = require("../agent/runStep");
const { makeSynthesizer } = require("../agent/synthesize");
const { runTool } = require("../tools/runner");
const fs = require("node:fs");
const path = require("node:path");
const { loadAgentConfig } = require("../utils/agentConfig");

async function runAgentCommand({ prompt, file, providerName, allowedTools, confirmThreshold }) {
  const cfg = loadAgentConfig(process.cwd());
  const provider = getLocalProvider(
    providerName || cfg.provider || process.env.LOCAL_PROVIDER || "llamacpp"
  );

  // If no prompt arg, read from stdin
  if (!prompt && file) {
    const p = path.resolve(file);
    prompt = fs.readFileSync(p, "utf8");
  } else if (!prompt) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    prompt = Buffer.concat(chunks).toString("utf8").trim();
  }
  if (!prompt) {
    console.error("No prompt provided. Usage: c9ai agent \"<your task>\"");
    process.exit(1);
  }

  const options = {
    allowedTools: (Array.isArray(allowedTools) && allowedTools.length)
      ? allowedTools
      : (cfg.allowedTools || ["shell.run","script.run","fs.read","fs.write"]),
    runTool: (name, args) => runTool(name, args),
    synthesize: makeSynthesizer(provider),
    confirmThreshold: (typeof confirmThreshold === "number" ? confirmThreshold : (cfg.confirmThreshold ?? 0.6)),
    on: {
      status: s => console.log(`🟡 ${s}…`),
      detected: t => console.log(`🔎 detected: ${t}`),
      planned: p => console.log(`🧭 plan: ${JSON.stringify(p)}`),
      toolStart: (n,a) => console.log(`🔧 ${n} ${JSON.stringify(a)}`),
      toolResult: (n,r) => console.log(`🛠️ ${n} → ${typeof r==='string'?r:JSON.stringify(r)}`),
      error: (where,e)=>console.error(`❌ ${where}:`, e && e.message ? e.message : e),
      final: txt => console.log("\nFINAL:\n", txt)
    }
  };

  console.log("🤖 Agent step starting…");
  await agentStep(provider, prompt, options);
}

function registerAgentCommand(program) {
  program
    .command("agent")
    .description("Run the agent loop (local models can call tools)")
    .allowExcessArguments(true)
    .argument("[prompt...]", "task to perform")
    .option("-p, --provider <name>", "local provider (llamacpp|ollama)", process.env.LOCAL_PROVIDER || "llamacpp")
    .option("-t, --threshold <num>", "confirm threshold (0..1)", v => parseFloat(v), 0.6)
    .option("-a, --allow <tools>", "comma-separated tools", v => v.split(","))
    .option("-f, --file <path>", "read prompt from file")
    .action(async (promptWords, opts) => {
      const prompt = Array.isArray(promptWords) ? promptWords.join(" ").trim() : promptWords;
      await runAgentCommand({
        prompt,
        file: opts.file,
        providerName: opts.provider,
        allowedTools: opts.allow,
        confirmThreshold: opts.threshold
      });
    });
}

module.exports = { registerAgentCommand, runAgentCommand };