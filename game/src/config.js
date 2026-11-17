// Emberlight Keep — fixed tuning for the whole game. One place holds every
// number the designers balance: field size, tower stats, wave growth, gold.
export const TILE = 80;
export const COLS = 13;
export const ROWS = 9;
export const FIELD_X = 0;
export const FIELD_Y = 64;
export const FIELD_W = COLS * TILE;
export const FIELD_H = ROWS * TILE;
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const SHOP_X = FIELD_W;
export const SHOP_W = VIEW_W - FIELD_W;

// The winding road the Glooms march, as grid cells from the west gate to the keep.
export const PATH_CELLS = [
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1], [8, 1], [9, 1], [10, 1], [11, 1],
  [11, 2], [11, 3], [11, 4],
  [10, 4], [9, 4], [8, 4], [7, 4], [6, 4], [5, 4], [4, 4], [3, 4], [2, 4],
  [2, 5], [2, 6], [2, 7],
  [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7], [12, 7],
];
export const KEEP_CELL = [12, 7];

export const START_GOLD = 220;
export const START_GOLD_HARD = 180;
export const START_KEEP_HP = 20;
export const TOTAL_WAVES = 10;
export const KILL_GOLD = 8;
export const WAVE_CLEAR_BONUS = 40;
// Selling a tower refunds most of what was sunk into it: a real choice to
// reposition, not a punishment for experimenting.
export const SELL_REFUND = 0.7;

// Difficulty: Normal is the balanced game; Hard makes Glooms tougher, starts
// the player poorer, and pays a score multiplier for the risk.
export const DIFFICULTY = {
  normal: { key: 'normal', label: 'NORMAL', hpMul: 1, startGold: START_GOLD, scoreMul: 1, blurb: 'Balanced defence' },
  hard: { key: 'hard', label: 'HARD', hpMul: 1.35, startGold: START_GOLD_HARD, scoreMul: 1.5, blurb: '+35% HP • score ×1.5' },
};

export const TOWER_TYPES = {
  spark: { key: '1', name: 'Spark Spire', cost: 50, range: 135, damage: 9, rate: 2.4, color: '#ffd166', glow: '#ff9f1c', blurb: 'Fast bolts, low damage' },
  frost: { key: '2', name: 'Frost Lantern', cost: 80, range: 125, damage: 4, rate: 1.1, slow: 0.55, slowSecs: 1.6, color: '#7dd3fc', glow: '#38bdf8', blurb: 'Chills Glooms, slows them' },
  ember: { key: '3', name: 'Ember Cannon', cost: 150, range: 175, damage: 34, rate: 0.55, splash: 62, color: '#fb7185', glow: '#f43f5e', blurb: 'Slow shots, splash damage' },
};

export const WAVE_HP_BASE = 26;
export const WAVE_HP_GROWTH = 1.28;
export const WAVE_SPEED_BASE = 46;
export const WAVE_SPEED_GROWTH = 1.06;

// The boss is deliberately slow but hits the Keep for 8 HP if it gets through.
export const BOSS_KEEP_DAMAGE = 8;
