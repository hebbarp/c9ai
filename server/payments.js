"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const express = require("express");
const crypto = require("node:crypto");
const { requireAuth } = require("./auth");

const router = express.Router();
const CONF_DIR = path.join(os.homedir(), ".c9ai");
const SUBSCRIPTIONS_PATH = path.join(CONF_DIR, "subscriptions.json");

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

function readSubscriptions() {
  try {
    const txt = fs.readFileSync(SUBSCRIPTIONS_PATH, "utf-8");
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

function writeSubscriptions(subscriptions) {
  ensureDir(CONF_DIR);
  fs.writeFileSync(SUBSCRIPTIONS_PATH, JSON.stringify(subscriptions, null, 2), "utf-8");
}

// Subscription plans
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    features: ['Basic chat', '10 messages/day', 'Local models only'],
    limits: {
      messagesPerDay: 10,
      aiModels: ['llamacpp']
    }
  },
  pro: {
    name: 'Pro',
    price: 19.99,
    features: ['Unlimited chat', 'All AI models', 'Agent tools', 'Priority support'],
    limits: {
      messagesPerDay: -1, // unlimited
      aiModels: ['llamacpp', 'claude', 'gemini']
    }
  },
  enterprise: {
    name: 'Enterprise',
    price: 99.99,
    features: ['Everything in Pro', 'Custom models', 'Team collaboration', 'API access'],
    limits: {
      messagesPerDay: -1,
      aiModels: ['llamacpp', 'claude', 'gemini', 'custom']
    }
  }
};

// GET /api/payments/plans
router.get("/api/payments/plans", (_req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/payments/subscription
router.get("/api/payments/subscription", requireAuth, (req, res) => {
  const subscriptions = readSubscriptions();
  const userSub = subscriptions[req.user.id] || {
    plan: 'free',
    status: 'active',
    created: new Date().toISOString(),
    usage: { messagesThisMonth: 0, lastReset: new Date().toISOString() }
  };
  
  res.json({ 
    subscription: userSub,
    planDetails: PLANS[userSub.plan]
  });
});

// POST /api/payments/create-checkout
router.post("/api/payments/create-checkout", requireAuth, express.json(), (req, res) => {
  const { planId } = req.body;
  
  if (!PLANS[planId]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  if (planId === 'free') {
    return res.status(400).json({ error: 'Cannot checkout for free plan' });
  }
  
  // In a real implementation, you would create a Stripe checkout session
  // For now, we'll simulate the process
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  res.json({
    sessionId,
    checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`,
    // For demo purposes, we'll include a mock success URL
    successUrl: `/payment-success?session_id=${sessionId}&plan=${planId}`,
    cancelUrl: '/pricing'
  });
});

// POST /api/payments/webhook
router.post("/api/payments/webhook", express.raw({type: 'application/json'}), (req, res) => {
  // In a real implementation, verify the Stripe webhook signature
  // const sig = req.headers['stripe-signature'];
  
  try {
    // Mock event processing
    const event = JSON.parse(req.body.toString());
    
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        // Update user subscription
        updateUserSubscription(session.customer, session.metadata.planId);
        break;
      case 'invoice.payment_succeeded':
        // Handle successful payment
        break;
      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        break;
    }
    
    res.json({received: true});
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// POST /api/payments/simulate-success (for demo only)
router.post("/api/payments/simulate-success", requireAuth, express.json(), (req, res) => {
  const { planId } = req.body;
  
  if (!PLANS[planId] || planId === 'free') {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  const subscriptions = readSubscriptions();
  subscriptions[req.user.id] = {
    plan: planId,
    status: 'active',
    created: new Date().toISOString(),
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    usage: { messagesThisMonth: 0, lastReset: new Date().toISOString() }
  };
  
  writeSubscriptions(subscriptions);
  
  res.json({ 
    success: true, 
    subscription: subscriptions[req.user.id]
  });
});

// POST /api/payments/cancel
router.post("/api/payments/cancel", requireAuth, (req, res) => {
  const subscriptions = readSubscriptions();
  
  if (subscriptions[req.user.id]) {
    subscriptions[req.user.id] = {
      ...subscriptions[req.user.id],
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    };
    writeSubscriptions(subscriptions);
  }
  
  res.json({ success: true });
});

// Helper function to check usage limits
function checkUsageLimit(userId, action) {
  const subscriptions = readSubscriptions();
  const userSub = subscriptions[userId] || { plan: 'free' };
  const plan = PLANS[userSub.plan];
  
  if (!plan) return false;
  
  switch (action) {
    case 'message':
      if (plan.limits.messagesPerDay === -1) return true;
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      if (!userSub.usage) {
        userSub.usage = { messagesThisMonth: 0, lastReset: today };
      }
      
      if (userSub.usage.lastReset !== today) {
        userSub.usage.messagesThisMonth = 0;
        userSub.usage.lastReset = today;
      }
      
      if (userSub.usage.messagesThisMonth >= plan.limits.messagesPerDay) {
        return false;
      }
      
      userSub.usage.messagesThisMonth++;
      subscriptions[userId] = userSub;
      writeSubscriptions(subscriptions);
      return true;
      
    default:
      return true;
  }
}

// Helper function to check model access
function checkModelAccess(userId, modelName) {
  const subscriptions = readSubscriptions();
  const userSub = subscriptions[userId] || { plan: 'free' };
  const plan = PLANS[userSub.plan];
  
  if (!plan) return false;
  return plan.limits.aiModels.includes(modelName);
}

function updateUserSubscription(customerId, planId) {
  const subscriptions = readSubscriptions();
  // In a real implementation, you'd map Stripe customer ID to your user ID
  // For now, this is a placeholder
  console.log(`Updating subscription for customer ${customerId} to plan ${planId}`);
}

module.exports = { 
  paymentsRouter: router, 
  checkUsageLimit, 
  checkModelAccess,
  PLANS
};