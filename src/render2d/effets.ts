/**
 * Les **effets** de la peau 2D : ce qui naît d'un geste et ne vit qu'un instant
 * — éclairs de bouche, étoiles d'impact, étincelles, fumée, poussière, anneaux
 * et halos au sol, caisses, projectiles, rayon, réticule —, plus deux choses qui
 * ne sont pas des images : la **secousse** de l'écran et les **superpositions**
 * d'un pouvoir (l'éclat, la vague de teinte).
 *
 * Trois règles, reprises du pool de la 3D (`render3d/effets.ts`) et durcies :
 *
 * - **un pool préalloué** : `CAPACITE_EFFETS` particules créées une fois, dont
 *   un quart réservé à ce qui se couche au sol — une volée d'étincelles ne mange
 *   jamais la place d'un anneau de capture. Plein, il recycle **le plus vieux**.
 *   Aucune allocation par image : chaque particule porte sa pose et son
 *   instance, réécrites en place ;
 * - **la vie d'une particule est une fonction de son âge** — trajectoire,
 *   taille, opacité — et le pool ne fait qu'avancer l'âge (`avancer(ms)`, une
 *   fois par image, par la peau, sur l'horloge de la boucle). Un geste émet donc
 *   tout à son départ, retards compris ; un clic qui coupe vide le pool, et
 *   l'image saute à l'état final, sans effet qui traîne ;
 * - **rien ne se dessine hors de vue** : une particule posée au-dessus d'une case
 *   cachée ne se pose pas, comme un son ne se joue pas (`poses(…, vu)`).
 *
 * Les images sont **peintes par le code, une fois au montage**, sur une seule
 * planche (`peindrePlanche`, `monterPlanche`) : blanches pour la plupart et
 * teintées par instance, colorées quand la couleur fait l'objet (la caisse, le
 * missile). La météo (`meteo.ts`) y a aussi ses gouttes, flocons, nappes et
 * grains : une planche, une texture, un seul téléversement.
 *
 * `doc/10` §2 tient toujours : de la lumière, des étincelles claires, de la
 * poussière, une fumée grise qui se dissipe — jamais de sang ni de fumée noire.
 *
 * Pur, à la toile près (`tests/render2d/effets.test.ts`).
 */

import type { Pinceau } from '../render/sprites/formes';
import type { Rvba, Trace } from './aplats';
import { Etageres, type CadreResolu, type SourceImage, type Televerseur, type TexturesPage } from './atlas';
import type { Emprise } from './camera';
import { COS_TANGAGE, PIXELS_PAR_CASE, SIN_TANGAGE, versPlan, type InstanceSprite } from './contrat';
import type { Pose } from './lot';
import type { FabriqueToile } from './replis';

/** Une couleur de 0 à 1. */
export type Rvb = readonly [number, number, number];

// ---------------------------------------------------------------------------
// 1. Les images : identifiants et planche
// ---------------------------------------------------------------------------

/** Les directions d'une image orientée (traçante, missile) : l'instance ne tourne pas, on peint seize caps. */
export const DIRECTIONS = 16;

/** Les images d'effet, par genre. Toutes commencent par `effet_` : le résolveur les reconnaît à ce préfixe. */
export const ID_EFFET = Object.freeze({
  eclair: 'effet_eclair',
  etoile: 'effet_etoile',
  etincelle: 'effet_etincelle',
  poussiere: 'effet_poussiere',
  anneau: 'effet_anneau',
  halo: 'effet_halo',
  caisse: 'effet_caisse',
  scintille: 'effet_scintille',
  obus: 'effet_obus',
  rayon: 'effet_rayon',
  reticule: 'effet_reticule',
  flocon: 'effet_flocon',
  brume: 'effet_brume',
  grain: 'effet_grain',
});

/** Trois bouffées de fumée : une seule forme répétée se verrait. */
export const IDS_FUMEE: readonly string[] = ['effet_fumee_0', 'effet_fumee_1', 'effet_fumee_2'];
/** Une traçante par cap, de 0 (vers la droite de l'écran) dans le sens des aiguilles. */
export const IDS_TRAIT: readonly string[] = Array.from({ length: DIRECTIONS }, (_, k) => `effet_trait_${k}`);
/** Un missile par cap. */
export const IDS_MISSILE: readonly string[] = Array.from({ length: DIRECTIONS }, (_, k) => `effet_missile_${k}`);
/** Les inclinaisons de goutte peintes, en degrés depuis la verticale : le vent les couche. */
export const ANGLES_GOUTTE = [0, 10, 20, 30] as const;
export const IDS_GOUTTE: readonly string[] = ANGLES_GOUTTE.map((a) => `effet_goutte_${a}`);

/** Le préfixe de toute image d'effet. */
export const PREFIXE_EFFET = 'effet_';

/**
 * Le cap d'écran d'un mouvement dans le plan (y vers le bas), rangé parmi les
 * seize peints : 0 vers la droite, 4 vers le bas, 8 vers la gauche, 12 vers le haut.
 */
export function directionEcran(dX: number, dY: number): number {
  if (dX === 0 && dY === 0) return 0;
  const k = Math.round(Math.atan2(dY, dX) / ((2 * Math.PI) / DIRECTIONS));
  return ((k % DIRECTIONS) + DIRECTIONS) % DIRECTIONS;
}

/**
 * Un dessin de la planche : sa case en pixels d'image, son pivot, sa densité
 * (pixels de plan par pixel d'image), et de quoi le peindre, origine au coin
 * haut-gauche de sa case. La plupart valent **une case** de large à l'échelle 1 :
 * la `taille` d'une particule est alors directement son échelle d'instance.
 */
export interface DessinEffet {
  id: string;
  l: number;
  h: number;
  px: number;
  py: number;
  echelle: number;
  peindre(g: Pinceau): void;
}

const TOUR = Math.PI * 2;

/** Un dégradé radial blanc, du cœur au bord, posé sur un disque. */
function disqueDoux(g: Pinceau, x: number, y: number, r: number, arrets: readonly (readonly [number, number])[]): void {
  const d = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [t, a] of arrets) d.addColorStop(t, `rgba(255,255,255,${a})`);
  g.fillStyle = d;
  g.beginPath();
  g.arc(x, y, r, 0, TOUR);
  g.fill();
}

