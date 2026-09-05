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
  monterSurface, ratioPixels, type OptionsSurface, type Redimension, type Surface,
} from './hidpi';

export {
  avancerInertie, casesVisibles, centrerSur, centreCase, couperInertie, creerCamera,
  ecranVersCase, ecranVersMonde, FROTTEMENT, glisser, lancerInertie, limiter,
  mondeVersEcran, PALIERS_ZOOM, palierZoom, redimensionner, TUILE, zoomerAutour,
  zoomerPalier, zoomMinimal, type Camera, type Point,
} from './camera';

export {
  brancherEntrees, toucheDe, type Gestes, type OptionsEntrees, type PointEcran,
  type ToucheJeu,
} from './entrees';

export { NATIONS, nationDe, PALETTES, paletteDe, paletteNation, type NomNation } from './palettes';

export * from './sprites/index';

export {
  carteDe, dessinerParticules, dessinerScene, type GenreSurbrillance,
  type PositionAnimee, type Surbrillance, type VueScene,
} from './scene';

export {
  ajuster, dansZone, dessinerHud, estBatiment, libelleMeteo, libellePhase, libelleSaison,
  mesurer, nomCommandant, nomCourtUnite, nomTerrain, nomUnite, PILES_POLICE, pilePolice,
  police, zoneSous, type OptionMenu, type VueHud, type ZoneHud,
} from './hud';

export {
  Controleur, SUITES_MENU, type EcouteurControleur, type IdSuite, type OptionsControleur,
  type Phase, type VueControleur,
} from './controleur';

export {
  choisirRendu, preferenceDe, webgl2Disponible,
  type CleRendu, type GestesRendu, type PointVue, type PreferenceRendu, type Rendu,
  type VueInteraction,
} from './rendu';

export { creerRendu2d } from './rendu2d';

export {
  monterHudHtml, type ApiHud, type HudHtml, type VueJeu,
} from './hud-html';

export {
  ADVERSAIRE_PASSIF, cleSauvegarde, commandantsDuScenario, effacerSauvegarde,
  ecrireSauvegarde, lireSauvegarde, monterJeu, PREFIXE_SAUVEGARDE,
  type Adversaire, type Jeu, type OptionsJeu, type PontDebug,
} from './jeu';
