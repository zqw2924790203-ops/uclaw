// UClaW Config Server — Provider DB + OpenClaw config management
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.UCRAW_ROOT || path.resolve(__dirname, '..');
const DATA_DIR = process.env.OPENCLAW_STATE_DIR || path.join(ROOT, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'openclaw.json');
const PROVIDERS_DB = path.join(DATA_DIR, 'providers.json');
const PORT = parseInt(process.env.UCLAW_CONFIG_PORT || '18790', 10);
const GATEWAY_PORT = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10);

const readJSON = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2), 'utf8');
const maskKey = k => (!k || k.length < 10) ? '***' : k.slice(0, 6) + '...' + k.slice(-4);

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

// ── Provider DB ──
function getProviderDB() { return readJSON(PROVIDERS_DB) || []; }
function writeProviderDB(db) { writeJSON(PROVIDERS_DB, db); }

// Switch current provider with optional modelId
function switchProvider(providerId, modelId) {
  const db = getProviderDB();
  const target = db.find(p => p.id === providerId);
  if (!target) throw new Error(`Provider "${providerId}" not found`);

  db.forEach(p => p.isCurrent = (p.id === providerId));
  // Store selected model per provider
  if (modelId) target.selectedModel = modelId;
  writeProviderDB(db);

  const selectedModel = modelId || target.selectedModel || target.models?.[0]?.id || 'default';
  const fullId = `${target.id}/${selectedModel}`;

  const cfg = readJSON(CONFIG_PATH);
  if (!cfg) throw new Error('Config not found');
  if (!cfg.models) cfg.models = { mode: 'merge', providers: {} };
  if (!cfg.models.providers) cfg.models.providers = {};

  const providerCfg = {
    baseUrl: target.baseUrl,
    api: target.api,
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

  // Sync to agent configs
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

// Test API connection
async function testProvider(providerId) {
  const db = getProviderDB();
  const p = db.find(x => x.id === providerId);
  if (!p) throw new Error(`Provider "${providerId}" not found`);
  if (!p.apiKey) return { ok: false, error: 'API Key 未配置', latencyMs: 0 };

  const start = Date.now();
  try {
    let testUrl, testBody, headers;
    if (p.api === 'anthropic-messages') {
      testUrl = p.baseUrl + '/v1/messages';
      headers = { 'Content-Type': 'application/json', 'x-api-key': p.apiKey, 'anthropic-version': '2023-06-01' };
      testBody = JSON.stringify({ model: p.models[0]?.id || 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    } else if (p.api === 'openai-chatgpt-responses') {
      // Codex can't easily test, just check endpoint reachability
      testUrl = p.baseUrl.replace('/v1', '') + '/';
      headers = {};
      testBody = null;
    } else {
      // OpenAI-compatible
      testUrl = p.baseUrl + '/chat/completions';
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.apiKey}` };
      testBody = JSON.stringify({ model: p.models[0]?.id || 'gpt-3.5-turbo', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const opts = { method: testBody ? 'POST' : 'GET', headers, signal: controller.signal };
    if (testBody) opts.body = testBody;

    const r = await fetch(testUrl, opts);
    clearTimeout(timeout);
    const latency = Date.now() - start;
    const data = await r.text();

    if (r.status === 200 || r.status === 201) {
      return { ok: true, status: r.status, latencyMs: latency, message: '连接成功' };
    } else if (r.status === 401 || r.status === 403) {
      return { ok: false, status: r.status, latencyMs: latency, error: 'API Key 无效或已过期' };
    } else if (r.status === 429) {
      return { ok: true, status: r.status, latencyMs: latency, message: '连接成功（触发限流，Key 有效）' };
    } else {
      // Check if response contains error about model
      const lower = data.toLowerCase();
      if (lower.includes('model') && (lower.includes('not found') || lower.includes('invalid') || lower.includes('does not exist'))) {
        return { ok: true, status: r.status, latencyMs: latency, message: '连接成功（模型名可能需调整）' };
      }
      return { ok: false, status: r.status, latencyMs: latency, error: `HTTP ${r.status}: ${data.slice(0, 200)}` };
    }
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
  if (cfg?.models?.providers?.[providerId]) {
    cfg.models.providers[providerId][field] = value;
    writeJSON(CONFIG_PATH, cfg);
  }
  if (field === 'apiKey') {
    const agentsDir = path.join(DATA_DIR, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const aid of fs.readdirSync(agentsDir)) {
        const mp = path.join(agentsDir, aid, 'agent', 'models.json');
        if (!fs.existsSync(mp)) continue;
        const mc = readJSON(mp);
        if (mc?.providers?.[providerId]) {
          mc.providers[providerId].apiKey = value;
          writeJSON(mp, mc);
        }
      }
    }
  }
}

function addProviderToDB(data) {
  const db = getProviderDB();
  if (db.find(p => p.id === data.id)) throw new Error(`Provider "${data.id}" already exists`);
  const provider = {
    id: data.id, name: data.name || data.id, nameZh: data.nameZh || data.name || data.id,
    category: data.category || 'custom', icon: data.icon || 'custom',
    iconColor: data.iconColor || '#888888',
    baseUrl: data.baseUrl, api: data.api || 'openai-completions',
    apiKey: data.apiKey || '', models: data.models || [{ id: 'default', name: 'Default', tags: [] }],
    isCurrent: false, selectedModel: null, costMultiplier: '1.0', notes: data.notes || ''
  };
  db.push(provider);
  writeProviderDB(db);
  return provider;
}

function deleteProviderFromDB(providerId) {
  const db = getProviderDB();
  const idx = db.findIndex(p => p.id === providerId);
  if (idx < 0) throw new Error(`Provider "${providerId}" not found`);
  db.splice(idx, 1);
  writeProviderDB(db);
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

  // GET /api/providers
  if (p === '/api/providers' && req.method === 'GET') {
    const db = getProviderDB();
    return json(res, db.map(pr => ({
      ...pr,
      apiKey: pr.apiKey ? maskKey(pr.apiKey) : null,
      hasKey: !!(pr.apiKey && pr.apiKey.length > 0),
      selectedModel: pr.selectedModel || pr.models?.[0]?.id || null
    })));
  }

  // PUT /api/providers/:id/switch — with optional modelId
  const switchMatch = p.match(/^\/api\/providers\/([^/]+)\/switch$/);
  if (switchMatch && req.method === 'PUT') {
    const b = await body(req);
    try { return json(res, switchProvider(decodeURIComponent(switchMatch[1]), b.modelId)); }
    catch (e) { return err(res, e.message); }
  }

  // POST /api/providers/:id/test — test API connection
  const testMatch = p.match(/^\/api\/providers\/([^/]+)\/test$/);
  if (testMatch && req.method === 'POST') {
    try { return json(res, await testProvider(decodeURIComponent(testMatch[1]))); }
    catch (e) { return err(res, e.message); }
  }

  // PATCH /api/providers/:id
  const patchMatch = p.match(/^\/api\/providers\/([^/]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const b = await body(req);
    try {
      const id = decodeURIComponent(patchMatch[1]);
      for (const [field, value] of Object.entries(b)) {
        if (['apiKey', 'baseUrl', 'name', 'notes', 'iconColor', 'selectedModel'].includes(field)) {
          updateProviderField(id, field, value);
        }
      }
      return json(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/providers
  if (p === '/api/providers' && req.method === 'POST') {
    const b = await body(req);
    if (!b.id || !b.baseUrl) return err(res, 'id and baseUrl required');
    try { return json(res, addProviderToDB(b)); }
    catch (e) { return err(res, e.message); }
  }

  // DELETE /api/providers/:id
  const delMatch = p.match(/^\/api\/providers\/([^/]+)$/);
  if (delMatch && req.method === 'DELETE') {
    try { deleteProviderFromDB(decodeURIComponent(delMatch[1])); return json(res, { ok: true }); }
    catch (e) { return err(res, e.message); }
  }

  // GET /api/config
  if (p === '/api/config' && req.method === 'GET') {
    const cfg = readJSON(CONFIG_PATH);
    if (cfg?.gateway?.auth?.token) cfg.gateway.auth.token = maskKey(cfg.gateway.auth.token);
    return json(res, cfg);
  }

  // GET /api/gateway
  if (p === '/api/gateway' && req.method === 'GET') {
    try {
      const r = await fetch(`http://localhost:${GATEWAY_PORT}/health`);
      const d = await r.json().catch(() => ({}));
      return json(res, { online: r.ok, port: GATEWAY_PORT, ...d });
    } catch { return json(res, { online: false, port: GATEWAY_PORT }); }
  }

  err(res, 'Not found', 404);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[UClaW Config] http://localhost:${PORT}`);
  console.log(`[UClaW Config] Providers: ${PROVIDERS_DB}`);
  console.log(`[UClaW Config] Gateway: localhost:${GATEWAY_PORT}`);
});
