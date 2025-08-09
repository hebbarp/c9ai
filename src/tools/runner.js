"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

function runShell(cmd, timeout) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, { shell: true, stdio: ["ignore","pipe","pipe"], timeout });
    let out = "", err = "";
    child.stdout.on("data", d => out += d.toString());
    child.stderr.on("data", d => err += d.toString());
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout: out.trim(), stderr: err.trim() }));
  });
}

function runScript(p, args = [], timeout) {
  return new Promise((resolve, reject) => {
    const abs = path.resolve(p);
    const child = spawn(abs, args, { stdio: ["ignore","pipe","pipe"], timeout });
    let out = "", err = "";
    child.stdout.on("data", d => out += d.toString());
    child.stderr.on("data", d => err += d.toString());
    child.on("error", reject);
    child.on("close", code => resolve({ code, stdout: out.trim(), stderr: err.trim() }));
  });
}

async function runTool(name, args) {
  if (name === "shell.run") {
    return await runShell(args.cmd, args.timeout);
  }
  if (name === "script.run") {
    return await runScript(args.path, args.args || [], args.timeout);
  }
  if (name === "fs.read") {
    const enc = args.encoding || "utf-8";
    const p = path.resolve(args.path);
    return { path: p, content: fs.readFileSync(p, enc) };
  }
  if (name === "fs.write") {
    const p = path.resolve(args.path);
    if (args.createDirs) fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, args.content, "utf-8");
    return { path: p, ok: true };
  }
  throw new Error(`Unknown tool: ${name}`);
}

module.exports = { runTool };