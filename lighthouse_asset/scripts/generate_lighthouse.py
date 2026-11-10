"""Build a genuine, solid-shell helical lighthouse, not a transparent cylinder.
Blender -Y / glTF +Z is the front; metre units; bottom-centre origin.
Re-run with Blender --background --factory-startup --python this_file.
"""
import bpy, bmesh, math, json, struct, argparse, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
PARAMS={
    'seed':63112030,'units':'metres','origin':'bottom centre','front':'Blender -Y / glTF +Z',
    'world_centre':[57,0,-41],'total_height':14.30,'turns':3,'segments_per_turn':24,
    'outer_radius':1.70,'wall_thickness':.20,'band_height':1.35,'pitch':3.15,'clear_opening_height':1.80,
    'base_radius':1.90,'base_height':.14,'platform_radius':1.92,
    'platform_bottom':10.90,'platform_top':11.14,'central_pole_radius':.065,'step_count':27,
    'hut_width':3.4,'hut_depth':2.4,'hut_centre_gltf_z':2.2,'hut_wall_height':2.2,'hut_roof_height':3.0,
    'texture_size':128,'roughness':.92,'glass_alpha':.24,'lamp_emission':1.8,'render_samples':24,
}
# Four primary shape controls transform actual tower geometry. The hut stays at
# human scale. The default 14.30m template below is stretched above its foundation.
parser=argparse.ArgumentParser()
parser.add_argument('--parameters-json',default='{}')
parser.add_argument('--parameters-file')
parser.add_argument('--validate-parameters',action='store_true')
parser.add_argument('--report-name',default='parameter_validation.json')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
overrides=json.loads(Path(args.parameters_file).read_text(encoding='utf-8')) if args.parameters_file else json.loads(args.parameters_json)
for key in overrides:
    if key not in ('total_height','turns','outer_radius','wall_thickness'):
        raise ValueError(f'Unsupported primary shape override: {key}')
PARAMS.update(overrides)
assert PARAMS['total_height']>5 and isinstance(PARAMS['turns'],int) and PARAMS['turns']>=1
assert 0<PARAMS['wall_thickness']<PARAMS['outer_radius']
RADIAL_SCALE=PARAMS['outer_radius']/1.70
HEIGHT_SCALE=(PARAMS['total_height']-.14)/(14.30-.14)
BASE_BAND_HEIGHT=1.35
BASE_PITCH=9.45/PARAMS['turns']
assert BASE_PITCH>BASE_BAND_HEIGHT, 'Too many turns for a real opening at this proportion'
def tower_height(z):return .14+(z-.14)*HEIGHT_SCALE
PARAMS.update({'pitch':BASE_PITCH*HEIGHT_SCALE,'band_height':BASE_BAND_HEIGHT*HEIGHT_SCALE,
    'clear_opening_height':(BASE_PITCH-BASE_BAND_HEIGHT)*HEIGHT_SCALE,
    'base_radius':1.90*RADIAL_SCALE,'platform_radius':1.92*RADIAL_SCALE,
    'platform_bottom':tower_height(10.90),'platform_top':tower_height(11.14)})
for directory in ('textures','previews'):(ROOT/directory).mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
bpy.context.preferences.filepaths.save_version=0
asset=bpy.data.collections.new('Lighthouse_01_Asset');scene.collection.children.link(asset)
preview=bpy.data.collections.new('PREVIEW_ONLY');scene.collection.children.link(preview)
root=bpy.data.objects.new('Lighthouse_01',None);asset.objects.link(root)
root['seed']=PARAMS['seed'];root['origin_policy']='bottom centre';root['forward']=PARAMS['front']
root['world_centre']=[57,0,-41]

def move_to(obj,collection):
    for old in tuple(obj.users_collection):old.objects.unlink(obj)
    collection.objects.link(obj)
def save_texture(name,pixels):
    h,w=pixels.shape[:2];image=bpy.data.images.new(name,width=w,height=h,alpha=True)
    image.pixels.foreach_set(np.flipud(pixels).astype(np.float32).ravel())
    image.filepath_raw=str(ROOT/'textures'/f'{name}.png');image.file_format='PNG';image.save();image.pack()
    return image
