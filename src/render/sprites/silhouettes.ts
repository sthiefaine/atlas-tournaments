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

/** Pattes : la base d'un groupe d'infanterie, jamais d'un véhicule. */
function pattes(g: Pinceau, col: Palette, lourd: boolean): void {
  const soldat = (dx: number, dy: number, sc: number): void => {
    g.save();
    g.translate(dx, dy);
    g.scale(sc, sc);
    g.fillStyle = col.dark;
    rr(g, -6, 8, 5, 10, 2);
    g.fill();
    rr(g, 1, 8, 5, 10, 2);
    g.fill();
    g.fillStyle = col.main;
    rr(g, -8, -6, 16, 16, lourd ? 3 : 5);
    g.fill();
    g.fillStyle = col.light;
    rr(g, -4, -3, 8, 6, 2);
    g.fill();
    g.fillStyle = PEAU;
    g.beginPath();
    g.arc(0, -12, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col.main;
    g.beginPath();
    g.arc(0, -14, 7.5, Math.PI, 0);
    g.fill();
    rr(g, -8, -15, 16, 3, 1.5);
    g.fill();
    trait(g, 6, -2, 14, -10, ACIER, 3);
    g.restore();
  };
  soldat(-10, 2, 0.85);
  soldat(8, -4, 0.85);
  soldat(0, 10, 0.85);
}

/** Coque : la base des unités de mer. */
function coque(g: Pinceau, col: Palette): void {
  ell(g, 0, 14, 24, 6, 'rgba(255,255,255,0.35)');
  polygone(g, [[-24, 2], [24, 2], [17, 14], [-17, 14]], col.dark);
  rrPlein(g, -20, -2, 40, 6, 3, col.main);
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

/** Ailes : la base d'un avion. */
function ailes(g: Pinceau, col: Palette): void {
  ell(g, 0, 20, 16, 4, 'rgba(0,0,0,0.18)');
  polygone(g, [[-6, -2], [6, -2], [22, 10], [-22, 10]], col.dark);
  polygone(g, [[-20, -6], [-12, -6], [-16, 2], [-24, 2]], col.dark);
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

  const lourd = corps === 'bloc';
  switch (base) {
    case 'chenilles': chenilles(g); break;
    case 'roues': roues(g); break;
    case 'pattes': pattes(g, palette, lourd); break;
    case 'coque': coque(g, palette); break;
    case 'rotor': rotor(g, palette); break;
    case 'ailes': ailes(g, palette); break;
    case 'rail': rail(g); break;
    default: break;
  }

  // Les pattes *sont* le corps : un groupe d'infanterie n'a pas de caisse.
  if (base !== 'pattes') {
    if (corps === 'bloc') bloc(g, palette);
    else if (corps === 'capsule') capsule(g, palette);
    else plateau(g, palette);
  }

  const ancres = base === 'pattes'
    ? { haut: { x: 8, y: -12 }, avant: { x: 14, y: -6 }, arriere: { x: -14, y: -4 } }
    : ancresDe(corps);
  for (const piece of modules.slice(0, MODULES_MAX)) {
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
