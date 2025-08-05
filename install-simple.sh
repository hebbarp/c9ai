#\!/bin/bash
# C9 AI Simple Installation Script (no sudo required)

echo "🌟 Installing C9 AI - Autonomous AI-Powered Productivity System"
echo "=================================================================="

# Check Node.js
if \! command -v node &> /dev/null; then
    echo "❌ Node.js is required. Install from: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check Claude CLI
if \! command -v claude &> /dev/null; then
    echo "❌ Claude CLI not found. Please install Claude CLI first."
    echo "💡 Visit: https://docs.anthropic.com/claude/docs/cli"
    exit 1
fi
echo "✅ Claude CLI: Ready"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Make executable
chmod +x src/index.js

echo ""
echo "✅ C9 AI installed successfully\!"
echo ""
echo "🚀 Getting Started:"
echo "   node src/index.js           # Interactive mode"
echo "   node src/index.js --help    # Show all commands"
echo "   node src/index.js claude 'hello'  # Use Claude AI"
echo "   node src/index.js tools     # See available tools"
echo ""
echo "💡 For global access, add this alias to your shell:"
echo "   alias c9ai='node $(pwd)/src/index.js'"
echo ""
echo "🎉 Ready for autonomous AI-powered productivity\!"
EOF < /dev/null