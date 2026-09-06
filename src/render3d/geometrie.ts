/**
 * La géométrie du plateau : **une case = une unité de scène**, sans exception
 * (`BRIEF.md`, « dimensions et échelle : une case = 1 unité de scène »).
 *
 * Tout ce fichier est **pur** — pas de three.js, pas de DOM, pas d'horloge — pour
 * que la conversion case ↔ monde, les hauteurs de terrain et la construction de
 * la carte de mélange (*splat map*) soient vérifiables par `tsx --test`. Le
 * maillage, lui, est bâti dans `terrain.ts` à partir d'exactement ces fonctions :
 * une unité posée à `caseVersMonde(c)` retombe toujours sur le sol de `hauteurEn`.
 *
 * Le repère : `x` de la grille → `+X`, `y` de la grille → `+Z`, altitude → `+Y`.
 * Le centre de la case `(0, 0)` est donc en `(0.5, h, 0.5)`.
 */

import type { Case, CleTerrain } from '../schemas/types';

/** Côté d'une case, en unités de scène. Il ne change pas : c'est l'échelle. */
export const CASE = 1;

/**
 * Relief par terrain, en unités de scène (`BRIEF.md`, « relief léger par
 * terrain »). La montagne monte à 1,0 mais son pic est **adouci** par
 * l'interpolation entre centres de cases : un massif isolé fait une colline,
 * une chaîne fait une crête.
 */
export const HAUTEURS: Readonly<Record<CleTerrain, number>> = {
  plaine: 0,
  foret: 0.05,
  montagne: 1,
  route: 0,
  ville: 0.02,
  qg: 0.02,
  usine: 0.02,
  aeroport: 0,
  mer: -0.4,
  riviere: -0.25,
  pont: 0,
  plage: -0.05,
  radar: 0.02,
};

/** Hauteur d'un terrain, `0` pour un terrain inconnu. */
export function hauteurTerrain(terrain: CleTerrain): number {
  return HAUTEURS[terrain] ?? 0;
}

/** Niveau du plan d'eau : au-dessus des lits de rivière et des fonds marins. */
export const NIVEAU_EAU = -0.12;

/** Centre d'une case, en unités de scène (hors altitude). */
export function caseVersMonde(c: Case): { x: number; z: number } {
  return { x: c.x * CASE + CASE / 2, z: c.y * CASE + CASE / 2 };
}

/** Point du monde → case de la grille. La case peut tomber hors carte. */
export function mondeVersCase(x: number, z: number): Case {
  return { x: Math.floor(x / CASE), y: Math.floor(z / CASE) };
}

/** La grille lue par le maillage : juste de quoi connaître le terrain d'une case. */
export interface GrilleTerrain {
  largeur: number;
  hauteur: number;
  terrainDe(x: number, y: number): CleTerrain;
}

/** Terrain d'une case, avec bords collants : hors carte, on prolonge le bord. */
export function terrainBorne(g: GrilleTerrain, x: number, y: number): CleTerrain {
  const cx = Math.max(0, Math.min(g.largeur - 1, x));
  const cy = Math.max(0, Math.min(g.hauteur - 1, y));
  return g.terrainDe(cx, cy);
}

/** Hauteur au centre d'une case, sans lissage. */
export function hauteurCase(g: GrilleTerrain, x: number, y: number): number {
  return hauteurTerrain(terrainBorne(g, x, y));
}

/**
 * Demi-largeur du **plateau plat** au centre de chaque case, en fraction de case.
 * Une figurine y tient d'aplomb, et le décalque de surbrillance ne s'y déforme pas.
 */
export const REPLI_CENTRE = 0.28;

/**
 * Les terrains qui portent une construction : leur case est plate **d'un bord à
 * l'autre**, et non plus seulement en son centre.
 *
 * Le socle d'un bâtiment fait 0,83 case de côté et son liseré de camp va jusqu'à
 * ±0,46 : il déborde largement du disque de `REPLI_CENTRE`. Sans cette exception,
 * une ville voisine d'une montagne s'enfonce d'un côté et flotte de l'autre —
 * exactement ce que `10-rendu-3d.md` §4.2 interdit : « on ne pose pas un QG sur
 * un talus ».
 */
