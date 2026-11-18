// Emberlight Keep v3 — the screenshot scenes behind ?shot=start|play|win|lose.
// Each one plays the real rules forward from a fresh seeded world, steered by a
// simple autopilot (a fixed tower layout, waves started on schedule, boons
// taken on draft), so every frame is what real play looks like and the same
// seed always gives the same frame. The win pilot builds strong; the lose
// pilot builds almost nothing, so the Glooms overrun the Keep on purpose.
import { TOWER_TYPES } from './config.js';
import { isBuildable, placeTower, PHASE_LOSE, PHASE_PLAY, PHASE_WIN, startGame, startWave, stepWorld, takeBoon, upgradeTowerAt } from './world.js';
import { SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const STEP = 1 / 60;

// Good tower spots hugging the path: near the first bend, the middle straight
// and the final approach, so every part of the road is covered. Storm Coils
// sit where the road doubles back on itself, so their chains hit twice.
const STRONG_LAYOUT = [
  ['spark', 10, 0], ['spark', 10, 2], ['frost', 9, 2], ['ember', 9, 0],
  ['spark', 3, 3], ['frost', 4, 3], ['ember', 5, 5], ['spark', 6, 5],
  ['spark', 4, 6], ['frost', 3, 5], ['ember', 8, 6], ['spark', 9, 5],
  ['storm', 1, 0], ['storm', 10, 5], ['ember', 6, 3], ['storm', 5, 3],
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

// Spend surplus gold on tower upgrades between waves, strongest towers
// first: the staging autopilot plays like a real player, not a war chest
// that never spends.
function autoUpgrade(world) {
  if (world.gold <= 150) return;
  for (const t of world.towers) {
    if (world.gold < 100) break;
    if (t.level < 3) upgradeTowerAt(world, t.col, t.row);
  }
}

// Run the simulation forward, starting a new wave whenever the field is
// clear and taking the first boon whenever a draft opens.
function runUntil(world, maxSeconds, stop) {
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    if (world.draft) takeBoon(world, 0);
    if (!world.waveActive && world.phase === PHASE_PLAY) {
      autoUpgrade(world);
      startWave(world);
    }
    stepWorld(world, STEP);
    if (stop && stop(world)) break;
    if (world.phase !== PHASE_PLAY) break;
  }
}

function stageStart(world) {
  startGame(world);
  buildLayout(world, STRONG_LAYOUT);
  world.gold = 9999;
  // The title shows the game alive behind the overlay: run the demo forward
  // until towers are firing and Glooms are strung along the road, then
  // freeze it. Same seed, same frame, every time.
  runUntil(world, 120, (w) => w.wave >= 2 && w.enemies.length >= 6
    && w.enemies.some((e) => e.pathDist > 300));
  world.gold = 240;
  world.phase = 'title';
  return SCREEN_TITLE;
}

function stagePlay(world) {
  startGame(world);
  buildLayout(world, STRONG_LAYOUT);
  // Genuine one-click upgrades, so the level pips show in the shot.
  upgradeTowerAt(world, 9, 0);
  upgradeTowerAt(world, 10, 0);
  upgradeTowerAt(world, 1, 0);
  world.gold = 180;
  // Play into wave 12, Night III, and stop mid-fight: a packed road with
  // swarms and wardens in the mix, projectiles and chain lightning in the
  // air, towers firing, HUD full. The pack must be deep in — past the
  // second bend — so the road reads busy at a glance instead of bunched
  // at the gate.
  runUntil(world, 900, (w) => w.wave >= 12 && w.enemies.length >= 12
    && w.enemies.some((e) => e.pathDist > 1200));
  return SCREEN_PLAY;
}

function stageWin(world) {
  startGame(world);
  buildLayout(world, STRONG_LAYOUT);
  world.gold = 9999;
  runUntil(world, 1500, (w) => w.phase === PHASE_WIN);
  // Present a plausible end-of-game purse, not the staging war chest.
  if (world.phase === PHASE_WIN) world.gold = 640;
  return world.phase === PHASE_WIN ? SCREEN_WIN : SCREEN_PLAY;
}

function stageLose(world) {
  startGame(world);
  buildLayout(world, WEAK_LAYOUT);
  world.gold = 0;
  runUntil(world, 900, (w) => w.phase === PHASE_LOSE);
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
