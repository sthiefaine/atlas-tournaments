/**
 * Le **pinceau SVG** : la même surface d'appel qu'un contexte 2D de canvas, mais
 * qui, au lieu de peindre des pixels, enregistre les tracés et rend des balises.
 *
 * Pourquoi : tout le dessin vectoriel des figurines vit dans `silhouettes.ts`,
 * écrit pour un canvas. Redessiner les mêmes unités une seconde fois en SVG, à la
 * main, ferait deux dessins à tenir d'accord — et le second dériverait au premier
 * module ajouté au catalogue. On garde donc **un seul dessin** et on change de
 * pinceau. Rien ici ne touche au DOM : cela tourne sous Node, dans un test.
 *
 * Trois partis pris de forme, tous assumés :
 *
 * - **Les transformations sont cuites dans les coordonnées**, jamais rendues en
 *   attribut `transform`. Un `<path>` déjà exprimé dans le repère du monde se
 *   compose, se mesure et se compare sans qu'il faille interpréter une matrice.
 * - **Les arcs sont échantillonnés en segments de droite**, `SEGMENTS_PAR_TOUR`
 *   par tour complet. Une matrice affine quelconque change un cercle en ellipse
 *   tournée, et l'écrire exactement en commande `A` demande de décomposer la
 *   matrice ; l'exactitude analytique n'apporterait rien puisqu'à 96 pixels de
 *   large un segment tous les 7,5° ne se voit pas. C'est une approximation, et
 *   c'est la seule du fichier avec l'épaisseur de trait ci-dessous.
 * - **Les identifiants de `<defs>` sont numérotés**, jamais tirés au sort ni
 *   datés : deux rendus du même dessin doivent donner deux chaînes identiques au
 *   caractère près, c'est ce qu'un test compare.
 */

import type { Pinceau } from './formes';

/** Options de construction du pinceau. */
export interface OptionsPinceauSvg {
  /** Préfixe des `id` engendrés dans les `<defs>`. */
  prefixeId?: string;
}

/** Matrice affine `[a, b, c, d, e, f]`, dans la convention du contexte 2D. */
type Matrice = readonly [number, number, number, number, number, number];

const IDENTITE: Matrice = [1, 0, 0, 1, 0, 0];

/** Plafond de segments par tour complet lors de l'échantillonnage d'un arc. */
const SEGMENTS_PAR_TOUR = 48;
/** Plancher : sous six côtés, un disque cesse d'être rond, même minuscule. */
const SEGMENTS_MINIMUM = 6;
/**
 * Écart maximal toléré entre l'arc vrai et sa corde, en unités du dessin.
 *
 * C'est ce seuil qui règle le **poids** du fichier, et il vaut d'être expliqué :
 * à pas fixe, un rivet de deux unités de rayon recevait autant de segments
 * qu'une coque de vingt, et une figurine pesait vingt-huit kilo-octets de
 * balises pour un dessin de quarante-huit unités de côté. Le nombre de segments
 * suit désormais le rayon **une fois la matrice appliquée** : c'est ce que l'œil
 * voit, pas ce que le code a écrit.
 */
const ECART_CORDE = 0.12;

const TOUR = Math.PI * 2;

/**
 * Deux décimales au plus, sans zéro final : `12.5`, `12`, jamais `12.50`. Une
 * valeur non finie rend `0` plutôt que `NaN` : un `NaN` dans un attribut fait
 * disparaître la balise entière sans un mot, alors qu'un zéro se voit.
 */
function nb(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v * 100) / 100);
}

/**
 * Échappe une valeur d'attribut. Les couleurs viennent du code du jeu, mais une
 * chaîne qui traverse sans contrôle finit un jour par porter un guillemet.
 */