export const TERRAINS_BATIS: ReadonlySet<CleTerrain> = new Set<CleTerrain>([
  'ville', 'qg', 'usine', 'aeroport', 'radar',
]);

/** Demi-largeur plate d'une case : la case entière quand elle est bâtie. */
export function repliCase(g: GrilleTerrain, x: number, y: number): number {
  return TERRAINS_BATIS.has(terrainBorne(g, x, y)) ? 0.5 : REPLI_CENTRE;
}

/**
 * La rampe qui remplace l'interpolation linéaire entre deux centres de cases :
 * plate au départ sur `repliA`, plate à l'arrivée sur `repliB`, adoucie entre
 * les deux.
 *
 * C'est elle qui tient les deux garde-fous de `10-rendu-3d.md` §4.2. Sans elle,
 * la pente traverse le centre de la case : une figurine penche là où elle
 * devrait être d'aplomb, et un bâtiment se fait couper. Le dénivelé n'est pas
 * supprimé, il est **reporté sur la jonction** entre cases — ce qui donne au
 * passage les gradins d'un plateau de jeu plutôt qu'une dune.
 *
 * Les deux replis peuvent différer, et c'est tout l'intérêt : une case bâtie
 * impose son plateau jusqu'à sa propre frontière sans écraser le relief de sa
 * voisine, qui garde sa hauteur dès son côté de la jonction. Deux cases bâties
 * jointives ne laissent aucune place à la rampe ; on tranche alors au milieu,
 * ce qui ne se voit pas puisqu'elles sont à la même altitude.
 */
function rampeEntre(t: number, repliA: number, repliB: number): number {
  const large = 1 - repliA - repliB;
  if (large <= 0) return t < 0.5 ? 0 : 1;
  const u = Math.max(0, Math.min(1, (t - repliA) / large));
  return u * u * (3 - 2 * u);
}

/** Un repli par arête : celui que la case `a` impose à sa jonction avec `b`. */
type RepliVers = (a: CleTerrain, b: CleTerrain) => number;

/**
 * Le champ d'altitude générique : une interpolation entre les centres de
 * cases, plate au voisinage de chacun (voir `rampeEntre`), dont la hauteur par
 * terrain et le repli par **arête** sont donnés par l'appelant. C'est ce qui
 * permet d'avoir deux champs sur la même grille — la surface où les choses se
 * posent, et le sol qui se creuse sous un pont — sans dupliquer la rampe.
 *
 * Les quatre terrains d'angle ne sont lus **qu'une fois** : cette fonction est
 * appelée pour chaque sommet du maillage, pour chaque arbre, pour chaque rocher,
 * et à chaque image pour chaque unité.
 */
function champAltitude(
  g: GrilleTerrain, x: number, z: number,
  hauteur: (t: CleTerrain) => number, repli: RepliVers,
): number {
  const fx = x / CASE - 0.5;
  const fz = z / CASE - 0.5;
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const u = fx - x0;
  const v = fz - z0;

  const t00 = terrainBorne(g, x0, z0);
  const t10 = terrainBorne(g, x0 + 1, z0);
  const t01 = terrainBorne(g, x0, z0 + 1);
  const t11 = terrainBorne(g, x0 + 1, z0 + 1);
  const h00 = hauteur(t00);
  const h10 = hauteur(t10);
  const h01 = hauteur(t01);
  const h11 = hauteur(t11);

  // Une rampe par arête : les deux rangées n'ont pas forcément le même repli.
  const haut = h00 + (h10 - h00) * rampeEntre(u, repli(t00, t10), repli(t10, t00));
  const bas = h01 + (h11 - h01) * rampeEntre(u, repli(t01, t11), repli(t11, t01));
  const tzGauche = rampeEntre(v, repli(t00, t01), repli(t01, t00));
  const tzDroite = rampeEntre(v, repli(t10, t11), repli(t11, t10));
  // Le passage d'une colonne à l'autre prend le repli **le plus large** des deux :
  // sinon le coin d'un socle mordrait la diagonale d'une montagne, seul endroit
  // où la platitude des bords ne suffit pas.
  const versDroite = rampeEntre(
    u,
    Math.max(repli(t00, t10), repli(t01, t11)),
    Math.max(repli(t10, t00), repli(t11, t01)),
  );
  const tz = tzGauche + (tzDroite - tzGauche) * versDroite;
  return haut + (bas - haut) * tz;
}

