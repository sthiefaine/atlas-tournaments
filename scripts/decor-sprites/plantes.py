"""
Les petites plantes : buisson, touffe (hautes herbes), roseau (marais).

Même règle que les arbres : la **structure** ne dépend que de la graine et du
numéro de variante, la **saison** ne fait que l'habiller. Une touffe d'été a les
brins d'une touffe de printemps, plus quelques-uns — « dru » —, pas d'autres.

Gabarits (commande du 23 septembre 2026), appliqués à la largeur **et** à la
hauteur : buisson 0,18 à 0,3 ; touffe 0,12 à 0,25 ; roseau 0,15 à 0,3.
"""

import math

import numpy as np

from geometrie import (
    Modele, boule, couleur, courbe, horizontale, lame, lisser, melange, normer, nuancer, pigment_par_bouquet,
    rng_de, sous_maille, tube,
)

NEIGE = couleur('#f4f8fc')
HAUT = np.array([0.0, 1.0, 0.0])


# ===========================================================================
# Buisson
# ===========================================================================

# (centre x, centre z, demi-largeur, demi-hauteur) des boules, en mètres ; la
# hauteur du centre s'en déduit pour que chaque boule pose au sol.
BUISSON = {
    # Un dôme : une grosse boule au cœur, trois autour.
    1: [(0.0, -0.005, 0.1, 0.122), (0.068, 0.03, 0.074, 0.074), (-0.062, 0.04, 0.072, 0.07),
        (0.004, -0.07, 0.07, 0.068)],
    # Une haie courte, plus large que haute, en cinq masses.
    2: [(-0.072, 0.005, 0.06, 0.066), (-0.026, -0.02, 0.07, 0.108), (0.03, 0.012, 0.072, 0.1),
        (0.078, -0.01, 0.052, 0.062), (0.0, 0.05, 0.058, 0.07)],
}

FEUILLAGE_BUISSON = {
    'printemps': (['#7ec35a', '#88cb5e'], '#b3e184'),
    'ete': (['#3d8a3a', '#46943f'], '#63ad4c'),
    'automne': (['#c24a2a', '#d8742c', '#b9922e'], '#eba05a'),
    # L'hiver, un persistant qui dort : vert éteint, olive, sous sa neige.
    'hiver': (['#56644a', '#5c6a4c'], '#6f7c5a'),
}
FLEURS_BUISSON = [couleur('#f2b8cf'), couleur('#fbf5ee'), couleur('#f7d6e3')]


def structure_buisson(graine, n):
    rng = rng_de(graine, 'buisson', n)
    boules = []
    for (x, z, rl, rh) in BUISSON[n]:
        demi = np.array([rl, rh, rl * rng.uniform(0.92, 1.05)])
        dessous = 0.72
        # Le bas écrasé d'une boule descend de `rh × dessous` : son centre est posé
        # juste assez haut pour qu'elle touche le sol, un peu dedans.
        centre = np.array([x, rh * dessous * 0.94, z])
        boules.append(dict(centre=centre, demi=demi, dessous=dessous, graine=int(rng.integers(1 << 30))))
    return dict(essence='buisson', n=n, boules=boules, graine=graine)


def _boule_buisson(b, echelle=1.0):
    rng_b = np.random.default_rng(b['graine'])
    return boule(b['centre'] * np.array([1.0, echelle, 1.0]), b['demi'] * echelle, 2, rng_b,
                 relief=(10, (0.1, 0.2), (0.06, 0.12)), dessous=b['dessous'])


def modele_buisson(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'buisson', st['n'], saison, 'habillage')
    bases, clair = FEUILLAGE_BUISSON[saison]
    bases = [couleur(h) for h in bases]
    clair = couleur(clair)
    surfaces = []
    for k, b in enumerate(st['boules']):
        s, f, u, bouquets = _boule_buisson(b)
        base = np.clip(bases[k % len(bases)] * rng.uniform(0.96, 1.04), 0, 1)
        m.ajouter('feuillage', s, f, pigment_par_bouquet(base, clair, bouquets, rng), 'mat_feuillage')
        surfaces.append((s, u, f, b))

    if saison == 'printemps':
        candidats = [s[i] for s, u, _, _ in surfaces for i in range(len(s)) if u[i][1] > 0.1 and u[i][2] > -0.3]
        choix = rng.choice(len(candidats), size=min(14, len(candidats)), replace=False)
        for k in sorted(choix):
            sf, ff, _, _ = boule(candidats[k], np.array([0.0095, 0.0078, 0.0095]), 0)
            m.ajouter('fleurs', sf, ff, FLEURS_BUISSON[k % len(FLEURS_BUISSON)], 'mat_fleurs')

    if saison == 'hiver':
        # Une calotte de neige par boule : la même boule, gonflée d'un rien, dont
        # on ne garde que le dessus. Le bord suit les bosses, donc il est irrégulier.
        for s, u, f, b in surfaces:
            dessus = u[:, 1] > 0.18
            gonfle = s + (s - b['centre']) / np.maximum(np.linalg.norm(s - b['centre'], axis=1,
                                                                      keepdims=True), 1e-9) * 0.006
            sn, fn, _ = sous_maille(gonfle, f, lambda face: all(dessus[i] for i in face))
            m.ajouter('neige', sn, fn, nuancer(NEIGE, rng, len(sn), 0.012), 'mat_neige')
    return m


