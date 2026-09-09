/** Résolution commune au banc historique et aux candidats exposés. */
export const PREFIXE_MODELES = '/assets/modeles';
export function cheminInspection(prefixe: string | undefined, fichier: string, revision: string | null): string {
  const base = (prefixe ?? PREFIXE_MODELES).replace(/\/$/, '');
  return `${base}/${fichier}${revision ? `?v=${encodeURIComponent(revision)}` : ''}`;
}
