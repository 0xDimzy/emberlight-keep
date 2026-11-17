// Emberlight Keep — take the four screenshots with Playwright: serve game/,
// load each ?shot= scene, wait for window.__shotReady, save a JPEG.
import { chromium } from '/home/hatch/workspace/makefun/pwtest/node_modules/playwright-core/index.mjs';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const shots = JSON.parse(
  (await import('node:fs')).readFileSync(join(here, 'shots.json'), 'utf8'),
);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const badRequests = [];
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith('http://localhost:8080') && !url.startsWith('http://127.0.0.1:8080')) {
    badRequests.push(url);
  }
});

for (const shot of shots) {
  const url = `http://localhost:8080/${shot.query}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(300);
  const out = join(here, 'screenshots', shot.name);
  await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
  const size = (await import('node:fs')).statSync(out).size;
  console.log(`saved ${shot.name} from ${shot.query} (${size} bytes)`);
}
console.log('console errors:', JSON.stringify(consoleErrors));
console.log('non-local requests:', JSON.stringify(badRequests));
await browser.close();
