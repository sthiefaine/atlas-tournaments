/** Lecture tactique : les catégories viennent des traits, jamais de la nation. */
import type { UnitType } from '../schemas/types';

export function symboleRole(type: Pick<UnitType, 'traits'>): string {
  const t = type.traits;
  if (t.includes('ravitaillement')) return '+';
  if (t.includes('brouilleur')) return '≈';
  if (t.includes('anti_air')) return '⊕';
  if (t.includes('tir_indirect')) return '⌒';
  if (t.includes('capture')) return '⚑';
  if (t.includes('drone')) return '◇';
  if (t.includes('vol')) return '↑';
  if (t.includes('transport')) return '▱';
  return '■';
}

/** Les bâtiments et leurs pavillons restent en place pour lire les objectifs. */
export function decorSecondaire(nom: string): boolean {
  return ['paysage', 'troncs', 'coniferes', 'feuillus', 'palmes'].includes(nom)
    || nom.startsWith('rochers-');
}

interface ObjetDecor { name: string; visible: boolean }
/** Restaure la visibilité précédente, sans rallumer une couche cachée par ailleurs. */
export function reglerDecorTactique(
  objets: readonly ObjetDecor[], actif: boolean, avant: WeakMap<ObjetDecor, boolean>,
): void {
  for (const objet of objets) {
    if (!decorSecondaire(objet.name)) continue;
    if (actif) {
      if (!avant.has(objet)) avant.set(objet, objet.visible);
      objet.visible = false;
    } else if (avant.has(objet)) {
      objet.visible = avant.get(objet)!;
      avant.delete(objet);
    }
  }
}
