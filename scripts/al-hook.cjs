#!/usr/bin/env node
'use strict';
// Hook script for the AL agent team. Usage: al-hook.cjs <guard|stop> <profile>
// guard = PreToolUse (deny/ask), stop = Stop/SubagentStop (artifact check, blocks at most once).
// Any internal error fails open (exit 0) so a script bug never blocks the agents.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const [kind, profile] = process.argv.slice(2);
const LOG = path.join(os.tmpdir(), 'al-agent-team-hooks.log');

function log(msg) {
  try {
    fs.appendFileSync(LOG, `${new Date().toISOString()} [${kind}:${profile}] ${msg}\n`);
  } catch { /* logging is best effort */ }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => (raw += c));
process.stdin.on('end', () => {
  try {
    const ev = JSON.parse(raw || '{}');
    if (process.env.AL_HOOK_DEBUG) log(`event=${ev.hook_event_name} tool=${ev.tool_name} input=${JSON.stringify(ev.tool_input || {}).slice(0, 300)}`);
    if (kind === 'guard') guard(ev);
    else if (kind === 'stop') stop(ev);
  } catch (e) {
    log(`error ${e && e.stack}`);
  }
  process.exit(0);
});

// ---------- guard (PreToolUse) ----------

const EDIT_TOOL = /create_file|replace_string|multi_replace|insert_edit|apply_patch|applyPatch|edit_file|edit_notebook|write_file|create_directory|editFiles|createFile/i;
const GIT_WRITE = /\bgit\b(?:\s+-C\s+\S+)?\s+(commit|push|add|rm|mv|reset|checkout|switch|stash|merge|rebase|cherry-pick|revert|tag|restore|clean|worktree|branch\s+-[dDmM])\b/;

function decide(decision, reason) {
  log(`${decision}: ${reason}`);
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
      additionalContext: reason,
    },
  });
}

function commandOf(ev) {
  const ti = ev.tool_input || {};
  return typeof ti.command === 'string' ? ti.command : '';
}

function editedPaths(ev) {
  const ti = ev.tool_input || {};
  const out = [];
  for (const k of ['filePath', 'file_path', 'path', 'uri']) if (typeof ti[k] === 'string') out.push(ti[k]);
  if (Array.isArray(ti.files)) for (const f of ti.files) out.push(typeof f === 'string' ? f : f && (f.filePath || f.path));
  if (Array.isArray(ti.replacements)) for (const r of ti.replacements) if (r && r.filePath) out.push(r.filePath);
  for (const k of ['input', 'patch']) {
    if (typeof ti[k] === 'string') for (const m of ti[k].matchAll(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm)) out.push(m[1].trim());
  }
  return out.filter(Boolean).map(p => String(p).replace(/\\/g, '/'));
}

function guard(ev) {
  const name = String(ev.tool_name || '');
  const cmd = commandOf(ev);
  const paths = EDIT_TOOL.test(name) ? editedPaths(ev) : [];
  const rules = PROFILES[profile];
  if (!rules) return;
  for (const rule of rules) {
    const r = rule({ name, cmd, paths, ev });
    if (r) return decide(r[0], r[1]);
  }
}

const gitWrite = ({ cmd }) =>
  GIT_WRITE.test(cmd) ? ['deny', 'This agent must not change git state. Hand git operations to the AL Delivery agent.'] : null;

const noAlEdits = ({ paths }) =>
  paths.some(p => /\.al$/i.test(p)) ? ['deny', 'This agent must not edit .al files.'] : null;

const onlyFiles = (pattern, label) => ({ paths }) => {
  const bad = paths.filter(p => !pattern.test(p));
  return bad.length ? ['deny', `This agent may only edit ${label}. Blocked: ${bad.join(', ')}`] : null;
};

