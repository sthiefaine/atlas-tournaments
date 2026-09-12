/**
 * Les **illustrations** des dialogues : une réplique qui montre au lieu de dire.
 *
 * Le tutoriel expliquait ses règles avec des mots — « les cases vertes sont
 * celles où il peut aller, les rouges celles qu'il peut frapper » —, alors
 * qu'une vignette dit la même chose sans une phrase et dans les neuf langues.
 * Deux tailles pour un seul dessin : une **image** à côté de la réplique
 * (`Dialogue.illustration`), et un **pictogramme** à la taille d'un mot posé
 * dans la phrase (`[[img:cle]]`).
 *
 * Trois choses tiennent ce fichier, et il ne faut pas les défaire.
 *
 * 1. **Aucun fichier image.** Rien ne se télécharge : tout est du SVG composé
 *    ici, comme le buste du commandant (`dialogue-html.ts`) et la figurine du
 *    HUD. Une vignette qui manque au réseau au milieu d'une explication vaudrait
 *    moins que la phrase qu'elle remplace.
 * 2. **Les unités ne sont pas redessinées.** Elles sont peintes par le composeur
 *    de silhouettes (`sprites/silhouettes.ts`), celui du HUD, à travers un
 *    pinceau qui rend du SVG au lieu de peindre un canvas. Une unité homologuée
 *    demain a donc sa vignette le jour même, sans une ligne ici.
 * 3. **Les couleurs ne suivent pas le thème.** Le vert veut dire « j'y vais » et
 *    le rouge « j'y tire » (`surbrillance.ts`) : ce sont des couleurs de règle,
 *    pas de peau. Chaque vignette porte donc sa propre plaque sombre à liseré
 *    clair, qui se lit sur le papier crème d'un briefing comme sur l'encre d'une
 *    boîte de dialogue — c'est la contrainte des deux fonds, réglée par le
 *    dessin plutôt que par deux jeux de variables qu'il faudrait tenir à jour.
 *
 * Le module est **pur** : aucun DOM, aucune horloge, aucune mesure. La taille à
 * l'écran est décidée par le CSS, jamais par un attribut posé au montage.
 */

import {
  CLES_ILLUSTRATION, type CleIllustration, type Palette, type Silhouette,
} from '../schemas/types';
import { segmenter, type Segment } from './gras';
import { paletteDe } from './palettes';
import { type Pinceau } from './sprites/formes';
import { dessinerUnite } from './sprites/silhouettes';
import { PinceauSvg } from './sprites/pinceau-svg';

// ---------------------------------------------------------------------------
// 1. Le vocabulaire de dessin
// ---------------------------------------------------------------------------

/**
 * Les couleurs des cinq genres de surbrillance, reprises **au chiffre près** de
 * la peau 3D (`render3d/surbrillances.ts`). Une vignette qui montre une case
 * verte doit montrer *ce* vert-là, sinon elle enseigne une couleur que le jeu
 * n'emploie pas.
 */
const NAPPE = {
  deplacement: '#28ec96',
  attaque: '#ff2e48',
  capture: '#ffc634',
  production: '#4eaaff',
} as const;

/** La plaque : fond sombre et liseré clair, lisibles sur les deux fonds. */
const FOND = '#16323f';
const LISERE = '#7fa8b8';
/** Les matières du plateau : herbe, terre, pierre, eau, tôle, bois. */
const HERBE = '#4a8b52';
const TERRE = '#2f5a37';
const PIERRE = '#8a96a0';
const PIERRE_SOMBRE = '#5b6670';
const EAU = '#2f7fb5';
const EAU_SOMBRE = '#1d5480';
const TOLE = '#c9d4dc';
const TOLE_SOMBRE = '#8c9aa6';
const BOIS = '#a8763f';
const NUIT = '#05090d';
const CRAIE = '#f2f6f8';
const SIGNAL = '#ffd162';

/** Le carré de toutes les vignettes : elles s'alignent parce qu'il ne change pas. */
const VUE = '0 0 48 48';