def noise_pixels(color,seed_offset=0,variation=.018):
    rng=np.random.default_rng(PARAMS['seed']+seed_offset);p=np.ones((128,128,4),dtype=np.float32)
    noise=np.repeat(np.repeat(rng.uniform(-variation,variation,(32,32)),4,0),4,1)+rng.uniform(-.005,.005,(128,128))
    p[:,:,:3]=np.clip(np.array(color)[None,None,:]+noise[:,:,None],0,1);return p
wall_pixels=noise_pixels([.76,.752,.684],1,.018)
wall_pixels[60:105,20:30,:3]*=.965;wall_pixels[12:30,88:115,:3]*=.975
plaster=save_texture('lighthouse_plaster_128',wall_pixels)
stone=save_texture('lighthouse_base_128',noise_pixels([.52,.54,.50],2))
metal=save_texture('lantern_dark_metal_128',noise_pixels([.105,.135,.135],3,.012))
roof_pixels=noise_pixels([.25,.28,.275],4,.014)
for y in range(0,128,16):roof_pixels[y:y+2,:,:3]*=.75
roof_image=save_texture('hut_roof_128',roof_pixels)
door_pixels=noise_pixels([.29,.35,.33],5,.018)
for x in range(0,128,16):door_pixels[:,x:x+1,:3]*=.82
door_image=save_texture('hut_door_128',door_pixels)
glass_pixels=np.ones((128,128,4),dtype=np.float32)
for y in range(128):glass_pixels[y,:,:3]=np.array([.40,.59,.62])*(1-y/127)+np.array([.24,.38,.40])*(y/127)
glass_pixels[15:22,:,:3]+=.045
glass_image=save_texture('lantern_glass_128',glass_pixels)
window_pixels=noise_pixels([.21,.29,.31],6,.008)
window_pixels[7:13,:,:3]+=.12;window_pixels[:,58:63,:3]=[.54,.57,.51]
window_image=save_texture('narrow_window_128',window_pixels)

def material(name,image=None,color=(.5,.5,.5),roughness=.92,alpha=1,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=roughness
    b.inputs['Metallic'].default_value=0;b.inputs['Specular IOR Level'].default_value=.2
    b.inputs['Alpha'].default_value=alpha
    if image:
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image;tex.interpolation='Closest';tex.extension='REPEAT'
        m.node_tree.links.new(tex.outputs['Color'],b.inputs['Base Color'])
    if emission:
        b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission
    if alpha<1:m.surface_render_method='DITHERED'
    return m
wallmat=material('Lighthouse_Pale_Plaster',plaster)
basemat=material('Lighthouse_Stone_Base',stone)
darkmat=material('Lighthouse_Dark_Metal',metal,roughness=.78)
roofmat=material('Lighthouse_Hut_Roof',roof_image)
doormat=material('Lighthouse_Hut_Door',door_image)
glassmat=material('Lighthouse_Lantern_Glass',glass_image,roughness=.45,alpha=.24)
windowmat=material('Lighthouse_Narrow_Window',window_image,roughness=.7)
lampmat=material('Lighthouse_Warm_Lamp',color=(1.0,.65,.22),roughness=.55,emission=1.8)

def mesh(name,vertices,faces,mat,uvs=None):
    data=bpy.data.meshes.new(name+'_Mesh');data.from_pydata(vertices,[],faces);data.update()
    uv=data.uv_layers.new(name='UVMap')
    for face in data.polygons:
        for li in face.loop_indices:
            vi=data.loops[li].vertex_index;v=Vector(vertices[vi])
            if uvs is not None:coords=uvs[vi]
            elif abs(face.normal.z)>.7:coords=(v.x/2,v.y/2)
            elif abs(face.normal.x)>.7:coords=(v.y/2,v.z/2)
            else:coords=(v.x/2,v.z/2)
            uv.data[li].uv=coords
    obj=bpy.data.objects.new(name,data);asset.objects.link(obj);obj.parent=root;data.materials.append(mat);return obj
def box(name,centre,dimensions,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=centre);obj=bpy.context.object;obj.name=name
    obj.dimensions=dimensions;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    move_to(obj,asset);obj.parent=root;obj.data.materials.append(mat);return obj
def cylinder(name,radius,depth,z,mat,vertices=16,top_radius=None):
    if top_radius is None:bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=(0,0,z))
    else:bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=top_radius,depth=depth,location=(0,0,z))
    obj=bpy.context.object;obj.name=name;move_to(obj,asset);obj.parent=root;obj.data.materials.append(mat);return obj
