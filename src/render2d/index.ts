import type { ImageMesuree } from '../render/mesure-performance';
/**
 * # La peau 2D — `creerRendu2d`
 *
 * Décision du propriétaire du 23 septembre 2026 (`BRIEF.md`, « Sprites
 * précalculés » ; `doc/18-rendu-sprites.md`) : le jeu ne dessine plus de 3D en
 * temps réel, il **compose des images cuites** depuis les modèles, en WebGL 2.
 * Cette peau tient toute l'interface `Rendu` (`render/rendu.ts`) : `jeu.ts`, le
 * contrôleur et le HUD ne savent pas laquelle des deux peaux ils pilotent.
 *
 * Une image se compose dans l'ordre de `ORDRE_CALQUES` :
 *
 * 1. **sol** — un fond coloré par case (`surbrillances.ts`, `tracerFond`), puis
 *    le sol du lot du terrain (`./sol`, `CoucheSol`), qui le recouvre — tous
 *    deux dans la palette de **jour** ;
 * 2. le **voile** d'ambiance (nuit, brume, tempête) sur le sol seul : les images
 *    du monde reçoivent le même par instance (`meteo.ts`, `etalonnerPose`),
 *    une seule fois — rien n'est assombri deux fois ;
 * 3. **surbrillances** — cases allumées, flèche, curseur, anneau (aplats), au-
 *    dessus du voile : elles se lisent de nuit comme de jour ;
 * 4. **volumes** — bâtiments, pavillons et décor du sol, triés par ligne ;
 * 5. **ombres des unités** (et les effets couchés au sol), puis **unités** —
 *    toujours au-dessus des volumes : rien ne cache une unité —, avec leurs
 *    pastilles et leurs marques, qui ne reçoivent pas la nuit ;
 * 6. **effets** (`effets.ts`), **météo** en espace écran (`meteo.ts`), puis
 *    l'éclat et la vague d'un pouvoir, par-dessus tout. La secousse d'un coup
 *    ne déplace que l'image, jamais `versEcran`.
 *
 * Tout ce qui est une image passe par **un seul lot** (`lot.ts`) : un tampon
 * d'instances téléversé une fois par image, un appel de dessin par suite
 * d'instances qui partagent une page. Deux programmes en tout : les images et
 * les aplats — le sol a les siens.
 *
 * **La boucle dort** quand rien ne bouge : un nouvel état, un survol, un geste
 * de caméra la réveillent pour une image ; une animation, une inertie ou une
 * transition du sol la tiennent à 60 images par seconde ; le repos animé d'une
 * unité cuite, l'anneau de sélection et le palan d'une usine la font revenir
 * au pas de l'ambiance, **12 images par seconde** — la cadence de cuisson.
 *
 * `render3d/` n'est jamais importé ici, ni three : un test y veille.
 */

import type { Catalogue, EtatPartie, EvenementJeu } from '../engine/index';
import { cleCase, seuilCapture, signatureTerrain, terrainLogique, uniteParId } from '../engine/index';
import { chargerStyleNation } from '../assets/styles';
import { sonEnvironnement } from '../audio/profils';
import type { SortieAudio } from '../audio/types';
import { ambiance as ambianceDuClimat, lireCouleur } from '../render/ambiance';
import { Boucle } from '../render/boucle';
import { paletteDe } from '../render/palettes';
import { ecrirePartition, type Partition } from '../render/partition';
import type { BackendRendu } from '../render/qualite';
import type { GestesRendu, MesureFamille, MesuresRendu, PointVue, Rendu, VueInteraction } from '../render/rendu';
import type { Biome, CampId, Case, CleTerrain, CleUnite, CodePays } from '../schemas/types';
import { animationsDePartition, type ContexteAnimation2d, type PriseDrapeau2d } from './animations';
import { Trace, type CoucheAplats, ProgrammeAplats } from './aplats';
import {
  Atlas, chargerImageNavigateur, chargerManifeste, choisirAnimation, televerseurWebGl,
} from './atlas';
import { estBatiment, poseDrapeau, posesBatiments, type PoseDrapeau } from './batiments';
import {
  creerCamera2d, matricePlanVersDecoupe, planVersEcran, type Camera2d, type EtatCamera2d,
} from './camera';
import { ouvrirCombat2d } from './combat';
import {
  CHEMIN_MANIFESTE, IMAGES_PAR_SECONDE, idBatiment, idUnite, niveauxBrouillard, ORDRE_CALQUES, versPlan,
  type ClipSprite, type ContexteImage, type CoucheSol, type InstanceSprite, type ManifesteSprites, type VueSprite,
} from './contrat';
import { monterPlanche, PoolEffets, Secousse, Superposition, type PlancheEffets } from './effets';
import { brancherGestes2d } from './gestes';
import { creerToile, type Toile } from './gl';
import { LotSprites, ordonner, poser, type Pose, type ResolveurImages } from './lot';
import {
  ETALONNAGE_NEUTRE, etalonnageAmbiance, etalonnerPose, matriceEcran, Meteo2d, MS_METEO, MS_METEO_TACTILE,
  PLAFOND_METEO, PLAFOND_METEO_TACTILE, type Etalonnage,
} from './meteo';
import { creerPeintreRepli, fabriqueToileDocument } from './replis';
import { creerSol } from './sol';
import {
  couleurTerrainFond, tracerAnneau, tracerCurseur, tracerFleche, tracerFond, tracerSurbrillances, tracerVoile,
} from './surbrillances';
import { posesUnites, Visuels, type AnimationChoisie, type Rvb } from './unites';

export { moteur2dDisponible } from './gl';

