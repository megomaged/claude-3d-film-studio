"""Licensed anatomy / CAD source files (FBX, OBJ, glTF) → clean, aligned, budgeted GLBs (one per group) + manifest.

Headless Blender 4.x:
  blender -b --factory-startup --disable-autoexec --python-exit-code 1 \
      --python scripts/blender_export_glb.py -- <rules.json>

rules.json (example):
{
  "inputs":  ["raw/z-anatomy/SkeletalSystem100.fbx", "raw/z-anatomy/VisceralSystem100.fbx"],
  "out_dir": "assets/glb",
  "manifest": "assets/manifest.json",
  "source":  "Z-Anatomy (github.com/LluisV/Z-Anatomy), derived from BodyParts3D (c) DBCLS",
  "license": "CC BY-SA 4.0",
  "frame":   { "height_m": 1.75, "reference_group": "skeleton" },
  "groups":  [ { "name": "heart",    "match": "(atrium|ventricle)",       "budget": 90000 },
               { "name": "lungs",    "match": "lung",                     "budget": 0 },
               { "name": "skeleton", "match": "(bone|vertebra|rib|skull)", "budget": 600000 } ],
  "node_by": "object"
}
node_by: "object" = one node per source object; "group" = join each group into one node.
Objects that match no group are dropped. Budget 0 = keep full resolution.

What it fixes (each one bit us):
- Mirrored source objects (negative-scale transforms) → after baking, face winding is reversed or the
  left/right half is back-face culled in three.js. We bake the transform and flip winding when det < 0.
- UVs, vertex colours, custom split normals and materials are stripped (the shader is procedural; leftover
  custom normals cause faceting after decimation).
- Stray loose vertices/edges are removed (one stray vertex half a metre away wrecks bounds and framing).
- Shared frame: metres, Y-up (glTF), feet/bottom at y = 0, centred on X/Z, scaled to a known height,
  so every file loads at identity and lines up with every other file.
- Every node's origin is moved to its bounds centre, so organs can scale/rotate/explode in place.
"""
import bpy, bmesh, sys, os, re, json
from mathutils import Vector, Matrix

cfg_path = sys.argv[sys.argv.index('--') + 1]
CFG = json.load(open(cfg_path))
BASE = os.path.dirname(os.path.abspath(cfg_path))
P = lambda p: p if os.path.isabs(p) else os.path.join(BASE, p)
GROUPS = [(g['name'], re.compile(g['match'], re.I), int(g.get('budget', 0))) for g in CFG['groups']]
FLOOR = 300                                         # never decimate a node below this many triangles


def tris(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def importer(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.obj': bpy.ops.wm.obj_import(filepath=path)
    elif ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=path)
    else: raise SystemExit('unsupported input: ' + path)


bpy.ops.wm.read_factory_settings(use_empty=True)
kept = []
for src in CFG['inputs']:
    before = set(bpy.data.objects)
    importer(P(src))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        if o.type != 'MESH' or tris(o.data) < 4:
            continue
        g = next((n for n, rx, _ in GROUPS if rx.search(o.name)), None)
        if g:
            o['grp'], o['src'] = g, os.path.basename(src) + ':' + o.name
            kept.append(o)
    for o in new:                                   # unparent kept objects (keep world transform), drop the rest
        if o in kept:
            mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in new:
        if o not in kept:
            bpy.data.objects.remove(o, do_unlink=True)
    print('[export]', src, 'kept', sum(1 for o in kept if o['src'].startswith(os.path.basename(src))))
bpy.ops.outliner.orphans_purge(do_recursive=True)
if not kept:
    raise SystemExit('no objects matched any group')

flipped = 0
for o in kept:                                      # bake transforms, restore winding of mirrored objects, strip attrs
    me = o.data
    if me.users > 1:
        o.data = me = me.copy()
    neg = o.matrix_world.determinant() < 0
    me.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
    bm = bmesh.new(); bm.from_mesh(me)
    if neg:
        bmesh.ops.reverse_faces(bm, faces=bm.faces); flipped += 1
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    loose_e = [e for e in bm.edges if not e.link_faces]
    if loose_e: bmesh.ops.delete(bm, geom=loose_e, context='EDGES')
    loose_v = [v for v in bm.verts if not v.link_faces]
    if loose_v: bmesh.ops.delete(bm, geom=loose_v, context='VERTS')
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    for a in list(me.color_attributes): me.color_attributes.remove(a)
    me.materials.clear()
    try:
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception:
        pass
print('[export] transforms baked; mirrored objects with winding restored:', flipped)

# shared frame (Blender is Z-up; the glTF exporter converts to Y-up): bottom at 0, centred, scaled to height
fr = CFG.get('frame', {})
ref = [o for o in kept if o['grp'] == fr.get('reference_group')] or kept
vs = [v.co for o in ref for v in o.data.vertices]
mn = Vector([min(v[i] for v in vs) for i in range(3)]); mx = Vector([max(v[i] for v in vs) for i in range(3)])
s = fr['height_m'] / (mx.z - mn.z) if fr.get('height_m') else 1.0
T = Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z)))
for o in kept:
    o.data.transform(T)
