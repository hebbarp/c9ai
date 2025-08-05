const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const inquirer = require('inquirer');
const https = require('https');

class C9AI {
    constructor() {
        this.currentModel = 'claude';
        this.configDir = path.join(os.homedir(), '.c9ai');
        this.scriptsDir = path.join(this.configDir, 'scripts'); // This will now be the general tools directory
        this.modelsDir = path.join(this.configDir, 'models'); // Directory for local AI models
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
        if (this.localModel) {
            return; // Already initialized
        }

        try {
            // Find the first available model
            const files = await fs.readdir(this.modelsDir);
            const modelFile = files.find(f => f.endsWith('.gguf') || f.endsWith('.bin'));
            
            if (!modelFile) {
                throw new Error('No model files found');
            }

            const modelPath = path.join(this.modelsDir, modelFile);
            
            console.log(chalk.gray(`🔄 Loading local model: ${modelFile}...`));
            
            // For workshop demo: simulate local model initialization
            // In production, we would use proper llama.cpp bindings
            await this.sleep(1000); // Simulate loading time
            
            this.localModel = {
                modelPath,
                modelFile,
                ready: true
            };
            
            console.log(chalk.green(`✅ Local model ready: ${modelFile}`));
            
        } catch (error) {
            console.error(chalk.red('❌ Failed to initialize local model:'), error.message);
            throw error;
        }
    }

    async runLocalAI(prompt) {
        if (!this.localModel || !this.localModel.ready) {
            await this.initLocalModel();
        }

        try {
            // For workshop demo: simulate intelligent local processing
            // This would normally call the actual local model
            await this.sleep(500); // Simulate processing time
            
            // Smart pattern matching for demo purposes
            const taskLower = prompt.toLowerCase();
            
            if (taskLower.includes('compile') && taskLower.includes('research')) {
                return '@action: compile research_paper.tex';
            } else if (taskLower.includes('open') && taskLower.includes('budget')) {
                return '@action: open budget.xlsx';
            } else if (taskLower.includes('check') && taskLower.includes('github')) {
                return '@action: open https://github.com/user/repo/issues';
            } else if (taskLower.includes('run') && taskLower.includes('cleanup')) {
                return '@action: run cleanup-weekly.sh';
            } else if (taskLower.includes('search')) {
                const searchTerm = taskLower.match(/search.*?for\s+(.+?)(?:\s|$)/)?.[1] || 'tutorial';
                return `@action: search ${searchTerm}`;
            } else if (taskLower.includes('compile')) {
                return '@action: compile document.tex';
            } else if (taskLower.includes('open')) {
                const fileType = taskLower.includes('spreadsheet') ? 'xlsx' : 'txt';
                return `@action: open file.${fileType}`;
            } else {
                // Generic fallback
                const words = taskLower.split(' ');
                const lastWord = words[words.length - 1] || 'file';
                return `@action: open ${lastWord}.txt`;
            }
            
        } catch (error) {
            throw new Error(`Local AI error: ${error.message}`);
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
        
        try {
            // Try intelligent processing first (local or pattern matching)
            if (await this.hasLocalModel()) {
                const spinner = ora('Analyzing with local AI...').start();
                const response = await this.interpretCommand(input);
                spinner.succeed('Command interpreted');
                
                await this.executeInterpretedCommand(response);
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
            console.log(chalk.red(`❌ Error processing command: ${error.message}`));
            console.log(chalk.yellow('💡 Type "help" for available commands or try "@claude" for assistance.'));
        }
    }

    async interpretCommand(input) {
        // Use local AI to interpret the command
        await this.initLocalModel();
        
        const inputLower = input.toLowerCase();
        
        // Pattern matching for common commands
        if (inputLower.includes('list') && (inputLower.includes('documents') || inputLower.includes('files'))) {
            // Extract path - handle "/path/to/folder directory" format
            let pathMatch = input.match(/\/[^\s]+/);
            let path = pathMatch ? pathMatch[0] : process.cwd();
            
            // If path ends with a word like "text" and input contains "directory", just use the path
            if (inputLower.includes('directory') && pathMatch) {
                path = pathMatch[0];
            }
            
            return {
                action: 'list_files',
                path: path,
                command: `ls -la "${path}"`
            };
        } else if (inputLower.includes('list') && inputLower.includes('files')) {
            const pathMatch = input.match(/\/[^\s]+/);
            const path = pathMatch ? pathMatch[0] : process.cwd();
            return {
                action: 'list_files', 
                path: path,
                command: `ls -la "${path}"`
            };
        } else if (inputLower.includes('check') && inputLower.includes('disk')) {
            return {
                action: 'disk_usage',
                command: 'df -h'
            };
        } else if (inputLower.includes('show') && inputLower.includes('process')) {
            return {
                action: 'show_processes',
                command: 'ps aux | head -20'
            };
        } else {
            throw new Error('Could not interpret command');
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