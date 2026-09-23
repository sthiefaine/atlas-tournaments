"""
La cuisson d'une entrée : un GLB photographié sous la caméra du contrat
(`src/render2d/contrat.ts`), vue par vue et clip par clip, à quatre fois la
taille.

Lancé par `scripts/sprites/cuire.ts`, jamais à la main :

    Blender -b --factory-startup --python-exit-code 1 -P cuire_entree.py -- <travail.json>

Ce script ne réduit, ne rogne ni n'emballe rien : il rend, et il écrit ce qu'il
a rendu en données brutes (`<vue>_<clip>.bin`, entiers de 16 bits, lumière
linéaire) avec un `resultat.json` qui dit comment les lire. Tout le reste —
la réduction à l'échelle 1, le passage en sRGB, le rognage, les pivots, les
pages — est fait par Node, où il se teste sans Blender.

Ce qui est rendu, par pixel et par image :
- `r g b a` : la passe combinée, prémultipliée, en lumière linéaire (Rec. 709),
  sans transformation de vue — la transformation « Standard » (la fonction sRGB
  par morceaux) est appliquée par Node après la réduction, parce qu'on moyenne
  de la lumière, pas des valeurs encodées ;
- `masque` : le masque d'équipe du matériau, multiplié par la couverture (une
  AOV s'accumule comme le reste : un pixel à moitié couvert en vaut la moitié) ;
- `couverture` : 1 sur toute surface du modèle, 0 ailleurs — c'est ce qui
  permet de diviser le masque sans compter l'ombre au sol ;
- `er eg eb` (bâtiments dont un matériau émet) : la lumière propre, vue par la
  caméra, qui ne compte pas dans la couleur et que le rendu ajoute la nuit.
"""

import json
import math
import os
import sys
import time

import bpy
import numpy as np
import OpenImageIO as oiio
from mathutils import Vector

# La cadence de la scène à l'import. L'importeur glTF convertit les secondes
# en images à la cadence de la scène : à 1200 images par seconde, un instant
# d'échantillonnage tombe sur une image entière à 0,42 ms près, et la
# cuisson n'a jamais besoin de sous-images.
IPS_IMPORT = 1200

VUE_LAYER = 'ViewLayer'


def journal(message):
    print(f'[cuisson] {message}', flush=True)


def lire_travail():
    argv = sys.argv[sys.argv.index('--') + 1:]
    with open(argv[0], encoding='utf-8') as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# 1. La scène : vide, le modèle, un pivot
# ---------------------------------------------------------------------------

def preparer_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = IPS_IMPORT
    scene.render.fps_base = 1.0
    scene.frame_start = 0
    scene.frame_end = 1_000_000
    return scene


def importer(scene, chemin):
    avant = set(bpy.data.objects)
    # Sans forme d'os : pour un modèle à squelette, l'importeur crée sinon une
    # icosphère d'un mètre de rayon, cachée au rendu mais comptée dans une
    # enveloppe — le canevas en aurait deux mètres de côté.
    bpy.ops.import_scene.gltf(filepath=chemin, import_pack_images=False, merge_vertices=False, disable_bone_shape=True)
    objets = [o for o in bpy.data.objects if o not in avant]
    if not objets:
        raise RuntimeError(f'aucun objet importé depuis {chemin}')
    # Le pivot porte le lacet de la vue. Il est à l'origine du monde, donc un
    # enfant accroché sans matrice inverse garde exactement sa position.
    pivot = bpy.data.objects.new('pivot_cuisson', None)
    scene.collection.objects.link(pivot)
    for o in objets:
        if o.parent is None:
            o.parent = pivot
    return objets, pivot


# ---------------------------------------------------------------------------
# 2. Les clips : une action par clip, jouée seule
# ---------------------------------------------------------------------------

