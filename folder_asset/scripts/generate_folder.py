"""Build, export, reimport and render the original low-resolution folder prop.

Run with Blender 5.2: blender --background --factory-startup --python this_file.py
Blender axes: X width, -Y front, Z up. glTF axes: X width, +Z front, Y up.
The model's bottom-centre is the origin. All preview helpers are excluded from GLB.
"""
from pathlib import Path
import bpy
import json
import math
import shutil
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT.parent
for folder in ('textures', 'previews'):
    (ROOT / folder).mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)

# An opaque, hand-authored 128 x 128 pixel atlas. No reference background is used.
# Its lower half holds 64-pixel front/back colour fields; the upper half is a palette.
SIZE = 128
palette = {
    'outline': (113, 117, 112),
    'highlight': (185, 184, 149),
    'shadow': (23, 24, 18),
    'side': (177, 143, 35),
    'inside': (153, 127, 31),
    'fold': (222, 184, 48),
    'light': (255, 237, 130),
    'darkgray': (79, 83, 77),
}
pixels = [0.0] * (SIZE * SIZE * 4)
swatches = {}
names = list(palette)
for y in range(SIZE):
    for x in range(SIZE):
        if y < 64:
            xx = x % 64
            if x < 64:
                rgb = (247, 211, 70)
                if y > 58 or xx < 3: rgb = (255, 229, 112)
                if y < 3 or xx > 60: rgb = (222, 181, 42)
                # Sparse restrained pixel wear, deliberately never a checkerboard.
                if (xx, y) in {(6, 8), (7, 8), (54, 6), (54, 7), (57, 51), (11, 55)}:
                    rgb = (233, 193, 49)
            else:
                rgb = (237, 200, 63)
                if y > 58 or xx < 3: rgb = (250, 220, 104)
                if y < 3 or xx > 60: rgb = (207, 167, 40)
                if (xx, y) in {(8, 11), (9, 11), (52, 8), (55, 49)}:
                    rgb = (222, 181, 47)
        else:
            rgb = palette[names[min(x // 16, 7)]]
        offset = 4 * (y * SIZE + x)
        pixels[offset:offset + 4] = [rgb[0]/255, rgb[1]/255, rgb[2]/255, 1.0]
for i, name in enumerate(names):
    swatches[name] = ((i * 16 + 8) / 128, 96 / 128)
texture = bpy.data.images.new('MemeFolder_PixelAtlas_128', width=128, height=128, alpha=False)
texture.pixels.foreach_set(pixels)
texture.filepath_raw = str(ROOT / 'textures' / 'MemeFolder_128.png')
texture.file_format = 'PNG'
texture.save()
texture.pack()
material = bpy.data.materials.new('MemeFolder_PixelAtlas_Nearest')
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = 1.0
shader.inputs['Metallic'].default_value = 0.0
shader.inputs['Specular IOR Level'].default_value = 0.0
texture_node = material.node_tree.nodes.new('ShaderNodeTexImage')
texture_node.image = texture
texture_node.interpolation = 'Closest'
texture_node.extension = 'EXTEND'
material.node_tree.links.new(texture_node.outputs['Color'], shader.inputs['Base Color'])
material.diffuse_color = (0.96, 0.80, 0.20, 1)

vertices, faces, face_uvs = [], [], []
parts = []

def add_face(coords, uv):
    start = len(vertices)
    vertices.extend(coords)
    faces.append(tuple(range(start, start + len(coords))))
    face_uvs.append(uv if isinstance(uv, list) else [swatches[uv]] * len(coords))

def planar_uv(poly, tile):
    xmin, xmax = min(p[0] for p in poly), max(p[0] for p in poly)
    zmin, zmax = min(p[1] for p in poly), max(p[1] for p in poly)
    xoffset = 64 if tile == 'back' else 0
    return [((xoffset + 0.5 + (p[0]-xmin)/(xmax-xmin)*63)/128,
             (0.5 + (p[1]-zmin)/(zmax-zmin)*63)/128) for p in poly]

def inset_polygon(poly, distance):
    """Mitred 2D inward offset for CCW, orthogonal stair-step silhouettes."""
    result = []
    for i, pt in enumerate(poly):
        prev, here, nxt = Vector(poly[i-1]), Vector(pt), Vector(poly[(i+1)%len(poly)])
        a, b = (here-prev).normalized(), (nxt-here).normalized()
        na, nb = Vector((-a.y, a.x)), Vector((-b.y, b.x))
        denom = 1 + na.dot(nb)
        result.append(tuple(here + (na+nb)*distance/denom))
    return result

def panel(name, poly, yfront, yback, border=0.013, front='front', back='back', side='side'):
    start = len(faces)
    inner = inset_polygon(poly, border)
    n = len(poly)
    f = lambda p, y: (p[0], y, p[1])
    add_face([f(p, yfront) for p in inner], planar_uv(inner, front))
    add_face([f(p, yback) for p in reversed(inner)], list(reversed(planar_uv(inner, back))))
    for i in range(n):
        j = (i+1)%n
        # Gray front and back rims, with a light top-left pixel edge.
        edge = 'outline'
        add_face([f(poly[i],yfront),f(poly[j],yfront),f(inner[j],yfront),f(inner[i],yfront)], edge)
        add_face([f(inner[i],yback),f(inner[j],yback),f(poly[j],yback),f(poly[i],yback)], edge)
        add_face([f(poly[i],yfront),f(poly[i],yback),f(poly[j],yback),f(poly[j],yfront)], side)
    parts.append({'name': name, 'face_start': start, 'face_count': len(faces)-start})

def solid(name, poly, yfront, yback, color):
    start = len(faces)
    f = lambda p, y: (p[0], y, p[1])
    add_face([f(p,yfront) for p in poly], color)
    add_face([f(p,yback) for p in reversed(poly)], color)
    for i in range(len(poly)):
        j = (i+1)%len(poly)
        add_face([f(poly[i],yfront),f(poly[i],yback),f(poly[j],yback),f(poly[j],yfront)], color)
    parts.append({'name': name, 'face_start': start, 'face_count': len(faces)-start})

# Stepped shapes are true geometry, not transparent image planes.
rear = [(-.43,.04),(.48,.04),(.48,.65),(.45,.65),(.45,.68),
        (.10,.68),(.10,.71),(.07,.71),(.07,.74),(.04,.74),(.04,.78),
        (-.26,.78),(-.26,.75),(-.29,.75),(-.29,.72),(-.32,.72),
        (-.32,.69),(-.35,.69),(-.35,.55),(-.43,.55)]
front = [(-.41,.02),(.43,.02),(.43,.05),(.46,.05),(.46,.45),
         (.43,.45),(.43,.57),(-.47,.57),(-.47,.54),(-.50,.54),
         (-.50,.41),(-.47,.41),(-.47,.23),(-.44,.23),(-.44,.05),(-.41,.05)]
solid('Rear_Pixel_Shadow', [(x+.02,z-.02) for x,z in rear], .025,.065, 'shadow')
panel('Back_Cover_With_Tab', rear, .005,.070)
solid('Front_Pixel_Shadow', [(x+.02,z-.02) for x,z in front], -.059,.022, 'shadow')
panel('Front_Cover', front, -.070,-.040)
solid('Bottom_Fold', [(-.39,.026),(.42,.026),(.42,.072),(-.39,.072)], -.04,.014,'fold')

mesh = bpy.data.meshes.new('MemeFolder_01_Mesh')
mesh.from_pydata(vertices, [], faces)
mesh.update()
mesh.materials.append(material)
uvlayer = mesh.uv_layers.new(name='PixelAtlas')
for face, coords in zip(mesh.polygons, face_uvs):
    for loop, uv in zip(face.loop_indices, coords):
        uvlayer.data[loop].uv = uv
obj = bpy.data.objects.new('MemeFolder_01', mesh)
bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
# Merge shared positions, preserving the intentional flat normals and UV seams.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.object.mode_set(mode='OBJECT')
for poly in mesh.polygons:
    poly.use_smooth = False
obj['asset_id'] = 'MemeFolder_01'
obj['front_axis_gltf'] = '+Z'
obj['origin'] = 'bottom centre'
obj['style'] = 'Low-resolution Y2K folder; no backdrop or alpha planes'
obj['texture_filter'] = 'Nearest'
obj['intended_game_width_m'] = 0.8
mesh.calc_loop_triangles()
dimensions = list(obj.dimensions)
triangles = len(mesh.loop_triangles)
source_vertices = len(mesh.vertices)

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0
glb = ROOT / 'MemeFolder_01.glb'
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True,
    export_yup=True, export_texcoords=True, export_normals=True,
    export_materials='EXPORT', export_cameras=False, export_lights=False,
    export_extras=True, export_apply=True)
(PROJECT / 'public' / 'assets').mkdir(parents=True, exist_ok=True)
shutil.copy2(glb, PROJECT / 'public' / 'assets' / glb.name)

# Preserve the editable source, then reimport the actual exported file for QA renders.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'MemeFolder_01.blend'))
original = obj
original.hide_render = True
original.hide_set(True)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.import_scene.gltf(filepath=str(glb))
imported = [o for o in bpy.context.selected_objects if o.type == 'MESH']
assert len(imported) == 1, f'Expected one imported mesh, found {len(imported)}'
reimport = imported[0]
reimport.name = 'QA_Reimported_GLB'
reimport.data.calc_loop_triangles()
assert max(abs(a-b) for a,b in zip(reimport.dimensions, dimensions)) < 0.00001
assert len(reimport.data.loop_triangles) == triangles
assert all(node.interpolation == 'Closest' for mat in reimport.data.materials
    for node in mat.node_tree.nodes if node.type == 'TEX_IMAGE')

# Check the binary glTF container itself, including the front-facing axis conversion.
import struct
raw = glb.read_bytes()
assert raw[:4] == b'glTF'
json_length = struct.unpack_from('<I', raw, 12)[0]
gltf = json.loads(raw[20:20+json_length])
assert all(s.get('magFilter') == 9728 and s.get('minFilter') in (9728,9984)
           for s in gltf.get('samplers',[]))
assert all(m.get('alphaMode','OPAQUE') == 'OPAQUE' for m in gltf['materials'])
assert len(gltf['images']) == 1 and 'bufferView' in gltf['images'][0]
gltf_min, gltf_max = [float('inf')]*3, [float('-inf')]*3
for primitive in gltf['meshes'][0]['primitives']:
    accessor = gltf['accessors'][primitive['attributes']['POSITION']]
    for i in range(3):
        gltf_min[i] = min(gltf_min[i],accessor['min'][i])
        gltf_max[i] = max(gltf_max[i],accessor['max'][i])

scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 768
scene.render.resolution_y = 768
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.10,0.12,0.16,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

def aim(o, target):
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

for name, loc, energy, size in [('Key',(-2,-3,4),210,4),('Fill',(2,1,3),170,3)]:
    data=bpy.data.lights.new(name,'AREA')
    data.energy=energy
    data.shape='DISK'
    data.size=size
    light=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(light)
    light.location=loc
    aim(light,(0,0,.38))
camera_data = bpy.data.cameras.new('QA_Camera')
camera = bpy.data.objects.new('QA_Camera',camera_data)
bpy.context.collection.objects.link(camera)
camera_data.type='ORTHO'
camera_data.ortho_scale=1.27
scene.camera=camera
views = {'front':(0,-4,.39),'oblique':(2.3,-3.2,1.80),'back':(0,4,.39)}
for name, location in views.items():
    camera.location=location
    aim(camera,(0,0,.39))
    scene.render.filepath=str(ROOT/'previews'/f'{name}.png')
    bpy.ops.render.render(write_still=True)

report = {
    'blender_version': bpy.app.version_string,
    'asset': 'MemeFolder_01',
    'dimensions_blender_xyz_m': dimensions,
    'dimensions_gltf_xyz_m': [gltf_max[i]-gltf_min[i] for i in range(3)],
    'gltf_bounds_min':gltf_min,'gltf_bounds_max':gltf_max,
    'origin':'Bottom centre; front +Z in glTF',
    'triangles':triangles,'source_vertices':source_vertices,
    'mesh_count':len(gltf['meshes']),'material_count':len(gltf['materials']),
    'texture_size':[128,128],'texture_filter':'Nearest','alpha_mode':'OPAQUE',
    'glb_bytes':len(raw),'reimport_verified':True,
    'reimport_dimensions_blender_xyz_m':list(reimport.dimensions),
    'samplers':gltf.get('samplers',[]),'parts':parts,
    'previews':'Rendered from the reimported exported GLB using Cycles',
    'paths':{'blend':str(ROOT/'MemeFolder_01.blend'),'glb':str(glb),
             'public_glb':str(PROJECT/'public'/'assets'/glb.name),
             'texture':str(ROOT/'textures'/'MemeFolder_128.png')}
}
(ROOT/'folder_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('FOLDER_ASSET_REPORT',json.dumps(report))
