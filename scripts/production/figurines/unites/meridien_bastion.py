"""
Le bastion méridien : la forteresse anti-aérienne des Gris, l'anti-air en boss.

Ce qui le dit à 48 pixels : une casemate octogonale aux pans couchés, à la
couleur du camp, sur deux larges chenilles dont les coins dépassent sous ses
pans coupés ; au milieu, une tourelle hexagonale à facettes, elle aussi à la
couleur du camp, posée dans un collier hexagonal d'apprêt qui la dessine ;
sur son dessus, deux affûts d'apprêt à deux coins opposés, qui dressent
chacun deux canons graphite à 70° — quatre canons vers le ciel, bouches vers
la droite ; sur le pan droit de la tourelle, l'œil orange des Gris dans son
orbite hexagonale d'apprêt ; sur le pan coupé avant droit de la casemate,
leur chevron orange. Classe grande : 0,90 à 0,94 case de large en vue
« droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Ce que les planches et la mesure ont tranché :

- **La vue « droite », « bas » et « haut » montrent toutes le flanc droit**
  (lacets 60°, 20° et 160°) : l'œil et le chevron y sont posés, là où le
  joueur les voit toujours. L'œil regarde la caméra dans les trois vues ; le
  chevron, sur le pan coupé qui lui fait face en vue « droite » (à 15° près),
  s'y lit comme un « V » de face — posé sur le glacis, la perspective d'une
  pente vue de biais en faisait une coche.
- **Les affûts sont sur le dessus de la tourelle.** Posés sur ses pans, la
  paire de devant se voyait sur la tourelle en vue « droite » et ne sortait
  pas de la silhouette : on ne lisait qu'une paire de canons. Les canons
  visent l'avant gauche (60°) : les deux paires penchent vers la droite et
  s'écartent l'une de l'autre en travers de leur axe, comme les deux tubes
  de l'anti-air, mais doublés et de part et d'autre de la tourelle.
- **Le collier d'apprêt est plus large que la tourelle** : sans lui,
  tourelle et casemate, de la même couleur, se fondaient en un plateau (le
  reproche fait à l'ancien bastion) ; avec lui, l'hexagone se lit jusqu'à
  48 pixels, et l'apprêt signe les Gris. Il absorbe aussi le pied vertical de
  la tourelle, qui restait dans l'ombre.
- **La casemate est couchée à 45°.** À 52°, le glacis, l'arrière et les pans
  coupés tournés vers la gauche restaient sous 0,8 de lumière (0,78 à 0,80
  au calcul lambertien de la cuisson) et l'équipe éclairée tombait sous 60 %.
- **Les grands pans coupés** montrent l'octogone en vues « bas » et « haut »
  et laissent dépasser les coins des chenilles : la forteresse sur chenilles
  que le panel décrivait, et une ombre chinoise qui s'écarte de celle du char
  lourd, l'autre grand caisson chenillé du plateau.
"""

import math

import bibliotheque as b

#: Le haut de la classe grande : plus massif que le char lourd.
LARGEUR_VISEE = (0.90, 0.94)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

# Le train : deux larges chenilles, cinq galets de chaque côté.
LONGUEUR_TRAIN = 0.68
DEMI_VOIE = 0.235
LARGEUR_CHENILLE = 0.15
HAUTEUR_CHENILLE = 0.18
RAYON_GALET = 0.05
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.068
Z_GALETS = (-0.24, -0.12, 0.0, 0.12, 0.24)
X_GALETS = DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012
PART_MOYEU = 0.5

# Le ventre, graphite, entre les chenilles.
VENTRE = (0.32, (0.05, 0.15), 0.58)          # largeur, (bas, haut), longueur

# La casemate : un tronc d'octogone aux pans couchés à 45° de tous côtés.
CASEMATE_Y = (0.17, 0.255)
CASEMATE_BAS_DIM = (0.64, 0.72, 0.15)
CASEMATE_HAUT_DIM = (0.47, 0.55, 0.11)
PONT = CASEMATE_Y[1]

