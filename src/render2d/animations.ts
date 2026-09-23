import { sonDeplacement } from '../audio/profils';
import type { Son, SortieAudio } from '../audio/types';
/**
 * L'**interprète** de la partition pour la peau 2D (`render/partition.ts`) :
 * chaque geste daté devient une `Animation` de la boucle (`render/boucle.ts`),
 * qui pousse un état visuel (`EtatVisuel2d`), jette des effets (`effets.ts`) et
 * secoue l'écran — jamais un état de jeu.
 *
 * Le principe est celui de la 3D, sans un iota de différence (`doc/10` §7.3) :
 * **l'état logique est déjà en avance**, une animation n'est qu'un rattrapage.
 * Elle ne décide rien, et si on la coupe (`Rendu.couper`), chaque `terminer`
 * pose l'**état final exact** : position, vue de repos, opacité, drapeau rendu
 * au décor, unité sortie relâchée ; la peau vide le pool d'effets et arrête la
 * secousse.
 *
 * **Un exécutant par genre** (`EXECUTANTS`) : les vingt-trois gestes de la
 * carte. `duel` et `chiffre` n'en ont pas — l'écran de combat et les chiffres
 * sont au HUD —, et `pouvoir` joue ici ce qui se passe **sur la carte** (l'éclat,
 * la vague de teinte, les unités qui s'allument), le splash restant au HUD.
 *
 * **Le « jus » d'Advance Wars, sans toucher aux règles ni à la partition** :
 *
 * - une marche prend son **élan**, file, **dépasse** son arrivée d'un souffle et
 *   s'y **tasse** (`mouvementGlisse`) ; elle suit le chemin du moteur, cap par
 *   segment, et sa foulée — le clip, le rebond d'un fantassin, le grondement
 *   d'une chenille, la poussière ou le sillage — suit la distance, pas l'horloge ;
 * - un tir **recule**, lance un éclair de bouche et un projectile selon le
 *   profil de l'arme (`profilTir` : rafale, obus en cloche, missile, marqueur),
 *   qui arrive **à l'heure** du coup ;
 * - un coup reçu fait un **arrêt sur image** (`ARRET_IMAGE_MS`) : la cible
 *   blanchit et se fige avec son étoile d'impact, puis les étincelles partent,
 *   la fumée monte, la pièce vibre en s'amortissant et l'écran secoue. L'arrêt
 *   est **local** : il fige la cible et son impact, pas la partition — le HUD
 *   joue la même partition sur sa propre horloge, et une partition qui
 *   s'allongerait d'un arrêt par coup décalerait ses chiffres ;
 * - aucun mouvement n'est linéaire : anticipation, dépassement, amortissement.
 *
 * **Les pistes.** Deux gestes peuvent tenir la même unité en même temps — la
 * cible tire sa riposte pendant qu'elle encaisse. Chacun écrit sa **piste**
 * (`Piste`) et l'état visuel en est la composition (`recomposer`) : décalages
 * sommés, opacités et échelles multipliées, éclats cumulés, et le clip de plus
 * haute priorité (`PRIORITE_CLIP`). Fermer la dernière piste rend l'unité au
 * repos — c'est l'état final exact.
 *
 * Deux règles du contrat, appliquées ici et nulle part ailleurs :
 *
 * - le `debut` d'un geste est encodé dans la **durée** de son animation, et la
 *   progression est remappée : tant que le geste attend son départ, il ne touche
 *   à rien — ou seulement à ce que son `attente` dit ;
 * - ce que l'interprète sait de la partie, il le demande au contexte **quand le
 *   geste part** (`etats()`), pas quand il est construit.
 *
 * Sous animations réduites, la partition ne dure pas : chaque geste pose son
 * état final à la première image, **sans effet ni secousse** (`anime`).
 */

import type { Catalogue, EtatPartie, Unite } from '../engine/index';
import { cleCase, depuisCle, manhattan, pvAffiches, uniteParId, uniteSur } from '../engine/index';
import { animation, type Animation } from '../render/boucle';
import { casesDuRayon, longueurChemin } from '../render/chemin';
import type { GenreGeste, Geste, Partition } from '../render/partition';
import { TYPES_MOUVEMENT_MOTEUR, type CampId, type Case, type UnitType } from '../schemas/types';
import { PIED_MAT, type PoseDrapeau } from './batiments';
import type { ClipSprite } from './contrat';
import type { PoolEffets, Rvb, SpecEffet, Superposition } from './effets';
import { HAUTEUR_MAT } from './replis';
import { HAUTEUR_VOL, orientationRepos, orientationVers, type EtatVisuel2d, type Orientation, type Visuels } from './unites';

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
  /** Un son ne révèle jamais une case hors de vue ; un effet non plus. */
  visible(c: Case): boolean;
  /** L'horloge de rendu, en millisecondes : un clip qui ne boucle pas se lit depuis son départ. */
  temps(): number;
  /** Une image est à refaire. */
  salir(): void;
  /** Le pool d'effets de la peau ; absent, les gestes ne jettent rien et jouent quand même. */
  effets?: Pick<PoolEffets, 'emettre'>;
  /** Secoue l'écran : `amplitude` pixels, amortie en `duree` ms, dans `retard` ms. */
  secouer?(amplitude: number, duree: number, retard?: number): void;
  /** L'éclat et la vague de teinte d'un pouvoir, peints par-dessus la carte. */
  superposition?: Pick<Superposition, 'eclater' | 'vague'>;
  /** La couleur d'équipe d'un camp, de 0 à 1 : celle du style de sa nation. */
  equipe?(camp: CampId | null): Rvb;
  /** Animations réduites : ni effet ni secousse, l'état final tout de suite. */
  reduit?(): boolean;
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

// ---------------------------------------------------------------------------
// 1. Les pistes : plusieurs gestes sur une même unité
// ---------------------------------------------------------------------------

/**
 * La priorité des clips quand deux gestes se chevauchent : un coup reçu se voit
 * par-dessus un tir, une mise hors jeu par-dessus tout.
 */
export const PRIORITE_CLIP: Readonly<Record<ClipSprite, number>> = {
  repos: 0, deplacement: 1, capture: 2, tir: 3, touche: 4, hors_jeu: 5,
};

const PISTES = new WeakMap<EtatVisuel2d, Piste[]>();
let rangPistes = 0;

/**
 * La contribution d'un geste à l'état visuel d'une unité. Un geste l'ouvre, y
 * écrit à chaque image, l'**applique**, et la **ferme** à sa fin : l'état
 * visuel revient alors à ce que disent les autres gestes, ou au repos.
 */
export class Piste {
  dx = 0;
  dy = 0;
  dh = 0;
  orientation: Orientation | null = null;
  clip: ClipSprite | null = null;
  clipTemps: number | null = null;
  opacite = 1;
  echelle = 1;
  eclat = 0;
  teinte: [number, number, number] | null = null;
  pv: number | null = null;
  voile: number | null = null;
  readonly rang: number;
  private ouverte = true;

  constructor(readonly v: EtatVisuel2d) {
    rangPistes += 1;
    this.rang = rangPistes;
    let liste = PISTES.get(v);
    if (!liste) {
      liste = [];
      PISTES.set(v, liste);
    }
    liste.push(this);
  }

  /** Recompose l'état visuel avec cette piste et les autres. */
  appliquer(temps: number): void {
    if (this.ouverte) recomposer(this.v, temps);
  }

  /** Ferme la piste : l'état visuel ne garde que les autres. Idempotent. */
  fermer(temps: number): void {
    if (!this.ouverte) return;
    this.ouverte = false;
    const liste = PISTES.get(this.v);
    const i = liste ? liste.indexOf(this) : -1;
    if (liste && i >= 0) liste.splice(i, 1);
    recomposer(this.v, temps);
  }
}

/** Les pistes ouvertes d'un état visuel (tests, mise au point). */
export function pistesDe(v: EtatVisuel2d): readonly Piste[] {
  return PISTES.get(v) ?? [];
}

/**
 * L'état visuel composé de ses pistes : décalages sommés, opacités et échelles
 * multipliées, éclats cumulés (`1 − Π(1 − e)`), teintes multipliées, les PV
 * retenus les plus hauts (ceux d'avant le premier coup), la vue et le voile de
 * la piste la plus récente, le clip de plus haute priorité. Un clip qui change
 * part de `temps`.
 */
export function recomposer(v: EtatVisuel2d, temps: number): void {
  const liste = PISTES.get(v) ?? [];
  let dx = 0;
  let dy = 0;
  let dh = 0;
  let opacite = 1;
  let echelle = 1;
  let sombre = 1;
  let teinte: [number, number, number] | null = null;
  let pv: number | null = null;
  let voile: number | null = null;
  let rangVoile = -1;
  let orientation: Orientation | null = null;
  let rangOrientation = -1;
  let clip: Piste | null = null;
  for (const p of liste) {
    dx += p.dx;
    dy += p.dy;
    dh += p.dh;
    opacite *= p.opacite;
    echelle *= p.echelle;
    sombre *= 1 - Math.max(0, Math.min(1, p.eclat));
    if (p.teinte) teinte = teinte ? [teinte[0] * p.teinte[0], teinte[1] * p.teinte[1], teinte[2] * p.teinte[2]] : [...p.teinte];
    if (p.pv !== null) pv = pv === null ? p.pv : Math.max(pv, p.pv);
    if (p.voile !== null && p.rang > rangVoile) {
      voile = p.voile;
      rangVoile = p.rang;
    }
    if (p.orientation !== null && p.rang > rangOrientation) {
      orientation = p.orientation;
      rangOrientation = p.rang;
    }
    if (p.clip !== null) {
      const ecart = clip?.clip ? PRIORITE_CLIP[p.clip] - PRIORITE_CLIP[clip.clip] : 1;
      if (!clip || ecart > 0 || (ecart === 0 && p.rang > clip.rang)) clip = p;
    }
  }
  v.dx = dx;
  v.dy = dy;
  v.dh = dh;
  v.opacite = opacite;
  v.echelle = echelle;
  v.eclat = 1 - sombre;
  v.teinte = teinte;
  v.pv = pv;
  v.voile = voile;
  v.orientation = orientation;
  const nom = clip?.clip ?? 'repos';
  if (nom !== v.clip) {
    v.clip = nom;
    v.clipDebut = temps;
  }
  v.clipTemps = clip ? clip.clipTemps : null;
}

// ---------------------------------------------------------------------------
// 2. Ce que les gestes partagent
// ---------------------------------------------------------------------------

/** L'arrêt sur image d'un coup reçu, en millisecondes (60 à 80) : borné à la moitié du geste. */
export const ARRET_IMAGE_MS = 70;

/** La secousse d'écran d'un coup, en pixels : de 2 (égratignure) à 4 (coup plein). */
export const SECOUSSE_COUP = { min: 2, max: 4, duree: 240 } as const;

