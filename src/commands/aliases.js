"use strict";
/**
 * Simple alias registry: map friendly command names to underlying tool + arg templates.
 * You can add as many as you like. Params are interpolated with {{param}}.
 */
const aliases = {
  "send-email": {
    tool: "mail.send",
    args: { to: "{{to}}", subject: "{{subject}}", text: "{{text}}", html: "{{html}}" }
  },
  "notify-whatsapp": {
    tool: "whatsapp.send",
    args: { to: "{{to}}", body: "{{body}}" }
  },
  "list-issues": {
    tool: "gh.issues.list",
    args: { owner: "{{owner}}", repo: "{{repo}}", state: "{{state}}" }
  },
  "create-issue": {
    tool: "gh.issues.create",
    args: { owner: "{{owner}}", repo: "{{repo}}", title: "{{title}}", body: "{{body}}", labels: "{{labels}}" }
  },
  "comment-issue": {
    tool: "gh.issues.comment",
    args: { owner: "{{owner}}", repo: "{{repo}}", issueNumber: "{{issueNumber}}", body: "{{body}}" }
  }
};

function render(template, params = {}) {
  if (template == null) return template;
  if (Array.isArray(template)) return template.map(v => render(v, params));
  if (typeof template === "object") {
    const out = {};
    for (const k of Object.keys(template)) out[k] = render(template[k], params);
    return out;
  }
  if (typeof template === "string") {
    return template.replace(/\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}/g, (_, key) => {
      const val = params[key];
      return val == null ? "" : String(val);
    });
  }
  return template;
}

function resolveAlias(name, params) {
  const a = aliases[name];
  if (!a) throw new Error(`Unknown command alias: ${name}`);
  return { tool: a.tool, args: render(a.args, params || {}) };
}

module.exports = { aliases, resolveAlias };