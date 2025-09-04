"use strict";

const { SystemProgramDetector } = require("./system/detector");
const { ScriptGenerator } = require("./generator/script-generator");
const { EnhancedToolRegistry } = require("./registry/enhanced-registry");

/**
 * Hybrid Tool Resolver
 * Intelligently chooses between system programs, curated tools, and generated scripts
 */
class HybridToolResolver {
  constructor(options = {}) {
    this.systemDetector = new SystemProgramDetector();
    this.curatedRegistry = new EnhancedToolRegistry(options.registry);
    this.scriptGenerator = new ScriptGenerator(options.llmProvider);
    
    this.preferences = {
      preferSystemTools: options.preferSystemTools !== false, // Default: true
      allowGeneration: options.allowGeneration !== false,     // Default: true
      maxGenerationTime: options.maxGenerationTime || 30000,  // 30 seconds
      cacheGenerated: options.cacheGenerated !== false,       // Default: true
      ...options.preferences
    };

    this.cache = new Map();
  }

  /**
   * Resolve the best tool for a given task
   */
  async resolveTool(request) {
    const {
      task,
      requirements = {},
      constraints = {},
      preferredApproach = "auto" // "system", "curated", "generated", "auto"
    } = request;

    console.log(`🔍 Resolving tool for task: ${task}`);

    // Check cache first
    const cacheKey = this.getCacheKey(request);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      console.log(`📋 Using cached resolution: ${cached.source}`);
      return cached;
    }

    // Get all available options in parallel
    const [systemTools, curatedTools] = await Promise.all([
      this.findSystemTools(task, requirements),
      this.findCuratedTools(task, requirements)
    ]);

    // Score and rank all options
    const resolution = await this.selectBestTool({
      task,
      requirements,
      constraints,
      preferredApproach,
      systemTools,
      curatedTools
    });

    // Cache the result
    this.cache.set(cacheKey, resolution);

