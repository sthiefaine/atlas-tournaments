/**
 * Le HUD en **HTML**, posé par-dessus le canvas (`BRIEF.md`, direction artistique
 * révisée : « Le HUD est une surcouche HTML »).
 *
 * Pourquoi sortir le HUD du canvas : les neuf langues du jeu n'ont pas la même
 * police ni la même métrique, et un texte dessiné au pinceau n'est ni
 * sélectionnable, ni lisible par un lecteur d'écran, ni redimensionnable par le
 * navigateur. Le DOM règle les trois d'un coup. Le HUD canvas (`hud.ts`) reste
 * disponible pour l'aperçu d'administration et le rendu hors écran.
 *
 * Les trois règles d'i18n de `hud.ts` restent en vigueur : **aucun texte en dur**
 * (tout passe par `t()`), `Intl` pour les nombres, et jamais de débordement — ici
 * c'est le CSS qui tronque (`text-overflow`) au lieu de `measureText`.
 *
 * Le HUD ne décide de rien : il appelle l'`ApiHud` que `jeu.ts` lui donne.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { prevoirDuel, pvAffiches, terrainLogique, uniteParId } from '../engine/index';
import { nombre as nombreIntl } from '../i18n/index';
import type { CampId, Case, CleTerrain, CleUnite, Meteo, Silhouette } from '../schemas/types';
import type { Ambiance } from './ambiance';
import type { Phase } from './controleur';
import {
  libelleMeteo, libellePhase, libelleSaison, nomCommandant, nomTerrain, nomUnite,
  type OptionMenu,
} from './libelles';
import { ficheUnite, porte, type Duel } from './fiche-unite';
import { paletteDe } from './palettes';
import type { PointVue } from './rendu';
import { dessinerUnite } from './sprites/index';

/** Tout ce que le HUD lit : l'état, la vue d'interaction et la langue. */
export interface VueJeu {
  etat: EtatPartie;
  catalogue: Catalogue;
  ambiance: Ambiance;
  locale: string;
  /** Camp du joueur humain. */
  camp: CampId;
  phase: Phase;
  curseur: Case | null;
  selection: string | null;
  menu: { ancre: Case; options: readonly OptionMenu[] } | null;
  production: { batiment: Case; unites: readonly CleUnite[] } | null;
  /** La visée en cours : de quoi prévoir le duel avant de confirmer. */
  visee: { attaquantId: string; depuis: Case; cibles: readonly Case[]; cible: Case | null } | null;
  attenteIa: boolean;
  /** Message éphémère, déjà traduit. */
  annonce: string | null;
  masquerFin?: boolean;
  /**
   * Une scène de dialogue occupe l'écran : le HUD s'efface. Il ne se démonte pas
   * — ses `data-*` et son état restent lisibles —, il cesse simplement de
   * disputer l'attention à la réplique en cours.
   */
  sceneOuverte?: boolean;
}

/** Ce que le HUD peut demander au jeu. Aucun de ces appels ne mute un état. */
export interface ApiHud {
  vue(): VueJeu;
  t(cle: string, params?: Record<string, string | number>): string;
  finTour(): void;
  choisirSuite(id: string): void;
  choisirProduction(cle: CleUnite): void;
  jouerPouvoir(niveau: 'normal' | 'super'): void;
  annuler(): void;
  recommencer(): void;
  zoomer?(sens: 1 | -1): void;
  recentrer?(): void;
  /** Position d'écran du centre d'une case : sert à ancrer le menu d'ordres. */
  versEcran(c: Case): PointVue | null;
}

/** Ce que `monterHudHtml` rend à son hôte. */
export interface HudHtml {
  /** Reconstruit le HUD depuis la vue courante. */
  rafraichir(): void;
  demonter(): void;
}

