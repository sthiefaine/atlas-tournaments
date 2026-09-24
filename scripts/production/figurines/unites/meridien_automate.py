"""
L'automate de combat méridien : le seul robot de la boîte, celui que la
superusine des Gris crache chaque jour — l'unité dont on se souvient.

Ce qui le dit à 48 pixels : un robot trapu sur deux jambes courtes, pieds
larges bien plantés ; une tête-capteur d'apprêt à facettes, tournée vers le
joueur, portant **un seul gros œil orange** serti dans une monture sombre (le
signe, lisible dans les trois vues) ; un torse carré à facettes et deux
épaulières à la couleur du camp, le chevron orange sur celle de droite ; au
bras gauche un **canon** épais qui pointe vers l'adversaire, à droite en vue
« droite » ; au bras droit une pince levée en garde. Les Gris parlent leur
langue : apprêt au lieu du graphite sur la tête, les articulations et les
cuisses ; octogones et hexagones partout (torse, tête, épaulières, tibias,
genouillères, fût du canon, réacteur). Classe moyenne, haut de fourchette :
0,80 à 0,84 case de large en vue « droite », contour compris.

Repère (celui de la fiche) : x à gauche du modèle, y en haut, z vers l'avant.

Ce que la mesure a tranché :

- **Les dessus portent l'équipe.** Mesurée sur une sphère d'équipe cuite, la
  lumière passe 0,8 dès qu'une facette est couchée à 50° de la verticale (40°
  si elle regarde la caméra), jamais debout. Le torse et les épaulières sont
  donc des coques à facettes — une bande droite courte, puis des biseaux à 45°
  et à 60° — et non des boîtes : un premier torse à flancs droits laissait
  49 % de l'équipe éclairée, la coque en donne 68 à 70 %.
- **Le canon au bras gauche**, loin de la caméra en vue « droite » : il y sort
  en haut à droite de la silhouette, net ; porté par le bras proche, il
  descendait à l'écran et barrait les jambes (vue plongeante à 50°).
- **La pince levée en garde** : pendante, elle disparaissait sous
  l'épaulière ; levée à 35°, elle se lit devant le bas du torse.
- **La tête tournée de 30° vers la droite du robot** — le joueur, en vue
  « droite » —, comme le casque des fantassins : l'œil se voit de face en vue
  « droite » et « bas », de profil en vue « haut ».
- **Le réacteur au dos**, un tambour hexagonal couché : il donne la
  profondeur qui fait la largeur de la classe (la longueur compte presque
  double en vue « droite ») sans allonger le torse, dont le profil — l'écran
  de combat — se lisait sinon comme une soucoupe.
- **Trois articulations par jambe** (hanche, genou, cheville) : la marche
  plie le genou qui avance et garde le pied à plat ; hors jeu, il tombe
  vraiment à genoux, tibias couchés, pieds glissés à plat dessous.
"""

import math

import bibliotheque as b

#: Le haut de la classe moyenne : l'automate vaut un char moyen.
LARGEUR_VISEE = (0.80, 0.84)


# ---------------------------------------------------------------------------
# Aides de forme (locales : la bibliothèque n'a pas de coque à facettes)
# ---------------------------------------------------------------------------

def octogone(hx, hz, c, cx=0.0, cz=0.0):
    """Un octogone vu de dessus, demi-côtés `hx`, `hz`, coins coupés de `c` : points (x, z), dans le sens de `contour_rectangle`."""
    return [(cx - hx, cz + hz - c), (cx - hx, cz - hz + c), (cx - hx + c, cz - hz), (cx + hx - c, cz - hz),
            (cx + hx, cz - hz + c), (cx + hx, cz + hz - c), (cx + hx - c, cz + hz), (cx - hx + c, cz + hz)]


def hexagone(r, angle0=0.0, ex=1.0, ez=1.0):
    """Six points (a, b) sur un cercle de rayon `r`, étirés par `ex`, `ez`, le premier à `angle0` degrés."""
    return [(ex * r * math.cos(math.radians(angle0 + 60 * k)), ez * r * math.sin(math.radians(angle0 + 60 * k))) for k in range(6)]


def pile(f, noeud, centre, sections, teinte, lacet=0.0, nom=None):
    """Un solide à sections horizontales (y, contour (x, z)) posé à `centre`, tourné de `lacet` degrés autour de y."""
    anneaux = [[(x, y, z) for x, z in contour] for y, contour in sections]
    return f.solide(noeud, anneaux, teinte, origine=centre, rotation=[('y', lacet)] if lacet else None, nom=nom)


