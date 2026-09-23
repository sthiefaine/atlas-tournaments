"""
Le chasseur : un jet de jouet, pointu et rapide, qui ouvre la famille des avions.

Ce qui le dit à 48 pixels : une voilure en flèche à la couleur du camp, d'une
seule pièce, posée sur le dos d'un fuselage graphite dont le nez en ogive pique
vers la droite ; une verrière de verre à reflet devant l'aile ; deux dérives
inclinées vers l'extérieur, à la couleur du camp (le furtif n'en a pas) ; un
empennage et deux tuyères graphite ; deux petits missiles os sous les ailes,
qui dépassent du bord d'attaque.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le bas de la grande classe : le bombardier sera au-dessus.
LARGEUR_VISEE = (0.88, 0.90)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.30                    # bas de la silhouette au repos (charte : avions à 0,30 m)

# Le fuselage graphite, du bout des tuyères à la pointe du nez.
Z_NEZ = 0.475
Z_NEZ_DEBUT = 0.15
Z_QUEUE_DEBUT = -0.18
Z_AR = -0.41
A_FUS = 0.075                 # demi-largeur
Y_BAS = ALT                   # le fond de la carène
Y_LIGNE = 0.365               # la ligne la plus large
Y_DOS = 0.43                  # le sommet
Y_POINTE = 0.37               # la pointe du nez

# La voilure, d'une seule pièce : son dessus passe au ras du dos et couvre le
# fuselage. Bord d'attaque en flèche, bord de fuite en flèche aussi, plus douce.
EP_AILE = 0.05
Y_AILE_HAUT = Y_DOS + 0.005
DEMI_ENVERGURE = 0.33
Z_BA_AXE = 0.22               # la pointe de la voilure, sur le dos
Z_BA_SAUMON = -0.12
Z_BF_SAUMON = -0.215
Z_BF_AXE = -0.10

# L'empennage horizontal, d'une seule pièce : bord d'attaque en flèche, bord de fuite qui avance.
Y_EMP = 0.37
DEMI_ENV_EMP = 0.19
Z_BA_EMP_AXE = -0.225
Z_BA_EMP_SAUMON = -0.30
Z_BF_EMP_SAUMON = -0.365
Z_BF_EMP_AXE = -0.425

# Les dérives.
X_DERIVE = 0.058
Y_DERIVE = Y_DOS - 0.01
Z_DERIVE = -0.32
CANT = 20.0

# Les entrées d'air, de part et d'autre du poste, sous la pointe de la voilure.
X_ENTREE = 0.088
Z_ENTREE = (0.02, 0.19)
Y_ENTREE = (0.315, 0.405)

# Les tuyères.
X_TUYERE = 0.036
Y_TUYERE = 0.357
R_TUYERE = 0.034
Z_TUYERE = (-0.445, -0.395)

# La verrière.
Z_VERR = (0.10, 0.33)
Y_VERR = Y_DOS - 0.005

# Les missiles, sous les ailes : la moitié avant dépasse du bord d'attaque.
R_MISSILE = 0.028
L_MISSILE = 0.20
X_MISSILE = 0.2
Y_MISSILE = Y_AILE_HAUT - EP_AILE - R_MISSILE + 0.006
#: Au tir : la course du missile avant qu'il se range, et où il se range (dans le fuselage).
COURSE_MISSILE = 0.22
Y_CACHE = 0.36
Z_CACHE = -0.10
#: Le recul au tir : la queue est à 2 cm du débord.
RECUL = 0.015


def z_bord_attaque(x):
    """Le bord d'attaque de la voilure à la distance |x| de l'axe."""
    return Z_BA_AXE + (Z_BA_SAUMON - Z_BA_AXE) * abs(x) / DEMI_ENVERGURE


Z_MISSILE = z_bord_attaque(X_MISSILE) - 0.005


# ---------------------------------------------------------------------------
# Les profils
# ---------------------------------------------------------------------------

def _section(z):
    """Le fuselage à l'abscisse z : (demi-largeur, fond, ligne la plus large, sommet)."""
    if z >= Z_NEZ_DEBUT:
        # Le nez en ogive : tout converge vers la pointe.
        u = min(1.0, (z - Z_NEZ_DEBUT) / (Z_NEZ - Z_NEZ_DEBUT))
        k = max(0.02, (1 - u ** 1.8) ** 0.75)
        axe = Y_LIGNE + (Y_POINTE - Y_LIGNE) * b.lisse(u)
        return A_FUS * k, axe - (Y_LIGNE - Y_BAS) * k, axe, axe + (Y_DOS - Y_LIGNE) * k
    if z <= Z_QUEUE_DEBUT:
        # La queue s'amincit un peu et remonte vers les tuyères.
        u = b.lisse((Z_QUEUE_DEBUT - z) / (Z_QUEUE_DEBUT - Z_AR))
        return A_FUS * (1 - 0.08 * u), Y_BAS + 0.02 * u, Y_LIGNE - 0.004 * u, Y_DOS - 0.01 * u
    return A_FUS, Y_BAS, Y_LIGNE, Y_DOS


