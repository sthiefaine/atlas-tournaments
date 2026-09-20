#!/usr/bin/env python3
"""Contrôles mécaniques localisés dans les triangles GLB exportés ; aucun rendu."""
import sys
sys.dont_write_bytecode=True
from geometrie import *
import hashlib
_,matrices=calculer({})
liste=[]
for ni,n in enumerate(doc['nodes']):
 for info in n.get('extras',{}).get('pieces',[]):
  prim=doc['meshes'][n['mesh']]['primitives'][info['primitive']]
  idx=acc(prim['indices']).astype(int).reshape(-1,3)[info['triangleDebut']:info['triangleDebut']+info['triangles']]
  p=acc(prim['attributes']['POSITION'])
  liste.append({'nom':info['nom'],'ni':ni,'noeud':n['name'],'local':p[idx],'triangles':p[idx]@matrices[ni][:3,:3].T+matrices[ni][:3,3],'role':info['role']})
assert sum(len(p['triangles']) for p in liste)==8868

def selection(nom):return [p['triangles'] for p in liste if p['nom']==nom]
def tout(nom):return np.concatenate(selection(nom))
def distance(a,b,seuil=.03):
 amin,amax=a.min(axis=1),a.max(axis=1);bmin,bmax=b.min(axis=1),b.max(axis=1)
 ia,ib=[],[]
 for i in range(len(a)):
  j=np.flatnonzero(np.linalg.norm(np.maximum(np.maximum(amin[i]-bmax,bmin-amax[i]),0),axis=1)<seuil)
  ia.extend([i]*len(j));ib.extend(j.tolist())
 mini=seuil;intersections=0
 for start in range(0,len(ia),8192):
  aa,bb=a[np.array(ia[start:start+8192])],b[np.array(ib[start:start+8192])];ds=[]
  for i in range(3):
   ds.extend([point_triangle(aa[:,i],bb),point_triangle(bb[:,i],aa)])
   intersections+=int(np.count_nonzero(traverse(aa[:,i],aa[:,(i+1)%3],bb)|traverse(bb[:,i],bb[:,(i+1)%3],aa)))
   for j in range(3):ds.append(segments_distance(aa[:,i],aa[:,(i+1)%3],bb[:,j],bb[:,(j+1)%3]))
  mini=min(mini,float(np.min(np.stack(ds))))
 return {'minimumMetres':mini,'minimumExact':mini<seuil,'borneInferieureSiNonExacte':None if mini<seuil else seuil,'pairesFaces':len(ia),'traversees':intersections}

mesures=[]
def enregistrer(nom,a,b,seuil=.03):
 r={'nom':nom,**distance(a,b,seuil)};mesures.append(r)
 assert r['traversees']==0 and r['minimumMetres']>1e-5,r
 return r
roues=[]
for cote in ['g','d']:
 for i in range(3):
  tag=f'{cote}{i}';p=np.concatenate([tout(f'pneu_{tag}'),tout(f'crampons_{tag}')]);f=tout(f'garde_boue_{tag}').copy();f[:,:,1]-=.011
  assert abs(float(p[:,:,1].min()))<1e-7
  jeu=float(f[:,:,1].min()-p[:,:,1].max());assert jeu>.006
  roues.append({'id':tag,'appuiMinimumY':float(p[:,:,1].min()),'diametreAvecCrampons':float(np.ptp(p[:,:,1])),'largeurPneu':float(np.ptp(tout(f'pneu_{tag}')[:,:,0])),'gardeBouePointBasJeuVertical':jeu})
  if i<2:
   q=np.concatenate([tout(f'pneu_{cote}{i+1}'),tout(f'crampons_{cote}{i+1}')]);enregistrer(f'roues_{tag}_{i+1}',p,q,.08)
# Le plateau reste au-dessus des pneus pendant tous les mouvements verticaux.
plateau=tout('plateau_principal');haut_pneus=max(float(np.concatenate([tout(f'pneu_{s}{i}'),tout(f'crampons_{s}{i}')])[:,:,1].max()) for s in ['g','d'] for i in range(3))
jeu_plateau=float(plateau[:,:,1].min()-.011-haut_pneus);assert jeu_plateau>0
suspension=[]
for i,(t,f) in enumerate(zip(selection('coulisseaux_suspension'),selection('fourreaux_suspension'))):
 engagement=min(min(t[:,:,1].max(),f[:,:,1].max()+dy)-max(t[:,:,1].min(),f[:,:,1].min()+dy) for dy in [-.011,.003])
 ds=[]
 for dy in [-.011,.003]:
  shifted=f.copy();shifted[:,:,1]+=dy;ds.append(enregistrer(f'coulisseau_{i}_{dy}',t,shifted,.01))
 assert engagement>.028
 suspension.append({'indice':i,'engagementMinimal':float(engagement),'jeuRadialMinimal':min(x['minimumMetres'] for x in ds)})
# Fenêtres : distances signées au plan réel de la cabine. Le dos est encastré,
# la face avant reste dehors. Chaque panneau de verre est volontairement opaque.
offset=np.array(json.loads((sortie/'fabrication.json').read_text())['recentrage']);vitres=[]
for nom,axis,pente,origine in [('pare_brise',2,.0605/.108,[0,.331,.414]),('vitres_laterales',0,.035/.108,[.217,.331,0])]:
 for j,t in enumerate(selection(nom)):
  p=t.reshape(-1,3)-offset;n=np.zeros(3);n[1]=pente;n[axis]=1
  o=np.array(origine,float)
  if axis==0 and p[:,0].mean()<0:n[0]=-1;o[0]*=-1
  n/=np.linalg.norm(n);dist=(p-o)@n
  assert -.003<dist.min()<0 and .006<dist.max()<.009,(nom,dist.min(),dist.max())
  vitres.append({'nom':nom,'indice':j,'distanceSigneeMinMaxPlanCabine':[float(dist.min()),float(dist.max())],'dosEncastre':True,'faceExterieure':True})
