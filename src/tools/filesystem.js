"use strict";

const fs = require("node:fs").promises;
const path = require("node:path");

/**
 * Read file contents
 */
async function fsRead(args) {
  const { path: filePath } = args;
  
  if (!filePath) {
    throw new Error("File path is required");
  }

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return {
      tool: "fs.read",
      success: true,
      path: filePath,
      content,
      bytes: content.length
    };
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Write file contents
 */
async function fsWrite(args) {
  const { path: filePath, content, createDirs = false } = args;
  
  if (!filePath) {
    throw new Error("File path is required");
  }
  
  if (content === undefined) {
    throw new Error("Content is required");
  }

  try {
    // Create directories if requested
    if (createDirs) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(filePath, content, "utf-8");
    
    return {
      tool: "fs.write",
      success: true,
      path: filePath,
      bytes: content.length
    };
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

module.exports = { fsRead, fsWrite };