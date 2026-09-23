"""
La bibliothèque des figurines : un jouet peint, fabriqué dans Blender 5.1 pour
être photographié par la cuisson (`scripts/sprites/`).

Un agent d'unité n'écrit qu'un fichier, `unites/<cle>.py`, avec deux fonctions,
`construire(f)` et `animer(f)` ; `f` est une `Figurine`. Tout ce qui fait la
cohésion du lot est ici et nulle part ailleurs : la palette et le masque (un
atlas commun, `charte.json`), le chanfrein et le lissage de chaque pièce, les
nœuds de la fiche, les clips, l'export.

LE REPÈRE, partout : celui de la fiche et du glTF, en mètres (une case vaut un
mètre), origine au centre de l'emprise, au sol.
    x : latéral, positif à GAUCHE du modèle (la vue « droite » montre le flanc
        droit, les x négatifs, et l'avant) ;
    y : en haut ;
    z : vers l'avant (le nez, l'étrave, la bouche du canon).
Blender est en z-haut ; la conversion est faite ici (`vb`), jamais par l'agent.

Ce que la bibliothèque garantit, sans que l'agent y pense :
- chaque pièce est chanfreinée (au moins `formes.chanfreinMin`, et
  `formes.chanfreinPart` de sa plus grande dimension) et lissée, normales
  pondérées par l'aire : aucune facette visible à 512 pixels par case ;
- un cercle a assez de côtés pour que sa flèche reste sous un demi-pixel du
  rendu ;
- chaque pièce a UNE teinte de la charte, et ses UV tombent dans la case de
  cette teinte : tous les modèles partagent le même atlas, et le masque
  d'équipe est ce même atlas, blanc sur les teintes d'équipe ;
- les nœuds de la fiche existent, avec leurs noms ; un nœud peut rester vide ;
- les clips ont la durée de la fiche, commencent à zéro, et bouclent sans
  saut quand la fiche le demande.
"""

import json
import math
import os
import re

import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

# ---------------------------------------------------------------------------
# 0. Constantes et repères
# ---------------------------------------------------------------------------

#: Pixels par mètre du rendu de cuisson (128 × le suréchantillonnage 4) : la
#: finesse à laquelle une facette se verrait.
PIXELS_RENDU_PAR_METRE = 512

#: Flèche tolérée d'un cercle, en pixels du rendu : sous un demi-pixel, un
#: polygone ne se distingue plus d'un cercle, même avant la réduction.
FLECHE_MAX = 0.35

#: Au-delà de cet angle entre deux faces, l'arête est chanfreinée. Sous lui,
#: les faces d'un cercle (360° / côtés) restent lisses, sans chanfrein.
ANGLE_CHANFREIN = 20.0

#: Cadence d'échantillonnage des clips, en images par seconde : la cuisson en
#: tire 12 ; à 60, l'interpolation linéaire entre deux clés ne se voit pas.
FREQUENCE_CLES = 60

#: Ce que la cuisson fait d'un clip : la fréquence à laquelle elle le
#: photographie (`IMAGES_PAR_SECONDE`, `src/render2d/contrat.ts`), son plafond
#: d'images par clip (`IMAGES_MAX_PAR_CLIP`) et l'ouverture de son obturateur
#: (`FLOU_DE_BOUGE`, `scripts/sprites/reglages.ts`). Les valeurs écrites ici ne
#: sont qu'un repli : `fabriquer.py` les remplace, avant de charger le module
#: de l'unité, par celles que `fabriquer.ts` lit à leur source.
IMAGES_PAR_SECONDE = 12
IMAGES_MAX_PAR_CLIP = 12
FLOU_DE_BOUGE = 0.5

NOM_UV = 'UVMap'
NOM_ID = 'id_teinte'

REGEX_NOM = re.compile(r'^[a-z][a-z0-9_]*$')


def vb(p):
    """Un point ou une direction du repère du modèle (glTF) vers Blender : (x, y, z) → (x, −z, y)."""
    return Vector((p[0], -p[2], p[1]))


def depuis_blender(v):
    """L'inverse de `vb` : Blender (x, y, z) → modèle (x, z, −y)."""
    return (v[0], v[2], -v[1])


AXES = {
    'x': (1.0, 0.0, 0.0), '-x': (-1.0, 0.0, 0.0),
    'y': (0.0, 1.0, 0.0), '-y': (0.0, -1.0, 0.0),
    'z': (0.0, 0.0, 1.0), '-z': (0.0, 0.0, -1.0),
}


def direction(axe):
    """Une direction du modèle, normalisée : un nom d'axe (`'x'`, `'-z'`…) ou trois nombres."""
    v = Vector(AXES[axe]) if isinstance(axe, str) else Vector(axe)
    if v.length < 1e-9:
        raise ValueError(f'direction nulle : {axe}')
    return v.normalized()


def rotation_vers(depuis, vers):
    """La rotation (matrice 4 × 4) qui amène la direction `depuis` sur `vers`, en Blender."""
    q = Vector(depuis).normalized().rotation_difference(Vector(vers).normalized())
    return q.to_matrix().to_4x4()


def lisse(t):
    """Adoucissement : 0 → 0, 1 → 1, pentes nulles aux deux bouts."""
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def srgb_vers_lineaire(s):
    return s / 12.92 if s <= 0.04045 else ((s + 0.055) / 1.055) ** 2.4


def _instants(duree, boucle):
    """Les instants que la cuisson photographie (`scripts/sprites/echantillonnage.ts`, sa règle)."""
    if duree <= 0:
        return [0.0]
    if boucle:
        n = max(1, min(IMAGES_MAX_PAR_CLIP, round(duree * IMAGES_PAR_SECONDE)))
        return [k * duree / n for k in range(n)]
    n = max(2, min(IMAGES_MAX_PAR_CLIP, math.ceil(duree * IMAGES_PAR_SECONDE - 1e-9) + 1))
    return [k * duree / (n - 1) for k in range(n)]


def instants_cuisson(clip):
    """
    Les instants d'un clip que la cuisson photographie, en secondes : pour caler
    une pose sur une image (un rotor qui s'arrête pale par pale, un éclair de
    bouche sur l'image du coup).
    """
    return _instants(clip.duree, clip.boucle)


def hex_rvb(h):
    n = int(h.lstrip('#'), 16)
    return ((n >> 16) & 255, (n >> 8) & 255, n & 255)


# ---------------------------------------------------------------------------
# 1. La charte et l'atlas
# ---------------------------------------------------------------------------

class Charte:
    """La charte (`charte.json`) : la palette, sa case d'atlas, les seuils des formes."""

    def __init__(self, chemin):
        with open(chemin, encoding='utf-8') as f:
            self.donnees = json.load(f)
        self.teintes = self.donnees['teintes']
        self.index = {t['nom']: i for i, t in enumerate(self.teintes)}
        atlas = self.donnees['atlas']
        self.colonnes = atlas['colonnes']
        self.lignes = atlas['lignes']
        self.remplissage = atlas['remplissage']
        self.formes = self.donnees['formes']
        if len(self.teintes) > self.colonnes * self.lignes:
            raise ValueError('plus de teintes que de cases dans l’atlas')

    def teinte(self, nom):
        if nom not in self.index:
            raise KeyError(f'teinte inconnue : {nom} (la charte connaît : {", ".join(self.index)})')
        return self.teintes[self.index[nom]]

    def case(self, nom):
        """
        Le rectangle utile de la case d'une teinte, en UV **glTF** (v vers le
        bas) : (u0, u1, v0, v1). La case est remplie à `remplissage` autour de
        son centre, ce qui laisse une marge que ni le filtrage ni les mipmaps
        ne franchissent. `scripts/production/figurines/charte.ts` peint l'atlas
        sur la même règle.
        """
        i = self.index[nom]
        col, lig = i % self.colonnes, i // self.colonnes
        marge = (1 - self.remplissage) / 2
        return (
            (col + marge) / self.colonnes, (col + 1 - marge) / self.colonnes,
            (lig + marge) / self.lignes, (lig + 1 - marge) / self.lignes,
        )

    def couleur_id(self, nom, tournant):
        """La couleur d'identifiant d'une pièce, en sRGB 0–255 : R dit la teinte, G une pièce tournante."""
        return (10 * (self.index[nom] + 1), 255 if tournant else 0, 0)


# ---------------------------------------------------------------------------
# 2. La géométrie brute (bmesh, repère Blender), avant chanfrein
# ---------------------------------------------------------------------------

def segments_cercle(rayon, minimum=16):
    """Le nombre de côtés d'un cercle de `rayon` mètres : flèche sous `FLECHE_MAX` pixels du rendu, multiple de 4."""
    r = max(rayon, 1e-4) * PIXELS_RENDU_PAR_METRE
    if r <= FLECHE_MAX:
        n = minimum
    else:
        n = math.ceil(math.pi / math.acos(1 - FLECHE_MAX / r))
    n = max(minimum, n)
    return min(128, int(math.ceil(n / 4) * 4))


def _convexe(face):
    """
    Vrai si une face plane est convexe : tous ses coins tournent du même côté de
    sa normale. Un coin plat — trois points alignés, le flanc droit d'une carène
    en V — ne compte pas : les sommets de Blender sont en simple précision, et
    trois points alignés y tournent de 10⁻⁵ d'un côté ou de l'autre ; le seuil
    est donc un sinus, pas une longueur.
    """
    n = face.normal
    pts = [v.co for v in face.verts]
    k = len(pts)
    signe = 0
    for i in range(k):
        a, b, c = pts[i - 1], pts[i], pts[(i + 1) % k]
        u, w = b - a, c - b
        d = u.cross(w).dot(n)
        if abs(d) <= 1e-4 * u.length * w.length:
            continue
        s = 1 if d > 0 else -1
        if signe == 0:
            signe = s
        elif s != signe:
            return False
    return True


