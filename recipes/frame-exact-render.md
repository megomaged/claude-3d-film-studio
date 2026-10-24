# Frame-exact render: Chrome → PNG → ffmpeg

`templates/render.mjs` is the renderer. It is the same design that rendered all three films (1200 frames each, about 0.5–0.6 s per frame on an Apple M3 Pro).

## How it works

1. Start a static server on `127.0.0.1` with a random port. ES modules and import maps break under `file://`.
2. Launch **system Chrome** through `puppeteer-core`, so there is no 150 MB Chromium download:
   - `headless: true`
   - `defaultViewport {1920, 1080, deviceScaleFactor: 1}`
   - `protocolTimeout: 600000`
   - args: `--use-angle=metal` (macOS GPU; elsewhere `default`/`d3d11`/`vulkan`, or `swiftshader` for CPU), `--enable-gpu --ignore-gpu-blocklist --enable-unsafe-swiftshader`, `--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows`, `--force-color-profile=srgb --font-render-hinting=none --hide-scrollbars`
3. `goto(…?capture=1)`, then `waitForFunction('window.__ready === true || !!window.__error')`. Throw on `__error`.
4. Log the GPU string (`WEBGL_debug_renderer_info`). If it says SwiftShader on a Mac, your GPU flags are wrong and the render will be 10× slower.
5. For each frame: `await page.evaluate(n => window.renderFrame(n), n)`. Assert the returned n. Then `page.screenshot({type:'png', clip:{0,0,W,H}})`. The screenshot includes the **HTML overlay**, which is why labels can be DOM and SVG.
6. Pipe the PNGs into ffmpeg's stdin. Respect backpressure (`if (!stdin.write(buf)) await once('drain')`):
   ```
   ffmpeg -y -framerate 30 -f image2pipe -c:v png -i - -an -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow \
          -r 30 -frames:v 1200 -movflags +faststart film.mp4
   ```
   `-frames:v N` is what makes the length exact: no extra hold frame, no dropped tail.
7. Close the browser and the server in `finally`, and also on SIGINT/SIGTERM. Afterwards, `pgrep -fl "Google Chrome.*--headless"` should return nothing.

## Modes

```bash
node render.mjs --stills 75,150,330,600,900,1170   # preview PNGs: look at them FIRST
node render.mjs --from 570 --to 840                # partial MP4 for one section
node render.mjs                                    # the film
node render.mjs --frames-dir out/frames            # also keep every PNG (determinism diffs, GIFs)
```

## Verify by decoding (the ffprobe gotcha)

`ffprobe` is often not installed, and container metadata can lie. **Decode the file and read the last `frame=`**:
```
ffmpeg -hide_banner -i film.mp4 -map 0:v -f null - 2>&1 | tail -3
…  frame= 1200 fps=1082 q=-0.0 Lsize=N/A time=00:00:40.00 bitrate=N/A speed=36.1x
ffmpeg -hide_banner -i film.mp4 2>&1 | grep -E "Duration|Stream"
  Duration: 00:00:40.00 … Stream #0:0 … yuv420p(progressive), 1920x1080 … 30 fps
```
- ffmpeg writes progress with carriage returns, so `| tail -2` can show one long line with several `frame=` values. Take the **last** one. `render.mjs` does this automatically and prints `verify: frames=1200 … → OK`.
- The `Stream` line goes to stderr before the progress output, so grep for it with a second command.

## Determinism check (every delivery)

```bash
node render.mjs --stills 600,960 --stilldir detA
node render.mjs --stills 100,960,600 --stilldir detB     # different order on purpose
cmp detA/frame_0600.png detB/frame_0600.png && echo identical
shasum -a 256 detA/frame_0960.png detB/frame_0960.png
```
Scope: byte-identical on one machine, GPU, driver and Chrome build. Other GPUs can differ by a few pixel values; timing and state never do. Say this in the report.

## Speed and budgets

| Film | ms/frame | 1200 frames |
|---|---|---|
| EV motor (GTAO + DOF + bloom, motion blur up to 14 sub-frames from 34–38 s) | ~600 | 12 min |
| Human anatomy (3.3 M tris, 59 meshes, micro scene) | 520 | 10.5 min |
| Starter demo (`templates/`, 150 frames) | ~750 | ~2 min |

- Run the full render in the background with a log file. Poll the log; don't block a session on it.
- Motion blur is deterministic sub-frame accumulation. N = `clamp(ceil(degPerFrame / 4.5), 1, 14)` samples across a one-frame shutter centred on t, accumulated additively in a HalfFloat target. Then re-apply state at exactly t so the overlay uses the frame time.
- A CRF 16 master is about 62 MB for 40 s. For social, re-encode a copy (CRF 20–23, `-maxrate`) and keep the master.

## Previews worth making

- **Contact sheet** every 2–3 s: `ffmpeg -i film.mp4 -vf "fps=1/3,scale=480:-2,tile=4x4" -frames:v 1 contact.jpg`.
- **Stills at every section boundary** plus the busiest moment in each section.
- **Frames decoded from the MP4** (not just the PNG stills) at 0, 25, 50, 75 % and the last frame. This proves the encode matches the render.
