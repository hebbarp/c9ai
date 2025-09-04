# C9 AI Manual

## Installation

### Global NPM Installation (Recommended)

The c9ai package is published on npmjs.org and can be installed globally:

```bash
npm install -g c9ai
```

After installation, you can use `c9ai` command from anywhere in your terminal.

### Package Information

- **Package Name**: c9ai
- **Version**: 2.2.0
- **NPM Registry**: https://www.npmjs.com/package/c9ai
- **Description**: C9 AI - Autonomous AI-Powered Productivity CLI with Semi-Learning System

## Usage

Once installed globally, run:

```bash
c9ai
```

### Available Commands

#### AI & Conversation
- `@claude [prompt]` - Claude session or direct prompt
- `@gemini [prompt]` - Gemini session or direct prompt
- `@local [prompt]` - Local AI session or direct prompt
- `@conv <message>` - Explicit conversation mode
- `@cmd <command>` - Explicit command mode

#### Productivity & Content
- `todos [action]` - Manage todos (list, add, sync, execute)
- `write a post about <topic>` - Generate research-enhanced content
- `create an article about <topic>` - Generate comprehensive articles
- `issues list` - List GitHub issues
- `issues execute [#]` - Execute specific issue
- `achieve "<goal>"` - Autonomous goal achievement

#### System & Tools
- `scan <dirs...>` - Scan directories to build knowledge base
- `scan --help` - Show scanning options
- `tools list` - List all agentic tools
- `tools add` - Add new tool (interactive)
- `switch <model>` - Switch default AI model (claude|gemini|local)
- `! <command>` - Execute any shell command

#### Local AI Models
- `models install` - Install local AI models
- `models list` - Show available models
- `models status` - Check model status
- `models remove` - Remove installed models

## Semi-Learning System

C9 AI features an innovative semi-learning system that adapts to your work and expertise:

### Knowledge Base Scanner

The system can scan your local directories and automatically build a personalized knowledge base:

```bash
# Scan current directory
c9ai> scan

# Scan specific directories  
c9ai> scan ~/Documents ~/Projects

# Scan multiple locations
c9ai> scan ~/Code ~/Documents/Research
```

### What Gets Learned

The scanner intelligently extracts knowledge from:

- **📄 README files** → Project descriptions and features
- **📝 Markdown documentation** → Guides and technical docs
- **💻 Code files** → Comments, docstrings, and implementations
- **📦 package.json/requirements.txt** → Project metadata and dependencies
- **📋 CHANGELOG files** → Project evolution and updates

### Learning Characteristics

**Learns FROM you:**
- Your code projects → Technical knowledge and patterns
- Your documentation → Domain expertise and writing style
- Your README files → Project context and approaches
- Your comments & docs → Personal insights and methodologies

**Adapts TO you:**
- Content matches your coding style and terminology
- Topics reflect your actual projects and interests
- Examples use your specific tools and frameworks
- Perspectives incorporate your documented approaches

**Evolves WITH you:**
- Rescanning updates knowledge as projects change
- New projects automatically add new expertise areas
- Learning from successful content creation patterns
- Application usage patterns improve tool suggestions

### The Learning Loop

```
Your Projects → C9AI Scans → Knowledge Updates → 
Enhanced Content Generation → Continued Usage → Refined Learning
```

### Content Generation

After scanning, C9 AI can generate research-enhanced content about your actual work:

```bash
# Generate content using your extracted knowledge
c9ai> write a post about <your-project-name>
c9ai> create an article about <your-domain-expertise>
```

The generated content includes:
- **Definitions** based on your project documentation
- **Current trends** from your development patterns
- **Multiple perspectives** from your documented approaches
- **Real-world examples** from your actual implementations

### Knowledge Base Management

- **Automatic loading**: Knowledge base loads on startup
- **Dynamic updates**: Rescanning replaces outdated knowledge
- **Source tracking**: System remembers where knowledge originated
- **Fallback responses**: Graceful handling of unknown topics

## Features

- **Semi-Learning AI System**: Learns from your actual projects and documentation
- **Local AI Integration**: Privacy-first AI with Phi-3, LLaMA models
- **Cloud AI Integration**: Works with Claude and Gemini AI models
- **Research-Enhanced Content**: Generates substantial content with multiple perspectives
- **Agentic Tool Use**: Intelligent tool selection and execution
- **Todo Management**: Advanced task tracking and autonomous execution
- **Natural Language Interface**: Talk to your CLI like a human assistant
- **Knowledge Base Scanner**: Automatically builds expertise from your files
- **Application Learning**: Learns and improves from usage patterns
- **Cross-platform Support**: Works on Windows, macOS, and Linux

## Requirements

- Node.js >= 16.0.0
- NPM account for global installation

## Development

If you want to contribute or develop locally:

```bash
git clone <repository>
cd c9ai
npm install
npm run dev
```

## Troubleshooting

If you encounter issues:

1. Ensure Node.js version >= 16.0.0
2. Check npm permissions for global installations
3. Verify c9ai command is in your PATH after installation

## Support

For issues and bug reports, visit: https://github.com/c9ai/c9ai/issues