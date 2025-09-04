"use strict";

/**
 * ExecutionPlanner - Optimizes action execution order and handles dependencies
 * Provides intelligent scheduling and variable substitution for C9AI actions
 */

const crypto = require("node:crypto");

class ExecutionPlanner {
  constructor() {
    this.executionStrategies = {
      'sequential': this.planSequentialExecution.bind(this),
      'parallel': this.planParallelExecution.bind(this),
      'optimal': this.planOptimalExecution.bind(this),
      'dependency': this.planDependencyExecution.bind(this)
    };

    // Performance characteristics of different sigils
    this.sigilCharacteristics = {
      'calc': { cpu_intensive: false, io_bound: false, network: false, duration: 'short' },
      'read': { cpu_intensive: false, io_bound: true, network: false, duration: 'short' },
      'write': { cpu_intensive: false, io_bound: true, network: false, duration: 'short' },
      'analyze': { cpu_intensive: true, io_bound: true, network: false, duration: 'medium' },
      'system': { cpu_intensive: false, io_bound: false, network: false, duration: 'short' },
      'count': { cpu_intensive: false, io_bound: true, network: false, duration: 'short' },
      'email': { cpu_intensive: false, io_bound: false, network: true, duration: 'medium' },
      'search': { cpu_intensive: false, io_bound: false, network: true, duration: 'medium' },
      'github-fetch': { cpu_intensive: false, io_bound: false, network: true, duration: 'long' },
      'gdrive-fetch': { cpu_intensive: false, io_bound: false, network: true, duration: 'long' },
      'shell': { cpu_intensive: true, io_bound: true, network: false, duration: 'variable' },
      'compile': { cpu_intensive: true, io_bound: true, network: false, duration: 'long' }
    };
  }

  /**
   * Build comprehensive execution plan for action set
   */
  async buildExecutionPlan(actions, mode = 'optimal') {
    const plan = {
      sessionId: this.generateSessionId(),
      totalActions: actions.length,
      executionMode: mode,
      estimatedDuration: 0,
      dependencyGraph: null,
      executionOrder: [],
      parallelGroups: [],
      variableSubstitutions: [],
      resourceRequirements: {},
      riskAssessment: {},
      optimizations: [],
      warnings: []
    };

    try {
      // Analyze dependencies between actions
      plan.dependencyGraph = this.buildDependencyGraph(actions);
      
      // Analyze variable substitutions needed
      plan.variableSubstitutions = this.analyzeVariableSubstitutions(actions);
      
      // Calculate resource requirements
      plan.resourceRequirements = this.calculateResourceRequirements(actions);
      
      // Choose and execute planning strategy
      if (this.executionStrategies[mode]) {
        await this.executionStrategies[mode](actions, plan);
      } else {
        await this.planOptimalExecution(actions, plan);
      }
      
      // Calculate estimated duration
      plan.estimatedDuration = this.calculateTotalDuration(plan.executionOrder);
      
      // Add optimization suggestions
      plan.optimizations = this.suggestOptimizations(actions, plan);
      
      // Validate execution plan
      this.validateExecutionPlan(plan);

    } catch (error) {
      plan.warnings.push(`Planning failed: ${error.message}`);
      // Fallback to sequential execution
      await this.planSequentialExecution(actions, plan);
    }

    return plan;
  }

  /**
   * Build dependency graph from actions
   */
  buildDependencyGraph(actions) {
    const graph = {
      nodes: {},
      edges: [],
      levels: [],
      cycles: []
    };

    // Create nodes
    for (const action of actions) {
      graph.nodes[action.id] = {
        id: action.id,
        sigil: action.sigil,
        dependencies: [],
        dependents: [],
        level: 0
      };
    }

    // Find dependencies through variable references
    for (const action of actions) {
      const deps = this.findVariableDependencies(action, actions);
      
      for (const depId of deps) {
        if (graph.nodes[depId]) {
          graph.nodes[action.id].dependencies.push(depId);
          graph.nodes[depId].dependents.push(action.id);
          graph.edges.push({ from: depId, to: action.id });
        }
      }
    }

    // Calculate dependency levels (topological sort)
    const levels = this.calculateDependencyLevels(graph.nodes);
    graph.levels = levels;

    // Detect cycles
    graph.cycles = this.detectCycles(graph.nodes);

    return graph;
  }

