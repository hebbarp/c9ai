# 🌟 C9 AI - Autonomous AI-Powered Productivity System

> Transform your productivity with AI agents that understand natural language, run locally for privacy, and execute tasks intelligently.

## ✨ What is C9 AI?

C9 AI is a revolutionary command-line interface that brings **intelligent AI assistance** to your local environment. Experience the future of productivity with:

- 🧠 **Natural Language Interface** - Talk to your computer like a human assistant
- 🔒 **Privacy-First Local AI** - Run Phi-3, LLaMA models locally with zero data sharing  
- ⚡ **Intelligent Task Execution** - From "compile my research paper" to automatic execution
- 🔄 **Smart Model Switching** - Seamless local ↔ cloud AI based on task complexity
- 🎯 **Context-Aware Processing** - AI that learns your patterns and preferences

## 🚀 Revolutionary Features

### 🗣️ Natural Language Interface
```bash
c9ai> compile my research paper
🧠 AI suggested: @action: compile research_paper.tex
✅ Executing: pdflatex research_paper.tex

c9ai> make a list of all documents in /Users/me/projects directory  
🔧 Executing: ls -la "/Users/me/projects"
```

### 🔒 Privacy-First Local AI
```bash
c9ai models install phi-3          # Download Microsoft Phi-3 (2.2GB)
c9ai switch local                  # All processing stays on your machine
c9ai todos add "analyze my data"   # Zero data sent to external APIs
```

### ⚡ Intelligent Todo Management
```bash
# Natural language todos that convert to executable actions
c9ai todos add "compile my research paper"     → @action: compile research.tex
c9ai todos add "open my budget spreadsheet"   → @action: open budget.xlsx  
c9ai todos add "search for AI tutorials"      → @action: search AI tutorials
c9ai todos execute                            # Run selected todos automatically
```

### 🧠 Smart Model Selection
```bash
c9ai switch local    # Use downloaded Phi-3/LLaMA for simple tasks
c9ai switch claude   # Use cloud AI for complex reasoning
c9ai switch gemini   # Auto-switches based on task complexity (coming soon)
```

## 📦 Installation

