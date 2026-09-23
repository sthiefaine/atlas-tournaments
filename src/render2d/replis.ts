/**
 * Les **images de repli** : ce que la peau 2D peint elle-même quand une image
 * cuite manque ou n'est pas encore arrivée (`atlas.ts`).
 *
 * Elles portent la règle de la peau — **le jeu se joue entièrement sans aucune
 * image cuite** — et rien de plus : des formes simples, lisibles à 48 pixels par
 * case, dans la bonne projection (tangage 50°, `versPlan`), pivot au sol au
 * centre de la case comme une image cuite. Une unité est la silhouette du HUD
 * (`render/sprites/silhouettes.ts`), le même dessin que sa vignette : ce qu'on
 * lit dans le menu de production se retrouve sur la carte.
 *
 * Chaque repli est **peint à sa couleur d'équipe** — une image par couleur —,
 * là où une image cuite reçoit la sienne par son masque. Un repli n'a donc
 * jamais de masque, et c'est voulu : il est exact sans nuanceur.
 *
 * On ne sait l'image d'un repli que par son **identifiant**, qui suit celui des
 * entrées du manifeste (`idUnite`, `idBatiment`, `idDecor`), plus quelques
 * formes du rendu lui-même (`FORMES`) : ombre, écume, mât, drapeau, badges.
 */

import type { Catalogue } from '../engine/index';
import type { Palette, Silhouette } from '../schemas/types';
import type { Pinceau } from '../render/sprites/formes';
import { dessinerUnite, echelleTaille } from '../render/sprites/silhouettes';
import {
  COS_TANGAGE, ECUME_NAVIRE, ESSENCES_DECOR, OMBRE_UNITE, PIXELS_PAR_CASE, SIN_TANGAGE, type EssenceDecor,
} from './contrat';
import type { PeintreRepli, ReplisPeint, SourceImage } from './atlas';

/** Pixels d'image par pixel de plan : de quoi rester net jusqu'au zoom d'un double-tap. */
export const DENSITE_REPLI = 1.5;

/** Les formes que le rendu pose lui-même, par identifiant. */
export const FORMES = Object.freeze({
  ombre: 'forme_ombre',
  /** L'écume sous un navire, à la place de l'ombre (`ECUME_NAVIRE`). */
  ecume: 'forme_ecume',
  mat: 'forme_mat',
  drapeau: 'forme_drapeau',
  pv: (pv: number, agie: boolean): string => `forme_pv_${Math.max(0, Math.min(9, Math.round(pv)))}${agie ? '_a' : ''}`,
  marque: (genre: 'designee' | 'menacee'): string => `forme_marque_${genre}`,
});

/** La hauteur d'un mât de pavillon, en cases : il dépasse un bâtiment commun. */
export const HAUTEUR_MAT = 1.05;
/** La taille d'un drapeau, en pixels de plan. */
export const TAILLE_DRAPEAU = { l: 30, h: 19 } as const;

/** Une couleur de 0 à 1 en `rgb()` CSS. */
function css(c: readonly [number, number, number], facteur = 1, vers: readonly [number, number, number] | null = null, t = 0): string {
  const o = (i: 0 | 1 | 2): number => {
    let v = c[i] * facteur;
    if (vers) v = v + (vers[i] - v) * t;
    return Math.round(Math.max(0, Math.min(1, v)) * 255);
  };
  return `rgb(${o(0)},${o(1)},${o(2)})`;
}

const BLANC: readonly [number, number, number] = [1, 1, 1];
/** Le gris des bâtiments neutres et des unités sans couleur. */
const NEUTRE: readonly [number, number, number] = [0.725, 0.745, 0.78];

/** La palette qu'une couleur d'équipe donne à une silhouette. */
export function paletteEquipe(c: readonly [number, number, number] | null): Palette {
  const e = c ?? NEUTRE;
  return { main: css(e), dark: css(e, 0.62), light: css(e, 1, BLANC, 0.45) };
}

