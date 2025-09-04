"use strict";

/**
 * ActionValidator - Security and validation for C9AI actions
 * Provides comprehensive validation, risk assessment, and safety checks
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

class ActionValidator {
  constructor() {
    // Define security rules and patterns
    this.dangerousPatterns = [
      /rm\s+-rf\s+\//, // Dangerous deletions
      /rm\s+-rf\s+\*/, 
      /format\s+c:/, // Windows format
      /dd\s+if=\/dev\/zero/, // Disk wipe
      /:\(\)\{.*\|.*&.*\}.*:/, // Fork bomb
      /sudo\s+.*passwd/, // Password changes
      /chmod\s+777/, // Overly permissive permissions
      /curl.*\|\s*sh/, // Pipe to shell
      /wget.*\|\s*sh/
    ];

    this.restrictedPaths = [
      '/etc',
      '/usr/bin', 
      '/System',
      'C:\\Windows',
      'C:\\Program Files',
      '/var/log',
      '/tmp/sensitive'
    ];

    this.allowedExtensions = new Set([
      '.txt', '.md', '.csv', '.json', '.yml', '.yaml', 
      '.log', '.conf', '.ini', '.xml', '.html', '.js', '.py', '.sh'
    ]);

    this.riskWeights = {
      file_operations: 0.3,
      network_access: 0.4, 
      system_commands: 0.8,
      dangerous_patterns: 1.0,
      restricted_paths: 0.9,
      unknown_sigils: 0.6
    };
  }

  /**
   * Validate a single action comprehensively
   */
  async validateAction(action) {
    const validation = {
      actionId: action.id,
      sigil: action.sigil,
      valid: true,
      riskScore: 0,
      riskLevel: 'low',
      errors: [],
      warnings: [],
      restrictions: [],
      requirements: [],
      securityChecks: {
        dangerousPatterns: false,
        restrictedPaths: false,
        filePermissions: true,
        networkSafety: true,
        argumentValidation: true
      }
    };

    try {
      // Basic sigil validation
      await this.validateSigil(action, validation);
      
      // Argument safety validation
      await this.validateArguments(action, validation);
      
      // File system security checks
      await this.validateFileAccess(action, validation);
      
      // Network security checks
      await this.validateNetworkAccess(action, validation);
      
      // System security checks  
      await this.validateSystemAccess(action, validation);
      
      // Calculate final risk score and level
      this.calculateRiskScore(validation);
      
      // Determine if action should be blocked
      if (validation.riskScore >= 0.8 || validation.errors.length > 0) {
        validation.valid = false;
      }

    } catch (error) {
      validation.valid = false;
      validation.errors.push(`Validation failed: ${error.message}`);
      validation.riskScore = 1.0;
      validation.riskLevel = 'high';
    }

    return validation;
  }

  /**
   * Validate sigil exists and is properly formatted
   */
  async validateSigil(action, validation) {
    if (!action.sigil || !action.sigil.startsWith('@')) {
      validation.errors.push('Invalid sigil format - must start with @');
      validation.riskScore += this.riskWeights.unknown_sigils;
      return;
    }

    const sigilName = action.sigil.slice(1);
    const supportedSigils = [
      'calc', 'analyze', 'system', 'count', 'read', 'write', 'email',
      'search', 'github-fetch', 'github-list', 'github-run',
      'gdrive-fetch', 'gdrive-list', 'gdrive-run', 'file', 'process',
      'todo', 'task', 'run', 'shell', 'whatsapp', 'sms', 'compile',
      'tex', 'latex', 'pdf', 'image', 'video', 'convert', 'resize'
    ];

    if (!supportedSigils.includes(sigilName)) {
      validation.errors.push(`Unsupported sigil: ${action.sigil}`);
      validation.riskScore += this.riskWeights.unknown_sigils;
    }

    // Check for required parameters
    if (!action.id) {
      validation.errors.push('Action must have unique ID');
    }

    if (!action.description) {
      validation.warnings.push('Action missing description');
    }
  }

  /**
   * Validate and sanitize action arguments
   */
  async validateArguments(action, validation) {
    const args = action.args || '';
    const sigilName = action.sigil.slice(1);

    // Check for dangerous patterns in arguments
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(args)) {
        validation.errors.push(`Dangerous pattern detected in arguments`);
        validation.securityChecks.dangerousPatterns = true;
        validation.riskScore += this.riskWeights.dangerous_patterns;
      }
    }

    // Sigil-specific argument validation
    switch (sigilName) {
      case 'calc':
        this.validateCalculatorArgs(args, validation);
        break;
        
      case 'read':
      case 'write':
      case 'analyze':
      case 'count':
        this.validateFileArgs(args, validation);
        break;
        
      case 'email':
        this.validateEmailArgs(args, validation);
        break;
        
      case 'shell':
      case 'run':
        this.validateShellArgs(args, validation);
        validation.riskScore += this.riskWeights.system_commands;
        break;
        
      case 'github-fetch':
      case 'gdrive-fetch':
        this.validateFetchArgs(args, validation);
        validation.riskScore += this.riskWeights.network_access;
        break;
    }
  }

  /**
   * Validate calculator arguments
   */
  validateCalculatorArgs(args, validation) {
    if (!args.trim()) {
      validation.errors.push('Calculator requires an expression');
      return;
    }

    // Check for suspicious code execution attempts
    const suspiciousPatterns = [
      /require\s*\(/,
      /import\s+/,
      /eval\s*\(/,
      /Function\s*\(/,
      /process\./,
      /fs\./,
      /child_process/
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(args)) {
        validation.errors.push('Suspicious code detected in calculator expression');
        validation.riskScore += 0.8;
      }
    }
  }

  /**
   * Validate file operation arguments
   */
  validateFileArgs(args, validation) {
    if (!args.trim()) {
      validation.errors.push('File operation requires path argument');
      return;
    }

    let filePath;
    if (args.includes('->')) {
      filePath = args.split('->')[0].trim();
    } else {
      filePath = args.split(/\s+/)[0];
    }

    // Check for path traversal attempts
    if (filePath.includes('../') || filePath.includes('..\\')) {
      validation.warnings.push('Path traversal detected - use absolute paths');
      validation.riskScore += 0.3;
    }

    // Check for access to restricted paths
    for (const restrictedPath of this.restrictedPaths) {
      if (filePath.startsWith(restrictedPath)) {
        validation.errors.push(`Access to restricted path: ${restrictedPath}`);
        validation.securityChecks.restrictedPaths = true;
        validation.riskScore += this.riskWeights.restricted_paths;
      }
    }

    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext && !this.allowedExtensions.has(ext)) {
      validation.warnings.push(`Unusual file extension: ${ext}`);
      validation.riskScore += 0.2;
    }
  }

  /**
   * Validate email arguments
   */
  validateEmailArgs(args, validation) {
    if (!args.includes('@')) {
      validation.warnings.push('Email recipient may be missing');
    }

    // Check for suspicious email patterns
    if (args.match(/[<>]/)) {
      validation.warnings.push('HTML content detected in email');
    }

    // Check for bulk email attempts
    const emailCount = (args.match(/@/g) || []).length;
    if (emailCount > 5) {
      validation.warnings.push('Bulk email detected - consider rate limiting');
      validation.riskScore += 0.4;
    }
  }

  /**
   * Validate shell command arguments
   */
  validateShellArgs(args, validation) {
    if (!args.trim()) {
      validation.errors.push('Shell command requires arguments');
      return;
    }

    // Additional dangerous patterns for shell commands
    const shellDangerPatterns = [
      /;\s*rm/, // Command chaining with rm
      /\|\s*sh/, // Pipe to shell
      />\s*\/dev\//, // Writing to devices
      /sudo/, // Privilege escalation
      /su\s+/, 
      /passwd/,
      /useradd/,
      /userdel/,
      /chmod\s+[7]/
    ];

    for (const pattern of shellDangerPatterns) {
      if (pattern.test(args)) {
        validation.errors.push('High-risk shell command detected');
        validation.riskScore += 0.9;
      }
    }
  }

  /**
   * Validate fetch operation arguments
   */
  validateFetchArgs(args, validation) {
    // Check for suspicious URLs or repos
    if (args.includes('://')) {
      validation.warnings.push('URL detected in fetch arguments');
      validation.riskScore += 0.3;
    }

    // Rate limiting check
    validation.requirements.push('Rate limiting should be applied');
  }

  /**
   * Validate file system access permissions
   */
  async validateFileAccess(action, validation) {
    const sigilName = action.sigil.slice(1);
    
    if (!['read', 'write', 'analyze', 'count', 'file'].includes(sigilName)) {
      return; // Not a file operation
    }

    const args = action.args || '';
    let filePath;

    if (args.includes('->')) {
      filePath = args.split('->')[0].trim();
    } else {
      filePath = args.split(/\s+/)[0];
    }

    if (!filePath) return;

    try {
      // Convert to absolute path if relative
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      
      // Check if path is within allowed directories
      const cwd = process.cwd();
      const home = os.homedir();
      const allowedBasePaths = [cwd, path.join(home, 'Documents'), path.join(home, 'Downloads')];
      
      const isWithinAllowed = allowedBasePaths.some(basePath => 
        absolutePath.startsWith(basePath)
      );

      if (!isWithinAllowed) {
        validation.warnings.push(`File outside of allowed directories: ${absolutePath}`);
        validation.riskScore += 0.4;
      }

      // For read operations, check if file exists
      if (['read', 'analyze', 'count'].includes(sigilName)) {
        if (!fs.existsSync(absolutePath)) {
          validation.warnings.push(`File does not exist: ${filePath}`);
        } else {
          // Check file size
          const stats = fs.statSync(absolutePath);
          if (stats.size > 100 * 1024 * 1024) { // 100MB
            validation.warnings.push('Large file detected - operation may be slow');
            validation.riskScore += 0.2;
          }
        }
      }

      // For write operations, check directory permissions
      if (['write'].includes(sigilName)) {
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
          validation.warnings.push(`Directory does not exist: ${dir}`);
        }
      }

    } catch (error) {
      validation.warnings.push(`File validation error: ${error.message}`);
      validation.securityChecks.filePermissions = false;
    }
  }

  /**
   * Validate network access operations
   */
  async validateNetworkAccess(action, validation) {
    const sigilName = action.sigil.slice(1);
    
    if (!['email', 'search', 'github-fetch', 'gdrive-fetch'].includes(sigilName)) {
      return; // Not a network operation
    }

    validation.requirements.push('Network access required');
    validation.riskScore += this.riskWeights.network_access;

    // Check for rate limiting requirements
    if (['github-fetch', 'gdrive-fetch'].includes(sigilName)) {
      validation.requirements.push('API rate limiting should be enforced');
      validation.requirements.push('Authentication credentials required');
    }

    // Email-specific checks
    if (sigilName === 'email') {
      validation.requirements.push('SMTP configuration required');
      validation.securityChecks.networkSafety = true;
    }
  }

  /**
   * Validate system-level access
   */
  async validateSystemAccess(action, validation) {
    const sigilName = action.sigil.slice(1);
    
    if (!['system', 'shell', 'run'].includes(sigilName)) {
      return; // Not a system operation
    }

    validation.requirements.push('System access required');
    validation.riskScore += this.riskWeights.system_commands;

    if (sigilName === 'system') {
      // System info is generally safe
      validation.riskScore -= 0.2; // Reduce risk for info gathering
    }
  }

  /**
   * Calculate final risk score and level
   */
  calculateRiskScore(validation) {
    // Ensure risk score is between 0 and 1
    validation.riskScore = Math.min(1.0, Math.max(0.0, validation.riskScore));

    // Determine risk level
    if (validation.riskScore >= 0.7) {
      validation.riskLevel = 'high';
    } else if (validation.riskScore >= 0.4) {
      validation.riskLevel = 'medium';
    } else {
      validation.riskLevel = 'low';
    }
  }

  /**
   * Validate multiple actions and check for interaction risks
   */
  async validateActionSet(actions) {
    const validations = [];
    const interactionRisks = [];

    // Validate each action individually
    for (const action of actions) {
      const validation = await this.validateAction(action);
      validations.push(validation);
    }

    // Check for interaction risks between actions
    this.checkActionInteractions(actions, interactionRisks);

    return {
      individualValidations: validations,
      interactionRisks: interactionRisks,
      overallRiskLevel: this.calculateOverallRisk(validations),
      totalErrors: validations.reduce((sum, v) => sum + v.errors.length, 0),
      totalWarnings: validations.reduce((sum, v) => sum + v.warnings.length, 0),
      recommendedAction: this.getRecommendedAction(validations, interactionRisks)
    };
  }

  /**
   * Check for risky interactions between actions
   */
  checkActionInteractions(actions, risks) {
    // Check for file conflicts
    const fileOps = actions.filter(a => 
      ['read', 'write', 'analyze'].includes(a.sigil.slice(1))
    );

    const files = new Set();
    for (const action of fileOps) {
      const filePath = this.extractFilePath(action.args);
      if (filePath) {
        if (files.has(filePath)) {
          risks.push({
            type: 'file_conflict',
            message: `Multiple operations on same file: ${filePath}`,
            actions: [action.id]
          });
        }
        files.add(filePath);
      }
    }

    // Check for excessive network requests
    const networkOps = actions.filter(a => 
      ['search', 'github-fetch', 'gdrive-fetch', 'email'].includes(a.sigil.slice(1))
    );

    if (networkOps.length > 3) {
      risks.push({
        type: 'network_spam',
        message: `High number of network operations: ${networkOps.length}`,
        actions: networkOps.map(a => a.id)
      });
    }
  }

  /**
   * Calculate overall risk level for action set
   */
  calculateOverallRisk(validations) {
    const highRisk = validations.filter(v => v.riskLevel === 'high').length;
    const mediumRisk = validations.filter(v => v.riskLevel === 'medium').length;
    const hasErrors = validations.some(v => v.errors.length > 0);

    if (hasErrors || highRisk > 0) return 'high';
    if (mediumRisk > 2) return 'high';
    if (mediumRisk > 0) return 'medium';
    return 'low';
  }

  /**
   * Get recommended action based on validation results
   */
  getRecommendedAction(validations, interactionRisks) {
    const hasErrors = validations.some(v => v.errors.length > 0);
    const highRiskCount = validations.filter(v => v.riskLevel === 'high').length;
    
    if (hasErrors) {
      return 'block'; // Don't execute any actions with errors
    }
    
    if (highRiskCount > 0 || interactionRisks.length > 0) {
      return 'confirm'; // Require explicit user confirmation
    }
    
    return 'proceed'; // Safe to execute with normal confirmation
  }

  /**
   * Extract file path from action arguments
   */
  extractFilePath(args) {
    if (!args) return null;
    
    if (args.includes('->')) {
      return args.split('->')[0].trim();
    }
    
    return args.split(/\s+/)[0];
  }
}

module.exports = ActionValidator;