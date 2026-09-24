"""
Le transport d'assaut : un bus volant de jouet, à deux rotors en tandem.

Ce qui le dit à 48 pixels : un gros fuselage carré et trapu à la couleur du
camp, deux barres de rotor sombres et nettes à moyeu clair — l'une sur une
bosse au-dessus du poste de pilotage, l'autre plus haut, sur le pylône de la
queue —, une porte latérale grande ouverte, sombre jusqu'au plancher, sous son
treuil, une verrière à reflet au nez, une quille sombre. Aucune arme.
L'hélicoptère d'attaque est fin, pointu, n'a qu'un rotor et porte des paniers
de roquettes ; les drones sont petits et ont quatre rotors.

Les flancs de la cabine rentrent en montant, de 38° : c'est ce qui les met
dans la lumière. Mesuré dans l'image cuite (vue droite) : un flanc vertical
sort à 0,60–0,70, un flanc rentré de 32° à 0,80–0,82, pile sur le seuil de
`equipe_eclairee` ; à 38°, l'équipe du flanc compte comme un dessus.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le haut de la classe moyenne : plus large que l'hélicoptère d'attaque (0,79).
LARGEUR_VISEE = (0.82, 0.84)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.20                    # bas des roues au repos (charte : rotors à 0,20 m)

# La coque, de la rampe arrière au nez. Sa section est un trapèze aux coins
# ronds : un fond étroit (le ventre), la ligne la plus large, des flancs qui
# rentrent en montant, un toit plat.
Z_AR = -0.31                  # le bout arrière (la rampe)
Z_NEZ = 0.33                  # le bout du nez
Z_AR_DEBUT = -0.265           # où l'arrière commence à s'arrondir (court : la rampe est franche)
Z_NEZ_DEBUT = 0.16            # où le nez commence
Y_FOND = 0.265                # le fond du ventre
W_FOND = 0.075                # sa demi-largeur
Y_BASE = 0.37                 # la ligne la plus large
W_BASE = 0.14                 # sa demi-largeur
Y_TOIT = 0.455                # le toit
REPLI = 38.0                  # les flancs rentrent de tant, en montant (degrés depuis la verticale)
#: L'arrière de la coque monte en pignon jusqu'au pylône du rotor arrière :
#: les mêmes pentes que les flancs, qui restent dans la lumière.
Z_PIGNON = (-0.05, -0.2)      # le pignon commence à monter, puis atteint sa crête
Y_CRETE = 0.49                # la crête du pignon
W_CRETE = 0.018               # sa demi-largeur, au plus étroit
Y_POINTE = 0.37               # la hauteur du bout du nez
Y_POINTE_AR = 0.40            # la hauteur du bout arrière
R_EPAULE = 0.03               # l'arrondi des épaules
R_BASE = 0.015                # l'arrondi de la ligne la plus large
R_FOND = 0.03                 # l'arrondi du ventre
ANNEAUX = 64                  # les sections de la coque, serrées vers les deux bouts

# Les rotors et leurs pylônes.
Z_ROTOR_AV = 0.165
Z_ROTOR_AR = -0.215
Y_ROTOR_AV = 0.545
Y_ROTOR_AR = 0.665
#: Le pylône arrière, haut et étroit, posé sur le pignon : ses flancs, presque
#: droits, restent sous le seuil de lumière ; on les garde étroits.
PYLONE_AR_BAS = (-0.225, 0.13, 0.08)     # centre z, longueur, largeur, au pied
PYLONE_AR_HAUT = (-0.2175, 0.065, 0.056)  # au sommet
Y_BOSSE_AV = 0.495            # le haut du pylône avant, une bosse sur le toit
R_MAT = 0.025                 # le mât graphite, de la bosse avant au moyeu
R_ROTOR = 0.225
LARGEUR_PALE = 0.05
EPAISSEUR_PALE = 0.03
R_MOYEU = 0.04
H_MOYEU = 0.05
#: Les pales au repos (degrés, depuis l'arrière vers la droite du modèle, dans
#: le sens de `b.tourner`) : à 30°, une barre à deux pales est horizontale
#: dans la vue « droite ».
ANGLE_PALES = 30.0
#: Au départ du déplacement, les barres passent en travers du fuselage :
#: presque horizontales dans les vues « bas » et « haut », qui montrent ce clip.
DECALAGE_DEPLACEMENT = 60.0

# Les roues.
R_ROUE = 0.035
L_ROUE = 0.05
Z_ROUES_AV = 0.21
X_ROUES_AV = 0.045
Z_ROUES_AR = -0.17
X_ROUES_AR = 0.06

# La porte, sur le flanc droit (x négatifs), et son treuil au-dessus.
Z_PORTE = (-0.175, -0.02)
PART_PORTE = 0.5              # le bas de la porte, en part de la hauteur de la carène : sous le haut de la quille
Y_PORTE_HAUT = 0.448
Z_TREUIL = -0.11              # au-dessus du milieu de la porte

# La verrière, sur le nez, du toit jusqu'à mi-flanc.
Z_VERRIERE = 0.25
PART_VERRIERE = 0.5          # le bas de la verrière, en part de la hauteur des flancs

#: Le ventre graphite monte sur la carène jusqu'à cette part de sa hauteur :
#: au-dessus, la carène reste à la couleur du camp (l'écran de combat la voit).
PART_VENTRE = 0.55

#: Les peaux (porte, verrière, ventre) : ce qu'elles dépassent de la coque, et
#: ce qu'elles y plongent.
SAILLIE = 0.004
PLONGEE = 0.035


# ---------------------------------------------------------------------------
# La section de la coque
# ---------------------------------------------------------------------------

def arrondi(u, p):
    """(1 − u^p)^(1/p) : 1 à u = 0, 0 à u = 1 ; plus `p` est grand, plus le bout est franc."""
    u = min(1.0, max(0.0, u))
    return (1.0 - u ** p) ** (1.0 / p)


TAN_REPLI = math.tan(math.radians(REPLI))


def coins(z):
    """
    Les coins de la section de la coque à l'abscisse z, sans arrondi :
    (y_fond, w_fond, y_base, w_base, y_toit, w_toit, k), k l'échelle des
    arrondis. Au nez, le toit descend en pente (la verrière), la section se
    resserre ; à l'arrière, le fond remonte (la rampe).
    """
    yf, yb, yt, k = Y_FOND, Y_BASE, Y_TOIT, 1.0
    # Le pignon arrière : le toit monte, les flancs gardent leur pente.
    u = (Z_PIGNON[0] - z) / (Z_PIGNON[0] - Z_PIGNON[1])
    yt = Y_TOIT + (Y_CRETE - Y_TOIT) * b.lisse(u)
    if z > Z_NEZ_DEBUT:
        u = (z - Z_NEZ_DEBUT) / (Z_NEZ - Z_NEZ_DEBUT)
        k = max(0.16, arrondi(u, 2.4))
        yt = Y_POINTE + (Y_TOIT - Y_POINTE) * arrondi(u, 1.7)
        yb = Y_POINTE - (Y_POINTE - Y_BASE) * arrondi(u, 4.0)
        yf = Y_POINTE - (Y_POINTE - Y_FOND) * arrondi(u, 2.4)
    elif z < Z_AR_DEBUT:
        u = (Z_AR_DEBUT - z) / (Z_AR_DEBUT - Z_AR)
        k = max(0.35, arrondi(u, 4.5))
        yt = Y_POINTE_AR + (yt - Y_POINTE_AR) * arrondi(u, 4.0)
        yb = Y_POINTE_AR - (Y_POINTE_AR - Y_BASE) * arrondi(u, 3.0)
        yf = Y_POINTE_AR - (Y_POINTE_AR - Y_FOND) * arrondi(u, 1.6)
    wb = W_BASE * k
    wf = W_FOND * k
    # Les hauteurs gardent leur ordre, avec de quoi arrondir chaque coin.
    yb = min(yb, yt - 0.012)
    yf = min(yf, yb - 0.01)
    wt = max(W_CRETE * k, wb - (yt - yb) * TAN_REPLI)
    return yf, wf, yb, wb, yt, wt, k


def polygone(z):
    """Les six coins de la section, et leur arrondi : du fond à droite, en remontant le flanc droit."""
    yf, wf, yb, wb, yt, wt, k = coins(z)
    pts = [(-wf, yf), (-wb, yb), (-wt, yt), (wt, yt), (wb, yb), (wf, yf)]
    rayons = [R_FOND * k, R_BASE * k, R_EPAULE * k, R_EPAULE * k, R_BASE * k, R_FOND * k]
    return pts, rayons


def unitaire(v):
    n = math.hypot(v[0], v[1])
    return (v[0] / n, v[1] / n)


def decaler(pts, d, ferme, centre=None):
    """
    Les coins d'un polygone convexe (ou d'une ligne brisée ouverte) dont chaque
    côté est poussé de `d` le long de sa normale extérieure : loin de `centre`
    (par défaut, le centre des coins).
    """
    n = len(pts)
    cx, cy = centre if centre else (sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n)
    cotes = []
    for i in range(n if ferme else n - 1):
        a, c = pts[i], pts[(i + 1) % n]
        e = unitaire((c[0] - a[0], c[1] - a[1]))
        nrm = (e[1], -e[0])
        m = ((a[0] + c[0]) / 2, (a[1] + c[1]) / 2)
        if nrm[0] * (m[0] - cx) + nrm[1] * (m[1] - cy) < 0:
            nrm = (-nrm[0], -nrm[1])
        cotes.append(((a[0] + d * nrm[0], a[1] + d * nrm[1]), e))

    def croiser(l1, l2):
        (p, e), (q, f) = l1, l2
        det = e[0] * (-f[1]) - e[1] * (-f[0])
        if abs(det) < 1e-9:
            return q
        t = ((q[0] - p[0]) * (-f[1]) - (q[1] - p[1]) * (-f[0])) / det
        return (p[0] + t * e[0], p[1] + t * e[1])

    sortie = []
    for i in range(n):
        if ferme:
            sortie.append(croiser(cotes[i - 1], cotes[i]))
        elif i == 0:
            sortie.append(cotes[0][0])
        elif i == n - 1:
            p, e = cotes[-1]
            longueur = math.hypot(pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1])
            sortie.append((p[0] + e[0] * longueur, p[1] + e[1] * longueur))
        else:
            sortie.append(croiser(cotes[i - 1], cotes[i]))
    return sortie


def arrondir(pts, rayons, ferme, arcs):
    """
    Une ligne brisée aux coins arrondis : chaque coin intérieur remplacé par un
    arc tangent aux deux côtés, de `arcs[i]` pas ; les bouts d'une ligne
    ouverte restent. Autant de points pour les mêmes `arcs`, quelle que soit la
    taille : les anneaux d'une `solide` se répondent.
    """
    n = len(pts)
    sortie = []
    for i in range(n):
        p = pts[i]
        if not ferme and i in (0, n - 1):
            sortie.append(p)
            continue
        a, c = pts[i - 1], pts[(i + 1) % n]
        u1 = unitaire((a[0] - p[0], a[1] - p[1]))
        u2 = unitaire((c[0] - p[0], c[1] - p[1]))
        demi = math.acos(max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))) / 2
        r = max(1e-4, rayons[i])
        d = r / math.tan(demi)
        dmax = 0.45 * min(math.hypot(a[0] - p[0], a[1] - p[1]), math.hypot(c[0] - p[0], c[1] - p[1]))
        if d > dmax:
            d = dmax
            r = d * math.tan(demi)
        t1 = (p[0] + u1[0] * d, p[1] + u1[1] * d)
        t2 = (p[0] + u2[0] * d, p[1] + u2[1] * d)
        bis = unitaire((u1[0] + u2[0], u1[1] + u2[1]))
        h = r / math.sin(demi)
        centre = (p[0] + bis[0] * h, p[1] + bis[1] * h)
        a1 = math.atan2(t1[1] - centre[1], t1[0] - centre[0])
        a2 = math.atan2(t2[1] - centre[1], t2[0] - centre[0])
        da = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
        for j in range(arcs[i] + 1):
            ang = a1 + da * j / arcs[i]
            sortie.append((centre[0] + r * math.cos(ang), centre[1] + r * math.sin(ang)))
    return sortie


#: Les pas de l'arc de chaque coin (fond, ligne la plus large, épaule) : sous
#: 20° chacun, le chanfrein de la bibliothèque ne les prend pas pour des arêtes.
ARCS = [4, 3, 6, 6, 3, 4]


def section(z):
    """Le contour arrondi de la section à l'abscisse z : autant de points à toute abscisse."""
    pts, rayons = polygone(z)
    return arrondir(pts, rayons, True, ARCS)


