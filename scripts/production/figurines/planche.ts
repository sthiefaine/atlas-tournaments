/**
 * La planche d'une figurine : ce que le joueur verra, composé comme le jeu —
 * le nuanceur du lot (`src/render2d/lot.ts`) pour la couleur d'équipe,
 * l'ombre d'unité du rendu (`OMBRE_UNITE`, `render2d/replis.ts`) —, sur
 * l'herbe, dans les quatre vues, en bleu, rouge, Islande et Nouvelle-Zélande,
 * à 128 et à 48 pixels par case. À 48, la réduction est une moyenne des aires
 * en valeurs prémultipliées : ce que font les mipmaps du jeu, pas au bit près.
 */

import sharp from 'sharp';

import { OMBRE_UNITE, PIXELS_PAR_CASE, SIN_TANGAGE, type VueSprite } from '../../../src/render2d/contrat';

import type { Charte } from './charte';
import type { Cuisson } from './lecture';
import { composer, composerOmbre, fondUni, reduireCadre, rvb01, type Cadre, type Fond, type Rvb01 } from './mesures';

/** Ce que la planche montre d'une unité. */
export interface SujetPlanche {
  id: string;
  nom: string;
  classe: string;
  /** La taille de silhouette du canon (1, 2, 3) : l'ombre du jeu s'y règle (`echelleTaille`). */
  taille: number;
  vol: boolean;
  cuisson: Cuisson;
  charte: Charte;
}

/** L'échelle de l'ombre d'une unité selon sa taille de silhouette (`render/sprites/silhouettes.ts`, `echelleTaille`). */
export function echelleOmbre(taille: number): number {
  return taille === 1 ? 0.85 : taille === 3 ? 1.18 : 1;
}

interface Etiquette { x: number; y: number; texte: string; taille: number; gras?: boolean; ancre?: 'start' | 'middle' }

/** Pose une unité (ombre, puis figurine) sur un fond, pivot au pixel (`x`, `y`), à l'échelle `k` (1 : 128 px par case). */
function poserUnite(fond: Fond, cadre: Cadre, x: number, y: number, equipe: Rvb01, k: number, s: SujetPlanche, miroir: boolean, ombre: boolean): void {
  if (ombre) {
    const t = echelleOmbre(s.taille) * (s.vol ? 0.8 : 1);
    const rx = (OMBRE_UNITE.largeur * PIXELS_PAR_CASE * t * k) / 2;
    const ry = (OMBRE_UNITE.hauteur * PIXELS_PAR_CASE * SIN_TANGAGE * t * k) / 2;
    const cx = x + OMBRE_UNITE.decalageX * PIXELS_PAR_CASE * k;
    const cy = y + OMBRE_UNITE.decalageY * PIXELS_PAR_CASE * SIN_TANGAGE * k;
    composerOmbre(fond, cx, cy, rx, ry, OMBRE_UNITE.opacite * (s.vol ? 0.7 : 1));
  }
  composer(fond, k === 1 ? cadre : reduireCadre(cadre, k), x, y, equipe, miroir);
}

/** Le contour d'une case autour d'un pivot, à l'échelle `k`. */
function tracerCase(fond: Fond, x: number, y: number, k: number, couleur: Rvb01): void {
  const l = PIXELS_PAR_CASE * k;
  const h = PIXELS_PAR_CASE * SIN_TANGAGE * k;
  const x0 = Math.round(x - l / 2);
  const x1 = Math.round(x + l / 2);
  const y0 = Math.round(y - h / 2);
  const y1 = Math.round(y + h / 2);
  const pixel = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= fond.l || py >= fond.h) return;
    fond.rvb.set(couleur, (py * fond.l + px) * 3);
  };
  for (let px = x0; px <= x1; px++) { pixel(px, y0); pixel(px, y1); }
  for (let py = y0; py <= y1; py++) { pixel(x0, py); pixel(x1, py); }
}

