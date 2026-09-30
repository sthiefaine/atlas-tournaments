import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { cache } from 'react';

import { chargerPays, chargerTerrains, chargerUnites } from '@/content/index';
import { lireManifeste } from '@/render2d/atlas';
import type { EntreeSprite } from '@/render2d/contrat';

export type CategorieSprite = 'unites' | 'batiments' | 'decors' | 'terrains';

/** Seulement ce que la bibliothèque affiche ; les atlas restent dans la vitrine. */
export interface SpriteBibliotheque {
  id: string;
  nom: string;
  variante: string;
  categorie: CategorieSprite;
  groupe: string;
}

const CATEGORIES: Record<EntreeSprite['famille'], CategorieSprite> = {
  unite: 'unites', batiment: 'batiments', decor: 'decors', terrain: 'terrains',
};
const DECORS: Record<string, string> = {
  buisson: 'Buisson', conifere: 'Conifère', feuillu: 'Arbre feuillu', montagne: 'Montagne',
  montagne_aride: 'Montagne aride', montagne_volcan: 'Montagne volcanique', palmier: 'Palmier',
  roseau: 'Roseaux', rocher: 'Rocher', touffe: 'Touffe d’herbe', tropical: 'Arbre tropical',
};
const VARIANTES: Record<string, string> = {
  ete: 'Été', hiver: 'Hiver', automne: 'Automne', printemps: 'Printemps', toutes: 'Toutes saisons',
  archipel: 'Archipel', cotier: 'Côtier', desaffecte: 'Désaffecté', inerte: 'Inerte',
};
const lisible = (cle: string): string => cle.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

/** Le même manifeste que le jeu, sans lecture des anciens modèles ou registres 3D. */
export const chargerBibliothequeSprites = cache(async (): Promise<{
  sprites: SpriteBibliotheque[];
  erreur: string | null;
  ecartees: number;
}> => {
  let lecture: ReturnType<typeof lireManifeste>;
  try {
    const texte = await readFile(path.resolve('public/assets/sprites/manifeste.json'), 'utf8');
    lecture = lireManifeste(JSON.parse(texte));
  } catch {
    return { sprites: [], erreur: 'La bibliothèque de sprites est indisponible sur ce serveur.', ecartees: 0 };
  }
  if (!lecture.ok) return { sprites: [], erreur: 'Le manifeste des sprites ne peut pas être lu par le jeu.', ecartees: 0 };

  const unites = new Map<string, ReturnType<typeof chargerUnites>[number]>(chargerUnites().map(u => [u.cle, u]));
  const terrains = new Map<string, string>(chargerTerrains().map(t => [t.cle, t.nom]));
  const pays = new Map<string, string>(chargerPays().map(p => [p.code, p.nomCourt]));
  const sprites = Object.values(lecture.manifeste.entrees).map((e): SpriteBibliotheque => {
    const unite = e.famille === 'unite' ? unites.get(e.cle) : undefined;
    const nom = unite?.nom ?? (e.famille === 'decor' ? DECORS[e.cle] : terrains.get(e.cle)) ?? lisible(e.cle);
    const variation = e.variante ? pays.get(e.variante) ?? VARIANTES[e.variante] ?? lisible(e.variante) : '';
    const numero = e.famille === 'decor' ? /_(\d+)$/.exec(e.id)?.[1] : undefined;
    return {
      id: e.id, nom, categorie: CATEGORIES[e.famille],
      variante: [variation, e.etat ? VARIANTES[e.etat] ?? lisible(e.etat) : '', numero ? `Variante ${numero}` : ''].filter(Boolean).join(' · '),
      groupe: unite?.domaine === 'air' ? 'aeriennes' : unite?.domaine === 'mer' ? 'navales'
        : unite?.typeMouvement === 'pied' ? 'infanterie' : unite ? 'mobiles' : '',
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.variante.localeCompare(b.variante, 'fr') || a.id.localeCompare(b.id));
  return { sprites, erreur: null, ecartees: lecture.ecartees.length };
});
