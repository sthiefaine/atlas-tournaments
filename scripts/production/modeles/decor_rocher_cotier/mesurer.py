#!/usr/bin/env python3
"""Mesures ciblées du GLB exporté ; aucun rendu ni certification esthétique."""
from pathlib import Path
from collections import Counter
import json, struct, hashlib
import numpy as np
from PIL import Image
ID='decor_rocher_cotier';OUT=Path('tmp/production-sequentielle')/ID
b=(OUT/f'{ID}_lod0.glb').read_bytes();l=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+l]);binary=b[28+l:];fab=json.loads((OUT/'fabrication.json').read_text())
def acc(i):
 a=d['accessors'][i];view=d['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];dt=np.dtype({5123:'<u2',5126:'<f4'}[a['componentType']]);return np.ndarray((a['count'],n),dtype=dt,buffer=binary,offset=view.get('byteOffset',0)+a.get('byteOffset',0),strides=(view.get('byteStride',n*dt.itemsize),dt.itemsize)).copy()
p=d['meshes'][0]['primitives'][0];P=acc(p['attributes']['POSITION']).astype(float);N=acc(p['attributes']['NORMAL']);UV=acc(p['attributes']['TEXCOORD_0']);T=acc(p['attributes']['TANGENT']);I=acc(p['indices']).reshape(-1,3);ps=P[I];norm=np.cross(ps[:,1]-ps[:,0],ps[:,2]-ps[:,0]);area=np.linalg.norm(norm,axis=1)/2;norm/=np.linalg.norm(norm,axis=1,keepdims=True)
assert np.isfinite(P).all() and area.min()>1e-8
assert np.max(np.abs(np.linalg.norm(N,axis=1)-1))<1e-6
assert np.min(np.sum(N[I]*norm[:,None,:],axis=2))>.60
assert np.max(np.abs(np.sum(N*T[:,:3],axis=1)))<1e-6
assert np.max(np.abs(np.linalg.norm(T[:,:3],axis=1)-1))<1e-6
assert np.all(np.abs(T[:,3])==1)
# UV non dégénérées, marge d'îlots, accesseurs POSITION bornés.
uvtri=UV[I];uvA=uvtri[:,1]-uvtri[:,0];uvB=uvtri[:,2]-uvtri[:,0];uvArea=np.abs(uvA[:,0]*uvB[:,1]-uvA[:,1]*uvB[:,0])/2
assert uvArea.min()>1e-9
for part in fab['pieces']:
 start=part['firstTriangle'];end=start+part['triangles'];fi=part['patch'];uv=UV[I[start:end]].reshape(-1,2);origin=np.array([fi%4,fi//4])/4
 assert np.all(uv>=origin+8/512-1e-7) and np.all(uv<=origin+.25-8/512+1e-7)
posAcc=d['accessors'][p['attributes']['POSITION']];assert np.allclose(posAcc['min'],P.min(0),atol=1e-8) and np.allclose(posAcc['max'],P.max(0),atol=1e-8)
def closed(tris,name):
 edges=Counter();oriented=Counter();signed=0
 for tr in tris:
  keys=[tuple(np.round(v,7)) for v in tr]
  for i in range(3):
   a,b=keys[i],keys[(i+1)%3];edges[tuple(sorted((a,b)))]+=1;oriented[(a,b)]+=1
  signed+=np.dot(tr[0],np.cross(tr[1],tr[2]))/6
 assert all(n==2 for n in edges.values()),(name,'bord ouvert')
 assert all(oriented[(a,b)]==oriented[(b,a)]==1 for a,b in edges),(name,'sens incohérent')
 assert signed>0,(name,'volume inversé')
 return {'nom':name,'triangles':len(tris),'aretesSoudees':len(edges),'incidenceAretes':2,'sensCoherent':True,'volumeSigneM3':signed,'ferme':True}
closedResults=[closed(ps[:fab['trianglesBloc']],'bloc')]
shift=np.array(fab['decalageCentrage']);planes=fab['plans'];A=np.array([x['normale'] for x in planes]);D=np.array([x['distance'] for x in planes]);lens=np.linalg.norm(A,axis=1)
assert np.max(((ps[:fab['trianglesBloc']]+shift)@A.T-D)/lens)<1e-7
contacts=[];barn_parts=[p for p in fab['pieces'] if p['type']=='balane']
for part in barn_parts:
 start=part['firstTriangle'];end=start+part['triangles'];points=ps[start:end].reshape(-1,3)+shift;closedResults.append(closed(ps[start:end],part['name']))
 n=np.array(part['normale']);c=np.array(part['centre']);depth=(points-c)@n;assert abs(depth.min()+.0015)<1e-7 and abs(depth.max()-part['hauteur'])<1e-7
 # L'intégralité du disque basal se trouve à l'intérieur du pan plan, avant le chanfrein.
 base=points[depth<-.0014];support=fab['facesSupport'][part['faceSupport']];poly=np.array(support['contour']);margins=[]
 for a,b in zip(poly,np.roll(poly,-1,axis=0)):
  tangent=(b-a)/np.linalg.norm(b-a);margins.append(np.cross(tangent,base-a)@n)
 edge_clearance=float(np.min(margins));assert edge_clearance>.001,(part['name'],edge_clearance)
 # Le fond de la coupe est au-dessus du support : véritable creux fermé, sans surface flottante.
 assert np.min(points[:,1])>.003
 other=(D-points@A.T)/lens;other=np.delete(other,part['faceSupport'],axis=1);assert other.min()>.002
 # Le cylindre radial définit le dehors ; les parois de la coupe regardent le dedans.
 centers=ps[start:end].mean(1)+shift;radial=centers-c;radial-=np.outer(radial@n,n);radial/=np.maximum(np.linalg.norm(radial,axis=1,keepdims=True),1e-12)
 radial_score=np.sum(norm[start:end]*radial,axis=1);assert radial_score[:24].min()>.2 and radial_score[24:36].max()<-.2
 assert (norm[start+36:start+42]@n).min()>.999999 and (norm[start+42:start+48]@(-n)).min()>.999999
 contacts.append({'normalesParoiExterieureRadialesMin':float(radial_score[:24].min()),'normalesParoiInterieureRadialesMax':float(radial_score[24:36].max()),'nom':part['name'],'support':support['nom'],'enfoncementM':float(-depth.min()),'saillieM':float(depth.max()),'retraitFondCoupeSousLeBordM':part['hauteur']*.75,'gardeBaseBordFaceM':edge_clearance,'gardeAutresPlansM':float(other.min()),'yMin':float(points[:,1].min()),'yMax':float(points[:,1].max())})
separations=[]
for a,b in __import__('itertools').combinations(barn_parts,2):
 ra=np.sqrt(a['rayon']**2+a['hauteur']**2);rb=np.sqrt(b['rayon']**2+b['hauteur']**2);distance=np.linalg.norm(np.array(a['centre'])-b['centre'])-ra-rb
 assert distance>.001,(a['name'],b['name'],distance)
 separations.append({'noms':[a['name'],b['name']],'gardeSpheresM':float(distance)})
def top(x,z):
 heights=[]
 for tri in ps[:fab['trianglesBloc']]:
  mat=np.array([[tri[1,0]-tri[0,0],tri[2,0]-tri[0,0]],[tri[1,2]-tri[0,2],tri[2,2]-tri[0,2]]])
  if abs(np.linalg.det(mat))<1e-12:continue
  weights=np.linalg.solve(mat,[x-tri[0,0],z-tri[0,2]])
  if min(weights)>=-1e-8 and sum(weights)<=1+1e-8: heights.append(tri[0,1]+weights@(tri[1:,1]-tri[0,1]))
 return max(heights) if heights else 0
profiles=[]
for q in range(4):
 t=q*np.pi/2;rot=np.array([[np.cos(t),-np.sin(t)],[np.sin(t),np.cos(t)]])
 samples=[top(*(rot@np.array([x,z]))) for x,z in [(-.12,.10),(.00,.15),(.12,.10),(-.12,-.10),(.10,-.12)]]
 profiles.append({'quartTour':q,'hauteursM':samples})
diffs=[{'quarts':[a,b],'ecartMaxM':float(np.max(np.abs(np.array(profiles[a]['hauteursM'])-profiles[b]['hauteursM'])))} for a in range(4) for b in range(a+1,4)]
assert min(x['ecartMaxM'] for x in diffs)>.020
normal=np.asarray(Image.open(OUT/f'{ID}_normale.png')).astype(float)/255*2-1;rough=np.asarray(Image.open(OUT/f'{ID}_rugosite.png'));assert (rough[:,:,2]==0).all();assert normal[:,:,2].min()>.9
bounds={'min':P.min(0).tolist(),'max':P.max(0).tolist(),'dimensions':np.ptp(P,axis=0).tolist()};assert abs(P[:,1].min())<1e-9;assert np.max(np.abs((P.min(0)+P.max(0))[[0,2]]))<1e-7
assert np.all(np.abs(np.ptp(P,axis=0)-[.45,.30,.45])<=.08)
# Les grands pans restent plans, les normales des chanfreins rejoignent celles des pans.
planarity=[]
for part in fab['pieces']:
 if part['type']!='plan':continue
 start=part['firstTriangle'];end=start+part['triangles'];points=ps[start:end].reshape(-1,3)+shift;f=fab['facesSupport'][part['patch']];nn=np.array(f['normale']);origin=np.array(f['contour'][0]);error=float(np.abs((points-origin)@nn).max());assert error<1e-7
 planarity.append({'nom':part['name'],'ecartPlanMaxM':error})
report={'id':ID,'sha256Glb':hashlib.sha256((OUT/f'{ID}_lod0.glb').read_bytes()).hexdigest(),'triangles':len(ps),'primitives':len(d['meshes'][0]['primitives']),'materiaux':len(d['materials']),'animations':len(d.get('animations',[])),'noeuds':[n['name'] for n in d['nodes']],'bornes':bounds,'rayonHorizontalMaxM':float(np.linalg.norm(P[:,[0,2]],axis=1).max()),'trianglesAireMinM2':float(area.min()),'normalesAccordFacesMin':float(np.min(np.sum(N[I]*norm[:,None,:],axis=2))),'tangentesOrthogonales':True,'uv':{'minimum':UV.min(0).tolist(),'maximum':UV.max(0).tolist(),'aireMin':float(uvArea.min()),'margePixels512':8,'ilots':len(fab['atlas']['patches']),'balanesPartagentUnIlot':True},'fermeture':closedResults,'plansDeFracture':planarity,'attachesBalanes':contacts,'separationsBalanes':{'paires':len(separations),'minimumM':min(x['gardeSpheresM'] for x in separations),'methode':'Distance entre centres moins deux sphères englobantes, toutes les paires.'},'quartsTour':{'profils':profiles,'distances':diffs,'limite':'Hauteurs de cinq sondes différentes pour chaque quart, pas de jugement de lisibilité.'},'imagesEmbarquees':sum('bufferView' in x for x in d['images']),'textures':{'metalliqueMax':int(rough[:,:,2].max()),'normalesLongueurMin':float(np.linalg.norm(normal,axis=-1).min()),'normalesLongueurMax':float(np.linalg.norm(normal,axis=-1).max()),'normaleZMin':float(normal[:,:,2].min())},'controleVisuel':False,'approbationArtistique':False,'fpsTelephone':None,'limites':['Contrôles ciblés de fermeture, orientation, plans et implantation des balanes ; aucune inspection visuelle.','La base de chaque balane traverse volontairement le pan de support de 1,5 mm.','Continuité artistique aux coutures UV non jugée.','Aucun rendu, FPS téléphone, test général ni build.']}
(OUT/'mesures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'triangles':len(ps),'volumesFermes':len(closedResults),'balanes':len(contacts),'gardeBaseBordMinM':min(x['gardeBaseBordFaceM'] for x in contacts),'diffQuartsMinM':min(x['ecartMaxM'] for x in diffs),'controle':'ok'}))
