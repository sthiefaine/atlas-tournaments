/**
 * Les **unités** de la peau 2D : où chacune se pose, dans quelle vue, à quelle
 * image, avec son ombre, sa pastille de PV et sa marque.
 *
 * Ce module ne dessine rien : il rend des `Pose` que le lot peint (`lot.ts`).
 * Les règles de lecture sont celles de la 3D (`render3d/unites.ts`), qui les a
 * trouvées une à une en jouant :
 *
 * - on ne dessine que ce que le joueur **voit** : la case (`visibles`) ne suffit
 *   pas, une furtive hors contact ou une unité tapie en forêt sont sur une case
 *   éclairée et pourtant cachées (`unitesVues`, la règle du moteur) ;
 * - une unité **transportée** ne se dessine pas : elle est dans la cale ;
 * - une unité qui **a joué** (`agi`, `produite`, du camp qui joue) passe à
 *   `OPACITE_JOUEE` et se **fige** dans son repos — l'immobilité est la moitié
 *   du signal ; une `deplacee` a encore sa suite à donner et ne s'éteint pas ;
 * - une **furtive** se voile à `OPACITE_FURTIVE` pour son camp seulement : une
 *   furtive adverse tenue au contact est vue, donc entière ;
 * - au repos, une unité regarde **vers la droite au camp 0**, vers la gauche
 *   ailleurs : les deux armées se font face, comme dans Advance Wars ;
 * - la pastille de PV paraît sous 10 PV affichés, et porte le cadenas d'une
 *   unité qui a joué ; les PV **retenus** par un geste en cours l'emportent sur
 *   ceux de l'état, qui est en avance sur l'image.
 *
 * L'**état visuel** (`EtatVisuel2d`) est la prise des animations : elles y
 * poussent décalages, vue, clip, opacité, éclat, et ce module les lit.
 *
 * Pur : ni DOM, ni WebGL (`tests/render2d/unites.test.ts`).
 */

import { chargerStyleNation } from '../assets/styles';
import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, pvAffiches, sontAllies } from '../engine/index';
import { lireCouleur } from '../render/ambiance';
import { paletteDe } from '../render/palettes';
import type { MarqueUnite } from '../render/rendu';
import { echelleTaille } from '../render/sprites/silhouettes';
import type { CampId, CleUnite, CodePays } from '../schemas/types';
import { cadreAuTemps } from './atlas';
import { OMBRE_UNITE, type ClipSprite, type InstanceSprite, type VueSprite } from './contrat';
import type { Pose } from './lot';
import { FORMES } from './replis';

/** L'opacité d'une unité qui a joué : celle de la 3D. */
export const OPACITE_JOUEE = 0.6;
/** L'opacité d'une unité furtive, pour son camp : celle de la 3D. */
export const OPACITE_FURTIVE = 0.45;
/**
 * La hauteur de vol d'un appareil **peint en repli**, en cases : de quoi poser
 * son ombre sur la case, sous lui. Une image cuite ne la reçoit pas : le GLB
 * est modélisé à sa propre hauteur de vol — du transport aérien posé (0 m) au
 * chasseur (0,33 m) —, et l'image est déjà au-dessus de son pivot, qui reste
 * le pied (`doc/refonte/sprites-cuisson.md`). La lui ajouter la lèverait deux fois.
 */
export const HAUTEUR_VOL = 0.34;
/** Ce que devient l'ombre d'un appareil en vol : plus petite, plus claire. */
const OMBRE_VOL = { echelle: 0.8, opacite: 0.7 };

/** Où regarde une unité : trois vues cuites, la gauche est la droite retournée. */
export type Orientation = 'droite' | 'gauche' | 'bas' | 'haut';

/** Une couleur d'équipe, sRGB de 0 à 1. */
export type Rvb = readonly [number, number, number];

/**
 * La couleur d'équipe d'un camp : `palette.main` du style de sa nation (la
 * couleur de la 3D), la palette du camp à défaut, et **le gris neutre**
 * (`#b9bec7`, `render/palettes.ts`) sans propriétaire. Jamais le blanc : les
 * zones d'équipe d'une image cuite sont peintes en blanc et ne se teignent que
 * par cette couleur — un bâtiment neutre laissé sans elle les montrerait
 * blanches, là où la 3D le laissait gris.
 */
export function couleurEquipeDe(camp: CampId | null, pays: CodePays | null | undefined): Rvb {
  const style = camp !== null && pays ? chargerStyleNation(pays) : null;
  const c = lireCouleur(style?.palette.main ?? paletteDe(camp).main);
  return [c.r / 255, c.v / 255, c.b / 255];
}