function echapper(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Angle balayé par un arc, dans la sémantique du canvas : un tour entier quand
 * les bornes en couvrent au moins un, le reste ramené dans un tour sinon.
 */
function balayageDe(depart: number, arrivee: number, antihoraire: boolean): number {
  if (!antihoraire) {
    if (arrivee - depart >= TOUR) return TOUR;
    const d = (arrivee - depart) % TOUR;
    return d < 0 ? d + TOUR : d;
  }
  if (depart - arrivee >= TOUR) return -TOUR;
  const d = (depart - arrivee) % TOUR;
  return -(d < 0 ? d + TOUR : d);
}

/** Ramène un écart d'angle dans `]-π, π]`. */
function auPlusCourt(angle: number): number {
  let a = angle;
  while (a <= -Math.PI) a += TOUR;
  while (a > Math.PI) a -= TOUR;
  return a;
}

/** Le dégradé rendu par `createLinearGradient`, posable en `fillStyle`. */
export class DegradeSvg {
  private readonly paliers: { offset: number; couleur: string }[] = [];

  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly x1: number,
    readonly y1: number,
  ) {}

  addColorStop(offset: number, couleur: string): void {
    this.paliers.push({ offset, couleur });
  }

  /** Les `<stop>` du dégradé, dans l'ordre de pose. */
  balisesPaliers(): string {
    return this.paliers
      .map((p) => `<stop offset="${nb(p.offset)}" stop-color="${echapper(p.couleur)}"/>`)
      .join('');
  }
}

/** L'état de dessin qu'un `save()` met de côté : matrice et styles, jamais le tracé. */
interface EtatDessin {
  matrice: Matrice;
  fillStyle: string | DegradeSvg;
  strokeStyle: string | DegradeSvg;
  lineWidth: number;
  lineCap: CanvasLineCap;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
}

export class PinceauSvg {
  fillStyle: string | DegradeSvg = '#000000';

  strokeStyle: string | DegradeSvg = '#000000';

  lineWidth = 1;

  lineCap: CanvasLineCap = 'butt';

  shadowColor = 'transparent';

  shadowBlur = 0;

  shadowOffsetY = 0;

  private matrice: Matrice = IDENTITE;

  private readonly pile: EtatDessin[] = [];

  private readonly balises: string[] = [];

  private readonly definitions: string[] = [];

  private readonly idsParDefinition = new Map<string, string>();

  private readonly prefixe: string;

  private compteur = 0;

  /** Le tracé en cours, déjà exprimé dans le repère du monde. */
  private chemin: string[] = [];

  /** Le point courant, lui **non transformé** : `arcTo` raisonne en repère local. */
  private point: { x: number; y: number } | null = null;

  /** Départ de la sous-figure courante, où `closePath` ramène. */
  private depart: { x: number; y: number } | null = null;

  constructor(options: OptionsPinceauSvg = {}) {
    this.prefixe = options.prefixeId ?? 'ps';
  }

  // -------------------------------------------------------------------------
  // Transformations
  // -------------------------------------------------------------------------

  save(): void {
    this.pile.push({
      matrice: this.matrice,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineCap: this.lineCap,
      shadowColor: this.shadowColor,
      shadowBlur: this.shadowBlur,
      shadowOffsetY: this.shadowOffsetY,
    });
  }

  restore(): void {
    const etat = this.pile.pop();
    if (!etat) return;
    this.matrice = etat.matrice;
    this.fillStyle = etat.fillStyle;
    this.strokeStyle = etat.strokeStyle;
    this.lineWidth = etat.lineWidth;
    this.lineCap = etat.lineCap;
    this.shadowColor = etat.shadowColor;
    this.shadowBlur = etat.shadowBlur;
    this.shadowOffsetY = etat.shadowOffsetY;
  }

  translate(x: number, y: number): void {
    this.composer([1, 0, 0, 1, x, y]);
  }

  rotate(angle: number): void {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    this.composer([c, s, -s, c, 0, 0]);
  }

  scale(sx: number, sy: number): void {
    this.composer([sx, 0, 0, sy, 0, 0]);
  }

  // -------------------------------------------------------------------------
  // Tracé
  // -------------------------------------------------------------------------

  beginPath(): void {
    this.chemin = [];
    this.point = null;
    this.depart = null;
  }

