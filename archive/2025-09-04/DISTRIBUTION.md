# c9ai Distribution Guide

## 📦 Distribution Methods

### 1. Docker (Recommended)

**One-command deployment:**
```bash
# With Docker Compose
git clone https://github.com/yourusername/c9ai.git
cd c9ai
docker-compose up -d

# Or build manually
docker build -t c9ai .
docker run -p 3000:3000 -v c9ai_data:/root/.c9ai c9ai
```

**Access:** http://localhost:3000

### 2. NPM Package

**Global installation:**
```bash
npm install -g c9ai
c9ai  # Starts web interface
```

**Local installation:**
```bash
npx c9ai@latest
```

### 3. One-line installer

**macOS/Linux:**
```bash
curl -sSL https://raw.githubusercontent.com/yourusername/c9ai/main/scripts/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/yourusername/c9ai/main/scripts/install.ps1 | iex
```

### 4. GitHub Release

1. Download latest release from: https://github.com/yourusername/c9ai/releases
2. Extract archive
3. Run: `npm install && npm start`

## 🔧 Configuration

### API Keys Setup

Configure via web interface (Settings) or manually:

**~/.c9ai/settings.json:**
```json
{
  "apiKeys": {
    "ANTHROPIC_API_KEY": "your_claude_key",
    "OPENAI_API_KEY": "your_openai_key", 
    "SERPAPI_KEY": "your_serpapi_key",
    "YOUTUBE_API_KEY": "your_youtube_key"
  }
}
```

**Environment Variables:**
```bash
export ANTHROPIC_API_KEY="your_key"
export OPENAI_API_KEY="your_key"
# ... etc
```

## 🚀 Usage Modes

- **Web Interface**: `c9ai` → http://localhost:3000
- **Agent CLI**: `c9ai agent`
- **Chat CLI**: `c9ai chat`
- **Model Management**: `c9ai models list`

## 🐳 Docker Options

### Production Deployment
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  c9ai:
    image: c9ai:latest
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    restart: always
```

### Development
```bash
docker-compose -f docker-compose.dev.yml up
```

## 📱 Platform Support

- ✅ **macOS** (Intel/Apple Silicon)
- ✅ **Linux** (Ubuntu, Debian, CentOS, Alpine)
- ✅ **Windows** (native + WSL2)
- ✅ **Docker** (all platforms)
- ✅ **Cloud** (AWS, GCP, Azure)

## 🔒 Security Notes

- API keys stored locally in ~/.c9ai/
- No telemetry or data collection
- Local model execution option
- Self-hosted deployment supported