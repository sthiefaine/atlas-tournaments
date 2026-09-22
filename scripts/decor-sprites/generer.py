"""
Les sources du décor photographié : arbres, buissons, herbes, roseaux et
montagnes, en GLB, prêts à cuire (`doc/refonte/sprites-decor.md`).

Commande (depuis la racine du dépôt) :

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        --python-exit-code 1 -P scripts/decor-sprites/generer.py

Options, après `--` :

    --graine N        la graine (défaut 20260923) : même graine, mêmes fichiers,
                      octet pour octet ;
    --sortie DOSSIER  défaut assets/sources-sprites/decor ;
    --seulement PREF  ne produit que les identifiants qui commencent ainsi (la
                      liste n'est alors pas réécrite) ;
    --verifier        produit tout dans un dossier temporaire et compare, octet
                      pour octet, avec le dossier de sortie : code 1 au moindre
                      écart. C'est la preuve de reproductibilité.

Ce que le script écrit : un `decor_<essence>_<saison>_<n>.glb` par variante et
`liste.json`, au format que la chaîne de cuisson lit
(`npm run cuire:sprites -- --liste assets/sources-sprites/decor/liste.json`).
Il **refuse** d'écrire un modèle hors gabarit ou hors budget : il vaut mieux
une commande qui échoue qu'une source fausse qui passe à la cuisson.

Le géométrique est en numpy pur (`geometrie.py`, `arbres.py`, `plantes.py`,
`montagnes.py`) ; Blender ne sert qu'à écrire le glTF (`blender_io.py`).
"""

import argparse
import filecmp
import json
import os
import sys
import tempfile

# Pas de `__pycache__` dans le dépôt : ce script est lancé, pas installé.
sys.dont_write_bytecode = True
ICI = os.path.dirname(os.path.abspath(__file__))
if ICI not in sys.path:
    sys.path.insert(0, ICI)

import numpy as np  # noqa: E402

import blender_io  # noqa: E402
from essences import ESSENCES, GABARITS, TRIANGLES_MAX, identifiant  # noqa: E402

DEPOT = os.path.dirname(os.path.dirname(ICI))
SORTIE_DEFAUT = os.path.join(DEPOT, 'assets', 'sources-sprites', 'decor')
GRAINE_DEFAUT = 20260923
VERSION_LISTE = 1


def lire_arguments():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(prog='generer.py')
    p.add_argument('--graine', type=int, default=GRAINE_DEFAUT)
    p.add_argument('--sortie', default=SORTIE_DEFAUT)
    p.add_argument('--seulement', default=None)
    p.add_argument('--verifier', action='store_true')
    return p.parse_args(argv)


def poser_au_sol(modeles, essence, st):
    """
    La transformation d'une variante, décidée une fois pour toutes ses saisons :

    1. mise à la hauteur visée, mesurée sur la saison de référence (arbres dont
       la structure en porte une) ;
    2. centre de l'emprise de la référence ramené sur l'origine ;
    3. si une saison sort malgré tout du gabarit — une autre graine, un arbre
       nu plus large que feuillu —, un resserrement (ou un élargissement) de
       l'emprise ou de la hauteur juste assez pour que **toutes** y tiennent,
       avec une marge de 3 %.

    La même fonction s'applique ensuite à chaque saison : un arbre ne doit pas
    glisser d'un centimètre, ni changer de taille, en perdant ses feuilles.
    """
    ref = modeles[essence['reference']]
    bas, haut = ref.bornes()
    k = 1.0
    if essence['hauteur_visee'] and 'hauteur' in st:
        k = st['hauteur'] / (haut[1] - max(bas[1], 0.0))
    centre = np.array([(bas[0] + haut[0]) / 2.0, 0.0, (bas[2] + haut[2]) / 2.0])
    tailles = []
    hauteurs = []
    g = GABARITS[essence['gabarit']]
    for m in modeles.values():
        b, h = m.bornes()
        d = (h - b) * k
        tailles += [d[0], d[2]] if 'emprise' in g else [max(d[0], d[2])]
        hauteurs.append(d[1])
    marge = 0.03

    def resserrer(valeurs, borne):
        lo, hi = borne
        if max(valeurs) > hi * (1 - marge):
            return hi * (1 - marge) / max(valeurs)
        if min(valeurs) < lo * (1 + marge):
            return lo * (1 + marge) / min(valeurs)
        return 1.0

    k_sol = resserrer(tailles, g['emprise'] if 'emprise' in g else g['largeur'])
    k_haut = resserrer(hauteurs, g['hauteur'])
    facteurs = k * np.array([k_sol, k_haut, k_sol])

    def appliquer(sommets):
        s = (sommets - centre) * facteurs
        # Rien ne passe sous le sol : une lame qui retombe s'y couche.
        s[:, 1] = np.maximum(s[:, 1], 0.0)
        return s

    return appliquer


