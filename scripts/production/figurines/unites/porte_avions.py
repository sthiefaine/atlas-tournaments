"""
Le porte-avions : le plus grand rectangle plat de la carte, et le navire le
plus cher.

Ce qui le dit à 48 pixels : un grand pont d'envol à la couleur du camp, long,
plat, à l'avant resserré en trapèze ; une piste de tirets clairs qui le
parcourt d'un bout à l'autre ; un petit avion sombre garé dessus ; sur le
bord, un îlot à la couleur du camp, ceint de vitres, qui porte une petite
parabole radar claire et une antenne. Dessous, la coque graphite, un mur droit
sur sa bande de flottaison claire : l'équipe ne touche jamais l'eau. Ni
tourelle ni canon (le cuirassé), ni rampe relevée ni radier creux (la barge).
Classe grande, haut de la classe : 0,91 à 0,94 case de large en vue « droite »,
contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Ce que la mesure a tranché :

- **La coque est un mur droit, et haut.** Un pont d'équipe sur une coque
  basse donnait 77 % d'équipe et 10 % de sombre. Évasée vers le haut, la
  coque se cachait sous le pont : un flanc qui s'évase regarde vers le bas, la
  caméra le voit à peine. Droite, elle se voit aux trois cinquièmes de sa
  hauteur, et c'est elle qui porte la masse sombre, en bas. Seule l'étrave
  s'évase, de la pointe de flottaison au trapèze du pont.
- **La dalle d'équipe est posée en retrait d'un liseré sombre** et ne dépasse
  de la coque que de 1,5 cm : une dalle épaisse à flancs d'équipe montait à
  62 % ; un liseré d'un centimètre descendait à 50 % et cernait le pont d'un
  cadre noir. Quatre millimètres : 58 %. Son pied, noyé dans la coque, suit la
  section de la coque (`section_coque`) : droit, il ressortait à l'avant, où
  la coque s'évase, en une pointe bleue sous le pont.
- **L'îlot est sur le bord gauche**, celui du fond dans les trois vues de
  carte : il se dresse derrière le pont au lieu d'en cacher la moitié. La
  parabole tourne le dos à la caméra au repos : de face, un bol clair au
  cornet sombre se lisait comme un œil, le signe de la boule-caméra.
- **La coque tangue, roule et gîte autour du pont**, pas de la flottaison :
  autour de la flottaison, les coins du pont s'écartaient et la silhouette
  débordait de sa case (0,469 case au hors-jeu). Autour du pont, elle tient
  119 pixels de large à 128 par case (0,93 case), 60 du côté de la poupe, dans
  toutes les images de carte ; la 61ᵉ colonne reste presque vide.
"""

import math

import bibliotheque as b

#: Le haut de la classe grande : le plus grand navire, au moins aussi grand que le cuirassé.
LARGEUR_VISEE = (0.91, 0.94)

# ---------------------------------------------------------------------------
# Les cotes, en mètres : tout se déduit d'elles.
# ---------------------------------------------------------------------------

# --- La coque : un grand mur graphite, droit, de la flottaison au pont ;
# l'étrave en pointe à la flottaison, en trapèze sous le pont.
FLOTTAISON = 0.036                      # la bande os, de 0 à 3,6 cm
Y_COQUE = 0.185                         # le haut de la coque, sous le pont
COQUE_Z = (-0.428, 0.4325)              # à la flottaison : arrière, étrave
COQUE_LARGEUR = 0.27
PROUE = 0.22                            # la part avant de la longueur qui s'effile en pointe
ARRONDI_POUPE = 0.035

# --- Le pont d'envol : le plan du haut de la coque, l'avant resserré en
# trapèze ; une dalle d'équipe y est posée, en retrait d'un liseré sombre.
PONT_Z = (-0.448, 0.4725)
PONT_LARGEUR = 0.275
PONT_ETRAVE = 0.17                      # la part avant qui se resserre
PONT_AVANT = 0.5                        # le bord avant, en part de la largeur
ARRONDI_PONT = 0.03
RETRAIT_PONT = 0.004                    # le liseré graphite autour de la dalle
PONT = (Y_COQUE - 0.035, Y_COQUE + 0.015)  # bas (noyé dans la coque, dont il suit la section), dessus

# --- La piste : des tirets os sur l'axe, qui dépassent à peine du pont.
TIRET = (0.048, 0.036, 0.095)           # x, y (surtout noyé dans le pont), z
SAILLIE_TIRET = 0.005
Z_TIRETS = (-0.34, -0.18, -0.02, 0.14, 0.3)
X_PISTE = -0.035

