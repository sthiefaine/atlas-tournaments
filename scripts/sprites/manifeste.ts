/**
 * Le manifeste : l'assemblage des fichiers d'entrée que la cuisson laisse à
 * côté de leurs pages, et sa vérification.
 *
 * Chaque entrée cuite écrit `<famille>/<id>.json` : l'`EntreeSprite` du
 * contrat, plus ce que la cuisson sait d'elle (empreinte, durée, poids). Le
 * manifeste se **régénère** à partir de ces fichiers à chaque cuisson : cuire
 * une entrée seule ne perd pas les autres, et un manifeste ne dit jamais
 * autre chose que ce qui est sur le disque.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ETATS_BATIMENT } from '../../src/assets/spec';
import {
  CLIPS, FAMILLES_SPRITE, PIXELS_PAR_CASE, TANGAGE_CARTE, TANGAGE_PROFIL, VERSION_SPRITES, VUES,
  type EntreeSprite, type ManifesteSprites,
} from '../../src/render2d/contrat';

import { DOSSIER_FAMILLE, PREFIXE_PAGES } from './reglages';

/** Ce que la cuisson sait d'une entrée, à côté de ce que le rendu en lit. */
export interface MetaCuisson {
  version: number;
  /** L'empreinte de tout ce qui a fait l'image : sources, textures, réglages, plan. */
  empreinte: string;
  date: string;
  secondes: number;
  secondesRendu: number;
  images: number;
  imagesUniques: number;
  octets: number;
  /** Les canevas par vue, en pixels de plan relatifs au pivot : `x0`, `y0`, largeur, hauteur. */
  canevas: Record<string, { x0: number; y0: number; largeur: number; hauteur: number }>;
  materiauxTeints: string[];
  avertissements: string[];
}

export interface FichierEntree {
  entree: EntreeSprite;
  cuisson: MetaCuisson;
}

/** Le fichier d'entrée d'un identifiant, sous une racine de sortie. */
export function cheminEntree(racine: string, famille: EntreeSprite['famille'], id: string): string {
  return join(racine, DOSSIER_FAMILLE[famille], `${id}.json`);
}

/** Le chemin disque d'une page du manifeste : `assets/sprites/…` se lit sous la racine de sortie. */
export function cheminPage(racine: string, page: string): string {
  const prefixe = `${PREFIXE_PAGES}/`;
  if (!page.startsWith(prefixe)) throw new Error(`page hors de ${prefixe} : ${page}`);
  return join(racine, page.slice(prefixe.length));
}

/**
 * La page de couverture d'une page de couleur (`cuire.ts --couverture`) : à
 * côté d'elle, en PNG, **hors du manifeste** — le rendu ne la lit jamais ; les
 * mesures des figurines y séparent le modèle de son contour et de son ombre.
 */
export function cheminCouverture(couleur: string): string {
  return couleur.replace(/\.webp$/, '_couverture.png');
}

/** Tous les fichiers d'entrée d'une racine de sortie, triés par identifiant. */
export function lireEntrees(racine: string): FichierEntree[] {
  const fichiers: FichierEntree[] = [];
  for (const famille of FAMILLES_SPRITE) {
    const dossier = join(racine, DOSSIER_FAMILLE[famille]);
    if (!existsSync(dossier)) continue;
    for (const nom of readdirSync(dossier).sort()) {
      if (!nom.endsWith('.json')) continue;
      fichiers.push(JSON.parse(readFileSync(join(dossier, nom), 'utf8')) as FichierEntree);
    }
  }
  return fichiers.sort((a, b) => (a.entree.id < b.entree.id ? -1 : a.entree.id > b.entree.id ? 1 : 0));
}

/** Le manifeste de ce qui est sur le disque. */
export function composerManifeste(fichiers: readonly FichierEntree[]): ManifesteSprites {
  const entrees: Record<string, EntreeSprite> = {};
  for (const f of fichiers) entrees[f.entree.id] = f.entree;
  return {
    version: VERSION_SPRITES,
    pixelsParCase: PIXELS_PAR_CASE,
    tangage: TANGAGE_CARTE,
    tangageProfil: TANGAGE_PROFIL,
    entrees,
  };
}

/** Régénère `manifeste.json` sous une racine de sortie et le rend. */
export function ecrireManifeste(racine: string): ManifesteSprites {
  const manifeste = composerManifeste(lireEntrees(racine));
  writeFileSync(join(racine, 'manifeste.json'), `${JSON.stringify(manifeste)}\n`);
  return manifeste;
}

/**
 * Ce qui ne va pas dans un manifeste, sans lire les images : forme, version,
 * rectangles dans leurs pages, pivots plausibles, chemins. Une liste vide dit
 * qu'il est bon. `tailles` dit, pour une page, ses dimensions réelles sur le
 * disque — les tests la fournissent, la cuisson aussi.
 */
