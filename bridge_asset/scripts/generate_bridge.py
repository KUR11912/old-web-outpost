"""ArcadeBridge_01: a low-poly, open stone arcade in metres.

Run: E:\\BLEND\\blender.exe --background --factory-startup --python this_file
Blender Z-up is converted to glTF Y-up. Long axis is X. Bottom-centre origin.
All checker tiles are a single UV texture on one watertight deck mesh.
"""
import bpy, bmesh, json, math, struct, shutil
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PARAMS = {
    'seed': 63112042, 'units': 'metres', 'origin': 'bottom centre',
    'length': 10.0, 'width': 3.8, 'deck_thickness': .20,
    'transverse_arch_x': [-4.2, -1.4, 1.4, 4.2], 'column_row_z': [-1.55, 1.55],
    'base_width': .56, 'shaft_radius': .19, 'shaft_sides': 8,
    'spring_height_above_deck': 2.35, 'arch_centre_rise': 2.13,
    'transverse_arch_radial_thickness': .22, 'transverse_arch_depth': .25,
    'longitudinal_arch_radial_thickness': .18, 'longitudinal_arch_depth': .20,
    'segments_per_arch_half': 5, 'curb_z': [-1.835, 1.835],
    'curb_width': .13, 'curb_height_above_deck': .16,
    'texture_size': 256, 'checker_tile_metres': .5, 'roughness': .9,
    'world_placement_gltf': [39, -.18, -8], 'world_deck_top': .02,
    'render_samples': 24,
}
for directory in ('textures', 'previews'):
    (ROOT / directory).mkdir(parents=True, exist_ok=True)
(ROOT / 'parameters.json').write_text(json.dumps(PARAMS, indent=2), encoding='utf-8')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
bpy.context.preferences.filepaths.save_version = 0
asset = bpy.data.collections.new('ArcadeBridge_01_Asset')
scene.collection.children.link(asset)
preview = bpy.data.collections.new('PREVIEW_ONLY')
scene.collection.children.link(preview)
root = bpy.data.objects.new('ArcadeBridge_01', None)
asset.objects.link(root)
root['seed'] = PARAMS['seed']
root['origin_policy'] = 'bottom centre'
root['long_axis'] = 'glTF X'
root['world_placement_gltf'] = PARAMS['world_placement_gltf']

def move_to(obj, collection):
    for old in tuple(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)

def smooth_noise(rng, n, grid, rounds=4):
    lattice = rng.uniform(-1, 1, (grid, grid))
    position = np.arange(n) * grid / n
    index = position.astype(int)
    blend = position - index
    blend = blend * blend * (3 - 2 * blend)
    a = lattice[index[:, None], index[None, :]]
    b = lattice[index[:, None], (index[None, :] + 1) % grid]
    c = lattice[(index[:, None] + 1) % grid, index[None, :]]
    d = lattice[(index[:, None] + 1) % grid, (index[None, :] + 1) % grid]
    values = (a * (1-blend)[None, :] + b * blend[None, :]) * (1-blend)[:, None]
    values += (c * (1-blend)[None, :] + d * blend[None, :]) * blend[:, None]
    for _ in range(rounds):
        values = (values * 4 + np.roll(values, 1, 0) + np.roll(values, -1, 0)
                  + np.roll(values, 1, 1) + np.roll(values, -1, 1)) / 8
    return values

def stone_pixels(seed, light=False):
    n = PARAMS['texture_size']
    rng = np.random.default_rng(seed)
    coarse = smooth_noise(rng, n, 16, 10)
    medium = smooth_noise(rng, n, 32, 5)
    fine = rng.uniform(-1, 1, (n, n))
    yy, xx = np.mgrid[0:n, 0:n] / n
    veins = np.sin((xx + yy * .44) * 34 + coarse * 9 + np.sin(yy * 18) * 2)
    veins = np.maximum(0, veins - .68) * .10
    pixels = np.ones((n, n, 4), dtype=np.float32)
    base = [.70, .675, .625] if light else [.63, .565, .535]
    pixels[:, :, :3] = np.array(base) + (coarse * .11 + medium * .05 + fine * .017 - veins)[:, :, None]
    pixels[:, :, 0] += medium * .025
    pixels[:, :, 2] -= medium * .025
    pixels[:, :, :3] = np.clip(pixels[:, :, :3], .15, .9)
    return pixels

