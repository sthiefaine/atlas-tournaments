"""
Les arbres : feuillu, conifère, palmier, tropical.

Chaque essence se construit en deux temps. La **structure** (`structure_*`) est
tirée de la graine et du numéro de variante **seulement** : tronc, branches,
emplacement des touffes. Le **modèle** (`modele_*`) habille cette structure pour
une saison. Le feuillu n° 2 d'été et le feuillu n° 2 d'hiver sont donc le même
arbre, qui a perdu ses feuilles : un changement de saison en partie peut fondre
une image dans l'autre sans que l'arbre saute de place.

Gabarits (`BRIEF.md`, commande du 23 septembre 2026) : 0,25 à 0,45 de large,
0,5 à 0,9 de haut, trois à cinq par case de forêt. Les volumes sont francs —
quelques touffes bosselées plutôt que mille feuilles — parce qu'un arbre se lit
à trente pixels par sa silhouette et par la lumière qui la modèle, pas par son
détail.
"""

import math

import numpy as np

from geometrie import (
    Modele, boule, boule_orientee, couleur, courbe, horizontale, lame, lisser, melange, normer, nuancer,
    orienter, pigment_par_bouquet, prisme, rng_de, tube,
)

NEIGE = couleur('#f4f8fc')
HAUT = np.array([0.0, 1.0, 0.0])


def _haut_local(d):
    """La verticale vue d'une branche : ce qui est « dessus » pour la neige qui s'y pose."""
    d = normer(d)
    h = HAUT - (HAUT @ d) * d
    return normer(h) if np.linalg.norm(h) > 1e-6 else np.array([1.0, 0.0, 0.0])


def _branche(modele, points, rayons, cotes, teinte, rng, pointe=True, piece='tronc'):
    s, f, _ = tube(points, rayons, cotes, pointe=pointe)
    modele.ajouter(piece, s, f, nuancer(teinte, rng, len(s), 0.05), 'mat_ecorce')


def _neige_sur(modele, point, d, rayon_branche, demi_axes, rng):
    """Un bourrelet de neige couché sur le dessus d'une branche."""
    haut = _haut_local(d)
    centre = np.asarray(point) + haut * (rayon_branche + demi_axes[1] * 0.55)
    s, f = boule_orientee(centre, d, demi_axes, subdivisions=1)
    modele.ajouter('neige', s, f, nuancer(NEIGE, rng, len(s), 0.012), 'mat_neige')


def _le_long(points, t):
    """Le point et la direction à la fraction `t` d'une polyligne."""
    p = np.asarray(points)
    longueurs = np.linalg.norm(np.diff(p, axis=0), axis=1)
    cumul = np.concatenate([[0.0], np.cumsum(longueurs)])
    cible = t * cumul[-1]
    i = int(np.clip(np.searchsorted(cumul, cible) - 1, 0, len(p) - 2))
    u = (cible - cumul[i]) / max(longueurs[i], 1e-12)
    return p[i] + (p[i + 1] - p[i]) * u, normer(p[i + 1] - p[i])


# ===========================================================================
# Feuillu
# ===========================================================================

# Trois ports : un chêne rond, un tilleul en ogive, un érable champêtre étalé
# en deux lobes. `fourche` est la hauteur où le tronc se divise, en part de la
# hauteur totale.
FEUILLU = {
    1: dict(hauteur=0.74, largeur=0.42, fourche=0.31, forme='ronde'),
    2: dict(hauteur=0.84, largeur=0.34, fourche=0.27, forme='ovale'),
    3: dict(hauteur=0.64, largeur=0.44, fourche=0.33, forme='etalee'),
}

# Où poser les touffes, dans l'espace de l'enveloppe (ellipsoïde unité) : une
# touffe au sommet, les autres en couronne. L'ensemble tourne d'un angle tiré
# pour que deux variantes ne présentent pas la même face.
DISPOSITIONS = {
    'ronde': [(0, 1, 0), (1, 0.15, 0), (0.31, 0.05, 0.95), (-0.81, 0.2, 0.59), (-0.81, 0.1, -0.59), (0.31, 0.25, -0.95)],
    'ovale': [(0, 1, 0), (0.87, 0.5, 0), (-0.43, 0.55, 0.75), (-0.43, 0.45, -0.75), (0.5, -0.3, 0.87), (-0.6, -0.25, -0.8)],
    'etalee': [(0.2, 1, 0.1), (1, 0.25, 0.1), (0.55, 0.35, 0.85), (-1, 0.25, -0.1), (-0.5, 0.5, 0.8), (-0.25, 0.25, -1)],
}

ECORCE_FEUILLU = couleur('#6b4c33')

