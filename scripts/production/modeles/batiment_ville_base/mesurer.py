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
assert nbtri<=5000 and degenerate==0 and uvdeg==0 and normdot>0 and normalerr<1e-6 and tangenterr<1e-5,(nbtri,degenerate,uvdeg,normdot,normalerr,tangenterr)

def distance(a,b):
 a=pieces[a]['triangles'];b=pieces[b]['triangles'];aa=np.repeat(a,len(b),axis=0);bb=np.tile(b,(len(a),1,1));ds=[]
 for j in range(3):
  ds.append(point_triangle(aa[:,j],bb));ds.append(point_triangle(bb[:,j],aa))
  if traverse(aa[:,j],aa[:,(j+1)%3],bb).any() or traverse(bb[:,j],bb[:,(j+1)%3],aa).any():return 0.
  for k in range(3):ds.append(segments_distance(aa[:,j],aa[:,(j+1)%3],bb[:,k],bb[:,(k+1)%3]))
 return float(np.min(ds))


# Assemblages principaux et accessoires réellement posés.
raccords=[]
for nom in ['arriere','gauche','droite']:
 raccords += [('dalle',f'mur_{nom}'),('dalle',f'soubassement_{nom}'),(f'mur_{nom}',f'corniche_{nom}'),(f'corniche_{nom}',f'toit_{nom}'),(f'toit_{nom}',f'faitiere_{nom}')]
for yy in [.303,.357]:raccords += [('mur_gauche',f'platine_charniere_{yy}'),(f'platine_charniere_{yy}',f'charniere_{yy}'),(f'charniere_{yy}','panneau_volet_mobile')]
for x in [-.398,-.208]:raccords += [('mur_gauche',f'platine_auvent_{x}'),(f'platine_auvent_{x}',f'console_auvent_{x}'),(f'console_auvent_{x}','auvent')]
raccords += [('auvent','retombee_auvent'),('mur_arriere','console_enseigne'),('dalle','embase_table'),('embase_table','pied_table'),('pied_table','plateau_table')]
for x in [-.083,.083]:raccords += [('console_enseigne',f'rail_enseigne_{x}'),(f'rail_enseigne_{x}',f'patin_enseigne_{x}'),(f'patin_enseigne_{x}','banderole'),(f'rail_enseigne_{x}',f'butee_enseigne_{x}')]
for x in [-.382,-.230]:
 for dz in [-.010,.010]:
  for dx in [-.010,.010]:raccords += [('dalle',f'pied_tabouret_{x}_{dx}_{dz}'),(f'pied_tabouret_{x}_{dx}_{dz}',f'assise_{x}')]
for k in range(3):
 raccords += [('dalle',f'bac_{k}_fond'),(f'bac_{k}_fond',f'terre_{k}')]
 for j in range(3):raccords += [(f'terre_{k}',f'feuillage_{k}_{j}')]
for x in [.236,.296,.356]:
 for z in [.286,.370]:raccords += [('dalle',f'longeron_ratelier_{z}'),(f'longeron_ratelier_{z}',f'pied_ratelier_{x}_{z}'),(f'pied_ratelier_{x}_{z}',f'arceau_ratelier_{x}')]
rac=[{'a':a,'b':b,'distanceMetres':distance(a,b)} for a,b in raccords]
assert all(x['distanceMetres']<.0001 for x in rac),[x for x in rac if x['distanceMetres']>=.0001]
# Toits fermés : chaque arête a deux incidences, normale éloignée d'un point intérieur.
toits=[]
for nom in ['arriere','gauche','droite']:
 tri=pieces[f'toit_{nom}']['triangles'];center=tri.reshape(-1,3).mean(0);edges={}
 for t in tri:
  keys=[tuple(np.round(v,6)) for v in t]
  for j in range(3):
   e=tuple(sorted([keys[j],keys[(j+1)%3]]));edges[e]=edges.get(e,0)+1
 cross=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);cross/=np.linalg.norm(cross,axis=1)[:,None]
 sens=np.sum(cross*(tri.mean(1)-center),axis=1)
 assert set(edges.values())=={2} and sens.min()>0,(nom,edges,sens)
 toits.append({'nom':nom,'ferme':True,'incidencesAretes':2,'normalesSortantesDistanceMin':float(sens.min())})
