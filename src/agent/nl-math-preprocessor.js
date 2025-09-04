"use strict";
/**
 * Natural Language Math Preprocessor
 * Converts natural language math queries to @calc format
 */

const { getProvider } = require("../providers");
const { MathCalcProvider } = require("../providers/math-calc-provider");

class NLMathPreprocessor {
  constructor(options = {}) {
    this.provider = options.provider || "llamacpp"; // Default to local phi3/llamacpp
    this.fallbackProvider = options.fallbackProvider || "openai"; // Fallback to OpenAI
    console.log(`🔧 NL Math Preprocessor initialized with provider: ${this.provider}, fallback: ${this.fallbackProvider}`);
    this.confidenceThreshold = options.confidenceThreshold || 0.7;
    
    // Math detection patterns
    this.mathIndicators = [
      /what\s+is\s+\d+/i,
      /calculate|compute|solve/i,
      /\d+\s*[\+\-\*\/\%]\s*\d+/,
      /how\s+much|how\s+many/i,
      /percentage|percent|\%/i,
      /interest|compound|growth|return/i,
      /npv|irr|roi|cagr/i,
      /present\s+value|future\s+value/i,
      /profit|revenue|cost|margin/i,
      /average|mean|sum|total/i,
      /square\s+root|sqrt|power|exponent/i,
      /(\d+).*(\d+)/  // Any text with two numbers
    ];
  }

  /**
   * Check if text contains math intent
   */
  hasMathIntent(text) {
    const normalizedText = text.toLowerCase().trim();
    return this.mathIndicators.some(pattern => pattern.test(normalizedText));
  }

  /**
   * Convert natural language to @calc expression using AI
   */
  async convertToCalc(text, options = {}) {
    if (!this.hasMathIntent(text)) {
      return null;
    }

    const systemPrompt = `Convert this math question to a @calc command. Respond with ONLY the @calc expression, no explanations.

Examples:
"What is 25% of 200?" → @calc 200 * 0.25
"Calculate 45 times 8" → @calc 45 * 8  
"What's 144 divided by 12?" → @calc 144 / 12
"Find compound growth of $10000 at 7% for 10 years" → @calc compound(10000, 0.07, 10)
"ROI if I invested 50000 and got back 75000" → @calc ((75000 - 50000) / 50000) * 100
"Quarterly rental to recover 500 over 2 years with 15% return" → @calc pmt(0.15/4, 8, -500, 0)

Question: "${text}"

Respond with ONLY the @calc expression:`;

    try {
      const provider = getProvider(this.provider);
      console.log(`🤖 Using ${this.provider} directly for math conversion`);
      
      const response = await provider.call({
        messages: [{ role: "user", content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 100
      });

      const result = response.text?.trim();
      console.log(`🧠 Provider response: "${result}"`);
      
      if (!result || result === "@calc" || result.includes("NO_MATH")) {
        return null;
      }

      return {
        success: true,
        originalText: text,
        calcExpression: result,
        confidence: this.estimateConfidence(text, result)
      };

    } catch (error) {
      console.log(`⚠️ Local AI failed: ${error.message}, trying fallback...`);
      
      // Fallback to cloud provider if local fails
      if (this.fallbackProvider && this.fallbackProvider !== this.provider) {
        try {
          const fallbackProvider = getProvider(this.fallbackProvider);
          console.log(`🔄 Trying fallback: ${this.fallbackProvider} directly`);
          
          const response = await fallbackProvider.call({
            messages: [{ role: "user", content: systemPrompt }],
            temperature: 0.1,
            max_tokens: 100
          });

          const result = response.text?.trim();
          console.log(`🧠 Fallback provider response: "${result}"`);
          
          if (!result || result === "@calc" || result.includes("NO_MATH")) {
            return null;
          }

          return {
            success: true,
            originalText: text,
            calcExpression: result,
            confidence: this.estimateConfidence(text, result),
            usedFallback: true
          };

        } catch (fallbackError) {
          console.error("Both AI providers failed:", error.message, fallbackError.message);
          return null;
        }
      }
      
      console.error("NL Math conversion failed:", error.message);
      return null;
    }
  }

  /**
   * Estimate confidence in the conversion
   */
  estimateConfidence(originalText, calcExpression) {
    let confidence = 0.5; // Base confidence

    // Boost confidence for explicit math operations
    if (/[\+\-\*\/\%]/.test(originalText)) {
      confidence += 0.2;
    }

    // Boost confidence for numbers in both text and expression
    const textNumbers = originalText.match(/\d+/g) || [];
    const exprNumbers = calcExpression.match(/\d+/g) || [];
    if (textNumbers.length > 0 && exprNumbers.length > 0) {
      confidence += 0.2;
    }

    // Boost confidence for financial keywords
    if (/npv|irr|compound|cagr|roi/i.test(originalText)) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Process text and return either converted @calc or original text
   */
  async process(text, options = {}) {
    const conversion = await this.convertToCalc(text, options);
    
    if (conversion && conversion.confidence >= this.confidenceThreshold) {
      return {
        converted: true,
        originalText: text,
        processedText: conversion.calcExpression,
        confidence: conversion.confidence,
        usedFallback: conversion.usedFallback
      };
    }

    return {
      converted: false,
      originalText: text,
      processedText: text
    };
  }
}

module.exports = { NLMathPreprocessor };