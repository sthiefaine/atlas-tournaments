import { sonDeplacement } from '../audio/profils';
import type { Son, SortieAudio } from '../audio/types';
/**
 * L'**interprète** de la partition pour la peau 2D (`render/partition.ts`) :
 * chaque geste daté devient une `Animation` de la boucle (`render/boucle.ts`),
 * qui pousse un état visuel (`EtatVisuel2d`) — un décalage, une vue, un clip,
 * une opacité, un éclat —, jamais un état de jeu.
 *
 * Le principe est celui de la 3D, sans un iota de différence (`doc/10` §7.3) :
 * **l'état logique est déjà en avance**, une animation n'est qu'un rattrapage.
 * Elle ne décide rien, et si on la coupe (`Rendu.couper`), chaque `terminer`
 * pose l'**état final exact** : position, vue de repos, opacité, drapeau rendu
 * au décor, unité sortie relâchée.
 *
 * **Un exécutant par genre** (`EXECUTANTS`). Ce lot en pose l'essentiel — le
 * glissement le long du chemin validé par le moteur, le tir, le coup encaissé,
 * la sortie, l'apparition, la capture, le voile, l'embarquement — et laisse
 * vides les autres genres : un geste sans exécutant ne joue rien et ne retient
 * personne. L'agent « animations » de la seconde vague n'a qu'à remplir la
 * table ; rien d'autre n'a à changer.
 *
 * Deux règles du contrat, appliquées ici et nulle part ailleurs :
 *
 * - le `debut` d'un geste est encodé dans la **durée** de son animation, et la
 *   progression est remappée : tant que le geste attend son départ, il ne touche
 *   à rien — ou seulement à ce que son `attente` dit (une unité qui attend de
 *   glisser reste au départ de son chemin, une unité à paraître reste invisible) ;
 * - ce que l'interprète sait de la partie, il le demande au contexte **quand le
 *   geste part** (`etats()`), pas quand il est construit : à la première image,
 *   la peau a toujours l'état d'arrivée et celui d'avant.
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, pvAffiches, uniteParId } from '../engine/index';
import { animation, type Animation } from '../render/boucle';
import { surChemin } from '../render/chemin';
import type { GenreGeste, Geste, Partition } from '../render/partition';
import type { Case, UnitType } from '../schemas/types';
import type { PoseDrapeau } from './batiments';
import { orientationVers, type EtatVisuel2d, type Visuels } from './unites';

/** Les deux états que la peau connaît quand un geste part. */
export interface EtatsConnus {
  courant: EtatPartie | null;
  precedent: EtatPartie | null;
}

/** La prise d'un drapeau : ce qu'une capture en cours peut en faire, le temps d'un geste. */
export interface PriseDrapeau2d {
  /** La pose que le décor donnerait au drapeau dans cet état. */
  poseDans(etat: EtatPartie): PoseDrapeau;
  /** Impose une pose par-dessus ce que dit l'état. */
  forcer(pose: PoseDrapeau): void;
  /** Rend le drapeau à l'état. */
  relacher(): void;
}

/** Ce dont les exécutants ont besoin pour agir sur l'image. */
export interface ContexteAnimation2d {
  /** Les états visuels et les unités retenues, partagés avec le calque des unités. */
  visuels: Visuels;
  /** Les états connus à l'instant de l'appel : à lire quand le geste part. */
  etats(): EtatsConnus;
  catalogue(): Catalogue | null;
  /** Amène une case dans le champ si elle en sort ; ne bouge pas sinon. */
  cadrer(c: Case): void;
  /** La prise du drapeau d'une case bâtie, `null` si elle n'en porte pas. */
  drapeau(cle: string): PriseDrapeau2d | null;
  /** Les sons, sur la même horloge que les gestes. */
  audio?: Pick<SortieAudio, 'jouer'>;
  /** Un son ne révèle jamais une case hors de vue. */
  visible(c: Case): boolean;
  /** L'horloge de rendu, en millisecondes : un clip qui ne boucle pas se lit depuis son départ. */
  temps(): number;
  /** Une image est à refaire. */
  salir(): void;
}

