"""
Le lance-missiles sol-air : un gros camion de jouet qui dresse quatre missiles
vers le ciel.

Ce qui le dit à 48 pixels : un camion à six grosses roues, une cabine avancée
et un plateau bas à la couleur du camp, sur un châssis sombre ; et son signe,
la plus grosse pièce après le corps : un berceau d'équipe, posé sur un socle
sombre à l'arrière, d'où sortent quatre missiles clairs, courts, à la pointe
en ogive, dressés à 70° — ce qui tire en l'air pointe vers le ciel, comme
l'anti-air. Sur le toit de la cabine, un petit panneau radar sombre qui
balaie lentement le ciel. Classe grande, 0,88 à 0,92 case de large en vue
« droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Quatre choix, tranchés sur les planches et par la mesure :

- Les missiles sont **en une rangée**, pas en carré. Le berceau a tourné de
  70° vers la gauche (il suit une cible) : en vue « droite », une rangée
  couchée le long du camion se lit comme un peigne, quatre missiles côte à
  côte et leurs pointes alignées ; un carré de quatre y montrait des doigts
  de hauteurs différentes. La rangée est roulée de 22° autour de l'axe des
  missiles : en vue « bas », ils ne s'empilent plus en une seule colonne.
- Le berceau est un **coin** : sa face tournée vers la caméra fuit vers
  l'arrière en montant. Droite, elle ne recevait pas 0,8 de lumière et la
  couleur du camp s'y éteignait ; couchée, elle la prend.
- La part d'os est plafonnée à 12 % : c'est elle qui borne les missiles. Ce
  qu'on en voit (un fût court et une ogive) est ce que le plafond permet ; le
  reste de leur longueur est dans le berceau, et le panneau radar est sombre
  (clair, il coûtait deux à trois points d'os ; de verre, il faisait passer
  le verre au-dessus de 8 %).
- Le berceau est posé sur une **dalle sombre**, à plat, qui le détache du
  plateau d'un trait noir. Un plateau tournant rond, plus large que lui,
  laissait voir deux croissants sombres de part et d'autre : deux yeux, et le
  camion devenait une bête.
"""

import math

import bibliotheque as b

#: La classe grande, comme la fiche la veut pour lui : 0,88 à 0,92.
LARGEUR_VISEE = (0.88, 0.92)

# ---------------------------------------------------------------------------
# Les cotes, en mètres : tout se déduit d'elles.
# ---------------------------------------------------------------------------

# --- Le train : six gros pneus, l'essieu avant sous la cabine, un tandem sous le lanceur.
RAYON_ROUE = 0.09
LARGEUR_PNEU = 0.08
X_ROUE = 0.19
Z_ESSIEUX = (0.235, -0.115, -0.275)
PART_MOYEU = 0.38
MEPLAT = 0.6

# --- Le châssis, sombre, d'un bout à l'autre, et le pare-chocs.
CHASSIS = (0.28, (0.075, 0.21), (-0.38, 0.35))       # largeur, (bas, haut), (arrière, avant)
PARE_CHOCS = (0.36, (0.135, 0.195), (0.34, 0.39))

# --- Le plateau bas, d'équipe, derrière la cabine.
PLATEAU = (0.44, (0.2, 0.26), (-0.39, 0.16))

# --- La cabine avancée, d'équipe ; le pare-brise fuit vers l'arrière, la
# face avant sous lui est une calandre sombre.
CABINE_Z = (0.15, 0.365)
CABINE_LARGEUR = 0.43
CABINE_BAS = 0.2
CABINE_CAPOT = 0.31                  # où le pare-brise commence
CABINE_TOIT = 0.45
PENTE_PARE_BRISE = 0.075             # le haut du pare-brise recule d'autant

# --- Le socle du lanceur : une dalle sombre, à plat sur le plateau, un peu
# plus grande que le pied du berceau.
Z_SOCLE = -0.17
Y_SOCLE = PLATEAU[1][1] - 0.025
HAUTEUR_SOCLE = 0.05
MARGE_SOCLE = 0.012

