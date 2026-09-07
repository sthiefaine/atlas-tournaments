// La vision et le terrain (7 septembre 2026 au soir, `04-gameplay.md` §10,
// §12.3), tranchés par deux personas : la montagne est le mirador du fantassin
// (+3 à pied, rien à ce qui vole) ; la forêt cache **et** bouche la vue (−1) ;
// un bâtiment possédé voit à une case, la station radar à cinq ; la nuit ôte
// deux cases sauf sur un bâtiment à soi, qui est éclairé ; les hautes herbes
// cachent les fantassins au-delà du contact et laissent voir les véhicules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BONUS_VISION_MONTAGNE, casesVisibles, chargerCatalogue, cleCase, MALUS_VISION_FORET, MALUS_VISION_NUIT,
  unitesVues, VISION_BATIMENT, VISION_STATION_RADAR, visionUnite,
} from '../../src/engine/index';
import type { CampId } from '../../src/schemas/index';
import { partiePersonnalisee, u } from './aides';

const CAT = chargerCatalogue(6);
//               0123456789
const GRILLE = [
  'PMFGCPPPPT',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
];

test('la montagne donne +3 à qui y grimpe à pied, rien à ce qui vole', () => {
  const e = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
    { camp: 0, type: 'helico', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ]);
  const inf = u(e, 'u1');
  assert.equal(visionUnite(e, CAT, inf), CAT.unites['infanterie']!.vision + BONUS_VISION_MONTAGNE);
  // Le même hélicoptère posé sur la montagne ne gagne rien : il vole déjà.
  const perche = { ...e, unites: e.unites.map((x) => (x.id === 'u2' ? { ...x, x: 1, y: 0 } : x)) };
  assert.equal(visionUnite(perche, CAT, u(perche, 'u2')), CAT.unites['helico']!.vision);
});

test('la forêt bouche la vue de qui s’y trouve, plancher une case', () => {
  const e = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'recon', x: 2, y: 0 },
    { camp: 0, type: 'char_lourd', x: 2, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ]);
  assert.equal(visionUnite(e, CAT, u(e, 'u1')), CAT.unites['recon']!.vision - MALUS_VISION_FORET);
  const enfoui = { ...e, unites: e.unites.map((x) => (x.id === 'u2' ? { ...x, x: 2, y: 0 } : x)) };
  assert.equal(visionUnite(enfoui, CAT, u(enfoui, 'u2')), 1, 'un char lourd à 1 ne descend pas sous 1');
});

