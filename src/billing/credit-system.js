"use strict";

const fs = require("node:fs").promises;
const path = require("node:path");

/**
 * C9AI Credit-Based Billing System
 * Claude Code style pay-as-you-go pricing
 */
class CreditSystem {
  constructor() {
    this.creditsDir = path.join(process.cwd(), ".c9ai", "credits");
    this.usersFile = path.join(this.creditsDir, "users.json");
    this.transactionsFile = path.join(this.creditsDir, "transactions.json");
    
    // Credit costs for different operations
    this.creditCosts = {
      // System operations (FREE - we orchestrate existing tools)
      "system.tool.execute": 0,
      "package.search": 0,
      "tool.detect": 0,
      
      // Package management (minimal cost for API overhead)
      "package.install": 1,
      "package.uninstall": 0.5,
      "package.info": 0.1,
      
      // LLM-powered features (main cost drivers)
      "script.generate": 10,        // Generate custom script
      "tool.recommend": 5,          // AI-powered tool recommendations  
      "workflow.create": 15,        // Create workflow template
      "code.analyze": 8,            // Code analysis and suggestions
      "document.convert.ai": 12,    // AI-enhanced document conversion
      
      // Chat and assistance
      "ai.chat.message": 2,         // Chat with AI assistant
      "ai.explain": 3,              // Explain code/concepts
      "ai.debug": 5,                // Debug assistance
      
      // Premium features
      "batch.operations": 5,        // Batch tool operations
      "custom.integration": 8,      // Custom tool integration
      "enterprise.analytics": 3    // Usage analytics and insights
    };
    
    // Credit packages (pricing in USD)
    this.creditPackages = {
      "starter": { credits: 500, price: 5.00, bonus: 0 },
      "developer": { credits: 2500, price: 20.00, bonus: 0.5 }, // 50% bonus
      "pro": { credits: 7500, price: 50.00, bonus: 0.75 },      // 75% bonus  
      "enterprise": { credits: 35000, price: 200.00, bonus: 1.0 } // 100% bonus
    };

    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.creditsDir, { recursive: true });
      
      // Initialize users file if it doesn't exist
      try {
        await fs.access(this.usersFile);
      } catch (error) {
        await fs.writeFile(this.usersFile, JSON.stringify({}));
      }
      