def z_anneaux(z0, z1, n, serrage=0.7):
    """`n` + 1 abscisses de z0 à z1, serrées vers les deux bouts (un pas en cosinus mêlé d'un pas régulier)."""
    return [z0 + (z1 - z0) * ((1 - serrage) * k / n + serrage * (1 - math.cos(math.pi * k / n)) / 2) for k in range(n + 1)]


def centre_section(z):
    """Le centre des coins de la section : ce qui est dedans."""
    pts, _ = polygone(z)
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def peau(f, noeud, zs, morceau, arcs, teinte, nom, saillie=None):
    """
    Une peau posée sur la coque : pour chaque abscisse, `morceau(z)` rend une
    ligne brisée ouverte (des coins de la section) et ses arrondis ; la peau
    en dépasse de `saillie` (SAILLIE par défaut) et y plonge de PLONGEE.
    """
    saillie = SAILLIE if saillie is None else saillie
    anneaux = []
    for z in zs:
        pts, rayons = morceau(z)
        c = centre_section(z)
        dehors = arrondir(decaler(pts, saillie, False, c), [r + saillie for r in rayons], False, arcs)
        dedans = arrondir(decaler(pts, -PLONGEE, False, c), [max(1e-3, r - PLONGEE) for r in rayons], False, arcs)
        anneaux.append([(x, y, z) for x, y in dehors] + [(x, y, z) for x, y in reversed(dedans)])
    return f.solide(noeud, anneaux, teinte, nom=nom)


