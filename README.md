# Emberlight Keep

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/0xDimzy/emberlight-keep/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/0xDimzy/emberlight-keep/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Emberlight Keep is an original 2D tower-defence game built for make.fun's "Make the best game" bounty. Hold the Keep through 10 waves of shadow wisps — build towers, upgrade them, sell and reposition, and survive the Dread Wisp boss on wave 10.

- **Goal:** keep the Keep alive through all 10 waves. Win when the last wave falls; lose if the Keep is destroyed.
- **Build:** place Spark Spires, Frost Towers and Ember Cannons on the field. Upgrade each tower to Lv3, or sell it back for 70% of its invested gold.
- **Fight:** Normal or Hard difficulty (Hard: tougher enemies, less starting gold, 1.5x score). Three enemy kinds — Gloom, Dart and Brute — plus the Dread Wisp boss with regeneration and summons.
- **Controls:** mouse to build/upgrade/sell, Space to start the next wave, P to pause, R to restart, H to toggle difficulty, M to mute. A next-wave preview shows what is coming.
- **Polish:** generative ambient music and sound effects (WebAudio), gold floaters, screen shake, muzzle flashes, a live demo behind the title screen.

## Run

```sh
node main.ts
```

`main.ts` copies the game and screenshots into `/output` and writes `/output/dossier.json`. Or serve the game directly:

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.
