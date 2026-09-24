/**
 * La planche d'un bâtiment : ce que le joueur verra, composé comme le jeu
 * (`doc/refonte/plan-batiments.md` §5). Le bâtiment dans les quatre camps de
 * la planche des unités, **neutre** (le gris des bâtiments sans maître et son
 * mât nu), **désaffecté** (neutre, sans mât dessiné : le sien est couché dans
 * l'image), et **de nuit** (le voile de la nuit et les fenêtres allumées), à
 * 128 et à 48 pixels par case — vraie taille, puis agrandie trois fois — et
 * sur un plateau avec des unités installées pour l'échelle.
 *
 * Ce que le rendu pose et que la cuisson n'a pas, la planche le pose comme lui :
 * le pavé sous la case (`render2d/sol/terrains.ts`), le mât et le drapeau au
 * pied du mât (`render2d/batiments.ts`, `render2d/replis.ts`), le voile et le
 * poids de l'émission (`render/ambiance.ts`, `render2d/meteo.ts`), l'ombre
 * d'une unité (`OMBRE_UNITE`). L'ombre d'un bâtiment, elle, est cuite.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { ambiance } from '../../../src/render/ambiance';
import { COULEUR_NEUTRE } from '../../../src/render/couleur-equipe';
import { ECHELLE_DRAPEAU_QG, ECHELLE_MAT_QG, hauteurDrapeau, PIED_MAT } from '../../../src/render2d/batiments';
import { COS_TANGAGE, EMISSION_NUIT, OMBRE_UNITE, PIXELS_PAR_CASE, SIN_TANGAGE, type VueSprite } from '../../../src/render2d/contrat';
import { voileDuLot } from '../../../src/render2d/meteo';
import { HAUTEUR_MAT, TAILLE_DRAPEAU } from '../../../src/render2d/replis';
import { couleursSol, DISPOSITION } from '../../../src/render2d/sol/couleurs';
import { MATIERES } from '../../../src/render2d/sol/terrains';

import type { Charte } from './charte';
import { lireCuisson, type Cuisson } from './lecture';
import {
  composer, composerOmbre, fondUni, reduireCadre, rvb01, voilerFond, type Ambiance2d, type Cadre, type Fond, type Regle, type Rvb01,
} from './mesures';
import { echelleOmbre } from './planche';

/** Une entrée cuite d'un bâtiment, telle que la planche la montre. */
export interface EtatPlanche {
  id: string;
  etat: string;
  variante: string;
  cuisson: Cuisson;
  regles: readonly Regle[];
}

export interface SujetPlancheBatiment {
  cle: string;
  etats: readonly EtatPlanche[];
  charte: Charte;
}

/** Le voile de la nuit claire et le poids de l'émission la nuit : ceux du rendu. */
export function ambianceNuit(): Ambiance2d {
  const v = voileDuLot(ambiance('ete', 'nuit', 'clair'));
  return { voile: [v[0]!, v[1]!, v[2]!, v[3]!], emission: EMISSION_NUIT };
}

/** Le ton moyen du pavé que le sol pose sous un bâtiment (plaine, printemps, temps clair). */
export function solBatiment(): Rvb01 {
  const s = couleursSol('plaine', 'printemps', 'clair');
  const i = DISPOSITION.matieres + MATIERES.indexOf('pave') * 9;
  return [(s[i]! + s[i + 3]!) / 2, (s[i + 1]! + s[i + 4]!) / 2, (s[i + 2]! + s[i + 5]!) / 2];
}

/** Assombrit ou éclaircit une couleur vers le blanc, comme `css(c, facteur, BLANC, t)` du rendu. */
function nuance(c: Rvb01, facteur: number, versBlanc = 0): Rvb01 {
  return [0, 1, 2].map((k) => {
    const v = c[k]! * facteur;
    return Math.max(0, Math.min(1, v + (1 - v) * versBlanc));
  }) as unknown as Rvb01;
}

