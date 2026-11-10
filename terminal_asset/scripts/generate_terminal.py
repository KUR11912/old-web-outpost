"""Build the editable Y2K CRT + keyboard in metres; no desk or sign.
Run: blender --background --factory-startup --python generate_terminal.py
Blender front -Y exports as glTF +Z. Asset origin is the tabletop centre.
The supplied desktop image is read, never overwritten by this script.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PARAMS = {
    'seed': 63112028, 'units': 'metres', 'front': 'Blender -Y / glTF +Z',
    'origin': 'tabletop bottom centre (0,0,0)',
    'body_width': .80, 'body_bottom': .14, 'body_top': .76,
    'front_gltf_z': .135, 'rear_gltf_z': -.35,
    'screen_width': .56, 'screen_height': .42, 'screen_centre_height': .48,
    'glass_bulge': .016, 'glass_roughness': .25, 'glass_emission': .22,
    'keyboard_width': .59, 'keyboard_depth': .20, 'keyboard_centre_gltf_z': .25,
    'plastic_roughness': .7, 'plastic_texture_size': 128,
    'screen_texture': 'textures/screen_desktop_256.png',
    'render_samples': 32, 'render_resolution': [1200, 1000],
}
for directory in ('textures', 'previews'):
    (ROOT / directory).mkdir(parents=True, exist_ok=True)
screen_path = ROOT / PARAMS['screen_texture']
if not screen_path.is_file():
    raise FileNotFoundError(f'Required supplied desktop image is not ready: {screen_path}')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
bpy.context.preferences.filepaths.save_version = 0
asset_collection = bpy.data.collections.new('OldTerminal_CRT_01_Asset')
scene.collection.children.link(asset_collection)
preview_collection = bpy.data.collections.new('PREVIEW_ONLY')
scene.collection.children.link(preview_collection)
root = bpy.data.objects.new('OldTerminal_CRT_01', None)
asset_collection.objects.link(root)
root['seed'] = PARAMS['seed']
root['origin_policy'] = PARAMS['origin']
root['forward'] = PARAMS['front']
root['web_tabletop_height'] = .805

def move_to(obj, collection):
    for existing in tuple(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)

def texture(name, pixels):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    image.pixels.foreach_set(np.flipud(pixels).astype(np.float32).ravel())
    image.filepath_raw = str(ROOT / 'textures' / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image

rng = np.random.default_rng(PARAMS['seed'])
size = PARAMS['plastic_texture_size']
plastic_pixels = np.ones((size, size, 4), dtype=np.float32)
coarse = np.repeat(np.repeat(rng.uniform(-.015, .015, (32, 32)), 4, axis=0), 4, axis=1)
grain = rng.uniform(-.006, .006, (size, size))
plastic_pixels[:, :, :3] = np.clip(np.array([.76, .755, .687]) + (coarse + grain)[:, :, None], 0, 1)
plastic_image = texture('plastic_ivory_128', plastic_pixels)
vent_pixels = plastic_pixels.copy()
for y in range(22, 111, 8):
    vent_pixels[y:y+3, 12:116, :3] = [.255, .265, .245]
    vent_pixels[y+3:y+4, 12:116, :3] = [.84, .83, .76]
vent_image = texture('rear_vents_128', vent_pixels)

# Deliberately coarse 3x5 legends; the keycap geometry does the rest.
glyphs = [
    ['010','110','010','010','111'], ['110','001','010','100','111'],
    ['110','001','010','001','110'], ['101','101','111','001','001'],
    ['111','100','110','001','110'], ['011','100','110','101','010'],
    ['111','001','010','010','010'], ['010','101','010','101','010'],
    ['010','101','111','001','110'], ['010','101','111','101','101'],
    ['110','101','110','101','110'], ['011','100','100','100','011'],
    ['110','101','101','101','110'], ['111','100','110','100','111'],
    ['111','100','110','100','100'], ['000','000','000','000','000'],
]
key_pixels = np.ones((128, 128, 4), dtype=np.float32)
key_pixels[:, :, :3] = [.82, .81, .745]
for i, rows in enumerate(glyphs):
    x0, y0 = (i % 4) * 32 + 8, (i // 4) * 32 + 7
    for y, row in enumerate(rows):
        for x, bit in enumerate(row):
            if bit == '1':
                key_pixels[y0+y*2:y0+y*2+2, x0+x*2:x0+x*2+2, :3] = [.26, .28, .26]
key_image = texture('key_legends_128', key_pixels)
screen_image = bpy.data.images.load(str(screen_path), check_existing=True)
screen_image.pack()

def material(name, image=None, color=(.7, .7, .7), roughness=.7, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    bsdf.inputs['Specular IOR Level'].default_value = .25
    if image:
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = image
        node.interpolation = 'Closest'
        node.extension = 'EXTEND'
        mat.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
        if emission:
            mat.node_tree.links.new(node.outputs['Color'], bsdf.inputs['Emission Color'])
    elif emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
    bsdf.inputs['Emission Strength'].default_value = emission
    return mat

plastic = material('CRT_Ivory_Plastic', plastic_image)
vent_mat = material('CRT_Rear_Vent_Texture', vent_image)
key_mat = material('CRT_Keycaps_Atlas', key_image, roughness=.76)
dark = material('CRT_Recessed_Dark_Rim', color=(.10, .115, .105), roughness=.82)
screen_mat = material('CRT_Screen_Glass', screen_image, roughness=.25, emission=.22)
led = material('CRT_Power_LED', color=(.23, .72, .19), roughness=.4, emission=.35)

def mesh_object(name, vertices, faces, mat, uv_coords=None):
    mesh = bpy.data.meshes.new(name + '_Mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    for face in mesh.polygons:
        for loop_index in face.loop_indices:
            vi = mesh.loops[loop_index].vertex_index
            co = Vector(vertices[vi])
            uv.data[loop_index].uv = uv_coords[vi] if uv_coords else (co.x + .5, co.z + .1)
    obj = bpy.data.objects.new(name, mesh)
    asset_collection.objects.link(obj)
    obj.parent = root
    mesh.materials.append(mat)
    return obj

def box(name, centre, dimensions, mat, bevel=.008, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    move_to(obj, asset_collection)
    obj.parent = root
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Low_poly_corner_bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.affect = 'EDGES'
    return obj

def rounded_loop(width, height, y, centre_z, radius=.018, segments=2):
    points = []
    for cx, cz, start in [
        (width/2-radius, centre_z+height/2-radius, 0),
        (-width/2+radius, centre_z+height/2-radius, 90),
        (-width/2+radius, centre_z-height/2+radius, 180),
        (width/2-radius, centre_z-height/2+radius, 270),
    ]:
        for angle in np.linspace(start, start+90, segments+1):
            a = math.radians(angle)
            points.append((cx + radius*math.cos(a), y, cz + radius*math.sin(a)))
    return points

def shell_between(name, loops, mat, cap_back=False):
    n = len(loops[0])
    vertices = [v for loop in loops for v in loop]
    faces = []
    for ring in range(len(loops)-1):
        for i in range(n):
            j = (i+1) % n
            faces.append((ring*n+i, ring*n+j, (ring+1)*n+j, (ring+1)*n+i))
    if cap_back:
        faces.append(tuple(reversed(range((len(loops)-1)*n, len(loops)*n))))
    return mesh_object(name, vertices, faces, mat)

# Frustum shell has a real deep rear housing rather than a flat screen slab.
outer = rounded_loop(.8, .62, -.135, .45, .018)
front_edge = rounded_loop(.8, .62, -.105, .45, .018)
rear = rounded_loop(.56, .43, .35, .46, .024)
shell_between('CRT_Tapered_Rear_Housing', [front_edge, rear], plastic, True)
inner_front = rounded_loop(.602, .462, -.135, .48, .015)
inner_recess = rounded_loop(.578, .438, -.104, .48, .012)
shell_between('CRT_Asymmetric_Front_Bezel', [front_edge, outer, inner_front, inner_recess], plastic)
glass_edge = rounded_loop(.56, .42, -.106, .48, .008)
shell_between('CRT_Recessed_Inner_Rim', [inner_recess, glass_edge], dark)

# Curved screen mesh: entire glass remains behind the frontmost bezel.
columns, rows = 12, 9
screen_verts, screen_uvs, screen_faces = [], [], []
for row in range(rows+1):
    v = row/rows
    for col in range(columns+1):
        u = col/columns
        bulge = .016 * (1-(2*u-1)**2) * (1-(2*v-1)**2)
        screen_verts.append(((u-.5)*.56, -.106-bulge, .48+(v-.5)*.42))
        screen_uvs.append((u,v))
for row in range(rows):
    for col in range(columns):
        i = row*(columns+1)+col
        screen_faces.append((i,i+1,i+columns+2,i+columns+1))
glass = mesh_object('CRT_Convex_4x3_Screen', screen_verts, screen_faces, screen_mat, screen_uvs)
for face in glass.data.polygons:
    face.use_smooth = True

box('CRT_Layered_Lower_Base', (0,.035,.018), (.48,.34,.036), plastic, .012, 2)
box('CRT_Layered_Upper_Base', (0,.04,.050), (.405,.285,.030), plastic, .014, 2)
box('CRT_Short_Support', (0,.035,.1075), (.235,.165,.085), plastic, .013, 2)

# Vents follow the tapered side surface. They are textured shallow panels, not thin bars.
mesh_object('CRT_Back_Vents', [(-.215,.3508,.34),(.215,.3508,.34),(.215,.3508,.60),(-.215,.3508,.60)],
    [(3,2,1,0)], vent_mat, [(0,0),(1,0),(1,1),(0,1)])
def side_x(y):
    return .4 - (y+.105)/.455*.12 + .001
for sign in (-1,1):
    points = [(sign*side_x(.015),.015,.35),(sign*side_x(.265),.265,.35),
              (sign*side_x(.265),.265,.60),(sign*side_x(.015),.015,.60)]
    mesh_object(f'CRT_Side_Vents_{sign}', points, [(0,1,2,3)] if sign==1 else [(3,2,1,0)],
                vent_mat, [(0,0),(1,0),(1,1),(0,1)])

box('CRT_Power_Button', (.31,-.140,.187), (.040,.013,.025), plastic, .004, 2)
box('CRT_Green_LED', (.265,-.143,.187), (.009,.004,.007), led, .001, 1)
# A small mark keeps the chin readable without adding a label covering the glass.
box('CRT_Chin_Mark', (-.28,-.137,.185), (.066,.003,.007), dark, .001, 1)

box('Keyboard_Low_Profile_Body', (0,-.25,.013), (.59,.20,.026), plastic, .008, 2)
key_objects = []
def add_key(index, x, y, width=.035, depth=.026, legend=None):
    obj = box(f'Keyboard_Key_{index:02d}', (x,y,.035), (width,depth,.020), key_mat, .003, 1)
    tile = (index % 15) if legend is None else legend
    tx, ty = tile % 4, tile // 4
    uv = obj.data.uv_layers.active
    for face in obj.data.polygons:
        for li in face.loop_indices:
            co = obj.data.vertices[obj.data.loops[li].vertex_index].co
            if face.normal.z > .5:
                u = (co.x/width+.5)*.94+.03
                v = (co.y/depth+.5)*.94+.03
                uv.data[li].uv = ((tx+u)/4, (3-ty+v)/4)
            else:
                uv.data[li].uv = ((tx+.90)/4, (3-ty+.90)/4)
    key_objects.append(obj)

key_index=0
for count, y in [(12,-.175),(12,-.210),(11,-.245),(9,-.280)]:
    for i in range(count):
        add_key(key_index, (i-(count-1)/2)*.044, y)
        key_index+=1
for x,w in [(-.226,.075),(0,.31),(.226,.075)]:
    add_key(key_index,x,-.318,w,.024,15)
    key_index+=1
assert key_index == 47

# Flat shading keeps the silhouette simple; only the convex glass is smooth.
for obj in asset_collection.objects:
    if obj.type == 'MESH' and obj != glass:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(obj.data)
        bm.free()

def asset_stats(objects):
    deps = bpy.context.evaluated_depsgraph_get()
    triangles=0
    bounds=[]
    names=[]
    for obj in objects:
        if obj.type!='MESH':
            continue
        evaluated=obj.evaluated_get(deps)
        mesh=evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles+=len(mesh.loop_triangles)
        bounds.extend(obj.matrix_world @ Vector(corner) for corner in evaluated.bound_box)
        names.append(obj.name)
        evaluated.to_mesh_clear()
    low=[min(p[i] for p in bounds) for i in range(3)]
    high=[max(p[i] for p in bounds) for i in range(3)]
    return {'triangles':triangles,'mesh_count':len(names),'mesh_names':names,
            'bounds_blender':{'min':low,'max':high},
            'bounds_gltf':{'min':[low[0],low[2],-high[1]],'max':[high[0],high[2],-low[1]]},
            'dimensions_gltf':[high[0]-low[0],high[2]-low[2],high[1]-low[1]]}

stats=asset_stats(asset_collection.objects)
assert stats['bounds_gltf']['min'][1] > -.00001
assert stats['bounds_gltf']['max'][0] <= .401
assert stats['bounds_gltf']['max'][2] <= .351
assert stats['bounds_gltf']['min'][2] >= -.351

scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=PARAMS['render_samples']
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y=PARAMS['render_resolution']
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='Standard'
scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [] else 'None'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
scene.world.color=(.34,.36,.39)
floor_mat=material('PREVIEW_Floor', color=(.185,.215,.24),roughness=.96)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.0015))
floor=bpy.context.object
floor.name='PREVIEW_Floor'
floor.data.materials.append(floor_mat)
move_to(floor,preview_collection)

def area(name,location,power,size):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);preview_collection.objects.link(obj)
    obj.location=location
    obj.rotation_euler=(Vector((0,0,.4))-obj.location).to_track_quat('-Z','Y').to_euler()
area('PREVIEW_Key',(-2,-3,4),170,3)
area('PREVIEW_Fill',(3,-1,2),90,3)
area('PREVIEW_Rim',(0,3,3),110,2)
camera_data=bpy.data.cameras.new('PREVIEW_Camera')
camera=bpy.data.objects.new('PREVIEW_Camera',camera_data)
preview_collection.objects.link(camera)
scene.camera=camera
camera_data.type='ORTHO';camera_data.ortho_scale=1.12
def set_camera(position,target=(0,0,.38),scale=1.12):
    camera.location=position
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=scale

# Export only the asset collection; separate preview floor/lights never enter GLB.
bpy.ops.object.select_all(action='DESELECT')
for obj in asset_collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active=root
glb_path=ROOT/'OldTerminal_CRT_01.glb'
bpy.ops.export_scene.gltf(filepath=str(glb_path),export_format='GLB',use_selection=True,
    export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,
    export_materials='EXPORT',export_cameras=False,export_lights=False)
set_camera((1.65,-2.5,1.35),scale=1.26)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'OldTerminal_CRT_01.blend'))

for name,position,target,scale in [
    ('front',(0,-3,.43),(0,0,.39),1.08),
    ('side',(3,0,.52),(0,0,.38),1.08),
    ('oblique',(1.65,-2.5,1.35),(0,0,.38),1.26),
]:
    set_camera(position,target,scale)
    scene.render.filepath=str(ROOT/'previews'/f'terminal_{name}.png')
    bpy.ops.render.render(write_still=True)

# Actual re-import verification using only the exported GLB.
for obj in tuple(asset_collection.objects):
    bpy.data.objects.remove(obj,do_unlink=True)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(glb_path))
imported=[obj for obj in bpy.data.objects if obj not in before]
import_stats=asset_stats(imported)
imported_materials={slot.material for obj in imported if obj.type=='MESH' for slot in obj.material_slots if slot.material}
image_records=[]
for mat in imported_materials:
    for node in mat.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image:
            image_records.append({'material':mat.name,'image':node.image.name,'size':list(node.image.size),'has_pixels':bool(node.image.has_data)})
assert any('CRT_Screen_Glass' in record['material'] and record['size']==[256,192] for record in image_records), image_records
assert all(record['has_pixels'] for record in image_records)
assert import_stats['triangles']==stats['triangles'], (stats['triangles'],import_stats['triangles'])
assert max(abs(import_stats['dimensions_gltf'][i]-stats['dimensions_gltf'][i]) for i in range(3)) < .0001
set_camera((1.65,-2.5,1.35),(0,0,.38),1.26)
scene.render.filepath=str(ROOT/'previews'/'terminal_glb_reimport.png')
bpy.ops.render.render(write_still=True)
report={'asset':'OldTerminal_CRT_01','blender_version':bpy.app.version_string,
        'blender_executable':bpy.app.binary_path,'parameters':PARAMS,
        'keycaps':key_index,'export':stats,'reimport':import_stats,'reimport_images':image_records,
        'checks':{'reimport_passed':True,'all_embedded_images_loaded':True,'metres':True,
                  'bottom_on_tabletop':True,'within_1m_by_078m_desk':True,
                  'asset_root_at_origin':True,'screen_aspect':'4:3',
                  'screen_not_transparent':True,'screen_glass_recessed_behind_bezel':True},
        'limitations':['Prototype uses one textured desktop and 47 simplified keycaps; no animated boot screen.']}
(ROOT/'terminal_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('TERMINAL_BUILD_REPORT',json.dumps({'triangles':stats['triangles'],'dimensions_gltf':stats['dimensions_gltf'],'glb':str(glb_path)},ensure_ascii=False))
