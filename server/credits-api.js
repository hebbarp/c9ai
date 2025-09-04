"use strict";

const { CreditSystem, InsufficientCreditsError } = require("../src/billing/credit-system");

/**
 * Credit System API endpoints
 */

const creditSystem = new CreditSystem();

/**
 * GET /api/credits/account - Get user account information
 */
async function getAccount(req, res) {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || 'demo_user';
    
    const summary = await creditSystem.getUserSummary(userId);
    
    res.json({
      success: true,
      account: summary
    });
    
  } catch (error) {
    console.error("Get account error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get account information", 
      message: error.message 
    });
  }
}

/**
 * POST /api/credits/workshop/activate - Activate workshop participant account
 */
async function activateWorkshop(req, res) {
  try {
    const { email, workshopCode, workshopName } = req.body;
    
    if (!email || !workshopCode) {
      return res.status(400).json({ 
        success: false, 
        error: "Email and workshop code are required" 
      });
    }

    const activation = await creditSystem.activateWorkshopAccount(email, workshopCode, {
      workshopName: workshopName || "AI Tools Workshop"
    });
    
    res.json({
      success: true,
      message: "Workshop account activated successfully",
      ...activation
    });
    
  } catch (error) {
    console.error("Workshop activation error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to activate workshop account", 
      message: error.message 
    });
  }
}

/**
 * GET /api/credits/packages - Get available credit packages
 */
async function getPackages(req, res) {
  try {
    const packages = creditSystem.getCreditPackages();
    
    res.json({
      success: true,
      packages
    });
    
  } catch (error) {
    console.error("Get packages error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get credit packages", 
      message: error.message 
    });
  }
}

/**
 * POST /api/credits/purchase - Purchase credit package
 */
async function purchaseCredits(req, res) {
  try {
    const userId = req.body.userId || req.headers['x-user-id'] || 'demo_user';
    const { packageId, paymentMethod } = req.body;
    
    if (!packageId) {
      return res.status(400).json({ 
        success: false, 
        error: "Package ID is required" 
      });
    }

    const result = await creditSystem.purchaseCredits(userId, packageId, {
      paymentMethod: paymentMethod || "demo_card"
    });
    
    res.json({
      success: true,
      message: "Credits purchased successfully",
      ...result
    });
    
  } catch (error) {
    console.error("Purchase credits error:", error);
    res.status(400).json({ 
      success: false, 
      error: "Failed to purchase credits", 
      message: error.message 
    });
  }
}

/**
 * POST /api/credits/check - Check if user has sufficient credits for operation
 */
async function checkCredits(req, res) {
  try {
    const userId = req.body.userId || req.headers['x-user-id'] || 'demo_user';
    const { operation, quantity = 1 } = req.body;
    
    if (!operation) {
      return res.status(400).json({ 
        success: false, 
        error: "Operation is required" 
      });
    }

    const check = await creditSystem.checkCredits(userId, operation, quantity);
    
    res.json({
      success: true,
      ...check
    });
    
  } catch (error) {
    console.error("Check credits error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to check credits", 
      message: error.message 
    });
  }
}

/**
 * POST /api/credits/deduct - Deduct credits for operation (internal use)
 */
async function deductCredits(req, res) {
  try {
    const userId = req.body.userId || req.headers['x-user-id'] || 'demo_user';
    const { operation, quantity = 1, metadata = {} } = req.body;
    
    if (!operation) {
      return res.status(400).json({ 
        success: false, 
        error: "Operation is required" 
      });
    }

    const result = await creditSystem.deductCredits(userId, operation, quantity, metadata);
    
    res.json(result);
    
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      res.status(402).json({ // 402 Payment Required
        success: false, 
        error: "insufficient_credits",
        message: error.message,
        suggestedAction: "purchase_credits"
      });
    } else {
      console.error("Deduct credits error:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to deduct credits", 
        message: error.message 
      });
    }
  }
}

/**
 * GET /api/credits/operations - Get all operations with costs
 */