/** La plaque de fond, commune à toutes : c'est elle qui tient les deux fonds. */
const PLAQUE = `<rect x="1" y="1" width="46" height="46" rx="5" fill="${FOND}"`
  + ` stroke="${LISERE}" stroke-width="2"/>`;

/**
 * La face supérieure d'une case, en **perspective légère** comme sur le plateau
 * — un trapèze, pas un losange : la caméra du jeu regarde à 68°, elle ne fait
 * pas de l'isométrique.
 */
const DESSUS = 'M11 14 38 14 44 31 4 31Z';
/** L'épaisseur de la case, sous la face : ce qui la pose au lieu de la coller. */
const TRANCHE = 'M4 31h40v6H4Z';

/** Une case de terrain : sa face, son épaisseur, et rien d'autre. */
function tuile(dessus: string, tranche: string): string {
  return `<path d="${TRANCHE}" fill="${tranche}"/><path d="${DESSUS}" fill="${dessus}"/>`;
}

/**
 * La nappe de surbrillance posée sur une case : un aplat translucide et un
 * liseré vif. C'est exactement ce que la peau 3D peint, et le liseré compte
 * plus que l'aplat — à vingt pixels, c'est lui qui donne la couleur.
 */
function nappe(couleur: string): string {
  return `<path d="${DESSUS}" fill="${couleur}" opacity=".55"/>`
    + `<path d="${DESSUS}" fill="none" stroke="${couleur}" stroke-width="2.4"`
    + ' stroke-linejoin="round"/>';
}

/** Une case d'herbe sous une nappe : les quatre vignettes de surbrillance. */
function caseSurlignee(couleur: string): string {
  return tuile(HERBE, TERRE) + nappe(couleur);
}

/** Un bloc bâti posé sur la case : mur clair, toit sombre, deux fenêtres. */
function bloc(
  x: number, y: number, l: number, h: number, mur: string, toit: string, fenetres = true,
): string {
  const f = fenetres
    ? `<path d="M${x + 1.6} ${y + 2.6}h2.4v2.4h-2.4Zm${l - 5.6} 0h2.4v2.4h-2.4Z" fill="${SIGNAL}"/>`
    : '';
  return `<path d="M${x} ${y}h${l}v${h}h${-l}Z" fill="${mur}"/>`
    + `<path d="M${x - 1} ${y - 2.4}h${l + 2}v2.4h${-l - 2}Z" fill="${toit}"/>${f}`;
}

// ---------------------------------------------------------------------------
// 2. Les vingt et une vignettes dessinées à la main
// ---------------------------------------------------------------------------

/**
 * Le corps de chaque vignette, plaque exclue. Une entrée par clé de la liste
 * fermée : le compilateur refuse d'en oublier une, et un test refuse d'en
 * garder une qui ne dessinerait rien.
 */
