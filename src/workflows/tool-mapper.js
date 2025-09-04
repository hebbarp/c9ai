/**
 * Tool Mapping System for Vibe Workflows
 * Maps template tools to actual available C9AI tools
 */

"use strict";

class ToolMapper {
  constructor() {
    // Map template tools to actual available C9AI tools
    this.toolMappings = {
      // Web & Search Tools
      'web.search': ['web.search'],
      'rss.read': ['rss.read'], // Now maps to actual RSS tool!
      'social.scan': ['cream.fetch'], // Use cream posts for social content
      'social.post': ['cream.post'], // Use cream posting
      
      // Content Creation Tools
      'ai.write': ['fs.write'], // Use agent response + file write
      'ai.brainstorm': [], // Use agent directly without tools
      'ai.summarize': [], // Use agent directly without tools
      'markdown.edit': ['fs.write'], // Write markdown files
      'grammar.check': [], // Use agent directly for grammar
      
      // Visual & Media Tools  
      'image.generate': [], // Would need external API - use agent to suggest alternatives
      'image.convert': ['image.convert'], // Available!
      'canva.api': [], // External - use agent to suggest alternatives
      'unsplash.fetch': ['web.search'], // Search for images instead
      
      // File & System Tools
      'file.scan': ['fs.read', 'shell.run'], // Use ls and file reading
      'fs.read': ['fs.read'], // Direct mapping
      'fs.write': ['fs.write'], // Direct mapping
      'shell.run': ['shell.run'], // Direct mapping
      
      // Development Tools
      'code.generate': ['fs.write'], // Generate code and write to file
      'ui.framework': ['fs.write'], // Generate UI code and write
      'api.mock': ['fs.write'], // Generate mock API and write
      'jupyter.notebook': ['fs.write'], // Create notebook files
      
      // Data Processing Tools
      'pandas.clean': ['shell.run'], // Use Python via shell
      'sql.transform': ['shell.run'], // Use SQL tools via shell
      'database.connect': ['shell.run'], // Use CLI tools via shell
      'matplotlib.plot': ['shell.run'], // Use Python via shell
      'seaborn.viz': ['shell.run'], // Use Python via shell
      
      // Communication & Publishing Tools
      'social.post': ['cream.post'], // Use cream posting API
      'blog.publish': ['fs.write'], // Write blog files
      'mail.send': ['cream.mail'], // Use cream mailer API
      'whatsapp.send': ['whatsapp.send'], // Available!
      
      // Analytics & Reporting Tools
      'analytics.track': [], // Use agent suggestions
      'report.generate': ['fs.write'], // Generate and write reports
      'presentation.create': ['fs.write'], // Generate slides/presentations
      
      // Deployment & Development Tools
      'vercel.deploy': ['shell.run'], // Use CLI via shell
      'netlify.publish': ['shell.run'], // Use CLI via shell  
      'github.pages': ['shell.run'], // Use git commands via shell
      'gh.issues.create': ['gh.issues.create'], // Available!
      'gh.issues.list': ['gh.issues.list'], // Available!
      
      // Survey & Feedback Tools
      'survey.create': ['fs.write'], // Create survey files
      'user.interview': [], // Use agent for guidance
      
      // Media Processing Tools
      'ffmpeg.run': ['ffmpeg.run'], // Available!
      'tex.compile': ['tex.compile'], // Available!
      
      // Mind Mapping & Organization Tools
      'mindmap.create': ['fs.write'], // Create mind map files
      'sketch.digital': ['fs.write'], // Create sketch files
      
      // Video & Media Tools
      'youtube.search': ['youtube.search'], // YouTube video search
      'video.search': ['youtube.search'], // Generic video search maps to YouTube
      'trending.videos': ['youtube.trending'] // Trending videos
    };
    
    // Instructions for how to use mapped tools for specific template tools
    this.toolInstructions = {
      'rss.read': 'Use rss.read to fetch actual RSS feed content from KnoblyCream',
      'social.scan': 'Use cream.fetch to get recent social posts and trending content',
      'social.post': 'Use cream.post to create and publish posts with optional media',
      'ai.write': 'Generate the requested content and save it to a file using fs.write',
      'ai.brainstorm': 'Generate creative ideas and suggestions based on the user request',
      'image.generate': 'Suggest alternative approaches like finding existing images or creating ASCII art',
      'canva.api': 'Provide design suggestions and templates that can be manually created',
      'unsplash.fetch': 'Use web.search to find image sources and provide image suggestions',
      'social.post': 'Create engaging social media post content tailored to the platform',
      'analytics.track': 'Provide analytics recommendations and tracking setup guidance',
      'code.generate': 'Generate functional code and save it to appropriate files using fs.write',
      'ui.framework': 'Create UI component code and save to files using fs.write',
      'api.mock': 'Generate mock API responses and endpoints, save as JSON files',
      'pandas.clean': 'Generate Python pandas code for data cleaning and run via shell.run',
      'sql.transform': 'Create SQL transformation queries and execute via shell.run',
      'matplotlib.plot': 'Generate Python plotting code and execute via shell.run',
      'jupyter.notebook': 'Create Jupyter notebook files (.ipynb) with analysis code',
      'report.generate': 'Create comprehensive reports in markdown or HTML format',
      'presentation.create': 'Generate presentation content in markdown or HTML slides format',
      'vercel.deploy': 'Use shell.run to execute vercel deployment commands',
      'netlify.publish': 'Use shell.run to execute netlify deployment commands',
      'github.pages': 'Use shell.run to execute git commands for GitHub Pages deployment',
      'survey.create': 'Generate survey forms in HTML or markdown format',
      'mindmap.create': 'Create mind map content in structured text or markdown format',
      'sketch.digital': 'Create ASCII art or text-based sketches and diagrams',
      'youtube.search': 'Search YouTube for videos related to the topic with youtube.search',
      'video.search': 'Find videos on YouTube using youtube.search with relevant keywords',
      'trending.videos': 'Get current trending videos using youtube.trending',
      'mail.send': 'Send emails using cream.mail with from_email, to_email, subject, and body'
    };
  }
  
