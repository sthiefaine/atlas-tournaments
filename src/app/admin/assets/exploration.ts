import type { AssetSpec } from '@/assets/index';
import { LIBELLES_TYPE } from './tri';

/** Une unité et ses peintures partagent une famille, jamais une géométrie par pays. */
export function familleAsset(spec: AssetSpec): string {
  if (spec.type === 'unite') return `unite_${spec.cle.replace(/_base$/, '')}`;
  if (spec.type === 'kit') return `unite_${spec.cle.split('_').slice(1).join('_')}`;
  if (spec.type === 'batiment') return `batiment_${spec.cle.split('_')[0]}`;
  if (spec.type === 'decor') return `decor_${spec.cle.split('_').slice(0, 2).join('_')}`;
  return spec.id;
}
export function libelleAsset(cle: string): string {
  return cle.replace(/^(unite|terrain|batiment|decor|commandant)_/, '').replace(/_/g, ' ');
}
export function regrouperAssets(specs: readonly AssetSpec[]): { cle: string; libelle: string; specs: AssetSpec[] }[] {
  const groupes = new Map<string, AssetSpec[]>();
  for (const spec of specs) {
    const cle = familleAsset(spec);
    const groupe = groupes.get(cle) ?? [];
    groupe.push(spec); groupes.set(cle, groupe);
  }
  return [...groupes].map(([cle, specs]) => ({ cle, libelle: libelleAsset(cle), specs }));
}
export function correspondRecherche(spec: AssetSpec, recherche: string, territoire = ''): boolean {
  const normaliser = (texte: string) => texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/_/g, ' ');
  const index = normaliser(`${spec.id} ${spec.description.fr} ${LIBELLES_TYPE[spec.type]} ${territoire}`);
  return normaliser(recherche).split(/\s+/).every(mot => index.includes(mot));
}
export function paginer<T>(elements: readonly T[], valeur: unknown, taille = 36) {
  const total = Math.max(1, Math.ceil(elements.length / taille));
  const nombre = typeof valeur === 'string' && /^\d+$/.test(valeur) ? Number(valeur) : 1;
  const page = Math.min(total, Math.max(1, Number.isSafeInteger(nombre) ? nombre : 1));
  return { page, total, elements: elements.slice((page - 1) * taille, page * taille) };
}
