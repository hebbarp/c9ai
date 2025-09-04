"use strict";
/**
 * Dynamic JIT Executor
 * Handles function generation and execution
 */

const { FunctionGenerator } = require("./function-generator");
const jitExecutor = require("./jit-executor");

class DynamicJITExecutor {
  constructor() {
    this.functionGenerator = new FunctionGenerator();
  }

  async execute(args) {
    const { type, expression } = args;
    
    // Check if this is a special function generation prompt
    if (expression && expression.startsWith('jit:generateFunction:')) {
      const parts = expression.split(':');
      if (parts.length >= 5) {
        const functionName = parts[2];
        const parameters = parts[3];
        const confirmed = parts[4] === 'confirmed';
        
        if (confirmed) {
          return await this.handleFunctionGeneration(functionName, parameters);
        }
      }
    }

    if (type === 'calc') {
      // Normal calculation - try the regular JIT first
      try {
        const result = await jitExecutor.execute(args);
        
        // Check if the result indicates an unknown function
        if (typeof result === 'string') {
          try {
            const parsed = JSON.parse(result);
            if (parsed.error === "unknown_function") {
              // Return the unknown function error to trigger frontend dialog
              return result;
            }
          } catch (e) {
            // Not JSON, continue with normal result
          }
        }
        
        return result;
      } catch (error) {
        // If JIT execution fails, check if it's an unknown function
        if (error.message && error.message.includes('is not defined')) {
          const match = error.message.match(/(\w+) is not defined/);
          if (match) {
            const functionName = match[1];
            const funcCallMatch = expression.match(new RegExp(functionName + '\\s*\\(([^)]*)\\)'));
            const parameters = funcCallMatch ? funcCallMatch[1] : '';
            
            return JSON.stringify({
              success: false,
              error: "unknown_function",
              functionName: functionName,
              parameters: parameters,
              message: "Function '" + functionName + "' not found. Would you like me to generate it?",
              expression: expression
            });
          }
        }
        throw error;
      }
    }

    if (type === 'generateFunction') {
      const { functionName, parameters, userConfirmed } = args;
      
      if (!userConfirmed) {
        return JSON.stringify({
          success: false,
          error: "user_confirmation_required",
          message: `Function '${functionName}' not found. Generate it?`,
          functionName,
          parameters
        });
      }
      
      return await this.handleFunctionGeneration(functionName, parameters);
    }

    return JSON.stringify({
      success: false,
      error: "unknown_type",
      message: `Unknown execution type: ${type}`
    });
  }

  async handleFunctionGeneration(functionName, parameters) {
    // Generate the function
    console.log(`🔧 Generating function: ${functionName}(${parameters})`);
    const generation = await this.functionGenerator.generateFunction(functionName, parameters);
    
    if (!generation.success) {
      return JSON.stringify({
        success: false,
        error: "generation_failed",
        message: generation.error
      });
    }

    // Execute the generated function with the original parameters
    console.log(`⚡ Executing generated function: ${generation.code}`);
    const execution = await this.functionGenerator.executeFunction(
      generation.code, 
      functionName, 
      parameters
    );

    if (!execution.success) {
      return JSON.stringify({
        success: false,
        error: "execution_failed",
        message: execution.error,
        generatedCode: generation.code
      });
    }

    return JSON.stringify({
      success: true,
      result: execution.result,
      formatted: typeof execution.result === 'number' 
        ? execution.result.toLocaleString(undefined, { maximumFractionDigits: 10 })
        : String(execution.result),
      expression: execution.expression,
      generatedFunction: {
        name: functionName,
        code: generation.code,
        source: generation.source,
        provider: generation.provider
      }
    });
  }
}

module.exports = new DynamicJITExecutor();