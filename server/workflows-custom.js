"use strict";
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { runTool } = require("../src/tools/runner");

const router = express.Router();
const WF_DIR = path.join(os.homedir(), ".c9ai", "workflows");

function ensureDir() { try { fs.mkdirSync(WF_DIR, { recursive: true }); } catch {} }
function slugify(name) { return String(name||"workflow").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

function resolveRefs(obj, prev) {
  try {
    if (obj == null) return obj;
    const s = JSON.stringify(obj);
    const out = s
      .replace(/"\$prev"/g, () => JSON.stringify(prev))
      .replace(/\"\$prev\.stdout\"/g, () => JSON.stringify(prev?.stdout ?? ""))
      .replace(/\"\$prev\.result\"/g, () => JSON.stringify(prev?.result ?? prev ?? ""));
    return JSON.parse(out);
  } catch { return obj; }
}

router.post("/api/workflows/custom/execute", express.json(), async (req, res) => {
  try {
    const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
    const dryRun = !!req.body?.dryRun;
    if (steps.length === 0) return res.status(400).json({ success: false, error: "No steps provided" });

    const logs = [];
    let prev = null;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const type = String(step?.type || '').trim();
      if (!type) return res.status(400).json({ success: false, error: `Step ${i+1}: missing type` });
      // OS condition
      if (step && step.ifOs) {
        const allowed = Array.isArray(step.ifOs) ? step.ifOs : String(step.ifOs).split(',').map(s=>s.trim()).filter(Boolean);
        if (allowed.length && !allowed.includes(process.platform)) {
          logs.push({ step: i+1, type, status: 'skipped-os', ifOs: allowed });
          continue;
        }
      }
      const args = resolveRefs(step?.args || {}, prev);
      logs.push({ step: i+1, type, args, status: dryRun ? 'dry-run' : 'running' });
      if (dryRun) continue;
      try {
        const result = await runTool(type, args);
        prev = result;
        logs[logs.length-1].status = 'ok';
        logs[logs.length-1].result = result;
      } catch (e) {
        logs[logs.length-1].status = 'error';
        logs[logs.length-1].error = e.message;
        return res.status(500).json({ success: false, error: `Step ${i+1} failed: ${e.message}`, logs });
      }
    }
    return res.json({ success: true, logs, final: prev });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

router.post("/api/workflows/custom/save", express.json(), async (req, res) => {
  try {
    const wf = req.body || {};
    if (!wf.name || !Array.isArray(wf.steps)) return res.status(400).json({ success: false, error: "name and steps required" });
    ensureDir();
    let id = wf.id && String(wf.id).trim() || slugify(wf.name);
    let file = path.join(WF_DIR, id + ".json");
    let n=2; while (fs.existsSync(file)) { id = slugify(wf.name) + '-' + n++; file = path.join(WF_DIR, id + ".json"); }
    wf.id = id; wf.createdAt = wf.createdAt || new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(wf, null, 2), 'utf8');
    return res.json({ success: true, id, file });
  } catch (e) { return res.status(500).json({ success: false, error: e.message }); }
});

router.get("/api/workflows/custom/list", async (_req, res) => {
  try { ensureDir(); const items=[]; for (const f of fs.readdirSync(WF_DIR)) { if (!f.endsWith('.json')) continue; const p=path.join(WF_DIR,f); try { const j=JSON.parse(fs.readFileSync(p,'utf8')); items.push({ id:j.id||f.replace(/\.json$/,''), name:j.name||j.id, steps: j.steps||[], createdAt:j.createdAt }); } catch{} } items.sort((a,b)=>String(a.name).localeCompare(String(b.name))); return res.json({ success:true, items }); } catch(e){ return res.status(500).json({ success:false, error:e.message }); }
});

router.put("/api/workflows/custom/:id", express.json(), async (req, res) => {
  try { ensureDir(); const id=String(req.params.id); const file=path.join(WF_DIR,id+".json"); if(!fs.existsSync(file)) return res.status(404).json({success:false,error:'Not found'}); const cur=JSON.parse(fs.readFileSync(file,'utf8')); const next={...cur}; if (typeof req.body?.name==='string' && req.body.name.trim()) next.name=req.body.name.trim(); if (Array.isArray(req.body?.steps)) next.steps=req.body.steps; next.updatedAt=new Date().toISOString(); fs.writeFileSync(file, JSON.stringify(next,null,2),'utf8'); return res.json({success:true,id}); } catch(e){ return res.status(500).json({success:false,error:e.message}); }
});

router.delete("/api/workflows/custom/:id", async (req, res) => {
  try { ensureDir(); const id=String(req.params.id); const file=path.join(WF_DIR,id+".json"); if(!fs.existsSync(file)) return res.status(404).json({success:false,error:'Not found'}); fs.unlinkSync(file); return res.json({success:true,id}); } catch(e){ return res.status(500).json({success:false,error:e.message}); }
});

module.exports = { workflowsCustomRouter: router };