FEUILLES = {
    'printemps': dict(bases=['#7cc24e', '#8acb55', '#72b848'], clair='#b6e07a'),
    'ete': dict(bases=['#3f8f36', '#4b9b3d', '#378532'], clair='#6db44e'),
    # Roux et or : chaque touffe prend sa teinte, comme un arbre qui ne vire pas
    # d'un bloc.
    'automne': dict(bases=['#d9822b', '#e6a83a', '#c2572a', '#cf9a35'], clair='#f2c768'),
}

FLEURS = [couleur('#f5c2d4'), couleur('#fdf0f3'), couleur('#f0a9c2')]


def structure_feuillu(graine, n):
    p = FEUILLU[n]
    rng = rng_de(graine, 'feuillu', n)
    H, W = p['hauteur'], p['largeur']
    s = H / 0.74
    yf = p['fourche'] * H
    penche = rng.normal(0.0, 0.012, 2)
    fourche = np.array([penche[0], yf, penche[1]])

    # Le tronc : un empattement au pied, une légère inclinaison, une pointe
    # cachée dans le houppier (elle se voit l'hiver).
    ys = np.array([0.0, 0.02, 0.25, 0.55, 0.85, 1.0, 1.16, 1.3]) * yf
    ys[-2:] = [yf + 0.05 * s, yf + 0.1 * s]
    tronc = np.stack([penche[0] * (ys / yf) ** 1.3, ys, penche[1] * (ys / yf) ** 1.3], axis=1)
    rayons_tronc = np.array([0.043, 0.033, 0.029, 0.026, 0.023, 0.021, 0.016, 0.0]) * s

    # L'enveloppe du houppier, rentrée d'un dixième : les bosses la font déborder.
    yb = yf - 0.04 * H
    ax = W / 2.0 / 1.12
    ay = (H - yb) / 2.0 / 1.1
    az = ax * 0.94
    if p['forme'] == 'etalee':
        ay *= 0.92
    centre = np.array([penche[0] * 1.2, yb + ay * 1.05, penche[1] * 1.2])
    rotation = rng.uniform(0.0, 2.0 * math.pi)
    c, sn = math.cos(rotation), math.sin(rotation)

    touffes = []
    for k, d in enumerate(DISPOSITIONS[p['forme']]):
        u = np.array(d, dtype=np.float64) + rng.normal(0.0, 0.1, 3)
        u = normer(np.array([u[0] * c - u[2] * sn, u[1], u[0] * sn + u[2] * c]))
        rho = (0.5 if k == 0 else 0.52) + rng.uniform(-0.035, 0.035)
        demi = rho * np.array([ax, ay, az]) * rng.uniform(0.93, 1.07, 3)
        cen = centre + (1.0 - rho) * np.array([ax * u[0], ay * u[1], az * u[2]])
        touffes.append(dict(centre=cen, demi=demi, u=u, graine=int(rng.integers(1 << 30))))
    coeur = dict(centre=centre + np.array([0.0, -0.1 * ay, 0.0]), demi=0.66 * np.array([ax, ay, az]),
                 u=HAUT.copy(), graine=int(rng.integers(1 << 30)))

    # Charpentières : de la fourche vers chaque touffe, un peu au-delà de son
    # centre. Elles se voient sous le houppier l'été, et portent tout l'hiver.
    branches = []
    for t in touffes:
        depart = fourche + (np.array([0.0, -0.04 * s, 0.0]) if t['u'][1] < 0 else 0.0)
        fin = t['centre'] + 0.25 * t['demi'] * t['u']
        vers = fin - depart
        pts = np.array([depart, depart + vers * 0.35 + HAUT * 0.02 * s, depart + vers * 0.7 + HAUT * 0.015 * s, fin])
        branches.append(dict(points=pts, rayons=np.array([0.016, 0.012, 0.0085, 0.0]) * s, touffe=t))

    # Rameaux et brindilles de l'hiver : ils finissent à la surface des touffes,
    # si bien que l'arbre nu garde la silhouette de l'arbre feuillu.
    rameaux = []
    for b in branches:
        t = b['touffe']
        for frac in (0.55, 0.82):
            debut, d = _le_long(b['points'], frac)
            # Vers le dehors de la touffe : ce sont ses bords qui font la silhouette.
            v = normer(t['u'] + rng.normal(0.0, 0.55, 3))
            if v[1] < -0.2:
                v = normer(v + HAUT * 0.5)
            fin = t['centre'] + t['demi'] * v * rng.uniform(0.86, 0.97)
            milieu = debut + (fin - debut) * 0.5 + HAUT * 0.012 * s
            pts = np.array([debut, milieu, fin])
            brindilles = []
            for f2 in (0.6, 1.0):
                o, dd = _le_long(pts, f2)
                dir_b = normer(dd + rng.normal(0.0, 0.45, 3) + HAUT * 0.3)
                long_b = rng.uniform(0.028, 0.042) * s
                brindilles.append(np.array([o, o + dir_b * long_b * 0.55, o + dir_b * long_b]))
            rameaux.append(dict(points=pts, rayons=np.array([0.0085, 0.0058, 0.0]) * s, brindilles=brindilles))
    return dict(essence='feuillu', n=n, hauteur=H, echelle=s, fourche=fourche, tronc=tronc,
                rayons_tronc=rayons_tronc, touffes=touffes, coeur=coeur, branches=branches, rameaux=rameaux,
                graine=graine)


