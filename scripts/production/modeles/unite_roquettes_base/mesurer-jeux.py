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
assert sum(len(p['triangles']) for p in liste)==8800

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
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 good=ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)
 return t[good]
# Distances localisées statiques, hors raccords intentionnels.
for s in ['g','d']:
 for i in [0,1]:enregistrer(f'pneus_voisins_{s}_{i}',tout(f'pneu_{s}_{i}'),tout(f'pneu_{s}_{i+1}'),.15)
 for i in range(3):enregistrer(f'pneu_plateau_{s}_{i}',tout(f'pneu_{s}_{i}'),tout('plateau'),.05)
for j in range(2):
 for k in range(5):enregistrer(f'cellules_horizontales_{j}_{k}',tout(f'cellule_{j}_{k}'),tout(f'cellule_{j}_{k+1}'),.04)
for k in range(6):
 enregistrer(f'cellules_verticales_{k}',tout(f'cellule_0_{k}'),tout(f'cellule_1_{k}'),.025)
 enregistrer(f'levres_verticales_{k}',tout(f'levre_0_{k}'),tout(f'levre_1_{k}'),.02)
# Coulisseaux dans alésages polygonaux : jeux radiaux, recouvrements axiaux.
stabilisateurs=[]
for s in ['g','d']:
 for i in [0,1]:
  tag=f'{s}_{i}'
  a,b=tout(f'fourreau_horizontal_{tag}'),tout(f'glissiere_{tag}')
  enregistrer(f'alesage_horizontal_{tag}',a,b,.008)
  enregistrer(f'alesage_vertical_{tag}',tout(f'fourreau_vertical_{tag}'),tout(f'tige_pied_{tag}'),.006)
  stabilisateurs.append({'id':tag,'jeuRadialHorizontalMin':.018*np.cos(np.pi/12)-.014,'jeuRadialVerticalMin':.014*np.cos(np.pi/12)-.011,'recouvrementHorizontalAuRepos':.104,'recouvrementVerticalAuRepos':.067,'repliHorizontal':.037,'relevePied':.064})
# Raccords visibles : les pièces doivent toucher ou s'imbriquer volontairement.
contacts=[]
for a,b in [('patins_recul','rails_recul'),('patins_recul','plancher_caisson'),('tourillons','axe_pivot'),('berceau_fixe','axe_pivot'),('pavillon','cabine'),('support_temoin','temoin')]+[(f'glissiere_{s}_{i}',f'collier_{s}_{i}') for s in ['g','d'] for i in [0,1]]+[(f'fourreau_vertical_{s}_{i}',f'collier_{s}_{i}') for s in ['g','d'] for i in [0,1]]+[(f'tige_pied_{s}_{i}',f'rotule_pied_{s}_{i}') for s in ['g','d'] for i in [0,1]]+[(f'rotule_pied_{s}_{i}',f'semelle_{s}_{i}') for s in ['g','d'] for i in [0,1]]:
 r=distance(tout(a),tout(b),.025);assert r['traversees']>0 or r['minimumMetres']<1e-7,(a,b,r)
 contacts.append({'pieces':[a,b],'contactIntentionnel':True,**r})
raccords_pneus=[]
for s in ['g','d']:
 for i in range(3):
  p,j=tout(f'pneu_{s}_{i}').reshape(-1,3),tout(f'jante_{s}_{i}').reshape(-1,3);centre=(p.min(axis=0)+p.max(axis=0))/2
  axial=max(abs(p[:,0]-centre[0]));talon=p[np.isclose(abs(p[:,0]-centre[0]),axial,atol=1e-7)]
  r_talon=max(np.linalg.norm((talon-centre)[:,[1,2]],axis=1));r_jante=max(np.linalg.norm((j-centre)[:,[1,2]],axis=1))
  marge=float(r_jante*np.cos(np.pi/16)-r_talon);saillie=float(max(abs(j[:,0]-centre[0]))-axial)
  assert marge>0 and saillie>0
  raccords_pneus.append({'pneu':f'{s}_{i}','recouvrementRadialMin':marge,'janteAuDelaTalon':saillie})
