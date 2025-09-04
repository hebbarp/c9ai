"use strict";

const { execSync } = require("node:child_process");
const { PackageManagerDetector } = require("./manager-detector");

/**
 * Universal Package Search Interface
 * Searches across all available package managers
 */
class UniversalPackageSearch {
  constructor() {
    this.detector = new PackageManagerDetector();
    this.searchCache = new Map();
    this.cacheTimeout = 60 * 60 * 1000; // 1 hour
  }

  /**
   * Search for packages across all available package managers
   */
  async searchAll(query, options = {}) {
    const {
      limit = 20,
      includeTypes = ["system", "language", "universal"],
      preferredManagers = [],
      timeout = 10000
    } = options;

    console.log(`🔍 Searching for "${query}" across package managers...`);

    // Check cache first
    const cacheKey = this.getCacheKey(query, options);
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      console.log("📋 Using cached search results");
      return cached.results;
    }

    // Ensure package managers are detected
    const managers = Array.from(this.detector.detectedManagers.values());
    if (managers.length === 0) {
      await this.detector.detectAll();
    }

    // Filter managers by type
    const filteredManagers = managers.filter(m => includeTypes.includes(m.type));

    // Search in parallel across all managers
    const searchPromises = filteredManagers.map(manager => 
      this.searchInManager(manager, query, { timeout })
    );

