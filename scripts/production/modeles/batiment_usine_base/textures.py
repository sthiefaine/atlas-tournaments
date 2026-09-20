#!/usr/bin/env python3
"""Atlas PBR original reproductible : pigments et reliefs, sans source d'éclairage."""
from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image
ID='batiment_usine_base'
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path('tmp/production-sequentielle')/ID
# Atlas 4x4, rôles stables : béton ; panneau peint ; équipe ; métal ; vitrage ; tôle ; câble ; caoutchouc ; peinture secondaire ; bois ; feu.
palette=[(181,183,179),(203,208,205),(167,167,167),(143,153,157),(29,68,81),(193,198,196),(58,63,65),(36,39,39),(134,149,152),(161,119,77),(238,191,113),(29,68,81),(181,183,179),(181,183,179),(181,183,179),(181,183,179)]
rough=[224,145,166,113,47,182,193,228,181,212,57,51,224,224,224,224]
metal=[0,0,0,221,0,0,125,0,0,0,0,0,0,0,0,0]
N=1024;S=256
alb=np.zeros((N,N,3),np.uint8);normal=alb.copy();orm=alb.copy();emiss=alb.copy();mask=np.zeros((N,N),np.uint8)
for role in range(16):
 rng=np.random.default_rng(315401+role);v,u=np.mgrid[0:S,0:S]/S
 grain=rng.normal(0,1,(S,S))*.28+np.sin(u*2*np.pi*73)*np.sin(v*2*np.pi*61)*.13
 height=grain*.00009;pigment=np.array(palette[role],float)[None,None,:]+grain[:,:,None]*2.8
 if role in [0,12,13,14,15]:
  # Joints sciés uniquement dans la normale, pas d'ombre dessinée dans l'albédo.
  height+=grain*.00016
  for a in [.27,.73]:height-=np.exp(-((u-a)/.0035)**2)*.00065
  for a in [.27,.73]:height-=np.exp(-((v-a)/.0035)**2)*.00065
 if role==1:height=grain*.000035 # Peinture technique fine, sans joint de dalle.
 if role in [2,5,8]:
  height+=np.sin(u*2*np.pi*35)*np.sin(v*2*np.pi*31)*.000045
  border=np.minimum.reduce([u,1-u,v,1-v]);height-=np.exp(-((border-.105)/.0045)**2)*.00036
  for x,y in [(.14,.14),(.86,.14),(.14,.86),(.86,.86)]:height+=np.exp(-((u-x)**2+(v-y)**2)/.009**2)*.00038
 if role==3:height+=np.sin(u*2*np.pi*97)*.00007
 if role==9:
  height+=np.sin(u*2*np.pi*17+np.sin(v*2*np.pi*2))*.00018
  pigment+=np.sin(u*2*np.pi*17+np.sin(v*2*np.pi*2))[:,:,None]*2.5
 if role==6:height+=np.sin(u*2*np.pi*13)*.00042
 if role==7:height+=np.sin(v*2*np.pi*27)*.00020
 if role in [4,10,11]:height*=.03
 dv,du=np.gradient(height,1/S,1/S);n=np.stack([-du,-dv,np.ones_like(du)],-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
 x=(role%4)*S;y=(role//4)*S;s=np.s_[y:y+S,x:x+S]
 alb[s]=np.clip(np.rint(pigment),0,255).astype(np.uint8)
 normal[s]=np.clip(np.rint((n*.5+.5)*255),0,255).astype(np.uint8)
 rr=np.clip(rough[role]+grain*4,0,255).astype(np.uint8);orm[s]=np.stack([np.full_like(rr,255),rr,np.full_like(rr,metal[role])],-1)
 mask[s]=255 if role==2 else 0
 if role==4:emiss[s]=[138,185,198]
 if role==10:emiss[s]=[255,186,93]
images={'albedo':Image.fromarray(alb),'normale':Image.fromarray(normal),'rugosite':Image.fromarray(orm).resize((512,512),Image.Resampling.BOX),'emission':Image.fromarray(emiss).resize((512,512),Image.Resampling.NEAREST),'masque_equipe':Image.fromarray(mask).resize((512,512),Image.Resampling.NEAREST)}
out.mkdir(parents=True,exist_ok=True);r={'id':ID,'methode':'Atlas déterministe original ; pigment, joints sciés et microreliefs analytiques ; sans éclairage, reflet, ombre, occlusion cuits.','bakeHD':False,'atlas':{'grille':[4,4],'gouttierePixels':16,'palette':palette,'equipe':[2],'emission':[4,10]},'cartes':[]}
for c,im in images.items():
 p=out/f'{ID}_{c}.png';im.save(p,optimize=True);r['cartes'].append({'canal':c,'fichier':p.name,'dimensions':list(im.size),'octets':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(out/'textures.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'png':len(images),'octets':sum(p['octets'] for p in r['cartes'])}))
