// City Salon Maurizio Melella — Sito + Prenotazioni + Gestionale
// Node.js puro (nessuna dipendenza). Avvio: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Maurizio';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC = path.join(__dirname, 'public');

// ---------- DATABASE (file JSON) ----------
const DEFAULT_DB = {
  settings: {
    nome: 'City Salon Maurizio Melella',
    slogan: 'Il tuo parrucchiere di fiducia a Salerno',
    indirizzo: 'Via Nizza 118/A, 84124 Salerno (SA)',
    telefono: '089 233720',
    whatsapp: '39089233720',
    email: 'mauriziomelella54@gmail.com',
    instagram: '',
    facebook: '',
    slotMinuti: 30,
    orari: {
      // 0=domenica ... 6=sabato ; null = chiuso
      0: null,
      1: null, // lunedì: solo su appuntamento telefonico
      2: { apre: '09:00', chiude: '19:00' },
      3: { apre: '09:00', chiude: '19:00' },
      4: { apre: '09:00', chiude: '19:00' },
      5: { apre: '09:00', chiude: '19:00' },
      6: { apre: '09:00', chiude: '19:00' }
    },
    notaOrari: 'Lunedì su prenotazione telefonica'
  },
  staff: [
    { id: 's1', nome: 'Maurizio', ruolo: 'Titolare & Hair Stylist', colore: '#ff2d87', attivo: true },
    { id: 's2', nome: 'Staff', ruolo: 'Hair Stylist', colore: '#00c2ff', attivo: true }
  ],
  services: [
    { id: 'sv1', categoria: 'Donna', nome: 'Piega', durata: 30, prezzo: 18, attivo: true },
    { id: 'sv2', categoria: 'Donna', nome: 'Taglio + Piega', durata: 60, prezzo: 35, attivo: true },
    { id: 'sv3', categoria: 'Donna', nome: 'Colore + Piega', durata: 90, prezzo: 55, attivo: true },
    { id: 'sv4', categoria: 'Donna', nome: 'Meches / Balayage', durata: 150, prezzo: 90, attivo: true },
    { id: 'sv5', categoria: 'Donna', nome: 'Trattamento ricostruzione', durata: 45, prezzo: 30, attivo: true },
    { id: 'sv6', categoria: 'Donna', nome: 'Acconciatura sposa / cerimonia', durata: 90, prezzo: 80, attivo: true },
    { id: 'sv7', categoria: 'Uomo', nome: 'Taglio uomo', durata: 30, prezzo: 18, attivo: true },
    { id: 'sv8', categoria: 'Uomo', nome: 'Taglio + Barba', durata: 45, prezzo: 25, attivo: true },
    { id: 'sv9', categoria: 'Uomo', nome: 'Barba', durata: 20, prezzo: 10, attivo: true }
  ],
  clients: [],
  bookings: [],
  sessions: {}
};

function loadDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) { saveDB(DEFAULT_DB); return JSON.parse(JSON.stringify(DEFAULT_DB)); }
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch (e) { console.error('DB corrotto, ricreo', e); saveDB(DEFAULT_DB); return JSON.parse(JSON.stringify(DEFAULT_DB)); }
}
function saveDB(d) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d || db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
let db = loadDB();
const uid = (p) => p + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

// ---------- UTILITY ----------
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const todayISO = () => new Date().toISOString().slice(0, 10);

function freeSlots(date, serviceId, staffId) {
  const svc = db.services.find(s => s.id === serviceId);
  if (!svc) return [];
  const day = new Date(date + 'T12:00:00').getDay();
  const h = db.settings.orari[day];
  if (!h) return [];
  const step = db.settings.slotMinuti || 30;
  const staffList = db.staff.filter(s => s.attivo && (!staffId || s.id === staffId));
  const now = new Date();
  const out = [];
  for (let t = toMin(h.apre); t + svc.durata <= toMin(h.chiude); t += step) {
    if (date === todayISO() && t <= now.getHours() * 60 + now.getMinutes()) continue;
    const freeStaff = staffList.filter(st => !db.bookings.some(b =>
      b.data === date && b.staffId === st.id && b.stato !== 'annullata' &&
      t < toMin(b.ora) + b.durata && toMin(b.ora) < t + svc.durata));
    if (freeStaff.length) out.push({ ora: toHHMM(t), staff: freeStaff.map(s => s.id) });
  }
  return out;
}

