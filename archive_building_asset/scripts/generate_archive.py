"""Build Archive_01: a deliberately simple Y2K two-storey archive shop-house.
Blender -Y faces the road; GLB +Z faces the road. Units are metres.
The two supplied lettering textures are loaded without modification.
Run with E:/BLEND/blender.exe --background --factory-startup --python this_file.
"""
import bpy, bmesh, math, json
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
PARAMS={
    'seed':63112029,'units':'metres','origin':'bottom centre','front':'Blender -Y / glTF +Z',
    'world_centre':[20,0,-40],'body_width':5.0,'body_depth':6.0,
    'front_body_height':6.3,'rear_body_height':5.94,'parapet_height':7.22,
    'base_width':5.16,'base_depth':6.16,'base_height':.04,
    'awning_width':4.88,'awning_back_gltf_z':3.025,'awning_front_gltf_z':4.0,
    'awning_top':3.40,'awning_bottom':2.68,'awning_thickness':.06,'awning_segments':8,
    'door_centre_x':.55,'door_width':1.1,'door_height':2.45,
    'upper_window':[2.4,1.6],'upper_window_centre_height':4.8,
    'sign_centre':[-2.78,4.65,3.10],'sign_image_size':[128,256],
    'texture_size':128,'roughness':.92,'render_samples':24,
}
for name in ('textures','previews'):(ROOT/name).mkdir(parents=True,exist_ok=True)
for name in ('vertical_sign_128x256.png','awning_archive_256.png'):
    if not (ROOT/'textures'/name).is_file():raise FileNotFoundError(f'Lettering texture not ready: {name}')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
bpy.context.preferences.filepaths.save_version=0
asset=bpy.data.collections.new('Archive_01_Asset');scene.collection.children.link(asset)
preview=bpy.data.collections.new('PREVIEW_ONLY');scene.collection.children.link(preview)
root=bpy.data.objects.new('Archive_01',None);asset.objects.link(root)
root['seed']=PARAMS['seed'];root['front']=PARAMS['front'];root['origin_policy']='bottom centre'
root['web_world_centre']=[20,0,-40]

def move_to(obj,col):
    for old in tuple(obj.users_collection):old.objects.unlink(obj)
    col.objects.link(obj)
def image_from_pixels(name,pixels):
    h,w=pixels.shape[:2];image=bpy.data.images.new(name,width=w,height=h,alpha=True)
    image.pixels.foreach_set(np.flipud(pixels).astype(np.float32).ravel())
    image.filepath_raw=str(ROOT/'textures'/f'{name}.png');image.file_format='PNG';image.save();image.pack()
    return image
def noise_image(name,color,variation=.022,offset=0):
    rng=np.random.default_rng(PARAMS['seed']+offset)
    p=np.ones((128,128,4),dtype=np.float32)
    broad=np.repeat(np.repeat(rng.uniform(-variation,variation,(16,16)),8,0),8,1)
    fine=rng.uniform(-.006,.006,(128,128))
    p[:,:,:3]=np.clip(np.array(color)[None,None,:]+(broad+fine)[:,:,None],0,1)
    return p

plaster_pixels=noise_image('plaster',[.72,.718,.662],.022,1)
# A few low-contrast faded patches; no photographic grime or fine sculpting.
plaster_pixels[73:115,17:27,:3]*=.96
plaster_pixels[21:52,92:110,:3]*=.965
plaster_img=image_from_pixels('faded_plaster_128',plaster_pixels)
brick_pixels=noise_image('brick',[.39,.235,.202],.025,2)
rng=np.random.default_rng(PARAMS['seed']+3)
for row in range(8):
    y=row*16
    brick_pixels[y:y+2,:,:3]=[.63,.60,.52]
    offset=(row%2)*16
    for col in range(-1,5):
        x=col*32+offset
        left,right=max(0,x+2),min(128,x+32)
        if left<right:brick_pixels[y+2:y+16,left:right,:3]+=rng.uniform(-.035,.035)
        if 0<=x<128:brick_pixels[y:y+16,x:x+2,:3]=[.63,.60,.52]