# --- L'îlot, sur le bord gauche (le bord du fond en vue « droite ») : il se
# dresse derrière le pont au lieu de le cacher.
ILOT_X = 0.083
ILOT_Z = -0.1
ILOT = (0.1, 0.23)                      # x, z
Y_VITRES = (PONT[1] + 0.15, PONT[1] + 0.185)
Y_TOIT = Y_VITRES[1] + 0.03

# --- La parabole et l'antenne, sur le toit de l'îlot.
Z_RADAR = ILOT_Z + 0.05
Y_PIED_RADAR = Y_TOIT - 0.01
PIED_RADAR = (0.026, 0.05)              # rayon, hauteur
RAYON_PARABOLE = 0.062
PROFONDEUR_PARABOLE = 0.034
EPAISSEUR_PARABOLE = 0.02
INCLINAISON_PARABOLE = 20.0             # au-dessus de l'horizon
CAP_PARABOLE = 120.0                    # depuis l'avant, vers la gauche : elle tourne le dos à la caméra, jamais un œil
Z_ANTENNE = ILOT_Z - 0.065
HAUTEUR_ANTENNE = 0.13

# --- Un petit avion garé devant l'îlot, sombre sur le pont : ce qui dit
# « porte-avions » d'un coup d'œil.
AVION_CENTRE = (0.065, 0.19)            # x, z
AVION_LONGUEUR = 0.19
AVION_FUSELAGE = 0.026                  # rayon
AVION_ENVERGURE = 0.14
EPAISSEUR_AILE = 0.034

#: Toutes les rotations de la coque — tangage, roulis, gîte — tournent autour
#: de ce point, sur le pont : les coins du pont, qui bornent la silhouette à
#: 0,47 case du pivot, ne s'écartent jamais.
CENTRE_PONT = (0.0, PONT[1], 0.0)


def contour_navire(za, zb, largeur, proue, arrondi, avant=None, n_proue=8, n_flanc=2, n_arc=4):
    """
    Un plan de navire vu de dessus, points (x, z) du modèle, dans le sens de
    `contour_rectangle` : l'avant tribord, le flanc tribord jusqu'à la poupe,
    la poupe aux coins arrondis de `arrondi`, le flanc bâbord, l'avant. La part
    `proue` de la longueur s'effile : en ogive jusqu'à une pointe (`avant`
    None), ou en trapèze jusqu'à un bord avant de `avant` fois la largeur. Deux
    plans faits avec les mêmes `n_*` se répondent point à point.
    """
    longueur = zb - za
    z_epaule = zb - proue * longueur
    demi = largeur / 2

    def demi_largeur(u):
        """u : 0 à l'épaule, 1 à l'avant."""
        if avant is None:
            return max(0.006, demi * max(0.0, 1 - u ** 1.8) ** 0.75)
        return demi * (1 - (1 - avant) * u)

    tribord_proue = [(-demi_largeur(u), z_epaule + u * (zb - z_epaule)) for u in (1 - k / n_proue for k in range(n_proue + 1))]
    flanc = [za + arrondi + (z_epaule - za - arrondi) * (1 - k / (n_flanc + 1)) for k in range(1, n_flanc + 1)]
    tribord_flanc = [(-demi, z) for z in flanc]
    arcs = []
    for cx, a0 in ((-(demi - arrondi), 180.0), (demi - arrondi, 270.0)):
        for j in range(n_arc + 1):
            a = math.radians(a0 + 90.0 * j / n_arc)
            arcs.append((cx + arrondi * math.cos(a), za + arrondi + arrondi * math.sin(a)))
    babord_flanc = [(demi, z) for z in reversed(flanc)]
    babord_proue = [(demi_largeur(u), z_epaule + u * (zb - z_epaule)) for u in (k / n_proue for k in range(n_proue + 1))]
    return tribord_proue + tribord_flanc + arcs + babord_flanc + babord_proue


def plan_ailes(xc, zc, envergure, longueur):
    """
    Les ailes et l'empennage d'un petit chasseur vus de dessus, points (x, z),
    dans le sens de `contour_rectangle` : une aile en flèche et deux
    stabilisateurs, d'un seul contour (concave).
    """
    e, l = envergure / 2, longueur
    demi = [  # le côté tribord, de l'avant à l'arrière : (x depuis l'axe, z depuis le centre)
        (0.02, 0.35 * l / 2), (e, -0.12 * l / 2), (e, -0.34 * l / 2), (0.02, -0.3 * l / 2),
        (0.02, -0.62 * l / 2), (0.5 * e, -0.86 * l / 2), (0.5 * e, -0.98 * l / 2), (0.0, -0.98 * l / 2),
    ]
    tribord = [(xc - x, zc + z) for x, z in demi]
    babord = [(xc + x, zc + z) for x, z in reversed(demi)]
    return tribord[:-1] + babord[1:]


