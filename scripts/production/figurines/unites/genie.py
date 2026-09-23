"""
Le génie de terrain : l'ouvrier de la boîte. Il ne se bat pas, il remet les
bâtiments en service.

Ce qui le dit à 48 pixels : un casque de chantier à bord, repoussé sur la
nuque, et un gilet de travail à la couleur du camp ; un visage clair dessous ;
une grande clé plate os levée à côté de la tête, la tête ronde fendue en U ;
une caisse à outils os au bout de l'autre bras, son petit détecteur graphite
posé sur le couvercle. Les manches, le pantalon et les bottes sont sombres : le
sombre tient le bas, l'équipe le haut — c'est aussi ce qui le sépare de
l'infanterie et du méca, d'équipe de la tête aux chevilles.

La figurine est celle de la bibliothèque (`fantassin`), à ses proportions et
son visage par défaut : seuls la tenue, le couvre-chef, l'outil et la pose
changent. Les bras sont remodelés dans leur pose (un nœud n'a jamais de
rotation au repos) ; la jambe droite recule d'un demi-pas, ce qui rend à la
clé la hauteur qu'elle prend en vue « droite ».

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bpy
from mathutils import Matrix, Vector

import bibliotheque as b

# ---------------------------------------------------------------------------
# La figurine de la bibliothèque, à ses proportions par défaut.
# ---------------------------------------------------------------------------

HAUTEUR = 0.8
TETES = 4.25
TETE = HAUTEUR / TETES
R_TETE = TETE * 0.5
R_BRAS = max(0.28 * TETE, 0.025)      # la formule de `fantassin`
R_MAIN = R_BRAS * 1.15

# La tenue : un gilet de chantier à la couleur du camp, sur une chemise et un
# pantalon sombres. Avec le casque, le gilet porte la moitié de l'image.
MANCHES = 'graphite'
PANTALON = 'graphite'

# La jambe droite recule d'un demi-pas (mètres) : la botte droite, la plus
# basse de la vue « droite », remonte à l'écran.
PAS_DROIT = (0.015, -0.05)

# ---------------------------------------------------------------------------
# Le casque de chantier, posé haut sur la tête et repoussé en arrière.
# ---------------------------------------------------------------------------

CASQUE_HAUSSE = 0.03                  # le dessous du bord, au-dessus du centre de la tête
CASQUE_RECUL = 0.012                  # et un peu en arrière de lui
CASQUE_INCLINAISON = 22.0             # degrés : l'avant droit se relève, le visage sort dessous
CASQUE_AXE = (0.78, 0.0, 0.62)        # l'axe de cette bascule (le bord monte vers l'avant droit)
DOME = (1.1 * R_TETE, 1.16 * R_TETE, 0.9 * R_TETE)     # demi-largeur, demi-longueur, hauteur au-dessus du bord
BORD = (1.42 * R_TETE, 1.48 * R_TETE, 0.024)           # demi-largeur, demi-longueur, épaisseur
BORD_AVANT = 1.3 * R_TETE             # l'avant du bord : une lèvre courte, que la bascule relève
ARETE = 0.016                         # l'arête qui court sur le dessus, d'avant en arrière

# ---------------------------------------------------------------------------
# Le bras gauche levé et la clé ; le bras droit et la caisse. Les points sont
# donnés depuis l'épaule (le haut du bras de la bibliothèque), en mètres.
# ---------------------------------------------------------------------------

COUDE_G = (0.03, -0.136, 0.05)
POING_G = (-0.01, -0.086, 0.1)        # à hauteur de poitrine, devant l'épaule

CLE_MANCHE = 0.052                    # largeur du manche
CLE_TETE = 0.136                      # diamètre de la tête
CLE_TETE_CENTRE = 0.2                 # hauteur du centre de la tête au-dessus du poing
CLE_FENTE = 0.05                      # largeur de la fente
CLE_FENTE_FOND = 0.202                # le fond de la fente, au-dessus du poing
CLE_EPAISSEUR = 0.05                  # l'épaisseur minimale de la charte : une clé de jouet
CLE_ROTATION = [('y', 50)]            # la face plate vers la caméra, entre les vues « droite » et « bas »

POING_D = (-0.005, -0.186, 0.1)       # le bras droit tombe, un peu en avant
CAISSE = (-0.012, -0.276, 0.112)      # la caisse pend sous le poing, au-dessus des bottes
CAISSE_TAILLE = (0.064, 0.078, 0.152)
DETECTEUR_TAILLE = (0.052, 0.05, 0.05)


# ---------------------------------------------------------------------------
# Les aides locales : ce que la pose demande et que la bibliothèque n'a pas.
# ---------------------------------------------------------------------------

def _retirer(f, noeud, noms):
    """Retire des pièces que `fantassin` a posées : celles que la pose remplace."""
    n = f.noeuds[noeud]
    for p in list(n.pieces):
        if p.nom in noms:
            bpy.data.objects.remove(p.objet, do_unlink=True)
            n.pieces.remove(p)


def _teindre(f, noeud, noms, teinte):
    """Change la teinte de pièces déjà posées : la tenue de l'unité."""
    f._verifier_teinte(teinte)
    for p in f.noeuds[noeud].pieces:
        if p.nom in noms:
            p.teinte = teinte


