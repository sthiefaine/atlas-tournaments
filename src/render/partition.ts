/**
 * La **partition** : ce que le réalisateur écrit, ce que les exécutants jouent.
 *
 * Le moteur émet des événements ; le réalisateur (`ecrirePartition`, pur, sans
 * three.js ni DOM) les traduit en **gestes datés** — qui bouge, d'où, vers où, à
 * partir de quand, pendant combien de temps — exprimés en cases et en
 * millisecondes. Deux exécutants la lisent sans se connaître : la peau 3D
 * (`Rendu.jouer`) pour les figurines, les effets et la caméra ; le HUD pour ce
 * qui se lit à l'écran (chiffres de dégâts, splash de pouvoir).
 *
 * Trois règles, héritées de `doc/10` §7.3 et §11 :
 *
 * - l'état logique est déjà en avance, la partition **rattrape** : elle ne
 *   décide de rien, elle raconte ce qui vient d'arriver ;
 * - **une unité ne fait qu'un geste à la fois** : ses gestes s'enchaînent dans
 *   l'ordre des événements (la figurine ne tire pas en marchant) ;
 * - un clic **coupe** la partition : tout saute à l'état final. On ne bloque
 *   jamais le joueur derrière un effet.
 *
 * Sous « animations réduites », toutes les durées valent 0 : la partition
 * existe encore (les exécutants posent l'état final d'un coup), mais elle ne
 * dure pas.
 */

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { cleCase, pvAffiches, uniteParId } from '../engine/index';
import type { CleTerrain, CleUnite, CampId, Case } from '../schemas/types';
import { cheminEnL, longueurChemin } from './chemin';

/** Les durées de référence des gestes, en millisecondes. */
export const DUREES = Object.freeze({
  /** Par case traversée en glissant. */
  parCase: 120,
  tir: 260,
  encaisser: 300,
  sortir: 420,
  /** Capture acquise : amener l'ancien drapeau, hisser le nouveau. */
  hisser: 1100,
  /** Capture qui avance sans aboutir : le fanion monte d'un cran. */
  hisserUnCran: 460,
  /** Palissade qui tombe : la remise en service. */
  remettre: 1200,
  /** Une mutation de terrain : construction, retrait, effet de pouvoir. */
  batir: 1400,
  /** Une unité produite se pose sur son bâtiment. */
  apparaitre: 520,
  /** Monter dans un transport ou en descendre. */
  embarquer: 360,
  fusionner: 420,
  ravitailler: 600,
  reparer: 600,
  repousser: 320,
  /** Le splash de pouvoir : bandes, buste, nom, éclat, avant les effets. */
  pouvoir: 2000,
  /**
   * L'écran de combat : les deux unités face à face, jauges qui tombent,
   * chiffres. Par-dessus la carte, jamais à sa place ; coupable d'un clic.
   */
  duel: 1900,
  /** Un chiffre flottant : monte et s'efface. */
  chiffre: 900,
  /**
   * Se cacher ou se montrer (trait `furtif`) : le voile qui tombe sur la
   * figurine, ou qui s'en lève. Assez lent pour qu'on voie la pièce s'effacer
   * plutôt que disparaître d'un coup.
   */
  voiler: 480,
  /**
   * Le « ! » d'embuscade (`04-gameplay.md` §2, ordre en deux temps) : la marche
   * s'est arrêtée net sur une unité cachée. Bref — un signe, pas une scène.
   */
  surprise: 700,
  /**
   * La réactivation (`reactiver`, super pouvoir, 10 septembre 2026) : une unité
   * qui avait joué reprend la main. Un éclat bref sur elle — elle ne bouge pas,
   * elle se réveille.
   */
  reveiller: 520,
  /**
   * Une frappe de zone (`frappe_zone`, famille de la faction) : les missiles
   * tombent sur chaque case du rayon, l'une après l'autre ; les unités touchées
   * encaissent à la fin, ensemble.
   */
  frapper: 900,
  /**
   * Un rayon (`rayon_laser`) : un trait qui descend du ciel sur l'unité
   * désignée, puis elle encaisse. Bref — le rayon marque, il ne bombarde pas.
   */
  designer: 520,
  /**
   * Une impulsion (`iem_pouvoir`) : un anneau qui se referme sur le rayon de
   * l'impulsion, du bord vers le centre. Ce qui a un moteur s'arrête quand il
   * s'est refermé ; ce qui vole tombe après.
   */
  sceller: 800,
});

