// `verifierCarte` est la passe structurelle que la routine contrôle réutilise :
// elle doit laisser passer une carte saine et nommer précisément ce qui cloche
// sur une carte abîmée, avec les codes de `MotifRejet`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { genererCarte, verifierCarte } from '../../src/mapgen/index';
import type { MapDef, ParametresCarte } from '../../src/schemas/types';

const parametres: ParametresCarte = {
  largeur: 20,
  hauteur: 14,
  camps: 2,
  biome: 'plaine',
  ratioMer: 0.2,
  ratioRelief: 0.18,
  villesParCamp: 4,
  villesNeutres: 3,
  usinesParCamp: 1,
  aeroportsParCamp: 1,
  symetrie: 'axe_vertical',
  densiteRoutes: 0.6,
};

/** Copie profonde d'une carte, pour l'abîmer sans toucher à l'originale. */
function copier(carte: MapDef): MapDef {
  return JSON.parse(JSON.stringify(carte)) as MapDef;
}

/** Écrit un caractère dans la grille. */
function ecrire(carte: MapDef, x: number, y: number, car: string): void {
  const ligne = carte.grille[y] as string;
  carte.grille[y] = ligne.slice(0, x) + car + ligne.slice(x + 1);
}

/** Première case portant ce caractère, en lecture haut-gauche. */
function trouver(carte: MapDef, car: string): { x: number; y: number } {
  for (let y = 0; y < carte.hauteur; y += 1) {
    const x = (carte.grille[y] as string).indexOf(car);
    if (x >= 0) return { x, y };
  }
  throw new Error(`aucun ${car} sur la carte`);
}

/** Les codes de motifs relevés sur une carte. */
function codes(carte: MapDef): string[] {
  return verifierCarte(carte).motifs.map((m) => m.code);
}

const saine = genererCarte(parametres, 2026);

test('une carte générée ne porte aucun motif', () => {
  const rapport = verifierCarte(saine);
  assert.deepEqual(rapport.motifs, []);
  assert.equal(rapport.ok, true);
  assert.equal(rapport.mesures['chemin_qg_qg'], 1);
  assert.equal(rapport.mesures['zones_mortes'], 0);
});

test('schema_invalide : une grille malformée est refusée avant tout le reste', () => {
  const abimee = copier(saine);
  abimee.grille[3] = 'ZZZ';
  const rapport = verifierCarte(abimee);
  assert.equal(rapport.ok, false);
  assert.deepEqual(rapport.motifs.map((m) => m.code), ['schema_invalide']);
  assert.ok((rapport.motifs[0]?.mesure['erreurs'] ?? 0) > 0);
});

test('qg_inaccessible : un QG cerné par la mer coupe la partie', () => {
  const abimee = copier(saine);
  const qg = trouver(saine, 'H');
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = qg.x + dx;
      const y = qg.y + dy;
      if (dx === 0 && dy === 0) continue;
      if (x < 0 || y < 0 || x >= abimee.largeur || y >= abimee.hauteur) continue;
      if (((abimee.grille[y] as string)[x]) === 'H') continue;
      delete abimee.proprietaires[`${x},${y}`];
      ecrire(abimee, x, y, 'W');
    }
  }
  abimee.unitesDepart = abimee.unitesDepart.filter(
    (u) => ((abimee.grille[u.y] as string)[u.x]) !== 'W',
  );
  assert.ok(codes(abimee).includes('qg_inaccessible'));
});

test('zone_morte : un îlot de terre hors d\'atteinte est relevé', () => {
  const abimee = copier(saine);
  // Coin bas-droit : une plaine entourée de mer, donc inatteignable.
  const x = abimee.largeur - 1;
  const y = abimee.hauteur - 1;
  ecrire(abimee, x, y, 'P');
  ecrire(abimee, x - 1, y, 'W');
  ecrire(abimee, x, y - 1, 'W');
  ecrire(abimee, x - 1, y - 1, 'W');
  for (const clef of [`${x},${y}`, `${x - 1},${y}`, `${x},${y - 1}`, `${x - 1},${y - 1}`]) {
    delete abimee.proprietaires[clef];
  }
  abimee.unitesDepart = abimee.unitesDepart.filter(
    (u) => ((abimee.grille[u.y] as string)[u.x]) !== 'W',
  );
  const rapport = verifierCarte(abimee);
  assert.ok(rapport.motifs.some((m) => m.code === 'zone_morte'));
  assert.ok((rapport.motifs.find((m) => m.code === 'zone_morte')?.mesure['zones_mortes'] ?? 0) >= 1);
});

test('desequilibre_villes et desequilibre_fonds : une ville offerte au camp 0', () => {
  const abimee = copier(saine);
  const qg = trouver(saine, 'H');
  const camp = abimee.proprietaires[`${qg.x},${qg.y}`] ?? 0;
  let pose = false;
  for (let dy = -2; dy <= 2 && !pose; dy += 1) {
    for (let dx = -2; dx <= 2 && !pose; dx += 1) {
      const x = qg.x + dx;
      const y = qg.y + dy;
      if (x < 0 || y < 0 || x >= abimee.largeur || y >= abimee.hauteur) continue;
      if (((abimee.grille[y] as string)[x]) !== 'P') continue;
      ecrire(abimee, x, y, 'C');
      abimee.proprietaires[`${x},${y}`] = camp;
      pose = true;
    }
  }
  assert.ok(pose, 'une plaine libre existe près du QG');
  const releves = codes(abimee);
  assert.ok(releves.includes('desequilibre_villes'), releves.join(','));
  assert.ok(releves.includes('desequilibre_fonds'), releves.join(','));
});

test('depart_bloque : une unité posée sur la mer est refusée', () => {
  const abimee = copier(saine);
  const mer = trouver(saine, 'W');
  const unite = abimee.unitesDepart[0];
  assert.ok(unite, 'la carte porte des unités de départ');
  unite.x = mer.x;
  unite.y = mer.y;
  assert.ok(codes(abimee).includes('depart_bloque'));
});

test('economie_insuffisante : des villes neutres demandées mais aucune posée', () => {
  const abimee = copier(saine);
  for (let y = 0; y < abimee.hauteur; y += 1) {
    for (let x = 0; x < abimee.largeur; x += 1) {
      if (((abimee.grille[y] as string)[x]) !== 'C') continue;
      if (abimee.proprietaires[`${x},${y}`] !== undefined) continue;
      ecrire(abimee, x, y, 'P');
    }
  }
  assert.ok(codes(abimee).includes('economie_insuffisante'));
});
