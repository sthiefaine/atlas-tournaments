/**
 * Les animations 3D : la même file promise que le rendu 2D, mais qui pousse des
 * translations, des reculs et des secousses au lieu de coordonnées de tuile.
 *
 * Le principe ne change pas d'un iota (`render/jeu.ts`) : **l'état logique est
 * déjà en avance**, une animation n'est qu'un rattrapage visuel. Elle ne décide
 * rien, elle ne peut rien annuler, et si on la coupe la partie reste juste.
 *
 * Cinq gestes suffisent à raconter un tour : le déplacement le long du chemin,
 * le tir (recul et éclair court), le coup encaissé (secousse), la mise hors jeu
 * (affaissement et fondu) et la capture — on amène les couleurs de l'ancien
 * propriétaire, on hisse les nôtres. Le bâtiment, lui, ne bouge jamais : ce
 * qu'on prend, c'est le mât.
 *
 * Chaque geste pose aussi le **clip logique** de l'unité (`EtatVisuel.clip`,
 * `doc/10` §7.3) : `deplacement` tant qu'elle glisse, `tir` pour qui tire,
 * `touche` pour qui encaisse — riposte comprise, après le tir —, `hors_jeu`,
 * `capture` pendant les deux temps d'une prise, et `repos` dès que le geste
 * finit ou qu'on le coupe. Un placeholder l'ignore ; un modèle livré le joue
 * dans son mixer. Rien ici ne sait si un modèle existe : c'est ce qui permet à
 * un fichier d'arriver sans qu'une ligne change.
 */

import * as THREE from 'three';

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { cleCase, uniteParId } from '../engine/index';
import { animation, type Animation } from '../render/boucle';
import { cheminEnL, longueurChemin, surChemin } from '../render/chemin';
import { paletteDe } from '../render/palettes';
import {
  COULEUR_PLANCHE, PIECES_PALISSADE, poseDrapeau, RAYON_PALISSADE, type PriseChantier, type PriseDrapeau,
} from './decor';
import { CASE } from './geometrie';
import type { CalqueUnites } from './unites';

/** Durée d'un pas de déplacement, par case traversée. */
export const MS_PAR_CASE = 120;

/** Durée du recul de tir. */
const MS_TIR = 260;

/** Durée de la secousse d'impact. */
const MS_TOUCHE = 300;

/** Durée de la mise hors jeu. */
const MS_HORS_JEU = 420;

/** Durée d'une capture acquise : amener l'ancien drapeau, hisser le nouveau. */
const MS_CAPTURE = 1100;

/** Part de la capture passée à amener l'ancien drapeau, quand il y en a un. */
const PART_AMENER = 0.38;

/** Durée du retour visuel d'une capture qui avance sans aboutir. */
const MS_CAPTURE_EN_COURS = 460;

/** Durée d'une remise en service : la palissade tombe, les vitrages se rallument. */
const MS_REMISE = 1200;

/** Ce dont les animations ont besoin pour agir sur la scène. */
export interface ContexteAnimation {
  unites: CalqueUnites;
  /** Groupe où poser les effets éphémères (éclairs, drapeaux). */
  effets: THREE.Group;
  document: Document;
  hauteurEn(x: number, z: number): number;
  /** La prise du drapeau d'une case bâtie, `null` si la case n'en porte pas. */
  drapeau(cle: string): PriseDrapeau | null;
  /** La prise des vitrages d'une case bâtie, `null` si la case n'en porte pas. */
  chantier(cle: string): PriseChantier | null;
  /** Appelée quand une animation modifie la scène : le rendu se salit. */
  salir(): void;
}

/** Un halo tinté aux couleurs d'un camp, éteint : l'animation l'allume. */
function halo(doc: Document, couleur: string): THREE.Sprite {
  return new THREE.Sprite(new THREE.SpriteMaterial({
    map: eclair(doc), color: couleur, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0,
  }));
}

/** Texture d'éclair de bouche : un halo additif, dessiné une seule fois. */
let textureEclair: THREE.CanvasTexture | null = null;

function eclair(doc: Document): THREE.CanvasTexture {
  if (textureEclair) return textureEclair;
  const c = doc.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,246,214,1)');
    grad.addColorStop(0.3, 'rgba(255,196,90,0.7)');
    grad.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  textureEclair = new THREE.CanvasTexture(c);
  textureEclair.colorSpace = THREE.SRGBColorSpace;
  return textureEclair;
}

/**
 * Traduit une file d'événements en animations. Chaque animation rend une
 * promesse ; `index.ts` attend la dernière avant de rendre la main au jeu.
 */
