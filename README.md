# 🌟 C9 AI - Autonomous AI-Powered Productivity System

> Transform your productivity with AI agents that understand natural language, run locally for privacy, and execute tasks intelligently.

## ✨ What is C9 AI?

C9 AI is a revolutionary command-line interface that brings **intelligent AI assistance** to your local environment. Experience the future of productivity with:

- 🧠 **Natural Language Interface** - Talk to your computer like a human assistant
- 🔒 **Privacy-First Local AI** - Run Phi-3, LLaMA models locally with zero data sharing  
- ⚡ **Intelligent Task Execution** - From "compile my research paper" to automatic execution
- 🔄 **Smart Model Switching** - Seamless local ↔ cloud AI based on task complexity
- 🎯 **Context-Aware Processing** - AI that learns your patterns and preferences
- 💼 **Executive Business Analysis** - Structured query system for business decision making

## 🚀 Revolutionary Features

### 💼 Executive Business Analysis (NEW!)
```bash
# Structured executive queries for business decision making
@executive INVESTMENT
  - amount: 100000
  - upside: 10%
  - downside: 8%
  - years: 5

✨ Generated XML-Lisp function: investment_analysis
🚀 Ready to execute: @calc investment_risk_analysis(100000, 0.1, 0.08, 5, 0.5)

@executive VENDOR_DISCOUNT
  - invoice amount: 10000
  - discount offered: 2%
  
✨ Result: Save $200 with 2% early payment discount
```

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

### Quick Install (recommended)
```bash
npm install -g c9ai
```

### From source (optional)
```bash
git clone https://github.com/c9ai/c9ai.git
cd c9ai
npm install
npm link  # exposes `c9ai` locally
```

### Verify Installation
```bash
c9ai --help           # CLI loads and shows commands
npm info c9ai version # Should show 2.2.3
c9ai models list      # Show available local AI models
```

## 🎮 Getting Started

### CLI vs Web UI
- Primary: Command-line tool. The web UI is optional and visualizes the same agent loop the CLI runs.
- Everything the UI does can be performed from the CLI.

### CLI Usage Cheatsheet
```bash
# Interactive shell
c9ai

# One-shot tasks
c9ai agent "create hello.txt and list it"
echo "run tests" | c9ai agent
c9ai agent -f prompt.txt

# Providers
c9ai agent -p llamacpp           # llama.cpp server
c9ai agent -p ollama             # Ollama
LOCAL_PROVIDER=ollama c9ai agent "..."  # set default for session

# Tool allowlist and confirmation threshold
c9ai agent -a "shell.run,fs.read,fs.write" -t 0.7

# Start local stack (llama.cpp + API)
c9ai stack -m /path/to/model.gguf -p 8080

# Model control and todos
c9ai switch local|claude|gemini
c9ai models list
c9ai todo list
c9ai todo fetch-github
c9ai todo execute -i <id> --no-dry-run

# Shortcut binary
c9ai-agent "…"
```

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
| **GPT-OSS-20B** | 11.7GB | Advanced reasoning, tool calling | Complex tasks, on-device inference |
| **Claude** | Cloud API | Advanced reasoning | Complex analysis, coding help |
| **Gemini** | Cloud API | Creative tasks | Content creation, brainstorming |

## 🎯 Use Cases

### 💼 Executive Business Analysis
```bash
# Investment Analysis
@executive INVESTMENT
  - amount: 250000
  - upside: 15%
  - downside: 12%
  - years: 3
  - probability: 60%

# SaaS Business Metrics
@executive SAAS_BREAKEVEN
  - customer acquisition cost: 800
  - monthly recurring revenue: 120
  - churn rate: 3%

# Financial Planning
@executive FINANCE
  - principal: 50000
  - rate: 7.5%
  - years: 10
  - compounding: 12
```

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

## 💼 Executive Business Analysis System

C9 AI features a revolutionary **structured query system** designed specifically for executives and business professionals. Unlike unreliable natural language processing, this system provides **deterministic, compiler-like precision** for business calculations.

### ✨ Key Features

- **🎯 Executive-Friendly Syntax** - Uses familiar bullet-point format
- **⚡ Deterministic Results** - Reliable, predictable calculations every time
- **🏗️ Domain Templates** - Pre-configured for common business scenarios
- **🔧 Auto-Function Generation** - Creates reusable XML-Lisp functions
- **📊 Type-Safe Parsing** - Automatic parameter validation and conversion
- **🔄 Alias Support** - Multiple parameter names for flexibility

### 📋 Available Business Domains

#### INVESTMENT - Investment Risk Analysis
```bash
@executive INVESTMENT
  - amount: 100000
  - upside: 10%
  - downside: 8%
  - years: 5
  - probability: 50%    # Optional, defaults to 50%

# Generates: investment_risk_analysis function
# Calculates: Risk-adjusted expected returns with time horizons
```

#### VENDOR_DISCOUNT - Procurement Analysis  
```bash
@executive VENDOR_DISCOUNT
  - invoice amount: 50000
  - discount offered: 2%
  - payment terms: immediate    # Optional

# Generates: vendor_discount_analysis function
# Calculates: Actual savings from early payment discounts
```

#### SAAS_BREAKEVEN - SaaS Business Metrics
```bash
@executive SAAS_BREAKEVEN
  - customer acquisition cost: 500
  - monthly recurring revenue: 80
  - churn rate: 5%
  - fixed costs: 10000    # Optional

# Generates: saas_breakeven_analysis function  
# Calculates: Months to break even on customer acquisition
```

