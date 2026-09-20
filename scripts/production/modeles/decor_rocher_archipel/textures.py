#!/usr/bin/env python3
"""Atlas PBR analytique original : pigments, microreliefs et rugosité sans éclairage."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image
ID='decor_rocher_archipel';OUT=Path('tmp/production-sequentielle')/ID
fab=json.loads((OUT/'fabrication.json').read_text());patches=fab['atlas']['patches']; margin=8/512;cell=1/5;inner=cell-2*margin
stats=[]
def atlas(size,canal):
 image=np.zeros((size,size,3),dtype=np.uint8)
 image[:]=[218,210,188] if canal=='albedo' else ([128,128,255] if canal=='normale' else [255,223,0])
 for k,p in enumerate(patches):
  x0=int(np.ceil(k%5*cell*size-.5));x1=int(np.ceil((k%5+1)*cell*size-.5));y0=int(np.ceil(k//5*cell*size-.5));y1=int(np.ceil((k//5+1)*cell*size-.5))
  yy,xx=np.mgrid[y0:y1,x0:x1]; uu=((xx+.5)/size-k%5*cell-margin)/inner; vv=((yy+.5)/size-k//5*cell-margin)/inner
  # Gouttières prolongées par le même bord de pigment et de microrelief.
  u=np.clip(uu,0,1);v=np.clip(vv,0,1);rng=np.random.default_rng(6300+k)
  grain=np.zeros_like(u);height=np.zeros_like(u);pigment=np.zeros_like(u)
  for scale,amp in [(5,1),(13,.55),(31,.3),(68,.13)]:
   for _ in range(3):
    a,b=rng.uniform(-scale,scale,2);phase=rng.uniform(0,2*np.pi);w=np.sin(2*np.pi*(u*a+v*b)+phase)
    grain+=w*amp/3;height+=w*(.000040/scale**.15);pigment+=w*amp
  pits=np.zeros_like(u)
  for _ in range(28 if p['kind']=='roche' else 3):
   cx,cy=rng.uniform(-.08,1.08,2);r=rng.uniform(.012,.050);ell=rng.uniform(.65,1.3)
   d=((u-cx)/r)**2+((v-cy)/(r*ell))**2
   pits+=np.exp(-d*2);height-=np.exp(-d*2)*rng.uniform(.00013,.00055)
  if p['kind']=='roche':
   # Ni normale de face ni hauteur du modèle n'interviennent dans ces pigments.
   fleck=np.clip((np.sin(u*19+np.sin(v*15))*np.cos(v*22+u*4)-.66)*2.5,0,1)
   rgb=np.array([219,211,190])+grain[...,None]*np.array([3.0,3.1,3.2])+pigment[...,None]*1.2
   rgb=rgb*(1-fleck[...,None]*.13)+np.array([145,153,118])*(fleck[...,None]*.13)
   rough=np.clip(.835+grain*.018+pits*.025,.76,.95)
  else:
   # Valves calcaires à stries radiales, sans côtes fines ajoutées au maillage.
   theta=np.arctan2(v+.25,(u-.5)*.9);rad=np.sqrt((u-.5)**2+(v+.25)**2)
   ribs=np.sin(theta*26);height=.00016*ribs+.00007*np.sin(rad*94)+height*.25
   rgb=np.array([232,222,204])+grain[...,None]*2+np.sin(rad*45)[...,None]*1.8
   rough=np.clip(.695+grain*.016,.64,.76)
  if canal=='albedo': val=rgb
  elif canal=='rugosite': val=np.stack([np.full_like(u,255),rough*255,np.zeros_like(u)],axis=-1)
  else:
   # Gradient tangent +Y : V suit les lignes PNG, convention glTF sans inversion UV.
   widths=np.ptp(np.array(p['bounds']),axis=0);dx=widths[0]/(inner*size);dy=widths[1]/(inner*size)
   gy,gx=np.gradient(height,dy,dx);vec=np.stack([-gx,-gy,np.ones_like(gx)],axis=-1);vec/=np.linalg.norm(vec,axis=-1,keepdims=True);val=(vec*.5+.5)*255
   # Les normales de bord sont dilatées dans la gouttière, et non mises à plat.
   xi=np.where((uu[0]>=0)&(uu[0]<=1))[0];yi=np.where((vv[:,0]>=0)&(vv[:,0]<=1))[0]
   val=val[np.clip(np.arange(len(val)),yi[0]+1,yi[-1]-1)[:,None],np.clip(np.arange(len(val[0])),xi[0]+1,xi[-1]-1)[None,:]]
  image[y0:y1,x0:x1]=np.clip(np.rint(val),0,255).astype(np.uint8)
 path=OUT/f'{ID}_{canal}.png';Image.fromarray(image,'RGB').save(path,optimize=True)
 stats.append({'fichier':path.name,'resolution':size,'canal':canal,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'octets':path.stat().st_size,'minRGB':image.min((0,1)).tolist(),'maxRGB':image.max((0,1)).tolist()})
for canal,size in [('albedo',1024),('normale',512),('rugosite',512)]:atlas(size,canal)
(OUT/'textures.json').write_text(json.dumps({'id':ID,'origine':'Champs analytiques originaux, NumPy/Pillow','bakeHD':False,'eclairageCalcule':False,'occlusionCalculee':False,'ombrePeinte':False,'normalesTangentes':'+Y','rugosite':'R=255 non utilisé, G=rugosité, B=0 métal','atlas':{'grille':[5,5],'margeTexelsNormale':8,'nombreIlots':len(patches),'gouttieres':'Pigments et microreliefs prolongés au bord ; normales dilatées.'},'textures':stats,'approbationArtistique':False},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(stats))
