/**
 * La **vignette cuite** : une image d'une entrée du manifeste — une vue, un clip,
 * une image, une couleur d'équipe — peinte sur un canevas **2D**, sans WebGL.
 * L'aperçu du carnet (`app/campagne/journal/apercu-unite.tsx`) et la vitrine de
 * l'atelier (`app/atelier/unites/`) s'en servent ; le jeu, lui, passe par
 * l'atlas et le lot (`atlas.ts`, `lot.ts`).
 *
 * Pourquoi pas WebGL : un navigateur ne tient qu'une quinzaine de contextes, et
 * la vitrine montre une douzaine d'animations à la fois ; un canevas 2D n'en
 * ouvre aucun. Et une vignette ne se repeint qu'à chaque image **cuite** — cinq
 * à douze par seconde —, jamais à soixante : rien ici ne mérite un nuanceur.
 *
 * Ce qu'elle reproduit du jeu, exactement, et d'où :
 *
 * - la couleur d'équipe : `couleur × mix(1, équipe, masque)`, la formule du
 *   nuanceur du lot (`lot.ts`), sur les mêmes octets sRGB ; la couleur est celle
 *   que la peau choisit pour un camp seul (`couleurEquipe`, qui appelle la règle
 *   d'`equipes.ts` : la nation projetée dans la fenêtre lisible) ;
 * - le pivot : le point de contact au sol tombe où on le pose, à `echelle`
 *   pixels de plan par pixel d'image, et la gauche est la droite retournée
 *   autour de lui — le calcul d'`empaqueter` ;
 * - l'image du moment : `cadreAuTemps`, celle du jeu ;
 * - le kit : `idPour`, la variante nationale si elle est cuite, la base sinon ;
 * - le repli : quand l'entrée manque, ou tant que sa page n'est pas arrivée, le
 *   dessin de `replis.ts`, peint à la couleur d'équipe — la règle de l'atlas,
 *   « tout se joue sans aucune image cuite » ;
 * - l'ombre d'une unité, que la cuisson ne cuit pas (`OMBRE_UNITE`), et l'écume
 *   d'un navire à sa place (`ECUME_NAVIRE`) — la règle de `solSousUnite`.
 *
 * Ce qu'elle ne reproduit pas : la nuit (l'émission des fenêtres), le
 * brouillard, l'éclat d'un coup. Une vignette montre une pièce au grand jour.
 *
 * Les pages sont lues **une fois**, les images utiles en sont extraites (leurs
 * pixels et leur masque), puis la page est relâchée : une page d'unité fait un à
 * deux millions de pixels, et un carnet qu'on feuillette en garderait trente. Ce
 * qui reste — les images extraites, leurs versions teintes — est borné par un
 * plafond de pixels, la plus ancienne partant la première.
 *
 * Tout ce qui touche au réseau, au décodage et au canevas est **injecté**
 * (`DependancesVignettes`) : le module se teste sans navigateur
 * (`tests/render2d/vignette.test.ts`). Seul `LecteurVignettes`, qui cadence les
 * toiles d'une page, parle au DOM.
 */

import type { Catalogue } from '../engine/index';
import type { Pinceau } from '../render/sprites/formes';
import type { CampId, CleUnite, CodePays, Domaine } from '../schemas/types';
import {
  cadreAuTemps, chargerImageNavigateur, chargerManifeste, hexEquipe,
  type ChargeurImage, type PeintreRepli, type SourceImage,
} from './atlas';
import {
  CHEMIN_MANIFESTE, CLIPS, ECUME_NAVIRE, OMBRE_UNITE, PIXELS_PAR_CASE, SIN_TANGAGE, VUES,
  type AnimationSprite, type CadreSprite, type EntreeSprite, type FamilleSprite, type ManifesteSprites,
  type PageSprite,
} from './contrat';
import { couleurEquipeSeule, type Rvb } from './equipes';
import { creerPeintreRepli, fabriqueToileDocument, FORMES, identiteRepli, type FabriqueToile } from './replis';

// ---------------------------------------------------------------------------
// 1. La couleur, et la teinte
// ---------------------------------------------------------------------------

/**
 * La couleur d'équipe d'un camp, sRGB de 0 à 1 : la règle de la peau pour un
 * camp seul (`equipes.ts`, `couleurEquipeSeule`) — la nation projetée dans la
 * fenêtre lisible, la couleur du camp sans nation, le gris neutre sans camp.
 * Elle l'appelle, elle ne la recopie plus. Un bâtiment neutre reçoit ce gris et
 * non « aucune couleur » : cuites en blanc, ses zones d'équipe se liraient
 * blanches, là où la 3D laissait un albédo gris (`sprites-cuisson.md`).
 */
