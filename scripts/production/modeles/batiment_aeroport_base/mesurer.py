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
assert nbtri<=4200 and degenerate==0 and uvdeg==0 and normdot>0 and normalerr<1e-6 and tangenterr<1e-5,(nbtri,degenerate,uvdeg,normdot,normalerr,tangenterr)

def distance(a,b):
 a=pieces[a]['triangles'];b=pieces[b]['triangles'];aa=np.repeat(a,len(b),axis=0);bb=np.tile(b,(len(a),1,1));ds=[]
 for j in range(3):
  ds.append(point_triangle(aa[:,j],bb));ds.append(point_triangle(bb[:,j],aa))
  if traverse(aa[:,j],aa[:,(j+1)%3],bb).any() or traverse(bb[:,j],bb[:,(j+1)%3],aa).any():return 0.
  for k in range(3):ds.append(segments_distance(aa[:,j],aa[:,(j+1)%3],bb[:,k],bb[:,(k+1)%3]))
 return float(np.min(ds))

raccords=[('dalle','semelle_cabine'),('semelle_cabine','cabine_basse'),('cabine_basse','appui_vitrage'),('appui_vitrage','vitrage_avant'),('vitrage_avant','toiture'),('toiture','fond_glissiere'),('fond_glissiere','indicateur_capture'),('dalle','embase_mat'),('embase_mat','mat'),('mat','rotule_manche'),('rotule_manche','axe_manche'),('axe_manche','rayon_manche_-0.428'),('rayon_manche_-0.428','ourlet_manche_entree'),('manche_creuse','ourlet_manche_entree'),('manche_creuse','ourlet_manche_sortie'),('chassis_camion','bloc_pompe'),('bloc_pompe','raccord_pompe'),('bloc_pompe','cuve'),('raccord_pompe','flexible_range'),('chassis_camion','cabine_camion'),('cabine_camion','toit_camion'),('cuve','bouchon_cuve')]
for s in [-1,1]:
 for z in [-.323,-.175]:raccords.extend([('dalle',f'pneu_{s}_{z}'),(f'pneu_{s}_{z}',f'jante_{s}_{z}'),('chassis_camion',f'jante_{s}_{z}')])
for n in ['nord','est','sud','ouest']:raccords.extend([('dalle',f'support_feu_{n}'),(f'support_feu_{n}',f'lentille_{n}')])
rac=[{'a':a,'b':b,'distanceMetres':distance(a,b)} for a,b in raccords]
# Seuil de 0,7 mm pour tolérer les arrondis des surfaces facettées, pas les éléments flottants.
for x in rac:assert x['distanceMetres']<.0007,x

def radial_tri(tri,center=np.array([.020,.075])):
 p=tri[:,:,[0,2]]-center;mins=np.full(len(p),1e9)
 for j in range(3):
  a=p[:,j];b=p[:,(j+1)%3];d=b-a;t=np.clip(-produit(a,d)/np.maximum(produit(d,d),1e-30),0,1);mins=np.minimum(mins,np.linalg.norm(a+t[:,None]*d,axis=1))
 cross=cross2(p[:,1]-p[:,0],p[:,2]-p[:,0]);signs=np.stack([cross2(p[:,(j+1)%3]-p[:,j],-p[:,j]) for j in range(3)],axis=1)
 inside=(abs(cross)>1e-15)&(np.all(signs>=-1e-15,axis=1)|np.all(signs<=1e-15,axis=1));mins[inside]=0
 return float(mins.min())
clearance=[{'piece':n,'rayonInterieur':radial_tri(p['triangles'])} for n,p in pieces.items() if n not in ['dalle','apron','chant_apron']]
clearance.sort(key=lambda a:a['rayonInterieur']);assert clearance[0]['rayonInterieur']>.300,clearance[:5]
# Couloir droit +Z : toutes les projections de triangle hors bande centrale de 0,42 m.
obstacles=[p['triangles'] for n,p in pieces.items() if n not in ['dalle','apron','chant_apron'] and float(p['triangles'][:,:,1].max())>.0281]
front=np.concatenate(obstacles);front=front[np.max(front[:,:,2],axis=1)>.075];assert np.all((front[:,:,0].max(axis=1)<-.21)|(front[:,:,0].min(axis=1)>.21))
# Les quatre feux encastrés culminent comme l'apron à 28 mm, sans obturer l'accès.

