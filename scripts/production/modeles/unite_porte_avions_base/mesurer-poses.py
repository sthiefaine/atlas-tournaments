#!/usr/bin/env python3
"""Relit les sommets et clips du GLB final. NumPy seulement, aucun rendu."""
from pathlib import Path
import json, struct, sys
import numpy as np

identifiant='unite_porte_avions_base'
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
# Hypothèses explicites de la majoration : parents sans échelle et corps
# sans déplacement horizontal. La seule contraction autorisée est le témoin.
assert all(np.array_equal(np.array(n.get('scale',[1,1,1])),np.ones(3)) for n in doc['nodes'])
decalage_horizontal=np.linalg.norm(np.array(doc['nodes'][noeuds['corps']].get('translation',[0,0,0]))[[0,2]])
for a in doc['animations']:
    for c in a['channels']:
        if c['target']['path']=='scale':assert c['target']['node']==noeuds['socle']
        if c['target']['node']==noeuds['corps'] and c['target']['path']=='translation':assert np.allclose(acc(a['samplers'][c['sampler']]['output'])[:,[0,2]],np.array(doc['nodes'][noeuds['corps']]['translation'])[[0,2]])

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

def norme_max_translation(i):
    v=[np.array(doc['nodes'][i].get('translation',[0,0,0]))]
    for a in doc['animations']:
        for c in a['channels']:
            if c['target']['node']==i and c['target']['path']=='translation':v.extend(acc(a['samplers'][c['sampler']]['output']))
    return max(float(np.linalg.norm(p)) for p in v)

def bras_levier(cible,descendant):
    r=float(np.linalg.norm(points[descendant],axis=1).max())
    i=descendant
    while i!=cible:
        r+=norme_max_translation(i)
        if i not in parents:return None
        i=parents[i]
    return r

def vitesse_limite(canaux):
    # Bornes par nœud sur chaque intervalle LINEAR/slerp ; triangle inequality.
    vitesses=[]
    for i,canal,temps,valeurs in canaux:
        dt=np.diff(temps)
        if canal=='rotation':
            q=valeurs/np.linalg.norm(valeurs,axis=1)[:,None]
            angle=2*np.arccos(np.clip(abs(np.sum(q[:-1]*q[1:],axis=1)),0,1))
            vitesses.append((i,canal,float(np.max(angle/dt))))
        elif canal=='translation':vitesses.append((i,canal,float(np.max(np.linalg.norm(np.diff(valeurs,axis=0),axis=1)/dt))))
        elif canal=='scale':
            # Seul socle diminue uniformément vers son pivot : son rayon reste
            # sous le rayon du segment pivot-sommet à taille entière. Son pivot
            # reste inclus dans la boîte corporelle et est mesuré séparément.
            assert np.all(valeurs>=0) and np.all(valeurs<=1) and np.all(valeurs==valeurs[:,0,None])
    limite=0
    for descendant in points:
        if descendant==noeuds['socle']:continue  # Borne analytique séparée, indépendante du scale.
        total=0
        for i,canal,v in vitesses:
            levier=bras_levier(i,descendant)
            if levier is not None:total+=v*(levier if canal=='rotation' else 1)
        limite=max(limite,total)
    return limite

