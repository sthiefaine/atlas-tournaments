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
assert sum(len(p['triangles']) for p in liste)==4508

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

# Raccords structurels exacts (intersection des peaux attendue).
contacts=[]
paires=[('plateau_chassis','plancher_cargo'),('plateau_chassis','cabine'),('cabine','pavillon_cabine'),('cabine','pare_brise'),('pavillon_cabine','bloc_moteur'),('bloc_moteur','embase_mat'),('embase_mat','mat_rotor'),('mat_rotor','palier_rotor'),('mat_rotor','moyeu_rotor'),('moyeu_rotor','chapeau_rotor'),('plancher_cargo','platine_grue'),('platine_grue','berceau_grue'),('berceau_grue','axe_epaule'),('axe_epaule','bras_grue'),('bras_grue','axe_coude'),('axe_coude','avant_bras_grue'),('avant_bras_grue','poulie_crochet'),('poulie_crochet','suspente_crochet'),('suspente_crochet','crochet'),('plancher_cargo','coffre_cargo'),('coffre_cargo','couvercle_cargo'),('pavillon_cabine','support_temoin'),('support_temoin','temoin')]
for c in ['g','d']:
 paires.extend([('cabine',f'vitre_laterale_{c}'),('plateau_chassis',f'pylone_{c}'),('bloc_moteur',f'pylone_{c}'),('plateau_chassis',f'rebord_{c}')])
 for z in [-.203,.158]:paires.extend([(f'patin_{c}',f'jambe_{c}_{z}'),(f'jambe_{c}_{z}',f'fourreau_{c}_{z}'),('plateau_chassis',f'fourreau_{c}_{z}')])
for i in range(4):paires.extend([('moyeu_rotor',f'attache_pale_{i}'),(f'attache_pale_{i}',f'pale_{i}')])
for a,b in paires:
 r=distance(tout(a),tout(b),.030)
 assert r['traversees']>0 or r['minimumMetres']<1e-7,(a,b,r)
 contacts.append({'pieces':[a,b],'contactIntentionnel':True,**r})
# Pales : leur plan horizontal reste au-dessus du palier ; invariant autour de Y.
pales=np.concatenate([tout(f'pale_{i}') for i in range(4)]).reshape(-1,3)
rayon=float(np.linalg.norm(pales[:,[0,2]],axis=1).max())
separation_palier=float(pales[:,1].min()-tout('palier_rotor')[:,:,1].max())
separation_mat=float(pales[:,1].min()-tout('mat_rotor')[:,:,1].max())
assert separation_palier>.004 and separation_mat>.002
distances=[]
for a,b in [('crochet','bras_grue'),('avant_bras_grue','cabine'),('bras_grue','cabine'),('crochet','coffre_cargo'),('coffre_cargo','pylone_g')]:
 r={'pieces':[a,b],**distance(tout(a),tout(b),.07)}
 assert r['traversees']==0 and r['minimumMetres']>.002,r
 distances.append(r)
