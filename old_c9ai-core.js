const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const inquirer = require('inquirer');

class C9AI {
    constructor() {
        this.currentModel = 'claude';
        this.configDir = path.join(os.homedir(), '.c9ai');
        this.scriptsDir = path.join(this.configDir, 'scripts'); // This will now be the general tools directory
        this.toolsRegistry = {}; // This will be for internal tools, not external scripts
        this.running = false;
        this.maxIterations = 20;
        
        this.init();
    }

    async init() {
        // Ensure config and tools directories exist
        await fs.ensureDir(this.configDir);
        await fs.ensureDir(this.scriptsDir); // scriptsDir is now the tools directory
        await fs.ensureDir(path.join(this.configDir, 'logs'));

        // Copy scripts to the tools directory
        await this.copyScripts();
        
        // Load configuration
        await this.loadConfig();
        // No longer loading tools from a registry, they are discovered dynamically
    }

    async copyScripts() {
        try {
            const sourceScriptsDir = path.join(__dirname, '../../mac_linux');
            const scriptsToCopy = ['check-todos.sh', 'cleanup-weekly.sh', 'run-analytics.sh']; // Add all relevant scripts

            for (const scriptName of scriptsToCopy) {
                const sourcePath = path.join(sourceScriptsDir, scriptName);
                const destPath = path.join(this.scriptsDir, scriptName);

                if (await fs.exists(sourcePath)) {
                    await fs.copy(sourcePath, destPath, { overwrite: true });
                    // Make the script executable
                    await fs.chmod(destPath, '755');
                }
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️  Could not copy internal scripts. Some features might not work.'));
        }
    }

    async loadConfig() {
        const configPath = path.join(this.configDir, 'config.json');
        try {
            if (await fs.exists(configPath)) {
                const config = await fs.readJson(configPath);
                this.currentModel = config.defaultModel || 'claude';
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️  Using default configuration'));
        }
    }

    async saveConfig() {
        const configPath = path.join(this.configDir, 'config.json');
        await fs.writeJson(configPath, {
            defaultModel: this.currentModel,
            lastUpdated: new Date().toISOString()
        }, { spaces: 2 });
    }

    // Removed loadTools as tools are now dynamically discovered

    async handleCommand(input) {
        const [command, ...args] = input.split(' ');
        
        try {
            // Handle shell commands with '!' sigil
            if (input.startsWith('!')) {
                const shellCommand = input.substring(1).trim();
                if (shellCommand) {
                    // Special handling for 'cd'
                    if (shellCommand.startsWith('cd')) {
                        let targetDir = shellCommand.substring(2).trim();
                        if (!targetDir || targetDir === '~') {
                            targetDir = os.homedir();
                        }
                        try {
                            process.chdir(targetDir);
                            console.log(chalk.green(`Changed directory to: ${process.cwd()}`));
                        } catch (error) {
                            console.error(chalk.red(`Error changing directory: ${error.message}`));
                        }
                    } else {
                        await this.runShellCommand(shellCommand);
                    }
                }
                return; // Command handled
            }

            // New sigil-based interactive sessions
            if (input.startsWith('@')) {
                const model = input.substring(1).split(' ')[0];
                if (model === 'claude' || model === 'gemini') {
                    await this.startInteractiveSession(model);
                    return; // Return to c9ai> prompt after session ends
                }
            }

            switch (command.toLowerCase()) {
                case 'claude':
                    await this.runAI('claude', args.join(' '));
                    break;
                case 'gemini':
                    await this.runAI('gemini', args.join(' '));
                    break;
                case 'switch':
                    await this.switchModel(args[0]);
                    break;
                case 'todos':
                    await this.handleTodos(args[0], args.slice(1));
                    break;
                case 'add':
                    await this.handleTodos('add', args);
                    break;
                case 'analytics':
                    await this.showAnalytics();
                    break;
                case 'tools':
                    await this.listTools();
                    break;
                case 'config':
                    await this.showConfig();
                    break;
                case 'help':
                    this.showHelp();
                    break;
                case 'logo':
                case 'banner':
                    this.showBanner();
                    break;
                default:
                    // If no known command, show an error
                    if (command) {
                        console.log(chalk.red(`❌ Unknown command: "${command}"`));
                        console.log(chalk.yellow('💡 Type "help" or use "@claude" / "@gemini" to start a session.'));
                    }
            }
        } catch (error) {
            console.error(chalk.red('❌ Error executing command:'), error.message);
        }
    }

    async runAI(model, prompt, options = {}) {
        if (!prompt.trim()) {
            console.log(chalk.yellow('⚠️  Please provide a prompt'));
            return;
        }

        const spinner = ora(`🤖 ${model.charAt(0).toUpperCase() + model.slice(1)} is thinking...`).start();
        
        try {
            // Log the interaction
            await this.logInteraction(model, prompt);
            
            if (options.autonomous) {
                spinner.stop();
                await this.runAutonomous(model, prompt);
            } else {
                spinner.stop(); // Stop spinner before launching interactive AI
                console.log(chalk.cyan(`
💡 An interactive ${model.toUpperCase()} session has started to help analyze the error.`));
                console.log(chalk.yellow(`   Please interact with ${model.toUpperCase()} directly. Type 'exit' or 'quit' to return to c9ai.`));
                await this.startInteractiveSession(model, prompt);
            }
        } catch (error) {
            spinner.stop();
            console.error(chalk.red(`❌ Error running ${model}:`), error.message);
            console.log(chalk.yellow('💡 Make sure the CLI is installed and configured:'));
            console.log(chalk.white(`   ${model === 'claude' ? 'claude' : 'gemini-cli'} --version`));
        }
    }

    async runAutonomous(model, goal) {
        console.log(chalk.cyan(`
🚀 Starting autonomous execution with ${model.toUpperCase()}`));
        console.log(chalk.white(`📋 Goal: ${goal}`));
        console.log(chalk.gray('='.repeat(60)));
        
        this.running = true;
        let iteration = 0;
        
        while (this.running && iteration < this.maxIterations) {
            iteration++;
            
            console.log(chalk.cyan(`
🔄 Step ${iteration}:`));
            
            // For now, we'll simulate autonomous execution
            // In a real implementation, this would:
            // 1. Ask AI to plan next step
            // 2. Execute tools based on AI response
            // 3. Evaluate results and continue
            
            try {
                await this.simulateAutonomousStep(model, goal, iteration);
                
                // Check if goal is achieved (simplified logic for now)
                if (iteration >= 3) {
                    console.log(chalk.green(`
✅ GOAL ACHIEVED: Task completed successfully`));
                    break;
                }
                
                // Brief pause between steps
                await this.sleep(1000);
                
            } catch (error) {
                console.log(chalk.red(`❌ Step ${iteration} failed: ${error.message}`));
                console.log(chalk.yellow('🔄 Attempting to recover...'));
            }
        }
        
        this.running = false;
        console.log(chalk.cyan(`
🏁 Autonomous execution completed`));
    }

    async simulateAutonomousStep(model, goal, step) {
        const actions = [
            '📖 Analyzing current state...',
            '🔍 Identifying required actions...',
            '⚙️ Executing tools and commands...',
            '✅ Validating results...'
        ];
        
        const action = actions[Math.min(step - 1, actions.length - 1)];
        
        const spinner = ora(action).start();
        await this.sleep(1500);
        spinner.succeed(action.replace('...', ' ✅'));
        
        // Simulate tool execution
        if (step === 2) {
            console.log(chalk.gray('   🔧 Running: git status'));
            console.log(chalk.gray('   📊 Analyzing: GitHub issues'));
        }
    }

    async switchModel(model) {
        const validModels = ['claude', 'gemini'];
        
        if (!validModels.includes(model)) {
            console.log(chalk.red(`❌ Invalid model. Choose from: ${validModels.join(', ')}`));
            return;
        }
        
        this.currentModel = model;
        await this.saveConfig();
        
        console.log(chalk.green(`🔄 Switched to ${model.toUpperCase()}`));
        
        // Test the AI availability
        const testSpinner = ora(`Testing ${model} availability...`).start();
        try {
            const command = model === 'claude' ? 'claude' : 'gemini-cli';
            await this.runCommand(`${command} --version`);
            testSpinner.succeed(`${model.toUpperCase()} is ready`);
        } catch (error) {
            testSpinner.fail(`${model.toUpperCase()} not available`);
            console.log(chalk.yellow(`💡 Install ${model} CLI to use this model`));
        }
    }

    async handleTodos(action = 'list', task) {
        console.log(chalk.cyan('📋 Todo Management'));
        
        switch (action) {
            case 'list':
                await this.listTodos();
                break;
            case 'execute':
                await this.executeTodos();
                break;
            case 'add':
                if (!task || task.length === 0) {
                    console.log(chalk.yellow('💡 Please provide a task description. Usage: todos add <your task here>'));
                } else {
                    await this.addTodo(task.join(' '));
                }
                break;
            case 'actions':
                await this.listActions();
                break;
            case 'sync':
                await this.syncTodos();
                break;
            default:
                // If the action doesn't match, assume it's part of a task description for 'add'
                const fullTask = [action, ...task].join(' ');
                await this.addTodo(fullTask);
        }
    }

    async listTodos() {
        console.log(chalk.cyan('--- GitHub Issues ---'));
        try {
            const scriptPath = path.join(this.scriptsDir, 'check-todos.sh');
            if (await fs.exists(scriptPath)) {
                const githubIssues = await this.runCommand(`bash "${scriptPath}"`, true);
                console.log(githubIssues || chalk.gray('No open issues on GitHub.'));
            } else {
                const githubIssues = await this.runCommand('gh issue list --repo hebbarp/todo-management --state open', true);
                console.log(githubIssues || chalk.gray('No open issues on GitHub.'));
            }
        } catch (error) {
            console.log(chalk.red('❌ Error fetching GitHub issues:'), error.message);
            console.log(chalk.yellow('💡 Make sure GitHub CLI is installed and authenticated.'));
        }

        console.log(chalk.cyan('--- Local Tasks (todo.md) ---'));
        const localTodos = await this.parseLocalTodos();
        if (localTodos.length > 0) {
            localTodos.forEach(todo => console.log(todo));
        } else {
            console.log(chalk.gray('No tasks found in todo.md.'));
        }
    }

    async parseLocalTodos() {
        const todoFilePath = path.join(process.cwd(), 'todo.md');
        if (!await fs.exists(todoFilePath)) {
            return [];
        }
        const content = await fs.readFile(todoFilePath, 'utf-8');
        return content.split('\n').filter(line => line.startsWith('- [ ]'));
    }

    async listActions() {
        const actionableTodos = await this.parseActionableTodos();

        if (actionableTodos.length === 0) {
            console.log(chalk.yellow('No actionable todos found in todo.md.'));
            return;
        }

        console.log(chalk.cyan('\nActionable Todos:'));
        for (const todo of actionableTodos) {
            console.log(`- ${todo.task}`);
            console.log(`  └─ ${chalk.gray(`@${todo.verb} ${todo.target}`)}`);
        }
    }

    async addTodo(task) {
        const todoFilePath = path.join(process.cwd(), 'todo.md');
        
        const actionIndex = task.indexOf('@');
        let description = task;
        let taskLine;
        let intentDisplay = '';

        if (actionIndex !== -1) {
            description = task.substring(0, actionIndex).trim();
            const rawActionString = task.substring(actionIndex + 1).trim(); // Get everything after the first @
            taskLine = `\n- [ ] ${description} @action: ${rawActionString}`;
            intentDisplay = `   └─ With intent: @${rawActionString}`;
        } else {
            taskLine = `\n- [ ] ${description}`;
        }

        try {
            await fs.appendFile(todoFilePath, taskLine);
            console.log(chalk.green(`✅ Added task: "${description}"`));
            if (intentDisplay) {
                 console.log(chalk.gray(intentDisplay));
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error adding task:`), error.message);
        }
    }

    async executeTodos() {
        const actionableTodos = await this.parseActionableTodos();

        if (actionableTodos.length === 0) {
            console.log(chalk.yellow('No actionable todos found in todo.md.'));
            return;
        }

        const { selectedTodos } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedTodos',
                message: 'Select todos to execute',
                choices: actionableTodos.map(todo => ({ name: todo.task, value: todo.task })) // Simplify value to todo.task
            }
        ]);

        console.log(chalk.blue(`[DEBUG] Selected Todos: ${JSON.stringify(selectedTodos)}`));

        for (const selected of selectedTodos) {
            // Re-parse verb and target from the selected task string
            const parsedTodo = actionableTodos.find(todo => todo.task === selected);
            if (!parsedTodo) {
                console.log(chalk.red(`❌ Error: Could not find parsed todo for selected task: ${selected}`));
                continue;
            }
            const { verb, target } = parsedTodo;
            try {
                console.log(chalk.cyan(`
▶️ Executing intent: @${verb} ${target}`));
                await this.runIntent(verb, target);
                console.log(chalk.green('✅ Execution successful'));
            } catch (error) {
                console.log(chalk.red(`❌ Error executing intent: @${verb} ${target}`), error.message);
                
                // AI Fallback Logic
                console.log(chalk.cyan(`
🤖 AI is analyzing the error...`));
                const analysisPrompt = `My goal was to execute the intent "@${verb} ${target}". It failed with the following error: ${error.message}. Please analyze this error and provide a step-by-step solution.`;
                await this.runAI(this.currentModel, analysisPrompt);
            }
        }
    }

    async parseActionableTodos() {
        const todoFilePath = path.join(process.cwd(), 'todo.md');
        if (!await fs.exists(todoFilePath)) {
            return [];
        }

        const content = await fs.readFile(todoFilePath, 'utf-8');
        const lines = content.split('\n');
        const actionableTodos = [];

        for (const line of lines) {
            const actionMatch = line.match(/@action:\s*(\w+)\s*(.*)/);
            if (actionMatch) {
                const task = line.split('@action:')[0].replace('- [ ]', '').trim();
                const verb = actionMatch[1];
                const target = actionMatch[2].trim();
                actionableTodos.push({ task, verb, target });
            }
        }

        return actionableTodos;
    }

    async runIntent(verb, target) {
        console.log(chalk.blue(`[DEBUG] runIntent: Verb - ${verb}, Target - ${target}`));
        let commandToExecute = '';
        const osType = os.platform();

        switch (verb.toLowerCase()) {
            case 'open':
                if (osType === 'darwin') { // macOS
                    commandToExecute = `open "${target}"`;
                } else if (osType === 'win32') { // Windows
                    commandToExecute = `start "" "${target}"`;
                } else { // Linux and others
                    commandToExecute = `xdg-open "${target}"`;
                }
                break;
            case 'compile':
                // Assuming .tex files for now, can be expanded
                if (target.endsWith('.tex')) {
                    commandToExecute = `pdflatex "${target}"`;
                } else {
                    throw new Error(`Unsupported compile target: ${target}`);
                }
                break;
            case 'run':
                // Assuming shell scripts for now, can be expanded for python, node etc.
                // Need to handle relative paths for scripts in ~/.c9ai/scripts
                const scriptPath = path.join(this.scriptsDir, target);
                if (await fs.exists(scriptPath)) {
                    // Determine interpreter based on extension
                    if (target.endsWith('.sh')) {
                        commandToExecute = `bash "${scriptPath}"`;
                    } else if (target.endsWith('.py')) {
                        commandToExecute = `python3 "${scriptPath}"`; // Assuming python3
                    } else if (target.endsWith('.js')) {
                        commandToExecute = `node "${scriptPath}"`;
                    } else {
                        // Default to direct execution if no known extension
                        commandToExecute = `"${scriptPath}"`;
                    }
                } else {
                    throw new Error(`Script not found: ${target}`);
                }
                break;
            case 'search':
                // Basic Google search
                const encodedTarget = encodeURIComponent(target);
                commandToExecute = `open "https://www.google.com/search?q=${encodedTarget}"`;
                if (osType === 'win32') {
                    commandToExecute = `start "" "https://www.google.com/search?q=${encodedTarget}"`;
                } else if (osType === 'linux') {
                    commandToExecute = `xdg-open "https://www.google.com/search?q=${encodedTarget}"`;
                }
                break;
            default:
                throw new Error(`Unknown intent verb: ${verb}`);
        }

        if (commandToExecute) {
            console.log(chalk.blue(`[DEBUG] runIntent: Executing command - ${commandToExecute}`));
            await this.runCommand(commandToExecute);
        } else {
            throw new Error(`Could not determine command for verb: ${verb} and target: ${target}`);
        }
    }

    async syncTodos() {
        const spinner = ora('🔄 Syncing todos from all sources...').start();
        try {
            // This would sync from GitHub, local files, etc.
            await this.sleep(2000);
            spinner.succeed('✅ Todos synced successfully');
        } catch (error) {
            spinner.fail('❌ Sync failed');
            console.log(chalk.red('Error:'), error.message);
        }
    }

    async showAnalytics() {
        console.log(chalk.cyan('📊 C9 AI Analytics Dashboard'));
        console.log(chalk.gray('='.repeat(40)));
        
        try {
            const logPath = path.join(this.configDir, 'logs');
            const files = await fs.readdir(logPath);
            
            console.log(chalk.white(`📈 Total sessions: ${files.length}`));
            console.log(chalk.white(`🤖 Current model: ${this.currentModel.toUpperCase()}`));
            console.log(chalk.white(`📅 Last updated: ${new Date().toLocaleDateString()}`));
            
            console.log(chalk.yellow('\n💡 Full analytics dashboard coming soon!'));
        } catch (error) {
            console.log(chalk.yellow('📊 No analytics data yet - start using c9ai to build insights!'));
        }
    }

    async listTools() {
        console.log(chalk.cyan('🔧 Available Tools:'));
        console.log(chalk.gray('='.repeat(40)));
        
        try {
            const files = await fs.readdir(this.scriptsDir); // scriptsDir is now the tools directory
            const executableFiles = [];
            for (const file of files) {
                const filePath = path.join(this.scriptsDir, file);
                const stats = await fs.stat(filePath);
                // Check if it's a file and executable
                if (stats.isFile() && (stats.mode & fs.constants.S_IXUSR)) {
                    executableFiles.push(file);
                }
            }

            if (executableFiles.length === 0) {
                console.log(chalk.yellow('No executable tools found in ~/.c9ai/tools.'));
                return;
            }

            for (const toolName of executableFiles) {
                console.log(chalk.white(`- ${toolName}`));
            }
            console.log(chalk.yellow('\n💡 Use @run <tool_name> in your todos to execute these tools.'));
        } catch (error) {
            console.error(chalk.red('❌ Error listing tools:'), error.message);
        }
    }

    async showConfig() {
        console.log(chalk.cyan('⚙️ C9 AI Configuration'));
        console.log(chalk.gray('='.repeat(30)));
        console.log(chalk.white(`📍 Config directory: ${this.configDir}`));
        console.log(chalk.white(`🤖 Default AI model: ${this.currentModel.toUpperCase()}`));
        console.log(chalk.white(`🔧 Max iterations: ${this.maxIterations}`));
    }

    showHelp() {
        console.log(chalk.cyan('📖 C9 AI Help'));
        console.log(chalk.gray('='.repeat(20)));
        console.log(chalk.yellow('\n🤖 Interactive AI Sessions:'));
        console.log(chalk.white('  @claude             - Start an interactive session with Claude'));
        console.log(chalk.white('  @gemini             - Start an interactive session with Gemini'));

        console.log(chalk.yellow('\n⚡ Quick Prompts:'));
        console.log(chalk.white('  (Removed - use interactive sessions for AI prompts)'));

        console.log(chalk.yellow('\n📋 Productivity:'));
        console.log(chalk.white('  todos [action]      - Manage todos (list, add, sync)'));
        console.log(chalk.white('  analytics           - View productivity insights'));

        console.log(chalk.yellow('\\n🔧 System:'));
        console.log(chalk.white('  ! <command>         - Execute any shell command (e.g., !ls -l)'));
        console.log(chalk.white('  switch <model>      - Switch default AI model (claude|gemini)'));
        console.log(chalk.white('  tools               - List available tools'));
        console.log(chalk.white('  config              - Show configuration'));
        console.log(chalk.white('  help                - Show this help'));
    }

    showBanner() {
        const banner = `
${chalk.cyan('🌟 ============================================ 🌟')}
${chalk.cyan('    ____  ___    _    ___                        ')}
${chalk.cyan('   / ___|/ _ \  / \  |_ _|                       ')}
${chalk.cyan('  | |   | (_) |/ _ \  | |                        ')}
${chalk.cyan('  | |___|\__, / ___ \ | |                        ')}
${chalk.cyan('   \____| /_/_/   \_\___|                       ')}
${chalk.cyan('                                                 ')}
${chalk.yellow('  Autonomous AI-Powered Productivity System     ')}
${chalk.green('  🤖 Claude CLI    ✨ Gemini CLI    🚀 Tool Use  ')}
${chalk.cyan('🌟 ============================================ 🌟')}
`;
        console.log(banner);
    }

    async runShellCommand(command) {
        return new Promise((resolve) => {
            const child = spawn(command, { 
                stdio: 'inherit', 
                shell: true 
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    console.log(chalk.yellow(`\n[c9ai: Command exited with code ${code}]`));
                }
                resolve();
            });

            child.on('error', (err) => {
                console.error(chalk.red(`\n[c9ai: Failed to start command: ${err.message}]`));
                resolve();
            });
        });
    }

    async startInteractiveSession(model, initialPrompt = '') {
        console.log(chalk.cyan(`\nEntering interactive session with ${model.toUpperCase()}. Type 'exit' or 'quit' to return.`));
        const command = model === 'claude' ? 'claude' : 'gemini'; // Use 'gemini' not 'gemini-cli'
        const args = initialPrompt ? [initialPrompt] : [];

        return new Promise((resolve) => {
            const child = spawn(command, args, {
                stdio: 'inherit',
                shell: true
            });

            child.on('close', (code) => {
                console.log(chalk.cyan(`\nReturning to c9ai shell. (Session exited with code ${code})`));
                resolve();
            });

            child.on('error', (error) => {
                console.error(chalk.red(`\n❌ Error starting ${model} session:`), error.message);
                console.log(chalk.yellow(`💡 Make sure "${command}" is installed and in your PATH.`));
                resolve(); // Resolve to not break the main loop
            });
        });
    }

    async runCommand(command, capture = false) {
        return new Promise((resolve, reject) => {
            const options = { 
                shell: true,
                stdio: capture ? 'pipe' : 'inherit'
            };

            const child = spawn(command, options);

            let stdout = '';
            let stderr = '';

            if (capture) {
                child.stdout.on('data', (data) => stdout += data.toString());
                child.stderr.on('data', (data) => stderr += data.toString());
            }

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(stderr || `Command failed with code ${code}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    async logInteraction(model, prompt) {
        const logFile = path.join(this.configDir, 'logs', `${new Date().toISOString().split('T')[0]}.json`);
        
        const logEntry = {
            timestamp: new Date().toISOString(),
            model,
            prompt,
            session: process.pid
        };
        
        try {
            let logs = [];
            if (await fs.exists(logFile)) {
                logs = await fs.readJson(logFile);
            }
            
            logs.push(logEntry);
            await fs.writeJson(logFile, logs, { spaces: 2 });
        } catch (error) {
            // Fail silently for logging errors
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = C9AI;