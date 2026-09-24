"""
Le drone marin : une petite vedette de jouet, sans pilote et sans cabine, qui
voit loin.

Ce qui le dit à 48 pixels : une coque courte et pointue, graphite sur sa bande
de flottaison os, dont l'étrave fine et haute s'évase en V et se relève en
cuillère ; dessus, un pont plat à la couleur du camp, d'un seul tenant, qui
déborde en liston sur le haut des flancs et porte une capsule basse et ronde ;
à l'arrière, une plage basse et sombre, une marche plus bas, et une antenne
courte ; et son signe, commun à tout ce qui voit loin : un mât court portant une
grosse boule-caméra os, dont l'objectif sombre regarde le joueur. Ni cabine, ni
vitre, ni arme ; un seul flotteur. Classe petite : 0,60 à 0,66 case de large en
vue « droite », contour compris — le plus petit navire, bien sous la barge.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: La classe petite, sans son haut : le plus petit navire, bien sous la barge (0,81).
LARGEUR_VISEE = (0.60, 0.66)

# ---------------------------------------------------------------------------
# Les cotes, en mètres : tout se déduit d'elles.
# ---------------------------------------------------------------------------

# La coque vue de dessus : un tableau arrière aux coins ronds, les flancs qui
# s'élargissent un peu, puis l'étrave qui s'effile en ogive jusqu'à la pointe.
Z_POUPE = -0.3
Z_ETRAVE = 0.325
Z_EPAULE = -0.02            # où l'étrave commence à s'effiler
DEMI_LARGEUR = 0.118        # au livet, là où la coque est la plus large
DEMI_LARGEUR_POUPE = 0.108
ARRONDI_POUPE = 0.035       # les coins du tableau arrière, vus de dessus
POINTE = 1.35               # l'exposant de l'ogive : plus haut, une étrave plus ronde
EVASEMENT = 0.12            # la coque est plus étroite d'autant (en part) à la flottaison qu'au livet…
EVASEMENT_ETRAVE = 0.4      # … et bien plus à l'étrave, qui s'évase en V

# La coque vue de côté : le livet monte vers l'étrave, la quille se relève en
# cuillère dessous.
FLOTTAISON = 0.03           # la bande os, de l'eau à 3 cm
Y_LIVET_POUPE = 0.115
Y_LIVET_ETRAVE = 0.19
TONTURE = 2.5               # l'exposant de la montée du livet : plus haut, elle se fait plus devant
Z_PIED = 0.1                # où la quille commence à se relever
HAUT_POINTE = 0.035         # la hauteur de la pointe de l'étrave

# La plage arrière : le livet descend d'une marche, et la coque sombre y reste à nu.
MARCHE = 0.03
Z_MARCHE_0 = -0.235         # la plage, basse, de la poupe jusqu'ici
Z_MARCHE_1 = -0.2           # le pont est à sa hauteur à partir d'ici

# Le pont : un plat d'équipe légèrement bombé, posé sur le livet, qui descend
# en liston sur le haut des flancs.
SAILLIE_PONT = 0.003        # le pont déborde un peu du flanc : un bord net
JUPE_PONT = 0.03            # le liston : ce que le pont descend sous le livet
BOMBE = 0.022               # le bombé du pont au milieu
BOMBE_ETRAVE = 0.012        # à la pointe
Z_BOMBE = 0.08              # le bombé commence à baisser vers l'étrave
EXPOSANT_PONT = 2.6         # le pont arrondi aux bords
EXPOSANT_ETRAVE = 1.6       # le pont s'affine en arête vers la pointe
EXPOSANT_JUPE = 5.0         # le liston, droit, rentre sous la coque en bas
SECTIONS = 72
POINTS_SECTION = 48

# La capsule étanche : une pilule basse sur l'axe du pont, d'où sort le mât.
Z_CAPSULE = (-0.19, 0.16)
DEMI_LARGEUR_CAPSULE = 0.072
HAUT_CAPSULE = 0.045

# Le mât et la boule-caméra : le signe de la vision.
Z_MAT = -0.1
R_MAT = 0.026
R_BOULE = 0.066
Y_BOULE = 0.39
#: L'objectif : un disque sombre qui sort de la boule, la pupille de l'œil (en
#: graphite, comme celui du drone d'observation : en verre, il se lirait clair).
R_OBJECTIF = 0.032
EPAISSEUR_OBJECTIF = 0.05
SAILLIE_OBJECTIF = 0.012
#: Il regarde devant, tourné vers la droite du modèle et levé : il fait presque
#: face à la caméra des vues « droite » et « bas » — l'œil regarde le joueur, et
#: sa pupille ne tombe pas sur le mât.
CAP_OBJECTIF = 30.0
SITE_OBJECTIF = 30.0
#: Le berceau : une coupelle sombre sous la boule, qui la tient sur le mât.
JEU_BERCEAU = 0.008         # il déborde la boule d'autant
PART_BERCEAU = 0.3          # sa hauteur, en part du diamètre de la boule

# L'antenne, sur la plage, penchée vers l'arrière.
Z_ANTENNE = -0.25
X_ANTENNE = -0.05
HAUT_ANTENNE = 0.1
INCLINAISON_ANTENNE = -15.0


# ---------------------------------------------------------------------------
# La coque et le pont : des sections le long de z
# ---------------------------------------------------------------------------

def demi_largeur(z):
    """La demi-largeur de la coque au livet, vue de dessus."""
    if z >= Z_EPAULE:
        u = (z - Z_EPAULE) / (Z_ETRAVE - Z_EPAULE)
        w = DEMI_LARGEUR * (1 - min(1.0, u) ** POINTE)
    else:
        u = (z - Z_POUPE) / (Z_EPAULE - Z_POUPE)
        w = DEMI_LARGEUR_POUPE + (DEMI_LARGEUR - DEMI_LARGEUR_POUPE) * math.sin(u * math.pi / 2)
        d = z - Z_POUPE
        if d < ARRONDI_POUPE:
            v = (ARRONDI_POUPE - d) / ARRONDI_POUPE
            w -= ARRONDI_POUPE * (1 - math.sqrt(max(0.0, 1 - v * v)))
    return max(w, 0.006)


def livet(z):
    """La hauteur du livet (le bord du pont) : il monte vers l'étrave, et descend d'une marche sur la plage arrière."""
    u = (z - Z_POUPE) / (Z_ETRAVE - Z_POUPE)
    marche = MARCHE * (1 - b.lisse((z - Z_MARCHE_0) / (Z_MARCHE_1 - Z_MARCHE_0)))
    return Y_LIVET_POUPE + (Y_LIVET_ETRAVE - Y_LIVET_POUPE) * u ** TONTURE - marche


def quille(z):
    """Le bas de la coque : à l'eau, puis relevé en cuillère sous l'étrave."""
    if z <= Z_PIED:
        return 0.0
    v = min(1.0, (z - Z_PIED) / (Z_ETRAVE - Z_PIED))
    haut = livet(Z_ETRAVE) - HAUT_POINTE
    return haut * (1 - math.sqrt(max(0.0, 1 - v * v)))


def z_quille(y):
    """L'abscisse où la quille passe à la hauteur y, sous l'étrave."""
    haut = livet(Z_ETRAVE) - HAUT_POINTE
    v = math.sqrt(max(0.0, 1 - (1 - y / haut) ** 2))
    return Z_PIED + v * (Z_ETRAVE - Z_PIED)


def evasement(z):
    """La part dont la coque est plus étroite à la flottaison qu'au livet : un peu au milieu, en V à l'étrave."""
    return EVASEMENT + (EVASEMENT_ETRAVE - EVASEMENT) * b.lisse((z - Z_EPAULE) / (Z_ETRAVE - Z_EPAULE))


def flanc(z, y):
    """La demi-largeur du flanc à la hauteur y."""
    return demi_largeur(z) * (1 - evasement(z) * (1 - min(1.0, y / livet(z))))


def abscisses(z0, z1, n):
    """n + 1 abscisses de z0 à z1, resserrées vers les deux bouts (pas en cosinus) : les bouts arrondis n'y montrent pas de facettes."""
    return [z0 + (z1 - z0) * (1 - math.cos(math.pi * k / n)) / 2 for k in range(n + 1)]


