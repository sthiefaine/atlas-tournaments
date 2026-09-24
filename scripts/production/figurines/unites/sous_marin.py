"""
Le sous-marin : un jouet de bain, long et bas, qui n'a sorti de l'eau que le
dos et sa tour.

Ce qui le dit à 48 pixels : un cigare long et bas dont seule la moitié haute
émerge — le dos arrondi à la couleur du camp du nez à la queue, un liseré
sombre qui s'épaissit vers l'avant, une bande de flottaison os au ras de
l'eau — ; un nez rond à droite, une queue en cône qui plonge sous un
gouvernail sombre dressé ; et son signe, un kiosque haut et arrondi, planté
vers l'avant, à deux petits ailerons, d'où sort un périscope coudé qui regarde
devant. Ni ailerons en croix ni ventre (le dirigeable), ni pont plat (la
barge), ni tourelle (le cuirassé), ni boule-caméra (le drone marin). Classe
moyenne, 0,78 à 0,80 case de large en vue « droite », contour compris.

Il plonge — on ne le voit qu'au contact —, mais on le montre en surface : rien
n'est modélisé sous la flottaison (y = 0).

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: La classe moyenne, sous le haut de la fourchette : plus court que la barge.
LARGEUR_VISEE = (0.78, 0.80)

# ---------------------------------------------------------------------------
# Les cotes, en mètres : tout se déduit d'elles.
# ---------------------------------------------------------------------------

# La coque : un cigare à mi-coque dans l'eau. Sa section est une demi-ellipse
# posée sur l'eau, qui suit un même facteur du nez à la queue : un nez rond,
# un corps droit, une queue en cône dont la pointe rentre dans l'eau.
Z_AR = -0.445               # la pointe de la queue
Z_AV = 0.39                 # le bout du nez
Z_EPAULE_AR = -0.1          # où la coque commence à s'effiler vers la queue
Z_EPAULE_AV = 0.25          # où le nez commence à s'arrondir
A = 0.108                   # demi-largeur au maître-couple
H = 0.1                     # hauteur hors de l'eau au maître-couple
EXPOSANT = 2.0              # la section : une demi-ellipse
NEZ = 2.2                   # l'arrondi du nez, vu de dessus et de côté (2 : un quart d'ellipse)
QUEUE = 1.6                 # la courbe du cône de queue
BOUT = 0.1                  # la pointe de la queue, en part du maître-couple
SECTIONS = 96
RESSERREMENT = 0.5

# Les trois bandes suivent la coque : la bande os au ras de l'eau, un liseré
# sombre, le dos d'équipe au-dessus. La coque sombre est la forme ; la
# ceinture os et le dos sont deux coques de même section et de même pas,
# l'une un peu plus large et plus basse, l'autre un peu plus étroite et plus
# haute, tirées pour croiser la coque sombre exactement à la part de hauteur
# voulue : chacune en ressort au-dessous (au-dessus) de sa ligne, et les
# surfaces s'y croisent sans marche ni rainure.
PART_FLOTTAISON = 0.31      # le haut de la bande os : 3,1 cm au maître-couple
#: La ligne du dos monte de la queue vers le nez, comme la tonture d'une
#: coque : le liseré sombre s'épaissit à l'avant, qui est en bas de l'image en
#: vue « droite », et s'amincit à l'arrière, en haut. C'est ce qui tient la masse
#: sombre en bas d'une coque qu'on voit en diagonale.
PART_DOS_QUEUE = 0.73
PART_DOS_NEZ = 0.85
SAILLIE_CEINTURE = 1.035    # la ceinture : 4 mm de plus que la coque au ras de l'eau
SAILLIE_DOS = 1.04          # le dos : 4 mm de plus au sommet

# Le kiosque : haut, arrondi, planté vers l'avant, le bord d'attaque couché.
# C'est le signe : bien plus haut qu'un vrai, pour dépasser de la coque à 48 px.
Z_KIOSQUE = 0.06            # le milieu de sa base
KIOSQUE_LONGUEUR = 0.2
KIOSQUE_LARGEUR = 0.1
Y_KIOSQUE_BAS = 0.08        # enfoncé dans le dos
Y_KIOSQUE_HAUT = 0.37
RECUL_KIOSQUE = 0.035       # le haut recule d'autant : le bord d'attaque se couche
RETRAIT_KIOSQUE = 0.008     # les flancs rentrent d'autant en montant

# Les ailerons de kiosque : une aile qui le traverse, haut et vers l'avant, au
# bord d'attaque rond. À la couleur du camp : sombres, ils faisaient sur la tour
# une tache qu'on lisait comme une écoutille.
Y_AILERONS = 0.295
Z_AILERONS = Z_KIOSQUE + 0.03   # le milieu de la corde
ENVERGURE_AILERONS = 0.22
CORDE_AILERONS = 0.1
EPAISSEUR_AILERONS = 0.052
FUITE_AILERONS = 0.012          # l'épaisseur du bord de fuite

# Le périscope : un mât qui sort du kiosque et un coude qui regarde devant.
Z_PERISCOPE = Z_KIOSQUE - 0.04
HAUTEUR_PERISCOPE = 0.11    # du haut du kiosque à l'axe du coude
R_MAT = 0.017
R_TETE = 0.028
LONGUEUR_TETE = 0.09
AVANCE_TETE = 0.022         # le milieu du coude, devant l'axe du mât
R_OCULAIRE = 0.019

# Le gouvernail : une dérive sombre dressée sur le cône de queue, balayée vers
# l'arrière ; son pied rentre dans le cône.
DERIVE = [(-0.32, 0.03), (-0.38, 0.1), (-0.413, 0.1), (-0.445, 0.005)]
EPAISSEUR_DERIVE = 0.05


# ---------------------------------------------------------------------------
# La coque et ses bandes
# ---------------------------------------------------------------------------

def facteur(z):
    """La taille de la section de la coque à l'abscisse z, en part du maître-couple."""
    if z >= Z_EPAULE_AV:
        u = min(1.0, (z - Z_EPAULE_AV) / (Z_AV - Z_EPAULE_AV))
        return max(0.0, 1 - u ** NEZ) ** (1 / NEZ)
    if z <= Z_EPAULE_AR:
        u = min(1.0, (Z_EPAULE_AR - z) / (Z_EPAULE_AR - Z_AR))
        return 1 - (1 - BOUT) * u ** QUEUE
    return 1.0


