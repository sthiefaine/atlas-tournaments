"""
L'artillerie : un canon automoteur, le jouet de la boîte qui tire loin.

Ce qui la dit à 48 pixels : un long tube épais relevé à 40° vers l'avant —
vers la droite en vue « droite », vers l'adversaire —, monté sur la plateforme
arrière, qui court sur tout le véhicule et le dépasse, bouche d'acier clair ;
un bouclier à la couleur du camp sur cette plateforme ouverte, basse, derrière
un capot en coin ; trois obus clairs debout (des ogives : les caisses claires
disent le ravitaillement) ; les chenilles de caoutchouc à galets du char léger ;
une bêche sombre plantée à l'arrière. Ni tourelle fermée (c'est ce qui la
sépare d'un char), ni caisson (c'est ce qui la sépare du lance-roquettes).
Classe moyenne, haut de la fourchette : 0,80 à 0,84 case de large en vue
« droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Ce qui borne le tube : de dos (vue « haut »), un tube levé à 40° se voit
presque de toute sa longueur, dressé vers le haut de l'image, et son bout ne
doit pas passer 0,70 case au-dessus du pivot ; de trois quarts (vue « droite »),
c'est lui qui fait la largeur, et l'arrière du train ne doit pas passer 0,47
case à gauche. Le bout de la bouche est donc fixé par ces deux vues, et le
tourillon s'en déduit : plus il recule, plus il descend et plus le tube
s'allonge. La plateforme est basse pour le recevoir, le capot plus haut devant.

Le contrat d'assemblage de l'artillerie (`src/assets/production.ts`) fixe
trois pivots : `corps` à (0 ; 0,16 ; 0), `module_canon_long` à 0,155 au-dessus
et 0,13 derrière celui du corps, `socle` (la bêche) à (0 ; 0,185 ; −0,28). La
géométrie, elle, est libre : le tourillon dessiné est plus bas et plus en
arrière que le pivot du contrat, et un geste qui doit tourner autour de lui
compense (`pivoter_autour`).
"""

import math

from mathutils import Quaternion, Vector

import bibliotheque as b

#: Le haut de la classe moyenne : le tube la rend plus large que le char léger.
LARGEUR_VISEE = (0.80, 0.84)

# --- Le train : les chenilles et les galets du char léger ---------------------
LONGUEUR_TRAIN = 0.53
Z_TRAIN = -0.115                     # le train recule : le tube pousse l'emprise en avant
DEMI_VOIE = 0.175
LARGEUR_CHENILLE = 0.12
HAUTEUR_CHENILLE = 0.145
RAYON_GALET = 0.05
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.062
Z_GALETS = tuple(round(Z_TRAIN + d, 4) for d in (-0.19, -0.063, 0.063, 0.19))

# --- La caisse : une plateforme basse à l'arrière, un capot avancé -------------
CAISSE_LARGEUR = 0.43                # ses bords couvrent presque tout le dessus des chenilles
CAISSE_BAS = 0.1
PLATEFORME = 0.165                   # le plancher de la plateforme ouverte
CAPOT = 0.225                        # le haut du capot avancé, à la marche
Z_ARRIERE = -0.37
Z_NEZ = 0.153
Z_CAPOT = -0.01                      # l'arrière du capot : devant, la plateforme s'arrête

# --- Le canon ------------------------------------------------------------------
ELEVATION = 40.0                     # tir indirect : relevé de 30 à 45°
AXE = (0.0, math.sin(math.radians(ELEVATION)), math.cos(math.radians(ELEVATION)))
BOUT = (0.0, 0.632, 0.345)           # le bout de la bouche : fixé par les vues « haut » et « droite »
Z_TOURILLON = -0.16
LONGUEUR_CANON = (BOUT[2] - Z_TOURILLON) / AXE[2]                         # 0,659 : plus long que le train
TOURILLON = (0.0, BOUT[1] - LONGUEUR_CANON * AXE[1], Z_TOURILLON)          # y 0,208
RAYON_VOLEE = 0.045
RAYON_BOUCHE = 0.048
LONGUEUR_BOUCHE = 0.05
RAYON_BERCEAU = 0.058                # le berceau, plus épais, enserre l'arrière du tube
BERCEAU = (-0.05, 0.14)              # son étendue le long du tube, depuis le tourillon
DEPART_VOLEE = 0.08                  # le tube part de l'intérieur du berceau
RECUL = 0.07

