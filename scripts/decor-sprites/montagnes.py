"""
Les montagnes : roche tempérée (herbe au pied, neige l'hiver), grès du désert,
basalte du volcan.

Une montagne **remplit sa case** : l'emprise est un carré aux coins arrondis
(une superellipse) d'environ 0,94 de côté, et elle monte de 0,55 à 0,8. C'est
un relief en champ de hauteur posé sur une grille polaire centrée sur le
sommet principal : la résolution est là où la pente change le plus, et le bord
touche le sol partout (hauteur nulle), si bien que deux montagnes voisines se
posent sur le sol de leur case sans raccord à faire.

Les couleurs sont des pigments — roche, herbe, grès en strates, basalte, neige —
décidés par la hauteur, la pente et un bruit graîné. Aucune ombre n'est peinte :
la cuisson éclaire, et c'est la lumière qui fera la montagne.
"""

import math

import numpy as np

from geometrie import Bruit, Modele, couleur, lisser, melange, normer, orienter, rng_de, tube

HAUT = np.array([0.0, 1.0, 0.0])
NEIGE = couleur('#f4f8fc')

ANNEAUX = 20
SECTEURS = 64
DEMI_EMPRISE = 0.47
EXPOSANT_BORD = 3.2


# ---------------------------------------------------------------------------
# La grille polaire
# ---------------------------------------------------------------------------


def _distance_bord(centre, angles, demi):
    """Distance du centre au bord de la superellipse, le long de chaque direction (dichotomie)."""
    cx, cz = centre
    c, s = np.cos(angles), np.sin(angles)
    bas = np.zeros_like(angles)
    haut = np.full_like(angles, 3.0 * np.max(demi))
    for _ in range(48):
        mi = 0.5 * (bas + haut)
        x = (cx + mi * c) / demi
        z = (cz + mi * s) / demi
        dedans = np.abs(x) ** EXPOSANT_BORD + np.abs(z) ** EXPOSANT_BORD < 1.0
        bas = np.where(dedans, mi, bas)
        haut = np.where(dedans, haut, mi)
    return 0.5 * (bas + haut)


def grille(centre, bruit, fractions=None):
    """
    Les sommets (x, z) de la grille, et pour chacun sa fraction radiale `d` (0 au
    sommet, 1 au bord) et son angle. Le bord a un léger bruit : une emprise
    parfaitement régulière se lirait comme un socle.
    """
    angles = 2.0 * math.pi * np.arange(SECTEURS) / SECTEURS
    demi = DEMI_EMPRISE + 0.011 * bruit.fbm(np.cos(angles) * 1.7 + 4.0, np.sin(angles) * 1.7 - 2.0, 3)
    D = _distance_bord(centre, angles, demi)
    if fractions is None:
        fractions = np.arange(1, ANNEAUX + 1) / ANNEAUX
    xs = [centre[0]]
    zs = [centre[1]]
    ds = [0.0]
    ths = [0.0]
    for f in fractions:
        xs += list(centre[0] + f * D * np.cos(angles))
        zs += list(centre[1] + f * D * np.sin(angles))
        ds += [f] * SECTEURS
        ths += list(angles)
    faces = []
    for j in range(SECTEURS):
        faces.append((0, 1 + j, 1 + (j + 1) % SECTEURS))
    for i in range(len(fractions) - 1):
        a = 1 + i * SECTEURS
        b = a + SECTEURS
        for j in range(SECTEURS):
            k = (j + 1) % SECTEURS
            faces.append((a + j, b + j, b + k, a + k))
    return np.array(xs), np.array(zs), np.array(ds), np.array(ths), faces


def fractions_denses(centre_bande, largeur, force):
    """Des anneaux resserrés autour d'une fraction radiale : là où tombe une falaise."""
    fin = np.linspace(0.0, 1.0, 2001)
    densite = 1.0 + force * np.exp(-((fin - centre_bande) / largeur) ** 2)
    cumul = np.concatenate([[0.0], np.cumsum(0.5 * (densite[1:] + densite[:-1]) * np.diff(fin))])
    cumul /= cumul[-1]
    cibles = np.arange(1, ANNEAUX + 1) / ANNEAUX
    return np.interp(cibles, cumul, fin)


def normales(sommets, faces):
    """Normales par sommet, moyenne des faces pondérée par leur aire."""
    n = np.zeros_like(sommets)
    for f in faces:
        p = sommets[list(f)]
        for t in range(1, len(f) - 1):
            c = np.cross(p[t] - p[0], p[t + 1] - p[0])
            for i in (f[0], f[t], f[t + 1]):
                n[i] += c
    return normer(n)


