// Emberlight Keep — the world: one object holding the whole game state, and the
// step function that advances it. Towers fire, shots fly, Glooms march, gold
// flows, and the win/lose lines are checked here and nowhere else.
import {
  COLS, DIFFICULTY, FIELD_X, FIELD_Y, KEEP_CELL, PATH_CELLS, ROWS,
  START_KEEP_HP, TILE, TOTAL_WAVES, TOWER_TYPES, WAVE_CLEAR_BONUS,
} from './config.js';
import { makeRng } from './rng.js';
import { applySlow, damageEnemy, makeEnemy, moveEnemy } from './enemies.js';
import { buildWave } from './waves.js';
import { applyUpgrade, fireShot, makeTower, moveShots, sellValue, towerTick, upgradeCost } from './towers.js';
import { sfx } from './audio.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAY = 'play';
export const PHASE_WIN = 'win';
export const PHASE_LOSE = 'lose';
export const EVENT_NONE = 0;
export const EVENT_WIN = 1;
export const EVENT_LOSE = 2;

// Pixel waypoints of the winding path, from the west gate to the keep door.
export function pathWaypoints() {
  return PATH_CELLS.map(([col, row]) => ({
    x: FIELD_X + col * TILE + TILE / 2,
    y: FIELD_Y + row * TILE + TILE / 2,
  }));
}

function pathSet() {
  const set = new Set();
  for (const [col, row] of PATH_CELLS) set.add(`${col},${row}`);
  set.add(`${KEEP_CELL[0]},${KEEP_CELL[1]}`);
  return set;
}
const BLOCKED = pathSet();

export function isBuildable(col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return !BLOCKED.has(`${col},${row}`);
}

export function createWorld(seed, difficulty) {
  const rng = makeRng(seed);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  return {
    seed,
    rng,
    difficulty: diff.key,
    scoreMul: diff.scoreMul,
    phase: PHASE_TITLE,
    paused: false,
    gold: diff.startGold,
    goldEarned: 0,
    keepHp: START_KEEP_HP,
    keepMax: START_KEEP_HP,
    wave: 0,
    waveActive: false,
    waveQueue: null,
    enemies: [],
    towers: [],
    shots: [],
    particles: [],
    floaters: [],
    shake: 0,
    kills: 0,
    score: 0,
    selected: 'spark',
    hover: null,
    message: '',
    messageTimer: 0,
    waveClearTimer: 0,
    time: 0,
    waypoints: pathWaypoints(),
  };
}

export function resetWorld(world, seed) {
  const difficulty = world.difficulty;
  const fresh = createWorld(seed === undefined ? world.seed : seed, difficulty);
  Object.assign(world, fresh);
}

export function startGame(world, difficulty) {
  if (difficulty) world.difficulty = difficulty;
  resetWorld(world, world.seed);
  world.phase = PHASE_PLAY;
  sfx.wave();
}

export function scoreOf(world) {
  return Math.round((world.kills * 10 + world.wave * 100 + world.goldEarned) * world.scoreMul);
}

// Try to build the selected tower on a cell. Returns a short reason when refused.
export function placeTower(world, col, row) {
  if (world.phase !== PHASE_PLAY) return 'not-playing';
  if (!isBuildable(col, row)) return 'path-or-keep';
  if (world.towers.some((t) => t.col === col && t.row === row)) return 'occupied';
  const spec = TOWER_TYPES[world.selected];
  if (world.gold < spec.cost) return 'not-enough-gold';
  world.gold -= spec.cost;
  world.towers.push(makeTower(world.selected, col, row));
  sfx.place();
  return null;
}

// Upgrade the tower standing on a cell, one click, one level. Returns a
// short reason when refused, null when the upgrade went through.
export function upgradeTowerAt(world, col, row) {
  if (world.phase !== PHASE_PLAY) return 'not-playing';
  const tower = world.towers.find((t) => t.col === col && t.row === row);
  if (!tower) return null;
  if (tower.level >= 3) return 'max-level';
  const cost = upgradeCost(tower);
  if (world.gold < cost) return 'not-enough-gold';
  world.gold -= cost;
  applyUpgrade(tower);
  sfx.place();
  world.message = `Upgraded ${TOWER_TYPES[tower.type].name} to Lv${tower.level}!`;
  world.messageTimer = 2;
  return null;
}

// Sell the tower standing on a cell: most of its invested gold comes back,
// so a misplaced tower is a lesson, not a ruined run. Returns a short
// reason when refused, null when the sale went through.
export function sellTowerAt(world, col, row) {
  if (world.phase !== PHASE_PLAY) return 'not-playing';
  const index = world.towers.findIndex((t) => t.col === col && t.row === row);
  if (index < 0) return null;
  const tower = world.towers[index];
  const refund = sellValue(tower);
  world.gold += refund;
  world.towers.splice(index, 1);
  sfx.place();
  world.message = `Sold ${TOWER_TYPES[tower.type].name} for ${refund} gold.`;
  world.messageTimer = 2;
  return null;
}

export function startWave(world) {  if (world.phase !== PHASE_PLAY || world.waveActive) return false;
  if (world.wave >= TOTAL_WAVES) return false;
  world.wave += 1;
  world.waveQueue = buildWave(world.wave, world.rng);
  world.waveActive = true;
  world.message = `Wave ${world.wave} incoming!`;
  world.messageTimer = 2.5;
  sfx.wave();
  return true;
}