def coque(hx, hz, c, cz, pied, bande, biseaux):
    """
    Les sections d'une coque à facettes, de bas en haut : un pied rentré de
    `pied` (le chanfrein du dessous, que la caméra ne voit pas), une bande
    droite de `bande`, puis des biseaux (montée, retrait) — couchés à 45° et
    plus, ce sont eux qui prennent la lumière.
    """
    s = [(0.0, octogone(hx - pied, hz - pied, c * (1 - pied / hx), cz=cz)), (pied, octogone(hx, hz, c, cz=cz)),
         (pied + bande, octogone(hx, hz, c, cz=cz))]
    y, r = pied + bande, 0.0
    for montee, retrait in biseaux:
        y += montee
        r += retrait
        s.append((y, octogone(hx - r, hz - r, c * (1 - r / hx), cz=cz)))
    return s


def fut(f, noeud, origine, z0, z1, r, teinte, rotation=None, nom=None):
    """Un fût hexagonal couché le long de z (repère local depuis `origine`, de z0 à z1), tourné par `rotation` autour d'elle."""
    anneau = hexagone(r)
    return f.solide(noeud, [[(a, bb, z) for a, bb in anneau] for z in (z0, z1)], teinte, origine=origine, rotation=rotation, nom=nom)


def tambour(f, noeud, y, z, x0, x1, r, teinte, nom=None):
    """Un tambour hexagonal couché le long de x, pointe en haut : ses deux pans hauts, couchés à 60°, prennent la lumière."""
    anneau = [(y + py, z + pz) for pz, py in hexagone(r, 30.0)]
    return f.solide(noeud, [[(x, py, pz) for py, pz in anneau] for x in (x0, x1)], teinte, nom=nom)


def tourner_y(p, centre, degres):
    """Le point `p` tourné de `degres` autour de l'axe y passant par `centre`, dans le sens de la bibliothèque : + porte l'avant vers la gauche."""
    a = math.radians(degres)
    dx, dz = p[0] - centre[0], p[2] - centre[2]
    return (centre[0] + dx * math.cos(a) + dz * math.sin(a), p[1], centre[2] - dx * math.sin(a) + dz * math.cos(a))


def chevron(cx, cz, largeur, longueur, trait):
    """Un chevron vu de dessus, la pointe vers l'avant : six points (x, z), concave."""
    w = largeur / 2
    z0 = cz - longueur / 2
    return [(cx - w, z0 + trait), (cx - w, z0), (cx, z0 + longueur - trait), (cx + w, z0), (cx + w, z0 + trait), (cx, z0 + longueur)]


# ---------------------------------------------------------------------------
# Les cotes, en mètres
# ---------------------------------------------------------------------------

# Les jambes : hanche, genou, cheville ; la gauche avance d'un demi-pas, les
# deux jambes se séparent ainsi en vue « droite ».
X_JAMBE = 0.145
PAS = 0.03
Y_HANCHE = 0.315
Y_GENOU = 0.19
Y_CHEVILLE = 0.062
DZ_GENOU = 0.012          # le genou un peu en avant : la jambe est fléchie
R_CUISSE = 0.048

# Le torse : une coque octogonale, bande droite de 9,5 cm, biseaux à 45° puis 60°.
TAILLE_Y = 0.34           # le bas du torse
TORSE_Z = -0.06
TORSE_HX, TORSE_HZ = 0.19, 0.16
TORSE = coque(TORSE_HX, TORSE_HZ, 0.065, TORSE_Z, 0.02, 0.095, [(0.045, 0.045), (0.035, 0.06)])
DESSUS = TAILLE_Y + TORSE[-1][0]
Z_REACTEUR = TORSE_Z - TORSE_HZ - 0.047

# La tête : un octogone d'apprêt, tourné vers le joueur ; l'œil dans sa monture.
TETE_LACET = -30.0
TETE_CENTRE = (0.0, DESSUS + 0.02, -0.02)
TETE = [(0.0, octogone(0.085, 0.075, 0.032)), (0.025, octogone(0.105, 0.095, 0.042)), (0.125, octogone(0.105, 0.095, 0.042)),
        (0.165, octogone(0.06, 0.05, 0.022))]
Y_OEIL = 0.075            # au-dessus du bas de la tête
R_OEIL = 0.059            # 0,118 case : 5,7 px à 48 px par case
COU = (0.0, DESSUS - 0.03, -0.02)
ANTENNE = tourner_y((0.06, TETE_CENTRE[1] + 0.14, TETE_CENTRE[2] - 0.03), TETE_CENTRE, TETE_LACET)