/** Le repli de la surface : celui de la case, quelle que soit sa voisine. */
function repliSurface(a: CleTerrain): number {
  return TERRAINS_BATIS.has(a) ? 0.5 : REPLI_CENTRE;
}

/**
 * Le champ d'altitude **continu** du plateau : la **surface**, là où se posent
 * unités, décor et décalques. C'est ce qui donne à la fois les « sommets
 * partagés » — deux cases voisines ne peuvent pas se décoller — et les jonctions
 * adoucies. Sur un pont, c'est le tablier : une unité y roule à hauteur de
 * berge, elle ne descend pas dans le lit.
 */
export function hauteurEn(g: GrilleTerrain, x: number, z: number): number {
  return champAltitude(g, x, z, hauteurTerrain, repliSurface);
}

/** Les terrains sous lesquels le plan d'eau est visible. */
export const TERRAINS_EAU: ReadonlySet<CleTerrain> = new Set<CleTerrain>(['mer', 'riviere']);

/** Ce qu'il y a sous un pont : un lit de rivière, pas une digue. */
function hauteurSolTerrain(t: CleTerrain): number {
  return t === 'pont' ? hauteurTerrain('riviere') : hauteurTerrain(t);
}

/**
 * Le repli du **sol** : celui de la surface, sauf autour d'un pont. La berge
 * tient sa hauteur jusqu'à la culée — repli plein côté terre —, et la fosse
 * s'ouvre juste derrière, dans la case du pont ; sinon la rampe mangerait la
 * moitié de la berge et le tablier flotterait au-dessus d'un talus. Entre le
 * pont et l'eau qu'il franchit, rien ne change : le lit continue.
 */
function repliSol(a: CleTerrain, b: CleTerrain): number {
  const terreA = !TERRAINS_EAU.has(a) && a !== 'pont';
  const terreB = !TERRAINS_EAU.has(b) && b !== 'pont';
  if (b === 'pont' && terreA) return 0.5;
  if (a === 'pont' && terreB) return 0.18;
  return repliSurface(a);
}

/**
 * Le champ d'altitude du **sol** : identique à `hauteurEn` partout, sauf sous
 * les ponts, où il se creuse au niveau du lit pour que l'eau passe dessous.
 * C'est lui que le maillage du terrain, le socle et la profondeur de l'eau
 * lisent ; tout ce qui se **pose** lit `hauteurEn`.
 */
export function hauteurSol(g: GrilleTerrain, x: number, z: number): number {
  return champAltitude(g, x, z, hauteurSolTerrain, repliSol);
}

/** Altitude du sol au centre d'une case : là où se posent unités et décor. */
export function solDeCase(g: GrilleTerrain, c: Case): number {
  const m = caseVersMonde(c);
  return hauteurEn(g, m.x, m.z);
}

// ---------------------------------------------------------------------------
// Carte de mélange (splat map)
// ---------------------------------------------------------------------------

/**
 * Les quatre matières mélangées par le nuanceur du terrain, dans l'ordre des
 * canaux RGBA : **R herbe, G terre et route, B roche, A sable**. La somme d'une
 * case vaut toujours 1 — le nuanceur renormalise quand même, par sécurité.
 */
export type Splat = [herbe: number, terre: number, roche: number, sable: number];

