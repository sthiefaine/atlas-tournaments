"""
Le bombardier : la baleine du ciel, un quadrimoteur de jouet au ventre rond.

Ce qui le dit à 48 pixels : la plus grande envergure du ciel, une aile droite
très large à la couleur du camp, d'une seule pièce, aux saumons arrondis ;
quatre gros moteurs graphite pendus dessous, qui dépassent du bord d'attaque
avec leur cône os et leur hélice ; un gros fuselage graphite, une arête dorsale
à la couleur du camp qui s'élargit en selle sur l'emplanture ; un nez vitré en
obus ; une grande dérive à la couleur du camp sur un empennage graphite. Sous
le ventre, la soute : une grosse bombe os à demi sortie entre deux trappes, qui
s'ouvrent au tir.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le haut de la grande classe : le plus grand du ciel, au-dessus du chasseur (0,88–0,90).
LARGEUR_VISEE = (0.92, 0.94)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.30                    # bas de la silhouette au repos (charte : avions à 0,30 m) : le bas de la bombe

# Le fuselage : un gros cigare, de la pointe de la queue au nez vitré.
Z_AR = -0.465                 # la pointe de la queue
Z_QUEUE = -0.08               # où la queue commence à s'effiler
Z_NEZ = 0.398                 # le centre du nez vitré : le fuselage s'y arrête
L_NEZ = 0.11                  # le fuselage se resserre sur cette longueur avant le nez
K_NEZ = 0.84                  # jusqu'à cette part de sa section : un nez en obus
A_FUS = 0.118                 # demi-largeur
Y_LIGNE = 0.45                # la ligne la plus large
H_DOS = 0.098                 # du flanc le plus large au sommet du dos
H_VENTRE = 0.098              # du flanc le plus large au fond du ventre, au nez
BOSSE_VENTRE = 0.012          # le ventre rond : ce qu'il descend de plus sous l'aile
Z_BOSSE, L_BOSSE = 0.06, 0.19

# La queue : où elle finit (ligne la plus large, demi-hauteurs, demi-largeur).
# Elle converge presque droit vers l'arrière, dos et ventre ensemble : un
# ventre qui remonte seul ferait la rampe d'un cargo.
Y_LIGNE_AR = 0.48
H_DOS_AR = 0.022
H_VENTRE_AR = 0.018
A_AR = 0.034
ARRONDI_AR = 0.03             # la pointe de la queue s'arrondit sur ce qu'il reste

# Le dos à la couleur du camp : la calotte du fuselage au-dessus d'un plan
# levé de β degrés sur la ligne la plus large, qui déborde de COUVRE. Une arête
# étroite (β = 60°) devant et derrière l'aile ; une selle (β = 30°) au droit de
# l'emplanture, qui descend jusqu'au dessus de l'aile : l'équipe de l'aile, du
# dos et de la dérive ne fait qu'une pièce à l'écran. Une demi-superellipse
# d'exposant 1,6 suit l'arc du fuselage à 1,3 mm en dessous et 3,3 mm au-dessus
# pour ces deux angles : avec COUVRE, le dos flotte de 1 à 6 mm sur le graphite,
# qui ne perce jamais.
BETA_ARETE = 60.0
BETA_SELLE = 30.0
TRANSITION_SELLE = 0.04
COUVRE = 0.0025
EXPOSANT_DOS = 1.6

# La voilure, d'une seule pièce, à mi-hauteur du fuselage (celle d'un B-29,
# pas d'un cargo) : son dessus affleure le bord de la selle.
Y_AILE_HAUT = Y_LIGNE + H_DOS * math.sin(math.radians(BETA_SELLE))
EP_AILE = 0.055
Y_AILE_BAS = Y_AILE_HAUT - EP_AILE
DEMI_ENVERGURE = 0.455
Z_BA_AXE, Z_BA_SAUMON = 0.13, 0.065       # bord d'attaque : à peine de flèche
Z_BF_AXE, Z_BF_SAUMON = -0.105, -0.065    # bord de fuite : il avance vers le saumon
ARRONDI_SAUMON = 0.07                     # le saumon, une demi-ellipse de cette profondeur

# L'empennage horizontal, graphite, au travers de la queue.
Y_EMP = 0.48
EP_EMP = 0.05
DEMI_ENV_EMP = 0.17
Z_BA_EMP_AXE, Z_BA_EMP_SAUMON = -0.30, -0.335
Z_BF_EMP_AXE, Z_BF_EMP_SAUMON = -0.44, -0.42
ARRONDI_EMP = 0.045

# La dérive, à la couleur du camp : haute, le bord d'attaque en flèche, le haut arrondi.
Y_DERIVE_PIED = 0.48
Y_DERIVE_HAUT = 0.685         # le haut des bords droits ; l'arrondi monte au-dessus
Z_DERIVE_BA = (-0.24, -0.37)  # le bord d'attaque, du pied au haut
Z_DERIVE_BF = -0.465
ARRONDI_DERIVE = 0.045        # la hauteur de l'arrondi du haut
EP_DERIVE = 0.05

# Le nez vitré : un œuf de verre au bout de l'obus, le reflet peint sur son tiers haut.
R_NEZ = (A_FUS * K_NEZ, H_DOS * K_NEZ, 0.10)

# Les quatre moteurs : leurs x, une nacelle graphite pendue sous l'aile, et
# devant, une hélice à trois pales derrière un cône os.
X_MOTEURS = (0.20, 0.325)
R_NACELLE = 0.056
Y_MOTEUR = Y_AILE_BAS - 0.007
#: Le plan de l'hélice, devant le bord d'attaque : moteur intérieur, moteur
#: extérieur. Les deux disques se chevauchent en x ; décalés de 5 cm en z, ils
#: ne se croisent jamais.
AVANCE_HELICE = (0.105, 0.07)
R_HELICE = 0.075
LARGEUR_PALE = 0.045
EPAISSEUR_PALE = 0.03
R_CONE = 0.038
#: Les pales au repos, un moteur après l'autre (de droite à gauche) : pas toutes
#: en phase, ce qui ferait une machine.
PHASES = (0.0, 50.0, 20.0, 80.0)

# La soute, sous le ventre : la bombe à demi sortie, entre deux trappes.
Z_SOUTE = (0.01, 0.25)
R_BOMBE = 0.04
L_BOMBE = 0.23
Y_BOMBE = ALT + R_BOMBE
Z_BOMBE = 0.13                # le milieu de la bombe, de la queue au nez
EP_TRAPPE = 0.05
X_CHARNIERE = 0.10            # les trappes s'articulent sur les flancs du ventre
OUVERTURE = 95.0              # l'angle d'ouverture des trappes, au tir

# Le pivot du corps : au milieu de l'aile.
Y_PIVOT = (Y_AILE_HAUT + Y_AILE_BAS) / 2


# ---------------------------------------------------------------------------
# Les profils
# ---------------------------------------------------------------------------

def _mix(a, c, t):
    return a + (c - a) * t


def _section(z):
    """Le fuselage à l'abscisse z : (demi-largeur, ligne la plus large, hauteur du dos, hauteur du ventre)."""
    bosse = BOSSE_VENTRE * math.exp(-((z - Z_BOSSE) / L_BOSSE) ** 2)
    if z >= Z_NEZ - L_NEZ:
        k = 1 - (1 - K_NEZ) * b.lisse((z - (Z_NEZ - L_NEZ)) / L_NEZ)
        return A_FUS * k, Y_LIGNE, H_DOS * k, (H_VENTRE + bosse) * k
    if z >= Z_QUEUE:
        return A_FUS, Y_LIGNE, H_DOS, H_VENTRE + bosse
    u = (Z_QUEUE - z) / (Z_QUEUE - Z_AR)
    l = b.lisse(u)
    a = _mix(A_FUS, A_AR, l)
    ym = _mix(Y_LIGNE, Y_LIGNE_AR, l)
    hh = _mix(H_DOS, H_DOS_AR, l)
    hb = _mix(H_VENTRE + bosse, H_VENTRE_AR, l)
    if z < Z_AR + ARRONDI_AR:
        # La pointe : un quart d'ellipse, pas une coupe franche.
        k = max(0.18, math.sqrt(max(0.0, 1 - ((Z_AR + ARRONDI_AR - z) / ARRONDI_AR) ** 2)))
        a, hh, hb = a * k, hh * k, hb * k
    return a, ym, hh, hb