/** L'état visuel d'une unité : ce que les animations poussent, image par image. */
export interface EtatVisuel2d {
  /** Décalage au sol depuis sa case, en cases. */
  dx: number;
  dy: number;
  /** Décalage en hauteur, en cases. */
  dh: number;
  /** L'orientation imposée par un geste ; `null` : celle du repos, par camp. */
  orientation: Orientation | null;
  /** Le clip logique demandé (`CLIPS`) ; `repos` par défaut. */
  clip: ClipSprite;
  /** Le temps de rendu où le clip a commencé : un clip qui ne boucle pas se lit depuis là. */
  clipDebut: number;
  /**
   * Le temps du clip imposé par le geste, en millisecondes, ou `null` pour le
   * lire à l'horloge depuis `clipDebut`. Une marche se cale sur le chemin
   * parcouru, un coup reçu tient sa première image pendant l'arrêt sur image.
   */
  clipTemps: number | null;
  /** Une teinte imposée par un geste (le bleu d'une impulsion), `null` sinon. */
  teinte: Rvb | null;
  /** Multiplicateur d'opacité : un geste qui fait apparaître ou sortir. */
  opacite: number;
  /** 0 rien, 1 blanc : l'éclat d'un coup reçu. */
  eclat: number;
  /** Agrandissement autour du pivot. */
  echelle: number;
  /** Les PV affichés retenus le temps d'un geste, ou `null` pour ceux de l'état. */
  pv: number | null;
  /** Le voile de la furtivité pendant un fondu (0 à 1), `null` hors fondu. */
  voile: number | null;
}

/** Un état visuel neutre : l'unité telle que l'état la dit. */
export function etatVisuelNeutre(): EtatVisuel2d {
  return {
    dx: 0, dy: 0, dh: 0, orientation: null, clip: 'repos', clipDebut: 0, clipTemps: null, teinte: null,
    opacite: 1, eclat: 0, echelle: 1, pv: null, voile: null,
  };
}

/**
 * Les états visuels, par identifiant, et les unités **retenues** à l'écran
 * après avoir quitté l'état — le temps de les voir sortir. C'est ce que se
 * partagent le calque et les animations.
 */
export class Visuels {
  private readonly visuels = new Map<string, EtatVisuel2d>();
  private readonly retenues = new Map<string, Unite>();

  /** L'état visuel modifiable d'une unité, créé neutre à la première demande. */
  visuel(id: string): EtatVisuel2d {
    let v = this.visuels.get(id);
    if (!v) {
      v = etatVisuelNeutre();
      this.visuels.set(id, v);
    }
    return v;
  }

  /** L'état visuel s'il existe, sans le créer. */
  lire(id: string): EtatVisuel2d | undefined {
    return this.visuels.get(id);
  }

  /**
   * Garde une unité à l'écran après sa disparition de l'état — ou pendant
   * qu'elle monte dans une cale. C'est une **copie** : sa case peut suivre un
   * geste (`poserRetenue`) sans toucher à l'état d'où elle vient.
   */
  retenir(u: Unite): void {
    if (!this.retenues.has(u.id)) this.retenues.set(u.id, { ...u });
  }

  /** L'unité retenue, telle qu'on la dessine. */
  retenue(id: string): Unite | undefined {
    return this.retenues.get(id);
  }

  /** Déplace une unité retenue : elle a fini de glisser, elle reste où elle est arrivée. */
  poserRetenue(id: string, c: { x: number; y: number }): void {
    const u = this.retenues.get(id);
    if (u) this.retenues.set(id, { ...u, x: c.x, y: c.y });
  }

  /** Relâche une unité retenue, et rend son état visuel neuf : un identifiant réutilisé ne naît pas à demi effacé. */
  liberer(id: string): void {
    this.retenues.delete(id);
    this.visuels.delete(id);
  }

  estRetenue(id: string): boolean {
    return this.retenues.has(id);
  }

  unitesRetenues(): IterableIterator<Unite> {
    return this.retenues.values();
  }

  /** Oublie tout : un saut à l'état final, un démontage. */
  vider(): void {
    this.visuels.clear();
    this.retenues.clear();
  }
}

/** Ce qu'un calque sait d'une animation choisie dans l'atlas. */
export interface AnimationChoisie {
  index: number;
  cadres: number;
  ips: number;
  boucle: boolean;
  /**
   * La vue que l'atlas a réellement trouvée, quand elle diffère de celle
   * demandée : `bas` et `haut` n'ont que la marche, et tout le reste y retombe
   * sur `droite` — que l'unité doit alors regarder du bon côté.
   */
  vue?: VueSprite;
}