def anneau(plan, y):
    """Un plan (x, z) posé à la hauteur `y` : un anneau de `solide`."""
    return [(x, y, z) for x, z in plan]


#: Le bas de la coque graphite : un peu sous le haut de la bande de flottaison.
Y_BAS_COQUE = FLOTTAISON - 0.004


def plans_coque(retrait=0.0):
    """Les deux plans de la coque, à la flottaison et sous le pont, rentrés de `retrait`."""
    r = retrait
    bas = contour_navire(COQUE_Z[0] + r, COQUE_Z[1] - r, COQUE_LARGEUR - 2 * r, PROUE, ARRONDI_POUPE - r / 2)
    haut = contour_navire(PONT_Z[0] + r, PONT_Z[1] - r, PONT_LARGEUR - 2 * r, PONT_ETRAVE, ARRONDI_PONT - r / 2, avant=PONT_AVANT)
    return bas, haut


def section_coque(y, retrait=0.0):
    """
    Le plan de la coque à la hauteur `y`, rentré de `retrait` : la coque relie
    ses deux plans point à point, en ligne droite ; sa section est leur
    interpolation. La dalle du pont y noie son pied sans en sortir, même à
    l'avant, où la coque s'évase.
    """
    bas, haut = plans_coque(retrait)
    t = (y - Y_BAS_COQUE) / (Y_COQUE - Y_BAS_COQUE)
    return [(xb + (xh - xb) * t, zb + (zh - zb) * t) for (xb, zb), (xh, zh) in zip(bas, haut)]


def construire(f):
    # Les nœuds. La coque (`base`) porte tout : c'est elle qui tangue ; le pont,
    # sa piste, l'avion et l'îlot (`corps`) lui sont accrochés ; la parabole
    # (`module_radar`) tourne sur son pied, l'antenne (`module_antenne`) se
    # dresse sur le toit de l'îlot.
    f.noeud('base', pivot=(0, FLOTTAISON, 0))
    f.noeud('corps', parent='base', pivot=(0, PONT[0], 0))
    f.noeud('module_radar', parent='corps', pivot=(ILOT_X, Y_PIED_RADAR, Z_RADAR), mobile=True)
    f.noeud('module_antenne', parent='corps', pivot=(ILOT_X, Y_TOIT, Z_ANTENNE))
    f.noeud('socle', pivot=(0, 0, 0))

    # La coque : la bande de flottaison os, puis le mur graphite, droit, qui ne
    # s'évase qu'à l'avant, de la pointe de flottaison au trapèze du pont.
    bas, haut = plans_coque()
    f.solide('base', [anneau(bas, 0.0), anneau(bas, FLOTTAISON)], 'os', fin=True, nom='flottaison')
    f.solide('base', [anneau(bas, Y_BAS_COQUE), anneau(haut, Y_COQUE)], 'graphite', nom='coque')

    # Le pont d'envol : une grande dalle d'équipe, en retrait d'un liseré
    # sombre ; son pied est noyé dans la coque, dont il suit la section.
    plan_pont = section_coque(Y_COQUE, RETRAIT_PONT)
    pont = f.solide('corps', [anneau(section_coque(PONT[0], RETRAIT_PONT), PONT[0]), anneau(plan_pont, Y_COQUE), anneau(plan_pont, PONT[1])],
                    'equipe', nom='pont')

    # La piste : des tirets os, noyés dans le pont dont ils ne dépassent que
    # d'un demi-centimètre ; ils se jugent avec lui.
    hauteur_tiret = TIRET[1]
    for i, z in enumerate(Z_TIRETS):
        t = f.boite('corps', (X_PISTE, PONT[1] + SAILLIE_TIRET - hauteur_tiret / 2, z), TIRET, 'os', nom=f'tiret_{i + 1}')
        t.avec = pont.nom

    # Le petit avion garé, sombre : un fuselage rond, des ailes en flèche et
    # deux stabilisateurs d'un seul tenant, jugés avec le fuselage.
    xa, za = AVION_CENTRE
    ya = PONT[1] + AVION_FUSELAGE - 0.004
    fuselage = f.capsule('corps', (xa, ya, za), AVION_FUSELAGE, AVION_LONGUEUR, 'graphite', axe='z', nom='avion')
    plan = plan_ailes(xa, za, AVION_ENVERGURE, AVION_LONGUEUR)
    ailes = f.solide('corps', [anneau(plan, PONT[1] - 0.004), anneau(plan, PONT[1] - 0.004 + EPAISSEUR_AILE)], 'graphite', nom='avion_ailes')
    ailes.avec = fuselage.nom

    # L'îlot : un bloc d'équipe, une bande de vitres, un toit qui déborde et
    # dont les bords rentrent (ils prennent la lumière).
    lx, lz = ILOT
    ilot = f.extrusion('corps', b.contour_rectangle(ILOT_X, ILOT_Z, lx, lz, rayon=0.02), None, PONT[1] - 0.01, Y_VITRES[0] + 0.005,
                       'equipe', nom='ilot')
    vitres = f.boite('corps', (ILOT_X, (Y_VITRES[0] + Y_VITRES[1]) / 2, ILOT_Z), (lx + 0.008, Y_VITRES[1] - Y_VITRES[0], lz + 0.008), 'verre',
                     nom='vitres')
    toit = f.extrusion('corps', b.contour_rectangle(ILOT_X, ILOT_Z, lx + 0.02, lz + 0.02, rayon=0.02, n_coin=6),
                       b.contour_rectangle(ILOT_X, ILOT_Z, lx - 0.01, lz - 0.01, rayon=0.012, n_coin=6), Y_VITRES[1] - 0.005, Y_TOIT, 'equipe',
                       nom='toit')
    # La bande de vitres et le toit ceignent le bloc : ils se jugent avec lui.
    vitres.avec = ilot.nom
    toit.avec = ilot.nom

    # La parabole, sur son pied : un bol clair qui, au repos, tourne le dos à
    # la caméra et regarde un peu le ciel.
    rp, hp = PIED_RADAR
    f.cylindre('module_radar', (ILOT_X, Y_PIED_RADAR + hp / 2, Z_RADAR), rp, hp, 'graphite', axe='y', nom='pied_radar')
    i, c = math.radians(INCLINAISON_PARABOLE), math.radians(CAP_PARABOLE)
    regard = (math.cos(i) * math.sin(c), math.sin(i), math.cos(i) * math.cos(c))
    centre = (ILOT_X, Y_PIED_RADAR + hp + RAYON_PARABOLE * 0.55, Z_RADAR)
    f.parabole('module_radar', centre, RAYON_PARABOLE, PROFONDEUR_PARABOLE, regard, teinte='os', epaisseur=EPAISSEUR_PARABOLE)

    # L'antenne, à l'arrière du toit.
    f.antenne('module_antenne', base=(ILOT_X, Y_TOIT - 0.01, Z_ANTENNE), hauteur=HAUTEUR_ANTENNE)


