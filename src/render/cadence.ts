/** Préférence de présentation : ne change jamais les règles ni le rejeu. */
export const VITESSES_ANIMATIONS = ['normale', 'rapide', 'instantanee'] as const;
export type VitesseAnimations = typeof VITESSES_ANIMATIONS[number];

export function normaliserVitesse(brut: unknown): VitesseAnimations {
  return brut === 'rapide' || brut === 'instantanee' ? brut : 'normale';
}

export function facteurDuree(vitesse: unknown, reduit = false): number {
  if (reduit || vitesse === 'instantanee') return 0;
  return vitesse === 'rapide' ? 0.5 : 1;
}
