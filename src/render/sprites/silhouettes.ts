/**
 * Le composeur de silhouettes (`02-architecture.md` §3.4, « Les silhouettes »).
 *
 * **Aucune unité n'est dessinée par son nom.** Une unité apporte une `Silhouette`
 * déclarative — une `base`, un `corps`, trois `modules` au plus et une `taille` —
 * et ce fichier la compose à partir des fonctions vectorielles de la démo,
 * décomposées. Les dix unités canon sont elles-mêmes définies comme des
 * silhouettes, ce qui garantit que le composeur est exercé par le contenu
 * existant et pas seulement par les nouveautés.
 *
 * Le dessin est centré sur `(0, 0)` et calibré pour une tuile de 64 pixels.
 */

import type {
  BaseSilhouette, CorpsSilhouette, ModuleSilhouette, Palette, Silhouette, TailleSilhouette,
} from '../../schemas/types';
import { disque, ell, ombre, rr, rrPlein, polygone, trait, type Pinceau } from './formes';

/** Gris de chenille et de canon : la couleur « matériel » commune à tout le monde. */
const ACIER = '#2e3238';
const ACIER_CLAIR = '#555b63';
const VERRE = '#cfe9ff';
const PEAU = '#f3c9a4';

/** Facteur d'échelle par taille de silhouette. */
export function echelleTaille(taille: TailleSilhouette): number {
  if (taille === 1) return 0.85;
  if (taille === 3) return 1.18;
  return 1;
}

/** Ancre d'un module sur un corps : où le module se pose, dans le repère local. */
export interface Ancre { x: number; y: number }

/** Les ancres fixes d'un corps : haut, avant, arrière. */
export function ancresDe(corps: CorpsSilhouette): { haut: Ancre; avant: Ancre; arriere: Ancre } {
  switch (corps) {
    case 'capsule':
      return { haut: { x: -2, y: -10 }, avant: { x: 12, y: -6 }, arriere: { x: -14, y: -6 } };
    case 'plateau':
      return { haut: { x: -3, y: -4 }, avant: { x: 10, y: -3 }, arriere: { x: -13, y: -2 } };
    default:
      return { haut: { x: -2, y: -8 }, avant: { x: 13, y: -5 }, arriere: { x: -15, y: -4 } };
  }
}

// ---------------------------------------------------------------------------
// Bases
// ---------------------------------------------------------------------------

/** Train de chenilles : la base des blindés. */
function chenilles(g: Pinceau): void {
  rrPlein(g, -22, 0, 44, 14, 6, ACIER);
  g.fillStyle = ACIER_CLAIR;
  for (let i = -17; i <= 13; i += 6) {
    rr(g, i, 3, 4, 8, 2);
    g.fill();
  }
}

/** Trois roues sur un essieu sombre. */
function roues(g: Pinceau): void {
  rrPlein(g, -20, 2, 40, 9, 4, ACIER);
  for (const x of [-14, 0, 14]) {
    disque(g, x, 11, 5.2, ACIER);
    disque(g, x, 11, 2.2, ACIER_CLAIR);
  }
}

/**
 * Pattes : la base d'un groupe d'infanterie, jamais d'un véhicule. Le dessin
 * est délégué aux figurines (plus bas) : ce que portent les hommes vient des
 * modules, et c'est la **masse** du groupe — nombre, carrure, posture — qui
 * doit distinguer une troupe d'une autre à 36 pixels, pas un accessoire.
 */
function pattes(g: Pinceau, col: Palette, equipement: Equipement): void {
  if (equipement === 'lance_missiles') sectionAntichar(g, col);
  else if (equipement === 'chantier') equipeDeChantier(g, col);
  else patrouille(g, col);
}

/**
 * Coque : la base des unités de mer, vue de profil, l'avant à droite. Une étrave
 * en pointe, une bande de flottaison sombre, un pont clair et un bastingage :
 * la version précédente était un trapèze symétrique, qui ne disait ni de quel
 * côté était l'avant ni où finissait l'eau.
 */