/** Le mélange de matières d'un terrain. */
export function splatTerrain(terrain: CleTerrain): Splat {
  switch (terrain) {
    case 'plaine': return [1, 0, 0, 0];
    case 'foret': return [0.85, 0.15, 0, 0];
    case 'montagne': return [0.08, 0.04, 0.88, 0];
    // La route ne repeint pas toute sa case : c'est la bande de bitume posée
    // par `terrain.ts` qui la dessine, la splat n'apporte que ses bas-côtés.
    case 'route': return [0.55, 0.45, 0, 0];
    // Sous un pont, le sol est un lit de rivière : il se peint comme elle.
    case 'pont': return [0.1, 0.3, 0, 0.6];
    case 'ville': return [0.25, 0.75, 0, 0];
    case 'qg': return [0.2, 0.8, 0, 0];
    case 'usine': return [0.15, 0.85, 0, 0];
    case 'aeroport': return [0.1, 0.9, 0, 0];
    case 'radar': return [0.15, 0.85, 0, 0];
    case 'plage': return [0.05, 0, 0, 0.95];
    case 'riviere': return [0.1, 0.3, 0, 0.6];
    case 'mer': return [0, 0, 0.1, 0.9];
    default: return [1, 0, 0, 0];
  }
}

/** Le mélange d'une case de la grille. */
export function splatCase(g: GrilleTerrain, x: number, y: number): Splat {
  return splatTerrain(terrainBorne(g, x, y));
}

/**
 * Construit la texture de mélange : un octet par canal et par case, lue en
 * filtrage linéaire par le nuanceur — c'est ce filtrage qui fond les lisières
 * sans qu'on ait à flouter quoi que ce soit à la main.
 */
export function construireSplat(g: GrilleTerrain): Uint8Array<ArrayBuffer> {
  const donnees = new Uint8Array(new ArrayBuffer(g.largeur * g.hauteur * 4));
  for (let y = 0; y < g.hauteur; y += 1) {
    for (let x = 0; x < g.largeur; x += 1) {
      const s = splatCase(g, x, y);
      const i = (y * g.largeur + x) * 4;
      donnees[i] = Math.round(s[0] * 255);
      donnees[i + 1] = Math.round(s[1] * 255);
      donnees[i + 2] = Math.round(s[2] * 255);
      donnees[i + 3] = Math.round(s[3] * 255);
    }
  }
  return donnees;
}

/** Les huit voisines d'une case, dans l'ordre horaire depuis le nord. */
export const VOISINES: readonly (readonly [number, number])[] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

/** Un aléa déterministe par case : deux montages rendent le même décor. */
export function alea(x: number, y: number, sel = 0): number {
  let n = (x * 374_761_393 + y * 668_265_263 + sel * 2_246_822_519) | 0;
  n = (n ^ (n >>> 13)) * 1_274_126_177;
  n = (n ^ (n >>> 16)) >>> 0;
  return n / 4_294_967_296;
}

// ---------------------------------------------------------------------------
// Voies : routes et ponts
// ---------------------------------------------------------------------------

/**
 * Les formes de pièce d'une voie, et leurs liaisons **canoniques** dans l'ordre
 * `[nord, est, sud, ouest]`. Toute autre configuration s'obtient en tournant une
 * de ces six pièces par quarts de tour horaires : c'est ce qui permet de ne
 * peindre que six tuiles par biome.
 */
export type FormeVoie = 'bout' | 'droite' | 'virage' | 'te' | 'croix' | 'isole';

/** Les quatre liaisons d'une case, dans l'ordre `[nord, est, sud, ouest]`. */
export type Liaisons = readonly [boolean, boolean, boolean, boolean];

export const LIAISONS_CANON: Readonly<Record<FormeVoie, Liaisons>> = {
  isole: [false, false, false, false],
  bout: [true, false, false, false],
  droite: [true, false, true, false],
  virage: [true, true, false, false],
  te: [true, true, true, false],
  croix: [true, true, true, true],
};

/** Une pièce posée : sa forme et son nombre de quarts de tour horaires. */
export interface PieceVoie {
  forme: FormeVoie;
  rotation: 0 | 1 | 2 | 3;
}

