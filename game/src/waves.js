// Emberlight Keep — the ten waves: how many Glooms each wave sends, when they
// spawn, and the wave-10 boss that ends the game if the keep still stands.
import { TOTAL_WAVES } from './config.js';

export function waveSize(wave) {
  return 6 + wave * 2;
}

// Seconds between spawns inside a wave: later waves come thicker and faster.
export function spawnInterval(wave) {
  return Math.max(0.45, 1.15 - wave * 0.07);
}

// Wave 10 is the finale: a Dread Wisp boss marches last, after its escort.
export function buildWave(wave, rng) {
  const count = waveSize(wave);
  const queue = [];
  for (let i = 0; i < count; i += 1) queue.push({ boss: false });
  if (wave === TOTAL_WAVES) queue.push({ boss: true });
  return { wave, queue, spawnTimer: 0.4, interval: spawnInterval(wave) };
}

export function waveLabel(wave) {
  if (wave === TOTAL_WAVES) return `Wave ${wave} — DREAD WISP`;
  if (wave >= 8) return `Wave ${wave} — the dark thickens`;
  if (wave >= 5) return `Wave ${wave} — Glooms grow bold`;
  return `Wave ${wave}`;
}

// Gold the player banks for clearing a wave without losing the Keep.
export function waveBonus() {
  return 40;
}
