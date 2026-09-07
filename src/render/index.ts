/**
 * # Rendu canvas d'Atlas Tournament — API publique
 *
 * Le rendu est une **peau** au-dessus du moteur : il consomme un `EtatPartie` et
 * une file d'`EvenementJeu`, il n'a aucune autorité (`02-architecture.md` §3.4).
 * C'est le seul dossier du dépôt qui touche au DOM.
 *
 * ```ts
 * const jeu = monterJeu(canvas, { scenario, carte, graine, locale, adversaire: 'ponderee' });
 * // …
 * jeu.demonter();
 * ```
 *
 * Les quatre briques que le « from scratch » nous fait écrire (`§2`) :
 * `boucle.ts` (rAF paresseux), `hidpi.ts` (`ResizeObserver` et ratio de pixels),
 * `entrees.ts` (souris, tactile, clavier), `sprites/cache.ts` (canvas hors écran).
 */

export {
  ambiance, ambianceDe, alpha, ecrireCouleur, lireCouleur, melanger, teinter,
  TYPES_PARTICULE,
  type Ambiance, type PaletteTerrain, type Particules, type Rvb, type TypeParticule,
  type Voile,
} from './ambiance';

export {
  animation, Boucle, horlogeNavigateur, type Animation, type Horloge, type Peintre,
} from './boucle';

export {
  brancherEntrees, toucheDe, type Gestes, type OptionsEntrees, type PointEcran,
  type ToucheJeu,
} from './entrees';

export {
  GENRES_SURBRILLANCE, type GenreSurbrillance, type Surbrillance,
} from './surbrillance';

export {
  libelleMeteo, libellePhase, libelleSaison, nomCommandant, nomCourtUnite, nomTerrain,
  nomUnite, type OptionMenu, type Traduire,
} from './libelles';

export { dessinerUnite, type Pinceau } from './sprites/index';

export { NATIONS, nationDe, PALETTES, paletteDe, paletteNation, type NomNation } from './palettes';

export {
  Controleur, SUITES_MENU, type EcouteurControleur, type IdSuite, type OptionsControleur,
  type Phase, type VueControleur,
} from './controleur';

export {
  webgl2Disponible,
  type CleRendu, type GestesRendu, type MesuresRendu, type PointVue, type Rendu, type VueInteraction,
} from './rendu';

export {
  decisionComposeur, IMAGES_CALIBRATION, msCalibration, normaliserQualite, QUALITE_PAR_DEFAUT,
  QUALITES_RENDU, SEUIL_MS_COMPOSEUR, type QualiteRendu,
} from './qualite';

export {
  monterHudHtml, type ApiHud, type HudHtml, type VueJeu,
} from './hud-html';

export {
  DUREES, dixiemes, dureePartition, ecrirePartition, MISE_EN_SCENE, partitionVide,
  type Geste, type GenreGeste, type OptionsPartition, type Partition,
} from './partition';

export {
  jaugePv, monterScenes, MS_FIXE, type ApiScenes, type ScenesHtml, type VueScenes,
} from './scenes-html';

export {
  filerRepliques, scenesDeclenchees, sceneOuverture,
  type ContexteScenes, type RepliqueEnAttente,
} from './dialogues';

export {
  monterDialogue, type ApiDialogue, type DialogueHtml,
} from './dialogue-html';

export { casesObjectifs, textesObjectifs } from './objectifs';

export { cheminEnL, longueurChemin, surChemin } from './chemin';

export {
  ADVERSAIRE_PASSIF, cleSauvegarde, commandantsDuScenario, effacerSauvegarde,
  ecrireSauvegarde, lireSauvegarde, monterJeu, PREFIXE_SAUVEGARDE,
  type Adversaire, type Jeu, type OptionsJeu, type PontDebug,
} from './jeu';
