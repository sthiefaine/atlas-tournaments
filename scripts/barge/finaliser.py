"""Assemble un lot GLB déterministe, PNG externes partagés et clips rigides."""
from pathlib import Path
from PIL import Image
import struct,json,io,math
ROOT=Path(__file__).resolve().parents[2];ID='unite_barge_base';OUT=ROOT/'assets/livraisons'/ID;OUT.mkdir(parents=True,exist_ok=True)
def lire(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
def ecrire(p,d,b):
 j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);b+=b'\0'*((-len(b))%4)
 p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(j)+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)
# Extraction technique des canaux PBR de la source ; aucun éclairage n'est ajouté.
d,b=lire(ROOT/'assets/sources/tripo_tugboat/original.glb')
def image_texture(index):
 im=d['images'][d['textures'][index]['source']];v=d['bufferViews'][im['bufferView']];start=v.get('byteOffset',0)
 return Image.open(io.BytesIO(b[start:start+v['byteLength']])).convert('RGB')
m=d['materials'][0];a=image_texture(m['pbrMetallicRoughness']['baseColorTexture']['index']);n=image_texture(m['normalTexture']['index']);rm=image_texture(m['pbrMetallicRoughness']['metallicRoughnessTexture']['index'])
def atlas(image,size,fill):
 out=Image.new('RGB',(size,size),fill);out.paste(image.resize((size,size*7//8),Image.Resampling.LANCZOS),(0,size//8));return out
atlas(a,4096,(128,128,128)).save(OUT/f'{ID}_albedo.png')
atlas(n,4096,(128,128,255)).save(OUT/f'{ID}_normale.png')
rough=atlas(rm.getchannel('G').convert('RGB'),512,(210,210,210));rough.save(OUT/f'{ID}_rugosite.png')
metal=atlas(rm.getchannel('B').convert('RGB'),512,(0,0,0)).getchannel('R')
# glTF attend la rugosité en G et le métal en B dans une carte combinée.
Image.merge('RGB',(Image.new('L',(512,512),255),rough.getchannel('R'),metal)).save(OUT/f'{ID}_metal.png')
mask=Image.new('RGB',(512,512),(0,0,0));mask.paste((255,255,255),(0,0,512,64));mask.save(OUT/f'{ID}_masque_equipe.png')
report=[]
for lod in [0]:
 d,b=lire(ROOT/f'assets/sources/{ID}/preparation/lod{lod}.glb')
 images_views={x['bufferView']for x in d.get('images',[])if 'bufferView'in x};out=bytearray();views=[];mapping={}
 for i,v in enumerate(d['bufferViews']):
  if i in images_views:continue
  out.extend(b'\0'*((-len(out))%4));start=v.get('byteOffset',0);nv={**v,'buffer':0,'byteOffset':len(out)};out.extend(b[start:start+v['byteLength']]);mapping[i]=len(views);views.append(nv)
 for a in d['accessors']:
  if 'bufferView'in a:a['bufferView']=mapping[a['bufferView']]
 d['bufferViews']=views
 meshes={x['name']:x['mesh']for x in d['nodes']if 'mesh'in x}
 d['nodes']=[{'name':'racine','children':[1]},{'name':'corps','children':[2,3,4]},{'name':'base','mesh':meshes['base']},{'name':'socle'},{'name':'module_grue','mesh':meshes['module_grue']}]
 d['scenes']=[{'nodes':[0]}];d['scene']=0
 for mesh in d['meshes']:
  for p in mesh['primitives']:p['material']=0
 for p in d['meshes'][meshes['module_grue']]['primitives']:p['material']=1
 d['images']=[{'name':c,'uri':f'{ID}_{c}.png'}for c in ['albedo','normale','metal','masque_equipe']]
 d['textures']=[{'source':i,'sampler':0}for i in range(4)];d['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}]
 def material(name):return {'name':name,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicRoughnessTexture':{'index':2},'metallicFactor':1,'roughnessFactor':1},'normalTexture':{'index':1}}
 d['materials']=[material('mat_corps'),material('mat_details')]
 # Conserver KHR_mesh_quantization : normales int16 normalisées, sans décimation.
 def accessor(values,components):
  out.extend(b'\0'*((-len(out))%4));raw=struct.pack('<'+'f'*len(values),*values);view=len(d['bufferViews']);d['bufferViews'].append({'buffer':0,'byteOffset':len(out),'byteLength':len(raw)});out.extend(raw)
  aa={'bufferView':view,'componentType':5126,'count':len(values)//components,'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[components]}
  if components==1:aa.update(min=[min(values)],max=[max(values)])
  d['accessors'].append(aa);return len(d['accessors'])-1
 d['animations']=[]
 # Des transforms de corps, sans mouvement de racine ni changement des règles.
 for name,duration,angles,heights in [('repos',2.4,[0,.008,0,-.008,0],[0,.003,0,.003,0]),('deplacement',1,[0,.012,0,-.012,0],[0,.004,0,.004,0]),('touche',.5,[0,.04,-.025,.01,0],[0,.004,0,.002,0]),('hors_jeu',.9,[0,.025,.05,.075,.1],[0,-.003,-.009,-.018,-.03])]:
  t=accessor([duration*i/4 for i in range(5)],1)
  # Roulis autour de Z glTF (axe longitudinal).
  rotations=accessor([v for ang in angles for v in [0,0,math.sin(ang/2),math.cos(ang/2)]],4)
  translations=accessor([v for h in heights for v in [0,h,0]],3)
  d['animations'].append({'name':name,'extras':{'loop':name in ['repos','deplacement']},'samplers':[{'input':t,'output':rotations,'interpolation':'LINEAR'},{'input':t,'output':translations,'interpolation':'LINEAR'}],'channels':[{'sampler':0,'target':{'node':1,'path':'rotation'}},{'sampler':1,'target':{'node':1,'path':'translation'}}]})
 d['buffers']=[{'byteLength':len(out)}];d['asset']={'version':'2.0','generator':'Atlas — Tripo source, Blender LOD, shared PBR'}
 filename=OUT/f'{ID}_lod{lod}.glb';ecrire(filename,d,bytes(out))
 tri=sum(d['accessors'][p['indices']]['count']//3 for m in d['meshes']for p in m['primitives']);report.append({'lod':lod,'triangles':tri,'octets':filename.stat().st_size})
(OUT/'mesures.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
