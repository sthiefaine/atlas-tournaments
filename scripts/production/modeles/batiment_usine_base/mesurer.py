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
assert nbtri<=5600 and degenerate==0 and uvdeg==0 and normdot>0 and normalerr<1e-6 and tangenterr<1e-5,(nbtri,degenerate,uvdeg,normdot,normalerr,tangenterr)

def distance(a,b):
 a=pieces[a]['triangles'];b=pieces[b]['triangles'];aa=np.repeat(a,len(b),axis=0);bb=np.tile(b,(len(a),1,1));ds=[]
 for j in range(3):
  ds.append(point_triangle(aa[:,j],bb));ds.append(point_triangle(bb[:,j],aa))
  if traverse(aa[:,j],aa[:,(j+1)%3],bb).any() or traverse(bb[:,j],bb[:,(j+1)%3],aa).any():return 0.
  for k in range(3):ds.append(segments_distance(aa[:,j],aa[:,(j+1)%3],bb[:,k],bb[:,(k+1)%3]))
 return float(np.min(ds))

# Raccords structurels du bâtiment, du portique, du palan et du rangement.
raccords=[('dalle','mur_arriere'),('dalle','mur_lateral_-0.302'),('dalle','mur_lateral_0.222'),('mur_arriere','mur_lateral_-0.302'),('mur_arriere','mur_lateral_0.222'),('mur_lateral_-0.302','jambage_-0.28'),('mur_lateral_0.222','jambage_0.2'),('jambage_-0.28','linteau'),('jambage_0.2','linteau'),('linteau','coffre_rideau'),('coffre_rideau','rideau'),('rideau','poignee_rideau'),('dalle','seuil'),('seuil','rideau'),('linteau','console_capture'),('console_capture','fond_glissiere'),('fond_glissiere','indicateur_capture'),('poutre_semelle_basse','poutre_ame'),('poutre_ame','poutre_semelle_haute'),('traverse_chariot','joue_chariot_0.31'),('traverse_chariot','joue_chariot_0.406'),('traverse_chariot','palan'),('palan','axe_palan'),('palan','maillon_0'),('maillon_10','emergence_crochet'),('emergence_crochet','crochet'),('mur_lateral_-0.302','râtelier'),('linteau','support_lampe'),('support_lampe','lentille_lampe')]
# Trois sheds ont chacun une pente reliée à son vitrage et à ses deux joues.
for j in range(3):
 raccords += [(f'pan_shed_{j}',f'rive_haute_{j}'),(f'verriere_{j}',f'traverse_verriere_{j}_0.588'),(f'verriere_{j}',f'traverse_verriere_{j}_0.784'),(f'traverse_verriere_{j}_0.784',f'rive_haute_{j}')]
 for x,wall in [(-.315,'mur_lateral_-0.302'),(.235,'mur_lateral_0.222')]:raccords += [(wall,f'joue_shed_{j}_{x}'),(f'joue_shed_{j}_{x}',f'pan_shed_{j}')]
for z in [-.33,.176]:raccords += [('dalle',f'pied_portique_{z}'),(f'pied_portique_{z}',f'montant_portique_{z}'),(f'montant_portique_{z}','poutre_semelle_basse')]
for k in [0,1]:raccords.append(('dalle',f'caisse_{k}'))
raccords.append(('caisse_0','caisse_2'))
for x,wheel in [(.3175,.333),(.3985,.383)]:
 for z in [-.097,-.033]:raccords += [(f'axe_galet_{x}_{z}',f'galet_chariot_{wheel}_{z}'),(f'axe_galet_{x}_{z}','joue_chariot_0.31' if x<.35 else 'joue_chariot_0.406')]
for k in range(3):raccords += [(f'pneu_rechange_{k}',f'jante_rechange_{k}'),(f'jante_rechange_{k}',f'moyeu_rechange_{k}')]
rac=[{'a':a,'b':b,'distanceMetres':distance(a,b)} for a,b in raccords]
assert all(x['distanceMetres']<.0007 for x in rac),[x for x in rac if x['distanceMetres']>=.0007]

