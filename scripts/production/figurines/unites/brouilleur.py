"""
Le brouilleur mobile : un camion de jouet qui porte une antenne de télévision
trop grande pour lui.

Ce qui le dit à 48 pixels : un camion à six grosses roues — l'essieu avant sous
la cabine, deux essieux serrés sous le caisson —, une cabine avancée et un
caisson plus bas qu'elle, entiers à la couleur du camp, posés sur un châssis
sombre ; et, planté sur le caisson, son signe, un **mât d'antennes en arête de
poisson** : un mât graphite qui porte trois brins clairs en travers, du plus
long au plus court, et dépasse la cabine de plus de 0,4 case. Pas de parabole
(c'est la station radar), aucune arme (c'est un soutien), pas de caisses
claires (c'est le transport). Classe moyenne, 0,78 à 0,82 case de large en vue
« droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le milieu de la classe moyenne.
LARGEUR_VISEE = (0.78, 0.82)

# Les cotes, en mètres : tout se déduit d'elles.

# Le train : six gros pneus, l'essieu avant sous la cabine, un tandem sous le caisson.
RAYON_ROUE = 0.08
LARGEUR_PNEU = 0.085
X_ROUE = 0.18                          # axe d'un pneu, de part et d'autre
Z_ESSIEUX = (0.222, -0.078, -0.243)

# Le châssis, sombre, sur toute la longueur : il assoit le camion et le coupe
# en deux masses, le sombre en bas, l'équipe en haut.
CHASSIS_BAS = 0.12
CHASSIS_HAUT = 0.19
CHASSIS_LARGEUR = 0.32
CHASSIS_Z = (-0.335, 0.335)

# La caisse : une cabine avancée, un caisson plus bas qu'elle, un jour entre les deux.
BAS_CAISSE = 0.18
CABINE_Z = (0.14, 0.325)
CABINE_LARGEUR = 0.38
# La cabine en trois étages : le bas de caisse d'équipe, la serre vitrée, plus
# étroite, au pare-brise incliné — vu à 50°, il fait face à la caméra : c'est
# le visage du camion —, et le toit d'équipe qui la coiffe en débordant.
EPAULE_CABINE = 0.235                 # le haut du bas de caisse, le pied des vitres
TOIT_CABINE = 0.305                   # le haut des vitres, le dessous du toit
CABINE_HAUT = 0.355
RETRAIT_SERRE = 0.02                  # la serre rentre d'autant sur chaque flanc
INCLINAISON_PARE_BRISE = 0.06         # le haut du pare-brise recule d'autant
CAISSON_Z = (-0.335, 0.11)
CAISSON_HAUT = 0.29
CAISSON_LARGEUR = 0.38

# L'antenne : un coffret sur le caisson, un mât, trois brins en travers.
Z_MAT = -0.1
COFFRET = (0.12, 0.055, 0.12)          # x, y, z
PIED_MAT = CAISSON_HAUT + COFFRET[1] - 0.01
RAYON_MAT = 0.024
RAYON_BRIN = 0.018
BRINS = ((0.48, 0.38), (0.625, 0.3), (0.77, 0.22))   # (hauteur, longueur), du bas vers le haut
SOMMET_MAT = BRINS[-1][0] + 0.03

#: Les brins sont tournés de 40° de l'axe du camion vers sa gauche : presque à
#: l'horizontale de l'écran dans la vue « droite » (lacet 60°, celle du repos :
#: 30° l'y mettrait exactement), où l'arête de poisson se lit de face, sans
#: se présenter par la tranche dans la vue « haut » (lacet 160°), où 30° la
#: confondait avec le mât.
ANGLE_BRINS = 40.0


def construire(f):
    # Les nœuds. Le train (`base`) porte le châssis et les trois essieux, qui
    # tournent ; la caisse (`corps`) respire sur sa suspension ; le coffret
    # émetteur (`module_radar`) est posé sur le caisson, et le mât
    # (`module_antenne`) sort du coffret : son pivot est à son pied.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, BAS_CAISSE, 0))
    f.noeud('module_radar', parent='corps', pivot=(0, CAISSON_HAUT, Z_MAT))
    f.noeud('module_antenne', parent='module_radar', pivot=(0, PIED_MAT, Z_MAT))
    f.noeud('socle', pivot=(0, 0, 0))
    for i, z in enumerate(Z_ESSIEUX):
        f.noeud(f'essieu_{i + 1}', parent='base', pivot=(0, RAYON_ROUE, z))

    # Le train : six gros pneus de caoutchouc aux moyeux clairs.
    for i, z in enumerate(Z_ESSIEUX):
        for cote in (1, -1):
            f.roue(f'essieu_{i + 1}', (cote * X_ROUE, RAYON_ROUE, z), RAYON_ROUE, LARGEUR_PNEU, part_moyeu=0.5,
                   nom=f'roue_{i + 1}_{"g" if cote > 0 else "d"}')

    # Le châssis, sombre, d'un bout à l'autre, et le pare-chocs qui dépasse sous la cabine.
    f.boite('base', (0, (CHASSIS_BAS + CHASSIS_HAUT) / 2, (CHASSIS_Z[0] + CHASSIS_Z[1]) / 2),
            (CHASSIS_LARGEUR, CHASSIS_HAUT - CHASSIS_BAS, CHASSIS_Z[1] - CHASSIS_Z[0]), 'graphite', chanfrein=0.025, nom='chassis')
    f.boite('base', (0, 0.165, CABINE_Z[1] + 0.004), (0.3, 0.055, 0.05), 'graphite', chanfrein=0.02, nom='pare_chocs')

    # La cabine avancée : le bas de caisse, la serre vitrée au pare-brise
    # incliné, le toit qui la coiffe. Toute d'équipe, sauf les vitres.
    za, zv = CABINE_Z
    zc = (za + zv) / 2
    f.boite('corps', (0, (BAS_CAISSE + EPAULE_CABINE) / 2 + 0.005, zc), (CABINE_LARGEUR, EPAULE_CABINE - BAS_CAISSE + 0.01, zv - za),
            'equipe', chanfrein=0.03, nom='cabine')
    zp = zv - INCLINAISON_PARE_BRISE      # le haut du pare-brise
    serre = [(za + 0.01, EPAULE_CABINE - 0.01), (zv - 0.012, EPAULE_CABINE - 0.01), (zp - 0.006, TOIT_CABINE + 0.008), (za + 0.01, TOIT_CABINE + 0.008)]
    f.prisme('corps', serre, CABINE_LARGEUR - 2 * RETRAIT_SERRE, 'verre', chanfrein=0.015, nom='vitres')
    f.boite('corps', (0, (TOIT_CABINE + CABINE_HAUT) / 2, (za + zp) / 2 - 0.004), (CABINE_LARGEUR - 2 * RETRAIT_SERRE + 0.02, CABINE_HAUT - TOIT_CABINE, zp - za + 0.004),
            'equipe', chanfrein=0.018, nom='toit_cabine')
    # Les phares, au bas de la face avant.
    for cote in (1, -1):
        f.cylindre('corps', (cote * 0.13, 0.212, zv - 0.012), 0.026, 0.05, 'feux', axe='z',
                   nom=f'phare_{"g" if cote > 0 else "d"}')

    # Le caisson, plus bas que la cabine, entier à la couleur du camp.
    zk = (CAISSON_Z[0] + CAISSON_Z[1]) / 2
    f.boite('corps', (0, (BAS_CAISSE + CAISSON_HAUT) / 2, zk), (CAISSON_LARGEUR, CAISSON_HAUT - BAS_CAISSE, CAISSON_Z[1] - CAISSON_Z[0]),
            'equipe', chanfrein=0.035, nom='caisson')

    # Le coffret émetteur, sombre, sur le caisson : le pied du mât.
    f.boite('module_radar', (0, CAISSON_HAUT + COFFRET[1] / 2 - 0.005, Z_MAT), COFFRET, 'graphite', chanfrein=0.02, nom='coffret')

    # Le mât en arête de poisson : un fût sombre, trois brins clairs en travers
    # — une arête est claire, et c'est ce qui la distingue des antennes fouets,
    # graphite, de tous les blindés —, un bouton au sommet.
    f.cylindre('module_antenne', (0, (PIED_MAT + SOMMET_MAT) / 2, Z_MAT), RAYON_MAT, SOMMET_MAT - PIED_MAT, 'graphite', axe='y',
               fin=True, nom='mat')
    a = math.radians(ANGLE_BRINS)
    d = (math.sin(a), 0.0, math.cos(a))
    for i, (y, longueur) in enumerate(BRINS):
        f.cylindre('module_antenne', (0, y, Z_MAT), RAYON_BRIN, longueur, 'os', axe=d, fin=True, nom=f'brin_{i + 1}')
    f.boule('module_antenne', (0, SOMMET_MAT, Z_MAT), 0.03, 'graphite', nom='bouton')


def animer(f):
    # Repos : rien ne bouge que le mât, qui se balance à peine (0,6°), une
    # seule fois par boucle — lentement : d'une image à l'autre, il ne bouge
    # pas plus qu'à 0,3° deux fois, et ses brins clairs sur l'herbe gardent
    # l'agitation du repos loin des 3 %.
    b.balancer(f.clip('repos'), 'module_antenne', 'x', 0.6, periodes=1)

    # Déplacement : les roues tournent, la caisse respire, le mât suit en retard.
    d = f.clip('deplacement')
    for i in range(len(Z_ESSIEUX)):
        b.tourner(d, f'essieu_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)
    b.balancer(d, 'module_antenne', 'x', 2.0, periodes=2, phase=2.2)

    # Touché : la caisse vacille et se tasse, le mât fouette.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)
    b.secousse(k, 'module_antenne', 'x', 7.0, oscillations=2.5)

    # Hors jeu : la caisse s'affaisse sur son flanc droit, le mât se couche du
    # même côté — vers la caméra de la vue « droite » : il tombe, il ne monte
    # pas dans la case du dessus.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', 5.0))
    b.affaisser(h, 'module_antenne', rotation=('z', 40.0), debut=0.1, duree=0.6)
