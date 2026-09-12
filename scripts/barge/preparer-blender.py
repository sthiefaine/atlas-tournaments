"""Prépare la géométrie Tripo. Blender 5.1, sans rendu ni modification de la source."""
import bpy, bmesh, os, json
from mathutils import Matrix
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
SOURCE=os.environ.get('ATLAS_BARGE_SOURCE',ROOT+'/assets/sources/tripo_tugboat/tugboat_etude_50000.glb')
OUT=ROOT+'/assets/sources/unite_barge_base/preparation';os.makedirs(OUT,exist_ok=True)
for lod,target in enumerate([49920,11920,2920]):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=SOURCE)
 o=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=o
 # Source : X longueur (rampe vers +X), Y largeur Blender, Z hauteur.
 xyz=[v.co.copy() for v in o.data.vertices];lo=[min(v[i] for v in xyz)for i in range(3)];hi=[max(v[i] for v in xyz)for i in range(3)]
 sx=.85/(hi[0]-lo[0]);sy=.62/(hi[1]-lo[1]);sz=.5/(hi[2]-lo[2])
 transform=Matrix(((0,sy,0,-sy*(lo[1]+hi[1])/2),(-sx,0,0,sx*(lo[0]+hi[0])/2),(0,0,sz,-sz*lo[2]),(0,0,0,1)))
 o.data.transform(transform)
 # Réserver le haut de l'atlas glTF aux panneaux d'équipe ; conserver les îlots Tripo.
 for uv in o.data.uv_layers.active.data:uv.uv.y*=.875
 o.data.calc_loop_triangles();m=o.modifiers.new('LOD','DECIMATE');m.ratio=target/len(o.data.loop_triangles);m.use_collapse_triangulate=True
 bpy.ops.object.modifier_apply(modifier=m.name)
 # Isoler la partie supérieure de la grue, sans articulation qui ouvrirait le maillage.
 bm=bmesh.new();bm.from_mesh(o.data)
 for f in bm.faces:
  c=f.calc_center_median();f.select=(c.z>.312 and c.y<.156 and c.y>-.25)
 bm.to_mesh(o.data);bm.free()
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT')
 grue=next(x for x in bpy.context.scene.objects if x.type=='MESH' and x!=o);grue.name='module_grue';o.name='base'
 # Panneaux épais et lisibles, sur la cabine arrière et les deux côtés de la coque.
 panels=[]
 for center,size in [((0,.275,.454),(.22,.105,.006)),((.255,.08,.17),(.008,.34,.042)),((-.255,.08,.17),(.008,.34,.042))]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=center);p=bpy.context.object;p.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  for uv in p.data.uv_layers.active.data:uv.uv=(.5,.9375)
  panels.append(p)
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
 for p in panels:p.select_set(True)
 bpy.context.view_layer.objects.active=o;bpy.ops.object.join()
 # Export géométrique intermédiaire. Le script suivant fixe contrat, textures et clips.
 bpy.ops.export_scene.gltf(filepath=f'{OUT}/lod{lod}.glb',export_format='GLB',export_yup=True,export_animations=False)
print('GEOMETRIES_BARGE_PRETES')
