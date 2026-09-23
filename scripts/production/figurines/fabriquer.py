"""
La fabrication d'une figurine dans Blender : charge `unites/<cle>.py`, le fait
construire et animer par la bibliothèque, exporte le GLB brut, écrit ce que
Node doit savoir (`figurine.json`) et rend les images d'identifiants qui
servent aux mesures de palette.

Lancé par `fabriquer.ts` (`npm run fabriquer:figurine -- --cle <cle>`), jamais
à la main :

    Blender -b --factory-startup --python-exit-code 1 -P fabriquer.py -- <travail.json>

`travail.json` : { cle, fiche, charte, module, sortie, unite, ids, vuesIds }.

Ce qui sort, dans `sortie` :
- `modele.glb` : géométrie, UV, normales, matériaux sans texture, nœuds ;
  les cartes et les clips sont posés par `lot.ts` ;
- `figurine.json` : nœuds, pièces, teintes, clips échantillonnés, emprise ;
- `ids/<vue>_<clip>_<k>.png` : le modèle rendu à plat, chaque pixel à la
  couleur d'identifiant de sa pièce (R : la teinte, G : une pièce tournante),
  sous la caméra exacte de la cuisson, sans anticrénelage.
"""

import importlib.util
import json
import math
import os
import sys
import time

sys.dont_write_bytecode = True
ICI = os.path.dirname(os.path.abspath(__file__))
if ICI not in sys.path:
    sys.path.insert(0, ICI)

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import bibliotheque as b  # noqa: E402

#: La caméra de la cuisson (`src/render2d/contrat.ts`), recopiée : le rendu
#: d'identifiants doit tomber au pixel près sur l'image cuite.
PIXELS_PAR_CASE = 128
TANGAGE_CARTE = 50
LACET_VUE = {'droite': 60, 'bas': 20, 'haut': 160}

#: Le canevas des identifiants, en pixels de plan autour du pivot : assez pour
#: toute unité (elle ne doit pas dépasser 0,47 case de côté ni 0,85 case de haut).
CANEVAS_IDS = {'x0': -112, 'y0': -176, 'largeur': 224, 'hauteur': 240}


def journal(message):
    print(f'[figurine] {message}', flush=True)


