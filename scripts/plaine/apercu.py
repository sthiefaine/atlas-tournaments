"""Blender preview of the delivered GLB, including independently rotated neighbours."""
import bpy, math, os
from mathutils import Vector
root=os.path.abspath('.')
out=os.path.join(root,'assets/livraisons/terrain_plaine')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.join(root,'public/assets/modeles/terrain_plaine_lod0.glb'))
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.render.resolution_x=1000; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world.color=(.22,.22,.22)
scene.view_settings.view_transform='AgX'
def aim(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
for location,power,size in [((1,-2,4),350,3),((-2,1,3),180,2.5)]:
    bpy.ops.object.light_add(type='AREA',location=location)
    obj=bpy.context.object; obj.data.energy=power; obj.data.shape='DISK'; obj.data.size=size; aim(obj,(0,0,0))
bpy.ops.object.camera_add(location=(1.1,-1.6,4.18))
camera=bpy.context.object; camera.data.type='ORTHO'; camera.data.ortho_scale=1.45; aim(camera,(0,0,0)); scene.camera=camera
scene.render.filepath=os.path.join(out,'apercu.png'); bpy.ops.render.render(write_still=True)
# A four-by-four assembled field, rotation varies in every row and column.
anchor=bpy.data.objects['racine']; mesh=bpy.data.objects['sol']
for y in range(4):
    for x in range(4):
        if (x,y)==(0,0): r=anchor
        else:
            r=anchor.copy(); scene.collection.objects.link(r)
            m=mesh.copy(); m.data=mesh.data; m.parent=r; scene.collection.objects.link(m)
        r.location=(x-1.5,y-1.5,0); r.rotation_euler.z=((x+2*y+x*y)%4)*math.pi/2
camera.location=(0,0,8); aim(camera,(0,0,0)); camera.data.ortho_scale=4
scene.render.filepath=os.path.join(out,'raccords_quarts_de_tour.png'); bpy.ops.render.render(write_still=True)
# Game-density preview of the same four-metre field: 192 px = 48 px/metre.
scene.render.resolution_x=192; scene.render.resolution_y=192
scene.render.filepath=os.path.join(out,'raccords_48pxm.png'); bpy.ops.render.render(write_still=True)
