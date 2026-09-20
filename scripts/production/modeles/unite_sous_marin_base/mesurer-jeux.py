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
assert sum(len(p['triangles']) for p in liste)==5060

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
# Ressort : distances entre le fil exporté, l'âme et les spires adjacentes.
ressort=tout('ressort_antenne');ame=tout('ame_ressort');enregistrer('ressort_ame',ressort,ame,.016)
assert len(ressort)==72*12
segments=[ressort[i*12:(i+1)*12] for i in range(72)];minimum_spires=.03;couples=0
for i in range(72):
 for j in range(i+12,72):
  if min(abs((j-i)%24),24-abs((j-i)%24))>2:continue
  r=distance(segments[i],segments[j],.020);assert r['traversees']==0 and r['minimumMetres']>.004
  minimum_spires=min(minimum_spires,r['minimumMetres']);couples+=1
spring={'tours':3,'segments':72,'diametreFil':.0084,'diametreFouet':.022,'couplesSegmentsSondes':couples,'separationPortionsDistinctes':minimum_spires,'jeuAme':mesures[-1]['minimumMetres']}
# Raccords mesurés sur les surfaces, y compris les liaisons structurelles utiles.
contacts=[]
paires=[('coque_capsule','ceinture_flottaison'),('coque_capsule','quille'),('coque_capsule','kiosque'),('kiosque','support_antenne'),('support_antenne','collerette_basse'),('ame_ressort','collerette_basse'),('ame_ressort','collerette_haute'),('collerette_basse','ressort_antenne'),('ressort_antenne','collerette_haute'),('fouet_antenne','collerette_haute'),('fouet_antenne','embout_fouet'),('coque_capsule','derive_superieure'),('coque_capsule','carter_poupe'),('carter_poupe','arbre_helice'),('arbre_helice','moyeu_helice'),('coque_capsule','berceau_marqueur'),('berceau_marqueur','rail_marqueur'),('rail_marqueur','culasse_marqueur'),('culasse_marqueur','tube_marqueur'),('support_temoin','temoin')]
for side in ['g','d']:
 paires.extend([('coque_capsule',f'plan_lateral_{side}'),('coque_capsule',f'plan_avant_{side}'),('kiosque',f'poignee_{side}'),('carter_poupe',f'support_couronne_{side}'),('couronne_propulsion',f'support_couronne_{side}')])
for i in range(5):paires.append(('moyeu_helice',f'pale_{i}'))
for a,b in paires:
 r=distance(tout(a),tout(b),.020)
 assert r['traversees']>0 or r['minimumMetres']<1e-7,(a,b,r)
 contacts.append({'pieces':[a,b],'contactIntentionnel':True,**r})
# Couronne : les pales tournent dans le même plan XY, le rayon reste invariant.
pales=np.concatenate([tout(f'pale_{i}') for i in range(5)]).reshape(-1,3)
rayon_pales=float(np.linalg.norm(pales[:,:2]-np.array([0,.153]),axis=1).max())
# Rayon inscrit du polygone intérieur de 28 segments, conservateur pour tout angle.
rayon_interieur=.069*np.cos(np.pi/28);jeu_helice=rayon_interieur-rayon_pales
assert jeu_helice>.002
for i in range(5):
 enregistrer(f'pale_{i}_couronne',tout(f'pale_{i}'),tout('couronne_propulsion'),.012)
for i in range(5):
 for j in range(i+1,5):enregistrer(f'pales_{i}_{j}',tout(f'pale_{i}'),tout(f'pale_{j}'),.020)
# Séparation axiale hélice / traverses de fixation, indépendante de sa rotation.
supports=np.concatenate([tout('support_couronne_g'),tout('support_couronne_d')]).reshape(-1,3)
separation_z=float(supports[:,2].min()-pales[:,2].max());assert separation_z>.002
# Relecture de tous clips : support constant autour du pivot de l'antenne,
# barre/rail de recul raccordés ; capsule/sol contrôlés par la mesure de poses.
clips=[]
antenne=[p for p in liste if p['noeud']=='module_antenne' and p['nom'] not in ['ame_ressort','collerette_basse']]
kiosque=[p for p in liste if p['nom']=='kiosque']
recul=[p for p in liste if p['nom']=='culasse_marqueur']
rail=[p for p in liste if p['nom']=='rail_marqueur']
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];t=acc(sm['input'])[:,0];v=acc(sm['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));antenne_kiosque=np.inf;rail_recouvrement=np.inf
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  _,m=calculer(pose);inv=np.linalg.inv(m[noeuds['corps']])
  def local(parts):
   return np.concatenate([p['local']@(inv@m[p['ni']])[:3,:3].T+(inv@m[p['ni']])[:3,3] for p in parts]).reshape(-1,3)
  an,ki,rr,ra=local(antenne),local(kiosque),local(recul),local(rail)
  antenne_kiosque=min(antenne_kiosque,float(an[:,1].min()-ki[:,1].max()))
  rail_recouvrement=min(rail_recouvrement,float(min(rr[:,2].max(),ra[:,2].max())-max(rr[:,2].min(),ra[:,2].min())))
 assert antenne_kiosque>.01 and rail_recouvrement>.06,(a['name'],antenne_kiosque,rail_recouvrement)
 clips.append({'clip':a['name'],'poses':len(instants),'antenneHorsEmbaseKiosqueSeparationY':antenne_kiosque,'reculRailRecouvrementZ':rail_recouvrement})
# Sonde du lanceur : chambre réellement creuse et couloir +Z libre.
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 return t[ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)]
appuis=[]
for z in [.198,.235,.272]:
 o=np.array([0,.34,z]);h=rayons(o,np.array([0,-1,0]),tout('coque_capsule'));haut_coque=float(o[1]-h.min());recouvrement=haut_coque-float(tout('berceau_marqueur')[:,:,1].min());assert recouvrement>.003
 appuis.append({'z':z,'hautCoque':haut_coque,'basBerceau':float(tout('berceau_marqueur')[:,:,1].min()),'recouvrementY':recouvrement})
alltri=np.concatenate([p['triangles'] for p in liste]);sondes=[]
for ang in [None]+list(np.linspace(0,np.pi*2,12,endpoint=False)):
 x,y=(0,.337) if ang is None else (.008*np.cos(ang),.337+.008*np.sin(ang))
 o=np.array([x,y,.327]);h=rayons(o,np.array([0,0,-1]),alltri);profondeur=float(h.min());assert profondeur>.035
 assert not np.any(rayons(o,np.array([0,0,1]),alltri)<.65)
 sondes.append({'profondeur':profondeur,'avantLibre':.65})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB relus par extras.pieces ; raccords, distances localisées et sondes ponctuelles. Hélice : rayon circonscrit des pales comparé au rayon inscrit de couronne pour tout angle.','ressort':spring,'helice':{'rayonPales':rayon_pales,'rayonInterieurInscritCouronne':rayon_interieur,'jeuContinuToutAngle':jeu_helice,'separationZSupports':separation_z},'distancesTriangles':mesures,'raccords':contacts,'posesModules':clips,'sondesMarqueur':sondes,'sondesAppuiBerceau':appuis,'limites':['Raccords avec recouvrement intentionnel.','Mesures localisées, aucune certification globale des collisions.','Sondes ponctuelles, ne prouvent pas toute une section.','Aucun rendu, contrôle visuel, approbation artistique, téléphone ou FPS.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'raccords':len(contacts),'ressort':spring,'helice':rapport['helice'],'poses':sum(c['poses'] for c in clips),'sondesMarqueur':len(sondes)}))
