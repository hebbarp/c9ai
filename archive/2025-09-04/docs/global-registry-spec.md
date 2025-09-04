# C9AI Global Tool Registry Specification

## Overview
C9AI Global Registry is a centralized hub for curated AI development tools, similar to npm, Homebrew, or Chocolatey.

## Architecture

### Registry Endpoint
- **Production**: `https://registry.c9ai.com`
- **Staging**: `https://staging-registry.c9ai.com` 
- **Local Dev**: `http://localhost:3000`

### API Endpoints

```
GET  /api/tools                    # List all available tools
GET  /api/tools/{toolId}           # Get tool details
GET  /api/tools/{toolId}/versions  # Get tool versions
GET  /api/tools/search?q={query}   # Search tools
GET  /api/categories               # List categories
POST /api/tools/{toolId}/install   # Get installation instructions
```

### Tool Package Structure

Each tool follows npm-like structure:

```
tool-package/
├── c9ai.json          # Tool manifest (like package.json)
├── install.js         # Installation script
├── src/               # Tool implementation
│   ├── index.js       # Main tool entry point
│   └── lib/           # Supporting libraries
├── test/              # Test files
├── docs/              # Documentation
└── README.md          # Tool description
```

### Tool Manifest Format (c9ai.json)

```json
{
  "name": "pdf-generator",
  "version": "1.2.0",
  "description": "Convert HTML/Markdown to PDF",
  "author": "C9AI Team <tools@c9ai.com>",
  "category": "documents",
  "tags": ["pdf", "conversion", "documents"],
  "dependencies": {
    "puppeteer": "^21.0.0",
    "markdown-it": "^13.0.0"
  },
  "c9ai": {
    "schema": {
      "content": {
        "type": "string",
        "required": true,
        "description": "Content to convert (HTML or Markdown)"
      },
      "format": {
        "type": "string",
        "enum": ["html", "markdown"],
        "default": "markdown"
      },
      "output": {
        "type": "string", 
        "description": "Output file path",
        "default": "output.pdf"
      }
    },
    "config": {
      "headless": {
        "type": "boolean",
        "default": true,
        "description": "Run in headless mode"
      }
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/c9ai/tools/tree/main/packages/pdf-generator"
  },
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Installation Process

1. **Discovery**: Client queries global registry
2. **Fetch**: Download tool package from GitHub/registry
3. **Validate**: Check signatures, dependencies
4. **Install**: Run install.js script
5. **Register**: Add to local tool runner
6. **Verify**: Run basic health checks

### Security & Curation

- **Signed Packages**: All tools signed by C9AI team
- **Code Review**: Manual review before registry inclusion  
- **Sandboxing**: Tools run in isolated environments
- **Dependency Scanning**: Automated security checks
- **Version Control**: Immutable versions, semantic versioning

### Tool Categories

- **Core** - Built-in system tools (shell, fs, web)
- **AI** - LLM integration tools (OpenAI, Anthropic, local models)
- **Data** - Data processing (CSV, JSON, databases)  
- **Web** - Web scraping, APIs, browsers
- **Documents** - PDF, Word, presentations
- **Social** - Social media APIs
- **Finance** - Accounting, payments, crypto
- **DevOps** - CI/CD, deployment, monitoring
- **Communication** - Email, Slack, teams

### Registry Implementation Options

#### Option 1: GitHub-based (Like Homebrew)
- Registry repo: `c9ai/tool-registry`
- Tools stored as subdirectories
- Formulas describe installation
- Uses GitHub API for discovery

#### Option 2: Dedicated Registry Service
- Custom API server
- Database for metadata
- CDN for package distribution
- Better analytics and search

#### Option 3: Hybrid (Recommended)
- GitHub for source control and review
- API service for fast discovery/search
- CDN for package caching
- Best of both worlds

## Next Steps

1. Choose implementation approach (GitHub vs API vs Hybrid)
2. Create tool package specification
3. Build registry client/installer
4. Launch with curated initial tool set