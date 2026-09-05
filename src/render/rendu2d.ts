/**
 * Le rendu vectoriel 2D, derrière l'interface commune `Rendu`.
 *
 * Rien de neuf dans le dessin : ce fichier ne fait qu'emballer les briques déjà
 * écrites — `hidpi`, `camera`, `entrees`, `boucle`, `scene`, `sprites` — pour que
 * `jeu.ts` puisse le remplacer par le rendu 3D sans rien savoir de l'un ni de
 * l'autre. Le HUD n'y est plus dessiné : il est passé en HTML (`hud-html.ts`),
 * partagé par les deux peaux. `dessinerHud()` reste exporté pour l'aperçu
 * d'administration et pour le repli sans DOM.
 */

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { uniteParId } from '../engine/index';
import type { Case } from '../schemas/types';
import { animation, Boucle } from './boucle';
import { longueurChemin, surChemin } from './chemin';
import {
  avancerInertie, centreCase, centrerSur, couperInertie, creerCamera, ecranVersCase,
  glisser, lancerInertie, mondeVersEcran, palierZoom, redimensionner, TUILE, zoomerAutour,
  zoomerPalier, type Camera,
} from './camera';
import { brancherEntrees, type PointEcran } from './entrees';
import { monterSurface, type Surface } from './hidpi';
import type { GestesRendu, PointVue, Rendu, VueInteraction } from './rendu';
import { dessinerScene, type PositionAnimee, type VueScene } from './scene';
import { CacheSprites } from './sprites/index';

/** Durée d'un déplacement, par case traversée. */
const MS_PAR_CASE = 110;

