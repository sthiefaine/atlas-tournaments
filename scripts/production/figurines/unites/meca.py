"""
Le méca : le fantassin lourd. Le même soldat de jouet que l'infanterie, en
plus trapu, et son signe : un gros tube lance-roquettes posé sur l'épaule
droite, qui dépasse devant et derrière.

Ce qui le dit à 48 pixels : un casque et un gilet épais à la couleur du camp
(le pantalon aussi : en graphite, la masse sombre passait 35 %, les bottes en
prenant déjà 13 à 15 %), un visage foncé tourné vers le joueur, les pieds
décalés d'un tireur qui s'ancre ; et le tube, épais, graphite, qui barre la
silhouette à hauteur d'épaule, sa bouche claire et la pointe de la roquette
vers la droite. Aucun socle.

La vue « droite » impose deux choses qu'on ne voit pas sur le papier. Le tube
porté sur l'épaule proche passe devant la poitrine, et il coupe l'équipe en
deux : posé bas sur l'épaule, il laisse au-dessus de lui la plus grande zone
(casque, gilet, épaule lointaine). Et la largeur de la silhouette est bornée à
0,50 case : la profondeur y compte 0,87 par mètre, la largeur 0,5 ; le gilet est
donc large plutôt que profond, pour laisser au tube sa longueur.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bpy
from mathutils import Matrix

import bibliotheque as b

# La figurine de la bibliothèque, à ses proportions par défaut.
HAUTEUR = 0.8
TETES = 4.25
CARRURE = 2.0
#: La figurine recule : le tube dépasse surtout devant, et l'emprise doit rester centrée.
Z_CORPS = -0.07

# Les cotes de `fantassin`, recalculées (mêmes formules) pour poser le casque, le bras et le tube.
TETE = HAUTEUR / TETES
R_TETE = TETE * 0.5
Y_HANCHE = HAUTEUR * 0.43
Y_EPAULE = HAUTEUR - TETE * 1.05
Y_TETE = HAUTEUR - TETE * 0.98 + R_TETE * 0.95
LARGEUR_TORSE = CARRURE * TETE
EPAIS_TORSE = 1.2 * TETE
R_BRAS = max(0.28 * TETE, 0.025)
#: Le talon de la botte, derrière l'axe de la jambe (3,4 rayons de jambe de long, avancée de 0,025 m).
TALON = 3.4 * max(0.31 * TETE, 0.025) / 2 - 0.025

# Le casque, repoussé sur la nuque et tourné vers la gauche du soldat : le visage
# regarde le joueur dans les vues « droite » et « bas », comme celui de l'infanterie.
CASQUE_RECUL = 36.0     # degrés : l'axe du casque penche vers la nuque
CASQUE_TOURNE = 45.0    # degrés : et vers la gauche du soldat

#: Le pas du tireur : le pied gauche devant, le droit derrière (en mètres).
PAS = 0.025

# Le tube, sur l'épaule droite (x négatifs) : la vue « droite » le montre devant le corps.
X_TUBE = -0.22
Y_TUBE = 0.65
R_TUBE = 0.054
#: La bouche claire, au bout du tube : moins du quart de sa longueur.
BOUCHE = 0.085
Z_ARRIERE = Z_CORPS - 0.13
Z_BOUCHE = Z_CORPS + 0.265
Z_POIGNEE = Z_CORPS + 0.08


def retirer(f, noeud, *noms):
    """Retire des pièces que `fantassin` a posées (le bras droit pendant : il tient ici le tube)."""
    n = f.noeuds[noeud]
    for p in list(n.pieces):
        if p.nom in noms:
            bpy.data.objects.remove(p.objet, do_unlink=True)
            n.pieces.remove(p)


def decaler(f, noeud, dz):
    """Avance ou recule une jambe entière, pivot compris : elle reste droite, la botte à plat."""
    n = f.noeuds[noeud]
    t = Matrix.Translation(b.vb((0.0, 0.0, dz)))
    for p in n.pieces:
        p.objet.matrix_world = t @ p.objet.matrix_world
    n.pivot = (n.pivot[0], n.pivot[1], n.pivot[2] + dz)


def membre(f, noeud, a, c, rayon, teinte, nom):
    """Un segment de membre d'une articulation à l'autre : une capsule dont les bouts ronds tombent sur les articulations."""
    d = tuple(cc - aa for aa, cc in zip(a, c))
    longueur = math.sqrt(sum(v * v for v in d))
    centre = tuple((aa + cc) / 2 for aa, cc in zip(a, c))
    return f.capsule(noeud, centre, rayon, longueur + 1.6 * rayon, teinte, axe=d, nom=nom)


def casque(f):
    """Le casque du méca : un dôme plein et une lèvre au bord, repoussé en arrière."""
    r = R_TETE
    recul, tourne = math.radians(CASQUE_RECUL), math.radians(CASQUE_TOURNE)
    axe = (math.sin(recul) * math.sin(tourne), math.cos(recul), -math.sin(recul) * math.cos(tourne))
    base = tuple(c + a * 0.15 * r for c, a in zip((0.0, Y_TETE, Z_CORPS + 0.01), axe))
    f.revolution('tete', base, [(r * 1.16, 0.0), (r * 1.15, r * 0.12), (r * 1.08, r * 0.32), (r * 0.97, r * 0.58),
                                (r * 0.74, r * 0.9), (r * 0.28, r * 1.07)],
                 'equipe', axe=axe, chanfrein=0.02, nom='casque')


def construire(f):
    f.fantassin(hauteur=HAUTEUR, peau='peau_meca', tenue='equipe', bas='graphite', couvre_chef=None,
                z=Z_CORPS, tetes=TETES, carrure=CARRURE)
    casque(f)
    decaler(f, 'jambe_g', PAS)
    decaler(f, 'jambe_d', -PAS)

    # Le gilet épais, par-dessus le torse : c'est lui qui fait le méca trapu. Large
    # plutôt que profond (voir plus haut).
    f.boite('corps', (0, 0.505, Z_CORPS), (LARGEUR_TORSE + 0.08, 0.27, EPAIS_TORSE + 0.01), 'equipe', chanfrein=0.08, nom='gilet')

    # Le bras droit, replié : la main sur la poignée, sous le tube.
    retirer(f, 'bras_d', 'fantassin_bras_d', 'fantassin_main_d')
    epaule = (-(LARGEUR_TORSE / 2 + R_BRAS * 0.6), Y_EPAULE - 0.01, Z_CORPS)
    coude = (epaule[0] - 0.02, Y_EPAULE - 0.11, Z_CORPS - 0.01)
    main = (X_TUBE - 0.005, Y_TUBE - R_TUBE - 0.07, Z_POIGNEE + 0.01)
    membre(f, 'bras_d', epaule, coude, R_BRAS, 'equipe', 'bras_d_haut')
    membre(f, 'bras_d', coude, main, R_BRAS * 0.95, 'equipe', 'bras_d_avant')
    f.boule('bras_d', main, R_BRAS * 1.15, 'peau_meca', nom='main_d')

    # Le tube : il a son nœud, pivot à l'appui sur l'épaule, pour reculer le long de son axe.
    t = f.noeud('module_lance_roquettes', parent='corps', pivot=(X_TUBE, Y_TUBE - R_TUBE, Z_CORPS))
    f.cylindre(t, (X_TUBE, Y_TUBE, (Z_ARRIERE + Z_BOUCHE) / 2), R_TUBE, Z_BOUCHE - Z_ARRIERE, 'graphite', axe='z', nom='tube')
    # L'évasement arrière, graphite ; la bouche renforcée, claire : c'est le bout os qui dit où il vise.
    f.cylindre(t, (X_TUBE, Y_TUBE, Z_ARRIERE + 0.02), R_TUBE * 1.15, 0.05, 'graphite', axe='z', rayon2=R_TUBE * 0.98, nom='evasement')
    f.cylindre(t, (X_TUBE, Y_TUBE, Z_BOUCHE - BOUCHE / 2 + 0.005), R_TUBE * 1.1, BOUCHE, 'os', axe='z', nom='bouche')
    # La pointe de la roquette, claire, qui sort de la bouche.
    f.revolution(t, (X_TUBE, Y_TUBE, Z_BOUCHE - 0.01),
                 [(R_TUBE * 0.78, 0.0), (R_TUBE * 0.8, 0.03), (R_TUBE * 0.6, 0.065), (R_TUBE * 0.28, 0.085)],
                 'os', axe='z', chanfrein=0.015, nom='roquette')
    # La poignée, sous le tube.
    f.boite(t, (X_TUBE, Y_TUBE - R_TUBE - 0.035, Z_POIGNEE), (0.05, 0.09, 0.055), 'graphite', nom='poignee')


def animer(f):
    # Repos : une respiration, rien d'autre.
    b.respirer(f.clip('repos'), 'corps', 0.01)

    # Déplacement : une marche lourde ; le bras droit tient le tube, le gauche balance.
    d = f.clip('deplacement')
    b.balancer(d, 'jambe_g', 'x', 18, periodes=1)
    b.balancer(d, 'jambe_d', 'x', -18, periodes=1)
    b.balancer(d, 'bras_g', 'x', -14, periodes=1)
    b.osciller(d, 'corps', 'y', 0.008, periodes=2)
    b.balancer(d, 'corps', 'z', 2.0, periodes=1)

    # Tir : le tube recule le long de son axe, la main suit, le buste encaisse le départ.
    t = f.clip('tir')
    b.recul(t, 'module_lance_roquettes', '-z', 0.06, attaque=0.05, retour=0.35)
    b.recul(t, 'bras_d', '-z', 0.04, attaque=0.05, retour=0.35)
    b.a_coup(t, 'corps', 'x', -5.0, attaque=0.06, retour=0.4)
    b.a_coup(t, 'tete', 'x', -4.0, attaque=0.08, retour=0.4)

    # Touché : le buste vacille et recule d'un rien.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 7.0, oscillations=2)
    b.sursaut(k, 'corps', '-z', 0.025)

    # Hors jeu : il s'assoit par terre, jambes devant, et baisse le tube ; un
    # joueur qui sort du jeu, pas une chute. Les talons restent au sol à chaque
    # instant : la descente suit l'angle des jambes (le talon de la botte est le
    # point le plus bas, à `Y_HANCHE` sous la hanche et `TALON` derrière l'axe).
    h = f.clip('hors_jeu')
    fin = 0.6

    def angle(t):
        return 90.0 * b.lisse(t / fin)

    def descente(t):
        a = math.radians(angle(t))
        return (0.0, -(Y_HANCHE - (Y_HANCHE * math.cos(a) + TALON * math.sin(a))), 0.0)

    for jambe in ('jambe_g', 'jambe_d'):
        h.rotation(jambe, lambda t: ('x', -angle(t)))
    h.translation('base', descente)
    h.translation('corps', descente)
    b.affaisser(h, 'corps', rotation=('x', 10.0), debut=0.2, duree=0.6)
    b.affaisser(h, 'tete', rotation=('x', 16.0), debut=0.3, duree=0.5)
    b.affaisser(h, 'module_lance_roquettes', rotation=('x', 30.0), debut=0.2, duree=0.55)
    b.affaisser(h, 'bras_g', rotation=('x', -25.0), debut=0.25, duree=0.5)

    # Capture : le poing gauche se lève vers l'avant, un petit bond, puis tout revient.
    c = f.clip('capture')
    b.a_coup(c, 'bras_g', 'x', -120.0, debut=0.1, attaque=0.3, retour=0.8)
    b.sursaut(c, 'base', 'y', 0.03, debut=0.1, duree=0.5)
    b.sursaut(c, 'corps', 'y', 0.03, debut=0.1, duree=0.5)
