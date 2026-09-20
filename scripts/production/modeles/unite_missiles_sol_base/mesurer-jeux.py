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
assert sum(len(p['triangles']) for p in liste)==8980

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
# Appuis des deux trains et jeux des galets à l'intérieur de la piste creuse.
trains=[]
for cote in ['g','d']:
 piste=tout(f'chenille_{cote}');patins=tout(f'patins_{cote}');garde=tout(f'garde_chenille_{cote}').copy();garde[:,:,1]-=.010
 assert abs(patins[:,:,1].min())<1e-7
 assert float(garde[:,:,1].min()-patins[:,:,1].max())>.006
 for i in range(5):
  enregistrer(f'galet_piste_{cote}_{i}',tout(f'roue_{cote}_{i}'),piste,.016)
  if i<4:enregistrer(f'galets_voisins_{cote}_{i}',tout(f'roue_{cote}_{i}'),tout(f'roue_{cote}_{i+1}'),.04)
 trains.append({'cote':cote,'galets':5,'patins':len(selection(f'patins_{cote}')),'appuiMinimumY':float(patins[:,:,1].min()),'gardeChenilleAuTassement':float(garde[:,:,1].min()-patins[:,:,1].max())})
plateau=tout('plateau_principal');haut_patins=max(tout(f'patins_{s}')[:,:,1].max() for s in ['g','d']);jeu_plateau=float(plateau[:,:,1].min()-.010-haut_patins);assert jeu_plateau>.004
suspension=[]
for i,(t,f) in enumerate(zip(selection('coulisseaux_suspension'),selection('fourreaux_suspension'))):
 engagement=min(min(t[:,:,1].max(),f[:,:,1].max()+dy)-max(t[:,:,1].min(),f[:,:,1].min()+dy) for dy in [-.010,.003]);ds=[]
 for dy in [-.010,.003]:
  shifted=f.copy();shifted[:,:,1]+=dy;ds.append(enregistrer(f'coulisseau_{i}_{dy}',t,shifted,.010))
 assert engagement>.009
 suspension.append({'indice':i,'engagementMinimal':float(engagement),'jeuRadialMinimal':min(x['minimumMetres'] for x in ds)})
# Les deux semelles de recul prennent le dessous du caisson et chevauchent les rails.
rails=tout('rails_recul');semelles=tout('patins_recul');fond=tout('plancher_caisson')
# Retour dans l'axe du caisson pour une mesure de montage.
offset=np.array(json.loads((sortie/'fabrication.json').read_text())['recentrage']);haut=np.array([0,.020,0]);pivot_rack=matrices[noeuds['module_lance_roquettes']][:3,3];rx=rotation(np.array([np.sin(.045/2),0,0,np.cos(.045/2)]))
def droit(t):return (t-pivot_rack)@rx.T+pivot_rack-offset-haut
r,s,f=droit(rails),droit(semelles),droit(fond)
assert r[:,:,1].max()>s[:,:,1].min() and s[:,:,1].max()>f[:,:,1].min()
raccord_recul={'chevauchementRailSemelleY':float(r[:,:,1].max()-s[:,:,1].min()),'chevauchementSemelleCaissonY':float(s[:,:,1].max()-f[:,:,1].min()),'course':.013,'contactIntentionnel':True}
# Fenêtres encastrées sur les vrais pans inclinés de la cabine, pas sur l'AABB.
vitres=[]
for nom,axis,pente,origine in [('pare_brise',2,.067/.119,[0,.322,.425]),('vitres_laterales',0,.032/.119,[.201,.322,0])]:
 for j,t in enumerate(selection(nom)):
  p=t.reshape(-1,3)-offset-haut;n=np.zeros(3);n[1]=pente;n[axis]=1;o=np.array(origine,float)
  if axis==0 and p[:,0].mean()<0:n[0]=-1;o[0]*=-1
  n/=np.linalg.norm(n);dist=(p-o)@n
  assert -.003<dist.min()<0 and .006<dist.max()<.009,(nom,dist.min(),dist.max())
  vitres.append({'nom':nom,'indice':j,'distanceSigneeMinMaxPlanCabine':[float(dist.min()),float(dist.max())],'dosEncastre':True,'faceExterieure':True})
