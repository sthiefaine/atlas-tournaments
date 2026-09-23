"""
Le lance-roquettes : un gros camion de jouet qui porte sur son dos une boîte
de fusées, levée vers l'avant.

Ce qui le dit à 48 pixels : un camion sombre à six grosses roues — l'essieu
avant sous la cabine, deux essieux serrés sous le plateau —, coiffé d'une
cabine d'équipe aux flancs qui rentrent ; et son signe, la plus grosse pièce
après le corps : un caisson d'équipe relevé à 35° vers l'avant, posé sur
l'arrière de la cabine, dont la face avant, sombre, est criblée de bouches
rondes claires — le nez des fusées : il montre ce qu'il tire. Aucune tourelle
ni canon (c'est l'artillerie), aucun missile dressé (le sol-air), aucune
chenille (le sol-sol). Classe grande, 0,88 à 0,92 case de large en vue
« droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

La lumière de la cuisson vient du joueur, à 60° : dans l'image cuite, un
dessus reçoit 0,85 à 1, un flanc droit 0,65, un front 0,57, et la couleur du
camp ne compte « portée par les dessus » qu'au-dessus de 0,8. Le dessus du
caisson, couché à 35° vers l'arrière, y arrive encore ; son flanc, jamais —
il penche avec lui. Le bas de la cabine est donc sombre, comme le châssis
qu'il prolonge, et son haut d'équipe rentre de 30° sur les flancs et à
l'avant : sous 30°, un flanc reste sous 0,8.
"""

import math

import bibliotheque as b

#: La classe grande, comme la fiche la veut pour lui : 0,88 à 0,92.
LARGEUR_VISEE = (0.88, 0.92)

# ---------------------------------------------------------------------------
# Les cotes, en mètres : tout se déduit d'elles.
# ---------------------------------------------------------------------------

# --- Le train : six gros pneus, l'essieu avant sous la cabine, un tandem derrière.
RAYON_ROUE = 0.088
LARGEUR_PNEU = 0.085
X_ROUE = 0.172                       # le plan milieu d'un pneu, de part et d'autre
Z_ESSIEUX = (0.235, -0.09, -0.28)
PART_MOYEU = 0.52
MEPLAT = 0.6                         # la corde qui coupe le moyeu en « D », en part de son rayon

# --- Le châssis, sombre, d'un bout à l'autre : il assoit le camion.
CHASSIS = (0.26, (0.095, 0.175), (-0.385, 0.345))    # largeur, (bas, haut), (arrière, avant)

# --- Le plateau : une dalle sombre derrière la cabine, qui porte le caisson.
PLATEAU = (0.38, (0.15, 0.21), (-0.395, 0.1))

# --- La cabine avancée : un bas de caisse sombre, un haut d'équipe qui rentre de 30°.
CABINE_Z = (0.09, 0.375)             # l'arrière, contre le caisson, et l'avant
CABINE_X = 0.205                     # la demi-largeur du bas de caisse
CABINE_BAS = 0.155
CABINE_EPAULE = 0.265                # le haut du bas de caisse sombre, le pied du haut d'équipe
CABINE_TOIT = 0.43
PENTE_CABINE = 30.0                  # les flancs et le pare-brise, depuis la verticale
RETRAIT = (CABINE_TOIT - CABINE_EPAULE) * math.tan(math.radians(PENTE_CABINE))

# --- Le caisson : une boîte relevée à 35°, charnière à l'arrière, sur le plateau.
# Plus large que le camion (0,54 contre 0,445 aux pneus) : c'est le signe,
# exagéré, et c'est ce qui sépare son ombre chinoise de celle du sol-air, un
# camion de même gabarit dont les missiles se dressent sur l'arrière.
ELEVATION = 35.0
AXE = (0.0, math.sin(math.radians(ELEVATION)), math.cos(math.radians(ELEVATION)))
DESSUS_AXE = (0.0, math.cos(math.radians(ELEVATION)), -math.sin(math.radians(ELEVATION)))
CHARNIERE = (0.0, 0.215, -0.225)     # l'arête arrière du dessous
CAISSON = (0.54, 0.23, 0.54)         # largeur (x), épaisseur (le long de DESSUS_AXE), longueur (le long de AXE)

# --- La face avant : une plaque sombre, criblée de douze bouches claires.
PLAQUE = (0.50, 0.19)                # largeur, hauteur
COLONNES, LIGNES = 6, 2
PAS = (0.082, 0.09)
RAYON_BOUCHE = 0.033
SAILLIE_NEZ = 0.03                   # ce que le nez d'une fusée dépasse de la plaque