  /**
   * Find variable dependencies in action arguments
   */
  findVariableDependencies(action, allActions) {
    const dependencies = new Set();
    const args = action.args || '';

    // Look for variable references like ${action-id.result} or ${action-id.output}
    const variablePattern = /\$\{([^.}]+)(?:\.[^}]+)?\}/g;
    let match;

    while ((match = variablePattern.exec(args)) !== null) {
      const referencedId = match[1];
      
      // Verify the referenced action exists
      if (allActions.find(a => a.id === referencedId)) {
        dependencies.add(referencedId);
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Calculate dependency levels for topological ordering
   */
  calculateDependencyLevels(nodes) {
    const levels = [];
    const visited = new Set();
    const currentLevel = new Set();

    // Find nodes with no dependencies (level 0)
    for (const [id, node] of Object.entries(nodes)) {
      if (node.dependencies.length === 0) {
        node.level = 0;
        currentLevel.add(id);
      }
    }

    if (currentLevel.size === 0) {
      // No root nodes - possible cycle
      return [Object.keys(nodes)]; // Fallback to single level
    }

    levels.push(Array.from(currentLevel));
    visited.add(...currentLevel);

    // Calculate subsequent levels
    let level = 1;
    while (visited.size < Object.keys(nodes).length && level < 100) { // Prevent infinite loops
      const nextLevel = new Set();

      for (const [id, node] of Object.entries(nodes)) {
        if (visited.has(id)) continue;

        // Check if all dependencies are satisfied
        const allDepsSatisfied = node.dependencies.every(depId => visited.has(depId));
        
        if (allDepsSatisfied) {
          node.level = level;
          nextLevel.add(id);
        }
      }

      if (nextLevel.size === 0) {
        // No progress - remaining nodes might have cycles
        const remaining = Object.keys(nodes).filter(id => !visited.has(id));
        if (remaining.length > 0) {
          levels.push(remaining);
          break;
        }
      } else {
        levels.push(Array.from(nextLevel));
        visited.add(...nextLevel);
      }

      level++;
    }

    return levels;
  }

  /**
   * Detect cycles in dependency graph
   */
  detectCycles(nodes) {
    const cycles = [];
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (nodeId, path) => {
      if (recursionStack.has(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const node = nodes[nodeId];
      if (node) {
        for (const depId of node.dependents) {
          dfs(depId, [...path]);
        }
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of Object.keys(nodes)) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }

    return cycles;
  }

  /**
   * Analyze variable substitutions needed
   */
  analyzeVariableSubstitutions(actions) {
    const substitutions = [];

    for (const action of actions) {
      const args = action.args || '';
      const variablePattern = /\$\{([^.}]+)\.([^}]+)\}/g;
      let match;

      while ((match = variablePattern.exec(args)) !== null) {
        substitutions.push({
          actionId: action.id,
          variableRef: match[0],
          sourceActionId: match[1],
          property: match[2],
          position: match.index
        });
      }
    }

    return substitutions;
  }

  /**
   * Calculate resource requirements for action set
   */
  calculateResourceRequirements(actions) {
    const requirements = {
      cpu_intensive_count: 0,
      io_bound_count: 0,
      network_count: 0,
      estimated_memory_mb: 0,
      requires_network: false,
      requires_file_access: false,
      requires_system_access: false
    };

    for (const action of actions) {
      const sigilName = action.sigil.slice(1);
      const characteristics = this.sigilCharacteristics[sigilName] || {};

      if (characteristics.cpu_intensive) requirements.cpu_intensive_count++;
      if (characteristics.io_bound) requirements.io_bound_count++;
      if (characteristics.network) {
        requirements.network_count++;
        requirements.requires_network = true;
      }

      // Estimate memory usage
      switch (sigilName) {
        case 'analyze':
          requirements.estimated_memory_mb += 50;
          requirements.requires_file_access = true;
          break;
        case 'compile':
          requirements.estimated_memory_mb += 100;
          requirements.requires_file_access = true;
          break;
        case 'read':
        case 'write':
          requirements.estimated_memory_mb += 10;
          requirements.requires_file_access = true;
          break;
        case 'system':
        case 'shell':
          requirements.requires_system_access = true;
          break;
        default:
          requirements.estimated_memory_mb += 5;
      }
    }

    return requirements;
  }

  /**
   * Plan sequential execution (safe fallback)
   */
  async planSequentialExecution(actions, plan) {
    plan.executionMode = 'sequential';
    plan.executionOrder = actions.map((action, index) => ({
      position: index + 1,
      actionId: action.id,
      sigil: action.sigil,
      description: action.description,
      waitFor: index > 0 ? [actions[index - 1].id] : []
    }));
    
    plan.parallelGroups = []; // No parallel execution
  }

  /**
   * Plan parallel execution where possible
   */
  async planParallelExecution(actions, plan) {
    plan.executionMode = 'parallel';
    
    if (!plan.dependencyGraph || plan.dependencyGraph.cycles.length > 0) {
      // Fall back to sequential if dependencies are complex
      return this.planSequentialExecution(actions, plan);
    }

    // Group actions by dependency level for parallel execution
    const parallelGroups = [];
    let position = 1;

    for (const levelActions of plan.dependencyGraph.levels) {
      const group = {
        groupId: parallelGroups.length + 1,
        actions: levelActions.map(actionId => {
          const action = actions.find(a => a.id === actionId);
          return {
            position: position++,
            actionId: actionId,
            sigil: action?.sigil,
            description: action?.description
          };
        }),
        canRunInParallel: true
      };
      
      parallelGroups.push(group);
    }

    plan.parallelGroups = parallelGroups;
    
    // Flatten to execution order
    plan.executionOrder = parallelGroups.flatMap(group => group.actions);
  }

  /**
   * Plan optimal execution considering performance characteristics
   */
  async planOptimalExecution(actions, plan) {
    plan.executionMode = 'optimal';

    // If there are dependencies, use dependency-based planning
    if (plan.dependencyGraph && plan.dependencyGraph.edges.length > 0) {
      return this.planDependencyExecution(actions, plan);
    }

    // Group actions by performance characteristics for optimal scheduling
    const groups = {
      fast_local: [], // calc, system, etc.
      io_operations: [], // read, write, analyze
      network_operations: [], // email, search, fetch
      cpu_intensive: [] // compile, complex analysis
    };

    for (const action of actions) {
      const sigilName = action.sigil.slice(1);
      const chars = this.sigilCharacteristics[sigilName] || {};

      if (chars.network) {
        groups.network_operations.push(action);
      } else if (chars.cpu_intensive) {
        groups.cpu_intensive.push(action);
      } else if (chars.io_bound) {
        groups.io_operations.push(action);
      } else {
        groups.fast_local.push(action);
      }
    }

    // Optimal order: fast operations first, then I/O, then CPU intensive, then network
    const optimalOrder = [
      ...groups.fast_local,
      ...groups.io_operations,
      ...groups.cpu_intensive,
      ...groups.network_operations
    ];

    let position = 1;
    plan.executionOrder = optimalOrder.map(action => ({
      position: position++,
      actionId: action.id,
      sigil: action.sigil,
      description: action.description,
      optimizationReason: this.getOptimizationReason(action)
    }));

    // Create parallel groups for network operations (can often run concurrently)
    if (groups.network_operations.length > 1) {
      plan.parallelGroups = [{
        groupId: 1,
        actions: groups.network_operations.map(action => ({
          actionId: action.id,
          sigil: action.sigil,
          description: action.description
        })),
        canRunInParallel: true,
        reason: 'Network operations can run concurrently'
      }];
    }
  }

  /**
   * Plan execution considering dependencies
   */
  async planDependencyExecution(actions, plan) {
    plan.executionMode = 'dependency';

    if (plan.dependencyGraph.cycles.length > 0) {
      plan.warnings.push('Circular dependencies detected - using sequential execution');
      return this.planSequentialExecution(actions, plan);
    }

    // Use topological ordering from dependency graph
    const parallelGroups = [];
    let position = 1;

    for (const levelActions of plan.dependencyGraph.levels) {
      // Within each level, optimize by performance characteristics
      const levelActionObjects = levelActions.map(id => actions.find(a => a.id === id));
      const optimizedOrder = this.optimizeWithinLevel(levelActionObjects);

      const group = {
        groupId: parallelGroups.length + 1,
        actions: optimizedOrder.map(action => ({
          position: position++,
          actionId: action.id,
          sigil: action.sigil,
          description: action.description
        })),
        canRunInParallel: levelActions.length > 1,
        dependencyLevel: parallelGroups.length
      };

      parallelGroups.push(group);
    }

    plan.parallelGroups = parallelGroups;
    plan.executionOrder = parallelGroups.flatMap(group => group.actions);
  }

  /**
   * Optimize action order within a dependency level
   */
  optimizeWithinLevel(actions) {
    return actions.sort((a, b) => {
      const aChars = this.sigilCharacteristics[a.sigil.slice(1)] || {};
      const bChars = this.sigilCharacteristics[b.sigil.slice(1)] || {};

      // Fast operations first
      if (!aChars.cpu_intensive && !aChars.io_bound && !aChars.network) return -1;
      if (!bChars.cpu_intensive && !bChars.io_bound && !bChars.network) return 1;

      // Then I/O operations
      if (aChars.io_bound && !bChars.io_bound) return -1;
      if (bChars.io_bound && !aChars.io_bound) return 1;

      // Then CPU intensive
      if (aChars.cpu_intensive && !bChars.cpu_intensive) return -1;
      if (bChars.cpu_intensive && !aChars.cpu_intensive) return 1;

      // Network operations last
      if (aChars.network && !bChars.network) return 1;
      if (bChars.network && !aChars.network) return -1;

      return 0;
    });
  }

  /**
   * Get optimization reason for action placement
   */
  getOptimizationReason(action) {
    const sigilName = action.sigil.slice(1);
    const chars = this.sigilCharacteristics[sigilName] || {};

    if (chars.network) return 'Network operations scheduled for parallel execution';
    if (chars.cpu_intensive) return 'CPU intensive operations scheduled after I/O';
    if (chars.io_bound) return 'I/O operations scheduled early';
    return 'Fast local operations prioritized';
  }

  /**
   * Calculate total estimated duration
   */
  calculateTotalDuration(executionOrder) {
    let totalDuration = 0;

    for (const orderItem of executionOrder) {
      const sigilName = orderItem.sigil?.slice(1);
      const estimatedTime = this.getEstimatedDuration(sigilName);
      totalDuration += estimatedTime;
    }

    return totalDuration;
  }

  /**
   * Get estimated duration for sigil
   */
  getEstimatedDuration(sigilName) {
    const durations = {
      'calc': 2,
      'read': 3,
      'write': 3,
      'system': 2,
      'count': 5,
      'analyze': 15,
      'email': 8,
      'search': 10,
      'github-fetch': 20,
      'gdrive-fetch': 25,
      'compile': 30,
      'shell': 10
    };

    return durations[sigilName] || 5;
  }

  /**
   * Suggest optimizations for the execution plan
   */
  suggestOptimizations(actions, plan) {
    const optimizations = [];

    // Check for parallelization opportunities
    if (plan.executionMode === 'sequential' && actions.length > 3) {
      optimizations.push({
        type: 'parallelization',
        suggestion: 'Consider parallel execution for independent actions',
        impact: 'Could reduce total execution time by 30-50%'
      });
    }

    // Check for resource optimization
    const networkActions = actions.filter(a => 
      ['email', 'search', 'github-fetch', 'gdrive-fetch'].includes(a.sigil.slice(1))
    );

    if (networkActions.length > 2) {
      optimizations.push({
        type: 'resource_optimization',
        suggestion: 'Group network operations to reduce latency overhead',
        impact: 'Could reduce network overhead by 20-30%'
      });
    }

    // Check for caching opportunities
    const fileOps = actions.filter(a => 
      ['read', 'analyze'].includes(a.sigil.slice(1))
    );

    if (fileOps.length > 1) {
      optimizations.push({
        type: 'caching',
        suggestion: 'Cache file reads for multiple operations on same files',
        impact: 'Could reduce I/O operations by 40-60%'
      });
    }

    return optimizations;
  }

  /**
   * Validate execution plan for correctness
   */
  validateExecutionPlan(plan) {
    const warnings = [];

    // Check that all actions are included
    if (plan.executionOrder.length !== plan.totalActions) {
      warnings.push('Execution order missing some actions');
    }

    // Check for duplicate positions
    const positions = plan.executionOrder.map(item => item.position);
    const uniquePositions = new Set(positions);
    
    if (positions.length !== uniquePositions.size) {
      warnings.push('Duplicate positions found in execution order');
    }

    // Check dependency satisfaction
    if (plan.dependencyGraph && plan.dependencyGraph.edges.length > 0) {
      for (const edge of plan.dependencyGraph.edges) {
        const fromPos = plan.executionOrder.find(item => item.actionId === edge.from)?.position;
        const toPos = plan.executionOrder.find(item => item.actionId === edge.to)?.position;
        
        if (fromPos && toPos && fromPos >= toPos) {
          warnings.push(`Dependency violation: ${edge.from} should execute before ${edge.to}`);
        }
      }
    }

    plan.warnings.push(...warnings);
  }

  /**
   * Substitute variables in action arguments
   */
  async substituteVariables(action, previousResults) {
    let args = action.args || '';
    
    const variablePattern = /\$\{([^.}]+)\.([^}]+)\}/g;
    let match;
    const substitutions = [];

    while ((match = variablePattern.exec(args)) !== null) {
      const sourceActionId = match[1];
      const property = match[2];
      const fullMatch = match[0];

      // Find result from previous execution
      const sourceResult = previousResults[sourceActionId];
      
      if (sourceResult) {
        let substitutionValue = '';
        
        // Extract the requested property
        switch (property) {
          case 'result':
            substitutionValue = sourceResult.result || sourceResult.output || '';
            break;
          case 'output':
            substitutionValue = sourceResult.output || sourceResult.result || '';
            break;
          case 'success':
            substitutionValue = sourceResult.success ? 'true' : 'false';
            break;
          case 'error':
            substitutionValue = sourceResult.error || '';
            break;
          default:
            // Try to get property directly
            substitutionValue = sourceResult[property] || '';
        }

        substitutions.push({
          variable: fullMatch,
          value: String(substitutionValue),
          sourceActionId,
          property
        });
      }
    }

    // Perform substitutions
    for (const sub of substitutions) {
      args = args.replace(sub.variable, sub.value);
    }

    return {
      originalArgs: action.args,
      substitutedArgs: args,
      substitutions: substitutions
    };
  }

  /**
   * Generate unique session ID
   */
  generateSessionId() {
    return `plan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }
}

module.exports = ExecutionPlanner;