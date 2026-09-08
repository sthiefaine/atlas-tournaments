/**
 * Les **scènes transitoires** du HUD : ce que la partition (`partition.ts`) lui
 * donne à jouer par-dessus la carte — les chiffres de dégâts qui flottent,
 * l'écran de combat, le splash de pouvoir, le « ! » d'une embuscade. Tout le
 * reste de la partition est l'affaire de la peau 3D ; le HUD l'ignore.
 *
 * Pourquoi un fichier à part de `hud-html.ts` : le HUD remplace le DOM de ses
 * onze emplacements à chaque rafraîchissement, et une scène qui y vivrait
 * serait réécrite en plein vol. Les scènes vivent donc dans un conteneur
 * **frère**, comme la bannière de tour et le dialogue, et ne sont rebâties que
 * par la partition qui les a demandées.
 *
 * Trois règles :
 *
 * - **la position d'écran d'une case est relue à chaque image** (`versEcran`) :
 *   un chiffre suit la caméra, il ne reste pas là où la case était ;
 * - **un clic coupe** — sur l'écran de combat ou le splash, le clic coupe toute
 *   la partition, 3D comprise, par `api.couper` ; sans lui, la scène ne coupe
 *   qu'elle-même. On ne bloque jamais le joueur derrière un effet ;
 * - **une durée de 0 n'efface pas l'information** : sous « animations réduites »
 *   la partition ne dure pas, mais le chiffre et l'écran s'affichent quand même,
 *   à l'état final, `MS_FIXE` millisecondes. Le réglage éteint le mouvement, pas
 *   ce qu'il disait.
 */

import type { Catalogue, EtatPartie } from '../engine/index';
import type { CampId, Case, Silhouette, UnitType } from '../schemas/types';
import { buste } from './dialogue-html';
import { nomCommandant, nomUnite } from './libelles';
import { paletteDe } from './palettes';
import { type Geste, MISE_EN_SCENE, type Partition } from './partition';
import type { PointVue } from './rendu';
import { dessinerUnite } from './sprites/index';

/** Ce que les scènes lisent du jeu : l'état, le catalogue, la langue, le camp, ce qui se voit. */
export interface VueScenes {
  etat: EtatPartie;
  catalogue: Catalogue;
  locale: string;
  camp: CampId;
  /**
   * Les identifiants des unités que le joueur voit ; `null` sans brouillard,
   * absent : toutes. Une scène ancrée sur une unité que la carte cache ne se
   * joue pas — un « ! » sur du noir dirait où l'adversaire s'est arrêté.
   */
  unitesVues?: ReadonlySet<string> | null;
}

/** Ce que les scènes peuvent demander au jeu. Aucun de ces appels ne mute un état. */
export interface ApiScenes {
  vue(): VueScenes;
  t(cle: string, params?: Record<string, string | number>): string;
  /** Position d'écran du centre d'une case, ou `null` hors champ. */
  versEcran(c: Case): PointVue | null;
  /** Coupe **toute** la partition en cours, peau 3D comprise. Absent : la scène ne coupe qu'elle-même. */
  couper?(): void;
}

/**
 * L'horloge des scènes : le temps qui passe et l'image suivante. Injectable
 * pour la même raison que celle de la boucle — un test qui dépend de l'horloge
 * réelle passe seul et tombe sous charge, ce qui en fait un test inutile.
 */
export interface HorlogeScenes {
  maintenant(): number;
  /** Planifie l'image suivante ; rend de quoi l'annuler. */
  planifier(image: () => void): () => void;
}

/** Ce que `monterScenes` rend à son hôte. */
export interface ScenesHtml {
  /** Joue les gestes du HUD d'une partition ; la promesse tient jusqu'au dernier. */
  jouer(partition: Partition): Promise<void>;
  /** Retire tout ce qui est à l'écran et résout la promesse en cours. */
  couper(): void;
  demonter(): void;
}

/** Durée d'affichage d'un geste sans durée : l'information reste lisible, sans mouvement. */
export const MS_FIXE = 600;

/** De combien un chiffre monte avant de s'effacer, en pixels. */
const MONTEE_CHIFFRE = 28;

/** De combien le « ! » monte avant de s'effacer, en pixels. */
const MONTEE_SURPRISE = 32;

/**
 * Le signe de l'embuscade. C'est une **ponctuation**, pas un libellé : il ne
 * passe pas par `t()` pour la même raison que le « − » d'un chiffre ou le « ∞ »
 * d'une pastille — il n'a rien à traduire, et une langue qui l'écrirait
 * autrement (« ¡ », ou un signe sans point) changerait de grammaire, pas de
 * mot. Les mots, eux, sont dans l'annonce `hud.embuscade`, qui passe par `t()`.
 * Le nœud est `aria-hidden` : un lecteur d'écran lit l'annonce, pas le signe.
 */
