// =====================================================================
//  "Der Boden ist Lava!" – kleiner Spielserver ohne externe Pakete
//  - liefert das Spiel aus dem Ordner public/ aus
//  - speichert Profile und Sterne in data/spielstand.json
// =====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3040;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'spielstand.json');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

// ---------- Spielstand laden/speichern ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
let stand = { profile: [] };
try { stand = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { /* neu anlegen */ }
if (!Array.isArray(stand.profile)) stand.profile = [];

function speichern() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(stand, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ---------- Hilfsfunktionen ----------
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 10000) { reject(new Error('zu groß')); req.destroy(); } });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch (e) { reject(e); } });
  });
}
const sauber = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 20);

// ---------- API ----------
async function api(req, res, teile) {
  // GET /api/profile
  if (req.method === 'GET' && teile.length === 1) return json(res, 200, stand.profile);

  // POST /api/profile  {name, figur}
  if (req.method === 'POST' && teile.length === 1) {
    const b = await body(req);
    const name = sauber(b.name);
    if (!name) return json(res, 400, { fehler: 'Name fehlt' });
    const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, figur: Number(b.figur) || 0, sterne: {} };
    stand.profile.push(p); speichern();
    return json(res, 201, p);
  }

  const p = stand.profile.find(x => x.id === teile[1]);
  if (!p) return json(res, 404, { fehler: 'Profil nicht gefunden' });

  // PUT /api/profile/:id  {name?, figur?}
  if (req.method === 'PUT' && teile.length === 2) {
    const b = await body(req);
    if (b.name !== undefined && sauber(b.name)) p.name = sauber(b.name);
    if (b.figur !== undefined) p.figur = Number(b.figur) || 0;
    speichern(); return json(res, 200, p);
  }
  // DELETE /api/profile/:id
  if (req.method === 'DELETE' && teile.length === 2) {
    stand.profile = stand.profile.filter(x => x !== p); speichern();
    return json(res, 200, { ok: true });
  }
  // POST /api/profile/:id/level  {level, sterne}
  if (req.method === 'POST' && teile[2] === 'level') {
    const b = await body(req);
    const lv = String(Number(b.level));
    const st = Math.max(0, Math.min(3, Number(b.sterne) || 0));
    if (!(Number(lv) >= 1)) return json(res, 400, { fehler: 'Level fehlt' });
    p.sterne[lv] = Math.max(p.sterne[lv] ?? 0, st);
    speichern(); return json(res, 200, p);
  }
  json(res, 404, { fehler: 'Unbekannt' });
}

// ---------- Statische Dateien ----------
function statisch(req, res, url) {
  let datei = decodeURIComponent(url.pathname);
  if (datei.endsWith('/')) datei += 'index.html';
  const voll = path.normalize(path.join(PUBLIC, datei));
  if (!voll.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(voll, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(voll).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(voll).pipe(res);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const teile = url.pathname.split('/').filter(Boolean);
  try {
    if (teile[0] === 'api' && teile[1] === 'profile') return await api(req, res, teile.slice(1));
    statisch(req, res, url);
  } catch (e) {
    json(res, 400, { fehler: String(e.message || e) });
  }
}).listen(PORT, () => console.log(`Der Boden ist Lava! läuft auf Port ${PORT}`));
