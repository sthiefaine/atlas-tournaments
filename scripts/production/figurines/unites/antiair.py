"""
L'anti-air : le char léger qui regarde le ciel.

Ce qui le dit à 48 pixels : le train et la caisse du char léger, la caisse
entière à la couleur du camp ; une tourelle ouverte, un bac bas aux parois
en pente, détaché de la caisse par un trait sombre ; et son signe, la plus
grosse pièce après le corps : deux canons épais dressés vers le ciel à 65°,
bouches d'acier clair — ce qui tire en l'air pointe vers le haut —, sortis
d'un bloc d'affût à la couleur du camp. Derrière eux, un bol radar clair sur
un bras court, la seule pièce qui bouge au repos : il tourne. Classe moyenne,
haut de la fourchette : 0,80 à 0,84 case de large en vue « droite », contour
compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Trois choix que la mesure a tranchés :

- Les deux tubes sont l'un **au-dessus** de l'autre, pas côte à côte. En vue
  « droite » (lacet 60°, tangage 50°), un écart latéral se projette presque le
  long d'un tube levé : deux tubes côte à côte s'y recouvrent et se lisent
  comme un seul. L'écart « au-dessus » se projette en travers : ils s'y lisent
  séparés, parallèles, sur toute leur longueur (en vue « haut », de dos, ils
  se touchent : c'est une vue de marche).
- L'affût a tourné de 60° dans sa tourelle ouverte, vers la gauche du modèle :
  il suit une cible. Droit devant, un canon levé pointe presque vers la caméra
  et n'y montre que 56 % de sa longueur, penché à 49° ; de biais, 83 %, dressé
  à 64°, et sa bouche vise toujours la droite de l'image. C'est aussi ce qui
  sépare son ombre chinoise de celle du char léger, bâti sur la même caisse :
  0,75 de recouvrement à 48 px en vue « droite » au lieu de 0,82.
- Le bol radar se tient de trois quarts : tourné vers la caméra, clair sur son
  bras, il se lirait comme une boule-caméra, le signe de la vision.

Le contrat d'assemblage de l'anti-air (`src/assets/production.ts`) fixe les
pivots : `corps` à (0 ; 0,16 ; 0), `module_tourelle` 0,105 au-dessus, le
`module_radar` 0,1 au-dessus et 0,17 derrière la tourelle — c'est l'axe du
radar, qui tourne autour et se replie autour de x —, et le `socle` (un
témoin, vide ici) 0,055 au-dessus et 0,178 devant la tourelle.
"""

import math

import bmesh
from mathutils import Matrix

import bibliotheque as b

#: Le haut de la classe moyenne : un peu plus long que le char léger.
LARGEUR_VISEE = (0.80, 0.84)

# --- Les pivots du contrat (`src/assets/production.ts`), en absolu -------------
PIVOT_CORPS = (0.0, 0.16, 0.0)
PIVOT_TOURELLE = (0.0, 0.265, 0.0)
PIVOT_RADAR = (0.0, 0.365, -0.17)
PIVOT_SOCLE = (0.0, 0.32, 0.178)

# --- Le train : les chenilles et les galets du char léger ---------------------
LONGUEUR_TRAIN = 0.62
DEMI_VOIE = 0.19
LARGEUR_CHENILLE = 0.13
HAUTEUR_CHENILLE = 0.16
RAYON_GALET = 0.052
EPAISSEUR_GALET = 0.05
Y_GALETS = 0.068
Z_GALETS = (-0.21, -0.07, 0.07, 0.21)

# --- La caisse du char léger, élargie : elle couvre le dessus des chenilles ----
CAISSE_BAS = 0.1
CAISSE_HAUTEUR = 0.12
CAISSE_LONGUEUR = 0.58
CAISSE_LARGEUR = 0.45
DESSUS = CAISSE_BAS + CAISSE_HAUTEUR   # 0,22 : le pont de la caisse

