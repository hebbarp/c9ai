"use strict";

/**
 * Vibe Matcher - Intelligent Context Detection
 * Reads user signals to understand current vibe and recommend optimal workflows
 */

class VibeMatcher {
  constructor() {
    this.vibeSignals = new Map();
    this.contextFactors = new Map();
    this.vibeProfiles = this.initializeVibeProfiles();
  }

  initializeVibeProfiles() {
    return {
      // Energy-based vibes
      "fresh-focused": {
        signals: ["morning-time", "high-energy", "clear-goals", "minimal-distractions"],
        description: "Sharp, energetic, ready to tackle complex tasks",
        bestFor: ["creative-work", "problem-solving", "deep-analysis"],
        suggestedDuration: "90-120min",
        toolPreferences: ["ai-enhanced", "systematic", "comprehensive"]
      },
      
      "creative-burst": {
        signals: ["inspiration-high", "experimental-mood", "idea-flow", "visual-thinking"],
        description: "Highly creative, experimental, visual thinking mode",
        bestFor: ["content-creation", "design-work", "brainstorming"],
        suggestedDuration: "45-90min",
        toolPreferences: ["generative", "visual", "rapid-iteration"]
      },
      
      "analytical-deep": {
        signals: ["detail-oriented", "systematic-thinking", "data-curious", "quiet-environment"],
        description: "Deep analytical mindset, systematic approach",
        bestFor: ["data-analysis", "research", "technical-deep-dives"],
        suggestedDuration: "120-180min", 
        toolPreferences: ["analytical-tools", "comprehensive", "methodical"]
      },
      
      "productive-sprint": {
        signals: ["deadline-pressure", "clear-tasks", "execution-mode", "focused-time"],
        description: "High productivity, execution-focused, deadline-driven",
        bestFor: ["task-completion", "implementation", "delivery"],
        suggestedDuration: "60-90min",
        toolPreferences: ["efficient", "streamlined", "results-oriented"]
      },
      
      "exploratory-curious": {
        signals: ["learning-mode", "discovery-interest", "experimental", "no-pressure"],
        description: "Curious exploration, learning-oriented, experimental",
        bestFor: ["skill-learning", "tool-discovery", "research"],
        suggestedDuration: "flexible",
        toolPreferences: ["educational", "exploratory", "diverse"]
      },
      
      "collaborative-sync": {
        signals: ["team-context", "communication-active", "shared-goals", "coordination-needed"],
        description: "Team-oriented, communication-heavy, coordination mode",
        bestFor: ["team-projects", "presentations", "coordination"],
        suggestedDuration: "45-120min",
        toolPreferences: ["collaborative", "communication", "shared"]
      },
      
      "maintenance-organize": {
        signals: ["cleanup-mood", "organization-needed", "systematic-approach", "improvement-focus"],
        description: "Organizational, cleanup, systematization mindset",
        bestFor: ["code-refactoring", "organization", "optimization"],
        suggestedDuration: "60-120min",
        toolPreferences: ["organizational", "systematic", "improvement"]
      },
      
      "low-energy-steady": {
        signals: ["low-energy", "routine-tasks", "minimal-complexity", "steady-progress"],
        description: "Lower energy but steady, good for routine tasks",
        bestFor: ["routine-tasks", "simple-workflows", "maintenance"],
        suggestedDuration: "30-60min",
        toolPreferences: ["simple", "automated", "minimal-effort"]
      }
    };
  }

  /**
   * Detect current user vibe based on multiple signals
   */
  detectCurrentVibe(contextSignals) {
    const {
      timeOfDay,
      recentActivity,
      energyLevel,
      workEnvironment,
      deadlines,
      goals,
      mood,
      availableTime,
      tools,
      collaboration
    } = contextSignals;

    const detectedSignals = [];
    const vibeScores = new Map();

    // Time-based signals
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) detectedSignals.push("morning-time");
    if (hour >= 14 && hour < 18) detectedSignals.push("afternoon-focus");
    if (hour >= 18 && hour < 22) detectedSignals.push("evening-wind-down");

    // Energy signals
    if (energyLevel === "high") detectedSignals.push("high-energy");
    if (energyLevel === "low") detectedSignals.push("low-energy");
    if (energyLevel === "focused") detectedSignals.push("focused-state");

    // Context signals
    if (workEnvironment === "quiet") detectedSignals.push("quiet-environment");
    if (workEnvironment === "collaborative") detectedSignals.push("team-context");
    if (deadlines && deadlines.length > 0) detectedSignals.push("deadline-pressure");
    if (mood === "creative") detectedSignals.push("creative-mood");
    if (mood === "analytical") detectedSignals.push("analytical-mood");

