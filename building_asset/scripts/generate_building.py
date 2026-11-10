"""Run with Blender --background --factory-startup --python this_file.
Front is Blender -Y -> glTF +Z. Metres, bottom-centre origin.
Reference: compact pale box, three rows of windows, segmented blue cornice.
The Chinese name stays a runtime canvas sign; preview lettering is not exported.
"""
import bpy, math, random, json, shutil
from pathlib import Path
from mathutils import Vector
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
PARAMS = {
 'seed':63112026, 'units':'metres', 'body':[5.6,5.0,4.3],
 'roof':[5.96,5.36,.14], 'cornice':{'length':6.06,'segments':10,'radius_depth':.23,'radius_height':.18,'height':4.31},
 'window_size':.49, 'front_columns':7, 'window_rows':[2.23,3.02,3.80],
 'texture_size':128, 'roughness':.94, 'metallic':0, 'filter':'NEAREST',
 'world_position':[0,0,-7.5], 'front':'Blender -Y / glTF +Z',
 'root_origin':'bottom centre', 'render_samples':24,
}
for folder in ['textures','previews']: (ROOT/folder).mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
bpy.context.preferences.filepaths.save_version=0
collection=bpy.data.collections.new('Outpost_01');scene.collection.children.link(collection)
root=bpy.data.objects.new('Outpost_01',None);collection.objects.link(root)
root['dimensions_policy']='body 5.6 x 5.0 x 4.3 m; bottom centre; front -Y'
root['seed']=PARAMS['seed']

def save_pixels(name,pixels):
 h,w=pixels.shape[:2];img=bpy.data.images.new(name,width=w,height=h,alpha=True)
 img.pixels.foreach_set(np.flipud(pixels).astype(np.float32).ravel())
 texture_path=ROOT/'textures'/f'{name}.png'
 img.filepath_raw=str(texture_path);img.file_format='PNG';img.save()
 bpy.data.images.remove(img)
 return bpy.data.images.load(str(texture_path),check_existing=True)

def noise_texture(name,color,variation=.04,seed=0):
 rng=np.random.default_rng(PARAMS['seed']+seed)
 size=128;p=np.ones((size,size,4),dtype=np.float32)
 coarse=np.repeat(np.repeat(rng.uniform(-variation,variation,(32,32)),4,0),4,1)
 fine=rng.uniform(-variation*.4,variation*.4,(size,size))
 p[:,:,:3]=np.clip(np.array(color)[None,None,:]+(coarse+fine)[:,:,None],0,1)
 return save_pixels(name,p)

wall=noise_texture('plaster_128',[.75,.75,.705],.035,1)
roof=noise_texture('roof_stone_128',[.84,.835,.78],.025,2)
blue=noise_texture('blue_cornice_128',[.12,.35,.49],.025,3)
base=noise_texture('base_stone_128',[.61,.62,.58],.03,4)
def rect(p,x,y,w,h,c):p[y:y+h,x:x+w,:3]=c
def line(p,a,b,c,width=1):
 steps=max(abs(b[0]-a[0]),abs(b[1]-a[1]))+1
 for t in np.linspace(0,1,steps):
  x,y=np.round(np.array(a)*(1-t)+np.array(b)*t).astype(int)
  p[max(0,y-width):min(len(p),y+width+1),max(0,x-width):min(len(p),x+width+1),:3]=c

