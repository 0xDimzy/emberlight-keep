// Emberlight Keep v3 — towers: what each kind costs, how far it reaches, how
// hard it hits, and the per-frame job of picking a target and firing at it.
// Four kinds now: Spark Spire (fast), Frost Lantern (slow), Ember Cannon
// (splash) and Storm Coil (lightning that chains to three foes).
import { SELL_REFUND, TOWER_TYPES } from './config.js';

export function makeTower(type, col, row, baseBoost) {
  const spec = TOWER_TYPES[type];
  const boost = baseBoost
    ? { dmg: baseBoost.dmg, range: baseBoost.range, rate: baseBoost.rate }
    : { dmg: 1, range: 0, rate: 1 };
  return {
    type, col, row,
    x: col * 80 + 40,
    y: 64 + row * 80 + 40,
    cooldown: 0,
    angle: -Math.PI / 2,
    shotsFired: 0,
    kills: 0,
    level: 1,
    invested: spec.cost,
    boost,
  };
}

export function towerSpec(type) { return TOWER_TYPES[type]; }

// The spec a tower actually fights with: base stats bent by its upgrades
// and by any boons the campaign has drafted.
export function effSpec(tower) {
  const spec = TOWER_TYPES[tower.type];
  return {
    ...spec,
    damage: spec.damage * tower.boost.dmg,
    range: spec.range + tower.boost.range,
    rate: spec.rate * tower.boost.rate,
  };
}

// Gold to buy the next level: 60% of the tower's build cost, each time.
export function upgradeCost(tower) {
  return Math.round(TOWER_TYPES[tower.type].cost * 0.6);
}

// Gold back for selling a tower: most of everything sunk into it.
export function sellValue(tower) {
  return Math.floor(tower.invested * SELL_REFUND);
}

// Raise a tower one level (max 3): harder hits, longer reach, faster fire.
// Returns false when the tower is already at max level.
export function applyUpgrade(tower) {
  if (tower.level >= 3) return false;
  tower.level += 1;
  tower.invested += upgradeCost(tower);
  tower.boost.dmg *= 1.6;
  tower.boost.range += 15;
  tower.boost.rate *= 1.15;
  return true;
}

// Cheapest-first range test: is the enemy inside this tower's circle?
export function inRange(tower, enemy) {
  const spec = effSpec(tower);
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
    const spec = effSpec(tower);
    if (tower.cooldown <= 0) {
      tower.cooldown = 1 / spec.rate;
      tower.shotsFired += 1;
      return { tower, target, kind: tower.type };
    }
  }
  return null;
}

// A shot leaves its tower toward the spot its target stood when fired.
// It carries the firing tower's upgraded damage and splash with it. Storm
// shots carry the chain count instead of a splash.
export function fireShot(tower, target, kind) {
  const eff = effSpec(tower);
  return {
    kind,
    x: tower.x,
    y: tower.y,
    tx: target.x,
    ty: target.y,
    target,
    damage: eff.damage,
    splash: eff.splash,
    chain: eff.chain || 0,
    speed: kind === 'ember' ? 320 : 620,
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