export function couleurEquipe(camp: CampId | null, pays?: CodePays | null): Rvb {
  return couleurEquipeSeule(camp, pays);
}

/**
 * Teint des pixels RGBA **non prémultipliés** (ceux d'un `getImageData`) par
 * un masque d'équipe : `rvb × mix(1, équipe, masque)`, l'alpha intact. C'est la
 * formule du nuanceur du lot, sur les mêmes octets : multiplier puis
 * prémultiplier, ou l'inverse, donne la même couleur.
 *
 * Le masque est lu un octet tous les `pas` : 1 pour un masque réduit à sa
 * valeur, 4 pour les pixels bruts d'un canevas (on lit leur rouge). Sans masque
 * ou sans couleur, les pixels sont rendus tels quels — dans une copie, jamais
 * l'original, qu'une autre couleur viendra reteindre.
 */
export function teindre(
  pixels: Uint8ClampedArray, masque: ArrayLike<number> | null, equipe: Rvb | null, pas = 1,
): Uint8ClampedArray {
  const sortie = new Uint8ClampedArray(pixels);
  if (!masque || !equipe) return sortie;
  const [er, ev, eb] = equipe;
  for (let i = 0, j = 0; i < sortie.length; i += 4, j += pas) {
    const m = (masque[j] ?? 0) / 255;
    if (m <= 0) continue;
    sortie[i] = (pixels[i] ?? 0) * (1 + m * (er - 1));
    sortie[i + 1] = (pixels[i + 1] ?? 0) * (1 + m * (ev - 1));
    sortie[i + 2] = (pixels[i + 2] ?? 0) * (1 + m * (eb - 1));
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// 2. Cadrer : où poser le pivot, à quelle échelle
// ---------------------------------------------------------------------------

/** Ce qu'une image occupe autour de son pivot, en pixels de plan. */
export interface Enveloppe {
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
}

/** Une image et son pivot, en pixels d'image : un cadre cuit ou un repli. */
export interface ImagePivot {
  l: number;
  h: number;
  px: number;
  py: number;
}

/**
 * L'enveloppe d'une image à `echelle` pixels de plan par pixel d'image,
 * retournée autour du pivot si `miroir` : la gauche d'une unité est sa droite
 * retournée, et son enveloppe aussi.
 */
export function enveloppeImage(img: ImagePivot, echelle: number, miroir = false): Enveloppe {
  const g = -img.px * echelle;
  const d = (img.l - img.px) * echelle;
  return {
    gauche: miroir ? -d : g,
    droite: miroir ? -g : d,
    haut: -img.py * echelle,
    bas: (img.h - img.py) * echelle,
  };
}

/** L'union d'enveloppes, `null` s'il n'y en a aucune. */
export function unirEnveloppes(liste: Iterable<Enveloppe>): Enveloppe | null {
  let u: Enveloppe | null = null;
  for (const e of liste) {
    u = u
      ? { gauche: Math.min(u.gauche, e.gauche), haut: Math.min(u.haut, e.haut), droite: Math.max(u.droite, e.droite), bas: Math.max(u.bas, e.bas) }
      : { ...e };
  }
  return u;
}

/**
 * L'enveloppe d'une animation entière : l'union de toutes ses images. C'est
 * elle qu'on cadre, et non l'image du moment — sans quoi le pivot bougerait
 * d'une image à l'autre et la figurine danserait sur place.
 */
export function enveloppeAnimation(anim: AnimationSprite, echelle: number, miroir = false): Enveloppe | null {
  return unirEnveloppes(anim.cadres.map((c) => enveloppeImage(c, echelle, miroir)));
}

/**
 * L'enveloppe d'une entrée entière, toutes vues et tous clips : une vitrine la
 * donne à chacune de ses toiles, pour que le pivot tombe au même endroit d'une
 * vue à l'autre et qu'on compare des images à la même échelle.
 */
export function enveloppeEntree(e: EntreeSprite, echelle: number, miroir = false): Enveloppe | null {
  const liste: Enveloppe[] = [];
  for (const a of e.animations) {
    const env = enveloppeAnimation(a, echelle, miroir);
    if (env) liste.push(env);
  }
  return unirEnveloppes(liste);
}

/** Où poser le pivot dans un cadre, en pixels du cadre, et combien de pixels du cadre vaut un pixel de plan. */
export interface Placement {
  x: number;
  y: number;
  k: number;
}

/** Comment cadrer : la marge, en pixels du cadre ; un zoom imposé, ou un plafond au zoom choisi. */
export interface OptionsPlacement {
  marge?: number;
  /** Pixels du cadre par pixel de plan, imposés : la vitrine compare des pièces à la même échelle. */
  zoom?: number;
  /** Le zoom qui remplit le cadre ne dépasse pas celui-ci : une petite pièce ne devient pas floue. */
  zoomMax?: number;
}

/**
 * Pose une enveloppe au centre d'un cadre de `largeur × hauteur`. Sans zoom
 * imposé, elle remplit le cadre moins sa marge ; avec, elle garde sa taille
 * et se centre — quitte à déborder, ce qui dit justement qu'elle est grande.
 */
export function placer(env: Enveloppe, largeur: number, hauteur: number, options: OptionsPlacement = {}): Placement {
  const marge = options.marge ?? 0;
  const l = Math.max(1e-6, env.droite - env.gauche);
  const h = Math.max(1e-6, env.bas - env.haut);
  const remplir = Math.min(Math.max(1, largeur - 2 * marge) / l, Math.max(1, hauteur - 2 * marge) / h);
  const k = options.zoom ?? Math.min(remplir, options.zoomMax ?? Number.POSITIVE_INFINITY);
  return {
    x: (largeur - l * k) / 2 - env.gauche * k,
    y: (hauteur - h * k) / 2 - env.haut * k,
    k,
  };
}

// ---------------------------------------------------------------------------
// 3. Lire le manifeste : quelle entrée, quelles animations, quelle image
// ---------------------------------------------------------------------------

/**
 * L'entrée d'une clé de jeu pour une variante — le kit national d'une unité, le
 * QG d'un pays, le rocher d'un biome : la variante si elle est cuite, sinon la
 * base commune, sinon `parDefaut`, le nom attendu, qui donnera un repli. C'est
 * la règle d'`Atlas.idPour`, que le jeu applique : jamais une image d'état.
 */
export function idPour(
  m: ManifesteSprites | null, famille: FamilleSprite, cle: string, variante: string | null | undefined, parDefaut: string,
): string {
  if (!m) return parDefaut;
  let base: string | null = null;
  for (const e of Object.values(m.entrees)) {
    if (e.famille !== famille || e.cle !== cle || e.etat !== undefined) continue;
    if (variante && e.variante === variante) return e.id;
    if (e.variante === undefined && base === null) base = e.id;
  }
  return base ?? parDefaut;
}

/** Une animation d'une entrée, avec son rang dans `EntreeSprite.animations`. */
export interface AnimationRangee {
  index: number;
  animation: AnimationSprite;
}

/**
 * Les animations d'une entrée dans l'ordre où on les montre : vue par vue
 * (`VUES`), clip par clip (`CLIPS`). La cuisson les range déjà ainsi, mais le
 * rendu les cherche par (vue, clip), jamais par rang : on ne s'y fie pas non plus.
 */
export function animationsOrdonnees(e: EntreeSprite): AnimationRangee[] {
  const rang = (a: AnimationSprite): number => VUES.indexOf(a.vue) * CLIPS.length + CLIPS.indexOf(a.clip);
  return e.animations.map((animation, index) => ({ index, animation }))
    .sort((a, b) => (rang(a.animation) - rang(b.animation)) || (a.index - b.index));
}

/** La pause, en millisecondes, avant qu'un clip qui ne boucle pas se rejoue. */
export const PAUSE_REJEU = 700;

/**
 * L'image d'une animation au temps `ms`, **rejouée** : une boucle tourne, et un
 * clip qui ne boucle pas — un tir, une capture — se rejoue après une pause sur
 * sa dernière image. En jeu, un tir ne passe qu'une fois ; dans une vitrine, un
 * tir qu'on ne verrait qu'une fois se manquerait.
 */
export function imageRejouee(nombre: number, ips: number, boucle: boolean, ms: number, pauseMs = PAUSE_REJEU): number {
  if (boucle || nombre <= 1 || !(ips > 0) || !Number.isFinite(ms)) return cadreAuTemps(nombre, ips, boucle, ms);
  const periode = (nombre / ips) * 1000 + Math.max(0, pauseMs);
  return cadreAuTemps(nombre, ips, false, ((ms % periode) + periode) % periode);
}

/** La clé d'une image dans sa page : deux animations qui partagent une image la partagent ici aussi. */
function cleImage(page: PageSprite, c: CadreSprite): string {
  return `${page.couleur}|${c.x},${c.y},${c.l},${c.h}`;
}

// ---------------------------------------------------------------------------
// 4. La réserve : pages lues, images extraites, teintes gardées
// ---------------------------------------------------------------------------

/** Une image prête à peindre : sa source, sa taille et son pivot en pixels d'image, sa densité. */
export interface ImagePrete extends ImagePivot {
  source: CanvasImageSource;
  /** Pixels de plan par pixel d'image. */
  echelle: number;
  /** Vrai pour un repli, peint par le code. */
  repli: boolean;
}

/** Ce que la réserve demande au monde. */
export interface DependancesVignettes {
  /** Charge une image sous `public/`, décodée (`chargerImageNavigateur` dans un navigateur). */
  charger: ChargeurImage;
  /** Une toile de travail où lire et écrire des pixels (`fabriqueToileDocument`). */
  fabrique: FabriqueToile;
  /** Le peintre des replis (`creerPeintreRepli`). */
  peintre: PeintreRepli;
  /** Le plafond de pixels gardés, compté à part pour les images extraites et pour leurs teintes. */
  plafondPixels?: number;
  /**
   * Le domaine d'une unité du catalogue, `null` si on ne la connaît pas : un
   * navire reçoit l'écume et non l'ombre, et la vignette le sait d'elle-même
   * (`Vignettes.flotte`) sans que chaque page ait à le lui dire. Absent : rien
   * ne flotte, sauf une piste qui le déclare (`PisteVignette.ombre.mer`).
   */
  domaine?(cle: CleUnite): Domaine | null;
}

/**
 * Le plafond par défaut : quatre millions de pixels, seize mégaoctets de chaque
 * côté. Une unité entière, toutes vues et tous clips, en fait un et demi : la
 * vitrine en garde deux ou trois, le carnet des dizaines de repos.
 */
export const PLAFOND_PIXELS = 4_000_000;

/** Une image extraite de sa page : ses pixels non prémultipliés, son masque réduit à sa valeur. */
interface ImageExtraite extends ImagePivot {
  pixels: Uint8ClampedArray;
  masque: Uint8Array | null;
}

/** Le rouge d'un tampon RGBA : la valeur d'un masque en niveaux de gris. */
function rouge(rvba: Uint8ClampedArray): Uint8Array {
  const r = new Uint8Array(rvba.length / 4);
  for (let i = 0; i < r.length; i += 1) r[i] = rvba[i * 4] ?? 0;
  return r;
}

/**
 * La réserve des vignettes d'une page : le manifeste, les images extraites de
 * leurs pages, leurs versions teintes, les replis. Une seule par page suffit —
 * un carnet qu'on rouvre retrouve ce qu'il avait lu.
 */
export class Vignettes {
  private m: ManifesteSprites | null = null;
  private readonly extraites = new Map<string, ImageExtraite>();
  private readonly teintes = new Map<string, ImagePrete>();
  private readonly replis = new Map<string, ImagePrete | null>();
  /** Les pages couleur introuvables : elles restent en repli, on ne les redemande pas. */
  private readonly echecs = new Set<string>();
  /** Les animations demandées et pas encore revenues. */
  private readonly demandees = new Set<string>();
  private readonly ecoutes = new Set<() => void>();
  /** Les pages se lisent l'une après l'autre : deux vignettes d'une même unité ne la téléchargent pas deux fois. */
  private file: Promise<unknown> = Promise.resolve();
  private pixelsExtraits = 0;
  private pixelsTeints = 0;
  private vivante = true;

  constructor(private readonly deps: DependancesVignettes) {}

  /** Pose le manifeste (ou `null` : tout en repli). Ce qui a été extrait reste. */
  poserManifeste(m: ManifesteSprites | null): void {
    this.m = m;
    this.signaler();
  }

  get manifeste(): ManifesteSprites | null {
    return this.m;
  }

  entree(id: string): EntreeSprite | null {
    return this.m?.entrees[id] ?? null;
  }

  idPour(famille: FamilleSprite, cle: string, variante: string | null | undefined, parDefaut: string): string {
    return idPour(this.m, famille, cle, variante, parDefaut);
  }

  /** Pixels de plan par pixel d'image cuite. */
  get echelle(): number {
    return PIXELS_PAR_CASE / (this.m?.pixelsParCase ?? PIXELS_PAR_CASE);
  }

  /** Prévient quand une image arrive ou que le manifeste change ; rend le désabonnement. */
  ecouter(f: () => void): () => void {
    this.ecoutes.add(f);
    return () => { this.ecoutes.delete(f); };
  }

  private signaler(): void {
    for (const f of [...this.ecoutes]) f();
  }

  /**
   * Lit les pages d'une entrée et en extrait les images des animations demandées
   * (toutes par défaut). Rend vrai si toutes sont là à la fin — faux pour une
   * entrée absente, une page introuvable, un canevas qui refuse ses pixels.
   */
  preparer(id: string, animations?: readonly number[]): Promise<boolean> {
    const e = this.entree(id);
    if (!e) return Promise.resolve(false);
    const travail = this.file.then(() => this.extraire(e, animations ?? e.animations.map((_, i) => i)));
    this.file = travail.catch(() => undefined);
    return travail.catch(() => false);
  }

  private async extraire(e: EntreeSprite, animations: readonly number[]): Promise<boolean> {
    // Les images qui manquent, rangées par page : une page ne se lit qu'une fois.
    const parPage = new Map<number, CadreSprite[]>();
    let manque = false;
    for (const i of animations) {
      for (const c of e.animations[i]?.cadres ?? []) {
        const page = e.pages[c.page];
        if (!page || this.echecs.has(page.couleur)) { manque = true; continue; }
        const cle = cleImage(page, c);
        if (this.extraites.has(cle)) continue;
        const liste = parPage.get(c.page) ?? [];
        if (!liste.some((x) => cleImage(page, x) === cle)) liste.push(c);
        parPage.set(c.page, liste);
      }
    }
    for (const [n, cadres] of parPage) {
      const page = e.pages[n];
      if (!page || !this.vivante) return false;
      const [couleur, masque] = await Promise.all([
        this.deps.charger(`/${page.couleur}`, { premultiplier: true }).catch(() => null),
        page.masque ? this.deps.charger(`/${page.masque}`, { premultiplier: false }).catch(() => null) : Promise.resolve(null),
      ]);
      try {
        if (!this.vivante) return false;
        if (!couleur) {
          this.echecs.add(page.couleur);
          manque = true;
          continue;
        }
        for (const c of cadres) {
          const pixels = this.lire(couleur, c);
          if (!pixels) { manque = true; continue; }
          const m = masque ? this.lire(masque, c) : null;
          this.garder(cleImage(page, c), { l: c.l, h: c.h, px: c.px, py: c.py, pixels, masque: m ? rouge(m) : null });
        }
      } finally {
        // La page est relâchée dès ses images lues : c'est elle qui pèse.
        couleur?.close?.();
        masque?.close?.();
      }
    }
    if (parPage.size > 0) this.signaler();
    return !manque;
  }

  /** Les pixels d'un rectangle d'une page, lus sur une toile de travail ; `null` si la toile refuse. */
  private lire(source: SourceImage, c: CadreSprite): Uint8ClampedArray | null {
    try {
      const t = this.deps.fabrique(c.l, c.h);
      if (!t) return null;
      t.g.clearRect(0, 0, c.l, c.h);
      t.g.drawImage(source as CanvasImageSource, c.x, c.y, c.l, c.h, 0, 0, c.l, c.h);
      return t.g.getImageData(0, 0, c.l, c.h).data;
    } catch {
      return null;
    }
  }

  private garder(cle: string, image: ImageExtraite): void {
    this.extraites.set(cle, image);
    this.pixelsExtraits += image.l * image.h;
    const plafond = this.deps.plafondPixels ?? PLAFOND_PIXELS;
    for (const [ancienne, img] of this.extraites) {
      if (this.pixelsExtraits <= plafond || this.extraites.size <= 1) break;
      if (ancienne === cle) continue;
      this.extraites.delete(ancienne);
      this.pixelsExtraits -= img.l * img.h;
    }
  }

  /**
   * L'image à peindre pour une animation d'une entrée, à une couleur d'équipe :
   * l'image cuite si elle est extraite ; sinon — et elle est alors demandée, une
   * fois — le repli de l'entrée. `null` quand il n'y a ni l'un ni l'autre.
   */
  image(id: string, animation: number, cadre: number, equipe: Rvb | null): ImagePrete | null {
    const e = this.entree(id);
    const anim = e && animation >= 0 ? e.animations[animation] : undefined;
    const c = anim ? (anim.cadres[cadre] ?? anim.cadres[0]) : undefined;
    const page = c && e ? e.pages[c.page] : undefined;
    if (c && page && !this.echecs.has(page.couleur)) {
      const cle = cleImage(page, c);
      const extraite = this.extraites.get(cle);
      if (extraite) {
        // Tenue à jour dans l'ordre d'usage : la plus ancienne part la première.
        this.extraites.delete(cle);
        this.extraites.set(cle, extraite);
        const teinte = this.teinte(cle, extraite, equipe);
        if (teinte) return teinte;
      } else {
        const demande = `${id}|${animation}`;
        if (!this.demandees.has(demande)) {
          this.demandees.add(demande);
          void this.preparer(id, [animation]).finally(() => { this.demandees.delete(demande); });
        }
      }
    }
    return this.repli(id, equipe);
  }

  /** La version teinte d'une image extraite : calculée une fois par couleur, gardée sous plafond. */
  private teinte(cle: string, ex: ImageExtraite, equipe: Rvb | null): ImagePrete | null {
    // Une image sans masque ne change pas de couleur : une seule version.
    const cleTeinte = `${cle}|${ex.masque && equipe ? hexEquipe(equipe) : 'nu'}`;
    const memo = this.teintes.get(cleTeinte);
    if (memo) {
      this.teintes.delete(cleTeinte);
      this.teintes.set(cleTeinte, memo);
      return memo;
    }
    try {
      const t = this.deps.fabrique(ex.l, ex.h);
      if (!t) return null;
      const donnees = t.g.createImageData(ex.l, ex.h);
      donnees.data.set(teindre(ex.pixels, ex.masque, equipe));
      t.g.putImageData(donnees, 0, 0);
      const pret: ImagePrete = {
        source: t.toile as CanvasImageSource, l: ex.l, h: ex.h, px: ex.px, py: ex.py, echelle: this.echelle, repli: false,
      };
      this.teintes.set(cleTeinte, pret);
      this.pixelsTeints += ex.l * ex.h;
      const plafond = this.deps.plafondPixels ?? PLAFOND_PIXELS;
      for (const [ancienne, img] of this.teintes) {
        if (this.pixelsTeints <= plafond || this.teintes.size <= 1) break;
        if (ancienne === cleTeinte) continue;
        this.teintes.delete(ancienne);
        this.pixelsTeints -= img.l * img.h;
      }
      return pret;
    } catch {
      return null;
    }
  }

  /** Le repli d'un identifiant à une couleur d'équipe, peint à la première demande. */
  repli(id: string, equipe: Rvb | null): ImagePrete | null {
    const cle = `${id}|${hexEquipe(equipe)}`;
    if (this.replis.has(cle)) return this.replis.get(cle) ?? null;
    let pret: ImagePrete | null = null;
    try {
      const p = this.deps.peintre.peindre(id, equipe);
      if (p) pret = { source: p.source as CanvasImageSource, l: p.l, h: p.h, px: p.px, py: p.py, echelle: p.echelle, repli: true };
    } catch {
      pret = null;
    }
    this.replis.set(cle, pret);
    return pret;
  }

  /** L'ombre qu'un rendu pose sous une unité : une forme du rendu, jamais cuite. */
  ombre(): ImagePrete | null {
    return this.repli(FORMES.ombre, null);
  }

  /** L'écume qu'un rendu pose sous un navire, à la place de l'ombre : une forme du rendu, elle aussi. */
  ecume(): ImagePrete | null {
    return this.repli(FORMES.ecume, null);
  }

  /**
   * Vrai si l'entrée — ou l'identifiant attendu, pour un repli — est une unité
   * qui **flotte** : le catalogue le dit (`DependancesVignettes.domaine`), la
   * vignette pose alors l'écume là où le jeu la pose.
   */
  flotte(id: string): boolean {
    if (!this.deps.domaine) return false;
    const e = this.entree(id);
    const identite = e ? null : identiteRepli(id);
    const cle = e ? (e.famille === 'unite' ? e.cle : null) : identite?.famille === 'unite' ? identite.cle : null;
    return cle !== null && this.deps.domaine(cle as CleUnite) === 'mer';
  }

  /** Oublie tout ce qui a été lu, extrait, teint ou peint. */
  vider(): void {
    this.extraites.clear();
    this.teintes.clear();
    this.replis.clear();
    this.echecs.clear();
    this.demandees.clear();
    this.pixelsExtraits = 0;
    this.pixelsTeints = 0;
  }

  /** Arrête tout : une page qui revient après ne se lit plus. */
  dispose(): void {
    this.vivante = false;
    this.ecoutes.clear();
    this.vider();
  }
}

// ---------------------------------------------------------------------------
// 5. Peindre
// ---------------------------------------------------------------------------

/**
 * Peint une image, son pivot en `(x, y)` pixels du canevas, à `k` pixels de
 * canevas par pixel de plan ; retournée autour du pivot si `miroir` — la règle
 * d'`empaqueter` : la gauche occupe `[pivot − (l − px), pivot + px]`.
 */
export function peindreImage(g: Pinceau, img: ImagePrete, x: number, y: number, k: number, miroir = false, opacite = 1): void {
  const s = img.echelle * k;
  g.save();
  g.globalAlpha = opacite;
  g.translate(x, y);
  if (miroir) g.scale(-1, 1);
  g.drawImage(img.source, -img.px * s, -img.py * s, img.l * s, img.h * s);
  g.restore();
}

/**
 * Ce que devient l'ombre d'un appareil, sous lui, sur la case : plus petite et
 * plus claire. Les chiffres de la peau (`unites.ts`, `OMBRE_VOL`), qui ne les
 * exporte pas encore.
 */
const OMBRE_VOL = { echelle: 0.8, opacite: 0.7 } as const;

/**
 * Peint l'ombre d'une unité sous son pivot (`OMBRE_UNITE`), comme la peau la
 * pose : décalée comme le serait celle de la lumière principale, à la taille
 * de la silhouette (`taille`, `echelleTaille`), plus petite et plus claire sous
 * un appareil.
 */
export function peindreOmbre(g: Pinceau, ombre: ImagePrete, x: number, y: number, k: number, taille = 1, air = false): void {
  const dx = OMBRE_UNITE.decalageX * PIXELS_PAR_CASE * k;
  const dy = OMBRE_UNITE.decalageY * PIXELS_PAR_CASE * SIN_TANGAGE * k;
  const echelle = taille * (air ? OMBRE_VOL.echelle : 1);
  peindreImage(g, ombre, x + dx, y + dy, k * echelle, false, OMBRE_UNITE.opacite * (air ? OMBRE_VOL.opacite : 1));
}

/**
 * Peint l'écume d'un navire sous son pivot (`ECUME_NAVIRE`), comme la peau la
 * pose à la place de l'ombre : centrée sur le pied, à la taille de la
 * silhouette. Une vignette montre une pièce au grand jour : pas de nuit ici.
 */
export function peindreEcume(g: Pinceau, ecume: ImagePrete, x: number, y: number, k: number, taille = 1): void {
  const dx = ECUME_NAVIRE.decalageX * PIXELS_PAR_CASE * k;
  const dy = ECUME_NAVIRE.decalageY * PIXELS_PAR_CASE * SIN_TANGAGE * k;
  peindreImage(g, ecume, x + dx, y + dy, k * taille, false, ECUME_NAVIRE.opacite);
}

// ---------------------------------------------------------------------------
// 6. Dans un navigateur : la réserve de la page, et le lecteur de ses toiles
// ---------------------------------------------------------------------------

let reserve: Vignettes | null = null;

/**
 * La réserve de la page, montée à la première demande : pages lues par
 * `fetch`, pixels lus sur des toiles du document, replis de `replis.ts`, et le
 * manifeste du jeu (`CHEMIN_MANIFESTE`), refusé net s'il n'est pas du bon
 * format — tout se montre alors en repli, comme en jeu.
 */
export function reserveNavigateur(doc: Document, catalogue: () => Catalogue | null): Vignettes {
  if (reserve) return reserve;
  const fabrique = fabriqueToileDocument(doc);
  const r = new Vignettes({
    charger: chargerImageNavigateur, fabrique, peintre: creerPeintreRepli(fabrique, catalogue),
    // Le catalogue de la page dit ce qui flotte : l'écume sous un navire, sans
    // que le carnet ni la vitrine aient à le déclarer piste par piste.
    domaine: (cle) => catalogue()?.unites[cle]?.domaine ?? null,
  });
  reserve = r;
  void chargerManifeste(CHEMIN_MANIFESTE).then((m) => { if (m) r.poserManifeste(m); });
  return r;
}

/** Une toile animée par le lecteur : ce qu'elle montre, et comment. */
export interface PisteVignette {
  toile: HTMLCanvasElement;
  /** L'entrée, ou l'identifiant attendu : absent du manifeste, il donne son repli. */
  id: string;
  /** L'animation dans l'entrée, `-1` : le repli seul. */
  animation: number;
  equipe: Rvb | null;
  miroir?: boolean;
  /**
   * L'ombre d'unité à poser sous le pivot ; absente : aucune. Sous un navire,
   * c'est l'écume qui se pose (`mer`, ou à défaut ce que la réserve sait de
   * l'entrée : `Vignettes.flotte`).
   */
  ombre?: { taille: number; air: boolean; mer?: boolean } | null;
  /** Pixels CSS par pixel de plan imposés ; absent : l'image remplit la toile. */
  zoom?: number;
  /**
   * L'enveloppe à cadrer, en pixels de plan, pour une image cuite ; absente :
   * celle de l'animation. Un repli se cadre toujours sur la sienne.
   */
  enveloppe?: Enveloppe | null;
  /** La marge autour de l'image, en pixels CSS, quand elle remplit la toile. */
  marge?: number;
  /** Appelée à chaque image peinte : l'index de l'image et ce qu'on a peint. */
  surImage?(image: number, peinte: ImagePrete | null): void;
}

/** Ce qu'une piste a peint la dernière fois : on ne repeint que ce qui change. */
interface EtatPiste {
  cle: string;
}

/**
 * Le **lecteur** : une seule boucle d'images pour toutes les toiles d'une page.
 * Chaque toile se repeint quand son image change, quand sa taille change ou
 * quand une image arrive — une vitrine de douze animations immobiles ne coûte
 * rien. Sous animations réduites, chaque toile montre la première image et
 * la boucle s'arrête.
 */
export class LecteurVignettes {
  private readonly pistes = new Map<PisteVignette, EtatPiste>();
  private image: number | null = null;
  private readonly debut = performance.now();
  private enLecture = true;
  /** L'instant où la lecture s'est arrêtée : une pause fige l'image du moment, elle ne revient pas au début. */
  private fige = 0;
  private readonly desabonner: () => void;
  /** Une toile qui change de taille se repeint, même quand plus rien ne s'anime. */
  private readonly observateur = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.salir()) : null;

  constructor(private readonly reserve: Vignettes, private reduit = false) {
    this.desabonner = reserve.ecouter(() => this.salir());
  }

  ajouter(piste: PisteVignette): () => void {
    this.pistes.set(piste, { cle: '' });
    this.observateur?.observe(piste.toile);
    this.salir();
    return () => {
      this.pistes.delete(piste);
      this.observateur?.unobserve(piste.toile);
    };
  }

  /** Une piste a changé (entrée, couleur, zoom…) : elle se repeint à la prochaine image. */
  salir(): void {
    for (const e of this.pistes.values()) e.cle = '';
    this.planifier();
  }

  /** Met en lecture ou en pause ; sous animations réduites, la lecture reste arrêtée sur la première image. */
  lire(actif: boolean): void {
    if (!actif && this.enLecture) this.fige = performance.now() - this.debut;
    this.enLecture = actif;
    this.salir();
  }

  reduire(reduit: boolean): void {
    this.reduit = reduit;
    this.salir();
  }

  private planifier(): void {
    if (this.image !== null || typeof requestAnimationFrame !== 'function') return;
    this.image = requestAnimationFrame(() => {
      this.image = null;
      this.tick();
    });
  }

  private tick(): void {
    const anime = this.enLecture && !this.reduit;
    const ms = anime ? performance.now() - this.debut : this.reduit ? 0 : this.fige;
    let encore = false;
    for (const [piste, etat] of this.pistes) {
      if (this.peindre(piste, etat, ms)) encore = true;
    }
    if (anime && encore) this.planifier();
  }

  /** Peint une piste si quelque chose a changé ; rend vrai si elle s'anime. */
  private peindre(p: PisteVignette, etat: EtatPiste, ms: number): boolean {
    const toile = p.toile;
    if (!toile.isConnected) return false;
    const ratio = Math.min(2, Math.max(1, toile.ownerDocument.defaultView?.devicePixelRatio ?? 1));
    const largeur = Math.max(1, Math.round(toile.clientWidth * ratio));
    const hauteur = Math.max(1, Math.round(toile.clientHeight * ratio));
    const entree = this.reserve.entree(p.id);
    const anim = entree && p.animation >= 0 ? entree.animations[p.animation] : undefined;
    const nombre = anim?.cadres.length ?? 1;
    const image = anim ? imageRejouee(nombre, anim.ips, anim.boucle, ms) : 0;
    const peinte = this.reserve.image(p.id, anim ? p.animation : -1, image, p.equipe);
    const cle = `${largeur}x${hauteur}|${image}|${peinte ? `${peinte.repli ? 'r' : 'c'}${peinte.l}x${peinte.h}` : '-'}`;
    if (cle !== etat.cle) {
      etat.cle = cle;
      if (toile.width !== largeur) toile.width = largeur;
      if (toile.height !== hauteur) toile.height = hauteur;
      const g = toile.getContext('2d');
      if (g) {
        g.clearRect(0, 0, largeur, hauteur);
        if (peinte) {
          // On cadre l'animation entière — ou l'enveloppe donnée, ou le repli —
          // pour que le pivot ne danse pas d'une image à l'autre.
          const env = (!peinte.repli ? p.enveloppe ?? (anim ? enveloppeAnimation(anim, peinte.echelle, p.miroir) : null) : null)
            ?? enveloppeImage(peinte, peinte.echelle, p.miroir);
          const place = placer(env, largeur, hauteur, {
            marge: (p.marge ?? 8) * ratio,
            ...(p.zoom !== undefined ? { zoom: p.zoom * ratio } : {}),
          });
          if (p.ombre) {
            // L'ombre sur la case, ou l'écume sous un navire : la règle de la peau.
            if (p.ombre.mer ?? this.reserve.flotte(p.id)) {
              const ecume = this.reserve.ecume();
              if (ecume) peindreEcume(g, ecume, place.x, place.y, place.k, p.ombre.taille);
            } else {
              const ombre = this.reserve.ombre();
              if (ombre) peindreOmbre(g, ombre, place.x, place.y, place.k, p.ombre.taille, p.ombre.air);
            }
          }
          peindreImage(g, peinte, place.x, place.y, place.k, p.miroir === true);
        }
      }
      p.surImage?.(image, peinte);
    }
    return nombre > 1;
  }

  dispose(): void {
    if (this.image !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.image);
    this.image = null;
    this.pistes.clear();
    this.observateur?.disconnect();
    this.desabonner();
  }
}
