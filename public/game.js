// =====================================================================
//  Spielfeld: Logik + Zeichnen für ein Level (ein Brett pro Spieler)
// =====================================================================
const THEMEN = {
  wohnzimmer:   { titel: 'Wohnzimmer',   bg: '#fde3c4', moebel: ['#4e9c8e', '#357468'], deko: 'sofa' },
  kinderzimmer: { titel: 'Kinderzimmer', bg: '#e9e1fb', moebel: ['#7b8ff0', '#5165c7'], deko: 'kiste' },
  garten:       { titel: 'Garten',       bg: '#d8f0cb', moebel: ['#a9784a', '#7b532f'], deko: 'stumpf' },
  spielplatz:   { titel: 'Spielplatz',   bg: '#fff0b3', moebel: ['#4fb3dd', '#2f86ad'], deko: 'planke' },
};
const KISSEN_FARBEN = [['#ff8fb1', '#e0628a'], ['#ffd45c', '#e3ae25'], ['#8fe0c2', '#4fb895'], ['#9ec5ff', '#6a98e0']];

const BILD_CACHE = {};
function bild(src) {
  if (!src) return null;
  if (!BILD_CACHE[src]) { const i = new Image(); i.src = src; BILD_CACHE[src] = i; }
  const i = BILD_CACHE[src];
  return i.complete && i.naturalWidth > 0 ? i : null;
}
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function sternPfad(ctx, cx, cy, R, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

class Spielfeld {
  constructor(canvas, level, figur, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.level = level; this.figur = figur; this.opts = opts;
    this.thema = THEMEN[level.raum] || THEMEN.wohnzimmer;
    this.gedreht = !!opts.gedreht;
    this.zeilen = level.karte.length; this.spalten = level.karte[0].length;
    this.zellen = level.karte.map((z, r) => [...z].map((ch, c) => {
      const typ = { '.': 'lava', '#': 'fest', '*': 'fest', 'K': 'kissen', '+': 'kissen', 'T': 'tramp', 'S': 'start', 'Z': 'ziel' }[ch] || 'lava';
      if (ch === 'S') this.start = { r, c };
      return { typ, stern: ch === '*' || ch === '+', farbe: KISSEN_FARBEN[(r * 3 + c) % KISSEN_FARBEN.length], sinkt: -1, unten: -1 };
    }));
    this.bretter = (level.bretter || []).map(b => ({ r: b.zeile, von: b.von, bis: b.bis, c: b.start ?? b.von, vorC: b.start ?? b.von, dir: 1, takt: b.takt || 1000, acc: 0, mt: 1 }));
    this.sterneGesamt = this.zellen.flat().filter(z => z.stern).length;
    this.sterne = 0;
    this.spieler = { r: this.start.r, c: this.start.c, vonR: this.start.r, vonC: this.start.c, t: 1, dauer: 280, brett: -1, weit: false };
    this.zeitRest = level.zeit * 1000;
    this.status = 'bereit'; // bereit | spielt | gewonnen | gefallen | zeit
    this.zeit = 0; this.partikel = []; this.blasen = [];
    this.platschT = -1; this.trampHops = -1;
    this.flecken = Array.from({ length: 18 }, () => ({ x: Math.random(), y: Math.random(), r: 0.08 + Math.random() * 0.12, p: Math.random() * 6.28, v: 0.3 + Math.random() * 0.5 }));
    this.s = 40; this.dpr = 1;
  }

  // ------------------------------------------------ Größe
  groesse(maxW, maxH) {
    this.s = Math.max(20, Math.floor(Math.min(maxW / this.spalten, maxH / this.zeilen)));
    const w = this.s * this.spalten, h = this.s * this.zeilen;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = w * this.dpr; this.cv.height = h * this.dpr;
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
  }

  // ------------------------------------------------ Regeln
  brettAuf(r, c) { return this.bretter.findIndex(b => b.r === r && b.c === c); }
  sicher(r, c) {
    if (r < 0 || c < 0 || r >= this.zeilen || c >= this.spalten) return false;
    if (this.brettAuf(r, c) >= 0) return true;
    const z = this.zellen[r][c];
    if (z.typ === 'lava') return false;
    if (z.typ === 'kissen' && z.unten >= 0) return false;
    return true;
  }
  aufTrampolin() {
    const p = this.spieler;
    return p.brett < 0 && this.zellen[p.r][p.c].typ === 'tramp';
  }
  erreichbar() {
    const p = this.spieler, out = [];
    if (this.status !== 'spielt' || p.t < 1) return out;
    const d = this.aufTrampolin() ? 2 : 1;
    for (let r = p.r - d; r <= p.r + d; r++) for (let c = p.c - d; c <= p.c + d; c++) {
      if (r === p.r && c === p.c) continue;
      if (this.sicher(r, c)) out.push({ r, c, weit: Math.max(Math.abs(r - p.r), Math.abs(c - p.c)) > 1 });
    }
    return out;
  }
  starten() { if (this.status === 'bereit') this.status = 'spielt'; }

  tippen(clientX, clientY) {
    const rect = this.cv.getBoundingClientRect();
    let x = clientX - rect.left, y = clientY - rect.top;
    if (this.gedreht) { x = rect.width - x; y = rect.height - y; }
    const c = Math.floor(x / (rect.width / this.spalten)), r = Math.floor(y / (rect.height / this.zeilen));
    if (this.status !== 'spielt' || this.spieler.t < 1) return;
    const ziel = this.erreichbar().find(e => e.r === r && e.c === c);
    if (!ziel) { if (r !== this.spieler.r || c !== this.spieler.c) Ton.spiele('nein'); return; }
    this.springe(r, c, ziel.weit);
  }

  springe(r, c, weit) {
    const p = this.spieler;
    const pos = this.spielerPos();
    p.vonX = pos.x; p.vonY = pos.y;
    if (this.aufTrampolin()) this.trampHops = 0;
    p.r = r; p.c = c; p.t = 0; p.weit = weit; p.dauer = weit ? 420 : 280;
    p.brett = this.brettAuf(r, c);
    Ton.spiele(weit ? 'weit' : 'hops');
  }

  landen() {
    const p = this.spieler;
    if (p.brett >= 0) { Ton.spiele('lande'); return; }
    if (!this.sicher(p.r, p.c)) return this.reinfallen();
    const z = this.zellen[p.r][p.c];
    Ton.spiele('lande');
    this.staub(p.r, p.c);
    if (z.stern) {
      z.stern = false; this.sterne++;
      Ton.spiele('stern'); this.funkeln(p.r, p.c);
      this.opts.onStern && this.opts.onStern(this);
    }
    if (z.typ === 'kissen' && z.sinkt < 0) { z.sinkt = 0; Ton.spiele('wackel'); }
    if (z.typ === 'ziel') {
      this.status = 'gewonnen'; this.funkeln(p.r, p.c, 30);
      this.opts.onEnde && this.opts.onEnde(this, 'gewonnen');
    }
  }

  reinfallen() {
    const p = this.spieler;
    Ton.spiele('platsch');
    this.spritzer(p.r, p.c);
    this.platschT = 0;
    if (this.opts.duell) {
      this.status = 'platsch';
    } else {
      this.status = 'gefallen';
      this.opts.onEnde && this.opts.onEnde(this, 'gefallen');
    }
  }

  // ------------------------------------------------ Update
  update(dt) {
    this.zeit += dt;
    const cfg = window.SPIEL_CONFIG || {};
    const p = this.spieler;

    if (this.status === 'spielt') {
      this.zeitRest -= dt;
      if (this.zeitRest <= 0) {
        this.zeitRest = 0; this.status = 'zeit'; Ton.spiele('verloren');
        this.opts.onEnde && this.opts.onEnde(this, 'zeit');
      }
    }
    if (this.status === 'platsch') {
      this.platschT += dt;
      if (this.platschT > 1100) { // im Duell: zurück zum Start
        p.r = this.start.r; p.c = this.start.c; p.t = 1; p.brett = -1;
        this.platschT = -1; this.status = 'spielt';
      }
    } else if (this.platschT >= 0) this.platschT += dt;

    const aktiv = ['spielt', 'platsch'].includes(this.status);
    if (aktiv || this.status === 'bereit') {
      // Rollbretter bewegen
      this.bretter.forEach((b, i) => {
        b.mt = Math.min(1, b.mt + dt / 300);
        if (this.status === 'bereit') return;
        b.acc += dt;
        if (b.acc >= b.takt) {
          b.acc -= b.takt; b.vorC = b.c;
          if (b.c + b.dir > b.bis || b.c + b.dir < b.von) b.dir *= -1;
          b.c += b.dir; b.mt = 0;
          if (p.brett === i) p.c = b.c;
        }
      });
      // Kissen
      const kz = cfg.kissenZeit || 1800, kw = cfg.kissenWiederDa || 3000;
      this.zellen.forEach((zeile, r) => zeile.forEach((z, c) => {
        if (z.typ !== 'kissen') return;
        if (z.sinkt >= 0) {
          z.sinkt += dt;
          if (z.sinkt >= kz) {
            z.sinkt = -1; z.unten = 0; Ton.spiele('blub'); this.spritzer(r, c, 8);
            if (this.status === 'spielt' && p.brett < 0 && p.r === r && p.c === c && p.t >= 1) this.reinfallen();
          }
        } else if (z.unten >= 0) {
          z.unten += dt;
          if (z.unten >= kw) z.unten = -1;
        }
      }));
    }
    // Sprung
    if (p.t < 1) {
      p.t = Math.min(1, p.t + dt / p.dauer);
      if (p.t >= 1 && this.status === 'spielt') this.landen();
    }
    if (this.trampHops >= 0) { this.trampHops += dt; if (this.trampHops > 400) this.trampHops = -1; }

    // Lava-Blasen
    if (Math.random() < dt / 260) {
      const r = Math.floor(Math.random() * this.zeilen), c = Math.floor(Math.random() * this.spalten);
      if (this.zellen[r][c].typ === 'lava' && this.brettAuf(r, c) < 0)
        this.blasen.push({ x: c + 0.2 + Math.random() * 0.6, y: r + 0.2 + Math.random() * 0.6, t: 0, max: 0.08 + Math.random() * 0.1 });
    }
    this.blasen.forEach(b => b.t += dt / 1200);
    this.blasen = this.blasen.filter(b => b.t < 1);
    this.partikel.forEach(q => { q.x += q.vx * dt / 1000; q.y += q.vy * dt / 1000; q.vy += (q.g || 0) * dt / 1000; q.life -= dt; });
    this.partikel = this.partikel.filter(q => q.life > 0);
  }

  // ------------------------------------------------ Effekte
  mitte(r, c) { return { x: (c + 0.5), y: (r + 0.5) }; }
  funkeln(r, c, n = 16) {
    const m = this.mitte(r, c);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, v = 1 + Math.random() * 2.5;
      this.partikel.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 2, life: 700, max: 700, farbe: ['#ffd23f', '#fff', '#ffb703'][i % 3], gr: 0.07, stern: true });
    }
  }
  staub(r, c) {
    const m = this.mitte(r, c);
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * 6.28;
      this.partikel.push({ x: m.x, y: m.y + 0.2, vx: Math.cos(a) * 0.8, vy: Math.sin(a) * 0.4, life: 350, max: 350, farbe: 'rgba(255,255,255,.8)', gr: 0.05 });
    }
  }
  spritzer(r, c, n = 22) {
    const m = this.mitte(r, c);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * Math.random(), v = 1.5 + Math.random() * 3;
      this.partikel.push({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 9, life: 800, max: 800, farbe: ['#ff7b00', '#ffd000', '#ff3d00'][i % 3], gr: 0.06 + Math.random() * 0.05 });
    }
  }

  spielerPos() {
    const p = this.spieler, s = 1;
    let zx, zy;
    if (p.brett >= 0) { const b = this.bretter[p.brett]; zx = (b.vorC + (b.c - b.vorC) * easeInOut(b.mt)) + 0.5; zy = b.r + 0.5; }
    else { zx = p.c + 0.5; zy = p.r + 0.5; }
    if (p.t >= 1) return { x: zx * s, y: zy * s, h: 0 };
    const t = easeOut(p.t);
    return { x: p.vonX + (zx - p.vonX) * t, y: p.vonY + (zy - p.vonY) * t, h: Math.sin(Math.PI * p.t) * (p.weit ? 0.9 : 0.5) };
  }

  // ------------------------------------------------ Zeichnen
  zeichne() {
    const ctx = this.ctx, s = this.s, cfg = window.SPIEL_CONFIG || {}, B = cfg.bilder || {};
    const W = this.spalten * s, H = this.zeilen * s, T = this.zeit / 1000;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Lava
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ff7a1a'); g.addColorStop(0.5, '#f2481b'); g.addColorStop(1, '#ff6a00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    this.flecken.forEach(f => {
      const x = (f.x + Math.sin(T * f.v * 0.4 + f.p) * 0.05) * W, y = (f.y + Math.cos(T * f.v * 0.3 + f.p) * 0.05) * H;
      const rr = f.r * Math.min(W, H) * (1 + Math.sin(T * f.v + f.p) * 0.15);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, rr);
      rg.addColorStop(0, 'rgba(255,214,90,.55)'); rg.addColorStop(1, 'rgba(255,214,90,0)');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.29); ctx.fill();
    });
    this.blasen.forEach(b => {
      const rr = b.max * s * Math.sin(b.t * Math.PI) + 1;
      ctx.strokeStyle = `rgba(255,236,150,${0.8 * (1 - b.t)})`; ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.fillStyle = `rgba(255,190,60,${0.5 * (1 - b.t)})`;
      ctx.beginPath(); ctx.arc(b.x * s, b.y * s, rr, 0, 6.29); ctx.fill(); ctx.stroke();
    });

    // Felder
    const erreich = this.erreichbar();
    for (let r = 0; r < this.zeilen; r++) for (let c = 0; c < this.spalten; c++) this.zeichneZelle(r, c, B, T);
    // Rollbretter
    this.bretter.forEach(b => {
      const x = (b.vorC + (b.c - b.vorC) * easeInOut(b.mt)) * s, y = b.r * s;
      this.zeichneBrett(x, y, B);
    });
    // Sterne
    for (let r = 0; r < this.zeilen; r++) for (let c = 0; c < this.spalten; c++) {
      const z = this.zellen[r][c];
      if (!z.stern) continue;
      let sk = 1;
      if (z.typ === 'kissen' && z.sinkt >= 0) sk = 1 - z.sinkt / (cfg.kissenZeit || 1800) * 0.35;
      if (z.typ === 'kissen' && z.unten >= 0) continue;
      const bob = Math.sin(T * 3 + r + c) * s * 0.04;
      this.zeichneStern((c + 0.5) * s, (r + 0.5) * s + bob, s * 0.3 * sk, B);
    }
    // erreichbare Felder markieren
    const puls = 0.55 + Math.sin(T * 6) * 0.35;
    const fc = this.figur.farbe || '#fff';
    erreich.forEach(e => {
      let x = e.c * s, y = e.r * s;
      const bi = this.brettAuf(e.r, e.c);
      if (bi >= 0) { const b = this.bretter[bi]; x = (b.vorC + (b.c - b.vorC) * easeInOut(b.mt)) * s; }
      ctx.save();
      ctx.globalAlpha = puls; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(3, s * 0.07);
      ctx.setLineDash(e.weit ? [s * 0.12, s * 0.09] : []);
      rrect(ctx, x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.88, s * 0.18); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = puls * 0.9; ctx.fillStyle = fc;
      ctx.beginPath(); ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.07, 0, 6.29); ctx.fill();
      ctx.restore();
    });

    // Spieler
    this.zeichneSpieler();

    // Warnring um sinkende Kissen (zeigt, wie viel Zeit noch bleibt)
    const kz = cfg.kissenZeit || 1800;
    for (let r = 0; r < this.zeilen; r++) for (let c = 0; c < this.spalten; c++) {
      const z = this.zellen[r][c];
      if (z.typ !== 'kissen' || z.sinkt < 0) continue;
      const rest = 1 - z.sinkt / kz;
      ctx.save();
      ctx.lineWidth = Math.max(4, s * 0.08); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc((c + 0.5) * s, (r + 0.5) * s, s * 0.47, 0, 6.29); ctx.stroke();
      ctx.strokeStyle = rest > 0.5 ? '#ffd23f' : '#e01e1e';
      ctx.beginPath(); ctx.arc((c + 0.5) * s, (r + 0.5) * s, s * 0.47, -Math.PI / 2, -Math.PI / 2 + rest * Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // Partikel
    this.partikel.forEach(q => {
      const a = Math.max(0, q.life / q.max);
      ctx.globalAlpha = a; ctx.fillStyle = q.farbe;
      if (q.stern) { sternPfad(ctx, q.x * s, q.y * s, q.gr * s, q.gr * s * 0.45); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(q.x * s, q.y * s, q.gr * s, 0, 6.29); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }

  zeichneZelle(r, c, B, T) {
    const ctx = this.ctx, s = this.s, z = this.zellen[r][c], x = c * s, y = r * s;
    const pad = s * 0.07, w = s - pad * 2;
    if (z.typ === 'lava') return;
    // Schatten / Glut
    ctx.fillStyle = 'rgba(120,20,0,.35)';
    rrect(ctx, x + pad + s * 0.03, y + pad + s * 0.06, w, w, s * 0.16); ctx.fill();

    if (z.typ === 'fest' || z.typ === 'start') {
      const img = bild((B.moebel || {})[this.level.raum]);
      if (z.typ === 'fest' && img) { ctx.drawImage(img, x + pad, y + pad, w, w); return; }
      const [hell, dunkel] = z.typ === 'start' ? ['#7cc4f2', '#4a95c6'] : this.thema.moebel;
      const deko = z.typ === 'start' ? 'start' : this.thema.deko;
      if (deko === 'stumpf') {
        ctx.fillStyle = dunkel; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2 + s * 0.03, w / 2, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#e9c38b'; ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, w / 2 - s * 0.06, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#c99a5e'; ctx.lineWidth = Math.max(1.5, s * 0.03);
        [0.28, 0.18, 0.08].forEach(k => { ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * k, 0, 6.29); ctx.stroke(); });
        return;
      }
      ctx.fillStyle = dunkel; rrect(ctx, x + pad, y + pad + s * 0.04, w, w - s * 0.04, s * 0.16); ctx.fill();
      ctx.fillStyle = hell; rrect(ctx, x + pad, y + pad, w, w - s * 0.06, s * 0.16); ctx.fill();
      ctx.strokeStyle = dunkel; ctx.lineWidth = Math.max(1.5, s * 0.035);
      if (deko === 'sofa') {
        ctx.fillStyle = dunkel; rrect(ctx, x + pad, y + pad, w, w * 0.28, s * 0.14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + s / 2, y + pad + w * 0.35); ctx.lineTo(x + s / 2, y + pad + w * 0.85); ctx.stroke();
      } else if (deko === 'kiste') {
        ctx.beginPath(); ctx.moveTo(x + pad, y + pad + w * 0.3); ctx.lineTo(x + pad + w, y + pad + w * 0.3); ctx.stroke();
        ctx.fillStyle = '#fff3'; sternPfad(ctx, x + s / 2, y + pad + w * 0.62, s * 0.14, s * 0.06); ctx.fill();
      } else if (deko === 'planke') {
        for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + pad, y + pad + w * i / 3); ctx.lineTo(x + pad + w, y + pad + w * i / 3); ctx.stroke(); }
        ctx.fillStyle = dunkel;
        [[0.15, 0.15], [0.85, 0.15], [0.15, 0.82], [0.85, 0.82]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + pad + w * a, y + pad + w * b, s * 0.025, 0, 6.29); ctx.fill(); });
      } else if (deko === 'start') {
        ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.floor(s * 0.2)}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('START', x + s / 2, y + s * 0.78);
      }
      return;
    }
    if (z.typ === 'ziel') {
      const img = bild(B.ziel);
      const glow = 0.5 + Math.sin(T * 4) * 0.3;
      ctx.save(); ctx.shadowColor = `rgba(255,230,80,${glow})`; ctx.shadowBlur = s * 0.4;
      ctx.fillStyle = '#ffe066'; rrect(ctx, x + pad, y + pad, w, w, s * 0.16); ctx.fill(); ctx.restore();
      if (img) { ctx.drawImage(img, x + pad, y + pad, w, w); return; }
      // Karo-Fahne
      const fx = x + s * 0.32, fy = y + s * 0.18, fw = s * 0.42, fh = s * 0.3, n = 4;
      for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#222' : '#fff';
        const wav = Math.sin(T * 6 + i) * s * 0.015;
        ctx.fillRect(fx + i * fw / n, fy + j * fh / 3 + wav, fw / n + 0.5, fh / 3 + 0.5);
      }
      ctx.fillStyle = '#7a4b1e'; ctx.fillRect(fx - s * 0.04, fy, s * 0.04, s * 0.62);
      ctx.fillStyle = '#b8860b'; ctx.font = `bold ${Math.floor(s * 0.18)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ZIEL', x + s * 0.62, y + s * 0.78);
      return;
    }
    if (z.typ === 'tramp') {
      const img = bild(B.trampolin);
      const k = this.trampHops >= 0 && this.spieler.vonX !== undefined && Math.floor(this.spieler.vonX) === c && Math.floor(this.spieler.vonY) === r
        ? 1 - Math.sin(this.trampHops / 400 * Math.PI) * 0.12 : 1;
      if (img) { ctx.drawImage(img, x + pad, y + pad, w, w); return; }
      const cx = x + s / 2, cy = y + s / 2;
      ctx.fillStyle = '#3d7be0'; ctx.beginPath(); ctx.arc(cx, cy, w / 2, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#1e2a44'; ctx.beginPath(); ctx.arc(cx, cy, (w / 2 - s * 0.08) * k, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (w / 2 - s * 0.04), cy + Math.sin(a) * (w / 2 - s * 0.04), s * 0.025, 0, 6.29); ctx.fill(); }
      ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.14 * k, 0, 6.29); ctx.stroke();
      return;
    }
    if (z.typ === 'kissen') {
      const cfg = window.SPIEL_CONFIG || {};
      if (z.unten >= 0) {
        // versunken: Ring + ggf. Vorschau, dass es gleich wiederkommt
        const kw = cfg.kissenWiederDa || 3000;
        ctx.strokeStyle = 'rgba(255,230,160,.6)'; ctx.lineWidth = Math.max(2, s * 0.04);
        ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.25 + Math.sin(T * 5) * s * 0.03, 0, 6.29); ctx.stroke();
        if (z.unten > kw - 700) { ctx.globalAlpha = (z.unten - (kw - 700)) / 700 * 0.6; this.kissenForm(x, y, z, 1, B); ctx.globalAlpha = 1; }
        return;
      }
      let sk = 1, dx = 0;
      if (z.sinkt >= 0) {
        const t = z.sinkt / (cfg.kissenZeit || 1800);
        sk = 1 - t * 0.35; dx = Math.sin(T * 40) * s * 0.03 * (0.4 + t);
      }
      ctx.save(); ctx.translate(dx, 0); this.kissenForm(x, y, z, sk, B);
      if (z.sinkt >= 0) {
        const t = z.sinkt / (cfg.kissenZeit || 1800);
        ctx.fillStyle = `rgba(255,60,0,${t * 0.45})`; const ww = w * sk;
        rrect(ctx, x + (s - ww) / 2, y + (s - ww) / 2, ww, ww, s * 0.22); ctx.fill();
      }
      ctx.restore();
    }
  }

  kissenForm(x, y, z, sk, B) {
    const ctx = this.ctx, s = this.s, w = (s - s * 0.14) * sk, ox = x + (s - w) / 2, oy = y + (s - w) / 2;
    const img = bild(B.kissen);
    if (img) { ctx.drawImage(img, ox, oy, w, w); return; }
    const [hell, dunkel] = z.farbe;
    ctx.fillStyle = dunkel; rrect(ctx, ox, oy + s * 0.03, w, w, s * 0.24 * sk); ctx.fill();
    ctx.fillStyle = hell; rrect(ctx, ox, oy, w, w - s * 0.03, s * 0.24 * sk); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; rrect(ctx, ox + w * 0.14, oy + w * 0.1, w * 0.45, w * 0.18, w * 0.09); ctx.fill();
    ctx.fillStyle = dunkel; ctx.beginPath(); ctx.arc(ox + w / 2, oy + w / 2, s * 0.045 * sk, 0, 6.29); ctx.fill();
  }

  zeichneBrett(x, y, B) {
    const ctx = this.ctx, s = this.s, img = bild(B.brett);
    if (img) { ctx.drawImage(img, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9); return; }
    ctx.fillStyle = 'rgba(120,20,0,.35)'; rrect(ctx, x + s * 0.08, y + s * 0.28, s * 0.86, s * 0.5, s * 0.2); ctx.fill();
    ctx.fillStyle = '#333';
    [[0.22, 0.22], [0.78, 0.22], [0.22, 0.74], [0.78, 0.74]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + s * a, y + s * b, s * 0.07, 0, 6.29); ctx.fill(); });
    ctx.fillStyle = '#c98a4b'; rrect(ctx, x + s * 0.06, y + s * 0.24, s * 0.88, s * 0.48, s * 0.22); ctx.fill();
    ctx.fillStyle = '#e8b06e'; rrect(ctx, x + s * 0.12, y + s * 0.28, s * 0.76, s * 0.12, s * 0.06); ctx.fill();
    ctx.fillStyle = '#7a4b1e'; ctx.font = `bold ${Math.floor(s * 0.2)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⇄', x + s / 2, y + s * 0.55);
  }

  zeichneStern(cx, cy, R, B) {
    const ctx = this.ctx, img = bild(B.stern);
    if (img) { ctx.drawImage(img, cx - R, cy - R, R * 2, R * 2); return; }
    ctx.save(); ctx.shadowColor = 'rgba(255,220,60,.9)'; ctx.shadowBlur = R * 0.8;
    ctx.fillStyle = '#ffd23f'; sternPfad(ctx, cx, cy, R, R * 0.45); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#d99a00'; ctx.lineWidth = Math.max(1.5, R * 0.12); ctx.lineJoin = 'round';
    sternPfad(ctx, cx, cy, R, R * 0.45); ctx.stroke();
  }

  zeichneSpieler() {
    const ctx = this.ctx, s = this.s, p = this.spieler;
    if (this.platschT >= 0 && this.status !== 'spielt') {
      // untergehen
      const t = Math.min(1, this.platschT / 600), pos = this.spielerPos();
      if (t >= 1) return;
      ctx.save(); ctx.globalAlpha = 1 - t;
      this.figurBild(pos.x * s, pos.y * s + t * s * 0.2, s * 0.78 * (1 - t * 0.6));
      ctx.restore(); return;
    }
    const pos = this.spielerPos();
    const gr = s * 0.78 * (1 + pos.h * 0.3);
    // Schatten
    ctx.fillStyle = `rgba(60,10,0,${0.35 - pos.h * 0.15})`;
    ctx.beginPath(); ctx.ellipse(pos.x * s, pos.y * s + s * 0.28, s * 0.3 * (1 - pos.h * 0.3), s * 0.1 * (1 - pos.h * 0.3), 0, 0, 6.29); ctx.fill();
    // Wackeln auf sinkendem Kissen
    let dx = 0;
    if (p.t >= 1 && p.brett < 0) { const z = this.zellen[p.r][p.c]; if (z.typ === 'kissen' && z.sinkt >= 0) dx = Math.sin(this.zeit / 25) * s * 0.03; }
    const hop = p.t >= 1 ? Math.abs(Math.sin(this.zeit / 300)) * s * 0.03 : 0;
    this.figurBild(pos.x * s + dx, pos.y * s - pos.h * s - hop, gr);
  }

  figurBild(cx, cy, gr) {
    const ctx = this.ctx, f = this.figur, img = bild(f.bild);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, gr / 2 + 2, 0, 6.29); ctx.fill();
    ctx.strokeStyle = f.farbe || '#333'; ctx.lineWidth = Math.max(2.5, gr * 0.06);
    if (img) {
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, gr / 2, 0, 6.29); ctx.clip();
      ctx.drawImage(img, cx - gr / 2, cy - gr / 2, gr, gr); ctx.restore();
    } else {
      ctx.fillStyle = f.farbe || '#888'; ctx.beginPath(); ctx.arc(cx, cy, gr / 2, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.floor(gr * 0.5)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText((f.name || '?')[0], cx, cy);
    }
    ctx.beginPath(); ctx.arc(cx, cy, gr / 2, 0, 6.29); ctx.stroke();
  }
}
