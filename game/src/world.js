// Emberlight Keep v3 — the world: one object holding the whole game state,
// and the step function that advances it. Towers fire, shots fly, Glooms
// march, gold flows, boons are drafted, combos build, and the win/lose
// lines are checked here and nowhere else.
import {
  COLS, COMBO_GOLD_PER_STEP, COMBO_MAX, COMBO_WINDOW, DIFFICULTY, FIELD_X,
  FIELD_Y, KEEP_CELL, PATH_CELLS, ROWS, START_KEEP_HP, TILE, TOTAL_WAVES,
  TOWER_TYPES,
} from './config.js';
import { makeRng } from './rng.js';
import { applySlow, damageEnemy, makeEnemy, moveEnemy } from './enemies.js';
import { buildWave, waveBonus } from './waves.js';
import { applyBoon, BOON_WAVES, draftBoons } from './boons.js';
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
    chainFx: [],
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
    // v3 campaign state: drafted boons and their live multipliers, the
    // kill-streak combo, the open boon draft, and Endless mode.
    boons: [],
    boonMul: { dmg: 1, range: 0, rate: 1 },
    boonSlowMul: 1,
    boonKillGold: 0,
    boonBossMul: 1,
    draft: null,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    endless: false,
    endlessWaves: 0,
    nightBanner: '',
    nightBannerTimer: 0,
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

// Enter Endless mode from the win screen: the war goes on past wave 15,
// waves keep scaling, and the score keeps counting.
export function startEndless(world) {
  world.endless = true;
  world.phase = PHASE_PLAY;
  world.waveActive = false;
  world.message = 'ENDLESS — the dark never ends. Hold as long as you can!';
  world.messageTimer = 3;
  sfx.wave();
}

export function scoreOf(world) {
  return Math.round((world.kills * 10 + world.wave * 100 + world.goldEarned + world.maxCombo * 25) * world.scoreMul);
}

