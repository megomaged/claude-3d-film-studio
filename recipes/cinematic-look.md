# Cinematic look: "not a plain model"

Hard gate from the first owner of these films: **"cinematic, not a plain model."** A default-viewer look (grey studio, flat light, model centred, nothing moving) is a FAIL even when the geometry is correct. These are the ingredients that passed review, in order of impact.

## 1. Light like a product commercial

- **Environment:** build a procedural PMREM from emissive panels inside a dark box. No HDRI file to license, and full control. Panels:
  - an overhead soft box (12×7, about 5.0 intensity)
  - a cool strip on the left (1.6×14, RGB 3.2/3.8/5.0)
  - a warm strip on the right (5.0/4.4/3.6)
  - a weak frontal fill
  - a back kicker
  - a dim floor bounce

  `environmentIntensity` ~0.95. Keep separate environments per scale for multi-scale films: studio, tissue, blood, lab.
- **Rig:** a key (warm, shadows 2048–4096², PCFSoft, bias −0.0002, normalBias 0.02), a **strong cool rim** (≈3.0) from behind-left, a warm rim from behind-right, and a low fill from below. **Move the rig with the camera target** every frame, so the rim always reads whatever the framing.
- **Background:** never flat black. Paint a radial gradient once on a canvas (#1a2129 centre → #0d1217 → #020304 edge). The subject should emerge from darkness at t = 0.
- **Volumetrics:** cheap and convincing: 2-D additive light shafts in the grade pass (an angular cosine pattern from above the frame, falling off with distance), plus a radial haze veil. Keep them under 6 % intensity.

## 2. Materials with life

- MeshPhysicalMaterial everywhere. Combine clearcoat, sheen and roughness variation. Nothing should be perfectly uniform.
- **Tissue without UVs** (anatomy and organ GLBs have none): patch the standard shader with object-space procedural detail.
  - 3-D value-noise fbm → derivative bump (`perturbNormalArb`-style), plus colour and roughness variation.
  - Muscle-fibre striation along each muscle's principal axis. Bake the PCA axis as a vertex attribute.
  - Wet clearcoat on organs (0.6–0.8 on liver and heart).
- **SSS approximation:** a wrap-lighting term injected into `lights_physical_pars_fragment`:
  `wrapNL = saturate((N·L + w) / (1 + w))`, then add `(wrapNL − N·L) · irradiance · albedo · sssColor`. Use w ≈ 0.4–0.6 and a red or orange sssColor for flesh. Optionally add Barré-Brisebois translucency with a thickness term. Call it an approximation in the report: it is not true subsurface transport.
- Engineering parts get seeded procedural textures (brushed streaks, lamination stripes) and real metalness. See `assets-engineering-procedural.md`.
- **Colour discipline:** natural, restrained tissue colours. Desaturate blood to the #8E0F14–#A3171C range. A neon-red RBC crowd failed review. Use one or two accent colours (teal/cyan for science, amber for the hero molecule).

## 3. Post chain (`templates/src/post.js`)

`MSAA ×4 HalfFloat RT → GTAO → Bokeh DOF → UnrealBloom → OutputPass (ACES Filmic, sRGB) → SMAA → grade (vignette, grain, haze, light shafts)`

| Pass | Values that worked |
|---|---|
| GTAO | radius 0.22 (motor scale, metres) / 0.05 (body) / per-scene for µm and nm scales; 16 samples; blend 0.85–0.9 |
| Bokeh DOF | focus = camera→target distance (the hero is always sharp); aperture 0.0004–0.0006; maxblur 0.004–0.006 |
| Bloom | strength 0.22–0.26, radius 0.55–0.6, threshold 0.92–0.95. **Subtle**: an early pass blew out the cap faces at 0.4 |
| Grade | vignette 0.5–0.55, grain ±0.014–0.016 seeded by frame, contrast ~1.05, saturation 0.86–0.96, a touch of chromatic aberration (0.0015–0.002) |

**Critical gotcha:** AO and DOF render depth and normals using `scene.overrideMaterial`. Ghosted layers, additive FX, sprites, clipped geometry and **the background** must be hidden during those override renders. If they aren't, you get dark halos, AO leaking through translucent skin, and NaN seams. Patch `renderer.render` to hide objects tagged `userData.noDepth` (and the background) whenever `scene.overrideMaterial` is set.

## 4. Camera language

- Only smooth moves: slow ¾ orbits, controlled dolly-ins, fly-throughs of the exploded view, macro close-ups, cross-section holds. Never shake, never hard-cut, never zoom excessively.
- One Hermite spline over `[az, el, dist, target, lens shift]`. Orbits interpolate in spherical coordinates, so they arc around the subject instead of cutting through it.
- **Lens shift** (`camera.filmOffset`) places the subject right of centre while the title sits on the left, without changing perspective.
- **Rack focus** between subjects on purpose. For example: the nearest hero molecule → rack to the capillary as it enters (7.2–7.9 s).
- **Parallax:** keep something in the foreground and something in the background at every scale (motes, fibres, out-of-focus cells). Depth is what separates "film" from "viewer".
- Keep turns at or below about 2°/frame. Check it with the camera QC.

## 5. Overlay typography (HTML/SVG, captured with the frame)

- System sans or a vendored OFL font (Inter variable). Titles in a light weight (200–300) with wide tracking. Labels at weight 500, 19–26 px. Kickers in small caps-tracked text at 11–13 px (0.24–0.32 em).
- **Leader-line labels:** project the 3-D anchor every frame, add an elbow or straight line that *draws on*, a ring and a dot at the anchor, and a gradient rule under the text. Clamp to an 80 px safe area. Fade the label when its anchor leaves the frame.
- Glass panels for legends, phase waves and process chains: `rgba(12,18,26,0.6)`, a 1 px light border, `backdrop-filter: blur(10px)`.
- Captions are centred low, 38–48 px, on a dark scrim, with an accent bar. **Never over the structure being named.**
- Animate the text too: eased rise, a tracking collapse (0.12 em → 0.02 em) and a blur-in. Never pop.

## The cinematic checklist (run before every receipt)

- [ ] The subject emerges from darkness; the background is a gradient, never flat.
- [ ] Rim light reads on the silhouette in every section.
- [ ] Every surface has variation: bump, roughness or colour.
- [ ] DOF is visible but the hero is sharp; at least one rack focus.
- [ ] Foreground and background depth at each scale.
- [ ] The camera is always moving (except deliberate holds).
- [ ] No neon, no saturated organs, no blown highlights.
- [ ] Labels never cover what they name.
