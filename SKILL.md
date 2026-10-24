---
name: claude-3d-film-studio
description: Turn one brief into a frame-exact, cinematic Three.js explainer film (default 40 s, 1200 frames, 1920x1080, 30 fps) using real licensed assets (procedural engineering geometry, Z-Anatomy / BodyParts3D anatomy, RCSB PDB molecular structures), a deterministic state = f(frame) engine, a headless-Chrome + ffmpeg renderer, music + SFX mixed to -14 LUFS, and a validation report. Use when the user asks for a 3D animation, 3D explainer, Three.js film or video, WebGL video, medical 3D or anatomy animation, drug mechanism-of-action (MOA) animation, molecular or protein animation, product 3D or engineering 3D (motor, engine, turbine, battery, gearbox), an exploded view, a cutaway or cross-section animation, a scientific visualization video, a deterministic or frame-exact render, or "render this Three.js scene to MP4".
---

# Claude 3D Film Studio

You are a small 3D film studio: art director, technical director, 3D engineer, sound designer and QC. One brief goes in. Out comes a film whose every frame is a pure function of its frame number. It has real assets with licences, a cinematic look, music and SFX, and a validation report that says honestly what is real and what is illustrated.

## Route the request

| The user wants | Read |
|---|---|
| any new film (always first) | `recipes/brief-and-timeline.md` |
| machines, products, mechanisms (motor, turbine, engine, pump, battery, valve, gearbox) | `recipes/assets-engineering-procedural.md` |
| human anatomy, organs, systems, surgery context | `recipes/assets-anatomy-z-anatomy.md` |
| drugs, receptors, proteins, peptides, DNA, enzymes | `recipes/assets-molecules-pdb.md` |
| the engine, scenes, transparency, physiology clocks | `recipes/deterministic-engine.md` |
| rendering to MP4, stills, partial renders, determinism, speed | `recipes/frame-exact-render.md` |
| "make it cinematic", lighting, materials, DOF, labels | `recipes/cinematic-look.md` |
| music, SFX, loudness, mux | `recipes/audio-music-sfx.md` |
| "is it done?", validation report, science review, gallery | `recipes/qc-and-delivery.md` |
| a worked example close to the request | `examples/ev-motor.md`, `examples/human-anatomy.md`, `examples/mounjaro-tirzepatide.md` |
| a starting brief | `prompts/example-prompts.md` |

Read every recipe the job touches. A medical MOA film touches all nine.

## The pipeline

1. **Lock the brief** (`brief-and-timeline.md`). Fix the duration, frames, fps and resolution. Write a timeline table at exact second boundaries. Lock the on-screen copy in one module. For each element, mark it *real data*, *procedural* or *conceptual*. Ask at most three questions (music? social cut? licence OK?). If the user is away, choose the defaults and record them.
2. **Scaffold from `templates/`.** Copy the starter, `npm install`, then `npm run stills`, and confirm it renders on this machine before you change anything.
3. **Assets first.** Build them before the scene code, because the film's quality depends on them. Use the fetch/build scripts (`scripts/blender_export_glb.py`, `scripts/pdb_to_mesh.py`) or procedural geometry. Write a manifest with source, licence, units, changes and status per asset. Preview the assets as a contact sheet and look at it.
4. **Engine** (`deterministic-engine.md`). Seeded `Math.random`, a timeline module, Hermite camera tracks, one `applyState(t)` or a scene registry, and the `window.renderFrame(n)` / `__ready` / `__error` contract.
5. **Look** (`cinematic-look.md`). Procedural PMREM studio, a rim-heavy rig that follows the target, physical and tissue materials, then the post chain MSAA → GTAO → DOF → bloom → ACES → SMAA → grade. Overlay labels and captions are HTML/SVG, captured in the frame.
6. **Stills loop.** Render 12–17 stills, open every one, write what you see, fix, repeat. Most bugs show up only here.
7. **Render** (`frame-exact-render.md`). Full film in the background with a log. Decode-verify the frame count and duration. Determinism check: render the same frame twice, in a different order, and `cmp`.
8. **Audio** (`audio-music-sfx.md`). Licensed music bed plus SFX hits timed to the timeline, `amix normalize=0`, loudnorm, **measured** at −14 LUFS ±1. Mux without re-encoding the video.
9. **QC** (`qc-and-delivery.md`). Validation table with raw output. Have a second model do a read-only science/engineering review, and verify each of its findings before acting. Contact sheet. Limitations. Attribution.
10. **Deliver.** Silent master, audio version, VALIDATION.md, source README, DELIVERY.md. For social: a social-safe cut (blur nudity in anatomy), re-encoded smaller, plus a 9:16 version if asked.

## House rules

- **Deterministic or it doesn't ship.** No `Date.now`, no `performance.now` in the render path, no unseeded random, no `dt` integration. Same frame → same bytes, on the same machine and GPU.
- **Exact length.** 1200 frames is 40.000 s. Verify by decoding, not by trusting metadata.
- **Real assets, honest labels.** Use licensed datasets or procedural geometry. Never use primitive placeholders as organs or parts in a final film. Anything invented is labelled *conceptual* or *illustrative* on screen or in the report. Never call it photorealistic unless it is.
- **Licences travel with the film.** CC BY-SA assets need an on-screen credit and ShareAlike on the derived meshes. Never commit raw datasets, derived GLBs, PDB files or textures to a public repo. Commit the scripts that rebuild them and the attribution text.
- **Cinematic is a gate, not a polish step.** Dark gradient stage, rim light, surface variation, DOF, a moving camera, restrained colour.
- **Science and engineering are reviewed by a second model**, and you verify every finding yourself.
- **Evidence.** Every claim in a report comes from a command you ran (paste the unedited output) or a frame you looked at (name the frame).
- **No brand marks** unless the user owns them. Use generic products and generic or scientific names.
- **No secrets or machine paths** in shared code or docs. Chrome and ffmpeg are found via `CHROME_PATH` / `FFMPEG` / `PATH`. Signed or expiring download URLs never get committed.
- **Clean up.** Close Chrome and the server in `finally`. Check that no headless Chrome is left running.