# --- La tourelle ouverte : un bac bas, aux parois inclinées --------------------
# Les parois penchent de 45° : sous l'éclairage de la cuisson (la principale
# vient du joueur à 60°), une paroi plus droite que 30° reste sous 0,8 de
# lumière, et la couleur du camp s'y éteint.
TOURELLE_Z = -0.03
TOURELLE_BAS = DESSUS + 0.022           # l'anneau sombre la soulève
TOURELLE_LARGEUR = 0.35                 # au pied
TOURELLE_LONGUEUR = 0.43
TOURELLE_HAUTEUR = 0.075
PENTE_PAROIS = 45.0                     # depuis la verticale
PAROI = 0.045                           # l'épaisseur du rebord
FOND = 0.03
REBORD = TOURELLE_BAS + TOURELLE_HAUTEUR

# --- Les canons : deux tubes l'un au-dessus de l'autre, dressés à 65° ---------
ELEVATION = 65.0
#: L'affût a tourné dans la tourelle ouverte, vers la gauche du modèle : il suit
#: une cible. En vue « droite », les canons s'y montrent de biais (83 % de leur
#: longueur au lieu de 56 %, dressés à 64° au lieu de 49°), et leurs bouches
#: visent toujours la droite.
LACET_AFFUT = 60.0
_E, _L = math.radians(ELEVATION), math.radians(LACET_AFFUT)
AXE = (math.sin(_L) * math.cos(_E), math.sin(_E), math.cos(_L) * math.cos(_E))
DESSUS_AXE = (-math.sin(_L) * math.sin(_E), math.cos(_E), -math.cos(_L) * math.sin(_E))
#: L'axe autour duquel les canons se lèvent ou s'abaissent : l'horizontale en travers de l'affût.
TOURILLONS = (math.cos(_L), 0.0, -math.sin(_L))
TOURILLON = (0.0, 0.30, -0.045)
ECART = 0.15                            # d'un axe de tube à l'autre
#: La longueur est bornée deux fois : la masse sombre doit tenir le bas de la
#: silhouette (des tubes graphite plus longs la font monter), et le bout d'une
#: bouche arrive à 0,64 case au-dessus du pivot en vues « droite » et « haut »
#: (0,70 au plus).
RAYON_TUBE = 0.043                      # au pied : le tube s'affine vers la bouche
RAYON_TUBE_BOUT = 0.036
LONGUEUR_TUBE = 0.50                    # depuis le plan des tourillons
DEPART_TUBE = 0.04
RAYON_BOUCHE = 0.037
LONGUEUR_BOUCHE = 0.05
BERCEAU = (0.12, 0.24, 0.22)            # x, le long de « dessus », le long de l'axe
BERCEAU_LEVE = 0.06                     # le bloc monte le long de l'axe : il sort du bac
RECUL_TIR = 0.06
ATTAQUE_TIR = 0.03

# --- Le radar : un bol sur un bras court, sur son axe (le pivot du contrat) ------
# Le contrat le décrit comme « un bol trapu et un bras repliable » : le bras le
# porte au-dessus de la tourelle, où il dessine, avec les canons, le haut de la
# silhouette — radar à gauche, canons à droite en vue « droite » —, que le char
# léger, bâti sur la même caisse, n'a pas.
MAT_BAS = REBORD - 0.02
CENTRE_PARABOLE = (0.0, 0.60, PIVOT_RADAR[2])
RAYON_PIED = 0.042                      # le pied, fixe, sur le rebord arrière
RAYON_MAT = 0.036                       # le bras, qui tourne et se replie avec la parabole
RAYON_PARABOLE = 0.095
PROFONDEUR_PARABOLE = 0.05
EPAISSEUR_PARABOLE = 0.025
INCLINAISON_PARABOLE = 35.0             # au-dessus de l'horizon
#: Où regarde la parabole au repos : vers l'avant et le ciel, comme les canons.
#: Tournée vers la caméra, elle se lirait comme un œil (le signe de la
#: boule-caméra, qui est celui de la vision) ; de trois quarts, comme un bol.
CAP_PARABOLE = 18.0                     # degrés, depuis l'avant (+z) vers la gauche (+x)


