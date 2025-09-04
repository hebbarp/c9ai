# Cloud AI → C9AI Local Agent Integration

## Overview
Enable cloud AI models (OpenAI, Gemini, Claude) to output responses in a structured format that the C9AI local agent can parse, prepare, confirm with user, and execute automatically.

## Architecture

### 1. Cloud AI Response Format
Cloud AI models will be trained via system prompts to respond with both human-readable text AND executable C9AI actions:

```json
{
  "message": "I'll help you analyze the sales data and generate a summary report.",
  "actions": [
    {
      "id": "action-1", 
      "sigil": "@analyze",
      "args": "sales_data.csv",
      "description": "Analyze CSV file for patterns and statistics",
      "risk_level": "low",
      "estimated_time": "30s"
    },
    {
      "id": "action-2",
      "sigil": "@calc", 
      "args": "sum(revenue_column)",
      "description": "Calculate total revenue from analysis",
      "risk_level": "low",
      "estimated_time": "5s"
    },
    {
      "id": "action-3",
      "sigil": "@write",
      "args": "summary_report.md -> # Sales Analysis Summary\n\nTotal Revenue: ${action-2.result}\nKey Insights: ${action-1.insights}",
      "description": "Generate markdown summary report",
      "risk_level": "low", 
      "estimated_time": "10s"
    }
  ],
  "execution_mode": "sequential",
  "requires_confirmation": false,
  "total_estimated_time": "45s"
}
```

### 2. System Prompt Templates

#### For OpenAI/GPT Models:
```
You are C9AI-enabled. When your response involves actionable tasks, always include a JSON block with executable C9AI sigils.

RESPONSE FORMAT:
1. Provide helpful human-readable response
2. If actions are needed, include JSON block:

```json
{
  "message": "Your response text here",
  "actions": [
    {"id": "unique-id", "sigil": "@command", "args": "arguments", "description": "what this does", "risk_level": "low|medium|high", "estimated_time": "Xs"}
  ],
  "execution_mode": "sequential|parallel",
  "requires_confirmation": true/false
}
```

AVAILABLE SIGILS:
- @calc expression - Mathematical calculations
- @analyze file - Data analysis 
- @system - System information
- @count file - Count lines/words in files
- @read file - Read file contents
- @write file -> content - Write to files
- @email to subject body - Send emails
- @search query - Web search
- @github-fetch repo - Fetch GitHub issues
- @gdrive-fetch query - Fetch Google Drive todos

RISK LEVELS:
- low: Read operations, calculations, analysis
- medium: File writes, non-destructive changes
- high: System commands, deletions, network operations

Only include actions when the user's request implies execution. For pure information requests, respond normally without actions.
```

#### For Gemini Models:
```
You are integrated with C9AI, an execution-oriented AI system. When users request tasks that can be automated, respond with both explanation AND executable instructions.

OUTPUT FORMAT:
Normal conversational response + JSON action block when applicable:

{
  "message": "response text", 
  "actions": [sigil objects],
  "execution_mode": "sequential",
  "requires_confirmation": boolean
}

C9AI SIGILS: @calc, @analyze, @system, @count, @read, @write, @email, @search, @github-fetch, @gdrive-fetch

Example:
User: "Calculate 15% tax on $2000 and save result to taxes.txt"
Response: "I'll calculate the tax and save it for you."
{
  "message": "I'll calculate 15% tax on $2000 and save the result to taxes.txt",
  "actions": [
    {"id": "tax-calc", "sigil": "@calc", "args": "2000 * 0.15", "description": "Calculate 15% tax", "risk_level": "low"},
    {"id": "save-result", "sigil": "@write", "args": "taxes.txt -> Tax calculation: $${tax-calc.result}", "description": "Save result to file", "risk_level": "medium"}
  ]
}
```

### 3. Handshake Bridge Implementation

#### Component: `CloudAIBridge.js`
```javascript
class CloudAIBridge {
  constructor() {
    this.actionQueue = [];
    this.executionHistory = [];
  }

  // Parse cloud AI response for executable actions
  parseCloudResponse(response) {
    // Extract JSON block from response
    // Validate action format
    // Return parsed actions or null
  }

  // Prepare actions for execution
  async prepareActions(actions) {
    // Validate sigils exist
    // Check file permissions
    // Estimate resource usage
    // Build execution plan
  }

  // Present actions to user for confirmation
  async requestConfirmation(actions, executionPlan) {
    // Show user-friendly action summary
    // Display risk assessment
    // Allow selective execution
    // Return user decisions
  }

  // Execute approved actions
  async executeActions(approvedActions) {
    // Execute in specified order (sequential/parallel)
    // Handle dependencies between actions
    // Capture results for variable substitution
    // Provide real-time progress updates
  }
}
```

