#!/usr/bin/env python3
"""Contrôles mécaniques localisés des triangles réellement exportés. Aucun rendu."""
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
  p=acc(prim['attributes']['POSITION']);p=p@matrices[ni][:3,:3].T+matrices[ni][:3,3]
  liste.append({'nom':info['nom'],'noeud':n['name'],'triangles':p[idx],'role':info['role']})
assert sum(len(p['triangles']) for p in liste)==8996
def selection(nom):return [p['triangles'] for p in liste if p['nom']==nom]
def tout(nom):return np.concatenate(selection(nom))
def distance(a,b,seuil=.030):
 """Minimum exact triangles dans le seuil ; bornes AABB éliminent les autres paires."""
 amin,amax=a.min(axis=1),a.max(axis=1);bmin,bmax=b.min(axis=1),b.max(axis=1)
 ia,ib=[],[]
 for i in range(len(a)):
  ecart=np.maximum(np.maximum(amin[i]-bmax,bmin-amax[i]),0)
  j=np.flatnonzero(np.linalg.norm(ecart,axis=1)<seuil)
  ia.extend([i]*len(j));ib.extend(j.tolist())
 mini=seuil;intersections=0
 for start in range(0,len(ia),8192):
  aa,bb=a[np.array(ia[start:start+8192])],b[np.array(ib[start:start+8192])]
  ds=[]
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

for cote in ['gauche','droite']:
 roues=selection(f'galets_bandages_{cote}')
 renvois=selection(f'renvois_bandages_{cote}')
 retours=selection(f'rouleaux_retour_{cote}')
 for i in range(len(roues)-1):enregistrer(f'galets_voisins_{cote}_{i}',roues[i],roues[i+1])
 enregistrer(f'galet_renvoi_arriere_{cote}',roues[0],renvois[0])
 enregistrer(f'galet_renvoi_avant_{cote}',roues[-1],renvois[1])
 rail=np.concatenate([tout(f'bande_{cote}'),tout(f'patins_{cote}')])
 for groupe,geos in [('galet',roues),('renvoi',renvois),('retour',retours)]:
  for i,g in enumerate(geos):enregistrer(f'{groupe}_chenille_{cote}_{i}',g,rail)
 # Le corps ne descend que verticalement : on vérifie les triangles au point bas.
 coque=tout('coque_joues_inclinees').copy();coque[:,:,1]-=.012
 enregistrer(f'coque_chenille_point_bas_{cote}',coque,rail)
 jupes=tout('jupes_flancs').copy();jupes[:,:,1]-=.012
 enregistrer(f'jupes_chenille_point_bas_{cote}',jupes,rail)

tubes=selection('tubes_creux')
sep=enregistrer('separation_tubes_jumeles',tubes[0],tubes[1],.20)
bouches=[]
for tube in tubes:
 pp=tube.reshape(-1,3);centre=(pp.min(axis=0)+pp.max(axis=0))/2
 r=np.linalg.norm(pp[:,:2]-centre[:2],axis=1)
 bouches.append({'longueurMetres':float(np.ptp(pp[:,2])),'rayonInterieurSommetsMetres':float(r.min()),'rayonExterieurMaxMetres':float(r.max()),'directionAxe':[0,0,1]})

corps=np.concatenate([p['triangles'] for p in liste if p['noeud']=='corps'])
coque_max=float(corps[:,:,1].max())
tourelle=tout('tourelle_panneaux_equipe')
jeu_tourelle=float(tourelle[:,:,1].min()-coque_max)
jeu_tubes=float(tout('tubes_creux')[:,:,1].min()-coque_max)
jeu_radar_tubes=float(tout('parabole_radar')[:,:,1].min()-tout('tubes_creux')[:,:,1].max())
assert min(jeu_tourelle,jeu_tubes,jeu_radar_tubes)>0

suspension=[]
for cote in ['gauche','droite']:
 for i,(tige,fourreau) in enumerate(zip(selection(f'tiges_suspension_{cote}'),selection(f'fourreaux_suspension_{cote}'))):
  limites_tige=[float(tige[:,:,1].min()),float(tige[:,:,1].max())]
  limites_fourreau=[float(fourreau[:,:,1].min()),float(fourreau[:,:,1].max())]
  engagement=min(min(limites_tige[1],limites_fourreau[1]+dy)-max(limites_tige[0],limites_fourreau[0]+dy) for dy in [-.012,.003])
  # Distance aux vraies faces des fourreaux creux aux deux extrêmes verticaux.
  distances=[]
  for dy in [-.012,.003]:
   f=fourreau.copy();f[:,:,1]+=dy
   distances.append(enregistrer(f'coulisseau_fourreau_{cote}_{i}_{dy}',tige,f,.01))
  assert engagement>.011
  suspension.append({'cote':cote,'indice':i,'tigeY':limites_tige,'fourreauY':limites_fourreau,'engagementMinimalMetres':engagement,'jeuRadialMinimalMetres':min(d['minimumMetres'] for d in distances)})

# Parabole tournant à tout azimut ; distance entre projections de deux disques enveloppes.
pr=matrices[noeuds['module_radar']][:3,3];pa=matrices[noeuds['module_antenne']][:3,3]
radar=tout('parabole_radar').reshape(-1,3)
rayon_radar=float(np.linalg.norm((radar-pr)[:,[0,2]],axis=1).max())
antenne=np.concatenate([p['triangles'] for p in liste if p['noeud']=='module_antenne']).reshape(-1,3)-pa
rayon_antenne=float(np.linalg.norm(antenne[:,[0,2]],axis=1).max())
levier_antenne=float(np.linalg.norm(antenne,axis=1).max());angle=0.
for a in doc['animations']:
 for c in a['channels']:
  if c['target']['node']==noeuds['module_antenne'] and c['target']['path']=='rotation':
   q=acc(a['samplers'][c['sampler']]['output']);angle=max(angle,float((2*np.arccos(np.clip(abs(q[:,3]),0,1))).max()))