# Contrôle animé dans le repère corps, invariant aux oscillations de l'ensemble.
clips=[]
for a in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in a['channels']:
  sm=a['samplers'][c['sampler']];t=acc(sm['input'])[:,0];v=acc(sm['output']);duree=max(duree,float(t[-1]));instants.extend(t);canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))))
 min_pale_grue=np.inf;min_pale_cabine=np.inf;min_grue_cabine=np.inf;min_crochet_plateau=np.inf;min_crochet_bras=np.inf;min_sol=np.inf;max_pivot=0.;min_crochet_bras_exact=np.inf
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  verts,m=calculer(pose);inv=np.linalg.inv(m[noeuds['corps']]);min_sol=min(min_sol,float(verts[:,1].min()))
  def local(names):
   return np.concatenate([p['local']@(inv@m[p['ni']])[:3,:3].T+(inv@m[p['ni']])[:3,3] for p in liste if p['nom'] in names]).reshape(-1,3)
  def triangles_local(nom):
   return np.concatenate([p['local']@(inv@m[p['ni']])[:3,:3].T+(inv@m[p['ni']])[:3,3] for p in liste if p['nom']==nom])
  clearance=distance(triangles_local('crochet'),triangles_local('bras_grue'),.050)
  assert clearance['traversees']==0 and clearance['minimumMetres']>.003,(a['name'],t,clearance)
  min_crochet_bras_exact=min(min_crochet_bras_exact,clearance['minimumMetres'])
  pp=local([f'pale_{i}' for i in range(4)]);gg=local(['bras_grue','avant_bras_grue','crochet','axe_coude','axe_epaule','poulie_crochet','suspente_crochet']);cc=local(['cabine','pavillon_cabine','support_temoin','temoin']);hh=local(['crochet']);plateau=local(['plancher_cargo']);bras=local(['bras_grue'])
  min_pale_grue=min(min_pale_grue,float(pp[:,1].min()-gg[:,1].max()))
  min_pale_cabine=min(min_pale_cabine,float(pp[:,1].min()-cc[:,1].max()))
  min_grue_cabine=min(min_grue_cabine,float(cc[:,2].min()-gg[:,2].max()))
  min_crochet_plateau=min(min_crochet_plateau,float(hh[:,1].min()-plateau[:,1].max()))
  zmin,zmax=hh[:,2].min(),hh[:,2].max();segment=bras[(bras[:,2]>=zmin-.030)&(bras[:,2]<=zmax+.030)]
  if len(segment):min_crochet_bras=min(min_crochet_bras,float(hh[:,1].min()-segment[:,1].max()))
  centre=(inv@m[noeuds['os_rotor']])[:3,3];max_pivot=max(max_pivot,float(np.linalg.norm(centre-np.array([0,.403,0]))))
 assert min_pale_grue>.15 and min_pale_cabine>.10 and min_grue_cabine>.12 and min_crochet_plateau>.055 and min_sol>=-1e-6 and max_pivot<1e-7,(a['name'],min_pale_grue,min_pale_cabine,min_grue_cabine,min_crochet_plateau,min_sol,max_pivot)
 clips.append({'clip':a['name'],'poses':len(instants),'palesGrueSeparationY':min_pale_grue,'palesCabineSeparationY':min_pale_cabine,'grueCabineSeparationZ':min_grue_cabine,'crochetPlancherSeparationY':min_crochet_plateau,'crochetBrasSondeZoneZ':min_crochet_bras,'crochetBrasDistanceTrianglesMin':min_crochet_bras_exact,'solMin':min_sol,'erreurPivotRotor':max_pivot})
# Colonnes cargo centrales libres jusqu'au plancher à Y=.195.
def rayons(o,d,tri):
 e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0];h=np.cross(d,e2);det=np.sum(e1*h,axis=1);ok=abs(det)>1e-12
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=o-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv
 return t[ok&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>1e-7)]
sondes=[];statique=np.concatenate([p['triangles'] for p in liste if p['noeud'] in ['corps','base']])
for x in [-.015,.010,.035,.060]:
 for z in [-.27,-.22,-.17,-.12]:
  o=np.array([x,.30,z]);h=rayons(o,np.array([0,-1,0]),statique);y=.30-float(h.min());assert abs(y-.195)<1e-6,(x,z,y)
  sondes.append({'x':x,'z':z,'hauteurPlancher':y,'colonneLibreDepuisY':.30})
r={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB et hiérarchie exportés : raccords par intersections des peaux, dégagements statiques exacts ou bornés, séparations d’axes mesurées sur tous clips isolés. Plan des pales invariant autour de Y.','raccords':contacts,'distancesTriangles':distances,'rotor':{'rayonPales':rayon,'palesPalierSeparationYContinue':separation_palier,'palesMatSeparationYContinue':separation_mat,'axe':'+Y','nombrePales':4},'posesModules':clips,'sondesPlancherOuvert':sondes,'limites':['Raccords avec recouvrement intentionnel.','Distances et sondes localisées ; aucune certification globale des collisions.','Dégagements animés aux poses sauf plan rotor/palier invariant.','Aucun rendu, contrôle visuel, approbation artistique, téléphone ou FPS.']}
(sortie/'mesures-jeux.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'raccords':len(contacts),'distances':len(distances),'rotor':r['rotor'],'poses':sum(c['poses'] for c in clips),'sondes':len(sondes)}))
