"use strict";
const { spawn } = require("child_process");
const os = require("os");

async function runInTerminal(command) {
  const platform = os.platform();
  let cmd, args;

  if (platform === "darwin") {
    cmd = "osascript";
    args = ["-e", `tell app "Terminal" to do script "${command}"`];
  } else if (platform === "win32") {
    cmd = "cmd.exe";
    args = ["/c", "start", "cmd.exe", "/k", command];
  } else {
    // Assumes a common terminal emulator is in the path
    cmd = "x-terminal-emulator";
    args = ["-e", command];
  }

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
    child.unref();
    child.on("error", (err) => {
      // Fallback for Linux if x-terminal-emulator is not found
      if (platform !== "win32" && platform !== "darwin") {
        const fallbackCmd = "gnome-terminal";
        const fallbackArgs = ["--", "bash", "-c", command];
        const fallbackChild = spawn(fallbackCmd, fallbackArgs, { detached: true, stdio: "ignore" });
        fallbackChild.unref();
        fallbackChild.on("error", reject);
        fallbackChild.on("exit", code => code === 0 ? resolve(`Successfully opened terminal with command: ${command}`) : reject(new Error(`Failed with exit code: ${code}`)));
      } else {
        reject(err);
      }
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(`Successfully opened terminal with command: ${command}`);
      } else {
        // Don't reject here if it's already handled by the error event
      }
    });
  });
}

module.exports = {
  name: "terminal.run",
  description: "Spawns a new terminal and runs a command, for example to open a CLI.",
  args: {
    command: {
      description: "The command to execute in the new terminal.",
      type: "string",
      required: true
    }
  },
  run: async function (args) {
    const { command } = args;
    if (!command) {
      throw new Error("Missing required argument: command");
    }
    return await runInTerminal(command);
  },
};