# La tourelle : un hexagone pointe en avant (coins à 0°, ±60°, ±120°, 180° ;
# pans à ±30°, ±90°, ±150°), un grand biseau, un dessus plat. Son pied est
# dans le collier d'apprêt, plus large qu'elle, qui la détache du pont.
COLLIER_Y = (PONT - 0.015, PONT + 0.06)
COLLIER_R = 0.255
TOURELLE_Y = (PONT + 0.05, PONT + 0.065, PONT + 0.15)
TOURELLE_R = (0.235, 0.23, 0.145)
PHASE = 0.0                                  # un coin droit devant

# Les affûts : deux blocs d'apprêt plantés sur le dessus de la tourelle, à
# deux coins opposés ; chacun dresse deux canons côte à côte. Les canons
# visent l'avant gauche du modèle (60°), relevés à 70° : en vue « droite »,
# les deux paires penchent vers la droite et sortent toutes deux de la
# silhouette.
AZIMUT_TIR = 60.0
ELEVATION = 70.0
_A, _E = math.radians(AZIMUT_TIR), math.radians(ELEVATION)
AXE = (math.sin(_A) * math.cos(_E), math.sin(_E), math.cos(_A) * math.cos(_E))       # la direction des canons
DOS = (-math.sin(_A) * math.sin(_E), math.cos(_E), -math.cos(_A) * math.sin(_E))     # perpendiculaire, vers le haut
TOURILLONS = (math.cos(_A), 0.0, -math.sin(_A))                                        # l'axe des tourillons, vers la gauche du tir
Y_TOURILLON = TOURELLE_Y[2] - 0.005
D_AFFUT = 0.115                              # du centre de la tourelle au milieu d'un affût, le long des tourillons
AFFUT = (0.09, 0.12, 0.15)                  # épaisseur (le long de DOS), largeur (le long des tourillons), longueur (le long de AXE)
AFFUT_LEVE = 0.035                           # le bloc monte le long de l'axe au-dessus du tourillon
ECART_CANONS = 0.068
RAYON_CANON = 0.027
LONGUEUR_CANON = 0.25                        # au-delà du bloc
RAYON_BOUCHE = 0.032
LONGUEUR_BOUCHE = 0.03
RECUL_TIR = 0.055

# L'œil : une boule orange dans une orbite hexagonale d'apprêt, au milieu du
# pan droit de la tourelle (−90°), qui regarde la caméra dans les trois vues.
# C'est le capteur du bastion : il tient le rôle du `module_radar` de la fiche.
AZIMUT_OEIL = -90.0
R_OEIL = 0.062                               # 0,124 m de diamètre : 6 px à 48 px par case
R_ORBITE = 0.088
ORBITE_SAILLIE = 0.024                       # l'orbite dépasse du pan de 2,4 cm (et s'y enfonce de 2)
OEIL_SAILLIE = 0.014                         # le centre de la boule, devant le pan

# Le chevron, sur le pan coupé avant droit de la casemate, la pointe en bas.
CHEVRON_ENVERGURE = 0.095                    # demi-largeur, le long du pan
CHEVRON_HAUTEUR = 0.1                        # vers le haut du pan
CHEVRON_BARRE = 0.056
CHEVRON_MILIEU = 0.48                        # sa place sur le pan, depuis le bas
CHEVRON_EPAISSEUR = 0.024                    # une plaque, à moitié dans le pan

# L'antenne fouet, au coin arrière droit du pont.
BASE_ANTENNE = (-0.13, PONT - 0.005, -0.19)
HAUTEUR_ANTENNE = 0.2


# ---------------------------------------------------------------------------
# Aides locales
# ---------------------------------------------------------------------------

def ajoute(p, v, t=1.0):
    return tuple(a + t * c for a, c in zip(p, v))


def azimut(g):
    """La direction horizontale d'un azimut, en degrés depuis l'avant vers la gauche."""
    r = math.radians(g)
    return (math.sin(r), 0.0, math.cos(r))


