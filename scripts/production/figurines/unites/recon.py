"""
La recon : le plus petit véhicule du jeu, une petite voiture de jouet qui voit loin.

Ce qui la dit à 48 pixels : une caisse basse et arrondie, entièrement à la
couleur du camp, plus haute à l'arrière qu'au capot (elle penche vers l'avant,
elle a l'air de filer) ; quatre grosses roues de caoutchouc aux moyeux clairs,
plus grosses derrière ; et son signe, commun à tout ce qui voit loin : un mât
court portant une grosse boule-caméra claire, dont l'objectif regarde devant.
Aucune arme, aucune antenne en boucle, aucun feu orange. Classe petite : 0,64
à 0,68 case de large en vue « droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le haut de la classe petite : le plus petit véhicule, plus petit que le char léger (0,78).
LARGEUR_VISEE = (0.64, 0.68)

# ---------------------------------------------------------------------------
# Les cotes, en mètres : tout se déduit d'elles.
# ---------------------------------------------------------------------------

# Les roues : plus grosses derrière, c'est ce qui la fait pencher vers l'avant.
R_AV = 0.085
R_AR = 0.106
Z_AV = 0.16
Z_AR = -0.14
X_ROUE_AV = 0.16            # le plan milieu du pneu, de part et d'autre
X_ROUE_AR = 0.17
LARGEUR_PNEU = 0.07
PART_MOYEU = 0.46
MEPLAT = 0.62               # la corde qui coupe le moyeu en « D », en part de son rayon

# La caisse : un fuseau lissé, haut à l'arrière (l'habitacle), bas au capot.
Z_CAISSE_AR = -0.245
Z_CAISSE_AV = 0.255
DEMI_LARGEUR_AR = 0.172     # la caisse s'affine vers le nez : vue de dessus, une flèche
DEMI_LARGEUR_AV = 0.115
CAP_AR = 0.075              # l'arrondi de la poupe, vu de dessus
CAP_AV = 0.085              # l'arrondi du nez
Y_BAS_AR = 0.128
Y_BAS_AV = 0.085
Y_HABITACLE = 0.285
Y_CAPOT = 0.182
Z_PENTE_0 = -0.04           # où l'habitacle cède au capot
Z_PENTE_1 = 0.08
PENTE_CAPOT = 0.15          # le capot descend encore vers le nez (m par m)
PART_BAS = 0.38             # la ligne la plus large, depuis le dessous
EXPOSANTS = (3.2, 4.0)      # le dos arrondi aux épaules, le dessous presque plat
SECTIONS = 96

# Le pare-brise : une vitre qui épouse la pente de l'habitacle, posée dessus.
Z_VITRE_0 = -0.018
Z_VITRE_1 = 0.042
DEMI_LARGEUR_VITRE = 0.078
VITRE_DEHORS = 0.006        # ce qui dépasse de la caisse
VITRE_DEDANS = 0.012        # ce qui s'y enfonce

# Le châssis sombre, entre les roues, qui suit le dessous de la caisse, et ses deux pare-chocs.
LARGEUR_CHASSIS = 0.2
Z_CHASSIS = (-0.17, 0.17)
Y_CHASSIS_BAS = 0.065
ENFONCE_CHASSIS = 0.025     # ce que le châssis monte dans la caisse
R_PARE_CHOC = 0.032
PARE_CHOC_AV = ((0, 0.1, 0.24), 0.24)      # centre, longueur
PARE_CHOC_AR = ((0, 0.13, -0.235), 0.2)

# Le mât et la boule-caméra : le signe de la vision.
Z_MAT = -0.165              # tout à l'arrière : la boule domine la caisse, elle ne s'y assoit pas
Y_MAT_BAS = 0.24
R_MAT = 0.027
R_BOULE = 0.078
Y_BOULE = 0.468             # assez haut pour que le mât se voie sous la boule, vu à 50°
R_OBJECTIF = 0.042
AVANCE_OBJECTIF = 0.056     # le centre de l'objectif, depuis celui de la boule
#: L'objectif regarde devant, tourné vers la droite du modèle et levé d'un rien :
#: c'est le flanc que montrent les vues « droite » et « bas ».
CAP_OBJECTIF = 25.0
SITE_OBJECTIF = 10.0


# ---------------------------------------------------------------------------
# La caisse : une section en superellipse, qui change le long de z
# ---------------------------------------------------------------------------

def _lisse(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def _mix(a, c, t):
    return a + (c - a) * t


def _profil_caisse(z):
    """La section de la caisse à l'abscisse z : (demi-largeur, ligne la plus large, hauteur au-dessus, au-dessous)."""
    u = (z - Z_CAISSE_AR) / (Z_CAISSE_AV - Z_CAISSE_AR)
    y_bas = _mix(Y_BAS_AR, Y_BAS_AV, u)
    t = _lisse((z - Z_PENTE_0) / (Z_PENTE_1 - Z_PENTE_0))
    y_haut = _mix(Y_HABITACLE, Y_CAPOT, t) - PENTE_CAPOT * max(0.0, z - Z_PENTE_1)
    y_m = y_bas + PART_BAS * (y_haut - y_bas)
    k = 1.0
    if z < Z_CAISSE_AR + CAP_AR:
        v = (Z_CAISSE_AR + CAP_AR - z) / CAP_AR
        k = math.sqrt(max(0.0, 1 - v * v))
    elif z > Z_CAISSE_AV - CAP_AV:
        v = (z - (Z_CAISSE_AV - CAP_AV)) / CAP_AV
        k = math.sqrt(max(0.0, 1 - v * v))
    k = max(k, 0.04)
    return _mix(DEMI_LARGEUR_AR, DEMI_LARGEUR_AV, u) * k, y_m, (y_haut - y_m) * k, (y_m - y_bas) * k


