"""
Le veilleur méridien : le brouilleur du ciel, un prototype des Gris.

Ce qui le dit à 48 pixels : un hexacoptère en étoile — six lames à la couleur
du camp, effilées, qui partent des coins d'un moyeu hexagonal, une barre de
rotor graphite au bout de chacune —, plus gros que les drones du commerce ; au
milieu, une tour de vigie en apprêt, hexagonale, évasée vers le haut, qui
ouvre vers l'avant un gros œil orange, le chevron orange des Gris sur son
crâne ; et derrière, plus haut que tout, le signe commun du brouillage : un
mât d'antennes en arête de poisson aux brins clairs, le même que celui du
brouilleur. Classe moyenne : 0,78 à 0,82 case de large en vue « droite »,
contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le milieu de la classe moyenne : nettement plus gros que les drones (0,61 à 0,66).
LARGEUR_VISEE = (0.78, 0.82)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.25                    # le bas de la quille, des bras et des nacelles au repos (charte : drones à 0,25 m)

#: Les coins du moyeu, en degrés depuis l'avant vers la gauche : 30°, 90°…
#: Les bras en sortent. Vue « droite », deux bras sont à l'horizontale et font
#: la largeur ; l'avant, un pan plat, regarde entre les deux rotors de devant.
PHASE = 30.0

# Le moyeu : une quille graphite à flancs presque droits — évasée, elle
# regardait le sol et la caméra ne la voyait jamais —, un dos d'équipe en
# pyramide tronquée aux pans couchés, qui prennent la lumière.
R_QUILLE = 0.15               # rayon aux coins, en bas
Y_EQUATEUR = 0.3
R_EQUATEUR = 0.175
Y_EPAULE = 0.345              # le haut du dos, le pied de la tour
R_EPAULE = 0.122

# La tour de vigie, en apprêt : un hexagone à pans raides qui s'évase vers le
# haut ; son crâne, plus large, porte le chevron.
Y_TETE = (0.335, 0.485)
R_TETE = (0.074, 0.094)       # au pied, au crâne

# L'œil, au milieu du pan avant de la tour ; son centre sort du pan d'autant.
R_OEIL = 0.053
Y_OEIL = 0.405
SAILLIE_OEIL = 0.02

# Les bras : des lames effilées, du moyeu aux nacelles hexagonales.
R_BRAS = 0.282                # du centre à l'axe d'un rotor
LARGEUR_BRAS = (0.145, 0.09)  # au moyeu, à la nacelle
Y_BRAS = (ALT, 0.3)
R_NACELLE = 0.053
Y_NACELLE = (ALT, 0.31)

# Les rotors : une barre de deux pales graphite sur chaque nacelle, au ras du
# moyeu — plus haut, les deux rotors du fond montaient à l'écran dans
# l'arête de poisson.
Y_ROTOR = 0.32
R_ROTOR = 0.093               # le bout d'une pale : R_BRAS + R_ROTOR fait la largeur
LARGEUR_PALE = 0.046
EPAISSEUR_PALE = 0.03

# Le mât, à l'arrière du crâne, et ses brins.
Z_MAT = -0.058
RAYON_MAT = 0.018
RAYON_BRIN = 0.017
#: (hauteur, longueur), du bas vers le haut. Le premier brin passe juste
#: au-dessus des deux rotors du fond, en vue « droite ».
BRINS = ((0.68, 0.24), (0.78, 0.19), (0.88, 0.14))
SOMMET_MAT = BRINS[-1][0] + 0.03
#: Comme le brouilleur : les brins tournés de 40° vers la gauche, presque à
#: l'horizontale de l'écran en vue « droite », jamais par la tranche en « haut ».
ANGLE_BRINS = 40.0

# Le chevron, sur le crâne de la tour, pointé vers l'avant : il n'en sort que
# de 1,3 cm — ses flancs le font lire à 48 pixels, incrusté il y disparaît.
CHEVRON_POINTE = 0.072        # z de la pointe
CHEVRON_ENVERGURE = 0.072     # demi-largeur
CHEVRON_FLECHE = 0.054        # recul des bouts sur la pointe
CHEVRON_BARRE = 0.038         # épaisseur de la barre, mesurée en z
CHEVRON_SAILLIE = 0.013

#: Les barres au repos, en travers de leur bras (degrés, dans le sens de
#: `tourner`) : au bout d'une lame, un « T » se lit rotor, une barre dans
#: l'axe se lisait bras plus long.
DECALAGE_PALES = 90.0

#: Les rotors dont la barre est dans l'axe du bras au repos : les deux qui
#: font la largeur, à l'horizontale en vue « droite », comme au plus large de
#: leur tour.
RADIAUX = ('rotor_1', 'rotor_4')

#: L'arrêt des rotors hors jeu, d'une image cuite à l'autre : du tiers au
#: neuvième de l'écart entre deux pales, puis plus rien.
ARRET_ROTORS = (60.0, 50.0, 40.0, 30.0, 20.0)


# ---------------------------------------------------------------------------
# Aides locales
# ---------------------------------------------------------------------------

def hexagone(r, y, cx=0.0, cz=0.0, phase=PHASE):
    """Les six coins (x, y, z) d'un hexagone de rayon `r` aux coins, le premier à `phase` degrés de l'avant vers la gauche."""
    return [(cx + r * math.sin(math.radians(phase + 60 * k)), y, cz + r * math.cos(math.radians(phase + 60 * k))) for k in range(6)]


def bras():
    """Les six bras : (nom du rotor, angle depuis l'avant vers la gauche, x, z, sens de rotation) ; deux voisins tournent à l'opposé."""
    sortie = []
    for k in range(6):
        a = PHASE + 60 * k
        sortie.append((f'rotor_{k + 1}', a, R_BRAS * math.sin(math.radians(a)), R_BRAS * math.cos(math.radians(a)), 1 if k % 2 == 0 else -1))
    return sortie


def rotor(f, noeud, centre, angle):
    """
    Un rotor : une barre de deux pales opaques sur son nœud tournant ; la
    nacelle lui sert de moyeu. `angle` : la barre, depuis l'avant vers la
    gauche du modèle, dans le sens de `tourner`. Pas le `rotor()` de la
    bibliothèque : son moyeu graphite de 7,5 cm, six fois, se lirait en plots
    sombres (le drone d'observation l'avait déjà vu).
    """
    f.noeud(noeud, parent='base', pivot=centre, tournant=True)
    f.noeuds[noeud].pales = 2
    f.boite(noeud, centre, (LARGEUR_PALE, EPAISSEUR_PALE, 2 * R_ROTOR), 'graphite', rotation=[('y', angle)], fin=True, nom=f'{noeud}_pales')


def ralentir(clip, noeud, sens, pas):
    """
    Un rotor qui s'arrête : `pas` degrés d'une image cuite à la suivante, puis
    immobile (l'aide du drone d'observation). Cuit net, il se lit image par
    image ; entre deux images, l'angle est interpolé.
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
    # Les nœuds. Le corps porte tout ; la base groupe les six rotors, chacun
    # sur son nœud tournant ; la tour est l'émetteur (`module_radar`), le mât
    # en sort (`module_antenne`), son pivot à son pied.
    f.noeud('corps', pivot=(0, Y_EQUATEUR, 0))
    f.noeud('base', parent='corps', pivot=(0, Y_ROTOR, 0))
    f.noeud('module_radar', parent='corps', pivot=(0, Y_TETE[0], 0))
    f.noeud('module_antenne', parent='module_radar', pivot=(0, Y_TETE[1], Z_MAT))
    f.noeud('socle', pivot=(0, 0, 0))

    # Le moyeu : la quille graphite, le dos d'équipe. Le dos descend un peu
    # dans la quille, de flancs droits : caché, ce pied lui donne son épaisseur
    # (5 cm au moins), les pans restent couchés.
    f.solide('corps', [hexagone(R_QUILLE, ALT), hexagone(R_EQUATEUR, Y_EQUATEUR)], 'graphite', nom='quille')
    f.solide('corps', [hexagone(R_EQUATEUR * 0.9, Y_EQUATEUR - 0.02), hexagone(R_EQUATEUR, Y_EQUATEUR), hexagone(R_EPAULE, Y_EPAULE)],
             'equipe', nom='dos')

    # Les bras : des lames d'équipe effilées, des coins du moyeu aux nacelles
    # hexagonales, qui les dépassent d'un centimètre pour porter le rotor. Ce
    # sont elles qui portent l'équipe : un gros moyeu sous de courts bras se
    # lisait engrenage ou mine flottante, pas hexacoptère.
    for nom, a, x, z, _ in bras():
        u = (math.sin(math.radians(a)), math.cos(math.radians(a)))
        v = (u[1], -u[0])
        anneaux = []
        for d, l in ((0.06, LARGEUR_BRAS[0]), (R_BRAS, LARGEUR_BRAS[1])):
            anneaux.append([(d * u[0] + e * l / 2 * v[0], y, d * u[1] + e * l / 2 * v[1])
                            for e, y in ((-1, Y_BRAS[0]), (1, Y_BRAS[0]), (1, Y_BRAS[1]), (-1, Y_BRAS[1]))])
        f.solide('corps', anneaux, 'equipe', nom=f'bras_{nom[-1]}')
        f.solide('corps', [hexagone(R_NACELLE, Y_NACELLE[0], x, z, phase=a), hexagone(R_NACELLE * 0.85, Y_NACELLE[1], x, z, phase=a)],
                 'equipe', nom=f'nacelle_{nom[-1]}')

    # Les rotors.
    for nom, a, x, z, _ in bras():
        rotor(f, nom, (x, Y_ROTOR, z), a + (0.0 if nom in RADIAUX else DECALAGE_PALES))

    # La tour de vigie, son gros œil orange au-dessus du plan des rotors —
    # posé plus bas, sur le moyeu, le rotor avant droit le cachait en vue
    # « droite » —, et le chevron sur son crâne. Le chevron fait corps avec la
    # tour : il est jugé avec elle.
    tete = f.solide('module_radar', [hexagone(R_TETE[0], Y_TETE[0]), hexagone(R_TETE[1], Y_TETE[1])], 'appret', nom='tete')
    r_oeil = R_TETE[0] + (R_TETE[1] - R_TETE[0]) * (Y_OEIL - Y_TETE[0]) / (Y_TETE[1] - Y_TETE[0])
    apotheme = r_oeil * math.cos(math.radians(30))
    f.boule('module_radar', (0, Y_OEIL, apotheme + SAILLIE_OEIL), R_OEIL, 'orange', nom='oeil')
    p, e, fl, t = CHEVRON_POINTE, CHEVRON_ENVERGURE, CHEVRON_FLECHE, CHEVRON_BARRE
    contour = [(0.0, p), (-e, p - fl), (-e, p - fl - t), (0.0, p - t), (e, p - fl - t), (e, p - fl)]
    chevron = f.extrusion('module_radar', contour, None, Y_TETE[1] - 0.028, Y_TETE[1] + CHEVRON_SAILLIE, 'orange', nom='chevron')
    chevron.avec = tete.nom

    # Le mât en arête de poisson : un fût d'apprêt — les Gris portent l'apprêt
    # là où les autres portent le graphite —, trois brins clairs en travers,
    # un bouton au sommet.
    f.cylindre('module_antenne', (0, (Y_TETE[1] + SOMMET_MAT) / 2 - 0.005, Z_MAT), RAYON_MAT, SOMMET_MAT - Y_TETE[1] + 0.01, 'appret', axe='y',
               fin=True, nom='mat')
    a = math.radians(ANGLE_BRINS)
    d = (math.sin(a), 0.0, math.cos(a))
    for i, (y, longueur) in enumerate(BRINS):
        f.cylindre('module_antenne', (0, y, Z_MAT), RAYON_BRIN, longueur, 'os', axe=d, fin=True, nom=f'brin_{i + 1}')
    f.boule('module_antenne', (0, SOMMET_MAT, Z_MAT), 0.026, 'appret', nom='bouton')


def animer(f):
    rotors = bras()

    # Repos : les six rotors tournent, deux voisins à l'opposé, 30° d'une
    # image cuite à l'autre. Rien d'autre ne bouge : l'ancien veilleur
    # dérivait de quatre pixels.
    r = f.clip('repos')
    for nom, _, _, _, sens in rotors:
        b.tourner(r, nom, 'y', tours=sens)

    # Déplacement : il pique du nez, les rotors s'emballent — deux tours en
    # une seconde, 60° d'une image cuite à l'autre, le tiers de l'écart entre
    # deux pales —, le mât traîne.
    d = f.clip('deplacement')
    for nom, _, _, _, sens in rotors:
        b.tourner(d, nom, 'y', tours=2 * sens)
    d.rotation('corps', lambda t: ('x', 7.0))
    b.osciller(d, 'corps', 'y', 0.005, periodes=2)
    b.balancer(d, 'module_antenne', 'x', -3.0, periodes=2, phase=1.0)

    # Touché : les rotors tournent toujours (30° par image cuite), il roule,
    # vacille et se tasse ; le mât fouette.
    k = f.clip('touche')
    pas = 30.0 * (len(b.instants_cuisson(k)) - 1) / k.duree
    for nom, _, _, _, sens in rotors:
        k.rotation(nom, lambda t, s=sens: ('y', s * pas * t))
    b.secousse(k, 'corps', 'z', 9.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)
    b.secousse(k, 'module_antenne', 'x', 10.0, oscillations=2.5)

    # Hors jeu : les rotors ralentissent et s'arrêtent, il tombe de biais, le
    # nez bas ; le mât se couche sur son flanc droit — vers la caméra de la
    # vue « droite » : il tombe, il ne monte pas dans la case du dessus.
    h = f.clip('hors_jeu')
    for nom, _, _, _, sens in rotors:
        ralentir(h, nom, sens, ARRET_ROTORS)
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 14.0))
    b.affaisser(h, 'corps', rotation=('x', 8.0), debut=0.1, duree=0.7)
    b.affaisser(h, 'module_antenne', rotation=('z', 28.0), debut=0.15, duree=0.6)