def charger_module(chemin):
    spec = importlib.util.spec_from_file_location('unite_figurine', chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for nom in ('construire', 'animer'):
        if not callable(getattr(module, nom, None)):
            raise RuntimeError(f'{chemin} doit définir {nom}(f)')
    return module


def emprise(f):
    """La boîte du modèle au repos, dans le repère du modèle, sur les sommets réels."""
    bpy.context.view_layer.update()
    mn = [math.inf] * 3
    mx = [-math.inf] * 3
    for ob in f.objets.values():
        if ob.type != 'MESH':
            continue
        m = ob.matrix_world
        for v in ob.data.vertices:
            p = b.depuis_blender(m @ v.co)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return {'min': [round(v, 5) for v in mn], 'max': [round(v, 5) for v in mx]}


def instants_cuisson(duree, boucle):
    """Les instants que la cuisson photographie (`scripts/sprites/echantillonnage.ts`, recopié)."""
    if duree <= 0:
        return [0.0]
    if boucle:
        n = max(1, min(b.IMAGES_MAX_PAR_CLIP, round(duree * b.IMAGES_PAR_SECONDE)))
        return [k * duree / n for k in range(n)]
    n = max(2, min(b.IMAGES_MAX_PAR_CLIP, math.ceil(duree * b.IMAGES_PAR_SECONDE - 1e-9) + 1))
    return [k * duree / (n - 1) for k in range(n)]


def poser_camera(scene, camera, tangage, canevas):
    """La caméra de `cuire_entree.py` (`poser_camera`), à l'échelle 1."""
    t = math.radians(tangage)
    x0, y0, l, h = canevas['x0'], canevas['y0'], canevas['largeur'], canevas['hauteur']
    donnees = camera.data
    donnees.type = 'ORTHO'
    donnees.sensor_fit = 'HORIZONTAL'
    donnees.ortho_scale = l / PIXELS_PAR_CASE
    donnees.clip_start = 0.01
    donnees.clip_end = 400.0
    xc = (x0 + l / 2) / PIXELS_PAR_CASE
    yc = (y0 + h / 2) / (PIXELS_PAR_CASE * math.sin(t))
    distance = 100.0
    camera.rotation_euler = (math.radians(90) - t, 0.0, 0.0)
    camera.location = (xc, -yc - distance * math.cos(t), distance * math.sin(t))
    scene.render.resolution_x = l
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100


def rendre_ids(f, sortie, vues):
    """Les images d'identifiants : Workbench, à plat, couleur d'attribut, sans anticrénelage."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    ombrage = scene.display.shading
    ombrage.light = 'FLAT'
    ombrage.color_type = 'VERTEX'
    ombrage.show_object_outline = False
    ombrage.show_cavity = False
    ombrage.show_shadows = False
    ombrage.show_specular_highlight = False
    scene.display.render_aa = 'OFF'
    scene.render.film_transparent = True
    scene.render.dither_intensity = 0.0
    try:
        scene.view_settings.view_transform = 'Standard'
    except TypeError:
        pass
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    for ob in f.objets.values():
        if ob.type == 'MESH':
            couleurs = ob.data.color_attributes
            couleurs.active_color_name = b.NOM_ID
            couleurs.render_color_index = couleurs.find(b.NOM_ID)
    camera = bpy.data.objects.new('camera_ids', bpy.data.cameras.new('camera_ids'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    poser_camera(scene, camera, TANGAGE_CARTE, CANEVAS_IDS)
    dossier = os.path.join(sortie, 'ids')
    os.makedirs(dossier, exist_ok=True)
    racine = f.objets['racine']
    sorties = []
    for vue, clip in vues:
        if clip not in f.clips:
            continue
        c = f.clips[clip]
        temps = instants_cuisson(c.duree, c.boucle) if vue == 'droite' and clip == 'repos' else [0.0]
        images = []
        for k, t in enumerate(temps):
            f.poser(clip, t)
            racine.rotation_mode = 'XYZ'
            racine.rotation_euler = (0.0, 0.0, math.radians(LACET_VUE[vue]))
            bpy.context.view_layer.update()
            nom = f'{vue}_{clip}_{k:02d}.png'
            scene.render.filepath = os.path.join(dossier, nom)
            bpy.ops.render.render(write_still=True)
            images.append({'t': round(t, 6), 'fichier': f'ids/{nom}'})
        sorties.append({'vue': vue, 'clip': clip, 'images': images})
    tournants = rendre_tournants(f, scene, dossier, racine)
    f.poser(None, 0.0)
    racine.rotation_euler = (0.0, 0.0, 0.0)
    return {'canevas': CANEVAS_IDS, 'encodage': 'R = 10 × (indice de la teinte dans la charte + 1) ; G = 255 sur une pièce tournante',
            'vues': sorties, **({'tournants': tournants} if tournants else {})}


#: Combien de poses composent le masque d'une pièce tournante : un tour en pas de 5°.
POSES_TOURNANTS = 72

#: Ce dont le masque déborde de ce que la pièce balaie, en pixels : l'anneau
#: du contour (12 pixels à l'échelle 4, soit 3) et un pixel de bord.
DEBORD_TOURNANTS = 4


def rendre_tournants(f, scene, dossier, racine):
    """
    Le masque de ce que balaient les pièces tournantes (rotors, parabole
    radar) pendant le repos, en vue « droite ». Chaque pièce qui tourne par
    `tourner` est posée sur un tour entier, par pas de 5°, autour de son axe —
    échantillonner le clip ne suffit pas : à trois tours en 2,4 s, même
    quarante-huit instants laissent des trous entre les pales ; les autres
    suivent leur clip. L'union est ensuite élargie de l'anneau du contour, qui
    suit les pales dans l'image cuite. Les mesures d'agitation excluent ces
    pixels.
    """
    import numpy as np
    from mathutils import Quaternion
    noms = [nom for nom, n in f.noeuds.items() if n.tournant]
    if not noms or 'repos' not in f.clips:
        return None
    caches = [ob for nom, ob in f.objets.items() if ob.type == 'MESH' and nom not in noms]
    for ob in caches:
        ob.hide_render = True
    clip = f.clips['repos']
    temporaire = os.path.join(dossier, '_tournant.png')
    union = None
    try:
        for k in range(POSES_TOURNANTS):
            f.poser('repos', clip.duree * k / POSES_TOURNANTS)
            for nom in noms:
                axe = f.noeuds[nom].axe_tour
                if axe is not None:
                    ob = f.objets[nom]
                    ob.rotation_mode = 'QUATERNION'
                    ob.rotation_quaternion = Quaternion(b.vb(b.direction(axe)), math.radians(360.0 * k / POSES_TOURNANTS))
            racine.rotation_mode = 'XYZ'
            racine.rotation_euler = (0.0, 0.0, math.radians(LACET_VUE['droite']))
            bpy.context.view_layer.update()
            scene.render.filepath = temporaire
            bpy.ops.render.render(write_still=True)
            image = bpy.data.images.load(temporaire, check_existing=False)
            pixels = np.empty(len(image.pixels), dtype=np.float32)
            image.pixels.foreach_get(pixels)
            alpha = pixels.reshape(image.size[1], image.size[0], 4)[:, :, 3] > 0.5
            union = alpha if union is None else (union | alpha)
            bpy.data.images.remove(image)
    finally:
        for ob in caches:
            ob.hide_render = False
        if os.path.exists(temporaire):
            os.remove(temporaire)
    elargi = union.copy()
    r = DEBORD_TOURNANTS
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                elargi |= np.roll(np.roll(union, dy, axis=0), dx, axis=1)
    union = elargi
    h, w = union.shape
    sortie = np.zeros((h, w, 4), dtype=np.float32)
    sortie[union] = (0.0, 1.0, 0.0, 1.0)
    image = bpy.data.images.new('tournants', w, h, alpha=True)
    image.pixels.foreach_set(sortie.ravel())
    nom = 'droite_repos_tournants.png'
    image.filepath_raw = os.path.join(dossier, nom)
    image.file_format = 'PNG'
    image.save()
    return f'ids/{nom}'


def main():
    debut = time.time()
    argv = sys.argv[sys.argv.index('--') + 1:]
    with open(argv[0], encoding='utf-8') as fl:
        travail = json.load(fl)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    charte = b.Charte(travail['charte'])
    with open(travail['fiche'], encoding='utf-8') as fl:
        fiche = json.load(fl)
    f = b.Figurine(travail['cle'], fiche, charte, travail.get('unite'))
    module = charger_module(travail['module'])
    module.construire(f)
    module.animer(f)
    f.terminer()
    sortie = travail['sortie']
    os.makedirs(sortie, exist_ok=True)
    f.exporter(os.path.join(sortie, 'modele.glb'))
    rapport = f.rapport()
    rapport['emprise'] = emprise(f)
    # Ce que le module déclare de lui-même : une largeur visée plus étroite que
    # sa classe (`LARGEUR_VISEE = (min, max)`, en cases), un genre qui corrige
    # celui que le canon laisse deviner (`GENRE`).
    visee = getattr(module, 'LARGEUR_VISEE', None)
    rapport['declarations'] = {'largeurVisee': list(visee) if visee else None, 'genre': getattr(module, 'GENRE', None)}
    journal(f'{len(rapport["pieces"])} pièces, {rapport["triangles"]} triangles, teintes {", ".join(rapport["teintes"])}')
    if travail.get('ids', True):
        rapport['ids'] = rendre_ids(f, sortie, [tuple(v) for v in travail.get('vuesIds', [['droite', 'repos'], ['bas', 'deplacement'], ['haut', 'deplacement']])])
    rapport['secondes'] = round(time.time() - debut, 2)
    with open(os.path.join(sortie, 'figurine.json'), 'w', encoding='utf-8') as fl:
        json.dump(rapport, fl, ensure_ascii=False, indent=1)
    for a in rapport['avertissements']:
        journal(f'avertissement : {a}')
    journal(f'terminé en {rapport["secondes"]} s')


main()