const DESSINS: Readonly<Record<Exclude<CleIllustration, CleIllustrationUnite | 'duel'>, string>> = {
  case_verte: caseSurlignee(NAPPE.deplacement),
  case_rouge: caseSurlignee(NAPPE.attaque),
  case_or: caseSurlignee(NAPPE.capture),
  case_bleue: caseSurlignee(NAPPE.production),

  // La flèche coudée du chemin : elle tourne, parce qu'un trajet tourne. Le
  // liseré sombre est posé d'abord, en trait plus épais — le même artifice
  // qu'en 3D, où la flèche est doublée pour rester lisible sur toute couleur.
  fleche_chemin: `<path d="M9 38V22a5 5 0 0 1 5-5h16" fill="none" stroke="${NUIT}"`
    + ' stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'
    + `<path d="M28 8 42 17 28 26Z" fill="${NUIT}"/>`
    + `<path d="M9 38V22a5 5 0 0 1 5-5h15" fill="none" stroke="${NAPPE.deplacement}"`
    + ' stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
    + `<path d="M29 11.5 38.5 17 29 22.5Z" fill="${NAPPE.deplacement}"/>`,

  // Le curseur : quatre équerres autour d'une case. Ce sont les coins qui font
  // le curseur — un cadre fermé se lirait comme une nappe de plus.
  curseur: tuile(HERBE, TERRE)
    + `<path d="M6 16V9h7M42 16V9h-7M6 32v7h7m29-7v7h-7" fill="none" stroke="${CRAIE}"`
    + ' stroke-width="3" stroke-linecap="square"/>',

  // La jauge de commandant : les mêmes segments biseautés que le pied de la
  // boîte de dialogue et que la campagne, trois pleins sur cinq, et l'éclair
  // qui dit à quoi elle sert.
  jauge_pouvoir: '<g transform="skewX(-15)">'
    + `<path d="M14 20h6v14h-6Zm9 0h6v14h-6Zm9 0h6v14h-6Z" fill="${SIGNAL}"/>`
    + `<path d="M41 20h6v14h-6Zm9 0h6v14h-6Z" fill="#ffffff2e"/></g>`
    + `<path d="M25 6 17 19h6l-2 9 9-13h-6Z" fill="${CRAIE}"/>`,

  // Le bouton de fin de tour : il a l'épaisseur de tous les boutons du jeu —
  // une bordure basse plus sombre — et le double chevron qui passe la main.
  bouton_fin_tour: `<path d="M6 15h36v16H6Z" fill="#1a3340"/>`
    + `<path d="M6 31h36v5H6Z" fill="#09171d"/>`
    + `<path d="M6 15h36v16H6Z" fill="none" stroke="${LISERE}" stroke-width="1.6"/>`
    + `<path d="M15 18.5 22 23l-7 4.5Zm9 0L31 23l-7 4.5Z" fill="${SIGNAL}"/>`,

  // Le brouillard : la moitié cachée est **noire**, pas assombrie — c'est la
  // décision du 7 septembre (FACTEUR_BROUILLARD = 0), et une vignette qui
  // montrerait un gris mentirait sur ce que le joueur verra.
  brouillard: tuile(HERBE, TERRE)
    + `<path d="M24 14h14l6 17H24Z" fill="${NUIT}"/>`
    + `<path d="M24 37V14" stroke="${LISERE}" stroke-width="1.4" stroke-dasharray="3 2.5"/>`
    + `<path d="M26 20h13m-15 5h16m-14 5h15" stroke="#ffffff26" stroke-width="2"`
    + ' stroke-linecap="round"/>',

  // L'impulsion : un éclair scellé dans deux ondes. Aucun véhicule dessiné —
  // à vingt pixels, un moteur figé n'est qu'une tache de plus.
  impulsion: `<path d="M13 12a16 16 0 0 0 0 24M35 12a16 16 0 0 1 0 24" fill="none"`
    + ` stroke="${NAPPE.production}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M8 9a22 22 0 0 0 0 30M40 9a22 22 0 0 1 0 30" fill="none"`
    + ` stroke="${NAPPE.production}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`
    + `<path d="M27 8 15 26h7l-2 14 12-18h-7Z" fill="${SIGNAL}"/>`,

  // La station radar : la parabole sur son mât, et ce qu'elle entend.
  radar: tuile(HERBE, TERRE)
    + `<path d="M22 30h4v-9h-4Z" fill="${PIERRE_SOMBRE}"/>`
    + `<path d="M16 30h16v3H16Z" fill="${PIERRE}"/>`
    + `<path d="M24 21a9 9 0 0 1 9-9v9Z" fill="${TOLE}" transform="rotate(-30 24 21)"/>`
    + `<path d="M31 8a13 13 0 0 1 8 8M35 4a19 19 0 0 1 11 11" fill="none"`
    + ` stroke="${NAPPE.production}" stroke-width="2.2" stroke-linecap="round"/>`,

  // La réserve : le stock dont parlent les commandants — des caisses sanglées
  // et le jeton de fonds. Ce n'est pas un terrain, c'est ce qu'on y garde.
  reserve: tuile(HERBE, TERRE)
    + `<path d="M8 18h15v13H8Zm17 4h15v9H25Z" fill="${BOIS}"/>`
    + `<path d="M8 23h15v2H8Zm0 4h15v2H8Zm17 0h15v2H25Z" fill="#00000033"/>`
    + `<path d="M8 18h15v13H8Zm17 4h15v9H25Z" fill="none" stroke="#5f3f1e" stroke-width="1.4"/>`
    + `<circle cx="35" cy="14" r="7" fill="${SIGNAL}"/>`
    + `<path d="M31.5 13h7v2.4h-7Z" fill="#8a6412"/>`,

  // Le poste de distribution : le bâtiment qu'on capture, et le pylône qui dit
  // pourquoi on le capture — qui le tient décide où va le courant.
  poste: tuile(HERBE, TERRE)
    + bloc(9, 18, 15, 13, TOLE, TOLE_SOMBRE)
    + `<path d="M33 31 30 15h6l-3 16Z" fill="${PIERRE_SOMBRE}"/>`
    + `<path d="M29 20h8m-7.4 5h6.8" stroke="${PIERRE}" stroke-width="1.4"/>`
    + `<path d="M30 13h6v2h-6Z" fill="${PIERRE}"/>`
    + `<path d="M33 12 29 5h3l-1 4h4l-4 7 1-4Z" fill="${SIGNAL}"/>`,

  // L'usine : le toit en dents de scie, la cheminée, le rideau de la halle.
  usine: tuile(HERBE, TERRE)
    + `<path d="M35 18h4v-9h-4Z" fill="${PIERRE_SOMBRE}"/>`
    + `<path d="M7 31V19l6-4v4l6-4v4l6-4v4l6-4v16Z" fill="${TOLE}"/>`
    + `<path d="M7 19l6-4v4Zm12 0 6-4v4Z" fill="${TOLE_SOMBRE}"/>`
    + `<path d="M14 31v-8h9v8Z" fill="${TOLE_SOMBRE}"/>`
    + `<path d="M14 25h9M14 28h9" stroke="${FOND}" stroke-width="1.2"/>`,

  // Le quartier général : le bloc le plus haut, et le mât qui hisse les
  // couleurs — c'est le drapeau qui dit à qui il est, exactement comme en jeu.
  qg: tuile(HERBE, TERRE)
    + bloc(11, 14, 19, 17, TOLE, TOLE_SOMBRE, false)
    + `<path d="M13.6 18h3.2v3.4h-3.2Zm5.6 0h3.2v3.4h-3.2Zm5.6 0h3.2v3.4h-3.2Z" fill="${SIGNAL}"/>`
    + `<path d="M18.6 24h4.8v7h-4.8Z" fill="${TOLE_SOMBRE}"/>`
    + `<path d="M33 31V7" stroke="${PIERRE}" stroke-width="2" stroke-linecap="round"/>`
    + `<path d="M34 8h10l-3 4 3 4H34Z" fill="${NAPPE.attaque}"/>`,

  // La ville : trois maisons de hauteurs différentes. C'est la variété des
  // hauteurs qui la distingue d'une usine, pas un détail de façade.
  ville: tuile(HERBE, TERRE)
    + bloc(7, 21, 11, 10, TOLE, TOLE_SOMBRE)
    + bloc(20, 16, 11, 15, TOLE, TOLE_SOMBRE)
    + bloc(33, 23, 9, 8, TOLE, TOLE_SOMBRE),

  // La forêt : deux conifères, dont l'un devant — c'est le recouvrement qui
  // fait un bois, un seul arbre ne serait qu'un arbre.
  foret: tuile(HERBE, TERRE)
    + `<path d="M31 31h3v-6h-3Z" fill="#6b4a24"/>`
    + `<path d="M32.5 8 41 22H24Zm0 8L40 28H25Z" fill="#2f7a45"/>`
    + `<path d="M15 33h4v-8h-4Z" fill="#7a5529"/>`
    + `<path d="M17 6 28 24H6Zm0 9 10 16H7Z" fill="#3d9c55"/>`,

  // La montagne : deux sommets, une neige, une ombre de versant. Elle bouche
  // la vue et coûte du mouvement : elle doit paraître haute, pas pointue.
  montagne: tuile(HERBE, TERRE)
    + `<path d="M4 31 18 9l9 14 5-7 12 15Z" fill="${PIERRE}"/>`
    + `<path d="M18 9 27 23l-5 8H4Z" fill="${PIERRE_SOMBRE}"/>`
    + `<path d="m18 9 4.6 7.2-4.6 2.4-4.6-2.4Zm14 7 3 3.8-3 1.6-3-1.6Z" fill="${CRAIE}"/>`,

  // Le pont : le tablier au-dessus de l'eau, avec ses garde-corps. C'est la
  // seule case où l'on marche sur la rivière, et le tablier doit la traverser
  // de bord à bord pour le dire.
  pont: tuile(EAU, EAU_SOMBRE)
    + `<path d="M6 20h36v2.6H6Zm0 6h36v2.6H6Z" fill="#ffffff2b"/>`
    + `<path d="M4 21h40v8H4Z" fill="${BOIS}"/>`
    + `<path d="M4 21h40v1.6H4Zm0 6.4h40V29H4Z" fill="#6d4a23"/>`
    + `<path d="M7 21v-5m34 5v-5M7 29v4m34-4v4" stroke="${PIERRE}" stroke-width="2"`
    + ' stroke-linecap="round"/>',

  // La rivière : deux courants, et les berges qui la bordent. L'eau seule
  // serait la mer ; ce sont les berges qui en font un cours d'eau.
  riviere: tuile(EAU, EAU_SOMBRE)
    + `<path d="M11 14h6l-4 17H4Zm21 0h6l6 17h-9Z" fill="${HERBE}"/>`
    + `<path d="M17 15q6 5 0 10t0 6m6-16q6 5 0 10t0 6" fill="none" stroke="#ffffff40"`
    + ' stroke-width="2.2" stroke-linecap="round"/>',
};