#### FINANCE - Financial Planning
```bash
@executive FINANCE
  - principal: 100000
  - rate: 6.5%
  - years: 10
  - compounding: 12    # Optional, defaults to annually

# Generates: compound_interest function
# Calculates: Future value with compound interest
```

### 🚀 How It Works

1. **Structured Input** - Write business queries in bullet-point format
2. **Domain Recognition** - System identifies business domain (INVESTMENT, SAAS, etc.)
3. **Parameter Parsing** - Extracts and validates all parameters with type conversion
4. **XML-Lisp Generation** - Creates business function using domain templates
5. **Function Registration** - Stores function for future reuse
6. **Execution Ready** - Provides ready-to-run calculation commands

### 💡 Example Workflow

```bash
# 1. Executive writes structured query
@executive INVESTMENT
  - amount: 500000
  - upside: 12%
  - downside: 8%
  - years: 7

# 2. System responds with analysis
✨ Generated INVESTMENT analysis function with structured parameters
📊 Function: investment_analysis created and registered
🚀 Ready to execute: @calc investment_risk_analysis(500000, 0.12, 0.08, 7, 0.5)

# 3. Execute the generated calculation
@calc investment_risk_analysis(500000, 0.12, 0.08, 7, 0.5)
# Result: Expected value considering risk and time horizon
```

### 🎯 Benefits for Executives

- **No Learning Curve** - Uses familiar bullet-point format
- **Consistent Results** - Same input always produces same output
- **Business Context** - Built specifically for executive decision making
- **Reusable Functions** - Generated functions available for future use
- **Parameter Flexibility** - Supports aliases (amount/investment amount/principal)
- **Type Safety** - Automatic percentage to decimal conversion

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

## 🚀 Version 2.2.0+ Features

### ✨ New in This Release
- **🧠 Local LLM Support** - Phi-3, TinyLLaMA, and LLaMA integration
- **🗣️ Natural Language Interface** - Talk naturally to your CLI
- **🔒 Privacy-First Design** - Optional local-only processing
- **⚡ Smart Model Switching** - Automatic local ↔ cloud routing
- **🎯 Intelligent Todo Processing** - Plain English → executable actions
- **🔧 System Command Understanding** - Natural language → shell commands
- **💼 Executive Business Analysis** - Structured query system for business calculations
- **📊 XML-Lisp Function Generation** - Auto-generates reusable business functions
- **🏗️ Domain-Aware Templates** - Pre-configured for INVESTMENT, SAAS, FINANCE domains

### Coming Soon (Phase 2)
- **🧠 Learning System** - AI that improves with your usage patterns
- **📊 Analytics Dashboard** - Personal productivity insights
- **🎯 Context-Aware Suggestions** - Smarter recommendations
- **⚙️ Auto-Optimization** - Self-improving workflow automation

## Agentic Tools

Built-ins: `shell.run`, `script.run`, `fs.read`, `fs.write`

New tools (enable by adding to `allowedTools` or toggle in UI):

- `web.search` — Google via SerpAPI. Requires `export SERPAPI_KEY=...`.
  - Args: `{ q: string, num?: number (<=20) }`
  - Result: `{ engine, total, items: [{title,link,snippet}] }`
  - Example prompt: *"Search for latest llama.cpp releases and give me top 3 links."*

- `tex.compile` — Compile LaTeX to PDF using `pdflatex` or `xelatex`.
  - Args: `{ mainFile: "paper.tex", engine?: "pdflatex"|"xelatex", outputDir?: "build/tex" }`
  - Output: `{ ok, code, pdf, stdout, stderr }`
  - Example: *"Compile docs/main.tex with xelatex and tell me where the PDF is."*

- `ffmpeg.run` — Run ffmpeg with controlled arguments.
  - Args: `{ input: "in.mp4", output: "out.mp4", args?: string|string[], overwrite?: boolean }`
  - Example: *"Transcode input.mov to output.mp4 at 2Mbps, 720p."*  
    → args: `-vf scale=-2:720 -b:v 2M -c:v libx264 -c:a aac -b:a 128k`

- `image.convert` — ImageMagick conversion.
  - Args: `{ input, output, resize?: "800x600"|"50%", quality?: 1..100 }`
  - Example: *"Resize img.png to 800x and save as jpg."*

> Note: Tools are path-sandboxed to the repo root. External CLIs (`ffmpeg`, `pdflatex`, `convert/magick`) must be installed and in PATH.

- **GitHub** (requires `GITHUB_TOKEN`)
  - `gh.issues.list` `{ owner, repo, state?: "open"|"closed"|"all", labels?: string|string[] }`
  - `gh.issues.create` `{ owner, repo, title, body?, labels? }`
  - `gh.issues.comment` `{ owner, repo, issueNumber, body }`

- **Email** via SMTP (requires `SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS`, optional `SMTP_SECURE=true|false`)
  - `mail.send` `{ to, subject, text?, html? }` (one of text/html required)

- **WhatsApp** via Twilio (requires `TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM`)
  - `whatsapp.send` `{ to: "+91xxxx", body }`

### Command Aliases
Add your own friendly commands that map to tools in `src/commands/aliases.js`.
Use the `command.run` tool with `{ name, params }` to invoke them.
Example:
```json
{ "tool": "command.run", "args": { "name": "send-email", "params": {
  "to":"user@example.com", "subject":"Hi", "text":"Hello from agent"
}}}
```

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
