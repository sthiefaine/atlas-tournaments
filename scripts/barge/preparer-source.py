"""Conserve la topologie Tripo HD et ses normales ; aucun remeshing ni décimation."""
from pathlib import Path
import struct,json,math
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'assets/sources/tripo_tugboat/original.glb';OUT=ROOT/'assets/sources/unite_barge_base/preparation';OUT.mkdir(parents=True,exist_ok=True)
b=SRC.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);binary=b[28+n:];out=bytearray();views=[];accessors=[]
def read(i,fmt,nc):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);step=v.get('byteStride',struct.calcsize(fmt)*nc)
 return [struct.unpack_from('<'+fmt*nc,binary,start+j*step)for j in range(a['count'])]
def add(values,fmt,nc,ctype,normalized=False,bounds=False):
 out.extend(b'\0'*((-len(out))%4));raw=bytearray()
 for v in values:raw.extend(struct.pack('<'+fmt*nc,*v))
 views.append({'buffer':0,'byteOffset':len(out),'byteLength':len(raw)});out.extend(raw)
 a={'bufferView':len(views)-1,'componentType':ctype,'count':len(values),'type':{1:'SCALAR',2:'VEC2',3:'VEC3'}[nc]}
 if normalized:a['normalized']=True
 if bounds:a.update(min=[min(v[i]for v in values)for i in range(nc)],max=[max(v[i]for v in values)for i in range(nc)])
 accessors.append(a);return len(accessors)-1
p=d['meshes'][0]['primitives'][0];pos=read(p['attributes']['POSITION'],'f',3);norm=read(p['attributes']['NORMAL'],'f',3);uv=read(p['attributes']['TEXCOORD_0'],'f',2)
ia=d['accessors'][p['indices']];idx=read(p['indices'],'I' if ia['componentType']==5125 else 'H',1)
lo=[min(v[i]for v in pos)for i in range(3)];hi=[max(v[i]for v in pos)for i in range(3)]
sx=.85/(hi[0]-lo[0]);sy=.5/(hi[1]-lo[1]);sz=.62/(hi[2]-lo[2])
positions=[(-sz*(z-(lo[2]+hi[2])/2),sy*(y-lo[1]),sx*(x-(lo[0]+hi[0])/2))for x,y,z in pos]
normals=[]
for x,y,z in norm:
 v=(-z/sz,y/sy,x/sx);length=math.sqrt(sum(a*a for a in v));normals.append(tuple(a/length for a in v))
attrs={'POSITION':add(positions,'f',3,5126,bounds=True),'NORMAL':add(normals,'f',3,5126),'TEXCOORD_0':add([(u,.125+.875*v)for u,v in uv],'f',2,5126)}
parts=[[],[]]
for i in range(0,len(idx),3):
 ids=[v[0]for v in idx[i:i+3]];x=sum(pos[j][0]for j in ids)/3;y=sum(pos[j][1]for j in ids)/3
 group=1 if y>.235 and -.18<x<.29 else 0
 parts[group].extend((j,)for j in ids)
meshes=[]
for group,indices in enumerate(parts):
 primitives=[]
 for start in range(0,len(indices),999999):primitives.append({'attributes':attrs,'indices':add(indices[start:start+999999],'I',1,5125),'material':group})
 meshes.append({'name':['base','module_grue'][group],'primitives':primitives})
# Trois panneaux d’équipe ; le modèle d’origine n’est ni supprimé ni remodelé.
verts=[];faces=[];norms=[]
for center,size in [((0,.454,-.275),(.22,.006,.105)),((.255,.17,-.08),(.008,.042,.34)),((-.255,.17,-.08),(.008,.042,.34))]:
 for axis in range(3):
  for sign in [-1,1]:
   a=(axis+1)%3;c=(axis+2)%3;start=len(verts)
   corners=[(-1,-1),(1,-1),(1,1),(-1,1)]
   if sign<0:corners=list(reversed(corners))
   for aa,cc in corners:
    v=list(center);v[axis]+=sign*size[axis]/2;v[a]+=aa*size[a]/2;v[c]+=cc*size[c]/2;verts.append(tuple(v));normal=[0,0,0];normal[axis]=sign;norms.append(tuple(normal))
   faces.extend([(start,),(start+1,),(start+2,),(start,),(start+2,),(start+3,)])
pa={'POSITION':add(verts,'f',3,5126,bounds=True),'NORMAL':add(norms,'f',3,5126),'TEXCOORD_0':add([(.5,.0625)]*len(verts),'f',2,5126)}
meshes[0]['primitives'].append({'attributes':pa,'indices':add(faces,'H',1,5123),'material':0})
doc={'asset':{'version':'2.0'},'buffers':[{'byteLength':len(out)}],'bufferViews':views,'accessors':accessors,'meshes':meshes,'nodes':[{'name':'base','mesh':0},{'name':'module_grue','mesh':1}],'scenes':[{'nodes':[0,1]}],'scene':0}
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);out.extend(b'\0'*((-len(out))%4))
(OUT/'lod0.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out)
print('Triangles source conservés',len(idx)//3,'; panneaux ajoutés',len(faces)//3,'; taille géométrie',len(out))
