"""
Le chasseur furtif : une pointe de flèche plate, taillée à facettes, qui file
au ras du plateau.

Ce qui le dit à 48 pixels : une aile volante triangulaire d'une seule pièce,
sans dérive ni rien de dressé, à la couleur du camp, aux saumons émoussés
comme ceux d'un jouet ; ses deux bords d'attaque graphite qui se rejoignent en
un nez sombre ; l'épaisseur d'une aile de jouet, un flanc d'équipe sur un
ventre graphite ; au milieu, une bosse basse en losange allongé, à pans francs,
qui porte une verrière de verre à facettes, flanquée de deux entrées d'air
graphite ; dans l'échancrure arrière, la fente graphite de la tuyère et sa
plage claire. Au tir, un missile clair tombe de la soute et file sous le nez.

Trois choix que la mesure a tranchés :

- Les facettes se lisent par la pente, pas par la direction : sous
  l'éclairage de la cuisson (principale du joueur, contour de l'arrière, ciel),
  un pan à 25° sort à 0,93–0,96 d'un dessus plat, quelle que soit sa
  direction ; à 52°, à 0,79–0,88. D'où une aile plate et une bosse raide.
- Le pan graphite du bord d'attaque est plat et le flanc d'équipe tient sous
  2 cm : à 3 cm, il cachait le bord d'attaque éloigné et le « V » sombre du nez
  ne se lisait plus que d'un côté.
- La plage de tuyère est os : sans elle, équipe, graphite et verre ne tenaient
  pas ensemble dans la charte (équipe ≤ 60 %, sombre ≤ 35 %, verre ≤ 8 %).

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b

#: Le bas de la grande classe, comme le chasseur : le bombardier sera au-dessus.
LARGEUR_VISEE = (0.88, 0.90)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.30                    # bas de la silhouette au repos (charte : avions à 0,30 m)

# Le plan de l'aile : le nez, les deux saumons, l'échancrure arrière. Un jouet
# n'a pas de pointe en aiguille : le nez et les saumons sont arrondis d'un congé
# tangent (`R_NEZ`, `R_SAUMON`), que chaque contour rentré reprend.
Z_NEZ = 0.50
DEMI_ENVERGURE = 0.35
Z_SAUMON = -0.335
Z_ECHANCRURE = -0.17
R_NEZ = 0.012
R_SAUMON = 0.02
R_MIN = 0.004                 # le plus petit congé d'un contour rentré
PAS_CONGE = 8                 # 17° au plus d'un côté à l'autre : l'arc reste lisse, sans chanfrein

# Le ventre graphite : un flanc raide (on le voit sous le bord d'attaque), puis
# le pan du bord d'attaque qui monte doucement vers la coque.
Y_ARETE = ALT + 0.032         # l'arête du bord
Y_PAN = ALT + 0.046           # le haut du pan de bord d'attaque
Y_VENTRE = ALT + 0.054        # le dessus du ventre, caché sous l'aile
BORD_ATTAQUE = 0.031          # largeur du pan graphite, vue de dessus
BORD_FUITE = 0.006            # le ventre dépasse à peine sous le bord de fuite
RETRAIT_DESSOUS = 0.975       # le dessous, à peine plus petit : le flanc est presque droit

# L'aile d'équipe : un dessus plat, posé sur le ventre ; son flanc, au-dessus du
# ventre sombre, donne à l'aile l'épaisseur d'un jouet. Plus haut que 2 cm, il
# cacherait le pan du bord d'attaque du côté éloigné.
Y_COQUE = ALT + 0.022         # enfoncée dans le ventre
Y_AILE = ALT + 0.064          # le dessus de l'aile

# La bosse centrale : un hexagone allongé vu de dessus, des pans raides, un dos
# plat étroit. À 52°, un pan sort nettement plus sombre que le dessus plat
# (0,79 à 0,88 contre 1 sous l'éclairage de la cuisson) : c'est ce qui fait lire
# les facettes ; sous 35°, la lumière symétrique les aplatit toutes.
BOSSE = [(0.0, 0.35), (-0.09, 0.13), (-0.09, -0.03), (0.0, -0.10), (0.09, -0.03), (0.09, 0.13)]
H_BOSSE = 0.06                # au-dessus du dessus de l'aile
PENTE_BOSSE = 52.0

# La verrière : une peau de verre posée sur l'avant de la bosse, qui en épouse
# les pans ; un losange vu de dessus, le plus large aux deux cinquièmes.
Z_VERR = (0.095, 0.335)
DEMI_VERR = 0.06
PART_LARGE = 0.4
LEVEE = 0.012                 # ce qui dépasse de la bosse

# Les entrées d'air : deux fentes graphite couchées sur l'aile, le long des
# flancs de la bosse (l'emplanture), dans le sens du vol.
Z_ENTREE = (0.0, 0.09)
ENTREE_ECART = (0.004, 0.038) # de la bosse vers le saumon
ENTREE_SAILLIE = 0.012

# La tuyère, le long du bord de fuite de l'aile : la plage claire contre le
# bord, la fente graphite devant elle. Retraits depuis le bord de fuite.
TUYERE_DEMI = 0.165
PLAGE = (0.004, 0.038)
FENTE = (0.038, 0.062)
TUYERE_SAILLIE = 0.012

# Le missile, rangé dans la soute au repos (sous la bosse, tout entier caché) :
# au tir, il tombe sous le ventre et file vers l'avant, puis rentre dans la
# soute entre deux images cuites — jamais rapetissé.
R_MISSILE = 0.026
Z_MISSILE = (-0.06, 0.16)
Y_MISSILE = ALT + 0.055
CHUTE = 0.10                  # de quoi sortir tout entier sous le ventre, et s'en détacher
COURSE = 0.30                 # vers l'avant ; la pointe reste sous le nez

# Le capteur affleurant (le nœud `module_antenne`) : une plaque graphite couchée
# dans la pointe sombre du nez, qui ne dépasse que de 5 mm. Posé sur le dos, il
# faisait une petite croix sombre, une rayure à 48 pixels.
CAPTEUR = [(0.0, 0.468), (-0.015, 0.443), (0.0, 0.418), (0.015, 0.443)]


# ---------------------------------------------------------------------------
# La géométrie plane
# ---------------------------------------------------------------------------

def _plan():
    """Le plan de l'aile, points (x, z), dans le sens de `contour_rectangle` : nez, saumon droit, échancrure, saumon gauche."""
    s = DEMI_ENVERGURE
    return [(0.0, Z_NEZ), (-s, Z_SAUMON), (0.0, Z_ECHANCRURE), (s, Z_SAUMON)]


