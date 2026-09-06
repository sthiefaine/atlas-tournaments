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
 * three.js n'est importé que dans ce dossier ; le reste du dépôt ne le voit pas.
 */

import * as THREE from 'three';

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { signatureTerrain, terrainLogique } from '../engine/index';
import { Boucle } from '../render/boucle';
import { QUALITE_PAR_DEFAUT, type QualiteRendu } from '../render/qualite';
import type {
  GestesRendu, MesuresRendu, PointVue, Rendu, VueInteraction,
} from '../render/rendu';
import type { Biome, CampId, CodePays, Case, CleTerrain } from '../schemas/types';
import { construireAnimations } from './animations';
import { creerVue3d, type Vue3d } from './camera';
import { brancherGestes3d } from './gestes';
import { creerDecor, type Decor } from './decor';
import { creerEclairage, parametresAmbiance, type Eclairage } from './eclairage';
import { caseVersMonde, type GrilleTerrain } from './geometrie';
import { tailleCarteOmbre } from './ombres';
import { creerScene3d, type Scene3d } from './scene';
import { creerSurbrillances, type CoucheSurbrillances } from './surbrillances';
import { creerPlateau, type Plateau } from './terrain';
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
  distanceCadrage, palierDistance, palierSuivant, positionCamera, TANGAGE_DEFAUT,
  TANGAGE_MAX, TANGAGE_MIN, type EtatCamera,
} from './camera';
export {
  cadreOmbre, champVisibleAuSol, DISTANCE_SOLEIL, HAUTEURS_OMBRE, tailleCarteOmbre,
  type CadreOmbre, type RectangleSol,
} from './ombres';
export { cheminEnL, longueurChemin, surChemin } from '../render/chemin';
export {
  chargerModele, conformerModele, forcerLod, RACINE_MODELES, teinterModele,
  type ModeleCharge, type NomClip,
} from './unites';

/** Millisecondes entre deux images au repos : de quoi faire vivre l'eau. */
const MS_REPOS = 1000;

/** Durée d'une mutation de terrain : marée qui tourne, chantier du génie. */
const MS_MUTATION = 1400;

/** Le monde monté : tout ce qui dépend de la carte, donc du premier état. */
interface Monde {
  grille: GrilleTerrain;
  plateau: Plateau;
  decor: Decor;
  unites: CalqueUnites;
  surbrillances: CoucheSurbrillances;
  eclairage: Eclairage;
  effets: THREE.Group;
  vue3d: Vue3d;
}

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
}