def sur_flanc(p0, p1, y):
    """Le point du côté p0 → p1 à la hauteur y."""
    t = (y - p0[1]) / (p1[1] - p0[1])
    return (p0[0] + (p1[0] - p0[0]) * t, y)


def morceau_verriere(z):
    """Le haut de la section, d'un flanc à l'autre, à partir de PART_VERRIERE de la hauteur des flancs."""
    pts, rayons = polygone(z)
    yb, yt = pts[1][1], pts[2][1]
    yv = yb + PART_VERRIERE * (yt - yb)
    return ([sur_flanc(pts[1], pts[2], yv), pts[2], pts[3], sur_flanc(pts[4], pts[3], yv)],
            [0.0, rayons[2], rayons[3], 0.0])


def morceau_ventre(z):
    """Le bas de la carène, sous PART_VENTRE de sa hauteur : la quille sombre."""
    pts, rayons = polygone(z)
    yq = pts[0][1] + PART_VENTRE * (pts[1][1] - pts[0][1])
    return ([sur_flanc(pts[0], pts[1], yq), pts[0], pts[5], sur_flanc(pts[5], pts[4], yq)],
            [0.0, rayons[0], rayons[5], 0.0])


def morceau_porte(z):
    """
    La porte : du haut de la quille (le plancher), par l'arête de la ligne la
    plus large, jusqu'en haut du flanc droit.
    """
    pts, rayons = polygone(z)
    y0 = pts[0][1] + PART_PORTE * (pts[1][1] - pts[0][1])
    return [sur_flanc(pts[0], pts[1], y0), pts[1], sur_flanc(pts[1], pts[2], Y_PORTE_HAUT)], [0.0, rayons[1], 0.0]


