"""
Le char moyen : l'étalon de la boîte, le grand frère du char léger.

Ce qui le dit à 48 pixels : une grosse tourelle carrée, à la couleur du camp,
qui couvre la caisse (le léger l'a ronde et petite, le lourd à deux étages) ;
un canon long et épais qui pointe à droite depuis un masque sombre, fini par un
frein de bouche en acier clair ; deux chenilles de caoutchouc à cinq galets aux
moyeux clairs. Classe moyenne, haut de la fourchette : 0,82 à 0,84 case de
large en vue « droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import bmesh

import bibliotheque as b

#: Le haut de la classe moyenne : plus gros que le char léger (0,78), plus
#: petit que le char lourd (0,90 à 0,94).
LARGEUR_VISEE = (0.82, 0.84)

# Les cotes, en mètres : tout se déduit d'elles.
TRAIN_Z = -0.03             # le train recule : le long canon pousserait l'emprise en avant
LONGUEUR_TRAIN = 0.58       # longueur d'une chenille : de −0,32 à +0,26
DEMI_VOIE = 0.19            # axe d'une chenille, de part et d'autre
LARGEUR_CHENILLE = 0.14
HAUTEUR_CHENILLE = 0.175
RAYON_GALET = 0.05
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.07
Z_GALETS = tuple(TRAIN_Z + dz for dz in (-0.224, -0.112, 0.0, 0.112, 0.224))

CAISSE_BAS = 0.1
CAISSE_HAUTEUR = 0.14
CAISSE_LONGUEUR = 0.57
CAISSE_LARGEUR = 0.42
DESSUS = CAISSE_BAS + CAISSE_HAUTEUR   # 0,24 : le pont de la caisse

TOURELLE_Z = -0.08                      # le milieu de sa base, en arrière : le canon en paraît plus long
TOURELLE_BAS = DESSUS + 0.045           # le liseré sombre la soulève : il la détache de la caisse
TOURELLE_HAUTEUR = 0.17                 # haute : c'est elle qui la sépare du char léger
TOURELLE_LARGEUR = 0.4
TOURELLE_LONGUEUR = 0.4
RETRAIT_AVANT = 0.085                   # le front de la tourelle fuit vers l'arrière
RETRAIT_ARRIERE = 0.015
RETRAIT_COTES = 0.012                   # des flancs presque droits : la tourelle reste carrée
PAN_COUPE = 0.085                       # les coins avant coupés à 45° : le pan droit prend la lumière
BISEAU = 0.058                          # le biseau du haut, à 39° : c'est lui qui prend la lumière
PART_BISEAU = 0.45                      # la part de la hauteur qu'il occupe
DESSUS_TOURELLE = TOURELLE_BAS + TOURELLE_HAUTEUR

Y_CANON = TOURELLE_BAS + 0.065
Z_MASQUE = TOURELLE_Z + TOURELLE_LONGUEUR / 2 - 0.045  # le masque, au front de la tourelle
Z_TUBE = Z_MASQUE + 0.035                               # le tube sort du masque
Z_BOUCHE = 0.428                                         # le bout du canon : 0,17 m devant les chenilles
LONGUEUR_TUBE = Z_BOUCHE - Z_TUBE - 0.03
RAYON_TUBE = 0.036

ANTENNE = (0.09, DESSUS_TOURELLE - 0.012, TOURELLE_Z - 0.085)


def tourelle_carree(f, noeud, centre, largeur, longueur, hauteur, avant, arriere, cotes, pan=0.0, biseau=0.0, part_biseau=0.45,
                    teinte='equipe', chanfrein=None, nom='tourelle'):
    """
    Une tourelle carrée en tronc de pyramide biaisé : la base est un rectangle
    `largeur` × `longueur` posé à `centre` (le milieu de sa base), le dessus
    rentre de `avant` à l'avant (un front qui fuit), de `arriere` à l'arrière,
    de `cotes` sur les flancs ; `pan` coupe les deux coins avant à 45°.
    `biseau` rentre encore le dessus tout autour, sur la part `part_biseau` de
    la hauteur : des flancs droits en bas, un biseau qui prend la lumière en
    haut (la lumière principale vient du joueur à 60° : un flanc vertical
    tourné vers lui reçoit 0,65, un pan incliné de plus de 25° passe 0,8).

    La bibliothèque n'a que le tronc symétrique (`tourelle`, forme `carree`) :
    cette aide locale en reprend la recette, `_solide_anneaux` puis `_piece`,
    donc le chanfrein, le lissage et les UV de la charte.
    """
    cx, cy, cz = centre
    l2, L2 = largeur / 2, longueur / 2

    def contour(x, zr, zf):
        # Du coin arrière droit, dans le sens du contour ; les coins avant coupés.
        return [(-x, zr), (x, zr), (x, zf - pan), (x - pan, zf), (-x + pan, zf), (-x, zf - pan)]

    # Les anneaux (hauteur, contour) : la base, l'arête du biseau, le dessus.
    anneaux = [(0.0, contour(l2, -L2, L2))]
    if biseau > 0:
        k = 1 - part_biseau
        anneaux.append((hauteur * k, contour(l2 - cotes * k, -L2 + arriere * k, L2 - avant * k)))
    anneaux.append((hauteur, contour(l2 - cotes - biseau, -L2 + arriere + biseau, L2 - avant - biseau)))
    # Repère Blender de la pièce : (x, −z, y) du modèle, base à y = 0.
    anneaux = [[(x, -z, y) for x, z in c] for y, c in anneaux]
    bm = bmesh.new()
    b.anneaux_en_solide(bm, anneaux)
    return f.piece_sur_mesure(bm, noeud, teinte, f.placement((cx, cy, cz)), (largeur, hauteur, longueur), chanfrein, nom=nom)


def construire(f):
    # Les nœuds : la fiche donne racine, corps, base, socle, module_tourelle,
    # module_canon_long ; le canon recule seul (module_canon_long, sous la
    # tourelle), l'antenne se balance, les essieux des galets tournent.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.16, TRAIN_Z))
    f.noeud('module_tourelle', parent='corps', pivot=(0, DESSUS, TOURELLE_Z))
    f.noeud('module_canon_long', parent='module_tourelle', pivot=(0, Y_CANON, Z_MASQUE))
    f.noeud('antenne', parent='module_tourelle', pivot=ANTENNE)
    f.noeud('socle', pivot=(0, 0, 0))

    # Le train : deux bandes de caoutchouc, cinq galets graphite aux moyeux clairs de chaque côté.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE, largeur=LARGEUR_CHENILLE,
                   z_centre=TRAIN_Z)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET,
             epaisseur=EPAISSEUR_GALET, teinte='graphite', teinte_moyeu='os')

    # La caisse, entière à la couleur du camp, glacis à l'avant ; plus étroite
    # que le train, elle laisse voir le dessus des chenilles.
    f.caisse_char('corps', longueur=CAISSE_LONGUEUR, largeur=CAISSE_LARGEUR, y_bas=CAISSE_BAS, hauteur=CAISSE_HAUTEUR,
                  teinte='equipe', glacis=0.6, arriere=0.3, z_centre=TRAIN_Z)

    # Le liseré sombre (un socle carré en retrait de la tourelle), la grosse tourelle carrée, le masque.
    tourelle_carree(f, 'module_tourelle', (0, DESSUS - 0.015, TOURELLE_Z), TOURELLE_LARGEUR - 0.03, TOURELLE_LONGUEUR - 0.03, 0.07,
                    0, 0, 0, pan=PAN_COUPE - 0.006, teinte='graphite', chanfrein=0.02, nom='anneau')
    tourelle_carree(f, 'module_tourelle', (0, TOURELLE_BAS, TOURELLE_Z), TOURELLE_LARGEUR, TOURELLE_LONGUEUR, TOURELLE_HAUTEUR,
                    RETRAIT_AVANT, RETRAIT_ARRIERE, RETRAIT_COTES, pan=PAN_COUPE, biseau=BISEAU, part_biseau=PART_BISEAU, chanfrein=0.018)
    f.boite('module_tourelle', (0, Y_CANON, Z_MASQUE), (0.13, 0.095, 0.07), 'graphite', chanfrein=0.025, nom='masque')

    # Le canon long et épais, son manchon, et le frein de bouche en « T » d'acier clair.
    f.tube('module_canon_long', depart=(0, Y_CANON, Z_TUBE), direction_tube=(0, 0, 1), longueur=LONGUEUR_TUBE, rayon=RAYON_TUBE,
           teinte='graphite', bouche=False, nom='tube')
    f.cylindre('module_canon_long', (0, Y_CANON, Z_TUBE + 0.15), 0.044, 0.07, 'graphite', axe='z', nom='manchon')
    f.boite('module_canon_long', (0, Y_CANON, Z_BOUCHE - 0.0375), (0.11, 0.07, 0.075), 'acier_clair', chanfrein=0.02, nom='frein')

    # Le coffre de tourelle, os, accroché à l'arrière : il allonge la tourelle
    # et dit, comme les caisses du char léger, que c'est la même famille.
    f.boite('module_tourelle', (0, TOURELLE_BAS + 0.058, TOURELLE_Z - TOURELLE_LONGUEUR / 2 - 0.032), (0.32, 0.085, 0.075), 'os',
            chanfrein=0.022, nom='coffre')

    # L'antenne, à l'arrière gauche de la tourelle : le seul signe de vie du repos.
    f.antenne('antenne', base=ANTENNE, hauteur=0.16)


def animer(f):
    # Repos : rien ne bouge que l'antenne, de moins de 2°.
    b.balancer(f.clip('repos'), 'antenne', 'x', 1.6, periodes=2)

    # Déplacement : les galets roulent, la caisse respire sur sa suspension.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)
    b.balancer(d, 'antenne', 'x', -4.0, periodes=2, phase=2.0)   # l'antenne suit la caisse, en retard

    # Tir : le canon recule le long de son axe, la caisse encaisse un à-coup.
    t = f.clip('tir')
    b.recul(t, 'module_canon_long', '-z', 0.06, attaque=0.05, retour=0.35)
    b.a_coup(t, 'corps', 'x', -2.5, attaque=0.07, retour=0.45)
    b.secousse(t, 'antenne', 'x', 9.0, debut=0.04, duree=0.6, oscillations=2.5)

    # Touché : la caisse vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)
    b.secousse(k, 'antenne', 'z', -8.0, oscillations=2.5)

    # Hors jeu : la caisse s'affaisse de biais, le canon pique du nez, l'antenne tombe.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', -6.0))
    b.affaisser(h, 'module_canon_long', rotation=('x', 12.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'antenne', rotation=('x', -35.0), debut=0.2, duree=0.5)
