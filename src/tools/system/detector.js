"use strict";

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

/**
 * System Program Detection Engine
 * Discovers and catalogs system-installed programs
 */
class SystemProgramDetector {
  constructor() {
    this.commonPrograms = {
      // Document Processing
      "pandoc": {
        capabilities: ["document-conversion", "markdown", "pdf", "html"],
        checkCommand: "pandoc --version",
        description: "Universal document converter"
      },
      "pdflatex": {
        capabilities: ["pdf-generation", "latex", "academic"],
        checkCommand: "pdflatex --version",
        description: "LaTeX to PDF compiler"
      },
      "wkhtmltopdf": {
        capabilities: ["html-to-pdf", "pdf-generation"],
        checkCommand: "wkhtmltopdf --version",
        description: "HTML to PDF converter"
      },
      
      // Media Processing  
      "ffmpeg": {
        capabilities: ["video-processing", "audio-processing", "media-conversion"],
        checkCommand: "ffmpeg -version",
        description: "Complete multimedia processing"
      },
      "imagemagick": {
        capabilities: ["image-processing", "image-conversion", "graphics"],
        checkCommand: "magick --version || convert --version",
        description: "Image manipulation toolkit",
        aliases: ["convert", "magick"]
      },
      
      // Data Processing
      "jq": {
        capabilities: ["json-processing", "data-parsing", "filtering"],
        checkCommand: "jq --version",
        description: "JSON processor"
      },
      "csvkit": {
        capabilities: ["csv-processing", "data-analysis"],
        checkCommand: "csvstat --version",
        description: "CSV data processing toolkit"
      },
      
      // Network & Web
      "curl": {
        capabilities: ["http-requests", "api-calls", "web-scraping"],
        checkCommand: "curl --version",
        description: "HTTP client and data transfer"
      },
      "wget": {
        capabilities: ["web-scraping", "file-download"],
        checkCommand: "wget --version",
        description: "Web file retrieval"
      },
      
      // Development Tools
      "git": {
        capabilities: ["version-control", "repository-management"],
        checkCommand: "git --version",
        description: "Version control system"
      },
      "docker": {
        capabilities: ["containerization", "deployment", "virtualization"],
        checkCommand: "docker --version",
        description: "Container platform"
      },
      
      // Programming Languages
      "python": {
        capabilities: ["scripting", "data-science", "automation"],
        checkCommand: "python --version || python3 --version",
        description: "Python interpreter",
        aliases: ["python3", "py"]
      },
      "node": {
        capabilities: ["javascript", "scripting", "web-development"],
        checkCommand: "node --version",
        description: "Node.js JavaScript runtime"
      },
      "ruby": {
        capabilities: ["scripting", "automation"],
        checkCommand: "ruby --version",  
        description: "Ruby interpreter"
      },
      "go": {
        capabilities: ["systems-programming", "api-development"],
        checkCommand: "go version",
        description: "Go programming language"
      },
      
      // System Utilities
      "rsync": {
        capabilities: ["file-synchronization", "backup"],
        checkCommand: "rsync --version",
        description: "File synchronization tool"
      },
      "zip": {
        capabilities: ["compression", "archiving"],
        checkCommand: "zip --version",
        description: "Archive creation utility"
      },
      "7z": {
        capabilities: ["compression", "archiving"],
        checkCommand: "7z --version || 7za --version",
        description: "7-Zip archiver"
      }
    };
  }

