"use strict";
const { isRunaway, hardClamp, collapseRepeats } = require("../src/utils/text");
const { StreamGuard } = require("../src/quality/stream-guard");
const { streamBulletTally, cleanBullets } = require("../src/utils/bullets");
const { NLMathPreprocessor } = require("../src/agent/nl-math-preprocessor");
const { globalContextManager } = require("../src/agent/context-manager");
const { FunctionGenerator } = require("../src/tools/function-generator");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");

async function agenticResponseSSE(req, res) {
  // Always wrap the whole handler
  try {
    // 1) Read params from POST body or GET query
    const src = req.method === "GET" ? req.query : (req.body || {});
    const prompt = src.prompt;
    const provider = src.provider;
    const sessionId = src.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const allow = Array.isArray(src.allow)
      ? src.allow
      : (typeof src.allow === "string" ? JSON.parse(src.allow) : undefined);
    const threshold = src.threshold ? Number(src.threshold) : undefined;

    // 2) SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    const stream = res;
    const send = (event, data) =>
      stream.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);

    if (!prompt) throw new Error("Missing prompt");

    // 2.1) Context Management - Build contextual prompt
    send("debug", `🔍 Session ID: ${sessionId}`);
    send("debug", `📝 Original prompt: "${prompt}"`);
    
    const contextResult = globalContextManager.buildContextualPrompt(sessionId, prompt);
    let processedPrompt = contextResult.contextualQuery;
    
    if (contextResult.isContextual) {
      send("context", `🧠 Context detected - combining with previous: "${contextResult.context.problem}"`);
      send("context", `🔗 Contextual query: "${processedPrompt}"`);
    }

    // 2.5) Natural Language Math Preprocessing
    // Skip math preprocessing for executive/business requests and existing sigils
    const isExecutiveRequest = processedPrompt.trim().startsWith('@executive') || processedPrompt.trim().startsWith('@business');
    const hasExistingSigil = processedPrompt.trim().startsWith('@');
    
    let mathConversion = null;
    // Load user settings for routing decisions
    let userSettings = {};
    try {
      userSettings = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
    } catch {}

    // Lightweight intent detection
    const detectIntent = (text) => {
      const t = String(text || '').toLowerCase();
      if (/^@executive|^@business/.test(t)) return 'exec';
      if (/```/.test(t) || /(refactor|compile|build|test|unit test|patch|pr|typescript|python|javascript|java|golang|rust|function\s|class\s|import\s)/i.test(t)) return 'code';
      if (/(calc|calculate|sum|average|percent|roi|breakeven|interest)/i.test(t)) return 'math';
      return 'simple';
    };

    const deriveProviderFromSettings = (intent) => {
      const mode = userSettings.defaultMode || 'hybrid';
      const privacy = userSettings.privacyProfile || 'ask_before_cloud';
      const coding = userSettings.codingProvider || 'claude';

      if (privacy === 'strict_local') return 'llamacpp';

      if (mode === 'local') return 'llamacpp';
      if (mode === 'cloud') return coding; // pure cloud

      // hybrid: local for most, cloud for code
      if (intent === 'code') {
        if (coding === 'llamacpp') return 'llamacpp';
        return `${coding}-hybrid`; // plan with cloud, execute tools locally
      }
      // exec/math/simple default to local
      return 'llamacpp';
    };

    const intent = detectIntent(processedPrompt);
    const providerId = provider || deriveProviderFromSettings(intent);
    
    if (!isExecutiveRequest && !hasExistingSigil) {
      try {
        console.log(`🔍 Creating NL Math Preprocessor with providerId: ${providerId}`);
        const nlMath = new NLMathPreprocessor({
          provider: "llamacpp", // Force local AI first
          fallbackProvider: "openai"
        });
        
        const result = await nlMath.process(processedPrompt);
        
        if (result.converted) {
          send("status", `🧮 Converting natural language to math: "${processedPrompt}"`);
          send("status", `📐 Detected calculation: ${result.processedText}`);
          send("debug", `🎯 Math conversion confidence: ${((result.confidence || 0) * 100).toFixed(1)}%`);
          processedPrompt = result.processedText;
          mathConversion = result;
          
          if (result.usedFallback) {
            send("status", "🌐 Used cloud AI for math conversion");
          }
        } else {
          send("debug", "❌ No math conversion - proceeding with contextual query");
        }
      } catch (nlError) {
        // Non-fatal error, continue with original prompt
        console.warn("NL Math preprocessing failed:", nlError.message);
        send("status", `⚠️  Math conversion failed, proceeding with original prompt`);
      }
    } else {
      // Executive requests and existing sigils skip math preprocessing
      if (isExecutiveRequest) {
        send("status", `🎯 Executive request detected - skipping math preprocessing`);
      } else if (hasExistingSigil) {
        send("status", `🔧 Existing sigil detected - skipping math preprocessing`);
      }
    }

    // 3) Settings (bullet max)
    let bulletMax = 8;
    try {
      const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
      const m = Number(s?.style?.bulletMax);
      if (m && m > 0 && m <= 20) bulletMax = m;
    } catch {}
    const modeBulletize = /bullet\s*points?|bulletize|bulleted/i.test(prompt || "");

    // 4) Guards
    let accText = "";
    const sg = new StreamGuard({
      sourceText: src.sourceText || src.pdfText || "",
      windowChars: 600,
      minNovelty: 0.18,
      maxRepeatRate: 0.35,
      minDriftOverlap: 0.07,
      badWindowsToStop: 2
    });

    // 5) Run one agent step (tool router)
    const { getProvider, isHybridProvider } = require("../src/providers");
    const { agentStep } = require("../src/agent/runStep");
    const { makeSynthesizer } = require("../src/agent/synthesize");
    const { runTool } = require("../src/tools/runner");
    
    let p = getProvider(providerId);

    console.log('🎪 About to call agentStep with prompt:', processedPrompt);
    const out = await agentStep(p, processedPrompt, {
      allowedTools: allow || ["shell.run", "script.run", "fs.read", "fs.write", "web.search", "jit"],
      runTool: async (n, a) => {
        console.log(`🔄 SSE runTool called with name: ${n}, args:`, a);
        const toolResult = await runTool(n, a);
        console.log(`🔄 SSE runTool returning:`, toolResult);
        return toolResult;
      },
      synthesize: (prompt, toolName, toolResult, progressProvider) => {
        const synthProvider = progressProvider || p;
        return makeSynthesizer(synthProvider)(prompt, toolName, toolResult);
      },
      confirmThreshold: threshold ?? 0.6,
      onToken: (tok) => {
        const piece = typeof tok === "string" ? tok : tok?.content || "";
        if (piece) {
          send("token", piece);
          accText += piece;
        }
      },
      on: {
        status: (status) => send("status", status),
        detected: (detected) => send("detected", detected),
        planned: (plan) => send("plan", plan),
        toolStart: (name, args) => send("tool", { name, args }),
        toolResult: (name, result) => {
          console.log(`🔧 Tool result received for ${name}:`, result);
          console.log(`🔍 Result type: ${typeof result}, has error property: ${result && result.error}, error value: ${result && result.error}`);
          
          // Check if this is an unknown function that needs generation
          if (result && typeof result === 'object' && result.error === "unknown_function") {
            console.log(`🚨 Unknown function detected: ${result.functionName}`);
            
            // Auto-escalate to cloud AI for XML-Lisp generation
            send("status", `🌐 Function '${result.functionName}' not found - escalating to cloud AI`);
            send("debug", `🔄 Generating XML-Lisp function for: ${result.functionName}(${result.parameters})`);
            
            // Trigger automatic XML generation
            generateXMLFunction(result, send, async (n, a) => runTool(n, a), (prompt, toolName, toolResult, progressProvider) => {
              const synthProvider = progressProvider || p;
              return makeSynthesizer(synthProvider)(prompt, toolName, toolResult);
            });
            return;
          } else if (result && typeof result === 'string') {
            try {
              const parsed = JSON.parse(result);
              if (parsed.error === "unknown_function") {
                console.log(`🚨 Unknown function detected from JSON: ${parsed.functionName}`);
                send("unknownFunction", {
                  functionName: parsed.functionName,
                  parameters: parsed.parameters,
                  message: parsed.message,
                  expression: parsed.expression
                });
                return;
              }
            } catch (e) {
              // Not JSON, continue normal processing
            }
          } else {
            console.log(`❌ No unknown function detected. Result structure:`, JSON.stringify(result, null, 2));
          }
          send("toolResult", { name, out: result });
        },
        error: (type, msg) => send("error", { type, message: msg }),
        final: (text) => {
          // Check for fallback condition
          if (text.includes("I can't directly access or list files")) {
            send("status", "Local model cannot fulfill the request, falling back to cloud...");
            // Re-run with a cloud provider
            p = getProvider("claude"); // or gemini
            agentStep(p, prompt, this);
          } else {
            send("final", { text });
          }
        }
      }
    });

    // 6) Finish
    console.log('🎪 AgentStep returned out:', out);
    let finalText = "";
    if (out?.text?.text) {
      finalText = String(out.text.text);
    } else if (out?.text) {
      finalText = String(out.text);
    } else if (out?.content) {
      finalText = String(out.content);
    } else if (out) {
      finalText = String(out);
    }
    console.log('🎪 FinalText extracted:', finalText);
    if (modeBulletize) finalText = cleanBullets(finalText, { max: bulletMax, minLen: 3 });
    finalText = hardClamp(collapseRepeats(finalText), 10000);
    
    // 6.1) Context Management - Handle incomplete problems
    globalContextManager.addMessage(sessionId, 'user', prompt);
    globalContextManager.addMessage(sessionId, 'assistant', finalText);
    
    const incompleteCheck = globalContextManager.detectIncompleteProblems(prompt, finalText);
    
    if (incompleteCheck.isIncomplete) {
      send("debug", `🔄 Incomplete problem detected - setting context for continuation`);
      send("context", `⏳ Waiting for additional information: ${incompleteCheck.missingInfo.map(m => m.term).join(', ')}`);
      
      globalContextManager.setPendingContext(sessionId, {
        problem: prompt,
        missingInfo: incompleteCheck.missingInfo,
        timestamp: Date.now()
      });
    }
    
    // 6.2) Debug information
    const contextStats = globalContextManager.getStats();
    send("debug", `📊 Context stats - Active sessions: ${contextStats.activeSessions}, Pending: ${contextStats.sessionsWithPendingContext}`);
    
    // Check if fallback was used and add a note
    if (out && out.fallbackUsed) {
      send("status", `✅ Response completed using ${out.fallbackProvider} (fallback)`);
    }
    
    // Send math conversion metadata if available
    if (mathConversion) {
      send("debug", `🧮 Math metadata - Method: ${mathConversion.method || 'standard'}, Functions: ${mathConversion.functions?.join(', ') || 'basic'}`);
    }
    
    console.log('🚀 About to send final event with text:', finalText);
    send("final", { text: finalText });
    
    // Send metadata separately
    send("metadata", {
      sessionId: sessionId,
      mathConversion: mathConversion,
      contextual: contextResult.isContextual,
      hasIncompleteContext: incompleteCheck.isIncomplete
    });
    stream.end();
  } catch (e) {
    console.error("[/api/agent] error:", e?.stack || e);
    
    // Check if headers have already been sent (SSE connection established)
    if (res.headersSent) {
      // Use the existing SSE stream
      try {
        const sendError = (event, data) =>
          res.write(`event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
        
        sendError("error", { error: "agent_failed", message: e?.message || String(e) });
        sendError("final", { text: `❌ Agent failed: ${e?.message || "Unknown error"}` });
        res.end();
      } catch (streamError) {
        // Stream might be closed, just log and end
        console.error("Failed to send error via SSE stream:", streamError);
        res.end();
      }
    } else {
      // Headers not sent yet, try to establish SSE connection for error
      try {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no"
        });
        res.write(`event: error\ndata: ${JSON.stringify({ error: "agent_failed", message: e?.message || String(e) })}\n\n`);
        res.end();
      } catch (headerError) {
        // Last resort: try JSON response
        try {
          res.status(500).json({ error: "agent_failed", message: e?.message || String(e) });
        } catch (jsonError) {
          console.error("Complete failure to send error response:", jsonError);
          res.end();
        }
      }
    }
  }
}