/** Ce qu'un geste fait pendant qu'il court, attend, ou s'arrête. */
export interface Corps {
  avancer(p: number): void;
  /** Pendant l'attente du départ : rien, par défaut. */
  attente?(): void;
  /** L'état final exact, joué à la fin comme sur un clic qui coupe. */
  terminer?(): void;
  /** Le son du départ, et la case qui le porte (`null` : partout). */
  son?: { son: Son; case: Case | null };
}

/** Un exécutant : traduit un geste de son genre en corps d'animation, ou `null` s'il n'a rien à jouer. */
export type Executant<G extends GenreGeste = GenreGeste> = (g: Extract<Geste, { genre: G }>, ctx: ContexteAnimation2d) => Corps | null;

/** Une animation et la promesse qui tient jusqu'à sa fin. */
export interface AnimationDatee {
  animation: Animation;
  fin: Promise<void>;
}

/** Enveloppe un corps dans une animation de la boucle, le départ encodé dans la durée. */
export function animationDatee(nom: string, debut: number, duree: number, corps: Corps, ctx: ContexteAnimation2d): AnimationDatee {
  let resoudre: () => void = () => undefined;
  const fin = new Promise<void>((r) => { resoudre = r; });
  const total = debut + duree;
  let parti = false;
  let fini = false;
  const partir = (): void => {
    if (parti) return;
    parti = true;
    const s = corps.son;
    if (s && ctx.audio && (s.case === null || ctx.visible(s.case))) ctx.audio.jouer(s.son);
  };
  const anim = animation(nom, total, (p) => {
    let local: number;
    if (duree <= 0) local = p >= 1 ? 1 : -1;
    else if (debut > 0) local = (p * total - debut) / duree;
    else local = p;
    if (local < 0) corps.attente?.();
    else {
      partir();
      corps.avancer(Math.min(1, local));
    }
    ctx.salir();
  }, () => {
    if (fini) return;
    fini = true;
    corps.terminer?.();
    ctx.salir();
    resoudre();
  });
  return { animation: anim, fin };
}

/** Une unité par identifiant, dans l'état courant puis dans le précédent. */
function uniteConnue(ctx: ContexteAnimation2d, id: string): Unite | null {
  const { courant, precedent } = ctx.etats();
  return (courant && uniteParId(courant, id)) ?? (precedent && uniteParId(precedent, id)) ?? null;
}

function typeDe(ctx: ContexteAnimation2d, u: Unite | null): UnitType | undefined {
  return u ? ctx.catalogue()?.unites[u.type] : undefined;
}

/**
 * Le son d'un tir, lu sur les **données** de l'unité, jamais sur son nom :
 * la mitrailleuse contre ses cibles secondaires, le missile d'un lance-roquettes,
 * le canon du reste.
 */
export function sonTir(type?: UnitType, cible?: UnitType): Son {
  if (!type) return 'canon';
  if (cible && type.armeSecondaire?.includes(cible.cle)) return 'rafale';
  if (type.silhouette.modules.includes('lance_roquettes')) return 'missile';
  if (type.silhouette.base === 'pattes') return 'rafale';
  return 'canon';
}

/** Rend un état visuel à son repos, sans toucher à ce qu'un autre geste tient. */
function auRepos(ctx: ContexteAnimation2d, id: string): void {
  const v = ctx.visuels.lire(id);
  if (!v) return;
  v.dx = 0;
  v.dy = 0;
  v.dh = 0;
  v.orientation = null;
  v.clip = 'repos';
  v.eclat = 0;
  v.opacite = 1;
  v.echelle = 1;
}

/** Pose un clip s'il change : le départ d'un clip qui ne boucle pas est l'instant où on le pose. */
function clip(ctx: ContexteAnimation2d, id: string, nom: 'repos' | 'deplacement' | 'tir' | 'touche' | 'hors_jeu' | 'capture'): void {
  const v = ctx.visuels.visuel(id);
  if (v.clip === nom) return;
  v.clip = nom;
  v.clipDebut = ctx.temps();
}

