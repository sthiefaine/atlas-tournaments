"""
Le char léger : le plus petit des trois chars, et le premier jouet de la
boîte. Trapu, lisible, sympathique.

Ce qui le dit à 48 pixels : une caisse et une tourelle entières à la couleur
du camp, une tourelle **ronde et basse posée vers l'avant** (le char moyen l'a
carrée, le lourd massive), détachée de la caisse par un anneau sombre ; un
canon court et fin qui pointe à droite depuis un masque sombre ; deux
chenilles de caoutchouc à quatre galets aux moyeux clairs ; deux petites
caisses claires sur la plage arrière. Classe moyenne, bas de la fourchette :
0,76 à 0,79 case de large en vue « droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import bibliotheque as b

#: Le bas de la classe moyenne : le plus petit des trois chars.
LARGEUR_VISEE = (0.76, 0.79)

# Les cotes, en mètres : tout se déduit d'elles.
LONGUEUR_TRAIN = 0.58       # longueur d'une chenille
DEMI_VOIE = 0.185           # axe d'une chenille, de part et d'autre
LARGEUR_CHENILLE = 0.13
HAUTEUR_CHENILLE = 0.16
RAYON_GALET = 0.052
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.068
Z_GALETS = (-0.195, -0.065, 0.065, 0.195)

CAISSE_BAS = 0.1
CAISSE_HAUTEUR = 0.12
CAISSE_LONGUEUR = 0.54
CAISSE_LARGEUR = 0.4
DESSUS = CAISSE_BAS + CAISSE_HAUTEUR   # 0,22 : le pont de la caisse

TOURELLE_Z = 0.05                       # posée vers l'avant
TOURELLE_BAS = DESSUS + 0.032           # l'anneau sombre la soulève : il la détache de la caisse
TOURELLE_HAUTEUR = 0.1
Y_CANON = TOURELLE_BAS + 0.048
Z_MASQUE = TOURELLE_Z + 0.15            # le masque, au nez de la tourelle


def construire(f):
    # Les nœuds : la fiche donne racine, corps, base, socle, module_tourelle ;
    # le canon (qui recule), l'antenne (qui se balance) et les essieux des
    # galets (qui tournent) sont des nœuds à eux.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.16, 0))
    f.noeud('module_tourelle', parent='corps', pivot=(0, DESSUS, TOURELLE_Z))
    f.noeud('canon', parent='module_tourelle', pivot=(0, Y_CANON, Z_MASQUE))
    f.noeud('antenne', parent='module_tourelle', pivot=(0.08, TOURELLE_BAS + TOURELLE_HAUTEUR - 0.012, -0.05))
    f.noeud('socle', pivot=(0, 0, 0))

    # Le train : deux bandes de caoutchouc, quatre galets graphite aux moyeux clairs de chaque côté.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE, largeur=LARGEUR_CHENILLE)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET,
             epaisseur=EPAISSEUR_GALET, teinte='graphite', teinte_moyeu='os')

    # La caisse, entière à la couleur du camp, glacis à l'avant ; plus étroite
    # que le train, elle laisse voir le dessus des chenilles.
    f.caisse_char('corps', longueur=CAISSE_LONGUEUR, largeur=CAISSE_LARGEUR, y_bas=CAISSE_BAS, hauteur=CAISSE_HAUTEUR,
                  teinte='equipe', glacis=0.55, arriere=0.3, z_centre=-0.01)

    # Deux petites caisses claires sur la plage arrière.
    for cote in (1, -1):
        f.boite('corps', (cote * 0.1, DESSUS + 0.03, -0.215), (0.11, 0.06, 0.08), 'os', nom=f'caisse_{"g" if cote > 0 else "d"}')

    # L'anneau sombre, la tourelle ronde et basse, le masque et le canon court.
    f.cylindre('module_tourelle', (0, DESSUS + 0.012, TOURELLE_Z), 0.13, 0.05, 'graphite', axe='y', nom='anneau')
    f.tourelle('module_tourelle', (0, TOURELLE_BAS, TOURELLE_Z), largeur=0.31, longueur=0.32, hauteur=TOURELLE_HAUTEUR,
               forme='ronde', inclinaison=0.2, chanfrein=0.03)
    f.boite('module_tourelle', (0, Y_CANON, Z_MASQUE - 0.005), (0.11, 0.075, 0.07), 'graphite', nom='masque')
    f.tube('canon', depart=(0, Y_CANON, Z_MASQUE + 0.02), direction_tube=(0, 0, 1), longueur=0.17, rayon=0.03, teinte='graphite',
           bouche=True, teinte_bouche='acier_clair', rayon_bouche=0.04, longueur_bouche=0.05)

    # L'antenne, à l'arrière gauche de la tourelle : le seul signe de vie du repos.
    f.antenne('antenne', base=(0.08, TOURELLE_BAS + TOURELLE_HAUTEUR - 0.012, -0.05), hauteur=0.15)


def animer(f):
    # Repos : rien ne bouge que l'antenne, de moins de 2°.
    b.balancer(f.clip('repos'), 'antenne', 'x', 1.6, periodes=2)

    # Déplacement : les galets roulent, la caisse respire sur sa suspension.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)

    # Tir : le canon recule, la caisse se cabre un instant.
    t = f.clip('tir')
    b.recul(t, 'canon', '-z', 0.045, attaque=0.05, retour=0.35)
    b.a_coup(t, 'corps', 'x', -2.5, attaque=0.07, retour=0.45)

    # Touché : la caisse vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)

    # Hors jeu : la caisse s'affaisse de biais, le canon pique du nez, l'antenne tombe.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', -6.0))
    b.affaisser(h, 'canon', rotation=('x', 12.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'antenne', rotation=('x', -35.0), debut=0.2, duree=0.5)