brick_img=image_from_pixels('dark_red_brick_128',np.clip(brick_pixels,0,1))
roof_pixels=noise_image('roof',[.32,.335,.305],.018,4)
for y in range(0,128,16):roof_pixels[y:y+2,:,:3]*=.74
roof_img=image_from_pixels('rear_roof_128',roof_pixels)
stone_img=image_from_pixels('base_stone_128',noise_image('base',[.53,.55,.51],.018,5))
awning_img=bpy.data.images.load(str(ROOT/'textures'/'awning_archive_256.png'));awning_img.pack()
sign_img=bpy.data.images.load(str(ROOT/'textures'/'vertical_sign_128x256.png'));sign_img.pack()
rose_img=image_from_pixels('awning_side_128',noise_image('fabric',[.57,.32,.36],.012,6))

glass_pixels=np.ones((128,128,4),dtype=np.float32)
for y in range(128):
    t=y/127
    glass_pixels[y,:,:3]=np.array([.30,.365,.37])*(1-t)+np.array([.20,.255,.25])*t
# Two broad, restrained reflected bands remain intentionally low-resolution.
glass_pixels[9:16,:,:3]+=.055;glass_pixels[34:38,:,:3]+=.025
glass_img=image_from_pixels('blue_grey_glass_128',glass_pixels)
blind_pixels=glass_pixels.copy()
blind_pixels[:,69:124,:3]=[.47,.44,.34]
for y in range(0,128,5):
    blind_pixels[y:y+1,69:124,:3]=[.27,.285,.24]
    blind_pixels[y+1:y+2,69:124,:3]=[.60,.565,.45]
blind_img=image_from_pixels('upper_window_blind_128',blind_pixels)

def mat(name,image=None,color=(.5,.5,.5),roughness=.92):
    material=bpy.data.materials.new(name);material.use_nodes=True
    bsdf=material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=roughness;bsdf.inputs['Metallic'].default_value=0
    bsdf.inputs['Specular IOR Level'].default_value=.18
    if image:
        node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;node.interpolation='Closest'
        node.extension='REPEAT';material.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    return material
wall=mat('Archive_Faded_Plaster',plaster_img);brick=mat('Archive_Red_Brick',brick_img)
roofmat=mat('Archive_Low_Rear_Roof',roof_img);stone=mat('Archive_Base',stone_img)
glass=mat('Archive_BlueGrey_Glass',glass_img,roughness=.55)
blind=mat('Archive_Upper_Glass_And_Blind',blind_img,roughness=.75)
frame=mat('Archive_Deep_Window_Frame',color=(.24,.26,.235))
lightframe=mat('Archive_Door_Frame',color=(.62,.63,.565))
awning=mat('Archive_DustyRose_Awning',awning_img)
rose=mat('Archive_Awning_Sides',rose_img)
signmat=mat('Archive_Vertical_Sign',sign_img)

def mesh(name,vertices,faces,material,uvs=None):
    data=bpy.data.meshes.new(name+'_Mesh');data.from_pydata(vertices,[],faces);data.update()
    layer=data.uv_layers.new(name='UVMap')
    for p in data.polygons:
        for li in p.loop_indices:
            vi=data.loops[li].vertex_index;v=Vector(vertices[vi])
            if uvs is not None:uv=uvs[vi]
            elif abs(p.normal.z)>.6:uv=(v.x/2,v.y/2)
            elif abs(p.normal.x)>.6:uv=(v.y/3,v.z/3)
            else:uv=(v.x/3,v.z/3)
            layer.data[li].uv=uv
    obj=bpy.data.objects.new(name,data);asset.objects.link(obj);obj.parent=root;data.materials.append(material)
    return obj
def box(name,centre,dimensions,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=centre);obj=bpy.context.object;obj.name=name
    obj.dimensions=dimensions;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    move_to(obj,asset);obj.parent=root;obj.data.materials.append(material)
    if bevel:
        modifier=obj.modifiers.new('Simple_edge_bevel','BEVEL');modifier.width=bevel;modifier.segments=1
    return obj
def plane_front(name,cx,z,w,h,y,material):
    return mesh(name,[(cx-w/2,y,z-h/2),(cx+w/2,y,z-h/2),(cx+w/2,y,z+h/2),(cx-w/2,y,z+h/2)],
                [(0,1,2,3)],material,[(0,0),(1,0),(1,1),(0,1)])

base=box('Archive_Base_Platform',(0,0,.02),(5.16,6.16,.04),stone)
body=mesh('Archive_Main_Body',[
    (-2.5,-3,.04),(2.5,-3,.04),(2.5,3,.04),(-2.5,3,.04),
    (-2.5,-3,6.30),(2.5,-3,6.30),(2.5,3,5.94),(-2.5,3,5.94)],
    [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],wall)
