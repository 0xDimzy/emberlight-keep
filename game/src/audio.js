// Emberlight Keep — every sound is a synthesized WebAudio blip. No audio files,
// no network, nothing to load: oscillators and a little gain envelope only.
let audioCtx = null;
let muted = false;

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = !!m;
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

// Browsers only let sound start after a gesture, so create lazily on first use.
function ctx() {
  if (audioCtx === null) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// One short tone: frequency slides from `from` to `to` over `secs` seconds.
export function blip(from, to, secs, volume, kind) {
  if (muted) return;
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const now = ac.currentTime;
  osc.type = kind || 'sine';
  osc.frequency.setValueAtTime(from, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + secs);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + secs);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + secs + 0.02);
}

export const sfx = {
  place() { blip(520, 780, 0.09, 0.16, 'triangle'); },
  shoot() { blip(880, 420, 0.06, 0.05, 'square'); },
  boom() { blip(220, 60, 0.22, 0.2, 'sawtooth'); },
  kill() { blip(660, 990, 0.08, 0.1, 'sine'); },
  leak() { blip(180, 90, 0.3, 0.22, 'sawtooth'); },
  wave() { blip(330, 660, 0.18, 0.14, 'triangle'); },
  clear() { blip(440, 880, 0.2, 0.14, 'triangle'); },
  win() { blip(523, 523, 0.14, 0.16, 'triangle'); setTimeout(() => blip(659, 659, 0.14, 0.16, 'triangle'), 140); setTimeout(() => blip(784, 1046, 0.3, 0.18, 'triangle'), 280); },
  lose() { blip(392, 196, 0.5, 0.18, 'sawtooth'); },
  error() { blip(140, 110, 0.12, 0.14, 'square'); },
};
