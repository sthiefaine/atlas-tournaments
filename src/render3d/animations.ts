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
 * (affaissement et fondu) et la capture (un drapeau qui monte).
 */

import * as THREE from 'three';

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { uniteParId } from '../engine/index';
import { animation, type Animation } from '../render/boucle';
import { paletteDe } from '../render/palettes';
import type { Case } from '../schemas/types';
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

/** Durée de la montée d'un drapeau de capture. */
const MS_CAPTURE = 620;

/** Ce dont les animations ont besoin pour agir sur la scène. */
export interface ContexteAnimation {
  unites: CalqueUnites;
  /** Groupe où poser les effets éphémères (éclairs, drapeaux). */
  effets: THREE.Group;
  document: Document;
  hauteurEn(x: number, z: number): number;
  /** Appelée quand une animation modifie la scène : le rendu se salit. */
  salir(): void;
}

/** Le chemin en L d'un déplacement : sur une grille, on ne coupe pas en diagonale. */
export function cheminEnL(de: Case, vers: Case): Case[] {
  const pas: Case[] = [de];
  if (de.x !== vers.x) pas.push({ x: vers.x, y: de.y });
  if (de.y !== vers.y) pas.push({ x: vers.x, y: vers.y });
  if (pas.length === 1) pas.push(vers);
  return pas;
}

/** Longueur d'un chemin, en cases. */
export function longueurChemin(pas: readonly Case[]): number {
  let total = 0;
  for (let i = 1; i < pas.length; i += 1) {
    const a = pas[i - 1];
    const b = pas[i];
    if (a && b) total += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  return total;
}

/**
 * Position et cap le long d'un chemin, à la progression `p` (0 à 1). Fonction
 * pure : c'est elle que teste `tests/render3d/animations.test.ts`.
 */
export function surChemin(
  pas: readonly Case[], p: number,
): { x: number; y: number; cap: number } {
  const total = longueurChemin(pas);
  const premier = pas[0] ?? { x: 0, y: 0 };
  if (total === 0) return { x: premier.x, y: premier.y, cap: 0 };
  let reste = Math.max(0, Math.min(1, p)) * total;
  for (let i = 1; i < pas.length; i += 1) {
    const a = pas[i - 1];
    const b = pas[i];
    if (!a || !b) continue;
    const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    if (d === 0) continue;
    if (reste <= d) {
      const k = reste / d;
      return {
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        cap: Math.atan2(-(b.y - a.y), b.x - a.x),
      };
    }
    reste -= d;
  }
  const fin = pas[pas.length - 1] ?? premier;
  const avant = pas[pas.length - 2] ?? fin;
  return { x: fin.x, y: fin.y, cap: Math.atan2(-(fin.y - avant.y), fin.x - avant.x) };
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

  const ajouter = (
    nom: string, duree: number, avancer: (p: number) => void, terminer?: () => void,
  ): void => {
    attentes.push(new Promise<void>((resoudre) => {
      animations.push(animation(nom, duree, (p) => {
        avancer(p);
        ctx.salir();
      }, () => {
        terminer?.();
        ctx.salir();
        resoudre();
      }));
    }));
  };

  for (const e of evenements) {
    if (e.type === 'deplacement') {
      const pas = cheminEnL(e.de, e.vers);
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
      }, () => {
        v.dx = 0;
        v.dz = 0;
        v.dy = 0;
      });
    } else if (e.type === 'attaque') {
      const att = uniteParId(avant, e.attaquantId);
      const def = uniteParId(avant, e.cibleId);
      const v = ctx.unites.visuel(e.attaquantId);
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
          const eclat = Math.max(0, 1 - p * 4);
          sprite.material.opacity = eclat;
          sprite.scale.setScalar(0.34 + eclat * 0.4);
        }, () => {
          v.recul = 0;
          ctx.effets.remove(sprite);
          sprite.material.dispose();
        });
      }
      if (e.degats > 0) {
        const vc = ctx.unites.visuel(e.cibleId);
        ajouter(`touche:${e.cibleId}`, MS_TOUCHE, (p) => {
          vc.secousse = Math.max(0, 1 - p) * 0.08;
        }, () => {
          vc.secousse = 0;
        });
      }
      if (e.riposte > 0) {
        const va = ctx.unites.visuel(e.attaquantId);
        ajouter(`riposte:${e.attaquantId}`, MS_TOUCHE, (p) => {
          va.secousse = Math.max(0, 1 - p) * 0.06;
        }, () => {
          va.secousse = 0;
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
      }, () => {
        ctx.unites.liberer(e.uniteId);
      });
    } else if (e.type === 'capture' && e.acquis) {
      const camp = e.camp;
      const mat = new THREE.MeshStandardMaterial({ color: paletteDe(camp).main, roughness: 0.6 });
      const drapeau = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), mat);
      const mât = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6),
        new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5 }),
      );
      const cx = e.case.x * CASE + CASE / 2;
      const cz = e.case.y * CASE + CASE / 2;
      const sol = ctx.hauteurEn(cx, cz);
      mât.position.set(cx, sol + 0.25, cz);
      drapeau.position.set(cx + 0.13, sol + 0.4, cz);
      drapeau.castShadow = true;
      ctx.effets.add(mât);
      ctx.effets.add(drapeau);
      ajouter(`capture:${e.case.x},${e.case.y}`, MS_CAPTURE, (p) => {
        const monte = Math.min(1, p * 1.3);
        drapeau.position.y = sol + 0.14 + monte * 0.3;
        mat.opacity = 1;
        drapeau.scale.setScalar(0.6 + monte * 0.4);
      }, () => {
        ctx.effets.remove(mât);
        ctx.effets.remove(drapeau);
        mât.geometry.dispose();
        (mât.material as THREE.Material).dispose();
        drapeau.geometry.dispose();
        mat.dispose();
      });
    }
  }

  return { animations, attentes };
}
