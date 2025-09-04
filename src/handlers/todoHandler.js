const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');

async function handleTodos(action = 'list', opts = {}) {
    console.log(chalk.cyan('📋 Todo Management System'));
    console.log(chalk.gray(`Action: ${action}`));
    
    switch (action) {
        case 'list':
            return await listAllTodos();
        case 'fetch-github':
            return await fetchGitHubTodos(opts.repo, opts.labels);
        case 'fetch-gdrive': 
            return await fetchGDriveTodos(opts.query, opts.format);
        case 'execute':
            return await executeTodo(opts.id, !opts.dryRun);
        case 'sync':
            return await syncAllTodos();
        case 'add':
            return await addLocalTodo(opts.task || 'New task');
        default:
            console.log(chalk.yellow('Available commands:'));
            console.log(chalk.white('  list           - Show all todos from all sources'));
            console.log(chalk.white('  fetch-github   - Fetch todos from GitHub Issues'));
            console.log(chalk.white('  fetch-gdrive   - Fetch todos from Google Drive'));
            console.log(chalk.white('  execute <id>   - Execute a specific todo by ID'));
            console.log(chalk.white('  sync           - Sync all todo sources'));
            console.log(chalk.white('  add            - Add a new local todo'));
    }
}

async function listTodos() {
    console.log(chalk.cyan('--- GitHub Issues ---'));
    try {
        const issues = await listGitHubIssues();
        issues.forEach(issue => {
            console.log(chalk.white(`#${issue.number}: ${issue.title}`));
        });
    } catch (error) {
        console.error(chalk.red('Failed to fetch GitHub issues:', error.message));
    }

    console.log(chalk.cyan('\n--- Local Tasks (todo.md) ---'));
    const localTodos = await parseLocalTodos();
    if (localTodos.length > 0) {
        localTodos.forEach(todo => console.log(chalk.white(todo)));
    } else {
        console.log(chalk.yellow('No local todos found'));
    }
}

async function parseLocalTodos() {
    const todoFilePath = path.join(process.cwd(), 'todo.md');
    if (!await fs.exists(todoFilePath)) {
        return [];
    }
    const content = await fs.readFile(todoFilePath, 'utf-8');
    return content.split('\n').filter(line => line.startsWith('- [ ]'));
}

// ...other todo related functions...

module.exports = { handleTodos };