def controler(modele, essence, ident, reference=True):
    """
    Les contrôles qui empêchent d'écrire le fichier : budget, gabarit, pied,
    centre. Le centre est exact sur la saison de référence ; les autres ont
    droit à quelques centimètres — l'arbre nu n'a pas l'emprise de l'arbre
    feuillu, et c'est le pied qui ne doit pas bouger, pas la boîte.
    """
    erreurs = []
    tri = modele.triangles()
    if tri > TRIANGLES_MAX:
        erreurs.append(f'{ident} : {tri} triangles > {TRIANGLES_MAX}')
    bas, haut = modele.bornes()
    dx, dy, dz = haut - bas
    g = GABARITS[essence['gabarit']]
    if 'emprise' in g:
        for nom, v in (('largeur', dx), ('profondeur', dz)):
            if not g['emprise'][0] <= v <= g['emprise'][1]:
                erreurs.append(f'{ident} : {nom} {v:.3f} hors de {g["emprise"]}')
    else:
        largeur = max(dx, dz)
        if not g['largeur'][0] <= largeur <= g['largeur'][1]:
            erreurs.append(f'{ident} : largeur {largeur:.3f} hors de {g["largeur"]}')
    if not g['hauteur'][0] <= dy <= g['hauteur'][1]:
        erreurs.append(f'{ident} : hauteur {dy:.3f} hors de {g["hauteur"]}')
    if abs(bas[1]) > 0.002:
        erreurs.append(f'{ident} : pied à y = {bas[1]:.4f}, pas au sol')
    cx, cz = (bas[0] + haut[0]) / 2.0, (bas[2] + haut[2]) / 2.0
    if max(abs(cx), abs(cz)) > (0.005 if reference else 0.04):
        erreurs.append(f'{ident} : emprise décentrée ({cx:.3f}, {cz:.3f})')
    return erreurs, dict(triangles=tri, largeur=float(dx), profondeur=float(dz), hauteur=float(dy))


def produire(graine, sortie, seulement=None):
    os.makedirs(sortie, exist_ok=True)
    entrees = []
    erreurs = []
    mesures = []
    for essence in ESSENCES:
        for n in range(1, essence['variantes'] + 1):
            ids = [identifiant(essence['nom'], s, n) for s in essence['saisons']]
            if seulement and not any(i.startswith(seulement) for i in ids):
                continue
            st = essence['structure'](graine, n)
            # Toutes les saisons d'abord : la pose se décide sur l'ensemble,
            # même quand `--seulement` n'en demande qu'une.
            modeles = {saison: essence['modele'](st, saison) for saison in essence['saisons']}
            appliquer = poser_au_sol(modeles, essence, st)
            for saison, ident in zip(essence['saisons'], ids):
                if seulement and not ident.startswith(seulement):
                    continue
                modele = modeles[saison]
                modele.transformer(appliquer)
                fautes, mesure = controler(modele, essence, ident, saison == essence['reference'])
                erreurs += fautes
                mesures.append((ident, mesure))
                if fautes:
                    continue
                fichier = f'{ident}.glb'
                blender_io.vider()
                blender_io.poser(modele)
                blender_io.exporter(os.path.join(sortie, fichier))
                entrees.append({
                    'id': ident,
                    'famille': 'decor',
                    'cle': essence['nom'],
                    'variante': saison,
                    'fichier': fichier,
                    'vues': ['fixe'],
                    'ombre': True,
                })
    blender_io.vider()
    for ident, m in mesures:
        print(f"{ident:34s} {m['triangles']:5d} tri  l {m['largeur']:.3f}  p {m['profondeur']:.3f}"
              f"  h {m['hauteur']:.3f}")
    if erreurs:
        raise RuntimeError('modèles refusés :\n  ' + '\n  '.join(erreurs))
    if not seulement:
        # Un fichier que la liste ne cite plus est un orphelin : on le retire,
        # pour que le dossier dise exactement ce que la liste dit.
        attendus = {e['fichier'] for e in entrees}
        for nom in sorted(os.listdir(sortie)):
            if nom.startswith('decor_') and nom.endswith('.glb') and nom not in attendus:
                os.remove(os.path.join(sortie, nom))
        with open(os.path.join(sortie, 'liste.json'), 'w', encoding='utf-8') as f:
            json.dump({'version': VERSION_LISTE, 'entrees': entrees}, f, ensure_ascii=False, indent=2)
            f.write('\n')
    return entrees


def verifier(graine, sortie):
    """Refait tout à côté et compare octet pour octet : la reproductibilité, mesurée."""
    with tempfile.TemporaryDirectory(prefix='decor-sprites-') as temp:
        entrees = produire(graine, temp)
        ecarts = []
        noms = ['liste.json'] + [e['fichier'] for e in entrees]
        for nom in noms:
            a, b = os.path.join(temp, nom), os.path.join(sortie, nom)
            if not os.path.exists(b):
                ecarts.append(f'{nom} : absent de {sortie}')
            elif not filecmp.cmp(a, b, shallow=False):
                ecarts.append(f'{nom} : diffère')
        presents = {n for n in os.listdir(sortie) if n.endswith('.glb')}
        for nom in sorted(presents - set(noms)):
            ecarts.append(f'{nom} : en trop dans {sortie}')
        if ecarts:
            raise RuntimeError('les sources ne se reproduisent pas :\n  ' + '\n  '.join(ecarts))
        print(f'reproductible : {len(noms)} fichiers identiques octet pour octet (graine {graine})')


def main():
    args = lire_arguments()
    sortie = os.path.abspath(args.sortie)
    if args.verifier:
        verifier(args.graine, sortie)
    else:
        entrees = produire(args.graine, sortie, args.seulement)
        print(f'{len(entrees)} modèles écrits dans {sortie} (graine {args.graine})')


main()
