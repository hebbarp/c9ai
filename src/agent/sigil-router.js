"use strict";
/**
 * Sigil Router - Routes @commands to appropriate JIT applications
 */

class SigilRouter {
  constructor() {
    // Sigil mappings to JIT tool configurations
    this.sigilMap = {
      // Calculator sigils
      '@calc': { tool: 'jit', params: { type: 'calc' } },
      '@calculate': { tool: 'jit', params: { type: 'calc' } },
      '@math': { tool: 'jit', params: { type: 'calc' } },
      
      // Data analysis sigils
      '@analyze': { tool: 'jit', params: { type: 'analyze' } },
      '@data': { tool: 'jit', params: { type: 'analyze' } },
      '@csv': { tool: 'jit', params: { type: 'analyze' } },
      
      // File processing sigils
      '@file': { tool: 'jit', params: { type: 'file' } },
      '@process': { tool: 'jit', params: { type: 'file' } },
      '@count': { tool: 'jit', params: { type: 'file', operation: 'count-lines' } },
      '@upper': { tool: 'jit', params: { type: 'file', operation: 'uppercase' } },
      '@lower': { tool: 'jit', params: { type: 'file', operation: 'lowercase' } },
      '@emails': { tool: 'jit', params: { type: 'file', operation: 'extract-emails' } },
      '@words': { tool: 'jit', params: { type: 'file', operation: 'word-frequency' } },
      
      // System info sigils
      '@system': { tool: 'jit', params: { type: 'system' } },
      
      // Function inspection sigils
      '@inspect': { tool: 'jit', params: { type: 'inspect' } },
      '@show': { tool: 'jit', params: { type: 'inspect' } },
      '@function': { tool: 'jit', params: { type: 'inspect' } },
      '@info': { tool: 'jit', params: { type: 'info' } },
      '@status': { tool: 'jit', params: { type: 'system' } },
      
      // XML-Lisp development sigils
      '@transpile': { tool: 'jit', params: { type: 'transpile' } },
      '@xml': { tool: 'jit', params: { type: 'transpile' } },
      '@xmljs': { tool: 'jit', params: { type: 'transpile' } },
      '@create': { tool: 'jit', params: { type: 'ai_create_function' } },
      '@generate': { tool: 'jit', params: { type: 'ai_create_function' } },
      '@executive': { tool: 'jit', params: { type: 'executive_request' } },
      '@business': { tool: 'jit', params: { type: 'executive_request' } },
      // Common alias for executives
      '@exec': { tool: 'jit', params: { type: 'executive_request' } },
      '@prog': { tool: 'jit', params: { type: 'prog' } },
      '@program': { tool: 'jit', params: { type: 'prog' } },
      '@basic': { tool: 'jit', params: { type: 'prog' } },
      '@lang': { tool: 'jit', params: { type: 'lang' } },
      '@language': { tool: 'jit', params: { type: 'lang' } },
      '@save': { tool: 'jit', params: { type: 'save' } },
      '@run': { tool: 'jit', params: { type: 'run' } },
      '@execute': { tool: 'jit', params: { type: 'run' } },
      
      // Quiz generation sigils
      '@quiz': { tool: 'jit', params: { type: 'quiz' } },
      '@test': { tool: 'jit', params: { type: 'quiz' } },
      '@exam': { tool: 'jit', params: { type: 'quiz' } },
      
      // RFQ Analysis sigils
      '@rfq': { tool: 'jit', params: { type: 'rfq' } },
      '@rfq-analysis': { tool: 'jit', params: { type: 'rfq' } },
      '@proposal': { tool: 'jit', params: { type: 'rfq' } },
      '@bid': { tool: 'jit', params: { type: 'rfq' } },
      
      // Task/Todo sigils (route to existing tools)
      '@todo': { tool: 'shell.run', params: {} },
      '@task': { tool: 'shell.run', params: {} },
      '@run': { tool: 'shell.run', params: {} },
      '@shell': { tool: 'shell.run', params: {} },
      
      // Communication sigils (route to existing tools) 
      '@email': { tool: 'cream.mail', params: {} },
      '@post': { tool: 'cream.post', params: {} },
      '@share': { tool: 'cream.post', params: {} },
      '@publish': { tool: 'cream.post', params: {} },
      '@whatsapp': { tool: 'whatsapp.send', params: {} },
      '@sms': { tool: 'whatsapp.send', params: {} },
      
      // File operations (route to existing tools)
      '@read': { tool: 'fs.read', params: {} },
      '@write': { tool: 'fs.write', params: {} },
      '@create': { tool: 'fs.write', params: {} },
      
      // Web operations
      '@search': { tool: 'web.search', params: {} },
      '@google': { tool: 'web.search', params: {} },
      // Cream & RSS helpers
      '@cream.fetch': { tool: 'cream.fetch', params: {} },
      '@rss': { tool: 'rss.read', params: {} },
      
      // Development tools
      '@compile': { tool: 'tex.compile', params: {} },
      '@tex': { tool: 'tex.compile', params: {} },
      '@latex': { tool: 'tex.compile', params: {} },
      '@pdf': { tool: 'tex.compile', params: {} },
      
      // GitHub operations
      '@github': { tool: 'github.fetch', params: { action: 'list' } },
      '@github-fetch': { tool: 'github.fetch', params: { action: 'fetch' } },
      '@github-list': { tool: 'github.fetch', params: { action: 'list' } },
      '@github-run': { tool: 'github.fetch', params: { action: 'execute' } },
      '@issue': { tool: 'gh.issues.create', params: {} },
      
      // Google Drive operations
      '@gdrive': { tool: 'gdrive.fetch', params: { action: 'list' } },
      '@gdrive-fetch': { tool: 'gdrive.fetch', params: { action: 'fetch' } },
      '@gdrive-list': { tool: 'gdrive.fetch', params: { action: 'list' } },
      '@gdrive-run': { tool: 'gdrive.fetch', params: { action: 'execute' } },
      '@drive': { tool: 'gdrive.fetch', params: { action: 'list' } },
      
      // Media processing
      '@image': { tool: 'image.convert', params: {} },
      '@video': { tool: 'ffmpeg.run', params: {} },
      '@convert': { tool: 'image.convert', params: {} },
      '@resize': { tool: 'image.convert', params: {} },
    };
  }

