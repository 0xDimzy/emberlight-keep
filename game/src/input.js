// Emberlight Keep v3 — keyboard and mouse: which keys and clicks mean what,
// and where on the canvas a click lands (grid cell, shop card, HUD button,
// boon card, or the Endless button on the win screen).
import { COLS, FIELD_W, FIELD_X, FIELD_Y, ROWS, SHOP_X, SHOP_W, TILE, VIEW_H, VIEW_W } from './config.js';

export const KEY_SELECT = { Digit1: 'spark', Digit2: 'frost', Digit3: 'ember', Digit4: 'storm' };

// Shop card layout for four towers: compact cards stacked in the right
// panel, four lines of text each, ending before the HUD buttons.
export const SHOP_CARD_Y = 100;
export const SHOP_CARD_H = 84;
export const SHOP_CARD_GAP = 92;

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
  return { x: SHOP_X + 12, y: SHOP_CARD_Y + index * SHOP_CARD_GAP, w: SHOP_W - 24, h: SHOP_CARD_H };
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
    buttons.push({ id: waveActive ? 'wave-running' : 'start-wave', x: SHOP_X + 12, y: 478, w: SHOP_W - 24, h: 44, label: waveActive ? 'Wave running…' : '▶ Start Wave (Space)' });
    buttons.push({ id: 'restart', x: SHOP_X + 12, y: 530, w: SHOP_W - 24, h: 44, label: '↻ Restart (R)' });
    buttons.push({ id: 'pause', x: SHOP_X + 12, y: 582, w: (SHOP_W - 24) / 2 - 4, h: 40, label: '⏸ Pause (P)' });
    buttons.push({ id: 'mute', x: SHOP_X + 12 + (SHOP_W - 24) / 2 + 4, y: 582, w: (SHOP_W - 24) / 2 + 4, h: 40, label: '♪ Sound (M)' });
  }
  return buttons;
}

// Big centred button used by the title / win / lose overlays. It centres on
// the field, not the whole window, so it never sits over the shop panel.
export function overlayButton() {
  return { x: FIELD_W / 2 - 150, y: 520, w: 300, h: 56 };
}

// A second button under PLAY AGAIN on the win screen: keep fighting in
// Endless mode instead of ending the run.
export function endlessButton() {
  return { x: FIELD_W / 2 - 150, y: 592, w: 300, h: 56 };
}

// Difficulty pick under START GAME on the title screen.
export function difficultyButtons() {
  return [
    { id: 'normal', x: FIELD_W / 2 - 150, y: 592, w: 144, h: 44, label: 'NORMAL' },
    { id: 'hard', x: FIELD_W / 2 + 6, y: 592, w: 144, h: 44, label: 'HARD' },
  ];
}

// The three boon cards of the draft overlay: spread across the field,
// big enough to read at a glance when the screenshot is shrunk.
export function boonCardRect(index) {
  return { x: 40 + index * 330, y: 300, w: 300, h: 190 };
}
