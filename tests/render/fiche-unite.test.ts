// La fiche d'unité : ce que le menu de production doit dire avant qu'on achète.
// Pure — pas de DOM, pas d'état de partie. Ces tests valent surtout comme
// garde-fou contre la dérive : la fiche ne recopie aucune règle, elle les lit,
// et un changement d'équilibrage doit se voir ici sans qu'on touche au code.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chargerCatalogue, consommationParTour, coutBase, degatsArme, degatsBase, porte, SURCOUT_CARBURANT_FURTIF,
  surcoutMeteo, tireSansMunitions, type Unite,
} from '../../src/engine/index';
import {
  alerteCarburant, alerteMunitions, CITES, ficheUnite, PART_CARBURANT_FAIBLE, traitsLisibles,
} from '../../src/render/fiche-unite';
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

test('un duel tiré à l’arme secondaire est marqué « sans munitions », dans les deux sens', () => {
  // Le catalogue du dépôt donne au char léger une mitrailleuse contre la troupe
  // à pied ; si un jour il la perd, le test le dira, c'est son rôle.
  const charLeger = CAT.unites['char_leger']!;
  assert.ok(charLeger.armeSecondaire?.includes('infanterie'), 'le char léger doit tirer l’infanterie à la mitrailleuse');
  for (const cle of TOUTES) {
    const f = ficheUnite(CAT, cle)!;
    const u = CAT.unites[cle]!;
    // « Forte » : c'est l'unité de la fiche qui tire.
    for (const d of f.forte) {
      assert.equal(d.sansMunitions, tireSansMunitions(u, d.unite), `${cle} → ${d.unite}`);
    }
    // « Craint » : c'est l'adversaire cité qui tire.
    for (const d of f.craint) {
      assert.equal(d.sansMunitions, tireSansMunitions(CAT.unites[d.unite]!, cle), `${d.unite} → ${cle}`);
    }
  }
  // Un catalogue construit en mémoire, pour ne pas dépendre de l'équilibrage :
  // la fiche lit `armeSecondaire`, elle ne l'invente pas. La cible choisie est
  // la première que le char léger frappe, pour qu'elle soit sûrement citée.
  const cible = ficheUnite(CAT, 'char_leger')!.forte[0]!.unite;
  const memoire = {
    ...CAT,
    unites: {
      ...CAT.unites,
      char_leger: { ...CAT.unites['char_leger']!, armeSecondaire: [cible] },
      [cible]: { ...CAT.unites[cible]!, armeSecondaire: null },
    },
  };
  const char = ficheUnite(memoire, 'char_leger')!;
  assert.equal(char.forte[0]!.unite, cible);
  assert.equal(char.forte[0]!.sansMunitions, true);
  assert.ok(char.forte.slice(1).every((d) => !d.sansMunitions), 'les autres duels comptent leurs munitions');
  const fiche = ficheUnite(memoire, cible)!;
  const parLeChar = fiche.craint.find((d) => d.unite === 'char_leger');
  if (parLeChar) assert.equal(parLeChar.sansMunitions, true, 'craint lit l’arme de l’adversaire');
  assert.ok(fiche.forte.every((d) => !d.sansMunitions), 'une unité sans arme secondaire n’en marque aucun');
});

test('l’alerte carburant suit la règle du tour : rouge quand la panne est au prochain tour, orange sous deux tours', () => {
  const helico = CAT.unites['helico']!;
  assert.ok(helico.carburant && helico.carburant.parTour > 0, 'l’hélicoptère consomme par tour');
  const parTour = helico.carburant!.parTour;
  assert.equal(alerteCarburant(helico, helico.carburant!.max), null);
  assert.equal(alerteCarburant(helico, 2 * parTour), null, 'deux tours pleins : rien à signaler');
  assert.equal(alerteCarburant(helico, 2 * parTour - 1), 'orange', 'moins de deux tours');
  assert.equal(alerteCarburant(helico, parTour), 'rouge', 'panne au début du prochain tour');
  assert.equal(alerteCarburant(helico, 0), 'rouge');

  // Une unité qui ne consomme qu'en roulant : orange sous un cinquième du plein,
  // rouge à zéro — elle ne bouge plus.
  const roulante = TOUTES.map((c) => CAT.unites[c]!).find((u) => u.carburant !== null && u.carburant.parTour === 0);
  assert.ok(roulante, 'il faut une unité au carburant sans consommation par tour');
  const max = roulante.carburant!.max;
  assert.equal(alerteCarburant(roulante, max), null);
  assert.equal(alerteCarburant(roulante, Math.ceil(max * PART_CARBURANT_FAIBLE)), null, 'au seuil, pas encore');
  assert.equal(alerteCarburant(roulante, Math.ceil(max * PART_CARBURANT_FAIBLE) - 1), 'orange');
  assert.equal(alerteCarburant(roulante, 0), 'rouge');

  // Sans carburant du tout, rien à dire.
  const infanterie = CAT.unites['infanterie']!;
  assert.equal(infanterie.carburant, null);
  assert.equal(alerteCarburant(infanterie, null), null);
  assert.equal(alerteCarburant(infanterie, 0), null);
});

