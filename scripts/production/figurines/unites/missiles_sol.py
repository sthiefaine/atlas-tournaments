"""
Le lance-missiles sol-sol : la pièce de terre la plus chère, et la plus
spectaculaire.

Ce qui le dit à 48 pixels : un long châssis chenillé, bas et étroit, entier à
la couleur du camp, une cabine basse vitrée à l'avant ; et son signe, un seul
gros missile os, ceint d'une bague à la couleur du camp derrière son ogive,
couché à 30° vers l'avant sur sa rampe d'érection — une poutre sombre
articulée à l'arrière du pont, soutenue par un vérin —, porté haut au-dessus
du pont et de la cabine. Ni roues ni caisson de tubes (le lance-roquettes), ni
missiles dressés (le sol-air). Classe grande, haut de la fourchette : 0,92 à
0,94 case de large en vue « droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Ce qui place le missile, et que la mesure a tranché :

- En vue « droite » (lacet 60°, tangage 50°), un axe levé de 30° vers l'avant
  se projette **à l'horizontale** : la montée du missile y compense exactement
  la fuite de l'avant vers le joueur. Couché sur le pont, la queue au milieu,
  il s'y lisait comme un rouleau posé sur une table bleue.
- En vue « haut » (de dos), le même missile se dresse presque à la verticale,
  et sa pointe ne doit pas passer 0,70 case au-dessus du pivot :
  0,643 y + 0,720 z ≤ 0,664 (contour et un pixel de marge compris). C'est ce
  qui interdit à la pointe d'avancer loin devant la cabine : chaque
  centimètre gagné devant se paie de 1,1 cm de hauteur.
- D'où la rampe articulée **à l'arrière**, comme celle d'un engin à roquette
  sur châssis chenillé : le missile y est porté haut ; en vue « droite », il
  sort de la silhouette par le haut, contre l'herbe ; en vue « haut », il se
  dresse de toute sa longueur. Sa pointe s'arrête au droit de la cabine : il
  ne dépasse devant que vu de profil (l'écran de combat), où il la domine.
- Le plafond d'os (12 % de la vue « droite ») borne le fût : la jupe arrière
  et ses ailettes sont sombres, la bague est à la couleur du camp. Une ogive
  entière à la couleur du camp se lisait comme la pointe d'un crayon.
- Le châssis est étroit (0,46 m hors chenilles) et long (0,77 m) : la largeur
  de la vue « droite » vient surtout de la longueur, et l'ombre chinoise à
  48 px s'écarte ainsi de celle des chars et des gros engins (au plus 0,78 de
  recouvrement ; 0,83 avec un châssis de 0,51 m sur 0,725).
"""

import math

import bibliotheque as b

#: Le haut de la classe grande : le plus spectaculaire des engins de terre.
LARGEUR_VISEE = (0.92, 0.94)

# --- Le train : de longues chenilles, six galets de chaque côté -----------------
LONGUEUR_TRAIN = 0.77
DEMI_VOIE = 0.175
LARGEUR_CHENILLE = 0.11
HAUTEUR_CHENILLE = 0.16
RAYON_GALET = 0.047
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.066
Z_GALETS = (-0.315, -0.189, -0.063, 0.063, 0.189, 0.315)
X_GALETS = DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012

# --- La caisse : un long pont bas aux flancs qui rentrent ------------------------
COQUE_BAS = 0.08
COQUE_HAUT = 0.17
PONT_BAS = 0.155
PONT = 0.225                    # le dessus du pont
X_PIED = 0.22                   # le pied des flancs, sur les chenilles
X_BORD = 0.18                   # le bord du pont : les flancs rentrent de 30°, ils prennent la lumière
Z_ARRIERE = -0.387
Z_AVANT = 0.377
Z_PONT_ARRIERE = -0.37
Z_PONT_AVANT = 0.32             # le haut du glacis

# --- La cabine basse, à l'avant --------------------------------------------------
CABINE_Z = (0.16, 0.31)         # au pied
CABINE_Z_HAUT = (0.17, 0.255)   # au toit : le pare-brise fuit vers l'arrière
CABINE_X = 0.16
CABINE_X_HAUT = 0.125
TOIT = 0.33
VITRE_Y = (0.262, 0.312)        # les vitres de flanc, en hauteur…
VITRE_Z = (0.185, 0.265)        # … et en longueur

