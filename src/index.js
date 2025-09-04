#!/usr/bin/env node

const { registerAgentCommand } = require("./cli/agent-command");
const { program } = require('commander');
const chalk = require('chalk');
const readline = require('readline');
const C9AI = require('./core/C9AICore');
const Logger = require('./utils/logger');
const path = require('path');

const c9ai = new C9AI();

// ASCII Art Banner
const banner = `
${chalk.cyan('🌟 ============================================ 🌟')}
${chalk.cyan('    ____  ___    _    ___                        ')}
${chalk.cyan('   / ___|/ _ \\  / \\  |_ _|                       ')}
${chalk.cyan('  | |   | (_) |/ _ \\  | |                        ')}
${chalk.cyan('  | |___|\\__, / ___ \\ | |                        ')}
${chalk.cyan('   \\____| /_/_/   \\_\\___|                       ')}
${chalk.cyan('                                                 ')}
${chalk.yellow('  Autonomous AI-Powered Productivity System     ')}
${chalk.green('  🤖 Claude CLI    ✨ Gemini CLI    🚀 Tool Use  ')}
${chalk.cyan('🌟 ============================================ 🌟')}
`;

// --- Interactive Mode Function ---
async function interactiveMode() {
  await c9ai.init();
  console.log(banner);
  Logger.info('Welcome to c9ai. Type "help" for commands or "exit" to quit.');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('c9ai> '),
    terminal: true
  });

  const safeHandle = async (input) => {
    try {
      console.log(`Handling command: ${input}`);
      
      // Check if this should be routed to the agentic system
      if (shouldUseAgent(input)) {
        const { runAgentCommand } = require("./cli/agent-command");
        await runAgentCommand({ prompt: input });
      } else {
        await c9ai.handleCommand(input);
      }
    } catch (err) {
      Logger.error(`Unhandled error: ${err?.message || err}`);
    }
  };

  // Determine if input should use agentic system vs basic commands  
  function shouldUseAgent(input) {
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    
    // System commands that should use old handler (not agent)
    if (lower.startsWith('help') || 
        lower.startsWith('models') || 
        lower.startsWith('switch') ||
        lower === 'exit' || 
        lower === 'quit') {
      return false;
    }
    
    // Sigil-based task detection - explicit and clean
    // Any @ sigil indicates task/tool usage
    if (trimmed.startsWith('@')) {
      return true;
    }
    
    // Default: use simple chat for natural conversation
    return false;
  }

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) {
      rl.prompt();
      return;
    }
    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      rl.close();
      return;
    }
    await safeHandle(input);
    rl.prompt(); // always continue
  });

  rl.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Press Ctrl+C again to exit, or type "exit".'));
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(chalk.yellow('\n👋 Thanks for using c9ai!'));
    process.exit(0);
  });

  // Keep process alive in case of stray async errors
  process.on('uncaughtException', (err) => {
    Logger.error(`uncaughtException: ${err?.stack || err}`);
  });
  process.on('unhandledRejection', (reason) => {
    Logger.error(`unhandledRejection: ${reason}`);
  });

  rl.prompt();
}

// --- CLI Command Definitions ---
program
    .name('c9ai')
    .description('C9 AI - Autonomous AI-Powered Productivity System')
    .version('1.0.0');

program
    .command('switch <model>')
    .description('Switch default AI model (claude|gemini|local)')
    .action(async (model) => {
        await c9ai.init();
        await c9ai.modelHandler.switchModel(model);
    });

program
    .command('models [action]')
    .description('Manage local AI models (list)')
    .action(async (action) => {
        await c9ai.init();
        await c9ai.modelHandler.handle([action]);
    });

program
    .command('todo <action>')
    .description('Todo management: list, fetch-github, fetch-gdrive, execute <id>, sync')
    .option('-r, --repo <repo>', 'GitHub repository (owner/repo)', 'hebbarp/todo-management')
    .option('-l, --labels <labels>', 'Filter GitHub issues by labels (comma-separated)')
    .option('-q, --query <query>', 'Search query for Google Drive documents', 'todo')
    .option('-f, --format <format>', 'Document format (txt, md, doc)', 'txt')
    .option('-i, --id <id>', 'Todo ID to execute')
    .option('-d, --dry-run', 'Show what would be executed without running', true)
    .option('-n, --no-dry-run', 'Actually execute the commands')
    .action(async (action, opts) => {
        const { handleTodos } = require('./handlers/todoHandler');
        await handleTodos(action, opts);
    });

program
  .command('stack')
  .description('Start local llama.cpp server and Agent API')
  .option('-m, --model <path>', 'Path to a .gguf model')
  .option('-p, --port <port>', 'llama.cpp port (default 8080)', '8080')
  .action(async (opts) => {
    const { spawn } = require('child_process');
    const script = path.join(__dirname, '..', 'scripts', 'start-local-stack.js');
    const env = {
      ...process.env,
      ...(opts.model ? { LLAMACPP_MODEL: opts.model } : {}),
      ...(opts.port ? { LLAMACPP_BASE_URL: `http://127.0.0.1:${opts.port}` } : {})
    };
    const child = spawn(process.execPath, [script], { stdio: 'inherit', env });
    child.on('exit', (code) => process.exit(code ?? 0));
  });

// --- Main Application Logic ---
async function run() {
    // If no commands are passed, start interactive mode
    if (process.argv.length <= 2) {
        await interactiveMode();
    } else {
        // Otherwise, parse the command-line arguments
        registerAgentCommand(program);
        await program.parseAsync(process.argv);
    }
}

// --- Run the app and handle errors ---
run().catch(error => {
    Logger.error('A critical error occurred:', error.message);
    process.exit(1);
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
    Logger.error('Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    Logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log(chalk.yellow('\n👋 Shutting down gracefully...'));
    process.exit(0);
});