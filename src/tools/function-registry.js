"use strict";
/**
 * Function Registry - File-based storage for user-defined functions
 * Uses .xmlp files for XML-Lisp source and .js files for transpiled code
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

class FunctionRegistry {
  constructor() {
    this.functionsDir = path.join(os.homedir(), '.c9ai', 'functions');
    this.registryPath = path.join(this.functionsDir, 'registry.json');
    this.ensureFunctionsDir();
    this.functions = this.loadRegistry();
  }

  /**
   * Ensure functions directory exists
   */
  ensureFunctionsDir() {
    if (!fs.existsSync(this.functionsDir)) {
      fs.mkdirSync(this.functionsDir, { recursive: true });
      console.log(`📁 Created functions directory: ${this.functionsDir}`);
    }
  }

  /**
   * Load function registry from disk
   */
  loadRegistry() {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        console.log(`📚 Loaded ${Object.keys(data).length} user-defined functions`);
        return data;
      }
    } catch (error) {
      console.log(`Failed to load function registry: ${error.message}`);
    }
    return {};
  }

  /**
   * Get file paths for a function
   */
  getFunctionPaths(name) {
    return {
      xmlp: path.join(this.functionsDir, `${name}.xmlp`),
      js: path.join(this.functionsDir, `${name}.js`),
      tempXmlp: path.join(this.functionsDir, `${name}.xmlp.tmp`),
      tempJs: path.join(this.functionsDir, `${name}.js.tmp`)
    };
  }

  /**
   * Save function registry to disk
   */
  saveRegistry() {
    try {
      fs.writeFileSync(this.registryPath, JSON.stringify(this.functions, null, 2));
      console.log(`💾 Saved ${Object.keys(this.functions).length} functions to registry`);
    } catch (error) {
      console.log(`Failed to save function registry: ${error.message}`);
    }
  }

  /**
   * Register a new function with atomic file operations
   */
  async registerFunction(name, javascript, xmlSource = null) {
    const paths = this.getFunctionPaths(name);
    
    try {
      // 1. Write XML-Lisp source to temp file
      if (xmlSource) {
        await fs.promises.writeFile(paths.tempXmlp, xmlSource, 'utf8');
      }
      
      // 2. Write JavaScript to temp file
      await fs.promises.writeFile(paths.tempJs, javascript, 'utf8');
      
      // 3. Test the JavaScript function (basic syntax check)
      try {
        const testCode = `${javascript}; if (typeof ${name} === 'function') console.log('OK'); else throw new Error('Not a function');`;
        require('vm').runInNewContext(testCode);
      } catch (testError) {
        throw new Error(`Function test failed: ${testError.message}`);
      }
      
      // 4. Atomic moves (rename is atomic on most filesystems)
      if (xmlSource) {
        await fs.promises.rename(paths.tempXmlp, paths.xmlp);
      }
      await fs.promises.rename(paths.tempJs, paths.js);
      
      // 5. Update registry metadata
      this.functions[name] = {
        created: this.functions[name]?.created || Date.now(),
        lastUsed: Date.now(),
        status: 'active'
      };
      
      this.saveRegistry();
      console.log(`✅ Registered function: ${name}`);
      
    } catch (error) {
      // Clean up temp files on failure
      try {
        if (fs.existsSync(paths.tempXmlp)) fs.unlinkSync(paths.tempXmlp);
        if (fs.existsSync(paths.tempJs)) fs.unlinkSync(paths.tempJs);
      } catch (cleanupError) {
        console.log(`Warning: Failed to clean up temp files: ${cleanupError.message}`);
      }
      
      console.log(`❌ Failed to register function ${name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a function's JavaScript code from file
   */
  getFunction(name) {
    if (!this.hasFunction(name)) {
      return null;
    }
    
    try {
      const paths = this.getFunctionPaths(name);
      const javascript = fs.readFileSync(paths.js, 'utf8');
      
      // Update last used timestamp
      this.functions[name].lastUsed = Date.now();
      this.saveRegistry();
      
      return javascript;
    } catch (error) {
      console.log(`Failed to read function ${name}: ${error.message}`);
      return null;
    }
  }

  /**
   * Get XML-Lisp source for a function
   */
  getXMLSource(name) {
    if (!this.hasFunction(name)) {
      return null;
    }
    
    try {
      const paths = this.getFunctionPaths(name);
      if (fs.existsSync(paths.xmlp)) {
        return fs.readFileSync(paths.xmlp, 'utf8');
      }
    } catch (error) {
      console.log(`Failed to read XML source for ${name}: ${error.message}`);
    }
    return null;
  }

  /**
   * Check if function exists
   */
  hasFunction(name) {
    return name in this.functions && this.functions[name].status === 'active';
  }

  /**
   * Get all registered function names
   */
  getFunctionNames() {
    return Object.keys(this.functions).filter(name => 
      this.functions[name].status === 'active'
    );
  }

  /**
   * Get injectable code for all functions
   */
  getInjectableCode() {
    let code = '';
    for (const name of this.getFunctionNames()) {
      const jsCode = this.getFunction(name);
      if (jsCode) {
        code += jsCode + '\n\n';
      }
    }
    return code;
  }

  /**
   * Get functions as context object assignments
   */
  getContextAssignments() {
    let code = '';
    for (const name of this.getFunctionNames()) {
      const jsCode = this.getFunction(name);
      if (jsCode) {
        // Convert function declaration to assignment
        const functionMatch = jsCode.match(/function\s+(\w+)\s*\(([^)]*)\)\s*\{([\s\S]*)\}/);
        if (functionMatch) {
          const [, funcName, params, body] = functionMatch;
          code += `    ${funcName}: (${params}) => {${body}},\n`;
        }
      }
    }
    return code;
  }

  /**
   * Get function metadata with file info
   */
  getFunctionInfo(name) {
    if (!this.hasFunction(name)) {
      return null;
    }

    const metadata = this.functions[name];
    const xmlSource = this.getXMLSource(name);
    const jsSource = this.getFunction(name);

    return {
      name,
      created: metadata.created,
      lastUsed: metadata.lastUsed,
      status: metadata.status,
      hasXMLSource: !!xmlSource,
      xmlSource,
      jsSource
    };
  }
}

// Global instance
const globalRegistry = new FunctionRegistry();

module.exports = { FunctionRegistry, globalRegistry };