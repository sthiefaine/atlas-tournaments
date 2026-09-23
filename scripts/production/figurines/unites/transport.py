"""
Le transport : le porteur chenillé de la boîte, celui qui ravitaille et qui
emmène deux fantassins. Aucune arme.

Ce qui le dit à 48 pixels : les chenilles de caoutchouc et les galets du char
léger, sous un porteur plus long et plus étroit que les chars ; une caisse
basse à la couleur du camp, aux flancs qui rentrent ; à l'avant, une cabine
haute, au pare-brise et à la vitre sombres, plus haute que tout le reste ;
derrière elle, une benne aux ridelles d'équipe, pleine de caisses et de fûts
os (les caisses os disent le ravitaillement, partout dans la boîte) ; à
l'arrière, la rampe relevée, qui ferme la benne et tombe quand il est mis hors
jeu. Ni tourelle ni canon : c'est ce qui le sépare du char léger ; ni roues ni
mât : du brouilleur. Classe moyenne, 0,78 à 0,82 case de large en vue
« droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

La lumière de la cuisson vient du joueur, à 60° : un dessus reçoit 1, un flanc
droit 0,65, un front 0,57. L'équipe doit en recevoir 0,8 sur 60 % de ses
pixels ; les flancs de la caisse et des ridelles rentrent donc de 32° (0,83),
le glacis fuit de 48°.
"""

import math

import bibliotheque as b

#: Le milieu de la classe moyenne.
LARGEUR_VISEE = (0.78, 0.82)

# --- Le train : les chenilles et les galets du char léger, allongés -----------
LONGUEUR_TRAIN = 0.65
Z_TRAIN = 0.0
DEMI_VOIE = 0.15
LARGEUR_CHENILLE = 0.12
HAUTEUR_CHENILLE = 0.17
RAYON_GALET = 0.052
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.07
Z_GALETS = tuple(round(Z_TRAIN + d, 4) for d in (-0.226, -0.113, 0.0, 0.113, 0.226))

# --- La caisse -------------------------------------------------------------------
COQUE_BAS = 0.10
PONT = 0.17                  # le dessus de la coque : le plancher de la benne, à hauteur des chenilles
X_PIED = 0.18                # le pied des flancs, sur les chenilles : il en laisse voir le dessus
Y_BORD = 0.26                # le haut des ridelles et du bloc avant
PENTE = math.radians(32)     # les flancs rentrent de 32° : ils prennent la lumière
X_BORD = X_PIED - (Y_BORD - PONT) * math.tan(PENTE)   # 0,124 : le dessus des flancs, dehors
Z_ARRIERE = -0.275           # la caisse s'arrête contre la rampe
Z_NEZ = 0.34                 # le nez, au pied du glacis
Z_GLACIS = 0.23              # le haut du glacis : il fuit de 48°

# --- La benne ----------------------------------------------------------------------
X_DEDANS = 0.085             # le dedans des ridelles, droit
FOND = 0.004                 # la doublure du fond affleure d'autant

# --- La cabine, posée sur l'avant ---------------------------------------------------
Z_CABINE = 0.02              # son dos, qui ferme la benne
Y_TOIT = 0.44
X_TOIT = 0.108
Z_TOIT = 0.17                # le haut du pare-brise : il fuit de 17°
VITRE_Y = (0.3075, 0.4025)   # la vitre de flanc, en hauteur…
VITRE_Z = (0.04, 0.17)       # … et en longueur : des montants de 2 à 3 cm

# --- La rampe : la porte arrière, relevée ; charnière au pied ------------------------
EPAISSEUR_RAMPE = 0.05
Z_RAMPE = Z_ARRIERE - EPAISSEUR_RAMPE / 2   # le milieu de son épaisseur
Y_CHARNIERE = COQUE_BAS + 0.015


def quad(x0, x1, z0, z1):
    """Un rectangle (x, z) dans l'ordre des contours de `extrusion` (celui de `contour_rectangle`)."""
    return [(x0, z1), (x0, z0), (x1, z0), (x1, z1)]


def dalle_sur_pente(f, noeud, bas, haut, t0, t1, largeur, teinte, nom, dedans=-0.042, dehors=0.008):
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