def lissage_max(a, b, k=40.0):
    """Maximum adouci : deux sommets se rejoignent par un col, pas par une arête vive."""
    m = np.maximum(a, b)
    return m + np.log(np.exp(k * (a - m)) + np.exp(k * (b - m))) / k


def _assembler(modele, nom, x, z, h, faces, couleurs, materiaux_faces, angle_vif=48):
    """
    Une seule maille pour tout le relief, un matériau par face : la neige
    accroche un reflet, la roche non ; l'exportateur en fera deux primitives du
    même nœud.
    """
    sommets = np.stack([x, np.maximum(h, 0.0), z], axis=1)
    faces = orienter(sommets, faces, lambda q: HAUT)
    modele.ajouter(nom, sommets, faces, couleurs, materiaux_faces, angle_vif=angle_vif)
    return sommets


def _materiaux_par_face(faces, poids):
    """Le matériau d'une face : celui dont le poids moyen de ses sommets l'emporte."""
    noms = list(poids.keys())
    resultat = []
    for f in faces:
        idx = list(f)
        scores = [poids[nom][idx].mean() if nom != 'mat_roche' else 0.5 for nom in noms]
        resultat.append(noms[int(np.argmax(scores))])
    return resultat


# ===========================================================================
# Montagne tempérée
# ===========================================================================

MONTAGNE = {
    # Un pic franc, légèrement en arrière pour qu'on voie sa face avant.
    1: dict(hauteur=0.78, sommet=(0.0, -0.045), concavite=1.55, second=None, epaule=None),
    # Deux pics et un col, côte à côte face à la caméra.
    2: dict(hauteur=0.72, sommet=(-0.1, -0.03), concavite=1.45,
            second=dict(centre=(0.17, 0.02), hauteur=0.74, rayon=0.34), epaule=None),
    # Un massif : le pic en arrière à gauche, une épaule plate en avant à droite.
    3: dict(hauteur=0.66, sommet=(-0.08, -0.09), concavite=1.35, second=None,
            epaule=dict(centre=(0.16, 0.14), hauteur=0.46, rayon=0.2)),
}

ROCHE_CLAIRE = couleur('#a3a9b1')
ROCHE_SOMBRE = couleur('#858b94')
ROCHE_VEINE = couleur('#767c86')
TERRE = couleur('#9a8e78')
HERBE = couleur('#6fae45')
HERBE_CLAIRE = couleur('#8fca5a')
HERBE_GIVREE = couleur('#c9d5ce')
ROCHE_HIVER = couleur('#9aa4b2')


def structure_montagne(graine, n):
    p = MONTAGNE[n]
    rng = rng_de(graine, 'montagne', n)
    return dict(essence='montagne', n=n, p=p, graine_bruit=int(rng.integers(1 << 30)),
                aretes=[(rng.uniform(0, 2 * math.pi), rng.uniform(0.6, 1.0)) for _ in range(5)],
                graine=graine, hauteur=p['hauteur'])


def _relief_tempere(st):
    p = st['p']
    bruit = Bruit(st['graine_bruit'])
    x, z, d, th, faces = grille(p['sommet'], bruit)
    profil = 0.8 * (1.0 - d) ** p['concavite'] + 0.2 * (1.0 - lisser(0.5, 1.0, d))
    # Des arêtes qui descendent du sommet : c'est ce qui fait une montagne et
    # pas une colline.
    arete = np.zeros_like(d)
    for phi, a in st['aretes']:
        arete += a * np.maximum(0.0, np.cos(th - phi)) ** 10
    h = profil * (1.0 + 0.24 * arete * 4.0 * d * (1.0 - d))
    h += 0.075 * bruit.fbm(x * 7.0, z * 7.0, 4) * (1.0 - d) ** 0.8
    h += 0.07 * (bruit.arete(x * 10.0 + 3.0, z * 10.0, 3) - 0.45) * (1.0 - d) ** 1.2
    if p['second'] is not None:
        s = p['second']
        r = np.hypot(x - s['centre'][0], z - s['centre'][1]) / s['rayon']
        h2 = s['hauteur'] * np.clip(1.0 - r, 0.0, None) ** 1.35 + 0.05 * bruit.fbm(x * 9 + 7, z * 9, 3) * (r < 1)
        h = lissage_max(h, h2 * (1.0 - lisser(0.85, 1.0, d)))
    if p['epaule'] is not None:
        e = p['epaule']
        r = np.hypot(x - e['centre'][0], z - e['centre'][1])
        plateau = e['hauteur'] * (1.0 - lisser(e['rayon'] * 0.45, e['rayon'], r))
        plateau += 0.02 * bruit.fbm(x * 12, z * 12 + 5, 2) * (r < e['rayon'])
        h = lissage_max(h, plateau * (1.0 - lisser(0.8, 1.0, d)), k=55.0)
    h = np.maximum(h, 0.0) * (1.0 - lisser(0.965, 1.0, d))
    return x, z, d, th, faces, h, bruit


