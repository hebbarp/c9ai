"use strict";

const fs = require("node:fs").promises;
const path = require("node:path");
const { execSync } = require("node:child_process");

/**
 * LLM-Powered Script Generation System
 * Generates tools on-demand for specific use cases
 */
class ScriptGenerator {
  constructor(llmProvider) {
    this.llmProvider = llmProvider;
    this.tempDir = path.join(process.cwd(), ".c9ai", "generated");
    this.templates = this.initializeTemplates();
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.mkdir(this.tempDir, { recursive: true });
  }

  /**
   * Generate script for a specific task
   */
  async generateTool(request) {
    const {
      task,
      language = "auto", 
      preferredLibraries = [],
      inputFormat,
      outputFormat,
      constraints = {}
    } = request;

    console.log(`🤖 Generating script for: ${task}`);

    // Analyze task and determine best approach
    const analysis = await this.analyzeTask(task, {
      language,
      inputFormat,
      outputFormat,
      constraints
    });

    // Generate the script
    const script = await this.generateScript(analysis);

    // Test and validate the script
    const validation = await this.validateScript(script, analysis);

    if (!validation.valid) {
      console.log("⚠️  Initial script failed validation, refining...");
      const refinedScript = await this.refineScript(script, validation.errors, analysis);
      return refinedScript;
    }

    return script;
  }

  /**
   * Analyze task to determine best implementation approach
   */
  async analyzeTask(task, options) {
    const systemPrograms = await this.getAvailableSystemPrograms();
    const installedPackages = await this.getInstalledPackages(options.language);
    
    const analysisPrompt = `
Analyze this task and provide implementation strategy:

Task: ${task}
Available system programs: ${systemPrograms.map(p => p.name).join(", ")}
Preferred language: ${options.language}
Input format: ${options.inputFormat || "any"}
Output format: ${options.outputFormat || "any"}
Installed packages: ${installedPackages.slice(0, 20).join(", ")}

Provide analysis as JSON:
{
  "taskType": "data-processing|media-conversion|web-scraping|file-manipulation|api-integration",
  "complexity": "simple|moderate|complex",
  "recommendedLanguage": "python|javascript|bash|ruby",
  "systemToolsNeeded": ["tool1", "tool2"],
  "librariesNeeded": ["lib1", "lib2"],
  "estimatedLines": 50,
  "approachStrategy": "description of approach"
}`;

    if (this.llmProvider) {
      const response = await this.llmProvider.complete(analysisPrompt);
      try {
        return JSON.parse(response);
      } catch (e) {
        console.warn("Failed to parse LLM analysis, using fallback");
      }
    }

    // Fallback analysis based on keywords
    return this.fallbackAnalysis(task, options);
  }

  /**
   * Generate actual script code
   */
  async generateScript(analysis) {
    const template = this.selectTemplate(analysis);
    
    const generationPrompt = `
Generate a ${analysis.recommendedLanguage} script for this task:

Task Type: ${analysis.taskType}
Complexity: ${analysis.complexity}
Required Libraries: ${analysis.librariesNeeded.join(", ")}
System Tools: ${analysis.systemToolsNeeded.join(", ")}
Approach: ${analysis.approachStrategy}

Requirements:
1. Include proper error handling
2. Add helpful comments
3. Make it robust and production-ready
4. Include usage examples in comments
5. Handle edge cases gracefully

Template to use:
${template}

Generate complete, executable script:`;

    if (this.llmProvider) {
      const scriptCode = await this.llmProvider.complete(generationPrompt);
      return this.wrapScript(scriptCode, analysis);
    }

    // Fallback to template-based generation
    return this.generateFromTemplate(template, analysis);
  }