      // Initialize transactions file if it doesn't exist  
      try {
        await fs.access(this.transactionsFile);
      } catch (error) {
        await fs.writeFile(this.transactionsFile, JSON.stringify([]));
      }
    } catch (error) {
      console.warn("Failed to initialize credit system directories:", error.message);
    }
  }

  /**
   * Create or get user account
   */
  async getOrCreateUser(userId, userInfo = {}) {
    const users = await this.loadUsers();
    
    if (users[userId]) {
      return users[userId];
    }

    // Create new user account
    const newUser = {
      userId,
      email: userInfo.email || null,
      createdAt: new Date().toISOString(),
      credits: {
        balance: userInfo.initialCredits || 0,
        totalPurchased: userInfo.initialCredits || 0,
        totalUsed: 0,
        lastActivity: new Date().toISOString()
      },
      autoRecharge: {
        enabled: false,
        threshold: 100,
        packageId: "starter",
        paymentMethod: null
      },
      workshopCode: userInfo.workshopCode || null,
      source: userInfo.source || "direct",
      tier: userInfo.tier || "free",
      settings: {
        notifications: true,
        lowBalanceWarning: 50
      }
    };

    users[userId] = newUser;
    await this.saveUsers(users);
    
    console.log(`📝 Created new user account: ${userId} with ${newUser.credits.balance} credits`);
    return newUser;
  }

  /**
   * Activate workshop participant account
   */
  async activateWorkshopAccount(email, workshopCode, workshopInfo = {}) {
    const userId = `workshop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const user = await this.getOrCreateUser(userId, {
      email,
      initialCredits: 500, // Free starter credits for workshop
      workshopCode,
      source: "workshop",
      tier: "workshop-starter",
      ...workshopInfo
    });

    // Record the workshop credit grant
    await this.recordTransaction({
      userId,
      type: "workshop_grant",
      credits: 500,
      amount: 0, // Free
      description: `Workshop starter credits - ${workshopCode}`,
      workshopCode
    });

    return {
      userId,
      activationCode: this.generateActivationCode(userId),
      credits: user.credits.balance,
      message: "Welcome to C9AI! Your workshop account is activated with 500 free credits."
    };
  }

  /**
   * Check if user has sufficient credits for operation
   */
  async checkCredits(userId, operation, quantity = 1) {
    const user = await this.getOrCreateUser(userId);
    const cost = this.calculateCost(operation, quantity);
    
    return {
      hasCredits: user.credits.balance >= cost,
      currentBalance: user.credits.balance,
      requiredCredits: cost,
      shortfall: Math.max(0, cost - user.credits.balance)
    };
  }

  /**
   * Deduct credits for operation
   */
  async deductCredits(userId, operation, quantity = 1, metadata = {}) {
    const user = await this.getOrCreateUser(userId);
    const cost = this.calculateCost(operation, quantity);
    
    if (user.credits.balance < cost) {
      // Try auto-recharge if enabled
      if (user.autoRecharge.enabled && user.credits.balance <= user.autoRecharge.threshold) {
        const rechargeResult = await this.attemptAutoRecharge(userId);
        if (!rechargeResult.success) {
          throw new InsufficientCreditsError(
            `Insufficient credits. Required: ${cost}, Available: ${user.credits.balance}`
          );
        }
        // Reload user after recharge
        const updatedUser = await this.getOrCreateUser(userId);
        user.credits = updatedUser.credits;
      } else {
        throw new InsufficientCreditsError(
          `Insufficient credits. Required: ${cost}, Available: ${user.credits.balance}`
        );
      }
    }

    // Deduct credits
    user.credits.balance -= cost;
    user.credits.totalUsed += cost;
    user.credits.lastActivity = new Date().toISOString();

    // Update user account
    const users = await this.loadUsers();
    users[userId] = user;
    await this.saveUsers(users);

    // Record transaction
    await this.recordTransaction({
      userId,
      type: "usage",
      operation,
      quantity,
      credits: -cost, // Negative for deduction
      description: `${operation} × ${quantity}`,
      metadata
    });

    console.log(`💳 Deducted ${cost} credits from ${userId} (balance: ${user.credits.balance})`);
    
    return {
      success: true,
      creditsDeducted: cost,
      remainingBalance: user.credits.balance,
      operation,
      quantity
    };
  }

  /**
   * Add credits to user account (purchase or grant)
   */
  async addCredits(userId, credits, transactionInfo = {}) {
    const user = await this.getOrCreateUser(userId);
    
    user.credits.balance += credits;
    if (transactionInfo.type === "purchase") {
      user.credits.totalPurchased += credits;
    }
    user.credits.lastActivity = new Date().toISOString();

    // Update user account
    const users = await this.loadUsers();
    users[userId] = user;
    await this.saveUsers(users);

    // Record transaction
    await this.recordTransaction({
      userId,
      credits,
      ...transactionInfo
    });

    console.log(`💰 Added ${credits} credits to ${userId} (balance: ${user.credits.balance})`);
    
    return {
      success: true,
      creditsAdded: credits,
      newBalance: user.credits.balance
    };
  }

  /**
   * Purchase credit package
   */
  async purchaseCredits(userId, packageId, paymentInfo = {}) {
    const package_ = this.creditPackages[packageId];
    if (!package_) {
      throw new Error(`Invalid credit package: ${packageId}`);
    }

    const creditsToAdd = Math.floor(package_.credits * (1 + package_.bonus));
    
    // In real implementation, process payment here
    // For now, simulate successful payment
    const paymentResult = await this.processPayment(userId, package_.price, paymentInfo);
    
    if (paymentResult.success) {
      return await this.addCredits(userId, creditsToAdd, {
        type: "purchase",
        packageId,
        amount: package_.price,
        paymentId: paymentResult.paymentId,
        description: `${packageId} package - ${package_.credits} credits + ${Math.floor(package_.credits * package_.bonus)} bonus`
      });
    } else {
      throw new Error(`Payment failed: ${paymentResult.error}`);
    }
  }

  /**
   * Attempt automatic credit recharge
   */
  async attemptAutoRecharge(userId) {
    const user = await this.getOrCreateUser(userId);
    
    if (!user.autoRecharge.enabled || !user.autoRecharge.paymentMethod) {
      return { success: false, reason: "Auto-recharge not configured" };
    }

    try {
      const result = await this.purchaseCredits(
        userId, 
        user.autoRecharge.packageId,
        { paymentMethod: user.autoRecharge.paymentMethod }
      );
      
      console.log(`🔄 Auto-recharged ${result.creditsAdded} credits for ${userId}`);
      return { success: true, creditsAdded: result.creditsAdded };
      
    } catch (error) {
      console.error(`Failed to auto-recharge for ${userId}:`, error.message);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Get user account summary
   */
  async getUserSummary(userId) {
    const user = await this.getOrCreateUser(userId);
    const transactions = await this.getUserTransactions(userId);
    
    return {
      userId: user.userId,
      email: user.email,
      tier: user.tier,
      credits: user.credits,
      autoRecharge: user.autoRecharge,
      workshopCode: user.workshopCode,
      recentTransactions: transactions.slice(0, 10), // Last 10 transactions
      estimatedUsageCost: this.estimateUsageCost(transactions),
      accountValue: user.credits.totalPurchased,
      joinDate: user.createdAt
    };
  }

  /**
   * Calculate cost for operation
   */
  calculateCost(operation, quantity = 1) {
    const baseCost = this.creditCosts[operation] || 1; // Default to 1 credit if not defined
    return baseCost * quantity;
  }

  /**
   * Get all available operations with costs
   */
  getOperationCosts() {
    return { ...this.creditCosts };
  }

  /**
   * Get available credit packages
   */
  getCreditPackages() {
    return Object.entries(this.creditPackages).map(([id, pkg]) => ({
      id,
      credits: pkg.credits,
      bonus: Math.floor(pkg.credits * pkg.bonus),
      totalCredits: Math.floor(pkg.credits * (1 + pkg.bonus)),
      price: pkg.price,
      pricePerCredit: pkg.price / Math.floor(pkg.credits * (1 + pkg.bonus))
    }));
  }

  /**
   * Generate activation code for workshop participants
   */
  generateActivationCode(userId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `C9AI-${timestamp}-${random}`.toUpperCase();
  }

  /**
   * Load users from file
   */
  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.warn("Failed to load users file:", error.message);
      return {};
    }
  }

  /**
   * Save users to file
   */
  async saveUsers(users) {
    try {
      await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
    } catch (error) {
      console.error("Failed to save users file:", error.message);
      throw error;
    }
  }

  /**
   * Record transaction
   */
  async recordTransaction(transaction) {
    try {
      const transactions = await this.loadTransactions();
      const newTransaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        timestamp: new Date().toISOString(),
        ...transaction
      };
      
      transactions.push(newTransaction);
      await fs.writeFile(this.transactionsFile, JSON.stringify(transactions, null, 2));
      
    } catch (error) {
      console.error("Failed to record transaction:", error.message);
    }
  }

  /**
   * Load transactions from file
   */
  async loadTransactions() {
    try {
      const data = await fs.readFile(this.transactionsFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get user transactions
   */
  async getUserTransactions(userId, limit = 50) {
    const transactions = await this.loadTransactions();
    return transactions
      .filter(tx => tx.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Estimate usage cost based on transaction history
   */
  estimateUsageCost(transactions) {
    const usageTransactions = transactions.filter(tx => tx.type === "usage");
    const totalUsed = usageTransactions.reduce((sum, tx) => sum + Math.abs(tx.credits), 0);
    const days = Math.max(1, (Date.now() - new Date(transactions[transactions.length - 1]?.timestamp || Date.now())) / (1000 * 60 * 60 * 24));
    
    return {
      dailyAverage: totalUsed / days,
      monthlyEstimate: (totalUsed / days) * 30,
      mostUsedOperations: this.getMostUsedOperations(usageTransactions)
    };
  }

  /**
   * Get most used operations from transactions
   */
  getMostUsedOperations(usageTransactions) {
    const operationCounts = {};
    
    usageTransactions.forEach(tx => {
      const op = tx.operation || "unknown";
      operationCounts[op] = (operationCounts[op] || 0) + Math.abs(tx.credits);
    });
    
    return Object.entries(operationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([operation, credits]) => ({ operation, credits }));
  }

  /**
   * Simulate payment processing
   */
  async processPayment(userId, amount, paymentInfo) {
    // In real implementation, integrate with Stripe, PayPal, etc.
    console.log(`💳 Processing payment: $${amount} for user ${userId}`);
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate 95% success rate
    if (Math.random() > 0.05) {
      return {
        success: true,
        paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        amount,
        timestamp: new Date().toISOString()
      };
    } else {
      return {
        success: false,
        error: "Payment method declined"
      };
    }
  }
}

/**
 * Custom error for insufficient credits
 */
class InsufficientCreditsError extends Error {
  constructor(message) {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

module.exports = { CreditSystem, InsufficientCreditsError };