def _profil_fuselage(z):
    return _section(z)


def _beta(z):
    """L'angle du bord du dos à l'abscisse z : la selle sur l'emplanture, l'arête ailleurs, un fondu entre les deux."""
    z0, z1 = Z_BF_AXE - 0.01, Z_BA_AXE + 0.01
    if z < z0:
        w = 1 - b.lisse((z0 - z) / TRANSITION_SELLE)
    elif z > z1:
        w = 1 - b.lisse((z - z1) / TRANSITION_SELLE)
    else:
        w = 1.0
    return _mix(BETA_ARETE, BETA_SELLE, w)


def _profil_dos(z):
    """La calotte d'équipe : au-dessus du plan levé de β sur la ligne la plus large, un peu plus grande que le fuselage."""
    a, ym, hh, _ = _section(z)
    beta = math.radians(_beta(z))
    s, c = math.sin(beta), math.cos(beta)
    haut = hh * (1 - s) + COUVRE
    # Le dessous plonge dans le fuselage, invisible.
    return a * c + COUVRE, ym + hh * s, haut, 0.35 * haut


def _z_ba(x):
    return Z_BA_AXE + (Z_BA_SAUMON - Z_BA_AXE) * abs(x) / DEMI_ENVERGURE


def _z_bf(x):
    return Z_BF_AXE + (Z_BF_SAUMON - Z_BF_AXE) * abs(x) / DEMI_ENVERGURE


