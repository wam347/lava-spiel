// =====================================================================
//  Bildschirme, Profile, Speichern, Spielablauf
// =====================================================================
const CFG = window.SPIEL_CONFIG;
const LV = window.LEVELS;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const RAEUME = [
  { id: 'wohnzimmer', icon: '🛋️' }, { id: 'kinderzimmer', icon: '🧸' },
  { id: 'garten', icon: '🌳' }, { id: 'spielplatz', icon: '🛝' },
];
const figur = i => CFG.figuren[i] || CFG.figuren[0];
const sternText = (n, max = 3) => Array.from({ length: max }, (_, i) => `<span class="${i < n ? 'an' : 'aus'}">★</span>`).join('');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------- Speicher
const Speicher = {
  offline: location.protocol === 'file:',
  lokalLesen() { try { return JSON.parse(localStorage.getItem('lava_profile') || '[]'); } catch { return []; } },
  lokalSchreiben(l) { try { localStorage.setItem('lava_profile', JSON.stringify(l)); } catch { /* egal */ } },
  async anfrage(methode, pfad, daten) {
    if (!this.offline) {
      try {
        const r = await fetch('api/' + pfad, { method: methode, headers: { 'Content-Type': 'application/json' }, body: daten ? JSON.stringify(daten) : undefined });
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('json')) { const j = await r.json(); if (!r.ok) throw Object.assign(new Error(j.fehler || r.status), { server: true }); return j; }
        throw new Error('kein Server');
      } catch (e) {
        if (e.server) throw e;
        this.offline = true;
        hinweis('Server nicht erreichbar – Spielstand wird nur auf diesem Gerät gespeichert.');
      }
    }
    return this.lokal(methode, pfad, daten);
  },
  lokal(m, pfad, d) {
    const l = this.lokalLesen(), t = pfad.split('/');
    if (m === 'GET') return l;
    if (m === 'POST' && t.length === 1) { const p = { id: Date.now().toString(36), name: d.name, figur: d.figur, sterne: {} }; l.push(p); this.lokalSchreiben(l); return p; }
    const p = l.find(x => x.id === t[1]);
    if (!p) throw new Error('Profil fehlt');
    if (m === 'PUT') Object.assign(p, d);
    if (m === 'DELETE') l.splice(l.indexOf(p), 1);
    if (m === 'POST' && t[2] === 'level') p.sterne[d.level] = Math.max(p.sterne[d.level] ?? 0, d.sterne);
    this.lokalSchreiben(l); return p;
  },
  profile() { return this.anfrage('GET', 'profile'); },
  neu(name, figur) { return this.anfrage('POST', 'profile', { name, figur }); },
  aendern(id, d) { return this.anfrage('PUT', 'profile/' + id, d); },
  loeschen(id) { return this.anfrage('DELETE', 'profile/' + id); },
  level(id, level, sterne) { return this.anfrage('POST', `profile/${id}/level`, { level, sterne }); },
};

function hinweis(text) {
  const d = document.createElement('div'); d.className = 'fehler-hinweis'; d.textContent = text;
  document.body.appendChild(d); setTimeout(() => d.remove(), 4000);
}

// ---------------------------------------------------------------- Zustand
const Z = {
  profile: [], profil: null,
  editId: null, editFigur: 0, editZurueck: 's-profile',
  duell: { figuren: [0, 1], sitz: 'neben' },
  modus: 'einzel', levelNr: 0, felder: [], pause: false, ende: false, laeuft: false,
  vorschau: null, letzteSekunde: null,
};

// ---------------------------------------------------------------- Navigation
function zeige(id) {
  $$('.screen').forEach(s => s.classList.toggle('aktiv', s.id === id));
  document.body.classList.toggle('im-spiel', id === 's-spiel');
  if (id !== 's-spiel') { Z.felder = []; Z.laeuft = false; }
}
$$('.zurueck').forEach(b => b.addEventListener('click', () => { Ton.spiele('klick'); zeige(b.dataset.ziel); if (b.dataset.ziel === 's-profile') zeigeProfile(); }));