// ---------------------------------------------------------------------------
// 3. Les vignettes composées par le pinceau : unités et duel
// ---------------------------------------------------------------------------

/**
 * Les six silhouettes des premiers exercices, **copiées du canon** plutôt que
 * lues par `content/` : ce module est appelé par le rendu d'un dialogue, qui ne
 * sait pas quel catalogue est en jeu, et une vignette de pictogramme doit
 * pouvoir se composer sans état de partie. Un test compare les six au canon et
 * rougit si l'une dérive.
 */
const SILHOUETTES: Readonly<Record<CleIllustrationUnite, Silhouette>> = {
  unite_infanterie: { base: 'pattes', corps: 'capsule', modules: [], taille: 1 },
  unite_meca: { base: 'pattes', corps: 'capsule', modules: ['lance_roquettes'], taille: 1 },
  unite_genie: { base: 'pattes', corps: 'capsule', modules: ['radar'], taille: 1 },
  unite_char_leger: { base: 'chenilles', corps: 'bloc', modules: ['tourelle'], taille: 2 },
  unite_artillerie: { base: 'chenilles', corps: 'plateau', modules: ['canon_long'], taille: 2 },
  unite_transport: { base: 'chenilles', corps: 'plateau', modules: ['grue'], taille: 2 },
};

