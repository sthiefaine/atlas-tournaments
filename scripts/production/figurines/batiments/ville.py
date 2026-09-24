"""
La ville : quatre maisons serrées, pignon sur rue, et le premier bâtiment de
la boîte.

Ce qui la dit à 48 pixels : une rangée de trois maisons étroites qui regardent
le joueur, pignons pointus, et une grande maison derrière elles, plus haute ;
tous les toits à la couleur du camp, des murs clairs, des fenêtres sombres qui
s'allument la nuit, des portes de bois. Derrière la petite maison de droite,
la place : c'est là que le rendu plante le drapeau (le coin du mât), et que
la ville désaffectée couche le sien.

Pourquoi des pignons sur rue : un pan de toit tourné sur le côté se voit
comme son emprise au sol (0,77 de sa surface), quelle que soit sa pente ; le
pignon, lui, est du mur. La couleur d'équipe tient ainsi dans 30 à 45 % de
l'image sans rapetisser les toits, et chaque pan, à 42°, reçoit 0,86 de
lumière (plus de 0,8 : les toits se lisent de haut).

Désaffectée, la même ville endormie : fenêtres éteintes, planches clouées en
croix, une bâche claire sur un toit, le mât couché sur la place. Rien de
cassé, rien de noirci.

Repère (celui de la fiche) : x à gauche du modèle — à droite de l'écran, la
vue fixe regardant le joueur —, y en haut, z vers l'avant (vers le joueur).
"""

import math

import bibliotheque as b

ETATS = ('base', 'desaffecte')

# Les maisons : leurs murs (x0, x1, z0, z1), leur hauteur à l'égout, la
# hauteur de leur toit. Pignon sur rue (faîtage selon z) : le triangle du
# pignon est du mur. Le fond est plus haut que le devant, pour que chaque toit
# se voie ; la maison de droite, devant la place, reste sous le pied du mât à
# l'écran (le rendu dessine le mât par-dessus tout, il ne doit rien couvrir).
MAISONS = {
    'fond': {'x': (-0.40, -0.03), 'z': (-0.40, -0.21), 'murs': 0.52, 'toit': 0.13},
    'gauche': {'x': (-0.40, -0.15), 'z': (0.22, 0.40), 'murs': 0.41, 'toit': 0.11},
    'milieu': {'x': (-0.11, 0.14), 'z': (0.23, 0.40), 'murs': 0.35, 'toit': 0.11},
    'droite': {'x': (0.19, 0.40), 'z': (0.24, 0.40), 'murs': 0.29, 'toit': 0.09},
}
DEBORD = 0.022
EPAISSEUR_TOIT = 0.045

# Les ouvertures des façades qui regardent le joueur (+z) : (maison, x, y, largeur, hauteur, genre).
# Jamais deux fenêtres seules côte à côte sous un pignon : à 48 pixels, c'est un visage.
FENETRE = (0.08, 0.10)
PORTE = (0.08, 0.135)
OUVERTURES = [
    ('fond', -0.33, 0.30, *FENETRE, 'fenetre'),
    ('fond', -0.215, 0.30, *FENETRE, 'fenetre'),
    ('fond', -0.10, 0.30, *FENETRE, 'fenetre'),
    ('fond', -0.33, 0.45, *FENETRE, 'fenetre'),
    ('fond', -0.215, 0.45, *FENETRE, 'fenetre'),
    ('fond', -0.10, 0.45, *FENETRE, 'fenetre'),
    ('gauche', -0.335, 0.0675, *PORTE, 'porte'),
    ('gauche', -0.215, 0.15, *FENETRE, 'fenetre'),
    ('gauche', -0.275, 0.31, *FENETRE, 'fenetre'),
    ('milieu', -0.045, 0.0675, *PORTE, 'porte'),
    ('milieu', 0.075, 0.15, *FENETRE, 'fenetre'),
    ('milieu', 0.015, 0.275, *FENETRE, 'fenetre'),
    ('droite', 0.25, 0.0675, *PORTE, 'porte'),
    ('droite', 0.345, 0.105, *FENETRE, 'fenetre'),
    ('droite', 0.295, 0.225, *FENETRE, 'fenetre'),
]

#: Les fenêtres que la ville désaffectée cloue en croix (indices dans `OUVERTURES`).
CLOUEES = {0, 2, 4, 7, 10, 13}