test('un bâtiment possédé voit à une case, la station radar à cinq', () => {
  const e = partiePersonnalisee(GRILLE, { '4,0': 0 }, [
    { camp: 0, type: 'infanterie', x: 0, y: 3 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ], { brouillard: true });
  const vues = casesVisibles(e, CAT, 0);
  assert.equal(VISION_BATIMENT, 1);
  assert.ok(vues.has(cleCase({ x: 5, y: 0 })), 'la ville voit sa voisine');
  assert.ok(!vues.has(cleCase({ x: 6, y: 0 })), 'et pas plus loin');
  // La station radar, elle, voit à cinq : la carte fait quatre rangs, on lit en largeur.
  const radar = partiePersonnalisee(GRILLE, { '9,0': 0 }, [
    { camp: 0, type: 'infanterie', x: 0, y: 3 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ], { brouillard: true });
  const loin = casesVisibles(radar, CAT, 0);
  assert.equal(VISION_STATION_RADAR, 5);
  assert.ok(loin.has(cleCase({ x: 9 - VISION_STATION_RADAR, y: 0 })), 'à cinq cases');
  assert.ok(!loin.has(cleCase({ x: 9 - VISION_STATION_RADAR - 1, y: 0 })), 'pas à six');
});

test('la nuit ôte deux cases, sauf à qui tient un bâtiment à soi : la ville est éclairée', () => {
  const e = partiePersonnalisee(GRILLE, { '4,0': 0 }, [
    { camp: 0, type: 'infanterie', x: 4, y: 0 },
    { camp: 0, type: 'infanterie', x: 6, y: 2 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ], { cycleJourNuit: { jour: 0, nuit: 6 }, meteoForcee: 'clair' });
  assert.equal(e.climat.phase, 'nuit');
  const base = CAT.unites['infanterie']!.vision;
  assert.equal(visionUnite(e, CAT, u(e, 'u1')), base, 'sur sa ville, vision entière');
  assert.equal(visionUnite(e, CAT, u(e, 'u2')), Math.max(1, base - MALUS_VISION_NUIT), 'en plaine, la nuit');
  // Sur une ville qui n'est pas à soi, pas de lumière.
  const chezLautre = { ...e, proprietaires: { '4,0': 1 as CampId } };
  assert.equal(visionUnite(chezLautre, CAT, u(chezLautre, 'u1')), Math.max(1, base - MALUS_VISION_NUIT));
});

test('les hautes herbes cachent les fantassins au-delà du contact, et laissent voir un char', () => {
  const e = partiePersonnalisee(GRILLE, {}, [
    { camp: 0, type: 'recon', x: 3, y: 2 },
    { camp: 1, type: 'infanterie', x: 3, y: 0 },
    { camp: 1, type: 'char_leger', x: 5, y: 2 },
  ], { brouillard: true, meteoForcee: 'clair' });
  assert.ok(casesVisibles(e, CAT, 0).has(cleCase({ x: 3, y: 0 })), 'la case est éclairée…');
  const vues = unitesVues(e, CAT, 0).map((x) => x.id);
  assert.ok(!vues.includes('u2'), '…mais le fantassin dans l’herbe n’y est pas vu à distance 2');
  assert.ok(vues.includes('u3'), 'le char léger en plaine est vu');
  // Le même char dans l'herbe : vu quand même — l'herbe cache ce qui est plus bas qu'un char.
  const charDansLherbe = { ...e, unites: e.unites.map((x) => (x.id === 'u3' ? { ...x, x: 3, y: 0 } : x.id === 'u2' ? { ...x, x: 8, y: 3 } : x)) };
  assert.ok(unitesVues(charDansLherbe, CAT, 0).some((x) => x.id === 'u3'));
  // Au contact, le fantassin est repéré.
  const contact = { ...e, unites: e.unites.map((x) => (x.id === 'u1' ? { ...x, x: 3, y: 1 } : x)) };
  assert.ok(unitesVues(contact, CAT, 0).some((x) => x.id === 'u2'));
});

// ---------------------------------------------------------------------------
// La montagne coupe la ligne de vue (7 septembre 2026, nuit)
// ---------------------------------------------------------------------------

test('une montagne cache ce qui est derrière elle, mais pas elle-même ni ce qui est à côté', () => {
  //               0123456789
  const CRETE = [
    'PPPPPPPPPP',
    'PPPMPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
  ];
  const e = partiePersonnalisee(CRETE, {}, [
    { camp: 0, type: 'recon', x: 1, y: 1 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ], { brouillard: true, meteoForcee: 'clair' });
  const vues = casesVisibles(e, CAT, 0);
  assert.ok(vues.has(cleCase({ x: 3, y: 1 })), 'la montagne elle-même se voit');
  assert.ok(!vues.has(cleCase({ x: 4, y: 1 })), 'juste derrière, non');
  assert.ok(!vues.has(cleCase({ x: 5, y: 1 })), 'plus loin derrière non plus');
  assert.ok(vues.has(cleCase({ x: 4, y: 0 })), 'à côté de la ligne, oui');
  assert.ok(vues.has(cleCase({ x: 4, y: 2 })), 'de l’autre côté aussi');
});

test('qui est sur une montagne, ou qui vole, voit par-dessus', () => {
  const CRETE = [
    'PMPMPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
    'PPPPPPPPPP',
  ];
  const perche = partiePersonnalisee(CRETE, {}, [
    { camp: 0, type: 'infanterie', x: 1, y: 0 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ], { brouillard: true, meteoForcee: 'clair' });
  // À pied sur la montagne : 2 + 3 de vue, et la crête voisine ne coupe rien.
  assert.ok(casesVisibles(perche, CAT, 0).has(cleCase({ x: 5, y: 0 })));
  const aTerre = { ...perche, unites: perche.unites.map((x) => (x.id === 'u1' ? { ...x, x: 2, y: 0 } : x)) };
  assert.ok(!casesVisibles(aTerre, CAT, 0).has(cleCase({ x: 4, y: 0 })), 'en plaine derrière la crête, non');
  const vol = partiePersonnalisee(CRETE, {}, [
    { camp: 0, type: 'helico', x: 2, y: 0 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ], { brouillard: true, meteoForcee: 'clair' });
  assert.ok(casesVisibles(vol, CAT, 0).has(cleCase({ x: 5, y: 0 })), 'l’hélicoptère voit par-dessus');
});
