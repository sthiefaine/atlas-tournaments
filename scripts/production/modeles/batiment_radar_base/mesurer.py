#!/usr/bin/env python3
"""Contrôle ciblé du GLB/PNG final, pièces et animations, sans moteur de rendu."""
from geometrie import *
from PIL import Image
import hashlib

def cross2(a,b):return a[:,0]*b[:,1]-a[:,1]*b[:,0]

_,repos=calculer({})
pieces={}
nbtri=0;degenerate=0;uvdeg=0;normdot=1;uvmin=1;uvmax=0;normalerr=0;tangenterr=0
for ni,n in enumerate(doc['nodes']):
 if 'mesh' not in n:continue
 mesh=doc['meshes'][n['mesh']];infos=n['extras']['pieces']
 for pi,p in enumerate(mesh['primitives']):
  ids=acc(p['indices']).astype(int).ravel();v=acc(p['attributes']['POSITION']);norm=acc(p['attributes']['NORMAL']);uv=acc(p['attributes']['TEXCOORD_0']);tang=acc(p['attributes']['TANGENT']);t=v[ids].reshape(-1,3,3);u=uv[ids].reshape(-1,3,2)
  assert all(np.isfinite(a).all() for a in [v,norm,uv,tang]);assert np.all((uv>=0)&(uv<=1));assert np.max(ids)<len(v)
  cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);areas=np.linalg.norm(cross,axis=1);degenerate+=int((areas<1e-12).sum());uvdeg+=int((abs(cross2(u[:,1]-u[:,0],u[:,2]-u[:,0]))<1e-10).sum())
  nd=np.sum(cross/areas[:,None]*norm[ids].reshape(-1,3,3).mean(axis=1),axis=1);normdot=min(normdot,float(nd.min()));normalerr=max(normalerr,float(abs(np.linalg.norm(norm,axis=1)-1).max()));tangenterr=max(tangenterr,float(abs(np.linalg.norm(tang[:,:3],axis=1)-1).max()));uvmin=min(uvmin,float(uv.min()));uvmax=max(uvmax,float(uv.max()));nbtri+=len(t)
  for info in infos:
   if info['primitive']!=pi:continue
   local=t[info['triangleDebut']:info['triangleDebut']+info['triangles']];world=local@repos[ni][:3,:3].T+repos[ni][:3,3]
   pieces[info['nom']]={'node':ni,'role':info['role'],'local':local,'triangles':world,'uv':u[info['triangleDebut']:info['triangleDebut']+info['triangles']]}
assert nbtri<=5000 and degenerate==0 and uvdeg==0 and normdot>0 and normalerr<1e-6 and tangenterr<1e-5,(nbtri,degenerate,uvdeg,normdot,normalerr,tangenterr)

def distance(a,b):
 a=pieces[a]['triangles'];b=pieces[b]['triangles'];aa=np.repeat(a,len(b),axis=0);bb=np.tile(b,(len(a),1,1));ds=[]
 for j in range(3):
  ds.append(point_triangle(aa[:,j],bb));ds.append(point_triangle(bb[:,j],aa))
  if traverse(aa[:,j],aa[:,(j+1)%3],bb).any() or traverse(bb[:,j],bb[:,(j+1)%3],aa).any():return 0.
  for k in range(3):ds.append(segments_distance(aa[:,j],aa[:,(j+1)%3],bb[:,k],bb[:,(k+1)%3]))
 return float(np.min(ds))


