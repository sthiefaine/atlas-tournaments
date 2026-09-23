"""
Le drone intercepteur : une étoile de jouet qui chasse dans le ciel.

Ce qui le dit à 48 pixels : une étoile à quatre branches épaisses, aux flancs
bombés et aux pointes franches — le shuriken que le panel a gardé —, entière à
la couleur du camp sur son dessus, et bordée d'un ventre sombre qui en dessine
le contour quelle que soit la couleur du camp ; au centre, un cœur sombre, le
petit radar ; et son signe, commun à ce qui tire en l'air : deux mini-missiles
clairs dressés vers le ciel, à ailerons sombres. Ni verrière (personne à
bord), ni hélice : les petites hélices aux pointes, essayées, brouillaient
l'étoile. Classe petite : 0,62 à 0,66 case de large en vue « droite », contour
compris, en vol à 0,25 m.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Trois choix que la mesure a tranchés :

- Les missiles sont **debout**, pas penchés à 60–70° vers l'avant comme les
  canons de l'anti-air. En vue « droite » (lacet 60°, tangage 50°), l'écart
  entre deux missiles de part et d'autre de l'axe se projette à 53° sur
  l'écran, et un missile levé à 65° vers l'avant à 49° : les deux se
  recouvraient et se lisaient comme un seul, posé en travers de l'aile
  gauche. Debout, ils sont côte à côte dans toutes les vues.
- Les pointes sont celles d'une parabole (demi-largeur ∝ (1 − u/L)^0,7), pas
  d'une ellipse : en demi-ellipses, l'étoile se lisait comme une étoile de mer.
- Le dessus d'équipe est rentré de 3 cm sur le ventre sombre : ce bord,
  plus le contour de la cuisson, garde l'étoile nette en Islande comme en
  Nouvelle-Zélande, et ramène l'équipe de 62 % à la bande de la charte.
"""

import math

import bibliotheque as b

#: Le milieu de la classe petite.
LARGEUR_VISEE = (0.62, 0.66)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.25                    # bas de la silhouette au repos (charte : drones à 0,25 m)

#: L'étoile vue de dessus : quatre pétales, du centre à leur pointe —
#: (direction en degrés, de l'avant vers la gauche du modèle ; longueur du
#: centre à la pointe ; demi-largeur au centre). Le nez un peu plus long : il
#: vise.
BRANCHES = (
    (0.0, 0.36, 0.155),       # le nez
    (90.0, 0.335, 0.155),     # l'aile gauche
    (180.0, 0.33, 0.155),     # la queue
    (270.0, 0.335, 0.155),    # l'aile droite
)
#: Le profil d'un pétale : sa demi-largeur à la distance u du centre vaut
#: demi · (1 − (u / longueur)^p)^q. (2 ; 0,5) serait une demi-ellipse, pointe
#: ronde ; (1 ; 0,7), des flancs bombés et une pointe franche.
PROFIL_PETALE = (1.0, 0.7)
#: L'exposant du maximum adouci qui unit les pétales : plus petit, des creux plus ronds.
DOUCEUR = 10
POINTS = 256                  # points d'un contour de l'étoile

# Le ventre sombre, puis le dessus d'équipe posé dessus, en retrait : un bord
# sombre tout autour. Chaque dalle : ses contours (retrait, échelle, hauteur),
# du dessous vers le dessus.
VENTRE = (
    (0.0, 0.78, ALT),                 # le dessous, plus petit : il se cache sous l'étoile
    (0.0, 1.0, ALT + 0.022),
    (0.0, 1.0, ALT + 0.036),
)
RETRAIT_BORD = 0.03                   # le dessus d'équipe rentre d'autant : c'est le bord sombre
EPAULE = 0.02                         # et encore d'autant en haut : une épaule qui prend la lumière
DESSUS = (
    (RETRAIT_BORD, 1.0, ALT + 0.03),
    (RETRAIT_BORD, 1.0, ALT + 0.058),  # le flanc d'équipe : c'est lui qu'on voit de profil
    (RETRAIT_BORD + EPAULE, 1.0, ALT + 0.074),
)
Y_DESSUS = DESSUS[-1][2]
#: Le dessous et le dessus d'une dalle se referment à plat par ces contours
#: ramenés vers le centre : des quadrilatères en rayons, au lieu d'un polygone
#: concave de 256 côtés triangulé en lames.
ECHELLES_COUVERCLE = (0.7, 0.42, 0.18, 0.02)