const glisser: Executant<'glisser'> = (g, ctx) => {
  if (g.chemin.length < 2) return null;
  const fin = g.chemin[g.chemin.length - 1]!;
  const v = ctx.visuels.visuel(g.unite);
  const poser = (p: number): void => {
    const point = surChemin(g.chemin, p);
    // Le décalage se compte depuis la case où l'unité est **dessinée** : celle
    // de l'état — l'arrivée —, ou celle d'une unité retenue, qui n'est plus
    // dans l'état ou vient de monter dans une cale.
    const base = ctx.visuels.retenue(g.unite) ?? fin;
    v.dx = point.x - base.x;
    v.dy = point.y - base.y;
    // Le cap de `surChemin` est trigonométrique (y vers le haut) : on le rend à l'écran.
    v.orientation = orientationVers(Math.cos(point.cap), -Math.sin(point.cap), v.orientation ?? 'droite');
  };
  return {
    son: { son: sonDeplacement(typeDe(ctx, uniteConnue(ctx, g.unite))?.typeMouvement), case: g.chemin[0] ?? null },
    // En attendant son départ, l'unité reste au début de son chemin : l'état la
    // pose déjà à l'arrivée, et elle y paraîtrait avant d'avoir marché.
    attente: () => poser(0),
    avancer: (p) => {
      poser(p);
      clip(ctx, g.unite, 'deplacement');
    },
    terminer: () => {
      // Une unité retenue reste où elle est arrivée : c'est de là qu'elle sortira.
      ctx.visuels.poserRetenue(g.unite, fin);
      v.dx = 0;
      v.dy = 0;
      v.orientation = null;
      clip(ctx, g.unite, 'repos');
    },
  };
};

const tirer: Executant<'tirer'> = (g, ctx) => {
  const v = ctx.visuels.visuel(g.unite);
  const tireur = uniteConnue(ctx, g.unite);
  const { courant, precedent } = ctx.etats();
  const cible = [courant, precedent].map((e) => e?.unites.find((u) => u.x === g.vers.x && u.y === g.vers.y && !u.dansTransport)).find(Boolean) ?? null;
  return {
    son: { son: sonTir(typeDe(ctx, tireur), typeDe(ctx, cible)), case: g.depuis },
    avancer: () => {
      v.orientation = orientationVers(g.vers.x - g.depuis.x, g.vers.y - g.depuis.y, v.orientation ?? 'droite');
      clip(ctx, g.unite, 'tir');
    },
    terminer: () => {
      v.orientation = null;
      clip(ctx, g.unite, 'repos');
    },
  };
};

const encaisser: Executant<'encaisser'> = (g, ctx) => {
  const v = ctx.visuels.visuel(g.unite);
  // Les PV **d'avant le coup**, retenus tant que le geste dure : l'état est en
  // avance, et sans cela la pastille annoncerait la perte avant le tir.
  const retenirPv = (): void => {
    if (v.pv !== null) return;
    const { precedent } = ctx.etats();
    const u = precedent ? uniteParId(precedent, g.unite) : null;
    if (u) v.pv = pvAffiches(u.pv);
  };
  return {
    son: { son: 'impact', case: g.case },
    attente: retenirPv,
    avancer: (p) => {
      retenirPv();
      v.eclat = Math.max(0, 1 - p * 2.2) * 0.85;
      v.dx = Math.sin(p * Math.PI * 7) * 0.035 * (1 - p);
      clip(ctx, g.unite, 'touche');
    },
    terminer: () => {
      v.eclat = 0;
      v.dx = 0;
      v.pv = null;
      clip(ctx, g.unite, 'repos');
    },
  };
};