# ===========================================================================
# Touffe — les hautes herbes
# ===========================================================================

TOUFFE = {
    # Une touffe dressée.
    1: dict(brins=16, dispersion=0.018, elevation=(68, 86), longueur=(0.12, 0.19), flexion=(0.3, 0.7)),
    # Une touffe en fontaine, qui retombe.
    2: dict(brins=18, dispersion=0.022, elevation=(60, 82), longueur=(0.145, 0.19), flexion=(0.7, 1.05)),
}

# base, pointe : « vert tendre, dru, blond, givré ».
HERBES = {
    'printemps': ('#7fc350', '#b5e67f'),
    'ete': ('#3f8d2f', '#5fae3f'),
    'automne': ('#b8954a', '#e3c98a'),
    'hiver': ('#8fa59a', '#eef3f4'),
}
# Ce que la saison fait au brin : longueur et flexion relatives.
PORT_SAISON = {
    'printemps': (0.88, 0.9),
    'ete': (1.0, 1.0),
    'automne': (1.0, 1.15),
    'hiver': (0.95, 1.25),
}
BRINS_ETE = 6


def _tirer_brin(rng, p):
    rayon = p['dispersion'] * math.sqrt(rng.random())
    a0 = rng.uniform(0, 2 * math.pi)
    return dict(depart=np.array([rayon * math.cos(a0), 0.0, rayon * math.sin(a0)]),
                azimut=rng.uniform(0, 2 * math.pi),
                elevation=math.radians(rng.uniform(*p['elevation'])),
                longueur=rng.uniform(*p['longueur']),
                flexion=rng.uniform(*p['flexion']),
                largeur=rng.uniform(0.015, 0.021),
                vrille=rng.normal(0, 0.25))


def structure_touffe(graine, n):
    p = TOUFFE[n]
    rng = rng_de(graine, 'touffe', n)
    brins = [_tirer_brin(rng, p) for _ in range(p['brins'])]
    # Les brins de l'été viennent après, du même tirage : les autres saisons n'en
    # sont pas changées.
    en_plus = [_tirer_brin(rng, p) for _ in range(BRINS_ETE)]
    epis = sorted(range(len(brins)), key=lambda i: -brins[i]['longueur'] * math.sin(brins[i]['elevation']))[:5]
    return dict(essence='touffe', n=n, brins=brins, en_plus=en_plus, epis=epis, graine=graine)


def modele_touffe(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'touffe', st['n'], saison, 'habillage')
    base_c, pointe_c = (couleur(h) for h in HERBES[saison])
    k_long, k_flex = PORT_SAISON[saison]
    brins = st['brins'] + (st['en_plus'] if saison == 'ete' else [])
    for i, b in enumerate(brins):
        stations = 6
        points, dirs = courbe(b['depart'], b['azimut'], b['elevation'], b['longueur'] * k_long,
                              b['flexion'] * k_flex, stations, exposant=1.4, vrille=b['vrille'])
        srel = np.linspace(0.0, 1.0, stations)
        largeurs = b['largeur'] * (1.0 - 0.8 * srel)
        s, f, rang = lame(points, dirs, largeurs, 0.25, b['azimut'] + b['vrille'] * 0.5)
        teinte = np.clip(base_c * rng.uniform(0.95, 1.05), 0, 1)
        col = melange(teinte, pointe_c, lisser(0.15, 1.0, rang))
        m.ajouter('herbe', s, f, col, 'mat_herbe')
        if saison == 'automne' and i in st['epis']:
            # L'herbe blonde est montée en graines : un épi au bout des plus hauts brins.
            bout, d = points[-2], dirs[-2]
            centre = bout + d * 0.006
            se, fe, _, _ = boule(centre, np.array([0.0065, 0.016, 0.0065]), 1)
            axe = normer(d)
            # L'épi suit le brin : la boule est tournée pour que son grand axe prolonge la tige.
            rot = _rotation_vers(HAUT, axe)
            se = (se - centre) @ rot.T + centre
            m.ajouter('herbe', se, fe, couleur('#d9bd78'), 'mat_herbe')
    return m


def _rotation_vers(a, b):
    """La rotation qui amène le vecteur unitaire `a` sur `b`."""
    a, b = normer(a), normer(b)
    v = np.cross(a, b)
    c = float(a @ b)
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3) if c > 0 else np.diag([1.0, -1.0, -1.0])
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k * (1.0 / (1.0 + c))


# ===========================================================================
# Roseau — le marais
# ===========================================================================

