/**
 * # Rendu 3D d'Atlas Tournament — API publique
 *
 * `creerRendu3d()` rend un `Rendu` (`render/rendu.ts`), exactement le même
 * contrat que le rendu vectoriel : le contrôleur, le HUD et `monterJeu()` ne
 * savent pas lequel des deux ils pilotent. C'est ce qui permet de garder la 2D
 * comme repli sans jamais dupliquer une règle d'interaction.
 *
 * L'assemblage suit le brief : plateau texturé et mélangé par splat map
 * (`terrain.ts`), décor instancié (`decor.ts`), unités composées depuis la
 * silhouette (`unites.ts`), décalques de surbrillance au sol
 * (`surbrillances.ts`), éclairage et météo (`eclairage.ts`), animations
 * promise-based (`animations.ts`), le tout dans une boucle paresseuse
 * (`scene.ts`).
 *
 * three.js n'est importé que dans ce dossier ; le reste du dépôt ne le voit pas.
 */

import * as THREE from 'three';

import type { EtatPartie, EvenementJeu } from '../engine/index';
import { terrainLogique } from '../engine/index';
import { Boucle } from '../render/boucle';
import { toucheDe } from '../render/entrees';
import type {
  GestesRendu, PointVue, Rendu, VueInteraction,
} from '../render/rendu';
import type { Case, CleTerrain } from '../schemas/types';
import { construireAnimations } from './animations';
import { creerVue3d, type Vue3d } from './camera';
import { creerDecor, type Decor } from './decor';
import { creerEclairage, parametresAmbiance, type Eclairage } from './eclairage';
import { CASE, caseVersMonde, type GrilleTerrain } from './geometrie';
import { creerScene3d, type Scene3d } from './scene';
import { creerSurbrillances, type CoucheSurbrillances } from './surbrillances';
import { creerPlateau, type Plateau } from './terrain';
import { creerUnites, type CalqueUnites } from './unites';

export { parametresAmbiance, melangerParametres, type ParametresAmbiance } from './eclairage';
export {
  CASE, caseVersMonde, construireSplat, hauteurEn, hauteurTerrain, HAUTEURS, mondeVersCase,
  NIVEAU_EAU, solDeCase, splatCase, splatTerrain, type GrilleTerrain, type Splat,
} from './geometrie';
export {
  composerSilhouette, echelleTaille, hauteurSilhouette, nomsPieces,
  type Piece, type RolePiece,
} from './pieces';
export {
  distanceCadrage, palierDistance, palierSuivant, positionCamera, TANGAGE_DEFAUT,
  TANGAGE_MAX, TANGAGE_MIN, type EtatCamera,
} from './camera';
export { cheminEnL, longueurChemin, surChemin } from './animations';
export { chargerModele, RACINE_MODELES } from './unites';

/** Millisecondes entre deux images au repos : de quoi faire vivre l'eau. */
const MS_REPOS = 1000;

/** Le monde monté : tout ce qui dépend de la carte, donc du premier état. */
interface Monde {
  grille: GrilleTerrain;
  plateau: Plateau;
  decor: Decor;
  unites: CalqueUnites;
  surbrillances: CoucheSurbrillances;
  eclairage: Eclairage;
  effets: THREE.Group;
  vue3d: Vue3d;
}

