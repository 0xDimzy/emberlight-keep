// Emberlight Keep v3 — everything the player sees: the night field, the
// winding path, the lighthouse keep, four tower kinds, five Gloom kinds,
// two bosses, chain lightning, boon drafts, combo flames, the HUD, the shop
// and the title / win / lose overlays. Canvas 2D only, no images anywhere.
import {
  COLS, DIFFICULTY, FIELD_X, FIELD_Y, FIELD_W, KEEP_CELL, ROWS,
  SHOP_W, SHOP_X, TILE, TOTAL_WAVES, TOWER_TYPES, VIEW_H, VIEW_W,
} from './config.js';
import { isMuted } from './audio.js';
import { boonCardRect, difficultyButtons, endlessButton, hudButtons, overlayButton, shopCardRect } from './input.js';
import { isBuildable } from './world.js';
import { sellValue } from './towers.js';
import { waveComposition } from './waves.js';

// Decor that never changes: fireflies drifting over the grass and the
// lighthouse beam. Positions come from a fixed-seed generator, so every
// load and every screenshot shows the same night.
function decorRng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const decor = decorRng(20261117);
const FIREFLIES = Array.from({ length: 16 }, () => ({
  x: decor() * FIELD_W, y: FIELD_Y + decor() * (VIEW_H - FIELD_Y - 40),
  phase: decor() * Math.PI * 2, speed: 0.2 + decor() * 0.35,
}));
const STARS = Array.from({ length: 60 }, () => ({
  x: decor() * FIELD_W, y: FIELD_Y + decor() * (VIEW_H - FIELD_Y - 40),
  r: 0.6 + decor() * 1.1, tw: decor() * Math.PI * 2,
}));

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
  // Faint stars and drifting fireflies: the night is alive even where
  // nothing is built yet.
  for (const s of STARS) {
    ctx.globalAlpha = 0.18 + 0.14 * Math.sin(world.time * 0.8 + s.tw);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  for (const f of FIREFLIES) {
    const fx = f.x + Math.sin(world.time * f.speed + f.phase) * 14;
    const fy = f.y + Math.cos(world.time * f.speed * 0.7 + f.phase) * 9;
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(world.time * 1.4 + f.phase);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The winding dirt path, with a dashed centre line so the road reads
  // at a glance even when the screenshot is shrunk.
  for (const key of PATH_SET) {
    const [col, row] = key.split(',').map(Number);
    const x = FIELD_X + col * TILE;
    const y = FIELD_Y + row * TILE;
    ctx.fillStyle = '#4a3b28';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#5d4a33';
    ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
  }
  ctx.fillStyle = '#8a6d4b';
  for (const key of PATH_SET) {
    const [col, row] = key.split(',').map(Number);
    const cx = FIELD_X + col * TILE + TILE / 2;
    const cy = FIELD_Y + row * TILE + TILE / 2;
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
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
  // The lighthouse beam sweeps the field, slow and steady.
  const beamAngle = world.time * 0.25;
  const beamLen = 520;
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(cx, y + 12);
  ctx.lineTo(cx + Math.cos(beamAngle - 0.14) * beamLen, y + 12 + Math.sin(beamAngle - 0.14) * beamLen);
  ctx.lineTo(cx + Math.cos(beamAngle + 0.14) * beamLen, y + 12 + Math.sin(beamAngle + 0.14) * beamLen);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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
  } else if (tower.type === 'storm') {
    // A coiled spire: three arcs of violet lightning around a core.
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + Math.abs(i) * 5, i * 0.9, i * 0.9 + 2.4);
      ctx.stroke();
    }
    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
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
  // Level pips: one gold dot per upgrade level, under the tower.
  for (let i = 0; i < tower.level; i += 1) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(tower.x + (i - (tower.level - 1) / 2) * 10, tower.y + 30, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Body colours per kind: Gloom indigo, Dart teal, Brute dark red, Swarm
// amber, Warden slate with a steel ring, bosses deep purple.
function enemyColors(enemy) {
  if (enemy.boss === 'gloomlord') return { body: '#2e1065', inner: '#6d28d9', eyes: '#f43f5e' };
  if (enemy.boss === 'dread') return { body: '#3b0764', inner: '#7e22ce', eyes: '#f43f5e' };
  if (enemy.kind === 'dart') return { body: '#134e4a', inner: '#2dd4bf', eyes: '#99f6e4' };
  if (enemy.kind === 'brute') return { body: '#7f1d1d', inner: '#b91c1c', eyes: '#fca5a5' };
  if (enemy.kind === 'swarm') return { body: '#451a03', inner: '#f59e0b', eyes: '#fef3c7' };
  if (enemy.kind === 'warden') return { body: '#1e293b', inner: '#64748b', eyes: '#e2e8f0' };
  return { body: '#1e1b4b', inner: '#4c1d95', eyes: '#facc15' };
}

function enemyLabel(enemy) {
  if (enemy.boss === 'gloomlord') return 'GLOOMLORD';
  if (enemy.boss === 'dread') return 'DREAD WISP';
  if (enemy.kind === 'warden') return 'WARDEN';
  return null;
}

function drawEnemy(ctx, world, enemy) {
  const wob = Math.sin(world.time * enemy.wobbleSpeed + enemy.wobble) * 4;
  const x = enemy.x;
  const y = enemy.y + wob;
  const { body, inner, eyes } = enemyColors(enemy);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, enemy.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(x, y - 3, enemy.radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
  // Glowing eyes.
  ctx.fillStyle = eyes;
  ctx.beginPath();
  ctx.arc(x - 6, y - 4, 3.2, 0, Math.PI * 2);
  ctx.arc(x + 6, y - 4, 3.2, 0, Math.PI * 2);
  ctx.fill();
  // Warden armour: a steel ring that says "heavy hits only".
  if (enemy.kind === 'warden') {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, enemy.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Gloomlord rage: a red ring that grows with each phase.
  if (enemy.boss === 'gloomlord') {
    ctx.strokeStyle = '#f43f5e';
    ctx.globalAlpha = 0.5 + enemy.phase * 0.15;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, enemy.radius + 5 + enemy.phase * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Frost chill tint.
  if (enemy.slowLeft > 0) {
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, enemy.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // HP bar.
  const w = enemy.boss ? 56 : 32;
  const frac = Math.max(0, enemy.hp / enemy.maxHp);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - w / 2, y - enemy.radius - 12, w, 5);
  ctx.fillStyle = enemy.boss ? '#f43f5e' : '#a78bfa';
  ctx.fillRect(x - w / 2, y - enemy.radius - 12, w * frac, 5);
  const label = enemyLabel(enemy);
  if (label) {
    ctx.fillStyle = enemy.boss ? '#fda4af' : '#fca5a5';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - enemy.radius - 16);
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
    } else if (shot.kind === 'storm') {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(shot.x, shot.y);
      ctx.lineTo(shot.tx, shot.ty);
      ctx.stroke();
      ctx.fillStyle = '#f3e8ff';
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 3, 0, Math.PI * 2);
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
  // Chain lightning arcs: jagged violet lines that flicker out fast.
  for (const c of world.chainFx) {
    ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const mx = (c.x1 + c.x2) / 2 + (c.y2 - c.y1) * 0.12;
    const my = (c.y1 + c.y2) / 2 - (c.x2 - c.x1) * 0.12;
    ctx.moveTo(c.x1, c.y1);
    ctx.lineTo(mx, my);
    ctx.lineTo(c.x2, c.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Floating gold text: what each kill paid, rising and fading.
function drawFloaters(ctx, world) {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const f of world.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
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
  const night = world.wave === 0 ? '' : ` • NIGHT ${world.wave <= 5 ? 'I' : world.wave <= 10 ? 'II' : 'III'}`;
  const waveText = world.wave === 0 ? 'Wave –/15' : `Wave ${world.wave}/15${night}`;
  ctx.fillText(waveText, 290, 40);
  ctx.fillStyle = '#ffd166';
  ctx.fillText(`🪙 ${world.gold}`, 500, 40);
  ctx.fillStyle = '#f87171';
  ctx.fillText(`❤ Keep ${world.keepHp}/${world.keepMax}`, 600, 40);
  ctx.fillStyle = '#a5b4fc';
  ctx.fillText(`⭐ Score ${world.score}`, 730, 40);
  ctx.fillStyle = '#c4b5fd';
  ctx.fillText(`💀 Kills ${world.kills}`, 870, 40);
  if (world.combo >= 2) {
    ctx.fillStyle = '#f97316';
    ctx.fillText(`🔥 COMBO ×${world.combo}`, 990, 40);
  } else if (world.difficulty === 'hard') {
    ctx.fillStyle = '#f87171';
    ctx.fillText('HARD ×1.5', 990, 40);
  }
  if (world.endless) {
    ctx.fillStyle = '#c084fc';
    ctx.fillText('ENDLESS', 1150, 40);
  } else if (world.paused && !world.draft) {
    ctx.fillStyle = '#facc15';
    ctx.fillText('⏸ PAUSED', 1150, 40);
  }
  // Boss bar: when a boss is on the field, its health is the whole
  // screen's business.
  const boss = world.enemies.find((e) => e.boss && e.alive);
  if (boss) {
    const bw = 420;
    const bx = FIELD_W / 2 - bw / 2;
    const by = FIELD_Y + 8;
    ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
    ctx.fillRect(bx - 10, by - 6, bw + 20, 34);
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    const phaseTag = boss.boss === 'gloomlord' ? ` — PHASE ${boss.phase}` : '';
    ctx.fillText(`☠ ${boss.bossName}${phaseTag}`, FIELD_W / 2, by + 8);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by + 12, bw, 9);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(bx, by + 12, bw * Math.max(0, boss.hp / boss.maxHp), 9);
    ctx.textAlign = 'left';
  }
  // Night banner: a big centred callout when a new night begins.
  if (world.nightBannerTimer > 0 && world.nightBanner) {
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.nightBanner, FIELD_W / 2, 240);
    ctx.textAlign = 'left';
  } else if (world.messageTimer > 0 && world.message) {
    // Wave message banner.
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, FIELD_W / 2, FIELD_Y + 30);
    ctx.textAlign = 'left';
  }
  // Hovered-cell range preview.
  if (world.hover && world.phase === 'play' && !world.draft) {
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
  const order = ['spark', 'frost', 'ember', 'storm'];
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
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`[${spec.key}] ${spec.name}`, rect.x + 12, rect.y + 22);
    ctx.fillStyle = afford ? '#ffd166' : '#f87171';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`🪙 ${spec.cost}`, rect.x + 12, rect.y + 44);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Range ${spec.range}  •  Dmg ${spec.damage}${spec.chain ? `  •  Chain ${spec.chain}` : ''}`, rect.x + 12, rect.y + 64);
    ctx.fillText(spec.blurb, rect.x + 12, rect.y + 80);
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
  // What the next wave sends, so the player builds for it, not blind.
  if (world.phase === 'play' && world.wave < TOTAL_WAVES) {
    const next = waveComposition(world.wave + 1);
    const parts = [];
    if (next.gloom) parts.push(`${next.gloom} Glooms`);
    if (next.dart) parts.push(`${next.dart} Darts`);
    if (next.brute) parts.push(`${next.brute} Brutes`);
    if (next.swarm) parts.push(`${next.swarm} Swarm`);
    if (next.warden) parts.push(`${next.warden} Wardens`);
    if (next.boss) parts.push('BOSS');
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`NEXT — Wave ${world.wave + 1}`, SHOP_X + 12, 646);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    // Two short lines: the full composition never fits on one.
    const line1 = parts.slice(0, 3).join(' • ');
    const line2 = parts.slice(3).join(' • ');
    ctx.fillText(line1, SHOP_X + 12, 664);
    if (line2) ctx.fillText(line2, SHOP_X + 12, 680);
  }
  // Owned boons, as a chip row under the wave preview.
  if (world.boons.length > 0) {
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('BOONS', SHOP_X + 12, 700);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    const names = world.boons.map((b) => `${b.icon} ${b.name}`).join('  ');
    ctx.fillText(names, SHOP_X + 12, 716);
  }
  // Controls cheat-sheet at the bottom of the shop panel.
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px sans-serif';
  const lines = [
    'Controls: 1/2/3/4 pick tower',
    'Click a tower to upgrade it.',
    'X sells a tower (70% back).',
    `Space = next wave • R = restart`,
    `P = pause • M = mute (${isMuted() ? 'OFF' : 'ON'})`,
    'Goal: survive all 15 waves.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, SHOP_X + 12, 734 + i * 11));
}

// Tooltip over a hovered tower: its level, kills, upgrade price and what
// selling it pays back — the numbers behind the upgrade-or-sell choice.
function drawTowerTip(ctx, world) {
  if (!world.hover || world.phase !== 'play' || world.draft) return;
  const tower = world.towers.find((t) => t.col === world.hover.col && t.row === world.hover.row);
  if (!tower) return;
  const spec = TOWER_TYPES[tower.type];
  const upCost = tower.level >= 3 ? null : Math.round(TOWER_TYPES[tower.type].cost * 0.6);
  const w = 200;
  const h = 78;
  const x = Math.max(FIELD_X + 8, Math.min(tower.x + 34, FIELD_X + FIELD_W - w - 8));
  const y = Math.max(FIELD_Y + 8, Math.min(tower.y - h - 12, FIELD_Y + 720 - h));
  ctx.fillStyle = 'rgba(5, 8, 18, 0.88)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = spec.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = spec.color;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${spec.name}  Lv${tower.level}`, x + 10, y + 20);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Kills ${tower.kills}  •  Dmg ${Math.round(spec.damage * tower.boost.dmg)}  •  Range ${spec.range + tower.boost.range}`, x + 10, y + 40);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(upCost === null ? 'MAX level  •  ' : `Upgrade ${upCost}g  •  `, x + 10, y + 60);
  const upW = ctx.measureText(upCost === null ? 'MAX level  •  ' : `Upgrade ${upCost}g  •  `).width;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Sell ${sellValue(tower)}g (X)`, x + 10 + upW, y + 60);
}

// The boon draft: three cards over the paused field, one click to take.
function drawDraft(ctx, world) {
  if (!world.draft) return;
  ctx.fillStyle = 'rgba(5, 8, 18, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('✦ CHOOSE A BOON ✦', FIELD_W / 2, 240);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '19px sans-serif';
  ctx.fillText(`Wave ${world.wave} cleared — the night rewards the bold. Pick one.`, FIELD_W / 2, 272);
  world.draft.forEach((boon, i) => {
    const r = boonCardRect(i);
    ctx.fillStyle = '#1a2742';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(boon.icon, r.x + r.w / 2, r.y + 52);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(boon.name, r.x + r.w / 2, r.y + 92);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '15px sans-serif';
    ctx.fillText(boon.blurb, r.x + r.w / 2, r.y + 126);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText('Click to take', r.x + r.w / 2, r.y + 164);
  });
  ctx.textAlign = 'left';
}

function drawOverlay(ctx, world, screen) {
  ctx.fillStyle = 'rgba(5, 8, 18, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  // Overlays centre on the field, not the whole window, so the text never
  // crosses the shop panel on the right.
  const cx = FIELD_W / 2;
  if (screen === SCREEN_TITLE) {
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('🔥 EMBERLIGHT KEEP', cx, 150);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Defend the last ember-light against the Glooms!', cx, 200);
    ctx.font = '19px sans-serif';
    ctx.fillStyle = '#cbd5e1';
    const rules = [
      'GOAL — Survive all 15 waves across 3 nights. Win by clearing wave 15; lose if the Keep falls to 0 HP.',
      'BUILD — Click a tower in the shop (or press 1 / 2 / 3 / 4), then click a grass tile to place it.',
      'FIGHT — Spark shoots fast, Frost slows, Ember splashes, Storm Coil chains lightning to 3 foes.',
      'FOES — Glooms, Darts, Brutes, Swarms and armoured Wardens, plus the Dread Wisp and the Gloomlord.',
      'BOONS — After waves 5, 10 and 13, draft 1 of 3 boons. Kills chained fast build a COMBO for bonus gold.',
      'CONTROLS — Mouse to build • Space next wave • R restart • P pause • M mute • Win, then fight Endless!',
    ];
    rules.forEach((line, i) => ctx.fillText(line, cx, 258 + i * 34));
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('The Dread Wisp comes on wave 10. The Gloomlord on wave 15. Hold the light!', cx, 486);
  } else if (screen === SCREEN_WIN) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('🏆 THE LIGHT HOLDS!', cx, 180);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(world.endlessWaves > 0
      ? `The Gloomlord fell — and you held ${world.endlessWaves} Endless waves after.`
      : 'All 15 waves cleared — the Keep still burns bright.', cx, 240);
    ctx.font = 'bold 24px sans-serif';
    const hardTag = world.difficulty === 'hard' ? '  •  HARD ×1.5' : '';
    const boonTag = world.boons.length > 0 ? `   •   Boons: ${world.boons.map((b) => b.name).join(', ')}` : '';
    ctx.fillText(`Final Score: ${world.score}   •   Kills: ${world.kills}   •   Gold earned: ${world.goldEarned}${hardTag}`, cx, 320);
    if (boonTag) {
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#c084fc';
      ctx.fillText(boonTag.trim(), cx, 356);
    }
  } else if (screen === SCREEN_LOSE) {
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 56px sans-serif';
    ctx.fillText('THE LIGHT GOES OUT', cx, 180);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`The Glooms overran the Keep on wave ${Math.max(1, world.wave)} of 15.`, cx, 240);
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Final Score: ${world.score}   •   Kills: ${world.kills}   •   Waves cleared: ${Math.max(0, world.wave - 1)}`, cx, 320);
  }
  const btn = overlayButton();
  ctx.fillStyle = screen === SCREEN_TITLE ? '#b45309' : '#1e40af';
  roundRect(ctx, btn.x, btn.y, btn.w, btn.h, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(screen === SCREEN_TITLE ? '▶ START GAME' : '↻ PLAY AGAIN', cx, btn.y + 36);
  if (screen === SCREEN_TITLE) {
    // Difficulty pick, right under START: the choice is part of the game.
    for (const d of difficultyButtons()) {
      const picked = world.difficulty === d.id;
      const spec = DIFFICULTY[d.id];
      ctx.fillStyle = picked ? '#7c2d12' : '#1e293b';
      roundRect(ctx, d.x, d.y, d.w, d.h, 10);
      ctx.fill();
      ctx.strokeStyle = picked ? '#ffd166' : '#475569';
      ctx.lineWidth = picked ? 3 : 1;
      ctx.stroke();
      ctx.fillStyle = picked ? '#ffd166' : '#e2e8f0';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(d.label, d.x + d.w / 2, d.y + 18);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText(spec.blurb, d.x + d.w / 2, d.y + 35);
    }
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('or press Space', cx, 668);
  } else if (screen === SCREEN_WIN && !world.endless) {
    // Endless keeps the run going after the win: a second button.
    const eb = endlessButton();
    ctx.fillStyle = '#6b21a8';
    roundRect(ctx, eb.x, eb.y, eb.w, eb.h, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('⚡ ENDLESS — KEEP FIGHTING', cx, eb.y + 35);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('or press Space', cx, eb.y + 82);
  } else {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('or press Space', cx, btn.y + 82);
  }
  ctx.textAlign = 'left';
}

export function drawWorld(ctx, world, screen) {
  ctx.save();
  // Screen shake: a jolt when the Keep is hit, bigger when the boss dies.
  if (world.shake > 0.5) {
    const sx = Math.sin(world.time * 97) * world.shake * 0.4;
    const sy = Math.cos(world.time * 113) * world.shake * 0.4;
    ctx.translate(sx, sy);
  }
  ctx.clearRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  ctx.fillStyle = '#0b0f1e';
  ctx.fillRect(-20, -20, VIEW_W + 40, VIEW_H + 40);
  drawField(ctx, world);
  drawKeep(ctx, world);
  for (const tower of world.towers) drawTower(ctx, tower);
  for (const enemy of world.enemies) drawEnemy(ctx, world, enemy);
  drawShots(ctx, world);
  drawFloaters(ctx, world);
  drawTowerTip(ctx, world);
  drawHud(ctx, world);
  drawShop(ctx, world);
  if (world.draft) drawDraft(ctx, world);
  if (screen === SCREEN_TITLE || screen === SCREEN_WIN || screen === SCREEN_LOSE) {
    drawOverlay(ctx, world, screen);
  }
  ctx.restore();
}