# Profondeur réelle d'encastrement du vitrage dans le plan de la coque.
vitres=[]
for nom,axis,pente,origine in [('pare_brise',2,.0525/.096,[0,.299,.403]),('vitres_laterales',0,.028/.096,[.183,.299,0])]:
 for j,t in enumerate(selection(nom)):
  p=t.reshape(-1,3);n=np.zeros(3);n[1]=pente;n[axis]=1;o=np.array(origine,float)
  if axis==0 and p[:,0].mean()<0:n[0]=-1;o[0]*=-1
  n/=np.linalg.norm(n);dist=(p-o)@n
  assert -.004<dist.min()<0 and .005<dist.max()<.010,(nom,dist.min(),dist.max())
  vitres.append({'nom':nom,'indice':j,'distanceSigneeMinMaxPlanCabine':[float(dist.min()),float(dist.max())]})
# Cavités rectilignes : redresser les triangles du caisson et le camion complet.
pivot=np.array([0,.300,-.19]);angle=rotation(np.array([np.sin(-.32/2),0,0,np.cos(-.32/2)]))
alltri=np.concatenate([p['triangles'] for p in liste]);droits=(alltri-pivot)@angle+pivot
cavites=[]
for j,y in enumerate([.391,.476]):
 for k,x in enumerate([-.25,-.15,-.05,.05,.15,.25]):
  depths=[]
  for a in [None]+list(np.linspace(0,2*np.pi,12,endpoint=False)):
   xx,yy=(x,y) if a is None else (x+.022*np.cos(a),y+.022*np.sin(a))
   h=rayons(np.array([xx,yy,.194]),np.array([0,0,-1]),droits);assert len(h)>0
   depth=float(h.min());assert .416<depth<.418,(j,k,a,depth);depths.append(depth)
  cavites.append({'id':f'{j}_{k}','rayons':len(depths),'rayonSonde':.022,'profondeurMinMax':[min(depths),max(depths)]})