/** Les bouffées d'une fumée : cercles `[x, y, r]` dans une case de 64. */
const BOUFFEES: readonly (readonly (readonly [number, number, number])[])[] = [
  [[32, 36, 17], [19, 39, 12], [45, 39, 13], [27, 24, 12], [40, 25, 11]],
  [[30, 34, 16], [44, 37, 14], [20, 40, 11], [36, 22, 13], [24, 26, 9]],
  [[34, 35, 18], [21, 33, 12], [46, 30, 11], [31, 22, 11], [42, 44, 10]],
];

/** Une traçante : une queue qui s'éteint, une tête blanche, le long du cap `k`. */
function peindreTrait(g: Pinceau, k: number): void {
  const longueur = 40;
  g.save();
  g.translate(24, 24);
  g.rotate((k / DIRECTIONS) * TOUR);
  const d = g.createLinearGradient(-longueur / 2, 0, longueur / 2, 0);
  d.addColorStop(0, 'rgba(255,255,255,0)');
  d.addColorStop(0.65, 'rgba(255,255,255,0.7)');
  d.addColorStop(1, 'rgba(255,255,255,1)');
  g.strokeStyle = d;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-longueur / 2, 0);
  g.lineTo(longueur / 2 - 3, 0);
  g.stroke();
  disqueDoux(g, longueur / 2 - 3, 0, 4, [[0, 1], [0.6, 0.9], [1, 0]]);
  g.restore();
}

/** Un missile : un corps clair, une ogive sombre, une flamme derrière, le long du cap `k`. */
function peindreMissile(g: Pinceau, k: number): void {
  g.save();
  g.translate(20, 20);
  g.rotate((k / DIRECTIONS) * TOUR);
  const flamme = g.createLinearGradient(-19, 0, -7, 0);
  flamme.addColorStop(0, 'rgba(255,150,60,0)');
  flamme.addColorStop(0.5, 'rgba(255,170,70,0.85)');
  flamme.addColorStop(1, 'rgba(255,240,190,1)');
  g.fillStyle = flamme;
  g.beginPath();
  g.ellipse(-12, 0, 7.5, 3, 0, 0, TOUR);
  g.fill();
  g.fillStyle = '#9aa1ab';
  g.beginPath();
  g.moveTo(-8, -2.5);
  g.lineTo(-11, -5.5);
  g.lineTo(-5, -2.5);
  g.moveTo(-8, 2.5);
  g.lineTo(-11, 5.5);
  g.lineTo(-5, 2.5);
  g.fill();
  g.fillStyle = '#e3e7ec';
  g.fillRect(-8, -2.5, 16, 5);
  g.fillStyle = '#5b626c';
  g.beginPath();
  g.moveTo(8, -2.5);
  g.lineTo(13, 0);
  g.lineTo(8, 2.5);
  g.closePath();
  g.fill();
  g.restore();
}

/** Une goutte couchée de `angle` degrés : elle file vers le bas et la droite, tête claire. */
function peindreGoutte(g: Pinceau, angle: number): void {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a) * 20;
  const dy = Math.cos(a) * 20;
  const d = g.createLinearGradient(16 - dx, 24 - dy, 16 + dx, 24 + dy);
  d.addColorStop(0, 'rgba(255,255,255,0)');
  d.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.strokeStyle = d;
  g.lineWidth = 1.7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(16 - dx, 24 - dy);
  g.lineTo(16 + dx, 24 + dy);
  g.stroke();
}

