"""Actual Blender source / GLB round-trip validation. Does not overwrite assets.
Run: blender --background --factory-startup --python-exit-code 1 --python this_file
"""
import bpy, json, struct, hashlib, math
from pathlib import Path
from mathutils import Vector, Matrix, Quaternion

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'Outpost_01.blend'
GLB = ROOT / 'Outpost_01.glb'
REPORT = ROOT / 'validation-report.json'
EXPECTED_TRIANGLES = 526
report = {'blender_version': bpy.app.version_string, 'source': str(SOURCE), 'glb': str(GLB), 'passed': False, 'checks': []}

def check(condition, message, details=None):
    report['checks'].append({'name': message, 'passed': bool(condition), 'details': details})
    if not condition:
        raise AssertionError(message + ': ' + str(details))

def bounds(objects):
    pts = [obj.matrix_world @ Vector(v) for obj in objects for v in obj.bound_box]
    minimum = [min(p[i] for p in pts) for i in range(3)]
    maximum = [max(p[i] for p in pts) for i in range(3)]
    return {'min': minimum, 'max': maximum, 'dimensions': [maximum[i]-minimum[i] for i in range(3)]}

def triangles(objects):
    return sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in objects)

def inspect_meshes(objects):
    missing_uv = [o.name for o in objects if not o.data.uv_layers or len(o.data.uv_layers.active.data) != len(o.data.loops)]
    images = {}
    for obj in objects:
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type != 'TEX_IMAGE' or not node.image:
                    continue
                img = node.image
                # Force actual decoding before inspecting has_data (Blender lazily loads images).
                sample = list(img.pixels[:4])
                images[img.name] = {'size': list(img.size), 'decoded': bool(sample) and img.has_data, 'packed': bool(img.packed_file), 'filter': node.interpolation}
    return {'mesh_count': len(objects), 'triangles': triangles(objects), 'bounds': bounds(objects), 'missing_uv': missing_uv, 'images': images}

def glb_data(path):
    raw = path.read_bytes()
    magic, version, size = struct.unpack_from('<4sII', raw, 0)
    check(magic == b'glTF' and version == 2 and size == len(raw), 'GLB header is valid')
    offset=12; doc=None; binary=None
    while offset < len(raw):
        length, typ = struct.unpack_from('<II', raw, offset); offset += 8
        chunk=raw[offset:offset+length]; offset += length
        if typ == 0x4E4F534A: doc=json.loads(chunk)
        if typ == 0x004E4942: binary=chunk
    check(doc is not None and binary is not None, 'GLB contains JSON and embedded binary data')
    return doc,binary

def node_matrix(node):
    if 'matrix' in node:
        values=node['matrix']
        return Matrix([[values[c*4+r] for c in range(4)] for r in range(4)])
    q=node.get('rotation',[0,0,0,1]); scale=node.get('scale',[1,1,1])
    return Matrix.Translation(node.get('translation',[0,0,0])) @ Quaternion((q[3],q[0],q[1],q[2])).to_matrix().to_4x4() @ Matrix.Diagonal((*scale,1))

def read_vec3(doc,binary,index):
    accessor=doc['accessors'][index]; view=doc['bufferViews'][accessor['bufferView']]
    check(accessor['componentType']==5126 and accessor['type']=='VEC3', 'Geometry accessor uses float vectors')
    start=view.get('byteOffset',0)+accessor.get('byteOffset',0); stride=view.get('byteStride',12)
    return [Vector(struct.unpack_from('<fff',binary,start+i*stride)) for i in range(accessor['count'])]