# ---------------------------------------------------------------------------
# Les rotors
# ---------------------------------------------------------------------------

def rotor_a_pales(f, noeud, centre, rayon, angle):
    """
    Un rotor à deux pales opaques, graphite, autour d'un moyeu os ; le nœud est
    tournant, son pivot sur l'axe. Les pales sont celles de `f.rotor` (même
    géométrie, même départ : la première vers l'arrière à 0°, tournée de
    `angle` dans le sens de `b.tourner`) ; le moyeu est os, plus petit que le
    sien, et fait un point clair au centre de chaque rotor.
    """
    cx, cy, cz = centre
    f.noeud(noeud, parent='base', pivot=centre, tournant=True)
    # Ce que `f.rotor` déclare, pour que le rapport contrôle le pas apparent.
    f.noeuds[noeud].axe_tour = 'y'
    f.noeuds[noeud].pales = 2
    f.cylindre(noeud, (cx, cy + 0.006, cz), R_MOYEU, H_MOYEU, 'os', axe='y', nom=f'{noeud}_moyeu')
    longueur = rayon - 0.02
    for k in range(2):
        a = angle + 180.0 * k
        ra = math.radians(a)
        r = 0.02 + longueur / 2
        c = (cx - math.sin(ra) * r, cy, cz - math.cos(ra) * r)
        f.boite(noeud, c, (LARGEUR_PALE, EPAISSEUR_PALE, longueur), 'graphite', rotation=[('y', a)],
                chanfrein=0.45 * EPAISSEUR_PALE, fin=True, nom=f'{noeud}_pale_{k + 1}')


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds. La base porte les deux rotors, chacun un nœud tournant ; elle
    # est accrochée au corps pour pencher avec lui. Le treuil est le module grue.
    f.noeud('corps', pivot=(0, 0.37, 0))
    f.noeud('base', parent='corps', pivot=(0, (Y_ROTOR_AV + Y_ROTOR_AR) / 2, 0))
    f.noeud('module_grue', parent='corps', pivot=(-0.085, Y_TOIT, Z_TREUIL))
    f.noeud('socle', pivot=(0, 0, 0))

    # La coque, à la couleur du camp.
    zs = z_anneaux(Z_AR, Z_NEZ, ANNEAUX)
    anneaux = [[(x, y, z) for x, y in section(z)] for z in zs]
    coque = f.solide('corps', anneaux, 'equipe', nom='coque')

    # Le ventre graphite, la verrière et la porte : des peaux sur la coque.
    ventre = peau(f, 'corps', z_anneaux(Z_AR + 0.004, Z_NEZ - 0.004, ANNEAUX), morceau_ventre, [0, 4, 4, 0], 'graphite', 'ventre')
    ventre.avec = coque.nom
    verriere = peau(f, 'corps', z_anneaux(Z_VERRIERE, Z_NEZ - 0.006, 16, serrage=0.5), morceau_verriere, [0, 6, 6, 0], 'verre', 'verriere')
    verriere.avec = coque.nom
    porte = peau(f, 'corps', [Z_PORTE[0], Z_PORTE[1]], morceau_porte, [0, 3, 0], 'graphite', 'porte', saillie=2 * SAILLIE)
    porte.avec = coque.nom

    # Le pylône avant : une bosse d'équipe aux flancs en pente sur le toit, et
    # un mât graphite jusqu'au moyeu. Le pylône arrière, haut et étroit, se
    # pose sur le pignon ; le moyeu arrière se pose sur lui.
    bas_av = b.contour_rectangle(0, Z_ROTOR_AV, 0.14, 0.15, rayon=0.05)
    haut_av = b.contour_rectangle(0, Z_ROTOR_AV, 0.07, 0.08, rayon=0.03)
    f.extrusion('corps', bas_av, haut_av, Y_TOIT - 0.02, Y_BOSSE_AV, 'equipe', nom='pylone_avant')
    y0, y1 = Y_BOSSE_AV - 0.01, Y_ROTOR_AV
    f.cylindre('corps', (0, (y0 + y1) / 2, Z_ROTOR_AV), R_MAT, y1 - y0, 'graphite', axe='y', nom='mat_avant')
    zb, lb, wb_ = PYLONE_AR_BAS
    zh, lh, wh = PYLONE_AR_HAUT
    f.extrusion('corps', b.contour_rectangle(0, zb, wb_, lb, rayon=0.035), b.contour_rectangle(0, zh, wh, lh, rayon=0.025),
                Y_CRETE - 0.02, Y_ROTOR_AR - 0.02, 'equipe', nom='pylone_arriere')

    # Les roues : deux sous le nez, deux sous l'arrière.
    y_roue = ALT + R_ROUE
    for cote in (1, -1):
        c = 'g' if cote > 0 else 'd'
        f.cylindre('corps', (cote * X_ROUES_AV, y_roue, Z_ROUES_AV), R_ROUE, L_ROUE, 'caoutchouc', axe='x', nom=f'roue_av_{c}')
        f.cylindre('corps', (cote * X_ROUES_AR, y_roue, Z_ROUES_AR), R_ROUE, L_ROUE, 'caoutchouc', axe='x', nom=f'roue_ar_{c}')

    # Le treuil, au-dessus de la porte : un tambour os posé sur l'épaule
    # droite, qui dépasse du toit sans couvrir la porte.
    f.cylindre('module_grue', (-0.085, Y_TOIT + 0.005, Z_TREUIL), 0.03, 0.065, 'os', axe='z', nom='treuil_tambour')

    # Les rotors.
    rotor_a_pales(f, 'rotor_avant', (0, Y_ROTOR_AV, Z_ROTOR_AV), R_ROTOR, ANGLE_PALES)
    rotor_a_pales(f, 'rotor_arriere', (0, Y_ROTOR_AR, Z_ROTOR_AR), R_ROTOR, ANGLE_PALES)


