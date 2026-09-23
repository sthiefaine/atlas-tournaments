/**
 * La lecture d'une cuisson d'essai et des images d'identifiants : décoder les
 * pages (`sharp`) et découper chaque cadre. Les mesures, elles, sont pures
 * (`mesures.ts`).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import type { AnimationSprite, EntreeSprite, VueSprite } from '../../../src/render2d/contrat';
import { cheminCouverture, cheminEntree, cheminPage, type FichierEntree } from '../../sprites/manifeste';

import type { Cadre, ImageIds } from './mesures';

interface Page { largeur: number; hauteur: number; rgba: Uint8Array; masque: Uint8Array | null; couverture: Uint8Array | null }

async function gris(chemin: string): Promise<Uint8Array> {
  const { data } = await sharp(chemin).greyscale().raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

/** Une cuisson d'essai, décodée : l'entrée, et un lecteur de cadres. */
export interface Cuisson {
  entree: EntreeSprite;
  meta: FichierEntree['cuisson'];
  animation(vue: VueSprite, clip: string): AnimationSprite | undefined;
  cadres(vue: VueSprite, clip: string): Cadre[];
}

/** Lit l'entrée `id` d'une racine de cuisson (`--sortie`), pages de couverture comprises. */
export async function lireCuisson(racine: string, id: string): Promise<Cuisson> {
  const f = JSON.parse(readFileSync(cheminEntree(racine, 'unite', id), 'utf8')) as FichierEntree;
  const pages: Page[] = [];
  for (const p of f.entree.pages) {
    const { data, info } = await sharp(cheminPage(racine, p.couleur)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const couverture = cheminPage(racine, cheminCouverture(p.couleur));
    pages.push({
      largeur: info.width, hauteur: info.height, rgba: new Uint8Array(data),
      masque: p.masque ? await gris(cheminPage(racine, p.masque)) : null,
      couverture: existsSync(couverture) ? await gris(couverture) : null,
    });
  }
  const animation = (vue: VueSprite, clip: string) => f.entree.animations.find((a) => a.vue === vue && a.clip === clip);
  return {
    entree: f.entree,
    meta: f.cuisson,
    animation,
    cadres(vue, clip) {
      const a = animation(vue, clip);
      if (!a) return [];
      return a.cadres.map((c) => {
        const page = pages[c.page]!;
        const rgba = new Uint8Array(c.l * c.h * 4);
        const masque = page.masque ? new Uint8Array(c.l * c.h) : null;
        const couverture = page.couverture ? new Uint8Array(c.l * c.h) : null;
        for (let y = 0; y < c.h; y++) {
          const s = (c.y + y) * page.largeur + c.x;
          rgba.set(page.rgba.subarray(s * 4, (s + c.l) * 4), y * c.l * 4);
          if (masque) masque.set(page.masque!.subarray(s, s + c.l), y * c.l);
          if (couverture) couverture.set(page.couverture!.subarray(s, s + c.l), y * c.l);
        }
        return { l: c.l, h: c.h, px: c.px, py: c.py, rgba, masque, couverture };
      });
    },
  };
}

/** Une image d'identifiants de `fabriquer.py`. */
export async function lireIds(dossier: string, fichier: string, canevas: { x0: number; y0: number }): Promise<ImageIds> {
  const { data, info } = await sharp(join(dossier, fichier)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { l: info.width, h: info.height, x0: canevas.x0, y0: canevas.y0, rgba: new Uint8Array(data) };
}