test('l’alerte munitions : rouge à zéro, orange à la dernière, rien pour une arme illimitée', () => {
  const char = CAT.unites['char_leger']!;
  assert.ok(char.munitions !== null);
  assert.equal(alerteMunitions(char, char.munitions!), null);
  assert.equal(alerteMunitions(char, 2), null);
  assert.equal(alerteMunitions(char, 1), 'orange');
  assert.equal(alerteMunitions(char, 0), 'rouge');
  // Le rouge tient même avec une arme secondaire : c'est l'arme principale qui est vide.
  assert.ok(char.armeSecondaire && char.armeSecondaire.length > 0);
  assert.equal(alerteMunitions(char, 0), 'rouge');
  const infanterie = CAT.unites['infanterie']!;
  assert.equal(infanterie.munitions, null);
  assert.equal(alerteMunitions(infanterie, null), null);
});

// ---------------------------------------------------------------------------
// Catalogue 6 : la cale, la consommation, la furtivité, les dégâts effectifs
// ---------------------------------------------------------------------------

const CAT6 = chargerCatalogue(6);

/** Une unité en jeu de ce type, au plein, telle que `creerPartie` la poserait. */
function enJeu(cle: CleUnite, extra: Partial<Unite> = {}): Unite {
  const type = CAT6.unites[cle]!;
  return {
    id: `u_${cle}`, camp: 0, type: cle, x: 0, y: 0, pv: 100, munitions: type.munitions,
    carburant: type.carburant ? type.carburant.max : null, etat: 'prete', pointsCapture: 0, cargo: [],
    dansTransport: null, ...extra,
  };
}

test('la fiche dit la cale d’un transport — places, unités acceptées, ravitaillement — et rien pour les autres', () => {
  for (const cle of Object.keys(CAT6.unites) as CleUnite[]) {
    const u = CAT6.unites[cle]!;
    const f = ficheUnite(CAT6, cle)!;
    if (u.transport === null) {
      assert.equal(f.transport, null, `${cle} n’a pas de cale`);
      continue;
    }
    assert.ok(f.transport, `${cle} porte une cale`);
    assert.equal(f.transport.places, u.transport.places);
    assert.deepEqual([...f.transport.accepte], u.transport.accepte, `${cle} : les types acceptés sont ceux du canon`);
    assert.equal(f.transport.ravitaille, u.transport.ravitaille === true);
  }
  // Ce que le canon dit aujourd'hui : le camion refait le plein de sa cale, la
  // barge ne fait que porter. Si le canon change, la fiche suit — c'est le test
  // qui le dira.
  assert.equal(ficheUnite(CAT6, 'transport')!.transport?.ravitaille, true);
  assert.equal(ficheUnite(CAT6, 'barge')!.transport?.ravitaille, false);
  assert.ok((ficheUnite(CAT6, 'transport')!.transport?.places ?? 0) >= 1);
});