#### Component: `ActionValidator.js`
```javascript
class ActionValidator {
  validateSigil(sigil) {
    // Check if sigil exists in system
    // Verify required parameters
    // Assess security implications
  }

  assessRisk(action) {
    // File system operations
    // Network requests  
    // System commands
    // Return risk level
  }

  checkDependencies(actions) {
    // Variable references between actions
    // File dependencies
    // Build dependency graph
  }
}
```

#### Component: `ExecutionPlanner.js`
```javascript
class ExecutionPlanner {
  buildExecutionPlan(actions) {
    // Parse dependencies
    // Optimize execution order
    // Estimate total time
    // Identify parallelizable actions
  }

  substituteVariables(action, previousResults) {
    // Replace ${action-id.result} with actual values
    // Handle complex substitutions
    // Validate substituted values
  }
}
```

### 4. Integration Points

#### In `runStep.js`:
```javascript
// Add cloud AI response parsing
if (provider.name !== 'llamacpp') {
  const bridge = new CloudAIBridge();
  const parsedActions = bridge.parseCloudResponse(result);
  
  if (parsedActions && parsedActions.actions.length > 0) {
    // Prepare actions for execution
    const executionPlan = await bridge.prepareActions(parsedActions.actions);
    
    // Request user confirmation
    const approvedActions = await bridge.requestConfirmation(
      parsedActions.actions, 
      executionPlan
    );
    
    // Execute approved actions
    if (approvedActions.length > 0) {
      const results = await bridge.executeActions(approvedActions);
      return results;
    }
  }
}
```

#### In Web Interface (`public/index.html`):
```javascript
// Add action confirmation UI
function showActionConfirmation(actions) {
  // Display actions in user-friendly format
  // Show checkboxes for selective execution
  // Display risk warnings
  // Provide "Execute All", "Execute Selected", "Cancel" options
}

function updateExecutionProgress(progress) {
  // Show real-time execution progress
  // Display current action being executed
  // Show completion percentage
  // Handle errors and retries
}
```

### 5. Implementation Phases

#### Phase 1: System Prompt Integration
- [ ] Update provider configurations with C9AI-aware system prompts
- [ ] Test cloud AI response format consistency
- [ ] Validate JSON parsing reliability

#### Phase 2: Bridge Components  
- [ ] Implement `CloudAIBridge` core functionality
- [ ] Create `ActionValidator` for security and validation
- [ ] Build `ExecutionPlanner` for optimization

#### Phase 3: User Interface
- [ ] Add action confirmation dialogs to web interface
- [ ] Implement progress tracking and real-time updates
- [ ] Create settings for auto-execution preferences

#### Phase 4: Integration & Testing
- [ ] Integrate bridge into `runStep.js` workflow
- [ ] Test with different cloud AI providers
- [ ] Add comprehensive error handling and fallbacks

#### Phase 5: Advanced Features
- [ ] Variable substitution between actions
- [ ] Conditional execution (if/then logic)
- [ ] Action templates and macros
- [ ] Execution history and replay

### 6. Security Considerations

- **Risk Assessment**: Every action must be classified by risk level
- **User Confirmation**: High-risk actions always require explicit approval
- **Sandbox Mode**: Option to execute actions in isolated environment
- **Audit Trail**: Log all executed actions with timestamps and results
- **Rate Limiting**: Prevent excessive automated executions

### 7. Example Workflows

#### User Query: "Analyze my sales data and email a summary to my team"

**Cloud AI Response:**
```json
{
  "message": "I'll analyze your sales data and prepare an email summary for your team.",
  "actions": [
    {"id": "find-data", "sigil": "@read", "args": "sales_data.csv", "description": "Read sales data file"},
    {"id": "analyze", "sigil": "@analyze", "args": "sales_data.csv", "description": "Perform statistical analysis"}, 
    {"id": "summary", "sigil": "@write", "args": "sales_summary.md -> # Sales Analysis\n\n${analyze.insights}", "description": "Generate summary report"},
    {"id": "send", "sigil": "@email", "args": "team@company.com 'Sales Analysis Summary' sales_summary.md", "description": "Email summary to team"}
  ],
  "execution_mode": "sequential",
  "requires_confirmation": true
}
```

**Local Agent Processing:**
1. Parse actions from cloud response
2. Validate all sigils and arguments
3. Check file permissions and email configuration  
4. Present confirmation dialog to user
5. Execute approved actions in sequence
6. Provide progress updates and final results

This handshake bridge will make C9AI the first truly execution-oriented AI system where cloud intelligence seamlessly translates to local action.