    return resolution;
  }

  /**
   * Find suitable system tools for the task
   */
  async findSystemTools(task, requirements) {
    try {
      const availablePrograms = await this.systemDetector.loadCachedResults() || 
                               await this.systemDetector.detectAll();

      const taskKeywords = this.extractTaskKeywords(task);
      const matches = [];

      for (const program of availablePrograms) {
        const score = this.scoreSystemTool(program, taskKeywords, requirements);
        if (score > 0) {
          matches.push({
            ...program,
            score,
            source: "system",
            reasoning: this.explainSystemMatch(program, taskKeywords, score)
          });
        }
      }

      return matches.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.warn("Failed to load system tools:", error.message);
      return [];
    }
  }

  /**
   * Find suitable curated tools for the task
   */
  async findCuratedTools(task, requirements) {
    try {
      const searchResults = await this.curatedRegistry.searchTools(task, {
        limit: 10
      });

      return searchResults.tools.map(tool => ({
        ...tool,
        score: this.scoreCuratedTool(tool, task, requirements),
        source: "curated",
        reasoning: this.explainCuratedMatch(tool, task)
      })).filter(tool => tool.score > 0)
        .sort((a, b) => b.score - a.score);
        
    } catch (error) {
      console.warn("Failed to search curated tools:", error.message);
      return [];
    }
  }

  /**
   * Select the best tool from all available options
   */
  async selectBestTool({ task, requirements, constraints, preferredApproach, systemTools, curatedTools }) {
    const allOptions = [...systemTools, ...curatedTools];
    
    // Apply preference weights
    this.applyPreferenceWeights(allOptions, preferredApproach);

    // Filter by constraints
    const validOptions = this.filterByConstraints(allOptions, constraints);

    if (validOptions.length > 0) {
      const bestOption = validOptions[0];
      console.log(`✅ Selected ${bestOption.source} tool: ${bestOption.name} (score: ${bestOption.score.toFixed(2)})`);
      console.log(`   ${bestOption.reasoning}`);
      
      return {
        tool: bestOption,
        alternatives: validOptions.slice(1, 3), // Top 2 alternatives
        fallbackToGeneration: this.preferences.allowGeneration
      };
    }

    // No suitable existing tool found - generate one if allowed
    if (this.preferences.allowGeneration) {
      console.log("🤖 No existing tools suitable - generating custom script...");
      
      try {
        const generatedTool = await this.scriptGenerator.generateTool({
          task,
          ...requirements,
          constraints
        });
        
        console.log(`✅ Generated ${generatedTool.language} script (${generatedTool.metadata.estimatedLines} lines)`);
        
        return {
          tool: {
            ...generatedTool,
            score: 0.7, // Generated tools get moderate score
            source: "generated",
            reasoning: "Custom-generated script tailored to specific requirements"
          },
          alternatives: [],
          generated: true
        };
        
      } catch (error) {
        console.error("❌ Failed to generate tool:", error.message);
        
        return {
          tool: null,
          error: `No suitable tools found and generation failed: ${error.message}`,
          alternatives: allOptions.slice(0, 3) // Show what was considered
        };
      }
    }

    return {
      tool: null,
      error: "No suitable tools found and generation is disabled",
      alternatives: allOptions.slice(0, 3)
    };
  }

  /**
   * Score system tool relevance to task
   */
  scoreSystemTool(program, taskKeywords, requirements) {
    let score = 0;

    // Check capability matches
    const capabilityMatches = program.capabilities.filter(cap => 
      taskKeywords.some(keyword => 
        cap.includes(keyword) || keyword.includes(cap.split('-')[0])
      )
    );
    score += capabilityMatches.length * 0.3;

    // Check direct name matches
    if (taskKeywords.some(keyword => program.name.includes(keyword))) {
      score += 0.5;
    }

    // Boost for powerful, versatile tools
    const powerTools = ["pandoc", "ffmpeg", "imagemagick", "python", "node"];
    if (powerTools.includes(program.name)) {
      score += 0.2;
    }

    // Format compatibility bonus
    if (requirements.inputFormat || requirements.outputFormat) {
      const formats = program.supportedFormats || {};
      if (formats.input && requirements.inputFormat && 
          formats.input.includes(requirements.inputFormat)) {
        score += 0.3;
      }
      if (formats.output && requirements.outputFormat && 
          formats.output.includes(requirements.outputFormat)) {
        score += 0.3;
      }
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Score curated tool relevance
   */
  scoreCuratedTool(tool, task, requirements) {
    let score = 0.6; // Base score for curated tools (well-maintained)

    // Name and description relevance
    const taskLower = task.toLowerCase();
    if (tool.name.toLowerCase().includes(taskLower) || 
        taskLower.includes(tool.name.toLowerCase().split('-')[0])) {
      score += 0.2;
    }

    if (tool.description && tool.description.toLowerCase().includes(taskLower)) {
      score += 0.1;
    }

    // Category relevance
    const categoryKeywords = {
      "documents": ["document", "pdf", "convert", "format"],
      "media": ["video", "audio", "image", "process"],
      "data": ["data", "analysis", "csv", "json"],
      "communication": ["email", "send", "message", "notify"]
    };

    const categoryKeys = categoryKeywords[tool.category] || [];
    const matches = categoryKeys.filter(keyword => taskLower.includes(keyword));
    score += matches.length * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Apply preference weights to tool scores
   */
  applyPreferenceWeights(options, preferredApproach) {
    for (const option of options) {
      if (preferredApproach === "system" && option.source === "system") {
        option.score *= 1.5;
      } else if (preferredApproach === "curated" && option.source === "curated") {
        option.score *= 1.5;
      } else if (this.preferences.preferSystemTools && option.source === "system") {
        option.score *= 1.2; // Slight boost for system tools
      }
    }
  }

  /**
   * Filter tools by constraints
   */
  filterByConstraints(options, constraints) {
    return options.filter(option => {
      // Performance constraints
      if (constraints.maxExecutionTime && option.source === "system") {
        // System tools are generally fast
        return true;
      }
      
      // Resource constraints
      if (constraints.lowMemory && option.name === "ffmpeg") {
        // FFmpeg can be memory intensive
        return false;
      }
      
      // Security constraints
      if (constraints.sandbox && option.source === "system") {
        // System tools run with full privileges
        return constraints.allowSystemTools !== false;
      }

      return true;
    });
  }

  /**
   * Extract keywords from task description
   */
  extractTaskKeywords(task) {
    const keywords = task.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'for', 'with', 'from', 'into'].includes(word));
    
    // Add derived keywords
    const derivedKeywords = [];
    if (keywords.some(k => ['pdf', 'document'].includes(k))) {
      derivedKeywords.push('document-conversion');
    }
    if (keywords.some(k => ['video', 'audio', 'media'].includes(k))) {
      derivedKeywords.push('media-processing');
    }
    if (keywords.some(k => ['image', 'photo'].includes(k))) {
      derivedKeywords.push('image-processing');
    }
    
    return [...keywords, ...derivedKeywords];
  }

  /**
   * Generate reasoning for system tool match
   */
  explainSystemMatch(program, taskKeywords, score) {
    const matches = program.capabilities.filter(cap => 
      taskKeywords.some(keyword => cap.includes(keyword))
    );
    
    return `System tool with capabilities: ${matches.join(", ")}. ` +
           `Powerful, battle-tested, and immediately available.`;
  }

  /**
   * Generate reasoning for curated tool match
   */
  explainCuratedMatch(tool, task) {
    return `Curated tool designed for ${tool.category} tasks. ` +
           `Well-maintained with proper error handling and documentation.`;
  }

  /**
   * Generate cache key for request
   */
  getCacheKey(request) {
    const key = JSON.stringify({
      task: request.task,
      requirements: request.requirements || {},
      preferredApproach: request.preferredApproach || "auto"
    });
    
    // Simple hash of the key
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `tool_${Math.abs(hash)}`;
  }

  /**
   * Execute resolved tool
   */
  async executeTool(resolution, args) {
    const { tool } = resolution;
    
    if (!tool) {
      throw new Error(resolution.error || "No tool available");
    }

    console.log(`🔧 Executing ${tool.source} tool: ${tool.name}`);
    
    try {
      switch (tool.source) {
        case "system":
          return await this.executeSystemTool(tool, args);
        case "curated":
          return await this.executeCuratedTool(tool, args);
        case "generated":
          return await tool.execute(args);
        default:
          throw new Error(`Unsupported tool source: ${tool.source}`);
      }
    } catch (error) {
      // Try alternatives if main tool fails
      if (resolution.alternatives && resolution.alternatives.length > 0) {
        console.log(`⚠️  Primary tool failed, trying alternative...`);
        const alternative = resolution.alternatives[0];
        return await this.executeTool({ tool: alternative }, args);
      }
      
      throw error;
    }
  }

  /**
   * Execute system tool
   */
  async executeSystemTool(tool, args) {
    const { execSync } = require("child_process");
    
    // Build command based on tool and arguments
    let command = this.buildSystemCommand(tool, args);
    
    console.log(`   Command: ${command}`);
    
    try {
      const output = execSync(command, {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 60000 // 1 minute
      });
      
      return {
        success: true,
        tool: tool.name,
        source: "system",
        output: output.trim(),
        command: command
      };
    } catch (error) {
      return {
        success: false,
        tool: tool.name,
        source: "system", 
        error: error.message,
        command: command
      };
    }
  }

  /**
   * Execute curated tool
   */
  async executeCuratedTool(tool, args) {
    // Use existing tool execution system
    const { runTool } = require("./runner");
    return await runTool(tool.id, args);
  }

  /**
   * Build system command from tool and arguments
   */
  buildSystemCommand(tool, args) {
    // This would be more sophisticated in practice
    // For now, return basic commands for common tools
    
    const { input, output, options = {} } = args;
    
    const commands = {
      "pandoc": () => {
        let cmd = `pandoc "${input}"`;
        if (output) cmd += ` -o "${output}"`;
        if (options.format) cmd += ` -t ${options.format}`;
        return cmd;
      },
      
      "ffmpeg": () => {
        let cmd = `ffmpeg -i "${input}"`;
        if (options.audioOnly) cmd += " -vn -acodec mp3";
        if (options.videoFormat) cmd += ` -c:v ${options.videoFormat}`;
        if (output) cmd += ` "${output}"`;
        return cmd;
      },
      
      "imagemagick": () => {
        let cmd = `convert "${input}"`;
        if (options.resize) cmd += ` -resize ${options.resize}`;
        if (options.rotate) cmd += ` -rotate ${options.rotate}`;
        if (output) cmd += ` "${output}"`;
        return cmd;
      },
      
      "jq": () => {
        let cmd = `jq '${options.filter || "."}' "${input}"`;
        if (output) cmd += ` > "${output}"`;
        return cmd;
      }
    };
    
    const commandBuilder = commands[tool.name];
    if (commandBuilder) {
      return commandBuilder();
    }
    
    // Fallback: basic command
    return `${tool.name} "${input}" ${output ? `"${output}"` : ""}`.trim();
  }
}

module.exports = { HybridToolResolver };