const PROFILES = {
  delivery: [
    ({ cmd }) => {
      if (/--no-verify/.test(cmd) && /\bgit\b/.test(cmd)) return ['deny', 'Never bypass git hooks (--no-verify).'];
      if (/\bgit\b[^\n;|&]*\bpush\b/.test(cmd)) {
        if (/--force|--force-with-lease|(^|\s)-f(\s|$)|--delete/.test(cmd)) return ['deny', 'Force-push or remote branch deletion is not allowed.'];
        return ['ask', 'Push is only allowed in deliver mode after the user\'s explicit go-ahead for the push and PR. Confirm that you approved it.'];
      }
      return null;
    },
    ({ cmd }) =>
      /(^|[\s;|&(])az\s+(repos|devops|pipelines|boards|login|account)\b/.test(cmd)
        ? ['deny', 'Use the azure-devops MCP tools for Azure DevOps, never the az CLI.'] : null,
    ({ cmd }) =>
      /\bgit\s+add\b[^\n;|&]*\.app\b/.test(cmd) ? ['deny', 'Never stage build output (*.app).'] : null,
    ({ cmd }) =>
      /\bgit\s+add\b\s+(-A|--all|\.)(\s|$|[;|&])/.test(cmd)
        ? ['ask', 'Blanket staging may include unrelated WIP of the user. Stage only the files of this phase.'] : null,
    ({ cmd }) =>
      /\bgit\s+(reset\s+--hard|clean\s+-\w*f|checkout\s+--\s+\.)/.test(cmd)
        ? ['ask', 'Destructive git command: this can discard uncommitted work.'] : null,
    noAlEdits,
  ],
  orchestrator: [
    gitWrite,
    onlyFiles(/(^|\/)00-overview\.md$|\/docs\/features(\/[^/]*)?$/i, '00-overview.md and the dossier folder'),
  ],
  reviewer: [
    ({ name }) =>
      /fix_al_(file|workspace)/.test(name) ? ['deny', 'Review only: fix_al_file/fix_al_workspace change code.'] : null,
    gitWrite,
    onlyFiles(/(^|\/)06-quality-review\.md$/i, '06-quality-review.md'),
  ],
  provisioner: [
    gitWrite,
    ({ cmd }) =>
      /\bdocker\s+(run|compose)\b/.test(cmd) ? ['deny', 'No local Docker fallback; use the COSMO Alpaca container tools.'] : null,
    onlyFiles(/(^|\/)launch\.json$/i, 'launch.json'),
  ],
};

// ---------- stop / subagent stop ----------

function newestDossier(startDirs) {
  const seen = new Set();
  const candidates = [];
  const probe = dir => {
    const features = path.join(dir, 'docs', 'features');
    let entries;
    try { entries = fs.readdirSync(features, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const f = path.join(features, e.name, '00-overview.md');
      try { candidates.push({ dir: path.join(features, e.name), mtime: fs.statSync(f).mtimeMs }); } catch { /* no overview */ }
    }
  };
  for (const start of startDirs.filter(Boolean)) {
    let d = path.resolve(start);
    for (let i = 0; i < 4; i++) {
      if (!seen.has(d)) { seen.add(d); probe(d); }
      const parent = path.dirname(d);
      if (parent === d) break;
      d = parent;
    }
    try {
      for (const e of fs.readdirSync(start, { withFileTypes: true })) if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') probe(path.join(start, e.name));
    } catch { /* unreadable */ }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  const best = candidates[0];
  return best && Date.now() - best.mtime < 24 * 3600 * 1000 ? best.dir : null;
}

function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function artifact(dir, file, { min = 100, headings = [] } = {}) {
  const text = readText(path.join(dir, file));
  if (text === null) return [`${file} does not exist in ${dir}. Write it before finishing.`];
  const problems = [];
  if (text.length < min) problems.push(`${file} is almost empty.`);
  for (const h of headings) if (!text.includes(h)) problems.push(`${file} lacks the section "${h}".`);
  return problems;
}

function trivialAsserts(cwd) {
  const out = [];
  let root;
  try {
    root = cp.execFileSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const status = cp.execFileSync('git', ['-C', root, 'status', '--porcelain', '-uall'], { encoding: 'utf8' });
    for (const line of status.split('\n')) {
      const file = line.slice(3).trim();
      if (!/\.al$/i.test(file)) continue;
      const text = readText(path.join(root, file));
      if (text && /Assert\.(IsTrue\(\s*true\b|IsFalse\(\s*false\b)/i.test(text)) out.push(file);
    }
  } catch { /* not a git repo */ }
  return out;
}

function greenEvidence(dir) {
  const text = readText(path.join(dir, '04-implementation-log.md'));
  if (!text) return [];
  const section = text.split(/^## /m).find(s => /^GREEN\b/.test(s));
  const body = (section || '').replace(/^GREEN[^\n]*\n?/, '').replace(/<[^>]*>/g, '').trim();
  if (body.length < 40) return [];
  const evidence = /\b(pass(ed)?|bestanden|success|user|manual|manuell|AL Test Tool)\b|\b\d+\s*(\/|of|von)\s*\d+\b|0 (errors?|warnings?|fehler|warnungen)/i;
  return evidence.test(body) ? [] : ['The GREEN section of 04-implementation-log.md has no evidence (al_build summary and per-method test counts or an explicit "user runs the tests" note).'];
}

const STOP_CHECKS = {
  requirements: dir => artifact(dir, '01-requirements.md', { min: 300 }),
  architect: dir => artifact(dir, '02-design.md', { min: 300, headings: ['## Object inventory'] }),
  planner: dir => artifact(dir, '03-test-plan.md', { min: 300, headings: ['## Scenarios', '## Coverage matrix'] }),
  implementer: (dir, cwd) => {
    const problems = [...artifact(dir, '04-implementation-log.md', { min: 100 }), ...greenEvidence(dir)];
    const bad = trivialAsserts(cwd);
    if (bad.length) problems.push(`Trivial always-true assertions found in: ${bad.join(', ')}. Replace them with real assertions.`);
    return problems;
  },
  docs: dir => artifact(dir, '05-user-documentation.md', { min: 300 }),
  reviewer: dir => artifact(dir, '06-quality-review.md', { min: 200, headings: ['## Outcome'] }),
};

function stop(ev) {
  if (ev.stop_hook_active) return;
  const check = STOP_CHECKS[profile];
  if (!check) return;
  const cwd = ev.cwd || process.cwd();
  const dir = newestDossier([cwd, process.cwd()]);
  if (!dir) return;
  const problems = check(dir, cwd);
  if (!problems.length) return;
  const reason = `Before finishing: ${problems.join(' ')}`;
  log(`block: ${reason}`);
  emit({
    decision: 'block',
    reason,
    hookSpecificOutput: { hookEventName: ev.hook_event_name || 'Stop', decision: 'block', reason },
  });
}