const sortir: Executant<'sortir'> = (g, ctx) => {
  let retenue = false;
  const retenir = (): void => {
    if (retenue) return;
    // L'unité n'est plus dans l'état : on la garde à l'écran le temps de la voir partir.
    const u = uniteConnue(ctx, g.unite);
    if (!u) return;
    ctx.visuels.retenir(u);
    retenue = true;
  };
  retenir();
  const v = ctx.visuels.visuel(g.unite);
  return {
    son: { son: 'hors_jeu', case: g.case },
    attente: retenir,
    avancer: (p) => {
      retenir();
      v.opacite = 1 - p;
      v.dh = -p * 0.08;
      clip(ctx, g.unite, 'hors_jeu');
    },
    terminer: () => {
      if (retenue) ctx.visuels.liberer(g.unite);
      else auRepos(ctx, g.unite);
    },
  };
};

const apparaitre: Executant<'apparaitre'> = (g, ctx) => {
  // Le geste ne porte que le type et la case : l'unité est celle de l'état qui s'y trouve.
  const trouver = (): Unite | null => ctx.etats().courant?.unites
    .find((u) => u.x === g.case.x && u.y === g.case.y && u.type === g.unite && !u.dansTransport) ?? null;
  let id: string | null = null;
  const v = (): EtatVisuel2d | null => {
    id ??= trouver()?.id ?? null;
    return id ? ctx.visuels.visuel(id) : null;
  };
  return {
    son: { son: 'production', case: g.case },
    attente: () => { const e = v(); if (e) e.opacite = 0; },
    avancer: (p) => {
      const e = v();
      if (!e) return;
      e.opacite = p;
      e.echelle = 0.82 + 0.18 * p;
      e.dh = (1 - p) * 0.12;
    },
    terminer: () => { if (id) auRepos(ctx, id); },
  };
};

const voile = (montant: boolean) => (g: { unite: string }, ctx: ContexteAnimation2d): Corps => {
  const v = ctx.visuels.visuel(g.unite);
  return {
    avancer: (p) => { v.voile = montant ? p : 1 - p; },
    terminer: () => { v.voile = null; },
  };
};

const reveiller: Executant<'reveiller'> = (g, ctx) => {
  const v = ctx.visuels.visuel(g.unite);
  return {
    avancer: (p) => { v.eclat = Math.sin(p * Math.PI) * 0.7; },
    terminer: () => { v.eclat = 0; },
  };
};

const surprise: Executant<'surprise'> = (g, ctx) => {
  const v = ctx.visuels.visuel(g.unite);
  return {
    avancer: (p) => { v.dh = Math.sin(Math.min(1, p * 2) * Math.PI) * 0.1; },
    terminer: () => { v.dh = 0; },
  };
};

/** Part de la capture passée à amener l'ancien drapeau, quand il change de mains. */
const PART_AMENER = 0.38;

const hisser: Executant<'hisser'> = (g, ctx) => {
  const prise = ctx.drapeau(cleCase(g.case));
  let depuis: PoseDrapeau | null = null;
  let vers: PoseDrapeau | null = null;
  const lire = (): void => {
    if (depuis || !prise) return;
    const { courant, precedent } = ctx.etats();
    vers = courant ? prise.poseDans(courant) : null;
    depuis = precedent ? prise.poseDans(precedent) : vers;
  };
  return {
    son: g.acquis ? { son: 'capture', case: g.case } : undefined,
    attente: () => {
      lire();
      if (prise && depuis) prise.forcer(depuis);
    },
    avancer: (p) => {
      lire();
      clip(ctx, g.unite, 'capture');
      if (!prise || !depuis || !vers) return;
      if (depuis.camp === vers.camp || depuis.camp === null) {
        const de = depuis.camp === vers.camp ? depuis.niveau : 0;
        prise.forcer({ camp: vers.camp, niveau: de + (vers.niveau - de) * p });
      } else if (p < PART_AMENER) {
        // Les couleurs d'avant descendent d'abord…
        prise.forcer({ camp: depuis.camp, niveau: depuis.niveau * (1 - p / PART_AMENER) });
      } else {
        // … puis les nouvelles montent.
        prise.forcer({ camp: vers.camp, niveau: vers.niveau * ((p - PART_AMENER) / (1 - PART_AMENER)) });
      }
    },
    terminer: () => {
      prise?.relacher();
      clip(ctx, g.unite, 'repos');
    },
  };
};

