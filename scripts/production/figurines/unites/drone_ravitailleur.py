"""
Le drone ravitailleur : un quadrirotor de jouet qui descend une caisse au bout
de son câble.

Ce qui le dit à 48 pixels : une croix de quatre rotors à deux pales sombres et
nettes, au bout de quatre bras à la couleur du camp, autour d'un plateau
d'équipe ; et, pendue dessous au bout d'un câble sombre, son signe, une caisse
os — celle du transport, commune à tout ce qui ravitaille. Ni patins, ni
verrière, ni carénage en anneau (l'ancien avait deux « volants de voiture »),
aucune arme. Classe petite : 0,62 à 0,66 case de large en vue « droite ».

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le milieu de la classe petite, comme les deux autres drones.
LARGEUR_VISEE = (0.62, 0.66)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

#: Le drone est dessiné dans un repère « canonique » — un X dont les bras
#: partent vers l'avant et l'arrière, de part et d'autre de l'axe — puis
#: tourné de CADRE degrés autour de la verticale (compté de l'avant vers la
#: droite du modèle, −x). La vue « droite » regarde depuis 60° : tourné de
#: −30°, le drone s'y présente de flanc, ses quatre rotors aux coins d'un
#: rectangle, et la caisse se voit entre les deux plus proches. En X non
#: tourné, le rotor avant droit pointe vers la caméra et tombe pile devant la
#: caisse. La vue « bas » (20°) garde ce défaut : aucun cadre ne dégage les
#: deux vues à la fois, elles sont à 40° l'une de l'autre ; on a choisi celle
#: du repos.
CADRE = -30.0
#: Les axes des rotors, canoniques : un rectangle plus long (z) que large
#: (x). Dans la vue « droite », le z canonique fait la largeur à l'écran et le
#: x canonique la profondeur, que la caméra tasse à 0,77 : un rectangle y
#: donne une croix moins haute, et la caisse pend plus bas sans que l'unité
#: grandisse.
DEMI_X_ROTORS = 0.155
DEMI_Z_ROTORS = 0.195

# La caisse : le bas de la silhouette, à l'altitude des drones (0,25 m).
Y_CAISSE = 0.25
CAISSE = (0.105, 0.09, 0.155)         # x, y, z canoniques : un coffre, plus long que profond vu de la vue « droite »

# Le plateau : un carré aux coins très ronds, les flancs qui rentrent en montant.
Y_CORPS = 0.62                        # le dessous du ventre
H_VENTRE = 0.04                       # le ventre, en biseau rentrant sous le plateau
H_CORPS = 0.085                       # du dessous du ventre au dessus du plateau
COTE_VENTRE = 0.10
COTE_CORPS = 0.19
RAYON_COINS = 0.055
RETRAIT_CORPS = 0.025                 # le dessus rentre d'autant : les flancs prennent la lumière

# Les bras, les nacelles des moteurs, les rotors.
LARGEUR_BRAS = (0.13, 0.075)          # au plateau, à la nacelle
RETRAIT_BRAS = 0.01
H_BRAS = 0.05
R_NACELLE = 0.065
H_NACELLE = 0.07
R_ROTOR = 0.10
LARGEUR_PALE = 0.05
EPAISSEUR_PALE = 0.03
R_MOYEU = 0.03
H_MOYEU = 0.05
#: À 30°, une barre à deux pales d'axe y est horizontale dans la vue « droite ».
ANGLE_PALES = 30.0

# Le câble et son treuil.
R_CABLE = 0.016
R_TREUIL = 0.03
MANILLE = (0.04, 0.03, 0.075)         # x, y, z canoniques

#: Ce dont l'appareil verse en fin de hors jeu, en degrés.
BASCULE_HORS_JEU = 12.0


# ---------------------------------------------------------------------------
# Aides locales
# ---------------------------------------------------------------------------

def horizontale(phi, longueur=1.0):
    """Le point (x, z) à `longueur` dans la direction horizontale `phi` (degrés, de l'avant vers la droite)."""
    r = math.radians(phi)
    return (-math.sin(r) * longueur, math.cos(r) * longueur)


def tourner_xz(points, phi):
    """Des points (x, z) tournés de `phi` degrés, de l'avant vers la droite."""
    r = math.radians(phi)
    c, s = math.cos(r), math.sin(r)
    return [(x * c - z * s, x * s + z * c) for x, z in points]


def rotor_a_pales(f, noeud, centre):
    """
    Un rotor à deux pales opaques, graphite, sur un moyeu court à demi noyé
    dans sa nacelle ; le nœud est tournant, son pivot sur l'axe.

    Pas `f.rotor` : son moyeu fait 2,5 fois l'épaisseur d'une pale (7,5 cm
    pour la pale la plus mince permise, 3 cm) et au moins 7 cm de large ; sur
    un drone de 0,64 case, les quatre moyeux faisaient près de la moitié des
    pixels des rotors, et la masse sombre passait 35 %. Ici, 6 cm sur 5, dont
    2 dans la nacelle. Les pales sont celles de `f.rotor` : même géométrie,
    même départ (la première vers l'arrière à 0°, tournée de ANGLE_PALES dans
    le sens de `b.tourner`), même chanfrein.
    """
    cx, cy, cz = centre
    f.noeud(noeud, parent='base', pivot=centre, tournant=True)
    # Ce que `f.rotor` déclare, pour que le rapport contrôle le pas apparent
    # d'une image cuite à l'autre (`_verifier_rotors`).
    f.noeuds[noeud].axe_tour = 'y'
    f.noeuds[noeud].pales = 2
    f.cylindre(noeud, (cx, cy + 0.005, cz), R_MOYEU, H_MOYEU, 'graphite', axe='y', nom=f'{noeud}_moyeu')
    longueur = R_ROTOR - 0.02
    for k in range(2):
        a = ANGLE_PALES + 180.0 * k
        ra = math.radians(a)
        r = 0.02 + longueur / 2
        c = (cx - math.sin(ra) * r, cy, cz - math.cos(ra) * r)
        f.boite(noeud, c, (LARGEUR_PALE, EPAISSEUR_PALE, longueur), 'graphite', rotation=[('y', a)],
                chanfrein=0.45 * EPAISSEUR_PALE, fin=True, nom=f'{noeud}_pale_{k + 1}')


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    y_dessus = Y_CORPS + H_CORPS
    y_rotors = y_dessus + 0.03
    y_caisse_haut = Y_CAISSE + CAISSE[1]
    y_treuil = Y_CORPS - R_TREUIL + 0.01

    # Les nœuds : le corps (plateau, bras, nacelles), la base (les rotors, un
    # nœud tournant chacun), le câble (`module_grue`, pivot sur le treuil) et
    # la caisse (`module_nacelle`), pendue au câble.
    f.noeud('corps', pivot=(0, Y_CORPS, 0))
    f.noeud('base', parent='corps', pivot=(0, y_rotors, 0))
    f.noeud('module_grue', parent='corps', pivot=(0, y_treuil, 0))
    f.noeud('module_nacelle', parent='module_grue', pivot=(0, y_caisse_haut, 0))
    f.noeud('socle', pivot=(0, 0, 0))

    # Le plateau.
    def carre(cote, rayon):
        return tourner_xz(b.contour_rectangle(0, 0, cote, cote, rayon), CADRE)

    # Un seul solide, en trois anneaux : le ventre, qui rentre en descendant
    # — la caméra, 50° au-dessus de l'horizon, ne le voit pas : le bord bas
    # du corps, à l'écran, est le rebord du plateau, et c'est ce qui laisse
    # voir le câble sous lui —, le rebord, puis le dessus, en retrait.
    y_rebord = Y_CORPS + H_VENTRE
    anneaux = [[(x, y, z) for x, z in carre(cote, rayon)] for y, cote, rayon in (
        (Y_CORPS, COTE_VENTRE, RAYON_COINS * COTE_VENTRE / COTE_CORPS),
        (y_rebord, COTE_CORPS, RAYON_COINS),
        (y_dessus, COTE_CORPS - 2 * RETRAIT_CORPS, RAYON_COINS - RETRAIT_CORPS))]
    f.solide('corps', anneaux, 'equipe', nom='plateau')

    # Les bras (leur dessus 5 mm sous celui du plateau : pas de faces
    # confondues) et les nacelles des moteurs, trapues, dont le dessus arrive
    # juste sous les pales et cache le pied du moyeu.
    axes = [(-DEMI_X_ROTORS, DEMI_Z_ROTORS), (-DEMI_X_ROTORS, -DEMI_Z_ROTORS), (DEMI_X_ROTORS, -DEMI_Z_ROTORS),
            (DEMI_X_ROTORS, DEMI_Z_ROTORS)]
    for i, (xc, zc) in enumerate(axes):
        longueur = math.hypot(xc, zc)
        phi = math.degrees(math.atan2(-xc, zc)) + CADRE
        # Un bras en coin, vu de dessus : large au plateau, fin à la nacelle ;
        # ses flancs rentrent un peu en montant, pour prendre la lumière.
        d = horizontale(phi)
        n = horizontale(phi + 90.0)

        def trapeze(retrait):
            p0, p1 = 0.03, longueur
            l0, l1 = LARGEUR_BRAS[0] / 2 - retrait, LARGEUR_BRAS[1] / 2 - retrait
            return [(d[0] * p + n[0] * e, d[1] * p + n[1] * e) for p, e in ((p1, l1), (p0, l0), (p0, -l0), (p1, -l1))]

        y_bras = y_dessus - 0.005
        f.extrusion('corps', trapeze(0.0), trapeze(RETRAIT_BRAS), y_bras - H_BRAS, y_bras, 'equipe', nom=f'bras_{i + 1}')
        xn, zn = horizontale(phi, longueur)
        y_nacelle = y_rotors - EPAISSEUR_PALE / 2 - H_NACELLE / 2
        f.cylindre('corps', (xn, y_nacelle, zn), R_NACELLE, H_NACELLE, 'equipe', axe='y', nom=f'nacelle_{i + 1}')
        rotor_a_pales(f, f'rotor_{i + 1}', (xn, y_rotors, zn))

    # Le treuil, sous le ventre, en travers de la vue « droite », et le câble.
    ux, uz = horizontale(CADRE)
    f.cylindre('module_grue', (0, y_treuil, 0), R_TREUIL, 0.08, 'graphite', axe=(ux, 0.0, uz), nom='treuil')
    l_cable = y_treuil - y_caisse_haut
    f.cylindre('module_grue', (0, y_caisse_haut + l_cable / 2, 0), R_CABLE, l_cable, 'graphite', axe='y', fin=True,
               nom='cable')

    # La manille, où le câble prend la caisse : une barrette graphite posée en
    # travers du couvercle.
    f.boite('module_grue', (0, y_caisse_haut + MANILLE[1] / 2 - 0.004, 0), MANILLE, 'graphite', rotation=[('y', -CADRE)],
            fin=True, nom='manille')

    # La caisse, tournée avec le cadre : de face dans la vue « droite ».
    f.boite('module_nacelle', (0, Y_CAISSE + CAISSE[1] / 2, 0), CAISSE, 'os', rotation=[('y', -CADRE)], nom='caisse')


def tourner_par_images(clip, noeud, angles):
    """
    Un rotor qui passe, image cuite après image cuite, par les `angles` donnés
    (degrés autour de y, depuis le repos), puis s'y tient : un rotor qui
    ralentit et s'arrête. Entre deux images, l'angle suit une droite ; la
    cuisson ne photographie que les images, nettes.
    """
    ts = b.instants_cuisson(clip)
    angles = list(angles) + [angles[-1]] * (len(ts) - len(angles))

    def f(t):
        if t <= ts[0]:
            return ('y', angles[0])
        for k in range(1, len(ts)):
            if t <= ts[k]:
                u = (t - ts[k - 1]) / (ts[k] - ts[k - 1])
                return ('y', angles[k - 1] + (angles[k] - angles[k - 1]) * u)
        return ('y', angles[-1])

    clip.rotation(noeud, f)


def sens(i):
    """Les rotors tournent en croix : 1 et 3 dans un sens, 2 et 4 dans l'autre."""
    return 1 if i % 2 == 0 else -1


def animer(f):
    rotors = [f'rotor_{i + 1}' for i in range(4)]

    # Repos : les rotors tournent (un tour par boucle : 30° d'une image à
    # l'autre) ; la caisse se balance à peine au bout de son câble, sur une
    # petite ellipse centrée (1,3° et 0,9° : jamais 2°).
    r = f.clip('repos')
    for i, n in enumerate(rotors):
        b.tourner(r, n, 'y', tours=sens(i))
    T = r.duree
    r.rotation('module_grue', lambda t: ('z', 1.3 * math.sin(2 * math.pi * t / T)))
    r.rotation('module_grue', lambda t: ('x', 0.9 * math.cos(2 * math.pi * t / T)))

    # Déplacement : les rotors tournent deux fois plus vite, l'appareil pique
    # du nez pour avancer, la caisse traîne un peu derrière et se balance.
    d = f.clip('deplacement')
    for i, n in enumerate(rotors):
        b.tourner(d, n, 'y', tours=2 * sens(i))
    d.rotation('corps', lambda t: ('x', 7.0))
    b.osciller(d, 'corps', 'y', 0.006, periodes=2)
    d.rotation('module_grue', lambda t: ('x', -3.0))
    b.balancer(d, 'module_grue', 'x', 2.0, periodes=1)

    # Touché : l'appareil vacille et se tasse, la caisse se balance à contretemps.
    k = f.clip('touche')
    for i, n in enumerate(rotors):
        b.tourner(k, n, 'y', tours=0.5 * sens(i))
    b.secousse(k, 'corps', 'z', 8.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)
    b.secousse(k, 'module_grue', 'z', -9.0, debut=0.05, oscillations=1.5)

    # Hors jeu : les rotors ralentissent et s'arrêtent, pas à pas lisibles
    # (de 30° à 18° d'une image à l'autre, jamais sous le dixième de l'écart
    # entre les pales) ; l'appareil descend poser sa caisse au sol, puis
    # verse sur le côté, dans le plan de la vue « droite » — autour de l'axe
    # de sa caméra, sur l'arête de la caisse à droite de l'écran : la croix
    # penche comme un jouet qu'on lâche, et la caisse reste en vue sous elle.
    h = f.clip('hors_jeu')
    angles = [0]
    for p in (30, 28, 26, 24, 22, 20, 18):
        angles.append(angles[-1] + p)
    for i, n in enumerate(rotors):
        tourner_par_images(h, n, [a * sens(i) for a in angles])
    ax, az = tourner_xz([(0.0, CAISSE[2] / 2)], CADRE)[0]    # le milieu de l'arête avant canonique : à droite de l'écran
    cx, cz = horizontale(60.0)                              # vers la caméra de la vue « droite »
    b.affaisser(h, 'corps', descente=(0, -Y_CAISSE, 0), duree=0.55)
    b.affaisser(h, 'corps', rotation=((cx, 0.0, cz), -BASCULE_HORS_JEU), debut=0.4, duree=0.45, centre=(ax, Y_CAISSE, az))
