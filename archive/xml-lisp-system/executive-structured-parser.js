"use strict";
/**
 * Executive Structured Query Parser
 * Converts executive bullet-point syntax to XML-Lisp functions
 */

class ExecutiveStructuredParser {
  constructor() {
    // Domain templates for XML-Lisp generation
    this.domainTemplates = {
      INVESTMENT: {
        functions: ['risk_analysis', 'portfolio_value', 'expected_return'],
        parameters: {
          'amount': { type: 'number', required: true, aliases: ['investment amount', 'principal'] },
          'upside': { type: 'percentage', required: true, aliases: ['upside potential', 'max gain'] },
          'downside': { type: 'percentage', required: true, aliases: ['downside risk', 'max loss'] },
          'years': { type: 'number', required: false, default: 1, aliases: ['time horizon', 'duration'] },
          'probability': { type: 'percentage', required: false, default: 50, aliases: ['success probability'] }
        },
        xmlTemplate: `<function name="investment_risk_analysis">
  <params>
    <param name="amount" type="number" description="Investment amount"/>
    <param name="upside" type="number" description="Upside percentage (as decimal)"/>
    <param name="downside" type="number" description="Downside percentage (as decimal)"/>
    <param name="years" type="number" description="Investment horizon in years"/>
    <param name="probability" type="number" description="Success probability (as decimal)"/>
  </params>
  <body>
    <multiply>
      <ref>amount</ref>
      <add>
        <number>1</number>
        <multiply>
          <add>
            <multiply><ref>probability</ref><ref>upside</ref></multiply>
            <multiply>
              <subtract><number>1</number><ref>probability</ref></subtract>
              <multiply><number>-1</number><ref>downside</ref></multiply>
            </multiply>
          </add>
          <ref>years</ref>
        </multiply>
      </add>
    </multiply>
  </body>
</function>`
      },

      VENDOR_DISCOUNT: {
        functions: ['discount_value', 'final_price', 'roi_analysis'],
        parameters: {
          'invoice_amount': { type: 'number', required: true, aliases: ['invoice amount', 'amount', 'total'] },
          'discount': { type: 'percentage', required: true, aliases: ['discount offered', 'discount rate'] },
          'payment_terms': { type: 'string', required: false, aliases: ['payment terms', 'terms'] }
        },
        xmlTemplate: `<function name="vendor_discount_analysis">
  <params>
    <param name="invoice_amount" type="number" description="Invoice amount"/>
    <param name="discount_rate" type="number" description="Discount rate (as decimal)"/>
  </params>
  <body>
    <multiply>
      <ref>invoice_amount</ref>
      <ref>discount_rate</ref>
    </multiply>
  </body>
</function>`
      },

      SAAS_BREAKEVEN: {
        functions: ['months_to_breakeven', 'ltv_cac_ratio', 'cash_flow'],
        parameters: {
          'cac': { type: 'number', required: true, aliases: ['customer acquisition cost', 'acquisition cost'] },
          'mrr': { type: 'number', required: true, aliases: ['monthly recurring revenue', 'monthly revenue'] },
          'churn': { type: 'percentage', required: true, aliases: ['churn rate', 'monthly churn'] },
          'fixed_costs': { type: 'number', required: false, aliases: ['fixed costs', 'overhead'] }
        },
        xmlTemplate: `<function name="saas_breakeven_analysis">
  <params>
    <param name="cac" type="number" description="Customer acquisition cost"/>
    <param name="mrr" type="number" description="Monthly recurring revenue per customer"/>
    <param name="churn_rate" type="number" description="Monthly churn rate (as decimal)"/>
  </params>
  <body>
    <divide>
      <ref>cac</ref>
      <multiply>
        <ref>mrr</ref>
        <subtract>
          <number>1</number>
          <ref>churn_rate</ref>
        </subtract>
      </multiply>
    </divide>
  </body>
</function>`
      },

      FINANCE: {
        functions: ['compound_interest', 'present_value', 'future_value'],
        parameters: {
          'principal': { type: 'number', required: true, aliases: ['amount', 'initial amount'] },
          'rate': { type: 'percentage', required: true, aliases: ['interest rate', 'annual rate'] },
          'years': { type: 'number', required: true, aliases: ['time period', 'duration'] },
          'compounding': { type: 'number', required: false, default: 1, aliases: ['compounding frequency'] }
        },
        xmlTemplate: `<function name="compound_interest">
  <params>
    <param name="principal" type="number" description="Principal amount"/>
    <param name="rate" type="number" description="Annual interest rate (as decimal)"/>
    <param name="years" type="number" description="Number of years"/>
    <param name="compounding" type="number" description="Compounding frequency per year"/>
  </params>
  <body>
    <multiply>
      <ref>principal</ref>
      <power>
        <add>
          <number>1</number>
          <divide>
            <ref>rate</ref>
            <ref>compounding</ref>
          </divide>
        </add>
        <multiply>
          <ref>compounding</ref>
          <ref>years</ref>
        </multiply>
      </power>
    </multiply>
  </body>
</function>`
      }
    };
  }