  /**
   * Check if a prompt starts with a sigil
   */
  hasSigil(prompt) {
    const trimmed = prompt.trim();
    return trimmed.startsWith('@');
  }

  /**
   * Extract sigil and arguments from prompt
   */
  parseSigil(prompt) {
    const trimmed = prompt.trim();
    if (!trimmed.startsWith('@')) {
      return null;
    }

    // For multiline commands like @executive, preserve the structure
    const firstLineMatch = trimmed.match(/^(@[^\s\n]+)(.*)$/s);
    if (firstLineMatch) {
      const sigil = firstLineMatch[1].toLowerCase();
      const args = firstLineMatch[2].trim();
      return { sigil, args };
    }

    // Fallback to space-based parsing
    const parts = trimmed.split(/\s+/);
    const sigil = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    return { sigil, args };
  }

  /**
   * Route sigil to appropriate tool call
   */
  routeSigil(prompt) {
    const parsed = this.parseSigil(prompt);
    if (!parsed) {
      return null;
    }

    const { sigil, args } = parsed;
    const mapping = this.sigilMap[sigil];
    
    if (!mapping) {
      return {
        error: true,
        message: `Unknown sigil: ${sigil}. Available sigils: ${Object.keys(this.sigilMap).slice(0, 10).join(', ')}...`
      };
    }

    // Build tool call based on mapping
    const toolCall = {
      tool: mapping.tool,
      args: { ...mapping.params }
    };

    // Add arguments based on tool type
    if (mapping.tool === 'jit') {
      this.addJITArgs(toolCall, mapping.params.type, args, prompt);
    } else {
      this.addStandardArgs(toolCall, mapping.tool, args);
    }

    return {
      success: true,
      sigil,
      toolCall,
      originalPrompt: prompt
    };
  }

