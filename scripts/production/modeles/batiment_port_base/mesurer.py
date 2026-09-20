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

raccords=[('dalle','quai_-1'),('dalle','quai_1'),('dalle','rampe'),('dalle','semelle_cabine'),('semelle_cabine','cabine_basse'),('cabine_basse','appui_vitrage'),('appui_vitrage','vitrage_avant'),('vitrage_avant','toiture'),('toiture','fond_glissiere'),('fond_glissiere','indicateur_capture'),('dalle','semelle_grue'),('semelle_grue','pied_grue'),('pied_grue','fut_grue'),('fut_grue','roulement_fixe'),('roulement_fixe','couronne_mobile'),('couronne_mobile','selle_grue'),('selle_grue','poutre_basse'),('poutre_basse','contrepoids'),('poutre_basse','poulie_tete'),('poulie_tete','cable_levage'),('cable_levage','bloc_crochet'),('bloc_crochet','tige_crochet'),('tige_crochet','crochet'),('cable_tambour','poulie_tete'),('cable_tambour','tambour_grue'),('tambour_grue','flasque_grue_-0.273'),('tambour_grue','flasque_grue_-0.197'),('crochet','section_crochet_depart'),('crochet','section_crochet_bout'),('pied_grue','coffret'),('dalle','socle_treuil'),('tambour_treuil','flasque_treuil_-0.078'),('tambour_treuil','flasque_treuil_0.024')]
for s in [-1,1]:
 for z in [.112,.337]:
  raccords.extend([(f'quai_{s}',f'platine_bollard_{s}_{z}'),(f'platine_bollard_{s}_{z}',f'bollard_{s}_{z}'),(f'bollard_{s}_{z}',f'chapeau_bollard_{s}_{z}'),(f'quai_{s}',f'defense_{s}_{z}')])
for x in [-.087,.033]:raccords.extend([('socle_treuil',f'joue_treuil_{x}'),(f'joue_treuil_{x}','tambour_treuil')])
for z in [-.263,-.207]:raccords.extend([('poutre_basse',f'tirant_avant_{z}'),(f'tirant_avant_{z}','traverse_sommet'),('poutre_basse',f'montant_fleche_{z}'),(f'montant_fleche_{z}','traverse_sommet'),('poutre_basse',f'diagonale_{z}'),(f'diagonale_{z}',f'tirant_avant_{z}')])
for x in [-.398,-.162]:raccords.extend([('vitrage_avant',f'support_feu_{x}'),(f'support_feu_{x}',f'lentille_{x}')])
rac=[{'a':a,'b':b,'distanceMetres':distance(a,b)} for a,b in raccords]
for x in rac:assert x['distanceMetres']<.0007,x

# Ouverture centrale de quai : aucune géométrie dans x[-.225,.225], z[.075,.44].
# Les triangles qui franchissent ce rectangle sont rejetés par leurs projections.
for n,p in pieces.items():
 t=p['triangles'];front=t[t[:,:,2].max(1)>.075]
 if len(front):assert np.all((front[:,:,0].max(1)<-.225)|(front[:,:,0].min(1)>.225)),n
quais=[pieces[f'quai_{s}']['triangles'] for s in [-1,1]]
ouverture=float(quais[1][:,:,0].min()-quais[0][:,:,0].max());assert ouverture>=.48999
# Rampe uniquement à l'arrière de cette approche, plan inférieur sur Y=0, nez haut 2 mm.
rampe=pieces['rampe']['triangles'];rv=rampe.reshape(-1,3);assert abs(float(rv[:,1].min()))<1e-8 and abs(float(rv[rv[:,2]>.069,1].max())-.002)<1e-7 and abs(float(rv[rv[:,2]<-.079,1].max())-.04)<1e-7