def save_texture(name, pixels):
    h, w = pixels.shape[:2]
    image = bpy.data.images.new(name, width=w, height=h, alpha=True)
    image.pixels.foreach_set(np.flipud(pixels).astype(np.float32).ravel())
    image.filepath_raw = str(ROOT / 'textures' / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image

stone = save_texture('arcade_warm_mottled_stone_256', stone_pixels(PARAMS['seed']))
checker_pixels = stone_pixels(PARAMS['seed'] + 5, True)
for row in range(4):
    for col in range(4):
        ys, xs = slice(row * 64, (row + 1) * 64), slice(col * 64, (col + 1) * 64)
        if (row + col) % 2:
            checker_pixels[ys, xs, :3] *= [.76, .735, .71]
        else:
            checker_pixels[ys, xs, :3] += [.05, .06, .075]
        checker_pixels[row * 64, xs, :3] *= .72
        checker_pixels[ys, col * 64, :3] *= .72
checker = save_texture('arcade_checker_stone_256', checker_pixels)

def material(name, image=None, color=(.5, .5, .5)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = PARAMS['roughness']
    p.inputs['Metallic'].default_value = 0
    p.inputs['Specular IOR Level'].default_value = .10
    if image:
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        tex.interpolation = 'Closest'
        tex.extension = 'REPEAT'
        mat.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
    return mat

stone_mat = material('Arcade_Warm_Stone', stone)
deck_mat = material('Arcade_Checker_Stone', checker)

def mesh(name, vertices, faces, mat, uvscale=1):
    data = bpy.data.meshes.new(name + '_Mesh')
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    data.update()
    uv = data.uv_layers.new(name='UVMap')
    for face in data.polygons:
        face.use_smooth = False
        axis = max(range(3), key=lambda i: abs(face.normal[i]))
        for li in face.loop_indices:
            v = data.vertices[data.loops[li].vertex_index].co
            coords = (v.x, v.y) if axis == 2 else ((v.y, v.z) if axis == 0 else (v.x, v.z))
            uv.data[li].uv = (coords[0] / uvscale, coords[1] / uvscale)
    obj = bpy.data.objects.new(name, data)
    asset.objects.link(obj)
    obj.parent = root
    data.materials.append(mat)
    return obj

def box(name, centre, dimensions, mat):
    cx, cy, cz = centre
    hx, hy, hz = (d / 2 for d in dimensions)
    vertices = [(cx + x * hx, cy + y * hy, cz + z * hz)
                for x, y, z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
                                (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], mat)

deck = box('Bridge_Deck_Watertight', (0, 0, .1), (10, 3.8, .2), stone_mat)
deck.data.materials.append(deck_mat)
for face in deck.data.polygons:
    if face.normal.z > .9:
        face.material_index = 1
        for li in face.loop_indices:
            v = deck.data.vertices[deck.data.loops[li].vertex_index].co
            deck.data.uv_layers.active.data[li].uv = ((v.x + 5) / 2, (v.y + 1.9) / 2)
deck['checker_size_metres'] = .5
deck['tiles_are_texture_only'] = True
for y in PARAMS['curb_z']:
    box(f'Bridge_Low_Stone_Edge_{y:+.3f}', (0, y, .28), (10, .13, .16), stone_mat)

def shaft(name, x, y, z0, z1, r0, r1):
    vertices = []
    for z, r in [(z0, r0), (z1, r1)]:
        for i in range(8):
            a = i * math.tau / 8 + math.pi / 8
            vertices.append((x + r * math.cos(a), y + r * math.sin(a), z))
    faces = [tuple(reversed(range(8))), tuple(range(8, 16))]
    for i in range(8):
        j = (i + 1) % 8
        faces.append((i, j, j + 8, i + 8))
    return mesh(name, vertices, faces, stone_mat)

for i, x in enumerate(PARAMS['transverse_arch_x']):
    for side, y in enumerate(PARAMS['column_row_z']):
        prefix = f'Bridge_Column_{i+1}_{side+1}'
        box(prefix + '_Square_Base', (x, y, .27), (.56, .56, .14), stone_mat)
        shaft(prefix + '_Octagonal_Foot', x, y, .34, .44, .245, .21)
        shaft(prefix + '_Octagonal_Shaft', x, y, .44, 2.34, .19, .175)
        shaft(prefix + '_Capital_Neck', x, y, 2.34, 2.44, .19, .245)
        box(prefix + '_Square_Capital', (x, y, 2.495), (.50, .50, .11), stone_mat)

def pointed_arch(name, axis, fixed, midpoint, halfspan, rise, thickness, depth):
    # Each half is one circular ogive, sampled five times. Offset polylines
    # use miter joins, including a joined apex: no open caps or floating ribs.
    spring = PARAMS['deck_thickness'] + PARAMS['spring_height_above_deck']
    radius = (halfspan * halfspan + rise * rise) / (2 * halfspan)
    centre = radius - halfspan
    angle = math.atan2(rise, centre)
    count = PARAMS['segments_per_arch_half']
    points = [Vector((centre - radius * math.cos(angle * j / count),
                      spring + radius * math.sin(angle * j / count))) for j in range(count + 1)]
    points += [Vector((-p.x, p.y)) for p in reversed(points[:-1])]
    normals = []
    for j in range(len(points) - 1):
        direction = (points[j+1] - points[j]).normalized()
        normals.append(Vector((-direction.y, direction.x)))
    vertices = []
    distance = [0]
    for j in range(1, len(points)):
        distance.append(distance[-1] + (points[j] - points[j-1]).length)
    for j, p in enumerate(points):
        normal = normals[0] if j == 0 else normals[-1] if j == len(points)-1 else (normals[j-1] + normals[j]).normalized()
        mult = 1 if j in (0, len(points)-1) else 1 / normal.dot(normals[j-1])
        for radial, extrusion in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            q = p + normal * (radial * thickness / 2 * mult)
            if axis == 'Y':
                vertices.append((fixed + extrusion * depth / 2, midpoint + q.x, q.y))
            else:
                vertices.append((midpoint + q.x, fixed + extrusion * depth / 2, q.y))
    faces = [(3,2,1,0)]
    for j in range(len(points) - 1):
        for side in range(4):
            a, b = j * 4 + side, j * 4 + (side + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces.append(tuple((len(points)-1) * 4 + side for side in range(4)))
    obj = mesh(name, vertices, faces, stone_mat)
    # Stable developed UV strip follows the arch; repeats at about one metre.
    uv = obj.data.uv_layers.active
    for face in obj.data.polygons:
        for li in face.loop_indices:
            vi = obj.data.loops[li].vertex_index
            ring, corner = divmod(vi, 4)
            uv.data[li].uv = (distance[ring], [0, thickness, thickness + depth, 2*thickness + depth][corner])
    obj['shape'] = 'open pointed ogive, ten faceted segments, solid rectangular section'
    return obj

for i, x in enumerate(PARAMS['transverse_arch_x']):
    pointed_arch(f'Bridge_Transverse_Point_Arch_{i+1}', 'Y', x, 0, 1.55, 2.13, .22, .25)
for side, y in enumerate(PARAMS['column_row_z']):
    row_arches = []
    for bay, (x0, x1) in enumerate(zip(PARAMS['transverse_arch_x'][:-1], PARAMS['transverse_arch_x'][1:])):
        row_arches.append(pointed_arch(f'Bridge_Side_Point_Arch_{side+1}_{bay+1}', 'X', y, (x0+x1)/2, (x1-x0)/2, 2.13, .18, .20))
    # Neighbouring pointed arches share a short spring wedge. Union those
    # wedges to remove coplanar overlaps and dark self-intersection slivers.
    joined = row_arches[0]
    joined.name = f'Bridge_Side_Point_Arcade_{side+1}'
    bpy.context.view_layer.objects.active = joined
    for other in row_arches[1:]:
        modifier = joined.modifiers.new('Join_Common_Spring_Wedge', 'BOOLEAN')
        modifier.operation = 'UNION'
        modifier.solver = 'EXACT'
        modifier.object = other
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(other, do_unlink=True)
bpy.context.view_layer.update()

def stats(objects):
    points, triangles, names = [], 0, []
    for obj in objects:
        if obj.type != 'MESH': continue
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        points.extend(obj.matrix_world @ Vector(p) for p in obj.bound_box)
        names.append(obj.name)
    low = [min(p[i] for p in points) for i in range(3)]
    high = [max(p[i] for p in points) for i in range(3)]
    return {'triangles': triangles, 'meshes': len(names), 'mesh_names': names,
            'bounds_gltf': {'min': [low[0], low[2], -high[1]], 'max': [high[0], high[2], -low[1]]},
            'dimensions_gltf': [high[0]-low[0], high[2]-low[2], high[1]-low[1]]}

def topology(objects):
    records = []
    for obj in objects:
        if obj.type != 'MESH': continue
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
        records.append({'name': obj.name, 'non_manifold_edges': sum(not e.is_manifold for e in bm.edges),
                        'signed_volume_m3': bm.calc_volume(signed=True),
                        'uv_layers': len(obj.data.uv_layers), 'flat_faces': all(not p.use_smooth for p in obj.data.polygons)})
        bm.free()
    return records

def clearance_tests(objects):
    vertices, faces = [], []
    for obj in objects:
        if obj.type != 'MESH': continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset + i for i in p.vertices) for p in obj.data.polygons)
    tree = BVHTree.FromPolygons(vertices, faces)
    tests = []
    for y in (-1.20, 0, 1.20):
        for height in (.05, 1, 1.8, 2.25):
            clear = tree.ray_cast(Vector((-5.1, y, .2 + height)), Vector((1,0,0)), 10.2)[0] is None
            tests.append({'test': 'straight_walkway', 'lateral': y, 'height_above_deck': height, 'clear': clear})
    for x in (-2.8, 0, 2.8):
        clear = tree.ray_cast(Vector((x,0,.21)), Vector((0,0,1)), 7)[0] is None
        tests.append({'test': 'open_sky_bay', 'x': x, 'clear': clear})
    underside = tree.ray_cast(Vector((0,0,-1)), Vector((0,0,1)), 1.01)[0]
    top = tree.ray_cast(Vector((0,0,1)), Vector((0,0,-1)), 1)[0]
    return {'rays': tests, 'all_passed': all(t['clear'] for t in tests),
            'deck_bottom': underside.z if underside is not None else None,
            'deck_top': top.z if top is not None else None,
            'narrowest_base_gap': 2 * 1.55 - .56, 'tested_open_walkway_width': 2.4}

source_stats = stats(asset.objects)
source_topology = topology(asset.objects)
source_clearance = clearance_tests(asset.objects)
assert source_clearance['all_passed'], source_clearance
assert all(r['non_manifold_edges'] == 0 and r['signed_volume_m3'] > 0 and r['uv_layers'] == 1 for r in source_topology)
assert abs(source_stats['dimensions_gltf'][0] - 10) < .0001
assert abs(source_stats['dimensions_gltf'][2] - 3.8) < .0001
assert abs(source_stats['bounds_gltf']['min'][1]) < .0001

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = PARAMS['render_samples']
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 840
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.world.color = (.35, .38, .42)
floor_mat = material('PREVIEW_Floor', color=(.20,.23,.25))
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.015))
floor = bpy.context.object
floor.name = 'PREVIEW_Floor'
floor.data.materials.append(floor_mat)
move_to(floor, preview)
for name, pos, power, size in [('Key',(-9,-10,14),2100,9),('Fill',(9,-3,10),1300,8),('Rim',(0,9,12),1800,8)]:
    data = bpy.data.lights.new('PREVIEW_' + name, 'AREA')
    data.energy, data.size = power, size
    obj = bpy.data.objects.new('PREVIEW_' + name, data)
    preview.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector((0,0,2)) - obj.location).to_track_quat('-Z','Y').to_euler()
