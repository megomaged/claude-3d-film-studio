// Frame-exact offline renderer: local static server → system Chrome (puppeteer-core) → window.renderFrame(n)
// → PNG screenshot (canvas + HTML overlay) → piped to ffmpeg (H.264) → frame count + duration verified.
//
//   node render.mjs                          full film            → out/film.mp4
//   node render.mjs --from 0 --to 59         partial (inclusive)  → out/partial_0_59.mp4
//   node render.mjs --stills 0,75,149        PNG stills           → out/stills/frame_0075.png
//   options: --out <file>  --stilldir <dir>  --frames-dir <dir> (also keep every PNG)  --port <n>
//   env:     CHROME_PATH=/path/to/chrome   FFMPEG=/path/to/ffmpeg   ANGLE=metal|d3d11|vulkan|swiftshader|gl
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { handler } from './serve.mjs';
import { FPS, FRAMES, W, H } from './src/timeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

function findChrome() {
  const c = [process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  const hit = c.find((p) => fs.existsSync(p));
  if (!hit) throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH.');
  return hit;
}
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const ANGLE = process.env.ANGLE || (process.platform === 'darwin' ? 'metal' : 'default');

const stills = arg('--stills') ? arg('--stills').split(',').map((s) => parseInt(s, 10)) : null;
const from = parseInt(arg('--from', '0'), 10);
const to = parseInt(arg('--to', String(FRAMES - 1)), 10);
const full = !stills && from === 0 && to === FRAMES - 1;
const out = path.resolve(arg('--out', path.join(HERE, 'out', full ? 'film.mp4' : `partial_${from}_${to}.mp4`)));
const stillDir = path.resolve(arg('--stilldir', path.join(HERE, 'out', 'stills')));
const framesDir = arg('--frames-dir') ? path.resolve(arg('--frames-dir')) : null;
const pad = (n) => String(n).padStart(4, '0');

/** Verify an encode by decoding it. ffprobe is often missing, and container metadata can lie; a decode cannot. */
function verify(file, expectFrames, fps) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-map', '0:v', '-f', 'null', '-'], { encoding: 'utf8' });
  const log = r.stderr || '';
  // ffmpeg prints progress with carriage returns; take the LAST "frame=" value
  const frames = [...log.matchAll(/frame=\s*(\d+)/g)].map((m) => +m[1]).pop();
  const dur = (log.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).map(Number);
  const seconds = dur.length ? dur[0] * 3600 + dur[1] * 60 + dur[2] : NaN;
  const ok = frames === expectFrames && Math.abs(seconds - expectFrames / fps) < 0.0005;
  console.log(`verify: frames=${frames} (expected ${expectFrames}) duration=${seconds.toFixed(3)}s (expected ${(expectFrames / fps).toFixed(3)}s) → ${ok ? 'OK' : 'MISMATCH'}`);
  return ok;
}

const server = http.createServer(handler(HERE));
await new Promise((r) => server.listen(parseInt(arg('--port', '0'), 10), '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html?capture=1`;

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  protocolTimeout: 600000,
  args: [
    `--window-size=${W},${H}`, `--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none',
  ],
});
let ff = null;
const cleanup = async () => { try { await browser.close(); } catch {} try { server.close(); } catch {} };
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, async () => { await cleanup(); if (ff) ff.kill('SIGKILL'); process.exit(130); });

let exitCode = 0;
try {
  const page = await browser.newPage();
  page.on('console', (m) => { const t = m.text(); if (!/GPU stall|Automatic fallback/.test(t)) console.log('[page]', t); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('requestfailed', (r) => console.error('[requestfailed]', r.url()));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  const tl = Date.now();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__ready === true || !!window.__error', { timeout: 600000, polling: 200 });
  const perr = await page.evaluate(() => window.__error || null);
  if (perr) throw new Error('page failed: ' + perr);   // fail fast instead of hanging on a broken page
  const gpu = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('webgl2');
    const e = c && c.getExtension('WEBGL_debug_renderer_info');
    return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log(`GPU: ${gpu} | page ready in ${((Date.now() - tl) / 1000).toFixed(1)} s`);

  const shot = async (n) => {
    const got = await page.evaluate((k) => window.renderFrame(k), n);
    if (got !== n) throw new Error(`frame mismatch ${got} != ${n}`);
    return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H }, captureBeyondViewport: false, optimizeForSpeed: false });
  };

  const t0 = Date.now();
  let count = 0;
  if (stills) {
    fs.mkdirSync(stillDir, { recursive: true });
    for (const n of stills) {
      const f = path.join(stillDir, `frame_${pad(n)}.png`);
      fs.writeFileSync(f, await shot(n));
      count++;
      console.log('wrote', path.relative(process.cwd(), f), `t=${(n / FPS).toFixed(3)}s`);
    }
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (framesDir) fs.mkdirSync(framesDir, { recursive: true });
    count = to - from + 1;
    ff = spawn(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-f', 'image2pipe', '-c:v', 'png', '-i', '-',
      '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-r', String(FPS), '-frames:v', String(count),
      '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
    for (let n = from; n <= to; n++) {
      const buf = await shot(n);
      if (framesDir) fs.writeFileSync(path.join(framesDir, `frame_${pad(n)}.png`), buf);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if ((n - from) % 30 === 0 || n === to) {
        const el = (Date.now() - t0) / 1000, done = n - from + 1;
        console.log(`frame ${n}/${to}  ${done}/${count}  ${el.toFixed(0)}s elapsed  eta ${((el / done) * (count - done)).toFixed(0)}s`);
      }
    }
    ff.stdin.end();
    await ffDone;
    console.log('wrote', path.relative(process.cwd(), out));
    if (!verify(out, count, FPS)) exitCode = 2;
  }
  const wall = (Date.now() - t0) / 1000;
  console.log(`render wall time: ${wall.toFixed(1)} s for ${count} frames (${((wall * 1000) / Math.max(1, count)).toFixed(0)} ms/frame)`);
} catch (e) {
  console.error(e.message || e);
  exitCode = 1;
} finally {
  await cleanup();
}
process.exit(exitCode);