/**
 * Ce qu'un repli se laisse lire de son identifiant. Les clés de jeu portent
 * elles-mêmes des tirets bas (`char_leger`) : on lit donc par les bouts — le
 * préfixe de famille devant, la variante derrière.
 */
export type IdentiteRepli =
  | { famille: 'unite'; cle: string }
  | { famille: 'batiment'; cle: string }
  | { famille: 'decor'; essence: EssenceDecor | 'rocher'; saison: string }
  | { famille: 'forme'; forme: 'ombre' | 'ecume' | 'mat' | 'drapeau' }
  | { famille: 'pv'; pv: number; agie: boolean }
  | { famille: 'marque'; genre: 'designee' | 'menacee' };

/** Lit un identifiant de repli ; `null` pour ce qu'on ne sait pas dessiner. */
export function identiteRepli(id: string): IdentiteRepli | null {
  if (id === FORMES.ombre) return { famille: 'forme', forme: 'ombre' };
  if (id === FORMES.ecume) return { famille: 'forme', forme: 'ecume' };
  if (id === FORMES.mat) return { famille: 'forme', forme: 'mat' };
  if (id === FORMES.drapeau) return { famille: 'forme', forme: 'drapeau' };
  const pv = /^forme_pv_(\d)(_a)?$/.exec(id);
  if (pv) return { famille: 'pv', pv: Number(pv[1]), agie: pv[2] !== undefined };
  if (id === 'forme_marque_designee' || id === 'forme_marque_menacee') {
    return { famille: 'marque', genre: id === 'forme_marque_designee' ? 'designee' : 'menacee' };
  }
  const unite = /^unite_([a-z0-9_]+)_[a-z0-9]+$/.exec(id);
  if (unite?.[1]) return { famille: 'unite', cle: unite[1] };
  const batiment = /^batiment_([a-z0-9_]+)_[a-z0-9]+$/.exec(id);
  if (batiment?.[1]) return { famille: 'batiment', cle: batiment[1] };
  if (/^decor_rocher(_|$)/.test(id)) return { famille: 'decor', essence: 'rocher', saison: 'toutes' };
  const decor = /^decor_([a-z_]+)_(printemps|ete|automne|hiver|toutes)_\d+$/.exec(id);
  if (decor?.[1] && decor[2] && (ESSENCES_DECOR as readonly string[]).includes(decor[1])) {
    return { famille: 'decor', essence: decor[1] as EssenceDecor, saison: decor[2] };
  }
  return null;
}

/** Un dessin de repli : sa boîte en pixels de plan autour du pivot, et de quoi le peindre. */
interface Dessin {
  /** Ce qui dépasse du pivot, en pixels de plan : à gauche, en haut, à droite, en bas. */
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
  /** Peint en pixels de plan, le pivot à l'origine. */
  peindre(g: Pinceau): void;
}

/**
 * Le pinceau d'une silhouette **sans ses ombres** : les dessins du HUD posent
 * chacun leur ombre portée, un aplat noir translucide, alors que la peau pose
 * la sienne (`OMBRE_UNITE`) — sous l'appareil en vol, sur la case. On retient
 * donc les remplissages en noir translucide, et seulement eux.
 */