def capturer_repos(objets):
    """La pose de liaison de chaque objet et de chaque os, avant toute évaluation."""
    repos = {}
    for o in objets:
        os_ = {}
        if o.type == 'ARMATURE' and o.pose:
            for b in o.pose.bones:
                os_[b.name] = (b.location.copy(), b.rotation_quaternion.copy(), b.rotation_euler.copy(), b.scale.copy())
        repos[o.name] = (o.location.copy(), o.rotation_quaternion.copy(), o.rotation_euler.copy(), o.scale.copy(), os_)
    return repos


def table_des_clips(objets):
    """
    Clip → [(objet, action, emplacement)]. L'importeur pose une action active et
    une piste NLA par clip ; on les relève puis on retire les pistes, sans quoi
    le NLA ferait jouer à un objet absent d'un clip la piste d'un autre.
    """
    table = {}

    def noter(o, action, emplacement):
        liste = table.setdefault(action.name, [])
        if not any(x[0] == o for x in liste):
            liste.append((o, action, emplacement))

    for o in objets:
        ad = o.animation_data
        if ad is None:
            continue
        if ad.action is not None:
            noter(o, ad.action, getattr(ad, 'action_slot', None))
        for piste in ad.nla_tracks:
            for bande in piste.strips:
                if bande.action is not None:
                    noter(o, bande.action, getattr(bande, 'action_slot', None))
    for o in objets:
        ad = o.animation_data
        if ad is None:
            continue
        for piste in list(ad.nla_tracks):
            ad.nla_tracks.remove(piste)
        ad.action = None
    return table


def poser_clip(nom, table, objets, repos):
    """Remet tout au repos, puis donne à chaque objet animé par `nom` son action."""
    for o in objets:
        loc, quat, eul, ech, os_ = repos[o.name]
        o.location = loc
        o.rotation_quaternion = quat
        o.rotation_euler = eul
        o.scale = ech
        for nom_os, (bl, bq, be, bs) in os_.items():
            b = o.pose.bones.get(nom_os)
            if b is not None:
                b.location = bl
                b.rotation_quaternion = bq
                b.rotation_euler = be
                b.scale = bs
        if o.animation_data is not None:
            o.animation_data.action = None
    if nom is None:
        return
    for o, action, emplacement in table.get(nom, []):
        ad = o.animation_data or o.animation_data_create()
        ad.action = action
        if emplacement is not None:
            ad.action_slot = emplacement


def image_de(t):
    return int(round(t * IPS_IMPORT))


# ---------------------------------------------------------------------------
# 3. Les matériaux : blanc sous le masque, AOV, émission à part
# ---------------------------------------------------------------------------

def entree_par_identifiant(noeud, identifiant):
    return next(s for s in noeud.inputs if s.identifier == identifiant)


def sortie_par_identifiant(noeud, identifiant):
    return next(s for s in noeud.outputs if s.identifier == identifiant)


def materiau_teinte(nom, regle):
    """
    Les matériaux sur lesquels le masque agit, par la règle de la 3D :
    - `tous` : un bâtiment — le décor mélange le masque sur tous ses matériaux ;
    - `base` : une unité commune — `couleurPour` (`render3d/modeles.ts`) teinte
      `mat_corps`, `mat_details`, `equipe*` et `accent*` ;
    - `kit` : un kit national — seulement le liseré `equipe*`.
    """
    n = nom.lower()
    if regle == 'tous':
        return True
    if regle == 'base':
        return n in ('mat_corps', 'mat_details') or n.startswith('equipe') or n.startswith('accent')
    if regle == 'kit':
        return n.startswith('equipe')
    return False


def uv_de_l_albedo(nt, bsdf):
    """La prise UV qui alimente la texture d'albédo, pour que le masque suive le même dépliage."""
    base = bsdf.inputs['Base Color']
    pile = [base.links[0].from_node] if base.is_linked else []
    vus = set()
    while pile:
        n = pile.pop()
        if n.name in vus:
            continue
        vus.add(n.name)
        if n.type == 'TEX_IMAGE':
            v = n.inputs['Vector']
            return v.links[0].from_socket if v.is_linked else None
        for s in n.inputs:
            for lien in s.links:
                pile.append(lien.from_node)
    return None


