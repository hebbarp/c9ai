# Gemini Todo Management

This document outlines how to manage and execute todos for this project.

## Checking Todos

To check for open todos, I need to use the `gh` (GitHub CLI) tool.

1.  **Check for `gh`:**
    ```bash
    command -v gh
    ```

2.  **List open todos:**
    ```bash
    gh issue list --repo Shreyasjainr/todo-management --state open
    ```

3.  **Get a summary of open todos:**
    ```bash
    gh issue list --repo Shreyasjainr/todo-management --state open --json number | jq '. | length'
    ```

## Executing Todos

The user mentioned "execute my open todos". The script `check-todos.sh` suggests the command `execute my open todos`. I will note this as the command to execute todos.
