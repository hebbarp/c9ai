"use strict";
/**
 * Enhanced Math Processor - Transparent computation with dynamic programming
 * Shows internal workings and can write/execute custom programs
 */

const { getProvider } = require("../providers");
const jitTool = require("../tools/jit-executor");
const fs = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const { exec } = require("node:child_process");

const execAsync = promisify(exec);

class EnhancedMathProcessor {
  constructor(options = {}) {
    this.provider = options.provider || "llamacpp";
    this.fallbackProvider = options.fallbackProvider || "openai";
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    this.onProgress = options.onProgress || (() => {});
    this.onUserInput = options.onUserInput || (() => Promise.resolve(true));
    this.aborted = false;
    
    // Available functions in JIT executor
    this.availableFunctions = [
      'sqrt', 'pow', 'sin', 'cos', 'tan', 'log', 'log10', 'log2', 'exp',
      'abs', 'round', 'floor', 'ceil', 'max', 'min', 'random',
      'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
      'sum', 'mean', 'median', 'std',
      'pv', 'fv', 'npv', 'irr', 'cagr', 'compound'
    ];
    
    // Math detection patterns
    this.mathIndicators = [
      /what\s+is\s+\d+/i,
      /calculate|compute|solve|find/i,
      /\d+\s*[\+\-\*\/\%]\s*\d+/,
      /how\s+much|how\s+many/i,
      /percentage|percent|\%/i,
      /interest|compound|growth|return/i,
      /npv|irr|roi|cagr/i,
      /present\s+value|future\s+value/i,
      /profit|revenue|cost|margin/i,
      /average|mean|sum|total/i,
      /square\s+root|sqrt|power|exponent/i,
      /prime\s+numbers?/i,
      /fibonacci/i,
      /factorial/i,
      /(\d+).*(\d+)/
    ];
  }

  /**
   * Check for abort signal
   */
  checkAbort() {
    if (this.aborted) {
      throw new Error("Operation aborted by user");
    }
  }

  /**
   * Abort the current operation
   */
  abort() {
    this.aborted = true;
    this.onProgress("status", "❌ Operation aborted by user");
  }

  /**
   * Reset abort state for new operations
   */
  reset() {
    this.aborted = false;
  }

  /**
   * Check if text contains math intent
   */
  hasMathIntent(text) {
    const normalizedText = text.toLowerCase().trim();
    return this.mathIndicators.some(pattern => pattern.test(normalizedText));
  }

  /**
   * Extract functions used in an expression
   */
  extractFunctions(expression) {
    const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const functions = [];
    let match;
    
    while ((match = functionPattern.exec(expression)) !== null) {
      functions.push(match[1]);
    }
    
    return [...new Set(functions)]; // Remove duplicates
  }

  /**
   * Check if all functions in expression are available
   */
  validateFunctions(expression) {
    const usedFunctions = this.extractFunctions(expression);
    const unavailableFunctions = usedFunctions.filter(fn => 
      !this.availableFunctions.includes(fn)
    );
    
    return {
      isValid: unavailableFunctions.length === 0,
      unavailableFunctions,
      usedFunctions
    };
  }

