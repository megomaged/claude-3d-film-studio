# Molecular assets: RCSB PDB structures → surface meshes

Drug-mechanism films (receptors, enzymes, antibodies, peptides) look real when the molecule *is* real. Use the experimental structure, put its PDB ID on screen, and label anything you had to invent as **conceptual**.

## Sources and licences

| Source | Use | Licence |
|---|---|---|
| **RCSB PDB / wwPDB** (`https://files.rcsb.org/download/<ID>.cif`) | experimental coordinates (cryo-EM, X-ray, NMR) | **CC0 1.0**. No attribution is required, but cite the primary paper anyway |
| wwPDB Chemical Component Dictionary (`https://files.rcsb.org/ligands/download/<CCD>_ideal.sdf`) | small molecules (glucose `BGC`, cAMP `CMP`, ATP…) as ideal coordinates | CC0 |
| **OPM** (opm.phar.umich.edu) | membrane orientation for membrane proteins: normal, half-thickness | free for academic / non-commercial use; cite Lomize MA et al., *Nucleic Acids Res* 40:D370 (2012) |
| ChEMBL | chemistry cross-check (linker order, modified residues) | CC BY-SA 3.0. Used as a cross-check only; no geometry taken from it |

Choose structures carefully:
- Prefer a **matched pair from one study**. For tirzepatide we used 7FIY (GIPR–Gs) and 7FIM (GLP-1R–Gs), Zhao F et al., *Nat Commun* 13:1057 (2022).
- Prefer **human** over animal structures. For insulin we used 3I40 (human), not 4INS (porcine).
- Record the alternates you rejected and why.

## Build (`templates/scripts/pdb_to_mesh.py`)

```bash
python3 -m venv .venv && .venv/bin/pip install numpy scipy scikit-image trimesh gemmi fast-simplification
.venv/bin/python -I scripts/pdb_to_mesh.py --fetch 7FIY --out assets/gipr.glb \
    --node receptor=R --node ligand=P --node gprotein=ABG --budget 150000
```
The method that worked:
1. Heavy atoms only, with Bondi vdW radii. Drop water, cholesterol and detergents.
2. Approximate the solvent-excluded surface (SES) on a grid:
   - Mark the SAS voxels (within r + 0.14 nm of an atom).
   - Treat the voxels outside it as probe centres.
   - SES interior = farther than 0.14 nm from every probe centre (Euclidean distance transform).
3. Gaussian blur (1.2–1.4 voxels), then marching cubes, then drop the crumbs (internal cavities).
4. Taubin smoothing, 10 iterations, no shrink. **Then** decimate to the budget. Do not smooth again afterwards.
5. Units: 1 unit = 1 nm, centred. For membrane proteins, rotate into a membrane frame: normal = +Y, extracellular up, mid-plane at y = 0, taken from OPM.
6. Add a per-vertex `_CAVITY` attribute (blurred occupancy at 0.35 and 0.9 nm). **GLTFLoader lower-cases custom attributes**, so in three.js it arrives as `geometry.attributes._cavity`. One build read zeros because it looked for `_CAVITY`. Use it to darken crevices: `diffuse *= mix(1.0, 0.35, vCav)`.

Budgets that rendered smoothly at close-up: about 145 k tris per receptor, 50–100 k per G-protein subunit, 60 k per peptide ligand, 150 k for albumin.

## Conceptual parts: say so

Some chemistry is never resolved. Tirzepatide's C20 fatty-diacid side chain (on Lys20) is not modelled in any of the four structures. We built it from the known chemistry:
- An RDKit ETKDGv3 conformer search (60 conformers, fixed seed), followed by an MMFF minimisation.
- Superposed on the real Lys20 CE→NZ bond.
- Spun to minimise clashes with the peptide and receptor.

It is a separate GLB node, marked **CONCEPTUAL geometry (chemistry correct, conformation invented)** in the manifest.
Likewise, the *approach path* of a ligand to its pocket is invented. Only the bound pose is experimental, so show a small cue: "Approach path illustrative".

To place one ligand mesh into two complexes, compute a Kabsch superposition on matching Cα atoms. Our tirzepatide fit had an RMSD of 0.080 nm over 29 residues. Store the 4×4 matrix in a JSON next to the GLB.

## Shading molecules cinematically

- Surfaces: soft, slightly translucent physical material with a Fresnel rim, crevices darkened by `_cavity`, and one hue per chain (receptor teal, ligand amber, G-protein neutral). Keep it **desaturated**: neon molecules read as cartoon.
- A cartoon ribbon (Catmull-Rom through the Cα atoms, an elliptical section about 0.30 × 0.075 nm, oriented by the C=O vectors) shows a helix better than a surface at a distance. Cross-fade between the two.
- Small molecules: ball-and-stick with CPK vertex colours, double bonds drawn as two cylinders.
- Crowds of copies (molecules drifting in plasma): bake an 8-view impostor atlas from the real mesh and draw instanced sprites with fog and a near-plane fade. Hundreds of copies cost almost nothing.

## On screen

- Put the structure label next to the molecule: `Cryo-EM structure · PDB 7FIY`.
- Show time compression: `Time-compressed visualization`.
- No efficacy numbers and no claims beyond the brief. Medical films get reviewed hard.
