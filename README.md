# Emberlight Keep

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/0xDimzy/emberlight-keep/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/0xDimzy/emberlight-keep/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Emberlight Keep is an original 2D tower-defence game built for make.fun's "Make the best game" bounty. Hold the Keep through 15 waves across 3 nights — build towers, draft boons, chain combos, and survive two bosses: the Dread Wisp on wave 10 and the three-phase Gloomlord on wave 15. Win, and the war goes on in Endless mode.

- **Goal:** keep the Keep alive through all 15 waves. Win when the Gloomlord falls; lose if the Keep is destroyed.
- **Build:** place Spark Spires, Frost Lanterns, Ember Cannons and Storm Coils (chain lightning) on the field. Upgrade each tower to Lv3, or sell it back for 70% of its invested gold.
- **Fight:** Normal or Hard difficulty (Hard: tougher enemies, less starting gold, 1.5x score). Five enemy kinds — Gloom, Dart, Brute, Swarm and armoured Warden — plus the Dread Wisp boss with summons and the regenerating three-phase Gloomlord.
- **Boons:** after waves 5, 10 and 13, draft 1 of 3 boons from a pool of 8 (damage, range, fire rate, frost, bounty, giantslayer, repairs, gold). Kills chained within 2.5 s build a COMBO up to ×5 for bonus gold and score.
- **Endless:** after the win, keep fighting past wave 15 with scaling waves — how long can the light hold?
- **Controls:** mouse to build/upgrade/sell, Space to start the next wave, P to pause, R to restart, H to toggle difficulty, M to mute. A next-wave preview shows what is coming.
- **Polish:** generative ambient music and sound effects (WebAudio), gold floaters, screen shake, muzzle flashes, chain-lightning arcs, night banners, a live demo behind the title screen.

## Run

```sh
node main.ts
```

`main.ts` copies the game and screenshots into `/output` and writes `/output/dossier.json`. Or serve the game directly:

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game itself, staged deterministically with `?shot=start|play|win|lose` (see `game/src/shots.js`): title over a live demo, a Night III mid-fight, the win screen after the Gloomlord falls, and the lose screen.