  /**
   * Convert natural language to @calc expression using AI
   */
  async convertToCalc(text) {
    this.checkAbort();
    
    if (!this.hasMathIntent(text)) {
      this.onProgress("status", "🤔 No mathematical intent detected");
      return null;
    }

    this.onProgress("status", "🧠 Converting natural language to mathematical expression...");
    
    const systemPrompt = `Convert this math question to a @calc command:

Examples:
"What is 25% of 200?" → @calc 200 * 0.25
"Calculate 45 times 8" → @calc 45 * 8  
"Find compound growth of $10000 at 7% for 10 years" → @calc compound(10000, 0.07, 10)
"Generate prime numbers up to 100" → @calc prime(100)

Question: "${text}"
@calc`;

    try {
      const provider = getProvider(this.provider);
      this.onProgress("ai", `🤖 Using ${this.provider} for conversion...`);
      
      const response = await provider.call({
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 100
      });

      this.checkAbort();

      let result = response.text?.trim();
      this.onProgress("debug", `🧠 Raw AI response: "${result}"`);
      
      // Clean up the response
      if (result) {
        const calcMatch = result.match(/@calc\s+(.+)/);
        if (calcMatch) {
          result = `@calc ${calcMatch[1].trim()}`;
        } else if (!result.startsWith("@calc")) {
          result = `@calc ${result}`;
        }
        
        // Handle date calculations
        const currentYear = new Date().getFullYear();
        result = result.replace(/current_year/g, currentYear.toString());
        result = result.replace(/(\d{4})\s*to\s*(\d{4})/g, (match, start, end) => {
          return (parseInt(end) - parseInt(start)).toString();
        });
        
        result = result.replace(/\n.*$/s, '').replace(/["""]/g, '').trim();
      }
      
      this.onProgress("debug", `📐 Cleaned result: "${result}"`);
      
      if (!result || result === "@calc" || result.includes("NO_MATH")) {
        return null;
      }

      return {
        success: true,
        originalText: text,
        calcExpression: result,
        expression: result.replace('@calc ', '')
      };

    } catch (error) {
      this.onProgress("error", `⚠️ AI conversion failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate code for missing functions
   */
  async generateMissingFunction(functionName, context) {
    this.checkAbort();
    
    this.onProgress("status", `🛠️ Function '${functionName}' not found. Generating custom implementation...`);
    
    const codePrompt = `Write a JavaScript function called '${functionName}' for use in mathematical calculations.

Context: ${context}

Requirements:
1. Write ONLY the function implementation
2. Make it efficient and mathematically correct
3. Handle edge cases appropriately
4. Return the result directly

Examples:
- prime(n) should return array of prime numbers up to n
- fibonacci(n) should return the nth fibonacci number or sequence
- factorial(n) should return n!

Function name: ${functionName}
Generate the JavaScript function:`;

    try {
      const provider = getProvider(this.fallbackProvider);
      this.onProgress("ai", `🤖 Using ${this.fallbackProvider} to generate ${functionName} function...`);
      
      const response = await provider.call({
        messages: [{ role: "user", content: codePrompt }],
        temperature: 0.2,
        max_tokens: 500
      });

      this.checkAbort();

      let code = response.text?.trim();
      this.onProgress("debug", `💻 Generated code:\n${code}`);
      
      return code;

    } catch (error) {
      this.onProgress("error", `❌ Code generation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create and execute dynamic JIT program
   */
  async executeDynamicProgram(expression, missingFunctions, functionCode) {
    this.checkAbort();
    
    this.onProgress("status", "🔨 Creating dynamic calculation program...");
    
    // Generate dynamic JIT program
    const programCode = `
// Dynamic JIT Calculator - Generated by C9AI Enhanced Math Processor
const vm = require('vm');

try {
  // Create execution context with all standard functions
  const context = {
    // Core Math functions
    Math: Math,
    sqrt: Math.sqrt,
    pow: Math.pow,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    log: Math.log,
    log10: Math.log10,
    log2: Math.log2,
    exp: Math.exp,
    PI: Math.PI,
    E: Math.E,
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    max: Math.max,
    min: Math.min,
    random: Math.random,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    pi: Math.PI,
    e: Math.E,
    
    // Statistics functions
    sum: (...args) => args.reduce((a, b) => a + b, 0),
    mean: (...args) => args.reduce((a, b) => a + b, 0) / args.length,
    median: (...args) => {
      const sorted = args.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    },
    std: (...args) => {
      const avg = args.reduce((a, b) => a + b, 0) / args.length;
      const variance = args.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / args.length;
      return Math.sqrt(variance);
    },
    
    // Financial functions
    pv: (rate, nper, pmt, fv = 0) => {
      if (rate === 0) return -(pmt * nper + fv);
      return -(pmt * (1 - Math.pow(1 + rate, -nper)) / rate + fv * Math.pow(1 + rate, -nper));
    },
    fv: (rate, nper, pmt, pv = 0) => {
      if (rate === 0) return -(pv + pmt * nper);
      return -(pv * Math.pow(1 + rate, nper) + pmt * (Math.pow(1 + rate, nper) - 1) / rate);
    },
    npv: (rate, ...values) => {
      // Net Present Value - Excel standard: NPV(rate, value1, value2, ...)
      // Also accepts: NPV(rate, [value1, value2, ...])
      let cashFlows;
      
      if (values.length === 1 && Array.isArray(values[0])) {
        // Called as npv(rate, [array])
        cashFlows = values[0];
      } else {
        // Called as npv(rate, val1, val2, val3, ...)
        cashFlows = values;
      }
      
      if (!Array.isArray(cashFlows) || cashFlows.length === 0) {
        throw new Error('NPV requires cash flow values');
      }
      
      return cashFlows.reduce((acc, value, index) => acc + value / Math.pow(1 + rate, index), 0);
    },
    irr: (values, guess = 0.1) => {
      let rate = guess;
      for (let i = 0; i < 100; i++) {
        const npvRate = values.reduce((acc, value, index) => acc + value / Math.pow(1 + rate, index), 0);
        const derivRate = values.reduce((acc, value, index) => acc - index * value / Math.pow(1 + rate, index + 1), 0);
        const newRate = rate - npvRate / derivRate;
        if (Math.abs(newRate - rate) < 0.0001) return newRate;
        rate = newRate;
      }
      return rate;
    },
    cagr: (beginning, ending, periods) => Math.pow(ending / beginning, 1 / periods) - 1,
    compound: (principal, rate, periods) => principal * Math.pow(1 + rate, periods),
    
    // Dynamic functions
    ${functionCode}
    
    // Result storage
    result: undefined
  };
  
  // Add case-insensitive aliases for all functions
  const functionNames = Object.keys(context).filter(key => typeof context[key] === 'function');
  functionNames.forEach(name => {
    // Add uppercase version
    const upperName = name.toUpperCase();
    if (!context[upperName]) {
      context[upperName] = context[name];
    }
    
    // Add title case version for common functions
    const titleName = name.charAt(0).toUpperCase() + name.slice(1);
    if (!context[titleName]) {
      context[titleName] = context[name];
    }
  });
  
  // Make context safe for execution
  vm.createContext(context);
  
  // Execute expression
  const expression = ${JSON.stringify(expression)};
  const finalExpression = 'result = ' + expression;
  
  console.log('Executing:', finalExpression);
  
  vm.runInContext(finalExpression, context, {
    timeout: 30000,
    displayErrors: true
  });
  
  if (context.result === undefined || context.result === null) {
    throw new Error('Expression did not produce a result');
  }
  
  if (typeof context.result === 'number' && !isFinite(context.result)) {
    throw new Error('Result is not a finite number');
  }
  
  console.log('Success:', JSON.stringify({
    success: true,
    result: context.result,
    type: typeof context.result
  }));
  
} catch (error) {
  console.error('Error:', JSON.stringify({
    success: false,
    error: error.message,
    stack: error.stack
  }));
  process.exit(1);
}`;

    // Write and execute the dynamic program
    const tempDir = path.join(require("node:os").tmpdir(), 'c9ai-dynamic');
    const filename = `dynamic_calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.js`;
    const filepath = path.join(tempDir, filename);
    
    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    this.onProgress("status", "💾 Writing dynamic program to disk...");
    fs.writeFileSync(filepath, programCode);
    
    this.checkAbort();
    
    this.onProgress("status", "🚀 Executing dynamic calculation...");
    
    try {
      const { stdout, stderr } = await execAsync(`node "${filepath}"`, {
        timeout: 30000
      });
      
      this.checkAbort();
      
      // Clean up
      fs.unlinkSync(filepath);
      
      if (stderr) {
        this.onProgress("debug", `stderr: ${stderr}`);
      }
      
      // Parse result
      const lines = stdout.trim().split('\n');
      const resultLine = lines.find(line => line.startsWith('Success:'));
      
      if (resultLine) {
        const result = JSON.parse(resultLine.substring('Success:'.length).trim());
        this.onProgress("success", `✅ Calculation completed successfully`);
        return result;
      } else {
        throw new Error('No result found in output');
      }
      
    } catch (error) {
      // Clean up on error
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      
      this.onProgress("error", `❌ Execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Main processing function with full transparency
   */
  async process(text) {
    this.reset();
    
    this.onProgress("start", `🔍 Processing: "${text}"`);
    
    try {
      // Step 1: Try to convert to @calc
      this.onProgress("phase", "Phase 1: Natural Language Analysis");
      const conversion = await this.convertToCalc(text);
      
      if (!conversion) {
        this.onProgress("status", "❌ Not a mathematical query - passing to general AI");
        return { converted: false, text: text, reason: "Not mathematical" };
      }
      
      this.onProgress("success", `✅ Converted to: ${conversion.calcExpression}`);
      
      // Step 2: Validate available functions
      this.onProgress("phase", "Phase 2: Function Validation");
      const validation = this.validateFunctions(conversion.expression);
      
      if (validation.isValid) {
        this.onProgress("success", `✅ All functions available: [${validation.usedFunctions.join(', ')}]`);
        
        // Execute with standard JIT
        this.onProgress("phase", "Phase 3: Standard Calculation");
        this.onProgress("status", "🔢 Executing with built-in functions...");
        
        const result = await jitTool.execute({
          type: 'calc',
          expression: conversion.expression
        });
        
        this.onProgress("success", `✅ Result: ${result.result}`);
        
        return {
          converted: true,
          calcExpression: conversion.calcExpression,
          result: result.result,
          method: "standard",
          functions: validation.usedFunctions
        };
        
      } else {
        // Step 3: Handle missing functions
        this.onProgress("warning", `⚠️ Missing functions: [${validation.unavailableFunctions.join(', ')}]`);
        this.onProgress("phase", "Phase 3: Dynamic Function Generation");
        
        // Ask user permission
        const permission = await this.onUserInput(
          `Function '${validation.unavailableFunctions[0]}' not found. Generate and execute custom code?`
        );
        
        this.checkAbort();
        
        if (!permission) {
          this.onProgress("status", "❌ User declined code generation");
          return { converted: false, text: text, reason: "User declined dynamic execution" };
        }
        
        // Generate missing functions
        let functionCode = '';
        for (const funcName of validation.unavailableFunctions) {
          this.checkAbort();
          const code = await this.generateMissingFunction(funcName, text);
          functionCode += code + '\n\n';
        }
        
        this.onProgress("phase", "Phase 4: Dynamic Execution");
        
        // Execute dynamic program
        const result = await this.executeDynamicProgram(conversion.expression, validation.unavailableFunctions, functionCode);
        
        this.onProgress("success", `🎉 Dynamic calculation completed!`);
        
        return {
          converted: true,
          calcExpression: conversion.calcExpression,
          result: result.result,
          method: "dynamic",
          functions: validation.usedFunctions,
          generatedFunctions: validation.unavailableFunctions,
          generatedCode: functionCode
        };
      }
      
    } catch (error) {
      if (error.message === "Operation aborted by user") {
        return { converted: false, text: text, reason: "Aborted by user" };
      }
      
      this.onProgress("error", `❌ Processing failed: ${error.message}`);
      return { converted: false, text: text, reason: error.message };
    }
  }
}

module.exports = { EnhancedMathProcessor };