# Hall creux : segments dans son volume, derrière le rideau volontairement fermé.
fixed=np.concatenate([p['triangles'] for p in pieces.values() if p['node'] in [noeuds['corps'],noeuds['toit']]])
probes=0
for y in [.10,.30,.49]:
 for z in [-.30,-.15,-.015]:
  a=np.array([-.245,y,z]);b=np.array([.164,y,z]);assert not traverse(np.broadcast_to(a,(len(fixed),3)),np.broadcast_to(b,(len(fixed),3)),fixed).any();probes+=1
# Aucun toit opaque placé derrière les surfaces nord : sondes dans les verrières jusqu'au jour intérieur.
for j in range(3):
 glass=pieces[f'verriere_{j}']['triangles'];ns=np.cross(glass[:,1]-glass[:,0],glass[:,2]-glass[:,0]);assert (ns[:,2]<-1e-8).any()
 z0=-.402+j*.151
 # Rayons courts à travers les seules faces vitrées : exactement 2 intersections uniques (avant/arrière).
 for x in [-.22,-.045,.14]:
  a=np.array([x,.70,z0-.010]);b=np.array([x,.70,z0+.025]);hits=[]
  for name,p in pieces.items():
   t=p['triangles']
   if traverse(np.broadcast_to(a,(len(t),3)),np.broadcast_to(b,(len(t),3)),t).any():hits.append(name)
  assert hits==[f'verriere_{j}'],hits
  probes+=1
# Approche : aucun accessoire, palan compris, au-delà de Z 0,230.
for n,p in pieces.items():
 if n!='dalle':assert p['triangles'][:,:,2].max()<.230,n

clips=[];poses_total=0;jeu_butees=1;jeu_rails=1;jeu_trolley=1
for clip in doc['animations']:
 canaux=[];keys=[];duration=0
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];a=doc['accessors'][s['input']];t=acc(s['input']).ravel();v=acc(s['output']);target=c['target']
  assert s.get('interpolation','LINEAR')=='LINEAR' and a['type']=='SCALAR' and a['componentType']==5126 and np.all(np.diff(t)>0)
  assert np.allclose(a['min'],[t.min()]) and np.allclose(a['max'],[t.max()]);assert doc['nodes'][target['node']]['name'] in ['chariot','enseigne'];assert target['path']=='translation'
  canaux.append((target['node'],target['path'],t,v));keys.extend(t.tolist());duration=max(duration,float(t[-1]))
 times=sorted(set(np.linspace(0,duration,17).tolist()+keys));mini=np.full(3,np.inf);maxi=-mini;maxdelta=0;mobile_min=np.full(3,np.inf);mobile_max=-mobile_min;probes_clips=[]
 for t in times:
  overrides={}
  for n,p,tt,vv in canaux:overrides.setdefault(n,{})[p]=interpoler(tt,vv,t,p=='rotation')
  vertices,mat=calculer(overrides);moving=canaux[0][0];pv=points[moving]@mat[moving][:3,:3].T+mat[moving][:3,3];mobile_min=np.minimum(mobile_min,pv.min(0));mobile_max=np.maximum(mobile_max,pv.max(0))
  if t in keys:probes_clips.append({'t':t,'matrice':mat[moving].reshape(-1).tolist()})
  mini=np.minimum(mini,vertices.min(0));maxi=np.maximum(maxi,vertices.max(0))
  for n in ['racine','corps','toit']:maxdelta=max(maxdelta,float(abs(mat[noeuds[n]]-repos[noeuds[n]]).max()))
  ip=pieces['indicateur_capture']['local']@mat[noeuds['enseigne']][:3,:3].T+mat[noeuds['enseigne']][:3,3]
  jeu_butees=min(jeu_butees,float(ip[:,:,0].min()-pieces['butee_capture_-0.177']['triangles'][:,:,0].max()),float(pieces['butee_capture_0.097']['triangles'][:,:,0].min()-ip[:,:,0].max()))
  jeu_rails=min(jeu_rails,float(ip[:,:,2].min()-pieces['rail_capture_0.035']['triangles'][:,:,2].max()),float(pieces['rail_capture_0.131']['triangles'][:,:,2].min()-ip[:,:,2].max()))
  assert abs(float(ip[:,:,1].min())-float(pieces['fond_glissiere']['triangles'][:,:,1].max()))<1e-7
 assert mini[1]>=-1e-7 and np.max(abs(mini[[0,2]]))<.5 and np.max(abs(maxi[[0,2]]))<.5 and maxi[1]<.87 and maxdelta==0
 first,_=calculer({n:{p:v[0]} for n,p,t,v in canaux});last,_=calculer({n:{p:v[-1]} for n,p,t,v in canaux});end_delta=float(abs(first-last).max());assert end_delta<1e-7
 clips.append({'nom':clip['name'],'duree':duration,'poses':len(times),'cibles':[doc['nodes'][n]['name'] for n,p,t,v in canaux],'enveloppe':{'min':mini.tolist(),'max':maxi.tolist()},'ecartDebutFin':end_delta,'racineCorpsToitImmobiles':True,'mobile':{'nom':doc['nodes'][canaux[0][0]]['name'],'min':mobile_min.tolist(),'max':mobile_max.tolist(),'probesCles':probes_clips}});poses_total+=len(times)