def construire(f):
    # Les nœuds : la fiche donne racine, corps, base, socle, module_grue (la
    # rampe, pivot sur sa charnière) ; le chargement (qui sautille dans la
    # benne) et les essieux des galets (qui tournent) sont des nœuds à eux.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, 0.16, 0))
    f.noeud('module_grue', parent='corps', pivot=(0, Y_CHARNIERE, Z_RAMPE))
    f.noeud('chargement', parent='corps', pivot=(0, PONT, -0.05))
    f.noeud('socle', pivot=(0, 0, 0))

    # Le train : deux bandes de caoutchouc, cinq galets graphite aux moyeux clairs de chaque côté.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE,
                   largeur=LARGEUR_CHENILLE, z_centre=Z_TRAIN)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET,
             epaisseur=EPAISSEUR_GALET, teinte='graphite', teinte_moyeu='os')

    # La coque, entre les chenilles : un fond plat, le nez au pied du glacis ;
    # son dessus est le plancher de la benne.
    profil = [(Z_ARRIERE, COQUE_BAS), (Z_NEZ - 0.04, COQUE_BAS), (Z_NEZ, COQUE_BAS + 0.04), (Z_NEZ, PONT), (Z_ARRIERE, PONT)]
    f.prisme('corps', profil, 2 * X_PIED, 'equipe', nom='coque')

    # Le bloc avant, sous la cabine : flancs à 32°, glacis à 48°.
    f.extrusion('corps', quad(-X_PIED, X_PIED, Z_CABINE, Z_NEZ), quad(-X_BORD, X_BORD, Z_CABINE, Z_GLACIS),
                PONT - 0.005, Y_BORD, 'equipe', chanfrein=0.016, nom='avant')

    # Les ridelles : deux murailles d'équipe, le dedans droit, le dehors qui
    # rentre de 32° vers le haut, de la rampe jusque sous la cabine (elles y
    # filent de 4 cm : aucune couture ne se voit).
    for cote in (1, -1):
        pied = sorted((cote * X_DEDANS, cote * X_PIED))
        bord = sorted((cote * X_DEDANS, cote * X_BORD))
        z_avant = Z_CABINE + 0.04
        f.extrusion('corps', quad(pied[0], pied[1], Z_ARRIERE, z_avant), quad(bord[0], bord[1], Z_ARRIERE, z_avant),
                    PONT - 0.005, Y_BORD, 'equipe', chanfrein=0.015, nom=f'ridelle_{"g" if cote > 0 else "d"}')

    # La cabine : un bloc d'équipe posé sur l'avant, le front qui fuit (le pare-brise).
    f.extrusion('corps', quad(-X_BORD, X_BORD, Z_CABINE, Z_GLACIS), quad(-X_TOIT, X_TOIT, Z_CABINE + 0.01, Z_TOIT),
                Y_BORD - 0.01, Y_TOIT, 'equipe', chanfrein=0.02, nom='cabine')

    # Le pare-brise, et une grande vitre de chaque flanc — c'est elle qui dit
    # « cabine » en vue « droite » : du verre sombre, le reflet au tiers haut.
    # La vitre est une dalle de 5 cm noyée dans le flanc, qui en dépasse de 4 mm.
    dalle_sur_pente(f, 'corps', (Z_GLACIS, Y_BORD - 0.01), (Z_TOIT, Y_TOIT), 0.3, 0.86, 2 * X_TOIT - 0.03, 'verre', 'pare_brise')
    y_vitre = sum(VITRE_Y) / 2
    x_flanc = X_BORD - (X_BORD - X_TOIT) * (y_vitre - Y_BORD) / (Y_TOIT - Y_BORD)
    for cote in (1, -1):
        f.boite('corps', (cote * (x_flanc + 0.004 - 0.025), y_vitre, sum(VITRE_Z) / 2),
                (0.05, VITRE_Y[1] - VITRE_Y[0], VITRE_Z[1] - VITRE_Z[0]), 'verre', nom=f'vitre_{"g" if cote > 0 else "d"}')

    # Le fond de la benne, doublé de graphite : le creux se lit sombre, et le
    # chargement clair s'y détache. Une dalle noyée dans la coque, qui n'en
    # affleure que de 4 mm.
    z_fond = (Z_ARRIERE + Z_CABINE) / 2
    f.boite('corps', (0, PONT + FOND - 0.025, z_fond), (2 * X_DEDANS - 0.004, 0.05, Z_CABINE - Z_ARRIERE - 0.004), 'graphite',
            nom='fond')

    # Le chargement : derrière la cabine, un vide sombre qu'elle cache en vue
    # « droite » ; puis une grosse caisse qui dépasse des ridelles, et deux
    # fûts trapus contre la rampe.
    y0 = PONT + FOND
    f.boite('chargement', (0.0, y0 + 0.055, -0.1), (0.14, 0.11, 0.09), 'os', nom='caisse')
    for cote in (1, -1):
        f.cylindre('chargement', (cote * 0.045, y0 + 0.05, -0.212), 0.038, 0.1, 'os', axe='y', nom=f'fut_{"g" if cote > 0 else "d"}')

    # La rampe : la porte arrière, d'équipe, vue de face — droite sur la coque,
    # puis rentrée comme les ridelles ; elle tourne sur sa charnière.
    hc = PONT - Y_CHARNIERE
    hr = Y_BORD - Y_CHARNIERE
    contour = [(-X_PIED, 0.0), (X_PIED, 0.0), (X_PIED, hc), (X_BORD, hr), (-X_BORD, hr), (-X_PIED, hc)]
    f.prisme('module_grue', contour, EPAISSEUR_RAMPE, 'equipe', rotation=[('y', 90)], origine=(0, Y_CHARNIERE, Z_RAMPE),
             chanfrein=0.016, nom='rampe')
    f.cylindre('module_grue', (0, Y_CHARNIERE, Z_RAMPE - 0.014), 0.028, 2 * X_PIED - 0.1, 'acier_clair', axe='x', nom='charniere')


def animer(f):
    # Repos : immobile. Rien ne bouge.
    b.fixe(f.clip('repos'), 'corps')

    # Déplacement : les galets roulent, la caisse respire sur sa suspension, le
    # chargement sautille dans la benne.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)
    T = d.duree
    d.translation('chargement', lambda t: (0.0, 0.006 * abs(math.sin(2 * math.pi * t / T)), 0.0))

    # Touché : la caisse vacille et se tasse, le chargement saute, la rampe claque.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)
    b.sursaut(k, 'chargement', 'y', 0.018)
    b.secousse(k, 'module_grue', 'x', -5.0, oscillations=2.5)

    # Hors jeu : la caisse s'affaisse de biais, du côté lointain ; la rampe
    # tombe, et le chargement glisse vers elle.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', -5.0))
    b.affaisser(h, 'module_grue', rotation=('x', -45.0), debut=0.15, duree=0.55)
    b.affaisser(h, 'chargement', descente=(0, 0.004, -0.025), rotation=('x', -2.5), debut=0.35, duree=0.45)
