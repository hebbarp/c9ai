/**
 * Self-contained HTML cheat-sheet for c9ai, opened via `help html`.
 *
 * The in-TUI `help` is a dense man-page wall — great as a reference, poor for
 * getting oriented. This page is the opposite: task-first, scannable, grouped
 * by "what am I trying to do" rather than by command name. It is a single file
 * with inline CSS (no assets, no network) so it opens anywhere, offline.
 *
 * Keep this in sync with the command surface when it changes materially.
 */

interface Cmd {
  cmd: string;
  desc: string;
}
interface Section {
  id: string;
  title: string;
  blurb?: string;
  rows: Cmd[];
}

// The five questions users actually ask first, answered at the top of the page.
const QUICK: Array<{ q: string; a: string; cmd: string }> = [
  {
    q: 'Start a conversation',
    a: 'Type a message and press Enter — it goes to your default model. If the default is a local model you have not installed, switch first.',
    cmd: 'switch claude\nhello, who are you?',
  },
  {
    q: 'Reach settings',
    a: 'See what is configured, save a key, or re-run the guided first-run wizard.',
    cmd: 'config\nsetup',
  },
  {
    q: 'Connect to the Lab GPU',
    a: 'The Lab is your self-hosted GPU node. It reuses your Matsya key — no separate credential.',
    cmd: 'switch lab\nswitch lab list',
  },
  {
    q: 'Check your todos',
    a: 'Backed by GitHub Issues (needs the gh CLI signed in).',
    cmd: 'todos list\ntodos add ship the lab docs',
  },
  {
    q: 'Have the agent write a program',
    a: 'Give it a goal. It loops autonomously — writing files, running shell, searching the web — until the goal is done.',
    cmd: 'agent write a python script that prints the weather for Bangalore',
  },
];