/** Échappe un texte destiné à du HTML : le HUD n'injecte jamais de balise. */
function ech(texte: string): string {
  return texte
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** La feuille de style du HUD, injectée une seule fois par document. */
const STYLE = `
.atlas-hud{position:absolute;inset:0;container-type:size;container-name:atlas-interface;pointer-events:none;font:14px/1.35 system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f5efdf;-webkit-font-smoothing:antialiased;--marge:12px;--bas:calc(12px + env(safe-area-inset-bottom,0px));--haut:calc(12px + env(safe-area-inset-top,0px));--dock:72px;--encre:#152c3b;--papier:#f4edda;--signal:#ffd162}
.atlas-hud *{box-sizing:border-box}
.atlas-hud[data-scene='ouverte']{visibility:hidden}
.atlas-hud .p{position:absolute;pointer-events:auto;background:var(--encre);border:1px solid #839798;border-radius:2px;box-shadow:3px 3px 0 #101d2860;overflow:hidden}
.atlas-hud .p>.bord{position:absolute;left:0;top:0;bottom:0;width:4px}
.atlas-hud .in{padding:10px 14px}
.atlas-hud .tt{font-weight:800;font-size:15px;letter-spacing:.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atlas-hud .sb{font-size:13px;color:#b9cbcb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.atlas-hud .symbole{width:24px;height:24px;flex:none;display:block}
.atlas-hud .partie{position:absolute;left:max(var(--marge),env(safe-area-inset-left,0px));top:var(--haut);display:flex;align-items:center;height:44px;max-width:calc(100% - 144px);filter:drop-shadow(2px 3px 0 #111b2940)}
.atlas-hud .jour{display:flex;align-items:center;gap:7px;height:44px;padding:0 16px 0 10px;background:var(--papier);color:var(--encre);font-size:14px;font-weight:850;text-transform:uppercase;clip-path:polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%);white-space:nowrap}
.atlas-hud .jour .symbole{width:20px;height:20px}
.atlas-hud .fonds{display:flex;align-items:center;gap:5px;margin-left:-8px;height:34px;padding:0 10px 0 14px;background:var(--encre);color:var(--signal);font-weight:850;font-size:14px;white-space:nowrap}
.atlas-hud .fonds .symbole{width:18px;height:18px}
.atlas-hud .bulletin{position:absolute;pointer-events:auto;right:max(var(--marge),env(safe-area-inset-right,0px));top:var(--haut);width:128px;color:var(--papier);filter:drop-shadow(2px 3px 0 #111b2940);z-index:2}
.atlas-hud .bulletin summary{display:flex;gap:7px;align-items:center;padding:7px 9px;cursor:pointer;list-style:none;min-height:44px;background:var(--encre);border-bottom:3px solid var(--signal)}
.atlas-hud .bulletin summary::-webkit-details-marker{display:none}
.atlas-hud .bulletin summary::after{content:'⌄';margin-left:auto;font-size:16px;color:#c0ccd7}
.atlas-hud .bulletin[open] summary::after{transform:rotate(180deg)}
.atlas-hud .bulletin svg{flex:0 0 auto;width:23px;height:23px}
.atlas-hud .bulletin .tt{font-size:13px}
.atlas-hud .previsions{padding:7px 10px 12px;background:var(--encre);border-top:1px solid #ffffff16}
.atlas-hud .previsions .sb{white-space:normal;font-size:13px}
.atlas-hud .dock{position:absolute;pointer-events:auto;left:50%;bottom:var(--bas);transform:translateX(-50%);display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:8px;width:420px;max-width:calc(100% - 24px);height:var(--dock);filter:drop-shadow(3px 4px 0 #12233270)}
.atlas-hud .dock .p{position:relative;box-shadow:none}
.atlas-hud .jauge{border:0;border-top:3px solid #6d8fa5;clip-path:polygon(9px 0,100% 0,100% 100%,0 100%,0 9px)}
.atlas-hud .jauge button{all:unset;display:flex;align-items:center;gap:9px;box-sizing:border-box;width:100%;height:100%;padding:8px 12px;cursor:pointer}
.atlas-hud .insigne{display:flex;align-items:center;justify-content:center;width:42px;height:48px;flex:none;color:var(--signal);background:#284451;clip-path:polygon(0 0,100% 0,100% 77%,50% 100%,0 77%)}
.atlas-hud .insigne .symbole{width:29px;height:29px;margin-top:-5px}
.atlas-hud .commande{min-width:0;flex:1}
.atlas-hud .commande .tt{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#d4dfe0}
.atlas-hud .energie{display:flex;gap:3px;height:10px;margin:5px 0 3px;transform:skewX(-15deg)}
.atlas-hud .energie>i{height:100%;flex:1;background:#536976;overflow:hidden}
.atlas-hud .energie b{display:block;height:100%;background:var(--signal)}
.atlas-hud .commande .sb{color:var(--signal);font-size:12px;font-weight:750;text-transform:uppercase;letter-spacing:.05em}
.atlas-hud .jauge[data-pret='oui'] .insigne{animation:atlas-pouvoir 1s ease-in-out infinite alternate}
.atlas-hud .fintour button{all:unset;display:flex;box-sizing:border-box;align-items:center;justify-content:center;gap:9px;width:100%;height:100%;min-height:48px;padding:10px 14px;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);font-weight:900;font-size:15px;line-height:1.15;cursor:pointer;text-align:left;background:var(--signal);color:var(--encre);text-transform:uppercase;border-top:3px solid #fff0ac;border-bottom:4px solid #c4923a}
.atlas-hud .fintour .symbole{width:26px;height:26px}
.atlas-hud .fintour-texte{display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-width:0}
.atlas-hud .fintour-texte .tt{font-size:14px;font-weight:900;letter-spacing:.05em}
.atlas-hud .fintour-texte .sb{margin:0;font-size:11px;font-weight:800;letter-spacing:.06em;color:#6b5312;text-transform:none}
.atlas-hud .fintour button[disabled] .fintour-texte .sb{color:#8d9ba1}
.atlas-hud .fintour button[disabled]{background:#344653;color:#a8b9bb;border-color:#60707c}
.atlas-hud .inspect{left:12px;bottom:calc(var(--bas) + var(--dock) + 10px);width:390px;max-width:calc(100% - 84px);border-left:0}
.atlas-hud[data-selection-nouvelle='oui'] .inspect{animation:atlas-inspection .16s ease-out}
.atlas-hud .inspect .in{display:flex;gap:10px;align-items:center;padding:10px 12px}
.atlas-hud .inspect canvas{flex:0 0 auto;width:44px;height:44px;background:#ffffff0a;border-bottom:2px solid #d2b66e}
.atlas-hud .stats{font-size:12px;color:#c0ccd7;margin-top:3px;white-space:normal}
.atlas-hud .retour{all:unset;box-sizing:border-box;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;background:#ffffff10;padding:0 10px;font-size:22px;border:1px solid #ffffff20}
.atlas-hud .inspect .in>.retour:first-of-type{margin-left:auto}
/* Par défaut, le menu est une feuille basse — c'est la bonne forme au doigt. Il
   devient un panneau posé à côté de l'unité dès que l'écran est assez large
   (attribut data-ancre, position calculée par la fonction ancrer). */
.atlas-hud .ordres{left:50%;bottom:calc(var(--bas) + var(--dock) + 10px);transform:translateX(-50%);width:340px;max-width:calc(100% - 24px);padding:10px;z-index:3;max-height:calc(100% - 160px);overflow-y:auto;background:var(--encre);color:var(--papier);border:1px solid #839798;border-top:4px solid var(--signal);animation:atlas-ordres .16s ease-out}
.atlas-hud .ordres[data-ancre='oui'],.atlas-hud .duel[data-ancre='oui']{bottom:auto;right:auto;transform:none;width:190px;max-width:190px}
.atlas-hud .duel[data-ancre='oui']{width:230px;max-width:230px}
.atlas-hud .ordres-entete{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 0 8px 4px}
.atlas-hud .ordres-entete .tt{text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.14em;color:#9fb6b8}
.atlas-hud .ordres .retour{background:#ffffff10;border-color:#ffffff26}
.atlas-hud .ordres-grille{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}
/* Un bouton a une **épaisseur** qui s'écrase ; un panneau est plat. C'est
   l'enfoncement qui dit « pressable », pas la couleur. */
.atlas-hud .ordres-grille button{all:unset;display:flex;box-sizing:border-box;align-items:center;justify-content:flex-start;gap:10px;min-height:46px;padding:10px 12px;cursor:pointer;font-size:14px;font-weight:700;text-align:left;background:#1e3f52;color:var(--papier);border-bottom:3px solid #060f17;border-left:4px solid transparent;transition:background .1s,translate .08s,border-bottom-width .08s}
.atlas-hud .ordres-grille button:hover{background:#2c5670}
.atlas-hud .ordres-grille button:active:not(:disabled){translate:0 2px;border-bottom-width:1px}
/* Les couleurs du plateau ne se posent jamais en aplat sur un bouton : le bleu y
   veut dire « chantier », le rouge « je tire ». Un ordre les **cite** par un
   liseré de 4 px, et rien de plus. */
.atlas-hud .ordres-grille button[data-valeur='attaquer']{border-left:4px solid #ff2e48}
.atlas-hud .ordres-grille button[data-valeur='capturer']{border-left:4px solid #ffc634}
.atlas-hud .ordres-grille button[data-valeur='construire']{border-left:4px solid #4eaaff}
.atlas-hud .ordres-grille .symbole{width:21px;height:21px;color:#9fb6b8}
.atlas-hud .ordres-grille button:hover .symbole{color:var(--signal)}
.atlas-hud .camera{position:absolute;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(var(--bas) + var(--dock) + 10px);pointer-events:auto;display:grid;gap:5px}
.atlas-hud .camera button{all:unset;display:flex;box-sizing:border-box;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid #91a1a3;border-bottom:3px solid #0c1923;background:var(--encre);box-shadow:2px 2px 0 #0002;font-size:25px;cursor:pointer}
.atlas-hud .camera svg{width:21px;height:21px}
.atlas-hud .duel{left:12px;bottom:calc(var(--bas) + var(--dock) + 10px);width:390px;max-width:calc(100% - 84px);border:0;border-top:4px solid #ff6a5e;background:var(--encre);box-shadow:4px 5px 0 #0d1b2470;animation:atlas-inspection .16s ease-out}
.atlas-hud .duel-entete{display:flex;align-items:center;gap:8px;padding:7px 12px 5px;font-size:11px;font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:#ffb3aa}
.atlas-hud .duel-entete .symbole{width:16px;height:16px}
.atlas-hud .duel-entete .issue{margin-left:auto;color:var(--signal);letter-spacing:.08em}
.atlas-hud .duel-camp{display:flex;align-items:center;gap:10px;padding:7px 12px}
.atlas-hud .duel-camp+.duel-camp{border-top:1px solid #ffffff14}
.atlas-hud .duel-camp canvas{flex:0 0 auto;width:36px;height:36px;background:#ffffff0a}
.atlas-hud .duel-camp .tt{font-size:13px}
.atlas-hud .duel-chiffres{margin-left:auto;display:flex;align-items:baseline;gap:6px;font-weight:900;font-size:17px;font-variant-numeric:tabular-nums}
.atlas-hud .duel-chiffres em{font-style:normal;font-size:12px;color:#9fb3b6}
.atlas-hud .duel-chiffres b{color:#ff8e83}
.atlas-hud .duel-camp[data-perte='aucune'] .duel-chiffres b{color:#8ee0a4}
.atlas-hud .pv{display:flex;gap:2px;height:6px;margin-top:5px;min-width:74px}
.atlas-hud .pv i{flex:1;background:#ffffff1f}
.atlas-hud .pv i.plein{background:#8ee0a4}
.atlas-hud .pv i.perdu{background:#ff6a5e}
.atlas-hud .etoiles{letter-spacing:.12em;color:var(--signal)}
.atlas-hud .attente{left:50%;top:calc(var(--haut) + 56px);transform:translateX(-50%);max-width:calc(100% - 24px);z-index:2;border-color:#edac76}
.atlas-hud .attente .in{display:flex;align-items:center;gap:9px;padding:7px 12px}
.atlas-hud .attente .symbole{width:20px;height:20px;animation:atlas-attente 2s steps(4,end) infinite;color:#edac76}
.atlas-hud .annonce{left:50%;bottom:calc(var(--bas) + var(--dock) + 108px);transform:translateX(-50%);max-width:calc(100% - 32px);width:max-content;z-index:4;border-left:4px solid var(--signal)}
.atlas-hud .annonce .tt{white-space:normal;font-size:14px}
.atlas-hud .voile{position:absolute;inset:0;pointer-events:auto;background:#07172499;display:flex;align-items:center;justify-content:center;z-index:5;padding:var(--haut) 12px var(--bas)}
.atlas-hud .modale{position:relative;pointer-events:auto;background:var(--papier);color:var(--encre);border-top:5px solid var(--signal);box-shadow:6px 6px 0 #10212c80;width:420px;max-width:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden}
.atlas-hud .modale h2{margin:0;padding:20px 20px 12px;font-size:20px;font-weight:850;text-transform:uppercase}
.atlas-hud .liste{overflow:auto;overscroll-behavior:contain;padding:2px 12px 6px;flex:1 1 auto}
.atlas-hud .liste button{all:unset;display:flex;box-sizing:border-box;width:100%;gap:12px;align-items:center;min-height:64px;padding:10px 12px;cursor:pointer;margin-bottom:6px;background:#e1ddca;border-left:3px solid #60737a}
.atlas-hud .liste button:hover{background:#d0d7cc}
.atlas-hud .liste canvas{flex:0 0 auto;width:38px;height:38px}
.atlas-hud .liste .cout{font-size:14px;color:#45606b}
.atlas-hud .liste .cout.dur{color:#9a4a42;font-weight:750}
/* L'appel à l'action : « Production » tant que la fiche est fermée, « Produire »
   une fois qu'on a lu. Le même bouton, deux temps — on informe sans coûter un
   geste à qui sait déjà ce qu'il achète. */
.atlas-hud .liste .cta{margin-left:auto;flex:0 0 auto;font-size:11px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;color:#45606b}
.atlas-hud .production button[aria-expanded='true']{background:#d0d7cc;border-left-color:var(--signal);margin-bottom:0}
.atlas-hud .production button[aria-expanded='true'] .cta{color:#1d3a2a}
/* La fiche : tout ce que le canon sait dire de l'unité, et rien d'inventé. */
/* La fiche, à la manière d'Advance Wars : un cadre à biseau, des titres en
   rubans, des statistiques dites par un signe, et la table de dégâts en rangée
   de figurines avec le chiffre sous chacune. Une seule feuille de règles pour le
   menu de production et le panneau d'inspection ; deux jeux de couleurs. */
.atlas-hud .fiche{--f-encre:#e8eef2;--f-doux:#9db3bf;--f-fond:#0f1e27;--f-cadre:#3c5563;--f-biseau:#ffffff1f;--f-ruban:#233a46;--f-ruban-texte:#e6dcc0;--f-plaque:#ffffff0d;--f-plaque-bord:#ffffff1a;--f-fort:#8fe0a0;--f-danger:#ffab8e;background:var(--f-fond);color:var(--f-encre);border:2px solid var(--f-cadre);box-shadow:inset 0 0 0 1px var(--f-biseau);padding:9px 10px 10px;font-size:12.5px;line-height:1.35}
.atlas-hud .production .fiche{--f-encre:#1e3038;--f-doux:#5d7480;--f-fond:#f1ede0;--f-cadre:#2d3f48;--f-biseau:#ffffffb0;--f-ruban:#2d3f48;--f-ruban-texte:#f4edda;--f-plaque:#ffffff99;--f-plaque-bord:#00000018;--f-fort:#2f7a3d;--f-danger:#b0402e;margin:0 0 8px}
.atlas-hud .inspect .fiche{border-top-width:2px;max-height:46vh;overflow:auto;overscroll-behavior:contain}
.atlas-hud .fiche p{margin:0}
/* Les statistiques : le signe, puis le chiffre. Pas de mot. */
.atlas-hud .fiche .chiffres{display:flex;flex-wrap:wrap;gap:4px 6px;margin-bottom:8px}
.atlas-hud .fiche .stat{display:inline-flex;align-items:center;gap:5px;padding:3px 9px 3px 6px;background:var(--f-plaque);border:1px solid var(--f-plaque-bord);color:var(--f-doux)}
.atlas-hud .fiche .stat .symbole{width:15px;height:15px;flex:0 0 auto}
.atlas-hud .fiche .stat b{font-size:13.5px;font-weight:850;font-variant-numeric:tabular-nums;color:var(--f-encre)}
.atlas-hud .fiche .avert{margin:0 0 8px;padding:5px 8px;background:#3a2620;border-left:3px solid #c07a55;color:#f0d9cc;font-weight:700}
.atlas-hud .fiche .avert.bon{background:#1e3325;border-left-color:#5aa84c;color:#d6ecd2}
.atlas-hud .production .fiche .avert{background:#e3d2c6;border-left-color:#a86a4a;color:#1e3038}
.atlas-hud .production .fiche .avert.bon{background:#d3e0cd;border-left-color:#4e8f43}
.atlas-hud .fiche .bloc{margin:0 0 9px}
.atlas-hud .fiche .bloc:last-child{margin-bottom:0}
/* Le titre est un ruban : une bande pleine, coupée en biseau, comme les
   fenêtres du jeu d'origine. */
.atlas-hud .fiche h4{margin:0 0 5px;font-size:10px;font-weight:850;letter-spacing:.1em;text-transform:uppercase;line-height:1}
.atlas-hud .fiche h4 span{display:inline-block;padding:4px 10px 4px 7px;background:var(--f-ruban);color:var(--f-ruban-texte);clip-path:polygon(0 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.atlas-hud .fiche .corps{display:flex;flex-wrap:wrap;gap:5px}
/* La table de dégâts : une figurine, le chiffre dessous, le nom en tout petit.
   Le chiffre prend la couleur de ce qu'il signifie — vert quand c'est nous qui
   frappons, rouge quand c'est nous qui encaissons. */
.atlas-hud .fiche .duel{display:inline-flex;flex-direction:column;align-items:center;width:58px;padding:4px 2px 3px;background:var(--f-plaque);border:1px solid var(--f-plaque-bord);text-align:center}
.atlas-hud .fiche .duel canvas{width:34px;height:34px;display:block}
.atlas-hud .fiche .duel i{font-style:normal;font-size:12.5px;font-weight:850;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:1px}
.atlas-hud .fiche .duel small{display:block;max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:700;letter-spacing:.02em;color:var(--f-doux);margin-top:1px}
.atlas-hud .fiche .fort .duel i{color:var(--f-fort)}
.atlas-hud .fiche .danger .duel i{color:var(--f-danger)}
.atlas-hud .fiche .puce{display:inline-flex;align-items:center;padding:3px 8px;background:var(--f-plaque);border:1px solid var(--f-plaque-bord);font-weight:700;white-space:nowrap}
.atlas-hud .fiche .deux{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
.atlas-hud .fiche .note{font-size:12px;font-weight:700;color:var(--f-doux)}
@media(max-width:360px){.atlas-hud .fiche .deux{grid-template-columns:1fr}}
.atlas-hud .detail{all:unset;box-sizing:border-box;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin-left:auto;background:#ffffff10;border:1px solid #ffffff20;font-size:15px;font-weight:850;font-style:italic;color:#d6e2ea}
.atlas-hud .detail[aria-expanded='true']{background:var(--signal);border-color:var(--signal);color:#10222b;font-style:normal}
.atlas-hud .inspect .detail+.retour{margin-left:6px}
@media(max-width:480px){
  .atlas-hud .liste button:not([aria-expanded='true']) .cta{display:none}
}
.atlas-hud .pied{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px 16px}
.atlas-hud .pied button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-height:48px;padding:12px 20px;cursor:pointer;font-weight:750;background:var(--encre);color:var(--papier)}
.atlas-hud .fin{text-align:center;padding:26px 24px 22px}
.atlas-hud .fin .grand{font-size:26px;font-weight:850;letter-spacing:-.01em}
.atlas-hud .fin .sb{color:#536e78}
.atlas-tour{position:absolute;left:0;right:0;top:38%;z-index:7;pointer-events:none;display:flex;align-items:center;justify-content:center;gap:18px;padding:16px 24px;background:linear-gradient(110deg,transparent 3%,#152c3bf2 3%,#152c3bf2 97%,transparent 97%);color:#f4edda;border-block:3px solid var(--teinte,#ffd162);font-family:system-ui,sans-serif;animation:atlas-tour 1.15s ease both}
.atlas-tour .symbole{width:42px;height:42px;color:var(--teinte,#ffd162)}
.atlas-tour strong{display:block;font-size:26px;line-height:1.15;text-transform:uppercase;font-weight:900;letter-spacing:.03em}
.atlas-tour span{display:block;margin-top:5px;font-size:13px;font-weight:750;text-transform:uppercase;letter-spacing:.14em;color:var(--teinte,#ffd162)}
@keyframes atlas-tour{0%{opacity:0;transform:translateX(-15%)}15%,78%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(15%)}}
@keyframes atlas-inspection{from{opacity:0;translate:0 5px}to{opacity:1;translate:0 0}}
@keyframes atlas-ordres{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
@keyframes atlas-pouvoir{from{color:#ffd162}to{color:white;filter:drop-shadow(0 0 5px #ffd162)}}
@keyframes atlas-attente{to{transform:rotate(360deg)}}
@container atlas-interface (max-width: 600px){
  .atlas-hud .jour{padding:0 12px 0 8px;gap:5px;font-size:12px}
  .atlas-hud .fonds{padding-right:8px;font-size:13px}
  .atlas-hud .bulletin{width:116px}
  .atlas-hud .partie{max-width:calc(100% - 132px)}
  .atlas-hud .dock{width:calc(100% - 24px)}
  .atlas-hud .jauge button{gap:7px;padding:7px 9px}
  .atlas-hud .insigne{width:34px;height:43px}
  .atlas-hud .fintour button{font-size:14px;padding:10px;gap:7px}
  .atlas-hud .inspect .sb{font-size:12px}
  .atlas-hud .inspect .in{padding:8px 10px;gap:8px}
  .atlas-hud .inspect canvas{width:36px;height:36px}
  .atlas-hud .inspect .tt{font-size:14px}
  .atlas-hud .voile{align-items:flex-end}
}
@container atlas-interface (max-width: 360px){.atlas-hud .fonds .symbole{display:none}}
@container atlas-interface (max-height: 500px){
  .atlas-hud>*{--dock:60px;--bas:calc(8px + env(safe-area-inset-bottom,0px));--haut:calc(8px + env(safe-area-inset-top,0px))}
  .atlas-hud .dock{left:auto;right:max(12px,env(safe-area-inset-right,0px));transform:none;width:340px;max-width:50%}
  .atlas-hud .jauge button{padding:4px 9px}
  .atlas-hud .energie{height:8px;margin:3px 0}
  .atlas-hud .inspect{bottom:var(--bas);max-width:calc(50% - 30px);width:360px}
  .atlas-hud .inspect .in{padding:6px 10px}
  .atlas-hud .camera{bottom:calc(var(--bas) + var(--dock) + 8px);display:flex}
  .atlas-hud .ordres:not([data-ancre='oui']){left:auto;right:max(12px,env(safe-area-inset-right,0px));transform:none;width:320px;max-width:52%;max-height:calc(100% - 94px)}
  .atlas-hud .ordres-entete{padding-bottom:5px}
  .atlas-hud .ordres-grille{gap:5px}
  .atlas-hud .ordres-grille button{min-height:44px;padding:8px}
  .atlas-hud .annonce{bottom:calc(var(--bas) + var(--dock) + 12px);max-width:45%;left:24%;z-index:4}
}
.atlas-hud button[data-action]{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:filter .1s,translate .1s}
.atlas-hud button[data-action]:active:not(:disabled){translate:0 2px;filter:brightness(1.13)}
.atlas-hud button[data-action]:disabled{opacity:.45;cursor:default!important}
.atlas-hud button:focus-visible,.atlas-hud summary:focus-visible{outline:3px solid #ffd162!important;outline-offset:-3px}
@media(prefers-reduced-motion:reduce){.atlas-hud *,.atlas-tour{animation:none!important;transition:none!important}}
`;

/** Injecte la feuille de style du HUD si le document ne l'a pas encore. */
function poserStyle(doc: Document): void {
  if (doc.getElementById('atlas-hud-style')) return;
  const style = doc.createElement('style');
  style.id = 'atlas-hud-style';
  style.textContent = STYLE;
  doc.head.appendChild(style);
}

/** Icône de météo : un petit SVG, dessiné par code comme le reste du jeu. */
function iconeMeteo(m: Meteo): string {
  const s = (contenu: string): string => `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">${contenu}</svg>`;
  const nuage = '<path d="M6 17h13a4 4 0 0 0 .3-8 6 6 0 0 0-11.5 1.4A3.4 3.4 0 0 0 6 17z" fill="#c3cbd8"/>';
  switch (m) {
    case 'clair':
      return s('<circle cx="13" cy="13" r="5.4" fill="#ffd66b"/><g stroke="#ffd66b" stroke-width="1.7" stroke-linecap="round"><path d="M13 2v3M13 21v3M2 13h3M21 13h3M5.2 5.2l2.1 2.1M18.7 18.7l2.1 2.1M20.8 5.2l-2.1 2.1M7.3 18.7l-2.1 2.1"/></g>');
    case 'pluie':
      return s(`${nuage}<g stroke="#7fb6ff" stroke-width="2" stroke-linecap="round"><path d="M9 19l-1.4 4M14 19l-1.4 4M19 19l-1.4 4"/></g>`);
    case 'tempete':
      return s(`${nuage}<path d="M13.5 18l-4.5 5h3.4l-1.4 4 5.5-6h-3.3l1.6-3z" fill="#ffd66b"/>`);
    case 'neige':
      return s(`${nuage}<g fill="#ffffff"><circle cx="9" cy="21" r="1.7"/><circle cx="14" cy="22.5" r="1.7"/><circle cx="19" cy="21" r="1.7"/></g>`);
    case 'brouillard':
      return s('<g stroke="#ccd7e0" stroke-width="2.6" stroke-linecap="round"><path d="M4 8h18M4 13h18M4 18h13"/></g>');
    case 'canicule':
      return s('<circle cx="13" cy="10" r="5" fill="#ff9a3c"/><g stroke="#ff9a3c" stroke-width="2" stroke-linecap="round" fill="none"><path d="M4 18c3-3 6 3 9 0s6 3 9 0M4 23c3-3 6 3 9 0s6 3 9 0"/></g>');
    default:
      return s('');
  }
}

/** Pictogrammes de commandement, partagés entre ordres et barre de combat. */
function iconeOrdre(type: string): string {
  const chemins: Record<string, string> = {
    jour: '<path d="M5 3v3m14-3v3M3 9h18M4 5h16v16H4z"/><path d="M8 13h2m4 0h2m-8 4h2m4 0h2"/>',
    fonds: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    pouvoir: '<path d="m13 2-9 12h7l-1 8 10-13h-7z" fill="currentColor" stroke="none"/>',
    capturer: '<path d="M5 22V3m0 1c5-4 8 4 14 0v10c-6 4-9-4-14 0"/>',
    attaquer: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
    attendre: '<path d="M6 3h12M6 21h12M7 3v5l10 8v5M17 3v5L7 16v5"/>',
    construire: '<path d="m4 20 10-10M14 3a6 6 0 0 0-4 8l-8 8 3 3 8-8a6 6 0 0 0 8-5l-4 3-4-4 3-4z"/>',
    ravitailler: '<path d="M4 7h13v14H4zM7 7V3h7v4M17 9l4 3v6h-4M8 14h5m-2.5-2.5v5"/>',
    fusionner: '<path d="M4 4v5l8 6 8-6V4M12 15v7m-4-5 4 5 4-5"/>',
    fin_de_tour: '<path d="M5 4l10 8-10 8z"/><path d="M19 4v16"/>',
    embarquer: '<path d="M3 16h18v5H3zM12 2v11m-5-5 5 5 5-5"/>',
    debarquer: '<path d="M3 16h18v5H3zM12 13V2M7 7l5-5 5 5"/>',
    // Les statistiques d'une unité, dites par un signe et non par un mot — c'est
    // la grammaire d'Advance Wars : une botte, un œil, une cible, une balle.
    mouvement: '<path d="M6 20V9l4-5 2 4h5v6h-3l-2 6zM6 20h12"/>',
    vue: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
    portee: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
    munitions: '<path d="M9 21V9a3 3 0 0 1 6 0v12zM9 17h6M12 6V3"/>',
    carburant: '<path d="M5 21V4h9v17zM5 9h9M14 8l3 2v8a2 2 0 0 0 4 0V9l-3-3"/>',
  };
  return `<svg class="symbole" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${chemins[type] ?? chemins['capturer']}</svg>`;
}

/** Une vignette d'unité à peindre après insertion : le sprite vectoriel partagé. */
interface Vignette { id: string; silhouette: Silhouette; camp: CampId; taille: number }

/**
 * Monte le HUD HTML dans un conteneur (le même que le canvas, en position
 * relative). Rend `rafraichir()` et `demonter()`.
 */
export function monterHudHtml(conteneur: HTMLElement, api: ApiHud): HudHtml {
  const doc = conteneur.ownerDocument;
  poserStyle(doc);
  const racine = doc.createElement('div');
  racine.className = 'atlas-hud';
  racine.setAttribute('data-hud', 'html');
  conteneur.appendChild(racine);

/** Sursis du panneau d'inspection : le temps d'atteindre son bouton. */
const MS_SURSIS_INSPECTION = 1500;

  let vignettes: Vignette[] = [];
  // L'unité dont la fiche est dépliée dans le menu de production. Un premier
  // appui l'ouvre, un second produit : on informe sans coûter un geste à qui
  // sait déjà ce qu'il achète.
  let ficheOuverte: CleUnite | null = null;
  // La fiche du panneau d'inspection, elle, **reste ouverte** d'une case à
  // l'autre : c'est une façon de jouer, pas un choix par unité. Qui apprend la
  // laisse dépliée, qui connaît la referme une fois.
  let ficheInspection = false;
  /** La dernière unité montrée par le panneau. Voir `panneauInspection`. */
  let derniereInspectee: string | null = null;
  /** Le pointeur est sur un panneau du HUD : il vient chercher une commande. */
  let pointeurSurHud = false;
  /** Quand le panneau a montré une unité pour la dernière fois. */
  let vueA = 0;
  let graceInspection: ReturnType<typeof setTimeout> | null = null;
  let tourAffiche = '';
  let derniereSelection: string | null = null;
  let minuterieTour: ReturnType<typeof setTimeout> | null = null;
  let banniereTour: HTMLDivElement | null = null;

  /**
   * Le bandeau de tour. Il **attend qu'un commandant ait fini de parler** : une
   * scène de dialogue et un « à vous de jouer » lancés ensemble se disputent le
   * même instant et le joueur ne lit ni l'un ni l'autre.
   *
   * L'annonce n'est pas perdue, elle est **réarmée** : on efface le tour déjà
   * annoncé, de sorte que la première image après la dernière réplique la
   * rejoue. Le joueur reçoit donc les deux, l'un après l'autre, dans l'ordre où
   * ils veulent dire quelque chose.
   */
  function annoncerTour(v: VueJeu): void {
    const cle = `${v.etat.journee}:${v.etat.campCourant}`;
    if (v.sceneOuverte) {
      banniereTour?.remove();
      banniereTour = null;
      if (minuterieTour) clearTimeout(minuterieTour);
      minuterieTour = null;
      tourAffiche = '';
      return;
    }
    if (v.etat.partie.terminee || cle === tourAffiche) return;
    tourAffiche = cle;
    if (minuterieTour) clearTimeout(minuterieTour);
    banniereTour?.remove();
    banniereTour = doc.createElement('div');
    banniereTour.className = 'atlas-tour';
    banniereTour.setAttribute('role', 'status');
    banniereTour.style.setProperty('--teinte', v.etat.campCourant === v.camp ? '#ffd162' : '#f59a95');
    banniereTour.innerHTML = iconeOrdre('capturer')
      + `<div><strong>${ech(api.t(v.etat.campCourant === v.camp ? 'hud.votre_tour' : 'hud.tour_adverse'))}</strong>`
      + `<span>${ech(api.t('hud.journee', { n: Math.max(1, v.etat.journee) }))}</span></div>`;
    conteneur.appendChild(banniereTour);
    minuterieTour = setTimeout(() => { banniereTour?.remove(); banniereTour = null; }, 1150);
  }

  // -------------------------------------------------------------------------
  // Panneaux
  // -------------------------------------------------------------------------

  function panneauPartie(v: VueJeu): string {
    // Les fonds affichés sont **les miens**, pas ceux du camp qui joue : pendant
    // le tour adverse, montrer sa trésorerie est une fuite d'information autant
    // qu'une confusion.
    const camp = v.etat.camps.find((c) => c.id === v.camp);
    const journee = api.t('hud.journee', { n: Math.max(1, v.etat.journee) });
    const fonds = api.t('hud.fonds', { n: nombreIntl(v.locale, camp?.fonds ?? 0) });
    // Le liseré, lui, dit **qui joue** : c'est la seule chose qui change de camp.
    const bord = paletteDe(v.etat.campCourant).main;
    return `<div class="partie" role="group" aria-label="${ech(api.t('hud.partie_en_cours'))}">`
      + `<div class="jour" style="border-left:4px solid ${bord}">${iconeOrdre('jour')}<span>${ech(journee)}</span></div>`
      + `<div class="fonds" aria-label="${ech(fonds)}" title="${ech(fonds)}">${iconeOrdre('fonds')}<span>${ech(nombreIntl(v.locale, camp?.fonds ?? 0))}</span></div></div>`;
  }

  function panneauBulletin(v: VueJeu): string {
    // Le Bulletin annonce **ce que le joueur voit** : il lit l'ambiance affichée,
    // qu'un aperçu peut avoir forcée, et non le climat brut de l'état.
    const a = v.ambiance;
    const c = v.etat.climat;
    const ligne1 = `${libelleSaison(api.t, a.saison)} · ${libellePhase(api.t, a.phase)}`;
    const ligne2 = libelleMeteo(api.t, a.meteo);
    const ligne3 = api.t('hud.bulletin', {
      j1: libelleMeteo(api.t, c.previsions[0]),
      j2: libelleMeteo(api.t, c.previsions[1]),
    });
    return `<details class="bulletin" aria-label="${ech(api.t('hud.bulletin_titre'))}">`
      + `<summary>${iconeMeteo(a.meteo)}<span style="min-width:0">`
      + `<span class="tt" style="display:block">${ech(ligne2)}</span></span></summary>`
      + `<div class="previsions"><div class="sb">${ech(ligne1)}</div><div class="sb">${ech(ligne3)}</div></div></details>`;
  }

  function panneauJauge(v: VueJeu): string {
    const camp = v.etat.camps.find((c) => c.id === v.camp);
    if (!camp) return '';
    const pal = paletteDe(v.camp);
    const nom = nomCommandant(v.locale, camp.commandantCle) || api.t('hud.commandant');
    const part = camp.jaugeMax > 0 ? Math.min(1, camp.jauge / camp.jaugeMax) : 0;
    const pleine = part >= 1;
    // Un bouton cliquable qui fait refuser l'action est un bouton qui ment : la
    // jauge doit être pleine, sinon le pouvoir n'est pas disponible.
    const actif = pleine && !v.attenteIa && !v.etat.partie.terminee
      && v.etat.campCourant === v.camp;
    const segments = Math.min(10, Math.max(1, Math.ceil(camp.jaugeMax / 100)));
    const energie = Array.from({ length: segments }, (_, i) => `<i><b style="width:${Math.max(0, Math.min(1, part * segments - i)) * 100}%"></b></i>`).join('');
    const libelle = api.t(pleine ? 'hud.pouvoir_pret' : 'hud.jauge_pouvoir');
    return `<div class="p jauge" data-pret="${pleine ? 'oui' : 'non'}" style="border-color:${pal.light}">`
      + `<button type="button" data-action="pouvoir" aria-label="${ech(nom)} · ${ech(libelle)}"${actif ? '' : ' disabled'}>`
      + `<span class="insigne">${iconeOrdre('pouvoir')}</span><span class="commande">`
      + `<span class="tt" style="display:block">${ech(nom)}</span>`
      + `<span class="energie" aria-hidden="true">${energie}</span>`
      + `<span class="sb" style="display:block">${ech(libelle)}</span>`
      + `</span></button></div>`;
  }

  function panneauInspection(v: VueJeu, duelOuvert: boolean): string {
    if (v.menu || duelOuvert) return '';
    const sousCurseur = v.curseur
      ? v.etat.unites.find((u) => !u.dansTransport && u.x === v.curseur!.x && u.y === v.curseur!.y)
      : undefined;

    // Quelle unité le panneau montre, dans cet ordre :
    //
    // 1. **celle sous le curseur**, s'il y en a une : inspecter l'adversaire
    //    qu'on s'apprête à frapper doit rester possible même en pleine visée ;
    // 2. **celle qu'on a sélectionnée**. Cliquer une unité doit afficher son
    //    détail — c'est l'attente évidente, et le panneau l'ignorait. C'est
    //    aussi le seul chemin au doigt, où le survol n'existe pas ;
    // 3. **la dernière montrée**, tant qu'on lit sa fiche ou que le pointeur
    //    est sur le HUD. Le bouton vit dans le panneau, en bas à gauche : pour
    //    l'atteindre, la souris quitte l'unité et traverse des cases vides, ce
    //    qui faisait disparaître le bouton avant qu'on l'ait touché. Hors de ces
    //    deux cas, le panneau suit le curseur comme avant — une case vide doit
    //    pouvoir montrer son terrain et sa défense.
    const selectionnee = v.selection
      ? v.etat.unites.find((u) => u.id === v.selection)
      : undefined;
    // Le sursis : entre l'unité et le bouton il y a des cases vides, et la
    // souris les traverse forcément. Une seconde et demie suffit à faire le
    // trajet, et ne suffit pas à donner l'impression que le panneau est collé.
    const enSursis = Date.now() - vueA < MS_SURSIS_INSPECTION;
    const retenue = (ficheInspection || pointeurSurHud || enSursis) && derniereInspectee
      ? v.etat.unites.find((u) => u.id === derniereInspectee)
      : undefined;
    const unite = sousCurseur ?? selectionnee ?? retenue;
    if (unite) {
      derniereInspectee = unite.id;
      vueA = Date.now();
      // Le sursis expire tout seul : sans ce rappel, le panneau garderait son
      // unité jusqu'au prochain mouvement, c'est-à-dire parfois indéfiniment.
      if (graceInspection) clearTimeout(graceInspection);
      graceInspection = setTimeout(rafraichir, MS_SURSIS_INSPECTION + 40);
    }

    // Le terrain est celui de l'unité montrée : un panneau qui titre « Char
    // léger » et sous-titre le terrain d'une case vide se contredit.
    const c = unite ? { x: unite.x, y: unite.y } : v.curseur;
    if (!c) return '';
    const terrain = terrainLogique(v.etat, v.catalogue, c);
    if (terrain === null) return '';
    const type = unite ? v.catalogue.unites[unite.type] : undefined;
    const fiche = v.catalogue.terrains[terrain];
    const etoiles = Math.max(0, Math.min(4, fiche?.defense ?? 0));
    const defense = `<span class="etoiles" aria-label="${ech(api.t('hud.defense', { n: etoiles }))}">`
      + `${'\u2605'.repeat(etoiles)}${'\u2606'.repeat(4 - etoiles)}</span>`;
    const titre = unite && type
      ? nomUnite(v.locale, v.catalogue, unite.type)
      : nomTerrain(v.locale, v.catalogue, terrain);
    const sousTitre = unite
      ? `${ech(nomTerrain(v.locale, v.catalogue, terrain))} · ${defense}`
      : defense;
    const lignes: string[] = [];
    if (unite && type) {
      lignes.push(api.t('hud.points_de_vie', { n: pvAffiches(unite.pv) }));
      lignes.push(api.t('hud.mouvement', { n: type.mouvement }));
      if (unite.munitions !== null) lignes.push(api.t('hud.munitions', { n: unite.munitions }));
      if (unite.carburant !== null) lignes.push(api.t('hud.carburant', { n: unite.carburant }));
    }
    let icone = '';
    if (unite && type) {
      const id = `vg${vignettes.length}`;
      vignettes.push({ id, silhouette: type.silhouette, camp: unite.camp, taille: 46 });
      icone = `<canvas data-vignette="${id}" width="46" height="46"></canvas>`;
    }
    const bord = unite ? paletteDe(unite.camp).main : paletteDe(null).main;
    // Le bouton n'apparaît que sur une unité : un terrain n'a pas de fiche, et
    // une case vide ne doit pas offrir une commande qui ne ferait rien.
    const detail = unite
      ? `<button type="button" class="detail" data-action="fiche" aria-expanded="${ficheInspection}" `
        + `aria-label="${ech(api.t('fiche.detail'))}" title="${ech(api.t('fiche.detail'))}">`
        + `<span aria-hidden="true">${ficheInspection ? '\u25B2' : 'i'}</span></button>`
      : '';
    return `<div class="p inspect" role="group" aria-label="${ech(api.t('hud.panneau_unite'))}">`
      + `<span class="bord" style="background:${bord}"></span>`
      + `<div class="in">${icone}<div style="min-width:0">`
      + `<div class="tt">${ech(titre)}</div><div class="sb">${sousTitre}</div>`
      + (lignes.length > 0 ? `<div class="stats">${ech(lignes.join(' · '))}</div>` : '')
      + `</div>${detail}${v.selection && !v.attenteIa ? boutonRetour() : ''}</div>`
      + (unite && ficheInspection ? blocFiche(v, unite.type) : '')
      + `</div>`;
  }

  /** Une jauge de PV en dix crans : pleine, perdue à l'échange, vide. */
  function jaugePv(avant: number, apres: number): string {
    const crans = Array.from({ length: 10 }, (_, i) => {
      if (i < apres) return '<i class="plein"></i>';
      if (i < avant) return '<i class="perdu"></i>';
      return '<i></i>';
    }).join('');
    return `<span class="pv" aria-hidden="true">${crans}</span>`;
  }

  /** Une ligne de duel : vignette, nom, PV avant → après, jauge. */
  function ligneDuel(v: VueJeu, unite: Unite, apres: number): string {
    const type = v.catalogue.unites[unite.type];
    if (!type) return '';
    const avant = pvAffiches(unite.pv);
    const id = `vg${vignettes.length}`;
    vignettes.push({ id, silhouette: type.silhouette, camp: unite.camp, taille: 36 });
    return `<div class="duel-camp" data-perte="${apres >= avant ? 'aucune' : 'oui'}">`
      + `<canvas data-vignette="${id}" width="36" height="36"></canvas>`
      + `<span style="min-width:0"><span class="tt" style="display:block">${ech(nomUnite(v.locale, v.catalogue, unite.type))}</span>`
      + jaugePv(avant, apres)
      + `</span><span class="duel-chiffres">${ech(String(avant))}<em>&rarr;</em><b>${ech(String(apres))}</b></span></div>`;
  }

  /**
   * La **prévision de duel** : ce que l'échange coûterait aux deux camps, avant
   * de confirmer. C'est l'information qu'Advance Wars met sous le curseur, et
   * sans laquelle une attaque est un pari plutôt qu'une décision.
   *
   * La prévision est la valeur **nominale** (`prevoirDuel`) : le tirage réel
   * s'en écarte de ±5 %, jamais davantage.
   */
  function panneauDuel(v: VueJeu): string {
    const visee = v.visee;
    // La prévision suit la cible **pointée**, pas le curseur : au doigt il n'y a
    // pas de survol, et une prévision qui n'existe qu'à la souris ne sert à rien.
    const c = visee?.cible ?? null;
    if (!visee || !c) return '';
    if (!visee.cibles.some((cible) => cible.x === c.x && cible.y === c.y)) return '';
    const attaquant = uniteParId(v.etat, visee.attaquantId);
    const cible = v.etat.unites.find((u) => !u.dansTransport && u.x === c.x && u.y === c.y);
    if (!attaquant || !cible) return '';
    const p = prevoirDuel(v.etat, v.catalogue, attaquant, cible, visee.depuis);
    const issue = api.t(p.cibleHorsJeu ? 'hud.duel_hors_jeu' : 'hud.duel_riposte', {
      n: pvAffiches(attaquant.pv) - p.pvAttaquant,
    });
    return `<div class="p duel"${ancrer(c, 150)} role="group" aria-label="${ech(api.t('hud.duel'))}">`
      + `<div class="duel-entete">${iconeOrdre('attaquer')}<span>${ech(api.t('hud.duel'))}</span>`
      + `<span class="issue">${ech(issue)}</span></div>`
      + ligneDuel(v, cible, p.pvCible)
      + ligneDuel(v, attaquant, p.pvAttaquant)
      + '</div>';
  }

  function panneauOrdres(v: VueJeu): string {
    if (!v.menu || v.menu.options.length === 0) return '';
    const boutons = v.menu.options.map((o) => (
      `<button type="button" data-action="suite" data-valeur="${ech(o.id)}"${o.disponible ? '' : ' disabled'}>`
      + `${iconeOrdre(o.id)}<span>${ech(api.t(o.cle))}</span></button>`
    )).join('');
    // Hauteur estimée du panneau : en-tête, lignes de 46 px, marges.
    const hauteur = 44 + v.menu.options.length * 50 + 12;
    return `<div class="p ordres"${ancrer(v.menu.ancre, hauteur)} role="group" aria-label="${ech(api.t('hud.menu_ordres'))}">`
      + `<div class="ordres-entete"><div class="tt">${ech(api.t('hud.menu_ordres'))}</div>${boutonRetour()}</div>`
      + `<div class="ordres-grille">${boutons}</div></div>`;
  }

  /** Largeur d'un panneau ancré à une case, en pixels. */
  const LARGEUR_ANCRE = 190;
  /** Écart entre le centre de la case et le bord du panneau. */
  const ECART_ANCRE = 36;
  /** En deçà, l'écran est trop étroit pour poser un panneau à côté d'une case. */
  const LARGEUR_MINIMALE_ANCRE = 680;

  /**
   * Pose un panneau **à côté** de la case qu'il commente.
   *
   * C'est la contrainte qui gouverne tout le HUD : ne jamais couvrir la case sur
   * laquelle on joue. Le panneau se place à droite de la case, bascule à gauche
   * s'il déborde, et se cale à douze pixels des bords. Sur un écran étroit, ou
   * quand la case est hors champ, on rend une chaîne vide et le CSS reprend la
   * main avec une feuille basse — c'est le bon comportement au doigt.
   */
  function ancrer(c: Case | null | undefined, hauteur: number): string {
    const L = racine.clientWidth;
    const H = racine.clientHeight;
    if (!c || L < LARGEUR_MINIMALE_ANCRE) return '';
    const p = api.versEcran(c);
    if (!p) return '';
    const droite = p.x + ECART_ANCRE + LARGEUR_ANCRE <= L - 12;
    const x = droite ? p.x + ECART_ANCRE : p.x - ECART_ANCRE - LARGEUR_ANCRE;
    const y = p.y - hauteur / 2;
    const cx = Math.round(Math.max(12, Math.min(L - LARGEUR_ANCRE - 12, x)));
    const cy = Math.round(Math.max(12, Math.min(Math.max(12, H - hauteur - 12), y)));
    return ` data-ancre="oui" style="left:${cx}px;top:${cy}px"`;
  }

  function boutonRetour(): string {
    const titre = ech(api.t('menu.retour'));
    return `<button type="button" class="retour" data-action="fermer" aria-label="${titre}" title="${titre}"><span aria-hidden="true">↶</span></button>`;
  }

  function panneauCamera(): string {
    if (!api.zoomer && !api.recentrer) return '';
    const bouton = (action: string, cle: string, contenu: string): string => `<button type="button" data-action="${action}" aria-label="${ech(api.t(cle))}" title="${ech(api.t(cle))}"><span aria-hidden="true">${contenu}</span></button>`;
    return '<div class="camera">'
      + (api.zoomer ? bouton('zoom_plus', 'hud.zoom_plus', '+') + bouton('zoom_moins', 'hud.zoom_moins', '−') : '')
      + (api.recentrer ? bouton('recentrer', 'hud.recentrer', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg>') : '')
      + '</div>';
  }

  /**
   * Fin de tour, et **ce qu'il reste à jouer**. Le compte se lit sur l'état, sans
   * rien demander au moteur : une unité prête est une unité de mon camp qui n'a
   * pas agi et qui n'est pas dans un transport. C'est l'information qui manquait
   * pour ne pas terminer son tour par accident.
   */
  function panneauFinTour(v: VueJeu): string {
    const actif = !v.attenteIa && !v.etat.partie.terminee && v.etat.campCourant === v.camp;
    const pretes = v.etat.unites.filter(
      (u) => u.camp === v.camp && u.etat === 'prete' && !u.dansTransport,
    ).length;
    const reste = pretes > 0 ? api.t('hud.unites_pretes', { n: pretes }) : api.t('hud.tout_joue');
    return `<div class="fintour">`
      + `<button type="button" data-action="fin_tour"${actif ? '' : ' disabled'} `
      + `data-reste="${pretes > 0 ? 'oui' : 'non'}">${iconeOrdre('fin_de_tour')}`
      + `<span class="fintour-texte"><span class="tt">${ech(api.t('hud.fin_de_tour'))}</span>`
      + `<span class="sb">${ech(reste)}</span></span></button></div>`;
  }

  function panneauAttente(v: VueJeu): string {
    if (!v.attenteIa) return '';
    const pal = paletteDe(v.camp === 0 ? 1 : 0);
    return `<div class="p attente"><span class="bord" style="background:${pal.main}"></span>`
      + `<div class="in">${iconeOrdre('attendre')}<div class="tt">${ech(api.t('hud.tour_adverse'))}</div></div></div>`;
  }

  function panneauAnnonce(v: VueJeu): string {
    if (!v.annonce) return '';
    return `<div class="p annonce"><div class="in"><div class="tt">${ech(v.annonce)}</div></div></div>`;
  }

  /**
   * Le corps d'une fiche d'unité : ce qu'elle démolit, ce qui la démolit, où
   * elle passe et ce qui la ralentit.
   *
   * Le même balisage sert au menu de production — avant l'achat — et au panneau
   * d'inspection — une fois l'unité sur la carte. Ce sont les mêmes questions,
   * et il serait absurde qu'elles reçoivent deux réponses. Seules les couleurs
   * changent, par le CSS : papier dans la modale, encre sous le curseur.
   */
  function blocFiche(v: VueJeu, cle: CleUnite): string {
    const f = ficheUnite(v.catalogue, cle);
    const type = v.catalogue.unites[cle];
    if (!f || !type) return '';
    const nomDe = (c: CleUnite): string => nomUnite(v.locale, v.catalogue, c);
    const nomT = (t: CleTerrain): string => nomTerrain(v.locale, v.catalogue, t);
    // Advance Wars ne décrit pas, il **montre** : une botte plutôt que « Mouv. »,
    // et la table de dégâts en rangée de figurines avec le chiffre dessous.
    // Les vignettes portent les couleurs de l'adversaire : ce sont ses unités
    // qu'on frappe, et ce sont les siennes qu'on craint.
    const adversaire: CampId = v.etat.camps.find((c) => c.id !== v.camp)?.id ?? 1;
    const stat = (icone: string, valeur: string | number, titre: string): string =>
      `<span class="stat" title="${ech(titre)}" aria-label="${ech(titre)}">${iconeOrdre(icone)}<b>${ech(String(valeur))}</b></span>`;
    const figurine = (cle: CleUnite, taille: number): string => {
      const t = v.catalogue.unites[cle];
      if (!t) return '';
      const id = `vg${vignettes.length}`;
      vignettes.push({ id, silhouette: t.silhouette, camp: adversaire, taille });
      return `<canvas data-vignette="${id}" width="${taille}" height="${taille}"></canvas>`;
    };
    const duels = (l: readonly Duel[]): string => l.map((d) =>
      `<span class="duel" title="${ech(nomDe(d.unite))}">${figurine(d.unite, 34)}`
      + `<i>${ech(api.t('fiche.degats', { n: d.degats }))}</i>`
      + `<small>${ech(nomDe(d.unite))}</small></span>`).join('');
    const terrains = (l: readonly CleTerrain[]): string => l
      .map((t) => `<span class="puce">${ech(nomT(t))}</span>`).join('');
    const bloc = (titre: string, corps: string, ton = ''): string => corps === ''
      ? ''
      : `<section class="bloc ${ton}"><h4><span>${ech(api.t(titre))}</span></h4><div class="corps">${corps}</div></section>`;
    const note = (cle: string): string => `<p class="note">${ech(api.t(cle))}</p>`;
    const portee = f.portee[0] === f.portee[1] ? String(f.portee[0]) : `${f.portee[0]}–${f.portee[1]}`;
    const munitions = f.munitions === null ? '∞' : f.munitions;

    const meteo = f.meteosGenantes.length === 0
      ? note('fiche.par_tous_temps')
      : ['case', 'bride'].map((effet) => bloc(
        effet === 'bride' ? 'fiche.meteo_bride' : 'fiche.meteo_case',
        f.meteosGenantes.filter((g) => g.effet === effet)
          .map((g) => `<span class="puce">${ech(libelleMeteo(api.t, g.meteo))}</span>`).join(''),
      )).join('');

    return `<div class="fiche">`
      + `<p class="chiffres">`
      + stat('mouvement', f.mouvement, api.t('hud.mouvement', { n: f.mouvement }))
      + stat('vue', f.vision, api.t('hud.vision', { n: f.vision }))
      + stat('portee', portee, api.t('hud.portee', { n: portee }))
      + stat('munitions', munitions, f.munitions === null ? api.t('fiche.munitions_illimitees') : api.t('hud.munitions', { n: f.munitions }))
      + `</p>`
      + (f.indirecte ? `<p class="avert">${ech(api.t('fiche.indirecte'))}</p>` : '')
      + (porte(type, 'capture') ? `<p class="avert bon">${ech(api.t('fiche.capture'))}</p>` : '')
      + bloc('fiche.forte', duels(f.forte), 'fort')
      + bloc('fiche.craint', duels(f.craint), 'danger')
      + `<div class="deux">`
      + bloc('fiche.rapide', terrains(f.terrainsRapides))
      + (f.terrainsInterdits.length > 0
        ? bloc('fiche.interdit', terrains(f.terrainsInterdits))
        : `<section class="bloc"><h4><span>${ech(api.t('fiche.interdit'))}</span></h4>${note('fiche.partout')}</section>`)
      + `</div>`
      + meteo
      + `</div>`;
  }

  function modaleProduction(v: VueJeu): string {
    if (!v.production) return '';
    const fonds = v.etat.camps.find((c) => c.id === v.etat.campCourant)?.fonds ?? 0;
    const nomDe = (cle: CleUnite): string => nomUnite(v.locale, v.catalogue, cle);
    const lignes = v.production.unites.map((cle) => {
      const type = v.catalogue.unites[cle];
      if (!type) return '';
      const abordable = type.cout <= fonds;
      const ouverte = ficheOuverte === cle;
      const id = `vg${vignettes.length}`;
      vignettes.push({ id, silhouette: type.silhouette, camp: v.etat.campCourant, taille: 38 });

      // Le prix cède la place au motif du refus : « 6 500 » grisé ne dit pas
      // pourquoi le bouton ne répond pas.
      const prix = abordable
        ? `<span class="cout">${ech(nombreIntl(v.locale, type.cout))}</span>`
        : `<span class="cout dur">${ech(api.t('fiche.trop_cher'))}</span>`;

      const entete = `<button type="button" data-action="${ouverte && abordable ? 'produire' : 'apercu'}" `
        + `data-valeur="${ech(cle)}" aria-expanded="${ouverte}"${!abordable && ouverte ? ' disabled' : ''}>`
        + `<canvas data-vignette="${id}" width="38" height="38"></canvas><span style="min-width:0">`
        + `<span class="tt" style="display:block">${ech(nomDe(cle))}</span>${prix}</span>`
        + `<span class="cta">${ech(api.t(ouverte ? 'fiche.produire' : 'menu.production'))}</span></button>`;

      return ouverte ? entete + blocFiche(v, cle) : entete;
    }).join('');

    return `<div class="voile" data-action="fermer"><div class="modale" data-arret="1">`
      + `<h2>${ech(api.t('menu.production'))}</h2><div class="liste production">${lignes}</div>`
      + `<div class="pied"><button type="button" data-action="fermer">${ech(api.t('menu.retour'))}</button></div>`
      + `</div></div>`;
  }

  function ecranFin(v: VueJeu): string {
    const fin = v.etat.partie;
    if (!fin.terminee || v.masquerFin) return '';
    const cle = fin.nul ? 'hud.match_nul'
      : fin.vainqueur === v.camp ? 'combat.manche_gagnee' : 'combat.manche_perdue';
    const pal = paletteDe(fin.vainqueur ?? null);
    return `<div class="voile"><div class="modale" style="width:390px"><div class="fin">`
      + `<div class="grand">${ech(api.t(cle))}</div>`
      + `<div class="sb" style="margin-top:6px">${ech(api.t('hud.journee', { n: Math.max(1, v.etat.journee) }))}</div>`
      + `</div><div class="pied" style="justify-content:center">`
      + `<button type="button" data-action="rejouer" style="background:${pal.main}">${ech(api.t('hud.rejouer'))}</button>`
      + `</div></div></div>`;
  }

  // -------------------------------------------------------------------------
  // Rendu et interaction
  // -------------------------------------------------------------------------

  function peindreVignettes(): void {
    for (const vg of vignettes) {
      const el = racine.querySelector(`canvas[data-vignette="${vg.id}"]`);
      if (!(el instanceof HTMLCanvasElement)) continue;
      const ratio = Math.min(2, doc.defaultView?.devicePixelRatio ?? 1);
      el.width = Math.round(vg.taille * ratio);
      el.height = Math.round(vg.taille * ratio);
      const g = el.getContext('2d');
      if (!g) continue;
      g.setTransform(ratio, 0, 0, ratio, 0, 0);
      g.clearRect(0, 0, vg.taille, vg.taille);
      g.save();
      g.translate(vg.taille / 2, vg.taille / 2 + vg.taille * 0.1);
      const echelle = (vg.taille / 64) * 0.92;
      g.scale(echelle, echelle);
      dessinerUnite(g, vg.silhouette, paletteDe(vg.camp));
      g.restore();
    }
  }

  function rafraichir(): void {
    const v = api.vue();
    vignettes = [];
    annoncerTour(v);
    const bulletinOuvert = racine.querySelector<HTMLDetailsElement>('.bulletin')?.open ?? false;
    racine.dataset['ordres'] = v.menu ? 'oui' : 'non';
    racine.dataset['scene'] = v.sceneOuverte ? 'ouverte' : 'fermee';
    racine.dataset['selectionNouvelle'] = v.selection !== derniereSelection ? 'oui' : 'non';
    derniereSelection = v.selection;
    // Le duel se calcule **une fois** : il pousse des vignettes, et deux appels
    // en réclameraient deux fois plus qu'il n'y a de canvas à peindre.
    const duel = panneauDuel(v);
    racine.innerHTML = panneauPartie(v) + panneauBulletin(v)
      + `<div class="dock">${panneauJauge(v)}${panneauFinTour(v)}</div>`
      + duel + panneauInspection(v, duel !== '') + panneauOrdres(v) + panneauCamera()
      + panneauAttente(v) + panneauAnnonce(v) + modaleProduction(v) + ecranFin(v);
    const bulletin = racine.querySelector<HTMLDetailsElement>('.bulletin');
    if (bulletin) bulletin.open = bulletinOuvert;
    peindreVignettes();
  }

  function surClic(e: Event): void {
    const cible = e.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-action]');
    if (!(bouton instanceof HTMLElement)) return;
    if (bouton.hasAttribute('disabled')) return;
    // Un clic dans la modale ne la ferme pas : seul le voile ferme.
    if (bouton.dataset['action'] === 'fermer' && cible.closest('[data-arret]') && cible !== bouton) return;
    e.preventDefault();
    e.stopPropagation();
    const valeur = bouton.dataset['valeur'] ?? '';
    switch (bouton.dataset['action']) {
      case 'fin_tour': api.finTour(); break;
      case 'suite': api.choisirSuite(valeur); break;
      case 'produire': ficheOuverte = null; api.choisirProduction(valeur); break;
      // Déplier une fiche ne touche à rien du jeu : on redessine, c'est tout.
      case 'apercu': ficheOuverte = valeur === ficheOuverte ? null : (valeur as CleUnite); rafraichir(); break;
      // Déplier la fiche sous le curseur ne touche à rien du jeu non plus.
      case 'fiche': ficheInspection = !ficheInspection; rafraichir(); break;
      case 'pouvoir': api.jouerPouvoir('normal'); break;
      case 'fermer': ficheOuverte = null; api.annuler(); break;
      case 'rejouer': api.recommencer(); break;
      case 'zoom_plus': api.zoomer?.(1); break;
      case 'zoom_moins': api.zoomer?.(-1); break;
      case 'recentrer': api.recentrer?.(); break;
      default: break;
    }
  }

  racine.addEventListener('click', surClic);
  // Entrer sur un panneau du HUD, c'est venir chercher une commande : le
  // panneau d'inspection cesse alors de suivre le curseur de jeu, sans quoi le
  // bouton qu'on vise disparaît sous le doigt qui l'approche.
  const surPointeur = (e: Event): void => {
    const sur = (e.target as Element | null)?.closest?.('.atlas-hud .p') != null;
    if (sur === pointeurSurHud) return;
    pointeurSurHud = sur;
    rafraichir();
  };
  // L'écoute est posée sur le **conteneur**, qui porte la toile et le HUD : la
  // racine du HUD couvre tout l'écran, donc son `pointerleave` ne part jamais et
  // le drapeau resterait vrai pour toujours.
  conteneur.addEventListener('pointerover', surPointeur);
  rafraichir();

  return {
    rafraichir,
    demonter: () => {
      if (minuterieTour) clearTimeout(minuterieTour);
      if (graceInspection) clearTimeout(graceInspection);
      banniereTour?.remove();
      racine.removeEventListener('click', surClic);
      conteneur.removeEventListener('pointerover', surPointeur);
      racine.remove();
    },
  };
}