def _touffe_feuillage(modele, t, subdiv, palette, base, rng):
    rng_t = np.random.default_rng(t['graine'])
    s, f, u, bouquets = boule(t['centre'], t['demi'], subdiv, rng_t, relief=(9, (0.10, 0.2), (0.07, 0.13)),
                              dessous=0.78)
    col = pigment_par_bouquet(base, couleur(palette['clair']), bouquets, rng)
    modele.ajouter('feuillage', s, f, col, 'mat_feuillage')
    return s, u


def modele_feuillu(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'feuillu', st['n'], saison, 'habillage')
    s = st['echelle']
    _branche(m, st['tronc'], st['rayons_tronc'], 8, ECORCE_FEUILLU, rng, pointe=True)
    for b in st['branches']:
        _branche(m, b['points'], b['rayons'], 6, ECORCE_FEUILLU, rng)

    if saison == 'hiver':
        for r in st['rameaux']:
            _branche(m, r['points'], r['rayons'], 5, ECORCE_FEUILLU, rng)
            for br in r['brindilles']:
                _branche(m, br, np.array([0.0045, 0.003, 0.0]) * s, 4, ECORCE_FEUILLU, rng, pointe=True)
        # Un peu de neige : sur la fourche, et couchée sur les charpentières les
        # moins raides — c'est là qu'elle tient.
        _neige_sur(m, st['fourche'], np.array([1.0, 0.0, 0.2]), 0.0, np.array([0.03, 0.011, 0.028]) * s, rng)
        for b in st['branches']:
            point, d = _le_long(b['points'], 0.5)
            if abs(d[1]) < 0.85:
                _neige_sur(m, point, d, 0.012 * s, np.array([0.036, 0.0085, 0.0135]) * s, rng)
        horizontaux = sorted(st['rameaux'], key=lambda r: abs(normer(r['points'][-1] - r['points'][0])[1]))
        for r in horizontaux[:5]:
            point, d = _le_long(r['points'], 0.45)
            _neige_sur(m, point, d, 0.007 * s, np.array([0.022, 0.006, 0.009]) * s, rng)
        return m

    palette = FEUILLES[saison]
    bases = [couleur(h) for h in palette['bases']]
    ordre = rng.permutation(len(st['touffes']))
    _touffe_feuillage(m, st['coeur'], 1, palette, bases[0], rng)
    surfaces = []
    for k, t in enumerate(st['touffes']):
        base = bases[int(ordre[k]) % len(bases)] * rng.uniform(0.96, 1.04)
        surfaces.append(_touffe_feuillage(m, t, 2, palette, np.clip(base, 0, 1), rng))

    if saison == 'printemps':
        # Un soupçon de fleurs, sur le dessus et le devant : ce que la caméra voit.
        candidats = []
        for s_t, u in surfaces:
            for i in range(len(s_t)):
                if u[i][1] > 0.15 and u[i][2] > -0.35:
                    candidats.append(s_t[i])
        choix = rng.choice(len(candidats), size=min(14, len(candidats)), replace=False)
        for k in sorted(choix):
            centre = candidats[k]
            sf, ff, _, _ = boule(centre, np.array([0.0105, 0.0085, 0.0105]) * s, 0)
            m.ajouter('fleurs', sf, ff, FLEURS[k % len(FLEURS)], 'mat_fleurs')
    return m


# ===========================================================================
# Conifère
# ===========================================================================

# Un épicéa élancé, un sapin trapu, un pin haut de fût aux étages décalés.
CONIFERE = {
    1: dict(hauteur=0.84, rayon=0.128, etages=6, fut=0.07, exposant=1.0, tombant=0.35, desordre=0.0),
    2: dict(hauteur=0.68, rayon=0.148, etages=5, fut=0.06, exposant=0.8, tombant=0.25, desordre=0.0),
    3: dict(hauteur=0.76, rayon=0.122, etages=5, fut=0.13, exposant=1.1, tombant=0.3, desordre=0.018),
}

