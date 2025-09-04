const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

function waitHttp(url, { timeoutMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 400); });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function isHealthy(baseUrl) {
  return waitHttp(`${baseUrl.replace(/\/$/, '')}/v1/models`);
}

async function ensureLocalStack({ baseUrl = process.env.LLAMACPP_BASE_URL || 'http://127.0.0.1:8080', modelPath } = {}) {
  if (await isHealthy(baseUrl)) return { baseUrl, started: false };
  const script = path.join(__dirname, '..', '..', 'scripts', 'start-local-stack.js');
  const env = { ...process.env, LLAMACPP_BASE_URL: baseUrl };
  if (modelPath) env.LLAMACPP_MODEL = modelPath; // <-- pass phi-3 path
  const child = spawn(process.execPath, [script], { stdio: 'inherit', env });
  await new Promise((res) => child.once('spawn', res));
  for (let i = 0; i < 20; i++) {
    if (await isHealthy(baseUrl)) return { baseUrl, started: true };
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('llama.cpp failed to become healthy');
}

module.exports = { isHealthy, ensureLocalStack };