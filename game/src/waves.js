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
  for (let i = 0; i < count; i += 1) {
    // From wave 3, every 4th spawn is a fast Dart Wisp; from wave 5, every
    // 6th is a tough Brute Wisp (brute wins when the two collide).
    let kind = 'gloom';
    if (wave >= 5 && (i + 1) % 6 === 0) kind = 'brute';
    else if (wave >= 3 && (i + 1) % 4 === 0) kind = 'dart';
    queue.push({ boss: false, kind });
  }
  if (wave === TOTAL_WAVES) {
    queue.push({ boss: false, kind: 'brute' });
    queue.push({ boss: false, kind: 'brute' });
    queue.push({ boss: true, kind: 'gloom' });
  }
  return { wave, queue, spawnTimer: 0.4, interval: spawnInterval(wave) };
}

export function waveLabel(wave) {
  if (wave === TOTAL_WAVES) return `Wave ${wave} — DREAD WISP`;
  if (wave >= 8) return `Wave ${wave} — the dark thickens`;
  if (wave >= 5) return `Wave ${wave} — Glooms grow bold`;
  return `Wave ${wave}`;
}

// What the next wave sends, by kind — the same rule buildWave uses, counted
// without spending the rng, so the shop can preview what is coming.
export function waveComposition(wave) {
  const count = waveSize(wave);
  const comp = { gloom: 0, dart: 0, brute: 0, boss: 0 };
  for (let i = 0; i < count; i += 1) {
    if (wave >= 5 && (i + 1) % 6 === 0) comp.brute += 1;
    else if (wave >= 3 && (i + 1) % 4 === 0) comp.dart += 1;
    else comp.gloom += 1;
  }
  if (wave === TOTAL_WAVES) {
    comp.brute += 2;
    comp.boss += 1;
  }
  return comp;
}

// Gold the player banks for clearing a wave without losing the Keep.
export function waveBonus() {
  return 40;
}
