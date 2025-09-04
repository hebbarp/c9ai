"use strict";
/**
 * Minimal BASIC Interpreter for @prog
 * Supports: LET, RETURN, basic arithmetic
 */

class BasicInterpreter {
  constructor() {
    this.variables = {};
  }

  /**
   * Execute BASIC program
   */
  execute(basicCode, inputs = {}) {
    try {
      this.variables = { ...inputs };
      const lines = basicCode.trim().split('\n').map(line => line.trim()).filter(line => line);
      
      let result = null;
      
      for (const line of lines) {
        result = this.executeLine(line);
        if (result !== null && result !== undefined) {
          return { success: true, result, variables: this.variables };
        }
      }
      
      return { success: true, result: result || "Program completed", variables: this.variables };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a single BASIC line
   */
  executeLine(line) {
    // Remove comments
    line = line.split("'")[0].trim();
    if (!line) return null;

    // LET statement: LET variable = expression
    if (line.toUpperCase().startsWith('LET ')) {
      return this.executeLet(line.substring(4));
    }
    
    // RETURN statement: RETURN expression
    if (line.toUpperCase().startsWith('RETURN ')) {
      return this.executeReturn(line.substring(7));
    }

    // Simple assignment without LET: variable = expression
    if (line.includes('=') && !line.includes('==')) {
      return this.executeLet(line);
    }

    throw new Error(`Unknown BASIC statement: ${line}`);
  }

  /**
   * Execute LET statement
   */
  executeLet(statement) {
    const parts = statement.split('=').map(p => p.trim());
    if (parts.length !== 2) {
      throw new Error(`Invalid LET statement: ${statement}`);
    }
    
    const variable = parts[0];
    const expression = parts[1];
    
    const value = this.evaluateExpression(expression);
    this.variables[variable] = value;
    
    return null; // LET doesn't return a value
  }

  /**
   * Execute RETURN statement  
   */
  executeReturn(expression) {
    return this.evaluateExpression(expression);
  }

  /**
   * Evaluate mathematical expression
   */
  evaluateExpression(expr) {
    try {
      // Clean up expression - trim whitespace
      expr = expr.trim();
      
      // Check for semicolons (not allowed in BASIC)
      if (expr.includes(';')) {
        throw new Error('Semicolons not allowed in BASIC. Use line breaks to separate statements.');
      }
      
      // Replace variables with their values
      let evaluatedExpr = expr;
      
      for (const [varName, value] of Object.entries(this.variables)) {
        const regex = new RegExp('\\b' + varName + '\\b', 'g');
        evaluatedExpr = evaluatedExpr.replace(regex, value);
      }
      
      // Basic security: only allow numbers, operators, and common math functions
      if (!/^[0-9+\-*/^.() \s]+$/.test(evaluatedExpr)) {
        throw new Error(`Unsafe expression: ${expr}`);
      }
      
      // Replace ^ with ** for JavaScript exponentiation
      evaluatedExpr = evaluatedExpr.replace(/\^/g, '**');
      
      // Evaluate using Function constructor (safer than eval)
      const result = new Function('return ' + evaluatedExpr)();
      
      if (isNaN(result) && typeof result !== 'number') {
        throw new Error(`Expression did not evaluate to a number: ${expr}`);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Error evaluating expression "${expr}": ${error.message}`);
    }
  }
}

module.exports = { BasicInterpreter };