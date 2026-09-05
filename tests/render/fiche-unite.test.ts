// La fiche d'unité : ce que le menu de production doit dire avant qu'on achète.
// Pure — pas de DOM, pas d'état de partie. Ces tests valent surtout comme
// garde-fou contre la dérive : la fiche ne recopie aucune règle, elle les lit,
// et un changement d'équilibrage doit se voir ici sans qu'on touche au code.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chargerCatalogue, coutBase, degatsBase, surcoutMeteo } from '../../src/engine/index';
import { CITES, ficheUnite, traitsLisibles } from '../../src/render/fiche-unite';
import { CLES_TERRAIN, METEOS, type CleUnite } from '../../src/schemas/index';

const CAT = chargerCatalogue();
const TOUTES = Object.keys(CAT.unites) as CleUnite[];

test('chaque unité du catalogue a une fiche, et une clé inconnue n’en a pas', () => {
  for (const cle of TOUTES) {
    const f = ficheUnite(CAT, cle);
    assert.ok(f, `pas de fiche pour ${cle}`);
    assert.equal(f.cle, cle);
    assert.equal(f.cout, CAT.unites[cle]!.cout);
    assert.equal(f.mouvement, CAT.unites[cle]!.mouvement);
  }
  // Un catalogue peut retirer une unité : on rend `null` plutôt qu'une fiche
  // vide, pour que le HUD n'affiche rien du tout.
  assert.equal(ficheUnite(CAT, 'sous_marin_imaginaire' as CleUnite), null);
});

test('« forte contre » et « craint » lisent la même table, dans les deux sens', () => {
  for (const cle of TOUTES) {
    const f = ficheUnite(CAT, cle)!;
    assert.ok(f.forte.length <= CITES && f.craint.length <= CITES);

    for (const d of f.forte) {
      assert.equal(d.degats, degatsBase(CAT, cle, d.unite), `${cle} → ${d.unite}`);
      assert.ok(d.degats > 0, 'une arme qui ne fait rien n’est pas une force');
    }
    for (const d of f.craint) {
      assert.equal(d.degats, degatsBase(CAT, d.unite, cle), `${d.unite} → ${cle}`);
      assert.ok(d.degats > 0);
    }
    // Le classement est décroissant : la première ligne est la plus utile.
    for (let i = 1; i < f.forte.length; i += 1) {
      assert.ok(f.forte[i - 1]!.degats >= f.forte[i]!.degats, `${cle} : forte mal triée`);
    }
    for (let i = 1; i < f.craint.length; i += 1) {
      assert.ok(f.craint[i - 1]!.degats >= f.craint[i]!.degats, `${cle} : craint mal triée`);
    }
    // Et c'est bien le maximum de la table qui sort en tête, pas un hasard d'ordre.
    const meilleur = Math.max(...TOUTES.map((c) => degatsBase(CAT, cle, c)));
    if (meilleur > 0) assert.equal(f.forte[0]!.degats, meilleur, `${cle} : la meilleure cible manque`);
  }
});

test('la fiche dit vrai sur le terrain, traits compris', () => {
  for (const cle of TOUTES) {
    const u = CAT.unites[cle]!;
    const f = ficheUnite(CAT, cle)!;
    for (const t of f.terrainsRapides) {
      const c = coutBase(CAT, t, u.typeMouvement, u);
      assert.ok(c !== null && c <= 1, `${cle} n’est pas rapide sur ${t} (coût ${c})`);
    }
    for (const t of f.terrainsInterdits) {
      assert.equal(coutBase(CAT, t, u.typeMouvement, u), null, `${cle} passe pourtant sur ${t}`);
    }
    // Aucun terrain ne peut être dans les deux listes.
    assert.equal(f.terrainsRapides.filter((t) => f.terrainsInterdits.includes(t)).length, 0);
  }

  // Les cas qui prouvent que les traits passent : ce qui vole va partout, et
  // l'infanterie à pied ne traverse pas la mer.
  const helico = ficheUnite(CAT, 'helico')!;
  assert.equal(helico.terrainsInterdits.length, 0, 'ce qui vole ne connaît pas d’obstacle');
  assert.ok(helico.terrainsRapides.includes('montagne'));
  assert.ok(helico.terrainsRapides.includes('mer'));

  const infanterie = ficheUnite(CAT, 'infanterie')!;
  assert.ok(infanterie.terrainsInterdits.includes('mer'), 'l’infanterie ne marche pas sur l’eau');
  assert.ok(infanterie.terrainsRapides.includes('plaine'));

  // Un char à chenilles ne monte pas en montagne : c'est la lecture qu'on veut
  // offrir avant l'achat, pas après.
  const char = ficheUnite(CAT, 'char_lourd')!;
  assert.ok(char.terrainsInterdits.includes('montagne') || !char.terrainsRapides.includes('montagne'));
});

test('les météos citées sont celles qui gênent vraiment cette unité', () => {
  for (const cle of TOUTES) {
    const u = CAT.unites[cle]!;
    const f = ficheUnite(CAT, cle)!;
    const citees = new Set(f.meteosGenantes.map((g) => g.meteo));
    for (const meteo of METEOS) {
      const surcout = CLES_TERRAIN.some((t) => coutBase(CAT, t, u.typeMouvement, u) !== null
        && surcoutMeteo(meteo, t, u.typeMouvement) > 0);
      const bride = meteo === 'tempete' && u.domaine === 'air';
      assert.equal(citees.has(meteo), surcout || bride, `${cle} sous ${meteo}`);
    }
  }
  // Les deux effets ne se confondent pas : la tempête bride, la neige renchérit.
  const helico = ficheUnite(CAT, 'helico')!;
  assert.deepEqual(helico.meteosGenantes, [{ meteo: 'tempete', effet: 'bride' }]);
  const recon = ficheUnite(CAT, 'recon')!;
  assert.ok(recon.meteosGenantes.some((g) => g.meteo === 'pluie' && g.effet === 'case'),
    'un véhicule à roues souffre de la pluie hors route');
  // Et ce qui marche à pied ne se plaint ni de la pluie ni de la neige.
  const infanterie = ficheUnite(CAT, 'infanterie')!;
  assert.equal(infanterie.meteosGenantes.length, 0);
});

test('le tir indirect est signalé : c’est la lecture qui change le plus une partie', () => {
  const artillerie = ficheUnite(CAT, 'artillerie')!;
  assert.equal(artillerie.indirecte, true);
  assert.ok(artillerie.portee[0] > 1, 'elle ne peut pas riposter au contact');
  const char = ficheUnite(CAT, 'char_leger')!;
  assert.equal(char.indirecte, false);
  assert.deepEqual([...char.portee], [1, 1]);
});

test('les traits sortent dans un ordre stable, et seulement ceux qu’on sait dire', () => {
  const genie = ficheUnite(CAT, 'genie')!;
  assert.deepEqual(traitsLisibles(genie.traits), traitsLisibles(genie.traits));
  for (const cle of TOUTES) {
    const f = ficheUnite(CAT, cle)!;
    const lisibles = traitsLisibles(f.traits);
    // On n'invente aucun trait, et on n'en perd aucun de ceux qu'on sait nommer.
    for (const t of lisibles) assert.ok(f.traits.includes(t), `${cle} : trait inventé ${t}`);
    assert.equal(new Set(lisibles).size, lisibles.length, `${cle} : trait cité deux fois`);
  }
  // L'infanterie capture, et c'est la première chose à savoir d'elle.
  assert.equal(traitsLisibles(CAT.unites['infanterie']!.traits)[0], 'capture');
});
