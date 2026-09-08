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
import {
  consommationParTour, prevoirDuel, pvAffiches, revenuParTour,
  seuilCapture, terrainLogique, uniteParId,
} from '../engine/index';
import { nombre as nombreIntl } from '../i18n/index';
import type {
  CampId, Case, CleTerrain, CleUnite, EffetPouvoir, Meteo, Silhouette,
} from '../schemas/types';
import type { Ambiance } from './ambiance';
import type { Phase } from './controleur';
import {
  libelleMeteo, libelleMouvement, libellePhase, libelleSaison, libelleTrait, lignesPouvoir,
  nomCommandant, nomCourtUnite, nomTerrain, nomUnite, type OptionMenu,
} from './libelles';
import {
  alerteCarburant, alerteMunitions, ficheUnite, porte, type Alerte, type Duel,
} from './fiche-unite';
import { paletteDe } from './palettes';
import type { Partition } from './partition';
import type { PointVue } from './rendu';
import { jaugePv, monterScenes, type HorlogeScenes } from './scenes-html';
import { dessinerUnite } from './sprites/index';

/**
 * Un niveau de pouvoir, tel que le HUD doit le montrer : son nom, son prix, et
 * le **verdict du moteur** sur sa disponibilité. Le HUD ne rejoue aucune règle
 * — il n'a ni le commandant, ni le droit de recalculer un coût.
 */
export interface NiveauPouvoir {
  /** Clé de traduction du nom, ou le nom lui-même en repli. */
  nom: string;
  /** Ce qu'il retire à la jauge. */
  cout: number;
  /** `verifierPouvoir` l'accepterait-il maintenant ? */
  pret: boolean;
  /** Ce qu'il fait, tel que le commandant le déclare. Le HUD le met en mots. */
  effets: readonly EffetPouvoir[];
}

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
  /**
   * Le chemin pointé sort de la vue (brouillard) : l'unité avancera d'abord et
   * décidera une fois arrivée, sans menu avant. Le panneau d'unité le dit.
   */
  cheminAveugle?: boolean;
  /**
   * Ce que **coûte** le chemin actuellement pointé, et ce que l'unité peut
   * dépenser. Le HUD montre la case de mouvement du panneau d'unité en
   * « dépensé sur disponible » tant qu'un chemin est pointé, au lieu du seul
   * mouvement du type : une route et une forêt ne se paient pas pareil, et
   * c'est la première chose qu'un joueur d'Advance Wars cherche des yeux en
   * traçant sa flèche. Absent : la case dit le mouvement, comme avant.
   *
   * `jeu.ts` ne le remplit pas encore ; le contrôleur connaît pourtant le
   * chiffre — `deplacementDe` garde la `Portee` du moteur avec le coût de
   * chaque case atteignable.
   */
  cheminCout?: { cout: number; max: number } | null;
  menu: { ancre: Case; options: readonly OptionMenu[] } | null;
  production: { batiment: Case; unites: readonly CleUnite[] } | null;
  /** La visée en cours : de quoi prévoir le duel avant de confirmer. */
  visee: { attaquantId: string; depuis: Case; cibles: readonly Case[]; cible: Case | null } | null;
  /**
   * Les identifiants des unités que le joueur **voit** — les siennes, et les
   * adverses que le brouillard, une forêt ou la furtivité ne cachent pas ;
   * `null` sans brouillard, absent : toutes. Le panneau d'unité ne nomme
   * jamais ce que la carte cache.
   */
  unitesVues?: ReadonlySet<string> | null;
  attenteIa: boolean;
  /**
   * Les deux pouvoirs du commandant du joueur. `null` : ce camp n'en a pas.
   *
   * Absent jusqu'ici, et c'est ce qui rendait le **super pouvoir injoignable** :
   * la mécanique existe du moteur au splash, et le HUD n'écrivait qu'un
   * `jouerPouvoir('normal')`. Le seuil, lui, était faux dans l'autre sens — le
   * bouton n'était actif qu'à jauge pleine, alors que la jauge se remplit
   * jusqu'au prix du **super** et que le pouvoir normal coûte moins.
   */
  pouvoirs?: { normal: NiveauPouvoir; super: NiveauPouvoir } | null;
  /** Message éphémère, déjà traduit. */
  annonce: string | null;
  masquerFin?: boolean;
  /**
   * Une scène de dialogue occupe l'écran : le HUD s'efface. Il ne se démonte pas
   * — ses `data-*` et son état restent lisibles —, il cesse simplement de
   * disputer l'attention à la réplique en cours.
   */
  sceneOuverte?: boolean;
  /**
   * La partie est finie mais son dialogue de fin attend encore la fin de
   * l'animation : l'écran de résultat ne se montre pas, il viendrait avant le
   * commandant et reviendrait après lui — deux fois pour une seule fin.
   */
  finEnAttente?: boolean;
}

/** Ce que le HUD peut demander au jeu. Aucun de ces appels ne mute un état. */
export interface ApiHud {
  vue(): VueJeu;
  t(cle: string, params?: Record<string, string | number>): string;
  finTour(): void;
  /** `passager` : pour « débarquer », l'unité de la cale que l'entrée pose. */
  choisirSuite(id: string, passager?: string): void;
  choisirProduction(cle: CleUnite): void;
  jouerPouvoir(niveau: 'normal' | 'super'): void;
  annuler(): void;
  recommencer(): void;
  zoomer?(sens: 1 | -1): void;
  /** Un quart de tour de la caméra : absent quand le rendu ne sait pas tourner. */
  tourner?(sens: 1 | -1): void;
  recentrer?(): void;
  /**
   * Sélectionne et cadre l'**unité suivante qui n'a pas joué**. C'est le geste
   * qui manque le plus dans une fin de tour : le compteur du bouton de fin de
   * tour dit « 4 unités prêtes » sans donner aucun moyen de les retrouver, et
   * `recentrer` va sur la sélection, sinon sur la première du tableau — pas sur
   * la prochaine à jouer. Absent : le bouton n'existe pas, comme pour le zoom
   * et la rotation.
   */
  uniteSuivante?(): void;
  /** Position d'écran du centre d'une case : sert à ancrer le menu d'ordres. */
  versEcran(c: Case): PointVue | null;
  /**
   * Coupe la partition en cours, peau 3D comprise : c'est ce qu'un clic sur
   * l'écran de combat ou le splash demande. Absent, le HUD ne coupe que ses
   * propres scènes.
   */
  couper?(): void;
}

