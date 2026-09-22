"""
Géométrie pure du décor photographié : numpy seul, aucun `bpy`.

Tout est écrit dans le repère glTF — +Y en haut, +Z vers l'avant (le joueur, le
bas de l'écran), une unité égale une case — parce que c'est celui du fichier
livré, du contrat (`src/render2d/contrat.ts`) et du moteur. Le passage au repère
de Blender (Z en haut) n'a lieu qu'une fois, au moment de créer les objets
(`blender_io.py`) : penser dans deux repères à la fois est la façon la plus sûre
de livrer un arbre couché.

Une `Maille` accumule des sommets, une couleur **d'albédo** par sommet (sRGB,
jamais d'ombre peinte : la cuisson éclaire) et des faces, chacune rattachée à un
nom de matériau. Un `Modele` est une suite de `Piece`s nommées — `tronc`,
`feuillage`, `neige`… — qui deviennent les nœuds enfants de `racine`.
"""

import hashlib
import math

import numpy as np

# ---------------------------------------------------------------------------
# Hasard graîné
# ---------------------------------------------------------------------------


def rng_de(*cles):
    """
    Un générateur tiré d'une clé lisible. `hash()` de Python est salé à chaque
    processus : il rendrait deux cartes différentes pour la même graine. Une
    empreinte SHA-256 ne dépend que de la clé.
    """
    texte = '|'.join(str(c) for c in cles).encode('utf-8')
    return np.random.default_rng(int.from_bytes(hashlib.sha256(texte).digest()[:8], 'little'))


# ---------------------------------------------------------------------------
# Petites fonctions
# ---------------------------------------------------------------------------


