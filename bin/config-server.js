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

// Switch current provider: update providers.json + openclaw.json
function switchProvider(providerId) {
  const db = getProviderDB();
  const target = db.find(p => p.id === providerId);
  if (!target) throw new Error(`Provider "${providerId}" not found`);

  // Update isCurrent flags
  db.forEach(p => p.isCurrent = (p.id === providerId));
  writeProviderDB(db);

  // Build full model ID (provider/model)
  const defaultModel = target.models?.[0]?.id || 'default';
  const fullId = `${target.id}/${defaultModel}`;

  // Update openclaw.json
  const cfg = readJSON(CONFIG_PATH);
  if (!cfg) throw new Error('Config not found');

  // Ensure models.providers exists
  if (!cfg.models) cfg.models = { mode: 'merge', providers: {} };
  if (!cfg.models.providers) cfg.models.providers = {};

  // Upsert provider in openclaw.json
  const providerCfg = {
    baseUrl: target.baseUrl,
    api: target.api,
    models: target.models.map(m => ({ id: m.id, name: m.name }))
  };
  if (target.apiKey) providerCfg.apiKey = target.apiKey;
  if (target.auth) providerCfg.auth = target.auth;
  cfg.models.providers[providerId] = providerCfg;

  // Update primary model
  if (!cfg.agents) cfg.agents = { defaults: {} };
  if (!cfg.agents.defaults) cfg.agents.defaults = {};
  if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};
  cfg.agents.defaults.model.primary = fullId;

  writeJSON(CONFIG_PATH, cfg);

  // Sync API keys to agent-level models.json
  if (target.apiKey) {
    const agentsDir = path.join(DATA_DIR, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const agentId of fs.readdirSync(agentsDir)) {
        const mp = path.join(agentsDir, agentId, 'agent', 'models.json');
        if (!fs.existsSync(mp)) continue;
        const mc = readJSON(mp);
        if (!mc?.providers) continue;
        // Upsert provider in agent config
        mc.providers[providerId] = { ...providerCfg };
        writeJSON(mp, mc);
      }
    }
  }

  return { ok: true, provider: providerId, model: fullId };
}

// Update provider field in DB + openclaw.json
function updateProviderField(providerId, field, value) {
  const db = getProviderDB();
  const target = db.find(p => p.id === providerId);
  if (!target) throw new Error(`Provider "${providerId}" not found`);

  target[field] = value;
  writeProviderDB(db);

  // Sync to openclaw.json
  const cfg = readJSON(CONFIG_PATH);
  if (cfg?.models?.providers?.[providerId]) {
    cfg.models.providers[providerId][field] = value;
    writeJSON(CONFIG_PATH, cfg);
  }
  // Sync to agent configs
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
    isCurrent: false, costMultiplier: '1.0', notes: data.notes || ''
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

  // Serve ModelSwitcher.html
  if (p === '/' || p === '/index.html') {
    cors(res); res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(ROOT, 'ModelSwitcher.html'), 'utf8'));
  }

  // ── Provider DB API ──

  // GET /api/providers — full provider list from DB
  if (p === '/api/providers' && req.method === 'GET') {
    const db = getProviderDB();
    return json(res, db.map(pr => ({
      ...pr,
      apiKey: pr.apiKey ? maskKey(pr.apiKey) : null,
      hasKey: !!(pr.apiKey && pr.apiKey.length > 0)
    })));
  }

  // GET /api/providers/raw — full data including keys (for internal use)
  if (p === '/api/providers/raw' && req.method === 'GET') {
    return json(res, getProviderDB());
  }

  // PUT /api/providers/:id/switch — switch current provider
  const switchMatch = p.match(/^\/api\/providers\/([^/]+)\/switch$/);
  if (switchMatch && req.method === 'PUT') {
    try { return json(res, switchProvider(decodeURIComponent(switchMatch[1]))); }
    catch (e) { return err(res, e.message); }
  }

  // PATCH /api/providers/:id — update any field(s)
  const patchMatch = p.match(/^\/api\/providers\/([^/]+)$/);
  if (patchMatch && req.method === 'PATCH') {
    const b = await body(req);
    try {
      const id = decodeURIComponent(patchMatch[1]);
      for (const [field, value] of Object.entries(b)) {
        if (['apiKey', 'baseUrl', 'name', 'notes', 'iconColor'].includes(field)) {
          updateProviderField(id, field, value);
        }
      }
      return json(res, { ok: true });
    } catch (e) { return err(res, e.message); }
  }

  // POST /api/providers — add new provider
  if (p === '/api/providers' && req.method === 'POST') {
    const b = await body(req);
    if (!b.id || !b.baseUrl) return err(res, 'id and baseUrl required');
    try { return json(res, addProviderToDB(b)); }
    catch (e) { return err(res, e.message); }
  }

  // DELETE /api/providers/:id — delete provider
  const delMatch = p.match(/^\/api\/providers\/([^/]+)$/);
  if (delMatch && req.method === 'DELETE') {
    try { deleteProviderFromDB(decodeURIComponent(delMatch[1])); return json(res, { ok: true }); }
    catch (e) { return err(res, e.message); }
  }

  // ── Config API ──

  // GET /api/config — masked openclaw.json
  if (p === '/api/config' && req.method === 'GET') {
    const cfg = readJSON(CONFIG_PATH);
    if (cfg?.gateway?.auth?.token) cfg.gateway.auth.token = maskKey(cfg.gateway.auth.token);
    return json(res, cfg);
  }

  // GET /api/gateway — gateway health
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
