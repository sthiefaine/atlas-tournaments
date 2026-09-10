/**
 * L'**interprète** de la partition (`render/partition.ts`) : chaque geste daté
 * qu'un réalisateur a écrit devient une `Animation` de la boucle
 * (`render/boucle.ts`), qui pousse des translations, des reculs, des secousses,
 * des drapeaux et des effets — jamais un état de jeu.
 *
 * Le principe ne change pas d'un iota (`render/jeu.ts`, `doc/10` §7.3) :
 * **l'état logique est déjà en avance**, une animation n'est qu'un rattrapage
 * visuel. Elle ne décide rien, elle ne peut rien annuler, et si on la coupe la
 * partie reste juste — chaque `terminer` pose l'**état final exact** : cap,
 * position, opacité, drapeau rendu au décor, palissade retirée, effets libérés.
 *
 * Deux règles du contrat sont appliquées ici et nulle part ailleurs :
 *
 * - le `debut` d'un geste est encodé dans la **durée** de son animation, et la
 *   progression est remappée : tant que le geste attend son départ, il ne
 *   touche à rien — ou seulement à ce que `attente` dit (un drapeau tenu où il
 *   était) ; à `p = 0`, un recul vaut zéro mais une secousse est au maximum ;
 * - chaque geste pose le **clip logique** de l'unité (`EtatVisuel.clip`) :
 *   `deplacement` tant qu'elle glisse, `tir`, `touche`, `hors_jeu`, `capture`,
 *   `repos` dès que le geste finit ou qu'on le coupe. Un placeholder l'ignore,
 *   un modèle livré le joue dans son mixer.
 *
 * Ce que l'interprète a besoin de savoir de la partie, il le demande au
 * contexte (`ContexteAnimation.etats`) au moment où le geste **part**, pas
 * quand il est construit : la salve est construite avant ou après que la peau
 * a reçu l'état d'arrivée selon qui joue (le joueur, l'IA), et à la première
 * image la peau a toujours l'état courant et le précédent — c'est là qu'on
 * retrouve une unité qui vient de sortir, ou le drapeau tel qu'il était.
 *
 * `partitionProvisoire` traduit une file d'événements en partition, avec la
 * même mise en scène que l'ancien `construireAnimations` : c'est ce qui tient
 * `Rendu.animer` debout tant que le réalisateur pur (`ecrirePartition`) n'est
 * pas arrivé. Il disparaîtra avec lui.
 */

import * as THREE from 'three/webgpu';

import type { Catalogue, EtatPartie, EvenementJeu, Unite } from '../engine/index';
import { cleCase, depuisCle, pvAffiches, uniteParId, uniteSur } from '../engine/index';
import type { CampId, Case, UnitType } from '../schemas/types';
import { animation, type Animation } from '../render/boucle';
import { cheminEnL, longueurChemin, surChemin } from '../render/chemin';
import { paletteDe } from '../render/palettes';
import { DUREES, dureePartition, type Geste, type Partition } from '../render/partition';
import {
  COULEUR_PLANCHE, PIECES_PALISSADE, poseDrapeau, RAYON_PALISSADE, type PriseChantier, type PriseDrapeau,
} from './decor';
import { emettreTir, emettreImpact, type Effet, type Effets } from './effets';
import { CASE, NIVEAU_EAU } from './geometrie';
import { hauteurSilhouette } from './pieces';
import type { CalqueUnites } from './unites';

/** Durée d'un pas de déplacement, par case traversée — celle du contrat. */
export const MS_PAR_CASE = DUREES.parCase;

/** Part de la capture passée à amener l'ancien drapeau, quand il y en a un. */
const PART_AMENER = 0.38;

/** L'éclat d'un pouvoir : la montée d'exposition, en millisecondes, au début du splash. */
export const MS_ECLAT = 600;

/** Ce que l'éclat ajoute à l'exposition à son sommet : 1 → 1,6 → 1. */
export const ECLAT_MAX = 0.6;

/** Le nombre d'étincelles d'un impact, et ce que les gros dégâts y ajoutent. */
const ETINCELLES_MIN = 5;
const ETINCELLES_MAX = 8;

/** Les deux états que la peau connaît quand un geste part. */
export interface EtatsConnus {
  /** L'état affiché : celui d'arrivée, dès la première image d'un geste. */
  courant: EtatPartie | null;
  /** L'état affiché avant lui : celui d'où la salve est partie. */
  precedent: EtatPartie | null;
}

/** Ce dont les animations ont besoin pour agir sur la scène. */
export interface ContexteAnimation {
  unites: CalqueUnites;
  /** Catalogue courant, sans embarquer le canon dans le rendu. */
  catalogue?(): Catalogue | null;
  /** Le pool d'effets éphémères : éclairs, étincelles, halos, poussière. */
  effets: Effets;
  hauteurEn(x: number, z: number): number;
  /** La prise du drapeau d'une case bâtie, `null` si la case n'en porte pas. */
  drapeau(cle: string): PriseDrapeau | null;
  /** La prise des vitrages d'une case bâtie, `null` si la case n'en porte pas. */
  chantier(cle: string): PriseChantier | null;
  /** Les états connus **à l'instant de l'appel** : à lire quand le geste part. */
  etats(): EtatsConnus;
  /** Amène une case dans le champ si elle en sort ; ne bouge pas sinon. */
  cadrer(c: Case): void;
  /**
   * L'éclat de lumière d'un pouvoir : un multiplicateur d'exposition (`1`
   * pour rien) et la teinte du camp à mêler à la lumière du ciel, ou `null`.
   */
  eclat(facteur: number, teinte: string | null): void;
  /**
   * Appelée à chaque image d'une animation : le rendu se salit. `ombre` dit si
   * le geste a bougé un porteur d'ombre — une figurine, une palissade — ou
   * seulement des sprites et de la lumière, qui ne valent pas une carte d'ombre.
   */
  salir(ombre: boolean): void;
}

/** Une animation et la promesse qui tient jusqu'à sa fin. */
export interface AnimationDatee {
  animation: Animation;
  fin: Promise<void>;
}