/** Tourne des liaisons d'un quart de tour horaire : le nord passe à l'est. */
export function tournerLiaisons(l: Liaisons, quarts: number): Liaisons {
  const k = ((quarts % 4) + 4) % 4;
  return [l[(4 - k) % 4]!, l[(5 - k) % 4]!, l[(6 - k) % 4]!, l[(7 - k) % 4]!];
}

/**
 * La pièce à poser pour des liaisons données : la forme canonique et la
 * rotation qui la ramène sur ces liaisons. Il y en a toujours exactement une —
 * les seize configurations se répartissent entre les six formes.
 */
export function pieceDepuisLiaisons(l: Liaisons): PieceVoie {
  for (const forme of Object.keys(LIAISONS_CANON) as FormeVoie[]) {
    for (const rotation of [0, 1, 2, 3] as const) {
      const t = tournerLiaisons(LIAISONS_CANON[forme], rotation);
      if (t[0] === l[0] && t[1] === l[1] && t[2] === l[2] && t[3] === l[3]) return { forme, rotation };
    }
  }
  // Inatteignable : les six formes couvrent les seize cas. On rend la croix
  // plutôt que de lever — une voie mal raccordée vaut mieux qu'un plateau vide.
  return { forme: 'croix', rotation: 0 };
}

/** Une voie : une case qui porte un revêtement. */
export function estVoie(t: CleTerrain): boolean {
  return t === 'route' || t === 'pont';
}

/**
 * Ce à quoi une voie se raccorde : une autre voie, ou un bâtiment — une route
 * mène quelque part, et son bout s'arrête au socle de la ville. Hors carte, le
 * bord est prolongé (`terrainBorne`) : une route qui touche le bord du diorama
 * continue au-delà, elle ne finit pas en moignon.
 */
export function relieVoie(t: CleTerrain): boolean {
  return estVoie(t) || TERRAINS_BATIS.has(t);
}

/** Les liaisons d'une case, lues sur ses quatre voisines. */
export function liaisonsVoie(g: GrilleTerrain, x: number, y: number): Liaisons {
  return [
    relieVoie(terrainBorne(g, x, y - 1)),
    relieVoie(terrainBorne(g, x + 1, y)),
    relieVoie(terrainBorne(g, x, y + 1)),
    relieVoie(terrainBorne(g, x - 1, y)),
  ];
}

/** L'axe d'un pont : nord-sud ou est-ouest, celui de la circulation. */
export type AxePont = 'ns' | 'eo';

/**
 * L'axe d'un pont, lu sur ses voisines : les voies qu'il relie comptent double,
 * l'eau qu'il franchit compte simple — un pont relie deux rives, donc l'eau
 * est **à ses côtés**, pas dans son axe. Sans aucun indice, nord-sud.
 */
export function axePont(g: GrilleTerrain, x: number, y: number): AxePont {
  const [n, e, s, o] = liaisonsVoie(g, x, y);
  const eau = (dx: number, dy: number): number => (TERRAINS_EAU.has(terrainBorne(g, x + dx, y + dy)) ? 1 : 0);
  const versNs = (n ? 2 : 0) + (s ? 2 : 0) + eau(1, 0) + eau(-1, 0);
  const versEo = (e ? 2 : 0) + (o ? 2 : 0) + eau(0, 1) + eau(0, -1);
  return versEo > versNs ? 'eo' : 'ns';
}

/**
 * La pièce d'une case, ou `null` si elle ne porte pas de voie. Un pont est
 * toujours **droit** dans son axe : un pont isolé ou en bout ne finit pas en
 * moignon sur l'eau, il traverse.
 */
export function pieceDeCase(g: GrilleTerrain, x: number, y: number): PieceVoie | null {
  const t = terrainBorne(g, x, y);
  if (!estVoie(t)) return null;
  const piece = pieceDepuisLiaisons(liaisonsVoie(g, x, y));
  if (t === 'pont' && (piece.forme === 'isole' || piece.forme === 'bout')) {
    return { forme: 'droite', rotation: axePont(g, x, y) === 'eo' ? 1 : 0 };
  }
  return piece;
}
