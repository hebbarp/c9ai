"use strict";

/**
 * Vibe-Based Workflow API
 * Serves template discovery, vibe matching, and workflow customization
 */

const express = require('express');
const { VibeWorkflowEngine } = require('../src/workflows/template-engine');
const { VibeMatcher } = require('../src/workflows/vibe-matcher');
const { ToolMapper } = require('../src/workflows/tool-mapper');

class WorkflowAPI {
  constructor() {
    this.workflowEngine = new VibeWorkflowEngine();
    this.vibeMatcher = new VibeMatcher();
    this.toolMapper = new ToolMapper();
    this.router = express.Router();
    this.setupRoutes();
  }

  async initialize() {
    await this.workflowEngine.initialize();
    console.log('✅ Workflow API initialized');
  }

  setupRoutes() {
    // Vibe Detection & Analysis
    this.router.post('/api/vibe/detect', this.detectVibe.bind(this));
    this.router.post('/api/vibe/recommendations', this.getVibeRecommendations.bind(this));
    
    // Template Discovery
    this.router.get('/api/workflows/templates', this.getTemplates.bind(this));
    this.router.get('/api/workflows/templates/:id', this.getTemplate.bind(this));
    this.router.post('/api/workflows/templates/match', this.matchTemplates.bind(this));
    
    // Template Customization
    this.router.post('/api/workflows/templates/adapt', this.adaptTemplate.bind(this));
    this.router.post('/api/workflows/templates/create', this.createCustomTemplate.bind(this));
    
    // Workflow Execution
    this.router.post('/api/workflows/start', this.startWorkflow.bind(this));
    this.router.post('/api/workflows/execute-step', this.executeWorkflowStep.bind(this));
    this.router.post('/api/workflows/complete', this.completeWorkflow.bind(this));
    
    // User Profiles & Learning
    this.router.get('/api/workflows/profile/:userId', this.getUserProfile.bind(this));
    this.router.post('/api/workflows/feedback', this.recordFeedback.bind(this));
    
    // Workflow Analytics
    this.router.get('/api/workflows/analytics/:userId', this.getUserAnalytics.bind(this));
  }

  /**
   * POST /api/vibe/detect
   * Analyze current user context to detect vibe
   */
  async detectVibe(req, res) {
    try {
      const contextSignals = req.body;
      
      // Validate required fields
      if (!contextSignals.energyLevel) {
        return res.status(400).json({ 
          error: 'energyLevel is required' 
        });
      }
      
      const vibeAnalysis = this.vibeMatcher.detectCurrentVibe(contextSignals);
      
      res.json({
        success: true,
        vibe: vibeAnalysis,
        timestamp: new Date().toISOString(),
        contextAnalyzed: Object.keys(contextSignals)
      });
      
    } catch (error) {
      console.error('Vibe detection error:', error);
      res.status(500).json({
        error: 'Failed to detect vibe',
        message: error.message
      });
    }
  }

  /**
   * POST /api/vibe/recommendations
   * Get workflow recommendations based on detected vibe
   */
  async getVibeRecommendations(req, res) {
    try {
      const { vibeAnalysis, userPreferences = {} } = req.body;
      
      if (!vibeAnalysis) {
        return res.status(400).json({
          error: 'vibeAnalysis is required'
        });
      }
      
      const recommendations = this.vibeMatcher.getVibeRecommendations(
        vibeAnalysis, 
        userPreferences
      );
      
      res.json({
        success: true,
        recommendations,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Recommendations error:', error);
      res.status(500).json({
        error: 'Failed to generate recommendations',
        message: error.message
      });
    }
  }

  /**
   * GET /api/workflows/templates
   * Get all available workflow templates
   */
  async getTemplates(req, res) {
    try {
      const { category, vibe, duration, tags } = req.query;
      
      const templates = Array.from(this.workflowEngine.templates.values());
      let filteredTemplates = templates;
      
      // Apply filters
      if (category) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.vibe.tags?.includes(category)
        );
      }
      
      if (vibe) {
        filteredTemplates = filteredTemplates.filter(t => 
          t.vibe.energy === vibe || t.vibe.mood === vibe
        );
      }
      
      if (duration) {
        const maxDuration = parseInt(duration);
        filteredTemplates = filteredTemplates.filter(t => {
          const templateDuration = this.workflowEngine.parseDuration(t.vibe.duration);
          return templateDuration <= maxDuration;
        });
      }
      
      if (tags) {
        const tagList = tags.split(',');
        filteredTemplates = filteredTemplates.filter(t => 
          tagList.some(tag => t.vibe.tags?.includes(tag))
        );
      }
      
      // Format response
      const responseTemplates = filteredTemplates.map(template => ({
        id: template.id,
        name: template.name,
        description: template.description,
        vibe: template.vibe,
        estimatedDuration: template.vibe.duration,
        estimatedCredits: template.credits?.estimated || 0,
        tags: template.vibe.tags || [],
        stepCount: template.flow?.length || 0,
        type: template.type || 'default'
      }));
      
      res.json({
        success: true,
        templates: responseTemplates,
        total: responseTemplates.length,
        filters: { category, vibe, duration, tags }
      });
      
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({
        error: 'Failed to retrieve templates',
        message: error.message
      });
    }
  }