/** Tous les dessins de la planche. */
export const DESSINS_EFFETS: readonly DessinEffet[] = [
  {
    // Un éclair de lumière : cœur blanc, bord qui s'éteint. Bouche, impact, explosion.
    id: ID_EFFET.eclair, l: 64, h: 64, px: 32, py: 32, echelle: PIXELS_PAR_CASE / 64,
    peindre: (g) => disqueDoux(g, 32, 32, 32, [[0, 1], [0.22, 0.92], [0.5, 0.38], [1, 0]]),
  },
  {
    // L'étoile d'un impact : quatre longues branches, quatre courtes, un cœur.
    id: ID_EFFET.etoile, l: 96, h: 96, px: 48, py: 48, echelle: PIXELS_PAR_CASE / 96,
    peindre: (g) => {
      disqueDoux(g, 48, 48, 26, [[0, 1], [0.35, 0.55], [1, 0]]);
      g.save();
      g.translate(48, 48);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) {
        const longue = i % 2 === 0;
        const l = longue ? 46 : 26;
        const w = longue ? 6 : 3.5;
        g.save();
        g.rotate((i * Math.PI) / 4);
        g.beginPath();
        g.moveTo(0, -w);
        g.lineTo(l, 0);
        g.lineTo(0, w);
        g.lineTo(-w * 0.6, 0);
        g.closePath();
        g.fill();
        g.restore();
      }
      g.restore();
    },
  },
  {
    id: ID_EFFET.etincelle, l: 16, h: 16, px: 8, py: 8, echelle: PIXELS_PAR_CASE / 16,
    peindre: (g) => disqueDoux(g, 8, 8, 8, [[0, 1], [0.3, 0.95], [0.6, 0.35], [1, 0]]),
  },
  ...BOUFFEES.map((bouffees, k): DessinEffet => ({
    id: IDS_FUMEE[k]!, l: 64, h: 64, px: 32, py: 32, echelle: PIXELS_PAR_CASE / 64,
    peindre: (g) => {
      for (const [x, y, r] of bouffees) disqueDoux(g, x, y, r, [[0, 0.95], [0.6, 0.62], [1, 0]]);
    },
  })),
  {
    // La poussière : plus plate et plus diffuse que la fumée.
    id: ID_EFFET.poussiere, l: 64, h: 64, px: 32, py: 32, echelle: PIXELS_PAR_CASE / 64,
    peindre: (g) => {
      for (const [x, y, r] of [[32, 38, 20], [18, 40, 13], [46, 41, 14], [30, 28, 12]] as const) {
        disqueDoux(g, x, y, r, [[0, 0.8], [0.5, 0.45], [1, 0]]);
      }
    },
  },
  {
    // Un anneau couché au sol : une ellipse, vue sous le tangage de la carte.
    id: ID_EFFET.anneau, l: 128, h: 98, px: 64, py: 49, echelle: 1,
    peindre: (g) => {
      g.save();
      g.translate(64, 49);
      g.scale(1, SIN_TANGAGE);
      g.strokeStyle = 'rgba(255,255,255,0.32)';
      g.lineWidth = 12;
      g.beginPath();
      g.arc(0, 0, 54, 0, TOUR);
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(0, 0, 54, 0, TOUR);
      g.stroke();
      g.restore();
    },
  },
  {
    // Un halo couché au sol : un disque doux en ellipse.
    id: ID_EFFET.halo, l: 128, h: 98, px: 64, py: 49, echelle: 1,
    peindre: (g) => {
      g.save();
      g.translate(64, 49);
      g.scale(1, SIN_TANGAGE);
      disqueDoux(g, 0, 0, 60, [[0, 0.95], [0.45, 0.6], [1, 0]]);
      g.restore();
    },
  },
  {
    // Une caisse de ravitaillement, dans ses couleurs : du bois, des sangles.
    id: ID_EFFET.caisse, l: 32, h: 32, px: 16, py: 16, echelle: PIXELS_PAR_CASE / 32,
    peindre: (g) => {
      g.fillStyle = '#e2bc7c';
      g.fillRect(5, 6, 22, 6);
      g.fillStyle = '#c28f4f';
      g.fillRect(5, 12, 22, 15);
      g.strokeStyle = '#6e4a26';
      g.lineWidth = 2;
      g.strokeRect(5, 6, 22, 21);
      g.beginPath();
      g.moveTo(5, 12);
      g.lineTo(27, 12);
      g.moveTo(16, 6);
      g.lineTo(16, 27);
      g.stroke();
    },
  },
  {
    // Un scintillement : une étoile à quatre branches et son halo.
    id: ID_EFFET.scintille, l: 32, h: 32, px: 16, py: 16, echelle: PIXELS_PAR_CASE / 32,
    peindre: (g) => {
      disqueDoux(g, 16, 16, 9, [[0, 0.9], [1, 0]]);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(16, 1);
      g.lineTo(18, 14);
      g.lineTo(31, 16);
      g.lineTo(18, 18);
      g.lineTo(16, 31);
      g.lineTo(14, 18);
      g.lineTo(1, 16);
      g.lineTo(14, 14);
      g.closePath();
      g.fill();
    },
  },
  {
    // Un obus : un rond sombre, un reflet — la seule chose sombre des effets, et elle est petite.
    id: ID_EFFET.obus, l: 16, h: 16, px: 8, py: 8, echelle: PIXELS_PAR_CASE / 16,
    peindre: (g) => {
      g.fillStyle = '#3d434c';
      g.beginPath();
      g.arc(8, 8, 5.5, 0, TOUR);
      g.fill();
      g.fillStyle = '#d4d9e0';
      g.beginPath();
      g.arc(6.4, 6.2, 1.9, 0, TOUR);
      g.fill();
    },
  },
  {
    // Le rayon : une colonne de lumière, pivot au pied, qui s'éteint vers le ciel.
    id: ID_EFFET.rayon, l: 16, h: 128, px: 8, py: 128, echelle: 2.5,
    peindre: (g) => {
      const d = g.createLinearGradient(0, 0, 16, 0);
      d.addColorStop(0, 'rgba(255,255,255,0)');
      d.addColorStop(0.3, 'rgba(255,255,255,0.55)');
      d.addColorStop(0.5, 'rgba(255,255,255,1)');
      d.addColorStop(0.7, 'rgba(255,255,255,0.55)');
      d.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = d;
      // Par tranches : l'opacité monte du ciel vers le pied, sans mode de composition
      // (un « destination-in » effacerait toute la planche autour).
      for (let y = 0; y < 128; y += 2) {
        g.globalAlpha = Math.min(1, y / 36);
        g.fillRect(0, y, 16, 2);
      }
      g.globalAlpha = 1;
    },
  },
  {
    // Le réticule : quatre équerres qui se referment sur une cible.
    id: ID_EFFET.reticule, l: 64, h: 64, px: 32, py: 32, echelle: PIXELS_PAR_CASE / 64,
    peindre: (g) => {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4;
      g.lineCap = 'square';
      for (const [x, y, sx, sy] of [[6, 6, 1, 1], [58, 6, -1, 1], [6, 58, 1, -1], [58, 58, -1, -1]] as const) {
        g.beginPath();
        g.moveTo(x, y + sy * 14);
        g.lineTo(x, y);
        g.lineTo(x + sx * 14, y);
        g.stroke();
      }
      disqueDoux(g, 32, 32, 5, [[0, 1], [1, 0]]);
    },
  },
  ...IDS_TRAIT.map((id, k): DessinEffet => ({
    id, l: 48, h: 48, px: 24, py: 24, echelle: PIXELS_PAR_CASE / 48, peindre: (g) => peindreTrait(g, k),
  })),
  ...IDS_MISSILE.map((id, k): DessinEffet => ({
    id, l: 40, h: 40, px: 20, py: 20, echelle: PIXELS_PAR_CASE / 40, peindre: (g) => peindreMissile(g, k),
  })),
  // --- La météo, en espace écran : un pixel de plan y vaut un pixel CSS.
  ...ANGLES_GOUTTE.map((angle, i): DessinEffet => ({
    id: IDS_GOUTTE[i]!, l: 32, h: 48, px: 16, py: 24, echelle: 0.5, peindre: (g) => peindreGoutte(g, angle),
  })),
  {
    id: ID_EFFET.flocon, l: 16, h: 16, px: 8, py: 8, echelle: 0.5,
    peindre: (g) => {
      disqueDoux(g, 8, 8, 6, [[0, 1], [0.5, 0.8], [1, 0]]);
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        g.beginPath();
        g.moveTo(8 - Math.cos(a) * 7, 8 - Math.sin(a) * 7);
        g.lineTo(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7);
        g.stroke();
      }
    },
  },
  {
    id: ID_EFFET.brume, l: 128, h: 64, px: 64, py: 32, echelle: 2,
    peindre: (g) => {
      g.save();
      g.translate(64, 32);
      g.scale(1, 0.5);
      disqueDoux(g, 0, 0, 62, [[0, 0.85], [0.55, 0.45], [1, 0]]);
      g.restore();
    },
  },
  {
    id: ID_EFFET.grain, l: 8, h: 8, px: 4, py: 4, echelle: 0.5,
    peindre: (g) => disqueDoux(g, 4, 4, 4, [[0, 1], [0.5, 0.7], [1, 0]]),
  },
];

