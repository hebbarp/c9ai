"use strict";
const { collapseRepeats, hardClamp, cleanupSummary } = require("../utils/text");
const { cleanBullets } = require("../utils/bullets");
const { readFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { join } = require("node:path");

function formatXML(xml) {
  if (!xml) return xml;
  
  let formatted = xml;
  let indent = 0;
  const indentStr = '  ';
  
  // Add newlines and indentation
  formatted = formatted.replace(/></g, '>\n<');
  
  const lines = formatted.split('\n');
  const result = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Decrease indent for closing tags
    if (line.startsWith('</')) {
      indent = Math.max(0, indent - 1);
    }
    
    // Add the line with current indentation
    result.push(indentStr.repeat(indent) + line);
    
    // Increase indent for opening tags (but not self-closing)
    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
      indent++;
    }
  }
  
  return result.join('\n');
}

function detectCodeBlocks(text) {
  const codeBlocks = [];
  
  // Match standard markdown code blocks: ```language\ncode```
  const markdownRegex = /```(\w+)?\s*\n?([\s\S]*?)```/g;
  let match;
  
  while ((match = markdownRegex.exec(text)) !== null) {
    const language = match[1] || detectLanguageFromCode(match[2]);
    const code = match[2].trim();
    
    if (code && isValidCodeBlock(code)) {
      codeBlocks.push({
        language: language,
        code: code,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        isMultiLine: code.includes('\n')
      });
    }
  }
  
  // Match language-labeled code blocks: python\ncode (without triple backticks)
  // Common in some AI responses where formatting is inconsistent
  if (codeBlocks.length === 0) {
    const languageLabelRegex = /\b(python|javascript|java|bash|shell|powershell|c|cpp|rust|go|php|ruby|swift|basic|qbasic|vb)\s*\n((?:(?!^\w+\s*$).*\n?)*)/gmi;
    
    while ((match = languageLabelRegex.exec(text)) !== null) {
      const language = match[1].toLowerCase();
      const code = match[2].trim();
      
      if (code && isValidCodeBlock(code) && code.length > 20) {
        codeBlocks.push({
          language: language,
          code: code,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
          isMultiLine: code.includes('\n')
        });
      }
    }
  }
  
  return codeBlocks;
}