def _plan(s, za0, za1, zf0, zf1, arrondi, n_saumon=14):
    """
    Le plan d'une aile droite vue de dessus, points (x, z) dans le sens
    qu'`extrusion` attend : le bord d'attaque de `za0` (sur l'axe) à `za1` (au
    saumon, x = ±s), le bord de fuite de `zf0` à `zf1`, et chaque saumon en
    demi-ellipse de profondeur `arrondi`.
    """
    def ba(x):
        return za0 + (za1 - za0) * abs(x) / s

    def bf(x):
        return zf0 + (zf1 - zf0) * abs(x) / s

    xr = s - arrondi
    zm = (ba(xr) + bf(xr)) / 2
    c2 = (ba(xr) - bf(xr)) / 2
    pts = [(0.0, za0), (-xr, ba(xr))]
    for k in range(1, n_saumon):          # le saumon droit, de l'avant vers l'arrière
        t = math.pi / 2 - math.pi * k / n_saumon
        pts.append((-(xr + arrondi * math.cos(t)), zm + c2 * math.sin(t)))
    pts += [(-xr, bf(xr)), (0.0, zf0), (xr, bf(xr))]
    for k in range(1, n_saumon):          # le saumon gauche, de l'arrière vers l'avant
        t = -math.pi / 2 + math.pi * k / n_saumon
        pts.append((xr + arrondi * math.cos(t), zm + c2 * math.sin(t)))
    pts.append((xr, ba(xr)))
    return pts


def _profil_derive():
    """La dérive vue de côté, points (z, y) : bord d'attaque en flèche, bord de fuite droit, le haut en demi-ellipse."""
    za0, za1 = Z_DERIVE_BA
    zc = (za1 + Z_DERIVE_BF) / 2
    rz, ry = (za1 - Z_DERIVE_BF) / 2, ARRONDI_DERIVE
    pts = [(za0, Y_DERIVE_PIED), (za1, Y_DERIVE_HAUT)]
    n = 12
    for k in range(1, n):
        t = math.pi * k / n
        pts.append((zc + rz * math.cos(t), Y_DERIVE_HAUT + ry * math.sin(t)))
    pts += [(Z_DERIVE_BF, Y_DERIVE_HAUT), (Z_DERIVE_BF, Y_DERIVE_PIED)]
    return pts


def _profil_nacelle(longueur, n=28):
    """
    Une nacelle de moteur, pour `revolution` : (rayon, position le long de
    l'axe depuis son milieu), de l'arrière vers l'avant — effilée vers
    l'arrière, pleine, la lèvre du capot arrondie devant.
    """
    pts = []
    for k in range(n + 1):
        u = (1 - math.cos(math.pi * k / n)) / 2      # plus serré aux deux bouts
        if u < 0.45:
            r = math.sin(0.5 * math.pi * u / 0.45) ** 0.7
        elif u > 0.9:
            r = 0.84 + 0.16 * math.sqrt(max(0.0, 1 - ((u - 0.9) / 0.1) ** 2))
        else:
            r = 1.0
        pts.append((R_NACELLE * max(0.12, r), longueur * (u - 0.5)))
    return pts


