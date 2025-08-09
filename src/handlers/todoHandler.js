const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');

async function handleTodos(action = 'list', task) {
    console.log(chalk.cyan('📋 Todo Management'));
    
    switch (action) {
        case 'list':
            return await listTodos();
        case 'add':
            return await addTodo(task);
        case 'execute':
            return await executeTodos();
        case 'sync':
            return await syncTodos();
        default:
            console.log(chalk.yellow('Available commands: list, add, execute, sync'));
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