# --- Le bouclier : une plaque inclinée de 50°, presque perpendiculaire au tube --
INCLINAISON_BOUCLIER = 50.0
DISTANCE_BOUCLIER = 0.04             # devant le tourillon, le long du tube
BOUCLIER = (0.32, 0.22, 0.05)        # largeur, hauteur (dans son plan), épaisseur

# --- Les obus : un râtelier debout sur la plateforme, derrière la culasse -------
OBUS_X = (-0.1, 0.0, 0.1)
OBUS_Z = -0.31
OBUS_RAYON = 0.028
OBUS_HAUTEUR = 0.105

# --- La bêche : une lame large, plantée derrière --------------------------------
BECHE_CHARNIERE = (-0.355, 0.115)    # (z, y)
BECHE_POINTE = (-0.415, 0.012)
BECHE_LARGEUR = 0.26

# --- Les pivots du contrat (`src/assets/production.ts`), en absolu --------------
PIVOT_CORPS = (0.0, 0.16, 0.0)
PIVOT_CANON = (0.0, 0.16 + 0.155, -0.13)
PIVOT_SOCLE = (0.0, 0.185, -0.28)

#: Le point sur lequel la caisse se cabre au départ du coup : l'arrière, au sol.
APPUI_RECUL = (0.0, 0.05, -0.38)


def le_long(p, d, t):
    """Le point `p` avancé de `t` mètres dans la direction `d`."""
    return tuple(a + t * c for a, c in zip(p, d))


def construire(f):
    # Les nœuds du contrat, et les nôtres : le berceau (qui se lève avec le
    # tube sans reculer) et les essieux (qui tournent).
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=PIVOT_CORPS)
    f.noeud('module_canon_long', parent='corps', pivot=PIVOT_CANON)
    f.noeud('berceau', parent='corps', pivot=TOURILLON)
    f.noeud('socle', pivot=PIVOT_SOCLE)

    # Le train : deux bandes de caoutchouc, quatre galets graphite aux moyeux clairs de chaque côté.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE,
                   largeur=LARGEUR_CHENILLE, z_centre=Z_TRAIN)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET,
             epaisseur=EPAISSEUR_GALET, teinte='graphite', teinte_moyeu='os')

    # La caisse, vue de côté : un nez, le capot avancé en coin — un long glacis
    # couché à moins de 30°, qui prend la lumière —, puis la marche qui descend
    # sur la plateforme ouverte, à l'arrière.
    profil = [
        (Z_ARRIERE + 0.02, CAISSE_BAS),
        (Z_NEZ - 0.04, CAISSE_BAS),
        (Z_NEZ, 0.15),
        (Z_CAPOT + 0.02, CAPOT),
        (Z_CAPOT, CAPOT),
        (Z_CAPOT, PLATEFORME),
        (Z_ARRIERE, PLATEFORME),
        (Z_ARRIERE, CAISSE_BAS + 0.02),
    ]
    f.prisme('corps', profil, CAISSE_LARGEUR, 'equipe', nom='caisse')

    # L'affût : deux flasques à la couleur du camp tiennent le tourillon.
    for cote in (1, -1):
        f.boite('corps', (cote * 0.087, PLATEFORME + 0.04, Z_TOURILLON - 0.015), (0.05, 0.1, 0.11), 'equipe',
                nom=f'flasque_{"g" if cote > 0 else "d"}')

    # Le bouclier : une plaque inclinée devant le tourillon, que le tube traverse.
    centre = le_long(TOURILLON, AXE, DISTANCE_BOUCLIER)
    f.boite('corps', centre, BOUCLIER, 'equipe', rotation=[('x', -INCLINAISON_BOUCLIER)], chanfrein=0.02, nom='bouclier')

    # Le berceau : un manchon épais, graphite, qui se lève avec le tube.
    debut, fin = BERCEAU
    f.cylindre('berceau', le_long(TOURILLON, AXE, (debut + fin) / 2), RAYON_BERCEAU, fin - debut, 'graphite', axe=AXE,
               nom='berceau')

    # Le tube : long, épais, bouche d'acier clair ; il part de l'intérieur du berceau.
    f.tube('module_canon_long', depart=le_long(TOURILLON, AXE, DEPART_VOLEE), direction_tube=AXE,
           longueur=LONGUEUR_CANON - DEPART_VOLEE - 0.004, rayon=RAYON_VOLEE, teinte='graphite', bouche=True,
           teinte_bouche='acier_clair', rayon_bouche=RAYON_BOUCHE, longueur_bouche=LONGUEUR_BOUCHE, nom='tube')

    # Les obus : trois ogives claires debout sur la plateforme, derrière la culasse.
    r, hauteur = OBUS_RAYON, OBUS_HAUTEUR
    ogive = [(r, 0.0), (r, 0.55 * hauteur), (0.82 * r, 0.75 * hauteur), (0.45 * r, 0.92 * hauteur), (0.12 * r, hauteur)]
    for i, x in enumerate(OBUS_X):
        f.revolution('corps', (x, PLATEFORME - 0.005, OBUS_Z), ogive, 'os', axe='y', nom=f'obus_{i + 1}')

    # La bêche : une lame large et sombre, de la charnière sous l'arrière jusqu'au sol.
    (zc, yc), (zp, yp) = BECHE_CHARNIERE, BECHE_POINTE
    longueur = math.hypot(zc - zp, yc - yp)
    penche = math.degrees(math.atan2(zc - zp, yc - yp))   # le haut penche vers l'avant
    f.boite('socle', (0.0, (yc + yp) / 2, (zc + zp) / 2), (BECHE_LARGEUR, longueur, 0.05), 'graphite',
            rotation=[('x', penche)], nom='beche')