function detectLanguageFromCode(code) {
  if (!code) return 'text';
  
  // Auto-detect language from code patterns
  if (code.includes('import ') && (code.includes('def ') || code.includes('print('))) return 'python';
  if (code.includes('function ') || code.includes('const ') || code.includes('console.')) return 'javascript';
  if (code.includes('#!/bin/bash') || code.includes('echo ')) return 'bash';
  if (code.includes('Write-Host') || code.includes('Get-')) return 'powershell';
  if (code.includes('public class') || code.includes('System.out.')) return 'java';
  if (code.includes('fn main') || code.includes('println!')) return 'rust';
  if (code.includes('#include') || code.includes('printf')) return 'c';
  if (/^\d+\s+(PRINT|LET|FOR|IF|OPEN|CLOSE|INPUT|DIM|GOTO|GOSUB|REM|')/im.test(code)) return 'basic';
  
  return 'text';
}

function isValidCodeBlock(code) {
  if (!code || code.trim().length < 10) return false;
  
  // Skip obvious non-code
  if (code.includes('Usage:') && code.includes('Output:')) return false;
  if (code.match(/^\d+\.\s/)) return false; // Numbered lists
  if (code.includes('Example:') && code.length < 50) return false;
  if (code.includes('Example usage:') && code.length < 100) return false;
  
  // Must contain some code-like patterns
  const codePatterns = [
    /\bdef\s+\w+\s*\(/,     // Python function
    /\bfunction\s+\w+\s*\(/, // JavaScript function  
    /\bclass\s+\w+/,        // Class definition
    /import\s+\w+/,         // Import statement
    /from\s+\w+\s+import/,  // Python import
    /console\.\w+/,         // JavaScript console
    /print\s*\(/,           // Print statement
    /echo\s+/,              // Shell echo
    /\$\w+/,                // Shell variables
    /[{}();]/,              // Code punctuation
    /^\d+\s+(PRINT|LET|FOR|IF|OPEN|CLOSE|INPUT|DIM|GOTO|GOSUB|REM|')/im, // BASIC line numbers
    /\b(PRINT|LET|FOR|NEXT|IF|THEN|ELSE|OPEN|CLOSE|INPUT|LINE INPUT|LOOP|WHILE|END)\b/i // BASIC keywords
  ];
  
  const hasCodePattern = codePatterns.some(pattern => pattern.test(code));
  return hasCodePattern;
}

function generateCodeButtons(codeBlock, blockIndex) {
  const filename = generateCodeFilename(codeBlock.language, codeBlock.code, blockIndex);
  const isExecutable = ['python', 'javascript', 'bash', 'powershell', 'sh', 'basic', 'qbasic'].includes(codeBlock.language.toLowerCase());
  
  let buttons = `\n\n<div class="code-actions" data-block="${blockIndex}">`;
  buttons += `<button class="save-code-btn" data-language="${codeBlock.language}" data-filename="${filename}" data-code="${encodeURIComponent(codeBlock.code)}">💾 Save as ${filename}</button>`;
  
  if (isExecutable) {
    buttons += `<button class="run-code-btn" data-filename="${filename}">🚀 Run Code</button>`;
  }
  
  buttons += `<button class="copy-code-btn" data-code="${encodeURIComponent(codeBlock.code)}">📋 Copy</button>`;
  buttons += `</div>`;
  
  return buttons;
}

function generateCodeFilename(language, code, index) {
  // Try to extract meaningful name from code
  let basename = 'generated_code';
  
  const namePatterns = [
    /def\s+(\w+)/,           // Python function
    /class\s+(\w+)/,         // Class definition  
    /function\s+(\w+)/,      // JavaScript function
    /const\s+(\w+)\s*=/,     // JavaScript const
    /OPEN\s+"([^"]+)"/i,     // BASIC file operations - extract filename base
    /REM\s+(\w+)/i,          // BASIC comment with program name
  ];
  
  for (const pattern of namePatterns) {
    const match = code.match(pattern);
    if (match && match[1] !== 'main') {
      // For BASIC file operations, clean up the filename
      if (pattern.source.includes('OPEN')) {
        basename = match[1].replace(/\.(txt|dat|bas)$/i, '').replace(/[^a-zA-Z0-9]/g, '_') + '_reader';
      } else {
        basename = match[1];
      }
      break;
    }
  }
  
  // Special handling for BASIC programs based on content
  if (language.toLowerCase().includes('basic') && basename === 'generated_code') {
    if (code.includes('OPEN') && code.includes('INPUT')) {
      basename = 'file_reader';
    } else if (code.includes('PRINT') && code.includes('FOR')) {
      basename = 'basic_program';
    }
  }
  
  const extensions = {
    python: 'py', javascript: 'js', bash: 'sh', powershell: 'ps1',
    java: 'java', rust: 'rs', c: 'c', cpp: 'cpp',
    basic: 'bas', qbasic: 'bas', vb: 'vb'
  };
  
  const ext = extensions[language.toLowerCase()] || 'txt';
  return `${basename}_${Date.now()}_${index}.${ext}`;
}

function processResponseWithCodeBlocks(text) {
  const codeBlocks = detectCodeBlocks(text);
  
  if (codeBlocks.length === 0) {
    return text; // No code blocks found
  }
  
  let processedText = text;
  let offset = 0;
  
  // Process code blocks in reverse order to maintain indices
  for (let i = codeBlocks.length - 1; i >= 0; i--) {
    const block = codeBlocks[i];
    const buttons = generateCodeButtons(block, i);
    
    // Insert buttons after the code block
    const insertPosition = block.endIndex + offset;
    processedText = processedText.slice(0, insertPosition) + buttons + processedText.slice(insertPosition);
    offset += buttons.length;
  }
  
  return processedText;
}

function makeSynthesizer(provider, model) {
  return async (prompt, toolName, toolResult) => {
    // Helper function to detect executive business functions
    const isExecutiveBusinessFunction = (expression) => {
      if (!expression) return false;
      return /^(investment_analysis|vendor_discount_analysis|saas_breakeven_analysis|finance_analysis|compound_interest)\s*\(/i.test(expression);
    };

    // Helper function to format executive business results with detailed explanations
    const formatExecutiveResult = (toolResult) => {
      const expression = toolResult.expression || '';
      const result = toolResult.result;
      const formatted = toolResult.formatted;
      
      // Parse function name and parameters from expression
      const functionMatch = expression.match(/^(\w+)\s*\(([^)]+)\)/);
      if (!functionMatch) {
        return `🧮 **Result:** **${result}**${formatted ? ` (${formatted})` : ''}`;
      }
      
      const [, functionName, paramString] = functionMatch;
      const params = paramString.split(',').map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
      
      // Generate business-focused explanation based on function type
      let businessExplanation = '';
      let workingSteps = '';
      
      if (functionName.includes('investment_analysis')) {
        const [amount, upside, downside, years, probability = 0.5] = params;
        businessExplanation = `💼 **Investment Risk Analysis**\n\n**Investment Details:**\n• Principal Amount: $${amount.toLocaleString()}\n• Upside Potential: ${(upside * 100).toFixed(1)}%\n• Downside Risk: ${(downside * 100).toFixed(1)}%\n• Time Horizon: ${years} year${years !== 1 ? 's' : ''}\n• Success Probability: ${(probability * 100).toFixed(0)}%`;
        
        workingSteps = `\n\n**Calculation Method:**\n• Expected Return = (Probability × Upside) + ((1 - Probability) × (-Downside))\n• Expected Return = (${probability} × ${upside}) + (${1-probability} × ${-downside})\n• Expected Return = ${(probability * upside + (1-probability) * (-downside)).toFixed(4)} per year\n• Total Expected Value = Principal × (1 + (Expected Return × Years))\n• Total Expected Value = $${amount.toLocaleString()} × (1 + (${(probability * upside + (1-probability) * (-downside)).toFixed(4)} × ${years}))\n• **Final Result: $${result.toLocaleString()}**`;
        
        if (result > amount) {
          businessExplanation += `\n\n✅ **Recommendation:** Positive expected value of $${(result - amount).toLocaleString()} suggests this could be a profitable investment.`;
        } else {
          businessExplanation += `\n\n⚠️ **Caution:** Expected loss of $${(amount - result).toLocaleString()} suggests high risk relative to potential returns.`;
        }
      } 
      else if (functionName.includes('vendor_discount_analysis')) {
        const [invoiceAmount, discountRate] = params;
        const savingsAmount = result;
        const finalAmount = invoiceAmount - savingsAmount;
        
        businessExplanation = `💰 **Vendor Discount Analysis**\n\n**Transaction Details:**\n• Original Invoice: $${invoiceAmount.toLocaleString()}\n• Discount Rate: ${(discountRate * 100).toFixed(2)}%\n• Discount Savings: $${savingsAmount.toLocaleString()}\n• Final Amount Due: $${finalAmount.toLocaleString()}`;
        
        workingSteps = `\n\n**Calculation:**\n• Discount Savings = Invoice Amount × Discount Rate\n• Discount Savings = $${invoiceAmount.toLocaleString()} × ${(discountRate * 100).toFixed(2)}%\n• **Discount Savings: $${savingsAmount.toLocaleString()}**\n• Final Amount = $${invoiceAmount.toLocaleString()} - $${savingsAmount.toLocaleString()} = $${finalAmount.toLocaleString()}`;
        
        const savingsPercentage = ((savingsAmount / invoiceAmount) * 100);
        businessExplanation += `\n\n💡 **Impact:** This ${savingsPercentage.toFixed(2)}% early payment discount saves your company $${savingsAmount.toLocaleString()}.`;
      }
      else if (functionName.includes('saas_breakeven_analysis')) {
        const [cac, mrr, churnRate] = params;
        const monthsToBreakeven = result;
        
        businessExplanation = `📊 **SaaS Breakeven Analysis**\n\n**Business Metrics:**\n• Customer Acquisition Cost (CAC): $${cac.toLocaleString()}\n• Monthly Recurring Revenue: $${mrr.toLocaleString()}\n• Monthly Churn Rate: ${(churnRate * 100).toFixed(2)}%\n• Effective Monthly Revenue: $${(mrr * (1 - churnRate)).toLocaleString()}`;
        
        workingSteps = `\n\n**Calculation:**\n• Effective MRR = MRR × (1 - Churn Rate)\n• Effective MRR = $${mrr} × (1 - ${churnRate}) = $${(mrr * (1 - churnRate)).toFixed(2)}\n• Breakeven Time = CAC ÷ Effective MRR\n• Breakeven Time = $${cac} ÷ $${(mrr * (1 - churnRate)).toFixed(2)} = **${monthsToBreakeven.toFixed(1)} months**`;
        
        if (monthsToBreakeven <= 12) {
          businessExplanation += `\n\n✅ **Excellent:** Breaking even in ${monthsToBreakeven.toFixed(1)} months indicates a healthy SaaS business model.`;
        } else if (monthsToBreakeven <= 24) {
          businessExplanation += `\n\n⚠️ **Caution:** ${monthsToBreakeven.toFixed(1)} months to breakeven is acceptable but could be optimized.`;
        } else {
          businessExplanation += `\n\n🚨 **Concern:** ${monthsToBreakeven.toFixed(1)} months to breakeven suggests need to reduce CAC or increase MRR.`;
        }
      }
      
      return businessExplanation + workingSteps;
    };

    // Deterministic passthrough for common tools to avoid hallucinations.
    const asString = (x) =>
      typeof x === "string" ? x :
      x == null ? "" :
      JSON.stringify(x, null, 2);

    if (toolName === "shell.run") {
      const stdout = typeof toolResult?.stdout === "string" ? toolResult.stdout : asString(toolResult);
      const exitCode = typeof toolResult?.code === "number" ? toolResult.code : 0;
      let output = (stdout || "").trim();

      // Append stderr if present
      if (toolResult?.stderr && toolResult.stderr.trim()) {
        output += `\n\n[stderr]\n${toolResult.stderr.trim()}`;
      }

      // Build clean output without backticks
      let result = output;
      if (exitCode !== 0) {
        result += `\n(exit code ${exitCode})`;
      }
      return result;
    }

    if (toolName === "fs.read") {
      const text = typeof toolResult === "string" ? toolResult : asString(toolResult);
      return `File contents:\n${(text || "").trim()}`;
    }

    if (toolName === "fs.write") {
      const p = toolResult?.path || "(unknown path)";
      const bytes = typeof toolResult?.bytes === "number" ? `${toolResult.bytes} bytes` : "";
      
      // Check if this is a Python file
      if (p.endsWith('.py')) {
        return `Wrote Python file: ${p}${bytes ? ` (${bytes})` : ""}

Would you like me to run this Python script? I can execute it for you using:
\`python ${p}\` or \`python3 ${p}\`

Or if you want to make it executable:
\`chmod +x ${p} && python ${p}\``;
      }
      
      return `Wrote file: ${p}${bytes ? ` (${bytes})` : ""}`;
    }

    if (toolName === "web.search") {
      // Handle multiple possible JSON structures
      const results = toolResult?.results || toolResult?.organic_results || toolResult?.items || [];
      if (!results || !Array.isArray(results) || results.length === 0) {
        return "No search results found.";
      }
      
      let output = "**Search Results:**\n\n";
      results.slice(0, 5).forEach((result, index) => {
        const title = result.title || "Untitled";
        const link = result.link || result.url || "#";
        const snippet = result.snippet || result.description || "No description available";
        
        output += `**${index + 1}. ${title}**\n`;
        output += `${link}\n`;
        if (snippet !== "No description available") {
          output += `${snippet}\n`;
        }
        output += `\n`;
      });
      
      return output.trim();
    }

    // RSS feed rendering
    if (toolName === "rss.read") {
      const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const escHtml = (s) => strip(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const escAttr = (s) => String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      // If tool already returned formatted string, use it
      if (typeof toolResult === 'string') return toolResult.trim();
      const arr = Array.isArray(toolResult?.articles) ? toolResult.articles
                : (Array.isArray(toolResult) ? toolResult : []);
      if (!arr.length) return 'No articles found.';
      const cards = arr.slice(0, 5).map(a => {
        const title = escHtml(a.title || 'Untitled');
        const descr = escHtml(a.description || '');
        const date  = escHtml(a.date || a.published_at || '');
        const url   = escAttr(a.url || '');
        const img   = escAttr(a.image || a.thumbnail || '');
        const imgTag = img ? `<img class="rss-thumb" src="${img}" alt="thumbnail">` : '';
        const titleLink = url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>` : title;
        const descHtml = descr ? `<div class="rss-desc">${descr}</div>` : '';
        const metaHtml = (url || date) ? `<div class="rss-meta">${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">Read more</a>` : ''}${date ? (url ? ` · ${date}` : date) : ''}</div>` : '';
        return `<div class="rss-item">${imgTag}<div class="rss-body"><div class="rss-title">${titleLink}</div>${descHtml}${metaHtml}</div></div>`;
      }).join('\n');
      return `## Essential Results\n\n${cards}`;
    }

    // Cream recent posts rendering
    if (toolName === "cream.fetch") {
      const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (typeof toolResult === 'string') return toolResult.trim();
      const posts = toolResult?.posts || toolResult?.items || toolResult;
      const arr = Array.isArray(posts) ? posts : [];
      if (!arr.length) return 'No recent posts available.';
      const md = arr.slice(0, 5).map(p => {
        const user = strip(p.full_name || p.user || p.author || '');
        const text = strip(p.chat || p.message || p.text || p.content || p.description || '');
        const date = strip(p.created_at || p.createdAt || p.timestamp || p.time || p.date || '');
        let line = `- ${user ? user + ' — ' : ''}${text}`;
        if (date) line += `\n${date}`;
        return line;
      }).join('\n\n');
      return `## Recent Posts\n\n${md}`;
    }

    if (toolName === "jit") {
      // Handle JIT tool results directly without LLM synthesis
      console.log('🎨 JIT Synthesizer called with toolResult:', toolResult);
      if (!toolResult) {
        return "❌ JIT execution failed - no result returned.";
      }

      // Handle success/error structure
      if (toolResult.success === false) {
        return `❌ **JIT Error:** ${toolResult.error || 'Unknown error occurred'}`;
      }

      // Executive deterministic result formatting
      if (toolResult.type === 'executive_result' && toolResult.domain === 'INVESTMENT') {
        const inp = toolResult.inputs || {};
        const res = toolResult.results || {};
        let output = `💼 **Investment Analysis (Deterministic)**\n\n`;
        if (inp.amount != null) output += `• **Amount:** ${typeof inp.amount === 'number' ? inp.amount.toLocaleString() : inp.amount}\n`;
        output += `• **Upside:** ${((inp.upside || 0) * 100).toFixed(2)}%  • **Downside:** ${((inp.downside || 0) * 100).toFixed(2)}%  • **Years:** ${inp.years || 1}\n`;
        output += `• **Probability (upside):** ${((inp.probability || 0.5) * 100).toFixed(0)}%\n\n`;
        if (res.upValue != null) output += `• **Upside Path:** ${typeof res.upValue === 'number' ? res.upValue.toLocaleString() : res.upValue}\n`;
        if (res.downValue != null) output += `• **Downside Path:** ${typeof res.downValue === 'number' ? res.downValue.toLocaleString() : res.downValue}\n`;
        if (res.expected != null) output += `• **Expected Value:** ${typeof res.expected === 'number' ? res.expected.toLocaleString() : res.expected}\n`;
        if (res.roiPercent != null) output += `• **ROI:** ${typeof res.roiPercent === 'number' ? res.roiPercent.toFixed(2) : res.roiPercent}%\n\n`;
        if (toolResult.explanation) {
          output += `📝 ${toolResult.explanation}`;
        }
        return output.trim();
      }

      // Other executive deterministic domains (generic rendering)
      if (toolResult.type === 'executive_result' && toolResult.domain && toolResult.domain !== 'INVESTMENT') {
        const inp = toolResult.inputs || {};
        const res = toolResult.results || {};
        let output = `💼 **${toolResult.domain.replace(/_/g,' ')} Analysis (Deterministic)**\n\n`;
        const list = (obj, title) => {
          const keys = Object.keys(obj || {});
          if (!keys.length) return '';
          let s = `**${title}:**\n`;
          for (const k of keys) {
            const v = obj[k];
            const val = typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })) : String(v);
            s += `• ${k}: ${val}\n`;
          }
          return s + '\n';
        };
        output += list(inp, 'Inputs');
        output += list(res, 'Results');
        if (toolResult.explanation) output += `📝 ${toolResult.explanation}`;
        return output.trim();
      }

      // Calculator results
      if (toolResult.expression !== undefined) {
        if (toolResult.success === true) {
          // Check if this is an executive business function
          const isExecutiveFunction = isExecutiveBusinessFunction(toolResult.expression);
          
          if (isExecutiveFunction) {
            return formatExecutiveResult(toolResult);
          } else {
            let output = `🧮 **Result:** **${toolResult.result}**${toolResult.formatted ? ` (${toolResult.formatted})` : ''}`;
            
            // Add variables if present (excluding 'result' which is the return value)
            if (toolResult.variables && Object.keys(toolResult.variables).length > 0) {
              const variables = Object.entries(toolResult.variables).filter(([name]) => name !== 'result');
              if (variables.length > 0) {
                output += `\n\n**Variables:**\n`;
                for (const [name, value] of variables) {
                  output += `• **${name}** = ${value}\n`;
                }
              }
            }
            
            console.log('🎨 JIT Synthesizer returning:', output.trim());
            return output.trim();
          }
        } else {
          return `❌ **Calculator Error:** ${toolResult.error} for expression: ${toolResult.expression}`;
        }
      }

      // BASIC program results
      if (toolResult.type === 'basic_program') {
        if (toolResult.success === true) {
          let output = `💻 **BASIC Program Result**\n\n`;
          
          // Result table
          output += `| Field | Value |\n`;
          output += `|-------|-------|\n`;
          output += `| **Result** | **${toolResult.result}** |\n`;
          
          // Variables table if present
          if (toolResult.variables && Object.keys(toolResult.variables).length > 0) {
            output += `\n**Variables:**\n\n`;
            output += `| Variable | Value |\n`;
            output += `|----------|-------|\n`;
            for (const [name, value] of Object.entries(toolResult.variables)) {
              output += `| ${name} | ${value} |\n`;
            }
          }
          
          return output.trim();
        } else {
          return `❌ **BASIC Program Error:** ${toolResult.error}`;
        }
      }

      // Language generation results  
      if (toolResult.type === 'language_generation') {
        if (toolResult.success === true) {
          let output = `🔨 **Code Generated: ${toolResult.language}**\n\n`;
          output += `| Field | Value |\n`;
          output += `|-------|-------|\n`;
          output += `| **Language** | ${toolResult.language} |\n`;
          output += `| **Task** | ${toolResult.task} |\n`;
          output += `| **Filename** | ${toolResult.filename} |\n`;
          if (toolResult.filepath) {
            output += `| **Saved to** | \`${toolResult.filepath}\` |\n`;
          }
          output += `| **Executable** | ${toolResult.executable ? '✅ Yes' : '❌ No'} |\n\n`;
          
          output += `**Generated Code:**\n\`\`\`${toolResult.language}\n${toolResult.code}\n\`\`\``;
          
          return output.trim();
        } else {
          return `❌ **Code Generation Error:** ${toolResult.error}`;
        }
      }

      // Code save results
      if (toolResult.type === 'code_save') {
        if (toolResult.success === true) {
          let output = `💾 **Code Saved Successfully**\n\n`;
          output += `| Field | Value |\n`;
          output += `|-------|-------|\n`;
          output += `| **Files Saved** | ${toolResult.codeBlockCount} |\n`;
          output += `| **Install Commands** | ${toolResult.installCommands.length} |\n\n`;
          
          if (toolResult.savedFiles.length > 0) {
            output += `**Saved Files:**\n\n`;
            output += `| Filename | Language | Executable |\n`;
            output += `|----------|----------|------------|\n`;
            for (const file of toolResult.savedFiles) {
              if (file.success) {
                output += `| ${file.filename} | ${file.language} | ${file.executable ? '✅' : '❌'} |\n`;
              }
            }
          }
          
          if (toolResult.installCommands.length > 0) {
            output += `\n**Installation Commands Found:**\n`;
            for (const cmd of toolResult.installCommands) {
              output += `• \`${cmd.command}\`\n`;
            }
          }
          
          return output.trim();
        } else {
          return `❌ **Code Save Error:** ${toolResult.error}`;
        }
      }

      // Script execution results
      if (toolResult.type === 'script_execution') {
        if (toolResult.success === true) {
          let output = `🚀 **Script Executed Successfully**\n\n`;
          output += `| Field | Value |\n`;
          output += `|-------|-------|\n`;
          output += `| **File** | ${toolResult.filepath} |\n`;
          output += `| **Command** | \`${toolResult.command}\` |\n\n`;
          
          if (toolResult.output) {
            output += `**Output:**\n\`\`\`\n${toolResult.output}\n\`\`\``;
          }
          
          return output.trim();
        } else {
          return `❌ **Script Execution Error:** ${toolResult.error}`;
        }
      }

      // Data analysis results
      if (toolResult.analysis_type && toolResult.file) {
        if (toolResult.success === true) {
          let output = `📊 **Data Analysis: ${toolResult.file}**\n\n`;
          output += `• **Rows:** ${toolResult.rows || 0}\n`;
          output += `• **Columns:** ${(toolResult.columns || []).length}\n`;
          
          if (toolResult.numeric_stats && Object.keys(toolResult.numeric_stats).length > 0) {
            output += `\n**Numeric Statistics:**\n`;
            for (const [col, stats] of Object.entries(toolResult.numeric_stats)) {
              output += `• **${col}:** ${stats.count} values, range ${stats.min}-${stats.max}, avg ${stats.avg.toFixed(2)}\n`;
            }
          }
          
          if (toolResult.sample && toolResult.sample.length > 0) {
            output += `\n**Sample Data:**\n\`\`\`json\n${JSON.stringify(toolResult.sample, null, 2)}\n\`\`\``;
          }
          
          return output.trim();
        } else {
          return `❌ **Data Analysis Error:** ${toolResult.error}`;
        }
      }

      // File processing results
      if (toolResult.operation && toolResult.input) {
        if (toolResult.success === true) {
          let output = `📄 **File Processing: ${toolResult.operation}**\n\n`;
          output += `• **Input:** ${toolResult.input}\n`;
          
          if (toolResult.output) {
            output += `• **Output:** ${toolResult.output}\n`;
            output += `• **Status:** ${toolResult.message || 'Completed successfully'}`;
          } else if (toolResult.result) {
            if (typeof toolResult.result === 'object') {
              output += `• **Result:**\n\`\`\`json\n${JSON.stringify(toolResult.result, null, 2)}\n\`\`\``;
            } else {
              output += `• **Result:** ${toolResult.result}`;
            }
          }
          
          return output.trim();
        } else {
          return `❌ **File Processing Error:** ${toolResult.error}`;
        }
      }

      // Quiz generation results
      if (toolResult.topic && toolResult.quiz_file && toolResult.quiz_url) {
        if (toolResult.success === true) {
          let output = `🧠 **Quiz Generated Successfully!**\n\n`;
          output += `• **Topic:** ${toolResult.topic}\n`;
          output += `• **Difficulty:** ${toolResult.difficulty}\n`;
          output += `• **Questions:** ${toolResult.questions}\n`;
          output += `• **Quiz URL:** [Open Quiz](${toolResult.quiz_url})\n\n`;
          output += `🎯 Click the link above to start your interactive quiz!`;
          return output.trim();
        }
      }

      // RFQ Analysis results
      if (toolResult.analysis_type === 'RFQ_ANALYSIS' && toolResult.success === true) {
        let output = `📋 **RFQ Analysis Complete**\n\n`;
        output += `• **Requirements Found:** ${toolResult.requirements_found}\n`;
        output += `• **Complexity Score:** ${toolResult.complexity_score}/10\n`;
        output += `• **Estimated Hours:** ${toolResult.estimated_hours}\n`;
        output += `• **Timeline:** ${toolResult.timeline_weeks} weeks\n`;
        output += `• **Proposal Amount:** $${toolResult.proposal_amount.toLocaleString()}\n`;
        output += `• **Bid Decision:** **${toolResult.bid_decision}** (${toolResult.confidence})\n\n`;
        
        if (toolResult.phases && toolResult.phases.length > 0) {
          output += `**Project Phases:**\n`;
          toolResult.phases.forEach((phase, i) => {
            output += `${i + 1}. **${phase.name}** - ${phase.weeks} weeks\n`;
          });
          output += `\n`;
        }
        
        if (toolResult.risks && toolResult.risks.length > 0) {
          output += `**Key Risks:**\n`;
          toolResult.risks.slice(0, 3).forEach((risk, i) => {
            output += `• ${risk}\n`;
          });
        }
        
        return output.trim();
      }

      // System info results
      if (toolResult.system && toolResult.timestamp) {
        let output = `💻 **System Information** (${new Date(toolResult.timestamp).toLocaleString()})\n\n`;
        const sys = toolResult.system;
        output += `• **Platform:** ${sys.platform} (${sys.arch})\n`;
        output += `• **Hostname:** ${sys.hostname}\n`;
        output += `• **CPU Cores:** ${sys.cpu_cores}\n`;
        output += `• **Memory:** ${sys.free_memory_gb}GB free / ${sys.total_memory_gb}GB total (${sys.memory_usage_percent}% used)\n`;
        output += `• **Uptime:** ${sys.uptime_hours} hours\n`;
        if (toolResult.node) {
          output += `• **Node.js:** ${toolResult.node.version} (PID ${toolResult.node.pid})`;
        }
        return output.trim();
      }

      // Function inspection results
      if (toolResult.type === 'function_inspection') {
        if (toolResult.success === true) {
          let output = `🔍 **Function: ${toolResult.actualName}**\n\n`;
          output += `**Description:** ${toolResult.description}\n\n`;
          
          // Show XML-Lisp source for user-defined functions, JavaScript for built-ins
          if (toolResult.sourceType === 'xml-lisp') {
            // Format XML with proper indentation and escape for display
            const formattedXML = formatXML(toolResult.source);
            output += `**XML-Lisp Source:**\n\`\`\`xml\n${formattedXML}\n\`\`\`\n\n`;
            
            // Also show creation/usage info for user functions
            if (toolResult.created) {
              output += `**Created:** ${toolResult.created}\n`;
            }
            if (toolResult.lastUsed) {
              output += `**Last Used:** ${toolResult.lastUsed}\n`;
            }
            
            // Show file location info
            output += `**Storage:** ~/.c9ai/functions/${toolResult.actualName}.xmlp\n`;
            
            // Optionally show compiled JavaScript (collapsed by default)
            if (toolResult.javascript) {
              output += `\n**Compiled JavaScript** (for debugging):\n<details><summary>Click to expand</summary>\n\n\`\`\`javascript\n${toolResult.javascript}\n\`\`\`\n</details>`;
            }
          } else {
            output += `**Source Code:**\n\`\`\`javascript\n${toolResult.source}\n\`\`\``;
          }
          
          return output;
        } else {
          let output = `❌ **Function '${toolResult.functionName}' not found**\n\n`;
          if (toolResult.availableFunctions) {
            output += `**Available functions:**\n${toolResult.availableFunctions.join(', ')}`;
          }
          return output;
        }
      }
      
      // Function list results
      if (toolResult.type === 'function_list') {
        let output = `📚 **Available Functions** (${toolResult.functions.length} total)\n\n`;
        
        const categories = {
          'Math': ['sin', 'cos', 'tan', 'sqrt', 'pow', 'exp', 'log', 'abs', 'floor', 'ceil', 'round', 'min', 'max'],
          'Statistics': ['sum', 'avg', 'median', 'stdev', 'variance'],
          'Number Theory': ['factorial', 'fibonacci', 'gcd', 'lcm', 'isPrime', 'primeFactors', 'nthPrime'],
          'Financial': ['pv', 'fv', 'npv', 'pmt', 'irr', 'cagr', 'compound']
        };
        
        for (const [category, funcs] of Object.entries(categories)) {
          const available = funcs.filter(f => toolResult.functions.includes(f));
          if (available.length > 0) {
            output += `**${category}:** ${available.join(', ')}\n`;
          }
        }
        
        // Add user-defined functions section
        if (toolResult.userFunctions && toolResult.userFunctions.length > 0) {
          output += `**User-Defined:** ${toolResult.userFunctions.join(', ')} ✨\n`;
        }
        
        output += `\n💡 **Usage:** \`@inspect functionName\` to view source code`;
        return output;
      }

      // XML transpilation results
      if (toolResult.type === 'xml_transpilation') {
        if (toolResult.success === true) {
          let output = `🔄 **XML-Lisp Transpiled Successfully!**\n\n`;
          
          output += `**Test Result:** ${toolResult.test_result}\n\n`;
          
          // Show the original XML-Lisp source with proper formatting
          const formattedXML = formatXML(toolResult.xml_input);
          output += `**XML-Lisp Source:**\n\`\`\`xml\n${formattedXML}\n\`\`\`\n\n`;
          
          // Show JavaScript output in a collapsible section
          output += `**Transpiled JavaScript:**\n<details><summary>Click to expand</summary>\n\n\`\`\`javascript\n${toolResult.javascript_output}\n\`\`\`\n</details>\n\n`;
          
          output += `💡 **Usage:** Function saved to ~/.c9ai/functions/ and ready for @calc!`;
          
          return output;
        } else {
          const formattedInput = formatXML(toolResult.input);
          return `❌ **XML Transpilation Error:** ${toolResult.error}\n\n**Input:**\n\`\`\`xml\n${formattedInput}\n\`\`\``;
        }
      }

      // Generic JIT success result
      if (toolResult.success === true) {
        return `✅ **JIT Execution Complete**\n\n\`\`\`json\n${JSON.stringify(toolResult, null, 2)}\n\`\`\``;
      }

      // Fallback for unknown JIT result format
      return `🔧 **JIT Result:**\n\n\`\`\`json\n${JSON.stringify(toolResult, null, 2)}\n\`\`\``;
    }

    if (toolName === "github.fetch") {
      if (!toolResult) {
        return "❌ GitHub fetch failed - no result returned.";
      }

      if (toolResult.success === false) {
        let output = `❌ **GitHub Error:** ${toolResult.error}`;
        if (toolResult.suggestion) {
          output += `\n\n💡 **Suggestion:** ${toolResult.suggestion}`;
        }
        return output;
      }

      if (toolResult.success === true) {
        let output = `📋 **GitHub Todos** (${toolResult.repo || 'repository'})\n\n`;
        output += `• **Total Issues:** ${toolResult.total_issues || 0}\n`;
        output += `• **Executable Todos:** ${toolResult.executable_count || 0}\n`;
        
        if (toolResult.todos && toolResult.todos.length > 0) {
          output += `\n**Recent Todos:**\n`;
          toolResult.todos.slice(0, 5).forEach((todo, index) => {
            output += `${index + 1}. **${todo.title}** (${todo.id})\n`;
            if (todo.executable && todo.executable.length > 0) {
              output += `   🔧 ${todo.executable.length} executable command${todo.executable.length > 1 ? 's' : ''}\n`;
            }
          });
        }

        if (toolResult.saved_to) {
          output += `\n✅ **Saved to:** ${toolResult.saved_to}`;
        }

        return output.trim();
      }

      return `🔧 **GitHub Result:**\n\n\`\`\`json\n${JSON.stringify(toolResult, null, 2)}\n\`\`\``;
    }

    if (toolName === "gdrive.fetch") {
      if (!toolResult) {
        return "❌ Google Drive fetch failed - no result returned.";
      }

      if (toolResult.success === false) {
        let output = `❌ **Google Drive Error:** ${toolResult.error}`;
        if (toolResult.suggestion) {
          output += `\n\n💡 **Suggestion:** ${toolResult.suggestion}`;
        }
        return output;
      }

      if (toolResult.success === true) {
        let output = `📁 **Google Drive Todos** (${toolResult.source})\n\n`;
        output += `• **Files Processed:** ${toolResult.files_processed || 0}\n`;
        output += `• **Total Todos:** ${toolResult.total_todos || 0}\n`;
        output += `• **Executable Todos:** ${toolResult.executable_count || 0}\n`;

        if (toolResult.files && toolResult.files.length > 0) {
          output += `\n**Files Analyzed:**\n`;
          toolResult.files.forEach((file, index) => {
            output += `${index + 1}. **${file.filename}** (${file.size} chars, ${file.todos_found || 0} todos)\n`;
          });
        }

        if (toolResult.todos && toolResult.todos.length > 0) {
          output += `\n**Recent Todos:**\n`;
          toolResult.todos.slice(0, 5).forEach((todo, index) => {
            output += `${index + 1}. **${todo.title}** (${todo.id})\n`;
            if (todo.executable && todo.executable.length > 0) {
              output += `   🔧 ${todo.executable.length} executable command${todo.executable.length > 1 ? 's' : ''}\n`;
            }
          });
        }

        if (toolResult.saved_to) {
          output += `\n✅ **Saved to:** ${toolResult.saved_to}`;
        }

        return output.trim();
      }

      return `🔧 **Google Drive Result:**\n\n\`\`\`json\n${JSON.stringify(toolResult, null, 2)}\n\`\`\``;
    }

    // Default: use LLM, but with a strict system prompt to avoid speculation.
    const system =
      "You are a STRICT summarizer for tool results. RULES: " +
      "1) Never invent or infer technologies or contexts not present in the tool output. " +
      "2) Prefer verbatim snippets in fenced code blocks. " +
      "3) If information is missing, say what additional tool step is needed. " +
      "4) Be concise and task-focused.";

    const body = toolResult ? asString(toolResult) : "(no tool run)";
    const user =
      `User request:\n${prompt}\n\n` +
      `Tool: ${toolName}\n` +
      `Result:\n${body}\n\n` +
      `Respond with the essential result only.`;

    const out = await provider.call({
      model: model || provider.defaultModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature: 0.0,
      top_p: 1
    });
    
    // Default cleanup for model text:
    let result = String(out.text || "");
    // If caller marks this turn as summarization, apply stronger cleaning
    if (toolResult?.__meta?.kind === "summary" || /summarize|summary/i.test(toolResult?.__meta?.task || "")) {
      result = cleanupSummary(result);
      return result;
    }
    // If caller marks bulletization, enforce bullets
    if (toolResult?.__meta?.kind === "bullets" || /bullet\s*points?|bulletize|bulleted/i.test(toolResult?.__meta?.task || "")) {
      let max = 8;
      try {
        const s = JSON.parse(readFileSync(join(homedir(), ".c9ai", "settings.json"), "utf-8"));
        const m = Number(s?.style?.bulletMax);
        if (m && m > 0 && m <= 20) max = m;
      } catch {}
      return cleanBullets(result, { max, minLen: 4 });
    }
    result = collapseRepeats(result, { lineMaxRepeats: 2 });
    result = hardClamp(result, 2400);
    
    // Process code blocks and add action buttons
    result = processResponseWithCodeBlocks(result);
    
    return result;
  };
}
module.exports = { 
  makeSynthesizer,
  processResponseWithCodeBlocks,
  detectCodeBlocks
};
