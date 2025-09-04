"use strict";

/**
 * CloudAIBridge - Parses cloud AI responses for executable C9AI actions
 * and manages the handshake between cloud intelligence and local execution
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

class CloudAIBridge {
  constructor() {
    this.actionQueue = [];
    this.executionHistory = [];
    this.supportedSigils = new Set([
      'calc', 'analyze', 'system', 'count', 'read', 'write', 'email', 
      'search', 'github-fetch', 'github-list', 'github-run',
      'gdrive-fetch', 'gdrive-list', 'gdrive-run', 'file', 'process',
      'todo', 'task', 'run', 'shell', 'whatsapp', 'sms', 'compile',
      'tex', 'latex', 'pdf', 'image', 'video', 'convert', 'resize'
    ]);
  }

  /**
   * Parse cloud AI response for executable actions
   */
  parseCloudResponse(response) {
    try {
      // Handle both string responses and objects
      const responseText = typeof response === 'string' ? response : 
                          (response.text || response.message || JSON.stringify(response));

      // Look for JSON blocks in various formats
      const jsonPatterns = [
        /```json\s*(\{[\s\S]*?\})\s*```/gi,
        /```\s*(\{[\s\S]*?\})\s*```/gi,
        /(\{[\s\S]*?"actions"[\s\S]*?\})/gi,
        /(\{[\s\S]*?"message"[\s\S]*?"actions"[\s\S]*?\})/gi
      ];

      for (const pattern of jsonPatterns) {
        const matches = Array.from(responseText.matchAll(pattern));
        
        for (const match of matches) {
          try {
            const jsonStr = match[1];
            const parsed = JSON.parse(jsonStr);
            
            // Validate it's a C9AI action format
            if (this.isValidActionFormat(parsed)) {
              return {
                success: true,
                originalResponse: responseText,
                parsedActions: parsed,
                extractedFrom: 'json_block'
              };
            }
          } catch (e) {
            continue; // Try next match
          }
        }
      }

      // Look for inline sigils in the response text
      const inlineActions = this.extractInlineSigils(responseText);
      if (inlineActions.length > 0) {
        return {
          success: true,
          originalResponse: responseText,
          parsedActions: {
            message: responseText,
            actions: inlineActions,
            execution_mode: 'sequential',
            requires_confirmation: true
          },
          extractedFrom: 'inline_sigils'
        };
      }

      return {
        success: false,
        originalResponse: responseText,
        error: 'No executable actions found in response'
      };

    } catch (error) {
      return {
        success: false,
        error: `Failed to parse response: ${error.message}`,
        originalResponse: response
      };
    }
  }

  /**
   * Check if parsed JSON is valid C9AI action format
   */
  isValidActionFormat(obj) {
    if (!obj || typeof obj !== 'object') return false;
    
    // Must have actions array
    if (!Array.isArray(obj.actions)) return false;
    
    // Validate each action
    for (const action of obj.actions) {
      if (!action.sigil || !action.sigil.startsWith('@')) return false;
      if (!action.id || !action.description) return false;
      
      const sigilName = action.sigil.slice(1); // Remove @
      if (!this.supportedSigils.has(sigilName)) return false;
    }

    return true;
  }

  /**
   * Extract inline sigils from response text
   */
  extractInlineSigils(text) {
    const actions = [];
    const sigilPattern = /@(\w+(?:-\w+)*)\s+([^\n\r]*)/gi;
    let match;
    let actionId = 1;

    while ((match = sigilPattern.exec(text)) !== null) {
      const sigilName = match[1];
      const args = match[2].trim();

      if (this.supportedSigils.has(sigilName)) {
        actions.push({
          id: `inline-${actionId++}`,
          sigil: `@${sigilName}`,
          args: args,
          description: `Execute ${sigilName} command`,
          risk_level: this.assessSigilRisk(sigilName),
          estimated_time: this.estimateSigilTime(sigilName),
          source: 'inline_extraction'
        });
      }
    }

    return actions;
  }

  /**
   * Prepare actions for execution - validation and planning
   */
  async prepareActions(actions) {
    const validationResults = [];
    const dependencies = [];
    let totalEstimatedTime = 0;

    for (const action of actions) {
      // Validate action
      const validation = await this.validateAction(action);
      validationResults.push(validation);

      // Check dependencies
      const deps = this.findActionDependencies(action, actions);
      if (deps.length > 0) {
        dependencies.push({ actionId: action.id, dependsOn: deps });
      }

      // Add to estimated time
      totalEstimatedTime += this.parseTime(action.estimated_time || '10s');
    }

    // Build execution plan
    const executionPlan = {
      totalActions: actions.length,
      validActions: validationResults.filter(v => v.valid).length,
      totalEstimatedTime: `${totalEstimatedTime}s`,
      executionOrder: this.planExecutionOrder(actions, dependencies),
      riskAssessment: this.assessOverallRisk(actions),
      dependencies: dependencies,
      validationResults: validationResults
    };

    return executionPlan;
  }

  /**
   * Validate individual action
   */
  async validateAction(action) {
    const result = {
      actionId: action.id,
      valid: true,
      warnings: [],
      errors: [],
      requiredFiles: [],
      permissions: []
    };

    try {
      // Check sigil exists
      const sigilName = action.sigil.slice(1);
      if (!this.supportedSigils.has(sigilName)) {
        result.valid = false;
        result.errors.push(`Unknown sigil: ${action.sigil}`);
        return result;
      }

      // Validate arguments based on sigil
      const argValidation = this.validateSigilArgs(sigilName, action.args);
      if (!argValidation.valid) {
        result.valid = false;
        result.errors.push(...argValidation.errors);
      }

      result.warnings.push(...argValidation.warnings);

      // Check file permissions for file operations
      if (['read', 'write', 'analyze', 'count', 'file', 'process'].includes(sigilName)) {
        const filePath = this.extractFilePath(action.args);
        if (filePath) {
          result.requiredFiles.push(filePath);
          
          if (sigilName === 'read' || sigilName === 'analyze' || sigilName === 'count') {
            if (!fs.existsSync(filePath)) {
              result.warnings.push(`File may not exist: ${filePath}`);
            }
          }
          
          if (sigilName === 'write') {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              result.warnings.push(`Directory may not exist: ${dir}`);
            }
          }
        }
      }

      // Check network permissions for external operations
      if (['email', 'search', 'github-fetch', 'gdrive-fetch'].includes(sigilName)) {
        result.permissions.push('network_access');
      }

      // Check system permissions for system operations
      if (['system', 'shell', 'run'].includes(sigilName)) {
        result.permissions.push('system_access');
      }

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Validate sigil-specific arguments
   */
  validateSigilArgs(sigil, args) {
    const result = { valid: true, errors: [], warnings: [] };

    try {
      switch (sigil) {
        case 'calc':
          if (!args || args.trim() === '') {
            result.valid = false;
            result.errors.push('Calculator requires an expression');
          }
          break;

        case 'read':
        case 'analyze':
        case 'count':
          if (!args || args.trim() === '') {
            result.valid = false;
            result.errors.push(`${sigil} requires a file path`);
          }
          break;

        case 'write':
          if (!args.includes('->')) {
            result.warnings.push('Write command should include -> separator');
          }
          break;

        case 'email':
          if (!args.includes('@')) {
            result.warnings.push('Email command may be missing recipient');
          }
          break;

        case 'github-fetch':
        case 'gdrive-fetch':
          // These can work with default arguments
          break;

        default:
          // Generic validation
          if (!args) {
            result.warnings.push(`${sigil} has no arguments`);
          }
      }
    } catch (error) {
      result.errors.push(`Argument validation failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Find dependencies between actions
   */
  findActionDependencies(action, allActions) {
    const dependencies = [];
    
    // Look for variable references like ${action-1.result}
    const variablePattern = /\$\{([^}]+)\}/g;
    let match;
    
    const searchText = action.args || '';
    while ((match = variablePattern.exec(searchText)) !== null) {
      const varRef = match[1];
      const actionRef = varRef.split('.')[0];
      
      // Find the referenced action
      const depAction = allActions.find(a => a.id === actionRef);
      if (depAction) {
        dependencies.push(actionRef);
      }
    }

    return dependencies;
  }

  /**
   * Plan optimal execution order considering dependencies
   */
  planExecutionOrder(actions, dependencies) {
    const order = [];
    const completed = new Set();
    const remaining = [...actions];

    // Simple topological sort
    while (remaining.length > 0) {
      let progress = false;
      
      for (let i = remaining.length - 1; i >= 0; i--) {
        const action = remaining[i];
        const actionDeps = dependencies.find(d => d.actionId === action.id);
        
        // Check if all dependencies are completed
        if (!actionDeps || actionDeps.dependsOn.every(dep => completed.has(dep))) {
          order.push({
            position: order.length + 1,
            actionId: action.id,
            sigil: action.sigil,
            description: action.description
          });
          completed.add(action.id);
          remaining.splice(i, 1);
          progress = true;
        }
      }
      
      // Break circular dependencies
      if (!progress && remaining.length > 0) {
        const action = remaining.shift();
        order.push({
          position: order.length + 1,
          actionId: action.id,
          sigil: action.sigil,
          description: action.description,
          warning: 'Circular dependency detected'
        });
        completed.add(action.id);
      }
    }

    return order;
  }

  /**
   * Assess overall risk level for action set
   */
  assessOverallRisk(actions) {
    const risks = actions.map(a => a.risk_level || this.assessSigilRisk(a.sigil.slice(1)));
    
    if (risks.includes('high')) return 'high';
    if (risks.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Assess risk level for specific sigil
   */
  assessSigilRisk(sigil) {
    const highRisk = ['shell', 'run', 'email', 'system'];
    const mediumRisk = ['write', 'github-fetch', 'gdrive-fetch'];
    
    if (highRisk.includes(sigil)) return 'high';
    if (mediumRisk.includes(sigil)) return 'medium';
    return 'low';
  }

  /**
   * Estimate execution time for sigil
   */
  estimateSigilTime(sigil) {
    const timeEstimates = {
      'calc': '5s',
      'read': '10s', 
      'write': '10s',
      'analyze': '30s',
      'system': '5s',
      'count': '15s',
      'search': '20s',
      'email': '10s',
      'github-fetch': '30s',
      'gdrive-fetch': '45s'
    };
    
    return timeEstimates[sigil] || '10s';
  }

  /**
   * Parse time string to seconds
   */
  parseTime(timeStr) {
    const match = timeStr.match(/(\d+)([sm]?)/);
    if (!match) return 10;
    
    const value = parseInt(match[1]);
    const unit = match[2] || 's';
    
    return unit === 'm' ? value * 60 : value;
  }

  /**
   * Extract file path from arguments
   */
  extractFilePath(args) {
    if (!args) return null;
    
    // Handle various formats
    if (args.includes('->')) {
      return args.split('->')[0].trim();
    }
    
    // First word is likely the file path
    return args.split(/\s+/)[0];
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  /**
   * Save execution history
   */
  saveExecutionHistory(sessionId, actions, results) {
    try {
      const historyEntry = {
        sessionId,
        timestamp: new Date().toISOString(),
        actions: actions,
        results: results,
        summary: {
          totalActions: actions.length,
          successfulActions: results.filter(r => r.success).length,
          failedActions: results.filter(r => !r.success).length
        }
      };

      this.executionHistory.push(historyEntry);

      // Keep only last 100 sessions
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-100);
      }

      return historyEntry;
    } catch (error) {
      console.warn('Failed to save execution history:', error.message);
      return null;
    }
  }
}

module.exports = CloudAIBridge;