clips=[];poses_total=0;jeu_rails=1;jeu_crochet_cabine=1;jeu_fleche_cabine=1
fixed_cab=np.concatenate([p['triangles'] for n,p in pieces.items() if p['node'] in [noeuds['corps'],noeuds['toit']] and ('cabine' in n or 'vitrage' in n or n=='toiture' or 'rail_capture' in n or n=='fond_glissiere')]);cab_max_x=float(fixed_cab[:,:,0].max());cab_max_y=float(fixed_cab[:,:,1].max())
for clip in doc['animations']:
 canaux=[];keys=[];duration=0
 for c in clip['channels']:
  s=clip['samplers'][c['sampler']];a=doc['accessors'][s['input']];t=acc(s['input']).ravel();v=acc(s['output']);target=c['target'];assert s.get('interpolation','LINEAR')=='LINEAR';assert a['type']=='SCALAR' and a['componentType']==5126 and np.all(np.diff(t)>0);assert np.allclose(a['min'],[t.min()]) and np.allclose(a['max'],[t.max()]);assert doc['nodes'][target['node']]['name'] in ['grue','enseigne'];canaux.append((target['node'],target['path'],t,v));keys.extend(t.tolist());duration=max(duration,float(t[-1]))
 times=sorted(set(np.linspace(0,duration,129).tolist()+keys));mini=np.full(3,np.inf);maxi=-mini;maxdelta=0;mobile_min=np.full(3,np.inf);mobile_max=-mobile_min;probes=[]
 for t in times:
  overrides={}
  for n,p,tt,vv in canaux:overrides.setdefault(n,{})[p]=interpoler(tt,vv,t,p=='rotation')
  vertices,mat=calculer(overrides);moving=canaux[0][0];pv=points[moving]@mat[moving][:3,:3].T+mat[moving][:3,3];mobile_min=np.minimum(mobile_min,pv.min(0));mobile_max=np.maximum(mobile_max,pv.max(0))
  if t in keys:probes.append({'t':t,'matrice':mat[moving].reshape(-1).tolist()})
  mini=np.minimum(mini,vertices.min(0));maxi=np.maximum(maxi,vertices.max(0))
  for n in ['racine','corps','toit']:maxdelta=max(maxdelta,float(abs(mat[noeuds[n]]-repos[noeuds[n]]).max()))
  # Séparation par plans X et Y, conservatrice : les pièces de grue passent à droite / au-dessus de la cabine.
  for name in ['crochet','bloc_crochet','cable_levage']:
   p=pieces[name];v=p['local']@mat[p['node']][:3,:3].T+mat[p['node']][:3,3];jeu_crochet_cabine=min(jeu_crochet_cabine,float(v[:,:,0].min())-cab_max_x)
  for name in ['poutre_basse','contrepoids','cable_tambour']:
   p=pieces[name];v=p['local']@mat[p['node']][:3,:3].T+mat[p['node']][:3,3];jeu_fleche_cabine=min(jeu_fleche_cabine,float(v[:,:,1].min())-cab_max_y)
  gp=points[noeuds['grue']]@mat[noeuds['grue']][:3,:3].T+mat[noeuds['grue']][:3,3];assert gp[:,2].max()<-.14
  ind=pieces['indicateur_capture'];ip=ind['local']@mat[ind['node']][:3,:3].T+mat[ind['node']][:3,3];left=pieces['rail_capture_-0.383']['triangles'];right=pieces['rail_capture_-0.177']['triangles'];jeu_rails=min(jeu_rails,float(ip[:,:,0].min()-left[:,:,0].max()),float(right[:,:,0].min()-ip[:,:,0].max()));assert abs(float(ip[:,:,1].min())-float(pieces['fond_glissiere']['triangles'][:,:,1].max()))<1e-7
 assert mini[1]>=-1e-7 and np.max(abs(mini[[0,2]]))<.5 and np.max(abs(maxi[[0,2]]))<.5 and maxi[1]<.77 and maxdelta==0
 first,_=calculer({n:{p:v[0]} for n,p,t,v in canaux});last,_=calculer({n:{p:v[-1]} for n,p,t,v in canaux});end_delta=float(abs(first-last).max());assert end_delta<1e-7
 clips.append({'nom':clip['name'],'duree':duration,'poses':len(times),'cibles':[doc['nodes'][n]['name'] for n,p,t,v in canaux],'enveloppe':{'min':mini.tolist(),'max':maxi.tolist()},'ecartDebutFin':end_delta,'racineCorpsToitImmobiles':True,'mobile':{'nom':doc['nodes'][canaux[0][0]]['name'],'min':mobile_min.tolist(),'max':mobile_max.tolist(),'probesCles':probes}});poses_total+=len(times)