def tourner_par_images(clip, noeud, angles):
    """
    Un rotor qui passe, image cuite après image cuite, par les `angles` donnés
    (degrés autour de y, depuis le repos), puis s'y tient : un rotor qui
    ralentit et s'arrête. Entre deux images, l'angle suit une droite.
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


#: Les rotors en tandem tournent en sens contraires.
SENS = {'rotor_avant': 1, 'rotor_arriere': -1}


def animer(f):
    # Repos : le fuselage ne bouge pas ; les deux rotors tournent, un tour par
    # boucle (30° d'une image cuite à l'autre, le sixième de l'écart des pales).
    r = f.clip('repos')
    for n, s in SENS.items():
        b.tourner(r, n, 'y', tours=s)

    # Déplacement : les rotors tournent deux fois plus vite, partis en travers
    # du fuselage ; il pique du nez pour avancer et se balance à peine.
    d = f.clip('deplacement')
    for n, s in SENS.items():
        d.rotation(n, lambda t: ('y', DECALAGE_DEPLACEMENT))
        b.tourner(d, n, 'y', tours=2 * s)
    d.rotation('corps', lambda t: ('x', 6.0))
    b.balancer(d, 'corps', 'z', 1.2, periodes=1)
    b.osciller(d, 'corps', 'y', 0.006, periodes=1)

    # Touché : l'appareil roule, vacille et se tasse, puis se reprend.
    k = f.clip('touche')
    for n, s in SENS.items():
        b.tourner(k, n, 'y', tours=0.5 * s)
    b.secousse(k, 'corps', 'z', 8.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)

    # Hors jeu : les rotors ralentissent et s'arrêtent (de 30° à 20° d'une image
    # à l'autre, jamais sous le dixième de l'écart des pales) ; l'appareil
    # s'affaisse de biais, le nez bas.
    h = f.clip('hors_jeu')
    angles = [0]
    for p in (30, 28, 26, 24, 22, 20):
        angles.append(angles[-1] + p)
    for n, s in SENS.items():
        tourner_par_images(h, n, [a * s for a in angles])
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 10.0))
    b.affaisser(h, 'corps', rotation=('x', 6.0), debut=0.1, duree=0.7)
