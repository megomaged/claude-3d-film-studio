# Engineering assets: procedural geometry

Machines (motors, turbines, gearboxes, battery cells, valves, pumps) are built from code. There is no CAD to license and no file to download, and every part is a named object you can explode, ghost, highlight or cut away. The EV-motor film builds its whole PMSM this way: **no external geometry at all**.

## The kit (three.js built-ins + 3 helpers)

| Part type | Build with | EV-motor example |
|---|---|---|
| Turned parts (housings, covers, shafts, hubs, bearings races) | `LatheGeometry` from a `[radius, axial]` profile, 96–128 segments | housing with grooves/ribs, stepped splined shaft, bearing races |
| Prismatic parts (laminations, pockets, brackets) | `ExtrudeGeometry` from a `Shape` with holes | stator: 48 rectangular slots + liners; rotor: 8 V-pole pockets + lightening holes |
| Swept parts (windings, hairpins, busbars, pipes, cooling helix) | swept rectangle / tube along a curve (`TubeGeometry` or a custom sweep) | 192 hairpin bars with crowns, twisted legs, welds; helical coolant jacket |
| Repeated parts (bolts, magnets, balls, blades) | one geometry, many meshes or `InstancedMesh` | 24 bolts, 64 segmented magnets, 2×11 balls + brass cage |

Rules:
- **Real units, one axis.** Put the machine's axis on one world axis. The exploded view then becomes pure translations along it, and every part stays "perfectly aligned", as briefs demand.
- **Every part is a `Group` with an `inner` child.** Explode by moving the group and spin by rotating `inner`. Keep each part's offset and stagger in one `EXPLODE` table: `[delay, returnDelay]` per part.
- **No zero-length edges in shapes.** Duplicate points in an `ExtrudeGeometry` shape make NaN normals. GTAO then turns them into a full-height dark seam. This happened to us.
- **Engineering detail sells "premium"**: bolt heads with threaded shanks, weld beads, O-rings and seals, parting lines, chamfers through `bevelEnabled`, OD weld seams on laminations, connector plugs in a contrasting colour. Reviewers called a plain pen body "a bit plain at hero scale". Add micro-bevels and seams.

## Materials (MeshPhysicalMaterial + seeded canvas textures)

| Look | Settings that worked |
|---|---|
| Turned / brushed aluminium | metalness 1, roughness 0.3–0.4, `roughnessMap` = seeded circumferential streaks, clearcoat 0.2–0.3 |
| Cast aluminium | roughness 0.55, fine noise bump |
| Laminated steel | stripe texture along the axis (one stripe per lamination), darker, roughness 0.45 |
| Copper | 0xd07a45, metalness 1, roughness 0.25–0.3, clearcoat 0.4 |
| Magnets | dark nickel; N/S tint through `emissive` only while the physics is explained |
| HV plugs, seals | orange / black rubber, roughness 0.6–0.8 |

Draw procedural textures on a canvas with a **seeded** PRNG (`rng(seed)`) so the streaks are identical on every run. Set `anisotropy` to 8.
Watch for strong turned-metal streaks combined with warm environment strips. Together they gave the ghosted housing a beige cast that the review flagged. Keep the environment panels neutral, or tint the ghost material cool.

## Physics that must stay in sync

Derive every electrical and mechanical value from **one** clock:
- `omega(t)` is a smooth speed profile in rev/s.
- `rotorAngle(t)` is its **exact integral**. Use a closed form, or a precomputed trapezoid table with dt = 1/6000 s. Never accumulate per frame.
- The stator field angle is `rotorAngle(t) + loadAngle` (a fixed 15°), so the machine stays synchronous.
- Phase currents are `cos(elecAngle − k·120°)`. Current pulses in the copper, the ⊙/⊗ symbols and the sine-panel cursor all read the same angle.

The on-screen RPM can be **illustrative**: map the visual speed to a believable 0–16,000 rpm readout. Keep the real spin slow, about 4.2 rev/s at most, so it doesn't strobe at 30 fps, and say so in the report.

## Cut-aways

Use two clipping planes that form a wedge (for example 15°→105° around the axis), with `material.clipIntersection = true`. Add flat **cap meshes** (a `ShapeGeometry` of the part's cross-section profile) at each plane so you don't see hollow shells.
Gotcha: when the wedge is "closed", push both plane constants to 1000. Otherwise a one-pixel sliver stays clipped.

## Exploded view checklist

- Stagger: outer parts first (bolts → covers → seals → bearings → housing → jacket → stator → windings → rotor → shaft). Reassemble in reverse with a delay.
- Each move takes 2.1–2.4 s with `easeInOutCubic`. Grow the shadow camera frustum with the spread so shadows don't clip.
- Give each label a 0.3 s glow pulse as its part arrives. Labels for small parts use a smaller style.
- The camera *flies through*. Pull back to see the full spread, then truck along the axis.
