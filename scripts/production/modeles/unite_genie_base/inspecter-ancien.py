#!/usr/bin/env python3
"""Inspection de provenance binaire, sans rendu ni import de géométrie."""
import hashlib
import json
from pathlib import Path
import struct
import sys
import numpy as np
from PIL import Image

identifiant = 'unite_genie_base'
source = Path(sys.argv[1] if len(sys.argv)>1 else f'assets/livraisons/{identifiant}')
sortie = Path(f'tmp/production-sequentielle/{identifiant}')
modele = source/f'{identifiant}_lod0.glb'
brut = modele.read_bytes()
n = struct.unpack_from('<I', brut, 12)[0]
doc = json.loads(brut[20:20+n])
empreinte = hashlib.sha256(brut).hexdigest()
assert empreinte == 'ce2760c103f02ad596052d8e74bffcc2311c08b0b648e5b7c0759989cdec5ed9', 'Ancien candidat modifié'
rapport = {'id':identifiant,'sha256Glb':empreinte,'octetsGlb':len(brut),'triangles':sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives']), 'noeuds':[n.get('name') for n in doc['nodes']], 'materiaux':[m.get('name') for m in doc['materials']], 'animations':[a['name'] for a in doc['animations']], 'primitives':[{'attributs':list(p['attributes']),'bornesLocales':{k:doc['accessors'][p['attributes']['POSITION']].get(k) for k in ['min','max']}} for m in doc['meshes'] for p in m['primitives']], 'png':[], 'geometrieEtTexturesImportees':False,'inspectionVisuelle':False}
for p in sorted(source.glob('*.png')):
    img=Image.open(p); valeurs=np.asarray(img)
    r={'nom':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'octets':p.stat().st_size,'resolution':list(img.size),'mode':img.mode,'valeurMin':int(valeurs.min()),'valeurMax':int(valeurs.max())}
    if 'masque' in p.name:r['valeurs']=np.unique(valeurs).tolist()
    rapport['png'].append(r)
sortie.mkdir(parents=True,exist_ok=True)
(sortie/'inspection-ancien-candidat.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['sha256Glb','octetsGlb','triangles','noeuds','materiaux','animations']},ensure_ascii=False))