# Ressort : âme et spires séparées. La recherche ignore seulement les jonctions voisines.
ressort=tout('ressort_antenne');ame=tout('ame_ressort');enregistrer('ressort_ame',ressort,ame,.012)
# TubeGeometry : 48 segments de courbe, douze triangles chacun. Trois tours.
assert len(ressort)==48*12
segments=[ressort[i*12:(i+1)*12] for i in range(48)]
minimum_spires=.03;couples=0
for i in range(48):
 for j in range(i+8,48):
  # Rechercher les portions qui sont voisines sur le cercle mais non dans la chaîne.
  if min(abs((j-i)%16),16-abs((j-i)%16))>2:continue
  r=distance(segments[i],segments[j],.025);assert r['traversees']==0 and r['minimumMetres']>.008
  minimum_spires=min(minimum_spires,r['minimumMetres']);couples+=1
spring={'tours':3,'segments':48,'diametreFil':.0084,'diametreFouet':.021,'couplesSegmentsSondes':couples,'separationPortionsDistinctes':minimum_spires,'jeuAme':mesures[-1]['minimumMetres']}
# Rayons vers le fond, à travers tous les triangles du véhicule, dans l'axe du caisson.
triangles_droits=droit(np.concatenate([p['triangles'] for p in liste]))
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 good=ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)
 return t[good]
cavites=[]
for j,y in enumerate([.394,.490]):
 for k,x in enumerate([-.153,-.051,.051,.153]):
  depths=[]
  for a in [None]+list(np.linspace(0,2*np.pi,16,endpoint=False)):
   xx,yy=(x,y) if a is None else (x+.025*np.cos(a),y+.025*np.sin(a))
   hits=rayons(np.array([xx,yy,.064]),np.array([0,0,-1]),triangles_droits);assert len(hits)>0
   depth=float(hits.min());assert .425<depth<.427,(j,k,a,depth)
   depths.append(depth)
  cavites.append({'id':f'{j}_{k}','rayonsVerifies':len(depths),'rayonOuvertureSonde':.025,'profondeurPremiereSurfaceMinMax':[min(depths),max(depths)]})
for k in range(4):enregistrer(f'cellules_verticales_{k}',tout(f'cellule_0_{k}'),tout(f'cellule_1_{k}'),.020);enregistrer(f'levres_verticales_{k}',tout(f'levre_0_{k}'),tout(f'levre_1_{k}'),.020)
for j in range(2):
 for k in range(3):enregistrer(f'cellules_horizontales_{j}_{k}',tout(f'cellule_{j}_{k}'),tout(f'cellule_{j}_{k+1}'),.03)
