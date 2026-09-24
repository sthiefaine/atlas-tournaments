"""
Le cuirassé : le navire de ligne de la boîte, l'artillerie de la mer.

Ce qui le dit à 48 pixels : une coque longue et fine (quatre fois plus
longue que large) à la proue pointue, graphite sur sa bande de flottaison os,
sous un pont à la couleur du camp qui se relève vers l'étrave ; deux tourelles
à l'avant, la seconde hissée sur sa barbette par-dessus la première, chacune
avec deux canons longs levés à 35° vers l'adversaire (vers la droite en vue
« droite »), bouches claires percées d'une âme sombre ; au milieu, le château
posé sur un socle sombre : une tour, sa passerelle vitrée, un mât, et derrière
une petite cheminée à coiffe sombre. Une tourelle est un corps sombre coiffé
d'un toit du camp : de la couleur du pont, c'est l'ombre sous le toit qui l'en
détache. Ni pont plat à piste (le porte-avions), ni radier ni rampe (la
barge), ni cigare (le sous-marin), ni vedette (le drone marin). Classe grande :
0,92 case de large en vue « droite », contour compris — le haut de la
fourchette, sans dépasser le porte-avions, qui coûte plus cher.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: La classe grande, vers le haut : le plus long des navires après le porte-avions.
LARGEUR_VISEE = (0.90, 0.94)

# --- La coque ------------------------------------------------------------------
# Deux plans vus de dessus, parcourus par le même paramètre s (0 à la poupe,
# 1 à l'étrave) : celui du pont, et celui de la flottaison, un peu plus étroit
# (la coque s'évase en montant) et plus court à l'avant (l'étrave est lancée).
Z_POUPE = -0.485
Z_ETRAVE = 0.5
Z_POUPE_EAU = -0.472
Z_ETRAVE_EAU = 0.467
DEMI_LARGEUR = 0.125
DEMI_LARGEUR_EAU = 0.116
PART_POUPE = 0.1            # l'arrondi de la poupe, en part de la longueur
LARGEUR_POUPE = 0.78        # la demi-largeur à la poupe, en part de la pleine : la coque s'effile vers l'arrière
S_PLEINE = 0.4              # où la coque atteint sa pleine largeur
PART_PROUE = 0.36           # l'effilement de la proue
EXPOSANT_POUPE = 2.2        # 2 : un quart d'ellipse ; plus, une poupe plus carrée
EXPOSANT_PROUE = 1.7        # la proue en ogive : pleine aux épaules, fine à la pointe
SECTIONS = 72

FLOTTAISON = 0.04           # la bande os, de 0 à 4 cm
Y_PONT = 0.11               # le dessus de la coque, au milieu
TONTURE = 0.03              # le pont se relève d'autant à l'étrave
Z_TONTURE = 0.08            # d'où il commence à se relever
PONT_DESSUS = 0.015         # ce que le pont d'équipe dépasse de la coque
PONT_DESSOUS = 0.035        # ce qu'il s'y enfonce
RETRAIT_PONT = 0.002        # son bord arrondi en retrait du flanc : il couvre le chanfrein du haut de la coque sans descendre sur le flanc

# --- Les tourelles : deux à l'avant, la seconde sur une barbette -----------------
ELEVATION = 35.0
AXE = (0.0, math.sin(math.radians(ELEVATION)), math.cos(math.radians(ELEVATION)))
TOURELLE = (0.15, 0.16, 0.05)       # le corps sombre : largeur (x), longueur (z), hauteur
RAYON_TOURELLE = 0.035
RETRAITS_TOURELLE = (0.03, 0.006, 0.008)   # le front se couche un peu
TOIT = (0.165, 0.17, 0.05, 0.035)   # le toit d'équipe : largeur, longueur, épaisseur, où il se pose sur le corps
RETRAITS_TOIT = (0.035, 0.012, 0.014)
BISEAU_TOIT = 0.012
RAYON_ANNEAU = 0.064                # l'anneau sombre, sous la tourelle, qui la détache du pont
LEVEE = 0.045                       # la tourelle flotte d'autant au-dessus de ce qui la porte : l'anneau se voit d'en haut
Z_TOURELLE_1 = 0.24
Z_TOURELLE_2 = 0.07
Y_BARBETTE = 0.185                  # le dessus de la barbette de la seconde : ses canons passent au-dessus du toit de la première
RAYON_BARBETTE = 0.07
X_CANONS = 0.036
RAYON_CANON = 0.026
RAYON_BOUCHE = 0.0275
AME = 0.018                         # le rayon de l'âme : la bouche est un anneau clair, le tube sombre dedans
LONGUEUR_BOUCHE = 0.022
LONGUEUR_CANON = 0.215              # depuis le tourillon, dans la tourelle
TOURILLON = (0.037, 0.03)           # (au-dessus de la base, devant le centre)

# --- Le château, au milieu -------------------------------------------------------
ROUF = (0.16, -0.36, -0.02, 0.08)      # largeur, z arrière, z avant, hauteur au-dessus du pont
SOCLE_ROUF = 0.028                     # le rouf est posé sur un socle sombre en retrait : il se détache du pont
Z_TOUR = -0.095
TOUR = (0.12, 0.11, 0.17)              # largeur, longueur, hauteur au-dessus du rouf
PASSERELLE = (0.175, 0.1, 0.055)       # largeur, longueur, hauteur
Z_CHEMINEE = -0.255
CHEMINEE = (0.036, 0.13, 1.35, 8.0)    # rayon, hauteur, ellipse (long en z), dévers vers l'arrière
MAT = 0.16


def largeur_relative(s):
    """La demi-largeur de la coque en part de la pleine, au paramètre s (0 : poupe, 1 : étrave)."""
    if s < PART_POUPE:
        v = (PART_POUPE - s) / PART_POUPE
        return LARGEUR_POUPE * (1 - v ** EXPOSANT_POUPE) ** (1 / EXPOSANT_POUPE)
    if s < S_PLEINE:
        return LARGEUR_POUPE + (1 - LARGEUR_POUPE) * b.lisse((s - PART_POUPE) / (S_PLEINE - PART_POUPE))
    if s > 1 - PART_PROUE:
        u = (s - (1 - PART_PROUE)) / PART_PROUE
        return 1 - u ** EXPOSANT_PROUE
    return 1.0


def plan(s, pont=True):
    """(demi-largeur, z) du plan du pont — ou de la flottaison — au paramètre s."""
    f = largeur_relative(s)
    if pont:
        return max(0.008, DEMI_LARGEUR * f), Z_POUPE + s * (Z_ETRAVE - Z_POUPE)
    return max(0.008, DEMI_LARGEUR_EAU * f), Z_POUPE_EAU + s * (Z_ETRAVE_EAU - Z_POUPE_EAU)


def y_pont(z):
    """Le dessus de la coque en z : plat, puis relevé vers l'étrave."""
    t = max(0.0, (z - Z_TONTURE) / (Z_ETRAVE - Z_TONTURE))
    return Y_PONT + TONTURE * t * t