def lisser(a, b, x):
    """`smoothstep` : 0 sous `a`, 1 au-delà de `b`, un S entre les deux (a > b permis)."""
    t = np.clip((np.asarray(x, dtype=np.float64) - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def normer(v):
    v = np.asarray(v, dtype=np.float64)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def tourner(v, axe, angle):
    """Rodrigues : `v` (…, 3) tourné autour de `axe` (unitaire) de `angle` radians."""
    v = np.asarray(v, dtype=np.float64)
    axe = normer(axe)
    c, s = math.cos(angle), math.sin(angle)
    return v * c + np.cross(axe, v) * s + np.outer(v @ axe, axe).reshape(v.shape) * (1.0 - c)


def horizontale(azimut):
    """La direction horizontale d'un azimut : 0 vers +X, π/2 vers +Z (l'avant)."""
    return np.array([math.cos(azimut), 0.0, math.sin(azimut)])


# ---------------------------------------------------------------------------
# Couleurs : sRGB en entrée, parce que c'est ainsi qu'un peintre les donne
# ---------------------------------------------------------------------------


def couleur(hexa):
    """`#rrggbb` → triplet sRGB de 0 à 1."""
    h = hexa.lstrip('#')
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float64) / 255.0


def melange(a, b, t):
    """Mélange deux couleurs (ou tableaux de couleurs) ; `t` peut être un vecteur par sommet."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    t = np.asarray(t, dtype=np.float64)
    if t.ndim == 1 and (a.ndim == 2 or b.ndim == 2 or t.shape[0] > 1):
        t = t[:, None]
    return a + (b - a) * t


def lineaire(srgb):
    """sRGB → linéaire : ce que Blender range dans un attribut de couleur flottant."""
    c = np.clip(np.asarray(srgb, dtype=np.float64), 0.0, 1.0)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def nuancer(base, rng, n, ecart=0.04):
    """`n` copies d'une couleur, chacune éclaircie ou foncée d'au plus `ecart` : un pigment, pas une lumière."""
    f = 1.0 + rng.uniform(-ecart, ecart, size=(n, 1))
    return np.clip(np.asarray(base, dtype=np.float64)[None, :] * f, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Maille, pièce, modèle
# ---------------------------------------------------------------------------


class Maille:
    """Des sommets, une couleur par sommet, des faces (polygones convexes) et leur matériau."""

    def __init__(self):
        self._sommets = []
        self._couleurs = []
        self.faces = []
        self.materiaux = []
        self.n = 0

    def ajouter(self, sommets, faces, couleurs, materiau):
        """`materiau` : un nom pour toutes les faces, ou une liste d'un nom par face."""
        s = np.asarray(sommets, dtype=np.float64).reshape(-1, 3)
        k = s.shape[0]
        c = np.asarray(couleurs, dtype=np.float64)
        if c.ndim == 1:
            c = np.tile(c, (k, 1))
        if c.shape != (k, 3):
            raise ValueError(f'couleurs {c.shape} pour {k} sommets')
        base = self.n
        self._sommets.append(s)
        self._couleurs.append(c)
        noms = [materiau] * len(faces) if isinstance(materiau, str) else list(materiau)
        if len(noms) != len(faces):
            raise ValueError('un matériau par face')
        for f, nom in zip(faces, noms):
            face = tuple(int(i) + base for i in f)
            if len(set(face)) != len(face) or len(face) < 3 or max(face) >= base + k:
                raise ValueError(f'face dégénérée ou hors maille {face}')
            self.faces.append(face)
            self.materiaux.append(nom)
        self.n += k
        return base

    def sommets(self):
        return np.concatenate(self._sommets) if self._sommets else np.zeros((0, 3))

    def couleurs(self):
        return np.concatenate(self._couleurs) if self._couleurs else np.zeros((0, 3))

    def remplacer_sommets(self, sommets):
        """Pose de nouvelles positions, même nombre, même ordre (normalisation, écrasement au sol)."""
        s = np.asarray(sommets, dtype=np.float64)
        if s.shape != (self.n, 3):
            raise ValueError('remplacement de sommets de forme différente')
        self._sommets = [s]
        self._couleurs = [self.couleurs()]

    def triangles(self):
        return sum(len(f) - 2 for f in self.faces)


class Piece:
    """Un nœud du GLB : un nom, une maille, un ombrage lisse (et, s'il le faut, des arêtes vives)."""

    def __init__(self, nom, angle_vif=None):
        self.nom = nom
        self.maille = Maille()
        # Au-delà de cet angle entre deux faces, l'arête reste vive : la crête d'une
        # roche, le bord d'une jupe de sapin. `None` : tout est lissé.
        self.angle_vif = angle_vif


class Modele:
    """Un modèle de décor : des pièces nommées, dans l'ordre où elles ont été créées."""

    def __init__(self):
        self.pieces = {}

    def piece(self, nom, angle_vif=None):
        if nom not in self.pieces:
            self.pieces[nom] = Piece(nom, angle_vif)
        return self.pieces[nom]

    def ajouter(self, nom_piece, sommets, faces, couleurs, materiau, angle_vif=None):
        return self.piece(nom_piece, angle_vif).maille.ajouter(sommets, faces, couleurs, materiau)

    def pieces_non_vides(self):
        return [p for p in self.pieces.values() if p.maille.n > 0 and p.maille.faces]

    def tous_sommets(self):
        tab = [p.maille.sommets() for p in self.pieces_non_vides()]
        return np.concatenate(tab) if tab else np.zeros((0, 3))

    def bornes(self):
        s = self.tous_sommets()
        return s.min(axis=0), s.max(axis=0)

    def triangles(self):
        return sum(p.maille.triangles() for p in self.pieces_non_vides())

    def transformer(self, fonction):
        """Applique `fonction(sommets) -> sommets` à chaque pièce."""
        for p in self.pieces_non_vides():
            p.maille.remplacer_sommets(fonction(p.maille.sommets()))


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

_ICOSAEDRE_SOMMETS = None
_ICOSPHERES = {}


def icosphere(subdivisions):
    """
    Sphère unité par subdivision d'un icosaèdre, faces orientées vers l'extérieur.
    L'ordre des sommets ne dépend que du nombre de subdivisions : une touffe tirée
    deux fois avec la même graine est la même touffe, octet pour octet.
    """
    if subdivisions in _ICOSPHERES:
        v, f = _ICOSPHERES[subdivisions]
        return v.copy(), [tuple(x) for x in f]
    t = (1.0 + 5.0 ** 0.5) / 2.0
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2),
         (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5),
         (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    sommets = [np.array(p, dtype=np.float64) / np.linalg.norm(p) for p in v]
    for _ in range(subdivisions):
        milieux = {}
        nouvelles = []

        def milieu(a, b):
            cle = (a, b) if a < b else (b, a)
            if cle not in milieux:
                m = sommets[a] + sommets[b]
                sommets.append(m / np.linalg.norm(m))
                milieux[cle] = len(sommets) - 1
            return milieux[cle]

        for a, b, c in f:
            ab, bc, ca = milieu(a, b), milieu(b, c), milieu(c, a)
            nouvelles += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nouvelles
    tab = np.array(sommets)
    # L'orientation se vérifie au lieu de se croire : une face dont la normale
    # rentre dans la sphère est retournée.
    orientees = []
    for a, b, c in f:
        n = np.cross(tab[b] - tab[a], tab[c] - tab[a])
        orientees.append((a, b, c) if n @ (tab[a] + tab[b] + tab[c]) > 0 else (a, c, b))
    _ICOSPHERES[subdivisions] = (tab, orientees)
    return tab.copy(), list(orientees)


def bosses(directions, rng, nombre, amplitude, largeur):
    """
    Le relief d'une touffe de feuillage : des bosses gaussiennes posées sur la
    sphère, chacune un bouquet de feuilles. Rend un facteur de rayon par direction.
    C'est ce qui donne la silhouette en chou-fleur qu'on lit comme « un arbre »
    à trente pixels, là où mille feuilles ne donneraient que du bruit.
    """
    d = normer(rng.normal(size=(nombre, 3)))
    a = rng.uniform(amplitude[0], amplitude[1], size=nombre)
    w = rng.uniform(largeur[0], largeur[1], size=nombre)
    cosinus = directions @ d.T
    apports = a[None, :] * np.exp(-(1.0 - cosinus) / w[None, :])
    # Le bouquet auquel appartient chaque sommet, et à quel point : c'est ce qui
    # colore une touffe bouquet par bouquet (`pigment_par_bouquet`).
    return 1.0 + apports.sum(axis=1), apports.argmax(axis=1), apports.max(axis=1)


def boule(centre, demi_axes, subdivisions, rng=None, relief=None, dessous=1.0):
    """
    Une boule déformée : sphère, relief facultatif (`(nombre, amplitude, largeur)`),
    moitié basse écrasée par `dessous` (un houppier a le ventre plat).
    Rend `(sommets, faces, directions, bouquets)` ; `directions` (la sphère unité
    d'origine) situe un sommet sur la boule, `bouquets` dit à quelle bosse il
    appartient (`nombre`, `dominante`, `poids`).
    """
    u, f = icosphere(subdivisions)
    facteur = np.ones(len(u))
    bouquets = dict(nombre=0, dominante=np.zeros(len(u), dtype=np.int64), poids=np.zeros(len(u)))
    if relief is not None:
        facteur, dominante, poids = bosses(u, rng, *relief)
        bouquets = dict(nombre=relief[0], dominante=dominante, poids=poids)
    p = u * facteur[:, None]
    p[:, 1] = np.where(p[:, 1] < 0.0, p[:, 1] * dessous, p[:, 1])
    p = np.asarray(centre, dtype=np.float64) + p * np.asarray(demi_axes, dtype=np.float64)
    return p, f, u, bouquets


def pigment_par_bouquet(base, clair, bouquets, rng, ecart=0.07, part_jeune=0.3, force_jeune=0.35):
    """
    La couleur d'une touffe de feuillage, **bouquet par bouquet** : chaque bosse
    tire son pigment — un peu plus sombre, un peu plus clair, ou une pousse
    neuve qui tire vers `clair` —, au hasard, jamais selon qu'elle pointe vers
    le soleil ou se creuse. Une couleur qui suivrait le relief serait une ombre
    peinte ; celle-ci ne suit que la plante.
    """
    n = max(bouquets['nombre'], 1)
    variation = rng.uniform(-ecart, ecart, n)
    jeune = (rng.random(n) < part_jeune).astype(np.float64)
    k = bouquets['dominante']
    dans = lisser(0.015, 0.06, bouquets['poids'])
    col = np.asarray(base, dtype=np.float64)[None, :] * (1.0 + variation[k] * dans)[:, None]
    col = melange(col, clair, force_jeune * jeune[k] * dans)
    col = col * (1.0 + rng.uniform(-0.025, 0.025, (len(k), 1)))
    return np.clip(col, 0.0, 1.0)


def reperes(points):
    """
    Tangentes et repères transportés parallèlement le long d'une polyligne : un
    tronc qui se courbe ne se vrille pas, ce que ferait un repère recalculé à
    chaque point depuis un axe fixe.
    """
    p = np.asarray(points, dtype=np.float64)
    t = np.gradient(p, axis=0) if len(p) > 2 else np.tile(p[-1] - p[0], (len(p), 1))
    t = normer(t)
    ref = np.array([0.0, 0.0, 1.0]) if abs(t[0][2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    n = [normer(np.cross(t[0], ref))]
    for i in range(1, len(p)):
        axe = np.cross(t[i - 1], t[i])
        s = np.linalg.norm(axe)
        if s < 1e-9:
            n.append(n[-1])
        else:
            angle = math.atan2(s, float(t[i - 1] @ t[i]))
            n.append(normer(tourner(n[-1], axe / s, angle)))
    n = np.array(n)
    b = np.cross(t, n)
    return t, n, b


def tube(points, rayons, cotes, pointe=False, fermer_bas=False, phase=0.0):
    """
    Un cylindre généralisé le long d'une polyligne, faces vers l'extérieur.
    `pointe` : le dernier point est un sommet unique (bout de rameau, pic).
    Rend `(sommets, faces, indice_anneau_par_sommet)`.
    """
    p = np.asarray(points, dtype=np.float64)
    r = np.asarray(rayons, dtype=np.float64)
    t, n, b = reperes(p)
    anneaux = len(p) - 1 if pointe else len(p)
    angles = phase + 2.0 * math.pi * np.arange(cotes) / cotes
    sommets = []
    anneau_de = []
    for i in range(anneaux):
        for a in angles:
            sommets.append(p[i] + r[i] * (math.cos(a) * n[i] + math.sin(a) * b[i]))
            anneau_de.append(i)
    faces = []
    for i in range(anneaux - 1):
        for j in range(cotes):
            k = (j + 1) % cotes
            faces.append((i * cotes + j, i * cotes + k, (i + 1) * cotes + k, (i + 1) * cotes + j))
    if pointe:
        sommets.append(p[-1])
        anneau_de.append(len(p) - 1)
        apex = len(sommets) - 1
        base = (anneaux - 1) * cotes
        for j in range(cotes):
            faces.append((base + j, base + (j + 1) % cotes, apex))
    if fermer_bas:
        sommets.append(p[0])
        anneau_de.append(0)
        c = len(sommets) - 1
        for j in range(cotes):
            faces.append(((j + 1) % cotes, j, c))
    return np.array(sommets), faces, np.array(anneau_de)


def courbe(depart, azimut, elevation, longueur, flexion, stations, exposant=1.5, vrille=0.0):
    """
    La ligne médiane d'une lame (feuille, fronde, brin) : elle part avec une
    élévation donnée et plie de `flexion` radians vers le bas en chemin — une
    herbe s'arque, elle ne se casse pas. Rend `(points, directions)`.
    """
    s = np.linspace(0.0, 1.0, stations)
    elev = elevation - flexion * s ** exposant
    azi = azimut + vrille * s
    dirs = np.stack([np.cos(elev) * np.cos(azi), np.sin(elev), np.cos(elev) * np.sin(azi)], axis=1)
    pas = longueur / (stations - 1)
    points = [np.asarray(depart, dtype=np.float64)]
    for i in range(1, stations):
        points.append(points[-1] + 0.5 * (dirs[i - 1] + dirs[i]) * pas)
    return np.array(points), dirs


def lame(points, dirs, largeurs, pli, azimut, dents=None):
    """
    Une lame pliée en V le long de `points` : trois sommets par station (bord,
    nervure, bord) et une pointe. `pli` > 0 relève les bords (gouttière d'herbe),
    `pli` < 0 les rabat (folioles d'une palme). `dents` alterne la largeur d'une
    station à l'autre : la dentelure d'une fronde.
    Rend `(sommets, faces, rang)` ; `rang` va de 0 à la base à 1 à la pointe.
    """
    m = len(points)
    cote = np.array([-math.sin(azimut), 0.0, math.cos(azimut)])
    sommets = []
    rang = []
    for i in range(m - 1):
        d = dirs[i]
        normale = normer(np.cross(cote, d))
        w = largeurs[i] * (dents if (dents is not None and i % 2 == 1) else 1.0)
        releve = normale * pli * w
        sommets += [points[i] - cote * w * 0.5 + releve, points[i], points[i] + cote * w * 0.5 + releve]
        rang += [i / (m - 1)] * 3
    sommets.append(points[-1])
    rang.append(1.0)
    # Les faces regardent du côté de la gouttière — le dessus d'une feuille qui
    # s'arque — pour que la moyenne des normales lissées ait un sens le long de
    # la nervure ; le matériau est double face de toute façon.
    faces = []
    for i in range(m - 2):
        g0, c0, d0 = 3 * i, 3 * i + 1, 3 * i + 2
        g1, c1, d1 = g0 + 3, c0 + 3, d0 + 3
        faces += [(g0, c0, c1, g1), (c0, d0, d1, c1)]
    pointe = len(sommets) - 1
    g, c, d = 3 * (m - 2), 3 * (m - 2) + 1, 3 * (m - 2) + 2
    faces += [(g, c, pointe), (c, d, pointe)]
    return np.array(sommets), faces, np.array(rang)


def orienter(sommets, faces, dehors):
    """
    Retourne les faces dont la normale ne regarde pas `dehors(centroïde)` : la
    règle d'orientation s'écrit une fois, au lieu d'être devinée face par face.
    """
    s = np.asarray(sommets, dtype=np.float64)
    resultat = []
    for f in faces:
        p = s[list(f)]
        n = normale_polygone(p)
        resultat.append(f if n @ dehors(p.mean(axis=0)) >= 0 else tuple(reversed(f)))
    return resultat


def normale_polygone(p):
    """Normale de Newell : juste aussi pour un polygone concave (le profil d'un contrefort)."""
    q = np.roll(p, -1, axis=0)
    return np.array([
        ((p[:, 1] - q[:, 1]) * (p[:, 2] + q[:, 2])).sum(),
        ((p[:, 2] - q[:, 2]) * (p[:, 0] + q[:, 0])).sum(),
        ((p[:, 0] - q[:, 0]) * (p[:, 1] + q[:, 1])).sum(),
    ])


def sous_maille(sommets, faces, garder):
    """Les faces retenues par `garder(indices)`, sommets réindexés : une calotte de neige découpée dans une boule."""
    s = np.asarray(sommets, dtype=np.float64)
    retenues = [f for f in faces if garder(f)]
    utilises = sorted({i for f in retenues for i in f})
    nouveau = {ancien: k for k, ancien in enumerate(utilises)}
    return s[utilises], [tuple(nouveau[i] for i in f) for f in retenues], np.array(utilises, dtype=np.int64)


def boule_orientee(centre, axe, demi_axes, subdivisions=1):
    """Un ellipsoïde dont le premier demi-axe suit `axe` : un bourrelet de neige couché sur une branche."""
    u, f = icosphere(subdivisions)
    a = normer(axe)
    ref = np.array([0.0, 1.0, 0.0]) if abs(a[1]) < 0.95 else np.array([1.0, 0.0, 0.0])
    b = normer(np.cross(a, ref))
    c = np.cross(b, a)
    # (a, c, b) : premier demi-axe le long de la branche, deuxième vers le haut
    # local, troisième de côté.
    base = np.stack([a, c, b])
    p = (u * np.asarray(demi_axes, dtype=np.float64)) @ base
    p = np.asarray(centre, dtype=np.float64) + p
    # `base` est orthonormée directe ou indirecte selon le côté choisi : on
    # vérifie l'orientation plutôt que de la supposer.
    f = orienter(p, f, lambda q: q - np.asarray(centre, dtype=np.float64))
    return p, f


def prisme(profil_bas, profil_haut):
    """
    Un volume fermé entre deux contours de même nombre de points (sens
    trigonométrique vu de dessus) : une ailette de contrefort, un bloc de grès.
    """
    bas = np.asarray(profil_bas, dtype=np.float64)
    haut = np.asarray(profil_haut, dtype=np.float64)
    k = len(bas)
    sommets = np.concatenate([bas, haut])
    faces = []
    for j in range(k):
        i = (j + 1) % k
        faces.append((j, i, k + i, k + j))
    faces.append(tuple(range(k - 1, -1, -1)))
    faces.append(tuple(range(k, 2 * k)))
    return sommets, faces


# ---------------------------------------------------------------------------
# Bruit : un Perlin 2D vectorisé, graîné
# ---------------------------------------------------------------------------


class Bruit:
    """
    Bruit de gradient 2D. Écrit ici plutôt que pris à `mathutils.noise` pour que
    la graine soit la nôtre et que le module reste importable hors de Blender.
    """

    def __init__(self, graine):
        rng = rng_de('bruit', graine)
        self.perm = np.concatenate([rng.permutation(256)] * 2)
        angles = rng.uniform(0.0, 2.0 * math.pi, 256)
        self.grad = np.stack([np.cos(angles), np.sin(angles)], axis=1)

    def __call__(self, x, y):
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        xi = np.floor(x).astype(np.int64)
        yi = np.floor(y).astype(np.int64)
        xf = x - xi
        yf = y - yi

        def g(ix, iy, dx, dy):
            h = self.perm[(self.perm[ix & 255] + iy) & 255]
            gg = self.grad[h]
            return gg[..., 0] * dx + gg[..., 1] * dy

        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
        n00 = g(xi, yi, xf, yf)
        n10 = g(xi + 1, yi, xf - 1, yf)
        n01 = g(xi, yi + 1, xf, yf - 1)
        n11 = g(xi + 1, yi + 1, xf - 1, yf - 1)
        a = n00 + (n10 - n00) * u
        b = n01 + (n11 - n01) * u
        return (a + (b - a) * v) * 1.4

    def fbm(self, x, y, octaves=4, gain=0.5, lacunarite=2.03):
        total = np.zeros_like(np.asarray(x, dtype=np.float64))
        amp, freq, somme = 1.0, 1.0, 0.0
        for o in range(octaves):
            total = total + amp * self(np.asarray(x) * freq + 17.3 * o, np.asarray(y) * freq - 9.1 * o)
            somme += amp
            amp *= gain
            freq *= lacunarite
        return total / somme

    def arete(self, x, y, octaves=3):
        """Bruit « en crête » (1 − |n|) : des lignes de partage, des arêtes de roche."""
        total = np.zeros_like(np.asarray(x, dtype=np.float64))
        amp, freq, somme = 1.0, 1.0, 0.0
        for o in range(octaves):
            n = 1.0 - np.abs(self(np.asarray(x) * freq + 5.7 * o, np.asarray(y) * freq + 3.1 * o))
            total = total + amp * n * n
            somme += amp
            amp *= 0.5
            freq *= 2.1
        return total / somme