async function getOperations(req, res) {
  try {
    const operations = creditSystem.getOperationCosts();
    
    // Group operations by category for better UX
    const categorized = {
      free: {},
      basic: {},
      ai_powered: {},
      premium: {}
    };
    
    Object.entries(operations).forEach(([operation, cost]) => {
      if (cost === 0) {
        categorized.free[operation] = cost;
      } else if (cost <= 1) {
        categorized.basic[operation] = cost;
      } else if (cost <= 10) {
        categorized.ai_powered[operation] = cost;
      } else {
        categorized.premium[operation] = cost;
      }
    });
    
    res.json({
      success: true,
      operations: {
        all: operations,
        categorized
      }
    });
    
  } catch (error) {
    console.error("Get operations error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get operations", 
      message: error.message 
    });
  }
}

/**
 * GET /api/credits/transactions - Get user transaction history
 */
async function getTransactions(req, res) {
  try {
    const userId = req.query.userId || req.headers['x-user-id'] || 'demo_user';
    const limit = parseInt(req.query.limit) || 50;
    
    const transactions = await creditSystem.getUserTransactions(userId, limit);
    
    res.json({
      success: true,
      transactions
    });
    
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to get transactions", 
      message: error.message 
    });
  }
}

/**
 * PUT /api/credits/auto-recharge - Configure auto-recharge settings
 */
async function configureAutoRecharge(req, res) {
  try {
    const userId = req.body.userId || req.headers['x-user-id'] || 'demo_user';
    const { enabled, threshold, packageId, paymentMethod } = req.body;
    
    // Get user account
    const user = await creditSystem.getOrCreateUser(userId);
    
    // Update auto-recharge settings
    user.autoRecharge = {
      enabled: enabled !== undefined ? enabled : user.autoRecharge.enabled,
      threshold: threshold !== undefined ? threshold : user.autoRecharge.threshold,
      packageId: packageId || user.autoRecharge.packageId,
      paymentMethod: paymentMethod || user.autoRecharge.paymentMethod
    };
    
    // Save updated user
    const users = await creditSystem.loadUsers();
    users[userId] = user;
    await creditSystem.saveUsers(users);
    
    res.json({
      success: true,
      message: "Auto-recharge settings updated",
      autoRecharge: user.autoRecharge
    });
    
  } catch (error) {
    console.error("Configure auto-recharge error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to configure auto-recharge", 
      message: error.message 
    });
  }
}

/**
 * Middleware to check credits before operation
 */
async function requireCredits(operation, quantity = 1) {
  return async (req, res, next) => {
    try {
      const userId = req.body.userId || req.headers['x-user-id'] || 'demo_user';
      
      // Check if user has sufficient credits
      const check = await creditSystem.checkCredits(userId, operation, quantity);
      
      if (!check.hasCredits) {
        return res.status(402).json({ // 402 Payment Required
          success: false,
          error: "insufficient_credits",
          message: `Insufficient credits. Required: ${check.requiredCredits}, Available: ${check.currentBalance}`,
          shortfall: check.shortfall,
          suggestedAction: "purchase_credits"
        });
      }
      
      // Deduct credits
      const deduction = await creditSystem.deductCredits(userId, operation, quantity, {
        endpoint: req.originalUrl,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
      
      // Add deduction info to request for logging
      req.creditDeduction = deduction;
      
      next();
      
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        res.status(402).json({
          success: false,
          error: "insufficient_credits", 
          message: error.message,
          suggestedAction: "purchase_credits"
        });
      } else {
        console.error("Credit middleware error:", error);
        res.status(500).json({
          success: false,
          error: "Credit check failed",
          message: error.message
        });
      }
    }
  };
}

/**
 * Demo endpoint that creates a sample workshop user
 */
async function createDemoUser(req, res) {
  try {
    const activation = await creditSystem.activateWorkshopAccount(
      "demo@c9ai.com", 
      "DEMO2025",
      { workshopName: "C9AI Demo Workshop" }
    );
    
    res.json({
      success: true,
      message: "Demo user created",
      ...activation,
      loginUrl: `http://localhost:8787?userId=${activation.userId}`
    });
    
  } catch (error) {
    console.error("Create demo user error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create demo user", 
      message: error.message 
    });
  }
}

module.exports = {
  getAccount,
  activateWorkshop, 
  getPackages,
  purchaseCredits,
  checkCredits,
  deductCredits,
  getOperations,
  getTransactions,
  configureAutoRecharge,
  requireCredits,
  createDemoUser,
  creditSystem // Export instance for other modules
};