  /**
   * Parse executive structured query
   */
  parseStructuredQuery(query) {
    try {
      const lines = query.trim().split('\n');
      
      // First line should be @executive DOMAIN
      const headerMatch = lines[0].match(/^@executive\s+([A-Z_]+)/);
      if (!headerMatch) {
        return {
          success: false,
          error: 'Invalid format. Expected: @executive DOMAIN'
        };
      }

      const domain = headerMatch[1];
      const template = this.domainTemplates[domain];

      if (!template) {
        return {
          success: false,
          error: `Unknown domain: ${domain}. Available: ${Object.keys(this.domainTemplates).join(', ')}`
        };
      }

      // Parse parameters from bullet points
      const parameters = {};
      const bulletLines = lines.slice(1).filter(line => line.trim().startsWith('-'));

      for (const line of bulletLines) {
        const paramMatch = line.match(/^\s*-\s*(.+?):\s*(.+)$/);
        if (paramMatch) {
          const paramName = paramMatch[1].toLowerCase().trim();
          const paramValue = paramMatch[2].trim();

          // Find matching parameter in template
          const matchedParam = this.findMatchingParameter(template, paramName);
          if (matchedParam) {
            const processedValue = this.processParameterValue(paramValue, matchedParam.config);
            parameters[matchedParam.name] = processedValue;
          }
        }
      }

      // Validate required parameters
      const missingParams = [];
      for (const [paramName, config] of Object.entries(template.parameters)) {
        if (config.required && !parameters[paramName]) {
          missingParams.push(paramName);
        }
      }

      if (missingParams.length > 0) {
        return {
          success: false,
          error: `Missing required parameters: ${missingParams.join(', ')}`,
          template: template.parameters
        };
      }

      // Generate XML-Lisp function
      const functionName = `${domain.toLowerCase()}_analysis`;
      const xmlFunction = this.generateXMLFunction(template.xmlTemplate, parameters, functionName);

      return {
        success: true,
        domain: domain,
        functionName: functionName,
        parameters: parameters,
        xmlFunction: xmlFunction,
        executionSteps: this.generateExecutionSteps(domain, parameters, functionName)
      };

    } catch (error) {
      return {
        success: false,
        error: `Parsing failed: ${error.message}`
      };
    }
  }

  /**
   * Find matching parameter in template (handles aliases)
   */
  findMatchingParameter(template, inputName) {
    for (const [paramName, config] of Object.entries(template.parameters)) {
      if (paramName.toLowerCase() === inputName) {
        return { name: paramName, config };
      }
      
      if (config.aliases) {
        for (const alias of config.aliases) {
          if (alias.toLowerCase() === inputName) {
            return { name: paramName, config };
          }
        }
      }
    }
    return null;
  }

  /**
   * Process parameter value based on type
   */
  processParameterValue(value, config) {
    switch (config.type) {
      case 'number':
        return parseFloat(value.replace(/[,\s]/g, ''));
        
      case 'percentage':
        const numValue = parseFloat(value.replace('%', ''));
        return numValue / 100; // Convert to decimal
        
      case 'string':
        return value.replace(/['"]/g, '');
        
      default:
        return value;
    }
  }

  /**
   * Generate XML function with parameter substitution
   */
  generateXMLFunction(template, parameters, functionName) {
    let xml = template.replace(/name="[^"]*"/, `name="${functionName}"`);
    
    // This is a simplified approach - in production, you'd want more sophisticated template processing
    return xml;
  }

  /**
   * Generate execution steps for the executive
   */
  generateExecutionSteps(domain, parameters, functionName) {
    const steps = [];
    
    switch (domain) {
      case 'INVESTMENT':
        steps.push({
          order: 1,
          description: 'Calculate expected return with risk adjustment',
          command: `@calc ${functionName}(${parameters.amount}, ${parameters.upside}, ${parameters.downside}, ${parameters.years || 1}, ${parameters.probability || 0.5})`,
          explanation: 'This calculates your expected return considering both upside potential and downside risk'
        });
        break;
        
      case 'VENDOR_DISCOUNT':
        steps.push({
          order: 1,
          description: 'Calculate discount savings',
          command: `@calc ${functionName}(${parameters.invoice_amount}, ${parameters.discount})`,
          explanation: 'This shows exactly how much you save with the vendor discount'
        });
        break;
        
      case 'SAAS_BREAKEVEN':
        steps.push({
          order: 1,
          description: 'Calculate months to break even',
          command: `@calc ${functionName}(${parameters.cac}, ${parameters.mrr}, ${parameters.churn})`,
          explanation: 'This shows how many months to recover customer acquisition cost'
        });
        break;
    }
    
    return steps;
  }

  /**
   * Get available domains and their parameters
   */
  getAvailableDomains() {
    const domains = {};
    for (const [domain, template] of Object.entries(this.domainTemplates)) {
      domains[domain] = {
        description: `Business analysis for ${domain.toLowerCase().replace('_', ' ')}`,
        parameters: Object.keys(template.parameters),
        examples: this.generateExamples(domain, template)
      };
    }
    return domains;
  }

  /**
   * Generate usage examples for a domain
   */
  generateExamples(domain, template) {
    const examples = [];
    
    switch (domain) {
      case 'INVESTMENT':
        examples.push(`@executive INVESTMENT
  - amount: 100000
  - upside: 10%
  - downside: 8%
  - years: 5`);
        break;
        
      case 'VENDOR_DISCOUNT':
        examples.push(`@executive VENDOR_DISCOUNT
  - invoice amount: 10000 INR
  - discount offered: 1%
  - payment terms: immediate`);
        break;
        
      case 'SAAS_BREAKEVEN':
        examples.push(`@executive SAAS_BREAKEVEN
  - customer acquisition cost: 500
  - monthly recurring revenue: 50
  - churn rate: 5%`);
        break;
    }
    
    return examples;
  }
}

module.exports = { ExecutiveStructuredParser };