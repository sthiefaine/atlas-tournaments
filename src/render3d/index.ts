/**
 * # Rendu 3D d'Atlas Tournament — API publique
 *
 * `creerRendu3d()` rend un `Rendu` (`render/rendu.ts`), exactement le même
 * contrat que le rendu vectoriel : le contrôleur, le HUD et `monterJeu()` ne
 * savent pas lequel des deux ils pilotent. C'est ce qui permet de garder la 2D
 * comme repli sans jamais dupliquer une règle d'interaction.
 *
 * L'assemblage suit le brief : plateau texturé et mélangé par splat map
 * (`terrain.ts`), décor instancié (`decor.ts`), unités composées depuis la
 * silhouette (`unites.ts`), décalques de surbrillance au sol
 * (`surbrillances.ts`), éclairage et météo (`eclairage.ts`), animations
 * promise-based (`animations.ts`), le tout dans une boucle paresseuse
 * (`scene.ts`).
 *
 * Le moteur (`WebGPURenderer`, depuis le 7 septembre 2026) s'initialise de
 * façon **asynchrone** ; `monter()` reste synchrone, comme l'interface l'exige.
 * Le monde, lui, se bâtit **en tranches** à partir du premier `afficher`
 * (`planDeConstruction` et `chantier.ts`, 8 septembre 2026) : géométries,
 * textures et lumières sont des objets en mémoire, qui n'ont pas besoin du
 * moteur, mais les fabriquer d'un bloc gelait la page une centaine de
 * millisecondes. Chaque tranche rend la main au navigateur, et seul le
 * **dessin** attend `prete`.
 *
 * **Et le sol paraît avant le reste** (`PhaseChantier`, 8 septembre 2026 au
 * soir, demande du propriétaire : « au pire tu fais la map vide, tu mets les
 * unités »). Le chantier a deux temps. Le premier bâtit les toiles, le plateau
 * et l'éclairage, préchauffe ce peu de programmes, et **dessine** : l'écran de
 * chargement s'efface sur un terrain, pas sur un canevas vide. Le second bâtit
 * décor et unités — **groupes éteints**, pour qu'aucune image ne les dessine
 * avant que leurs programmes soient chauds, ce qui ramènerait le gel qu'on
 * chasse —, les préchauffe, les rallume, et dessine le monde entier. Entre les
 * deux, la boucle est paresseuse : elle a dessiné le sol une fois et dort.
 *
 * Pendant cette poignée de tranches,
 * `versEcran`, `versMonde` et `positionUnite` rendent `null` — rien ne les
 * appelle si tôt —, et un `cadrer` d'ouverture est **retenu** puis rejoué,
 * parce que celui-là n'arrive qu'une fois. `mesurer()` rend des zéros avant,
 * `capturer()` rien.
 *
 * three.js n'est importé que dans ce dossier ; le reste du dépôt ne le voit pas.
 */

import * as THREE from 'three/webgpu';

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { signatureTerrain, terrainLogique } from '../engine/index';
import { Boucle } from '../render/boucle';
import type { Partition } from '../render/partition';
import { QUALITE_PAR_DEFAUT, type QualiteRendu } from '../render/qualite';
import type {
  GestesRendu, MesuresRendu, PointVue, Rendu, VueInteraction,
} from '../render/rendu';
import type { Biome, CampId, CodePays, Case, CleTerrain, Saison } from '../schemas/types';
import { animationsDePartition, partitionProvisoire, type ContexteAnimation } from './animations';
import { creerVue3d, PAS_TANGAGE, type Vue3d } from './camera';
import { jouerTranches, ouvrirChantier, type Chantier, type Tranche } from './chantier';
import { brancherGestes3d } from './gestes';
import { ouvrirChantierDecor, type Decor } from './decor';
import { creerEclairage, parametresAmbiance, type Eclairage, type ParametresAmbiance } from './eclairage';
import { creerEffets, type Effets } from './effets';
import { caseVersMonde, type GrilleTerrain } from './geometrie';
import { tailleCarteOmbre, type CadreOmbre } from './ombres';
import { creerScene3d, moteur3dDisponible, type Scene3d } from './scene';
import { creerSurbrillances, type CoucheSurbrillances } from './surbrillances';
import { creerPlateau, grefferBrouillardSur, tranchesToilesPlateau, type Plateau } from './terrain';
import { creerUnites, type CalqueUnites } from './unites';

export { parametresAmbiance, melangerParametres, type ParametresAmbiance } from './eclairage';
export {
  CASE, caseVersMonde, construireSplat, hauteurEn, hauteurTerrain, HAUTEURS, mondeVersCase,
  NIVEAU_EAU, solDeCase, splatCase, splatTerrain, type GrilleTerrain, type Splat,
} from './geometrie';
export {
  composerSilhouette, echelleTaille, hauteurSilhouette, nomsPieces,
  type Piece, type RolePiece,
} from './pieces';
export {
  distanceCadrage, PALIERS_TANGAGE, palierDistance, palierSuivant, PAS_TANGAGE, positionCamera,
  tangageSuivant, TANGAGE_DEFAUT, TANGAGE_MAX, TANGAGE_MIN, type EtatCamera,
} from './camera';
export {
  cadreOmbre, champVisibleAuSol, DISTANCE_SOLEIL, HAUTEURS_OMBRE, tailleCarteOmbre,
  type CadreOmbre, type RectangleSol,
} from './ombres';
export { cheminEnL, longueurChemin, surChemin } from '../render/chemin';
export { compterFamilles } from './mesures';
export {
  chargerModele, conformerModele, forcerLod, RACINE_MODELES, teinterModele,
  type ModeleCharge, type NomClip,
} from './unites';

