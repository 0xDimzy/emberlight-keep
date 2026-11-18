// Emberlight Keep — the hand-in program (Node 22, standard library only).
// It gathers the game and its screenshots from beside this file into /output
// and writes /output/dossier.json, the summary the judge reads, using the
// vendored make.fun library. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Caps mirror the scorer's gate: at most 4 screenshots of 256 KiB, game/ at
// most 993 files and 48 MiB, no game path over 1000 bytes, dossier text
// capped at 160 KiB. An entry over a cap is refused before it is judged.
// Both grader runs must write identical bytes, so there is no timestamp,
// no randomness and no reordering anywhere in this program.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
