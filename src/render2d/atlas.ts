/**
 * L'**atlas** : ce que la peau 2D sait des images cuites, et ce qu'elle dessine
 * quand elle ne les a pas.
 *
 * Trois responsabilités, et une seule règle qui les tient :
 *
 * 1. lire le **manifeste** (`CHEMIN_MANIFESTE`) et le refuser net s'il n'est pas
 *    de la version attendue ou de la projection du jeu — un manifeste deviné
 *    poserait chaque image à côté de sa case (`lireManifeste`, pur) ;
 * 2. charger **à la demande** les pages d'atlas des entrées qu'on dessine
 *    vraiment, jamais tout le catalogue au montage (`fetch`,
 *    `createImageBitmap`, puis une texture) ;
 * 3. peindre une **image de repli** pour toute entrée absente ou pas encore
 *    arrivée (`replis.ts`, depuis les silhouettes du HUD).
 *
 * La règle : **le jeu est entièrement jouable sans aucune image cuite**. Une
 * page qui n'est pas encore là ne retient pas l'image : on dessine le repli,
 * et la page remplace son repli à l'image qui suit son arrivée.
 *
 * Le repli a une différence qui compte : ses couleurs d'équipe sont **peintes**
 * dans l'image (une image par couleur), là où une image cuite les reçoit par
 * son masque. Il n'a donc jamais de masque, et le nuanceur ne le teint pas.
 *
 * Ce qui touche WebGL passe par un `Televerseur` injecté, ce qui touche le
 * réseau par un `ChargeurImage`, ce qui peint par un `PeintreRepli` : l'atlas se
 * teste sans navigateur (`tests/render2d/atlas.test.ts`).
 */

import {
  CLIPS, FAMILLES_SPRITE, PIXELS_PAR_CASE, TANGAGE_CARTE, VERSION_SPRITES, VUES,
  type AnimationSprite, type CadreSprite, type ClipSprite, type EntreeSprite, type InstanceSprite,
  type ManifesteSprites, type PageSprite, type VueSprite,
} from './contrat';

// ---------------------------------------------------------------------------
// 1. Le manifeste
// ---------------------------------------------------------------------------

/** Ce que rend la lecture d'un manifeste : accepté (avec ce qu'on a écarté), ou refusé et pourquoi. */
export type LectureManifeste =
  | { ok: true; manifeste: ManifesteSprites; ecartees: readonly string[] }
  | { ok: false; motif: string };

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const estChaine = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Un chemin de page : sous `public/`, sans barre initiale, sans remontée. */
function cheminSur(v: unknown): v is string {
  return estChaine(v) && !v.startsWith('/') && !v.includes('..') && !/^[a-z]+:/i.test(v);
}

function lirePage(brut: unknown): PageSprite | null {
  if (!estObjet(brut)) return null;
  const { couleur, masque, emission, largeur, hauteur } = brut;
  if (!cheminSur(couleur) || !estNombre(largeur) || !estNombre(hauteur) || largeur <= 0 || hauteur <= 0) return null;
  if (masque !== undefined && !cheminSur(masque)) return null;
  if (emission !== undefined && !cheminSur(emission)) return null;
  return {
    couleur, largeur, hauteur,
    ...(masque !== undefined ? { masque } : {}),
    ...(emission !== undefined ? { emission } : {}),
  };
}

function lireCadre(brut: unknown, pages: number): CadreSprite | null {
  if (!estObjet(brut)) return null;
  const { page, x, y, l, h, px, py } = brut;
  if (!estNombre(page) || !Number.isInteger(page) || page < 0 || page >= pages) return null;
  if (![x, y, l, h, px, py].every(estNombre)) return null;
  if ((l as number) <= 0 || (h as number) <= 0 || (x as number) < 0 || (y as number) < 0) return null;
  return { page, x: x as number, y: y as number, l: l as number, h: h as number, px: px as number, py: py as number };
}