# Le cœur : un dôme sombre, le petit radar.
R_COEUR = 0.08
H_COEUR = 0.05

# Les missiles, debout de part et d'autre du cœur.
R_MISSILE = 0.032
L_MISSILE = 0.25
X_MISSILE = 0.12
#: Les ailerons : (hauteur à l'emplanture, hauteur au saillant, saillie au-delà du fût, épaisseur).
AILERONS = (0.085, 0.04, 0.032, 0.014)


# ---------------------------------------------------------------------------
# L'étoile
# ---------------------------------------------------------------------------

def _rayon_petale(d, longueur, demi):
    """Le rayon d'un pétale dans la direction `d` (radians depuis son axe, |d| < π/2) : où le rayon croise son bord."""
    p, q = PROFIL_PETALE
    tan = math.tan(abs(d))
    bas, haut = 0.0, longueur
    for _ in range(40):
        u = (bas + haut) / 2
        h = demi * max(0.0, 1 - (u / longueur) ** p) ** q
        if h > u * tan:
            bas = u
        else:
            haut = u
    return (bas + haut) / 2 / math.cos(d)


def _rayon(theta, retrait=0.0):
    """
    Le rayon de l'étoile dans la direction `theta` (radians, de l'avant vers la
    gauche), ses pétales rentrés de `retrait` — plus courts et plus minces
    d'autant : un contour parallèle qui ne se replie jamais sur une pointe,
    ce qu'un décalage le long des normales faisait dès que le retrait passait
    le rayon d'une pointe.
    """
    s = 0.0
    for phi, longueur, demi in BRANCHES:
        d = (theta - math.radians(phi) + math.pi) % (2 * math.pi) - math.pi
        if abs(d) >= math.pi / 2 - 1e-6:
            continue
        s += _rayon_petale(d, longueur - retrait, demi - retrait) ** DOUCEUR
    return s ** (1.0 / DOUCEUR)


def _directions_etoile():
    """
    Les directions (radians) des `POINTS` points d'un contour de l'étoile :
    régulièrement espacés le long de son bord (les pointes ne sont pas plus
    grossières que les creux), le premier sur la pointe du nez, dans le sens de
    `contour_rectangle`. Tous les contours de l'étoile — le ventre, le dessus,
    leurs retraits — prennent les mêmes : leurs points se répondent un à un.
    """
    m = 4096
    dense = []
    for k in range(m + 1):
        t = -2 * math.pi * k / m
        r = _rayon(t)
        dense.append((r * math.sin(t), r * math.cos(t), t))
    longueurs = [0.0]
    for k in range(1, m + 1):
        a, c = dense[k - 1], dense[k]
        longueurs.append(longueurs[-1] + math.hypot(c[0] - a[0], c[1] - a[1]))
    total = longueurs[-1]
    thetas = []
    j = 0
    for i in range(POINTS):
        cible = total * i / POINTS
        while longueurs[j + 1] < cible:
            j += 1
        u = (cible - longueurs[j]) / max(1e-12, longueurs[j + 1] - longueurs[j])
        thetas.append(dense[j][2] + (dense[j + 1][2] - dense[j][2]) * u)
    return thetas


def _contour(thetas, retrait=0.0, echelle=1.0):
    """Le contour de l'étoile (x, z), pétales rentrés de `retrait`, puis ramené vers le centre par une homothétie d'`echelle`."""
    pts = []
    for t in thetas:
        r = echelle * _rayon(t, retrait)
        pts.append((r * math.sin(t), r * math.cos(t)))
    return pts