def _decaler(f, noeud, dx=0.0, dz=0.0):
    """Déplace un nœud et ses pièces déjà posées, pivot compris (une jambe qui recule d'un demi-pas)."""
    n = f.noeuds[noeud]
    t = Matrix.Translation(b.vb((dx, 0.0, dz)))
    for p in n.pieces:
        p.objet.matrix_world = t @ p.objet.matrix_world
    n.pivot = (n.pivot[0] + dx, n.pivot[1], n.pivot[2] + dz)


def _membre(f, noeud, a, c, rayon, teinte, nom):
    """Un segment de membre d'une articulation à l'autre : une capsule dont les bouts ronds tombent sur les articulations."""
    va, vc = Vector(a), Vector(c)
    d = vc - va
    return f.capsule(noeud, tuple((va + vc) / 2), rayon, d.length + 2 * rayon, teinte, axe=tuple(d.normalized()), nom=nom)


def _plaque(f, noeud, profil, epaisseur, origine, rotations, teinte, nom):
    """
    Un profil plat (u, v) extrudé sur `epaisseur` : au repos, u le long de z,
    v le long de y, l'épaisseur le long de x ; le point (0, 0) du profil est
    posé à `origine`, la pièce tournée par `rotations` (liste de (axe, degrés)).
    C'est `prisme`, qu'on peut tourner.
    """
    bm = b.bm_prisme([(-u, v) for u, v in profil], epaisseur)
    placement = Matrix.Translation(b.vb(origine)) @ f._rotation_modele(rotations)
    us = [u for u, _ in profil]
    vs = [v for _, v in profil]
    return f._piece(bm, noeud, teinte, placement, (epaisseur, max(vs) - min(vs), max(us) - min(us)), None, nom=nom)


def _profil_cle():
    """
    La clé plate, vue de face : un manche au bout rond, une tête ronde fendue
    d'un U ouvert vers le haut — le dessin de toutes les clés. Le poing tient
    (0, 0) ; la tête est au-dessus.
    """
    r = CLE_MANCHE / 2
    bas = -0.045
    hc, rh, wn, fond = CLE_TETE_CENTRE, CLE_TETE / 2, CLE_FENTE / 2, CLE_FENTE_FOND
    pts = []
    for k in range(7):                                    # le bout du manche, de la droite à la gauche
        a = math.radians(-180 * k / 6)
        pts.append((r * math.cos(a), bas + r + r * math.sin(a)))
    col = hc - rh * 0.72 - 0.03
    pts.append((-r, col))                                 # le manche, à gauche, jusqu'au col
    fente = math.degrees(math.asin(wn / rh))
    depart = 180 + math.degrees(math.acos(r / rh * 1.25))
    for k in range(9):                                    # la tête, côté gauche, jusqu'à la fente
        a = math.radians(depart + (90 + fente - depart) * k / 8)
        pts.append((rh * math.cos(a), hc + rh * math.sin(a)))
    pts += [(-wn, fond), (wn, fond)]                      # le fond de la fente
    for k in range(9):                                    # la tête, côté droit, de la fente au col
        a = math.radians(90 - fente - (360 - depart - (90 - fente)) * k / 8)
        pts.append((rh * math.cos(a), hc + rh * math.sin(a)))
    pts.append((r, col))                                  # le manche, à droite
    return pts


