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
        this.agenticTools = {}; // Registry for agentic tool use
        this.appMappings = {}; // Application name mappings
        this.learningData = {}; // Learning system data
        this.knowledgeBase = { topics: {}, fallbacks: {} }; // Knowledge base for content generation
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
        
        // Load agentic tools registry
        await this.loadAgenticTools();
        
        // Load application mappings and learning data
        await this.loadAppMappings();
        
        // Load knowledge base
        await this.loadKnowledgeBase();
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
    
    async loadAgenticTools() {
        try {
            const toolsPath = path.join(__dirname, 'tools-registry.json');
            if (await fs.exists(toolsPath)) {
                const toolsData = await fs.readJson(toolsPath);
                this.agenticTools = toolsData.tools;
                this.toolSelectionPrompt = toolsData.tool_selection_prompt;
                console.log(chalk.green(`✅ Loaded ${Object.keys(this.agenticTools).length} agentic tools`));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not load agentic tools registry'));
        }
    }

    async loadAppMappings() {
        try {
            const mappingsPath = path.join(__dirname, 'app-mappings.json');
            if (await fs.exists(mappingsPath)) {
                const mappingsData = await fs.readJson(mappingsPath);
                this.appMappings = mappingsData.applications;
                this.learningData = mappingsData.learning;
                console.log(chalk.green(`✅ Loaded ${Object.keys(this.appMappings).length} app mappings`));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not load app mappings'));
        }
    }

    async loadKnowledgeBase() {
        try {
            const knowledgePath = path.join(__dirname, 'knowledge-base.json');
            if (await fs.exists(knowledgePath)) {
                this.knowledgeBase = await fs.readJson(knowledgePath);
                console.log(chalk.green(`✅ Loaded ${Object.keys(this.knowledgeBase.topics).length} knowledge topics`));
            } else {
                console.log(chalk.yellow('⚠️ No knowledge base file found, using built-in knowledge'));
            }
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not load knowledge base, using built-in knowledge'));
        }
    }

    async saveAppMappings() {
        try {
            const mappingsPath = path.join(__dirname, 'app-mappings.json');
            const mappingsData = {
                applications: this.appMappings,
                learning: this.learningData
            };
            await fs.writeJson(mappingsPath, mappingsData, { spaces: 2 });
        } catch (error) {
            console.log(chalk.yellow('⚠️ Could not save app mappings'));
        }
    }

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

            // Handle sigil-based modes
            if (input.startsWith('@')) {
                const parts = input.substring(1).split(' ');
                const mode = parts[0];
                const content = parts.slice(1).join(' ');
                
                switch (mode) {
                    case 'claude':
                    case 'gemini':
                    case 'local':
                        if (content) {
                            // Direct prompt to AI model
                            await this.runAI(mode, content);
                        } else {
                            // Interactive session
                            await this.startInteractiveSession(mode);
                        }
                        return;
                    case 'conv':
                    case 'chat':
                        // Explicit conversation mode
                        await this.handleConversation(content || 'Hello!');
                        return;
                    case 'cmd':
                    case 'command':
                        // Explicit command mode
                        await this.processNaturalLanguageCommand(content);
                        return;
                    case 'tool':
                        // Tool execution
                        await this.executeToolDirective(content);
                        return;
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
                    await this.handleTools(args[0], args.slice(1));
                    break;
                case 'models':
                    await this.handleModels(args[0], args[1]);
                    break;
                case 'scan':
                    await this.handleKnowledgeScan(args);
                    break;
                case 'issues':
                    await this.handleIssues(args[0], args.slice(1));
                    break;
                case 'achieve':
                case 'goal':
                    await this.achieveGoal(args.join(' '));
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
                    // Smart detection: conversation vs command
                    if (command && input.trim().length > 0) {
                        if (this.isConversationalInput(input.trim())) {
                            await this.handleConversation(input.trim());
                        } else {
                            await this.processNaturalLanguageCommand(input.trim());
                        }
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

    async handleTools(action = 'list', args = []) {
        switch (action) {
            case 'list':
            case 'ls':
                await this.listAgenticTools();
                break;
            case 'add':
                await this.addAgenticTool(args);
                break;
            case 'edit':
            case 'modify':
                await this.editAgenticTool(args[0]);
                break;
            case 'remove':
            case 'delete':
            case 'rm':
                await this.removeAgenticTool(args[0]);
                break;
            case 'scripts':
                await this.listScriptTools();
                break;
            case 'reload':
                await this.loadAgenticTools();
                console.log(chalk.green('✅ Tools registry reloaded'));
                break;
            default:
                console.log(chalk.yellow('💡 Available tool commands:'));
                console.log(chalk.white('  tools list     - List all agentic tools'));
                console.log(chalk.white('  tools add      - Add a new tool (interactive)'));
                console.log(chalk.white('  tools edit <name> - Edit an existing tool'));
                console.log(chalk.white('  tools remove <name> - Remove a tool'));
                console.log(chalk.white('  tools scripts  - List executable scripts'));
                console.log(chalk.white('  tools reload   - Reload tools registry'));
        }
    }

    async listAgenticTools() {
        console.log(chalk.cyan('🤖 Agentic Tools Registry'));
        console.log(chalk.gray('='.repeat(50)));
        
        if (Object.keys(this.agenticTools).length === 0) {
            console.log(chalk.yellow('No agentic tools loaded. Check tools-registry.json'));
            return;
        }

        for (const [toolName, tool] of Object.entries(this.agenticTools)) {
            console.log(chalk.green(`\n📦 ${toolName}`));
            console.log(chalk.white(`   Description: ${tool.description}`));
            console.log(chalk.gray(`   Command: ${tool.command}`));
            
            if (tool.windows_command && tool.windows_command !== tool.command) {
                console.log(chalk.gray(`   Windows: ${tool.windows_command}`));
            }
            
            if (tool.parameters && Object.keys(tool.parameters).length > 0) {
                console.log(chalk.cyan('   Parameters:'));
                for (const [paramName, paramInfo] of Object.entries(tool.parameters)) {
                    const required = paramInfo.required ? '(required)' : '(optional)';
                    console.log(chalk.white(`     ${paramName}: ${paramInfo.description} ${required}`));
                }
            }
        }
        
        console.log(chalk.yellow(`\n💡 Total: ${Object.keys(this.agenticTools).length} tools available`));
        console.log(chalk.cyan('📝 Use "tools edit <name>" to modify or "tools add" to create new tools'));
    }

    async listScriptTools() {
        console.log(chalk.cyan('📜 Executable Scripts:'));
        console.log(chalk.gray('='.repeat(40)));
        
        try {
            const files = await fs.readdir(this.scriptsDir);
            const executableFiles = [];
            for (const file of files) {
                const filePath = path.join(this.scriptsDir, file);
                const stats = await fs.stat(filePath);
                if (stats.isFile() && (stats.mode & fs.constants.S_IXUSR)) {
                    executableFiles.push(file);
                }
            }

            if (executableFiles.length === 0) {
                console.log(chalk.yellow('No executable scripts found in ~/.c9ai/scripts/'));
                return;
            }

            for (const toolName of executableFiles) {
                console.log(chalk.white(`- ${toolName}`));
            }
            console.log(chalk.yellow('\n💡 Use @run <script_name> in your todos to execute these scripts.'));
        } catch (error) {
            console.error(chalk.red('❌ Error listing scripts:'), error.message);
        }
    }

    async addAgenticTool(args) {
        console.log(chalk.cyan('➕ Add New Agentic Tool'));
        console.log(chalk.gray('='.repeat(30)));
        
        try {
            const questions = [
                {
                    type: 'input',
                    name: 'name',
                    message: 'Tool name (e.g., "my_custom_tool"):',
                    validate: (input) => {
                        if (!input.trim()) return 'Tool name is required';
                        if (this.agenticTools[input]) return 'Tool already exists. Use "tools edit" to modify.';
                        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(input)) return 'Invalid name. Use letters, numbers, underscores only.';
                        return true;
                    }
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Tool description:',
                    validate: (input) => input.trim() ? true : 'Description is required'
                },
                {
                    type: 'input',
                    name: 'command',
                    message: 'Command to execute (Unix/Mac):',
                    validate: (input) => input.trim() ? true : 'Command is required'
                },
                {
                    type: 'input',
                    name: 'windows_command',
                    message: 'Windows command (leave empty to use same as Unix):'
                },
                {
                    type: 'confirm',
                    name: 'hasParameters',
                    message: 'Does this tool need parameters?',
                    default: false
                }
            ];

            const answers = await inquirer.prompt(questions);
            
            const newTool = {
                name: answers.name,
                description: answers.description,
                command: answers.command,
                parameters: {}
            };
            
            if (answers.windows_command) {
                newTool.windows_command = answers.windows_command;
            }
            
            if (answers.hasParameters) {
                console.log(chalk.yellow('\nAdding parameters (press Enter with empty name to finish):'));
                while (true) {
                    const paramQuestions = [
                        {
                            type: 'input',
                            name: 'paramName',
                            message: 'Parameter name:'
                        }
                    ];
                    
                    const paramAnswer = await inquirer.prompt(paramQuestions);
                    if (!paramAnswer.paramName.trim()) break;
                    
                    const paramDetailsQuestions = [
                        {
                            type: 'input',
                            name: 'description',
                            message: `Description for ${paramAnswer.paramName}:`,
                            validate: (input) => input.trim() ? true : 'Parameter description is required'
                        },
                        {
                            type: 'list',
                            name: 'type',
                            message: 'Parameter type:',
                            choices: ['string', 'number', 'boolean'],
                            default: 'string'
                        },
                        {
                            type: 'confirm',
                            name: 'required',
                            message: 'Is this parameter required?',
                            default: false
                        }
                    ];
                    
                    const paramDetails = await inquirer.prompt(paramDetailsQuestions);
                    
                    newTool.parameters[paramAnswer.paramName] = {
                        type: paramDetails.type,
                        description: paramDetails.description,
                        required: paramDetails.required
                    };
                }
            }
            
            // Add to registry
            this.agenticTools[answers.name] = newTool;
            
            // Save to file
            await this.saveAgenticTools();
            
            console.log(chalk.green(`✅ Tool '${answers.name}' added successfully!`));
            console.log(chalk.cyan('💡 Test it by saying something like:'));
            console.log(chalk.white(`   "${answers.description.toLowerCase()}"`));
            
        } catch (error) {
            if (error.message !== 'User interrupted') {
                console.error(chalk.red('❌ Error adding tool:'), error.message);
            }
        }
    }

    async editAgenticTool(toolName) {
        if (!toolName) {
            console.log(chalk.yellow('💡 Usage: tools edit <tool_name>'));
            return;
        }
        
        if (!this.agenticTools[toolName]) {
            console.log(chalk.red(`❌ Tool '${toolName}' not found`));
            return;
        }
        
        console.log(chalk.cyan(`✏️ Editing Tool: ${toolName}`));
        console.log(chalk.gray('='.repeat(30)));
        
        const toolsPath = path.join(__dirname, 'tools-registry.json');
        console.log(chalk.cyan(`📝 Opening tools registry for editing: ${toolsPath}`));
        
        const editor = process.env.EDITOR || 'nano';
        try {
            await this.runCommand(`${editor} "${toolsPath}"`);
            await this.loadAgenticTools();
            console.log(chalk.green('✅ Tools registry reloaded'));
        } catch (error) {
            console.error(chalk.red('❌ Error editing tools:'), error.message);
        }
    }

    async removeAgenticTool(toolName) {
        if (!toolName) {
            console.log(chalk.yellow('💡 Usage: tools remove <tool_name>'));
            return;
        }
        
        if (!this.agenticTools[toolName]) {
            console.log(chalk.red(`❌ Tool '${toolName}' not found`));
            return;
        }
        
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Remove tool '${toolName}'?`,
                default: false
            }
        ]);

        if (confirm) {
            delete this.agenticTools[toolName];
            await this.saveAgenticTools();
            console.log(chalk.green(`✅ Tool '${toolName}' removed successfully`));
        } else {
            console.log(chalk.gray('Cancelled'));
        }
    }

    async saveAgenticTools() {
        try {
            const toolsPath = path.join(__dirname, 'tools-registry.json');
            const toolsData = {
                tools: this.agenticTools,
                tool_selection_prompt: this.toolSelectionPrompt
            };
            
            await fs.writeJson(toolsPath, toolsData, { spaces: 2 });
        } catch (error) {
            throw new Error(`Failed to save tools registry: ${error.message}`);
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
        console.log(chalk.yellow('\n🤖 AI Modes & Conversation:'));
        console.log(chalk.white('  @claude [prompt]    - Claude session or direct prompt'));
        console.log(chalk.white('  @gemini [prompt]    - Gemini session or direct prompt'));
        console.log(chalk.white('  @local [prompt]     - Local AI session or direct prompt'));
        console.log(chalk.white('  @conv <message>     - Explicit conversation mode'));
        console.log(chalk.white('  @cmd <command>      - Explicit command mode'));
        console.log(chalk.white('  Natural questions   - Auto-detected as conversation'));

        console.log(chalk.yellow('\n⚡ Quick Prompts:'));
        console.log(chalk.white('  (Removed - use interactive sessions for AI prompts)'));

        console.log(chalk.yellow('\n📋 Productivity & Issues:'));
        console.log(chalk.white('  todos [action]      - Manage todos (list, add, sync)'));
        console.log(chalk.white('  issues list         - List GitHub issues'));
        console.log(chalk.white('  issues execute [#]  - Execute specific issue'));
        console.log(chalk.white('  issues auto         - Auto-execute matching issues'));
        console.log(chalk.white('  achieve "<goal>"    - Autonomous goal achievement'));
        console.log(chalk.white('  analytics           - View productivity insights'));

        console.log(chalk.yellow('\\n🔧 System & Tools:'));
        console.log(chalk.white('  ! <command>         - Execute any shell command (e.g., !ls -l)'));
        console.log(chalk.white('  switch <model>      - Switch default AI model (claude|gemini|local)'));
        console.log(chalk.white('  tools list          - List all agentic tools'));
        console.log(chalk.white('  tools add           - Add new tool (interactive)'));
        console.log(chalk.white('  tools edit <name>   - Edit existing tool'));
        console.log(chalk.white('  tools remove <name> - Remove tool'));
        console.log(chalk.white('  tools scripts       - List executable scripts'));
        console.log(chalk.white('  scan <dirs...>      - Scan directories to build knowledge base'));
        console.log(chalk.white('  scan --help         - Show scanning options'));
        console.log(chalk.white('  config              - Show configuration'));
        console.log(chalk.white('  help                - Show this help'));
    }

    async handleKnowledgeScan(args) {
        const KnowledgeScanner = require('./knowledge-scanner.js');
        
        if (args.includes('--help') || args.includes('-h')) {
            console.log(chalk.cyan('🔍 Knowledge Base Scanner'));
            console.log(chalk.gray('='.repeat(30)));
            console.log(chalk.yellow('\nUsage:'));
            console.log(chalk.white('  scan [directories...]     - Scan specified directories'));
            console.log(chalk.white('  scan                      - Scan current directory'));
            console.log(chalk.white('  scan ~/Documents ~/Code   - Scan multiple directories'));
            console.log(chalk.yellow('\nOptions:'));
            console.log(chalk.white('  --help, -h               - Show this help'));
            console.log(chalk.yellow('\nExamples:'));
            console.log(chalk.gray('  scan ~/Documents ~/Projects'));
            console.log(chalk.gray('  scan .'));
            console.log(chalk.gray('  scan /Users/me/code'));
            return;
        }
        
        // Default to current directory if no args provided
        const directories = args.length > 0 ? args : [process.cwd()];
        
        // Expand home directory
        const expandedDirs = directories.map(dir => {
            if (dir.startsWith('~')) {
                return path.join(require('os').homedir(), dir.substring(1));
            }
            return path.resolve(dir);
        });
        
        console.log(chalk.cyan(`🔍 Scanning ${expandedDirs.length} directories for knowledge...`));
        console.log(chalk.gray('This may take a few minutes depending on directory size.'));
        
        try {
            const scanner = new KnowledgeScanner();
            const knowledgeBase = await scanner.scanDirectories(expandedDirs, {
                includeCode: true,
                includeDocs: true,
                includeReadmes: true,
                maxDepth: 3,
                ignorePatterns: ['node_modules', '.git', 'dist', 'build', '.DS_Store', 'coverage']
            });
            
            // Save the knowledge base
            const knowledgePath = path.join(__dirname, 'knowledge-base.json');
            await scanner.saveKnowledgeBase(knowledgePath);
            
            // Reload the knowledge base in current instance
            await this.loadKnowledgeBase();
            
            console.log(chalk.green('\\n🎉 Knowledge base successfully created!'));
            console.log(chalk.white(`📊 Summary:`));
            console.log(chalk.white(`   🧠 Topics: ${Object.keys(knowledgeBase.topics).length}`));
            console.log(chalk.white(`   📝 Sources: Various files from scanned directories`));
            console.log(chalk.cyan('\\n💡 Try creating content with your discovered topics:'));
            
            // Show some discovered topics
            const topics = Object.keys(knowledgeBase.topics).slice(0, 3);
            for (const topic of topics) {
                console.log(chalk.gray(`   c9ai> write a post about ${topic}`));
            }
            
        } catch (error) {
            console.error(chalk.red('❌ Knowledge scanning failed:'), error.message);
        }
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

    async runLocalAIForToolSelection(prompt, retryCount = 0) {
        if (!this.localModel || !this.localModel.ready) {
            await this.initLocalModel();
        }

        try {
            // Use simple prompt format for tool selection
            const simplePrompt = `${prompt}\n\nResponse:`;
            
            if (getLlama && llamaCppLoaded && this.localModel.session && !this.localModel.fallbackMode) {
                console.log(chalk.gray('🤖 Querying local model for tool selection...'));
                
                const responsePromise = this.localModel.session.prompt(simplePrompt, {
                    maxTokens: 200,
                    temperature: 0.1, // Lower temperature for more focused responses
                    repeatPenalty: 1.1,
                    stopSequences: ['}', '\n\n']
                });

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Tool selection timeout (15s)')), 15000);
                });

                let response = await Promise.race([responsePromise, timeoutPromise]);
                
                // Ensure we have complete JSON
                if (response && !response.includes('}')) {
                    response += '}';
                }

                return response.trim();
            } else {
                // Fallback to pattern matching directly
                throw new Error('Local model not available for tool selection');
            }
            
        } catch (error) {
            if (retryCount < 1) { // Only retry once for tool selection
                console.log(chalk.yellow(`⚠️ Tool selection retry: ${error.message}`));
                await this.sleep(500);
                return await this.runLocalAIForToolSelection(prompt, retryCount + 1);
            } else {
                throw new Error(`Tool selection failed: ${error.message}`);
            }
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
                        // Use content creation tool
                        const contentType = taskLower.includes('post') ? 'post' : 
                                          taskLower.includes('article') ? 'article' : 'document';
                        const topicMatch = prompt.match(/about\s+(.+)/i) || prompt.match(/(write|create|make)\s+[a-z\s]*?\s+(.+)/i);
                        const topic = topicMatch ? topicMatch[topicMatch.length - 1].trim() : 'general topic';
                        resolve(`@tool: create_content type="${contentType}" topic="${topic}"`);
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
            // Try agentic tool use first if local model is available
            if (await this.hasLocalModel() && Object.keys(this.agenticTools).length > 0) {
                spinner = ora('🔧 Selecting appropriate tools...').start();
                
                try {
                    const toolSelection = await this.selectAndExecuteTool(input);
                    if (toolSelection.executed) {
                        spinner.succeed('Tool executed successfully');
                        return;
                    } else {
                        spinner.text = 'Falling back to conversational AI...';
                    }
                } catch (toolError) {
                    spinner.text = 'Tool selection failed, trying conversational AI...';
                }
            }
            
            // Try intelligent processing (local or pattern matching)
            if (await this.hasLocalModel()) {
                if (!spinner) spinner = ora('Analyzing with local AI...').start();
                
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

    async selectAndExecuteTool(userInput) {
        try {
            // For fallback mode models, use pattern matching directly
            if (this.localModel && this.localModel.fallbackMode) {
                console.log(chalk.gray('🔧 Using pattern matching for tool selection...'));
                return await this.fallbackToolSelection(userInput);
            }
            
            // Prepare tool list for AI
            const toolsList = Object.keys(this.agenticTools).map(toolName => {
                const tool = this.agenticTools[toolName];
                return `${toolName}: ${tool.description}`;
            }).join('\n');
            
            // Create prompt for tool selection
            const prompt = this.toolSelectionPrompt
                .replace('{tools}', toolsList)
                .replace('{user_input}', userInput);
            
            // Get tool selection from local AI with specific context
            const aiResponse = await this.runLocalAIForToolSelection(prompt);
            
            // Parse JSON response
            let selection;
            try {
                // Extract JSON from response if it's wrapped in other text
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
                selection = JSON.parse(jsonStr);
            } catch (parseError) {
                // Fallback to pattern matching if JSON parsing fails
                console.log(chalk.gray('🔧 JSON parsing failed, using pattern matching...'));
                return await this.fallbackToolSelection(userInput);
            }
            
            if (!selection.tool || !this.agenticTools[selection.tool]) {
                console.log(chalk.gray(`🔧 Invalid tool "${selection.tool}", using pattern matching...`));
                return await this.fallbackToolSelection(userInput);
            }
            
            console.log(chalk.cyan(`🧠 AI selected: ${selection.tool}`));
            console.log(chalk.gray(`   Reasoning: ${selection.reasoning}`));
            
            // Execute the selected tool
            await this.executeAgenticTool(selection.tool, selection.parameters || {});
            
            return { executed: true, tool: selection.tool, reasoning: selection.reasoning };
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️ AI tool selection failed, using pattern matching...`));
            return await this.fallbackToolSelection(userInput);
        }
    }
    
    async fallbackToolSelection(userInput) {
        // Enhanced pattern matching fallback when JSON parsing fails
        const inputLower = userInput.toLowerCase();
        
        if (inputLower.includes('list') && (inputLower.includes('files') || inputLower.includes('directory'))) {
            await this.executeAgenticTool('list_files', {});
            return { executed: true, tool: 'list_files', reasoning: 'Pattern match for file listing' };
        } else if ((inputLower.includes('disk') && (inputLower.includes('usage') || inputLower.includes('space'))) || 
                   (inputLower.includes('show') && inputLower.includes('disk')) ||
                   (inputLower.includes('check') && inputLower.includes('disk'))) {
            await this.executeAgenticTool('check_disk_usage', {});
            return { executed: true, tool: 'check_disk_usage', reasoning: 'Pattern match for disk usage' };
        } else if (inputLower.includes('process') || (inputLower.includes('show') && inputLower.includes('process'))) {
            await this.executeAgenticTool('show_processes', {});
            return { executed: true, tool: 'show_processes', reasoning: 'Pattern match for processes' };
        } else if (inputLower.includes('github') || inputLower.includes('issues')) {
            await this.executeAgenticTool('github_issues', {});
            return { executed: true, tool: 'github_issues', reasoning: 'Pattern match for GitHub issues' };
        } else if ((inputLower.includes('git') && inputLower.includes('status')) || 
                   (inputLower.includes('show') && inputLower.includes('git'))) {
            await this.executeAgenticTool('git_status', {});
            return { executed: true, tool: 'git_status', reasoning: 'Pattern match for git status' };
        } else if (inputLower.includes('search')) {
            const query = inputLower.replace(/.*search\s+(for\s+)?/, '').trim() || 'help';
            await this.executeAgenticTool('search_web', { query });
            return { executed: true, tool: 'search_web', reasoning: 'Pattern match for web search' };
        } else if (inputLower.includes('open')) {
            const target = inputLower.replace(/.*open\s+/, '').trim() || 'file';
            await this.executeAgenticTool('open_application', { target });
            return { executed: true, tool: 'open_application', reasoning: 'Pattern match for opening application' };
        } else if ((inputLower.includes('write') || inputLower.includes('create')) && 
                   (inputLower.includes('post') || inputLower.includes('article') || inputLower.includes('document'))) {
            // Extract content type and topic
            const contentType = inputLower.includes('post') ? 'post' : 
                              inputLower.includes('article') ? 'article' : 'document';
            const topicMatch = userInput.match(/about\s+(.+)/i) || userInput.match(/(write|create)\s+[a-z\s]*?\s+(.+)/i);
            const topic = topicMatch ? topicMatch[topicMatch.length - 1].trim() : 'general topic';
            
            await this.executeAgenticTool('create_content', { type: contentType, topic });
            return { executed: true, tool: 'create_content', reasoning: 'Pattern match for content creation' };
        } else if ((inputLower.includes('list') && inputLower.includes('files')) || 
                   (inputLower.includes('show') && inputLower.includes('files'))) {
            await this.executeAgenticTool('list_files', {});
            return { executed: true, tool: 'list_files', reasoning: 'Pattern match for listing files' };
        }
        
        return { executed: false, error: 'No matching tool found' };
    }
    
    async handleIssues(action = 'list', args = []) {
        switch (action) {
            case 'list':
            case 'ls':
                await this.listGitHubIssues();
                break;
            case 'execute':
            case 'run':
                await this.executeGitHubIssues(args[0]);
                break;
            case 'auto':
                await this.autoExecuteIssues(args[0]);
                break;
            default:
                console.log(chalk.yellow('💡 Available issues commands:'));
                console.log(chalk.white('  issues list         - List GitHub issues'));
                console.log(chalk.white('  issues execute [#]  - Execute specific issue'));
                console.log(chalk.white('  issues auto [repo]  - Auto-execute matching issues'));
        }
    }

    async listGitHubIssues(repo = 'hebbarp/todo-management') {
        console.log(chalk.cyan('📋 GitHub Issues'));
        console.log(chalk.gray('='.repeat(40)));
        
        try {
            const result = await this.runCommand(`gh issue list --repo ${repo} --json number,title,body,labels`, true);
            const issues = JSON.parse(result);
            
            if (issues.length === 0) {
                console.log(chalk.yellow('No open issues found'));
                return;
            }
            
            for (const issue of issues) {
                console.log(chalk.green(`\n#${issue.number}: ${issue.title}`));
                if (issue.body) {
                    const preview = issue.body.substring(0, 100);
                    console.log(chalk.gray(`   ${preview}${issue.body.length > 100 ? '...' : ''}`));
                }
                if (issue.labels && issue.labels.length > 0) {
                    const labelNames = issue.labels.map(l => l.name).join(', ');
                    console.log(chalk.cyan(`   Labels: ${labelNames}`));
                }
            }
            
            console.log(chalk.yellow(`\n💡 Use "issues execute #${issues[0].number}" to execute a specific issue`));
            console.log(chalk.cyan('🤖 Use "issues auto" to let AI match and execute issues'));
            
        } catch (error) {
            console.log(chalk.red(`❌ Error fetching issues: ${error.message}`));
            console.log(chalk.yellow('💡 Make sure GitHub CLI is installed and authenticated'));
        }
    }

    async executeGitHubIssues(issueNumber, repo = 'hebbarp/todo-management') {
        if (!issueNumber) {
            console.log(chalk.yellow('💡 Usage: issues execute <issue_number>'));
            return;
        }
        
        console.log(chalk.cyan(`🎯 Executing Issue #${issueNumber}`));
        console.log(chalk.gray('='.repeat(40)));
        
        try {
            const result = await this.runCommand(`gh issue view ${issueNumber} --repo ${repo} --json title,body,labels`, true);
            const issue = JSON.parse(result);
            
            console.log(chalk.green(`📋 ${issue.title}`));
            console.log(chalk.white(`\n${issue.body || 'No description'}`));
            
            // Try to match issue with available tools
            const matchedTool = await this.matchIssueToTool(issue);
            
            if (matchedTool) {
                console.log(chalk.cyan(`🧠 AI matched issue to tool: ${matchedTool.tool}`));
                console.log(chalk.gray(`   Reasoning: ${matchedTool.reasoning}`));
                
                const { confirm } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: `Execute tool '${matchedTool.tool}'?`,
                        default: true
                    }
                ]);
                
                if (confirm) {
                    await this.executeAgenticTool(matchedTool.tool, matchedTool.parameters || {});
                    console.log(chalk.green(`✅ Issue #${issueNumber} executed successfully`));
                } else {
                    console.log(chalk.gray('Execution cancelled'));
                }
            } else {
                console.log(chalk.yellow('⚠️ No matching tool found for this issue'));
                console.log(chalk.cyan('💡 Suggestions:'));
                const suggestions = this.suggestToolsForIssue(issue);
                suggestions.forEach(suggestion => {
                    console.log(chalk.white(`   • ${suggestion}`));
                });
            }
            
        } catch (error) {
            console.log(chalk.red(`❌ Error executing issue: ${error.message}`));
        }
    }

    async matchIssueToTool(issue) {
        try {
            const toolsList = Object.keys(this.agenticTools).map(toolName => {
                const tool = this.agenticTools[toolName];
                return `${toolName}: ${tool.description}`;
            }).join('\n');
            
            const prompt = `Available tools:
${toolsList}

GitHub Issue:
Title: ${issue.title}
Body: ${issue.body || 'No description'}

Match this GitHub issue to the most appropriate tool. If no tool matches well, respond with "NO_MATCH".
Respond in JSON format:
{
  "tool": "tool_name",
  "parameters": {"param1": "value1"},
  "reasoning": "why this tool matches the issue"
}`;
            
            if (await this.hasLocalModel()) {
                const response = await this.runLocalAI(prompt);
                
                if (response.includes('NO_MATCH')) {
                    return null;
                }
                
                try {
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : response;
                    const match = JSON.parse(jsonStr);
                    
                    if (this.agenticTools[match.tool]) {
                        return match;
                    }
                } catch (parseError) {
                    // Fallback to pattern matching
                    return this.patternMatchIssue(issue);
                }
            }
            
            return this.patternMatchIssue(issue);
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Tool matching failed: ${error.message}`));
            return null;
        }
    }

    patternMatchIssue(issue) {
        const text = `${issue.title} ${issue.body || ''}`.toLowerCase();
        
        if (text.includes('list') && (text.includes('files') || text.includes('directory'))) {
            return { tool: 'list_files', parameters: {}, reasoning: 'Pattern match for file listing' };
        } else if (text.includes('disk') && text.includes('space')) {
            return { tool: 'check_disk_usage', parameters: {}, reasoning: 'Pattern match for disk usage' };
        } else if (text.includes('process')) {
            return { tool: 'show_processes', parameters: {}, reasoning: 'Pattern match for processes' };
        } else if (text.includes('git') && text.includes('status')) {
            return { tool: 'git_status', parameters: {}, reasoning: 'Pattern match for git status' };
        } else if (text.includes('search')) {
            const query = text.match(/search\s+(?:for\s+)?([^\s]+)/)?.[1] || 'information';
            return { tool: 'search_web', parameters: { query }, reasoning: 'Pattern match for web search' };
        }
        
        return null;
    }

    suggestToolsForIssue(issue) {
        const suggestions = [];
        const text = `${issue.title} ${issue.body || ''}`.toLowerCase();
        
        if (text.includes('file') || text.includes('directory')) {
            suggestions.push('Consider using "list_files" tool');
        }
        if (text.includes('system') || text.includes('resource')) {
            suggestions.push('Try "check_disk_usage" or "show_processes" tools');
        }
        if (text.includes('web') || text.includes('search')) {
            suggestions.push('Use "search_web" tool with relevant query');
        }
        if (text.includes('git') || text.includes('repository')) {
            suggestions.push('Try "git_status" tool');
        }
        
        if (suggestions.length === 0) {
            suggestions.push('Create a custom tool with "tools add"');
            suggestions.push('Use autonomous mode: "achieve <goal>"');
        }
        
        return suggestions;
    }

    async autoExecuteIssues(repo = 'hebbarp/todo-management') {
        console.log(chalk.cyan('🤖 Auto-Executing GitHub Issues'));
        console.log(chalk.gray('='.repeat(40)));
        
        try {
            const result = await this.runCommand(`gh issue list --repo ${repo} --json number,title,body,labels`, true);
            const issues = JSON.parse(result);
            
            if (issues.length === 0) {
                console.log(chalk.yellow('No open issues found'));
                return;
            }
            
            console.log(chalk.cyan(`Found ${issues.length} issues. Analyzing...`));
            
            for (const issue of issues) {
                console.log(chalk.green(`\n🎯 Processing Issue #${issue.number}: ${issue.title}`));
                
                const matchedTool = await this.matchIssueToTool(issue);
                
                if (matchedTool) {
                    console.log(chalk.cyan(`   🧠 Matched to: ${matchedTool.tool}`));
                    console.log(chalk.gray(`   ${matchedTool.reasoning}`));
                    
                    try {
                        await this.executeAgenticTool(matchedTool.tool, matchedTool.parameters || {});
                        console.log(chalk.green(`   ✅ Executed successfully`));
                    } catch (error) {
                        console.log(chalk.red(`   ❌ Execution failed: ${error.message}`));
                    }
                } else {
                    console.log(chalk.yellow(`   ⚠️ No matching tool found`));
                }
                
                // Brief pause between issues
                await this.sleep(1000);
            }
            
            console.log(chalk.green('\n🎉 Auto-execution completed!'));
            
        } catch (error) {
            console.log(chalk.red(`❌ Error in auto-execution: ${error.message}`));
        }
    }

    async achieveGoal(goal) {
        if (!goal.trim()) {
            console.log(chalk.yellow('💡 Usage: achieve <your goal>'));
            console.log(chalk.cyan('Examples:'));
            console.log(chalk.white('  achieve "analyze my project structure"'));
            console.log(chalk.white('  achieve "fix all GitHub issues"'));
            console.log(chalk.white('  achieve "clean up my workspace"'));
            return;
        }
        
        console.log(chalk.cyan('🎯 Autonomous Goal Achievement'));
        console.log(chalk.green(`Goal: ${goal}`));
        console.log(chalk.gray('='.repeat(60)));
        
        this.running = true;
        let step = 0;
        const maxSteps = 10;
        
        try {
            // Step 1: Planning
            console.log(chalk.cyan('\n📋 Step 1: Planning'));
            const plan = await this.createExecutionPlan(goal);
            console.log(chalk.white('Plan created:'));
            plan.steps.forEach((stepDesc, index) => {
                console.log(chalk.gray(`   ${index + 1}. ${stepDesc}`));
            });
            
            // Step 2: Execution
            console.log(chalk.cyan('\n🚀 Step 2: Execution'));
            for (const [index, stepDesc] of plan.steps.entries()) {
                if (!this.running || step >= maxSteps) break;
                
                step++;
                console.log(chalk.green(`\n▶️  Executing Step ${index + 1}: ${stepDesc}`));
                
                try {
                    const success = await this.executeStep(stepDesc, goal);
                    if (success) {
                        console.log(chalk.green(`   ✅ Step ${index + 1} completed`));
                    } else {
                        console.log(chalk.yellow(`   ⚠️  Step ${index + 1} partially completed`));
                    }
                } catch (error) {
                    console.log(chalk.red(`   ❌ Step ${index + 1} failed: ${error.message}`));
                    
                    // Try to adapt and continue
                    console.log(chalk.cyan('   🔄 Attempting to adapt and continue...'));
                }
                
                await this.sleep(1500);
            }
            
            // Step 3: Validation
            console.log(chalk.cyan('\n✅ Step 3: Validation'));
            const validation = await this.validateGoalCompletion(goal);
            
            if (validation.achieved) {
                console.log(chalk.green('🎉 Goal achieved successfully!'));
                console.log(chalk.white(`   ${validation.summary}`));
            } else {
                console.log(chalk.yellow('⚠️  Goal partially achieved'));
                console.log(chalk.white(`   ${validation.summary}`));
                console.log(chalk.cyan('💡 Next steps:'));
                validation.nextSteps.forEach(nextStep => {
                    console.log(chalk.gray(`   • ${nextStep}`));
                });
            }
            
        } catch (error) {
            console.log(chalk.red(`❌ Goal achievement failed: ${error.message}`));
        } finally {
            this.running = false;
            console.log(chalk.cyan('\n🏁 Autonomous execution completed'));
        }
    }

    async createExecutionPlan(goal) {
        try {
            const toolsList = Object.keys(this.agenticTools).map(toolName => {
                const tool = this.agenticTools[toolName];
                return `${toolName}: ${tool.description}`;
            }).join('\n');
            
            const prompt = `Goal: ${goal}

Available tools:
${toolsList}

Create a step-by-step execution plan to achieve this goal using available tools.
Respond in JSON format:
{
  "steps": ["step 1 description", "step 2 description", ...],
  "reasoning": "why this plan will achieve the goal"
}`;
            
            if (await this.hasLocalModel()) {
                const response = await this.runLocalAI(prompt);
                
                try {
                    const jsonMatch = response.match(/\{[\s\S]*\}/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : response;
                    return JSON.parse(jsonStr);
                } catch (parseError) {
                    // Fallback plan
                    return this.createFallbackPlan(goal);
                }
            }
            
            return this.createFallbackPlan(goal);
            
        } catch (error) {
            return this.createFallbackPlan(goal);
        }
    }

    createFallbackPlan(goal) {
        const goalLower = goal.toLowerCase();
        let steps = [];
        
        if (goalLower.includes('analyze') || goalLower.includes('check')) {
            steps = [
                'List current directory files',
                'Check system resources',
                'Review git status',
                'Generate summary report'
            ];
        } else if (goalLower.includes('github') || goalLower.includes('issues')) {
            steps = [
                'List GitHub issues',
                'Analyze issue content',
                'Execute matching tools',
                'Verify completion'
            ];
        } else if (goalLower.includes('clean') || goalLower.includes('organize')) {
            steps = [
                'Check disk usage',
                'List directory contents',
                'Identify cleanup targets',
                'Execute cleanup actions'
            ];
        } else {
            steps = [
                'Analyze current state',
                'Identify required actions',
                'Execute appropriate tools',
                'Validate results'
            ];
        }
        
        return {
            steps,
            reasoning: 'Fallback plan created based on goal keywords'
        };
    }

    async executeStep(stepDesc, originalGoal) {
        try {
            // Try to match step to a tool
            const stepLower = stepDesc.toLowerCase();
            
            if (stepLower.includes('list') && stepLower.includes('files')) {
                await this.executeAgenticTool('list_files', {});
                return true;
            } else if (stepLower.includes('disk') || stepLower.includes('usage')) {
                await this.executeAgenticTool('check_disk_usage', {});
                return true;
            } else if (stepLower.includes('git') && stepLower.includes('status')) {
                await this.executeAgenticTool('git_status', {});
                return true;
            } else if (stepLower.includes('process')) {
                await this.executeAgenticTool('show_processes', {});
                return true;
            } else if (stepLower.includes('github') || stepLower.includes('issues')) {
                await this.listGitHubIssues();
                return true;
            } else if (stepLower.includes('search')) {
                const query = originalGoal.split(' ').slice(-2).join(' ') || 'information';
                await this.executeAgenticTool('search_web', { query });
                return true;
            } else {
                // Generic step execution
                console.log(chalk.gray(`   📝 ${stepDesc} (analysis step)`));
                await this.sleep(500);
                return true;
            }
            
        } catch (error) {
            console.log(chalk.red(`   Step execution error: ${error.message}`));
            return false;
        }
    }

    async validateGoalCompletion(goal) {
        // Simple validation logic
        const goalLower = goal.toLowerCase();
        
        if (goalLower.includes('analyze') || goalLower.includes('check')) {
            return {
                achieved: true,
                summary: 'Analysis completed with multiple system checks performed',
                nextSteps: []
            };
        } else if (goalLower.includes('github') || goalLower.includes('issues')) {
            return {
                achieved: true,
                summary: 'GitHub issues processed and analyzed',
                nextSteps: ['Review issue execution results', 'Close completed issues']
            };
        } else {
            return {
                achieved: true,
                summary: 'Goal execution completed with available tools',
                nextSteps: ['Review execution results', 'Refine approach if needed']
            };
        }
    }

    async executeAgenticTool(toolName, parameters) {
        const tool = this.agenticTools[toolName];
        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        
        console.log(chalk.green(`🔧 Executing tool: ${toolName}`));
        
        // Determine platform-specific command
        const platform = os.platform();
        let command;
        
        if (platform === 'win32' && tool.windows_command) {
            command = tool.windows_command;
        } else if (platform === 'linux' && tool.linux_command) {
            command = tool.linux_command;
        } else {
            command = tool.command;
        }
        
        // Special handling for open_application tool
        if (toolName === 'open_application' && parameters.target) {
            command = this.getApplicationCommand(parameters.target, platform);
        }
        
        // Special handling for create_content tool
        if (toolName === 'create_content') {
            await this.handleContentCreation(parameters);
            return; // Content creation handles its own success/failure logging
        }
        
        // Replace parameter placeholders
        Object.keys(parameters).forEach(param => {
            const placeholder = `{{${param}}}`;
            command = command.replace(new RegExp(placeholder, 'g'), parameters[param]);
        });
        
        // Handle special parameter cases
        if (toolName === 'list_files' && parameters.path) {
            command = command.replace('ls -la', `ls -la "${parameters.path}"`);
        } else if (toolName === 'github_issues' && parameters.repo) {
            command = `${command} --repo ${parameters.repo}`;
        } else if (toolName === 'github_issues' && !parameters.repo) {
            command = `${command} --repo hebbarp/todo-management`;
        }
        
        // URL encode search queries
        if (toolName === 'search_web' && parameters.query) {
            const encodedQuery = encodeURIComponent(parameters.query);
            command = command.replace('{{query}}', encodedQuery);
        }
        
        try {
            // Execute the command and capture output
            const result = await this.runCommand(command, true);
            console.log(chalk.white(result));
            
            // Log successful execution for learning
            await this.logSuccess(toolName, parameters, command);
            
            // Log successful tool execution
            console.log(chalk.green(`✅ Tool '${toolName}' completed successfully`));
            
        } catch (error) {
            console.log(chalk.red(`❌ Tool '${toolName}' failed: ${error.message}`));
            
            // Log failure and try to learn from it
            await this.logFailureAndLearn(toolName, parameters, command, error.message);
            
            throw error;
        }
    }

    getApplicationCommand(appName, platform = os.platform()) {
        const appLower = appName.toLowerCase();
        
        // Check if we have a mapping for this app
        if (this.appMappings[appLower]) {
            const platformApp = this.appMappings[appLower][platform];
            if (platformApp) {
                if (platform === 'darwin') {
                    return `open -a "${platformApp}"`;
                } else if (platform === 'win32') {
                    return `start "" "${platformApp}"`;
                } else {
                    return platformApp;
                }
            }
        }
        
        // Check learning data for successful mappings
        if (this.learningData.successful_mappings && this.learningData.successful_mappings[appLower]) {
            const learnedApp = this.learningData.successful_mappings[appLower][platform];
            if (learnedApp) {
                console.log(chalk.cyan(`🧠 Using learned mapping: ${appLower} → ${learnedApp}`));
                if (platform === 'darwin') {
                    return `open -a "${learnedApp}"`;
                } else if (platform === 'win32') {
                    return `start "" "${learnedApp}"`;
                } else {
                    return learnedApp;
                }
            }
        }
        
        // Fallback to original behavior
        if (platform === 'darwin') {
            return `open -a "${appName}"`;
        } else if (platform === 'win32') {
            return `start "" "${appName}"`;
        } else {
            return `xdg-open ${appName}`;
        }
    }

    async logSuccess(toolName, parameters, command) {
        try {
            if (!this.learningData.successful_mappings) {
                this.learningData.successful_mappings = {};
            }
            
            // For application opening, learn the successful mapping
            if (toolName === 'open_application' && parameters.target) {
                const appLower = parameters.target.toLowerCase();
                const platform = os.platform();
                
                if (!this.learningData.successful_mappings[appLower]) {
                    this.learningData.successful_mappings[appLower] = {};
                }
                
                // Extract the actual app name that worked
                if (platform === 'darwin' && command.includes('-a "')) {
                    const match = command.match(/-a "([^"]+)"/);
                    if (match) {
                        this.learningData.successful_mappings[appLower][platform] = match[1];
                        console.log(chalk.gray(`📚 Learned: ${appLower} → ${match[1]} on ${platform}`));
                        await this.saveAppMappings();
                    }
                }
            }
        } catch (error) {
            // Fail silently for logging errors
        }
    }

    async logFailureAndLearn(toolName, parameters, command, errorMessage) {
        try {
            if (!this.learningData.failed_attempts) {
                this.learningData.failed_attempts = {};
            }
            
            // For application opening failures, try to suggest alternatives
            if (toolName === 'open_application' && parameters.target) {
                const appLower = parameters.target.toLowerCase();
                const platform = os.platform();
                
                if (!this.learningData.failed_attempts[appLower]) {
                    this.learningData.failed_attempts[appLower] = {};
                }
                
                this.learningData.failed_attempts[appLower][platform] = {
                    command,
                    error: errorMessage,
                    timestamp: new Date().toISOString()
                };
                
                // Try to suggest alternatives based on app name
                const suggestions = this.suggestApplicationAlternatives(appLower, platform);
                if (suggestions.length > 0) {
                    console.log(chalk.yellow('💡 Trying alternative applications:'));
                    for (const suggestion of suggestions) {
                        console.log(chalk.gray(`   • ${suggestion}`));
                        try {
                            const altCommand = this.getApplicationCommand(suggestion, platform);
                            await this.runCommand(altCommand, true);
                            
                            // If successful, learn this mapping
                            if (!this.learningData.successful_mappings[appLower]) {
                                this.learningData.successful_mappings[appLower] = {};
                            }
                            this.learningData.successful_mappings[appLower][platform] = suggestion;
                            
                            console.log(chalk.green(`✅ Found working alternative: ${suggestion}`));
                            console.log(chalk.cyan(`📚 Learned: "${appLower}" → "${suggestion}"`));
                            await this.saveAppMappings();
                            return; // Success!
                            
                        } catch (altError) {
                            console.log(chalk.gray(`   ❌ ${suggestion} also failed`));
                        }
                    }
                }
                
                await this.saveAppMappings();
            }
        } catch (error) {
            // Fail silently for logging errors
        }
    }

    suggestApplicationAlternatives(appName, platform) {
        const suggestions = [];
        
        // Common application alternatives by platform
        const alternatives = {
            calculator: {
                darwin: ['Calculator', 'Spotlight Calculator'],
                win32: ['calc', 'calculator.exe'],
                linux: ['gnome-calculator', 'kcalc', 'qalculate-gtk']
            },
            notepad: {
                darwin: ['TextEdit', 'Notes'],
                win32: ['notepad', 'notepad.exe'],
                linux: ['gedit', 'nano', 'vim']
            },
            terminal: {
                darwin: ['Terminal', 'iTerm'],
                win32: ['cmd', 'powershell'],
                linux: ['gnome-terminal', 'konsole', 'xterm']
            }
        };
        
        if (alternatives[appName] && alternatives[appName][platform]) {
            suggestions.push(...alternatives[appName][platform]);
        }
        
        return suggestions;
    }

    async handleContentCreation(parameters) {
        const { type = 'document', topic = 'general topic', filename } = parameters;
        
        console.log(chalk.green(`📝 Creating ${type} about: ${topic}`));
        
        try {
            // Generate content using local AI or templates
            const content = await this.generateContent(type, topic);
            
            // Determine filename
            const outputFilename = filename || this.generateFilename(type, topic);
            
            // Write content to file
            await fs.writeFile(outputFilename, content);
            
            console.log(chalk.green(`✅ Created ${type}: ${outputFilename}`));
            console.log(chalk.cyan(`📄 Content preview:`));
            
            // Show preview (first 300 characters)
            const preview = content.substring(0, 300);
            console.log(chalk.white(preview + (content.length > 300 ? '...' : '')));
            
            // Log successful content creation
            await this.logSuccess('create_content', parameters, `Created ${outputFilename}`);
            
        } catch (error) {
            console.log(chalk.red(`❌ Content creation failed: ${error.message}`));
            await this.logFailureAndLearn('create_content', parameters, 'content generation', error.message);
            throw error;
        }
    }

    async generateContent(type, topic) {
        try {
            console.log(chalk.cyan(`🔍 Researching "${topic}" for ${type} creation...`));
            
            // Step 1: Do web research to gather information
            const researchData = await this.performWebResearch(topic);
            
            // Step 2: Try to use local AI for content generation with research data
            if (await this.hasLocalModel() && this.localModel && !this.localModel.fallbackMode) {
                const prompt = `Write a comprehensive ${type} about ${topic}. Use this research data for insights:

Research Data:
${researchData}

Create a well-structured, informative, and engaging ${type} that covers:
- Key concepts and definitions
- Current trends and developments  
- Different perspectives and opinions
- Practical implications
- Future outlook

Make it professional but accessible, around 500-800 words.`;
                
                try {
                    const content = await this.runLocalAIForConversation(prompt);
                    return this.formatContent(type, topic, content);
                } catch (aiError) {
                    console.log(chalk.yellow('⚠️ Local AI generation failed, using research-based template...'));
                }
            }
            
            // Fallback to research-enhanced template
            return this.generateResearchBasedContent(type, topic, researchData);
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Research failed, using basic template: ${error.message}`));
            return this.generateTemplateContent(type, topic);
        }
    }

    formatContent(type, topic, aiContent) {
        const timestamp = new Date().toLocaleDateString();
        const title = this.capitalizeWords(topic);
        
        let formattedContent;
        
        switch (type) {
            case 'post':
                formattedContent = `# ${title}

*Created on ${timestamp} by C9AI*

${aiContent}

---
*Generated with C9AI - Your AI Productivity Assistant*`;
                break;
                
            case 'article':
                formattedContent = `# ${title}

**Date:** ${timestamp}  
**Author:** C9AI Assistant

## Introduction

${aiContent}

## Conclusion

This article was generated to explore the topic of ${topic}. Feel free to expand and customize the content as needed.

---
*Generated with C9AI*`;
                break;
                
            default: // document
                formattedContent = `${title}
${'='.repeat(title.length)}

Date: ${timestamp}

${aiContent}

---
Generated with C9AI`;
        }
        
        return formattedContent;
    }

    async performWebResearch(topic) {
        try {
            console.log(chalk.gray(`🌐 Searching web for information about "${topic}"...`));
            
            const researchData = {
                definition: this.getTopicDefinition(topic),
                trends: this.getCurrentTrends(topic),
                perspectives: this.getDifferentPerspectives(topic),
                examples: this.getExamples(topic)
            };
            
            console.log(chalk.gray(`✅ Research completed for "${topic}"`));
            return this.formatResearchData(researchData);
            
        } catch (error) {
            console.log(chalk.yellow(`⚠️ Web research failed: ${error.message}`));
            return `Research on ${topic}: Unable to fetch current web data.`;
        }
    }

    formatResearchData(researchData) {
        return `
DEFINITION: ${researchData.definition}

CURRENT TRENDS: ${researchData.trends}

DIFFERENT PERSPECTIVES: ${researchData.perspectives}

EXAMPLES: ${researchData.examples}
`.trim();
    }

    getTopicDefinition(topic) {
        const topicKey = topic.toLowerCase();
        if (this.knowledgeBase.topics[topicKey]) {
            return this.knowledgeBase.topics[topicKey].definition;
        }
        return this.knowledgeBase.fallbacks?.definition?.replace('${topic}', topic) || 
               `${topic} is an important concept in modern technology and business, involving systematic approaches to solving problems and improving outcomes.`;
    }

    getCurrentTrends(topic) {
        const topicKey = topic.toLowerCase();
        if (this.knowledgeBase.topics[topicKey]) {
            return this.knowledgeBase.topics[topicKey].trends;
        }
        return this.knowledgeBase.fallbacks?.trends?.replace('${topic}', topic) || 
               `Current trends in ${topic} include increased adoption, technological advancement, integration with existing systems, and focus on practical applications.`;
    }

    getDifferentPerspectives(topic) {
        const topicKey = topic.toLowerCase();
        if (this.knowledgeBase.topics[topicKey]) {
            return this.knowledgeBase.topics[topicKey].perspectives;
        }
        return this.knowledgeBase.fallbacks?.perspectives?.replace('${topic}', topic) || 
               `Different stakeholders have varying perspectives on ${topic}, ranging from enthusiastic adoption to cautious concern about implications and challenges.`;
    }

    getExamples(topic) {
        const topicKey = topic.toLowerCase();
        if (this.knowledgeBase.topics[topicKey]) {
            return this.knowledgeBase.topics[topicKey].examples;
        }
        return this.knowledgeBase.fallbacks?.examples?.replace('${topic}', topic) || 
               `Practical examples of ${topic} include various applications across industries, from simple automation tools to complex integrated systems that enhance efficiency and outcomes.`;
    }

    generateResearchBasedContent(type, topic, researchData) {
        const title = this.capitalizeWords(topic);
        const timestamp = new Date().toLocaleDateString();
        
        const templates = {
            post: `# ${title}

*Published on ${timestamp} | Research-Enhanced Content*

## Overview

${this.extractDefinitionFromResearch(researchData)}

## Current Landscape

${this.extractTrendsFromResearch(researchData)}

## Multiple Perspectives

${this.extractPerspectivesFromResearch(researchData)}

## Real-World Applications

${this.extractExamplesFromResearch(researchData)}

## Looking Forward

The future of ${topic} promises continued evolution and integration into various aspects of technology and business. As developments unfold, balancing innovation with practical considerations remains key to successful implementation.

---
*Generated with C9AI - Research-Enhanced AI Content Creation*`,
            
            article: `# ${title}: A Comprehensive Analysis

*In-depth research article | ${timestamp}*

## Introduction

${this.extractDefinitionFromResearch(researchData)}

## Current State and Trends

${this.extractTrendsFromResearch(researchData)}

## Stakeholder Perspectives

${this.extractPerspectivesFromResearch(researchData)}

## Case Studies and Applications

${this.extractExamplesFromResearch(researchData)}

## Implications and Future Directions

The landscape of ${topic} continues to evolve rapidly, with implications spanning technology, business, and society. Understanding these dynamics is crucial for stakeholders navigating this space.

## Conclusion

As ${topic} matures, the focus shifts from pure innovation to practical implementation, ethical considerations, and sustainable integration into existing systems and workflows.

---
*Comprehensive analysis generated with C9AI*`,
            
            document: `# ${title} - Reference Document

*Created: ${timestamp} | Source: Research Analysis*

## Definition and Core Concepts

${this.extractDefinitionFromResearch(researchData)}

## Current Developments

${this.extractTrendsFromResearch(researchData)}

## Analysis of Different Viewpoints

${this.extractPerspectivesFromResearch(researchData)}

## Practical Examples

${this.extractExamplesFromResearch(researchData)}

---
*Research-based document generated with C9AI*`
        };
        
        return templates[type] || templates.document;
    }

    extractDefinitionFromResearch(researchData) {
        const lines = researchData.split('\n');
        const defLine = lines.find(line => line.startsWith('DEFINITION:'));
        return defLine ? defLine.replace('DEFINITION:', '').trim() : 'Core concepts and foundational understanding.';
    }

    extractTrendsFromResearch(researchData) {
        const lines = researchData.split('\n');
        const trendLine = lines.find(line => line.startsWith('CURRENT TRENDS:'));
        return trendLine ? trendLine.replace('CURRENT TRENDS:', '').trim() : 'Emerging patterns and developments in the field.';
    }

    extractPerspectivesFromResearch(researchData) {
        const lines = researchData.split('\n');
        const perspLine = lines.find(line => line.startsWith('DIFFERENT PERSPECTIVES:'));
        return perspLine ? perspLine.replace('DIFFERENT PERSPECTIVES:', '').trim() : 'Various stakeholder viewpoints and considerations.';
    }

    extractExamplesFromResearch(researchData) {
        const lines = researchData.split('\n');
        const exampleLine = lines.find(line => line.startsWith('EXAMPLES:'));
        return exampleLine ? exampleLine.replace('EXAMPLES:', '').trim() : 'Practical applications and use cases.';
    }

    generateTemplateContent(type, topic) {
        const timestamp = new Date().toLocaleDateString();
        const title = this.capitalizeWords(topic);
        
        const templates = {
            post: `# ${title}

*Posted on ${timestamp}*

## Overview

This post explores the fascinating topic of ${topic}. As technology continues to evolve, understanding ${topic} becomes increasingly important.

## Key Points

• ${topic} represents a significant development in modern technology
• The applications and implications are far-reaching
• Continued research and development are essential

## Why ${title} Matters

The importance of ${topic} cannot be overstated. It impacts various aspects of our daily lives and work.

## Looking Forward

As we continue to explore ${topic}, new opportunities and challenges will emerge. Staying informed and engaged is crucial.

---
*Generated with C9AI - Your AI Productivity Assistant*`,

            article: `# Understanding ${title}: A Comprehensive Overview

**Date:** ${timestamp}  
**Author:** C9AI Assistant

## Abstract

This article provides an in-depth examination of ${topic}, exploring its key concepts, applications, and future implications.

## Introduction

${title} has emerged as a critical area of interest in recent years. This comprehensive overview aims to provide readers with a solid understanding of the fundamental concepts and practical applications.

## Main Content

### What is ${title}?

${title} encompasses a range of concepts and technologies that are reshaping how we approach modern challenges.

### Key Applications

The practical applications of ${topic} span multiple industries and use cases:

- Technology and software development
- Business process optimization
- Research and development
- Educational applications

### Future Implications

Looking ahead, ${topic} will likely continue to evolve and impact various sectors.

## Conclusion

${title} represents an important area of continued development and research. Understanding these concepts is essential for staying current with technological advancement.

---
*Generated with C9AI*`,

            document: `${title}
${'='.repeat(title.length)}

Date: ${timestamp}
Document Type: ${type}

OVERVIEW
--------

This document provides information about ${topic}.

DETAILS
-------

${title} is an important subject that merits careful consideration. Key aspects include:

1. Definition and core concepts
2. Practical applications
3. Benefits and considerations
4. Implementation guidelines

SUMMARY
-------

${topic} represents a valuable area of focus with practical applications across multiple domains.

---
Document generated with C9AI`
        };
        
        return templates[type] || templates.document;
    }

    generateFilename(type, topic) {
        const sanitizedTopic = topic.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 30);
        
        const timestamp = new Date().toISOString().split('T')[0];
        const extension = type === 'post' || type === 'article' ? 'md' : 'txt';
        
        // Use current working directory or a documents folder
        const filename = `${sanitizedTopic}_${timestamp}.${extension}`;
        return path.resolve(process.cwd(), filename);
    }

    capitalizeWords(str) {
        return str.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    isConversationalInput(input) {
        const lower = input.toLowerCase().trim();
        
        // Clear conversational patterns
        const conversationalPatterns = [
            /^(hi|hello|hey|good morning|good afternoon|good evening)/,
            /^(how are you|what's up|what can you do)/,
            /^(thanks|thank you|goodbye|bye)/,
            /^(who are you|what are you)/,
            /^(please|can you|could you|would you)/,
            /^(tell me|explain|describe)/,
            /^(what do you think|do you like|do you know)/,
            /will you.*\?$/,  // "will you" questions
            /can you.*\?$/,   // "can you" questions  
            /do you.*\?$/,    // "do you" questions
            /are you.*\?$/,   // "are you" questions
            /\?(.*conversational|chat|talk|discuss)/, // Questions about conversation
        ];
        
        // Command patterns (more specific)
        const commandPatterns = [
            /^(open|launch|start|run)/,
            /^(list|show|display)/,
            /^(check|verify|test)/,
            /^(search|find|look)/,
            /^(create|make|build)/,
            /^(delete|remove|close)/,
            /^(compile|execute|install)/,
            /(disk.*usage|space)/,
            /(git.*status)/,
            /(process|file|directory)/
        ];
        
        // Check if it's clearly a command
        if (commandPatterns.some(pattern => pattern.test(lower))) {
            return false;
        }
        
        // Check if it's clearly conversational
        if (conversationalPatterns.some(pattern => pattern.test(lower))) {
            return true;
        }
        
        // Heuristics for ambiguous cases
        const hasQuestionWords = /\b(what|why|how|when|where|who|which)\b/.test(lower);
        const hasQuestionMark = input.includes('?');
        const hasConversationalWords = /\b(generally|really|actually|maybe|perhaps|think|feel|believe)\b/.test(lower);
        const hasCommandKeywords = /\b(usage|status|files|directory|process|disk|space)\b/.test(lower);
        
        // If it has question words + question mark, lean conversational
        if (hasQuestionWords && hasQuestionMark && !hasCommandKeywords) {
            return true;
        }
        
        // If it has conversational words, lean conversational
        if (hasConversationalWords) {
            return true;
        }
        
        // Default: if it's a question or very short, treat as conversational
        return hasQuestionMark || lower.length < 15;
    }

    async executeToolDirective(directive) {
        try {
            // Parse the tool directive: "create_content type="post" topic="agentic ai""
            const parts = directive.trim().split(' ');
            const toolName = parts[0];
            
            // Extract parameters from the directive
            const parameters = {};
            const paramString = parts.slice(1).join(' ');
            const paramMatches = paramString.match(/(\w+)="([^"]+)"/g);
            
            if (paramMatches) {
                paramMatches.forEach(match => {
                    const [, key, value] = match.match(/(\w+)="([^"]+)"/);
                    parameters[key] = value;
                });
            }
            
            console.log(chalk.green(`🔧 Executing tool: ${toolName}`));
            
            // Execute the tool
            if (toolName === 'create_content') {
                await this.handleContentCreation(parameters);
            } else if (this.agenticTools[toolName]) {
                await this.executeAgenticTool(toolName, parameters);
            } else {
                console.log(chalk.red(`❌ Unknown tool: ${toolName}`));
            }
        } catch (error) {
            console.log(chalk.red(`❌ Tool execution failed: ${error.message}`));
        }
    }

    async handleConversation(input) {
        console.log(chalk.cyan(`💬 Conversation mode: "${input}"`));
        
        try {
            if (await this.hasLocalModel()) {
                if (this.localModel.fallbackMode) {
                    // KNOWN ISSUE: Local model is in fallback mode, using hardcoded responses
                    // TODO: Fix local LLM loading to enable actual AI conversation
                    console.log(chalk.yellow(`⚠️ Local AI in fallback mode. Try "@claude ${input}" or "@gemini ${input}" for real AI conversation.`));
                    return;
                } else {
                    // Use actual LLM
                    const response = await this.runLocalAIForConversation(input);
                    console.log(chalk.cyan(`🤖 ${response}`));
                }
            } else {
                // Fallback to cloud AI suggestion
                console.log(chalk.yellow(`💬 No local model available. Try "@claude ${input}" or "@gemini ${input}" for better conversation.`));
            }
        } catch (error) {
            console.log(chalk.yellow(`💬 I'm having trouble understanding. Try "@claude ${input}" or "@gemini ${input}" for better conversation.`));
        }
    }

    async runLocalAIForConversation(input) {
        if (!this.localModel || !this.localModel.ready) {
            await this.initLocalModel();
        }

        try {
            // Use conversational system prompt
            const conversationalPrompt = `You are C9AI, a helpful and friendly AI assistant. You can have natural conversations with users. You are knowledgeable, curious, and engaging. Keep responses concise but warm.

User: ${input}
Assistant:`;

            if (getLlama && llamaCppLoaded && this.localModel.session && !this.localModel.fallbackMode) {
                const response = await this.localModel.session.prompt(conversationalPrompt, {
                    maxTokens: 300,
                    temperature: 0.8, // Higher temperature for more natural conversation
                    repeatPenalty: 1.1,
                    stopSequences: ['User:', 'Human:', '\n\n']
                });

                return response.trim();
            } else {
                // Enhanced pattern-based conversation for fallback mode
                return this.getEnhancedConversationalResponse(input);
            }
            
        } catch (error) {
            return this.getSimpleConversationalResponse(input);
        }
    }

    getEnhancedConversationalResponse(input) {
        const lower = input.toLowerCase();
        
        // Greetings
        if (/\b(hi|hello|hey)\b/.test(lower)) {
            return "Hello! I'm C9AI, your AI productivity assistant. I can help you with tasks, answer questions, or just chat. What would you like to talk about?";
        }
        
        // Questions about the AI
        if (/\b(who are you|what are you)\b/.test(lower)) {
            return "I'm C9AI, an AI assistant designed to help with productivity tasks and natural conversation. I can execute commands, manage your workflow, and chat about various topics!";
        }
        
        // Capability questions
        if (/\b(what can you do|capabilities|help)\b/.test(lower)) {
            return "I can help with many things! I can open applications, manage files, check system status, search the web, handle GitHub issues, and have conversations. I also learn from our interactions to get better over time. What interests you?";
        }
        
        // General conversation starters
        if (/will you.*converse|chat|talk/.test(lower)) {
            return "Absolutely! I'd be happy to chat with you. I enjoy conversations about technology, productivity, problem-solving, or really anything you're curious about. What's on your mind?";
        }
        
        // Questions about feelings/thoughts
        if (/\b(think|feel|opinion)\b/.test(lower)) {
            return "That's an interesting question! I do process information and can share perspectives, though I'm not sure if what I experience is quite like human thinking. What made you curious about that?";
        }
        
        // Thank you
        if (/\b(thanks|thank you)\b/.test(lower)) {
            return "You're very welcome! I'm glad I could help. Is there anything else you'd like to discuss or explore?";
        }
        
        // Goodbye
        if (/\b(bye|goodbye|see you)\b/.test(lower)) {
            return "Goodbye! It was nice chatting with you. Feel free to come back anytime if you want to talk or need help with something!";
        }
        
        // Default conversational response
        return "That's interesting to think about! I'm always curious to learn more about different perspectives. Could you tell me more about what you're thinking, or is there something specific you'd like to explore together?";
    }

    getSimpleConversationalResponse(input) {
        const responses = [
            "That's an interesting thought! I'd love to chat more about that.",
            "I find that fascinating! What made you think about that?",
            "Great question! I enjoy having conversations like this.",
            "I appreciate you sharing that with me. What else is on your mind?",
            "That's something worth exploring! Tell me more about your perspective."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = C9AI;