"use strict";
/**
 * Google Drive Todo Fetcher - Fetches todos from Google Drive documents and executes them locally
 */

const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

class GDriveFetcher {
  constructor() {
    this.todoFile = path.join(process.cwd(), 'gdrive-todos.json');
    this.cacheDir = path.join(process.cwd(), '.gdrive-cache');
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Fetch documents from Google Drive (requires rclone or gdrive CLI)
   */
  async fetchDocuments(query = 'todo', format = 'txt') {
    try {
      // Try rclone first (more reliable for automation)
      const rcloneResult = await this.fetchWithRclone(query, format);
      if (rcloneResult.success) {
        return rcloneResult;
      }

      // Fallback to direct Google Drive API simulation
      return await this.fetchWithSimulation(query);
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch from Google Drive: ${error.message}`,
        suggestion: "Install rclone and configure Google Drive: 'rclone config'"
      };
    }
  }

  /**
   * Fetch using rclone (recommended)
   */
  async fetchWithRclone(query, format) {
    try {
      // Check if rclone is configured with a Google Drive remote
      const { stdout: remotes } = await execAsync('rclone listremotes', { timeout: 5000 });
      
      const driveRemotes = remotes.split('\n').filter(line => 
        line.includes('gdrive') || line.includes('drive') || line.includes('google')
      );

      if (driveRemotes.length === 0) {
        throw new Error('No Google Drive remote found in rclone config');
      }

      const remoteName = driveRemotes[0].replace(':', '');
      
      // List files matching query
      const { stdout: files } = await execAsync(
        `rclone lsf "${remoteName}:" --include "*${query}*" --include "*.${format}" --include "*.md" --include "*.txt"`,
        { timeout: 30000 }
      );

      if (!files.trim()) {
        return {
          success: true,
          source: 'rclone',
          files_found: 0,
          todos: [],
          message: `No files matching '${query}' found in Google Drive`
        };
      }

      // Download matching files to cache
      const fileList = files.trim().split('\n').filter(f => f.trim());
      const downloadedFiles = [];

      for (const filename of fileList.slice(0, 5)) { // Limit to first 5 files
        try {
          const localPath = path.join(this.cacheDir, filename);
          await execAsync(`rclone copy "${remoteName}:${filename}" "${this.cacheDir}"`, { timeout: 30000 });
          
          if (fs.existsSync(localPath)) {
            const content = fs.readFileSync(localPath, 'utf8');
            downloadedFiles.push({
              filename,
              localPath,
              content,
              size: content.length
            });
          }
        } catch (error) {
          console.warn(`Failed to download ${filename}: ${error.message}`);
        }
      }

      return this.processDocuments(downloadedFiles, 'rclone');
    } catch (error) {
      return {
        success: false,
        error: `Rclone failed: ${error.message}`
      };
    }
  }

  /**
   * Simulate Google Drive fetch with local examples
   */
  async fetchWithSimulation(query) {
    // Create sample documents for demonstration
    const sampleDocs = [
      {
        filename: 'Project_Todos.md',
        localPath: path.join(this.cacheDir, 'Project_Todos.md'),
        content: `# Project Todos

## High Priority Tasks
- [ ] Update README documentation
- [ ] Fix authentication bug in login system  
- [ ] @calc 125 * 0.15 (calculate tax)
- [ ] Deploy to production server

## Code Tasks
\`\`\`bash
npm run build
npm run test
git commit -am "Update project"
\`\`\`

## Analysis Tasks  
- [ ] @analyze sales_data.csv
- [ ] @system (check system status)
- [ ] Generate monthly report

## Shell Commands
\`\`\`shell
ls -la /var/log/
df -h
ps aux | grep node
\`\`\`
`,
        size: 450
      },
      {
        filename: 'Weekly_Goals.txt', 
        localPath: path.join(this.cacheDir, 'Weekly_Goals.txt'),
        content: `Weekly Goals - C9AI Project

1. Complete JIT system implementation ✓
2. Add GitHub integration 
3. Test sigil routing system
4. @github-fetch my-org/project-repo
5. @count important_files.txt
6. Review and deploy changes

Meeting Notes:
- Discussed automation workflows
- Need to @search "rclone google drive setup"
- Schedule follow-up @email team@company.com "Weekly Update" "Progress report"
`,
        size: 380
      }
    ];

    // Save sample documents to cache
    for (const doc of sampleDocs) {
      fs.writeFileSync(doc.localPath, doc.content);
    }

    return this.processDocuments(sampleDocs, 'simulation');
  }

