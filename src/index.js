#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const readline = require('readline');
const C9AI = require('./core/C9AICore');
const Logger = require('./utils/logger');

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
    Logger.info('Welcome to C9AI. Type "help" for commands or "exit" to quit.');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('c9ai> '),
        removeHistoryDuplicates: true
    });

    rl.on('line', (line) => {
        const input = line.trim();
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
            rl.close();
            return;
        } 
        
        if (input) {
            // Handle command asynchronously but don't await in the event handler
            c9ai.handleCommand(input)
                .then(() => {
                    rl.prompt();
                })
                .catch((err) => {
                    Logger.error('Error:', err.message);
                    rl.prompt();
                });
        } else {
            rl.prompt();
        }
    });

    rl.on('close', () => {
        console.log(chalk.yellow('\n👋 Thanks for using C9AI!'));
        process.exit(0);
    });

    rl.on('SIGINT', () => {
        console.log(chalk.yellow('\n🛑 Received Ctrl+C. Type "exit" to quit gracefully.'));
        rl.prompt();
    });

    rl.on('error', (err) => {
        Logger.error('Readline error:', err.message);
        rl.prompt();
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

// --- Main Application Logic ---
async function run() {
    // If no commands are passed, start interactive mode
    if (process.argv.length <= 2) {
        await interactiveMode();
    } else {
        // Otherwise, parse the command-line arguments
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