#!/usr/bin/env node
/**
 * Injects the `agent` subcommand into a Commander-based CLI.
 * - Looks for common entry files: bin/c9ai, src/cli/index.js, src/cli/main.js
 * - Inserts:   const { registerAgentCommand } = require("../src/cli/agent-command");
 *              registerAgentCommand(program);
 *   immediately before the first occurrence of program.parse(...) or program.parseAsync(...)
 */
const fs = require("fs");
const path = require("path");

const candidates = [
  "src/index.js",
  "bin/c9ai",
  "src/cli/index.js",
  "src/cli/main.js"
];

function tryInject(file) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) return false;
  let src = fs.readFileSync(abs, "utf8");

  // Find a variable named `program` that calls .parse or .parseAsync
  const parseRE = /(program\s*\.\s*parse(?:Async)?\s*\([^)]*\)\s*;?)/;
  const hasParse = parseRE.test(src);
  if (!hasParse) return false;

  // Add import if missing
  const importLine = `const { registerAgentCommand } = require("../src/cli/agent-command");`;
  const importLineAlt = `const { registerAgentCommand } = require("./src/cli/agent-command");`;
  if (!src.includes("registerAgentCommand")) {
    // Choose relative path based on file location
    const isBin = file.startsWith("bin/");
    const imp = isBin ? importLine : importLineAlt;
    
    // Insert after shebang, then "use strict", or after first require
    if (/^#!/.test(src)) {
      const lines = src.split('\n');
      let insertIdx = 1; // After shebang
      
      // Skip empty lines and "use strict"
      while (insertIdx < lines.length && (lines[insertIdx].trim() === '' || /["']use strict["'];?/.test(lines[insertIdx]))) {
        insertIdx++;
      }
      
      lines.splice(insertIdx, 0, imp);
      src = lines.join('\n');
    } else if (/["']use strict["'];?/.test(src)) {
      src = src.replace(/(["']use strict["'];?)/, `$1\n${imp}`);
    } else {
      src = `${imp}\n${src}`;
    }
  }

  // Insert registration before parse
  if (!/registerAgentCommand\s*\(\s*program\s*\)/.test(src)) {
    src = src.replace(parseRE, `registerAgentCommand(program);\n$1`);
  }

  fs.writeFileSync(abs, src, "utf8");
  console.log(`✅ Injected agent subcommand into: ${file}`);
  return true;
}

let done = false;
for (const f of candidates) {
  try { if (tryInject(f)) { done = true; break; } } catch (e) { /* ignore and continue */ }
}
if (!done) {
  console.error("❌ Could not find a Commander entry file with program.parse(...) among:", candidates.join(", "));
  process.exit(1);
}