def _unite(t, exposants=EXPOSANTS):
    """Le point de la section unité au paramètre t (0 : le flanc gauche, π/2 : le dos, π : le flanc droit, au-delà : le dessous)."""
    c, s = math.cos(t), math.sin(t)
    e = 2.0 / (exposants[0] if s >= 0 else exposants[1])
    return math.copysign(abs(c) ** e, c), math.copysign(abs(s) ** e, s)


def _points_section(z, ts, dehors=0.0):
    """Les points de la section de la caisse en z aux paramètres `ts`, poussés de `dehors` mètres hors de la surface."""
    a, ym, hh, hb = _profil_caisse(z)
    pts = []
    for t in ts:
        ux, uy = _unite(t)
        h = hh if uy >= 0 else hb
        pts.append(((a + dehors) * ux, ym + (h + dehors) * uy, z))
    return pts


def roue(f, noeud, centre, rayon, largeur, nom):
    """
    Une grosse roue : le pneu arrondi de la bibliothèque, et un moyeu clair
    coupé d'un méplat — un « D » qui tourne avec l'essieu : un moyeu rond et
    centré ne montre pas que la roue roule. Il dépasse des deux flancs.
    """
    pneu = f.cylindre(noeud, centre, rayon, largeur, 'caoutchouc', axe='x', chanfrein=0.3 * largeur, nom=f'{nom}_pneu')
    r = rayon * PART_MOYEU
    k = b.segments_cercle(r)
    cercle = [(r * math.sin(2 * math.pi * j / k), r * math.cos(2 * math.pi * j / k)) for j in range(k)]
    d = [(min(py, MEPLAT * r), pz) for py, pz in cercle]
    cx, cy, cz = centre
    e = largeur + 0.016
    moyeu = f.solide(noeud, [[(cx + s * e / 2, cy + py, cz + pz) for py, pz in d] for s in (-1, 1)], 'os', nom=f'{nom}_moyeu')
    moyeu.avec = pneu.nom
    return [pneu, moyeu]


def caisse(f, noeud, teinte, nom='caisse'):
    """
    La caisse, un solide lissé fait de sections en superellipse, échantillonné
    plus serré aux deux bouts (espacement en cosinus) : un bout arrondi en quart
    d'ellipse y a autant de sections que le reste, et ne se lit pas en facettes.
    """
    a_max = max(DEMI_LARGEUR_AR, DEMI_LARGEUR_AV)
    n = b.segments_cercle(a_max)
    ts = [2 * math.pi * i / n for i in range(n)]
    zs = [Z_CAISSE_AR + (Z_CAISSE_AV - Z_CAISSE_AR) * (1 - math.cos(math.pi * k / SECTIONS)) / 2 for k in range(SECTIONS + 1)]
    return f.solide(noeud, [_points_section(z, ts) for z in zs], teinte, nom=nom)