  /**
   * Detect all available system programs
   */
  async detectAll() {
    console.log("🔍 Scanning system for available programs...");
    
    const detected = [];
    const results = await Promise.allSettled(
      Object.entries(this.commonPrograms).map(([name, config]) => 
        this.detectProgram(name, config)
      )
    );
    
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        detected.push(result.value);
      }
    });
    
    console.log(`✅ Detected ${detected.length} system programs`);
    return detected;
  }

  /**
   * Detect a specific program
   */
  async detectProgram(name, config) {
    try {
      const output = execSync(config.checkCommand, {
        stdio: "pipe",
        timeout: 5000,
        encoding: "utf8"
      });
      
      const version = this.extractVersion(output);
      const programInfo = {
        id: `system.${name}`,
        name: name,
        type: "system", 
        description: config.description,
        capabilities: config.capabilities,
        version: version,
        checkCommand: config.checkCommand,
        aliases: config.aliases || [],
        available: true,
        detectedAt: new Date().toISOString()
      };
      
      console.log(`   ✅ ${name} v${version}`);
      return programInfo;
      
    } catch (error) {
      // Program not available
      return null;
    }
  }

  /**
   * Extract version from command output
   */
  extractVersion(output) {
    // Common version patterns
    const patterns = [
      /version (\d+\.\d+(?:\.\d+)?)/i,
      /v(\d+\.\d+(?:\.\d+)?)/i,
      /(\d+\.\d+(?:\.\d+)?)/,
    ];
    
    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return "unknown";
  }

  /**
   * Get detailed capabilities for a program
   */
  async getProgramDetails(programName) {
    const config = this.commonPrograms[programName];
    if (!config) return null;
    
    const detected = await this.detectProgram(programName, config);
    if (!detected) return null;
    
    // Get additional details
    try {
      let helpOutput = "";
      try {
        helpOutput = execSync(`${programName} --help`, {
          stdio: "pipe",
          timeout: 3000,
          encoding: "utf8"
        });
      } catch (e) {
        // Many programs use -h instead
        try {
          helpOutput = execSync(`${programName} -h`, {
            stdio: "pipe", 
            timeout: 3000,
            encoding: "utf8"
          });
        } catch (e2) {
          // Some programs don't have help
        }
      }
      
      return {
        ...detected,
        helpText: helpOutput.slice(0, 500), // First 500 chars
        supportedFormats: this.extractSupportedFormats(programName, helpOutput),
        commonUsage: this.getCommonUsageExamples(programName)
      };
      
    } catch (error) {
      return detected; // Return basic info if details fail
    }
  }

  /**
   * Extract supported formats from help text
   */
  extractSupportedFormats(programName, helpText) {
    const formatsByProgram = {
      "pandoc": {
        input: ["markdown", "html", "docx", "epub", "latex", "rst"],
        output: ["html", "pdf", "docx", "epub", "latex", "pptx"]
      },
      "ffmpeg": {
        input: ["mp4", "avi", "mov", "mkv", "mp3", "wav", "flac"],
        output: ["mp4", "avi", "mov", "mkv", "mp3", "wav", "flac", "gif"]
      },
      "imagemagick": {
        input: ["jpg", "png", "gif", "bmp", "tiff", "svg", "pdf"],
        output: ["jpg", "png", "gif", "bmp", "tiff", "svg", "pdf"]
      }
    };
    
    return formatsByProgram[programName] || {};
  }

  /**
   * Get common usage examples for a program
   */
  getCommonUsageExamples(programName) {
    const examples = {
      "pandoc": [
        "pandoc input.md -o output.pdf",
        "pandoc input.docx -t html -o output.html",
        "pandoc input.md --pdf-engine=xelatex -o styled.pdf"
      ],
      "ffmpeg": [
        "ffmpeg -i input.mp4 -vn -acodec mp3 output.mp3",
        "ffmpeg -i input.mp4 -vf scale=720:480 output_720p.mp4",
        "ffmpeg -i input.mp4 -ss 00:01:00 -t 00:02:00 clip.mp4"
      ],
      "imagemagick": [
        "convert input.jpg -resize 50% output.jpg", 
        "convert input.png -rotate 90 output.png",
        "convert *.jpg combined.pdf"
      ],
      "jq": [
        "cat data.json | jq '.items[]'",
        "curl api.com/data | jq '.results | length'",
        "jq '.users | map(select(.active))' users.json"
      ]
    };
    
    return examples[programName] || [];
  }

  /**
   * Save detection results to registry
   */
  async saveDetectionResults(programs) {
    const registryPath = path.join(__dirname, "system-registry.json");
    
    const registry = {
      lastScan: new Date().toISOString(),
      totalPrograms: programs.length,
      programs: programs.reduce((acc, program) => {
        acc[program.id] = program;
        return acc;
      }, {})
    };
    
    await fs.promises.writeFile(
      registryPath, 
      JSON.stringify(registry, null, 2)
    );
    
    console.log(`📝 Saved ${programs.length} system programs to registry`);
    return registryPath;
  }

  /**
   * Load cached detection results
   */
  async loadCachedResults() {
    const registryPath = path.join(__dirname, "system-registry.json");
    
    try {
      const data = await fs.promises.readFile(registryPath, "utf8");
      const registry = JSON.parse(data);
      
      // Check if cache is recent (within 24 hours)
      const cacheAge = Date.now() - new Date(registry.lastScan).getTime();
      if (cacheAge < 24 * 60 * 60 * 1000) {
        console.log(`📋 Using cached system program registry (${Object.keys(registry.programs).length} programs)`);
        return Object.values(registry.programs);
      }
    } catch (error) {
      // No cache or invalid cache
    }
    
    return null;
  }
}

module.exports = { SystemProgramDetector };