/** Les réglages de la marche : en millisecondes et en cases. */
export const MARCHE = Object.freeze({
  /** L'élan : on recule d'un souffle avant de partir. */
  msElan: 45,
  elan: 0.045,
  /** L'accélération et le freinage : bornés en part du geste, une marche d'une case reste une marche. */
  msAcceleration: 80,
  msFreinage: 60,
  /** L'arrivée : un dépassement qui revient se poser, et le tassement qui va avec. */
  msArrivee: 110,
  depassement: 0.05,
  tassement: 0.05,
  enfoncement: 0.03,
  /** Le temps de clip par case parcourue : la foulée d'une image cuite suit la distance. */
  msClipParCase: 360,
  /** Les rebonds d'une foulée, au plus, par seconde : au-delà, un fantassin tremble. */
  foulees: 7,
  /** Un pas de bruit tous les tant, comme en 3D. */
  msPasSonore: 280,
});

/** Le sommet de `sin(πq)·(1 − q)` sur [0, 1], atteint en q ≈ 0,354 : ce qu'un dépassement d'amplitude 1 atteint. */
const PIC_DEPASSEMENT = 0.5792303273565196;

const BLANC: Rvb = [1, 1, 1];

function borne01(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x;
}

/** Un mélange de deux couleurs. */
function melanger(a: Rvb, b: Rvb, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Un rebond de 0 à 1 à 0 sur `[0, 1]`, nul ailleurs. */
function bosse(q: number): number {
  return q <= 0 || q >= 1 ? 0 : Math.sin(Math.PI * q);
}

/** Vrai si le geste a le droit de jeter des effets et de secouer : il dure, et rien n'est réduit. */
function anime(ctx: ContexteAnimation2d, duree: number): boolean {
  return duree > 0 && ctx.reduit?.() !== true;
}

/** Joue un son, s'il y a de quoi et si la case est vue. */
function jouerSon(ctx: ContexteAnimation2d, son: Son, c: Case | null): void {
  if (ctx.audio && (c === null || ctx.visible(c))) ctx.audio.jouer(son);
}

function emettre(ctx: ContexteAnimation2d, s: SpecEffet): void {
  ctx.effets?.emettre(s);
}

function equipeDe(ctx: ContexteAnimation2d, camp: CampId | null): Rvb {
  return ctx.equipe?.(camp) ?? BLANC;
}

/** Une unité par identifiant, dans l'état courant puis dans le précédent. */
function uniteConnue(ctx: ContexteAnimation2d, id: string): Unite | null {
  const { courant, precedent } = ctx.etats();
  return (courant && uniteParId(courant, id)) ?? (precedent && uniteParId(precedent, id)) ?? null;
}

/** L'unité sur une case, dans l'état courant puis dans le précédent. */
function uniteSurCase(ctx: ContexteAnimation2d, c: Case): Unite | null {
  const { courant, precedent } = ctx.etats();
  return (courant && uniteSur(courant, c)) ?? (precedent && uniteSur(precedent, c)) ?? null;
}

function typeDe(ctx: ContexteAnimation2d, u: Unite | null): UnitType | undefined {
  return u ? ctx.catalogue()?.unites[u.type] : undefined;
}

/** Le vecteur unitaire de `de` vers `vers`, au sol ; nul si les deux cases se confondent. */
function direction(de: Case, vers: Case): { x: number; y: number } {
  const x = vers.x - de.x;
  const y = vers.y - de.y;
  const n = Math.hypot(x, y);
  return n === 0 ? { x: 0, y: 0 } : { x: x / n, y: y / n };
}

/**
 * La hauteur où un coup porte sur une figurine, en cases au-dessus du sol :
 * plus haut sur une grosse pièce, et au-dessus de la case pour un appareil.
 */
export function hauteurImpact(type?: UnitType): number {
  if (!type) return 0.3;
  const base = 0.22 + 0.08 * (type.silhouette.taille - 1);
  return base + (type.domaine === 'air' ? HAUTEUR_VOL : 0);
}

/** Le profil d'un tir : ce qui part du canon et comment il arrive. */
export type ProfilTir = 'rafale' | 'missile' | 'cloche' | 'marqueur';

/**
 * Le profil d'un tir, lu sur les **données** de l'unité, jamais sur son nom :
 * la mitrailleuse contre ses cibles secondaires, le missile d'un lance-roquettes
 * ou d'un appareil à ailes, la bombe d'un bombardier et l'obus d'un tir indirect
 * en cloche, la rafale d'un fantassin, d'un rotor ou d'une pièce antiaérienne,
 * l'obus tendu du reste.
 */
export function profilTir(type?: UnitType, cible?: UnitType): ProfilTir {
  if (!type) return 'marqueur';
  if (cible && type.armeSecondaire?.includes(cible.cle)) return 'rafale';
  const s = type.silhouette;
  if (s.modules.includes('lance_roquettes')) return 'missile';
  if (s.base === 'ailes') return s.corps === 'bloc' ? 'cloche' : 'missile';
  if (type.portee[0] > 1) return 'cloche';
  if (type.traits.includes('anti_air') || s.base === 'pattes' || s.base === 'rotor' || (s.base === 'roues' && s.corps === 'capsule')) {
    return 'rafale';
  }
  return 'marqueur';
}

/** Le son d'un tir : celui de son profil. */
export function sonTir(type?: UnitType, cible?: UnitType): Son {
  const p = profilTir(type, cible);
  return p === 'rafale' ? 'rafale' : p === 'missile' ? 'missile' : 'canon';
}

/** Pose un clip sur une piste, lu depuis `ms` de geste. */
function clipDe(piste: Piste, nom: ClipSprite, ms: number): void {
  piste.clip = nom;
  piste.clipTemps = Math.max(0, ms);
}

// ---------------------------------------------------------------------------
// 3. La marche
// ---------------------------------------------------------------------------

/**
 * La marche à `ms` d'un glissement de `duree` ms sur `longueur` cases : `s` la
 * distance parcourue le long du chemin (négative pendant l'élan, au-delà de la
 * longueur pendant le dépassement), `elan` et `tassement` de 0 à 1 à 0.
 *
 * Cinq temps, tous bornés en part du geste : l'**élan** (un souffle en arrière),
 * l'**accélération**, la **croisière**, le **freinage** jusqu'à une vitesse
 * résiduelle, et l'**arrivée** — un dépassement `A·sin(πq)·(1 − q)` qui prend la
 * vitesse du freinage, revient se poser et s'arrête à vitesse nulle, exactement
 * sur la case. Continue en position et en vitesse d'un bout à l'autre.
 */
export function mouvementGlisse(ms: number, duree: number, longueur: number): { s: number; elan: number; tassement: number } {
  const L = Math.max(0, longueur);
  if (duree <= 0 || L <= 0) return { s: L, elan: 0, tassement: 0 };
  const u = borne01(ms / duree);
  const e = Math.min(0.15, MARCHE.msElan / duree);
  const a = Math.min(0.2, MARCHE.msAcceleration / duree);
  const b = Math.min(0.15, MARCHE.msFreinage / duree);
  const r = Math.min(0.3, MARCHE.msArrivee / duree);
  const c = Math.max(0, 1 - e - a - b - r);
  let A = Math.min(MARCHE.depassement, L * 0.25) / PIC_DEPASSEMENT;
  let ve = (A * Math.PI) / r;
  let vc = (L - (ve * b) / 2) / (a / 2 + c + b / 2);
  if (vc < ve) {
    // Une marche trop courte pour freiner : elle arrive à sa vitesse et se pose.
    vc = L / (a / 2 + c + b);
    ve = vc;
    A = (ve * r) / Math.PI;
  }
  if (u < e) {
    const elan = Math.sin((Math.PI * u) / e);
    // Pas de « −0 » au départ : un décalage nul est nul, on le compare à l'état final exact.
    return { s: elan === 0 ? 0 : -MARCHE.elan * elan, elan, tassement: 0 };
  }
  if (u < e + a) {
    const t = u - e;
    return { s: (vc * t * t) / (2 * a), elan: 0, tassement: 0 };
  }
  if (u < e + a + c) return { s: (vc * a) / 2 + vc * (u - e - a), elan: 0, tassement: 0 };
  if (u < 1 - r) {
    const t = u - (e + a + c);
    return { s: (vc * a) / 2 + vc * c + vc * t - ((vc - ve) * t * t) / (2 * b), elan: 0, tassement: 0 };
  }
  const q = borne01((u - (1 - r)) / r);
  return { s: L + A * Math.sin(Math.PI * q) * (1 - q), elan: 0, tassement: Math.sin(Math.PI * q) };
}

/**
 * Le point à `s` cases le long d'un chemin, et le sens du segment qui le porte.
 * Avant le départ et après l'arrivée, on prolonge le premier et le dernier
 * segment : c'est là que tombent l'élan et le dépassement.
 */
export function pointSurChemin(chemin: readonly Case[], s: number): { x: number; y: number; ux: number; uy: number } {
  const premier = chemin[0] ?? { x: 0, y: 0 };
  let reste = s;
  let dernierU = { x: 1, y: 0 };
  let premierU: { x: number; y: number } | null = null;
  for (let i = 1; i < chemin.length; i++) {
    const a = chemin[i - 1]!;
    const b = chemin[i]!;
    const d = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (d === 0) continue;
    const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    if (!premierU) {
      premierU = u;
      if (reste < 0) return { x: a.x + u.x * reste, y: a.y + u.y * reste, ux: u.x, uy: u.y };
    }
    if (reste <= d) return { x: a.x + u.x * reste, y: a.y + u.y * reste, ux: u.x, uy: u.y };
    reste -= d;
    dernierU = u;
  }
  const fin = chemin[chemin.length - 1] ?? premier;
  return { x: fin.x + dernierU.x * reste, y: fin.y + dernierU.y * reste, ux: dernierU.x, uy: dernierU.y };
}

/** Ce qu'une marche fait voir et entendre, selon ce qui la porte. */
interface ProfilMarche {
  /** Le rebond d'une foulée, en cases de hauteur. */
  rebond: number;
  /** Les rebonds par case, avant le plafond de `MARCHE.foulees`. */
  rebondsParCase: number;
  /** Ce qu'elle laisse derrière elle : poussière, sillage, rien. */
  trace: 'poussiere' | 'foulee' | 'sillage' | null;
  /** Un appareil flotte à son rythme, pas à celui du sol. */
  vol: boolean;
}

function profilMarche(type?: UnitType): ProfilMarche {
  switch (type?.typeMouvement) {
    case 'pied':
    case 'bottes':
      return { rebond: 0.045, rebondsParCase: 1, trace: 'foulee', vol: false };
    case 'chenilles':
      return { rebond: 0.012, rebondsParCase: 3, trace: 'poussiere', vol: false };
    case 'air':
      return { rebond: 0.03, rebondsParCase: 0, trace: null, vol: true };
    case 'mer':
    case 'amphibie':
      return { rebond: 0.018, rebondsParCase: 0.5, trace: 'sillage', vol: false };
    default:
      return { rebond: 0.008, rebondsParCase: 1.5, trace: 'poussiere', vol: false };
  }
}

/** La couleur d'une poussière soulevée. */
const POUSSIERE: Rvb = [0.87, 0.8, 0.64];
const ECUME: Rvb = [0.93, 0.97, 1];

const glisser: Executant<'glisser'> = (g, ctx) => {
  if (g.chemin.length < 2) return null;
  const fin = g.chemin[g.chemin.length - 1]!;
  const longueur = longueurChemin(g.chemin);
  const v = ctx.visuels.visuel(g.unite);
  const piste = new Piste(v);
  let type: UnitType | undefined;
  let profil: ProfilMarche | null = null;
  let traces = 0;
  let pasSonore = -1;
  const lire = (): ProfilMarche => {
    if (profil) return profil;
    type = typeDe(ctx, uniteConnue(ctx, g.unite));
    profil = profilMarche(type);
    return profil;
  };
  const poser = (s: number): { x: number; y: number; ux: number; uy: number } => {
    const point = pointSurChemin(g.chemin, s);
    // Le décalage se compte depuis la case où l'unité est **dessinée** : celle
    // de l'état — l'arrivée —, ou celle d'une unité retenue.
    const base = ctx.visuels.retenue(g.unite) ?? fin;
    piste.dx = point.x - base.x;
    piste.dy = point.y - base.y;
    piste.orientation = orientationVers(point.ux, point.uy, piste.orientation ?? 'droite');
    return point;
  };
  return {
    // En attendant son départ, l'unité reste au début de son chemin : l'état la
    // pose déjà à l'arrivée, et elle y paraîtrait avant d'avoir marché.
    attente: () => {
      poser(0);
      piste.appliquer(ctx.temps());
    },
    avancer: (p) => {
      const pm = lire();
      const ms = p * g.duree;
      const { s, elan, tassement } = mouvementGlisse(ms, g.duree, longueur);
      const point = poser(s);
      const dedans = borne01(Math.min(s / 0.3, (longueur - s) / 0.3));
      const vitesse = g.duree > 0 ? (longueur * 1000) / g.duree : 0;
      const parCase = Math.min(pm.rebondsParCase, vitesse > 0 ? MARCHE.foulees / vitesse : 0);
      const foulee = pm.vol
        ? pm.rebond * Math.sin((2 * Math.PI * ms) / 650)
        : pm.rebond * Math.abs(Math.sin(Math.PI * parCase * Math.max(0, s))) * dedans;
      piste.dh = foulee - MARCHE.enfoncement * (tassement + elan * 0.6);
      piste.echelle = 1 - MARCHE.tassement * tassement - 0.035 * elan;
      clipDe(piste, 'deplacement', Math.max(0, s) * MARCHE.msClipParCase);
      piste.appliquer(ctx.temps());
      // Le bruit de la marche, par pas, là où on la voit.
      const pas = Math.floor(ms / MARCHE.msPasSonore);
      const ici = { x: Math.floor(point.x + 0.5), y: Math.floor(point.y + 0.5) };
      if (pas !== pasSonore && p < 1) {
        pasSonore = pas;
        jouerSon(ctx, sonDeplacement(type?.typeMouvement), ici);
      }
      // Ce qu'elle laisse derrière elle, tous les tant de cases.
      if (pm.trace && anime(ctx, g.duree) && p < 1 && s > 0 && s < longueur) {
        const pasTrace = pm.trace === 'foulee' ? 1 : pm.trace === 'sillage' ? 0.4 : 0.5;
        const n = Math.floor(s / pasTrace);
        if (n > traces && ctx.visible(ici)) {
          traces = n;
          const x = point.x + 0.5 - point.ux * 0.28;
          const y = point.y + 0.5 - point.uy * 0.28;
          if (pm.trace === 'sillage') {
            emettre(ctx, { genre: 'anneau', x, y, duree: 520, taille: 0.16, tailleFin: 0.6, opacite: 0.45, couleur: ECUME });
          } else {
            const petite = pm.trace === 'foulee';
            emettre(ctx, {
              genre: 'poussiere', x, y, h: 0.02, vh: 0.12, duree: petite ? 320 : 460,
              taille: petite ? 0.1 : 0.16, tailleFin: petite ? 0.24 : 0.42, opacite: petite ? 0.22 : 0.32, couleur: POUSSIERE,
            });
          }
        }
      }
    },
    terminer: () => {
      // Une unité retenue reste où elle est arrivée : c'est de là qu'elle sortira.
      ctx.visuels.poserRetenue(g.unite, fin);
      piste.fermer(ctx.temps());
    },
  };
};

// ---------------------------------------------------------------------------
// 4. Le tir et le coup
// ---------------------------------------------------------------------------

/** Ce qu'un tir sait de lui-même, lu au départ. */
interface InfoTir {
  profil: ProfilTir;
  tireur?: UnitType;
  cible?: UnitType;
  orientation: Orientation;
}

/** Le recul, en cases, par profil : le canon cogne, le missile pousse, la mitrailleuse tressaute. */
const RECUL: Readonly<Record<ProfilTir, number>> = { marqueur: 0.07, cloche: 0.1, missile: 0.035, rafale: 0.03 };
/** Les coups d'une rafale, en part du geste. */
const COUPS_RAFALE = [0, 0.16, 0.32] as const;

/** Une impulsion de recul : un coup sec en `montee` ms, un retour qui freine. */
function impulsion(ms: number, montee: number, retour: number): number {
  if (ms < 0) return 0;
  if (ms < montee) return ms / montee;
  const q = (ms - montee) / Math.max(1, retour);
  return q >= 1 ? 0 : (1 - q) * (1 - q);
}

/** Les effets d'un tir, jetés à son départ : ils arrivent sur la cible à l'heure du coup. */
function emettreTir(ctx: ContexteAnimation2d, g: Extract<Geste, { genre: 'tirer' }>, info: InfoTir, ms0: number): void {
  const u = direction(g.depuis, g.vers);
  const ux = u.x === 0 && u.y === 0 ? (info.orientation === 'gauche' ? -1 : 1) : u.x;
  const uy = u.y;
  const bouche = { x: g.depuis.x + 0.5 + ux * 0.3, y: g.depuis.y + 0.5 + uy * 0.3, h: hauteurImpact(info.tireur) };
  const cible = { x: g.vers.x + 0.5 - ux * 0.2, y: g.vers.y + 0.5 - uy * 0.2, h: hauteurImpact(info.cible) };
  const reste = Math.max(1, g.duree - ms0);
  const distance = Math.hypot(cible.x - bouche.x, cible.y - bouche.y);
  const eclairBouche = (retard: number, force: number): void => {
    if (!ctx.visible(g.depuis)) return;
    emettre(ctx, { genre: 'eclair', ...bouche, retard, duree: Math.min(110, reste), taille: 0.42 * force, tailleFin: 0.16, couleur: [1, 0.9, 0.62] });
    emettre(ctx, { genre: 'etoile', ...bouche, retard, duree: Math.min(70, reste), taille: 0.3 * force, tailleFin: 0.1 });
  };
  switch (info.profil) {
    case 'rafale':
      for (const part of COUPS_RAFALE) {
        const retard = Math.max(0, part * g.duree - ms0);
        eclairBouche(retard, part === 0 ? 1 : 0.8);
        emettre(ctx, { genre: 'trait', ...bouche, vers: cible, retard, duree: Math.max(1, reste - retard), taille: 0.3, couleur: [1, 0.9, 0.55] });
      }
      break;
    case 'marqueur':
      eclairBouche(0, 1.1);
      emettre(ctx, { genre: 'trait', ...bouche, vers: cible, duree: reste, taille: 0.45, couleur: [1, 0.93, 0.7] });
      break;
    case 'cloche': {
      // Un appareil lâche sa bombe : elle tombe, elle ne monte pas.
      const aerien = info.tireur?.domaine === 'air';
      const arc = aerien ? 0 : 0.55 + 0.1 * distance;
      eclairBouche(0, 1.3);
      emettre(ctx, { genre: 'obus', ...bouche, vers: cible, arc, duree: reste, taille: 0.15 });
      for (let i = 1; i <= 6; i++) {
        const t = i / 7;
        emettre(ctx, {
          genre: 'fumee', variante: i, x: bouche.x + (cible.x - bouche.x) * t, y: bouche.y + (cible.y - bouche.y) * t,
          h: bouche.h + (cible.h - bouche.h) * t + 4 * arc * t * (1 - t), retard: reste * t, duree: 300,
          taille: 0.08, tailleFin: 0.18, opacite: 0.28, vh: 0.1, couleur: [0.86, 0.86, 0.87],
        });
      }
      if (!aerien && ctx.visible(g.depuis)) {
        emettre(ctx, {
          genre: 'fumee', variante: 1, ...bouche, vx: ux * 0.3, vy: uy * 0.3, vh: 0.25, amorti: 2, duree: 600,
          taille: 0.25, tailleFin: 0.6, opacite: 0.4,
        });
        emettre(ctx, {
          genre: 'poussiere', x: g.depuis.x + 0.5, y: g.depuis.y + 0.5, h: 0.02, vh: 0.1, duree: 420,
          taille: 0.3, tailleFin: 0.7, opacite: 0.35, couleur: POUSSIERE,
        });
      }
      break;
    }
    case 'missile': {
      const arc = Math.min(0.5, 0.15 * distance);
      emettre(ctx, { genre: 'missile', ...bouche, vers: cible, arc, duree: reste, taille: 0.34 });
      for (let i = 1; i <= 8; i++) {
        const t = i / 9;
        emettre(ctx, {
          genre: 'fumee', variante: i, x: bouche.x + (cible.x - bouche.x) * t, y: bouche.y + (cible.y - bouche.y) * t,
          h: bouche.h + (cible.h - bouche.h) * t + 4 * arc * t * (1 - t), retard: reste * t, duree: 380,
          taille: 0.1, tailleFin: 0.26, opacite: 0.35, couleur: [0.9, 0.9, 0.91],
        });
      }
      if (ctx.visible(g.depuis)) {
        emettre(ctx, {
          genre: 'fumee', variante: 2, ...bouche, vx: -ux * 0.6, vy: -uy * 0.6, amorti: 3, duree: 520,
          taille: 0.2, tailleFin: 0.55, opacite: 0.4,
        });
        emettre(ctx, { genre: 'eclair', ...bouche, duree: Math.min(120, reste), taille: 0.35, tailleFin: 0.15, couleur: [1, 0.78, 0.45] });
      }
      break;
    }
    default:
      break;
  }
}

const tirer: Executant<'tirer'> = (g, ctx) => {
  const v = ctx.visuels.visuel(g.unite);
  const piste = new Piste(v);
  let info: InfoTir | null = null;
  let emis = false;
  let coupsSonores = 0;
  const lire = (): InfoTir => {
    if (info) return info;
    const tireur = uniteConnue(ctx, g.unite);
    const cible = uniteSurCase(ctx, g.vers);
    const dx = g.vers.x - g.depuis.x;
    // Trois vues cuites, et le tir n'est cuit que de trois quarts : on tire vers
    // la gauche ou la droite, jamais de dos — comme dans Advance Wars.
    const orientation: Orientation = dx > 0 ? 'droite' : dx < 0 ? 'gauche' : tireur ? orientationRepos(tireur.camp) : 'droite';
    const tt = typeDe(ctx, tireur);
    info = { profil: profilTir(tt, typeDe(ctx, cible)), tireur: tt, cible: typeDe(ctx, cible), orientation };
    return info;
  };
  return {
    avancer: (p) => {
      const i = lire();
      const ms = p * g.duree;
      if (!emis && anime(ctx, g.duree) && p < 1) {
        emis = true;
        emettreTir(ctx, g, i, ms);
      }
      // Le son de chaque coup, calé sur son départ : trois pour une rafale — un
      // seul quand la partition ne dure pas, trois d'un coup ne font qu'un bruit.
      const coups = i.profil === 'rafale' && g.duree > 0 ? COUPS_RAFALE.filter((c) => ms >= c * g.duree).length : 1;
      while (coupsSonores < coups) {
        coupsSonores += 1;
        jouerSon(ctx, i.profil === 'rafale' ? 'rafale' : i.profil === 'missile' ? 'missile' : 'canon', g.depuis);
      }
      let recul = 0;
      if (i.profil === 'rafale') {
        for (const c of COUPS_RAFALE) recul = Math.max(recul, impulsion(ms - c * g.duree, 25, 60));
      } else {
        recul = impulsion(ms, 35, Math.max(60, g.duree * 0.8 - 35));
      }
      const u = direction(g.depuis, g.vers);
      const k = RECUL[i.profil] * recul;
      piste.dx = -u.x * k;
      piste.dy = -u.y * k;
      piste.orientation = i.orientation;
      clipDe(piste, 'tir', ms);
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

/** L'impact d'un coup : une étoile tenue pendant l'arrêt sur image, puis étincelles, fumée, anneau. */
function emettreImpact(ctx: ContexteAnimation2d, g: Extract<Geste, { genre: 'encaisser' }>, arret: number, ms0: number): void {
  const type = typeDe(ctx, uniteConnue(ctx, g.unite));
  const u = direction(g.depuis, g.case);
  const force = borne01(g.degats / 60);
  const cx = g.case.x + 0.5;
  const cy = g.case.y + 0.5;
  const h = hauteurImpact(type);
  const point = { x: cx - u.x * 0.22, y: cy - u.y * 0.22, h };
  const tenue = Math.max(0, arret - ms0);
  emettre(ctx, { genre: 'etoile', ...point, tenue, duree: tenue + 120, taille: 0.55 + 0.25 * force, tailleFin: 0.18 });
  emettre(ctx, { genre: 'eclair', ...point, tenue, duree: tenue + 170, taille: 0.8 + 0.3 * force, tailleFin: 1.1, opacite: 0.9, couleur: [1, 0.85, 0.5] });
  const etincelles = 5 + Math.round(4 * force);
  // Sans tireur (un dégât de mécanique), elles partent en gerbe, pas dans le sens d'un coup.
  const base = u.x === 0 && u.y === 0 ? null : Math.atan2(u.y, u.x);
  for (let i = 0; i < etincelles; i++) {
    const t = etincelles > 1 ? i / (etincelles - 1) : 0.5;
    const angle = base === null ? t * Math.PI * 2 : base + (t - 0.5) * 2.1;
    const vitesse = 1.6 + (i % 3) * 0.5;
    emettre(ctx, {
      genre: 'etincelle', ...point, retard: tenue, duree: 260 + (i % 3) * 40,
      vx: Math.cos(angle) * vitesse, vy: Math.sin(angle) * vitesse * 0.7, vh: 1.3 + (i % 2) * 0.7, gravite: 7, sol: 0,
      taille: 0.11, tailleFin: 0.04, couleur: i % 2 === 0 ? [1, 0.95, 0.75] : [1, 0.8, 0.42],
    });
  }
  for (let i = 0; i < 1 + Math.round(force); i++) {
    emettre(ctx, {
      genre: 'fumee', variante: i, ...point, retard: tenue + 20 + i * 40, duree: 520, vx: u.x * 0.2, vy: u.y * 0.2,
      vh: 0.35, amorti: 1.2, taille: 0.25, tailleFin: 0.55, opacite: 0.4,
    });
  }
  emettre(ctx, { genre: 'anneau', x: cx, y: cy, retard: tenue, duree: 260, taille: 0.3, tailleFin: 0.9, opacite: 0.5, couleur: [1, 0.9, 0.7] });
}

const encaisser: Executant<'encaisser'> = (g, ctx) => {
  const v = ctx.visuels.visuel(g.unite);
  const piste = new Piste(v);
  const arret = Math.min(ARRET_IMAGE_MS, g.duree / 2);
  const force = borne01(g.degats / 60);
  const u = direction(g.depuis, g.case);
  let emis = false;
  // Les PV **d'avant le coup**, retenus tant que le geste dure : l'état est en
  // avance, et sans cela la pastille annoncerait la perte avant le tir.
  const retenirPv = (): void => {
    if (piste.pv !== null) return;
    const { precedent } = ctx.etats();
    const unite = precedent ? uniteParId(precedent, g.unite) : null;
    if (unite) piste.pv = pvAffiches(unite.pv);
  };
  return {
    son: { son: 'impact', case: g.case },
    attente: () => {
      retenirPv();
      piste.appliquer(ctx.temps());
    },
    avancer: (p) => {
      retenirPv();
      const ms = p * g.duree;
      if (!emis && anime(ctx, g.duree) && p < 1) {
        emis = true;
        if (ctx.visible(g.case)) {
          emettreImpact(ctx, g, arret, ms);
          ctx.secouer?.(SECOUSSE_COUP.min + (SECOUSSE_COUP.max - SECOUSSE_COUP.min) * force, SECOUSSE_COUP.duree, Math.max(0, arret - ms));
        }
      }
      if (ms < arret) {
        // L'arrêt sur image : blanche, figée, un rien plus grande — le coup porte.
        piste.eclat = 1;
        piste.dx = 0;
        piste.dy = 0;
        piste.dh = 0;
        piste.echelle = 1.05;
        clipDe(piste, 'touche', 0);
      } else {
        const t = ms - arret;
        const reste = Math.max(1, g.duree - arret);
        const amplitude = (0.05 + 0.04 * force) * Math.exp(-t / (reste * 0.3));
        const oscillation = Math.cos((2 * Math.PI * 17 * t) / 1000);
        piste.eclat = borne01(1 - t / (0.45 * reste)) * 0.85;
        if (u.x !== 0 || u.y !== 0) {
          piste.dx = u.x * amplitude * oscillation;
          piste.dy = u.y * amplitude * oscillation;
          piste.dh = 0;
        } else {
          piste.dh = amplitude * 0.6 * Math.abs(oscillation);
        }
        piste.echelle = 1 + 0.05 * Math.exp(-t / 45);
        clipDe(piste, 'touche', t);
      }
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

// ---------------------------------------------------------------------------
// 5. Sortir, paraître, capturer
// ---------------------------------------------------------------------------

/** La part de la sortie où l'unité éclate : d'abord elle chancelle, sur son clip `hors_jeu`. */
const PART_EXPLOSION = 0.35;

/** Une explosion : boule de feu, cœur blanc, gerbe, fumée grise qui monte puis retombe, onde au sol. */
function emettreExplosion(ctx: ContexteAnimation2d, x: number, y: number, h: number, retard: number, force: number): void {
  emettre(ctx, { genre: 'eclair', x, y, h, retard, duree: 360, taille: 0.6 * force, tailleFin: 1.5 * force, montee: 0.1, fin: 0.9, couleur: [1, 0.62, 0.25] });
  emettre(ctx, { genre: 'etoile', x, y, h, retard, duree: 150, taille: 0.9 * force, tailleFin: 0.3 });
  const gerbe = Math.round(6 + 4 * force);
  for (let i = 0; i < gerbe; i++) {
    const angle = (i / gerbe) * Math.PI * 2 + 0.3;
    const vitesse = 1.5 + (i % 3) * 0.6;
    emettre(ctx, {
      genre: 'etincelle', x, y, h, retard, duree: 360 + (i % 4) * 30, vx: Math.cos(angle) * vitesse,
      vy: Math.sin(angle) * vitesse * 0.7, vh: 1.5 + (i % 2), gravite: 6, sol: 0, taille: 0.12, tailleFin: 0.04,
      couleur: i % 2 === 0 ? [1, 0.9, 0.6] : [1, 0.7, 0.35],
    });
  }
  for (let i = 0; i < Math.round(2 + 2 * force); i++) {
    const angle = (i / 4) * Math.PI * 2;
    emettre(ctx, {
      genre: 'fumee', variante: i, x: x + Math.cos(angle) * 0.1, y: y + Math.sin(angle) * 0.08, h: h + 0.05,
      retard: retard + 40 + i * 30, duree: 950, vx: Math.cos(angle) * 0.25, vy: Math.sin(angle) * 0.15, vh: 0.6,
      gravite: 0.55, amorti: 1.4, taille: 0.35, tailleFin: 0.9, opacite: 0.5, montee: 0.15, couleur: [0.66, 0.66, 0.68],
    });
  }
  emettre(ctx, { genre: 'anneau', x, y, retard, duree: 380, taille: 0.4, tailleFin: 1.8 * force, opacite: 0.6, couleur: [1, 0.8, 0.55] });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    emettre(ctx, {
      genre: 'poussiere', x, y, h: 0.03, retard, duree: 500, vx: Math.cos(angle) * 0.8, vy: Math.sin(angle) * 0.55,
      amorti: 3, taille: 0.25, tailleFin: 0.6, opacite: 0.4, couleur: POUSSIERE,
    });
  }
}

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
  const piste = new Piste(v);
  let emis = false;
  let sonJoue = false;
  return {
    attente: retenir,
    avancer: (p) => {
      retenir();
      const ms = p * g.duree;
      if (!emis && anime(ctx, g.duree) && p < 1) {
        emis = true;
        if (ctx.visible(g.case)) {
          const type = typeDe(ctx, uniteConnue(ctx, g.unite));
          const retard = Math.max(0, PART_EXPLOSION * g.duree - ms);
          const force = type ? 0.8 + 0.12 * type.silhouette.taille : 1;
          emettreExplosion(ctx, g.case.x + 0.5, g.case.y + 0.5, hauteurImpact(type) * 0.8, retard, force);
          ctx.secouer?.(SECOUSSE_COUP.max, 320, retard);
        }
      }
      if (!sonJoue && p >= PART_EXPLOSION) {
        sonJoue = true;
        jouerSon(ctx, 'hors_jeu', g.case);
      }
      if (p < PART_EXPLOSION) {
        // Elle chancelle et blanchit par à-coups, avant d'éclater.
        const q = p / PART_EXPLOSION;
        piste.eclat = 0.55 * Math.abs(Math.sin(Math.PI * 3 * q)) * q;
        piste.dx = 0.02 * Math.sin((2 * Math.PI * 28 * ms) / 1000) * q;
        piste.opacite = 1;
        piste.echelle = 1;
        piste.dh = 0;
      } else {
        const q = borne01((p - PART_EXPLOSION) / 0.3);
        piste.eclat = 0;
        piste.dx = 0;
        piste.opacite = 1 - q;
        piste.echelle = 1 - 0.12 * q;
        piste.dh = -0.04 * q;
      }
      clipDe(piste, 'hors_jeu', ms);
      piste.appliquer(ctx.temps());
    },
    terminer: () => {
      piste.fermer(ctx.temps());
      if (retenue) ctx.visuels.liberer(g.unite);
    },
  };
};

/** La part de la production où l'unité touche le sol. */
const PART_ATTERRIT = 0.45;

const apparaitre: Executant<'apparaitre'> = (g, ctx) => {
  // Le geste ne porte que le type et la case : l'unité est celle de l'état qui s'y trouve.
  const trouver = (): Unite | null => ctx.etats().courant?.unites
    .find((u) => u.x === g.case.x && u.y === g.case.y && u.type === g.unite && !u.dansTransport) ?? null;
  let piste: Piste | null = null;
  const pisteDe = (): Piste | null => {
    if (piste) return piste;
    const u = trouver();
    if (!u) return null;
    piste = new Piste(ctx.visuels.visuel(u.id));
    return piste;
  };
  let emis = false;
  return {
    son: { son: 'production', case: g.case },
    attente: () => {
      const pp = pisteDe();
      if (!pp) return;
      pp.opacite = 0;
      pp.appliquer(ctx.temps());
    },
    avancer: (p) => {
      const ms = p * g.duree;
      const cx = g.case.x + 0.5;
      const cy = g.case.y + 0.5;
      if (!emis && anime(ctx, g.duree) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        const couleur = equipeDe(ctx, g.camp);
        emettre(ctx, { genre: 'halo', x: cx, y: cy, duree: Math.max(1, g.duree - ms), taille: 0.35, tailleFin: 1.15, opacite: 0.6, montee: 0.2, couleur });
        const atterrit = Math.max(0, PART_ATTERRIT * g.duree - ms);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + 0.4;
          emettre(ctx, {
            genre: 'poussiere', x: cx + Math.cos(angle) * 0.12, y: cy + Math.sin(angle) * 0.09, h: 0.03, retard: atterrit,
            duree: 450, vx: Math.cos(angle) * 0.7, vy: Math.sin(angle) * 0.5, vh: 0.12, amorti: 3.5,
            taille: 0.2, tailleFin: 0.5, opacite: 0.45, couleur: POUSSIERE,
          });
        }
        emettre(ctx, { genre: 'anneau', x: cx, y: cy, retard: atterrit, duree: 360, taille: 0.3, tailleFin: 1, opacite: 0.6, couleur: melanger(couleur, BLANC, 0.5) });
      }
      const pp = pisteDe();
      if (!pp) return;
      if (p < PART_ATTERRIT) {
        // Elle tombe du bâtiment qui la livre, en accélérant, et prend sa taille.
        const q = p / PART_ATTERRIT;
        pp.dh = 0.35 * (1 - q * q);
        pp.opacite = borne01(q * 2.5);
        pp.echelle = 0.75 + 0.25 * q;
      } else {
        // Elle se pose : un tassement, un rebond qui dépasse, puis rien.
        const q = (p - PART_ATTERRIT) / (1 - PART_ATTERRIT);
        pp.dh = -0.02 * bosse(Math.min(1, q * 2));
        pp.opacite = 1;
        pp.echelle = 1 - 0.09 * Math.sin(2 * Math.PI * q) * (1 - q);
      }
      pp.appliquer(ctx.temps());
    },
    terminer: () => piste?.fermer(ctx.temps()),
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
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  let sonJoue = false;
  return {
    attente: () => {
      lire();
      if (prise && depuis) prise.forcer(depuis);
    },
    avancer: (p) => {
      lire();
      const ms = p * g.duree;
      // Celui qui capture sautille deux fois : il plante ses couleurs.
      piste.dh = p < 0.6 ? 0.05 * Math.abs(Math.sin((Math.PI * 2 * p) / 0.6)) : 0;
      clipDe(piste, 'capture', ms);
      piste.appliquer(ctx.temps());
      const change = depuis !== null && vers !== null && depuis.camp !== null && depuis.camp !== vers.camp;
      if (g.acquis && !sonJoue && p >= (change ? PART_AMENER : 0)) {
        sonJoue = true;
        jouerSon(ctx, 'capture', g.case);
      }
      if (!emis && anime(ctx, g.duree) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        const couleur = equipeDe(ctx, g.camp);
        const mat = { x: g.case.x + PIED_MAT.x, y: g.case.y + PIED_MAT.y };
        if (g.acquis) {
          // Les couleurs arrivent en haut : une gerbe à leur teinte, une onde au pied.
          const sommet = Math.max(0, 0.92 * g.duree - ms);
          emettre(ctx, { genre: 'eclair', ...mat, h: HAUTEUR_MAT, retard: sommet, duree: 260, taille: 0.3, tailleFin: 0.62, couleur: melanger(couleur, BLANC, 0.55) });
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            emettre(ctx, {
              genre: 'scintille', ...mat, h: HAUTEUR_MAT, retard: sommet + i * 25, duree: 420,
              vx: Math.cos(angle) * 0.5, vy: Math.sin(angle) * 0.35, vh: 0.4, gravite: 0.8,
              taille: 0.1, tailleFin: 0.22, couleur: melanger(couleur, BLANC, 0.35),
            });
          }
          emettre(ctx, { genre: 'anneau', x: g.case.x + 0.5, y: g.case.y + 0.5, retard: sommet, duree: 520, taille: 0.4, tailleFin: 1.4, opacite: 0.7, couleur });
        } else {
          emettre(ctx, { genre: 'halo', ...mat, duree: Math.max(1, g.duree - ms), taille: 0.2, tailleFin: 0.55, opacite: 0.55, couleur });
          for (let i = 0; i < 2; i++) {
            emettre(ctx, {
              genre: 'scintille', x: mat.x + (i === 0 ? -0.08 : 0.08), y: mat.y, h: 0.5 + i * 0.2, retard: i * 90, duree: 320,
              vh: 0.35, taille: 0.08, tailleFin: 0.18, couleur: melanger(couleur, BLANC, 0.35),
            });
          }
        }
      }
      if (!prise || !depuis || !vers) return;
      const d: PoseDrapeau = depuis;
      const a: PoseDrapeau = vers;
      if (d.camp === a.camp || d.camp === null) {
        const de = d.camp === a.camp ? d.niveau : 0;
        // Une montée qui freine en haut : le drapeau arrive, il ne cogne pas le pommeau.
        prise.forcer({ camp: a.camp, niveau: de + (a.niveau - de) * (1 - (1 - p) ** 2) });
      } else if (p < PART_AMENER) {
        // Les couleurs d'avant descendent d'abord…
        prise.forcer({ camp: d.camp, niveau: d.niveau * (1 - p / PART_AMENER) });
      } else {
        // … puis les nouvelles montent.
        const q = (p - PART_AMENER) / (1 - PART_AMENER);
        prise.forcer({ camp: a.camp, niveau: a.niveau * (1 - (1 - q) ** 2) });
      }
    },
    terminer: () => {
      prise?.relacher();
      piste.fermer(ctx.temps());
    },
  };
};

// ---------------------------------------------------------------------------
// 6. Bâtir, remettre, ravitailler, réparer
// ---------------------------------------------------------------------------

/** Une caisse lancée d'un point à un autre, en cloche, et la poussière qu'elle soulève en tombant. */
function lancerCaisse(
  ctx: ContexteAnimation2d, de: { x: number; y: number; h: number }, vers: { x: number; y: number; h: number },
  retard: number, duree: number, arc: number, poussiere: boolean,
): void {
  emettre(ctx, { genre: 'caisse', ...de, vers, arc, retard, duree, taille: 0.2, fin: 0.1 });
  if (!poussiere) return;
  emettre(ctx, {
    genre: 'poussiere', x: vers.x, y: vers.y, h: 0.02, retard: retard + duree, duree: 360, vh: 0.12,
    taille: 0.14, tailleFin: 0.34, opacite: 0.4, couleur: POUSSIERE,
  });
}

const batir: Executant<'batir'> = (g, ctx) => {
  let emis = false;
  return {
    son: { son: 'production', case: g.case },
    avancer: (p) => {
      if (emis || !anime(ctx, g.duree) || p >= 1 || !ctx.visible(g.case)) return;
      emis = true;
      const ms = p * g.duree;
      const D = g.duree;
      const cx = g.case.x + 0.5;
      const cy = g.case.y + 0.5;
      const coins = [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]] as const;
      coins.forEach(([ox, oy], i) => {
        emettre(ctx, {
          genre: 'poussiere', x: cx + ox, y: cy + oy, h: 0.03, retard: Math.max(0, i * 0.08 * D - ms), duree: 0.5 * D,
          vh: 0.15, taille: 0.3, tailleFin: 0.7, opacite: 0.5, couleur: POUSSIERE,
        });
      });
      if (g.terrain !== null) {
        // Une pose : des caisses arrivent, puis tout s'éclaire.
        coins.slice(0, 3).forEach(([ox, oy], i) => {
          lancerCaisse(
            ctx, { x: cx + ox * 4.4, y: cy + oy * 4, h: 0.1 }, { x: cx + ox * 0.8, y: cy + oy * 0.7, h: 0.04 },
            Math.max(0, i * 0.12 * D - ms), 0.28 * D, 0.6, true,
          );
        });
        const lumiere = Math.max(0, 0.65 * D - ms);
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + 0.6;
          emettre(ctx, {
            genre: 'scintille', x: cx + Math.cos(angle) * 0.3, y: cy + Math.sin(angle) * 0.22, h: 0.2 + (i % 2) * 0.25,
            retard: lumiere + i * 40, duree: 380, vh: 0.3, taille: 0.1, tailleFin: 0.24, couleur: [1, 0.95, 0.75],
          });
        }
        emettre(ctx, { genre: 'anneau', x: cx, y: cy, retard: lumiere, duree: 420, taille: 0.4, tailleFin: 1.2, opacite: 0.6 });
      } else {
        // Un retrait : de la fumée grise qui monte et se défait.
        for (let i = 0; i < 2; i++) {
          emettre(ctx, {
            genre: 'fumee', variante: i, x: cx + (i === 0 ? -0.15 : 0.15), y: cy, h: 0.1, retard: Math.max(0, 0.2 * D - ms) + i * 80,
            duree: 0.6 * D, vh: 0.4, amorti: 1, taille: 0.3, tailleFin: 0.75, opacite: 0.45,
          });
        }
        emettre(ctx, { genre: 'anneau', x: cx, y: cy, retard: Math.max(0, 0.2 * D - ms), duree: 380, taille: 0.4, tailleFin: 1.3, opacite: 0.5, couleur: POUSSIERE });
      }
    },
  };
};

/** La part de la remise en service où les lumières reviennent. */
const PART_LUMIERE = 0.55;

const remettre: Executant<'remettre'> = (g, ctx) => {
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  let sonJoue = false;
  return {
    avancer: (p) => {
      const ms = p * g.duree;
      const D = g.duree;
      const cx = g.case.x + 0.5;
      const cy = g.case.y + 0.5;
      if (!emis && anime(ctx, D) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        // Les travaux : de la poussière aux quatre coins, deux planches qui volent.
        [[-0.3, -0.22], [0.3, -0.22], [-0.3, 0.22], [0.3, 0.22]].forEach(([ox, oy], i) => {
          emettre(ctx, {
            genre: 'poussiere', x: cx + ox!, y: cy + oy!, h: 0.03, retard: Math.max(0, i * 0.1 * D - ms), duree: 0.45 * D,
            vh: 0.18, taille: 0.28, tailleFin: 0.65, opacite: 0.5, couleur: POUSSIERE,
          });
        });
        for (let i = 0; i < 2; i++) {
          emettre(ctx, {
            genre: 'caisse', x: cx, y: cy, h: 0.3, retard: Math.max(0, 0.15 * D - ms) + i * 60, duree: 0.4 * D,
            vx: i === 0 ? -0.8 : 0.8, vy: 0.1, vh: 1.6, gravite: 5.5, sol: 0.02, taille: 0.16, fin: 0.25,
          });
        }
        // Puis les lumières reviennent.
        const lumiere = Math.max(0, PART_LUMIERE * D - ms);
        emettre(ctx, { genre: 'eclair', x: cx, y: cy, h: 0.45, retard: lumiere, duree: 0.35 * D, taille: 0.8, tailleFin: 1.4, opacite: 0.8, montee: 0.15, couleur: [1, 0.88, 0.55] });
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2 + 0.2;
          emettre(ctx, {
            genre: 'scintille', x: cx + Math.cos(angle) * 0.34, y: cy + Math.sin(angle) * 0.25, h: 0.3 + (i % 3) * 0.15,
            retard: lumiere + i * 45, duree: 420, vh: 0.25, taille: 0.1, tailleFin: 0.24, couleur: [1, 0.93, 0.7],
          });
        }
        emettre(ctx, { genre: 'anneau', x: cx, y: cy, retard: lumiere, duree: 0.4 * D, taille: 0.5, tailleFin: 1.5, opacite: 0.7, couleur: equipeDe(ctx, g.camp) });
      }
      if (!sonJoue && p >= PART_LUMIERE) {
        sonJoue = true;
        jouerSon(ctx, 'capture', g.case);
      }
      piste.dh = p < PART_LUMIERE ? 0.04 * Math.abs(Math.sin((Math.PI * 3 * p) / PART_LUMIERE)) : 0;
      clipDe(piste, 'capture', ms);
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

const ravitailler: Executant<'ravitailler'> = (g, ctx) => {
  const piste = new Piste(ctx.visuels.visuel(g.cible));
  /** Les instants où une caisse touche la cible, en ms de geste. */
  const arrivees: number[] = [];
  let emis = false;
  return {
    avancer: (p) => {
      const ms = p * g.duree;
      const D = g.duree;
      if (!emis && anime(ctx, D) && p < 1) {
        emis = true;
        const tx = g.case.x + 0.5;
        const ty = g.case.y + 0.5;
        const fournisseur = uniteConnue(ctx, g.unite);
        if (ctx.visible(g.case)) {
          emettre(ctx, { genre: 'halo', x: tx, y: ty, duree: Math.max(1, D - ms), taille: 0.4, tailleFin: 1, opacite: 0.45, couleur: [0.78, 0.9, 1] });
        }
        for (let i = 0; i < 3; i++) {
          const depart = Math.max(0, i * 0.15 * D - ms);
          const vol = 0.4 * D;
          arrivees.push(ms + depart + vol);
          if (!fournisseur) continue;
          lancerCaisse(
            ctx, { x: fournisseur.x + 0.5, y: fournisseur.y + 0.5, h: 0.35 }, { x: tx + (i - 1) * 0.15, y: ty, h: 0.3 },
            depart, vol, 0.45, false,
          );
          emettre(ctx, {
            genre: 'scintille', x: tx + (i - 1) * 0.15, y: ty, h: 0.35, retard: depart + vol, duree: 240, vh: 0.3,
            taille: 0.14, tailleFin: 0.28, couleur: [0.85, 0.93, 1],
          });
        }
      }
      // La cible s'allume un instant à chaque caisse reçue.
      let eclat = 0;
      for (const t of arrivees) eclat = Math.max(eclat, 0.35 * bosse((ms - t) / 180));
      piste.eclat = eclat;
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

/** Un tirage déterministe dans [0, 1[, d'après un identifiant : les scintillements d'une unité ne tombent pas partout au même endroit. */
function hasard(texte: string, k: number): number {
  let h = 2166136261 ^ k;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

const reparer: Executant<'reparer'> = (g, ctx) => {
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  return {
    avancer: (p) => {
      const ms = p * g.duree;
      const D = g.duree;
      if (!emis && anime(ctx, D) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        const cx = g.case.x + 0.5;
        const cy = g.case.y + 0.5;
        emettre(ctx, { genre: 'halo', x: cx, y: cy, duree: Math.max(1, D - ms), taille: 0.4, tailleFin: 1, opacite: 0.5, montee: 0.3, couleur: [0.55, 0.95, 0.65] });
        for (let i = 0; i < 6; i++) {
          emettre(ctx, {
            genre: 'scintille', x: cx + (hasard(g.unite, i) - 0.5) * 0.6, y: cy + (hasard(g.unite, i + 10) - 0.5) * 0.4,
            h: 0.1 + hasard(g.unite, i + 20) * 0.45, retard: Math.max(0, i * 0.08 * D - ms), duree: 320, vh: 0.35,
            taille: 0.08, tailleFin: 0.22, montee: 0.5, fin: 0.5, couleur: [0.8, 1, 0.86],
          });
        }
      }
      // Deux bouffées de vie : l'unité s'éclaire doucement et se redresse.
      const pouls = bosse(p / 0.45) ** 2 + bosse((p - 0.4) / 0.45) ** 2;
      piste.eclat = 0.3 * pouls;
      piste.echelle = 1 + 0.03 * pouls;
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

// ---------------------------------------------------------------------------
// 7. Les armes de la faction : frapper, désigner, sceller
// ---------------------------------------------------------------------------

/** Une petite explosion de missile sur une case. */
function emettreFrappe(ctx: ContexteAnimation2d, x: number, y: number, retard: number): void {
  emettre(ctx, { genre: 'eclair', x, y, h: 0.12, retard, duree: 300, taille: 0.45, tailleFin: 0.95, couleur: [1, 0.66, 0.3] });
  emettre(ctx, { genre: 'etoile', x, y, h: 0.15, retard, duree: 120, taille: 0.5, tailleFin: 0.15 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.5;
    emettre(ctx, {
      genre: 'etincelle', x, y, h: 0.15, retard, duree: 300, vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1,
      vh: 1.4, gravite: 6, sol: 0, taille: 0.1, tailleFin: 0.04, couleur: [1, 0.85, 0.5],
    });
  }
  emettre(ctx, {
    genre: 'fumee', variante: Math.round(x + y), x, y, h: 0.15, retard: retard + 30, duree: 700, vh: 0.35, amorti: 1.5,
    taille: 0.25, tailleFin: 0.6, opacite: 0.42, couleur: [0.7, 0.7, 0.72],
  });
  emettre(ctx, { genre: 'anneau', x, y, retard, duree: 320, taille: 0.3, tailleFin: 1.1, opacite: 0.6, couleur: [1, 0.8, 0.55] });
}

const frapper: Executant<'frapper'> = (g, ctx) => {
  let emis = false;
  let premier = Infinity;
  let sonImpact = false;
  return {
    son: { son: 'missile', case: g.centre },
    avancer: (p) => {
      const ms = p * g.duree;
      if (!emis && anime(ctx, g.duree) && p < 1) {
        emis = true;
        const etat = ctx.etats().courant;
        const cases = casesDuRayon(g.centre, g.rayon)
          .filter((c) => !etat || (c.x >= 0 && c.y >= 0 && c.x < etat.largeur && c.y < etat.hauteur));
        const reste = Math.max(1, g.duree - ms);
        const chute = Math.max(1, 0.3 * reste);
        let dernier = 0;
        cases.forEach((c, k) => {
          const retard = (k / Math.max(1, cases.length)) * reste * 0.55;
          premier = Math.min(premier, ms + retard + chute);
          dernier = Math.max(dernier, retard + chute);
          if (!ctx.visible(c)) return;
          const x = c.x + 0.5;
          const y = c.y + 0.5;
          const haut = { x: x + 0.9, y: y - 0.6, h: 3.2 };
          emettre(ctx, { genre: 'missile', ...haut, vers: { x, y, h: 0.05 }, retard, duree: chute, taille: 0.32 });
          for (let i = 1; i <= 3; i++) {
            const t = i / 4;
            emettre(ctx, {
              genre: 'fumee', variante: i + k, x: haut.x + (x - haut.x) * t, y: haut.y + (y - haut.y) * t, h: haut.h + (0.05 - haut.h) * t,
              retard: retard + chute * t, duree: 260, taille: 0.1, tailleFin: 0.24, opacite: 0.3, couleur: [0.9, 0.9, 0.91],
            });
          }
          emettreFrappe(ctx, x, y, retard + chute);
        });
        if (cases.some((c) => ctx.visible(c))) {
          const debut = Math.max(0, premier - ms);
          ctx.secouer?.(3.5, Math.max(260, dernier - debut + 260), debut);
        }
      }
      if (!sonImpact && ms >= premier) {
        sonImpact = true;
        jouerSon(ctx, 'impact', g.centre);
      }
    },
  };
};

/** La part du rayon passée à verrouiller la cible, avant que le trait tombe. */
const PART_VERROU = 0.4;
const ORANGE: Rvb = [1, 0.58, 0.24];

const designer: Executant<'designer'> = (g, ctx) => {
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  let sonJoue = false;
  return {
    avancer: (p) => {
      const ms = p * g.duree;
      const D = g.duree;
      if (!emis && anime(ctx, D) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        const h = hauteurImpact(typeDe(ctx, uniteConnue(ctx, g.unite)));
        const x = g.case.x + 0.5;
        const y = g.case.y + 0.5;
        const verrou = Math.max(0, PART_VERROU * D - ms);
        // Le réticule se referme sur la cible…
        emettre(ctx, { genre: 'reticule', x, y, h, duree: verrou + 0.35 * D, taille: 1.3, tailleFin: 0.62, montee: 0.1, fin: 0.3, couleur: ORANGE });
        // … puis le trait tombe du ciel, et la touche.
        emettre(ctx, { genre: 'rayon', x, y, retard: verrou, duree: 0.5 * D, taille: 0.55, tailleFin: 1.05, opacite: 0.9, montee: 0.15, fin: 0.5, couleur: [1, 0.5, 0.2] });
        emettre(ctx, { genre: 'rayon', x, y, retard: verrou, duree: 0.45 * D, taille: 0.25, tailleFin: 0.45, montee: 0.15, fin: 0.5, couleur: [1, 0.95, 0.85] });
        emettre(ctx, { genre: 'eclair', x, y, h, retard: verrou, duree: 0.35 * D, taille: 0.5, tailleFin: 0.95, couleur: [1, 0.7, 0.35] });
        emettre(ctx, { genre: 'anneau', x, y, retard: verrou, duree: 0.4 * D, taille: 0.3, tailleFin: 1, opacite: 0.75, couleur: ORANGE });
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          emettre(ctx, {
            genre: 'etincelle', x, y, h, retard: verrou, duree: 260, vx: Math.cos(angle) * 1.3, vy: Math.sin(angle) * 0.9,
            vh: 1.1, gravite: 6, sol: 0, taille: 0.1, tailleFin: 0.04, couleur: [1, 0.75, 0.4],
          });
        }
        ctx.secouer?.(1.5, 180, verrou);
      }
      if (!sonJoue && p >= PART_VERROU) {
        sonJoue = true;
        jouerSon(ctx, 'rafale', g.case);
      }
      piste.eclat = p < PART_VERROU ? 0.15 * (p / PART_VERROU) : 0.65 * (1 - (p - PART_VERROU) / (1 - PART_VERROU));
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

/** La part de l'impulsion où l'anneau s'est refermé. */
const PART_FERMEE = 0.75;
const CYAN: Rvb = [0.55, 0.9, 1];
/** La teinte d'une pièce dont le moteur vient de s'arrêter. */
const TEINTE_FIGEE: Rvb = [0.62, 0.86, 1];

const sceller: Executant<'sceller'> = (g, ctx) => {
  let pistes: { piste: Piste; case: Case }[] | null = null;
  const lire = (): { piste: Piste; case: Case }[] => {
    if (pistes) return pistes;
    const etat = ctx.etats().courant;
    const cat = ctx.catalogue();
    // Ce qui a un moteur, dans le rayon : c'est ce que l'impulsion fige.
    pistes = (etat?.unites ?? [])
      .filter((u) => !u.dansTransport && manhattan(u, g.centre) <= g.rayon)
      .filter((u) => {
        const t = cat?.unites[u.type];
        return t ? TYPES_MOUVEMENT_MOTEUR.includes(t.typeMouvement) : false;
      })
      .map((u) => ({ piste: new Piste(ctx.visuels.visuel(u.id)), case: { x: u.x, y: u.y } }));
    return pistes;
  };
  let emis = false;
  return {
    son: { son: 'pouvoir', case: g.centre },
    avancer: (p) => {
      const ms = p * g.duree;
      const D = g.duree;
      const touchees = lire();
      if (!emis && anime(ctx, D) && p < 1) {
        emis = true;
        const x = g.centre.x + 0.5;
        const y = g.centre.y + 0.5;
        const ferme = Math.max(1, PART_FERMEE * D - ms);
        const large = 2 * g.rayon + 1.3;
        if (ctx.visible(g.centre)) {
          emettre(ctx, { genre: 'anneau', x, y, duree: ferme, taille: large, tailleFin: 0.35, opacite: 0.9, montee: 0.05, fin: 0.15, couleur: CYAN });
          emettre(ctx, { genre: 'anneau', x, y, retard: 70, duree: Math.max(1, ferme - 70), taille: large - 0.3, tailleFin: 0.3, opacite: 0.5, montee: 0.05, fin: 0.15, couleur: CYAN });
          emettre(ctx, { genre: 'halo', x, y, retard: ferme, duree: 0.25 * D, taille: 0.4, tailleFin: large - 0.3, opacite: 0.55, couleur: CYAN });
          emettre(ctx, { genre: 'eclair', x, y, h: 0.3, retard: ferme, duree: 200, taille: 0.6, tailleFin: 1.2, couleur: CYAN });
          ctx.secouer?.(2, 220, ferme);
        }
        for (const t of touchees) {
          if (!ctx.visible(t.case)) continue;
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + t.case.x;
            emettre(ctx, {
              genre: 'etincelle', x: t.case.x + 0.5 + Math.cos(angle) * 0.2, y: t.case.y + 0.5 + Math.sin(angle) * 0.15,
              h: 0.3, retard: ferme + i * 40, duree: 180, vh: 0.8, gravite: 4, taille: 0.09, tailleFin: 0.03, couleur: CYAN,
            });
          }
        }
      }
      // Une fois l'anneau refermé, les moteurs s'arrêtent : les pièces bleuissent.
      const q = borne01((p - PART_FERMEE) / 0.1);
      for (const t of touchees) {
        t.piste.teinte = q > 0 ? melanger(BLANC, TEINTE_FIGEE, q) : null;
        t.piste.eclat = 0.5 * bosse((p - PART_FERMEE) / 0.25);
        t.piste.appliquer(ctx.temps());
      }
    },
    terminer: () => {
      for (const t of pistes ?? []) t.piste.fermer(ctx.temps());
    },
  };
};

// ---------------------------------------------------------------------------
// 8. Le pouvoir
// ---------------------------------------------------------------------------

/** La vague d'un pouvoir : quand elle part, combien de temps elle balaie, quand part la seconde d'un super. */
export const VAGUE_POUVOIR = Object.freeze({ retard: 150, duree: 1000, seconde: 450, eclat: 650 });

const pouvoir: Executant<'pouvoir'> = (g, ctx) => {
  const superPouvoir = g.niveau === 'super';
  let pret = false;
  let origine = { x: 0, y: 0 };
  let rayon = 1;
  const siennes: { piste: Piste; d: number }[] = [];
  const preparer = (): void => {
    if (pret) return;
    pret = true;
    const etat = ctx.etats().courant;
    if (!etat) return;
    // Depuis le QG du camp ; sans QG, depuis le centre de ses unités ; sans unité, depuis le centre de la carte.
    const cleQg = etat.camps.find((k) => k.id === g.camp)?.qgCase ?? null;
    const unites = etat.unites.filter((u) => u.camp === g.camp && !u.dansTransport);
    if (cleQg) {
      const c = depuisCle(cleQg);
      origine = { x: c.x + 0.5, y: c.y + 0.5 };
    } else if (unites.length > 0) {
      origine = {
        x: unites.reduce((s, u) => s + u.x + 0.5, 0) / unites.length,
        y: unites.reduce((s, u) => s + u.y + 0.5, 0) / unites.length,
      };
    } else {
      origine = { x: etat.largeur / 2, y: etat.hauteur / 2 };
    }
    // Jusqu'au coin le plus lointain : la vague couvre toute la carte.
    for (const [x, y] of [[0, 0], [etat.largeur, 0], [0, etat.hauteur], [etat.largeur, etat.hauteur]] as const) {
      rayon = Math.max(rayon, Math.hypot(x - origine.x, y - origine.y) + 0.8);
    }
    for (const u of unites) siennes.push({ piste: new Piste(ctx.visuels.visuel(u.id)), d: Math.hypot(u.x + 0.5 - origine.x, u.y + 0.5 - origine.y) });
  };
  /** L'instant où le front d'une vague partie à `depart` atteint la distance `d` : l'inverse de sa sortie cubique. */
  const arrivee = (depart: number, d: number): number =>
    depart + VAGUE_POUVOIR.duree * (1 - Math.cbrt(1 - Math.min(1, d / rayon)));
  let lance = false;
  return {
    // Le splash est au HUD ; la carte en joue le son, l'éclat et la vague.
    son: { son: 'pouvoir', case: null },
    avancer: (p) => {
      preparer();
      const ms = p * g.duree;
      if (!lance && anime(ctx, g.duree) && p < 1) {
        lance = true;
        const couleur = equipeDe(ctx, g.camp);
        ctx.superposition?.eclater(melanger(BLANC, couleur, 0.35), superPouvoir ? 0.55 : 0.4, VAGUE_POUVOIR.eclat);
        ctx.superposition?.vague(origine.x, origine.y, couleur, rayon, VAGUE_POUVOIR.duree, Math.max(0, VAGUE_POUVOIR.retard - ms));
        if (superPouvoir) {
          ctx.superposition?.vague(origine.x, origine.y, melanger(couleur, BLANC, 0.3), rayon, VAGUE_POUVOIR.duree, Math.max(0, VAGUE_POUVOIR.seconde - ms));
        }
        ctx.secouer?.(superPouvoir ? 3.5 : 2.5, 420, Math.max(0, VAGUE_POUVOIR.retard - ms));
        emettre(ctx, { genre: 'anneau', ...origine, retard: Math.max(0, VAGUE_POUVOIR.retard - ms), duree: 600, taille: 0.5, tailleFin: 3, opacite: 0.8, couleur: melanger(couleur, BLANC, 0.4) });
      }
      // Chaque unité du camp s'allume et sautille quand la vague la touche.
      for (const s of siennes) {
        let pouls = bosse((ms - arrivee(VAGUE_POUVOIR.retard, s.d)) / 240);
        if (superPouvoir) pouls = Math.max(pouls, bosse((ms - arrivee(VAGUE_POUVOIR.seconde, s.d)) / 240));
        s.piste.eclat = 0.7 * pouls;
        s.piste.dh = 0.07 * pouls;
        s.piste.appliquer(ctx.temps());
      }
    },
    terminer: () => {
      for (const s of siennes) s.piste.fermer(ctx.temps());
    },
  };
};

// ---------------------------------------------------------------------------
// 9. Voile, réveil, surprise, passages, cadrage
// ---------------------------------------------------------------------------

const voile = (montant: boolean) => (g: { unite: string; case: Case; duree: number }, ctx: ContexteAnimation2d): Corps => {
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  return {
    // L'état est en avance : tant que le geste attend, la pièce garde le voile d'avant.
    attente: () => {
      piste.voile = montant ? 0 : 1;
      piste.appliquer(ctx.temps());
    },
    avancer: (p) => {
      if (!emis && anime(ctx, g.duree) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + 0.4;
          emettre(ctx, {
            genre: 'scintille', x: g.case.x + 0.5 + Math.cos(angle) * 0.28, y: g.case.y + 0.5 + Math.sin(angle) * 0.2,
            h: 0.15 + (i % 2) * 0.25, retard: i * 0.12 * g.duree, duree: 300, vh: 0.3, taille: 0.06, tailleFin: 0.16,
            montee: 0.4, fin: 0.6, couleur: [0.85, 0.95, 1],
          });
        }
      }
      piste.voile = montant ? p : 1 - p;
      piste.echelle = 1 - 0.03 * bosse(p);
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

const reveiller: Executant<'reveiller'> = (g, ctx) => {
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  return {
    avancer: (p) => {
      if (!emis && anime(ctx, g.duree) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        const couleur = equipeDe(ctx, g.camp);
        const x = g.case.x + 0.5;
        const y = g.case.y + 0.5;
        emettre(ctx, { genre: 'anneau', x, y, duree: g.duree, taille: 0.35, tailleFin: 1.1, opacite: 0.7, couleur: melanger(couleur, BLANC, 0.4) });
        for (let i = 0; i < 3; i++) {
          emettre(ctx, {
            genre: 'scintille', x: x + (i - 1) * 0.2, y, h: 0.2 + i * 0.12, retard: i * 60, duree: 380, vh: 0.5,
            taille: 0.1, tailleFin: 0.24, couleur: melanger(couleur, BLANC, 0.5),
          });
        }
      }
      piste.eclat = Math.sin(p * Math.PI) * 0.7;
      piste.dh = 0.08 * bosse(p / 0.5);
      piste.echelle = 1 + 0.04 * bosse(p / 0.5);
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

const surprise: Executant<'surprise'> = (g, ctx) => {
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  let emis = false;
  return {
    avancer: (p) => {
      if (!emis && anime(ctx, g.duree) && p < 1 && ctx.visible(g.case)) {
        emis = true;
        const x = g.case.x + 0.5;
        const y = g.case.y + 0.5;
        const pose = Math.max(0, 0.5 * g.duree - p * g.duree);
        for (let i = 0; i < 3; i++) {
          emettre(ctx, {
            genre: 'poussiere', x: x + (i - 1) * 0.15, y: y + 0.05, h: 0.02, retard: pose, duree: 360, vx: (i - 1) * 0.4,
            vh: 0.1, amorti: 3, taille: 0.14, tailleFin: 0.32, opacite: 0.4, couleur: POUSSIERE,
          });
        }
      }
      // Un sursaut : elle bondit, retombe, et tremble un instant.
      piste.dh = Math.sin(Math.min(1, p * 2) * Math.PI) * 0.1;
      piste.eclat = 0.3 * bosse(p / 0.3);
      piste.echelle = 1 + 0.06 * bosse(p / 0.3);
      piste.dx = p > 0.5 ? 0.02 * Math.sin((2 * Math.PI * 24 * p * g.duree) / 1000) * (1 - (p - 0.5) / 0.5) : 0;
      piste.appliquer(ctx.temps());
    },
    terminer: () => piste.fermer(ctx.temps()),
  };
};

/**
 * Un passage d'une case à une autre : embarquer, débarquer, se repousser,
 * fusionner. Jamais en ligne droite sèche : on prend un élan pour monter, on
 * dépasse un rien en descendant, on est poussé en freinant.
 */
type GenrePassage = 'embarquer' | 'debarquer' | 'fusionner' | 'repousser';

/** La part d'un passage parcourue à `p`, selon son genre. */
export function courbePassage(genre: GenrePassage, p: number): number {
  const t = borne01(p);
  switch (genre) {
    case 'embarquer':
    case 'fusionner':
      // Un élan en arrière, puis on rejoint en accélérant.
      return t < 0.2 ? -0.08 * Math.sin((Math.PI * t) / 0.2) : ((t - 0.2) / 0.8) ** 2;
    case 'debarquer': {
      // On sort vite, on dépasse d'un souffle, on se pose.
      const c = 1.4;
      const u = t - 1;
      return 1 + (c + 1) * u * u * u + c * u * u;
    }
    default:
      return 1 - (1 - t) ** 3;
  }
}

const passage = (genre: GenrePassage, options: { retenir: boolean; apparait: boolean; disparait: boolean }) => (
  g: { unite: string; de: Case; vers: Case; duree: number; avec?: string }, ctx: ContexteAnimation2d,
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
  const piste = new Piste(ctx.visuels.visuel(g.unite));
  const partenaire = genre === 'fusionner' && g.avec ? new Piste(ctx.visuels.visuel(g.avec)) : null;
  const distance = Math.abs(g.vers.x - g.de.x) + Math.abs(g.vers.y - g.de.y);
  let emis = false;
  let type: UnitType | undefined;
  // La case d'où l'unité est dessinée : l'arrivée pour une unité de l'état,
  // la sienne pour une unité retenue.
  const origine = (): Case => ctx.visuels.retenue(g.unite) ?? g.vers;
  const poser = (p: number): void => {
    const o = origine();
    const e = courbePassage(genre, p);
    piste.dx = g.de.x + (g.vers.x - g.de.x) * e - o.x;
    piste.dy = g.de.y + (g.vers.y - g.de.y) * e - o.y;
    piste.orientation = orientationVers(g.vers.x - g.de.x, g.vers.y - g.de.y, piste.orientation ?? 'droite');
    if (options.disparait) piste.opacite = 1 - borne01((p - 0.6) / 0.4);
    else if (options.apparait) piste.opacite = borne01(p / 0.35);
    if (genre === 'embarquer') piste.echelle = 1 - 0.3 * borne01((p - 0.5) / 0.5);
    else if (genre === 'fusionner') piste.echelle = 1 - 0.2 * borne01((p - 0.5) / 0.5);
    else if (genre === 'debarquer') piste.echelle = p < 0.5 ? 0.7 + 0.3 * (p / 0.5) : 1 - 0.06 * Math.sin(2 * Math.PI * ((p - 0.5) / 0.5)) * (1 - (p - 0.5) / 0.5);
    else piste.echelle = 1 - 0.07 * bosse((p - 0.75) / 0.25);
    piste.dh = genre === 'repousser' ? 0.12 * Math.sin(Math.PI * Math.min(1, p / 0.8)) : 0;
    clipDe(piste, 'deplacement', Math.max(0, e) * distance * MARCHE.msClipParCase);
  };
  return {
    // Le bruit de ce qui bouge, lu quand le geste part — pas quand il ne dure pas :
    // une marche réduite ne fait pas de bruit de pas, un passage non plus.
    get son() {
      if (g.duree <= 0) return undefined;
      type ??= typeDe(ctx, uniteConnue(ctx, g.unite));
      return { son: sonDeplacement(type?.typeMouvement), case: g.de };
    },
    attente: () => {
      retenir();
      poser(0);
      piste.appliquer(ctx.temps());
    },
    avancer: (p) => {
      retenir();
      type ??= typeDe(ctx, uniteConnue(ctx, g.unite));
      if (!emis && anime(ctx, g.duree) && p < 1) {
        emis = true;
        const ms = p * g.duree;
        const x = g.vers.x + 0.5;
        const y = g.vers.y + 0.5;
        if ((genre === 'debarquer' || genre === 'repousser') && ctx.visible(g.vers) && type?.domaine !== 'air') {
          const pose = Math.max(0, (genre === 'debarquer' ? 0.5 : 0.8) * g.duree - ms);
          for (let i = 0; i < 3; i++) {
            emettre(ctx, {
              genre: 'poussiere', x: x + (i - 1) * 0.16, y: y + 0.04, h: 0.02, retard: pose, duree: 380, vx: (i - 1) * 0.45,
              vh: 0.1, amorti: 3, taille: 0.14, tailleFin: 0.34, opacite: 0.4, couleur: POUSSIERE,
            });
          }
        }
        if (genre === 'fusionner' && ctx.visible(g.vers)) {
          const fin = Math.max(0, 0.85 * g.duree - ms);
          emettre(ctx, { genre: 'eclair', x, y, h: 0.3, retard: fin, duree: 260, taille: 0.5, tailleFin: 0.9, opacite: 0.7 });
          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.3;
            emettre(ctx, {
              genre: 'scintille', x: x + Math.cos(angle) * 0.22, y: y + Math.sin(angle) * 0.16, h: 0.25, retard: fin + i * 30,
              duree: 320, vh: 0.35, taille: 0.1, tailleFin: 0.22,
            });
          }
        }
      }
      poser(p);
      piste.appliquer(ctx.temps());
      if (partenaire) {
        partenaire.eclat = 0.6 * bosse((p - 0.75) / 0.25);
        partenaire.echelle = 1 + 0.05 * bosse((p - 0.75) / 0.25);
        partenaire.appliquer(ctx.temps());
      }
    },
    terminer: () => {
      piste.fermer(ctx.temps());
      partenaire?.fermer(ctx.temps());
      if (retenue) ctx.visuels.liberer(g.unite);
    },
  };
};

const cadrer: Executant<'cadrer'> = (g, ctx) => ({
  avancer: (p) => { if (p >= 1) ctx.cadrer(g.case); },
});

/**
 * La table des exécutants. `duel` et `chiffre` n'en ont pas : l'écran de
 * combat et les chiffres flottants sont au HUD.
 */
export const EXECUTANTS: { readonly [G in GenreGeste]?: Executant<G> } = {
  glisser,
  tirer,
  encaisser,
  sortir,
  hisser,
  remettre,
  batir,
  apparaitre,
  embarquer: passage('embarquer', { retenir: true, apparait: false, disparait: true }),
  debarquer: passage('debarquer', { retenir: false, apparait: true, disparait: false }),
  fusionner: passage('fusionner', { retenir: true, apparait: false, disparait: true }),
  ravitailler,
  reparer,
  repousser: passage('repousser', { retenir: false, apparait: false, disparait: false }),
  pouvoir,
  cadrer,
  voiler: voile(true),
  devoiler: voile(false),
  surprise,
  reveiller,
  frapper,
  designer,
  sceller,
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