def parametres():
    """Les sections, serrées aux deux bouts (pas en cosinus) : la poupe ronde et la pointe ne montrent pas de facettes."""
    return [(1 - math.cos(math.pi * k / SECTIONS)) / 2 for k in range(SECTIONS + 1)]


def coque(f):
    """La bande de flottaison os, la coque graphite, le pont d'équipe : trois solides faits des mêmes sections."""
    bande, carene, pont = [], [], []
    for s in parametres():
        wb, zb = plan(s, pont=False)
        wt, zt = plan(s, pont=True)
        yt = y_pont(zt)
        bande.append([(-wb, 0.0, zb), (-wb, FLOTTAISON, zb), (wb, FLOTTAISON, zb), (wb, 0.0, zb)])
        # La coque descend dans la bande : son pied arrondi s'y cache, et le
        # graphite sort de l'os d'un trait net, sans gorge qui prendrait la lumière.
        wc = max(0.006, wb - 0.004)
        carene.append([(-wc, 0.0, zb), (-wt, yt, zt), (wt, yt, zt), (wc, 0.0, zb)])
        # Le pont suit les génératrices du flanc, en retrait constant : là où la
        # coque est lancée et évasée (l'étrave), un pont bâti droit la percerait.
        cote = []
        for y in (yt - PONT_DESSOUS, yt + PONT_DESSUS):
            t = y / yt
            cote.append((max(0.004, wc + t * (wt - wc) - RETRAIT_PONT), y, zb + t * (zt - zb)))
        (x1, y1, z1), (x2, y2, z2) = cote
        pont.append([(-x1, y1, z1), (-x2, y2, z2), (x2, y2, z2), (x1, y1, z1)])
    f.solide('base', bande, 'os', fin=True, nom='flottaison')
    f.solide('base', carene, 'graphite', nom='coque')
    f.solide('base', pont, 'equipe', nom='pont')