function lireAnimation(brut: unknown, pages: readonly PageSprite[]): AnimationSprite | null {
  if (!estObjet(brut)) return null;
  const { vue, clip, boucle, ips, cadres } = brut;
  if (!(VUES as readonly unknown[]).includes(vue) || !(CLIPS as readonly unknown[]).includes(clip)) return null;
  if (typeof boucle !== 'boolean' || !estNombre(ips) || ips <= 0 || !Array.isArray(cadres) || cadres.length === 0) return null;
  const lus: CadreSprite[] = [];
  for (const c of cadres) {
    const cadre = lireCadre(c, pages.length);
    if (!cadre) return null;
    const page = pages[cadre.page];
    // Un rectangle qui sort de sa page lirait les pixels d'une autre image.
    if (!page || cadre.x + cadre.l > page.largeur || cadre.y + cadre.h > page.hauteur) return null;
    lus.push(cadre);
  }
  return { vue: vue as VueSprite, clip: clip as ClipSprite, boucle, ips, cadres: lus };
}

function lireEntree(cle: string, brut: unknown): EntreeSprite | null {
  if (!estObjet(brut)) return null;
  const { id, famille, cle: cleJeu, variante, source, pages, animations } = brut;
  if (id !== cle || !(FAMILLES_SPRITE as readonly unknown[]).includes(famille) || !estChaine(cleJeu)) return null;
  if (variante !== undefined && !estChaine(variante)) return null;
  if (!estObjet(source) || !estChaine(source['fichier']) || !estChaine(source['sha256'])) return null;
  if (!Array.isArray(pages) || pages.length === 0 || !Array.isArray(animations) || animations.length === 0) return null;
  const lues: PageSprite[] = [];
  for (const p of pages) {
    const page = lirePage(p);
    if (!page) return null;
    lues.push(page);
  }
  const anims: AnimationSprite[] = [];
  for (const a of animations) {
    const anim = lireAnimation(a, lues);
    if (!anim) return null;
    anims.push(anim);
  }
  return {
    id: cle, famille: famille as EntreeSprite['famille'], cle: cleJeu,
    ...(variante !== undefined ? { variante: variante as string } : {}),
    source: { fichier: source['fichier'] as string, sha256: source['sha256'] as string },
    pages: lues, animations: anims,
  };
}

/**
 * Lit un manifeste brut. **Refus net** d'une autre version, d'une autre
 * projection (tangage) ou d'une densité illisible : ce serait deviner, et une
 * image devinée tombe à côté de sa case. Une **entrée** mal formée, elle, est
 * écartée seule — une page de trop ne doit pas éteindre les trente autres —, et
 * son identifiant est rendu dans `ecartees` pour qu'on la voie.
 */
export function lireManifeste(brut: unknown): LectureManifeste {
  if (!estObjet(brut)) return { ok: false, motif: 'pas un objet' };
  if (brut['version'] !== VERSION_SPRITES) return { ok: false, motif: `version ${String(brut['version'])}, attendue ${VERSION_SPRITES}` };
  const { pixelsParCase, tangage, tangageProfil, entrees } = brut;
  if (!estNombre(pixelsParCase) || pixelsParCase <= 0) return { ok: false, motif: 'pixelsParCase illisible' };
  if (tangage !== TANGAGE_CARTE) return { ok: false, motif: `tangage ${String(tangage)}, attendu ${TANGAGE_CARTE}` };
  if (!estNombre(tangageProfil)) return { ok: false, motif: 'tangageProfil illisible' };
  if (!estObjet(entrees)) return { ok: false, motif: 'entrees illisibles' };
  const lues: Record<string, EntreeSprite> = {};
  const ecartees: string[] = [];
  for (const [cle, e] of Object.entries(entrees)) {
    const entree = lireEntree(cle, e);
    if (entree) lues[cle] = entree;
    else ecartees.push(cle);
  }
  return {
    ok: true,
    manifeste: { version: VERSION_SPRITES, pixelsParCase, tangage: TANGAGE_CARTE, tangageProfil, entrees: lues },
    ecartees,
  };
}

// ---------------------------------------------------------------------------
// 2. Choisir une animation, et l'image du moment
// ---------------------------------------------------------------------------

/**
 * L'animation d'une entrée pour une vue et un clip, ou `-1` si l'entrée n'en a
 * aucune. La cuisson ne rend que ce que le GLB porte (`CLIPS`, « aucun clip
 * n'est inventé ») : un clip absent retombe sur le repos de la même vue, une vue
 * absente sur la droite, et un bâtiment n'a que sa vue fixe.
 */