# Deux demi-superellipses de même exposant e, (a, h) et (ka·a, kh·h), se
# croisent là où Y = (y/h)^e vaut (1 − ka^−e) / (kh^−e − ka^−e) : on se donne
# l'un des deux facteurs, on tire l'autre de la part de hauteur où l'on veut le
# croisement.

def part_dos(z):
    """La ligne du dos à l'abscisse z, en part de la hauteur de la section : la tonture."""
    t = b.lisse((z - Z_AR) / (Z_AV - Z_AR))
    return PART_DOS_QUEUE + (PART_DOS_NEZ - PART_DOS_QUEUE) * t


def facteurs_dos(z):
    """Le dos : 4 % plus haut que la coque, sa largeur tirée pour la croiser à `part_dos(z)`."""
    e, y, kh = EXPOSANT, part_dos(z) ** EXPOSANT, SAILLIE_DOS
    return ((1 - y * kh ** -e) / (1 - y)) ** (-1 / e), kh


def facteurs_ceinture(z):
    """La ceinture : 3,5 % plus large que la coque, sa hauteur tirée pour la croiser à PART_FLOTTAISON."""
    e, y, ka = EXPOSANT, PART_FLOTTAISON ** EXPOSANT, SAILLIE_CEINTURE
    return ka, (ka ** -e + (1 - ka ** -e) / y) ** (-1 / e)


def coque(f, nom, teinte, bande=None):
    """Une coque de la famille : la section de la coque sombre, élargie et rehaussée par `bande(z)` → (ka, kh)."""
    def profil(z):
        k = facteur(z)
        ka, kh = bande(z) if bande else (1.0, 1.0)
        return max(A * k, 0.004) * ka, 0.0, max(H * k, 0.004) * kh, 0.0

    return f.fuseau('base', profil, Z_AR, Z_AV, teinte, sections=SECTIONS, exposants=(EXPOSANT, 2.0), nom=nom,
                    resserrement=RESSERREMENT)


def profil_aileron():
    """Le profil des ailerons vu de côté, points (z, y) : un bord d'attaque en demi-cercle, deux flancs qui s'effilent."""
    r = EPAISSEUR_AILERONS / 2
    z_centre = Z_AILERONS + CORDE_AILERONS / 2 - r     # le centre du bord d'attaque
    z_fuite = Z_AILERONS - CORDE_AILERONS / 2
    pts = [(z_fuite, Y_AILERONS + FUITE_AILERONS / 2)]
    for k in range(13):                                # du dessus au dessous, par l'avant
        a = math.pi / 2 - math.pi * k / 12
        pts.append((z_centre + r * math.cos(a), Y_AILERONS + r * math.sin(a)))
    pts.append((z_fuite, Y_AILERONS - FUITE_AILERONS / 2))
    return pts