/** Crée le rendu 3D, avec les styles des nations participant au scénario. */
export function creerRendu3d(options: OptionsRendu3d = {}): Rendu {
  let scene3d: Scene3d | null = null;
  let conteneurRef: HTMLElement | null = null;
  let monde: Monde | null = null;
  let boucle: Boucle | null = null;
  let repos: ReturnType<typeof setInterval> | null = null;
  let etat: EtatPartie | null = null;
  let vue: VueInteraction | null = null;
  let cleAmbiance = '';
  let cleTerrain = '';
  let premierTerrain = true;
  let cadree = false;
  let mouvementReduit: MediaQueryList | undefined;
  /** Vrai quand le pointeur principal est un doigt : la carte d'ombre passe à 1024². */
  let pointeurGrossier = false;

  function salir(): void {
    boucle?.salir();
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

  /** Construit le monde à la première image : c'est là qu'on connaît la carte. */
  function batir(e: EtatPartie, v: VueInteraction): Monde | null {
    const s = scene3d;
    const conteneur = conteneurRef;
    if (!s || !conteneur) return null;
    const doc = conteneur.ownerDocument;
    const grille = grilleDe(e, v);
    cleTerrain = signatureTerrain(e);
    const plateau = creerPlateau(grille, doc, options.biome);
    const decor = creerDecor(grille, e, plateau.hauteurEn, options.biome);
    const unites = creerUnites(doc, plateau.hauteurEn, options);
    const surbrillances = creerSurbrillances(plateau.hauteurEn);
    const effets = new THREE.Group();
    effets.name = 'effets';
    const depart = parametresAmbiance(e.climat.saison, e.climat.phase, e.climat.meteo);
    const eclairage = creerEclairage(
      s.scene, doc, depart,
      (x, z) => x >= 0 && z >= 0 && x < e.largeur && z < e.hauteur ? plateau.hauteurEn(x, z) : null,
      { tailleOmbre: tailleCarteOmbre(pointeurGrossier) },
    );
    const vue3d = creerVue3d({ largeur: e.largeur, hauteur: e.hauteur });

    s.scene.add(plateau.groupe, decor.groupe, unites.groupe, surbrillances.groupe, effets, eclairage.groupe);
    vue3d.redimensionner(s.largeur, s.hauteur);
    vue3d.cadrerCarte();

    // La caméra d'ombre suit le champ visible, image après image (`dessiner`) :
    // elle n'a plus de cadre fixe. Le premier se pose ici, avant l'image.
    eclairage.cadrerOmbre(vue3d.etat, vue3d.camera.aspect, grille);

    plateau.appliquerAmbiance(depart);
    decor.appliquerAmbiance(depart, e.climat.saison);
    unites.appliquerAmbiance(depart);
    cleAmbiance = v.ambiance.cle;
    return {
      grille, plateau, decor, unites, surbrillances, eclairage, effets, vue3d,
    };
  }

  function dessiner(ecoule: number): void {
    const s = scene3d;
    const m = monde;
    if (!s || !m) return;
    let encore = false;
    const calme = reduit();
    // La caméra d'abord : inertie, pas de zoom et recentrage se jouent dans
    // la boucle comme les autres animations, et l'image qui suit les voit.
    encore = m.vue3d.avancer(ecoule, calme) || encore;
    encore = m.eclairage.avancer(ecoule, m.vue3d.cible) || encore;
    // Puis l'ombre suit la caméra et le soleil ; le calcul ne se refait que
    // s'ils ont bougé.
    m.eclairage.cadrerOmbre(m.vue3d.etat, m.vue3d.camera.aspect, m.grille);
    const mutation = m.plateau.avancer(ecoule);
    if (mutation) m.decor.majRelief();
    encore = mutation || encore;
    encore = m.decor.avancer(ecoule, calme) || encore;
    // Le calque reçoit la préférence au lieu d'être sauté : sous réduction, le
    // tassement d'une unité qui a joué doit encore s'appliquer — d'un coup.
    encore = m.unites.avancer(ecoule, calme) || encore;
    encore = m.surbrillances.avancer(ecoule) || encore;
    const p = m.eclairage.courant;
    m.plateau.appliquerAmbiance(p);
    if (vue) m.decor.appliquerAmbiance(p, vue.ambiance.saison);
    m.unites.appliquerAmbiance(p);
    s.renderer.toneMappingExposure = p.exposition;
    s.dessiner(m.vue3d.camera);
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
      premierTerrain = false;
      // Le sol a bougé, et parfois la grille elle-même : tout ce qui en dérive
      // doit repartir d'elle. Les unités relisent l'altitude au `maj` ci-dessous ;
      // le décor ressème arbres et rochers, rebâtit les bâtiments, et se repose.
      m.decor.majGrille(grilleDe(etat, vue));
    }
    m.decor.majProprietaires(etat, vue.visibles, vue.catalogue);
    m.unites.maj(etat, vue.catalogue, vue.visibles);
    const position = vue.selection ? m.unites.positionDe(vue.selection) : null;
    m.surbrillances.maj(vue.surbrillances, vue.chemin, vue.curseur, position);
    if (vue.ambiance.cle !== cleAmbiance) {
      cleAmbiance = vue.ambiance.cle;
      m.eclairage.viser(parametresAmbiance(
        vue.ambiance.saison, vue.ambiance.phase, vue.ambiance.meteo,
      ));
    }
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
      scene3d = creerScene3d(conteneur, {
        surRedimension: (l, h) => {
          monde?.vue3d.redimensionner(l, h);
          salir();
        },
        qualite: options.qualite ?? QUALITE_PAR_DEFAUT,
        reduit,
        surChangement: salir,
      });
      boucle = new Boucle(dessiner);
      repos = setInterval(() => salir(), MS_REPOS);
    },

    afficher(e: EtatPartie, v: VueInteraction): void {
      etat = e;
      vue = v;
      if (!monde) monde = batir(e, v);
      majMonde();
      salir();
    },

    animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void> {
      const m = monde;
      const s = scene3d;
      const b = boucle;
      if (!m || !s || !b || !conteneurRef) return Promise.resolve();
      const { animations, attentes } = construireAnimations(evenements, avant, {
        unites: m.unites,
        effets: m.effets,
        document: conteneurRef.ownerDocument,
        hauteurEn: m.plateau.hauteurEn,
        drapeau: (cle) => m.decor.drapeau(cle),
        chantier: (cle) => m.decor.chantier(cle),
        salir: () => {
          majMonde();
          salir();
        },
      });
      for (const a of animations) b.ajouter(a);
      salir();
      return attentes.length === 0
        ? Promise.resolve()
        : Promise.all(attentes).then(() => undefined);
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
      return scene3d?.mesures() ?? { triangles: 0, appels: 0, msParImage: 0, composeur: false, msCalibration: null };
    },

    capturer(): string | null {
      const s = scene3d;
      const m = monde;
      if (!s || !m) return null;
      try {
        // Le tampon WebGL n'est pas préservé entre deux compositions : on
        // redessine juste avant de lire, dans la même tâche — par la chaîne de
        // post-traitement si elle est active, donc ce que l'écran montre.
        s.dessiner(m.vue3d.camera);
        return s.canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },

    zoomer(sens: number): void {
      monde?.vue3d.zoomer(sens);
      salir();
    },

    tourner(sens: number): void {
      monde?.vue3d.tourner(sens);
      salir();
    },

    recentrer(c: Case): void {
      monde?.vue3d.centrerCase(c);
      salir();
    },

    cadrer(c: Case): void {
      const m = monde;
      if (!m) return;
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
      boucle?.arreter();
      boucle = null;
      if (monde) {
        monde.surbrillances.dispose();
        monde.unites.dispose();
        monde.decor.dispose();
        monde.plateau.dispose();
        monde.eclairage.dispose();
        scene3d?.scene.clear();
        monde = null;
      }
      scene3d?.dispose();
      scene3d = null;
      conteneurRef = null;
      etat = null;
      vue = null;
      cadree = false;
      cleAmbiance = '';
      cleTerrain = '';
      premierTerrain = true;
    },
  };
}

/** Vrai si le navigateur courant peut faire tourner ce rendu. */
export function rendu3dDisponible(): boolean {
  try {
    const d = (globalThis as { document?: Document }).document;
    if (!d) return false;
    return Boolean(d.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