export function choisirAnimation(entree: EntreeSprite, vue: VueSprite, clip: ClipSprite): number {
  const a = entree.animations;
  const chercher = (v: VueSprite, c: ClipSprite | null): number =>
    a.findIndex((x) => x.vue === v && (c === null || x.clip === c));
  for (const [v, c] of [[vue, clip], [vue, 'repos'], ['droite', clip], ['droite', 'repos'], ['fixe', clip], ['fixe', 'repos']] as const) {
    const i = chercher(v, c);
    if (i >= 0) return i;
  }
  for (const v of [vue, 'droite', 'fixe'] as const) {
    const i = chercher(v, null);
    if (i >= 0) return i;
  }
  return a.length > 0 ? 0 : -1;
}

/**
 * L'image d'une animation de `nombre` images à `ips`, au temps `ms` depuis son
 * départ. Une boucle tourne ; un clip qui ne boucle pas s'arrête sur sa
 * dernière image.
 */
export function cadreAuTemps(nombre: number, ips: number, boucle: boolean, ms: number): number {
  if (nombre <= 1 || !Number.isFinite(ms) || !(ips > 0)) return 0;
  const i = Math.floor((Math.max(0, ms) * ips) / 1000);
  return boucle ? i % nombre : Math.min(nombre - 1, i);
}

// ---------------------------------------------------------------------------
// 3. Le rangement des replis
// ---------------------------------------------------------------------------

/**
 * Un rangement par **étagères** : chaque image se pose à droite de la
 * précédente sur l'étagère courante, et une étagère neuve s'ouvre dessous
 * quand la place manque. Pas optimal, mais sans retour arrière ni tri, ce qui
 * convient à des replis qui arrivent un par un au fil des images. Une marge
 * sépare deux images : sans elle, les mipmaps de l'une baveraient sur l'autre.
 */
export class Etageres {
  private x = 0;
  private y = 0;
  private hauteurEtagere = 0;

  constructor(readonly largeur: number, readonly hauteur: number, readonly marge = 4) {}

  /** La place d'une image de `l × h`, ou `null` si la page est pleine. */
  placer(l: number, h: number): { x: number; y: number } | null {
    const lm = Math.ceil(l) + this.marge;
    const hm = Math.ceil(h) + this.marge;
    if (lm > this.largeur || hm > this.hauteur) return null;
    if (this.x + lm > this.largeur) {
      this.y += this.hauteurEtagere;
      this.x = 0;
      this.hauteurEtagere = 0;
    }
    if (this.y + hm > this.hauteur) return null;
    const place = { x: this.x, y: this.y };
    this.x += lm;
    this.hauteurEtagere = Math.max(this.hauteurEtagere, hm);
    return place;
  }
}

// ---------------------------------------------------------------------------
// 4. L'atlas
// ---------------------------------------------------------------------------

/** Une source d'image qu'on sait téléverser, et relâcher si elle le permet. */
export type SourceImage = TexImageSource & { close?(): void };

/** Les textures d'une page : ce que le lot lie avant un appel de dessin. */
export interface TexturesPage {
  couleur: WebGLTexture;
  masque: WebGLTexture | null;
  emission: WebGLTexture | null;
}

/** Une image prête à poser : ses textures, son rectangle, son pivot, sa densité. */
export interface CadreResolu {
  textures: TexturesPage;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Taille et pivot en pixels d'image. */
  l: number;
  h: number;
  px: number;
  py: number;
  /** Pixels de plan par pixel d'image. */
  echelle: number;
  /** Vrai si l'image porte un masque d'équipe : seule une image cuite en a un. */
  masque: boolean;
  /** Vrai si l'image porte des lumières propres (fenêtres), ajoutées la nuit. */
  emission: boolean;
  /** Vrai pour une image de repli, peinte par le code. */
  repli: boolean;
}

/** Ce que l'atlas demande à WebGL. */
export interface Televerseur {
  /** Crée une texture de `largeur × hauteur`, remplie par `source` ou vide. */
  creer(source: SourceImage | null, largeur: number, hauteur: number, options: OptionsTexture): WebGLTexture;
  /** Pose `source` dans la texture au point `(x, y)`, puis refait ses mipmaps. */
  poser(texture: WebGLTexture, x: number, y: number, source: SourceImage, options: OptionsTexture): void;
  supprimer(texture: WebGLTexture): void;
}

/** Comment téléverser : prémultiplier l'alpha (couleur, émission) ou non (masque). */
export interface OptionsTexture {
  premultiplier: boolean;
}

/** Va chercher une image sous `public/`, déjà décodée. */
export type ChargeurImage = (chemin: string, options: OptionsTexture) => Promise<SourceImage>;