# One atlas contains frames and simple recessed shading; most windows are two triangles.
p=np.ones((128,128,4),dtype=np.float32);p[:,:,:3]=[.74,.75,.7]
colors=[[.94,.85,.43],[.55,.69,.72],[.25,.30,.32],[.71,.79,.77]]
for i,c in enumerate(colors):
 x,y=(i%2)*64,(i//2)*64
 rect(p,x+4,y+4,56,56,[.88,.87,.80]);rect(p,x+9,y+9,46,46,[.38,.43,.43])
 rect(p,x+12,y+13,40,39,c)
 rect(p,x+14,y+15,35,3,np.minimum(np.array(c)+.1,1));rect(p,x+12,y+49,40,3,np.maximum(np.array(c)-.1,0))
 rect(p,x+30,y+13,3,39,[.80,.80,.72]);rect(p,x+10,y+55,46,4,[.90,.89,.83])
windows=save_pixels('windows_atlas_128',p)

p=np.ones((128,128,4),dtype=np.float32);p[:,:,:3]=[.86,.86,.80]
rect(p,10,7,108,121,[.34,.43,.46]);rect(p,16,13,43,108,[.42,.58,.65]);rect(p,69,13,43,108,[.42,.58,.65])
for x in [20,73]:
 rect(p,x,18,34,54,[.60,.75,.78]);rect(p,x,22,34,3,[.71,.82,.82]);rect(p,x,81,34,33,[.37,.52,.59])
rect(p,60,7,8,121,[.88,.88,.82]);rect(p,49,68,4,19,[.86,.84,.65]);rect(p,75,68,4,19,[.86,.84,.65])
doors=save_pixels('double_door_128',p)

p=np.ones((128,128,4),dtype=np.float32);p[:,:,:3]=[.73,.74,.69]
rect(p,12,27,104,73,[.40,.52,.56]);rect(p,19,34,90,59,[.87,.85,.71]);
line(p,(19,34),(64,70),[.38,.50,.54],2);line(p,(64,70),(108,34),[.38,.50,.54],2)
icon=save_pixels('envelope_128',p)

def mat(name,img,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;b=n.get('Principled BSDF')
 b.inputs['Roughness'].default_value=.94;b.inputs['Metallic'].default_value=0;b.inputs['Specular IOR Level'].default_value=.08
 t=n.new('ShaderNodeTexImage');t.image=img;t.interpolation='Closest'
 m.node_tree.links.new(t.outputs['Color'],b.inputs['Base Color'])
 if emission: m.node_tree.links.new(t.outputs['Color'],b.inputs['Emission Color']);b.inputs['Emission Strength'].default_value=emission
 return m
M=[mat('Pale_plaster_128',wall),mat('Pale_roof_trim_128',roof),mat('Deep_blue_cornice_128',blue),mat('Grey_base_128',base),mat('Window_warm',windows,.15),mat('Window_cool',windows),mat('Window_dark',windows),mat('Bluegrey_double_door',doors),mat('Envelope_accent',icon)]

class Mesh:
 def __init__(self):self.v=[];self.f=[];self.uv=[];self.mi=[]
 def face(self,points,mi=0,uv=None):
  start=len(self.v);self.v.extend([tuple(p) for p in points]);self.f.append(list(range(start,start+len(points))));self.mi.append(mi)
  self.uv.append(uv or [(0,0),(1,0),(1,1),(0,1)])
 def box(self,center,size,mi=0):
  x,y,z=center;a,b,c=[s/2 for s in size]
  self.face([(x-a,y-b,z-c),(x+a,y-b,z-c),(x+a,y-b,z+c),(x-a,y-b,z+c)],mi)
  self.face([(x+a,y+b,z-c),(x-a,y+b,z-c),(x-a,y+b,z+c),(x+a,y+b,z+c)],mi)
  self.face([(x-a,y+b,z-c),(x-a,y-b,z-c),(x-a,y-b,z+c),(x-a,y+b,z+c)],mi)
  self.face([(x+a,y-b,z-c),(x+a,y+b,z-c),(x+a,y+b,z+c),(x+a,y-b,z+c)],mi)
  self.face([(x-a,y-b,z+c),(x+a,y-b,z+c),(x+a,y+b,z+c),(x-a,y+b,z+c)],mi)
  self.face([(x-a,y+b,z-c),(x+a,y+b,z-c),(x+a,y-b,z-c),(x-a,y-b,z-c)],mi)
 def object(self,name):
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update()
  o=bpy.data.objects.new(name,mesh);collection.objects.link(o);o.parent=root
  for material in M:mesh.materials.append(material)
  layer=mesh.uv_layers.new(name='UVMap')
  for poly,coords,mi in zip(mesh.polygons,self.uv,self.mi):
   poly.material_index=mi;poly.use_smooth=False
   for loop,uv in zip(poly.loop_indices,coords):layer.data[loop].uv=uv
  return o

body=Mesh();body.box((0,0,.06),(5.7,5.1,.12),3);body.box((0,0,2.21),(5.6,5,4.18));body.object('01_Wall_body')
platform=Mesh();platform.box((0,0,4.37),(5.96,5.36,.14),1)
# Three low parapet strips leave the blue rolled front edge distinct.
platform.box((0,2.61,4.53),(5.96,.14,.20),1)
for x in [-2.91,2.91]:platform.box((x,-.03,4.53),(.14,5.14,.20),1)
platform.box((.75,.83,4.77),(1.24,1.12,.66),0);platform.box((.75,.83,5.14),(1.34,1.22,.08),1)
platform.object('02_Flat_roof_and_access_block')
cornice=Mesh();n=PARAMS['cornice']['segments'];rings=[]
for x in [-3.03,3.03]:
 rings.append([(x,-2.54+math.cos(i*math.tau/n)*.23,4.31+math.sin(i*math.tau/n)*.18) for i in range(n)])
for i in range(n):
 j=(i+1)%n;cornice.face([rings[0][j],rings[1][j],rings[1][i],rings[0][i]],2)
for k in [0,1]:
 pts=list(reversed(rings[k])) if k==0 else rings[k]
 cornice.face(pts,2,[(.5+(p[1]+2.54)/.48,.5+(p[2]-4.31)/.38) for p in pts])
cornice.object('03_Blue_segmented_round_cornice')

def atlas_uv(tile):
 # image array is top-to-bottom; Blender UV uses bottom-to-top
 x=(tile%2)*.5;y=.5 if tile<2 else 0
 return [(x+.012,y+.012),(x+.488,y+.012),(x+.488,y+.488),(x+.012,y+.488)]
def panel(mesh,horizontal,z,w,h,side,mi,uv=None):
 # outside-facing quads offset only 1.5cm, no floating window boxes
 if side=='front': pts=[(horizontal-w/2,-2.515,z-h/2),(horizontal+w/2,-2.515,z-h/2),(horizontal+w/2,-2.515,z+h/2),(horizontal-w/2,-2.515,z+h/2)]
 elif side=='back':pts=[(horizontal+w/2,2.515,z-h/2),(horizontal-w/2,2.515,z-h/2),(horizontal-w/2,2.515,z+h/2),(horizontal+w/2,2.515,z+h/2)]
 elif side=='left':pts=[(-2.815,horizontal+w/2,z-h/2),(-2.815,horizontal-w/2,z-h/2),(-2.815,horizontal-w/2,z+h/2),(-2.815,horizontal+w/2,z+h/2)]
 else:pts=[(2.815,horizontal-w/2,z-h/2),(2.815,horizontal+w/2,z-h/2),(2.815,horizontal+w/2,z+h/2),(2.815,horizontal-w/2,z+h/2)]
 mesh.face(pts,mi,uv)
patterns=[[0,1,0,0,1,0,2],[0,0,1,0,0,2,0],[1,0,0,1,0,0,1]]
for side in ['front','back','left','right']:
 windows_mesh=Mesh();cols=[(i-3)*.76 for i in range(7)] if side in ['front','back'] else [-1.72,-.57,.57,1.72]
 for row,z in enumerate(PARAMS['window_rows']):
  for col,hor in enumerate(cols):
   tile=patterns[row][(col+(0 if side=='front' else 2))%7]
   panel(windows_mesh,hor,z,.49,.49,side,4+tile,atlas_uv(tile))
 windows_mesh.object('04_Windows_'+side)
door_mesh=Mesh();panel(door_mesh,0,.87,1.18,1.62,'front',7);panel(door_mesh,0,.83,1.05,1.46,'back',7);door_mesh.object('05_Double_doors')
details=Mesh()
for x in [-2.02,2.02]:panel(details,x,1.18,.27,.22,'front',8)
panel(details,1.91,1.18,.24,.20,'back',8)
# Low base trim wraps around all sides. No new step projects into the path.
details.box((0,-2.514,.18),(5.58,.035,.12),3);details.box((0,2.514,.18),(5.58,.035,.12),3)
details.object('06_Envelope_details_and_base')

ladder=Mesh()
# Simplified pale ladder on the left wall, within the planned side collider.
for y in [-.98,.98]:ladder.box((-2.97,y,2.22),(.12,.12,4.40),1)
for z in np.arange(.25,4.35,.32):ladder.box((-3.01,0,float(z)),(.13,2.08,.075),1)
for z in [.65,3.65]:
 for y in [-.98,.98]:ladder.box((-2.875,y,z),(.25,.08,.08),1)
ladder.object('07_Left_ladder')

# Keep UV texture files and packed copies in the editable .blend.
for image in bpy.data.images:
 if image.filepath and image.source=='FILE':image.pack();image.filepath='//textures/'+Path(image.filepath).name
objects=list(collection.objects)
for o in scene.objects:o.select_set(False)
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
root['reference_notes']='Pale compact block / 3 rows of regular windows / 10-segment blue cornice / sparse envelopes'
export=ROOT/'Outpost_01.glb'
bpy.ops.export_scene.gltf(filepath=str(export),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True)
shutil.copy2(export,ROOT.parent/'public'/'assets'/'Outpost_01.glb')
verts=[o.matrix_world@Vector(v) for o in objects if o.type=='MESH' for v in o.bound_box]
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH')
stats={'blender_version':bpy.app.version_string,'params':PARAMS,'triangles':triangles,'meshes':sum(o.type=='MESH' for o in objects),'min':[min(v[i] for v in verts) for i in range(3)],'max':[max(v[i] for v in verts) for i in range(3)],'texture_files':[p.name for p in (ROOT/'textures').glob('*.png')],'glb':str(export)}
(ROOT/'asset-report.json').write_text(json.dumps(stats,indent=2),encoding='utf8')

# A separate presentation collection never goes into the game GLB.
presentation=bpy.data.collections.new('_Preview_only');scene.collection.children.link(presentation)
def preview_move(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 presentation.objects.link(o)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));floor=bpy.context.object;preview_move(floor)
floor_mat=bpy.data.materials.new('Preview_ground');floor_mat.diffuse_color=(.39,.49,.30,1);floor.data.materials.append(floor_mat)
bpy.ops.mesh.primitive_cube_add(size=1,location=(0,-2.59,1.82));sign=bpy.context.object;sign.name='Preview_sign_backplate';sign.dimensions=(1.3,.025,.20);preview_move(sign);sign.data.materials.append(M[2])
font_path=Path('C:/Windows/Fonts/msyh.ttc')
if font_path.exists():
 text=bpy.data.curves.new('Preview_only_name','FONT');text.body='旧 网 驿 站';text.font=bpy.data.fonts.load(str(font_path));text.size=.145;text.align_x='CENTER';text.align_y='CENTER'
 signtext=bpy.data.objects.new('Runtime_sign_preview_only',text);presentation.objects.link(signtext);signtext.location=(0,-2.61,1.82);signtext.rotation_euler=(math.pi/2,0,0)
 signmat=bpy.data.materials.new('Sign_cream');signmat.diffuse_color=(.94,.92,.77,1);text.materials.append(signmat)
world=bpy.data.worlds.new('Bright_day');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.68,.82,.95,1);world.node_tree.nodes['Background'].inputs[1].default_value=.75
bpy.ops.object.light_add(type='SUN',location=(4,-6,10));sun=bpy.context.object;preview_move(sun);sun.rotation_euler=(.45,-.45,-.35);sun.data.energy=2;sun.data.angle=.08
bpy.ops.object.camera_add();camera=bpy.context.object;preview_move(camera);scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=7.2
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.render.image_settings.file_format='PNG'
views={'front':(0,-16,4.3),'side':(14,0,6.5),'rear':(0,14,6.5),'oblique':(10,-13,9)}
for name,pos in views.items():
 camera.location=pos;camera.rotation_euler=(Vector((0,0,2.50))-camera.location).to_track_quat('-Z','Y').to_euler()
 camera.data.ortho_scale=9.3 if name=='oblique' else 8.3
 scene.render.filepath=str(ROOT/'previews'/f'{name}.png');bpy.ops.render.render(write_still=True)
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Outpost_01.blend'))
print('OUTPOST_GENERATED '+json.dumps(stats))