function burst(world, x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    world.particles.push({
      x, y,
      vx: (world.rng() - 0.5) * 160,
      vy: (world.rng() - 0.5) * 160,
      life: 0.5 + world.rng() * 0.3,
      maxLife: 0.8,
      color,
      size: 2 + world.rng() * 3,
    });
  }
}

function onKill(world, enemy) {
  world.kills += 1;
  world.gold += enemy.reward;
  world.goldEarned += enemy.reward;
  world.score = scoreOf(world);
  world.floaters.push({
    x: enemy.x, y: enemy.y - enemy.radius - 16,
    text: `+${enemy.reward}`, color: '#ffd166', life: 0.9, maxLife: 0.9,
  });
  if (world.floaters.length > 40) world.floaters.shift();
  burst(world, enemy.x, enemy.y, '#ffd166', enemy.boss ? 26 : 10);
  if (enemy.boss) world.shake = Math.max(world.shake, 14);
  sfx.kill();
}

function onLeak(world, enemy) {
  world.keepHp -= enemy.keepDamage;
  burst(world, enemy.x, enemy.y, '#f43f5e', 14);
  world.shake = Math.max(world.shake, 9);
  sfx.leak();
  if (world.keepHp <= 0) {
    world.keepHp = 0;
    world.phase = PHASE_LOSE;
    world.waveActive = false;
    sfx.lose();
  }
}

function resolveShotHit(world, shot, enemy) {
  const spec = TOWER_TYPES[shot.kind];
  if (shot.kind === 'ember') {
    sfx.boom();
    burst(world, enemy.x, enemy.y, '#fb923c', 12);
    for (const other of world.enemies) {
      if (!other.alive) continue;
      const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
      if (d <= shot.splash && damageEnemy(other, shot.damage)) onKill(world, other);
    }
    return;
  }
  if (shot.kind === 'frost') applySlow(enemy, spec.slow, spec.slowSecs);
  if (damageEnemy(enemy, shot.damage)) onKill(world, enemy);
}

// One fixed step of the simulation. Returns EVENT_WIN / EVENT_LOSE / EVENT_NONE.
export function stepWorld(world, dt) {
  if (world.phase !== PHASE_PLAY || world.paused) return EVENT_NONE;
  world.time += dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;

  // Spawn the next Gloom of the running wave on its timer.
  if (world.waveActive && world.waveQueue) {
    world.waveQueue.spawnTimer -= dt;
    if (world.waveQueue.spawnTimer <= 0 && world.waveQueue.queue.length > 0) {
      const next = world.waveQueue.queue.shift();
      const diff = DIFFICULTY[world.difficulty] || DIFFICULTY.normal;
      world.enemies.push(makeEnemy(world.wave, world.rng, next.boss, next.kind, diff.hpMul));
      world.waveQueue.spawnTimer = world.waveQueue.interval;
    }
  }

  // Towers aim and fire; their shots are collected in world.shots.
  for (const tower of world.towers) {
    const fired = towerTick(tower, world.enemies, dt);
    if (fired) {
      world.shots.push(fireShot(fired.tower, fired.target, fired.kind));
      // Muzzle flash: a blink of light at the barrel when it fires.
      world.particles.push({
        x: fired.tower.x + Math.cos(fired.tower.angle) * 26,
        y: fired.tower.y + Math.sin(fired.tower.angle) * 26,
        vx: 0, vy: 0, life: 0.08, maxLife: 0.08,
        color: TOWER_TYPES[fired.kind].glow, size: 7,
      });
      if (fired.kind === 'spark') sfx.shoot();
    }
  }

  // Shots fly and land; moveShots reports every hit for us to resolve.
  const hits = moveShots(world.shots, dt);
  for (const hit of hits) {
    if (hit.enemy.alive) resolveShotHit(world, hit.shot, hit.enemy);
  }
  world.shots = world.shots.filter((s) => s.alive);

  // Glooms march; any that reach the keep hurt it.
  for (const enemy of world.enemies) {
    if (moveEnemy(enemy, world.waypoints, dt)) onLeak(world, enemy);
    if (world.phase === PHASE_LOSE) break;
  }
  world.enemies = world.enemies.filter((e) => e.alive);

  // Particles fade.
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);

  // Floating gold text rises and fades; the screen shake settles.
  for (const f of world.floaters) {
    f.life -= dt;
    f.y -= 30 * dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);

  // Wave cleared: bonus gold, and the win when wave 10 is done.
  if (world.waveActive && world.waveQueue && world.waveQueue.queue.length === 0 && world.enemies.length === 0) {
    world.waveActive = false;
    world.gold += WAVE_CLEAR_BONUS;
    world.goldEarned += WAVE_CLEAR_BONUS;
    world.score = scoreOf(world);
    if (world.wave >= TOTAL_WAVES) {
      world.phase = PHASE_WIN;
      sfx.win();
      return EVENT_WIN;
    }
    world.message = `Wave ${world.wave} cleared! +${WAVE_CLEAR_BONUS} gold`;
    world.messageTimer = 2.5;
    sfx.clear();
  }
  return world.phase === PHASE_LOSE ? EVENT_LOSE : EVENT_NONE;
}