def _intersection(p1, d1, p2, d2):
    det = d1[0] * d2[1] - d1[1] * d2[0]
    t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det
    return (p1[0] + t * d1[0], p1[1] + t * d1[1])


def _rentrer(poly, retraits):
    """Le contour `poly` rentré, bord par bord : le bord i (de poly[i] à poly[i+1]) de `retraits[i]` vers l'intérieur."""
    n = len(poly)
    if not isinstance(retraits, (list, tuple)):
        retraits = [retraits] * n
    lignes = []
    for i in range(n):
        a, c = poly[i], poly[(i + 1) % n]
        d = (c[0] - a[0], c[1] - a[1])
        l = math.hypot(*d)
        dedans = (-d[1] / l, d[0] / l)
        w = retraits[i]
        lignes.append(((a[0] + w * dedans[0], a[1] + w * dedans[1]), d))
    return [_intersection(*lignes[i - 1], *lignes[i]) for i in range(n)]


def _conge(poly, rayons, pas=PAS_CONGE):
    """
    Le contour `poly`, chaque sommet i remplacé par un arc tangent à ses deux
    bords, de rayon `rayons[i]` (`pas` + 1 points) ; un rayon nul garde le
    sommet. Deux contours congés avec les mêmes sommets arrondis ont le même
    nombre de points : les anneaux d'un solide.
    """
    n = len(poly)
    sortie = []
    for i in range(n):
        r, v = rayons[i], poly[i]
        if not r:
            sortie.append(v)
            continue
        p, q = poly[i - 1], poly[(i + 1) % n]
        la, lb = math.hypot(v[0] - p[0], v[1] - p[1]), math.hypot(q[0] - v[0], q[1] - v[1])
        a = ((v[0] - p[0]) / la, (v[1] - p[1]) / la)
        c = ((q[0] - v[0]) / lb, (q[1] - v[1]) / lb)
        tour = a[0] * c[1] - a[1] * c[0]
        phi = math.acos(max(-1.0, min(1.0, a[0] * c[0] + a[1] * c[1])))
        t = r * math.tan(phi / 2)
        p1 = (v[0] - a[0] * t, v[1] - a[1] * t)
        nrm = (-a[1], a[0]) if tour > 0 else (a[1], -a[0])
        centre = (p1[0] + nrm[0] * r, p1[1] + nrm[1] * r)
        a0 = math.atan2(p1[1] - centre[1], p1[0] - centre[0])
        sens = 1 if tour > 0 else -1
        for k in range(pas + 1):
            ang = a0 + sens * phi * k / pas
            sortie.append((centre[0] + r * math.cos(ang), centre[1] + r * math.sin(ang)))
    return sortie


