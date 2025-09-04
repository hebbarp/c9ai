"use strict";
// Ensure every module imports the SAME Zod instance.
// Works whether zod exposes { z } or default export.
const Z = require("zod");
const z = Z?.z || Z; // tolerate both CJS/ESM builds
module.exports = { z };