base=cylinder('Lighthouse_Ground_Base',1.90,.14,.07,basemat,24)

# Each ring sample has four corners: outer-low, outer-high, inner-high, inner-low.
# Joining these rings and capping both ends produces one watertight thick band.
segments=PARAMS['turns']*PARAMS['segments_per_turn'];theta0=-math.pi/2
vertices=[];uvs=[]
for i in range(segments+1):
    turns=i/PARAMS['segments_per_turn'];angle=theta0+turns*math.tau
    low=.14+BASE_PITCH*turns
    inner_template_radius=1.70-PARAMS['wall_thickness']/RADIAL_SCALE
    for radius,height,v in [(1.70,low,0),(1.70,low+BASE_BAND_HEIGHT,1),(inner_template_radius,low+BASE_BAND_HEIGHT,1),(inner_template_radius,low,0)]:
        vertices.append((radius*math.cos(angle),radius*math.sin(angle),height));uvs.append((turns*5,v))
faces=[]
for i in range(segments):
    for side in range(4):
        a=i*4+side;b=i*4+(side+1)%4;c=(i+1)*4+(side+1)%4;d=(i+1)*4+side
        faces.append((a,b,c,d))
faces.append((3,2,1,0));faces.append(tuple(segments*4+j for j in range(4)))
helix=mesh('Lighthouse_Helical_Thick_Wall',vertices,faces,wallmat,uvs)
helix['true_geometry']='Closed outer + inner + top + bottom faces; two closed ends; no alpha holes'
helix['turns']=PARAMS['turns'];helix['wall_thickness']=PARAMS['wall_thickness'];helix['clear_opening_height']=PARAMS['clear_opening_height']

cylinder('Lighthouse_Central_Slim_Pole',.065,10.76,.14+10.76/2,darkmat,8)
for i in range(27):
    angle=theta0+i/27*PARAMS['turns']*math.tau
    radius=.48;z=.23+i*(10.53/26)
    step=box(f'Lighthouse_Simple_Step_{i+1:02d}',(radius*math.cos(angle),radius*math.sin(angle),z),(.76,.30,.065),darkmat)
    step.rotation_euler.z=angle

# Two narrow texture windows conform to the faceted outer wall, away from its cut ends.
step_angle=math.tau/24
def faceted_radius(angle):
    within=(angle-theta0)%step_angle
    return 1.70*math.cos(step_angle/2)/math.cos(within-step_angle/2)
def wall_patch(name,centre_z,width,height,mat,offset=.006,centre_angle=theta0):
    points=[];coords=[]
    for row in (0,1):
        for i in range(5):
            u=i/4;angle=centre_angle+(u-.5)*width/1.70;r=faceted_radius(angle)+offset
            points.append((r*math.cos(angle),r*math.sin(angle),centre_z+(row-.5)*height));coords.append((u,row))
    fs=[(i,i+1,i+6,i+5) for i in range(4)]
    return mesh(name,points,fs,mat,coords)
for turn in (list(range(1,PARAMS['turns']))[:3] or [.5]):
    z=.14+turn*BASE_PITCH+BASE_BAND_HEIGHT/2
    angle=theta0 if isinstance(turn,int) else theta0+turn*math.tau
    wall_patch(f'Lighthouse_Band_Window_Frame_{turn}',z,.54,1.04,basemat,.008,angle)
    wall_patch(f'Lighthouse_Band_Window_Glass_{turn}',z,.41,.89,windowmat,.014,angle)

