#!/usr/bin/env python3
"""Calcaire archipel original : intersections de plans, alvéoles et coquillages fermés."""
from pathlib import Path
from itertools import combinations
import hashlib, json, struct
import numpy as np
ID='decor_rocher_archipel'; OUT=Path('tmp/production-sequentielle')/ID
OUT.mkdir(parents=True,exist_ok=True)
def save(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
# Aucune sphère/noise de sommets : ces demi-espaces définissent les vrais plans de fracture.
planes=[('sol',[0,-1,0],0),('flanc_droit',[1,0,0],.210),('flanc_gauche',[-1,0,0],.200),('face_avant',[0,0,1],.205),('face_arriere',[0,0,-1],.205),('angle_avant_droit',[1,0,1],.320),('angle_avant_gauche',[-1,0,1],.280),('angle_arriere_droit',[1,0,-1],.300),('angle_arriere_gauche',[-1,0,-1],.330),('couronne',[0,1,0],.300),('cassure_sommet_droite',[.36,1,.20],.290),('cassure_sommet_avant',[-.20,1,.70],.320),('cassure_sommet_gauche',[-.70,1,-.20],.360),('cassure_flanc',[1,.45,-.25],.230)]
A=np.array([p[1] for p in planes],float);D=np.array([p[2] for p in planes]); verts=[]
for ids in combinations(range(len(planes)),3):
 try: v=np.linalg.solve(A[list(ids)],D[list(ids)])
 except np.linalg.LinAlgError: continue
 if np.all(A@v <= D+1e-8) and not any(np.linalg.norm(v-x)<1e-7 for x in verts): verts.append(v)
verts=np.array(verts); faces=[]
for k,(name,normal,dist) in enumerate(planes):
 p=verts[np.abs(verts@np.array(normal)-dist)<1e-7]
 if len(p)<3: continue
 n=np.array(normal,float);n/=np.linalg.norm(n);c=p.mean(0)
 u=np.cross([0,0,1] if abs(n[2])<.8 else [0,1,0],n);u/=np.linalg.norm(u);v=np.cross(n,u)
 p=p[np.argsort(np.arctan2((p-c)@v,(p-c)@u))]
 area=sum(np.linalg.norm(np.cross(p[i]-c,p[(i+1)%len(p)]-c))/2 for i in range(len(p)))
 faces.append({'name':name,'p':p,'n':n,'c':c,'u':u,'v':v,'area':area,'cavity':False})
# Les cinq plus grands pans visibles portent des alvéoles géométriques larges.
for f in sorted((f for f in faces if f['name']!='sol'),key=lambda f:f['area'],reverse=True)[:5]: f['cavity']=True
triangles=[]; patches=[]; pieces=[]
def emit(a,b,c,patch): triangles.append((np.array([a,b,c]),patch))
for fi,f in enumerate(faces):
 p=f['p']; perimeter=np.array([x for i in range(len(p)) for x in (p[i],(p[i]+p[(i+1)%len(p)])/2)])
 n=f['n'];c=f['c'];start=len(triangles)
 if f['cavity']:
  # Anneau intact puis cuvette en retrait, sans percer la coque.
  rim=c+(perimeter-c)*.46; inner=c+(perimeter-c)*.27-n*.015; bottom=c-n*.020
  for outer,inside in [(perimeter,rim),(rim,inner)]:
   for i in range(len(outer)):
    j=(i+1)%len(outer);emit(outer[i],outer[j],inside[j],fi);emit(outer[i],inside[j],inside[i],fi)
  for i in range(len(inner)): emit(inner[i],inner[(i+1)%len(inner)],bottom,fi)
 else:
  for i in range(len(perimeter)): emit(perimeter[i],perimeter[(i+1)%len(perimeter)],c,fi)
 proj=np.stack([(p-c)@f['u'],(p-c)@f['v']],1);bound=(proj.min(0),proj.max(0))
 patches.append({'name':f['name'],'kind':'roche','origin':c.tolist(),'u':f['u'].tolist(),'v':f['v'].tolist(),'bounds':[x.tolist() for x in bound],'area':f['area'],'cavity':f['cavity']})
 pieces.append({'name':f['name'],'firstTriangle':start,'triangles':len(triangles)-start,'patch':fi,'normalPlan':n.tolist(),'pointPlan':c.tolist(),'caviteProfondeur':.020 if f['cavity'] else 0})
main_triangles=len(triangles)
# Valves de coquillages à empreinte large, quatre volumes fermés, fond exactement au sol.
# Leur profil lobé reste émoussé ; stries radiales dans la normale uniquement.
shells=[('coquille_avant_droite',.180,.194,.031,.029,.015,.2),('coquille_avant_gauche',-.188,.172,.033,.026,.014,-.7),('coquille_arriere_droite',.175,-.195,.030,.026,.014,.8),('coquille_arriere_gauche',-.191,-.189,.025,.023,.012,-.3)]
for name,cx,cz,rx,rz,h,angle in shells:
 fi=len(patches);start=len(triangles);N=12
 rot=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
 ring=[]
 for i in range(N):
  t=2*np.pi*i/N; q=rot@np.array([rx*np.cos(t),rz*np.sin(t)*(1+.12*np.cos(t))]);ring.append([cx+q[0],0,cz+q[1]])
 ring=np.array(ring); center=np.array([cx,0,cz]); mid=center+(ring-center)*.70;mid[:,1]=h*.70
 top=center+np.array([0,h,0]); # XY winding of a horizontal footprint is clockwise viewed from +Y.
 for i in range(N):
  j=(i+1)%N
  emit(ring[j],ring[i],mid[i],fi);emit(ring[j],mid[i],mid[j],fi);emit(mid[j],mid[i],top,fi);emit(ring[i],ring[j],center,fi)
 patches.append({'name':name,'kind':'coquille','origin':center.tolist(),'u':[1,0,0],'v':[0,0,1],'bounds':[[float(ring[:,0].min()-cx),float(ring[:,2].min()-cz)],[float(ring[:,0].max()-cx),float(ring[:,2].max()-cz)]],'rayons':[rx,rz],'height':h,'angle':angle})
 pieces.append({'name':name,'firstTriangle':start,'triangles':len(triangles)-start,'patch':fi,'sol':0})
# Pivot de l'enveloppe globale au sol. La topologie et les projections UV précèdent ce recentrage.
allpos=np.concatenate([t for t,_ in triangles]);shift=(allpos.min(0)+allpos.max(0))/2;shift[1]=0
P=[];N=[];UV=[];T=[];margin=8/512;cell=1/5
for ps,fi in triangles:
 f=patches[fi];o=np.array(f['origin']);u=np.array(f['u']);v=np.array(f['v']);b=np.array(f['bounds']);q=np.stack([(ps-o)@u,(ps-o)@v],1)
 uv=(q-b[0])/(b[1]-b[0])*(cell-2*margin)+[fi%5*cell+margin,fi//5*cell+margin]
 normal=np.cross(ps[1]-ps[0],ps[2]-ps[0]);normal/=np.linalg.norm(normal)
 edge1=ps[1]-ps[0];edge2=ps[2]-ps[0];duv1=uv[1]-uv[0];duv2=uv[2]-uv[0];det=np.linalg.det(np.stack([duv1,duv2]))
 assert abs(det)>1e-12
 tangent=(duv2[1]*edge1-duv1[1]*edge2)/det;tangent-=normal*np.dot(normal,tangent);tangent/=np.linalg.norm(tangent)
 bitangent=(-duv2[0]*edge1+duv1[0]*edge2)/det;w=1 if np.dot(np.cross(normal,tangent),bitangent)>0 else -1
 P.extend(ps-shift);N.extend([normal]*3);UV.extend(uv);T.extend([np.r_[tangent,w]]*3)
P=np.array(P,dtype='<f4');N=np.array(N,dtype='<f4');UV=np.array(UV,dtype='<f4');T=np.array(T,dtype='<f4');idx=np.arange(len(P),dtype='<u2')
assert len(triangles)<=900
views=[];accessors=[];binary=bytearray()
def acc(data,kind,component,bounds=False):
 while len(binary)%4: binary.append(0)
 views.append({'buffer':0,'byteOffset':len(binary),'byteLength':data.nbytes});binary.extend(data.tobytes())
 a={'bufferView':len(views)-1,'componentType':component,'count':len(data),'type':kind}
 if bounds: a.update({'min':data.min(0).tolist(),'max':data.max(0).tolist()})
 accessors.append(a);return len(accessors)-1
attrs={'POSITION':acc(P,'VEC3',5126,True),'NORMAL':acc(N,'VEC3',5126),'TEXCOORD_0':acc(UV,'VEC2',5126),'TANGENT':acc(T,'VEC4',5126)};ia=acc(idx,'SCALAR',5123)
d={'asset':{'version':'2.0','generator':'Atlas / decor_rocher_archipel / plans paramétriques originaux'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'racine','children':[1]},{'name':'bloc','mesh':0}],'meshes':[{'name':'bloc','primitives':[{'attributes':attrs,'indices':ia,'material':0,'mode':4}]}],'materials':[{'name':'mat_roche','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':1,'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2}},'normalTexture':{'index':1,'scale':1},'doubleSided':False}],'images':[{'uri':f'{ID}_{c}.png'} for c in ['albedo','normale','rugosite']],'textures':[{'source':i,'sampler':0} for i in range(3)],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'accessors':accessors,'bufferViews':views,'buffers':[{'byteLength':len(binary)}]}
j=json.dumps(d,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4);binary+=bytes((-len(binary))%4)
glb=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
(OUT/f'{ID}_lod0.glb').write_bytes(glb)
save('fabrication.json',{'id':ID,'nature':'creation_originale_parametrique','triangles':len(triangles),'trianglesBloc':main_triangles,'trianglesCoquillages':len(triangles)-main_triangles,'primitives':1,'materiaux':1,'octetsGlb':len(glb),'sha256Glb':hashlib.sha256(glb).hexdigest(),'bornes':{'min':P.min(0).tolist(),'max':P.max(0).tolist(),'dimensions':np.ptp(P,axis=0).tolist()},'decalageCentrage':shift.tolist(),'plans':[{'nom':n,'normale':a,'distance':d} for n,a,d in planes],'pieces':pieces,'atlas':{'grille':[5,5],'margePixels512':8,'patches':patches},'animations':[],'approbationArtistique':False,'fpsTelephone':None})
print(json.dumps({'triangles':len(triangles),'faces':len(faces),'patches':len(patches),'dimensions':np.ptp(P,axis=0).tolist(),'octetsGlb':len(glb)}))