# Cour ouverte : toutes les pièces hormis dalle sont séparées de cette boîte par un axe.
courmin=np.array([-.130,.024001,-.100]);courmax=np.array([.130,1,.425]);
def cour_libre(mat):
 for nom,p in pieces.items():
  if nom=='dalle':continue
  tri=p['local']@mat[p['node']][:3,:3].T+mat[p['node']][:3,3];lo=tri.min((0,1));hi=tri.max((0,1))
  assert np.any(hi<=courmin)|np.any(lo>=courmax),('cour',nom,lo,hi)
cour_libre(repos)
# La terrasse est sous la projection de l'auvent et les trois bacs sont dehors.
canopy=pieces['auvent']['triangles'];clo=canopy.min((0,1));chi=canopy.max((0,1))
for nom in ['plateau_table','assise_-0.382','assise_-0.23']:
 t=pieces[nom]['triangles'];assert np.all(t.min((0,1))[[0,2]]>=clo[[0,2]]) and np.all(t.max((0,1))[[0,2]]<=chi[[0,2]]) and t[:,:,1].max()<clo[1],nom
for k in range(3):
 t=pieces[f'bac_{k}_fond']['triangles']
 for nom in ['arriere','gauche','droite']:
  wall=pieces[f'mur_{nom}']['triangles'];assert np.any(t.max((0,1))[[0,2]]<wall.min((0,1))[[0,2]]) or np.any(t.min((0,1))[[0,2]]>wall.max((0,1))[[0,2]])
clips=[];poses_total=0;garde_mobile_mur=1;garde_butee=1;garde_toit=1
for clip in doc['animations']:
 canaux=[];keys=[];duration=0
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];a=doc['accessors'][s['input']];t=acc(s['input']).ravel();v=acc(s['output']);target=c['target']
  assert s.get('interpolation','LINEAR')=='LINEAR' and a['type']=='SCALAR' and a['componentType']==5126 and np.all(np.diff(t)>0)
  assert np.allclose(a['min'],[t.min()]) and np.allclose(a['max'],[t.max()]);assert doc['nodes'][target['node']]['name'] in ['volet_mobile','enseigne']
  canaux.append((target['node'],target['path'],t,v));keys.extend(t.tolist());duration=max(duration,float(t[-1]))
 times=sorted(set(np.linspace(0,duration,17).tolist()+keys));mini=np.full(3,np.inf);maxi=-mini;maxdelta=0;mobile_min=np.full(3,np.inf);mobile_max=-mobile_min;probes_clips=[]
 for t in times:
  overrides={}
  for n,p,tt,vv in canaux:overrides.setdefault(n,{})[p]=interpoler(tt,vv,t,p=='rotation')
  vertices,mat=calculer(overrides);moving=canaux[0][0];pv=points[moving]@mat[moving][:3,:3].T+mat[moving][:3,3];mobile_min=np.minimum(mobile_min,pv.min(0));mobile_max=np.maximum(mobile_max,pv.max(0));cour_libre(mat)
  if t in keys:probes_clips.append({'t':t,'matrice':mat[moving].reshape(-1).tolist()})
  mini=np.minimum(mini,vertices.min(0));maxi=np.maximum(maxi,vertices.max(0))
  for n in ['racine','corps','toit']:maxdelta=max(maxdelta,float(abs(mat[noeuds[n]]-repos[noeuds[n]]).max()))
  if clip['name']=='repos':garde_mobile_mur=min(garde_mobile_mur,float(pv[:,0].min()-pieces['mur_gauche']['triangles'][:,:,0].max()))
  else:
   # Les rails/patins sont des contacts voulus ; la banderole doit éviter butées et toit.
   for nom in ['banderole','retour_haut_banderole']:
    pp=pieces[nom]['local']@mat[moving][:3,:3].T+mat[moving][:3,3]
    garde_butee=min(garde_butee,float(pieces['butee_enseigne_-0.083']['triangles'][:,:,1].min()-pp[:,:,1].max()))
    roofs=np.concatenate([p['triangles'] for n,p in pieces.items() if p['node']==noeuds['toit'] and ('arriere' in n)])
    garde_toit=min(garde_toit,float(pp[:,:,2].min()-roofs[:,:,2].max()))
 assert mini[1]>=-1e-7 and np.max(abs(mini[[0,2]]))<.5 and np.max(abs(maxi[[0,2]]))<.5 and maxi[1]<.77 and maxdelta==0
 first,_=calculer({n:{p:v[0]} for n,p,t,v in canaux});last,_=calculer({n:{p:v[-1]} for n,p,t,v in canaux});end_delta=float(abs(first-last).max());assert end_delta<1e-7
 clips.append({'nom':clip['name'],'duree':duration,'poses':len(times),'cibles':[doc['nodes'][n]['name'] for n,p,t,v in canaux],'enveloppe':{'min':mini.tolist(),'max':maxi.tolist()},'ecartDebutFin':end_delta,'racineCorpsToitImmobiles':True,'mobile':{'nom':doc['nodes'][canaux[0][0]]['name'],'min':mobile_min.tolist(),'max':mobile_max.tolist(),'probesCles':probes_clips}});poses_total+=len(times)
