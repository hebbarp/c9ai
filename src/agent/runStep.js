"use strict";
const { detectTool, planTool, buildGrammarFromTemplate } = require("./router");

/**
 * @param {*} provider ChatProvider-like object with .defaultModel and .call()
 * @param {string} prompt
 * @param {{ allowedTools: string[], maxSteps?: number, confirmThreshold?: number,
 *           runTool: (name:string,args:any)=>Promise<any>,
 *           synthesize: (prompt:string, toolName:string|"none", toolResult?:any)=>Promise<string> }} ctx
 */
async function agentStep(provider, prompt, ctx) {
  const choice = await detectTool(provider, prompt);
  if (choice === "none") return ctx.synthesize(prompt, "none");

  const grammar = provider.supportsGrammar ? buildGrammarFromTemplate() : undefined;
  const plan = await planTool(provider, prompt, "", grammar);
  if (plan.tool === "none") return ctx.synthesize(prompt, "none");

  if (!ctx.allowedTools.includes(plan.tool) || (plan.confidence ?? 0) < (ctx.confirmThreshold ?? 0.6)) {
    return `I propose to run **${plan.tool}** with:\n\`\`\`json\n${JSON.stringify(plan.args, null, 2)}\n\`\`\`\nProceed? (y/n)`;
  }
  const result = await ctx.runTool(plan.tool, plan.args);
  return ctx.synthesize(prompt, plan.tool, result);
}

module.exports = { agentStep };