    // Activity-based signals
    if (recentActivity?.includes("research")) detectedSignals.push("data-curious");
    if (recentActivity?.includes("creative")) detectedSignals.push("idea-flow");
    if (recentActivity?.includes("coding")) detectedSignals.push("systematic-thinking");

    // Goal-based signals
    if (goals?.includes("learn")) detectedSignals.push("learning-mode");
    if (goals?.includes("ship")) detectedSignals.push("execution-mode");
    if (goals?.includes("explore")) detectedSignals.push("discovery-interest");

    // Calculate vibe scores
    for (const [vibeName, vibeProfile] of Object.entries(this.vibeProfiles)) {
      let score = 0;
      let matchedSignals = 0;

      for (const signal of vibeProfile.signals) {
        if (detectedSignals.includes(signal)) {
          score += 1;
          matchedSignals++;
        }
      }

      // Normalize score by signal count
      if (vibeProfile.signals.length > 0) {
        score = score / vibeProfile.signals.length;
      }

      vibeScores.set(vibeName, {
        score,
        matchedSignals,
        totalSignals: vibeProfile.signals.length,
        profile: vibeProfile
      });
    }

    // Get top vibes
    const sortedVibes = Array.from(vibeScores.entries())
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 3); // Top 3 matches

    return {
      detectedSignals,
      primaryVibe: sortedVibes[0] || null,
      alternativeVibes: sortedVibes.slice(1),
      confidence: sortedVibes[0]?.[1].score || 0,
      context: {
        timeOfDay: this.categorizeTime(hour),
        energyLevel,
        workEnvironment,
        availableTime,
        hasDeadlines: deadlines && deadlines.length > 0
      }
    };
  }

  /**
   * Get contextual recommendations based on detected vibe
   */
  getVibeRecommendations(vibeAnalysis, userPreferences = {}) {
    if (!vibeAnalysis.primaryVibe) {
      return this.getDefaultRecommendations();
    }

    const [vibeName, vibeData] = vibeAnalysis.primaryVibe;
    const vibeProfile = vibeData.profile;

    const recommendations = {
      vibe: {
        name: vibeName,
        description: vibeProfile.description,
        confidence: vibeData.score,
        matchedSignals: vibeData.matchedSignals,
        totalSignals: vibeData.totalSignals
      },
      
      suggestedWorkflows: vibeProfile.bestFor.map(workType => ({
        type: workType,
        reason: `Perfect match for your ${vibeName.replace('-', ' ')} vibe`,
        priority: this.calculateWorkflowPriority(workType, vibeAnalysis.context, userPreferences)
      })),
      
      optimalDuration: vibeProfile.suggestedDuration,
      
      toolPreferences: vibeProfile.toolPreferences,
      
      vibeEnhancers: this.getVibeEnhancers(vibeName, vibeAnalysis.context),
      
      energyManagement: this.getEnergyManagement(vibeName, vibeAnalysis.context),
      
      alternatives: vibeAnalysis.alternativeVibes.map(([altVibe, altData]) => ({
        vibe: altVibe,
        score: altData.score,
        description: altData.profile.description,
        when: `Consider if ${this.getAlternativeCondition(altVibe, vibeName)}`
      }))
    };

    return recommendations;
  }

  categorizeTime(hour) {
    if (hour >= 6 && hour < 10) return "morning";
    if (hour >= 10 && hour < 14) return "mid-morning";
    if (hour >= 14 && hour < 18) return "afternoon";
    if (hour >= 18 && hour < 22) return "evening";
    return "night";
  }

  calculateWorkflowPriority(workType, context, userPreferences) {
    let priority = 1.0;
    
    // Boost priority based on context
    if (context.hasDeadlines && workType.includes("delivery")) priority += 0.3;
    if (context.timeOfDay === "morning" && workType.includes("creative")) priority += 0.2;
    if (context.energyLevel === "high" && workType.includes("complex")) priority += 0.2;
    
    // Boost based on user preferences
    if (userPreferences.favoriteWorkTypes?.includes(workType)) priority += 0.2;
    
    return Math.min(priority, 2.0); // Cap at 2.0
  }

  getVibeEnhancers(vibeName, context) {
    const enhancers = {
      "fresh-focused": [
        "Start with energizing music or silence",
        "Clear workspace of distractions",
        "Set clear session goals upfront",
        "Use pomodoro technique for sustained focus"
      ],
      "creative-burst": [
        "Gather inspirational materials first",
        "Allow for messy exploration phase",
        "Switch between different creative tools",
        "Capture all ideas before filtering"
      ],
      "analytical-deep": [
        "Prepare all data sources beforehand",
        "Set up dual monitors for comparison",
        "Have note-taking system ready",
        "Plan break points to avoid fatigue"
      ],
      "productive-sprint": [
        "List all tasks in priority order",
        "Remove notifications and distractions",
        "Set aggressive but achievable goals",
        "Reward completion milestones"
      ],
      "exploratory-curious": [
        "Allow extra time for tangents",
        "Keep learning journal handy",
        "Try multiple approaches",
        "Focus on understanding over completion"
      ],
      "collaborative-sync": [
        "Prepare shared workspaces",
        "Test communication tools first",
        "Set clear collaboration protocols",
        "Plan for different time zones"
      ],
      "maintenance-organize": [
        "Start with quick wins for momentum",
        "Create before/after snapshots",
        "Use systematic approach",
        "Celebrate organization achievements"
      ],
      "low-energy-steady": [
        "Choose simple, familiar tasks",
        "Take regular short breaks",
        "Use automation where possible",
        "Focus on progress over perfection"
      ]
    };
    
    return enhancers[vibeName] || ["Stay hydrated", "Take breaks", "Focus on one task"];
  }

  getEnergyManagement(vibeName, context) {
    const energyAdvice = {
      "fresh-focused": {
        before: "Light movement or stretching to activate",
        during: "Maintain steady rhythm, avoid energy spikes",
        after: "Brief celebration, then gentle transition"
      },
      "creative-burst": {
        before: "Gather inspiration, clear mental space",
        during: "Follow energy waves, don't force creativity",
        after: "Capture insights, allow natural wind-down"
      },
      "analytical-deep": {
        before: "Mental warm-up with easier tasks",
        during: "Regular breaks to prevent mental fatigue",
        after: "Physical activity to reset after deep focus"
      },
      "productive-sprint": {
        before: "Quick energy boost, clear action plan",
        during: "Maintain momentum, batch similar tasks",
        after: "Proper celebration of achievements"
      },
      "low-energy-steady": {
        before: "Accept current energy level",
        during: "Work with energy, not against it",
        after: "Gentle acknowledgment of progress made"
      }
    };
    
    return energyAdvice[vibeName] || energyAdvice["low-energy-steady"];
  }

  getAlternativeCondition(altVibe, primaryVibe) {
    const conditions = {
      "fresh-focused": "you want to tackle something complex",
      "creative-burst": "inspiration strikes mid-session",
      "analytical-deep": "you discover interesting data patterns",
      "productive-sprint": "deadlines become urgent",
      "exploratory-curious": "you want to learn something new",
      "collaborative-sync": "team members become available",
      "maintenance-organize": "you notice things getting messy",
      "low-energy-steady": "energy levels drop"
    };
    
    return conditions[altVibe] || "the situation changes";
  }

  getDefaultRecommendations() {
    return {
      vibe: {
        name: "balanced-work",
        description: "General productive work session",
        confidence: 0.5
      },
      suggestedWorkflows: [
        { type: "general-productivity", reason: "Safe default choice" },
        { type: "skill-building", reason: "Always valuable" },
        { type: "organization", reason: "Usually needed" }
      ],
      optimalDuration: "60min",
      toolPreferences: ["balanced", "versatile"],
      vibeEnhancers: [
        "Start with a clear goal",
        "Keep options flexible",
        "Check in with yourself mid-session"
      ]
    };
  }

  /**
   * Learn from user behavior to improve vibe detection
   */
  recordVibeSession(userId, sessionData) {
    const {
      detectedVibe,
      selectedTemplate,
      sessionSatisfaction,
      actualDuration,
      toolsUsed,
      completionRate,
      energyAfter
    } = sessionData;

    // Store learning data for improving future recommendations
    const learningEntry = {
      timestamp: new Date().toISOString(),
      userId,
      detectedVibe,
      selectedTemplate,
      satisfaction: sessionSatisfaction,
      actualDuration,
      plannedDuration: selectedTemplate.vibe?.duration,
      toolsUsed: toolsUsed.length,
      completionRate,
      energyChange: this.calculateEnergyChange(sessionData.energyBefore, energyAfter)
    };

    // This would be stored for machine learning improvements
    return this.storeVibePattern(userId, learningEntry);
  }

  calculateEnergyChange(energyBefore, energyAfter) {
    const energyLevels = { low: 1, medium: 2, high: 3, focused: 2.5 };
    const before = energyLevels[energyBefore] || 2;
    const after = energyLevels[energyAfter] || 2;
    return after - before; // Positive = energizing, Negative = draining
  }

  async storeVibePattern(userId, learningEntry) {
    // In a real implementation, this would store to a database
    // For now, we'll just return a success indicator
    console.log(`📊 Recorded vibe pattern for ${userId}:`, {
      vibe: learningEntry.detectedVibe,
      satisfaction: learningEntry.satisfaction,
      energyChange: learningEntry.energyChange
    });
    
    return { stored: true, learningEntry };
  }
}

module.exports = { VibeMatcher };