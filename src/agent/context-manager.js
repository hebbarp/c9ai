"use strict";
/**
 * Context Manager - Maintains conversation context for mathematical queries
 */

class ContextManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> context
    this.maxSessions = 100;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
  }

  /**
   * Get or create session context
   */
  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        created: Date.now(),
        lastAccessed: Date.now(),
        messages: [],
        variables: {},
        pendingContext: null, // For incomplete problems
        mathMode: false
      });
    }
    
    const session = this.sessions.get(sessionId);
    session.lastAccessed = Date.now();
    return session;
  }

  /**
   * Add message to session context
   */
  addMessage(sessionId, role, content, metadata = {}) {
    const session = this.getSession(sessionId);
    
    session.messages.push({
      role,
      content,
      timestamp: Date.now(),
      ...metadata
    });
    
    // Keep only last 20 messages for efficiency
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }
    
    return session;
  }

  /**
   * Set pending context for incomplete problems
   */
  setPendingContext(sessionId, context) {
    const session = this.getSession(sessionId);
    session.pendingContext = context;
    session.mathMode = true;
    return session;
  }

  /**
   * Get pending context and clear it
   */
  consumePendingContext(sessionId) {
    const session = this.getSession(sessionId);
    const context = session.pendingContext;
    session.pendingContext = null;
    return context;
  }

  /**
   * Check if query is continuing a previous math problem
   */
  isContinuation(sessionId, query) {
    const session = this.getSession(sessionId);
    
    if (!session.pendingContext) return false;
    
    // Look for continuation indicators
    const continuationPatterns = [
      /^(it is|that is|the other|second|height|width|base)\s+\d+/i,
      /^\d+\s*(cm|m|inches?|ft|feet)/i,
      /^(and|also|then)\s+/i,
      // Diagonal measurements for shapes (most specific first)
      /d1\s*=.*d2\s*=/i,  // Removed ^ anchor to be more flexible
      /^(diagonal|diagonals?)\s+/i,
      /^(first|second)\s+(diagonal|side)\s+/i,
      // Multiple measurements with units
      /\d+\s*(cm|m|mm|inches?|ft)\s*(and|,)\s*\d+\s*(cm|m|mm|inches?|ft)/i,
      // Variable assignments
      /^\w+\s*=.*\w+\s*=/i,
      /^(length|width|height|radius)\s*[:=]/i,
      // "Sorry" corrections
      /^sorry.*here.*right.*values?/i,
      /^here.*right.*values?/i,
      /^correct.*values?/i
    ];
    
    return continuationPatterns.some(pattern => pattern.test(query.trim()));
  }

  /**
   * Build contextual prompt for math problems
   */
  buildContextualPrompt(sessionId, currentQuery) {
    const session = this.getSession(sessionId);
    
    if (this.isContinuation(sessionId, currentQuery)) {
      const context = session.pendingContext;
      if (context) {
        // Combine previous context with current input
        const contextualPrompt = `${context.problem} ${currentQuery}`;
        
        // Clear pending context since we're now complete
        session.pendingContext = null;
        session.mathMode = false;
        
        return {
          isContextual: true,
          originalQuery: currentQuery,
          contextualQuery: contextualPrompt,
          context: context
        };
      }
    }
    
    return {
      isContextual: false,
      originalQuery: currentQuery,
      contextualQuery: currentQuery
    };
  }

  /**
   * Detect incomplete math problems that need more information
   */
  detectIncompleteProblems(query, aiResponse) {
    // Patterns that indicate incomplete problems
    const incompletePatterns = [
      /need(s?)\s+(to know|the length|more information|another)/i,
      /cannot\s+(determine|calculate)\s+without/i,
      /would need\s+the\s+(length|value|measurement)/i,
      /please\s+provide\s+(the|more)/i,
      /missing\s+(information|data|measurement)/i,
      // Geometry-specific patterns
      /need.*diagonal/i,
      /provide.*diagonal/i,
      /additional\s+information/i,
      /without.*information/i,
      /given\s+information/i
    ];
    
    const isIncomplete = incompletePatterns.some(pattern => 
      pattern.test(aiResponse)
    );
    
    if (isIncomplete) {
      // Extract the problem context
      return {
        isIncomplete: true,
        problem: query,
        missingInfo: this.extractMissingInfo(aiResponse)
      };
    }
    
    return { isIncomplete: false };
  }

  /**
   * Extract what information is missing from AI response
   */
  extractMissingInfo(response) {
    const patterns = [
      { pattern: /(base|height|width|length|side)/gi, type: 'dimension' },
      { pattern: /(angle|degree)/gi, type: 'angle' },
      { pattern: /(rate|percentage)/gi, type: 'rate' },
      { pattern: /(time|period|duration)/gi, type: 'time' }
    ];
    
    const missing = [];
    patterns.forEach(({ pattern, type }) => {
      const matches = response.match(pattern);
      if (matches) {
        missing.push(...matches.map(m => ({ term: m, type })));
      }
    });
    
    return missing;
  }

  /**
   * Clean up old sessions
   */
  cleanup() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessed > this.sessionTimeout) {
        toDelete.push(sessionId);
      }
    }
    
    toDelete.forEach(id => this.sessions.delete(id));
    
    // Also limit total sessions
    if (this.sessions.size > this.maxSessions) {
      const sorted = Array.from(this.sessions.entries())
        .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
      
      const excess = this.sessions.size - this.maxSessions;
      for (let i = 0; i < excess; i++) {
        this.sessions.delete(sorted[i][0]);
      }
    }
  }

  /**
   * Get session statistics
   */
  getStats() {
    return {
      activeSessions: this.sessions.size,
      sessionsWithPendingContext: Array.from(this.sessions.values())
        .filter(s => s.pendingContext).length,
      oldestSession: Math.min(...Array.from(this.sessions.values())
        .map(s => s.created))
    };
  }
}

// Global context manager instance
const globalContextManager = new ContextManager();

// Cleanup every 5 minutes
setInterval(() => {
  globalContextManager.cleanup();
}, 5 * 60 * 1000);

module.exports = { ContextManager, globalContextManager };