raccords=[('dalle_rampee','soubassement'),('soubassement','cabine'),('cabine','toiture'),('cabine','cadre_vitrage'),('cadre_vitrage','vitrage_avant'),('vitrage_avant','meneau_avant'),('cabine','cadre_porte'),('cadre_porte','porte'),('porte','vitrage_porte'),('porte','poignee'),('dalle_rampee','seuil'),('toiture','rive_equipe'),('toiture','fond_glissiere'),('fond_glissiere','indicateur_capture'),('toiture','embase_moteur'),('embase_moteur','roulement_fixe'),('roulement_fixe','couronne_mobile'),('couronne_mobile','traverse_berceau'),('axe_elevation','moyeu_parabole'),('moyeu_parabole','parabole_dos'),('parabole_concave','chant_parabole'),('parabole_dos','chant_parabole'),('chant_parabole','couronne_parabole'),('recepteur','bouche_recepteur'),('cabine','coffret_ventilation'),('coffret_ventilation','fond_ventilation'),('cabine','trappe_service')]
for side in [-1,1]:raccords.extend([('traverse_berceau',f'montant_berceau_{side}'),(f'montant_berceau_{side}',f'palier_{side}'),(f'palier_{side}','axe_elevation')])
for j in range(3):raccords.extend([('couronne_parabole',f'bras_recepteur_{j}'),(f'bras_recepteur_{j}','recepteur')])
for j in range(6):raccords.extend([('moyeu_parabole',f'nervure_{j}_0'),(f'nervure_{j}_0',f'nervure_{j}_1'),(f'nervure_{j}_1','parabole_dos')])
for j in range(5):raccords.append(('fond_ventilation',f'lame_ventilation_{j}'))
for x in [-.275,.275]:raccords.extend([('cabine',f'support_indicateur_{x}'),(f'support_indicateur_{x}',f'lentille_{x}')])
rac=[{'a':a,'b':b,'distanceMetres':distance(a,b)} for a,b in raccords]
assert all(x['distanceMetres']<.0007 for x in rac),[x for x in rac if x['distanceMetres']>=.0007]

# Winding du réflecteur dans son repère incliné, puis fermeture exacte du seul bol.
q=np.array([np.sin(-.42/2),0,0,np.cos(-.42/2)]);rd=rotation(q);centre=np.array([.015,.498,-.170])
def dish(n):return (pieces[n]['triangles']-centre)@rd
shell=[];wind={}
for n,sign in [('parabole_concave',1),('parabole_dos',-1)]:
 t=dish(n);cross=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);norm=cross/np.linalg.norm(cross,axis=1)[:,None];dot=sign*norm[:,2];assert dot.min()>.85;wind[n]=float(dot.min());shell.append(t)
 v=t.reshape(-1,3);r=np.linalg.norm(v[:,:2],axis=1);expected=.070*(r/.245)**2-(.018 if sign==-1 else 0);assert abs(v[:,2]-expected).max()<5e-8
shell.append(dish('chant_parabole'))
edges={}
for t in np.concatenate(shell):
 keys=[tuple(np.round(v,6)) for v in t]
 for j in range(3):
  e=tuple(sorted([keys[j],keys[(j+1)%3]]));edges[e]=edges.get(e,0)+1
assert set(edges.values())=={2},'Coque non fermée'
# Sondes dans le volume vide devant le fond du réflecteur, hors bras/récepteur voulus.
allradar=np.concatenate([p['triangles'] for p in pieces.values() if p['node']==noeuds['radar']]);probes=0
for r in [.075,.120]:
 for j in range(8):
  a=(j+.2)*2*np.pi/8;start=np.array([r*np.cos(a),r*np.sin(a),.027]);end=start.copy();end[2]=.140
  aa=start@rd.T+centre;bb=end@rd.T+centre
  assert not traverse(np.broadcast_to(aa,(len(allradar),3)),np.broadcast_to(bb,(len(allradar),3)),allradar).any();probes+=1
# Aucune nervure dorsale ne dépasse la face concave : points de la surface du tube.
rib=np.concatenate([dish(n) for n in pieces if n.startswith('nervure_')]).reshape(-1,3)
clearance_ribs=.070*np.sum(rib[:,:2]**2,axis=1)/.245**2-rib[:,2];assert clearance_ribs.min()>.003

# Tout le front, depuis Z .140, est dégagé au-dessus du sol de 38 mm.
for n,p in pieces.items():
 if n=='dalle_rampee':continue
 assert p['triangles'][:,:,2].max()<.140,n
ground=pieces['dalle_rampee']['triangles'].reshape(-1,3)
assert abs(ground[:,1].min())<1e-8 and abs(ground[ground[:,2]>.429,1].max()-.002)<1e-7
assert abs(ground[(ground[:,2]>.329)&(ground[:,2]<.331),1].max()-.038)<1e-7

