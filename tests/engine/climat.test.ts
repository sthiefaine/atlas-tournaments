/**
 * Climat : saison depuis la date et l'hémisphère, cycle jour/nuit, tirage de la
 * météo, prévisions, et effets chiffrés (`doc/04-gameplay.md` §12).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquer, avancerClimat, brouillardActif, coutEntree, creerRng, cycleEffectif,
  effetsSaison, effetsSaisonPartie, initialiserClimat, meteoPossible, phaseDe,
  reglagesParDefaut, saisonDe, TABLE_METEO, terrainLogique, tirerMeteo, visionUnite,
  type EtatPartie,
} from '../../src/engine/index';
import { CLIMATS, SAISONS, type Meteo } from '../../src/schemas/index';
import { CAT, partiePersonnalisee, u } from './aides';

const GRILLE = [
  'HPVPMPFPPH',
  'PPVPPPPPPP',
  'PPVPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
];

test("la saison suit la date et l'hémisphère", () => {
  assert.equal(saisonDe('2026-01-15', 'nord'), 'hiver');
  assert.equal(saisonDe('2026-01-15', 'sud'), 'ete');
  assert.equal(saisonDe('2026-07-01', 'nord'), 'ete');
  assert.equal(saisonDe('2026-07-01', 'sud'), 'hiver');
  assert.equal(saisonDe('2026-09-05', 'nord'), 'automne');
  assert.equal(saisonDe('2026-09-05', 'equateur'), 'automne');
});

test('la table climat × saison est celle du §12.2', () => {
  assert.deepEqual(effetsSaison('tempere', 'hiver'), ['neige_plaines', 'rivieres_gelees']);
  assert.deepEqual(effetsSaison('aride', 'ete'), ['canicule_saison']);
  assert.deepEqual(effetsSaison('tempere', 'ete'), []);
  assert.ok(effetsSaison('polaire', 'hiver').includes('nuit_polaire'));
});

test('chaque ligne de la table de météo somme à 100', () => {
  for (const climat of CLIMATS) {
    for (const saison of SAISONS) {
      const somme = TABLE_METEO[climat][saison].reduce((a, b) => a + b, 0);
      assert.equal(somme, 100, `${climat} × ${saison}`);
    }
  }
});

test('la météo tirée reste dans les possibilités de sa ligne', () => {
  for (const climat of CLIMATS) {
    for (const saison of SAISONS) {
      const rng = creerRng(`${climat}-${saison}`);
      for (let i = 0; i < 50; i += 1) {
        const m = tirerMeteo(climat, saison, rng);
        assert.ok(meteoPossible(climat, saison, m), `${climat} ${saison} ${m}`);
      }
    }
  }
});

test('deux exécutions de la même graine donnent la même suite de météos', () => {
  const reglages = reglagesParDefaut({ climatPays: 'oceanique', date: '2026-11-02' });
  const suite = (graine: string): Meteo[] => {
    const rng = creerRng(graine);
    let climat = initialiserClimat(reglages, rng);
    const sortie: Meteo[] = [climat.meteo];
    for (let i = 0; i < 10; i += 1) {
      climat = avancerClimat(climat, reglages, rng);
      sortie.push(climat.meteo);
    }
    return sortie;
  };
  assert.deepEqual(suite('meme-graine'), suite('meme-graine'));
  assert.notDeepEqual(suite('meme-graine'), suite('autre-graine'));
});

test('la prévision à deux journées devient la météo du jour', () => {
  const reglages = reglagesParDefaut({ climatPays: 'tempere', date: '2026-11-02' });
  const rng = creerRng('prevision');
  const j1 = initialiserClimat(reglages, rng);
  const j2 = avancerClimat(j1, reglages, rng);
  const j3 = avancerClimat(j2, reglages, rng);
  assert.equal(j2.meteo, j1.previsions[0]);
  assert.equal(j3.meteo, j1.previsions[1]);
});

test('le cycle jour/nuit suit le défaut 4/2', () => {
  const cycle = { jour: 4, nuit: 2 };
  assert.equal(phaseDe(cycle, 0), 'jour');
  assert.equal(phaseDe(cycle, 3), 'jour');
  assert.equal(phaseDe(cycle, 4), 'nuit');
  assert.equal(phaseDe(cycle, 5), 'nuit');
  const nuitPolaire = cycleEffectif(reglagesParDefaut({ climatPays: 'polaire', date: '2026-01-10' }));
  assert.deepEqual(nuitPolaire, { jour: 0, nuit: 6 });
});

test('la nuit impose le brouillard et retire 2 de vision, minimum 1', () => {
  const jour = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'recon', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ]);
  assert.equal(jour.climat.phase, 'jour');
  assert.equal(visionUnite(jour, CAT, u(jour, 'u1')), 5);
  assert.equal(brouillardActif(jour), false);
  const nuit: EtatPartie = { ...jour, climat: { ...jour.climat, phase: 'nuit' } };
  assert.equal(visionUnite(nuit, CAT, u(nuit, 'u1')), 3);
  assert.equal(brouillardActif(nuit), true);
  const infNuit: EtatPartie = { ...nuit };
  assert.equal(visionUnite(infNuit, CAT, u(infNuit, 'u2')), 1); // 2 − 2, plancher 1
});

test('le brouillard météo fixe la vision à 1, la pluie en retire 1', () => {
  const base = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'recon', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ]);
  const brume: EtatPartie = { ...base, climat: { ...base.climat, meteo: 'brouillard' } };
  assert.equal(visionUnite(brume, CAT, u(brume, 'u1')), 1);
  const pluie: EtatPartie = { ...base, climat: { ...base.climat, meteo: 'pluie' } };
  assert.equal(visionUnite(pluie, CAT, u(pluie, 'u1')), 4);
});

test('la montagne est le mirador du fantassin : +3 à pied, rien aux roues (7 septembre 2026)', () => {
  // Avant : +2 pour tout ce qui se posait dessus, +1 de plus avec `vision_etendue`.
  // Un recon n'y monte pas en jeu (les roues ne passent pas la montagne) ; posé
  // là par le test, il n'y gagne plus rien. Voir `vision-terrain.test.ts`.
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'recon', x: 4, y: 0 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ]);
  assert.equal(visionUnite(etat, CAT, u(etat, 'u1')), 5);
  const grimpee = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 4, y: 0 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ]);
  assert.equal(visionUnite(grimpee, CAT, u(grimpee, 'u1')), 2 + 3);
});

test("l'hiver tempéré gèle les rivières et enneige les plaines", () => {
  const hiver = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_leger', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ], { date: '2026-01-15', climatPays: 'tempere', meteoForcee: 'clair' });
  assert.ok(effetsSaisonPartie(hiver.reglages).includes('rivieres_gelees'));
  // La rivière est vue comme une plaine : le char passe.
  assert.equal(terrainLogique(hiver, CAT, { x: 2, y: 0 }), 'plaine');
  // Neige de saison : +1 pour les chenilles sur plaine et route.
  assert.equal(coutEntree(hiver, CAT, u(hiver, 'u1'), { x: 5, y: 6 }), 2);
});

test("l'automne retire le couvert de la forêt", () => {
  const automne = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ], { date: '2026-10-10', climatPays: 'tempere' });
  assert.ok(effetsSaisonPartie(automne.reglages).includes('forets_sans_couvert'));
});

test('la tempête bride les unités aériennes et affaiblit le tir indirect', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'helico', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ], { meteoForcee: 'tempete' });
  assert.equal(etat.climat.meteo, 'tempete');
  // Mouvement 6 divisé par deux.
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1',
    chemin: [
      { x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 },
    ],
    suite: { type: 'rien' },
  }, CAT);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.motif, 'chemin_trop_cher');
});

test('la canicule retire un point de mouvement aux unités lourdes', () => {
  const etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'char_lourd', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ], { meteoForcee: 'canicule' });
  // Mouvement 4 − 1 = 3 : quatre cases de plaine sont hors de portée.
  const r = appliquer(etat, {
    type: 'ordre', uniteId: 'u1',
    chemin: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }, { x: 5, y: 8 }, { x: 5, y: 9 }],
    suite: { type: 'rien' },
  }, CAT);
  assert.equal(r.ok === false && r.motif, 'chemin_trop_cher');
});

test('la météo forcée par le scénario ne bouge jamais', () => {
  let etat = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ], { meteoForcee: 'neige' });
  for (let i = 0; i < 6; i += 1) {
    const r = appliquer(etat, { type: 'finTour' }, CAT);
    assert.ok(r.ok);
    if (!r.ok) return;
    etat = r.etat;
    assert.equal(etat.climat.meteo, 'neige');
  }
});