def modele_montagne(st, saison):
    m = Modele()
    x, z, d, th, faces, h, bruit = _relief_tempere(st)
    H = st['hauteur']
    hauteur = h / max(h.max(), 1e-9) * H
    sommets = np.stack([x, hauteur, z], axis=1)
    n = normales(sommets, orienter(sommets, faces, lambda q: HAUT))
    pente = 1.0 - n[:, 1]
    rel = hauteur / H
    b1 = bruit.fbm(x * 9.0 + 11.0, z * 9.0, 3)
    b2 = bruit.fbm(x * 23.0, z * 23.0 - 4.0, 2)

    roche = melange(ROCHE_SOMBRE, ROCHE_CLAIRE, 0.5 + 0.5 * b1)
    # Des veines plus sombres suivent les strates : un pigment de la pierre.
    veine = lisser(0.55, 0.9, np.abs(np.sin(hauteur * 60.0 + b2 * 2.0)))
    roche = melange(roche, ROCHE_VEINE, 0.25 * veine)
    roche = melange(roche, TERRE, 0.45 * lisser(0.42, 0.18, rel))
    herbe = melange(HERBE, HERBE_CLAIRE, 0.5 + 0.5 * b2)
    w_herbe = lisser(0.36, 0.2, rel + 0.08 * b1) * lisser(0.6, 0.36, pente)
    if saison == 'hiver':
        roche = melange(roche, ROCHE_HIVER, 0.3)
        herbe = melange(HERBE_GIVREE, NEIGE, lisser(0.2, 0.7, b2))
        w_neige = lisser(0.4, 0.52, rel + 0.12 * b1) * lisser(0.78, 0.5, pente)
        # Des plaques de neige dans l'herbe du pied, là où le bruit le veut.
        w_neige = np.maximum(w_neige, 0.85 * lisser(0.3, 0.6, b2) * w_herbe)
    else:
        w_neige = np.zeros_like(rel)
    col = melange(roche, herbe, w_herbe)
    col = melange(col, NEIGE, w_neige)
    materiaux = _materiaux_par_face(faces, {'mat_roche': None, 'mat_herbe': w_herbe, 'mat_neige': w_neige})
    _assembler(m, 'relief', x, z, hauteur, faces, col, materiaux)
    return m


# ===========================================================================
# Montagne aride — le grès
# ===========================================================================

ARIDE = {
    # Une mesa : plateau, falaise en strates, talus de sable.
    1: dict(hauteur=0.56, sommet=(0.0, -0.03), plateau=0.4, flanc=0.13, talus=0.3, aiguille=None),
    # Une butte plus basse et une aiguille coiffée, en avant à gauche.
    2: dict(hauteur=0.45, sommet=(0.07, -0.07), plateau=0.3, flanc=0.12, talus=0.32,
            aiguille=dict(centre=(-0.19, 0.17), hauteur=0.7, rayon=0.068)),
}

BANDES_GRES = [couleur(h) for h in ('#c8703c', '#dd9a58', '#b95f36', '#e3b27a', '#cf8446', '#d9a066')]
CHAPEAU = couleur('#e6c792')
SABLE = couleur('#e2c48e')
VERNIS = couleur('#8a4a2e')


def structure_aride(graine, n):
    p = ARIDE[n]
    rng = rng_de(graine, 'montagne_aride', n)
    return dict(essence='montagne_aride', n=n, p=p, graine_bruit=int(rng.integers(1 << 30)), graine=graine,
                hauteur=max(p['hauteur'], p['aiguille']['hauteur'] if p['aiguille'] else 0.0),
                decalage_strates=rng.uniform(0, 1))


def _bande(h, decal, bruit_v, epaisseur=0.046):
    q = h / epaisseur + decal * len(BANDES_GRES) + 0.35 * bruit_v
    return np.floor(q).astype(np.int64) % len(BANDES_GRES)