const SECTIONS: Section[] = [
  {
    id: 'talk',
    title: 'Talk to a model',
    blurb: 'Anything that is not a command or a sigil is chat with your default model.',
    rows: [
      { cmd: '<message>', desc: 'chat with the current default model' },
      { cmd: 'claude <message>', desc: 'one-shot to a specific provider (also gemini, ollama, lab, …)' },
      { cmd: '@claude <message>', desc: 'sigil form of the same thing' },
      { cmd: 'soul <message>', desc: 'reflective "self-inquiry" posture over any backing model' },
      { cmd: 'clear', desc: 'wipe in-memory history, start a fresh session' },
      { cmd: 'resume', desc: 'reopen a prior conversation (resume list to choose)' },
      { cmd: 'save', desc: 'export the visible transcript to markdown' },
    ],
  },
  {
    id: 'providers',
    title: 'Providers — local · lab · cloud',
    blurb: 'Switch the default model. Your choice persists in ~/.c9ai/config.json.',
    rows: [
      { cmd: 'switch ollama <name>', desc: 'LOCAL — a model on your machine (switch ollama list to see them)' },
      { cmd: 'switch lab', desc: 'LAB — your office GPU node, gated by the Matsya key' },
      { cmd: 'switch lab list', desc: 'list models the Lab node serves' },
      { cmd: 'switch claude', desc: 'CLOUD — Anthropic (also gemini, openai, gpt, kimi, deepseek, openrouter)' },
      { cmd: 'switch', desc: 'no args: show the current default + ollama settings' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings & keys',
    blurb: 'Keys live in ~/.c9ai/.env; preferences in ~/.c9ai/config.json.',
    rows: [
      { cmd: 'config', desc: 'show current config: which keys are set, default model' },
      { cmd: 'config claude <api-key>', desc: 'save a provider key (openai, kimi, deepseek, openrouter, lab too)' },
      { cmd: 'config lab <key>', desc: 'save the Matsya key that authenticates the Lab GPU' },
      { cmd: 'config <provider> model <m>', desc: 'pin a model; config <provider> base <url> for a custom endpoint' },
      { cmd: 'setup', desc: 're-run the guided first-run wizard (Matsya → Claude → extras)' },
    ],
  },
  {
    id: 'agent',
    title: 'Coding agent',
    blurb: 'Turn a goal into action. The agent uses tools until the goal is met, with safety confirms on risky shell commands.',
    rows: [
      { cmd: 'agent <goal>', desc: 'run one autonomous goal to completion' },
      { cmd: 'agent', desc: 'toggle persistent agent mode — every message becomes a goal' },
      { cmd: 'claude agent <goal>', desc: 'force a specific provider to drive the loop' },
      { cmd: 'research <topic>', desc: 'bounded autoresearch → a cited memo in outputs/' },
      { cmd: 'Esc', desc: 'cancel a running agent or chat' },
    ],
  },
  {
    id: 'todos',
    title: 'Todos',
    blurb: 'A lightweight backlog backed by GitHub Issues. Needs the gh CLI signed in.',
    rows: [
      { cmd: 'todos list', desc: 'show the open backlog' },
      { cmd: 'todos add <text>', desc: 'add an item' },
    ],
  },
  {
    id: 'tools',
    title: 'Tools, web & shell',
    blurb: 'Call a tool directly with @, or run a shell command with !.',
    rows: [
      { cmd: '@web.search <query>', desc: 'search the web for up-to-date info' },
      { cmd: '@fs.read <path>', desc: 'read a file (also @fs.write, @fs.list, @fs.glob, @fs.grep)' },
      { cmd: '!<command>', desc: 'run a shell command (cd is handled); the agent uses this too' },
      { cmd: 'tools', desc: 'list every provider, tool, and alias available' },
    ],
  },
  {
    id: 'foundry',
    title: 'Small Language Foundry',
    blurb: 'Build, train, and evaluate your own tiny local models. Full guide: docs/create-your-models.md.',
    rows: [
      { cmd: 'models list', desc: 'show model projects (models samples for bundled starters)' },
      { cmd: 'models init <sample>', desc: 'scaffold a project; then corpus/pairs/build/eval/review' },
      { cmd: 'pampa status', desc: 'the local Pampa tiny-LM baseline' },
    ],
  },
];

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function quickCard(item: { q: string; a: string; cmd: string }, i: number): string {
  const lines = item.cmd.split('\n').map(l => `<span class="ln">${esc(l)}</span>`).join('');
  return `<article class="q">
    <div class="qn">${i + 1}</div>
    <div class="qbody">
      <h3>${esc(item.q)}</h3>
      <p>${esc(item.a)}</p>
      <pre class="code">${lines}</pre>
    </div>
  </article>`;
}

function sectionCard(s: Section): string {
  const rows = s.rows
    .map(
      r => `<tr><td class="c"><code>${esc(r.cmd)}</code></td><td class="d">${esc(r.desc)}</td></tr>`
    )
    .join('');
  return `<section class="card" id="${s.id}">
    <h2>${esc(s.title)}</h2>
    ${s.blurb ? `<p class="blurb">${esc(s.blurb)}</p>` : ''}
    <table>${rows}</table>
  </section>`;
}

export function buildHelpHtml(version: string): string {
  const nav = SECTIONS.map(s => `<a href="#${s.id}">${esc(s.title)}</a>`).join('');
  const quick = QUICK.map(quickCard).join('');
  const cards = SECTIONS.map(sectionCard).join('');
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>c9ai — help</title>
<style>
:root{--bg:#0b0e11;--panel:#12171c;--panel2:#0f1418;--ink:#eef4f7;--mut:#8b98a2;
  --acc:#35a3d6;--acc2:#7bd88f;--line:#1e2730;--code:#0a0f13}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:0 20px 80px}
header{padding:40px 0 8px}
.logo{font-weight:800;font-size:40px;letter-spacing:1px;color:var(--acc)}
.logo span{color:var(--ink)}
.tag{color:var(--mut);margin-top:2px}
.ver{color:var(--mut);font-size:12px;margin-top:6px}
nav{position:sticky;top:0;background:rgba(11,14,17,.9);backdrop-filter:blur(6px);
  border-bottom:1px solid var(--line);padding:10px 0;margin:18px 0 26px;z-index:5;
  display:flex;flex-wrap:wrap;gap:6px}
nav a{color:var(--mut);text-decoration:none;font-size:13px;padding:4px 10px;border-radius:7px}
nav a:hover{color:var(--ink);background:var(--panel)}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:var(--acc);margin:0 0 4px}
.quick{margin:0 0 34px}
.quick h1{font-size:13px;text-transform:uppercase;letter-spacing:.14em;color:var(--mut);margin:0 0 14px;font-weight:600}
.q{display:flex;gap:14px;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;padding:16px 18px;margin:0 0 12px}
.qn{flex:0 0 30px;height:30px;border-radius:50%;background:var(--acc);color:#04121a;
  font-weight:800;display:flex;align-items:center;justify-content:center}
.qbody{flex:1;min-width:0}
.qbody h3{margin:2px 0 4px;font-size:17px}
.qbody p{margin:0 0 10px;color:var(--mut)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
.blurb{color:var(--mut);margin:0 0 12px;font-size:13.5px}
table{width:100%;border-collapse:collapse}
td{padding:7px 0;vertical-align:top;border-top:1px solid var(--line)}
tr:first-child td{border-top:0}
td.c{white-space:nowrap;padding-right:16px}
td.d{color:var(--mut);font-size:13.5px}
code,.code{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
td.c code{color:var(--acc2);font-size:13px;background:var(--code);border:1px solid var(--line);
  border-radius:6px;padding:2px 7px;display:inline-block}
pre.code{background:var(--code);border:1px solid var(--line);border-radius:9px;
  padding:10px 12px;margin:0;font-size:13px;color:var(--acc2);overflow:auto}
pre.code .ln{display:block;white-space:pre-wrap}
pre.code .ln:before{content:"› ";color:var(--acc)}
footer{color:var(--mut);font-size:12.5px;margin-top:34px;border-top:1px solid var(--line);padding-top:16px}
footer code{color:var(--ink)}
@media(max-width:720px){.grid{grid-template-columns:1fr}}
</style></head>
<body><div class="wrap">
<header>
  <div class="logo">c9<span>ai</span></div>
  <div class="tag">local-first AI — chat, autonomous coding agent, your own tiny models</div>
  <div class="ver">v${esc(version)} · in the TUI type <code>help</code> for the full reference · <code>help html</code> reopens this page</div>
</header>
<nav>${nav}</nav>

<div class="quick">
  <h1>Five things you probably came here to do</h1>
  ${quick}
</div>

<div class="grid">${cards}</div>

<footer>
  Tips: press <code>Esc</code> to cancel a run, <code>↑/↓</code> to reuse past prompts, <code>Ctrl+C</code> to quit.
  Config lives in <code>~/.c9ai/</code> (keys in <code>.env</code>, preferences in <code>config.json</code>).
  This page was generated by <code>help html</code> and works fully offline.
</footer>
</div></body></html>`;
}