// ---------------------------------------------------------------- Ton-Knöpfe
function tonKnoepfe() {
  $$('.btn-sound-x, #btn-sound').forEach(b => { b.textContent = Ton.soundAn ? '🔊' : '🔇'; b.classList.toggle('aus', !Ton.soundAn); });
  $$('.btn-musik-x, #btn-musik').forEach(b => { b.textContent = '🎵'; b.classList.toggle('aus', !Ton.musikAn); });
}
function tonUmschalten(art) {
  if (art === 'sound') Ton.setSound(!Ton.soundAn); else Ton.setMusik(!Ton.musikAn);
  tonKnoepfe(); Ton.spiele('klick');
}
$('#btn-sound').onclick = () => tonUmschalten('sound');
$('#btn-musik').onclick = () => tonUmschalten('musik');
let audioGestartet = false;
document.addEventListener('pointerdown', () => {
  if (audioGestartet) return; audioGestartet = true;
  Ton.start(); Ton.musikStart();
}, { capture: true });

// ---------------------------------------------------------------- Start
function titelbild() {
  const el = $('#titelbild');
  if (CFG.bilder && CFG.bilder.titelbild) { el.innerHTML = `<img src="${esc(CFG.bilder.titelbild)}" alt="">`; return; }
  el.innerHTML = `
  <svg viewBox="0 0 420 250" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="lv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb703"/><stop offset="1" stop-color="#e8400c"/></linearGradient></defs>
    <path d="M0 175 Q 35 160 70 175 T 140 175 T 210 175 T 280 175 T 350 175 T 420 175 V250 H0Z" fill="url(#lv)">
      <animate attributeName="d" dur="3s" repeatCount="indefinite" values="M0 175 Q 35 160 70 175 T 140 175 T 210 175 T 280 175 T 350 175 T 420 175 V250 H0Z;M0 175 Q 35 190 70 175 T 140 175 T 210 175 T 280 175 T 350 175 T 420 175 V250 H0Z;M0 175 Q 35 160 70 175 T 140 175 T 210 175 T 280 175 T 350 175 T 420 175 V250 H0Z"/></path>
    <circle cx="120" cy="215" r="7" fill="#ffe08a"><animate attributeName="r" values="2;9;2" dur="1.7s" repeatCount="indefinite"/></circle>
    <circle cx="300" cy="225" r="6" fill="#ffe08a"><animate attributeName="r" values="7;2;7" dur="2.1s" repeatCount="indefinite"/></circle>
    <rect x="22" y="128" width="120" height="56" rx="16" fill="#357468"/><rect x="22" y="112" width="120" height="34" rx="14" fill="#4e9c8e"/>
    <rect x="12" y="122" width="26" height="62" rx="12" fill="#357468"/><rect x="126" y="122" width="26" height="62" rx="12" fill="#357468"/>
    <rect x="290" y="140" width="92" height="50" rx="22" fill="#e0628a"/><rect x="290" y="134" width="92" height="48" rx="22" fill="#ff8fb1"/><circle cx="336" cy="158" r="5" fill="#e0628a"/>
    <path d="M90 110 Q 210 -20 330 128" stroke="#fff" stroke-width="5" stroke-dasharray="10 10" fill="none" opacity=".9"/>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 0" dur="1s" repeatCount="indefinite"/>
      <image href="${esc(figur(0).bild)}" x="180" y="18" width="70" height="70"/></g>
    <path d="M380 40 l7 15 16 2 -12 11 3 16 -14 -8 -14 8 3 -16 -12 -11 16 -2z" fill="#ffd23f" stroke="#d99a00" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}
$('#btn-1p').onclick = () => { Ton.spiele('klick'); zeigeProfile(); };
$('#btn-2p').onclick = () => { Ton.spiele('klick'); zeigeDuell(); };

// ---------------------------------------------------------------- Profile
async function zeigeProfile() {
  zeige('s-profile');
  try { Z.profile = await Speicher.profile(); } catch { Z.profile = []; }
  const gesamt = LV.length * 3;
  $('#profil-liste').innerHTML = Z.profile.map(p => {
    const f = figur(p.figur), st = Object.values(p.sterne || {}).reduce((a, b) => a + b, 0);
    return `<button class="profil-karte" data-id="${p.id}">
      <span class="bearbeiten" data-edit="${p.id}" role="button" aria-label="Bearbeiten">✏️</span>
      <img src="${esc(f.bild)}" style="border-color:${f.farbe}" alt="">
      <div>${esc(p.name)}</div><div class="mini">⭐ ${st} / ${gesamt}</div></button>`;
  }).join('') + `<button class="profil-karte neu" id="btn-neu"><span class="plus">＋</span>Neues Profil</button>`;
  $$('.profil-karte[data-id]').forEach(k => k.onclick = e => {
    Ton.spiele('klick');
    const p = Z.profile.find(x => x.id === k.dataset.id);
    if (e.target.dataset.edit) return zeigeEdit(p, 's-profile');
    Z.profil = p; zeigeLevel();
  });
  $('#btn-neu').onclick = () => { Ton.spiele('klick'); zeigeEdit(null, 's-profile'); };
}

function figurenWahl(el, gewaehlt, onWahl, gesperrt = -1) {
  el.innerHTML = CFG.figuren.map((f, i) => `<button class="figur-knopf ${i === gewaehlt ? 'gewaehlt' : ''}" data-i="${i}" ${i === gesperrt ? 'disabled' : ''}>
    <img src="${esc(f.bild)}" alt=""><span>${esc(f.name)}</span></button>`).join('');
  [...el.children].forEach(b => b.onclick = () => { Ton.spiele('hops'); onWahl(Number(b.dataset.i)); });
}

function zeigeEdit(p, zurueck) {
  Z.editId = p ? p.id : null; Z.editFigur = p ? p.figur : 0; Z.editZurueck = zurueck;
  $('#s-profil-edit .zurueck').dataset.ziel = zurueck;
  $('#edit-titel').textContent = p ? 'Profil ändern' : 'Neues Profil';
  $('#edit-name').value = p ? p.name : '';
  $('#btn-edit-loeschen').style.display = p ? '' : 'none';
  const male = () => figurenWahl($('#edit-figuren'), Z.editFigur, i => { Z.editFigur = i; male(); });
  male();
  zeige('s-profil-edit');
}
$('#btn-edit-ok').onclick = async () => {
  const name = $('#edit-name').value.trim();
  if (!name) { $('#edit-name').focus(); Ton.spiele('nein'); return; }
  Ton.spiele('klick');
  try {
    if (Z.editId) {
      const p = await Speicher.aendern(Z.editId, { name, figur: Z.editFigur });
      if (Z.profil && Z.profil.id === p.id) Z.profil = p;
    } else {
      Z.profil = await Speicher.neu(name, Z.editFigur);
      return zeigeLevel();
    }
  } catch (e) { hinweis('Speichern hat nicht geklappt: ' + e.message); }
  if (Z.editZurueck === 's-level') zeigeLevel(); else zeigeProfile();
};
$('#btn-edit-loeschen').onclick = async () => {
  if (!confirm('Dieses Profil mit allen Sternen wirklich löschen?')) return;
  await Speicher.loeschen(Z.editId).catch(() => {});
  zeigeProfile();
};

// ---------------------------------------------------------------- Level-Auswahl
function zeigeLevel() {
  const p = Z.profil, f = figur(p.figur);
  const st = Object.values(p.sterne || {}).reduce((a, b) => a + b, 0);
  $('#level-profil').innerHTML = `<img src="${esc(f.bild)}" style="border-color:${f.farbe}" alt=""><span>${esc(p.name)}</span><button id="btn-figur">Figur ändern</button>`;
  $('#level-sterne').innerHTML = `⭐ ${st} / ${LV.length * 3}`;
  $('#btn-figur').onclick = () => { Ton.spiele('klick'); zeigeEdit(p, 's-level'); };
  $('#level-liste').innerHTML = RAEUME.map(raum => {
    const th = THEMEN[raum.id];
    const knoepfe = LV.map((l, i) => ({ l, i })).filter(x => x.l.raum === raum.id).map(({ l, i }) => {
      const offen = i === 0 || p.sterne[i] !== undefined;
      const s = p.sterne[i + 1];
      return `<button class="level-knopf ${offen ? '' : 'zu'}" data-i="${i}" ${offen ? '' : 'disabled'}>
        <span class="nr">${offen ? i + 1 : '🔒'}</span><span class="name">${esc(l.name)}</span>
        <span class="st">${offen ? sternText(s || 0) : ''}</span></button>`;
    }).join('');
    return `<div class="raum" style="background:${th.bg}"><h3>${raum.icon} ${th.titel}</h3><div class="raum-level">${knoepfe}</div></div>`;
  }).join('');
  $$('#level-liste .level-knopf:not(.zu)').forEach(b => b.onclick = () => { Ton.spiele('klick'); starteLevel(Number(b.dataset.i), 'einzel'); });
  zeige('s-level');
}

// ---------------------------------------------------------------- Duell-Einrichtung
function zeigeDuell() {
  const male = () => {
    $$('.duell-spieler').forEach(el => {
      const sp = Number(el.dataset.sp);
      figurenWahl(el.querySelector('.figuren-wahl'), Z.duell.figuren[sp], i => { Z.duell.figuren[sp] = i; male(); }, Z.duell.figuren[1 - sp]);
    });
  };
  male();
  $$('#sitz button').forEach(b => {
    b.classList.toggle('an', b.dataset.v === Z.duell.sitz);
    b.onclick = () => { Z.duell.sitz = b.dataset.v; Ton.spiele('klick'); $$('#sitz button').forEach(x => x.classList.toggle('an', x === b)); };
  });
  $('#duell-level').innerHTML = LV.map((l, i) => `<button class="level-knopf" data-i="${i}"><span class="nr">${i + 1}</span><span class="name">${esc(l.name)}</span></button>`).join('');
  $$('#duell-level .level-knopf').forEach(b => b.onclick = () => { Ton.spiele('klick'); starteLevel(Number(b.dataset.i), 'duell'); });
  zeige('s-duell');
}

// ---------------------------------------------------------------- Spiel starten
function starteLevel(nr, modus) {
  Z.modus = modus; Z.levelNr = nr; Z.pause = false; Z.ende = false; Z.letzteSekunde = null;
  const level = LV[nr];
  const felderEl = $('#felder');
  felderEl.innerHTML = '';
  $('#hud-titel').textContent = `Level ${nr + 1} · ${level.name}`;
  zeige('s-spiel');

  const spieler = modus === 'einzel'
    ? [{ figur: figur(Z.profil.figur), name: Z.profil.name }]
    : Z.duell.figuren.map((fi, i) => ({ figur: figur(fi), name: $$('.duell-name')[i].value.trim() || `Spieler ${i + 1}` }));

  Z.felder = spieler.map((sp, i) => {
    const panel = document.createElement('div'); panel.className = 'panel';
    if (modus === 'duell') {
      panel.innerHTML = `<div class="mini-hud"><img src="${esc(sp.figur.bild)}" style="border-color:${sp.figur.farbe}" alt=""><span>${esc(sp.name)}</span><span class="hud-sterne"></span></div>`;
    }
    const wrap = document.createElement('div'); wrap.className = 'feld-wrap';
    const cv = document.createElement('canvas'); wrap.appendChild(cv); panel.appendChild(wrap);
    const gedreht = modus === 'duell' && Z.duell.sitz === 'gegen' && i === 1;
    if (gedreht) panel.classList.add('gedreht');
    const feld = new Spielfeld(cv, level, sp.figur, { duell: modus === 'duell', gedreht, onEnde: feldEnde, onStern: sternHud });
    feld.name = sp.name; feld.panel = panel;
    cv.addEventListener('pointerdown', e => { e.preventDefault(); if (!Z.pause) feld.tippen(e.clientX, e.clientY); });
    return feld;
  });
  // Reihenfolge der Felder
  const gegen = modus === 'duell' && Z.duell.sitz === 'gegen';
  (gegen ? [...Z.felder].reverse() : Z.felder).forEach(f => felderEl.appendChild(f.panel));
  $('#hud-sterne').style.display = modus === 'einzel' ? '' : 'none';
  layout();
  Z.felder.forEach(sternHud);
  Z.laeuft = true;

  if (modus === 'einzel' && level.tipp) zeigeTipp(level); else countdown();
}

function layout() {
  if (!Z.felder.length) return;
  const el = $('#felder');
  const spalte = Z.modus === 'duell' && (Z.duell.sitz === 'gegen' || window.innerHeight > window.innerWidth);
  el.classList.toggle('spalte', spalte);
  Z.felder.forEach(f => { f.cv.style.width = '0px'; f.cv.style.height = '0px'; });
  Z.felder.forEach(f => {
    const w = f.cv.parentElement;
    f.groesse(w.clientWidth - 14, w.clientHeight - 16);
  });
}
window.addEventListener('resize', () => setTimeout(layout, 50));

function sternHud(f) {
  const html = sternText(f.sterne, f.sterneGesamt);
  if (Z.modus === 'einzel') $('#hud-sterne').innerHTML = html;
  else f.panel.querySelector('.hud-sterne').innerHTML = html;
}

function countdown() {
  const el = $('#countdown');
  const schritte = ['3', '2', '1', 'Los!'];
  let i = 0;
  el.classList.add('aktiv');
  const weiter = () => {
    if (!Z.laeuft) { el.classList.remove('aktiv'); return; }
    if (i >= schritte.length) { el.classList.remove('aktiv'); el.innerHTML = ''; Z.felder.forEach(f => f.starten()); return; }
    el.innerHTML = `<span>${schritte[i]}</span>`;
    Ton.spiele(i < 3 ? 'tick' : 'hops');
    i++; setTimeout(weiter, i === schritte.length ? 450 : 650);
  };
  weiter();
}

// ---------------------------------------------------------------- Overlays
function overlay(html, knoepfe) {
  const k = $('#overlay-karte');
  k.innerHTML = html + `<div class="knopf-reihe">${knoepfe.map((b, i) => `<button class="btn ${b.klasse || ''}" data-k="${i}">${b.text}</button>`).join('')}</div>`;
  knoepfe.forEach((b, i) => k.querySelector(`[data-k="${i}"]`).onclick = () => { Ton.spiele('klick'); schliesseOverlay(); b.aktion(); });
  $('#overlay').classList.add('aktiv');
}
function schliesseOverlay() { $('#overlay').classList.remove('aktiv'); Z.vorschau = null; }

function zeigeTipp(level) {
  let vorschauHtml = '';
  if (level.tippKarte) vorschauHtml = `<div class="tipp-bild"><canvas id="tipp-cv"></canvas></div><p style="font-size:1rem;opacity:.7">Probier es hier gleich aus!</p>`;
  overlay(`<div class="gross-emoji">💡</div><h2>So geht's</h2><p>${esc(level.tipp)}</p>${vorschauHtml}`,
    [{ text: "▶ Los geht's!", klasse: 'gruen', aktion: countdown }]);
  if (level.tippKarte) {
    const cv = $('#tipp-cv');
    const mini = { raum: level.raum, zeit: 9999, karte: level.tippKarte, bretter: level.tippBretter };
    const f = new Spielfeld(cv, mini, figur(Z.profil.figur), {
      onEnde: (feld, art) => setTimeout(() => { if (Z.vorschau === feld) { const n = new Spielfeld(cv, mini, feld.figur, feld.opts); n.groesse(feld.s * mini.karte[0].length, feld.s); n.starten(); Z.vorschau = n; } }, art === 'gewonnen' ? 900 : 700),
    });
    f.groesse(Math.min(420, window.innerWidth - 100), 72);
    f.starten();
    cv.addEventListener('pointerdown', e => { e.preventDefault(); Z.vorschau && Z.vorschau.tippen(e.clientX, e.clientY); });
    Z.vorschau = f;
  }
}