def modifier_materiaux(objets, travail, image_masque):
    vus = set()
    emission_trouvee = False
    teintes = []
    for o in objets:
        if o.type != 'MESH':
            continue
        for emplacement in o.material_slots:
            m = emplacement.material
            if m is None or m.name in vus or m.node_tree is None:
                continue
            vus.add(m.name)
            nt = m.node_tree
            couverture = nt.nodes.new('ShaderNodeOutputAOV')
            couverture.aov_name = 'couverture'
            couverture.inputs['Value'].default_value = 1.0
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is None:
                continue

            if image_masque is not None and materiau_teinte(m.name, travail['regleMasque']):
                teintes.append(m.name)
                tex = nt.nodes.new('ShaderNodeTexImage')
                tex.image = image_masque
                tex.interpolation = 'Linear'
                uv = uv_de_l_albedo(nt, bsdf)
                if uv is not None:
                    nt.links.new(uv, tex.inputs['Vector'])
                sep = nt.nodes.new('ShaderNodeSeparateColor')
                nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
                valeur = sep.outputs[0]
                melange = nt.nodes.new('ShaderNodeMix')
                melange.data_type = 'RGBA'
                melange.blend_type = 'MIX'
                melange.clamp_factor = True
                nt.links.new(valeur, entree_par_identifiant(melange, 'Factor_Float'))
                a = entree_par_identifiant(melange, 'A_Color')
                b = entree_par_identifiant(melange, 'B_Color')
                base = bsdf.inputs['Base Color']
                if base.is_linked:
                    nt.links.new(base.links[0].from_socket, a)
                else:
                    a.default_value = base.default_value
                # `COULEUR_ZONE_EQUIPE_CUISSON` : blanc, que le rendu multiplie par l'équipe.
                b.default_value = (1.0, 1.0, 1.0, 1.0)
                nt.links.new(sortie_par_identifiant(melange, 'Result_Color'), base)
                aov = nt.nodes.new('ShaderNodeOutputAOV')
                aov.aov_name = 'masque'
                nt.links.new(valeur, aov.inputs['Value'])

            if travail['emissionSeparee']:
                couleur = bsdf.inputs['Emission Color']
                force = bsdf.inputs['Emission Strength']
                intensite = 1.0 if force.is_linked else float(force.default_value)
                emet = intensite > 0 and (couleur.is_linked or max(couleur.default_value[:3]) > 0)
                if emet:
                    emission_trouvee = True
                    echelle = nt.nodes.new('ShaderNodeVectorMath')
                    echelle.operation = 'SCALE'
                    if couleur.is_linked:
                        nt.links.new(couleur.links[0].from_socket, echelle.inputs[0])
                    else:
                        echelle.inputs[0].default_value = tuple(couleur.default_value[:3])
                    entree_par_identifiant(echelle, 'Scale').default_value = intensite
                    aov = nt.nodes.new('ShaderNodeOutputAOV')
                    aov.aov_name = 'emission'
                    nt.links.new(echelle.outputs['Vector'], aov.inputs['Color'])
                # La couleur ne porte pas l'émission : le rendu l'ajoute la
                # nuit, comme la 3D le fait (`fenetres` : 0,06 le jour, 1 la nuit).
                for lien in list(force.links):
                    nt.links.remove(lien)
                force.default_value = 0.0
    return emission_trouvee, teintes


# ---------------------------------------------------------------------------
# 4. La lumière, le ciel, l'attrapeur d'ombre
# ---------------------------------------------------------------------------

def vers_la_source(azimut, elevation):
    """
    La direction **vers** la lumière, en coordonnées Blender. L'azimut du
    contrat se lit dans le plan du sol : 0 depuis le joueur (le bas de l'écran,
    Blender −Y), −90 depuis la gauche (−X), 180 depuis le haut (+Y).
    """
    a, e = math.radians(azimut), math.radians(elevation)
    return Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)))