/** Une image de repli peinte : sa source, sa taille et son pivot en pixels d'image, sa densité. */
export interface ReplisPeint {
  source: SourceImage;
  l: number;
  h: number;
  px: number;
  py: number;
  echelle: number;
}

/** Ce qui peint un repli d'après son identifiant et sa couleur d'équipe ; `null` s'il n'y en a pas. */
export interface PeintreRepli {
  peindre(id: string, equipe: readonly [number, number, number] | null): ReplisPeint | null;
}

/** Ce que l'atlas doit savoir pour vivre. */
export interface DependancesAtlas {
  televerseur: Televerseur;
  charger: ChargeurImage;
  peintre: PeintreRepli;
  /** Une page vient d'arriver : l'image est à refaire. */
  surArrivee?(): void;
  /** Côté d'une page de replis, en pixels. */
  coteRepli?: number;
}

/** Le côté d'une page de replis : 4 Mo de mémoire graphique, une vingtaine d'unités. */
export const COTE_PAGE_REPLI = 1024;

/** Ce que le chargement d'une page sait d'elle. */
type EtatPage =
  | { etat: 'attente' }
  | { etat: 'prete'; textures: TexturesPage }
  | { etat: 'echec' };

/** Une page de replis : sa texture et son rangement. */
interface PageRepli { texture: WebGLTexture; etageres: Etageres; textures: TexturesPage }

/** L'hexadécimal d'une couleur d'équipe : la clé d'un repli. */
export function hexEquipe(c: readonly [number, number, number] | null | undefined): string {
  if (!c) return 'blanc';
  const o = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  return `${o(c[0])}${o(c[1])}${o(c[2])}`;
}

/** L'atlas : manifeste, pages chargées à la demande, replis peints. */
export class Atlas {
  private manifeste: ManifesteSprites | null = null;
  private readonly pages = new Map<string, EtatPage>();
  private readonly replis = new Map<string, CadreResolu | null>();
  private pagesRepli: PageRepli[] = [];
  private vivant = true;
  /** Les pages demandées au réseau et pas encore revenues. */
  private enVol = 0;
  /** Les entrées par famille, clé de jeu et variante : `unite|char_leger|fr`. */
  private readonly index = new Map<string, string>();

  constructor(private readonly deps: DependancesAtlas) {}

  /** Pose le manifeste (ou `null` : tout en repli). Les pages déjà chargées restent. */
  poserManifeste(m: ManifesteSprites | null): void {
    this.manifeste = m;
    this.index.clear();
    for (const e of Object.values(m?.entrees ?? {})) {
      const cle = `${e.famille}|${e.cle}|${e.variante ?? ''}`;
      if (!this.index.has(cle)) this.index.set(cle, e.id);
    }
  }

  /**
   * L'entrée d'une clé de jeu pour une variante — le kit national d'une unité,
   * le QG d'un pays : la variante si elle est cuite, sinon la base commune,
   * sinon `parDefaut`, le nom attendu, qui donnera un repli.
   */
  idPour(famille: EntreeSprite['famille'], cle: string, variante: string | null, parDefaut: string): string {
    if (variante) {
      const v = this.index.get(`${famille}|${cle}|${variante}`);
      if (v) return v;
    }
    return this.index.get(`${famille}|${cle}|`) ?? parDefaut;
  }

  get aManifeste(): boolean {
    return this.manifeste !== null;
  }

  /** L'entrée d'un identifiant, ou `null`. */
  entree(id: string): EntreeSprite | null {
    return this.manifeste?.entrees[id] ?? null;
  }

  /** L'index de l'animation d'une entrée pour une vue et un clip, `-1` sans entrée. */
  animation(id: string, vue: VueSprite, clip: ClipSprite): number {
    const e = this.entree(id);
    return e ? choisirAnimation(e, vue, clip) : -1;
  }

  /** Combien de pages sont demandées et pas encore arrivées. */
  get chargements(): number {
    return this.enVol;
  }

  /** Combien de replis ont été peints. */
  get nombreReplis(): number {
    return this.replis.size;
  }