  /**
   * Process downloaded documents into executable todos
   */
  processDocuments(documents, source) {
    const allTodos = [];

    for (const doc of documents) {
      const todos = this.extractTodosFromContent(doc.content, doc.filename);
      allTodos.push(...todos);
    }

    const result = {
      success: true,
      source: source,
      files_processed: documents.length,
      files: documents.map(d => ({
        filename: d.filename,
        size: d.size,
        todos_found: this.extractTodosFromContent(d.content, d.filename).length
      })),
      total_todos: allTodos.length,
      executable_count: allTodos.filter(t => t.executable.length > 0).length,
      todos: allTodos
    };

    return result;
  }

  /**
   * Extract todos from document content
   */
  extractTodosFromContent(content, filename) {
    const todos = [];
    let todoId = 1;

    // Extract markdown-style checkboxes
    const todoRegex = /- \[ \]\s+(.+)/gi;
    let match;
    
    while ((match = todoRegex.exec(content)) !== null) {
      const taskText = match[1].trim();
      const todo = {
        id: `gdrive-${filename}-${todoId++}`,
        source: 'google_drive',
        filename: filename,
        title: taskText,
        type: 'checkbox',
        executable: this.extractExecutableCommands(taskText),
        created_at: new Date().toISOString()
      };
      todos.push(todo);
    }

    // Extract code blocks  
    const codeBlockRegex = /```(?:bash|shell|terminal|sh|cmd)?\n([\s\S]*?)```/gi;
    let codeBlockId = 1;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1].trim();
      if (code) {
        const todo = {
          id: `gdrive-${filename}-code-${codeBlockId++}`,
          source: 'google_drive', 
          filename: filename,
          title: `Code block: ${code.split('\n')[0].substring(0, 50)}...`,
          type: 'code_block',
          executable: [{
            type: 'shell',
            command: code,
            source: 'code_block'
          }],
          created_at: new Date().toISOString()
        };
        todos.push(todo);
      }
    }

    // Extract sigil commands
    const sigilRegex = /@(\w+)\s+([^\n\r]*)/gi;
    let sigilId = 1;
    
    while ((match = sigilRegex.exec(content)) !== null) {
      const todo = {
        id: `gdrive-${filename}-sigil-${sigilId++}`,
        source: 'google_drive',
        filename: filename, 
        title: `Sigil command: @${match[1]} ${match[2]}`,
        type: 'sigil',
        executable: [{
          type: 'sigil',
          sigil: match[1],
          args: match[2].trim(),
          source: 'sigil_command'
        }],
        created_at: new Date().toISOString()
      };
      todos.push(todo);
    }

    return todos;
  }

  /**
   * Extract executable commands from task text
   */
  extractExecutableCommands(taskText) {
    const commands = [];

    // Look for sigil commands in task text
    const sigilMatch = taskText.match(/@(\w+)\s+(.+)/);
    if (sigilMatch) {
      commands.push({
        type: 'sigil',
        sigil: sigilMatch[1],
        args: sigilMatch[2].trim(),
        source: 'task_text'
      });
    }

    // Look for shell-like commands
    if (taskText.match(/^(ls|cd|mkdir|rm|cp|mv|git|npm|node|python|docker)\s/)) {
      commands.push({
        type: 'shell',
        command: taskText,
        source: 'task_text'
      });
    }

    return commands;
  }

  /**
   * Save todos to local file
   */
  async saveTodos(todosData) {
    try {
      fs.writeFileSync(this.todoFile, JSON.stringify(todosData, null, 2));
      return {
        success: true,
        saved_to: this.todoFile,
        count: todosData.todos ? todosData.todos.length : 0
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save todos: ${error.message}`
      };
    }
  }

  /**
   * List all fetched todos
   */
  listTodos() {
    try {
      if (!fs.existsSync(this.todoFile)) {
        return {
          success: false,
          error: 'No todos file found. Run fetch first.'
        };
      }

      const todosData = JSON.parse(fs.readFileSync(this.todoFile, 'utf8'));
      
      return {
        success: true,
        total: todosData.todos.length,
        executable: todosData.todos.filter(t => t.executable.length > 0).length,
        files_processed: todosData.files_processed,
        todos: todosData.todos.map(todo => ({
          id: todo.id,
          filename: todo.filename,
          title: todo.title,
          type: todo.type,
          executable_commands: todo.executable.length,
          commands_preview: todo.executable.slice(0, 2).map(c => 
            c.command || `@${c.sigil} ${c.args || ''}`
          )
        }))
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute a specific todo by ID
   */
  async executeTodo(todoId, dryRun = true) {
    try {
      if (!fs.existsSync(this.todoFile)) {
        throw new Error('No todos file found. Run fetch first.');
      }

      const todosData = JSON.parse(fs.readFileSync(this.todoFile, 'utf8'));
      const todo = todosData.todos.find(t => t.id === todoId);
      
      if (!todo) {
        throw new Error(`Todo with ID ${todoId} not found`);
      }

      const results = [];
      
      for (const cmd of todo.executable) {
        if (dryRun) {
          results.push({
            type: cmd.type,
            command: cmd.command || `@${cmd.sigil} ${cmd.args}`,
            action: 'would_execute',
            dry_run: true
          });
        } else {
          try {
            let result;
            
            if (cmd.type === 'shell') {
              const { stdout, stderr } = await execAsync(cmd.command, { 
                timeout: 60000,
                cwd: process.cwd()
              });
              result = { stdout, stderr, success: true };
            } else if (cmd.type === 'sigil') {
              result = { message: `Sigil @${cmd.sigil} ${cmd.args} would be executed`, success: true };
            }
            
            results.push({
              type: cmd.type,
              command: cmd.command || `@${cmd.sigil} ${cmd.args}`,
              result: result,
              executed: true
            });
          } catch (error) {
            results.push({
              type: cmd.type,
              command: cmd.command || `@${cmd.sigil} ${cmd.args}`,
              error: error.message,
              executed: false
            });
          }
        }
      }

      return {
        success: true,
        todo_id: todoId,
        title: todo.title,
        filename: todo.filename,
        total_commands: todo.executable.length,
        dry_run: dryRun,
        results: results
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup cache files
   */
  cleanupCache() {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.cacheDir, file));
        });
        fs.rmdirSync(this.cacheDir);
      }
      return { success: true, message: 'Cache cleaned' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Tool interface for C9AI
async function executeGDriveFetcher(args) {
  const fetcher = new GDriveFetcher();
  const { action, query, format, todoId, dryRun } = args;

  try {
    switch (action) {
      case 'fetch':
        const docsResult = await fetcher.fetchDocuments(query, format);
        if (docsResult.success) {
          const saveResult = await fetcher.saveTodos(docsResult);
          return {
            ...docsResult,
            saved: saveResult.success,
            saved_to: saveResult.saved_to
          };
        }
        return docsResult;
        
      case 'list':
        return fetcher.listTodos();
        
      case 'execute':
        if (!todoId) {
          return { success: false, error: 'todoId is required for execute action' };
        }
        return await fetcher.executeTodo(todoId, dryRun !== false);
        
      case 'cleanup':
        return fetcher.cleanupCache();
        
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Supported: fetch, list, execute, cleanup`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `Google Drive fetcher failed: ${error.message}`
    };
  }
}

module.exports = {
  name: "gdrive-fetcher",
  description: "Fetch and execute todos from Google Drive documents",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "Action to perform: 'fetch', 'list', 'execute', 'cleanup'",
        enum: ["fetch", "list", "execute", "cleanup"]
      },
      query: {
        type: "string",
        description: "Search query for documents (default: 'todo')",
        default: "todo"
      },
      format: {
        type: "string", 
        description: "Document format to fetch (txt, md, doc)",
        default: "txt"
      },
      todoId: {
        type: "string",
        description: "Todo ID to execute (required for execute action)"
      },
      dryRun: {
        type: "boolean",
        description: "If true, shows what would be executed without running commands",
        default: true
      }
    },
    required: ["action"]
  },
  execute: executeGDriveFetcher
};