def _casque_chantier(f, noeud, base, nom='casque'):
    """
    Le casque de chantier, d'un seul tenant : un dôme haut marqué d'une arête,
    et un bord tout autour, large sur les côtés et derrière, court devant.
    Posé haut et repoussé en arrière, comme un vrai casque sur sa coiffe :
    sous la caméra inclinée à 50°, le visage reste nu dessous.
    """
    n = 64
    angles = [2 * math.pi * i / n for i in range(n)]
    dx, dz, dh = DOME
    bx, bz, e = BORD
    zb = BORD_AVANT - bz                                  # le bord est un peu décentré vers l'arrière

    def anneau(y, ax, az, zc, arete=0.0):
        pts = []
        for a in angles:
            x, z = ax * math.cos(a), zc + az * math.sin(a)
            pts.append(b.vb((x, y + arete * math.exp(-(x / 0.026) ** 2), z)))
        return pts

    anneaux = [anneau(0.0, bx, bz, zb), anneau(e, bx - 0.003, bz - 0.003, zb), anneau(e + 0.004, dx, dz, 0.0)]
    for deg in (20, 40, 58, 73, 86):
        a = math.radians(deg)
        k = math.cos(a)
        anneaux.append(anneau(e + 0.004 + dh * math.sin(a), dx * k, dz * k, 0.0, arete=ARETE * math.sin(a) ** 2))
    bm = b.bmesh.new()
    b._solide_anneaux(bm, anneaux)
    placement = Matrix.Translation(b.vb(base)) @ f._rotation_modele([(CASQUE_AXE, -CASQUE_INCLINAISON)])
    return f._piece(bm, noeud, 'equipe', placement, (2 * bx, e + 0.004 + dh, 2 * bz), None, nom=nom)


def _depuis(origine, decalage):
    return tuple(o + d for o, d in zip(origine, decalage))


# ---------------------------------------------------------------------------
# La construction
# ---------------------------------------------------------------------------

def construire(f):
    n = f.fantassin(hauteur=HAUTEUR, tetes=TETES, peau='peau_genie', tenue='equipe', bas='graphite', couvre_chef=None)

    # Ce que la figurine a posé, lu sur ses nœuds plutôt que deviné : le cou,
    # d'où la tête, et les épaules, d'où le haut de chaque bras.
    cou = f.noeuds[n['tete']].pivot
    centre_tete = (cou[0], cou[1] + R_TETE * 0.95, cou[2] + 0.01)

    def epaule(noeud, cote):
        p = f.noeuds[noeud].pivot
        return (p[0] + cote * R_BRAS * 0.6, p[1] - R_BRAS * 0.5, p[2])

    # Le pantalon sombre, et le demi-pas de la jambe droite.
    _teindre(f, n['jambe_g'], {'fantassin_jambe_g'}, PANTALON)
    _teindre(f, n['jambe_d'], {'fantassin_jambe_d'}, PANTALON)
    _decaler(f, n['jambe_d'], dx=PAS_DROIT[0], dz=PAS_DROIT[1])

    # Le casque de chantier.
    _casque_chantier(f, n['tete'], (centre_tete[0], centre_tete[1] + CASQUE_HAUSSE, centre_tete[2] - CASQUE_RECUL))

    # Le bras gauche levé, remodelé dans sa pose, et la grande clé : elle a son
    # nœud, au poing, pour le coup de poignet de la frappe et pour retomber.
    eg = epaule(n['bras_g'], 1)
    coude_g, poing_g = _depuis(eg, COUDE_G), _depuis(eg, POING_G)
    _retirer(f, n['bras_g'], {'fantassin_bras_g', 'fantassin_main_g'})
    _membre(f, n['bras_g'], eg, coude_g, R_BRAS, MANCHES, 'bras_g_haut')
    _membre(f, n['bras_g'], coude_g, poing_g, R_BRAS * 0.95, MANCHES, 'bras_g_avant')
    f.boule(n['bras_g'], poing_g, R_MAIN, 'peau_genie', nom='main_g')
    f.noeud('cle', parent=n['bras_g'], pivot=poing_g)
    _plaque(f, 'cle', _profil_cle(), CLE_EPAISSEUR, poing_g, CLE_ROTATION, 'os', 'cle')

    # Le bras droit porte la caisse à outils ; le détecteur (le nœud
    # `module_radar` de la fiche) est posé sur le couvercle, devant le poing.
    ed = epaule(n['bras_d'], -1)
    poing_d, caisse = _depuis(ed, POING_D), _depuis(ed, CAISSE)
    _retirer(f, n['bras_d'], {'fantassin_bras_d', 'fantassin_main_d'})
    _membre(f, n['bras_d'], ed, poing_d, R_BRAS, MANCHES, 'bras_d')
    f.boule(n['bras_d'], poing_d, R_MAIN, 'peau_genie', nom='main_d')
    f.boite(n['bras_d'], caisse, CAISSE_TAILLE, 'os', nom='caisse')
    _, ly, lz = DETECTEUR_TAILLE
    detecteur = (caisse[0], caisse[1] + CAISSE_TAILLE[1] / 2 + ly / 2 - 0.006, caisse[2] + CAISSE_TAILLE[2] / 2 - lz / 2 - 0.004)
    f.noeud('module_radar', parent=n['bras_d'], pivot=detecteur)
    f.boite('module_radar', detecteur, DETECTEUR_TAILLE, 'graphite', nom='detecteur')
    f.antenne('module_radar', base=(detecteur[0] - 0.01, detecteur[1] + ly / 2 - 0.005, detecteur[2] + 0.008), hauteur=0.065,
              nom='detecteur_antenne')


