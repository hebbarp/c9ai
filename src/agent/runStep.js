"use strict";
const { detectTool, planTool, buildGrammarFromTemplate } = require("./router");
const { makeToolUsePrompt } = require("../../prompts/tool-use");
const { makeOpenCLIPrompt } = require("../../prompts/open-cli");
const SigilRouter = require("./sigil-router");
const CloudAIBridge = require("./cloud-ai-bridge");
const ActionValidator = require("./action-validator");
const ExecutionPlanner = require("./execution-planner");

/**
 * @param {*} provider ChatProvider-like object with .defaultModel and .call()
 * @param {string} prompt
 * @param {{ allowedTools: string[], maxSteps?: number, confirmThreshold?: number,
 *           runTool: (name:string,args:any)=>Promise<any>,
 *           synthesize: (prompt:string, toolName:string|"none", toolResult?:any)=>Promise<string> }} ctx
 */
async function agentStep(provider, prompt, ctx) {
  const on = ctx.on || {};
  const sigilRouter = new SigilRouter();
  
  // Check if this is a sigil command first
  if (sigilRouter.hasSigil(prompt)) {
    const routed = sigilRouter.routeSigil(prompt);
    
    if (routed.error) {
      // Unknown sigil - return error
      return await ctx.synthesize(prompt, "none", routed.message);
    }
    
    // Execute the sigil directly
    on.status && on.status(`🎯 Executing sigil: ${routed.sigil}`);
    
    try {
      const toolResult = await ctx.runTool(routed.toolCall.tool, routed.toolCall.args);
      on.toolResult && on.toolResult(routed.toolCall.tool, toolResult);
      
      // Synthesize result
      return await ctx.synthesize(prompt, routed.toolCall.tool, toolResult);
    } catch (error) {
      on.error && on.error(`Sigil execution failed: ${error.message}`);
      return `❌ Sigil execution failed: ${error.message}`;
    }
  }
  
  // Initialize CloudAI Bridge for cloud providers
  const cloudBridge = new CloudAIBridge();
  const actionValidator = new ActionValidator();
  const executionPlanner = new ExecutionPlanner();
  
  // If the provider is local (llama.cpp or other local providers), use the tool-use prompt
  const providerName = String(provider?.name || "");
  const isLocalProvider = provider.supportsGrammar === true || /(^local|llama)/i.test(providerName);
  if (isLocalProvider) {
    if (prompt.toLowerCase().includes("claude cli")) {
      prompt = makeOpenCLIPrompt("Claude");
    } else if (prompt.toLowerCase().includes("gemini cli")) {
      prompt = makeOpenCLIPrompt("Gemini");
    } else {
      prompt = makeToolUsePrompt(prompt);
    }
  } else {
    // For cloud providers, the system prompt should already include C9AI action format instructions
    on.status && on.status("Preparing cloud AI request with C9AI format");
  }

  // Create provider with progress callback
  const providerWithProgress = {
    ...provider,
    call: (opts) => provider.call({
      ...opts,
      onProgress: (status) => on.status && on.status(status)
    })
  };
  
  // Step 1: Get initial response from provider
  on.status && on.status("Getting response from provider");
  let initialResponse;
  
  try {
    initialResponse = await providerWithProgress.call({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  } catch (error) {
    on.error && on.error("provider_call", error.message);
    return { text: `Provider call failed: ${error.message}` };
  }

  // Step 2: Check if response contains C9AI actions (for cloud providers)
  if (provider.name !== "llamacpp") {
    on.status && on.status("Parsing cloud AI response for actions");
    const parseResult = cloudBridge.parseCloudResponse(initialResponse);
    
    if (parseResult.success && parseResult.parsedActions.actions?.length > 0) {
      on.status && on.status("Found executable actions in response");
      
      try {
        // Validate actions
        const validationResults = await actionValidator.validateActionSet(parseResult.parsedActions.actions);
        
        // Build execution plan
        const executionPlan = await executionPlanner.buildExecutionPlan(
          parseResult.parsedActions.actions,
          parseResult.parsedActions.execution_mode || 'optimal'
        );
        
        // Prepare handshake data
        const handshakeData = {
          originalResponse: parseResult.originalResponse,
          actions: parseResult.parsedActions.actions,
          executionPlan: executionPlan,
          validationResults: validationResults,
          requiresConfirmation: parseResult.parsedActions.requires_confirmation !== false || 
                               validationResults.overallRiskLevel === 'high'
        };
        
        // Return handshake data for UI confirmation
        on.status && on.status("Actions ready for user confirmation");
        on.final && on.final("Found executable actions - awaiting user confirmation");
        
        return {
          text: parseResult.originalResponse,
          handshake: handshakeData,
          type: 'cloud_ai_actions'
        };
        
      } catch (error) {
        on.error && on.error("action_processing", error.message);
        // Fall back to normal response
        return { text: parseResult.originalResponse };
      }
    } else {
      // No executable actions found, return normal response
      return { text: initialResponse };
    }
  }

  // Step 3: For local providers, continue with traditional tool detection
  on.status && on.status("detect");
  const choice = await detectTool(providerWithProgress, prompt, ctx);
  on.detected && on.detected(choice);
  if (choice === "none") {
    on.status && on.status("synthesize");
    const text = await ctx.synthesize(prompt, "none");
    on.final && on.final(text);
    return { text };
  }

  // Step 2: Plan the tool call with grammar constraints
  const grammar = undefined; // Disable complex grammar for now
  on.status && on.status("plan");
  const plan = await planTool(providerWithProgress, prompt, "", grammar, ctx);
  on.planned && on.planned(plan);
  if (plan.tool === "none") {
    const text = await ctx.synthesize(prompt, "none");
    return { text };
  }

  // Step 3: Check if tool is allowed and confidence is high enough
  const isAllowed = ctx.allowedTools.includes(plan.tool);
  const hasConfidence = (plan.confidence ?? 0) >= (ctx.confirmThreshold ?? 0.6);

  if (!isAllowed) {
    on.error && on.error("permission", `Tool ${plan.tool} not in allowedTools`);
    const errorMsg = `I cannot run **${plan.tool}** as it's not in the allowed tools list.`;
    on.final && on.final(errorMsg);
    return { text: errorMsg };
  }

  if (!hasConfidence) {
    console.log(`⚠️  Low confidence (${(plan.confidence ?? 0).toFixed(2)}), but proceeding...`);
    // For now, proceed anyway if it's a known tool - the user explicitly requested it
  }

  // Step 4: Execute the tool
  on.status && on.status("execute");
  on.toolStart && on.toolStart(plan.tool, plan.args);
  let result;
  try {
    result = await ctx.runTool(plan.tool, plan.args);
    on.toolResult && on.toolResult(plan.tool, result);
  } catch (err) {
    on.error && on.error(`tool:${plan.tool}`, err);
    const errorMsg = `Tool **${plan.tool}** failed: ${err && err.message ? err.message : String(err)}`;
    on.final && on.final(errorMsg);
    return { text: errorMsg };
  }

  // Step 5: Synthesize final response
  try {
    on.status && on.status("synthesize");
    const text = await ctx.synthesize(prompt, plan.tool, result);
    on.final && on.final(text);
    return { text };
  } catch (err) {
    on.error && on.error("synthesize", err);
    // Fallback: produce a concise local summary without calling the model again.
    const body = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    const txt = `Completed **${plan.tool}**.

Result:
${body}`;
    on.final && on.final(txt);
    return { text: txt };
  }
}

/**
 * Wrapper function that provides the same interface as workflow API expects
 * @param {Object} stepData - Contains prompt, provider, allow (allowedTools)
 * @param {Function} progressCallback - Optional progress callback for SSE streaming
 */
async function runStep(stepData, progressCallback) {
  const { prompt, provider: providerId = 'llamacpp', allow = [] } = stepData;
  
  // Get provider using the same system as Agent UI
  const { getProvider } = require("../providers");
  const { makeSynthesizer } = require("./synthesize");
  const { runTool } = require("../tools/runner");
  
  const provider = getProvider(providerId);
  
  // Set up context similar to SSE agent handler
  const context = {
    allowedTools: allow.length > 0 ? allow : ["shell.run", "script.run", "fs.read", "fs.write", "web.search", "jit"],
    runTool: (n, a) => runTool(n, a),
    synthesize: (prompt, toolName, toolResult, progressProvider) => {
      const synthProvider = progressProvider || provider;
      return makeSynthesizer(synthProvider)(prompt, toolName, toolResult);
    },
    confirmThreshold: 0.6,
    onToken: (tok) => {
      // Handle streaming tokens if progressCallback provided
      if (progressCallback) {
        const piece = typeof tok === "string" ? tok : tok?.content || "";
        if (piece) {
          progressCallback({ type: 'token', content: piece });
        }
      }
    },
    on: {
      status: (status) => {
        if (progressCallback) {
          progressCallback({ type: 'status', message: status });
        }
      },
      detected: (detected) => {
        if (progressCallback) {
          progressCallback({ type: 'detected', data: detected });
        }
      },
      planned: (plan) => {
        if (progressCallback) {
          progressCallback({ type: 'plan', data: plan });
        }
      },
      toolStart: (name, args) => {
        if (progressCallback) {
          progressCallback({ type: 'tool', data: { name, args } });
        }
      },
      toolResult: (name, result) => {
        if (progressCallback) {
          progressCallback({ type: 'toolResult', data: { name, out: result } });
        }
      },
      error: (type, msg) => {
        if (progressCallback) {
          progressCallback({ type: 'error', data: { type, message: msg } });
        }
      },
      final: (text) => {
        if (progressCallback) {
          progressCallback({ type: 'final', data: { text } });
        }
      }
    }
  };
  
  // Execute using agentStep
  return await agentStep(provider, prompt, context);
}

/**
 * Execute approved actions from cloud AI handshake
 */
async function executeApprovedActions(handshakeData, approvedActionIds, executionOptions, ctx) {
  const cloudBridge = new CloudAIBridge();
  const executionPlanner = new ExecutionPlanner();
  
  const approvedActions = handshakeData.actions.filter(action => 
    approvedActionIds.includes(action.id)
  );
  
  if (approvedActions.length === 0) {
    return { 
      success: false, 
      error: 'No actions selected for execution',
      results: []
    };
  }
  
  const results = [];
  const executionMode = executionOptions.mode || 'sequential';
  const dryRun = executionOptions.dryRun || false;
  
  try {
    // Build optimized execution plan for approved actions
    const executionPlan = await executionPlanner.buildExecutionPlan(approvedActions, executionMode);
    
    // Execute actions according to plan
    if (executionMode === 'parallel' && executionPlan.parallelGroups.length > 0) {
      // Execute parallel groups sequentially, but actions within each group in parallel
      for (const group of executionPlan.parallelGroups) {
        const groupPromises = group.actions.map(async (actionItem) => {
          const action = approvedActions.find(a => a.id === actionItem.actionId);
          if (!action) return null;
          
          return executeIndividualAction(action, results, ctx, dryRun, executionPlanner);
        });
        
        const groupResults = await Promise.all(groupPromises);
        results.push(...groupResults.filter(r => r !== null));
      }
    } else {
      // Sequential execution
      for (const action of approvedActions) {
        const result = await executeIndividualAction(action, results, ctx, dryRun, executionPlanner);
        results.push(result);
        
        // If action failed and is critical, stop execution
        if (!result.success && action.critical) {
          break;
        }
      }
    }
    
    return {
      success: true,
      executionMode: executionMode,
      dryRun: dryRun,
      totalActions: approvedActions.length,
      successfulActions: results.filter(r => r.success).length,
      results: results
    };
    
  } catch (error) {
    return {
      success: false,
      error: `Execution failed: ${error.message}`,
      results: results
    };
  }
}

/**
 * Execute an individual action with variable substitution
 */
async function executeIndividualAction(action, previousResults, ctx, dryRun, executionPlanner) {
  try {
    // Convert previous results to lookup format
    const resultLookup = {};
    previousResults.forEach(result => {
      if (result.actionId) {
        resultLookup[result.actionId] = result;
      }
    });
    
    // Substitute variables in action arguments
    const substitutionResult = await executionPlanner.substituteVariables(action, resultLookup);
    
    // Create substituted action
    const substitutedAction = {
      ...action,
      args: substitutionResult.substitutedArgs
    };
    
    if (dryRun) {
      // Dry run - just return what would be executed
      return {
        actionId: action.id,
        success: true,
        dryRun: true,
        sigil: action.sigil,
        originalArgs: action.args,
        substitutedArgs: substitutionResult.substitutedArgs,
        substitutions: substitutionResult.substitutions,
        message: `Would execute: ${action.sigil} ${substitutionResult.substitutedArgs}`
      };
    }
    
    // Convert C9AI action format to tool call format
    const toolName = convertSigilToToolName(action.sigil);
    const toolArgs = convertArgsToToolFormat(action.sigil, substitutionResult.substitutedArgs);
    
    // Execute the tool
    const toolResult = await ctx.runTool(toolName, toolArgs);
    
    return {
      actionId: action.id,
      success: toolResult.success !== false,
      sigil: action.sigil,
      toolName: toolName,
      originalArgs: action.args,
      substitutedArgs: substitutionResult.substitutedArgs,
      substitutions: substitutionResult.substitutions,
      result: toolResult,
      output: toolResult.result || toolResult.output || toolResult,
      error: toolResult.error
    };
    
  } catch (error) {
    return {
      actionId: action.id,
      success: false,
      sigil: action.sigil,
      error: error.message,
      originalArgs: action.args
    };
  }
}

/**
 * Convert C9AI sigil to internal tool name
 */
function convertSigilToToolName(sigil) {
  const sigilName = sigil.slice(1); // Remove @
  
  const sigilToTool = {
    'calc': 'jit',
    'analyze': 'jit', 
    'system': 'jit',
    'count': 'jit',
    'file': 'jit',
    'process': 'jit',
    'read': 'fs.read',
    'write': 'fs.write',
    'search': 'web.search',
    'email': 'cream.mail',
    'post': 'cream.post',
    'share': 'cream.post',
    'publish': 'cream.post',
    'shell': 'shell.run',
    'run': 'shell.run',
    'task': 'shell.run',
    'todo': 'shell.run',
    'github-fetch': 'github.fetch',
    'github-list': 'github.fetch',
    'github-run': 'github.fetch',
    'gdrive-fetch': 'gdrive.fetch',
    'gdrive-list': 'gdrive.fetch',
    'gdrive-run': 'gdrive.fetch'
  };
  
  return sigilToTool[sigilName] || 'shell.run';
}

/**
 * Convert C9AI args to internal tool args format
 */
function convertArgsToToolFormat(sigil, args) {
  const sigilName = sigil.slice(1);
  
  // For JIT tools
  if (['calc', 'analyze', 'system', 'count', 'file', 'process'].includes(sigilName)) {
    const jitArgs = { type: sigilName };
    
    if (sigilName === 'calc') {
      jitArgs.expression = args;
    } else if (sigilName === 'analyze') {
      jitArgs.file = args;
    } else if (['count', 'file', 'process'].includes(sigilName)) {
      const parts = args.split(/\s+/);
      jitArgs.input = parts[0];
      if (parts[1]) jitArgs.output = parts[1];
      if (sigilName === 'count') jitArgs.operation = 'count-lines';
    }
    
    return jitArgs;
  }
  
  // For other tools, return args as-is or convert to appropriate format
  switch (sigilName) {
    case 'read':
      return { path: args };
    case 'write':
      const parts = args.split(' -> ');
      return { path: parts[0], content: parts[1] || '' };
    case 'search':
      return { q: args };
    case 'email':
      // Parse email format: user@example.com subject: Subject text content: Body text
      const structuredMatch = args.match(/^['"]*([^'"@]+@[^'"\s]+)['"]*\s+subject:\s*(.+?)\s+(?:mail\s+)?content:\s*(.+)$/i);
      if (structuredMatch) {
        return {
          to_email: structuredMatch[1].replace(/['"]/g, ''),
          subject: structuredMatch[2].trim(),
          body: structuredMatch[3].trim(),
          from_email: 'noreply@knoblycream.com',
          from_name: 'C9AI Assistant'
        };
      } else {
        // Fallback format
        const emailAddr = args.match(/['"]*([^'"@]+@[^'"\s]+)['"]*/);
        if (emailAddr) {
          return {
            to_email: emailAddr[1].replace(/['"]/g, ''),
            subject: 'Message from C9AI',
            body: args.replace(emailAddr[0], '').trim() || 'Hello from C9AI!',
            from_email: 'noreply@knoblycream.com',
            from_name: 'C9AI Assistant'
          };
        }
        return { input: args };
      }
    case 'post':
    case 'share':
    case 'publish':
      // Parse post format: @post "Content here" visibility:public
      const postContentMatch = args.match(/^"([^"]+)"\s*(?:visibility:)?(public|private)?/i);
      const simplePostMatch = args.match(/^"([^"]+)"\s+(public|private)/i);
      
      if (postContentMatch) {
        return {
          content: postContentMatch[1],
          visibility: postContentMatch[2] || 'public',
          media: []
        };
      } else if (simplePostMatch) {
        return {
          content: simplePostMatch[1],
          visibility: simplePostMatch[2],
          media: []
        };
      } else {
        // Fallback - treat entire args as content
        const cleanContent = args.replace(/^["']|["']$/g, '');
        return {
          content: cleanContent || 'Hello from C9AI!',
          visibility: 'public',
          media: []
        };
      }
    case 'shell':
    case 'run':
    case 'task':
    case 'todo':
      return { command: args };
    case 'github-fetch':
    case 'github-list':
      return { action: sigilName.split('-')[1], repo: args };
    case 'github-run':
      return { action: 'execute', todoId: args.split(/\s+/)[0] };
    case 'gdrive-fetch':
    case 'gdrive-list':
      return { action: sigilName.split('-')[1], query: args };
    case 'gdrive-run':
      return { action: 'execute', todoId: args.split(/\s+/)[0] };
    default:
      return { input: args };
  }
}

module.exports = { agentStep, runStep, executeApprovedActions };