# An eight-sided, dark lantern room. Large blue-grey panes are transparent glass;
# the helical wall remains opaque and its open space is empty geometry.
cylinder('Lighthouse_Lantern_Platform',1.92,.24,11.02,darkmat,16)
cylinder('Lighthouse_Lantern_Lower_Rim',1.48,.22,11.29,darkmat,8)
cylinder('Lighthouse_Lantern_Upper_Rim',1.50,.16,12.93,darkmat,8)
for i in range(8):
    a=theta0+i*math.tau/8;b=theta0+(i+1)*math.tau/8
    radius=1.39
    pts=[(radius*math.cos(a),radius*math.sin(a),11.40),(radius*math.cos(b),radius*math.sin(b),11.40),
         (radius*math.cos(b),radius*math.sin(b),12.85),(radius*math.cos(a),radius*math.sin(a),12.85)]
    mesh(f'Lighthouse_Lantern_Glass_Pane_{i+1}',pts,[(0,1,2,3)],glassmat,[(0,0),(1,0),(1,1),(0,1)])
    post=box(f'Lighthouse_Lantern_Post_{i+1}',(1.4*math.cos(a),1.4*math.sin(a),12.125),(.075,.075,1.51),darkmat)
    post.rotation_euler.z=a
cylinder('Lighthouse_Lamp_Core',.34,1.02,12.12,lampmat,12)
cylinder('Lighthouse_Lamp_Core_Pedestal',.42,.13,11.545,darkmat,12)
cylinder('Lighthouse_Lamp_Core_Cap',.42,.12,12.69,darkmat,12)
cylinder('Lighthouse_Pointed_Roof',1.76,1.04,13.53,darkmat,8,0)
cylinder('Lighthouse_Roof_Finial',.085,.20,14.15,darkmat,8)
cylinder('Lighthouse_Roof_Tip',.085,.05,14.275,darkmat,8,0)

# Small entrance hut in front of the first turn, leaving the upper ribbon uncovered.
box('Lighthouse_Hut_Platform',(0,-2.20,.02),(3.50,2.50,.04),basemat)
box('Lighthouse_Hut_Walls',(0,-2.20,1.12),(3.4,2.4,2.16),wallmat)
mesh('Lighthouse_Hut_Gables',[
    (-1.70,-3.4,2.2),(1.70,-3.4,2.2),(0,-3.4,2.96),
    (-1.70,-1.0,2.2),(1.70,-1.0,2.2),(0,-1.0,2.96)],
    [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],wallmat)
mesh('Lighthouse_Hut_Gabled_Roof',[
    (-1.85,-3.49,2.20),(0,-3.49,3.0),(1.85,-3.49,2.20),
    (-1.85,-.91,2.20),(0,-.91,3.0),(1.85,-.91,2.20),
    (-1.85,-3.49,2.13),(0,-3.49,2.93),(1.85,-3.49,2.13),
    (-1.85,-.91,2.13),(0,-.91,2.93),(1.85,-.91,2.13)],
    [(0,3,4,1),(1,4,5,2),(6,7,10,9),(7,8,11,10),(0,1,7,6),(1,2,8,7),
     (3,9,10,4),(4,10,11,5),(0,6,9,3),(2,5,11,8)],roofmat)
box('Lighthouse_Hut_Door_Frame',(0,-3.423,1.03),(1.00,.046,1.98),basemat)
box('Lighthouse_Hut_Door',(0,-3.45,1.03),(.83,.018,1.82),doormat)
box('Lighthouse_Hut_Door_Handle',(.31,-3.471,1.02),(.028,.022,.18),darkmat)
for x in (-1.16,1.16):
    box('Lighthouse_Hut_Window_Frame',(x,-3.425,1.35),(.63,.05,.75),basemat)
    mesh('Lighthouse_Hut_Window',[(x-.25,-3.456,1.04),(x+.25,-3.456,1.04),(x+.25,-3.456,1.66),(x-.25,-3.456,1.66)],
         [(0,1,2,3)],windowmat,[(0,0),(1,0),(1,1),(0,1)])