test('la consommation par tour vient du moteur : celle du type, celle de l’unité en jeu, celle de la furtivité', () => {
  const furtif = CAT6.unites['furtif']!;
  assert.ok(furtif.carburant && furtif.carburant.parTour > 0 && porte(furtif, 'furtif'), 'le chasseur furtif consomme par tour et sait se cacher');
  const f = ficheUnite(CAT6, 'furtif')!;
  assert.equal(f.consommationParTour, furtif.carburant!.parTour, 'au catalogue, le chiffre du type');
  assert.equal(f.consommationFurtive, furtif.carburant!.parTour + SURCOUT_CARBURANT_FURTIF, 'et ce que coûte de se cacher');
  assert.ok(traitsLisibles(furtif.traits).includes('furtif'), 'le trait est dit en clair');

  // En jeu et furtive : la consommation effective est la sienne, lue au moteur.
  const cachee = enJeu('furtif', { furtive: true });
  const g = ficheUnite(CAT6, 'furtif', cachee)!;
  assert.equal(g.consommationParTour, consommationParTour(furtif, cachee));
  assert.ok(g.consommationParTour > f.consommationParTour, 'une furtive brûle davantage');
  assert.equal(g.consommationFurtive, f.consommationFurtive);

  // Une unité d'un autre type passée par erreur ne change rien à la fiche.
  const autre = ficheUnite(CAT6, 'furtif', enJeu('helico'))!;
  assert.equal(autre.consommationParTour, f.consommationParTour);

  // Ce qui ne consomme pas par tour dit 0, et n'a pas de coût de furtivité.
  for (const cle of ['char_leger', 'infanterie'] as const) {
    const h = ficheUnite(CAT6, cle)!;
    assert.equal(h.consommationParTour, 0, `${cle} ne brûle rien immobile`);
    assert.equal(h.consommationFurtive, null);
  }
  const chasseur = ficheUnite(CAT6, 'chasseur')!;
  assert.equal(chasseur.consommationParTour, CAT6.unites['chasseur']!.carburant!.parTour);
  assert.equal(chasseur.consommationFurtive, null, 'un chasseur ordinaire ne sait pas se cacher');
});

test('une unité en jeu à sec frappe avec sa mitrailleuse : la fiche lit degatsArme, le catalogue la valeur pleine', () => {
  const char = CAT6.unites['char_leger']!;
  assert.ok(char.munitions !== null && (char.degatsSecondaire ?? 0) > 0, 'le char léger a une mitrailleuse à sec');
  const aSec = enJeu('char_leger', { munitions: 0 });
  const pleine = ficheUnite(CAT6, 'char_leger')!;
  const effective = ficheUnite(CAT6, 'char_leger', aSec)!;
  for (const d of effective.forte) {
    assert.equal(d.degats, degatsArme(CAT6, aSec, d.unite), `${d.unite} : la valeur effective`);
    assert.equal(d.sansMunitions, tireSansMunitions(char, d.unite), 'la pastille dit toujours l’arme, pas le chiffre');
  }
  for (const d of pleine.forte) assert.equal(d.degats, degatsBase(CAT6, 'char_leger', d.unite));
  // Contre un blindé, non listé à l'arme secondaire, le chiffre tombe à la mitrailleuse.
  assert.ok(degatsArme(CAT6, aSec, 'char_leger') < degatsBase(CAT6, 'char_leger', 'char_leger'));
  const contreChar = effective.forte.find((d) => d.unite === 'char_leger');
  if (contreChar) assert.equal(contreChar.degats, char.degatsSecondaire);
  // Ce qui la frappe ne dépend pas de ses munitions à elle.
  assert.deepEqual(effective.craint, pleine.craint);
  // Au plein, la fiche en jeu dit la même chose que le catalogue.
  assert.deepEqual(ficheUnite(CAT6, 'char_leger', enJeu('char_leger'))!.forte, pleine.forte);
});

test('l’alerte carburant se juge sur la consommation effective : une furtive a un tour de moins', () => {
  const furtif = CAT6.unites['furtif']!;
  const parTour = furtif.carburant!.parTour;
  const furtive = consommationParTour(furtif, enJeu('furtif', { furtive: true }));
  assert.ok(furtive > parTour);
  // Sans consommation donnée, c'est celle du type : deux tours pleins, rien à dire.
  assert.equal(alerteCarburant(furtif, 2 * parTour), null);
  assert.equal(alerteCarburant(furtif, 2 * parTour, parTour), null);
  // Le même carburant, furtive : il ne couvre plus deux tours.
  assert.equal(alerteCarburant(furtif, 2 * parTour, furtive), 'orange');
  assert.equal(alerteCarburant(furtif, furtive, furtive), 'rouge', 'panne au prochain début de tour');
  assert.equal(alerteCarburant(furtif, furtive, parTour), 'orange', 'visible, le même chiffre tient encore un tour');
  // Une unité qui ne consomme qu'en roulant ignore l'argument : la règle du plein reste.
  const char = CAT6.unites['char_leger']!;
  assert.equal(alerteCarburant(char, char.carburant!.max, 0), null);
  assert.equal(alerteCarburant(char, 0, 0), 'rouge');
});