clips=[];poses_total=0;jeu_rails=1;jeu_butees=1
for clip in doc['animations']:
 canaux=[];keys=[];duration=0
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];a=doc['accessors'][s['input']];t=acc(s['input']).ravel();v=acc(s['output']);target=c['target']
  assert s.get('interpolation','LINEAR')=='LINEAR' and a['type']=='SCALAR' and a['componentType']==5126 and np.all(np.diff(t)>0)
  assert np.allclose(a['min'],[t.min()]) and np.allclose(a['max'],[t.max()]);assert doc['nodes'][target['node']]['name'] in ['radar','enseigne']
  canaux.append((target['node'],target['path'],t,v));keys.extend(t.tolist());duration=max(duration,float(t[-1]))
 times=sorted(set(np.linspace(0,duration,17).tolist()+keys));mini=np.full(3,np.inf);maxi=-mini;maxdelta=0;mobile_min=np.full(3,np.inf);mobile_max=-mobile_min;probes_clips=[]
 for t in times:
  overrides={}
  for n,p,tt,vv in canaux:overrides.setdefault(n,{})[p]=interpoler(tt,vv,t,p=='rotation')
  vertices,mat=calculer(overrides);moving=canaux[0][0];pv=points[moving]@mat[moving][:3,:3].T+mat[moving][:3,3];mobile_min=np.minimum(mobile_min,pv.min(0));mobile_max=np.maximum(mobile_max,pv.max(0))
  if t in keys:probes_clips.append({'t':t,'matrice':mat[moving].reshape(-1).tolist()})
  mini=np.minimum(mini,vertices.min(0));maxi=np.maximum(maxi,vertices.max(0))
  for n in ['racine','corps','toit']:maxdelta=max(maxdelta,float(abs(mat[noeuds[n]]-repos[noeuds[n]]).max()))
  ind=pieces['indicateur_capture'];ip=ind['local']@mat[ind['node']][:3,:3].T+mat[ind['node']][:3,3]
  left=pieces['rail_-0.322']['triangles'];right=pieces['rail_-0.154']['triangles'];jeu_rails=min(jeu_rails,float(ip[:,:,0].min()-left[:,:,0].max()),float(right[:,:,0].min()-ip[:,:,0].max()))
  jeu_butees=min(jeu_butees,float(ip[:,:,2].min()-pieces['butée_-0.19']['triangles'][:,:,2].max()),float(pieces['butée_-0.004']['triangles'][:,:,2].min()-ip[:,:,2].max()))
  assert abs(float(ip[:,:,1].min())-float(pieces['fond_glissiere']['triangles'][:,:,1].max()))<1e-7
 assert mini[1]>=-1e-7 and np.max(abs(mini[[0,2]]))<.5 and np.max(abs(maxi[[0,2]]))<.5 and maxi[1]<.77 and maxdelta==0
 first,_=calculer({n:{p:v[0]} for n,p,t,v in canaux});last,_=calculer({n:{p:v[-1]} for n,p,t,v in canaux});end_delta=float(abs(first-last).max());assert end_delta<1e-7
 clips.append({'nom':clip['name'],'duree':duration,'poses':len(times),'cibles':[doc['nodes'][n]['name'] for n,p,t,v in canaux],'enveloppe':{'min':mini.tolist(),'max':maxi.tolist()},'ecartDebutFin':end_delta,'racineCorpsToitImmobiles':True,'mobile':{'nom':doc['nodes'][canaux[0][0]]['name'],'min':mobile_min.tolist(),'max':mobile_max.tolist(),'probesCles':probes_clips}});poses_total+=len(times)