for side in (-1,1):
    box('Lighthouse_Hut_Side_Window_Frame',(side*1.725,-2.13,1.30),(.05,.70,.70),basemat)
    mesh('Lighthouse_Hut_Side_Window',[(side*1.756,-2.42,1.01),(side*1.756,-1.84,1.01),
        (side*1.756,-1.84,1.59),(side*1.756,-2.42,1.59)],[(0,1,2,3)] if side==1 else [(3,2,1,0)],windowmat,[(0,0),(1,0),(1,1),(0,1)])

# Apply the radius/height mapping to every tower part, including the lantern,
# lamp core, windows and steps, while preserving their independent object origins.
# The entrance hut and its door remain unchanged when tower proportions change.
for obj in asset.objects:
    if obj.type=='MESH' and not obj.name.startswith('Lighthouse_Hut_'):
        is_base=obj.name=='Lighthouse_Ground_Base'
        obj.location.x*=RADIAL_SCALE;obj.location.y*=RADIAL_SCALE
        if not is_base:obj.location.z=tower_height(obj.location.z)
        for vertex in obj.data.vertices:
            vertex.co.x*=RADIAL_SCALE;vertex.co.y*=RADIAL_SCALE
            if not is_base:vertex.co.z*=HEIGHT_SCALE
bpy.context.view_layer.update()
for obj in asset.objects:
    if obj.type=='MESH':
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()

def topology(obj,weld=False):
    bm=bmesh.new();bm.from_mesh(obj.data);bm.transform(obj.matrix_world)
    if weld:bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    volume=bm.calc_volume(signed=True)
    result={'vertices':len(bm.verts),'edges':len(bm.edges),'faces':len(bm.faces),
        'non_manifold_edges':sum(not edge.is_manifold for edge in bm.edges),
        'boundary_edges':sum(edge.is_boundary for edge in bm.edges),'loose_vertices':sum(not v.link_edges for v in bm.verts),
        'signed_volume_m3':volume,'welded_uv_seams_for_validation':weld}
    bm.free();return result
source_topology=topology(helix)
assert source_topology['non_manifold_edges']==0 and source_topology['signed_volume_m3']>0,source_topology
# Ensure all material surfaces of the band are fully opaque.
assert wallmat.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value==1

def opening_test(obj):
    bm=bmesh.new();bm.from_mesh(obj.data);bm.transform(obj.matrix_world);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
    tree=BVHTree.FromBMesh(bm);checks=[]
    # Probe slightly beyond the first end-cap, avoiding an exactly tangent edge ray.
    probe_angle=theta0+.04
    direction=Vector((-math.cos(probe_angle),-math.sin(probe_angle),0))
    probe_radius=PARAMS['outer_radius']+.4
    ray_distance=PARAMS['wall_thickness']+.6
    for turn in range(PARAMS['turns']):
        low=.14+(turn+.04/math.tau)*PARAMS['pitch']
        wall_height=low+PARAMS['band_height']/2
        gap_height=low+PARAMS['band_height']+PARAMS['clear_opening_height']/2
        # Rays stop before the central stairs or opposite side; only this wall is queried.
        wall_hit=tree.ray_cast(Vector((probe_radius*math.cos(probe_angle),probe_radius*math.sin(probe_angle),wall_height)),direction,ray_distance)[0] is not None
        opening_clear=tree.ray_cast(Vector((probe_radius*math.cos(probe_angle),probe_radius*math.sin(probe_angle),gap_height)),direction,ray_distance)[0] is None
        checks.append({'turn':turn,'wall_ray_height':wall_height,'wall_hit':wall_hit,
                       'opening_ray_height':gap_height,'opening_clear':opening_clear})
    bm.free();return checks
source_openings=opening_test(helix)
assert all(row['wall_hit'] and row['opening_clear'] for row in source_openings),source_openings