/** Clé d'unité illustrée : les six que le début de la campagne emploie. */
export type CleIllustrationUnite = Extract<CleIllustration, `unite_${string}`>;

/** Vrai si cette clé désigne une figurine, donc un dessin composé par le pinceau. */
export function estIllustrationUnite(cle: CleIllustration): cle is CleIllustrationUnite {
  return cle.startsWith('unite_');
}

/**
 * Pose une figurine dans le carré de 48 : le composeur dessine dans un repère
 * calibré pour une tuile de 64 pixels, centré sur l'origine. On ne le recadre
 * pas, on le **replace** — le dessin reste celui du HUD, au pixel de forme près.
 * Un camp 1 est le **même** dessin retourné, jamais un second dessin.
 */
function figurine(
  g: Pinceau, cle: CleIllustrationUnite, retourne: boolean,
  x: number, echelle: number, palette: Palette,
): void {
  g.save();
  g.translate(x, 27);
  g.scale(retourne ? -echelle : echelle, echelle);
  dessinerUnite(g, SILHOUETTES[cle], palette);
  g.restore();
}

/** Ce qu'un dessin composé rend : ses balises, et ce qu'il a mis dans `<defs>`. */
interface Compose { corps: string; defs: string }

/**
 * Un pinceau SVG vu comme un contexte 2D. **La seule conversion du module** :
 * `PinceauSvg` ne couvre que le sous-ensemble de `CanvasRenderingContext2D` que
 * le composeur de silhouettes emploie, et déclarer les cent membres de
 * l'interface pour satisfaire le compilateur coûterait plus qu'il ne prouve.
 */
