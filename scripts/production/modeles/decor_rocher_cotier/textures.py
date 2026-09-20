#!/usr/bin/env python3
"""Granit quartz/feldspath/mica et calcaire des balanes ; aucune lumière calculée."""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image
ID='decor_rocher_cotier';OUT=Path('tmp/production-sequentielle')/ID
fab=json.loads((OUT/'fabrication.json').read_text());patches=fab['atlas']['patches'];margin=8/512;cell=1/4;inner=cell-2*margin;stats=[]
def hash3(x,y,z,seed):return np.mod(np.sin(x*127.1+y*311.7+z*74.7+seed*19.19)*43758.5453,1)
def minerals(pos):
 # Grain spatial commun aux îlots : chaque cristal reçoit son pigment, jamais une ombre.
 q=pos*280;grid=np.floor(q);fract=q-grid;best=np.full(q.shape[:2],100.);second=best.copy();crystal=best.copy()
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   for dz in [-1,0,1]:
    lattice=grid+[dx,dy,dz];x,y,z=np.moveaxis(lattice,-1,0);off=np.stack([hash3(x,y,z,s) for s in [1,2,3]],-1)*.72+.14
    dist=np.sum((lattice+off-q)**2,-1);replace=dist<best;second=np.where(replace,best,np.minimum(second,dist));best=np.where(replace,dist,best);crystal=np.where(replace,hash3(x,y,z,4),crystal)
 return crystal,np.sqrt(best),np.sqrt(second)-np.sqrt(best)
def atlas(size,canal):
 image=np.zeros((size,size,3),dtype=np.uint8);image[:]=[166,165,160] if canal=='albedo' else ([128,128,255] if canal=='normale' else [255,190,0])
 for k,p in enumerate(patches):
  x0=int(k%4*cell*size);x1=int((k%4+1)*cell*size);y0=int(k//4*cell*size);y1=int((k//4+1)*cell*size)
  yy,xx=np.mgrid[y0:y1,x0:x1];uu=((xx+.5)/size-k%4*cell-margin)/inner;vv=((yy+.5)/size-k//4*cell-margin)/inner;u=np.clip(uu,0,1);v=np.clip(vv,0,1)
  if p['kind']=='granit':
   bounds=np.array(p['bounds']);widths=np.ptp(bounds,axis=0);a=bounds[0,0]+u*widths[0];b=bounds[0,1]+v*widths[1]
   pos=np.array(p['origin'])+a[...,None]*np.array(p['u'])+b[...,None]*np.array(p['v']);crystal,rad,edge=minerals(pos)
   x,y,z=np.moveaxis(pos,-1,0);large=np.sin(x*57+y*43+np.sin(z*35))*np.sin(z*48-y*29);fine=np.sin(x*1200+y*865-z*995)*np.cos(z*1320+x*774)
   rgb=np.where((crystal<.13)[...,None],np.array([83.,87.,87.]),np.where((crystal<.53)[...,None],np.array([179.,169.,163.]),np.array([194.,194.,185.])))
   rgb+=large[...,None]*4+(crystal[...,None]-.5)*12
   # Pigment marin et dépôts de sel liés à la hauteur réelle, sans termes d'éclairage.
   tide=.075+.010*np.sin(x*42+z*35);marine=1-np.clip((y-tide)/.037,0,1);dry=np.clip((y-.15)/.1,0,1)
   rgb=rgb*(1-marine[...,None]*.19)+np.array([17,24,23])*marine[...,None]*.19+dry[...,None]*10
   salt=np.clip((large-.68)*2,0,1)*np.clip(1-np.abs(y-.095)/.023,0,1);rgb=rgb*(1-salt[...,None]*.3)+np.array([200,198,182])*salt[...,None]*.3
   height=(crystal-.5)*.000034+fine*.000008-np.exp(-edge*80)*.000014
   rough=np.clip(.80-p['polissage']*.20-marine*.10+crystal*.028+salt*.10,.43,.90)
  else:
   widths=np.array([.036,.036]);x=(u-.5)*2;y=(v-.5)*2;r=np.sqrt(x*x+y*y);theta=np.arctan2(y,x)
   ribs=np.sin(theta*18+r*6)*np.clip(r/.5,0,1);height=.000055*ribs+.000018*np.sin(r*100)
   growth=np.sin(r*32);rgb=np.array([210.,204.,187.])+growth[...,None]*3+np.cos(theta*6)[...,None]*2
   rough=np.clip(.75+growth*.025,.70,.80)
  if canal=='albedo':val=rgb
  elif canal=='rugosite':val=np.stack([np.full_like(u,255),rough*255,np.zeros_like(u)],-1)
  else:
   dx=widths[0]/(inner*size);dy=widths[1]/(inner*size);gy,gx=np.gradient(height,dy,dx);vec=np.stack([-gx,-gy,np.ones_like(gx)],-1);vec/=np.linalg.norm(vec,axis=-1,keepdims=True);val=(vec*.5+.5)*255
   xi=np.where((uu[0]>=0)&(uu[0]<=1))[0];yi=np.where((vv[:,0]>=0)&(vv[:,0]<=1))[0];val=val[np.clip(np.arange(len(val)),yi[0]+1,yi[-1]-1)[:,None],np.clip(np.arange(len(val[0])),xi[0]+1,xi[-1]-1)[None,:]]
  image[y0:y1,x0:x1]=np.clip(np.rint(val),0,255).astype(np.uint8)
 path=OUT/f'{ID}_{canal}.png';Image.fromarray(image,'RGB').save(path,optimize=True);stats.append({'fichier':path.name,'resolution':size,'canal':canal,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'octets':path.stat().st_size,'minRGB':image.min((0,1)).tolist(),'maxRGB':image.max((0,1)).tolist()})
for canal,size in [('albedo',1024),('normale',512),('rugosite',512)]:atlas(size,canal)
(OUT/'textures.json').write_text(json.dumps({'id':ID,'origine':'Champs minéraux analytiques originaux, NumPy/Pillow','pigments':['quartz gris clair','feldspath légèrement rosé','mica gris anthracite','patine marine basse','sel clair','calcaire des balanes'],'bakeHD':False,'eclairageCalcule':False,'occlusionCalculee':False,'ombrePeinte':False,'normalesTangentes':'+Y','rugosite':'R=255 non utilisé, G=rugosité, B=0 métal','atlas':{'grille':[4,4],'margeTexelsNormale':8,'nombreIlots':len(patches),'gouttieres':'Pigments prolongés, normales dilatées','balanesPartagentUnIlot':True},'textures':stats,'approbationArtistique':False},ensure_ascii=False,indent=2)+'\n');print(json.dumps(stats))
