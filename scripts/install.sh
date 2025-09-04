#!/bin/bash

# c9ai Installation Script
# Supports: macOS, Linux, Windows (WSL)

set -e

echo "🚀 Installing c9ai - Universal AI Assistant"
echo "==========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    echo "📥 Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ "$MAJOR_VERSION" -lt 16 ]; then
    echo "❌ Node.js version $NODE_VERSION is too old"
    echo "📥 Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION detected"

# Install c9ai
echo "📦 Installing c9ai..."
npm install -g c9ai

# Create settings directory
mkdir -p ~/.c9ai

# Create default settings if they don't exist
if [ ! -f ~/.c9ai/settings.json ]; then
    echo "⚙️ Creating default settings..."
    cat > ~/.c9ai/settings.json << 'EOF'
{
  "apiKeys": {
    "ANTHROPIC_API_KEY": "",
    "OPENAI_API_KEY": "",
    "GEMINI_API_KEY": "",
    "SERPAPI_KEY": "",
    "YOUTUBE_API_KEY": "",
    "CREAM_API_KEY": ""
  },
  "preferences": {
    "defaultProvider": "llamacpp",
    "theme": "dark",
    "notifications": true
  }
}
EOF
fi

echo ""
echo "🎉 c9ai installed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure API keys: c9ai --help"
echo "2. Start the web interface: c9ai"
echo "3. Try agent mode: c9ai agent"
echo "4. View available models: c9ai models list"
echo ""
echo "📚 Documentation: https://github.com/yourusername/c9ai"
echo "🐛 Issues: https://github.com/yourusername/c9ai/issues"
echo ""
echo "Happy AI-assisted productivity! 🤖✨"