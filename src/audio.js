// Heart sounds synthesised with Web Audio (no sound files).
// S1 "lub" = AV valves shutting (longer, lower); S2 "dub" = semilunar valves shutting (shorter, higher).
// Variants: a = sine thump, b = filtered noise thud, c = both layered.
// d, e, f = real recordings (one lub and one dub cut from each; credits in README / audio/CREDITS.md).
export const RECORDED = { d: 'audio/d', e: 'audio/e', f: 'audio/f' };
const S1 = { freq: 55, dur: 0.18 }, S2 = { freq: 75, dur: 0.11 };

export function createAudio(variant = 'a') {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { s1() {}, s2() {}, setFlow() {}, resume() {}, update() {} };
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);

  const noiseBuf = (() => {
    const len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise
    return b;
  })();

  function sine({ freq, dur }, at, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.2, at); o.frequency.exponentialRampToValueAtTime(freq, at + dur * 0.5);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
  }
  function thud({ freq, dur }, at, vol) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = freq * 3.2; f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol * 2.2, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur * 1.2);
    src.connect(f).connect(g).connect(master); src.start(at, Math.random()); src.stop(at + dur * 1.3);
  }
  // Recorded variants: fetch and decode the two clips once.
  const clips = {};
  if (RECORDED[variant]) {
    for (const k of ['s1', 's2']) {
      fetch(new URL('../' + RECORDED[variant] + '-' + k + '.wav', import.meta.url))
        .then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { clips[k] = buf; }).catch(() => {});
    }
  }
  function clip(k, at) {
    if (!clips[k]) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = clips[k]; g.gain.value = 1.0; src.connect(g).connect(master); src.start(at);
    return true;
  }
  function play(spec, at = ctx.currentTime + 0.01) {
    if (RECORDED[variant]) { if (clip(spec === S1 ? 's1' : 's2', at)) return; }
    if (variant === 'a') sine(spec, at, 0.9);
    else if (variant === 'b') thud(spec, at, 0.9);
    else { sine(spec, at, 0.6); thud(spec, at, 0.6); }
  }

  // Ambient flow: brown noise through a low-pass, louder when the current around you is strong.
  const flowSrc = ctx.createBufferSource(), flowF = ctx.createBiquadFilter(), flowG = ctx.createGain();
  flowSrc.buffer = noiseBuf; flowSrc.loop = true; flowF.type = 'lowpass'; flowF.frequency.value = 380; flowG.gain.value = 0;
  flowSrc.connect(flowF).connect(flowG).connect(master);
  let flowStarted = false;

  return {
    ctx,
    s1(at) { play(S1, at); },
    s2(at) { play(S2, at); },
    setFlow(level) {
      if (!flowStarted || ctx.state !== 'running') return;
      flowG.gain.setTargetAtTime(0.025 + 0.12 * Math.max(0, Math.min(1, level)), ctx.currentTime, 0.15);
    },
    resume() {
      if (ctx.state !== 'running') ctx.resume();
      if (!flowStarted) { flowSrc.start(); flowStarted = true; }
    },
  };
}

export function pickVariant() {
  const q = new URLSearchParams(location.search).get('sound');
  const v = q || localStorage.getItem('cellrun-sound') || 'a';
  return ['a', 'b', 'c', 'd', 'e', 'f'].includes(v) ? v : 'a';
}
