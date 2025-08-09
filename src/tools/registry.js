"use strict";
const { z } = require("zod");

// Schemas for tool args
const shellRunSchema = z.object({
  cmd: z.string(),
  timeout: z.number().int().positive().optional()
});
const scriptRunSchema = z.object({
  path: z.string(),
  args: z.array(z.string()).optional(),
  timeout: z.number().int().positive().optional()
});
const fsReadSchema = z.object({
  path: z.string(),
  encoding: z.enum(["utf-8","base64"]).optional()
});
const fsWriteSchema = z.object({
  path: z.string(),
  content: z.string(),
  createDirs: z.boolean().optional()
});

const toolRegistry = [
  { name: "shell.run",  description: "Run a shell command", schema: shellRunSchema },
  { name: "script.run", description: "Run a local script file", schema: scriptRunSchema },
  { name: "fs.read",    description: "Read a file", schema: fsReadSchema },
  { name: "fs.write",   description: "Write a file", schema: fsWriteSchema }
];

function getToolSummaries() {
  return [
    `shell.run → {"cmd": string, "timeout"?: number}`,
    `script.run → {"path": string, "args"?: string[], "timeout"?: number}`,
    `fs.read → {"path": string, "encoding"?: "utf-8"|"base64"}`,
    `fs.write → {"path": string, "content": string, "createDirs"?: boolean}`
  ];
}

function toolSchemaByName(name) {
  const t = toolRegistry.find(t => t.name === name);
  return t ? t.schema : undefined;
}

module.exports = { toolRegistry, getToolSummaries, toolSchemaByName };