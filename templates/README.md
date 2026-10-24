# Starter: a deterministic Three.js film in 150 frames

This is a minimal version of the pipeline used for the 40-second films. It renders a 5-second demo: a procedural turbine rotor with an orbit, an exploded view with labels, reassembly and an end card. Every pixel is a function of the frame number. To make a real film, grow it rather than starting from scratch.

```bash
npm install                     # three 0.170.0 + puppeteer-core 23.10.4, pinned
npm run serve                   # live preview → http://127.0.0.1:8080/  (must be http, not file://)
npm run stills                  # PNGs → out/stills/   look at them before rendering the full film
npm run render                  # 150 frames → out/film.mp4, then decode-verified (frames + duration)
npm run qc                      # frame count + contact sheet (+ loudness if there is audio)
```
You need Node 18+, Google Chrome or Chromium installed, and `ffmpeg` on your PATH.
If either one lives somewhere unusual, set `CHROME_PATH=…` or `FFMPEG=…`. On Linux without a GPU, use `ANGLE=swiftshader`.
That is slow but still deterministic.

| file | role |
|---|---|
| `index.html` | seeded `Math.random` installed before any module loads; import map → `node_modules/three`; stage + HTML overlay |
| `src/timeline.js` | FPS/FRAMES, section table, locked copy, easing (`ramp`, `win`, `keyed`), C1 Hermite `makeTrack`, seeded `rng`/`hash01`, closed-form rotor angle |
| `src/camera.js` | one spline over `[az, el, dist, target, lens shift]`; `maxTurnPerFrame` QC helper |
| `src/post.js` | MSAA → GTAO → bokeh DOF → bloom → ACES/sRGB → SMAA → vignette + seeded grain; keeps FX out of AO/DOF depth |
| `src/main.js` | studio PMREM, light rig, seeded textures, procedural geometry, overlay labels, `window.renderFrame(n)` / `window.__ready` / `window.__error` |
| `render.mjs` | static server → system Chrome → screenshot per frame → ffmpeg pipe → decode-verify. `--stills`, `--from/--to`, `--frames-dir` |
| `serve.mjs` | localhost static server; `/assets/*` serves your GLBs in place |
| `scripts/qc.sh` | frame count, contact sheet, loudness |
| `scripts/mix_audio.sh` | music + timed SFX → exact length, −14 LUFS → mux |
| `scripts/blender_export_glb.py` | FBX/OBJ/glTF (Z-Anatomy, BodyParts3D, CAD) → aligned, budgeted GLBs + manifest |
| `scripts/pdb_to_mesh.py` | RCSB PDB structure → molecular-surface GLB (nm units, `_CAVITY` attribute) + manifest |

For a 40-second film, set `FRAMES = 1200` in `src/timeline.js`. Then replace `SECTIONS`, `COPY`, `CAM_KEYS` and the scene in `main.js`.
`render.mjs` reads `FPS`, `FRAMES`, `W` and `H` from `timeline.js`, so it never disagrees with the film.