/** Le côté de la planche, en pixels : tout y tient, et un seul téléversement. */
export const COTE_PLANCHE = 512;
/** La marge entre deux dessins : les niveaux de détail ne bavent pas d'un dessin sur l'autre. */
const MARGE_PLANCHE = 4;

/** Où un dessin est rangé sur la planche. */
export interface PlacementEffet {
  dessin: DessinEffet;
  x: number;
  y: number;
}

/**
 * Range les dessins sur la planche, les plus hauts d'abord (des étagères moins
 * creuses). Lève si un dessin ne tient pas : c'est une faute de ce fichier, et
 * le test la trouve avant le joueur.
 */
export function rangerPlanche(dessins: readonly DessinEffet[] = DESSINS_EFFETS, cote = COTE_PLANCHE): PlacementEffet[] {
  const etageres = new Etageres(cote, cote, MARGE_PLANCHE);
  const tries = [...dessins].sort((a, b) => b.h - a.h || b.l - a.l);
  return tries.map((dessin) => {
    const place = etageres.placer(dessin.l, dessin.h);
    if (!place) throw new Error(`Planche d’effets pleine : ${dessin.id}`);
    return { dessin, x: place.x, y: place.y };
  });
}

/** Peint la planche sur une toile ; `null` si la toile manque. */
export function peindrePlanche(fabrique: FabriqueToile, cote = COTE_PLANCHE): { source: SourceImage; placements: PlacementEffet[] } | null {
  const placements = rangerPlanche(DESSINS_EFFETS, cote);
  const toile = fabrique(cote, cote);
  if (!toile) return null;
  const g = toile.g;
  for (const { dessin, x, y } of placements) {
    g.save();
    g.translate(x, y);
    // Chaque dessin reste dans sa case, quoi qu'il trace.
    g.beginPath();
    g.rect(0, 0, dessin.l, dessin.h);
    g.clip();
    dessin.peindre(g);
    g.restore();
  }
  return { source: toile.toile, placements };
}

/** La planche téléversée : de quoi résoudre une instance d'effet en image. */
export class PlancheEffets {
  private readonly cadres = new Map<string, CadreResolu>();

  constructor(private readonly televerseur: Televerseur, private readonly texture: WebGLTexture, placements: readonly PlacementEffet[], cote = COTE_PLANCHE) {
    const textures: TexturesPage = { couleur: texture, masque: null, emission: null };
    for (const { dessin: d, x, y } of placements) {
      this.cadres.set(d.id, {
        textures, u0: x / cote, v0: y / cote, u1: (x + d.l) / cote, v1: (y + d.h) / cote,
        l: d.l, h: d.h, px: d.px, py: d.py, echelle: d.echelle, masque: false, emission: false, repli: true,
      });
    }
  }

  /** L'image d'une instance d'effet ; `null` pour tout ce qui n'en est pas une. */
  resoudre(inst: InstanceSprite): CadreResolu | null {
    if (!inst.entree.startsWith(PREFIXE_EFFET)) return null;
    return this.cadres.get(inst.entree) ?? null;
  }

  /** Les identifiants rangés. */
  get ids(): string[] {
    return [...this.cadres.keys()];
  }

  dispose(): void {
    try { this.televerseur.supprimer(this.texture); } catch { /* le contexte est parti avec elle */ }
    this.cadres.clear();
  }
}

/**
 * Peint et téléverse la planche. `null` si la toile ou le contexte refusent :
 * le jeu continue, sans effets — ils ne portent aucune règle.
 */
