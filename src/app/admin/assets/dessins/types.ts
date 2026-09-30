export type FamilleDessin = 'unite' | 'batiment' | 'decor' | 'terrain' | 'portrait';
export type DomaineDessin = 'terre' | 'air' | 'mer';

/** Métadonnées utiles à la galerie ; aucun chemin de fichier n'est exposé. */
export interface DessinReference {
  id: string;
  cle: string;
  nom: string;
  famille: FamilleDessin;
  domaine: DomaineDessin | null;
  /** Catégorie du plan, ou catégorie déduite pour les anciennes références. */
  groupe: string;
  biome: string | null;
  statut: string;
  disponible: boolean;
  revision: string;
}

export interface CollectionDessins {
  dessins: DessinReference[];
  erreur: string | null;
  ecartees: number;
}
