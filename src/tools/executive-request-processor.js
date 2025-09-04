"use strict";
/**
 * Executive Request Processor
 * Decomposes complex business requests into functional statements and XML-Lisp functions
 * Uses noun-verb approach for natural language analysis
 */

const { FunctionGenerator } = require('./function-generator');
const { globalRegistry } = require('./function-registry');
const jitExecutor = require('./jit-executor');

class ExecutiveRequestProcessor {
  constructor() {
    this.jitExecutor = jitExecutor;
  }

  /**
   * Process an executive request and decompose it into executable functions
   */
  async processExecutiveRequest(request) {
    try {
      console.log(`🎯 Processing executive request: "${request}"`);
      
      // 0) Deterministic calculators first (no AI) to reduce dependence on reasoning
      const quick = this.tryDeterministic(request);
      if (quick && quick.success) {
        return quick;
      }
      
      // Step 1: Decompose request into functional statements
      const decomposition = await this.decomposeRequest(request);
      
      if (!decomposition || decomposition.success === false) {
        return decomposition;
      }

      if (!Array.isArray(decomposition.statements)) {
        return { success: false, error: 'Failed to decompose executive request into statements' };
      }

      console.log(`📋 Decomposed into ${decomposition.statements.length} functional statements`);
      
      // Step 2: Generate XML-Lisp functions for each statement
      const functions = [];
      const executionPlan = [];
      
      for (const statement of decomposition.statements) {
        console.log(`🔧 Generating function for: "${statement.description}"`);
        
        // Create AI function using JIT executor
        const functionResult = await jitExecutor.execute({
          type: 'ai_create_function',
          description: statement.description
        });
        
        if (functionResult.success) {
          functions.push({
            ...functionResult,
            statement: statement,
            order: statement.order
          });
          
          executionPlan.push({
            functionName: functionResult.functionName,
            description: statement.description,
            order: statement.order,
            parameters: statement.parameters || [],
            dependencies: statement.dependencies || []
          });
        } else {
          console.log(`❌ Failed to generate function: ${functionResult.error}`);
          return {
            success: false,
            error: `Failed to generate function for: "${statement.description}" - ${functionResult.error}`,
            request
          };
        }
      }

      // Step 3: Create execution workflow
      const workflow = this.createExecutionWorkflow(executionPlan, decomposition.workflow);

      return {
        success: true,
        request,
        decomposition: decomposition.statements,
        functions: functions,
        executionPlan: executionPlan,
        workflow: workflow,
        message: `✨ Executive request processed successfully`,
        summary: `Generated ${functions.length} functions with execution workflow`,
        nextSteps: `Ready to execute workflow. Use @calc with generated functions.`
      };

    } catch (error) {
      return {
        success: false,
        error: `Executive request processing failed: ${error.message}`,
        request
      };
    }
  }

