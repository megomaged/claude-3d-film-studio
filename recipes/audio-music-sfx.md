# Audio: music + SFX on the timeline, −14 LUFS, muxed

Every film so far was delivered twice: a silent benchmark MP4 and an `_audio.mp4` with music and SFX. Plan for both.

## Sources (licensed only)

- **Music:** one cinematic-tech or ambient-science bed, at least 40 s long. It should be built to fade, with no vocals. Use a track you have the rights to: a licensed library, a generator whose terms let you publish, or your own.
- **SFX:** 5–8 short hits mapped to beats. These sets worked:
  - Engineering: whoosh, explode/separate, clunk (lock-in), electric surge, spin-up, UI tick.
  - Anatomy: scan sweep, separate, heartbeat, breath, neural zap, blood flow, tick.
  - Drug MOA: whoosh, injection, blood flow, dock (binding), shimmer (activation).
- Store them as `audio/music.mp3` and `audio/sfx/*.mp3`. Record each source and its licence in the asset manifest. **Never commit signed or expiring download URLs**: they are private to your account. Download once, then keep the files outside the public repo.

## Spot the hits from the timeline

Take the times from your `SECTIONS`, `EXPLODE` and label schedule, not by ear:

| Beat | EV motor (ms) | Anatomy (ms) |
|---|---|---|
| open whoosh / scan | 0 | 3500 (skin scan) |
| label ticks | 5400 + i·620 (9 labels) | 5600 + i·850 (6 labels) |
| explode | 11000 | 11000 (separate) |
| reassemble lock | 18900, 19700 (clunks) | 17000 (separate, reversed) |
| "how it works" starts | 20000 (surge) | 19000 heartbeat (fade in 0.8 s, out at 8.5 s) |
| high-speed / systems | 25800 (spin-up, fade at 11 s) | 21800 breath, 25400 neural, 28000 blood flow |
| final hero | 37700 (whoosh) | 38000 (scan) |

## Mix (`templates/scripts/mix_audio.sh`)

```
[0:a]volume=0.85[m]; [k:a]adelay=MS|MS,volume=V[hk]; …
[m][h1]…[hN]amix=inputs=N+1:normalize=0, atrim=0:40, afade=t=out:st=38.8:d=1.2,
loudnorm=I=-14:TP=-1.0:LRA=11, aresample=48000
```
- **`amix normalize=0`.** The default divides every input by the input count. With 19 inputs the music falls by about 25 dB.
- **`adelay=MS|MS`** needs one value per channel. A single value delays only the left channel.
- Reuse one SFX several times with `asplit=N`. Reverse it for a "return" with `areverse`.
- `atrim=0:40` plus `-t 40` on both the mix and the mux pins the length. The film must still decode to `frame= 1200 … time=00:00:40.00` after muxing.
- Mux with `-map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k`. Never re-encode the video for audio.

## Measure, don't trust

Single-pass `loudnorm` lands 0.5–1.5 LU off the target on short programmes. The EV film measured about −13 LUFS. For the anatomy film we set `I=-13.1` to land at −14.6. Always measure the muxed file:
```
ffmpeg -hide_banner -i film_audio.mp4 -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
```
Targets: integrated −14 LUFS ±1, true peak ≤ −1 dBTP. If it is off, nudge `I=` and re-run. Or use two-pass loudnorm: measure with `print_format=json`, then feed back `measured_I`, `measured_TP`, `measured_LRA`, `measured_thresh` and `offset`.

## Taste notes

- The music sits under the SFX. Hits should be felt, not heard as clicks: ticks at 0.3–0.35 volume, impacts at 0.7–0.9.
- Fade the tail over the last 1.2 s so the end card lands in near-silence. Do not hard-stop.
- Sync each hit to the *visual* event frame (the explode starts at 11.2 s, so the hit goes at 11.0 s to lead slightly). Check by scrubbing the muxed file at the hit times.