clips=[];poses_total=0;min_manche=1;max_manche_y=0;jeu_rails=1
for clip in doc['animations']:
 canaux=[];keys=[];duration=0
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];a=doc['accessors'][s['input']];t=acc(s['input']).ravel();v=acc(s['output']);target=c['target'];assert s.get('interpolation','LINEAR')=='LINEAR';assert a['type']=='SCALAR' and a['componentType']==5126 and np.all(np.diff(t)>0);assert np.allclose(a['min'],[t.min()]) and np.allclose(a['max'],[t.max()]);assert doc['nodes'][target['node']]['name'] in ['manche_air','enseigne'];canaux.append((target['node'],target['path'],t,v));keys.extend(t.tolist());duration=max(duration,float(t[-1]))
 times=sorted(set(np.linspace(0,duration,129).tolist()+keys));mini=np.full(3,np.inf);maxi=-mini;maxdelta=0;mobile_min=np.full(3,np.inf);mobile_max=-mobile_min;probes=[]
 for t in times:
  overrides={}
  for n,p,tt,vv in canaux:overrides.setdefault(n,{})[p]=interpoler(tt,vv,t,p=='rotation')
  vertices,mat=calculer(overrides);moving=canaux[0][0];pv=points[moving]@mat[moving][:3,:3].T+mat[moving][:3,3];mobile_min=np.minimum(mobile_min,pv.min(0));mobile_max=np.maximum(mobile_max,pv.max(0));
  if t in keys:probes.append({'t':t,'matrice':mat[moving].reshape(-1).tolist()})
  mini=np.minimum(mini,vertices.min(axis=0));maxi=np.maximum(maxi,vertices.max(axis=0))
  for n in ['racine','corps','toit']:maxdelta=max(maxdelta,float(abs(mat[noeuds[n]]-repos[noeuds[n]]).max()))
  mp=points[noeuds['manche_air']]@mat[noeuds['manche_air']][:3,:3].T+mat[noeuds['manche_air']][:3,3];max_manche_y=max(max_manche_y,float(mp[:,1].max()))
  sock=pieces['manche_creuse'];tr=sock['local']@mat[sock['node']][:3,:3].T+mat[sock['node']][:3,3];min_manche=min(min_manche,radial_tri(tr))
  ind=pieces['indicateur_capture'];ip=ind['local']@mat[ind['node']][:3,:3].T+mat[ind['node']][:3,3]
  left=pieces['rail_capture_-0.401']['triangles'];right=pieces['rail_capture_-0.209']['triangles'];jeu_rails=min(jeu_rails,float(ip[:,:,0].min()-left[:,:,0].max()),float(right[:,:,0].min()-ip[:,:,0].max()))
  assert abs(float(ip[:,:,1].min())-float(pieces['fond_glissiere']['triangles'][:,:,1].max()))<1e-7
 assert mini[1]>=-1e-7 and np.max(np.abs(mini[[0,2]]))<.5 and np.max(np.abs(maxi[[0,2]]))<.5 and maxi[1]<.52 and maxdelta==0
 first,_=calculer({n:{p:v[0]} for n,p,t,v in canaux});last,_=calculer({n:{p:v[-1]} for n,p,t,v in canaux});end_delta=float(abs(first-last).max());assert end_delta<1e-7
 clips.append({'nom':clip['name'],'duree':duration,'poses':len(times),'cibles':[doc['nodes'][n]['name'] for n,p,t,v in canaux],'enveloppe':{'min':mini.tolist(),'max':maxi.tolist()},'ecartDebutFin':end_delta,'racineCorpsToitImmobiles':True,'mobile':{'nom':doc['nodes'][canaux[0][0]]['name'],'min':mobile_min.tolist(),'max':mobile_max.tolist(),'probesCles':probes}});poses_total+=len(times)
assert max_manche_y<.368 and min_manche>.30 and jeu_rails>.0019
# Majorant continu pour tout angle de repos : rotation autour d'un axe fixe, |angle|<=0,085.
lever=float(np.linalg.norm(points[noeuds['manche_air']],axis=1).max());displacement=2*lever*np.sin(.085/2);sock_rest=points[noeuds['manche_air']]@repos[noeuds['manche_air']][:3,:3].T+repos[noeuds['manche_air']][:3,3];sock_bound_min=sock_rest.min(0)-displacement;sock_bound_max=sock_rest.max(0)+displacement
assert sock_bound_min[1]>0 and sock_bound_max[1]<.368 and np.all(sock_bound_min[[0,2]]>-.5) and np.all(sock_bound_max[[0,2]]<.5)
qclip=doc['animations'][0];ss=qclip['samplers'][0];tt=acc(ss['input']).ravel();qq=acc(ss['output']);v0=qq[1,:3]/(tt[1]-tt[0]);v1=-qq[-2,:3]/(tt[-1]-tt[-2]);assert np.linalg.norm(v0-v1)<1e-7
# Surface extérieure de la manche : radial sortant, peau intérieure : radial entrant.
mt=pieces['manche_creuse']['triangles'];norm=np.cross(mt[:,1]-mt[:,0],mt[:,2]-mt[:,0]);cent=mt.mean(axis=1);u=(.222-cent[:,0])/.184;rad=np.stack([np.zeros(len(mt)),cent[:,1]-(.316-.013*u*u),cent[:,2]+.398],axis=1);sign=np.sum(norm*rad,axis=1);half=len(sign)//2;assert np.all(sign[:half]>0) and np.all(sign[half:]<0)

