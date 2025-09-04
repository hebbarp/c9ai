"use strict";

const { spawn } = require("node:child_process");

/**
 * Execute shell commands
 */
async function shellRun(args) {
  const { command, cwd = process.cwd(), timeout = 30000, shell } = args;
  
  if (!command) {
    throw new Error("Command is required");
  }

  // Choose portable shell by platform or override
  let bin = "sh";
  let argv = ["-c", command];
  const plat = process.platform;
  const sel = String(shell || '').toLowerCase();
  if (plat === 'win32') {
    if (sel === 'powershell' || sel === 'pwsh') { bin = 'powershell.exe'; argv = ['-NoProfile','-Command', command]; }
    else if (sel === 'cmd') { bin = 'cmd.exe'; argv = ['/c', command]; }
    else { bin = 'cmd.exe'; argv = ['/c', command]; }
  } else {
    if (sel === 'bash') { bin = 'bash'; argv = ['-lc', command]; }
    else if (sel === 'zsh') { bin = 'zsh'; argv = ['-lc', command]; }
    else if (sel === 'sh' || sel === '') { bin = 'sh'; argv = ['-c', command]; }
    else { bin = sel; argv = ['-c', command]; }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(bin, argv, {
      cwd,
      stdio: ["inherit", "pipe", "pipe"],
      timeout
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({
        tool: "shell.run",
        success: code === 0,
        command,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    child.on("error", (error) => {
      reject(error);
    });

    // Handle timeout
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);
  });
}

module.exports = { shellRun };
