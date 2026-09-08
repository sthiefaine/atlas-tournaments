"""Render the delivered GLBs, not a separate source model. Blender --background --python this.py."""
import bpy, math, os
from mathutils import Vector
root = os.path.abspath('.')
out = os.path.join(root, 'assets/livraisons/unite_artillerie_base')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(root, 'public/assets/modeles/unite_artillerie_base_lod0.glb'))
for obj in bpy.context.scene.objects:
    if obj.animation_data:
        obj.animation_data_clear()
# glTF +Y becomes Blender +Z, front becomes Blender -Y.
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.render.resolution_x=900
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.world.color=(0.22,0.22,0.22)
scene.view_settings.view_transform='AgX'
def aim(obj, point): obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
for loc, energy, size in [((1,-2,3),160,2.2),((-2,-.5,1.7),100,2),((0,2,2.5),190,1.8)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    bpy.context.object.data.energy=energy
    bpy.context.object.data.shape='DISK'
    bpy.context.object.data.size=size
    aim(bpy.context.object,(0,0,.2))
bpy.ops.object.camera_add()
camera=bpy.context.object
camera.data.type='ORTHO'
camera.data.ortho_scale=1.12
scene.camera=camera
scene.render.film_transparent=True
for name,elev in [('apercu',35),('vue65',65)]:
    r=2.5
    camera.location=(r*math.cos(math.radians(elev))*.58,-r*math.cos(math.radians(elev))*.815,r*math.sin(math.radians(elev))+.20)
    aim(camera,(0,0,.20))
    scene.render.filepath=os.path.join(out,name+'.png')
    bpy.ops.render.render(write_still=True)
# Exact game sampling: 1.125m / 54px = 48 pixels per metre.
scene.render.resolution_x=54
scene.render.resolution_y=54
camera.data.ortho_scale=1.125
scene.render.filepath=os.path.join(out,'vue65_48pxm.png')
bpy.ops.render.render(write_still=True)
# Inspect end poses directly from the exported binary animation channels.
import json, struct
from mathutils import Quaternion
with open(os.path.join(root, 'public/assets/modeles/unite_artillerie_base_lod0.glb'),'rb') as f: glb=f.read()
jlen=struct.unpack_from('<I',glb,12)[0]
doc=json.loads(glb[20:20+jlen]); binary=glb[28+jlen:]
def last_value(accessor):
    a=doc['accessors'][accessor]; v=doc['bufferViews'][a['bufferView']]
    width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    offset=v.get('byteOffset',0)+a.get('byteOffset',0)+(a['count']-1)*v.get('byteStride',4*width)
    return struct.unpack_from('<'+'f'*width,binary,offset)
scene.render.resolution_x=900; scene.render.resolution_y=900
camera.data.ortho_scale=1.12
for clip in ['deplacement','hors_jeu']:
    animation=next(a for a in doc['animations'] if a['name']==clip)
    for channel in animation['channels']:
        target=channel['target']; obj=bpy.data.objects[doc['nodes'][target['node']]['name']]
        value=last_value(animation['samplers'][channel['sampler']]['output'])
        if target['path']=='translation': obj.location=(value[0],-value[2],value[1])
        elif target['path']=='rotation':
            obj.rotation_mode='QUATERNION'; obj.rotation_quaternion=Quaternion((value[3],value[0],-value[2],value[1]))
    scene.render.filepath=os.path.join(out,clip+'.png')
    bpy.ops.render.render(write_still=True)
