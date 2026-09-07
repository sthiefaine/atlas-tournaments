// Le générateur de cartes : déterminisme, validité de masse, équité et accessibilité.
// Les paramètres de la campagne de 200 cartes sont tirés d'un flux seedé : le
// lot est le même à chaque exécution, donc un échec est reproductible.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  apercuTexte, creerRng, genererCarte, mesurer, verifierCarte,
} from '../../src/mapgen/index';
import { validerMapDef, validerParametresCarte } from '../../src/schemas/index';
import { BIOMES, CARACTERES_CAPTURABLES, SYMETRIES, type ParametresCarte } from '../../src/schemas/types';

/** Paramètres d'exemple, ceux de `doc/03-schemas.md` §5. */
const bretagne: ParametresCarte = {
  largeur: 16,
  hauteur: 12,
  camps: 2,
  biome: 'cotier',
  ratioMer: 0.22,
  ratioRelief: 0.14,
  villesParCamp: 3,
  villesNeutres: 2,
  usinesParCamp: 1,
  aeroportsParCamp: 0,
  symetrie: 'axe_vertical',
  densiteRoutes: 0.6,
  mecanique: 'meca_marees',
};

/** Tire un jeu de paramètres dans toutes les bornes du schéma. */
function parametresAuHasard(rng: ReturnType<typeof creerRng>): ParametresCarte {
  return {
    largeur: rng.entre(10, 40),
    hauteur: rng.entre(10, 30),
    camps: rng.entre(2, 4) as 2 | 3 | 4,
    biome: rng.choisir(BIOMES),
    ratioMer: rng.suivant() * 0.6,
    ratioRelief: rng.suivant() * 0.4,
    villesParCamp: rng.entre(2, 10),
    villesNeutres: rng.entre(0, 12),
    usinesParCamp: rng.entre(1, 3),
    aeroportsParCamp: rng.entre(0, 2),
    symetrie: rng.choisir(SYMETRIES),
    densiteRoutes: rng.suivant(),
    // Ports et radars (7 septembre 2026), tirés en dernier : les champs
    // précédents gardent les valeurs qu'ils avaient avant leur arrivée.
    portsParCamp: rng.entre(0, 2),
    radarsParCamp: rng.entre(0, 2),
  };
}

test('déterminisme : mêmes paramètres et même graine donnent le même JSON', () => {
  const a = genererCarte(bretagne, 1832771904);
  const b = genererCarte(bretagne, 1832771904);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(apercuTexte(a), apercuTexte(b));
});

test('déterminisme : deux graines donnent deux cartes différentes', () => {
  const grilles = new Set<string>();
  for (const graine of [1, 2, 3, 7, 11, 101, 2026]) {
    grilles.add(genererCarte(bretagne, graine).grille.join('\n'));
  }
  assert.equal(grilles.size, 7, 'sept graines doivent donner sept grilles distinctes');
});

test('déterminisme : les paramètres enregistrés rejouent la même grille', () => {
  // C'est le contrôle du serveur (`03-schemas.md` §5) : il rejoue
  // genererCarte(generation.parametres, generation.graine) et compare.
  const rng = creerRng(4242);
  for (let i = 0; i < 25; i += 1) {
    const graine = rng.entier(2 ** 31);
    const carte = genererCarte(parametresAuHasard(rng), graine);
    const generation = carte.generation;
    assert.ok(generation, 'une carte générée porte son bloc generation');
    const rejouee = genererCarte(generation.parametres, Number(generation.graine));
    assert.deepEqual(rejouee.grille, carte.grille);
    assert.deepEqual(rejouee.proprietaires, carte.proprietaires);
    assert.deepEqual(rejouee.unitesDepart, carte.unitesDepart);
  }
});

test('validité : 200 cartes tirées au hasard passent le schéma et les vérifications', () => {
  const rng = creerRng(20260905);
  const total = 200;
  const motifs = new Map<string, number>();
  let echecs = 0;

  for (let i = 0; i < total; i += 1) {
    const parametres = parametresAuHasard(rng);
    assert.ok(validerParametresCarte(parametres).ok, 'le tirage reste dans les bornes du schéma');
    const carte = genererCarte(parametres, rng.entier(2 ** 31));

    const lue = validerMapDef(carte);
    if (!lue.ok) {
      echecs += 1;
      motifs.set('schema_invalide', (motifs.get('schema_invalide') ?? 0) + 1);
      continue;
    }
    const rapport = verifierCarte(carte);
    if (!rapport.ok) {
      echecs += 1;
      for (const motif of rapport.motifs) {
        motifs.set(motif.code, (motifs.get(motif.code) ?? 0) + 1);
      }
    }
  }

  const taux = (echecs / total) * 100;
  const detail = [...motifs.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([code, n]) => `${code}×${n}`).join(', ');
  console.log(`  mapgen : ${total - echecs}/${total} cartes valides, taux d'échec ${taux.toFixed(1)} %${detail ? ` (${detail})` : ''}`);
  assert.ok(taux < 10, `taux d'échec de ${taux.toFixed(1)} %, au-dessus des 10 % tolérés`);
});