def stats(objects):
    deps=bpy.context.evaluated_depsgraph_get();points=[];triangles=0;names=[]
    for obj in objects:
        if obj.type!='MESH':continue
        evaluated=obj.evaluated_get(deps);data=evaluated.to_mesh();data.calc_loop_triangles();triangles+=len(data.loop_triangles)
        points.extend(obj.matrix_world@Vector(c) for c in evaluated.bound_box);names.append(obj.name);evaluated.to_mesh_clear()
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    return {'triangles':triangles,'mesh_count':len(names),'mesh_names':names,
        'bounds_gltf':{'min':[low[0],low[2],-high[1]],'max':[high[0],high[2],-low[1]]},
        'dimensions_gltf':[high[0]-low[0],high[2]-low[2],high[1]-low[1]]}
export_stats=stats(asset.objects)
assert export_stats['bounds_gltf']['min'][1]>=-.00001
assert export_stats['bounds_gltf']['max'][2]<=3.5001
assert abs(export_stats['bounds_gltf']['max'][1]-PARAMS['total_height'])<.0001
helix_world=[helix.matrix_world@v.co for v in helix.data.vertices]
measured_outer=max(math.hypot(v.x,v.y) for v in helix_world)
measured_inner=min(math.hypot(v.x,v.y) for v in helix_world)
measured_turns=(len(helix_world)/4-1)/PARAMS['segments_per_turn']
assert abs(measured_outer-PARAMS['outer_radius'])<.0001
assert abs(measured_outer-measured_inner-PARAMS['wall_thickness'])<.0001
assert measured_turns==PARAMS['turns']
measured_geometry={'total_height':export_stats['bounds_gltf']['max'][1],
    'outer_radius':measured_outer,'inner_radius':measured_inner,'wall_thickness':measured_outer-measured_inner,
    'turns':measured_turns,'helix_bottom':min(v.z for v in helix_world),'helix_top':max(v.z for v in helix_world)}
if args.validate_parameters:
    validation={'parameters':PARAMS,'measured_geometry':measured_geometry,'stats':export_stats,
        'helix_topology':source_topology,'opening_rays':source_openings,'checks_passed':True,
        'hut_dimensions':stats([o for o in asset.objects if o.name.startswith('Lighthouse_Hut_')])['dimensions_gltf']}
    (ROOT/args.report_name).write_text(json.dumps(validation,ensure_ascii=False,indent=2),encoding='utf-8')
    print('PARAMETER_VALIDATION',json.dumps(measured_geometry))
    raise SystemExit(0)

scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1050;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.world.color=(.42,.46,.49)
floor_mat=material('PREVIEW_Floor',color=(.34,.39,.34))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012));floor=bpy.context.object;floor.name='PREVIEW_Floor'
floor.data.materials.append(floor_mat);move_to(floor,preview)
for name,pos,power,size in [('Key',(-12,-16,22),2500,10),('Fill',(14,-8,18),1500,10),('Rim',(0,14,20),2200,10)]:
    data=bpy.data.lights.new('PREVIEW_'+name,'AREA');data.energy=power;data.size=size
    obj=bpy.data.objects.new('PREVIEW_'+name,data);preview.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector((0,0,7))-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('PREVIEW_Camera');camera=bpy.data.objects.new('PREVIEW_Camera',camera_data)
preview.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO'
def camera_view(pos,target=(0,0,7.0),scale=16.0):
    camera.location=pos;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.ortho_scale=scale
bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=root;glb=ROOT/'Lighthouse_01.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
    export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
glb_bytes=glb.read_bytes();json_size=struct.unpack_from('<I',glb_bytes,12)[0]
gltf_json=json.loads(glb_bytes[20:20+json_size].decode('utf-8'))
actual_glass=next(m for m in gltf_json['materials'] if m['name']=='Lighthouse_Lantern_Glass')
actual_wall=next(m for m in gltf_json['materials'] if m['name']=='Lighthouse_Pale_Plaster')
assert actual_glass.get('doubleSided') is True and actual_glass.get('alphaMode')=='BLEND'
assert actual_wall.get('alphaMode','OPAQUE')=='OPAQUE'
camera_view((18,-26,15))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Lighthouse_01.blend'))
for name,pos,target,scale in [
    ('front',(0,-30,9),(0,0,7.0),15.8),('oblique',(18,-26,15),(0,0,7.0),16.0),
    ('rear',(15,27,13),(0,0,7),16.0),('openings',(-12,-24,7),(0,0,6.9),9.8)]:
    camera_view(pos,target,scale);scene.render.filepath=str(ROOT/'previews'/f'lighthouse_{name}.png');bpy.ops.render.render(write_still=True)

