/**
 * Les **libellés** du jeu : le nom d'une unité, d'un terrain, d'un commandant,
 * et les mots d'une saison, d'une météo, d'une heure.
 *
 * Ce module est tout ce qui reste du HUD dessiné au canvas, retiré avec le rendu
 * vectoriel. Il ne dessine plus rien : il ne fait que résoudre des clés, ce dont
 * le HUD HTML a besoin comme en avait besoin celui d'avant.
 *
 * La règle d'internationalisation ne change pas (`09-i18n.md` §7) : **aucun
 * texte en dur**. Tout passe par `t()`, y compris les noms d'unités et de
 * terrains, qui retombent sur le canon quand la clé n'est pas dans le bundle —
 * un nom approximatif vaut mieux qu'une case vide.
 */

import type { Catalogue } from '../engine/index';
import { resoudre } from '../i18n/index';
import type {
  CleTerrain, CleUnite, Meteo, PhaseJour, Saison, Trait, TypeMouvement,
} from '../schemas/types';

/** Un `t()` déjà lié à la langue. */
export type Traduire = (cle: string, params?: Record<string, string | number>) => string;

/** Une entrée du menu contextuel d'actions. */
export interface OptionMenu {
  id: string;
  /** Clé de chaîne, jamais un texte. */
  cle: string;
  disponible: boolean;
  /**
   * Pour un débarquement, l'unité de la cale que l'entrée pose : le HUD la
   * nomme dans le libellé (`{unite}`) et la dessine, et la renvoie avec le
   * choix. Absent pour tout autre ordre.
   */
  passager?: string;
}

/** Nom d'une unité : la clé i18n d'abord, le canon en dernier repli. */
export function nomUnite(locale: string, cat: Catalogue, cle: CleUnite): string {
  return resoudre(locale, `unite.${cle}.nom`) ?? cat.unites[cle]?.nom ?? '';
}

/** Nom court d'une unité, pour les étiquettes très contraintes. */
export function nomCourtUnite(locale: string, cat: Catalogue, cle: CleUnite): string {
  return resoudre(locale, `unite.${cle}.nom_court`) ?? cat.unites[cle]?.nomCourt ?? '';
}

/** Nom d'un terrain. */
export function nomTerrain(locale: string, cat: Catalogue, cle: CleTerrain): string {
  return resoudre(locale, `terrain.${cle}.nom`) ?? cat.terrains[cle]?.nom ?? '';
}

/** Nom d'un commandant, par sa clé. */
export function nomCommandant(locale: string, cle: string | null): string {
  if (!cle) return '';
  return resoudre(locale, `commandant.${cle}.nom`) ?? '';
}

/** Libellé d'une saison. */
export function libelleSaison(t: Traduire, s: Saison): string {
  return t(`saison.${s}`);
}

/** Libellé d'une météo. */
export function libelleMeteo(t: Traduire, m: Meteo): string {
  return t(`meteo.${m}`);
}

/** Libellé d'une phase du jour. */
export function libellePhase(t: Traduire, p: PhaseJour): string {
  return t(p === 'nuit' ? 'hud.nuit' : 'hud.jour');
}

/** Libellé d'un type de mouvement (à pied, chenilles, aérien…). */
export function libelleMouvement(t: Traduire, m: TypeMouvement): string {
  return t(`mouvement.${m}`);
}

/** Libellé d'un trait d'unité : la liste fermée de `04-gameplay.md` §13.2. */
export function libelleTrait(t: Traduire, tr: Trait): string {
  return t(`trait.${tr}`);
}
