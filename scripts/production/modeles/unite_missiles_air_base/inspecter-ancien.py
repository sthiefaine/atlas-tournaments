#!/usr/bin/env python3
"""Inspection numérique préalable du candidat historique, sans rendu."""
from pathlib import Path
import json, struct, hashlib, sys
import numpy as np
from PIL import Image
ID='unite_missiles_air_base'
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('assets/livraisons')/ID
sortie=Path(sys.argv[2]) if len(sys.argv)>2 else Path('tmp/production-sequentielle')/ID
b=(source/f'{ID}_lod0.glb').read_bytes();l=struct.unpack_from('<I',b,12)[0]
d=json.loads(b[20:20+l]);binary=b[28+l:]
def acc(i):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt=np.dtype({5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]);return np.ndarray((a['count'],n),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',n*dt.itemsize),dt.itemsize)).astype(float)
r={'id':ID,'sha256Glb':hashlib.sha256(b).hexdigest(),'octetsGlb':len(b),'triangles':sum(len(acc(p['indices']))//3 for m in d['meshes'] for p in m['primitives']),'noeuds':[n['name'] for n in d['nodes']],'animations':[a['name'] for a in d['animations']],'textures':[],'controleVisuel':False,'importeDansCreation':False}
for p in sorted(source.glob('*.png')):
 im=Image.open(p);a=np.asarray(im)
 r['textures'].append({'fichier':p.name,'dimensions':list(im.size),'mode':im.mode,'octets':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'minimum':int(a.min()),'maximum':int(a.max()),'valeursDistinctes':int(np.unique(a).size)})
r['positionsLocalesFinies']=all(bool(np.isfinite(acc(p['attributes']['POSITION'])).all()) for m in d['meshes'] for p in m['primitives'])
r['bornesAccessoiresLocales']=[{'min':acc(p['attributes']['POSITION']).min(axis=0).tolist(),'max':acc(p['attributes']['POSITION']).max(axis=0).tolist()} for m in d['meshes'] for p in m['primitives']]
assert r['sha256Glb']=='1241976e5a1980b8cbe56ec9b5f5c0772025d7013e1b7259b03646b486aa53e8' and r['triangles']==884 and r['octetsGlb']==108020
sortie.mkdir(parents=True,exist_ok=True);(sortie/'inspection-ancien-candidat.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'triangles':r['triangles'],'octets':len(b),'pngInspectes':len(r['textures']),'sha':r['sha256Glb']}))