  moveTo(x: number, y: number): void {
    const [mx, my] = this.versMonde(x, y);
    this.chemin.push(`M ${nb(mx)} ${nb(my)}`);
    this.point = { x, y };
    this.depart = { x, y };
  }

  lineTo(x: number, y: number): void {
    if (!this.point) {
      this.moveTo(x, y);
      return;
    }
    const [mx, my] = this.versMonde(x, y);
    this.chemin.push(`L ${nb(mx)} ${nb(my)}`);
    this.point = { x, y };
  }

  closePath(): void {
    if (!this.depart) return;
    this.chemin.push('Z');
    // Le canvas repart du premier point de la sous-figure qu'il vient de fermer.
    this.point = { x: this.depart.x, y: this.depart.y };
  }

  arc(x: number, y: number, r: number, a0: number, a1: number, antihoraire = false): void {
    this.ellipse(x, y, r, r, 0, a0, a1, antihoraire);
  }

  ellipse(
    x: number, y: number, rx: number, ry: number, rotation: number,
    a0: number, a1: number, antihoraire = false,
  ): void {
    this.poserArc(x, y, Math.max(0, rx), Math.max(0, ry), rotation, a0, balayageDe(a0, a1, antihoraire));
  }

  /**
   * L'arc de raccord de deux segments, celui qui dessine tous les rectangles
   * arrondis du jeu. Rayon nul, points confondus ou trois points alignés : le
   * canvas se rabat sur un simple segment vers le coin, et nous aussi.
   */
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void {
    if (!this.point) {
      this.moveTo(x1, y1);
      return;
    }
    const { x: x0, y: y0 } = this.point;
    const versDepart = Math.atan2(y0 - y1, x0 - x1);
    const versArrivee = Math.atan2(y2 - y1, x2 - x1);
    const ouverture = auPlusCourt(versArrivee - versDepart);
    const aligne = Math.abs(ouverture) < 1e-9 || Math.abs(Math.abs(ouverture) - Math.PI) < 1e-9;
    const degenere = r <= 0 || (x0 === x1 && y0 === y1) || (x1 === x2 && y1 === y2);
    if (aligne || degenere) {
      this.lineTo(x1, y1);
      return;
    }
    const demi = Math.abs(ouverture) / 2;
    // Le centre est sur la bissectrice du coin, les points de tangence sur les
    // deux segments : c'est la construction classique du congé de raccordement.
    const tangente = r / Math.tan(demi);
    const bissectrice = versDepart + ouverture / 2;
    const cx = x1 + Math.cos(bissectrice) * (r / Math.sin(demi));
    const cy = y1 + Math.sin(bissectrice) * (r / Math.sin(demi));
    const t0x = x1 + Math.cos(versDepart) * tangente;
    const t0y = y1 + Math.sin(versDepart) * tangente;
    const t2x = x1 + Math.cos(versArrivee) * tangente;
    const t2y = y1 + Math.sin(versArrivee) * tangente;
    const debut = Math.atan2(t0y - cy, t0x - cx);
    const fin = Math.atan2(t2y - cy, t2x - cx);
    // Ce raccord est toujours plus court qu'un demi-tour : le sens le plus court
    // est donc le bon, sans avoir à trancher une orientation. Le premier
    // échantillon vaut exactement le point de tangence, qui sert de segment
    // d'approche depuis le point courant.
    this.poserArc(cx, cy, r, r, 0, debut, auPlusCourt(fin - debut));
  }

  // -------------------------------------------------------------------------
  // Peinture
  // -------------------------------------------------------------------------

  fill(): void {
    const d = this.chemin.join(' ');
    if (!d) return;
    this.emettre(d, 'fill', this.couleurDe(this.fillStyle), []);
  }

  stroke(): void {
    const d = this.chemin.join(' ');
    if (!d) return;
    const fixes = ['fill="none"', `stroke-width="${nb(this.lineWidth * this.echelleTrait())}"`];
    if (this.lineCap !== 'butt') fixes.push(`stroke-linecap="${echapper(this.lineCap)}"`);
    this.emettre(d, 'stroke', this.couleurDe(this.strokeStyle), fixes);
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): DegradeSvg {
    return new DegradeSvg(x0, y0, x1, y1);
  }

