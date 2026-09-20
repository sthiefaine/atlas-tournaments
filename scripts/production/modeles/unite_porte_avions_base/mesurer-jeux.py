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
assert sum(len(p['triangles']) for p in liste)==6308

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
# Ressort : âme et fil séparés, jonctions voisines de la même courbe exclues.
ressort=tout('ressort_antenne');ame=tout('ame_ressort');enregistrer('ressort_ame',ressort,ame,.012)
assert len(ressort)==48*12
segments=[ressort[i*12:(i+1)*12] for i in range(48)];minimum_spires=.03;couples=0
for i in range(48):
 for j in range(i+8,48):
  if min(abs((j-i)%16),16-abs((j-i)%16))>2:continue
  r=distance(segments[i],segments[j],.025);assert r['traversees']==0 and r['minimumMetres']>.008
  minimum_spires=min(minimum_spires,r['minimumMetres']);couples+=1
spring={'tours':3,'segments':48,'diametreFil':.0084,'diametreFouet':.021,'couplesSegmentsSondes':couples,'separationPortionsDistinctes':minimum_spires,'jeuAme':mesures[-1]['minimumMetres']}
# Raccords : intersections voulues entre surfaces des fixations réelles.
contacts=[]
for a,b in [('bras_recepteur','recepteur'),('dos_radar','axe_radar'),('dos_radar','parabole'),('axe_radar','support_radar'),('console_antenne','jambe_console'),('console_antenne','embase_antenne'),('jambe_console','ilot_bas'),('guides_ascenseur','ascenseur_affleurant'),('ceinture_flottaison','borde_evase'),('encorbellement_pont','pont_envol')]:
 r=distance(tout(a),tout(b),.020)
 assert r['traversees']>0 or r['minimumMetres']<1e-7,(a,b,r)
 contacts.append({'pieces':[a,b],'contactIntentionnel':True,**r})
# Distance du plan porteur réel, dans le repère corps commun aux modules.
clips=[]
radar=[p for p in liste if p['noeud']=='module_radar' and p['nom']!='axe_radar']
antenne=[p for p in liste if p['noeud']=='module_antenne']
toit=[p for p in liste if p['nom']=='toit_passerelle']
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];t=acc(sm['input'])[:,0];v=acc(sm['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));jr,jra,ja=np.inf,np.inf,np.inf
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  _,m=calculer(pose);inv=np.linalg.inv(m[noeuds['corps']])
  def local(parts):
   return np.concatenate([p['local']@(inv@m[p['ni']])[:3,:3].T+(inv@m[p['ni']])[:3,3] for p in parts]).reshape(-1,3)
  r,an,to=local(radar),local(antenne),local(toit)
  jr=min(jr,float(r[:,1].min()-to[:,1].max()))
  jra=min(jra,float(r[:,2].min()-an[:,2].max()))
  # Antenne derrière le toit, donc plan séparateur Z, même pendant le repli.
  ja=min(ja,float(to[:,2].min()-an[:,2].max()))
 assert jr>.001 and jra>.03 and ja>.02,(a['name'],jr,jra,ja)
 clips.append({'clip':a['name'],'poses':len(instants),'radarToitSeparationY':jr,'radarAntenneSeparationZ':jra,'antenneToitSeparationZ':ja})
# Rayons verticaux : vraie réservation dans le pont pour la plateforme et les voies.
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 good=ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)
 return t[good]
alltri=np.concatenate([p['triangles'] for p in liste]);pont=tout('pont_envol');lift=tout('ascenseur_affleurant')
assert abs(lift[:,:,1].max()-pont[:,:,1].max())<1e-7
sondes=[]
for x in [-.20,-.119,-.04]:
 for z in [-.25,-.166,-.08]:
  o=np.array([x,.225,z]);d=np.array([0,-1,0]);h=rayons(o,d,pont);assert not np.any(h<.023)
  hh=rayons(o,d,alltri);y=float(o[1]-hh.min());assert abs(y-.210)<1e-7
  sondes.append({'x':x,'z':z,'surfaceY':y})
catapultes=[]
for x in [-.158,-.090]:
 ys=[]
 for z in [.07,.15,.27]:
  o=np.array([x,.230,z]);d=np.array([0,-1,0]);h=rayons(o,d,pont);assert not np.any(h<.05)
  h=rayons(o,d,alltri);y=float(o[1]-h.min());assert abs(y-.1995)<1e-7;ys.append(y)
 catapultes.append({'x':x,'fondVoieY':ys,'hautRailsY':float(tout('rails_catapulte')[:,:,1].max()),'saillieRailsSurPont':float(tout('rails_catapulte')[:,:,1].max()-.210)})
# Plage d'envol libre centrale/avant : sondes verticales, au-dessus du plateau et des rails seulement.
sondes_pont=[]
for x in [-.25,-.205,-.045,0,.045]:
 for z in [.035,.11,.20,.27]:
  o=np.array([x,.650,z]);hh=rayons(o,np.array([0,-1,0]),alltri);y=float(o[1]-hh.min());assert y<.224
  sondes_pont.append({'x':x,'z':z,'hauteurPremiereSurface':y})
# Une chambre courte creuse, aucun projectile, sondes libres vers +Z.
marqueur=[]
for angle in [None]+list(np.linspace(0,2*np.pi,12,endpoint=False)):
 x,y=(.224,.249) if angle is None else (.224+.009*np.cos(angle),.249+.009*np.sin(angle))
 o=np.array([x,y,.377]);h=rayons(o,np.array([0,0,-1]),alltri);profondeur=float(h.min());assert profondeur>.050
 assert not np.any(rayons(o,np.array([0,0,1]),alltri)<.650)
 marqueur.append({'profondeur':profondeur,'avantLibreSur':.650})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB relus par extras.pieces, distances localisées, raccords et sondes ponctuelles ; enveloppes mobiles dans le repère corps commun. Aucun rendu.','ressort':spring,'distancesTriangles':mesures,'raccords':contacts,'posesModules':clips,'ascenseur':{'niveauPontY':float(pont[:,:,1].max()),'niveauPlateformeY':float(lift[:,:,1].max()),'sondes':sondes,'ouvertureReelle':True},'catapultes':catapultes,'sondesPontLibre':sondes_pont,'sondesMarqueur':marqueur,'limites':['Mesures localisées, aucune certification globale des collisions internes.','Sondes ponctuelles, aucune preuve de toute section continue.','Équipements rigides, ascenseur immobile affleurant, catapultes fixes.','Chaque clip isolé, transitions et mélanges exclus.','Aucun rendu, appréciation artistique ou FPS.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'raccords':len(contacts),'ressort':spring,'poses':sum(c['poses'] for c in clips),'radarToit':min(c['radarToitSeparationY'] for c in clips),'radarAntenne':min(c['radarAntenneSeparationZ'] for c in clips),'ascenseurNiveau':float(lift[:,:,1].max()),'sondesPont':len(sondes_pont)}))