/** Peint un pixel `x, y` du fond en `c`, à la couverture `a`, voilé s'il le faut. */
function peindre(fond: Fond, x: number, y: number, c: Rvb01, a: number, voile: Ambiance2d['voile'] | null): void {
  if (x < 0 || y < 0 || x >= fond.l || y >= fond.h || a <= 0) return;
  const o = (y * fond.l + x) * 3;
  for (let k = 0; k < 3; k++) {
    const v = voile ? c[k]! * (1 - voile[3]) + voile[k]! * voile[3] : c[k]!;
    fond.rvb[o + k] = v * a + fond.rvb[o + k]! * (1 - a);
  }
}

/** Remplit une forme donnée par `dedans(x, y)` en coordonnées continues, suréchantillonnée 4 × 4. */
function remplir(fond: Fond, x0: number, y0: number, x1: number, y1: number, dedans: (x: number, y: number) => boolean, c: Rvb01,
  voile: Ambiance2d['voile'] | null): void {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      let n = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) if (dedans(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) n++;
      if (n) peindre(fond, x, y, c, n / 16, voile);
    }
  }
}

/**
 * Le mât et le drapeau d'un bâtiment, comme le rendu les pose : le pied au
 * coin arrière droit de la case (`PIED_MAT`), la hampe de `HAUTEUR_MAT`, et
 * s'il y a un camp le drapeau hissé en haut (`hauteurDrapeau(1)`). Sans camp,
 * un mât nu (un bâtiment neutre, plan §4). `x, y` : le pivot du bâtiment dans
 * le fond ; `k` l'échelle (1 : 128 pixels par case) ; `echelleMat` et
 * `echelleDrapeau`, l'agrandissement que le rendu donne au QG
 * (`ECHELLE_MAT_QG`, `ECHELLE_DRAPEAU_QG`).
 */
export function dessinerMat(fond: Fond, x: number, y: number, k: number, camp: Rvb01 | null, voile: Ambiance2d['voile'] | null = null,
  echelleMat = 1, echelleDrapeau = 1): void {
  const px = x + (PIED_MAT.x - 0.5) * PIXELS_PAR_CASE * k;
  const py = y + (PIED_MAT.y - 0.5) * PIXELS_PAR_CASE * SIN_TANGAGE * k;
  const H = PIXELS_PAR_CASE * COS_TANGAGE * k;
  // Le rendu agrandit la forme entière autour de son pivot : la hampe s'épaissit avec elle.
  const km = k * echelleMat;
  const haut = HAUTEUR_MAT * H * echelleMat;
  // La hampe : sombre, un filet clair, une boule dorée au sommet (`replis.ts`, `dessinForme`).
  remplir(fond, px - 2 * km, py - haut, px + 2 * km, py, (u, v) => u >= px - 2 * km && u <= px + 2 * km && v >= py - haut && v <= py, rvb01('#3a3f47'), voile);
  remplir(fond, px - 1 * km, py - haut, px + 0.5 * km, py, (u, v) => u >= px - 1 * km && u <= px + 0.5 * km && v >= py - haut && v <= py, rvb01('#c9ced6'), voile);
  const r = 3 * km;
  remplir(fond, px - r, py - haut - r, px + r, py - haut + r, (u, v) => (u - px) ** 2 + (v - py + haut) ** 2 <= r * r, rvb01('#d8c27a'), voile);
  if (!camp) return;
  // Le drapeau : le pivot au pied de sa hampe, à gauche ; il flotte vers la droite. Ses bords sont les deux courbes du rendu.
  const kd = k * echelleDrapeau;
  const l = TAILLE_DRAPEAU.l * kd;
  const h = TAILLE_DRAPEAU.h * kd;
  const bx = px;
  const by = py - hauteurDrapeau(1, echelleMat, echelleDrapeau) * H;
  const haut_ = (u: number): number => {
    const t = u / l;
    return (1 - t) ** 2 * -h + 2 * t * (1 - t) * (-h - 3 * kd) + t * t * (-h + 2 * kd);
  };
  const bas = (u: number): number => {
    const t = 1 - u / l;
    return (1 - t) ** 2 * (2 * kd) + 2 * t * (1 - t) * (-3 * kd);
  };
  remplir(fond, bx, by - h - 3 * kd, bx + l, by + 2 * kd, (u, v) => {
    const du = u - bx;
    return du >= 0 && du <= l && v - by >= haut_(du) && v - by <= bas(du);
  }, camp, voile);
  const clair = nuance(camp, 1, 0.45);
  remplir(fond, bx + 2 * kd, by - h + 2 * kd, bx + 2 * kd + l * 0.45, by - h + 5 * kd,
    (u, v) => u >= bx + 2 * kd && u <= bx + 2 * kd + l * 0.45 && v >= by - h + 2 * kd && v <= by - h + 5 * kd, clair, voile);
}

