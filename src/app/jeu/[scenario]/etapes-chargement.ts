import type { EtapeChargement } from '@/render/jeu';

/**
 * Les étapes du chargement d'une mission, et leur libellé.
 *
 * Elles vivent ici, seules, pour que le test les lise **là où l'écran les lit** :
 * une seconde liste recopiée dans un test finit toujours par diverger de celle
 * qui s'affiche, et le dépôt en garde quatre cicatrices (`CLAUDE.md`, « Quatre
 * copies de listes supprimées »).
 *
 * Les trois dernières sont celles que la peau dit d'elle-même
 * (`Jeu.etatChargement`) ; les deux premières sont celles que seule la page peut
 * connaître — ses propres modules, et son propre montage.
 */
export type EtapePage =
  /** Les modules du jeu descendent encore : rien de client n'a été évalué. */
  | 'modules'
  /** Le plateau se bâtit : géométries, textures, décor, unités. */
  | 'plateau'
  | EtapeChargement;

/** L'ordre des étapes : c'est lui qui dit ce qui est fait et ce qui reste. */
export const ETAPES_CHARGEMENT: readonly Exclude<EtapePage, 'pret'>[] = [
  'modules', 'plateau', 'moteur', 'image',
];

/** La clé de libellé d'une étape. Aucun texte en dur : tout passe par `t()`. */
export const CLE_ETAPE: Readonly<Record<Exclude<EtapePage, 'pret'>, string>> = {
  modules: 'chargement.modules',
  plateau: 'chargement.plateau',
  moteur: 'chargement.moteur',
  image: 'chargement.image',
};

/** Le nom de la liste, pour les lecteurs d'écran. */
export const CLE_LISTE_ETAPES = 'chargement.etapes';