export function problemesManifeste(
  m: ManifesteSprites,
  tailles?: (page: string) => { largeur: number; hauteur: number } | null,
): string[] {
  const p: string[] = [];
  if (m.version !== VERSION_SPRITES) p.push(`version ${String(m.version)} au lieu de ${VERSION_SPRITES}`);
  if (m.pixelsParCase !== PIXELS_PAR_CASE) p.push(`pixelsParCase ${m.pixelsParCase}`);
  if (m.tangage !== TANGAGE_CARTE || m.tangageProfil !== TANGAGE_PROFIL) p.push('tangages différents du contrat');
  for (const [cle, e] of Object.entries(m.entrees)) {
    const ou = `entrée ${cle}`;
    if (e.id !== cle) p.push(`${ou} : id ${e.id}`);
    if (!(FAMILLES_SPRITE as readonly string[]).includes(e.famille)) p.push(`${ou} : famille ${e.famille}`);
    // Le rendu écarte une entrée d'état qu'il ne connaît pas : la cuisson le dit avant lui.
    if (e.etat !== undefined && (e.famille !== 'batiment' || !(ETATS_BATIMENT as readonly string[]).includes(e.etat))) {
      p.push(`${ou} : état ${String(e.etat)} hors des états de bâtiment`);
    }
    if (!/^[0-9a-f]{64}$/.test(e.source?.sha256 ?? '')) p.push(`${ou} : empreinte de source invalide`);
    if (e.pages.length === 0) p.push(`${ou} : aucune page`);
    if (e.animations.length === 0) p.push(`${ou} : aucune animation`);
    e.pages.forEach((page, i) => {
      for (const chemin of [page.couleur, page.masque, page.emission]) {
        if (chemin !== undefined && (chemin.startsWith('/') || !chemin.startsWith(`${PREFIXE_PAGES}/`))) {
          p.push(`${ou} : chemin de page ${chemin}`);
        }
      }
      if (!(page.largeur > 0 && page.hauteur > 0 && page.largeur <= 2048 && page.hauteur <= 2048)) {
        p.push(`${ou} : page ${i} de ${page.largeur}×${page.hauteur}`);
      }
      if (tailles) {
        for (const chemin of [page.couleur, page.masque, page.emission]) {
          if (chemin === undefined) continue;
          const t = tailles(chemin);
          if (!t) p.push(`${ou} : fichier absent ${chemin}`);
          else if (t.largeur !== page.largeur || t.hauteur !== page.hauteur) {
            p.push(`${ou} : ${chemin} fait ${t.largeur}×${t.hauteur}, le manifeste dit ${page.largeur}×${page.hauteur}`);
          }
        }
      }
    });
    const vues = new Set<string>();
    for (const a of e.animations) {
      const cleAnim = `${a.vue}/${a.clip}`;
      if (vues.has(cleAnim)) p.push(`${ou} : animation ${cleAnim} en double`);
      vues.add(cleAnim);
      if (!(VUES as readonly string[]).includes(a.vue)) p.push(`${ou} : vue ${a.vue}`);
      if (!(CLIPS as readonly string[]).includes(a.clip)) p.push(`${ou} : clip ${a.clip}`);
      if (!(a.ips > 0)) p.push(`${ou} : ${cleAnim} à ${a.ips} images par seconde`);
      if (a.cadres.length === 0) p.push(`${ou} : ${cleAnim} sans image`);
      a.cadres.forEach((c, i) => {
        const page = e.pages[c.page];
        if (!page) {
          p.push(`${ou} : ${cleAnim}[${i}] sur une page ${c.page} absente`);
          return;
        }
        const entiers = [c.x, c.y, c.l, c.h].every((v) => Number.isInteger(v));
        if (!entiers || c.x < 0 || c.y < 0 || c.l <= 0 || c.h <= 0 || c.x + c.l > page.largeur || c.y + c.h > page.hauteur) {
          p.push(`${ou} : ${cleAnim}[${i}] hors de sa page (${c.x},${c.y},${c.l}×${c.h} dans ${page.largeur}×${page.hauteur})`);
        }
        // Le pivot est l'origine du modèle : il peut sortir de l'image rognée
        // (un appareil en vol est au-dessus de lui), jamais de beaucoup plus
        // qu'une case et demie de hauteur.
        const limite = 3 * PIXELS_PAR_CASE;
        if (!Number.isFinite(c.px) || !Number.isFinite(c.py) || Math.abs(c.px - c.l / 2) > limite || Math.abs(c.py - c.h / 2) > limite) {
          p.push(`${ou} : ${cleAnim}[${i}] pivot (${c.px}, ${c.py}) invraisemblable pour ${c.l}×${c.h}`);
        }
      });
    }
  }
  return p;
}