/** Un passage d'une case à une autre : embarquer, débarquer, se repousser, fusionner. */
const passage = (options: { retenir: boolean; apparait: boolean; disparait: boolean }) => (
  g: { unite: string; de: Case; vers: Case }, ctx: ContexteAnimation2d,
): Corps => {
  let retenue = false;
  const retenir = (): void => {
    if (!options.retenir || retenue) return;
    // L'état courant d'abord : pour un ordre du joueur, la salve est construite
    // avant que la peau reçoive l'état d'arrivée, et c'est lui qui dit où
    // l'unité était ; pour l'adversaire, l'unité qui a quitté l'état est dans
    // le précédent.
    const u = uniteConnue(ctx, g.unite);
    if (!u) return;
    ctx.visuels.retenir(u);
    retenue = true;
  };
  retenir();
  const v = ctx.visuels.visuel(g.unite);
  // La case d'où l'unité est dessinée : l'arrivée pour une unité de l'état,
  // la sienne pour une unité retenue.
  const origine = (): Case => ctx.visuels.retenue(g.unite) ?? g.vers;
  const poser = (p: number): void => {
    const o = origine();
    v.dx = g.de.x + (g.vers.x - g.de.x) * p - o.x;
    v.dy = g.de.y + (g.vers.y - g.de.y) * p - o.y;
    if (options.disparait) v.opacite = 1 - p;
    else if (options.apparait) v.opacite = p;
    v.orientation = orientationVers(g.vers.x - g.de.x, g.vers.y - g.de.y, v.orientation ?? 'droite');
  };
  return {
    attente: () => { retenir(); poser(0); },
    avancer: (p) => { retenir(); poser(p); },
    terminer: () => {
      if (retenue) ctx.visuels.liberer(g.unite);
      else auRepos(ctx, g.unite);
    },
  };
};

const cadrer: Executant<'cadrer'> = (g, ctx) => ({
  avancer: (p) => { if (p >= 1) ctx.cadrer(g.case); },
});

const pouvoir: Executant<'pouvoir'> = () => ({
  // Le splash est au HUD ; la peau ne fait qu'en jouer le son, sur la même horloge.
  son: { son: 'pouvoir', case: null },
  avancer: () => undefined,
});

/**
 * La table des exécutants. Un genre absent ne joue rien sur la carte : `duel`,
 * `chiffre` et le splash de `pouvoir` sont au HUD ; `batir`, `remettre`,
 * `ravitailler`, `reparer`, `frapper`, `designer` et `sceller` attendent la
 * seconde vague.
 */
export const EXECUTANTS: { readonly [G in GenreGeste]?: Executant<G> } = {
  glisser,
  tirer,
  encaisser,
  sortir,
  apparaitre,
  voiler: voile(true),
  devoiler: voile(false),
  reveiller,
  surprise,
  hisser,
  embarquer: passage({ retenir: true, apparait: false, disparait: true }),
  debarquer: passage({ retenir: false, apparait: true, disparait: false }),
  fusionner: passage({ retenir: true, apparait: false, disparait: true }),
  repousser: passage({ retenir: false, apparait: false, disparait: false }),
  cadrer,
  pouvoir,
};

/** Le corps d'un geste, par son exécutant ; `null` si son genre n'en a pas. */
export function corpsDe(g: Geste, ctx: ContexteAnimation2d): Corps | null {
  const executant = EXECUTANTS[g.genre] as Executant | undefined;
  return executant ? executant(g as never, ctx) : null;
}

/** Les animations d'une partition, et les promesses qui tiennent jusqu'à leur fin. */
export function animationsDePartition(partition: Partition, ctx: ContexteAnimation2d): { animations: Animation[]; attentes: Promise<void>[] } {
  const animations: Animation[] = [];
  const attentes: Promise<void>[] = [];
  for (const g of partition.gestes) {
    const corps = corpsDe(g, ctx);
    if (!corps) continue;
    const a = animationDatee(g.genre, g.debut, g.duree, corps, ctx);
    animations.push(a.animation);
    attentes.push(a.fin);
  }
  return { animations, attentes };
}
