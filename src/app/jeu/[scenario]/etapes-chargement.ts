import type { EtapeChargement } from '@/render/jeu';

/**
 * Les étapes du chargement d'une mission, et leur libellé.
 *
 * Elles vivent ici, seules, pour que le test les lise **là où l'écran les lit** :
 * une seconde liste recopiée dans un test finit toujours par diverger de celle
 * qui s'affiche, et le dépôt en garde quatre cicatrices (`CLAUDE.md`, « Quatre
 * copies de listes supprimées »).
 *
 * **Trois étapes depuis la bascule en 2D** (23 septembre 2026) : les modules
 * descendent, le plateau se monte, la première image se dessine. Il y en avait
 * quatre sous WebGPU, dont « le moteur démarre » — `renderer.init()`, un
 * adaptateur et un périphérique graphiques qu'on attendait des secondes. La
 * peau 2D ouvre son contexte WebGL 2 dans `monter()`, en quelques
 * millisecondes, et `Rendu.mesurer().backend` est là avant même que la page
 * ne le demande : l'étape n'aurait jamais paru qu'à l'état « faite », une case
 * cochée pour dire qu'on a attendu ce qu'on n'a pas attendu.
 *
 * La 3D temps réel est retirée depuis (même jour) : `Jeu.etatChargement` ne
 * connaît plus que `image` et `pret`, et chaque étape de la page est sa propre
 * case.
 *
 * Les deux premières étapes sont celles que seule la page peut connaître — ses
 * propres modules, son propre montage ; la dernière est celle que la peau dit
 * d'elle-même.
 */
export type EtapePage =
  /** Les modules du jeu descendent encore : rien de client n'a été évalué. */
  | 'modules'
  /** Le plateau se monte : la partie, la peau, le HUD. */
  | 'plateau'
  | EtapeChargement;

/** Les étapes que l'écran montre, une case chacune : toutes, sauf la fin. */
export type EtapeAffichee = Exclude<EtapePage, 'pret'>;

/** L'ordre des étapes : c'est lui qui dit ce qui est fait et ce qui reste. */
export const ETAPES_CHARGEMENT: readonly EtapeAffichee[] = ['modules', 'plateau', 'image'];

/** La clé de libellé d'une étape. Aucun texte en dur : tout passe par `t()`. */
export const CLE_ETAPE: Readonly<Record<EtapeAffichee, string>> = {
  modules: 'chargement.modules',
  plateau: 'chargement.plateau',
  image: 'chargement.image',
};

/** Le nom de la liste, pour les lecteurs d'écran. */
export const CLE_LISTE_ETAPES = 'chargement.etapes';
