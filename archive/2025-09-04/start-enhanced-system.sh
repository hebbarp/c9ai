#!/bin/bash

echo "🚀 Starting Enhanced C9AI Executive Calculator System"
echo "======================================================"
echo ""

# Check if server file exists
if [ ! -f "server/agent-api.js" ]; then
    echo "❌ Server file not found. Please ensure you're in the c9ai directory."
    exit 1
fi

echo "📡 Starting server..."
echo ""

# Start the server with enhanced features
NODE_ENV=development node server/agent-api.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "✅ Enhanced C9AI System Running!"
echo "================================="
echo ""
echo "🌐 Available Interfaces:"
echo "  📱 Enhanced Chat (with debug):  http://localhost:8787/enhanced-chat-with-debug.html" 
echo "  🧮 Calculator Demo:             http://localhost:8787/enhanced-calc-demo.html"
echo "  📊 Main Interface:              http://localhost:8787/"
echo ""
echo "🎯 New Features:"
echo "  ✅ Context-aware conversations"
echo "  ✅ Transparent AI processing"  
echo "  ✅ Dynamic code generation"
echo "  ✅ Debug output window"
echo "  ✅ Math problem continuation"
echo "  ✅ ESC key abort functionality"
echo ""
echo "🧪 Test Scenarios:"
echo "  1. 'What is the area of a right triangle with one side 2 cm' → 'it is 4 cm'"
echo "  2. 'Calculate prime numbers up to 100'"
echo "  3. 'Compound interest: 50000 rupees from 1995 at 5.6% annually'"
echo "  4. 'ROI if invested 200000 and got back 350000'"
echo ""
echo "⏹️  Press Ctrl+C to stop the server"
echo ""

# Keep script running and handle cleanup
trap 'echo ""; echo "🛑 Shutting down server..."; kill $SERVER_PID 2>/dev/null; exit 0' SIGINT

# Wait for server process
wait $SERVER_PID