def modele_aride(st, saison):
    m = Modele()
    p = st['p']
    bruit = Bruit(st['graine_bruit'])
    milieu_falaise = p['plateau'] + p['flanc'] * 0.5
    x, z, d, th, faces = grille(p['sommet'], bruit, fractions_denses(milieu_falaise, 0.12, 2.6))
    # Le bord du plateau est irrégulier : des criques, des avancées.
    d0 = p['plateau'] + 0.06 * bruit.fbm(np.cos(th) * 1.6 + 2.0, np.sin(th) * 1.6, 3)
    d1 = d0 + p['flanc']
    t = p['talus']
    falaise = 1.0 - (1.0 - t) * lisser(d0, d1, d)
    talus = t * (1.0 - lisser(d1, 1.0, d)) ** 1.25
    h = np.where(d < d1, falaise, talus)
    # Des corniches : la falaise descend en marches, une par banc de roche dure.
    q = h * 7.0
    marches = (np.floor(q) + lisser(0.3, 0.7, q - np.floor(q))) / 7.0
    dans_falaise = lisser(d0 - 0.03, d0 + 0.02, d) * (1.0 - lisser(d1 + 0.02, d1 + 0.12, d))
    h = h + (marches - h) * 0.65 * dans_falaise
    h += 0.012 * bruit.fbm(x * 14.0, z * 14.0, 3) * (d < d0)
    h += 0.02 * bruit.fbm(x * 9.0 + 3, z * 9.0, 3) * (1.0 - d) * (d > d1)
    h = np.maximum(h, 0.0) * (1.0 - lisser(0.965, 1.0, d))
    H = p['hauteur']
    hauteur = h / max(h.max(), 1e-9) * H
    sommets = np.stack([x, hauteur, z], axis=1)
    n = normales(sommets, orienter(sommets, faces, lambda q_: HAUT))
    pente = 1.0 - n[:, 1]
    b1 = bruit.fbm(x * 8.0 + 5.0, z * 8.0, 3)
    idx = _bande(hauteur, st['decalage_strates'], b1)
    col = np.array([BANDES_GRES[i] for i in idx])
    # Le vernis du désert : des coulures sombres sur les parois raides.
    col = melange(col, VERNIS, 0.28 * lisser(0.45, 0.85, pente) * lisser(0.2, 0.6, bruit.fbm(x * 30.0, z * 6.0, 2)))
    col = melange(col, CHAPEAU, 0.8 * (1.0 - lisser(d0 - 0.05, d0, d)) * lisser(0.25, 0.1, pente))
    w_sable = lisser(0.34, 0.14, hauteur / H + 0.06 * b1) * lisser(0.5, 0.25, pente)
    col = melange(col, SABLE, w_sable)
    materiaux = ['mat_roche'] * len(faces)
    _assembler(m, 'relief', x, z, hauteur, faces, col, materiaux, angle_vif=40)

    if p['aiguille'] is not None:
        a = p['aiguille']
        rng = rng_de(st['graine'], 'montagne_aride', st['n'], 'aiguille')
        etages = 11
        ys = np.linspace(0.0, a['hauteur'], etages)
        cx, cz = a['centre']
        # Le fût s'amincit en montant, les bancs tendres un peu plus rentrés :
        # c'est la silhouette d'une cheminée de fée.
        r = a['rayon'] * (1.0 - 0.42 * ys / a['hauteur'])
        r *= np.where(np.arange(etages) % 2 == 0, 1.0, 0.9)
        r[0] *= 1.45
        axe = np.stack([cx + 0.012 * np.sin(ys * 9.0), ys, cz + 0.01 * np.cos(ys * 7.0)], axis=1)
        s, f, anneau = tube(axe, r, 12)
        col_a = np.array([BANDES_GRES[i] for i in _bande(s[:, 1], st['decalage_strates'], 0.0)])
        col_a = np.clip(col_a * (1 + rng.uniform(-0.03, 0.03, (len(s), 1))), 0, 1)
        m.ajouter('aiguille', s, f, col_a, 'mat_roche', angle_vif=40)
        # La coiffe de roche dure, plus large que le fût qui la porte.
        haut = axe[-1]
        coiffe = np.array([haut - HAUT * 0.012, haut + HAUT * 0.018, haut + HAUT * 0.026])
        sc, fc, _ = tube(coiffe, np.array([a['rayon'] * 0.95, a['rayon'] * 0.88, 0.0]), 12, pointe=True,
                         fermer_bas=True)
        m.ajouter('aiguille', sc, fc, CHAPEAU * 0.97, 'mat_roche')
    return m


# ===========================================================================
# Montagne volcanique — le basalte
# ===========================================================================

VOLCAN = {
    # Un cône et son cratère, une coulée vers l'avant.
    1: dict(hauteur=0.74, sommet=(0.0, -0.04), cratere=0.17, profondeur=0.2, breche=None,
            coulees=[dict(angle=1.85, largeur=0.06)]),
    # Un cône égueulé : le cratère s'ouvre à l'avant droit, la coulée en sort.
    2: dict(hauteur=0.62, sommet=(-0.04, -0.06), cratere=0.2, profondeur=0.16, breche=1.2,
            coulees=[dict(angle=1.2, largeur=0.075), dict(angle=2.55, largeur=0.045)]),
}

