// Emberlight Keep — everything the player sees: the night field, the winding
// path, the lighthouse keep, towers, Glooms, shots, particles, the HUD, the shop
// and the title / win / lose overlays. Canvas 2D only, no images anywhere.
import {
  COLS, FIELD_X, FIELD_Y, FIELD_W, KEEP_CELL, ROWS, SHOP_W, SHOP_X, TILE,
  TOTAL_WAVES, TOWER_TYPES, VIEW_H, VIEW_W,
} from './config.js';
import { isMuted } from './audio.js';
import { hudButtons, overlayButton, shopCardRect } from './input.js';
import { isBuildable } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

const PATH_SET = new Set();
function pathCells() {
  return [
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1],
    [11, 2], [11, 3], [11, 4],
    [10, 4], [9, 4], [8, 4], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4],
    [2, 5], [2, 6], [2, 7],
    [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7],
  ];
}
for (const [c, r] of pathCells()) PATH_SET.add(`${c},${r}`);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawField(ctx, world) {
  // Night grass with a faint checker so the grid reads at a glance.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const x = FIELD_X + col * TILE;
      const y = FIELD_Y + row * TILE;
      ctx.fillStyle = (col + row) % 2 === 0 ? '#16233d' : '#131e33';
      ctx.fillRect(x, y, TILE, TILE);
    }
  }
  // The winding dirt path.
  for (const key of PATH_SET) {
    const [col, row] = key.split(',').map(Number);
    const x = FIELD_X + col * TILE;
    const y = FIELD_Y + row * TILE;
    ctx.fillStyle = '#4a3b28';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#5d4a33';
    ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
  }
  // West gate where Glooms enter.
  ctx.fillStyle = '#0b0f1e';
  ctx.fillRect(FIELD_X - 2, FIELD_Y + TILE + 14, 10, 52);
  ctx.fillStyle = '#7c6aa8';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('◀ GATE', FIELD_X + 6, FIELD_Y + TILE - 8);
}

function drawKeep(ctx, world) {
  const x = FIELD_X + KEEP_CELL[0] * TILE;
  const y = FIELD_Y + KEEP_CELL[1] * TILE;
  const cx = x + TILE / 2;
  // Warm light spilling from the lighthouse.
  const glow = ctx.createRadialGradient(cx, y + 34, 6, cx, y + 34, 150);
  glow.addColorStop(0, 'rgba(255, 209, 102, 0.45)');
  glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 110, y - 110, TILE + 220, TILE + 220);
  // Stone tower + lamp room + roof.
  ctx.fillStyle = '#e8e0cf';
  ctx.fillRect(cx - 16, y + 18, 32, 54);
  ctx.fillStyle = '#8a7f68';
  ctx.fillRect(cx - 16, y + 34, 32, 4);
  ctx.fillRect(cx - 16, y + 52, 32, 4);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(cx - 13, y + 2, 26, 18);
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.moveTo(cx - 18, y + 4);
  ctx.lineTo(cx, y - 14);
  ctx.lineTo(cx + 18, y + 4);
  ctx.closePath();
  ctx.fill();
  // Keep HP bar under the tower.
  const w = 64;
  const frac = Math.max(0, world.keepHp / world.keepMax);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(cx - w / 2, y + 74, w, 7);
  ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f43f5e';
  ctx.fillRect(cx - w / 2, y + 74, w * frac, 7);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`KEEP ${world.keepHp}/${world.keepMax}`, cx, y + 96 - 14);
}

