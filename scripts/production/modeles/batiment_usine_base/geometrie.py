#!/usr/bin/env python3
"""Relit les sommets et clips du GLB final. NumPy seulement, aucun rendu."""
from pathlib import Path
import json, struct, sys
import numpy as np

identifiant='batiment_usine_base'
sortie=Path(sys.argv[1] if len(sys.argv)>1 else f'tmp/production-sequentielle/{identifiant}')
brut=(sortie/f'{identifiant}_lod0.glb').read_bytes()
longueur=struct.unpack_from('<I',brut,12)[0]
doc=json.loads(brut[20:20+longueur]); binaire=brut[28+longueur:]

def acc(i):
    a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
    largeur={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
    dtype={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']]
    p=v.get('byteOffset',0)+a.get('byteOffset',0)
    pas=v.get('byteStride',largeur*np.dtype(dtype).itemsize)
    return np.ndarray((a['count'],largeur),dtype=dtype,buffer=binaire,offset=p,strides=(pas,np.dtype(dtype).itemsize)).astype(float)

def rotation(q):
    x,y,z,w=q/np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])

def interpoler(temps,valeurs,t,quaternion):
    if t<=temps[0]:return valeurs[0]
    if t>=temps[-1]:return valeurs[-1]
    j=int(np.searchsorted(temps,t));u=(t-temps[j-1])/(temps[j]-temps[j-1]);a,b=valeurs[j-1],valeurs[j]
    if not quaternion:return (1-u)*a+u*b
    a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);cos=float(np.dot(a,b))
    if cos<0:b=-b;cos=-cos
    if cos>.9995:
        q=(1-u)*a+u*b;return q/np.linalg.norm(q)
    angle=np.arccos(np.clip(cos,-1,1));return (np.sin((1-u)*angle)*a+np.sin(u*angle)*b)/np.sin(angle)

parents={c:i for i,n in enumerate(doc['nodes']) for c in n.get('children',[])}
noeuds={n['name']:i for i,n in enumerate(doc['nodes'])}
points={i:np.concatenate([acc(p['attributes']['POSITION']) for p in doc['meshes'][n['mesh']]['primitives']]) for i,n in enumerate(doc['nodes']) if 'mesh' in n}

def calculer(surcharges):
    resultat={}
    def monde(i):
        if i in resultat:return resultat[i]
        n=doc['nodes'][i];p={**n,**surcharges.get(i,{})}
        if 'matrix' in p and i not in surcharges:m=np.array(p['matrix']).reshape(4,4).T
        else:
            m=np.eye(4);m[:3,:3]=rotation(np.array(p.get('rotation',[0,0,0,1])))*np.array(p.get('scale',[1,1,1]))[None,:];m[:3,3]=p.get('translation',[0,0,0])
        if i in parents:m=monde(parents[i])@m
        resultat[i]=m;return m
    for i in range(len(doc['nodes'])):monde(i)
    sommets=np.concatenate([p@resultat[i][:3,:3].T+resultat[i][:3,3] for i,p in points.items()])
    return sommets,resultat


def produit(a,b):return np.sum(a*b,axis=-1)

def point_segment(p,a,b):
 d=b-a;t=np.clip(produit(p-a,d)/np.maximum(produit(d,d),1e-30),0,1)
 return np.linalg.norm(p-(a+t[...,None]*d),axis=-1)

def point_triangle(p,t):
 n=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);norm2=produit(n,n)
 projection=p-n*(produit(p-t[:,0],n)/norm2)[:,None]
 c=np.stack([produit(np.cross(t[:,(j+1)%3]-t[:,j],projection-t[:,j]),n) for j in range(3)],axis=1)
 dans=np.all(c>=-1e-20,axis=1)
 bord=np.min(np.stack([point_segment(p,t[:,j],t[:,(j+1)%3]) for j in range(3)]),axis=0)
 return np.where(dans,abs(produit(p-t[:,0],n))/np.sqrt(norm2),bord)

def segments_distance(p0,p1,q0,q1):
 u,v,w=p1-p0,q1-q0,p0-q0
 aa,bb,cc,dd,ee=produit(u,u),produit(u,v),produit(v,v),produit(u,w),produit(v,w)
 den=aa*cc-bb*bb;ok=den>1e-25
 s=np.divide(bb*ee-cc*dd,den,out=np.zeros_like(den),where=ok)
 t=np.divide(aa*ee-bb*dd,den,out=np.zeros_like(den),where=ok)
 interieur=ok&(s>=0)&(s<=1)&(t>=0)&(t<=1)
 d=np.linalg.norm(w+s[:,None]*u-t[:,None]*v,axis=1)
 bord=np.min(np.stack([point_segment(p0,q0,q1),point_segment(p1,q0,q1),point_segment(q0,p0,p1),point_segment(q1,p0,p1)]),axis=0)
 return np.where(interieur,np.minimum(d,bord),bord)

def traverse(p0,p1,t):
 direction=p1-p0;e1=t[:,1]-t[:,0];e2=t[:,2]-t[:,0]
 h=np.cross(direction,e2);det=produit(e1,h);ok=abs(det)>1e-20
 inv=np.divide(1,det,out=np.zeros_like(det),where=ok);s=p0-t[:,0]
 u=produit(s,h)*inv;q=np.cross(s,e1);v=produit(direction,q)*inv;fraction=produit(e2,q)*inv
 return ok&(u>=0)&(v>=0)&(u+v<=1)&(fraction>=0)&(fraction<=1)
