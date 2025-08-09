"use strict";
function makeSynthesizer(provider, model) {
  return async (prompt, toolName, toolResult) => {
    const system = "You are a results synthesizer. Use the tool output verbatim for facts. If content is missing, ask for another tool step. Be concise and actionable.";
    const body = (toolResult ? (typeof toolResult === "string" ? toolResult : JSON.stringify(toolResult, null, 2)) : "(no tool run)");
    const user = `User request:\n${prompt}\n\nTool run:\n[${toolName} result]\n${body}`;
    const out = await provider.call({
      model: model || provider.defaultModel,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.4
    });
    return out.text || "";
  };
}
module.exports = { makeSynthesizer };