ECORCE_CONIFERE = couleur('#5b412c')

AIGUILLES = {
    # base, pointes : au printemps les pousses neuves éclairent le bout des branches.
    'printemps': ('#2f7440', '#83c460'),
    'ete': ('#2a6e3c', '#3f8a48'),
    'automne': ('#34653a', '#5c7c40'),
    'hiver': ('#2b5a40', '#3b6a4c'),
}

S1 = 14  # sommets des anneaux intérieurs d'un étage
S2 = 28  # sommets du bord : une pointe, un creux, une pointe…


def structure_conifere(graine, n):
    p = CONIFERE[n]
    rng = rng_de(graine, 'conifere', n)
    H = p['hauteur']
    pointe = 0.05 * H / 0.84
    E = p['etages']
    recouvrement = 0.4
    ht = (H - p['fut'] - pointe) / (E * (1 - recouvrement) + recouvrement)
    etages = []
    for i in range(E):
        yb = p['fut'] + i * ht * (1 - recouvrement)
        rayon = p['rayon'] * ((E - i) / E) ** p['exposant'] * rng.uniform(0.93, 1.04) + 0.028
        decal = rng.normal(0.0, p['desordre'], 2) if p['desordre'] > 0 else np.zeros(2)
        etages.append(dict(yb=yb, yt=yb + ht, ht=ht, rayon=rayon, decal=decal,
                           phase=rng.uniform(0, 2 * math.pi), dents=rng.uniform(0.85, 1.15, S2)))
    sommet = etages[-1]['yt'] + pointe
    return dict(essence='conifere', n=n, hauteur=H, etages=etages, sommet=sommet, tombant=p['tombant'],
                graine=graine)


def _etage(st, e, base_c, pointe_c, rng):
    """Une jupe de branches : sommet, deux anneaux, un bord denté qui retombe, un dessous."""
    ox, oz = e['decal']
    yt, yb, ht, R = e['yt'], e['yb'], e['ht'], e['rayon']
    a1 = e['phase'] + 2 * math.pi * np.arange(S1) / S1
    a2 = e['phase'] + 2 * math.pi * np.arange(S2) / S2
    centre = np.array([ox, 0.0, oz])
    pts = [centre + np.array([0.0, yt, 0.0])]
    anneau = lambda angles, r, y: [centre + np.array([r[k] * math.cos(a), y[k], r[k] * math.sin(a)])
                                   for k, a in enumerate(angles)]
    r1 = anneau(a1, [0.36 * R] * S1, [yt - 0.32 * ht] * S1)
    r2 = anneau(a2[::2], [0.74 * R] * S1, [yt - 0.66 * ht] * S1)
    dent = 0.15
    rayons_bord = [R * (1 + dent * e['dents'][k]) if k % 2 == 0 else R * (1 - 0.5 * dent) for k in range(S2)]
    ys_bord = [yb - st['tombant'] * 0.25 * ht * e['dents'][k] if k % 2 == 0 else yb + 0.1 * ht for k in range(S2)]
    bord = anneau(a2, rayons_bord, ys_bord)
    dessous = anneau(a1, [0.3 * R] * S1, [yb + 0.25 * ht] * S1)
    pts += r1 + r2 + bord + dessous
    pts.append(centre + np.array([0.0, yb + 0.36 * ht, 0.0]))
    pts = np.array(pts)
    i_r1, i_r2, i_bord, i_des = 1, 1 + S1, 1 + 2 * S1, 1 + 2 * S1 + S2
    i_coeur = len(pts) - 1
    dessus, dessous_f = [], []
    for j in range(S1):
        k = (j + 1) % S1
        dessus.append((0, i_r1 + j, i_r1 + k))
        dessus.append((i_r1 + j, i_r2 + j, i_r2 + k, i_r1 + k))
        b0, b1, b2 = i_bord + 2 * j, i_bord + 2 * j + 1, i_bord + (2 * j + 2) % S2
        dessus += [(i_r2 + j, b0, b1), (i_r2 + j, b1, i_r2 + k), (i_r2 + k, b1, b2)]
        d0, d1 = i_des + j, i_des + k
        dessous_f += [(b0, d0, b1), (b1, d0, d1), (b1, d1, b2)]
        dessous_f.append((d0, i_coeur, d1))
    axe = lambda q: np.array([q[0] - ox, 0.0, q[2] - oz])
    dessus = orienter(pts, dessus, lambda q: normer(axe(q)) * 0.6 + HAUT)
    dessous_f = orienter(pts, dessous_f, lambda q: normer(axe(q)) * 0.6 - HAUT)
    rang = np.zeros(len(pts))
    rang[i_bord:i_des] = [1.0 if k % 2 == 0 else 0.55 for k in range(S2)]
    rang[i_r2:i_bord] = 0.35
    col = melange(base_c, pointe_c, rang)
    col = np.clip(col * (1.0 + rng.uniform(-0.03, 0.03, (len(pts), 1))), 0, 1)
    return pts, dessus + dessous_f, col, (r1, r2, bord, a2)