# Le témoin reste dans la sphère centrée au pivot corps : rayon local + distance du pivot.
# Le pivot corps n’a aucun déplacement horizontal ; contraction uniforme 0..1.
borne_temoin=decalage_horizontal+norme_max_translation(noeuds['socle'])+float(np.linalg.norm(points[noeuds['socle']],axis=1).max())
assert borne_temoin<.5
clips=[]
for a in doc['animations']:
    canaux=[];duree=0;instants=[]
    for c in a['channels']:
        s=a['samplers'][c['sampler']];assert s.get('interpolation','LINEAR')=='LINEAR'
        t=acc(s['input'])[:,0];v=acc(s['output']);duree=max(duree,float(t[-1]));instants.extend(t)
        canaux.append((c['target']['node'],c['target']['path'],t,v))
    instants=sorted(set(instants+list(np.linspace(0,duree,193))))
    minimum=np.full(3,np.inf);maximum=np.full(3,-np.inf);rayon=0
    for t in instants:
        pose={}
        for i,canal,temps,valeurs in canaux:pose.setdefault(i,{})[canal]=interpoler(temps,valeurs,t,canal=='rotation')
        sommets,matrices=calculer(pose)
        minimum=np.minimum(minimum,sommets.min(axis=0));maximum=np.maximum(maximum,sommets.max(axis=0));rayon=max(rayon,float(np.linalg.norm(sommets[:,[0,2]],axis=1).max()))
        assert np.array_equal(matrices[noeuds['racine']],np.eye(4)), 'Racine non identité'
    vitesse=vitesse_limite(canaux);borne=max(borne_temoin,rayon+max(np.diff(instants))/2*vitesse)
    assert borne<.5 and minimum[1]>-1e-6,(a['name'],borne,minimum)
    clips.append({'nom':a['name'],'nombreEchantillons':len(instants),'enveloppe':{'min':minimum.tolist(),'max':maximum.tolist()},'rayonHorizontalMax':rayon,'vitesseMajoreeMetresSeconde':vitesse,'rayonHorizontalMajorationContinue':borne,'espacementMinimumVoisinsTousCaps':1-2*borne,'racineIdentite':True})
fabrication=json.loads((sortie/'mesures-poses-three-glb.json').read_text())
for a,b in zip(clips,fabrication['clips']):
    assert a['nom']==b['nom'] and abs(a['rayonHorizontalMax']-b['rayonHorizontalMax'])<2e-6
    assert np.max(np.abs(np.array(a['enveloppe']['min'])-np.array(b['enveloppe']['min'])))<2e-6
    assert np.max(np.abs(np.array(a['enveloppe']['max'])-np.array(b['enveloppe']['max'])))<2e-6
# Bornes statiques reconstituées du GLB pour vérifier le contrat d’échelle.
sommets,matrices=calculer({})
mini,maxi=sommets.min(axis=0),sommets.max(axis=0)
dimensions=maxi-mini
assert np.all(abs(dimensions-np.array([.70,.58,.95]))<np.array([.08,.08,.08]))
rapport={'id':identifiant,'methode':'Relecture GLB NumPy : sommets, translations LINEAR et rotations slerp ; 193 instants et toutes clés. Comparaison aux mesures Three.js du GLB exporté à 2 µm près. Majoration continue de toute géométrie sauf témoin par vitesse maximale de translation/slerp et demi-pas. Le témoin rétractable est majoré par sa sphère locale autour de la chaîne corps sans translation horizontale animée.','clips':clips,'borneAnalytiqueTemoin':borne_temoin,'bornesStatiques':{'min':mini.tolist(),'max':maxi.tolist(),'dimensions':dimensions.tolist()},'portee':'GLB neutre, gabarit runtime b=[1,1,1] ; gabarit a=[.9,.98,1.06] contrôlé séparément dans mesures-gabarit-a.json ; c non certifié.','limites':['Contrôle numérique sans rendu ni approbation artistique.','Sol mesuré aux échantillons ; rayon majoré continûment.','Chaque clip lu séparément ; mélanges entre clips non mesurés.','Les collisions internes ne sont pas certifiées par cette mesure d’enveloppe.','La déformation a a sa borne séparée ; aucune borne n’est fournie pour c.']}
(sortie/'mesures-poses-glb.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'clips':len(clips),'poses':sum(c['nombreEchantillons'] for c in clips),'rayonHorizontalMax':max(c['rayonHorizontalMax'] for c in clips),'rayonHorizontalMajorationContinue':max(c['rayonHorizontalMajorationContinue'] for c in clips),'pariteExport':True,'dimensions':dimensions.tolist()}))