export function monterPlanche(televerseur: Televerseur, fabrique: FabriqueToile, cote = COTE_PLANCHE): PlancheEffets | null {
  try {
    const peinte = peindrePlanche(fabrique, cote);
    if (!peinte) return null;
    const texture = televerseur.creer(peinte.source, cote, cote, { premultiplier: true });
    peinte.source.close?.();
    return new PlancheEffets(televerseur, texture, peinte.placements, cote);
  } catch (cause) {
    console.error('Planche d’effets indisponible', cause);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Le pool
// ---------------------------------------------------------------------------

/** Les genres d'effets. */
export type GenreEffet =
  | 'eclair' | 'etoile' | 'etincelle' | 'fumee' | 'poussiere' | 'anneau' | 'halo'
  | 'caisse' | 'scintille' | 'obus' | 'trait' | 'missile' | 'rayon' | 'reticule';

/** Le nombre de particules vivantes qu'on ne dépasse jamais. */
export const CAPACITE_EFFETS = 256;
/** La part réservée à ce qui se couche au sol (anneaux, halos). */
export const PART_SOL = 0.25;

/**
 * Les défauts d'un genre : taille en cases, couleur, opacité au sommet, part
 * de la vie passée à monter (`montee`) et à s'éteindre (`fin`), couché ou non.
 */
const DEFAUTS: Readonly<Record<GenreEffet, { taille: number; couleur: Rvb; opacite: number; montee: number; fin: number; plat: boolean }>> = {
  eclair: { taille: 0.6, couleur: [1, 0.93, 0.72], opacite: 1, montee: 0, fin: 1, plat: false },
  etoile: { taille: 0.5, couleur: [1, 0.97, 0.86], opacite: 1, montee: 0, fin: 1, plat: false },
  etincelle: { taille: 0.08, couleur: [1, 0.93, 0.7], opacite: 1, montee: 0, fin: 1, plat: false },
  fumee: { taille: 0.4, couleur: [0.8, 0.8, 0.82], opacite: 0.45, montee: 0.2, fin: 0.8, plat: false },
  poussiere: { taille: 0.35, couleur: [0.87, 0.8, 0.65], opacite: 0.45, montee: 0.25, fin: 0.75, plat: false },
  anneau: { taille: 0.6, couleur: [1, 1, 1], opacite: 0.8, montee: 0.1, fin: 0.9, plat: true },
  halo: { taille: 0.8, couleur: [1, 1, 1], opacite: 0.6, montee: 0.3, fin: 0.7, plat: true },
  caisse: { taille: 0.2, couleur: [1, 1, 1], opacite: 1, montee: 0.1, fin: 0.2, plat: false },
  scintille: { taille: 0.2, couleur: [1, 1, 1], opacite: 1, montee: 0.5, fin: 0.5, plat: false },
  obus: { taille: 0.14, couleur: [1, 1, 1], opacite: 1, montee: 0, fin: 0.04, plat: false },
  trait: { taille: 0.36, couleur: [1, 0.92, 0.6], opacite: 1, montee: 0, fin: 0.06, plat: false },
  missile: { taille: 0.34, couleur: [1, 1, 1], opacite: 1, montee: 0, fin: 0.04, plat: false },
  rayon: { taille: 1, couleur: [1, 0.6, 0.25], opacite: 0.95, montee: 0.1, fin: 0.5, plat: false },
  reticule: { taille: 0.8, couleur: [1, 0.62, 0.25], opacite: 0.9, montee: 0.15, fin: 0.3, plat: false },
};

/**
 * Ce qu'on demande au pool. Tout est en cases (`x`, `y` au sol, `h` en
 * hauteur) et en millisecondes. Une particule suit **soit** un trajet (`vers`,
 * interpolé, `arc` en cloche : un projectile arrive exactement à l'heure),
 * **soit** une vitesse (`vx`, `vy`, `vh`, `gravite`, `amorti`).
 */
export interface SpecEffet {
  genre: GenreEffet;
  x: number;
  y: number;
  h?: number;
  vers?: { x: number; y: number; h?: number };
  /** La flèche d'un trajet, en cases de hauteur au milieu. */
  arc?: number;
  vx?: number;
  vy?: number;
  vh?: number;
  /** Vers le bas, en cases par seconde carrée. */
  gravite?: number;
  /** Freinage de la vitesse, par seconde : la fumée ralentit, l'étincelle non. */
  amorti?: number;
  /** Le plancher de la hauteur : une étincelle retombe au sol et y glisse. */
  sol?: number;
  duree: number;
  retard?: number;
  /**
   * L'arrêt sur image : pendant `tenue` millisecondes après le départ, la
   * particule reste à sa taille et à son opacité de départ, immobile ; sa vie
   * (`duree`) compte la tenue.
   */
  tenue?: number;
  taille?: number;
  tailleFin?: number;
  opacite?: number;
  montee?: number;
  fin?: number;
  couleur?: Rvb;
  /** La bouffée de fumée (0, 1, 2) : trois formes, pour qu'on n'en voie pas une seule répétée. */
  variante?: number;
  /** Couché au sol, sous les unités ; par défaut selon le genre. */
  plat?: boolean;
}

/** Une particule du pool : ses paramètres, et sa pose, réécrite en place à chaque image. */
class Particule {
  vivant = false;
  generation = 0;
  naissance = 0;
  age = 0;
  retard = 0;
  duree = 1;
  tenue = 0;
  genre: GenreEffet = 'eclair';
  variante = 0;
  plat = false;
  x0 = 0;
  y0 = 0;
  h0 = 0;
  trajet = false;
  x1 = 0;
  y1 = 0;
  h1 = 0;
  arc = 0;
  vx = 0;
  vy = 0;
  vh = 0;
  gravite = 0;
  amorti = 0;
  sol = -Infinity;
  taille = 1;
  tailleFin = 1;
  opacite = 1;
  montee = 0;
  fin = 1;
  readonly teinte: [number, number, number] = [1, 1, 1];
  readonly instance: InstanceSprite;
  readonly pose: Pose;

  constructor() {
    this.instance = { entree: ID_EFFET.eclair, animation: -1, cadre: 0, x: 0, y: 0, h: 0, teinte: this.teinte, opacite: 1, echelle: 1 };
    this.pose = { calque: 'effets', ligne: 0, colonne: 0, instance: this.instance };
  }
}

/** Une poignée d'effet : de quoi savoir s'il vit, et l'éteindre avant l'heure. */
export type PoigneeEffet = number;

/** Plus de places que cela, et la poignée ne se décode plus. */
const PLACES_MAX = 4096;

/** Le pool d'effets de la peau. */
export class PoolEffets {
  private readonly places: Particule[] = [];
  private readonly capaciteSol: number;
  private compteur = 0;
  private curseurAir = 0;
  private curseurSol = 0;

  constructor(readonly capacite = CAPACITE_EFFETS) {
    const total = Math.max(2, Math.min(PLACES_MAX, Math.round(capacite)));
    this.capaciteSol = Math.max(1, Math.round(total * PART_SOL));
    for (let i = 0; i < total; i++) this.places.push(new Particule());
  }

  /** Les particules vivantes, retards compris. */
  get vivants(): number {
    let n = 0;
    for (const p of this.places) if (p.vivant) n += 1;
    return n;
  }

  /** Vrai tant qu'une particule vit : la boucle doit continuer. */
  actif(): boolean {
    for (const p of this.places) if (p.vivant) return true;
    return false;
  }

  /** Une place libre de la bonne réserve, sinon la plus vieille qu'on recycle. */
  private place(plat: boolean): number {
    const debut = plat ? this.places.length - this.capaciteSol : 0;
    const taille = plat ? this.capaciteSol : this.places.length - this.capaciteSol;
    const curseur = plat ? this.curseurSol : this.curseurAir;
    for (let k = 0; k < taille; k++) {
      const i = debut + ((curseur + k) % taille);
      if (!this.places[i]!.vivant) {
        if (plat) this.curseurSol = (i - debut + 1) % taille;
        else this.curseurAir = (i - debut + 1) % taille;
        return i;
      }
    }
    let ancienne = debut;
    for (let i = debut; i < debut + taille; i++) {
      if (this.places[i]!.naissance < this.places[ancienne]!.naissance) ancienne = i;
    }
    return ancienne;
  }

  /** Fait naître une particule ; recycle la plus vieille de sa réserve si le pool est plein. */
  emettre(s: SpecEffet): PoigneeEffet {
    const d = DEFAUTS[s.genre];
    const plat = s.plat ?? d.plat;
    const i = this.place(plat);
    const p = this.places[i]!;
    this.compteur += 1;
    p.vivant = true;
    p.generation += 1;
    p.naissance = this.compteur;
    p.age = 0;
    p.retard = Math.max(0, s.retard ?? 0);
    p.duree = Math.max(1, s.duree);
    p.tenue = Math.max(0, Math.min(p.duree, s.tenue ?? 0));
    p.genre = s.genre;
    p.variante = Math.max(0, Math.floor(s.variante ?? 0));
    p.plat = plat;
    p.x0 = s.x;
    p.y0 = s.y;
    p.h0 = s.h ?? 0;
    p.trajet = s.vers !== undefined;
    p.x1 = s.vers?.x ?? s.x;
    p.y1 = s.vers?.y ?? s.y;
    p.h1 = s.vers?.h ?? p.h0;
    p.arc = s.arc ?? 0;
    p.vx = s.vx ?? 0;
    p.vy = s.vy ?? 0;
    p.vh = s.vh ?? 0;
    p.gravite = s.gravite ?? 0;
    p.amorti = Math.max(0, s.amorti ?? 0);
    p.sol = s.sol ?? -Infinity;
    p.taille = s.taille ?? d.taille;
    p.tailleFin = s.tailleFin ?? p.taille;
    p.opacite = s.opacite ?? d.opacite;
    p.montee = Math.max(0, s.montee ?? d.montee);
    p.fin = Math.max(0, s.fin ?? d.fin);
    const c = s.couleur ?? d.couleur;
    p.teinte[0] = c[0];
    p.teinte[1] = c[1];
    p.teinte[2] = c[2];
    p.pose.calque = plat ? 'ombres_unites' : 'effets';
    return p.generation * PLACES_MAX + i;
  }

  private decoder(h: PoigneeEffet): Particule | null {
    const i = h % PLACES_MAX;
    const p = this.places[i];
    return p && p.vivant && p.generation === Math.floor(h / PLACES_MAX) ? p : null;
  }

  /** Vrai si l'effet de cette poignée vit encore. */
  vivant(h: PoigneeEffet): boolean {
    return this.decoder(h) !== null;
  }

  /** Éteint un effet avant l'heure. Idempotent ; une poignée périmée n'éteint pas le suivant. */
  liberer(h: PoigneeEffet): void {
    const p = this.decoder(h);
    if (p) p.vivant = false;
  }

  /** Fait vieillir toutes les particules de `ms` ; les échues rendent leur place. */
  avancer(ms: number): void {
    const pas = Math.max(0, ms);
    for (const p of this.places) {
      if (!p.vivant) continue;
      p.age += pas;
      if (p.age >= p.retard + p.duree) p.vivant = false;
    }
  }

  /** Éteint tout : un clic coupe la partition, rien ne traîne. */
  couper(): void {
    for (const p of this.places) p.vivant = false;
  }

  /**
   * Ajoute à `sortie` les poses des particules visibles — parties, posées sur
   * une case vue, pas éteintes. `vu` reçoit la case au sol ; absent, tout est vu.
   * Rend le nombre de poses ajoutées.
   */
  poses(sortie: Pose[], vu?: (x: number, y: number) => boolean): number {
    let n = 0;
    for (const p of this.places) {
      if (!p.vivant || p.age < p.retard) continue;
      if (!this.poser(p)) continue;
      const inst = p.instance;
      if (vu && !vu(Math.floor(inst.x), Math.floor(inst.y))) continue;
      sortie.push(p.pose);
      n += 1;
    }
    return n;
  }

  /** Pose une particule à son âge. Rend faux si elle ne se voit pas (éteinte, sans taille). */
  private poser(p: Particule): boolean {
    const a = p.age - p.retard;
    const tenue = a < p.tenue;
    const vie = Math.max(1, p.duree - p.tenue);
    const t = tenue ? 0 : Math.min(1, (a - p.tenue) / vie);
    const secondes = tenue ? 0 : (a - p.tenue) / 1000;
    let x: number;
    let y: number;
    let h: number;
    let dx: number;
    let dy: number;
    let dh: number;
    if (p.trajet) {
      x = p.x0 + (p.x1 - p.x0) * t;
      y = p.y0 + (p.y1 - p.y0) * t;
      h = p.h0 + (p.h1 - p.h0) * t + 4 * p.arc * t * (1 - t);
      dx = p.x1 - p.x0;
      dy = p.y1 - p.y0;
      dh = p.h1 - p.h0 + 4 * p.arc * (1 - 2 * t);
    } else {
      const k = p.amorti;
      const deplace = k > 0 ? (1 - Math.exp(-k * secondes)) / k : secondes;
      const reste = k > 0 ? Math.exp(-k * secondes) : 1;
      x = p.x0 + p.vx * deplace;
      y = p.y0 + p.vy * deplace;
      h = p.h0 + p.vh * deplace - (p.gravite * secondes * secondes) / 2;
      dx = p.vx * reste;
      dy = p.vy * reste;
      dh = p.vh * reste - p.gravite * secondes;
      if (h < p.sol) {
        h = p.sol;
        dh = 0;
      }
    }
    let opacite: number;
    let taille: number;
    if (tenue) {
      opacite = p.opacite;
      taille = p.taille;
    } else {
      const monte = p.montee > 0 ? t / p.montee : 1;
      const eteint = p.fin > 0 ? (1 - t) / p.fin : 1;
      opacite = p.opacite * Math.max(0, Math.min(1, monte, eteint));
      taille = p.taille + (p.tailleFin - p.taille) * (1 - (1 - t) * (1 - t));
    }
    if (opacite <= 0.003 || taille <= 0) return false;
    const inst = p.instance;
    inst.entree = this.image(p, dx, dy, dh);
    inst.x = x;
    inst.y = y;
    inst.h = h;
    inst.opacite = opacite;
    inst.echelle = taille;
    p.pose.ligne = y;
    p.pose.colonne = x;
    return true;
  }

  /** L'image d'une particule : son genre, sa variante, et son cap d'écran pour ce qui s'oriente. */
  private image(p: Particule, dx: number, dy: number, dh: number): string {
    switch (p.genre) {
      case 'trait':
      case 'missile': {
        const dX = dx * PIXELS_PAR_CASE;
        const dY = (dy * SIN_TANGAGE - dh * COS_TANGAGE) * PIXELS_PAR_CASE;
        const k = directionEcran(dX, dY);
        return (p.genre === 'trait' ? IDS_TRAIT : IDS_MISSILE)[k]!;
      }
      case 'fumee':
        return IDS_FUMEE[p.variante % IDS_FUMEE.length]!;
      default:
        return ID_EFFET[p.genre];
    }
  }
}

// ---------------------------------------------------------------------------
// 3. La secousse de l'écran
// ---------------------------------------------------------------------------

/** La plus forte secousse, en pixels d'écran : au-delà, on ne lit plus la carte. */
export const SECOUSSE_MAX_PX = 4;
/** Les fréquences de la secousse, en hertz : deux axes décalés, jamais un aller-retour régulier. */
const FREQUENCE_X = 23;
const FREQUENCE_Y = 31;
/** Les secousses en attente de leur départ : un impact la lance après son arrêt sur image. */
const ATTENTES_SECOUSSE = 6;

/**
 * La secousse de l'écran : un décalage de la caméra, en pixels CSS, qui
 * s'**amortit** — son enveloppe tombe de l'amplitude à zéro, au carré, sur sa
 * durée. Elle ne touche que l'image (la matrice), jamais `versEcran` : un clic
 * pendant une secousse vise la case qu'il vise.
 *
 * Deux secousses ne s'additionnent pas : la plus forte l'emporte, une plus
 * faible qui arrive pendant une forte est absorbée.
 */
export class Secousse {
  private amplitude = 0;
  private duree = 0;
  private age = 0;
  private sens = 1;
  private readonly attentes = Array.from({ length: ATTENTES_SECOUSSE }, () => ({ actif: false, amplitude: 0, duree: 0, reste: 0 }));
  private readonly courant = { x: 0, y: 0 };

  /** Demande une secousse de `amplitude` pixels, amortie en `duree` ms, dans `retard` ms. */
  lancer(amplitude: number, duree: number, retard = 0): void {
    const a = Math.max(0, Math.min(SECOUSSE_MAX_PX, amplitude));
    if (a <= 0 || duree <= 0) return;
    if (retard > 0) {
      const libre = this.attentes.find((x) => !x.actif)
        ?? this.attentes.reduce((m, x) => (x.amplitude < m.amplitude ? x : m));
      libre.actif = true;
      libre.amplitude = a;
      libre.duree = duree;
      libre.reste = retard;
      return;
    }
    this.demarrer(a, duree, 0);
  }

  private demarrer(a: number, duree: number, age: number): void {
    if (this.duree > 0 && this.enveloppe() >= a) return;
    this.amplitude = a;
    this.duree = duree;
    this.age = Math.max(0, age);
    this.sens = -this.sens;
  }

  /** L'enveloppe courante, en pixels. */
  enveloppe(): number {
    if (this.duree <= 0) return 0;
    const u = Math.min(1, this.age / this.duree);
    return this.amplitude * (1 - u) * (1 - u);
  }

  /** Le décalage de l'image à cet instant, en pixels CSS : un objet réutilisé, à lire tout de suite. */
  decalage(): { readonly x: number; readonly y: number } {
    const e = this.enveloppe();
    const s = this.age / 1000;
    this.courant.x = e === 0 ? 0 : this.sens * e * Math.cos(TOUR * FREQUENCE_X * s);
    this.courant.y = e === 0 ? 0 : e * 0.7 * Math.sin(TOUR * FREQUENCE_Y * s + 0.9);
    return this.courant;
  }

  /** Vrai tant qu'une secousse court ou attend. */
  active(): boolean {
    return this.duree > 0 || this.attentes.some((x) => x.actif);
  }

  avancer(ms: number): void {
    const pas = Math.max(0, ms);
    if (this.duree > 0) {
      this.age += pas;
      if (this.age >= this.duree) {
        this.duree = 0;
        this.amplitude = 0;
        this.age = 0;
      }
    }
    for (const x of this.attentes) {
      if (!x.actif) continue;
      x.reste -= pas;
      if (x.reste <= 0) {
        x.actif = false;
        this.demarrer(x.amplitude, x.duree, -x.reste);
      }
    }
  }

  couper(): void {
    this.amplitude = 0;
    this.duree = 0;
    this.age = 0;
    for (const x of this.attentes) x.actif = false;
  }
}

// ---------------------------------------------------------------------------
// 4. Les superpositions d'un pouvoir : l'éclat, la vague de teinte
// ---------------------------------------------------------------------------

/** La montée d'un éclat d'écran, en millisecondes : un coup de lumière, pas un fondu. */
const MONTEE_ECLAT = 60;
/** L'épaisseur du front d'une vague, en cases. */
const FRONT_VAGUE = 0.6;
/** Les vagues qui peuvent courir ensemble : deux pour un super, une de marge. */
const VAGUES_MAX = 3;
/** Les segments d'une ellipse de vague : lisse à tout zoom. */
const SEGMENTS_VAGUE = 56;

interface Eclat { actif: boolean; couleur: [number, number, number]; alpha: number; duree: number; age: number; retard: number }
interface Vague { actif: boolean; x: number; y: number; couleur: [number, number, number]; rayon: number; duree: number; age: number; retard: number }

/**
 * Ce qui se peint **par-dessus** la carte le temps d'un pouvoir : un **éclat**
 * d'écran (un aplat plein qui monte vite et s'éteint) et des **vagues de
 * teinte** — une ellipse à la couleur du camp qui part de son QG et balaie la
 * carte, le front plus vif que ce qu'elle a déjà couvert. Des aplats, pas des
 * images : une vague traverse vingt cases, une texture y deviendrait floue.
 */
export class Superposition {
  private readonly eclat: Eclat = { actif: false, couleur: [1, 1, 1], alpha: 0, duree: 0, age: 0, retard: 0 };
  private readonly vagues: Vague[] = Array.from({ length: VAGUES_MAX }, () => ({
    actif: false, x: 0, y: 0, couleur: [1, 1, 1] as [number, number, number], rayon: 0, duree: 0, age: 0, retard: 0,
  }));

  /** Un éclat d'écran : `alpha` au sommet, éteint en `duree` ms. */
  eclater(couleur: Rvb, alpha: number, duree: number, retard = 0): void {
    const e = this.eclat;
    e.actif = alpha > 0 && duree > 0;
    e.couleur[0] = couleur[0];
    e.couleur[1] = couleur[1];
    e.couleur[2] = couleur[2];
    e.alpha = Math.max(0, Math.min(1, alpha));
    e.duree = Math.max(1, duree);
    e.age = 0;
    e.retard = Math.max(0, retard);
  }

  /** Une vague de teinte depuis la case `(x, y)` (au sol, en cases), jusqu'à `rayon` cases en `duree` ms. */
  vague(x: number, y: number, couleur: Rvb, rayon: number, duree: number, retard = 0): void {
    if (rayon <= 0 || duree <= 0) return;
    const v = this.vagues.find((w) => !w.actif)
      ?? this.vagues.reduce((m, w) => (w.age - w.retard > m.age - m.retard ? w : m));
    v.actif = true;
    v.x = x;
    v.y = y;
    v.couleur[0] = couleur[0];
    v.couleur[1] = couleur[1];
    v.couleur[2] = couleur[2];
    v.rayon = rayon;
    v.duree = duree;
    v.age = 0;
    v.retard = Math.max(0, retard);
  }

  /** L'opacité de l'éclat à cet instant. */
  alphaEclat(): number {
    const e = this.eclat;
    if (!e.actif) return 0;
    const a = e.age - e.retard;
    if (a < 0) return 0;
    if (a < MONTEE_ECLAT) return e.alpha * (a / MONTEE_ECLAT);
    const u = Math.min(1, (a - MONTEE_ECLAT) / Math.max(1, e.duree - MONTEE_ECLAT));
    return e.alpha * (1 - u) * (1 - u);
  }

  /** Le rayon du front de la vague `i`, en cases, ou `null` si elle ne court pas. */
  rayonVague(i: number): number | null {
    const v = this.vagues[i];
    if (!v || !v.actif || v.age < v.retard) return null;
    const u = Math.min(1, (v.age - v.retard) / v.duree);
    return v.rayon * (1 - (1 - u) ** 3);
  }

  active(): boolean {
    return this.eclat.actif || this.vagues.some((v) => v.actif);
  }

  avancer(ms: number): void {
    const pas = Math.max(0, ms);
    const e = this.eclat;
    if (e.actif) {
      e.age += pas;
      if (e.age >= e.retard + e.duree) e.actif = false;
    }
    for (const v of this.vagues) {
      if (!v.actif) continue;
      v.age += pas;
      if (v.age >= v.retard + v.duree) v.actif = false;
    }
  }

  couper(): void {
    this.eclat.actif = false;
    for (const v of this.vagues) v.actif = false;
  }

  /**
   * Trace ce qui court dans `t` (en coordonnées de plan) : les vagues, puis
   * l'éclat sur tout le champ. Rend le nombre de triangles ajoutés.
   */
  tracer(t: Trace, champ: Emprise): number {
    const avant = t.sommets;
    this.vagues.forEach((v, i) => {
      const r = this.rayonVague(i);
      if (r === null || r <= 0) return;
      const u = Math.min(1, (v.age - v.retard) / v.duree);
      const [cr, cv, cb] = v.couleur;
      const interieur: Rvba = [cr, cv, cb, 0.16 * (1 - u) ** 0.8];
      const front: Rvba = [Math.min(1, cr * 0.6 + 0.4), Math.min(1, cv * 0.6 + 0.4), Math.min(1, cb * 0.6 + 0.4), 0.45 * (1 - u)];
      tracerEllipse(t, v.x, v.y, 0, Math.max(0, r - FRONT_VAGUE), interieur);
      tracerEllipse(t, v.x, v.y, Math.max(0, r - FRONT_VAGUE), r, front);
    });
    const a = this.alphaEclat();
    if (a > 0.002) {
      const [cr, cv, cb] = this.eclat.couleur;
      t.rectangle(champ.minX, champ.minY, champ.maxX, champ.maxY, [cr, cv, cb, a]);
    }
    return (t.sommets - avant) / 3;
  }
}

/** Une couronne d'ellipse au sol (un disque si `r0` vaut 0), centrée sur un point de case. */
function tracerEllipse(t: Trace, x: number, y: number, r0: number, r1: number, c: Rvba): void {
  if (r1 <= r0 || c[3] <= 0) return;
  const centre = versPlan(x, y, 0);
  const rx0 = r0 * PIXELS_PAR_CASE;
  const ry0 = r0 * PIXELS_PAR_CASE * SIN_TANGAGE;
  const rx1 = r1 * PIXELS_PAR_CASE;
  const ry1 = r1 * PIXELS_PAR_CASE * SIN_TANGAGE;
  for (let k = 0; k < SEGMENTS_VAGUE; k++) {
    const a0 = (k / SEGMENTS_VAGUE) * TOUR;
    const a1 = ((k + 1) / SEGMENTS_VAGUE) * TOUR;
    const c0 = Math.cos(a0);
    const s0 = Math.sin(a0);
    const c1 = Math.cos(a1);
    const s1 = Math.sin(a1);
    if (r0 <= 0) {
      t.triangle(centre.X, centre.Y, centre.X + c0 * rx1, centre.Y + s0 * ry1, centre.X + c1 * rx1, centre.Y + s1 * ry1, c);
    } else {
      t.quadrilatere(
        centre.X + c0 * rx0, centre.Y + s0 * ry0, centre.X + c0 * rx1, centre.Y + s0 * ry1,
        centre.X + c1 * rx1, centre.Y + s1 * ry1, centre.X + c1 * rx0, centre.Y + s1 * ry0, c,
      );
    }
  }
}