assert garde_mobile_mur>.011 and garde_butee>.010 and garde_toit>.010,(garde_mobile_mur,garde_butee,garde_toit)
# Borne continue de rotation du volet : déplacement de chaque sommet <= rayon*angle.
mobile=points[noeuds['volet_mobile']];rayon=np.linalg.norm(mobile[:,[0,2]],axis=1).max();marge_continue=float(-.130-(mobile[:,0].max()-.190+rayon*.06));assert marge_continue>.001
# Émission/masque/UV : mêmes contrôles ciblés que les précédentes bases.
imgs={c:np.array(Image.open(sortie/f'{identifiant}_{c}.png')) for c in ['albedo','normale','rugosite','emission','masque_equipe']}
mask=imgs['masque_equipe'];assert set(np.unique(mask))=={0,255};a=imgs['albedo'].reshape(512,2,512,2,3).mean((1,3));assert np.all(a[mask==255,0]==a[mask==255,1]) and np.all(a[mask==255,1]==a[mask==255,2]);assert not (imgs['emission'][mask==255]>0).any()
for n,p in pieces.items():
 uv=np.concatenate([p['uv'].reshape(-1,2),p['uv'].mean(axis=1)]);xy=np.minimum((uv*512).astype(int),511);m=mask[xy[:,1],xy[:,0]];e=imgs['emission'][xy[:,1],xy[:,0]];assert np.all(m==(255 if p['role']==2 else 0)),n;assert np.all(np.any(e>0,axis=1)==(p['role'] in [4,10])),n
assert doc['nodes'][noeuds['racine']]['extras']['atlasAnimationsBatiment'] is True
assert len(doc['materials'])==2 and sorted(m['name'] for m in doc['materials'])==['mat_corps','mat_vitrage'];glass=next(m for m in doc['materials'] if m['name']=='mat_vitrage');assert glass['emissiveTexture']['index']==3
assert len(doc['images'])==5 and all('uri' in i and '/' not in i['uri'] and 'bufferView' not in i for i in doc['images'])

vertices,_=calculer({})
report={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'triangles':nbtri,'primitives':sum(len(m['primitives']) for m in doc['meshes']),'noeuds':list(noeuds),'bornes':{'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist(),'dimensions':np.ptp(vertices,axis=0).tolist()},'geometrie':{'trianglesDegeneres':degenerate,'trianglesUvDegeneres':uvdeg,'normalesSensFaceMin':normdot,'erreurNormalesMax':normalerr,'erreurTangentesMax':tangenterr,'uvMin':uvmin,'uvMax':uvmax},'raccords':rac,'toits':toits,'cour':{'min':courmin.tolist(),'max':courmax.tolist(),'hauteurPlateau':.024,'accessoiresHorsCourToutesPoses':True,'terrasseSousAuvent':True,'jardinieresExterieures':True,'limite':'Boîte libre mesurée ; visibilité de toutes les figurines non évaluée.'},'animations':{'poses':poses_total,'clips':clips,'gardeVoletMurAuxPoses':garde_mobile_mur,'gardeContinueVoletCour':marge_continue,'gardeContinueEnseigneButees':garde_butee,'gardeContinueEnseigneToit':garde_toit,'preuveContinue':'Capture translation LINEAR : séparation suivant Y et Z bornée aux clés. Volet rotation ±0,06 rad : rayon maximal × angle majore tous les déplacements et préserve la cour. Autres contacts mesurés seulement aux poses.','optIn':True},'textures':{'masqueBinaire':True,'grisNeutreSurMasque':True,'emissionVitrageFeuSeulement':True,'pngExternes':5},'controleVisuel':False,'approbationArtistique':False,'limites':['Contacts ciblés listés et cour mesurée ; aucune certification exhaustive des collisions.','Deux clips isolés, aucun rendu ni mesure sur téléphone.']}
(sortie/'mesures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'triangles':nbtri,'primitives':report['primitives'],'poses':poses_total,'raccords':len(rac),'gardeEnseigneToit':garde_toit,'gardeVoletCour':marge_continue}))