export function sansOmbresInternes(g: Pinceau): Pinceau {
  let retenir = false;
  return new Proxy(g, {
    get(cible, nom) {
      if (nom === 'fill') {
        return (...args: unknown[]): void => {
          if (!retenir) (cible.fill as (...a: unknown[]) => void).apply(cible, args);
        };
      }
      const valeur = Reflect.get(cible, nom, cible) as unknown;
      return typeof valeur === 'function' ? (valeur as (...a: unknown[]) => unknown).bind(cible) : valeur;
    },
    set(cible, nom, valeur) {
      if (nom === 'fillStyle') retenir = typeof valeur === 'string' && /^rgba\(0,\s*0,\s*0,/.test(valeur);
      return Reflect.set(cible, nom, valeur, cible);
    },
  });
}

/** Une unité : la silhouette du HUD, deux pixels de plan par unité de dessin (sa tuile de 64 vaut une case). */
function dessinUnite(silhouette: Silhouette, palette: Palette): Dessin {
  const u = PIXELS_PAR_CASE / 64;
  // Le dessin est centré sur son milieu ; le contact au sol est quinze unités plus bas.
  const sol = 15;
  const s = echelleTaille(silhouette.taille);
  return {
    gauche: 42 * u * s, droite: 42 * u * s, haut: (44 + sol) * u * s, bas: (26 - sol) * u * s,
    peindre(g) {
      g.save();
      g.scale(u, u);
      g.translate(0, -sol * s);
      dessinerUnite(sansOmbresInternes(g), silhouette, palette);
      g.restore();
    },
  };
}

// --- Bâtiments ----------------------------------------------------------------

/** Une case au sol, en pixels de plan. */
const L = PIXELS_PAR_CASE;
const P = PIXELS_PAR_CASE * SIN_TANGAGE;
const H = PIXELS_PAR_CASE * COS_TANGAGE;

/**
 * Une boîte posée au sol, vue par la caméra de carte : une face avant, un
 * dessus. Tout en cases : `bx`, `by` le centre au sol depuis le pivot, `l` la
 * largeur, `p` la profondeur, `h` la hauteur.
 */
function boite(
  g: Pinceau, bx: number, by: number, l: number, p: number, h: number,
  face: string, dessus: string, trait = 'rgba(20,24,30,0.55)',
): void {
  const x = (bx - l / 2) * L;
  const avant = (by + p / 2) * P;
  const arriere = (by - p / 2) * P;
  const monte = h * H;
  g.fillStyle = face;
  g.fillRect(x, avant - monte, l * L, monte);
  g.fillStyle = dessus;
  g.fillRect(x, arriere - monte, l * L, avant - arriere);
  g.strokeStyle = trait;
  g.lineWidth = 1.5;
  g.strokeRect(x, arriere - monte, l * L, avant - arriere + monte);
  g.beginPath();
  g.moveTo(x, avant - monte);
  g.lineTo(x + l * L, avant - monte);
  g.stroke();
}

/** Des fenêtres sur la face avant d'une boîte. */
function fenetres(g: Pinceau, bx: number, by: number, l: number, p: number, h: number, colonnes: number, rangs: number): void {
  const x0 = (bx - l / 2) * L;
  const bas = (by + p / 2) * P;
  const pasX = (l * L) / colonnes;
  const pasY = (h * H) / (rangs + 0.6);
  g.fillStyle = '#2a3442';
  for (let i = 0; i < colonnes; i++) {
    for (let j = 0; j < rangs; j++) {
      g.fillRect(x0 + pasX * (i + 0.3), bas - pasY * (j + 1.05), pasX * 0.4, pasY * 0.5);
    }
  }
}

function dessinBatiment(cle: string, e: readonly [number, number, number] | null): Dessin | null {
  const equipe = css(e ?? NEUTRE);
  const equipeSombre = css(e ?? NEUTRE, 0.72);
  const mur = '#e6e0d0';
  const murDessus = '#f4efe2';
  const gris = '#b9bdc5';
  const grisDessus = '#d3d6dc';
  const boiteDe = (haut: number): Omit<Dessin, 'peindre'> => ({
    gauche: 0.56 * L, droite: 0.56 * L, haut: 0.5 * P + haut * H + 6, bas: 0.5 * P + 6,
  });
  switch (cle) {
    case 'ville':
      return {
        ...boiteDe(0.62),
        peindre(g) {
          boite(g, -0.2, -0.14, 0.44, 0.38, 0.34, mur, equipe);
          fenetres(g, -0.2, -0.14, 0.44, 0.38, 0.34, 2, 1);
          boite(g, 0.19, 0.1, 0.46, 0.42, 0.5, mur, equipeSombre);
          fenetres(g, 0.19, 0.1, 0.46, 0.42, 0.5, 2, 2);
          boite(g, -0.16, 0.24, 0.3, 0.26, 0.2, murDessus, equipe);
        },
      };
    case 'usine':
      return {
        ...boiteDe(0.95),
        peindre(g) {
          boite(g, 0.3, -0.18, 0.12, 0.12, 0.92, '#8d939c', '#5e646c');
          boite(g, 0, 0.06, 0.84, 0.56, 0.36, gris, equipe);
          // Le toit en sheds : trois dents sombres sur le dessus.
          g.fillStyle = equipeSombre;
          const haut = (0.06 - 0.28) * P - 0.36 * H;
          for (let i = 0; i < 3; i++) g.fillRect((-0.42 + i * 0.28) * L + 4, haut + 3, 0.12 * L, 0.56 * P - 6);
          fenetres(g, 0, 0.06, 0.84, 0.56, 0.36, 4, 1);
        },
      };
    case 'aeroport':
      return {
        ...boiteDe(0.62),
        peindre(g) {
          // La piste d'abord, à plat : elle est au sol, devant.
          g.fillStyle = '#5b6068';
          g.fillRect(-0.5 * L, 0.18 * P, L, 0.26 * P);
          g.fillStyle = '#f2f2ee';
          for (let i = 0; i < 4; i++) g.fillRect((-0.42 + i * 0.24) * L, 0.3 * P, 0.12 * L, 3);
          boite(g, -0.12, -0.14, 0.62, 0.42, 0.28, gris, equipe);
          boite(g, 0.33, -0.2, 0.14, 0.14, 0.6, grisDessus, equipeSombre);
          g.fillStyle = '#9fd4ff';
          g.fillRect(0.27 * L, -0.27 * P - 0.6 * H + 3, 0.12 * L, 0.1 * H);
        },
      };
    case 'qg':
      return {
        ...boiteDe(1.0),
        peindre(g) {
          boite(g, 0.22, 0.12, 0.34, 0.4, 0.4, mur, equipeSombre);
          boite(g, -0.1, -0.06, 0.46, 0.46, 0.98, mur, equipe);
          // La bande de camp, à mi-hauteur : c'est elle qu'on reconnaît de loin.
          g.fillStyle = equipe;
          g.fillRect((-0.1 - 0.23) * L, (-0.06 + 0.23) * P - 0.62 * H, 0.46 * L, 0.12 * H);
          fenetres(g, -0.1, -0.06, 0.46, 0.46, 0.98, 3, 3);
        },
      };
    case 'radar':
      return {
        ...boiteDe(0.9),
        peindre(g) {
          boite(g, -0.12, 0.08, 0.5, 0.42, 0.3, gris, grisDessus);
          boite(g, 0.24, -0.14, 0.06, 0.06, 0.6, '#7c828c', '#5e646c');
          // La parabole : une ellipse à la couleur du camp, tournée vers le ciel.
          const cx = 0.24 * L;
          const cy = -0.14 * P - 0.64 * H;
          g.fillStyle = equipe;
          g.beginPath();
          g.ellipse(cx, cy, 0.2 * L, 0.12 * L, -0.35, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(20,24,30,0.6)';
          g.lineWidth = 1.5;
          g.stroke();
          fenetres(g, -0.12, 0.08, 0.5, 0.42, 0.3, 3, 1);
        },
      };
    case 'port':
      return {
        ...boiteDe(0.9),
        peindre(g) {
          // Le quai, à plat, et ses bittes d'amarrage.
          g.fillStyle = '#8a7356';
          g.fillRect(-0.5 * L, 0.02 * P, L, 0.46 * P);
          g.fillStyle = '#5a4a38';
          for (let i = 0; i < 4; i++) g.fillRect((-0.4 + i * 0.26) * L, 0.36 * P, 5, 5);
          boite(g, -0.2, -0.18, 0.44, 0.32, 0.32, gris, equipeSombre);
          // La grue : un pylône et une flèche à la couleur du camp.
          g.strokeStyle = equipe;
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(0.26 * L, 0.1 * P);
          g.lineTo(0.26 * L, 0.1 * P - 0.86 * H);
          g.lineTo(-0.04 * L, 0.1 * P - 0.72 * H);
          g.stroke();
          g.strokeStyle = '#2a2f36';
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(-0.02 * L, 0.1 * P - 0.72 * H);
          g.lineTo(-0.02 * L, 0.1 * P - 0.4 * H);
          g.stroke();
        },
      };
    default:
      return null;
  }
}

// --- Décor ----------------------------------------------------------------------

/** Les feuillages d'une saison. */
const FEUILLES: Readonly<Record<string, string>> = {
  printemps: '#57ad5b', ete: '#3f9a4a', automne: '#d27a2e', hiver: '#8ea7a6', toutes: '#469e4f',
};

function dessinDecor(essence: EssenceDecor | 'rocher', saison: string): Dessin {
  const feuille = FEUILLES[saison] ?? FEUILLES['toutes'] ?? '#469e4f';
  const neige = saison === 'hiver';
  const tronc = (g: Pinceau, h: number): void => {
    g.fillStyle = '#6b4a2f';
    g.fillRect(-3, -h * H, 6, h * H);
  };
  switch (essence) {
    case 'conifere':
      return {
        gauche: 24, droite: 24, haut: 0.95 * H + 4, bas: 4,
        peindre(g) {
          tronc(g, 0.18);
          for (const [bas, larg] of [[0.14, 22], [0.4, 17], [0.64, 11]] as const) {
            g.fillStyle = '#2f6e43';
            g.beginPath();
            g.moveTo(-larg, -bas * H);
            g.lineTo(larg, -bas * H);
            g.lineTo(0, -(bas + 0.34) * H);
            g.closePath();
            g.fill();
          }
          if (neige) { g.fillStyle = '#f4f8fb'; g.beginPath(); g.moveTo(-6, -0.86 * H); g.lineTo(6, -0.86 * H); g.lineTo(0, -0.98 * H); g.fill(); }
        },
      };
    case 'palmier':
    case 'tropical':
      return {
        gauche: 30, droite: 30, haut: 0.9 * H + 6, bas: 4,
        peindre(g) {
          g.strokeStyle = '#7a5a36';
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(0, 0);
          g.quadraticCurveTo(6, -0.4 * H, 2, -0.72 * H);
          g.stroke();
          g.fillStyle = essence === 'palmier' ? '#3e9a52' : '#2f8a44';
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            g.beginPath();
            g.ellipse(2 + Math.cos(a) * 12, -0.74 * H + Math.sin(a) * 6, 14, 5, a, 0, Math.PI * 2);
            g.fill();
          }
        },
      };
    case 'buisson':
    case 'touffe':
    case 'roseau':
      return {
        gauche: 20, droite: 20, haut: 0.34 * H + 4, bas: 4,
        peindre(g) {
          if (essence === 'roseau') {
            g.strokeStyle = '#6f8f3f';
            g.lineWidth = 2;
            for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 4, 0); g.lineTo(i * 5, -0.3 * H); g.stroke(); }
            return;
          }
          g.fillStyle = essence === 'touffe' ? '#6aa84a' : feuille;
          for (const [x, y, r] of [[-8, -6, 9], [7, -7, 10], [0, -12, 10]] as const) {
            g.beginPath();
            g.arc(x, y * (essence === 'touffe' ? 0.6 : 1), r * (essence === 'touffe' ? 0.7 : 1), 0, Math.PI * 2);
            g.fill();
          }
        },
      };
    case 'montagne':
    case 'montagne_aride':
    case 'montagne_volcan': {
      const roche = essence === 'montagne' ? '#8d949f' : essence === 'montagne_aride' ? '#a8845a' : '#4a4442';
      const ombre = essence === 'montagne' ? '#6c7380' : essence === 'montagne_aride' ? '#86663f' : '#312c2b';
      return {
        gauche: 0.58 * L, droite: 0.58 * L, haut: 1.2 * H + 4, bas: 0.3 * P,
        peindre(g) {
          const sommet = { x: -4, y: -1.16 * H };
          g.fillStyle = roche;
          g.beginPath();
          g.moveTo(-0.56 * L, 0.24 * P);
          g.lineTo(sommet.x, sommet.y);
          g.lineTo(0.56 * L, 0.24 * P);
          g.closePath();
          g.fill();
          g.fillStyle = ombre;
          g.beginPath();
          g.moveTo(sommet.x, sommet.y);
          g.lineTo(0.56 * L, 0.24 * P);
          g.lineTo(0.12 * L, 0.24 * P);
          g.closePath();
          g.fill();
          if (essence === 'montagne_volcan') {
            g.fillStyle = '#e0572c';
            g.beginPath();
            g.ellipse(sommet.x, sommet.y + 6, 10, 4, 0, 0, Math.PI * 2);
            g.fill();
          } else if (essence === 'montagne' || neige) {
            g.fillStyle = '#f4f7fa';
            g.beginPath();
            g.moveTo(sommet.x, sommet.y);
            g.lineTo(sommet.x - 18, sommet.y + 0.3 * H);
            g.lineTo(sommet.x + 20, sommet.y + 0.3 * H);
            g.closePath();
            g.fill();
          }
        },
      };
    }
    case 'rocher':
      return {
        gauche: 26, droite: 26, haut: 0.3 * H + 4, bas: 6,
        peindre(g) {
          g.fillStyle = '#8f959d';
          g.beginPath();
          g.moveTo(-22, 2);
          g.lineTo(-14, -0.22 * H);
          g.lineTo(4, -0.3 * H);
          g.lineTo(20, -0.12 * H);
          g.lineTo(22, 3);
          g.closePath();
          g.fill();
          g.fillStyle = '#6d737c';
          g.beginPath();
          g.moveTo(4, -0.3 * H);
          g.lineTo(20, -0.12 * H);
          g.lineTo(22, 3);
          g.lineTo(6, 3);
          g.closePath();
          g.fill();
        },
      };
    default:
      // Le feuillu, et tout ce qui n'a pas de forme à soi.
      return {
        gauche: 26, droite: 26, haut: 0.92 * H + 4, bas: 4,
        peindre(g) {
          tronc(g, 0.3);
          g.fillStyle = feuille;
          for (const [x, y, r] of [[-9, -0.52, 13], [9, -0.56, 13], [0, -0.74, 15]] as const) {
            g.beginPath();
            g.arc(x, y * H, r, 0, Math.PI * 2);
            g.fill();
          }
          if (neige) { g.fillStyle = 'rgba(244,248,251,0.9)'; g.beginPath(); g.arc(0, -0.8 * H, 9, Math.PI, 0); g.fill(); }
        },
      };
  }
}

