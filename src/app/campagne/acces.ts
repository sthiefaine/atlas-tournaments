/** Une victoire sur la vraie finale, explicitement en normal ; pas la fin du contenu provisoire. */
export const FINALE_CAMPAGNE = 'opus1_finale_18';
export function campagneTermineeEnNormal(brut: unknown): boolean {
  if (!brut || typeof brut !== 'object') return false;
  const p = brut as { victoires?: unknown; victoiresParMode?: { normal?: unknown } };
  return Array.isArray(p.victoires) && p.victoires.includes(FINALE_CAMPAGNE)
    && Array.isArray(p.victoiresParMode?.normal) && p.victoiresParMode.normal.includes(FINALE_CAMPAGNE);
}