/**
 * Un geste : une chose qui se joue, datée depuis le début de la partition.
 * `debut` et `duree` sont en millisecondes ; toute position est une case.
 */
export type Geste =
  | { genre: 'glisser'; unite: string; chemin: readonly Case[]; debut: number; duree: number }
  | { genre: 'tirer'; unite: string; depuis: Case; vers: Case; debut: number; duree: number }
  | { genre: 'encaisser'; unite: string; case: Case; degats: number; depuis: Case; debut: number; duree: number }
  | { genre: 'sortir'; unite: string; case: Case; debut: number; duree: number }
  | { genre: 'hisser'; unite: string; case: Case; camp: CampId; points: number; acquis: boolean; debut: number; duree: number }
  | { genre: 'remettre'; unite: string; case: Case; camp: CampId; debut: number; duree: number }
  | { genre: 'batir'; case: Case; terrain: CleTerrain | null; debut: number; duree: number }
  | { genre: 'apparaitre'; unite: CleUnite; case: Case; camp: CampId; debut: number; duree: number }
  | { genre: 'embarquer'; unite: string; transport: string; de: Case; vers: Case; debut: number; duree: number }
  | { genre: 'debarquer'; unite: string; transport: string; de: Case; vers: Case; debut: number; duree: number }
  | { genre: 'fusionner'; unite: string; avec: string; de: Case; vers: Case; debut: number; duree: number }
  | { genre: 'ravitailler'; unite: string; cible: string; case: Case; debut: number; duree: number }
  | { genre: 'reparer'; unite: string; case: Case; pv: number; debut: number; duree: number }
  | { genre: 'repousser'; unite: string; de: Case; vers: Case; debut: number; duree: number }
  | { genre: 'pouvoir'; camp: CampId; niveau: 'normal' | 'super'; nom: string; debut: number; duree: number }
  /**
   * L'écran de combat, lu par le HUD : un duel résumé — qui tire sur qui, d'où,
   * les PV affichés avant et après de chaque côté (`pvAvant`/`pvApres` en
   * dixièmes, 0-10), le camp de chacun. Émis pour chaque `attaque` quand le
   * joueur a laissé l'écran de combat allumé (`Preferences.ecranCombat`).
   */
  | {
    genre: 'duel';
    attaquant: { unite: string; type: CleUnite; camp: CampId; case: Case; pvAvant: number; pvApres: number };
    cible: { unite: string; type: CleUnite; camp: CampId; case: Case; pvAvant: number; pvApres: number };
    riposte: boolean;
    debut: number;
    duree: number;
  }
  /** Un chiffre qui flotte au-dessus d'une case : `perte` en rouge, `gain` en vert. Lu par le HUD. */
  | { genre: 'chiffre'; case: Case; valeur: number; teinte: 'perte' | 'gain'; debut: number; duree: number }
  /** La caméra montre cette case si elle est hors champ. Instantané. */
  | { genre: 'cadrer'; case: Case; debut: number; duree: 0 }
  /**
   * L'unité se cache (trait `furtif`, catalogue 6) : le voile tombe sur elle,
   * là où elle est. Pour son camp, elle devient translucide ; pour l'adversaire
   * qui la voit encore au contact, rien ne change — elle est vue.
   */
  | { genre: 'voiler'; unite: string; case: Case; debut: number; duree: number }
  /** L'unité se montre de nouveau : le voile se lève. */
  | { genre: 'devoiler'; unite: string; case: Case; debut: number; duree: number }
  /**
   * L'embuscade : la marche s'est arrêtée sur `case` — la dernière case libre
   * du trajet — parce qu'une unité adverse cachée s'y trouvait au contact. Le
   * HUD pose un « ! » au-dessus de l'unité ; la peau peut y ajouter un sursaut.
   * Écrit juste après le `glisser` d'un `deplacement` interrompu, ou seul si
   * l'unité n'a pas fait un pas.
   */
  | { genre: 'surprise'; unite: string; case: Case; debut: number; duree: number }
  /**
   * L'unité reprend la main (`reactivation`, super pouvoir) : elle avait joué,
   * elle rejoue. Un geste sur place ; la peau peut y poser un éclat, le HUD n'a
   * rien à en dire — l'annonce compte les unités réveillées.
   */
  | { genre: 'reveiller'; unite: string; case: Case; camp: CampId; debut: number; duree: number }
  /**
   * La frappe de zone d'un super de la faction : `rayon` cases Manhattan
   * autour de `centre`, des missiles qui tombent. Les unités touchées ont
   * chacune leur `encaisser` et leur `chiffre` derrière, comme un tir.
   */
  | { genre: 'frapper'; camp: CampId; centre: Case; rayon: number; debut: number; duree: number }
  /** Le rayon de la faction désigne une unité : un trait du ciel sur elle, puis elle encaisse. */
  | { genre: 'designer'; unite: string; case: Case; camp: CampId; debut: number; duree: number }
  /**
   * L'impulsion de la faction se referme sur `rayon` cases autour de `centre`.
   * Les unités abattues ont leur `sortir` derrière — le geste de la mise hors
   * jeu, qui existe déjà ; les immobilisées ne bougent pas, c'est le point.
   */
  | { genre: 'sceller'; camp: CampId; centre: Case; rayon: number; debut: number; duree: number };

