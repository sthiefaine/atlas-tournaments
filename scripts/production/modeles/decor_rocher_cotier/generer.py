#!/usr/bin/env python3
"""Granit côtier original : fractures biseautées, ceinture de balanes implantées."""
from pathlib import Path
from itertools import combinations
from collections import defaultdict
import hashlib, json, struct
import numpy as np
ID='decor_rocher_cotier'; OUT=Path('tmp/production-sequentielle')/ID
OUT.mkdir(parents=True,exist_ok=True)
def save(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def unit(v): return np.array(v)/np.linalg.norm(v)
planes=[('sol',[0,-1,0],0),('flanc_est',[1,.10,0],.227),('flanc_ouest',[-1,.05,0],.214),('face_sud',[0,.04,1],.222),('face_nord',[0,-.12,-1],.194),('angle_sud_est',[1,0,1],.346),('angle_sud_ouest',[-1,0,1],.301),('angle_nord_est',[1,0,-1],.287),('angle_nord_ouest',[-1,0,-1],.332),('sommet_sec',[.12,1,.04],.286),('fracture_est',[.85,1,.15],.365),('fracture_sud',[-.15,1,.85],.349),('fracture_nord',[-.5,1,-.7],.360)]
A=np.array([p[1] for p in planes],float);D=np.array([p[2] for p in planes]); verts=[]
for ids in combinations(range(len(planes)),3):
 try: p=np.linalg.solve(A[list(ids)],D[list(ids)])
 except np.linalg.LinAlgError: continue
 if np.all(A@p<=D+1e-8) and not any(np.linalg.norm(p-v)<1e-7 for v in verts): verts.append(p)
verts=np.array(verts); faces=[];patches=[];edges=defaultdict(list);corners=defaultdict(list)
for k,(name,normal,dist) in enumerate(planes):
 ids=np.where(np.abs(verts@np.array(normal)-dist)<1e-7)[0]; p=verts[ids]
 if len(p)<3: continue
 n=unit(normal);c=p.mean(0);u=unit(np.cross([0,0,1] if abs(n[2])<.8 else [0,1,0],n));v=np.cross(n,u)
 order=np.argsort(np.arctan2((p-c)@v,(p-c)@u));ids=ids[order];p=p[order]
 inset=[]
 for j,point in enumerate(p):
  previous=unit(point-p[(j-1)%len(p)]);following=unit(p[(j+1)%len(p)]-point)
  inward_a=np.cross(n,previous);inward_b=np.cross(n,following)
  inset.append(np.linalg.solve(np.array([n,inward_a,inward_b]),[np.dot(n,point),np.dot(inward_a,point)+.009,np.dot(inward_b,point)+.009]))
 inset=np.array(inset);fi=len(faces)
 face={'name':name,'p':p,'q':inset,'n':n,'c':c,'u':u,'v':v,'ids':ids,'patch':fi};faces.append(face)
 proj=np.stack([(p-c)@u,(p-c)@v],1)
 patches.append({'name':name,'kind':'granit','origin':c.tolist(),'u':u.tolist(),'v':v.tolist(),'bounds':[proj.min(0).tolist(),proj.max(0).tolist()],'polissage':.92 if k<9 else .32})
 for j,vi in enumerate(ids):
  corners[int(vi)].append((fi,inset[j],n));vj=ids[(j+1)%len(ids)]
  edges[tuple(sorted([int(vi),int(vj)]))].append((fi,int(vi),int(vj),inset[j],inset[(j+1)%len(ids)]))
triangles=[];pieces=[]
def emit(ps,ns,patch):
 ps=np.array(ps);ns=np.array(ns)
 if np.dot(np.cross(ps[1]-ps[0],ps[2]-ps[0]),ns.sum(0))<0:ps=ps[[0,2,1]];ns=ns[[0,2,1]]
 triangles.append((ps,ns,patch))
def piece(name,start,patch,**extra): pieces.append({'name':name,'firstTriangle':start,'triangles':len(triangles)-start,'patch':patch,**extra})
for fi,f in enumerate(faces):
 start=len(triangles);q=f['q'];c=q.mean(0);n=f['n']
 for i in range(len(q)):emit([q[i],q[(i+1)%len(q)],c],[n]*3,fi)
 piece(f['name'],start,fi,type='plan')
edge_mid={}
for (vi,vj),records in edges.items():
 assert len(records)==2
 (fa,a,b,qa,qb),(fb,c,d,ra,rb)=records
 if a!=c:ra,rb=rb,ra
 na=faces[fa]['n'];nb=faces[fb]['n'];nm=unit(na+nb)
 ma=(qa+ra)/2+nm*.0014;mb=(qb+rb)/2+nm*.0014
 edge_mid[tuple(sorted([a,b]))]={a:ma,b:mb}
 # Chaque moitié partage l'îlot du pan voisin, sans ajouter d'îlots minuscules.
 for ps,ns,patch in [([qa,qb,mb],[na,na,nm],fa),([qa,mb,ma],[na,nm,nm],fa),([ma,mb,rb],[nm,nm,nb],fb),([ma,rb,ra],[nm,nb,nb],fb)]:
  start=len(triangles);emit(ps,ns,patch);piece('chanfrein',start,patch,type='chanfrein')
for vi,records in corners.items():
 assert len(records)==3
 points=[]
 for fi,q,n in records: points.append((q,n,fi))
 nc=unit(sum(r[2] for r in records));center=np.mean([r[1] for r in records],0)+nc*.0014
 for (a,b),m in edge_mid.items():
  if vi in m:
   fids=[r[0] for r in edges[(a,b)]];nn=unit(faces[fids[0]]['n']+faces[fids[1]]['n']);points.append((m[vi],nn,fids[0]))
 u=unit(np.cross([0,0,1] if abs(nc[2])<.8 else [0,1,0],nc));v=np.cross(nc,u)
 points.sort(key=lambda r:np.arctan2(np.dot(r[0]-center,v),np.dot(r[0]-center,u)))
 # Projection de l'ensemble dans un plan visible, choisi par son aire projetée minimale.
 choices=[r[0] for r in records]; scores=[]
 for fi in choices:
  n=faces[fi]['n'];scores.append(min(abs(np.dot(np.cross(points[i][0]-center,points[(i+1)%6][0]-center),n)) for i in range(6)))
 patch=choices[int(np.argmax(scores))];start=len(triangles)
 for i in range(6):emit([points[i][0],points[(i+1)%6][0],center],[points[i][1],points[(i+1)%6][1],nc],patch)
 piece('coin_emousse',start,patch,type='coin')
main_triangles=len(triangles)
# Inclure les projections des coins et chanfreins dans chaque îlot, puis garder la marge.
for fi,f in enumerate(patches):
 points=np.concatenate([ps for ps,_,patch in triangles if patch==fi]);o=np.array(f['origin']);u=np.array(f['u']);v=np.array(f['v']);q=np.stack([(points-o)@u,(points-o)@v],1)
 f['bounds']=[q.min(0).tolist(),q.max(0).tolist()]
# Onze balanes courtes, implantées sur huit pans ; aucune coquille flottante.
fi_barn=len(patches);patches.append({'name':'calcaire_balanes','kind':'balane','origin':[0,0,0],'u':[1,0,0],'v':[0,1,0],'bounds':[[-1,-1],[1,1]]})
barnacles=[]
for fi,f in enumerate(faces[1:9],1):
 n=f['n'];u=unit(np.cross([0,1,0],n));v=np.cross(n,u); count=2 if fi in [1,3,4] else 1
 # Coupe horizontale de la face déjà rétrécie : laisse intact le chanfrein.
 for index in range(count):
  y=.046 if index==0 else .079; hits=[]
  for a,b in zip(f['q'],np.roll(f['q'],-1,axis=0)):
   if (a[1]-y)*(b[1]-y)<0:hits.append(a+(b-a)*(y-a[1])/(b[1]-a[1]))
  assert len(hits)==2,(f['name'],y)
  hits.sort(key=lambda p:np.dot(p,u));h0,h1=hits
  fraction=(.29 if index==0 else .70) if count==2 else .5
  center=h0+(h1-h0)*fraction;radius=.016 if count==2 else .018;height=.012 if fi%2 else .0105
  # Les bases s'enfoncent de 1,5 mm sous le vrai pan plan.
  start=len(triangles);rings=[];ring_uv=[];K=6
  for rr,hh in [(radius,-.0015),(radius*.86,height*.52),(radius*.58,height),(radius*.28,height*.25)]:
   ring=np.array([center+u*(rr*np.cos(2*np.pi*k/K+.15*fi))+v*(rr*np.sin(2*np.pi*k/K+.15*fi))+n*hh for k in range(K)]);rings.append(ring)
  for a,b in zip(rings,rings[1:]):
   for k in range(K):
    j=(k+1)%K
    # Outer rings progress inward; winding remains outside on the inner cup slope.
    ps=[a[k],a[j],b[j]];nn=unit(np.cross(ps[1]-ps[0],ps[2]-ps[0]));emit(ps,[nn]*3,fi_barn)
    ps=[a[k],b[j],b[k]];nn=unit(np.cross(ps[1]-ps[0],ps[2]-ps[0]));emit(ps,[nn]*3,fi_barn)
  for ring,c,norm in [(rings[-1],center+n*height*.25,n),(rings[0],center-n*.0015,-n)]:
   for k in range(K):emit([ring[k],ring[(k+1)%K],c],[norm]*3,fi_barn)
  name=f'balane_{len(barnacles)+1:02d}';piece(name,start,fi_barn,type='balane',centre=center.tolist(),normale=n.tolist(),u=u.tolist(),v=v.tolist(),rayon=radius,hauteur=height,faceSupport=fi)
  barnacles.append({'name':name,'centre':center.tolist(),'normale':n.tolist(),'u':u.tolist(),'v':v.tolist(),'rayon':radius,'hauteur':height,'faceSupport':fi,'enfoncementM':.0015})
# Pivot XZ centré et pied Y0 ; normales douces sur les chanfreins, plans conservés.
allpos=np.concatenate([t for t,_,_ in triangles]);shift=(allpos.min(0)+allpos.max(0))/2;shift[1]=0
P=[];N=[];UV=[];T=[];margin=8/512;cell=1/4;part_for_tri={i:piece for piece in pieces for i in range(piece['firstTriangle'],piece['firstTriangle']+piece['triangles'])}
for ti,(ps,ns,fi) in enumerate(triangles):
 f=patches[fi];o=np.array(f['origin']);u=np.array(f['u']);v=np.array(f['v']);b=np.array(f['bounds'])
 if fi==fi_barn:
  part=part_for_tri[ti];o=np.array(part['centre']);u=np.array(part['u'])/part['rayon'];v=np.array(part['v'])/part['rayon']
 q=np.stack([(ps-o)@u,(ps-o)@v],1);uv=(q-b[0])/(b[1]-b[0])*(cell-2*margin)+[fi%4*cell+margin,fi//4*cell+margin]
 edge1=ps[1]-ps[0];edge2=ps[2]-ps[0];duv1=uv[1]-uv[0];duv2=uv[2]-uv[0];det=np.linalg.det(np.stack([duv1,duv2]));assert abs(det)>1e-12,(ti,part_for_tri[ti])
 tangent=(duv2[1]*edge1-duv1[1]*edge2)/det;bitangent=(-duv2[0]*edge1+duv1[0]*edge2)/det
 for norm in ns:
  tt=unit(tangent-norm*np.dot(norm,tangent));w=1 if np.dot(np.cross(norm,tt),bitangent)>0 else -1;T.append(np.r_[tt,w])
 P.extend(ps-shift);N.extend(ns);UV.extend(uv)
P=np.array(P,dtype='<f4');N=np.array(N,dtype='<f4');UV=np.array(UV,dtype='<f4');T=np.array(T,dtype='<f4');idx=np.arange(len(P),dtype='<u2');assert len(triangles)<=900,len(triangles)
views=[];accessors=[];binary=bytearray()
def acc(data,kind,component,bounds=False):
 while len(binary)%4:binary.append(0)
 views.append({'buffer':0,'byteOffset':len(binary),'byteLength':data.nbytes});binary.extend(data.tobytes());a={'bufferView':len(views)-1,'componentType':component,'count':len(data),'type':kind}
 if bounds:a.update({'min':data.min(0).tolist(),'max':data.max(0).tolist()})
 accessors.append(a);return len(accessors)-1
attrs={'POSITION':acc(P,'VEC3',5126,True),'NORMAL':acc(N,'VEC3',5126),'TEXCOORD_0':acc(UV,'VEC2',5126),'TANGENT':acc(T,'VEC4',5126)};ia=acc(idx,'SCALAR',5123)
d={'asset':{'version':'2.0','generator':'Atlas / granit cotier / plans biseautes et balanes originaux'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'racine','children':[1]},{'name':'bloc','mesh':0}],'meshes':[{'name':'bloc','primitives':[{'attributes':attrs,'indices':ia,'material':0,'mode':4}]}],'materials':[{'name':'mat_roche','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1,'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2}},'normalTexture':{'index':1,'scale':1},'doubleSided':False}],'images':[{'uri':f'{ID}_{c}.png'} for c in ['albedo','normale','rugosite']],'textures':[{'source':i,'sampler':0} for i in range(3)],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(binary)}]}
j=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);binary+=bytes((-len(binary))%4)
glb=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/f'{ID}_lod0.glb').write_bytes(glb)
save('fabrication.json',{'id':ID,'nature':'creation_originale_parametrique','triangles':len(triangles),'trianglesBloc':main_triangles,'trianglesBalanes':len(triangles)-main_triangles,'primitives':1,'materiaux':1,'octetsGlb':len(glb),'sha256Glb':hashlib.sha256(glb).hexdigest(),'bornes':{'min':P.min(0).tolist(),'max':P.max(0).tolist(),'dimensions':np.ptp(P,axis=0).tolist()},'decalageCentrage':shift.tolist(),'plans':[{'nom':n,'normale':a,'distance':d} for n,a,d in planes],'facesSupport':[{'nom':f['name'],'normale':f['n'].tolist(),'contour':f['q'].tolist()} for f in faces],'pieces':pieces,'balanes':barnacles,'chanfreins':{'retraitConstantM':.009,'bombementM':.0014,'aretes':len(edges),'coins':len(corners)},'atlas':{'grille':[4,4],'margePixels512':8,'patches':patches},'animations':[],'approbationArtistique':False,'fpsTelephone':None})
print(json.dumps({'triangles':len(triangles),'bloc':main_triangles,'balanes':len(barnacles),'faces':len(faces),'dimensions':np.ptp(P,axis=0).tolist(),'octetsGlb':len(glb)}))
