// Emberlight Keep — the screenshot scenes behind ?shot=start|play|win|lose.
// Each one plays the real rules forward from a fresh seeded world, steered by a
// simple autopilot (a fixed tower layout, waves started on schedule), so every
// frame is what real play looks like and the same seed always gives the same
// frame. The win pilot builds strong; the lose pilot builds almost nothing,
// so the Glooms overrun the Keep on purpose.
import { TOWER_TYPES } from './config.js';
import { isBuildable, placeTower, PHASE_LOSE, PHASE_PLAY, PHASE_WIN, startGame, startWave, stepWorld } from './world.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const STEP = 1 / 60;

// Good tower spots hugging the path: near the first bend, the middle straight
// and the final approach, so every part of the road is covered.
const STRONG_LAYOUT = [
  ['spark', 10, 0], ['spark', 10, 2], ['frost', 9, 2], ['ember', 9, 0],
  ['spark', 3, 3], ['frost', 4, 3], ['ember', 5, 5], ['spark', 6, 5],
  ['spark', 4, 6], ['frost', 3, 5], ['ember', 8, 6], ['spark', 9, 5],
  ['spark', 1, 0], ['frost', 10, 5], ['ember', 6, 3], ['spark', 5, 3],
];

// A layout that looks busy but cannot hold the road: one spark spire only.
const WEAK_LAYOUT = [['spark', 5, 2]];

function buildLayout(world, layout) {
  world.gold = 9999;
  for (const [type, col, row] of layout) {
    if (!isBuildable(col, row)) continue;
    world.selected = type;
    placeTower(world, col, row);
  }
  world.gold = 9999;
}

// Run the simulation forward, starting a new wave whenever the field is clear.
function runUntil(world, maxSeconds, stop) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    if (!world.waveActive && world.phase === PHASE_PLAY) startWave(world);
    stepWorld(world, STEP);
    if (stop && stop(world)) break;
    if (world.phase !== PHASE_PLAY) break;
  }
}

function stageStart(world) {
  startGame(world);
  buildLayout(world, [['spark', 10, 0], ['frost', 9, 2], ['ember', 5, 5]]);
  world.gold = 220;
  world.phase = 'title';
  return SCREEN_TITLE;
}

function stagePlay(world) {
  startGame(world);
  buildLayout(world, STRONG_LAYOUT);
  world.gold = 180;
  // Play into wave 4 and stop mid-fight, towers firing, HUD full.
  runUntil(world, 400, (w) => w.wave >= 4 && w.enemies.length >= 3);
  return SCREEN_PLAY;
}

function stageWin(world) {
  startGame(world);
  buildLayout(world, STRONG_LAYOUT);
  world.gold = 9999;
  runUntil(world, 600, (w) => w.phase === PHASE_WIN);
  // Present a plausible end-of-game purse, not the staging war chest.
  if (world.phase === PHASE_WIN) world.gold = 640;
  return world.phase === PHASE_WIN ? SCREEN_WIN : SCREEN_PLAY;
}

function stageLose(world) {
  startGame(world);
  buildLayout(world, WEAK_LAYOUT);
  world.gold = 0;
  runUntil(world, 600, (w) => w.phase === PHASE_LOSE);
  return world.phase === PHASE_LOSE ? SCREEN_LOSE : SCREEN_PLAY;
}

// Set `world` to the named scene and return the screen to draw over it.
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'win') return stageWin(world);
  if (name === 'lose') return stageLose(world);
  return stageStart(world);
}

export { TOWER_TYPES };