def _arrondi(poly, retraits=(0.0, 0.0, 0.0, 0.0), echelle=1.0):
    """Un contour du plan (rentré de `retraits`, bord par bord), ses nez et saumons congés d'autant moins qu'il est rentré."""
    rl, rt = retraits[0], retraits[1]
    return _conge(poly, [max(R_MIN, echelle * R_NEZ - rl), max(R_MIN, echelle * R_SAUMON - (rl + rt) / 2), 0.0,
                         max(R_MIN, echelle * R_SAUMON - (rl + rt) / 2)])


def _vers(poly, centre, k):
    """Le contour ramené vers `centre` par une homothétie de rapport `k`."""
    return [(centre[0] + k * (x - centre[0]), centre[1] + k * (z - centre[1])) for x, z in poly]


def _distance_dedans(poly, x, z):
    """La plus petite distance du point (x, z) aux bords d'un contour convexe, comptée vers l'intérieur."""
    n = len(poly)
    d = math.inf
    for i in range(n):
        a, c = poly[i], poly[(i + 1) % n]
        ex, ez = c[0] - a[0], c[1] - a[1]
        l = math.hypot(ex, ez)
        d = min(d, ((x - a[0]) * -ez + (z - a[1]) * ex) / l)
    return d


def _plan_coque():
    return _rentrer(_plan(), [BORD_ATTAQUE, BORD_FUITE, BORD_FUITE, BORD_ATTAQUE])


def _hauteur_pan(x, z):
    """
    Le dessus du pan graphite du bord d'attaque au point (x, z) : de l'arête qui
    borde l'aile au haut du pan. Juste vers le nez, où les bords d'attaque sont
    les plus proches (le plan, échancré, n'est pas convexe).
    """
    d = _distance_dedans(_plan(), x, z)
    return Y_ARETE + (Y_PAN - Y_ARETE) * max(0.0, min(1.0, d / BORD_ATTAQUE))


def _hauteur_bosse(x, z):
    """Le dessus de la bosse au point (x, z) : un pan à `PENTE_BOSSE` depuis chaque bord, le dos plat au plus haut."""
    k = math.tan(math.radians(PENTE_BOSSE))
    return Y_AILE + min(H_BOSSE, _distance_dedans(BOSSE, x, z) * k)


def _peau(f, noeud, z0, z1, demi, teinte, nom, levee=LEVEE, enfonce=0.008, travers=9, long=18):
    """
    Une peau posée sur la bosse, de `z0` à `z1`, de demi-largeur `demi(z)` :
    des sections en travers qui suivent pan pour pan le dessus de la bosse,
    dépassant de `levee` et enfoncées de `enfonce`. Neuf points en travers :
    la cassure du dos tombe toujours à moins de 1,5 cm d'un point, sous la levée.
    """
    anneaux = []
    for i in range(long + 1):
        z = z0 + (z1 - z0) * i / long
        w = max(0.004, demi(z))
        xs = [w * (2 * j / (travers - 1) - 1) for j in range(travers)]
        dessus = [(x, _hauteur_bosse(x, z) + levee, z) for x in xs]
        dessous = [(x, _hauteur_bosse(x, z) - enfonce, z) for x in reversed(xs)]
        anneaux.append(dessus + dessous)
    return f.solide(noeud, anneaux, teinte, nom=nom)


def _bande_fuite(r0, r1, demi):
    """
    Une bande en chevron le long du bord de fuite de l'aile d'équipe, de `r0`
    à `r1` en retrait du bord, de −`demi` à +`demi` en x : ses points (x, z).
    """
    def ligne(r):
        _, dr, e, g = _rentrer(_plan_coque(), [0.0, r, r, 0.0])

        def sur(p0, p1, x):
            u = (x - p0[0]) / (p1[0] - p0[0])
            return (x, p0[1] + u * (p1[1] - p0[1]))

        return [sur(e, dr, -demi), e, sur(e, g, demi)]

    return ligne(r0) + list(reversed(ligne(r1)))


# ---------------------------------------------------------------------------
# Les pièces
# ---------------------------------------------------------------------------

