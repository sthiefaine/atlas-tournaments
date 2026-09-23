"""
L'infanterie : l'unité la moins chère, la plus nombreuse, celle qui prend les
villes — le premier jouet de la boîte, et le plus attachant.

Ce qui la dit à 48 pixels : un soldat debout, en marche, **casque rond** à bord
évasé repoussé sur la nuque, **visage nu** tourné vers le joueur, **fusil tenu
en travers** de la poitrine (au port d'arme, bouche claire vers l'épaule
gauche), et planté dans son sac un **petit fanion d'équipe** au pommeau clair :
c'est lui qu'il plante sur les villes. Casque, veste, pantalon et fanion à la
couleur du camp ; bottes montantes, ceinturon, sac, fusil et hampe en graphite.

La figurine est celle de la bibliothèque (`fantassin`), à ses proportions et
avec son visage : seuls la tenue, le couvre-chef, l'arme et la pose changent.
La bibliothèque n'offre pas de quoi poser un membre ; la pose est donc modelée
ici en faisant pivoter, avant la fusion, les pièces que `fantassin` a posées
(`poser_noeud`, et le pas des jambes) — les nœuds restent sans rotation au
repos, comme la chaîne le veut.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

from mathutils import Matrix, Vector

import bibliotheque as b

# ---------------------------------------------------------------------------
# La figurine de la bibliothèque, à ses proportions par défaut : les trois
# fantassins (infanterie, méca, génie) sont de la même main.
# ---------------------------------------------------------------------------

HAUTEUR = 0.8
TETES = 4.25
CARRURE = 1.9

# Les cotes de `fantassin`, recopiées de ses formules : elles servent à poser
# le casque, le fusil et le sac sur la figurine sans la deviner.
TETE = HAUTEUR / TETES
R_TETE = TETE * 0.5
Y_HANCHE = HAUTEUR * 0.43
Y_EPAULE = HAUTEUR - TETE * 1.05
Y_COU = HAUTEUR - TETE * 0.98
Y_TETE = Y_COU + R_TETE * 0.95
Z_TETE = 0.01
DEMI_TORSE = CARRURE * TETE / 2
EPAIS_TORSE = 1.2 * TETE
R_BRAS = max(0.28 * TETE, 0.025)
LONG_BRAS = Y_EPAULE - Y_HANCHE + 0.02
X_BRAS = DEMI_TORSE + R_BRAS * 0.6
Y_MAIN = Y_EPAULE - LONG_BRAS + R_BRAS * 0.4

# Le casque : repoussé en arrière et tourné vers la droite du soldat, pour que
# le visage regarde le joueur dans les vues « droite » et « bas ».
CASQUE_RECUL = 30.0      # degrés : l'axe du casque penche vers la nuque
CASQUE_TOURNE = 45.0     # degrés : et vers la gauche du soldat (le visage tourne à droite)
CASQUE_HAUSSE = 0.2      # part du rayon de la tête dont le bord remonte au-dessus de l'équateur
# Son profil, en rayons de tête (rayon, hauteur le long de l'axe) : un bord
# évasé, puis un dôme plus large que la tête — un casque rond, pas un bonnet.
CASQUE_PROFIL = ((1.22, 0.0), (1.2, 0.1), (1.08, 0.2), (1.04, 0.5), (0.82, 0.88), (0.28, 1.08))

# Le fusil, tenu en travers (au port d'arme) : la main droite à la hanche, la
# gauche en travers de la poitrine, la bouche relevée vers l'épaule gauche.
# Les deux mains restent sur la moitié droite du corps : ce qui dépasse devant
# lui compte presque double dans la largeur de la vue « droite ».
MAIN_DROITE = (-0.16, 0.40, 0.16)
MAIN_GAUCHE = (-0.01, 0.60, 0.17)
FUSIL_AXE = tuple(b - a for a, b in zip(MAIN_DROITE, MAIN_GAUCHE))
FUSIL_ARRIERE = 0.10     # de la main droite au talon de la crosse
FUSIL_AVANT = 0.125      # de la main gauche à la bouche

# Le pas : la jambe gauche en avant, la droite en arrière — les deux jambes se
# lisent, et les bottes restent à plat sur le sol.
PAS = 7.0                # degrés, à la hanche
TIGE_Y = 0.085           # la tige de botte, sur le bas de la jambe
TIGE_HAUTEUR = 0.09

# Le sac, plat sur le dos, et la hampe du fanion plantée dans son coin gauche.
SAC = (0.21, 0.23, 0.09)
SAC_Y = 0.49
HAMPE_BASE = (0.05, 0.56, -0.176)
HAMPE_HAUTEUR = 0.145
FANION = (0.075, 0.11, 0.035)   # longueur, hauteur, épaisseur
R_POMMEAU = 0.028


def unitaire(v):
    return Vector(v).normalized()


def alignement(u):
    """Les rotations (axe, degrés) qui couchent l'axe z d'une boîte le long de `u`."""
    u = unitaire(u)
    elevation = math.degrees(math.asin(max(-1.0, min(1.0, u.y))))
    azimut = math.degrees(math.atan2(u.x, u.z))
    return [('x', -elevation), ('y', azimut)]


def poser_noeud(f, noeud, depuis, vers):
    """
    Pose les pièces d'un nœud : les fait tourner autour de son pivot, de sorte
    que la direction `depuis` (repère du modèle, depuis le pivot) devienne
    `vers`. C'est l'épaule d'une figurine articulée : le bras de la
    bibliothèque, droit, pivote en entier. Le nœud, lui, reste sans rotation
    au repos — la pose est modelée, comme le veut la chaîne.
    """
    n = f.noeuds[noeud]
    q = b.vb(unitaire(depuis)).rotation_difference(b.vb(unitaire(vers)))
    pivot = b.vb(n.pivot)
    m = Matrix.Translation(pivot) @ q.to_matrix().to_4x4() @ Matrix.Translation(-pivot)
    for p in n.pieces:
        p.objet.matrix_world = m @ p.objet.matrix_world


def construire(f):
    f.fantassin(hauteur=HAUTEUR, tetes=TETES, carrure=CARRURE, peau='peau_infanterie', tenue='equipe', bas='graphite',
                couvre_chef=None)

    # --- Le casque rond, repoussé sur la nuque ---------------------------------
    recul = math.radians(CASQUE_RECUL)
    tourne = math.radians(CASQUE_TOURNE)
    axe = Vector((math.sin(recul) * math.sin(tourne), math.cos(recul), -math.sin(recul) * math.cos(tourne)))
    centre_tete = Vector((0.0, Y_TETE, Z_TETE))
    bord = centre_tete + axe * (CASQUE_HAUSSE * R_TETE)
    r = R_TETE
    f.revolution('tete', tuple(bord), [(r * a, r * h) for a, h in CASQUE_PROFIL], 'equipe', axe=tuple(axe), chanfrein=0.02, nom='casque')

    # --- Les bras, posés sur le fusil ---------------------------------------------
    u = unitaire(FUSIL_AXE)
    main_d = Vector(MAIN_DROITE)
    main_g = Vector(MAIN_GAUCHE)
    for noeud, cote, main in (('bras_d', -1, main_d), ('bras_g', 1, main_g)):
        pivot = Vector(f.noeuds[noeud].pivot)
        naturelle = Vector((cote * X_BRAS, Y_MAIN, 0.01))
        poser_noeud(f, noeud, naturelle - pivot, main - pivot)

    # --- Le fusil, tenu en travers : son propre nœud, pivot à la main droite -----
    f.noeud('fusil', parent='corps', pivot=tuple(main_d))
    talon = main_d - u * FUSIL_ARRIERE
    bouche = main_g + u * FUSIL_AVANT
    crosse_long = 0.16
    f.boite('fusil', tuple(talon + u * (crosse_long / 2)), (0.05, 0.068, crosse_long), 'graphite', rotation=alignement(u), nom='crosse')
    corps_long = 0.2
    f.boite('fusil', tuple(talon + u * (crosse_long + corps_long / 2 - 0.02)), (0.05, 0.06, corps_long), 'graphite',
            rotation=alignement(u), nom='fut')
    canon_depart = talon + u * (crosse_long + corps_long - 0.04)
    # Le canon et sa bouche claire, comme ceux des chars : le bout du fusil se voit.
    f.tube('fusil', depart=tuple(canon_depart), direction_tube=tuple(u), longueur=(bouche - canon_depart).length, rayon=0.025,
           teinte='graphite', bouche=True, teinte_bouche='acier_clair', rayon_bouche=0.031, longueur_bouche=0.05, nom='canon')

    # --- Les bottes montantes, le pas, et la ceinture : le sombre tient le bas ---
    r_jambe = max(0.31 * TETE, 0.025)
    for noeud, cote in (('jambe_g', 1), ('jambe_d', -1)):
        f.cylindre(noeud, (cote * 0.3 * TETE, TIGE_Y, 0.0), r_jambe * 1.12, TIGE_HAUTEUR, 'graphite', axe='y', nom=f'tige_{noeud[-1]}')
    # Le pas : la jambe (et sa tige) pivote à la hanche ; la botte suit le pied, à plat.
    for noeud, sens in (('jambe_g', 1), ('jambe_d', -1)):
        n = f.noeuds[noeud]
        angle = math.radians(PAS * sens)
        pivot = Vector(n.pivot)
        rot = Matrix.Rotation(-angle, 3, 'X')   # autour de x du modèle : le pied part vers +z pour un angle positif
        pied = Vector((pivot.x, 0.0, pivot.z))
        pied_pose = pivot + rot @ (pied - pivot)
        decalage = Vector((0.0, 0.0, pied_pose.z - pied.z))
        m_jambe = Matrix.Translation(b.vb(pivot)) @ Matrix.Rotation(-angle, 4, b.vb((1, 0, 0))) @ Matrix.Translation(-b.vb(pivot))
        for p in n.pieces:
            if p.nom.startswith('fantassin_botte'):
                p.objet.matrix_world = Matrix.Translation(b.vb(decalage)) @ p.objet.matrix_world
            else:
                p.objet.matrix_world = m_jambe @ p.objet.matrix_world
    f.boite('corps', (0.0, Y_HANCHE + 0.015, 0.0), (2 * DEMI_TORSE + 0.012, 0.055, EPAIS_TORSE + 0.014), 'graphite', chanfrein=0.025, nom='ceinturon')

    # --- Le sac sur le dos, et le fanion planté dedans ----------------------------
    sx, sy, sz = SAC
    f.boite('corps', (0.0, SAC_Y, -(EPAIS_TORSE / 2 + sz / 2 - 0.012)), SAC, 'graphite', chanfrein=0.03, nom='sac')
    f.noeud('fanion', parent='corps', pivot=HAMPE_BASE)
    f.antenne('fanion', base=HAMPE_BASE, hauteur=HAMPE_HAUTEUR, teinte='graphite', boule=False, nom='hampe')
    # Le pommeau clair, comme au mât des drapeaux du jeu : le haut de la hampe se voit.
    f.boule('fanion', tuple(Vector(HAMPE_BASE) + Vector((0, HAMPE_HAUTEUR + R_POMMEAU * 0.6, 0))), R_POMMEAU, 'os', nom='pommeau')
    # Le fanion flotte vers l'arrière droit : il fait face au joueur en vue « droite ».
    h = Vector((-0.5, 0.0, -0.866))
    lf, hf, ef = FANION
    haut_hampe = Vector(HAMPE_BASE) + Vector((0, HAMPE_HAUTEUR - 0.012, 0))
    centre_fanion = haut_hampe + h * (lf / 2 + 0.01) - Vector((0, hf / 2, 0))
    f.boite('fanion', tuple(centre_fanion), (ef, hf, lf), 'equipe', rotation=[('y', 30.0)], fin=True, nom='fanion')


def enveloppe(t, montee, tenue, retour):
    """Un geste qui s'installe en `montee` secondes (adouci), tient jusqu'à `tenue`, et revient au repos à `retour`."""
    if t <= 0.0:
        return 0.0
    if t < montee:
        return b.lisse(t / montee)
    if t < tenue:
        return 1.0
    if t < retour:
        return 1.0 - b.lisse((t - tenue) / (retour - tenue))
    return 0.0


def pivoter(clip, noeud, depuis, vers, montee, tenue, retour):
    """Fait tourner un nœud de la direction `depuis` vers `vers` (repère du modèle), le temps d'un geste."""
    a, c = unitaire(depuis), unitaire(vers)
    axe = a.cross(c)
    if axe.length < 1e-6:
        return
    degres = math.degrees(a.angle(c))
    clip.rotation(noeud, lambda t: (tuple(axe.normalized()), degres * enveloppe(t, montee, tenue, retour)))