# --- Le berceau et ses missiles : dressés à 70°, tournés de 70° vers la
# gauche (le lanceur suit une cible), en une rangée roulée de 22° autour de
# leur axe.
ELEVATION = 70.0
LACET = 70.0
ROULIS = 22.0
_E, _L, _R = math.radians(ELEVATION), math.radians(LACET), math.radians(ROULIS)
AXE = (math.sin(_L) * math.cos(_E), math.sin(_E), math.cos(_L) * math.cos(_E))
DESSUS = (-math.sin(_L) * math.sin(_E), math.cos(_E), -math.cos(_L) * math.sin(_E))
TRAVERS = (math.cos(_L), 0.0, -math.sin(_L))
#: La rangée des missiles, et la face du berceau tournée vers la caméra.
RANGEE = tuple(math.cos(_R) * t + math.sin(_R) * d for t, d in zip(TRAVERS, DESSUS))
FACE = tuple(-math.sin(_R) * t + math.cos(_R) * d for t, d in zip(TRAVERS, DESSUS))
TOURILLON = (0.0, Y_SOCLE + HAUTEUR_SOCLE + 0.01, Z_SOCLE)
PAS_MISSILES = 0.1                   # d'un missile au suivant, le long de la rangée
RAYON_MISSILE = 0.028
LONGUEUR_MISSILE = 0.37
NEZ = 0.07                           # la longueur de l'ogive
DEPART_MISSILE = -0.02               # le pied d'un missile, le long de l'axe depuis le tourillon
#: Le berceau, un coin posé à plat sur son socle : sa demi-longueur le long
#: de la rangée, sa face vers la caméra au pied et en haut (elle fuit vers
#: l'arrière en montant : elle prend la lumière), son dos, et son sommet le
#: long de l'axe, depuis le tourillon.
BERCEAU_RANGEE = 0.2
BERCEAU_FACE = (0.1, 0.045)
BERCEAU_DOS = 0.06
BERCEAU_SOMMET = 0.1

# --- Le panneau radar, sur le toit de la cabine.
Z_RADAR = 0.25
PIED_RADAR = CABINE_TOIT - 0.01
RAYON_MAT_RADAR = 0.028
Y_PANNEAU = 0.5
PANNEAU = (0.19, 0.095, 0.05)        # largeur, hauteur, épaisseur
RECUL_PANNEAU = 28.0                 # le panneau regarde un peu le ciel
#: Et, au repos, vers l'avant droit : de trois quarts dans la vue « droite », où il se lit comme un panneau.
CAP_PANNEAU = 35.0
#: Au repos, le panneau balaie de part et d'autre, une fois par boucle : il pivote lentement.
BALAYAGE_RADAR = 40.0

# --- Le tir : le missile de tête sort de son berceau, puis un autre y remonte.
SORTIE_MISSILE = 0.1


def le_long(p, d, t):
    """Le point `p` avancé de `t` mètres dans la direction `d`."""
    return tuple(a + t * c for a, c in zip(p, d))