# Un basalte un peu moins noir que nature : sur un sol volcanique sombre, la
# montagne doit encore se détacher ; les coulées, elles, restent presque noires.
BASALTE = couleur('#4b4a52')
BASALTE_CLAIR = couleur('#5f5e66')
OXYDE = couleur('#6b4032')
CRATERE = couleur('#2e2a2c')
CENDRE = couleur('#76726e')
MOUSSE = couleur('#5f6b3a')
COULEE = couleur('#1f1c1f')


def structure_volcan(graine, n):
    p = VOLCAN[n]
    rng = rng_de(graine, 'montagne_volcan', n)
    return dict(essence='montagne_volcan', n=n, p=p, graine_bruit=int(rng.integers(1 << 30)), graine=graine,
                hauteur=p['hauteur'], ravines=rng.uniform(0, 2 * math.pi))


def modele_volcan(st, saison):
    m = Modele()
    p = st['p']
    bruit = Bruit(st['graine_bruit'])
    x, z, d, th, faces = grille(p['sommet'], bruit, fractions_denses(p['cratere'], 0.1, 1.6))
    dc = p['cratere']
    cone = 0.86 * (1.0 - d) ** 1.18 + 0.14 * (1.0 - lisser(0.45, 1.0, d))
    bord = 0.86 * (1.0 - dc) ** 1.18 + 0.14
    # Le cratère : une cuvette sous la lèvre, qui se raccorde au cône par un bourrelet.
    cuvette = bord - p['profondeur'] * (1.0 - (d / dc) ** 2)
    h = np.where(d < dc, cuvette, cone)
    h += 0.018 * np.exp(-((d - dc) / 0.04) ** 2)
    # Des ravines qui descendent du sommet, et un peu de désordre.
    ravines = np.sin(th * 13.0 + st['ravines'] + 1.8 * bruit.fbm(np.cos(th) * 2.0, d * 3.0, 3))
    h *= 1.0 + 0.055 * ravines * lisser(dc, dc + 0.25, d) * (1.0 - d)
    h += 0.03 * bruit.fbm(x * 11.0, z * 11.0, 3) * (1.0 - d)
    if p['breche'] is not None:
        ecart = np.angle(np.exp(1j * (th - p['breche'])))
        h -= 0.2 * np.exp(-(ecart / 0.38) ** 2) * (1.0 - lisser(0.0, 0.6, d))
    # Les coulées refroidies : des langues en relief qui descendent du cratère.
    w_coulee = np.zeros_like(d)
    for c in p['coulees']:
        meandre = c['angle'] + 0.22 * bruit.fbm(d * 3.0 + c['angle'], 1.0, 2)
        ecart = np.angle(np.exp(1j * (th - meandre)))
        largeur = c['largeur'] * (0.7 + 0.8 * d)
        distance_laterale = np.abs(ecart) * np.maximum(d, 0.05) * DEMI_EMPRISE
        dans = np.exp(-(distance_laterale / largeur) ** 4) * lisser(dc * 0.9, dc + 0.08, d) * (1.0 - lisser(0.86, 0.98, d))
        w_coulee = np.maximum(w_coulee, dans)
    h += 0.022 * w_coulee
    h = np.maximum(h, 0.0) * (1.0 - lisser(0.965, 1.0, d))
    H = p['hauteur']
    hauteur = h / max(h.max(), 1e-9) * H
    b1 = bruit.fbm(x * 10.0 + 2.0, z * 10.0, 3)
    b2 = bruit.fbm(x * 25.0, z * 25.0 + 9.0, 2)
    col = melange(BASALTE, BASALTE_CLAIR, 0.5 + 0.5 * b1)
    col = melange(col, OXYDE, 0.55 * lisser(dc + 0.16, dc, d) * (d >= dc * 0.8))
    col = melange(col, CRATERE, lisser(dc * 0.9, dc * 0.55, d))
    col = melange(col, CENDRE, 0.7 * lisser(0.72, 0.95, d))
    col = melange(col, MOUSSE, 0.5 * lisser(0.8, 0.95, d) * lisser(0.35, 0.7, b2))
    col = melange(col, COULEE, 0.92 * lisser(0.35, 0.7, w_coulee))
    materiaux = _materiaux_par_face(faces, {'mat_roche': None, 'mat_coulee': w_coulee})
    _assembler(m, 'relief', x, z, hauteur, faces, col, materiaux, angle_vif=44)
    return m