def pare_brise(f, noeud, nom='pare_brise'):
    """
    La vitre : le dos de la caisse entre deux abscisses, sur une demi-largeur,
    en coquille — dehors de `VITRE_DEHORS`, dedans de `VITRE_DEDANS`. Elle
    épouse la pente, et son reflet peint tombe sur son tiers haut, contre le toit.
    """
    n = 16
    a = _profil_caisse((Z_VITRE_0 + Z_VITRE_1) / 2)[0]
    # Le paramètre où la section passe à la demi-largeur de la vitre (le dos : t = π/2).
    t0 = math.acos(min(1.0, (DEMI_LARGEUR_VITRE / a) ** (EXPOSANTS[0] / 2)))
    ts = [t0 + (math.pi - 2 * t0) * i / (n - 1) for i in range(n)]
    anneaux = []
    for k in range(13):
        z = Z_VITRE_0 + (Z_VITRE_1 - Z_VITRE_0) * k / 12
        anneaux.append(_points_section(z, ts, VITRE_DEHORS) + _points_section(z, list(reversed(ts)), -VITRE_DEDANS))
    return f.solide(noeud, anneaux, 'verre', nom=nom)


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds : la base porte les essieux (les roues restent au sol), le
    # corps la caisse (elle rebondit sur ses ressorts), le module radar le mât,
    # et la boule-caméra a son nœud à elle : elle pivote.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.16, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('essieu_av', parent='base', pivot=(0, R_AV, Z_AV))
    f.noeud('essieu_ar', parent='base', pivot=(0, R_AR, Z_AR))
    f.noeud('module_radar', parent='corps', pivot=(0, Y_MAT_BAS, Z_MAT))
    f.noeud('camera', parent='module_radar', pivot=(0, Y_BOULE, Z_MAT), tournant=True)

    # Les quatre grosses roues : caoutchouc, moyeux clairs en « D ».
    for cote in (1, -1):
        s = 'g' if cote > 0 else 'd'
        roue(f, 'essieu_av', (cote * X_ROUE_AV, R_AV, Z_AV), R_AV, LARGEUR_PNEU, nom=f'roue_av_{s}')
        roue(f, 'essieu_ar', (cote * X_ROUE_AR, R_AR, Z_AR), R_AR, LARGEUR_PNEU, nom=f'roue_ar_{s}')

    # Le châssis sombre, entre les roues, sous la caisse, et ses pare-chocs.
    z0, z1 = Z_CHASSIS
    dessous = [(z, _mix(Y_BAS_AR, Y_BAS_AV, (z - Z_CAISSE_AR) / (Z_CAISSE_AV - Z_CAISSE_AR)) + ENFONCE_CHASSIS) for z in (z1, z0)]
    f.prisme('corps', [(z0, Y_CHASSIS_BAS), (z1, Y_CHASSIS_BAS)] + dessous, LARGEUR_CHASSIS, 'graphite', nom='chassis')
    for (centre, longueur), nom in ((PARE_CHOC_AV, 'pare_choc_av'), (PARE_CHOC_AR, 'pare_choc_ar')):
        f.capsule('corps', centre, R_PARE_CHOC, longueur, 'graphite', axe='x', nom=nom)

    # La caisse, entière à la couleur du camp, et son pare-brise.
    caisse(f, 'corps', 'equipe')
    pare_brise(f, 'corps')

    # Le mât court, planté dans l'habitacle.
    y_mat_haut = Y_BOULE - 0.5 * R_BOULE
    f.cylindre('module_radar', (0, (Y_MAT_BAS + y_mat_haut) / 2, Z_MAT), R_MAT, y_mat_haut - Y_MAT_BAS, 'graphite', axe='y', nom='mat')

    # La boule-caméra claire, et son objectif de verre qui regarde devant.
    f.boule('camera', (0, Y_BOULE, Z_MAT), R_BOULE, 'os', nom='boule_camera')
    cap, site = math.radians(CAP_OBJECTIF), math.radians(SITE_OBJECTIF)
    visee = (-math.sin(cap) * math.cos(site), math.sin(site), math.cos(cap) * math.cos(site))
    f.boule('camera', tuple(c + AVANCE_OBJECTIF * v for c, v in zip((0, Y_BOULE, Z_MAT), visee)), R_OBJECTIF, 'verre', nom='objectif')


def animer(f):
    # Repos : rien ne bouge que la boule-caméra, qui balaie lentement l'horizon.
    b.balancer(f.clip('repos'), 'camera', 'y', 25.0, periodes=1)

    # Déplacement : les roues roulent (le « D » des moyeux le montre, 60° par
    # image cuite), la caisse pique du nez de 2° et rebondit à peine.
    d = f.clip('deplacement')
    b.tourner(d, 'essieu_av', 'x', tours=2)
    b.tourner(d, 'essieu_ar', 'x', tours=2)
    d.rotation('corps', lambda t: ('x', 2.0))
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.8, periodes=2, phase=1.2)

    # Tir : la caisse encaisse le coup, se cabre et recule d'un rien ; la caméra acquiesce.
    t = f.clip('tir')
    b.a_coup(t, 'corps', 'x', -3.0, attaque=0.06, retour=0.4)
    b.recul(t, 'corps', '-z', 0.012, attaque=0.06, retour=0.4)
    b.a_coup(t, 'camera', 'x', 8.0, attaque=0.08, retour=0.4)

    # Touché : la caisse roule sur ses ressorts, se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 5.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.012)

    # Hors jeu : la caisse s'affaisse de biais, le mât bascule, la caméra pique du nez.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.018, 0), rotation=('z', -7.0))
    b.affaisser(h, 'module_radar', rotation=('x', -28.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'camera', rotation=('x', 30.0), debut=0.2, duree=0.5)