  /**
   * Validate generated script
   */
  async validateScript(script, analysis) {
    const tempFile = path.join(this.tempDir, `test_${Date.now()}.${this.getFileExtension(analysis.recommendedLanguage)}`);
    
    try {
      await fs.writeFile(tempFile, script.code);
      
      // Syntax check
      const syntaxValid = await this.checkSyntax(tempFile, analysis.recommendedLanguage);
      if (!syntaxValid.valid) {
        return { valid: false, errors: syntaxValid.errors };
      }
      
      // Basic functionality test if possible
      const functionalityValid = await this.testBasicFunctionality(tempFile, script, analysis);
      
      return {
        valid: syntaxValid.valid && functionalityValid.valid,
        errors: [...(syntaxValid.errors || []), ...(functionalityValid.errors || [])],
        warnings: functionalityValid.warnings || []
      };
      
    } catch (error) {
      return {
        valid: false,
        errors: [`Validation error: ${error.message}`]
      };
    } finally {
      // Cleanup
      try {
        await fs.unlink(tempFile);
      } catch (e) {}
    }
  }

  /**
   * Check script syntax
   */
  async checkSyntax(filePath, language) {
    try {
      switch (language) {
        case "python":
          execSync(`python -m py_compile "${filePath}"`, { stdio: "pipe" });
          break;
        case "javascript":
          execSync(`node -c "${filePath}"`, { stdio: "pipe" });
          break;
        case "ruby":
          execSync(`ruby -c "${filePath}"`, { stdio: "pipe" });
          break;
        case "bash":
          execSync(`bash -n "${filePath}"`, { stdio: "pipe" });
          break;
      }
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [`Syntax error: ${error.message}`]
      };
    }
  }

  /**
   * Wrap generated code in proper script structure
   */
  wrapScript(code, analysis) {
    const timestamp = new Date().toISOString();
    const scriptId = `generated_${Date.now()}`;
    
    return {
      id: scriptId,
      type: "generated",
      language: analysis.recommendedLanguage,
      taskType: analysis.taskType,
      code: code,
      metadata: {
        generatedAt: timestamp,
        analysis: analysis,
        estimatedLines: analysis.estimatedLines,
        dependencies: analysis.librariesNeeded,
        systemTools: analysis.systemToolsNeeded
      },
      execute: this.createExecuteFunction(code, analysis)
    };
  }

  /**
   * Create execute function for the generated script
   */
  createExecuteFunction(code, analysis) {
    return async (args) => {
      const tempFile = path.join(this.tempDir, `exec_${Date.now()}.${this.getFileExtension(analysis.recommendedLanguage)}`);
      
      try {
        await fs.writeFile(tempFile, code);
        
        const result = await this.executeScript(tempFile, analysis.recommendedLanguage, args);
        
        return {
          success: true,
          output: result.stdout,
          error: result.stderr,
          exitCode: result.code,
          executionTime: result.executionTime
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          exitCode: 1
        };
      } finally {
        try {
          await fs.unlink(tempFile);
        } catch (e) {}
      }
    };
  }

  /**
   * Execute script file
   */
  async executeScript(filePath, language, args = {}) {
    const startTime = Date.now();
    
    let command;
    switch (language) {
      case "python":
        command = `python "${filePath}"`;
        break;
      case "javascript":
        command = `node "${filePath}"`;
        break;
      case "ruby":
        command = `ruby "${filePath}"`;
        break;
      case "bash":
        command = `bash "${filePath}"`;
        break;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
    
    // Add arguments to command if provided
    if (args.input) {
      command += ` "${args.input}"`;
    }
    if (args.output) {
      command += ` "${args.output}"`;
    }
    
    try {
      const output = execSync(command, {
        stdio: "pipe",
        encoding: "utf8",
        timeout: 60000, // 1 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      return {
        stdout: output,
        stderr: "",
        code: 0,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
        code: error.status || 1,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Initialize script templates
   */
  initializeTemplates() {
    return {
      "data-processing": {
        python: `#!/usr/bin/env python3
"""
Generated data processing script
Usage: python script.py input_file [output_file]
"""
import sys
import pandas as pd
import json

def process_data(input_file, output_file=None):
    """Process data from input file"""
    try:
        # Read input data
        if input_file.endswith('.csv'):
            data = pd.read_csv(input_file)
        elif input_file.endswith('.json'):
            with open(input_file) as f:
                data = json.load(f)
        else:
            raise ValueError("Unsupported file format")
        
        # Process data here
        result = data  # Placeholder for actual processing
        
        # Save result
        if output_file:
            if output_file.endswith('.csv'):
                result.to_csv(output_file, index=False)
            elif output_file.endswith('.json'):
                with open(output_file, 'w') as f:
                    json.dump(result.to_dict(), f, indent=2)
        
        return result
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py input_file [output_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    process_data(input_file, output_file)`
      },
      
      "file-manipulation": {
        bash: `#!/bin/bash
# Generated file manipulation script
# Usage: ./script.sh input_path [output_path]

set -e  # Exit on error

input_path="$1"
output_path="$2"

if [ -z "$input_path" ]; then
    echo "Usage: $0 input_path [output_path]"
    exit 1
fi

# Check if input exists
if [ ! -e "$input_path" ]; then
    echo "Error: Input path does not exist: $input_path"
    exit 1
fi

# Process files here
echo "Processing: $input_path"

# Placeholder for actual processing
# Add your file manipulation logic here

echo "Completed successfully"`,
        
        javascript: `#!/usr/bin/env node
/**
 * Generated file manipulation script
 * Usage: node script.js input_file [output_file]
 */

const fs = require('fs');
const path = require('path');

async function processFile(inputFile, outputFile) {
    try {
        console.log(\`Processing: \${inputFile}\`);
        
        // Read input file
        const content = await fs.promises.readFile(inputFile, 'utf8');
        
        // Process content here
        const processedContent = content; // Placeholder
        
        // Write output
        if (outputFile) {
            await fs.promises.writeFile(outputFile, processedContent);
            console.log(\`Output saved to: \${outputFile}\`);
        } else {
            console.log(processedContent);
        }
        
    } catch (error) {
        console.error(\`Error: \${error.message}\`);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const inputFile = process.argv[2];
    const outputFile = process.argv[3];
    
    if (!inputFile) {
        console.log('Usage: node script.js input_file [output_file]');
        process.exit(1);
    }
    
    processFile(inputFile, outputFile);
}`
      }
    };
  }

  /**
   * Select appropriate template based on analysis
   */
  selectTemplate(analysis) {
    const templates = this.templates[analysis.taskType];
    if (!templates) {
      return this.templates["data-processing"]; // Default fallback
    }
    
    const template = templates[analysis.recommendedLanguage];
    if (!template) {
      // Return first available template for the task type
      return Object.values(templates)[0];
    }
    
    return template;
  }

  /**
   * Get file extension for language
   */
  getFileExtension(language) {
    const extensions = {
      python: "py",
      javascript: "js", 
      bash: "sh",
      ruby: "rb"
    };
    return extensions[language] || "txt";
  }

  /**
   * Fallback task analysis when LLM is not available
   */
  fallbackAnalysis(task, options) {
    const taskLower = task.toLowerCase();
    
    let taskType = "data-processing"; // default
    if (taskLower.includes("video") || taskLower.includes("audio") || taskLower.includes("image")) {
      taskType = "media-conversion";
    } else if (taskLower.includes("web") || taskLower.includes("scrape") || taskLower.includes("api")) {
      taskType = "api-integration";
    } else if (taskLower.includes("file") || taskLower.includes("directory")) {
      taskType = "file-manipulation";
    }
    
    return {
      taskType,
      complexity: "moderate",
      recommendedLanguage: options.language === "auto" ? "python" : options.language,
      systemToolsNeeded: [],
      librariesNeeded: taskType === "data-processing" ? ["pandas"] : [],
      estimatedLines: 50,
      approachStrategy: "Generate basic script template and customize for specific task"
    };
  }

  /**
   * Get available system programs
   */
  async getAvailableSystemPrograms() {
    try {
      const { SystemProgramDetector } = require("../system/detector");
      const detector = new SystemProgramDetector();
      return await detector.loadCachedResults() || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get installed packages for a language
   */
  async getInstalledPackages(language) {
    try {
      switch (language) {
        case "python":
          const pipList = execSync("pip list --format=freeze", { encoding: "utf8", stdio: "pipe" });
          return pipList.split("\n").map(line => line.split("==")[0]).filter(Boolean);
        case "javascript":
          // This would be more complex - checking global npm packages and local ones
          return ["fs", "path", "http", "https", "crypto"]; // Built-in modules
        default:
          return [];
      }
    } catch (error) {
      return [];
    }
  }
}

module.exports = { ScriptGenerator };