### Prerequisites
- Node.js 16+ ([Download](https://nodejs.org))
- Optional: Claude CLI for cloud fallback ([Setup guide](https://docs.anthropic.com/claude/docs/cli))

### Quick Install
```bash
git clone https://github.com/c9ai/c9ai.git
cd c9ai
npm install
npm run install-global
```

### Verify Installation
```bash
c9ai --version   # Should show 2.0.0
c9ai models list # Show available local AI models
```

## 🎮 Getting Started

### 1. Interactive Mode (Recommended)
```bash
c9ai
```
Launches intelligent shell with natural language processing.

### 2. Install Local AI Model (Optional but Recommended)
```bash
c9ai models install phi-3    # Download Microsoft Phi-3 (2.2GB)
c9ai switch local           # Enable privacy-first local processing
```

### 3. Natural Language Commands
```bash
# System commands
c9ai> list all files in my documents directory
c9ai> check disk usage
c9ai> show running processes

# Todo management  
c9ai> todos add "compile my presentation slides"
c9ai> todos execute

# Model switching
c9ai> switch claude    # Use cloud AI
c9ai> switch local     # Use local AI
```

## 🤖 Model Management

### Available Models
```bash
c9ai models list                    # Show available models
c9ai models install phi-3          # Microsoft Phi-3 Mini (2.2GB)
c9ai models install tinyllama      # TinyLLaMA (680MB) - for testing
c9ai models status                 # Check disk usage and status
c9ai models remove phi-3           # Free up disk space
```

### Model Comparison
| Model | Size | Strengths | Use Cases |
|-------|------|-----------|-----------|
| **Phi-3** | 2.2GB | Excellent reasoning, tool use | Perfect for natural language → actions |
| **TinyLLaMA** | 680MB | Fast, lightweight | Quick testing, simple commands |
| **Claude** | Cloud API | Advanced reasoning | Complex analysis, coding help |
| **Gemini** | Cloud API | Creative tasks | Content creation, brainstorming |

## 🎯 Use Cases

### Software Development
```bash
c9ai> compile my TypeScript project
c9ai> run tests for the authentication module  
c9ai> list all Python files in the src directory
```

### Document Management
```bash
c9ai> open my quarterly budget spreadsheet
c9ai> compile my research paper to PDF
c9ai> search for machine learning papers
```

### System Administration
```bash
c9ai> check disk usage on all drives
c9ai> list all running processes
c9ai> show files modified in the last week
```

## 🔧 Advanced Features

### Smart Fallback System
1. **Local AI First** - Privacy-preserving, fast processing
2. **Cloud AI Fallback** - Complex tasks automatically routed to Claude/Gemini
3. **Manual Commands** - Direct @action execution for power users

### Todo Execution Modes
```bash
# Manual structured format (power users)
c9ai todos add "Fix bug @action: compile debug.c"

# Natural language (converts automatically)  
c9ai todos add "fix the memory leak in my C program"

# Intelligent execution
c9ai todos execute  # Select and run multiple todos
```

### Context-Aware Processing
- Remembers recent commands for better suggestions
- Learns successful action patterns
- Adapts to your workflow over time

## 📊 Privacy & Security

### Local Processing
- **Phi-3/LLaMA models** run entirely on your machine
- **Zero external API calls** when using local mode
- **Your data never leaves** your computer

### Intelligent Routing  
- **Simple tasks** → Local AI (private, fast)
- **Complex analysis** → Cloud AI (with your explicit permission)
- **Full transparency** - always shows which model is being used

## 🛠️ Configuration

### Model Settings
```bash
c9ai config                    # Show current configuration
c9ai switch local             # Set default to local AI
c9ai switch claude            # Set default to Claude
```

### File Locations
- **Models**: `~/.c9ai/models/` - Downloaded AI models
- **Config**: `~/.c9ai/config.json` - User preferences  
- **Scripts**: `~/.c9ai/scripts/` - Custom automation tools
- **Logs**: `~/.c9ai/logs/` - Interaction history

## 🎪 Perfect for Workshops & Demos

### Wow Factor Demonstrations
1. **"Compile my research paper"** → Watch natural language become `pdflatex` execution
2. **"List documents in my projects folder"** → See AI convert to `ls -la` commands  
3. **Switch models in real-time** → Show local vs cloud processing
4. **Privacy showcase** → All AI processing running locally

### Technical Audience Appeal
- **Show actual code** - Open source, inspectable Node.js
- **Demonstrate architecture** - Local AI + cloud fallback + pattern recognition
- **Performance metrics** - Local processing speed vs cloud latency
- **Privacy story** - Zero external API calls in local mode

## 🚀 Version 2.0.0 Features

### ✨ New in This Release
- **🧠 Local LLM Support** - Phi-3, TinyLLaMA, and LLaMA integration
- **🗣️ Natural Language Interface** - Talk naturally to your CLI
- **🔒 Privacy-First Design** - Optional local-only processing
- **⚡ Smart Model Switching** - Automatic local ↔ cloud routing
- **🎯 Intelligent Todo Processing** - Plain English → executable actions
- **🔧 System Command Understanding** - Natural language → shell commands

### Coming Soon (Phase 2)
- **🧠 Learning System** - AI that improves with your usage patterns
- **📊 Analytics Dashboard** - Personal productivity insights
- **🎯 Context-Aware Suggestions** - Smarter recommendations
- **⚙️ Auto-Optimization** - Self-improving workflow automation

## 🤝 Contributing

C9 AI is designed for extensibility:
- **Add new AI models** - Support for more local LLMs
- **Create custom actions** - Extend the @action system
- **Build integrations** - Connect with your favorite tools
- **Improve intelligence** - Better natural language understanding

## 📄 License

MIT License - Build the future of AI-powered productivity!

---

**🚀 Ready to experience the future of productivity?**

Start with: `c9ai models install phi-3 && c9ai switch local`

Then try: `c9ai> compile my presentation slides`

*Experience AI that understands, acts, and respects your privacy.*