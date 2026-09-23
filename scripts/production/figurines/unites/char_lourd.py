"""
Le char lourd : le grand frère des deux autres chars, celui qui fait peur.

Ce qui le dit à 48 pixels : la caisse la plus large des trois, entière à la
couleur du camp comme sa tourelle ; une tourelle à deux étages, un gros bloc
surmonté d'un tambour rond, séparés par un anneau sombre ; un double canon
épais, côte à côte, aux bouches claires (le seul du jeu : le char moyen n'en
a qu'un) ; des jupes graphite sur des chenilles larges à six galets aux
moyeux clairs. Classe grande : 0,90 à 0,94 case de large en vue « droite »,
contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import bibliotheque as b

#: La classe grande : nettement plus gros que le char moyen (0,82 à 0,84 case).
LARGEUR_VISEE = (0.90, 0.94)

#: Tout le char recule de Z0 : le double canon pousse l'image vers l'avant, le
#: train vers l'arrière ; ce recul égalise les deux débords en vue « droite ».
Z0 = -0.01

# Le train : deux larges chenilles, six galets de chaque côté.
LONGUEUR_TRAIN = 0.62
DEMI_VOIE = 0.255
LARGEUR_CHENILLE = 0.15
HAUTEUR_CHENILLE = 0.175
RAYON_GALET = 0.044
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.07
Z_GALETS = tuple(Z0 + z for z in (-0.23, -0.138, -0.046, 0.046, 0.138, 0.23))
X_GALETS = DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012
PART_MOYEU = 0.62

# Les jupes : deux plaques graphite à l'aplomb des galets, qui cachent le haut
# du train et laissent les six galets entiers dessous. Graphite et non couleur
# du camp : des flancs verticaux d'équipe ne prennent pas la lumière, et le
# sombre doit tenir le bas de la silhouette.
JUPE_BAS = 0.122
JUPE_HAUT = 0.19
JUPE_LONGUEUR = 0.56
JUPE_EPAISSEUR = 0.05
JUPE_X = X_GALETS + 0.017
TEINTE_JUPES = 'graphite'

# La caisse, aussi large que le train : elle couvre les chenilles jusqu'aux jupes.
CAISSE_BAS = 0.11
CAISSE_HAUTEUR = 0.135
CAISSE_GLACIS = 0.65
CAISSE_CHANFREIN = 0.035
CAISSE_LONGUEUR = 0.60
CAISSE_LARGEUR = 2 * (JUPE_X - JUPE_EPAISSEUR / 2)
DESSUS = CAISSE_BAS + CAISSE_HAUTEUR    # 0,245 : le pont

# La tourelle : un gros bloc bas et large aux flancs inclinés (ils prennent la
# lumière), puis un tambour rond, reculé, sur un collier sombre. Elle est
# reculée elle-même : à bout de tube fixé par le débord, les tubes s'allongent.
TOURELLE_Z = Z0 - 0.05
ETAGE1_BAS = DESSUS + 0.055
ETAGE1_HAUTEUR = 0.115
ETAGE1_LARGEUR = 0.46
ETAGE1_LONGUEUR = 0.38
ETAGE1_INCLINAISON = 0.3
ETAGE1_CHANFREIN = 0.04
ANNEAU1_RETRAIT = 0.05
ECART_ETAGES = 0.045
ANNEAU2_RAYON = 0.125
ETAGE2_BAS = ETAGE1_BAS + ETAGE1_HAUTEUR + ECART_ETAGES
ETAGE2_HAUTEUR = 0.08
ETAGE2_LARGEUR = 0.3
ETAGE2_LONGUEUR = 0.27
ETAGE2_INCLINAISON = 0.22
ETAGE2_CHANFREIN = 0.028
ETAGE2_Z = TOURELLE_Z - 0.04

# Le double canon : deux tubes épais qui sortent du front du premier étage.
Y_CANON = ETAGE1_BAS + 0.05
Z_MASQUE = TOURELLE_Z + ETAGE1_LONGUEUR / 2 - 0.02
X_CANONS = 0.09
RAYON_CANON = 0.043
RAYON_BOUCHE = 0.047
LONGUEUR_BOUCHE = 0.05
BOUT_CANON = Z0 + 0.44

BASE_ANTENNE = (0.075, ETAGE2_BAS + ETAGE2_HAUTEUR - 0.01, ETAGE2_Z - 0.065)


def galets(f):
    """
    Six galets graphite de chaque côté, un nœud par essieu (ils roulent), et
    leurs moyeux os — plus gros que ceux de `f.galets`, pour que les six se
    comptent encore à 48 pixels.
    """
    for i, z in enumerate(Z_GALETS):
        n = f.noeud(f'galets_{i + 1}', pivot=(0, Y_GALETS, z))
        for cote in (1, -1):
            c = 'g' if cote > 0 else 'd'
            f.cylindre(n, (cote * X_GALETS, Y_GALETS, z), RAYON_GALET, EPAISSEUR_GALET, 'graphite', axe='x',
                       chanfrein=0.35 * EPAISSEUR_GALET, nom=f'galet_{i + 1}_{c}')
            f.cylindre(n, (cote * (X_GALETS + 0.2 * EPAISSEUR_GALET), Y_GALETS, z), RAYON_GALET * PART_MOYEU, 0.05, 'os', axe='x',
                       nom=f'galet_{i + 1}_moyeu_{c}')


def construire(f):
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.18, Z0))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('module_tourelle', parent='corps', pivot=(0, DESSUS, TOURELLE_Z))
    f.noeud('module_canon_long', parent='module_tourelle', pivot=(0, Y_CANON, Z_MASQUE))
    f.noeud('antenne', parent='module_tourelle', pivot=BASE_ANTENNE)

    # Le train : deux larges bandes de caoutchouc, six galets graphite aux moyeux clairs.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE, largeur=LARGEUR_CHENILLE, z_centre=Z0)
    galets(f)

    # Les jupes.
    for cote in (1, -1):
        f.boite('base', (cote * JUPE_X, (JUPE_BAS + JUPE_HAUT) / 2, Z0), (JUPE_EPAISSEUR, JUPE_HAUT - JUPE_BAS, JUPE_LONGUEUR),
                TEINTE_JUPES, chanfrein=0.02, nom=f'jupe_{"g" if cote > 0 else "d"}')

    # La caisse, entière à la couleur du camp, glacis à l'avant.
    f.caisse_char('corps', longueur=CAISSE_LONGUEUR, largeur=CAISSE_LARGEUR, y_bas=CAISSE_BAS, hauteur=CAISSE_HAUTEUR,
                  teinte='equipe', glacis=CAISSE_GLACIS, arriere=0.3, z_centre=Z0 - 0.005, chanfrein=CAISSE_CHANFREIN)

    # La plage arrière : deux caisses claires et, entre elles, une bâche roulée
    # (sans elle, l'équipe frôlerait les 60 % de la vue « droite »).
    for cote in (1, -1):
        f.boite('corps', (cote * 0.17, DESSUS + 0.035, Z0 - 0.29), (0.15, 0.07, 0.075), 'os', nom=f'caisse_{"g" if cote > 0 else "d"}')
    f.capsule('corps', (0, DESSUS + 0.035, Z0 - 0.285), 0.037, 0.2, 'os', axe='x', nom='bache')

    # Premier étage : l'anneau sombre, qui le soulève et le détache de la caisse, et le gros bloc aux flancs inclinés.
    f.boite('module_tourelle', (0, ETAGE1_BAS - 0.025, TOURELLE_Z), (ETAGE1_LARGEUR - ANNEAU1_RETRAIT, 0.06, ETAGE1_LONGUEUR - ANNEAU1_RETRAIT), 'graphite',
            chanfrein=0.02, nom='anneau')
    f.tourelle('module_tourelle', (0, ETAGE1_BAS, TOURELLE_Z), largeur=ETAGE1_LARGEUR, longueur=ETAGE1_LONGUEUR,
               hauteur=ETAGE1_HAUTEUR, forme='carree', inclinaison=ETAGE1_INCLINAISON, chanfrein=ETAGE1_CHANFREIN, nom='etage_1')

    # Second étage : un anneau sombre, le tambour rond reculé.
    f.cylindre('module_tourelle', (0, ETAGE1_BAS + ETAGE1_HAUTEUR + ECART_ETAGES / 2 - 0.004, ETAGE2_Z), ANNEAU2_RAYON, ECART_ETAGES + 0.03,
               'graphite', axe='y', nom='anneau_2')
    f.tourelle('module_tourelle', (0, ETAGE2_BAS, ETAGE2_Z), largeur=ETAGE2_LARGEUR, longueur=ETAGE2_LONGUEUR, hauteur=ETAGE2_HAUTEUR,
               forme='ronde', inclinaison=ETAGE2_INCLINAISON, chanfrein=ETAGE2_CHANFREIN, nom='etage_2')

    # Les deux tubes épais côte à côte, bouches claires.
    for cote in (1, -1):
        c = 'g' if cote > 0 else 'd'
        f.tube('module_canon_long', depart=(cote * X_CANONS, Y_CANON, Z_MASQUE), direction_tube=(0, 0, 1),
               longueur=BOUT_CANON - Z_MASQUE, rayon=RAYON_CANON, teinte='graphite', bouche=True, teinte_bouche='acier_clair',
               rayon_bouche=RAYON_BOUCHE, longueur_bouche=LONGUEUR_BOUCHE, nom=f'tube_{c}')

    # L'antenne, à l'arrière gauche du tambour : le seul signe de vie du repos.
    f.antenne('antenne', base=BASE_ANTENNE, hauteur=0.16)


def animer(f):
    # Repos : immobile, sauf l'antenne, de moins de 2°.
    b.balancer(f.clip('repos'), 'antenne', 'x', 1.5, periodes=2)

    # Déplacement : les six essieux roulent, la lourde caisse tangue à peine.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.003, periodes=2)
    b.balancer(d, 'corps', 'x', 0.5, periodes=2, phase=1.2)
    b.balancer(d, 'antenne', 'x', 3.0, periodes=2, phase=0.6)

    # Tir : les deux tubes reculent ensemble le long de leur axe, la caisse encaisse.
    t = f.clip('tir')
    b.recul(t, 'module_canon_long', '-z', 0.055, attaque=0.05, retour=0.38)
    b.a_coup(t, 'corps', 'x', -2.0, attaque=0.07, retour=0.45)
    b.sursaut(t, 'corps', '-z', 0.01, duree=0.4)

    # Touché : la caisse vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 3.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.008)

    # Hors jeu : la caisse s'affaisse sur son flanc droit (vers le joueur : de
    # l'autre côté, la tourelle pousserait le bout des tubes hors de la case),
    # les canons piquent du nez, l'antenne tombe.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', 5.0))
    b.affaisser(h, 'module_canon_long', rotation=('x', 9.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'antenne', rotation=('x', -35.0), debut=0.2, duree=0.5)
