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
assert sum(len(p['triangles']) for p in liste)==3468

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
# Roues voisines, roue de secours, roue/capsule : paires de triangles au repos.
for s in [-1,1]:
 for i in [0,1]:enregistrer(f'pneus_voisins_{s}_{i}',tout(f'pneu_{s}_{i}'),tout(f'pneu_{s}_{i+1}'),.12)
 for i in range(3):enregistrer(f'pneu_capsule_{s}_{i}',tout(f'pneu_{s}_{i}'),tout('capsule'),.03)
enregistrer('secours_roue_centrale',tout('pneu_secours'),tout('pneu_-1_1'),.12)
enregistrer('secours_garde_boue_central',tout('pneu_secours'),tout('garde_boue_-1_1'),.07)
enregistrer('radar_cabine',tout('parabole'),tout('verriere'),.08)
# Raccords de surfaces volontairement imbriquées, jamais jeu prétendu positif.
contacts=[]
for a,b in [('bras_recepteur_1','bras_recepteur_2'),('bras_recepteur_2','recepteur'),('bras_recepteur_1','parabole'),('axe_radar','support_radar'),('axe_radar','parabole'),('support_radar','plateau_arriere'),('console_secours','capsule'),('console_secours','pneu_secours_jante'),('toit_cabine','verriere'),('support_marqueur','carter_marqueur'),('carter_marqueur','tube_marqueur')]:
 r=distance(tout(a),tout(b),.025)
 assert r['traversees']>0 or r['minimumMetres']<1e-7,(a,b,r)
 contacts.append({'pieces':[a,b],'contactIntentionnel':True,**r})
# Les jantes traversent les talons des sept pneus ; lecture des points par coupe axiale.
raccords_pneus=[]
for nom in [f'pneu_{s}_{i}' for s in [-1,1] for i in range(3)]+['pneu_secours']:
 p,j=tout(nom).reshape(-1,3),tout(nom+'_jante').reshape(-1,3)
 centre=(p.min(axis=0)+p.max(axis=0))/2
 radial=np.linalg.norm((p-centre)[:,[1,2]],axis=1)
 # Rayon minimal du pneu aux deux faces axiales, jante polygonale incluse.
 axial=max(abs(p[:,0]-centre[0]));talon=p[np.isclose(abs(p[:,0]-centre[0]),axial,atol=1e-7)]
 r_talon=max(np.linalg.norm((talon-centre)[:,[1,2]],axis=1))
 # La jante a 12 côtés ; sa face minimale est son apothème, le talon 16 côtés.
 r_jante=max(np.linalg.norm((j-centre)[:,[1,2]],axis=1));apotheme=r_jante*np.cos(np.pi/12)
 # Vérification géométrique exacte : les points du talon doivent tous être dans le polygone jante.
 # La jante est volontairement portée à R=.80 pneu pour sa marge polygonale.
 marge=float(apotheme-r_talon);saillie=float(max(abs(j[:,0]-centre[0]))-axial)
 assert marge>0 and saillie>0,(nom,marge,saillie)
 raccords_pneus.append({'pneu':nom,'jeuRadialNegatifRecouvrement':marge,'janteAuDelaTalon':saillie})
