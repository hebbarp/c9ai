const { handleTodos } = require('./todoHandler');
const { handleTools } = require('./toolHandler');
const { handleIssues } = require('./issueHandler');
const { handleConversation } = require('./conversationHandler');
const { handleShellCommand } = require('./shellHandler');
const { showHelp } = require('./helpHandler'); // <-- Add this import
const { spawn } = require('child_process');
const chalk = require('chalk');
const config = require('../utils/config');
const Logger = require('../utils/logger');

async function handleSigilMode(c9ai, input) {
    const [mode, ...rest] = input.trim().split(' ');
    const message = rest.join(' ');

    switch (mode.toLowerCase()) {
        case 'local':
            await c9ai.modelHandler.switchModel('local');
            if (message) {
                return handleConversation(c9ai, message);
            }
            return; // Exit after switching
        case 'claude':
            if (message) {
                // Launch Claude Code with the message
                return await launchClaudeCode(message);
            } else {
                // Switch to claude mode for interactive use
                await c9ai.modelHandler.switchModel('claude');
            }
            return;
        case 'gemini':
            if (message) {
                // Launch gemini-cli with the message
                return await launchGeminiCli(message);
            } else {
                // Switch to gemini mode for interactive use
                await c9ai.modelHandler.switchModel('gemini');
            }
            return;
        case 'conv':
            if (!message) return Logger.warn('Usage: @conv <message>');
            return handleConversation(c9ai, message);
        case 'cmd':
            if (!message) return Logger.warn('Usage: @cmd <command>');
            return handleCommand(c9ai, message); // Re-enter command handling
        default:
            Logger.error(`Unknown sigil mode: @${mode}`);
    }
}

async function handleCommand(c9ai, input) {
    try {
        if (input.startsWith('!')) {
            return await handleShellCommand(input.substring(1).trim());
        }

        if (input.startsWith('@')) {
            return await handleSigilMode(c9ai, input.substring(1).trim());
        }

        const [command, ...args] = input.trim().split(' ');

        switch (command.toLowerCase()) {
            case 'models':
                return await c9ai.modelHandler.handle(args);
            case 'switch':
                return await c9ai.modelHandler.switchModel(args[0]);
            case 'config':
                return await handleConfig(args);
            case 'help':
                return showHelp(); // <-- Use the new help handler
            case 'exit':
            case 'quit':
                process.exit(0);
            // Handle simple conversational inputs explicitly
            case 'hi':
            case 'hello':
                return await handleConversation(c9ai, input);
            default:
                // Fallback to conversation for any other input
                return await handleConversation(c9ai, input);
        }
    } catch (error) {
        Logger.error('Error executing command:', error.message);
    }
}

async function launchClaudeCode(message) {
    try {
        console.log(chalk.cyan('🚀 Launching Claude Code...'));
        
        // Launch Claude Code with the message
        const args = message ? [message] : [];
        const child = spawn('claude', args, {
            stdio: 'inherit',
            shell: true
        });

        return new Promise((resolve) => {
            child.on('close', (code) => {
                if (code === 0) {
                    console.log(chalk.green('✅ Claude Code session completed'));
                } else {
                    console.log(chalk.yellow(`⚠️  Claude Code exited with code ${code}`));
                }
                resolve();
            });
            
            child.on('error', (error) => {
                console.log(chalk.red('❌ Failed to launch Claude Code:'), error.message);
                console.log(chalk.gray('💡 Make sure Claude Code is installed: npm install -g @anthropic/claude'));
                resolve();
            });
        });
    } catch (error) {
        Logger.error('Error launching Claude Code:', error.message);
    }
}

async function launchGeminiCli(message) {
    try {
        console.log(chalk.cyan('🚀 Launching Gemini CLI...'));
        
        // Launch gemini-cli with the message
        const args = message ? [message] : [];
        const child = spawn('gemini', args, {
            stdio: 'inherit',
            shell: true
        });

        return new Promise((resolve) => {
            child.on('close', (code) => {
                if (code === 0) {
                    console.log(chalk.green('✅ Gemini CLI session completed'));
                } else {
                    console.log(chalk.yellow(`⚠️  Gemini CLI exited with code ${code}`));
                }
                resolve();
            });
            
            child.on('error', (error) => {
                console.log(chalk.red('❌ Failed to launch Gemini CLI:'), error.message);
                console.log(chalk.gray('💡 Make sure gemini-cli is installed and available in PATH'));
                resolve();
            });
        });
    } catch (error) {
        Logger.error('Error launching Gemini CLI:', error.message);
    }
}

async function handleConfig(args) {
    const [action, key, ...valueParts] = args;
    const value = valueParts.join(' ');

    if (!action) {
        console.log(chalk.cyan('📝 Configuration Management'));
        console.log(chalk.white('Usage: config <action> [key] [value]'));
        console.log(chalk.gray(''));
        console.log(chalk.white('Actions:'));
        console.log(chalk.gray('  get <key>         - Get configuration value'));
        console.log(chalk.gray('  set <key> <value> - Set configuration value'));
        console.log(chalk.gray('  list              - List all configuration'));
        console.log(chalk.gray(''));
        console.log(chalk.white('API Keys:'));
        console.log(chalk.gray('  set claude-api-key <key>  - Set Claude API key'));
        console.log(chalk.gray('  set gemini-api-key <key>  - Set Gemini API key'));
        return;
    }

    switch (action.toLowerCase()) {
        case 'get':
            if (!key) {
                return Logger.warn('Usage: config get <key>');
            }
            const configValue = getConfigValue(key);
            if (configValue) {
                console.log(chalk.green(`${key}: ${maskApiKey(configValue)}`));
            } else {
                console.log(chalk.gray(`${key}: not set`));
            }
            break;

        case 'set':
            if (!key || !value) {
                return Logger.warn('Usage: config set <key> <value>');
            }
            await setConfigValue(key, value);
            console.log(chalk.green(`✅ Set ${key}`));
            break;

        case 'list':
            console.log(chalk.cyan('📝 Current Configuration:'));
            console.log(chalk.gray('API Keys:'));
            console.log(`  Claude API: ${config.hasClaudeApiKey() ? chalk.green('✅ Set') : chalk.gray('❌ Not set')}`);
            console.log(`  Gemini API: ${config.hasGeminiApiKey() ? chalk.green('✅ Set') : chalk.gray('❌ Not set')}`);
            break;

        default:
            Logger.warn(`Unknown config action: ${action}. Use 'config' for help.`);
    }
}

function getConfigValue(key) {
    switch (key.toLowerCase()) {
        case 'claude-api-key':
            return config.getClaudeApiKey();
        case 'gemini-api-key':
            return config.getGeminiApiKey();
        default:
            return config.config[key];
    }
}

async function setConfigValue(key, value) {
    switch (key.toLowerCase()) {
        case 'claude-api-key':
            await config.setClaudeApiKey(value);
            break;
        case 'gemini-api-key':
            await config.setGeminiApiKey(value);
            break;
        default:
            config.config[key] = value;
            await config.save();
    }
}

function maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 8) return apiKey;
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
}

module.exports = { handleCommand };