def _anneau(points, y):
    return [(x, y, z) for x, z in points]


def _le_long(p, d, t):
    return tuple(a + t * c for a, c in zip(p, d))


def _unitaire(v):
    n = math.sqrt(sum(c * c for c in v))
    return tuple(c / n for c in v)


# ---------------------------------------------------------------------------
# Les pièces
# ---------------------------------------------------------------------------

def dalle(f, noeud, thetas, contours, teinte, nom):
    """
    Une dalle en étoile : ses `contours` (retrait, échelle, hauteur), du
    dessous vers le dessus, et le dessous comme le dessus refermés à plat par
    des contours ramenés vers le centre (`ECHELLES_COUVERCLE`).
    """
    r0, e0, y0 = contours[0]
    r1, e1, y1 = contours[-1]
    anneaux = [_anneau(_contour(thetas, r0, e0 * k), y0) for k in reversed(ECHELLES_COUVERCLE)]
    anneaux += [_anneau(_contour(thetas, r, e), y) for r, e, y in contours]
    anneaux += [_anneau(_contour(thetas, r1, e1 * k), y1) for k in ECHELLES_COUVERCLE]
    return f.solide(noeud, anneaux, teinte, nom=nom)


def missile(f, noeud, pied, axe, nom):
    """
    Un mini-missile clair : un fût à l'ogive pointue, le long de `axe` depuis
    `pied`, sa bague sombre au pied et quatre ailerons sombres — c'est eux qui
    en font une fusée plutôt qu'une bougie. Bague et ailerons font corps avec
    le fût : ils sont jugés avec lui.
    """
    profil = [
        (R_MISSILE * 0.8, 0.0),
        (R_MISSILE, 0.012),
        (R_MISSILE, L_MISSILE * 0.6),
        (R_MISSILE * 0.86, L_MISSILE * 0.75),
        (R_MISSILE * 0.55, L_MISSILE * 0.9),
        (R_MISSILE * 0.12, L_MISSILE),
    ]
    corps = f.revolution(noeud, pied, profil, 'os', axe=axe, nom=nom)
    bague = f.cylindre(noeud, _le_long(pied, axe, 0.02), R_MISSILE * 1.1, 0.05, 'graphite', axe=axe, nom=f'{nom}_bague')
    bague.avec = corps.nom
    # Les ailerons : quatre plaques en flèche, en croix avec les axes du modèle.
    h0, h1, saillie, epaisseur = AILERONS
    a = axe
    for k in range(4):
        ang = math.radians(90 * k)
        d = (math.sin(ang), 0.0, math.cos(ang))
        p = sum(x * y for x, y in zip(d, a))
        d = _unitaire(tuple(x - p * y for x, y in zip(d, a)))
        n = _unitaire((a[1] * d[2] - a[2] * d[1], a[2] * d[0] - a[0] * d[2], a[0] * d[1] - a[1] * d[0]))
        trapeze = [(R_MISSILE * 0.7, 0.0), (R_MISSILE * 0.7, h0), (R_MISSILE + saillie, h1 * 0.5), (R_MISSILE + saillie, -0.005)]
        anneaux = [[tuple(pied[i] + r * d[i] + h * a[i] + s * epaisseur * n[i] for i in range(3)) for r, h in trapeze]
                   for s in (-0.5, 0.5)]
        aileron = f.solide(noeud, anneaux, 'graphite', fin=True, nom=f'{nom}_aileron_{k}')
        aileron.avec = corps.nom
    return corps


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    thetas = _directions_etoile()

    # Les nœuds. Le canon dit « base : ailes, corps : capsule » : la base est
    # l'étoile, accrochée au corps pour pencher avec lui ; le radar est le
    # cœur ; chaque missile a son nœud, pour partir.
    f.noeud('corps', pivot=(0, Y_DESSUS, 0))
    f.noeud('base', parent='corps', pivot=(0, Y_DESSUS, 0))
    f.noeud('module_radar', parent='corps', pivot=(0, Y_DESSUS, 0))
    f.noeud('socle', pivot=(0, 0, 0))

    # L'étoile : le ventre sombre, et le dessus d'équipe posé dessus, en retrait du bord.
    # Les deux font un seul corps de 7,4 cm : chacun est jugé avec l'autre.
    ventre = dalle(f, 'base', thetas, VENTRE, 'graphite', 'ventre')
    dessus = dalle(f, 'base', thetas, DESSUS, 'equipe', 'dessus')
    dessus.avec = ventre.nom
    ventre.avec = dessus.nom

    # Le cœur : un dôme sombre, le petit radar.
    f.revolution('module_radar', (0, Y_DESSUS - 0.01, 0), [
        (R_COEUR, 0.0), (R_COEUR, 0.012), (R_COEUR * 0.82, H_COEUR * 0.7), (R_COEUR * 0.45, H_COEUR), (0.006, H_COEUR + 0.004),
    ], 'graphite', nom='coeur')

    # Les deux missiles, debout de part et d'autre du cœur.
    for cote in (1, -1):
        c = 'g' if cote > 0 else 'd'
        pied = (cote * X_MISSILE, Y_DESSUS - 0.01, 0.0)
        f.noeud(f'missile_{c}', parent='corps', pivot=pied)
        missile(f, f'missile_{c}', pied, (0.0, 1.0, 0.0), f'missile_{c}')


