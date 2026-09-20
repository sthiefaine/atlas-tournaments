#!/usr/bin/env python3
"""Dégagements mécaniques localisés sur les triangles exportés, sans image."""
from geometrie import *
from collections import defaultdict

meta=json.loads((sortie/'reperes-pieces.json').read_text())['reperes']
mat_names={i:m['name'] for i,m in enumerate(doc['materials'])}
pieces={}
compte=defaultdict(int)
for r in meta:
 n=doc['nodes'][noeuds[r['noeud']]]
 prims=[p for p in doc['meshes'][n['mesh']]['primitives'] if mat_names[p['material']]==r['materiau']]
 assert len(prims)==1
 p=prims[0];indices=acc(p['indices']).astype(int).ravel().reshape(-1,3)
 debut=r['premierTriangle'];fin=debut+r['nombreTriangles'];tri=acc(p['attributes']['POSITION'])[indices[debut:fin]]
 assert len(tri)==r['nombreTriangles']
 cle=(r['noeud'],r['materiau']);assert compte[cle]==debut;compte[cle]=fin
 if 'skin' in n:
  skin=doc['skins'][n['skin']];j=skin['joints'][r['os']];m=acc(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)[r['os']]
  # Les poids des triangles de cette pièce correspondent réellement à l'os déclaré.
  poids=acc(p['attributes']['WEIGHTS_0'])[indices[debut:fin]];os=acc(p['attributes']['JOINTS_0'])[indices[debut:fin]]
  assert np.all(poids==np.array([1,0,0,0])) and np.all(os[:,:,0]==r['os'])
  tri=tri@m[:3,:3].T+m[:3,3]
 else:j=noeuds[r['noeud']]
 pieces.setdefault(r['etiquette'],[]).append((j,tri))
for (n,mat),ntri in compte.items():
 prim=next(p for p in doc['meshes'][doc['nodes'][noeuds[n]]['mesh']]['primitives'] if mat_names[p['material']]==mat)
 assert ntri==len(acc(prim['indices']))//3
assert sum(compte.values())==json.loads((sortie/'fabrication.json').read_text())['triangles']

def deformer(matrices):
 # Repère du corps : annule sa translation et inclinaison communes à toutes les pièces.
 retour=np.linalg.inv(matrices[noeuds['corps']])
 resultat={}
 for nom,ps in pieces.items():
  tris=[]
  for node,tri in ps:
   m=retour@matrices[node];tris.append(tri@m[:3,:3].T+m[:3,3])
  resultat[nom]=np.concatenate(tris)
 return resultat

def radial_min(tris,centre):
 # Distance exacte du point aux triangles projetés sur XZ : le minimum de leur
 # enveloppe convexe suffit pour une borne conservative aux disques balayés.
 h=tris[:,:,[0,2]]-np.asarray(centre)[None,None,:]
 result=[]
 for i in range(3):
  a,b=h[:,i],h[:,(i+1)%3];d=b-a;t=np.clip(-np.sum(a*d,axis=1)/np.maximum(np.sum(d*d,axis=1),1e-30),0,1);result.append(np.linalg.norm(a+t[:,None]*d,axis=1))
 c=np.stack([h[:,(i+1)%3,0]*h[:,i,1]-h[:,(i+1)%3,1]*h[:,i,0] for i in range(3)],axis=1)
 dedans=np.all(c>1e-15,axis=1)|np.all(c<-1e-15,axis=1)
 d=np.min(np.stack(result),axis=0);d[dedans]=0
 return float(d.min())

_,matrices=calculer({});neutre=deformer(matrices)
rotors={}
for nom in ['gauche','droit']:
 node=noeuds['os_rotor_'+nom];centre=(np.linalg.inv(matrices[noeuds['corps']])@matrices[node])[:3,3]
 pale=neutre['pales_'+nom];ensemble=np.concatenate([pale,neutre['embouts_'+nom]])
 rotors[nom]={'centre':centre,'rmin':radial_min(pale,centre[[0,2]]),'rmax':float(np.linalg.norm(ensemble[:,:,[0,2]]-centre[[0,2]],axis=2).max()),'ymin':float(ensemble[:,:,1].min()),'ymax':float(ensemble[:,:,1].max())}
 # Au moins quatre sommets intérieurs de CHAQUE pale pénètrent dans le moyeu :
 # raccord rigide volontaire, aucun point d'attache flottant.
 enracinement=[]
 # Métadonnées d'export, une entrée par pale, la face d'attaque est conservée.
 for node,tri in pieces['pales_'+nom]:
  assert node==noeuds['os_rotor_'+nom]
  radius=np.linalg.norm(tri[:,:,[0,2]],axis=2);ymonde=tri[:,:,1]+.4
  rh=.049+(.035-.049)*(ymonde-.391)/.024
  selection=(ymonde>=.391)&(ymonde<=.415)&(radius<rh)
  assert np.count_nonzero(selection)>=4
  enracinement.append(float((rh-radius)[selection].max()))
 rotors[nom]['enracinementRadialMaxParPale']=enracinement

