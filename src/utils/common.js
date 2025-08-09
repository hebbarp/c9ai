const fs = require('fs-extra');
const path = require('path');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function capitalizeWords(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

async function ensureDirectoryExists(dir) {
    await fs.ensureDir(dir);
}

async function writeJsonSafe(filepath, data) {
    await fs.writeJson(filepath, data, { spaces: 2 });
}

module.exports = {
    sleep,
    capitalizeWords,
    ensureDirectoryExists,
    writeJsonSafe
};