  /**
   * Add arguments for JIT tools
   */
  addJITArgs(toolCall, jitType, args, originalPrompt = null) {
    switch (jitType) {
      case 'calc':
      case 'calculator':
        toolCall.args.expression = args;
        break;
        
      case 'analyze':
      case 'data':
        toolCall.args.file = args;
        break;
        
      case 'file':
      case 'process':
        // Parse file operation arguments
        const parts = args.split(/\s+/);
        if (parts.length >= 1) {
          toolCall.args.input = parts[0];
        }
        if (parts.length >= 2) {
          toolCall.args.output = parts[1];
        }
        break;
        
      case 'system':
      case 'info':
        // No additional args needed for system info
        break;
        
      case 'inspect':
        // Function inspection: @inspect functionName
        toolCall.args.function = args;
        break;
        
      case 'transpile':
        // XML-Lisp transpilation: @transpile <xml-function>
        toolCall.args.xml = args;
        break;
        
      case 'executive_request':
        // Executive request processing: @executive <business request>
        // Preserve the full structured format for multiline queries
        if (originalPrompt && originalPrompt.includes('\n') && originalPrompt.includes('- ')) {
          // For structured queries, pass the entire original prompt to preserve format
          toolCall.args.request = originalPrompt;
        } else {
          // For single line queries, reconstruct with sigil
          toolCall.args.request = `@executive ${args}`;
        }
        break;
        
      case 'prog':
      case 'program':
        // BASIC program execution: @prog <basic code>
        // Support multiline BASIC programs
        if (originalPrompt && (originalPrompt.includes('\n') || originalPrompt.includes('LET ') || originalPrompt.includes('RETURN '))) {
          // Extract BASIC code from the full prompt
          const progMatch = originalPrompt.match(/@prog[ram]*\s*([\s\S]*)/i);
          if (progMatch && progMatch[1]) {
            toolCall.args.code = progMatch[1].trim();
          } else {
            toolCall.args.code = args;
          }
        } else {
          toolCall.args.code = args;
        }
        break;
        
      case 'lang':
      case 'language':
        // Language code generation: @lang python: create QR generator
        // Format: @lang <language>: <task>
        const langMatch = args.match(/^(\w+):\s*(.+)$/);
        if (langMatch) {
          toolCall.args.language = langMatch[1];
          toolCall.args.task = langMatch[2];
        } else {
          // Improved fallback: detect language keywords in the text
          const supportedLanguages = ['python', 'javascript', 'js', 'bash', 'sh', 'powershell', 'ps1', 'java', 'go', 'rust', 'c', 'cpp'];
          let detectedLanguage = null;
          let taskText = args;
          
          // Look for language keywords anywhere in the text
          for (const lang of supportedLanguages) {
            const langRegex = new RegExp(`\\b${lang}\\b`, 'i');
            if (langRegex.test(args)) {
              detectedLanguage = lang;
              // Remove the language keyword from task text
              taskText = args.replace(langRegex, '').replace(/\s+/g, ' ').trim();
              break;
            }
          }
          
          // If no language detected, check if first word is a language
          const langParts = args.split(/\s+/);
          if (!detectedLanguage && langParts.length >= 2 && supportedLanguages.includes(langParts[0].toLowerCase())) {
            detectedLanguage = langParts[0].toLowerCase();
            taskText = langParts.slice(1).join(' ');
          }
          
          toolCall.args.language = detectedLanguage || 'javascript'; // default
          toolCall.args.task = taskText;
        }
        break;
        
      case 'save':
      case 'save_code':
        // Save AI-generated code: @save <ai_response_text>
        toolCall.args.response = args;
        break;
        
      case 'run':
      case 'execute':
        // Execute saved script: @run script_name.py
        toolCall.args.filename = args;
        break;
        
      case 'quiz':
      case 'test':
      case 'exam':
        // Parse quiz arguments: @quiz frontend intermediate 5
        const quizParts = args.split(/\s+/);
        if (quizParts.length >= 1 && quizParts[0]) {
          toolCall.args.topic = quizParts[0];
        }
        if (quizParts.length >= 2 && quizParts[1]) {
          toolCall.args.difficulty = quizParts[1];
        }
        if (quizParts.length >= 3 && quizParts[2] && !isNaN(quizParts[2])) {
          toolCall.args.questions = parseInt(quizParts[2]);
        }
        break;
        
      case 'rfq':
      case 'rfq-analysis':
      case 'proposal':
      case 'bid':
        // Parse RFQ arguments: 
        // @rfq "RFQ text here" rate=150 margin=20
        // @rfq file="./rfq.pdf" rate=150 margin=20
        
        // Check for file parameter first
        const fileMatch = args.match(/file=["']([^"']+)["']\s*(.*)/);
        if (fileMatch) {
          toolCall.args.file_path = fileMatch[1];
          const params = fileMatch[2];
          
          // Parse rate parameter
          const rateMatch = params.match(/rate=(\d+)/);
          if (rateMatch) {
            toolCall.args.hourly_rate = parseInt(rateMatch[1]);
          }
          
          // Parse margin parameter
          const marginMatch = params.match(/margin=(\d+)/);
          if (marginMatch) {
            toolCall.args.margin_target = parseInt(marginMatch[1]);
          }
        } else {
          // Handle quoted text format
          const rfqMatch = args.match(/^"([^"]+)"\s*(.*)/);
          if (rfqMatch) {
            toolCall.args.rfq_text = rfqMatch[1];
            const params = rfqMatch[2];
            
            // Parse rate parameter
            const rateMatch = params.match(/rate=(\d+)/);
            if (rateMatch) {
              toolCall.args.hourly_rate = parseInt(rateMatch[1]);
            }
            
            // Parse margin parameter
            const marginMatch = params.match(/margin=(\d+)/);
            if (marginMatch) {
              toolCall.args.margin_target = parseInt(marginMatch[1]);
            }
          } else if (args.trim()) {
            // If no quotes, treat entire args as RFQ text
            toolCall.args.rfq_text = args;
          }
        }
        break;
    }
  }

  /**
   * Add arguments for standard tools  
   */
  addStandardArgs(toolCall, toolName, args) {
    switch (toolName) {
      case 'shell.run':
        toolCall.args.command = args;
        break;
        
      case 'fs.read':
        toolCall.args.path = args;
        break;
        
      case 'fs.write':
        const parts = args.split(' -> ');
        if (parts.length === 2) {
          toolCall.args.path = parts[0];
          toolCall.args.content = parts[1];
        } else {
          toolCall.args.path = args;
          toolCall.args.content = ''; // Will need to be filled by AI
        }
        break;
        
      case 'web.search':
        toolCall.args.q = args;
        break;
        
      case 'cream.mail':
        // Parse email format: @email user@example.com subject: Subject text content: Body text
        // Also support: @email "user@example.com" "Subject" "Body"
        const structuredMatch = args.match(/^['"]*([^'"@]+@[^'"\s]+)['"]*\s+subject:\s*(.+?)\s+(?:mail\s+)?content:\s*(.+)$/i);
        const quotedMatch = args.match(/^['"]*([^'"@]+@[^'"\s]+)['"]*\s+"([^"]+)"\s+"([^"]+)"$/);
        
        if (structuredMatch) {
          toolCall.args.to_email = structuredMatch[1].replace(/['"]/g, '');
          toolCall.args.subject = structuredMatch[2].trim();
          toolCall.args.body = structuredMatch[3].trim();
          toolCall.args.from_email = 'noreply@knoblycream.com'; // Default sender
          toolCall.args.from_name = 'C9AI Assistant';
        } else if (quotedMatch) {
          toolCall.args.to_email = quotedMatch[1].replace(/['"]/g, '');
          toolCall.args.subject = quotedMatch[2];
          toolCall.args.body = quotedMatch[3];
          toolCall.args.from_email = 'noreply@knoblycream.com';
          toolCall.args.from_name = 'C9AI Assistant';
        } else {
          // Fallback - just set the recipient, let the system prompt for the rest
          const emailAddr = args.match(/['"]*([^'"@]+@[^'"\s]+)['"]*/);
          if (emailAddr) {
            toolCall.args.to_email = emailAddr[1].replace(/['"]/g, '');
            toolCall.args.subject = 'Message from C9AI';
            toolCall.args.body = args.replace(emailAddr[0], '').trim() || 'Hello from C9AI!';
            toolCall.args.from_email = 'noreply@knoblycream.com';
            toolCall.args.from_name = 'C9AI Assistant';
          }
        }
        break;
        
      case 'cream.post':
        // Parse post format: @post "Post content here" visibility:public
        // Also support: @post "Content" private
        const postContentMatch = args.match(/^"([^"]+)"\s*(?:visibility:)?(public|private)?/i);
        const simplePostMatch = args.match(/^"([^"]+)"\s+(public|private)/i);
        
        if (postContentMatch) {
          toolCall.args.content = postContentMatch[1];
          toolCall.args.visibility = postContentMatch[2] || 'public';
        } else if (simplePostMatch) {
          toolCall.args.content = simplePostMatch[1];
          toolCall.args.visibility = simplePostMatch[2];
        } else {
          // Fallback - treat entire args as content
          const cleanContent = args.replace(/^["']|["']$/g, ''); // Remove quotes
          toolCall.args.content = cleanContent || 'Hello from C9AI!';
          toolCall.args.visibility = 'public';
        }
        
        // Media files would need to be handled separately
        toolCall.args.media = [];
        break;
        
      case 'mail.send':
        // Parse email format: @email user@example.com "Subject" "Body"
        const legacyEmailMatch = args.match(/^(\S+)\s+"([^"]+)"\s+"([^"]+)"$/);
        if (legacyEmailMatch) {
          toolCall.args.to = legacyEmailMatch[1];
          toolCall.args.subject = legacyEmailMatch[2];
          toolCall.args.text = legacyEmailMatch[3];
        } else {
          toolCall.args.to = args; // Let AI figure out the rest
        }
        break;
        
      case 'whatsapp.send':
        const whatsappMatch = args.match(/^(\S+)\s+"([^"]+)"$/);
        if (whatsappMatch) {
          toolCall.args.to = whatsappMatch[1];
          toolCall.args.body = whatsappMatch[2];
        } else {
          toolCall.args.to = args;
        }
        break;
        
      case 'tex.compile':
        toolCall.args.mainFile = args;
        break;
        
      case 'image.convert':
        const imageParts = args.split(/\s+/);
        if (imageParts.length >= 2) {
          toolCall.args.input = imageParts[0];
          toolCall.args.output = imageParts[1];
        } else {
          toolCall.args.input = args;
        }
        break;
        
      case 'github.fetch':
        // Handle different GitHub fetch operations
        if (toolCall.args.action === 'fetch' || toolCall.args.action === 'list') {
          if (args) {
            toolCall.args.repo = args;
          }
        } else if (toolCall.args.action === 'execute') {
          const parts = args.split(/\s+/);
          if (parts.length >= 1) {
            toolCall.args.todoId = parts[0];
          }
          if (parts.includes('--live') || parts.includes('--execute')) {
            toolCall.args.dryRun = false;
          }
        }
        break;
        
      case 'gdrive.fetch':
        // Handle Google Drive fetch operations
        if (toolCall.args.action === 'fetch') {
          if (args) {
            const parts = args.split(/\s+/);
            if (parts[0]) {
              toolCall.args.query = parts[0];
            }
            if (parts[1]) {
              toolCall.args.format = parts[1];
            }
          }
        } else if (toolCall.args.action === 'execute') {
          const parts = args.split(/\s+/);
          if (parts.length >= 1) {
            toolCall.args.todoId = parts[0];
          }
          if (parts.includes('--live') || parts.includes('--execute')) {
            toolCall.args.dryRun = false;
          }
        }
        break;
        
      case 'gh.issues.list':
        const ghParts = args.split('/');
        if (ghParts.length >= 2) {
          toolCall.args.owner = ghParts[0];
          toolCall.args.repo = ghParts[1];
        }
        break;
        
      default:
        // Generic argument passing
        // Special parsing for cream.fetch and rss.read
        if (toolCall.tool === "cream.fetch") {
          const n = parseInt(args, 10);
          if (!isNaN(n) && n > 0) toolCall.args.limit = n;
        } else if (toolCall.tool === "rss.read") {
          const n = parseInt(args, 10);
          if (!isNaN(n) && n > 0) toolCall.args.rss_id = n;
          else if (args) toolCall.args.rss_id = args;
        } else {
          toolCall.args.input = args;
        }
        break;
    }
  }

  /**
   * Get help text for available sigils
   */
  getHelp() {
    const categories = {
      'Math & Calculations': ['@calc', '@calculate', '@math'],
      'Data Analysis': ['@analyze', '@data', '@csv'],
      'File Operations': ['@file', '@read', '@write', '@count', '@upper', '@lower'],
      'System Info': ['@system', '@info', '@status'],
      'Communication': ['@email', '@post', '@share', '@publish', '@whatsapp', '@sms'],
      'Web & Search': ['@search', '@google'],
      'Development': ['@compile', '@tex', '@latex', '@pdf'],
      'Media Processing': ['@image', '@video', '@convert', '@resize'],
      'GitHub': ['@github', '@issue'],
      'Tasks': ['@todo', '@task', '@run', '@shell']
    };

    let help = '🎯 **Available C9AI Sigils:**\\n\\n';
    
    for (const [category, sigils] of Object.entries(categories)) {
      help += `**${category}:**\\n`;
      help += sigils.map(s => `  ${s}`).join('\\n') + '\\n\\n';
    }
    
    help += '💡 **Usage Examples:**\\n';
    help += '• `@calc 22/7` - Calculate mathematical expressions\\n';
    help += '• `@analyze data.csv` - Analyze CSV files\\n';
    help += '• `@count document.txt` - Count lines in files\\n';
    help += '• `@search quantum computing` - Web search\\n';
    help += '• `@email user@example.com "Subject" "Message"` - Send emails\\n';
    help += '• `@post "Content here" visibility:public` - Create posts on Cream\\n';
    help += '• `@compile paper.tex` - Compile LaTeX documents\\n';

    return help;
  }
}

module.exports = SigilRouter;