function upsertClient(nome, telefono, email) {
  const tel = (telefono || '').replace(/\s+/g, '');
  let c = db.clients.find(x => x.telefono === tel);
  if (!c) { c = { id: uid('c'), nome, telefono: tel, email: email || '', note: '', creato: new Date().toISOString() }; db.clients.push(c); }
  else { c.nome = nome || c.nome; if (email) c.email = email; }
  return c;
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
function send(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function body(req) {
  return new Promise((resolve) => {
    let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}
function isAdmin(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const s = db.sessions[t];
  return s && s > Date.now();
}
function publicSettings() { const { ...s } = db.settings; return s; }

async function api(req, res, url) {
  const p = url.pathname, m = req.method, q = url.searchParams;

  // ---- PUBBLICO ----
  if (p === '/api/info' && m === 'GET')
    return send(res, 200, { settings: publicSettings(), services: db.services.filter(s => s.attivo), staff: db.staff.filter(s => s.attivo).map(({ id, nome, ruolo }) => ({ id, nome, ruolo })) });

  if (p === '/api/slots' && m === 'GET')
    return send(res, 200, freeSlots(q.get('data'), q.get('servizio'), q.get('staff') || ''));

  if (p === '/api/bookings' && m === 'POST') {
    const b = await body(req);
    if (!b.nome || !b.telefono || !b.data || !b.ora || !b.servizioId) return send(res, 400, { error: 'Compila tutti i campi obbligatori' });
    const svc = db.services.find(s => s.id === b.servizioId);
    if (!svc) return send(res, 400, { error: 'Servizio non valido' });
    const slot = freeSlots(b.data, b.servizioId, b.staffId || '').find(s => s.ora === b.ora);
    if (!slot) return send(res, 409, { error: 'Orario non più disponibile, scegline un altro' });
    const staffId = b.staffId && slot.staff.includes(b.staffId) ? b.staffId : slot.staff[0];
    const c = upsertClient(b.nome.trim(), b.telefono, b.email);
    const bk = { id: uid('b'), clienteId: c.id, nome: c.nome, telefono: c.telefono, email: c.email, servizioId: svc.id, servizio: svc.nome, durata: svc.durata, prezzo: svc.prezzo, staffId, data: b.data, ora: b.ora, note: (b.note || '').slice(0, 500), stato: 'confermata', origine: 'online', creato: new Date().toISOString() };
    db.bookings.push(bk); saveDB();
    return send(res, 201, { ok: true, booking: bk });
  }

  // ---- ADMIN ----
  if (p === '/api/admin/login' && m === 'POST') {
    const b = await body(req);
    if (b.password !== ADMIN_PASSWORD) return send(res, 401, { error: 'Password errata' });
    const t = crypto.randomBytes(24).toString('hex');
    db.sessions[t] = Date.now() + 1000 * 60 * 60 * 12;
    for (const k in db.sessions) if (db.sessions[k] < Date.now()) delete db.sessions[k];
    saveDB(); return send(res, 200, { token: t });
  }
  if (!p.startsWith('/api/admin/')) return send(res, 404, { error: 'Not found' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Non autorizzato' });

  const seg = p.replace('/api/admin/', '').split('/');
  const coll = { bookings: 'bookings', clients: 'clients', services: 'services', staff: 'staff' }[seg[0]];

  if (seg[0] === 'dashboard' && m === 'GET') {
    const oggi = todayISO();
    const mese = oggi.slice(0, 7);
    const attive = db.bookings.filter(b => b.stato !== 'annullata');
    const incasso = (arr) => arr.filter(b => b.stato === 'completata').reduce((s, b) => s + Number(b.prezzo || 0), 0);
    const top = {};
    attive.filter(b => b.data.startsWith(mese)).forEach(b => top[b.servizio] = (top[b.servizio] || 0) + 1);
    return send(res, 200, {
      oggi: attive.filter(b => b.data === oggi).sort((a, b) => a.ora.localeCompare(b.ora)),
      prossimi: attive.filter(b => b.data > oggi).length,
      clienti: db.clients.length,
      incassoOggi: incasso(attive.filter(b => b.data === oggi)),
      incassoMese: incasso(attive.filter(b => b.data.startsWith(mese))),
      appMese: attive.filter(b => b.data.startsWith(mese)).length,
      topServizi: Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5)
    });
  }

  if (seg[0] === 'settings') {
    if (m === 'GET') return send(res, 200, db.settings);
    if (m === 'PUT') { const b = await body(req); db.settings = { ...db.settings, ...b }; saveDB(); return send(res, 200, db.settings); }
  }

  if (seg[0] === 'export' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="backup-citysalon.json"' });
    const { sessions, ...rest } = db; return res.end(JSON.stringify(rest, null, 2));
  }

  if (coll) {
    const list = db[coll];
    const id = seg[1];
    if (m === 'GET' && !id) {
      let r = list;
      if (coll === 'bookings') {
        if (q.get('da')) r = r.filter(b => b.data >= q.get('da'));
        if (q.get('a')) r = r.filter(b => b.data <= q.get('a'));
        r = [...r].sort((a, b) => (a.data + a.ora).localeCompare(b.data + b.ora));
      }
      if (coll === 'clients') r = r.map(c => {
        const bs = db.bookings.filter(b => b.clienteId === c.id && b.stato !== 'annullata');
        return { ...c, visite: bs.filter(b => b.stato === 'completata').length, speso: bs.filter(b => b.stato === 'completata').reduce((s, b) => s + Number(b.prezzo || 0), 0), ultima: bs.map(b => b.data).sort().pop() || '' };
      });
      return send(res, 200, r);
    }
    if (m === 'POST') {
      const b = await body(req);
      let item = { ...b, id: uid(coll[0]) };
      if (coll === 'bookings') {
        const svc = db.services.find(s => s.id === b.servizioId);
        if (!svc || !b.data || !b.ora || !b.nome) return send(res, 400, { error: 'Dati mancanti' });
        const c = upsertClient(b.nome, b.telefono || '', b.email);
        item = { ...item, clienteId: c.id, servizio: svc.nome, durata: Number(b.durata) || svc.durata, prezzo: b.prezzo !== undefined && b.prezzo !== '' ? Number(b.prezzo) : svc.prezzo, stato: b.stato || 'confermata', origine: 'gestionale', creato: new Date().toISOString() };
      }
      if (coll === 'services') { item.durata = Number(item.durata) || 30; item.prezzo = Number(item.prezzo) || 0; item.attivo = item.attivo !== false; }
      if (coll === 'staff') item.attivo = item.attivo !== false;
      if (coll === 'clients') { item.telefono = (item.telefono || '').replace(/\s+/g, ''); item.creato = new Date().toISOString(); }
      list.push(item); saveDB(); return send(res, 201, item);
    }
    const idx = list.findIndex(x => x.id === id);
    if (idx < 0) return send(res, 404, { error: 'Non trovato' });
    if (m === 'PUT') {
      const b = await body(req);
      if (coll === 'bookings' && b.servizioId && b.servizioId !== list[idx].servizioId) {
        const svc = db.services.find(s => s.id === b.servizioId);
        if (svc) { b.servizio = svc.nome; b.durata = b.durata || svc.durata; }
      }
      ['durata', 'prezzo'].forEach(k => { if (b[k] !== undefined) b[k] = Number(b[k]); });
      list[idx] = { ...list[idx], ...b, id };
      saveDB(); return send(res, 200, list[idx]);
    }
    if (m === 'DELETE') { list.splice(idx, 1); saveDB(); return send(res, 200, { ok: true }); }
  }
  return send(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    let f = url.pathname === '/' ? '/index.html' : url.pathname === '/admin' ? '/admin.html' : url.pathname;
    const fp = path.normalize(path.join(PUBLIC, f));
    if (!fp.startsWith(PUBLIC) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>Pagina non trovata</h1><a href="/">Torna al sito</a>');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Errore server' }); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`City Salon attivo su porta ${PORT} — admin: /admin`));