function pinceau(prefixeId: string): { svg: PinceauSvg; g: Pinceau } {
  const svg = new PinceauSvg({ prefixeId });
  return { svg, g: svg as unknown as Pinceau };
}

/** Le corps d'une vignette d'unité, par le pinceau SVG. */
function corpsUnite(cle: CleIllustrationUnite): Compose {
  const { svg, g } = pinceau(`il-${cle}`);
  figurine(g, cle, false, 24, 0.6, paletteDe(0));
  return { corps: svg.corps(), defs: svg.defs() };
}

/**
 * Le duel : les deux figurines de la prévision, face à face, aux couleurs des
 * deux camps — celle de droite est le **même** dessin retourné, jamais un
 * second dessin. L'étoile de choc entre les deux dit que le tir part.
 */
function corpsDuel(): Compose {
  const { svg, g } = pinceau('il-duel');
  figurine(g, 'unite_infanterie', false, 13, 0.42, paletteDe(0));
  figurine(g, 'unite_infanterie', true, 35, 0.42, paletteDe(1));
  const choc = `<path d="M24 6 27 15l9 3-9 3-3 9-3-9-9-3 9-3Z" fill="${SIGNAL}"/>`;
  return { corps: svg.corps() + choc, defs: svg.defs() };
}

/**
 * Les corps composés, gardés au niveau module.
 *
 * Une figurine passée au pinceau vaut quelques dizaines de balises : la
 * recomposer à chaque réplique reviendrait à repayer tout le composeur de
 * silhouettes pour un dessin qui, lui, ne change jamais — il n'a ni camp
 * variable, ni nation, ni état. Vingt-sept entrées au plus, jamais libérées.
 */
const COMPOSES = new Map<CleIllustration, Compose>();

/** Le corps d'une vignette, composé par le pinceau ou écrit à la main. */
function corpsDe(cle: CleIllustration): Compose {
  const garde = COMPOSES.get(cle);
  if (garde) return garde;
  const compose = estIllustrationUnite(cle) ? corpsUnite(cle)
    : cle === 'duel' ? corpsDuel()
      : { corps: DESSINS[cle], defs: '' };
  COMPOSES.set(cle, compose);
  return compose;
}

// ---------------------------------------------------------------------------
// 4. Le rendu d'une vignette
// ---------------------------------------------------------------------------

/** Ce qu'on peut demander à une vignette. Sa **taille** n'en fait pas partie. */
export interface OptionsIllustration {
  /**
   * Nom accessible, **déjà traduit** par l'appelant (clé `illustration.<cle>`).
   * Sans lui la vignette est décorative et se tait : c'est le bon défaut pour
   * un pictogramme posé dans une phrase qui le dit déjà.
   */
  titre?: string;
  /** Classes CSS de la balise racine ; c'est le CSS qui décide de la taille. */
  classe?: string;
}