function pausieren() {
  if (!Z.laeuft || Z.ende || $('#overlay').classList.contains('aktiv')) return;
  Z.pause = true;
  overlay(`<div class="gross-emoji">⏸</div><h2>Pause</h2>
    <div class="knopf-reihe" style="margin-top:6px"><button class="rund btn-sound-x" onclick="tonUmschalten('sound')"></button><button class="rund btn-musik-x" onclick="tonUmschalten('musik')"></button></div>`, [
    { text: '▶ Weiter', klasse: 'gruen', aktion: () => { Z.pause = false; } },
    { text: '↻ Neu starten', aktion: () => starteLevel(Z.levelNr, Z.modus) },
    { text: '☰ Beenden', klasse: 'weiss', aktion: zurUebersicht },
  ]);
  tonKnoepfe();
}
$('#btn-pause').onclick = () => { Ton.spiele('klick'); pausieren(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) { pausieren(); Ton.musikStop(); } else if (audioGestartet) Ton.musikStart(); });

function zurUebersicht() {
  Z.laeuft = false;
  if (Z.modus === 'einzel') zeigeLevel(); else zeigeDuell();
}

// ---------------------------------------------------------------- Ende
function feldEnde(feld, art) {
  if (Z.ende) return;
  if (Z.modus === 'einzel') {
    Z.ende = true;
    if (art === 'gewonnen') {
      Ton.spiele('sieg');
      setTimeout(() => ergebnisEinzel(feld), 700);
    } else {
      if (art === 'gefallen') setTimeout(() => Ton.spiele('verloren'), 500);
      setTimeout(() => overlay(art === 'zeit'
        ? `<div class="gross-emoji">⏰</div><h2>Zeit ist um!</h2><p>Die Lava war zu schnell. Versuch es gleich nochmal!</p>`
        : `<div class="gross-emoji">🌋</div><h2>Platsch!</h2><p>Oh nein, ab in die Lava! Aber du schaffst das!</p>`, [
        { text: '↻ Nochmal', klasse: 'gruen', aktion: () => starteLevel(Z.levelNr, 'einzel') },
        { text: '☰ Level', klasse: 'weiss', aktion: zeigeLevel },
      ]), 1100);
    }
    return;
  }
  // Duell
  if (art === 'gewonnen') {
    Z.ende = true;
    Z.felder.forEach(f => { if (f !== feld) f.status = 'vorbei'; });
    Ton.spiele('sieg');
    setTimeout(() => duellErgebnis(feld), 800);
  } else if (art === 'zeit' && Z.felder.every(f => f.status === 'zeit' || f.status === 'vorbei')) {
    Z.ende = true;
    const [a, b] = Z.felder;
    setTimeout(() => duellErgebnis(a.sterne === b.sterne ? null : (a.sterne > b.sterne ? a : b), true), 600);
  }
}

