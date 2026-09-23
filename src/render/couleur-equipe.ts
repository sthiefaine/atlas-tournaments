/**
 * # La couleur d'équipe à l'écran
 *
 * Charte des figurines, §3.11 (23 septembre 2026) ; le détail chiffré est dans
 * `doc/refonte/panel-sprites/avis-designeuse.md` (G.5) et la règle 14 de
 * `avis-artiste-technique.md`.
 *
 * Le lot pose la couleur d'une armée par `cuite × mix(1, équipe, masque)` : elle
 * **multiplie un blanc ombré**, et un panneau vaut à l'écran de 0,92 (dessus) à
 * 0,55 (flanc à l'ombre) de sa couleur. Trop sombre, elle tombe dans le
 * graphite des châssis (`#30343b`) ; sans chroma, elle devient un gris — et le
 * gris veut déjà dire « à personne », celui des bâtiments neutres (`#b9bec7`).
 * L'Islande (`#5b6f86`) était ce gris, la Nouvelle-Zélande (`#2f5f4f`) tombait
 * dans le graphite à l'ombre, et la Suisse, le Canada et le Pérou portaient la
 * même couleur au caractère près. Deux règles, et ce sont les seules :
 *
 * 1. **La projection** (`projeterCouleurEquipe`). En OKLab, une couleur d'armée
 *    tient une clarté L de 0,60 à 0,76 et une chroma d'au moins 0,10. Hors de
 *    cette fenêtre, on la ramène **à teinte égale** : clarté bornée, chroma
 *    relevée. Une couleur déjà dedans passe telle quelle, à l'octet près. Le
 *    neutre, lui, ne se projette jamais : c'est lui que la projection protège.
 * 2. **La séparation** (`palettesDesCamps`). Deux camps d'une même carte gardent
 *    au moins `ECART_ENTRE_CAMPS` (ΔE en OKLab × 100) entre leurs couleurs
 *    affichées ; sinon le camp de rang le plus élevé — celui qui joue après —
 *    reprend **la couleur de son camp** (bleu, rouge, vert, or, projetées).
 *
 * Le ΔE est la distance euclidienne en OKLab, multipliée par 100 : c'est celle
 * de la designeuse, et ses chiffres se retrouvent au dixième près (l'Islande
 * projetée à 28,8 du graphite, la Grèce à 3,1 du camp bleu, l'Argentine à 13,2
 * du neutre ; `tests/render/couleur-equipe.test.ts`). Pas CIEDE2000 : son
 * échelle est autre — le vert et l'or y sont à 34 au lieu de 18, le rouge et
 * l'or à 41 au lieu de 22 —, et le seuil de 25 de la charte n'y voudrait plus
 * rien dire.
 */

import type { CampId, Couleur, Palette } from '../schemas/types';
import { NATIONS, PALETTES, paletteDe } from './palettes';

/** La fenêtre lisible d'une couleur d'armée, en OKLab (charte §3.11). */
export const FENETRE_EQUIPE = { clarteMin: 0.6, clarteMax: 0.76, chromaMin: 0.1 } as const;

/**
 * Ce qu'un octet de sRGB déplace en OKLab, au plus, sur ces couleurs : la
 * fenêtre se lit **à l'octet près**. Sans elle, une couleur projetée pile sur
 * le bord — la Nouvelle-Zélande, `#339377`, L 0,599 et chroma 0,0994 une fois
 * arrondie — sortirait d'un millième, et une seconde projection la déplacerait
 * encore (`#329377`) : la projection ne serait plus une projection. Mesuré sur
 * les 28 couleurs : l'arrondi sort de la fenêtre d'au plus 0,0010 en clarté et
 * 0,0006 en chroma.
 */
export const TOLERANCE_OCTET = 0.002;

/** L'écart minimal entre les couleurs de deux camps d'une même carte, en ΔE OKLab × 100. */
export const ECART_ENTRE_CAMPS = 25;

/** Le gris des bâtiments neutres et des pièces sans camp : il ne se projette jamais. */
export const COULEUR_NEUTRE: Couleur = PALETTES.neutre.main;