/** Peint la case d'un bâtiment (le pavé que le rendu pose sous lui) autour d'un pivot, à l'échelle `k`, et son liseré. */
function poserCase(fond: Fond, x: number, y: number, k: number, sol: Rvb01, grille: Rvb01): void {
  const l = PIXELS_PAR_CASE * k;
  const h = PIXELS_PAR_CASE * SIN_TANGAGE * k;
  const x0 = Math.round(x - l / 2);
  const x1 = Math.round(x + l / 2);
  const y0 = Math.round(y - h / 2);
  const y1 = Math.round(y + h / 2);
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if (px < 0 || py < 0 || px >= fond.l || py >= fond.h) continue;
      fond.rvb.set(px === x0 || px === x1 || py === y0 || py === y1 ? grille : sol, (py * fond.l + px) * 3);
    }
  }
}

/** Ce qu'une cellule de la planche montre. */
interface Montre {
  camp: Rvb01 | null;
  /** Le mât dessiné : avec drapeau (camp), nu, ou aucun (le désaffecté a le sien, couché). */
  mat: 'drapeau' | 'nu' | 'aucun';
  nuit: boolean;
  /** Le QG : son mât et son drapeau agrandis, comme le rendu les pose. */
  qg?: boolean;
}

/** Pose un bâtiment dans une cellule : le pavé, l'image, puis le mât et le drapeau ; la nuit, tout sous le voile et les fenêtres par-dessus. */
function poserBatiment(fond: Fond, cadre: Cadre, x: number, y: number, k: number, m: Montre, sol: Rvb01, grille: Rvb01, nuit: Ambiance2d,
  cellule: { x0: number; y0: number; x1: number; y1: number }): void {
  poserCase(fond, x, y, k, sol, grille);
  if (m.nuit) voilerFond(fond, nuit.voile, cellule.x0, cellule.y0, cellule.x1, cellule.y1);
  composer(fond, k === 1 ? cadre : reduireCadre(cadre, k), x, y, m.camp ?? rvb01(COULEUR_NEUTRE), false, 1, m.nuit ? nuit : null);
  if (m.mat !== 'aucun') {
    dessinerMat(fond, x, y, k, m.mat === 'drapeau' ? m.camp : null, m.nuit ? nuit.voile : null,
      m.qg ? ECHELLE_MAT_QG : 1, m.qg ? ECHELLE_DRAPEAU_QG : 1);
  }
}

interface Etiquette { x: number; y: number; texte: string; taille: number; gras?: boolean; ancre?: 'start' | 'middle'; couleur?: string }

async function ecrire(fond: Fond, etiquettes: readonly Etiquette[], chemin: string): Promise<void> {
  const octets = new Uint8Array(fond.l * fond.h * 3);
  for (let i = 0; i < octets.length; i++) octets[i] = Math.round(Math.min(1, Math.max(0, fond.rvb[i]!)) * 255);
  const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fond.l}" height="${fond.h}">${etiquettes.map((e) =>
    `<text x="${e.x}" y="${e.y}" font-family="Helvetica, Arial, sans-serif" font-size="${e.taille}" font-weight="${e.gras ? 700 : 400}" text-anchor="${e.ancre ?? 'start'}" fill="${e.couleur ?? '#15181d'}" stroke="#ffffff" stroke-width="3" paint-order="stroke">${echapper(e.texte)}</text>`,
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

/** Le premier cadre d'une vue au repos. */
function cadreRepos(c: Cuisson, vue: VueSprite = 'fixe'): Cadre | null {
  return c.cadres(vue, 'repos')[0] ?? null;
}

/**
 * Les colonnes d'une rangée : un état en service se montre dans les camps,
 * neutre et de nuit ; un désaffecté, neutre seulement ; un terrain (le pont),
 * sans camp ni mât, de face et de travers.
 */