def cercle(centre, u, w, rayon, n):
    """Un cercle de `n` points autour de `centre`, dans le plan des directions `u` et `w`."""
    return [tuple(c + rayon * (math.cos(2 * math.pi * k / n) * a + math.sin(2 * math.pi * k / n) * d) for c, a, d in zip(centre, u, w))
            for k in range(n)]


def canon(f, noeud, depart, nom):
    """
    Un canon levé : le tube graphite, et sa bouche, un anneau d'acier clair percé
    de son âme — on voit le bout sombre du tube au fond : une bouche pleine
    ferait quatre disques clairs, et l'acier passerait son plafond.
    """
    tube = f.cylindre(noeud, tuple(p + d * LONGUEUR_CANON / 2 for p, d in zip(depart, AXE)), RAYON_CANON, LONGUEUR_CANON, 'graphite', axe=AXE, nom=nom)
    # Un repère autour de l'axe : u à plat (x), w dans le plan de tir.
    u = (1.0, 0.0, 0.0)
    w = (0.0, AXE[2], -AXE[1])
    n = b.segments_cercle(RAYON_BOUCHE)
    bout = tuple(p + d * (LONGUEUR_CANON + 0.006) for p, d in zip(depart, AXE))
    fond = tuple(p - d * LONGUEUR_BOUCHE for p, d in zip(bout, AXE))
    # Dehors, du fond au bout ; puis dedans, du bout au fond : un manchon ouvert au bout.
    anneaux = [cercle(fond, u, w, RAYON_BOUCHE, n), cercle(bout, u, w, RAYON_BOUCHE, n), cercle(bout, u, w, AME, n), cercle(fond, u, w, AME, n)]
    bouche = f.solide(noeud, anneaux, 'acier_clair', nom=f'{nom}_bouche')
    bouche.avec = tube.nom
    return [tube, bouche]


def tourelle(f, noeud, noeud_canons, z, y_porteur, nom):
    """Une tourelle : son corps sombre levé sur un anneau, son toit du camp, ses deux canons."""
    lx, lz, h = TOURELLE
    y_base = y_porteur + LEVEE
    # Le corps, sombre comme les canons qui en sortent ; le toit d'équipe, qui
    # déborde : d'en haut, une tourelle est un couvercle de la couleur du camp
    # posé sur une ombre, et elle se détache du pont, de la même couleur.
    contour = b.contour_rectangle(0.0, 0.0, lx, lz, rayon=RAYON_TOURELLE)
    f.tourelle_profil(noeud, (0.0, y_base, z), contour, h, teinte='graphite', retraits=RETRAITS_TOURELLE, nom=f'{nom}_corps')
    tx, tz, te, ty = TOIT
    toit = b.contour_rectangle(0.0, -0.004, tx, tz, rayon=RAYON_TOURELLE + 0.005)
    f.tourelle_profil(noeud, (0.0, y_base + ty, z), toit, te, teinte='equipe', retraits=RETRAITS_TOIT, biseau=BISEAU_TOIT, nom=nom)
    y0, y1 = y_porteur - 0.012, y_base + 0.004
    f.cylindre(noeud, (0.0, (y0 + y1) / 2, z), RAYON_ANNEAU, y1 - y0, 'graphite', axe='y', nom=f'{nom}_anneau')
    dy, dz = TOURILLON
    for cote in (1, -1):
        canon(f, noeud_canons, (cote * X_CANONS, y_base + dy, z + dz), f'{nom}_canon_{"g" if cote > 0 else "d"}')
    return y_base


