# Brief lock and timeline

Do this before you write a line of 3D code. A 40-second film has 1200 frames, and every one needs a reason to exist.

## 1. Lock the numbers

| | Default | Notes |
|---|---|---|
| Duration | **40.000 s** | Exact. "About 40 s" turns into 39.97 s or 40.03 s, and the brief fails. |
| fps | 30 | `t = frame / 30` everywhere. |
| Frames | **1200** (frames 0–1199) | The last frame is t = 39.967 s. There is no frame at 40.0. |
| Resolution | 1920×1080, 16:9 | For a 9:16 reel, render 1080×1920 natively. Do not crop the 16:9 render. |
| Codec | H.264 High, yuv420p, CRF 16, `+faststart` | A 40 s master is about 62 MB. Re-encode for social. |

Write these values into `src/timeline.js` (`FPS`, `FRAMES`, `W`, `H`). The renderer imports them from there.

## 2. Timeline table (one row per beat, exact second boundaries)

Copy the brief's sections into a table and keep it as the single source of truth.

```
| s       | beat                       | camera                       | on screen (locked copy)                     |
|---------|----------------------------|------------------------------|---------------------------------------------|
| 0–5     | hero, emerge from dark     | slow ¾ orbit                 | TITLE / subtitle                            |
| 5–11    | layers / components        | dolly in, highlight 1-by-1   | 6–9 labels, ~0.6–0.85 s apart               |
| 11–19   | exploded view (the money shot) | pull back, fly through   | small labels as parts arrive                |
| 19–28   | how it works (3 sub-beats) | close-ups                    | 3 captions, ~3 s each                       |
| 28–34   | cross-section / micro scale| hold + rack focus            | legend, process chain (5–6 chips)           |
| 34–38   | everything running         | wide, motion                 | one summary caption                         |
| 38–40   | final hero                 | slow orbit, cut-away         | end line + credit                           |
```

Then encode the table:
- `SECTIONS` in `timeline.js`.
- Per-element windows: `win(t, in0, in1, out0, out1)` for every label, caption and effect.
- Camera keys at or near the section boundaries.

## 3. Lock the copy

Put every on-screen string in one module (`COPY` / `copy.js`), byte-for-byte from the brief. Scenes import strings from that module and never type them inline.
A QC script can then grep that the strings exist, and you can read the DOM after `renderFrame(n)` to prove each string is on screen at its time. The anatomy film's validation report lists the visible text at frames 75, 650, 720, 820, 1020, 1100 and 1199.

Rules that held up:
- Captions should be at least 38–44 px at 1080p, and titles at least 84–104 px. Keep an 80 px safe area. Put captions on a dark scrim when they sit over anatomy.
- Allow 0.6–0.85 s per highlighted label. Keep each caption up for at least 1.6 s at full opacity. In one review, five skin labels each got about 1 s and only one was readable. That was a FAIL.
- Never put a title over the hero object. Use the camera's lens shift (film offset) to move the subject aside instead of moving the subject.
- If the subject is a brand, the brief usually forbids logos and trade dress. Build a generic product and show only the generic or scientific name.

## 4. Decide what is real before you build

For each thing on screen, write one line: **real dataset**, **procedural (engineered)** or **conceptual (illustrative)**. That line goes into the asset manifest and the validation report (see `qc-and-delivery.md`).
Two examples:
- In the tirzepatide film, the fatty-diacid side chain is not resolved in any cryo-EM structure. It is shown as *conceptual geometry* and labelled that way.
- The anatomy film has a subcutaneous layer that is a 3 mm inset of the skin. It is listed as a stand-in.

## 5. Questions worth asking (at most three)

1. Does it need music and SFX? We assume yes. Every owner so far has wanted it.
2. Will it go on social? If so, you need a 9:16 version and possibly safety edits, such as blurring nudity on anatomy bodies.
3. Is the asset licence acceptable for the use? CC BY-SA requires an on-screen credit, and ShareAlike applies to the adapted meshes.

If nobody answers, choose the defaults above and write them into `QUESTIONS.md` as assumptions.
