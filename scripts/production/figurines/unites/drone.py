"""
Le drone d'observation : un petit quadrirotor de jouet qui ouvre un gros œil.

Ce qui le dit à 48 pixels : une croix de quatre bras fins à la couleur du camp
autour d'un corps en dôme, quatre rotors sombres à deux pales nettes au bout
des bras, et dessous, pendue au ventre, son signe, commun à tout ce qui voit
loin : une grosse boule-caméra claire, posée dans un berceau sombre, dont
l'objectif — une pupille noire — regarde le joueur. Ni patins, ni verrière, ni queue : ce
n'est pas un hélicoptère. Classe petite : 0,60 à 0,64 case de large en vue
« droite », contour compris.

Les bras vont vers l'avant, l'arrière et les deux flancs. Vue sous le lacet
de 60° de la vue « droite », cette croix-là se lit en X — une croix aux bras
en diagonale s'y lirait en « + », son bras avant droit pointé droit sur la
caméra, devant l'œil — et elle laisse sous le corps un creux où l'œil se
montre entre deux rotors.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le bas de la classe petite : le plus petit appareil du ciel.
LARGEUR_VISEE = (0.60, 0.64)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.25                    # le bas du berceau au repos (charte : drones à 0,25 m)

# L'œil : une grosse boule claire qui pend sous le ventre, posée dans un
# berceau sombre, et son objectif. Le berceau est le sombre qui assoit
# l'appareil : vu d'en haut, un ventre se cache sous le corps, lui pas.
R_OEIL = 0.084
Z_OEIL = 0.04
JEU_BERCEAU = 0.01            # le berceau déborde la boule d'autant
PART_BERCEAU = 0.32           # sa hauteur, en part du diamètre de la boule
Y_OEIL = ALT + R_OEIL + JEU_BERCEAU
#: L'objectif : un disque sombre qui sort de la boule, la pupille de l'œil. En
#: verre, il se lisait clair : très lisse, il renvoie le ciel sous cet angle,
#: et le reflet que la charte peint sur son tiers haut en faisait un œil
#: mi-clos. En graphite, à 48 pixels, c'est un point noir dans une boule
#: claire : un œil ouvert.
R_OBJECTIF = 0.039
EPAISSEUR_OBJECTIF = 0.05
SAILLIE_OBJECTIF = 0.012      # ce que sa face dépasse de la boule
#: L'objectif regarde devant, tourné de 45° vers la droite du modèle et levé
#: de 30° : il fait presque face à la caméra des vues « droite » (23° d'écart)
#: et « bas » (27°) — l'œil regarde le joueur. Plus levé, le corps le cache.
CAP_OBJECTIF = 45.0
SITE_OBJECTIF = 30.0
R_COU = 0.036                 # le cou du cardan, entre le ventre et la boule

# Le corps : un dôme d'équipe posé sur un tambour sombre à flancs droits.
DEMI_LARGEUR = 0.1
DEMI_LONGUEUR = 0.1
Y_FLANC = 0.51                # la ligne la plus large, le haut du tambour
HAUT_DOME = 0.065
LEVRE = 0.006                 # ce que le dôme descend sous sa ligne la plus large
HAUT_TAMBOUR = 0.05
RETRAIT_TAMBOUR = 0.86        # le fond du tambour, en part du haut

# Les bras, plats et fins, et leurs nacelles.
D_BRAS = 0.22                 # du centre à l'axe d'un moteur
LARGEUR_BRAS = 0.06
HAUT_BRAS = 0.05
R_NACELLE = 0.032
H_NACELLE = 0.05

# Les rotors : une barre de deux pales graphite, sur la nacelle.
Y_ROTOR = 0.56
R_ROTOR = 0.09
LARGEUR_PALE = 0.03
EPAISSEUR_PALE = 0.03
#: Les pales au repos. À 30°, une barre est horizontale dans la vue « droite » :
#: celles de l'avant et de l'arrière, qui font la largeur. Les deux autres sont
#: en diagonale — quatre barres parallèles se lisaient en lattes —, et à 150°
#: celle du rotor droit, en bas à gauche de l'image, ne barre pas l'œil.
ANGLE_PALES = {'av': 30.0, 'ar': 30.0, 'g': 150.0, 'd': 150.0}

# L'antenne, sur l'arrière du dôme, penchée vers l'arrière.
Z_ANTENNE = -0.06
HAUT_ANTENNE = 0.06
INCLINAISON_ANTENNE = -20.0

#: En déplacement, les rotors de l'avant et de l'arrière partent le long de leur
#: bras : dans les vues « bas » et « haut », que montre ce clip, une barre en
#: travers passerait devant l'œil.
DECALAGE_DEPLACEMENT = {'av': -30.0, 'ar': -30.0, 'g': 0.0, 'd': 0.0}

#: L'arrêt des rotors hors jeu, d'une image cuite à l'autre : de 60° à 20°
#: (un tiers à un neuvième de l'écart entre deux pales), puis plus rien.
ARRET_ROTORS = (60.0, 50.0, 40.0, 30.0, 20.0)


# ---------------------------------------------------------------------------
# Aides locales
# ---------------------------------------------------------------------------

def _galet(z, retrait=1.0):
    """Demi-largeur du dôme à l'abscisse z (une ellipse vue de dessus), et son facteur de hauteur."""
    u = min(1.0, abs(z) / (DEMI_LONGUEUR * retrait))
    k = math.sqrt(max(0.0, 1 - u ** 2.4))
    return DEMI_LARGEUR * retrait * k, max(k, 0.25)