ROSEAU = {
    # Une touffe serrée de massettes.
    1: dict(feuilles=8, tiges=5, epis=3, hauteur=(0.21, 0.27), dispersion=0.03),
    # Plus clairsemée, plus haute, deux épis.
    2: dict(feuilles=7, tiges=4, epis=2, hauteur=(0.22, 0.275), dispersion=0.04),
}

ROSEAU_COULEURS = {
    'toutes': dict(feuille=('#5f8f35', '#86b04e'), tige='#6d9340', epi='#5a3a24', coiffe=None),
    # L'hiver : paille, épis éclatés en bourre blanche, et du givre.
    'hiver': dict(feuille=('#c9b178', '#bda36b'), tige='#b39a66', epi='#7a5a3e', coiffe='#eeeae2'),
}


def structure_roseau(graine, n):
    p = ROSEAU[n]
    rng = rng_de(graine, 'roseau', n)
    feuilles = []
    for _ in range(p['feuilles']):
        rayon = p['dispersion'] * math.sqrt(rng.random())
        a0 = rng.uniform(0, 2 * math.pi)
        feuilles.append(dict(depart=np.array([rayon * math.cos(a0), 0.0, rayon * math.sin(a0)]),
                             azimut=rng.uniform(0, 2 * math.pi), elevation=math.radians(rng.uniform(64, 84)),
                             longueur=rng.uniform(0.16, 0.25), flexion=rng.uniform(0.2, 0.6),
                             largeur=rng.uniform(0.011, 0.014), casse=rng.random() < 0.5))
    tiges = []
    for j in range(p['tiges']):
        rayon = p['dispersion'] * 0.8 * math.sqrt(rng.random())
        a0 = rng.uniform(0, 2 * math.pi)
        base = np.array([rayon * math.cos(a0), 0.0, rayon * math.sin(a0)])
        h = rng.uniform(*p['hauteur'])
        pen = horizontale(rng.uniform(0, 2 * math.pi)) * rng.uniform(0.004, 0.02)
        tiges.append(dict(base=base, hauteur=h, penche=pen))
    tiges.sort(key=lambda t: -t['hauteur'])
    return dict(essence='roseau', n=n, feuilles=feuilles, tiges=tiges, epis=p['epis'], graine=graine)


def modele_roseau(st, saison):
    m = Modele()
    rng = rng_de(st['graine'], 'roseau', st['n'], saison, 'habillage')
    c = ROSEAU_COULEURS[saison]
    f_base, f_pointe = (couleur(h) for h in c['feuille'])
    for fe in st['feuilles']:
        stations = 7
        flexion = fe['flexion']
        exposant = 1.5
        if saison == 'hiver' and fe['casse']:
            # Une feuille sèche casse : elle plie net aux deux tiers.
            flexion, exposant = 1.7, 5.0
        points, dirs = courbe(fe['depart'], fe['azimut'], fe['elevation'], fe['longueur'], flexion, stations,
                              exposant=exposant)
        srel = np.linspace(0.0, 1.0, stations)
        largeurs = fe['largeur'] * (1.0 - 0.75 * srel)
        s, f, rang = lame(points, dirs, largeurs, 0.2, fe['azimut'])
        col = melange(f_base, f_pointe, rang)
        m.ajouter('herbe', s, f, np.clip(col * (1 + rng.uniform(-0.03, 0.03, (len(s), 1))), 0, 1), 'mat_herbe')
    for j, t in enumerate(st['tiges']):
        h = t['hauteur']
        ts = np.linspace(0.0, 1.0, 5)
        pts = t['base'] + np.outer(ts * h, HAUT) + np.outer(ts ** 2, t['penche'])
        pts = np.vstack([pts, pts[-1] + (pts[-1] - pts[-2]) * 0.2])
        rayons = np.concatenate([np.linspace(0.0042, 0.0026, 5), [0.0]])
        s, f, _ = tube(pts, rayons, 5, pointe=True)
        m.ajouter('herbe', s, f, nuancer(couleur(c['tige']), rng, len(s), 0.04), 'mat_herbe')
        if j < st['epis']:
            # La massette : un cigare brun aux trois quarts de la tige.
            t0, t1 = 0.7, 0.86
            p0 = t['base'] + HAUT * h * t0 + t['penche'] * t0 ** 2
            p1 = t['base'] + HAUT * h * t1 + t['penche'] * t1 ** 2
            axe = np.linspace(0.0, 1.0, 6)
            epi = p0 + np.outer(axe, p1 - p0)
            r_epi = np.array([0.0045, 0.0085, 0.0092, 0.0092, 0.0082, 0.0])
            se, fe_, _ = tube(epi, r_epi, 7, pointe=True, fermer_bas=True)
            m.ajouter('epis', se, fe_, nuancer(couleur(c['epi']), rng, len(se), 0.04), 'mat_herbe')
            if c['coiffe'] is not None:
                sc, fc, _, _ = boule(p1 + HAUT * 0.002, np.array([0.011, 0.009, 0.011]), 1)
                m.ajouter('neige', sc, fc, melange(couleur(c['coiffe']), NEIGE, 0.4), 'mat_neige')
    return m