const SIGNE_SURPRISE = '!';

/** La taille des vignettes de l'écran de combat, en pixels logiques. */
const TAILLE_VIGNETTE_COMBAT = 96;

/** Échappe un texte destiné à du HTML : les scènes n'injectent jamais de balise. */
function ech(texte: string): string {
  return texte
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Une jauge de PV en dix crans : pleins, perdus à l'échange, vides. Partagée
 * avec la prévision de duel du HUD, parce que c'est la même promesse : dix
 * crans, et ce qu'il en reste.
 */
export function jaugePv(avant: number, apres: number): string {
  const crans = Array.from({ length: 10 }, (_, i) => {
    if (i < apres) return '<i class="plein"></i>';
    if (i < avant) return '<i class="perdu"></i>';
    return '<i></i>';
  }).join('');
  return `<span class="pv" aria-hidden="true">${crans}</span>`;
}

/** Un chiffre signé, avec le vrai signe moins : « −3 », « +2 ». */
export function chiffreSigne(valeur: number, teinte: 'perte' | 'gain'): string {
  return `${teinte === 'perte' ? '−' : '+'}${valeur}`;
}

/** Le rôle d'un chiffre dans un échange : le coup porté, ou le coup rendu. */
export type RoleCoup = 'coup' | 'riposte';

/** Deux cases sont la même. */
function memeCase(a: Case, b: Case): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Quel chiffre flottant est un **coup**, et lequel est une **riposte**.
 *
 * Le propriétaire a vu deux infanteries pleines s'échanger 5 PV d'un côté et
 * 8 de l'autre et a trouvé cela incohérent : rien à l'écran ne disait que le
 * second chiffre était un coup **rendu**, tiré par une unité déjà touchée et
 * depuis un autre terrain. Deux chiffres nus se lisent comme deux mesures de la
 * même chose ; ils ne le sont pas.
 *
 * La partition ne porte pas ce rôle — `Geste` ne connaît qu'un chiffre et une
 * teinte —, il se **lit** donc dans sa structure, et la définition employée est
 * celle du jeu : *une riposte est un coup rendu à qui vient de tirer*. Chaque
 * chiffre est apparié au `encaisser` que le réalisateur écrit avec lui (même
 * case, même instant) ; l'unité qui encaisse est une riposteuse si elle avait
 * elle-même tiré **plus tôt dans la salve**, de cette case vers celle d'où le
 * coup lui revient. Le rang dans la liste, et non l'instant, fait foi : sous
 * « animations réduites » tous les gestes commencent à zéro, et une règle
 * fondée sur l'horloge y perdrait la distinction au moment où elle compte
 * encore.
 *
 * Un coup sans tireur — la mécanique d'une région, une avarie — n'est ni l'un
 * ni l'autre : son `encaisser` part de la case même, et il ne reçoit pas de
 * rôle. Un chiffre sans `encaisser` non plus : une réparation n'est pas un coup.
 *
 * Pure et testable sans DOM.
 */
export function rolesDesChiffres(gestes: readonly Geste[]): Map<Geste, RoleCoup> {
  const roles = new Map<Geste, RoleCoup>();
  for (const g of gestes) {
    if (g.genre !== 'chiffre') continue;
    const rang = gestes.findIndex(
      (e) => e.genre === 'encaisser' && e.debut === g.debut && memeCase(e.case, g.case),
    );
    const encaisse = rang < 0 ? undefined : gestes[rang];
    if (!encaisse || encaisse.genre !== 'encaisser') continue;
    if (memeCase(encaisse.depuis, encaisse.case)) continue;
    const rendu = gestes.slice(0, rang).some((t) => t.genre === 'tirer'
      && t.unite === encaisse.unite
      && memeCase(t.depuis, encaisse.case)
      && memeCase(t.vers, encaisse.depuis));
    roles.set(g, rendu ? 'riposte' : 'coup');
  }
  return roles;
}

/** La feuille de style des scènes, injectée une seule fois par document. */
const STYLE = `
.atlas-scenes{position:absolute;inset:0;z-index:8;pointer-events:none;font:14px/1.3 system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4edda;--encre:#152c3b;--papier:#f4edda;--signal:#ffd162;--alerte:#f2a33a;--alerte-grave:#f0555f;--gain:#8ee0a4;--duree:900ms}
.atlas-scenes *{box-sizing:border-box}
/* Le chiffre : ancré sur la case, il monte et s'efface. La durée vient du geste. */
.atlas-chiffre{position:absolute;transform:translate(-50%,-100%);text-align:center;font-size:22px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:.02em;text-shadow:0 2px 0 #0b1a22,0 0 6px #0b1a22cc;animation:atlas-chiffre var(--duree) cubic-bezier(.2,.7,.3,1) both;will-change:transform,opacity}
.atlas-chiffre[data-teinte='perte']{color:var(--alerte-grave)}
.atlas-chiffre[data-teinte='gain']{color:var(--gain)}
/* La riposte porte son mot : un peu plus petite que le coup, avec l'étiquette
   dans la couleur du signal — deux chiffres nus se lisent comme deux mesures
   de la même chose, et ce n'en sont pas. */
.atlas-chiffre[data-role='riposte']{font-size:19px}
.atlas-chiffre .etiquette{display:block;margin-top:1px;font-style:normal;font-size:10px;font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:var(--signal);text-shadow:0 1px 0 #0b1a22}
.atlas-chiffre[data-fixe='oui']{animation:none;translate:0 -${MONTEE_CHIFFRE / 2}px}
@keyframes atlas-chiffre{0%{opacity:0;translate:0 6px;scale:.7}14%{opacity:1;translate:0 0;scale:1.08}30%{scale:1}72%{opacity:1}100%{opacity:0;translate:0 -${MONTEE_CHIFFRE}px}}
/* Le « ! » d'embuscade : ancré sur la case comme un chiffre, plus gros, dans la
   couleur du signal ; il bondit, tient, puis monte et s'efface. */
.atlas-surprise{position:absolute;transform:translate(-50%,-100%);font-size:30px;line-height:1;font-weight:900;color:var(--signal);text-shadow:0 2px 0 #0b1a22,0 0 8px #0b1a22cc;animation:atlas-surprise var(--duree) cubic-bezier(.2,.7,.3,1) both;will-change:transform,opacity}
.atlas-surprise[data-fixe='oui']{animation:none;translate:0 -${MONTEE_SURPRISE / 2}px}
@keyframes atlas-surprise{0%{opacity:0;translate:0 10px;scale:.5}12%{opacity:1;translate:0 -4px;scale:1.3}26%{scale:1;translate:0 0}68%{opacity:1;translate:0 -6px}100%{opacity:0;translate:0 -${MONTEE_SURPRISE}px}}
/* Les bandes noires : la carte reste visible entre elles, comme sur une scène de dialogue. */
.atlas-scenes .bandes{position:absolute;left:0;right:0;height:8vh;min-height:34px;background:#060d12;pointer-events:none}
.atlas-scenes .bandes.haut{top:0;border-bottom:2px solid #ffffff14;animation:atlas-bande-haut .28s ease-out both}
.atlas-scenes .bandes.bas{bottom:0;border-top:2px solid #ffffff14;animation:atlas-bande-bas .28s ease-out both}
@keyframes atlas-bande-haut{from{transform:translateY(-100%)}to{transform:none}}
@keyframes atlas-bande-bas{from{transform:translateY(100%)}to{transform:none}}
/* L'écran de combat : un panneau centré, semi-couvrant — jamais plein écran, la
   carte se voit autour —, coupable d'un clic n'importe où sur lui. */
.atlas-combat{position:absolute;inset:0;pointer-events:auto;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:calc(8vh + 16px) 16px}
.atlas-combat .cadre{position:relative;width:min(640px,100%);background:#0f1e27f0;border:2px solid #3c5563;border-top:5px solid var(--alerte-grave);box-shadow:inset 0 0 0 1px #ffffff1f,6px 8px 0 #050d1266;clip-path:polygon(0 0,calc(100% - 18px) 0,100% 18px,100% 100%,18px 100%,0 calc(100% - 18px));animation:atlas-combat-entree .26s cubic-bezier(.2,.9,.3,1.1) both}
@keyframes atlas-combat-entree{from{opacity:0;transform:scale(.94) translateY(10px)}to{opacity:1;transform:none}}
.atlas-combat .titre{display:flex;align-items:center;justify-content:center;gap:10px;padding:9px 14px 7px;font-size:11px;font-weight:850;letter-spacing:.18em;text-transform:uppercase;color:#ffb3aa}
.atlas-combat .titre svg{width:16px;height:16px}
.atlas-combat .camps{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;gap:8px;padding:6px 14px 12px}
.atlas-combat .camp{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 10px 12px;background:#ffffff0a;border:1px solid #ffffff14;border-bottom:4px solid var(--teinte)}
.atlas-combat .camp canvas{width:${TAILLE_VIGNETTE_COMBAT}px;height:${TAILLE_VIGNETTE_COMBAT}px;background:#ffffff08;border-bottom:2px solid var(--teinte);transition:filter .12s,translate .12s}
.atlas-combat .camp .nom{font-size:14px;font-weight:850;text-transform:uppercase;letter-spacing:.06em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-combat .pv{display:flex;gap:2px;height:8px;width:110px;max-width:100%}
.atlas-combat .pv i{flex:1;background:#ffffff1f;transition:background .18s}
.atlas-combat .pv i.plein{background:var(--gain)}
.atlas-combat .pv i.perdu{background:var(--alerte-grave)}
.atlas-combat .chiffres{display:flex;align-items:baseline;gap:6px;font-weight:900;font-size:20px;font-variant-numeric:tabular-nums}
.atlas-combat .chiffres em{font-style:normal;font-size:12px;color:#9fb3b6}
.atlas-combat .chiffres b{color:#9fb3b6;transition:color .18s}
.atlas-combat .coup{min-height:1.3em;font-size:26px;font-weight:900;color:var(--alerte-grave);font-variant-numeric:tabular-nums;opacity:0;transform:translateY(6px);transition:opacity .16s,transform .16s}
/* Le mot qui nomme le chiffre : « Coup » du côté de la cible, « Riposte » du côté de l'attaquant. Il apparaît avec lui. */
.atlas-combat .camp .role{font-size:10px;font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:#9db3b6;opacity:0;transform:translateY(6px);transition:opacity .16s,transform .16s}
.atlas-combat .attaquant .role{color:var(--signal)}
.atlas-combat .contre{display:flex;align-items:center;justify-content:center;width:40px;color:var(--signal)}
.atlas-combat .contre svg{width:28px;height:28px}
.atlas-combat .indice{padding:0 14px 10px;text-align:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9db3b6}
/* Les étapes de l'écran : avant le coup, le coup, la riposte, la fin. Ce que
   chacune allume est cumulatif — un coup encaissé ne se ré-efface pas. */
.atlas-combat[data-etape='coup'] .cible canvas,.atlas-combat[data-etape='riposte'] .cible canvas,.atlas-combat[data-etape='fin'] .cible canvas{filter:brightness(1.6) saturate(.6)}
.atlas-combat[data-etape='riposte'] .attaquant canvas,.atlas-combat[data-etape='fin'][data-riposte='oui'] .attaquant canvas{filter:brightness(1.6) saturate(.6)}
.atlas-combat[data-etape='coup'] .cible .coup,.atlas-combat[data-etape='riposte'] .cible .coup,.atlas-combat[data-etape='fin'] .cible .coup,.atlas-combat[data-etape='coup'] .cible .role,.atlas-combat[data-etape='riposte'] .cible .role,.atlas-combat[data-etape='fin'] .cible .role{opacity:1;transform:none}
.atlas-combat[data-etape='riposte'] .attaquant .coup,.atlas-combat[data-etape='fin'][data-riposte='oui'] .attaquant .coup,.atlas-combat[data-etape='riposte'] .attaquant .role,.atlas-combat[data-etape='fin'][data-riposte='oui'] .attaquant .role{opacity:1;transform:none}
.atlas-combat[data-etape='coup'] .cible .chiffres b,.atlas-combat[data-etape='riposte'] .chiffres b,.atlas-combat[data-etape='fin'] .chiffres b{color:var(--papier)}
.atlas-combat[data-etape='riposte'] .cible canvas{filter:none}
/* Le splash de pouvoir : bandes, buste qui entre par son côté, nom du pouvoir, lueur. */
.atlas-splash{position:absolute;inset:0;pointer-events:auto;cursor:pointer;display:flex;align-items:center;justify-content:center;overflow:hidden}
.atlas-splash .lueur{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,color-mix(in srgb,var(--teinte) 55%,transparent) 0%,transparent 62%);animation:atlas-lueur var(--duree) ease-in-out both}
@keyframes atlas-lueur{0%{opacity:0}18%{opacity:1}82%{opacity:1}100%{opacity:0}}
.atlas-splash .plateau{position:relative;display:flex;align-items:center;gap:0;width:min(720px,calc(100% - 24px));animation:atlas-splash-tenue var(--duree) ease-in-out both}
@keyframes atlas-splash-tenue{0%,12%{opacity:1}86%{opacity:1}100%{opacity:0}}
.atlas-splash[data-cote='droite'] .plateau{flex-direction:row-reverse}
.atlas-splash .buste{flex:0 0 auto;width:150px;filter:drop-shadow(4px 6px 0 #050d1266);animation:atlas-splash-buste .38s cubic-bezier(.2,.9,.3,1.1) both}
.atlas-splash[data-cote='droite'] .buste{animation-name:atlas-splash-buste-droite;transform:scaleX(-1)}
.atlas-splash .buste svg{display:block;width:100%;height:auto;border:2px solid var(--teinte);background:#1d3540}
@keyframes atlas-splash-buste{from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}}
@keyframes atlas-splash-buste-droite{from{opacity:0;transform:scaleX(-1) translateX(-60px)}to{opacity:1;transform:scaleX(-1)}}
.atlas-splash .carte{flex:1 1 auto;min-width:0;padding:14px 22px 16px;background:var(--encre);border:2px solid #8ba0a6;border-left-width:0;box-shadow:5px 6px 0 #050d1255;clip-path:polygon(0 0,calc(100% - 22px) 0,100% 22px,100% 100%,0 100%);animation:atlas-splash-carte .3s .08s ease-out both}
.atlas-splash[data-cote='droite'] .carte{border-left-width:2px;border-right-width:0;clip-path:polygon(22px 0,100% 0,100% 100%,0 100%,0 22px);text-align:right}
@keyframes atlas-splash-carte{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.atlas-splash .kicker{display:block;font-size:11px;font-weight:850;letter-spacing:.2em;text-transform:uppercase;color:var(--teinte)}
.atlas-splash .nom{display:block;margin-top:4px;font-size:clamp(24px,4.2vw,40px);line-height:1.05;font-weight:900;letter-spacing:-.01em;text-transform:uppercase;color:var(--papier);text-shadow:0 3px 0 #050d12}
.atlas-splash .commandant{display:block;margin-top:8px;font-size:13px;font-weight:750;letter-spacing:.1em;text-transform:uppercase;color:#9db3b6}
.atlas-splash .eclat{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#fff;box-shadow:0 0 0 0 var(--teinte);animation:atlas-eclat var(--duree) ease-out both;pointer-events:none}
@keyframes atlas-eclat{0%{opacity:0;transform:translate(-50%,-50%) scale(1)}10%{opacity:1;transform:translate(-50%,-50%) scale(4);box-shadow:0 0 60px 30px var(--teinte)}45%{opacity:0;transform:translate(-50%,-50%) scale(70);box-shadow:0 0 0 0 transparent}100%{opacity:0}}
[data-fixe='oui'] .lueur,[data-fixe='oui'] .plateau,[data-fixe='oui'] .buste,[data-fixe='oui'] .carte,[data-fixe='oui'] .eclat,[data-fixe='oui'] .bandes,.atlas-combat[data-fixe='oui'] .cadre{animation:none!important}
@media(max-width:620px){
  .atlas-combat .camps{gap:6px;padding:4px 10px 10px}
  .atlas-combat .camp canvas{width:64px;height:64px}
  .atlas-combat .camp .nom{font-size:12px}
  .atlas-combat .coup{font-size:22px}
  .atlas-splash .buste{width:96px}
  .atlas-splash .carte{padding:10px 14px 12px}
}
@media(max-height:460px){.atlas-scenes .bandes{height:6vh;min-height:22px}.atlas-combat .camp canvas{width:56px;height:56px}}
@media(prefers-reduced-motion:reduce){.atlas-scenes *{animation:none!important;transition:none!important}}
`;

/** Injecte la feuille de style des scènes si le document ne l'a pas encore. */
function poserStyle(doc: Document): void {
  if (doc.getElementById('atlas-scenes-style')) return;
  const style = doc.createElement('style');
  style.id = 'atlas-scenes-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** La cible d'une attaque, en signe : le même que le menu d'ordres. */
const ICONE_ATTAQUE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>';

/** Un effet en cours : de quand à quand, son nœud une fois créé, ce qu'il fait à chaque image. */
interface Effet {
  debut: number;
  fin: number;
  /** Vrai une fois créé — ou une fois qu'on a renoncé à le créer. */
  tente: boolean;
  fini: boolean;
  noeud: HTMLElement | null;
  creer(): HTMLElement | null;
  avancer(p: number): void;
}

/** Monte le conteneur des scènes dans le conteneur du jeu. */
/** L'horloge du navigateur : `requestAnimationFrame` s'il existe, sinon une minuterie. */
function horlogeDe(fenetre: Window | null): HorlogeScenes {
  return {
    maintenant: () => Date.now(),
    planifier: (image) => {
      if (fenetre?.requestAnimationFrame) {
        const jeton = fenetre.requestAnimationFrame(() => image());
        return () => fenetre.cancelAnimationFrame?.(jeton);
      }
      const jeton = setTimeout(image, 16);
      return () => clearTimeout(jeton);
    },
  };
}

export function monterScenes(
  conteneur: HTMLElement, api: ApiScenes, horloge?: HorlogeScenes,
): ScenesHtml {
  const doc = conteneur.ownerDocument;
  poserStyle(doc);
  const racine = doc.createElement('div');
  racine.className = 'atlas-scenes';
  racine.setAttribute('aria-live', 'off');
  conteneur.appendChild(racine);
  const fenetre = doc.defaultView;
  const temps = horloge ?? horlogeDe(fenetre);

  let effets: Effet[] = [];
  let annuler: (() => void) | null = null;
  let resoudreEnCours: (() => void) | null = null;
  let depart = 0;

  /** L'image suivante. */
  function planifier(): void {
    annuler = temps.planifier(image);
  }
  function deplanifier(): void {
    annuler?.();
    annuler = null;
  }

  function terminer(): void {
    deplanifier();
    for (const ef of effets) ef.noeud?.remove();
    effets = [];
    const r = resoudreEnCours;
    resoudreEnCours = null;
    r?.();
  }

  function image(): void {
    annuler = null;
    const t = temps.maintenant() - depart;
    let restant = false;
    for (const ef of effets) {
      if (ef.fini) continue;
      if (t < ef.debut) {
        restant = true;
        continue;
      }
      if (!ef.tente) {
        ef.tente = true;
        ef.noeud = ef.creer();
        if (ef.noeud) racine.appendChild(ef.noeud);
        else {
          // Rien à montrer — une case hors champ, un type inconnu : l'effet est réputé joué.
          ef.fini = true;
          continue;
        }
      }
      if (t >= ef.fin) {
        ef.noeud?.remove();
        ef.noeud = null;
        ef.fini = true;
        continue;
      }
      ef.avancer(Math.min(1, (t - ef.debut) / (ef.fin - ef.debut)));
      restant = true;
    }
    if (restant) planifier();
    else terminer();
  }

  /** Un clic sur une scène qui se coupe : toute la partition, si le jeu le permet. */
  function surClic(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    if (api.couper) api.couper();
    else terminer();
  }

  /** Peint une vignette d'unité dans un canvas, aux couleurs d'un camp. */
  function peindre(canvas: HTMLElement, silhouette: Silhouette, camp: CampId, taille: number): void {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ratio = Math.min(2, fenetre?.devicePixelRatio ?? 1);
    canvas.width = Math.round(taille * ratio);
    canvas.height = Math.round(taille * ratio);
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
    g.clearRect(0, 0, taille, taille);
    g.save();
    g.translate(taille / 2, taille / 2 + taille * 0.1);
    const echelle = (taille / 64) * 0.92;
    g.scale(echelle, echelle);
    dessinerUnite(g, silhouette, paletteDe(camp));
    g.restore();
  }

  // -------------------------------------------------------------------------
  // Les quatre scènes
  // -------------------------------------------------------------------------

  function chiffre(g: Extract<Geste, { genre: 'chiffre' }>, role: RoleCoup | null): Effet {
    const fixe = g.duree === 0;
    let noeud: HTMLElement | null = null;
    const placer = (): void => {
      if (!noeud) return;
      const p = api.versEcran(g.case);
      // Hors champ, le chiffre se cache ; il revient si la caméra revient.
      noeud.hidden = p === null;
      if (p) {
        noeud.style.left = `${Math.round(p.x)}px`;
        noeud.style.top = `${Math.round(p.y - 10)}px`;
      }
    };
    return {
      debut: g.debut, fin: g.debut + (fixe ? MS_FIXE : g.duree), tente: false, fini: false, noeud: null,
      creer: () => {
        // Une case hors champ à l'instant du coup : rien à montrer.
        if (api.versEcran(g.case) === null) return null;
        noeud = doc.createElement('div');
        noeud.className = 'atlas-chiffre';
        noeud.dataset['teinte'] = g.teinte;
        if (role) noeud.dataset['role'] = role;
        if (fixe) noeud.dataset['fixe'] = 'oui';
        noeud.style.setProperty('--duree', `${g.duree}ms`);
        noeud.setAttribute('aria-hidden', 'true');
        noeud.textContent = chiffreSigne(g.valeur, g.teinte);
        // Une riposte se dit. Un coup, non : un chiffre seul au-dessus d'une
        // case se lit comme le coup qu'on vient de porter, et l'étiqueter
        // n'apprendrait rien tout en encombrant l'écran à chaque échange.
        if (role === 'riposte') {
          const etiquette = doc.createElement('em');
          etiquette.className = 'etiquette';
          etiquette.textContent = api.t('hud.riposte');
          noeud.appendChild(etiquette);
        }
        placer();
        return noeud;
      },
      avancer: placer,
    };
  }

  /**
   * Le « ! » d'embuscade : au-dessus de l'unité qui s'est arrêtée net, relu à
   * chaque image comme un chiffre. Une unité que le joueur ne voit pas n'en
   * reçoit pas : le signe dirait où l'adversaire s'est arrêté.
   */
  function surprise(g: Extract<Geste, { genre: 'surprise' }>): Effet {
    const fixe = g.duree === 0;
    let noeud: HTMLElement | null = null;
    const placer = (): void => {
      if (!noeud) return;
      const p = api.versEcran(g.case);
      noeud.hidden = p === null;
      if (p) {
        noeud.style.left = `${Math.round(p.x)}px`;
        // Plus haut qu'un chiffre : au-dessus de la tête, pas sur la poitrine.
        noeud.style.top = `${Math.round(p.y - 22)}px`;
      }
    };
    return {
      debut: g.debut, fin: g.debut + (fixe ? MS_FIXE : g.duree), tente: false, fini: false, noeud: null,
      creer: () => {
        const v = api.vue();
        if (v.unitesVues && !v.unitesVues.has(g.unite)) return null;
        if (api.versEcran(g.case) === null) return null;
        noeud = doc.createElement('div');
        noeud.className = 'atlas-surprise';
        if (fixe) noeud.dataset['fixe'] = 'oui';
        noeud.style.setProperty('--duree', `${g.duree}ms`);
        noeud.setAttribute('aria-hidden', 'true');
        noeud.textContent = SIGNE_SURPRISE;
        placer();
        return noeud;
      },
      avancer: placer,
    };
  }

  function duel(g: Extract<Geste, { genre: 'duel' }>): Effet {
    const fixe = g.duree === 0;
    let noeud: HTMLElement | null = null;
    let jauges: { attaquant: HTMLElement; cible: HTMLElement } | null = null;
    let etape = '';
    /** Pose l'étape ; les jauges tombent quand l'étape le dit, une fois. */
    const poser = (suivante: 'avant' | 'coup' | 'riposte' | 'fin'): void => {
      if (!noeud || etape === suivante) return;
      etape = suivante;
      noeud.dataset['etape'] = suivante;
      if (!jauges) return;
      if (suivante !== 'avant') jauges.cible.innerHTML = jaugePv(g.cible.pvAvant, g.cible.pvApres);
      if (suivante === 'riposte' || (suivante === 'fin' && g.riposte)) {
        jauges.attaquant.innerHTML = jaugePv(g.attaquant.pvAvant, g.attaquant.pvApres);
      }
    };
    return {
      debut: g.debut, fin: g.debut + (fixe ? MS_FIXE : g.duree), tente: false, fini: false, noeud: null,
      creer: () => {
        const v = api.vue();
        const camp = (
          role: 'attaquant' | 'cible', u: typeof g.attaquant,
        ): { el: HTMLElement; jauge: HTMLElement; canvas: HTMLElement; type: UnitType } | null => {
          const type = v.catalogue.unites[u.type];
          if (!type) return null;
          const el = doc.createElement('div');
          el.className = `camp ${role}`;
          el.style.setProperty('--teinte', paletteDe(u.camp).main);
          const canvas = doc.createElement('canvas');
          canvas.setAttribute('width', String(TAILLE_VIGNETTE_COMBAT));
          canvas.setAttribute('height', String(TAILLE_VIGNETTE_COMBAT));
          el.appendChild(canvas);
          const nom = doc.createElement('span');
          nom.className = 'nom';
          nom.textContent = nomUnite(v.locale, v.catalogue, u.type);
          el.appendChild(nom);
          const jauge = doc.createElement('span');
          jauge.className = 'jauge';
          // Pleine au départ : c'est le coup qui la fait tomber.
          jauge.innerHTML = jaugePv(u.pvAvant, u.pvAvant);
          el.appendChild(jauge);
          const chiffres = doc.createElement('span');
          chiffres.className = 'chiffres';
          chiffres.innerHTML = `${ech(String(u.pvAvant))}<em>&rarr;</em><b>${ech(String(u.pvApres))}</b>`;
          el.appendChild(chiffres);
          const perte = u.pvAvant - u.pvApres;
          // Lequel des deux chiffres est le coup, lequel la riposte : sur cet
          // écran, la cible encaisse le coup, et l'attaquant ne peut perdre des
          // PV qu'au coup rendu. Sans ces deux mots, deux chiffres très
          // différents se lisent comme une incohérence.
          if (perte > 0) {
            const etiquette = doc.createElement('span');
            etiquette.className = 'role';
            etiquette.textContent = api.t(role === 'cible' ? 'hud.coup' : 'hud.riposte');
            el.appendChild(etiquette);
          }
          const coup = doc.createElement('b');
          coup.className = 'coup';
          // L'attaquant qui n'encaisse rien n'a rien à afficher ; la place reste.
          coup.textContent = perte > 0 ? chiffreSigne(perte, 'perte') : '';
          el.appendChild(coup);
          return { el, jauge, canvas, type };
        };
        const a = camp('attaquant', g.attaquant);
        const c = camp('cible', g.cible);
        if (!a || !c) return null;
        noeud = doc.createElement('div');
        noeud.className = 'atlas-combat';
        noeud.setAttribute('role', 'group');
        noeud.setAttribute('aria-label', api.t('hud.ecran_combat'));
        noeud.dataset['riposte'] = g.riposte ? 'oui' : 'non';
        if (fixe) noeud.dataset['fixe'] = 'oui';
        const bandesHaut = doc.createElement('div');
        bandesHaut.className = 'bandes haut';
        const bandesBas = doc.createElement('div');
        bandesBas.className = 'bandes bas';
        const cadre = doc.createElement('div');
        cadre.className = 'cadre';
        const titre = doc.createElement('div');
        titre.className = 'titre';
        titre.innerHTML = `${ICONE_ATTAQUE}<span>${ech(api.t('hud.ecran_combat'))}</span>`;
        const camps = doc.createElement('div');
        camps.className = 'camps';
        const contre = doc.createElement('div');
        contre.className = 'contre';
        contre.innerHTML = ICONE_ATTAQUE;
        camps.appendChild(a.el);
        camps.appendChild(contre);
        camps.appendChild(c.el);
        const indice = doc.createElement('div');
        indice.className = 'indice';
        indice.textContent = api.t('hud.passer_animation');
        cadre.appendChild(titre);
        cadre.appendChild(camps);
        cadre.appendChild(indice);
        noeud.appendChild(bandesHaut);
        noeud.appendChild(bandesBas);
        noeud.appendChild(cadre);
        noeud.addEventListener('click', surClic);
        jauges = { attaquant: a.jauge, cible: c.jauge };
        peindre(a.canvas, a.type.silhouette, g.attaquant.camp, TAILLE_VIGNETTE_COMBAT);
        peindre(c.canvas, c.type.silhouette, g.cible.camp, TAILLE_VIGNETTE_COMBAT);
        // Sans durée, l'écran montre directement l'issue.
        poser(fixe ? 'fin' : 'avant');
        return noeud;
      },
      avancer: (p) => {
        if (fixe) return;
        if (p >= MISE_EN_SCENE.partRiposte && g.riposte) poser('riposte');
        else if (p >= MISE_EN_SCENE.partCoup) poser('coup');
      },
    };
  }

  function pouvoir(g: Extract<Geste, { genre: 'pouvoir' }>): Effet {
    const fixe = g.duree === 0;
    return {
      debut: g.debut, fin: g.debut + (fixe ? MS_FIXE : g.duree), tente: false, fini: false, noeud: null,
      creer: () => {
        const v = api.vue();
        const pal = paletteDe(g.camp);
        const commandantCle = v.etat.camps.find((c) => c.id === g.camp)?.commandantCle ?? null;
        const commandant = nomCommandant(v.locale, commandantCle) || api.t('hud.commandant');
        // Le nom d'un pouvoir arrive comme une **clé** (`commandant.<cle>.pouvoir`) ;
        // un nom qui n'en serait pas une s'affiche tel quel plutôt que vide.
        const nom = api.t(g.nom) || g.nom;
        const noeud = doc.createElement('div');
        noeud.className = 'atlas-splash';
        noeud.setAttribute('role', 'status');
        noeud.style.setProperty('--teinte', pal.main);
        noeud.style.setProperty('--duree', `${g.duree}ms`);
        // Le joueur entre par la gauche, l'adversaire par la droite : la même
        // grammaire que le dialogue.
        noeud.dataset['cote'] = g.camp === v.camp ? 'gauche' : 'droite';
        noeud.dataset['niveau'] = g.niveau;
        if (fixe) noeud.dataset['fixe'] = 'oui';
        noeud.innerHTML = '<div class="bandes haut"></div><div class="bandes bas"></div>'
          + '<div class="lueur"></div><div class="eclat"></div>'
          + `<div class="plateau"><div class="buste">${buste(g.camp, 'triomphe')}</div>`
          + `<div class="carte"><span class="kicker">${ech(api.t(g.niveau === 'super' ? 'hud.super_pouvoir' : 'hud.jauge_pouvoir'))}</span>`
          + `<strong class="nom">${ech(nom)}</strong>`
          + `<span class="commandant">${ech(commandant)}</span></div></div>`;
        noeud.addEventListener('click', surClic);
        return noeud;
      },
      avancer: () => undefined,
    };
  }

  function jouer(partition: Partition): Promise<void> {
    // Une partition qui en suit une autre coupe la précédente : deux écrans de
    // combat superposés ne se liraient pas.
    terminer();
    const roles = rolesDesChiffres(partition.gestes);
    for (const g of partition.gestes) {
      if (g.genre === 'chiffre') effets.push(chiffre(g, roles.get(g) ?? null));
      else if (g.genre === 'surprise') effets.push(surprise(g));
      else if (g.genre === 'duel') effets.push(duel(g));
      else if (g.genre === 'pouvoir') effets.push(pouvoir(g));
    }
    if (effets.length === 0) return Promise.resolve();
    depart = temps.maintenant();
    return new Promise<void>((resoudre) => {
      resoudreEnCours = resoudre;
      image();
    });
  }

  return {
    jouer,
    couper: terminer,
    demonter: () => {
      terminer();
      racine.remove();
    },
  };
}