def _profil_dome(z):
    a, k = _galet(z)
    return max(a, 0.004), Y_FLANC, HAUT_DOME * k ** 0.6, LEVRE * k


def _ellipse(rx, rz, y, n=64):
    """Un anneau elliptique (x, y, z), dans le sens des angles croissants."""
    return [(rx * math.cos(2 * math.pi * i / n), y, rz * math.sin(2 * math.pi * i / n)) for i in range(n)]


def _moteurs():
    """Les quatre moteurs : (nom, x, z, sens de rotation) — avant, gauche, arrière, droit ; les opposés tournent ensemble."""
    return [('av', 0.0, D_BRAS, 1), ('g', D_BRAS, 0.0, -1), ('ar', 0.0, -D_BRAS, 1), ('d', -D_BRAS, 0.0, -1)]


def rotor(f, noeud, parent, centre, rayon, angle):
    """
    Un rotor : une barre de deux pales opaques, sur son nœud tournant. La
    nacelle d'équipe lui sert de moyeu. `rotor()` de la bibliothèque pose un
    moyeu graphite de 7,5 cm de haut : à cette taille, quatre moyeux se lisent
    en plots sombres et font un quart de l'appareil.
    """
    f.noeud(noeud, parent=parent, pivot=centre, tournant=True)
    f.noeuds[noeud].pales = 2
    f.boite(noeud, centre, (LARGEUR_PALE, EPAISSEUR_PALE, 2 * rayon), 'graphite', rotation=[('y', angle)], fin=True, nom=f'{noeud}_pales')


def ralentir(clip, noeud, sens, pas):
    """
    Un rotor qui s'arrête : `pas` degrés d'une image cuite à la suivante, puis
    immobile. Cuit net, il se lit image par image ; entre deux images, l'angle
    est interpolé, la cuisson ne le voit pas.
    """
    temps = b.instants_cuisson(clip)
    angles = [0.0]
    for k in range(1, len(temps)):
        angles.append(angles[-1] + (pas[k - 1] if k - 1 < len(pas) else 0.0))

    def f(t):
        if t <= temps[0]:
            return ('y', 0.0)
        for k in range(1, len(temps)):
            if t <= temps[k]:
                u = (t - temps[k - 1]) / (temps[k] - temps[k - 1])
                return ('y', sens * (angles[k - 1] + (angles[k] - angles[k - 1]) * u))
        return ('y', sens * angles[-1])

    clip.rotation(noeud, f)


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds. Le corps porte tout ; la base est le groupe des quatre rotors,
    # chacun sur son nœud tournant ; l'œil a le sien, il balaie au repos ;
    # l'antenne est le module de la fiche.
    y_antenne = Y_FLANC + HAUT_DOME * 0.8
    f.noeud('corps', pivot=(0, Y_FLANC, 0))
    f.noeud('base', parent='corps', pivot=(0, Y_ROTOR, 0))
    f.noeud('module_antenne', parent='corps', pivot=(0, y_antenne, Z_ANTENNE))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('oeil', parent='corps', pivot=(0, Y_OEIL, Z_OEIL), mobile=True)

    # Le corps : le dôme à la couleur du camp, le tambour sombre dessous.
    f.fuseau('corps', _profil_dome, -DEMI_LONGUEUR, DEMI_LONGUEUR, 'equipe', sections=48, exposants=(2.0, 2.0), nom='dome')
    y0 = Y_FLANC - HAUT_TAMBOUR
    anneaux = [_ellipse(DEMI_LARGEUR * RETRAIT_TAMBOUR, DEMI_LONGUEUR * RETRAIT_TAMBOUR, y0),
               _ellipse(DEMI_LARGEUR * 0.97, DEMI_LONGUEUR * 0.97, y0 + HAUT_TAMBOUR * 0.35),
               _ellipse(DEMI_LARGEUR * 0.985, DEMI_LONGUEUR * 0.985, Y_FLANC + 0.002)]
    f.solide('corps', anneaux, 'graphite', nom='tambour')

    # Les bras et leurs nacelles, à la couleur du camp.
    for nom, x, z, _ in _moteurs():
        longueur = math.hypot(x, z)
        cap = math.degrees(math.atan2(x, z))
        f.boite('corps', (x / 2, Y_FLANC, z / 2), (LARGEUR_BRAS, HAUT_BRAS, longueur), 'equipe', rotation=[('y', cap)], nom=f'bras_{nom}')
        f.cylindre('corps', (x, Y_ROTOR - 0.008 - H_NACELLE / 2, z), R_NACELLE, H_NACELLE, 'equipe', axe='y', nom=f'nacelle_{nom}')

    # Les rotors.
    for nom, x, z, _ in _moteurs():
        rotor(f, f'rotor_{nom}', 'base', (x, Y_ROTOR, z), R_ROTOR, ANGLE_PALES[nom])

    # Le cou du cardan, sous le ventre ; la boule claire qu'il tient, son
    # objectif qui regarde le joueur, et le berceau sombre dessous.
    y_haut = Y_FLANC - HAUT_TAMBOUR + 0.015
    y_bas = Y_OEIL + R_OEIL * 0.7
    f.cylindre('corps', (0, (y_haut + y_bas) / 2, Z_OEIL), R_COU, y_haut - y_bas, 'graphite', axe='y', nom='cou')
    centre = (0, Y_OEIL, Z_OEIL)
    f.boule('oeil', centre, R_OEIL, 'os', nom='boule_oeil')
    cap, site = math.radians(CAP_OBJECTIF), math.radians(SITE_OBJECTIF)
    visee = (-math.sin(cap) * math.cos(site), math.sin(site), math.cos(cap) * math.cos(site))
    avance = R_OEIL + SAILLIE_OBJECTIF - EPAISSEUR_OBJECTIF / 2
    f.cylindre('oeil', tuple(c + avance * v for c, v in zip(centre, visee)), R_OBJECTIF, EPAISSEUR_OBJECTIF, 'graphite', axe=visee,
               nom='objectif')
    rb = R_OEIL + JEU_BERCEAU
    haut_b = 2 * R_OEIL * PART_BERCEAU + JEU_BERCEAU
    profil = []
    for i in range(17):
        h = haut_b * i / 16
        profil.append((max(0.004, math.sqrt(max(0.0, rb ** 2 - (rb - h) ** 2))), h))
    profil.append((0.004, haut_b))
    f.revolution('oeil', (0, Y_OEIL - rb, Z_OEIL), profil, 'graphite', nom='berceau')

    # L'antenne.
    f.antenne('module_antenne', (0, y_antenne, Z_ANTENNE), HAUT_ANTENNE, inclinaison=('x', INCLINAISON_ANTENNE), boule=False, nom='antenne')


