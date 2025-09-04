"use strict";

const fs = require("node:fs").promises;
const path = require("node:path");

/**
 * C9AI Global Registry Client
 * Fetches tools from the global registry (like npm/brew)
 */
class RemoteRegistryClient {
  constructor(registryUrl = "https://registry.c9ai.com") {
    this.registryUrl = registryUrl;
    this.cacheDir = path.join(process.cwd(), ".c9ai", "cache");
    this.userAgent = "c9ai-client/1.0.0";
  }

  /**
   * Fetch available tools from global registry
   */
  async fetchToolCatalog() {
    try {
      const response = await fetch(`${this.registryUrl}/api/tools`, {
        headers: { "User-Agent": this.userAgent }
      });
      
      if (!response.ok) {
        throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
      }
      
      const catalog = await response.json();
      
      // Cache the catalog locally
      await this.cacheResponse("catalog", catalog);
      
      return catalog;
    } catch (error) {
      console.warn("Failed to fetch from global registry:", error.message);
      
      // Fallback to cached catalog if available
      const cached = await this.getCachedResponse("catalog");
      if (cached) {
        console.log("Using cached catalog");
        return cached;
      }
      
      // Final fallback to local catalog
      return this.getLocalFallbackCatalog();
    }
  }

  /**
   * Fetch specific tool details
   */
  async fetchToolDetails(toolId) {
    try {
      const response = await fetch(`${this.registryUrl}/api/tools/${toolId}`, {
        headers: { "User-Agent": this.userAgent }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Tool '${toolId}' not found in global registry`);
        }
        throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn(`Failed to fetch tool ${toolId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get tool installation package
   */
  async fetchToolPackage(toolId, version = "latest") {
    try {
      const response = await fetch(`${this.registryUrl}/api/tools/${toolId}/package?version=${version}`, {
        headers: { "User-Agent": this.userAgent }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch package: ${response.status}`);
      }
      
      const packageInfo = await response.json();
      
      // Download the actual package from GitHub/CDN
      return await this.downloadPackage(packageInfo);
    } catch (error) {
      console.warn(`Failed to fetch package for ${toolId}:`, error.message);
      throw error;
    }
  }

  /**
   * Download tool package from source
   */
  async downloadPackage(packageInfo) {
    const { downloadUrl, checksum, size } = packageInfo;
    
    try {
      console.log(`📦 Downloading tool package from ${downloadUrl}`);
      
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      
      const packageData = await response.arrayBuffer();
      
      // Verify checksum if provided
      if (checksum) {
        const crypto = require("crypto");
        const hash = crypto.createHash("sha256").update(Buffer.from(packageData)).digest("hex");
        if (hash !== checksum) {
          throw new Error("Package checksum verification failed");
        }
      }
      
      return {
        data: Buffer.from(packageData),
        size: packageData.byteLength,
        verified: !!checksum
      };
    } catch (error) {
      throw new Error(`Package download failed: ${error.message}`);
    }
  }

  /**
   * Search tools in registry
   */
  async searchTools(query, category = null) {
    try {
      const params = new URLSearchParams({ q: query });
      if (category) params.append("category", category);
      
      const response = await fetch(`${this.registryUrl}/api/tools/search?${params}`, {
        headers: { "User-Agent": this.userAgent }
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.warn("Search failed:", error.message);
      return { tools: [], total: 0 };
    }
  }

  /**
   * Cache response locally
   */
  async cacheResponse(key, data) {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      const cachePath = path.join(this.cacheDir, `${key}.json`);
      
      const cacheData = {
        timestamp: Date.now(),
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        data
      };
      
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn("Failed to cache response:", error.message);
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse(key) {
    try {
      const cachePath = path.join(this.cacheDir, `${key}.json`);
      const cacheContent = await fs.readFile(cachePath, "utf-8");
      const cached = JSON.parse(cacheContent);
      
      // Check if cache is still valid
      if (Date.now() - cached.timestamp < cached.ttl) {
        return cached.data;
      }
      
      // Cache expired
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Fallback to local catalog when registry is unavailable
   */
  getLocalFallbackCatalog() {
    console.log("Using local fallback catalog");
    
    // Return current local catalog as fallback
    const localCatalogPath = path.join(__dirname, "catalog.json");
    try {
      const catalog = require(localCatalogPath);
      return catalog;
    } catch (error) {
      // Return minimal catalog
      return {
        version: "1.0.0",
        categories: {},
        tools: []
      };
    }
  }

  /**
   * Check registry health
   */
  async checkRegistryHealth() {
    try {
      const response = await fetch(`${this.registryUrl}/health`, {
        headers: { "User-Agent": this.userAgent },
        timeout: 5000
      });
      
      return {
        online: response.ok,
        status: response.status,
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        online: false,
        error: error.message,
        latency: null
      };
    }
  }
}

module.exports = { RemoteRegistryClient };