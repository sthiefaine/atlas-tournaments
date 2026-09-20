#!/usr/bin/env python3
"""Relit les sommets et clips du GLB final. NumPy seulement, aucun rendu."""
from pathlib import Path
import json, struct, sys
import numpy as np

identifiant='unite_bombardier_base'
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
points={i:np.concatenate([acc(p['attributes']['POSITION']) for p in doc['meshes'][n['mesh']]['primitives']]) for i,n in enumerate(doc['nodes']) if 'mesh' in n}

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
    canon=-resultat[noeuds['base']][:3,1];canon/=np.linalg.norm(canon)
    return sommets,canon,resultat

clips=[]
for a in doc['animations']:
    canaux=[];duree=0;instants=[]
    for c in a['channels']:
        s=a['samplers'][c['sampler']];assert s.get('interpolation','LINEAR')=='LINEAR'
        t=acc(s['input'])[:,0];v=acc(s['output']);duree=max(duree,float(t[-1]));instants.extend(t)
        canaux.append((c['target']['node'],c['target']['path'],t,v))
    instants=sorted(set(instants+list(np.linspace(0,duree,193))))
    minimum=np.full(3,np.inf);maximum=np.full(3,-np.inf);rayon=0;direction=1
    for t in instants:
        pose={}
        for i,canal,temps,valeurs in canaux:pose.setdefault(i,{})[canal]=interpoler(temps,valeurs,t,canal=='rotation')
        sommets,canon,matrices=calculer(pose)
        minimum=np.minimum(minimum,sommets.min(axis=0));maximum=np.maximum(maximum,sommets.max(axis=0));rayon=max(rayon,float(np.linalg.norm(sommets[:,[0,2]],axis=1).max()));direction=min(direction,float(-canon[1]))
        assert np.array_equal(matrices[noeuds['racine']],np.eye(4)), 'Racine non identité'
    assert rayon<.5 and minimum[1]>-1e-6
    if a['name']=='tir':assert direction>.99
    clips.append({'nom':a['name'],'nombreEchantillons':len(instants),'enveloppe':{'min':minimum.tolist(),'max':maximum.tolist()},'rayonHorizontalMax':rayon,'directionMarqueurBasMin':direction,'racineIdentite':True})
fabrication=json.loads((sortie/'mesures-mouvements.json').read_text())
for a,b in zip(clips,fabrication['clips']):
    assert a['nom']==b['nom'] and abs(a['rayonHorizontalMax']-b['rayonHorizontalMax'])<2e-6
    assert np.max(np.abs(np.array(a['enveloppe']['min'])-np.array(b['enveloppe']['min'])))<2e-6
    assert np.max(np.abs(np.array(a['enveloppe']['max'])-np.array(b['enveloppe']['max'])))<2e-6
rapport={'id':identifiant,'methode':'Relecture GLB NumPy : sommets, translations LINEAR et rotations slerp ; 193 instants et toutes clés. Comparaison aux mesures Three.js avant export à 2 µm près.','clips':clips,'limites':['Contrôle numérique sans rendu ni approbation artistique.','Sol mesuré aux échantillons ; rayon continu majoré séparément dans mesures-mouvements.json.','Chaque clip lu séparément ; mélanges entre clips non mesurés.','Les collisions internes ne sont pas certifiées par cette mesure d’enveloppe.']}
(sortie/'mesures-poses-glb.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'clips':len(clips),'poses':sum(c['nombreEchantillons'] for c in clips),'rayonHorizontalMax':max(c['rayonHorizontalMax'] for c in clips),'pariteExport':True}))