export function construireAnimations(
  evenements: readonly EvenementJeu[], avant: EtatPartie, ctx: ContexteAnimation,
): { animations: Animation[]; attentes: Promise<void>[] } {
  const animations: Animation[] = [];
  const attentes: Promise<void>[] = [];

  // Les cases remises en service dans cette salve : la capture qui suit sur la
  // même case attend que la palissade soit tombée avant de hisser le drapeau.
  const remises = new Set<string>();

  // La fin du dernier geste de chaque unité dans la salve, en millisecondes
  // depuis son départ. Toutes les animations d'une salve partent ensemble ; or
  // un ordre produit une seule salve — avancer puis tirer, avancer puis
  // capturer, tirer puis encaisser la riposte —, et deux gestes d'une même
  // unité joués en même temps écriraient le même clip : la figurine tirerait
  // en marchant. Un geste attend donc la fin du précédent de la même unité.
  const fins = new Map<string, number>();

  interface OptionsGeste {
    terminer?: () => void;
    /** Un départ imposé, en millisecondes depuis celui de la salve. */
    retard?: number;
    /** L'unité dont c'est le geste : il attend la fin de son geste précédent. */
    unite?: string;
    /** Ce que l'animation fait pendant qu'elle attend son départ : rien, par défaut. */
    attente?: () => void;
  }

  const ajouter = (
    nom: string, duree: number, avancer: (p: number) => void, options: OptionsGeste = {},
  ): void => {
    const retard = Math.max(options.retard ?? 0, options.unite === undefined ? 0 : fins.get(options.unite) ?? 0);
    if (options.unite !== undefined) fins.set(options.unite, retard + duree);
    attentes.push(new Promise<void>((resoudre) => {
      animations.push(animation(nom, duree + retard, (p) => {
        // Un geste qui n'a pas commencé ne touche à rien : à `p = 0`, un recul
        // vaut zéro, mais une secousse ou un éclair sont à leur maximum.
        const local = retard > 0 ? (p * (duree + retard) - retard) / duree : p;
        if (local < 0) options.attente?.();
        else avancer(Math.min(1, local));
        ctx.salir();
      }, () => {
        options.terminer?.();
        ctx.salir();
        resoudre();
      }));
    }));
  };

  for (const e of evenements) {
    if (e.type === 'deplacement') {
      // Le chemin vient du moteur : c'est celui qu'il a validé. On ne le
      // reconstruit plus — un trajet inventé traverse les montagnes et les
      // unités adverses, et c'est exactement ce qu'on voyait.
      const pas = e.chemin.length > 1 ? e.chemin : cheminEnL(e.de, e.vers);
      const cases = longueurChemin(pas);
      if (cases === 0) continue;
      const v = ctx.unites.visuel(e.uniteId);
      ajouter(`deplacement:${e.uniteId}`, cases * MS_PAR_CASE, (p) => {
        const point = surChemin(pas, p);
        v.dx = (point.x - e.vers.x) * CASE;
        v.dz = (point.y - e.vers.y) * CASE;
        v.cap = point.cap;
        // Un léger tangage : l'unité s'enfonce dans ses suspensions au départ.
        v.dy = Math.sin(p * Math.PI) * 0.012;
        // Le clip de marche boucle à sa cadence propre, quel que soit le trajet.
        v.clip = 'deplacement';
        v.clipDuree = 0;
      }, {
        unite: e.uniteId,
        terminer: () => {
          v.dx = 0;
          v.dz = 0;
          v.dy = 0;
          v.clip = 'repos';
          v.clipDuree = 0;
        },
      });
    } else if (e.type === 'attaque') {
      const att = uniteParId(avant, e.attaquantId);
      const def = uniteParId(avant, e.cibleId);
      const v = ctx.unites.visuel(e.attaquantId);
      // Le coup part quand le tir part : après le déplacement de l'attaquant
      // s'il vient d'en faire un, et la cible l'encaisse au même instant.
      const departTir = fins.get(e.attaquantId) ?? 0;
      if (att && def) {
        const cap = Math.atan2(-(def.y - att.y), def.x - att.x);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: eclair(ctx.document), blending: THREE.AdditiveBlending,
          transparent: true, depthWrite: false, opacity: 0,
        }));
        const x = att.x * CASE + CASE / 2 + Math.cos(cap) * 0.42;
        const z = att.y * CASE + CASE / 2 - Math.sin(cap) * 0.42;
        sprite.position.set(x, ctx.hauteurEn(x, z) + 0.26, z);
        sprite.scale.setScalar(0.5);
        ctx.effets.add(sprite);
        ajouter(`tir:${e.attaquantId}`, MS_TIR, (p) => {
          v.cap = cap;
          v.recul = Math.sin(Math.min(1, p * 3) * Math.PI) * -0.09;
          v.clip = 'tir';
          v.clipDuree = MS_TIR;
          const eclat = Math.max(0, 1 - p * 4);
          sprite.material.opacity = eclat;
          sprite.scale.setScalar(0.34 + eclat * 0.4);
        }, {
          unite: e.attaquantId,
          terminer: () => {
            v.recul = 0;
            v.clip = 'repos';
            v.clipDuree = 0;
            ctx.effets.remove(sprite);
            sprite.material.dispose();
          },
        });
      }
      if (e.degats > 0) {
        const vc = ctx.unites.visuel(e.cibleId);
        ajouter(`touche:${e.cibleId}`, MS_TOUCHE, (p) => {
          vc.secousse = Math.max(0, 1 - p) * 0.08;
          vc.clip = 'touche';
          vc.clipDuree = MS_TOUCHE;
        }, {
          retard: departTir,
          unite: e.cibleId,
          terminer: () => {
            vc.secousse = 0;
            vc.clip = 'repos';
            vc.clipDuree = 0;
          },
        });
      }
      if (e.riposte > 0) {
        const va = ctx.unites.visuel(e.attaquantId);
        // La riposte n'arrive qu'une fois le tir parti : l'attaquant tire, puis
        // encaisse — c'est son geste suivant, il attend la fin du tir.
        ajouter(`riposte:${e.attaquantId}`, MS_TOUCHE, (p) => {
          va.secousse = Math.max(0, 1 - p) * 0.06;
          va.clip = 'touche';
          va.clipDuree = MS_TOUCHE;
        }, {
          unite: e.attaquantId,
          terminer: () => {
            va.secousse = 0;
            va.clip = 'repos';
            va.clipDuree = 0;
          },
        });
      }
    } else if (e.type === 'hors_jeu') {
      const u = uniteParId(avant, e.uniteId);
      if (!u) continue;
      ctx.unites.retenir(u);
      const v = ctx.unites.visuel(e.uniteId);
      ajouter(`hors_jeu:${e.uniteId}`, MS_HORS_JEU, (p) => {
        v.affaissement = p;
        v.opacite = 1 - p;
        v.dy = -p * 0.05;
        v.clip = 'hors_jeu';
        v.clipDuree = MS_HORS_JEU;
      }, {
        unite: e.uniteId,
        terminer: () => {
          v.clip = 'repos';
          v.clipDuree = 0;
          ctx.unites.liberer(e.uniteId);
        },
      });
    } else if (e.type === 'capture') {
      const cle = cleCase(e.case);
      const prise = ctx.drapeau(cle);
      if (!prise) continue;
      const vu = ctx.unites.visuel(e.uniteId);
      const capturer = (duree: number): void => {
        vu.clip = 'capture';
        vu.clipDuree = duree;
      };
      const reposer = (): void => {
        vu.clip = 'repos';
        vu.clipDuree = 0;
      };
      // Le drapeau tel qu'il était **avant** le geste : l'état est déjà en
      // avance, le décor montre déjà l'arrivée. On repart du départ pour que
      // le mouvement se voie.
      const proprio = avant.proprietaires[cle] ?? null;
      const u = uniteParId(avant, e.uniteId);
      const depart = poseDrapeau(
        proprio, u && u.pointsCapture > 0 ? { camp: u.camp, points: u.pointsCapture } : null, prise.seuil,
      );
      if (e.acquis) {
        // On n'amène que le drapeau d'un autre : sur un bâtiment neutre, nos
        // couleurs continuent simplement de monter.
        const amener = depart.camp !== null && depart.camp !== e.camp;
        const partAmener = amener ? PART_AMENER : 0;
        const bas = amener ? 0 : depart.niveau;
        const eclat = halo(ctx.document, paletteDe(e.camp).light);
        eclat.position.copy(prise.sommet);
        eclat.scale.setScalar(0.3);
        ctx.effets.add(eclat);
        // Le drapeau seul : le clip de l'unité est posé par le geste, pas
        // pendant son attente — sinon une capture qui suit un déplacement
        // écraserait la marche.
        const hisser = (p: number): void => {
          if (p < partAmener) {
            prise.forcer(depart.camp, depart.niveau * (1 - p / partAmener));
            return;
          }
          const t = (p - partAmener) / (1 - partAmener);
          // Une montée qui freine en haut : le drapeau arrive, il ne cogne pas le pommeau.
          const monte = 1 - (1 - t) ** 3;
          prise.forcer(e.camp, bas + (1 - bas) * monte);
          const lueur = Math.max(0, (t - 0.68) / 0.32);
          eclat.material.opacity = Math.sin(lueur * Math.PI) * 0.9;
          eclat.scale.setScalar(0.3 + lueur * 0.55);
        };
        ajouter(`capture:${cle}`, MS_CAPTURE, (p) => {
          capturer(MS_CAPTURE);
          hisser(p);
        }, {
          retard: remises.has(cle) ? MS_REMISE : 0,
          unite: e.uniteId,
          // Tant que la capture attend — la palissade tombe, ou l'unité arrive
          // encore —, le drapeau reste tel qu'il était : le décor, lui, montre
          // déjà l'arrivée.
          attente: () => hisser(0),
          terminer: () => {
            reposer();
            prise.relacher();
            ctx.effets.remove(eclat);
            eclat.material.dispose();
          },
        });
      } else {
        // La capture avance : le drapeau glisse d'un cran, et le pied du mât
        // s'allume brièvement aux couleurs de qui la mène.
        const arrivee = poseDrapeau(proprio, { camp: e.camp, points: e.points }, prise.seuil);
        const camp = arrivee.camp ?? depart.camp;
        const pied = halo(ctx.document, paletteDe(e.camp).main);
        pied.position.copy(prise.pied).add(new THREE.Vector3(0, 0.04, 0));
        pied.scale.setScalar(0.25);
        ctx.effets.add(pied);
        const glisser = (p: number): void => {
          const t = 1 - (1 - p) ** 2;
          prise.forcer(camp, depart.niveau + (arrivee.niveau - depart.niveau) * t);
          pied.material.opacity = Math.sin(p * Math.PI) * 0.7;
          pied.scale.setScalar(0.25 + p * 0.3);
        };
        ajouter(`capture:${cle}`, MS_CAPTURE_EN_COURS, (p) => {
          capturer(MS_CAPTURE_EN_COURS);
          glisser(p);
        }, {
          unite: e.uniteId,
          attente: () => glisser(0),
          terminer: () => {
            reposer();
            prise.relacher();
            ctx.effets.remove(pied);
            pied.material.dispose();
          },
        });
      }
    } else if (e.type === 'remise_en_service') {
      const cle = cleCase(e.case);
      const chantier = ctx.chantier(cle);
      if (!chantier) continue;
      remises.add(cle);
      // Une remise en service est une capture pour le moteur : même geste.
      const vu = ctx.unites.visuel(e.uniteId);
      // L'état est déjà en avance : le décor montre le bâtiment en service. On
      // rejoue la palissade en éphémère et on la fait tomber vers l'extérieur,
      // pan par pan ; les vitrages luisent une fois, puis rendent l'ambiance.
      const cx = e.case.x * CASE + CASE / 2;
      const cz = e.case.y * CASE + CASE / 2;
      const sol = ctx.hauteurEn(cx, cz) + 0.03;
      const mat = new THREE.MeshStandardMaterial({ color: COULEUR_PLANCHE, roughness: 0.96, transparent: true });
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
        ctx.effets.add(pan);
        return pan;
      });
      const poussiere = halo(ctx.document, '#f1e6cf');
      poussiere.position.set(cx, sol + 0.08, cz);
      poussiere.scale.setScalar(0.9);
      ctx.effets.add(poussiere);
      ajouter(`remise:${cle}`, MS_REMISE, (p) => {
        vu.clip = 'capture';
        vu.clipDuree = MS_REMISE;
        pans.forEach((pan, k) => {
          // Chaque pan part un peu après le précédent et tombe comme on tombe :
          // en accélérant, avec un petit rebond au sol.
          const t = Math.min(1, Math.max(0, (p - k * 0.06) / 0.5));
          const chute = t * t;
          const rebond = t >= 1 ? 0 : Math.max(0, Math.sin(Math.min(1, (t - 0.85) / 0.15) * Math.PI)) * 0.05;
          pan.rotation.x = (Math.PI / 2) * 0.94 * chute - rebond;
        });
        mat.opacity = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        const souleve = Math.max(0, Math.min(1, (p - 0.3) / 0.35));
        poussiere.material.opacity = Math.sin(souleve * Math.PI) * 0.55;
        poussiere.scale.setScalar(0.7 + souleve * 0.5);
        // Les vitrages se rallument quand la palissade est à terre.
        const lueur = Math.max(0, Math.min(1, (p - 0.55) / 0.25));
        chantier.eclairer(Math.sin(lueur * Math.PI * 0.5));
      }, {
        unite: e.uniteId,
        terminer: () => {
          vu.clip = 'repos';
          vu.clipDuree = 0;
          chantier.relacher();
          for (const pan of pans) ctx.effets.remove(pan);
          ctx.effets.remove(poussiere);
          poussiere.material.dispose();
          geo.dispose();
          mat.dispose();
        },
      });
    }
  }

  return { animations, attentes };
}