async function ergebnisEinzel(feld) {
  const nr = Z.levelNr, vorher = Z.profil.sterne[nr + 1];
  try { Z.profil = await Speicher.level(Z.profil.id, nr + 1, feld.sterne); } catch (e) { hinweis('Sterne konnten nicht gespeichert werden.'); }
  const rekord = vorher !== undefined && feld.sterne > vorher;
  const lob = ['Gut gemacht!', 'Super!', 'Spitze!', 'Perfekt!'][feld.sterne];
  const letztes = nr === LV.length - 1;
  const knoepfe = [];
  if (!letztes) knoepfe.push({ text: '▶ Weiter', klasse: 'gruen', aktion: () => starteLevel(nr + 1, 'einzel') });
  knoepfe.push({ text: '↻ Nochmal', aktion: () => starteLevel(nr, 'einzel') });
  knoepfe.push({ text: '☰ Level', klasse: 'weiss', aktion: zeigeLevel });
  overlay(`<div class="gross-emoji">${letztes ? '🏆' : '🎉'}</div><h2>${lob}</h2>
    <div class="ergebnis-sterne" id="erg-sterne">${'<span>★</span>'.repeat(3)}</div>
    <p>${feld.sterne < 3 ? `Du hast ${feld.sterne} von 3 Sternen gesammelt.` : 'Alle Sterne gesammelt!'}${rekord ? '<br><b>Neuer Rekord!</b>' : ''}</p>
    ${letztes ? '<p><b>Du hast das große Finale geschafft!</b></p>' : ''}`, knoepfe);
  [...$('#erg-sterne').children].forEach((s, i) => { if (i < feld.sterne) setTimeout(() => { s.classList.add('an'); Ton.spiele('stern'); }, 350 + i * 380); });
}