function colonnesDe(e: EtatPlanche, camps: readonly { nom: string; hex: string }[]): { titre: string; montre: Montre; vue: VueSprite }[] {
  if (e.id.startsWith('terrain_')) {
    return [
      { titre: 'fixe', montre: { camp: null, mat: 'aucun', nuit: false }, vue: 'fixe' },
      { titre: 'travers', montre: { camp: null, mat: 'aucun', nuit: false }, vue: 'travers' },
      { titre: 'fixe, nuit', montre: { camp: null, mat: 'aucun', nuit: true }, vue: 'fixe' },
    ];
  }
  if (e.etat === 'desaffecte') {
    return [
      { titre: 'désaffecté', montre: { camp: null, mat: 'aucun', nuit: false }, vue: 'fixe' },
      { titre: 'désaffecté, nuit', montre: { camp: null, mat: 'aucun', nuit: true }, vue: 'fixe' },
    ];
  }
  const qg = e.id.startsWith('batiment_qg_') ? { qg: true } : {};
  return [
    ...camps.map((c) => ({ titre: c.nom.replace('_', ' '), montre: { camp: rvb01(c.hex), mat: 'drapeau' as const, nuit: false, ...qg }, vue: 'fixe' as const })),
    { titre: 'neutre (mât nu)', montre: { camp: null, mat: 'nu', nuit: false, ...qg }, vue: 'fixe' },
    { titre: `${camps[0]!.nom}, nuit`, montre: { camp: rvb01(camps[0]!.hex), mat: 'drapeau', nuit: true, ...qg }, vue: 'fixe' },
    { titre: 'neutre, nuit', montre: { camp: null, mat: 'nu', nuit: true, ...qg }, vue: 'fixe' },
  ];
}

/** Une unité installée, pour l'échelle : sa première image « droite », sa taille de silhouette. */
async function uniteInstallee(cle: string): Promise<{ cadre: Cadre; taille: number; vol: boolean } | null> {
  const racine = join('public', 'assets', 'sprites');
  const id = `unite_${cle}_base`;
  if (!existsSync(join(racine, 'unites', `${id}.json`))) return null;
  try {
    const c = await lireCuisson(racine, id);
    const cadre = c.cadres('droite', 'repos')[0] ?? c.cadres('droite', 'deplacement')[0];
    const unites = (JSON.parse(readFileSync('content/unites.json', 'utf8')) as { unites: { cle: string; domaine: string; silhouette: { taille: number } }[] }).unites;
    const u = unites.find((x) => x.cle === cle);
    return cadre && u ? { cadre, taille: u.silhouette.taille, vol: u.domaine === 'air' } : null;
  } catch {
    return null;
  }
}

/** Pose une unité comme le rendu : son ombre (`OMBRE_UNITE`), puis elle. */
function poserUnite(fond: Fond, u: { cadre: Cadre; taille: number; vol: boolean }, x: number, y: number, equipe: Rvb01, k: number, miroir: boolean): void {
  const t = echelleOmbre(u.taille) * (u.vol ? 0.8 : 1);
  composerOmbre(fond, x + OMBRE_UNITE.decalageX * PIXELS_PAR_CASE * k, y + OMBRE_UNITE.decalageY * PIXELS_PAR_CASE * SIN_TANGAGE * k,
    (OMBRE_UNITE.largeur * PIXELS_PAR_CASE * t * k) / 2, (OMBRE_UNITE.hauteur * PIXELS_PAR_CASE * SIN_TANGAGE * t * k) / 2, OMBRE_UNITE.opacite * (u.vol ? 0.7 : 1));
  composer(fond, k === 1 ? u.cadre : reduireCadre(u.cadre, k), x, y, equipe, miroir);
}

/**
 * La planche d'un bâtiment : chaque entrée cuite en rangée (camps, neutre,
 * nuit ; le désaffecté neutre seulement), à 128 px puis à 48 px (vraie taille
 * et agrandie trois fois), un plateau de cases avec des unités installées,
 * et les règles qui échouent, entrée par entrée.
 */