assert jeu_crochet_cabine>.040 and jeu_fleche_cabine>.23 and jeu_rails>.0039,(jeu_crochet_cabine,jeu_fleche_cabine,jeu_rails)
# Rotation Y +/- .045 : majorant continu de déplacement horizontal de chaque sommet.
g=points[noeuds['grue']];displacement=2*float(np.linalg.norm(g[:,[0,2]],axis=1).max())*np.sin(.045/2);g_rest=g@repos[noeuds['grue']][:3,:3].T+repos[noeuds['grue']][:3,3];bmin=g_rest.min(0)-[displacement,0,displacement];bmax=g_rest.max(0)+[displacement,0,displacement];assert np.all(bmin[[0,2]]>-.5) and np.all(bmax[[0,2]]<.5) and bmax[2]<-.14
# Crochet entier séparé de la cabine même avec ce majorant conservateur, sans recherche exhaustive.
hook=np.concatenate([pieces[n]['triangles'] for n in ['crochet','bloc_crochet','cable_levage']]);continuous_gap=float(hook[:,:,0].min())-displacement-cab_max_x;assert continuous_gap>.025
qclip=doc['animations'][0];ss=qclip['samplers'][0];tt=acc(ss['input']).ravel();qq=acc(ss['output']);v0=qq[1,:3]/(tt[1]-tt[0]);v1=-qq[-2,:3]/(tt[-1]-tt[-2]);assert np.linalg.norm(v0-v1)<1e-7

imgs={c:np.array(Image.open(sortie/f'{identifiant}_{c}.png')) for c in ['albedo','normale','rugosite','emission','masque_equipe']}
mask=imgs['masque_equipe'];assert set(np.unique(mask))=={0,255};a=imgs['albedo'].reshape(512,2,512,2,3).mean((1,3));assert np.all(a[mask==255,0]==a[mask==255,1]) and np.all(a[mask==255,1]==a[mask==255,2]);assert not (imgs['emission'][mask==255]>0).any()
for n,p in pieces.items():
 uv=np.concatenate([p['uv'].reshape(-1,2),p['uv'].mean(axis=1)]);xy=np.minimum((uv*512).astype(int),511);m=mask[xy[:,1],xy[:,0]];e=imgs['emission'][xy[:,1],xy[:,0]];assert np.all(m==(255 if p['role']==2 else 0)),n;assert np.all(np.any(e>0,axis=1)==(p['role'] in [4,10])),n
assert doc['nodes'][noeuds['racine']]['extras']['atlasAnimationsBatiment'] is True
assert len(doc['materials'])==2 and sorted(m['name'] for m in doc['materials'])==['mat_corps','mat_vitrage'];glass=next(m for m in doc['materials'] if m['name']=='mat_vitrage');assert glass['emissiveTexture']['index']==3
assert len(doc['images'])==5 and all('uri' in i and '/' not in i['uri'] and 'bufferView' not in i for i in doc['images'])
vertices,_=calculer({});report={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'triangles':nbtri,'primitives':sum(len(m['primitives']) for m in doc['meshes']),'noeuds':list(noeuds),'bornes':{'min':vertices.min(0).tolist(),'max':vertices.max(0).tolist(),'dimensions':np.ptp(vertices,axis=0).tolist()},'geometrie':{'trianglesDegeneres':degenerate,'trianglesUvDegeneres':uvdeg,'normalesSensFaceMin':normdot,'erreurNormalesMax':normalerr,'erreurTangentesMax':tangenterr,'uvMin':uvmin,'uvMax':uvmax},'raccords':rac,'aire':{'ouvertureQuaiMetres':ouverture,'approcheLibreXZ':{'min':[-.225,.075],'max':[.225,.440]},'eauGeneree':False,'rampe':{'largeur':.420,'zMin':-.080,'zMax':.070,'hauteurArriere':.040,'nezAvant':.002},'limiteApproche':'La zone ouverte expose le terrain du jeu ; pas de dalle ni eau ajoutée sous le bassin, ni garantie de place pour toute silhouette.'},'animations':{'poses':poses_total,'clips':clips,'vitesseBoucleEcart':float(np.linalg.norm(v0-v1)),'jeuIndicateurRailsMin':jeu_rails,'separationCrochetCabineXMin':jeu_crochet_cabine,'separationFlecheCabineYMin':jeu_fleche_cabine,'separationContinueCrochetCabineX':continuous_gap,'enveloppeContinueGrue':{'min':bmin.tolist(),'max':bmax.tolist(),'methode':'Majoration horizontale 2r sin(.045/2), rotation Y ; Y exactement invariant.'},'optIn':True},'textures':{'masqueBinaire':True,'grisNeutreSurMasque':True,'emissionVitrageFeuxSeulement':True,'pngExternes':5},'controleVisuel':False,'approbationArtistique':False,'limites':['Mesures géométriques ciblées et poses échantillonnées ; pas de certification exhaustive de collisions.','Deux clips isolés, pas de rendu ni mesure sur téléphone.']}
(sortie/'mesures.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'triangles':nbtri,'primitives':report['primitives'],'poses':poses_total,'raccords':len(rac),'jeuCrochet':jeu_crochet_cabine,'jeuContinu':continuous_gap,'ouverture':ouverture}))