def anneau_flanc(z, y0, y1):
    """La section de la coque en z, de y0 à y1 : un trapèze qui suit le flanc."""
    w0, w1 = flanc(z, y0), flanc(z, y1)
    return [(-w0, y0, z), (w0, y0, z), (w1, y1, z), (-w1, y1, z)]


def bombe(z):
    """Le bombé du pont au-dessus du livet : plat au milieu, qui s'amincit vers la pointe."""
    if z <= Z_BOMBE:
        return BOMBE
    return BOMBE + (BOMBE_ETRAVE - BOMBE) * b.lisse((z - Z_BOMBE) / (Z_ETRAVE - Z_BOMBE))


def exposant_pont(z):
    if z <= Z_BOMBE:
        return EXPOSANT_PONT
    return EXPOSANT_PONT + (EXPOSANT_ETRAVE - EXPOSANT_PONT) * b.lisse((z - Z_BOMBE) / (Z_ETRAVE - Z_BOMBE))


def anneau_pont(z, n=POINTS_SECTION):
    """
    La section du pont en z : le bombé en superellipse au-dessus du livet, et
    dessous le liston, droit, qui descend sur le flanc puis rentre sous la
    coque — il cache l'arrondi du haut de la coque.
    """
    a = flanc(z, livet(z)) + SAILLIE_PONT
    ym, hh, e = livet(z), bombe(z), exposant_pont(z)
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        if s >= 0:
            pts.append((a * math.copysign(abs(c) ** (2.0 / e), c), ym + hh * abs(s) ** (2.0 / e), z))
        else:
            pts.append((a * math.copysign(abs(c) ** (2.0 / EXPOSANT_JUPE), c), ym - JUPE_PONT * abs(s) ** (2.0 / EXPOSANT_JUPE), z))
    return pts


