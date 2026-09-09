/** Source éditoriale publique des capacités : aucun lien familial ou historique secret. */
import catalogueJson from '../../content/commandants-capacites.json';
import type { EffetModificateur, EffetPouvoir } from '../schemas/types';

export interface CapaciteCommandant {
  nom: string;
  description: string;
  barres: number;
  duree: 'tour_complet';
  effets: EffetPouvoir[];
}
export interface ProfilCommandant {
  cle: string;
  nom: string;
  paysCode?: string;
  faction?: 'atl';
  organisation?: 'atlas';
  style: string;
  description: string;
  contreJeu: string;
  descriptionPassif: string;
  passif: EffetModificateur | null;
  pouvoir: CapaciteCommandant;
  superPouvoir: CapaciteCommandant;
}
export const VERSION_CAPACITES_COMMANDANTS = 3;
const profils = catalogueJson.commandants as ProfilCommandant[];
const index = new Map(profils.map(profil => [profil.cle, profil]));

/** Copies : une inspection ou un réglage de simulation ne modifie jamais le canon importé. */
export function lireProfilCommandant(cle: string): ProfilCommandant | null {
  const profil = index.get(cle);
  return profil ? structuredClone(profil) : null;
}
export function listerProfilsCommandants(): ProfilCommandant[] {
  return structuredClone(profils);
}
