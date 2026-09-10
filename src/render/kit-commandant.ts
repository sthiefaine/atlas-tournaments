/**
 * Le **kit** d'un commandant, lu sur un profil du catalogue tactique
 * (`content/commandants-capacites.json`) sans dépendre de sa révision.
 *
 * Trois écrans lisent ce fichier — l'admin, le carnet de campagne, le briefing
 * d'un banc prêté — et le catalogue change de forme d'une révision à l'autre :
 * la révision 4 (10 septembre 2026) ajoute une faiblesse chiffrée et deux
 * répliques, que les révisions 1 à 3 n'ont pas. Un profil sans ces champs n'est
 * pas une erreur, c'est un kit d'avant : ces lectures rendent `null` plutôt que
 * de planter la page. Pur : aucun `t()`, aucun chargement — l'appelant passe le
 * profil qu'il a déjà lu.
 */

import type { AxeFaiblesse, EffetModificateur, EffetPouvoir } from '../schemas/types';
import { AXES_FAIBLESSE } from '../schemas/types';

/** La faiblesse d'un kit, telle qu'un écran la montre. */
export interface FaiblesseKit {
  axe: AxeFaiblesse;
  effet: EffetModificateur;
  description: string;
}

/** Les deux répliques d'un kit : au pouvoir, au super pouvoir. */
export interface RepliquesKit {
  pouvoir: string;
  super: string;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Vrai si la valeur a la forme d'un `EffetModificateur` : une cible, un `modificateur { quoi, valeur }`. */
function estEffetModificateur(v: unknown): v is EffetModificateur {
  if (!estObjet(v) || typeof v['cible'] !== 'string' || !estObjet(v['modificateur'])) return false;
  const m = v['modificateur'];
  return typeof m['quoi'] === 'string' && typeof m['valeur'] === 'number';
}

/**
 * La faiblesse d'un profil, ou `null` s'il n'en déclare pas (révisions 1 à 3),
 * ou si ce qu'il déclare n'a pas la forme attendue : l'écran préfère taire une
 * faiblesse que d'en inventer une.
 */
export function faiblesseDuProfil(profil: unknown): FaiblesseKit | null {
  if (!estObjet(profil) || !estObjet(profil['faiblesse'])) return null;
  const f = profil['faiblesse'];
  const axe = f['axe'];
  if (typeof axe !== 'string' || !(AXES_FAIBLESSE as readonly string[]).includes(axe)) return null;
  if (!estEffetModificateur(f['effet']) || typeof f['description'] !== 'string') return null;
  return { axe: axe as AxeFaiblesse, effet: f['effet'], description: f['description'] };
}

/** Les répliques d'un profil, ou `null` s'il n'en porte pas ou pas les deux. */
export function repliquesDuProfil(profil: unknown): RepliquesKit | null {
  if (!estObjet(profil) || !estObjet(profil['replique'])) return null;
  const r = profil['replique'];
  if (typeof r['pouvoir'] !== 'string' || typeof r['super'] !== 'string') return null;
  return { pouvoir: r['pouvoir'], super: r['super'] };
}

/** Les effets d'une capacité d'un profil, ou une liste vide si la forme n'y est pas. */
export function effetsDeCapacite(capacite: unknown): EffetPouvoir[] {
  if (!estObjet(capacite) || !Array.isArray(capacite['effets'])) return [];
  return capacite['effets'].filter(estObjet) as unknown as EffetPouvoir[];
}