def _profil_bombe(n_nez=8):
    """
    La bombe, pour `revolution` : (rayon, position le long de l'axe depuis son
    milieu), de la queue au nez — le bloc d'empennage, l'étranglement, le corps
    plein, l'ogive ronde.
    """
    r = R_BOMBE
    pts = [(0.78 * r, 0.0), (0.78 * r, 0.09), (0.42 * r, 0.14), (0.75 * r, 0.28), (r, 0.42), (r, 0.70)]
    for k in range(1, n_nez + 1):
        t = 0.5 * math.pi * k / n_nez
        pts.append((max(0.1 * r, r * math.cos(t)), 0.70 + 0.30 * math.sin(t)))
    return [(rayon, L_BOMBE * (u - 0.5)) for rayon, u in pts]


def _moteurs():
    """Les quatre moteurs, de droite à gauche : (x, plan de l'hélice, arrière de la nacelle)."""
    sortie = []
    for x in (-X_MOTEURS[1], -X_MOTEURS[0], X_MOTEURS[0], X_MOTEURS[1]):
        avance = AVANCE_HELICE[0] if abs(x) == X_MOTEURS[0] else AVANCE_HELICE[1]
        sortie.append((x, _z_ba(x) + avance, _z_bf(x) + 0.025))
    return sortie