# Les bras : le canon à gauche, la pince à droite, levée en garde.
EPAULE_G = (0.21, 0.49, -0.04)
COUDE_G = (0.255, 0.425, 0.0)
EPAULE_D = (-0.21, 0.49, -0.04)
COUDE_D = (-0.265, 0.4, -0.03)
GARDE = 35.0              # degrés : l'avant-bras de la pince levé vers l'avant


def jambe(cote):
    """Les pivots (hanche, genou, cheville) d'une jambe ; `cote` 1 à gauche, −1 à droite."""
    x, z = cote * X_JAMBE, cote * PAS
    return (x, Y_HANCHE, z), (x, Y_GENOU, z + DZ_GENOU), (x, Y_CHEVILLE, z)


# ---------------------------------------------------------------------------
# La construction
# ---------------------------------------------------------------------------

def construire(f):
    # Les nœuds : la fiche donne racine, corps, base, socle (vide), et les
    # modules — le torse (`module_tourelle`), le canon (`module_canon_long`),
    # l'antenne de la tête (`module_antenne`). Les jambes pendent de `base`,
    # articulées ; les bras, la tête pendent du torse.
    f.noeud('base', pivot=(0, 0, 0))
    f.noeud('socle', pivot=(0, 0, 0))
    f.noeud('corps', pivot=(0, Y_HANCHE, 0))
    f.noeud('module_tourelle', parent='corps', pivot=(0, TAILLE_Y, TORSE_Z))
    f.noeud('tete', parent='module_tourelle', pivot=COU)
    f.noeud('module_antenne', parent='tete', pivot=ANTENNE)
    f.noeud('epaule_g', parent='module_tourelle', pivot=EPAULE_G)
    f.noeud('module_canon_long', parent='epaule_g', pivot=COUDE_G)
    f.noeud('epaule_d', parent='module_tourelle', pivot=EPAULE_D)
    f.noeud('pince', parent='epaule_d', pivot=COUDE_D)
    for s, cote in (('g', 1), ('d', -1)):
        hanche, genou, cheville = jambe(cote)
        f.noeud(f'hanche_{s}', parent='base', pivot=hanche)
        f.noeud(f'genou_{s}', parent=f'hanche_{s}', pivot=genou)
        f.noeud(f'cheville_{s}', parent=f'genou_{s}', pivot=cheville)

    # --- Les jambes : cuisse d'apprêt, genouillère d'équipe, tibia et pied graphite ---
    for s, cote in (('g', 1), ('d', -1)):
        (x, yh, zh), (_, yg, zg), (_, yc, zc) = jambe(cote)
        f.boule(f'hanche_{s}', (x, yh, zh), 0.052, 'appret', nom=f'rotule_hanche_{s}')
        f.membre(f'hanche_{s}', (x, yh, zh), (x, yg, zg), R_CUISSE, 'appret', nom=f'cuisse_{s}')
        pile(f, f'genou_{s}', (x, yc - 0.012, zc + 0.006), [(0.0, octogone(0.06, 0.058, 0.024)), (yg - yc - 0.01, octogone(0.052, 0.05, 0.02))],
             'graphite', nom=f'tibia_{s}')
        # La genouillère : un bouclier hexagonal posé sur le genou, le dessus en pente.
        pile(f, f'genou_{s}', (x, yg - 0.014, zg + 0.012),
             [(0.0, hexagone(0.075, 90.0, ez=0.9)), (0.028, hexagone(0.075, 90.0, ez=0.9)), (0.066, hexagone(0.03, 90.0, ez=0.9))], 'equipe',
             nom=f'genouillere_{s}')
        # Le pied : une semelle large, pointe en avant ; il a sa cheville, il reste à plat.
        profil = [(zc - 0.095, 0.0), (zc + 0.145, 0.0), (zc + 0.165, 0.03), (zc + 0.11, 0.062), (zc - 0.08, 0.062), (zc - 0.1, 0.03)]
        f.prisme(f'cheville_{s}', profil, 0.125, 'graphite', centre_x=x, nom=f'pied_{s}')

    # --- Le bassin graphite, et la taille d'apprêt qui détache le torse ---
    pile(f, 'corps', (0, Y_HANCHE - 0.04, 0.0), [(0.0, octogone(0.1, 0.08, 0.03)), (0.06, octogone(0.13, 0.095, 0.035)), (0.08, octogone(0.12, 0.09, 0.03))],
         'graphite', nom='bassin')
    f.cylindre('module_tourelle', (0, TAILLE_Y - 0.005, TORSE_Z + 0.02), 0.1, 0.05, 'appret', axe='y', nom='taille')

    # --- Le torse, et le réacteur couché au dos, capots d'apprêt ---
    pile(f, 'module_tourelle', (0, TAILLE_Y, 0.0), TORSE, 'equipe', nom='torse')
    reacteur = tambour(f, 'module_tourelle', TAILLE_Y + 0.1, Z_REACTEUR, -0.1, 0.1, 0.08, 'equipe', nom='reacteur')
    for cote in (1, -1):
        capot = tambour(f, 'module_tourelle', TAILLE_Y + 0.1, Z_REACTEUR, cote * 0.09, cote * 0.125, 0.062, 'appret',
                        nom=f'capot_{"g" if cote > 0 else "d"}')
        capot.avec = reacteur.nom

    # --- La tête : l'œil orange unique, serti dans une monture graphite ---
    cx, cy, cz = TETE_CENTRE
    f.cylindre('tete', (COU[0], (COU[1] + cy + 0.02) / 2, COU[2]), 0.045, cy + 0.02 - COU[1], 'appret', axe='y', nom='cou')
    crane = pile(f, 'tete', TETE_CENTRE, TETE, 'appret', lacet=TETE_LACET, nom='tete')
    monture = f.solide('tete', [[(a, Y_OEIL + bb, z) for a, bb in hexagone(0.074)] for z in (0.084, 0.118)], 'graphite',
                       origine=TETE_CENTRE, rotation=[('y', TETE_LACET)], nom='monture')
    monture.avec = crane.nom
    f.boule('tete', tourner_y((cx, cy + Y_OEIL, cz + 0.124), TETE_CENTRE, TETE_LACET), R_OEIL, 'orange', nom='oeil')
    f.antenne('module_antenne', base=ANTENNE, hauteur=0.09)

    # --- Les épaulières : deux coques à facettes ; le chevron sur celle de
    # droite, qu'on voit dans les trois vues ---
    for s, (ex, ey, ez), cote in (('d', EPAULE_D, -1), ('g', EPAULE_G, 1)):
        base = (ex + cote * 0.047, ey - 0.03, ez)
        ep = pile(f, f'epaule_{s}', base, [(0.0, octogone(0.075, 0.105, 0.03)), (0.02, octogone(0.092, 0.122, 0.036)), (0.06, octogone(0.092, 0.122, 0.036)),
                                           (0.098, octogone(0.05, 0.08, 0.02))], 'equipe', nom=f'epauliere_{s}')
        f.boule(f'epaule_{s}', (ex, ey, ez), 0.05, 'appret', nom=f'rotule_epaule_{s}')
        if s == 'd':
            dessus = base[1] + 0.098
            chev = f.extrusion('epaule_d', chevron(base[0], ez + 0.005, 0.096, 0.104, 0.044), None, dessus - 0.016, dessus + 0.018, 'orange', nom='chevron')
            chev.avec = ep.nom

    # --- Le bras gauche, loin de la caméra en vue droite : le canon ---
    f.membre('epaule_g', EPAULE_G, COUDE_G, 0.042, 'appret', nom='bras_g')
    kx, ky, kz = COUDE_G
    fut(f, 'module_canon_long', COUDE_G, -0.07, 0.16, 0.066, 'graphite', nom='affut')
    f.tube('module_canon_long', depart=(kx, ky, kz + 0.14), direction_tube=(0, 0, 1), longueur=0.19, rayon=0.034, teinte='graphite',
           bouche=True, teinte_bouche='acier_clair', rayon_bouche=0.042, longueur_bouche=0.05, nom='canon')

    # --- Le bras droit, du côté de la caméra : la pince, levée en garde ---
    f.membre('epaule_d', EPAULE_D, COUDE_D, 0.042, 'appret', nom='bras_d')
    garde = [('x', -GARDE)]
    fut(f, 'pince', COUDE_D, -0.035, 0.13, 0.052, 'appret', rotation=garde, nom='avant_bras_d')
    for sens, nom in ((1, 'machoire_haut'), (-1, 'machoire_bas')):
        profil = [(0.11, sens * 0.006), (0.18, sens * 0.056), (0.265, sens * 0.036), (0.255, sens * 0.008), (0.18, sens * 0.024), (0.12, -sens * 0.02)]
        if sens < 0:
            profil = list(reversed(profil))
        f.prisme('pince', profil, 0.052, 'graphite', origine=COUDE_D, rotation=garde, nom=nom)


