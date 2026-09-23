"""
L'hélicoptère d'attaque : un requin de jouet, en vol stationnaire.

Ce qui le dit à 48 pixels : un fuselage fin à la couleur du camp, au nez
pointu et un peu tombant vers la droite (la forme du requin, aucune dent
peinte), une bulle de verre, une barre de rotor à deux pales franches
par-dessus, deux paniers de roquettes sombres aux bouts clairs sous des
ailettes, des patins sombres dessous, et la poutre qui remonte vers la gauche
jusqu'à sa dérive et son petit rotor de queue. Un seul rotor : le transport
d'assaut en a deux en tandem, les drones quatre.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.
"""

import math

from mathutils import Matrix

import bibliotheque as b

#: Le milieu de la classe moyenne.
LARGEUR_VISEE = (0.78, 0.82)

# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

ALT = 0.20                    # bas des patins au repos (charte : rotors à 0,20 m)

# Le fuselage : un seul fuseau, de la poutre de queue au nez.
Z_QUEUE = -0.37               # bout de la poutre (caché dans la dérive)
Z_POUTRE = -0.16              # où la poutre s'évase en corps
Z_CORPS = -0.03               # début du corps plein
Z_NEZ_DEBUT = 0.13            # où le nez commence à s'effiler
Z_NEZ = 0.40                  # la pointe
Y_AXE = 0.415                 # la ligne la plus large du corps (le dos au-dessus, la carène dessous)
DEMI_LARGEUR = 0.10
HAUT_DOS = 0.07               # du flanc le plus large au sommet du dos
HAUT_CARENE = 0.10            # du flanc le plus large au fond de la carène
Y_POINTE = 0.345              # la pointe tombe un peu : le museau du requin
R_POUTRE_AV = 0.045
R_POUTRE_AR = 0.032
Y_POUTRE_AV = 0.43
Y_POUTRE_AR = 0.455
#: La section : un dos en ellipse aplatie, une carène en V dessous. Les flancs
#: de la carène regardent le sol à 45° : la caméra, à 50°, ne les voit pas, et
#: l'équipe se lit sur le dos, qui prend la lumière.
EXPOSANT_DOS = 2.0
EXPOSANT_CARENE = 1.0

# Le rotor principal.
Z_MAT = 0.01
Y_ROTOR = 0.54
RAYON_ROTOR = 0.34
LARGEUR_PALE = 0.05
EPAISSEUR_PALE = 0.03
#: L'angle des pales au repos, depuis l'avant vers la gauche du modèle : à 30°,
#: elles sont exactement horizontales dans la vue « droite » (lacet 60°).
ANGLE_PALES = 30.0
#: Au départ du déplacement, les pales passent en travers (90°) : presque
#: horizontales dans les vues « bas » et « haut », qui montrent ce clip.
DECALAGE_DEPLACEMENT = 60.0

# Le rotor de queue, sur le flanc droit de la dérive (celui que montre la vue « droite »).
X_ROTOR_QUEUE = -0.05
Y_ROTOR_QUEUE = 0.49
Z_ROTOR_QUEUE = -0.36
RAYON_ROTOR_QUEUE = 0.06

# Les ailettes et les paniers.
Y_AILE = 0.35
Z_AILE = 0.11                 # bord d'attaque à l'emplanture
X_PANIER = 0.175
Y_PANIER = 0.30
Z_PANIER = 0.045
R_PANIER = 0.048
L_PANIER = 0.19

# Les patins.
X_PATIN = 0.075
R_PATIN = 0.03
Z_PATIN = (-0.16, 0.24)
Z_JAMBES = (-0.06, 0.13)

#: Le flou de bouge de la cuisson (`FLOU_DE_BOUGE`, scripts/sprites/reglages.ts) :
#: l'obturateur reste ouvert cette part du pas entre deux images, centré sur l'instant.
FLOU_DE_BOUGE = 0.5


