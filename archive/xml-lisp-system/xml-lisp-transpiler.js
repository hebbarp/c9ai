"use strict";
/**
 * XML-Lisp Transpiler
 * Converts XML-Lisp function definitions to executable JavaScript with caching
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

class XMLLispTranspiler {
  constructor() {
    this.cacheDir = path.join(os.homedir(), '.c9ai', 'function-cache');
    this.ensureCacheDir();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  generateCacheKey(xml) {
    return crypto.createHash('md5').update(xml.trim()).digest('hex');
  }

  getCached(xml) {
    try {
      const cacheKey = this.generateCacheKey(xml);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.js`);
      
      if (fs.existsSync(cachePath)) {
        const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
        if (ageHours < 24) {
          console.log(`🎯 Cache hit for transpiled function: ${cached.functionName}`);
          return cached.javascript;
        }
      }
    } catch (error) {
      console.log(`Cache read failed: ${error.message}`);
    }
    return null;
  }

  setCached(xml, javascript, functionName) {
    try {
      const cacheKey = this.generateCacheKey(xml);
      const cachePath = path.join(this.cacheDir, `${cacheKey}.js`);
      
      const cacheData = {
        xml: xml,
        javascript: javascript,
        functionName: functionName,
        timestamp: Date.now(),
        accessCount: 1
      };
      
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cached transpiled function: ${functionName}`);
    } catch (error) {
      console.log(`Cache write failed: ${error.message}`);
    }
  }

  cleanupCache(maxAgeHours = 24 * 7) {
    try {
      const files = fs.readdirSync(this.cacheDir);
      let cleanedCount = 0;
      
      files.forEach(file => {
        if (file.endsWith('.js')) {
          const filePath = path.join(this.cacheDir, file);
          try {
            const cached = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const ageHours = (Date.now() - cached.timestamp) / (1000 * 60 * 60);
            
            if (ageHours > maxAgeHours) {
              fs.unlinkSync(filePath);
              cleanedCount++;
            }
          } catch (error) {
            fs.unlinkSync(filePath);
            cleanedCount++;
          }
        }
      });
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old cache entries`);
      }
    } catch (error) {
      console.log(`Cache cleanup failed: ${error.message}`);
    }
  }

  /**
   * Main transpilation method
   */
  transpile(xml) {
    try {
      const cached = this.getCached(xml);
      if (cached) {
        return cached;
      }

      const functionName = this.extractFunctionName(xml);
      const params = this.extractParameters(xml);
      const bodyXml = this.extractBody(xml);
      
      const bodyJs = this.processExpression(bodyXml);
      
      const javascript = `function ${functionName}(${params.join(', ')}) {
  return ${bodyJs};
}`;
      
      this.setCached(xml, javascript, functionName);
      return javascript;
    } catch (error) {
      throw new Error(`XML transpilation failed: ${error.message}`);
    }
  }

  extractFunctionName(xml) {
    const match = xml.match(/name="([^"]+)"/);
    return match ? match[1] : 'unknown';
  }

  extractParameters(xml) {
    const params = [];
    const paramMatches = xml.matchAll(/<param name="([^"]+)"/g);
    for (const match of paramMatches) {
      params.push(match[1]);
    }
    return params;
  }

  extractBody(xml) {
    const match = xml.match(/<body>([\s\S]*?)<\/body>/);
    return match ? match[1].trim() : '';
  }

  /**
   * Process XML expression recursively
   */
  processExpression(xml) {
    xml = xml.trim();
    
    // Convert the XML to JavaScript recursively
    return this.processNode(xml);
  }

  processNode(node) {
    node = node.trim();
    
    // Base cases: leaf nodes
    const refMatch = node.match(/^<ref>([^<]+)<\/ref>$/);
    if (refMatch) {
      return refMatch[1];
    }
    
    const numberMatch = node.match(/^<number>([^<]+)<\/number>$/);
    if (numberMatch) {
      return numberMatch[1];
    }
    
    // Operation nodes
    const operationMatch = node.match(/^<(\w+)>([\s\S]*)<\/\1>$/);
    if (operationMatch) {
      const [, operation, content] = operationMatch;
      const children = this.parseChildren(content);
      const jsChildren = children.map(child => this.processNode(child));
      
      switch (operation) {
        case 'add':
          return `(${jsChildren.join(' + ')})`;
        case 'subtract':
          if (jsChildren.length === 1) return `-${jsChildren[0]}`;
          return `(${jsChildren[0]} - ${jsChildren.slice(1).join(' - ')})`;
        case 'multiply':
          return `(${jsChildren.join(' * ')})`;
        case 'divide':
          if (jsChildren.length === 1) return `(1 / ${jsChildren[0]})`;
          return `(${jsChildren[0]} / ${jsChildren.slice(1).join(' / ')})`;
        case 'power':
          if (jsChildren.length === 2) {
            return `Math.pow(${jsChildren[0]}, ${jsChildren[1]})`;
          }
          break;
      }
    }
    
    // If we can't parse it, return as-is
    return node;
  }

  parseChildren(content) {
    const children = [];
    let depth = 0;
    let start = 0;
    
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '<') {
        if (content[i + 1] !== '/') {
          if (depth === 0) start = i;
          depth++;
        } else {
          depth--;
          if (depth === 0) {
            const child = content.substring(start, i + content.substring(i).indexOf('>') + 1);
            if (child.trim()) children.push(child.trim());
          }
        }
      }
    }
    
    return children;
  }

  getJSOperator(xmlOp) {
    const map = {
      'add': '+',
      'subtract': '-',
      'multiply': '*',
      'divide': '/'
    };
    return map[xmlOp] || xmlOp;
  }
}

module.exports = { XMLLispTranspiler };