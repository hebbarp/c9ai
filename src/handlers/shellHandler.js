const { spawn } = require('child_process');
const Logger = require('../utils/logger');

async function handleShellCommand(command) {
  return new Promise((resolve) => {
    const child = spawn(command, { shell: true });
    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('close', (code) => {
      if (code !== 0) Logger.warn(`Shell command exited with code ${code}`);
      resolve();
    });
    child.on('error', (err) => {
      Logger.error(`Shell command error: ${err.message}`);
      resolve();
    });
  });
}

module.exports = { handleShellCommand };