    try {
      const results = await Promise.allSettled(searchPromises);
      
      // Aggregate and process results
      const aggregatedResults = this.aggregateResults(results, query);
      
      // Cache results
      this.searchCache.set(cacheKey, {
        timestamp: Date.now(),
        results: aggregatedResults
      });

      console.log(`✅ Found ${aggregatedResults.packages.length} packages from ${aggregatedResults.sources.length} sources`);
      
      return aggregatedResults;

    } catch (error) {
      console.error("Search failed:", error.message);
      return {
        query,
        packages: [],
        sources: [],
        errors: [error.message]
      };
    }
  }

  /**
   * Search in a specific package manager
   */
  async searchInManager(manager, query, options = {}) {
    const { timeout = 5000 } = options;
    
    try {
      const command = this.detector.buildCommand(manager.name, "search", query);
      console.log(`   Searching ${manager.name}: ${command}`);
      
      const output = execSync(command, {
        stdio: "pipe",
        encoding: "utf8",
        timeout,
        maxBuffer: 5 * 1024 * 1024 // 5MB buffer
      });

      const packages = this.parseSearchOutput(manager.name, output, query);
      
      return {
        manager: manager.name,
        success: true,
        packages: packages.slice(0, 10), // Limit per manager
        rawOutput: output.length > 1000 ? output.slice(0, 1000) + "..." : output
      };

    } catch (error) {
      console.warn(`   ⚠️  ${manager.name} search failed: ${error.message.split('\n')[0]}`);
      
      return {
        manager: manager.name,
        success: false,
        packages: [],
        error: error.message
      };
    }
  }

  /**
   * Parse search output based on package manager format
   */
  parseSearchOutput(managerName, output, query) {
    const parsers = {
      brew: this.parseBrewSearch,
      npm: this.parseNpmSearch,
      pip: this.parsePipSearch,
      apt: this.parseAptSearch,
      choco: this.parseChocoSearch,
      winget: this.parseWingetSearch,
      pacman: this.parsePacmanSearch,
      snap: this.parseSnapSearch,
      cargo: this.parseCargoSearch,
      gem: this.parseGemSearch
    };

    const parser = parsers[managerName] || this.parseGenericSearch;
    return parser.call(this, output, query, managerName);
  }

  /**
   * Parse Homebrew search output
   */
  parseBrewSearch(output, query, manager) {
    const lines = output.split('\n').filter(line => line.trim());
    const packages = [];

    for (const line of lines) {
      if (line.includes('==>')) continue; // Skip headers
      
      const packageName = line.trim();
      if (packageName && packageName.toLowerCase().includes(query.toLowerCase())) {
        packages.push({
          name: packageName,
          manager,
          source: "homebrew-core",
          description: `Homebrew package: ${packageName}`,
          version: "latest",
          installCommand: `brew install ${packageName}`
        });
      }
    }

    return packages;
  }

  /**
   * Parse npm search output
   */
  parseNpmSearch(output, query, manager) {
    const packages = [];
    
    try {
      // npm search returns tabular format
      const lines = output.split('\n').slice(1); // Skip header
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.split('\t').map(p => p.trim());
        if (parts.length >= 3) {
          const [name, description, author] = parts;
          
          packages.push({
            name: name,
            manager,
            source: "npmjs.com",
            description: description || `npm package: ${name}`,
            author: author,
            version: "latest",
            installCommand: `npm install ${name}`
          });
        }
      }
    } catch (error) {
      // Fallback: simple line parsing
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes(query)) {
          const match = line.match(/^(\S+)/);
          if (match) {
            packages.push({
              name: match[1],
              manager,
              source: "npmjs.com", 
              description: line,
              version: "latest",
              installCommand: `npm install ${match[1]}`
            });
          }
        }
      }
    }

    return packages;
  }

  /**
   * Parse apt search output
   */
  parseAptSearch(output, query, manager) {
    const packages = [];
    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // apt search format: "package/suite version architecture"
      const match = line.match(/^([^/]+)\/\S+\s+(\S+)\s+\S+\s*$/);
      if (match) {
        const [, name, version] = match;
        
        // Description is usually on the next line
        const description = i + 1 < lines.length ? lines[i + 1].trim() : "";
        
        packages.push({
          name,
          manager,
          source: "debian-packages",
          description: description || `Debian package: ${name}`,
          version,
          installCommand: `apt install ${name}`
        });
      }
    }

    return packages;
  }

  /**
   * Parse pip search output (search is often disabled)
   */
  parsePipSearch(output, query, manager) {
    if (output.includes('Search disabled') || output.includes('XMLRPC request failed')) {
      // pip search is disabled, return empty results
      return [];
    }

    const packages = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(\S+)\s+\(([^)]+)\)\s*-\s*(.*)$/);
      if (match) {
        const [, name, version, description] = match;
        
        packages.push({
          name,
          manager,
          source: "pypi.org",
          description: description || `Python package: ${name}`,
          version,
          installCommand: `pip install ${name}`
        });
      }
    }

    return packages;
  }

  /**
   * Generic parser for unknown package managers
   */
  parseGenericSearch(output, query, manager) {
    const packages = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        // Try to extract package name (first word)
        const match = line.match(/^(\S+)/);
        if (match) {
          packages.push({
            name: match[1],
            manager,
            source: manager,
            description: line.trim(),
            version: "unknown",
            installCommand: `${manager} install ${match[1]}`
          });
        }
      }
    }

    return packages;
  }

  /**
   * Aggregate results from multiple package managers
   */
  aggregateResults(results, query) {
    const packages = [];
    const sources = [];
    const errors = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { manager, success, packages: pkgs, error } = result.value;
        
        if (success && pkgs) {
          packages.push(...pkgs);
          if (!sources.includes(manager)) {
            sources.push(manager);
          }
        } else if (error) {
          errors.push(`${manager}: ${error}`);
        }
      } else {
        errors.push(`Search failed: ${result.reason}`);
      }
    }

    // Deduplicate packages by name (prefer system packages)
    const uniquePackages = this.deduplicatePackages(packages);
    
    // Score and sort packages
    const scoredPackages = this.scorePackages(uniquePackages, query);

    return {
      query,
      packages: scoredPackages,
      sources,
      errors,
      timestamp: new Date().toISOString(),
      total: scoredPackages.length
    };
  }

  /**
   * Remove duplicate packages, preferring certain managers
   */
  deduplicatePackages(packages) {
    const packageMap = new Map();
    
    // Define manager priority (higher = more preferred)
    const managerPriority = {
      brew: 10, winget: 10, apt: 10,  // System managers
      npm: 8, pip: 8, cargo: 8,       // Language managers
      snap: 6, flatpak: 6,            // Universal managers
      choco: 7                        // Windows
    };

    for (const pkg of packages) {
      const key = pkg.name.toLowerCase();
      const currentPkg = packageMap.get(key);
      
      if (!currentPkg || 
          (managerPriority[pkg.manager] || 0) > (managerPriority[currentPkg.manager] || 0)) {
        packageMap.set(key, pkg);
      }
    }

    return Array.from(packageMap.values());
  }

  /**
   * Score packages based on relevance to query
   */
  scorePackages(packages, query) {
    const queryLower = query.toLowerCase();
    
    return packages.map(pkg => {
      let score = 0;
      const nameLower = pkg.name.toLowerCase();
      
      // Exact match gets highest score
      if (nameLower === queryLower) {
        score += 100;
      }
      // Name starts with query
      else if (nameLower.startsWith(queryLower)) {
        score += 80;
      }
      // Name contains query
      else if (nameLower.includes(queryLower)) {
        score += 60;
      }
      // Description contains query
      else if (pkg.description && pkg.description.toLowerCase().includes(queryLower)) {
        score += 40;
      }

      // Boost for popular/system packages
      const popularTools = ["pandoc", "ffmpeg", "git", "python", "node", "curl"];
      if (popularTools.includes(nameLower)) {
        score += 20;
      }

      // Boost for system package managers
      if (["brew", "apt", "winget"].includes(pkg.manager)) {
        score += 10;
      }

      return { ...pkg, relevanceScore: score };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get detailed information about a specific package
   */
  async getPackageInfo(packageName, managerName = null) {
    console.log(`📋 Getting info for package: ${packageName}`);

    const managers = managerName ? 
      [this.detector.detectedManagers.get(managerName)].filter(Boolean) :
      Array.from(this.detector.detectedManagers.values());

    for (const manager of managers) {
      try {
        const command = this.detector.buildCommand(manager.name, "info", packageName);
        const output = execSync(command, {
          stdio: "pipe",
          encoding: "utf8",
          timeout: 10000
        });

        const info = this.parsePackageInfo(manager.name, output, packageName);
        if (info) {
          return info;
        }
      } catch (error) {
        console.warn(`Failed to get info from ${manager.name}:`, error.message.split('\n')[0]);
      }
    }

    return null;
  }

  /**
   * Parse package info output
   */
  parsePackageInfo(managerName, output, packageName) {
    // This would be expanded with specific parsers for each manager
    return {
      name: packageName,
      manager: managerName,
      rawInfo: output,
      description: "Package information", // Would be parsed from output
      version: "latest",
      homepage: null,
      license: null,
      dependencies: [],
      size: null
    };
  }

  /**
   * Generate cache key for search
   */
  getCacheKey(query, options) {
    return `search_${query}_${JSON.stringify(options)}`.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * Clear search cache
   */
  clearCache() {
    this.searchCache.clear();
    console.log("🗑️  Search cache cleared");
  }

  /**
   * Get search statistics
   */
  getStats() {
    const managers = Array.from(this.detector.detectedManagers.values());
    
    return {
      availableManagers: managers.length,
      managersByType: {
        system: managers.filter(m => m.type === "system").map(m => m.name),
        language: managers.filter(m => m.type === "language").map(m => m.name),
        universal: managers.filter(m => m.type === "universal").map(m => m.name)
      },
      cacheEntries: this.searchCache.size,
      ecosystems: [...new Set(managers.map(m => m.ecosystem))]
    };
  }
}

module.exports = { UniversalPackageSearch };