function coque(g: Pinceau, col: Palette): void {
  // L'étrave fend l'eau : la moustache d'écume part de la proue vers l'arrière.
  ell(g, -4, 15, 24, 5, 'rgba(255,255,255,0.35)');
  ell(g, 18, 13, 10, 3, 'rgba(255,255,255,0.5)');
  polygone(g, [[-22, 1], [21, 1], [26, 6], [17, 14], [-18, 14]], col.dark);
  rrPlein(g, -22, -3, 45, 6, 2.5, col.main);
  // Le liseré de flottaison : c'est lui qui pose la coque dans l'eau.
  g.fillStyle = ACIER;
  rr(g, -20, 8.5, 42, 2.4, 1.2);
  g.fill();
  // Le pont et son bastingage.
  g.fillStyle = col.light;
  rr(g, -19, -2, 39, 2.2, 1.1);
  g.fill();
  g.fillStyle = ACIER_CLAIR;
  for (let x = -18; x <= 18; x += 6) {
    rr(g, x, -6, 1.4, 4, 0.7);
    g.fill();
  }
  rr(g, -19, -7, 40, 1.4, 0.7);
  g.fill();
}

/** Rotor : patins et poutre de queue, la base d'un giravion. */
function rotor(g: Pinceau, col: Palette): void {
  ell(g, 0, 22, 18, 5, 'rgba(0,0,0,0.18)');
  g.fillStyle = col.dark;
  rr(g, -4, -6, 30, 6, 3);
  g.fill();
  g.fillStyle = col.main;
  g.beginPath();
  g.arc(26, -3, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ACIER;
  rr(g, -16, 8, 24, 3, 1.5);
  g.fill();
  rr(g, -12, 3, 3, 6, 1);
  g.fill();
  rr(g, 4, 3, 3, 6, 1);
  g.fill();
}

/**
 * Ailes : la base d'un avion, vu de trois quarts arrière, le nez à droite. Une
 * voilure en flèche dont le saumon prend l'accent — c'est la seule marque de
 * nation lisible d'en haut —, un empennage, une dérive et un réacteur. La
 * version précédente posait deux triangles sombres et rien d'autre.
 */
function ailes(g: Pinceau, col: Palette): void {
  ell(g, -2, 22, 17, 4, 'rgba(0,0,0,0.18)');
  // La dérive en flèche, puis le plan fixe horizontal, tous deux à l'arrière.
  polygone(g, [[-24, 1], [-15, -15], [-9, -15], [-14, 1]], col.light);
  polygone(g, [[-27, 0], [-11, 0], [-15, 5], [-29, 5]], col.dark);
  // L'aile : bord d'attaque en flèche vers l'avant, saumon à l'accent.
  polygone(g, [[8, 0], [21, 3], [3, 14], [-16, 10]], col.dark);
  polygone(g, [[3, 14], [-16, 10], [-21, 12], [-1, 17]], col.light);
  // Le réacteur sous l'emplanture, tuyère à gauche.
  rrPlein(g, -14, 3, 21, 6, 3, ACIER);
  rrPlein(g, -12, 4.2, 15, 2, 1, ACIER_CLAIR);
  disque(g, -13.5, 6, 2.6, '#1b1e22');
}

/**
 * Aile delta : la voilure d'un appareil sans queue ni dérive (`ailes` + `plateau`,
 * catalogue 6). Le corps est fondu dans l'aile — une bosse basse, une verrière
 * couchée —, les saumons prennent l'accent, et rien ne dépasse vers l'arrière :
 * vu d'en haut, c'est un triangle, pas une croix, et c'est ce qui le distingue
 * du chasseur à 64 px.
 */
function aileDelta(g: Pinceau, col: Palette): void {
  ell(g, -3, 22, 19, 4, 'rgba(0,0,0,0.18)');
  // La voilure : un delta, le nez à droite, le bord de fuite droit à gauche.
  polygone(g, [[24, 2], [-20, -12], [-24, -4], [-24, 10], [-20, 16]], col.dark);
  polygone(g, [[24, 2], [-20, 16], [-24, 10], [2, 6]], col.main);
  // Les saumons, à l'accent : la seule marque de nation lisible d'en haut.
  polygone(g, [[-20, -12], [-24, -4], [-16, -6]], col.light);
  polygone(g, [[-20, 16], [-24, 10], [-16, 12]], col.light);
  // Les élevons, sombres, sur le bord de fuite.
  rrPlein(g, -24, -2, 3, 5, 1, '#2c3136');
  rrPlein(g, -24, 8, 3, 5, 1, '#2c3136');
  // La bosse du fuselage, fondue, et la verrière couchée juste derrière le nez.
  ell(g, -2, 2, 16, 5, col.main);
  ell(g, 9, 1, 5, 2.6, '#9ed6ff');
  // Deux tuyères plates, enterrées dans le bord de fuite.
  disque(g, -20, 0, 1.8, '#1b1e22');
  disque(g, -20, 5, 1.8, '#1b1e22');
}

/** Rail : deux files et des traverses. */
function rail(g: Pinceau): void {
  g.fillStyle = '#6b5a45';
  for (let x = -22; x <= 18; x += 8) {
    rr(g, x, 8, 5, 9, 1.5);
    g.fill();
  }
  g.fillStyle = ACIER_CLAIR;
  rr(g, -26, 7, 52, 2, 1);
  g.fill();
  rr(g, -26, 15, 52, 2, 1);
  g.fill();
}

// ---------------------------------------------------------------------------
// Corps
// ---------------------------------------------------------------------------

/** Corps « bloc » : la caisse d'un blindé, dégradé clair vers principal. */
function bloc(g: Pinceau, col: Palette): void {
  const grad = g.createLinearGradient(0, -14, 0, 4);
  grad.addColorStop(0, col.light);
  grad.addColorStop(1, col.main);
  g.fillStyle = grad;
  rr(g, -19, -10, 38, 16, 6);
  g.fill();
  g.fillStyle = col.dark;
  rr(g, -19, 2, 38, 4, 2);
  g.fill();
}

/** Corps « capsule » : la cellule arrondie d'un giravion ou d'une capsule. */
function capsule(g: Pinceau, col: Palette): void {
  const grad = g.createLinearGradient(0, -16, 0, 8);
  grad.addColorStop(0, col.light);
  grad.addColorStop(1, col.main);
  g.fillStyle = grad;
  rr(g, -22, -14, 32, 22, 10);
  g.fill();
  g.fillStyle = VERRE;
  rr(g, -20, -11, 12, 9, 4);
  g.fill();
}

/** Corps « plateau » : la caisse basse d'une artillerie ou d'un porteur. */
function plateau(g: Pinceau, col: Palette): void {
  g.fillStyle = col.main;
  rr(g, -16, -6, 26, 12, 5);
  g.fill();
  g.fillStyle = col.light;
  rr(g, -13, -4, 14, 3, 1.5);
  g.fill();
}

// ---------------------------------------------------------------------------
// Figurines à pied
// ---------------------------------------------------------------------------

/**
 * Ce qu'une troupe à pied porte. Sur une base `pattes`, il n'y a pas de caisse
 * où poser un module : il dit l'équipement des hommes. `lance_roquettes`
 * devient un tube d'épaule ; `radar` désigne **par convention** le technicien
 * — la même lecture que `composerSilhouette` côté 3D — donc une équipe de
 * chantier casquée et outillée, sans fusil. Tout autre module reste un fusil.
 */
export type Equipement = 'fusil' | 'lance_missiles' | 'chantier';

/** L'équipement d'une troupe à pied, lu dans ses modules. */
export function equipementDe(modules: readonly ModuleSilhouette[]): Equipement {
  if (modules.includes('lance_roquettes')) return 'lance_missiles';
  if (modules.includes('radar')) return 'chantier';
  return 'fusil';
}

/** Les modules qu'une base `pattes` a déjà traduits en équipement : on ne les pose pas une seconde fois. */
const MODULES_PORTES: readonly ModuleSilhouette[] = ['lance_roquettes', 'radar'];

/** Bois des manches d'outils, commun à toutes les nations. */
const BOIS = '#8a6a45';
/** Reflet sur un métal cylindrique : le trait de lumière qui fait lire un tube. */
const ACIER_REFLET = '#7c838c';
/** Bande réfléchissante d'un gilet haute visibilité. */
const REFLET = '#f6f5ee';

type Casque = 'rebord' | 'lourd' | 'chantier';

/** Une figurine : où elle pose les pieds et de quoi elle a l'air. */
interface Figurine {
  x: number;
  y: number;
  /** Grandit tout ; la carrure n'élargit que le torse. */
  echelle: number;
  carrure: number;
  /** À genou : jambes repliées, et tout le haut descend d'autant. */
  genou: boolean;
  casque: Casque;
  /** Sombre : un porte-plaques. Haute visibilité : l'accent, barré de bandes. */
  gilet: 'sombre' | 'haute_visibilite';
}

/**
 * Le corps d'une figurine, pieds en `(0, 0)` du repère local et tête vers le
 * haut, puis `enMain` par-dessus : l'équipement se tient devant le torse, il
 * doit donc se dessiner après lui. Le geste `save`/`translate`/`scale` est
 * ici, et une seule fois, pour que chaque formation ne parle qu'en positions.
 */
function figurine(g: Pinceau, col: Palette, f: Figurine, enMain: (dy: number) => void): void {
  g.save();
  g.translate(f.x, f.y);
  g.scale(f.echelle, f.echelle);
  // La descente du haut du corps quand la figurine met un genou à terre.
  const dy = f.genou ? 4 : 0;

  g.fillStyle = col.dark;
  if (f.genou) {
    rr(g, -9, -5, 9, 5, 2);
    g.fill();
    rr(g, 1, -8.5, 5.5, 8.5, 2);
    g.fill();
    g.fillStyle = ACIER;
    rr(g, -10, -3, 5, 3.2, 1);
    g.fill();
    rr(g, 0.5, -2.6, 6.5, 3, 1);
    g.fill();
  } else {
    rr(g, -5.8, -10, 5.2, 10, 2);
    g.fill();
    rr(g, 0.6, -10, 5.2, 10, 2);
    g.fill();
    // Les bottes ferment la silhouette par le bas : sans elles, les jambes se
    // perdent dans l'ombre au sol.
    g.fillStyle = ACIER;
    rr(g, -6.4, -2.6, 6.2, 3, 1);
    g.fill();
    rr(g, 0.2, -2.6, 6.2, 3, 1);
    g.fill();
  }

  const l = 14 * f.carrure;
  g.fillStyle = col.main;
  rr(g, -l / 2, -22 + dy, l, 13, 3.5);
  g.fill();
  if (f.gilet === 'sombre') {
    g.fillStyle = col.dark;
    rr(g, -3.6, -20.5 + dy, 7.2, 9.5, 2);
    g.fill();
  } else {
    g.fillStyle = col.light;
    rr(g, -l / 2 + 1.5, -21 + dy, l - 3, 11, 2.5);
    g.fill();
    g.fillStyle = REFLET;
    rr(g, -l / 2 + 1.5, -18 + dy, l - 3, 1.6, 0.8);
    g.fill();
    rr(g, -l / 2 + 1.5, -14 + dy, l - 3, 1.6, 0.8);
    g.fill();
  }

  disque(g, 0, -27 + dy, 5.2, PEAU);
  if (f.casque === 'rebord') {
    g.fillStyle = col.main;
    g.beginPath();
    g.arc(0, -28 + dy, 6.2, Math.PI, 0);
    g.fill();
    g.fillStyle = col.dark;
    rr(g, -8, -29.2 + dy, 16, 2.4, 1.2);
    g.fill();
    g.fillStyle = col.light;
    rr(g, -3.5, -33 + dy, 4, 1.5, 0.75);
    g.fill();
  } else if (f.casque === 'lourd') {
    // Le casque lourd descend sur les joues : il ne laisse qu'une fente de visage.
    g.fillStyle = col.main;
    g.beginPath();
    g.arc(0, -27.5 + dy, 7.2, Math.PI, 0);
    g.fill();
    rr(g, -7.2, -27.5 + dy, 14.4, 5, 1.5);
    g.fill();
    g.fillStyle = ACIER;
    rr(g, -6, -27 + dy, 12, 1.8, 0.9);
    g.fill();
    g.fillStyle = col.light;
    rr(g, -4, -33.5 + dy, 5, 1.6, 0.8);
    g.fill();
  } else {
    // Casque de chantier : calotte à l'accent, visière plate vers l'avant.
    g.fillStyle = col.light;
    g.beginPath();
    g.arc(0, -28 + dy, 6.4, Math.PI, 0);
    g.fill();
    rr(g, -1, -29.6 + dy, 10.5, 2.2, 1.1);
    g.fill();
    g.fillStyle = ACIER;
    rr(g, -6.4, -29.2 + dy, 12.8, 1.4, 0.7);
    g.fill();
  }

  enMain(dy);
  g.restore();
}

/** Un fusil d'assaut tenu en travers de la poitrine, deux mains dessus. */
function fusil(g: Pinceau, col: Palette, dy: number): void {
  // Le métal est clair et ses arêtes sombres : sur l'encre du panneau
  // d'inspection, un fusil tout en `ACIER` disparaît.
  trait(g, -8.5, -12.5 + dy, 10.5, -23 + dy, ACIER, 4);
  trait(g, -8.5, -12.5 + dy, 10.5, -23 + dy, ACIER_CLAIR, 2.2);
  trait(g, -8.5, -12.5 + dy, -12, -10 + dy, col.dark, 3.6);
  trait(g, -0.5, -17.5 + dy, 1, -13 + dy, ACIER, 2.6);
  disque(g, -5.5, -14.5 + dy, 1.9, PEAU);
  disque(g, 4.5, -20.5 + dy, 1.9, PEAU);
}

/**
 * Un lance-missiles porté à l'épaule : gros tube, ogive en avant, tuyère en
 * arrière. Le tube passe devant le menton comme sur un Mech d'Advance Wars —
 * c'est lui qu'on doit voir en premier, pas le visage.
 */
function lanceMissiles(g: Pinceau, col: Palette, dy: number): void {
  const ax = -13; const ay = -9 + dy;
  const bx = 17; const by = -31 + dy;
  // Direction du tube et sa normale, pour poser l'ogive et la tuyère.
  const dx = bx - ax; const dyy = by - ay;
  const n = Math.hypot(dx, dyy);
  const ux = dx / n; const uy = dyy / n;
  const px = -uy; const py = ux;
  polygone(g, [
    [ax + px * 4.5, ay + py * 4.5], [ax - px * 4.5, ay - py * 4.5],
    [ax - ux * 5 - px * 3, ay - uy * 5 - py * 3], [ax - ux * 5 + px * 3, ay - uy * 5 + py * 3],
  ], ACIER);
  trait(g, ax, ay, bx, by, ACIER, 7.5);
  trait(g, ax, ay, bx, by, ACIER_CLAIR, 5);
  trait(g, ax + 2, ay - 1.8, bx - 2, by - 1.8, ACIER_REFLET, 1.4);
  polygone(g, [
    [bx + px * 3.8, by + py * 3.8], [bx - px * 3.8, by - py * 3.8], [bx + ux * 7, by + uy * 7],
  ], col.light);
  disque(g, bx + ux * 4.5, by + uy * 4.5, 1.6, col.dark);
  // Poignée sous le tube, et les deux mains.
  trait(g, -1, -17 + dy, -1, -13 + dy, ACIER, 2.4);
  disque(g, -1, -13.5 + dy, 2, PEAU);
  disque(g, 6, -23.5 + dy, 2, PEAU);
}

/** Une pelle sur l'épaule, fer en l'air. */
function pelle(g: Pinceau, dy: number): void {
  trait(g, -3, -13 + dy, 13, -35 + dy, BOIS, 2.4);
  g.save();
  g.translate(13, -35 + dy);
  // Le fer prolonge le manche : même angle, pointe en avant.
  g.rotate(Math.atan2(-22, 16));
  polygone(g, [[-1, -4.2], [5.5, -4], [9.5, 0], [5.5, 4], [-1, 4.2]], ACIER);
  polygone(g, [[0, -2.8], [5, -2.6], [7.8, 0], [5, 2.6], [0, 2.8]], ACIER_CLAIR);
  g.restore();
  disque(g, -2, -14 + dy, 2, PEAU);
  disque(g, 5, -24 + dy, 2, PEAU);
}

/** Un marteau-piqueur tenu devant soi, poignée en T et fleuret au sol. */
function marteauPiqueur(g: Pinceau, dy: number): void {
  g.fillStyle = ACIER;
  rr(g, 5, -19 + dy, 6.5, 13, 2);
  g.fill();
  g.fillStyle = ACIER_CLAIR;
  rr(g, 6.2, -17.8 + dy, 4.1, 9, 1.4);
  g.fill();
  trait(g, 8.2, -6 + dy, 8.2, 1.5, ACIER_CLAIR, 2.2);
  g.fillStyle = ACIER;
  rr(g, 1, -21.8 + dy, 14.5, 3, 1.5);
  g.fill();
  g.fillStyle = ACIER_CLAIR;
  rr(g, 2, -21 + dy, 12.5, 1.5, 0.75);
  g.fill();
  disque(g, 2.5, -20 + dy, 2, PEAU);
  disque(g, 14, -20 + dy, 2, PEAU);
}

/** Une caisse à outils posée au sol, poignée relevée. */
function caisseAOutils(g: Pinceau, col: Palette, x: number, y: number): void {
  trait(g, x - 3, y - 7.5, x + 3, y - 7.5, ACIER_CLAIR, 1.8);
  rrPlein(g, x - 6.5, y - 6.5, 13, 6.5, 1.4, col.main);
  g.fillStyle = col.dark;
  rr(g, x - 6.5, y - 6.5, 13, 2.6, 1.2);
  g.fill();
  g.fillStyle = col.light;
  rr(g, x - 1.4, y - 4.4, 2.8, 1.8, 0.6);
  g.fill();
}

/** Infanterie : trois fantassins légers en file, fusil en travers. */
function patrouille(g: Pinceau, col: Palette): void {
  const leger = { echelle: 0.86, carrure: 1, genou: false, casque: 'rebord', gilet: 'sombre' } as const;
  for (const [x, y] of [[-13, 3], [0, 8], [12, 13]] as const) {
    figurine(g, col, { ...leger, x, y }, (dy) => fusil(g, col, dy));
  }
}

/** Méca : deux gaillards trapus, l'un debout, l'autre à genou, tube à l'épaule. */
function sectionAntichar(g: Pinceau, col: Palette): void {
  const trapu = { echelle: 1.02, carrure: 1.32, casque: 'lourd', gilet: 'sombre' } as const;
  figurine(g, col, { ...trapu, x: -10, y: 3, genou: false }, (dy) => lanceMissiles(g, col, dy));
  figurine(g, col, { ...trapu, x: 10, y: 13, genou: true }, (dy) => lanceMissiles(g, col, dy));
}

/** Génie : une équipe de chantier, casques à visière, gilets à bandes, outils et caisse. */
function equipeDeChantier(g: Pinceau, col: Palette): void {
  const ouvrier = { echelle: 0.92, carrure: 1.1, casque: 'chantier', gilet: 'haute_visibilite' } as const;
  caisseAOutils(g, col, -15, 13);
  figurine(g, col, { ...ouvrier, x: -7, y: 2, genou: false }, (dy) => pelle(g, dy));
  figurine(g, col, { ...ouvrier, x: 9, y: 12, genou: true }, (dy) => marteauPiqueur(g, dy));
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

/** Tourelle : coupole et canon court. */
function tourelle(g: Pinceau, col: Palette, a: Ancre): void {
  trait(g, a.x + 6, a.y, a.x + 28, a.y - 3, ACIER, 5);
  disque(g, a.x, a.y, 9, col.main);
  disque(g, a.x - 2, a.y - 2, 4, col.light);
}

/** Canon long : le tube incliné d'une pièce d'artillerie. */
function canonLong(g: Pinceau, col: Palette, a: Ancre): void {
  trait(g, a.x, a.y, a.x + 22, a.y - 18, ACIER, 6);
  trait(g, a.x, a.y, a.x + 22, a.y - 18, col.dark, 2);
  disque(g, a.x, a.y, 4.5, col.dark);
}

/** Lance-roquettes : un bloc de tubes. */
function lanceRoquettes(g: Pinceau, col: Palette, a: Ancre): void {
  g.save();
  g.translate(a.x, a.y - 4);
  g.rotate(-0.22);
  g.fillStyle = col.dark;
  rr(g, -9, -5, 22, 11, 3);
  g.fill();
  g.fillStyle = ACIER;
  for (let j = -3; j <= 2; j += 5) {
    rr(g, -6, j, 17, 3, 1.5);
    g.fill();
  }
  g.restore();
}

/** Radar : une parabole sur son pied. */
function radar(g: Pinceau, col: Palette, a: Ancre): void {
  trait(g, a.x, a.y + 4, a.x, a.y - 6, ACIER, 2.5);
  g.save();
  g.translate(a.x, a.y - 8);
  g.rotate(-0.5);
  g.fillStyle = col.light;
  g.beginPath();
  g.ellipse(0, 0, 8, 3.4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = col.dark;
  g.beginPath();
  g.ellipse(0, 1.6, 8, 2, 0, 0, Math.PI);
  g.fill();
  g.restore();
}

/** Antenne : un mât fin et son fanion. */
function antenne(g: Pinceau, col: Palette, a: Ancre): void {
  trait(g, a.x, a.y + 4, a.x, a.y - 16, ACIER, 2);
  polygone(g, [[a.x, a.y - 16], [a.x + 10, a.y - 12], [a.x, a.y - 8]], col.main);
}

/** Grue : un bras articulé, le module des transports et du génie. */
function grue(g: Pinceau, col: Palette, a: Ancre): void {
  trait(g, a.x, a.y + 2, a.x + 4, a.y - 10, col.dark, 4);
  trait(g, a.x + 4, a.y - 10, a.x + 20, a.y - 14, ACIER, 3);
  trait(g, a.x + 20, a.y - 14, a.x + 20, a.y - 6, ACIER_CLAIR, 2);
}

/** Panneaux solaires : deux ailes plates et bleutées. */
function panneauxSolaires(g: Pinceau, a: Ancre): void {
  for (const sens of [-1, 1]) {
    g.save();
    g.translate(a.x + sens * 13, a.y - 5);
    g.rotate(sens * 0.12);
    g.fillStyle = '#2c4d80';
    rr(g, -10, -3, 20, 6, 1.5);
    g.fill();
    g.fillStyle = '#5f8fd0';
    rr(g, -8, -2, 7, 4, 1);
    g.fill();
    rr(g, 1, -2, 7, 4, 1);
    g.fill();
    g.restore();
  }
}

/** Nacelle : la bulle vitrée d'un poste de pilotage avancé. */
function nacelle(g: Pinceau, col: Palette, a: Ancre): void {
  g.fillStyle = col.dark;
  rr(g, a.x - 8, a.y - 2, 16, 10, 5);
  g.fill();
  g.fillStyle = VERRE;
  rr(g, a.x - 6, a.y, 12, 6, 4);
  g.fill();
}

/** Dessine un module à son ancre. */
function dessinerModule(g: Pinceau, piece: ModuleSilhouette, col: Palette, ancres: ReturnType<typeof ancresDe>): void {
  switch (piece) {
    case 'tourelle': tourelle(g, col, ancres.haut); break;
    case 'canon_long': canonLong(g, col, ancres.avant); break;
    case 'lance_roquettes': lanceRoquettes(g, col, ancres.haut); break;
    case 'radar': radar(g, col, ancres.arriere); break;
    case 'antenne': antenne(g, col, ancres.arriere); break;
    case 'grue': grue(g, col, ancres.avant); break;
    case 'panneaux_solaires': panneauxSolaires(g, ancres.haut); break;
    case 'nacelle': nacelle(g, col, ancres.avant); break;
    default: break;
  }
}

// ---------------------------------------------------------------------------
// Le composeur
// ---------------------------------------------------------------------------

/** Nombre maximal de modules composés, quoi qu'en dise la donnée (`03-schemas.md` §3). */
export const MODULES_MAX = 3;

/**
 * Compose une unité à partir de sa silhouette. C'est **la** règle du brief : le
 * rendu ne connaît aucune unité par son nom, seulement une base, un corps, des
 * modules et une taille, tous teintés par la palette de la nation.
 */
export function dessinerSilhouette(
  g: Pinceau,
  base: BaseSilhouette,
  corps: CorpsSilhouette,
  modules: readonly ModuleSilhouette[],
  taille: TailleSilhouette,
  palette: Palette,
): void {
  const s = echelleTaille(taille);
  g.save();
  g.scale(s, s);
  ell(g, 0, 16, 20, 6, 'rgba(0,0,0,0.25)');

  switch (base) {
    case 'chenilles': chenilles(g); break;
    case 'roues': roues(g); break;
    case 'pattes': pattes(g, palette, equipementDe(modules)); break;
    case 'coque': coque(g, palette); break;
    case 'rotor': rotor(g, palette); break;
    // Une voilure au corps « plateau » est une aile delta : le corps y est fondu.
    case 'ailes': if (corps === 'plateau') aileDelta(g, palette); else ailes(g, palette); break;
    case 'rail': rail(g); break;
    default: break;
  }

  // Les pattes *sont* le corps : un groupe d'infanterie n'a pas de caisse ;
  // l'aile delta a déjà dessiné le sien.
  if (base !== 'pattes' && !(base === 'ailes' && corps === 'plateau')) {
    if (corps === 'bloc') bloc(g, palette);
    else if (corps === 'capsule') capsule(g, palette);
    else plateau(g, palette);
  }

  const ancres = base === 'pattes'
    ? { haut: { x: 8, y: -12 }, avant: { x: 14, y: -6 }, arriere: { x: -14, y: -4 } }
    : ancresDe(corps);
  // Une troupe à pied a déjà mis son équipement en main : les modules qu'il
  // traduit ne se posent pas une seconde fois, les autres gardent leur ancre.
  const poses = modules.slice(0, MODULES_MAX)
    .filter((piece) => base !== 'pattes' || !MODULES_PORTES.includes(piece));
  for (const piece of poses) {
    dessinerModule(g, piece, palette, ancres);
  }

  // Le rotor tourne au-dessus de tout le reste, comme dans la démo.
  if (base === 'rotor') {
    g.strokeStyle = 'rgba(40,44,50,0.85)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-32, -20);
    g.lineTo(20, -16);
    g.stroke();
    g.beginPath();
    g.moveTo(-8, -30);
    g.lineTo(0, -6);
    g.stroke();
    disque(g, -6, -18, 3, ACIER);
  }
  g.restore();
}

/** Raccourci : compose depuis l'objet `Silhouette` du catalogue. */
export function dessinerUnite(g: Pinceau, silhouette: Silhouette, palette: Palette): void {
  dessinerSilhouette(g, silhouette.base, silhouette.corps, silhouette.modules, silhouette.taille, palette);
}

/**
 * Clé de cache d'une silhouette : deux unités de silhouette identique partagent
 * le même canvas hors écran. Une unité homologuée n'ajoute donc ni fichier, ni
 * image, ni entrée de cache si sa silhouette existe déjà.
 */
export function cleSilhouette(s: Silhouette): string {
  const modules = s.modules.slice(0, MODULES_MAX).join('+') || 'nu';
  return `${s.base}-${s.corps}-${modules}-${s.taille}`;
}

/** Dessine l'unité avec son ombre douce de groupe, prêt à blitter. */
export function dessinerUniteOmbree(g: Pinceau, silhouette: Silhouette, palette: Palette): void {
  ombre(g, true, 7, 3);
  dessinerUnite(g, silhouette, palette);
  ombre(g, false);
}
