"""Préparation HD de la source Tripo : conservation de chaque triangle, sans décimation."""
from pathlib import Path
from PIL import Image, ImageDraw
import struct,json,math,io,hashlib,sys
ROOT=Path(__file__).resolve().parents[2]
SRC=Path(sys.argv[1]); ID='unite_artillerie_base'; OUT=ROOT/'assets/livraisons'/ID; OUT.mkdir(parents=True,exist_ok=True)
b=SRC.read_bytes(); sha=hashlib.sha256(b).hexdigest()
if sha!='38a5dbc65010bb45ec2424de7fa9c19b1e6d220ec0beb5339d2a5c35214fad5b': raise ValueError('Source différente de la révision inspectée')
n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);binary=b[28+n:]
def read(i,nc):
 a=d['accessors'][i];v=d['bufferViews'][a['bufferView']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']];start=v.get('byteOffset',0)+a.get('byteOffset',0);step=v.get('byteStride',struct.calcsize(fmt)*nc)
 return [struct.unpack_from('<'+fmt*nc,binary,start+j*step)for j in range(a['count'])]
p=d['meshes'][0]['primitives'][0];pos=read(p['attributes']['POSITION'],3);norm=read(p['attributes']['NORMAL'],3);uv=read(p['attributes']['TEXCOORD_0'],2);idx=[x[0]for x in read(p['indices'],1)]
lo=[min(v[i]for v in pos)for i in range(3)];hi=[max(v[i]for v in pos)for i in range(3)]
# L'axe longitudinal source X devient +Z ; transformation positive, normales inverse-transposées.
sx=.85/(hi[0]-lo[0]);sy=.5/(hi[1]-lo[1]);sz=.62/(hi[2]-lo[2])
positions=[(-sz*(z-(lo[2]+hi[2])/2),sy*(y-lo[1]),sx*(x-(lo[0]+hi[0])/2))for x,y,z in pos]
normals=[]
for x,y,z in norm:
 v=(-z/sz,y/sy,x/sx);l=math.sqrt(sum(t*t for t in v));normals.append(tuple(t/l for t in v))
# Les triangles restent intacts ; seuls leurs groupes d'attache changent.
pivots=[(0,0,0),(0,.16,0),(0,.315,-.13),(0,.185,-.28)]
groupes=[[]for _ in pivots]
for start in range(0,len(idx),3):
 ids=idx[start:start+3];x,y,z=[sum(positions[j][k]for j in ids)/3 for k in range(3)]
 groupe=0 if y<.15 else 2 if y>.315 else 3 if z<-.29 and y<.24 and abs(x)>.14 else 1
 groupes[groupe].extend(ids)
# Extraction technique, dimensions source conservées et canaux glTF respectés.
def texture(index):
 im=d['images'][d['textures'][index]['source']];v=d['bufferViews'][im['bufferView']];s=v.get('byteOffset',0);return Image.open(io.BytesIO(binary[s:s+v['byteLength']])).convert('RGB')
m=d['materials'][0];albedo=texture(m['pbrMetallicRoughness']['baseColorTexture']['index']);normal=texture(m['normalTexture']['index']);rm=texture(m['pbrMetallicRoughness']['metallicRoughnessTexture']['index'])
# Masque d'équipe sur les flancs du plateau ; exclusions prioritaires pour tout UV partagé.
mask=Image.new('L',(512,512));excl=Image.new('L',(512,512));md=ImageDraw.Draw(mask);ed=ImageDraw.Draw(excl)
for start in range(0,len(idx),3):
 ids=idx[start:start+3];x,y,z=[sum(positions[j][k]for j in ids)/3 for k in range(3)];nx=abs(sum(normals[j][0]for j in ids)/3)
 equipe=.17<y<.24 and abs(x)>.20 and -.25<z<.25 and nx>.8
 poly=[(round(uv[j][0]*511),round(uv[j][1]*511))for j in ids]
 (md if equipe else ed).polygon(poly,fill=255)
from PIL import ImageChops
mask=ImageChops.subtract(mask,excl).point(lambda x:255 if x==255 else 0)
albedo.paste((128,128,128),mask=mask.resize(albedo.size,Image.Resampling.NEAREST))
albedo.save(OUT/f'{ID}_albedo.png');normal.save(OUT/f'{ID}_normale.png');rm.save(OUT/f'{ID}_rugosite.png');rm.getchannel('B').save(OUT/f'{ID}_metal.png');mask.save(OUT/f'{ID}_masque_equipe.png')
out=bytearray();views=[];accessors=[]
def add(values,nc,ctype=5126,bounds=False):
 fmt='f'if ctype==5126 else'I';out.extend(b'\0'*((-len(out))%4));start=len(out)
 for v in values:out.extend(struct.pack('<'+fmt*nc,*v))
 views.append({'buffer':0,'byteOffset':start,'byteLength':len(out)-start});a={'bufferView':len(views)-1,'componentType':ctype,'count':len(values),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[nc]}
 if bounds:a.update(min=[min(v[i]for v in values)for i in range(nc)],max=[max(v[i]for v in values)for i in range(nc)])
 accessors.append(a);return len(accessors)-1
meshes=[]
for group,indices in enumerate(groupes):
 mapping={j:i for i,j in enumerate(dict.fromkeys(indices))};vertices=list(mapping);pivot=pivots[group]
 if not vertices:meshes.append({'primitives':[]});continue
 attrs={'POSITION':add([tuple(positions[j][k]-pivot[k]for k in range(3))for j in vertices],3,bounds=True),'NORMAL':add([normals[j]for j in vertices],3),'TEXCOORD_0':add([uv[j]for j in vertices],2)}
 primitives=[]
 for start in range(0,len(indices),999999):primitives.append({'attributes':attrs,'indices':add([(mapping[j],)for j in indices[start:start+999999]],1,5125),'material':1 if group==0 else 0})
 meshes.append({'primitives':primitives})
nodes=[{'name':'racine','children':[1,2,4]},{'name':'base','mesh':0},{'name':'corps','translation':[0,.16,0],'mesh':1,'children':[3]},{'name':'module_canon_long','translation':[0,.155,-.13],'mesh':2},{'name':'socle','translation':[0,.185,-.28],'mesh':3}]
animations=[]
for name,dur in [('repos',2.4),('deplacement',1),('tir',.7),('touche',.5),('hors_jeu',.9)]:
 t=add([(dur*i/4,)for i in range(5)],1,bounds=True);samplers=[];channels=[]
 def track(node,path,values,nc):
  samplers.append({'input':t,'output':add(values,nc),'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':node,'path':path}})
 heights={'repos':[0,.001,0,-.001,0],'deplacement':[0,.004,0,.004,0],'tir':[0,0,-.005,0,0],'touche':[0,-.009,.003,0,0],'hors_jeu':[0,-.005,-.014,-.022,-.022]}[name]
 track(2,'translation',[(0,.16+h,0)for h in heights],3)
 if name=='tir':track(3,'translation',[(0,.155,-.13+v)for v in [0,-.025,-.01,0,0]],3)
 if name in ['deplacement','hors_jeu']:
  angles=[-.18]*5 if name=='deplacement' else [0,-.03,-.08,-.12,-.12]
  track(3,'rotation',[(math.sin(a/2),0,0,math.cos(a/2))for a in angles],4)
  angles=[-.6]*5 if name=='deplacement' else [0,-.15,-.3,-.45,-.45]
  track(4,'rotation',[(math.sin(a/2),0,0,math.cos(a/2))for a in angles],4)
 animations.append({'name':name,'extras':{'loop':name in ['repos','deplacement']},'samplers':samplers,'channels':channels})
