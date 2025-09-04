"use strict";
/**
 * Universal Hybrid Provider
 * Combines any cloud AI provider (Claude, Gemini, OpenAI, etc.) with local tool execution
 */

class HybridProvider {
  constructor(cloudProvider, localProvider) {
    this.cloud = cloudProvider;
    this.local = localProvider;
    this.name = `${cloudProvider.name}-hybrid`;
    this.defaultModel = cloudProvider.defaultModel;
    this.supportsGrammar = false; // Cloud providers generally don't support grammar
  }

  async call(opts) {
    const onProgress = opts.onProgress || (() => {});
    
    try {
      // Step 1: Cloud AI analyzes request and determines if tools are needed
      onProgress(`🧠 ${this.cloud.name.toUpperCase()} analyzing request...`);
      
      const userMessage = opts.messages[opts.messages.length - 1].content;
      const planningPrompt = this.createPlanningPrompt(userMessage);
      
      const planResponse = await this.cloud.call({
        ...opts,
        messages: [
          { role: "system", content: "You are a task analyzer. Respond with valid JSON only." },
          { role: "user", content: planningPrompt }
        ],
        temperature: 0.1, // Low temperature for structured output
        max_tokens: 512
      });
      
      // Step 2: Parse the cloud AI's plan
      const plan = this.parsePlan(planResponse.text);
      
      if (!plan.needsTools) {
        // Direct response - no tools needed
        onProgress(`✨ ${this.cloud.name.toUpperCase()} providing direct response...`);
        return { text: plan.response };
      }
      
      // Step 3: Execute tools via local model
      onProgress(`⚡ Delegating to local model for tool execution...`);
      const toolResults = await this.executeTools(plan.toolCalls, onProgress);
      
      // Step 4: Cloud AI synthesizes final response based on tool results
      onProgress(`✨ ${this.cloud.name.toUpperCase()} synthesizing final response...`);
      const finalResponse = await this.synthesizeResponse(userMessage, toolResults, opts);
      
      return {
        text: finalResponse,
        toolsUsed: toolResults.map(r => r.tool),
        orchestrator: this.cloud.name,
        executor: this.local.name,
        hybrid: true
      };
      
    } catch (error) {
      console.error(`Hybrid provider ${this.name} failed:`, error);
      onProgress(`❌ Hybrid execution failed, trying cloud-only response...`);
      
      // Fallback to cloud-only response
      try {
        const fallbackResponse = await this.cloud.call(opts);
        return {
          text: fallbackResponse.text + "\n\n⚠️ *Note: Local tool execution was unavailable, so this response may be limited.*",
          fallback: true,
          fallbackReason: error.message
        };
      } catch (cloudError) {
        throw new Error(`Both hybrid and cloud-only execution failed. Hybrid: ${error.message}, Cloud: ${cloudError.message}`);
      }
    }
  }

  createPlanningPrompt(userMessage) {
    return `Analyze this user request and determine if it requires local tool execution.

User request: "${userMessage}"

Available tools:
- shell.run: Execute shell commands (ls, cd, npm, etc.)
- fs.read: Read file contents
- fs.write: Write/create files  
- web.search: Search the internet

Respond with ONLY valid JSON in this exact format:

If tools are needed:
{
  "needsTools": true,
  "toolCalls": [
    {"tool": "shell.run", "args": {"cmd": "ls -la", "timeout": 30000}},
    {"tool": "fs.read", "args": {"path": "./file.txt"}}
  ],
  "reasoning": "Need to list files and read a specific file"
}

If no tools needed (pure conversation/explanation):
{
  "needsTools": false,
  "response": "Your direct response here"
}

Examples:
- "list files" → needs shell.run
- "what is JavaScript?" → no tools needed
- "create a hello.py file" → needs fs.write
- "search for React tutorials" → needs web.search

Analyze the request and respond with JSON only:`;
  }

  parsePlan(responseText) {
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanText = responseText.trim();
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      
      const plan = JSON.parse(cleanText);
      
      // Validate the plan structure
      if (typeof plan.needsTools !== 'boolean') {
        throw new Error('Invalid plan: needsTools must be boolean');
      }
      
      if (plan.needsTools && !Array.isArray(plan.toolCalls)) {
        throw new Error('Invalid plan: toolCalls must be array when needsTools is true');
      }
      
      return plan;
    } catch (error) {
      console.warn('Failed to parse plan JSON:', responseText);
      // Fallback: assume it's a direct response
      return {
        needsTools: false,
        response: responseText.trim()
      };
    }
  }

  async executeTools(toolCalls, onProgress) {
    const results = [];
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      onProgress(`🔧 Executing ${toolCall.tool} (${i + 1}/${toolCalls.length})`);
      
      try {
        // Use local provider to execute the tool
        // We need to create a prompt that makes the local model execute the tool
        const toolPrompt = this.createToolExecutionPrompt(toolCall);
        
        const localResponse = await this.local.call({
          model: this.local.defaultModel,
          messages: [
            { role: "system", content: "You are a tool executor. Execute the requested tool and return results." },
            { role: "user", content: toolPrompt }
          ],
          temperature: 0,
          max_tokens: 1024
        });
        
        results.push({
          tool: toolCall.tool,
          args: toolCall.args,
          result: localResponse.text,
          success: true
        });
        
      } catch (error) {
        console.error(`Tool execution failed for ${toolCall.tool}:`, error);
        results.push({
          tool: toolCall.tool,
          args: toolCall.args,
          result: `Error: ${error.message}`,
          success: false
        });
      }
    }
    
    return results;
  }

  createToolExecutionPrompt(toolCall) {
    switch (toolCall.tool) {
      case 'shell.run':
        return `Execute this shell command: ${toolCall.args.cmd}`;
      case 'fs.read':
        return `Read the contents of file: ${toolCall.args.path}`;
      case 'fs.write':
        return `Write to file ${toolCall.args.path}: ${toolCall.args.content}`;
      case 'web.search':
        return `Search the web for: ${toolCall.args.query}`;
      default:
        return `Execute tool ${toolCall.tool} with args: ${JSON.stringify(toolCall.args)}`;
    }
  }

  async synthesizeResponse(originalRequest, toolResults, opts) {
    const synthesisPrompt = `Based on the user's original request and the tool execution results, provide a helpful and comprehensive response.

Original user request: "${originalRequest}"

Tool execution results:
${toolResults.map(r => `
Tool: ${r.tool}
Args: ${JSON.stringify(r.args)}
Result: ${r.result}
Success: ${r.success}
`).join('\n')}

Provide a natural, helpful response that addresses the user's request using these results. Do not mention the internal tool execution process unless relevant.`;

    const response = await this.cloud.call({
      ...opts,
      messages: [
        { role: "system", content: "You are a helpful assistant. Provide clear, concise responses based on the provided information." },
        { role: "user", content: synthesisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1024
    });

    return response.text;
  }
}

module.exports = { HybridProvider };