# --- Le socle de la charnière, à l'arrière du pont -------------------------------
SOCLE_Z = (-0.367, -0.237)
SOCLE_HAUT = 0.275

# --- La rampe et le missile, couchés à 30° vers l'avant --------------------------
ELEVATION = 30.0                # tir indirect : relevé de 30 à 45°
AXE = (0.0, math.sin(math.radians(ELEVATION)), math.cos(math.radians(ELEVATION)))
DESSUS_AXE = (0.0, math.cos(math.radians(ELEVATION)), -math.sin(math.radians(ELEVATION)))
CHARNIERE = (0.0, 0.29, -0.302)
RAMPE_SECTION = (0.08, 0.05)
DECALAGE_MISSILE = 0.083        # l'axe du missile au-dessus de celui de la rampe
RAYON_MISSILE = 0.065
#: La pointe, le long de la rampe depuis la charnière : la plus loin que la vue « haut » permette.
S_NEZ = (0.664 - (0.643 * CHARNIERE[1] + 0.720 * CHARNIERE[2]) - 0.197 * DECALAGE_MISSILE) / 0.945
LONGUEUR_MISSILE = 0.58
S_QUEUE = S_NEZ - LONGUEUR_MISSILE
OGIVE = 0.17                    # la longueur du nez qui s'effile
BAGUE = 0.07                    # la bague à la couleur du camp, derrière l'ogive
JUPE = 0.12                     # la jupe arrière, sombre, qui porte les ailettes
RAMPE = (-0.01, S_NEZ - OGIVE)  # sous le missile, de la charnière à l'ogive
S_VERIN = 0.32                  # où le vérin prend la rampe


def point_rampe(s, h=0.0):
    """Un point du plan de symétrie : `s` le long de la rampe depuis la charnière, `h` au-dessus de son axe."""
    return tuple(c + s * a + h * d for c, a, d in zip(CHARNIERE, AXE, DESSUS_AXE))


#: La queue du missile, sur son axe.
QUEUE = point_rampe(S_QUEUE, DECALAGE_MISSILE)


def quad(x0, x1, z0, z1):
    """Un rectangle (x, z) dans l'ordre des contours de `extrusion`."""
    return [(x0, z1), (x0, z0), (x1, z0), (x1, z1)]


def rayon_missile(t):
    """
    Le rayon du missile à `t` mètres de sa queue : une jupe qui s'évase, le
    fût, puis une ogive tangente — l'arc d'un cercle tangent au fût, qui finit
    en pointe arrondie.
    """
    L, R = LONGUEUR_MISSILE, RAYON_MISSILE
    if t < 0.03:
        return R * (0.78 + (0.97 - 0.78) * t / 0.03)
    if t < JUPE:
        return R * (0.97 + 0.03 * (t - 0.03) / (JUPE - 0.03))
    base = L - OGIVE
    if t <= base:
        return R
    rho = (R * R + OGIVE * OGIVE) / (2 * R)
    x = t - base
    return max(0.006, math.sqrt(max(0.0, rho * rho - x * x)) + R - rho)


def profil_missile(debut, fin):
    """Le profil (rayon, position) d'un tronçon du missile, de `debut` à `fin` mètres de sa queue."""
    pas = [debut + (fin - debut) * k / 12 for k in range(13)]
    cassures = [0.03, JUPE, LONGUEUR_MISSILE - OGIVE]
    positions = sorted(set([round(t, 6) for t in pas] + [c for c in cassures if debut < c < fin]))
    return [(rayon_missile(t), t) for t in positions]


def troncons_missile():
    """Les tronçons du missile, de la queue à la pointe : (début, fin, teinte, nom)."""
    s_ogive = LONGUEUR_MISSILE - OGIVE
    return [(0.0, JUPE, 'graphite', 'jupe'), (JUPE - 0.004, s_ogive - BAGUE, 'os', 'fut'),
            (s_ogive - BAGUE, s_ogive, 'equipe', 'bague'), (s_ogive, LONGUEUR_MISSILE, 'os', 'ogive')]


