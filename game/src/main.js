// Emberlight Keep — the entry point: canvas setup, the game loop, mouse and
// keyboard wiring, and the ?shot= hook the screenshots are taken through.
import { VIEW_H, VIEW_W } from './config.js';
import { seedFromUrl } from './rng.js';
import { createWorld, placeTower, resetWorld, sellTowerAt, startGame, startWave, stepWorld, upgradeTowerAt } from './world.js';
import { drawWorld, SCREEN_LOSE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { canvasPoint, difficultyButtons, hudButtons, KEY_SELECT, overlayButton, pointInRect, pointToCell, shopCardRect } from './input.js';
import { isMuted, setMuted, sfx, toggleMute } from './audio.js';
import { setMusicMuted, startMusic, stopMusic } from './music.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const world = createWorld(seedFromUrl());
// Inspection handle for headless playtests (read-only state, no gameplay effect).
window.__game = world;
let screen = SCREEN_TITLE;
let shotStaged = false;

// Sound stays silent until the player's first gesture: browsers suspend
// audio before one, and the title demo must not blip at a stranger.
// The first click or keypress unlocks it.
let audioUnlocked = false;
setMuted(true);
setMusicMuted(true);
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  setMuted(false);
  setMusicMuted(false);
}

// The title screen runs a live demo behind the overlay: a pre-built field
// fighting its own waves, so the cover shows the game alive, not an empty
// board. It is a separate world that never touches the player's game.
let demo = null;
function ensureDemo() {
  if (demo) return;
  demo = createWorld(seedFromUrl() + 7);
  demo.gold = 9999;
  startGame(demo);
  const layout = [
    ['spark', 10, 0], ['spark', 10, 2], ['frost', 9, 2], ['ember', 9, 0],
    ['spark', 3, 3], ['frost', 4, 3], ['ember', 5, 5], ['spark', 6, 5],
    ['spark', 4, 6], ['frost', 3, 5], ['ember', 8, 6], ['spark', 9, 5],
  ];
  for (const [type, col, row] of layout) {
    demo.selected = type;
    placeTower(demo, col, row);
  }
  demo.gold = 9999;
}

function stepDemo(dt) {
  ensureDemo();
  if (!demo.waveActive && demo.phase === 'play') startWave(demo);
  stepWorld(demo, dt);
  if (demo.phase !== 'play') {
    demo = null;
    ensureDemo();
  }
}

function resizeCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

// Restart from scratch and show the title again.
function restartToTitle() {
  stopMusic();
  resetWorld(world, world.seed);
  screen = SCREEN_TITLE;
  announce('Emberlight Keep. Press Start to defend the lighthouse.');
}

function beginPlay() {
  startGame(world, world.difficulty);
  screen = SCREEN_PLAY;
  startMusic();
  announce('Wave 1 ready. Build towers, then press Space to start the wave.');
}

function handleOverlayClick(x, y) {
  if (screen === SCREEN_TITLE) {
    for (const d of difficultyButtons()) {
      if (pointInRect(x, y, d)) {
        world.difficulty = d.id;
        return true;
      }
    }
  }
  const btn = overlayButton();
  if (pointInRect(x, y, btn)) {
    beginPlay();
    return true;
  }
  return false;
}

function handleShopClick(x, y) {
  const order = ['spark', 'frost', 'ember'];
  for (let i = 0; i < order.length; i += 1) {
    if (pointInRect(x, y, shopCardRect(i))) {
      world.selected = order[i];
      return true;
    }
  }
  for (const b of hudButtons(world.waveActive, world.phase)) {
    if (!pointInRect(x, y, b)) continue;
    if (b.id === 'start-wave') startWave(world);
    else if (b.id === 'restart') restartToTitle();
    else if (b.id === 'pause') world.paused = !world.paused;
    else if (b.id === 'mute') {
      const m = toggleMute();
      setMusicMuted(m);
    }
    return true;
  }
  return false;
}

canvas.addEventListener('click', (event) => {
  unlockAudio();
  const { x, y } = canvasPoint(event, canvas);
  if (screen !== SCREEN_PLAY) {
    handleOverlayClick(x, y);
    return;
  }
  if (x >= 1040) {
    handleShopClick(x, y);
    return;
  }
  const cell = pointToCell(x, y);
  if (!cell) return;
  const reason = placeTower(world, cell.col, cell.row);
  if (reason === 'not-enough-gold') {
    world.message = 'Not enough gold!';
    world.messageTimer = 1.5;
    sfx.error();
  } else if (reason === 'path-or-keep') {
    world.message = 'Cannot build on the path or the Keep.';
    world.messageTimer = 1.5;
    sfx.error();
  } else if (reason === 'occupied') {
    // Clicking a tower that stands there upgrades it instead of erroring.
    const up = upgradeTowerAt(world, cell.col, cell.row);
    if (up === 'not-enough-gold') {
      world.message = 'Not enough gold to upgrade!';
      world.messageTimer = 1.5;
      sfx.error();
    } else if (up === 'max-level') {
      world.message = 'Tower is already max level.';
      world.messageTimer = 1.5;
      sfx.error();
    }
    // Success leaves the upgrade message upgradeTowerAt set behind.
  }
});

canvas.addEventListener('mousemove', (event) => {
  const { x, y } = canvasPoint(event, canvas);
  world.hover = pointToCell(x, y);
});

window.addEventListener('keydown', (event) => {
  unlockAudio();
  if (KEY_SELECT[event.code]) {
    world.selected = KEY_SELECT[event.code];
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (screen !== SCREEN_PLAY) beginPlay();
    else startWave(world);
  } else if (event.code === 'KeyR') {
    restartToTitle();
  } else if (event.code === 'KeyP') {
    if (screen === SCREEN_PLAY) world.paused = !world.paused;
  } else if (event.code === 'KeyM') {
    const m = toggleMute();
    setMusicMuted(m);
  } else if (event.code === 'KeyX') {
    // Sell the tower under the mouse: most of its gold comes back.
    if (screen === SCREEN_PLAY && world.hover) {
      sellTowerAt(world, world.hover.col, world.hover.row);
    }
  } else if (event.code === 'KeyH') {
    if (screen === SCREEN_TITLE) {
      world.difficulty = world.difficulty === 'hard' ? 'normal' : 'hard';
    }
  }
});

// The fixed-step loop: simulation at 60 Hz, one draw per animation frame.
const STEP = 1 / 60;
let last = performance.now();
let accumulator = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (screen === SCREEN_PLAY && !world.paused) {
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepWorld(world, STEP);
      accumulator -= STEP;
      if (world.phase === 'win') {
        screen = SCREEN_WIN;
        stopMusic();
      } else if (world.phase === 'lose') {
        screen = SCREEN_LOSE;
        stopMusic();
      }
    }
  }
  if (screen === SCREEN_TITLE) {
    // The demo fights behind the title; the overlay draws over it.
    stepDemo(elapsed);
    demo.difficulty = world.difficulty;
    drawWorld(ctx, demo, SCREEN_TITLE);
  } else {
    drawWorld(ctx, world, screen);
  }
  if (shotStaged) window.__shotReady = true;
  requestAnimationFrame(frame);
}

// Screenshot mode: stage a real played scene, draw it once, flag ready.
// Sound stays off here — there is no user gesture, so AudioContext would
// only warn; the staged scenes must stay silent and deterministic.
if (shotName) {
  setMuted(true);
  setMusicMuted(true);
  screen = stageShot(shotName, world);
  shotStaged = true;
  drawWorld(ctx, world, screen);
  window.__shotReady = true;
} else {
  requestAnimationFrame(frame);
}