def _trappe(cote):
    """
    Une trappe de soute, côté `cote` (1 à gauche, −1 à droite) : une plaque
    posée sur la corde du ventre, entre le flanc de la bombe et la charnière.
    Rend (centre, largeur, angle autour de z, charnière).
    """
    a, ym, _, hb = _section((Z_SOUTE[0] + Z_SOUTE[1]) / 2)

    def ventre(x):
        return ym - hb * math.sqrt(max(0.0, 1 - (x / a) ** 2))

    x0, x1 = R_BOMBE + 0.002, X_CHARNIERE
    y0, y1 = ventre(x0), ventre(x1)
    angle = math.degrees(math.atan2(y1 - y0, x1 - x0))
    nx, ny = math.sin(math.radians(angle)), -math.cos(math.radians(angle))  # la normale vers le dehors
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    retrait = EP_TRAPPE / 2 - 0.003
    centre = (cote * (mx - nx * retrait), my - ny * retrait, (Z_SOUTE[0] + Z_SOUTE[1]) / 2)
    largeur = math.hypot(x1 - x0, y1 - y0)
    charniere = (cote * x1, y1, centre[2])
    return centre, largeur, cote * angle, charniere


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds : le corps (fuselage) porte tout et s'anime ; la base (la
    # voilure et ses moteurs, le « base : ailes » du canon) lui est accrochée ;
    # la soute (module_nacelle) porte ses deux trappes et la bombe.
    f.noeud('corps', pivot=(0, Y_PIVOT, 0))
    f.noeud('base', parent='corps', pivot=(0, Y_PIVOT, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    zs = (Z_SOUTE[0] + Z_SOUTE[1]) / 2
    _, ym, _, hb = _section(zs)
    f.noeud('module_nacelle', parent='corps', pivot=(0, ym - hb, zs))

    # Le fuselage graphite, et son dos à la couleur du camp.
    fuselage = f.fuseau('corps', _profil_fuselage, Z_AR, Z_NEZ, 'graphite', sections=96, exposants=(2.0, 2.0),
                        nom='fuselage', resserrement=0.3)
    dos = f.fuseau('corps', _profil_dos, Z_AR + 0.004, Z_NEZ, 'equipe', sections=120, exposants=(EXPOSANT_DOS, 2.0),
                   nom='dos', resserrement=0.3)
    # Le dos n'est que la peinture du fuselage, quelques millimètres au-dessus :
    # il se juge avec lui (épaisseur).
    dos.avec = fuselage.nom

    # Le nez vitré.
    rx, ry, rz = R_NEZ
    f.boule('corps', (0, Y_LIGNE, Z_NEZ), rx, 'verre', etirement=(1.0, ry / rx, rz / rx), nom='nez')

    # La voilure, d'une seule pièce, à la couleur du camp.
    plan = _plan(DEMI_ENVERGURE, Z_BA_AXE, Z_BA_SAUMON, Z_BF_AXE, Z_BF_SAUMON, ARRONDI_SAUMON)
    f.extrusion('base', plan, None, Y_AILE_BAS, Y_AILE_HAUT, 'equipe', nom='voilure')

    # L'empennage horizontal graphite, et la grande dérive à la couleur du camp.
    plan_emp = _plan(DEMI_ENV_EMP, Z_BA_EMP_AXE, Z_BA_EMP_SAUMON, Z_BF_EMP_AXE, Z_BF_EMP_SAUMON, ARRONDI_EMP, n_saumon=10)
    f.extrusion('corps', plan_emp, None, Y_EMP - EP_EMP / 2, Y_EMP + EP_EMP / 2, 'graphite', nom='empennage')
    f.prisme('corps', _profil_derive(), EP_DERIVE, 'equipe', nom='derive')

    # Les quatre moteurs : la nacelle sous l'aile, l'hélice et son cône devant.
    for i, (x, zh, zr) in enumerate(_moteurs()):
        n = i + 1
        zf = zh - 0.02
        f.revolution('base', (x, Y_MOTEUR, (zr + zf) / 2), _profil_nacelle(zf - zr), 'graphite', axe='z', nom=f'nacelle_{n}')
        centre = (x, Y_MOTEUR, zh)
        noeud = f'helice_{n}'
        f.noeud(noeud, parent='base', pivot=centre)
        f.rotor(noeud, centre, R_HELICE, pales=3, largeur_pale=LARGEUR_PALE, epaisseur=EPAISSEUR_PALE, teinte='graphite',
                axe='z', nom=noeud, angle=PHASES[i])
        f.boule(noeud, (x, Y_MOTEUR, zh + 0.03), R_CONE, 'os', etirement=(1.0, 1.0, 1.2), nom=f'cone_{n}')

    # La soute : deux trappes graphite de part et d'autre de la bombe os.
    for cote, c in ((1, 'g'), (-1, 'd')):
        centre, largeur, angle, charniere = _trappe(cote)
        f.noeud(f'trappe_{c}', parent='module_nacelle', pivot=charniere)
        f.boite(f'trappe_{c}', centre, (largeur, EP_TRAPPE, Z_SOUTE[1] - Z_SOUTE[0]), 'graphite', rotation=[('z', angle)],
                nom=f'trappe_{c}')
    f.noeud('bombe', parent='module_nacelle', pivot=(0, Y_BOMBE, Z_BOMBE))
    f.revolution('bombe', (0, Y_BOMBE, Z_BOMBE), _profil_bombe(), 'os', axe='z', nom='bombe')


# ---------------------------------------------------------------------------
# Les clips
# ---------------------------------------------------------------------------

def _bascule(clip, apres):
    """
    La première clé d'échantillonnage où l'obturateur de la cuisson est fermé
    après l'instant `apres` : un saut posé là tombe entre deux images cuites,
    sans traîner de flou (la cuisson ouvre l'obturateur sur `FLOU_DE_BOUGE` du
    pas, centré sur chaque image).
    """
    ts = b.instants_cuisson(clip)
    demi = b.FLOU_DE_BOUGE * (ts[1] - ts[0]) / 2
    cle = 1.0 / b.FREQUENCE_CLES
    for k, t in enumerate(ts[:-1]):
        s = math.ceil((t + demi) / cle + 0.1) * cle
        if s >= apres and s + cle <= ts[k + 1] - demi + 1e-6:
            return s
    raise ValueError(f'{clip.nom} : pas de bascule possible après {apres} s')


def _tourner_par_images(clip, noeud, angles):
    """
    Une hélice qui passe, image cuite après image cuite, par les `angles`
    donnés (degrés autour de z, depuis le repos), puis s'y tient : une hélice
    qui ralentit et s'arrête. La cuisson ne photographie que les images, nettes.
    """
    ts = b.instants_cuisson(clip)
    angles = list(angles) + [angles[-1]] * (len(ts) - len(angles))

    def f(t):
        if t <= ts[0]:
            return ('z', angles[0])
        for k in range(1, len(ts)):
            if t <= ts[k]:
                u = (t - ts[k - 1]) / (ts[k] - ts[k - 1])
                return ('z', angles[k - 1] + (angles[k] - angles[k - 1]) * u)
        return ('z', angles[-1])

    clip.rotation(noeud, f)


def _ouverture(t, debut, ouvert, ferme, fin):
    """0 fermé, 1 ouvert : s'ouvre de `debut` à `ouvert`, se referme de `ferme` à `fin`."""
    if t <= debut or t >= fin:
        return 0.0
    if t <= ouvert:
        return b.lisse((t - debut) / (ouvert - debut))
    if t <= ferme:
        return 1.0
    return 1.0 - b.lisse((t - ferme) / (fin - ferme))


def animer(f):
    helices = [f'helice_{i + 1}' for i in range(4)]

    # Repos : un vol calme ; seules les hélices tournent, un tour par boucle
    # (30° d'une image à l'autre, le quart de l'écart entre deux pales).
    r = f.clip('repos')
    for n in helices:
        b.tourner(r, n, 'z', tours=1)

    # Déplacement : il penche à peine du nez, se balance et flotte.
    d = f.clip('deplacement')
    for n in helices:
        b.tourner(d, n, 'z', tours=1)
    d.rotation('corps', lambda t: ('x', 3.0))
    b.balancer(d, 'corps', 'z', 1.0, periodes=1)
    b.osciller(d, 'corps', 'y', 0.004, periodes=1)

    # Tir : les trappes s'ouvrent, la bombe tombe en piquant du nez ; allégé,
    # l'appareil remonte d'un souffle. La bombe, arrivée au sol, rentre dans le
    # ventre entre deux images (cachée, jamais rapetissée) et reparaît à sa
    # place à la fin, les trappes refermées.
    t = f.clip('tir')
    for n in helices:
        b.tourner(t, n, 'z', tours=1)
    ouvre = (0.03, 0.12, 0.45, 0.60)
    t.rotation('trappe_g', lambda s: ('z', OUVERTURE * _ouverture(s, *ouvre)))
    t.rotation('trappe_d', lambda s: ('z', -OUVERTURE * _ouverture(s, *ouvre)))
    lache = 0.12
    s_cache = _bascule(t, 0.47)
    s_retour = _bascule(t, 0.62)
    chute_max = Y_BOMBE - 0.07
    cache = (0.0, 0.08, 0.0)

    def chute(s):
        if s <= lache or s > s_retour + 1e-6:
            return (0.0, 0.0, 0.0)
        if s > s_cache + 1e-6:
            return cache
        dt = s - lache
        return (0.0, -min(chute_max, 2.6 * dt * dt), -0.03 * min(1.0, dt / 0.33) ** 2)

    def pique(s):
        if s <= lache or s > s_cache + 1e-6:
            return ('x', 0.0)
        return ('x', 25.0 * min(1.0, (s - lache) / 0.33))

    t.translation('bombe', chute)
    t.rotation('bombe', pique)
    b.sursaut(t, 'corps', 'y', 0.012, debut=lache, duree=0.4)
    b.a_coup(t, 'corps', 'x', -2.0, debut=lache, attaque=0.08, retour=0.4)

    # Touché : il roule, vacille et s'enfonce un peu, puis se reprend.
    k = f.clip('touche')
    for n in helices:
        b.tourner(k, n, 'z', tours=0.5)
    b.secousse(k, 'corps', 'z', 7.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)

    # Hors jeu : les moteurs se coupent — les hélices ralentissent, pas à pas
    # lisibles (de 30° à 13° d'une image à l'autre), et s'arrêtent ;
    # l'appareil s'affaisse sur l'aile droite, le nez bas.
    h = f.clip('hors_jeu')
    angles = [0]
    for p in (30, 28, 25, 22, 19, 16, 14, 13):
        angles.append(angles[-1] + p)
    for n in helices:
        _tourner_par_images(h, n, angles)
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 15.0))
    b.affaisser(h, 'corps', rotation=('x', 8.0), debut=0.1, duree=0.7)
