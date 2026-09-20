#!/usr/bin/env python3
"""Relit les sommets et clips du GLB final. NumPy seulement, aucun rendu."""
from pathlib import Path
import json, struct, sys
import numpy as np

identifiant='unite_meridien_veilleur_base'
sortie=Path(sys.argv[1] if len(sys.argv)>1 else f'tmp/production-sequentielle/{identifiant}')
brut=(sortie/f'{identifiant}_lod0.glb').read_bytes()
longueur=struct.unpack_from('<I',brut,12)[0]
doc=json.loads(brut[20:20+longueur]); binaire=brut[28+longueur:]

def acc(i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
    largeur={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    p=v.get('byteOffset',0)+a.get('byteOffset',0)
    pas=v.get('byteStride',largeur*np.dtype(dtype).itemsize)
    return np.ndarray((a['count'],largeur),dtype=dtype,buffer=binaire,offset=p,strides=(pas,np.dtype(dtype).itemsize)).astype(float)

def rotation(q):
    x,y,z,w=q/np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])

def interpoler(temps,valeurs,t,quaternion):
    if t<=temps[0]:return valeurs[0]
    if t>=temps[-1]:return valeurs[-1]
    j=int(np.searchsorted(temps,t));u=(t-temps[j-1])/(temps[j]-temps[j-1]);a,b=valeurs[j-1],valeurs[j]
    if not quaternion:return (1-u)*a+u*b
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);cos=float(np.dot(a,b))
    if cos<0:b=-b;cos=-cos
    if cos>.9995:
        q=(1-u)*a+u*b;return q/np.linalg.norm(q)
    angle=np.arccos(np.clip(cos,-1,1));return (np.sin((1-u)*angle)*a+np.sin(u*angle)*b)/np.sin(angle)

parents={c:i for i,n in enumerate(doc['nodes']) for c in n.get('children',[])}
noeuds={n['name']:i for i,n in enumerate(doc['nodes'])}
points={}
for i,n in enumerate(doc['nodes']):
    if 'mesh' not in n:continue
    for p in doc['meshes'][n['mesh']]['primitives']:
        position=acc(p['attributes']['POSITION'])
        if 'skin' not in n:
            points.setdefault(i,[]).append(position);continue
        peau=doc['skins'][n['skin']];indices=acc(p['attributes']['JOINTS_0']).astype(int);poids=acc(p['attributes']['WEIGHTS_0'])
        assert np.all(poids==np.array([1,0,0,0]))
        inverses=acc(peau['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        for k,os in enumerate(peau['joints']):
            pos=position[indices[:,0]==k];m=inverses[k]
            if len(pos):points.setdefault(os,[]).append(pos@m[:3,:3].T+m[:3,3])
points={i:np.concatenate(ps) for i,ps in points.items()}
# Hypothèses explicites de la majoration : parents sans échelle et corps
# sans déplacement horizontal. La seule contraction autorisée est le témoin.
assert all(np.array_equal(np.array(n.get('scale',[1,1,1])),np.ones(3)) for n in doc['nodes'])
assert np.all(np.array(doc['nodes'][noeuds['corps']].get('translation',[0,0,0]))[[0,2]]==0)
for a in doc['animations']:
    for c in a['channels']:
        if c['target']['path']=='scale':assert c['target']['node']==noeuds['socle']
        if c['target']['node']==noeuds['corps'] and c['target']['path']=='translation':assert np.all(acc(a['samplers'][c['sampler']]['output'])[:,[0,2]]==0)

def calculer(surcharges):
    resultat={}
    def monde(i):
        if i in resultat:return resultat[i]
        n=doc['nodes'][i];p={**n,**surcharges.get(i,{})}
        if 'matrix' in p and i not in surcharges:m=np.array(p['matrix']).reshape(4,4).T
        else:
            m=np.eye(4);m[:3,:3]=rotation(np.array(p.get('rotation',[0,0,0,1])))*np.array(p.get('scale',[1,1,1]))[None,:];m[:3,3]=p.get('translation',[0,0,0])
        if i in parents:m=monde(parents[i])@m
        resultat[i]=m;return m
    for i in range(len(doc['nodes'])):monde(i)
    sommets=np.concatenate([p@resultat[i][:3,:3].T+resultat[i][:3,3] for i,p in points.items()])
    return sommets,resultat