def _plaque(f, noeud, contour, hauteur, enfonce, saillie, teinte, nom, fin=False):
    """Une plaque posée sur une surface : son contour (x, z), enfoncé de `enfonce` sous elle et dépassant de `saillie`."""
    bas = [(x, hauteur(x, z) - enfonce, z) for x, z in contour]
    haut = [(x, hauteur(x, z) + saillie, z) for x, z in contour]
    return f.solide(noeud, [bas, haut], teinte, fin=fin, nom=nom)


def construire(f):
    y_pivot = Y_VENTRE
    f.noeud('corps', pivot=(0, y_pivot, 0))
    f.noeud('base', parent='corps', pivot=(0, y_pivot, 0))
    f.noeud('module_antenne', parent='corps', pivot=(0, Y_PAN, CAPTEUR[1][1]))
    f.noeud('socle', pivot=(0, 0, 0))
    zm = (Z_MISSILE[0] + Z_MISSILE[1]) / 2
    f.noeud('missile', parent='corps', pivot=(0, Y_MISSILE, zm))

    plan = _plan()
    centre = (0.0, (Z_NEZ + Z_SAUMON) / 2)

    # L'aile d'équipe : un dessus plat, d'un seul tenant.
    coque = _arrondi(_plan_coque(), (BORD_ATTAQUE, BORD_FUITE))
    aile = f.solide('base', [
        [(x, Y_COQUE, z) for x, z in coque],
        [(x, Y_AILE, z) for x, z in coque],
    ], 'equipe', nom='aile')
    minces = [aile]

    # Le ventre graphite : le dessous, le flanc raide, le pan du bord d'attaque, puis une marche cachée sous l'aile.
    dessous = _arrondi(_vers(plan, centre, RETRAIT_DESSOUS), echelle=RETRAIT_DESSOUS)
    pan = _arrondi(_rentrer(plan, [BORD_ATTAQUE, BORD_FUITE, BORD_FUITE, BORD_ATTAQUE]), (BORD_ATTAQUE, BORD_FUITE))
    marche = _arrondi(_rentrer(plan, [BORD_ATTAQUE + 0.012, BORD_FUITE + 0.012, BORD_FUITE + 0.012, BORD_ATTAQUE + 0.012]),
                      (BORD_ATTAQUE + 0.012, BORD_FUITE + 0.012))
    ventre = f.solide('base', [
        [(x, ALT, z) for x, z in dessous],
        [(x, Y_ARETE, z) for x, z in _arrondi(plan)],
        [(x, Y_PAN, z) for x, z in pan],
        [(x, Y_VENTRE, z) for x, z in marche],
    ], 'graphite', nom='ventre')
    minces.append(ventre)

    # La bosse centrale, à pans francs.
    k = math.tan(math.radians(PENTE_BOSSE))
    dos = _rentrer(BOSSE, H_BOSSE / k)
    bosse = f.solide('base', [
        [(x, Y_AILE - 0.012, z) for x, z in BOSSE],
        [(x, Y_AILE, z) for x, z in BOSSE],
        [(x, Y_AILE + H_BOSSE, z) for x, z in dos],
    ], 'equipe', nom='bosse')

    # La verrière : une peau de verre sur l'avant de la bosse, à facettes comme elle.
    z0, z1 = Z_VERR

    def demi_verr(z):
        u = (z - z0) / (z1 - z0)
        return DEMI_VERR * (u / PART_LARGE if u < PART_LARGE else (1 - u) / (1 - PART_LARGE))

    verriere = _peau(f, 'base', z0, z1, demi_verr, 'verre', 'verriere')
    minces.append(verriere)

    # Les entrées d'air : deux fentes graphite couchées sur l'aile, le long des flancs de la bosse.
    xb = abs(BOSSE[1][0])
    for cote, c in ((1, 'g'), (-1, 'd')):
        x0, x1 = cote * (xb + ENTREE_ECART[0]), cote * (xb + ENTREE_ECART[1])
        za, zb = Z_ENTREE
        contour = [(x0, zb), (x1, zb), (x1, za), (x0, za)]
        entree = _plaque(f, 'base', contour, lambda x, z: Y_AILE, 0.026, ENTREE_SAILLIE, 'graphite', f'entree_{c}')
        minces.append(entree)

    # La tuyère : la plage claire contre le bord de fuite, la fente graphite devant elle.
    def plat(x, z):
        return Y_AILE

    plage = _plaque(f, 'base', _bande_fuite(*PLAGE, TUYERE_DEMI), plat, 0.03, TUYERE_SAILLIE * 0.6, 'os', 'plage')
    fente = _plaque(f, 'base', _bande_fuite(*FENTE, TUYERE_DEMI + 0.012), plat, 0.03, TUYERE_SAILLIE, 'graphite', 'fente')
    minces += [plage, fente]
    for p in minces:
        p.avec = bosse.nom

    # Le missile os, dans la soute : un fût à pointe en ogive et sa bague graphite.
    lm = Z_MISSILE[1] - Z_MISSILE[0]
    corps_missile = f.revolution('missile', (0, Y_MISSILE, Z_MISSILE[0]), [
        (R_MISSILE * 0.75, 0.0), (R_MISSILE, 0.02), (R_MISSILE, lm * 0.62), (R_MISSILE * 0.8, lm * 0.8),
        (R_MISSILE * 0.42, lm * 0.93), (R_MISSILE * 0.1, lm),
    ], 'os', axe='z', nom='missile')
    bague = f.cylindre('missile', (0, Y_MISSILE, Z_MISSILE[0] + 0.035), R_MISSILE * 1.08, 0.04, 'graphite', axe='z', nom='missile_bague')
    bague.avec = corps_missile.nom

    # Le capteur affleurant, dans la pointe du nez.
    _plaque(f, 'module_antenne', CAPTEUR, _hauteur_pan, 0.025, 0.005, 'graphite', 'capteur', fin=True)