camera_data = bpy.data.cameras.new('PREVIEW_Camera')
camera = bpy.data.objects.new('PREVIEW_Camera', camera_data)
preview.objects.link(camera)
scene.camera = camera
camera_data.type = 'ORTHO'
def camera_view(pos, target=(0,0,2), scale=13):
    camera.location = pos
    camera.rotation_euler = (Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.ortho_scale = scale

bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects: obj.select_set(True)
bpy.context.view_layer.objects.active = root
glb = ROOT / 'ArcadeBridge_01.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
                          export_apply=True, export_yup=True, export_texcoords=True,
                          export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False)
glb_bytes = glb.read_bytes()
json_size = struct.unpack_from('<I',glb_bytes,12)[0]
gltf = json.loads(glb_bytes[20:20+json_size].decode('utf-8'))
assert len(gltf['images']) == 2 and all('bufferView' in im for im in gltf['images'])
assert all('TEXCOORD_0' in p['attributes'] and 'NORMAL' in p['attributes'] for m in gltf['meshes'] for p in m['primitives'])
assert all(m.get('alphaMode','OPAQUE') == 'OPAQUE' for m in gltf['materials'])
camera_view((12,-15,10), (0,0,2.1), 13.6)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'ArcadeBridge_01.blend'))
for name, pos, target, scale in [
    ('head',(-18,0,3),(0,0,2.35),8.2),
    ('side',(0,-20,4.5),(0,0,2.35),12.4),
    ('oblique',(12,-15,10),(0,0,2.1),13.6),
    ('walkthrough',(-10,-.2,1.85),(1,0,2.25),7.8),
]:
    camera_view(pos,target,scale)
    scene.render.filepath = str(ROOT / 'previews' / f'bridge_{name}.png')
    bpy.ops.render.render(write_still=True)