def chateau(f):
    """Le rouf, la tour et sa passerelle vitrée, la cheminée. Rend le dessus de la passerelle et son z."""
    lx, z0, z1, h = ROUF
    y0, y1 = Y_PONT + SOCLE_ROUF, Y_PONT + h
    zc, lz = (z0 + z1) / 2, z1 - z0
    e = 0.016
    f.extrusion('corps', b.contour_rectangle(0.0, zc, lx, lz, rayon=0.035), b.contour_rectangle(0.0, zc, lx - 2 * e, lz - 2 * e, rayon=0.028),
                y0, y1, 'equipe', nom='rouf')
    # Le socle, sombre et en retrait : un trait d'ombre au pied du château.
    r = 0.013
    f.extrusion('corps', b.contour_rectangle(0.0, zc, lx - 2 * r, lz - 2 * r, rayon=0.025), None, Y_PONT - 0.02, y0 + 0.004, 'graphite', nom='socle_rouf')

    tx, tz, th = TOUR
    yt0, yt1 = y1 - 0.01, y1 + th
    f.extrusion('corps', b.contour_rectangle(0.0, Z_TOUR, tx, tz, rayon=0.028), b.contour_rectangle(0.0, Z_TOUR - 0.006, tx - 0.016, tz - 0.024, rayon=0.022),
                yt0, yt1, 'equipe', nom='tour')

    px, pz, ph = PASSERELLE
    yp0, yp1 = yt1 - 0.012, yt1 + ph
    zp = Z_TOUR + 0.008
    passerelle = f.extrusion('corps', b.contour_rectangle(0.0, zp, px, pz, rayon=0.028), b.contour_rectangle(0.0, zp, px - 0.026, pz - 0.026, rayon=0.02),
                             yp0, yp1, 'equipe', nom='passerelle')
    vitres = f.extrusion('corps', b.contour_rectangle(0.0, zp, px + 0.008, pz + 0.008, rayon=0.032), None, yp0 + 0.008, yp0 + 0.042, 'verre', nom='vitres')
    vitres.avec = passerelle.nom

    r, hc, ell, devers = CHEMINEE
    a = math.radians(devers)
    axe = (0.0, math.cos(a), -math.sin(a))
    base = (0.0, y1 - 0.01, Z_CHEMINEE)
    centre = tuple(p + d * hc / 2 for p, d in zip(base, axe))
    f.cylindre('corps', centre, r, hc, 'equipe', axe=axe, ellipse=ell, nom='cheminee')
    haut = tuple(p + d * (hc + 0.012) for p, d in zip(base, axe))
    f.cylindre('corps', haut, r + 0.004, 0.05, 'graphite', axe=axe, ellipse=ell, nom='cheminee_coiffe')
    return yp1, zp


