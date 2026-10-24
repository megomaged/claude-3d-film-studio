# Example prompts

Copy one, change the subject, and paste it into Claude Code with this skill installed. Each prompt fixes the format, the timeline and the assets, which is what makes the result repeatable.
Defaults if you leave something out: 40.0 s, 1200 frames, 1920×1080, 30 fps, English copy, music + SFX at −14 LUFS, a validation report.

---

### 1. Car part: disc brake
> Make a 40-second cinematic Three.js explainer of how a car disc brake works. Exactly 1200 frames at 30 fps, 1920×1080. Procedural geometry: ventilated rotor, caliper, two pistons, pads, hub, wheel studs. Timeline: 0–5 hero orbit; 5–11 label caliper, pads, pistons, rotor, brake line; 11–19 exploded view along the axle; 19–28 pedal force → hydraulic pressure → pistons clamp the pads, glowing heat builds on the rotor; 28–34 cross-section with a force-flow chain; 34–38 hard stop with heat shimmer; 38–40 hero + end line "Pressure → Friction → Heat → Stop". No brand marks. Music and SFX.

### 2. Heart valve
> 40 s medical 3D film: how the aortic valve opens and closes. Use the BodyParts3D heart (CC BY-SA, credit at the end). Show the LV, aortic root and three cusps, then systole (cusps open, flow particles red) and diastole (cusps coapt, no backflow), timed to 72 bpm from one clock. Add a cross-section at the valve plane and a pressure curve panel synced to the beat. End line: "Open. Close. 100,000 times a day." Validation report and science review by a second model.

### 3. Drug mechanism of action: a GPCR agonist
> 40-second MOA film for a peptide drug that activates the GLP-1 receptor. Four scales: generic pen → subcutaneous tissue → blood (RBCs, albumin) → receptor on a lipid bilayer, then organ effects. Use the RCSB structure PDB 7FIM for the receptor + ligand (CC0; show "Cryo-EM structure · PDB 7FIM" on screen). Label any invented geometry as conceptual and the approach path as illustrative. No efficacy numbers, no brand names, time-compression cue visible.

### 4. Jet engine (turbofan)
> Cinematic 40 s Three.js explainer of a turbofan. Procedural: fan, low/high-pressure compressors, combustor, HP/LP turbines, two concentric shafts, nacelle. Exploded view along the engine axis 11–19 s, then airflow particles split into bypass (cool blue) and core (heating to orange in the combustor), shafts spinning at different closed-form speeds, a cut-away at 38 s. Exact end line: "Suck. Squeeze. Bang. Blow."

### 5. Lithium-ion battery cell
> 40 s 3D film of how a cylindrical Li-ion cell charges and discharges. Procedural jelly-roll (anode, separator, cathode, current collectors), can, cap with vent. Unroll the jelly-roll as the exploded view. Lithium ions as instanced particles moving through the electrolyte to the anode on charge and back on discharge; electrons through the external circuit in the opposite sense. Labels for every layer. Validation report must state that particle counts and speeds are illustrative.

### 6. DNA replication
> 40-second molecular film of DNA replication. Build B-DNA from real geometry (e.g. a PDB duplex such as 1BNA for the helix parameters, CC0), then helicase unwinding, primase, DNA polymerase on leading and lagging strands with Okazaki fragments, ligase. Use conceptual geometry where structures are not used and say so. Camera rides along the fork. End line: "Two copies. One template."

### 7. Human lungs: one breath
> 40 s anatomy film of breathing, using Z-Anatomy lungs, trachea, bronchi, diaphragm and rib cage (CC BY-SA 4.0, on-screen credit). 4-second breath cycle from one clock: diaphragm down on inhale, lungs expand about the apex, tidal airflow particles; dive into an alveolus and show O₂ binding to red blood cells (never floating free in plasma) and CO₂ leaving. Social-safe framing (no full-body nudity).

### 8. Gearbox / differential
> Cinematic 40 s explainer of an open car differential. Procedural ring gear, pinion, spider gears, side gears, axle shafts, carrier. Show straight-line driving (spiders don't spin), then a turn (spiders spin, outer wheel faster), with all gear speeds derived from one closed-form input so teeth never slip. Exploded view 11–19 s. Speed readouts per wheel.

### 9. Electric toothbrush (product)
> A 40 s premium product film for a generic sonic toothbrush (no brand). Procedural body, motor, eccentric weight, battery, coil charger, brush head. Hero orbit, X-ray reveal of internals, exploded view, then the motor at 260 Hz shown with deterministic motion blur, and the inductive-charging field. Studio lighting like a commercial. End card with a placeholder product name I can replace.

### 10. Vaccine immune response
> 40 s scientific animation of how an mRNA vaccine trains the immune system: injection into deltoid muscle (use BodyParts3D arm muscles), lipid nanoparticle uptake, spike protein made and displayed (use a CC0 PDB spike structure, ID on screen), antigen presentation, B cells and antibodies, T cells. Mark conceptual parts clearly. No claims beyond mechanism. Second-model science review.

### 11. Wind turbine
> 40-second engineering film of a 3-blade wind turbine. Procedural tower, nacelle, hub, blades with pitch bearings, low-speed shaft, gearbox, generator, yaw drive. Wind as flow lines bending around the blades, rotor speed from a closed-form ramp, nacelle cut-away showing the gearbox stepping up speed, power-flow chain "Wind → Rotor → Gearbox → Generator → Grid".

### 12. Knee joint
> 40 s anatomy film of the knee: femur, tibia, fibula, patella, menisci, ACL/PCL, collateral ligaments, quadriceps tendon from Z-Anatomy (CC BY-SA 4.0). Flexion 0→120° driven by one angle with the patella tracking and the ACL tensing; exploded view of the joint parts; a cartilage close-up with a procedural micro scene. Labels on every structure, credit at the end.

### 13. Insulin and glucose uptake (cellular)
> 40 s cell-scale film: insulin (PDB 3I40, human) binds the insulin receptor on a muscle cell, signalling moves GLUT4 vesicles to the membrane, glucose (wwPDB CCD BGC) enters. Show it glucose-dependent and time-compressed. Real structures where available, conceptual elsewhere, all listed in the manifest.

### 14. Your own product from a CAD/GLB
> Here is my product GLB (I own it): `<path>`. Make a 40 s cinematic film: hero orbit, labelled components, exploded view along the main axis (split the GLB by node), how it works (my 3 bullet points below), cross-section, final hero with my tagline. Keep the GLB out of any public repo.

---

## Short follow-ups that work well

- "Render stills at 2.5, 8, 14, 21, 30, 36 and 39.9 s and describe what you see in each."
- "The 19–28 s section is too busy. Cut the field lines by half and lengthen each caption to 2.5 s."
- "Make a 9:16 version for Reels: re-frame with the camera (lens shift + distance), do not crop."
- "Write the validation report with the 15 checks and the raw output."
- "Have a second model review the science read-only, then verify each finding before you fix anything."
