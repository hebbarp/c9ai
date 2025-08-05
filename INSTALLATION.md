# 📦 C9 AI Installation Guide

## 🖥️ **macOS/Linux Installation**

### Prerequisites
- Node.js 16+ ([Download](https://nodejs.org))
- Claude CLI ([Installation guide](https://docs.anthropic.com/claude/docs/cli))

### Quick Install
```bash
cd c9ai
./install-simple.sh
```

### Manual Setup
```bash
# Install dependencies
npm install

# Make executable
chmod +x src/index.js

# Add to your shell (choose one):
echo "alias c9ai='node $(pwd)/src/index.js'" >> ~/.zshrc     # Zsh
echo "alias c9ai='node $(pwd)/src/index.js'" >> ~/.bashrc    # Bash
```

### Usage
```bash
# After installation
c9ai                          # Interactive mode
c9ai claude "hello world"     # Direct command
c9ai --help                   # Show help

# Or with full path
node src/index.js claude "hello world"
```

## 🪟 **Windows Installation**

### Prerequisites
- Node.js 16+ ([Download](https://nodejs.org))
- Claude CLI ([Installation guide](https://docs.anthropic.com/claude/docs/cli))

### Quick Install
```cmd
cd c9ai
install-windows.bat
```

### Usage Options

#### Option 1: Batch File (Recommended)
```cmd
c9ai.bat                      # Interactive mode
c9ai.bat claude "hello world" # Direct command
c9ai.bat --help               # Show help
```

#### Option 2: PowerShell
```powershell
.\c9ai.ps1 claude "hello world"
.\c9ai.ps1 --help
```

#### Option 3: Direct Node.js
```cmd
node src\index.js claude "hello world"
node src\index.js --help
```

### Add to PATH (Optional)
1. Copy the full path to the c9ai directory
2. Add to Windows PATH environment variable
3. Use `c9ai.bat` from anywhere

## 🧪 **Testing Installation**

### Basic Test
```bash
# macOS/Linux
c9ai --version
c9ai claude "introduce yourself"

# Windows  
c9ai.bat --version
c9ai.bat claude "introduce yourself"
```

### Advanced Test
```bash
# Test autonomous execution
c9ai claude --autonomous "analyze my current directory"

# Test tool integration
c9ai tools
c9ai todos list

# Test AI switching
c9ai switch gemini
c9ai gemini "hello from gemini"
```

## 🔧 **Troubleshooting**

### Common Issues

#### "command not found: c9ai"
**Solution**: Use full path or check alias setup
```bash
# Use full path
node /path/to/c9ai/src/index.js

# Or reset alias
alias c9ai='node /path/to/c9ai/src/index.js'
```

#### "Claude CLI not found"
**Solution**: Install Claude CLI first
- Visit: https://docs.anthropic.com/claude/docs/cli
- Verify with: `claude --version`

#### Windows PowerShell Execution Policy
**Solution**: Enable script execution
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Node.js Dependencies Error
**Solution**: Clean install
```bash
rm -rf node_modules package-lock.json
npm install
```

## 🎪 **Workshop Setup**

### For Organizers
```bash
# Prepare for participants
git clone <repo>
cd todo-management/c9ai
./install-simple.sh  # macOS/Linux
# OR
install-windows.bat   # Windows
```

### For Participants
1. **Prerequisites**: Install Node.js and Claude CLI
2. **Quick Start**: Run installer for your platform
3. **Test**: `c9ai claude "hello world"`
4. **Ready**: Follow along with live demos!

## 📋 **Verification Checklist**

- [ ] Node.js installed and working
- [ ] Claude CLI installed and authenticated  
- [ ] C9 AI dependencies installed
- [ ] Basic commands work (`c9ai --help`)
- [ ] Claude integration works (`c9ai claude "test"`)
- [ ] Autonomous mode works (`c9ai claude --autonomous "test"`)

**Ready for AI-powered productivity!** 🚀🤖