# ---------------------------------------------------------------------------
# Les gestes
# ---------------------------------------------------------------------------

def animer(f):
    # Repos : la machine respire, le torse monte et descend de 3 mm. Rien d'autre.
    b.osciller(f.clip('repos'), 'module_tourelle', 'y', 0.003, periodes=1)

    # Déplacement : la marche, sur place. Chaque jambe avance et recule d'un
    # bloc ; celle qui avance plie le genou et lève le pied ; le pied reste
    # parallèle au sol. Le corps descend quand les jambes s'écartent (la jambe
    # tendue qui porte garde son pied au sol) et roule d'une hanche sur l'autre.
    d = f.clip('deplacement')
    T = d.duree
    AMPLITUDE, FLEXION = 18.0, 30.0
    longueur = Y_HANCHE - Y_CHEVILLE

    def descente(t):
        return longueur * (1 - math.cos(math.radians(AMPLITUDE * math.sin(2 * math.pi * t / T))))

    for s, dephasage in (('g', 0.0), ('d', math.pi)):
        def avance(t, ph=dephasage):
            return AMPLITUDE * math.sin(2 * math.pi * t / T + ph)

        def flexion(t, ph=dephasage):
            return FLEXION * max(0.0, math.cos(2 * math.pi * t / T + ph)) ** 1.5

        # Une rotation positive autour de x porte vers l'arrière ce qui pend.
        d.translation(f'hanche_{s}', lambda t: (0.0, -descente(t), 0.0))
        d.rotation(f'hanche_{s}', lambda t, a=avance: ('x', -a(t)))
        d.rotation(f'genou_{s}', lambda t, k=flexion: ('x', k(t)))
        d.rotation(f'cheville_{s}', lambda t, a=avance, k=flexion: ('x', a(t) - k(t)))
    d.translation('corps', lambda t: (0.0, -descente(t), 0.0))
    b.balancer(d, 'corps', 'z', 2.0, periodes=1)
    b.balancer(d, 'epaule_g', 'x', 4.0, periodes=1)
    b.balancer(d, 'epaule_d', 'x', -4.0, periodes=1)

    # Tir : le canon recule, le bras se relève d'un coup, le torse encaisse,
    # l'antenne fouette.
    t = f.clip('tir')
    b.recul(t, 'module_canon_long', '-z', 0.05, attaque=0.04, retour=0.35)
    b.a_coup(t, 'epaule_g', 'x', -6.0, attaque=0.05, retour=0.4)
    b.a_coup(t, 'module_tourelle', 'x', -2.5, attaque=0.06, retour=0.45)
    b.secousse(t, 'module_antenne', 'x', 10.0, debut=0.04, duree=0.6, oscillations=2.5)

    # Touché : le torse vacille, la tête branle, il se tasse, puis revient.
    k = f.clip('touche')
    b.secousse(k, 'module_tourelle', 'z', 5.0, oscillations=2)
    b.secousse(k, 'tete', 'z', -7.0, debut=0.04, oscillations=2)
    b.sursaut(k, 'corps', '-y', 0.012)

    # Hors jeu : il tombe à genoux. Les tibias se couchent en arrière, les
    # pieds glissent à plat dessous (la cheville reste à sa hauteur), le genou
    # touche le sol ; le torse, la tête et les bras retombent. L'œil reste
    # allumé : c'est la tête qui baisse.
    h = f.clip('hors_jeu')
    DUREE = 0.6
    tibia = Y_GENOU - Y_CHEVILLE
    cuisse = Y_HANCHE - Y_GENOU

    def pli(t):
        return 90.0 * b.lisse(min(1.0, t / DUREE))

    def chute(t):
        genou = max(0.07, Y_CHEVILLE + tibia * math.cos(math.radians(pli(t))))
        return Y_HANCHE - (genou + cuisse)

    for s in ('g', 'd'):
        h.translation(f'hanche_{s}', lambda t: (0.0, -chute(t), 0.0))
        h.rotation(f'genou_{s}', lambda t: ('x', pli(t)))
        h.rotation(f'cheville_{s}', lambda t: ('x', -pli(t)))
    h.translation('corps', lambda t: (0.0, -chute(t), 0.0))
    b.affaisser(h, 'module_tourelle', rotation=('x', 14.0), debut=0.2, duree=0.55)
    b.affaisser(h, 'tete', rotation=('x', 24.0), debut=0.35, duree=0.5)
    b.affaisser(h, 'epaule_g', rotation=('x', 32.0), debut=0.15, duree=0.55)
    b.affaisser(h, 'epaule_d', rotation=('x', 28.0), debut=0.18, duree=0.55)
    b.affaisser(h, 'module_antenne', rotation=('x', 30.0), debut=0.4, duree=0.45)