/** Ce qu'un geste fait pendant qu'il court, attend, ou s'arrête. */
interface Corps {
  avancer(p: number): void;
  /** Pendant l'attente du départ : rien, par défaut. */
  attente?(): void;
  /** L'état final exact, joué à la fin comme sur un clic qui coupe. */
  terminer?(): void;
  /** Vrai si le geste déplace un porteur d'ombre. */
  ombre: boolean;
}

/** Centre monde d'une case, au sol. */
function centre(c: Case): { x: number; z: number } {
  return { x: c.x * CASE + CASE / 2, z: c.y * CASE + CASE / 2 };
}

/** Le cap, en radians autour de la verticale, pour regarder de `de` vers `vers`. */
function capVers(de: Case, vers: Case): number {
  return Math.atan2(-(vers.y - de.y), vers.x - de.x);
}

/** Interpole deux cases. */
function entre(de: Case, vers: Case, t: number): { x: number; y: number } {
  return { x: de.x + (vers.x - de.x) * t, y: de.y + (vers.y - de.y) * t };
}

/** Une sortie qui freine : arrive sans cogner. */
function freiner(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Enveloppe un corps dans une animation de la boucle. Le `debut` est encodé
 * dans la durée et la progression remappée : `local < 0` tant que le geste
 * attend. Un geste de durée nulle — `cadrer`, ou tout geste sous animations
 * réduites — se joue en une image, à son départ.
 */
function animationDatee(
  nom: string, debut: number, duree: number, corps: Corps, ctx: ContexteAnimation,
): AnimationDatee {
  let resoudre: () => void = () => undefined;
  const fin = new Promise<void>((r) => { resoudre = r; });
  const total = debut + duree;
  const anim = animation(nom, total, (p) => {
    let local: number;
    if (duree <= 0) local = p >= 1 ? 1 : -1;
    else if (debut > 0) local = (p * total - debut) / duree;
    else local = p;
    if (local < 0) corps.attente?.();
    else corps.avancer(Math.min(1, local));
    ctx.salir(corps.ombre);
  }, () => {
    corps.terminer?.();
    ctx.salir(corps.ombre);
    resoudre();
  });
  return { animation: anim, fin };
}

/** Une unité par identifiant, dans l'état courant puis dans le précédent. */
function uniteConnue(ctx: ContexteAnimation, id: string): Unite | null {
  const { courant, precedent } = ctx.etats();
  return (courant && uniteParId(courant, id)) ?? (precedent && uniteParId(precedent, id)) ?? null;
}

/** Profil partagé par toutes les nations, d'après le matériel et l'arme employée. */
export function profilTir(type?: UnitType, cible?: UnitType): 'rafale' | 'missile' | 'cloche' | 'marqueur' {
  if (!type) return 'marqueur';
  if (cible && type.armeSecondaire?.includes(cible.cle)) return 'rafale';
  if (['roquettes', 'missiles_air', 'missiles_sol', 'chasseur', 'drone_intercepteur'].includes(type.cle)) return 'missile';
  if (type.portee[0] > 1 || type.cle === 'bombardier') return 'cloche';
  if (['infanterie', 'recon', 'antiair', 'helico', 'furtif', 'meridien_bastion'].includes(type.cle)) return 'rafale';
  return 'marqueur';
}

/** Hauteur du volume réellement dessiné : un appareil aérien reste une figurine sur le plateau. */
export function hauteurImpact(type?: UnitType): number {
  return type ? hauteurSilhouette(type.silhouette) * (type.domaine === 'air' ? 0.55 : 0.65) : 0.32;
}

function typeConnu(ctx: ContexteAnimation, unite: Unite | null): UnitType | undefined {
  return unite ? ctx.catalogue?.()?.unites[unite.type] : undefined;
}

function cibleConnue(ctx: ContexteAnimation, c: Case): Unite | null {
  const { courant, precedent } = ctx.etats();
  return (courant && uniteSur(courant, c)) ?? (precedent && uniteSur(precedent, c)) ?? null;
}

/**
 * L'état d'**avant** une capture, reconnu à ce qu'il dit plutôt qu'à son rang :
 * pour une capture acquise, celui où le bâtiment n'est pas encore au camp ;
 * pour une capture qui avance, celui où l'unité a moins de points que le geste
 * n'en annonce. Selon qui joue, la peau reçoit l'état d'arrivée avant ou après
 * la salve, et l'ordre des deux états ne suffit pas à les distinguer.
 */
function etatAvantCapture(ctx: ContexteAnimation, g: Extract<Geste, { genre: 'hisser' }>): EtatPartie | null {
  const { courant, precedent } = ctx.etats();
  const cle = cleCase(g.case);
  const candidats = [precedent, courant].filter((e): e is EtatPartie => e !== null);
  const avant = candidats.find((e) => (g.acquis
    ? (e.proprietaires[cle] ?? null) !== g.camp
    : (uniteParId(e, g.unite)?.pointsCapture ?? g.points) < g.points));
  return avant ?? precedent ?? courant;
}

/** Les pans d'une palissade éphémère, posés autour d'une case et attachés aux effets. */
function palissade(ctx: ContexteAnimation, c: Case, sol: number): {
  pans: THREE.Group[]; mat: THREE.MeshStandardNodeMaterial; liberer(): void;
} {
  const { x: cx, z: cz } = centre(c);
  const mat = new THREE.MeshStandardNodeMaterial({ color: COULEUR_PLANCHE, roughness: 0.96, transparent: true });
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const pans = [0, 1, 2, 3].map((k) => {
    const a = k * Math.PI / 2;
    const pan = new THREE.Group();
    pan.position.set(cx + Math.sin(a) * RAYON_PALISSADE, sol, cz + Math.cos(a) * RAYON_PALISSADE);
    pan.rotation.y = a;
    for (const piece of PIECES_PALISSADE) {
      const m = new THREE.Mesh(geo, mat);
      m.scale.set(piece.l, piece.h, piece.p);
      m.position.set(piece.x, piece.y, 0);
      m.castShadow = true;
      pan.add(m);
    }
    ctx.effets.attacher(pan);
    return pan;
  });
  return {
    pans, mat,
    liberer(): void {
      for (const pan of pans) ctx.effets.detacher(pan);
      geo.dispose();
      mat.dispose();
    },
  };
}

/** La hauteur d'une palissade : ce dont elle doit sortir de terre pour se monter. */
const HAUTEUR_PALISSADE = Math.max(...PIECES_PALISSADE.map((p) => p.y + p.h / 2));

/**
 * Traduit un geste en animation, ou `null` si la peau n'a rien à en faire — un
 * geste lu par le HUD (`duel`, `chiffre`), une capture sur une case sans mât.
 */
export function gesteVersAnimation(g: Geste, ctx: ContexteAnimation): AnimationDatee | null {
  switch (g.genre) {
    case 'glisser': {
      if (g.chemin.length < 2) return null;
      const fin = g.chemin[g.chemin.length - 1]!;
      const v = ctx.unites.visuel(g.unite);
      return animationDatee(`glisser:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        avancer: (p) => {
          const point = surChemin(g.chemin, p);
          v.dx = (point.x - fin.x) * CASE;
          v.dz = (point.y - fin.y) * CASE;
          v.cap = point.cap;
          // Un léger tangage : l'unité s'enfonce dans ses suspensions au départ.
          v.dy = Math.sin(p * Math.PI) * 0.012;
          // Le clip de marche boucle à sa cadence propre, quel que soit le trajet.
          v.clip = 'deplacement';
          v.clipDuree = 0;
        },
        terminer: () => {
          v.dx = 0;
          v.dz = 0;
          v.dy = 0;
          v.clip = 'repos';
          v.clipDuree = 0;
        },
      }, ctx);
    }

    case 'tirer': {
      const v = ctx.unites.visuel(g.unite);
      const cap = capVers(g.depuis, g.vers);
      let eclair: Effet | null = null;
      return animationDatee(`tirer:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        avancer: (p) => {
          v.cap = cap;
          v.recul = Math.sin(Math.min(1, p * 3) * Math.PI) * -0.09;
          v.clip = 'tir';
          v.clipDuree = g.duree;
          if (!eclair && g.duree > 0 && p < 1) {
            const type = typeConnu(ctx, uniteConnue(ctx, g.unite));
            const cible = typeConnu(ctx, cibleConnue(ctx, g.vers));
            const { x: cx, z: cz } = centre(g.depuis);
            const x = cx + Math.cos(cap) * 0.42;
            const z = cz - Math.sin(cap) * 0.42;
            const arrivee = centre(g.vers);
            const sol = (x: number, z: number): number => Math.max(ctx.hauteurEn(x, z), NIVEAU_EAU + 0.01);
            eclair = emettreTir(ctx.effets, {
              profil: profilTir(type, cible),
              depuis: { x, y: sol(cx, cz) + hauteurImpact(type), z },
              vers: { ...arrivee, y: sol(arrivee.x, arrivee.z) + hauteurImpact(cible) },
              duree: Math.max(1, g.duree * (1 - p)),
            });
          }
        },
        terminer: () => {
          v.recul = 0;
          v.clip = 'repos';
          v.clipDuree = 0;
          eclair?.liberer();
        },
      }, ctx);
    }

    case 'encaisser': {
      const v = ctx.unites.visuel(g.unite);
      const etincelles: Effet[] = [];
      // Les points de vie **d'avant le coup**, retenus tant que le geste dure :
      // l'état est en avance, et sans cela l'étiquette annonce la perte avant
      // que le coup soit parti. Lus au départ du geste, pas à sa création.
      const retenirPv = (): void => {
        if (v.pv !== null) return;
        const { precedent } = ctx.etats();
        const u = precedent ? uniteParId(precedent, g.unite) : null;
        if (u) v.pv = pvAffiches(u.pv);
      };
      return animationDatee(`encaisser:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        attente: retenirPv,
        avancer: (p) => {
          retenirPv();
          v.secousse = Math.max(0, 1 - p) * 0.08;
          v.clip = 'touche';
          v.clipDuree = g.duree;
          if (etincelles.length === 0 && g.duree > 0 && p < 1) {
            // Des étincelles claires au point d'impact — le côté de la pièce qui
            // regarde le tireur —, qui filent dans le sens du coup et s'écartent.
            // Pas de sang, pas de débris, pas de fumée noire (`doc/10` §2).
            let ux = g.case.x - g.depuis.x;
            let uz = g.case.y - g.depuis.y;
            const n = Math.hypot(ux, uz);
            if (n === 0) { ux = 1; uz = 0; } else { ux /= n; uz /= n; }
            const { x: cx, z: cz } = centre(g.case);
            const x = cx - ux * 0.3;
            const z = cz - uz * 0.3;
            const y = Math.max(ctx.hauteurEn(cx, cz), NIVEAU_EAU + 0.01) + hauteurImpact(typeConnu(ctx, uniteConnue(ctx, g.unite)));
            etincelles.push(emettreImpact(ctx.effets, { x: cx, y, z: cz }));
            const nombre = Math.min(ETINCELLES_MAX, ETINCELLES_MIN + Math.floor(g.degats / 25));
            const duree = Math.max(1, Math.min(g.duree, DUREES.encaisser));
            for (let i = 0; i < nombre; i++) {
              const ecart = (i / Math.max(1, nombre - 1) - 0.5) * 1.6;
              const c = Math.cos(ecart);
              const s = Math.sin(ecart);
              const vitesse = 1.6 + (i % 3) * 0.4;
              etincelles.push(ctx.effets.emettre({
                genre: 'etincelle', position: { x, y, z }, duree,
                couleur: i % 2 === 0 ? '#fff1c8' : '#ffd27a',
                vitesse: { x: (ux * c - uz * s) * vitesse, y: 1.2 + (i % 2) * 0.5, z: (uz * c + ux * s) * vitesse },
                gravite: 3.2, taille: 0.16, tailleFin: 0.04, montee: 0,
              }));
            }
          }
        },
        terminer: () => {
          v.secousse = 0;
          v.clip = 'repos';
          v.clipDuree = 0;
          // Le coup est encaissé : l'étiquette rejoint l'état.
          v.pv = null;
          for (const e of etincelles) e.liberer();
        },
      }, ctx);
    }

    case 'sortir': {
      const v = ctx.unites.visuel(g.unite);
      let retenue = false;
      const retenir = (): void => {
        if (retenue) return;
        // L'unité n'est plus dans l'état : on la retient à l'écran le temps de
        // la voir s'affaisser, telle qu'elle était juste avant.
        const u = uniteConnue(ctx, g.unite);
        if (!u) return;
        ctx.unites.retenir(u);
        retenue = true;
      };
      retenir();
      return animationDatee(`sortir:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        attente: retenir,
        avancer: (p) => {
          retenir();
          v.affaissement = p;
          v.opacite = 1 - p;
          v.dy = -p * 0.05;
          v.clip = 'hors_jeu';
          v.clipDuree = g.duree;
        },
        terminer: () => {
          v.clip = 'repos';
          v.clipDuree = 0;
          if (retenue) ctx.unites.liberer(g.unite);
          // L'état visuel survit à l'unité par identifiant : on le rend neuf
          // pour qu'un identifiant réutilisé ne naisse pas couché.
          v.affaissement = 0;
          v.opacite = 1;
          v.dy = 0;
        },
      }, ctx);
    }

    case 'hisser': {
      const cle = cleCase(g.case);
      const prise = ctx.drapeau(cle);
      if (!prise) return null;
      const vu = ctx.unites.visuel(g.unite);
      const capturer = (duree: number): void => {
        vu.clip = 'capture';
        vu.clipDuree = duree;
      };
      const reposer = (): void => {
        vu.clip = 'repos';
        vu.clipDuree = 0;
      };
      // Le drapeau tel qu'il était **avant** le geste : l'état est déjà en
      // avance, le décor montre déjà l'arrivée. On repart du départ pour que le
      // mouvement se voie — lu au moment où le geste part, quand la peau
      // connaît l'état précédent.
      let depart: { camp: CampId | null; niveau: number } | null = null;
      let proprioAvant: CampId | null = null;
      const departDe = (): { camp: CampId | null; niveau: number } => {
        if (depart) return depart;
        const avant = etatAvantCapture(ctx, g);
        proprioAvant = avant?.proprietaires[cle] ?? null;
        const u = avant ? uniteParId(avant, g.unite) : null;
        depart = poseDrapeau(
          proprioAvant, u && u.pointsCapture > 0 && u.pointsCapture < g.points ? { camp: u.camp, points: u.pointsCapture } : null,
          prise.seuil,
        );
        return depart;
      };
      if (g.acquis) {
        let eclat: Effet | null = null;
        const hisser = (p: number): void => {
          const d = departDe();
          // On n'amène que le drapeau d'un autre : sur un bâtiment neutre, nos
          // couleurs continuent simplement de monter.
          const amener = d.camp !== null && d.camp !== g.camp;
          const partAmener = amener ? PART_AMENER : 0;
          const bas = amener ? 0 : d.niveau;
          if (p < partAmener) {
            prise.forcer(d.camp, d.niveau * (1 - p / partAmener));
            return;
          }
          const t = partAmener < 1 ? (p - partAmener) / (1 - partAmener) : 1;
          // Une montée qui freine en haut : le drapeau arrive, il ne cogne pas le pommeau.
          prise.forcer(g.camp, bas + (1 - bas) * freiner(t));
          if (t >= 0.68 && !eclat) {
            eclat = ctx.effets.emettre({
              genre: 'halo', plat: false, position: prise.sommet, couleur: paletteDe(g.camp).light,
              duree: Math.max(1, g.duree * 0.32), taille: 0.3, tailleFin: 0.85, opacite: 0.9, montee: 0.5,
            });
          }
        };
        return animationDatee(`hisser:${cle}`, g.debut, g.duree, {
          ombre: true,
          // Tant que la capture attend — la palissade tombe, ou l'unité arrive
          // encore —, le drapeau reste tel qu'il était : le décor, lui, montre
          // déjà l'arrivée. Le clip est posé par le geste, pas pendant son
          // attente — sinon une capture qui suit un déplacement écraserait la marche.
          attente: () => hisser(0),
          avancer: (p) => {
            capturer(g.duree);
            hisser(p);
          },
          terminer: () => {
            reposer();
            prise.relacher();
            eclat?.liberer();
          },
        }, ctx);
      }
      // La capture avance : le drapeau glisse d'un cran, et le pied du mât
      // s'allume brièvement aux couleurs de qui la mène.
      let pied: Effet | null = null;
      const glisser = (p: number): void => {
        const d = departDe();
        const arrivee = poseDrapeau(proprioAvant, { camp: g.camp, points: g.points }, prise.seuil);
        const camp = arrivee.camp ?? d.camp;
        prise.forcer(camp, d.niveau + (arrivee.niveau - d.niveau) * (1 - (1 - p) ** 2));
      };
      return animationDatee(`hisser:${cle}`, g.debut, g.duree, {
        ombre: true,
        attente: () => glisser(0),
        avancer: (p) => {
          capturer(g.duree);
          glisser(p);
          if (!pied) {
            pied = ctx.effets.emettre({
              genre: 'halo', plat: false, position: { x: prise.pied.x, y: prise.pied.y + 0.04, z: prise.pied.z },
              couleur: paletteDe(g.camp).main, duree: Math.max(1, g.duree), taille: 0.25, tailleFin: 0.55,
              opacite: 0.7, montee: 0.5,
            });
          }
        },
        terminer: () => {
          reposer();
          prise.relacher();
          pied?.liberer();
        },
      }, ctx);
    }

    case 'remettre': {
      const cle = cleCase(g.case);
      const chantier = ctx.chantier(cle);
      if (!chantier) return null;
      const vu = ctx.unites.visuel(g.unite);
      // L'état est déjà en avance : le décor montre le bâtiment en service. On
      // rejoue la palissade en éphémère et on la fait tomber vers l'extérieur,
      // pan par pan ; les vitrages luisent une fois, puis rendent l'ambiance.
      const { x: cx, z: cz } = centre(g.case);
      const sol = ctx.hauteurEn(cx, cz) + 0.03;
      const pal = palissade(ctx, g.case, sol);
      let poussiere: Effet | null = null;
      return animationDatee(`remettre:${cle}`, g.debut, g.duree, {
        ombre: true,
        avancer: (p) => {
          vu.clip = 'capture';
          vu.clipDuree = g.duree;
          pal.pans.forEach((pan, k) => {
            // Chaque pan part un peu après le précédent et tombe comme on tombe :
            // en accélérant, avec un petit rebond au sol.
            const t = Math.min(1, Math.max(0, (p - k * 0.06) / 0.5));
            const chute = t * t;
            const rebond = t >= 1 ? 0 : Math.max(0, Math.sin(Math.min(1, (t - 0.85) / 0.15) * Math.PI)) * 0.05;
            pan.rotation.x = (Math.PI / 2) * 0.94 * chute - rebond;
          });
          pal.mat.opacity = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          if (p >= 0.3 && !poussiere) {
            poussiere = ctx.effets.emettre({
              genre: 'poussiere', position: { x: cx, y: sol + 0.08, z: cz }, duree: Math.max(1, g.duree * 0.35),
              taille: 0.7, tailleFin: 1.2, opacite: 0.55, montee: 0.5,
            });
          }
          // Les vitrages se rallument quand la palissade est à terre.
          const lueur = Math.max(0, Math.min(1, (p - 0.55) / 0.25));
          chantier.eclairer(Math.sin(lueur * Math.PI * 0.5));
        },
        terminer: () => {
          vu.clip = 'repos';
          vu.clipDuree = 0;
          chantier.relacher();
          pal.liberer();
          poussiere?.liberer();
        },
      }, ctx);
    }

    case 'batir': {
      // La mutation elle-même — splat remélangé, altitudes qui glissent — est
      // jouée par `Plateau.majTerrain` dès que la signature du terrain change ;
      // le geste ajoute ce qui la fait lire comme un chantier : la poussière,
      // et pour une pose une palissade légère qui se monte puis s'efface.
      const { x: cx, z: cz } = centre(g.case);
      const sol = ctx.hauteurEn(cx, cz) + 0.03;
      const pal = g.terrain !== null ? palissade(ctx, g.case, sol - HAUTEUR_PALISSADE) : null;
      if (pal) for (const pan of pal.pans) pan.visible = false;
      let poussiere: Effet | null = null;
      return animationDatee(`batir:${cleCase(g.case)}`, g.debut, g.duree, {
        ombre: pal !== null,
        avancer: (p) => {
          if (!poussiere) {
            poussiere = ctx.effets.emettre({
              genre: 'poussiere', position: { x: cx, y: sol + 0.1, z: cz }, duree: Math.max(1, g.duree),
              taille: 0.6, tailleFin: 1.5, opacite: 0.5, montee: 0.35,
            });
          }
          if (pal) {
            // La palissade sort de terre pendant le premier tiers, tient, puis s'efface.
            const montee = freiner(Math.min(1, p / 0.35));
            for (const pan of pal.pans) {
              pan.visible = true;
              pan.position.y = sol - HAUTEUR_PALISSADE * (1 - montee);
            }
            pal.mat.opacity = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          }
        },
        terminer: () => {
          pal?.liberer();
          poussiere?.liberer();
        },
      }, ctx);
    }

    case 'apparaitre': {
      // La production ne nomme pas l'unité : c'est celle qui occupe la case
      // dans l'état d'arrivée, lue quand le geste part.
      let id: string | null = null;
      const trouver = (): string | null => {
        if (id) return id;
        const { courant } = ctx.etats();
        const u = courant ? uniteSur(courant, g.case) : null;
        if (u && u.camp === g.camp && u.type === g.unite) id = u.id;
        return id;
      };
      let halo: Effet | null = null;
      const { x: cx, z: cz } = centre(g.case);
      return animationDatee(`apparaitre:${cleCase(g.case)}`, g.debut, g.duree, {
        ombre: true,
        // Avant de se poser, l'unité n'est pas encore là.
        attente: () => {
          const i = trouver();
          if (i) ctx.unites.visuel(i).opacite = 0;
        },
        avancer: (p) => {
          const i = trouver();
          // `opacite` porte aussi l'échelle dans le calque : 0,6 → 1 quand elle
          // va de 0 à 1 — l'unité se pose et prend sa taille.
          if (i) ctx.unites.visuel(i).opacite = p;
          if (!halo) {
            halo = ctx.effets.emettre({
              genre: 'halo', position: { x: cx, y: ctx.hauteurEn(cx, cz) + 0.03, z: cz },
              couleur: paletteDe(g.camp).main, duree: Math.max(1, g.duree), taille: 0.5, tailleFin: 1.15,
              opacite: 0.65, montee: 0.25,
            });
          }
        },
        terminer: () => {
          const i = trouver();
          if (i) ctx.unites.visuel(i).opacite = 1;
          halo?.liberer();
        },
      }, ctx);
    }

    case 'embarquer':
    case 'fusionner': {
      // L'unité quitte la carte : on la retient le temps de la voir rejoindre le
      // transport ou l'unité rejointe, en s'effaçant. Ses décalages se comptent
      // depuis la case où le calque la pose — celle de l'état où on l'a trouvée.
      const v = ctx.unites.visuel(g.unite);
      let base: Case | null = null;
      const retenir = (): Case | null => {
        if (base) return base;
        const u = uniteConnue(ctx, g.unite);
        if (!u) return null;
        ctx.unites.retenir(u);
        base = { x: u.x, y: u.y };
        return base;
      };
      retenir();
      return animationDatee(`${g.genre}:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        attente: () => { retenir(); },
        avancer: (p) => {
          const b = retenir();
          if (!b) return;
          const point = entre(g.de, g.vers, freiner(p));
          v.dx = (point.x - b.x) * CASE;
          v.dz = (point.y - b.y) * CASE;
          v.cap = capVers(g.de, g.vers);
          v.opacite = 1 - p;
          v.clip = 'deplacement';
          v.clipDuree = 0;
        },
        terminer: () => {
          if (base) ctx.unites.liberer(g.unite);
          v.dx = 0;
          v.dz = 0;
          v.opacite = 1;
          v.clip = 'repos';
          v.clipDuree = 0;
        },
      }, ctx);
    }

    case 'debarquer': {
      // L'unité est déjà posée à l'arrivée : elle en vient, depuis le transport.
      const v = ctx.unites.visuel(g.unite);
      return animationDatee(`debarquer:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        attente: () => { v.opacite = 0; },
        avancer: (p) => {
          const point = entre(g.de, g.vers, freiner(p));
          v.dx = (point.x - g.vers.x) * CASE;
          v.dz = (point.y - g.vers.y) * CASE;
          v.cap = capVers(g.de, g.vers);
          v.opacite = p;
          v.clip = 'deplacement';
          v.clipDuree = 0;
        },
        terminer: () => {
          v.dx = 0;
          v.dz = 0;
          v.opacite = 1;
          v.clip = 'repos';
          v.clipDuree = 0;
        },
      }, ctx);
    }

    case 'repousser': {
      const v = ctx.unites.visuel(g.unite);
      return animationDatee(`repousser:${g.unite}`, g.debut, g.duree, {
        ombre: true,
        avancer: (p) => {
          const point = entre(g.de, g.vers, freiner(p));
          v.dx = (point.x - g.vers.x) * CASE;
          v.dz = (point.y - g.vers.y) * CASE;
          // Un petit saut : on est poussé, on ne marche pas.
          v.dy = Math.sin(p * Math.PI) * 0.06;
        },
        terminer: () => {
          v.dx = 0;
          v.dz = 0;
          v.dy = 0;
        },
      }, ctx);
    }

    case 'ravitailler': {
      const { x: cx, z: cz } = centre(g.case);
      const sol = ctx.hauteurEn(cx, cz);
      const effets: Effet[] = [];
      let caisses = 0;
      return animationDatee(`ravitailler:${g.cible}`, g.debut, g.duree, {
        ombre: false,
        avancer: (p) => {
          if (effets.length === 0) {
            effets.push(ctx.effets.emettre({
              genre: 'halo', position: { x: cx, y: sol + 0.03, z: cz }, couleur: '#dbeaff',
              duree: Math.max(1, g.duree), taille: 0.5, tailleFin: 0.95, opacite: 0.55, montee: 0.3,
            }));
          }
          // Trois caisses qui montent l'une après l'autre et s'effacent.
          while (caisses < 3 && p >= caisses * 0.2) {
            const a = (caisses / 3) * Math.PI * 2;
            effets.push(ctx.effets.emettre({
              genre: 'caisse', position: { x: cx + Math.cos(a) * 0.18, y: sol + 0.2, z: cz + Math.sin(a) * 0.18 },
              duree: Math.max(1, g.duree * 0.5), vitesse: { x: 0, y: 0.9, z: 0 }, taille: 0.16, montee: 0.2,
            }));
            caisses += 1;
          }
        },
        terminer: () => {
          for (const e of effets) e.liberer();
        },
      }, ctx);
    }

    case 'reparer': {
      const { x: cx, z: cz } = centre(g.case);
      const sol = ctx.hauteurEn(cx, cz);
      const effets: Effet[] = [];
      return animationDatee(`reparer:${g.unite}`, g.debut, g.duree, {
        ombre: false,
        avancer: () => {
          if (effets.length > 0) return;
          // Un halo vert doux au sol, et un second qui monte.
          effets.push(ctx.effets.emettre({
            genre: 'halo', position: { x: cx, y: sol + 0.03, z: cz }, couleur: '#8ee0a4',
            duree: Math.max(1, g.duree), taille: 0.5, tailleFin: 1, opacite: 0.5, montee: 0.3,
          }));
          effets.push(ctx.effets.emettre({
            genre: 'halo', plat: false, position: { x: cx, y: sol + 0.25, z: cz }, couleur: '#b8f0c8',
            duree: Math.max(1, g.duree), vitesse: { x: 0, y: 0.5, z: 0 }, taille: 0.4, tailleFin: 0.7,
            opacite: 0.6, montee: 0.3,
          }));
        },
        terminer: () => {
          for (const e of effets) e.liberer();
        },
      }, ctx);
    }

    case 'reveiller': {
      // L'unité reprend la main : un halo aux couleurs de son camp qui monte
      // d'elle, et rien d'autre — elle ne bouge pas, elle se réveille. L'état
      // est déjà `prete`, la figurine a donc déjà quitté sa transparence de
      // pièce jouée ; le geste ne fait que dater ce réveil.
      const { x: cx, z: cz } = centre(g.case);
      const sol = ctx.hauteurEn(cx, cz);
      const effets: Effet[] = [];
      const couleur = paletteDe(g.camp).light;
      return animationDatee(`reveiller:${g.unite}`, g.debut, g.duree, {
        ombre: false,
        avancer: () => {
          if (effets.length > 0) return;
          effets.push(ctx.effets.emettre({
            genre: 'anneau', position: { x: cx, y: sol + 0.03, z: cz }, couleur,
            duree: Math.max(1, g.duree), taille: 0.35, tailleFin: 1.1, opacite: 0.7, montee: 0.2,
          }));
          effets.push(ctx.effets.emettre({
            genre: 'halo', plat: false, position: { x: cx, y: sol + 0.3, z: cz }, couleur,
            duree: Math.max(1, g.duree), vitesse: { x: 0, y: 0.6, z: 0 }, taille: 0.35, tailleFin: 0.6,
            opacite: 0.55, montee: 0.25,
          }));
        },
        terminer: () => {
          for (const e of effets) e.liberer();
        },
      }, ctx);
    }

    case 'pouvoir': {
      const palette = paletteDe(g.camp);
      const anneaux: Effet[] = [];
      const nombre = g.niveau === 'super' ? 4 : 3;
      let origine: { x: number; y: number; z: number } | null = null;
      const origineDe = (): { x: number; y: number; z: number } => {
        if (origine) return origine;
        // Depuis le QG du camp ; sans QG, depuis le centre de ses unités ; sans
        // unité, depuis le centre de la carte.
        const { courant } = ctx.etats();
        let c: Case | null = null;
        const cleQg = courant?.camps.find((k) => k.id === g.camp)?.qgCase ?? null;
        if (cleQg) c = depuisCle(cleQg);
        else if (courant) {
          const siennes = courant.unites.filter((u) => u.camp === g.camp && !u.dansTransport);
          if (siennes.length > 0) {
            c = {
              x: Math.round(siennes.reduce((s, u) => s + u.x, 0) / siennes.length),
              y: Math.round(siennes.reduce((s, u) => s + u.y, 0) / siennes.length),
            };
          } else c = { x: Math.floor(courant.largeur / 2), y: Math.floor(courant.hauteur / 2) };
        } else c = { x: 0, y: 0 };
        const { x, z } = centre(c);
        origine = { x, y: ctx.hauteurEn(x, z) + 0.04, z };
        return origine;
      };
      return animationDatee(`pouvoir:${g.camp}`, g.debut, g.duree, {
        ombre: false,
        avancer: (p) => {
          const ms = p * g.duree;
          // L'éclat : l'exposition monte à 1,6 et redescend pendant les six
          // cents premières millisecondes du splash, teintée du camp.
          const t = g.duree > 0 ? Math.min(1, ms / MS_ECLAT) : 1;
          const eclat = Math.sin(t * Math.PI) * ECLAT_MAX;
          ctx.eclat(1 + eclat, eclat > 0 ? palette.main : null);
          // Les anneaux partent du QG l'un après l'autre et s'élargissent.
          while (anneaux.length < nombre && ms >= anneaux.length * 160) {
            anneaux.push(ctx.effets.emettre({
              genre: 'anneau', position: origineDe(), couleur: palette.light,
              duree: Math.max(1, Math.min(900, g.duree)), taille: 0.8, tailleFin: 7, opacite: 0.85, montee: 0.1,
            }));
          }
        },
        terminer: () => {
          ctx.eclat(1, null);
          for (const a of anneaux) a.liberer();
        },
      }, ctx);
    }

    case 'cadrer': {
      // Instantané : la caméra ne bouge que si la case sort du champ, et une
      // seule fois. Un clic qui coupe avant le départ ne la bouge pas — c'est
      // le joueur qui a la main.
      let fait = false;
      return animationDatee(`cadrer:${cleCase(g.case)}`, g.debut, 0, {
        ombre: false,
        avancer: () => {
          if (fait) return;
          fait = true;
          ctx.cadrer(g.case);
        },
      }, ctx);
    }

    case 'voiler':
    case 'devoiler': {
      // Le voile tombe — ou se lève — sur place : rien ne bouge, l'opacité seule
      // change, et c'est le calque qui décide pour qui (`EtatVisuel.voile`) : le
      // camp du joueur voit sa figurine s'effacer, l'adversaire qui la tient au
      // contact la voit entière. L'ombre suit l'opacité dans le calque, qui le
      // signale lui-même : le geste n'en déplace aucun porteur.
      const v = ctx.unites.visuel(g.unite);
      const vers = g.genre === 'voiler' ? 1 : 0;
      return animationDatee(`${g.genre}:${g.unite}`, g.debut, g.duree, {
        ombre: false,
        // L'état est en avance : tant que le geste attend son tour, la pièce
        // garde le voile d'avant, sans quoi elle basculerait avant sa marche.
        attente: () => { v.voile = 1 - vers; },
        avancer: (p) => { v.voile = vers === 1 ? p : 1 - p; },
        terminer: () => { v.voile = null; },
      }, ctx);
    }

    case 'duel':
    case 'chiffre':
      // Lus par le HUD : la peau n'a rien à en faire.
      return null;

    default:
      return null;
  }
}