def _neige_etage(m, e, r1, r2, bord, rng):
    """Une calotte de neige posée sur un étage, bord inférieur irrégulier."""
    ox, oz = e['decal']
    centre = np.array([ox, 0.0, oz])
    dehors = lambda q: normer(np.array([q[0] - ox, 0.0, q[2] - oz])) * 0.7 + HAUT
    epaisseur = 0.0055 + 0.0015 * rng.random()
    sommet = centre + np.array([0.0, e['yt'] + epaisseur * 1.2, 0.0])
    gonfle = lambda q: q + normer(dehors(q)) * epaisseur
    a = [gonfle(q) for q in r1]
    b = [gonfle(q) for q in r2]
    # Le bord de la neige s'arrête entre l'anneau et la pointe de chaque branche,
    # plus ou moins loin : une ligne régulière se lirait comme une collerette.
    c = []
    for j in range(S1):
        pointe_branche = bord[2 * j]
        frac = rng.uniform(0.3, 0.72)
        q = r2[j] + (pointe_branche - r2[j]) * frac
        c.append(gonfle(q) + HAUT * 0.002)
    pts = np.array([sommet] + a + b + c)
    faces = []
    for j in range(S1):
        k = (j + 1) % S1
        faces.append((0, 1 + j, 1 + k))
        faces.append((1 + j, 1 + S1 + j, 1 + S1 + k, 1 + k))
        faces.append((1 + S1 + j, 1 + 2 * S1 + j, 1 + 2 * S1 + k, 1 + S1 + k))
    faces = orienter(pts, faces, dehors)
    # Blanche partout : c'est la lumière de la cuisson qui bleuira son dessous.
    m.ajouter('neige', pts, faces, nuancer(NEIGE, rng, len(pts), 0.012), 'mat_neige', angle_vif=None)


def modele_conifere(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'conifere', st['n'], saison, 'habillage')
    base_c, pointe_c = (couleur(h) for h in AIGUILLES[saison])
    fut = np.array([[0.0, 0.0, 0.0], [0.0, 0.03, 0.0], [0.0, st['etages'][0]['yb'] + 0.02, 0.0],
                    [0.0, st['sommet'] * 0.6, 0.0], [0.0, st['sommet'] - 0.012, 0.0], [0.0, st['sommet'], 0.0]])
    e_haut = st['etages'][-1]
    fut[-2:, 0] += e_haut['decal'][0]
    fut[-2:, 2] += e_haut['decal'][1]
    rayons = np.array([0.03, 0.022, 0.019, 0.012, 0.005, 0.0]) * st['hauteur'] / 0.84
    s, f, _ = tube(fut, rayons, 7, pointe=True)
    m.ajouter('tronc', s, f, nuancer(ECORCE_CONIFERE, rng, len(s), 0.05), 'mat_ecorce')
    for i, e in enumerate(st['etages']):
        teinte = np.clip(base_c * rng.uniform(0.95, 1.05), 0, 1)
        pts, faces, col, anneaux = _etage(st, e, teinte, pointe_c, rng)
        m.ajouter('feuillage', pts, faces, col, 'mat_feuillage', angle_vif=62)
        if saison == 'hiver':
            _neige_etage(m, e, *anneaux[:3], rng)
    if saison == 'hiver':
        # La flèche porte un capuchon.
        e = st['etages'][-1]
        centre = np.array([e['decal'][0], e['yt'] + 0.004, e['decal'][1]])
        sn, fn, _, _ = boule(centre, np.array([0.022, 0.012, 0.022]) * st['hauteur'] / 0.84, 1)
        m.ajouter('neige', sn, fn, NEIGE, 'mat_neige')
    return m


# ===========================================================================
# Palmier
# ===========================================================================

# Un palmier presque droit, un cocotier penché, et une touffe de deux stipes.
PALMIER = {
    1: dict(stipes=[dict(hauteur=0.6, penche=0.05, azimut=0.4, frondes=9, longueur=0.21)]),
    2: dict(stipes=[dict(hauteur=0.55, penche=0.125, azimut=2.6, frondes=8, longueur=0.2)]),
    3: dict(stipes=[dict(hauteur=0.57, penche=0.06, azimut=3.3, frondes=7, longueur=0.16),
                    dict(hauteur=0.41, penche=0.05, azimut=0.1, frondes=6, longueur=0.14)]),
}