def poser_lumieres(scene, eclairage):
    for nom in ('principale', 'contour'):
        r = eclairage[nom]
        lampe = bpy.data.lights.new(nom, 'SUN')
        lampe.energy = r['force']
        lampe.angle = math.radians(r['angle'])
        if not r['ombre']:
            # Le contour détache la silhouette ; une seconde ombre portée, du
            # côté du joueur, contredirait celle de la principale.
            for attribut in ('use_shadow',):
                if hasattr(lampe, attribut):
                    setattr(lampe, attribut, False)
            if hasattr(lampe, 'cycles') and hasattr(lampe.cycles, 'cast_shadow'):
                lampe.cycles.cast_shadow = False
        objet = bpy.data.objects.new(nom, lampe)
        scene.collection.objects.link(objet)
        # Un soleil éclaire le long de son −Z : on pointe son +Z vers la source.
        objet.rotation_euler = vers_la_source(r['azimut'], r['elevation']).to_track_quat('Z', 'Y').to_euler()
    monde = bpy.data.worlds.new('ciel_cuisson')
    scene.world = monde
    fond = next(n for n in monde.node_tree.nodes if n.type == 'BACKGROUND')
    fond.inputs['Color'].default_value = (1.0, 1.0, 1.0, 1.0)
    fond.inputs['Strength'].default_value = eclairage['ciel']


