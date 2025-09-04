"use strict";
const { z } = require('../util/zod');

// Permissive, coercive schemas (accept extra fields, coerce types)
const shellRunSchema = z.object({
  cmd: z.coerce.string().min(1, "cmd required"),
  timeout: z.coerce.number().int().positive().optional()
}).passthrough();

const scriptRunSchema = z.object({
  path: z.coerce.string().min(1, "path required"),
  // accept either string "arg1 arg2" or ["arg1","arg2"]
  args: z.union([z.string(), z.array(z.coerce.string())])
          .transform(v => Array.isArray(v) ? v : v.trim() ? v.trim().split(/\s+/) : [])
          .optional(),
  timeout: z.coerce.number().int().positive().optional()
}).passthrough();

const fsReadSchema = z.object({
  path: z.coerce.string().min(1, "path required"),
  encoding: z.union([z.literal("utf-8"), z.literal("base64"), z.coerce.string()])
              .transform(v => (v === "base64" ? "base64" : "utf-8"))
              .optional()
}).passthrough();

const fsWriteSchema = z.object({
  path: z.coerce.string().min(1, "path required"),
  content: z.coerce.string(),
  createDirs: z.coerce.boolean().optional()
}).passthrough();

// ----- New tools -----
const webSearchSchema = z.object({
  q: z.string().min(1).describe("Query text"),
  num: z.number().int().min(1).max(20).optional(),
  // Accept alternate keys; router normalizeArgs will map them into q/num
  query: z.string().optional(),
  num_results: z.number().int().min(1).max(20).optional(),
  k: z.number().int().min(1).max(20).optional(),
  top_k: z.number().int().min(1).max(20).optional(),
  limit: z.number().int().min(1).max(20).optional(),
  safe: z.boolean().optional()
}).passthrough();

const texCompileSchema = z.object({
  mainFile: z.coerce.string().min(1, "main .tex file"),
  engine: z.enum(["pdflatex", "xelatex"]).optional().default("pdflatex"),
  outputDir: z.coerce.string().optional().default("build/tex"),
  nonstop: z.coerce.boolean().optional().default(true)
}).passthrough();

const ffmpegSchema = z.object({
  input: z.coerce.string().min(1, "input required"),
  output: z.coerce.string().min(1, "output required"),
  // either a full arg string or array; both coerced to array
  args: z.union([z.string(), z.array(z.coerce.string())]).optional()
        .transform(v => Array.isArray(v) ? v : (v ? v.trim().split(/\s+/) : [])),
  overwrite: z.coerce.boolean().optional().default(true),
  timeout: z.coerce.number().int().positive().optional()
}).passthrough();

const imageConvertSchema = z.object({
  input: z.coerce.string().min(1),
  output: z.coerce.string().min(1),
  resize: z.coerce.string().optional(),   // e.g., "1024x768" or "50%"
  quality: z.coerce.number().int().min(1).max(100).optional(),
  format: z.coerce.string().optional()     // e.g., "png","jpg","webp"
}).passthrough();

// ----- Communications & integrations -----
const ghListSchema = z.object({
  owner: z.coerce.string(),
  repo: z.coerce.string(),
  state: z.enum(["open","closed","all"]).optional().default("open"),
  labels: z.union([z.string(), z.array(z.string())]).optional()
}).passthrough();

const ghCreateSchema = z.object({
  owner: z.coerce.string(),
  repo: z.coerce.string(),
  title: z.coerce.string().min(1),
  body: z.coerce.string().optional(),
  labels: z.union([z.string(), z.array(z.string())]).optional()
}).passthrough();

const ghCommentSchema = z.object({
  owner: z.coerce.string(),
  repo: z.coerce.string(),
  issueNumber: z.coerce.number().int().positive(),
  body: z.coerce.string().min(1)
}).passthrough();

const mailSendSchema = z.object({
  to: z.coerce.string().min(3),
  subject: z.coerce.string().min(1),
  text: z.coerce.string().optional(),
  html: z.coerce.string().optional()
}).passthrough().refine(v => v.text || v.html, { message: "Either text or html is required" });

const whatsappSendSchema = z.object({
  to: z.coerce.string().min(3),   // E.164 like +91..., will prefix 'whatsapp:' in runner
  body: z.coerce.string().min(1)
}).passthrough();

const commandRunSchema = z.object({
  name: z.coerce.string().min(1),
  params: z.record(z.any()).optional()
}).passthrough();

