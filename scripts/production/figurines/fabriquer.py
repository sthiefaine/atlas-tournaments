"""
La fabrication d'une figurine dans Blender : charge `unites/<cle>.py` (ou
`batiments/<cle>.py`), le fait construire et animer par la bibliothèque,
exporte le GLB brut, écrit ce que Node doit savoir (`figurine.json`) et rend
les images d'identifiants qui servent aux mesures de palette.

Lancé par `fabriquer.ts` (`npm run fabriquer:figurine -- --cle <cle>` ou
`-- --batiment <cle>`), jamais à la main :

    Blender -b --factory-startup --python-exit-code 1 -P fabriquer.py -- <travail.json>

`travail.json` : { cle, fiche, charte, module, sortie, unite, ids, vuesIds,
vuePrincipale, famille, etat, variante,
cuisson: { imagesParSeconde, imagesMaxParClip, flouDeBouge } } — la cadence et
l'obturateur de la cuisson, lus à leur source par `fabriquer.ts` et posés sur
la bibliothèque avant que le module soit chargé. `famille` vaut `unite` (le
défaut), `batiment` ou `terrain` : un bâtiment reçoit son état et sa variante
(`construire(f, etat, variante)`), et on mesure le coin de son mât.

Ce qui sort, dans `sortie` :
- `modele.glb` : géométrie, UV, normales, matériaux sans texture, nœuds ;
  les cartes et les clips sont posés par `lot.ts` ;
- `figurine.json` : nœuds, pièces, teintes, clips échantillonnés, emprise,
  et pour un bâtiment le coin du mât (`coinMat`) ;
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
LACET_VUE = {'droite': 60, 'bas': 20, 'haut': 160, 'fixe': 0, 'travers': 90}

#: Le canevas des identifiants, en pixels de plan autour du pivot : assez pour
#: toute unité (elle ne doit pas dépasser 0,47 case de côté ni 0,85 case de haut).
CANEVAS_IDS = {'x0': -112, 'y0': -176, 'largeur': 224, 'hauteur': 240}


def journal(message):
    print(f'[figurine] {message}', flush=True)


def charger_module(chemin, famille='unite', etat='base', variante='base'):
    """
    Charge le module d'une figurine. Un bâtiment déclare ce qu'il sait
    construire (`ETATS`, `VARIANTES`, `('base',)` par défaut) et reçoit ce qu'on
    lui demande : `construire(f, etat, variante)`, `animer(f, etat, variante)`.
    """
    spec = importlib.util.spec_from_file_location('unite_figurine' if famille == 'unite' else 'batiment_figurine', chemin)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    signature = '(f)' if famille == 'unite' else '(f, etat, variante)'
    for nom in ('construire', 'animer'):
        if not callable(getattr(module, nom, None)):
            raise RuntimeError(f'{chemin} doit définir {nom}{signature}')
    if famille != 'unite':
        etats = tuple(getattr(module, 'ETATS', ('base',)))
        variantes = tuple(getattr(module, 'VARIANTES', ('base',)))
        if etat not in etats:
            raise RuntimeError(f'{chemin} ne sait pas l’état {etat} (ETATS = {etats})')
        if variante not in variantes:
            raise RuntimeError(f'{chemin} ne sait pas la variante {variante} (VARIANTES = {variantes})')
    return module


def appeler(module, nom, f, travail):
    """`construire` ou `animer`, avec l'état et la variante d'un bâtiment."""
    if travail.get('famille', 'unite') == 'unite':
        return getattr(module, nom)(f)
    return getattr(module, nom)(f, travail.get('etat', 'base'), travail.get('variante', 'base'))


def coin_mat(f, mat):
    """
    Le coin du mât d'un bâtiment (`charte.json`, `batiments.mat`) : ce qui
    dépasse `hauteurMax` dans le cercle de `rayon` autour du pied (x, z), dans
    la pose de repos et dans chaque image que la cuisson photographie. Mesuré
    sur les triangles : chacun est coupé au plan y = hauteurMax, et ce qui en
    reste au-dessus est confronté au disque (centre dedans, ou un bord à moins
    du rayon). Rend le verdict, la plus grande hauteur trouvée dans le cercle
    (une borne haute : le haut du triangle coupé) et les nœuds fautifs.
    """
    import numpy as np
    cx, cz, r, hmax = mat['x'], mat['z'], mat['rayon'], mat['hauteurMax']
    poses = [(None, 0.0)] + [(nom, t) for nom, c in f.clips.items() for t in b._instants(c.duree, c.boucle)]
    racine = f.objets['racine']
    pire = None
    fautifs = set()

    def dans_le_disque(poly):
        # Le centre dans le polygone convexe, ou un bord à moins du rayon.
        signe = 0
        dedans = True
        for i in range(len(poly)):
            (ax, az), (bx, bz) = poly[i], poly[(i + 1) % len(poly)]
            ex, ez = bx - ax, bz - az
            c = ex * (cz - az) - ez * (cx - ax)
            if abs(c) > 1e-12:
                s = 1 if c > 0 else -1
                if signe == 0:
                    signe = s
                elif s != signe:
                    dedans = False
            n2 = ex * ex + ez * ez
            t = 0.0 if n2 < 1e-18 else max(0.0, min(1.0, ((cx - ax) * ex + (cz - az) * ez) / n2))
            px, pz = ax + t * ex, az + t * ez
            if (px - cx) ** 2 + (pz - cz) ** 2 <= r * r:
                return True
        return dedans and signe != 0

    for clip, t in poses:
        f.poser(clip, t)
        racine.rotation_euler = (0.0, 0.0, 0.0)
        bpy.context.view_layer.update()
        for nom, ob in f.objets.items():
            if ob.type != 'MESH':
                continue
            me = ob.data
            me.calc_loop_triangles()
            if not len(me.loop_triangles):
                continue
            tris = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
            me.loop_triangles.foreach_get('vertices', tris)
            tris = tris.reshape(-1, 3)
            co = np.empty(len(me.vertices) * 3, dtype=np.float64)
            me.vertices.foreach_get('co', co)
            m = np.array(ob.matrix_world, dtype=np.float64)
            w = co.reshape(-1, 3) @ m[:3, :3].T + m[:3, 3]
            # Blender (x, y, z) → modèle (x, z, −y).
            mod = np.stack([w[:, 0], w[:, 2], -w[:, 1]], axis=1)
            p = mod[tris]
            candidats = np.nonzero((p[:, :, 1].max(axis=1) > hmax + 1e-6)
                                   & (p[:, :, 0].min(axis=1) <= cx + r) & (p[:, :, 0].max(axis=1) >= cx - r)
                                   & (p[:, :, 2].min(axis=1) <= cz + r) & (p[:, :, 2].max(axis=1) >= cz - r))[0]
            for i in candidats:
                tri = p[i]
                # Sutherland–Hodgman contre y > hmax.
                coupe = []
                for k in range(3):
                    a, bb = tri[k], tri[(k + 1) % 3]
                    da, db = a[1] - hmax, bb[1] - hmax
                    if da > 0:
                        coupe.append(a)
                    if (da > 0) != (db > 0):
                        s = da / (da - db)
                        coupe.append(a + s * (bb - a))
                if len(coupe) < 3:
                    continue
                if dans_le_disque([(q[0], q[2]) for q in coupe]):
                    haut = float(max(q[1] for q in coupe))
                    pire = haut if pire is None else max(pire, haut)
                    fautifs.add(nom)
    f.poser(None, 0.0)
    racine.rotation_euler = (0.0, 0.0, 0.0)
    return {'libre': pire is None, 'hauteur': None if pire is None else round(pire, 4), 'noeuds': sorted(fautifs), 'poses': len(poses),
            'pied': [cx, cz], 'rayon': r, 'hauteurMax': hmax}


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
    """Les instants que la cuisson photographie : la règle de la bibliothèque, une seule."""
    return b._instants(duree, boucle)


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


def rendre_ids(f, sortie, vues, vue_principale='droite'):
    """
    Les images d'identifiants : Workbench, à plat, couleur d'attribut, sans
    anticrénelage. Le repos de la vue principale (`droite` pour une unité,
    `fixe` pour un bâtiment) est rendu à chaque instant que la cuisson
    photographie ; le reste à sa première pose. Un clip que le modèle n'a pas
    (un pont n'en a aucun) est rendu dans la pose de repos, comme la cuisson
    le photographie.
    """
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
        c = f.clips.get(clip)
        temps = instants_cuisson(c.duree, c.boucle) if c is not None and vue == vue_principale and clip == 'repos' else [0.0]
        images = []
        for k, t in enumerate(temps):
            f.poser(clip if c is not None else None, t)
            racine.rotation_mode = 'XYZ'
            racine.rotation_euler = (0.0, 0.0, math.radians(LACET_VUE[vue]))
            bpy.context.view_layer.update()
            nom = f'{vue}_{clip}_{k:02d}.png'
            scene.render.filepath = os.path.join(dossier, nom)
            bpy.ops.render.render(write_still=True)
            images.append({'t': round(t, 6), 'fichier': f'ids/{nom}'})
        sorties.append({'vue': vue, 'clip': clip, 'images': images})
    tournants = rendre_tournants(f, scene, dossier, racine, vue_principale)
    f.poser(None, 0.0)
    racine.rotation_euler = (0.0, 0.0, 0.0)
    return {'canevas': CANEVAS_IDS, 'encodage': 'R = 10 × (indice de la teinte dans la charte + 1) ; G = 255 sur une pièce tournante',
            'vues': sorties, **({'tournants': tournants} if tournants else {})}


#: Combien de poses composent le masque d'une pièce tournante : un tour en pas de 5°.
POSES_TOURNANTS = 72

#: Ce dont le masque déborde de ce que la pièce balaie, en pixels : l'anneau
#: du contour (12 pixels à l'échelle 4, soit 3) et un pixel de bord.
DEBORD_TOURNANTS = 4


def rendre_tournants(f, scene, dossier, racine, vue='droite'):
    """
    Le masque de ce que balaient les pièces qui ont le droit de bouger au
    repos — tournantes (rotors) et mobiles (une boule-caméra qui balaie, une
    parabole) —, dans la vue principale (« droite » pour une unité, « fixe »
    pour un bâtiment). Chaque pièce qui tourne par `tourner` est
    posée sur un tour entier, par pas de 5°, autour de son axe —
    échantillonner le clip ne suffit pas : à trois tours en 2,4 s, même
    quarante-huit instants laissent des trous entre les pales ; les autres
    suivent leur clip. L'union est ensuite élargie de l'anneau du contour, qui
    suit les pales dans l'image cuite. Les mesures d'agitation excluent ces
    pixels.
    """
    import numpy as np
    from mathutils import Quaternion
    noms = [nom for nom, n in f.noeuds.items() if n.tournant or n.mobile]
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
            racine.rotation_euler = (0.0, 0.0, math.radians(LACET_VUE[vue]))
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
    nom = f'{vue}_repos_tournants.png'
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
    cuisson = travail.get('cuisson') or {}
    b.IMAGES_PAR_SECONDE = cuisson.get('imagesParSeconde', b.IMAGES_PAR_SECONDE)
    b.IMAGES_MAX_PAR_CLIP = cuisson.get('imagesMaxParClip', b.IMAGES_MAX_PAR_CLIP)
    b.FLOU_DE_BOUGE = cuisson.get('flouDeBouge', b.FLOU_DE_BOUGE)
    charte = b.Charte(travail['charte'])
    with open(travail['fiche'], encoding='utf-8') as fl:
        fiche = json.load(fl)
    famille = travail.get('famille', 'unite')
    f = b.Figurine(travail['cle'], fiche, charte, travail.get('unite'), famille=famille)
    module = charger_module(travail['module'], famille, travail.get('etat', 'base'), travail.get('variante', 'base'))
    appeler(module, 'construire', f, travail)
    appeler(module, 'animer', f, travail)
    f.terminer()
    sortie = travail['sortie']
    os.makedirs(sortie, exist_ok=True)
    f.exporter(os.path.join(sortie, 'modele.glb'))
    rapport = f.rapport()
    rapport['emprise'] = emprise(f)
    # Ce que le module déclare de lui-même : une largeur visée plus étroite que
    # sa classe (`LARGEUR_VISEE = (min, max)`, en cases), un genre qui corrige
    # celui que le canon laisse deviner (`GENRE`) ; un bâtiment, ses états et
    # ses variantes.
    visee = getattr(module, 'LARGEUR_VISEE', None)
    rapport['declarations'] = {'largeurVisee': list(visee) if visee else None, 'genre': getattr(module, 'GENRE', None)}
    if famille != 'unite':
        rapport['declarations'].update({'etats': list(getattr(module, 'ETATS', ('base',))), 'variantes': list(getattr(module, 'VARIANTES', ('base',)))})
    if famille == 'batiment':
        rapport['coinMat'] = coin_mat(f, charte.donnees['batiments']['mat'])
        journal('coin du mât : ' + ('libre' if rapport['coinMat']['libre']
                                     else f'occupé jusqu’à {rapport["coinMat"]["hauteur"]} m par {", ".join(rapport["coinMat"]["noeuds"])}'))
    journal(f'{len(rapport["pieces"])} pièces, {rapport["triangles"]} triangles, teintes {", ".join(rapport["teintes"])}')
    if travail.get('ids', True):
        vues = travail.get('vuesIds', [['droite', 'repos'], ['bas', 'deplacement'], ['haut', 'deplacement']])
        rapport['ids'] = rendre_ids(f, sortie, [tuple(v) for v in vues], travail.get('vuePrincipale', 'droite'))
    rapport['secondes'] = round(time.time() - debut, 2)
    with open(os.path.join(sortie, 'figurine.json'), 'w', encoding='utf-8') as fl:
        json.dump(rapport, fl, ensure_ascii=False, indent=1)
    for a in rapport['avertissements']:
        journal(f'avertissement : {a}')
    journal(f'terminé en {rapport["secondes"]} s')


main()
