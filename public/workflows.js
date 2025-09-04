// Minimal helpers to run workflows via SSE or chat
async function runWorkflowAnalyze(pathStr) {
  const msg = `@analyze ${pathStr}`;
  return startSSEAgent(msg, 'workflowAnalyzeResult');
}

async function runWorkflowBuild(title, sections, format) {
  const fmt = format || 'markdown';
  const prompt = `Create a ${fmt} document titled "${title}" with the following bullet points. Return the full document in a single code block.\n\n${sections}`;
  return postChat(prompt, 'workflowBuildResult');
}

async function runWorkflowConvert(source, target) {
  // For LaTeX -> PDF use @tex
  if (target.toLowerCase() === 'pdf' && /\.tex$/i.test(source)) {
    const msg = `@tex ${source}`;
    return startSSEAgent(msg, 'workflowConvertResult');
  }
  // Fallback to explanation
  const prompt = `Convert the document ${source} to ${target}. Provide a step-by-step command sequence for macOS/Linux.`;
  return postChat(prompt, 'workflowConvertResult');
}

// --- Custom Workflow Builder (client) ---
let WF_BUILDER = { steps: [] };

function wfAddStep() {
  const type = document.getElementById('wfStepType').value;
  let argsText = document.getElementById('wfStepArgs').value.trim();
  const ifOs = document.getElementById('wfStepOs').value;
  const shellSel = document.getElementById('wfStepShell').value;
  let args = {};
  if (argsText) {
    try { args = JSON.parse(argsText); } catch { alert('Args must be valid JSON'); return; }
  }
  // Attach shell if type is shell.run and a shell is chosen
  if (type === 'shell.run' && shellSel) {
    args.shell = shellSel;
  }
  const step = { type, args };
  if (ifOs && ifOs !== 'any') step.ifOs = ifOs;
  WF_BUILDER.steps.push(step);
  wfRenderSteps();
}

function wfRenderSteps() {
  const el = document.getElementById('wfSteps');
  if (!el) return;
  if (WF_BUILDER.steps.length === 0) { el.innerHTML = '<div style="color:var(--sub);">No steps added</div>'; return; }
  el.innerHTML = WF_BUILDER.steps.map((s,i)=>`
    <div style="border:1px solid var(--border); border-radius:8px; padding:8px; background:var(--panel);">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div><strong>${i+1}. ${s.type}</strong> ${s.ifOs ? `<span style=\"color:var(--sub); font-size:12px;\">[${s.ifOs}]</span>` : ''}</div>
        <div style="display:flex; gap:6px;">
          <button class="btn secondary" style="padding:2px 6px; font-size:11px;" onclick="wfRemoveStep(${i})">Remove</button>
        </div>
      </div>
      <pre style="white-space:pre-wrap; font-size:12px; margin:6px 0 0 0;">${JSON.stringify(s.args||{}, null, 2)}</pre>
    </div>
  `).join('');
}

function wfRemoveStep(idx) {
  WF_BUILDER.steps.splice(idx,1);
  wfRenderSteps();
}

async function wfRun(dry=false) {
  const name = document.getElementById('wfName').value || 'Workflow';
  const out = document.getElementById('wfRunOut');
  out.textContent = 'Running…';
  try {
    const r = await fetch('/api/workflows/custom/execute', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ steps: WF_BUILDER.steps, dryRun: dry }) });
    const j = await r.json();
    if (!r.ok || j.success === false) throw new Error(j.error || 'Failed');
    out.textContent = JSON.stringify(j, null, 2);
  } catch (e) { out.textContent = 'Error: ' + e.message; }
}

async function wfSave() {
  const name = document.getElementById('wfName').value.trim();
  if (!name) return alert('Please provide a name');
  try {
    const r = await fetch('/api/workflows/custom/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, steps: WF_BUILDER.steps }) });
    const j = await r.json();
    if (!r.ok || j.success === false) throw new Error(j.error || 'Save failed');
    alert('Saved');
    wfLoadSaved();
  } catch (e) { alert('Error: ' + e.message); }
}

async function wfLoadSaved() {
  try {
    const r = await fetch('/api/workflows/custom/list');
    const j = await r.json();
    const cont = document.getElementById('wfSaved');
    if (!r.ok || j.success === false) { cont.textContent = 'Failed to load'; return; }
    const items = j.items || [];
    if (!items.length) { cont.innerHTML = '<div style="color:var(--sub);">No saved workflows</div>'; return; }
    cont.innerHTML = items.map((it,idx)=>`
      <div style="border:1px solid var(--border); border-radius:8px; padding:10px; background:var(--panel);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div><strong>${it.name}</strong> <span style="color:var(--sub);">(${it.steps.length} steps)</span></div>
          <div style="display:flex; gap:6px;">
            <button class="btn secondary" style="padding:2px 6px; font-size:11px;" onclick="wfLoadFromSaved(${idx})">Load</button>
            <button class="btn" style="padding:2px 6px; font-size:11px;" onclick="wfRunSaved(${idx})">Run</button>
            <button class="btn secondary" style="padding:2px 6px; font-size:11px;" onclick="wfDelete('${it.id}')">Delete</button>
          </div>
        </div>
      </div>
    `).join('');
    window.__WF_SAVED = items;
  } catch (e) {
    const cont = document.getElementById('wfSaved');
    cont.textContent = 'Error loading saved workflows';
  }
}

async function wfRunSaved(idx) {
  const it = (window.__WF_SAVED || [])[idx]; if (!it) return;
  WF_BUILDER.steps = it.steps || [];
  document.getElementById('wfName').value = it.name || '';
  wfRenderSteps();
  wfRun(false);
}

function wfLoadFromSaved(idx) {
  const it = (window.__WF_SAVED || [])[idx]; if (!it) return;
  WF_BUILDER.steps = it.steps || [];
  document.getElementById('wfName').value = it.name || '';
  wfRenderSteps();
}

async function wfDelete(id) {
  if (!confirm('Delete this workflow?')) return;
  try { await fetch('/api/workflows/custom/' + encodeURIComponent(id), { method:'DELETE' }); wfLoadSaved(); } catch {}
}

function startSSEAgent(message, outputId) {
  const api = 'http://127.0.0.1:8787';
  const allow = encodeURIComponent(JSON.stringify(["shell.run","script.run","fs.read","fs.write","web.search","jit","tex.compile"]));
  const url = `${api}/api/agent?prompt=${encodeURIComponent(message)}&allow=${allow}`;
  const es = new EventSource(url);
  const el = document.getElementById(outputId);
  el.innerHTML = '';
  const append = (text) => { el.innerHTML += `<div style=\"margin:6px 0;\">${renderMarkdown(text)}</div>`; el.scrollTop = el.scrollHeight; };
  es.addEventListener('status', (ev) => append(`_${ev.data}_`));
  es.addEventListener('final', (ev) => {
    try { const j = JSON.parse(ev.data); append(j.text || '(no text)'); } catch { append(ev.data); }
    es.close();
  });
  es.addEventListener('error', (_ev) => { append('Error'); es.close(); });
}

async function postChat(prompt, outputId) {
  const el = document.getElementById(outputId);
  el.innerHTML = 'Working…';
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ provider: currentProvider, messages: [{ role: 'user', content: prompt }], max_tokens: 1024 }) });
  const j = await r.json();
  if (!r.ok || j.error) { el.textContent = 'Error: ' + (j.error || 'Chat failed'); return; }
  el.innerHTML = renderMarkdown(j.text || '');
}