def poser_attrapeur(scene):
    maillage = bpy.data.meshes.new('attrapeur_ombre')
    c = 6.0
    maillage.from_pydata([(-c, -c, 0), (c, -c, 0), (c, c, 0), (-c, c, 0)], [], [(0, 1, 2, 3)])
    # L'attrapeur ne se voit pas, mais il renvoie de la lumière sur le modèle :
    # un sol d'herbe ou de terre, pas le gris clair par défaut, qui éclairerait
    # le pied des murs par en dessous.
    sol = bpy.data.materials.new('sol_attrapeur')
    fond = next(n for n in sol.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    fond.inputs['Base Color'].default_value = (0.25, 0.25, 0.25, 1.0)
    fond.inputs['Roughness'].default_value = 1.0
    maillage.materials.append(sol)
    objet = bpy.data.objects.new('attrapeur_ombre', maillage)
    # Deux millimètres sous le sol : les faces du modèle posées à zéro ne se
    # disputent pas la profondeur avec lui.
    objet.location.z = -0.002
    objet.is_shadow_catcher = True
    scene.collection.objects.link(objet)
    return objet


# ---------------------------------------------------------------------------
# 5. Le rendu
# ---------------------------------------------------------------------------

def regler_rendu(scene, travail, emission):
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.refresh_devices()
        gpu = False
        for d in prefs.devices:
            d.use = d.type == 'METAL'
            gpu = gpu or d.use
        scene.cycles.device = 'GPU' if gpu else 'CPU'
    except TypeError:
        scene.cycles.device = 'CPU'
    journal(f'périphérique {scene.cycles.device}')
    scene.render.engine = 'CYCLES'
    c = scene.cycles
    c.samples = travail['echantillons']
    c.use_adaptive_sampling = True
    c.adaptive_threshold = travail['seuilAdaptatif']
    c.use_denoising = travail['debruitage']
    if travail['debruitage']:
        c.denoiser = 'OPENIMAGEDENOISE'
        prefiltre = travail.get('prefiltre', 'ACCURATE')
        c.denoising_input_passes = 'RGB' if prefiltre == 'NONE' else 'RGB_ALBEDO_NORMAL'
        c.denoising_prefilter = prefiltre
        try:
            c.denoising_use_gpu = True
        except AttributeError:
            pass
    c.max_bounces = 6
    c.diffuse_bounces = 3
    c.glossy_bounces = 3
    c.transmission_bounces = 2
    c.transparent_max_bounces = 8
    c.volume_bounces = 0
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.use_camera_cull = False
    r = scene.render
    r.film_transparent = True
    r.use_persistent_data = True
    # Sans composition, le fichier reçoit toutes les passes du rendu ; avec,
    # il ne reçoit que la combinée.
    r.use_compositing = False
    r.use_sequencer = False
    r.resolution_percentage = 100
    r.pixel_aspect_x = 1
    r.pixel_aspect_y = 1
    r.use_border = False
    s = r.image_settings
    s.media_type = 'MULTI_LAYER_IMAGE'
    s.file_format = 'OPEN_EXR_MULTILAYER'
    s.color_depth = '16'
    s.exr_codec = 'NONE'
    # La vue « Standard » : la fonction sRGB par morceaux, sans courbe. Elle
    # ne touche pas l'EXR (lumière linéaire) ; Node l'applique après réduction.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    couche = scene.view_layers[0]
    couche.use_pass_combined = True
    for nom, genre in (('masque', 'VALUE'), ('couverture', 'VALUE')) + ((('emission', 'COLOR'),) if emission else ()):
        aov = couche.aovs.add()
        aov.name = nom
        aov.type = genre


def poser_camera(scene, tangage, canevas, pixels_par_case, surechantillonnage):
    """
    La caméra du contrat. Orthographique, lacet nul, tangage `tangage` : elle
    se tient au bas de l'écran (Blender −Y) et regarde vers le haut de l'écran
    (+Y), en plongée. Un point du monde (x, y_carte, h) tombe à
    `(x, y_carte · sin t − h · cos t) × pixels_par_case` dans le plan — c'est
    `versPlan` —, et le canevas couvre exactement `canevas` de ce plan.
    """
    t = math.radians(tangage)
    x0, y0, l, h = canevas['x0'], canevas['y0'], canevas['largeur'], canevas['hauteur']
    donnees = scene.camera.data
    donnees.type = 'ORTHO'
    donnees.sensor_fit = 'HORIZONTAL'
    donnees.ortho_scale = l / pixels_par_case
    donnees.shift_x = 0.0
    donnees.shift_y = 0.0
    donnees.clip_start = 0.01
    donnees.clip_end = 400.0
    xc = (x0 + l / 2) / pixels_par_case
    yc = (y0 + h / 2) / (pixels_par_case * math.sin(t))
    distance = 100.0
    objet = scene.camera
    objet.rotation_mode = 'XYZ'
    objet.rotation_euler = (math.radians(90) - t, 0.0, 0.0)
    objet.location = (xc, -yc - distance * math.cos(t), distance * math.sin(t))
    scene.render.resolution_x = l * surechantillonnage
    scene.render.resolution_y = h * surechantillonnage


def demi_obturateur(anim, fraction):
    """La moitié du temps d'ouverture de l'obturateur, en secondes ; zéro sans flou."""
    temps = anim['temps']
    pas = temps[1] - temps[0] if len(temps) > 1 else 0.0
    return fraction * pas / 2 if anim['anime'] and fraction > 0 and pas > 0 else 0.0


def regler_flou(scene, anim, fraction):
    """
    Le flou de bouge : l'obturateur reste ouvert `fraction` du pas entre deux
    images, centré sur l'instant photographié. À douze images par seconde, un
    rotor qui tourne de cent degrés entre deux images paraîtrait arrêté ou à
    l'envers ; ouvert la moitié du pas, il se lit comme une pièce qui tourne.
    """
    demi = demi_obturateur(anim, fraction)
    scene.render.use_motion_blur = demi > 0
    if demi > 0:
        scene.render.motion_blur_position = 'CENTER'
        # En images de la scène : la cadence d'import, pas celle du clip.
        scene.render.motion_blur_shutter = 2 * demi * IPS_IMPORT


def projeter(p, tangage, pixels_par_case):
    t = math.radians(tangage)
    return (p.x * pixels_par_case, (-p.y * math.sin(t) - p.z * math.cos(t)) * pixels_par_case)


def rendu(o):
    """Vrai si un objet est rendu : ni lui ni aucune de ses collections n'est caché au rendu."""
    return not o.hide_render and not any(c.hide_render for c in o.users_collection)


def points_du_modele(scene, maillages, source_ombre, marge_occlusion):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for o in maillages:
        e = o.evaluated_get(depsgraph)
        mw = e.matrix_world
        coins = [mw @ Vector(c) for c in e.bound_box]
        points.extend(coins)
        if source_ombre is not None:
            # L'ombre portée d'un coin, sur le sol, le long de la principale ;
            # et l'occlusion du ciel déborde de l'emprise au sol.
            for c in coins:
                hauteur = max(0.0, c.z)
                points.append(Vector((c.x - source_ombre.x / source_ombre.z * hauteur,
                                      c.y - source_ombre.y / source_ombre.z * hauteur, 0.0)))
                m = marge_occlusion
                for dx, dy in ((m, 0), (-m, 0), (0, m), (0, -m)):
                    points.append(Vector((c.x + dx, c.y + dy, 0.0)))
    return points


def lire_exr(chemin):
    """Les canaux d'un EXR multicouche de Blender, par nom : une passe par partie."""
    canaux = {}
    entree = oiio.ImageInput.open(chemin)
    if entree is None:
        raise RuntimeError(f'EXR illisible : {chemin} ({oiio.geterror()})')
    try:
        partie = 0
        while entree.seek_subimage(partie, 0):
            spec = entree.spec()
            # Le premier argument est la partie : à zéro, on relirait la
            # combinée sous le nom de chaque passe.
            pixels = entree.read_image(partie, 0, 0, spec.nchannels, 'float')
            if pixels is None:
                raise RuntimeError(f'EXR illisible : {chemin} ({entree.geterror()})')
            pixels = np.asarray(pixels).reshape(spec.height, spec.width, spec.nchannels)
            for i, nom in enumerate(spec.channelnames):
                canaux[nom] = pixels[:, :, i]
            partie += 1
    finally:
        entree.close()
    return canaux


def canal(canaux, passe, composante, forme):
    v = canaux.get(f'{VUE_LAYER}.{passe}.{composante}')
    return np.zeros(forme, dtype=np.float32) if v is None else v


def ecrire_image(fichier, canaux, noms, avec_emission):
    forme = canaux[f'{VUE_LAYER}.Combined.A'].shape
    plans = [
        canal(canaux, 'Combined', 'R', forme), canal(canaux, 'Combined', 'G', forme),
        canal(canaux, 'Combined', 'B', forme), canal(canaux, 'Combined', 'A', forme),
        canal(canaux, 'masque', 'X', forme), canal(canaux, 'couverture', 'X', forme),
    ]
    if avec_emission:
        plans += [canal(canaux, 'emission', c, forme) for c in ('R', 'G', 'B')]
    assert len(plans) == len(noms)
    pile = np.stack(plans, axis=-1)
    brut = np.round(np.clip(pile, 0.0, 1.0) * 65535.0).astype('<u2')
    fichier.write(brut.tobytes())


def main():
    debut = time.time()
    travail = lire_travail()
    scene = preparer_scene()
    objets, pivot = importer(scene, travail['glb'])
    journal(f'import {time.time() - debut:.2f} s, {len(objets)} objets')
    repos = capturer_repos(objets)
    table = table_des_clips(objets)
    journal('clips ' + ', '.join(f'{k}:{len(v)}' for k, v in sorted(table.items())))

    image_masque = None
    if travail.get('masque'):
        image_masque = bpy.data.images.load(travail['masque'], check_existing=True)
        image_masque.colorspace_settings.name = 'Non-Color'
    emission, teintes = modifier_materiaux(objets, travail, image_masque)
    journal(f'matériaux teints {teintes}, émission séparée {emission}')

    poser_lumieres(scene, travail['eclairage'])
    source_ombre = None
    if travail['ombre']:
        poser_attrapeur(scene)
        p = travail['eclairage']['principale']
        source_ombre = vers_la_source(p['azimut'], p['elevation'])
    regler_rendu(scene, travail, emission)
    donnees_camera = bpy.data.cameras.new('camera_cuisson')
    camera = bpy.data.objects.new('camera_cuisson', donnees_camera)
    scene.collection.objects.link(camera)
    scene.camera = camera

    ppc = travail['pixelsParCase']
    sur = travail['surechantillonnage']
    marge = travail['marge']
    maillages = [o for o in objets if o.type == 'MESH' and rendu(o)]
    noms = ['r', 'g', 'b', 'a', 'masque', 'couverture'] + (['er', 'eg', 'eb'] if emission else [])
    os.makedirs(travail['sortie'], exist_ok=True)
    exr = os.path.join(travail['sortie'], 'image.exr')
    resultat = {'canaux': noms, 'emission': emission, 'teintes': teintes, 'vues': [], 'durees': {}}
    temps_rendu = 0.0
    images = 0

    for vue in travail['vues']:
        pivot.rotation_euler = (0.0, 0.0, math.radians(vue['lacet']))
        # Le canevas couvre le modèle dans **toutes** les images de la vue :
        # une seule caméra par vue, donc un seul pivot en pixels.
        xs, ys = [], []
        for anim in vue['animations']:
            poser_clip(anim['clip'] if anim['anime'] else None, table, objets, repos)
            # L'obturateur ouvert voit le modèle un peu avant et un peu après
            # l'instant : l'enveloppe les compte, sans quoi un flou serait rogné.
            demi = demi_obturateur(anim, travail.get('flou', 0.0))
            instants = sorted({max(0.0, t + d) for t in anim['temps'] for d in ((-demi, 0.0, demi) if demi > 0 else (0.0,))})
            for t in instants:
                scene.frame_set(image_de(t))
                for p in points_du_modele(scene, maillages, source_ombre, travail['margeOcclusion']):
                    x, y = projeter(p, vue['tangage'], ppc)
                    xs.append(x)
                    ys.append(y)
        x0 = math.floor(min(xs)) - marge
        y0 = math.floor(min(ys)) - marge
        canevas = {'x0': x0, 'y0': y0, 'largeur': math.ceil(max(xs)) + marge - x0, 'hauteur': math.ceil(max(ys)) + marge - y0}
        poser_camera(scene, vue['tangage'], canevas, ppc, sur)
        sortie_vue = {'vue': vue['vue'], 'lacet': vue['lacet'], 'tangage': vue['tangage'], 'canevas': canevas, 'animations': []}
        for anim in vue['animations']:
            poser_clip(anim['clip'] if anim['anime'] else None, table, objets, repos)
            regler_flou(scene, anim, travail.get('flou', 0.0))
            nom_fichier = f"{vue['vue']}_{anim['clip']}.bin"
            with open(os.path.join(travail['sortie'], nom_fichier), 'wb') as fichier:
                for t in anim['temps']:
                    scene.frame_set(image_de(t))
                    scene.render.filepath = exr
                    t0 = time.time()
                    bpy.ops.render.render(write_still=True)
                    temps_rendu += time.time() - t0
                    ecrire_image(fichier, lire_exr(exr), noms, emission)
                    images += 1
            os.remove(exr)
            sortie_vue['animations'].append({'clip': anim['clip'], 'fichier': nom_fichier, 'images': len(anim['temps'])})
            journal(f"{vue['vue']} {anim['clip']} : {len(anim['temps'])} images, {canevas['largeur'] * sur}×{canevas['hauteur'] * sur} px")
        resultat['vues'].append(sortie_vue)

    resultat['durees'] = {'total': time.time() - debut, 'rendu': temps_rendu, 'images': images}
    with open(os.path.join(travail['sortie'], 'resultat.json'), 'w', encoding='utf-8') as f:
        json.dump(resultat, f, ensure_ascii=False, indent=1)
    journal(f'terminé : {images} images, rendu {temps_rendu:.1f} s, total {time.time() - debut:.1f} s')


main()