  /**
   * Map template tools to actual available C9AI tools
   */
  mapTools(templateTools) {
    const mappedTools = [];
    const instructions = [];
    
    for (const templateTool of templateTools) {
      const realTools = this.toolMappings[templateTool] || [];
      mappedTools.push(...realTools);
      
      if (this.toolInstructions[templateTool]) {
        instructions.push(`${templateTool}: ${this.toolInstructions[templateTool]}`);
      }
    }
    
    // Remove duplicates
    return {
      tools: [...new Set(mappedTools)],
      instructions: instructions,
      originalTools: templateTools
    };
  }
  
  /**
   * Generate tool-specific prompt for agent execution
   */
  generateToolPrompt(step, userInputs, mappedToolInfo) {
    let prompt = `You are helping with a workflow step. Use the available tools to accomplish the task.

🎯 TASK: ${step.step.replace('-', ' ')}
📝 DESCRIPTION: ${step.description}

💬 USER'S SPECIFIC REQUEST:
${userInputs.quickInput || 'Complete this step as described'}

🔧 CUSTOM INSTRUCTIONS:
${userInputs.customPrompt || 'None provided'}

📁 FILES PROVIDED:
${userInputs.files && userInputs.files.length > 0 ? Array.from(userInputs.files).map(f => f.name).join(', ') : 'No files provided'}

⚡ TOOL MAPPING INSTRUCTIONS:
${mappedToolInfo.instructions.join('\n')}

🛠️ AVAILABLE C9AI TOOLS: ${mappedToolInfo.tools.join(', ')}

IMPORTANT: 
- Use the actual C9AI tools listed above (${mappedToolInfo.tools.join(', ')})
- Follow the tool mapping instructions to accomplish what was intended by: ${mappedToolInfo.originalTools.join(', ')}
- For tools that map to fs.write, generate the content and save it to an appropriate file
- For tools that map to web.search, search for relevant information 
- For tools that map to shell.run, execute appropriate commands
- If a template tool has no mapping, provide helpful guidance and alternatives
- Create concrete, useful output that directly addresses the user's request

Please execute the appropriate tools and provide a detailed, practical response.`;

    return prompt;
  }
  
  /**
   * Get suggestions for unmapped tools
   */
  getUnmappedToolSuggestions(templateTool) {
    const suggestions = {
      'image.generate': 'Consider using DALL-E API, Midjourney, or Stable Diffusion via external integrations',
      'canva.api': 'Use Canva manually or consider Figma API for programmatic design',
      'social.post': 'Generate content and use platform-specific APIs (Twitter API, Facebook Graph API, etc.)',
      'analytics.track': 'Integrate with Google Analytics, Mixpanel, or similar analytics platforms',
      'user.interview': 'Use video call tools like Zoom API or scheduling tools like Calendly API'
    };
    
    return suggestions[templateTool] || 'This tool would require external API integration';
  }
}

module.exports = { ToolMapper };