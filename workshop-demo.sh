#!/bin/bash
# C9 AI Workshop Demonstration Script
# Run this to demonstrate the autonomous AI capabilities

echo "🎪 C9 AI Workshop Demonstration"
echo "==============================="
echo ""
echo "🌟 Welcome to the future of AI-powered productivity!"
echo "Today you'll see autonomous AI agents that can:"
echo "   🧠 Reason through complex tasks"
echo "   🔧 Execute local tools automatically"
echo "   🔄 Iterate until goals are achieved"
echo "   📊 Manage your entire workflow"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi
echo "✅ Node.js: $(node --version)"

if ! command -v claude &> /dev/null; then
    echo "❌ Claude CLI not found. Please install Claude CLI first."
    echo "💡 Visit: https://docs.anthropic.com/claude/docs/cli"
    exit 1
fi
echo "✅ Claude CLI: Ready"

if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Installing..."
    brew install gh 2>/dev/null || echo "Please install GitHub CLI manually"
else
    echo "✅ GitHub CLI: Ready"
fi

echo ""
echo "🚀 Starting C9 AI demonstration..."
echo ""

# Demo 1: Basic AI Interaction
echo "📺 DEMO 1: Basic AI Interaction"
echo "--------------------------------"
echo "💬 Asking Claude to introduce itself..."
node src/index.js claude "Introduce yourself and explain what makes you special for productivity tasks"
echo ""
read -p "Press Enter to continue to the next demo..."

# Demo 2: Todo Management Integration
echo ""
echo "📺 DEMO 2: Todo Management Integration"  
echo "--------------------------------------"
echo "📋 Showing current todos from GitHub Issues..."
node src/index.js todos list
echo ""
read -p "Press Enter to continue to the next demo..."

# Demo 3: Autonomous Execution Preview
echo ""
echo "📺 DEMO 3: Autonomous Execution Preview"
echo "---------------------------------------"
echo "🤖 Demonstrating autonomous task execution..."
echo "💡 In a real scenario, this would analyze your todos and execute them automatically"
node src/index.js claude --autonomous "analyze the current project structure and suggest improvements"
echo ""
read -p "Press Enter to continue to the next demo..."

# Demo 4: AI Model Switching
echo ""
echo "📺 DEMO 4: AI Model Switching"
echo "-----------------------------"
echo "🔄 Switching between AI models for specialized tasks..."
node src/index.js switch gemini
echo "✨ Now using Gemini for creative tasks..."
node src/index.js gemini "create a creative summary of what we've demonstrated today"
echo ""
echo "🔄 Switching back to Claude..."
node src/index.js switch claude
echo ""
read -p "Press Enter to continue to the final demo..."

# Demo 5: Tools and Analytics
echo ""
echo "📺 DEMO 5: Tools and Analytics"
echo "------------------------------"
echo "🔧 Available tools for autonomous execution:"
node src/index.js tools
echo ""
echo "📊 Usage analytics:"
node src/index.js analytics
echo ""

# Conclusion
echo "🎉 DEMONSTRATION COMPLETE!"
echo "=========================="
echo ""
echo "🌟 What you've seen:"
echo "   ✅ Autonomous AI agents that execute tasks"
echo "   ✅ Seamless integration with existing tools"
echo "   ✅ Multiple AI models for specialized work"
echo "   ✅ Real todo management and productivity tracking"
echo ""
echo "🚀 Next Steps:"
echo "   1. Install C9 AI: ./install.sh"
echo "   2. Start interactive mode: c9ai"
echo "   3. Try autonomous execution: c9ai claude --autonomous 'your task'"
echo "   4. Integrate with your workflow"
echo ""
echo "💡 Workshop Challenge:"
echo "   Use C9 AI to complete a real task from your todo list!"
echo ""
echo "🙏 Thank you for attending the C9 AI workshop!"
echo "   Questions? Let's discuss how AI can transform your productivity."