/** Ce que `monterHudHtml` rend à son hôte. */
export interface HudHtml {
  /** Reconstruit le HUD depuis la vue courante. */
  rafraichir(): void;
  /**
   * Joue ce qu'une partition (`partition.ts`) demande au HUD — chiffres de
   * dégâts, écran de combat, splash de pouvoir — dans un conteneur frère des
   * onze emplacements ; la promesse tient jusqu'au dernier effet.
   */
  jouer(partition: Partition): Promise<void>;
  /** Retire les scènes en cours et résout la promesse de `jouer`. */
  couper(): void;
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
/* ---------------------------------------------------------------------------
 * L'échelle. Il y avait 9, 9,5, 10, 11, 11,5, 12, 12,5, 13, 13,5, 14, 15, 16,
 * 17, 20, 21, 22, 25 et 26 px dans cette feuille : dix-neuf tailles, c'est-à-dire
 * aucune. Huit crans, nommés, et **rien d'autre n'a le droit d'exister** — sans
 * police de jeu, la seule chose qui fasse tenir une interface est la régularité
 * de son échelle.
 *
 * Les jetons sont posés sur le **conteneur** et non sur « .atlas-hud », parce que
 * le bandeau de tour (« .atlas-tour ») est un frère du HUD, pas son enfant : posés
 * plus bas, il ne les lirait pas.
 * ------------------------------------------------------------------------- */
[data-atlas-hote]{--rail-l:0px;--t1:10px;--t2:11px;--t3:12px;--t4:13px;--t5:15px;--t6:18px;--t7:22px;--t8:28px;--coupe:8px}
[data-atlas-hote][data-atlas-rail='oui']{padding-right:var(--rail-l)}
.atlas-hud{position:absolute;inset:0;container-type:size;container-name:atlas-interface;pointer-events:none;font-family:system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:var(--t4);line-height:1.35;color:#f5efdf;-webkit-font-smoothing:antialiased;--marge:12px;--bas:calc(12px + env(safe-area-inset-bottom,0px));--haut:calc(12px + env(safe-area-inset-top,0px));--dock:72px;--encre:#152c3b;--encre-clair:#1e3f52;--encre-sombre:#0a1a24;--papier:#f4edda;--signal:#ffd162;--alerte:#f2a33a;--alerte-grave:#f0555f;--cadre:#3b5b6a;--camp:#6d8fa5;--camp-voile:#6d8fa524}
.atlas-hud *{box-sizing:border-box}
.atlas-hud[data-scene='ouverte']{visibility:hidden}
/* Sauf la colonne, quand elle est ouverte : elle est le cadre de l'écran, pas
   un panneau posé dessus. L'effacer laisserait une bande vide le temps d'une
   réplique, et l'écran changerait de forme à chaque prise de parole. Elle
   s'estompe, ce qui suffit à rendre la parole au commandant. */
.atlas-hud[data-rail='oui'][data-scene='ouverte'] .hud-rail{visibility:visible;opacity:.34}
/* Un panneau est un **cadre**, pas une carte : l'angle se coupe (jamais un
   rayon), l'ombre est dure, et le bord haut porte la couleur du camp. Elle est
   posée par défaut et non plus par un sélecteur d'attribut : c'est la couleur
   du camp **qui joue** que la racine pose à chaque tour, et un panneau qui
   parle d'une unité la remplace par celle de son propriétaire.
   L'ombre passe en « drop-shadow » parce qu'une « box-shadow » est peinte hors du
   « clip-path » : elle serait invisible, ou pire, carrée sous un cadre coupé. */
.atlas-hud .p,.atlas-hud .partie,.atlas-hud .bulletin{clip-path:polygon(var(--coupe) 0,100% 0,100% calc(100% - var(--coupe)),calc(100% - var(--coupe)) 100%,0 100%,0 var(--coupe));filter:drop-shadow(3px 3px 0 #101d2870)}
.atlas-hud .p{position:absolute;pointer-events:auto;background:var(--encre);border:1px solid #839798;border-top:3px solid var(--camp);border-radius:0;overflow:hidden}
.atlas-hud .in{padding:10px 14px}
.atlas-hud .tt{font-weight:800;font-size:var(--t5);letter-spacing:.015em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.atlas-hud .sb{font-size:var(--t4);color:#b9cbcb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.atlas-hud .symbole{width:24px;height:24px;flex:none;display:block}
/* La tête de la colonne : **une seule bande** pour la journée et les fonds.
   C'étaient deux boîtes accolées et une ligne de compte de bâtiments ; le
   propriétaire a demandé de réduire, et le compte est parti avec. La journée
   est peinte **dans la couleur du camp qui joue** : c'est la grammaire
   d'Advance Wars, où la fenêtre prend la couleur de l'armée en main, et le
   seul signal du HUD qu'on lit sans le chercher. */
.atlas-hud .partie{position:absolute;left:max(var(--marge),env(safe-area-inset-left,0px));top:var(--haut);display:flex;align-items:stretch;height:42px;max-width:calc(100% - 24px);background:var(--encre);border:1px solid var(--cadre);border-top:3px solid var(--camp)}
.atlas-hud .partie>span{display:flex;align-items:center;gap:7px;padding:0 12px;white-space:nowrap}
.atlas-hud .partie .jour{background:var(--camp);color:#08151e;font-size:var(--t4);font-weight:850;text-transform:uppercase}
.atlas-hud .partie .fonds{color:var(--signal);font-size:var(--t5);font-weight:900;font-variant-numeric:tabular-nums}
.atlas-hud .partie .symbole{width:18px;height:18px;flex:none;opacity:.9}
/* Le bulletin : trois journées côte à côte. La météo change le mouvement **et**
   la vision — la ranger derrière un clic, c'était ranger une règle derrière un
   clic.
   Il vit **sous** la bande de partie, à gauche (demande du propriétaire) : le
   temps qu'il fait et la journée qu'on joue sont la même question, et les lire
   demandait de traverser l'écran. La colonne fait donc « --haut » + 42 de bande
   + 6 de respiration + 95 de bulletin ; « mission.css » pose son fanion dessous,
   et c'est la seule chose qui dépende de cette hauteur. */
.atlas-hud .bulletin{position:absolute;pointer-events:auto;left:max(var(--marge),env(safe-area-inset-left,0px));top:calc(var(--haut) + 48px);width:196px;color:var(--papier);background:var(--encre);border:1px solid var(--cadre);border-top:3px solid var(--camp);z-index:2}
.atlas-hud .meteo-trois{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}
.atlas-hud .meteo-case{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px 7px;border-bottom:3px solid transparent}
.atlas-hud .meteo-case+.meteo-case{border-left:1px solid #ffffff14}
.atlas-hud .meteo-case[data-courant='oui']{background:#ffffff0d;border-bottom-color:var(--signal)}
.atlas-hud .meteo-jour{font-size:var(--t1);font-weight:850;letter-spacing:.1em;text-transform:uppercase;color:#9fb6b8}
.atlas-hud .meteo-case[data-courant='oui'] .meteo-jour{color:var(--signal)}
.atlas-hud .meteo-case svg{width:22px;height:22px}
.atlas-hud .meteo-nom{max-width:100%;font-size:var(--t1);font-weight:750;color:#b9cbcb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-hud .meteo-ambiance{padding:4px 8px 5px;border-top:1px solid #ffffff14;font-size:var(--t1);font-weight:750;color:#9fb6b8;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-hud .dock{position:absolute;pointer-events:auto;left:50%;bottom:var(--bas);transform:translateX(-50%);display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:8px;width:420px;max-width:calc(100% - 24px);height:var(--dock);filter:drop-shadow(3px 4px 0 #12233270)}
.atlas-hud .dock .p{position:relative;filter:none}
.atlas-hud .jauge{border:0;border-top:3px solid var(--camp)}
/* Le commandant sur une ligne, avec son bouton de détail au bout : le pouvoir
   prenait la plus grande boîte de la colonne pour l'information la moins
   fréquente. */
.atlas-hud .jauge .commandant{display:flex;align-items:center;gap:8px;padding:6px 8px 4px 12px;background:var(--camp-voile)}
.atlas-hud .jauge .commandant .tt{flex:1;min-width:0;font-size:var(--t4);font-weight:850}
.atlas-hud .jauge .commandant .detail{min-width:30px;min-height:30px;margin-left:0}
.atlas-hud .jauge>.energie{margin:7px 12px 7px}
/* Les effets, dépliés : ce que le pouvoir fait, lu sur les données du
   commandant et jamais rédigé à la main. */
.atlas-hud .pouvoir-effets{display:grid;gap:5px;margin:0 9px 8px;padding:7px 9px;background:var(--encre-sombre);border:1px solid #33505e}
.atlas-hud .pouvoir-effets .effet{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.atlas-hud .pouvoir-effets .rang{font-size:var(--t1);font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:#9fb6b8;flex-basis:100%}
.atlas-hud .pouvoir-effets .puce{padding:2px 7px;background:#ffffff10;border:1px solid #ffffff1a;font-size:var(--t3);font-weight:800;color:var(--papier)}
.atlas-hud .jauge button{all:unset;display:flex;align-items:center;gap:9px;box-sizing:border-box;width:100%;height:100%;padding:8px 12px;cursor:pointer}
.atlas-hud .insigne{display:flex;align-items:center;justify-content:center;width:42px;height:48px;flex:none;color:var(--signal);background:#284451;clip-path:polygon(0 0,100% 0,100% 77%,50% 100%,0 77%)}
.atlas-hud .insigne .symbole{width:29px;height:29px;margin-top:-5px}
.atlas-hud .commande{min-width:0;flex:1}
.atlas-hud .commande .tt{font-size:var(--t3);text-transform:uppercase;letter-spacing:.04em;color:#d4dfe0}
.atlas-hud .energie{display:flex;gap:3px;height:10px;margin:5px 0 3px;transform:skewX(-15deg)}
.atlas-hud .energie>i{height:100%;flex:1;background:#536976;overflow:hidden}
.atlas-hud .energie b{display:block;height:100%;background:var(--signal)}
.atlas-hud .commande .sb{color:var(--signal);font-size:var(--t3);font-weight:750;text-transform:uppercase;letter-spacing:.05em}
.atlas-hud .jauge[data-pret='oui'] .insigne{animation:atlas-pouvoir 1s ease-in-out infinite alternate}
.atlas-hud .fintour button{all:unset;display:flex;box-sizing:border-box;align-items:center;justify-content:center;gap:9px;width:100%;height:100%;min-height:48px;padding:10px 14px;clip-path:polygon(0 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%);font-weight:900;font-size:var(--t5);line-height:1.15;cursor:pointer;text-align:left;background:var(--signal);color:var(--encre);text-transform:uppercase;border-top:3px solid #fff0ac;border-bottom:4px solid #c4923a}
.atlas-hud .fintour .symbole{width:26px;height:26px}
.atlas-hud .fintour-texte{display:flex;flex-direction:column;align-items:flex-start;gap:1px;min-width:0}
.atlas-hud .fintour-texte .tt{font-size:var(--t5);font-weight:900;letter-spacing:.05em}
.atlas-hud .fintour-texte .sb{margin:0;font-size:var(--t2);font-weight:800;letter-spacing:.06em;color:#6b5312;text-transform:none}
.atlas-hud .fintour button[disabled] .fintour-texte .sb{color:#8d9ba1}
.atlas-hud .fintour button[disabled]{background:#344653;color:#a8b9bb;border-color:#60707c}
.atlas-hud .inspect{left:12px;bottom:calc(var(--bas) + var(--dock) + 10px);width:390px;max-width:calc(100% - 84px)}
.atlas-hud[data-selection-nouvelle='oui'] .inspect{animation:atlas-inspection .16s ease-out}
.atlas-hud .inspect .in{display:flex;gap:10px;align-items:center;padding:10px 12px}
/* La figurine sur la plaque de son camp : la couleur de l'armée collée à ce
   qu'elle désigne, plutôt qu'un filet perdu en haut du panneau. */
.atlas-hud .inspect canvas{flex:0 0 auto;width:44px;height:44px;background:var(--camp-voile);border-bottom:2px solid var(--camp)}
.atlas-hud .stats{font-size:var(--t3);color:#c0ccd7;margin-top:3px;white-space:normal}
/* Une statistique en alerte ne change pas que de **couleur** — un daltonien ne
   lirait rien : elle prend un signe et une forme. Orange : le cadre seul, la
   règle mordra au prochain tour. Rouge : la plaque pleine, elle mord déjà.
   Deux formes, deux poids, deux teintes ; il en reste deux si l'une manque. */
.atlas-hud .stats [data-alerte]{display:inline-flex;align-items:center;gap:3px;padding:0 5px;font-weight:850}
.atlas-hud .stats [data-alerte] .symbole{width:12px;height:12px}
.atlas-hud .stats [data-alerte='orange']{color:var(--alerte);box-shadow:inset 0 0 0 1px currentColor}
.atlas-hud .stats [data-alerte='rouge']{color:#1d0a0d;background:var(--alerte-grave)}
.atlas-hud .stats .embarquees{display:block;margin-top:2px;color:#d6e2ea}
/* Furtive, déplacée : un état, dit en clair, dans la couleur du signal — les seuls mots du panneau qui ne sont pas des chiffres. */
.atlas-hud .stats .furtive,.atlas-hud .stats .deplacee{color:var(--signal);font-weight:800}
/* Le chemin pointé sort de la vue : une ligne sous le panneau, dans la couleur du signal, l'œil pour signe. */
.atlas-hud .inspect .aveugle{display:flex;align-items:center;gap:8px;padding:7px 12px 9px;border-top:1px solid #ffffff14;font-size:var(--t3);font-weight:800;color:var(--signal)}
.atlas-hud .inspect .aveugle .symbole{width:18px;height:18px}
/* L'astuce de la zone de danger. Le calcul existe depuis toujours, le geste est
   un double-clic, et **rien ne l'annonçait** : une fonctionnalité qu'aucun
   joueur ne peut découvrir n'existe pas. Elle ne paraît que sur une unité
   adverse — la seule sur laquelle le geste veuille dire quelque chose. */
.atlas-hud .inspect .astuce{display:flex;align-items:center;gap:8px;padding:6px 12px 8px;border-top:1px solid #ffffff14;font-size:var(--t2);font-weight:750;color:#9fb6b8}
.atlas-hud .inspect .astuce .symbole{width:16px;height:16px;color:#ff8e83}
.atlas-hud .retour{all:unset;box-sizing:border-box;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;background:#ffffff10;padding:0 10px;border:1px solid #ffffff20;border-bottom:3px solid #060f17;color:#d6e2ea}
.atlas-hud .retour .symbole{width:20px;height:20px}
.atlas-hud .retour:active{translate:0 2px;border-bottom-width:1px}
.atlas-hud .inspect .in>.retour:first-of-type{margin-left:auto}
/* Par défaut, le menu est une feuille basse — c'est la bonne forme au doigt. Il
   devient un panneau posé à côté de l'unité dès que l'écran est assez large
   (attribut data-ancre, position calculée par la fonction ancrer). */
.atlas-hud .ordres{left:50%;bottom:calc(var(--bas) + var(--dock) + 10px);transform:translateX(-50%);width:340px;max-width:calc(100% - 24px);padding:0 0 8px;z-index:3;max-height:calc(100% - 160px);overflow-y:auto;background:var(--encre);color:var(--papier);border:1px solid #839798;border-top:4px solid var(--signal);animation:atlas-ordres .16s ease-out}
.atlas-hud .ordres[data-ancre='oui'],.atlas-hud .p.duel[data-ancre='oui']{bottom:auto;right:auto;transform:none;width:190px;max-width:190px}
.atlas-hud .p.duel[data-ancre='oui']{width:230px;max-width:230px}
.atlas-hud .ordres-entete{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 6px 5px 12px;background:#ffffff0a;border-bottom:1px solid #ffffff14;margin-bottom:8px}
.atlas-hud .ordres .retour{min-width:34px;min-height:34px;background:#ffffff10;border-color:#ffffff26}
.atlas-hud .ordres-grille{display:grid;grid-template-columns:minmax(0,1fr);gap:5px;padding:0 8px}
/* Un bouton a une **épaisseur** qui s'écrase ; un panneau est plat. C'est
   l'enfoncement qui dit « pressable », pas la couleur. */
.atlas-hud .ordres-grille button{all:unset;display:flex;box-sizing:border-box;align-items:center;justify-content:flex-start;gap:10px;min-height:46px;padding:10px 12px;cursor:pointer;font-size:var(--t5);font-weight:700;text-align:left;background:var(--encre-clair);color:var(--papier);border-bottom:3px solid #060f17;transition:background .1s,translate .08s,border-bottom-width .08s}
.atlas-hud .ordres-grille button:hover{background:#2c5670}
.atlas-hud .ordres-grille button:active:not(:disabled){translate:0 2px;border-bottom-width:1px}
/* Les couleurs du plateau ne se posent jamais en aplat sur un bouton : le bleu y
   veut dire « chantier », le rouge « je tire ». Un ordre les **cite** dans son
   glyphe, et nulle part ailleurs — le liseré de 4 px a été retiré partout. */
.atlas-hud .ordres-grille button[data-valeur='attaquer'] .symbole{color:#ff6a5e}
.atlas-hud .ordres-grille button[data-valeur='capturer'] .symbole{color:#ffc634}
.atlas-hud .ordres-grille button[data-valeur='remettre'] .symbole{color:#ffc634}
.atlas-hud .ordres-grille button[data-valeur='construire'] .symbole{color:#4eaaff}
.atlas-hud .ordres-grille .symbole{width:21px;height:21px;color:#9fb6b8}
/* « Débarquer <nom> » montre la figurine qu'il pose : on choisit qui descend en la voyant. */
.atlas-hud .ordres-grille canvas{flex:none;width:24px;height:24px;background:var(--camp-voile)}
.atlas-hud .ordres-grille button:hover .symbole{color:var(--signal)}
/* Les commandes de caméra : des **loupes**, pas un « + » et un « − » de
   calculatrice à 25 px dans des carrés. Le signe reste dans la loupe, ce qui
   est exactement ce qu'il veut dire ici : voir de plus près. */
.atlas-hud .camera{position:absolute;right:max(12px,env(safe-area-inset-right,0px));bottom:calc(var(--bas) + var(--dock) + 10px);pointer-events:auto;display:grid;gap:5px}
.atlas-hud .camera button{all:unset;display:flex;box-sizing:border-box;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid #91a1a3;border-bottom:3px solid #0c1923;background:var(--encre);color:#d6e2ea;cursor:pointer;transition:background .1s,translate .08s,border-bottom-width .08s}
.atlas-hud .camera button:hover{background:var(--encre-clair)}
.atlas-hud .camera button:active{translate:0 2px;border-bottom-width:1px}
.atlas-hud .camera svg{width:22px;height:22px}
/* « .p.duel » et non « .duel » : la rangée de figurines de la fiche porte aussi la classe « duel », et héritait du panneau entier, animation comprise, à chaque rafraîchissement du DOM. */
.atlas-hud .p.duel{left:12px;bottom:calc(var(--bas) + var(--dock) + 10px);width:390px;max-width:calc(100% - 84px);border:0;border-top:4px solid #ff6a5e;background:var(--encre);animation:atlas-inspection .16s ease-out}
.atlas-hud .duel-entete{display:flex;align-items:center;gap:8px;padding:6px 12px;background:#ff6a5e14;border-bottom:1px solid #ffffff14;font-size:var(--t2);font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:#ffb3aa}
.atlas-hud .duel-entete .symbole{width:16px;height:16px}
.atlas-hud .duel-entete .issue{margin-left:auto;color:var(--signal);letter-spacing:.08em}
.atlas-hud .duel-camp{display:flex;align-items:center;gap:10px;padding:7px 12px}
.atlas-hud .duel-camp+.duel-camp{border-top:1px solid #ffffff14}
.atlas-hud .duel-camp canvas{flex:0 0 auto;width:36px;height:36px;background:#ffffff0a}
.atlas-hud .duel-camp .tt{font-size:var(--t4)}
.atlas-hud .duel-chiffres{margin-left:auto;display:flex;align-items:baseline;gap:6px;font-weight:900;font-size:var(--t6);font-variant-numeric:tabular-nums}
.atlas-hud .duel-chiffres em{font-style:normal;font-size:var(--t3);color:#9fb3b6}
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
.atlas-hud .annonce{left:50%;bottom:calc(var(--bas) + var(--dock) + 108px);transform:translateX(-50%);max-width:calc(100% - 32px);width:max-content;z-index:4;border-top:3px solid var(--signal)}
.atlas-hud .annonce .tt{white-space:normal;font-size:var(--t5)}
.atlas-hud .voile{position:absolute;inset:0;pointer-events:auto;background:#07172499;display:flex;align-items:center;justify-content:center;z-index:5;padding:var(--haut) 12px var(--bas)}
.atlas-hud .modale{position:relative;pointer-events:auto;background:var(--papier);color:var(--encre);border-top:5px solid var(--camp);width:420px;max-width:100%;max-height:100%;display:flex;flex-direction:column;overflow:hidden;clip-path:polygon(var(--coupe) 0,100% 0,100% calc(100% - var(--coupe)),calc(100% - var(--coupe)) 100%,0 100%,0 var(--coupe));filter:drop-shadow(5px 5px 0 #10212c80)}
/* Le menu de production : un panneau **ancré au bâtiment**, plus une modale de
   760 px centrée sur un voile noir. On recrute six à dix fois par match ; le jeu
   n'a pas à disparaître à chaque fois. Le voile ne sert plus qu'à recevoir le
   clic qui referme — il s'éclaircit donc, et le plateau reste lisible. */
.atlas-hud .voile.clair{background:#07172433;align-items:flex-end;padding:var(--haut) 12px var(--bas)}
.atlas-hud .p.production{display:flex;flex-direction:column;width:100%;max-width:520px;max-height:100%;background:var(--papier);color:var(--encre);border:0;border-top:4px solid var(--camp);overflow:hidden}
.atlas-hud .p.production:focus{outline:none}
.atlas-hud .p.production[data-ancre='oui']{position:absolute;width:400px;max-width:400px;max-height:calc(100% - 24px)}
.atlas-hud .production-entete{display:flex;align-items:center;gap:10px;padding:7px 8px 7px 14px;background:var(--camp-voile);border-bottom:1px solid #15243b22}
.atlas-hud .production-entete .tt{flex:1;font-size:var(--t2);font-weight:850;letter-spacing:.14em;text-transform:uppercase;color:#45606b}
.atlas-hud .production-entete .solde{display:flex;align-items:center;gap:5px;font-size:var(--t5);font-weight:900;color:var(--encre);font-variant-numeric:tabular-nums}
.atlas-hud .production-entete .solde .symbole{width:16px;height:16px;color:#8a6a1e}
.atlas-hud .production-entete .retour{min-width:34px;min-height:34px;background:#15243b12;border-color:#15243b30;border-bottom-color:#15243b40;color:var(--encre)}
/* La grille : on achète une **silhouette**, pas une ligne de tableau. Le prix
   est ce qui décide, il est donc plus gros que le nom. */
.atlas-hud .production-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(98px,1fr));gap:4px;padding:7px;overflow:auto;overscroll-behavior:contain;max-height:34cqh;background:#15243b08}
.atlas-hud .production-grille button{all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 4px 4px;cursor:pointer;text-align:center;background:#e1ddca;border-bottom:3px solid #b6b0a0;transition:background .09s,translate .06s,border-bottom-width .06s}
.atlas-hud .production-grille button:hover{background:#d0d7cc}
.atlas-hud .production-grille button:active{translate:0 2px;border-bottom-width:1px}
.atlas-hud .production-grille canvas{width:40px;height:40px;display:block}
.atlas-hud .production-grille .tt{max-width:100%;font-size:var(--t2);font-weight:750;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4a606b}
.atlas-hud .production-grille .cout{font-size:var(--t4);font-weight:900;color:var(--encre);font-variant-numeric:tabular-nums}
/* Mise en avant : l'inversion papier → encre, le seul contraste qui se lit d'un
   coup d'œil dans une grille de dix. */
.atlas-hud .production-grille button[data-actif='oui']{background:var(--encre);border-bottom-color:#060f17}
.atlas-hud .production-grille button[data-actif='oui'] .tt{color:#b9cbcb}
.atlas-hud .production-grille button[data-actif='oui'] .cout{color:var(--signal)}
/* Trop chère : toujours cliquable — lire la fiche d'une unité qu'on ne peut pas
   payer, c'est savoir pour quoi l'on économise —, mais **c'est le prix qui le
   dit**, en rouge, et la figurine perd ses couleurs. Une opacité de 0,55 sur
   tout le bouton disait « désactivé », ce qui était faux, et ne disait pas
   pourquoi, ce qui était inutile. */
.atlas-hud .production-grille button[data-abordable='non']:not([data-actif='oui']){background:#d9d5c6}
.atlas-hud .production-grille button[data-abordable='non'] canvas{filter:grayscale(1);opacity:.5}
.atlas-hud .production-grille button[data-abordable='non'] .cout{color:#a6382c}
.atlas-hud .production-grille button[data-abordable='non'][data-actif='oui'] .cout{color:#ff9a90}
.atlas-hud .panneau-fiche{display:flex;flex-direction:column;min-height:0;border-top:1px solid #15243b22}
.atlas-hud .fiche-corps{overflow:auto;overscroll-behavior:contain;flex:1 1 auto;min-height:0;padding:8px 14px 10px}
/* Les chiffres de l'unité mise en avant : une rangée de plaques, pas une liste
   de définitions. Un « <dl> » de cinq entrées en trois colonnes, c'était une
   fiche technique de site marchand posée au milieu d'un jeu. */
.atlas-hud .panneau-fiche .cartouche{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}
.atlas-hud .panneau-fiche .cartouche span{display:inline-flex;align-items:baseline;gap:5px;padding:3px 8px;background:#ffffff99;border:1px solid #00000018;font-size:var(--t3);font-weight:750;color:#5d7480}
.atlas-hud .panneau-fiche .cartouche b{font-size:var(--t4);font-weight:850;color:#1e3038;font-variant-numeric:tabular-nums}
.atlas-hud .fiche-traits{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}
.atlas-hud .fiche-traits span{padding:3px 8px;background:#15243b14;font-size:var(--t3);font-weight:750}
.atlas-hud .fiche-traits .vide{color:#7a8b93;font-weight:600}
/* Le pied d'achat ne défile pas : c'est le geste, il est toujours sous la main. */
.atlas-hud .fiche-action{display:flex;align-items:center;gap:10px;padding:8px 14px 12px;border-top:1px solid #15243b22;flex:none}
.atlas-hud .fiche-action .note{flex:1;min-width:0;font-size:var(--t3);font-weight:750;color:#5d7480}
.atlas-hud .fiche-action .note[data-manque='oui']{color:#a6382c;font-weight:800}
.atlas-hud .fiche-action .recruter{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:10px 20px;cursor:pointer;font-weight:900;font-size:var(--t5);text-transform:uppercase;letter-spacing:.04em;background:var(--signal);color:var(--encre);border-top:3px solid #fff0ac;border-bottom:4px solid #c4923a;font-variant-numeric:tabular-nums;transition:translate .08s,border-bottom-width .08s}
.atlas-hud .fiche-action .recruter:active:not(:disabled){translate:0 2px;border-bottom-width:1px}
.atlas-hud .fiche-action .recruter:disabled{background:#c9c4b2;color:#5f6d73;border-top-color:#dcd8c8;border-bottom-color:#a8a392;cursor:default}
/* « Détail » : la fiche longue est **repliée** dans le menu de production. Le
   panneau posait la grille, cinq chiffres, les traits, ce qu'elle démolit, ce
   qui la démolit, la note de référence, les paliers d'abri, deux listes de
   terrains et deux de météo — sept cents pixels de haut ancrés à côté d'un
   bâtiment, avec trois zones de défilement imbriquées. On garde ce qui décide
   d'un achat, on demande le reste. Le corps est le **même** que celui du
   panneau d'unité (« blocFiche ») : deux niveaux de détail, jamais deux textes. */
.atlas-hud .plier{all:unset;box-sizing:border-box;display:flex;flex:none;align-items:center;justify-content:center;gap:7px;width:100%;min-height:34px;padding:6px 10px;cursor:pointer;font-size:var(--t2);font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5d7480;background:#15243b0f;border-top:1px solid #15243b22}
.atlas-hud .plier:hover{background:#15243b1c}
.atlas-hud .plier .symbole{width:14px;height:14px}
.atlas-hud .plier[aria-expanded='false'] .symbole{rotate:180deg}
/* La fiche : tout ce que le canon sait dire de l'unité, et rien d'inventé. */
/* La fiche, à la manière d'Advance Wars : un cadre à biseau, des titres en
   rubans, des statistiques dites par un signe, et la table de dégâts en rangée
   de figurines avec le chiffre sous chacune. Une seule feuille de règles pour le
   menu de production et le panneau d'inspection ; deux jeux de couleurs. */
.atlas-hud .fiche{--f-encre:#e8eef2;--f-doux:#9db3bf;--f-fond:#0f1e27;--f-cadre:#3c5563;--f-biseau:#ffffff1f;--f-ruban:#233a46;--f-ruban-texte:#e6dcc0;--f-plaque:#ffffff0d;--f-plaque-bord:#ffffff1a;--f-fort:#8fe0a0;--f-danger:#ffab8e;background:var(--f-fond);color:var(--f-encre);border:2px solid var(--f-cadre);box-shadow:inset 0 0 0 1px var(--f-biseau);padding:9px 10px 10px;font-size:var(--t3);line-height:1.35}
.atlas-hud .production .fiche{--f-encre:#1e3038;--f-doux:#5d7480;--f-fond:#f1ede0;--f-cadre:#2d3f48;--f-biseau:#ffffffb0;--f-ruban:#2d3f48;--f-ruban-texte:#f4edda;--f-plaque:#ffffff99;--f-plaque-bord:#00000018;--f-fort:#2f7a3d;--f-danger:#b0402e;margin:0}
.atlas-hud .inspect .fiche{border-top-width:2px;max-height:46vh;overflow:auto;overscroll-behavior:contain}
.atlas-hud .fiche p{margin:0}
/* Les statistiques : le signe, puis le chiffre. Pas de mot. */
.atlas-hud .fiche .chiffres{display:flex;flex-wrap:wrap;gap:4px 6px;margin-bottom:8px}
.atlas-hud .fiche .stat{display:inline-flex;align-items:center;gap:5px;padding:3px 9px 3px 6px;background:var(--f-plaque);border:1px solid var(--f-plaque-bord);color:var(--f-doux)}
.atlas-hud .fiche .stat .symbole{width:15px;height:15px;flex:0 0 auto}
.atlas-hud .fiche .stat b{font-size:var(--t4);font-weight:850;font-variant-numeric:tabular-nums;color:var(--f-encre)}
.atlas-hud .fiche .avert{margin:0 0 8px;padding:5px 8px;background:#3a2620;color:#f0d9cc;font-weight:700}
.atlas-hud .fiche .avert.bon{background:#1e3325;color:#d6ecd2}
.atlas-hud .production .fiche .avert{background:#e3d2c6;color:#1e3038}
.atlas-hud .production .fiche .avert.bon{background:#d3e0cd}
.atlas-hud .fiche .bloc{margin:0 0 9px}
.atlas-hud .fiche .bloc:last-child{margin-bottom:0}
/* Le titre est un ruban : une bande pleine, coupée en biseau, comme les
   fenêtres du jeu d'origine. */
.atlas-hud .fiche h4{margin:0 0 5px;font-size:var(--t1);font-weight:850;letter-spacing:.1em;text-transform:uppercase;line-height:1}
.atlas-hud .fiche h4 span{display:inline-block;padding:4px 10px 4px 7px;background:var(--f-ruban);color:var(--f-ruban-texte);clip-path:polygon(0 0,100% 0,calc(100% - 6px) 100%,0 100%)}
.atlas-hud .fiche .corps{display:flex;flex-wrap:wrap;gap:5px}
/* La table de dégâts : une figurine, le chiffre dessous, le nom en tout petit.
   Le chiffre prend la couleur de ce qu'il signifie — vert quand c'est nous qui
   frappons, rouge quand c'est nous qui encaissons.
   La pastille « ∞ » au coin d'une figurine : ce duel se tire à l'arme
   secondaire, sans compter les munitions. Le même signe que la fiche emploie
   pour des munitions illimitées, parce que c'est la même promesse. */
.atlas-hud .fiche .duel{position:relative;display:inline-flex;flex-direction:column;align-items:center;width:58px;padding:4px 2px 3px;background:var(--f-plaque);border:1px solid var(--f-plaque-bord);text-align:center}
.atlas-hud .fiche .duel canvas{width:34px;height:34px;display:block}
.atlas-hud .fiche .duel i{font-style:normal;font-size:var(--t3);font-weight:850;font-variant-numeric:tabular-nums;line-height:1.1;margin-top:1px}
.atlas-hud .fiche .duel small{display:block;max-width:54px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--t1);font-weight:700;letter-spacing:.02em;color:var(--f-doux);margin-top:1px}
.atlas-hud .fiche .duel .sans{position:absolute;top:2px;right:2px;font-style:normal;font-size:var(--t1);line-height:1;font-weight:900;padding:1px 3px;background:var(--f-ruban);color:var(--f-ruban-texte);border:1px solid var(--f-plaque-bord)}
.atlas-hud .fiche .fort .duel i{color:var(--f-fort)}
.atlas-hud .fiche .danger .duel i{color:var(--f-danger)}
.atlas-hud .fiche .puce{display:inline-flex;align-items:center;padding:3px 8px;background:var(--f-plaque);border:1px solid var(--f-plaque-bord);font-weight:700;white-space:nowrap}
/* Une puce de terrain porte sa tuile : le carré du terrain dans sa couleur de
   canon, et un motif qui le distingue sans dépendre de la teinte. */
.atlas-hud .fiche .puce.tuilee{gap:6px;padding:2px 8px 2px 3px}
.atlas-hud .fiche .tuile{width:20px;height:20px;flex:0 0 auto;display:block}
/* Un palier d'abri : les étoiles à gauche, les terrains de ce palier à droite, qui reviennent à la ligne. */
.atlas-hud .fiche .abris .corps{display:block}
.atlas-hud .fiche .abri{display:flex;align-items:baseline;gap:7px;padding:2px 0;font-weight:700}
.atlas-hud .fiche .abri .etoiles{flex:0 0 auto;font-style:normal;letter-spacing:.1em;color:var(--f-encre)}
.atlas-hud .fiche .abri .part{flex:0 0 auto;font-style:normal;font-weight:850;font-variant-numeric:tabular-nums;color:var(--f-fort)}
.atlas-hud .fiche .abri[data-defense='0'] .etoiles{color:var(--f-doux)}
.atlas-hud .fiche .abri>span{min-width:0;color:var(--f-doux)}
.atlas-hud .fiche .note.reference{margin:0 0 8px}
.atlas-hud .fiche .deux{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
.atlas-hud .fiche .note{font-size:var(--t3);font-weight:700;color:var(--f-doux)}
/* La consommation par tour : le signe du carburant, puis le chiffre, sur sa ligne. */
.atlas-hud .fiche .conso{display:flex;align-items:center;gap:5px;margin:0 0 8px;font-size:var(--t3);font-weight:750;color:var(--f-doux)}
.atlas-hud .fiche .conso .symbole{width:14px;height:14px;flex:0 0 auto}
.atlas-hud .fiche .conso b{color:var(--f-encre);font-variant-numeric:tabular-nums}
.atlas-hud .fiche .cale .avert{margin:6px 0 0}
@media(max-width:360px){.atlas-hud .fiche .deux{grid-template-columns:1fr}}
/* Le bouton de détail : une **loupe**, et un chevron quand la fiche est ouverte.
   C'était un « i » en italique — l'icône « info » du web, le signe même du blog
   dans une interface qui n'a par ailleurs que des glyphes dessinés. */
.atlas-hud .detail{all:unset;box-sizing:border-box;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;margin-left:auto;background:#ffffff10;border:1px solid #ffffff20;border-bottom:3px solid #060f17;color:#d6e2ea}
.atlas-hud .detail:active{translate:0 2px;border-bottom-width:1px}
.atlas-hud .detail .symbole{width:19px;height:19px}
.atlas-hud .inspect .detail+.retour{margin-left:6px}
.atlas-hud .pied{display:flex;justify-content:center;gap:8px;padding:12px 16px 16px}
.atlas-hud .pied button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:9px;min-height:48px;padding:12px 22px;cursor:pointer;font-weight:900;font-size:var(--t5);text-transform:uppercase;letter-spacing:.04em;background:var(--camp);color:#08151e;border-bottom:4px solid #00000055;transition:translate .08s,border-bottom-width .08s}
.atlas-hud .pied button:active{translate:0 2px;border-bottom-width:1px}
.atlas-hud .pied .symbole{width:20px;height:20px}
/* L'écran de fin. C'était un titre, une journée, et un bouton : rien de ce que
   le match venait de produire, alors que tout est dans l'état. Le bilan
   compare les deux camps sur les trois choses qui décident une partie — ce qui
   reste en jeu, ce qu'on tient, ce qu'on a payé —, chaque colonne peinte de la
   couleur de son armée, la mienne d'abord. */
.atlas-hud .fin{text-align:center;padding:22px 24px 16px}
.atlas-hud .fin .grand{font-size:var(--t8);font-weight:850;letter-spacing:-.01em;line-height:1.05}
.atlas-hud .fin .sb{color:#536e78;font-size:var(--t4)}
.atlas-hud .bilan{margin:0 20px 4px;border-top:1px solid #15243b26}
.atlas-hud .bilan-ligne{display:grid;grid-template-columns:minmax(0,1fr) 62px 62px;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid #15243b14}
.atlas-hud .bilan-ligne .quoi{font-size:var(--t2);font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5d7480;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-hud .bilan-ligne b,.atlas-hud .bilan-ligne .chef{text-align:center;font-variant-numeric:tabular-nums}
.atlas-hud .bilan-ligne b{font-size:var(--t6);font-weight:900;color:var(--encre);border-bottom:3px solid var(--teinte,#b9bec7)}
.atlas-hud .bilan-tete{border-bottom:2px solid #15243b26}
.atlas-hud .bilan-tete .chef{font-size:var(--t1);font-weight:850;letter-spacing:.06em;text-transform:uppercase;color:#5d7480;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-bottom:4px solid var(--teinte,#b9bec7);padding-bottom:3px}
.atlas-tour{position:absolute;left:0;right:0;top:38%;z-index:7;pointer-events:none;display:flex;align-items:center;justify-content:center;gap:18px;padding:16px 24px;background:linear-gradient(110deg,transparent 3%,#152c3bf2 3%,#152c3bf2 97%,transparent 97%);color:#f4edda;border-block:3px solid var(--teinte,#ffd162);font-family:system-ui,sans-serif;animation:atlas-tour 1.15s ease both}
.atlas-tour .symbole{width:42px;height:42px;color:var(--teinte,#ffd162)}
.atlas-tour strong{display:block;font-size:var(--t7);line-height:1.15;text-transform:uppercase;font-weight:900;letter-spacing:.03em}
.atlas-tour span{display:block;margin-top:5px;font-size:var(--t4);font-weight:750;text-transform:uppercase;letter-spacing:.14em;color:var(--teinte,#ffd162)}
@keyframes atlas-tour{0%{opacity:0;transform:translateX(-15%)}15%,78%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(15%)}}
@keyframes atlas-inspection{from{opacity:0;translate:0 5px}to{opacity:1;translate:0 0}}
@keyframes atlas-ordres{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
@keyframes atlas-pouvoir{from{color:#ffd162}to{color:white;filter:drop-shadow(0 0 5px #ffd162)}}
@keyframes atlas-attente{to{transform:rotate(360deg)}}
/* ---------------------------------------------------------------------------
 * La colonne de droite — « le rail ».
 *
 * Sur un grand écran, le plateau n'a pas besoin de toute la largeur, et le HUD
 * n'a aucune raison de lui prendre ses quatre coins : **la carte tient la
 * gauche, la colonne tient la droite**. Ce qui décrit la partie — la journée,
 * mes fonds, l'unité regardée, le pouvoir, la fin de tour — y vit à demeure, au
 * lieu de flotter au-dessus du jeu et d'en cacher des cases.
 *
 * La règle qui décide du reste : **ce qui commente une case reste sur la
 * case**. Le menu d'ordres, la prévision de duel, le curseur et tout ce que
 * joue la partition ne quittent jamais l'image — un ordre se donne à côté de
 * son unité, pas à huit cents pixels de là.
 *
 * Et c'est une **vraie mise en page**, pas un panneau posé sur l'image : le
 * conteneur rend sa place à la toile par une marge intérieure (--rail-l,
 * posée par majRail), la toile se remesure (render3d/scene.ts mesure la
 * toile et non le conteneur), et la caméra continue de cadrer la carte entière
 * — au centre de ce qu'on voit, pas au centre de ce qui est caché.
 * ------------------------------------------------------------------------- */
/* Rail fermé : les deux zones n'existent pas pour la mise en page, et chaque
   panneau se positionne exactement comme avant, sur toute l'image. */
.atlas-hud .hud-carte,.atlas-hud .hud-rail{display:contents}
.atlas-hud[data-rail='oui']{display:grid;grid-template-columns:minmax(0,1fr) var(--rail-l)}
/* La zone de carte recouvre la toile au pixel près : c'est elle qui devient le
   repère des panneaux ancrés. --dock:0 parce que le dock est parti dans la
   colonne — les panneaux du bas n'ont plus à lui laisser sa hauteur. */
.atlas-hud[data-rail='oui'] .hud-carte{display:block;position:relative;grid-area:1/1;min-width:0;--dock:0px}
/* La colonne prend la **couleur de l'armée en main** : son bord et le voile de
   sa nappe. C'est le reproche des deux personas — « dans un Advance Wars, la
   fenêtre prend la couleur de l'armée qui joue ; ici c'est un filet » — et
   c'est la plus grande surface du HUD, donc l'endroit où le dire coûte le
   moins de pixels. */
.atlas-hud[data-rail='oui'] .hud-rail{display:flex;flex-direction:column;grid-area:1/2;gap:9px;min-height:0;padding:var(--haut) 12px var(--bas);pointer-events:auto;overflow:hidden;background:linear-gradient(180deg,var(--camp-voile),transparent 46%),linear-gradient(180deg,#12242e,#0c1922 58%,#0a151c);border-left:2px solid var(--camp);box-shadow:inset 3px 0 0 #ffffff0d,-8px 0 22px #04080c66}
/* Dans la colonne, un panneau n'est plus une fenêtre posée sur le jeu : il est
   une bande de la colonne. On lui retire donc sa position, sa largeur imposée
   et son ombre portée — une ombre n'a de sens que sur ce qui flotte. */
.atlas-hud[data-rail='oui'] .hud-rail .p,
.atlas-hud[data-rail='oui'] .hud-rail .partie,
.atlas-hud[data-rail='oui'] .hud-rail .bulletin,
.atlas-hud[data-rail='oui'] .hud-rail .dock{position:static;inset:auto;transform:none;width:auto;max-width:none;min-width:0;filter:none;box-shadow:none}
/* Le bandeau de tête : la journée, et mes fonds. La journée est peinte de la
   couleur du camp qui joue, et c'est la seule chose de la colonne qui change de
   camp — la trouver ailleurs demanderait de la chercher. */
.atlas-hud[data-rail='oui'] .hud-rail .partie{height:46px;flex:none}
.atlas-hud[data-rail='oui'] .hud-rail .partie .fonds{flex:1;justify-content:flex-end;font-size:var(--t6)}
.atlas-hud[data-rail='oui'] .hud-rail .bulletin{width:auto}
/* L'unité regardée prend toute la place qui reste : c'est le panneau qu'on lit
   le plus longtemps, et le seul dont la hauteur soit variable. */
.atlas-hud[data-rail='oui'] .hud-rail .inspect{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow:hidden;border:1px solid #35525f;border-top:3px solid var(--camp)}
.atlas-hud[data-rail='oui'] .hud-rail .inspect .fiche{flex:1 1 auto;max-height:none;min-height:0;overflow:auto}
.atlas-hud[data-rail='oui'] .hud-rail .bulletin{flex:none}
/* Le pied : le pouvoir, puis la fin de tour, l'un sur l'autre et sur toute la
   largeur. margin-top:auto le colle en bas — c'est le bouton qu'on cherche
   sans regarder, il doit être toujours au même endroit. */
.atlas-hud[data-rail='oui'] .hud-rail .dock{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;height:auto;flex:none;margin-top:auto}
.atlas-hud[data-rail='oui'] .hud-rail .fintour button{min-height:64px;font-size:var(--t6);padding:12px 16px}
.atlas-hud[data-rail='oui'] .hud-rail .fintour .symbole{width:30px;height:30px}
/* Le revenu, collé aux fonds : le solde dit où l'on en est, celui-ci dit où
   l'on va. Vert parce que c'est un gain, discret parce que ce n'est pas le
   chiffre qu'on lit en premier. */
.atlas-hud .fonds .revenu{margin-left:7px;font-style:normal;font-size:var(--t3);font-weight:800;color:#8ee0a4}
/* Une capture en cours : la couleur du signal, comme le fanion sur la carte. */
.atlas-hud .stats .capture{color:var(--signal);font-weight:800}
/* Le cran du pouvoir normal sur la jauge : la barre mesure le prix du super,
   et sans ce repère elle ne raconte que la moitié de ce qu'elle mesure. */
.atlas-hud .energie{position:relative}
.atlas-hud .energie::after{content:'';position:absolute;top:-3px;bottom:-3px;left:var(--cran,100%);width:2px;background:var(--papier);opacity:.7}
/* Les deux pouvoirs, dans la colonne, sur **une ligne chacun**.
 *
 * Le propriétaire les a jugés moches et les voulait plus petits. Ils portaient
 * chacun trois tailles de texte dans une boîte de 40 px — un rang en capitales
 * de 8,5 px, un nom de 12, un prix de 11 —, c'est-à-dire un panneau pour deux
 * libellés. Le rang **n'est plus un mot** : un éclair pour le pouvoir, deux
 * pour le super, et la peinture chaude du second. Il reste dans le nom
 * accessible, qui est le seul endroit où un mot valait mieux qu'un signe.
 */
.atlas-hud .jauge .pouvoirs{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:5px;padding:0 9px 9px}
.atlas-hud .jauge .pouvoir{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:6px;min-height:34px;padding:4px 8px;cursor:pointer;background:var(--encre-clair);color:var(--papier);border-bottom:3px solid #060f17;transition:background .09s,translate .06s,border-bottom-width .06s}
.atlas-hud .jauge .pouvoir:hover:not(:disabled){background:#2c5670}
.atlas-hud .jauge .pouvoir:active:not(:disabled){translate:0 2px;border-bottom-width:1px}
.atlas-hud .jauge .pouvoir .symbole{width:15px;height:15px;flex:none;color:var(--signal)}
.atlas-hud .jauge .pouvoir[data-niveau='super']:not(:disabled){background:#4a3a1c;border-bottom-color:#1d1608}
.atlas-hud .jauge .pouvoir[data-niveau='super']:hover:not(:disabled){background:#634d24}
.atlas-hud .jauge .pouvoir:disabled{background:#26333b;color:#8b99a0;border-bottom-color:#151d23;cursor:default}
.atlas-hud .jauge .pouvoir:disabled .symbole{color:#75838a}
.atlas-hud .jauge .pouvoir .nom{flex:1;min-width:0;font-size:var(--t3);font-weight:850;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.atlas-hud .jauge .pouvoir .prix{flex:none;font-style:normal;font-size:var(--t2);font-weight:800;color:var(--signal);font-variant-numeric:tabular-nums}
.atlas-hud .jauge .pouvoir:disabled .prix{color:#8b99a0}
/* Sous 480 px, le revenu cède : la journée et les fonds passent d'abord. */
@container atlas-interface (max-width: 480px){.atlas-hud .fonds .revenu{display:none}}
@container atlas-interface (max-width: 600px){
  .atlas-hud .jour{padding:0 10px;gap:5px;font-size:var(--t3)}
  .atlas-hud .fonds{padding-right:8px;font-size:var(--t4)}
  .atlas-hud .dock{width:calc(100% - 24px)}
  .atlas-hud .jauge button{gap:7px;padding:7px 9px}
  .atlas-hud .insigne{width:34px;height:43px}
  .atlas-hud .fintour button{font-size:var(--t5);padding:10px;gap:7px}
  .atlas-hud .inspect .in{padding:8px 10px;gap:8px}
  .atlas-hud .inspect canvas{width:36px;height:36px}
  .atlas-hud .voile{align-items:flex-end}
  .atlas-hud .bilan-ligne{grid-template-columns:minmax(0,1fr) 54px 54px}
}
/* Sous 640 px, le panneau ne s'ancre plus — il n'y a pas de place à côté d'une
   case — et redevient une feuille basse, ce qui est la bonne forme au doigt. La
   grille se resserre, la fiche garde sa part d'écran, et chaque partie défile
   pour elle-même : la feuille ne dépasse jamais le voile. */
@container atlas-interface (max-width: 640px){
  .atlas-hud .production-grille{grid-template-columns:repeat(auto-fill,minmax(88px,1fr));max-height:28cqh;padding:6px}
  .atlas-hud .production-grille canvas{width:34px;height:34px}
  .atlas-hud .fiche-corps{padding:8px 12px}
  .atlas-hud .fiche-action{padding:8px 12px 12px}
  /* Au doigt, une cible fait 44 px : les boutons resserrés à 34 pour la souris
     retrouvent leur taille dès que le panneau redevient une feuille basse. */
  .atlas-hud .production-entete .retour,.atlas-hud .ordres .retour{min-width:44px;min-height:44px}
}
@container atlas-interface (max-width: 360px){.atlas-hud .fonds .symbole{display:none}}
@container atlas-interface (max-height: 500px){
  .atlas-hud>*{--dock:60px;--bas:calc(8px + env(safe-area-inset-bottom,0px));--haut:calc(8px + env(safe-area-inset-top,0px))}
  .atlas-hud .bulletin{left:auto;right:max(var(--marge),env(safe-area-inset-right,0px));top:var(--haut)}
  .atlas-hud .dock{left:auto;right:max(12px,env(safe-area-inset-right,0px));transform:none;width:340px;max-width:50%}
  .atlas-hud .jauge button{padding:4px 9px}
  .atlas-hud .energie{height:8px;margin:3px 0}
  .atlas-hud .inspect{bottom:var(--bas);max-width:calc(50% - 30px);width:360px}
  .atlas-hud .inspect .in{padding:6px 10px}
  .atlas-hud .camera{bottom:calc(var(--bas) + var(--dock) + 8px);display:flex}
  .atlas-hud .ordres:not([data-ancre='oui']){left:auto;right:max(12px,env(safe-area-inset-right,0px));transform:none;width:320px;max-width:52%;max-height:calc(100% - 94px)}
  .atlas-hud .ordres-grille{gap:5px}
  .atlas-hud .ordres-grille button{min-height:44px;padding:8px}
  .atlas-hud .annonce{bottom:calc(var(--bas) + var(--dock) + 12px);max-width:45%;left:24%;z-index:4}
}
.atlas-hud button[data-action]{touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:filter .1s,translate .1s}
.atlas-hud button[data-action]:active:not(:disabled){translate:0 2px;filter:brightness(1.13)}
.atlas-hud button[data-action]:disabled{opacity:.45;cursor:default!important}
.atlas-hud button:focus-visible,.atlas-hud summary:focus-visible{outline:3px solid #ffd162!important;outline-offset:-3px}
/* Sur le papier de la production, l'anneau jaune du focus est invisible : le
   signal ne se voit pas sur une surface crème. Il prend l'encre. */
.atlas-hud .production button:focus-visible{outline-color:#152c3b!important}
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
    remettre: '<path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6"/><path d="M12 4v3"/>',
    attaquer: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>',
    attendre: '<path d="M6 3h12M6 21h12M7 3v5l10 8v5M17 3v5L7 16v5"/>',
    construire: '<path d="m4 20 10-10M14 3a6 6 0 0 0-4 8l-8 8 3 3 8-8a6 6 0 0 0 8-5l-4 3-4-4 3-4z"/>',
    ravitailler: '<path d="M4 7h13v14H4zM7 7V3h7v4M17 9l4 3v6h-4M8 14h5m-2.5-2.5v5"/>',
    fusionner: '<path d="M4 4v5l8 6 8-6V4M12 15v7m-4-5 4 5 4-5"/>',
    fin_de_tour: '<path d="M5 4l10 8-10 8z"/><path d="M19 4v16"/>',
    embarquer: '<path d="M3 16h18v5H3zM12 2v11m-5-5 5 5 5-5"/>',
    debarquer: '<path d="M3 16h18v5H3zM12 13V2M7 7l5-5 5 5"/>',
    // Se cacher ou se montrer : l'œil barré. Le même signe dans les deux sens,
    // c'est le libellé qui dit lequel.
    furtivite: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 20 20 4"/>',
    // Terminer : la coche, l'ordre part tel qu'il est composé.
    terminer: '<path d="m4 12 5 5L20 6"/>',
    // Les statistiques d'une unité, dites par un signe et non par un mot — c'est
    // la grammaire d'Advance Wars : une botte, un œil, une cible, une balle.
    mouvement: '<path d="M6 20V9l4-5 2 4h5v6h-3l-2 6zM6 20h12"/>',
    vue: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
    portee: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
    munitions: '<path d="M9 21V9a3 3 0 0 1 6 0v12zM9 17h6M12 6V3"/>',
    carburant: '<path d="M5 21V4h9v17zM5 9h9M14 8l3 2v8a2 2 0 0 0 4 0V9l-3-3"/>',
    // Les six signes qui remplacent des **caractères** : le HUD portait un « i »
    // en italique — l'icône « info » du web —, un « ↶ » de traitement de texte et
    // un « + » et un « − » de 25 px dans des carrés, que les deux personas ont
    // lus comme « une calculatrice ». Ici tout le reste est dessiné ; il n'y a
    // pas de raison que ces six-là soient de la typographie.
    retour: '<path d="M9 15 4 10l5-5"/><path d="M4 10h10a6 6 0 0 1 0 12h-4"/>',
    loupe: '<circle cx="11" cy="11" r="6.4"/><path d="m20.5 20.5-4.9-4.9"/>',
    replier: '<path d="m5 15 7-7 7 7"/>',
    zoom_plus: '<circle cx="11" cy="11" r="6.4"/><path d="m20.5 20.5-4.9-4.9M11 7.6v6.8M7.6 11h6.8"/>',
    zoom_moins: '<circle cx="11" cy="11" r="6.4"/><path d="m20.5 20.5-4.9-4.9M7.6 11h6.8"/>',
    // « Unité suivante » : deux chevrons, le signe d'un saut vers l'avant.
    unite_suivante: '<path d="m6 5 6 7-6 7"/><path d="m13 5 6 7-6 7"/>',
    // L'alerte : un signe qui double la couleur. `data-alerte` ne parlait que par
    // la teinte, ce qui n'annonce rien à qui confond l'orange et le rouge.
    alerte: '<path d="M12 3.6 2.4 20.4h19.2z"/><path d="M12 10v4.4"/><circle cx="12" cy="17.6" r="1.1" fill="currentColor" stroke="none"/>',
    // Le super pouvoir : **deux** éclairs. Le rang était un mot en capitales de
    // 8,5 px sur une ligne à lui ; c'est un signe, il tient dans le bouton.
    super_pouvoir: '<g fill="currentColor" stroke="none">'
      + '<path d="m13 2-9 12h7l-1 8 10-13h-7z" transform="translate(.5 3) scale(.62)"/>'
      + '<path d="m13 2-9 12h7l-1 8 10-13h-7z" transform="translate(10.5 3) scale(.62)"/></g>',
  };
  return `<svg class="symbole" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${chemins[type] ?? chemins['capturer']}</svg>`;
}

/** Sursis du panneau d'inspection : le temps d'atteindre son bouton. */
const MS_SURSIS_INSPECTION = 1500;

/** Le barreau des étoiles de défense : quatre crans, comme la fiche de terrain. */
export const ETOILES_MAX = 4;

/**
 * Les étoiles de défense d'un terrain, pleines puis creuses. Une **ponctuation**,
 * comme le « − » d'un chiffre : rien à traduire, et c'est le libellé
 * `hud.defense` qui porte les mots pour un lecteur d'écran.
 */
export function etoilesDefense(defense: number): string {
  const n = Math.max(0, Math.min(ETOILES_MAX, Math.round(defense)));
  return `${'★'.repeat(n)}${'☆'.repeat(ETOILES_MAX - n)}`;
}

/** Une vignette d'unité à peindre après insertion : le sprite vectoriel partagé. */
interface Vignette { id: string; emplacement: string; silhouette: Silhouette; camp: CampId; taille: number }

/**
 * Les emplacements du HUD, dans l'ordre du DOM. Chaque panneau vit dans le
 * sien et n'est réécrit que si son HTML a changé : le survol d'une case ne
 * touche que le panneau d'inspection, jamais les dix autres.
 */
const EMPLACEMENTS = [
  'partie', 'bulletin', 'dock', 'duel', 'inspection', 'ordres', 'camera', 'attente', 'annonce', 'production', 'fin',
] as const;
type Emplacement = typeof EMPLACEMENTS[number];

/**
 * Les trois zones du HUD lorsque la colonne de droite est ouverte.
 *
 * `carte` : au-dessus de l'image, souvent ancré à une case. `rail` : dans la
 * colonne. `plein` : ni l'une ni l'autre — une modale et son voile couvrent les
 * deux colonnes, et c'est ce qu'on attend d'une modale.
 */
export type ZoneHud = 'carte' | 'rail' | 'plein';

/**
 * Où vit chaque panneau. La règle qui tranche, et il n'y en a qu'une :
 * **ce qui commente une case reste sur la case**, ce qui décrit la partie s'en
 * va dans la colonne. Un ordre se donne à côté de l'unité — traverser l'écran
 * pour atteindre « Attaquer », c'est jouer plus lentement et viser moins bien.
 * La prévision de duel obéit à la même règle : elle parle de deux unités
 * précises, elle se lit près d'elles.
 */
export const ZONES: Readonly<Record<Emplacement, ZoneHud>> = Object.freeze({
  partie: 'rail',
  inspection: 'rail',
  bulletin: 'rail',
  dock: 'rail',
  duel: 'carte',
  ordres: 'carte',
  camera: 'carte',
  attente: 'carte',
  annonce: 'carte',
  production: 'plein',
  fin: 'plein',
});

/**
 * L'ordre de la colonne, de haut en bas : qui joue et ce que je possède, puis
 * l'unité regardée, puis le temps qu'il fera, et le pouvoir et la fin de tour
 * en pied. Les emplacements de la carte gardent l'ordre du DOM, qui est leur
 * ordre d'empilement.
 */
const ORDRE_RAIL: readonly Emplacement[] = ['partie', 'inspection', 'bulletin', 'dock'];

/** Largeur de la colonne de droite, en pixels. */
export const LARGEUR_RAIL = 340;

/**
 * En deçà de cette largeur de **conteneur**, pas de colonne : le plateau a
 * besoin de sa place avant tout, et sous cette taille la superposition — les
 * panneaux posés sur l'image, comme avant — reste la meilleure lecture.
 */
export const LARGEUR_MINIMALE_RAIL = 1000;

/**
 * Et en deçà de cette hauteur non plus : un téléphone couché a de la largeur et
 * pas de hauteur, une colonne y serait un tunnel. C'est le même cas que les
 * règles `@container (max-height: 500px)` de la feuille.
 */
export const HAUTEUR_MINIMALE_RAIL = 560;

/**
 * La colonne de droite tient-elle ? Mesurée sur le **conteneur**, jamais sur la
 * fenêtre : le jeu n'occupe pas toujours l'écran entier, et c'est la place
 * réellement disponible qui décide.
 */
export function railTient(largeur: number, hauteur: number): boolean {
  return largeur >= LARGEUR_MINIMALE_RAIL && hauteur >= HAUTEUR_MINIMALE_RAIL;
}

/**
 * Pose chaque HTML dans son emplacement **s'il a changé**, et rend les noms de
 * ceux qui ont été réécrits. `precedent` est mis à jour en place. Pure vis-à-vis
 * du DOM : elle n'écrit que `innerHTML`, ce qui la rend testable sans document.
 */
export function poserEmplacements(
  cibles: ReadonlyMap<string, { innerHTML: string }>,
  precedent: Map<string, string>,
  nouveau: ReadonlyMap<string, string>,
): string[] {
  const reecrits: string[] = [];
  for (const [nom, html] of nouveau) {
    if (precedent.get(nom) === html) continue;
    const cible = cibles.get(nom);
    if (!cible) continue;
    cible.innerHTML = html;
    precedent.set(nom, html);
    reecrits.push(nom);
  }
  return reecrits;
}

/**
 * L'ordre du menu de production : **par prix croissant**, à égalité l'ordre du
 * canon.
 *
 * `content/unites.json` range les unités par famille — infanterie, méca, recon,
 * char léger, char **lourd**, artillerie —, ce qui est le bon ordre pour lire un
 * catalogue et le mauvais pour tenir une boutique : un char à 15 000 y précède
 * une artillerie à 5 500, et ce que l'on peut payer se disperse au milieu de ce
 * que l'on ne peut pas. Trié, ce qui est à portée se rassemble en tête et le
 * gris tombe en pied.
 *
 * Le tri est **stable** et ne dépend que du prix, donc les positions ne bougent
 * pas d'une ouverture à l'autre : la mémoire du geste tient.
 */
export function ordreProduction(cat: Catalogue, unites: readonly CleUnite[]): CleUnite[] {
  return [...unites].sort((a, b) => (cat.unites[a]?.cout ?? 0) - (cat.unites[b]?.cout ?? 0));
}

/**
 * L'unité mise en avant à l'ouverture du menu : la première que les fonds
 * permettent, sinon la première tout court — une fiche vide n'apprend rien.
 */
export function premiereAbordable(
  cat: Catalogue, unites: readonly CleUnite[], fonds: number,
): CleUnite | null {
  return unites.find((c) => (cat.unites[c]?.cout ?? Infinity) <= fonds) ?? unites[0] ?? null;
}

/**
 * Monte le HUD HTML dans un conteneur (le même que le canvas, en position
 * relative). Rend `rafraichir()` et `demonter()`.
 */
export function monterHudHtml(
  conteneur: HTMLElement, api: ApiHud, horloge?: HorlogeScenes,
): HudHtml {
  const doc = conteneur.ownerDocument;
  poserStyle(doc);
  const racine = doc.createElement('div');
  racine.className = 'atlas-hud';
  racine.setAttribute('data-hud', 'html');
  conteneur.appendChild(racine);

  // Deux zones, et les modales par-dessus les deux. La zone de carte recouvre
  // exactement la toile, le rail occupe la place que le conteneur lui a rendue
  // en marge. Tant que le rail est fermé, les deux zones sont en
  // `display:contents` : elles n'existent pas pour la mise en page, et chaque
  // panneau se positionne comme il l'a toujours fait, sur toute l'image.
  const zoneCarte = doc.createElement('div');
  zoneCarte.className = 'hud-carte';
  racine.appendChild(zoneCarte);
  const zoneRail = doc.createElement('div');
  zoneRail.className = 'hud-rail';
  racine.appendChild(zoneRail);

  // Un enfant par emplacement, en `display:contents` : il n'existe pas pour la
  // mise en page, et la règle `.atlas-hud>*` continue de poser ses variables,
  // que les panneaux héritent. Le HTML posé la dernière fois est retenu par
  // emplacement : c'est la comparaison de chaînes qui épargne le DOM.
  const emplacements = new Map<Emplacement, HTMLElement>();
  const htmlPose = new Map<string, string>();
  // L'ordre de création est celui du DOM : le rail d'abord, dans son ordre à
  // lui, puis la carte et les modales dans l'ordre d'empilement d'`EMPLACEMENTS`.
  const ordre: Emplacement[] = [
    ...ORDRE_RAIL,
    ...EMPLACEMENTS.filter((nom) => ZONES[nom] !== 'rail'),
  ];
  for (const nom of ordre) {
    const el = doc.createElement('div');
    el.className = 'emplacement';
    el.setAttribute('data-emplacement', nom);
    el.style.display = 'contents';
    const zone = ZONES[nom];
    (zone === 'rail' ? zoneRail : zone === 'carte' ? zoneCarte : racine).appendChild(el);
    emplacements.set(nom, el);
  }

  /**
   * La colonne de droite s'ouvre et se ferme sur la taille **mesurée** du
   * conteneur. C'est la seule chose que le HUD écrive sur son hôte — avec la
   * position relative que `monterJeu` y pose déjà —, et c'est nécessaire : une
   * colonne posée sur l'image laisserait la caméra cadrer la carte derrière
   * elle. Le conteneur rend donc sa place à la toile par une marge intérieure,
   * la toile se remesure (`render3d/scene.ts`), et le plateau reste entier.
   */
  let largeurRail = 0;
  function majRail(): void {
    const ouvert = railTient(conteneur.clientWidth, conteneur.clientHeight);
    if (ouvert === (largeurRail > 0)) return;
    largeurRail = ouvert ? LARGEUR_RAIL : 0;
    conteneur.dataset['atlasRail'] = ouvert ? 'oui' : 'non';
    racine.dataset['rail'] = ouvert ? 'oui' : 'non';
    // La largeur ne s'écrit qu'ici : la feuille la lit, la toile la subit, les
    // scènes s'y bornent. Un nombre recopié dans le CSS aurait fini par mentir.
    conteneur.style.setProperty('--rail-l', `${largeurRail}px`);
  }
  conteneur.dataset['atlasHote'] = 'jeu';
  racine.dataset['rail'] = 'non';
  majRail();
  const observateurRail = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => { majRail(); })
    : null;
  observateurRail?.observe(conteneur);

  // Les scènes transitoires — chiffres, écran de combat, splash — vivent dans
  // un conteneur frère : le HUD remplace le DOM de ses emplacements, et une
  // scène qui y vivrait serait réécrite en plein vol.
  const scenes = monterScenes(conteneur, {
    vue: () => api.vue(),
    t: api.t,
    versEcran: (c) => api.versEcran(c),
    couper: api.couper ? () => api.couper?.() : undefined,
  }, horloge);

  let vignettes: Vignette[] = [];
  /** L'emplacement dont on compose le HTML : les vignettes s'y rattachent. */
  let emplacementCourant: Emplacement = 'partie';
  /**
   * Une vignette d'unité : le canvas, et la promesse de le peindre. Son
   * identifiant est **propre à l'emplacement** — numéroté sur tout le HUD, une
   * vignette qui disparaît d'un panneau renumérotait celles du suivant, dont le
   * HTML changeait donc sans raison.
   */
  function vignette(silhouette: Silhouette, camp: CampId, taille: number): string {
    const rang = vignettes.filter((vg) => vg.emplacement === emplacementCourant).length;
    const id = `vg_${emplacementCourant}_${rang}`;
    vignettes.push({ id, emplacement: emplacementCourant, silhouette, camp, taille });
    return `<canvas data-vignette="${id}" width="${taille}" height="${taille}"></canvas>`;
  }
  // La fiche du panneau d'inspection, elle, **reste ouverte** d'une case à
  // l'autre : c'est une façon de jouer, pas un choix par unité. Qui apprend la
  // laisse dépliée, qui connaît la referme une fois.
  let ficheInspection = false;
  /** Les effets des deux pouvoirs sont dépliés : on dépense une ressource de
   *  match, on doit pouvoir lire ce qu'on achète. */
  let pouvoirDetail = false;
  /**
   * La fiche longue du menu de production est dépliée. Repliée par défaut : le
   * panneau est ancré à côté d'un bâtiment, il ne peut pas faire sept cents
   * pixels de haut. Comme la fiche du panneau d'unité, c'est **une façon de
   * jouer et non un choix par unité** : qui apprend la laisse ouverte, qui
   * connaît la referme une fois.
   */
  let ficheProductionOuverte = false;
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
   * Le menu de production a un état à lui : l'unité dont on lit la fiche. Il
   * reste dans le HUD — le contrôleur sait ce qui est produisible, pas ce que le
   * joueur est en train de regarder. `productionOuverte` retient le bâtiment,
   * pour remettre la fiche sur la première unité abordable à chaque ouverture.
   */
  let productionOuverte: string | null = null;
  let uniteMiseEnAvant: CleUnite | null = null;

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

  /**
   * La tête de la colonne : la journée et mes fonds, **sur une seule bande**.
   *
   * C'étaient deux boîtes accolées plus une ligne de compte de bâtiments, et le
   * propriétaire a tranché : « certaines infos peuvent être réduites comme
   * journée 1 1500 €, et le 1/1 je ne suis pas sûr qu'il soit utile ». Le compte
   * de bâtiments est retiré — il disait le rapport de forces, mais il le disait
   * au prix d'une ligne permanente pour un chiffre qu'on regarde deux fois par
   * partie. Reste ce qu'on lit à chaque tour : quel jour, combien j'ai, combien
   * j'aurai.
   */
  function panneauPartie(v: VueJeu): string {
    // Les fonds affichés sont **les miens**, pas ceux du camp qui joue : pendant
    // le tour adverse, montrer sa trésorerie est une fuite d'information autant
    // qu'une confusion.
    const camp = v.etat.camps.find((c) => c.id === v.camp);
    const journee = api.t('hud.journee', { n: Math.max(1, v.etat.journee) });
    const fonds = api.t('hud.fonds', { n: nombreIntl(v.locale, camp?.fonds ?? 0) });
    // Le solde dit où l'on en est, le revenu dit où l'on va. Lu au moteur
    // (`revenuParTour`), jamais recalculé ici.
    const revenu = revenuParTour(v.etat, v.camp);
    const libelleRevenu = api.t('hud.revenu', { n: nombreIntl(v.locale, revenu) });
    // La couleur du camp qui joue n'est **pas** écrite ici : la racine la pose
    // pour tout le HUD, et la bande en hérite. L'écrire dans le HTML ferait
    // réécrire ce panneau à chaque changement de tour pour une couleur.
    return `<div class="partie" role="group" aria-label="${ech(api.t('hud.partie_en_cours'))}">`
      + `<span class="jour">${iconeOrdre('jour')}<b>${ech(journee)}</b></span>`
      + `<span class="fonds" aria-label="${ech(fonds)}" title="${ech(fonds)}">${iconeOrdre('fonds')}`
      + `<b>${ech(nombreIntl(v.locale, camp?.fonds ?? 0))}</b>`
      + `<em class="revenu" aria-label="${ech(libelleRevenu)}" title="${ech(libelleRevenu)}">`
      + `+${ech(nombreIntl(v.locale, revenu))}</em></span></div>`;
  }

  /**
   * Le bulletin : **trois journées côte à côte**, celle qu'on joue et les deux
   * qui viennent.
   *
   * C'était un `<details>` — un accordéon HTML dans le coin d'un HUD de jeu —
   * dont le résumé disait le temps du jour et le corps, replié, les prévisions.
   * Or la météo change le mouvement **et** la vision : la ranger derrière un
   * clic, c'est ranger une règle derrière un clic. Trois cases, toujours
   * ouvertes, la journée en cours mise en avant.
   */
  function panneauBulletin(v: VueJeu): string {
    // Le Bulletin annonce **ce que le joueur voit** : il lit l'ambiance affichée,
    // qu'un aperçu peut avoir forcée, et non le climat brut de l'état.
    const jour = Math.max(1, v.etat.journee);
    const cases = [
      { meteo: v.ambiance.meteo, jour, courant: true },
      { meteo: v.etat.climat.previsions[0], jour: jour + 1, courant: false },
      { meteo: v.etat.climat.previsions[1], jour: jour + 2, courant: false },
    ];
    const cellules = cases.map(({ meteo, jour: j, courant }) => {
      if (!meteo) return '';
      const nom = libelleMeteo(api.t, meteo);
      return `<div class="meteo-case" data-courant="${courant ? 'oui' : 'non'}"`
        + ` aria-label="${ech(`${api.t('hud.meteo_jour', { n: j })} · ${nom}`)}">`
        + `<span class="meteo-jour">${ech(api.t('hud.meteo_jour', { n: j }))}</span>`
        + iconeMeteo(meteo)
        + `<span class="meteo-nom">${ech(nom)}</span></div>`;
    }).join('');
    // La saison et la phase du jour restent dites : elles pèsent sur la vision
    // autant que le temps, et elles n'ont nulle part ailleurs où vivre.
    const ambiance = `${libelleSaison(api.t, v.ambiance.saison)} · ${libellePhase(api.t, v.ambiance.phase)}`;
    return `<div class="bulletin" role="group" aria-label="${ech(api.t('hud.meteo_titre'))}">`
      + `<div class="meteo-trois">${cellules}</div>`
      + `<div class="meteo-ambiance">${ech(ambiance)}</div></div>`;
  }

  /**
   * Le commandant, sa jauge et ses deux pouvoirs — en trois lignes basses.
   *
   * Trois corrections, et aucune n'est une question de goût.
   *
   * **Le seuil était faux.** Le bouton n'était actif qu'à jauge *pleine*, or la
   * jauge se remplit jusqu'au prix du **super** pouvoir (`jaugeMax` vaut les
   * barres du super) : le pouvoir normal, qui coûte moins, devenait jouable bien
   * avant et le bouton restait éteint. On lit désormais le verdict du moteur
   * (`verifierPouvoir`, passé par `VueJeu.pouvoirs`), qui connaît en plus le cas
   * « déjà utilisé ce tour ».
   *
   * **Le super pouvoir n'avait pas de bouton.** Une mécanique entière — moteur,
   * partition, splash, chaîne d'interface — injoignable parce qu'un seul
   * `'normal'` était écrit en dur.
   *
   * **Et il ne disait pas ce qu'il fait.** On dépensait une ressource de match
   * sans savoir ce qu'on achetait. Le « i » déplie les effets, lus sur les
   * données du commandant (`lignesPouvoir`) et jamais rédigés à la main : un
   * texte écrit à côté des chiffres finit par mentir.
   *
   * Le panneau a maigri au passage — l'insigne pentagonal de 42 px, le nom sur sa
   * ligne et la mention « Pouvoir » en faisaient le plus gros objet de la
   * colonne pour l'information la moins fréquente.
   */
  function panneauJauge(v: VueJeu): string {
    const camp = v.etat.camps.find((c) => c.id === v.camp);
    if (!camp) return '';
    const pal = paletteDe(v.camp);
    const nom = nomCommandant(v.locale, camp.commandantCle) || api.t('hud.commandant');
    const part = camp.jaugeMax > 0 ? Math.min(1, camp.jauge / camp.jaugeMax) : 0;
    const monTour = !v.attenteIa && !v.etat.partie.terminee && v.etat.campCourant === v.camp;
    const p = v.pouvoirs ?? null;
    const dispo = (niveau: 'normal' | 'super'): boolean => monTour && (p?.[niveau].pret ?? false);
    const normalPret = dispo('normal');
    const segments = Math.min(10, Math.max(1, Math.ceil(camp.jaugeMax / 100)));
    const energie = Array.from({ length: segments }, (_, i) => `<i><b style="width:${Math.max(0, Math.min(1, part * segments - i)) * 100}%"></b></i>`).join('');
    // Le cran du pouvoir normal sur la jauge : à partir d'où il se déclenche.
    // Sans lui, la jauge ne raconte que la moitié de ce qu'elle mesure.
    const cran = p && camp.jaugeMax > 0
      ? ` style="--cran:${Math.max(0, Math.min(100, (p.normal.cout / camp.jaugeMax) * 100))}%"`
      : '';
    const libelle = api.t(normalPret ? 'hud.pouvoir_pret' : 'hud.jauge_pouvoir');
    const cadre = (dedans: string): string =>
      `<div class="p jauge" data-pret="${normalPret ? 'oui' : 'non'}" style="--camp:${pal.light}">${dedans}</div>`;

    // Écran étroit : le bouton unique d'avant, au seuil juste cette fois. Un dock
    // de 72 px de haut ne porte pas deux pouvoirs nommés et leur explication.
    if (largeurRail === 0 || !p) {
      return cadre(`<button type="button" data-action="pouvoir" aria-label="${ech(nom)} · ${ech(libelle)}"`
        + `${normalPret ? '' : ' disabled'}>`
        + `<span class="insigne">${iconeOrdre('pouvoir')}</span><span class="commande">`
        + `<span class="tt" style="display:block">${ech(nom)}</span>`
        + `<span class="energie" aria-hidden="true"${cran}>${energie}</span>`
        + `<span class="sb" style="display:block">${ech(libelle)}</span>`
        + `</span></button>`);
    }

    // Dans la colonne : le commandant et son bouton de détail sur une ligne, la
    // jauge sous eux, les deux pouvoirs en pied. Un bouton éteint dit
    // **pourquoi** il l'est, au lieu de se contenter de pâlir — la même règle
    // que « Fonds insuffisants ».
    //
    // Chaque pouvoir tient sur **une ligne** : un éclair, le nom, le prix. Il en
    // portait trois, dont un rang en capitales de 8,5 px qui répétait ce que la
    // place et la peinture du bouton disaient déjà. Le rang n'est plus un mot,
    // c'est un signe — un éclair, deux pour le super —, et il reste écrit dans le
    // nom accessible, qui est le seul endroit où un mot vaut mieux qu'un dessin.
    const bouton = (niveau: 'normal' | 'super', action: string, cle: string): string => {
      const n = p[niveau];
      const pret = dispo(niveau);
      const titre = api.t(n.nom) || n.nom;
      const motif = pret ? '' : ` title="${ech(api.t('hud.jauge_insuffisante'))}"`;
      return `<button type="button" class="pouvoir" data-action="${action}" data-niveau="${niveau}"`
        + `${pret ? '' : ' disabled'}${motif} aria-label="${ech(`${api.t(cle)} · ${titre}`)}">`
        + iconeOrdre(niveau === 'super' ? 'super_pouvoir' : 'pouvoir')
        + `<span class="nom">${ech(titre)}</span>`
        + `<em class="prix">${ech(nombreIntl(v.locale, n.cout))}</em></button>`;
    };
    const details = pouvoirDetail
      ? `<div class="pouvoir-effets">${(['normal', 'super'] as const).map((niveau) => {
        const lignes = lignesPouvoir(api.t, p[niveau].effets);
        if (lignes.length === 0) return '';
        return `<div class="effet"><span class="rang">${ech(api.t(niveau === 'super' ? 'hud.super_pouvoir' : 'hud.jauge_pouvoir'))}</span>`
          + lignes.map((l) => `<span class="puce">${ech(l)}</span>`).join('') + `</div>`;
      }).join('')}</div>`
      : '';
    const aide = api.t('hud.pouvoir_details');
    return cadre(`<div class="commandant">`
      + `<span class="tt">${ech(nom)}</span>`
      + `<button type="button" class="detail" data-action="pouvoir_info" aria-expanded="${pouvoirDetail}"`
      + ` aria-label="${ech(aide)}" title="${ech(aide)}">${iconeOrdre(pouvoirDetail ? 'replier' : 'loupe')}</button>`
      + `</div>`
      + `<span class="energie" aria-hidden="true"${cran}>${energie}</span>`
      + details
      + `<div class="pouvoirs">${bouton('normal', 'pouvoir', 'hud.jauge_pouvoir')}`
      + `${bouton('super', 'pouvoir_super', 'hud.super_pouvoir')}</div>`);
  }

  /**
   * Le panneau d'unité. `efface` dit s'il doit céder la place : sur l'image, un
   * menu d'ordres ou une prévision de duel occuperait le même coin, et deux
   * panneaux qui se recouvrent ne se lisent ni l'un ni l'autre.
   *
   * **Dans la colonne, il ne s'efface jamais**, et c'est le premier gain de la
   * colonne. Jusqu'ici, ouvrir le menu d'ordres emportait les PV, les munitions
   * et le carburant de l'unité — à l'instant précis où l'on choisit entre
   * attaquer et capturer, les trois chiffres qui décident quittaient l'écran.
   * Ce n'était pas un manque de place, c'était deux panneaux qui se disputaient
   * un coin ; la colonne leur en donne chacun un.
   */
  function panneauInspection(v: VueJeu, efface: boolean): string {
    if (efface) return '';
    // Une unité que la carte cache — brouillard, forêt, furtivité — n'est pas
    // sous le curseur : l'état la porte, le joueur ne la voit pas.
    const vue = (u: Unite): boolean => !v.unitesVues || v.unitesVues.has(u.id);
    const sousCurseur = v.curseur
      ? v.etat.unites.find((u) => !u.dansTransport && u.x === v.curseur!.x && u.y === v.curseur!.y && vue(u))
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
      // Le sursis court depuis la dernière fois que le panneau a montré une
      // unité **pour une raison directe** — curseur ou sélection. Une unité
      // seulement retenue ne le prolonge pas, sans quoi il ne finirait jamais.
      if (sousCurseur || selectionnee) vueA = Date.now();
      // Le sursis expire tout seul : sans ce rappel, le panneau garderait son
      // unité jusqu'au prochain mouvement, c'est-à-dire parfois indéfiniment.
      // Mais le rappel ne s'arme que lorsque le sursis est la **seule** raison
      // de retenir l'unité : armé à chaque rendu, il reconstruisait tout le
      // HUD toutes les 1,5 s tant qu'une unité était sous le curseur — ce qui
      // rendait chaque clic incertain sous un rendu lent.
      if (graceInspection) {
        clearTimeout(graceInspection);
        graceInspection = null;
      }
      if (!sousCurseur && !selectionnee && !ficheInspection && !pointeurSurHud) {
        graceInspection = setTimeout(rafraichir, MS_SURSIS_INSPECTION + 40);
      }
    }

    // Le terrain est celui de l'unité montrée : un panneau qui titre « Char
    // léger » et sous-titre le terrain d'une case vide se contredit.
    const c = unite ? { x: unite.x, y: unite.y } : v.curseur;
    if (!c) return '';
    const terrain = terrainLogique(v.etat, v.catalogue, c);
    if (terrain === null) return '';
    const type = unite ? v.catalogue.unites[unite.type] : undefined;
    const fiche = v.catalogue.terrains[terrain];
    const defense = barreauDefense(fiche?.defense ?? 0);
    const titre = unite && type
      ? nomUnite(v.locale, v.catalogue, unite.type)
      : nomTerrain(v.locale, v.catalogue, terrain);
    const sousTitre = unite
      ? `${ech(nomTerrain(v.locale, v.catalogue, terrain))} · ${defense}`
      : defense;
    // Chaque statistique est un `span` : celle qui est en alerte porte
    // `data-alerte`, et un libellé lisible par un lecteur d'écran. Le texte
    // lui-même ne change pas — un chiffre reste un chiffre.
    //
    // L'alerte ne passait que par la **couleur**, ce qui ne dit rien à qui
    // confond l'orange et le rouge. Elle porte désormais trois registres : un
    // **signe** (le triangle), une **forme** (le cadre seul en orange, la
    // plaque pleine en rouge) et la teinte. Il en reste deux si l'une manque.
    const stat = (texte: string, alerte: Alerte = null, cleAlerte?: string): string => {
      if (!alerte || !cleAlerte) return `<span>${ech(texte)}</span>`;
      const libelle = api.t(cleAlerte);
      return `<span data-alerte="${alerte}" title="${ech(libelle)}" aria-label="${ech(`${texte} · ${libelle}`)}">`
        + `${iconeOrdre('alerte')}${ech(texte)}</span>`;
    };
    const lignes: string[] = [];
    let embarquees = '';
    if (unite && type) {
      lignes.push(stat(api.t('hud.points_de_vie', { n: pvAffiches(unite.pv) })));
      // Tant qu'un chemin est pointé sur **cette** unité, la case de mouvement
      // dit ce qu'il coûte : une route et une forêt ne se paient pas pareil.
      const chemin = unite.id === v.selection ? v.cheminCout ?? null : null;
      lignes.push(chemin
        ? stat(api.t('hud.chemin_cout', { n: chemin.cout, max: chemin.max }))
        : stat(api.t('hud.mouvement', { n: type.mouvement })));
      // Même ordre que la fiche de production : mouvement, portée, munitions,
      // carburant. La portée ne se dit que si elle apprend quelque chose.
      if (type.portee[1] > 1) lignes.push(stat(api.t('hud.portee', { n: portee(type.portee) })));
      if (unite.munitions !== null) {
        const a = alerteMunitions(type, unite.munitions);
        lignes.push(stat(api.t('hud.munitions', { n: unite.munitions }), a,
          a === 'rouge' ? 'hud.munitions_vides' : 'hud.munitions_faible'));
      }
      if (unite.carburant !== null) {
        // L'alerte se juge sur ce que l'unité brûle **vraiment** par tour : une
        // furtive paie un surcoût, et le chiffre du catalogue lui mentirait.
        const a = alerteCarburant(type, unite.carburant, consommationParTour(type, unite));
        lignes.push(stat(api.t('hud.carburant', { n: unite.carburant }), a,
          a === 'rouge' ? 'hud.carburant_critique' : 'hud.carburant_faible'));
      }
      // Furtive : repérée au contact seulement. Dit en clair, parce qu'une
      // figurine translucide ne se lit pas au doigt.
      if (unite.furtive === true) lignes.push(`<span class="furtive">${ech(api.t('hud.furtive'))}</span>`);
      // Déplacée par un ordre en deux temps : elle a bougé, sa suite reste à
      // donner, et la sélectionner rouvre son menu. Dit en clair aussi — une
      // unité qui ne bouge plus sans avoir joué n'a pas d'autre signe.
      if (unite.etat === 'deplacee') lignes.push(`<span class="deplacee">${ech(api.t('hud.deplacee'))}</span>`);
      // Une capture en cours, et **combien il en reste**. Le fanion hissé à
      // mi-hauteur de la 3D dit « ça avance » ; il ne dit pas « encore un tour ».
      // Et comme un QG et un bâtiment désaffecté demandent le double, et qu'une
      // unité entamée gagne moins de points, le compte n'est pas devinable — le
      // seuil est donc lu au moteur, case par case.
      if (unite.pointsCapture > 0) {
        const seuil = seuilCapture(v.etat, v.catalogue, { x: unite.x, y: unite.y });
        lignes.push(`<span class="capture">${ech(api.t('hud.capture_points', { n: unite.pointsCapture, total: seuil }))}</span>`);
      }
      // Ce qu'un transport porte : sans cette ligne, deux unités embarquées
      // n'existent nulle part à l'écran.
      if (unite.cargo.length > 0) {
        const liste = unite.cargo
          .map((id) => v.etat.unites.find((a) => a.id === id))
          .filter((a): a is Unite => a !== undefined)
          .map((a) => nomCourtUnite(v.locale, v.catalogue, a.type))
          .join(', ');
        if (liste) embarquees = `<span class="embarquees">${ech(api.t('hud.embarquees', { liste }))}</span>`;
      }
    }
    const icone = unite && type ? vignette(type.silhouette, unite.camp, 46) : '';
    const bord = unite ? paletteDe(unite.camp).main : paletteDe(null).main;
    // Le bouton n'apparaît que sur une unité : un terrain n'a pas de fiche, et
    // une case vide ne doit pas offrir une commande qui ne ferait rien. Une
    // loupe, et un chevron une fois ouverte : le « i » en italique était l'icône
    // « info » du web, dans une interface qui dessine tout le reste.
    const detail = unite
      ? `<button type="button" class="detail" data-action="fiche" aria-expanded="${ficheInspection}" `
        + `aria-label="${ech(api.t('fiche.detail'))}" title="${ech(api.t('fiche.detail'))}">`
        + `${iconeOrdre(ficheInspection ? 'replier' : 'loupe')}</button>`
      : '';
    // La **zone de danger** : le calcul existe depuis toujours, le geste est un
    // double-clic, et rien ne l'annonçait — une fonctionnalité qu'aucun joueur ne
    // peut découvrir n'existe pas. L'astuce ne paraît que sur une unité adverse,
    // la seule où le geste veuille dire quelque chose, et jamais pendant qu'on
    // vise : à cet instant la portée est déjà peinte sur la carte.
    const astuce = unite && unite.camp !== v.camp && !v.visee && !v.menu
      ? `<div class="astuce">${iconeOrdre('attaquer')}<span>${ech(api.t('hud.danger_astuce'))}</span></div>`
      : '';
    return `<div class="p inspect" role="group" aria-label="${ech(api.t('hud.panneau_unite'))}" style="--camp:${bord}">`

      + `<div class="in">${icone}<div style="min-width:0">`
      + `<div class="tt">${ech(titre)}</div><div class="sb">${sousTitre}</div>`
      + (lignes.length > 0 ? `<div class="stats">${lignes.join(' · ')}${embarquees}</div>` : '')
      + `</div>${detail}${v.selection && !v.attenteIa ? boutonRetour() : ''}</div>`
      // Le chemin pointé traverse du noir : on prévient que le menu viendra
      // après la marche, pas avant. L'œil est le signe de la vision partout ailleurs.
      + (v.cheminAveugle === true
        ? `<div class="aveugle" role="status">${iconeOrdre('vue')}<span>${ech(api.t('hud.chemin_aveugle'))}</span></div>`
        : '')
      + astuce
      + (unite && ficheInspection ? blocFiche(v, unite.type, { enJeu: unite }) : '')
      + `</div>`;
  }

  /** Le barreau d'étoiles d'un terrain, avec ses mots pour un lecteur d'écran. */
  function barreauDefense(defense: number): string {
    const n = Math.max(0, Math.min(ETOILES_MAX, Math.round(defense)));
    return `<span class="etoiles" aria-label="${ech(api.t('hud.defense', { n }))}">${etoilesDefense(n)}</span>`;
  }

  /**
   * Ce que le terrain retire aux dégâts, en pourcentage : « −20 % ». `facteur`
   * est celui du moteur (`facteurTerrain`) — le HUD ne fait que le dire en pour
   * cent, il ne le calcule pas. À découvert, rien à annoncer : chaîne vide.
   */
  function partTerrain(facteur: number): string {
    const evite = Math.round((1 - facteur) * 100);
    return evite <= 0 ? '' : `<em class="part">${ech(api.t('hud.defense_part', { n: evite }))}</em>`;
  }

  /**
   * Une ligne de duel : la figurine, le nom, la jauge de PV, et « avant → après ».
   *
   * Elle portait aussi le terrain avec ses étoiles et la part retirée, et le mot
   * qui disait lequel des deux coups elle encaissait. Le propriétaire l'a jugé
   * illisible le 8 septembre 2026 — « je ne comprends pas la riposte, ça fait
   * trop d'informations à l'écran » —, et il a raison sur le fond : une
   * prévision se lit **en un dixième de seconde**, entre le moment où l'on vise
   * et celui où l'on clique. Huit lignes de texte n'entrent pas dans ce temps.
   *
   * Le terrain n'est pas perdu pour autant : le panneau d'unité le porte, avec
   * ses étoiles de défense, et dans la colonne de droite il ne s'efface plus
   * pendant la visée — c'est là qu'on va chercher le détail, pas dans une
   * fenêtre posée sur la case qu'on vise.
   */
  function ligneDuel(v: VueJeu, unite: Unite, apres: number): string {
    const type = v.catalogue.unites[unite.type];
    if (!type) return '';
    const avant = pvAffiches(unite.pv);
    const touche = apres < avant;
    return `<div class="duel-camp" data-perte="${touche ? 'oui' : 'aucune'}">`
      + vignette(type.silhouette, unite.camp, 36)
      + `<span style="min-width:0"><span class="tt" style="display:block">${ech(nomUnite(v.locale, v.catalogue, unite.type))}</span>`
      + jaugePv(avant, apres)
      + `</span><span class="duel-chiffres">`
      + `${ech(String(avant))}<em>&rarr;</em><b>${ech(String(apres))}</b></span></div>`;
  }

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
    // Le bandeau ne dit plus que ce qui est **notable** : une cible mise hors
    // jeu, ou un tir auquel on ne répond pas. « Riposte −2 PV » répétait en
    // mots le second chiffre de la fenêtre, et c'était la ligne de trop.
    const issue = p.cibleHorsJeu
      ? api.t('hud.duel_hors_jeu')
      : (p.riposte > 0 ? '' : api.t('hud.duel_sans_riposte'));
    return `<div class="p duel"${ancrer(c, 152)} role="group" aria-label="${ech(api.t('hud.duel'))}">`
      + `<div class="duel-entete">${iconeOrdre('attaquer')}<span>${ech(api.t('hud.duel'))}</span>`
      + (issue === '' ? '' : `<span class="issue">${ech(issue)}</span>`) + `</div>`
      + ligneDuel(v, cible, p.pvCible)
      + ligneDuel(v, attaquant, p.pvAttaquant)
      + '</div>';
  }

  function panneauOrdres(v: VueJeu): string {
    if (!v.menu || v.menu.options.length === 0) return '';
    const boutons = v.menu.options.map((o) => {
      // « Débarquer <nom> » : l'entrée nomme et dessine le passager qu'elle pose,
      // et le renvoie avec le choix — deux passagers, deux entrées.
      const passager = o.passager ? v.etat.unites.find((u) => u.id === o.passager) : undefined;
      const tp = passager ? v.catalogue.unites[passager.type] : undefined;
      const libelle = passager && tp
        ? api.t(o.cle, { unite: nomUnite(v.locale, v.catalogue, passager.type) })
        : api.t(o.cle);
      const figurine = passager && tp ? vignette(tp.silhouette, passager.camp, 24) : '';
      const attribut = o.passager ? ` data-passager="${ech(o.passager)}"` : '';
      return `<button type="button" data-action="suite" data-valeur="${ech(o.id)}"${attribut}${o.disponible ? '' : ' disabled'}>`
        + `${iconeOrdre(o.id)}${figurine}<span>${ech(libelle)}</span></button>`;
    }).join('');
    // Hauteur estimée du panneau : en-tête, lignes de 46 px et leur écart, marges.
    const hauteur = 46 + v.menu.options.length * 51 + 8;
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
  function ancrer(c: Case | null | undefined, hauteur: number, largeur = LARGEUR_ANCRE): string {
    // La largeur de **l'image**, pas celle du HUD : la racine couvre aussi la
    // colonne de droite, et un panneau ancré qui s'autoriserait cette largeur
    // se poserait sous le rail, là où la case qu'il commente n'est pas.
    const L = racine.clientWidth - largeurRail;
    const H = racine.clientHeight;
    if (!c || L < LARGEUR_MINIMALE_ANCRE) return '';
    const p = api.versEcran(c);
    if (!p) return '';
    const droite = p.x + ECART_ANCRE + largeur <= L - 12;
    const x = droite ? p.x + ECART_ANCRE : p.x - ECART_ANCRE - largeur;
    const y = p.y - hauteur / 2;
    const cx = Math.round(Math.max(12, Math.min(L - largeur - 12, x)));
    const cy = Math.round(Math.max(12, Math.min(Math.max(12, H - hauteur - 12), y)));
    return ` data-ancre="oui" style="left:${cx}px;top:${cy}px"`;
  }

  function boutonRetour(): string {
    const titre = ech(api.t('menu.retour'));
    return `<button type="button" class="retour" data-action="fermer" aria-label="${titre}" title="${titre}">${iconeOrdre('retour')}</button>`;
  }

  /**
   * Une **tuile de terrain** de 22 px : le carré du terrain, dans sa propre
   * couleur, et un motif qui le distingue.
   *
   * Les couleurs ne sont pas inventées ici — chaque terrain porte sa `palette`
   * dans le canon (`content/terrains.json`), la même que le plateau de
   * l'écran-titre lit déjà. Une seconde table de couleurs finirait par diverger
   * de la première, et c'est la faute que ce dépôt a déjà commise cinq fois.
   *
   * Le motif, lui, est une **forme**, pas une couleur : une liste de terrains
   * qui ne se distingueraient que par leur teinte serait illisible à qui
   * confond le vert et le brun.
   */
  function vignetteTerrain(v: VueJeu, cle: CleTerrain): string {
    const pal = v.catalogue.terrains[cle]?.palette;
    if (!pal) return '';
    const fond = `<rect width="22" height="22" fill="${pal.main}"/>`;
    // Un motif par famille de terrain : le relief pointe, l'eau ondule, la voie
    // traverse, le bâti se dresse. Les autres restent un aplat.
    const motifs: Partial<Record<CleTerrain, string>> = {
      foret: `<path d="M6 16l4-8 4 8zM12 17l4-7 4 7z" fill="${pal.dark}"/>`,
      herbe_haute: `<path d="M4 18v-5M8 18v-7M12 18v-5M16 18v-7" stroke="${pal.dark}" stroke-width="2"/>`,
      montagne: `<path d="M2 18l7-11 5 7 3-4 3 8z" fill="${pal.dark}"/>`,
      route: `<path d="M0 9h22v4H0z" fill="${pal.light}"/><path d="M3 11h4M10 11h4M17 11h3" stroke="${pal.dark}" stroke-width="1.4"/>`,
      pont: `<path d="M0 8h22v6H0z" fill="${pal.light}"/><path d="M4 8v6M18 8v6" stroke="${pal.dark}" stroke-width="1.6"/>`,
      plage: `<path d="M0 15c4-2 7 2 11 0s7-2 11 0v7H0z" fill="${pal.dark}"/>`,
      mer: `<path d="M0 8c4-2 7 2 11 0s7-2 11 0M0 14c4-2 7 2 11 0s7-2 11 0" stroke="${pal.light}" stroke-width="1.8" fill="none"/>`,
      riviere: `<path d="M7 0c4 6-4 10 0 14s-2 6 0 8" stroke="${pal.light}" stroke-width="3" fill="none"/>`,
      ville: `<path d="M4 18v-8h5v8zM11 18V6h7v12z" fill="${pal.dark}"/>`,
      usine: `<path d="M3 18v-7l5 3v-3l5 3V5h6v13z" fill="${pal.dark}"/>`,
      aeroport: `<path d="M11 3l3 8h6l-6 3 2 6-5-4-5 4 2-6-6-3h6z" fill="${pal.dark}"/>`,
      qg: `<path d="M5 19V7l6-4 6 4v12z" fill="${pal.dark}"/>`,
      radar: `<path d="M11 19V9M4 9a7 7 0 0 1 14 0z" stroke="${pal.dark}" stroke-width="2" fill="none"/>`,
      port: `<path d="M11 4v14M6 12a5 5 0 0 0 10 0M7 6h8" stroke="${pal.dark}" stroke-width="2" fill="none"/>`,
    };
    return `<svg class="tuile" viewBox="0 0 22 22" aria-hidden="true">${fond}${motifs[cle] ?? ''}</svg>`;
  }

  function panneauCamera(): string {
    if (!api.zoomer && !api.recentrer && !api.tourner && !api.uniteSuivante) return '';
    const bouton = (action: string, cle: string, contenu: string): string => `<button type="button" data-action="${action}" aria-label="${ech(api.t(cle))}" title="${ech(api.t(cle))}"><span aria-hidden="true">${contenu}</span></button>`;
    // Une flèche qui tourne autour d'un point : c'est la carte qui pivote, pas la pièce.
    const fleche = (sens: 1 | -1): string => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${sens === -1 ? ' style="transform:scaleX(-1)"' : ''}><path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M17 3v4.5h-4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>`;
    // Les deux zooms sont des **loupes**, pas un « + » et un « − » de 25 px dans
    // des carrés : les deux personas y ont lu « une calculatrice », et ils ont
    // raison — c'était le seul endroit du HUD où un signe de clavier faisait
    // office de dessin.
    return '<div class="camera">'
      + (api.uniteSuivante ? bouton('unite_suivante', 'hud.unite_suivante', iconeOrdre('unite_suivante')) : '')
      + (api.tourner ? bouton('tourner_gauche', 'hud.tourner_gauche', fleche(-1)) : '')
      + (api.zoomer
        ? bouton('zoom_plus', 'hud.zoom_plus', iconeOrdre('zoom_plus'))
          + bouton('zoom_moins', 'hud.zoom_moins', iconeOrdre('zoom_moins'))
        : '')
      + (api.tourner ? bouton('tourner_droite', 'hud.tourner_droite', fleche(1)) : '')
      + (api.recentrer ? bouton('recentrer', 'hud.recentrer', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="6"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/></svg>') : '')
      + '</div>';
  }

  /**
   * Fin de tour, et **ce qu'il reste à jouer**. Le compte se lit sur l'état, sans
   * rien demander au moteur : une unité de mon camp, hors transport, qui peut
   * encore recevoir un ordre — prête, ou déplacée par un ordre en deux temps et
   * dont la suite reste à donner. Une unité produite ce tour ne compte pas :
   * elle ne peut rien faire avant la journée suivante, et la compter ferait
   * hésiter devant un bouton qui n'a plus rien à attendre. C'est l'information
   * qui manquait pour ne pas terminer son tour par accident.
   */
  function panneauFinTour(v: VueJeu): string {
    const actif = !v.attenteIa && !v.etat.partie.terminee && v.etat.campCourant === v.camp;
    const pretes = v.etat.unites.filter(
      (u) => u.camp === v.camp && (u.etat === 'prete' || u.etat === 'deplacee') && !u.dansTransport,
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
    return `<div class="p attente" style="--camp:${pal.main}">`
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
   * changent, par le CSS : papier dans la modale, encre sous le curseur. La
   * ligne de chiffres est facultative : le menu de production les affiche déjà
   * dans sa grille d'étiquettes, on ne les dit pas deux fois.
   *
   * **Deux niveaux de détail, un seul texte.** `essentiel` ne garde que ce qui
   * décide d'un achat ou d'un ordre — ce qu'elle démolit, ce qui la démolit, sa
   * cale, ce qu'elle brûle — ; `complet` ajoute la note de référence, les
   * paliers d'abri, les terrains et les météos. C'est un niveau de détail, pas
   * une seconde fiche : dupliquer ce balisage serait la faute que ce fichier
   * évite depuis le premier jour.
   */
  function blocFiche(
    v: VueJeu, cle: CleUnite,
    options: { chiffres?: boolean; niveau?: 'essentiel' | 'complet'; enJeu?: Unite } = {},
  ): string {
    const { chiffres: avecChiffres = true, niveau = 'complet', enJeu } = options;
    const complet = niveau === 'complet';
    // Avec l'unité en jeu, la fiche dit ce qu'elle frappe **aujourd'hui** — à
    // zéro munition, sa mitrailleuse — et ce qu'elle brûle vraiment par tour.
    const f = ficheUnite(v.catalogue, cle, enJeu);
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
      return vignette(t.silhouette, adversaire, taille);
    };
    // Un duel tiré à l'arme secondaire porte une pastille « ∞ » : il ne coûte
    // aucune munition et reste possible le chargeur vide.
    const sansMunitions = api.t('fiche.sans_munitions');
    const duels = (l: readonly Duel[]): string => l.map((d) =>
      `<span class="duel" title="${ech(d.sansMunitions ? `${nomDe(d.unite)} · ${sansMunitions}` : nomDe(d.unite))}">${figurine(d.unite, 34)}`
      + (d.sansMunitions ? `<em class="sans" role="img" aria-label="${ech(sansMunitions)}">∞</em>` : '')
      + `<i>${ech(api.t('fiche.degats', { n: d.degats }))}</i>`
      + `<small>${ech(nomDe(d.unite))}</small></span>`).join('');
    // « Avance vite sur » et « Ne franchit pas » **montrent** les terrains, comme
    // la table de dégâts montre des figurines : une liste de sept noms se lit
    // mot à mot, une rangée de tuiles se lit d'un coup.
    const terrains = (l: readonly CleTerrain[]): string => l
      .map((t) => `<span class="puce tuilee">${vignetteTerrain(v, t)}${ech(nomT(t))}</span>`).join('');
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

    const chiffres = !avecChiffres ? '' : `<p class="chiffres">`
      + stat('mouvement', f.mouvement, api.t('hud.mouvement', { n: f.mouvement }))
      + stat('vue', f.vision, api.t('hud.vision', { n: f.vision }))
      + stat('portee', portee, api.t('hud.portee', { n: portee }))
      + stat('munitions', munitions, f.munitions === null ? api.t('fiche.munitions_illimitees') : api.t('hud.munitions', { n: f.munitions }))
      + `</p>`;

    // Ce que l'unité brûle par tour, immobile — et ce que lui coûterait la
    // furtivité, si elle en est capable : un chasseur brûle cinq, huit caché.
    const conso = (cleTexte: string, n: number): string => `<p class="conso" data-conso="${n}">${iconeOrdre('carburant')}`
      + `<span>${ech(api.t(cleTexte, { n: nombreIntl(v.locale, n) }))}</span></p>`;
    const consommation = (f.consommationParTour > 0 ? conso('fiche.par_tour', f.consommationParTour) : '')
      + (f.consommationFurtive !== null && f.consommationFurtive !== f.consommationParTour
        ? conso('fiche.par_tour_furtif', f.consommationFurtive)
        : '');

    // La cale d'un transport : combien de places, qui y monte, et si elle
    // refait le plein de ce qu'elle porte. Sans ce bloc, acheter une barge se
    // faisait sans savoir ce qu'elle emporte.
    const cale = f.transport === null
      ? ''
      : `<section class="bloc cale"><h4><span>${ech(api.t('fiche.transport'))}</span></h4><div class="corps">`
        + `<span class="puce places" data-places="${f.transport.places}">${ech(api.t('fiche.places', { n: f.transport.places }))}</span>`
        + f.transport.accepte.map((c) => `<span class="puce">${ech(nomDe(c))}</span>`).join('')
        + `</div>`
        + (f.transport.ravitaille ? `<p class="avert bon">${ech(api.t('fiche.ravitaille_cale'))}</p>` : '')
        + `</section>`;

    // Les deux règles que la table de dégâts ne dit pas, et qui expliquent à
    // elles seules qu'un échange entre deux unités identiques ne rende pas deux
    // fois le même chiffre. Aucun coefficient n'est écrit ici : les chiffres
    // sont au moteur, la fiche dit seulement **dans quelles conditions** ceux
    // qu'elle affiche valent.
    const reference = `<p class="note reference">${ech(api.t('fiche.degats_reference'))}</p>`
      + (f.blessee ? `<p class="avert">${ech(api.t('fiche.blessee', { n: f.pv ?? 0 }))}</p>` : '');

    // Ce que le terrain fait à sa défense, par palier d'étoiles — du plus
    // couvert au découvert. On ne cite que les cases où elle peut se tenir.
    const abris = f.abris.length === 0 ? '' : `<section class="bloc abris">`
      + `<h4><span>${ech(api.t('fiche.abris'))}</span></h4><div class="corps">`
      + f.abris.map((a) => `<span class="abri" data-defense="${a.etoiles}">`
        + `<em class="etoiles" aria-label="${ech(api.t('hud.defense', { n: a.etoiles }))}">${etoilesDefense(a.etoiles)}</em>`
        + partTerrain(a.facteur)
        + `<span>${ech(a.terrains.map(nomT).join(' · '))}</span></span>`).join('')
      + `</div></section>`;

    // Le long : ce qui explique un chiffre plutôt que ce qui le donne. Un joueur
    // qui recrute n'a pas besoin des paliers d'abri sous les yeux ; celui qui
    // lit une unité en jeu, si.
    const long = !complet ? '' : reference
      + abris
      + `<div class="deux">`
      + bloc('fiche.rapide', terrains(f.terrainsRapides))
      + (f.terrainsInterdits.length > 0
        ? bloc('fiche.interdit', terrains(f.terrainsInterdits))
        : `<section class="bloc"><h4><span>${ech(api.t('fiche.interdit'))}</span></h4>${note('fiche.partout')}</section>`)
      + `</div>`
      + meteo;

    return `<div class="fiche">`
      + chiffres
      + consommation
      + (f.indirecte ? `<p class="avert">${ech(api.t('fiche.indirecte'))}</p>` : '')
      + (porte(type, 'capture') ? `<p class="avert bon">${ech(api.t('fiche.capture'))}</p>` : '')
      + cale
      + bloc('fiche.forte', duels(f.forte), 'fort')
      + bloc('fiche.craint', duels(f.craint), 'danger')
      + long
      + `</div>`;
  }

  /** Les fonds du camp qui joue — le menu ne s'ouvre qu'à son tour. */
  function fondsCourants(v: VueJeu): number {
    return v.etat.camps.find((c) => c.id === v.etat.campCourant)?.fonds ?? 0;
  }

  /** Une portée de tir en clair : « 1 », ou « 2 à 3 ». */
  function portee([min, max]: readonly [number, number]): string {
    return min === max ? String(max) : api.t('fiche.portee_plage', { min, max });
  }

  /**
   * L'unité dont la fiche est ouverte. À l'ouverture d'un bâtiment — ou si la
   * liste a changé sous nos pieds —, on repart de la première abordable.
   */
  function uniteEnAvant(v: VueJeu, p: NonNullable<VueJeu['production']>): CleUnite | null {
    const cle = `${p.batiment.x},${p.batiment.y}`;
    if (productionOuverte !== cle || !uniteMiseEnAvant || !p.unites.includes(uniteMiseEnAvant)) {
      productionOuverte = cle;
      uniteMiseEnAvant = premiereAbordable(
        v.catalogue, ordreProduction(v.catalogue, p.unites), fondsCourants(v),
      );
    }
    return uniteMiseEnAvant;
  }

  /**
   * Ce que le panneau dit de l'unité mise en avant, et le bouton qui l'achète.
   *
   * La grille dit déjà le nom, la silhouette et le prix : la fiche n'a plus à
   * les répéter en en-tête. Restent les chiffres, les traits, et le corps de
   * fiche **partagé** avec le panneau d'inspection (`blocFiche`) — ce sont les
   * mêmes questions, il serait absurde qu'elles reçoivent deux réponses.
   *
   * Trois corrections, toutes sur le même reproche — « moche et pas très
   * intuitif ».
   *
   * **Les chiffres étaient une liste de définitions.** Un `<dl>` de cinq
   * entrées en colonnes de 112 px, avec son titre en capitales au-dessus de
   * chaque valeur : une fiche technique de site marchand posée au milieu d'un
   * jeu. Ce sont cinq plaques, signe et chiffre, comme partout ailleurs.
   *
   * **La fiche longue est repliée.** Le panneau posait la grille, cinq chiffres,
   * les traits, ce qu'elle démolit, ce qui la démolit, la note de référence, les
   * paliers d'abri, deux listes de terrains et deux de météo — sept cents pixels
   * ancrés à côté d'un bâtiment, avec trois zones de défilement imbriquées. On
   * garde ce qui décide d'un achat ; le reste se demande d'un bouton, et c'est
   * le **même** balisage (`blocFiche`, niveau `complet`).
   *
   * **Et le pied dit ce qui reste après l'achat.** « Fonds insuffisants »
   * n'apparaissait que trop tard, quand le bouton était déjà éteint ; le solde
   * d'après est ce qu'on veut savoir avant de cliquer, et c'est ce qui décide
   * si l'on recrute une infanterie de plus ou si l'on épargne pour un char.
   */
  function ficheProduction(v: VueJeu, cle: CleUnite): string {
    const type = v.catalogue.unites[cle];
    if (!type) return '';
    const fonds = fondsCourants(v);
    const abordable = type.cout <= fonds;
    const illimite = api.t('fiche.illimite');
    // Le signe, puis le chiffre — la grammaire de la fiche, ici aussi. Le type de
    // mouvement reste un mot : « chenilles » n'a pas de glyphe qui ne mente pas.
    const stats: [string, string, string][] = [
      ['mouvement', `${nombreIntl(v.locale, type.mouvement)} · ${libelleMouvement(api.t, type.typeMouvement)}`, api.t('fiche.mouvement')],
      ['vue', nombreIntl(v.locale, type.vision), api.t('fiche.vision')],
      ['portee', portee(type.portee), api.t('fiche.portee')],
      ['munitions', type.munitions === null ? illimite : nombreIntl(v.locale, type.munitions), api.t('fiche.munitions')],
      ['carburant', type.carburant === null ? illimite : nombreIntl(v.locale, type.carburant.max), api.t('fiche.carburant')],
    ];
    const cartouche = stats.map(([icone, valeur, titre]) =>
      `<span title="${ech(titre)}" aria-label="${ech(`${titre} : ${valeur}`)}">${iconeOrdre(icone)}<b>${ech(valeur)}</b></span>`).join('');
    const traits = type.traits.length > 0
      ? type.traits.map((tr) => `<span>${ech(libelleTrait(api.t, tr))}</span>`).join('')
      : `<span class="vide">${ech(api.t('fiche.sans_trait'))}</span>`;
    const cout = nombreIntl(v.locale, type.cout);
    const aide = api.t('fiche.detail');
    // Ce qui resterait après l'achat, ou ce qui manque pour le faire.
    const note = abordable
      ? `<span class="note">${ech(api.t('fiche.solde_apres', { n: nombreIntl(v.locale, fonds - type.cout) }))}</span>`
      : `<span class="note" data-manque="oui">${ech(api.t('fiche.fonds_insuffisants'))}</span>`;
    return `<div class="panneau-fiche" role="group" aria-label="${ech(api.t('fiche.titre'))}"><div class="fiche-corps">`
      + `<p class="cartouche">${cartouche}</p>`
      + `<div class="fiche-traits">${traits}</div>`
      + blocFiche(v, cle, { chiffres: false, niveau: ficheProductionOuverte ? 'complet' : 'essentiel' })
      // Le bouton de repli vit **hors** de la zone qui défile : dépliée, la fiche
      // est longue, et il faudrait la parcourir en entier pour retrouver de quoi
      // la refermer. C'est la même règle que le bouton d'achat.
      + `</div><button type="button" class="plier" data-action="fiche_production"`
      + ` aria-expanded="${ficheProductionOuverte}">${ech(aide)}${iconeOrdre('replier')}</button>`
      + `<div class="fiche-action">${note}`
      + `<button type="button" class="recruter" data-action="produire" data-valeur="${ech(cle)}"${abordable ? '' : ' disabled'}>`
      + `${ech(api.t('fiche.recruter'))}<span aria-hidden="true">·</span><span>${ech(cout)}</span></button></div></div>`;
  }

  /** Largeur du panneau de production, ancré au bâtiment. */
  const LARGEUR_PRODUCTION = 400;

  /**
   * Le menu de production : un **panneau posé à côté du bâtiment**, plus une
   * modale.
   *
   * C'était une fenêtre de 760 px centrée sur un voile qui noircissait tout le
   * plateau, avec une liste de lignes de texte à gauche et une fiche technique à
   * droite — « moche et pas très intuitif », et c'est juste : on recrute six à
   * dix fois par match, et à chaque fois le jeu disparaissait derrière une boîte
   * de dialogue pour un achat de deux clics.
   *
   * Trois changements. Il s'**ancre à la case** du bâtiment, par le mécanisme
   * qui sert déjà au menu d'ordres — la règle du HUD est de ne jamais couvrir la
   * case sur laquelle on joue, et un bâtiment est une case comme une autre. Le
   * voile s'éclaircit : il ne sert plus qu'à recevoir le clic qui referme, le
   * plateau reste lisible derrière. Et la liste devient une **grille de
   * figurines** avec le prix sous chacune : on achète une silhouette, pas une
   * ligne de tableau.
   *
   * Les deux temps restent — mettre en avant, puis produire. C'est la grammaire
   * du genre, et surtout un achat qui part au premier clic est un achat qu'on
   * regrette.
   */
  function panneauProduction(v: VueJeu): string {
    const p = v.production;
    if (!p) return '';
    const fonds = fondsCourants(v);
    const enAvant = uniteEnAvant(v, p);
    const cases = ordreProduction(v.catalogue, p.unites).map((cle) => {
      const type = v.catalogue.unites[cle];
      if (!type) return '';
      const abordable = type.cout <= fonds;
      const actif = cle === enAvant;
      // Le nom est tronqué dans une case de cent pixels : le `title` le rend, et
      // le nom accessible porte en plus le prix, qui est ce qu'on achète.
      const nom = nomUnite(v.locale, v.catalogue, cle);
      const prix = nombreIntl(v.locale, type.cout);
      return `<button type="button" data-action="mettre_en_avant" data-valeur="${ech(cle)}"`
        + ` data-actif="${actif ? 'oui' : 'non'}" data-abordable="${abordable ? 'oui' : 'non'}" aria-pressed="${actif ? 'true' : 'false'}"`
        + ` title="${ech(nom)}" aria-label="${ech(`${nom} · ${prix}`)}">`
        + `${vignette(type.silhouette, v.etat.campCourant, 40)}`
        + `<span class="tt">${ech(nom)}</span>`
        + `<span class="cout">${ech(prix)}</span></button>`;
    }).join('');
    const solde = api.t('hud.fonds', { n: nombreIntl(v.locale, fonds) });
    // Hauteur estimée : elle sert à centrer le panneau sur la case du bâtiment.
    // Fiche repliée, le panneau fait à peu près la moitié de ce qu'il faisait —
    // et c'était précisément le reproche.
    const hauteur = ficheProductionOuverte ? 460 : 320;
    return `<div class="voile clair" data-action="fermer">`
      + `<div class="p production"${ancrer(p.batiment, hauteur, LARGEUR_PRODUCTION)} data-arret="1" tabindex="-1"`
      + ` role="dialog" aria-label="${ech(api.t('menu.production'))}">`
      + `<div class="production-entete"><span class="tt">${ech(api.t('menu.production'))}</span>`
      + `<span class="solde" aria-label="${ech(solde)}">${iconeOrdre('fonds')}${ech(nombreIntl(v.locale, fonds))}</span>`
      + `${boutonRetour()}</div>`
      + `<div class="production-grille" role="group" aria-label="${ech(api.t('fiche.liste'))}">${cases}</div>`
      + (enAvant ? ficheProduction(v, enAvant) : '')
      + `</div></div>`;
  }

  /**
   * L'écran de fin, et son **bilan**.
   *
   * C'étaient un titre, une journée et un bouton : rien de ce que le match
   * venait de produire, alors que tout est dans l'état. Trois lignes, les deux
   * camps côte à côte, chaque colonne peinte de la couleur de son armée et
   * titrée du nom de son commandant : ce qui reste en jeu, ce qu'on tient, ce
   * qu'on a payé pendant la partie. Rien n'est calculé ici que des comptes —
   * la règle, elle, reste au moteur.
   *
   * Le **motif** de fin (`etat.partie.motif`) n'est pas dit : c'est le
   * vocabulaire du moteur (`objectif_relais`, `limite_journees`…), il demanderait
   * dix chaînes d'interface pour une phrase que le titre résume déjà.
   */
  function ecranFin(v: VueJeu): string {
    const fin = v.etat.partie;
    // Une fin se rend **une fois**, après le dernier mot du commandant : ni
    // pendant la scène, ni dans l'intervalle où elle attend d'être enfilée.
    if (!fin.terminee || v.masquerFin || v.sceneOuverte || v.finEnAttente) return '';
    const cle = fin.nul ? 'hud.match_nul'
      : fin.vainqueur === v.camp ? 'combat.manche_gagnee' : 'combat.manche_perdue';
    const pal = paletteDe(fin.vainqueur ?? null);
    const titre = api.t(cle);
    // Mon camp d'abord : on lit son propre bilan avant celui d'en face.
    const camps = [...v.etat.camps].sort((a, b) => (a.id === v.camp ? -1 : b.id === v.camp ? 1 : 0));
    const enJeu = (camp: CampId): number => v.etat.unites.filter((u) => u.camp === camp).length;
    const batiments = (camp: CampId): number => Object.values(v.etat.proprietaires).filter((c) => c === camp).length;
    // `produites` est indexé « camp:unite » (`regles/economie.ts`) : on somme le
    // préfixe plutôt que de tenir un second compte qui finirait par diverger.
    const recrutees = (camp: CampId): number => Object.entries(v.etat.produites)
      .reduce((n, [k, x]) => (k.startsWith(`${camp}:`) ? n + x : n), 0);
    const teinte = (camp: CampId): string => paletteDe(camp).main;
    const ligne = (cleTexte: string, valeur: (c: CampId) => number): string =>
      `<div class="bilan-ligne"><span class="quoi">${ech(api.t(cleTexte))}</span>`
      + camps.map((c) => `<b style="--teinte:${teinte(c.id)}">${ech(nombreIntl(v.locale, valeur(c.id)))}</b>`).join('')
      + `</div>`;
    const tete = `<div class="bilan-ligne bilan-tete"><span class="quoi"></span>`
      + camps.map((c) => `<span class="chef" style="--teinte:${teinte(c.id)}">`
        + `${ech(nomCommandant(v.locale, c.commandantCle))}</span>`).join('')
      + `</div>`;
    return `<div class="voile"><div class="modale" style="width:390px;--camp:${pal.main}"`
      + ` role="dialog" aria-label="${ech(titre)}"><div class="fin">`
      + `<div class="grand">${ech(titre)}</div>`
      + `<div class="sb" style="margin-top:6px">${ech(api.t('hud.journee', { n: Math.max(1, v.etat.journee) }))}</div>`
      + `</div><div class="bilan">${tete}`
      + ligne('hud.bilan_unites', enJeu)
      + ligne('hud.bilan_batiments', batiments)
      + ligne('hud.bilan_recrutees', recrutees)
      + `</div><div class="pied">`
      + `<button type="button" data-action="rejouer">${iconeOrdre('fin_de_tour')}${ech(api.t('hud.rejouer'))}</button>`
      + `</div></div></div>`;
  }

  // -------------------------------------------------------------------------
  // Rendu et interaction
  // -------------------------------------------------------------------------

  /** Peint les vignettes des emplacements réécrits : les autres sont déjà peintes. */
  function peindreVignettes(reecrits: ReadonlySet<string>): void {
    for (const vg of vignettes) {
      if (!reecrits.has(vg.emplacement)) continue;
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
    racine.dataset['ordres'] = v.menu ? 'oui' : 'non';
    racine.dataset['scene'] = v.sceneOuverte ? 'ouverte' : 'fermee';
    // **Le HUD prend la couleur de l'armée en main.** C'est la grammaire
    // d'Advance Wars — la fenêtre est bleue quand le bleu joue —, et le HUD n'en
    // avait qu'un filet de 3 px : les deux personas ont fait le même reproche.
    // La couleur est posée sur la racine, une fois, et chaque panneau en hérite ;
    // celui qui parle d'une unité précise la remplace par celle de son camp.
    // Ce sont deux propriétés de style, pas du HTML : aucun emplacement n'est
    // réécrit pour un changement de tour.
    const palTour = paletteDe(v.etat.campCourant);
    racine.style.setProperty('--camp', palTour.main);
    racine.style.setProperty('--camp-voile', `${palTour.main}24`);
    const selectionNeuve = v.selection !== derniereSelection;
    racine.dataset['selectionNouvelle'] = selectionNeuve ? 'oui' : 'non';
    // **Cliquer une unité ouvre son détail**, quand elle est seule sur sa case.
    // Le bouton « i » existait, mais il fallait le trouver et l'atteindre : sur
    // une unité qui ne porte rien, il n'y a rien à choisir et rien à cacher.
    // Réservé à la colonne : sur un téléphone, la fiche dépliée mange la moitié
    // de l'écran et couvre le plateau qu'on est en train de lire.
    if (selectionNeuve && largeurRail > 0) {
      const choisie = v.selection ? uniteParId(v.etat, v.selection) : null;
      // « Tout seul » : rien à bord. Un transport plein pose la question de
      // savoir de qui l'on parle, et on n'y répond pas à sa place — sa fiche
      // reste à demander. La règle est **déterministe** : le détail suit la
      // sélection, il ne garde pas l'état de l'unité d'avant, sans quoi le même
      // clic donnerait deux écrans différents selon ce qu'on regardait avant.
      ficheInspection = choisie !== null && choisie !== undefined && choisie.cargo.length === 0;
    }
    derniereSelection = v.selection;
    // Le duel se calcule **une fois** : il pousse des vignettes, et deux appels
    // en réclameraient deux fois plus qu'il n'y a de canvas à peindre.
    const actif = doc.activeElement;
    const focusAvant = actif instanceof HTMLElement && racine.contains(actif) ? actif.dataset : null;
    // Chaque panneau se compose dans son emplacement ; l'ordre est celui du DOM,
    // et le duel vient avant l'inspection, qui s'efface devant lui.
    const html = new Map<Emplacement, string>();
    const composer = (nom: Emplacement, contenu: () => string): void => {
      emplacementCourant = nom;
      html.set(nom, contenu());
    };
    composer('partie', () => panneauPartie(v));
    composer('bulletin', () => panneauBulletin(v));
    composer('dock', () => `<div class="dock">${panneauJauge(v)}${panneauFinTour(v)}</div>`);
    composer('duel', () => panneauDuel(v));
    const duelOuvert = (html.get('duel') ?? '') !== '';
    // Sur l'image, le menu d'ordres et la prévision prennent le coin du panneau
    // d'unité ; dans la colonne, chacun a le sien et rien ne s'efface.
    const effaceInspection = largeurRail === 0 && (v.menu !== null || duelOuvert);
    composer('inspection', () => panneauInspection(v, effaceInspection));
    composer('ordres', () => panneauOrdres(v));
    composer('camera', () => panneauCamera());
    composer('attente', () => panneauAttente(v));
    composer('annonce', () => panneauAnnonce(v));
    composer('production', () => panneauProduction(v));
    composer('fin', () => ecranFin(v));
    const reecrits = new Set(poserEmplacements(emplacements, htmlPose, html));
    peindreVignettes(reecrits);
    // Le focus ne meurt qu'avec la modale : tant qu'elle n'est pas réécrite,
    // il est toujours là où le joueur l'a mis.
    if (reecrits.has('production')) replacerFocus(v, focusAvant);
  }

  /**
   * La modale de production se reconstruit à chaque rafraîchissement, et le
   * focus meurt avec elle. On le remet là où il était — sur le même bouton —,
   * sinon sur la modale elle-même : c'est ce qui fait qu'Entrée, Espace et Échap
   * lui parviennent au lieu d'aller au plateau. Dans la liste, le focus suit la
   * ligne mise en avant, pour que les flèches et la fiche disent la même chose.
   * À la fermeture, le clavier revient au plateau.
   */
  function replacerFocus(v: VueJeu, avant: DOMStringMap | null): void {
    if (v.production) {
      const modale = racine.querySelector<HTMLElement>('.p.production');
      let cible: HTMLElement | null = null;
      if (avant?.['action'] === 'mettre_en_avant') {
        cible = racine.querySelector<HTMLElement>('.production-grille button[data-actif="oui"]');
      } else if (avant?.['action']) {
        const valeur = avant['valeur'] ? `[data-valeur="${avant['valeur']}"]` : '';
        cible = racine.querySelector<HTMLElement>(`.p.production [data-action="${avant['action']}"]${valeur}`);
      }
      (cible ?? modale)?.focus({ preventScroll: true });
      racine.querySelector('.production-grille button[data-actif="oui"]')?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (productionOuverte !== null) {
      productionOuverte = null;
      uniteMiseEnAvant = null;
      conteneur.querySelector<HTMLElement>('canvas[tabindex]')?.focus({ preventScroll: true });
    }
  }

  function surClic(e: Event): void {
    const cible = e.target;
    if (!(cible instanceof Element)) return;
    const bouton = cible.closest('[data-action]');
    if (!(bouton instanceof HTMLElement)) return;
    if (bouton.hasAttribute('disabled')) return;
    // Un clic dans la modale ne la ferme pas : seul le voile lui-même ferme.
    if (bouton.classList.contains('voile') && cible.closest('[data-arret]')) return;
    e.preventDefault();
    e.stopPropagation();
    const valeur = bouton.dataset['valeur'] ?? '';
    switch (bouton.dataset['action']) {
      case 'fin_tour': api.finTour(); break;
      case 'suite': api.choisirSuite(valeur, bouton.dataset['passager']); break;
      case 'produire': api.choisirProduction(valeur); break;
      // Changer l'unité mise en avant ne touche à rien du jeu : on redessine, c'est tout.
      case 'mettre_en_avant': uniteMiseEnAvant = valeur; rafraichir(); break;
      // Déplier la fiche sous le curseur ne touche à rien du jeu non plus.
      case 'fiche': ficheInspection = !ficheInspection; rafraichir(); break;
      case 'fiche_production': ficheProductionOuverte = !ficheProductionOuverte; rafraichir(); break;
      case 'pouvoir_info': pouvoirDetail = !pouvoirDetail; rafraichir(); break;
      case 'pouvoir': api.jouerPouvoir('normal'); break;
      case 'pouvoir_super': api.jouerPouvoir('super'); break;
      case 'fermer': api.annuler(); break;
      case 'rejouer': api.recommencer(); break;
      case 'zoom_plus': api.zoomer?.(1); break;
      case 'zoom_moins': api.zoomer?.(-1); break;
      case 'tourner_gauche': api.tourner?.(-1); break;
      case 'tourner_droite': api.tourner?.(1); break;
      case 'recentrer': api.recentrer?.(); break;
      case 'unite_suivante': api.uniteSuivante?.(); break;
      default: break;
    }
  }

  /** Recrute l'unité mise en avant, si les fonds le permettent. */
  function recruter(v: VueJeu): void {
    const cle = uniteMiseEnAvant;
    const type = cle ? v.catalogue.unites[cle] : undefined;
    if (!cle || !type || type.cout > fondsCourants(v)) return;
    api.choisirProduction(cle);
  }

  /**
   * Le clavier dans le menu de production : Entrée et Espace recrutent, Échap
   * ferme, les flèches parcourent la liste. Sur un bouton, Entrée et Espace
   * valent déjà un clic pour le navigateur — on ne double pas.
   */
  function surTouche(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const v = api.vue();
    const p = v.production;
    if (!p) return;
    switch (e.code) {
      case 'Escape':
        e.preventDefault(); e.stopPropagation();
        api.annuler();
        return;
      case 'Enter': case 'NumpadEnter': case 'Space':
        if (e.target instanceof Element && e.target.closest('[data-action]')) return;
        e.preventDefault(); e.stopPropagation();
        recruter(v);
        return;
      // Les quatre flèches, depuis que la liste est une **grille** : un joueur qui
      // voit des vignettes côte à côte appuie sur droite, pas sur bas. Le
      // parcours reste celui du catalogue — le nombre de colonnes dépend de la
      // largeur mesurée, et le HUD ne mesure rien pour se déplacer dans une liste.
      case 'ArrowUp': case 'ArrowLeft': case 'ArrowDown': case 'ArrowRight': {
        e.preventDefault(); e.stopPropagation();
        // Le même ordre que la grille, sans quoi la flèche « droite » sauterait
        // ailleurs qu'à la case de droite.
        const liste = ordreProduction(v.catalogue, p.unites);
        const n = liste.length;
        const avance = e.code === 'ArrowDown' || e.code === 'ArrowRight';
        const i = uniteMiseEnAvant ? liste.indexOf(uniteMiseEnAvant) : -1;
        const suivant = i < 0 ? liste[0] : liste[(i + (avance ? 1 : n - 1)) % n];
        if (suivant && suivant !== uniteMiseEnAvant) { uniteMiseEnAvant = suivant; rafraichir(); }
        return;
      }
      default: return;
    }
  }

  racine.addEventListener('click', surClic);
  // Entrer sur un panneau du HUD, c'est venir chercher une commande : le
  // panneau d'inspection cesse alors de suivre le curseur de jeu, sans quoi le
  // bouton qu'on vise disparaît sous le doigt qui l'approche.
  const surPointeur = (e: Event): void => {
    const sur = (e.target as Element | null)?.closest?.('.atlas-hud .p, .atlas-hud .hud-rail') != null;
    if (sur === pointeurSurHud) return;
    pointeurSurHud = sur;
    rafraichir();
  };
  // L'écoute est posée sur le **conteneur**, qui porte la toile et le HUD : la
  // racine du HUD couvre tout l'écran, donc son `pointerleave` ne part jamais et
  // le drapeau resterait vrai pour toujours.
  conteneur.addEventListener('pointerover', surPointeur);
  racine.addEventListener('keydown', surTouche);
  rafraichir();

  return {
    rafraichir,
    jouer: (partition) => scenes.jouer(partition),
    couper: () => scenes.couper(),
    demonter: () => {
      scenes.demonter();
      observateurRail?.disconnect();
      // Le conteneur est rendu tel qu'il a été reçu : la marge de la colonne
      // vient de ces attributs, un HUD démonté ne doit pas laisser un bord
      // vide à la page qui l'hébergeait.
      delete conteneur.dataset['atlasHote'];
      delete conteneur.dataset['atlasRail'];
      if (minuterieTour) clearTimeout(minuterieTour);
      if (graceInspection) clearTimeout(graceInspection);
      banniereTour?.remove();
      racine.removeEventListener('click', surClic);
      conteneur.removeEventListener('pointerover', surPointeur);
      racine.removeEventListener('keydown', surTouche);
      racine.remove();
    },
  };
}