material=lambda name:{'name':name,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2},'metallicFactor':1,'roughnessFactor':1},'normalTexture':{'index':1}}
g={'asset':{'version':'2.0','generator':'Atlas — source Tripo HD sans décimation','extras':{'sourceSha256':sha}},'buffers':[{'byteLength':len(out)}],'bufferViews':views,'accessors':accessors,'meshes':meshes,'nodes':nodes,'scenes':[{'nodes':[0]}],'scene':0,'animations':animations,'materials':[material('mat_corps'),material('mat_details')],'images':[{'uri':f'{ID}_{c}.png'}for c in ['albedo','normale','rugosite','masque_equipe']],'textures':[{'source':i}for i in range(4)]}
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);out.extend(b'\0'*((-len(out))%4));(OUT/f'{ID}_lod0.glb').write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out)
report={'source':SRC.name,'sha256':sha,'trianglesSource':len(idx)//3,'trianglesLivres':sum(len(x)//3 for x in groupes),'trianglesParAttache':[len(x)//3 for x in groupes],'pixelsEquipe':sum(x==255 for x in mask.getdata()),'approbationArtistique':False,'limites':['Segmentation géométrique des attaches à vérifier humainement','Absence de lumière cuite non certifiée','Orientation front à confirmer dans inspecteur']}
(OUT/'source.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
