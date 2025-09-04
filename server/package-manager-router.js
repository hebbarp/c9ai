"use strict";

const express = require("express");
const {
  getPackageManagers,
  searchPackages,
  installPackage,
  uninstallPackage,
  getPackageInfo,
  getInstalledPackages
} = require("./package-manager-api");

const router = express.Router();

// Package Manager API Routes
router.get("/api/packages/managers", getPackageManagers);
router.get("/api/packages/search", searchPackages);
router.get("/api/packages/installed", getInstalledPackages);
router.get("/api/packages/:packageName/info", getPackageInfo);

router.post("/api/packages/install", installPackage);
router.post("/api/packages/uninstall", uninstallPackage);

module.exports = { packageManagerRouter: router };