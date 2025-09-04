"use strict";
/**
 * Code Parser for AI Responses
 * Extracts code blocks from AI-generated text and provides save/execute options
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class CodeParser {
  constructor() {
    this.codeDir = path.join(process.cwd(), '.c9ai', 'generated-code');
    this.ensureDirectory();
  }

  async ensureDirectory() {
    try {
      await fs.mkdir(this.codeDir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to create code directory: ${error.message}`);
    }
  }

  /**
   * Parse AI response and extract code blocks
   */
  parseCodeFromResponse(response) {
    const codeBlocks = [];
    
    // Match markdown code blocks
    const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      if (code && this.isValidCode(code, language)) {
        codeBlocks.push({
          language: language,
          code: code,
          filename: this.generateFilename(language, code),
          isExecutable: this.isExecutable(language)
        });
      }
    }

    // Also extract shell commands (pip install, npm install, etc.)
    const installCommands = this.extractInstallCommands(response);
    
    return {
      codeBlocks,
      installCommands,
      hasCode: codeBlocks.length > 0,
      hasInstallCommands: installCommands.length > 0
    };
  }

  /**
   * Extract installation commands from response
   */
  extractInstallCommands(response) {
    const commands = [];
    
    // Common package managers
    const installPatterns = [
      /pip install ([^\n]+)/g,
      /npm install ([^\n]+)/g,
      /yarn add ([^\n]+)/g,
      /apt-get install ([^\n]+)/g,
      /brew install ([^\n]+)/g,
      /gem install ([^\n]+)/g
    ];
    
    for (const pattern of installPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        commands.push({
          type: 'install',
          command: match[0],
          packages: match[1].trim()
        });
      }
    }
    
    return commands;
  }

  /**
   * Check if code is valid/non-empty
   */
  isValidCode(code, language) {
    if (!code || code.trim().length < 10) return false;
    
    // Skip obvious non-code
    if (code.includes('Usage:') && code.includes('Output:')) return false;
    if (code.match(/^\d+\.\s/)) return false; // Numbered lists
    
    // Language-specific validation
    switch (language.toLowerCase()) {
      case 'python':
        return code.includes('import ') || code.includes('def ') || code.includes('print(');
      case 'javascript':
      case 'js':
        return code.includes('function') || code.includes('const ') || code.includes('console.');
      case 'bash':
      case 'sh':
        return code.includes('#!/bin/bash') || code.includes('echo ') || code.includes('set ');
      default:
        return true;
    }
  }

  /**
   * Check if language is executable
   */
  isExecutable(language) {
    const executables = ['python', 'javascript', 'js', 'bash', 'sh', 'powershell', 'ps1'];
    return executables.includes(language.toLowerCase());
  }

  /**
   * Generate appropriate filename for code
   */
  generateFilename(language, code) {
    // Try to extract meaningful name from code
    let basename = 'generated_code';
    
    // Look for function names, class names, etc.
    const namePatterns = [
      /def\s+(\w+)/,           // Python function
      /class\s+(\w+)/,         // Class definition
      /function\s+(\w+)/,      // JavaScript function
      /const\s+(\w+)\s*=/,     // JavaScript const
      /let\s+(\w+)\s*=/        // JavaScript let
    ];
    
    for (const pattern of namePatterns) {
      const match = code.match(pattern);
      if (match) {
        basename = match[1];
        break;
      }
    }
    
    // Add timestamp to avoid conflicts
    const timestamp = Date.now();
    const ext = this.getFileExtension(language);
    
    return `${basename}_${timestamp}.${ext}`;
  }

  /**
   * Get file extension for language
   */
  getFileExtension(language) {
    const extensions = {
      python: 'py',
      javascript: 'js',
      js: 'js',
      bash: 'sh',
      sh: 'sh',
      powershell: 'ps1',
      ps1: 'ps1',
      java: 'java',
      go: 'go',
      rust: 'rs',
      c: 'c',
      cpp: 'cpp'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }

  /**
   * Save code block to file
   */
  async saveCode(codeBlock) {
    try {
      const filepath = path.join(this.codeDir, codeBlock.filename);
      await fs.writeFile(filepath, codeBlock.code, 'utf8');
      
      // Make executable if needed
      if (codeBlock.isExecutable) {
        try {
          execSync(`chmod +x "${filepath}"`, { stdio: 'ignore' });
        } catch (error) {
          // Ignore chmod errors on Windows
        }
      }
      
      return {
        success: true,
        filepath: filepath,
        filename: codeBlock.filename,
        language: codeBlock.language,
        executable: codeBlock.isExecutable
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save code: ${error.message}`,
        filename: codeBlock.filename
      };
    }
  }

  /**
   * Execute saved code file
   */
  async executeCode(filepath) {
    try {
      const ext = path.extname(filepath).toLowerCase();
      let command;
      
      switch (ext) {
        case '.py':
          command = `python3 "${filepath}"`;
          break;
        case '.js':
          command = `node "${filepath}"`;
          break;
        case '.sh':
        case '.bash':
          command = `bash "${filepath}"`;
          break;
        case '.ps1':
          command = `powershell -ExecutionPolicy Bypass -File "${filepath}"`;
          break;
        case '.bat':
        case '.cmd':
          command = `"${filepath}"`;  // Windows batch files can be executed directly
          break;
        case '.exe':
          command = `"${filepath}"`;
          break;
        default:
          // Try to execute directly if no known extension
          command = `"${filepath}"`;
      }
      
      console.log(`🚀 Executing: ${command}`);
      const output = execSync(command, { 
        encoding: 'utf8',
        timeout: 30000,  // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });
      
      return {
        success: true,
        output: output,
        command: command,
        filepath: filepath
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        command: command || 'unknown',
        filepath: filepath
      };
    }
  }

  /**
   * Install dependencies from install commands
   */
  async installDependencies(installCommands) {
    const results = [];
    
    for (const cmd of installCommands) {
      try {
        console.log(`📦 Installing: ${cmd.command}`);
        const output = execSync(cmd.command, { 
          encoding: 'utf8',
          timeout: 60000 // 1 minute timeout for installs
        });
        
        results.push({
          success: true,
          command: cmd.command,
          output: output
        });
      } catch (error) {
        results.push({
          success: false,
          command: cmd.command,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * List saved code files
   */
  async listSavedFiles() {
    try {
      const files = await fs.readdir(this.codeDir);
      const codeFiles = [];
      
      for (const file of files) {
        const filepath = path.join(this.codeDir, file);
        const stats = await fs.stat(filepath);
        
        codeFiles.push({
          filename: file,
          filepath: filepath,
          size: stats.size,
          modified: stats.mtime,
          executable: this.isExecutable(path.extname(file).substring(1))
        });
      }
      
      return codeFiles.sort((a, b) => b.modified - a.modified);
    } catch (error) {
      return [];
    }
  }
}

module.exports = { CodeParser };