# Enveloppes séparatrices des organes mobiles sur 193 poses et toutes les clés.
clip_mesures=[]
cabine_parts=[p for p in liste if p['nom'] in ['cabine','pavillon','pare_brise','vitres_laterales']]
caisson_parts=[p for p in liste if p['noeud']=='os_recul']
antenne_parts=[p for p in liste if p['noeud']=='module_antenne']
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];t=acc(sm['input'])[:,0];v=acc(sm['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));jc,ja,jp,jac=np.inf,np.inf,np.inf,np.inf
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  _,m=calculer(pose)
  def world(parts):return np.concatenate([p['local']@m[p['ni']][:3,:3].T+m[p['ni']][:3,3] for p in parts]).reshape(-1,3)
  c,an,ca=world(caisson_parts),world(antenne_parts),world(cabine_parts)
  jc=min(jc,float(ca[:,2].min()-c[:,2].max()));ja=min(ja,float(an[:,2].min()-c[:,2].max()))
  pl=world([p for p in liste if p['nom']=='plancher_arriere']);jp=min(jp,float(c[:,1].min()-pl[:,1].max()))
  # Antenne/cabine : seules parties de l'antenne sous le sommet cabine sont pertinentes.
  bas=an[an[:,1]<ca[:,1].max()+.005];jac=min(jac,float(bas[:,0].min()-ca[:,0].max()))
 assert min(jc,ja,jp,jac)>.004,(a['name'],jc,ja,jp,jac)
 clip_mesures.append({'clip':a['name'],'poses':len(instants),'caissonCabineSeparationZ':jc,'caissonAntenneSeparationZ':ja,'caissonPlancherSeparationY':jp,'antenneSousToitCabineSeparationX':jac})
# À l'angle de tir maximal, la cabine doit laisser passer les sondes vers +Z.
# Transformations et triangles relus dans le GLB, aux clés montée/recul de la salve.
a=next(a for a in doc['animations'] if a['name']=='tir');rayons_tir=[]
for temps in [.18,.24]:
 pose={}
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];pose.setdefault(c['target']['node'],{})[c['target']['path']]=interpoler(acc(sm['input'])[:,0],acc(sm['output']),temps,c['target']['path']=='rotation')
 _,m=calculer(pose);tri=np.concatenate([p['local']@m[p['ni']][:3,:3].T+m[p['ni']][:3,3] for p in liste])
 rel=m[noeuds['os_recul']]@np.linalg.inv(matrices[noeuds['os_recul']]);angle=rotation(np.array([np.sin(-.045/2),0,0,np.cos(-.045/2)]));direction=rel[:3,:3]@angle@np.array([0,0,1]);nombre=0
 for y in [.394,.490]:
  for x in [-.153,-.051,.051,.153]:
   for phase in [None]+list(np.linspace(0,2*np.pi,16,endpoint=False)):
    xx,yy=(x,y) if phase is None else (x+.025*np.cos(phase),y+.025*np.sin(phase))
    origine=angle@(np.array([xx,yy,.064])-np.array([0,.303,-.277]))+np.array([0,.303,-.277])+offset+haut
    origine=rel[:3,:3]@origine+rel[:3,3];hits=rayons(origine,direction,tri)
    assert not np.any(hits<.650),(temps,x,y,phase,hits.min())
    nombre+=1
 rayons_tir.append({'temps':temps,'rayonsLibres':nombre,'distanceVerifiee':.650,'directionMonde':direction.tolist()})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB relus par plages extras.pieces, distances localisées, plans cabine, rayons des ouvertures et matrices de poses. Aucun rendu.','trains':trains,'nombreGalets':10,'plateauPatinsJeuVerticalAuPointBas':jeu_plateau,'suspensions':suspension,'raccordRecul':raccord_recul,'ressort':spring,'vitres':vitres,'cavites':cavites,'passagesTir':rayons_tir,'distancesTriangles':mesures,'posesModules':clip_mesures,'raccordsIntentionnels':['Patins caoutchoutés pris dans les pistes ; moyeux dans les jantes, essieux et bras reliés.','Coulisseaux dans des fourreaux ouverts, extrémités montées dans les traverses de plateau.','Tourillons dans l’axe fixe ; semelles du caisson en contact avec rails communs, course de 13 mm.','Vitres opaques encastrées dans les plans de cabine.','Ressort raccordé aux collerettes, âme séparée du fil, fouet épais relié à la collerette haute.'],'limites':['Distances localisées, aucune certification globale des collisions internes.','Débattements échantillonnés, transitions entre clips non mesurées.','Rayons au centre et sur un cercle de chaque ouverture : pas de preuve de toute section continue.','Galets et pistes rigides ; seule la suspension verticale du corps est animée.','Gabarit b neutre uniquement, a/c non certifiés.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'galets':10,'distancesLocalisees':len(mesures),'rayonsCavites':sum(c['rayonsVerifies'] for c in cavites),'poses':sum(c['poses'] for c in clip_mesures),'jeuCaissonCabine':min(c['caissonCabineSeparationZ'] for c in clip_mesures),'jeuCaissonAntenne':min(c['caissonAntenneSeparationZ'] for c in clip_mesures),'gardeChenille':min(c['gardeChenilleAuTassement'] for c in trains),'ressort':spring},ensure_ascii=False))