assert jeu_rails>.004 and jeu_butees>.005,(jeu_rails,jeu_butees)
# Preuves continues : toute rotation Y conserve le rayon XZ et la hauteur.
radar=points[noeuds['radar']];radius=float(np.linalg.norm(radar[:,[0,2]],axis=1).max());pivot=repos[noeuds['radar']][:3,3]
bmin=np.array([pivot[0]-radius,float((radar@repos[noeuds['radar']][:3,:3].T+pivot)[:,1].min()),pivot[2]-radius]);bmax=np.array([pivot[0]+radius,float((radar@repos[noeuds['radar']][:3,:3].T+pivot)[:,1].max()),pivot[2]+radius])
assert np.all(bmin[[0,2]]>-.5) and np.all(bmax[[0,2]]<.5) and bmax[2]<.140
shellnames=['parabole_concave','parabole_dos','chant_parabole','couronne_parabole','recepteur','bouche_recepteur']+[f'bras_recepteur_{j}' for j in range(3)]+[f'nervure_{j}_{k}' for j in range(6) for k in range(2)]
shellmin=float(np.concatenate([pieces[n]['triangles'] for n in shellnames])[:,:,1].min());roofmax=float(pieces['toiture']['triangles'][:,:,1].max());gap=shellmin-roofmax;assert gap>.035
# Boucle : même valeur et même vitesse de quaternion au raccord.
ss=doc['animations'][0]['samplers'][0];tt=acc(ss['input']).ravel();qq=acc(ss['output']);v0=qq[1,:3]/(tt[1]-tt[0]);v1=-qq[-2,:3]/(tt[-1]-tt[-2]);assert np.linalg.norm(v0-v1)<1e-7
imgs={c:np.array(Image.open(sortie/f'{identifiant}_{c}.png')) for c in ['albedo','normale','rugosite','emission','masque_equipe']}
mask=imgs['masque_equipe'];assert set(np.unique(mask))=={0,255};a=imgs['albedo'].reshape(512,2,512,2,3).mean((1,3));assert np.all(a[mask==255,0]==a[mask==255,1]) and np.all(a[mask==255,1]==a[mask==255,2]);assert not (imgs['emission'][mask==255]>0).any()
for n,p in pieces.items():
 uv=np.concatenate([p['uv'].reshape(-1,2),p['uv'].mean(axis=1)]);xy=np.minimum((uv*512).astype(int),511);m=mask[xy[:,1],xy[:,0]];e=imgs['emission'][xy[:,1],xy[:,0]];assert np.all(m==(255 if p['role']==2 else 0)),n;assert np.all(np.any(e>0,axis=1)==(p['role'] in [4,10])),n
assert doc['nodes'][noeuds['racine']]['extras']['atlasAnimationsBatiment'] is True
assert len(doc['materials'])==2 and sorted(m['name'] for m in doc['materials'])==['mat_corps','mat_vitrage'];glass=next(m for m in doc['materials'] if m['name']=='mat_vitrage');assert glass['emissiveTexture']['index']==3
assert len(doc['images'])==5 and all('uri' in i and '/' not in i['uri'] and 'bufferView' not in i for i in doc['images'])
vertices,_=calculer({})
report={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'triangles':nbtri,'primitives':sum(len(m['primitives']) for m in doc['meshes']),'noeuds':list(noeuds),'bornes':{'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist(),'dimensions':np.ptp(vertices,axis=0).tolist()},'geometrie':{'trianglesDegeneres':degenerate,'trianglesUvDegeneres':uvdeg,'normalesSensFaceMin':normdot,'erreurNormalesMax':normalerr,'erreurTangentesMax':tangenterr,'uvMin':uvmin,'uvMax':uvmax},'raccords':rac,'parabole':{'rayonSurface':.245,'profondeur':.070,'epaisseurAxiale':.018,'normalesLocalesSigneZMin':wind,'coqueFermeeAretesDeuxIncidences':True,'sondesCaviteLibre':probes,'gardeNervuresDerriereFaceInterieure':float(clearance_ribs.min()),'gardeContinueParaboleToit':gap,'supportFixe':True},'aire':{'approcheLibreXZ':{'min':[-.4,.140],'max':[.4,.430]},'rampePleineLargeur':True,'pente':.036/.1,'hauteurAvant':.002,'hauteurPlateau':.038,'limite':'Zone dégagée mesurée ; aucune vérification de visibilité ou capacité pour toutes les figurines.'},'animations':{'poses':poses_total,'clips':clips,'vitesseBoucleEcart':float(np.linalg.norm(v0-v1)),'jeuIndicateurRailsMin':jeu_rails,'jeuIndicateurButeesMin':jeu_butees,'rayonContinuRadar':radius,'enveloppeContinueRadar':{'min':bmin.tolist(),'max':bmax.tolist(),'methode':'Cylindre vertical centré sur le pivot Y ; rayon maximum exact des sommets. Convexité de la norme sur chaque triangle, valable à tout angle et pour interpolation quaternion autour de Y.'},'optIn':True},'textures':{'masqueBinaire':True,'grisNeutreSurMasque':True,'emissionVitrageFeuxSeulement':True,'pngExternes':5},'controleVisuel':False,'approbationArtistique':False,'limites':['Contacts et cavité contrôlés sur les pièces et sondes listées ; pas de certification exhaustive des collisions.','Deux clips isolés, aucun rendu ni mesure sur téléphone.']}
(sortie/'mesures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'triangles':nbtri,'primitives':report['primitives'],'poses':poses_total,'raccords':len(rac),'gardeParaboleToit':gap,'rayonRadar':radius,'jeuButees':jeu_butees}))