# Slerp des rotations livrées proches de l'identité reste dans cette boule angulaire.
assert angle<.1
excursion=2*levier_antenne*np.sin(angle/2)
jeu_radar_antenne=float(np.linalg.norm((pr-pa)[[0,2]])-rayon_radar-rayon_antenne-excursion)
assert jeu_radar_antenne>0

# Bornes analytiques tous azimuts de tourelle, incluant radar et antenne articulés.
centre_corps=matrices[noeuds['corps']][:3,3];offset=float(np.linalg.norm(centre_corps[[0,2]]))
rayons={}
for nom in ['base','corps','module_tourelle','os_recul','module_radar','module_antenne','socle']:
 ni=noeuds[nom];pp=points[ni]
 if nom in ['base','corps']:
  monde=pp@matrices[ni][:3,:3].T+matrices[ni][:3,3];r=float(np.linalg.norm(monde[:,[0,2]],axis=1).max())
 elif nom=='module_tourelle':r=float(np.linalg.norm(pp[:,[0,2]],axis=1).max())+offset
 elif nom in ['module_radar','socle']:
  tr=np.asarray(doc['nodes'][ni]['translation']);r=float(np.linalg.norm(tr[[0,2]])+np.linalg.norm(pp[:,[0,2]],axis=1).max())+offset
 elif nom=='module_antenne':
  tr=np.asarray(doc['nodes'][ni]['translation']);r=float(np.linalg.norm(tr[[0,2]])+rayon_antenne+excursion)+offset
 else:
  tr=np.asarray(doc['nodes'][ni]['translation']);maxtr=float(np.linalg.norm(tr[[0,2]]))
  for a in doc['animations']:
   for c in a['channels']:
    if c['target']['node']==ni and c['target']['path']=='translation':maxtr=max(maxtr,float(np.linalg.norm(acc(a['samplers'][c['sampler']]['output'])[:,[0,2]],axis=1).max()))
  r=maxtr+float(np.linalg.norm(pp[:,[0,2]],axis=1).max())+offset
 rayons[nom]=r
assert max(rayons.values())<.5,rayons
# Vérifie les hypothèses des bornes : seules rotations Y sur tourelle/radar, corps vertical.
for a in doc['animations']:
 for c in a['channels']:
  nom=doc['nodes'][c['target']['node']]['name'];v=acc(a['samplers'][c['sampler']]['output'])
  if c['target']['path']=='rotation' and nom!='module_antenne':assert nom in ['module_tourelle','module_radar'] and np.max(abs(v[:,[0,2]]))<1e-7
  if nom=='corps':assert c['target']['path']=='translation' and np.allclose(v[:,[0,2]],centre_corps[[0,2]])
  if c['target']['path']=='scale':assert nom=='socle' and np.all(v>=0) and np.all(v<=1) and np.all(v==v[:,0,None])

rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'approbationArtistique':False,'methode':'Triangles GLB par plages documentées dans extras.pieces : positions, indices et matrices relus. Distances triangle-triangle exactes lorsque le minimum est sous le seuil, sinon borne AABB. Les raccordements intentionnels ne sont pas considérés comme jeux mécaniques.','chenillesEtRoues':mesures,'bouches':bouches,'jeuxContinuellementBornesMetres':{'tourelleHorsCouronnesVersEquipementsCorps':jeu_tourelle,'tubesVersCorps':jeu_tubes,'paraboleVersTubes':jeu_radar_tubes,'paraboleVersAntenneTousAzimuts':jeu_radar_antenne},'borneAntenne':{'rotationMaxRadians':angle,'excursionMaxMetres':excursion},'rayonHorizontalTousCapsEtTourelleMetres':rayons,'rayonHorizontalMaximumContinu':max(rayons.values()),'espaceMinimumDeuxVoisinsTousCaps':1-2*max(rayons.values()),'suspension':{'tigesFixesY':[.124,.172],'fourreauxYAuRepos':[.1575,.2225],'deplacementCorpsY':[-.012,.003],'engagementMinimalMetres':.0115,'description':'Quatre tiges coulissent dans des fourreaux plus larges ; assemblage volontaire, translation verticale du corps uniquement.'},'limites':['Aucun contrôle visuel ni approbation artistique.','Distances localisées ; pas de certification globale de non-intersection des éléments assemblés.','Patins et bandes restent rigides ; pas de défilement mécanique des chenilles.','La borne tous caps vaut pour le gabarit b sans déformation et les clips livrés ; pas pour des mélanges arbitraires ni un autre gabarit.','Les mesures des chenilles/coque au point bas sont complétées par la séparation verticale : corps au-dessus des bandes ; les fixations et coulisseaux se recouvrent intentionnellement.']}
rapport['suspension']={'deplacementCorpsY':[-.012,.003],'fourreauxCreux':True,'mesuresGLB':suspension,'engagementMinimalMetres':min(s['engagementMinimalMetres'] for s in suspension),'methode':'Intervalles Y et distances des triangles relus ; extrema de translation verticale LINEAR. Les tiges restent engagées dans des fourreaux creux et conservent un jeu radial positif.'}
(sortie/'mesures-jeux.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'mesuresLocalisees':len(mesures),'jeuMinimum':min(r['minimumMetres'] for r in mesures),'rayonTousAzimuts':max(rayons.values()),'jeux':rapport['jeuxContinuellementBornesMetres']},ensure_ascii=False))