def animer(f):
    # Toute rotation de la coque tourne autour du pont (`CENTRE_PONT`).

    # Repos : un léger tangage, et la parabole qui tourne sur son pied.
    r = f.clip('repos')
    b.balancer(r, 'base', 'x', 0.5, periodes=1, centre=CENTRE_PONT)
    b.tourner(r, 'module_radar', 'y', tours=1)

    # Déplacement : la coque tangue un peu plus et pilonne à peine ; le radar tourne.
    d = f.clip('deplacement')
    b.balancer(d, 'base', 'x', 1.2, periodes=1, centre=CENTRE_PONT)
    b.osciller(d, 'base', 'y', 0.004, periodes=2)
    b.tourner(d, 'module_radar', 'y', tours=1)

    # Tir : il n'a pas d'arme ; un petit à-coup de la coque, l'antenne qui
    # fouette. Le retour dure jusqu'au bout du clip : une pose immobile après un
    # mouvement sortait mal ombrée de la cuisson (l'image 8, à 0,622 s, 8 % plus
    # sombre en vue « droite », 25 % de profil, et sans sa bande de vitres).
    t = f.clip('tir')
    b.a_coup(t, 'base', 'z', 1.2, attaque=0.08, retour=t.duree - 0.08, centre=CENTRE_PONT)
    b.secousse(t, 'module_antenne', 'x', 6.0, oscillations=2.5)

    # Touché : la coque roule et s'enfonce, l'antenne et la parabole vacillent.
    k = f.clip('touche')
    b.secousse(k, 'base', 'z', 3.0, oscillations=2, centre=CENTRE_PONT)
    b.sursaut(k, 'base', '-y', 0.01)
    b.secousse(k, 'module_antenne', 'x', 8.0, oscillations=2.5)
    b.secousse(k, 'module_radar', 'x', 6.0, oscillations=2)

    # Hors jeu : la coque s'enfonce, gîte et pique de l'avant, autour du pont ;
    # l'antenne penche, la parabole pique.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'base', descente=(0, -0.035, 0), rotation=('z', -5.0), centre=CENTRE_PONT)
    b.affaisser(h, 'base', rotation=('x', 3.0), centre=CENTRE_PONT)
    b.affaisser(h, 'module_antenne', rotation=('z', -20.0), debut=0.25, duree=0.5)
    b.affaisser(h, 'module_radar', rotation=('x', 25.0), debut=0.15, duree=0.55)