STIPE = couleur('#8a765c')
STIPE_CICATRICE = couleur('#726048')
FRONDE_BORD = couleur('#3f9a48')
FRONDE_POINTE = couleur('#5cb852')
FRONDE_NERVURE = couleur('#b1aa52')
FRONDE_VIEILLE = couleur('#a3943c')
COCO = [couleur('#5f6e28'), couleur('#77592c')]
BOURRE = couleur('#6b7236')


def structure_palmier(graine, n):
    p = PALMIER[n]
    rng = rng_de(graine, 'palmier', n)
    stipes = []
    for k, sp in enumerate(p['stipes']):
        dep = np.array([0.0, 0.0, 0.0]) if k == 0 else horizontale(sp['azimut']) * 0.03
        cap = horizontale(sp['azimut'] + rng.normal(0, 0.15))
        t = np.linspace(0.0, 1.0, 19)
        # Il penche dès le pied puis se redresse : 2t − t², la courbe d'un
        # cocotier qui a cherché la lumière.
        horiz = sp['penche'] * (2 * t - t * t)
        pts = dep + np.outer(horiz, cap) + np.outer(t * sp['hauteur'], HAUT)
        frondes = []
        F = sp['frondes']
        phase = rng.uniform(0, 2 * math.pi)
        for j in range(F):
            vieille = j >= F - 2
            azi = phase + 2 * math.pi * j / F + rng.normal(0, 0.12)
            if vieille:
                elev = math.radians(rng.uniform(-18, -6))
            elif j % 2 == 0:
                elev = math.radians(rng.uniform(34, 52))
            else:
                elev = math.radians(rng.uniform(12, 28))
            frondes.append(dict(azimut=azi, elevation=elev, flexion=rng.uniform(0.95, 1.35),
                                longueur=sp['longueur'] * rng.uniform(0.88, 1.08), vieille=vieille))
        cocos = []
        for j in range(3 if k == 0 else 2):
            a = rng.uniform(0, 2 * math.pi)
            cocos.append(dict(decal=horizontale(a) * 0.017 + np.array([0.0, -0.03 - 0.008 * j, 0.0]),
                              teinte=j % 2))
        stipes.append(dict(points=pts, frondes=frondes, cocos=cocos, hauteur=sp['hauteur']))
    return dict(essence='palmier', n=n, stipes=stipes, graine=graine)


def modele_palmier(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'palmier', st['n'], saison, 'habillage')
    for sp in st['stipes']:
        pts = sp['points']
        echelle = sp['hauteur'] / 0.6
        r = np.linspace(0.024, 0.017, len(pts)) * echelle
        r[0] *= 1.3
        # Les anneaux du stipe sont dans la forme : un pas sur deux, un peu plus
        # mince. La cuisson en fera une texture de lumière, pas une peinture.
        r[1:-1] *= np.where(np.arange(1, len(pts) - 1) % 2 == 0, 1.0, 0.9)
        s, f, anneau = tube(pts, r, 8)
        col = np.where((anneau % 2 == 1)[:, None], STIPE_CICATRICE, STIPE)
        m.ajouter('tronc', s, f, np.clip(col * (1 + rng.uniform(-0.03, 0.03, (len(s), 1))), 0, 1), 'mat_ecorce')
        tete = pts[-1]
        sb, fb, _, _ = boule(tete + np.array([0.0, 0.01, 0.0]), np.array([0.026, 0.036, 0.026]) * echelle, 1)
        m.ajouter('tronc', sb, fb, BOURRE, 'mat_ecorce')
        for c in sp['cocos']:
            sc, fc, _, _ = boule(tete + c['decal'] * echelle, np.array([0.016, 0.018, 0.016]) * echelle, 1)
            m.ajouter('fruits', sc, fc, COCO[c['teinte']], 'mat_fruits')
        for fr in sp['frondes']:
            dep = tete + horizontale(fr['azimut']) * 0.012 * echelle + np.array([0.0, 0.028 * echelle, 0.0])
            L = fr['longueur']
            stations = 13
            points, dirs = courbe(dep, fr['azimut'], fr['elevation'], L, fr['flexion'], stations, exposant=1.3)
            srel = np.linspace(0.0, 1.0, stations)
            largeurs = 0.058 * echelle * np.sin(np.pi * np.clip(srel * 0.94 + 0.03, 0, 1)) ** 0.7
            sl, fl, rang = lame(points, dirs, largeurs, -0.38, fr['azimut'], dents=0.45)
            if fr['vieille']:
                col = np.tile(FRONDE_VIEILLE, (len(sl), 1))
            else:
                col = melange(FRONDE_BORD, FRONDE_POINTE, rang)
            # La nervure (le sommet du milieu de chaque station) tire vers le jaune.
            milieux = np.arange(1, len(sl) - 1, 3)
            col[milieux] = melange(FRONDE_NERVURE, col[milieux], 0.35)
            m.ajouter('feuillage', sl, fl, np.clip(col * (1 + rng.uniform(-0.03, 0.03, (len(sl), 1))), 0, 1),
                      'mat_feuillage')
    return m