# Contrôles dynamiques : supports entre roues, gardes-boue au tassement, rack/cabine.
clips=[]
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];t=acc(sm['input'])[:,0];v=acc(sm['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));gardes=np.inf;appuis=np.inf;jcab=np.inf;jpl=np.inf;jst=np.inf;rt=np.inf;sols=[]
 for t in instants:
  pose={}
  for i,c,ts,vs in canaux:pose.setdefault(i,{})[c]=interpoler(ts,vs,t,c=='rotation')
  _,m=calculer(pose)
  def world(parts):return np.concatenate([p['local']@m[p['ni']][:3,:3].T+m[p['ni']][:3,3] for p in parts]).reshape(-1,3)
  def nom(n):return world([p for p in liste if p['nom']==n])
  # Roues : enveloppe du cercle, indépendante de leur angle animé.
  for s in ['g','d']:
   for i in range(3):
    wheel=[p for p in liste if p['nom'] in [f'pneu_{s}_{i}',f'crampons_{s}_{i}']];centre=m[noeuds[f'os_roue_{s}_{i}']][:3,3];w=world(wheel)
    rad=float(np.linalg.norm((w-centre)[:,[1,2]],axis=1).max());gardes=min(gardes,float(nom(f'garde_boue_{s}_{i}')[:,1].min()-centre[1]-rad))
   for i in [0,1]:
    leg=world([p for p in liste if p['noeud'] in [f'os_glissiere_{s}_{i}',f'os_pied_{s}_{i}'] and not p['nom'].startswith('glissiere')]);z=leg[:,2]
    wheel_z=[-.275,-.02,.265];r=.090272
    appuis=min(appuis,float(z.min()-(wheel_z[i]+r)),float((wheel_z[i+1]-r)-z.max()))
    # Le collier et fourreau vertical restent latéralement hors du plateau.
    high=world([p for p in liste if p['nom'] in [f'collier_{s}_{i}',f'fourreau_vertical_{s}_{i}',f'tige_pied_{s}_{i}']])
    jst=min(jst,float(abs(high[:,0]).min()-nom('plateau')[:,0].max()))
    assert nom(f'semelle_{s}_{i}')[:,1].max()<nom('plateau')[:,1].min() and nom(f'rotule_pied_{s}_{i}')[:,1].max()<nom('plateau')[:,1].min()
    sols.append(float(nom(f'semelle_{s}_{i}')[:,1].min()))
  # Caisson : séparer son dessous de la cabine sur la partie avant seulement.
  c=world([p for p in liste if p['noeud']=='os_recul']);cab=world([p for p in liste if p['nom'] in ['cabine','pavillon','trappe_cabine']]);front=c[c[:,2]>=cab[:,2].min()-.005]
  if len(front):jcab=min(jcab,float(front[:,1].min()-cab[:,1].max()))
  jpl=min(jpl,float(c[:,1].min()-nom('plancher')[:,1].max()))
  # Les plans supérieurs des rails et inférieurs des patins se recouvrent après recul.
  inv=np.linalg.inv(m[noeuds['module_lance_roquettes']]);rr=(nom('rails_recul')@inv[:3,:3].T+inv[:3,3])@angle;pp=(nom('patins_recul')@inv[:3,:3].T+inv[:3,3])@angle
  rt=min(rt,float(rr[:,1].max()-pp[:,1].min()))
 assert gardes>.004 and appuis>.004 and jcab>.006 and jpl>.015 and jst>.0005 and rt>0 and min(sols)>-1e-6,(a['name'],gardes,appuis,jcab,jpl,jst,rt,min(sols))
 clips.append({'clip':a['name'],'poses':len(instants),'gardeBoueJeuMinimum':gardes,'stabilisateursEntreRouesJeuZ':appuis,'stabilisateursPlateauJeuX':jst,'caissonAuDessusCabineJeuY':jcab if np.isfinite(jcab) else None,'caissonPlancherJeuY':jpl,'railsPatinsRecouvrementY':rt,'semellesYMinMax':[min(sols),max(sols)]})
# Deux instants de salve, sondes de toutes bouches dirigées vers l'avant au-delà de la cabine.
animation_tir=next(a for a in doc['animations'] if a['name']=='tir');tirs=[]
for temps in [.16,.24]:
 pose={}
 for c in animation_tir['channels']:
  sm=animation_tir['samplers'][c['sampler']];pose.setdefault(c['target']['node'],{})[c['target']['path']]=interpoler(acc(sm['input'])[:,0],acc(sm['output']),temps,c['target']['path']=='rotation')
 _,m=calculer(pose);tri=np.concatenate([p['local']@m[p['ni']][:3,:3].T+m[p['ni']][:3,3] for p in liste]);rel=m[noeuds['os_recul']]@np.linalg.inv(matrices[noeuds['os_recul']]);direction=rel[:3,:3]@angle@np.array([0,0,1]);nombre=0
 for y in [.391,.476]:
  for x in [-.25,-.15,-.05,.05,.15,.25]:
   for a in [None]+list(np.linspace(0,2*np.pi,12,endpoint=False)):
    xx,yy=(x,y) if a is None else (x+.022*np.cos(a),y+.022*np.sin(a));o=angle@(np.array([xx,yy,.194])-pivot)+pivot;o=rel[:3,:3]@o+rel[:3,3]
    hits=rayons(o,direction,tri);assert not np.any(hits<.650),(temps,x,y,hits.min());nombre+=1
 tirs.append({'temps':temps,'rayonsLibres':nombre,'distance':.650,'direction':direction.tolist()})
r={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'distancesTriangles':mesures,'raccords':contacts,'pneusJantes':raccords_pneus,'stabilisateurs':stabilisateurs,'vitres':vitres,'cavites':cavites,'posesModules':clips,'passagesTir':tirs,'limites':['Distances et plans localisés, aucune certification globale des collisions.','973 poses, chaque clip isolé ; mélanges exclus.','Sondes ponctuelles, aucune preuve de toute section continue.','Aucun rendu, contrôle artistique ou FPS.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'distances':len(mesures),'raccords':len(contacts),'poses':sum(c['poses'] for c in clips),'gardeBoue':min(c['gardeBoueJeuMinimum'] for c in clips),'sondesCavites':sum(c['rayons'] for c in cavites),'sondesTir':sum(c['rayonsLibres'] for c in tirs)}))
