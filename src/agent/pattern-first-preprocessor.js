"use strict";
/**
 * Pattern-First Math Preprocessor
 * Tries pattern matching before AI to reduce cloud dependency
 */

class PatternFirstPreprocessor {
  constructor() {
    // Pre-defined patterns for common executive math problems
    this.patterns = [
      {
        name: "triangle_area",
        regex: /area.*triangle.*(?:side|sides?).*?(\d+(?:\.\d+)?).*?(?:and|is|,).*?(\d+(?:\.\d+)?)/i,
        template: (m) => `@calc 0.5 * ${m[1]} * ${m[2]}`,
        confidence: 0.9
      },
      {
        name: "compound_interest", 
        regex: /compound.*(?:interest|growth).*?(\d+(?:,?\d{3})*).*?(\d+(?:\.\d+)?)%.*?(\d+)\s*years?/i,
        template: (m) => `@calc compound(${m[1].replace(/,/g, '')}, ${parseFloat(m[2])/100}, ${m[3]})`,
        confidence: 0.95
      },
      {
        name: "roi_calculation",
        regex: /roi.*invested.*?(\d+(?:,?\d{3})*).*?(?:got|received|returned).*?(\d+(?:,?\d{3})*)/i,
        template: (m) => `@calc ((${m[2].replace(/,/g, '')} - ${m[1].replace(/,/g, '')}) / ${m[1].replace(/,/g, '')}) * 100`,
        confidence: 0.9
      },
      {
        name: "percentage_calculation",
        regex: /(\d+(?:\.\d+)?)%.*?of.*?(\d+(?:,?\d{3})*)/i,
        template: (m) => `@calc ${m[2].replace(/,/g, '')} * ${parseFloat(m[1])/100}`,
        confidence: 0.85
      },
      {
        name: "basic_arithmetic",
        regex: /(?:what\s+is\s+|calculate\s+)?(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)/i,
        template: (m) => `@calc ${m[1]} ${m[2]} ${m[3]}`,
        confidence: 0.95
      },
      {
        name: "break_even",
        regex: /break.*even.*fixed.*?(\d+(?:,?\d{3})*).*variable.*?(\d+(?:\.\d+)?).*price.*?(\d+(?:\.\d+)?)/i,
        template: (m) => `@calc ${m[1].replace(/,/g, '')} / (${m[3]} - ${m[2]})`,
        confidence: 0.9
      }
    ];
  }

  /**
   * Try pattern matching first, fall back to AI only if needed
   */
  async processWithPatterns(query) {
    console.log(`🔍 Trying pattern matching for: "${query}"`);
    
    // Try each pattern
    for (const pattern of this.patterns) {
      const match = query.match(pattern.regex);
      
      if (match) {
        try {
          const calcExpression = pattern.template(match);
          
          console.log(`✅ Pattern match found: ${pattern.name}`);
          console.log(`📐 Generated: ${calcExpression}`);
          
          return {
            success: true,
            method: 'pattern',
            patternName: pattern.name,
            originalQuery: query,
            calcExpression: calcExpression,
            confidence: pattern.confidence,
            usedAI: false
          };
          
        } catch (error) {
          console.log(`⚠️ Pattern ${pattern.name} matched but template failed: ${error.message}`);
          continue;
        }
      }
    }
    
    console.log(`❌ No patterns matched - would fall back to AI`);
    return {
      success: false,
      method: 'pattern',
      needsAI: true,
      reason: 'No pattern match found'
    };
  }

  /**
   * Get pattern coverage statistics
   */
  getCoverageStats(queries) {
    let patternMatches = 0;
    let aiNeeded = 0;
    
    for (const query of queries) {
      let matched = false;
      
      for (const pattern of this.patterns) {
        if (pattern.regex.test(query)) {
          patternMatches++;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        aiNeeded++;
      }
    }
    
    return {
      total: queries.length,
      patternCovered: patternMatches,
      aiRequired: aiNeeded,
      patternCoverage: (patternMatches / queries.length * 100).toFixed(1) + '%',
      aiDependency: (aiNeeded / queries.length * 100).toFixed(1) + '%'
    };
  }
}

module.exports = { PatternFirstPreprocessor };