// Try to build the selected tower on a cell. Returns a short reason when refused.
export function placeTower(world, col, row) {
  if (world.phase !== PHASE_PLAY) return 'not-playing';
  if (!isBuildable(col, row)) return 'path-or-keep';
  if (world.towers.some((t) => t.col === col && t.row === row)) return 'occupied';
  const spec = TOWER_TYPES[world.selected];
  if (world.gold < spec.cost) return 'not-enough-gold';
  world.gold -= spec.cost;
  world.towers.push(makeTower(world.selected, col, row, world.boonMul));
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

// Take one of the three drafted boons, then close the draft and resume.
export function takeBoon(world, index) {
  if (!world.draft || index < 0 || index >= world.draft.length) return false;
  applyBoon(world, world.draft[index]);
  world.draft = null;
  world.paused = false;
  sfx.clear();
  return true;
}

export function startWave(world) {
  if (world.phase !== PHASE_PLAY || world.waveActive) return false;
  if (world.draft) return false;
  if (world.wave >= TOTAL_WAVES && !world.endless) return false;
  world.wave += 1;
  world.waveQueue = buildWave(world.wave, world.rng);
  world.waveActive = true;
  const nightStart = [1, 6, 11].includes(world.wave);
  if (nightStart) {
    const names = { 1: 'NIGHT I — THE FIRST DARK', 6: 'NIGHT II — THE DREAD WISP', 11: 'NIGHT III — THE GLOOMLORD' };
    world.nightBanner = names[world.wave];
    world.nightBannerTimer = 3;
  }
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
  // Kill streaks: a kill inside the combo window raises the combo, and
  // each step pays +2 gold. The combo feeds the score too.
  if (world.comboTimer > 0) world.combo = Math.min(COMBO_MAX, world.combo + 1);
  else world.combo = 1;
  world.comboTimer = COMBO_WINDOW;
  world.maxCombo = Math.max(world.maxCombo, world.combo);
  const reward = enemy.reward + world.boonKillGold + (world.combo - 1) * COMBO_GOLD_PER_STEP;
  world.gold += reward;
  world.goldEarned += reward;
  world.score = scoreOf(world);
  world.floaters.push({
    x: enemy.x, y: enemy.y - enemy.radius - 16,
    text: world.combo >= 3 ? `+${reward} ×${world.combo}` : `+${reward}`,
    color: world.combo >= 3 ? '#f97316' : '#ffd166', life: 0.9, maxLife: 0.9,
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
  // Storm Coil: the bolt chains to the nearest foes around the first hit.
  if (shot.kind === 'storm') {
    const chained = [enemy];
    let from = enemy;
    while (chained.length < shot.chain) {
      let next = null;
      let bestD = 150;
      for (const other of world.enemies) {
        if (!other.alive || chained.includes(other)) continue;
        const d = Math.hypot(other.x - from.x, other.y - from.y);
        if (d < bestD) { bestD = d; next = other; }
      }
      if (!next) break;
      chained.push(next);
      from = next;
    }
    for (let i = 0; i < chained.length; i += 1) {
      const target = chained[i];
      const dmg = i === 0 ? shot.damage : Math.round(shot.damage * 0.7);
      world.chainFx.push({
        x1: i === 0 ? shot.x : chained[i - 1].x, y1: i === 0 ? shot.y : chained[i - 1].y,
        x2: target.x, y2: target.y, life: 0.15, maxLife: 0.15,
      });
      const finalDmg = target.boss ? Math.round(dmg * world.boonBossMul) : dmg;
      if (damageEnemy(target, finalDmg)) onKill(world, target);
    }
    return;
  }
  if (shot.kind === 'ember') {
    sfx.boom();
    burst(world, enemy.x, enemy.y, '#fb923c', 12);
    for (const other of world.enemies) {
      if (!other.alive) continue;
      const d = Math.hypot(other.x - enemy.x, other.y - enemy.y);
      if (d <= shot.splash) {
        const dmg = other.boss ? Math.round(shot.damage * world.boonBossMul) : shot.damage;
        if (damageEnemy(other, dmg)) onKill(world, other);
      }
    }
    return;
  }
  if (shot.kind === 'frost') applySlow(enemy, spec.slow * world.boonSlowMul, spec.slowSecs);
  const dmg = enemy.boss ? Math.round(shot.damage * world.boonBossMul) : shot.damage;
  if (damageEnemy(enemy, dmg)) onKill(world, enemy);
}

// One fixed step of the simulation. Returns EVENT_WIN / EVENT_LOSE / EVENT_NONE.
export function stepWorld(world, dt) {
  if (world.phase !== PHASE_PLAY || world.paused) return EVENT_NONE;
  world.time += dt;
  if (world.messageTimer > 0) world.messageTimer -= dt;
  if (world.nightBannerTimer > 0) world.nightBannerTimer -= dt;
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Spawn the next Gloom of the running wave on its timer. A swarm slot
  // releases three bodies at once, fanned out behind the gate.
  if (world.waveActive && world.waveQueue) {
    world.waveQueue.spawnTimer -= dt;
    if (world.waveQueue.spawnTimer <= 0 && world.waveQueue.queue.length > 0) {
      const next = world.waveQueue.queue.shift();
      const diff = DIFFICULTY[world.difficulty] || DIFFICULTY.normal;
      if (next.kind === 'swarm') {
        for (let i = 0; i < 3; i += 1) {
          const e = makeEnemy(world.wave, world.rng, next.boss, next.kind, diff.hpMul);
          e.x -= i * 26;
          world.enemies.push(e);
        }
      } else {
        world.enemies.push(makeEnemy(world.wave, world.rng, next.boss, next.kind, diff.hpMul));
      }
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

  // Bosses summon help while they march: the Dread Wisp calls darts, the
  // Gloomlord calls swarms. Summons spawn at the boss, already partway in.
  for (const enemy of world.enemies) {
    if (!enemy.boss || !enemy.alive) continue;
    const def = { dread: { every: 6, kind: 'dart', count: 2 }, gloomlord: { every: 5, kind: 'swarm', count: 1 } }[enemy.boss];
    if (!def) continue;
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = def.every;
      const diff = DIFFICULTY[world.difficulty] || DIFFICULTY.normal;
      for (let i = 0; i < def.count; i += 1) {
        const count = def.kind === 'swarm' ? 3 : 1;
        for (let j = 0; j < count; j += 1) {
          const s = makeEnemy(world.wave, world.rng, null, def.kind, diff.hpMul);
          s.x = enemy.x - 20 - j * 22;
          s.y = enemy.y;
          s.pathIndex = enemy.pathIndex;
          s.pathDist = enemy.pathDist;
          world.enemies.push(s);
        }
      }
      world.message = `${enemy.bossName} calls for help!`;
      world.messageTimer = 2;
    }
  }

  // Glooms march; any that reach the keep hurt it.
  for (const enemy of world.enemies) {
    if (moveEnemy(enemy, world.waypoints, dt)) onLeak(world, enemy);
    if (world.phase === PHASE_LOSE) break;
  }
  world.enemies = world.enemies.filter((e) => e.alive);

  // Particles fade; chain lightning flickers out fast.
  for (const p of world.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  world.particles = world.particles.filter((p) => p.life > 0);
  for (const c of world.chainFx) c.life -= dt;
  world.chainFx = world.chainFx.filter((c) => c.life > 0);

  // Floating gold text rises and fades; the screen shake settles.
  for (const f of world.floaters) {
    f.life -= dt;
    f.y -= 30 * dt;
  }
  world.floaters = world.floaters.filter((f) => f.life > 0);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 30);

  // Wave cleared: bonus gold, a boon draft on waves 5/10/13, and the win
  // when wave 15 is done — unless Endless is on, in which case the war
  // simply continues into wave 16 and beyond.
  if (world.waveActive && world.waveQueue && world.waveQueue.queue.length === 0 && world.enemies.length === 0) {
    world.waveActive = false;
    const bonus = waveBonus(world.wave);
    world.gold += bonus;
    world.goldEarned += bonus;
    world.score = scoreOf(world);
    if (world.wave >= TOTAL_WAVES && !world.endless) {
      world.phase = PHASE_WIN;
      sfx.win();
      return EVENT_WIN;
    }
    if (world.endless) world.endlessWaves += 1;
    if (BOON_WAVES.includes(world.wave) && !world.endless) {
      world.draft = draftBoons(world);
      world.paused = true;
      world.message = 'Choose a boon — the night rewards the bold.';
      world.messageTimer = 0;
      sfx.clear();
      return EVENT_NONE;
    }
    world.message = `Wave ${world.wave} cleared! +${bonus} gold`;
    world.messageTimer = 2.5;
    sfx.clear();
  }
  return world.phase === PHASE_LOSE ? EVENT_LOSE : EVENT_NONE;
}