/**
 * Generate XML-Lisp function using cloud AI and inject into execution context
 */
async function generateXMLFunction(unknownFunctionResult, send, runTool, synthesize) {
  try {
    const { functionName, parameters } = unknownFunctionResult;
    
    send("status", `🤖 Generating ${functionName} function using cloud AI...`);
    
    // Create function generator instance
    const functionGenerator = new FunctionGenerator({
      localProvider: "llamacpp",
      cloudProvider: "openai"
    });
    
    // Generate XML-Lisp function
    const generationResult = await functionGenerator.generateFunction(
      functionName, 
      parameters,
      { context: "Executive calculator for business functions" }
    );
    
    if (generationResult.success) {
      send("status", `✅ Successfully generated ${functionName} function`);
      send("debug", `📄 XML-Lisp: ${generationResult.xml?.substring(0, 200)}...`);
      send("debug", `🔧 JavaScript: ${generationResult.javascript?.substring(0, 200)}...`);
      
      // Cache the generated function for future use
      if (generationResult.javascript) {
        send("status", `💾 Caching ${functionName} function for reuse`);
        
        // Execute the newly generated function with original parameters
        send("status", `🚀 Executing generated function: ${functionName}(${parameters})`);
        
        try {
          const executionResult = await functionGenerator.executeFunction(
            generationResult.javascript,
            functionName,
            parameters
          );
          
          if (executionResult.success) {
            send("toolResult", { 
              name: "calc", 
              out: {
                result: executionResult.result,
                expression: executionResult.expression,
                generatedFunction: true,
                source: generationResult.source
              }
            });
            send("status", `🎯 Function executed successfully: ${executionResult.result}`);
          } else {
            send("error", { 
              type: "execution_failed", 
              message: `Generated function execution failed: ${executionResult.error}` 
            });
          }
        } catch (execError) {
          send("error", { 
            type: "execution_error", 
            message: `Error executing generated function: ${execError.message}` 
          });
        }
      }
    } else {
      send("error", { 
        type: "generation_failed", 
        message: `Failed to generate ${functionName}: ${generationResult.error}` 
      });
      
      // Fallback to informing user about unknown function
      send("unknownFunction", {
        functionName: functionName,
        parameters: parameters,
        message: `Function '${functionName}' not found and could not be generated`,
        suggestion: "Please define this function or use an available function"
      });
    }
    
  } catch (error) {
    console.error("XML function generation failed:", error);
    send("error", { 
      type: "generation_error", 
      message: `Function generation system error: ${error.message}` 
    });
  }
}

module.exports = { agenticResponseSSE };