/** Crée le rendu 3D. */
export function creerRendu3d(): Rendu {
  let scene3d: Scene3d | null = null;
  let conteneurRef: HTMLElement | null = null;
  let monde: Monde | null = null;
  let boucle: Boucle | null = null;
  let repos: ReturnType<typeof setInterval> | null = null;
  let etat: EtatPartie | null = null;
  let vue: VueInteraction | null = null;
  let cleAmbiance = '';
  let cadree = false;

  function salir(): void {
    boucle?.salir();
  }

  /** Construit le monde à la première image : c'est là qu'on connaît la carte. */
  function batir(e: EtatPartie, v: VueInteraction): Monde | null {
    const s = scene3d;
    const conteneur = conteneurRef;
    if (!s || !conteneur) return null;
    const doc = conteneur.ownerDocument;
    const grille: GrilleTerrain = {
      largeur: e.largeur,
      hauteur: e.hauteur,
      terrainDe: (x, y): CleTerrain => terrainLogique(e, v.catalogue, { x, y }) ?? 'plaine',
    };
    const plateau = creerPlateau(grille, doc);
    const decor = creerDecor(grille, e, plateau.hauteurEn);
    const unites = creerUnites(doc, plateau.hauteurEn);
    const surbrillances = creerSurbrillances(plateau.hauteurEn);
    const effets = new THREE.Group();
    effets.name = 'effets';
    const depart = parametresAmbiance(e.climat.saison, e.climat.phase, e.climat.meteo);
    const eclairage = creerEclairage(s.scene, doc, depart);
    const vue3d = creerVue3d({ largeur: e.largeur, hauteur: e.hauteur });

    s.scene.add(plateau.groupe, decor.groupe, unites.groupe, surbrillances.groupe, effets, eclairage.groupe);
    vue3d.redimensionner(s.largeur, s.hauteur);
    vue3d.cadrerCarte();

    // Les ombres couvrent la carte entière : une seule carte d'ombre suffit
    // pour un plateau, inutile de la déplacer avec la caméra.
    const rayon = Math.max(e.largeur, e.hauteur) * CASE * 0.75 + 4;
    const cam = eclairage.soleil.shadow.camera;
    cam.left = -rayon;
    cam.right = rayon;
    cam.top = rayon;
    cam.bottom = -rayon;
    cam.far = rayon * 4 + 60;
    cam.updateProjectionMatrix();

    plateau.appliquerAmbiance(depart);
    decor.appliquerAmbiance(depart, e.climat.saison);
    cleAmbiance = v.ambiance.cle;
    return {
      grille, plateau, decor, unites, surbrillances, eclairage, effets, vue3d,
    };
  }

  function dessiner(ecoule: number): void {
    const s = scene3d;
    const m = monde;
    if (!s || !m) return;
    let encore = false;
    encore = m.eclairage.avancer(ecoule, m.vue3d.cible) || encore;
    encore = m.plateau.avancer(ecoule) || encore;
    encore = m.decor.avancer(ecoule) || encore;
    encore = m.surbrillances.avancer(ecoule) || encore;
    const p = m.eclairage.courant;
    m.plateau.appliquerAmbiance(p);
    if (vue) m.decor.appliquerAmbiance(p, vue.ambiance.saison);
    s.renderer.toneMappingExposure = p.exposition;
    s.dessiner(m.vue3d.camera);
    if (encore) salir();
  }

  function majMonde(): void {
    const m = monde;
    if (!m || !etat || !vue) return;
    m.decor.majProprietaires(etat);
    m.unites.maj(etat, vue.catalogue, vue.visibles);
    const position = vue.selection ? m.unites.positionDe(vue.selection) : null;
    m.surbrillances.maj(vue.surbrillances, vue.chemin, vue.curseur, position);
    if (vue.ambiance.cle !== cleAmbiance) {
      cleAmbiance = vue.ambiance.cle;
      m.eclairage.viser(parametresAmbiance(
        vue.ambiance.saison, vue.ambiance.phase, vue.ambiance.meteo,
      ));
    }
  }

  return {
    cle: '3d',

    get canvas(): HTMLCanvasElement | null {
      return scene3d?.canvas ?? null;
    },

    monter(conteneur: HTMLElement): void {
      conteneurRef = conteneur;
      scene3d = creerScene3d(conteneur, {
        surRedimension: (l, h) => {
          monde?.vue3d.redimensionner(l, h);
          salir();
        },
      });
      boucle = new Boucle(dessiner);
      repos = setInterval(() => salir(), MS_REPOS);
    },

    afficher(e: EtatPartie, v: VueInteraction): void {
      etat = e;
      vue = v;
      if (!monde) monde = batir(e, v);
      majMonde();
      salir();
    },

    animer(evenements: readonly EvenementJeu[], avant: EtatPartie): Promise<void> {
      const m = monde;
      const s = scene3d;
      const b = boucle;
      if (!m || !s || !b || !conteneurRef) return Promise.resolve();
      const { animations, attentes } = construireAnimations(evenements, avant, {
        unites: m.unites,
        effets: m.effets,
        document: conteneurRef.ownerDocument,
        hauteurEn: m.plateau.hauteurEn,
        salir: () => {
          majMonde();
          salir();
        },
      });
      for (const a of animations) b.ajouter(a);
      salir();
      return attentes.length === 0
        ? Promise.resolve()
        : Promise.all(attentes).then(() => undefined);
    },

    versMonde(x: number, y: number): Case | null {
      const m = monde;
      if (!m) return null;
      return m.vue3d.caseSous(x, y, m.plateau.sol);
    },

    versEcran(c: Case): PointVue | null {
      const m = monde;
      if (!m) return null;
      const p = caseVersMonde(c);
      return m.vue3d.versEcran(new THREE.Vector3(p.x, m.plateau.hauteurEn(p.x, p.z) + 0.3, p.z));
    },

    brancher(gestes: GestesRendu): () => void {
      const canvas = scene3d?.canvas;
      if (!canvas) return () => undefined;
      const doigts = new Map<number, { x: number; y: number; debutX: number; debutY: number }>();
      let glisse = false;
      let ecart = 0;

      const local = (e: PointerEvent): { x: number; y: number } => {
        const boite = canvas.getBoundingClientRect();
        return { x: e.clientX - boite.left, y: e.clientY - boite.top };
      };
      const caseSous = (x: number, y: number): Case | null => (
        monde ? monde.vue3d.caseSous(x, y, monde.plateau.sol) : null
      );

      const surDown = (e: PointerEvent): void => {
        const p = local(e);
        canvas.setPointerCapture?.(e.pointerId);
        doigts.set(e.pointerId, { x: p.x, y: p.y, debutX: p.x, debutY: p.y });
        if (doigts.size === 2) {
          const [a, b] = [...doigts.values()];
          if (a && b) ecart = Math.hypot(a.x - b.x, a.y - b.y);
          glisse = true;
        } else {
          // Le bouton droit et le bouton du milieu font glisser ; le gauche joue.
          glisse = e.button === 2 || e.button === 1;
        }
      };

      const surMove = (e: PointerEvent): void => {
        const p = local(e);
        const doigt = doigts.get(e.pointerId);
        if (!doigt) {
          const c = caseSous(p.x, p.y);
          if (c) gestes.surSurvolCase?.(c);
          return;
        }
        const dx = p.x - doigt.x;
        const dy = p.y - doigt.y;
        doigt.x = p.x;
        doigt.y = p.y;
        if (doigts.size >= 2) {
          const [a, b] = [...doigts.values()];
          if (a && b) {
            const nouvel = Math.hypot(a.x - b.x, a.y - b.y);
            if (ecart > 4 && nouvel > 4) monde?.vue3d.facteurZoom(nouvel / ecart);
            ecart = nouvel;
          }
          monde?.vue3d.glisser(dx / 2, dy / 2);
          salir();
          return;
        }
        if (!glisse) {
          if (Math.hypot(p.x - doigt.debutX, p.y - doigt.debutY) < 6) return;
          glisse = true;
        }
        monde?.vue3d.glisser(dx, dy);
        salir();
      };

      const surUp = (e: PointerEvent): void => {
        const doigt = doigts.get(e.pointerId);
        doigts.delete(e.pointerId);
        canvas.releasePointerCapture?.(e.pointerId);
        if (doigts.size < 2) ecart = 0;
        if (!doigt) return;
        const bouge = Math.hypot(doigt.x - doigt.debutX, doigt.y - doigt.debutY) > 6;
        if (!bouge) {
          if (e.button === 2) gestes.surAnnuler?.();
          else {
            const c = caseSous(doigt.x, doigt.y);
            if (c) gestes.surClicCase?.(c);
          }
        }
        if (doigts.size === 0) glisse = false;
      };

      const surWheel = (e: WheelEvent): void => {
        e.preventDefault();
        monde?.vue3d.zoomer(e.deltaY < 0 ? 1 : -1);
        salir();
      };

      const surContextMenu = (e: Event): void => e.preventDefault();

      const surKey = (e: KeyboardEvent): void => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        // Q et E tournent la caméra d'un quart de tour : le brief les réserve.
        if (e.code === 'KeyQ' || e.code === 'KeyE') {
          e.preventDefault();
          monde?.vue3d.tourner(e.code === 'KeyQ' ? -1 : 1);
          salir();
          return;
        }
        const touche = toucheDe(e.code);
        if (!touche) return;
        e.preventDefault();
        if (touche === 'zoom_plus' || touche === 'zoom_moins') {
          monde?.vue3d.zoomer(touche === 'zoom_plus' ? 1 : -1);
          salir();
          return;
        }
        gestes.surTouche?.(touche);
      };

      canvas.addEventListener('pointerdown', surDown);
      canvas.addEventListener('pointermove', surMove);
      canvas.addEventListener('pointerup', surUp);
      canvas.addEventListener('pointercancel', surUp);
      canvas.addEventListener('wheel', surWheel, { passive: false });
      canvas.addEventListener('contextmenu', surContextMenu);
      canvas.addEventListener('keydown', surKey);

      return (): void => {
        canvas.removeEventListener('pointerdown', surDown);
        canvas.removeEventListener('pointermove', surMove);
        canvas.removeEventListener('pointerup', surUp);
        canvas.removeEventListener('pointercancel', surUp);
        canvas.removeEventListener('wheel', surWheel);
        canvas.removeEventListener('contextmenu', surContextMenu);
        canvas.removeEventListener('keydown', surKey);
      };
    },

    msParImage(): number {
      return scene3d?.msParImage ?? 0;
    },

    capturer(): string | null {
      const s = scene3d;
      const m = monde;
      if (!s || !m) return null;
      try {
        // Le tampon WebGL n'est pas préservé entre deux compositions : on
        // redessine juste avant de lire, dans la même tâche.
        s.dessiner(m.vue3d.camera);
        return s.canvas.toDataURL('image/png');
      } catch {
        return null;
      }
    },

    cadrer(c: Case): void {
      const m = monde;
      if (!m) return;
      if (!cadree) {
        cadree = true;
        m.vue3d.cadrerCarte();
        salir();
        return;
      }
      const p = caseVersMonde(c);
      m.vue3d.cadrerCase(c, m.plateau.hauteurEn(p.x, p.z));
      salir();
    },

    demonter(): void {
      if (repos !== null) clearInterval(repos);
      repos = null;
      boucle?.arreter();
      boucle = null;
      if (monde) {
        monde.surbrillances.dispose();
        monde.unites.dispose();
        monde.decor.dispose();
        monde.plateau.dispose();
        monde.eclairage.dispose();
        scene3d?.scene.clear();
        monde = null;
      }
      scene3d?.dispose();
      scene3d = null;
      conteneurRef = null;
      etat = null;
      vue = null;
      cadree = false;
      cleAmbiance = '';
    },
  };
}

/** Vrai si le navigateur courant peut faire tourner ce rendu. */
export function rendu3dDisponible(): boolean {
  try {
    const d = (globalThis as { document?: Document }).document;
    if (!d) return false;
    return Boolean(d.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}