/** Millisecondes entre deux images au repos : de quoi faire vivre l'eau. */
const MS_REPOS = 1000;

/** Durée d'une mutation de terrain : marée qui tourne, chantier du génie. */
const MS_MUTATION = 1400;

/**
 * Au-delà, on dessine sans attendre la fin du préchauffage. Un moteur qui
 * traîne — un pilote froid, une machine chargée — ne doit pas pouvoir retenir
 * l'image indéfiniment : la première coûtera ce qu'elle coûtait, et c'est tout.
 */
const MS_PRECHAUFFAGE_MAX = 6000;

/**
 * Au-delà, une famille révélée cesse d'attendre l'image qui devait la montrer.
 * Sans boucle qui tourne — onglet masqué, banc de test —, personne n'appelle
 * `dessiner`, et le monde doit finir de se bâtir quand même.
 */
const MS_ATTENTE_IMAGE = 400;

/** Le monde monté : tout ce qui dépend de la carte, donc du premier état. */
/** La clé de programme du décor greffé : une seule injection, un seul programme. */
const CLE_BROUILLARD_DECOR = 'atlas-brouillard-decor-v1';

interface Monde {
  grille: GrilleTerrain;
  plateau: Plateau;
  /**
   * Le décor — bâtiments, arbres, rochers, paysage — se bâtit au **second temps**
   * du chantier (`planDeConstruction`), après que le sol a été montré : c'est le
   * plus gros morceau après le plateau, et rien de ce qui précède n'en dépend.
   * `null` jusque-là, jamais après.
   */
  decor: Decor | null;
  unites: CalqueUnites;
  surbrillances: CoucheSurbrillances;
  eclairage: Eclairage;
  /** Le pool d'effets transitoires (`effets.ts`) : son groupe est dans la scène. */
  effets: Effets;
  vue3d: Vue3d;
}

/**
 * Ce que le monde a de chaud, donc ce qu'on s'autorise à dessiner.
 *
 * - `rien` : le plateau n'est pas encore chaud. Une image dessinée maintenant
 *   paierait la traduction TSL → WGSL sur le fil principal, ce que le
 *   préchauffage fait hors de lui ;
 * - `sol` : le plateau et l'éclairage sont chauds. On dessine, et ce qui n'est
 *   pas encore chaud est **éteint** (`groupe.visible`), donc ignoré par le
 *   dessin comme par la passe d'ombres. Chaque famille se rallume quand ses
 *   programmes sont créés, et paraît là.
 */
type PhaseChantier = 'rien' | 'sol';

export interface OptionsRendu3d {
  biome?: Biome;
  paysParCamp?: Partial<Record<CampId, CodePays>>;
  /**
   * La qualité d'affichage (`render/qualite.ts`) : décide de la chaîne de
   * post-traitement. `auto` par défaut — le rendu mesure ses premières images.
   */
  qualite?: QualiteRendu;
  /**
   * La préférence « animations réduites » du joueur. Le réglage de l'appareil
   * (`prefers-reduced-motion`) est lu ici même et reste maître : celui-ci ne
   * peut qu'ajouter la réduction. Elle éteint aussi la chaîne de post-traitement.
   */
  animationsReduites?: boolean;
  /**
   * Appelée si le moteur, une fois monté, **ne démarre pas** — ni WebGPU ni
   * WebGL 2 n'a voulu de ce canevas. `monter()` lève tout de suite quand aucun
   * des deux n'existe ; ceci couvre l'échec qui n'arrive qu'à l'initialisation,
   * asynchrone, et que la page doit encore pouvoir dire au joueur.
   */
  surEchec?(cause: unknown): void;
}

