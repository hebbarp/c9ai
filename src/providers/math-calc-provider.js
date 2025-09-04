"use strict";
/**
 * Math Calculation Provider
 * Wraps base providers to ensure clean @calc responses for mathematical queries
 */

class MathCalcProvider {
  constructor(baseProvider) {
    this.baseProvider = baseProvider;
    this.name = `${baseProvider.name}-math`;
  }

  async call(opts) {
    // Enhance the system prompt to ensure clean @calc responses
    const messages = [...opts.messages];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user' && lastMessage.content.includes('Convert this math question to a @calc command')) {
        // This is a math conversion request - enhance the prompt
        lastMessage.content = lastMessage.content + `

CRITICAL: Your response must contain ONLY the @calc expression. No explanations, no additional text, no line breaks after the expression.

Examples of correct responses:
- @calc 200 * 0.25
- @calc pmt(0.15/4, 8, -500, 0)
- @calc compound(10000, 0.07, 10)

Your response:`;
      }
    }

    // Call the base provider
    const response = await this.baseProvider.call({
      ...opts,
      messages,
      temperature: 0.1, // Lower temperature for more predictable math responses
      max_tokens: 100   // Shorter responses for math
    });

    // Clean the response to ensure it's a proper @calc expression
    let text = response.text?.trim() || '';
    
    // Extract @calc expression more reliably
    if (text.includes('@calc')) {
      // Find the @calc expression
      const calcMatch = text.match(/@calc\s+([^\n\r]+)/);
      if (calcMatch) {
        text = `@calc ${calcMatch[1].trim()}`;
      }
    } else if (text && !text.startsWith('@calc')) {
      // If response doesn't have @calc but contains math, add it
      const mathPatterns = [
        /pmt\s*\([^)]+\)/i,
        /(?:compound|npv|irr|fv|pv)\s*\([^)]+\)/i,
        /\d+(?:\.\d+)?\s*[+\-*/]\s*\d+(?:\.\d+)?/,
      ];
      
      const hasMath = mathPatterns.some(pattern => pattern.test(text));
      if (hasMath) {
        text = `@calc ${text}`;
      }
    }

    // Remove any trailing explanations, newlines, or extra text
    text = text.replace(/\n[\s\S]*$/, '').trim();
    text = text.replace(/["'`]/g, ''); // Remove quotes
    
    return {
      ...response,
      text
    };
  }
}

module.exports = { MathCalcProvider };