def construire(f):
    y_1 = y_pont(Z_TOURELLE_1)
    base_1 = y_1 + LEVEE
    base_2 = Y_BARBETTE + LEVEE
    f.noeud('base', pivot=(0, FLOTTAISON, 0))
    f.noeud('corps', parent='base', pivot=(0, Y_PONT, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('module_tourelle', parent='corps', pivot=(0, base_1, Z_TOURELLE_1))
    f.noeud('module_canon_long', parent='module_tourelle', pivot=(0, base_1 + TOURILLON[0], Z_TOURELLE_1 + TOURILLON[1]))
    f.noeud('tourelle_2', parent='corps', pivot=(0, base_2, Z_TOURELLE_2))
    f.noeud('canons_2', parent='tourelle_2', pivot=(0, base_2 + TOURILLON[0], Z_TOURELLE_2 + TOURILLON[1]))

    coque(f)

    # La barbette de la seconde tourelle : un fût d'équipe, qui la hisse au-dessus de la première.
    yb0 = Y_PONT - 0.01
    f.cylindre('corps', (0.0, (yb0 + Y_BARBETTE) / 2, Z_TOURELLE_2), RAYON_BARBETTE, Y_BARBETTE - yb0, 'equipe', axe='y', nom='barbette')

    tourelle(f, 'module_tourelle', 'module_canon_long', Z_TOURELLE_1, y_1, 'tourelle_1')
    tourelle(f, 'tourelle_2', 'canons_2', Z_TOURELLE_2, Y_BARBETTE, 'tourelle_2')

    y_toit, z_passerelle = chateau(f)

    # Le mât, sur le toit de la passerelle, et sa vergue.
    z_mat = z_passerelle - 0.015
    f.noeud('mat', parent='corps', pivot=(0, y_toit, z_mat))
    f.antenne('mat', base=(0, y_toit - 0.01, z_mat), hauteur=MAT)
    f.cylindre('mat', (0, y_toit + 0.1, z_mat), 0.015, 0.13, 'graphite', axe='x', fin=True, nom='vergue')


def animer(f):
    # Repos : un léger tangage, et rien d'autre ; les tourelles ne bougent pas.
    b.balancer(f.clip('repos'), 'base', 'x', 0.35, periodes=1)

    # Déplacement : un tangage un peu plus ample et un pilonnement léger.
    d = f.clip('deplacement')
    b.balancer(d, 'base', 'x', 1.2, periodes=1)
    b.osciller(d, 'base', 'y', 0.004, periodes=2)

    # Tir : la première tourelle, puis la seconde ; les canons reculent le long
    # de leur axe, la coque encaisse un roulis et se cabre à peine.
    t = f.clip('tir')
    recul = tuple(-c for c in AXE)
    b.recul(t, 'module_canon_long', recul, 0.045, attaque=0.05, retour=0.35)
    b.recul(t, 'canons_2', recul, 0.045, debut=0.09, attaque=0.05, retour=0.35)
    b.secousse(t, 'base', 'z', 2.2, oscillations=1.5)
    b.a_coup(t, 'base', 'x', -1.0, attaque=0.08, retour=0.4)

    # Touché : la coque roule et s'enfonce un instant.
    k = f.clip('touche')
    b.secousse(k, 'base', 'z', 3.0, oscillations=2)
    b.secousse(k, 'base', 'x', 1.0, oscillations=1.5)
    b.sursaut(k, 'base', '-y', 0.012)

    # Hors jeu : la coque s'enfonce, gîte et s'assied sur sa poupe ; la première tourelle se
    # détourne vers le joueur (retombés vers l'avant, ses canons sortiraient de la case), les canons
    # retombent un peu, le mât penche.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'base', descente=(0, -0.045, 0), rotation=('z', -10.0))
    b.affaisser(h, 'base', rotation=('x', -4.0), debut=0.1, duree=0.7)
    b.affaisser(h, 'module_tourelle', rotation=('y', -25.0), debut=0.15, duree=0.55)
    b.affaisser(h, 'module_canon_long', rotation=('x', 8.0), debut=0.2, duree=0.5)
    b.affaisser(h, 'canons_2', rotation=('x', 8.0), debut=0.2, duree=0.55)
    b.affaisser(h, 'mat', rotation=('z', -22.0), debut=0.25, duree=0.5)