/**
 * En deçà de cette chroma, une couleur n'a plus de teinte qu'OKLab sache lire —
 * un gris parfait : la projection lui donne celle du camp bleu (`teinteRepli`),
 * comme à l'Islande, qui était le gris le plus proche. Aucune nation n'est un
 * gris parfait, la charte le refuse : ceci ne sert qu'à rendre la projection
 * totale.
 */
const CHROMA_SANS_TEINTE = 1e-4;

/** Une couleur en OKLab : `L` la clarté, de 0 à 1 ; `a` et `b` les deux axes de la teinte. */
export interface Oklab { L: number; a: number; b: number }

/** Trois canaux sRGB, de 0 à 1. */
type Canaux = [number, number, number];

// ---------------------------------------------------------------------------
// 1. sRGB ↔ OKLab (Björn Ottosson, 2020)
// ---------------------------------------------------------------------------

/** Les trois canaux d'un `#rrggbb`, de 0 à 1. Illisible : du noir, comme `lireCouleur`. */
export function canauxDe(hex: string): Canaux {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Trois canaux de 0 à 1 en `#rrggbb` minuscule, bornés puis arrondis à l'octet. */
export function hexDe(c: readonly [number, number, number]): Couleur {
  const octet = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `#${octet(c[0])}${octet(c[1])}${octet(c[2])}`;
}

function versLineaire(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function versGamma(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}

/** Une couleur `#rrggbb` en OKLab. */
export function oklabDe(hex: string): Oklab {
  const [r, v, b] = canauxDe(hex).map(versLineaire) as Canaux;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * v + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * v + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * v + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Une couleur OKLab en sRGB de 0 à 1, **sans borner** : un canal hors de [0, 1] dit qu'elle sort du gamut. */
function canauxDepuisOklab(o: Oklab): Canaux {
  const l = (o.L + 0.3963377774 * o.a + 0.2158037573 * o.b) ** 3;
  const m = (o.L - 0.1055613458 * o.a - 0.0638541728 * o.b) ** 3;
  const s = (o.L - 0.0894841775 * o.a - 1.291485548 * o.b) ** 3;
  return [
    versGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    versGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    versGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function dansGamut(c: Canaux): boolean {
  return c.every((v) => v >= -1e-9 && v <= 1 + 1e-9);
}

/** Clarté, chroma et teinte (en radians) d'une couleur : OKLab en coordonnées polaires. */
export function clarteChroma(hex: string): { clarte: number; chroma: number; teinte: number } {
  const o = oklabDe(hex);
  return { clarte: o.L, chroma: Math.hypot(o.a, o.b), teinte: Math.atan2(o.b, o.a) };
}

/** L'écart entre deux couleurs : la distance OKLab, multipliée par 100 (le ΔE de la charte). */
export function ecartCouleurs(x: string, y: string): number {
  const a = oklabDe(x);
  const b = oklabDe(y);
  return 100 * Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

// ---------------------------------------------------------------------------
// 2. La projection
// ---------------------------------------------------------------------------

/** Vrai si une couleur tient la fenêtre, à `tolerance` près. */
export function dansFenetre(hex: string, tolerance = 0): boolean {
  const { clarte, chroma } = clarteChroma(hex);
  const f = FENETRE_EQUIPE;
  return clarte >= f.clarteMin - tolerance && clarte <= f.clarteMax + tolerance && chroma >= f.chromaMin - tolerance;
}

/**
 * Ramène une couleur d'armée dans la fenêtre lisible, **à teinte égale** : la
 * clarté est bornée à [0,60 ; 0,76], la chroma relevée à 0,10 au moins. Une
 * couleur déjà dedans — à l'octet près — passe telle quelle : la projection est
 * idempotente, et les bleu, rouge et vert des camps ne bougent pas d'un octet.
 *
 * Une chroma que le sRGB ne tient pas à la nouvelle clarté se réduit, jamais
 * sous le plancher : partout dans la fenêtre, le sRGB tient au moins 0,102 de
 * chroma (mesuré, teinte 200°, à L 0,60). Rend un `#rrggbb` minuscule.
 */
export function projeterCouleurEquipe(hex: string): Couleur {
  const propre = hexDe(canauxDe(hex));
  if (dansFenetre(propre, TOLERANCE_OCTET)) return propre;
  const o = oklabDe(propre);
  const f = FENETRE_EQUIPE;
  const chroma = Math.hypot(o.a, o.b);
  const clarte = Math.min(f.clarteMax, Math.max(f.clarteMin, o.L));
  const teinte = chroma > CHROMA_SANS_TEINTE ? Math.atan2(o.b, o.a) : teinteRepli();
  const vers = (c: number): Canaux => canauxDepuisOklab({ L: clarte, a: c * Math.cos(teinte), b: c * Math.sin(teinte) });
  let haut = Math.max(chroma, f.chromaMin);
  let canaux = vers(haut);
  if (!dansGamut(canaux)) {
    // La plus forte chroma que le sRGB tient à cette clarté et cette teinte,
    // entre le plancher (toujours tenu) et celle qu'on voulait.
    let bas: number = f.chromaMin;
    for (let i = 0; i < 32; i += 1) {
      const milieu = (bas + haut) / 2;
      if (dansGamut(vers(milieu))) bas = milieu;
      else haut = milieu;
    }
    canaux = vers(bas);
  }
  return hexDe(canaux);
}

let memoTeinteRepli: number | null = null;
/** La teinte du camp bleu, lue une fois. */
function teinteRepli(): number {
  memoTeinteRepli ??= clarteChroma(PALETTES.bleu.main).teinte;
  return memoTeinteRepli;
}

/** Une palette dont la couleur principale est projetée ; le sombre et le clair restent ceux qu'on a dessinés. */
export function paletteProjetee(p: Palette): Palette {
  return { main: projeterCouleurEquipe(p.main), dark: p.dark, light: p.light };
}

/**
 * La palette d'armée d'un camp **sans nation** : celle de son camp, projetée —
 * seul l'or bouge (`#e9b93a` → `#d9aa23`, il rejoignait le sable et l'herbe
 * claire). Sans camp, le gris neutre, jamais projeté. C'est ce que l'interface
 * peint quand aucune peau ne lui dit mieux, et ce que reprend un camp dont la
 * nation est trop proche d'un autre : la séparation n'invente aucune couleur.
 */
export function paletteArmeeParDefaut(camp: CampId | null): Palette {
  return camp === null ? PALETTES.neutre : paletteProjetee(paletteDe(camp));
}

// ---------------------------------------------------------------------------
// 3. La séparation des camps d'une carte
// ---------------------------------------------------------------------------

/** Un camp d'une carte, et la palette de sa nation — `null` sans nation : celle de son camp. */
export interface CampNation {
  camp: CampId;
  nation: Palette | null;
}

/**
 * Les palettes d'armée d'une carte. Chaque camp a ses **préférences**, dans
 * l'ordre : sa nation projetée (sa couleur de camp, sans nation), puis **la
 * couleur de son camp** projetée — la règle de la charte —, puis les autres
 * couleurs de camp, bleu, rouge, vert, or. La carte prend la première
 * coloration qui tient `ECART_ENTRE_CAMPS` entre **tous** ses camps, en
 * servant d'abord les préférences du camp 0 — d'ordinaire le joueur —, puis
 * celles du camp 1, et ainsi de suite : c'est le camp qui joue après qui cède.
 *
 * Entre deux camps, c'est exactement la règle de la charte, et elle tient
 * toujours : le camp 0 garde sa nation, le camp 1 la sienne si elle est assez
 * loin, sinon la couleur de son camp, sinon — la Suisse contre le Canada, dont
 * le rouge de camp est à 2,4 du rouge suisse — la première couleur de camp qui
 * tient l'écart. Mesuré sur les 24 nations et les camps sans nation : 600 cas
 * sur 600 (`tests/render/couleur-equipe.test.ts`).
 *
 * À trois camps, elle tient encore partout : les 12 144 triplets ordonnés de
 * nations, mesurés. À quatre, jamais : les quatre couleurs de camp ne sont
 * elles-mêmes qu'à 18,1 l'une de l'autre au plus près (vert et or). La carte
 * prend alors la coloration dont les deux camps les plus proches sont **le
 * plus loin** l'un de l'autre, la première dans le même ordre à égalité —
 * jamais pire que les seules couleurs de camp, qui sont le recours de la
 * charte : les 255 024 quaternes ordonnés de nations tiennent tous 18,1. Une
 * recherche gloutonne, camp après camp, descendait à 11,5 — les Pays-Bas au
 * camp 1 gardaient leur orange, que l'or du camp 3 ne pouvait plus fuir. Au plus
 * cinq préférences par camp et quatre camps : 625 colorations au pire, de
 * l'ordre d'une milliseconde, une fois par carte. Aucune couleur n'est inventée.
 *
 * Rend une palette par camp donné, dans n'importe quel ordre ; un camp répété
 * ne compte qu'une fois, le premier.
 */
export function palettesDesCamps(camps: readonly CampNation[]): Map<CampId, Palette> {
  const liste: CampNation[] = [];
  for (const c of [...camps].sort((x, y) => x.camp - y.camp)) {
    if (!liste.some((d) => d.camp === c.camp)) liste.push(c);
  }
  const options = liste.map(({ camp, nation }) => preferences(camp, nation));
  const ecarts = new Map<string, number>();
  const ecart = (x: Couleur, y: Couleur): number => {
    const cle = x < y ? `${x}${y}` : `${y}${x}`;
    let e = ecarts.get(cle);
    if (e === undefined) {
      e = ecartCouleurs(x, y);
      ecarts.set(cle, e);
    }
    return e;
  };

  // Les colorations, dans l'ordre des préférences, le camp 0 d'abord : la
  // première qui tient l'écart partout arrête tout ; sinon on retient celle
  // dont l'écart le plus serré est le plus large, la première à égalité.
  const choix: number[] = [];
  const retenue: { choix: readonly number[]; plusSerre: number } = { choix: [], plusSerre: Number.NEGATIVE_INFINITY };
  const explorer = (i: number, plusSerre: number): boolean => {
    const ici = options[i];
    if (!ici) {
      if (plusSerre > retenue.plusSerre) {
        retenue.choix = [...choix];
        retenue.plusSerre = plusSerre;
      }
      return plusSerre >= ECART_ENTRE_CAMPS;
    }
    for (let k = 0; k < ici.length; k += 1) {
      const couleur = ici[k]!.main;
      let e = plusSerre;
      for (let j = 0; j < i; j += 1) e = Math.min(e, ecart(couleur, options[j]![choix[j]!]!.main));
      // Une branche qui ne tient plus l'écart ne peut que se resserrer : elle ne
      // sert que si elle peut encore battre la meilleure coloration trouvée.
      if (e < ECART_ENTRE_CAMPS && e <= retenue.plusSerre) continue;
      choix[i] = k;
      if (explorer(i + 1, e)) return true;
    }
    return false;
  };
  explorer(0, Number.POSITIVE_INFINITY);

  const sortie = new Map<CampId, Palette>();
  liste.forEach(({ camp }, i) => {
    sortie.set(camp, options[i]![retenue.choix[i] ?? 0] ?? paletteArmeeParDefaut(camp));
  });
  return sortie;
}

/** Les palettes qu'un camp peut prendre, dans l'ordre où il les préfère ; une couleur n'y paraît qu'une fois. */
function preferences(camp: CampId, nation: Palette | null): Palette[] {
  const liste: Palette[] = [];
  const ajouter = (p: Palette): void => {
    if (!liste.some((q) => q.main === p.main)) liste.push(p);
  };
  if (nation) ajouter(paletteProjetee(nation));
  ajouter(paletteArmeeParDefaut(camp));
  for (const n of NATIONS) ajouter(paletteProjetee(PALETTES[n]));
  return liste;
}