# Les pièces fixes ne peuvent toucher une pale si leur intervalle Y est séparé,
# ou leur projection XZ ne rencontre pas l'anneau complet balayé par les pales.
# Les moyeux sont les raccords intentionnels ; ils ne font pas partie des obstacles.
separations={};min_radar_antenne=float('inf');min_radar_capsule=float('inf');nombre=0
for animation in doc['animations']:
 canaux=[];duree=0;instants=[]
 for c in animation['channels']:
  samp=animation['samplers'][c['sampler']];t=acc(samp['input'])[:,0];v=acc(samp['output']);duree=max(duree,float(t[-1]));instants.extend(t)
  canaux.append((c['target']['node'],c['target']['path'],t,v))
 for t in sorted(set(instants+list(np.linspace(0,duree,193)))):
  pose={}
  for i,canal,temps,valeurs in canaux:pose.setdefault(i,{})[canal]=interpoler(temps,valeurs,t,canal=='rotation')
  _,m=calculer(pose);ps=deformer(m);nombre+=1
  # Les deux axes de rotor restent fixes dans le corps, seul le rotor tourne en +Y.
  for nom,r in rotors.items():
   centre=(np.linalg.inv(m[noeuds['corps']])@m[noeuds['os_rotor_'+nom]])[:3,3]
   assert np.linalg.norm(centre-r['centre'])<1e-6
   for etiquette,tri in ps.items():
    if any(etiquette.startswith(prefixe) for prefixe in ['pales_','embouts_','moyeu_','chapeau_rotor_']):continue
    radialmini=radial_min(tri,centre[[0,2]])
    radialmaxi=float(np.linalg.norm(tri[:,:,[0,2]]-centre[[0,2]],axis=2).max())
    radial=max(radialmini-r['rmax'],r['rmin']-radialmaxi)
    vertical=max(float(tri[:,:,1].min())-r['ymax'],r['ymin']-float(tri[:,:,1].max()))
    jeu=max(radial,vertical);cle=nom+' / '+etiquette
    separations[cle]=min(separations.get(cle,float('inf')),jeu)
  radar=np.concatenate([ps[n] for n in ['radome','jonc_radome','panneaux_equipe_radar','bras_pliant_radar','moyeu_disque_radar']])
  antenne=np.concatenate([ps[n] for n in ['fouet','embout_fouet','ressort_antenne','collier_fouet','ame_ressort']])
  # Le cylindre qui contient le radar est séparé de l'antenne, tous azimuts.
  rayon_radar=float(np.linalg.norm(radar[:,:,[0,2]],axis=2).max())
  min_radar_antenne=min(min_radar_antenne,radial_min(antenne,[0,0])-rayon_radar)
  min_radar_capsule=min(min_radar_capsule,float(radar[:,:,1].min()-ps['capsule_arrondie'][:,:,1].max()))
assert all(v>0 for v in separations.values()),{k:v for k,v in separations.items() if v<=0}
assert min_radar_antenne>0 and min_radar_capsule>0,(min_radar_antenne,min_radar_capsule)
# Les patins sont à même altitude. Hors-jeu : corps descend exactement de la garde.
patins=neutre['patins_atterrissage']
sol_neutre=float(patins[:,:,1].min()+doc['nodes'][noeuds['corps']]['translation'][1])
assert abs(sol_neutre-.035)<1e-6
rapport={'id':identifiant,'approbationArtistique':False,'lectureTrianglesGlb':True,'piecesIndexees':len(meta),'posesMecaniques':nombre,'rotors':{n:{k:v.tolist() if isinstance(v,np.ndarray) else v for k,v in r.items()} for n,r in rotors.items()},'separationsAnneauxBalayesPiecesMetres':separations,'jeuMinimalRadarAntenneMetres':min_radar_antenne,'jeuVerticalMinimalRadarCapsuleMetres':min_radar_capsule,'gardeAuSolNeutreMetres':sol_neutre,'poseHorsJeuPatinsAuSol':True,'raccordsIntentionnels':['Enracinement des huit pales dans leurs moyeux.','Axe fixe de moteur dans le palier du moyeu tournant.','Mât, charnière, bras radar et moyeu du radôme raccordés.','Console et embase du ressort, colliers de fouet raccordés.','Panneaux, capots et détails rapportés dans la surface porteuse.'],'methode':'Triangles exportés indexés par les plages de fusion. Pales bornées par un anneau horizontal complet ; chaque obstacle est séparé de cet anneau soit verticalement soit radialement. Radar et antenne séparés par deux cylindres centrés sur le pivot radar ; radar et capsule séparés en hauteur. Mesures invariantes aux poses du corps, contrôles à 193 instants + clés exactes de chaque clip.','limites':['Dégagements localisés, aucune certification globale des collisions internes.','Les poses mécaniques sont échantillonnées ; la majoration continue globale de voisinage figure dans mesures-poses-glb.json.','Raccords intentionnels non interprétés comme défauts.','Chaque clip seul : transitions et mélanges non certifiés.','Aucun rendu ni contrôle visuel.']}
(sortie/'mesures-degagements.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'poses':nombre,'degagements':len(separations),'jeuMinimalMetres':min(separations.values()),'radarAntenne':min_radar_antenne,'radarCapsule':min_radar_capsule,'patinsNeutres':sol_neutre},ensure_ascii=False))
