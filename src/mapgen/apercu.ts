/**
 * Aperçu texte d'une carte : ce que le serveur renvoie à la routine map pour
 * qu'elle commente, une seule fois (`05-routines.md` §3.3).
 *
 * L'aperçu reprend **les caractères de grille du schéma** (`04-gameplay.md` §4),
 * pas une seconde symbolique : la routine lit la carte dans le même alphabet que
 * celui qu'elle retrouvera dans la `MapDef`, et rien ne se perd à la traduction.
 */

import { chargerTerrains } from '../content/index';
import type { CampId, MapDef } from '../schemas/types';
import { mesurer } from './verifier';

const NOMS_TERRAIN = ((): Record<string, string> => {
  const table: Record<string, string> = {};
  for (const t of chargerTerrains()) table[t.car] = t.nom.toLowerCase();
  return table;
})();

/** Ordre d'affichage des caractères dans la légende. */
const ORDRE = ['W', 'S', 'V', 'N', 'P', 'F', 'M', 'R', 'C', 'U', 'A', 'H'];

/** Règle de colonnes : le chiffre des unités, suffisant jusqu'à 40 de large. */
function regle(largeur: number, marge: number): string {
  let ligne = ' '.repeat(marge);
  for (let x = 0; x < largeur; x += 1) ligne += String(x % 10);
  return ligne;
}

/** Liste « type (x,y) » des propriétés d'un camp, ou des neutres. */
function proprietesDe(map: MapDef, camp: CampId | null): string {
  const noms: Record<string, string> = { C: 'ville', U: 'usine', A: 'aéroport', H: 'QG' };
  const sortie: string[] = [];
  for (let y = 0; y < map.hauteur; y += 1) {
    const ligne = map.grille[y] ?? '';
    for (let x = 0; x < map.largeur; x += 1) {
      const car = ligne[x] ?? '';
      const nom = noms[car];
      if (nom === undefined) continue;
      const proprietaire = map.proprietaires[`${x},${y}`];
      const cible = proprietaire === undefined ? null : proprietaire;
      if (cible !== camp) continue;
      sortie.push(`${nom} (${x},${y})`);
    }
  }
  return sortie.length > 0 ? sortie.join(' · ') : '—';
}

/**
 * Rend la carte en texte : grille, légende, propriétaires et unités de départ
 * en clair, puis les mesures d'équilibre. C'est un texte de relecture, jamais
 * une entrée du moteur — la carte reste la `MapDef`.
 */
export function apercuTexte(map: MapDef): string {
  const marge = String(map.hauteur - 1).length + 2;
  const lignes: string[] = [];

  lignes.push(`${map.nom} — ${map.code}`);
  const entete = [
    `${map.largeur}×${map.hauteur}`,
    `${map.camps} camps`,
    `biome ${map.biome}`,
  ];
  if (map.mecanique !== undefined) entete.push(`mécanique ${map.mecanique}`);
  if (map.generation !== undefined) entete.push(`graine ${map.generation.graine}`);
  lignes.push(entete.join(' · '));
  lignes.push('');

  lignes.push(regle(map.largeur, marge));
  for (let y = 0; y < map.hauteur; y += 1) {
    lignes.push(`${String(y).padStart(marge - 1, ' ')} ${map.grille[y] ?? ''}`);
  }
  lignes.push('');

  const presents = new Set<string>();
  for (const ligne of map.grille) for (const car of ligne) presents.add(car);
  const legende = ORDRE
    .filter((car) => presents.has(car))
    .map((car) => `${car} ${NOMS_TERRAIN[car] ?? '?'}`)
    .join(' · ');
  lignes.push(`Légende : ${legende}`);
  lignes.push('');

  lignes.push('Propriétaires');
  for (let camp = 0; camp < map.camps; camp += 1) {
    lignes.push(`  camp ${camp} : ${proprietesDe(map, camp as CampId)}`);
  }
  lignes.push(`  neutres : ${proprietesDe(map, null)}`);
  lignes.push('');

  lignes.push('Unités de départ');
  for (let camp = 0; camp < map.camps; camp += 1) {
    const miennes = map.unitesDepart
      .filter((u) => u.camp === camp)
      .map((u) => `${u.type} (${u.x},${u.y})`);
    lignes.push(`  camp ${camp} : ${miennes.length > 0 ? miennes.join(' · ') : '—'}`);
  }
  lignes.push('');

  const mesures = mesurer(map);
  const rendu = Object.keys(mesures).sort()
    .map((clef) => `${clef}=${mesures[clef] as number}`)
    .join(' · ');
  lignes.push(`Mesures : ${rendu}`);

  return lignes.join('\n');
}