  // -------------------------------------------------------------------------
  // Sortie
  // -------------------------------------------------------------------------

  /** Les balises dessinées, dans l'ordre d'émission. */
  corps(): string {
    return this.balises.join('');
  }

  /** Le contenu du `<defs>` : filtres d'ombre et dégradés. Vide s'il n'y en a pas. */
  defs(): string {
    return this.definitions.join('');
  }

  /** Le document complet et autonome : le `xmlns` en fait un fichier ouvrable tel quel. */
  svg(viewBox: string, attributs?: string): string {
    const suite = attributs ? ` ${attributs}` : '';
    const defs = this.defs();
    const bloc = defs ? `<defs>${defs}</defs>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${echapper(viewBox)}"${suite}>${bloc}${this.corps()}</svg>`;
  }

  // -------------------------------------------------------------------------
  // Interne
  // -------------------------------------------------------------------------

  private composer(m: Matrice): void {
    const [a, b, c, d, e, f] = this.matrice;
    const [a2, b2, c2, d2, e2, f2] = m;
    this.matrice = [
      a * a2 + c * b2,
      b * a2 + d * b2,
      a * c2 + c * d2,
      b * c2 + d * d2,
      a * e2 + c * f2 + e,
      b * e2 + d * f2 + f,
    ];
  }