  /**
   * GET /api/workflows/templates/:id
   * Get specific template with full details
   */
  async getTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = this.workflowEngine.templates.get(id);
      
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          templateId: id
        });
      }
      
      res.json({
        success: true,
        template: template
      });
      
    } catch (error) {
      console.error('Get template error:', error);
      res.status(500).json({
        error: 'Failed to retrieve template',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/templates/match
   * Find templates that match user context
   */
  async matchTemplates(req, res) {
    try {
      const userContext = req.body;
      
      const matchingTemplates = await this.workflowEngine.matchTemplatesForVibe(userContext);
      
      res.json({
        success: true,
        matches: matchingTemplates,
        matchCount: matchingTemplates.length,
        userContext: {
          energyLevel: userContext.energyLevel,
          availableTime: userContext.availableTime,
          workContext: userContext.workContext
        }
      });
      
    } catch (error) {
      console.error('Template matching error:', error);
      res.status(500).json({
        error: 'Failed to match templates',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/templates/adapt
   * Adapt template to user constraints
   */
  async adaptTemplate(req, res) {
    try {
      const { templateId, constraints } = req.body;
      
      const template = this.workflowEngine.templates.get(templateId);
      if (!template) {
        return res.status(404).json({
          error: 'Template not found',
          templateId
        });
      }
      
      const adaptedTemplate = this.workflowEngine.adaptTemplate(template, constraints);
      
      res.json({
        success: true,
        originalTemplate: {
          id: template.id,
          name: template.name,
          duration: template.vibe.duration
        },
        adaptedTemplate: adaptedTemplate,
        adaptationApplied: adaptedTemplate.activeAdaptation || 'none',
        constraints: constraints
      });
      
    } catch (error) {
      console.error('Template adaptation error:', error);
      res.status(500).json({
        error: 'Failed to adapt template',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/templates/create
   * Create custom template from user workflow
   */
  async createCustomTemplate(req, res) {
    try {
      const { userId, workflowData } = req.body;
      
      if (!userId || !workflowData) {
        return res.status(400).json({
          error: 'userId and workflowData are required'
        });
      }
      
      const customTemplate = await this.workflowEngine.createCustomTemplate(userId, workflowData);
      
      res.json({
        success: true,
        template: customTemplate,
        message: 'Custom template created successfully'
      });
      
    } catch (error) {
      console.error('Custom template creation error:', error);
      res.status(500).json({
        error: 'Failed to create custom template',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/start
   * Start workflow session with tracking
   */
  async startWorkflow(req, res) {
    try {
      const { userId, templateId, adaptedTemplate, sessionContext } = req.body;
      
      const template = adaptedTemplate || this.workflowEngine.templates.get(templateId);
      if (!template) {
        return res.status(404).json({
          error: 'Template not found'
        });
      }
      
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const workflowSession = {
        sessionId,
        userId,
        templateId: template.id,
        templateName: template.name,
        startTime: new Date().toISOString(),
        flow: template.flow,
        currentStep: 0,
        status: 'active',
        estimatedDuration: template.vibe.duration,
        estimatedCredits: template.credits?.estimated || 0,
        sessionContext: sessionContext || {},
        adaptationUsed: template.activeAdaptation || null
      };
      
      // In production, store session in database
      // For now, return the session data
      
      res.json({
        success: true,
        session: workflowSession,
        nextStep: template.flow?.[0] || null,
        message: 'Workflow session started successfully'
      });
      
    } catch (error) {
      console.error('Start workflow error:', error);
      res.status(500).json({
        error: 'Failed to start workflow',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/complete
   * Complete workflow session and record feedback
   */
  async completeWorkflow(req, res) {
    try {
      const { sessionId, userId, completionData, feedback } = req.body;
      
      const completionRecord = {
        sessionId,
        userId,
        completedAt: new Date().toISOString(),
        actualDuration: completionData.actualDuration,
        stepsCompleted: completionData.stepsCompleted,
        totalSteps: completionData.totalSteps,
        creditsUsed: completionData.creditsUsed,
        satisfaction: feedback.satisfaction,
        energyAfter: feedback.energyAfter,
        wouldUseAgain: feedback.wouldUseAgain,
        improvements: feedback.improvements
      };
      
      // Record vibe session for learning
      if (feedback.vibeDetection) {
        await this.vibeMatcher.recordVibeSession(userId, {
          detectedVibe: feedback.vibeDetection.primaryVibe?.[0],
          selectedTemplate: { id: completionData.templateId, vibe: completionData.templateVibe },
          sessionSatisfaction: feedback.satisfaction,
          actualDuration: completionData.actualDuration,
          toolsUsed: completionData.toolsUsed || [],
          completionRate: completionData.stepsCompleted / completionData.totalSteps,
          energyBefore: feedback.energyBefore,
          energyAfter: feedback.energyAfter
        });
      }
      
      res.json({
        success: true,
        completion: completionRecord,
        message: 'Workflow completed successfully',
        learningRecorded: !!feedback.vibeDetection
      });
      
    } catch (error) {
      console.error('Complete workflow error:', error);
      res.status(500).json({
        error: 'Failed to complete workflow',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/execute-step
   * Execute workflow step with proper tool mapping
   */
  async executeWorkflowStep(req, res) {
    try {
      const { step, userInputs, stepIndex, provider = 'llamacpp' } = req.body;
      
      if (!step) {
        return res.status(400).json({
          error: 'step is required'
        });
      }

      // Map template tools to actual C9AI tools
      const mappedToolInfo = this.toolMapper.mapTools(step.tools || []);
      
      // Generate tool-specific prompt
      const toolPrompt = this.toolMapper.generateToolPrompt(step, userInputs || {}, mappedToolInfo);
      
      // Set up response for SSE streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Import agent runner here to avoid circular dependencies
      const { runStep } = require('../src/agent/runStep');
      
      // Execute with mapped tools
      const stepData = {
        prompt: toolPrompt,
        provider: provider,
        allow: mappedToolInfo.tools // Use mapped tools instead of template tools
      };
      
      // Set up progress callback for SSE
      const progressCallback = (data) => {
        try {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
          console.error('SSE write error:', error);
        }
      };
      
      // Execute the step
      try {
        await runStep(stepData, progressCallback);
        
        // Send completion
        if (!res.headersSent) {
          res.write(`data: ${JSON.stringify({
            type: 'final',
            message: 'Step completed successfully',
            mappedTools: mappedToolInfo.tools,
            originalTools: mappedToolInfo.originalTools
          })}\n\n`);
        }
      } catch (stepError) {
        console.error('Step execution error:', stepError);
        if (!res.headersSent) {
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: stepError.message,
            mappedTools: mappedToolInfo.tools,
            originalTools: mappedToolInfo.originalTools
          })}\n\n`);
        }
      }
      
      res.end();
      
    } catch (error) {
      console.error('Execute workflow step error:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to execute workflow step',
          message: error.message
        });
      }
    }
  }

  /**
   * GET /api/workflows/profile/:userId
   * Get user workflow profile and preferences
   */
  async getUserProfile(req, res) {
    try {
      const { userId } = req.params;
      const userProfile = await this.workflowEngine.getUserProfile(userId);
      
      res.json({
        success: true,
        profile: userProfile
      });
      
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        error: 'Failed to retrieve user profile',
        message: error.message
      });
    }
  }

  /**
   * POST /api/workflows/feedback
   * Record workflow feedback for improvements
   */
  async recordFeedback(req, res) {
    try {
      const { userId, feedbackData } = req.body;
      
      const feedbackRecord = {
        userId,
        timestamp: new Date().toISOString(),
        ...feedbackData
      };
      
      // In production, store feedback in database
      console.log('📝 Workflow feedback recorded:', feedbackRecord);
      
      res.json({
        success: true,
        message: 'Feedback recorded successfully'
      });
      
    } catch (error) {
      console.error('Record feedback error:', error);
      res.status(500).json({
        error: 'Failed to record feedback',
        message: error.message
      });
    }
  }

  /**
   * GET /api/workflows/analytics/:userId
   * Get user workflow analytics and insights
   */
  async getUserAnalytics(req, res) {
    try {
      const { userId } = req.params;
      const { timeframe = '30d' } = req.query;
      
      // In production, query analytics from database
      const mockAnalytics = {
        userId,
        timeframe,
        totalSessions: 45,
        totalMinutes: 2340,
        averageSatisfaction: 4.2,
        mostUsedVibes: [
          { vibe: "fresh-focused", count: 18, satisfaction: 4.5 },
          { vibe: "creative-burst", count: 12, satisfaction: 4.3 },
          { vibe: "productive-sprint", count: 10, satisfaction: 4.0 }
        ],
        mostUsedTemplates: [
          { template: "morning-content-creator", usage: 15, satisfaction: 4.4 },
          { template: "data-detective", usage: 12, satisfaction: 4.6 },
          { template: "rapid-prototype", usage: 8, satisfaction: 4.1 }
        ],
        vibeAccuracy: 0.78,
        energyTrends: {
          beforeSessions: { high: 0.4, medium: 0.45, low: 0.15 },
          afterSessions: { high: 0.35, medium: 0.55, low: 0.1 }
        },
        recommendations: [
          "Your satisfaction is highest with morning focused sessions",
          "Consider trying more analytical templates",
          "Your energy levels tend to stabilize after workflow sessions"
        ]
      };
      
      res.json({
        success: true,
        analytics: mockAnalytics,
        generatedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Get user analytics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve analytics',
        message: error.message
      });
    }
  }
}

// Create and initialize API
const workflowAPI = new WorkflowAPI();

module.exports = { 
  workflowRouter: workflowAPI.router,
  initializeWorkflowAPI: () => workflowAPI.initialize()
};