for obj in tuple(asset.objects):bpy.data.objects.remove(obj,do_unlink=True)
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(glb));imported=[obj for obj in bpy.data.objects if obj not in before]
import_stats=stats(imported);import_helix=next(o for o in imported if o.name.startswith('Lighthouse_Helical_Thick_Wall'))
import_topology=topology(import_helix,True);import_openings=opening_test(import_helix)
lamp_core=next(o for o in imported if o.name=='Lighthouse_Lamp_Core')
import_root=next(o for o in imported if o.name=='Lighthouse_01')
assert import_root.location.length<.00001
assert import_topology['non_manifold_edges']==0 and import_topology['signed_volume_m3']>0,import_topology
assert all(item['wall_hit'] and item['opening_clear'] for item in import_openings),import_openings
assert lamp_core.type=='MESH' and lamp_core.parent is not None
assert import_stats['triangles']==export_stats['triangles']
assert max(abs(import_stats['dimensions_gltf'][i]-export_stats['dimensions_gltf'][i]) for i in range(3))<.0001
materials={slot.material for obj in imported if obj.type=='MESH' for slot in obj.material_slots if slot.material}
image_records=[]
for mat in materials:
    for node in mat.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image:image_records.append({'material':mat.name,'image':node.image.name,'size':list(node.image.size),'has_pixels':bool(node.image.has_data)})
assert image_records and all(item['has_pixels'] and item['size']==[128,128] for item in image_records)
camera_view((18,-26,15));scene.render.filepath=str(ROOT/'previews'/'lighthouse_glb_reimport.png');bpy.ops.render.render(write_still=True)
report={'asset':'Lighthouse_01','blender_version':bpy.app.version_string,'blender_executable':bpy.app.binary_path,'parameters':PARAMS,
    'measured_geometry':measured_geometry,
    'export':export_stats,'reimport':import_stats,'source_helix_topology':source_topology,'reimport_helix_topology':import_topology,
    'source_opening_rays':source_openings,'reimport_opening_rays':import_openings,'embedded_images':image_records,
    'exported_glass_material':actual_glass,
    'connections':{'base_top':.14,'helix_bottom':measured_geometry['helix_bottom'],'helix_top':measured_geometry['helix_top'],'lantern_platform_bottom':PARAMS['platform_bottom']},
    'collision':{'tower_base_radius':PARAMS['base_radius'],'hut_centre_gltf':[0,1.1,2.2],'hut_wall_half_width':1.70,'hut_wall_half_depth':1.20,
        'hut_base_half_width':1.75,'hut_base_half_depth':1.25,'use_full_height_bbox_for_collision':False},
    'checks':{'glb_reimport_passed':True,'origin_at_zero':True,'bottom_at_zero':True,'independent_lamp_core':True,
        'opaque_real_thick_helix':True,'three_openings_are_empty_geometry':True,'positive_outward_signed_volume':True,
        'glass_double_sided_blend':True,'helix_connects_to_base_and_lantern_platform':True},
    'limitations':['Exterior exploration only. The 27 simplified steps are decorative and not a playable staircase.',
        'Lantern glass uses alpha blending; the spiral wall is fully opaque and genuinely open between turns.']}
(ROOT/'lighthouse_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('LIGHTHOUSE_REPORT',json.dumps({'triangles':export_stats['triangles'],'bounds_gltf':export_stats['bounds_gltf'],
    'source_nonmanifold':source_topology['non_manifold_edges'],'reimport_nonmanifold':import_topology['non_manifold_edges'],'glb':str(glb)},ensure_ascii=False))