def le_long(p, d, t):
    """Le point `p` avancé de `t` mètres dans la direction `d`."""
    return tuple(a + t * c for a, c in zip(p, d))


def rectangle_arrondi(lx, lz, r, y, zc=0.0, n_coin=6):
    """Un rectangle aux coins arrondis, vu de dessus : points (x, y, z) du modèle."""
    r = max(1e-3, min(r, lx / 2 - 1e-3, lz / 2 - 1e-3))
    cx, cz = lx / 2 - r, lz / 2 - r
    pts = []
    for sx, sz, a0 in ((1, 1, 0), (-1, 1, 90), (-1, -1, 180), (1, -1, 270)):
        for k in range(n_coin + 1):
            a = math.radians(a0 + 90 * k / n_coin)
            pts.append((sx * cx + r * math.cos(a), y, zc + sz * cz + r * math.sin(a)))
    return pts


def bac(f, noeud, y_bas, zc, largeur, longueur, hauteur, pente, paroi, fond, rayon, teinte, nom='bac'):
    """
    Un bac ouvert : des parois inclinées de `pente` degrés depuis la verticale
    (le pied fait `largeur` × `longueur`), un rebord plat épais de `paroi`, un
    fond à `fond` au-dessus du bas. Les parois intérieures suivent les
    extérieures.
    """
    retrait = hauteur * math.tan(math.radians(pente))
    lh, lzh, rh = largeur - 2 * retrait, longueur - 2 * retrait, max(0.01, rayon - retrait * 0.5)
    anneaux_modele = [
        rectangle_arrondi(largeur, longueur, rayon, y_bas, zc),
        rectangle_arrondi(lh, lzh, rh, y_bas + hauteur, zc),
        rectangle_arrondi(lh - 2 * paroi, lzh - 2 * paroi, max(0.01, rh - paroi), y_bas + hauteur, zc),
    ]
    # Le fond intérieur, à la même pente que la paroi extérieure.
    r_fond = (hauteur - fond) * math.tan(math.radians(pente))
    anneaux_modele.append(rectangle_arrondi(lh - 2 * paroi + 2 * r_fond, lzh - 2 * paroi + 2 * r_fond, max(0.01, rh - paroi), y_bas + fond, zc))
    anneaux = [[tuple(b.vb(p)) for p in a] for a in anneaux_modele]
    bm = bmesh.new()
    b._solide_anneaux(bm, anneaux)
    return f._piece(bm, noeud, teinte, Matrix.Identity(4), (largeur, hauteur, longueur), nom=nom)


def dalle(f, noeud, y_bas, y_haut, zc, largeur, longueur, rayon, teinte, nom='dalle'):
    """Une dalle horizontale aux coins arrondis, vue de dessus : un rectangle arrondi extrudé de `y_bas` à `y_haut`."""
    anneaux = [[tuple(b.vb(p)) for p in rectangle_arrondi(largeur, longueur, rayon, y, zc)] for y in (y_bas, y_haut)]
    bm = bmesh.new()
    b._solide_anneaux(bm, anneaux)
    return f._piece(bm, noeud, teinte, Matrix.Identity(4), (largeur, y_haut - y_bas, longueur), nom=nom)


def profil_parabole():
    """Le profil d'un bol épais : la face arrière convexe, puis la face avant concave, (rayon, hauteur le long de l'axe)."""
    n = 8
    r0 = RAYON_PARABOLE
    p, e = PROFONDEUR_PARABOLE, EPAISSEUR_PARABOLE
    profil = []
    for k in range(n + 1):
        r = max(0.004, r0 * k / n)
        profil.append((r, p * (r / r0) ** 2 - e))
    for k in range(n, -1, -1):
        r = max(0.004, r0 * k / n)
        profil.append((r * 0.999, p * (r / r0) ** 2))
    return profil