print('[export] frame: scale %.5f, height %.3f m' % (s, (mx.z - mn.z) * s))

# optional join per group
if CFG.get('node_by') == 'group':
    joined = []
    for g, _, _ in GROUPS:
        objs = [o for o in kept if o['grp'] == g]
        if not objs: continue
        srcs = [o['src'] for o in objs]
        with bpy.context.temp_override(active_object=objs[0], object=objs[0], selected_objects=objs, selected_editable_objects=objs):
            bpy.ops.object.join()
        objs[0].name = g; objs[0]['srcs'] = json.dumps(srcs); joined.append(objs[0])
    kept = joined
else:
    for o in kept:
        o['srcs'] = json.dumps([o['src']])
        o.name = re.sub(r'[^a-z0-9]+', '_', o['src'].split(':', 1)[1].lower()).strip('_')

# decimate each group to its budget: one ratio per group (bisection), never below FLOOR tris per node
dg = bpy.context.evaluated_depsgraph_get()
for g, _, budget in GROUPS:
    objs = [o for o in kept if o['grp'] == g]
    total = sum(tris(o.data) for o in objs)
    if not objs or budget <= 0 or total <= budget:
        continue
    lo, hi = 0.0, 1.0
    for _ in range(40):
        r = (lo + hi) / 2
        est = sum(max(min(t, FLOOR), t * r) for t in (tris(o.data) for o in objs))
        lo, hi = (r, hi) if est < budget else (lo, r)
    for o in objs:
        r = max(lo, min(1.0, FLOOR / max(1, tris(o.data))))
        if r >= 0.999: continue
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = r; m.use_collapse_triangulate = True
    dg.update()
    for o in objs:
        if o.modifiers:
            new = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); old = o.data
            o.modifiers.clear(); o.data = new; bpy.data.meshes.remove(old)
    print('[export] group %-14s tris %8d -> %8d' % (g, total, sum(tris(o.data) for o in objs)))

for o in kept:                                      # smooth shading + origin at bounds centre
    o.data.shade_smooth()
    vs = [v.co for v in o.data.vertices]
    c = Vector([(min(v[i] for v in vs) + max(v[i] for v in vs)) / 2 for i in range(3)])
    o.data.transform(Matrix.Translation(-c)); o.location = c

out_dir = P(CFG['out_dir']); os.makedirs(out_dir, exist_ok=True)
manifest = []
gl = lambda v: [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]   # Blender Z-up → glTF Y-up
for g, _, _ in GROUPS:
    objs = [o for o in kept if o['grp'] == g]
    if not objs: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    fp = os.path.join(out_dir, g + '.glb')
    bpy.ops.export_scene.gltf(filepath=fp, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_normals=True, export_texcoords=False, export_materials='NONE', export_animations=False)
    for o in objs:
        ws = [gl(o.matrix_world @ v.co) for v in o.data.vertices]
        manifest.append({'file': os.path.relpath(fp, BASE), 'node': o.name, 'group': g, 'tris': tris(o.data),
                         'bbox_min': [min(w[i] for w in ws) for i in range(3)], 'bbox_max': [max(w[i] for w in ws) for i in range(3)],
                         'origin': gl(o.location), 'source': CFG.get('source', ''), 'source_objects': json.loads(o['srcs'])[:50],
                         'license': CFG.get('license', '')})
    print('[export] wrote', fp, '%.1f MB' % (os.path.getsize(fp) / 1e6))
json.dump(manifest, open(P(CFG.get('manifest', os.path.join(CFG['out_dir'], 'manifest.json'))), 'w'), indent=1)
print('[export] done:', len(manifest), 'nodes')
