# C9AI Racket Edition

A simple AI agent system implemented in Racket Scheme, replicating and improving upon the Squeak version.

## Features

✅ **Perfect Unicode Support** - Kannada text renders perfectly with proper ligatures  
✅ **Modern Web Interface** - Clean, responsive design with real-time editing  
✅ **Robust HTTP Server** - Proper content-types and JSON handling  
✅ **Live AI Integration** - Ready for local/cloud AI connections  
✅ **Scheme Power** - Leveraging Racket's excellent web server capabilities  

## Quick Start

### Prerequisites
- Install Racket: https://racket-lang.org/

### Run the Server

```bash
cd /Users/hebbarp/todo-management/c9ai/racket
racket main.rkt
```

Then visit: **http://localhost:8080/editor**

## API Endpoints

- `GET /api/content` - Get current content
- `POST /api/save` - Save content (JSON: `{"content": "text"}`)
- `POST /api/ai-process` - Process content with AI

## Architecture

```
Browser (Perfect Unicode) ← HTTP/JSON → Racket Web Server ← Scheme → AI Engine
```

## Advantages over Node.js/Squeak

- **No content-type issues** like we had with Squeak WebServer
- **Perfect Unicode** handling without special character escaping  
- **Lisp power** for AI integration and data manipulation
- **Mature web server** with proper HTTP handling
- **Live coding** capabilities like Smalltalk

## Next Steps

1. **Test the basic functionality**
2. **Add local AI integration** (llama.cpp connection)
3. **Implement cloud AI fallback**  
4. **Add more sophisticated UI components**
5. **Integrate with existing C9AI Node.js features**

## Development

The server auto-reloads when you modify `main.rkt`. The interface includes:

- **Live editing** with auto-save capabilities
- **AI processing** button for content analysis
- **Real-time status** updates
- **Copy/paste** functionality
- **Perfect Kannada** font rendering