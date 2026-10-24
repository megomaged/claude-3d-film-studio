# Example: Tirzepatide, a dual-receptor mechanism of action (40 s, four scales)

> **Status: in production.** The brief, timeline and asset pipeline below are final. The gallery is a TODO and will be added when the film is delivered (`gallery/mounjaro/`).

## The brief (summarised)

The brief asked for a premium, scientifically grounded medical animation of how tirzepatide works, at exactly 40.0 s, 1920×1080, 30 fps and 1200 frames. It is an educational visualisation, **not** an efficacy claim or an injection-training video. It runs through four visual scales with continuous transitions: **product → anatomical cross-section → tissue / cell → molecule**. One master timeline controls everything.

The brief's science rules:
- A single engineered peptide activates **two** receptors (GIPR and GLP-1R). Do not show two drugs.
- Insulin secretion is glucose-dependent.
- No fat "melting" and no instant glucose or weight change. Use time-compression cues.
- The gastric-emptying effect diminishes over time.

Branding rules: **no brand name, logo or trade dress.** The pen is generic, and "TIRZEPATIDE" is the only drug name on screen.

## Timeline

| s | Beat | Scale | Locked copy |
|---|---|---|---|
| 0–5 | Generic injection pen hero orbit → match-move zoom into a skin cross-section (epidermis, dermis, subcutaneous fat); needle tip in fat, never in a vein or muscle | product → tissue | "TIRZEPATIDE" / "A dual GIP and GLP-1 receptor agonist." |
| 5–11 | Fly through adipocytes and interstitial fluid; molecules disperse slowly → capillary → blood vessel with RBCs; reversible albumin association | tissue → cell | "Absorbed into the circulation." → "Long-acting receptor activation." + "Time-compressed visualization" |
| 11–19 | **Hero scene:** lipid bilayer, GIPR and GLP-1R as real cryo-EM surfaces; one tirzepatide molecule binds each; subtle activation; Gαs → cAMP cascade | molecule | "One molecule. Two receptor pathways." → "GIP + GLP-1 receptor activation." |
| 19–28 | Organs: pancreatic islet (β-cells, glucose-dependent insulin; α-cells, glucagon), stomach (slower emptying), brain (hypothalamus, brainstem: appetite) | organ | three effect captions |
| 28–34 | Metabolic pathways as two animated chains | organ / cell | Pathway A + Pathway B chips |
| 34–38 | Whole-body view, coordinated effects | body | "Multiple pathways. Coordinated metabolic effects." + "Effects develop over time and vary between individuals." |
| 38–40 | Final title | — | "TIRZEPATIDE" / "Dual Receptor Activation. Multiple Metabolic Effects." |

## Assets

| Asset | Source | Licence | Status |
|---|---|---|---|
| GIPR–Gs complex with tirzepatide | RCSB **PDB 7FIY** (cryo-EM 3.4 Å; Zhao F et al., *Nat Commun* 13:1057, 2022), OPM orientation | CC0 (cite) | validated surface, membrane frame |
| GLP-1R–Gs complex with tirzepatide | RCSB **PDB 7FIM** (same study) | CC0 | validated |
| Tirzepatide peptide | 7FIY chain P, residues 1–30 (C-terminus and lipid not modelled) | CC0 | validated pose |
| C20 fatty-diacid side chain | built from known chemistry (RDKit conformers on the real Lys20 bond) | — | **conceptual geometry**, labelled |
| Albumin, insulin, glucagon | PDB 1E7H, 3I40 (human), 1GCN | CC0 | validated |
| Glucose, cAMP | wwPDB CCD `BGC`, `CMP` ideal coordinates | CC0 | validated |
| Organs, skin, skeleton | **BodyParts3D 4.0** (DBCLS), voxel-remeshed per organ into one metric frame | CC BY-SA 2.1 JP | validated shapes; lungs are a derived envelope |
| Pen | procedural, generic | — | engineered |

Build scripts: `templates/scripts/pdb_to_mesh.py` (SES surfaces, nm units, `_CAVITY`) and an organ voxel-remesh path described in `recipes/assets-anatomy-z-anatomy.md`. A manifest lists every asset with its status: VALIDATED / CONCEPTUAL / derived.

## What makes it cinematic (the hard gate for this film)

- **Scale transitions** via a scene director: match-move zoom with radial focus/zoom blur and a crossfade between overlapping scene windows. Never a hard cut.
- **Per-scene environments** (studio, tissue, blood, lab PMREMs) and per-scene post: DOF racks from the nearest molecule to the capillary, and haze, grain and chromatic-aberration grades.
- **Tissue shaders:** wrap-lighting SSS + Barré-Brisebois translucency, worley-cell and fibre micro-normals, wet clearcoat. Desaturated blood (#8E0F14–#A3171C) after review found the first RBCs too neon.
- Molecules: real surfaces with crevices darkened by `_cavity`, a teal receptor and an amber hero ligand. Crowds are drawn as instanced impostors baked from the real mesh.

## Pitfalls already hit

- Taubin smoothing **after** decimation spiked non-manifold vertices into streaks (heart max edge 66 mm). The fix was to smooth before decimating only.
- GLTFLoader lower-cases custom attributes: `_CAVITY` arrives as `_cavity`.
- A truncated BodyParts3D download (17.8 MB of 64.9 MB) was resumed with `curl -C -` and verified with `unzip -t`.
- Review fixes:
  - Skin labels were on screen too briefly.
  - The title overlapped the skin block (fixed with more lens shift).
  - The RBC crowd was too dense near the lens.
  - The "Absorbed…" caption started before the capillary appeared.

## Stills

TODO: add 6 stills + `hero.gif` from the delivered MP4 to `gallery/mounjaro/` and link them here.
