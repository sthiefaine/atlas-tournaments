#!/usr/bin/env python3
"""Complète le suivi d'un seul modèle déjà intégré, sans lancer de production ni publier."""
import argparse
import hashlib
import json
import re
import shutil
import struct
import zipfile
from pathlib import Path

def lire(p):
    return json.loads(p.read_text())

def ecrire(p, valeur):
    p.write_text(json.dumps(valeur, ensure_ascii=False, indent=2) + '\n')

def finaliser(identifiant, agent):
    if not re.fullmatch(r'[a-z0-9_]+', identifiant):
        raise ValueError('Identifiant non conforme')
    lot = Path('assets/livraisons') / identifiant
    preparation = Path('tmp/production-sequentielle') / identifiant
    validation = lire(lot / 'validation-lot.json')
    if validation['id'] != identifiant or not validation['verdict']['ok']:
        raise ValueError('Une intégration techniquement acceptée est requise')
    glb = (lot / f'{identifiant}_lod0.glb').read_bytes()
    doc = json.loads(glb[20:20 + struct.unpack_from('<I', glb, 12)[0]])
    triangles = sum(doc['accessors'][p.get('indices', p['attributes']['POSITION'])]['count'] // 3
                    for m in doc['meshes'] for p in m['primitives'] if p.get('mode', 4) == 4)
    actif = Path('public/assets/modeles') / f'{identifiant}_lod0.glb'
    if actif.read_bytes() != glb:
        raise ValueError('Actif et lot différents')
    officiels = ['README.md', 'creation-originale.json', 'validation-lot.json', 'version-candidat.json']
    copies = []
    for source in sorted(preparation.iterdir()):
        if source.suffix not in ('.md', '.json') or source.name in officiels + ['source.json']:
            continue
        shutil.copyfile(source, lot / source.name)
        copies.append(source.name)
    readme = lot / 'README.md'
    texte = readme.read_text()
    mention = 'Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.'
    if mention not in texte:
        titre, suite = texte.split('\n', 1)
        readme.write_text(titre + '\n\n' + mention + '\n' + suite)
    fichier_plan = Path('assets/production/plan-modeles-3d.json')
    plan = lire(fichier_plan)
    modele = next(m for m in plan['modeles'] if m['id'] == identifiant)
    if modele['actuel']['sha256'] != hashlib.sha256(glb).hexdigest():
        raise ValueError('Régénérer le plan après intégration avant finalisation')
    modele['etat'] = 'livre'
    modele['suivi'].update(agent=agent, etape='integre', publication='pret_a_pousser',
                           triangles=triangles, octetsLot=validation['octets'],
                           revision=validation['revision'], controle='ok', approbationArtistique=False)
    ecrire(fichier_plan, plan)
    with zipfile.ZipFile(lot / f'{identifiant}.zip', 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for nom in sorted(set(validation['verdict']['acceptes'] + officiels + copies)):
            fichier = lot / nom
            if fichier.is_file():
                archive.write(fichier, nom)
    print(json.dumps({'id': identifiant, 'triangles': triangles, 'octetsLot': validation['octets'], 'controle': 'ok'}))

if __name__ == '__main__':
    arguments = argparse.ArgumentParser()
    arguments.add_argument('identifiant')
    arguments.add_argument('agent')
    options = arguments.parse_args()
    finaliser(options.identifiant, options.agent)
