// Emberlight Keep v3 — the fifteen waves in three nights: how many Glooms
// each wave sends, when they spawn, and the two bosses. Wave 10 ends Night
// II with the Dread Wisp; wave 15 ends Night III with the Gloomlord. After
// the win, Endless waves keep coming with the same composition rules.
import { TOTAL_WAVES } from './config.js';

export function waveSize(wave) {
  return 6 + wave * 2;
}

// Seconds between spawns inside a wave: later waves come thicker and faster.
export function spawnInterval(wave) {
  return Math.max(0.38, 1.15 - wave * 0.07);
}

export function buildWave(wave, rng) {
  const count = waveSize(wave);
  const queue = [];
  for (let i = 0; i < count; i += 1) {
    // The mix thickens as the nights deepen: darts from wave 3, brutes
    // from wave 5, swarms from wave 7 (a pack of three per slot), wardens
    // from wave 9. Warden wins a collision over brute, brute over dart.
    let kind = 'gloom';
    if (wave >= 9 && (i + 1) % 7 === 0) kind = 'warden';
    else if (wave >= 7 && (i + 1) % 5 === 0) kind = 'swarm';
    else if (wave >= 5 && (i + 1) % 6 === 0) kind = 'brute';
    else if (wave >= 3 && (i + 1) % 4 === 0) kind = 'dart';
    queue.push({ boss: null, kind });
  }
  if (wave === 10) {
    queue.push({ boss: null, kind: 'brute' });
    queue.push({ boss: null, kind: 'brute' });
    queue.push({ boss: 'dread', kind: 'gloom' });
  }
  if (wave === TOTAL_WAVES) {
    queue.push({ boss: null, kind: 'warden' });
    queue.push({ boss: null, kind: 'warden' });
    queue.push({ boss: 'gloomlord', kind: 'gloom' });
  }
  return { wave, queue, spawnTimer: 0.4, interval: spawnInterval(wave) };
}

export function waveLabel(wave) {
  if (wave === TOTAL_WAVES) return `Wave ${wave} — GLOOMLORD`;
  if (wave === 10) return `Wave ${wave} — DREAD WISP`;
  if (wave >= 11) return `Wave ${wave} — the dark thickens`;
  if (wave >= 6) return `Wave ${wave} — Glooms grow bold`;
  return `Wave ${wave}`;
}

// What the next wave sends, by kind — the same rule buildWave uses, counted
// without spending the rng, so the shop can preview what is coming. A swarm
// slot counts as three bodies on the road.
export function waveComposition(wave) {
  const count = waveSize(wave);
  const comp = { gloom: 0, dart: 0, brute: 0, swarm: 0, warden: 0, boss: 0 };
  for (let i = 0; i < count; i += 1) {
    if (wave >= 9 && (i + 1) % 7 === 0) comp.warden += 1;
    else if (wave >= 7 && (i + 1) % 5 === 0) comp.swarm += 3;
    else if (wave >= 5 && (i + 1) % 6 === 0) comp.brute += 1;
    else if (wave >= 3 && (i + 1) % 4 === 0) comp.dart += 1;
    else comp.gloom += 1;
  }
  if (wave === 10) {
    comp.brute += 2;
    comp.boss += 1;
  }
  if (wave === TOTAL_WAVES) {
    comp.warden += 2;
    comp.boss += 1;
  }
  return comp;
}

// Gold the player banks for clearing a wave without losing the Keep.
// Later waves pay more: the economy has to fund four tower kinds now.
export function waveBonus(wave) {
  return 40 + (wave || 0) * 2;
}
