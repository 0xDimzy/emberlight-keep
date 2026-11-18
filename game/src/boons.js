// Emberlight Keep v3 — boons: after clearing wave 5, 10 and 13 the night
// pauses and the player drafts one of three boons. A boon is a permanent
// campaign modifier, not a one-wave buff: the draft is the run's big
// strategic choice, and the owned boons show in the shop panel.
export const BOON_WAVES = [5, 10, 13];

export const BOONS = {
  emberheart: {
    id: 'emberheart', name: 'Emberheart', icon: '❤',
    blurb: 'The Keep mends: +6 HP right now.',
    once: false,
  },
  whetstone: {
    id: 'whetstone', name: 'Whetstone', icon: '⚔',
    blurb: 'All towers deal +25% damage.',
    once: true,
  },
  farsight: {
    id: 'farsight', name: 'Farsight Lens', icon: '◎',
    blurb: 'All towers gain +20 range.',
    once: true,
  },
  quickhands: {
    id: 'quickhands', name: 'Quick Hands', icon: '↯',
    blurb: 'All towers fire +15% faster.',
    once: true,
  },
  coffers: {
    id: 'coffers', name: 'War Coffers', icon: '🪙',
    blurb: '+120 gold, banked at once.',
    once: false,
  },
  frostbite: {
    id: 'frostbite', name: 'Frostbite', icon: '❄',
    blurb: 'Frost slows 25% stronger.',
    once: true,
  },
  bounty: {
    id: 'bounty', name: 'Bounty', icon: '💀',
    blurb: '+3 gold on every kill.',
    once: true,
  },
  giantslayer: {
    id: 'giantslayer', name: 'Giantslayer', icon: '☠',
    blurb: '+50% damage against bosses.',
    once: true,
  },
};

// Draw three distinct boons the player does not already own (repeatable
// ones may come back). The rng is the world's, so the draft is seeded.
export function draftBoons(world) {
  const owned = new Set(world.boons.map((b) => b.id));
  const pool = Object.values(BOONS).filter((b) => !b.once || !owned.has(b.id));
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const i = Math.floor(world.rng() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

// Apply a drafted boon to the world: existing towers take the stat boons
// at once, and the campaign record keeps them so new towers are built
// with the same edge.
export function applyBoon(world, boon) {
  world.boons.push(boon);
  if (boon.id === 'emberheart') {
    world.keepHp = Math.min(world.keepMax, world.keepHp + 6);
  } else if (boon.id === 'coffers') {
    world.gold += 120;
    world.goldEarned += 120;
  } else if (boon.id === 'whetstone') {
    world.boonMul.dmg *= 1.25;
    for (const t of world.towers) t.boost.dmg *= 1.25;
  } else if (boon.id === 'farsight') {
    world.boonMul.range += 20;
    for (const t of world.towers) t.boost.range += 20;
  } else if (boon.id === 'quickhands') {
    world.boonMul.rate *= 1.15;
    for (const t of world.towers) t.boost.rate *= 1.15;
  } else if (boon.id === 'frostbite') {
    world.boonSlowMul *= 0.75;
  } else if (boon.id === 'bounty') {
    world.boonKillGold += 3;
  } else if (boon.id === 'giantslayer') {
    world.boonBossMul *= 1.5;
  }
  world.message = `Boon taken: ${boon.name}!`;
  world.messageTimer = 2.5;
}