imgs={c:np.array(Image.open(sortie/f'{identifiant}_{c}.png')) for c in ['albedo','normale','rugosite','emission','masque_equipe']}
mask=imgs['masque_equipe'];assert set(np.unique(mask))=={0,255};a=imgs['albedo'].reshape(512,2,512,2,3).mean((1,3));assert np.all(a[mask==255,0]==a[mask==255,1]) and np.all(a[mask==255,1]==a[mask==255,2]);assert not (imgs['emission'][mask==255]>0).any()
# Contrôle les centres et sommets des UV réels : masque et émission ne débordent pas de leurs pièces.
for n,p in pieces.items():
 uv=np.concatenate([p['uv'].reshape(-1,2),p['uv'].mean(axis=1)]);xy=np.minimum((uv*512).astype(int),511);m=mask[xy[:,1],xy[:,0]];e=imgs['emission'][xy[:,1],xy[:,0]];assert np.all(m==(255 if p['role']==2 else 0)),n;assert np.all(np.any(e>0,axis=1)==(p['role'] in [4,10])),n
assert doc['nodes'][noeuds['racine']]['extras']['atlasAnimationsBatiment'] is True
assert len(doc['materials'])==2 and sorted(m['name'] for m in doc['materials'])==['mat_corps','mat_vitrage'];glass=next(m for m in doc['materials'] if m['name']=='mat_vitrage');assert glass['emissiveTexture']['index']==3 and glass['emissiveFactor']==[1,1,1]
assert len(doc['images'])==5 and all('uri' in i and '/' not in i['uri'] and 'bufferView' not in i for i in doc['images'])
vertices,_=calculer({});report={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'triangles':nbtri,'primitives':sum(len(m['primitives']) for m in doc['meshes']),'noeuds':list(noeuds),'bornes':{'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist(),'dimensions':np.ptp(vertices,axis=0).tolist()},'geometrie':{'trianglesDegeneres':degenerate,'trianglesUvDegeneres':uvdeg,'normalesSensFaceMin':normdot,'erreurNormalesMax':normalerr,'erreurTangentesMax':tangenterr,'uvMin':uvmin,'uvMax':uvmax,'mancheNormalesRadialesConformes':True},'raccords':rac,'aire':{'centreXZ':[.020,.075],'rayonMetres':.300,'obstacleLePlusProche':clearance[0],'sixPlusProches':clearance[:6],'approcheAvantLargeurMetres':.42,'feuxAffleurantsHauteurMetres':.028,'limiteApproche':'Feux encastrés culminant comme le disque à 28 mm. Pas de promesse que toute silhouette d’unité tient dans ce disque.'},'animations':{'poses':poses_total,'clips':clips,'vitesseBoucleEcart':float(np.linalg.norm(v0-v1)),'mancheHauteurMax':max_manche_y,'jeuIndicateurRailsMin':jeu_rails,'mancheRayonInterieurMin':min_manche,'enveloppeContinueManche':{'min':sock_bound_min.tolist(),'max':sock_bound_max.tolist(),'methode':'Sphère de déplacement 2r sin(0,085/2) ; rotation bornée autour d’un axe fixe.'},'optIn':True},'textures':{'masqueBinaire':True,'grisNeutreSurMasque':True,'emissionCabineEt4FeuxUniquement':True,'pngExternes':5},'controleVisuel':False,'approbationArtistique':False,'limites':['Mesures géométriques ciblées et poses échantillonnées ; pas de certification exhaustive de collisions.','Deux clips isolés, pas de rendu ni de mesure de téléphone.']}
(sortie/'mesures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'triangles':nbtri,'primitives':report['primitives'],'poses':poses_total,'raccords':len(rac),'obstacleProche':clearance[0]}))