# --- La salve : dans chaque colonne de bouches, un éclair clair caché dans le
# caisson, qui en sort le temps d'une image cuite, colonne après colonne.
RAYON_ECLAIR = 0.05
RECUL_ECLAIR = 0.13                  # sa place au repos, derrière la plaque, dans le caisson
SORTIE_ECLAIR = 0.005                # son centre au tir, devant la plaque : il couvre le nez
TENUE_ECLAIR = 0.03                  # il tient de part et d'autre de l'instant photographié : net sous l'obturateur
MONTEE_ECLAIR = 0.015
COUP_CAISSON = -1.0                  # degrés : le caisson se cabre à chaque départ

# --- Les vérins, qui tiennent le caisson levé.
X_VERIN = 0.12
PIED_VERIN = (0.21, 0.02)            # (y, z) sur le plateau
S_VERIN = 0.3                        # où il prend le caisson, le long de l'axe depuis la charnière
RAYON_VERIN = 0.028


def le_long(p, d, t):
    """Le point `p` avancé de `t` mètres dans la direction `d`."""
    return tuple(a + t * c for a, c in zip(p, d))


def sur_caisson(s, t, e=0.0):
    """Un point du caisson : `s` le long de l'axe depuis la charnière, `t` au-dessus du dessous, `e` en travers (x)."""
    p = le_long(CHARNIERE, AXE, s)
    p = le_long(p, DESSUS_AXE, t)
    return (p[0] + e, p[1], p[2])


def dalle_sur_pente(f, noeud, bas, haut, t0, t1, largeur, teinte, nom, dedans=-0.045, dehors=0.006):
    """
    Une dalle posée dans une face inclinée vue de côté, de `bas` à `haut`
    (points (z, y)) : elle en prend la part `t0` à `t1`, s'enfonce de `dedans`
    et dépasse de `dehors` le long de la normale (vers l'avant et le haut).
    Un pare-brise.
    """
    u = (haut[0] - bas[0], haut[1] - bas[1])
    lu = math.hypot(*u)
    u = (u[0] / lu, u[1] / lu)
    n = (u[1], -u[0])
    if n[0] < 0:
        n = (-n[0], -n[1])
    coins = [(t0 * lu, dedans), (t1 * lu, dedans), (t1 * lu, dehors), (t0 * lu, dehors)]
    profil = [(bas[0] + t * u[0] + e * n[0], bas[1] + t * u[1] + e * n[1]) for t, e in coins]
    return f.prisme(noeud, profil, largeur, teinte, nom=nom)


def roue(f, noeud, centre, rayon, largeur, nom):
    """
    Une grosse roue : le pneu arrondi, et un moyeu clair coupé d'un méplat —
    un « D » qui tourne avec l'essieu, parce qu'un moyeu rond et centré ne
    montre pas que la roue roule. Il dépasse des deux flancs du pneu.
    """
    pneu = f.cylindre(noeud, centre, rayon, largeur, 'caoutchouc', axe='x', chanfrein=0.3 * largeur, nom=f'{nom}_pneu')
    r = rayon * PART_MOYEU
    k = b.segments_cercle(r)
    cercle = [(r * math.sin(2 * math.pi * j / k), r * math.cos(2 * math.pi * j / k)) for j in range(k)]
    d = [(min(py, MEPLAT * r), pz) for py, pz in cercle]
    cx, cy, cz = centre
    e = largeur + 0.016
    moyeu = f.solide(noeud, [[(cx + s * e / 2, cy + py, cz + pz) for py, pz in d] for s in (-1, 1)], 'os', nom=f'{nom}_moyeu')
    moyeu.avec = pneu.nom
    return [pneu, moyeu]