box('Archive_High_Front_Parapet',(0,-2.91,6.72),(5,.18,1.0),wall)
box('Archive_Parapet_Coping',(0,-2.92,7.25),(5.10,.29,.06),stone)
for x in (-2.455,2.455):
    box('Archive_Facade_Edge', (x,-3.005,3.64),(.15,.10,7.20),wall)
    box('Archive_Short_Parapet_Return',(x,-2.63,6.75),(.15,.60,.94),wall)
box('Archive_Front_Parapet_Band',(0,-3.014,6.30),(4.82,.025,.045),frame)
# Low roof slopes away behind the tall street facade.
mesh('Archive_Rear_Low_Slope_Roof',[
    (-2.58,-2.72,6.32),(2.58,-2.72,6.32),(2.58,3.10,5.96),(-2.58,3.10,5.96),
    (-2.58,-2.72,6.43),(2.58,-2.72,6.43),(2.58,3.10,6.07),(-2.58,3.10,6.07)],
    [(0,3,2,1),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],roofmat)

# Brick plinths are textures; the front door retains a clear floor-level opening.
for name,x,width in [('Left',-1.25,2.5),('Right',1.80,1.4)]:
    mesh('Archive_Front_Brick_'+name,
         [(x-width/2,-3.018,.04),(x+width/2,-3.018,.04),(x+width/2,-3.018,.78),(x-width/2,-3.018,.78)],
         [(0,1,2,3)],brick,[(0,0),(width,0),(width,1),(0,1)])
mesh('Archive_Left_Brick', [(-2.501,-3,.04),(-2.501,3,.04),(-2.501,3,.77),(-2.501,-3,.77)],
    [(3,2,1,0)],brick,[(0,0),(6,0),(6,1),(0,1)])
mesh('Archive_Right_Brick', [(2.501,-3,.04),(2.501,3,.04),(2.501,3,.77),(2.501,-3,.77)],
    [(0,1,2,3)],brick,[(0,0),(6,0),(6,1),(0,1)])
mesh('Archive_Rear_Brick',[(-2.5,3.001,.04),(2.5,3.001,.04),(2.5,3.001,.77),(-2.5,3.001,.77)],
    [(3,2,1,0)],brick,[(0,0),(5,0),(5,1),(0,1)])

def front_window(name,cx,z,w,h,glassmat=glass,framemat=frame,depth=.10,mullion=False):
    objects=[]
    objects.append(plane_front(name+'_Glass',cx,z,w-.16,h-.16,-3.042,glassmat))
    for x in (cx-w/2+.045,cx+w/2-.045):
        objects.append(box(name+'_Vertical_Frame',(x,-3.025,z),(.09,depth,h),framemat))
    for height in (z-h/2+.045,z+h/2-.045):
        objects.append(box(name+'_Horizontal_Frame',(cx,-3.025,height),(w-.18,depth,.09),framemat))
    if mullion:objects.append(box(name+'_Centre_Divider',(cx,-3.035,z),(.045,depth,h-.18),framemat))
    return objects
front_window('Archive_Shop_Left_Window',-1.20,1.63,2.1,1.70,framemat=lightframe)
front_window('Archive_Shop_Right_Window',1.80,1.63,1.05,1.70,framemat=lightframe)
front_window('Archive_Offset_Glass_Door',.55,1.265,1.1,2.45,framemat=lightframe)
box('Archive_Door_Handle',(.90,-3.10,1.16),(.035,.06,.27),frame)
front_window('Archive_Upper_Main_Window',0,4.80,2.4,1.6,glassmat=blind,depth=.16,mullion=True)
box('Archive_Upper_Window_Sill',(0,-3.13,3.99),(2.58,.30,.10),stone)
box('Archive_Upper_Small_Rain_Ledge',(0,-3.14,5.72),(2.72,.43,.15),wall)

# Curved awning: 8 visible geometric facets and a real 6cm shell thickness.
segments=PARAMS['awning_segments'];w=PARAMS['awning_width'];verts=[];uvs=[]
for layer in (0,1):
    for i in range(segments+1):
        t=i/segments;a=t*math.pi/2
        y=-3.025-.975*math.sin(a)
        z=3.40-.66*(1-math.cos(a))-.06*layer
        for x,u in [(-w/2,0),(w/2,1)]:verts.append((x,y,z));uvs.append((u,1-t))