/** Ce que les poses d'unités doivent savoir, hors de l'état. */
export interface OptionsPosesUnites {
  /** Le camp du joueur : c'est pour lui que ses furtives se voilent. `null` : toute furtive se voile. */
  camp: CampId | null;
  /** Les cases vues, `null` sans brouillard. */
  visibles: ReadonlySet<string> | null;
  /** Les unités vues (`unitesVues` du moteur), `null` ou absent : toutes. */
  unitesVues?: ReadonlySet<string> | null;
  /** Les marques du télégraphage, par unité. */
  marques?: ReadonlyMap<string, MarqueUnite> | null;
  /** L'unité sélectionnée : l'anneau se pose à ses pieds. */
  selection: string | null;
  /** La couleur d'équipe d'un camp. */
  equipe(camp: CampId): Rvb;
  /** L'entrée du manifeste d'une unité de ce camp (kit national ou base). */
  entree(type: CleUnite, camp: CampId): string;
  /** L'animation cuite d'une entrée pour une vue et un clip, `null` : repli. */
  animation(entree: string, vue: VueSprite, clip: ClipSprite): AnimationChoisie | null;
  /**
   * Vrai si cette image se dessinera **cuite** maintenant — sa page est
   * arrivée (`Atlas.estCuite`). Absent : une animation trouvée vaut une image
   * cuite. C'est ce qui décide de lever un appareil : son repli, oui ; son
   * image cuite, jamais.
   */
  cuite?(entree: string, animation: number, cadre: number): boolean;
  /** L'horloge de rendu, en millisecondes. */
  tempsMs: number;
  /** Animations réduites : rien ne respire. */
  reduit: boolean;
}

/** Ce que rendent les poses d'unités. */
export interface PosesUnites {
  poses: Pose[];
  /** Où chaque unité est dessinée, au sol en cases, et sa hauteur. */
  positions: Map<string, { x: number; y: number; h: number }>;
  /** Le pied de l'unité sélectionnée, au sol en cases, ou `null`. */
  selection: { x: number; y: number } | null;
  /** Vrai si un repos animé tourne : la boucle doit revenir, au pas de l'ambiance. */
  animees: boolean;
}

/** Une phase par unité, pour que deux fantassins ne respirent pas en même temps. */
export function phaseDe(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 997;
}

/** La vue cuite et le miroir d'une orientation. */
export function vueDe(o: Orientation): { vue: VueSprite; miroir: boolean } {
  switch (o) {
    case 'gauche': return { vue: 'droite', miroir: true };
    case 'bas': return { vue: 'bas', miroir: false };
    case 'haut': return { vue: 'haut', miroir: false };
    default: return { vue: 'droite', miroir: false };
  }
}

/** L'orientation de repos d'un camp : les deux armées se font face. */
export function orientationRepos(camp: CampId): Orientation {
  return camp === 0 ? 'droite' : 'gauche';
}

/**
 * Le miroir de l'image que l'atlas a **trouvée**. La cuisson ne photographie de
 * face et de dos que la marche : tout autre clip demandé dans ces vues retombe
 * sur `droite` (`choisirAnimation`), et l'unité regarde alors de son côté de
 * repos — le camp 0 vers la droite, les autres vers la gauche — plutôt que de
 * se retourner d'un coup, le temps d'un clip, parce qu'une image manque.
 */
export function miroirTrouve(orientation: Orientation, camp: CampId, vueTrouvee: VueSprite | undefined): boolean {
  const { vue, miroir } = vueDe(orientation);
  if (vueTrouvee === undefined || vueTrouvee === vue) return miroir;
  return vueTrouvee === 'droite' ? orientationRepos(camp) === 'gauche' : false;
}

/** L'orientation d'un pas de `de` vers `vers` : la plus longue composante l'emporte. */
export function orientationVers(dx: number, dy: number, defaut: Orientation): Orientation {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return defaut;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'droite' : 'gauche';
  return dy > 0 ? 'bas' : 'haut';
}

/** Vrai si l'unité a joué ce tour, au regard du camp qui joue. */
export function aJoue(u: Unite, etat: EtatPartie): boolean {
  return (u.etat === 'agi' || u.etat === 'produite') && u.camp === etat.campCourant;
}

/** L'opacité d'une unité : jouée, voilée, et ce qu'un geste y ajoute. */
export function opaciteUnite(u: Unite, etat: EtatPartie, v: EtatVisuel2d, camp: CampId | null): number {
  const voilable = camp === null || sontAllies(etat, u.camp, camp);
  const part = voilable ? (v.voile ?? (u.furtive === true ? 1 : 0)) : 0;
  const voile = part <= 0 ? 1 : part >= 1 ? OPACITE_FURTIVE : 1 - part * (1 - OPACITE_FURTIVE);
  return Math.min(aJoue(u, etat) ? OPACITE_JOUEE : 1, voile) * v.opacite;
}

/**
 * Les poses de toutes les unités dessinées : ombre (calque `ombres_unites`),
 * figurine, pastille et marque (calque `unites`, triées avec leur unité).
 */