def construire(f):
    # Les nœuds : la fiche donne racine, corps, base, socle, module_lance_roquettes
    # (la rampe et son missile, pivot sur la charnière) et module_antenne ; le
    # missile (qui part au tir) et les essieux (qui tournent) sont des nœuds à eux.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.16, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('module_lance_roquettes', parent='corps', pivot=CHARNIERE)
    f.noeud('missile', parent='module_lance_roquettes', pivot=point_rampe(S_QUEUE + LONGUEUR_MISSILE / 2, DECALAGE_MISSILE))
    base_antenne = (-0.14, PONT - 0.01, -0.337)
    f.noeud('module_antenne', parent='corps', pivot=base_antenne)

    # Le train : deux longues bandes de caoutchouc, six galets aux moyeux clairs.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE, largeur=LARGEUR_CHENILLE)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=X_GALETS, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET, epaisseur=EPAISSEUR_GALET,
             teinte='graphite', teinte_moyeu='os', meplat=True)

    # La coque sombre entre les chenilles, et le pont d'équipe par-dessus.
    profil = [(Z_ARRIERE + 0.03, COQUE_BAS), (Z_AVANT - 0.05, COQUE_BAS), (Z_AVANT - 0.01, COQUE_HAUT), (Z_ARRIERE + 0.01, COQUE_HAUT)]
    f.prisme('corps', profil, 2 * DEMI_VOIE - LARGEUR_CHENILLE + 0.01, 'graphite', nom='coque')
    f.extrusion('corps', quad(-X_PIED, X_PIED, Z_ARRIERE, Z_AVANT), quad(-X_BORD, X_BORD, Z_PONT_ARRIERE, Z_PONT_AVANT),
                PONT_BAS, PONT, 'equipe', chanfrein=0.02, nom='pont')

    # La cabine basse : un bloc d'équipe au pare-brise fuyant.
    f.extrusion('corps', quad(-CABINE_X, CABINE_X, CABINE_Z[0], CABINE_Z[1]),
                quad(-CABINE_X_HAUT, CABINE_X_HAUT, CABINE_Z_HAUT[0], CABINE_Z_HAUT[1]),
                PONT - 0.01, TOIT, 'equipe', chanfrein=0.02, nom='cabine')
    # Le pare-brise : une dalle de verre dans la face avant, qui en dépasse de 8 mm.
    bas = (CABINE_Z[1], PONT - 0.01)
    haut = (CABINE_Z_HAUT[1], TOIT)
    u = (haut[0] - bas[0], haut[1] - bas[1])
    lu = math.hypot(*u)
    u = (u[0] / lu, u[1] / lu)
    n = (u[1], -u[0])               # la normale de la face, vers l'avant et le haut
    coins = [(0.3 * lu, -0.042), (0.86 * lu, -0.042), (0.86 * lu, 0.008), (0.3 * lu, 0.008)]
    f.prisme('corps', [(bas[0] + t * u[0] + e * n[0], bas[1] + t * u[1] + e * n[1]) for t, e in coins],
             2 * CABINE_X_HAUT - 0.03, 'verre', nom='pare_brise')
    # Une vitre de chaque flanc : c'est elle qui dit « cabine » en vue « droite ».
    y_vitre = sum(VITRE_Y) / 2
    x_flanc = CABINE_X - (CABINE_X - CABINE_X_HAUT) * (y_vitre - PONT + 0.01) / (TOIT - PONT + 0.01)
    for cote in (1, -1):
        f.boite('corps', (cote * (x_flanc + 0.004 - 0.025), y_vitre, sum(VITRE_Z) / 2),
                (0.05, VITRE_Y[1] - VITRE_Y[0], VITRE_Z[1] - VITRE_Z[0]), 'verre', nom=f'vitre_{"g" if cote > 0 else "d"}')

    # Le socle de la charnière, à l'arrière : un bloc d'équipe aux flancs qui
    # rentrent, et la chape sombre où tourne l'axe clair de la rampe.
    f.extrusion('corps', quad(-0.16, 0.16, SOCLE_Z[0], SOCLE_Z[1]), quad(-0.125, 0.125, SOCLE_Z[0] + 0.012, SOCLE_Z[1] - 0.025),
                PONT - 0.01, SOCLE_HAUT, 'equipe', chanfrein=0.018, nom='socle_charniere')
    f.boite('corps', (0, SOCLE_HAUT, CHARNIERE[2]), (0.15, 0.05, 0.09), 'graphite', nom='chape')
    f.cylindre('module_lance_roquettes', CHARNIERE, 0.026, 0.19, 'acier_clair', axe='x', nom='axe_charniere')

    # La rampe : une poutre sombre, de la charnière jusque sous l'ogive.
    debut, fin = RAMPE
    f.boite('module_lance_roquettes', point_rampe((debut + fin) / 2), (RAMPE_SECTION[0], RAMPE_SECTION[1], fin - debut), 'graphite',
            rotation=[('x', -ELEVATION)], nom='rampe')

    # Le vérin : un fût sombre debout sur le pont, sa tige claire sous la rampe.
    # La tige suit la rampe : quand elle retombe, elle rentre dans le fût.
    tete = point_rampe(S_VERIN, -RAMPE_SECTION[1] / 2)
    y_fut = tete[1] - 0.08
    f.cylindre('corps', (0, (PONT - 0.01 + y_fut) / 2, tete[2]), 0.04, y_fut - PONT + 0.01, 'graphite', axe='y', nom='verin')
    f.cylindre('module_lance_roquettes', (0, tete[1] - 0.06, tete[2]), 0.026, 0.12, 'acier_clair', axe='y', nom='tige')

    # Le missile : la jupe sombre, le fût os, la bague à la couleur du camp,
    # l'ogive os ; quatre ailettes sombres en croix sur la jupe.
    for debut, fin, teinte, nom in troncons_missile():
        f.revolution('missile', QUEUE, profil_missile(debut, fin), teinte, axe=AXE, nom=nom)
    R = RAYON_MISSILE
    for k, phi in enumerate((0, 90, 180, 270)):
        profil_ailette = [(0.0, R - 0.015), (0.12, R - 0.015), (0.05, R + 0.055), (0.0, R + 0.055)]
        f.prisme('missile', profil_ailette, 0.05, 'graphite', rotation=[('z', phi), ('x', -ELEVATION)], origine=QUEUE,
                 nom=f'ailette_{k + 1}')

    # L'antenne fouet sur son ressort, au coin arrière droit du pont.
    f.cylindre('module_antenne', (base_antenne[0], base_antenne[1] + 0.025, base_antenne[2]), 0.028, 0.05, 'graphite', axe='y', nom='ressort')
    f.antenne('module_antenne', base=(base_antenne[0], base_antenne[1] + 0.045, base_antenne[2]), hauteur=0.13)


