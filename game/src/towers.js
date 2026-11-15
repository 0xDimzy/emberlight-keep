// Emberlight Keep — towers: what each kind costs, how far it reaches, how hard
// it hits, and the per-frame job of picking a target and firing at it.
import { TOWER_TYPES } from './config.js';

export function makeTower(type, col, row) {
  const spec = TOWER_TYPES[type];
  return {
    type, col, row,
    x: col * 80 + 40,
    y: 64 + row * 80 + 40,
    cooldown: 0,
    angle: -Math.PI / 2,
    shotsFired: 0,
    kills: 0,
  };
}

export function towerSpec(type) { return TOWER_TYPES[type]; }

// Cheapest-first range test: is the enemy inside this tower's circle?
export function inRange(tower, enemy) {
  const spec = TOWER_TYPES[tower.type];
  const dx = enemy.x - tower.x;
  const dy = enemy.y - tower.y;
  return dx * dx + dy * dy <= spec.range * spec.range;
}

// Pick the enemy furthest along the path that is in range (first to the keep).
export function pickTarget(tower, enemies) {
  let best = null;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    if (!inRange(tower, enemy)) continue;
    if (best === null || enemy.pathDist > best.pathDist) best = enemy;
  }
  return best;
}

// Advance one tower by dt seconds. Returns a shot to spawn, or null.
export function towerTick(tower, enemies, dt) {
  tower.cooldown -= dt;
  const target = pickTarget(tower, enemies);
  if (target) {
    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    const spec = TOWER_TYPES[tower.type];
    if (tower.cooldown <= 0) {
      tower.cooldown = 1 / spec.rate;
      tower.shotsFired += 1;
      return { tower, target, kind: tower.type };
    }
  }
  return null;
}

// A shot leaves its tower toward the spot its target stood when fired.
export function fireShot(tower, target, kind) {
  return {
    kind,
    x: tower.x,
    y: tower.y,
    tx: target.x,
    ty: target.y,
    target,
    speed: kind === 'ember' ? 320 : 520,
    alive: true,
  };
}

// Advance every shot one step; returns the hits that landed this step.
export function moveShots(shots, dt) {
  const hits = [];
  for (const shot of shots) {
    if (!shot.alive) continue;
    if (!shot.target.alive) {
      shot.tx = shot.target.x;
      shot.ty = shot.target.y;
    }
    const dx = shot.tx - shot.x;
    const dy = shot.ty - shot.y;
    const dist = Math.hypot(dx, dy);
    const step = shot.speed * dt;
    if (dist <= Math.max(step, 10)) {
      shot.alive = false;
      hits.push({ shot, enemy: shot.target });
    } else {
      shot.x += (dx / dist) * step;
      shot.y += (dy / dist) * step;
    }
  }
  return hits;
}