function duellErgebnis(sieger, zeitUm) {
  const html = sieger
    ? `<div class="gross-emoji">🏆</div><h2>${esc(sieger.name)} gewinnt!</h2>
       <p>${zeitUm ? 'Die Zeit ist um – mehr Sterne gesammelt!' : 'Als Erstes im Ziel!'}</p>`
    : `<div class="gross-emoji">🤝</div><h2>Unentschieden!</h2><p>Die Zeit ist um und ihr habt gleich viele Sterne.</p>`;
  const liste = Z.felder.map(f => `<p><img src="${esc(f.figur.bild)}" style="width:34px;height:34px;vertical-align:middle;border-radius:50%"> ${esc(f.name)}: <span class="st">${sternText(f.sterne)}</span></p>`).join('');
  overlay(html + liste, [
    { text: '↻ Revanche', klasse: 'gruen', aktion: () => starteLevel(Z.levelNr, 'duell') },
    { text: Z.levelNr < LV.length - 1 ? '▶ Nächstes Level' : '☰ Level', aktion: () => Z.levelNr < LV.length - 1 ? starteLevel(Z.levelNr + 1, 'duell') : zeigeDuell() },
    { text: '☰ Übersicht', klasse: 'weiss', aktion: zeigeDuell },
  ]);
}

