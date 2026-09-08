// Bâtir le monde entier hors navigateur, comme `creerRendu3d` le bâtit.
//
// `batir()` (`render3d/index.ts`) assemble plateau, décor, unités,
// surbrillances, effets et éclairage à la première image. Un test qui veut
// juger la scène *entière* — combien de programmes, combien de tirages — doit
// pouvoir l'assembler à l'identique, sans canevas ni carte graphique. C'est ce
// que fait ce module : mêmes appels, même ordre, mêmes greffes.
import * as THREE from 'three/webgpu';

import {
  chargerCatalogue, creerPartie, sceneDepuis, terrainLogique, type Catalogue, type EtatPartie,
} from '../../src/engine/index';
import { creerDecor, type Decor } from '../../src/render3d/decor';
import { creerEclairage, parametresAmbiance, type Eclairage } from '../../src/render3d/eclairage';
import { creerEffets, type Effets } from '../../src/render3d/effets';
import type { GrilleTerrain } from '../../src/render3d/geometrie';
import { tailleCarteOmbre } from '../../src/render3d/ombres';
import { creerSurbrillances, type CoucheSurbrillances } from '../../src/render3d/surbrillances';
import { creerPlateau, grefferBrouillardSur, type Plateau } from '../../src/render3d/terrain';
import { creerUnites, type CalqueUnites } from '../../src/render3d/unites';
import { validerMapDef, validerScenario, type Biome, type CleTerrain } from '../../src/schemas/index';

/**
 * Une toile en mémoire : les recettes de texture n'ont pas besoin d'un
 * navigateur. Le contexte rend une image vide pour ce qui se lit, et absorbe
 * tout le reste — dégradés, traits, transformations : on mesure la structure de
 * la scène, pas ses pixels.
 */
export function documentMemoire(): Document {
  const contexte = (): CanvasRenderingContext2D => {
    const connus: Record<string, unknown> = {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
    };
    return new Proxy(connus, {
      get: (cible, prop: string) => cible[prop] ?? ((): void => {}),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
  };
  return {
    createElement: () => ({ width: 0, height: 0, getContext: contexte }),
  } as unknown as Document;
}

/** L'état de départ d'un scénario du canon, carte comprise. */
export function etatDeScenario(carte: unknown, scenario: unknown): { etat: EtatPartie; cat: Catalogue } {
  const map = validerMapDef(carte);
  const sc = validerScenario(scenario);
  if (!map.ok || !sc.ok) throw new Error('contenu invalide');
  const cat = chargerCatalogue(sc.valeur.catalogueVersion ?? 1);
  return { etat: creerPartie(sceneDepuis(sc.valeur, map.valeur, []), cat, 'mesure:1'), cat };
}

export interface MondeEssai {
  scene: THREE.Scene;
  plateau: Plateau;
  decor: Decor;
  unites: CalqueUnites;
  surbrillances: CoucheSurbrillances;
  effets: Effets;
  eclairage: Eclairage;
  dispose(): void;
}

/** Le monde de la première image : tout est posé, rien n'est dessiné. */
export function batirMonde(e: EtatPartie, cat: Catalogue, biome: Biome = 'plaine'): MondeEssai {
  const doc = documentMemoire();
  const scene = new THREE.Scene();
  const grille: GrilleTerrain = {
    largeur: e.largeur,
    hauteur: e.hauteur,
    terrainDe: (x, y): CleTerrain => terrainLogique(e, cat, { x, y }) ?? 'plaine',
  };
  const plateau = creerPlateau(grille, doc, biome);
  const decor = creerDecor(grille, e, plateau.hauteurEn, biome);
  grefferBrouillardSur(decor.groupe, plateau.uniformesBrouillard, 'atlas-brouillard-decor-v1');
  const unites = creerUnites(doc, plateau.hauteurEn);
  const surbrillances = creerSurbrillances(plateau.hauteurEn);
  const effets = creerEffets(doc);
  const depart = parametresAmbiance(e.climat.saison, e.climat.phase, e.climat.meteo);
  const eclairage = creerEclairage(
    scene, doc, depart,
    (x, z) => x >= 0 && z >= 0 && x < e.largeur && z < e.hauteur ? plateau.hauteurEn(x, z) : null,
    { tailleOmbre: tailleCarteOmbre(false) },
  );
  scene.add(plateau.groupe, decor.groupe, unites.groupe, surbrillances.groupe, effets.groupe, eclairage.groupe);
  plateau.appliquerAmbiance(depart);
  decor.appliquerAmbiance(depart, e.climat.saison);
  unites.appliquerAmbiance(depart);
  unites.maj(e, cat, null);
  decor.majProprietaires(e, null);
  return {
    scene, plateau, decor, unites, surbrillances, effets, eclairage,
    dispose(): void {
      plateau.dispose(); decor.dispose(); unites.dispose();
      surbrillances.dispose(); effets.dispose(); eclairage.dispose();
    },
  };
}
