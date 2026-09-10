/**
 * Les **scènes de dialogue** : décider quelle réplique s'invite dans la partie,
 * et quand (`03-schemas.md` §6, `08-narration-choix.md`).
 *
 * Ce fichier ne touche à rien : il lit un état, la file d'événements que le
 * moteur vient de rendre, et la liste des scènes déjà jouées ; il rend les
 * scènes à ouvrir. Aucun DOM, aucune horloge, aucun effet de bord — c'est ce qui
 * permet de le tester avec une vraie partie, et c'est ce qui garantit qu'un
 * rejeu redonne les mêmes dialogues aux mêmes moments.
 *
 * Trois règles tiennent l'ensemble :
 *
 * 1. une scène se juge sur des **événements**, jamais sur un sondage périodique
 *    — un dialogue est une conséquence, pas une minuterie ;
 * 2. une scène ne se joue **qu'une fois** par partie, identifiée par sa clé ;
 * 3. l'ordre des scènes est celui du scénario, pas celui des événements : un
 *    auteur qui écrit ses scènes dans l'ordre les entend dans cet ordre.
 */

import type { EtatPartie, EvenementJeu } from '../engine/index';
import type {
  CampId, DeclencheurScene, Dialogue, Emotion, Scenario, SceneDialogue,
} from '../schemas/types';

/** Une réplique prête à peindre : tout ce dont le HUD a besoin, et rien de plus. */
export interface RepliqueEnAttente {
  /** Scène d'origine : sert à ne pas rejouer une scène déjà entendue. */
  sceneCle: string;
  /** Clé du commandant qui parle ; le HUD en tire le nom par `t()`. */
  locuteur: string;
  texte: string;
  emotion: Emotion;
  /** Camp du locuteur quand on sait le rattacher : donne le côté et la couleur. */
  camp: CampId | null;
  /** Rang dans la scène, à partir de 1, et taille de la scène. */
  rang: number;
  total: number;
}

/** Ce que les déclencheurs lisent : l'état d'après et ce qui vient de se passer. */
export interface ContexteScenes {
  /** L'état **après** l'action, celui que le joueur a sous les yeux. */
  etat: EtatPartie;
  /** Les événements rendus par la dernière action, dans l'ordre du moteur. */
  evenements: readonly EvenementJeu[];
  /** Camp du joueur humain : `journee` et les déclencheurs sans `camp` s'y réfèrent. */
  camp: CampId;
}

/** Vrai si ce déclencheur est satisfait par ce que la partie vient de faire. */
function declenche(d: DeclencheurScene, ctx: ContexteScenes): boolean {
  const { evenements: evts } = ctx;
  switch (d.type) {
    // L'ouverture n'est jamais déclenchée par un événement : c'est l'hôte qui
    // l'ouvre une fois la carte cadrée, sinon elle parlerait dans le vide.
    case 'ouverture':
      return false;
    case 'journee':
      return evts.some((e) => e.type === 'debut_tour' && e.camp === ctx.camp && e.journee >= d.journee);
    case 'premier_combat':
      return evts.some((e) => e.type === 'attaque');
    case 'capture':
      return evts.some((e) => e.type === 'capture' && e.acquis && (d.camp === undefined || e.camp === d.camp));
    case 'perte':
      return evts.some((e) => e.type === 'hors_jeu' && (d.camp === undefined || e.camp === d.camp));
    // L'événement `panne_seche` ne porte que l'identifiant : le camp se lit
    // sur le `hors_jeu` que le moteur émet juste après pour la même unité.
    case 'panne_seche':
      return evts.some((e) => e.type === 'panne_seche' && (d.camp === undefined
        || evts.some((h) => h.type === 'hors_jeu' && h.uniteId === e.uniteId && h.camp === d.camp)));
    case 'production':
      // Une machine sortie d'une superusine est une production comme une autre
      // pour la scène : Basile parle à la première (`aube_superusine`).
      return evts.some((e) => (e.type === 'production' || e.type === 'production_automatique')
        && (d.unite === undefined || e.unite === d.unite));
    case 'pouvoir':
      return evts.some((e) => e.type === 'pouvoir' && (d.camp === undefined || e.camp === d.camp));
    // Le jalon se lit sur l'état, pas sur un événement : le moteur n'émet rien
    // quand un relais avance. La règle « une fois » suffit à ne pas bégayer.
    case 'etape':
      return Object.values(ctx.etat.relais ?? {}).some((n) => n >= d.etape);
    default:
      return false;
  }
}

/**
 * Les scènes à ouvrir maintenant, dans l'ordre du scénario. Les scènes déjà
 * jouées sont écartées ; c'est à l'appelant de tenir ce registre, parce que
 * c'est lui qui sait ce qu'il a réellement montré au joueur.
 */
export function scenesDeclenchees(
  scenes: readonly SceneDialogue[],
  jouees: ReadonlySet<string>,
  ctx: ContexteScenes,
): SceneDialogue[] {
  return scenes.filter((s) => !jouees.has(s.cle) && declenche(s.declencheur, ctx));
}

/**
 * Le dialogue de **fin de match** : celui du scénario, sinon un mot de repli
 * dit par le commandant du joueur — félicitations ou encouragement, par clé
 * i18n. Une fin de partie a **toujours** un visage : l'écran de résultat ne
 * vient qu'après, et un scénario qui n'a rien écrit ne laisse pas un silence.
 *
 * `t` est le traducteur de l'hôte ; le texte rendu est déjà traduit, comme le
 * sont les répliques écrites dans un scénario.
 */
export function dialogueFin(
  scenario: Pick<Scenario, 'commandants' | 'dialogueVictoire' | 'dialogueDefaite'>,
  camp: CampId,
  gagne: boolean,
  t: (cle: string) => string,
): Dialogue[] {
  const declare = gagne ? scenario.dialogueVictoire : scenario.dialogueDefaite;
  if (declare.length > 0) return declare;
  // Le commandant du joueur — celui qui a incarné le camp, s'il y a incarnation —,
  // sinon le premier de la distribution : une réplique a besoin d'une bouche.
  const locuteur = scenario.commandants.find((c) => c.camp === camp)?.commandantCle
    ?? scenario.commandants[0]?.commandantCle;
  if (!locuteur) return [];
  return [{
    locuteur,
    texte: t(gagne ? 'dialogue.victoire_defaut' : 'dialogue.defaite_defaut'),
    emotion: gagne ? 'joie' : 'neutre',
  }];
}

/** La scène d'ouverture d'un scénario, s'il en déclare une. */
export function sceneOuverture(scenes: readonly SceneDialogue[]): SceneDialogue | undefined {
  return scenes.find((s) => s.declencheur.type === 'ouverture');
}

/**
 * Déplie une suite de répliques en file d'affichage. `campDe` rattache un
 * locuteur à son camp — le HUD s'en sert pour poser le portrait du bon côté et
 * lui donner la couleur de sa nation.
 */
export function filerRepliques(
  sceneCle: string,
  repliques: readonly Dialogue[],
  campDe: (locuteur: string) => CampId | null,
): RepliqueEnAttente[] {
  return repliques.map((r, i) => ({
    sceneCle,
    locuteur: r.locuteur,
    texte: r.texte,
    emotion: r.emotion ?? 'neutre',
    camp: campDe(r.locuteur),
    rang: i + 1,
    total: repliques.length,
  }));
}
