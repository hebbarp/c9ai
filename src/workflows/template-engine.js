"use strict";

/**
 * Vibe-Based Workflow Template Engine
 * Matches user energy/context with perfect task flows
 */

const fs = require('fs').promises;
const path = require('path');

class VibeWorkflowEngine {
  constructor() {
    this.templatesPath = path.join(__dirname, 'templates');
    this.userProfilesPath = path.join(__dirname, '../user/profiles');
    this.templates = new Map();
    this.userVibeHistory = new Map();
  }

  async initialize() {
    await this.loadTemplates();
    await this.loadUserProfiles();
    console.log(`✅ Loaded ${this.templates.size} vibe-based workflow templates`);
  }

  async loadTemplates() {
    try {
      await fs.mkdir(this.templatesPath, { recursive: true });
      const templateFiles = await fs.readdir(this.templatesPath);
      
      const jsonFiles = templateFiles.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        console.log('📁 No templates found, creating default templates...');
        await this.createDefaultTemplates();
        return;
      }
      
      for (const file of jsonFiles) {
        const templatePath = path.join(this.templatesPath, file);
        const templateData = JSON.parse(await fs.readFile(templatePath, 'utf8'));
        this.templates.set(templateData.id, templateData);
      }
    } catch (error) {
      console.log('📁 Error loading templates, creating defaults...', error.message);
      await fs.mkdir(this.templatesPath, { recursive: true });
      await this.createDefaultTemplates();
    }
  }

  async createDefaultTemplates() {
    const defaultTemplates = [
      {
        id: "morning-content-creator",
        name: "Morning Content Creator",
        description: "Fresh morning energy channeled into content creation",
        vibe: {
          energy: "fresh-focused",
          mood: "creative-productive",
          duration: "90-minutes",
          bestTime: ["06:00", "10:00"],
          tags: ["creative", "content", "morning", "focused"]
        },
        flow: [
          {
            step: "inspiration-gather", 
            description: "Search for trending topics, gather inspiring content, and collect ideas for the requested content. Focus on creating original content based on the user's specific request rather than just finding existing material.",
            tools: ["web.search", "rss.read", "cream.fetch"],
            vibe: "explore",
            estimatedTime: "15-20min"
          },
          {
            step: "draft-creation",
            description: "Create the actual content requested by the user. Generate well-written, engaging content and save it to an appropriate file format (markdown, text, or HTML).",
            tools: ["ai.write", "fs.write"],
            vibe: "create", 
            estimatedTime: "30-40min"
          },
          {
            step: "visual-enhancement",
            description: "Enhance the content with visual suggestions, formatting improvements, and design recommendations. Find relevant videos or trending visual content for inspiration.",
            tools: ["youtube.search", "web.search", "fs.write"],
            vibe: "enhance",
            estimatedTime: "20-25min"
          },
          {
            step: "publish-distribute",
            description: "Prepare the content for publishing by creating platform-specific versions, suggesting distribution strategies, and providing guidance for sharing across different channels.",
            tools: ["cream.post", "cream.mail", "fs.write"],
            vibe: "share",
            estimatedTime: "10-15min"
          }
        ],
        adaptations: {
          "low-energy": {
            description: "Streamlined version for lower energy days",
            modifications: ["skip visual enhancement", "focus on curation over creation"]
          },
          "time-crunch": {
            description: "Express version for busy schedules", 
            modifications: ["use AI for rapid drafting", "minimal editing", "direct publish"]
          },
          "deep-dive": {
            description: "Extended version for thorough exploration",
            modifications: ["add research phase", "include competitor analysis", "multiple draft iterations"]
          }
        },
        triggers: {
          time: ["morning"],
          energy: ["high", "creative"],
          context: ["home-office", "quiet-space"]
        },
        credits: {
          estimated: 45,
          breakdown: {
            "web.search": 0,
            "ai.write": 15,
            "image.generate": 25,
            "social.post": 5
          }
        }
      },
      
      {
        id: "data-detective",
        name: "Data Detective Deep Dive",
        description: "Analytical immersion for data exploration and insights",
        vibe: {
          energy: "focused-analytical",
          mood: "curious-systematic",
          duration: "2-3hours",
          bestTime: ["09:00", "14:00"],
          tags: ["analytical", "data", "deep-work", "insights"]
        },
        flow: [
          {
            step: "data-discovery",
            description: "Locate and assess data sources",
            tools: ["file.scan", "api.explore", "database.connect"],
            vibe: "investigate",
            estimatedTime: "20-30min"
          },
          {
            step: "data-cleaning",
            description: "Clean and prepare data for analysis",
            tools: ["pandas.clean", "openrefine.process", "sql.transform"],
            vibe: "systematic",
            estimatedTime: "45-60min"
          },
          {
            step: "exploratory-analysis",
            description: "Discover patterns and relationships",
            tools: ["jupyter.notebook", "matplotlib.plot", "seaborn.viz"],
            vibe: "explore",
            estimatedTime: "60-90min"
          },
          {
            step: "insight-synthesis",
            description: "Transform findings into actionable insights",
            tools: ["ai.summarize", "report.generate", "presentation.create"],
            vibe: "synthesize",
            estimatedTime: "30-45min"
          }
        ],
        adaptations: {
          "quick-scan": {
            description: "Rapid data overview for initial assessment",
            modifications: ["automated profiling", "summary statistics only", "key findings highlight"]
          },
          "collaborative": {
            description: "Team-focused analysis with sharing",
            modifications: ["shared notebooks", "collaborative annotations", "team presentation"]
          },
          "production-ready": {
            description: "Analysis ready for production deployment", 
            modifications: ["automated pipeline", "testing suite", "monitoring setup"]
          }
        },
        triggers: {
          time: ["morning", "afternoon"],
          energy: ["high", "focused"],
          context: ["quiet-space", "dual-monitor"]
        },
        credits: {
          estimated: 25,
          breakdown: {
            "pandas.clean": 0,
            "jupyter.notebook": 0,
            "ai.summarize": 15,
            "report.generate": 10
          }
        }
      },

      {
        id: "rapid-prototype",
        name: "Rapid Prototype Sprint",
        description: "Fast experimental building for quick validation",
        vibe: {
          energy: "high-experimental",
          mood: "creative-urgent",
          duration: "45-60min", 
          bestTime: ["10:00", "16:00"],
          tags: ["prototype", "fast", "experimental", "validation"]
        },
        flow: [
          {
            step: "idea-capture",
            description: "Quickly capture and structure the concept",
            tools: ["mindmap.create", "ai.brainstorm", "sketch.digital"],
            vibe: "capture",
            estimatedTime: "10-15min"
          },
          {
            step: "rapid-build",
            description: "Build minimum viable version rapidly",
            tools: ["code.generate", "ui.framework", "api.mock"],
            vibe: "build",
            estimatedTime: "25-35min"
          },
          {
            step: "instant-deploy",
            description: "Get prototype live for immediate testing",
            tools: ["vercel.deploy", "netlify.publish", "github.pages"],
            vibe: "launch",
            estimatedTime: "5-10min"
          },
          {
            step: "feedback-collect",
            description: "Gather initial user feedback quickly",
            tools: ["survey.create", "analytics.track", "user.interview"],
            vibe: "validate",
            estimatedTime: "10-15min"
          }
        ],
        adaptations: {
          "solo-sprint": {
            description: "Individual rapid prototyping session",
            modifications: ["self-validation", "personal testing", "iteration planning"]
          },
          "team-hackathon": {
            description: "Collaborative rapid prototyping",
            modifications: ["role assignment", "parallel development", "integration points"]
          },
          "client-demo": {
            description: "Prototype for client presentation",
            modifications: ["polished UI", "demo script", "feedback forms"]
          }
        },
        triggers: {
          time: ["mid-morning", "afternoon"],
          energy: ["high", "creative"],
          context: ["focused-time", "experimental-mood"]
        },
        credits: {
          estimated: 35,
          breakdown: {
            "ai.brainstorm": 10,
            "code.generate": 20,
            "ui.framework": 0,
            "survey.create": 5
          }
        }
      }
    ];

    for (const template of defaultTemplates) {
      await this.saveTemplate(template);
    }
  }

  async saveTemplate(template) {
    const templatePath = path.join(this.templatesPath, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
    this.templates.set(template.id, template);
  }

  async loadUserProfiles() {
    try {
      await fs.mkdir(this.userProfilesPath, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Find templates that match current user vibe/context
   */
  async matchTemplatesForVibe(userContext) {
    const {
      currentTime,
      energyLevel,
      availableTime,
      workContext,
      recentVibes,
      goals
    } = userContext;

    const matchingTemplates = [];
    const currentHour = new Date().getHours();
    const timeCategory = this.categorizeTime(currentHour);

    for (const [id, template] of this.templates) {
      let score = 0;

      // Time matching
      if (template.triggers && template.triggers.time && template.triggers.time.includes(timeCategory)) score += 0.3;
      
      // Energy matching
      if (template.triggers && template.triggers.energy && template.triggers.energy.includes(energyLevel)) score += 0.4;
      
      // Duration matching
      const templateDuration = this.parseDuration(template.vibe.duration);
      if (templateDuration <= availableTime * 1.2) score += 0.2; // 20% buffer
      
      // Context matching
      if (template.triggers.context && workContext && template.triggers.context.some(ctx => workContext.includes(ctx))) score += 0.1;

      if (score >= 0.5) { // Minimum 50% match
        matchingTemplates.push({
          template,
          score,
          estimatedTime: templateDuration,
          estimatedCredits: template.credits.estimated
        });
      }
    }

    return matchingTemplates.sort((a, b) => b.score - a.score);
  }

  categorizeTime(hour) {
    if (hour >= 6 && hour < 10) return "morning";
    if (hour >= 10 && hour < 14) return "mid-morning";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
  }

  parseDuration(duration) {
    const match = duration.match(/(\d+)[-]?(\d+)?/);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return (min + max) / 2; // Average duration in minutes
    }
    return 60; // Default 1 hour
  }

  /**
   * Suggest template adaptations based on current constraints
   */
  adaptTemplate(template, constraints) {
    const { timeAvailable, energyLevel, context } = constraints;
    const templateDuration = this.parseDuration(template.vibe.duration);
    
    let adaptedTemplate = { ...template };
    
    if (timeAvailable < templateDuration * 0.7) {
      // Time crunch - suggest express version
      if (template.adaptations["time-crunch"]) {
        adaptedTemplate.activeAdaptation = "time-crunch";
        adaptedTemplate.flow = this.applyAdaptation(template.flow, template.adaptations["time-crunch"]);
      }
    } else if (energyLevel === "low") {
      // Low energy - suggest simplified version
      if (template.adaptations["low-energy"]) {
        adaptedTemplate.activeAdaptation = "low-energy"; 
        adaptedTemplate.flow = this.applyAdaptation(template.flow, template.adaptations["low-energy"]);
      }
    } else if (timeAvailable > templateDuration * 1.5) {
      // Lots of time - suggest deep dive
      if (template.adaptations["deep-dive"]) {
        adaptedTemplate.activeAdaptation = "deep-dive";
        adaptedTemplate.flow = this.applyAdaptation(template.flow, template.adaptations["deep-dive"]);
      }
    }
    
    return adaptedTemplate;
  }

  applyAdaptation(flow, adaptation) {
    // Apply adaptation modifications to the flow
    // This is a simplified version - real implementation would be more sophisticated
    let adaptedFlow = [...flow];
    
    for (const modification of adaptation.modifications) {
      if (modification.includes("skip")) {
        const stepToSkip = modification.split(" ")[1];
        adaptedFlow = adaptedFlow.filter(step => !step.step.includes(stepToSkip));
      }
      // Add more modification logic as needed
    }
    
    return adaptedFlow;
  }

  /**
   * Create a new custom template from user workflow
   */
  async createCustomTemplate(userId, workflowData) {
    const {
      name,
      description,
      capturedFlow,
      vibeMetrics,
      toolsUsed,
      satisfaction
    } = workflowData;

    const customTemplate = {
      id: `custom-${userId}-${Date.now()}`,
      name,
      description,
      type: "custom",
      createdBy: userId,
      createdAt: new Date().toISOString(),
      vibe: {
        energy: vibeMetrics.energy,
        mood: vibeMetrics.mood,
        duration: `${vibeMetrics.duration}min`,
        tags: vibeMetrics.tags,
        satisfaction: satisfaction
      },
      flow: capturedFlow.map((step, index) => ({
        step: step.name,
        description: step.description,
        tools: step.tools,
        vibe: step.vibe || "work",
        estimatedTime: `${step.duration}min`,
        order: index
      })),
      credits: {
        estimated: this.calculateCredits(toolsUsed),
        breakdown: this.breakdownCredits(toolsUsed)
      },
      usage: {
        timesUsed: 1,
        averageSatisfaction: satisfaction,
        lastUsed: new Date().toISOString()
      }
    };

    await this.saveTemplate(customTemplate);
    return customTemplate;
  }

  calculateCredits(toolsUsed) {
    // Calculate estimated credits based on tools used
    let total = 0;
    for (const tool of toolsUsed) {
      // This would connect to the credit system
      total += this.getToolCreditCost(tool.name) * tool.usage;
    }
    return total;
  }

  breakdownCredits(toolsUsed) {
    const breakdown = {};
    for (const tool of toolsUsed) {
      breakdown[tool.name] = this.getToolCreditCost(tool.name) * tool.usage;
    }
    return breakdown;
  }

  getToolCreditCost(toolName) {
    // This would integrate with the existing credit system
    const CREDIT_COSTS = {
      "system.tool.execute": 0,
      "web.search": 0,
      "ai.write": 15,
      "code.generate": 20,
      "image.generate": 25,
      "ai.brainstorm": 10
    };
    return CREDIT_COSTS[toolName] || 5;
  }

  /**
   * Get template recommendations based on user history and goals
   */
  async getRecommendations(userId, context) {
    const userProfile = await this.getUserProfile(userId);
    const matchingTemplates = await this.matchTemplatesForVibe(context);
    
    // Enhance recommendations based on user history
    const recommendations = matchingTemplates.map(item => {
      let recommendationScore = item.score;
      
      // Boost score for previously successful templates
      if (userProfile.successfulTemplates?.includes(item.template.id)) {
        recommendationScore += 0.2;
      }
      
      // Boost score for templates matching user goals
      if (userProfile.goals?.some(goal => 
        item.template.vibe.tags.some(tag => goal.includes(tag))
      )) {
        recommendationScore += 0.15;
      }
      
      return {
        ...item,
        recommendationScore,
        reason: this.generateRecommendationReason(item.template, context, userProfile)
      };
    });
    
    return recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }

  generateRecommendationReason(template, context, userProfile) {
    const reasons = [];
    
    if (template.vibe.energy === context.energyLevel) {
      reasons.push(`Perfect for your ${context.energyLevel} energy`);
    }
    
    if (userProfile.successfulTemplates?.includes(template.id)) {
      reasons.push("You've had great success with this before");
    }
    
    const timeCategory = this.categorizeTime(new Date().getHours());
    if (template.triggers.time.includes(timeCategory)) {
      reasons.push(`Optimized for ${timeCategory} work`);
    }
    
    return reasons.join(", ");
  }

  async getUserProfile(userId) {
    try {
      const profilePath = path.join(this.userProfilesPath, `${userId}.json`);
      const profileData = await fs.readFile(profilePath, 'utf8');
      return JSON.parse(profileData);
    } catch (error) {
      return this.createDefaultUserProfile(userId);
    }
  }

  createDefaultUserProfile(userId) {
    return {
      userId,
      createdAt: new Date().toISOString(),
      preferences: {
        preferredEnergyLevels: ["high", "focused"],
        preferredTimeSlots: ["morning", "afternoon"],
        favoriteVibes: ["creative", "analytical"]
      },
      goals: [],
      successfulTemplates: [],
      customTemplates: [],
      vibeHistory: []
    };
  }
}

module.exports = { VibeWorkflowEngine };