/** Échappe une valeur d'attribut : rien d'extérieur n'entre, mais on ne parie pas. */
function ech(texte: string): string {
  return texte
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Le SVG **autonome** d'une illustration : carré, sans dépendance, sans
 * requête, et sans taille propre — c'est la feuille de style qui la donne, de
 * sorte que le même appel serve à vingt pixels dans une phrase et à quatre-vingt
 * seize à côté d'une réplique.
 */
export function illustrationSvg(cle: CleIllustration, options: OptionsIllustration = {}): string {
  const composee = corpsDe(cle);
  const defs = composee.defs !== '' ? `<defs>${composee.defs}</defs>` : '';
  const titre = options.titre;
  const nomme = titre !== undefined && titre !== '';
  const attributs = [
    `viewBox="${VUE}"`,
    'xmlns="http://www.w3.org/2000/svg"',
    `data-illustration="${cle}"`,
    ...(options.classe !== undefined && options.classe !== ''
      ? [`class="${ech(options.classe)}"`] : []),
    // Sans nom, la vignette est décorative et **se tait** : c'est le bon défaut
    // pour un pictogramme posé dans une phrase qui dit déjà la même chose.
    ...(nomme ? ['role="img"', `aria-label="${ech(titre)}"`] : ['aria-hidden="true"']),
  ].join(' ');
  const legendeSvg = nomme ? `<title>${ech(titre)}</title>` : '';
  return `<svg ${attributs}>${legendeSvg}${defs}${PLAQUE}${composee.corps}</svg>`;
}

// ---------------------------------------------------------------------------
// 5. Le pictogramme dans la phrase
// ---------------------------------------------------------------------------

/**
 * La marque d'un pictogramme dans un texte de scénario. Volontairement lourde :
 * elle ne peut pas se produire par accident dans une phrase française, et elle
 * se voit dans un fichier JSON qu'on relit sans outil.
 */
export const MARQUE_IMAGE = /\[\[img:([a-z0-9_]+)\]\]/g;

/** Un morceau de texte enrichi : des mots, ou un dessin, gras ou non. */
export type SegmentRiche =
  | { genre: 'texte'; texte: string; gras: boolean }
  | { genre: 'image'; cle: CleIllustration; gras: boolean };

/** Vrai si cette chaîne est l'une des clés de la liste fermée. */
function estCle(v: string): v is CleIllustration {
  return (CLES_ILLUSTRATION as readonly string[]).includes(v);
}

/**
 * Découpe un segment de texte sur ses pictogrammes.
 *
 * **Tolérance, et c'est la règle du gras appliquée à l'image** : une marque mal
 * fermée ou dont la clé n'existe pas se rend **telle quelle**, crochets compris.
 * Un scénariste doit voir sa faute dans la phrase, pas dans un écran vide ni
 * dans une console qu'il n'ouvrira jamais.
 */
function decouperImages(segment: Segment): SegmentRiche[] {
  const sortie: SegmentRiche[] = [];
  const { texte, gras } = segment;
  let i = 0;
  // `lastIndex` est remis à zéro : la regex est globale et partagée par le module.
  MARQUE_IMAGE.lastIndex = 0;
  for (let m = MARQUE_IMAGE.exec(texte); m !== null; m = MARQUE_IMAGE.exec(texte)) {
    const brut = m[1] ?? '';
    if (!estCle(brut)) continue;
    if (m.index > i) sortie.push({ genre: 'texte', texte: texte.slice(i, m.index), gras });
    sortie.push({ genre: 'image', cle: brut, gras });
    i = m.index + m[0].length;
  }
  if (i < texte.length) sortie.push({ genre: 'texte', texte: texte.slice(i), gras });
  return sortie;
}

/**
 * Segmente un texte de scénario en gras **et** pictogrammes. Le gras est
 * découpé d'abord (`gras.ts`), le pictogramme ensuite : une image posée dans un
 * passage en gras garde donc son gras, et aucune des deux syntaxes n'a besoin
 * de connaître l'autre.
 */
export function segmenterRiche(texte: string): SegmentRiche[] {
  return segmenter(texte).flatMap(decouperImages);
}

/**
 * Le texte nu, pour un `title`, un `aria-label` ou un journal : les marques de
 * gras tombent, et chaque pictogramme devient son nom quand l'appelant sait le
 * traduire, ou disparaît sinon. Une phrase lue à voix haute ne peut pas garder
 * un `[[img:…]]` au milieu.
 */
export function texteNu(texte: string, nomDe?: (cle: CleIllustration) => string): string {
  return segmenterRiche(texte)
    .map((s) => (s.genre === 'texte' ? s.texte : nomDe ? nomDe(s.cle) : ''))
    .join('');
}

/**
 * Le HTML d'un texte enrichi : le gras dans un `<strong>`, le pictogramme dans
 * un `<span>` qui porte le SVG. L'échappement du texte reste à l'appelant —
 * le HUD et la scène ont chacun le leur, et ce module n'en impose pas un
 * troisième (même contrat que `htmlGras`).
 */
export function htmlRiche(
  texte: string,
  echapper: (s: string) => string,
  nomDe?: (cle: CleIllustration) => string,
): string {
  return segmenterRiche(texte)
    .map((s) => {
      if (s.genre === 'image') return pictogramme(s.cle, nomDe);
      return s.gras ? `<strong>${echapper(s.texte)}</strong>` : echapper(s.texte);
    })
    .join('');
}

/** La classe des pictogrammes en ligne : une seule, partout, sinon rien n'aligne. */
export const CLASSE_PICTOGRAMME = 'atlas-img-mot';
/** La classe d'une vignette de réplique. */
export const CLASSE_VIGNETTE = 'atlas-img-vignette';

/**
 * Un pictogramme prêt à poser dans une phrase : le SVG, enveloppé d'un `<span>`
 * qui porte la taille et l'alignement. L'enveloppe existe parce qu'un `<svg>`
 * en ligne se laisse mal aligner sur la ligne de base d'un navigateur à l'autre.
 */
export function pictogramme(
  cle: CleIllustration, nomDe?: (cle: CleIllustration) => string,
): string {
  const titre = nomDe ? nomDe(cle) : undefined;
  const options: OptionsIllustration = titre !== undefined ? { titre } : {};
  return `<span class="${CLASSE_PICTOGRAMME}">${illustrationSvg(cle, options)}</span>`;
}

/**
 * La feuille des illustrations, partagée par la scène de dialogue et le HUD.
 *
 * **Le pictogramme est mesuré en `em`** : il grandit avec le texte qui le porte,
 * donc il tient à quinze pixels comme à dix-huit sans qu'on le lui dise, et il
 * suit les réglages de taille de police du système. La vignette, elle, est
 * bornée par le CSS et **jamais** par une décision au montage : sur un
 * téléphone de 390 pixels, c'est la requête de média qui la couche au-dessus du
 * texte, pas une mesure prise en JavaScript.
 *
 * Rien n'y bouge : une illustration n'est pas une animation, elle reste sous
 * `prefers-reduced-motion`.
 */
export const STYLE_ILLUSTRATIONS = `
.${CLASSE_PICTOGRAMME}{display:inline-block;width:1.25em;height:1.25em;vertical-align:-.28em;margin:0 .1em}
.${CLASSE_PICTOGRAMME} svg{display:block;width:100%;height:100%}
.${CLASSE_VIGNETTE}{flex:0 0 auto;width:clamp(64px,17vw,96px)}
.${CLASSE_VIGNETTE} svg{display:block;width:100%;height:auto}
.${CLASSE_VIGNETTE} figcaption{margin:5px 0 0;font-size:11px;line-height:1.3;letter-spacing:.02em;color:#9db3b6;text-align:center}
`;

/**
 * La vignette d'une réplique : l'image et sa légende, dans une `<figure>` —
 * c'est bien une illustration légendée, et le balisage doit le dire à qui
 * n'écoute que le lecteur d'écran.
 */
export function vignetteIllustration(
  cle: CleIllustration,
  legende: string | undefined,
  echapper: (s: string) => string,
  nomDe?: (cle: CleIllustration) => string,
): string {
  const titre = nomDe ? nomDe(cle) : undefined;
  // La vignette porte un nom, elle : elle est là pour montrer, pas pour orner.
  const svg = illustrationSvg(cle, titre !== undefined ? { titre } : {});
  const bas = legende !== undefined && legende !== ''
    ? `<figcaption>${echapper(legende)}</figcaption>` : '';
  return `<figure class="${CLASSE_VIGNETTE}">${svg}${bas}</figure>`;
}