export type GenreGeste = Geste['genre'];

/** Une partition : des gestes et la durée totale, qui est la fin du dernier. */
export interface Partition {
  gestes: readonly Geste[];
  duree: number;
}

/** Ce que le réalisateur doit savoir du contexte pour écrire. */
export interface OptionsPartition {
  /** Facteur de durée de présentation ; 0,5 donne la cadence rapide. */
  facteurDuree?: number;
  /** Le camp du joueur : les chiffres se teintent par rapport à lui. */
  camp: CampId;
  /** Animations réduites : toutes les durées tombent à 0. */
  reduit: boolean;
  /** Vrai pendant le tour de l'IA : la caméra a le droit de recadrer. */
  cadrer: boolean;
  /** L'écran de combat est allumé : chaque attaque émet un geste `duel`. */
  ecranCombat: boolean;
}

/** La partition qui ne joue rien. */
export function partitionVide(): Partition {
  return { gestes: [], duree: 0 };
}

/** La fin d'une partition : le geste qui finit le plus tard. */
export function dureePartition(gestes: readonly Geste[]): number {
  let fin = 0;
  for (const g of gestes) fin = Math.max(fin, g.debut + g.duree);
  return fin;
}

/**
 * Les réglages de mise en scène qui ne sont pas des durées : où tombe le coup
 * dans l'écran de combat, à partir de quelle marche la caméra suit l'arrivée,
 * l'espacement de deux constructions d'un même pouvoir.
 */
export const MISE_EN_SCENE = Object.freeze({
  /** Part de l'écran de combat écoulée quand l'attaquant frappe. */
  partCoup: 0.35,
  /** Décalage de riposte sur la carte, avant le premier impact. */
  delaiRiposte: 80,
  /** Part de l'écran de combat écoulée quand la riposte part. */
  partRiposte: 0.35 + 80 / DUREES.duel,
  /** Deux poses de terrain d'une même salve se posent l'une après l'autre : l'écart entre deux départs. */
  ecartBatir: 120,
  /** Un glissement d'au moins tant de cases mérite un second cadrage, sur l'arrivée. */
  casesCadrageArrivee: 4,
  /** Deux unités désignées par un même rayon le sont l'une après l'autre : l'écart entre deux départs. */
  ecartDesigner: 140,
});

/**
 * Des PV internes (0-100) en **PV affichés** : des dixièmes arrondis au plus
 * proche, jamais 0 quand il y a eu quelque chose — un coup de 3 PV internes
 * se lit « −1 », pas « −0 ».
 */
export function dixiemes(pv: number): number {
  if (pv <= 0) return 0;
  return Math.max(1, Math.round(pv / 10));
}

