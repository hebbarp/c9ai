#!/bin/bash
# C9 AI Installation Script

echo "🌟 Installing C9 AI - Autonomous AI-Powered Productivity System"
echo "=================================================================="

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make executable
chmod +x src/index.js

# Create symlink for global access
echo "🔗 Creating global symlink..."
sudo ln -sf "$(pwd)/src/index.js" /usr/local/bin/c9ai

# Test installation
echo "🧪 Testing installation..."
if c9ai --version; then
    echo "✅ C9 AI installed successfully!"
    echo ""
    echo "🚀 Getting Started:"
    echo "   c9ai                    # Interactive mode"
    echo "   c9ai claude 'hello'     # Use Claude AI"
    echo "   c9ai tools              # See available tools"
    echo "   c9ai todos list         # List your todos"
    echo ""
    echo "💡 Make sure you have Claude CLI installed:"
    echo "   Check: claude --version"
    echo ""
    echo "🎉 Ready for autonomous AI-powered productivity!"
else
    echo "❌ Installation failed. Check permissions and try again."
    exit 1
fi