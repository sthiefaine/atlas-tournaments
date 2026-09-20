#!/usr/bin/env python3
"""Relit les conduits arrière du GLB sans renderer ; portée locale explicite."""
from pathlib import Path
import json, struct, sys, hashlib
import numpy as np
identifiant='unite_furtif_base'
sortie=Path(sys.argv[1] if len(sys.argv)>1 else f'tmp/production-sequentielle/{identifiant}')
brut=(sortie/f'{identifiant}_lod0.glb').read_bytes();longueur=struct.unpack_from('<I',brut,12)[0]
doc=json.loads(brut[20:20+longueur]);binaire=brut[28+longueur:]
def acc(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
 n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
 return np.ndarray((a['count'],n),dtype=dtype,buffer=binaire,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*np.dtype(dtype).itemsize),np.dtype(dtype).itemsize)).astype(float)
noeud=next(n for n in doc['nodes'] if n['name']=='corps')
assert noeud.get('rotation',[0,0,0,1])==[0,0,0,1] and noeud.get('scale',[1,1,1])==[1,1,1]
triangles=[];coque=[]
for prim in doc['meshes'][noeud['mesh']]['primitives']:
 p=acc(prim['attributes']['POSITION'])+np.array(noeud.get('translation',[0,0,0]))
 idx=acc(prim['indices']).astype(int).reshape(-1,3);uv=acc(prim['attributes']['TEXCOORD_0'])
 roles=np.floor(uv[:,0]*4).astype(int)+4*np.floor(uv[:,1]*4).astype(int)
 triangles.append(p[idx]);coque.append(p[idx[np.all(roles[idx]==0,axis=1)]])
triangles=np.concatenate(triangles);coque=np.concatenate(coque)
def premier_contact(orig,direction):
 # Möller–Trumbore, double face : faces vues depuis l'intérieur incluses.
 e1=triangles[:,1]-triangles[:,0];e2=triangles[:,2]-triangles[:,0]
 h=np.cross(np.broadcast_to(direction,e2.shape),e2);det=np.sum(e1*h,axis=1)
 inv=np.divide(1,det,out=np.zeros_like(det),where=np.abs(det)>1e-12)
 s=orig-triangles[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1)
 v=np.sum(direction*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 ok=(np.abs(det)>1e-12)&(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(t>1e-7)
 assert ok.any()
 return float(t[ok].min())
resultats=[]
for signe in [-1,1]:
 borne_x=sorted([signe*.0241,signe*.0599]);mini=np.array([borne_x[0],.1431,-.4125]);maxi=np.array([borne_x[1],.1659,-.3581])
 possibles=np.all(coque.max(axis=1)>=mini,axis=1)&np.all(coque.min(axis=1)<=maxi,axis=1)
 # L'absence même d'intersection AABB prouve que la coque n'obstrue aucun point du volume.
 assert not possibles.any(),f'Coque dans le conduit {signe}'
 rayons=[]
 for x in [.026,.042,.058]:
  for y in [.147,.1545,.162]:
   origine=np.array([signe*x,y,-.414]);d=premier_contact(origine,np.array([0,0,1]))
   assert abs(d-.056)<2e-6,(origine,d)
   rayons.append({'origine':origine.tolist(),'premierContactMetres':d})
 resultats.append({'cote':signe,'volumeSansCoque':{'min':mini.tolist(),'max':maxi.tolist()},'facesCoqueEnConflit':int(possibles.sum()),'rayonsEntreDiffuseurs':rayons})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'conduits':resultats,'methode':'GLB exporté. Le volume ouvert de chaque conduit ne croise aucune AABB de triangle de la coque/voilure (cellule UV 0). Neuf rayons par sortie dans les trois passages entre diffuseurs ne rencontrent aucune géométrie du corps avant le fond reculé à 56 mm.','limites':['Mesure locale des sorties arrière ; aucune certification générale des intersections internes.','Les diffuseurs et le fond sont des obstacles intentionnels.','Pas de rendu ni contrôle visuel.']}
(sortie/'mesures-conduits.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'conduits':2,'rayonsLibresJusquAuFond':18,'facesCoqueEnConflit':0}))