/** Crée le rendu vectoriel 2D. */
export function creerRendu2d(): Rendu {
  let canvas: HTMLCanvasElement | null = null;
  let surface: Surface | null = null;
  let camera: Camera | null = null;
  let cache: CacheSprites | null = null;
  let boucle: Boucle | null = null;
  let etat: EtatPartie | null = null;
  let vue: VueInteraction | null = null;
  let temps = 0;
  let cadree = false;
  let msImage = 0;
  const animees = new Map<string, PositionAnimee>();

  function vueScene(e: EtatPartie, v: VueInteraction, cam: Camera, c: CacheSprites, s: Surface): VueScene {
    return {
      etat: e,
      catalogue: v.catalogue,
      camera: cam,
      ambiance: v.ambiance,
      cache: c,
      ratio: s.ratio,
      surbrillances: v.surbrillances,
      chemin: v.chemin,
      curseur: v.curseur,
      selection: v.selection,
      visibles: v.visibles,
      animees,
      temps,
      etiquetteQg: v.etiquetteQg,
    };
  }

  function dessiner(ecoule: number): void {
    const debut = Date.now();
    temps += ecoule;
    const s = surface;
    const cam = camera;
    const c = cache;
    if (!s || !cam || !c) return;
    if (avancerInertie(cam, ecoule)) boucle?.salir();
    s.reinitialiserTransformation();
    s.ctx.clearRect(0, 0, cam.vue.largeur, cam.vue.hauteur);
    if (!etat || !vue) return;
    const palier = palierZoom(cam.zoom);
    if (c.contexte(vue.ambiance.cle, palier, s.ratio * palier)) boucle?.salir();
    dessinerScene(s.ctx, vueScene(etat, vue, cam, c, s));
    const duree = Date.now() - debut;
    msImage = msImage === 0 ? duree : msImage * 0.85 + duree * 0.15;
  }

  function preparer(e: EtatPartie): Camera {
    if (camera) return camera;
    const cam = creerCamera({ largeur: e.largeur, hauteur: e.hauteur });
    if (surface) redimensionner(cam, surface.largeur, surface.hauteur);
    camera = cam;
    return cam;
  }

  function dansCarte(c: Case): boolean {
    if (!etat) return false;
    return c.x >= 0 && c.y >= 0 && c.x < etat.largeur && c.y < etat.hauteur;
  }

  return {
    cle: '2d',

    get canvas(): HTMLCanvasElement | null {
      return canvas;
    },

    monter(conteneur: HTMLElement): void {
      const doc = conteneur.ownerDocument;
      const el = doc.createElement('canvas');
      el.className = 'atlas-toile';
      el.style.display = 'block';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.outline = 'none';
      el.style.touchAction = 'none';
      el.setAttribute('tabindex', '0');
      conteneur.appendChild(el);
      canvas = el;
      surface = monterSurface(el, {
        surRedimension: (r) => {
          if (camera) redimensionner(camera, r.largeur, r.hauteur);
          if (r.ratioChange) cache?.vider();
          boucle?.salir();
        },
      });
      cache = new CacheSprites(surface.ratio);
      boucle = new Boucle(dessiner);
    },

    afficher(e: EtatPartie, v: VueInteraction): void {
      etat = e;
      vue = v;
      preparer(e);
      boucle?.salir();
    },

    animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void> {
      const b = boucle;
      if (!b) return Promise.resolve();
      const attentes: Promise<void>[] = [];
      for (const ev of evenements) {
        if (ev.type === 'deplacement') {
          // Le chemin est celui du moteur : la figurine suit la route qu'elle a
          // vraiment prise, au lieu de glisser en ligne droite à travers tout.
          const pas = ev.chemin.length > 1 ? ev.chemin : [ev.de, ev.vers];
          const cases = longueurChemin(pas);
          if (cases === 0) continue;
          const id = ev.uniteId;
          const points = pas.map(centreCase);
          attentes.push(new Promise<void>((resoudre) => {
            b.ajouter(animation(`deplacement:${id}`, cases * MS_PAR_CASE, (p) => {
              const point = surChemin(points, p);
              animees.set(id, { x: point.x, y: point.y, alpha: 1 });
            }, () => {
              animees.delete(id);
              resoudre();
            }));
          }));
        } else if (ev.type === 'hors_jeu') {
          const u = uniteParId(avant, ev.uniteId);
          if (!u) continue;
          const pos = centreCase({ x: u.x, y: u.y });
          attentes.push(new Promise<void>((resoudre) => {
            b.ajouter(animation(`hors_jeu:${ev.uniteId}`, 320, (p) => {
              animees.set(ev.uniteId, { x: pos.x, y: pos.y - p * 6, alpha: 1 - p });
            }, () => {
              animees.delete(ev.uniteId);
              resoudre();
            }));
          }));
        }
      }
      b.salir();
      return attentes.length === 0 ? Promise.resolve() : Promise.all(attentes).then(() => undefined);
    },

    versMonde(x: number, y: number): Case | null {
      if (!camera) return null;
      const c = ecranVersCase(camera, { x, y });
      return dansCarte(c) ? c : null;
    },

    versEcran(c: Case): PointVue | null {
      if (!camera) return null;
      return mondeVersEcran(camera, centreCase(c));
    },

    brancher(gestes: GestesRendu): () => void {
      const el = canvas;
      if (!el) return () => undefined;
      const caseSous = (p: PointEcran): Case => {
        const cam = camera;
        return cam ? ecranVersCase(cam, p) : { x: 0, y: 0 };
      };
      return brancherEntrees(el, {
        surTap: (p) => {
          const c = caseSous(p);
          if (dansCarte(c)) gestes.surClicCase?.(c);
        },
        surTapSecondaire: () => gestes.surAnnuler?.(),
        surSurvol: (p) => {
          if (!p) {
            gestes.surSurvolCase?.(null);
            return;
          }
          const c = caseSous(p);
          if (dansCarte(c)) gestes.surSurvolCase?.(c);
        },
        surGlisser: (dx, dy) => {
          if (!camera) return;
          couperInertie(camera);
          glisser(camera, dx, dy);
          boucle?.salir();
        },
        surLacher: (vx, vy) => {
          if (!camera) return;
          lancerInertie(camera, vx, vy);
          boucle?.salir();
        },
        surZoom: (facteur, ancre) => {
          if (!camera) return;
          zoomerAutour(camera, facteur, ancre);
          boucle?.salir();
        },
        surTouche: (touche) => {
          if (touche === 'zoom_plus' || touche === 'zoom_moins') {
            if (camera) zoomerPalier(camera, touche === 'zoom_plus' ? 1 : -1);
            boucle?.salir();
            return;
          }
          gestes.surTouche?.(touche);
        },
      });
    },

    zoomer(sens: number): void {
      if (camera) zoomerPalier(camera, sens);
      boucle?.salir();
    },

    recentrer(c: Case): void {
      if (camera) centrerSur(camera, c);
      boucle?.salir();
    },

    cadrer(c: Case): void {
      if (!etat) return;
      const cam = preparer(etat);
      if (!cadree) {
        cadree = true;
        centrerSur(cam, c);
        boucle?.salir();
        return;
      }
      const ecran = mondeVersEcran(cam, centreCase(c));
      const marge = TUILE;
      if (
        ecran.x < marge || ecran.y < marge
        || ecran.x > cam.vue.largeur - marge || ecran.y > cam.vue.hauteur - marge
      ) {
        centrerSur(cam, c);
      }
      boucle?.salir();
    },

    msParImage(): number {
      return msImage;
    },

    capturer(): string | null {
      try {
        return canvas?.toDataURL('image/png') ?? null;
      } catch {
        return null;
      }
    },

    demonter(): void {
      boucle?.arreter();
      boucle = null;
      surface?.demonter();
      surface = null;
      cache?.vider();
      cache = null;
      camera = null;
      cadree = false;
      animees.clear();
      canvas?.remove();
      canvas = null;
      etat = null;
      vue = null;
    },
  };
}