/**
 * Le **réalisateur** : traduit la file d'événements d'une action en partition.
 *
 * `avant` est l'état d'où l'action est partie, `apres` celui où elle arrive :
 * l'un dit où chaque unité était et combien de PV elle avait, l'autre ce qu'il
 * en reste. La partition raconte le passage de l'un à l'autre, sans rien
 * décider. Pure et déterministe : même entrée, même sortie, au geste près.
 *
 * Les règles d'écriture, dans l'ordre où elles comptent :
 *
 * - **le pouvoir passe en tête**. Le moteur pousse l'événement `pouvoir` après
 *   les `terrain_pose` qu'il a provoqués ; à l'écran, le splash précède ses
 *   effets, et tout ce qui suit dans la salve part après lui ;
 * - **une unité ne fait qu'un geste à la fois** (`fins`) : le tir attend la fin
 *   de la marche, la riposte part presque avec le tir ;
 * - **une unité agit d'où elle est arrivée** (`positions`) : le tir part de la
 *   case d'arrivée, jamais de la case de départ de `avant` ;
 * - **une capture qui suit une remise en service** de la même case attend que
 *   la palissade soit tombée (`remises`) ;
 * - les **chiffres** sont teintés par rapport au joueur : `perte` quand c'est
 *   lui qui encaisse, `gain` quand c'est l'adversaire ;
 * - l'**écran de combat** (`duel`) ne s'écrit que si le joueur l'a laissé
 *   allumé ; le tir 3D et le coup encaissé se jouent alors **sous** l'écran,
 *   décalés pour que le chiffre tombe quand l'écran montre le coup ;
 * - la **caméra** ne cadre que si l'option le permet — le tour de l'IA — et
 *   jamais sur une unité du camp du joueur : on ne lui vole pas son point de vue.
 *
 * Sous `reduit`, toute durée vaut 0 et tout début aussi : la partition dit
 * encore ce qui s'est passé, elle ne dure pas.
 */