def hexagone(r, y, cx=0.0, cz=0.0, phase=PHASE):
    """Les six coins (x, y, z) d'un hexagone de rayon `r` aux coins, le premier à `phase` degrés de l'avant vers la gauche."""
    return [(cx + r * math.sin(math.radians(phase + 60 * k)), y, cz + r * math.cos(math.radians(phase + 60 * k))) for k in range(6)]


def octogone(lx, lz, c, y, cz=0.0):
    """Un rectangle aux coins coupés à 45°, vu de dessus : points (x, y, z)."""
    hx, hz = lx / 2, lz / 2
    return [(hx - c, y, cz + hz), (-(hx - c), y, cz + hz), (-hx, y, cz + hz - c), (-hx, y, cz - hz + c),
            (-(hx - c), y, cz - hz), (hx - c, y, cz - hz), (hx, y, cz - hz + c), (hx, y, cz + hz - c)]


def repere(axe, haut):
    """Un repère orthonormé autour de `axe` : (axe, u, w), `u` au plus près de `haut`."""
    n = math.sqrt(sum(c * c for c in axe))
    a = tuple(c / n for c in axe)
    d = sum(x * y for x, y in zip(haut, a))
    u = tuple(h - d * c for h, c in zip(haut, a))
    n = math.sqrt(sum(c * c for c in u))
    u = tuple(c / n for c in u)
    w = (a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0])
    return a, u, w


def polygone(centre, axe, haut, rayon, cotes, phase=0.0):
    """Un polygone régulier autour de `centre`, dans le plan normal à `axe`."""
    _, u, w = repere(axe, haut)
    return [tuple(centre[i] + rayon * (math.cos(math.radians(phase + 360.0 * k / cotes)) * u[i]
                                       + math.sin(math.radians(phase + 360.0 * k / cotes)) * w[i]) for i in range(3))
            for k in range(cotes)]


def bloc(f, noeud, centre, axe, haut, dims, teinte, pan=0.3, nom=None, chanfrein=None):
    """
    Un bloc octogonal le long de `axe` : section `dims[0]` (le long de `haut`)
    × `dims[1]`, longueur `dims[2]`, coins coupés de `pan` (part du plus petit
    côté) : une facette à chaque coin.
    """
    a, u, w = repere(axe, haut)
    hu, hw = dims[0] / 2, dims[1] / 2
    c = pan * min(dims[0], dims[1])
    section = [(hu, hw - c), (hu - c, hw), (-(hu - c), hw), (-hu, hw - c), (-hu, -(hw - c)), (-(hu - c), -hw), (hu - c, -hw), (hu, -(hw - c))]
    anneaux = [[tuple(centre[i] + s * dims[2] * a[i] + p * u[i] + q * w[i] for i in range(3)) for p, q in section] for s in (-0.5, 0.5)]
    return f.solide(noeud, anneaux, teinte, nom=nom, chanfrein=chanfrein)