def animer(f):
    # Repos : immobile.
    b.fixe(f.clip('repos'), 'corps')

    # Déplacement : les galets roulent, la caisse respire sur sa suspension.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.003, periodes=2)
    b.balancer(d, 'corps', 'x', 0.5, periodes=2, phase=1.2)

    # Tir : le missile bondit le long de sa rampe, puis s'efface ; la rampe
    # encaisse le départ. Seule la vue « droite » cuit le tir : la pointe y
    # file vers la droite, loin du bord de la case.
    t = f.clip('tir')
    t.translation('missile', lambda s: tuple(0.16 * b.lisse(s / 0.12) * a for a in AXE))
    t.echelle('missile', lambda s: (max(0.001, 1 - b.lisse((s - 0.09) / 0.05)),) * 3)
    b.a_coup(t, 'module_lance_roquettes', 'x', 3.0, debut=0.04, attaque=0.06, retour=0.45)
    b.a_coup(t, 'corps', 'x', -1.0, debut=0.04, attaque=0.07, retour=0.45)

    # Touché : la caisse vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 3.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.008)

    # Hors jeu : la caisse s'affaisse de biais, la rampe retombe sur la cabine
    # (la tige du vérin rentre dans son fût), l'antenne tombe vers l'avant —
    # vers l'arrière, elle sortirait de la case.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.012, 0), rotation=('z', -4.0))
    b.affaisser(h, 'module_lance_roquettes', rotation=('x', 14.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'module_antenne', rotation=('x', 35.0), debut=0.2, duree=0.5)
