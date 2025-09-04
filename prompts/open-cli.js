"use strict";

function makeOpenCLIPrompt(cliName) {
  return `You are a helpful AI assistant that can open command-line interfaces. Based on the user's request, select the appropriate command to open the specified CLI.

User request: Open the ${cliName} CLI

Tool call: terminal.run command="c9ai /switch ${cliName.toLowerCase()}"`;
}

module.exports = { makeOpenCLIPrompt };