// ----- External API tools -----
const rssReadSchema = z.object({
  rss_id: z.coerce.number().int().positive().optional().default(8)
}).passthrough();

const creamFetchSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10)
}).passthrough();

const creamMailSchema = z.object({
  from_email: z.string().email("Valid email required"),
  from_name: z.string().optional(),
  to_email: z.string().email("Valid email required"),
  to_name: z.string().optional(), 
  subject: z.string().min(1, "Subject required"),
  body: z.string().min(1, "Email body required")
}).passthrough();

const creamPostSchema = z.object({
  content: z.string().min(1, "Post content required"),
  visibility: z.enum(["public", "private"]).optional().default("public"),
  media: z.array(z.any()).optional()
}).passthrough();

const youtubeSearchSchema = z.object({
  query: z.string().min(1, "Search query required"),
  max_results: z.coerce.number().int().min(1).max(50).optional().default(5),
  order: z.enum(["relevance", "date", "rating", "viewCount", "title"]).optional().default("relevance")
}).passthrough();

const youtubeTrendingSchema = z.object({
  region: z.string().length(2).optional().default("US"),
  max_results: z.coerce.number().int().min(1).max(50).optional().default(10)
}).passthrough();

const apiStatusSchema = z.object({}).passthrough();

const terminalRunSchema = z.object({
  command: z.coerce.string().min(1, "command required")
}).passthrough();

// Ensure registry includes web.search
const jitSchema = z.object({
  type: z.string().min(1, "JIT type required"),
  expression: z.string().optional(),
  file: z.string().optional(),
  xml: z.string().optional(),
  description: z.string().optional(),
  prompt: z.string().optional(),
  request: z.string().optional()
}).passthrough();

const toolRegistry = [
  { name: "shell.run",  description: "Run a shell command", schema: shellRunSchema },
  { name: "script.run", description: "Run a local script with args", schema: scriptRunSchema },
  { name: "fs.read",    description: "Read a file", schema: fsReadSchema },
  { name: "fs.write",   description: "Write a file", schema: fsWriteSchema },
  { name: "terminal.run", description: "Spawns a new terminal and runs a command.", schema: terminalRunSchema },
  {
    name: "jit",
    description: "Execute Just-In-Time applications for calculations, analysis, executive requests, and function generation",
    schema: jitSchema
  },
  {
    name: "web.search",
    description: "Search the web and return top results.",
    schema: webSearchSchema
  },
  { name: "tex.compile",description: "Compile LaTeX to PDF", schema: texCompileSchema },
  { name: "ffmpeg.run", description: "Run ffmpeg on media", schema: ffmpegSchema },
  { name: "image.convert", description: "Convert/resize images (ImageMagick)", schema: imageConvertSchema },
  { name: "gh.issues.list", description: "List GitHub issues", schema: ghListSchema },
  { name: "gh.issues.create", description: "Create a GitHub issue", schema: ghCreateSchema },
  { name: "gh.issues.comment", description: "Comment on a GitHub issue", schema: ghCommentSchema },
  { name: "mail.send", description: "Send an email via SMTP", schema: mailSendSchema },
  { name: "whatsapp.send", description: "Send a WhatsApp message via Twilio", schema: whatsappSendSchema },
  { name: "command.run", description: "Run a named command alias that maps to a tool", schema: commandRunSchema },
  // External API tools
  { name: "rss.read", description: "Read RSS feeds from KnoblyCream", schema: rssReadSchema },
  { name: "cream.fetch", description: "Fetch recent posts from KnoblyCream", schema: creamFetchSchema },
  { name: "cream.mail", description: "Send emails via KnoblyCream API", schema: creamMailSchema },
  { name: "cream.post", description: "Create posts on KnoblyCream with media support", schema: creamPostSchema },
  { name: "youtube.search", description: "Search for videos on YouTube", schema: youtubeSearchSchema },
  { name: "youtube.trending", description: "Get trending YouTube videos by region", schema: youtubeTrendingSchema },
  { name: "api.status", description: "Check status of external API integrations", schema: apiStatusSchema }
];

function getToolSummaries() {
  return toolRegistry.map(t => `${t.name} – ${t.description}`);
}

// Map name -> schema
function toolSchemaByName(name) {
  const t = toolRegistry.find(t => t.name === name);
  if (name === 'web.search') return webSearchSchema;
  return t ? t.schema : undefined;
}

module.exports = { toolRegistry, getToolSummaries, toolSchemaByName };