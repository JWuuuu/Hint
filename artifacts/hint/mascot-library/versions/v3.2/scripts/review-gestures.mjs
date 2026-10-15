import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gestures } from '../src/motion.js';

const { chromium } = createRequire(import.meta.url)('@playwright/test');
const sharp = createRequire(process.env.HINT_TOOLS_PACKAGE || import.meta.url)('sharp');
const out = fileURLToPath(new URL('../evidence/', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 430, height: 850 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const errors = [];page.on('pageerror', e => errors.push(e.message));
await page.goto(process.env.HINT_PREVIEW_URL || 'http://127.0.0.1:8767/versions/v3.2/preview/index.html');
await page.waitForFunction(() => document.getElementById('hint-gestures-v3').mascot);
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(gestures).filter(n => !n.includes('letter'));
for (const id of names) {
  await mkdir(path.join(out, id), { recursive: true });
  await page.evaluate(id => {
    const a = document.getElementById('hint-gestures-v3').mascot;a.resetScene();
    if(id==='deliver-letter'){a.playGesture('offer-letter');a.seek(2.4);a.acceptLetter();}
    else a.playGesture(id);
    a.pause();
  }, id);
  const duration = gestures[id].duration, tiles = [];
  for (let i = 0; i < 12; i++) {
    const time = duration * i / 11;
    await page.evaluate(t => document.getElementById('hint-gestures-v3').mascot.seek(t), time);
    const png = await page.locator('canvas').screenshot();
    await writeFile(path.join(out, id, `${i}.png`), png);
    const label = Buffer.from(`<svg width="220" height="244" xmlns="http://www.w3.org/2000/svg"><text x="10" y="235" font-family="sans-serif" font-size="12" fill="#6c445f">${time.toFixed(2)} s</text></svg>`);
    const tile = await sharp({ create: { width: 220, height: 244, channels: 4, background: '#faf7f2' } }).composite([{ input: await sharp(png).resize(220,220).toBuffer(), top: 0, left: 0 }, { input: label }]).png().toBuffer();
    tiles.push({ input: tile, left: (i % 4)*220, top: Math.floor(i/4)*244 });
  }
  await sharp({ create: { width: 880, height: 732, channels: 4, background: '#faf7f2' } }).composite(tiles).png().toFile(path.join(out, `${id}-review.png`));
  console.log(JSON.stringify({ gesture: id, frames: 12 }));
}
console.log(JSON.stringify({ errors }));
await browser.close();
