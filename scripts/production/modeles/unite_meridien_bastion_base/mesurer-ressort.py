#!/usr/bin/env python3
"""Jeux localisés du ressort exporté : pas de certification globale des collisions."""
from pathlib import Path
import json, struct, sys
import numpy as np
identifiant='unite_meridien_bastion_base'
sortie=Path(sys.argv[1] if len(sys.argv)>1 else f'tmp/production-sequentielle/{identifiant}')
brut=(sortie/f'{identifiant}_lod0.glb').read_bytes()
taille=struct.unpack_from('<I',brut,12)[0]
doc=json.loads(brut[20:20+taille]);binaire=brut[28+taille:]
def acc(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
 n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dtype={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
 return np.ndarray((a['count'],n),dtype=dtype,buffer=binaire,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*np.dtype(dtype).itemsize),np.dtype(dtype).itemsize)).astype(float)
noeud=next(n for n in doc['nodes'] if n['name']=='module_antenne')
assert len(doc['meshes'][noeud['mesh']]['primitives'])==1
primitive=doc['meshes'][noeud['mesh']]['primitives'][0]
p=acc(primitive['attributes']['POSITION']);uv=acc(primitive['attributes']['TEXCOORD_0']);indices=acc(primitive['indices']).astype(int).reshape(-1,3)
# Seul le fil inox du ressort utilise la cellule d'atlas 11 de cette articulation.
role=np.floor(uv[:,0]*4).astype(int)+4*np.floor(uv[:,1]*4).astype(int)
indices=indices[np.all(role[indices]==11,axis=1)]
assert len(indices)==864
segments=np.rint((uv[:,0]*4-3-.065)/.87*72).astype(int)
segments=segments[indices].min(axis=1)
triangles=p[indices]
# Le centre de l'âme est le pivot local, rayon 6 mm. Le minimum radial
# sur les projections triangulaires donne une borne au cylindre infini.
def produit(a,b):return np.sum(a*b,axis=-1)
def point_segment(p,a,b):
 d=b-a;t=np.clip(produit(p-a,d)/np.maximum(produit(d,d),1e-30),0,1)
 return np.linalg.norm(p-(a+t[...,None]*d),axis=-1)
def croix2(a,b):return a[...,0]*b[...,1]-a[...,1]*b[...,0]
h=triangles[:,:,[0,2]]
radial=np.min(np.stack([point_segment(np.zeros((len(h),2)),h[:,j],h[:,(j+1)%3]) for j in range(3)]),axis=0)
signes=np.stack([croix2(h[:,(j+1)%3]-h[:,j],-h[:,j]) for j in range(3)],axis=1)
interieur=np.all(signes>1e-15,axis=1)|np.all(signes<-1e-15,axis=1)
radial[interieur]=0
jeu_ame=float(radial.min()-.006)
assert jeu_ame>0,jeu_ame
# Faces de portions distinctes : au moins 16 des 72 segments (2/3 de tour).
# On écarte seulement les paires dont la distance entre AABB est >= 20 mm.
# Le minimum trouvé doit être inférieur à ce seuil pour certifier le minimum global.
mini,maxi=triangles.min(axis=1),triangles.max(axis=1)
ia,ib=[],[]
for i in range(len(indices)):
 j=np.arange(i+1,len(indices));j=j[np.abs(segments[j]-segments[i])>=16]
 ecart=np.maximum(np.maximum(mini[i]-maxi[j],mini[j]-maxi[i]),0)
 j=j[np.linalg.norm(ecart,axis=1)<.020]
 ia.extend([i]*len(j));ib.extend(j.tolist())
