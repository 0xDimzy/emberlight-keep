// Emberlight Keep — generative night music: a slow A-minor pad, sparse
// plucks and a soft low pulse, all synthesized with WebAudio. No audio
// files, no network, nothing to load. The pattern is fixed tables, so the
// music is the same every run; it only starts after a player gesture.
let actx = null;
let musicGain = null;
let timer = null;
let step = 0;
let nextTime = 0;
let muted = false;

const STEP_SECS = 0.42;
const STEPS = 16;
// One plucked note per step (0 = rest): A-minor pentatonic, a slow phrase.
const PLUCKS = [220, 261.63, 329.63, 392, 440, 523.25, 0, 329.63, 392, 0, 523.25, 440, 329.63, 261.63, 0, 220];
// One root per four steps: A2, F2, G2, C3 — the chord under the plucks.
const ROOTS = [110, 87.31, 98, 130.81];

function ac() {
  if (!actx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    actx = new AC();
    musicGain = actx.createGain();
    musicGain.gain.value = muted ? 0 : 0.9;
    musicGain.connect(actx.destination);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, when, dur, vol, type) {
  const a = ac();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, when);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

// Two detuned triangles swelling slowly: the night drone under the plucks.
function pad(freq, when, dur) {
  const a = ac();
  if (!a) return;
  for (const det of [0, 4]) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = det;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.035, when + 1.2);
    g.gain.setValueAtTime(0.035, when + dur - 0.8);
    g.gain.linearRampToValueAtTime(0, when + dur);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }
}

function scheduleStep(s, when) {
  const chord = ROOTS[Math.floor(s / 4) % ROOTS.length];
  if (s % 4 === 0) pad(chord, when, STEP_SECS * 4 + 0.4);
  if (s % 4 === 0) tone(55, when, 0.35, 0.07, 'sine');
  const p = PLUCKS[s];
  if (p) tone(p, when, 0.6, 0.045, 'triangle');
}

function tick() {
  const a = ac();
  if (!a) return;
  while (nextTime < a.currentTime + 0.3) {
    scheduleStep(step, Math.max(nextTime, a.currentTime + 0.02));
    step = (step + 1) % STEPS;
    nextTime += STEP_SECS;
  }
}

export function startMusic() {
  const a = ac();
  if (!a) return;
  if (timer !== null) return;
  step = 0;
  nextTime = a.currentTime + 0.1;
  timer = setInterval(tick, 100);
}

export function stopMusic() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

export function setMusicMuted(m) {
  muted = !!m;
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.9;
}

export function isMusicPlaying() {
  return timer !== null;
}
