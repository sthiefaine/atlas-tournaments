#!/usr/bin/env python3
"""Enveloppe runtime a : enveloppe S après orientation R(+pi/2), aucune image."""
import sys
sys.dont_write_bytecode=True
from geometrie import *
import hashlib
base=json.loads((sortie/'mesures-poses-glb.json').read_text())
# src/render3d/modeles.ts conformerModele : S(.9,.98,1.06) * RY(pi/2).
transformation=np.array([[0,0,.9],[0,.98,0],[-1.06,0,0]])
clips=[]
for animation,b in zip(doc['animations'],base['clips']):
 canaux=[];duree=0;instants=[]
 for c in animation['channels']:
  s=animation['samplers'][c['sampler']];t=acc(s['input'])[:,0];v=acc(s['output']);instants.extend(t);duree=max(duree,float(t[-1]));canaux.append((c['target']['node'],c['target']['path'],t,v))
 instants=sorted(set(instants+list(np.linspace(0,duree,193))));rayon=0;mini=np.full(3,np.inf);maxi=-mini
 for t in instants:
  pose={}
  for i,canal,ts,vs in canaux:pose.setdefault(i,{})[canal]=interpoler(ts,vs,t,canal=='rotation')
  points,_=calculer(pose);points=points@transformation.T
  rayon=max(rayon,float(np.linalg.norm(points[:,[0,2]],axis=1).max()));mini=np.minimum(mini,points.min(axis=0));maxi=np.maximum(maxi,points.max(axis=0))
 # Norme opérateur S = 1.06 ; borne de vitesse du GLB b amplifiée au plus de 6%.
 borne=max(base['borneAnalytiqueTemoin']*1.06,rayon+1.06*b['vitesseMajoreeMetresSeconde']*max(np.diff(instants))/2)
 assert borne<.5 and mini[1]>-1e-7
 clips.append({'nom':animation['name'],'poses':len(instants),'rayonHorizontalMax':rayon,'rayonHorizontalMajorationContinue':borne,'ecartDeuxVoisinsTousCaps':1-2*borne,'min':mini.tolist(),'max':maxi.tolist()})
rapport={'id':identifiant,'sha256Glb':hashlib.sha256(brut).hexdigest(),'gabarit':'a','methode':'Relecture NumPy du GLB, transformation S(.9,.98,1.06) @ RY(pi/2) après les animations, conformément à conformerModele ; majoration continue par vitesse bornée b × 1.06 et témoin local × 1.06.','origineRuntime':'src/render3d/modeles.ts PROPORTIONS et conformerModele ; src/assets/spec.ts gabaritDe utilise a si la clé manque au style.','clips':clips,'limites':['Chaque clip isolé ; transitions entre clips exclues.','Contrôle numérique d’enveloppe, pas de rendu, FPS ou approbation artistique.','Les distances internes b restent positives après cette application affine inversible, mais leur valeur est transformée.','Gabarit c non certifié.'],'approbationArtistique':False}
(sortie/'mesures-gabarit-a.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'gabarit':'a','poses':sum(c['poses'] for c in clips),'rayonHorizontalMax':max(c['rayonHorizontalMax'] for c in clips),'rayonHorizontalMajorationContinue':max(c['rayonHorizontalMajorationContinue'] for c in clips)}))