def dessus_toit(m, x):
    """La hauteur du dessus du toit d'une maison (pignon sur rue) à l'abscisse x : le faîtage moins la pente, plus l'épaisseur."""
    (x0, x1) = m['x']
    demi, u = (x1 - x0) / 2, abs(x - (x0 + x1) / 2)
    t = m['toit'] / demi
    return m['murs'] + m['toit'] - t * u + EPAISSEUR_TOIT * math.sqrt(1 + t * t)


def construire(f, etat, variante):
    endormie = etat == 'desaffecte'
    f.noeud('corps', pivot=(0, 0, 0))
    f.noeud('toit', parent='corps', pivot=(0, 0.3, 0))

    murs = {}
    for nom, m in MAISONS.items():
        (x0, x1), (z0, z1), h = m['x'], m['z'], m['murs']
        murs[nom] = f.boite('corps', ((x0 + x1) / 2, h / 2, (z0 + z1) / 2), (x1 - x0, h, z1 - z0), 'enduit', nom=f'murs_{nom}')
        centre = ((x0 + x1) / 2, h, (z0 + z1) / 2)
        f.pignon('corps', centre, x1 - x0, z1 - z0, m['toit'], faitage='z', nom=f'pignon_{nom}')
        f.toit('toit', centre, x1 - x0, z1 - z0, m['toit'], faitage='z', debord=DEBORD, epaisseur=EPAISSEUR_TOIT, nom=f'toit_{nom}')

    # Deux cheminées de pierre, loin du coin du mât : elles sortent du toit de 6 cm, coiffées de sombre.
    for nom, x, z in (('fond', -0.34, -0.30), ('gauche', -0.20, 0.28)):
        dessus = dessus_toit(MAISONS[nom], x)
        f.boite('toit', (x, dessus - 0.02, z), (0.065, 0.16, 0.065), 'pave', nom=f'cheminee_{nom}')
        f.boite('toit', (x, dessus + 0.06, z), (0.085, 0.05, 0.085), 'graphite', nom=f'chapeau_{nom}')

    for i, (nom, x, y, l, h, genre) in enumerate(OUVERTURES):
        z = MAISONS[nom]['z'][1]
        if genre == 'porte':
            f.plaque('corps', (x, y, z), l, h, 'bois', hote=murs[nom], nom=f'porte_{i}')
        else:
            f.plaque('corps', (x, y, z), l, h, 'graphite' if endormie else 'fenetre', hote=murs[nom], nom=f'fenetre_{i}')
        if endormie and i in CLOUEES:
            f.croix('corps', (x, y, z), l, h, 'bois', hote=murs[nom], nom=f'croix_{i}')

    if endormie:
        bache(f)
        # Le mât couché sur la place, vers le fond : de biais à l'écran, il se lit posé au sol.
        f.mat_couche('corps', vers=(-1.0, -0.5), longueur=0.30)


def bache(f):
    """
    Une bâche claire jetée sur le toit de la maison du milieu, par-dessus le
    faîtage, sur sa moitié avant, et deux sangles de bois qui la tiennent.
    """
    m = MAISONS['milieu']
    (x0, x1), (z0, z1) = m['x'], m['z']
    demi = (x1 - x0) / 2
    pente = math.atan2(m['toit'], demi)
    t = math.tan(pente)
    e = EPAISSEUR_TOIT * math.sqrt(1 + t * t)
    zc = z1 - (z1 - z0) * 0.3
    longueur = (z1 - z0) * 0.62
    largeur = (demi + DEBORD) * 0.98 / math.cos(pente)
    for cote in (1, -1):
        u = cote * (demi + DEBORD) * 0.49
        xc = (x0 + x1) / 2 + u
        yc = m['murs'] + m['toit'] - t * abs(u) + e + 0.012
        rot = [('z', -cote * math.degrees(pente))]
        toile = f.boite('toit', (xc, yc, zc), (largeur, 0.05, longueur), 'os', rotation=rot, nom=f'bache_{"g" if cote > 0 else "d"}')
        for k, dz in enumerate((-0.28, 0.28)):
            sangle = f.boite('toit', (xc, yc + 0.012, zc + dz * longueur), (largeur * 0.98, 0.05, 0.035), 'bois', rotation=rot,
                             nom=f'sangle_{"g" if cote > 0 else "d"}_{k}')
            sangle.avec = toile.nom


def animer(f, etat, variante):
    # Repos : une ville ne bouge pas.
    b.fixe(f.clip('repos'), 'corps')
    # Capture : les toits sautent d'un rien, le temps que les couleurs changent.
    b.sursaut(f.clip('capture'), 'toit', 'y', 0.035, debut=0.2, duree=0.8)