faces=[];materials=[];rowlen=(segments+1)*2
for i in range(segments):
    j=i*2
    faces.append((j,j+1,j+3,j+2));materials.append(0)
    faces.append((rowlen+j+2,rowlen+j+3,rowlen+j+1,rowlen+j));materials.append(1)
    faces.append((j,j+2,rowlen+j+2,rowlen+j));materials.append(1)
    faces.append((j+3,j+1,rowlen+j+1,rowlen+j+3));materials.append(1)
faces += [(0,rowlen,rowlen+1,1),(segments*2,segments*2+1,rowlen+segments*2+1,rowlen+segments*2)]
materials += [1,1]
canopy=mesh('Archive_Curved_Rose_Awning',verts,faces,awning,uvs);canopy.data.materials.append(rose)
for polygon,index in zip(canopy.data.polygons,materials):polygon.material_index=index
# Simple closed end cheeks, well above head height.
for side in (-1,1):
    cheek_x=side*(w/2+.002)
    profile=[(cheek_x,-3.025,2.68)]
    for i in range(segments+1):
        a=i/segments*math.pi/2;profile.append((cheek_x,-3.025-.975*math.sin(a),3.40-.66*(1-math.cos(a))))
    mesh('Archive_Awning_End_Cheek',profile,[tuple(range(len(profile)))],rose)

box('Archive_Vertical_Sign_Frame',(-2.78,-3.10,4.65),(.58,.16,2.76),lightframe,.025)
plane_front('Archive_Vertical_Sign_Lettering',-2.78,4.65,.50,2.64,-3.184,signmat)
for z in (3.65,5.65):box('Archive_Sign_Bracket',(-2.59,-3.025,z),(.31,.18,.07),frame)

# Whole-building coverage: two plain windows per side, rear upper windows and rear door.
def side_window(name,side,y,z,w,h):
    x=side*2.532
    box(name+'_Backing',(x,y,z),(.07,w,h),frame)
    vertices=[(side*2.571,y-w/2+.08,z-h/2+.08),(side*2.571,y+w/2-.08,z-h/2+.08),
              (side*2.571,y+w/2-.08,z+h/2-.08),(side*2.571,y-w/2+.08,z+h/2-.08)]
    mesh(name+'_Glass',vertices,[(0,1,2,3)] if side==1 else [(3,2,1,0)],glass,[(0,0),(1,0),(1,1),(0,1)])
    box(name+'_Divider',(side*2.58,y,z),(.025,.045,h-.16),frame)
for side in (-1,1):
    side_window(f'Archive_Side_{side}_Upper',side,.55,4.65,1.5,1.35)
    side_window(f'Archive_Side_{side}_Lower',side,1.00,1.85,1.35,1.20)
for x in (-1.38,1.38):
    box('Archive_Rear_Window_Frame',(x,3.035,4.55),(1.12,.07,1.20),frame)
    mesh('Archive_Rear_Window_Glass',[(x-.48,3.074,4.03),(x+.48,3.074,4.03),(x+.48,3.074,5.07),(x-.48,3.074,5.07)],
         [(3,2,1,0)],glass,[(1,0),(0,0),(0,1),(1,1)])
box('Archive_Rear_Door_Frame',(.50,3.035,1.20),(1.12,.07,2.32),lightframe)
box('Archive_Rear_Door',(.50,3.078,1.20),(.96,.02,2.16),frame)
box('Archive_Rear_Door_Handle',(.82,3.108,1.15),(.035,.04,.22),lightframe)

for obj in asset.objects:
    if obj.type=='MESH':
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(obj.data);bm.free()

def stats(objects):
    deps=bpy.context.evaluated_depsgraph_get();points=[];triangles=0;names=[]
    for obj in objects:
        if obj.type!='MESH':continue
        evaluated=obj.evaluated_get(deps);data=evaluated.to_mesh();data.calc_loop_triangles()
        triangles+=len(data.loop_triangles);names.append(obj.name)
        points.extend(obj.matrix_world@Vector(v) for v in evaluated.bound_box);evaluated.to_mesh_clear()
    low=[min(p[i] for p in points) for i in range(3)];high=[max(p[i] for p in points) for i in range(3)]
    return {'triangles':triangles,'mesh_count':len(names),'mesh_names':names,
            'bounds_blender':{'min':low,'max':high},
            'bounds_gltf':{'min':[low[0],low[2],-high[1]],'max':[high[0],high[2],-low[1]]},
            'dimensions_gltf':[high[0]-low[0],high[2]-low[2],high[1]-low[1]]}