// --- Formes du rendu ----------------------------------------------------------------

/** L'orange du matériel à l'essai : le badge des Gris, et la couleur de ce qu'ils visent. */
const ORANGE_MARQUE = '#ff9a2e';

/** Une couleur `#rrggbb` du contrat en `rgba()` CSS, à une opacité donnée. */
function rgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function dessinForme(identite: Extract<IdentiteRepli, { famille: 'forme' | 'pv' | 'marque' }>, e: readonly [number, number, number] | null): Dessin {
  if (identite.famille === 'forme' && identite.forme === 'ecume') {
    const rx = (ECUME_NAVIRE.largeur * L) / 2;
    const ry = (ECUME_NAVIRE.hauteur * P) / 2;
    const c = ECUME_NAVIRE.couleur;
    return {
      gauche: rx + 2, droite: rx + 2, haut: ry + 2, bas: ry + 2,
      peindre(g) {
        // Un anneau doux plus qu'un disque : le cœur est sous la coque, le bord
        // dessine la ligne de flottaison et s'efface dans l'eau. L'opacité de
        // l'écume est celle de l'instance (`ECUME_NAVIRE.opacite`).
        g.save();
        g.scale(1, ry / rx);
        const d = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        d.addColorStop(0, rgba(c, 0.3));
        d.addColorStop(0.62, rgba(c, 0.85));
        d.addColorStop(0.82, rgba(c, 0.45));
        d.addColorStop(1, rgba(c, 0));
        g.fillStyle = d;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      },
    };
  }
  if (identite.famille === 'forme' && identite.forme === 'ombre') {
    const rx = (OMBRE_UNITE.largeur * L) / 2;
    const ry = (OMBRE_UNITE.hauteur * P) / 2;
    return {
      gauche: rx + 2, droite: rx + 2, haut: ry + 2, bas: ry + 2,
      peindre(g) {
        // Un dégradé radial écrasé : le cœur noir, le bord transparent. L'opacité
        // de l'ombre est celle de l'instance (`OMBRE_UNITE.opacite`).
        g.save();
        g.scale(1, ry / rx);
        const d = g.createRadialGradient(0, 0, 0, 0, 0, rx);
        d.addColorStop(0, 'rgba(0,0,0,1)');
        d.addColorStop(0.55, 'rgba(0,0,0,0.75)');
        d.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = d;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      },
    };
  }
  if (identite.famille === 'forme' && identite.forme === 'mat') {
    const haut = HAUTEUR_MAT * H;
    return {
      gauche: 4, droite: 4, haut: haut + 4, bas: 3,
      peindre(g) {
        g.fillStyle = '#3a3f47';
        g.fillRect(-2, -haut, 4, haut);
        g.fillStyle = '#c9ced6';
        g.fillRect(-1, -haut, 1.5, haut);
        g.beginPath();
        g.arc(0, -haut, 3, 0, Math.PI * 2);
        g.fillStyle = '#d8c27a';
        g.fill();
      },
    };
  }
  if (identite.famille === 'forme') {
    // Le drapeau : le pivot au pied de sa hampe, à gauche ; il flotte vers la droite.
    const { l, h } = TAILLE_DRAPEAU;
    const couleur = e ?? NEUTRE;
    return {
      gauche: 2, droite: l + 2, haut: h + 2, bas: 2,
      peindre(g) {
        g.fillStyle = css(couleur);
        g.beginPath();
        g.moveTo(0, -h);
        g.quadraticCurveTo(l * 0.5, -h - 3, l, -h + 2);
        g.lineTo(l, 2);
        g.quadraticCurveTo(l * 0.5, -3, 0, 0);
        g.closePath();
        g.fill();
        g.fillStyle = css(couleur, 1, BLANC, 0.45);
        g.fillRect(2, -h + 2, l * 0.45, 3);
        g.strokeStyle = css(couleur, 0.55);
        g.lineWidth = 1.5;
        g.stroke();
      },
    };
  }
  if (identite.famille === 'pv') {
    // La pastille de PV, comme Advance Wars : un chiffre blanc sur fond sombre,
    // liseré à la couleur du camp — « qui » avant « quoi ». Une unité qui a joué
    // y ajoute le cadenas, comme en 3D.
    const r = 11;
    const chiffre = identite.pv > 0 && identite.pv < 10;
    const largeur = (chiffre ? 2 * r : 0) + (identite.agie ? 2 * r : 0);
    return {
      gauche: largeur / 2 + 2, droite: largeur / 2 + 2, haut: r + 2, bas: r + 2,
      peindre(g) {
        const x0 = -largeur / 2 + r;
        const x1 = largeur / 2 - r;
        g.fillStyle = 'rgba(12,16,24,0.88)';
        g.beginPath();
        g.arc(x0, 0, r, Math.PI / 2, -Math.PI / 2);
        g.arc(x1, 0, r, -Math.PI / 2, Math.PI / 2);
        g.closePath();
        g.fill();
        g.strokeStyle = css(e ?? NEUTRE, 1, BLANC, 0.45);
        g.lineWidth = 2;
        g.stroke();
        if (chiffre) {
          g.fillStyle = '#ffffff';
          g.font = `bold ${Math.round(r * 1.45)}px system-ui, sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(identite.pv), x0, 1);
        }
        if (identite.agie) {
          const cx = chiffre ? x1 : x0;
          g.fillStyle = '#ffffff';
          g.strokeStyle = '#ffffff';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(cx, -2, 3.4, Math.PI, 0);
          g.stroke();
          g.fillRect(cx - 5, -2, 10, 7);
        }
      },
    };
  }
  // Les marques du télégraphage : un chevron (désignée) ou un « ! » (menacée), en orange.
  const r = 12;
  return {
    gauche: r + 2, droite: r + 2, haut: r + 2, bas: r + 2,
    peindre(g) {
      g.fillStyle = 'rgba(12,16,24,0.88)';
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = ORANGE_MARQUE;
      g.lineWidth = 2;
      g.stroke();
      if (identite.genre === 'designee') {
        g.lineWidth = 3.5;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(-5, -3);
        g.lineTo(0, 3);
        g.lineTo(5, -3);
        g.stroke();
      } else {
        g.fillStyle = ORANGE_MARQUE;
        g.fillRect(-1.6, -7, 3.2, 9);
        g.fillRect(-1.6, 4, 3.2, 3.2);
      }
    },
  };
}

/** La boîte et le dessin d'un repli, d'après son identité. */
export function dessinRepli(
  identite: IdentiteRepli, equipe: readonly [number, number, number] | null, cat: Catalogue | null,
): Dessin | null {
  switch (identite.famille) {
    case 'unite': {
      const type = cat?.unites[identite.cle as keyof Catalogue['unites']];
      return type ? dessinUnite(type.silhouette, paletteEquipe(equipe)) : null;
    }
    case 'batiment':
      return dessinBatiment(identite.cle, equipe);
    case 'decor':
      return dessinDecor(identite.essence, identite.saison);
    default:
      return dessinForme(identite, equipe);
  }
}

/** Ce qui fabrique une toile où peindre : un `document`, ou `OffscreenCanvas`. */
export type FabriqueToile = (largeur: number, hauteur: number) => { toile: SourceImage; g: Pinceau } | null;

/** La fabrique de toiles d'un document. */
export function fabriqueToileDocument(doc: Document): FabriqueToile {
  return (largeur, hauteur) => {
    const toile = doc.createElement('canvas');
    toile.width = largeur;
    toile.height = hauteur;
    // Une toile tenue par le processeur : la téléverser dans WebGL est alors une
    // copie, pas une relecture de la carte graphique (« GPU stall due to
    // ReadPixels », mesuré sous Chromium).
    const g = toile.getContext('2d', { willReadFrequently: true });
    return g ? { toile, g } : null;
  };
}

/**
 * Le peintre de replis : il lit l'identifiant, mesure la boîte, peint à la
 * densité `DENSITE_REPLI`, et rend la toile avec son pivot. Le catalogue est
 * lu **à chaque demande** : c'est celui de la partie en cours.
 */
export function creerPeintreRepli(fabrique: FabriqueToile, catalogue: () => Catalogue | null): PeintreRepli {
  return {
    peindre(id, equipe): ReplisPeint | null {
      const identite = identiteRepli(id);
      if (!identite) return null;
      const d = dessinRepli(identite, equipe, catalogue());
      if (!d) return null;
      const k = DENSITE_REPLI;
      const l = Math.max(1, Math.ceil((d.gauche + d.droite) * k));
      const h = Math.max(1, Math.ceil((d.haut + d.bas) * k));
      const px = d.gauche * k;
      const py = d.haut * k;
      const t = fabrique(l, h);
      if (!t) return null;
      t.g.save();
      t.g.translate(px, py);
      t.g.scale(k, k);
      d.peindre(t.g);
      t.g.restore();
      return { source: t.toile, l, h, px, py, echelle: 1 / k };
    },
  };
}