def roue(f, noeud, centre, rayon, largeur, nom):
    """
    Une grosse roue : le pneu arrondi et un moyeu clair coupé d'un méplat — un
    « D » qui tourne avec l'essieu : un moyeu rond et centré ne montre pas que
    la roue roule. Il dépasse des deux flancs.
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


def profil_missile():
    """
    Le profil d'un missile, (rayon, position le long de l'axe) du pied à la
    pointe : un fût, puis une ogive tangente — un arc de cercle qui part du fût
    sans cassure et finit en pointe : une ogive en demi-ellipse se lit comme un
    doigt.
    """
    r, l, n = RAYON_MISSILE, LONGUEUR_MISSILE, NEZ
    rho = (r * r + n * n) / (2 * r)          # le rayon de l'arc de l'ogive
    profil = [(r, 0.0), (r, l - n)]
    for k in range(1, 13):
        x = n * (1 - k / 12)                 # la distance à la pointe
        profil.append((max(0.004, math.sqrt(max(0.0, rho * rho - (n - x) ** 2)) + r - rho), l - x))
    return profil


def vitre_sur_pente(f, noeud, pied, sommet, largeur, nom):
    """
    Une vitre qui épouse une pente vue de côté, de `pied` à `sommet` (points
    (z, y) de la face) : une plaque qui dépasse à peine et s'enfonce dans la
    caisse. Son reflet peint tombe sur son tiers haut.
    """
    dz, dy = sommet[0] - pied[0], sommet[1] - pied[1]
    ln = math.hypot(dz, dy)
    nz, ny = dy / ln, -dz / ln              # la normale de la pente, vers l'avant et le haut
    if nz < 0:
        nz, ny = -nz, -ny
    dehors, dedans = 0.006, 0.03
    a = (pied[0] + dz * 0.12, pied[1] + dy * 0.12)
    c = (pied[0] + dz * 0.88, pied[1] + dy * 0.88)
    profil = [
        (a[0] + nz * dehors, a[1] + ny * dehors),
        (c[0] + nz * dehors, c[1] + ny * dehors),
        (c[0] - nz * dedans, c[1] - ny * dedans),
        (a[0] - nz * dedans, a[1] - ny * dedans),
    ]
    return f.prisme(noeud, profil, largeur, 'verre', chanfrein=0.012, nom=nom)


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds. Le train (`base`) porte le châssis et les trois essieux, qui
    # tournent ; la caisse (`corps`) respire sur sa suspension ; le lanceur
    # (`module_lance_roquettes`) est le socle et ce qu'il porte : le berceau,
    # qui bascule sur ses tourillons, et un nœud par missile (il part au tir) ;
    # le panneau radar (`module_radar`) pivote sur le toit de la cabine.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, PLATEAU[1][0], 0))
    f.noeud('socle', pivot=(0, 0, 0))
    for i, z in enumerate(Z_ESSIEUX):
        f.noeud(f'essieu_{i + 1}', parent='base', pivot=(0, RAYON_ROUE, z))
    f.noeud('module_lance_roquettes', parent='corps', pivot=(0, Y_SOCLE, Z_SOCLE))
    f.noeud('berceau', parent='module_lance_roquettes', pivot=TOURILLON)
    pieds = []
    for i in range(4):
        # Du missile de tête (vers la cabine, à droite de l'image) au dernier.
        p = le_long(le_long(TOURILLON, RANGEE, (i - 1.5) * PAS_MISSILES), AXE, DEPART_MISSILE)
        pieds.append(p)
        f.noeud(f'missile_{i + 1}', parent='berceau', pivot=p)
    f.noeud('module_radar', parent='corps', pivot=(0, PIED_RADAR, Z_RADAR), tournant=True)

    # Le train : six gros pneus de caoutchouc aux moyeux clairs en « D ».
    for i, z in enumerate(Z_ESSIEUX):
        for cote in (1, -1):
            roue(f, f'essieu_{i + 1}', (cote * X_ROUE, RAYON_ROUE, z), RAYON_ROUE, LARGEUR_PNEU, nom=f'roue_{i + 1}_{"g" if cote > 0 else "d"}')

    # Le châssis sombre, d'un bout à l'autre, et le pare-chocs.
    for (largeur, (y0, y1), (z0, z1)), nom in ((CHASSIS, 'chassis'), (PARE_CHOCS, 'pare_chocs')):
        f.boite('base', (0, (y0 + y1) / 2, (z0 + z1) / 2), (largeur, y1 - y0, z1 - z0), 'graphite', chanfrein=0.02, nom=nom)

    # Le plateau bas, d'équipe.
    largeur, (y0, y1), (z0, z1) = PLATEAU
    f.boite('corps', (0, (y0 + y1) / 2, (z0 + z1) / 2), (largeur, y1 - y0, z1 - z0), 'equipe', chanfrein=0.025, nom='plateau')

    # La cabine avancée : un bloc d'équipe au pare-brise incliné, et sa vitre.
    za, zv = CABINE_Z
    zp = zv - PENTE_PARE_BRISE
    cabine = [(za, CABINE_BAS), (zv, CABINE_BAS), (zv, CABINE_CAPOT), (zp, CABINE_TOIT), (za, CABINE_TOIT)]
    cab = f.prisme('corps', cabine, CABINE_LARGEUR, 'equipe', chanfrein=0.04, nom='cabine')
    vitre_sur_pente(f, 'corps', (zv, CABINE_CAPOT), (zp, CABINE_TOIT), CABINE_LARGEUR - 0.07, nom='pare_brise')
    # La calandre sombre, sous le pare-brise : une face verticale tournée vers
    # le joueur ne reçoit pas assez de lumière pour porter la couleur du camp.
    calandre = f.boite('corps', (0, (CABINE_BAS + CABINE_CAPOT) / 2 + 0.005, zv - 0.015),
                       (CABINE_LARGEUR - 0.05, CABINE_CAPOT - CABINE_BAS - 0.01, 0.05), 'graphite', chanfrein=0.018, nom='calandre')
    calandre.avec = cab.nom
    for cote in (1, -1):
        phare = f.cylindre('corps', (cote * 0.135, 0.245, zv + 0.001), 0.022, 0.05, 'feux', axe='z', nom=f'phare_{"g" if cote > 0 else "d"}')
        phare.avec = cab.nom

    # Le berceau, un coin d'équipe : son sommet est perpendiculaire aux
    # missiles, son pied à plat sur le socle — chaque coin du sommet descend
    # le long de l'axe jusqu'au dessus du socle.
    y_pied = Y_SOCLE + HAUTEUR_SOCLE - 0.01
    coins = ((-BERCEAU_RANGEE, -BERCEAU_DOS), (BERCEAU_RANGEE, -BERCEAU_DOS), (BERCEAU_RANGEE, 1), (-BERCEAU_RANGEE, 1))
    sommet, pied = [], []
    for r, e in coins:
        e_haut = BERCEAU_FACE[1] if e == 1 else e
        e_bas = BERCEAU_FACE[0] if e == 1 else e
        sommet.append(le_long(le_long(le_long(TOURILLON, AXE, BERCEAU_SOMMET), RANGEE, r), FACE, e_haut))
        q = le_long(le_long(TOURILLON, RANGEE, r), FACE, e_bas)
        pied.append(le_long(q, AXE, (y_pied - q[1]) / AXE[1]))
    berceau = f.solide('berceau', [pied, sommet], 'equipe', chanfrein=0.022, nom='berceau')

    # Le socle, sous le pied du berceau, un peu plus grand que lui.
    xs, zs = [p[0] for p in pied], [p[2] for p in pied]
    x0, x1, z0, z1 = min(xs) - MARGE_SOCLE, max(xs) + MARGE_SOCLE, min(zs) - MARGE_SOCLE, max(zs) + MARGE_SOCLE
    f.boite('module_lance_roquettes', ((x0 + x1) / 2, Y_SOCLE + HAUTEUR_SOCLE / 2, (z0 + z1) / 2),
            (x1 - x0, HAUTEUR_SOCLE, z1 - z0), 'graphite', chanfrein=0.02, nom='socle_lanceur')

    # Les quatre missiles clairs, et la bague sombre d'où chacun sort du
    # berceau : elle l'en détache. La bague reste au berceau quand le missile part.
    for i, p in enumerate(pieds):
        f.revolution(f'missile_{i + 1}', p, profil_missile(), 'os', axe=AXE, nom=f'missile_{i + 1}')
        bague = f.cylindre('berceau', le_long(p, AXE, BERCEAU_SOMMET - DEPART_MISSILE + 0.006), RAYON_MISSILE + 0.008, 0.036,
                           'graphite', axe=AXE, nom=f'bague_{i + 1}')
        bague.avec = berceau.nom

    # Le panneau radar : un mât court et un panneau sombre, de trois quarts au repos dans la vue « droite ».
    f.cylindre('module_radar', (0, (PIED_RADAR + Y_PANNEAU) / 2, Z_RADAR), RAYON_MAT_RADAR, Y_PANNEAU - PIED_RADAR, 'graphite', axe='y', nom='mat_radar')
    f.boite('module_radar', (0, Y_PANNEAU + 0.02, Z_RADAR), PANNEAU, 'graphite', rotation=[('x', -RECUL_PANNEAU), ('y', -CAP_PANNEAU)], chanfrein=0.018, nom='panneau')


def animer(f):
    # Repos : rien ne bouge que le panneau radar, qui balaie lentement le ciel.
    b.balancer(f.clip('repos'), 'module_radar', 'y', BALAYAGE_RADAR, periodes=1)

    # Déplacement : les roues roulent (le « D » des moyeux le montre, 60° par
    # image cuite), la caisse respire sur sa suspension.
    d = f.clip('deplacement')
    for i in range(len(Z_ESSIEUX)):
        b.tourner(d, f'essieu_{i + 1}', 'x', tours=2)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)

    # Tir : le missile de tête sort de son berceau le long de son axe (l'image
    # du coup), puis disparaît ; le berceau encaisse le départ ; à la fin, un
    # autre missile remonte du berceau à sa place.
    t = f.clip('tir')
    images = b.instants_cuisson(t)
    t1, t2 = images[1], images[2]
    tenue = 0.025                            # la pose du coup est tenue le temps de l'obturateur

    def sortie(temps):
        if temps < t1 - tenue - 0.04 or temps >= t2 - 0.02:
            return (0.0, 0.0, 0.0)
        k = b.lisse((temps - (t1 - tenue - 0.04)) / 0.04)
        return tuple(SORTIE_MISSILE * k * c for c in AXE)

    def echelle(temps):
        if temps < t2 - 0.03:
            return (1.0, 1.0, 1.0)
        if temps < images[-3]:
            return (0.001, 0.001, 0.001)
        s = max(0.001, b.lisse((temps - images[-3]) / (images[-1] - images[-3])))
        return (s, s, s)

    t.translation('missile_1', sortie)
    t.echelle('missile_1', echelle)
    b.a_coup(t, 'berceau', TRAVERS, -4.0, debut=t1 - tenue - 0.02, attaque=0.05, retour=0.35)
    b.a_coup(t, 'corps', 'z', 1.5, debut=t1 - tenue - 0.02, attaque=0.06, retour=0.4)

    # Touché : la caisse vacille et se tasse, le berceau tremble, puis tout revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)
    b.secousse(k, 'berceau', TRAVERS, 5.0, oscillations=2.5)

    # Hors jeu : la caisse s'affaisse de biais, le berceau se couche vers sa
    # cible, le radar s'arrête et pique du nez.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', -5.0))
    b.affaisser(h, 'berceau', rotation=(TRAVERS, 30.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'module_radar', rotation=('x', -20.0), debut=0.25, duree=0.5)