# ---------------------------------------------------------------------------
# Aides locales
# ---------------------------------------------------------------------------

def _lisse(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def _mix(a, c, t):
    return a + (c - a) * t


def _profil(z):
    """La section du fuselage à l'abscisse z : (demi-largeur, ligne la plus large, hauteur du dos, hauteur de la carène)."""
    if z <= Z_POUTRE:
        t = (z - Z_QUEUE) / (Z_POUTRE - Z_QUEUE)
        r = _mix(R_POUTRE_AR, R_POUTRE_AV, t)
        return r, _mix(Y_POUTRE_AR, Y_POUTRE_AV, t), r, r
    if z <= Z_CORPS:
        t = _lisse((z - Z_POUTRE) / (Z_CORPS - Z_POUTRE))
        return (_mix(R_POUTRE_AV, DEMI_LARGEUR, t), _mix(Y_POUTRE_AV, Y_AXE, t),
                _mix(R_POUTRE_AV, HAUT_DOS, t), _mix(R_POUTRE_AV, HAUT_CARENE, t))
    if z <= Z_NEZ_DEBUT:
        return DEMI_LARGEUR, Y_AXE, HAUT_DOS, HAUT_CARENE
    # Le nez : le dos plonge vers la pointe, la carène reste droite longtemps.
    u = min(1.0, (z - Z_NEZ_DEBUT) / (Z_NEZ - Z_NEZ_DEBUT))
    a = max(0.006, DEMI_LARGEUR * (1 - u ** 1.8) ** 0.75)
    haut = Y_POINTE + 0.005 + (Y_AXE + HAUT_DOS - Y_POINTE - 0.005) * (1 - u ** 1.6) ** 0.9
    bas = Y_POINTE - 0.005 - (Y_POINTE - 0.005 - (Y_AXE - HAUT_CARENE)) * (1 - u ** 2.6) ** 0.8
    milieu = _mix(Y_AXE, Y_POINTE, _lisse(u))
    return a, milieu, max(0.004, haut - milieu), max(0.004, milieu - bas)


def fuseau(f, noeud, teinte, profil, z0, z1, sections=64, exposants=(2.0, 2.0), nom='fuseau'):
    """
    Un fuseau lissé le long de z : à chaque abscisse, une section faite de deux
    demi-superellipses (`exposants` : le dessus, le dessous ; 2 : une ellipse,
    plus : plus carrée, moins : en pointe), donnée par `profil(z)` →
    (demi-largeur, ligne la plus large, hauteur au-dessus, hauteur au-dessous).
    Sans chanfrein : c'est une surface lisse, comme le `fuselage` de la bibliothèque.
    """
    profils = [profil(z0 + (z1 - z0) * k / sections) for k in range(sections + 1)]
    amax = max(p[0] for p in profils)
    hmax = max(p[2] + p[3] for p in profils) / 2
    n = b.segments_cercle(max(amax, hmax))
    unite = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        e = 2.0 / (exposants[0] if s >= 0 else exposants[1])
        unite.append((math.copysign(abs(c) ** e, c), math.copysign(abs(s) ** e, s)))
    ss = []
    for k, (a, ym, hh, hb) in enumerate(profils):
        z = z0 + (z1 - z0) * k / sections
        ss.append((-z, [(a * ux, ym + (hh if uy >= 0 else hb) * uy) for ux, uy in unite]))
    bm = b.bm_loft(ss)
    ys = [ym + hh for _, ym, hh, _ in profils] + [ym - hb for _, ym, _, hb in profils]
    dims = (2 * amax, max(ys) - min(ys), z1 - z0)
    return f._piece(bm, noeud, teinte, Matrix.Identity(4), dims, arrondir=False, nom=nom)


def bulle(f, noeud, centre, rayons, teinte='verre', nom='verriere'):
    """Une bulle (ellipsoïde) dont le reflet peint tient le tiers haut : les UV suivent la hauteur."""
    rx, ry, rz = rayons
    r = max(rayons)
    bm = b.bm_boule(r, (rx / r, rz / r, ry / r))
    return f._piece(bm, noeud, teinte, f._placement(centre), (2 * rx, 2 * ry, 2 * rz), arrondir=False, uv='hauteur', nom=nom)


def rotor_a_pales(f, noeud, centre, rayon, pales, largeur, epaisseur, angle, plan='y', moyeu=0.045, nom='rotor'):
    """
    Un rotor à `pales` pales opaques, la première à `angle` degrés : autour de
    y (le rotor principal, l'angle compté de l'avant vers la gauche) ou de x
    (le rotor de queue, l'angle compté de l'avant vers le haut). Le moyeu est
    os, les pales graphite. Le nœud est marqué tournant.
    """
    f.noeud(noeud, pivot=centre, tournant=True)
    cx, cy, cz = centre
    pieces = [f.cylindre(noeud, centre, moyeu, max(0.05, 1.6 * epaisseur), 'os', axe=plan, nom=f'{nom}_moyeu')]
    longueur = rayon - moyeu * 0.6
    for k in range(pales):
        a = angle + 360.0 * k / pales
        r = moyeu * 0.6 + longueur / 2
        ra = math.radians(a)
        if plan == 'y':
            d = (math.sin(ra), 0.0, math.cos(ra))
            taille = (largeur, epaisseur, longueur)
            rotation = [('y', a)]
        else:
            d = (0.0, math.sin(ra), math.cos(ra))
            taille = (epaisseur, largeur, longueur)
            rotation = [('x', -a)]
        c = (cx + d[0] * r, cy + d[1] * r, cz + d[2] * r)
        pieces.append(f.boite(noeud, c, taille, 'graphite', rotation=rotation, fin=True, nom=f'{nom}_pale_{k + 1}'))
    return pieces


def instants_cuisson(duree, boucle):
    """Les instants que la cuisson photographie (`scripts/sprites/echantillonnage.ts`, recopié)."""
    if duree <= 0:
        return [0.0]
    if boucle:
        n = max(1, min(b.IMAGES_MAX_PAR_CLIP, round(duree * b.IMAGES_PAR_SECONDE)))
        return [k * duree / n for k in range(n)]
    n = max(2, min(b.IMAGES_MAX_PAR_CLIP, math.ceil(duree * b.IMAGES_PAR_SECONDE - 1e-9) + 1))
    return [k * duree / (n - 1) for k in range(n)]


def tourner_par_crans(clip, noeud, axe, crans):
    """
    Un rotor qui tourne **par crans**, calés sur les images de la cuisson :
    immobile pendant que l'obturateur est ouvert autour de chaque instant
    photographié, il franchit son cran entre deux images, dans un intervalle
    de clés que l'obturateur ne voit pas. Chaque image montre des pales nettes,
    jamais l'éventail flou qu'un rotor continu laisse sous le flou de bouge.

    `crans` : un nombre (degrés par image, constants) ou la liste des angles
    absolus de chaque image. Un clip qui boucle doit revenir à un tour entier.
    """
    temps = instants_cuisson(clip.duree, clip.boucle)
    n = len(temps)
    if isinstance(crans, (int, float)):
        angles = [crans * k for k in range(n + 1)]
    else:
        angles = list(crans) + [crans[-1]] * (n + 1 - len(crans))
    if clip.boucle and abs(((angles[n] - angles[0]) / 360.0) - round((angles[n] - angles[0]) / 360.0)) > 1e-9:
        raise ValueError(f'{clip.nom} boucle : le rotor {noeud} doit faire des tours entiers ({angles[n] - angles[0]}°)')
    pas = temps[1] - temps[0] if n > 1 else clip.duree
    demi = FLOU_DE_BOUGE * pas / 2
    cle = 1.0 / b.FREQUENCE_CLES
    bascules = []
    for k in range(n if clip.boucle else n - 1):
        suivant = temps[k + 1] if k + 1 < n else clip.duree
        # La première clé après la fermeture de l'obturateur (et un dixième de clé de marge).
        s = math.ceil((temps[k] + demi) / cle + 0.1) * cle
        if s + cle > suivant - demi + 1e-6:
            raise ValueError(f'{clip.nom} : pas de place pour un cran entre deux images ({pas * 1000:.1f} ms)')
        bascules.append(s)

    def f(t):
        k = sum(1 for s in bascules if t > s + 1e-6)
        return (axe, angles[k])

    clip.rotation(noeud, f)
    clip.figurine.noeuds[noeud].axe_tour = axe


# ---------------------------------------------------------------------------
# La figurine
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds. Le canon dit « base : rotor » : la base est le rotor principal,
    # accroché au corps pour pencher avec lui. Les paniers sont le module nacelle.
    f.noeud('corps', pivot=(0, Y_AXE, 0))
    f.noeud('base', parent='corps')
    f.noeud('module_nacelle', parent='corps', pivot=(0, Y_PANIER, Z_PANIER))
    f.noeud('socle', pivot=(0, 0, 0))

    # Le fuselage : poutre, corps et nez de requin d'un seul tenant, à la couleur du camp.
    fuseau(f, 'corps', 'equipe', _profil, Z_QUEUE, Z_NEZ, sections=72, exposants=(EXPOSANT_DOS, EXPOSANT_CARENE), nom='fuselage')

    # Le carénage du moteur, sous le mât : un dos bombé, à la couleur du camp.
    haut_corps = Y_AXE + HAUT_DOS
    f.boule('corps', (0, haut_corps - 0.015, Z_MAT - 0.035), 0.1, 'equipe', etirement=(0.72, 0.42, 1.0), nom='carenage')

    # La bulle de verre, sur l'avant du dos : petite, pour ne pas faire un trou noir.
    bulle(f, 'corps', (0, haut_corps - 0.03, 0.14), (0.052, 0.06, 0.105))

    # La dérive, au bout de la poutre, en flèche.
    f.prisme('corps', [(-0.405, 0.44), (-0.325, 0.44), (-0.362, 0.58), (-0.41, 0.58)], 0.05, 'equipe', nom='derive')

    # Les ailettes, et sous leurs bouts les deux paniers de roquettes.
    f.aile('corps', emplanture=(0, Y_AILE, Z_AILE), envergure=0.42, corde=0.16, epaisseur=0.05, teinte='equipe',
           fleche=8, effilement=0.85, diedre=-3, nom='ailette')
    for cote in (1, -1):
        x = cote * X_PANIER
        c = 'g' if cote > 0 else 'd'
        f.cylindre('module_nacelle', (x, Y_PANIER, Z_PANIER), R_PANIER, L_PANIER, 'graphite', axe='z', nom=f'panier_{c}')
        # Les têtes des roquettes : un bouchon clair qui dépasse de 2 cm (5 cm de long, l'épaisseur minimale).
        f.cylindre('module_nacelle', (x, Y_PANIER, Z_PANIER + L_PANIER / 2 - 0.005), R_PANIER * 0.78, 0.05, 'os', axe='z',
                   nom=f'roquettes_{c}')

    # Les patins, et leurs jambes qui remontent en biais jusqu'à la carène.
    zp0, zp1 = Z_PATIN
    y_patin = ALT + R_PATIN
    for cote in (1, -1):
        x = cote * X_PATIN
        c = 'g' if cote > 0 else 'd'
        f.capsule('corps', (x, y_patin, (zp0 + zp1) / 2), R_PATIN, zp1 - zp0, 'graphite', axe='z', nom=f'patin_{c}')
        for i, zj in enumerate(Z_JAMBES):
            haut = (cote * 0.03, Y_AXE - HAUT_CARENE * 0.55, zj)
            bas = (x, y_patin, zj)
            d = tuple(h - l for h, l in zip(haut, bas))
            lg = math.sqrt(sum(v * v for v in d))
            milieu = tuple((h + l) / 2 for h, l in zip(haut, bas))
            f.capsule('corps', milieu, 0.025, lg, 'graphite', axe=d, nom=f'jambe_{c}_{i}')

    # Le pylône (à la couleur du camp, avec le carénage) et le rotor principal :
    # deux pales opaques, franches, larges.
    f.cylindre('corps', (0, Y_ROTOR - 0.04, Z_MAT), 0.03, 0.05, 'equipe', axe='y', nom='pylone')
    rotor_a_pales(f, 'base', (0, Y_ROTOR, Z_MAT), RAYON_ROTOR, 2, LARGEUR_PALE, EPAISSEUR_PALE, ANGLE_PALES, plan='y',
                  moyeu=0.04, nom='rotor')

    # Le rotor de queue, sur le flanc droit de la dérive.
    f.noeud('rotor_queue', parent='corps')
    rotor_a_pales(f, 'rotor_queue', (X_ROTOR_QUEUE, Y_ROTOR_QUEUE, Z_ROTOR_QUEUE), RAYON_ROTOR_QUEUE, 2, 0.035, 0.03, 20.0,
                  plan='x', moyeu=0.028, nom='rotor_queue')


def animer(f):
    # Repos : le fuselage ne bouge pas ; seuls les rotors tournent, par crans nets.
    r = f.clip('repos')
    tourner_par_crans(r, 'base', 'y', 60.0)
    tourner_par_crans(r, 'rotor_queue', 'x', 90.0)

    # Déplacement : il pique du nez pour avancer, et se balance à peine. Les
    # pales partent en travers, pour les vues « bas » et « haut ».
    d = f.clip('deplacement')
    n = len(instants_cuisson(d.duree, d.boucle))
    tourner_par_crans(d, 'base', 'y', [DECALAGE_DEPLACEMENT + 60.0 * k for k in range(n + 1)])
    tourner_par_crans(d, 'rotor_queue', 'x', 90.0)
    d.rotation('corps', lambda t: ('x', 6.0))
    b.balancer(d, 'corps', 'z', 1.2, periodes=1)
    b.osciller(d, 'corps', 'y', 0.006, periodes=1)

    # Tir : les paniers reculent sous le départ des roquettes ; l'appareil
    # recule d'un pas et se cabre un instant, puis se reprend.
    t = f.clip('tir')
    tourner_par_crans(t, 'base', 'y', 60.0)
    tourner_par_crans(t, 'rotor_queue', 'x', 90.0)
    b.recul(t, 'module_nacelle', '-z', 0.05, attaque=0.05, retour=0.35)
    b.recul(t, 'corps', '-z', 0.03, attaque=0.07, retour=0.45)
    b.a_coup(t, 'corps', 'x', -6.0, attaque=0.07, retour=0.45)

    # Touché : l'appareil roule, vacille et se tasse, puis se reprend.
    k = f.clip('touche')
    tourner_par_crans(k, 'base', 'y', 60.0)
    tourner_par_crans(k, 'rotor_queue', 'x', 90.0)
    b.secousse(k, 'corps', 'z', 9.0, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.03)

    # Hors jeu : le rotor ralentit et s'arrête (d'un demi-tour : ses pales
    # retombent en travers, comme au repos), l'appareil s'affaisse de biais, le nez bas.
    h = f.clip('hors_jeu')
    tourner_par_crans(h, 'base', 'y', [0, 50, 90, 120, 140, 155, 166, 173, 177, 179, 180, 180])
    tourner_par_crans(h, 'rotor_queue', 'x', [0, 60, 100, 130, 150, 160, 168, 174, 178, 180, 180, 180])
    b.affaisser(h, 'corps', descente=(0, -0.12, 0), rotation=('z', 12.0))
    b.affaisser(h, 'corps', rotation=('x', 7.0), debut=0.1, duree=0.7)
