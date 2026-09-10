/**
 * Source éditoriale publique des capacités : aucun lien familial ou historique
 * secret. Deux révisions cohabitent : la **3** (gelée dans
 * `commandants-capacites-v3.json`, servie aux scénarios qui la déclarent) et la
 * **4** (`commandants-capacites.json`, les 34 kits façon Advance Wars du
 * 10 septembre 2026, avec une faiblesse chiffrée et deux répliques).
 */
import catalogueJson from '../../content/commandants-capacites.json';
import catalogueV3Json from '../../content/commandants-capacites-v3.json';
import type { AxeFaiblesse, DureePouvoir, EffetModificateur, EffetPouvoir } from '../schemas/types';

export interface CapaciteCommandant {
  nom: string;
  description: string;
  barres: number;
  duree: DureePouvoir;
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
  /** Révision 4 : la faiblesse est un modificateur permanent, réellement défavorable. */
  faiblesse?: { axe: AxeFaiblesse; effet: EffetModificateur; description: string };
  /** Révision 4 : ce que dit le commandant au déclenchement. */
  replique?: { pouvoir: string; super: string };
  /**
   * La pièce de matériel sans dossier qui porte le super d'un commandant de la
   * faction (`doc/refonte/supers-vilains.md` §1, 10 septembre 2026) : un nom et
   * une silhouette dans le vocabulaire de `pieces.ts`. Annotation de scénario —
   * le moteur ne la lit pas, l'admin et le carnet peuvent la montrer.
   */
  piece?: { nom: string; silhouette: string };
}
/** Révisions servies par ce module ; toute autre est une capacité composée par le code. */
export type RevisionCapacites = 3 | 4;
export const VERSION_CAPACITES_COMMANDANTS: RevisionCapacites = 4;

const catalogues: Record<RevisionCapacites, ProfilCommandant[]> = {
  3: catalogueV3Json.commandants as ProfilCommandant[],
  4: catalogueJson.commandants as ProfilCommandant[],
};
const index: Record<RevisionCapacites, Map<string, ProfilCommandant>> = {
  3: new Map(catalogues[3].map((profil) => [profil.cle, profil])),
  4: new Map(catalogues[4].map((profil) => [profil.cle, profil])),
};

/** Copies : une inspection ou un réglage de simulation ne modifie jamais le canon importé. */
export function lireProfilCommandant(cle: string, revision: RevisionCapacites = VERSION_CAPACITES_COMMANDANTS): ProfilCommandant | null {
  const profil = index[revision].get(cle);
  return profil ? structuredClone(profil) : null;
}
export function listerProfilsCommandants(revision: RevisionCapacites = VERSION_CAPACITES_COMMANDANTS): ProfilCommandant[] {
  return structuredClone(catalogues[revision]);
}
