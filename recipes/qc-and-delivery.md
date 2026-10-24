# QC and delivery

A film is done when the evidence says so, not when the render finishes. Every claim in the report must come from a command you ran or a frame you looked at.

## 1. Stills before the full render

Render 12–17 stills: every section boundary, the busiest moment of each section, and the first and last frames. **Open every one** and write one line per still describing what you see. That line is how bugs get caught. Examples from our receipts:
- A NaN in a Fresnel term blacked out frame 1199.
- The lungs hid the heart in the cardiovascular highlight.
- The alveoli were clipped by a wrong `uClipAbove` default.
- The micro-scene camera sat inside a red blood cell.
- Labels overlapped, or the Brain label was off-screen.
- Black toe patches appeared during the skin scan.
- The rear bearing was hidden behind the housing in the explode.

## 2. The validation report (`VALIDATION.md`)

One table with PASS/FAIL and the evidence for each item. This is the anatomy film's set, which works for any brief:

| # | Check | Evidence |
|---|---|---|
| 1 | Exactly 40.0 s | decode `time=00:00:40.00` + `Duration: 00:00:40.00` |
| 2 | Exactly 1200 frames | decode `frame= 1200`; renderer `-frames:v 1200` |
| 3 | 1920 × 1080 | Stream line |
| 4 | 30 fps | Stream line `30 fps, 30 tbr`; `t = n / 30` in code |
| 5 | Subject coherent / plausible | named stills + spatial checks (organ sides, part order) |
| 6 | Exploded view keeps relationships | pure translations; AABB overlap list at peak = `[]` |
| 7 | Parts return home | max offset after reassembly = `0 m` |
| 8 | No transparency artefacts | depth twins, layer order, AO/DOF filter; stills list |
| 9 | Flows/forces go the right way | path table: start → end per particle path (e.g. RA→RV→PT→lungs→PV→LA→LV→aorta) |
| 10 | Motions synchronised with their visuals | one clock drives mesh + particles + glow |
| 11 | No camera jumps | camera QC numbers (max °/frame, max velocity change) |
| 12 | Labels readable, not over the subject | sizes, scrims, stills |
| 13 | Scenes match the timeline | section table vs. brief |
| 14 | Repeat renders identical | `cmp` + SHA-256, different render order |
| 15 | Ends at 40.0, no extra hold frame | last index 1199, `-frames:v 1200` |

Then two honest sections:
- **Limitations:** which assets are stand-ins or conceptual, what is decimated, what is time-compressed or slowed (for example, nerve conduction slowed from about 50–100 m/s), what is an approximation (wrap-lighting SSS, screen-space AO, fake volumetrics), and the determinism scope (one machine and GPU).
- **Attribution:** the exact credit strings, plus where they appear on screen and from when.

Don't call the result "photorealistic" if it isn't. "Clean medical CGI" is honest and still impressive.

## 3. Second-model accuracy review

The model that built the film should not grade its own science. Give a second model (another vendor if you can) **read-only** access to the brief, the locked copy, the timeline table, the asset manifest and 10–16 stills. Ask it to list every scientific or engineering claim that is wrong, ambiguous or overstated. Then:
1. **Verify each finding yourself.** Reviewers hallucinate too. Accept only findings you can confirm in the frames or the sources.
2. Fix, re-render the affected stills, and record each finding with its fix (or rejection) in the review file.

Typical catches:
- Pulmonary arteries coloured red. The convention is blue for deoxygenated.
- O₂ shown floating free in plasma. It must ride on red blood cells.
- The diaphragm going up on inhale.
- Whole-brain flashing, when nerve impulses should travel along selected pathways.
- A drug that "melts fat".
- Instant effects. Show time compression.
- Efficacy numbers that the brief never gave.

## 4. Final checks on the delivered files

```bash
bash scripts/qc.sh film.mp4 1200 3            # decode count + contact sheet every 3 s (look at it)
bash scripts/qc.sh film_audio.mp4 1200 3      # + loudness
ffmpeg -ss 0 -i film.mp4 -frames:v 1 f0.png   # and 25/50/75 %, last frame: the encode matches the stills
pgrep -fl "Google Chrome.*--headless"         # nothing left running
```

## 5. Delivery folder

```
deliverables/
  film_40s.mp4          silent master (benchmark)
  film_40s_audio.mp4    music + SFX, −14 LUFS
  VALIDATION.md         the table above + raw command output + limitations + attribution
src/  (README: run, render, architecture, how to swap an asset)    assets/manifest.json    audio/
DELIVERY.md             what, where, how to regenerate (render time), open taste notes
```

## Gallery (README previews)

```bash
# stills: 960 wide jpg
ffmpeg -ss 14.0 -i film.mp4 -frames:v 1 -vf scale=960:-2:flags=lanczos -q:v 3 still.jpg
# hero GIF: ≤ 4 s, 640 wide, ≤ 3 MB (10 fps, 72 colours, bayer dither keeps it small)
ffmpeg -ss 12.3 -t 3.5 -i film.mp4 -vf "fps=10,scale=640:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=72:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" hero.gif
```
Use the social-safe cut for anything public (see the anatomy recipe). Look at every frame of the GIF as a tiled sheet before publishing it.