def _bascule(clip, apres):
    """
    La première clé d'échantillonnage où l'obturateur de la cuisson est fermé
    après l'instant `apres` : un saut posé là tombe entre deux images cuites,
    sans traîner de flou (la cuisson ouvre l'obturateur sur `FLOU_DE_BOUGE` du
    pas, centré sur chaque image). La même règle que le chasseur.
    """
    ts = b.instants_cuisson(clip)
    demi = b.FLOU_DE_BOUGE * (ts[1] - ts[0]) / 2
    cle = 1.0 / b.FREQUENCE_CLES
    for k, t in enumerate(ts[:-1]):
        s = math.ceil((t + demi) / cle + 0.1) * cle
        if s >= apres and s + cle <= ts[k + 1] - demi + 1e-6:
            return s
    raise ValueError(f'{clip.nom} : pas de bascule possible après {apres} s')


def _tirer(clip, depart, chute, envol, rentre_apres):
    """
    Le missile quitte la soute : il tombe sous le ventre (`chute` secondes),
    file vers l'avant en accélérant, puis rentre d'un coup dans la soute entre
    deux images cuites, où il reste caché jusqu'à la fin du clip.
    """
    s_rentre = _bascule(clip, rentre_apres)

    def ft(t):
        if t <= depart or t > s_rentre + 1e-6:
            return (0.0, 0.0, 0.0)
        u = min(1.0, (t - depart) / chute)
        y = -CHUTE * b.lisse(u)
        v = max(0.0, min(1.0, (t - depart - chute) / envol))
        return (0.0, y, COURSE * v * v)

    clip.translation('missile', ft)


def animer(f):
    # Repos : un vol calme ; il monte et descend de quelques millimètres, roule d'un degré.
    r = f.clip('repos')
    b.osciller(r, 'corps', 'y', 0.004, periodes=1)
    b.balancer(r, 'corps', 'z', 1.0, periodes=1)

    # Déplacement : un léger piqué, et il se balance à peine.
    d = f.clip('deplacement')
    d.rotation('corps', lambda t: ('x', 5.0))
    b.balancer(d, 'corps', 'z', 1.5, periodes=1)
    b.osciller(d, 'corps', 'y', 0.005, periodes=1)

    # Tir : la trappe lâche le missile, qui file sous le nez ; l'appareil recule d'un rien et se cabre un instant.
    t = f.clip('tir')
    _tirer(t, depart=0.02, chute=0.1, envol=0.22, rentre_apres=0.34)
    b.recul(t, 'corps', '-z', 0.01, debut=0.12, attaque=0.06, retour=0.4)
    b.a_coup(t, 'corps', 'x', -3.0, debut=0.12, attaque=0.07, retour=0.45)

    # Touché : il roule, vacille et s'enfonce un peu, puis se reprend.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 8.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)

    # Hors jeu : il s'affaisse sur l'aile droite, le nez bas.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 18.0))
    b.affaisser(h, 'corps', rotation=('x', 10.0), debut=0.1, duree=0.7)