def cabine(f, noeud):
    """
    La cabine : un bas de caisse sombre (il prolonge le châssis, et porte les
    phares), puis le haut d'équipe, dont les flancs et l'avant rentrent de
    `PENTE_CABINE` — l'avant est le pare-brise, les flancs portent une vitre.
    L'arrière reste droit : le caisson s'y appuie.
    """
    za, zv = CABINE_Z
    r = RETRAIT
    pied = b.contour_rectangle(0, (za + zv) / 2, 2 * CABINE_X, zv - za, rayon=0.03)
    f.extrusion(noeud, pied, None, CABINE_BAS, CABINE_EPAULE, 'graphite', chanfrein=0.02, nom='bas_de_caisse')
    toit = b.contour_rectangle(0, (za + zv - r) / 2, 2 * (CABINE_X - r), zv - za - r, rayon=0.03)
    f.extrusion(noeud, pied, toit, CABINE_EPAULE - 0.005, CABINE_TOIT, 'equipe', chanfrein=0.02, nom='cabine')

    # Le pare-brise : une dalle de verre posée dans la pente de l'avant, aussi
    # large que la pente l'est en haut de la vitre.
    t0, t1 = 0.16, 0.84
    largeur = 2 * (CABINE_X - r * t1) - 0.05
    dalle_sur_pente(f, noeud, (zv, CABINE_EPAULE - 0.005), (zv - r, CABINE_TOIT), t0, t1, largeur, 'verre', 'pare_brise')

    # Les vitres de flanc, noyées dans le flanc qui rentre ; elles en dépassent de 4 mm.
    y_vitre = (CABINE_EPAULE + CABINE_TOIT) / 2 + 0.008
    x_flanc = CABINE_X - r * (y_vitre - CABINE_EPAULE) / (CABINE_TOIT - CABINE_EPAULE)
    a = math.radians(PENTE_CABINE)
    for cote in (1, -1):
        centre = (cote * (x_flanc + (0.004 - 0.025) * math.cos(a)), y_vitre + (0.004 - 0.025) * math.sin(a), za + 0.115)
        f.boite(noeud, centre, (0.05, 0.07, 0.12), 'verre', rotation=[('z', cote * PENTE_CABINE)], chanfrein=0.012,
                nom=f'vitre_{"g" if cote > 0 else "d"}')

    # Les phares, sur le bas de caisse sombre : deux feux clairs.
    for cote in (1, -1):
        f.cylindre(noeud, (cote * 0.14, 0.225, zv - 0.012), 0.026, 0.05, 'feux', axe='z', nom=f'phare_{"g" if cote > 0 else "d"}')


def caisson(f, noeud):
    """
    Le caisson : une boîte d'équipe relevée de `ELEVATION` sur sa charnière,
    et sa face avant — une plaque sombre d'où sortent les nez clairs des
    fusées, `COLONNES` × `LIGNES`.
    """
    lx, ep, lg = CAISSON
    f.boite(noeud, sur_caisson(lg / 2, ep / 2), (lx, ep, lg), 'equipe', rotation=[('x', -ELEVATION)], chanfrein=0.025,
            nom='caisson')
    px, py = PLAQUE
    f.boite(noeud, sur_caisson(lg + 0.008 - 0.025, ep / 2), (px, py, 0.05), 'graphite', rotation=[('x', -ELEVATION)],
            chanfrein=0.015, nom='plaque')
    r = RAYON_BOUCHE
    nez = [(r, 0.0), (r, 0.03), (0.92 * r, 0.03 + SAILLIE_NEZ * 0.4), (0.7 * r, 0.03 + SAILLIE_NEZ * 0.75),
           (0.35 * r, 0.03 + SAILLIE_NEZ * 0.95), (0.08 * r, 0.03 + SAILLIE_NEZ)]
    for i in range(COLONNES):
        for j in range(LIGNES):
            e = colonne(i)
            t = ep / 2 + (j - (LIGNES - 1) / 2) * PAS[1]
            f.revolution(noeud, sur_caisson(lg + 0.008 - 0.03, t, e), nez, 'os', axe=AXE, nom=f'nez_{i + 1}_{j + 1}')


def colonne(i):
    """Le décalage en travers (x) de la colonne de bouches `i`, la première à droite du camion."""
    return (i - (COLONNES - 1) / 2) * PAS[0]


def eclairs(f, noeud_parent):
    """
    La salve : pour chaque colonne de bouches, un nœud `salve_<i>` qui porte
    un éclair clair par bouche, rangé au repos dans le caisson, derrière la
    plaque, où rien ne le voit. Au tir, il glisse le long de l'axe et sort de
    la bouche, le temps d'une image.
    """
    lx, ep, lg = CAISSON
    for i in range(COLONNES):
        e = colonne(i)
        nom = f'salve_{i + 1}'
        f.noeud(nom, parent=noeud_parent, pivot=sur_caisson(lg, ep / 2, e))
        for j in range(LIGNES):
            t = ep / 2 + (j - (LIGNES - 1) / 2) * PAS[1]
            f.boule(nom, sur_caisson(lg - RECUL_ECLAIR, t, e), RAYON_ECLAIR, 'feux', nom=f'eclair_{i + 1}_{j + 1}')