def animer(f):
    moteurs = _moteurs()

    # Repos : les quatre rotors tournent, les opposés dans le même sens ; l'œil
    # balaie lentement l'horizon. Rien d'autre ne bouge.
    r = f.clip('repos')
    for nom, _, _, sens in moteurs:
        b.tourner(r, f'rotor_{nom}', 'y', tours=sens)
    b.balancer(r, 'oeil', 'y', 15.0, periodes=1)

    # Déplacement : il pique du nez pour avancer, les rotors s'emballent,
    # l'antenne traîne.
    d = f.clip('deplacement')
    for nom, _, _, sens in moteurs:
        decalage = DECALAGE_DEPLACEMENT[nom]
        if decalage:
            d.rotation(f'rotor_{nom}', lambda t, a=decalage: ('y', a))
        b.tourner(d, f'rotor_{nom}', 'y', tours=2 * sens)
    d.rotation('corps', lambda t: ('x', 8.0))
    b.osciller(d, 'corps', 'y', 0.005, periodes=2)
    b.balancer(d, 'module_antenne', 'x', -3.0, periodes=2, phase=1.0)

    # Touché : il roule, vacille et se tasse, l'œil sursaute, l'antenne fouette.
    k = f.clip('touche')
    for nom, _, _, sens in moteurs:
        b.tourner(k, f'rotor_{nom}', 'y', tours=sens)
    b.secousse(k, 'corps', 'z', 10.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)
    b.secousse(k, 'oeil', 'y', 14.0, oscillations=3)
    b.secousse(k, 'module_antenne', 'x', 10.0, oscillations=2.5)

    # Hors jeu : les rotors ralentissent et s'arrêtent, il tombe de biais, le
    # nez bas ; l'œil roule vers le sol et sa pupille quitte le joueur — il se
    # ferme —, l'antenne se couche.
    h = f.clip('hors_jeu')
    for nom, _, _, sens in moteurs:
        ralentir(h, f'rotor_{nom}', sens, ARRET_ROTORS)
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 16.0))
    b.affaisser(h, 'corps', rotation=('x', 8.0), debut=0.1, duree=0.7)
    b.affaisser(h, 'oeil', rotation=('x', 55.0), debut=0.2, duree=0.6)
    b.affaisser(h, 'module_antenne', rotation=('x', -25.0), debut=0.15, duree=0.6)