export function posesUnites(etat: EtatPartie, cat: Catalogue, visuels: Visuels, o: OptionsPosesUnites): PosesUnites {
  const poses: Pose[] = [];
  const positions = new Map<string, { x: number; y: number; h: number }>();
  let selection: { x: number; y: number } | null = null;
  let animees = false;
  const dessinees = new Set<string>();
  // Une unité retenue se dessine telle qu'on l'a retenue — sortie de l'état, ou
  // montée dans une cale — et jamais une seconde fois telle que l'état la dit.
  const candidates: Unite[] = [];
  for (const u of etat.unites) if (!u.dansTransport && !visuels.estRetenue(u.id)) candidates.push(u);
  for (const u of visuels.unitesRetenues()) candidates.push(u);

  for (const u of candidates) {
    if (dessinees.has(u.id)) continue;
    const retenue = visuels.estRetenue(u.id);
    if (!retenue && o.visibles && !o.visibles.has(cleCase(u))) continue;
    if (!retenue && o.unitesVues && !o.unitesVues.has(u.id)) continue;
    const type = cat.unites[u.type];
    if (!type) continue;
    dessinees.add(u.id);
    const v = visuels.lire(u.id) ?? etatVisuelNeutre();
    const joue = aJoue(u, etat);
    const air = type.domaine === 'air';
    const gx = u.x + 0.5 + v.dx;
    const gy = u.y + 0.5 + v.dy;

    const orientation = v.orientation ?? orientationRepos(u.camp);
    const entree = o.entree(u.type, u.camp);
    const anim = o.animation(entree, vueDe(orientation).vue, v.clip);
    const miroir = miroirTrouve(orientation, u.camp, anim?.vue);
    let cadre = 0;
    if (anim) {
      if (v.clip !== 'repos') {
        cadre = cadreDe(anim, v.clipTemps ?? o.tempsMs - v.clipDebut);
      } else if (!joue && !o.reduit && anim.cadres > 1 && anim.boucle) {
        // Le repos respire à sa cadence, chaque unité à sa phase.
        cadre = cadreDe(anim, o.tempsMs + phaseDe(u.id) * 10);
        animees = true;
      }
    }
    // Un appareil **cuit** vole déjà dans son image ; seul son repli se soulève.
    // La pastille et la marque suivent le pivot de la figurine dessinée.
    const cuite = anim !== null && (o.cuite ? o.cuite(entree, anim.index, cadre) : true);
    const h = (air && !cuite ? HAUTEUR_VOL : 0) + v.dh;
    positions.set(u.id, { x: gx, y: gy, h });
    if (u.id === o.selection) selection = { x: gx, y: gy };
    const opacite = opaciteUnite(u, etat, v, o.camp);
    const equipe = o.equipe(u.camp);
    const taille = echelleTaille(type.silhouette.taille);

    const ombre: InstanceSprite = {
      entree: FORMES.ombre, animation: -1, cadre: 0,
      x: gx + OMBRE_UNITE.decalageX, y: gy + OMBRE_UNITE.decalageY,
      opacite: OMBRE_UNITE.opacite * opacite * (air ? OMBRE_VOL.opacite : 1),
      echelle: taille * (air ? OMBRE_VOL.echelle : 1),
    };
    poses.push({ calque: 'ombres_unites', ligne: gy, colonne: gx, instance: ombre });

    const figurine: InstanceSprite = {
      entree, animation: anim?.index ?? -1, cadre, x: gx, y: gy, h, miroir, equipe, opacite,
      eclat: v.eclat, echelle: v.echelle, ...(v.teinte ? { teinte: v.teinte } : {}),
    };
    poses.push({ calque: 'unites', ligne: gy, colonne: gx, instance: figurine });

    const pv = v.pv ?? pvAffiches(u.pv);
    if ((pv > 0 && pv < 10) || joue) {
      poses.push({
        calque: 'unites', ligne: gy, colonne: gx,
        instance: {
          entree: FORMES.pv(pv < 10 ? pv : 0, joue), animation: -1, cadre: 0,
          x: gx + 0.3, y: gy + 0.24, h, equipe, opacite: Math.max(opacite, 0.85),
        },
      });
    }
    const marque = o.marques?.get(u.id) ?? null;
    if (marque) {
      poses.push({
        calque: 'unites', ligne: gy, colonne: gx,
        instance: { entree: FORMES.marque(marque), animation: -1, cadre: 0, x: gx, y: gy, h: h + 1.02 },
      });
    }
  }
  return { poses, positions, selection, animees };
}

/** L'image d'une animation choisie au temps donné. */
function cadreDe(anim: AnimationChoisie, ms: number): number {
  return cadreAuTemps(anim.cadres, anim.ips, anim.boucle, ms);
}
