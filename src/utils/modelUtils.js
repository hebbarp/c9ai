const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const { sleep } = require('./common');

async function downloadModel(url, modelPath, onProgress) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(modelPath);
        https.get(url, response => {
            const total = parseInt(response.headers['content-length'], 10);
            let current = 0;

            response.on('data', chunk => {
                current += chunk.length;
                onProgress?.(current, total);
            });

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', err => {
            fs.unlink(modelPath);
            reject(err);
        });
    });
}

async function validateModel(modelPath, expectedHash) {
    // Implementation for model validation
}

async function loadModelConfig(configDir, modelName) {
    const configPath = path.join(configDir, 'models', `${modelName}.json`);
    if (await fs.exists(configPath)) {
        return await fs.readJson(configPath);
    }
    return null;
}

module.exports = {
    downloadModel,
    validateModel,
    loadModelConfig
};