def construire(f):
    # Les nœuds : la base porte le châssis et les trois essieux (qui tournent),
    # le corps la cabine, le plateau et les vérins (ils respirent sur la
    # suspension), le module lance-roquettes le caisson, pivot sur sa charnière.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, CABINE_BAS, 0))
    f.noeud('module_lance_roquettes', parent='corps', pivot=CHARNIERE)
    f.noeud('socle', pivot=(0, 0, 0))
    for i, z in enumerate(Z_ESSIEUX):
        f.noeud(f'essieu_{i + 1}', parent='base', pivot=(0, RAYON_ROUE, z))

    # Le train : six gros pneus de caoutchouc aux moyeux clairs.
    for i, z in enumerate(Z_ESSIEUX):
        for cote in (1, -1):
            roue(f, f'essieu_{i + 1}', (cote * X_ROUE, RAYON_ROUE, z), RAYON_ROUE, LARGEUR_PNEU,
                 nom=f'roue_{i + 1}_{"g" if cote > 0 else "d"}')

    # Le châssis, sombre, et le pare-chocs qui dépasse sous la cabine.
    lx, (y0, y1), (z0, z1) = CHASSIS
    f.boite('base', (0, (y0 + y1) / 2, (z0 + z1) / 2), (lx, y1 - y0, z1 - z0), 'graphite', chanfrein=0.02, nom='chassis')
    f.boite('base', (0, 0.15, CABINE_Z[1] - 0.01), (2 * CABINE_X - 0.05, 0.06, 0.06), 'graphite', chanfrein=0.02, nom='pare_chocs')

    # Le plateau : une dalle sombre derrière la cabine, qui porte le caisson.
    lx, (y0, y1), (z0, z1) = PLATEAU
    f.boite('corps', (0, (y0 + y1) / 2, (z0 + z1) / 2), (lx, y1 - y0, z1 - z0), 'graphite', chanfrein=0.02, nom='plateau')

    cabine(f, 'corps')

    # Les vérins : deux fûts sombres, du plateau au ventre du caisson.
    haut_verin = sur_caisson(S_VERIN, 0.01)
    for cote in (1, -1):
        a = (cote * X_VERIN, PIED_VERIN[0] - 0.01, PIED_VERIN[1])
        c = (cote * X_VERIN, haut_verin[1], haut_verin[2])
        f.membre('corps', a, c, RAYON_VERIN, 'graphite', nom=f'verin_{"g" if cote > 0 else "d"}')

    # La charnière, sombre, sous l'arrière du caisson.
    f.cylindre('corps', le_long(CHARNIERE, DESSUS_AXE, 0.01), 0.03, CAISSON[0] - 0.06, 'graphite', axe='x', nom='charniere')

    caisson(f, 'module_lance_roquettes')
    eclairs(f, 'module_lance_roquettes')


def eclat(clip, noeud, instant, distance):
    """
    Un éclair : le nœud glisse de `distance` le long de l'axe du caisson, tient
    sa pose de part et d'autre de `instant` (l'obturateur de la cuisson y est
    ouvert : l'éclair sort net), puis rentre avant l'image suivante.
    """
    def f(t):
        u = abs(t - instant)
        if u <= TENUE_ECLAIR:
            k = 1.0
        elif u < TENUE_ECLAIR + MONTEE_ECLAIR:
            k = 1.0 - b.lisse((u - TENUE_ECLAIR) / MONTEE_ECLAIR)
        else:
            k = 0.0
        return tuple(c * distance * k for c in AXE)

    clip.translation(noeud, f)


def animer(f):
    # Repos : immobile. Rien ne bouge.
    b.fixe(f.clip('repos'), 'corps')

    # Déplacement : les roues roulent (le « D » des moyeux le montre), la caisse
    # respire sur sa suspension.
    d = f.clip('deplacement')
    for i in range(len(Z_ESSIEUX)):
        b.tourner(d, f'essieu_{i + 1}', 'x', tours=2)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)

    # Tir : la salve. Une colonne de bouches par image cuite, de la droite du
    # camion vers sa gauche : ses éclairs sortent, tenus le temps que
    # l'obturateur est ouvert, et le caisson se cabre d'un degré à chaque
    # départ ; la caisse se tasse sous la salve. La première et la dernière
    # image sont celles du repos.
    t = f.clip('tir')
    images = b.instants_cuisson(t)
    sortie = RECUL_ECLAIR + SORTIE_ECLAIR
    for i, instant in enumerate(images[1:1 + COLONNES]):
        eclat(t, f'salve_{i + 1}', instant, sortie)
        b.a_coup(t, 'module_lance_roquettes', 'x', COUP_CAISSON, debut=instant - 0.02, attaque=0.02, retour=0.05)
    b.sursaut(t, 'corps', '-y', 0.008)

    # Touché : la caisse vacille et se tasse ; le caisson saute sur sa
    # charnière et retombe sur la cabine — vers le haut seulement : il s'y
    # appuie, un tremblement vers le bas l'y enfoncerait.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)
    b.a_coup(k, 'module_lance_roquettes', 'x', -3.0, attaque=0.06, retour=0.3)

    # Hors jeu : la caisse s'affaisse de biais, du côté lointain (de l'autre,
    # elle déborderait vers la caméra) ; le caisson, qui s'appuie sur la
    # cabine et ne peut pas piquer du nez, roule sur sa charnière du même côté.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.02, 0), rotation=('z', -6.0))
    b.affaisser(h, 'module_lance_roquettes', rotation=('z', -8.0), debut=0.1, duree=0.55)