export function ecrirePartition(
  evenements: readonly EvenementJeu[], avant: EtatPartie, apres: EtatPartie, options: OptionsPartition,
): Partition {
  const gestes: Geste[] = [];
  const facteur = options.facteurDuree === 0.5 ? 0.5 : 1;
  const d = (ms: number): number => (options.reduit ? 0 : ms * facteur);

  // La fin du dernier geste de chaque unité dans la salve.
  const fins = new Map<string, number>();
  // Où chaque unité se trouve quand son geste part : `avant` ne sait pas qu'elle a bougé.
  const positions = new Map<string, Case>();
  // Les cases remises en service dans la salve, et quand la palissade a fini de tomber.
  const remises = new Map<string, number>();
  // Ce que la caméra a déjà montré : un cadrage par unité et par arrivée, pas un par geste.
  const cadrees = new Set<string>();
  // L'instant d'où part tout ce qui suit un splash de pouvoir.
  let origine = 0;
  let rangBatir = 0;

  const uniteDe = (id: string) => uniteParId(avant, id) ?? uniteParId(apres, id) ?? null;
  const caseDe = (id: string): Case | null => {
    const arrivee = positions.get(id);
    if (arrivee) return arrivee;
    const u = uniteDe(id);
    return u ? { x: u.x, y: u.y } : null;
  };
  const campDe = (id: string): CampId | null => uniteDe(id)?.camp ?? null;
  /** Le départ d'un geste : après l'origine, après une contrainte donnée, après le geste précédent de l'unité. */
  const depart = (unite: string | null, auPlusTot = 0): number =>
    Math.max(origine, auPlusTot, unite === null ? 0 : fins.get(unite) ?? 0);
  const occuper = (unite: string, debut: number, duree: number): void => {
    fins.set(unite, Math.max(fins.get(unite) ?? 0, debut + duree));
  };
  const teinteDe = (camp: CampId | null): 'perte' | 'gain' => (camp === options.camp ? 'perte' : 'gain');
  const chiffre = (c: Case, valeur: number, teinte: 'perte' | 'gain', debut: number): void => {
    if (valeur <= 0) return;
    gestes.push({ genre: 'chiffre', case: c, valeur, teinte, debut, duree: d(DUREES.chiffre) });
  };
  const cadrer = (cle: string, camp: CampId | null, c: Case, debut: number): void => {
    if (!options.cadrer || camp === options.camp || cadrees.has(cle)) return;
    cadrees.add(cle);
    gestes.push({ genre: 'cadrer', case: c, debut, duree: 0 });
  };

  // Le splash d'abord, puis les familles de la faction — le moteur pousse le
  // `hors_jeu` d'un appareil abattu **avant** l'`iem_pouvoir` qui l'abat, et
  // à l'écran l'anneau se referme avant que l'appareil tombe —, puis le reste
  // dans l'ordre du moteur.
  const faction = (e: EvenementJeu): boolean =>
    e.type === 'frappe_zone' || e.type === 'rayon_laser' || e.type === 'iem_pouvoir';
  const ordonnes = [
    ...evenements.filter((e) => e.type === 'pouvoir'),
    ...evenements.filter(faction),
    ...evenements.filter((e) => e.type !== 'pouvoir' && !faction(e)),
  ];

  for (const e of ordonnes) {
    switch (e.type) {
      case 'pouvoir': {
        const duree = d(DUREES.pouvoir);
        gestes.push({ genre: 'pouvoir', camp: e.camp, niveau: e.niveau, nom: e.nom, debut: origine, duree });
        origine += duree;
        break;
      }
      case 'deplacement': {
        // Le chemin vient du moteur : c'est celui qu'il a validé. Le L n'est
        // qu'un repli pour un événement qui n'en porterait pas.
        const chemin = e.chemin.length > 1 ? e.chemin : cheminEnL(e.de, e.vers);
        const cases = longueurChemin(chemin);
        // Même sans glissement, c'est là que l'unité est pour la suite de la salve.
        positions.set(e.uniteId, e.vers);
        const camp = campDe(e.uniteId);
        if (cases > 0) {
          const debut = depart(e.uniteId);
          const duree = d(cases * DUREES.parCase);
          cadrer(e.uniteId, camp, e.de, debut);
          gestes.push({ genre: 'glisser', unite: e.uniteId, chemin, debut, duree });
          // Une longue marche sort du champ : la caméra rattrape l'arrivée.
          if (cases >= MISE_EN_SCENE.casesCadrageArrivee) cadrer(`${e.uniteId}:arrivee`, camp, e.vers, debut + duree);
          occuper(e.uniteId, debut, duree);
        }
        // L'embuscade : le « ! » tombe sur la case d'arrêt, une fois la figurine
        // arrivée — et même si elle n'a pas fait un pas, une surprise au premier
        // contact reste une surprise. Le moteur a déjà laissé tomber la suite :
        // rien d'autre ne suivra pour cette unité dans la salve.
        if (e.interrompu) {
          const debut = depart(e.uniteId);
          const duree = d(DUREES.surprise);
          gestes.push({ genre: 'surprise', unite: e.uniteId, case: e.vers, debut, duree });
          occuper(e.uniteId, debut, duree);
        }
        break;
      }
      case 'attaque': {
        const att = caseDe(e.attaquantId);
        const def = caseDe(e.cibleId);
        const uAtt = uniteDe(e.attaquantId);
        const uDef = uniteDe(e.cibleId);
        if (!att || !def || !uAtt || !uDef) break;
        // Le coup part quand l'attaquant est arrivé — après sa marche, s'il en a fait une.
        const departCombat = depart(e.attaquantId);
        const disponibleDefenseur = depart(e.cibleId);
        cadrer(e.attaquantId, uAtt.camp, att, departCombat);
        let debutTir = departCombat;
        if (options.ecranCombat) {
          const duree = d(DUREES.duel);
          const pvApres = (id: string): number => {
            const u = uniteParId(apres, id);
            return u ? pvAffiches(u.pv) : 0;
          };
          const pvAvant = (u: { pv: number }, id: string, degats: number): number =>
            (uniteParId(avant, id) ? pvAffiches(u.pv) : pvApres(id) + dixiemes(degats));
          gestes.push({
            genre: 'duel',
            attaquant: {
              unite: e.attaquantId, type: uAtt.type, camp: uAtt.camp, case: att,
              pvAvant: pvAvant(uAtt, e.attaquantId, e.riposte), pvApres: pvApres(e.attaquantId),
            },
            cible: {
              unite: e.cibleId, type: uDef.type, camp: uDef.camp, case: def,
              pvAvant: pvAvant(uDef, e.cibleId, e.degats), pvApres: pvApres(e.cibleId),
            },
            riposte: e.riposte > 0,
            debut: departCombat,
            duree,
          });
          // Sous l'écran, le tir et le coup tombent quand l'écran les montre.
          debutTir = departCombat + d(Math.round(DUREES.duel * MISE_EN_SCENE.partCoup));
        }
        const dureeTir = d(DUREES.tir);
        gestes.push({ genre: 'tirer', unite: e.attaquantId, depuis: att, vers: def, debut: debutTir, duree: dureeTir });
        occuper(e.attaquantId, debutTir, dureeTir);
        const finTir = debutTir + dureeTir;
        if (e.degats > 0) {
          const duree = d(DUREES.encaisser);
          gestes.push({ genre: 'encaisser', unite: e.cibleId, case: def, degats: e.degats, depuis: att, debut: finTir, duree });
          occuper(e.cibleId, finTir, duree);
          chiffre(def, dixiemes(e.degats), teinteDe(uDef.camp), finTir);
        }
        if (e.riposte > 0) {
          // Carte et panneau de duel partagent le même décalage de riposte.
          const debutRiposte = Math.max(disponibleDefenseur, debutTir + d(MISE_EN_SCENE.delaiRiposte));
          gestes.push({ genre: 'tirer', unite: e.cibleId, depuis: def, vers: att, debut: debutRiposte, duree: dureeTir });
          occuper(e.cibleId, debutRiposte, dureeTir);
          const finRiposte = debutRiposte + dureeTir;
          const duree = d(DUREES.encaisser);
          gestes.push({ genre: 'encaisser', unite: e.attaquantId, case: att, degats: e.riposte, depuis: def, debut: finRiposte, duree });
          occuper(e.attaquantId, finRiposte, duree);
          chiffre(att, dixiemes(e.riposte), teinteDe(uAtt.camp), finRiposte);
        }
        break;
      }
      case 'hors_jeu': {
        const c = caseDe(e.uniteId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.sortir);
        gestes.push({ genre: 'sortir', unite: e.uniteId, case: c, debut, duree });
        occuper(e.uniteId, debut, duree);
        break;
      }
      case 'capture': {
        const cle = cleCase(e.case);
        const debut = depart(e.uniteId, remises.get(cle) ?? 0);
        const duree = d(e.acquis ? DUREES.hisser : DUREES.hisserUnCran);
        cadrer(e.uniteId, e.camp, e.case, debut);
        gestes.push({
          genre: 'hisser', unite: e.uniteId, case: e.case, camp: e.camp, points: e.points, acquis: e.acquis, debut, duree,
        });
        occuper(e.uniteId, debut, duree);
        break;
      }
      case 'remise_en_service': {
        const cle = cleCase(e.case);
        const debut = depart(e.uniteId);
        const duree = d(DUREES.remettre);
        cadrer(e.uniteId, e.camp, e.case, debut);
        gestes.push({ genre: 'remettre', unite: e.uniteId, case: e.case, camp: e.camp, debut, duree });
        occuper(e.uniteId, debut, duree);
        remises.set(cle, debut + duree);
        break;
      }
      case 'terrain_pose':
      case 'terrain_retire': {
        // Les poses d'une même salve se posent l'une après l'autre, à peine décalées.
        const debut = origine + rangBatir * d(MISE_EN_SCENE.ecartBatir);
        rangBatir += 1;
        gestes.push({
          genre: 'batir', case: e.case, terrain: e.type === 'terrain_pose' ? e.terrain : null, debut, duree: d(DUREES.batir),
        });
        break;
      }
      case 'production': {
        const debut = depart(null);
        cadrer(`case:${cleCase(e.case)}`, e.camp, e.case, debut);
        gestes.push({ genre: 'apparaitre', unite: e.unite, case: e.case, camp: e.camp, debut, duree: d(DUREES.apparaitre) });
        break;
      }
      case 'embarquement': {
        const de = caseDe(e.uniteId);
        const vers = caseDe(e.transportId);
        if (!de || !vers) break;
        const debut = depart(e.uniteId, fins.get(e.transportId) ?? 0);
        const duree = d(DUREES.embarquer);
        gestes.push({ genre: 'embarquer', unite: e.uniteId, transport: e.transportId, de, vers, debut, duree });
        occuper(e.uniteId, debut, duree);
        positions.set(e.uniteId, vers);
        break;
      }
      case 'debarquement': {
        const de = caseDe(e.transportId);
        if (!de) break;
        const debut = depart(e.uniteId, fins.get(e.transportId) ?? 0);
        const duree = d(DUREES.embarquer);
        cadrer(e.uniteId, campDe(e.uniteId), e.vers, debut);
        gestes.push({ genre: 'debarquer', unite: e.uniteId, transport: e.transportId, de, vers: e.vers, debut, duree });
        occuper(e.uniteId, debut, duree);
        positions.set(e.uniteId, e.vers);
        break;
      }
      case 'fusion': {
        const de = caseDe(e.uniteId);
        const vers = caseDe(e.avecId);
        if (!de || !vers) break;
        const debut = depart(e.uniteId, fins.get(e.avecId) ?? 0);
        const duree = d(DUREES.fusionner);
        gestes.push({ genre: 'fusionner', unite: e.uniteId, avec: e.avecId, de, vers, debut, duree });
        occuper(e.uniteId, debut, duree);
        occuper(e.avecId, debut, duree);
        break;
      }
      case 'ravitaillement': {
        // Rien ne bouge, rien ne tombe : l'annonce du HUD dit le reste, pas de chiffre.
        const c = caseDe(e.cibleId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.ravitailler);
        gestes.push({ genre: 'ravitailler', unite: e.uniteId, cible: e.cibleId, case: c, debut, duree });
        occuper(e.uniteId, debut, duree);
        break;
      }
      case 'reparation': {
        const c = caseDe(e.uniteId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.reparer);
        gestes.push({ genre: 'reparer', unite: e.uniteId, case: c, pv: e.pv, debut, duree });
        occuper(e.uniteId, debut, duree);
        // Des PV rendus sont un gain, à qui que ce soit : on ne rougit pas un « + ».
        chiffre(c, dixiemes(e.pv), 'gain', debut);
        break;
      }
      case 'repousse': {
        const de = caseDe(e.uniteId);
        if (!de) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.repousser);
        gestes.push({ genre: 'repousser', unite: e.uniteId, de, vers: e.vers, debut, duree });
        occuper(e.uniteId, debut, duree);
        positions.set(e.uniteId, e.vers);
        break;
      }
      case 'degats_mecanique': {
        // Un coup sans tireur : la case elle-même en tient lieu.
        const c = caseDe(e.uniteId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.encaisser);
        gestes.push({ genre: 'encaisser', unite: e.uniteId, case: c, degats: e.pv, depuis: c, debut, duree });
        occuper(e.uniteId, debut, duree);
        chiffre(c, dixiemes(e.pv), teinteDe(campDe(e.uniteId)), debut);
        break;
      }
      case 'furtivite': {
        // La bascule vient après le déplacement, comme toute suite : le voile
        // tombe — ou se lève — à l'arrivée, une fois la marche finie.
        const c = caseDe(e.uniteId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.voiler);
        gestes.push({ genre: e.furtive ? 'voiler' : 'devoiler', unite: e.uniteId, case: c, debut, duree });
        occuper(e.uniteId, debut, duree);
        break;
      }
      case 'soin': {
        // Un pouvoir rend des PV : même geste qu'une réparation sur un bâtiment,
        // et un chiffre vert — des PV rendus sont un gain, à qui que ce soit.
        const c = caseDe(e.uniteId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.reparer);
        gestes.push({ genre: 'reparer', unite: e.uniteId, case: c, pv: e.pv, debut, duree });
        occuper(e.uniteId, debut, duree);
        chiffre(c, dixiemes(e.pv), 'gain', debut);
        break;
      }
      case 'degats_directs': {
        // Un coup sans tireur, comme un dégât de mécanique : la case tient lieu
        // d'origine, et le chiffre parle au joueur — perte si c'est à lui.
        const c = caseDe(e.uniteId);
        if (!c) break;
        const debut = depart(e.uniteId);
        const duree = d(DUREES.encaisser);
        gestes.push({ genre: 'encaisser', unite: e.uniteId, case: c, degats: e.pv, depuis: c, debut, duree });
        occuper(e.uniteId, debut, duree);
        chiffre(c, dixiemes(e.pv), teinteDe(campDe(e.uniteId)), debut);
        break;
      }
      case 'reactivation': {
        // Toutes se réveillent ensemble, après le splash : un geste par unité,
        // sur place. Une liste vide ne joue rien.
        for (const id of e.unites) {
          const c = caseDe(id);
          if (!c) continue;
          const debut = depart(id);
          const duree = d(DUREES.reveiller);
          gestes.push({ genre: 'reveiller', unite: id, case: c, camp: e.camp, debut, duree });
          occuper(id, debut, duree);
        }
        break;
      }
      case 'frappe_zone': {
        // Les missiles tombent sur tout le rayon, et les touchées encaissent
        // ensemble quand la salve est finie — le centre tient lieu de tireur.
        const debut = depart(null);
        const duree = d(DUREES.frapper);
        cadrer(`frappe:${cleCase(e.centre)}`, e.camp, e.centre, debut);
        gestes.push({ genre: 'frapper', camp: e.camp, centre: e.centre, rayon: e.rayon, debut, duree });
        const impact = debut + duree;
        for (const { uniteId, pv } of e.touchees) {
          const c = caseDe(uniteId);
          if (!c || pv <= 0) continue;
          const debutCoup = depart(uniteId, impact);
          const dureeCoup = d(DUREES.encaisser);
          gestes.push({ genre: 'encaisser', unite: uniteId, case: c, degats: pv, depuis: e.centre, debut: debutCoup, duree: dureeCoup });
          occuper(uniteId, debutCoup, dureeCoup);
          chiffre(c, dixiemes(pv), teinteDe(campDe(uniteId)), debutCoup);
        }
        break;
      }
      case 'rayon_laser': {
        // Une unité après l'autre : le trait la désigne, puis elle encaisse
        // d'où elle est — un rayon n'a pas de case d'origine.
        e.touchees.forEach(({ uniteId, pv }, rang) => {
          const c = caseDe(uniteId);
          if (!c) return;
          const debut = depart(uniteId, origine + rang * d(MISE_EN_SCENE.ecartDesigner));
          const duree = d(DUREES.designer);
          cadrer(uniteId, campDe(uniteId), c, debut);
          gestes.push({ genre: 'designer', unite: uniteId, case: c, camp: e.camp, debut, duree });
          occuper(uniteId, debut, duree);
          if (pv <= 0) return;
          const debutCoup = debut + duree;
          const dureeCoup = d(DUREES.encaisser);
          gestes.push({ genre: 'encaisser', unite: uniteId, case: c, degats: pv, depuis: c, debut: debutCoup, duree: dureeCoup });
          occuper(uniteId, debutCoup, dureeCoup);
          chiffre(c, dixiemes(pv), teinteDe(campDe(uniteId)), debutCoup);
        });
        break;
      }
      case 'iem_pouvoir': {
        // L'anneau se referme ; tout ce qu'il a touché attend qu'il soit fermé
        // — les abattues pour tomber (`hors_jeu`, plus loin dans la salve), les
        // immobilisées pour ne rien faire d'autre que rester là.
        const debut = depart(null);
        const duree = d(DUREES.sceller);
        cadrer(`iem:${cleCase(e.centre)}`, e.camp, e.centre, debut);
        gestes.push({ genre: 'sceller', camp: e.camp, centre: e.centre, rayon: e.rayon, debut, duree });
        for (const id of [...e.immobilisees, ...e.abattues]) occuper(id, debut, duree);
        break;
      }
      // La panne sèche est suivie d'un `hors_jeu`, qui fait le geste ; la météo
      // imposée se lit au Bulletin et dans l'annonce ; les autres événements
      // n'ont rien à montrer sur la carte.
      default:
        break;
    }
  }

  return { gestes, duree: dureePartition(gestes) };
}