def pivoter_autour(clip, noeud, point, axe, profil):
    """
    Tourne un nœud autour de `point` (absolu) plutôt que de son pivot : la
    rotation, plus la translation qui garde `point` en place. `profil(t)` rend
    des degrés. Sert quand le contrat fixe le pivot ailleurs que l'articulation
    dessinée.
    """
    n = clip.figurine.noeuds[noeud]
    c = Vector(tuple(a - p for a, p in zip(point, n.pivot)))
    d = b.direction(axe)

    def translation(t):
        r = Quaternion(d, math.radians(profil(t))) @ c
        return tuple(c - r)

    clip.rotation(noeud, lambda t: (axe, profil(t)))
    clip.translation(noeud, translation)


def profil_a_coup(degres, debut=0.0, attaque=0.08, retour=0.4):
    """Le profil de `b.a_coup` : un basculement bref, puis le retour en douceur."""
    def f(t):
        if t < debut:
            return 0.0
        if t < debut + attaque:
            return degres * math.sin(0.5 * math.pi * (t - debut) / attaque)
        return degres * (1 - b.lisse((t - debut - attaque) / retour))
    return f


def profil_affaisse(degres, debut, duree):
    """Le profil de `b.affaisser` : la pose s'installe en douceur, puis tient."""
    return lambda t: degres * b.lisse(min(1.0, max(0.0, (t - debut) / duree)))


def animer(f):
    # Repos : immobile. Le tube ne pivote pas, rien ne bouge.
    b.fixe(f.clip('repos'), 'corps')

    # Déplacement : les galets roulent, la caisse respire à peine sur sa
    # suspension. Le tube reste levé : c'est lui qui la dit, de dos comme de face.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.003, periodes=2)
    b.balancer(d, 'corps', 'x', 0.5, periodes=2, phase=1.2)

    # Tir : le tube recule le long de son axe dans son berceau, la caisse se
    # cabre un instant sur l'arrière, là où la bêche la tient.
    t = f.clip('tir')
    b.recul(t, 'module_canon_long', tuple(-c for c in AXE), RECUL, attaque=0.05, retour=0.4)
    pivoter_autour(t, 'corps', APPUI_RECUL, 'x', profil_a_coup(-1.8, attaque=0.07, retour=0.45))

    # Touché : la caisse vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 3.5, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)

    # Hors jeu : la caisse s'affaisse de biais, du côté lointain (de l'autre,
    # elle s'enfoncerait dans la chenille qu'on voit) ; le tube pique du nez sur
    # son tourillon jusqu'à se poser sur le capot.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.01, 0), rotation=('z', -3.0))
    for noeud in ('berceau', 'module_canon_long'):
        pivoter_autour(h, noeud, TOURILLON, 'x', profil_affaisse(20.0, 0.1, 0.6))