def _profil_fuselage(z):
    a, bas, y, haut = _section(z)
    return a, y, haut - y, y - bas


def _profil_verriere(z):
    """Une goutte : ronde devant, effilée derrière."""
    z0, z1 = Z_VERR
    t = (z - z0) / (z1 - z0)
    if t > 0.62:
        u = (t - 0.62) / 0.38
        k = math.sqrt(max(0.0, 1 - u * u))
    else:
        u = (0.62 - t) / 0.62
        k = 1 - u ** 1.7
    k = max(0.04, k)
    return 0.05 * k, Y_VERR, 0.065 * k, 0.02 * k


def _plan_voilure():
    """Le plan de la voilure vu de dessus, points (x, z) : la pointe, le saumon droit, l'encoche du bord de fuite, le saumon gauche."""
    s = DEMI_ENVERGURE
    return [(0.0, Z_BA_AXE), (-s, Z_BA_SAUMON), (-s, Z_BF_SAUMON), (0.0, Z_BF_AXE), (s, Z_BF_SAUMON), (s, Z_BA_SAUMON)]


def _plan_empennage():
    """Le plan de l'empennage horizontal vu de dessus, points (x, z) : un losange aux saumons coupés."""
    s = DEMI_ENV_EMP
    return [(0.0, Z_BA_EMP_AXE), (-s, Z_BA_EMP_SAUMON), (-s, Z_BF_EMP_SAUMON), (0.0, Z_BF_EMP_AXE), (s, Z_BF_EMP_SAUMON), (s, Z_BA_EMP_SAUMON)]


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds : le corps (fuselage) porte tout et s'anime ; la base (la
    # voilure, le « base : ailes » du canon) lui est accrochée ; chaque missile
    # a son nœud, pour partir au tir.
    y_aile = Y_AILE_HAUT - EP_AILE / 2
    f.noeud('corps', pivot=(0, y_aile, 0))
    f.noeud('base', parent='corps', pivot=(0, y_aile, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    for cote, c in ((1, 'g'), (-1, 'd')):
        f.noeud(f'missile_{c}', parent='base', pivot=(cote * X_MISSILE, Y_MISSILE, Z_MISSILE))

    # Le fuselage graphite.
    f.fuseau('corps', _profil_fuselage, Z_AR, Z_NEZ, 'graphite', sections=80, exposants=(2.2, 2.6), nom='fuselage')

    # Les entrées d'air, de part et d'autre du poste.
    for cote, c in ((1, 'g'), (-1, 'd')):
        f.boite('corps', (cote * X_ENTREE, (Y_ENTREE[0] + Y_ENTREE[1]) / 2, (Z_ENTREE[0] + Z_ENTREE[1]) / 2),
                (0.06, Y_ENTREE[1] - Y_ENTREE[0], Z_ENTREE[1] - Z_ENTREE[0]), 'graphite', chanfrein=0.02, nom=f'entree_{c}')

    # Les deux tuyères.
    for cote, c in ((1, 'g'), (-1, 'd')):
        f.cylindre('corps', (cote * X_TUYERE, Y_TUYERE, (Z_TUYERE[0] + Z_TUYERE[1]) / 2), R_TUYERE * 0.88, Z_TUYERE[1] - Z_TUYERE[0],
                   'graphite', axe='z', rayon2=R_TUYERE, nom=f'tuyere_{c}')

    # La verrière en goutte.
    f.fuseau('corps', _profil_verriere, Z_VERR[0], Z_VERR[1], 'verre', sections=40, nom='verriere')

    # La voilure à la couleur du camp, d'une seule pièce ; l'empennage horizontal graphite.
    plan = _plan_voilure()
    f.extrusion('base', plan, None, Y_AILE_HAUT - EP_AILE, Y_AILE_HAUT, 'equipe', nom='voilure')
    f.extrusion('base', _plan_empennage(), None, Y_EMP - EP_AILE / 2, Y_EMP + EP_AILE / 2, 'graphite', nom='empennage')

    # Les deux dérives, inclinées vers l'extérieur.
    profil = [(0.09, 0.0), (-0.09, 0.0), (-0.10, 0.16), (-0.03, 0.16)]
    for cote, c in ((1, 'g'), (-1, 'd')):
        f.prisme('corps', profil, 0.05, 'equipe', origine=(cote * X_DERIVE, Y_DERIVE, Z_DERIVE), rotation=[('z', -cote * CANT)],
                 nom=f'derive_{c}')

    # Les missiles, petits et clairs, sous les ailes.
    for cote, c in ((1, 'g'), (-1, 'd')):
        f.capsule(f'missile_{c}', (cote * X_MISSILE, Y_MISSILE, Z_MISSILE), R_MISSILE, L_MISSILE, 'os', axe='z', nom=f'missile_{c}')


def _bascule(clip, apres):
    """
    La première clé d'échantillonnage où l'obturateur de la cuisson est fermé
    après l'instant `apres` : un saut posé là tombe entre deux images cuites,
    sans traîner de flou (la cuisson ouvre l'obturateur sur `FLOU_DE_BOUGE` du
    pas, centré sur chaque image).
    """
    ts = b.instants_cuisson(clip)
    demi = b.FLOU_DE_BOUGE * (ts[1] - ts[0]) / 2
    cle = 1.0 / b.FREQUENCE_CLES
    for k, t in enumerate(ts[:-1]):
        s = math.ceil((t + demi) / cle + 0.1) * cle
        if s >= apres and s + cle <= ts[k + 1] - demi + 1e-6:
            return s
    raise ValueError(f'{clip.nom} : pas de bascule possible après {apres} s')


def _lancer(clip, noeud, cote, depart, course, cache_apres, retour_apres):
    """
    Un missile qui part : il file vers l'avant en accélérant, puis, entre deux
    images, se range dans le fuselage (caché, jamais rapetissé : une échelle
    quasi nulle noircit toute la vue de profil de la cuisson) et reparaît sur
    son rail à la fin du clip.
    """
    s_cache = _bascule(clip, cache_apres)
    s_retour = _bascule(clip, retour_apres)
    cache = (-cote * X_MISSILE, Y_CACHE - Y_MISSILE, Z_CACHE - Z_MISSILE)

    def ft(t):
        if t <= depart:
            return (0.0, 0.0, 0.0)
        if t <= s_cache + 1e-6:
            u = min(1.0, (t - depart) / (s_cache - depart))
            return (0.0, 0.0, course * u * u)
        if t <= s_retour + 1e-6:
            return cache
        return (0.0, 0.0, 0.0)

    clip.translation(noeud, ft)


def animer(f):
    # Repos : un vol calme ; il monte et descend de quelques millimètres, roule d'un degré.
    r = f.clip('repos')
    b.osciller(r, 'corps', 'y', 0.004, periodes=1)
    b.balancer(r, 'corps', 'z', 1.0, periodes=1)

    # Déplacement : un léger piqué, et il se balance à peine.
    d = f.clip('deplacement')
    d.rotation('corps', lambda t: ('x', 5.0))
    b.balancer(d, 'corps', 'z', 1.5, periodes=1)
    b.osciller(d, 'corps', 'y', 0.005, periodes=1)

    # Tir : les deux missiles partent, l'appareil recule d'un pas et se cabre un instant.
    t = f.clip('tir')
    b.recul(t, 'corps', '-z', RECUL, debut=0.03, attaque=0.06, retour=0.4)
    b.a_coup(t, 'corps', 'x', -3.0, debut=0.03, attaque=0.07, retour=0.45)
    for cote, c in ((1, 'g'), (-1, 'd')):
        _lancer(t, f'missile_{c}', cote, depart=0.03, course=COURSE_MISSILE, cache_apres=0.24, retour_apres=0.6)

    # Touché : il roule, vacille et s'enfonce un peu, puis se reprend.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 8.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)

    # Hors jeu : il s'affaisse sur l'aile droite, le nez bas.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 18.0))
    b.affaisser(h, 'corps', rotation=('x', 10.0), debut=0.1, duree=0.7)