  /**
   * L'image à poser pour une instance : le cadre cuit si sa page est là, sinon
   * — et la page est alors demandée, une seule fois — le repli de l'entrée.
   * `null` quand il n'y a ni l'un ni l'autre : l'instance ne se dessine pas.
   */
  resoudre(inst: InstanceSprite): CadreResolu | null {
    const m = this.manifeste;
    const e = m?.entrees[inst.entree];
    if (m && e && inst.animation >= 0) {
      const anim = e.animations[inst.animation];
      const c = anim ? (anim.cadres[inst.cadre] ?? anim.cadres[0]) : undefined;
      const page = c ? e.pages[c.page] : undefined;
      if (c && page) {
        const textures = this.page(page);
        if (textures) {
          return {
            textures,
            u0: c.x / page.largeur,
            v0: c.y / page.hauteur,
            u1: (c.x + c.l) / page.largeur,
            v1: (c.y + c.h) / page.hauteur,
            l: c.l,
            h: c.h,
            px: c.px,
            py: c.py,
            echelle: PIXELS_PAR_CASE / m.pixelsParCase,
            masque: textures.masque !== null,
            emission: textures.emission !== null,
            repli: false,
          };
        }
      }
    }
    return this.repli(inst.entree, inst.equipe ?? null);
  }

  /** Les textures d'une page si elle est là ; sinon elle est demandée, et c'est `null`. */
  private page(page: PageSprite): TexturesPage | null {
    const connue = this.pages.get(page.couleur);
    if (connue) return connue.etat === 'prete' ? connue.textures : null;
    this.pages.set(page.couleur, { etat: 'attente' });
    this.enVol += 1;
    void this.chargerPage(page);
    return null;
  }

  private async chargerPage(page: PageSprite): Promise<void> {
    const { charger, televerseur } = this.deps;
    const lire = (chemin: string | undefined, premultiplier: boolean): Promise<SourceImage | null> => (
      chemin === undefined ? Promise.resolve(null) : charger(`/${chemin}`, { premultiplier }).catch(() => null)
    );
    // Les trois fichiers en même temps. Le masque se lit **sans** prémultiplier :
    // c'est un niveau de gris, pas une couleur.
    const [couleur, masque, emission] = await Promise.all([
      lire(page.couleur, true), lire(page.masque, false), lire(page.emission, true),
    ]);
    this.enVol = Math.max(0, this.enVol - 1);
    const relacher = (): void => { for (const s of [couleur, masque, emission]) s?.close?.(); };
    // Une page arrivée après le démontage, ou après une perte de contexte qui a
    // vidé la table, ne se téléverse pas dans un contexte qui n'est plus le sien.
    if (!this.vivant || this.pages.get(page.couleur)?.etat !== 'attente') { relacher(); return; }
    if (!couleur) {
      // Une page introuvable reste en repli pour la partie : la redemander à
      // chaque image ferait un appel réseau par image.
      this.pages.set(page.couleur, { etat: 'echec' });
      relacher();
      return;
    }
    try {
      const creer = (s: SourceImage, premultiplier: boolean): WebGLTexture =>
        televerseur.creer(s, page.largeur, page.hauteur, { premultiplier });
      const textures: TexturesPage = {
        couleur: creer(couleur, true),
        masque: masque ? creer(masque, false) : null,
        emission: emission ? creer(emission, true) : null,
      };
      this.pages.set(page.couleur, { etat: 'prete', textures });
    } catch {
      this.pages.set(page.couleur, { etat: 'echec' });
    } finally {
      relacher();
    }
    this.deps.surArrivee?.();
  }

  /** Le repli d'une entrée pour une couleur d'équipe, peint à la première demande. */
  private repli(id: string, equipe: readonly [number, number, number] | null): CadreResolu | null {
    const cle = `${id}|${hexEquipe(equipe)}`;
    if (this.replis.has(cle)) return this.replis.get(cle) ?? null;
    let cadre: CadreResolu | null = null;
    try {
      const peint = this.deps.peintre.peindre(id, equipe);
      cadre = peint ? this.ranger(peint) : null;
    } catch {
      cadre = null;
    }
    this.replis.set(cle, cadre);
    return cadre;
  }