/** Ce que la page donne à la peau 2D : ce qui a un sens sans 3D. */
export interface OptionsRendu2d {
  /** Les sons, joués sur la même horloge que les gestes. */
  audio?: SortieAudio;
  /** Le biome de la carte : le sol en tire ses matières et son décor. */
  biome?: Biome;
  /** La nation de chaque camp : la couleur d'équipe est celle de son style (`palette.main`). */
  paysParCamp?: Partial<Record<CampId, CodePays>>;
  /**
   * La préférence « animations réduites » du joueur. Le réglage de l'appareil
   * (`prefers-reduced-motion`) reste maître : celle-ci ne peut qu'ajouter la réduction.
   */
  animationsReduites?: boolean;
  /**
   * Appelée si le moteur, une fois monté, cesse de pouvoir dessiner : un
   * contexte perdu qu'on ne sait pas rebâtir. `monter()` lève tout de suite
   * quand WebGL 2 manque.
   */
  surEchec?(cause: unknown): void;
}

/**
 * Un **encart** : une petite scène de sprites dessinée dans la toile, au
 * rectangle d'un élément HTML posé par-dessus — l'hôte de l'écran de combat
 * (`ouvrirCombat`, seconde vague). Il a son propre plan et sa propre caméra ;
 * il partage le lot, l'atlas et les replis de la carte.
 */
export interface EncartSprites {
  /** L'élément dont le rectangle, à l'écran, reçoit l'image ; transparent au-dessus d'elle. */
  hote: HTMLElement;
  /** Le point de son plan au centre du rectangle, et le zoom (pixels CSS par pixel de plan). */
  camera: EtatCamera2d;
  /** Le fond du rectangle, sRGB de 0 à 1, ou `null` pour laisser la carte dessous. */
  fond: readonly [number, number, number] | null;
  /** Les poses à peindre, dans l'ordre des calques ; relues à chaque image. */
  poses(tempsMs: number): readonly Pose[];
  /** Vrai tant que l'encart s'anime : la boucle reste à 60 images par seconde. */
  enMouvement(): boolean;
}

/** La peau 2D : l'interface `Rendu`, plus l'hôte des encarts. */
export interface Rendu2d extends Rendu {
  /** Ouvre un encart ; rend sa fermeture. */
  ouvrirEncart(encart: EncartSprites): () => void;
}

/**
 * Le dos déclaré par la peau 2D. `BackendRendu` ne connaît encore que
 * `webgpu` (`render/qualite.ts`, hors de ce lot) : l'ajout de `webgl2` est
 * demandé. La valeur est la vraie, seul son type attend — et l'écran de
 * chargement (`etapeChargement`) n'en lit que la nullité.
 */
const DOS_2D = 'webgl2' as unknown as BackendRendu;

/** Le fond de la toile hors de la carte : celui de la page de jeu. */
const FOND_TOILE = lireCouleur('#10131a');

/** Le pas de l'ambiance : la cadence de cuisson des clips. */
const MS_AMBIANCE = 1000 / IMAGES_PAR_SECONDE;

/** Les images retenues pour les médianes de durée et de cadence. */
const FENETRE_MESURES = 30;

/** Les essences que le mode tactique retire de la carte : la végétation, jamais le relief ni les ponts. */
const VEGETATION = /^decor_(feuillu|conifere|palmier|tropical|buisson|touffe|roseau)_/;

/** Les ressources graphiques : tout ce qui meurt avec le contexte. */
interface Gpu {
  lot: LotSprites;
  aplats: ProgrammeAplats;
  fond: CoucheAplats;
  surbrillances: CoucheAplats;
  anneau: CoucheAplats;
  voile: CoucheAplats;
  /** L'éclat et la vague de teinte d'un pouvoir, par-dessus tout. */
  superposition: CoucheAplats;
}

function mediane(valeurs: readonly number[]): number {
  if (valeurs.length === 0) return 0;
  const t = [...valeurs].sort((a, b) => a - b);
  return t[Math.floor(t.length / 2)] ?? 0;
}