// ---------------------------------------------------------------- Spielschleife
let letzte = performance.now();
function schleife(t) {
  const dt = Math.min(50, t - letzte); letzte = t;
  if (Z.laeuft) {
    Z.felder.forEach(f => { if (!Z.pause && !Z.vorschau) f.update(dt); f.zeichne(); });
    if (Z.felder.length) {
      const f = Z.felder[0], rest = Math.max(...Z.felder.map(x => x.zeitRest));
      const anteil = rest / (f.level.zeit * 1000);
      $('#zeit-balken').style.width = (anteil * 100).toFixed(1) + '%';
      $('#zeit-balken').classList.toggle('knapp', rest < 10000);
      const sek = Math.ceil(rest / 1000);
      $('#zeit-text').textContent = `🔥 ${sek} s`;
      if (sek !== Z.letzteSekunde) {
        if (sek <= 5 && sek > 0 && Z.felder.some(x => x.status === 'spielt') && !Z.pause) Ton.spiele('tick');
        Z.letzteSekunde = sek;
      }
    }
  }
  if (Z.vorschau) { Z.vorschau.update(dt); Z.vorschau.zeichne(); }
  requestAnimationFrame(schleife);
}

// ---------------------------------------------------------------- Los!
$('#spiel-titel').textContent = CFG.titel || 'Der Boden ist Lava!';
document.title = CFG.titel || document.title;
titelbild(); tonKnoepfe();
requestAnimationFrame(schleife);
window.__spiel = Z; // zum Testen