try:
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene=bpy.context.scene
    collection=bpy.data.collections.get('Outpost_01')
    check(collection is not None, 'Editable source has independent Outpost_01 collection')
    source_objects=[o for o in collection.all_objects if o.type=='MESH']
    root=bpy.data.objects.get('Outpost_01')
    check(scene.unit_settings.system=='METRIC' and abs(scene.unit_settings.scale_length-1)<1e-8, 'Source uses metres')
    check(root is not None and root.location.length<1e-8 and all(abs(v-1)<1e-8 for v in root.scale), 'Asset root is at bottom-centre origin with unit scale')
    source_info=inspect_meshes(source_objects);report['source_info']=source_info
    check(source_info['triangles']==EXPECTED_TRIANGLES, 'Source triangle count', source_info['triangles'])
    check(source_info['mesh_count']==10, 'Source retains editable mesh parts', source_info['mesh_count'])
    check(not source_info['missing_uv'], 'All source meshes have UVs', source_info['missing_uv'])
    check(abs(source_info['bounds']['min'][2])<1e-6, 'Source rests at Z=0', source_info['bounds'])
    check(len(source_info['images'])==7 and all(i['decoded'] and i['size']==[128,128] and i['filter']=='Closest' for i in source_info['images'].values()), 'Seven 128px nearest-sampled source textures decode', source_info['images'])
    check(all(i['packed'] for i in source_info['images'].values()), 'Source texture images are packed')
    texture_files=sorted((ROOT/'textures').glob('*.png'))
    check(len(texture_files)==7 and all(p.stat().st_size>0 for p in texture_files), 'Seven editable PNG texture files exist', [p.name for p in texture_files])
    cornice=next(o for o in source_objects if 'cornice' in o.name)
    normal_dots=[]
    for poly in cornice.data.polygons:
        center=poly.center
        # End caps point along X, curved sides away from the elliptical axis.
        expected=Vector((math.copysign(1,center.x),0,0)) if len(poly.vertices)>4 else Vector((0,(center.y+2.54)/(.23*.23),(center.z-4.31)/(.18*.18))).normalized()
        normal_dots.append(poly.normal.dot(expected))
    check(min(normal_dots)>.98, 'All blue cornice faces point outward', {'minimum_normal_dot':min(normal_dots),'faces':len(normal_dots)})
    front=next(o for o in source_objects if o.name=='04_Windows_front')
    check(all(p.normal.y<-.99 for p in front.data.polygons), 'Source facade faces Blender -Y')

    doc,binary=glb_data(GLB)
    image_info=[]
    for img in doc.get('images',[]):
        check(img.get('mimeType')=='image/png' and 'bufferView' in img and 'uri' not in img, 'GLB image is embedded PNG', img.get('name'))
        view=doc['bufferViews'][img['bufferView']]; data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        check(data[:8]==b'\x89PNG\r\n\x1a\n', 'Embedded image bytes are a valid PNG')
        width,height=struct.unpack_from('>II',data,16)
        image_info.append({'name':img.get('name'),'width':width,'height':height,'bytes':len(data)})
    check(len(image_info)==7 and all(i['width']==128 and i['height']==128 for i in image_info), 'All seven textures are embedded at 128px', image_info)
    check(all(s.get('magFilter')==9728 and s.get('minFilter') in (9728,9984) for s in doc.get('samplers',[])), 'GLB texture samplers preserve nearest filtering', doc.get('samplers'))
    primitives=[p for m in doc['meshes'] for p in m['primitives']]
    exported_triangles=sum(doc['accessors'][p['indices']]['count']//3 for p in primitives)
    check(exported_triangles==EXPECTED_TRIANGLES, 'GLB triangle count matches source', exported_triangles)
    check(not any('Preview' in n.get('name','') or 'preview' in n.get('name','') for n in doc['nodes']), 'Presentation objects are excluded from GLB')
    world_matrices={}
    def walk(index,parent):
        matrix=parent@node_matrix(doc['nodes'][index]);world_matrices[index]=matrix
        for child in doc['nodes'][index].get('children',[]):walk(child,matrix)
    for index in doc['scenes'][doc.get('scene',0)]['nodes']:walk(index,Matrix.Identity(4))
    front_index=next(i for i,n in enumerate(doc['nodes']) if n.get('name')=='04_Windows_front')
    front_node=doc['nodes'][front_index]; matrix=world_matrices[front_index];forward_positions=[];forward_normals=[]
    for primitive in doc['meshes'][front_node['mesh']]['primitives']:
        forward_positions.extend(matrix@p for p in read_vec3(doc,binary,primitive['attributes']['POSITION']))
        forward_normals.extend((matrix.to_3x3()@n).normalized() for n in read_vec3(doc,binary,primitive['attributes']['NORMAL']))
    check(all(p.z>2.5 for p in forward_positions) and all(n.z>.99 for n in forward_normals), 'Exported facade faces glTF +Z', {'front_z':forward_positions[0].z,'normal_z':forward_normals[0].z})
    game_asset=ROOT.parent/'public'/'assets'/'Outpost_01.glb'
    check(hashlib.sha256(GLB.read_bytes()).digest()==hashlib.sha256(game_asset.read_bytes()).digest(), 'Game GLB matches validated export')
    report['glb_info']={'triangles':exported_triangles,'meshes':len(doc['meshes']),'primitives':len(primitives),'images':image_info}

    for obj in list(collection.all_objects):bpy.data.objects.remove(obj,do_unlink=True)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB))
    imported=[o for o in set(bpy.data.objects)-before if o.type=='MESH']
    roundtrip=inspect_meshes(imported);report['reimport_info']=roundtrip
    check(roundtrip['triangles']==source_info['triangles'], 'Actual Blender reimport triangle count matches')
    check(not roundtrip['missing_uv'], 'Actual reimport UVs are intact')
    check(all(abs(roundtrip['bounds'][key][i]-source_info['bounds'][key][i])<1e-4 for key in ['min','max'] for i in range(3)), 'Actual reimport bounds match source', roundtrip['bounds'])
    check(len(roundtrip['images'])==7 and all(i['decoded'] and i['size']==[128,128] for i in roundtrip['images'].values()), 'Actual reimport materials decode all seven textures', roundtrip['images'])
    scene.render.filepath=str(ROOT/'previews'/'reimport.png')
    bpy.ops.render.render(write_still=True)
    report['reimport_preview']=scene.render.filepath
    report['passed']=True
finally:
    REPORT.write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
    print('BUILDING_VALIDATION '+json.dumps({'passed':report['passed'],'checks':len(report['checks']),'report':str(REPORT)},ensure_ascii=False))