def tube_conique(f, noeud, depart, longueur, nom):
    """
    Un tube épais qui s'affine vers sa bouche (`RAYON_TUBE` au pied,
    `RAYON_TUBE_BOUT` au bout), et sa bouche d'acier clair, à peine plus large
    que le bout : l'épaisseur est dans le graphite, pas dans l'acier (3 % au plus).
    """
    centre = le_long(depart, AXE, longueur / 2)
    f.cylindre(noeud, centre, RAYON_TUBE, longueur, 'graphite', axe=AXE, rayon2=RAYON_TUBE_BOUT, nom=nom)
    bouche = le_long(depart, AXE, longueur - LONGUEUR_BOUCHE / 2 + 0.004)
    f.cylindre(noeud, bouche, RAYON_BOUCHE, LONGUEUR_BOUCHE, 'acier_clair', axe=AXE, nom=f'{nom}_bouche')


def instants_cuisson(duree, boucle):
    """Les instants que la cuisson photographie (`scripts/sprites/echantillonnage.ts`, recopié comme dans `fabriquer.py`)."""
    if duree <= 0:
        return [0.0]
    if boucle:
        n = max(1, min(b.IMAGES_MAX_PAR_CLIP, round(duree * b.IMAGES_PAR_SECONDE)))
        return [k * duree / n for k in range(n)]
    n = max(2, min(b.IMAGES_MAX_PAR_CLIP, math.ceil(duree * b.IMAGES_PAR_SECONDE - 1e-9) + 1))
    return [k * duree / (n - 1) for k in range(n)]


def construire(f):
    # Les nœuds du contrat, et les nôtres : l'affût (qui s'abaisse, hors jeu),
    # les deux tubes (qui reculent), les essieux (qui tournent). La parabole
    # est le module radar, et elle tourne.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('corps', pivot=PIVOT_CORPS)
    f.noeud('module_tourelle', parent='corps', pivot=PIVOT_TOURELLE)
    f.noeud('module_radar', parent='module_tourelle', pivot=PIVOT_RADAR, tournant=True)
    f.noeud('socle', parent='module_tourelle', pivot=PIVOT_SOCLE)
    f.noeud('affut', parent='module_tourelle', pivot=TOURILLON)
    haut = le_long(TOURILLON, DESSUS_AXE, ECART / 2)
    bas = le_long(TOURILLON, DESSUS_AXE, -ECART / 2)
    f.noeud('canon_haut', parent='affut', pivot=haut)
    f.noeud('canon_bas', parent='affut', pivot=bas)

    # Le train : deux bandes de caoutchouc, quatre galets graphite aux moyeux clairs de chaque côté.
    for cote in (1, -1):
        f.chenille('base', x=cote * DEMI_VOIE, longueur=LONGUEUR_TRAIN, hauteur=HAUTEUR_CHENILLE, largeur=LARGEUR_CHENILLE)
    essieux = [f'galets_{i + 1}' for i in range(len(Z_GALETS))]
    f.galets(essieux, x=DEMI_VOIE + LARGEUR_CHENILLE / 2 - 0.012, zs=Z_GALETS, y=Y_GALETS, rayon=RAYON_GALET,
             epaisseur=EPAISSEUR_GALET, teinte='graphite', teinte_moyeu='os')

    # La caisse du char léger, entière à la couleur du camp.
    f.caisse_char('corps', longueur=CAISSE_LONGUEUR, largeur=CAISSE_LARGEUR, y_bas=CAISSE_BAS, hauteur=CAISSE_HAUTEUR,
                  teinte='equipe', glacis=0.55, arriere=0.3, z_centre=-0.01)

    # L'anneau sombre, presque aussi large que la tourelle : un trait noir la
    # détache de la caisse. Puis la tourelle ouverte, un bac à la couleur du camp.
    dalle(f, 'module_tourelle', DESSUS - 0.02, TOURELLE_BAS + 0.01, TOURELLE_Z, TOURELLE_LARGEUR - 0.03,
          TOURELLE_LONGUEUR - 0.03, 0.07, 'graphite', nom='anneau')
    bac(f, 'module_tourelle', TOURELLE_BAS, TOURELLE_Z, TOURELLE_LARGEUR, TOURELLE_LONGUEUR, TOURELLE_HAUTEUR,
        PENTE_PAROIS, PAROI, FOND, 0.09, 'equipe', nom='tourelle')

    # L'affût : un bloc à la couleur du camp, qui sort du bac, et les deux tubes dressés.
    f.boite('affut', le_long(TOURILLON, AXE, BERCEAU_LEVE), BERCEAU, 'equipe', rotation=[('x', -ELEVATION), ('y', LACET_AFFUT)],
            chanfrein=0.03, nom='berceau')
    for noeud, depart in (('canon_haut', haut), ('canon_bas', bas)):
        tube_conique(f, noeud, le_long(depart, AXE, DEPART_TUBE), LONGUEUR_TUBE - DEPART_TUBE, nom=f'tube_{noeud.split("_")[1]}')

    # Le pied, fixe sur le rebord arrière ; le bras et la parabole, qui tournent sur son axe.
    xc, yc, zc = CENTRE_PARABOLE
    yp = PIVOT_RADAR[1]
    f.cylindre('module_tourelle', (xc, (MAT_BAS + yp) / 2, zc), RAYON_PIED, max(0.05, yp - MAT_BAS), 'equipe', axe='y', nom='pied')
    f.cylindre('module_radar', (xc, (yp + yc) / 2, zc), RAYON_MAT, yc - yp, 'graphite', axe='y', nom='bras')
    i, c = math.radians(INCLINAISON_PARABOLE), math.radians(CAP_PARABOLE)
    regard = (math.cos(i) * math.sin(c), math.sin(i), math.cos(i) * math.cos(c))
    f.revolution('module_radar', CENTRE_PARABOLE, profil_parabole(), 'os', axe=regard, chanfrein=0.008, nom='parabole')
    f.cylindre('module_radar', le_long(CENTRE_PARABOLE, regard, 0.02), 0.025, 0.05, 'os', axe=regard, nom='cornet')