  /** Range un repli peint dans une page de replis, en ouvrant une page si besoin. */
  private ranger(peint: ReplisPeint): CadreResolu | null {
    const cote = this.deps.coteRepli ?? COTE_PAGE_REPLI;
    let page = this.pagesRepli[this.pagesRepli.length - 1];
    let place = page?.etageres.placer(peint.l, peint.h) ?? null;
    if (!place) {
      const texture = this.deps.televerseur.creer(null, cote, cote, { premultiplier: true });
      page = { texture, etageres: new Etageres(cote, cote), textures: { couleur: texture, masque: null, emission: null } };
      this.pagesRepli.push(page);
      place = page.etageres.placer(peint.l, peint.h);
    }
    if (!page || !place) {
      peint.source.close?.();
      return null;
    }
    this.deps.televerseur.poser(page.texture, place.x, place.y, peint.source, { premultiplier: true });
    peint.source.close?.();
    return {
      textures: page.textures,
      u0: place.x / cote,
      v0: place.y / cote,
      u1: (place.x + peint.l) / cote,
      v1: (place.y + peint.h) / cote,
      l: peint.l,
      h: peint.h,
      px: peint.px,
      py: peint.py,
      echelle: peint.echelle,
      masque: false,
      emission: false,
      repli: true,
    };
  }

  /**
   * Le contexte est perdu : toute texture est morte avec lui. On oublie tout —
   * pages et replis se referont à la demande sur le contexte rendu, les pages
   * depuis le cache HTTP du navigateur.
   */
  perdre(): void {
    this.pages.clear();
    this.replis.clear();
    this.pagesRepli = [];
    this.enVol = 0;
  }

  /** Rend la mémoire graphique. */
  dispose(): void {
    this.vivant = false;
    const { televerseur } = this.deps;
    for (const p of this.pages.values()) {
      if (p.etat !== 'prete') continue;
      televerseur.supprimer(p.textures.couleur);
      if (p.textures.masque) televerseur.supprimer(p.textures.masque);
      if (p.textures.emission) televerseur.supprimer(p.textures.emission);
    }
    for (const p of this.pagesRepli) televerseur.supprimer(p.texture);
    this.perdre();
  }
}

// ---------------------------------------------------------------------------
// 5. Le chargement réel : réseau, décodage, WebGL
// ---------------------------------------------------------------------------

/**
 * Le manifeste du dossier public, lu et vérifié. `null` s'il n'existe pas ou
 * s'il est refusé — c'est un état normal : le jeu se joue alors tout en replis.
 * Un refus se dit une fois dans la console, un manifeste absent se tait.
 */
export async function chargerManifeste(chemin: string): Promise<ManifesteSprites | null> {
  try {
    const reponse = await fetch(chemin, { cache: 'no-cache' });
    if (!reponse.ok) return null;
    const lu = lireManifeste(await reponse.json());
    if (!lu.ok) {
      console.warn(`Manifeste des sprites refusé : ${lu.motif}`);
      return null;
    }
    if (lu.ecartees.length > 0) console.warn(`Manifeste des sprites : entrées écartées ${lu.ecartees.join(', ')}`);
    return lu.manifeste;
  } catch {
    return null;
  }
}

/**
 * Charge une image : `fetch`, puis `createImageBitmap` en demandant l'alpha
 * prémultiplié — une `ImageBitmap` ignore les réglages de téléversement de
 * WebGL, c'est donc au décodage qu'il se choisit. Un navigateur qui refuse les
 * options retombe sur un élément `<img>`, que WebGL prémultiplie lui-même.
 */
export const chargerImageNavigateur: ChargeurImage = async (chemin, options) => {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`${chemin} : ${reponse.status}`);
  const blob = await reponse.blob();
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, {
        premultiplyAlpha: options.premultiplier ? 'premultiply' : 'none',
        colorSpaceConversion: 'none',
      });
    } catch {
      // Les options refusées : on passe par une image.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Le téléverseur réel : une texture par page, mipmaps comprises. */
export function televerseurWebGl(gl: WebGL2RenderingContext): Televerseur {
  const reglerDepot = (options: OptionsTexture): void => {
    // Sans effet sur une `ImageBitmap` (décodée prémultipliée) ; décisif pour
    // une toile ou une `<img>`.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, options.premultiplier);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  };
  const regler = (): void => {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Des mipmaps : une carte vue de loin scintillerait à chaque glisser.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  };
  return {
    creer(source, largeur, hauteur, options): WebGLTexture {
      const t = gl.createTexture();
      if (!t) throw new Error('Texture impossible à créer (contexte perdu ?)');
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      reglerDepot(options);
      if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, largeur, hauteur, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      regler();
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      return t;
    },
    poser(texture, x, y, source, options): void {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      reglerDepot(options);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    },
    supprimer(texture): void {
      gl.deleteTexture(texture);
    },
  };
}
