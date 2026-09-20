#!/usr/bin/env python3
"""Cartes PBR déterministes, sans lumière peinte. Dépendances : numpy et Pillow."""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np
from PIL import Image

IDENTIFIANT = 'unite_meridien_veilleur_base'
PALETTE = [
    (188,188,188), # panneaux d’équipe strictement gris
    (55,63,65),    # moteurs et connectique en composite graphite
    (36,39,40),    # caoutchouc
    (149,156,160), # aluminium/inox brossé
    (23,53,65),    # lentille teintée sans reflet peint
    (133,139,141), # capsule, radôme et panneaux techniques
    (49,56,59),    # grille de refroidissement
    (216,155,71),  # verre ambré du témoin (pas une couleur de camp)
    (79,84,85), (59,65,69), (36,39,40), (149,156,160),
    (23,53,65), (96,104,107), (49,56,59), (216,155,71),
]
RUGOSITE = [178,190,229,107,55,180,207,66]*2
METAL = [0,0,0,226,0,0,0,0]*2
RUGOSITE[8] = 196
METAL[8] = 132

def fabriquer(sortie: Path):
    taille = 1024
    tuile = taille // 4
    albedo = np.zeros((taille,taille,3),dtype=np.uint8)
    normale = np.zeros((taille,taille,3),dtype=np.uint8)
    rugosite = np.zeros((taille,taille,3),dtype=np.uint8)
    metal = np.zeros((taille,taille),dtype=np.uint8)
    masque = np.zeros((taille,taille),dtype=np.uint8)
    for role in range(16):
        rng = np.random.default_rng(211947 + role)
        v,u = np.mgrid[0:tuile,0:tuile] / tuile
        bruit = rng.normal(0,1,(tuile,tuile))
        grain = (np.sin(u*2*np.pi*51.0 + np.sin(v*2*np.pi*19.0)) + np.sin(v*2*np.pi*43.0))*.25 + bruit*.30
        genre = role if role == 8 else role % 8
        # Les couleurs décrivent uniquement le pigment ; aucune distance à une arête,
        # direction de lampe, ombre portée, reflet ou occlusion n'entre dans l'albédo.
        variation = grain * (2.5 if genre != 2 else 3.8)
        if genre == 3:
            variation += np.sin(v*2*np.pi*97) * .7
        couleur = np.clip(np.asarray(PALETTE[role])[None,None,:]+variation[:,:,None],0,255)
        # Hauteur analytique du matériau en unités relatives UV.
        hauteur = grain * .000055
        if genre == 2:
            # Grain moulé et sillons fins de caoutchouc dans la normale seulement.
            hauteur += np.sin(v*2*np.pi*36) * .00018
        if genre == 3:
            hauteur += np.sin(v*2*np.pi*104) * .00009
        if genre == 6:
            hauteur += np.sin(u*2*np.pi*17) * .0005
        if genre == 8:
            # Nervures pressées du plancher : relief de matière, jamais une ombre.
            hauteur += (np.sin((u+v)*2*np.pi*12)**6 + np.sin((u-v)*2*np.pi*12)**6) * .00016
        if genre in [0,1,5]:
            # Peau d'orange de peinture entretenue, pas de fissures ni d'impacts.
            hauteur += np.sin(u*2*np.pi*23)*np.sin(v*2*np.pi*29)*.000045
        if genre in [0,5]:
            # Joint de tôle et têtes de fixation : uniquement un microrelief de normale.
            distance_bord=np.minimum.reduce([u,1-u,v,1-v])
            hauteur -= np.exp(-((distance_bord-.091)/.004)**2)*.00026
            for ru,rv in [(.125,.125),(.125,.875),(.875,.125),(.875,.875)]:
                hauteur += np.exp(-((u-ru)**2+(v-rv)**2)/(.012**2))*.00042
        if genre in [4,7]:
            hauteur *= .08
        # Données glTF : +Y tangent. La dérivée suit l'axe V réel du PNG/UV0.
        dv,du = np.gradient(hauteur, 1/tuile, 1/tuile)
        n = np.stack([-du,-dv,np.ones_like(du)],axis=-1)
        n /= np.linalg.norm(n,axis=-1,keepdims=True)
        nr = np.clip(np.rint((n*.5+.5)*255),0,255).astype(np.uint8)
        rr = np.clip(RUGOSITE[role] + grain*5,0,255).astype(np.uint8)
        mm = np.full((tuile,tuile),METAL[role],dtype=np.uint8)
        y,x = (role//4)*tuile,(role%4)*tuile
        s = np.s_[y:y+tuile,x:x+tuile]
        albedo[s] = np.rint(couleur).astype(np.uint8)
        normale[s] = nr
        rugosite[s] = np.stack([np.full_like(rr,255),rr,mm],axis=-1)
        metal[s] = mm
        masque[s] = 255 if genre == 0 else 0
    cartes = {
        'albedo': Image.fromarray(albedo),
        'normale': Image.fromarray(normale),
        'rugosite': Image.fromarray(rugosite).resize((512,512),Image.Resampling.BOX),
        'metal': Image.fromarray(metal).resize((512,512),Image.Resampling.NEAREST),
        'masque_equipe': Image.fromarray(masque).resize((512,512),Image.Resampling.NEAREST),
    }
    sortie.mkdir(parents=True,exist_ok=True)
    rapport = {'methode':'pigments et microreliefs analytiques déterministes ; aucun éclairage calculé ni peint', 'bakeHD':False,'normale':'+Y tangent, vecteurs renormalisés','atlas':{'grille':[4,4],'gouttierePixels':16,'roles':PALETTE},'cartes':[]}
    for canal,img in cartes.items():
        fichier=sortie/f'{IDENTIFIANT}_{canal}.png'
        img.save(fichier,optimize=True,compress_level=9)
        rapport['cartes'].append({'canal':canal,'dimensions':list(img.size),'mode':img.mode,'octets':fichier.stat().st_size,'sha256':hashlib.sha256(fichier.read_bytes()).hexdigest()})
    # Le contrôle technique du lot recoupe aussi les gris sous chaque pixel blanc.
    assert set(np.unique(np.array(cartes['masque_equipe']))) == {0,255}
    assert np.array_equal(np.array(cartes['rugosite'])[:,:,2],np.array(cartes['metal']))
    rapport['masqueValeurs']=[0,255]
    rapport['metalEditableIdentiqueCanalB']=True
    (sortie/'textures-fabrication.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('sortie',nargs='?',default=f'tmp/production-sequentielle/{IDENTIFIANT}')
    fabriquer(Path(p.parse_args().sortie))