export async function ecrirePlancheBatiment(s: SujetPlancheBatiment, chemin: string): Promise<void> {
  const herbe = rvb01(s.charte.planche.herbe);
  const grille = rvb01(s.charte.planche.grille);
  const sol = solBatiment();
  const nuit = ambianceNuit();
  const camps = s.charte.planche.camps;
  const etats = [...s.etats].sort((a, b) => rang(a) - rang(b) || a.id.localeCompare(b.id));
  const rangees = etats.map((e) => ({ e, colonnes: colonnesDe(e, camps), cadre: cadreRepos(e.cuisson) }));
  if (!rangees.length) throw new Error(`${s.cle} : aucune entrée cuite à mettre en planche`);
  const nCol = Math.max(1, ...rangees.map((r) => r.colonnes.length));
  const cel = { l: 210, h: 250, px: 105, py: 165 };
  const k48 = 48 / PIXELS_PAR_CASE;
  const cel48 = { l: Math.round(cel.l * k48), h: Math.round(cel.h * k48), px: Math.round(cel.px * k48), py: Math.round(cel.py * k48) };
  const zoom = 3;
  const gauche = 150;
  const hautA = 70;
  const hautB = hautA + rangees.length * (cel.h + 24) + 40;
  const hautC = hautB + rangees.length * (cel48.h + 12) + 40;
  const hautD = hautC + rangees.length * (cel48.h + 12) * zoom + 50;
  // Le plateau : cinq colonnes, trois lignes.
  const plateau = { colonnes: 5, lignes: 3 };
  const case48 = { l: 48, h: 48 * SIN_TANGAGE };
  const plateauL = Math.ceil(plateau.colonnes * case48.l) + 1;
  const plateauH = Math.ceil(plateau.lignes * case48.h + 60);
  const hautE = hautD + plateauH * zoom + 60;
  const echecs = etats.map((e) => ({ id: e.id, liste: e.regles.filter((r) => r.verdict === 'echec') }));
  const lignesEchecs = echecs.reduce((n, x) => n + 1 + x.liste.length, 0);
  const largeur = Math.max(gauche + nCol * cel.l + 20, gauche + nCol * cel48.l * zoom + 20, gauche + plateauL * zoom + 40 + plateauL + 40, 900);
  const hauteur = hautE + lignesEchecs * 20 + 40;
  const fond = fondUni(largeur, hauteur, herbe);
  const etiquettes: Etiquette[] = [];
  const meta = etats[0]?.cuisson.meta;
  etiquettes.push({ x: 12, y: 30, texte: `${s.cle} — ${etats.map((e) => e.id).join(', ')}${meta ? ` · cuisson v${meta.version}` : ''}`, taille: 20, gras: true });

  // A. 128 pixels par case.
  etiquettes.push({ x: 12, y: hautA - 10, texte: '128 px par case (la case : le pavé que le rendu pose sous un bâtiment)', taille: 15, gras: true });
  rangees.forEach((r, i) => {
    const y0 = hautA + i * (cel.h + 24);
    etiquettes.push({ x: 12, y: y0 + 30, texte: r.e.id.replace(/^batiment_/, ''), taille: 14, gras: true });
    r.colonnes.forEach((c, j) => {
      const cadre = cadreRepos(r.e.cuisson, c.vue);
      if (!cadre) return;
      const x0 = gauche + j * cel.l;
      const x = x0 + cel.px;
      const y = y0 + 16 + cel.py;
      poserBatiment(fond, cadre, x, y, 1, c.montre, sol, grille, nuit, { x0, y0: y0 + 16, x1: x0 + cel.l - 6, y1: y0 + 16 + cel.h });
      etiquettes.push({ x, y: y0 + 12, texte: c.titre, taille: 12, ancre: 'middle' });
    });
  });

  // B. 48 pixels par case, vraie taille.
  etiquettes.push({ x: 12, y: hautB - 10, texte: '48 px par case (un téléphone), vraie taille', taille: 15, gras: true });
  rangees.forEach((r, i) => {
    const y0 = hautB + i * (cel48.h + 12);
    r.colonnes.forEach((c, j) => {
      const cadre = cadreRepos(r.e.cuisson, c.vue);
      if (!cadre) return;
      const x0 = gauche + j * cel48.l;
      poserBatiment(fond, cadre, x0 + cel48.px, y0 + cel48.py, k48, c.montre, sol, grille, nuit, { x0, y0, x1: x0 + cel48.l - 2, y1: y0 + cel48.h });
    });
  });

  // C. Les mêmes, agrandies trois fois.
  etiquettes.push({ x: 12, y: hautC - 10, texte: `48 px par case, agrandi ×${zoom} (chaque carré est un pixel du téléphone)`, taille: 15, gras: true });
  agrandir(fond, gauche, hautB, nCol * cel48.l, rangees.length * (cel48.h + 12), zoom, fond, gauche, hautC);

  // D. Le plateau à 48 px : le bâtiment entre des cases d'herbe, dans ses états, avec des unités installées.
  const base = rangees.find((r) => r.e.etat === 'base' && r.e.variante === 'base') ?? rangees[0];
  const desaffecte = rangees.find((r) => r.e.etat === 'desaffecte');
  const pf = fondUni(plateauL, plateauH, herbe);
  const oy = 50;
  for (let y = 0; y < plateau.lignes; y++) {
    for (let x = 0; x < plateau.colonnes; x++) {
      const cx = (x + 0.5) * case48.l;
      const cy = oy + (y + 0.5) * case48.h;
      const l = case48.l;
      const h = case48.h;
      for (let px = Math.round(cx - l / 2); px <= Math.round(cx + l / 2); px++) {
        for (const py of [Math.round(cy - h / 2), Math.round(cy + h / 2)]) if (px >= 0 && py >= 0 && px < pf.l && py < pf.h) pf.rvb.set(grille, (py * pf.l + px) * 3);
      }
      for (let py = Math.round(cy - h / 2); py <= Math.round(cy + h / 2); py++) {
        for (const px of [Math.round(cx - l / 2), Math.round(cx + l / 2)]) if (px >= 0 && py >= 0 && px < pf.l && py < pf.h) pf.rvb.set(grille, (py * pf.l + px) * 3);
      }
    }
  }
  const infanterie = await uniteInstallee('infanterie');
  const charLeger = await uniteInstallee('char_leger');
  const charMoyen = await uniteInstallee('char_moyen');
  type Pion = { x: number; y: number; batiment?: { cadre: Cadre; montre: Montre }; unite?: { u: NonNullable<typeof infanterie>; camp: number; miroir: boolean } };
  const pions: Pion[] = [];
  const campRvb = (i: number): Rvb01 => rvb01(camps[i % camps.length]!.hex);
  // Un terrain (le pont) n'a ni camp ni mât : il se pose tel quel.
  const terrain = base?.e.id.startsWith('terrain_') ?? false;
  const tenu = (camp: Rvb01 | null): Montre => (terrain ? { camp: null, mat: 'aucun', nuit: false } : { camp, mat: camp ? 'drapeau' : 'nu', nuit: false });
  if (base?.cadre) {
    pions.push({ x: 0, y: 0, batiment: { cadre: base.cadre, montre: tenu(campRvb(0)) } });
    pions.push({ x: 2, y: 0, batiment: { cadre: base.cadre, montre: tenu(null) } });
    pions.push({ x: 4, y: 1, batiment: { cadre: base.cadre, montre: tenu(campRvb(1)) } });
    pions.push({ x: 1, y: 2, batiment: { cadre: base.cadre, montre: tenu(campRvb(2)) } });
  }
  if (desaffecte?.cadre) pions.push({ x: 3, y: 2, batiment: { cadre: desaffecte.cadre, montre: { camp: null, mat: 'aucun', nuit: false } } });
  if (infanterie) {
    pions.push({ x: 2, y: 0, unite: { u: infanterie, camp: 1, miroir: true } });
    pions.push({ x: 1, y: 0, unite: { u: infanterie, camp: 0, miroir: false } });
  }
  if (charLeger) pions.push({ x: 3, y: 1, unite: { u: charLeger, camp: 1, miroir: true } });
  if (charMoyen) pions.push({ x: 0, y: 1, unite: { u: charMoyen, camp: 0, miroir: false } });
  if (infanterie) pions.push({ x: 4, y: 2, unite: { u: infanterie, camp: 3, miroir: true } });
  // Rangée du haut d'abord, le bâtiment avant l'unité qui s'y tient : l'ordre du lot.
  pions.sort((a, b) => a.y - b.y || a.x - b.x || (a.batiment ? 0 : 1) - (b.batiment ? 0 : 1));
  for (const p of pions) {
    const cx = Math.round((p.x + 0.5) * case48.l);
    const cy = Math.round(oy + (p.y + 0.5) * case48.h);
    if (p.batiment) poserBatiment(pf, p.batiment.cadre, cx, cy, k48, p.batiment.montre, sol, grille, nuit, { x0: 0, y0: 0, x1: 0, y1: 0 });
    if (p.unite) poserUnite(pf, p.unite.u, cx, cy, campRvb(p.unite.camp), k48, p.unite.miroir);
  }
  etiquettes.push({ x: 12, y: hautD - 10, texte: `plateau à 48 px (unités installées pour l'échelle), vraie taille puis agrandi ×${zoom}`, taille: 15, gras: true });
  for (let y = 0; y < pf.h; y++) {
    for (let x = 0; x < pf.l; x++) {
      const tx = gauche + plateauL * zoom + 40 + x;
      const ty = hautD + y;
      if (tx < fond.l && ty < fond.h) fond.rvb.set(pf.rvb.subarray((y * pf.l + x) * 3, (y * pf.l + x) * 3 + 3), (ty * fond.l + tx) * 3);
    }
  }
  agrandir(pf, 0, 0, pf.l, pf.h, zoom, fond, gauche, hautD);

  // E. Les règles qui échouent, entrée par entrée.
  let ye = hautE;
  for (const x of echecs) {
    etiquettes.push({ x: 12, y: ye, texte: `${x.id} : ${x.liste.length ? `${x.liste.length} échec(s)` : 'toutes les règles passent'}`, taille: 14, gras: true,
      couleur: x.liste.length ? '#b01818' : '#15181d' });
    ye += 20;
    for (const r of x.liste) {
      etiquettes.push({ x: 30, y: ye, texte: `${r.id} : ${String(r.valeur)} (attendu ${r.attendu})`, taille: 13, couleur: '#b01818' });
      ye += 20;
    }
  }
  await ecrire(fond, etiquettes, chemin);
}

