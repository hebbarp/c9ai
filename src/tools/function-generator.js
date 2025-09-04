"use strict";
/**
 * Function Generator
 * Generates JavaScript functions dynamically using AI (local first, cloud fallback)
 */

const { getProvider } = require("../providers");
// NOTE: XML-Lisp system archived - will be replaced with BASIC interpreter
// const { XMLLispTranspiler } = require("./xml-lisp-transpiler");
const vm = require("vm");

class FunctionGenerator {
  constructor(options = {}) {
    this.localProvider = options.localProvider || "llamacpp";
    this.cloudProvider = options.cloudProvider || "openai";
  }

  /**
   * Generate an XML-Lisp function using AI, then transpile to JavaScript
   */
  async generateFunction(functionName, parameters, context = {}) {
    // First try to generate XML-Lisp representation
    const xmlResult = await this.generateXMLFunction(functionName, parameters, context);
    
    if (xmlResult.success) {
      // Transpile XML to JavaScript
      const jsResult = await this.transpileXMLToJS(xmlResult.xml, functionName);

      if (jsResult.success) {
        return {
          success: true,
          xml: xmlResult.xml,
          javascript: jsResult.javascript,
          source: xmlResult.provider,
          transpiled: true
        };
      }

      // If XML transpilation failed (transpiler not available), fall back to direct JS generation
      console.log(`⚠️ XML transpilation failed; falling back to direct JavaScript generation for ${functionName}`);
      const jsFallback = await this.generateJavaScriptFunction(functionName, parameters, context);
      if (jsFallback.success) {
        return {
          success: true,
          xml: xmlResult.xml,
          javascript: jsFallback.javascript,
          source: jsFallback.provider || xmlResult.provider,
          transpiled: false,
          format: 'javascript'
        };
      }

      // As a last resort, still return the XML so callers can handle it
      return {
        success: true,
        xml: xmlResult.xml,
        javascript: undefined,
        source: xmlResult.provider,
        transpiled: false
      };
    }
    
    // Fallback to direct JavaScript generation
    return await this.generateJavaScriptFunction(functionName, parameters, context);
  }