for obj in tuple(asset.objects): bpy.data.objects.remove(obj,do_unlink=True)
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(glb))
imported = [o for o in bpy.data.objects if o not in before]
bpy.context.view_layer.update()
import_stats = stats(imported)
import_topology = topology(imported)
import_clearance = clearance_tests(imported)
assert import_clearance['all_passed']
assert import_stats['triangles'] == source_stats['triangles']
assert max(abs(a-b) for a,b in zip(import_stats['dimensions_gltf'],source_stats['dimensions_gltf'])) < .0001
assert all(r['non_manifold_edges'] == 0 and r['signed_volume_m3'] > 0 and r['uv_layers'] == 1 for r in import_topology)
import_root = next(o for o in imported if o.name == 'ArcadeBridge_01')
assert import_root.location.length < .0001
materials = {slot.material for obj in imported if obj.type == 'MESH' for slot in obj.material_slots if slot.material}
image_records = []
for mat in materials:
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image:
            image_records.append({'material':mat.name,'image':node.image.name,'size':list(node.image.size),'has_pixels':bool(node.image.has_data)})
assert len(image_records) == 2 and all(r['has_pixels'] and r['size'] == [256,256] for r in image_records)
camera_view((12,-15,10),(0,0,2.1),13.6)
scene.render.filepath = str(ROOT / 'previews' / 'bridge_glb_reimport.png')
bpy.ops.render.render(write_still=True)
report = {
    'asset':'ArcadeBridge_01','blender_version':bpy.app.version_string,'blender_executable':bpy.app.binary_path,
    'parameters':PARAMS,'export':source_stats,'reimport':import_stats,'source_topology':source_topology,
    'reimport_topology':import_topology,'source_clearance':source_clearance,'reimport_clearance':import_clearance,
    'embedded_images':image_records,'glb_bytes':len(glb_bytes),
    'collision':{'world_centre_xz':[39,-8],'placement_y':-.18,'world_deck_top':.02,
                 'deck_half_extents_xz':[5,1.9],'column_x':PARAMS['transverse_arch_x'],
                 'column_z':[-1.55,1.55],'column_base_half_width':.28,
                 'curb_z':[-1.835,1.835],'curb_half_width':.065,'curb_height_above_deck':.16,
                 'use_full_height_bounding_box':False},
    'checks':{'glb_reimport_passed':True,'watertight_components':True,'origin_at_zero':True,
              'real_uvs_and_embedded_images':True,'opaque_matte_materials':True,'flat_shading_source':True,
              'no_solid_roof':True,'walkway_rays_clear':True,'deck_has_complete_bottom_and_sides':True},
}
(ROOT / 'bridge_report.json').write_text(json.dumps(report, indent=2),encoding='utf-8')
shutil.copyfile(glb, ROOT.parent / 'public' / 'assets' / glb.name)
print('BRIDGE_REPORT', json.dumps({'dimensions_gltf':source_stats['dimensions_gltf'],
      'triangles':source_stats['triangles'],'meshes':source_stats['meshes'],'glb':str(glb),
      'walkway_clearance':import_clearance,'copied_public':True}))
