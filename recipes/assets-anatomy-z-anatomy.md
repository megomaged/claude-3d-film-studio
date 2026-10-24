# Anatomy assets: Z-Anatomy / BodyParts3D → aligned GLBs

Briefs ask for "real anatomy, not a mannequin". Spheres-as-organs are an automatic FAIL. Use one licensed dataset whose skin, skeleton, muscles and organs share **one body frame**, so everything lines up by construction.

## Sources and licences

| Dataset | What you get | Licence | Attribution |
|---|---|---|---|
| **Z-Anatomy**: github.com/LluisV/Z-Anatomy, branch `PC-Version`, `Resources/Models/FBX/` | FBX per system: `Regions of human body100.fbx` (skin), `SkeletalSystem100`, `Joints100`, `MuscularSystem100`, `NervousSystem100`, `CardioVascular41`, `VisceralSystem100`, `LymphoidOrgans100` | models **CC BY-SA 4.0**; the app *code* in that repo is GPLv3 and is not used | "Anatomical 3D models: Z-Anatomy (z-anatomy.com, github.com/LluisV/Z-Anatomy), licensed CC BY-SA 4.0 — derived from BodyParts3D © The Database Center for Life Science (DBCLS), CC BY-SA 2.1 JP. Models were modified." |
| **BodyParts3D 4.0** (DBCLS): dbarchive.biosciencedbc.jp/en/bodyparts3d/ | `partof_BP3D_4.0_obj_99.zip` (64,888,505 bytes) + `partof_element_parts.txt` (FMA ID → element files) | **CC BY-SA 2.1 Japan** | "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan". Also cite Mitsuhashi N et al., *Nucleic Acids Res* 37:D782 (2009) |

ShareAlike: the GLBs you derive are adaptations, so they are CC BY-SA too. Put a short credit on screen at the end, for example `Anatomy models: Z-Anatomy / BodyParts3D (DBCLS) — CC BY-SA 4.0`. Repeat it in the README and the validation report. **Never commit the raw FBX/OBJ or your GLBs to a public repo.** Commit the fetch and build scripts plus the attribution instead.

Fetch BodyParts3D with `curl -O …/partof_BP3D_4.0_obj_99.zip`. If the download is truncated, resume it with `curl -C - -O …`, then run `unzip -t`. It must report "No errors detected".

## Build (headless Blender: `templates/scripts/blender_export_glb.py`)

```bash
blender -b --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/blender_export_glb.py -- rules.json        # Z-Anatomy full body: ~10 min
```
`rules.json` maps source object names to groups with regexes (heart, lungs, skeleton, arteries…) and gives each group a triangle budget. The script then:
1. Imports each FBX and keeps only real meshes whose names match a rule. Z-Anatomy also ships "Cross Section" helper objects and suffixes like `.001` that are duplicates, so filter them.
2. **Bakes transforms and restores winding on mirrored objects.** Z-Anatomy mirrors one body side with negative scale. On the anatomy film, 1129 objects had det < 0. Without the fix, half the body is back-face culled in three.js and a midline seam shows.
3. Strips UVs, vertex colours, materials and custom split normals, and removes loose verts. One stray hypothalamus vertex sat 0.5 m below the brain and ruined the bounds.
4. Sets the body frame: metres, Y-up, +Z anterior, +X = the body's left, feet at y = 0, scaled to a fixed height (1.750 m).
5. Decimates per group to budget. Our full body was **3.16 M tris in 22 GLBs (62 MB)**. Skeleton 0.76 M (skull and hand bones weighted ×1.5–1.6), superficial muscles 0.47 M, peripheral nerves 1.2→0.2 M. Organs stayed at full resolution.
6. Moves each node's origin to its bounds centre, so organs scale, beat, breathe and explode in place.
7. Exports one GLB per group, plain (no Draco, so no decoder is needed), plus `manifest.json` with one row per node: file, node, group, system, label, bbox, origin, tris, source objects, licence.

## Gotchas we hit

- **The Z-Anatomy skin is about 240 region patches** with fold-overs at the seams, which means thousands of non-manifold edges and broken normals. The fix was to rebuild one clean surface:
  1. 2 mm voxel remesh.
  2. Keep the outer layer: faces whose normal agrees with the nearest original face.
  3. Shrink-wrap back onto the original.
  4. Corrective smooth, 4 iterations.
  5. Decimate to 140 k tris.

  The result is within about 1 mm of the source.
- **Subcutaneous tissue does not exist in the data.** A 3 mm inward offset of the skin is an honest *stand-in*; list it as one.
- **BodyParts3D organs are built from pieces.** Union the element meshes, then build a voxel SDF (organ pitch 0.35–0.9 mm), blur by 1.2 voxels, run marching cubes, and apply Taubin smoothing (12 iterations, λ 0.5, μ −0.53). Only then decimate. **Never smooth after decimation**: it spiked non-manifold vertices into long streaks (the heart's max edge was 66 mm before the fix and ≤ 13 mm after).
- Some BP3D sources are coarse (stomach 1,810 tris, kidneys 5,292). Remeshing makes them smooth but cannot add rugae. That detail has to come from the shader.
- Missing pieces are normal. Z-Anatomy has no caecum or rectum mesh, the heart chambers are outer walls with no blood pool, and the coronary arteries may be missing even when listed. Check the GLB itself, not the doc. Write the gaps into the validation report.
- Draw calls: 1626 nodes → merge static nodes per unit+material with `BufferGeometryUtils.mergeGeometries` (59 meshes). Keep only animated nodes separate: the heart chambers, the lungs, the diaphragm and the exploding organs.
- Preview before you build the film. A Blender EEVEE or Cycles render of only the exported GLBs (with backface culling ON, to mimic three.js FrontSide) catches winding, scale and placement errors in minutes.

## Body-frame sanity checks (write them in the receipt)

- The heart is left of the midline, behind the sternum.
- The pulmonary trunk is anterior and to the left of the ascending aorta, and the arch runs posterior-left.
- The liver is in the right upper quadrant under the diaphragm, and the stomach is on the left.
- The kidneys are retroperitoneal at T12–L3, with the left kidney higher.
- The cord is in the vertebral canal and the brain fills the cranium.

## Social safety

Full-body datasets are anatomically complete, including external genitalia. Before posting on social platforms, blur or crop that region in every shot where the skin layer is opaque. In our anatomy film that meant roughly the hero opening and the final hero shot. Do it as a post-process on the final MP4, keyed to tracked bounds, so the 3D master stays scientifically complete.