# ===========================================================================
# Tropical
# ===========================================================================

# Le géant qui perce la canopée, en parasol ; un arbre dense aux grandes
# feuilles ; un fromager à deux étages. Écorce pâle et contreforts au pied :
# c'est ce qui le distingue d'un feuillu avant même la couleur.
TROPICAL = {
    1: dict(hauteur=0.8, fut=0.55, largeur=0.4, forme='parasol'),
    2: dict(hauteur=0.66, fut=0.34, largeur=0.38, forme='dense'),
    3: dict(hauteur=0.84, fut=0.46, largeur=0.36, forme='etages'),
}

ECORCE_TROPICALE = couleur('#a79f8c')
ECORCE_PIED = couleur('#8e9270')
VERTS_TROPICAUX = [couleur('#2f7f3f'), couleur('#3a8f3c'), couleur('#2a7440')]
VERT_CLAIR_TROPICAL = couleur('#72bb4c')
GRANDE_FEUILLE = couleur('#3c9d4a')
GRANDE_FEUILLE_NERVURE = couleur('#9fcf6a')


def structure_tropical(graine, n):
    p = TROPICAL[n]
    rng = rng_de(graine, 'tropical', n)
    H = p['hauteur']
    yf = p['fut'] * H
    penche = rng.normal(0, 0.008, 2)
    ys = np.linspace(0.0, yf + 0.03, 8)
    tronc = np.stack([penche[0] * (ys / yf) ** 1.5, ys, penche[1] * (ys / yf) ** 1.5], axis=1)
    rayons = np.linspace(0.03, 0.019, len(ys))
    rayons[0] *= 1.25
    haut = tronc[-1]
    W = p['largeur']
    ax = W / 2.0 / 1.12
    touffes = []
    rotation = rng.uniform(0, 2 * math.pi)
    if p['forme'] == 'parasol':
        ay = (H - yf) / 2.0 / 1.05
        cy = yf + ay * 0.95
        couronne = [(ax * 0.5, cy - ay * 0.1, 6, 0.46, 0.46)]
        sommet = [(0.0, cy + ay * 0.2, 0.55, 0.46)]
    elif p['forme'] == 'dense':
        ay = (H - yf) / 2.0 / 1.1
        cy = yf + ay
        couronne = [(ax * 0.55, cy - ay * 0.05, 5, 0.5, 0.62)]
        sommet = [(0.0, cy + ay * 0.42, 0.52, 0.58)]
    else:
        ay = (H - yf) / 2.0 / 1.1
        cy = yf + ay * 0.55
        couronne = [(ax * 0.6, yf + ay * 0.28, 4, 0.52, 0.45), (ax * 0.38, yf + ay * 1.35, 3, 0.4, 0.5)]
        sommet = []
    for rayon_c, y_c, nombre, rho, aplat in couronne:
        dec = rng.uniform(0, 2 * math.pi)
        for j in range(nombre):
            a = rotation + dec + 2 * math.pi * j / nombre + rng.normal(0, 0.12)
            cen = np.array([penche[0] + rayon_c * math.cos(a), y_c + rng.normal(0, 0.01),
                            penche[1] + rayon_c * math.sin(a)])
            demi = np.array([ax * rho, ax * rho * aplat * 1.6, ax * rho]) * rng.uniform(0.92, 1.08, 3)
            touffes.append(dict(centre=cen, demi=demi, u=normer(cen - np.array([penche[0], y_c, penche[1]]) + HAUT * 0.3),
                                graine=int(rng.integers(1 << 30))))
    for x, y_c, rho, aplat in sommet:
        cen = np.array([penche[0] + x, y_c, penche[1]])
        demi = np.array([ax * rho, ax * rho * aplat * 1.6, ax * rho])
        touffes.append(dict(centre=cen, demi=demi, u=HAUT.copy(), graine=int(rng.integers(1 << 30))))
    branches = []
    for t in touffes:
        fin = t['centre'] + np.array([0.0, -0.2 * t['demi'][1], 0.0])
        depart = haut + np.array([0.0, -0.035, 0.0]) if t['centre'][1] > yf + 0.02 else tronc[-3]
        vers = fin - depart
        pts = np.array([depart, depart + vers * 0.4 + HAUT * 0.015, fin])
        branches.append(dict(points=pts, rayons=np.array([0.013, 0.0095, 0.0])))
    contreforts = []
    phase = rng.uniform(0, 2 * math.pi)
    for j in range(5):
        a = phase + 2 * math.pi * j / 5 + rng.normal(0, 0.15)
        contreforts.append(dict(azimut=a, hauteur=rng.uniform(0.1, 0.14) * H / 0.8,
                                portee=rng.uniform(0.07, 0.092)))
    feuilles = []
    if p['forme'] in ('dense', 'parasol'):
        bord = [t for t in touffes if math.hypot(t['centre'][0] - penche[0], t['centre'][2] - penche[1]) > 0.03]
        for j in range(8 if p['forme'] == 'dense' else 6):
            t = bord[j % len(bord)]
            dirh = normer(np.array([t['centre'][0] - penche[0], 0.0, t['centre'][2] - penche[1]]))
            a = math.atan2(dirh[2], dirh[0]) + rng.normal(0, 0.35)
            base = t['centre'] + np.array([math.cos(a), 0.0, math.sin(a)]) * t['demi'][0] * 0.6
            feuilles.append(dict(base=base, azimut=a, elevation=math.radians(rng.uniform(5, 30)),
                                 longueur=rng.uniform(0.05, 0.065)))
    return dict(essence='tropical', n=n, hauteur=H, tronc=tronc, rayons=rayons, touffes=touffes,
                branches=branches, contreforts=contreforts, feuilles=feuilles, graine=graine)


