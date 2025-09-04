const ora = require('ora');
const chalk = require('chalk');
const Logger = require('../utils/logger');

const doFetch = async (...a) => {
  if (typeof fetch === 'function') return fetch(...a);
  const { default: f } = await import('node-fetch');
  return f(...a);
};

async function getLlamaModelId(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/v1/models`;
  const r = await doFetch(url);
  if (!r.ok) throw new Error(`llama.cpp /v1/models failed: ${r.status} ${r.statusText}`);
  const data = await r.json();
  const id = data?.data?.[0]?.id || data?.data?.[0]?.name;
  if (!id) throw new Error('No models reported by llama.cpp');
  return id;
}

async function askLlama(baseUrl, prompt) {
  const model = await getLlamaModelId(baseUrl);
  const url = `${baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
  const body = {
    model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    stream: false
  };
  const r = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    let text = ''; try { text = await r.text(); } catch {}
    throw new Error(`llama.cpp chat failed: ${r.status} ${r.statusText}${text ? ` — ${text}` : ''}`);
  }
  const data = await r.json();
  const choice = data?.choices?.[0];
  const content = choice?.message?.content || choice?.text;
  if (!content) throw new Error('Empty response from llama.cpp');
  return content.trim();
}

async function handleConversation(c9ai, input) {
  const model = c9ai.currentModel || 'claude'; // respect persisted selection
  const spinner = ora(chalk.yellow(`Thinking with ${model}...`)).start();

  try {
    let response = '';
    if (model === 'local') {
      const baseUrl = c9ai.llamacppBaseUrl || process.env.LLAMACPP_BASE_URL || 'http://127.0.0.1:8080';
      response = await askLlama(baseUrl, input);
    } else {
      // placeholder for cloud providers
      response = `(${model}) ${input}`;
    }

    spinner.succeed(chalk.green('AI response:'));
    console.log(chalk.cyanBright(response));
    return response;
  } catch (error) {
    spinner.fail(chalk.red('Failed to get response.'));
    Logger.error(error.message);
    return null;
  }
}

module.exports = { handleConversation };