ia,ib=np.asarray(ia),np.asarray(ib)
def point_triangle(p,t):
 n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);norm2=produit(n,n)
 projection=p-n*(produit(p-t[:,0],n)/norm2)[:,None]
 c=np.stack([produit(np.cross(t[:,(j+1)%3]-t[:,j],projection-t[:,j]),n) for j in range(3)],axis=1)
 dans=np.all(c>=-1e-20,axis=1)
 bord=np.min(np.stack([point_segment(p,t[:,j],t[:,(j+1)%3]) for j in range(3)]),axis=0)
 return np.where(dans,abs(produit(p-t[:,0],n))/np.sqrt(norm2),bord)
def segments_distance(p0,p1,q0,q1):
 u,v,w=p1-p0,q1-q0,p0-q0
 aa,bb,cc,dd,ee=produit(u,u),produit(u,v),produit(v,v),produit(u,w),produit(v,w)
 den=aa*cc-bb*bb;ok=den>1e-25
 s=np.divide(bb*ee-cc*dd,den,out=np.zeros_like(den),where=ok)
 t=np.divide(aa*ee-bb*dd,den,out=np.zeros_like(den),where=ok)
 interieur=ok&(s>=0)&(s<=1)&(t>=0)&(t<=1)
 d=np.linalg.norm(w+s[:,None]*u-t[:,None]*v,axis=1)
 bord=np.min(np.stack([point_segment(p0,q0,q1),point_segment(p1,q0,q1),point_segment(q0,p0,p1),point_segment(q1,p0,p1)]),axis=0)
 return np.where(interieur,np.minimum(d,bord),bord)
def traverse(p0,p1,t):
 direction=p1-p0;e1=t[:,1]-t[:,0];e2=t[:,2]-t[:,0]
 h=np.cross(direction,e2);det=produit(e1,h);ok=abs(det)>1e-20
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=p0-t[:,0]
 u=produit(s,h)*inv;q=np.cross(s,e1);v=produit(direction,q)*inv;fraction=produit(e2,q)*inv
 return ok&(u>=0)&(v>=0)&(u+v<=1)&(fraction>=0)&(fraction<=1)
intersections=0;jeu_spires=float('inf')
for debut in range(0,len(ia),8192):
 a,b=triangles[ia[debut:debut+8192]],triangles[ib[debut:debut+8192]]
 distances=[]
 for i in range(3):
  distances.extend([point_triangle(a[:,i],b),point_triangle(b[:,i],a)])
  intersections+=int(np.count_nonzero(traverse(a[:,i],a[:,(i+1)%3],b)|traverse(b[:,i],b[:,(i+1)%3],a)))
  for j in range(3):distances.append(segments_distance(a[:,i],a[:,(i+1)%3],b[:,j],b[:,(j+1)%3]))
 jeu_spires=min(jeu_spires,float(np.min(np.stack(distances))))
assert intersections==0 and 0<jeu_spires<.020,(intersections,jeu_spires)
rapport={'id':identifiant,'approbationArtistique':False,'parametresMetres':{'rayonCentral':.018,'diametreFil':.008,'nombreTours':3,'hauteur':.046,'pas':.046/3,'diametreAme':.012},'glbRelu':True,'trianglesRessort':len(indices),'pairesFacesMesurees':len(ia),'seuilEliminationParAabbMetres':.020,'jeuAmeBorneInferieureMetres':jeu_ame,'jeuEntreSpiresMetres':jeu_spires,'intersectionsEntreSpires':intersections,'methode':'GLB exporté : fil identifié par sa cellule UV. Minimum radial continu sur les triangles projetés, moins le rayon de l’âme cylindrique pleine de 6 mm. Distance triangle-triangle (sommets/faces et arêtes/arêtes, avec détection de traversées) entre portions de fil éloignées d’au moins 16 des 72 segments de l’hélice.','limites':['Contrôle local du ressort, pas de certification complète des collisions internes.','Les portions contiguës du même fil sont raccordées intentionnellement.','Le module antenne est une articulation rigide ; ces jeux internes sont invariants dans ses cinq clips.']}
(sortie/'mesures-ressort.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(rapport,ensure_ascii=False,indent=2))