def modele_tropical(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'tropical', st['n'], saison, 'habillage')
    s, f, anneau = tube(st['tronc'], st['rayons'], 8)
    col = melange(ECORCE_PIED, ECORCE_TROPICALE, lisser(0.0, 2.5, anneau))
    m.ajouter('tronc', s, f, np.clip(col * (1 + rng.uniform(-0.03, 0.03, (len(s), 1))), 0, 1), 'mat_ecorce')
    for b in st['branches']:
        _branche(m, b['points'], b['rayons'], 6, ECORCE_TROPICALE, rng)
    # Les contreforts : de minces ailettes qui rejoignent le sol en s'évasant.
    for c in st['contreforts']:
        radial = horizontale(c['azimut'])
        lateral = np.array([-radial[2], 0.0, radial[0]])
        profil = [(0.016, c['hauteur']), (0.03, c['hauteur'] * 0.45), (0.05, c['hauteur'] * 0.16),
                  (c['portee'], 0.0), (0.014, 0.0)]
        e = 0.0065
        bas = [radial * r + HAUT * y - lateral * e for r, y in profil]
        haut = [radial * r + HAUT * y + lateral * e for r, y in profil]
        sp, fp = prisme(bas, haut)
        centre_ailette = sp.mean(axis=0)
        fp = orienter(sp, fp, lambda q, c=centre_ailette: q - c)
        m.ajouter('tronc', sp, fp, nuancer(ECORCE_PIED, rng, len(sp), 0.03), 'mat_ecorce')
    for k, t in enumerate(st['touffes']):
        rng_t = np.random.default_rng(t['graine'])
        sb, fb, _, bouquets = boule(t['centre'], t['demi'], 2, rng_t, relief=(9, (0.09, 0.18), (0.08, 0.14)),
                                    dessous=0.7)
        col = pigment_par_bouquet(VERTS_TROPICAUX[k % len(VERTS_TROPICAUX)], VERT_CLAIR_TROPICAL, bouquets, rng)
        m.ajouter('feuillage', sb, fb, col, 'mat_feuillage')
    for fe in st['feuilles']:
        points, dirs = courbe(fe['base'], fe['azimut'], fe['elevation'], fe['longueur'], 0.7, 6, exposant=1.6)
        srel = np.linspace(0.0, 1.0, 6)
        largeurs = 0.05 * np.sin(np.pi * np.clip(srel * 0.9 + 0.08, 0, 1)) ** 0.8
        sl, fl, rang = lame(points, dirs, largeurs, 0.12, fe['azimut'])
        col = np.empty((len(sl), 3))
        col[:] = GRANDE_FEUILLE
        col[1:-1:3] = GRANDE_FEUILLE_NERVURE
        m.ajouter('feuillage', sl, fl, col, 'mat_feuillage')
    return m