assert jeu_butees>.010 and jeu_rails>.007,(jeu_butees,jeu_rails)
# Translation LINEAR : enveloppe continue exactement bornée par les clés, pas seulement les poses.
chariot=next(c['mobile'] for c in clips if c['nom']=='repos');hall=np.concatenate([p['triangles'] for n,p in pieces.items() if n.startswith(('mur_','joue_shed_','pan_shed_','rive_','verriere_','meneau_'))]);gap_hall=chariot['min'][0]-hall[:,:,0].max();assert gap_hall>.030
frontstop=pieces['butee_portique_0.197']['triangles'];rearstop=pieces['butee_portique_-0.351']['triangles'];gap_stops=min(chariot['min'][2]-rearstop[:,:,2].max(),frontstop[:,:,2].min()-chariot['max'][2]);assert gap_stops>.13
hook=pieces['crochet']['triangles'];gap_ground=float(hook[:,:,1].min()-.026);assert gap_ground>.19
# Chariot sur semelle en toute translation Z ; galets tangents au-dessus, joues sur les flancs libres.
wheel_floor=min(p['triangles'][:,:,1].min() for n,p in pieces.items() if n.startswith('galet_chariot_'));beam_top=float(pieces['poutre_semelle_basse']['triangles'][:,:,1].max());assert abs(wheel_floor-beam_top)<1e-7
# Chaîne : maillons connexes au sens entrelacé, distance de surface positive entre voisins.
chain_gaps=[distance(f'maillon_{j}',f'maillon_{j+1}') for j in range(10)];assert min(chain_gaps)>.0001,chain_gaps
# Crochet fermé comme une section épaisse, bouche restant ouverte : 2 incidences par arête.
hook_shell=np.concatenate([pieces[n]['triangles'] for n in ['crochet','crochet_bouchon_0','crochet_bouchon_1']]);edges={}
for tri in hook_shell:
 keys=[tuple(np.round(v,6)) for v in tri]
 for j in range(3):
  e=tuple(sorted([keys[j],keys[(j+1)%3]]));edges[e]=edges.get(e,0)+1
assert set(edges.values())=={2},'Section du crochet non fermée'
# Normales des bandes du tube pointant loin de leur segment axial ; pas de pli inversé.
centerline=[];hook_radial_min=1.0
for k in range(16):
 tri=hook[k*16:(k+1)*16];a=tri[::2,0].mean(axis=0);b=tri[::2,1].mean(axis=0);centerline.append(a)
 cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);cross/=np.linalg.norm(cross,axis=1)[:,None];mid=tri.mean(axis=1);v=b-a;s=np.clip(((mid-a)*v).sum(1)/np.dot(v,v),0,1);radial=mid-(a+s[:,None]*v);radial/=np.linalg.norm(radial,axis=1)[:,None];hook_radial_min=min(hook_radial_min,float((cross*radial).sum(1).min()))
centerline.append(b);assert hook_radial_min>.50,hook_radial_min
cap_out=[]
for end in [0,1]:
 tri=pieces[f'crochet_bouchon_{end}']['triangles'];n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);n/=np.linalg.norm(n,axis=1)[:,None];v=centerline[-1]-centerline[-2] if end else centerline[0]-centerline[1];v/=np.linalg.norm(v);cap_out.append(float((n@v).min()))
