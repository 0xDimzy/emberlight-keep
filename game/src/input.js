// Emberlight Keep — keyboard and mouse: which keys and clicks mean what, and
// where on the canvas a click lands (grid cell, shop card, or HUD button).
import { COLS, FIELD_W, FIELD_X, FIELD_Y, ROWS, SHOP_X, SHOP_W, TILE, VIEW_H, VIEW_W } from './config.js';

export const KEY_SELECT = { Digit1: 'spark', Digit2: 'frost', Digit3: 'ember' };

export function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (VIEW_W / rect.width),
    y: (event.clientY - rect.top) * (VIEW_H / rect.height),
  };
}

// Grid cell under a canvas point, or null when the point is off the field.
export function pointToCell(x, y) {
  const col = Math.floor((x - FIELD_X) / TILE);
  const row = Math.floor((y - FIELD_Y) / TILE);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}

export function cellCenter(col, row) {
  return { x: FIELD_X + col * TILE + TILE / 2, y: FIELD_Y + row * TILE + TILE / 2 };
}

// The shop cards: one rectangle per tower type, stacked in the right panel.
export function shopCardRect(index) {
  return { x: SHOP_X + 12, y: 150 + index * 118, w: SHOP_W - 24, h: 106 };
}

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// The shop lives right of the field; true when a canvas point is over it.
export function pointInShop(x) {
  return x >= SHOP_X;
}

// HUD buttons the canvas draws: Start Wave / Next Wave and Restart.
export function hudButtons(waveActive, phase) {
  const buttons = [];
  if (phase === 'play') {
    buttons.push({ id: waveActive ? 'wave-running' : 'start-wave', x: SHOP_X + 12, y: 540, w: SHOP_W - 24, h: 46, label: waveActive ? 'Wave running…' : '▶ Start Wave (Space)' });
    buttons.push({ id: 'restart', x: SHOP_X + 12, y: 596, w: SHOP_W - 24, h: 46, label: '↻ Restart (R)' });
    buttons.push({ id: 'pause', x: SHOP_X + 12, y: 652, w: (SHOP_W - 24) / 2 - 4, h: 40, label: '⏸ Pause (P)' });
    buttons.push({ id: 'mute', x: SHOP_X + 12 + (SHOP_W - 24) / 2 + 4, y: 652, w: (SHOP_W - 24) / 2 - 4, h: 40, label: '♪ Sound (M)' });
  }
  return buttons;
}

// Big centred button used by the title / win / lose overlays. It centres on
// the field, not the whole window, so it never sits over the shop panel.
export function overlayButton() {
  return { x: FIELD_W / 2 - 150, y: 520, w: 300, h: 56 };
}

// Difficulty pick under START GAME on the title screen.
export function difficultyButtons() {
  return [
    { id: 'normal', x: FIELD_W / 2 - 150, y: 592, w: 144, h: 44, label: 'NORMAL' },
    { id: 'hard', x: FIELD_W / 2 + 6, y: 592, w: 144, h: 44, label: 'HARD' },
  ];
}
