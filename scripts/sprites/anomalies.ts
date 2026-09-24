/**
 * Les images cuites qui ont perdu des faces : dans une animation, une image
 * dont la silhouette opaque s'effondre, ou dont la part de masque d'équipe
 * chute, par rapport à la médiane de ses voisines.
 *
 * Pourquoi (24 septembre 2026) : une cuisson du drone intercepteur a rendu,
 * à partir de sa 22e image, le dessus d'équipe et des couvercles plats sans
 * couverture ni masque — une étoile noire en vues bas, haut et profil —, et
 * rien ne l'a vu avant qu'un agent regarde sa planche. Une animation garde sa
 * silhouette d'une image à l'autre (un recul, une secousse, un rotor la
 * déplacent peu) : une image qui en perd un cinquième, ou dont l'équipe perd
 * les deux cinquièmes, a été mal rendue.
 *
 * Les mesures sont celles du script de vérification du coordinateur : un
 * pixel est opaque si son alpha dépasse 128 ; la part de masque est la part
 * des pixels opaques dont le masque dépasse 127. Et parce qu'une cuisson qui
 * perd ses faces à la 22e image perd aussi toutes les animations qui suivent
 * — leur médiane tombe avec elles —, une animation entière se compare aux
 * autres : sa part de masque médiane ne tombe pas sous le quart de la plus
 * haute de l'entrée (mesuré sur les trente unités installées : jamais sous
 * 0,41 de la plus haute ; la cuisson fautive : 0,00 contre 0,45), et sa
 * clarté médiane — la luminance moyenne de ses pixels opaques, celle de PIL —
 * ne tombe pas sous 60 % de la médiane des animations de l'entrée : une
 * échelle quasi nulle, dans un seul clip, a rendu noire toute une vue de
 * profil, silhouette intacte (l'agent du chasseur, 24 septembre).
 */

import { readFileSync } from 'node:fs';

import sharp from 'sharp';

import type { EntreeSprite } from '../../src/render2d/contrat';

import { cheminEntree, cheminPage, type FichierEntree } from './manifeste';

/**
 * Les seuils : une image sous 80 % de la silhouette médiane de son animation,
 * ou sous 60 % de sa part de masque médiane quand elle dépasse 0,2 ; une
 * animation dont la part de masque médiane tombe sous le quart de la plus
 * haute de l'entrée, quand celle-ci dépasse 0,2 ; une animation dont la
 * clarté médiane tombe sous 60 % de la médiane des animations de l'entrée.
 */
export const SEUILS_ANOMALIE = { silhouette: 0.8, masque: 0.6, masqueMin: 0.2, animation: 0.25, clarte: 0.6 } as const;

/** Ce qu'une image d'une animation dit d'elle-même. */
export interface MesureImage {
  /** Pixels dont l'alpha dépasse 128. */
  opaques: number;
  /** Part des pixels opaques dont le masque dépasse 127. */
  partMasque: number;
  /** La luminance moyenne des pixels opaques, 0 à 255 (celle de PIL : 0,299 R + 0,587 G + 0,114 B). */
  clarte: number;
}

export interface Anomalie {
  vue: string;
  clip: string;
  /** L'image, ou null quand c'est l'animation entière qui tombe. */
  image: number | null;
  motif: 'silhouette' | 'masque' | 'animation' | 'clarte';
  opaques: number;
  medianeOpaques: number;
  partMasque: number;
  medianeMasque: number;
  /** Pour une anomalie de clarté : la clarté médiane de l'animation, et celle de l'entrée. */
  clarte?: number;
  medianeClarte?: number;
}