/** Toutes les animations d'une partition, avec la promesse de chacune. */
export function animationsDePartition(
  partition: Partition, ctx: ContexteAnimation,
): { animations: Animation[]; attentes: Promise<void>[] } {
  const animations: Animation[] = [];
  const attentes: Promise<void>[] = [];
  for (const g of partition.gestes) {
    const a = gesteVersAnimation(g, ctx);
    if (!a) continue;
    animations.push(a.animation);
    attentes.push(a.fin);
  }
  return { animations, attentes };
}

/**
 * Traduit une file d'événements en partition, **provisoirement** : la même mise
 * en scène que l'ancien `construireAnimations` — les gestes d'une même unité
 * s'enchaînent, la cible encaisse quand le tir part, la riposte suit le tir,
 * une capture attend la palissade tombée, les constructions se regardent l'une
 * après l'autre — exprimée dans le contrat. Sous animations réduites, toutes
 * les durées valent 0. À remplacer par `ecrirePartition` (`render/`) dès qu'il
 * existe : `Rendu.animer` ne devrait plus rien savoir des événements.
 */
export function partitionProvisoire(
  evenements: readonly EvenementJeu[], avant: EtatPartie, reduit = false,
): Partition {
  const gestes: Geste[] = [];
  const d = (ms: number): number => (reduit ? 0 : ms);

  // La fin du dernier geste de chaque unité dans la salve : un geste attend la
  // fin du précédent de la même unité — la figurine ne tire pas en marchant.
  const fins = new Map<string, number>();
  const placer = (unite: string, duree: number, auPlusTot = 0): number => {
    const debut = Math.max(auPlusTot, fins.get(unite) ?? 0);
    fins.set(unite, debut + duree);
    return debut;
  };

  // Où chaque unité **se trouve** quand son geste part : `avant` est l'état
  // d'où l'ordre est parti, et un déplacement de la salve pose l'arrivée.
  const positions = new Map<string, Case>();
  const positionDe = (id: string): Case | null => {
    const arrivee = positions.get(id);
    if (arrivee) return arrivee;
    const u = uniteParId(avant, id);
    return u ? { x: u.x, y: u.y } : null;
  };

  // Les cases remises en service dans cette salve, et la fin de leur geste :
  // la capture qui suit sur la même case attend que la palissade soit tombée.
  const remises = new Map<string, number>();
  // Les constructions se regardent l'une après l'autre.
  let finBatir = 0;

  for (const e of evenements) {
    if (e.type === 'deplacement') {
      const pas = e.chemin.length > 1 ? e.chemin : cheminEnL(e.de, e.vers);
      const cases = longueurChemin(pas);
      positions.set(e.uniteId, e.vers);
      if (cases === 0) continue;
      const duree = d(cases * DUREES.parCase);
      gestes.push({ genre: 'glisser', unite: e.uniteId, chemin: pas, debut: placer(e.uniteId, duree), duree });
    } else if (e.type === 'attaque') {
      const att = positionDe(e.attaquantId);
      const def = positionDe(e.cibleId);
      if (!att || !def) continue;
      // Le projectile part après le déplacement ; le choc attend son arrivée.
      const departTir = fins.get(e.attaquantId) ?? 0;
      const disponibleDefenseur = fins.get(e.cibleId) ?? 0;
      const dureeTir = d(DUREES.tir);
      gestes.push({
        genre: 'tirer', unite: e.attaquantId, depuis: att, vers: def, debut: placer(e.attaquantId, dureeTir), duree: dureeTir,
      });
      if (e.degats > 0) {
        const duree = d(DUREES.encaisser);
        gestes.push({
          genre: 'encaisser', unite: e.cibleId, case: def, degats: e.degats, depuis: att,
          debut: placer(e.cibleId, duree, departTir + dureeTir), duree,
        });
      }
      if (e.riposte > 0) {
        // La riposte part 80 ms après le premier tir, sans attendre l’impact.
        // Le choc et le départ de tir peuvent se chevaucher ; la fin retient les deux.
        const depart = Math.max(disponibleDefenseur, departTir + d(80));
        const dureeRiposte = d(DUREES.tir);
        const dureeCoup = d(DUREES.encaisser);
        fins.set(e.cibleId, Math.max(fins.get(e.cibleId) ?? 0, depart + dureeRiposte));
        gestes.push({
          genre: 'tirer', unite: e.cibleId, depuis: def, vers: att, debut: depart, duree: dureeRiposte,
        });
        gestes.push({
          genre: 'encaisser', unite: e.attaquantId, case: att, degats: e.riposte, depuis: def,
          debut: placer(e.attaquantId, dureeCoup, depart + dureeRiposte), duree: dureeCoup,
        });
      }
    } else if (e.type === 'hors_jeu') {
      const c = positionDe(e.uniteId);
      if (!c) continue;
      const duree = d(DUREES.sortir);
      gestes.push({ genre: 'sortir', unite: e.uniteId, case: c, debut: placer(e.uniteId, duree), duree });
    } else if (e.type === 'capture') {
      const cle = cleCase(e.case);
      const duree = d(e.acquis ? DUREES.hisser : DUREES.hisserUnCran);
      gestes.push({
        genre: 'hisser', unite: e.uniteId, case: e.case, camp: e.camp, points: e.points, acquis: e.acquis,
        debut: placer(e.uniteId, duree, remises.get(cle) ?? 0), duree,
      });
    } else if (e.type === 'remise_en_service') {
      const cle = cleCase(e.case);
      const duree = d(DUREES.remettre);
      const debut = placer(e.uniteId, duree);
      remises.set(cle, debut + duree);
      gestes.push({ genre: 'remettre', unite: e.uniteId, case: e.case, camp: e.camp, debut, duree });
    } else if (e.type === 'production') {
      gestes.push({ genre: 'apparaitre', unite: e.unite, case: e.case, camp: e.camp, debut: 0, duree: d(DUREES.apparaitre) });
    } else if (e.type === 'embarquement') {
      const de = positionDe(e.uniteId);
      const vers = positionDe(e.transportId);
      if (!de || !vers) continue;
      const duree = d(DUREES.embarquer);
      gestes.push({
        genre: 'embarquer', unite: e.uniteId, transport: e.transportId, de, vers, debut: placer(e.uniteId, duree), duree,
      });
    } else if (e.type === 'debarquement') {
      const de = positionDe(e.transportId);
      if (!de) continue;
      positions.set(e.uniteId, e.vers);
      const duree = d(DUREES.embarquer);
      gestes.push({
        genre: 'debarquer', unite: e.uniteId, transport: e.transportId, de, vers: e.vers, debut: placer(e.uniteId, duree), duree,
      });
    } else if (e.type === 'fusion') {
      const de = positionDe(e.uniteId);
      const vers = positionDe(e.avecId);
      if (!de || !vers) continue;
      const duree = d(DUREES.fusionner);
      gestes.push({ genre: 'fusionner', unite: e.uniteId, avec: e.avecId, de, vers, debut: placer(e.uniteId, duree), duree });
    } else if (e.type === 'ravitaillement') {
      const c = positionDe(e.cibleId);
      if (!c) continue;
      const duree = d(DUREES.ravitailler);
      gestes.push({ genre: 'ravitailler', unite: e.uniteId, cible: e.cibleId, case: c, debut: placer(e.uniteId, duree), duree });
    } else if (e.type === 'reparation') {
      const c = positionDe(e.uniteId);
      if (!c) continue;
      gestes.push({ genre: 'reparer', unite: e.uniteId, case: c, pv: e.pv, debut: 0, duree: d(DUREES.reparer) });
    } else if (e.type === 'repousse') {
      const de = positionDe(e.uniteId);
      if (!de) continue;
      positions.set(e.uniteId, e.vers);
      const duree = d(DUREES.repousser);
      gestes.push({ genre: 'repousser', unite: e.uniteId, de, vers: e.vers, debut: placer(e.uniteId, duree), duree });
    } else if (e.type === 'pouvoir') {
      gestes.push({ genre: 'pouvoir', camp: e.camp, niveau: e.niveau, nom: e.nom, debut: 0, duree: d(DUREES.pouvoir) });
    } else if (e.type === 'furtivite') {
      const c = positionDe(e.uniteId);
      if (!c) continue;
      const duree = d(DUREES.voiler);
      gestes.push({ genre: e.furtive ? 'voiler' : 'devoiler', unite: e.uniteId, case: c, debut: placer(e.uniteId, duree), duree });
    } else if (e.type === 'terrain_pose' || e.type === 'terrain_retire') {
      const duree = d(DUREES.batir);
      gestes.push({
        genre: 'batir', case: e.case, terrain: e.type === 'terrain_pose' ? e.terrain : null, debut: finBatir, duree,
      });
      finBatir += duree;
    }
  }

  return { gestes, duree: dureePartition(gestes) };
}