function drawTower(ctx, tower) {
  const spec = TOWER_TYPES[tower.type];
  ctx.save();
  ctx.translate(tower.x, tower.y);
  // Base stone.
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.arc(0, 6, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(0, 4, 20, 0, Math.PI * 2);
  ctx.fill();
  // Rotating head that aims at the target.
  ctx.rotate(tower.angle);
  ctx.fillStyle = spec.color;
  if (tower.type === 'spark') {
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-8, -8);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
  } else if (tower.type === 'frost') {
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
  } else {
    ctx.fillRect(0, -9, 26, 18);
    ctx.beginPath();
    ctx.arc(26, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Glow ring.
  ctx.strokeStyle = spec.glow;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tower.x, tower.y, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx, world, enemy) {
  const wob = Math.sin(world.time * enemy.wobbleSpeed + enemy.wobble) * 4;
  const x = enemy.x;
  const y = enemy.y + wob;
  // Shadow body.
  ctx.fillStyle = enemy.boss ? '#3b0764' : '#1e1b4b';
  ctx.beginPath();
  ctx.arc(x, y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = enemy.boss ? '#7e22ce' : '#4c1d95';
  ctx.beginPath();
  ctx.arc(x, y - 3, enemy.radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  // Glowing eyes.
  ctx.fillStyle = enemy.boss ? '#f43f5e' : '#facc15';
  ctx.beginPath();
  ctx.arc(x - 6, y - 4, 3.2, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // Frost chill tint.
  if (enemy.slowLeft > 0) {
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, enemy.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // HP bar.
  const w = enemy.boss ? 52 : 32;
  const frac = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - w / 2, y - enemy.radius - 12, w, 5);
  ctx.fillStyle = enemy.boss ? '#f43f5e' : '#a78bfa';
  ctx.fillRect(x - w / 2, y - enemy.radius - 12, w * frac, 5);
  if (enemy.boss) {
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DREAD WISP', x, y - enemy.radius - 16);
  }
}

function drawShots(ctx, world) {
  for (const shot of world.shots) {
    if (shot.kind === 'ember') {
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (shot.kind === 'frost') {
      ctx.fillStyle = '#7dd3fc';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.tx, shot.ty);
      ctx.stroke();
      ctx.fillStyle = '#fff7cc';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  // Top bar.
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, VIEW_W, FIELD_Y);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🔥 EMBERLIGHT KEEP', 16, 40);
  ctx.font = 'bold 16px sans-serif';
  const waveText = world.wave === 0 ? 'Wave –/10' : `Wave ${world.wave}/10`;
  ctx.fillText(waveText, 300, 40);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`🪙 ${world.gold}`, 430, 40);
  ctx.fillStyle = '#f87171';
  ctx.fillText(`❤ Keep ${world.keepHp}/${world.keepMax}`, 560, 40);
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(`⭐ Score ${world.score}`, 740, 40);
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(`💀 Kills ${world.kills}`, 900, 40);
  if (world.paused) {
    ctx.fillStyle = '#facc15';
    ctx.fillText('⏸ PAUSED', 1060, 40);
  }
  // Hovered-cell range preview.
  if (world.hover && world.phase === 'play') {
    const spec = TOWER_TYPES[world.selected];
    const cx = FIELD_X + world.hover.col * TILE + TILE / 2;
    const cy = FIELD_Y + world.hover.row * TILE + TILE / 2;
    ctx.fillStyle = isBuildable(world.hover.col, world.hover.row) ? 'rgba(74, 222, 128, 0.25)' : 'rgba(244, 63, 94, 0.25)';
    ctx.fillRect(FIELD_X + world.hover.col * TILE, FIELD_Y + world.hover.row * TILE, TILE, TILE);
    ctx.strokeStyle = spec.color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, spec.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Wave message banner.
  if (world.messageTimer > 0 && world.message) {
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, FIELD_W / 2, FIELD_Y + 30);
  }
}

function drawShop(ctx, world) {
  ctx.fillStyle = '#111a30';
  ctx.fillRect(SHOP_X, FIELD_Y, SHOP_W, VIEW_H - FIELD_Y);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🛠 BUILD TOWERS', SHOP_X + 12, FIELD_Y + 30);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Click a tower, then click', SHOP_X + 12, FIELD_Y + 52);
  ctx.fillText('a grass tile to build it.', SHOP_X + 12, FIELD_Y + 72);
  const order = ['spark', 'frost', 'ember'];
  order.forEach((type, index) => {
    const spec = TOWER_TYPES[type];
    const rect = shopCardRect(index);
    const selected = world.selected === type;
    const afford = world.gold >= spec.cost;
    ctx.fillStyle = selected ? '#1e3a5f' : '#1a2742';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
    ctx.fill();
    ctx.strokeStyle = selected ? spec.color : '#334155';
    ctx.lineWidth = selected ? 3 : 1;
    ctx.stroke();
    ctx.fillStyle = spec.color;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`[${spec.key}] ${spec.name}`, rect.x + 12, rect.y + 26);
    ctx.fillStyle = afford ? '#ffd166' : '#f87171';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`🪙 ${spec.cost}`, rect.x + 12, rect.y + 50);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Range ${spec.range}  •  Dmg ${spec.damage}`, rect.x + 12, rect.y + 72);
    ctx.fillText(spec.blurb, rect.x + 12, rect.y + 92);
  });
  // HUD buttons.
  for (const b of hudButtons(world.waveActive, world.phase)) {
    const disabled = b.id === 'wave-running';
    ctx.fillStyle = disabled ? '#334155' : b.id === 'start-wave' ? '#b45309' : '#1e293b';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.fillStyle = disabled ? '#94a3b8' : '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    ctx.textAlign = 'left';
  }
  // Controls cheat-sheet at the bottom of the shop panel.
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  const lines = [
    'Controls: 1/2/3 pick tower',
    'Space = next wave • R = restart',
    'P = pause • M = mute sound',
    `Sound: ${isMuted() ? 'OFF' : 'ON'}`,
    'Goal: survive all 10 waves.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, SHOP_X + 12, 714 + i * 16));
}

function drawOverlay(ctx, world, screen) {
  ctx.fillStyle = 'rgba(5, 8, 18, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (screen === SCREEN_TITLE) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('🔥 EMBERLIGHT KEEP', VIEW_W / 2, 150);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Defend the last ember-light against the Glooms!', VIEW_W / 2, 200);
    ctx.font = '19px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const rules = [
      'GOAL — Survive all 10 waves. Win by clearing wave 10; lose if the Keep falls to 0 HP.',
      'BUILD — Click a tower in the shop (or press 1 / 2 / 3), then click a grass tile to place it.',
      'FIGHT — Spark Spire shoots fast, Frost Lantern slows Glooms, Ember Cannon deals splash damage.',
      'WAVES — Press Space or Start Wave to send the next wave. Kills earn gold for more towers.',
      'CONTROLS — Mouse to build • Space next wave • R restart • P pause • M mute',
    ];
    rules.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 260 + i * 36));
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('The Dread Wisp boss comes on wave 10. Hold the light!', VIEW_W / 2, 470);
  } else if (screen === SCREEN_WIN) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('🏆 THE LIGHT HOLDS!', VIEW_W / 2, 180);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('All 10 waves cleared — the Keep still burns bright.', VIEW_W / 2, 240);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Final Score: ${world.score}   •   Kills: ${world.kills}   •   Gold earned: ${world.goldEarned}`, VIEW_W / 2, 320);
  } else if (screen === SCREEN_LOSE) {
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('🌑 THE LIGHT GOES OUT', VIEW_W / 2, 180);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`The Glooms overran the Keep on wave ${Math.max(1, world.wave)} of 10.`, VIEW_W / 2, 240);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Final Score: ${world.score}   •   Kills: ${world.kills}   •   Waves cleared: ${Math.max(0, world.wave - 1)}`, VIEW_W / 2, 320);
  }
  const btn = overlayButton();
  ctx.fillStyle = screen === SCREEN_TITLE ? '#b45309' : '#1e40af';
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(screen === SCREEN_TITLE ? '▶ START GAME' : '↻ PLAY AGAIN', VIEW_W / 2, btn.y + 36);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('or press Space', VIEW_W / 2, btn.y + 82);
  ctx.textAlign = 'left';
}

export function drawWorld(ctx, world, screen) {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#0b0f1e';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawField(ctx, world);
  drawKeep(ctx, world);
  for (const tower of world.towers) drawTower(ctx, tower);
  for (const enemy of world.enemies) drawEnemy(ctx, world, enemy);
  drawShots(ctx, world);
  drawHud(ctx, world);
  drawShop(ctx, world);
  if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_LOSE) {
    drawOverlay(ctx, world, screen);
  }
}
