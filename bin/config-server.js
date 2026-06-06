// UClaW Config Server — Gateway lifecycle + Provider DB + Config management
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = process.env.UCRAW_ROOT || path.resolve(__dirname, '..');
const DATA_DIR = process.env.OPENCLAW_STATE_DIR || path.join(ROOT, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'openclaw.json');
const PROVIDERS_DB = path.join(DATA_DIR, 'providers.json');
const PORT = parseInt(process.env.UCLAW_CONFIG_PORT || '18790', 10);
const GATEWAY_PORT = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10);
const NODE_EXE = path.join(ROOT, 'bin', 'node', 'node.exe');
const OPENCLAW_ENTRY = path.join(ROOT, 'bin', 'openclaw', 'node_modules', 'openclaw', 'dist', 'index.js');

const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
const maskKey = k => (!k || k.length < 10) ? '***' : k.slice(0, 6) + '...' + k.slice(-4);
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function json(res, data, status = 200) {
  cors(res); res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
function err(res, msg, status = 400) { json(res, { error: msg }, status); }
async function body(req) {
  return new Promise(resolve => {
    let d = ''; req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
  });
}

// ── Gateway Process Manager ──
let gatewayProc = null;
let gatewayStatus = 'stopped'; // stopped | starting | running | error
let gatewayStartedAt = null;
let gatewayLogs = [];

function startGateway() {
  if (gatewayProc && !gatewayProc.killed) return { ok: false, error: 'Gateway already running' };
  if (!fs.existsSync(NODE_EXE)) return { ok: false, error: 'Node.js not found: ' + NODE_EXE };
  if (!fs.existsSync(OPENCLAW_ENTRY)) return { ok: false, error: 'OpenClaw not found: ' + OPENCLAW_ENTRY };

  gatewayStatus = 'starting';
  gatewayLogs = [];
  const env = { ...process.env, OPENCLAW_STATE_DIR: DATA_DIR, HOME: DATA_DIR, TMPDIR: path.join(DATA_DIR, 'tmp') };
  const tmpDir = path.join(DATA_DIR, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  try {
    gatewayProc = spawn(NODE_EXE, [OPENCLAW_ENTRY, 'gateway', '--port', String(GATEWAY_PORT)], {
      env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
    });
  } catch (e) {
    gatewayStatus = 'error';
    return { ok: false, error: e.message };
  }

  gatewayProc.stdout.on('data', d => {
    const lines = d.toString().split('\n').filter(l => l.trim());
    gatewayLogs.push(...lines.slice(-50));
    if (gatewayLogs.length > 100) gatewayLogs = gatewayLogs.slice(-100);
    if (gatewayStatus === 'starting' && lines.some(l => l.includes('ready') || l.includes('listening'))) {
      gatewayStatus = 'running';
      gatewayStartedAt = new Date();
      log('Gateway started on port ' + GATEWAY_PORT);
    }
  });
  gatewayProc.stderr.on('data', d => {
    const lines = d.toString().split('\n').filter(l => l.trim());
    gatewayLogs.push(...lines.slice(-50));
    if (gatewayLogs.length > 100) gatewayLogs = gatewayLogs.slice(-100);
  });
  gatewayProc.on('exit', (code) => {
    gatewayStatus = 'stopped';
    gatewayProc = null;
    gatewayStartedAt = null;
    log('Gateway exited with code ' + code);
  });
  gatewayProc.on('error', (e) => {
    gatewayStatus = 'error';
    log('Gateway error: ' + e.message);
  });

  // Mark as running after 8s if not already
  setTimeout(() => {
    if (gatewayStatus === 'starting') {
      gatewayStatus = 'running';
      gatewayStartedAt = new Date();
    }
  }, 8000);

  return { ok: true, status: 'starting' };
}

function stopGateway() {
  if (!gatewayProc) {
    gatewayStatus = 'stopped';
    return { ok: true, status: 'stopped' };
  }
  const pid = gatewayProc.pid;
  try {
    // On Windows, use taskkill to kill the entire process tree
    if (process.platform === 'win32' && pid) {
      const { execSync } = require('child_process');
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch {}
    } else {
      gatewayProc.kill('SIGTERM');
      setTimeout(() => { try { gatewayProc?.kill('SIGKILL'); } catch {} }, 3000);
    }
    gatewayProc = null;
    gatewayStatus = 'stopped';
    gatewayStartedAt = null;
    return { ok: true, status: 'stopped' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function restartGateway() {
  log('Restarting gateway...');
  backupConfig('pre-restart');
  stopGateway();
  // Wait for port to be released
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const r = await fetch(`http://localhost:${GATEWAY_PORT}/health`);
      if (!r.ok) break;
    } catch { break; } // Connection refused = port free
  }
  await new Promise(r => setTimeout(r, 500));
  return startGateway();
}

function getGatewayInfo() {
  return {
    status: gatewayStatus,
    port: GATEWAY_PORT,
    pid: gatewayProc?.pid || null,
    uptime: gatewayStartedAt ? Math.floor((Date.now() - gatewayStartedAt.getTime()) / 1000) : 0,
    logs: gatewayLogs.slice(-20)
  };
}

// ── Provider DB ──
function getProviderDB() { return readJSON(PROVIDERS_DB) || []; }
function writeProviderDB(db) { writeJSON(PROVIDERS_DB, db); }

function switchProvider(providerId, modelId) {
  const db = getProviderDB();
  const target = db.find(p => p.id === providerId);
  if (!target) throw new Error(`Provider "${providerId}" not found`);

  db.forEach(p => p.isCurrent = (p.id === providerId));
  if (modelId) target.selectedModel = modelId;
  writeProviderDB(db);

  const selectedModel = modelId || target.selectedModel || target.models?.[0]?.id || 'default';
  const fullId = `${target.id}/${selectedModel}`;

  const cfg = readJSON(CONFIG_PATH);
  if (!cfg) throw new Error('Config not found');
  if (!cfg.models) cfg.models = { mode: 'merge', providers: {} };
  if (!cfg.models.providers) cfg.models.providers = {};

  const providerCfg = {
    baseUrl: target.baseUrl, api: target.api,
    models: target.models.map(m => ({ id: m.id, name: m.name }))
  };
  if (target.apiKey) providerCfg.apiKey = target.apiKey;
  if (target.auth) providerCfg.auth = target.auth;
  cfg.models.providers[providerId] = providerCfg;

  if (!cfg.agents) cfg.agents = { defaults: {} };
  if (!cfg.agents.defaults) cfg.agents.defaults = {};
  if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};
  cfg.agents.defaults.model.primary = fullId;
  writeJSON(CONFIG_PATH, cfg);

  if (target.apiKey) {
    const agentsDir = path.join(DATA_DIR, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const agentId of fs.readdirSync(agentsDir)) {
        const mp = path.join(agentsDir, agentId, 'agent', 'models.json');
        if (!fs.existsSync(mp)) continue;
        const mc = readJSON(mp);
        if (!mc?.providers) continue;
        mc.providers[providerId] = { ...providerCfg };
        writeJSON(mp, mc);
      }
    }
  }
  return { ok: true, provider: providerId, model: fullId };
}

async function testProvider(providerId) {
  const db = getProviderDB();
  const p = db.find(x => x.id === providerId);
  if (!p) throw new Error(`Provider "${providerId}" not found`);
  if (!p.apiKey) return { ok: false, error: 'API Key 未配置', latencyMs: 0 };

  const testModel = p.selectedModel || p.models?.[0]?.id || 'default';
  const start = Date.now();
  try {
    let testUrl, testBody, headers;
    if (p.api === 'anthropic-messages') {
      testUrl = p.baseUrl + '/v1/messages';
      headers = { 'Content-Type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' };
      testBody = JSON.stringify({ model: testModel, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    } else if (p.api === 'openai-chatgpt-responses') {
      testUrl = p.baseUrl.replace('/v1', '') + '/';
      headers = {}; testBody = null;
    } else {
      testUrl = p.baseUrl + '/chat/completions';
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey}` };
      testBody = JSON.stringify({ model: testModel, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const opts = { method: testBody ? 'POST' : 'GET', headers, signal: controller.signal };
    if (testBody) opts.body = testBody;
    const r = await fetch(testUrl, opts);
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const data = await r.text();
    if (r.status === 200 || r.status === 201)
      return { ok: true, status: r.status, latencyMs: latency, message: `连接成功 (${testModel})`, model: testModel };
    if (r.status === 401 || r.status === 403)
      return { ok: false, status: r.status, latencyMs: latency, error: 'API Key 无效或已过期', model: testModel };
    if (r.status === 429)
      return { ok: true, status: r.status, latencyMs: latency, message: `连接成功（限流，Key 有效）(${testModel})`, model: testModel };
    const lower = data.toLowerCase();
    if (lower.includes('model') && (lower.includes('not found') || lower.includes('invalid')))
      return { ok: true, status: r.status, latencyMs: latency, message: '连接成功（模型名可能需调整）', model: testModel };
    return { ok: false, status: r.status, latencyMs: latency, error: `HTTP ${r.status}: ${data.slice(0, 200)}` };
  } catch (e) {
    const latency = Date.now() - start;
    if (e.name === 'AbortError') return { ok: false, latencyMs: latency, error: '连接超时 (15s)' };
    return { ok: false, latencyMs: latency, error: e.message };
  }
}

function updateProviderField(providerId, field, value) {
  const db = getProviderDB();
  const target = db.find(p => p.id === providerId);
  if (!target) throw new Error(`Provider "${providerId}" not found`);
  target[field] = value;
  writeProviderDB(db);
  const cfg = readJSON(CONFIG_PATH);
  if (cfg?.models?.providers?.[providerId]) { cfg.models.providers[providerId][field] = value; writeJSON(CONFIG_PATH, cfg); }
  if (field === 'apiKey') {
    const agentsDir = path.join(DATA_DIR, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const aid of fs.readdirSync(agentsDir)) {
        const mp = path.join(agentsDir, aid, 'agent', 'models.json');
        if (!fs.existsSync(mp)) continue;
        const mc = readJSON(mp);
        if (mc?.providers?.[providerId]) { mc.providers[providerId].apiKey = value; writeJSON(mp, mc); }
      }
    }
  }
}

function addProviderToDB(data) {
  const db = getProviderDB();
  if (db.find(p => p.id === data.id)) throw new Error(`Provider "${data.id}" already exists`);
  const provider = {
    id: data.id, name: data.name || data.id, nameZh: data.nameZh || data.name || data.id,
    category: data.category || 'custom', icon: data.icon || 'custom', iconColor: data.iconColor || '#888888',
    baseUrl: data.baseUrl, api: data.api || 'openai-completions', apiKey: data.apiKey || '',
    models: data.models || [{ id: 'default', name: 'Default', tags: [] }],
    isCurrent: false, selectedModel: null, costMultiplier: '1.0', notes: data.notes || ''
  };
  db.push(provider); writeProviderDB(db); return provider;
}

function deleteProviderFromDB(providerId) {
  const db = getProviderDB();
  const idx = db.findIndex(p => p.id === providerId);
  if (idx < 0) throw new Error(`Provider "${providerId}" not found`);
  db.splice(idx, 1); writeProviderDB(db);
}

// ── First Run Detection ──
function getSetupStatus() {
  const hasConfig = fs.existsSync(CONFIG_PATH);
  const hasProviders = fs.existsSync(PROVIDERS_DB);
  const hasNode = fs.existsSync(NODE_EXE);
  const hasOpenclaw = fs.existsSync(OPENCLAW_ENTRY);
  const needsSetup = !hasConfig || !hasProviders;
  return { hasConfig, hasProviders, hasNode, hasOpenclaw, needsSetup };
}

// ── Usage Tracking ──
const USAGE_DB = path.join(DATA_DIR, 'usage.json');
function getUsage() { return readJSON(USAGE_DB) || { calls: [], totals: {} }; }
function recordUsage(providerId, model, tokens, latencyMs, ok) {
  const usage = getUsage();
  const now = new Date().toISOString();
  usage.calls.push({ ts: now, provider: providerId, model, tokens, latencyMs, ok });
  // Keep last 500 calls
  if (usage.calls.length > 500) usage.calls = usage.calls.slice(-500);
  // Update totals
  const key = `${providerId}/${model}`;
  if (!usage.totals[key]) usage.totals[key] = { calls: 0, tokens: 0, errors: 0 };
  usage.totals[key].calls++;
  usage.totals[key].tokens += tokens || 0;
  if (!ok) usage.totals[key].errors++;
  writeJSON(USAGE_DB, usage);
}

// ── Chat Proxy ──
async function chatProxy(providerId, message, history) {
  const db = getProviderDB();
  const p = db.find(x => x.id === providerId);
  if (!p) throw new Error(`Provider "${providerId}" not found`);
  if (!p.apiKey) throw new Error('API Key 未配置');

  const model = p.selectedModel || p.models?.[0]?.id || 'default';
  const messages = [...(history || []), { role: 'user', content: message }];
  const start = Date.now();

  let headers, url, body;
  if (p.api === 'anthropic-messages') {
    url = p.baseUrl + '/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' };
    body = JSON.stringify({ model, max_tokens: 1024, messages });
  } else {
    url = p.baseUrl + '/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey}` };
    body = JSON.stringify({ model, max_tokens: 1024, messages });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const r = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const data = await r.json();

    let reply = '', tokens = 0;
    if (p.api === 'anthropic-messages') {
      reply = data.content?.[0]?.text || data.error?.message || JSON.stringify(data);
      tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
    } else {
      reply = data.choices?.[0]?.message?.content || data.error?.message || JSON.stringify(data);
      tokens = data.usage?.total_tokens || 0;
    }

    const ok = r.status >= 200 && r.status < 300;
    recordUsage(providerId, model, tokens, latency, ok);
    return { ok, reply, model, tokens, latencyMs: latency };
  } catch (e) {
    recordUsage(providerId, model, 0, Date.now() - start, false);
    if (e.name === 'AbortError') throw new Error('请求超时 (30s)');
    throw e;
  }
}

// ── Config Export/Import ──
function exportConfig() {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    providers: readJSON(PROVIDERS_DB) || [],
    config: readJSON(CONFIG_PATH) || {},
    usage: readJSON(USAGE_DB) || { calls: [], totals: {} }
  };
}
function importConfig(data) {
  if (data.providers) writeJSON(PROVIDERS_DB, data.providers);
  if (data.config) writeJSON(CONFIG_PATH, data.config);
  if (data.usage) writeJSON(USAGE_DB, data.usage);
}

// ── Gateway Watchdog ──
let watchdogEnabled = true;
let watchdogTimer = null;
let crashCount = 0;
const MAX_CRASH_RESTART = 5;

function startWatchdog() {
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(async () => {
    if (!watchdogEnabled) return;
    // If gateway was running but process died, auto-restart
    if (gatewayStatus === 'running' && (!gatewayProc || gatewayProc.killed)) {
      crashCount++;
      if (crashCount > MAX_CRASH_RESTART) {
        log(`Watchdog: Gateway crashed ${crashCount} times, giving up. Manual restart needed.`);
        gatewayStatus = 'error';
        return;
      }
      log(`Watchdog: Gateway crashed (attempt ${crashCount}/${MAX_CRASH_RESTART}), restarting...`);
      gatewayStatus = 'stopped';
      gatewayProc = null;
      await new Promise(r => setTimeout(r, 2000));
      startGateway();
    }
    // Check health endpoint if gateway is supposed to be running
    if (gatewayStatus === 'running') {
      try {
        const r = await fetch(`http://localhost:${GATEWAY_PORT}/health`, { signal: AbortSignal.timeout(5000) });
        if (r.ok) crashCount = 0; // Reset crash counter on healthy response
      } catch { /* health check failed but process still alive, might be starting */ }
    }
  }, 15000); // Check every 15s
}

// ── Config Rollback ──
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
function backupConfig(label) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `openclaw_${ts}${label ? '_' + label : ''}.json`;
  if (fs.existsSync(CONFIG_PATH)) {
    fs.copyFileSync(CONFIG_PATH, path.join(BACKUP_DIR, name));
    log('Config backup: ' + name);
  }
}
function getLastBackup() {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('openclaw_') && f.endsWith('.json')).sort().reverse();
  return files[0] ? path.join(BACKUP_DIR, files[0]) : null;
}
function rollbackConfig() {
  const backup = getLastBackup();
  if (!backup) { log('No backup to rollback to'); return false; }
  fs.copyFileSync(backup, CONFIG_PATH);
  log('Config rolled back to: ' + path.basename(backup));
  return true;
}