/** Crée le rendu 3D, avec les styles des nations participant au scénario. */
export function creerRendu3d(options: OptionsRendu3d = {}): Rendu {
  let scene3d: Scene3d | null = null;
  let conteneurRef: HTMLElement | null = null;
  let monde: Monde | null = null;
  let boucle: Boucle | null = null;
  let repos: ReturnType<typeof setInterval> | null = null;
  let etat: EtatPartie | null = null;
  /**
   * L'état affiché juste avant `etat`. C'est ce qui permet à une partition de
   * retrouver ce qu'elle raconte : une unité qui vient de sortir, un drapeau
   * tel qu'il était — l'état logique est en avance, la salve rattrape.
   */
  let etatPrecedent: EtatPartie | null = null;
  let vue: VueInteraction | null = null;
  /** L'éclat d'un pouvoir : un multiplicateur d'exposition, 1 au repos. */
  let eclat = 1;
  let cleAmbiance = '';
  let cleTerrain = '';
  let premierTerrain = true;
  let cadree = false;
  /** Le chantier en cours (`chantier.ts`), `null` quand le monde est bâti. */
  let chantier: Chantier | null = null;
  /** Un cadrage d'ouverture demandé avant que la caméra existe : il attend. */
  let cadrageEnAttente: Case | null = null;
  let mouvementReduit: MediaQueryList | undefined;
  /** Vrai quand le pointeur principal est un doigt : la carte d'ombre passe à 1024². */
  let pointeurGrossier = false;
  /**
   * Ce qui **vaut une ombre**. La boucle ne dort jamais en partie — drapeaux,
   * respiration des figurines —, mais ces mouvements-là ne déplacent pas une
   * ombre d'un texel visible ; la carte d'ombre n'est donc recalculée que si
   * le monde a changé (`afficher` avec un nouvel état), si une animation de la
   * file a bougé une pièce, si le terrain mute, ou si la caméra ou le soleil
   * ont bougé (le cadre d'ombre change alors d'objet).
   */
  let ombreSale = true;
  let cadrePrecedent: CadreOmbre | null = null;
  /** L'image précédente a réclamé la suivante : les deux sont consécutives, l'intervalle est une cadence. */
  let continuSuivant = false;
  /** L'ambiance déjà passée aux matières : elles ne la reçoivent que quand elle change. */
  let ambianceAppliquee: { p: ParametresAmbiance; saison: Saison | undefined } | null = null;
  /**
   * Jusqu'où le monde est chaud, donc ce qu'une image a le droit de dessiner.
   * Le chantier la fait monter deux fois : `sol` à la fin de son premier temps,
   * `monde` à la fin du second.
   */
  let phase: PhaseChantier = 'rien';
  /**
   * Vrai pendant un préchauffage. Dessiner à cet instant serait une faute
   * précise, pas une prudence : `compileAsync` remplace, le temps de son
   * travail, la fonction qui traite chaque objet par celle qui **crée un
   * pipeline sans dessiner** ; une image qui se glisserait entre deux de ses
   * attentes ne dessinerait rien du tout.
   */
  let enPrechauffage = false;
  /**
   * Ceux qui attendent qu'une image soit dessinée. La révélation d'une famille
   * en pose un : sans cela, le chantier enchaînerait sur la famille suivante —
   * donc sur un `enPrechauffage` qui retient l'image — avant que la boucle ait
   * eu son tour, et tout paraîtrait d'un bloc à la fin, ce qu'on cherche
   * précisément à défaire. Deux macrotâches ne valent pas une image.
   */
  let attentesImage: Array<() => void> = [];

  function salir(): void {
    boucle?.salir();
  }

  /** Une image vient d'être envoyée : on relâche ceux qui l'attendaient. */
  function imageDessinee(): void {
    if (attentesImage.length === 0) return;
    const attentes = attentesImage;
    attentesImage = [];
    for (const relacher of attentes) relacher();
  }

  /**
   * Attend qu'une image soit dessinée, au plus `MS_ATTENTE_IMAGE`. Le délai
   * n'est pas une prudence de style : sans boucle qui tourne — un onglet
   * masqué, un banc de test —, personne n'appellerait jamais `dessiner`, et le
   * chantier ne finirait pas de bâtir le monde.
   */
  function prochaineImage(): Promise<void> {
    return new Promise((relacher) => {
      let fait = false;
      const finir = (): void => { if (!fait) { fait = true; relacher(); } };
      attentesImage.push(finir);
      setTimeout(finir, MS_ATTENTE_IMAGE);
    });
  }

  /**
   * Chauffe les programmes d'**une famille**, la rallume, et rend la main pour
   * qu'une image la montre.
   *
   * C'est la brique de la révélation par familles. La famille est **rallumée
   * avant** d'être chauffée, et non après : la passe d'ombres se préchauffe par
   * de vrais rendus, qui ne voient que ce qui est allumé (`prechauffage.ts`).
   * Rien ne s'affiche pour autant, puisque `enPrechauffage` retient l'image
   * pendant tout le travail.
   *
   * Le budget `MS_PRECHAUFFAGE_MAX` n'interrompt pas le préchauffage au milieu
   * d'un lot — il lui dit de **s'arrêter au suivant**. Débloquer l'image sans
   * l'arrêter reviendrait à dessiner pendant un `compileAsync`, c'est-à-dire à
   * ne rien dessiner du tout. Un écran qui ne vient jamais reste pire qu'un gel
   * d'une seconde : passé le budget, on dessine, et l'image paiera ce qu'elle a
   * toujours payé. Il court par famille : c'est un budget pour paraître, pas un
   * budget pour tout le chantier.
   */
  async function chauffer(m: Monde, familles: readonly THREE.Object3D[]): Promise<void> {
    const s = scene3d;
    if (!s) { phase = 'sol'; for (const f of familles) f.visible = true; return; }
    enPrechauffage = true;
    for (const f of familles) f.visible = true;
    let echu = false;
    // Un seul chronomètre pour les deux attentes : celle du moteur, et celle du
    // préchauffage lui-même.
    let reveiller: (() => void) | null = null;
    const garde = setTimeout(() => { echu = true; reveiller?.(); }, MS_PRECHAUFFAGE_MAX);
    try {
      // Un moteur qui ne démarre pas ne retient pas l'image indéfiniment : sans
      // dos, `prechauffer` rend la main tout de suite et `dessiner` ne dessine
      // rien, mais la boucle repart et la page cesse d'attendre.
      await Promise.race([s.prete, new Promise<void>((r) => { reveiller = r; })]);
      await s.prechauffer(m.vue3d.camera, () => !echu, familles);
    } catch {
      // Un préchauffage qui échoue ne coûte qu'une image plus chère.
    } finally {
      clearTimeout(garde);
      enPrechauffage = false;
      // Un préchauffage encore en vol quand la page démonte ne débloque pas
      // l'image du montage **suivant** : la scène n'est plus la même, et ses
      // programmes non plus.
      if (scene3d === s && monde === m) {
        phase = 'sol';
        salir();
      }
    }
    // Et on attend qu'elle paraisse pour de bon : la tranche suivante rallume
    // `enPrechauffage`, et une famille qu'on n'aurait pas laissé le temps de
    // dessiner ne paraîtrait qu'à la fin, avec toutes les autres.
    if (scene3d === s && monde === m) await prochaineImage();
  }

  /** Moins de mouvement : l'appareil le demande, ou le joueur dans ses réglages. */
  function reduit(): boolean {
    return (mouvementReduit?.matches ?? false) || (options.animationsReduites ?? false);
  }

  /**
   * La grille **telle qu'elle se lit maintenant**. Elle est relue à chaque
   * changement de terrain : une mécanique régionale réinterprète la carte sans
   * l'écrire, et une fermeture posée au montage gèlerait le plateau au premier
   * jour — c'est ce qui rendait les marées invisibles.
   */
  function grilleDe(e: EtatPartie, v: VueInteraction): GrilleTerrain {
    return {
      largeur: e.largeur,
      hauteur: e.hauteur,
      terrainDe: (x, y): CleTerrain => terrainLogique(e, v.catalogue, { x, y }) ?? 'plaine',
    };
  }

  /**
   * Le plan de construction du monde, **en tranches**.
   *
   * Bâtir d'un bloc coûtait le plus gros morceau du chargement de l'accueil
   * (`10-rendu-3d.md` §9.6) : la synthèse des textures et la fusion des
   * géométries, du JavaScript pur, sans rapport avec les nuanceurs. On le
   * découpe donc dans l'ordre où les choses comptent — les toiles du sol, puis
   * le plateau et l'éclairage, puis le décor, puis les unités —, et chaque
   * tranche rend la main au navigateur.
   *
   * **Deux temps, et une image entre les deux.** Le sol est chaud bien avant le
   * reste : le préchauffage de la seule famille du plateau tient en quelques
   * lots là où la scène entière en demande huit. On le paie donc tout de suite,
   * on dessine le terrain — l'écran de chargement s'efface là-dessus —, puis on
   * bâtit décor et unités **groupes éteints** pour qu'aucune image ne les
   * dessine avant qu'ils soient chauds à leur tour.
   */
  function planDeConstruction(e: EtatPartie, v: VueInteraction): Tranche[] | null {
    const s = scene3d;
    const conteneur = conteneurRef;
    if (!s || !conteneur) return null;
    const doc = conteneur.ownerDocument;
    const grille = grilleDe(e, v);
    cleTerrain = signatureTerrain(e);
    const depart = parametresAmbiance(e.climat.saison, e.climat.phase, e.climat.meteo);

    // Les toiles d'abord, une tranche chacune : c'est le poste le plus cher du
    // premier montage d'une page, et le seul qui soit gratuit au deuxième —
    // une matière ne dépend que du biome (`textures.ts`).
    const tranches: Tranche[] = [...tranchesToilesPlateau(doc, options.biome)];

    tranches.push(() => {
      const plateau = creerPlateau(grille, doc, options.biome);
      const unites = creerUnites(doc, plateau.hauteurEn, options);
      const surbrillances = creerSurbrillances(plateau.hauteurEn);
      const effets = creerEffets(doc);
      const eclairage = creerEclairage(
        s.scene, doc, depart,
        (x, z) => x >= 0 && z >= 0 && x < e.largeur && z < e.hauteur ? plateau.hauteurEn(x, z) : null,
        { tailleOmbre: tailleCarteOmbre(pointeurGrossier) },
      );
      const vue3d = creerVue3d({ largeur: e.largeur, hauteur: e.hauteur });
      // Décor et unités se bâtissent au second temps : leurs groupes restent
      // éteints jusqu'à ce que leurs programmes soient chauds. Un groupe
      // éteint est ignoré par `_projectObject`, donc par le dessin **et** par
      // la passe d'ombres ; le préchauffage, lui, le rallume tout seul le temps
      // de chaque lot (`prechauffage.ts`).
      unites.groupe.visible = false;
      surbrillances.groupe.visible = false;
      s.scene.add(plateau.groupe, unites.groupe, surbrillances.groupe, effets.groupe, eclairage.groupe);
      vue3d.redimensionner(s.largeur, s.hauteur);
      vue3d.cadrerCarte();
      // La caméra d'ombre suit le champ visible, image après image (`dessiner`) :
      // elle n'a plus de cadre fixe. Le premier se pose ici, avant l'image.
      eclairage.cadrerOmbre(vue3d.etat, vue3d.camera.aspect, grille);
      plateau.appliquerAmbiance(depart);
      unites.appliquerAmbiance(depart);
      cleAmbiance = v.ambiance.cle;
      monde = { grille, plateau, decor: null, unites, surbrillances, eclairage, effets, vue3d };
      // Le cadrage d'ouverture demandé pendant la construction n'est pas perdu :
      // il se rejoue ici, sur la caméra qui vient de naître.
      if (cadrageEnAttente) {
        const c = cadrageEnAttente;
        cadrageEnAttente = null;
        cadree = true;
        vue3d.cadrerCarte(c);
      }
    });

    // Premier temps clos : le sol est bâti, on le chauffe et on le montre. Et
    // **lui seul** : le plateau ne porte que six des trente et un programmes de
    // `premier_contact` (`tests/render3d/programmes.test.ts` en tient le
    // plafond). Faire attendre la grille que les arbres, les figurines et les
    // nappes de surbrillance soient compilés la retenait cinq fois plus
    // longtemps qu'il n'était nécessaire.
    tranches.push(async () => { if (monde) await chauffer(monde, [monde.plateau.groupe]); });

    // Le décor a ses propres tranches (`decor.ts`, `ouvrirChantierDecor`) : les
    // arbres, les rochers, le paysage, le rivage, les mâts, puis les cases
    // bâties par paquets de quatre. C'était le plus long bloc du chargement.
    tranches.push(async () => {
      const m = monde;
      if (!m) return;
      // La carte a pu changer pendant la construction — l'atelier en change sans
      // démonter la scène : le décor se sème sur la grille **du moment**.
      // `majGrille` ne peut rien pour un décor qui n'existait pas encore quand
      // elle est passée, et il resterait semé sur la carte d'avant.
      const courant = etat ?? e;
      const c = ouvrirChantierDecor(
        vue ? grilleDe(courant, vue) : grille, courant, m.plateau.hauteurEn, options.biome,
      );
      // Un chantier dans le chantier : c'est le décor qui décide de son
      // découpage — leur nombre dépend de la carte —, nous qui rendons la main
      // entre chacune, et cette tranche-ci qui attend qu'il ait fini.
      await jouerTranches(c.tranches, { vivant: () => scene3d === s && monde === m });
      if (scene3d !== s || monde !== m) return;
      const decor = c.decor();
      // Le brouillard s'applique au décor par le **nuanceur**, comme au sol :
      // teindre un matériau en noir lui laisse le reflet du studio et l'éclat du
      // soleil, et c'est ce gris qu'on voyait dans le noir.
      grefferBrouillardSur(decor.groupe, m.plateau.uniformesBrouillard, CLE_BROUILLARD_DECOR);
      decor.appliquerAmbiance(depart, (etat ?? e).climat.saison);
      decor.groupe.visible = false;
      s.scene.add(decor.groupe);
      m.decor = decor;
    });

    // Le décor paraît dès que **ses** programmes sont créés, sans attendre les
    // figurines : arbres, rochers, bâtiments et pavillons d'un coup, sur un
    // terrain déjà à l'écran.
    tranches.push(async () => {
      const m = monde;
      if (m?.decor) await chauffer(m, [m.decor.groupe]);
    });

    // Les unités et tout ce qui dérive de l'état : c'est `majMonde` qui les pose,
    // et il ne coûte rien tant qu'il n'a pas de monde.
    tranches.push(() => { majMonde(); });
    tranches.push(async () => { if (monde) await chauffer(monde, [monde.unites.groupe]); });

    // Et pour finir ce qui ne se voit pas encore : nappes de surbrillance,
    // impacts de pluie, étincelles. Leur programme se paierait sinon au premier
    // survol et au premier tir, là où un gel se remarque autant qu'au
    // chargement — mais il n'a aucune raison de retarder la grille.
    tranches.push(async () => {
      const m = monde;
      if (!m) return;
      await chauffer(m, [m.surbrillances.groupe, m.effets.groupe, m.eclairage.groupe]);
    });
    return tranches;
  }

  function dessiner(ecoule: number): void {
    const s = scene3d;
    const m = monde;
    if (!s || !m) return;
    // Tant que rien n'est compilé, on ne dessine rien : une image dessinée
    // maintenant paierait elle-même la traduction TSL → WGSL de toute la scène,
    // sur le fil principal, ce que le préchauffage est en train de faire hors
    // de lui. Il réveille la boucle à la fin de chacun de ses deux temps.
    if (phase === 'rien' || enPrechauffage) return;
    let encore = false;
    const calme = reduit();
    // La caméra d'abord : inertie, pas de zoom et recentrage se jouent dans
    // la boucle comme les autres animations, et l'image qui suit les voit.
    encore = m.vue3d.avancer(ecoule, calme) || encore;
    encore = m.eclairage.avancer(ecoule, m.vue3d.cible) || encore;
    // Puis l'ombre suit la caméra et le soleil ; le calcul ne se refait que
    // s'ils ont bougé — et c'est le cadre qui change d'objet qui le dit.
    const cadre = m.eclairage.cadrerOmbre(m.vue3d.etat, m.vue3d.camera.aspect, m.grille);
    const mutation = m.plateau.avancer(ecoule);
    if (mutation) {
      m.decor?.majRelief();
      // Les décalques suivent le sol qui glisse, au lieu d'attendre la
      // prochaine vue pour se reposer dessus.
      m.surbrillances.invalider();
    }
    encore = mutation || encore;
    encore = (m.decor?.avancer(ecoule, calme) ?? false) || encore;
    // Le calque reçoit la préférence au lieu d'être sauté : sous réduction, un
    // clip ou une respiration s'arrêtent net au lieu de glisser.
    encore = m.unites.avancer(ecoule, calme) || encore;
    encore = m.surbrillances.avancer(ecoule) || encore;
    // Les effets vivent ici et nulle part ailleurs : étincelles qui retombent,
    // anneaux qui s'élargissent, halos qui s'éteignent. Des sprites, sans ombre.
    encore = m.effets.avancer(ecoule) || encore;
    const p = m.eclairage.courant;
    const saison = vue?.ambiance.saison;
    // Les matières ne reçoivent l'ambiance que quand elle change : `courant`
    // ne change d'objet que pendant une transition, et le plateau comme le
    // décor allouaient une douzaine de couleurs par image pour repeindre à
    // l'identique. Un matériau créé entre-temps naît avec l'ambiance courante.
    if (!ambianceAppliquee || ambianceAppliquee.p !== p || ambianceAppliquee.saison !== saison) {
      m.plateau.appliquerAmbiance(p);
      if (vue) m.decor?.appliquerAmbiance(p, vue.ambiance.saison);
      m.unites.appliquerAmbiance(p);
      ambianceAppliquee = { p, saison };
    }
    // Une animation de la file qui déplace une pièce — glissement, tir,
    // capture, palissade — a levé `ombreSale` par `salir(true)` sur ce pas,
    // son dernier compris ; un éclat, un cadrage ou des sprites ne le font pas,
    // et le reste de `encore` — respiration, vent, particules, eau — n'en vaut
    // pas une non plus.
    const animations = boucle?.animations ?? 0;
    const ombre = ombreSale || mutation || cadre !== cadrePrecedent;
    // L'éclat d'un pouvoir multiplie l'exposition de l'ambiance, le temps du geste.
    s.dessiner(m.vue3d.camera, { ombre, continu: continuSuivant, exposition: p.exposition * eclat });
    // La famille qui vient de paraître attendait celle-ci pour laisser la
    // suivante se compiler.
    imageDessinee();
    ombreSale = false;
    cadrePrecedent = cadre;
    continuSuivant = encore || animations > 0;
    if (encore) salir();
  }

  function majMonde(): void {
    const m = monde;
    if (!m || !etat || !vue) return;
    const signature = signatureTerrain(etat);
    if (signature !== cleTerrain) {
      cleTerrain = signature;
      // Au premier montage on pose le terrain sans transition ; ensuite, une
      // marée ou un chantier se **regarde** arriver.
      m.plateau.majTerrain(grilleDe(etat, vue), premierTerrain ? 0 : MS_MUTATION);
      // Le sol va glisser pendant la mutation : les unités le suivent image
      // par image, puis se posent sur sa position finale. Une pose ne se refait
      // sinon que si l'unité a changé, pas quand le sol seul a bougé.
      if (!premierTerrain) m.unites.suivreSol(MS_MUTATION);
      premierTerrain = false;
      // Le sol a bougé, et parfois la grille elle-même : tout ce qui en dérive
      // doit repartir d'elle. Les unités relisent l'altitude au `maj` ci-dessous ;
      // le décor ressème arbres et rochers, rebâtit les bâtiments, et se repose.
      m.decor?.majGrille(grilleDe(etat, vue));
    }
    // Le brouillard de guerre : le plateau assombrit les cases hors de vue, le
    // décor éteint ce qu'il y sème. L'un et l'autre comparent l'ensemble reçu
    // à celui d'avant — un survol n'écrit rien.
    m.plateau.majVisibles(vue.visibles);
    m.decor?.majProprietaires(etat, vue.visibles, vue.catalogue);
    // `maj` rend vrai quand une unité a bougé, est apparue ou a disparu — et
    // seulement alors : un survol ne repose rien. C'est l'ombre qui en dépend.
    if (m.unites.maj(etat, vue.catalogue, vue.visibles, { camp: vue.camp ?? null, unites: vue.unitesVues ?? null })) {
      ombreSale = true;
    }
    const position = vue.selection ? m.unites.positionDe(vue.selection) : null;
    // Les décalques posés hors de la vue du joueur se mettent à plat : une
    // nappe qui épouse un relief invisible le dessine.
    // Un bâtiment rebâti, un lot ressemé ou un clone translucide arrivent avec
    // des matériaux neufs : ils reçoivent la greffe à leur tour. `grefferBrouillard`
    // ignore ce qu'il a déjà greffé.
    if (m.decor) grefferBrouillardSur(m.decor.groupe, m.plateau.uniformesBrouillard, CLE_BROUILLARD_DECOR);
    m.surbrillances.majVisibles(vue.visibles);
    m.surbrillances.maj(vue.surbrillances, vue.chemin, vue.curseur, position);
    if (vue.ambiance.cle !== cleAmbiance) {
      cleAmbiance = vue.ambiance.cle;
      m.eclairage.viser(parametresAmbiance(
        vue.ambiance.saison, vue.ambiance.phase, vue.ambiance.meteo,
      ));
    }
  }

  /** Ce que les animations d'une partition ont le droit de toucher. */
  function contexte(m: Monde): ContexteAnimation {
    return {
      unites: m.unites,
      effets: m.effets,
      hauteurEn: m.plateau.hauteurEn,
      drapeau: (cle) => m.decor?.drapeau(cle) ?? null,
      chantier: (cle) => m.decor?.chantier(cle) ?? null,
      etats: () => ({ courant: etat, precedent: etatPrecedent }),
      cadrer: (c) => {
        const p = caseVersMonde(c);
        m.vue3d.cadrerCase(c, m.plateau.hauteurEn(p.x, p.z));
      },
      eclat: (facteur, teinte) => {
        eclat = facteur;
        // La lumière du ciel prend la couleur du camp à mesure que l'éclat monte.
        m.eclairage.teinter(teinte, Math.max(0, Math.min(1, facteur - 1)) * 0.5);
      },
      salir: (ombre) => {
        if (ombre) ombreSale = true;
        majMonde();
        salir();
      },
    };
  }

  return {
    cle: '3d',

    get canvas(): HTMLCanvasElement | null {
      return scene3d?.canvas ?? null;
    },

    monter(conteneur: HTMLElement): void {
      conteneurRef = conteneur;
      const fenetre = conteneur.ownerDocument.defaultView;
      mouvementReduit = fenetre?.matchMedia('(prefers-reduced-motion: reduce)');
      pointeurGrossier = fenetre?.matchMedia('(pointer: coarse)').matches ?? false;
      const s = creerScene3d(conteneur, {
        surRedimension: (l, h) => {
          monde?.vue3d.redimensionner(l, h);
          salir();
        },
        qualite: options.qualite ?? QUALITE_PAR_DEFAUT,
        reduit,
        surChangement: salir,
      });
      scene3d = s;
      // Le moteur qui ne démarre pas se dit à la page ; une scène démontée
      // entre-temps rejette aussi, et cela ne regarde personne.
      s.prete.catch((cause: unknown) => {
        if (scene3d !== s) return;
        console.error('Moteur 3D indisponible', cause);
        options.surEchec?.(cause);
      });
      boucle = new Boucle(dessiner);
      repos = setInterval(() => salir(), MS_REPOS);
      ombreSale = true;
      cadrePrecedent = null;
      continuSuivant = false;
      eclat = 1;
      ambianceAppliquee = null;
    },

    afficher(e: EtatPartie, v: VueInteraction): void {
      // Un nouvel état déplace des pièces ; une nouvelle vue sur le même état
      // (un survol) ne touche que des décalques, qui ne portent pas d'ombre.
      if (e !== etat) {
        ombreSale = true;
        etatPrecedent = etat;
      }
      etat = e;
      vue = v;
      if (!monde && !chantier) {
        const plan = planDeConstruction(e, v);
        const s = scene3d;
        if (plan && s) {
          // Une scène démontée en cours de construction n'en joue pas une
          // tranche de plus : le chantier le lit avant chacune.
          chantier = ouvrirChantier(plan, { vivant: () => scene3d === s });
          chantier.demarrer();
        }
      }
      majMonde();
      salir();
    },

    jouer(partition: Partition): Promise<void> {
      const m = monde;
      const s = scene3d;
      const b = boucle;
      if (!m || !s || !b) return Promise.resolve();
      const { animations, attentes } = animationsDePartition(partition, contexte(m));
      for (const a of animations) b.ajouter(a);
      salir();
      return attentes.length === 0
        ? Promise.resolve()
        : Promise.all(attentes).then(() => undefined);
    },

    couper(): void {
      // Tout saute à l'état final : chaque `terminer` pose le sien et libère
      // ses effets ; ce qui vivrait encore dans le pool est retiré avec.
      boucle?.viderFile(true);
      monde?.effets.couper();
      eclat = 1;
      monde?.eclairage.teinter(null, 0);
      salir();
    },

    animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void> {
      // Provisoire : la peau écrit elle-même la partition depuis les
      // événements, avec la mise en scène d'avant, tant que le réalisateur pur
      // (`ecrirePartition`, `render/`) n'existe pas. `jeu.ts` appellera `jouer`.
      return this.jouer?.(partitionProvisoire(evenements, avant, reduit())) ?? Promise.resolve();
    },

    versMonde(x: number, y: number): Case | null {
      const m = monde;
      if (!m) return null;
      return m.vue3d.caseSous(x, y, [m.plateau.ponts, m.plateau.sol]);
    },

    versEcran(c: Case): PointVue | null {
      const m = monde;
      if (!m) return null;
      const p = caseVersMonde(c);
      return m.vue3d.versEcran(new THREE.Vector3(p.x, m.plateau.hauteurEn(p.x, p.z) + 0.3, p.z));
    },

    brancher(gestes: GestesRendu): () => void {
      const canvas = scene3d?.canvas;
      if (!canvas) return () => undefined;
      return brancherGestes3d(canvas, () => monde?.vue3d ?? null,
        () => (monde ? [monde.plateau.ponts, monde.plateau.sol] : null), gestes, salir);
    },

    msParImage(): number {
      return scene3d?.msParImage ?? 0;
    },

    mesurer(): MesuresRendu {
      return scene3d?.mesures() ?? {
        triangles: 0, appels: 0, msParImage: 0, composeur: false, msCalibration: null, backend: null,
      };
    },

    qualite(q: QualiteRendu): void {
      scene3d?.reglerQualite(q);
    },

    capturer(): string | null {
      const s = scene3d;
      const m = monde;
      // Avant le moteur, le canevas est vide : `null` plutôt qu'une image noire
      // qu'un test prendrait pour un plateau.
      if (!s || !m || !s.pret) return null;
      try {
        // Le tampon n'est pas préservé entre deux compositions : on redessine
        // juste avant de lire, dans la même tâche — par la chaîne de
        // post-traitement si elle est active, donc ce que l'écran montre.
        s.dessiner(m.vue3d.camera);
        return s.canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },

    positionUnite(id: string): { x: number; y: number; z: number } | null {
      // Où la figurine est dessinée **maintenant** : au milieu d'un glissement,
      // c'est le seul témoin, hors écran, qu'elle bouge.
      const p = monde?.unites.positionDe(id) ?? null;
      return p ? { x: p.x, y: p.y, z: p.z } : null;
    },
    zoomer(sens: number): void {
      monde?.vue3d.zoomer(sens);
      salir();
    },

    tourner(sens: number): void {
      monde?.vue3d.tourner(sens);
      salir();
    },

    incliner(sens: number): void {
      if (sens === 0) return;
      monde?.vue3d.incliner(Math.sign(sens) * PAS_TANGAGE);
      salir();
    },

    inclinaisonSuivante(): void {
      monde?.vue3d.inclinaisonSuivante();
      salir();
    },

    retenirVue(): void {
      monde?.vue3d.retenirVue();
    },

    revenirVue(): void {
      if (monde?.vue3d.revenirVue() === true) salir();
    },

    recentrer(c: Case): void {
      monde?.vue3d.centrerCase(c);
      salir();
    },

    cadrer(c: Case): void {
      const m = monde;
      if (!m) {
        // Le monde se bâtit encore : on retient le cadrage d'ouverture plutôt
        // que de le perdre — c'est lui qui décide de ce que le joueur voit en
        // arrivant, et il n'arrive qu'une fois.
        if (!cadree) cadrageEnAttente = c;
        return;
      }
      if (!cadree) {
        // Le premier cadrage est celui de l'ouverture : la carte entière si
        // elle tient, sinon la largeur en portrait et la vue portée vers
        // l'action — la première unité du joueur — sans montrer de vide.
        cadree = true;
        m.vue3d.cadrerCarte(c);
        salir();
        return;
      }
      const p = caseVersMonde(c);
      m.vue3d.cadrerCase(c, m.plateau.hauteurEn(p.x, p.z));
      salir();
    },

    demonter(): void {
      if (repos !== null) clearInterval(repos);
      repos = null;
      phase = 'rien';
      // Un préchauffage encore en vol s'arrêtera de lui-même — la scène qu'il
      // interroge est morte —, mais il ne doit pas retenir l'image du montage
      // suivant s'il en survient un.
      enPrechauffage = false;
      // La construction en cours s'arrête ici : le chantier ne joue pas une
      // tranche de plus sur une scène morte.
      chantier?.arreter();
      chantier = null;
      cadrageEnAttente = null;
      boucle?.arreter();
      boucle = null;
      if (monde) {
        monde.surbrillances.dispose();
        monde.unites.dispose();
        monde.decor?.dispose();
        monde.plateau.dispose();
        monde.eclairage.dispose();
        monde.effets.dispose();
        scene3d?.scene.clear();
        monde = null;
      }
      scene3d?.dispose();
      scene3d = null;
      conteneurRef = null;
      etat = null;
      etatPrecedent = null;
      vue = null;
      eclat = 1;
      cadree = false;
      cleAmbiance = '';
      cleTerrain = '';
      premierTerrain = true;
    },
  };
}

/**
 * Vrai si le navigateur courant peut faire tourner ce rendu : WebGPU, ou son
 * repli WebGL 2 (`scene.ts`, `moteur3dDisponible`).
 */
export function rendu3dDisponible(): boolean {
  return moteur3dDisponible();
}