test('symétrie de valeur : l\'écart entre camps reste sous 5 %', () => {
  const rng = creerRng(777);
  let pire = 0;
  for (let i = 0; i < 60; i += 1) {
    const carte = genererCarte(parametresAuHasard(rng), rng.entier(2 ** 31));
    const ecart = mesurer(carte)['asymetrie_de_valeur'] ?? 1;
    if (ecart > pire) pire = ecart;
    assert.ok(ecart < 0.05, `écart de valeur de ${(ecart * 100).toFixed(2)} % sur ${carte.code}`);
  }
  console.log(`  mapgen : écart de valeur maximal observé ${(pire * 100).toFixed(2)} %`);
});

test('accessibilité : tout QG atteint tout autre QG par voie terrestre', () => {
  const rng = creerRng(31337);
  for (let i = 0; i < 60; i += 1) {
    const carte = genererCarte(parametresAuHasard(rng), rng.entier(2 ** 31));
    const mesures = mesurer(carte);
    assert.equal(mesures['chemin_qg_qg'], 1, `QG isolés sur ${carte.code}`);
    assert.equal(mesures['zones_mortes'], 0, `zone morte sur ${carte.code}`);
    assert.ok((mesures['distance_qg_qg'] ?? 0) > 0, 'les QG ne se touchent pas');
  }
});

test('structure : un QG par camp, propriétaires sur des cases capturables, unités symétriques', () => {
  const rng = creerRng(99);
  for (let i = 0; i < 40; i += 1) {
    const parametres = parametresAuHasard(rng);
    const carte = genererCarte(parametres, rng.entier(2 ** 31));

    const qg = carte.grille.join('').split('').filter((c) => c === 'H').length;
    assert.equal(qg, carte.camps, `${qg} QG pour ${carte.camps} camps`);

    for (const [clef, camp] of Object.entries(carte.proprietaires)) {
      const [x, y] = clef.split(',').map(Number) as [number, number];
      const car = (carte.grille[y] ?? '')[x];
      assert.ok(CARACTERES_CAPTURABLES.includes(car ?? ''), `propriétaire sur ${car ?? '?'} en ${clef}`);
      assert.ok(camp < carte.camps, 'camp hors des camps de la carte');
    }

    // Chaque camp reçoit le même nombre d'unités, du même type.
    const parCamp = new Map<number, string[]>();
    for (const unite of carte.unitesDepart) {
      parCamp.set(unite.camp, [...(parCamp.get(unite.camp) ?? []), unite.type]);
    }
    const listes = [...parCamp.keys()].sort((a, b) => a - b)
      .map((camp) => (parCamp.get(camp) ?? []).slice().sort().join(','));
    assert.equal(new Set(listes).size <= 1, true, `unités de départ asymétriques : ${listes.join(' | ')}`);
  }
});

test('mécanique : la carte recopie la mécanique régionale des paramètres', () => {
  const carte = genererCarte(bretagne, 5);
  assert.equal(carte.mecanique, 'meca_marees');
  assert.equal(carte.generation?.parametres.mecanique, 'meca_marees');
  const sansMecanique = genererCarte({ ...bretagne, mecanique: undefined }, 5);
  assert.equal(sansMecanique.mecanique, 'meca_marees');
});

test('robustesse : des paramètres hors bornes sont ramenés dans les bornes', () => {
  const fantaisistes = {
    largeur: 400, hauteur: -3, camps: 9, biome: 'lave', ratioMer: 4, ratioRelief: -1,
    villesParCamp: 99, villesNeutres: 99, usinesParCamp: 0, aeroportsParCamp: 7,
    symetrie: 'spirale', densiteRoutes: 12,
  } as unknown as ParametresCarte;
  const carte = genererCarte(fantaisistes, 3);
  assert.ok(validerMapDef(carte).ok, 'une carte reste produite et valide');
  assert.ok(validerParametresCarte(carte.generation?.parametres).ok);
  assert.equal(carte.largeur, 40);
  assert.equal(carte.hauteur, 10);
  assert.equal(carte.camps, 4);
});