def construire(f):
    # Les nœuds : la coque (`base`) porte tout et tangue ; le kiosque (`corps`)
    # lui est accroché ; le périscope (`module_antenne`) pivote sur son mât, et
    # il en a le droit au repos (`mobile`) : il y regarde autour de lui.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', parent='base', pivot=(0, Y_KIOSQUE_BAS, Z_KIOSQUE))
    f.noeud('module_antenne', parent='corps', pivot=(0, Y_KIOSQUE_HAUT, Z_PERISCOPE), mobile=True)
    f.noeud('socle', pivot=(0, 0, 0))

    # La coque sombre, la ceinture os au ras de l'eau, le dos d'équipe.
    coque(f, 'coque', 'graphite')
    coque(f, 'ceinture', 'os', facteurs_ceinture)
    coque(f, 'dos', 'equipe', facteurs_dos)

    # Le gouvernail : une dérive sombre sur le cône de queue, balayée vers l'arrière.
    f.prisme('base', DERIVE, EPAISSEUR_DERIVE, 'graphite', chanfrein=0.02, nom='gouvernail')

    # Le kiosque : haut et arrondi, le bord d'attaque couché, les flancs qui rentrent un peu.
    L, W = KIOSQUE_LONGUEUR, KIOSQUE_LARGEUR
    bas = b.contour_rectangle(0, Z_KIOSQUE, W, L, rayon=W / 2 - 0.001, n_coin=8)
    w2 = W - 2 * RETRAIT_KIOSQUE
    haut = b.contour_rectangle(0, Z_KIOSQUE - RECUL_KIOSQUE / 2, w2, L - RECUL_KIOSQUE, rayon=w2 / 2 - 0.001, n_coin=8)
    f.extrusion('corps', bas, haut, Y_KIOSQUE_BAS, Y_KIOSQUE_HAUT, 'equipe', chanfrein=0.03, nom='kiosque')

    # Les ailerons de kiosque : une aile qui le traverse, le bord d'attaque rond.
    f.prisme('corps', profil_aileron(), ENVERGURE_AILERONS, 'equipe', chanfrein=0.4 * EPAISSEUR_AILERONS, nom='ailerons')

    # Le périscope : un mât sombre, un coude qui regarde devant, un oculaire de verre.
    y_coude = Y_KIOSQUE_HAUT + HAUTEUR_PERISCOPE
    f.cylindre('module_antenne', (0, (Y_KIOSQUE_HAUT - 0.03 + y_coude) / 2, Z_PERISCOPE), R_MAT, y_coude - Y_KIOSQUE_HAUT + 0.03,
               'graphite', axe='y', fin=True, nom='mat')
    tete = f.capsule('module_antenne', (0, y_coude, Z_PERISCOPE + AVANCE_TETE), R_TETE, LONGUEUR_TETE, 'graphite', axe='z',
                     nom='tete')
    oculaire = f.cylindre('module_antenne', (0, y_coude, Z_PERISCOPE + AVANCE_TETE + LONGUEUR_TETE / 2 - 0.004), R_OCULAIRE, 0.02,
                          'verre', axe='z', nom='oculaire')
    oculaire.avec = tete.nom


def animer(f):
    # Repos : un très léger tangage, et le périscope qui regarde autour de lui.
    r = f.clip('repos')
    b.balancer(r, 'base', 'x', 0.45, periodes=1)
    b.balancer(r, 'module_antenne', 'y', 30.0, periodes=1)

    # Déplacement : la coque tangue un peu plus et pilonne à peine.
    d = f.clip('deplacement')
    b.balancer(d, 'base', 'x', 1.4, periodes=1)
    b.osciller(d, 'base', 'y', 0.004, periodes=2)

    # Tir : la torpille part sous l'eau ; la coque cabre et recule d'un coup.
    t = f.clip('tir')
    b.a_coup(t, 'base', 'x', -2.5, attaque=0.07, retour=0.45)
    b.sursaut(t, 'base', '-z', 0.012)

    # Touché : la coque roule et s'enfonce, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'base', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'base', '-y', 0.012)

    # Hors jeu : la coque s'enfonce du nez et gîte, le périscope se couche.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'base', descente=(0, -0.03, 0), rotation=('x', 5.0))
    b.affaisser(h, 'base', rotation=('z', -6.0), debut=0.1, duree=0.7)
    b.affaisser(h, 'module_antenne', rotation=('x', 35.0), debut=0.2, duree=0.55)