def profil_capsule(z):
    """La capsule : une pilule vue de dessus, bombée, posée sur l'axe du pont (le profil de `fuseau`)."""
    z0, z1 = Z_CAPSULE
    u = (2 * z - z0 - z1) / (z1 - z0)
    k = math.sqrt(max(0.0, 1 - u * u))
    return max(0.004, DEMI_LARGEUR_CAPSULE * k ** 0.6), livet(z) + bombe(z) - 0.006, max(0.003, HAUT_CAPSULE * k ** 0.5), 0.012


def y_dessus(z):
    """Le dessus du pont (ou de la capsule) sur l'axe, en z."""
    if Z_CAPSULE[0] < z < Z_CAPSULE[1]:
        _, ym, hh, _ = profil_capsule(z)
        return ym + hh
    return livet(z) + bombe(z)


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds. La coque (`base`) porte tout : c'est elle qui tangue ; le pont
    # (`corps`) lui est accroché ; le mât (`module_radar`) et l'antenne
    # (`module_antenne`) au pont ; la boule-caméra a son nœud à elle : elle
    # balaie l'horizon au repos.
    y_pied_mat = y_dessus(Z_MAT) - 0.01
    y_pied_antenne = livet(Z_ANTENNE) - 0.004
    f.noeud('base', pivot=(0, FLOTTAISON, 0))
    f.noeud('corps', parent='base', pivot=(0, livet(0.0), 0))
    f.noeud('module_radar', parent='corps', pivot=(0, y_pied_mat, Z_MAT))
    f.noeud('camera', parent='module_radar', pivot=(0, Y_BOULE, Z_MAT), mobile=True)
    f.noeud('module_antenne', parent='corps', pivot=(X_ANTENNE, y_pied_antenne, Z_ANTENNE))
    f.noeud('socle', pivot=(0, 0, 0))

    # La bande de flottaison, os : la coque entre l'eau et 3 cm, jusqu'où la
    # quille la quitte sous l'étrave.
    z_fin = z_quille(FLOTTAISON - 0.006)
    f.solide('base', [anneau_flanc(z, quille(z), FLOTTAISON) for z in abscisses(Z_POUPE, z_fin, SECTIONS)], 'os', fin=True, nom='flottaison')

    # La coque graphite, de la bande au livet ; son bas, arrondi, rentre dans la
    # bande, et son dessus fait la plage arrière.
    anneaux = [anneau_flanc(z, max(FLOTTAISON - 0.012, quille(z)), livet(z) - 0.002) for z in abscisses(Z_POUPE, Z_ETRAVE, SECTIONS)]
    f.solide('base', anneaux, 'graphite', nom='coque')

    # Le pont d'équipe, d'un seul tenant, de la marche à la pointe, et sa capsule.
    f.solide('corps', [anneau_pont(z) for z in abscisses(Z_MARCHE_0, Z_ETRAVE, SECTIONS)], 'equipe', nom='pont')
    f.fuseau('corps', profil_capsule, Z_CAPSULE[0], Z_CAPSULE[1], 'equipe', sections=48, exposants=(2.4, 4.0), nom='capsule', resserrement=1.0)

    # Le mât court, planté dans la capsule.
    y_haut_mat = Y_BOULE - 0.5 * R_BOULE
    f.cylindre('module_radar', (0, (y_pied_mat + y_haut_mat) / 2, Z_MAT), R_MAT, y_haut_mat - y_pied_mat, 'graphite', axe='y', nom='mat')

    # La boule-caméra os, son objectif sombre qui regarde le joueur, et le
    # berceau sombre qui la tient.
    centre = (0, Y_BOULE, Z_MAT)
    boule = f.boule('camera', centre, R_BOULE, 'os', nom='boule_camera')
    cap, site = math.radians(CAP_OBJECTIF), math.radians(SITE_OBJECTIF)
    visee = (-math.sin(cap) * math.cos(site), math.sin(site), math.cos(cap) * math.cos(site))
    avance = R_BOULE + SAILLIE_OBJECTIF - EPAISSEUR_OBJECTIF / 2
    f.cylindre('camera', tuple(c + avance * v for c, v in zip(centre, visee)), R_OBJECTIF, EPAISSEUR_OBJECTIF, 'graphite', axe=visee,
               nom='objectif')
    rb = R_BOULE + JEU_BERCEAU
    haut_b = 2 * R_BOULE * PART_BERCEAU + JEU_BERCEAU
    profil = [(max(0.004, math.sqrt(max(0.0, rb ** 2 - (rb - haut_b * i / 16) ** 2))), haut_b * i / 16) for i in range(17)]
    profil.append((0.004, haut_b))
    berceau = f.revolution('camera', (0, Y_BOULE - rb, Z_MAT), profil, 'graphite', nom='berceau')
    berceau.avec = boule.nom

    # L'antenne, courte, sur la plage arrière.
    f.antenne('module_antenne', (X_ANTENNE, y_pied_antenne, Z_ANTENNE), HAUT_ANTENNE, inclinaison=('x', INCLINAISON_ANTENNE), boule=False,
              nom='antenne')


