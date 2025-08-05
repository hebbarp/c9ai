#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const C9AI = require('./c9ai-core');

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

// Core CLI instance
const c9ai = new C9AI();

// Interactive mode
async function interactiveMode() {
    console.log(banner);
    console.log(chalk.cyan('\nNew in this version: Type @claude or @gemini to start an interactive session!'));

    console.log(chalk.green('\nQuick Actions:'));
    console.log(chalk.white('  claude <prompt>   - Quick prompt to Claude'));
    console.log(chalk.white('  gemini <prompt>   - Quick prompt to Gemini'));
    console.log(chalk.white('  todos             - Manage your tasks'));
    console.log(chalk.white('  help              - Show all commands'));
    console.log(chalk.white('  exit              - Quit c9ai\n'));

    while (true) {
        try {
            const { command } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'command',
                    message: chalk.cyan('c9ai>'),
                    prefix: ''
                }
            ]);

            if (command.trim() === 'exit' || command.trim() === 'quit') {
                console.log(chalk.yellow('\\n👋 Thanks for using C9 AI!'));
                process.exit(0);
            }

            if (command.trim() === '') continue;

            await c9ai.handleCommand(command.trim());
        } catch (error) {
            if (error.isTtyError) {
                console.log(chalk.red('Interactive mode not supported in this environment'));
                process.exit(1);
            } else {
                console.error(chalk.red('Error:'), error.message);
            }
        }
    }
}

// CLI Commands
program
    .name('c9ai')
    .description('C9 AI - Autonomous AI-Powered Productivity System')
    .version('2.0.0');

program
    .command('switch <model>')
    .description('Switch default AI model (claude|gemini)')
    .action(async (model) => {
        await c9ai.switchModel(model);
    });

program
    .command('todos [action] [task...]')
    .description('Manage todos (list|add|execute|sync)')
    .action(async (action, task) => {
        await c9ai.handleTodos(action, task);
    });

program
    .command('analytics')
    .description('Show productivity analytics')
    .action(async () => {
        await c9ai.showAnalytics();
    });

program
    .command('tools')
    .description('List available tools')
    .action(async () => {
        await c9ai.listTools();
    });

program
    .command('models [action] [model]')
    .description('Manage local AI models (list|install|remove|status)')
    .action(async (action, model) => {
        await c9ai.handleModels(action, model);
    });

program
    .command('logo')
    .alias('banner')
    .description('Display the c9ai banner')
    .action(() => {
        console.log(banner);
    });

program
    .command('interactive')
    .alias('i')
    .description('Start interactive mode')
    .action(interactiveMode);

// Default action - start interactive mode
if (process.argv.length === 2) {
    interactiveMode();
} else {
    program.parse();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error(chalk.red('\\n❌ Uncaught Error:'), error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red('\\n❌ Unhandled Rejection:'), reason);
    process.exit(1);
});