"""PDB / mmCIF structure → smooth molecular-surface GLB (one node per chain group), ready for three.js.

Method (what worked in our films): solvent-excluded surface (SES) approximated on a voxel grid →
light Gaussian blur → marching cubes → Taubin smoothing (no shrink) → decimate to a triangle budget.
Units in the GLB: 1 unit = 1 nm, centred on the structure (or on the chains you pass with --centre).
A per-vertex `_CAVITY` attribute (0 = exposed, 1 = deep crevice) is written too; three.js exposes it as
`geometry.attributes._cavity` (GLTFLoader lower-cases custom attribute names). Use it to darken crevices.

RCSB PDB data are CC0. Cite the structure's paper anyway, and put the PDB ID on screen.

setup (once):  python3 -m venv .venv && .venv/bin/pip install numpy scipy scikit-image trimesh gemmi fast-simplification
usage:
  .venv/bin/python -I scripts/pdb_to_mesh.py --fetch 1GCN --out assets/glucagon.glb --node glucagon=A
  .venv/bin/python -I scripts/pdb_to_mesh.py --in 7FIY.cif --out assets/gipr.glb --node receptor=R --node ligand=P --budget 150000
"""
import argparse, json, os, sys, urllib.request
import numpy as np
from scipy import ndimage

BONDI = {'H': 0.120, 'C': 0.170, 'N': 0.155, 'O': 0.152, 'S': 0.180, 'P': 0.180, 'SE': 0.190}   # nm
SKIP_RES = {'HOH', 'WAT', 'DOD'}