export_stats=stats(asset.objects)
canopy_min=min(v.co.z for v in canopy.data.vertices)
assert canopy_min>=2.6799
assert export_stats['triangles']<=2000
assert export_stats['bounds_gltf']['min'][1]>=-.00001

# Clean preview setup, excluded from the game export.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1100;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
scene.world.color=(.45,.46,.46)
floor_mat=mat('PREVIEW_Floor',color=(.36,.39,.35))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));floor=bpy.context.object;floor.name='PREVIEW_Floor'
floor.data.materials.append(floor_mat);move_to(floor,preview)
for name,position,power,size in [('Key',(-10,-12,16),2100,9),('Fill',(10,-7,11),1000,9),('Rim',(0,10,14),1300,8)]:
    data=bpy.data.lights.new('PREVIEW_'+name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new('PREVIEW_'+name,data);preview.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector((0,0,3.5))-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('PREVIEW_Camera');camera=bpy.data.objects.new('PREVIEW_Camera',camera_data)
preview.objects.link(camera);scene.camera=camera;camera_data.type='ORTHO'
def camera_view(position,target=(0,0,3.55),scale=9.4):
    camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.ortho_scale=scale
bpy.ops.object.select_all(action='DESELECT')
for obj in asset.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=root
glb=ROOT/'Archive_01.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,
    export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
camera_view((12,-18,10.5),scale=10.6)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Archive_01.blend'))
for name,pos,scale in [('front',(0,-23,6.9),8.7),('oblique',(12,-18,10.5),10.6),('rear',(12,17,10),10.8)]:
    camera_view(pos,scale=scale);scene.render.filepath=str(ROOT/'previews'/f'archive_{name}.png');bpy.ops.render.render(write_still=True)

for obj in tuple(asset.objects):bpy.data.objects.remove(obj,do_unlink=True)
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(glb));imported=[o for o in bpy.data.objects if o not in before]
import_stats=stats(imported)
materials={slot.material for obj in imported if obj.type=='MESH' for slot in obj.material_slots if slot.material}
images=[]
for material in materials:
    for node in material.node_tree.nodes:
        if node.type=='TEX_IMAGE' and node.image:
            images.append({'material':material.name,'image':node.image.name,'size':list(node.image.size),'has_pixels':bool(node.image.has_data)})
assert images and all(item['has_pixels'] for item in images)
assert any(item['size']==[128,256] and 'Vertical_Sign' in item['material'] for item in images)
assert any(item['size']==[256,128] and 'DustyRose_Awning' in item['material'] for item in images)
assert import_stats['triangles']==export_stats['triangles']
assert max(abs(import_stats['dimensions_gltf'][i]-export_stats['dimensions_gltf'][i]) for i in range(3))<.0001
import_root=next(o for o in imported if o.name.startswith('Archive_01') and o.type=='EMPTY')
assert import_root.location.length<.00001
camera_view((12,-18,10.5),scale=10.6);scene.render.filepath=str(ROOT/'previews'/'archive_glb_reimport.png');bpy.ops.render.render(write_still=True)
report={'asset':'Archive_01','blender_version':bpy.app.version_string,'blender_executable':bpy.app.binary_path,
    'parameters':PARAMS,'export':export_stats,'reimport':import_stats,'embedded_images':images,
    'awning_min_height':canopy_min,'collision':{'body_half_width':2.5,'body_half_depth':3.0,
        'base_half_width':2.58,'base_half_depth':3.08,'recommended_half_width':2.60,'recommended_half_depth':3.13,
        'ignore_overhead_canopy_and_sign':True,'ground_nodes':['Archive_Main_Body','Archive_Base_Platform']},
    'checks':{'reimport_passed':True,'images_loaded':True,'asset_root_at_origin':True,'bottom_at_zero':True,
        'awning_clears_2_045m_signs_by_m':canopy_min-2.045},
    'limitations':['Opaque simplified glass; building is an exterior shell with no playable interior.',
        'Side and back windows are intentionally reduced to plain frames and low-resolution glass textures.']}
(ROOT/'archive_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('ARCHIVE_REPORT',json.dumps({'triangles':export_stats['triangles'],'bounds_gltf':export_stats['bounds_gltf'],'awning_min':canopy_min,'glb':str(glb)},ensure_ascii=False))
