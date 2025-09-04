"use strict";
/**
 * GitHub Issues Todo Fetcher - Fetches todos from GitHub Issues and executes them locally
 */

const fs = require("node:fs");
const path = require("node:path");
const { exec } = require("node:child_process");
const { promisify } = require("node:util");

const execAsync = promisify(exec);

class GitHubFetcher {
  constructor() {
    this.todoFile = path.join(process.cwd(), 'github-todos.json');
  }

  /**
   * Fetch issues from GitHub repository
   */
  async fetchIssues(repo = 'hebbarp/todo-management', labels = '') {
    try {
      let cmd = `gh issue list --repo ${repo} --json number,title,body,labels,assignees,state`;
      
      if (labels) {
        cmd += ` --label "${labels}"`;
      }

      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      
      if (stderr && !stdout) {
        throw new Error(`GitHub CLI error: ${stderr}`);
      }

      const issues = JSON.parse(stdout.trim() || '[]');
      return this.processIssues(issues);
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch GitHub issues: ${error.message}`,
        suggestion: "Make sure 'gh' CLI is installed and authenticated: gh auth login"
      };
    }
  }

  /**
   * Process GitHub issues into executable todos
   */
  processIssues(issues) {
    const todos = issues.map(issue => {
      const todo = {
        id: `gh-${issue.number}`,
        source: 'github',
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        assignees: issue.assignees.map(a => a.login),
        executable: this.extractExecutableCommands(issue.body || ''),
        created_at: new Date().toISOString()
      };

      return todo;
    });

    return {
      success: true,
      repo: issues.length > 0 ? 'repository' : 'unknown',
      total_issues: issues.length,
      todos: todos,
      executable_count: todos.filter(t => t.executable.length > 0).length
    };
  }

  /**
   * Extract executable commands from issue body
   */
  extractExecutableCommands(body) {
    const commands = [];
    
    // Look for code blocks with shell/bash/terminal markers
    const codeBlockRegex = /```(?:bash|shell|terminal|sh|cmd)?\n([\s\S]*?)```/gi;
    let match;
    
    while ((match = codeBlockRegex.exec(body)) !== null) {
      const code = match[1].trim();
      if (code) {
        commands.push({
          type: 'shell',
          command: code,
          source: 'code_block'
        });
      }
    }

    // Look for @commands in the text
    const sigilRegex = /@(\w+)\s+([^\n\r]*)/gi;
    while ((match = sigilRegex.exec(body)) !== null) {
      commands.push({
        type: 'sigil',
        sigil: match[1],
        args: match[2].trim(),
        source: 'sigil_command'
      });
    }

    // Look for task checkboxes
    const todoRegex = /- \[ \]\s+(.+)/gi;
    while ((match = todoRegex.exec(body)) !== null) {
      commands.push({
        type: 'todo',
        task: match[1].trim(),
        source: 'checkbox'
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
            command: cmd.command || cmd.task || `@${cmd.sigil} ${cmd.args}`,
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
              // Would need to integrate with sigil router here
              result = { message: `Sigil @${cmd.sigil} ${cmd.args} would be executed`, success: true };
            } else {
              result = { message: `Todo task: ${cmd.task}`, success: true };
            }
            
            results.push({
              type: cmd.type,
              command: cmd.command || cmd.task || `@${cmd.sigil} ${cmd.args}`,
              result: result,
              executed: true
            });
          } catch (error) {
            results.push({
              type: cmd.type,
              command: cmd.command || cmd.task || `@${cmd.sigil} ${cmd.args}`,
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
        todos: todosData.todos.map(todo => ({
          id: todo.id,
          title: todo.title,
          state: todo.state,
          labels: todo.labels,
          executable_commands: todo.executable.length,
          commands_preview: todo.executable.slice(0, 2).map(c => 
            c.command || c.task || `@${c.sigil} ${c.args || ''}`
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
}

// Tool interface for C9AI
async function executeGitHubFetcher(args) {
  const fetcher = new GitHubFetcher();
  const { action, repo, labels, todoId, dryRun } = args;

  try {
    switch (action) {
      case 'fetch':
        const issuesResult = await fetcher.fetchIssues(repo, labels);
        if (issuesResult.success) {
          const saveResult = await fetcher.saveTodos(issuesResult);
          return {
            ...issuesResult,
            saved: saveResult.success,
            saved_to: saveResult.saved_to
          };
        }
        return issuesResult;
        
      case 'list':
        return fetcher.listTodos();
        
      case 'execute':
        if (!todoId) {
          return { success: false, error: 'todoId is required for execute action' };
        }
        return await fetcher.executeTodo(todoId, dryRun !== false);
        
      default:
        return {
          success: false,
          error: `Unknown action: ${action}. Supported: fetch, list, execute`
        };
    }
  } catch (error) {
    return {
      success: false,
      error: `GitHub fetcher failed: ${error.message}`
    };
  }
}

module.exports = {
  name: "github-fetcher",
  description: "Fetch and execute todos from GitHub Issues",
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "Action to perform: 'fetch', 'list', 'execute'",
        enum: ["fetch", "list", "execute"]
      },
      repo: {
        type: "string",
        description: "GitHub repository (owner/repo format)",
        default: "hebbarp/todo-management"
      },
      labels: {
        type: "string",
        description: "Filter issues by labels (comma-separated)"
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
  execute: executeGitHubFetcher
};