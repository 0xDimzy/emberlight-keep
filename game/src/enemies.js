// Emberlight Keep — the Glooms: shadow wisps that march the path, plus the
// wave-10 Dread Wisp boss. Movement, slowing, damage and death live here.
import { KILL_GOLD, WAVE_HP_BASE, WAVE_HP_GROWTH, WAVE_SPEED_BASE, WAVE_SPEED_GROWTH } from './config.js';

let nextId = 1;

export function makeEnemy(wave, rng, boss, kind) {
  const hpScale = Math.pow(WAVE_HP_GROWTH, wave - 1);
  const hp = boss ? 900 + wave * 60 : Math.round(WAVE_HP_BASE * hpScale);
  const speed = boss
    ? WAVE_SPEED_BASE * 0.7
    : WAVE_SPEED_BASE * Math.pow(WAVE_SPEED_GROWTH, wave - 1) * (0.9 + rng() * 0.2);
  // kind: 'gloom' (the default shadow wisp), 'dart' (fast, frail) or
  // 'brute' (slow, tough, hits the Keep for 2). Bosses ignore kind.
  const k = boss ? 'gloom' : (kind || 'gloom');
  const enemy = {
    id: nextId += 1,
    boss: !!boss,
    kind: k,
    x: -40,
    y: 64 + 1 * 80 + 40,
    hp,
    maxHp: hp,
    speed,
    baseSpeed: speed,
    slowLeft: 0,
    slowFactor: 1,
    pathIndex: 0,
    pathDist: 0,
    alive: true,
    reachedKeep: false,
    reward: boss ? 120 : KILL_GOLD + Math.floor(wave / 3),
    keepDamage: boss ? 8 : 1,
    radius: boss ? 26 : 15,
    wobble: rng() * Math.PI * 2,
    wobbleSpeed: 2 + rng() * 2,
  };
  if (k === 'dart') {
    enemy.hp = Math.max(1, Math.round(hp * 0.55));
    enemy.maxHp = enemy.hp;
    enemy.speed *= 1.75;
    enemy.baseSpeed = enemy.speed;
    enemy.radius = 11;
    enemy.wobbleSpeed = 4 + rng() * 2;
  } else if (k === 'brute') {
    enemy.hp = Math.round(hp * 2.6);
    enemy.maxHp = enemy.hp;
    enemy.speed *= 0.6;
    enemy.baseSpeed = enemy.speed;
    enemy.radius = 22;
    enemy.reward = KILL_GOLD + 6 + Math.floor(wave / 3);
    enemy.keepDamage = 2;
    enemy.wobbleSpeed = 1 + rng();
  }
  return enemy;
}

// A frost hit chills the enemy: it moves slower until the chill wears off.
export function applySlow(enemy, factor, secs) {
  enemy.slowFactor = Math.min(enemy.slowFactor, factor);
  enemy.slowLeft = Math.max(enemy.slowLeft, secs);
}

// How far along the path this enemy has marched, in pixels — towers aim at
// the one furthest along, the one closest to the Keep.
export function pathProgress(enemy) {
  return enemy.pathDist;
}

export function damageEnemy(enemy, amount) {
  if (!enemy.alive) return false;
  enemy.hp -= amount;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return true;
  }
  return false;
}

// Walk the enemy along the waypoint list; true when it arrives at the keep.
export function moveEnemy(enemy, waypoints, dt) {
  if (!enemy.alive) return false;
  if (enemy.slowLeft > 0) {
    enemy.slowLeft -= dt;
    if (enemy.slowLeft <= 0) enemy.slowFactor = 1;
  }
  const step = enemy.speed * enemy.slowFactor * dt;
  let left = step;
  while (left > 0 && enemy.pathIndex < waypoints.length - 1) {
    const target = waypoints[enemy.pathIndex + 1];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= left) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.pathDist += dist;
      enemy.pathIndex += 1;
      left -= dist;
    } else {
      enemy.x += (dx / dist) * left;
      enemy.y += (dy / dist) * left;
      enemy.pathDist += left;
      left = 0;
    }
  }
  if (enemy.pathIndex >= waypoints.length - 1) {
    enemy.reachedKeep = true;
    enemy.alive = false;
    return true;
  }
  return false;
}