def animer(f):
    # Repos : un léger tangage, et la boule-caméra qui balaie lentement l'horizon.
    r = f.clip('repos')
    b.balancer(r, 'base', 'x', 0.6, periodes=1)
    b.balancer(r, 'camera', 'y', 20.0, periodes=1)

    # Déplacement : l'étrave se lève sur l'arrière, la coque pilonne à peine,
    # l'antenne traîne.
    d = f.clip('deplacement')
    d.rotation('base', lambda t: ('x', -4.0), centre=(0, 0, Z_POUPE))
    b.balancer(d, 'base', 'x', 0.8, periodes=2)
    b.osciller(d, 'base', 'y', 0.004, periodes=2)
    b.balancer(d, 'module_antenne', 'x', -4.0, periodes=2, phase=1.0)

    # Touché : la coque roule et s'enfonce, la caméra sursaute, l'antenne fouette.
    k = f.clip('touche')
    b.secousse(k, 'base', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'base', '-y', 0.012)
    b.secousse(k, 'camera', 'y', 12.0, oscillations=3)
    b.secousse(k, 'module_antenne', 'x', 10.0, oscillations=2.5)

    # Hors jeu : la coque s'enfonce et gîte, le nez plonge ; le mât penche, la
    # caméra baisse les yeux vers l'eau, l'antenne se couche.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'base', descente=(0, -0.045, 0), rotation=('z', -9.0))
    b.affaisser(h, 'base', rotation=('x', 5.0), debut=0.1, duree=0.7)
    b.affaisser(h, 'module_radar', rotation=('z', -18.0), debut=0.15, duree=0.6)
    b.affaisser(h, 'camera', rotation=('x', 40.0), debut=0.2, duree=0.6)
    b.affaisser(h, 'module_antenne', rotation=('x', -30.0), debut=0.15, duree=0.6)