# Caisson : tous les triangles ramenés dans l'axe de fabrication avant l'angle de repos.
pivot_rack=matrices[noeuds['module_lance_roquettes']][:3,3];rx=rotation(np.array([np.sin(.055/2),0,0,np.cos(.055/2)]))
rack=np.concatenate([p['triangles'] for p in liste]);rack_droit=(rack-pivot_rack)@rx.T+pivot_rack-offset
# Les rayons avancent dans chaque ouverture et doivent atteindre la lentille de fond,
# sans rencontrer de capuchon ou de paroi parasite.
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 good=ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)
 return t[good]
cavites=[]
for j,y in enumerate([.388,.486]):
 for k,x in enumerate([-.123,0,.123]):
  depths=[]
  for a in [None]+list(np.linspace(0,2*np.pi,16,endpoint=False)):
   xx,yy=(x,y) if a is None else (x+.028*np.cos(a),y+.028*np.sin(a))
   hits=rayons(np.array([xx,yy,.066]),np.array([0,0,-1]),rack_droit);assert len(hits)>0
   depth=float(hits.min());assert .413<depth<.415,(j,k,a,depth)
   depths.append(depth)
  cavites.append({'id':f'{j}_{k}','rayonsVerifies':len(depths),'rayonOuvertureSonde':.028,'profondeurPremiereSurfaceMinMax':[min(depths),max(depths)]})
# Les deux parois de chaque tube et les lèvres voisines ont un jeu positif.
for k in range(3):enregistrer(f'cellules_verticales_{k}',tout(f'cellule_0_{k}'),tout(f'cellule_1_{k}'),.02);enregistrer(f'levres_verticales_{k}',tout(f'levre_0_{k}'),tout(f'levre_1_{k}'),.02)
for j in range(2):
 for k in range(2):enregistrer(f'cellules_horizontales_{j}_{k}',tout(f'cellule_{j}_{k}'),tout(f'cellule_{j}_{k+1}'),.08)
# Dégagements des éléments mobiles. Tous les sommets exacts, 193 poses + les clés.
# Le Z sépare la cabine, le radar et le caisson. Le Y sépare le caisson du plateau.
clip_mesures=[]
cabine_parts=[p for p in liste if p['nom'] in ['cabine','pavillon','pare_brise','vitres_laterales']]
caisson_parts=[p for p in liste if p['noeud']=='os_recul']
radar_parts=[p for p in liste if p['noeud']=='module_radar']
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  s=a['samplers'][c['sampler']];t=acc(s['input'])[:,0];v=acc(s['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));jc,jr,jp=np.inf,np.inf,np.inf
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  _,m=calculer(pose)
  def world(parts):return np.concatenate([p['local']@m[p['ni']][:3,:3].T+m[p['ni']][:3,3] for p in parts]).reshape(-1,3)
  c,r,ca=world(caisson_parts),world(radar_parts),world(cabine_parts)
  jc=min(jc,float(ca[:,2].min()-c[:,2].max()));jr=min(jr,float(r[:,2].min()-c[:,2].max()))
  pl=world([p for p in liste if p['nom']=='plancher_arriere']);jp=min(jp,float(c[:,1].min()-pl[:,1].max()))
 assert min(jc,jr,jp)>.02,(a['name'],jc,jr,jp)
 clip_mesures.append({'clip':a['name'],'poses':len(instants),'caissonCabineSeparationZ':jc,'caissonRadarSeparationZ':jr,'caissonPlancherSeparationY':jp})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB relus par plages extras.pieces, distances exactes localisées, plans de cabine, rayons dans les ouvertures et matrices des poses. Aucun rendu.','nombreRoues':len(roues),'roues':roues,'plateauPneusJeuVerticalAuPointBas':jeu_plateau,'suspensions':suspension,'vitres':vitres,'cavites':cavites,'distancesTriangles':mesures,'posesModules':clip_mesures,'raccordsIntentionnels':['Moyeux et axes dans les jantes ; essieux, bras et longerons reliés.','Tiges dans des fourreaux ouverts, avec jeu radial ; base des fourreaux prise dans les traverses du plateau.','Axe horizontal dans les tourillons et équerres ; rails de recul sous le plancher du caisson.','Parois de tubes, lèvres et traverses fixées à la caisse ; aucune ouverture couverte par une face pleine.','Vitres encastrées par leur dos sur les plans de cabine ; supports radar assemblés au pavillon.'],'limites':['Distances localisées, pas de certification globale des collisions internes.','Caisson/cabine/radar mesurés aux poses, pas de preuve analytique globale de séparation pour tout mélange de clips.','Rayons de sondage couvrent le centre et un cercle de chaque ouverture, pas toute la surface continue.','Six roues fixes ; seule la suspension verticale du corps est animée.','Gabarit b neutre uniquement ; a/c non certifiés.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'roues':len(roues),'distancesLocalisees':len(mesures),'rayonsCavites':sum(c['rayonsVerifies'] for c in cavites),'poses':sum(c['poses'] for c in clip_mesures),'jeuCaissonCabine':min(c['caissonCabineSeparationZ'] for c in clip_mesures),'jeuCaissonRadar':min(c['caissonRadarSeparationZ'] for c in clip_mesures),'gardeBouePneuMin':min(c['gardeBouePointBasJeuVertical'] for c in roues)},ensure_ascii=False))