  private versMonde(x: number, y: number): [number, number] {
    const [a, b, c, d, e, f] = this.matrice;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  /**
   * Le facteur qui épaissit un trait sous la matrice courante. La racine du
   * déterminant est exacte pour une mise à l'échelle uniforme — le seul cas que
   * le jeu emploie — et une moyenne raisonnable sinon : un trait n'a qu'une
   * épaisseur, une matrice anisotrope en voudrait deux.
   */
  private echelleTrait(): number {
    const [a, b, c, d] = this.matrice;
    return Math.sqrt(Math.abs(a * d - b * c));
  }

  /**
   * Combien de segments pour un arc, d'après le rayon **rendu**. La corde d'un
   * angle 2α s'écarte de l'arc de `r(1 − cos α)` : on résout cet écart contre
   * `ECART_CORDE` plutôt que de partager le tour en parts égales, faute de quoi
   * un rivet coûte autant de balises qu'une coque.
   */
  private pasDArc(rayonLocal: number, balayage: number): number {
    const rendu = rayonLocal * this.echelleTrait();
    if (!(rendu > ECART_CORDE)) return SEGMENTS_MINIMUM;
    const angleUtile = Math.acos(Math.max(-1, 1 - ECART_CORDE / rendu));
    const voulu = Math.ceil(balayage / (2 * angleUtile));
    const plafond = Math.max(2, Math.ceil((balayage / TOUR) * SEGMENTS_PAR_TOUR));
    const brut = Math.min(plafond, Math.max(SEGMENTS_MINIMUM, voulu));
    // Un arc passe par les points cardinaux qu'il traverse : un cercle entier
    // touche ses quatre pôles, une demi-lune son sommet. Sans cet alignement,
    // un compte impair de segments coupe le cercle en biais et un disque posé
    // sur la grille du plateau paraît de travers d'un pixel.
    const quarts = Math.max(1, Math.round(balayage / (TOUR / 4)));
    return Math.ceil(brut / quarts) * quarts;
  }

  /** Pose un arc elliptique en segments de droite (voir l'en-tête du fichier). */
  private poserArc(
    cx: number, cy: number, rx: number, ry: number,
    rotation: number, depart: number, balayage: number,
  ): void {
    const pas = this.pasDArc(Math.max(Math.abs(rx), Math.abs(ry)), Math.abs(balayage));
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    for (let i = 0; i <= pas; i += 1) {
      const angle = depart + (balayage * i) / pas;
      const px = Math.cos(angle) * rx;
      const py = Math.sin(angle) * ry;
      const sx = cx + px * cos - py * sin;
      const sy = cy + px * sin + py * cos;
      // Le canvas raccorde l'arc au point courant par un segment ; sans point
      // courant, il ouvre une sous-figure.
      if (i === 0 && !this.point) this.moveTo(sx, sy);
      else this.lineTo(sx, sy);
    }
  }

  private emettre(
    d: string, canal: 'fill' | 'stroke', couleur: string, fixes: readonly string[],
  ): void {
    const flou = this.filtreOmbre();
    if (flou !== null) {
      const attrs = [`${canal}="${echapper(this.shadowColor)}"`, ...fixes, `filter="url(#${flou})"`];
      // Le décalage d'ombre du canvas ne subit pas la matrice : il est déjà dans
      // le repère du monde, où sont aussi nos coordonnées.
      if (this.shadowOffsetY !== 0) attrs.push(`transform="translate(0,${nb(this.shadowOffsetY)})"`);
      this.balises.push(`<path d="${d}" ${attrs.join(' ')}/>`);
    }
    this.balises.push(`<path d="${d}" ${[`${canal}="${echapper(couleur)}"`, ...fixes].join(' ')}/>`);
  }

  /** L'identifiant du filtre de flou de l'ombre, ou `null` si l'ombre est éteinte. */
  private filtreOmbre(): string | null {
    if (!this.shadowColor || this.shadowColor === 'transparent') return null;
    if (this.shadowBlur <= 0) return null;
    const ecart = nb(this.shadowBlur / 2);
    // La région par défaut d'un filtre rogne à 10 % de la boîte englobante : un
    // flou sur un tracé mince y serait coupé net.
    return this.definir(
      `flou:${ecart}`,
      (id) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">`
        + `<feGaussianBlur stdDeviation="${ecart}"/></filter>`,
    );
  }

  /**
   * La couleur à écrire : la chaîne telle quelle, ou le renvoi vers un dégradé
   * défini à la volée. Les coordonnées du dégradé passent par la matrice **du
   * moment de la peinture**, comme le fait le canvas.
   */
  private couleurDe(style: string | DegradeSvg): string {
    if (typeof style === 'string') return style;
    const [x1, y1] = this.versMonde(style.x0, style.y0);
    const [x2, y2] = this.versMonde(style.x1, style.y1);
    const attrs = `gradientUnits="userSpaceOnUse" x1="${nb(x1)}" y1="${nb(y1)}"`
      + ` x2="${nb(x2)}" y2="${nb(y2)}"`;
    const paliers = style.balisesPaliers();
    return `url(#${this.definir(
      `degrade:${attrs}:${paliers}`,
      (id) => `<linearGradient id="${id}" ${attrs}>${paliers}</linearGradient>`,
    )})`;
  }

  /** Enregistre une définition, ou rend l'identifiant de la même déjà posée. */
  private definir(cle: string, balise: (id: string) => string): string {
    const connu = this.idsParDefinition.get(cle);
    if (connu !== undefined) return connu;
    this.compteur += 1;
    const id = `${this.prefixe}-${this.compteur}`;
    this.idsParDefinition.set(cle, id);
    this.definitions.push(balise(id));
    return id;
  }
}

/** Rend un dessin canvas en SVG : `dessiner` reçoit le pinceau comme un contexte 2D. */
export function dessinerEnSvg(
  viewBox: string,
  dessiner: (g: Pinceau) => void,
  options: OptionsPinceauSvg & { attributs?: string } = {},
): string {
  const pinceau = new PinceauSvg(options);
  // `PinceauSvg` ne couvre que le sous-ensemble de `CanvasRenderingContext2D` que
  // le dessin du jeu appelle vraiment — une vingtaine de membres sur une centaine.
  // Implémenter les autres pour satisfaire le compilateur coûterait plus qu'il ne
  // prouverait, et les prouver faux serait pire. La conversion est donc faite
  // **ici et nulle part ailleurs**, et le test la couvre en passant les six
  // silhouettes du canon par ce pinceau.
  dessiner(pinceau as unknown as Pinceau);
  return pinceau.svg(viewBox, options.attributs);
}