def fetch(pdb_id, dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    path = os.path.join(dest_dir, f'{pdb_id.upper()}.cif')
    if not os.path.exists(path):
        url = f'https://files.rcsb.org/download/{pdb_id.upper()}.cif'
        print('fetch', url)
        try:
            urllib.request.urlretrieve(url, path)
        except Exception as e:      # python.org builds on macOS often lack CA certs → fall back to curl
            print('urllib failed (', e, ') → curl')
            import subprocess
            subprocess.run(['curl', '-sfL', '-o', path, url], check=True)
    return path


def atoms_of(structure, chains, keep_h=False):
    """heavy-atom coordinates (nm) and radii for the given chain IDs (first model only)."""
    xyz, rad = [], []
    for ch in structure[0]:
        if ch.name not in chains:
            continue
        for res in ch:
            if res.name in SKIP_RES:
                continue
            for at in res:
                el = at.element.name.upper()
                if el == 'H' and not keep_h:
                    continue
                xyz.append([at.pos.x / 10, at.pos.y / 10, at.pos.z / 10])   # Å → nm
                rad.append(BONDI.get(el, 0.17))
    if not xyz:
        raise SystemExit(f'no atoms for chains {chains}')
    return np.array(xyz), np.array(rad)


def ses_field(xyz, rad, probe=0.14, h=0.05, blur=1.2):
    """signed field > 0 inside the solvent-excluded surface, on a regular grid of pitch h (nm)."""
    pad = rad.max() + 2 * probe + 4 * h
    lo = xyz.min(0) - pad
    shape = np.ceil((xyz.max(0) + pad - lo) / h).astype(int) + 1
    sas = np.zeros(shape, bool)
    for c, r in zip(xyz, rad):                      # solvent-accessible volume: within r + probe of any atom
        R = r + probe
        i0 = np.maximum(np.floor((c - R - lo) / h).astype(int), 0)
        i1 = np.minimum(np.ceil((c + R - lo) / h).astype(int) + 1, shape)
        g = [lo[k] + h * np.arange(i0[k], i1[k]) for k in range(3)]
        d2 = (g[0][:, None, None] - c[0]) ** 2 + (g[1][None, :, None] - c[1]) ** 2 + (g[2][None, None, :] - c[2]) ** 2
        sas[i0[0]:i1[0], i0[1]:i1[1], i0[2]:i1[2]] |= d2 < R * R
    # voxels outside the SAS are probe centres; SES interior = farther than `probe` from all of them
    field = ndimage.distance_transform_edt(sas, sampling=h) - probe
    return ndimage.gaussian_filter(field, blur) if blur > 0 else field, lo


def surface(xyz, rad, budget, h=0.05, probe=0.14):
    import trimesh
    from skimage import measure
    field, lo = ses_field(xyz, rad, probe=probe, h=h)
    v, f, _, _ = measure.marching_cubes(field, level=0.0, spacing=(h, h, h))
    m = trimesh.Trimesh(v + lo, f[:, ::-1], process=True)
    parts = m.split(only_watertight=False)          # drop crumbs (tiny internal cavities)
    if len(parts) > 1:
        big = max(len(p.faces) for p in parts)
        m = trimesh.util.concatenate([p for p in parts if len(p.faces) >= 0.002 * big])
    trimesh.smoothing.filter_taubin(m, lamb=0.5, nu=0.53, iterations=10)   # smooth without shrinking
    if len(m.faces) > budget:
        try:
            import fast_simplification
            vv, ff = fast_simplification.simplify(m.vertices, m.faces, target_reduction=1 - budget / len(m.faces))
            m = trimesh.Trimesh(vv, ff, process=True)
        except ImportError:
            print('fast-simplification not installed: keeping', len(m.faces), 'tris')
    # NOTE: do not smooth again after decimation; it spikes non-manifold vertices into long streaks.
    occ = field > 0                                 # cavity: how buried each vertex is, blurred occupancy at 2 scales
    cav = np.zeros(len(m.vertices))
    for s in (0.35, 0.9):
        b = ndimage.gaussian_filter(occ.astype(np.float32), s / h)
        idx = np.clip(np.round((m.vertices - lo) / h).astype(int), 0, np.array(occ.shape) - 1)
        cav += b[idx[:, 0], idx[:, 1], idx[:, 2]]
    cav = np.clip((cav / 2 - 0.35) / 0.4, 0, 1)
    return m, cav.astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src'); ap.add_argument('--fetch'); ap.add_argument('--out', required=True)
    ap.add_argument('--node', action='append', required=True, help='name=CHAINS, e.g. receptor=R or gprotein=ABG')
    ap.add_argument('--budget', type=int, default=120000, help='max triangles per node')
    ap.add_argument('--grid', type=float, default=0.05, help='voxel pitch in nm (smaller = finer, slower)')
    ap.add_argument('--centre', default=None, help='chains to centre on (default: all nodes)')
    a = ap.parse_args()
    import gemmi, trimesh
    path = a.src or fetch(a.fetch, os.path.join(os.path.dirname(a.out) or '.', 'raw'))
    st = gemmi.read_structure(path); st.setup_entities()
    nodes = [(n.split('=')[0], list(n.split('=')[1])) for n in a.node]
    cchains = list(a.centre) if a.centre else sum((c for _, c in nodes), [])
    centre = atoms_of(st, cchains)[0].mean(0)
    scene, log = trimesh.Scene(), []
    for name, chains in nodes:
        xyz, rad = atoms_of(st, chains)
        m, cav = surface(xyz - centre, rad, a.budget, h=a.grid)
        m.vertex_attributes['_CAVITY'] = cav
        scene.add_geometry(m, node_name=name, geom_name=name)
        log.append({'node': name, 'chains': ''.join(chains), 'atoms': len(xyz), 'tris': len(m.faces)})
        print(f'{name:12s} chains={"".join(chains):6s} atoms={len(xyz):6d} tris={len(m.faces)}')
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    scene.export(a.out, include_normals=True)
    manifest = {'file': os.path.basename(a.out), 'source': f'RCSB PDB {os.path.basename(path).split(".")[0]}', 'licence': 'CC0 1.0 (cite the primary paper)',
                'units': '1 unit = 1 nm, centred', 'method': f'SES grid {a.grid} nm, probe 0.14 nm, Taubin 10, decimated', 'nodes': log}
    with open(os.path.splitext(a.out)[0] + '.manifest.json', 'w') as fh:
        json.dump(manifest, fh, indent=1)
    print('wrote', a.out)


if __name__ == '__main__':
    sys.exit(main())