def animer(f):
    u = unitaire(FUSIL_AXE)
    main_d = Vector(MAIN_DROITE)
    epaule_g = Vector(f.noeuds['bras_g'].pivot)
    main_g = Vector(MAIN_GAUCHE)

    # Repos : une respiration, rien d'autre.
    b.respirer(f.clip('repos'), 'corps', amplitude=0.012)

    # Déplacement : le pas, sur place ; le corps dodeline, le fanion claque.
    d = f.clip('deplacement')
    b.balancer(d, 'jambe_g', 'x', 22, periodes=1)
    b.balancer(d, 'jambe_d', 'x', -22, periodes=1)
    b.osciller(d, 'corps', 'y', 0.008, periodes=2)
    b.balancer(d, 'corps', 'z', 2.0, periodes=1)
    b.balancer(d, 'fanion', 'y', 8, periodes=2, phase=0.8)

    # Tir : il abaisse le fusil vers l'avant, tire (le fusil recule, le corps
    # encaisse), et revient au port d'arme.
    t = f.clip('tir')
    vise = unitaire((0.0, 0.34, 0.94))
    pivoter(t, 'fusil', u, vise, 0.12, 0.32, 0.68)
    fut_vise = main_d + vise * 0.24
    pivoter(t, 'bras_g', main_g - epaule_g, fut_vise - epaule_g, 0.12, 0.32, 0.68)
    b.recul(t, 'fusil', tuple(-vise), 0.03, debut=0.18, attaque=0.04, retour=0.22)
    b.a_coup(t, 'corps', 'x', -3.5, debut=0.18, attaque=0.05, retour=0.4)

    # Touché : le soldat vacille, le casque branle, il se tasse.
    k = f.clip('touche')
    b.secousse(k, 'corps', 'x', -7.0, oscillations=2)
    b.secousse(k, 'tete', 'z', 6.0, debut=0.04, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.012)

    # Hors jeu : il s'assoit, jambes en avant, la tête basse ; le fanion retombe.
    h = f.clip('hors_jeu')
    b.affaisser(h, 'corps', descente=(0, -0.22, -0.02), rotation=('x', -12.0))
    b.affaisser(h, 'base', descente=(0, -0.22, 0.0))
    b.affaisser(h, 'jambe_g', rotation=('x', -80.0))
    b.affaisser(h, 'jambe_d', rotation=('x', -75.0))
    b.affaisser(h, 'tete', rotation=('x', 18.0), debut=0.3, duree=0.5)
    b.affaisser(h, 'fanion', rotation=('z', 35.0), debut=0.2, duree=0.5)

    # Capture : il saute, lève le poing, et le fanion se dresse et claque.
    c = f.clip('capture')
    for noeud in ('corps', 'base'):
        b.sursaut(c, noeud, 'y', 0.05, duree=0.5)
    pivoter(c, 'bras_g', main_g - epaule_g, (-0.2, 0.55, 0.81), 0.25, 0.9, 1.3)
    c.translation('fanion', lambda s: (0.0, 0.05 * enveloppe(s, 0.2, 0.95, 1.3), 0.0))
    b.balancer(c, 'fanion', 'y', 10, periodes=3)