def _solide_anneaux(bm, anneaux, fermer=True):
    """
    Un solide fait d'anneaux successifs (listes de sommets de même longueur),
    reliés par des quadrilatères ; les deux anneaux extrêmes sont bouchés par
    un polygone. Les normales sont recalculées vers l'extérieur.

    Un couvercle **concave** (un U, une marche, une clé fendue) est triangulé
    ici, par la méthode « beauté » de Blender : laissé en polygone, sa
    triangulation paresseuse — après le chanfrein, sur un maillage fusionné —
    peut jeter un triangle en travers du creux. Un couvercle convexe reste un
    polygone, comme avant.
    """
    verts = [[bm.verts.new(p) for p in a] for a in anneaux]
    n = len(anneaux[0])
    for a, b in zip(verts, verts[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    couvercles = []
    if fermer:
        couvercles = [bm.faces.new(list(reversed(verts[0]))), bm.faces.new(verts[-1])]
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    concaves = [c for c in couvercles if len(c.verts) > 3 and not _convexe(c)]
    if concaves:
        bmesh.ops.triangulate(bm, faces=concaves, quad_method='BEAUTY', ngon_method='BEAUTY')


def bm_boite(taille):
    """Une boîte centrée, `taille` en Blender (x, y, z)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(taille), verts=bm.verts)
    return bm


def bm_cylindre(rayon, longueur, rayon2=None, segments=None, ellipse=1.0):
    """Un cylindre (un tronc de cône si `rayon2`) le long de z Blender, centré ; `ellipse` étire la section en y."""
    bm = bmesh.new()
    n = segments or segments_cercle(max(rayon, rayon2 or 0) * max(1.0, ellipse))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=rayon,
                          radius2=rayon if rayon2 is None else rayon2, depth=longueur)
    if ellipse != 1.0:
        bmesh.ops.scale(bm, vec=Vector((1.0, ellipse, 1.0)), verts=bm.verts)
    return bm


def bm_boule(rayon, etirement=(1.0, 1.0, 1.0)):
    """
    Une sphère centrée, étirée par `etirement` (Blender) : `n` méridiens, `n / 2`
    tranches, deux pôles en éventail — la topologie de
    `bmesh.ops.create_uvsphere`, construite ici sommet par sommet.

    Pas par `create_uvsphere` : il soude ses pôles par une table indexée sur
    des adresses mémoire, si bien que l'ordre de ses faces change d'un lancement
    de Blender à l'autre — et avec lui l'ordre des triangles du GLB, puis son
    empreinte, puis une recuisson pour rien (23 septembre 2026). Construite dans
    un ordre fixe, la même boule donne le même GLB, à l'octet.
    """
    n = segments_cercle(rayon * max(etirement))
    v = max(8, n // 2)
    bm = bmesh.new()
    sud = bm.verts.new((0.0, 0.0, -rayon))
    anneaux = []
    for k in range(1, v):
        phi = math.pi * k / v
        z, r = -rayon * math.cos(phi), rayon * math.sin(phi)
        anneaux.append([bm.verts.new((r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z)) for i in range(n)])
    nord = bm.verts.new((0.0, 0.0, rayon))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((sud, anneaux[0][j], anneaux[0][i]))
    # Chaque quadrilatère commence là où `create_uvsphere` commençait le sien :
    # l'export le coupe par sa première diagonale, et la boule garde les
    # triangles d'avant.
    for a, b in zip(anneaux, anneaux[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[j], b[j], b[i], a[i]))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((anneaux[-1][i], anneaux[-1][j], nord))
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.scale(bm, vec=Vector(etirement), verts=bm.verts)
    return bm


def bm_capsule(rayon, longueur):
    """Une capsule le long de z Blender, centrée : longueur totale, bouts compris."""
    n = segments_cercle(rayon)
    demi = max(0.0, longueur / 2 - rayon)
    arcs = max(4, n // 4)
    anneaux = []
    # Du pôle bas à l'équateur, puis (si la capsule a un fût) de l'équateur haut au pôle haut.
    for k in range(arcs, -1, -1):
        a = (math.pi / 2) * k / arcs
        anneaux.append((-demi - rayon * math.sin(a), rayon * math.cos(a)))
    for k in range(0 if demi > 1e-6 else 1, arcs + 1):
        a = (math.pi / 2) * k / arcs
        anneaux.append((demi + rayon * math.sin(a), rayon * math.cos(a)))
    # Les pôles sont de tout petits anneaux bouchés : pas de sommet dégénéré.
    anneaux = [(z, max(r, rayon * 0.03)) for z, r in anneaux]
    pts = [[(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)] for z, r in anneaux]
    bm = bmesh.new()
    _solide_anneaux(bm, pts)
    return bm


def bm_revolution(profil, segments=None):
    """
    Un solide de révolution autour de z Blender : `profil` est une liste de
    (rayon, z), du bas vers le haut, rayons strictement positifs ; les deux
    bouts sont bouchés.
    """
    rmax = max(r for r, _ in profil)
    n = segments or segments_cercle(rmax)
    pts = [[(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n), z) for i in range(n)] for r, z in profil]
    bm = bmesh.new()
    _solide_anneaux(bm, pts)
    return bm


def bm_prisme(profil, epaisseur):
    """
    Un polygone de Blender (y, z) — c'est-à-dire (−z, y) du modèle — extrudé le
    long de x Blender sur `epaisseur`, centré.
    """
    anneaux = [[(-epaisseur / 2, a, b) for a, b in profil], [(epaisseur / 2, a, b) for a, b in profil]]
    bm = bmesh.new()
    _solide_anneaux(bm, anneaux)
    return bm


def bm_loft(sections):
    """
    Un solide lissé d'une section à l'autre : `sections` est une liste de
    (y Blender, [(x, z), …]), toutes les sections ayant le même nombre de
    points, parcourues dans le même sens.
    """
    anneaux = [[(x, y, z) for x, z in pts] for y, pts in sections]
    bm = bmesh.new()
    _solide_anneaux(bm, anneaux)
    return bm


def _section_unite(n, exposants):
    """
    Une section de `n` points faite de deux demi-superellipses de rayon 1 : le
    dessus (y ≥ 0) d'exposant `exposants[0]`, le dessous d'exposant
    `exposants[1]` — 2 une ellipse, 1 un losange (une carène en V), plus un
    carré aux coins ronds.
    """
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        e = 2.0 / (exposants[0] if s >= 0 else exposants[1])
        pts.append((math.copysign(abs(c) ** e, c), math.copysign(abs(s) ** e, s)))
    return pts


def contour_rectangle(cx, cz, lx, lz, rayon=0.0, n_coin=6):
    """
    Un rectangle vu de dessus, points (x, z) du modèle, dans le sens
    qu'`extrusion` attend : centré en (`cx`, `cz`), `lx` × `lz`, coins
    arrondis de `rayon` (0 : quatre coins vifs). Deux contours faits ici avec
    le même `n_coin` — ou tous deux sans rayon — se correspondent point à
    point : le bas et le haut d'une extrusion.
    """
    if rayon <= 0:
        return [(cx - lx / 2, cz + lz / 2), (cx - lx / 2, cz - lz / 2), (cx + lx / 2, cz - lz / 2), (cx + lx / 2, cz + lz / 2)]
    r = max(1e-3, min(rayon, lx / 2 - 1e-3, lz / 2 - 1e-3))
    pts = []
    # Du coin arrière-haut-gauche au coin avant : le même sens que les coins vifs.
    for sx, sz, a0 in ((-1, 1, 90), (-1, -1, 180), (1, -1, 270), (1, 1, 0)):
        ox, oz = cx + sx * (lx / 2 - r), cz + sz * (lz / 2 - r)
        for k in range(n_coin + 1):
            a = math.radians(a0 + 90 * k / n_coin)
            pts.append((ox + r * math.cos(a), oz + r * math.sin(a)))
    return pts


# ---------------------------------------------------------------------------
# 3. La figurine
# ---------------------------------------------------------------------------

class Noeud:
    def __init__(self, nom, parent, pivot):
        self.nom = nom
        self.parent = parent
        self.pivot = tuple(float(v) for v in pivot)
        self.tournant = False
        self.axe_tour = None
        self.pales = None
        self.pieces = []


class Piece:
    def __init__(self, nom, noeud, teinte, objet, dimensions, chanfrein, fin, uv):
        self.nom = nom
        self.noeud = noeud
        self.teinte = teinte
        self.objet = objet
        self.dimensions = dimensions
        self.chanfrein = chanfrein
        self.fin = fin
        self.uv = uv
        self.triangles = 0
        #: Le nom d'une pièce du même nœud avec laquelle celle-ci est jugée
        #: (épaisseur) : la bouche d'un tube fait corps avec lui, le moyeu d'un
        #: galet avec son galet. Toute pièce rendue par une primitive peut
        #: l'être : `p.avec = hote.nom`.
        self.avec = None
        #: L'épaisseur de la pièce jugée avec son hôte, posée par `terminer`.
        self.epaisseur_jugee = None


class Figurine:
    """
    Le constructeur d'une figurine. Les primitives prennent un **nœud** (où la
    pièce s'accroche, et donc avec quoi elle bouge), des positions et des
    tailles dans le repère du modèle, et une **teinte** de la charte.
    """

    def __init__(self, cle, fiche, charte, unite=None):
        self.cle = cle
        self.id = fiche['id']
        self.fiche = fiche
        self.charte = charte
        self.unite = unite or {}
        self.scene = bpy.context.scene
        self.noeuds = {'racine': Noeud('racine', None, (0, 0, 0))}
        self.ordre = ['racine']
        noms = fiche['format']['noeuds']
        for nom in noms:
            if nom == 'racine':
                continue
            parent = 'corps' if nom.startswith('module_') and 'corps' in noms else 'racine'
            self._ajouter_noeud(nom, parent, (0, 0, 0))
        attendus = fiche['format']['materiauxAttendus']
        self.materiaux_fiche = list(attendus)
        self.clips = {}
        self._compteur = 0
        self.avertissements = []
        self._materiaux = {}

    # --- nœuds ---------------------------------------------------------------

    def _ajouter_noeud(self, nom, parent, pivot):
        self.noeuds[nom] = Noeud(nom, parent, pivot)
        self.ordre.append(nom)

    def noeud(self, nom, parent=None, pivot=None, tournant=None):
        """
        Règle un nœud de la fiche, ou en crée un (une pièce qui doit bouger
        seule : un canon qui recule, un galet qui tourne, une antenne). `pivot`
        est le point du modèle autour duquel il tourne : l'axe d'un galet, le
        tourillon d'un canon. `tournant` : une pièce qui tourne sans fin
        (rotor, parabole radar), exclue de la limite de rotation et de
        l'agitation du repos.
        """
        if not REGEX_NOM.match(nom):
            raise ValueError(f'nom de nœud invalide : {nom} (minuscules, chiffres, tirets bas)')
        if nom == 'racine' and (parent is not None or pivot is not None):
            raise ValueError('la racine reste à l’origine, sans parent')
        if nom not in self.noeuds:
            self._ajouter_noeud(nom, parent or 'racine', pivot or (0, 0, 0))
        n = self.noeuds[nom]
        if parent is not None:
            if parent not in self.noeuds:
                raise KeyError(f'parent inconnu : {parent}')
            p = parent
            while p is not None:
                if p == nom:
                    raise ValueError(f'cycle de nœuds : {nom} sous {parent}')
                p = self.noeuds[p].parent
            n.parent = parent
        if pivot is not None:
            n.pivot = tuple(float(v) for v in pivot)
        if tournant is not None:
            n.tournant = bool(tournant)
        return nom

    # --- teintes et matériaux --------------------------------------------------

    def _verifier_teinte(self, teinte):
        t = self.charte.teinte(teinte)
        if t.get('batiment'):
            raise ValueError(f'la teinte {teinte} est réservée aux bâtiments')
        reservee = t.get('reserveeA')
        if reservee and self.cle not in reservee:
            raise ValueError(f'la teinte {teinte} est réservée à {", ".join(reservee)}')
        return t

    def _materiau(self, nom):
        if nom not in self._materiaux:
            m = bpy.data.materials.new(nom)
            m.use_backface_culling = True
            bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
            bsdf.inputs['Metallic'].default_value = 0.0
            bsdf.inputs['Roughness'].default_value = 1.0
            self._materiaux[nom] = m
        return self._materiaux[nom]

    def _indice_materiau(self, teinte):
        """L'indice, dans les matériaux de la fiche, de celui qui porte cette teinte."""
        voulu = self.charte.donnees['materiaux'][self.charte.teinte(teinte)['materiau']]
        return self.materiaux_fiche.index(voulu) if voulu in self.materiaux_fiche else 0

    # --- la pièce : chanfrein, lissage, placement ------------------------------

    def _chanfrein(self, dims, demande, fin):
        f = self.charte.formes
        mini = f['chanfreinMin']
        voulu = max(mini, f['chanfreinPart'] * max(dims), demande or 0.0)
        plafond = 0.45 * min(dims)
        if voulu > plafond:
            if not fin and plafond < mini:
                self.avertissements.append(f'chanfrein plafonné à {plafond:.3f} m sur une pièce de {min(dims):.3f} m')
            voulu = plafond
        return voulu

    def _piece(self, bm, noeud, teinte, placement, dims, chanfrein=None, fin=False, uv='boite', nom=None, arrondir=True):
        """Pose une pièce : `bm` (repère Blender, centré), `placement` (matrice Blender), `dims` (m)."""
        if noeud not in self.noeuds:
            raise KeyError(f'nœud inconnu : {noeud} (déclarez-le par f.noeud)')
        self._verifier_teinte(teinte)
        self._compteur += 1
        nom = nom or f'{noeud}_{self._compteur}'
        me = bpy.data.meshes.new(f'_piece_{self._compteur}')
        bm.to_mesh(me)
        bm.free()
        me.shade_smooth()
        ob = bpy.data.objects.new(f'_piece_{self._compteur}', me)
        self.scene.collection.objects.link(ob)
        ob.matrix_world = placement
        largeur = 0.0
        if arrondir:
            largeur = self._chanfrein(dims, chanfrein, fin)
            bv = ob.modifiers.new('chanfrein', 'BEVEL')
            bv.width = largeur
            bv.segments = 3 if largeur < 0.02 else (4 if largeur < 0.04 else 5)
            bv.limit_method = 'ANGLE'
            bv.angle_limit = math.radians(ANGLE_CHANFREIN)
            bv.use_clamp_overlap = True
            bv.profile = 0.5
        wn = ob.modifiers.new('normales', 'WEIGHTED_NORMAL')
        wn.mode = 'FACE_AREA'
        wn.weight = 50
        wn.keep_sharp = True
        p = Piece(nom, noeud, teinte, ob, tuple(dims), largeur, fin, uv)
        self.noeuds[noeud].pieces.append(p)
        return p

    @staticmethod
    def _placement(centre, rotation=None):
        """La matrice Blender d'une pièce : une rotation (Blender) puis `centre` (modèle)."""
        m = Matrix.Translation(vb(centre))
        return m @ rotation if rotation is not None else m

    @staticmethod
    def _rotation_modele(rotations):
        """Une suite de rotations (axe du modèle, degrés), composées dans l'ordre, en matrice Blender."""
        m = Matrix.Identity(4)
        for axe, degres in rotations or []:
            m = Matrix.Rotation(math.radians(degres), 4, vb(direction(axe))) @ m
        return m

    # --- les primitives de base -------------------------------------------------
    #
    # Toutes prennent `uv` : le dépliage de la pièce dans la case de sa teinte.
    # `boite` projette en boîte (le défaut de toute teinte sans reflet) ;
    # `hauteur` range la pièce du haut vers le bas de la case — c'est ce qui
    # pose le reflet peint du verre sur le tiers **haut** de la pièce, et c'est
    # le défaut d'une teinte à reflet. En boîte, le reflet tomberait au tiers bas
    # des flancs.

    def _mode_uv(self, teinte, uv):
        """Le dépliage d'une pièce : `hauteur` pour une teinte à reflet quand rien n'est demandé, `boite` sinon."""
        if uv is None:
            return 'hauteur' if self.charte.teinte(teinte).get('reflet') else 'boite'
        if uv not in ('boite', 'hauteur'):
            raise ValueError(f'dépliage inconnu : {uv} (boite ou hauteur)')
        return uv

    def boite(self, noeud, centre, taille, teinte, chanfrein=None, rotation=None, fin=False, nom=None, uv=None):
        """
        Une boîte arrondie. `taille` : (largeur x, hauteur y, longueur z) du
        modèle. `rotation` : liste de (axe, degrés) autour du centre.
        """
        sx, sy, sz = taille
        bm = bm_boite((sx, sz, sy))
        return self._piece(bm, noeud, teinte, self._placement(centre, self._rotation_modele(rotation)), (sx, sy, sz), chanfrein, fin,
                           uv=self._mode_uv(teinte, uv), nom=nom)

    def cylindre(self, noeud, centre, rayon, longueur, teinte, axe='y', rayon2=None, chanfrein=None, ellipse=1.0, fin=False, nom=None, uv=None):
        """
        Un cylindre arrondi, d'axe `axe` (un tronc de cône si `rayon2` : `rayon`
        au bout arrière de l'axe, `rayon2` au bout avant). `ellipse` étire la
        section dans la direction perpendiculaire (une tourelle ovale).
        """
        bm = bm_cylindre(rayon, longueur, rayon2, ellipse=ellipse)
        rot = rotation_vers((0, 0, 1), vb(direction(axe)))
        r = max(rayon, rayon2 or 0)
        return self._piece(bm, noeud, teinte, self._placement(centre, rot), (2 * r, 2 * r * ellipse, longueur), chanfrein, fin,
                           uv=self._mode_uv(teinte, uv), nom=nom)

    def capsule(self, noeud, centre, rayon, longueur, teinte, axe='z', nom=None, uv=None):
        """Une capsule (cylindre à bouts ronds), longueur totale le long de `axe`."""
        bm = bm_capsule(rayon, max(longueur, 2 * rayon))
        rot = rotation_vers((0, 0, 1), vb(direction(axe)))
        return self._piece(bm, noeud, teinte, self._placement(centre, rot), (2 * rayon, 2 * rayon, longueur), arrondir=False,
                           uv=self._mode_uv(teinte, uv), nom=nom)

    def boule(self, noeud, centre, rayon, teinte, etirement=(1, 1, 1), nom=None, uv=None):
        """
        Une sphère, étirée par `etirement` (x, y, z du modèle) : une tête, une
        boule-caméra, une bulle de verre (son reflet sur le tiers haut).
        """
        ex, ey, ez = etirement
        bm = bm_boule(rayon, (ex, ez, ey))
        return self._piece(bm, noeud, teinte, self._placement(centre), (2 * rayon * ex, 2 * rayon * ey, 2 * rayon * ez), arrondir=False,
                           uv=self._mode_uv(teinte, uv), nom=nom)

    def prisme(self, noeud, profil, largeur, teinte, centre_x=0.0, chanfrein=None, nom=None, rotation=None, origine=None, uv=None):
        """
        Un profil de côté extrudé en largeur : `profil` est une liste de points
        (z, y) du modèle — l'avant à droite, le haut en haut —, dans l'ordre
        du contour ; `largeur` le long de x, centrée sur `centre_x`. C'est la
        caisse d'un char, un glacis, une rampe. Un profil concave (une marche,
        une clé fendue) est bien fermé : son couvercle est triangulé.

        `rotation` : liste de (axe, degrés), comme `boite`. Sans `origine`, la
        pièce tourne autour du milieu de son emprise. Avec `origine` (un point
        du modèle), le profil est donné **depuis** ce point — (dz, dy) —, la
        largeur y est centrée, et la pièce tourne autour de lui : une plaque
        tenue au poing, une lame qui pend d'une charnière.
        """
        pts = [(-z, y) for z, y in profil]
        bm = bm_prisme(pts, largeur)
        zs = [z for z, _ in profil]
        ys = [y for _, y in profil]
        dims = (largeur, max(ys) - min(ys), max(zs) - min(zs))
        if origine is not None:
            place = Matrix.Translation(vb(origine)) @ self._rotation_modele(rotation)
        else:
            place = self._placement((centre_x, 0, 0))
            if rotation:
                c = vb((centre_x, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
                place = Matrix.Translation(c) @ self._rotation_modele(rotation) @ Matrix.Translation(-c) @ place
        return self._piece(bm, noeud, teinte, place, dims, chanfrein, uv=self._mode_uv(teinte, uv), nom=nom)

    def revolution(self, noeud, centre, profil, teinte, axe='y', chanfrein=None, nom=None, uv=None):
        """
        Un solide de révolution autour de `axe`, passant par `centre` : `profil`
        est une liste de (rayon, position le long de l'axe), du bas vers le haut.
        Un bol, un moyeu, une tourelle bombée, une bouche de canon.
        """
        bm = bm_revolution(profil)
        rot = rotation_vers((0, 0, 1), vb(direction(axe)))
        rmax = max(r for r, _ in profil)
        hs = [h for _, h in profil]
        return self._piece(bm, noeud, teinte, self._placement(centre, rot), (2 * rmax, 2 * rmax, max(hs) - min(hs)), chanfrein,
                           uv=self._mode_uv(teinte, uv), nom=nom)

    def extrusion(self, noeud, bas, haut, y0, y1, teinte, chanfrein=None, nom=None, uv=None):
        """
        Un solide vertical dont la section change du bas au haut : `bas` et
        `haut` sont deux contours (x, z) du modèle, de même nombre de points,
        parcourus dans le même sens (`contour_rectangle` en fait) ; `haut` peut
        rentrer — un chanfrein qui prend la lumière, une épaule — ou valoir None
        (la même section). Le contour peut être concave : un U, un pont évidé.
        La coque d'une barge, un château, un toit qui déborde.
        """
        haut = bas if haut is None else haut
        if len(bas) != len(haut) or len(bas) < 3:
            raise ValueError('extrusion : deux contours de même nombre de points (au moins trois)')
        if not y1 > y0:
            raise ValueError('extrusion : y1 au-dessus de y0')
        bm = bmesh.new()
        _solide_anneaux(bm, [[vb((x, y0, z)) for x, z in bas], [vb((x, y1, z)) for x, z in haut]])
        xs = [x for x, _ in bas] + [x for x, _ in haut]
        zs = [z for _, z in bas] + [z for _, z in haut]
        dims = (max(xs) - min(xs), y1 - y0, max(zs) - min(zs))
        return self._piece(bm, noeud, teinte, Matrix.Identity(4), dims, chanfrein, uv=self._mode_uv(teinte, uv), nom=nom)

    def fuseau(self, noeud, profil, z0, z1, teinte, sections=64, exposants=(2.0, 2.0), nom='fuseau', uv=None):
        """
        Un fuseau lissé le long de z, de `z0` à `z1` : à chaque abscisse, une
        section faite de deux demi-superellipses — `exposants` : le dessus, le
        dessous ; 2 une ellipse, 1 un V (une carène), plus un carré aux coins
        ronds —, donnée par `profil(z)` → (demi-largeur, ligne la plus large,
        hauteur au-dessus, hauteur au-dessous). Tout ce que `fuselage` ne sait
        pas dire : un nez de requin qui tombe, une poutre de queue qui remonte,
        un dos plat sur une carène en V. Sans chanfrein : une surface lisse.
        """
        profils = [profil(z0 + (z1 - z0) * k / sections) for k in range(sections + 1)]
        amax = max(p[0] for p in profils)
        hmax = max(p[2] + p[3] for p in profils) / 2
        n = segments_cercle(max(amax, hmax))
        unite = _section_unite(n, exposants)
        ss = []
        for k, (a, ym, hh, hb) in enumerate(profils):
            z = z0 + (z1 - z0) * k / sections
            ss.append((-z, [(a * ux, ym + (hh if uy >= 0 else hb) * uy) for ux, uy in unite]))
        bm = bm_loft(ss)
        ys = [ym + hh for _, ym, hh, _ in profils] + [ym - hb for _, ym, _, hb in profils]
        dims = (2 * amax, max(ys) - min(ys), z1 - z0)
        return self._piece(bm, noeud, teinte, Matrix.Identity(4), dims, arrondir=False, uv=self._mode_uv(teinte, uv), nom=nom)

    def solide(self, noeud, anneaux, teinte, origine=None, rotation=None, chanfrein=None, fin=False, nom=None, uv=None):
        """
        Un solide fait d'anneaux : `anneaux` est une liste de contours de points
        (x, y, z) du modèle — tous du même nombre de points, parcourus dans le
        même sens —, chacun relié au suivant, les deux extrêmes bouchés (un
        couvercle concave est triangulé). Le moyen public de faire un solide à
        section donnée, sans passer par une fonction privée : une tourelle au
        contour libre (ses sections de bas en haut), un bac ouvert (ses anneaux
        montent dehors puis redescendent dedans), une dalle aux coins ronds, un
        casque à arête.

        Avec `origine`, les points sont donnés depuis ce point, et la pièce
        tourne autour de lui (`rotation`, liste de (axe, degrés)) ; sans, les
        points sont en place et `rotation` tourne autour du milieu de leur
        emprise. Le chanfrein se calcule sur l'emprise des points, comme pour
        toute pièce.
        """
        if len(anneaux) < 2 or len({len(a) for a in anneaux}) != 1 or len(anneaux[0]) < 3:
            raise ValueError('solide : au moins deux anneaux, du même nombre de points (trois au moins)')
        xs = [p[0] for a in anneaux for p in a]
        ys = [p[1] for a in anneaux for p in a]
        zs = [p[2] for a in anneaux for p in a]
        dims = (max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
        bm = bmesh.new()
        _solide_anneaux(bm, [[vb(p) for p in a] for a in anneaux])
        if origine is not None:
            place = Matrix.Translation(vb(origine)) @ self._rotation_modele(rotation)
        elif rotation:
            c = vb(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
            place = Matrix.Translation(c) @ self._rotation_modele(rotation) @ Matrix.Translation(-c)
        else:
            place = Matrix.Identity(4)
        return self._piece(bm, noeud, teinte, place, dims, chanfrein, fin, uv=self._mode_uv(teinte, uv), nom=nom)

    # --- les primitives composées ----------------------------------------------

    def roue(self, noeud, centre, rayon, largeur, teinte_pneu='caoutchouc', teinte_moyeu='os', axe='x', part_moyeu=0.5, nom=None):
        """
        Une roue : un pneu arrondi (généreusement chanfreiné) et un moyeu qui
        dépasse des deux flancs. Rend les deux pièces.
        """
        nom = nom or f'roue_{self._compteur + 1}'
        pneu = self.cylindre(noeud, centre, rayon, largeur, teinte_pneu, axe=axe, chanfrein=0.3 * largeur, nom=f'{nom}_pneu')
        moyeu = self.cylindre(noeud, centre, rayon * part_moyeu, largeur + 0.016, teinte_moyeu, axe=axe, nom=f'{nom}_moyeu')
        return [pneu, moyeu]

    def chenille(self, noeud, x, longueur, hauteur, largeur, y_bas=0.0, z_centre=0.0, teinte='caoutchouc', nom=None):
        """
        Une bande de chenille : un stade (rectangle aux bouts ronds) vu de côté,
        extrudé sur `largeur`, centré en `x`. Les galets se posent à part
        (`galets`), sur sa face extérieure.
        """
        r = hauteur / 2
        demi = max(0.0, longueur / 2 - r)
        yc = y_bas + r
        n = max(8, segments_cercle(r) // 2)
        profil = []
        for k in range(n + 1):  # bout avant, de bas en haut
            a = -math.pi / 2 + math.pi * k / n
            profil.append((z_centre + demi + r * math.cos(a), yc + r * math.sin(a)))
        for k in range(n + 1):  # bout arrière, de haut en bas
            a = math.pi / 2 + math.pi * k / n
            profil.append((z_centre - demi + r * math.cos(a), yc + r * math.sin(a)))
        return self.prisme(noeud, profil, largeur, teinte, centre_x=x, chanfrein=min(0.3 * largeur, 0.03), nom=nom or f'chenille_{"g" if x > 0 else "d"}')

    def galets(self, noeuds, x, zs, y, rayon, epaisseur, teinte='graphite', teinte_moyeu=None, nom='galet', part_moyeu=0.45, meplat=False):
        """
        Des galets (roues de chenille) de part et d'autre : pour chaque z de
        `zs`, un galet à +x et à −x, posés dans le nœud correspondant de
        `noeuds` (un nom, ou une liste, un nœud par essieu pour les faire
        tourner). Le pivot de chaque nœud d'essieu est posé sur son axe.

        `part_moyeu` : le rayon du moyeu (`teinte_moyeu`), en part de celui du
        galet — plus gros, les galets se comptent encore à 48 pixels (le char
        lourd : 0,62). `meplat` : le moyeu est coupé d'un méplat, un « D » qui
        tourne avec l'essieu — un galet rond, centré, ne montre pas qu'il roule.
        Aucune pièce de plus, donc rien sous l'épaisseur minimale.
        """
        if isinstance(noeuds, str):
            noeuds = [noeuds] * len(zs)
        pieces = []
        for i, (z, n) in enumerate(zip(zs, noeuds)):
            if n not in ('racine', 'corps', 'base', 'socle') and not n.startswith('module_'):
                self.noeud(n, pivot=(0, y, z))
            for cote in (1, -1):
                c = (cote * x, y, z)
                pieces.append(self.cylindre(n, c, rayon, epaisseur, teinte, axe='x', chanfrein=0.35 * epaisseur, nom=f'{nom}_{i + 1}_{"g" if cote > 0 else "d"}'))
                if teinte_moyeu:
                    # Le moyeu dépasse du flanc du galet ; jamais plus fin que l'épaisseur minimale.
                    e = max(epaisseur, self.charte.formes['epaisseurMin'])
                    r = max(rayon * part_moyeu, self.charte.formes['epaisseurMin'] / 2 + 0.001)
                    nom_moyeu = f'{nom}_{i + 1}_moyeu_{"g" if cote > 0 else "d"}'
                    xm = cote * (x + epaisseur * 0.2)
                    if not meplat:
                        pieces.append(self.cylindre(n, (xm, y, z), r, e, teinte_moyeu, axe='x', nom=nom_moyeu))
                        continue
                    # Le « D » : le cercle du moyeu, coupé par une corde à 0,4 rayon
                    # du centre, vers le haut au repos ; les points au-delà sont
                    # ramenés sur la corde (alignés : le couvercle reste convexe).
                    # Plus bas que large, le moyeu est jugé avec son galet : il en
                    # est la face, pas une pièce qui se lit seule.
                    k = segments_cercle(r)
                    anneau = []
                    for j in range(k):
                        a = 2 * math.pi * j / k
                        py, pz = r * math.sin(a), r * math.cos(a)
                        anneau.append((min(py, 0.4 * r), pz))
                    anneaux = [[(xm + s * e / 2, y + py, z + pz) for py, pz in anneau] for s in (-1, 1)]
                    moyeu = self.solide(n, anneaux, teinte_moyeu, nom=nom_moyeu)
                    moyeu.avec = pieces[-1].nom
                    pieces.append(moyeu)
        return pieces

    def caisse_char(self, noeud, longueur, largeur, y_bas, hauteur, teinte='equipe', glacis=0.45, arriere=0.25, z_centre=0.0, chanfrein=None, nom='caisse'):
        """
        La caisse d'un char, vue de côté : un fond plat, un glacis avant incliné
        (`glacis` : la part de la hauteur qu'il prend, reculée d'autant), un
        arrière légèrement fuyant (`arriere`), un dessus plat.
        """
        l2 = longueur / 2
        h = hauteur
        g = glacis * h
        a = arriere * h
        profil = [
            (z_centre - l2 + a * 0.6, y_bas),
            (z_centre + l2 - g * 0.9, y_bas),
            (z_centre + l2, y_bas + g),
            (z_centre + l2 - g * 0.9, y_bas + h),
            (z_centre - l2, y_bas + h),
            (z_centre - l2, y_bas + a),
        ]
        return self.prisme(noeud, profil, largeur, teinte, chanfrein=chanfrein, nom=nom)

    def tourelle(self, noeud, centre, largeur, longueur, hauteur, teinte='equipe', forme='ronde', inclinaison=0.18, chanfrein=None, nom='tourelle'):
        """
        Une tourelle posée à `centre` (le milieu de sa base). `ronde` : un tronc
        de cône ovale, bombé par un chanfrein généreux ; `carree` : un tronc de
        pyramide. `inclinaison` : la part dont le dessus se resserre.
        """
        cx, cy, cz = centre
        if forme == 'ronde':
            r = largeur / 2
            return self.cylindre(noeud, (cx, cy + hauteur / 2, cz), r, hauteur, teinte, axe='y', rayon2=r * (1 - inclinaison),
                                 ellipse=longueur / largeur, chanfrein=chanfrein or 0.35 * hauteur, nom=nom)
        bm = bmesh.new()
        dessous = [(-largeur / 2, -longueur / 2), (largeur / 2, -longueur / 2), (largeur / 2, longueur / 2), (-largeur / 2, longueur / 2)]
        k = 1 - inclinaison
        anneaux = [[(x, -z, 0.0) for x, z in dessous], [(x * k, -z * k, hauteur) for x, z in dessous]]
        _solide_anneaux(bm, anneaux)
        return self._piece(bm, noeud, teinte, self._placement((cx, cy, cz)), (largeur, hauteur, longueur), chanfrein, nom=nom)

    def tourelle_profil(self, noeud, centre, contour, hauteur, teinte='equipe', retraits=(0.0, 0.0, 0.0), biseau=0.0, part_biseau=0.45,
                        chanfrein=None, nom='tourelle'):
        """
        Une tourelle au contour libre, posée à `centre` (le milieu de sa base) :
        `contour` est sa base vue de dessus, des points (x, z) depuis le centre,
        dans le sens de `contour_rectangle` — des coins avant coupés, un masque
        en pointe, un nid à l'arrière. Les flancs rentrent en montant de
        `retraits` = (avant, arrière, côtés) en mètres : le dessus est la base
        ramenée d'autant, axe par axe. `biseau` rentre encore le dessus tout
        autour, sur la part `part_biseau` de la hauteur : des flancs peu
        inclinés en bas, un pan qui prend la lumière en haut (la principale
        vient du joueur à 60° : un flanc vertical tourné vers lui reçoit 0,65,
        un pan couché de plus de 25° passe 0,8). Pour ce qu'une homothétie ne
        dit pas, `solide` prend les sections une à une.
        """
        xs = [x for x, _ in contour]
        zs = [z for _, z in contour]
        x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
        avant, arriere, cotes = retraits

        def ramene(a, r, c):
            lx, lz = x1 - x0 - 2 * c, z1 - z0 - a - r
            if lx < 0.01 or lz < 0.01:
                raise ValueError('tourelle_profil : les retraits mangent le dessus')
            return [(x0 + c + (x - x0) * lx / (x1 - x0), z0 + r + (z - z0) * lz / (z1 - z0)) for x, z in contour]

        sections = [(0.0, list(contour))]
        if biseau > 0:
            k = 1 - part_biseau
            sections.append((hauteur * k, ramene(avant * k, arriere * k, cotes * k)))
        sections.append((hauteur, ramene(avant + biseau, arriere + biseau, cotes + biseau)))
        anneaux = [[(x, y, z) for x, z in c] for y, c in sections]
        return self.solide(noeud, anneaux, teinte, origine=centre, chanfrein=chanfrein, nom=nom)

    def tube(self, noeud, depart, direction_tube, longueur, rayon, teinte='graphite', bouche=True, teinte_bouche='acier_clair',
             rayon_bouche=None, longueur_bouche=None, nom='tube'):
        """
        Un tube de canon qui part de `depart` dans `direction_tube` (modèle),
        et sa bouche — un manchon plus large au bout, de `teinte_bouche`. Rend
        les pièces. La bouche est jugée avec son tube : l'épaisseur minimale
        vaut pour le tube et sa bouche ensemble, pas pour un manchon de 4 cm.
        """
        d = direction(direction_tube)
        p0 = Vector(depart)
        centre = p0 + d * (longueur / 2)
        pieces = [self.cylindre(noeud, tuple(centre), rayon, longueur, teinte, axe=tuple(d), nom=nom)]
        if bouche:
            lb = longueur_bouche or max(0.05, 2.2 * rayon)
            rb = rayon_bouche or rayon * 1.45
            cb = p0 + d * (longueur - lb / 2 + 0.004)
            pieces.append(self.cylindre(noeud, tuple(cb), rb, lb, teinte_bouche, axe=tuple(d), nom=f'{nom}_bouche'))
            pieces[-1].avec = pieces[0].nom
        return pieces

    def bac_tubes(self, noeud, centre, colonnes, lignes, rayon_tube, longueur, direction_tubes='z', teinte_bac='equipe',
                  teinte_tubes='os', ecart=None, nom='bac'):
        """
        Un bac de tubes ou de missiles : une boîte, et sur sa face avant une
        grille de `colonnes × lignes` bouts de tubes qui dépassent. Orienté par
        `direction_tubes` (l'avant des tubes).
        """
        e = ecart or 2.6 * rayon_tube
        largeur = colonnes * e + 0.03
        hauteur = lignes * e + 0.03
        d = direction(direction_tubes)
        rot = rotation_vers((0, 0, 1), d)  # repère local (x, y, z) du bac → modèle
        c = Vector(centre)
        pieces = []
        bm = bm_boite((largeur, longueur, hauteur))
        pieces.append(self._piece(bm, noeud, teinte_bac, Matrix.Translation(vb(c)) @ self._rot_blender(rot), (largeur, hauteur, longueur), nom=nom))
        for i in range(colonnes):
            for j in range(lignes):
                lx = (i - (colonnes - 1) / 2) * e
                ly = (j - (lignes - 1) / 2) * e
                local = Vector((lx, ly, longueur / 2 + 0.012))
                p = c + (rot.to_3x3() @ local)
                pieces.append(self.cylindre(noeud, tuple(p), rayon_tube, 0.04, teinte_tubes, axe=tuple(d), nom=f'{nom}_tube_{i}_{j}'))
        return pieces

    @staticmethod
    def _rot_blender(rot_modele):
        """Une rotation exprimée dans le repère du modèle, réécrite pour Blender."""
        passage = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))  # modèle → Blender
        return passage @ rot_modele @ passage.inverted()

    def parabole(self, noeud, centre, rayon, profondeur, direction_parabole, teinte='os', epaisseur=0.02, nom='parabole'):
        """Une parabole : un bol épais, ouvert vers `direction_parabole`, et son cornet au centre."""
        n = 8
        profil = []
        for k in range(n + 1):  # face arrière (convexe), du centre vers le bord
            r = max(0.004, rayon * k / n)
            profil.append((r, profondeur * (r / rayon) ** 2 - epaisseur))
        for k in range(n, -1, -1):  # face avant (concave), du bord vers le centre
            r = max(0.004, rayon * k / n)
            profil.append((r * 0.999, profondeur * (r / rayon) ** 2))
        bm = bm_revolution(profil)
        rot = rotation_vers((0, 0, 1), vb(direction(direction_parabole)))
        piece = self._piece(bm, noeud, teinte, self._placement(centre, rot), (2 * rayon, 2 * rayon, profondeur + epaisseur), chanfrein=0.4 * epaisseur, nom=nom)
        d = direction(direction_parabole)
        cornet = self.cylindre(noeud, tuple(Vector(centre) + d * (profondeur * 0.9)), 0.022, profondeur * 1.4, 'graphite', axe=tuple(d), nom=f'{nom}_cornet')
        return [piece, cornet]

    def antenne(self, noeud, base, hauteur, rayon=0.015, teinte='graphite', inclinaison=None, boule=True, nom='antenne'):
        """
        Une antenne : une tige fine (0,03 m de diamètre, la seule exception à
        l'épaisseur minimale) et une boule au bout. `inclinaison` : (axe, degrés).
        """
        d = Vector((0, 1, 0))
        if inclinaison:
            d = Matrix.Rotation(math.radians(inclinaison[1]), 3, direction(inclinaison[0])) @ d
        p0 = Vector(base)
        pieces = [self.cylindre(noeud, tuple(p0 + d * (hauteur / 2)), rayon, hauteur, teinte, axe=tuple(d), fin=True, nom=nom)]
        if boule:
            pieces.append(self.boule(noeud, tuple(p0 + d * hauteur), rayon * 1.8, teinte, nom=f'{nom}_bout'))
        return pieces

    def rotor(self, noeud, centre, rayon, pales=2, largeur_pale=0.07, epaisseur=0.03, teinte='graphite', axe='y', nom='rotor', angle=0.0):
        """
        Un rotor : `pales` pales opaques (2 à 4, jamais un disque flou) autour
        d'un moyeu. Le nœud est marqué tournant, son axe retenu, et son pivot
        posé sur le centre s'il n'en avait pas : un rotor a son nœud à lui. Une
        pale a le droit d'être fine comme une antenne (`epaisseurMinAntenne`).

        `angle` : les pales au repos, tournées de `angle` degrés autour de l'axe
        (dans le sens de `tourner`) ; à 0, la première pale d'un rotor d'axe y
        pointe vers l'arrière. Une barre à deux pales d'axe y est horizontale à
        l'écran quand `angle` vaut 90° moins le lacet de la vue : 30° en
        « droite », 70° en « bas », 110° en « haut » (90° : presque horizontale
        dans ces deux dernières, que montre la marche).

        La cuisson ne floute pas un nœud tournant (`lot.ts` le marque, la
        cuisson lit la marque) : chaque image montre des pales nettes. Le rotor
        doit donc tourner d'un pas qui se lit image par image — entre le dixième
        et les deux cinquièmes de l'écart entre deux pales, dans le sens de la
        rotation —, ce que `rapport()` vérifie.
        """
        if not 2 <= pales <= 4:
            raise ValueError('un rotor a 2 à 4 pales')
        pivot = None if noeud in self.noeuds and any(self.noeuds[noeud].pivot) else centre
        self.noeud(noeud, pivot=pivot, tournant=True)
        self.noeuds[noeud].axe_tour = axe
        self.noeuds[noeud].pales = pales
        a = direction(axe)
        rot_axe = rotation_vers((0, 0, 1), vb(a))
        pieces = [self.cylindre(noeud, centre, max(0.035, largeur_pale * 0.7), max(0.04, epaisseur * 2.5), teinte, axe=axe, nom=f'{nom}_moyeu')]
        for k in range(pales):
            ang = angle + 360.0 * k / pales
            longueur = rayon - 0.02
            bm = bm_boite((largeur_pale, longueur, epaisseur))  # Blender : x largeur, y longueur, z épaisseur
            bmesh.ops.translate(bm, vec=Vector((0, longueur / 2 + 0.02, 0)), verts=bm.verts)
            place = Matrix.Translation(vb(centre)) @ rot_axe @ Matrix.Rotation(math.radians(ang), 4, 'Z')
            pieces.append(self._piece(bm, noeud, teinte, place, (largeur_pale, epaisseur, longueur), chanfrein=0.45 * epaisseur, fin=True, nom=f'{nom}_pale_{k + 1}'))
        return pieces

    def fuselage(self, noeud, longueur, largeur, hauteur, teinte, y_centre, z_centre=0.0, nez=0.35, queue=0.45, queue_haute=0.3, sections=14,
                 nom='fuselage', nez_forme='rond', nez_y=None, exposants=(2.0, 2.0), dessous=0.5, uv=None):
        """
        Un fuselage lissé le long de z : un nez (`nez` : la part de la longueur
        qui s'affine), une queue effilée qui remonte (`queue`, `queue_haute`).

        - `nez_forme` : `rond` (une demi-ellipse, le défaut) ou `pointu` (une
          ogive qui finit en pointe : un chasseur, un missile, un requin) ;
        - `nez_y` : la hauteur de la pointe, quand elle n'est pas sur l'axe —
          un museau qui tombe ;
        - `exposants` : les deux demi-sections, le dos puis la carène (2 : une
          ellipse ; 1 : un V ; plus : un carré aux coins ronds, un dos plat) ;
        - `dessous` : la part de la hauteur sous la ligne la plus large (0,5 :
          une section symétrique ; 0,6 : une carène profonde sous un dos bas).
        Pour ce qu'aucun réglage ne dit, `fuseau` prend un profil libre.
        """
        if nez_forme not in ('rond', 'pointu'):
            raise ValueError(f'nez inconnu : {nez_forme} (rond ou pointu)')
        n = segments_cercle(max(largeur, hauteur) / 2)
        unite = _section_unite(n, exposants)
        ss = []
        for k in range(sections + 1):
            t = k / sections  # 0 à l'arrière, 1 au nez
            z = z_centre - longueur / 2 + longueur * t
            chute = 0.0
            if t > 1 - nez:
                u = (t - (1 - nez)) / nez
                f = math.sqrt(max(0.0, 1 - u * u)) if nez_forme == 'rond' else max(0.0, 1 - u ** 1.8) ** 0.75
                if nez_y is not None:
                    chute = (nez_y - y_centre) * lisse(u)
            elif t < queue:
                u = 1 - t / queue
                f = 1 - 0.75 * u * u
            else:
                f = 1.0
            f = max(f, 0.06 if nez_forme == 'rond' else 0.02)
            rx = largeur / 2 * f
            hh, hb = hauteur * (1 - dessous) * f, hauteur * dessous * f
            dy = queue_haute * hauteur * max(0.0, 1 - t / queue) if t < queue else 0.0
            ym = y_centre + dy + chute
            ss.append((-z, [(rx * ux, ym + (hh if uy >= 0 else hb) * uy) for ux, uy in unite]))
        bm = bm_loft(ss)
        return self._piece(bm, noeud, teinte, Matrix.Identity(4), (largeur, hauteur, longueur), arrondir=False, uv=self._mode_uv(teinte, uv), nom=nom)

    def aile(self, noeud, emplanture, envergure, corde, epaisseur, teinte, fleche=25.0, effilement=0.55, diedre=0.0, symetrique=True, nom='aile'):
        """
        Une aile : un plan en trapèze, de `corde` à l'emplanture (point du bord
        d'attaque, sur l'axe) et `corde × effilement` au saumon, reculé de la
        flèche, `envergure` de bout en bout. Deux ailes si `symetrique`.
        """
        ex, ey, ez = emplanture
        pieces = []
        cotes = (1, -1) if symetrique else (1,)
        demi = envergure / 2 if symetrique else envergure
        for cote in cotes:
            recul = demi * math.tan(math.radians(fleche))
            c2 = corde * effilement
            y2 = ey + demi * math.tan(math.radians(diedre))
            plan = [(ex, ez), (ex, ez - corde), (ex + cote * demi, ez - recul - c2), (ex + cote * demi, ez - recul)]
            anneaux = [[vb((x, ey - epaisseur / 2 + (y2 - ey) * abs(x - ex) / demi, z)) for x, z in plan],
                       [vb((x, ey + epaisseur / 2 + (y2 - ey) * abs(x - ex) / demi, z)) for x, z in plan]]
            bm = bmesh.new()
            _solide_anneaux(bm, anneaux)
            pieces.append(self._piece(bm, noeud, teinte, Matrix.Identity(4), (demi, epaisseur, corde), chanfrein=0.45 * epaisseur, nom=f'{nom}_{"g" if cote > 0 else "d"}'))
        return pieces

    def coque(self, noeud, longueur, largeur, hauteur, teinte_coque='graphite', teinte_pont='equipe', teinte_flottaison='os',
              flottaison=0.04, proue=0.3, poupe=0.12, pont=0.03, nom='coque'):
        """
        Une coque de navire, posée sur l'eau (y = 0) : une bande de flottaison
        claire de `flottaison` mètres, la coque graphite au-dessus, un pont
        d'équipe en retrait sur le dessus. La proue s'effile sur `proue` de la
        longueur, la poupe s'arrondit sur `poupe`. L'équipe ne touche jamais
        l'eau.
        """
        f = self.charte.donnees['poses']['flottaisonMetres']
        if not f['min'] <= flottaison <= f['max']:
            raise ValueError(f'bande de flottaison de {flottaison} m, la charte veut {f["min"]} à {f["max"]}')
        m = 18

        def demi_largeur(z, k):
            """La demi-largeur de la coque à l'abscisse z : pleine au milieu, en ogive à la proue, un tableau arrondi à la poupe."""
            t = (z + longueur / 2) / longueur  # 0 à la poupe, 1 à la proue
            if proue > 0 and t > 1 - proue:
                u = (t - (1 - proue)) / proue
                f = 1 - u ** 1.8
            elif poupe > 0 and t < poupe:
                u = 1 - t / poupe
                f = 1 - 0.3 * u * u
            else:
                f = 1.0
            return max(0.012, largeur / 2 * k * f)

        def contour(k_largeur):
            """Le contour de la coque vue de dessus, points (x, z) du modèle : le flanc droit de la poupe à la proue, puis le gauche."""
            zs = [-longueur / 2 * k_largeur + longueur * k_largeur * i / (m - 1) for i in range(m)]
            droite = [(-demi_largeur(z / k_largeur, k_largeur), z) for z in zs]
            gauche = [(demi_largeur(z / k_largeur, k_largeur), z) for z in reversed(zs)]
            return droite + gauche

        def tranche(y0, y1, k, teinte, nom_t, fin=False):
            base_pts = contour(k)
            anneaux = [[vb((x, y0, z)) for x, z in base_pts], [vb((x, y1, z)) for x, z in base_pts]]
            bm = bmesh.new()
            _solide_anneaux(bm, anneaux)
            return self._piece(bm, noeud, teinte, Matrix.Identity(4), (largeur * k, y1 - y0, longueur * k), chanfrein=min(0.02, (y1 - y0) * 0.4), fin=fin, nom=nom_t)

        # La bande de flottaison est la seule pièce que la charte veut fine (3 à 5 cm) :
        # l'exception des antennes. Le pont est une dalle de 5 cm enfoncée dans la
        # coque, dont seuls `pont` mètres dépassent.
        epaisseur_pont = max(self.charte.formes['epaisseurMin'], pont)
        return [
            tranche(0.0, flottaison, 1.0, teinte_flottaison, f'{nom}_flottaison', fin=True),
            tranche(flottaison - 0.002, hauteur, 1.0, teinte_coque, nom),
            tranche(hauteur + pont - epaisseur_pont, hauteur + pont, 0.86, teinte_pont, f'{nom}_pont'),
        ]

    def fantassin(self, hauteur=0.8, peau=None, tenue='equipe', bas='graphite', couvre_chef='casque', teinte_couvre_chef='equipe',
                  noeud_corps='corps', noeud_jambes='base', x=0.0, z=0.0, tetes=4.25, carrure=1.9, nom='fantassin',
                  pantalon=None, pose_bras_g=None, pose_bras_d=None, recul_couvre_chef=0.0, tourne_couvre_chef=0.0, bottes=1.0):
        """
        Une figurine humaine de jouet, trapue, de `tetes` têtes de haut (4 à
        4,5) : une tête ronde au visage nu (la peau de l'unité) tourné vers
        l'avant, un couvre-chef d'équipe sans visière (`casque`, `beret`,
        `casquette`, ou None), un torse d'équipe large de `carrure` têtes, des
        bras et des jambes articulés — nœuds `bras_g`, `bras_d`, `jambe_g`,
        `jambe_d`, `tete`, pivots aux épaules, aux hanches et au cou. Rend les
        noms des nœuds, et sous `points` les articulations posées (épaules,
        coudes, mains, centre de la tête, cou, hanches) pour y accrocher une
        arme ou un outil. Aucun socle : le jeu pose l'unité sur sa case.

        - `pantalon` : la teinte des jambes (par défaut, celle de la tenue) ;
        - `pose_bras_g`, `pose_bras_d` : None, le bras pend, droit, comme
          avant ; ou (flexion, écart, coude) en degrés — la flexion lève le bras
          vers l'avant (0 : pendant, 90 : tendu devant, 180 : dressé), l'écart
          l'éloigne du corps sur le côté (négatif : vers le corps), le coude
          plie l'avant-bras vers l'avant ; ou `{'main': (x, y, z)}`, la main
          posée sur un point du modèle (la poignée d'une arme, le manche d'un
          outil), le coude placé par la longueur du bras, vers l'extérieur et le
          bas — `'coude'` le pose aussi. Un bras posé est fait de deux segments
          (`membre`) et d'une main ;
        - `recul_couvre_chef`, `tourne_couvre_chef` : le couvre-chef basculé
          vers la nuque, puis tourné vers la gauche du soldat, en degrés, autour
          du centre de la tête — le visage sort dessous et regarde le joueur
          dans les vues « droite » et « bas » (les trois fantassins : 30 à 36°
          de recul, 45° de tour) ;
        - `bottes` : la taille des bottes (1 : lourdes, 13 à 15 % de la vue
          droite ; 0,7 : moitié moins de masse sombre au sol).
        """
        if not 4 <= tetes <= 4.5:
            raise ValueError('un fantassin de jouet a 4 à 4,5 têtes')
        if not 0.6 <= bottes <= 1.2:
            raise ValueError('bottes : de 0,6 (légères) à 1,2')
        peau = peau or f'peau_{self.cle}'
        pantalon = pantalon or tenue
        H = hauteur
        tete = H / tetes
        r_tete = tete * 0.5
        y_hanche = H * 0.43
        y_epaule = H - tete * 1.05
        y_cou = H - tete * 0.98
        largeur_torse = carrure * tete
        epais_torse = 1.2 * tete
        r_bras = max(0.28 * tete, self.charte.formes['epaisseurMin'] / 2)
        r_jambe = max(0.31 * tete, self.charte.formes['epaisseurMin'] / 2)
        ecart_jambes = 0.3 * tete
        self.noeud(noeud_corps, pivot=(x, y_hanche, z))
        self.noeud(noeud_jambes, pivot=(x, 0, z))
        n_tete = self.noeud('tete', parent=noeud_corps, pivot=(x, y_cou, z))
        n_bg = self.noeud('bras_g', parent=noeud_corps, pivot=(x + largeur_torse / 2, y_epaule, z))
        n_bd = self.noeud('bras_d', parent=noeud_corps, pivot=(x - largeur_torse / 2, y_epaule, z))
        n_jg = self.noeud('jambe_g', parent=noeud_jambes, pivot=(x + ecart_jambes, y_hanche, z))
        n_jd = self.noeud('jambe_d', parent=noeud_jambes, pivot=(x - ecart_jambes, y_hanche, z))
        # Le torse, large et court, et la ceinture.
        self.boite(noeud_corps, (x, (y_hanche + y_epaule) / 2 + 0.01, z), (largeur_torse, y_epaule - y_hanche + 0.05, epais_torse), tenue,
                   chanfrein=0.3 * epais_torse, nom=f'{nom}_torse')
        self.boite(noeud_corps, (x, y_hanche + 0.015, z), (largeur_torse * 0.94, 0.06, epais_torse * 0.96), bas, chanfrein=0.025, nom=f'{nom}_ceinture')
        # La tête : le visage nu tourné vers l'avant, le couvre-chef posé en arrière.
        y_tete = y_cou + r_tete * 0.95
        centre_tete = (x, y_tete, z + 0.01)
        self.boule(n_tete, centre_tete, r_tete, peau, etirement=(1.02, 1.0, 1.0), nom=f'{nom}_tete')
        coiffe = None
        if couvre_chef == 'casque':
            coiffe = self.revolution(n_tete, (x, y_tete + r_tete * 0.05, z - r_tete * 0.15),
                                     [(r_tete * 1.14, 0.0), (r_tete * 1.1, r_tete * 0.3), (r_tete * 0.78, r_tete * 0.88), (r_tete * 0.2, r_tete * 1.06)],
                                     teinte_couvre_chef, axe='y', chanfrein=0.02, nom=f'{nom}_casque')
        elif couvre_chef == 'beret':
            coiffe = self.boule(n_tete, (x + r_tete * 0.15, y_tete + r_tete * 0.72, z - r_tete * 0.08), r_tete * 1.0, teinte_couvre_chef,
                                etirement=(1.08, 0.42, 1.02), nom=f'{nom}_beret')
        elif couvre_chef == 'casquette':
            coiffe = self.revolution(n_tete, (x, y_tete + r_tete * 0.25, z - r_tete * 0.12), [(r_tete * 1.08, 0.0), (r_tete * 0.98, r_tete * 0.45), (r_tete * 0.3, r_tete * 0.78)],
                                     teinte_couvre_chef, axe='y', chanfrein=0.02, nom=f'{nom}_casquette')
        elif couvre_chef is not None:
            raise ValueError(f'couvre-chef inconnu : {couvre_chef}')
        if coiffe is not None and (recul_couvre_chef or tourne_couvre_chef):
            # Basculé vers la nuque (autour de x), puis tourné (autour de y), autour du centre de la tête.
            c = vb(centre_tete)
            m = Matrix.Translation(c) @ self._rotation_modele([('x', -recul_couvre_chef), ('y', -tourne_couvre_chef)]) @ Matrix.Translation(-c)
            coiffe.objet.matrix_world = m @ coiffe.objet.matrix_world
        points = {'tete': centre_tete, 'cou': (x, y_cou, z)}
        # Les bras (de l'épaule au poing) et les jambes (de la hanche à la botte).
        long_bras = y_epaule - y_hanche + 0.02
        for n_b, cote, pose in ((n_bg, 1, pose_bras_g), (n_bd, -1, pose_bras_d)):
            s = 'g' if cote > 0 else 'd'
            xb = x + cote * (largeur_torse / 2 + r_bras * 0.6)
            epaule = (xb, y_epaule - r_bras * 0.5, z)
            if pose is None:
                self.capsule(n_b, (xb, y_epaule - long_bras / 2 + r_bras * 0.5, z), r_bras, long_bras, tenue, axe='y', nom=f'{nom}_bras_{s}')
                main = (xb, y_epaule - long_bras + r_bras * 0.4, z + 0.01)
                coude = (xb, (epaule[1] + main[1]) / 2, z)
            else:
                coude, main = self._pose_bras(epaule, pose, cote, (long_bras - 0.9 * r_bras) / 2)
                self.membre(n_b, epaule, coude, r_bras, tenue, nom=f'{nom}_bras_{s}')
                self.membre(n_b, coude, main, r_bras, tenue, nom=f'{nom}_avant_bras_{s}')
            self.boule(n_b, main, r_bras * 1.15, peau, nom=f'{nom}_main_{s}')
            points.update({f'epaule_{s}': epaule, f'coude_{s}': coude, f'main_{s}': main})
        # La jambe descend dans la botte de 2 cm, quelle que soit la botte.
        y_pied = 0.07 * bottes - 0.02
        for n_j, cote in ((n_jg, 1), (n_jd, -1)):
            s = 'g' if cote > 0 else 'd'
            xj = x + cote * ecart_jambes
            self.capsule(n_j, (xj, (y_hanche + 0.02 + y_pied) / 2, z), r_jambe, y_hanche + 0.02 - y_pied, pantalon, axe='y', nom=f'{nom}_jambe_{s}')
            self.boite(n_j, (xj, 0.035 * bottes, z + 0.025 * bottes), (2.3 * r_jambe, 0.07 * bottes, 3.4 * r_jambe * bottes), bas,
                       chanfrein=0.025, nom=f'{nom}_botte_{s}')
            points[f'hanche_{s}'] = (xj, y_hanche, z)
        return {'tete': n_tete, 'bras_g': n_bg, 'bras_d': n_bd, 'jambe_g': n_jg, 'jambe_d': n_jd, 'points': points}

    @staticmethod
    def _pose_bras(epaule, pose, cote, segment):
        """Le coude et la main d'un bras posé (voir `fantassin`), depuis l'épaule ; `segment` : la longueur du bras et de l'avant-bras."""
        s = Vector(epaule)
        if isinstance(pose, dict):
            m = Vector(pose['main'])
            if pose.get('coude') is not None:
                return tuple(pose['coude']), tuple(m)
            d = m - s
            c = d.length
            if c < 1e-6:
                raise ValueError('pose de bras : la main est sur l’épaule')
            u = d / c
            if c >= 2 * segment:
                return tuple(s + d / 2), tuple(m)
            # Le coude sort vers l'extérieur et vers le bas, comme celui d'un bras qui tient quelque chose.
            p = Vector((cote, -1.0, -0.3))
            w = p - u * p.dot(u)
            if w.length < 1e-6:
                w = Vector((cote, 0.0, 0.0)) - u * (cote * u.x)
            w.normalize()
            cos_a = c / (2 * segment)
            return tuple(s + segment * (cos_a * u + math.sqrt(1 - cos_a * cos_a) * w)), tuple(m)
        flexion, ecart, coude = (list(pose) + [0.0, 0.0, 0.0])[:3]
        phi, eps, kap = math.radians(flexion), math.radians(ecart), math.radians(coude)
        d1 = Vector((cote * math.sin(eps), -math.cos(phi) * math.cos(eps), math.sin(phi) * math.cos(eps)))
        d2 = Vector((cote * math.sin(eps), -math.cos(phi + kap) * math.cos(eps), math.sin(phi + kap) * math.cos(eps)))
        c = s + segment * d1
        return tuple(c), tuple(c + segment * d2)

    def membre(self, noeud, a, b, rayon, teinte, nom=None):
        """
        Un segment de membre d'une articulation `a` à l'autre `b` (points du
        modèle) : une capsule dont les bouts ronds sont centrés sur les
        articulations — deux segments qui se suivent font un coude rond. Un bras
        remodelé, une jambe pliée, un câble raide.
        """
        va, vb_ = Vector(a), Vector(b)
        d = vb_ - va
        if d.length < 1e-6:
            raise ValueError('membre : deux articulations confondues')
        return self.capsule(noeud, tuple((va + vb_) / 2), rayon, d.length + 2 * rayon, teinte, axe=tuple(d.normalized()), nom=nom)

    def retirer(self, noeud, *noms):
        """Retire des pièces déjà posées sur un nœud, par leur nom : celles d'une figurine qu'une pose remplace."""
        n = self.noeuds[noeud]
        for p in list(n.pieces):
            if p.nom in noms:
                bpy.data.objects.remove(p.objet, do_unlink=True)
                n.pieces.remove(p)

    def decaler(self, noeud, dx=0.0, dy=0.0, dz=0.0):
        """Déplace un nœud et ses pièces déjà posées, pivot compris : une jambe qui avance d'un demi-pas, droite, la botte à plat."""
        n = self.noeuds[noeud]
        t = Matrix.Translation(vb((dx, dy, dz)))
        for p in n.pieces:
            p.objet.matrix_world = t @ p.objet.matrix_world
        n.pivot = (n.pivot[0] + dx, n.pivot[1] + dy, n.pivot[2] + dz)

    # --- les clips --------------------------------------------------------------

    def clip(self, nom):
        """Le clip `nom` de la fiche : sa durée et sa boucle sont celles de la fiche."""
        if nom not in self.clips:
            spec = next((a for a in self.fiche['animations'] if a['nom'] == nom), None)
            if spec is None:
                raise KeyError(f'la fiche n’a pas de clip {nom} (elle a : {", ".join(a["nom"] for a in self.fiche["animations"])})')
            self.clips[nom] = Clip(self, nom, spec['dureeMs'] / 1000.0, spec['boucle'])
        return self.clips[nom]

    # --- la fin : fusion, UV, export --------------------------------------------

    def terminer(self):
        """
        Fusionne les pièces de chaque nœud en une maille (chanfrein appliqué,
        UV dans la case de chaque teinte, identifiant de teinte pour les
        mesures), crée la hiérarchie des nœuds, retire les pièces.
        """
        manquants = [a['nom'] for a in self.fiche['animations'] if a['obligatoire'] and a['nom'] not in self.clips]
        if manquants:
            raise ValueError(f'clips obligatoires sans geste : {", ".join(manquants)} (animer(f) doit les remplir)')
        for c in self.clips.values():
            if not c.pistes:
                raise ValueError(f'le clip {c.nom} n’anime rien')
        depsgraph = bpy.context.evaluated_depsgraph_get()
        mats = [self._materiau(n) for n in self.materiaux_fiche]
        self.objets = {}
        for nom in self._ordre_hierarchie():
            n = self.noeuds[nom]
            if n.pieces:
                bm = bmesh.new()
                for p in n.pieces:
                    me = self._appliquer(p, depsgraph)
                    me.transform(Matrix.Translation(-vb(n.pivot)))
                    p.triangles = sum(len(poly.vertices) - 2 for poly in me.polygons)
                    bm.from_mesh(me)
                    bpy.data.meshes.remove(me)
                me_final = bpy.data.meshes.new(nom)
                bm.to_mesh(me_final)
                bm.free()
                for m in mats:
                    me_final.materials.append(m)
                ob = bpy.data.objects.new(nom, me_final)
            else:
                ob = bpy.data.objects.new(nom, None)
                ob.empty_display_type = 'PLAIN_AXES'
            self.scene.collection.objects.link(ob)
            self.objets[nom] = ob
            if n.parent is not None:
                ob.parent = self.objets[n.parent]
                parent_pivot = self.noeuds[n.parent].pivot
                ob.location = vb(tuple(a - b for a, b in zip(n.pivot, parent_pivot)))
        # Une pièce jugée avec une autre : l'emprise des deux, dans le repère de
        # l'hôte (l'axe d'un tube, d'un galet), mesurée tant que les pièces existent.
        for n in self.noeuds.values():
            for p in n.pieces:
                if p.avec:
                    hote = next((q for q in n.pieces if q.nom == p.avec), None)
                    if hote is None:
                        raise ValueError(f'la pièce {p.nom} est jugée avec {p.avec}, absente du nœud {n.nom}')
                    inverse = hote.objet.matrix_world.inverted() @ p.objet.matrix_world
                    pts = [v.co for v in hote.objet.data.vertices] + [inverse @ v.co for v in p.objet.data.vertices]
                    p.epaisseur_jugee = min(max(q[k] for q in pts) - min(q[k] for q in pts) for k in range(3))
        for n in self.noeuds.values():
            for p in n.pieces:
                bpy.data.objects.remove(p.objet, do_unlink=True)

    def _ordre_hierarchie(self):
        vus, ordre = set(), []

        def visiter(nom):
            if nom in vus:
                return
            parent = self.noeuds[nom].parent
            if parent is not None:
                visiter(parent)
            vus.add(nom)
            ordre.append(nom)

        for nom in self.ordre:
            visiter(nom)
        return ordre

    def _appliquer(self, p, depsgraph):
        """La maille d'une pièce, modificateurs appliqués, dans le repère du modèle, avec UV, matériau et identifiant."""
        me = bpy.data.meshes.new_from_object(p.objet.evaluated_get(depsgraph), preserve_all_data_layers=True, depsgraph=depsgraph)
        me.transform(p.objet.matrix_world)
        # Les UV : une projection en boîte, ramenée dans la case de la teinte.
        u0, u1, v0, v1 = self.charte.case(p.teinte)
        co = [v.co.copy() for v in me.vertices]
        xs = [c.x for c in co]
        ys = [c.y for c in co]
        zs = [c.z for c in co]
        mn = Vector((min(xs), min(ys), min(zs)))
        ext = Vector((max(max(xs) - mn.x, 1e-6), max(max(ys) - mn.y, 1e-6), max(max(zs) - mn.z, 1e-6)))
        uv = me.uv_layers.new(name=NOM_UV)
        valeurs = [0.0] * (2 * len(me.loops))
        for poly in me.polygons:
            nx, ny, nz = (abs(c) for c in poly.normal)
            for li in poly.loop_indices:
                c = co[me.loops[li].vertex_index]
                r = (c - mn)
                r = Vector((r.x / ext.x, r.y / ext.y, r.z / ext.z))
                if p.uv == 'hauteur':
                    a, b = (r.x + r.y) / 2, 1 - r.z  # b = 0 en haut de la pièce : le reflet
                elif nz >= nx and nz >= ny:
                    a, b = r.x, r.y
                elif nx >= ny:
                    a, b = r.y, r.z
                else:
                    a, b = r.x, r.z
                u = u0 + (u1 - u0) * a
                v = v0 + (v1 - v0) * b
                valeurs[2 * li] = u
                valeurs[2 * li + 1] = 1 - v  # Blender compte v depuis le bas
        uv.data.foreach_set('uv', valeurs)
        me.polygons.foreach_set('material_index', [self._indice_materiau(p.teinte)] * len(me.polygons))
        r, g, b = self.charte.couleur_id(p.teinte, self.noeuds[p.noeud].tournant)
        attr = me.color_attributes.new(NOM_ID, 'FLOAT_COLOR', 'CORNER')
        lin = (srgb_vers_lineaire(r / 255), srgb_vers_lineaire(g / 255), srgb_vers_lineaire(b / 255), 1.0)
        attr.data.foreach_set('color', list(lin) * len(me.loops))
        return me

    def exporter(self, chemin):
        """Écrit le GLB : géométrie, UV, normales, matériaux sans texture. Les cartes et les clips sont posés par Node (`lot.ts`)."""
        bpy.ops.export_scene.gltf(
            filepath=chemin,
            export_format='GLB',
            use_selection=False,
            export_apply=False,
            export_yup=True,
            export_texcoords=True,
            export_normals=True,
            export_tangents=False,
            export_materials='EXPORT',
            export_vertex_color='NONE',
            export_attributes=False,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
            export_animations=False,
            export_skins=False,
            export_morph=False,
        )

    # --- ce que la fabrication rapporte -----------------------------------------

    def _verifier_rotors(self):
        """
        Un rotor déclaré (`rotor`, qui sait son nombre de pales) est photographié
        net par la cuisson, image par image : son pas apparent — ce qu'il tourne
        d'une image à l'autre, ramené à l'écart entre deux pales — doit aller
        dans le sens de sa rotation, sans tomber sous le dixième de l'écart (il
        paraît figé) ni passer les deux cinquièmes (on ne sait plus dans quel
        sens il tourne, puis il semble tourner à l'envers). Rend les avertissements.
        """
        sortie = []
        for c in self.clips.values():
            ts = _instants(c.duree, c.boucle)
            if len(ts) < 2:
                continue
            for nom, n in self.noeuds.items():
                if not (n.tournant and n.pales and n.axe_tour and (nom, 'rotation') in c.pistes):
                    continue
                axe = direction(n.axe_tour)
                ecart = 360.0 / n.pales
                qs = []
                for t in ts:
                    x, y, z, w = c._valeur(nom, 'rotation', t)
                    qs.append(Quaternion((w, x, y, z)))
                paires = list(zip(qs, qs[1:])) + ([(qs[-1], qs[0])] if c.boucle else [])
                for a, b in paires:
                    d = b @ a.inverted()
                    pas = math.degrees(2 * math.atan2(Vector((d.x, d.y, d.z)).dot(axe), d.w))
                    pas = (pas + 180.0) % 360.0 - 180.0
                    if abs(pas) < 1e-6:
                        continue  # une pose tenue
                    apparent = (pas + ecart / 2) % ecart - ecart / 2
                    if abs(apparent) < 0.1 * ecart or abs(apparent) > 0.4 * ecart or apparent * pas < 0:
                        sortie.append(f'{c.nom} : le rotor {nom} tourne de {abs(pas):.0f}° d’une image cuite à l’autre, '
                                      f'{abs(apparent):.0f}° en apparence pour {ecart:.0f}° entre ses pales — '
                                      f'il paraîtra figé ou tournera à l’envers (visez 10 à 40 % de l’écart)')
                        break
        return sortie

    def rapport(self):
        """Ce que Node lit : nœuds, pièces, teintes, clips échantillonnés, rotations du repos, avertissements."""
        pieces = [
            {'nom': p.nom, 'noeud': p.noeud, 'teinte': p.teinte, 'dimensions': [round(d, 4) for d in p.dimensions],
             'epaisseurMin': round(p.epaisseur_jugee if p.epaisseur_jugee is not None else min(p.dimensions), 4),
             'chanfrein': round(p.chanfrein, 4), 'fin': p.fin, 'triangles': p.triangles, **({'avec': p.avec} if p.avec else {})}
            for n in self.noeuds.values() for p in n.pieces
        ]
        teintes = sorted({p['teinte'] for p in pieces}, key=lambda t: self.charte.index[t])
        noeuds = []
        for nom in self._ordre_hierarchie():
            n = self.noeuds[nom]
            parent_pivot = self.noeuds[n.parent].pivot if n.parent else (0, 0, 0)
            noeuds.append({'nom': nom, 'parent': n.parent, 'pivot': list(n.pivot),
                           'translation': [a - b for a, b in zip(n.pivot, parent_pivot)], 'tournant': n.tournant, 'pieces': len(n.pieces)})
        clips = [c.echantillonner() for c in self.clips.values()]
        rotation_repos = {}
        if 'repos' in self.clips:
            for piste in self.clips['repos'].echantillonner()['pistes']:
                if piste['chemin'] != 'rotation':
                    continue
                pire = 0.0
                for q in piste['valeurs']:
                    w = min(1.0, abs(q[3]))
                    pire = max(pire, math.degrees(2 * math.acos(w)))
                rotation_repos[piste['noeud']] = round(pire, 3)
        return {
            'cle': self.cle, 'id': self.id, 'noeuds': noeuds, 'pieces': pieces, 'teintes': teintes,
            'triangles': sum(p['triangles'] for p in pieces), 'clips': clips, 'rotationRepos': rotation_repos,
            'materiaux': self.materiaux_fiche, 'avertissements': self.avertissements + self._verifier_rotors(),
        }

    def poser(self, clip, t):
        """Pose les objets des nœuds à l'instant `t` d'un clip (ou au repos si `clip` est None) : pour les rendus d'identifiants."""
        valeurs = self.clips[clip].evaluer(t) if clip else {}
        for nom, ob in self.objets.items():
            n = self.noeuds[nom]
            parent_pivot = self.noeuds[n.parent].pivot if n.parent else (0, 0, 0)
            repos = tuple(a - b for a, b in zip(n.pivot, parent_pivot))
            tr, rot, ech = valeurs.get(nom, (repos, (0, 0, 0, 1), (1, 1, 1)))
            ob.location = vb(tr)
            x, y, z, w = rot
            ob.rotation_mode = 'QUATERNION'
            ob.rotation_quaternion = Quaternion((w, x, -z, y))
            ob.scale = (ech[0], ech[2], ech[1])


# ---------------------------------------------------------------------------
# 4. Les clips
# ---------------------------------------------------------------------------

class Clip:
    """
    Un clip : des gestes par nœud, chacun une fonction du temps qui rend un
    **écart** au repos — une translation (dx, dy, dz), une rotation (axe,
    degrés) dans le repère du nœud, une échelle (sx, sy, sz). Les gestes d'un
    même nœud se composent, dans l'ordre où on les pose. Échantillonné à
    `FREQUENCE_CLES` images par seconde.
    """

    def __init__(self, figurine, nom, duree, boucle):
        self.figurine = figurine
        self.nom = nom
        self.duree = duree
        self.boucle = boucle
        self.pistes = {}
        #: Nœud → le centre (point du modèle, ou None : le pivot) de chacune de ses rotations, dans leur ordre.
        self.centres = {}

    def _ajouter(self, noeud, chemin, f, centre=None):
        if noeud not in self.figurine.noeuds:
            raise KeyError(f'nœud inconnu : {noeud}')
        if noeud == 'racine':
            raise ValueError('la racine ne s’anime jamais : le jeu déplace l’unité, le clip reste sur place')
        self.pistes.setdefault((noeud, chemin), []).append(f)
        if chemin == 'rotation':
            self.centres.setdefault(noeud, []).append(None if centre is None else tuple(float(v) for v in centre))
            if centre is not None:
                self.pistes.setdefault((noeud, 'translation'), [])

    def translation(self, noeud, f):
        """`f(t)` → (dx, dy, dz) en mètres, dans le repère du parent au repos."""
        self._ajouter(noeud, 'translation', f)

    def rotation(self, noeud, f, centre=None):
        """
        `f(t)` → (axe, degrés), autour du pivot du nœud — ou autour de `centre`,
        un point du modèle au repos : un canon qui bascule sur ses tourillons
        quand le pivot du nœud est ailleurs (celui que le contrat de production
        impose), une caisse qui roule sur son arête. Le nœud tourne toujours
        autour de son pivot ; ce qui l'en écarte passe dans sa translation,
        calculée ici.
        """
        self._ajouter(noeud, 'rotation', f, centre)

    def echelle(self, noeud, f):
        """`f(t)` → (sx, sy, sz)."""
        self._ajouter(noeud, 'scale', f)

    def instants(self):
        n = max(2, round(self.duree * FREQUENCE_CLES) + 1)
        return [self.duree * k / (n - 1) for k in range(n)]

    def _valeur(self, noeud, chemin, t):
        fs = self.pistes.get((noeud, chemin), [])
        if chemin == 'translation':
            n = self.figurine.noeuds[noeud]
            parent_pivot = self.figurine.noeuds[n.parent].pivot if n.parent else (0, 0, 0)
            v = Vector(tuple(a - b for a, b in zip(n.pivot, parent_pivot)))
            for f in fs:
                v += Vector(f(t))
            return tuple(v + self._compensation(noeud, t))
        if chemin == 'rotation':
            q = Quaternion()
            for f in fs:
                axe, degres = f(t)
                q = Quaternion(direction(axe), math.radians(degres)) @ q
            return (q.x, q.y, q.z, q.w)
        s = Vector((1.0, 1.0, 1.0))
        for f in fs:
            e = f(t)
            s = Vector((s.x * e[0], s.y * e[1], s.z * e[2]))
        return (s.x, s.y, s.z)

    def _compensation(self, noeud, t):
        """
        Ce que les rotations autour d'un centre ajoutent à la translation du
        nœud. Chaque geste k est x → c + r (x − c), c pris depuis le pivot ;
        composés dans leur ordre, ils font x → R x + Σ (r_m … r_k+1)(c_k − r_k c_k),
        et c'est cette somme que la translation porte.
        """
        centres = self.centres.get(noeud, [])
        decalage = Vector((0.0, 0.0, 0.0))
        if not any(c is not None for c in centres):
            return decalage
        pivot = Vector(self.figurine.noeuds[noeud].pivot)
        for f, centre in zip(self.pistes[(noeud, 'rotation')], centres):
            axe, degres = f(t)
            r = Quaternion(direction(axe), math.radians(degres))
            decalage = r @ decalage
            if centre is not None:
                c = Vector(centre) - pivot
                decalage += c - r @ c
        return decalage

    def evaluer(self, t):
        """Nœud → (translation, rotation xyzw, échelle), repère glTF, à l'instant `t`."""
        sortie = {}
        for noeud in {n for n, _ in self.pistes}:
            n = self.figurine.noeuds[noeud]
            parent_pivot = self.figurine.noeuds[n.parent].pivot if n.parent else (0, 0, 0)
            repos = tuple(a - b for a, b in zip(n.pivot, parent_pivot))
            sortie[noeud] = (
                self._valeur(noeud, 'translation', t) if (noeud, 'translation') in self.pistes else repos,
                self._valeur(noeud, 'rotation', t) if (noeud, 'rotation') in self.pistes else (0, 0, 0, 1),
                self._valeur(noeud, 'scale', t) if (noeud, 'scale') in self.pistes else (1, 1, 1),
            )
        return sortie

    def echantillonner(self):
        """Les pistes du clip, clés comprises : ce que `lot.ts` écrit dans le GLB."""
        temps = self.instants()
        pistes = []
        for (noeud, chemin) in sorted(self.pistes):
            valeurs = [list(self._valeur(noeud, chemin, t)) for t in temps]
            if chemin == 'rotation':
                # Hémisphère continu : deux clés voisines ne changent pas de signe.
                for i in range(1, len(valeurs)):
                    if sum(a * b for a, b in zip(valeurs[i], valeurs[i - 1])) < 0:
                        valeurs[i] = [-c for c in valeurs[i]]
            if self.boucle:
                a, b = valeurs[0], valeurs[-1]
                ecart = max(abs(x - y) for x, y in zip(a, b))
                if chemin == 'rotation':
                    ecart = min(ecart, max(abs(x + y) for x, y in zip(a, b)))
                if ecart > 1e-5:
                    raise ValueError(f'{self.nom} boucle, mais {noeud}.{chemin} ne revient pas à sa première pose (écart {ecart:.5f})')
            pistes.append({'noeud': noeud, 'chemin': chemin, 'temps': [round(t, 6) for t in temps],
                           'valeurs': [[round(c, 7) for c in v] for v in valeurs]})
        return {'nom': self.nom, 'duree': self.duree, 'boucle': self.boucle, 'pistes': pistes}


# ---------------------------------------------------------------------------
# 5. Les gestes : des fonctions du temps prêtes à l'emploi
# ---------------------------------------------------------------------------

def _fenetre(t, debut, duree):
    """Le temps local d'un geste, entre 0 et 1, sur [debut, debut + duree]."""
    return min(1.0, max(0.0, (t - debut) / duree)) if duree > 0 else (1.0 if t >= debut else 0.0)


def balancer(clip, noeud, axe, amplitude, periodes=1, phase=0.0, centre=None):
    """
    Un balancement : rotation sinusoïdale de ±`amplitude` degrés, `periodes`
    fois sur le clip — entier, pour boucler. Le signe de vie d'une antenne au
    repos (la charte : 2° au plus).

    `centre`, pour ce geste et les trois suivants (`a_coup`, `secousse`,
    `affaisser`) : un point du modèle autour duquel tourner au lieu du pivot du
    nœud (voir `Clip.rotation`).
    """
    T = clip.duree
    clip.rotation(noeud, lambda t: (axe, amplitude * math.sin(2 * math.pi * periodes * t / T + phase) - amplitude * math.sin(phase)),
                  centre=centre)


def osciller(clip, noeud, direction_osc, amplitude, periodes=1, phase=0.0):
    """Une oscillation en translation de ±`amplitude` mètres le long de `direction_osc` (une suspension)."""
    T = clip.duree
    d = direction(direction_osc)

    def f(t):
        s = amplitude * (math.sin(2 * math.pi * periodes * t / T + phase) - math.sin(phase))
        return tuple(d * s)

    clip.translation(noeud, f)


def tourner(clip, noeud, axe, tours=1):
    """
    Une rotation continue de `tours` tours (entier, pour boucler) : un rotor, un
    galet, une parabole. Un nœud tournant est cuit net, image par image : à 12
    images par boucle, un tour fait 30° d'une image à l'autre (voir `rotor`).
    """
    T = clip.duree
    clip.rotation(noeud, lambda t: (axe, 360.0 * tours * t / T))
    # L'axe sert au masque de ce que la pièce balaie (`fabriquer.py`, `rendre_tournants`).
    clip.figurine.noeuds[noeud].axe_tour = axe


def recul(clip, noeud, direction_recul, distance, debut=0.0, attaque=0.06, retour=0.4):
    """
    Le recul d'un tube : un coup sec de `distance` mètres vers `direction_recul`
    (en `attaque` secondes), puis le retour en douceur (`retour`).
    """
    d = direction(direction_recul)

    def f(t):
        if t < debut:
            return (0.0, 0.0, 0.0)
        if t < debut + attaque:
            k = math.sin(0.5 * math.pi * (t - debut) / attaque)
        else:
            k = 1 - lisse((t - debut - attaque) / retour)
        return tuple(d * (distance * k))

    clip.translation(noeud, f)


def a_coup(clip, noeud, axe, degres, debut=0.0, attaque=0.08, retour=0.4, centre=None):
    """Un basculement bref de `degres` autour de `axe`, puis le retour : la caisse qui encaisse le départ du coup."""
    def f(t):
        if t < debut:
            return (axe, 0.0)
        if t < debut + attaque:
            return (axe, degres * math.sin(0.5 * math.pi * (t - debut) / attaque))
        return (axe, degres * (1 - lisse((t - debut - attaque) / retour)))

    clip.rotation(noeud, f, centre=centre)


def secousse(clip, noeud, axe, degres, debut=0.0, duree=None, oscillations=2.5, centre=None):
    """Une secousse amortie : ±`degres` autour de `axe`, qui s'éteint à la fin (un coup reçu)."""
    D = duree if duree is not None else clip.duree - debut

    def f(t):
        u = _fenetre(t, debut, D)
        if u <= 0 or u >= 1:
            return (axe, 0.0)
        return (axe, degres * math.sin(2 * math.pi * oscillations * u) * (1 - u) ** 2)

    clip.rotation(noeud, f, centre=centre)


def sursaut(clip, noeud, direction_sursaut, distance, debut=0.0, duree=None):
    """Un petit déplacement aller-retour amorti le long de `direction_sursaut` (un coup reçu)."""
    D = duree if duree is not None else clip.duree - debut
    d = direction(direction_sursaut)

    def f(t):
        u = _fenetre(t, debut, D)
        if u <= 0 or u >= 1:
            return (0.0, 0.0, 0.0)
        return tuple(d * (distance * math.sin(math.pi * u) * (1 - u)))

    clip.translation(noeud, f)


def affaisser(clip, noeud, descente=(0.0, 0.0, 0.0), rotation=None, debut=0.0, duree=None, centre=None):
    """
    Une pose qui s'installe et reste : descente (dx, dy, dz) et rotation
    (axe, degrés) atteintes en douceur, puis tenues jusqu'à la fin. `hors_jeu`.
    La rotation se fait autour de `centre` s'il est donné (un affût qui
    s'affaisse sur sa bêche, un canon qui retombe sur ses tourillons).
    """
    D = duree if duree is not None else clip.duree - debut

    def ft(t):
        k = lisse(_fenetre(t, debut, D))
        return tuple(c * k for c in descente)

    clip.translation(noeud, ft)
    if rotation is not None:
        axe, degres = rotation
        clip.rotation(noeud, lambda t: (axe, degres * lisse(_fenetre(t, debut, D))), centre=centre)


def respirer(clip, noeud, amplitude=0.012, periodes=1):
    """La respiration d'une figurine : son torse s'allonge de ±`amplitude` (fraction) en hauteur."""
    T = clip.duree
    clip.echelle(noeud, lambda t: (1.0, 1.0 + amplitude * math.sin(2 * math.pi * periodes * t / T), 1.0))


def fixe(clip, noeud):
    """Un geste nul : pour qu'un clip existe même quand rien ne bouge (un navire au repos qui ne tangue pas)."""
    clip.translation(noeud, lambda t: (0.0, 0.0, 0.0))
