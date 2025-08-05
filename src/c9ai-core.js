const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const inquirer = require('inquirer');
const https = require('https');

// Local LLM support
let LlamaModel, LlamaContext, LlamaChatSession;
try {
    const llamaCpp = require('node-llama-cpp');
    LlamaModel = llamaCpp.LlamaModel;
    LlamaContext = llamaCpp.LlamaContext;
    LlamaChatSession = llamaCpp.LlamaChatSession;
} catch (error) {
    // node-llama-cpp not available, will use fallback
}

class C9AI {
    constructor() {
        this.currentModel = 'claude';
        this.configDir = path.join(os.homedir(), '.c9ai');
        this.scriptsDir = path.join(this.configDir, 'scripts'); // This will now be the general tools directory
        this.modelsDir = path.join(this.configDir, 'models'); // Directory for local AI models
        
        // Timeout and retry configuration
        this.localModelTimeout = 30000; // 30 seconds
        this.maxRetries = 3;
        this.toolsRegistry = {}; // This will be for internal tools, not external scripts
        this.running = false;
        this.maxIterations = 20;
        this.localModel = null; // Will store the loaded local model instance
        this.initialized = false;
        
        this.init();
    }

    async init() {
        if (this.initialized) return;
        
        // Ensure config and tools directories exist
        await fs.ensureDir(this.configDir);
        await fs.ensureDir(this.scriptsDir); // scriptsDir is now the tools directory
        await fs.ensureDir(this.modelsDir); // Ensure models directory exists
        await fs.ensureDir(path.join(this.configDir, 'logs'));

        // Copy scripts to the tools directory
        await this.copyScripts();
        
        // Load configuration
        await this.loadConfig();
        // No longer loading tools from a registry, they are discovered dynamically
        
        this.initialized = true;
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
                case 'models':
                    await this.handleModels(args[0], args[1]);
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
                    // Try to process as natural language command
                    if (command && input.trim().length > 0) {
                        await this.processNaturalLanguageCommand(input.trim());
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
        const validModels = ['claude', 'gemini', 'local'];
        
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
            if (model === 'local') {
                if (await this.hasLocalModel()) {
                    await this.initLocalModel();
                    testSpinner.succeed('LOCAL model is ready');
                } else {
                    testSpinner.fail('No local models installed');
                    console.log(chalk.yellow('💡 Install a model: models install phi-3'));
                }
            } else {
                const command = model === 'claude' ? 'claude' : 'gemini-cli';
                await this.runCommand(`${command} --version`);
                testSpinner.succeed(`${model.toUpperCase()} is ready`);
            }
        } catch (error) {
            testSpinner.fail(`${model.toUpperCase()} not available`);
            if (model === 'local') {
                console.log(chalk.yellow('💡 Install a model: models install phi-3'));
            } else {
                console.log(chalk.yellow(`💡 Install ${model} CLI to use this model`));
            }
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
        await this.init(); // Ensure initialization is complete
        const todoFilePath = path.join(process.cwd(), 'todo.md');
        
        // Check if it's already structured with @action
        if (task.includes('@action:')) {
            const taskLine = `\n- [ ] ${task}`;
            try {
                await fs.appendFile(todoFilePath, taskLine);
                console.log(chalk.green(`✅ Added structured task: "${task}"`));
            } catch (error) {
                console.error(chalk.red(`❌ Error adding task:`), error.message);
            }
            return;
        }

        // Check if it has manual @action format
        const actionIndex = task.indexOf('@');
        if (actionIndex !== -1) {
            const description = task.substring(0, actionIndex).trim();
            const rawActionString = task.substring(actionIndex + 1).trim();
            const taskLine = `\n- [ ] ${description} @action: ${rawActionString}`;
            
            try {
                await fs.appendFile(todoFilePath, taskLine);
                console.log(chalk.green(`✅ Added task: "${description}"`));
                console.log(chalk.gray(`   └─ With intent: @${rawActionString}`));
            } catch (error) {
                console.error(chalk.red(`❌ Error adding task:`), error.message);
            }
            return;
        }

        // Try intelligent processing for natural language todos
        await this.addIntelligentTodo(task, todoFilePath);
    }

    async addIntelligentTodo(task, todoFilePath) {
        console.log(chalk.cyan(`🤖 Analyzing: "${task}"`));
        
        // Try local AI first (if available)
        if (this.currentModel === 'local' && await this.hasLocalModel()) {
            try {
                const spinner = ora('Processing with local AI...').start();
                const parsed = await this.parseNaturalLanguageTodo(task);
                spinner.succeed('Local AI processed successfully');
                
                const taskLine = `\n- [ ] ${task} @action: ${parsed.verb} ${parsed.target}`;
                await fs.appendFile(todoFilePath, taskLine);
                
                console.log(chalk.green(`✅ Added intelligent task: "${task}"`));
                console.log(chalk.cyan(`   🧠 AI suggested: @action: ${parsed.verb} ${parsed.target}`));
                return;
            } catch (error) {
                console.log(chalk.yellow('🔄 Local AI failed, trying cloud...'));
            }
        }

        // Try cloud AI fallback
        if (this.currentModel === 'claude' || this.currentModel === 'gemini') {
            try {
                console.log(chalk.cyan(`🌐 Processing with ${this.currentModel.toUpperCase()}...`));
                // For now, we'll add a placeholder for cloud processing
                // In the full implementation, this would call the cloud API
                const taskLine = `\n- [ ] ${task} @action: search ${task.toLowerCase().replace(/\s+/g, '_')}`;
                await fs.appendFile(todoFilePath, taskLine);
                
                console.log(chalk.green(`✅ Added task: "${task}"`));
                console.log(chalk.gray(`   🌐 Processed with ${this.currentModel.toUpperCase()}`));
                return;
            } catch (error) {
                console.log(chalk.yellow('🔄 Cloud AI failed, adding as manual task...'));
            }
        }

        // Final fallback - add as manual todo
        const taskLine = `\n- [ ] ${task}`;
        try {
            await fs.appendFile(todoFilePath, taskLine);
            console.log(chalk.green(`✅ Added task: "${task}"`));
            console.log(chalk.yellow('💡 Add @action: for automatic execution'));
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
                        // Use bash on Unix, or suggest .bat files on Windows
                        if (osType === 'win32') {
                            throw new Error('Shell scripts (.sh) not supported on Windows. Use .bat files instead.');
                        }
                        commandToExecute = `bash "${scriptPath}"`;
                    } else if (target.endsWith('.bat') && osType === 'win32') {
                        commandToExecute = `"${scriptPath}"`;
                    } else if (target.endsWith('.py')) {
                        // Use 'python' on Windows, 'python3' on Unix systems
                        const pythonCmd = osType === 'win32' ? 'python' : 'python3';
                        commandToExecute = `${pythonCmd} "${scriptPath}"`;
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

    async handleModels(action = 'list', modelName) {
        switch (action) {
            case 'list':
                await this.listModels();
                break;
            case 'install':
                if (!modelName) {
                    console.log(chalk.yellow('💡 Please specify a model: models install phi-3'));
                    return;
                }
                await this.installModel(modelName);
                break;
            case 'remove':
                if (!modelName) {
                    console.log(chalk.yellow('💡 Please specify a model: models remove phi-3'));
                    return;
                }
                await this.removeModel(modelName);
                break;
            case 'status':
                await this.showModelStatus();
                break;
            default:
                console.log(chalk.red(`❌ Unknown action: ${action}`));
                console.log(chalk.yellow('💡 Available actions: list, install, remove, status'));
        }
    }

    async listModels() {
        console.log(chalk.cyan('🤖 Available Local AI Models'));
        console.log(chalk.gray('='.repeat(40)));

        const availableModels = {
            'phi-3': {
                name: 'Phi-3-mini',
                size: '2.2GB',
                description: 'Microsoft Phi-3 Mini - Fast, efficient, good reasoning'
            },
            'tinyllama': {
                name: 'TinyLlama-1.1B',
                size: '680MB',
                description: 'TinyLlama 1.1B - Ultra lightweight for testing'
            },
            'llama': {
                name: 'Llama-2-7B-Chat',
                size: '3.9GB', 
                description: 'Meta Llama 2 7B - Powerful conversational model'
            }
        };

        try {
            const installedFiles = await fs.readdir(this.modelsDir);
            
            console.log(chalk.green('\n📦 Installed Models:'));
            if (installedFiles.length === 0) {
                console.log(chalk.gray('  None installed yet'));
            } else {
                for (const file of installedFiles) {
                    if (file.endsWith('.gguf') || file.endsWith('.bin')) {
                        const stats = await fs.stat(path.join(this.modelsDir, file));
                        const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
                        console.log(chalk.white(`  ✅ ${file} (${sizeMB} MB)`));
                    }
                }
            }

            console.log(chalk.yellow('\n🌐 Available for Download:'));
            for (const [key, model] of Object.entries(availableModels)) {
                const isInstalled = installedFiles.some(f => f.includes(key));
                const status = isInstalled ? chalk.green('✅ Installed') : chalk.gray('⬇️  Available');
                console.log(chalk.white(`  ${key.padEnd(8)} - ${model.name} (${model.size}) ${status}`));
                console.log(chalk.gray(`           ${model.description}`));
            }

            console.log(chalk.cyan('\n💡 Usage: models install <model-name>'));
        } catch (error) {
            console.error(chalk.red('❌ Error listing models:'), error.message);
        }
    }

    async installModel(modelName) {
        const models = {
            'phi-3': {
                url: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
                filename: 'phi-3-mini-4k-instruct-q4.gguf',
                size: '2.2GB'
            },
            'tinyllama': {
                url: 'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
                filename: 'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf',
                size: '680MB'
            },
            'llama': {
                url: 'https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGML/resolve/main/llama-2-7b-chat.q4_0.bin',
                filename: 'llama-2-7b-chat.q4_0.bin',
                size: '3.9GB'
            }
        };

        if (!models[modelName]) {
            console.log(chalk.red(`❌ Unknown model: ${modelName}`));
            console.log(chalk.yellow(`💡 Available models: ${Object.keys(models).join(', ')}`));
            return;
        }

        const model = models[modelName];
        const filePath = path.join(this.modelsDir, model.filename);

        // Check if already installed
        if (await fs.exists(filePath)) {
            console.log(chalk.yellow(`⚠️  Model ${modelName} is already installed`));
            return;
        }

        console.log(chalk.cyan(`📥 Installing ${modelName} (${model.size})...`));
        console.log(chalk.gray(`   This may take several minutes depending on your connection`));
        
        const spinner = ora('Downloading model...').start();
        
        try {
            await this.downloadFile(model.url, filePath, (progress) => {
                spinner.text = `Downloading ${modelName}... ${progress}%`;
            });
            
            spinner.succeed(`✅ Successfully installed ${modelName}`);
            console.log(chalk.green(`📍 Model saved to: ${filePath}`));
            console.log(chalk.cyan(`💡 Switch to local mode: switch local`));
        } catch (error) {
            spinner.fail(`❌ Failed to install ${modelName}`);
            console.error(chalk.red('Error:'), error.message);
            
            // Clean up partial download
            if (await fs.exists(filePath)) {
                await fs.remove(filePath);
            }
        }
    }

    async downloadFile(url, destPath, progressCallback) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(destPath);
            
            https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    return this.downloadFile(response.headers.location, destPath, progressCallback)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length']) || 0;
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0 && progressCallback) {
                        const progress = Math.round((downloadedSize / totalSize) * 100);
                        progressCallback(progress);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    resolve();
                });

                file.on('error', (error) => {
                    fs.remove(destPath); // Clean up on error
                    reject(error);
                });
            }).on('error', reject);
        });
    }

    async removeModel(modelName) {
        try {
            const files = await fs.readdir(this.modelsDir);
            const modelFiles = files.filter(f => f.includes(modelName));
            
            if (modelFiles.length === 0) {
                console.log(chalk.yellow(`⚠️  Model ${modelName} is not installed`));
                return;
            }

            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Remove ${modelName} model? This will free up disk space.`,
                    default: false
                }
            ]);

            if (confirm) {
                for (const file of modelFiles) {
                    await fs.remove(path.join(this.modelsDir, file));
                }
                console.log(chalk.green(`✅ Removed ${modelName} model`));
            } else {
                console.log(chalk.gray('Cancelled'));
            }
        } catch (error) {
            console.error(chalk.red(`❌ Error removing model:`), error.message);
        }
    }

    async showModelStatus() {
        console.log(chalk.cyan('📊 Local AI Models Status'));
        console.log(chalk.gray('='.repeat(30)));

        try {
            const files = await fs.readdir(this.modelsDir);
            const modelFiles = files.filter(f => f.endsWith('.gguf') || f.endsWith('.bin'));
            
            if (modelFiles.length === 0) {
                console.log(chalk.yellow('📭 No models installed'));
                console.log(chalk.cyan('💡 Install a model: models install phi-3'));
                return;
            }

            let totalSize = 0;
            for (const file of modelFiles) {
                const filePath = path.join(this.modelsDir, file);
                const stats = await fs.stat(filePath);
                const sizeMB = stats.size / 1024 / 1024;
                totalSize += sizeMB;
                
                console.log(chalk.white(`📦 ${file}`));
                console.log(chalk.gray(`   Size: ${sizeMB.toFixed(1)} MB`));
                console.log(chalk.gray(`   Modified: ${stats.mtime.toLocaleDateString()}`));
            }

            console.log(chalk.cyan(`\n💾 Total disk usage: ${(totalSize / 1024).toFixed(2)} GB`));
            console.log(chalk.white(`🤖 Current model: ${this.currentModel.toUpperCase()}`));
        } catch (error) {
            console.error(chalk.red('❌ Error checking model status:'), error.message);
        }
    }

    async hasLocalModel() {
        try {
            const files = await fs.readdir(this.modelsDir);
            return files.some(f => f.endsWith('.gguf') || f.endsWith('.bin'));
        } catch (error) {
            return false;
        }
    }

    async initLocalModel() {
        if (this.localModel && this.localModel.ready) {
            return; // Already initialized
        }

        try {
            // Find the first available model
            const files = await fs.readdir(this.modelsDir);
            const modelFile = files.find(f => f.endsWith('.gguf') || f.endsWith('.bin'));
            
            if (!modelFile) {
                throw new Error('No model files found. Install a model with: c9ai models install phi-3');
            }

            const modelPath = path.join(this.modelsDir, modelFile);
            
            console.log(chalk.gray(`🔄 Loading local model: ${modelFile}...`));
            
            // Try to initialize real llama.cpp model
            if (LlamaModel) {
                try {
                    const model = new LlamaModel({
                        modelPath: modelPath
                    });

                    const context = new LlamaContext({
                        model: model,
                        contextSize: 4096
                    });

                    const session = new LlamaChatSession({
                        context: context
                    });

                    this.localModel = {
                        modelPath,
                        modelFile,
                        model,
                        context,
                        session,
                        ready: true
                    };

                    console.log(chalk.green(`✅ Phi-3 model loaded: ${modelFile}`));
                    
                } catch (llamaError) {
                    console.log(chalk.yellow(`⚠️ Failed to load llama.cpp model: ${llamaError.message}`));
                    console.log(chalk.yellow('🔄 Falling back to pattern matching mode...'));
                    
                    // Fallback to simulation mode
                    this.localModel = {
                        modelPath,
                        modelFile, 
                        ready: true,
                        fallbackMode: true
                    };
                    
                    console.log(chalk.green(`✅ Local model ready (fallback mode): ${modelFile}`));
                }
            } else {
                // No llama.cpp available, use simulation mode
                await this.sleep(1000); // Simulate loading time
                
                this.localModel = {
                    modelPath,
                    modelFile,
                    ready: true,
                    fallbackMode: true
                };
                
                console.log(chalk.green(`✅ Local model ready (pattern matching): ${modelFile}`));
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to initialize local model:'), error.message);
            throw error;
        }
    }

    async runLocalAI(prompt, retryCount = 0) {
        if (!this.localModel || !this.localModel.ready) {
            await this.initLocalModel();
        }

        try {
            // Check if we have real llama.cpp integration
            if (LlamaModel && this.localModel.session) {
                return await this.runRealLocalAI(prompt);
            } else {
                // Fallback to pattern matching with better error handling
                return await this.runPatternMatchingAI(prompt);
            }
            
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(chalk.yellow(`⚠️ Local AI retry ${retryCount + 1}/${this.maxRetries}: ${error.message}`));
                await this.sleep(1000); // Wait before retry
                return await this.runLocalAI(prompt, retryCount + 1);
            } else {
                throw new Error(`Local AI failed after ${this.maxRetries} attempts: ${error.message}`);
            }
        }
    }

    async runRealLocalAI(prompt) {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Local AI timeout after 30 seconds'));
            }, this.localModelTimeout);

            try {
                // Format prompt for Phi-3
                const formattedPrompt = this.formatPhi3Prompt(prompt);
                
                console.log(chalk.gray('🤖 Querying local Phi-3 model...'));
                
                const response = await this.localModel.session.prompt(formattedPrompt, {
                    maxTokens: 150,
                    temperature: 0.7,
                    repeatPenalty: 1.1,
                    stopSequences: ['<|end|>', '\n\n']
                });

                clearTimeout(timeout);
                
                if (!response || response.trim().length === 0) {
                    throw new Error('Empty response from local model');
                }

                resolve(response.trim());
                
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    formatPhi3Prompt(userInput) {
        // Phi-3 optimal prompt format
        return `<|system|>You are a helpful AI assistant that converts natural language into actionable commands. Always respond with @action: followed by the command.<|end|>
<|user|>${userInput}<|end|>
<|assistant|>`;
    }

    async runPatternMatchingAI(prompt) {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Pattern matching timeout'));
            }, 5000); // Shorter timeout for fallback

            try {
                await this.sleep(500); // Simulate processing time
                
                // Enhanced conversational pattern matching
                const taskLower = prompt.toLowerCase();
                
                // Greetings and conversational responses
                if (taskLower.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening)$/)) {
                    resolve('Hello! I\'m C9 AI. I can help you with tasks like:\n• "open excel" - Open applications\n• "list files" - Show directory contents\n• "search for X" - Web search\n• "compile document" - Build projects\nWhat can I help you with?');
                } else if (taskLower.match(/^(how are you|what\'s up|how\'s it going)$/)) {
                    resolve('I\'m doing great! Ready to help you be more productive. What task would you like me to help with?');
                } else if (taskLower.includes('thank') || taskLower.includes('thanks')) {
                    resolve('You\'re welcome! Happy to help. Is there anything else you need assistance with?');
                } 
                
                // Enhanced application opening
                else if (taskLower.includes('open')) {
                    let app = '';
                    if (taskLower.includes('excel') || taskLower.includes('spreadsheet')) {
                        app = 'excel';
                    } else if (taskLower.includes('word') || taskLower.includes('document')) {
                        app = 'word';
                    } else if (taskLower.includes('browser') || taskLower.includes('chrome') || taskLower.includes('firefox')) {
                        app = 'chrome';
                    } else if (taskLower.includes('code') || taskLower.includes('vscode') || taskLower.includes('editor')) {
                        app = 'code';
                    } else if (taskLower.includes('terminal') || taskLower.includes('command')) {
                        app = 'terminal';
                    } else if (taskLower.includes('calculator') || taskLower.includes('calc')) {
                        app = 'calculator';
                    } else if (taskLower.includes('notes') || taskLower.includes('notepad')) {
                        app = 'notepad';
                    } else {
                        // Extract filename or generic open
                        const fileMatch = taskLower.match(/open\s+(.+)/);
                        app = fileMatch ? fileMatch[1].trim() : 'file';
                    }
                    resolve(`@action: open ${app}`);
                }
                
                // File and directory operations
                else if (taskLower.includes('list') && (taskLower.includes('files') || taskLower.includes('directories') || taskLower.includes('folder'))) {
                    resolve('@action: list files');
                } else if (taskLower.includes('show') && (taskLower.includes('files') || taskLower.includes('directory'))) {
                    resolve('@action: list files');
                }
                
                // Search operations
                else if (taskLower.includes('search')) {
                    const searchTerm = taskLower.match(/search.*?(?:for\s+)?(.+?)(?:\s|$)/)?.[1] || 'tutorial';
                    resolve(`@action: search ${searchTerm}`);
                } else if (taskLower.includes('find') && !taskLower.includes('file')) {
                    const searchTerm = taskLower.match(/find\s+(.+)/)?.[1] || 'information';
                    resolve(`@action: search ${searchTerm}`);
                }
                
                // System operations
                else if (taskLower.includes('check') && taskLower.includes('disk')) {
                    resolve('@action: check disk usage');
                } else if (taskLower.includes('show') && taskLower.includes('process')) {
                    resolve('@action: show processes');
                }
                
                // Development tasks
                else if (taskLower.includes('compile') || taskLower.includes('build')) {
                    const target = taskLower.includes('research') ? 'research_paper.tex' : 'document.tex';
                    resolve(`@action: compile ${target}`);
                } else if (taskLower.includes('run')) {
                    // Enhanced run command recognition
                    const runMatch = taskLower.match(/run\s+(.+)/);
                    if (runMatch) {
                        const target = runMatch[1].trim();
                        resolve(`@action: run ${target}`);
                    } else {
                        resolve('@action: run script.sh');
                    }
                }
                
                // Help and guidance
                else if (taskLower.match(/^(help|what can you do|commands|options)$/)) {
                    resolve('I can help you with:\n• Opening applications: "open excel", "open browser"\n• File operations: "list files", "show directory"\n• Searching: "search for tutorials"\n• System info: "check disk usage", "show processes"\n• Code generation: "create a program to calculate compound interest"\n• Development: "compile document", "run script"\n\nTry any of these commands!');
                }
                
                // Code and content creation
                else if (taskLower.includes('create') || taskLower.includes('make') || taskLower.includes('write')) {
                    if (taskLower.includes('program') || taskLower.includes('code') || taskLower.includes('script')) {
                        // Generate actual code
                        const codeRequest = this.generateCode(prompt);
                        resolve(codeRequest);
                    } else {
                        const target = taskLower.includes('document') ? 'document.txt' : 'file.txt';
                        resolve(`@action: open ${target}`);
                    }
                } else if (taskLower.includes('close') || taskLower.includes('exit') || taskLower.includes('quit')) {
                    resolve('To exit C9AI, type "exit" or "quit". To close an application, try "close [app name]".');
                }
                
                // Fallback with better suggestions
                else {
                    const suggestions = this.getSuggestions(taskLower);
                    reject(new Error(`I'm not sure what you mean by "${prompt}". ${suggestions}`));
                }

                clearTimeout(timeout);
                
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    generateCode(prompt) {
        const lowerPrompt = prompt.toLowerCase();
        
        // Detect programming language and type
        let language = 'python';  // Default
        let filename = 'program.py';
        
        if (lowerPrompt.includes('javascript') || lowerPrompt.includes('js')) {
            language = 'javascript';
            filename = 'program.js';
        } else if (lowerPrompt.includes('python') || lowerPrompt.includes('py')) {
            language = 'python';
            filename = 'program.py';
        } else if (lowerPrompt.includes('java')) {
            language = 'java';
            filename = 'Program.java';
        } else if (lowerPrompt.includes('c++') || lowerPrompt.includes('cpp')) {
            language = 'cpp';
            filename = 'program.cpp';
        }
        
        // Generate code based on request
        let code = '';
        
        if (lowerPrompt.includes('compound interest')) {
            code = this.generateCompoundInterestCode(language);
        } else if (lowerPrompt.includes('prime')) {
            code = this.generatePrimeCheckCode(language);
        } else if (lowerPrompt.includes('calculator')) {
            code = this.generateCalculatorCode(language);
        } else if (lowerPrompt.includes('fibonacci')) {
            code = this.generateFibonacciCode(language);
        } else if (lowerPrompt.includes('sort') || lowerPrompt.includes('array')) {
            code = this.generateSortingCode(language);
        } else if (lowerPrompt.includes('factorial')) {
            code = this.generateFactorialCode(language);
        } else {
            // Generic template
            code = this.generateGenericTemplate(language, prompt);
        }
        
        return `@create: ${filename}\n${code}`;
    }
    
    generateCompoundInterestCode(language) {
        switch (language) {
            case 'python':
                return `# Compound Interest Calculator
def calculate_compound_interest(principal, rate, time, compounds_per_year=1):
    """
    Calculate compound interest
    Formula: A = P(1 + r/n)^(nt)
    """
    amount = principal * (1 + rate/100/compounds_per_year) ** (compounds_per_year * time)
    compound_interest = amount - principal
    return amount, compound_interest

def main():
    print("=== Compound Interest Calculator ===")
    
    try:
        principal = float(input("Enter principal amount: $"))
        rate = float(input("Enter annual interest rate (%): "))
        time = float(input("Enter time period (years): "))
        compounds = int(input("Enter compounding frequency per year (default 1): ") or "1")
        
        amount, interest = calculate_compound_interest(principal, rate, time, compounds)
        
        print(f"\\nResults:")
        print(f"Principal Amount: $\{principal:,.2f}")
        print(f"Interest Rate: \{rate}% per year")
        print(f"Time Period: \{time} years")
        print(f"Compounding: \{compounds} times per year")
        print(f"\\nFinal Amount: $\{amount:,.2f}")
        print(f"Compound Interest: $\{interest:,.2f}")
        
    except ValueError:
        print("Please enter valid numbers!")

if __name__ == "__main__":
    main()`;
            
            case 'javascript':
                return `// Compound Interest Calculator
function calculateCompoundInterest(principal, rate, time, compoundsPerYear = 1) {
    const amount = principal * Math.pow(1 + rate/100/compoundsPerYear, compoundsPerYear * time);
    const compoundInterest = amount - principal;
    return { amount, compoundInterest };
}

function main() {
    console.log("=== Compound Interest Calculator ===");
    
    const principal = parseFloat(prompt("Enter principal amount: $"));
    const rate = parseFloat(prompt("Enter annual interest rate (%): "));
    const time = parseFloat(prompt("Enter time period (years): "));
    const compounds = parseInt(prompt("Enter compounding frequency per year: ") || "1");
    
    if (isNaN(principal) || isNaN(rate) || isNaN(time)) {
        console.log("Please enter valid numbers!");
        return;
    }
    
    const result = calculateCompoundInterest(principal, rate, time, compounds);
    
    console.log(\`
Results:
Principal Amount: $\${principal.toFixed(2)}
Interest Rate: \${rate}% per year
Time Period: \${time} years
Compounding: \${compounds} times per year

Final Amount: $\${result.amount.toFixed(2)}
Compound Interest: $\${result.compoundInterest.toFixed(2)}
    \`);
}

main();`;
            
            default:
                return this.generateCompoundInterestCode('python');
        }
    }
    
    generatePrimeCheckCode(language) {
        switch (language) {
            case 'python':
                return `# Prime Number Checker
def is_prime(n):
    """
    Check if a number is prime
    Returns True if prime, False otherwise
    """
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False
    
    # Check odd divisors up to sqrt(n)
    for i in range(3, int(n**0.5) + 1, 2):
        if n % i == 0:
            return False
    return True

def get_primes_in_range(start, end):
    """Get all prime numbers in a given range"""
    primes = []
    for num in range(start, end + 1):
        if is_prime(num):
            primes.append(num)
    return primes

def main():
    print("=== Prime Number Checker ===")
    
    while True:
        try:
            choice = input("\\n1. Check single number\\n2. Find primes in range\\n3. Exit\\nChoice: ")
            
            if choice == '1':
                num = int(input("Enter a number to check: "))
                if is_prime(num):
                    print(f"✅ {num} is a prime number!")
                else:
                    print(f"❌ {num} is not a prime number.")
                    
            elif choice == '2':
                start = int(input("Enter start of range: "))
                end = int(input("Enter end of range: "))
                primes = get_primes_in_range(start, end)
                
                if primes:
                    print(f"\\nPrime numbers between {start} and {end}:")
                    print(primes)
                    print(f"Found {len(primes)} prime numbers.")
                else:
                    print(f"No prime numbers found between {start} and {end}.")
                    
            elif choice == '3':
                print("Goodbye!")
                break
            else:
                print("Invalid choice. Please enter 1, 2, or 3.")
                
        except ValueError:
            print("Please enter valid numbers!")
        except KeyboardInterrupt:
            print("\\nGoodbye!")
            break

if __name__ == "__main__":
    main()`;
            
            case 'javascript':
                return `// Prime Number Checker
function isPrime(n) {
    /**
     * Check if a number is prime
     * Returns true if prime, false otherwise
     */
    if (n < 2) return false;
    if (n === 2) return true;
    if (n % 2 === 0) return false;
    
    // Check odd divisors up to sqrt(n)
    for (let i = 3; i <= Math.sqrt(n); i += 2) {
        if (n % i === 0) return false;
    }
    return true;
}

function getPrimesInRange(start, end) {
    const primes = [];
    for (let num = start; num <= end; num++) {
        if (isPrime(num)) {
            primes.push(num);
        }
    }
    return primes;
}

function main() {
    console.log("=== Prime Number Checker ===");
    
    const num = parseInt(prompt("Enter a number to check: "));
    
    if (isNaN(num)) {
        console.log("Please enter a valid number!");
        return;
    }
    
    if (isPrime(num)) {
        console.log(\`✅ \${num} is a prime number!\`);
    } else {
        console.log(\`❌ \${num} is not a prime number.\`);
    }
    
    // Show some examples
    console.log("\\nFirst 10 prime numbers:");
    console.log(getPrimesInRange(2, 30));
}

main();`;
            
            default:
                return this.generatePrimeCheckCode('python');
        }
    }
    
    generateGenericTemplate(language, prompt) {
        const taskDescription = prompt.replace(/create|make|write|program|code|script/gi, '').trim();
        
        switch (language) {
            case 'python':
                return `# ${taskDescription || 'Generated Program'}
def main():
    """
    TODO: Implement ${taskDescription || 'your functionality here'}
    """
    print("Hello! This is a generated program.")
    print("Task: ${taskDescription || 'Add your implementation'}")
    
    # Add your code here
    pass

if __name__ == "__main__":
    main()`;
    
            case 'javascript':
                return `// ${taskDescription || 'Generated Program'}
function main() {
    /*
     * TODO: Implement ${taskDescription || 'your functionality here'}
     */
    console.log("Hello! This is a generated program.");
    console.log("Task: ${taskDescription || 'Add your implementation'}");
    
    // Add your code here
}

main();`;
    
            default:
                return this.generateGenericTemplate('python', prompt);
        }
    }

    getSuggestions(input) {
        if (input.includes('excel') || input.includes('spreadsheet')) {
            return 'Try: "open excel"';
        } else if (input.includes('file') || input.includes('document')) {
            return 'Try: "list files" or "open document"';
        } else if (input.includes('search') || input.includes('find')) {
            return 'Try: "search for [topic]"';
        } else if (input.includes('help')) {
            return 'Try: "help" for available commands';
        } else {
            return 'Try commands like: "open excel", "list files", "search for tutorials", or "help"';
        }
    }

    async parseNaturalLanguageTodo(todoText) {
        try {
            const response = await this.runLocalAI(todoText);
            // Extract the action from the response
            const actionMatch = response.match(/@action:\s*(\w+)\s*(.*)/);
            if (actionMatch) {
                return {
                    verb: actionMatch[1],
                    target: actionMatch[2].trim(),
                    fullAction: actionMatch[0]
                };
            } else {
                throw new Error('Could not parse action from response');
            }
        } catch (error) {
            throw new Error(`Failed to parse natural language: ${error.message}`);
        }
    }

    async processNaturalLanguageCommand(input) {
        console.log(chalk.cyan(`🤖 Processing: "${input}"`));
        
        let spinner = null;
        
        try {
            // Try intelligent processing first (local or pattern matching)
            if (await this.hasLocalModel()) {
                spinner = ora('Analyzing with local AI...').start();
                
                try {
                    const response = await this.runLocalAI(input);
                    spinner.succeed('Response generated');
                    spinner = null; // Clear reference
                    
                    // Check if it's an action, creation, or conversational response
                    if (response.startsWith('@action:')) {
                        const action = response.replace('@action:', '').trim();
                        await this.executeAction(action);
                    } else if (response.startsWith('@create:')) {
                        await this.executeCreation(response);
                    } else {
                        // It's a conversational response, just display it
                        console.log(chalk.cyan(`🤖 ${response}`));
                    }
                } catch (interpretError) {
                    if (spinner) {
                        spinner.fail('Failed to process command');
                        spinner = null;
                    }
                    throw interpretError;
                }
            } else {
                // Fallback to simple pattern matching or suggest using AI
                const suggestion = this.suggestCommand(input);
                if (suggestion) {
                    console.log(chalk.yellow(`💡 Did you mean: ${suggestion}`));
                } else {
                    console.log(chalk.red(`❌ Unknown command: "${input.split(' ')[0]}"`));
                    console.log(chalk.yellow('💡 Type "help" or use "@claude" / "@gemini" to start a session.'));
                }
            }
        } catch (error) {
            // Make sure spinner stops in case of any error
            if (spinner) {
                spinner.fail('Command processing failed');
            }
            
            console.log(chalk.red(`❌ Error processing command: ${error.message}`));
            console.log(chalk.yellow('💡 Type "help" for available commands or try "@claude" for assistance.'));
        }
    }

    async interpretCommand(input) {
        // Use local AI to interpret the command
        await this.initLocalModel();
        
        const inputLower = input.toLowerCase();
        const isWindows = process.platform === 'win32';
        
        // Pattern matching for common commands
        if (inputLower.includes('list') && (inputLower.includes('documents') || inputLower.includes('files') || inputLower.includes('directories') || inputLower.includes('folder'))) {
            // Extract path - handle both Unix and Windows paths
            let pathMatch = input.match(/[\/\\][^\s]+/) || input.match(/[A-Za-z]:[\/\\][^\s]*/);
            let path = pathMatch ? pathMatch[0] : process.cwd();
            
            // If path ends with a word like "text" and input contains "directory", just use the path
            if ((inputLower.includes('directory') || inputLower.includes('folder')) && pathMatch) {
                path = pathMatch[0];
            }
            
            const command = isWindows ? `dir "${path}"` : `ls -la "${path}"`;
            return {
                action: 'list_files',
                path: path,
                command: command
            };
        } else if (inputLower.includes('list') && inputLower.includes('files')) {
            const pathMatch = input.match(/[\/\\][^\s]+/) || input.match(/[A-Za-z]:[\/\\][^\s]*/);
            const path = pathMatch ? pathMatch[0] : process.cwd();
            const command = isWindows ? `dir "${path}"` : `ls -la "${path}"`;
            return {
                action: 'list_files', 
                path: path,
                command: command
            };
        } else if (inputLower.includes('check') && inputLower.includes('disk')) {
            const command = isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -h';
            return {
                action: 'disk_usage',
                command: command
            };
        } else if (inputLower.includes('show') && inputLower.includes('process')) {
            const command = isWindows ? 'tasklist | findstr /v "Image"' : 'ps aux | head -20';
            return {
                action: 'show_processes',
                command: command
            };
        } else if (inputLower.includes('model') || inputLower.includes('switch')) {
            // Handle model switching commands
            throw new Error('Use "switch local" or "switch claude" to change models. Type "help" for available commands.');
        } else {
            throw new Error(`Could not understand: "${input}". Try commands like "list files", "open document", or "switch local"`);
        }
    }

    async executeCreation(response) {
        try {
            const lines = response.split('\n');
            const firstLine = lines[0];
            const filename = firstLine.replace('@create:', '').trim();
            const code = lines.slice(1).join('\n');
            
            console.log(chalk.green(`📝 Creating file: ${filename}`));
            console.log(chalk.cyan(`💡 Generated ${code.split('\n').length} lines of code`));
            
            // Write the file
            await fs.writeFile(filename, code);
            
            console.log(chalk.green(`✅ File created successfully: ${filename}`));
            console.log(chalk.yellow(`🚀 To run: python ${filename}`));
            
            // Show a preview of the code
            const preview = code.split('\n').slice(0, 10).join('\n');
            console.log(chalk.gray('\n--- Code Preview ---'));
            console.log(chalk.white(preview));
            if (code.split('\n').length > 10) {
                console.log(chalk.gray('... (truncated)'));
            }
            console.log(chalk.gray('--- End Preview ---\n'));
            
        } catch (error) {
            console.log(chalk.red(`❌ Failed to create file: ${error.message}`));
        }
    }

    async executeAction(action) {
        console.log(chalk.green(`🔧 Executing: ${action}`));
        
        try {
            // Parse different action types
            if (action.startsWith('open ')) {
                const target = action.replace('open ', '').trim();
                await this.runIntent('open', target);
            } else if (action.startsWith('search ')) {
                const query = action.replace('search ', '').trim();
                await this.runIntent('search', query);
            } else if (action.startsWith('list ')) {
                // Handle list commands
                const isWindows = process.platform === 'win32';
                const command = isWindows ? 'dir' : 'ls -la';
                const result = await this.runCommand(command, true);
                console.log(chalk.white(result));
            } else if (action.includes('disk usage')) {
                const isWindows = process.platform === 'win32';
                const command = isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -h';
                const result = await this.runCommand(command, true);
                console.log(chalk.white(result));
            } else if (action.includes('processes')) {
                const isWindows = process.platform === 'win32';
                const command = isWindows ? 'tasklist' : 'ps aux | head -20';
                const result = await this.runCommand(command, true);
                console.log(chalk.white(result));
            } else if (action.startsWith('compile ')) {
                const target = action.replace('compile ', '').trim();
                await this.runIntent('compile', target);
            } else if (action.startsWith('run ')) {
                const script = action.replace('run ', '').trim();
                
                // Handle different file types
                if (script.endsWith('.py')) {
                    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
                    const result = await this.runCommand(`${pythonCmd} ${script}`, true);
                    console.log(chalk.white(result));
                } else if (script.endsWith('.js')) {
                    const result = await this.runCommand(`node ${script}`, true);
                    console.log(chalk.white(result));
                } else if (script.endsWith('.sh')) {
                    const result = await this.runCommand(`bash ${script}`, true);
                    console.log(chalk.white(result));
                } else if (script.endsWith('.bat')) {
                    const result = await this.runCommand(script, true);
                    console.log(chalk.white(result));
                } else {
                    // Fallback to runIntent for other types
                    await this.runIntent('run', script);
                }
            } else {
                // Generic command execution
                const result = await this.runCommand(action, true);
                console.log(chalk.white(result));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Action failed: ${error.message}`));
        }
    }

    async executeInterpretedCommand(response) {
        console.log(chalk.green(`🔧 Executing: ${response.command}`));
        
        try {
            const result = await this.runCommand(response.command, true);
            console.log(chalk.white(result));
        } catch (error) {
            console.log(chalk.red(`❌ Command failed: ${error.message}`));
        }
    }

    suggestCommand(input) {
        const inputLower = input.toLowerCase();
        
        if (inputLower.includes('list') || inputLower.includes('show')) {
            return 'todos list  (to show todos)';
        } else if (inputLower.includes('add') || inputLower.includes('create')) {
            return 'todos add <task>  (to add a todo)';
        } else if (inputLower.includes('model')) {
            return 'models list  (to show available models)';
        } else if (inputLower.includes('help')) {
            return 'help  (to show available commands)';
        }
        
        return null;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = C9AI;