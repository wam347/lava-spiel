// Geräusche und Musik – alles mit dem Web-Audio-API erzeugt (keine Dateien nötig)
const Ton = (() => {
  let ctx = null, master = null, musikGain = null;
  let soundAn = lade('lava_sound', true), musikAn = lade('lava_musik', true);
  let musikTimer = null, schritt = 0, naechsteZeit = 0, audioEl = null;

  function lade(k, std) { try { const v = localStorage.getItem(k); return v === null ? std : v === '1'; } catch { return std; } }
  function merke(k, v) { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* egal */ } }

  function start() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musikGain = ctx.createGain(); musikGain.gain.value = 0.16; musikGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function ton(freq, dauer, { typ = 'sine', vol = 0.4, bis = null, verz = 0, ziel = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + verz;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = typ; o.frequency.setValueAtTime(freq, t);
    if (bis) o.frequency.exponentialRampToValueAtTime(bis, t + dauer);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
    o.connect(g); g.connect(ziel || master);
    o.start(t); o.stop(t + dauer + 0.05);
  }
  function rauschen(dauer, vol = 0.3, filterFreq = 800) {
    if (!ctx) return;
    const n = Math.floor(ctx.sampleRate * dauer);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }

  const fx = {
    hops()   { ton(320, 0.16, { typ: 'square', vol: 0.18, bis: 720 }); },
    weit()   { ton(220, 0.3, { typ: 'square', vol: 0.18, bis: 880 }); ton(440, 0.25, { typ: 'sine', vol: 0.15, bis: 1200, verz: 0.05 }); },
    lande()  { ton(180, 0.08, { typ: 'triangle', vol: 0.3, bis: 90 }); },
    stern()  { [880, 1175, 1568].forEach((f, i) => ton(f, 0.22, { typ: 'triangle', vol: 0.25, verz: i * 0.07 })); },
    wackel() { ton(140, 0.25, { typ: 'sine', vol: 0.2, bis: 90 }); },
    blub()   { ton(300, 0.12, { vol: 0.25, bis: 120 }); ton(420, 0.1, { vol: 0.18, bis: 160, verz: 0.1 }); },
    platsch(){ rauschen(0.6, 0.45, 900); ton(400, 0.5, { typ: 'sawtooth', vol: 0.12, bis: 60 }); },
    nein()   { ton(160, 0.1, { typ: 'square', vol: 0.08 }); },
    klick()  { ton(660, 0.05, { typ: 'triangle', vol: 0.15 }); },
    sieg()   { [523, 659, 784, 1047].forEach((f, i) => ton(f, i === 3 ? 0.5 : 0.18, { typ: 'square', vol: 0.15, verz: i * 0.13 })); },
    verloren(){ [392, 330, 262, 196].forEach((f, i) => ton(f, 0.25, { typ: 'triangle', vol: 0.2, verz: i * 0.18 })); },
    tick()   { ton(1000, 0.04, { typ: 'square', vol: 0.06 }); },
  };

  function spiele(name) { if (!soundAn) return; start(); fx[name] && fx[name](); }

  // ---------- Hintergrundmusik: fröhliche Schleife ----------
  const N = f => f ? 440 * Math.pow(2, (f - 69) / 12) : 0;
  // Melodie (MIDI-Noten, 0 = Pause), 8tel
  const mel = [72,0,76,79, 81,79,76,72, 74,0,77,81, 79,0,0,0,  72,0,76,79, 84,83,81,79, 77,76,74,76, 72,0,0,0];
  const bass = [48,55,52,55, 53,60,57,60, 50,57,53,57, 55,62,59,62];
  const TEMPO = 0.2;

  function planen() {
    while (naechsteZeit < ctx.currentTime + 0.3) {
      const m = mel[schritt % mel.length];
      if (m) ton(N(m), TEMPO * 0.9, { typ: 'triangle', vol: 0.5, ziel: musikGain, verz: naechsteZeit - ctx.currentTime });
      if (schritt % 2 === 0) ton(N(bass[(schritt / 2) % bass.length]), TEMPO * 1.6, { typ: 'sine', vol: 0.6, ziel: musikGain, verz: naechsteZeit - ctx.currentTime });
      naechsteZeit += TEMPO; schritt++;
    }
  }
  function musikStart() {
    if (!musikAn) return;
    const eigene = window.SPIEL_CONFIG && SPIEL_CONFIG.musik;
    if (eigene) {
      if (!audioEl) { audioEl = new Audio(eigene); audioEl.loop = true; audioEl.volume = 0.35; }
      audioEl.play().catch(() => {});
      return;
    }
    start(); if (!ctx || musikTimer) return;
    naechsteZeit = ctx.currentTime + 0.1;
    musikTimer = setInterval(planen, 100);
  }
  function musikStop() {
    if (audioEl) audioEl.pause();
    if (musikTimer) { clearInterval(musikTimer); musikTimer = null; }
  }

  return {
    start, spiele, musikStart, musikStop,
    get soundAn() { return soundAn; }, get musikAn() { return musikAn; },
    setSound(v) { soundAn = v; merke('lava_sound', v); },
    setMusik(v) { musikAn = v; merke('lava_musik', v); v ? musikStart() : musikStop(); },
  };
})();
