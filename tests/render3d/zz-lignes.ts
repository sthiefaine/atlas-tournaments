import { empreinte } from './empreinte-decor';
import { creerDecor } from '../../src/render3d/decor';
import { etatDeScenario } from './monde';
import { terrainLogique } from '../../src/engine/index';
import type { GrilleTerrain } from '../../src/render3d/geometrie';
import type { CleTerrain } from '../../src/schemas/index';
import carteDemo from '../../content/cartes/carte_plaine_symetrique.json';
import scenarioDemo from '../../content/scenarios/demo.json';

const { etat, cat } = etatDeScenario(carteDemo as never, scenarioDemo as never);
const grille: GrilleTerrain = {
  largeur: etat.largeur, hauteur: etat.hauteur,
  terrainDe: (x, y): CleTerrain => terrainLogique(etat, cat, { x, y }) ?? 'plaine',
};
const decor = creerDecor(grille, etat, () => 0, 'plaine');
for (const l of empreinte(decor.groupe).lignes) console.log(l);
