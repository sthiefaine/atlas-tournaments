#!/usr/bin/env python3
"""Mesures binaires reproductibles du candidat ; aucune validation artistique."""
from pathlib import Path
import json
import struct
import sys
from collections import Counter
import numpy as np
from PIL import Image

identifiant='unite_transport_air_base'
sortie=Path(sys.argv[1] if len(sys.argv)>1 else f'tmp/production-sequentielle/{identifiant}')
brut=(sortie/f'{identifiant}_lod0.glb').read_bytes()
longueur=struct.unpack_from('<I',brut,12)[0]
doc=json.loads(brut[20:20+longueur])
bin=brut[28+longueur:]

def acc(i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
    largeur={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    p=v.get('byteOffset',0)+a.get('byteOffset',0)
    pas=v.get('byteStride',largeur*np.dtype(dtype).itemsize)
    return np.ndarray((a['count'],largeur),dtype=dtype,buffer=bin,offset=p,strides=(pas,np.dtype(dtype).itemsize)).astype(float)

rapport={'triangles':0,'primitives':0,'trianglesDegeneres':0,'trianglesSuperposes':0,'uvTrianglesDegeneres':0,'normalesInversees':0,'normalesErreurMax':0.,'tangentesErreurMax':0.,'orthogonaliteErreurMax':0.,'valeursFinies':True,'uvDansAtlas':True}
for mesh in doc['meshes']:
    for prim in mesh['primitives']:
        rapport['primitives']+=1
        at=prim['attributes']
        p,n,t,uv=(acc(at[k]) for k in ['POSITION','NORMAL','TANGENT','TEXCOORD_0'])
        idx=acc(prim['indices']).astype(int).reshape(-1,3)
        compte=Counter(tuple(sorted(tuple(v) for v in np.round(p[tri],7))) for tri in idx)
        rapport['trianglesSuperposes']+=sum(v-1 for v in compte.values())
        normale=np.cross(p[idx[:,1]]-p[idx[:,0]],p[idx[:,2]]-p[idx[:,0]])
        moyenne=np.mean(n[idx],axis=1)
        aire=np.linalg.norm(normale,axis=1)
        produit=np.sum(normale*moyenne,axis=1)
        rapport['triangles']+=len(idx)
        rapport['trianglesDegeneres']+=int(np.count_nonzero(aire<1e-11))
        a,b=uv[idx[:,1]]-uv[idx[:,0]],uv[idx[:,2]]-uv[idx[:,0]]
        rapport['uvTrianglesDegeneres']+=int(np.count_nonzero(abs(a[:,0]*b[:,1]-a[:,1]*b[:,0])<1e-11))
        rapport['normalesInversees']+=int(np.count_nonzero(produit<0))
        rapport['normalesErreurMax']=max(rapport['normalesErreurMax'],float(np.max(abs(np.linalg.norm(n,axis=1)-1))))
        rapport['tangentesErreurMax']=max(rapport['tangentesErreurMax'],float(np.max(abs(np.linalg.norm(t[:,:3],axis=1)-1))))
        rapport['orthogonaliteErreurMax']=max(rapport['orthogonaliteErreurMax'],float(np.max(abs(np.sum(n*t[:,:3],axis=1)))))
        rapport['valeursFinies'] &= all(bool(np.all(np.isfinite(x))) for x in [p,n,t,uv])
        rapport['uvDansAtlas'] &= bool(np.all((uv>=0)&(uv<=1)))

rapport['imagesExternes']=all('uri' in i and 'bufferView' not in i and '/' not in i['uri'] for i in doc['images'])
rapport['noeudsUniques']=len({n['name'] for n in doc['nodes']})==len(doc['nodes'])
rapport['racineAnimee']=any(doc['nodes'][c['target']['node']]['name']=='racine' for a in doc['animations'] for c in a['channels'])
rapport['boucles']={}
rapport['dureesClipsMs']={a['name']:round(max(float(acc(s['input'])[-1,0]) for s in a['samplers'])*1000) for a in doc['animations']}
rapport['horsJeuTientPoseFinale']=all(np.array_equal(acc(s['output'])[-2],acc(s['output'])[-1]) for a in doc['animations'] if a['name']=='hors_jeu' for s in a['samplers'])
for animation in doc['animations']:
    if animation['name'] in ['repos','deplacement']:
        rapport['boucles'][animation['name']]=all(np.allclose(acc(animation['samplers'][c['sampler']]['output'])[0],acc(animation['samplers'][c['sampler']]['output'])[-1],atol=1e-7) or (c['target']['path']=='rotation' and np.allclose(acc(animation['samplers'][c['sampler']]['output'])[0],-acc(animation['samplers'][c['sampler']]['output'])[-1],atol=1e-7)) for c in animation['channels'])
masque=np.array(Image.open(sortie/f'{identifiant}_masque_equipe.png'))
albedo=np.array(Image.open(sortie/f'{identifiant}_albedo.png'))
selection=np.repeat(np.repeat(masque==255,2,axis=0),2,axis=1)
rapport['masqueValeurs']=[int(x) for x in np.unique(masque)]
rapport['albedoEquipeEcartMax']=int(np.max(np.ptp(albedo[selection],axis=1)))
rapport['metalCanalBIdentique']=bool(np.array_equal(np.array(Image.open(sortie/f'{identifiant}_rugosite.png'))[:,:,2],np.array(Image.open(sortie/f'{identifiant}_metal.png'))))
assert rapport['triangles']<=6000 and rapport['trianglesDegeneres']==0 and rapport['trianglesSuperposes']==0 and rapport['uvTrianglesDegeneres']==0 and rapport['normalesInversees']==0,rapport
assert rapport['valeursFinies'] and rapport['uvDansAtlas'] and rapport['imagesExternes'] and rapport['noeudsUniques'],rapport
assert rapport['normalesErreurMax']<1e-5 and rapport['tangentesErreurMax']<1e-5 and rapport['orthogonaliteErreurMax']<1e-5,rapport
assert not rapport['racineAnimee'] and all(rapport['boucles'].values()),rapport
assert rapport['dureesClipsMs']=={'repos':2400,'deplacement':1000,'touche':500,'hors_jeu':900} and rapport['horsJeuTientPoseFinale'],rapport
assert rapport['masqueValeurs']==[0,255] and rapport['albedoEquipeEcartMax']==0 and rapport['metalCanalBIdentique'],rapport
(sortie/'mesures-geometrie.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(rapport,ensure_ascii=False,indent=2))
# Pistes, canaux et mesures complémentaires relus dans le fichier exporté.
rapport['id']=identifiant
rapport['approbationArtistique']=False
rapport['noeuds']=sorted(n['name'] for n in doc['nodes'])
rapport['materiaux']=sorted(m['name'] for m in doc['materials'])
rapport['interpolationClips']=sorted({s.get('interpolation','LINEAR') for a in doc['animations'] for s in a['samplers']})
rapport['quaternionsUnitaires']=all(np.max(abs(np.linalg.norm(acc(a['samplers'][c['sampler']]['output']),axis=1)-1))<1e-6 for a in doc['animations'] for c in a['channels'] if c['target']['path']=='rotation')
rapport['tempsStrictementCroissants']=all(np.all(np.diff(acc(s['input'])[:,0])>0) for a in doc['animations'] for s in a['samplers'])
rapport['bornesTempsAnimationConservees']=all(doc['accessors'][s['input']]['componentType']==5126 and doc['accessors'][s['input']]['type']=='SCALAR' and all(k in doc['accessors'][s['input']] for k in ['min','max']) and np.allclose(doc['accessors'][s['input']].get('min',[]),[float(acc(s['input'])[0,0])]) and np.allclose(doc['accessors'][s['input']].get('max',[]),[float(acc(s['input'])[-1,0])]) for a in doc['animations'] for s in a['samplers'])
rapport['indicateurCacheFinHorsJeu']=any(np.array_equal(acc(a['samplers'][c['sampler']]['output'])[-1],np.zeros(3)) for a in doc['animations'] if a['name']=='hors_jeu' for c in a['channels'] if doc['nodes'][c['target']['node']]['name']=='socle' and c['target']['path']=='scale')

normal=np.array(Image.open(sortie/f'{identifiant}_normale.png')).astype(float)/127.5-1
rapport['normalePngLongueurErreurMax']=float(np.max(abs(np.linalg.norm(normal,axis=2)-1)))
rapport['normalePngZMinimum']=float(normal[:,:,2].min())
rapport['rugositeCanalGMinMax']=[int(x) for x in [np.array(Image.open(sortie/f'{identifiant}_rugosite.png'))[:,:,1].min(),np.array(Image.open(sortie/f'{identifiant}_rugosite.png'))[:,:,1].max()]]
assert {'base','corps','module_grue','racine','socle'}.issubset(rapport['noeuds']) and len(doc['materials'])==2
assert rapport['materiaux']==['mat_corps','mat_details'] and rapport['quaternionsUnitaires'] and rapport['tempsStrictementCroissants'] and rapport['bornesTempsAnimationConservees']
assert rapport['indicateurCacheFinHorsJeu']
assert rapport['normalePngLongueurErreurMax']<.008 and rapport['normalePngZMinimum']>0

# Recollement temporel des boucles : positions/rotations C0 et vitesses limites C1.
def vitesse_angulaire(a,b,dt):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);av=-a[:3];aw=a[3]
 v=aw*b[:3]+b[3]*av+np.cross(av,b[:3]);w=aw*b[3]-np.dot(av,b[:3])
 if w<0:v=-v;w=-w
 norme=np.linalg.norm(v)
 return np.zeros(3) if norme<1e-14 else v/norme*(2*np.arctan2(norme,w))/dt
rapport['continuitesBoucles']=[]
for a in doc['animations']:
 if a['name'] not in ['repos','deplacement']:continue
 for c in a['channels']:
  s=a['samplers'][c['sampler']];t=acc(s['input'])[:,0];v=acc(s['output']);rotation=c['target']['path']=='rotation'
  v0=vitesse_angulaire(v[0],v[1],t[1]-t[0]) if rotation else (v[1]-v[0])/(t[1]-t[0])
  v1=vitesse_angulaire(v[-2],v[-1],t[-1]-t[-2]) if rotation else (v[-1]-v[-2])/(t[-1]-t[-2])
  erreur=float(np.linalg.norm(v0-v1));assert erreur<2e-6,(a['name'],erreur)
  rapport['continuitesBoucles'].append({'clip':a['name'],'noeud':doc['nodes'][c['target']['node']]['name'],'canal':c['target']['path'],'erreurVitesseJointure':erreur,'unite':'rad/s' if rotation else 'm/s','poseRaccordeeModuloSigneQuaternion':True})
(sortie/'mesures-geometrie.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'canauxVerifies':True,'indicateurCacheFinHorsJeu':rapport['indicateurCacheFinHorsJeu']}))