# ---------------------------------------------------------------------------
# Les clips
# ---------------------------------------------------------------------------

def _frappe(clip, noeud, axe, elan, coup, debut=0.0, t_elan=0.14, t_coup=0.08, retour=0.4):
    """Un coup d'outil : l'élan (jusqu'à `elan` degrés), la frappe (jusqu'à `coup`), puis le retour en douceur au repos."""
    def f(t):
        u = t - debut
        if u <= 0:
            return (axe, 0.0)
        if u < t_elan:
            return (axe, elan * b.lisse(u / t_elan))
        if u < t_elan + t_coup:
            return (axe, elan + (coup - elan) * math.sin(0.5 * math.pi * (u - t_elan) / t_coup))
        return (axe, coup * (1 - b.lisse((u - t_elan - t_coup) / retour)))

    clip.rotation(noeud, f)


def animer(f):
    # Repos : une respiration, l'outil tenu levé.
    b.respirer(f.clip('repos'), 'corps', 0.012)

    # Déplacement : une marche d'ouvrier ; la caisse balance, la clé reste levée et dodeline à peine.
    d = f.clip('deplacement')
    b.balancer(d, 'jambe_g', 'x', 18, periodes=1)
    b.balancer(d, 'jambe_d', 'x', -18, periodes=1)
    b.balancer(d, 'bras_d', 'x', 12, periodes=1)
    b.balancer(d, 'bras_g', 'x', 4, periodes=2)
    b.osciller(d, 'corps', 'y', 0.007, periodes=2)
    b.balancer(d, 'corps', 'z', 2.0, periodes=1)

    # Tir : le génie ne tire pas, il frappe. L'élan en arrière, le coup de clé
    # vers l'avant avec un coup de poignet, le buste qui accompagne.
    t = f.clip('tir')
    _frappe(t, 'bras_g', 'x', -26.0, 48.0, debut=0.02)
    _frappe(t, 'corps', 'x', -3.0, 7.0, debut=0.02)
    _frappe(t, 'cle', 'x', -10.0, 30.0, debut=0.04)

    # Touché : il recule d'un rien, le buste vacille, le casque avec lui.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'x', -7.0, oscillations=2)
    b.sursaut(k, 'corps', '-z', 0.02)
    b.secousse(k, 'tete', 'z', 4.0, debut=0.04, oscillations=2)

    # Hors jeu : il tombe à genoux, comme les deux autres fantassins ; le bras
    # retombe, la clé glisse dans le poing et pend, la tête s'incline.
    h = f.clip('hors_jeu')
    angle = 60.0
    descente = 0.43 * HAUTEUR * (1 - math.cos(math.radians(angle)))   # la hanche de `fantassin` est à 0,43 H
    b.affaisser(h, 'jambe_g', rotation=('x', angle))
    b.affaisser(h, 'jambe_d', rotation=('x', angle))
    b.affaisser(h, 'base', descente=(0, -descente, 0))
    b.affaisser(h, 'corps', descente=(0, -descente, 0), rotation=('x', 12.0))
    b.affaisser(h, 'bras_g', rotation=('x', 55.0), debut=0.15, duree=0.6)
    b.affaisser(h, 'cle', rotation=('x', 120.0), debut=0.3, duree=0.45)
    b.affaisser(h, 'bras_d', rotation=('z', -8.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'tete', rotation=('x', 16.0), debut=0.25, duree=0.55)