/** Deux ensembles de même contenu (ou tous deux absents). */
function memeEnsemble(a: ReadonlySet<string> | null | undefined, b: ReadonlySet<string> | null | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

/** Deux tables de marques de même contenu. */
function memesMarques(a: ReadonlyMap<string, string> | null | undefined, b: ReadonlyMap<string, string> | null | undefined): boolean {
  if (a === b) return true;
  const ta = a?.size ?? 0;
  const tb = b?.size ?? 0;
  if (ta !== tb) return false;
  if (ta === 0) return true;
  for (const [k, v] of a!) if (b!.get(k) !== v) return false;
  return true;
}

/** Crée la peau 2D. */
export function creerRendu2d(options: OptionsRendu2d = {}): Rendu2d {
  let toile: Toile | null = null;
  let gpu: Gpu | null = null;
  let atlas: Atlas | null = null;
  let sol: CoucheSol | null = null;
  /** Le sol a levé : on continue sans lui plutôt que de perdre la partie. */
  let solEnPanne = false;
  let solAvecManifeste = false;
  let manifeste: ManifesteSprites | null = null;
  let camera: Camera2d | null = null;
  let cadrageEnAttente: Case | null = null;
  let cadree = false;
  let boucle: Boucle | null = null;
  let etat: EtatPartie | null = null;
  let etatPrecedent: EtatPartie | null = null;
  let vue: VueInteraction | null = null;
  let tactique = false;
  let mouvementReduit: MediaQueryList | undefined;
  let minuterieAmbiance: ReturnType<typeof setTimeout> | null = null;
  let vivant = false;
  const visuels = new Visuels();
  const drapeauxForces = new Map<string, PoseDrapeau>();
  const encarts = new Set<EncartSprites>();

  // --- Le brouillard, par case : recalculé quand l'ensemble vu change.
  let brouillard: Uint8Array | null = null;
  let brouillardSource: ReadonlySet<string> | null | undefined;
  let versionBrouillard = 0;

  // --- Les géométries mémorisées : rebâties seulement quand leur clé change.
  const trace = new Trace();
  const matrice = new Float32Array(9);
  let cleFond = '';
  let cleSurbrillances = '';
  let posesBat: Pose[] = [];
  let batimentsSales = true;
  let batimentsAnimes = false;
  let derniersVolumesSol: readonly InstanceSprite[] | null = null;
  let posesSol: Pose[] = [];
  let derniereVueBat: { visibles: ReadonlySet<string> | null; unitesVues: ReadonlySet<string> | null | undefined; marques: ReadonlyMap<string, string> | null | undefined } | null = null;
  const toutes: Pose[] = [];
  const couleurs = new Map<string, Rvb>();

  // --- Les effets (`effets.ts`) : le pool, la secousse, les superpositions d'un
  //     pouvoir, la planche de leurs images ; la météo et l'étalonnage (`meteo.ts`).
  const effets = new PoolEffets();
  const secousse = new Secousse();
  const superposition = new Superposition();
  let planche: PlancheEffets | null = null;
  let monterPlancheEffets: (() => PlancheEffets | null) | null = null;
  let meteo: Meteo2d | null = null;
  let msMeteo = MS_METEO;
  const matriceMeteo = new Float32Array(9);
  /** L'étalonnage de la nuit, de la brume : posé sur chaque image du monde, une fois. */
  let etalonnage: Etalonnage = ETALONNAGE_NEUTRE;
  let cleEtalonnageSol = '';
  /** Une case vue : rien d'un effet ne se pose au-dessus du brouillard. */
  const vuCase = (x: number, y: number): boolean => {
    const e = etat;
    if (!brouillard || !e) return true;
    if (x < 0 || y < 0 || x >= e.largeur || y >= e.hauteur) return false;
    return (brouillard[y * e.largeur + x] ?? 0) > 0;
  };
  /** Les images de la scène : la planche d'effets d'abord, l'atlas pour tout le reste. */
  const resolveur: ResolveurImages = {
    resoudre: (inst) => planche?.resoudre(inst) ?? atlas?.resoudre(inst) ?? null,
  };

  // --- Les mesures.
  const durees: number[] = [];
  const intervalles: number[] = [];
  let derniereImage = 0;
  let continuPrecedent = false;
  let imagesDessinees = 0;
  let derniere = { appels: 0, instances: 0, triangles: 0, familles: {} as Record<string, MesureFamille> };
  let observateur: ((image: ImageMesuree) => void) | null = null;
  let positions = new Map<string, { x: number; y: number; h: number }>();

  function reduit(): boolean {
    return (mouvementReduit?.matches ?? false) || options.animationsReduites === true;
  }

  function salir(): void {
    boucle?.salir();
  }

  /** Réveille la boucle au pas de l'ambiance — ou plus tôt, pour la météo —, une seule minuterie en vol. */
  function planifierAmbiance(delai = MS_AMBIANCE): void {
    if (minuterieAmbiance !== null) return;
    minuterieAmbiance = setTimeout(() => {
      minuterieAmbiance = null;
      salir();
    }, delai);
  }

  /** La couleur d'équipe d'un camp : le style de sa nation, sa palette à défaut, le gris neutre sans camp. */
  function couleurEquipe(camp: CampId | null): Rvb {
    const cle = camp === null ? 'neutre' : String(camp);
    const memo = couleurs.get(cle);
    if (memo) return memo;
    const code = camp === null ? undefined : options.paysParCamp?.[camp];
    const style = code ? chargerStyleNation(code) : null;
    const c = lireCouleur(style?.palette.main ?? paletteDe(camp).main);
    const rvb: Rvb = [c.r / 255, c.v / 255, c.b / 255];
    couleurs.set(cle, rvb);
    return rvb;
  }

  function animationChoisie(id: string, v: VueSprite, clip: ClipSprite): AnimationChoisie | null {
    const e = atlas?.entree(id);
    if (!e) return null;
    const i = choisirAnimation(e, v, clip);
    const a = e.animations[i];
    return a ? { index: i, cadres: a.cadres.length, ips: a.ips, boucle: a.boucle } : null;
  }

  function entreeUnite(type: CleUnite, camp: CampId): string {
    const pays = options.paysParCamp?.[camp] ?? null;
    return atlas?.idPour('unite', type, pays, idUnite(type)) ?? idUnite(type);
  }

  function entreeBatiment(terrain: CleTerrain, proprio: CampId | null): string {
    const pays = proprio === null ? null : options.paysParCamp?.[proprio] ?? null;
    if (pays && atlas?.entree(idBatiment(terrain, pays))) return idBatiment(terrain, pays);
    return atlas?.idPour('batiment', terrain, pays, idBatiment(terrain)) ?? idBatiment(terrain);
  }

  function terrainDe(e: EtatPartie, v: VueInteraction) {
    return (c: Case): CleTerrain | null => terrainLogique(e, v.catalogue, c);
  }

  // -------------------------------------------------------------------------
  // Le contexte, ses ressources, sa perte
  // -------------------------------------------------------------------------

  function monterGpu(gl: WebGL2RenderingContext): Gpu {
    const aplats = new ProgrammeAplats(gl);
    return {
      lot: new LotSprites(gl),
      aplats,
      fond: aplats.couche(),
      surbrillances: aplats.couche(),
      anneau: aplats.couche(),
      voile: aplats.couche(),
      superposition: aplats.couche(),
    };
  }

  function demonterGpu(): void {
    const g = gpu;
    gpu = null;
    if (!g) return;
    try {
      g.lot.dispose();
      g.fond.dispose();
      g.surbrillances.dispose();
      g.anneau.dispose();
      g.voile.dispose();
      g.superposition.dispose();
      g.aplats.dispose();
    } catch {
      // Un contexte perdu rend ses objets tout seul.
    }
  }

  function jeterSol(): void {
    const s = sol;
    sol = null;
    derniersVolumesSol = null;
    posesSol = [];
    if (!s) return;
    try { s.dispose(); } catch { /* le sol meurt avec son contexte */ }
  }

  /** Crée le sol du lot du terrain, sur l'état courant ; une panne le laisse de côté. */
  function monterSol(): void {
    const t = toile;
    if (!t || !etat || solEnPanne) return;
    jeterSol();
    try {
      sol = creerSol(t.gl, etat, { biome: options.biome ?? 'plaine', reduit: reduit(), manifeste });
      solAvecManifeste = manifeste !== null;
      // Le mode tactique survit à la seconde naissance du sol, quand le manifeste arrive.
      sol.tactique?.(tactique);
      if (vue && brouillard) sol.maj(etat, vue, brouillard);
    } catch (cause) {
      solEnPanne = true;
      console.error('Sol 2D indisponible', cause);
    }
  }

  // -------------------------------------------------------------------------
  // L'état : ce qui se recalcule à `afficher`, jamais à chaque image
  // -------------------------------------------------------------------------

  function majBrouillard(e: EtatPartie, v: VueInteraction): void {
    if (brouillard && brouillardSource === v.visibles && brouillard.length === e.largeur * e.hauteur) return;
    brouillardSource = v.visibles;
    const neuf = niveauxBrouillard(e.largeur, e.hauteur, v.visibles);
    const change = !brouillard || brouillard.length !== neuf.length || neuf.some((x, i) => brouillard![i] !== x);
    if (change) {
      brouillard = neuf;
      versionBrouillard += 1;
    }
  }

  /** Le fond : une couleur par case, rebâti quand le terrain, l'ambiance ou le brouillard changent. */
  function majFond(e: EtatPartie, v: VueInteraction): void {
    const g = gpu;
    if (!g) return;
    const cle = `${signatureTerrain(e)}|${v.ambiance.cle}|${versionBrouillard}`;
    if (cle === cleFond) return;
    cleFond = cle;
    trace.vider();
    const lire = terrainDe(e, v);
    // La palette de **jour**, comme le sol : la nuit est le voile, posé une seule fois par-dessus.
    const jour = ambianceDuClimat(v.ambiance.saison, 'jour', v.ambiance.meteo).palette;
    tracerFond(trace, e.largeur, e.hauteur, (x, y) => couleurTerrainFond(lire({ x, y }), jour), brouillard);
    g.fond.poser(trace);
  }

  /** Les surbrillances, la flèche et le curseur : rebâtis quand leur clé change — un survol ne refait que le curseur et la flèche. */
  function majSurbrillances(v: VueInteraction): void {
    const g = gpu;
    if (!g) return;
    let cle = `${v.cheminAveugle ? 'a' : 'c'}|${v.curseur ? cleCase(v.curseur) : '-'}|`;
    for (const s of v.surbrillances) cle += `${s.genre[0]}${s.case.x},${s.case.y};`;
    cle += '|';
    for (const c of v.chemin) cle += `${c.x},${c.y};`;
    if (cle === cleSurbrillances) return;
    cleSurbrillances = cle;
    trace.vider();
    tracerSurbrillances(trace, v.surbrillances);
    tracerFleche(trace, v.chemin, v.cheminAveugle === true);
    if (v.curseur) tracerCurseur(trace, v.curseur);
    g.surbrillances.poser(trace);
  }

  /** Les bâtiments sont à reposer si l'état, la vue du joueur ou ses marques ont changé. */
  function marquerBatiments(e: EtatPartie, v: VueInteraction): void {
    const d = derniereVueBat;
    if (e !== etat || !d || d.visibles !== v.visibles || !memeEnsemble(d.unitesVues, v.unitesVues)
      || !memesMarques(d.marques, v.marquesCases)) {
      batimentsSales = true;
    }
    derniereVueBat = { visibles: v.visibles, unitesVues: v.unitesVues, marques: v.marquesCases };
  }

  // -------------------------------------------------------------------------
  // Une image
  // -------------------------------------------------------------------------

  function collecterPoses(e: EtatPartie, v: VueInteraction, tempsMs: number, calme: boolean): { animees: boolean; selection: { x: number; y: number } | null; effetsPoses: number } {
    toutes.length = 0;
    if (batimentsSales || batimentsAnimes) {
      const b = posesBatiments(e, terrainDe(e, v), {
        visibles: v.visibles, unitesVues: v.unitesVues, brouillard,
        equipe: couleurEquipe, entree: entreeBatiment, animation: animationChoisie,
        seuil: (c) => seuilCapture(e, v.catalogue, c),
        forces: drapeauxForces, marquesCases: v.marquesCases ?? null, tempsMs, reduit: calme,
      });
      posesBat = b.poses;
      batimentsAnimes = b.animees;
      batimentsSales = false;
      // Des instances fraîches : on les étalonne une fois, ici, et jamais d'une image à l'autre.
      for (const p of posesBat) etalonnerPose(p, etalonnage);
    }
    for (const p of posesBat) toutes.push(p);
    // Le décor du sol, trié avec les bâtiments ; enveloppé une fois par tableau reçu.
    let volumes: readonly InstanceSprite[] | null = null;
    if (sol && !solEnPanne) {
      try {
        volumes = sol.volumes();
      } catch (cause) {
        solEnPanne = true;
        console.error('Sol 2D en panne', cause);
      }
    }
    if (volumes !== derniersVolumesSol || cleEtalonnageSol !== etalonnage.cle) {
      derniersVolumesSol = volumes;
      cleEtalonnageSol = etalonnage.cle;
      // Les instances du sol sont à lui : on étalonne une copie, jamais les siennes.
      posesSol = (volumes ?? []).map((i) => {
        const p = poser('volumes', etalonnage.neutre ? i : { ...i });
        etalonnerPose(p, etalonnage);
        return p;
      });
    }
    for (const p of posesSol) {
      if (tactique && VEGETATION.test(p.instance.entree)) continue;
      toutes.push(p);
    }
    const u = posesUnites(e, v.catalogue, visuels, {
      camp: v.camp ?? null, visibles: v.visibles, unitesVues: v.unitesVues ?? null, marques: v.marques ?? null,
      selection: v.selection, equipe: couleurEquipe, entree: entreeUnite, animation: animationChoisie,
      tempsMs, reduit: calme,
    });
    positions = u.positions;
    for (const p of u.poses) {
      // Fraîches à chaque image : la figurine reçoit la nuit, sa pastille et sa marque non.
      etalonnerPose(p, etalonnage);
      toutes.push(p);
    }
    // Les effets, au-dessus des unités (ou au sol, sous elles), jamais sur une case cachée.
    const effetsPoses = effets.poses(toutes, vuCase);
    // La météo, en espace écran : rien sous animations réduites.
    const cam = camera;
    if (meteo && cam) meteo.poses(v.ambiance.particules, v.ambiance.phase === 'nuit', tempsMs, cam.vue, calme, toutes);
    ordonner(toutes);
    return { animees: u.animees || batimentsAnimes, selection: u.selection, effetsPoses };
  }

  /** Dessine une image entière. Rend vrai si la suivante doit venir tout de suite. */
  function composer(ecoule: number): boolean {
    const t = toile;
    const g = gpu;
    const cam = camera;
    const e = etat;
    const v = vue;
    const a = atlas;
    if (!t || !g || !cam || !e || !v || !a || t.perdu) return false;
    const debut = performance.now();
    const calme = reduit();
    let urgent = cam.avancer(ecoule, calme);
    if (sol && !solEnPanne && sol.enMouvement()) urgent = true;
    for (const encart of encarts) if (encart.enMouvement()) urgent = true;
    // L'étalonnage de l'ambiance (nuit, brume…) : quand il change, les images du monde se refont.
    const etalonnageCourant = etalonnageAmbiance(v.ambiance);
    if (etalonnageCourant !== etalonnage) {
      etalonnage = etalonnageCourant;
      batimentsSales = true;
    }

    const gl = t.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, t.canvas.width, t.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(FOND_TOILE.r / 255, FOND_TOILE.v / 255, FOND_TOILE.b / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    matricePlanVersDecoupe(cam.etat, cam.vue, matrice);
    // La secousse d'un coup : l'image seule bouge, jamais `versEcran` — un clic
    // pendant une secousse vise la case qu'il vise.
    const choc = secousse.decalage();
    if (choc.x !== 0 || choc.y !== 0) {
      matrice[6] = (matrice[6] ?? 0) + (2 * choc.x) / Math.max(1, cam.vue.largeur);
      matrice[7] = (matrice[7] ?? 0) - (2 * choc.y) / Math.max(1, cam.vue.hauteur);
    }
    // Le champ, un rien élargi : une secousse ne découvre jamais un bord sans voile.
    const champVu = cam.champ();
    const marge = 8 / Math.max(1e-6, cam.etat.zoom);
    const champ = { minX: champVu.minX - marge, minY: champVu.minY - marge, maxX: champVu.maxX + marge, maxY: champVu.maxY + marge };

    let appels = 0;
    const familles: Record<string, MesureFamille> = {};
    const compter = (nom: string, triangles: number, mailles: number): void => {
      const f = familles[nom] ?? { triangles: 0, mailles: 0 };
      f.triangles += triangles;
      f.mailles += mailles;
      familles[nom] = f;
      appels += mailles;
    };

    // --- Sol : le fond, puis le sol du lot du terrain par-dessus.
    majFond(e, v);
    compter('sol', g.fond.triangles, g.fond.dessiner(matrice));
    if (sol && !solEnPanne) {
      const ctx: ContexteImage = {
        gl, planVersDecoupe: matrice, echelle: cam.etat.zoom * t.ratio,
        largeur: t.canvas.width, hauteur: t.canvas.height, tempsMs: debut, reduit: calme,
      };
      try {
        sol.dessiner(ctx);
        compter('sol', 0, 1);
      } catch (cause) {
        solEnPanne = true;
        console.error('Sol 2D en panne', cause);
      }
      // Le sol a pu toucher à l'état du contexte : on reprend le nôtre.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, t.canvas.width, t.canvas.height);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    // --- Le voile d'ambiance (nuit, brume, tempête) sur le sol **seul**, juste
    //     après lui et sous les surbrillances, qui restent lisibles. Le sol peint
    //     la palette de jour ; les images du monde reçoivent le même voile par
    //     instance (`etalonnerPose`) : rien n'est assombri deux fois.
    const voile = v.ambiance.voile;
    if (voile) {
      trace.vider();
      tracerVoile(trace, champ, voile.couleur, voile.alpha);
      g.voile.poser(trace);
      compter('etalonnage', g.voile.triangles, g.voile.dessiner(matrice));
    }

    // --- Les images de la scène, rangées une fois pour toute l'image.
    const { animees, selection, effetsPoses } = collecterPoses(e, v, debut, calme);
    const empaquetage = g.lot.preparer(toutes, resolveur);

    // --- Surbrillances, puis l'anneau au pied de l'unité choisie. Leur trace
    // ne se refait que si leur clé change : un survol ne refait que le curseur.
    majSurbrillances(v);
    compter('surbrillances', g.surbrillances.triangles, g.surbrillances.dessiner(matrice));
    if (selection) {
      trace.vider();
      tracerAnneau(trace, selection.x, selection.y, debut, calme);
      g.anneau.poser(trace);
      compter('surbrillances', g.anneau.triangles, g.anneau.dessiner(matrice));
    }

    const nuit = v.ambiance.villesEclairees ? 1 : 0;
    let superposee = false;
    // La météo tombe devant la caméra : son calque a la matrice de l'écran.
    matriceEcran(cam.vue.largeur, cam.vue.hauteur, matriceMeteo);
    for (const calque of ORDRE_CALQUES) {
      if (calque === 'sol' || calque === 'voies' || calque === 'surbrillances') continue;
      if (calque === 'etalonnage') {
        // L'éclat et la vague de teinte d'un pouvoir : par-dessus tout, la météo comprise.
        trace.vider();
        if (superposition.tracer(trace, champ) > 0) {
          superposee = true;
          g.superposition.poser(trace);
          compter('etalonnage', g.superposition.triangles, g.superposition.dessiner(matrice));
        }
      }
      const s = g.lot.dessinerCalque(calque, calque === 'meteo' ? matriceMeteo : matrice, nuit);
      if (s.appels > 0) compter(calque, s.instances * 2, s.appels);
    }

    // --- Les encarts, chacun dans son rectangle.
    for (const encart of encarts) appels += dessinerEncart(t, g, a, encart, debut, nuit);

    // Les effets ont été posés à leur âge ; ils vieillissent de l'image **après**,
    // sur l'horloge de la boucle — celle des gestes qui les ont jetés.
    effets.avancer(ecoule);
    secousse.avancer(ecoule);
    superposition.avancer(ecoule);
    // Encore une image tant qu'ils vivent — et une de plus après le dernier,
    // qui le retire de l'écran : sinon la dernière étincelle y resterait figée.
    const secoue = choc.x !== 0 || choc.y !== 0;
    if (effetsPoses > 0 || secoue || superposee || effets.actif() || secousse.active() || superposition.active()) urgent = true;

    const fin = performance.now();
    durees.push(fin - debut);
    if (durees.length > FENETRE_MESURES) durees.shift();
    if (continuPrecedent && derniereImage > 0) {
      intervalles.push(debut - derniereImage);
      if (intervalles.length > FENETRE_MESURES) intervalles.shift();
    }
    derniereImage = debut;
    imagesDessinees += 1;
    let triangles = 0;
    for (const f of Object.values(familles)) triangles += f.triangles;
    derniere = { appels, instances: empaquetage.instances, triangles, familles };
    const animations = boucle?.animations ?? 0;
    observateur?.({ instant: debut, cpuMs: fin - debut, phase: urgent || animations > 0 ? 'action' : 'repos', triangles, appels });

    // L'eau du sol ondule avec l'horloge sans réclamer d'image : s'il le dit
    // (`ambiant`, ajout proposé au contrat), il a droit au pas de l'ambiance.
    const solAmbiant = sol !== null && !solEnPanne && (sol as CoucheSol & { ambiant?(): boolean }).ambiant?.() === true;
    const ambiant = !calme && (animees || selection !== null || solAmbiant);
    // La météo tombe au repos aussi, plus vite que le pas de l'ambiance ; jamais sous réduction.
    const meteoActive = meteo !== null && !calme && v.ambiance.particules.type !== 'aucune';
    continuPrecedent = urgent || animations > 0;
    if (!urgent && animations === 0 && (ambiant || meteoActive)) planifierAmbiance(meteoActive ? msMeteo : MS_AMBIANCE);
    return urgent;
  }

  /** Dessine un encart dans le rectangle de son hôte. Rend le nombre d'appels. */
  function dessinerEncart(t: Toile, g: Gpu, a: Atlas, encart: EncartSprites, tempsMs: number, nuit: number): number {
    const boiteToile = t.canvas.getBoundingClientRect();
    const boite = encart.hote.getBoundingClientRect();
    if (boite.width < 1 || boite.height < 1 || boiteToile.width < 1) return 0;
    const k = t.canvas.width / boiteToile.width;
    const x = Math.round((boite.left - boiteToile.left) * k);
    const l = Math.round(boite.width * k);
    const h = Math.round(boite.height * k);
    const y = Math.round(t.canvas.height - (boite.top - boiteToile.top) * k - h);
    const gl = t.gl;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, l, h);
    gl.viewport(x, y, l, h);
    if (encart.fond) {
      gl.clearColor(encart.fond[0], encart.fond[1], encart.fond[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    const m = new Float32Array(9);
    matricePlanVersDecoupe(encart.camera, { largeur: boite.width, hauteur: boite.height }, m);
    const poses = [...encart.poses(tempsMs)];
    ordonner(poses);
    // Le même résolveur que la carte : un encart peut poser des effets (`effet_*`).
    g.lot.preparer(poses, a === atlas ? resolveur : a);
    let appels = 0;
    for (const calque of ORDRE_CALQUES) appels += g.lot.dessinerCalque(calque, m, nuit).appels;
    gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, t.canvas.width, t.canvas.height);
    return appels;
  }

  function dessiner(ecoule: number): void {
    if (!vivant) return;
    if (composer(ecoule)) salir();
  }

  // -------------------------------------------------------------------------
  // Les animations : ce qu'elles ont le droit de toucher
  // -------------------------------------------------------------------------

  function contexte(): ContexteAnimation2d {
    return {
      visuels,
      etats: () => ({ courant: etat, precedent: etatPrecedent }),
      catalogue: (): Catalogue | null => vue?.catalogue ?? null,
      cadrer: (c) => { camera?.cadrerCase(c); salir(); },
      drapeau: (cle): PriseDrapeau2d | null => {
        const e = etat;
        const v = vue;
        if (!e || !v) return null;
        const [x, y] = cle.split(',').map(Number);
        const c = { x: x ?? -1, y: y ?? -1 };
        if (!estBatiment(terrainLogique(e, v.catalogue, c))) return null;
        return {
          poseDans: (s) => {
            const u = s.unites.find((w) => w.x === c.x && w.y === c.y && !w.dansTransport);
            return poseDrapeau(
              s.proprietaires[cle] ?? null,
              u && u.pointsCapture > 0 ? { camp: u.camp, points: u.pointsCapture } : null,
              seuilCapture(s, v.catalogue, c),
            );
          },
          forcer: (pose) => { drapeauxForces.set(cle, pose); batimentsSales = true; },
          relacher: () => { if (drapeauxForces.delete(cle)) batimentsSales = true; },
        };
      },
      ...(options.audio ? { audio: options.audio } : {}),
      visible: (c) => !vue?.visibles || vue.visibles.has(cleCase(c)),
      temps: () => performance.now(),
      salir,
      effets,
      secouer: (amplitude, duree, retard) => {
        secousse.lancer(amplitude, duree, retard);
        salir();
      },
      superposition,
      equipe: couleurEquipe,
      reduit,
    };
  }

  // -------------------------------------------------------------------------
  // L'interface
  // -------------------------------------------------------------------------

  const rendu: Rendu2d = {
    cle: '2d',

    get canvas(): HTMLCanvasElement | null {
      return toile?.canvas ?? null;
    },

    monter(conteneur: HTMLElement): void {
      const fenetre = conteneur.ownerDocument.defaultView;
      mouvementReduit = fenetre?.matchMedia?.('(prefers-reduced-motion: reduce)');
      const t = creerToile(conteneur, {
        surRedimension: (l, h) => {
          camera?.redimensionner(l, h);
          salir();
        },
        surPerte: () => {
          // Tout objet WebGL est mort : on oublie, sans rien détruire.
          gpu = null;
          jeterSol();
          atlas?.perdre();
          planche = null;
          cleFond = '';
          cleSurbrillances = '';
        },
        surRestauration: () => {
          const tt = toile;
          if (!tt) return;
          try {
            gpu = monterGpu(tt.gl);
            // La planche d'effets se repeint : sa texture est morte avec le contexte.
            planche = monterPlancheEffets?.() ?? null;
            monterSol();
            batimentsSales = true;
            salir();
          } catch (cause) {
            console.error('Rendu 2D : contexte irrécupérable', cause);
            options.surEchec?.(cause);
          }
        },
      });
      toile = t;
      try {
        gpu = monterGpu(t.gl);
      } catch (cause) {
        t.dispose();
        toile = null;
        throw cause;
      }
      const doc = conteneur.ownerDocument;
      atlas = new Atlas({
        televerseur: televerseurWebGl(t.gl),
        charger: chargerImageNavigateur,
        peintre: creerPeintreRepli(fabriqueToileDocument(doc), () => vue?.catalogue ?? null),
        surArrivee: salir,
      });
      // Les images d'effets et de météo : peintes par le code, une fois, sur une planche.
      monterPlancheEffets = () => monterPlanche(televerseurWebGl(t.gl), fabriqueToileDocument(doc));
      planche = monterPlancheEffets();
      // Au doigt, la météo porte moins de particules et tombe moins souvent.
      const tactile = fenetre?.matchMedia?.('(pointer: coarse)').matches === true;
      meteo = new Meteo2d(tactile ? PLAFOND_METEO_TACTILE : PLAFOND_METEO);
      msMeteo = tactile ? MS_METEO_TACTILE : MS_METEO;
      vivant = true;
      boucle = new Boucle(dessiner);
      // Le manifeste arrive quand il arrive : d'ici là, tout est en repli.
      void chargerManifeste(CHEMIN_MANIFESTE).then((m) => {
        if (!vivant || !m) return;
        manifeste = m;
        atlas?.poserManifeste(m);
        batimentsSales = true;
        // Le sol cherche son décor dans le manifeste : on le refait une fois, avec.
        if (sol && !solAvecManifeste) monterSol();
        salir();
      });
    },

    afficher(e: EtatPartie, v: VueInteraction): void {
      if (!toile) return;
      if (e !== etat) {
        etatPrecedent = etat;
        options.audio?.environnement?.(sonEnvironnement(e.climat.meteo, e.climat.phase, options.biome ?? ''));
      }
      marquerBatiments(e, v);
      const premiere = etat === null;
      etat = e;
      vue = v;
      if (!camera) {
        camera = creerCamera2d(e.largeur, e.hauteur);
        camera.redimensionner(toile.largeur, toile.hauteur);
        camera.cadrerCarte();
        if (cadrageEnAttente) {
          camera.cadrerCarte(cadrageEnAttente);
          cadrageEnAttente = null;
          cadree = true;
        }
      } else {
        camera.poserCarte(e.largeur, e.hauteur);
      }
      majBrouillard(e, v);
      if (premiere || !sol) {
        if (!sol && !solEnPanne) monterSol();
      } else if (brouillard && !solEnPanne) {
        try {
          if (sol.maj(e, v, brouillard)) salir();
        } catch (cause) {
          solEnPanne = true;
          console.error('Sol 2D en panne', cause);
        }
      }
      salir();
    },

    jouer(partition: Partition): Promise<void> {
      const b = boucle;
      if (!b || !vivant) return Promise.resolve();
      const { animations, attentes } = animationsDePartition(partition, contexte());
      for (const a of animations) b.ajouter(a);
      salir();
      return attentes.length === 0 ? Promise.resolve() : Promise.all(attentes).then(() => undefined);
    },

    couper(): void {
      options.audio?.annuler();
      // Tout saute à l'état final : chaque `terminer` pose le sien, et rien ne traîne.
      boucle?.viderFile(true);
      effets.couper();
      secousse.couper();
      superposition.couper();
      drapeauxForces.clear();
      batimentsSales = true;
      salir();
    },

    animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void> {
      // Le repli de `jouer` : la peau écrit elle-même la partition, par le même
      // réalisateur que `jeu.ts`, sans écran de combat.
      return this.jouer?.(ecrirePartition(evenements, avant, etat ?? avant, {
        camp: vue?.camp ?? 0, reduit: reduit(), cadrer: vue?.attenteIa ?? false, ecranCombat: false,
      })) ?? Promise.resolve();
    },

    versMonde(x: number, y: number): Case | null {
      return camera?.caseSous(x, y) ?? null;
    },

    versEcran(c: Case): PointVue | null {
      const cam = camera;
      if (!cam) return null;
      const p = versPlan(c.x + 0.5, c.y + 0.5, 0);
      return planVersEcran(cam.etat, cam.vue, p.X, p.Y);
    },

    brancher(gestes: GestesRendu): () => void {
      const canvas = toile?.canvas;
      if (!canvas) return () => undefined;
      return brancherGestes2d(canvas, () => camera, gestes, salir);
    },

    cadrer(c: Case): void {
      const cam = camera;
      if (!cam) {
        // Pas encore de carte : le cadrage d'ouverture attend, il n'arrive qu'une fois.
        if (!cadree) cadrageEnAttente = c;
        return;
      }
      if (!cadree) {
        cadree = true;
        cam.cadrerCarte(c);
      } else {
        cam.cadrerCase(c);
      }
      salir();
    },

    recentrer(c: Case): void {
      camera?.centrerCase(c);
      salir();
    },

    zoomer(sens: number): void {
      camera?.zoomer(sens);
      salir();
    },

    modeTactique(actif: boolean): void {
      tactique = actif;
      if (toile) toile.canvas.dataset['modeTactique'] = String(actif);
      // Le repli du sol (arbres, hautes herbes du nuanceur) ne l'apprend que par là.
      if (sol && !solEnPanne) {
        try {
          sol.tactique?.(actif);
        } catch (cause) {
          solEnPanne = true;
          console.error('Sol 2D en panne', cause);
        }
      }
      salir();
    },

    positionUnite(id: string): { x: number; y: number; z: number } | null {
      const e = etat;
      if (!e) return null;
      const u = visuels.retenue(id) ?? uniteParId(e, id);
      if (!u) return null;
      const v = visuels.lire(id);
      const dessinee = positions.get(id);
      // Où la figurine est dessinée maintenant : au milieu d'un glissement, ni
      // sa case de départ ni celle d'arrivée. En cases, la hauteur en `y`.
      return {
        x: u.x + 0.5 + (v?.dx ?? 0),
        y: (dessinee?.h ?? 0),
        z: u.y + 0.5 + (v?.dy ?? 0),
      };
    },

    retenirVue(): void {
      camera?.retenirVue();
    },

    revenirVue(): void {
      if (camera?.revenirVue() === true) salir();
    },

    capturer(): string | null {
      const t = toile;
      if (!t || !gpu || !camera || !etat) return null;
      try {
        // Le tampon n'est pas préservé : on redessine juste avant de lire, dans la même tâche.
        composer(0);
        return t.canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },

    msParImage(): number {
      return mediane(durees);
    },

    mesurer(): MesuresRendu {
      const m: MesuresRendu & { instances: number } = {
        triangles: derniere.triangles,
        appels: derniere.appels,
        msParImage: mediane(durees),
        composeur: false,
        msCalibration: null,
        msCadence: intervalles.length >= 5 ? mediane(intervalles) : null,
        backend: toile && gpu ? DOS_2D : null,
        familles: derniere.familles,
        instances: derniere.instances,
      };
      return m;
    },

    observerImages(obs: (image: ImageMesuree) => void): () => void {
      observateur = obs;
      return () => { if (observateur === obs) observateur = null; };
    },

    mondeBati(): boolean {
      return imagesDessinees > 0;
    },

    ouvrirEncart(encart: EncartSprites): () => void {
      encarts.add(encart);
      salir();
      return () => {
        if (encarts.delete(encart)) salir();
      };
    },

    ouvrirCombat(hote, geste) {
      // L'écran de combat (`combat.ts`) : des encarts posés au rectangle que le
      // HUD fournit. Une peau qui n'est pas montée rend `null`, et le HUD garde
      // alors ses plaques peintes.
      const e = etat;
      const v = vue;
      if (!vivant || !e || !v || !atlas) return null;
      return ouvrirCombat2d(hote, geste, {
        ouvrirEncart: (encart) => rendu.ouvrirEncart(encart),
        salir,
        catalogue: v.catalogue,
        terrain: (c) => terrainLogique(e, v.catalogue, c),
        proprietaire: (c) => e.proprietaires[cleCase(c)] ?? null,
        ambiance: v.ambiance,
        biome: options.biome ?? 'plaine',
        equipe: couleurEquipe,
        entreeUnite,
        entreeBatiment,
        entree: (id) => atlas?.entree(id) ?? null,
        reduit,
      });
    },

    demonter(): void {
      vivant = false;
      observateur = null;
      options.audio?.annuler();
      if (minuterieAmbiance !== null) clearTimeout(minuterieAmbiance);
      minuterieAmbiance = null;
      boucle?.arreter();
      boucle = null;
      encarts.clear();
      jeterSol();
      demonterGpu();
      effets.couper();
      secousse.couper();
      superposition.couper();
      planche?.dispose();
      planche = null;
      monterPlancheEffets = null;
      meteo = null;
      atlas?.dispose();
      atlas = null;
      toile?.dispose();
      toile = null;
      camera = null;
      cadrageEnAttente = null;
      cadree = false;
      etat = null;
      etatPrecedent = null;
      vue = null;
      brouillard = null;
      brouillardSource = undefined;
      visuels.vider();
      drapeauxForces.clear();
      couleurs.clear();
      cleFond = '';
      cleSurbrillances = '';
      posesBat = [];
      posesSol = [];
      derniersVolumesSol = null;
    },
  };
  return rendu;
}