def animer(f):
    # Repos : rien ne bouge que la parabole, qui tourne lentement.
    b.tourner(f.clip('repos'), 'module_radar', 'y', tours=1)

    # Déplacement : les galets roulent, la caisse respire sur sa suspension.
    d = f.clip('deplacement')
    for i in range(len(Z_GALETS)):
        b.tourner(d, f'galets_{i + 1}', 'x', tours=1)
    b.osciller(d, 'corps', 'y', 0.004, periodes=2)
    b.balancer(d, 'corps', 'x', 0.6, periodes=2, phase=1.2)

    # Tir : une rafale brève, les deux tubes reculent tour à tour le long de leur
    # axe ; chaque recul culmine sur une image de la cuisson (un pas de 78 ms).
    t = f.clip('tir')
    images = instants_cuisson(t.duree, t.boucle)
    arriere = tuple(-c for c in AXE)
    for k, noeud in zip(range(1, 7), ('canon_haut', 'canon_bas') * 3):
        b.recul(t, noeud, arriere, RECUL_TIR, debut=images[k] - ATTAQUE_TIR, attaque=ATTAQUE_TIR, retour=0.1)
    b.a_coup(t, 'corps', 'x', -1.2, attaque=0.06, retour=0.5)

    # Touché : la caisse vacille et se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'z', 4.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.01)

    # Hors jeu : la caisse s'affaisse de biais, les canons retombent vers l'avant,
    # le radar se replie en arrière, loin d'eux.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.015, 0), rotation=('z', -6.0))
    b.affaisser(h, 'affut', rotation=(TOURILLONS, 22.0), debut=0.1, duree=0.6)
    b.affaisser(h, 'module_radar', rotation=('x', -30.0), debut=0.25, duree=0.5)