/** La médiane, comme `statistics.median` : la moyenne des deux du milieu pour un compte pair. */
export function mediane(valeurs: readonly number[]): number {
  if (!valeurs.length) return 0;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

/**
 * Une image, découpée dans sa page : `rvba(i)` rend le décalage du pixel `i`
 * du cadre dans `page` (RVBA, 0 à 255), `masque(i)` sa valeur de masque.
 */
export function mesurerImage(pixels: number, page: Uint8Array, rvba: (i: number) => number, masque: ((i: number) => number) | null): MesureImage {
  let opaques = 0;
  let equipe = 0;
  let clarte = 0;
  for (let i = 0; i < pixels; i++) {
    const o = rvba(i);
    if (page[o + 3]! <= 128) continue;
    opaques++;
    // La luminance de PIL (`convert('L')`), au même arrondi.
    clarte += (page[o]! * 19595 + page[o + 1]! * 38470 + page[o + 2]! * 7471 + 0x8000) >> 16;
    if (masque && masque(i) > 127) equipe++;
  }
  return { opaques, partMasque: equipe / Math.max(1, opaques), clarte: opaques ? clarte / opaques : 0 };
}

/** Les images d'une animation qui s'écartent de sa médiane (voir `SEUILS_ANOMALIE`). */
export function anomaliesAnimation(vue: string, clip: string, mesures: readonly MesureImage[]): Anomalie[] {
  const medO = mediane(mesures.map((m) => m.opaques));
  const medM = mediane(mesures.map((m) => m.partMasque));
  const sortie: Anomalie[] = [];
  mesures.forEach((m, image) => {
    const base = { vue, clip, image, opaques: m.opaques, medianeOpaques: medO, partMasque: m.partMasque, medianeMasque: medM };
    if (m.opaques < SEUILS_ANOMALIE.silhouette * medO) sortie.push({ ...base, motif: 'silhouette' });
    else if (medM > SEUILS_ANOMALIE.masqueMin && m.partMasque < SEUILS_ANOMALIE.masque * medM) sortie.push({ ...base, motif: 'masque' });
  });
  return sortie;
}

/** Les animations d'une entrée dont la part de masque médiane s'effondre devant la plus haute (voir `SEUILS_ANOMALIE`). */
export function anomaliesEntreAnimations(animations: readonly { vue: string; clip: string; mesures: readonly MesureImage[] }[]): Anomalie[] {
  const medianes = animations.map((a) => mediane(a.mesures.map((m) => m.partMasque)));
  const haute = Math.max(0, ...medianes);
  if (haute <= SEUILS_ANOMALIE.masqueMin) return [];
  return animations.flatMap((a, i) => (medianes[i]! < SEUILS_ANOMALIE.animation * haute
    ? [{ vue: a.vue, clip: a.clip, image: null, motif: 'animation' as const, opaques: mediane(a.mesures.map((m) => m.opaques)),
      medianeOpaques: mediane(a.mesures.map((m) => m.opaques)), partMasque: medianes[i]!, medianeMasque: haute }]
    : []));
}

/** Les animations d'une entrée dont la clarté médiane tombe sous 60 % de la médiane des animations (voir `SEUILS_ANOMALIE`). */
export function anomaliesDeClarte(animations: readonly { vue: string; clip: string; mesures: readonly MesureImage[] }[]): Anomalie[] {
  const clartes = animations.map((a) => mediane(a.mesures.map((m) => m.clarte)));
  const reference = mediane(clartes);
  return animations.flatMap((a, i) => (clartes[i]! < SEUILS_ANOMALIE.clarte * reference
    ? [{ vue: a.vue, clip: a.clip, image: null, motif: 'clarte' as const, opaques: mediane(a.mesures.map((m) => m.opaques)),
      medianeOpaques: mediane(a.mesures.map((m) => m.opaques)), partMasque: mediane(a.mesures.map((m) => m.partMasque)),
      medianeMasque: mediane(a.mesures.map((m) => m.partMasque)), clarte: clartes[i]!, medianeClarte: reference }]
    : []));
}

/** Toutes les anomalies d'une entrée : image par image dans chaque animation, puis animation contre animation. */
export function anomaliesAnimations(animations: readonly { vue: string; clip: string; mesures: readonly MesureImage[] }[]): Anomalie[] {
  return [
    ...animations.flatMap((a) => anomaliesAnimation(a.vue, a.clip, a.mesures)),
    ...anomaliesEntreAnimations(animations),
    ...anomaliesDeClarte(animations),
  ];
}

/** Une anomalie en une ligne. */
export function decrireAnomalie(a: Anomalie): string {
  if (a.motif === 'animation') {
    return `${a.vue}/${a.clip}, toute l'animation : masque médian ${a.partMasque.toFixed(2)} pour ${a.medianeMasque.toFixed(2)} dans l'animation la plus équipée`;
  }
  if (a.motif === 'clarte') {
    return `${a.vue}/${a.clip}, toute l'animation : clarté médiane ${Math.round(a.clarte!)} pour une médiane de ${Math.round(a.medianeClarte!)} dans l'entrée`;
  }
  return `${a.vue}/${a.clip} image ${a.image} : ${a.motif === 'silhouette'
    ? `${a.opaques} pixels opaques pour une médiane de ${Math.round(a.medianeOpaques)}`
    : `masque ${a.partMasque.toFixed(2)} pour une médiane de ${a.medianeMasque.toFixed(2)}`}`;
}

/** Les mesures de chaque image d'une entrée cuite, animation par animation, lue sous `racine`. */
export async function mesuresEntree(racine: string, famille: EntreeSprite['famille'], id: string): Promise<{ vue: string; clip: string; mesures: MesureImage[] }[]> {
  const { entree } = JSON.parse(readFileSync(cheminEntree(racine, famille, id), 'utf8')) as FichierEntree;
  const pages = await Promise.all(entree.pages.map(async (p) => {
    const couleur = await sharp(cheminPage(racine, p.couleur)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const masque = p.masque ? new Uint8Array(await sharp(cheminPage(racine, p.masque)).greyscale().raw().toBuffer()) : null;
    return { largeur: couleur.info.width, rgba: new Uint8Array(couleur.data), masque };
  }));
  return entree.animations.map((a) => ({
    vue: a.vue,
    clip: a.clip,
    mesures: a.cadres.map((c) => {
      const page = pages[c.page]!;
      const indice = (i: number): number => (c.y + Math.floor(i / c.l)) * page.largeur + c.x + (i % c.l);
      return mesurerImage(c.l * c.h, page.rgba, (i) => indice(i) * 4, page.masque ? (i) => page.masque![indice(i)]! : null);
    }),
  }));
}

/** Les anomalies d'une entrée cuite, lue sous `racine` (le `--sortie` d'une cuisson, ou `public/assets/sprites`). */
export async function anomaliesEntree(racine: string, famille: EntreeSprite['famille'], id: string): Promise<Anomalie[]> {
  return anomaliesAnimations(await mesuresEntree(racine, famille, id));
}