def pan_biseau(g):
    """Le milieu et la normale du biseau de la tourelle sur le pan d'azimut `g`."""
    (_, yb, yc), (_, rb, rc) = TOURELLE_Y, TOURELLE_R
    cos30 = math.cos(math.radians(30))
    ab, ac = rb * cos30, rc * cos30
    h = azimut(g)
    n = math.hypot(ab - ac, yc - yb)
    normale = (h[0] * (yc - yb) / n, (ab - ac) / n, h[2] * (yc - yb) / n)
    milieu = (h[0] * (ab + ac) / 2, (yb + yc) / 2, h[2] * (ab + ac) / 2)
    return milieu, normale


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.2, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('module_tourelle', parent='corps', pivot=(0, PONT, 0))
    f.noeud('module_antenne', parent='corps', pivot=BASE_ANTENNE)

    # Le train : deux larges bandes de caoutchouc, cinq galets graphite de
    # chaque côté, un nœud par essieu, moyeux d'apprêt en « D » (on les voit
    # rouler en déplacement).
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE, largeur=LARGEUR_CHENILLE)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=X_GALETS, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET, epaisseur=EPAISSEUR_GALET, teinte='graphite',
             teinte_moyeu='appret', part_moyeu=PART_MOYEU, meplat=True)

    # Le ventre, sombre, entre les chenilles.
    lv, (vb0, vb1), lz = VENTRE
    f.boite('corps', (0, (vb0 + vb1) / 2, 0), (lv, vb1 - vb0, lz), 'graphite', nom='ventre')

    # La casemate : un tronc d'octogone, entière à la couleur du camp.
    (l0, z0, c0), (l1, z1, c1) = CASEMATE_BAS_DIM, CASEMATE_HAUT_DIM
    casemate = f.solide('corps', [octogone(l0, z0, c0, CASEMATE_Y[0]), octogone(l1, z1, c1, CASEMATE_Y[1])], 'equipe', nom='casemate')

    # Le chevron, sur le pan coupé avant droit : celui qui regarde la caméra
    # presque de face en vue « droite », et de trois quarts en vue « bas ».
    # Une pointe de flèche plate, la pointe vers le bas du pan, vers l'avant.
    bas0 = octogone(l0, z0, c0, CASEMATE_Y[0])[1:3]         # l'arête basse du pan, de l'avant vers le flanc droit
    haut0 = octogone(l1, z1, c1, CASEMATE_Y[1])[1:3]
    mb = tuple((a + b_) / 2 for a, b_ in zip(*bas0))
    mh = tuple((a + b_) / 2 for a, b_ in zip(*haut0))
    long_pan = math.dist(mb, mh)
    montee = tuple((h_ - b_) / long_pan for h_, b_ in zip(mh, mb))   # vers le haut du pan
    travers = tuple((b_ - a) / math.dist(*bas0) for a, b_ in zip(*bas0))   # le long du pan, de l'avant vers le flanc
    normale = (montee[1] * travers[2] - montee[2] * travers[1], montee[2] * travers[0] - montee[0] * travers[2],
               montee[0] * travers[1] - montee[1] * travers[0])
    if normale[1] < 0:
        normale = tuple(-c for c in normale)
    milieu = ajoute(mb, montee, long_pan * CHEVRON_MILIEU)
    e, h, t = CHEVRON_ENVERGURE, CHEVRON_HAUTEUR, CHEVRON_BARRE
    # (s, v) : s le long du pan, v vers le haut du pan ; la pointe en bas.
    contour = [(0.0, -h / 2), (e, h / 2), (e - t, h / 2), (0.0, -h / 2 + t * 1.25), (-(e - t), h / 2), (-e, h / 2)]
    anneaux = [[tuple(milieu[i] + s_ * travers[i] + v * montee[i] + d * normale[i] for i in range(3)) for s_, v in contour]
               for d in (-CHEVRON_EPAISSEUR / 2, CHEVRON_EPAISSEUR / 2)]
    chevron = f.solide('corps', anneaux, 'orange', nom='chevron')
    chevron.avec = casemate.nom

    # Le collier d'apprêt, qui soulève la tourelle et la détache du pont.
    f.solide('module_tourelle', [hexagone(COLLIER_R, COLLIER_Y[0]), hexagone(COLLIER_R, COLLIER_Y[1])], 'appret', nom='collier')

    # La tourelle : son pied dans le collier, un grand biseau, un dessus plat.
    ya, yb, yc = TOURELLE_Y
    ra, rb, rc = TOURELLE_R
    f.solide('module_tourelle', [hexagone(ra, ya), hexagone(rb, yb), hexagone(rc, yc)], 'equipe', nom='tourelle', chanfrein=0.02)

    # Les affûts et leurs canons, plantés sur le dessus de la tourelle, l'un
    # vers l'avant droit, l'autre vers l'arrière gauche.
    for signe, nom in ((-1, 'avant'), (1, 'arriere')):
        lateral = tuple(signe * c for c in TOURILLONS)
        pivot = ajoute((0.0, Y_TOURILLON, 0.0), lateral, D_AFFUT)
        n_affut = f.noeud(f'affut_{nom}', parent='module_tourelle', pivot=pivot)
        # Le bloc, le long de l'axe des canons, son pied enfoncé dans la tourelle.
        centre = ajoute(pivot, AXE, AFFUT_LEVE)
        bloc(f, n_affut, centre, AXE, DOS, AFFUT, 'appret', nom=f'affut_{nom}')
        # Les deux canons, côte à côte le long des tourillons.
        for k, dl in enumerate((-ECART_CANONS / 2, ECART_CANONS / 2)):
            depart = ajoute(ajoute(centre, AXE, AFFUT[2] / 2 - 0.02), lateral, dl)
            n_canon = f.noeud(f'canon_{nom}_{k + 1}', parent=n_affut, pivot=depart)
            f.tube(n_canon, depart=depart, direction_tube=AXE, longueur=LONGUEUR_CANON + 0.02, rayon=RAYON_CANON, teinte='graphite',
                   bouche=True, teinte_bouche='acier_clair', rayon_bouche=RAYON_BOUCHE, longueur_bouche=LONGUEUR_BOUCHE,
                   nom=f'canon_{nom}_{k + 1}')

    # L'œil, au milieu du biseau du pan droit : une orbite d'apprêt, une boule orange.
    milieu, normale = pan_biseau(AZIMUT_OEIL)
    f.noeud('module_radar', parent='module_tourelle', pivot=milieu)
    dedans = [ajoute(q, normale, -0.02) for q in polygone(milieu, normale, (0.0, 1.0, 0.0), R_ORBITE, 6, phase=30.0)]
    dehors = [ajoute(q, normale, ORBITE_SAILLIE) for q in polygone(milieu, normale, (0.0, 1.0, 0.0), R_ORBITE * 0.9, 6, phase=30.0)]
    f.solide('module_radar', [dedans, dehors], 'appret', nom='orbite')
    f.boule('module_radar', ajoute(milieu, normale, OEIL_SAILLIE), R_OEIL, 'orange', nom='oeil')

    # L'antenne fouet, au coin arrière droit du pont.
    f.antenne('module_antenne', base=BASE_ANTENNE, hauteur=HAUTEUR_ANTENNE)


