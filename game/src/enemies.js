// Emberlight Keep v3 — the Glooms: five kinds of shadow wisp that march the
// path, plus the two bosses. Movement, slowing, armour, damage and death
// live here. Kinds: gloom (plain), dart (fast, frail), brute (slow, tough,
// hits the Keep for 2), swarm (tiny, comes in packs of three) and warden
// (armoured: every hit loses 4 damage, minimum 1).
import {
  BOSS_DEFS, BOSS_KEEP_DAMAGE, KILL_GOLD, WAVE_HP_BASE, WAVE_HP_GROWTH,
  WAVE_SPEED_BASE, WAVE_SPEED_GROWTH,
} from './config.js';

let nextId = 1;

// Endless waves keep scaling past wave 15, but gentler than the main climb:
// the base curve caps at wave 15 and each endless wave adds 15% HP.
export function endlessHpMul(wave) {
  if (wave <= 15) return 1;
  return Math.pow(1.15, wave - 15);
}

export function makeEnemy(wave, rng, boss, kind, hpMul) {
  const effWave = Math.min(wave, 15);
  const hpScale = Math.pow(WAVE_HP_GROWTH, effWave - 1) * (hpMul || 1) * endlessHpMul(wave);
  const def = boss ? BOSS_DEFS[boss] : null;
  const hp = def
    ? Math.round(def.hp * (hpMul || 1) * endlessHpMul(wave))
    : Math.round(WAVE_HP_BASE * hpScale);
  const speed = def
    ? WAVE_SPEED_BASE * 0.62
    : WAVE_SPEED_BASE * Math.pow(WAVE_SPEED_GROWTH, effWave - 1) * (0.9 + rng() * 0.2);
  const k = def ? 'gloom' : (kind || 'gloom');
  const enemy = {
    id: nextId += 1,
    boss: boss || null,
    bossName: def ? def.name : null,
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
    reward: def ? def.reward : KILL_GOLD + Math.floor(wave / 3),
    keepDamage: def ? BOSS_KEEP_DAMAGE : 1,
    radius: def ? 30 : 15,
    wobble: rng() * Math.PI * 2,
    wobbleSpeed: 2 + rng() * 2,
    // Boss state: summon clock, and which rage phase the Gloomlord is in.
    summonTimer: def ? def.summonEvery : 0,
    phase: 1,
    regen: boss === 'gloomlord' ? 6 : 0,
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
  } else if (k === 'swarm') {
    enemy.hp = Math.max(1, Math.round(hp * 0.35));
    enemy.maxHp = enemy.hp;
    enemy.speed *= 1.5;
    enemy.baseSpeed = enemy.speed;
    enemy.radius = 8;
    enemy.reward = Math.max(2, Math.floor((KILL_GOLD + Math.floor(wave / 3)) / 2));
    enemy.wobbleSpeed = 5 + rng() * 2;
  } else if (k === 'warden') {
    enemy.hp = Math.round(hp * 2.2);
    enemy.maxHp = enemy.hp;
    enemy.speed *= 0.55;
    enemy.baseSpeed = enemy.speed;
    enemy.radius = 20;
    enemy.reward = KILL_GOLD + 8 + Math.floor(wave / 3);
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

// Warden armour shaves 4 off every hit (never below 1): fast low-damage
// towers bounce off it, so the player must answer with heavy hits.
export function damageEnemy(enemy, amount) {
  if (!enemy.alive) return false;
  const taken = enemy.kind === 'warden' ? Math.max(1, amount - 4) : amount;
  enemy.hp -= taken;
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
  // The Gloomlord regenerates and grows faster as its health falls: three
  // phases, each announced by the world step when the threshold is crossed.
  if (enemy.boss === 'gloomlord' && enemy.alive) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen * dt);
    const frac = enemy.hp / enemy.maxHp;
    const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (phase !== enemy.phase) {
      enemy.phase = phase;
      enemy.speed = enemy.baseSpeed * (1 + 0.25 * (phase - 1));
    }
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