def animer(f):
    # Repos : un vol calme — l'étoile monte et descend de quelques millimètres.
    b.osciller(f.clip('repos'), 'corps', 'y', 0.005, periodes=1)

    # Déplacement : elle pique du nez pour filer, et roule à peine.
    d = f.clip('deplacement')
    d.rotation('corps', lambda t: ('x', 5.0))
    b.balancer(d, 'corps', 'z', 1.5, periodes=1)
    b.osciller(d, 'corps', 'y', 0.005, periodes=2)

    # Tir : le missile droit — celui qu'on voit devant — monte droit vers le
    # ciel, un rien vers l'avant, dans sa propre colonne de l'image (en biais,
    # il passait devant le cœur et l'autre missile), garde sa taille sur trois
    # images puis s'efface ; l'étoile encaisse le départ ; un autre missile
    # remonte sur son rail avant la fin du clip.
    t = f.clip('tir')
    envol = _unitaire((0.0, 1.0, 0.25))
    depart, vol, course, recharge = 0.04, 0.32, 0.34, 0.2

    def trajet(tt):
        if tt < depart:
            return (0.0, 0.0, 0.0)
        if tt < depart + vol:
            k = ((tt - depart) / vol) ** 1.3 * course
        elif tt < t.duree - recharge:
            k = course
        else:
            k = 0.0
        return tuple(c * k for c in envol)

    def taille(tt):
        if tt < depart:
            e = 1.0
        elif tt < depart + vol:
            u = (tt - depart) / vol
            e = 1.0 - 0.95 * b.lisse((u - 0.5) / 0.5)
        elif tt < t.duree - recharge:
            e = 0.05
        else:
            e = 0.05 + 0.95 * b.lisse((tt - (t.duree - recharge)) / recharge)
        return (e, e, e)

    t.translation('missile_d', trajet)
    t.echelle('missile_d', taille)
    b.a_coup(t, 'corps', 'z', 4.0, debut=depart, attaque=0.06, retour=0.4)
    b.recul(t, 'corps', '-y', 0.012, debut=depart, attaque=0.06, retour=0.4)

    # Touché : l'étoile vacille et plonge un instant, puis se reprend.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 9.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)

    # Hors jeu : elle s'affaisse de biais, le nez bas, et reste posée ainsi.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.11, 0), rotation=('z', 14.0))
    b.affaisser(h, 'corps', rotation=('x', 8.0), debut=0.1, duree=0.7)
