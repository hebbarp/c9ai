const chalk = require('chalk');

function showHelp() {
    console.log(chalk.cyan.bold('\nc9ai - Your AI-Powered Productivity Assistant\n'));
    
    console.log(chalk.yellow.bold('Usage:'));
    console.log('  Simply type your question or command and press Enter.');
    console.log('  For specific actions, use the commands or sigils below.\n');

    console.log(chalk.yellow.bold('Core Commands:'));
    console.log(`  ${chalk.green('switch <model>')}      - Switch the active AI model (claude, gemini, local).`);
    console.log(`  ${chalk.green('models list')}         - List all available models and see the current one.`);
    console.log(`  ${chalk.green('help')}                - Show this help message.`);
    console.log(`  ${chalk.green('exit | quit')}         - Exit the interactive shell.\n`);

    console.log(chalk.yellow.bold('Sigil Modes (for precise control):'));
    console.log(`  ${chalk.magenta('@<model> [prompt]')}   - Switch model or send a one-off prompt.`);
    console.log(`                        ${chalk.gray('Example: @gemini what is the capital of France?')}`);
    console.log(`  ${chalk.magenta('@conv <message>')}      - Force input to be treated as a conversation.`);
    console.log(`  ${chalk.magenta('@cmd <command>')}       - Force input to be treated as a core command.\n`);

    console.log(chalk.yellow.bold('Shell Commands:'));
    console.log(`  ${chalk.blue('!<shell_command>')}    - Execute any shell command directly from the prompt.`);
    console.log(`                        ${chalk.gray('Example: !ls -l')}\n`);

    console.log(chalk.yellow.bold('Default Behavior:'));
    console.log('  Any input that is not a recognized command or sigil will be sent to the currently active AI model for a conversational response.\n');
}

module.exports = { showHelp };