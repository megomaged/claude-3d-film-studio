# Deterministic engine: state = f(frame)

**The one rule:** every pixel of frame *n* is a pure function of `t = n / FPS`. Render frame 600 alone, render it after frame 1080, or render it twice: the PNG must be byte-identical. That makes previews trustworthy, partial re-renders safe, and the film a repeatable benchmark.

## The page contract (`templates/index.html` + `src/main.js`)

```js
window.renderFrame = (n) => {          // draw frame n, resolve with n once the canvas AND the DOM overlay are committed
  renderAt(n);
  return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(n))));
};
window.__ready = true;                 // only after fonts are loaded and every shader variant has been compiled
window.__error = '…';                  // set on start-up failure, so the renderer aborts instead of hanging for 10 min
```
- `?capture=1` turns off the live loop. Without the flag, the page plays live: the wall clock chooses *which* frame to show, but the pixels are still `f(frame)`.
- **Warm up** by rendering a handful of frames from every section, then frame 0, before you set `__ready`. Otherwise the first captured frames stall on shader compilation, or differ.
- `await document.fonts.ready` (and `document.fonts.load(...)` for vendored fonts) before warm-up. A late font swap changes the overlay pixels.
- `renderer.setPixelRatio(1)` and a fixed canvas size. Never use `devicePixelRatio`.

## Kill every hidden source of randomness

| Source | Fix |
|---|---|
| `Math.random` in your code **and in libraries** (noise textures, AO kernels) | Replace `Math.random` with a seeded mulberry32 in a classic `<script>` **before** the import map / modules |
| per-instance variation (bolt k, particle i) | stateless `hash01(i, seed)`: independent of render order |
| `Date.now()`, `performance.now()`, `clock.getDelta()` | banned from the render path |
| simulation that integrates `dt` (particles, spin) | closed form: `x(t) = x0 + v·t + smoothWalk(i, t)`. For speed profiles, integrate analytically or precompute a table at build time (dt = 1/6000 s) |
| film grain / dithering | seed by frame index (`n % 97`), never by time |
| async texture/GLB loads finishing late | load everything, then warm up, then set `__ready` |

## Timeline module (`src/timeline.js`)

- `ramp(t, a, b, ease)`: eased 0→1 between a and b. `win(t, a, b, c, d)`: fade in a→b, hold, fade out c→d. `keyed(t, [[t, v], …])`: piecewise eased scalars for opacity schedules.
- `makeTrack(keys)`: a **C1 monotone cubic Hermite** over vector keys, using Fritsch–Carlson-limited tangents. It gives continuous velocity with no overshoot, so camera moves never jerk. Mark a key `hold: true` to stop dead on it.
- Physiology clocks are shared helpers:
  - Heartbeat at 72 bpm: atria, then ventricles.
  - Respiration with a 4 s cycle (40 % inhale). The diaphragm moves **down** on inhale.
  - Pulsatile flow uses the closed-form integral of the same phase, so particles speed up exactly on systole.

## Scenes

- **One continuous scene** (motor, body): one `applyState(t)` sets everything — camera, explode offsets, opacities, shader uniforms, lights, overlay — then one render.
- **Multi-scale films** (pen → skin → blood → molecule → organ): a scene registry, `{ id, t0, t1, create(ctx) → { scene, camera, update(t) } }`, with windows that **overlap** by about 0.5 s. A director renders the active scenes (at most 2) into their own HDR targets and composites them with a match-move zoom, a radial focus/zoom blur and a crossfade. Clamp the zoom scale to ≥ 1 so you never see black borders. Never use a hard cut.
- Keep layer/system state as data (`K` tables of `[t, opacity]` per unit) rather than if/else chains, so re-timing a section means editing one table.

## Transparency that holds up (ghosted skin, translucent housings)

- Draw ghost layers inner → outer: `renderOrder = rank * 2`. While the subject is exploded, order far → near.
- Give each ghost mesh a **depth pre-pass twin** (`colorWrite: false, depthWrite: true`) drawn just before it. Only the front-most surface then blends, which avoids self-sorting garbage on complex meshes.
- Use a Fresnel ghost: `alpha = p · (0.25 + 1.6 · fresnel)`. It reads as a medical "scan" instead of a flat 50 % fade.
- `pow(1 − |N·V|, k)` produces NaN when the dot product leaves [−1, 1]. Clamp it. The NaN blacked out frame 1199 of the anatomy film.
- On ANGLE/Metal, clipped geometry still wrote depth through a transparent skin, which showed as black toe patches. Draw the solid part (below the scan line) as a real opaque pass.

## Tests you can run without rendering

- **Camera continuity:** step the camera module over all frames in Node. Report the maximum translation per frame, the maximum view-direction change per frame, and the maximum velocity change. Our bar: ≤ 2°/frame for a turn (one move dropped from 3.5° to 1.9°/frame), and no spike in velocity change. `camera.js` exports `maxTurnPerFrame`.
- **Explode returns home:** the maximum offset at t ≥ 19 s must be exactly `0 m`. Also log the first and last displaced frames.
- **AABB interpenetration at peak explode:** log the overlap list at start-up. It must be `[]`.
- **Copy coverage:** every locked string appears in a caption schedule, and the section windows cover 0–40 s with no gap.