assert min(cap_out)>.8,cap_out
# Retour continu du repos, vitesse identique avant/après bouclage.
ss=doc['animations'][0]['samplers'][0];tt=acc(ss['input']).ravel();vv=acc(ss['output']);speed_delta=float(np.linalg.norm((vv[1]-vv[0])/(tt[1]-tt[0])-(vv[-1]-vv[-2])/(tt[-1]-tt[-2])));assert speed_delta<1e-6
imgs={c:np.array(Image.open(sortie/f'{identifiant}_{c}.png')) for c in ['albedo','normale','rugosite','emission','masque_equipe']}
mask=imgs['masque_equipe'];assert set(np.unique(mask))=={0,255};a=imgs['albedo'].reshape(512,2,512,2,3).mean((1,3));assert np.all(a[mask==255,0]==a[mask==255,1]) and np.all(a[mask==255,1]==a[mask==255,2]);assert not (imgs['emission'][mask==255]>0).any()
for n,p in pieces.items():
 uv=np.concatenate([p['uv'].reshape(-1,2),p['uv'].mean(axis=1)]);xy=np.minimum((uv*512).astype(int),511);m=mask[xy[:,1],xy[:,0]];e=imgs['emission'][xy[:,1],xy[:,0]];assert np.all(m==(255 if p['role']==2 else 0)),n;assert np.all(np.any(e>0,axis=1)==(p['role'] in [4,10])),n
assert doc['nodes'][noeuds['racine']]['extras']['atlasAnimationsBatiment'] is True
assert len(doc['materials'])==2 and sorted(m['name'] for m in doc['materials'])==['mat_corps','mat_vitrage'];glass=next(m for m in doc['materials'] if m['name']=='mat_vitrage');assert glass['emissiveTexture']['index']==3
assert len(doc['images'])==5 and all('uri' in i and '/' not in i['uri'] and 'bufferView' not in i for i in doc['images'])
vertices,_=calculer({})
report={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'triangles':nbtri,'primitives':sum(len(m['primitives']) for m in doc['meshes']),'noeuds':list(noeuds),'bornes':{'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist(),'dimensions':np.ptp(vertices,axis=0).tolist()},'geometrie':{'trianglesDegeneres':degenerate,'trianglesUvDegeneres':uvdeg,'normalesSensFaceMin':normdot,'erreurNormalesMax':normalerr,'erreurTangentesMax':tangenterr,'uvMin':uvmin,'uvMax':uvmax},'raccords':rac,'halle':{'creuse':True,'sheds':3,'vitragesVers':'-Z','sondesInterieurEtVerrieres':probes,'rideauFermeFixe':True},'aire':{'approcheLibreXZ':{'min':[-.43,.230],'max':[.43,.44]},'hauteurPlateau':.026,'limite':'Zone dégagée mesurée ; visibilité pour toutes les figurines non évaluée.'},'animations':{'poses':poses_total,'clips':clips,'vitesseBoucleEcart':speed_delta,'jeuIndicateurRailsMin':jeu_rails,'jeuIndicateurButeesMin':jeu_butees,'gardeContinueChariotHalle':float(gap_hall),'gardeContinueChariotButees':float(gap_stops),'gardeContinueCrochetSol':gap_ground,'maillonsVoisinsDistanceSurfaceMin':min(chain_gaps),'galetsSurSemelleEcart':float(wheel_floor-beam_top),'crochetSectionFermee':True,'crochetNormalesRadialesMin':hook_radial_min,'crochetBouchonsSortantsMin':min(cap_out),'preuveContinue':'Translations LINEAR uniquement ; enveloppes et distances de séparation selon X/Y/Z atteignent leurs extrêmes aux clés. Dalle, murs et toit inchangés.','optIn':True},'textures':{'masqueBinaire':True,'grisNeutreSurMasque':True,'emissionVitrageFeuSeulement':True,'pngExternes':5},'controleVisuel':False,'approbationArtistique':False,'limites':['Contacts et creux contrôlés sur pièces et sondes listées ; pas de certification exhaustive des collisions.','Deux clips isolés, aucun rendu ni mesure sur téléphone.']}
(sortie/'mesures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'triangles':nbtri,'primitives':report['primitives'],'poses':poses_total,'raccords':len(rac),'gardeChariotHalle':float(gap_hall),'gardeChariotButees':float(gap_stops),'maillonsMin':min(chain_gaps)}))
