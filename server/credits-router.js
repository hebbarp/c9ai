"use strict";

const express = require("express");
const {
  getAccount,
  activateWorkshop,
  getPackages,
  purchaseCredits,
  checkCredits,
  deductCredits,
  getOperations,
  getTransactions,
  configureAutoRecharge,
  createDemoUser
} = require("./credits-api");

const router = express.Router();

// Credit System API Routes
router.get("/api/credits/account", getAccount);
router.get("/api/credits/packages", getPackages);
router.get("/api/credits/operations", getOperations);
router.get("/api/credits/transactions", getTransactions);

router.post("/api/credits/workshop/activate", activateWorkshop);
router.post("/api/credits/purchase", purchaseCredits);
router.post("/api/credits/check", checkCredits);
router.post("/api/credits/deduct", deductCredits);
router.post("/api/credits/demo", createDemoUser);

router.put("/api/credits/auto-recharge", configureAutoRecharge);

module.exports = { creditsRouter: router };