  /**
   * Try deterministic calculators for well-known domains
   */
  tryDeterministic(request) {
    try {
      const text = String(request || '').toLowerCase();
      console.log('🔎 Deterministic scan text:', text);
      // Extract explicit domain if present
      const dom = (text.match(/@(executive|exec)\s+([a-z_]+)/i) || [])[2];

      // Parse key:value pairs like "- amount: 50000 - discount: 2% - days: 20"
      const kv = {};
      try {
        const re = /([a-z_\s]+?)\s*:\s*([^\-\n\r]+)/ig;
        let m;
        while ((m = re.exec(request)) !== null) {
          const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
          const val = m[2].trim();
          kv[key] = val;
        }
      } catch {}
      // Extract numeric hints
      const amountMatch = text.match(/(?:investment|amount|principal|invest)\s*(?:of|:|=)?\s*([0-9.,]+\s*[kmb]?)/i)
        || text.match(/([0-9.,]+\s*[kmb]?)\s*(?:investment|amount|principal)/i)
        || text.match(/\b([0-9.,]+\s*[kmb]?)\b/);
      const upsideMatch = text.match(/([0-9]+\.?[0-9]*)\s*%\s*(?:upside|return|p\.a\.|pa|per\s*annum)?/i)
        || text.match(/upside\s*[:=]?\s*([0-9]+\.?[0-9]*)\s*%/i)
        || text.match(/return\s*[:=]?\s*([0-9]+\.?[0-9]*)\s*%/i);
      const yearsMatch = text.match(/([0-9]+\.?[0-9]*)\s*(?:years?|yrs?)/i)
        || text.match(/for\s+the\s+next\s+([0-9]+\.?[0-9]*)/i)
        || text.match(/years?\s*[:=]?\s*([0-9]+\.?[0-9]*)/i);
      const probMatch = text.match(/([0-9]+\.?[0-9]*)\s*%\s*(?:prob|probability|chance)/i)
        || text.match(/prob(?:ability)?\s*[:=]?\s*([0-9]+\.?[0-9]*)\s*%/i);

      if (text.includes('investment') || text.includes('invest') || text.includes('principal')) {
        const { analyzeInvestment } = require('./executive-calculators');
        const params = {
          amount: amountMatch ? amountMatch[1] : undefined,
          upside: upsideMatch ? upsideMatch[1] + '%' : undefined,
          years: yearsMatch ? yearsMatch[1] : undefined,
          probability: probMatch ? probMatch[1] + '%' : undefined
        };
        const out = analyzeInvestment(params);
        if (out.success) {
          return {
            success: true,
            type: 'executive_result',
            domain: 'INVESTMENT',
            inputs: out.inputs,
            results: out.results,
            message: '✅ Investment analysis (deterministic) complete',
            explanation: out.explanation
          };
        }
      }

      // Vendor discount
      if (dom === 'vendor_discount' || text.includes('vendor_discount') || text.includes('vendor') || text.includes('discount')) {
        const { analyzeVendorDiscount } = require('./executive-calculators');
        const discMatch = text.match(/([0-9]+\.?[0-9]*)\s*%\s*(?:discount|offered)?/i)
          || text.match(/discount\s*[:=]?\s*([0-9]+\.?[0-9]*)\s*%/i);
        const daysMatch = text.match(/([0-9]+)\s*(?:day|days)/i)
          || text.match(/days?\s*[:=]?\s*([0-9]+)/i);
        const params = {
          amount: kv.amount || kv.invoice || (amountMatch ? amountMatch[1] : undefined),
          discount: kv.discount || (discMatch ? discMatch[1] + '%' : undefined),
          days: kv.days || (daysMatch ? daysMatch[1] : undefined)
        };
        console.log('🧮 Vendor discount params:', params);
        const out = analyzeVendorDiscount(params);
        console.log('🧮 Vendor discount result:', out);
        if (out.success) {
          return { success: true, type: 'executive_result', domain: 'VENDOR_DISCOUNT', ...out };
        }
      }

      // SaaS breakeven
      if (text.includes('saas_breakeven') || text.includes('saas') || /break-?even|breakeven/.test(text)) {
        const { analyzeSaasBreakeven } = require('./executive-calculators');
        const cacMatch = text.match(/(cac|acquisition\s+cost|customer\s+acquisition\s+cost)\s*[:=]?\s*([0-9.,]+\s*[kmb]?)/i);
        const mrrMatch = text.match(/(mrr|monthly\s+recurring\s+revenue)\s*[:=]?\s*([0-9.,]+\s*[kmb]?)/i);
        const churnMatch = text.match(/([0-9]+\.?[0-9]*)\s*%\s*(?:churn)/i);
        const marginMatch = text.match(/([0-9]+\.?[0-9]*)\s*%\s*(?:margin)/i);
        const params = {
          customer_acquisition_cost: cacMatch ? cacMatch[2] : amountMatch ? amountMatch[1] : undefined,
          monthly_recurring_revenue: mrrMatch ? mrrMatch[2] : undefined,
          churn_rate: churnMatch ? churnMatch[1] + '%' : undefined,
          gross_margin: marginMatch ? marginMatch[1] + '%' : undefined
        };
        const out = analyzeSaasBreakeven(params);
        if (out.success) {
          return { success: true, type: 'executive_result', domain: 'SAAS_BREAKEVEN', ...out };
        }
      }

      // Finance compound interest
      if (text.includes('finance') || /\b(compound|interest|fv|future\s+value)\b/.test(text)) {
        const { analyzeFinanceCompound } = require('./executive-calculators');
        const rateMatch = text.match(/([0-9]+\.?[0-9]*)\s*%\s*(?:rate|apr|interest)?/i);
        const compMatch = text.match(/compounding\s*[:=]?\s*([0-9]+)/i);
        const params = {
          principal: amountMatch ? amountMatch[1] : undefined,
          rate: rateMatch ? rateMatch[1] + '%' : undefined,
          years: yearsMatch ? yearsMatch[1] : undefined,
          compounding: compMatch ? compMatch[1] : undefined
        };
        const out = analyzeFinanceCompound(params);
        if (out.success) {
          return { success: true, type: 'executive_result', domain: 'FINANCE', ...out };
        }
      }

      // Depreciation (Indian GAAP / Schedule II style inputs)
      if (dom === 'depreciation' || /\bdepreciation\b/.test(text) || /companies\s+act|schedule\s*ii|gaap/.test(text)) {
        const { analyzeDepreciation } = require('./executive-calculators');
        // method detection
        const method = (kv.method || (text.includes('wdv') ? 'wdv' : (text.includes('slm') ? 'slm' : ''))).toString();
        // life, residual, rate, dates
        const lifeKV = kv.useful_life || kv.useful_life_years;
        const resKV = kv.residual_value || kv.salvage;
        const rateKV = kv.rate || kv.rate_percent;
        const readyKV = kv.date_ready || kv.ready_date || kv.put_to_use;
        const yearEndKV = kv.year_end || kv.reporting_date || kv.year_close;
        const params = {
          cost: kv.cost || kv.amount || amountMatch?.[1],
          method,
          useful_life_years: lifeKV,
          residual_value: resKV,
          rate: rateKV,
          date_ready: readyKV,
          year_end: yearEndKV
        };
        const out = analyzeDepreciation(params);
        if (out.success) {
          return { success: true, type: 'executive_result', domain: 'DEPRECIATION', ...out };
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Decompose executive request into functional statements using noun-verb analysis
   */
  async decomposeRequest(request) {
    try {
      // Business context patterns for common executive requests
      const businessPatterns = {
        investment_inflation: {
          pattern: /compare.*investment.*inflation|inflation.*investment.*present value/i,
          statements: [
            {
              order: 1,
              description: "Calculate real return adjusted for inflation",
              noun: "real_return",
              verb: "calculate",
              parameters: ["nominal_return", "inflation_rate", "time_period"]
            },
            {
              order: 2,
              description: "Calculate present value of future amount",
              noun: "present_value",
              verb: "calculate",
              parameters: ["future_value", "discount_rate", "periods"],
              dependencies: ["real_return"]
            }
          ],
          workflow: "inflation_analysis"
        },
        
        saas_breakeven: {
          pattern: /break.*even.*saas|saas.*break.*even/i,
          statements: [
            {
              order: 1,
              description: "Calculate SaaS break-even point in months",
              noun: "breakeven_months",
              verb: "calculate",
              parameters: ["customer_acquisition_cost", "monthly_recurring_revenue", "churn_rate"]
            },
            {
              order: 2,
              description: "Calculate cumulative cash flow to breakeven",
              noun: "cash_flow",
              verb: "calculate",
              parameters: ["fixed_costs", "variable_costs", "revenue_per_month"],
              dependencies: ["breakeven_months"]
            }
          ],
          workflow: "saas_analysis"
        },

        roi_analysis: {
          pattern: /roi|return.*investment|investment.*return/i,
          statements: [
            {
              order: 1,
              description: "Calculate ROI percentage",
              noun: "roi_percentage",
              verb: "calculate",
              parameters: ["investment_cost", "current_value", "time_period"]
            },
            {
              order: 2,
              description: "Calculate annualized return",
              noun: "annualized_return",
              verb: "calculate",
              parameters: ["total_return", "years"],
              dependencies: ["roi_percentage"]
            }
          ],
          workflow: "roi_analysis"
        },

        ltv_cac: {
          pattern: /ltv|lifetime.*value|customer.*lifetime/i,
          statements: [
            {
              order: 1,
              description: "Calculate customer lifetime value",
              noun: "lifetime_value",
              verb: "calculate",
              parameters: ["average_order_value", "purchase_frequency", "customer_lifespan"]
            },
            {
              order: 2,
              description: "Calculate LTV to CAC ratio",
              noun: "ltv_cac_ratio",
              verb: "calculate",
              parameters: ["lifetime_value", "customer_acquisition_cost"],
              dependencies: ["lifetime_value"]
            }
          ],
          workflow: "ltv_analysis"
        },

        vendor_discount: {
          pattern: /vendor.*discount|discount.*payment|immediate.*payment.*discount/i,
          statements: [
            {
              order: 1,
              description: "Calculate discount amount (savings)",
              noun: "discount_amount", 
              verb: "calculate",
              parameters: ["principal_amount", "discount_rate"]
            },
            {
              order: 2,
              description: "Calculate final discounted price to pay",
              noun: "discounted_price",
              verb: "calculate", 
              parameters: ["principal_amount", "discount_amount"],
              dependencies: ["discount_amount"]
            },
            {
              order: 3,
              description: "Calculate opportunity cost of early payment",
              noun: "opportunity_cost",
              verb: "calculate",
              parameters: ["discount_amount", "alternative_return_rate", "time_period"],
              dependencies: ["discount_amount"]
            }
          ],
          workflow: "vendor_discount_analysis"
        }
      };

      // Find matching pattern
      for (const [key, pattern] of Object.entries(businessPatterns)) {
        if (pattern.pattern.test(request)) {
          console.log(`🎯 Matched business pattern: ${key}`);
          return {
            success: true,
            pattern: key,
            statements: pattern.statements,
            workflow: pattern.workflow,
            confidence: 0.9
          };
        }
      }

      // Fallback: Generic noun-verb extraction
      return this.extractGenericStatements(request);

    } catch (error) {
      return {
        success: false,
        error: `Request decomposition failed: ${error.message}`
      };
    }
  }

  /**
   * Extract functional statements using generic noun-verb analysis
   */
  extractGenericStatements(request) {
    // Simple heuristic extraction for now
    // In a production system, this would use NLP libraries
    
    const verbs = ['calculate', 'compute', 'determine', 'find', 'analyze', 'compare', 'evaluate'];
    const businessNouns = ['revenue', 'cost', 'profit', 'roi', 'value', 'rate', 'ratio', 'return', 'investment'];
    
    const words = request.toLowerCase().split(/\s+/);
    const foundVerbs = words.filter(word => verbs.includes(word));
    const foundNouns = words.filter(word => businessNouns.includes(word));
    
    if (foundVerbs.length === 0 || foundNouns.length === 0) {
      return {
        success: false,
        error: "Could not identify clear action verbs and business nouns in the request"
      };
    }

    // Generate a single generic statement
    const statement = {
      order: 1,
      description: request,
      noun: foundNouns[0],
      verb: foundVerbs[0],
      parameters: ["input_value", "rate", "time_period"]
    };

    return {
      success: true,
      pattern: "generic",
      statements: [statement],
      workflow: "generic_calculation",
      confidence: 0.6
    };
  }

  /**
   * Create execution workflow from function plan
   */
  createExecutionWorkflow(executionPlan, workflowType) {
    const workflow = {
      type: workflowType,
      steps: [],
      totalSteps: executionPlan.length,
      estimatedTime: executionPlan.length * 2 // seconds
    };

    for (const plan of executionPlan.sort((a, b) => a.order - b.order)) {
      const step = {
        order: plan.order,
        functionName: plan.functionName,
        description: plan.description,
        parameters: plan.parameters,
        dependencies: plan.dependencies,
        status: 'pending',
        executionCommand: `@calc ${plan.functionName}(${plan.parameters.join(', ')})`,
        userPrompts: plan.parameters.map(param => ({
          parameter: param,
          prompt: `Please provide ${param.replace(/_/g, ' ')}:`,
          type: 'number',
          required: true
        }))
      };
      
      workflow.steps.push(step);
    }

    return workflow;
  }

  /**
   * Execute workflow step by step with user interaction
   */
  async executeWorkflow(workflow, userInputs = {}) {
    const results = [];
    
    for (const step of workflow.steps) {
      console.log(`▶️ Executing Step ${step.order}: ${step.description}`);
      
      // Check if we have required inputs
      const missingParams = step.parameters.filter(param => !userInputs[param]);
      
      if (missingParams.length > 0) {
        return {
          success: false,
          error: 'Missing required parameters',
          missingParameters: missingParams,
          step: step.order,
          prompt: `Please provide the following parameters for Step ${step.order}:`,
          requiredInputs: missingParams.map(param => ({
            name: param,
            description: `Value for ${param.replace(/_/g, ' ')}`,
            type: 'number'
          }))
        };
      }

      // Build parameter values for execution
      const paramValues = step.parameters.map(param => userInputs[param]);
      const expression = `${step.functionName}(${paramValues.join(', ')})`;
      
      // Execute the function using calculator
      const result = await jitExecutor.execute({
        type: 'calc',
        expression: expression
      });
      
      if (result.success) {
        results.push({
          step: step.order,
          function: step.functionName,
          expression: expression,
          result: result.result,
          description: step.description
        });
        
        // Store result for dependent functions
        userInputs[step.functionName] = result.result;
      } else {
        return {
          success: false,
          error: `Step ${step.order} failed: ${result.error}`,
          step: step.order,
          partialResults: results
        };
      }
    }

    return {
      success: true,
      workflow: workflow.type,
      results: results,
      finalResult: results[results.length - 1],
      message: `✅ Workflow completed successfully in ${results.length} steps`
    };
  }
}

module.exports = { ExecutiveRequestProcessor };