def animer(f):
    # Repos : immobile ; l'antenne seule frémit, de moins de 2°.
    b.balancer(f.clip('repos'), 'module_antenne', 'x', 1.5, periodes=2)

    # Déplacement : les galets roulent, la lourde casemate tangue à peine.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.003, periodes=2)
    b.balancer(d, 'corps', 'x', 0.5, periodes=2, phase=1.2)
    b.balancer(d, 'module_antenne', 'x', 3.0, periodes=2, phase=0.6)

    # Tir : une rafale, les quatre canons reculent tour à tour le long de leur axe.
    t = f.clip('tir')
    images = b.instants_cuisson(t)
    arriere = tuple(-c for c in AXE)
    ordre = ('canon_avant_1', 'canon_arriere_1', 'canon_avant_2', 'canon_arriere_2') * 2
    for k, noeud in zip(range(1, 9), ordre):
        b.recul(t, noeud, arriere, RECUL_TIR, debut=images[k] - 0.03, attaque=0.03, retour=0.1)
    b.a_coup(t, 'corps', 'x', -1.0, attaque=0.06, retour=0.5)

    # Touché : la casemate vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 3.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.008)

    # Hors jeu : la casemate s'affaisse sur son flanc droit, les affûts
    # retombent sur leurs tourillons (les canons s'abaissent), l'antenne se couche.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', 5.0))
    b.affaisser(h, 'affut_avant', rotation=(TOURILLONS, 28.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'affut_arriere', rotation=(TOURILLONS, 28.0), debut=0.18, duree=0.6)
    b.affaisser(h, 'module_antenne', rotation=('x', -35.0), debut=0.2, duree=0.5)
