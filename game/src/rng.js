// Emberlight Keep — a tiny seeded generator (mulberry32) so a screenshot seed
// always replays the same waves, the same wobble, the same frame.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [min, max] from the generator.
export function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Shuffle a copy of an array in place-free style, using the same generator.
export function rngPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

// Read ?seed= from the page URL; fall back to 1 so a plain load is stable too.
export function seedFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const parsed = raw === null ? NaN : parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}