/** L'ordre des rangées : la base, les variantes, puis les états. */
function rang(e: EtatPlanche): number {
  if (e.etat === 'base' && e.variante === 'base') return 0;
  if (e.etat === 'base') return 1;
  return 2;
}

/** La planche des clips d'une entrée : chaque clip de la vue fixe (et de travers pour le pont), image par image, en bleu, de jour. */
export async function ecrirePlancheClipsBatiment(s: { id: string; cuisson: Cuisson; charte: Charte }, chemin: string): Promise<void> {
  const lignes = s.cuisson.entree.animations.map((a) => ({ titre: `${a.vue} · ${a.clip} (${a.cadres.length} images, ${a.ips} i/s${a.boucle ? ', boucle' : ''})`, vue: a.vue, clip: a.clip }));
  const cel = { l: 180, h: 220, px: 90, py: 150 };
  const max = Math.max(1, ...lignes.map((l) => s.cuisson.cadres(l.vue, l.clip).length));
  const fond = fondUni(40 + max * cel.l, 20 + lignes.length * (cel.h + 24), rvb01(s.charte.planche.herbe));
  const etiquettes: Etiquette[] = [];
  const bleu = rvb01(s.charte.planche.camps[0]!.hex);
  const sol = solBatiment();
  const grille = rvb01(s.charte.planche.grille);
  const nuit = ambianceNuit();
  const neutre = s.id.endsWith('_desaffecte');
  lignes.forEach((l, i) => {
    const y0 = 20 + i * (cel.h + 24);
    etiquettes.push({ x: 12, y: y0 + 14, texte: l.titre, taille: 14, gras: true });
    s.cuisson.cadres(l.vue, l.clip).forEach((c, k) => {
      const x = 40 + k * cel.l + cel.px;
      const y = y0 + 24 + cel.py;
      poserBatiment(fond, c, x, y, 1, { camp: neutre ? null : bleu, mat: 'aucun', nuit: false }, sol, grille, nuit, { x0: 0, y0: 0, x1: 0, y1: 0 });
    });
  });
  await ecrire(fond, etiquettes, chemin);
}