/** Le premier cadre d'une vue : le repos, sinon la marche. */
function premierCadre(c: Cuisson, vue: VueSprite): Cadre | null {
  for (const clip of ['repos', 'deplacement']) {
    const cadres = c.cadres(vue, clip);
    if (cadres.length) return cadres[0]!;
  }
  return null;
}

async function ecrire(fond: Fond, etiquettes: readonly Etiquette[], chemin: string): Promise<void> {
  const octets = new Uint8Array(fond.l * fond.h * 3);
  for (let i = 0; i < octets.length; i++) octets[i] = Math.round(Math.min(1, Math.max(0, fond.rvb[i]!)) * 255);
  const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fond.l}" height="${fond.h}">${etiquettes.map((e) =>
    `<text x="${e.x}" y="${e.y}" font-family="Helvetica, Arial, sans-serif" font-size="${e.taille}" font-weight="${e.gras ? 700 : 400}" text-anchor="${e.ancre ?? 'start'}" fill="#15181d" stroke="#ffffff" stroke-width="3" paint-order="stroke">${echapper(e.texte)}</text>`,
  ).join('')}</svg>`;
  await sharp(Buffer.from(octets), { raw: { width: fond.l, height: fond.h, channels: 3 } })
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(chemin);
}

/** Agrandit un morceau de fond au plus proche voisin : voir les pixels d'un téléphone. */
function agrandir(source: Fond, x0: number, y0: number, l: number, h: number, facteur: number, cible: Fond, cx: number, cy: number): void {
  for (let y = 0; y < h * facteur; y++) {
    for (let x = 0; x < l * facteur; x++) {
      const sx = x0 + Math.floor(x / facteur);
      const sy = y0 + Math.floor(y / facteur);
      const tx = cx + x;
      const ty = cy + y;
      if (sx >= source.l || sy >= source.h || tx >= cible.l || ty >= cible.h) continue;
      cible.rvb.set(source.rvb.subarray((sy * source.l + sx) * 3, (sy * source.l + sx) * 3 + 3), (ty * cible.l + tx) * 3);
    }
  }
}

/**
 * La planche : les quatre vues (et la gauche, en miroir) des quatre camps à
 * 128 pixels par case ; les mêmes à 48, à la vraie taille et agrandies trois
 * fois ; un plateau de six cases où les camps se touchent ; la suite du repos.
 */
export async function ecrirePlanche(s: SujetPlanche, chemin: string): Promise<void> {
  const herbe = rvb01(s.charte.planche.herbe);
  const grille = rvb01(s.charte.planche.grille);
  const camps = s.charte.planche.camps;
  const colonnes: { titre: string; vue: VueSprite; miroir: boolean; ombre: boolean }[] = [
    { titre: 'droite', vue: 'droite', miroir: false, ombre: true },
    { titre: 'gauche (miroir)', vue: 'droite', miroir: true, ombre: true },
    { titre: 'bas', vue: 'bas', miroir: false, ombre: true },
    { titre: 'haut', vue: 'haut', miroir: false, ombre: true },
    { titre: 'profil (combat)', vue: 'profil', miroir: false, ombre: true },
  ];
  const cel = { l: 184, h: 170, px: 92, py: 116 };
  const cel48 = { l: 70, h: 64, px: 35, py: 44 };
  const k48 = 48 / PIXELS_PAR_CASE;
  const gauche = 130;
  const hautA = 60;
  const largeurA = gauche + colonnes.length * cel.l;
  const hautB = hautA + camps.length * cel.h + 50;
  const largeurB = gauche + colonnes.length * cel48.l;
  const zoom = 3;
  const hautC = hautB + camps.length * cel48.h + 40;
  const hautPlateau = hautC + camps.length * cel48.h * zoom + 50;
  const plateau = { colonnes: 6, lignes: 2 };
  const casePlateau = { l: 48, h: 48 * SIN_TANGAGE };
  const hautRepos = hautPlateau + Math.ceil(plateau.lignes * casePlateau.h + 20) * zoom + 50;
  const repos = s.cuisson.cadres('droite', 'repos');
  const largeur = Math.max(largeurA, largeurB + 40 + plateau.colonnes * casePlateau.l + 20, 40 + repos.length * 150, gauche + colonnes.length * cel48.l * zoom);
  const hauteur = hautRepos + 190;
  const fond = fondUni(largeur, hauteur, herbe);
  const etiquettes: Etiquette[] = [];
  const e = s.cuisson.meta;
  etiquettes.push({ x: 12, y: 28, texte: `${s.nom} — ${s.id} · classe ${s.classe} · cuisson v${e.version}, ${e.images} images`, taille: 20, gras: true });

  // A. 128 pixels par case.
  etiquettes.push({ x: 12, y: hautA - 8, texte: '128 px par case', taille: 15, gras: true });
  colonnes.forEach((c, j) => etiquettes.push({ x: gauche + j * cel.l + cel.px, y: hautA + 14, texte: c.titre, taille: 13, ancre: 'middle' }));
  camps.forEach((camp, i) => {
    const equipe = rvb01(camp.hex);
    const y = hautA + i * cel.h + cel.py;
    etiquettes.push({ x: 12, y: y - 30, texte: camp.nom.replace('_', ' '), taille: 14, gras: true });
    colonnes.forEach((c, j) => {
      const cadre = premierCadre(s.cuisson, c.vue);
      if (!cadre) return;
      const x = gauche + j * cel.l + cel.px;
      if (c.vue !== 'profil') tracerCase(fond, x, y, 1, grille);
      poserUnite(fond, cadre, x, y, equipe, 1, s, c.miroir, c.ombre);
    });
  });

  // B. 48 pixels par case, à la vraie taille.
  etiquettes.push({ x: 12, y: hautB - 10, texte: '48 px par case (un téléphone), vraie taille', taille: 15, gras: true });
  camps.forEach((camp, i) => {
    const equipe = rvb01(camp.hex);
    const y = hautB + i * cel48.h + cel48.py;
    colonnes.forEach((c, j) => {
      const cadre = premierCadre(s.cuisson, c.vue);
      if (!cadre) return;
      const x = gauche + j * cel48.l + cel48.px;
      if (c.vue !== 'profil') tracerCase(fond, x, y, k48, grille);
      poserUnite(fond, cadre, x, y, equipe, k48, s, c.miroir, c.ombre);
    });
  });
  // Le plateau : six cases, les camps côte à côte, de face et de dos.
  const px0 = largeurB + 40;
  const py0 = hautB;
  const plateauFond = fondUni(Math.ceil(plateau.colonnes * casePlateau.l) + 1, Math.ceil(plateau.lignes * casePlateau.h + 20), herbe);
  const oy = 20;
  for (let y = 0; y < plateau.lignes; y++) for (let x = 0; x < plateau.colonnes; x++) tracerCase(plateauFond, (x + 0.5) * casePlateau.l, oy + (y + 0.5) * casePlateau.h, k48, grille);
  const poses: { x: number; y: number; camp: number; vue: VueSprite; miroir: boolean }[] = [
    { x: 0, y: 0, camp: 0, vue: 'droite', miroir: false }, { x: 1, y: 0, camp: 1, vue: 'droite', miroir: true },
    { x: 2, y: 0, camp: 2, vue: 'droite', miroir: false }, { x: 3, y: 0, camp: 3, vue: 'droite', miroir: true },
    { x: 4, y: 0, camp: 0, vue: 'bas', miroir: false }, { x: 5, y: 0, camp: 1, vue: 'haut', miroir: false },
    { x: 0, y: 1, camp: 1, vue: 'droite', miroir: false }, { x: 1, y: 1, camp: 0, vue: 'droite', miroir: true },
    { x: 2, y: 1, camp: 3, vue: 'bas', miroir: false }, { x: 3, y: 1, camp: 2, vue: 'haut', miroir: false },
    { x: 4, y: 1, camp: 2, vue: 'droite', miroir: true }, { x: 5, y: 1, camp: 3, vue: 'droite', miroir: false },
  ];
  // Rangée du haut d'abord : une case plus bas est devant (l'ordre du lot).
  for (const p of poses) {
    const cadre = premierCadre(s.cuisson, p.vue);
    if (!cadre) continue;
    poserUnite(plateauFond, cadre, Math.round((p.x + 0.5) * casePlateau.l), Math.round(oy + (p.y + 0.5) * casePlateau.h), rvb01(camps[p.camp]!.hex), k48, s, p.miroir, true);
  }
  for (let y = 0; y < plateauFond.h; y++) {
    for (let x = 0; x < plateauFond.l; x++) {
      if (px0 + x < fond.l && py0 + y < fond.h) fond.rvb.set(plateauFond.rvb.subarray((y * plateauFond.l + x) * 3, (y * plateauFond.l + x) * 3 + 3), ((py0 + y) * fond.l + px0 + x) * 3);
    }
  }
  etiquettes.push({ x: px0, y: py0 - 10, texte: 'plateau à 48 px', taille: 13, gras: true });

  // C. Les mêmes, agrandies trois fois au plus proche voisin.
  etiquettes.push({ x: 12, y: hautC - 10, texte: `48 px par case, agrandi ×${zoom} (chaque carré est un pixel du téléphone)`, taille: 15, gras: true });
  agrandir(fond, gauche, hautB, colonnes.length * cel48.l, camps.length * cel48.h, zoom, fond, gauche, hautC);
  etiquettes.push({ x: 12, y: hautPlateau - 10, texte: `plateau à 48 px, agrandi ×${zoom}`, taille: 15, gras: true });
  agrandir(fond, px0, py0, plateauFond.l, plateauFond.h, zoom, fond, gauche, hautPlateau);

  // D. Le repos, image par image : le seul signe de vie, et rien d'autre.
  etiquettes.push({ x: 12, y: hautRepos - 10, texte: `repos, vue droite, ${repos.length} images (bleu, 128 px)`, taille: 15, gras: true });
  repos.forEach((c, k) => {
    const x = 40 + k * 150 + 75;
    const y = hautRepos + 120;
    poserUnite(fond, c, x, y, rvb01(camps[0]!.hex), 1, s, false, true);
    etiquettes.push({ x, y: hautRepos + 180, texte: String(k), taille: 12, ancre: 'middle' });
  });
  await ecrire(fond, etiquettes, chemin);
}

/** La planche des clips : chaque clip de la vue droite, image par image, puis la marche en bas et en haut. */
export async function ecrirePlancheClips(s: SujetPlanche, chemin: string): Promise<void> {
  const lignes: { titre: string; vue: VueSprite; clip: string }[] = [];
  for (const a of s.cuisson.entree.animations) lignes.push({ titre: `${a.vue} · ${a.clip} (${a.cadres.length} images, ${a.ips} i/s${a.boucle ? ', boucle' : ''})`, vue: a.vue, clip: a.clip });
  const cel = { l: 150, h: 160, py: 118 };
  const max = Math.max(...lignes.map((l) => s.cuisson.cadres(l.vue, l.clip).length));
  const fond = fondUni(40 + max * cel.l, 20 + lignes.length * (cel.h + 24), rvb01(s.charte.planche.herbe));
  const etiquettes: Etiquette[] = [];
  const bleu = rvb01(s.charte.planche.camps[0]!.hex);
  lignes.forEach((l, i) => {
    const y0 = 20 + i * (cel.h + 24);
    etiquettes.push({ x: 12, y: y0 + 14, texte: l.titre, taille: 14, gras: true });
    s.cuisson.cadres(l.vue, l.clip).forEach((c, k) => {
      const x = 40 + k * cel.l + cel.l / 2;
      const y = y0 + 24 + cel.py;
      if (l.vue !== 'profil') tracerCase(fond, x, y, 1, rvb01(s.charte.planche.grille));
      poserUnite(fond, c, x, y, bleu, 1, s, false, true);
    });
  });
  await ecrire(fond, etiquettes, chemin);
}