// ── Streaming Chat (SSE) ──
async function chatStream(providerId, message, history, res) {
  const db = getProviderDB();
  const p = db.find(x => x.id === providerId);
  if (!p) throw new Error(`Provider "${providerId}" not found`);
  if (!p.apiKey) throw new Error('API Key 未配置');

  const model = p.selectedModel || p.models?.[0]?.id || 'default';
  const messages = [...(history || []), { role: 'user', content: message }];
  const start = Date.now();

  let headers, url, body;
  if (p.api === 'anthropic-messages') {
    url = p.baseUrl + '/v1/messages';
    headers = { 'Content-Type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' };
    body = JSON.stringify({ model, max_tokens: 1024, stream: true, messages });
  } else {
    url = p.baseUrl + '/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey}` };
    body = JSON.stringify({ model, max_tokens: 1024, stream: true, messages });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write(`data: ${JSON.stringify({ type: 'model', model })}\n\n`);

  try {
    const r = await fetch(url, { method: 'POST', headers, body });
    if (!r.ok) {
      const errText = await r.text();
      res.write(`data: ${JSON.stringify({ type: 'error', error: `HTTP ${r.status}: ${errText.slice(0, 200)}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      recordUsage(providerId, model, 0, Date.now() - start, false);
      return res.end();
    }

    let fullReply = '';
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          let delta = '';
          if (p.api === 'anthropic-messages') {
            if (parsed.type === 'content_block_delta') delta = parsed.delta?.text || '';
          } else {
            delta = parsed.choices?.[0]?.delta?.content || '';
          }
          if (delta) {
            fullReply += delta;
            res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`);
          }
        } catch {}
      }
    }

    const latency = Date.now() - start;
    const tokens = fullReply.length; // Approximate
    res.write(`data: ${JSON.stringify({ type: 'done', tokens, latencyMs: latency })}\n\n`);
    res.write('data: [DONE]\n\n');
    recordUsage(providerId, model, tokens, latency, true);
    return res.end();
  } catch (e) {
    const msg = e.name === 'AbortError' ? '请求超时' : e.message;
    res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
    res.write('data: [DONE]\n\n');
    recordUsage(providerId, model, 0, Date.now() - start, false);
    return res.end();
  }
}

// ── Agent Management ──
function getAgents() {
  const cfg = readJSON(CONFIG_PATH);
  const agents = cfg?.agents?.list || [];
  const defaults = cfg?.agents?.defaults || {};
  return agents.map(a => ({
    ...a,
    primaryModel: defaults.model?.primary || null,
    workspace: a.workspace || defaults.workspace
  }));
}
function setAgentModel(agentId, fullModelId) {
  const cfg = readJSON(CONFIG_PATH);
  if (!cfg) throw new Error('Config not found');
  if (agentId === 'main' || agentId === 'default') {
    if (!cfg.agents) cfg.agents = { defaults: {} };
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};
    cfg.agents.defaults.model.primary = fullModelId;
    writeJSON(CONFIG_PATH, cfg);
  }
  // Per-agent model override (stored in providers.json as agentModels)
  const db = getProviderDB();
  if (!db._agentModels) db._agentModels = {};
  db._agentModels[agentId] = fullModelId;
  writeJSON(PROVIDERS_DB, db);
}

// ── Plugin Management ──
function getPlugins() {
  const cfg = readJSON(CONFIG_PATH);
  const entries = cfg?.plugins?.entries || {};
  const allow = cfg?.plugins?.allow || [];
  return { entries, allow, enabled: cfg?.plugins?.enabled !== false, bundledDiscovery: cfg?.plugins?.bundledDiscovery };
}
function togglePlugin(pluginId, enabled) {
  const cfg = readJSON(CONFIG_PATH);
  if (!cfg.plugins) cfg.plugins = { enabled: true, allow: [], entries: {} };
  if (!cfg.plugins.entries) cfg.plugins.entries = {};
  if (!cfg.plugins.entries[pluginId]) cfg.plugins.entries[pluginId] = {};
  cfg.plugins.entries[pluginId].enabled = enabled;
  writeJSON(CONFIG_PATH, cfg);
}

// ── HTTP Server ──
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === '/' || p === '/index.html') {
    cors(res); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(ROOT, 'ModelSwitcher.html'), 'utf8'));
  }

  // ── Gateway Management ──
  if (p === '/api/gateway' && req.method === 'GET') {
    // Also check external gateway health
    let externalOnline = false;
    try { const r = await fetch(`http://localhost:${GATEWAY_PORT}/health`); externalOnline = r.ok; } catch {}
    const info = getGatewayInfo();
    info.online = info.status === 'running' || externalOnline;
    return json(res, info);
  }
  if (p === '/api/gateway/start' && req.method === 'POST') {
    return json(res, startGateway());
  }
  if (p === '/api/gateway/stop' && req.method === 'POST') {
    return json(res, stopGateway());
  }
  if (p === '/api/gateway/restart' && req.method === 'POST') {
    return json(res, await restartGateway());
  }
  if (p === '/api/gateway/logs' && req.method === 'GET') {
    return json(res, { logs: gatewayLogs.slice(-30) });
  }

  // ── Providers ──
  if (p === '/api/providers' && req.method === 'GET') {
    const db = getProviderDB();
    return json(res, db.map(pr => ({
      ...pr, apiKey: pr.apiKey ? maskKey(pr.apiKey) : null,
      hasKey: !!(pr.apiKey && pr.apiKey.length > 0),
      selectedModel: pr.selectedModel || pr.models?.[0]?.id || null
    })));
  }
  const switchMatch = p.match(/^\/api\/providers\/([^/]+)\/switch$/);
  if (switchMatch && req.method === 'PUT') {
    const b = await body(req);
    try {
      const result = switchProvider(decodeURIComponent(switchMatch[1]), b.modelId);
      // Auto-restart gateway after switch
      if (gatewayProc && !gatewayProc.killed) {
        log('Auto-restarting gateway after model switch...');
        result.restart = 'initiated';
        restartGateway(); // async, don't await
      }
      return json(res, result);
    } catch (e) { return err(res, e.message); }
  }
  const testMatch = p.match(/^\/api\/providers\/([^/]+)\/test$/);
  if (testMatch && req.method === 'POST') {
    try { return json(res, await testProvider(decodeURIComponent(testMatch[1]))); }
    catch (e) { return err(res, e.message); }
  }
  const patchMatch = p.match(/^\/api\/providers\/([^/]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const b = await body(req);
    try {
      const id = decodeURIComponent(patchMatch[1]);
      for (const [field, value] of Object.entries(b)) {
        if (['apiKey', 'baseUrl', 'name', 'notes', 'iconColor', 'selectedModel'].includes(field))
          updateProviderField(id, field, value);
      }
      return json(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }
  if (p === '/api/providers' && req.method === 'POST') {
    const b = await body(req);
    if (!b.id || !b.baseUrl) return err(res, 'id and baseUrl required');
    try { return json(res, addProviderToDB(b)); } catch (e) { return err(res, e.message); }
  }
  const delMatch = p.match(/^\/api\/providers\/([^/]+)$/);
  if (delMatch && req.method === 'DELETE') {
    try { deleteProviderFromDB(decodeURIComponent(delMatch[1])); return json(res, { ok: true }); }
    catch (e) { return err(res, e.message); }
  }

  // ── Config ──
  if (p === '/api/config' && req.method === 'GET') {
    const cfg = readJSON(CONFIG_PATH);
    if (cfg?.gateway?.auth?.token) cfg.gateway.auth.token = maskKey(cfg.gateway.auth.token);
    return json(res, cfg);
  }

  // ── Setup ──
  if (p === '/api/setup/status' && req.method === 'GET') {
    return json(res, getSetupStatus());
  }
  if (p === '/api/setup/init' && req.method === 'POST') {
    // Create config files from examples
    const b = await body(req);
    const exampleCfg = CONFIG_PATH + '.example';
    const exampleProv = PROVIDERS_DB + '.example';
    if (fs.existsSync(exampleCfg) && !fs.existsSync(CONFIG_PATH)) {
      let cfg = readJSON(exampleCfg);
      if (cfg && b.apiKey) {
        // Fill in DeepSeek API key
        for (const p of Object.values(cfg.models?.providers || {})) {
          if (p.baseUrl?.includes('deepseek') || p.apiKey === 'YOUR_API_KEY_HERE') p.apiKey = b.apiKey;
        }
      }
      writeJSON(CONFIG_PATH, cfg);
    }
    if (fs.existsSync(exampleProv) && !fs.existsSync(PROVIDERS_DB)) {
      let db = readJSON(exampleProv);
      if (db && b.apiKey) {
        db.forEach(p => { if (p.baseUrl?.includes('deepseek') && !p.apiKey) p.apiKey = b.apiKey; });
      }
      writeJSON(PROVIDERS_DB, db);
    }
    return json(res, { ok: true, ...getSetupStatus() });
  }

  // ── Chat ──
  if (p === '/api/chat' && req.method === 'POST') {
    const b = await body(req);
    if (!b.message) return err(res, 'message required');
    const providerId = b.provider || getProviderDB().find(x => x.isCurrent)?.id;
    if (!providerId) return err(res, 'No provider selected');
    try {
      const result = await chatProxy(providerId, b.message, b.history);
      return json(res, result);
    } catch (e) { return err(res, e.message); }
  }
  // SSE Streaming chat
  if (p === '/api/chat/stream' && req.method === 'POST') {
    const b = await body(req);
    if (!b.message) return err(res, 'message required');
    const providerId = b.provider || getProviderDB().find(x => x.isCurrent)?.id;
    if (!providerId) return err(res, 'No provider selected');
    try { return chatStream(providerId, b.message, b.history, res); }
    catch (e) { return err(res, e.message); }
  }

  // ── Usage ──
  if (p === '/api/usage' && req.method === 'GET') {
    return json(res, getUsage());
  }
  if (p === '/api/usage/reset' && req.method === 'POST') {
    writeJSON(USAGE_DB, { calls: [], totals: {} });
    return json(res, { ok: true });
  }

  // ── Config Export/Import ──
  if (p === '/api/config/export' && req.method === 'GET') {
    const exported = exportConfig();
    exported.providers.forEach(p => { if (p.apiKey) p.apiKey = '***'; });
    if (exported.config?.models?.providers) {
      for (const p of Object.values(exported.config.models.providers)) {
        if (p.apiKey) p.apiKey = '***';
      }
    }
    res.setHeader('Content-Disposition', 'attachment; filename="uclaw-config.json"');
    return json(res, exported);
  }
  if (p === '/api/config/import' && req.method === 'POST') {
    const b = await body(req);
    if (!b.providers && !b.config) return err(res, 'Invalid import data');
    try {
      backupConfig('pre-import');
      importConfig(b);
      return json(res, { ok: true, ...getSetupStatus() });
    } catch (e) {
      rollbackConfig();
      return err(res, e.message);
    }
  }

  // ── Agents ──
  if (p === '/api/agents' && req.method === 'GET') {
    return json(res, getAgents());
  }
  const agentModelMatch = p.match(/^\/api\/agents\/([^/]+)\/model$/);
  if (agentModelMatch && req.method === 'PUT') {
    const b = await body(req);
    if (!b.fullId) return err(res, 'fullId required');
    try { setAgentModel(decodeURIComponent(agentModelMatch[1]), b.fullId); return json(res, { ok: true }); }
    catch (e) { return err(res, e.message); }
  }

  // ── Plugins ──
  if (p === '/api/plugins' && req.method === 'GET') {
    return json(res, getPlugins());
  }
  const pluginMatch = p.match(/^\/api\/plugins\/([^/]+)\/toggle$/);
  if (pluginMatch && req.method === 'PUT') {
    const b = await body(req);
    try { togglePlugin(decodeURIComponent(pluginMatch[1]), b.enabled); return json(res, { ok: true }); }
    catch (e) { return err(res, e.message); }
  }

  // ── Config Rollback ──
  if (p === '/api/config/rollback' && req.method === 'POST') {
    const ok = rollbackConfig();
    return json(res, { ok, message: ok ? '已回滚到上一个配置' : '没有可回滚的备份' });
  }
  if (p === '/api/config/backups' && req.method === 'GET') {
    if (!fs.existsSync(BACKUP_DIR)) return json(res, []);
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 10);
    return json(res, files);
  }

  err(res, 'Not found', 404);
});

server.listen(PORT, '127.0.0.1', () => {
  log(`Config Panel: http://localhost:${PORT}`);
  log(`Data: ${DATA_DIR}`);
  startWatchdog();
  // Auto-start gateway
  const status = getSetupStatus();
  if (status.hasConfig && status.hasProviders) {
    log('Auto-starting gateway...');
    startGateway();
  } else {
    log('First run detected — open the panel to configure.');
  }
});