  /**
   * Generate XML-Lisp function representation
   */
  async generateXMLFunction(functionName, parameters, context = {}) {
    const systemPrompt = `Generate an XML-Lisp function for '${functionName}' with parameters: ${parameters}

Requirements:
- Return ONLY the XML function definition, no explanations
- Use XML-Lisp format with <function>, <params>, <body> structure
- Support mathematical operations: <add>, <subtract>, <multiply>, <divide>, <power>
- Use <ref> for parameter references and <number> for constants
- Handle conditional logic with <if>, <condition>, <then>, <else>
- Optimize for mathematical accuracy and business logic

XML-Lisp Schema:
<function name="functionName">
  <params>
    <param name="param1" type="number" description="..."/>
    <param name="param2" type="number" description="..."/>
  </params>
  <body>
    <operation>
      <ref>param1</ref>
      <ref>param2</ref>
    </operation>
  </body>
</function>

Business Function Examples:

compound_interest: 
<function name="compound_interest">
  <params>
    <param name="principal" type="number" description="Initial investment"/>
    <param name="rate" type="number" description="Annual interest rate (decimal)"/>
    <param name="periods" type="number" description="Number of compounding periods"/>
  </params>
  <body>
    <multiply>
      <ref>principal</ref>
      <power>
        <add><number>1</number><ref>rate</ref></add>
        <ref>periods</ref>
      </power>
    </multiply>
  </body>
</function>

customer_lifetime_value:
<function name="customer_lifetime_value">
  <params>
    <param name="monthly_revenue" type="number" description="Average monthly revenue per customer"/>
    <param name="lifespan_months" type="number" description="Expected customer lifespan in months"/>
    <param name="churn_rate" type="number" description="Monthly churn rate (decimal)"/>
  </params>
  <body>
    <multiply>
      <multiply><ref>monthly_revenue</ref><ref>lifespan_months</ref></multiply>
      <divide>
        <number>1</number>
        <add><number>1</number><ref>churn_rate</ref></add>
      </divide>
    </multiply>
  </body>
</function>

break_even_point:
<function name="break_even_point">
  <params>
    <param name="fixed_costs" type="number" description="Total fixed costs"/>
    <param name="price_per_unit" type="number" description="Selling price per unit"/>
    <param name="variable_cost_per_unit" type="number" description="Variable cost per unit"/>
  </params>
  <body>
    <divide>
      <ref>fixed_costs</ref>
      <subtract>
        <ref>price_per_unit</ref>
        <ref>variable_cost_per_unit</ref>
      </subtract>
    </divide>
  </body>
</function>

roi_calculation:
<function name="roi_calculation">
  <params>
    <param name="gain" type="number" description="Investment gain or return"/>
    <param name="cost" type="number" description="Cost of investment"/>
  </params>
  <body>
    <multiply>
      <divide>
        <subtract><ref>gain</ref><ref>cost</ref></subtract>
        <ref>cost</ref>
      </divide>
      <number>100</number>
    </multiply>
  </body>
</function>

Generate the ${functionName} function:`;

    // Try cloud AI for XML-Lisp generation (skip local for XML complexity)
    try {
      console.log(`🌐 Using cloud AI (${this.cloudProvider}) to generate XML-Lisp for ${functionName}`);
      const cloudProvider = getProvider(this.cloudProvider);
      
      const response = await cloudProvider.call({
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      const xmlCode = this.cleanXMLCode(response.text);
      if (this.validateXMLFunction(xmlCode, functionName)) {
        console.log(`✅ Cloud AI successfully generated XML-Lisp for ${functionName}`);
        return {
          success: true,
          xml: xmlCode,
          source: 'cloud',
          provider: this.cloudProvider
        };
      } else {
        console.log(`❌ Cloud AI generated invalid XML-Lisp for ${functionName}`);
        return {
          success: false,
          error: 'Invalid XML-Lisp function generated',
          xml: xmlCode
        };
      }
    } catch (cloudError) {
      console.log(`⚠️ Cloud AI failed to generate ${functionName}: ${cloudError.message}`);
    }

    // Fallback to cloud AI
    try {
      console.log(`🌐 Trying cloud AI (${this.cloudProvider}) to generate ${functionName} function`);
      const cloudProvider = getProvider(this.cloudProvider);
      
      const response = await cloudProvider.call({
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      const code = this.cleanFunctionCode(response.text);
      if (this.validateFunction(code, functionName)) {
        console.log(`✅ Cloud AI successfully generated ${functionName} function`);
        return {
          success: true,
          code,
          source: 'cloud',
          provider: this.cloudProvider
        };
      } else {
        console.log(`❌ Cloud AI generated invalid code for ${functionName}`);
      }
    } catch (cloudError) {
      console.log(`❌ Cloud AI failed to generate ${functionName}: ${cloudError.message}`);
    }

    return {
      success: false,
      error: `Cloud AI failed to generate XML-Lisp for ${functionName} function`
    };
  }

  /**
   * Fallback to direct JavaScript generation (legacy support)
   */
  async generateJavaScriptFunction(functionName, parameters, context = {}) {
    const systemPrompt = `Generate a JavaScript function called '${functionName}' that takes parameters: ${parameters}

Requirements:
- Return ONLY the function code, no explanations
- Use proper JavaScript syntax
- Handle edge cases (negative numbers, zero, etc.)
- Optimize for mathematical accuracy
- Function should be pure (no side effects)

Generate the ${functionName} function:`;

    try {
      console.log(`🌐 Using cloud AI for direct JavaScript generation of ${functionName}`);
      const cloudProvider = getProvider(this.cloudProvider);
      
      const response = await cloudProvider.call({
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 300
      });

      const code = this.cleanFunctionCode(response.text);
      if (this.validateFunction(code, functionName)) {
        return {
          success: true,
          javascript: code,
          source: 'cloud',
          provider: this.cloudProvider,
          format: 'javascript'
        };
      }
    } catch (error) {
      console.log(`❌ JavaScript generation failed: ${error.message}`);
    }

    return {
      success: false,
      error: `Failed to generate ${functionName} function in any format`
    };
  }

  /**
   * Clean and extract XML function from AI response
   */
  cleanXMLCode(text) {
    if (!text) return '';
    
    // Remove markdown code blocks
    let xml = text.replace(/```(?:xml)?\n?([\s\S]*?)\n?```/g, '$1');
    
    // Extract function definition
    const functionMatch = xml.match(/<function[\s\S]*?<\/function>/);
    if (functionMatch) {
      xml = functionMatch[0];
    }
    
    // Clean up whitespace
    xml = xml.trim();
    
    return xml;
  }

  /**
   * Clean and extract function code from AI response (legacy)
   */
  cleanFunctionCode(text) {
    if (!text) return '';
    
    // Remove markdown code blocks
    let code = text.replace(/```(?:javascript|js)?\n?([\s\S]*?)\n?```/g, '$1');
    
    // Extract function definition
    const functionMatch = code.match(/function\s+\w+\s*\([^)]*\)\s*{[\s\S]*?}/);
    if (functionMatch) {
      code = functionMatch[0];
    }
    
    // Clean up whitespace and ensure proper formatting
    code = code.trim();
    
    return code;
  }

  /**
   * Validate XML-Lisp function structure
   */
  validateXMLFunction(xml, expectedFunctionName) {
    if (!xml) return false;
    
    try {
      // Basic XML structure validation
      if (!xml.includes('<function') || !xml.includes('</function>')) {
        return false;
      }
      
      // Check for required elements
      const hasParams = xml.includes('<params>') && xml.includes('</params>');
      const hasBody = xml.includes('<body>') && xml.includes('</body>');
      const hasCorrectName = xml.includes(`name="${expectedFunctionName}"`);
      
      return hasParams && hasBody && hasCorrectName;
    } catch (error) {
      console.log(`XML validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Transpile XML-Lisp function to executable JavaScript
   */
  async transpileXMLToJS(xml, functionName) {
    try {
      console.log(`🔄 Transpiling XML-Lisp to JavaScript for ${functionName}`);
      
      // Create a simple XML→JS transpiler
      const transpiler = new XMLLispTranspiler();
      
      // Occasionally cleanup cache (1% chance)
      if (Math.random() < 0.01) {
        transpiler.cleanupCache();
      }
      
      const javascript = transpiler.transpile(xml);
      
      // Validate the transpiled JavaScript
      if (this.validateFunction(javascript, functionName)) {
        return {
          success: true,
          javascript: javascript,
          transpiled: true
        };
      } else {
        return {
          success: false,
          error: 'Transpiled JavaScript validation failed',
          javascript: javascript
        };
      }
    } catch (error) {
      console.log(`❌ XML transpilation failed: ${error.message}`);
      return {
        success: false,
        error: `Transpilation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate that the generated code is a proper JavaScript function
   */
  validateFunction(code, expectedFunctionName) {
    if (!code) return false;
    
    try {
      // Create a safe VM context for validation
      const context = {};
      vm.createContext(context);
      
      // Try to evaluate the function
      vm.runInContext(code, context, { timeout: 1000 });
      
      // Check if function exists and is callable
      if (typeof context[expectedFunctionName] === 'function') {
        return true;
      }
      
      return false;
    } catch (error) {
      console.log(`Function validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Execute the generated function with parameters
   */
  async executeFunction(code, functionName, parameters) {
    try {
      const context = {
        Math: Math,
        // Add other safe globals if needed
      };
      vm.createContext(context);
      
      // Add the function to context
      vm.runInContext(code, context, { timeout: 5000 });
      
      // Execute the function
      const expression = `${functionName}(${parameters})`;
      const result = vm.runInContext(expression, context, { timeout: 5000 });
      
      return {
        success: true,
        result,
        expression
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { FunctionGenerator };
