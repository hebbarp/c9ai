"use strict";

const express = require("express");
const {
  getCatalog,
  getInstalledTools,
  getAvailableTools,
  getToolsByCategory,
  getStats,
  installTool,
  uninstallTool,
  configureTool,
  getToolDetails,
  batchInstall
} = require("./tool-registry-api");

const router = express.Router();

// Tool Registry API Routes
router.get("/api/tools/catalog", getCatalog);
router.get("/api/tools/installed", getInstalledTools);
router.get("/api/tools/available", getAvailableTools);
router.get("/api/tools/categories", getToolsByCategory);
router.get("/api/tools/stats", getStats);
router.get("/api/tools/:toolId", getToolDetails);

router.post("/api/tools/install", installTool);
router.post("/api/tools/uninstall", uninstallTool);
router.post("/api/tools/configure", configureTool);
router.post("/api/tools/batch-install", batchInstall);

module.exports = { toolRegistryRouter: router };