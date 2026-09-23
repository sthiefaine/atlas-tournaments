"""
La barge de débarquement : un bac de jouet, plat et carré, fermé à l'avant
par une grande porte.

Ce qui la dit à 48 pixels : une coque basse et rectangulaire, graphite sur sa
bande de flottaison os ; un grand radier vide et sombre qu'on voit d'en haut,
cerné d'un rebord en « U » à la couleur du camp ; à l'avant, la grande rampe
relevée, plus haute que tout le reste : c'est son étrave, et son signe ; à
l'arrière, un château bas et sa passerelle vitrée. Le profil d'un chaland :
haut aux deux bouts, creux au milieu. Ni pointe ni tourelle (le cuirassé), ni
vedette effilée (le drone marin). Classe moyenne, 0,80 à 0,84 case de large en
vue « droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

import bibliotheque as b
from mathutils import Matrix

#: Le haut de la classe moyenne : un grand bac, plus court que le cuirassé.
LARGEUR_VISEE = (0.80, 0.84)

# Les cotes, en mètres : tout se déduit d'elles.
LONGUEUR = 0.70             # coque, de la poupe à l'étrave
LARGEUR = 0.36              # coque, bord à bord
X_BORD = LARGEUR / 2
Z_POUPE = -LONGUEUR / 2
Z_ETRAVE = LONGUEUR / 2

FLOTTAISON = 0.045          # la bande os, de 0 à 4,5 cm
RADIER = 0.1                # le dessus de la coque : le fond du puits, sombre
REBORD = 0.145              # le dessus du rebord : bas, la rampe en ressort d'autant
EPAULE = 0.05               # le rebord rentre d'autant vers son dessus, dehors : un chanfrein qui prend la lumière
X_PUITS = 0.1               # le puits, bord intérieur du rebord
Z_PUITS = -0.15             # le fond du puits, côté poupe
Z_REBORD_AVANT = 0.29       # le rebord s'arrête contre la rampe

# La rampe : une porte épaisse, relevée, presque droite, dont l'arête haute
# est abattue à 45° : un bandeau qui prend la lumière au sommet de l'étrave.
# La charnière au pied, posée sur l'étrave.
RAYON_CHARNIERE = 0.027
Y_CHARNIERE = RADIER + 0.012
Z_CHARNIERE = Z_ETRAVE - RAYON_CHARNIERE
HAUTEUR_RAMPE = 0.185
LARGEUR_RAMPE = 0.32
EPAISSEUR_RAMPE = 0.065
BISEAU_RAMPE = 0.045        # l'arête haute abattue à 45°, sur autant de haut que de profondeur
DEVERS_RAMPE = 0.012        # la face avant de la rampe, devant l'axe de la charnière
COUCHEE = 3.0               # degrés vers l'arrière

# Le château arrière et sa passerelle.
CHATEAU = (0.28, 0.05, 0.15)   # x, y (au-dessus du rebord), z
Z_CHATEAU = -0.255
CABINE = (0.15, 0.105, 0.1)    # x, y, z
Z_CABINE = -0.26


def vitre(f, noeud, centre, taille, nom):
    """
    Une vitre dont le reflet peint tombe sur son tiers haut. `boite()` projette
    ses UV en boîte : sur les flancs d'une vitre, le reflet de l'atlas tomberait
    au tiers bas ; la bibliothèque sait faire mieux (`uv='hauteur'`) mais ne
    l'offre par aucune primitive.
    """
    sx, sy, sz = taille
    bm = b.bm_boite((sx, sz, sy))
    return f._piece(bm, noeud, 'verre', f._placement(centre), (sx, sy, sz), uv='hauteur', nom=nom)


def extrusion(f, noeud, bas, haut, y0, y1, teinte, chanfrein=None, nom=None):
    """
    Un solide vertical dont la section change du bas au haut : `bas` et `haut`
    sont deux contours (x, z) du modèle, de même nombre de points, parcourus
    dans le même sens ; `haut` peut rentrer (un chanfrein qui prend la
    lumière). Le contour peut être concave (un U).
    """
    bm = b.bmesh.new()
    b._solide_anneaux(bm, [[b.vb((x, y0, z)) for x, z in bas], [b.vb((x, y1, z)) for x, z in haut]])
    # Un couvercle concave (le U) est triangulé ici, par la méthode robuste de
    # Blender : sa triangulation paresseuse, sur un maillage fusionné que rien
    # n'a encore évalué, peut jeter un triangle en travers du creux.
    b.bmesh.ops.triangulate(bm, faces=[p for p in bm.faces if len(p.verts) > 4], quad_method='BEAUTY', ngon_method='BEAUTY')
    xs = [x for x, _ in bas]
    zs = [z for _, z in bas]
    dims = (max(xs) - min(xs), y1 - y0, max(zs) - min(zs))
    return f._piece(bm, noeud, teinte, Matrix.Identity(4), dims, chanfrein=chanfrein, nom=nom)


def rectangle(cx, cz, lx, lz):
    """Un rectangle (x, z) centré, dans le sens des contours de `extrusion`."""
    return [(cx - lx / 2, cz + lz / 2), (cx - lx / 2, cz - lz / 2), (cx + lx / 2, cz - lz / 2), (cx + lx / 2, cz + lz / 2)]


def construire(f):
    # Les nœuds. La coque (`base`) porte tout : c'est elle qui tangue ; le
    # plateau (`corps`) lui est accroché ; la charnière (`module_grue`) au pied
    # de la rampe, et la rampe sur son propre nœud, pivot sur la charnière.
    y_cabine = REBORD + CHATEAU[1]
    y_toit = y_cabine + CABINE[1]
    f.noeud('base', pivot=(0, FLOTTAISON, 0))
    f.noeud('corps', parent='base', pivot=(0, RADIER, 0))
    f.noeud('module_grue', parent='corps', pivot=(0, Y_CHARNIERE, Z_CHARNIERE))
    f.noeud('rampe', parent='module_grue', pivot=(0, Y_CHARNIERE, Z_CHARNIERE))
    f.noeud('mat', parent='corps', pivot=(0, y_toit, Z_CABINE - 0.02))
    f.noeud('socle', pivot=(0, 0, 0))

    # La coque : la bande de flottaison os, puis la coque graphite, dont le
    # dessus est le radier, le fond du puits qu'on voit d'en haut.
    f.boite('base', (0, FLOTTAISON / 2, 0), (LARGEUR, FLOTTAISON, LONGUEUR), 'os', fin=True, nom='flottaison')
    h = RADIER - FLOTTAISON + 0.004
    f.boite('base', (0, FLOTTAISON - 0.004 + h / 2, 0), (LARGEUR, h, LONGUEUR), 'graphite', nom='coque')

    # Le rebord en U, d'un seul tenant, à la couleur du camp : les deux
    # murailles et le pont arrière. Dehors, un chanfrein qui prend la
    # lumière ; dedans, des parois droites qui tombent sur le radier sombre.
    X, Zp, Za, e = X_BORD, Z_POUPE, Z_REBORD_AVANT, EPAULE
    bas = [(-X, Za), (-X, Zp), (X, Zp), (X, Za), (X_PUITS, Za), (X_PUITS, Z_PUITS), (-X_PUITS, Z_PUITS), (-X_PUITS, Za)]
    haut = [(-X + e, Za), (-X + e, Zp + e), (X - e, Zp + e), (X - e, Za), (X_PUITS, Za), (X_PUITS, Z_PUITS), (-X_PUITS, Z_PUITS), (-X_PUITS, Za)]
    extrusion(f, 'corps', bas, haut, RADIER - 0.012, REBORD, 'equipe', nom='rebord')

    # Les parois du puits sont doublées de graphite : une plaque noyée dans le
    # rebord, qui n'en affleure que de 2 mm et s'arrête sous son arrondi. Le
    # creux se lit tout sombre, le rebord d'équipe le cerne par le dessus.
    y0, y1 = REBORD - 0.02 - 0.052, REBORD - 0.02
    for cote in (1, -1):
        f.boite('corps', (cote * (X_PUITS + 0.023), (y0 + y1) / 2, (Z_PUITS + Za) / 2), (0.05, y1 - y0, Za - Z_PUITS - 0.004),
                'graphite', nom=f'doublure_{"g" if cote > 0 else "d"}')
    f.boite('corps', (0, (y0 + y1) / 2, Z_PUITS - 0.023), (2 * X_PUITS + 0.046, y1 - y0, 0.05), 'graphite', nom='doublure_arriere')

    # Le château arrière, bas, aux flancs qui rentrent aussi.
    cx, cy, cz = CHATEAU
    r = 0.055
    extrusion(f, 'corps', rectangle(0, Z_CHATEAU, cx, cz), rectangle(0, Z_CHATEAU - r * 0.3, cx - 2 * r, cz - 2.2 * r),
              REBORD - 0.015, y_cabine, 'equipe', nom='chateau')

    # La passerelle : une timonerie d'équipe ceinte d'une bande vitrée, sous
    # un toit qui déborde un peu et dont les bords rentrent (ils prennent la
    # lumière).
    kx, ky, kz = CABINE
    f.boite('corps', (0, y_cabine + 0.02, Z_CABINE), (kx, 0.06, kz), 'equipe', nom='cabine')
    vitre(f, 'corps', (0, y_cabine + 0.052, Z_CABINE), (kx + 0.008, 0.05, kz + 0.008), 'vitres')
    tx, tz, retrait = kx / 2 + 0.012, kz / 2 + 0.012, 0.022
    zt = Z_CABINE - 0.004
    extrusion(f, 'corps', rectangle(0, zt, 2 * tx, 2 * tz), rectangle(0, zt, 2 * (tx - retrait), 2 * (tz - retrait)),
              y_cabine + ky - 0.05, y_cabine + ky, 'equipe', nom='toit')

    # Le mât, court, sur le toit de la passerelle.
    f.antenne('mat', base=(0, y_toit - 0.01, Z_CABINE - 0.02), hauteur=0.08)

    # La charnière : un gros barillet clair au pied de la rampe, sur l'étrave.
    f.cylindre('module_grue', (0, Y_CHARNIERE, Z_CHARNIERE), RAYON_CHARNIERE, LARGEUR - 0.1, 'acier_clair', axe='x', nom='charniere')

    # La rampe : son profil, debout, depuis l'axe de la charnière (vers l'avant,
    # vers le haut), puis couché de quelques degrés ; son pied dans la
    # charnière, qui la fait basculer.
    d, t, hr, bi = DEVERS_RAMPE, EPAISSEUR_RAMPE, HAUTEUR_RAMPE, BISEAU_RAMPE
    debout = [(d, 0.0), (d, hr - bi), (d - bi, hr), (d - t, hr), (d - t, 0.0)]
    a = math.radians(COUCHEE)
    profil = [(Z_CHARNIERE - dy * math.sin(a) + dz * math.cos(a), Y_CHARNIERE + dy * math.cos(a) + dz * math.sin(a)) for dz, dy in debout]
    f.prisme('rampe', profil, LARGEUR_RAMPE, 'equipe', chanfrein=0.02, nom='rampe')


def animer(f):
    # Repos : un léger tangage, et rien d'autre.
    b.balancer(f.clip('repos'), 'base', 'x', 0.6, periodes=1)

    # Déplacement : la coque tangue un peu plus et pilonne à peine.
    d = f.clip('deplacement')
    b.balancer(d, 'base', 'x', 1.4, periodes=1)
    b.osciller(d, 'base', 'y', 0.004, periodes=2)

    # Touché : la coque roule et s'enfonce, la rampe claque sur sa charnière.
    k = f.clip('touche')
    b.secousse(k, 'base', 'z', 3.5, oscillations=2)
    b.sursaut(k, 'base', '-y', 0.012)
    b.secousse(k, 'rampe', 'x', 5.0, oscillations=2.5)

    # Hors jeu : la coque s'enfonce et gîte, la rampe retombe à demi, le mât penche.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'base', descente=(0, -0.03, 0), rotation=('z', -7.0))
    b.affaisser(h, 'rampe', rotation=('x', 20.0), debut=0.15, duree=0.55)
    b.affaisser(h, 'mat', rotation=('z', -20.0), debut=0.25, duree=0.5)