# Contrôle dynamique ciblé : plans séparateurs et enveloppe cylindrique du pneu.
clips=[]
radar=[p for p in liste if p['noeud']=='module_radar' and p['nom']!='axe_radar']
cabine=[p for p in liste if p['nom'] in ['cadre_cabine','verriere','toit_cabine']]
plateau=[p for p in liste if p['nom']=='plateau_arriere']
pneus=[p for p in liste if p['nom'].startswith('pneu_') and p['nom']!='pneu_secours' and not p['nom'].endswith('_jante')]
# Position des surfaces de garde-boue dans corps ; projection YZ fixe.
gardes={p['nom']:p for p in liste if p['nom'].startswith('garde_boue_')}
def distance_projection_centre(centre,triangles):
 yz=triangles[:,:,[1,2]];c=centre[[1,2]]
 cross=lambda u,v:u[:,0]*v[:,1]-u[:,1]*v[:,0]
 aire=cross(yz[:,1]-yz[:,0],yz[:,2]-yz[:,0]);signes=np.stack([cross(yz[:,(k+1)%3]-yz[:,k],c-yz[:,k]) for k in range(3)],axis=1)
 assert not np.any((abs(aire)>1e-12)&(np.all(signes>=-1e-12,axis=1)|np.all(signes<=1e-12,axis=1))), 'Centre dans une surface projetée du garde-boue'
 ds=[]
 for k in range(3):
  a,b=yz[:,k],yz[:,(k+1)%3];d=b-a;t=np.clip(np.sum((c-a)*d,axis=1)/np.maximum(np.sum(d*d,axis=1),1e-30),0,1);ds.append(np.linalg.norm(c-(a+t[:,None]*d),axis=1))
 return float(np.min(ds))
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];t=acc(sm['input'])[:,0];v=acc(sm['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));jr,jp,js=np.inf,np.inf,np.inf;garde={p['nom']:np.inf for p in pneus}
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  _,m=calculer(pose);inv=np.linalg.inv(m[noeuds['corps']])
  def local(parts):
   return np.concatenate([p['local']@(inv@m[p['ni']])[:3,:3].T+(inv@m[p['ni']])[:3,3] for p in parts]).reshape(-1,3)
  r,ca,pl=local(radar),local(cabine),local(plateau)
  jr=min(jr,float(ca[:,2].min()-r[:,2].max()));jp=min(jp,float(r[:,1].min()-pl[:,1].max()))
  secours=local([p for p in liste if p['nom']=='pneu_secours']);central=local([p for p in pneus if p['nom']=='pneu_-1_1'])
  js=min(js,float(secours[:,1].min()-central[:,1].max()))
  for p in pneus:
   mat=inv@m[p['ni']];centre=mat[:3,3]
   nu=local([p]);rayon=float(np.linalg.norm((nu-centre)[:,[1,2]],axis=1).max())
   g=gardes[p['nom'].replace('pneu','garde_boue')]
   triangles=g['local'] # garde_boue est dans corps, déjà repère local corps.
   garde[p['nom']]=min(garde[p['nom']],distance_projection_centre(centre,triangles)-rayon)
 assert jr>.02 and jp>.07 and js>.02 and min(garde.values())>.004,(a['name'],jr,jp,js,garde)
 clips.append({'clip':a['name'],'poses':len(instants),'radarCabineSeparationZ':jr,'radarPlateauSeparationY':jp,'secoursRoueCentraleSeparationY':js,'pneusGardesBoueJeux':garde})
# Vraie bouche de marqueur : rayons dans la chambre puis vers l'avant.
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 good=ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)
 return t[good]
alltri=np.concatenate([p['triangles'] for p in liste]);marqueur=[]
for angle in [None]+list(np.linspace(0,2*np.pi,12,endpoint=False)):
 x,y=(.102,.278) if angle is None else (.102+.0075*np.cos(angle),.278+.0075*np.sin(angle))
 o=np.array([x,y,.352]);h=rayons(o,np.array([0,0,-1]),alltri);profondeur=float(h.min());assert profondeur>.049
 assert not np.any(rayons(o,np.array([0,0,1]),alltri)<.650)
 marqueur.append({'profondeur':profondeur,'avantLibreSur':.650})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB relus par extras.pieces, distances localisées et raccords ; 975 poses de séparation des modules et projection YZ garde-boue/pneus. Aucun rendu.','distancesTriangles':mesures,'raccords':contacts,'raccordsPneusJantes':raccords_pneus,'posesModules':clips,'sondesMarqueur':marqueur,'limites':['Mesures localisées, aucune certification globale des collisions internes.','Gardes-boue : rayon enveloppant les pneus projetés contre arêtes YZ des surfaces ; valeur à chaque pose échantillonnée, pas une preuve continue.','Sondes ponctuelles, aucune preuve de toute section continue.','Chaque clip isolé, transitions et mélanges exclus.','Aucun rendu, appréciation artistique ou FPS.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'distances':len(mesures),'raccords':len(contacts),'raccordsPneus':len(raccords_pneus),'poses':sum(c['poses'] for c in clips),'jeuGardeBoueMinimum':min(v for c in clips for v in c['pneusGardesBoueJeux'].values()),'sondesMarqueur':len(marqueur)}))
