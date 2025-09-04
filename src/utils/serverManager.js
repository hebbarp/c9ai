const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const Logger = require('./logger');
const chalk = require('chalk');

class ServerManager {
    constructor() {
        this.llamacppProcess = null;
        this.isStarting = false;
    }

    /**
     * Check if llamacpp server is running
     */
    async isLlamacppRunning() {
        const baseUrl = process.env.LLAMACPP_BASE_URL || 'http://127.0.0.1:8080';
        try {
            const fetch = (await import('node-fetch')).default;
            // Try multiple endpoints that llamacpp server provides
            const endpoints = ['/v1/models', '/health', '/'];
            
            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(`${baseUrl}${endpoint}`, { timeout: 2000 });
                    if (response.ok) {
                        console.log(`✅ Server detected via ${endpoint}`);
                        return true;
                    }
                } catch (endpointError) {
                    continue; // Try next endpoint
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Find llamacpp server binary
     */
    async findLlamacppServer() {
        // Common locations for llamacpp server
        const possiblePaths = [
            // Homebrew
            '/opt/homebrew/bin/llama-server',
            '/usr/local/bin/llama-server',
            // Manual installs
            path.join(process.env.HOME, 'llama.cpp/llama-server'),
            path.join(process.env.HOME, 'llamacpp/llama-server'),
            // Current directory
            './llama-server',
            // PATH
            'llama-server'
        ];

        for (const serverPath of possiblePaths) {
            try {
                if (serverPath === 'llama-server') {
                    // Check if it's in PATH
                    return new Promise((resolve) => {
                        exec('which llama-server', (error) => {
                            resolve(error ? null : 'llama-server');
                        });
                    });
                } else {
                    const exists = await fs.pathExists(serverPath);
                    if (exists) return serverPath;
                }
            } catch (error) {
                continue;
            }
        }
        return null;
    }

    /**
     * Auto-start llamacpp server with a model
     */
    async startLlamacppServer(modelsDir) {
        if (this.isStarting) {
            Logger.info('Server is already starting...');
            return false;
        }

        if (await this.isLlamacppRunning()) {
            Logger.info('Llamacpp server is already running');
            return true;
        }

        this.isStarting = true;

        try {
            const serverBinary = await this.findLlamacppServer();
            if (!serverBinary) {
                console.log(chalk.yellow('⚠️  Llamacpp server not found'));
                console.log(chalk.gray('Install with: brew install llama.cpp'));
                console.log(chalk.gray('Or download from: https://github.com/ggerganov/llama.cpp/releases'));
                return false;
            }

            // Find a model file to use
            const modelFile = await this.findBestModel(modelsDir);
            if (!modelFile) {
                console.log(chalk.yellow('⚠️  No GGUF model files found'));
                console.log(chalk.gray('Install a model first: models install gemma2'));
                return false;
            }

            const port = process.env.LLAMACPP_PORT || '8080';
            const host = process.env.LLAMACPP_HOST || '127.0.0.1';
            
            // GPU layers ladder: start conservative, allow escalation
            const nGpuLayers = process.env.LLAMACPP_GPU_LAYERS || '8';  // Start with 8 layers
            const maxGpuLayers = process.env.LLAMACPP_MAX_GPU_LAYERS || '20';
            const vramBudget = process.env.LLAMACPP_VRAM_BUDGET || '6144';  // 6GB VRAM limit
            
            console.log(chalk.cyan(`🚀 Starting llamacpp server...`));
            console.log(chalk.gray(`📁 Model: ${path.basename(modelFile)}`));
            console.log(chalk.gray(`🌐 Server: http://${host}:${port}`));
            console.log(chalk.gray(`🔧 GPU Layers: ${nGpuLayers} (max: ${maxGpuLayers})`));
            console.log(chalk.gray(`🧠 VRAM Budget: ${vramBudget}MB`));

            const args = [
                '-m', modelFile,
                '--host', host,
                '--port', port,
                '--ctx-size', '4096',
                '--threads', '4',
                '--log-disable',
                '--n-gpu-layers', nGpuLayers,
                '--vram-budget', vramBudget,
                '--no-mmap'  // Reduce memory fragmentation
            ];

            this.llamacppProcess = spawn(serverBinary, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: false
            });

            // Wait for server to be ready
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds timeout
            
            while (attempts < maxAttempts) {
                if (await this.isLlamacppRunning()) {
                    console.log(chalk.green('✅ Llamacpp server is ready'));
                    this.isStarting = false;
                    return true;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }

            console.log(chalk.red('❌ Server failed to start within 30 seconds'));
            this.stopLlamacppServer();
            return false;

        } catch (error) {
            Logger.error('Failed to start llamacpp server:', error.message);
            return false;
        } finally {
            this.isStarting = false;
        }
    }

    /**
     * Find the best model file to use
     */
    async findBestModel(modelsDir) {
        try {
            const files = await fs.readdir(modelsDir);
            const ggufFiles = files.filter(f => f.endsWith('.gguf'));
            
            if (ggufFiles.length === 0) return null;

            // Prefer smaller models for server startup
            const modelPriority = [
                'tinyllama', 'gemma-2-2b', 'phi-3-mini', 'llama-2-7b'
            ];

            for (const preferred of modelPriority) {
                const found = ggufFiles.find(f => f.toLowerCase().includes(preferred));
                if (found) return path.join(modelsDir, found);
            }

            // Return first available GGUF file
            return path.join(modelsDir, ggufFiles[0]);
        } catch (error) {
            return null;
        }
    }

    /**
     * Stop llamacpp server
     */
    stopLlamacppServer() {
        if (this.llamacppProcess) {
            console.log(chalk.yellow('🛑 Stopping llamacpp server...'));
            this.llamacppProcess.kill('SIGTERM');
            this.llamacppProcess = null;
        }
    }

    /**
     * Open server UI in browser
     */
    async openServerUI() {
        const baseUrl = process.env.LLAMACPP_BASE_URL || 'http://127.0.0.1:8080';
        
        if (!(await this.isLlamacppRunning())) {
            console.log(chalk.red('❌ Server is not running'));
            return false;
        }

        const { default: open } = await import('open');
        try {
            await open(baseUrl);
            console.log(chalk.green(`🌐 Opened ${baseUrl} in browser`));
            return true;
        } catch (error) {
            console.log(chalk.yellow(`💡 Open manually: ${baseUrl}`));
            return false;
        }
    }

    /**
     * Get server status
     */
    async getServerStatus() {
        const isRunning = await this.isLlamacppRunning();
        const baseUrl = process.env.LLAMACPP_BASE_URL || 'http://127.0.0.1:8080';
        
        return {
            running: isRunning,
            url: baseUrl,
            managed: !!this.llamacppProcess,
            gpuLayers: process.env.LLAMACPP_GPU_LAYERS || '8'
        };
    }

    /**
     * Restart server with different GPU layer count
     * Provides a ladder system: 0, 8, 12, 16, 20
     */
    async adjustGpuLayers(targetLayers) {
        const validLayers = [0, 8, 12, 16, 20];
        if (!validLayers.includes(parseInt(targetLayers))) {
            console.log(chalk.red(`❌ Invalid GPU layers: ${targetLayers}. Valid options: ${validLayers.join(', ')}`));
            return false;
        }

        console.log(chalk.cyan(`🔄 Adjusting GPU layers to ${targetLayers}...`));
        
        // Stop current server
        if (this.llamacppProcess) {
            this.stopLlamacppServer();
            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Set new GPU layers
        process.env.LLAMACPP_GPU_LAYERS = targetLayers.toString();
        
        // Find models directory (assuming it's accessible)
        const modelsDir = process.env.MODELS_DIR || path.join(process.cwd(), 'models');
        
        // Restart with new settings
        const success = await this.startLlamacppServer(modelsDir);
        if (success) {
            console.log(chalk.green(`✅ Server restarted with ${targetLayers} GPU layers`));
        } else {
            console.log(chalk.red(`❌ Failed to restart server with ${targetLayers} GPU layers`));
        }
        
        return success;
    }

    /**
     * GPU performance ladder recommendations
     */
    getGpuLadder() {
        return {
            0: 'CPU-only (slowest, most stable)',
            8: 'Conservative GPU (balanced, good for 8GB+ VRAM)',
            12: 'Moderate GPU (faster, requires 10GB+ VRAM)', 
            16: 'High GPU (fast, requires 12GB+ VRAM)',
            20: 'Maximum GPU (fastest, requires 16GB+ VRAM)'
        };
    }

    /**
     * Cleanup on exit
     */
    cleanup() {
        this.stopLlamacppServer();
    }
}

const serverManager = new ServerManager();

// Cleanup on process exit
process.on('exit', () => serverManager.cleanup());
process.on('SIGINT', () => {
    serverManager.cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    serverManager.cleanup();
    process.exit(0);
});

module.exports = serverManager;