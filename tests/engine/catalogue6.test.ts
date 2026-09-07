// Le catalogue 6 dans le moteur (`04-gameplay.md` §10 quinquies, 7 septembre
// 2026) : la furtivité à la demande (trait `furtif`, suite `furtivite`), la cale
// ravitaillée (`transport.ravitaille`) et le débarquement de toute la cale en un
// ordre (`debarquer` avec `passager` et `autres`).
//
// Comme pour le naval, rien n'est une exception codée : le trait, le booléen du
// transport et la forme de l'ordre portent la règle. Les états sont construits
// en mémoire et les chiffres lus dans le catalogue, jamais recopiés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliquer, brouillardActif, cacheeAuContact, canonique, casesVisibles, chargerCatalogue, cleCase,
  consommationParTour, creerPartie, creerRng, degatsBase, empreinte, enregistrerPartie, produitesPar,
  reglagesParDefaut, rejouer, sceneDeCarte, SURCOUT_CARBURANT_FURTIF, unitesVues, verifierProduction,
  type Action, type Catalogue, type EtatPartie, type Suite,
} from '../../src/engine/index';
import { jouerPartie, strategie } from '../../src/ai/index';
import type { Case } from '../../src/schemas/index';
import { carte, scenePersonnalisee, u } from './aides';

const CAT5 = chargerCatalogue(5);
const CAT6 = chargerCatalogue(6);

/** Une plaine nue : rien n'y cache personne, seul le trait compte. */
const PLAINE = Array.from({ length: 10 }, () => 'P'.repeat(10));

/** Un détroit : une bande de mer entre deux rives, la barge au milieu. */
//         0123456789
const DETROIT = [
  'PPPPPPPPPP',
  'WWWWWWWWWW',
  'PPPPPPPPPP',
  'PPPPPPPPPP',
];

/** Une rade : de la mer, un port à quai, de la terre derrière. */
const RADE = [
  'WWWWWWWWWW',
  'WWWWWWWWWW',
  'OPPPPPPPPP',
  'PPPPPPPPPP',
];

function ordre(uniteId: string, chemin: Case[], suite: Suite): Action {
  return { type: 'ordre', uniteId, chemin, suite };
}

/** Applique une action qui doit passer, et rend l'état qui en sort. */
function exiger(e: EtatPartie, a: Action, cat: Catalogue = CAT6): EtatPartie {
  const r = appliquer(e, a, cat);
  assert.ok(r.ok, `action refusée : ${JSON.stringify(a)} → ${r.ok ? '' : `${r.motif} ${r.detail ?? ''}`}`);
  return r.ok ? r.etat : e;
}

/** Applique une action qui doit être refusée, et rend le motif. */
function refuser(e: EtatPartie, a: Action, cat: Catalogue = CAT6): string {
  const avant = canonique(e);
  const r = appliquer(e, a, cat);
  assert.equal(r.ok, false, `action acceptée à tort : ${JSON.stringify(a)}`);
  // Un refus ne touche jamais à l'état d'entrée : `appliquer` est pure.
  assert.equal(canonique(e), avant, 'un refus a modifié l’état d’entrée');
  return r.ok ? '' : r.motif;
}

/** Deux fins de tour : la main revient au camp 0, une journée plus tard. */
function journeeSuivante(e: EtatPartie, cat: Catalogue = CAT6): EtatPartie {
  return exiger(exiger(e, { type: 'finTour' }, cat), { type: 'finTour' }, cat);
}

/** Un état où une unité a été modifiée à la main, sans toucher à l'original. */
function avec(e: EtatPartie, id: string, champs: Partial<EtatPartie['unites'][number]>): EtatPartie {
  return { ...e, unites: e.unites.map((x) => (x.id === id ? { ...x, ...champs } : x)) };
}

// ---------------------------------------------------------------------------
// Catalogue 6 : le chasseur furtif entre, l'aéroport le produit
// ---------------------------------------------------------------------------

test('le catalogue 5 ignore le chasseur furtif, le 6 le porte, et le plafond de vingt-quatre est atteint', () => {
  assert.equal(CAT5.unites['furtif'], undefined);
  assert.equal(CAT6.unites['furtif']?.cout, 20000);
  assert.deepEqual(CAT6.unites['furtif']?.traits, ['vol', 'furtif']);
  assert.equal(CAT5.cles.length, 23);
  assert.equal(CAT6.cles.length, 24);
  assert.ok(produitesPar(CAT6, 'aeroport').includes('furtif'), 'l’aéroport le produit au 6');
  assert.ok(!produitesPar(CAT5, 'aeroport').includes('furtif'), 'jamais au 5');
});

test('un aéroport possédé produit le furtif en catalogue 6 et le refuse en 5', () => {
  const grille = ['APPPPPPPPP', ...PLAINE.slice(1)];
  const scene = scenePersonnalisee(grille, { '0,0': 0 }, [
    { camp: 0, type: 'infanterie', x: 5, y: 5 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ], { fondsDepart: 30000 });
  const piste = { x: 0, y: 0 };
  const en6 = verifierProduction(creerPartie(scene, CAT6, 'piste'), CAT6, 0, piste, 'furtif');
  assert.deepEqual(en6, { ok: true, cout: 20000 });
  const en5 = verifierProduction(creerPartie(scene, CAT5, 'piste'), CAT5, 0, piste, 'furtif');
  assert.equal(en5.ok, false);
  if (!en5.ok) assert.equal(en5.motif, 'unite_non_produite_ici');
  // Et la production elle-même, avec le plein de ses réserves.
  const r = appliquer(creerPartie(scene, CAT6, 'piste'), { type: 'produire', batiment: piste, unite: 'furtif' }, CAT6);
  assert.ok(r.ok);
  if (!r.ok) return;
  const neuf = r.etat.unites.find((x) => x.type === 'furtif');
  assert.ok(neuf);
  assert.equal(neuf.munitions, CAT6.unites['furtif']?.munitions);
  assert.equal(neuf.carburant, CAT6.unites['furtif']?.carburant?.max);
  assert.equal(neuf.furtive, undefined, 'produit visible : le champ n’est pas écrit');
});

test('la table 24 × 24 du catalogue 6 se lit sans trou', () => {
  for (const att of CAT6.cles) {
    for (const cible of CAT6.cles) {
      const d = degatsBase(CAT6, att, cible);
      assert.ok(Number.isInteger(d) && d >= 0 && d <= 130, `${att} → ${cible} : ${d}`);
    }
  }
  // La colonne du furtif : sept viseurs, dont l'exception nommée du porte-avions
  // (§13.3, règle 4) ; personne d'autre.
  const viseurs = CAT6.cles.filter((c) => degatsBase(CAT6, c, 'furtif') > 0).sort();
  assert.deepEqual(viseurs, ['antiair', 'chasseur', 'furtif', 'infanterie', 'meca', 'missiles_air', 'porte_avions']);
  assert.equal(degatsBase(CAT6, 'porte_avions', 'furtif'), 25);
  assert.equal(degatsBase(CAT6, 'missiles_air', 'furtif'), 100);
  // Sa ligne : zéro sur le sous-marin, qui garde ses cinq chasseurs.
  assert.equal(degatsBase(CAT6, 'furtif', 'sous_marin'), 0);
  assert.equal(degatsBase(CAT6, 'furtif', 'furtif'), 55);
});

// ---------------------------------------------------------------------------
// Furtivité : la bascule
// ---------------------------------------------------------------------------

test('la suite furtivite bascule visible → furtive → visible, et émet l’événement', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 2, y: 2 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const e = creerPartie(scene, CAT6, 'bascule');
  assert.equal(u(e, 'u1').furtive, undefined, 'à la création, le champ n’existe pas : visible');

  const r1 = appliquer(e, ordre('u1', [{ x: 2, y: 2 }], { type: 'furtivite' }), CAT6);
  assert.ok(r1.ok);
  if (!r1.ok) return;
  assert.equal(u(r1.etat, 'u1').furtive, true);
  assert.equal(u(r1.etat, 'u1').etat, 'agi', 'se cacher est un ordre, l’unité a joué');
  assert.ok(r1.evenements.some((ev) => ev.type === 'furtivite' && ev.uniteId === 'u1' && ev.furtive === true));
  // L'original n'a pas bougé.
  assert.equal(u(e, 'u1').furtive, undefined);

  // Une seconde bascule le même tour : l'unité a déjà agi.
  assert.equal(refuser(r1.etat, ordre('u1', [{ x: 2, y: 2 }], { type: 'furtivite' })), 'unite_deja_agi');

  // Après un déplacement, comme toute suite : la bascule inverse.
  const lendemain = journeeSuivante(r1.etat);
  const r2 = appliquer(lendemain, ordre('u1', [{ x: 2, y: 2 }, { x: 3, y: 2 }], { type: 'furtivite' }), CAT6);
  assert.ok(r2.ok);
  if (!r2.ok) return;
  assert.equal(u(r2.etat, 'u1').furtive, false);
  assert.equal(u(r2.etat, 'u1').x, 3);
  assert.ok(r2.evenements.some((ev) => ev.type === 'furtivite' && ev.uniteId === 'u1' && ev.furtive === false));
});

test('sans le trait, la furtivité est refusée ; d’un autre camp ou déjà jouée, l’ordre l’est avant', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'chasseur', x: 2, y: 2 },
    { camp: 0, type: 'helico', x: 4, y: 2 },
    { camp: 0, type: 'furtif', x: 6, y: 2 },
    { camp: 1, type: 'furtif', x: 8, y: 8 },
  ]);
  const e = creerPartie(scene, CAT6, 'sans-trait');
  // Voler ne suffit pas : c'est le trait `furtif`, et lui seul.
  assert.equal(refuser(e, ordre('u1', [{ x: 2, y: 2 }], { type: 'furtivite' })), 'furtivite_impossible');
  assert.equal(refuser(e, ordre('u2', [{ x: 4, y: 2 }], { type: 'furtivite' })), 'furtivite_impossible');
  // L'unité adverse n'est pas à moi : refus général de l'ordre, avant la suite.
  assert.equal(refuser(e, ordre('u4', [{ x: 8, y: 8 }], { type: 'furtivite' })), 'pas_mon_unite');
  // Une unité qui a déjà agi ne bascule plus ce tour.
  const joue = avec(e, 'u3', { etat: 'agi' });
  assert.equal(refuser(joue, ordre('u3', [{ x: 6, y: 2 }], { type: 'furtivite' })), 'unite_deja_agi');
});

// ---------------------------------------------------------------------------
// Furtivité : ce que l'adversaire voit
// ---------------------------------------------------------------------------

test('sous brouillard, une unité furtive n’est repérée qu’au contact', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 5, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 2 },
  ], { brouillard: true });
  const e = creerPartie(scene, CAT6, 'contact');
  assert.equal(brouillardActif(e), true);
  const furtif = u(e, 'u1');
  // Visible, en plaine, à deux cases d'un hélicoptère qui voit à deux : repéré.
  assert.equal(cacheeAuContact(e, CAT6, furtif), false);
  assert.ok(unitesVues(e, CAT6, 1).some((x) => x.id === 'u1'));

  const cache = exiger(e, ordre('u1', [{ x: 5, y: 0 }], { type: 'furtivite' }));
  assert.equal(cacheeAuContact(cache, CAT6, u(cache, 'u1')), true);
  assert.ok(casesVisibles(cache, CAT6, 1).has(cleCase({ x: 5, y: 0 })), 'la case reste éclairée…');
  assert.ok(!unitesVues(cache, CAT6, 1).some((x) => x.id === 'u1'), '…et l’unité y est invisible à distance 2');
  // À distance 1, elle est repérée, comme une coque en plongée.
  const contact = avec(cache, 'u2', { x: 5, y: 1 });
  assert.ok(unitesVues(contact, CAT6, 1).some((x) => x.id === 'u1'));
  // Son propre camp la voit toujours.
  assert.ok(unitesVues(cache, CAT6, 0).some((x) => x.id === 'u1'));
});

test('sans brouillard, une unité furtive est vue comme les autres : le brouillard éteint montre tout', () => {
  // Comportement réel de `unitesVues` : hors brouillard, toute unité posée est
  // rendue, plongée ou furtivité comprises. Écrit ici pour qu'un changement
  // soit un choix, jamais un accident.
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 5, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 2 },
  ]);
  const e = creerPartie(scene, CAT6, 'clair');
  assert.equal(brouillardActif(e), false);
  const cache = exiger(e, ordre('u1', [{ x: 5, y: 0 }], { type: 'furtivite' }));
  assert.equal(u(cache, 'u1').furtive, true);
  assert.equal(cacheeAuContact(cache, CAT6, u(cache, 'u1')), true, 'le trait s’applique…');
  assert.ok(unitesVues(cache, CAT6, 1).some((x) => x.id === 'u1'), '…mais sans brouillard, rien n’est caché');
});

test('la mémoire des vues suit la furtivité basculée sur place', () => {
  // `verifierChemin` mémoïse la vue sur l'état de travail avant la suite
  // `furtivite`, qui ne déplace rien : la signature doit porter le champ, sinon
  // une vue calculée avant la bascule survit à la bascule sur le même objet.
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 5, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 2 },
  ], { brouillard: true });
  const e = creerPartie(scene, CAT6, 'memoire');
  assert.ok(unitesVues(e, CAT6, 1).some((x) => x.id === 'u1'));
  u(e, 'u1').furtive = true;
  assert.ok(!unitesVues(e, CAT6, 1).some((x) => x.id === 'u1'), 'la vue mémoïsée a survécu à la bascule');
  u(e, 'u1').furtive = false;
  assert.ok(unitesVues(e, CAT6, 1).some((x) => x.id === 'u1'));
});

// ---------------------------------------------------------------------------
// Furtivité : le prix en carburant
// ---------------------------------------------------------------------------

test('se cacher coûte trois de carburant de plus par tour', () => {
  const type = CAT6.unites['furtif']!;
  assert.ok(type.carburant);
  const visible = { ...u(creerPartie(scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 2, y: 2 }, { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]), CAT6, 'conso'), 'u1') };
  assert.equal(SURCOUT_CARBURANT_FURTIF, 3);
  assert.equal(consommationParTour(type, visible), type.carburant.parTour);
  assert.equal(consommationParTour(type, { ...visible, furtive: true }), type.carburant.parTour + SURCOUT_CARBURANT_FURTIF);
  // Une unité sans carburant ne consomme rien, furtive ou non — le validateur
  // exige `vol` avec `furtif`, donc du carburant ; la fonction reste totale.
  assert.equal(consommationParTour(CAT6.unites['infanterie']!, { ...visible, furtive: true }), 0);
});

test('le carburant baisse de parTour visible, de parTour + 3 furtive, et la panne sèche arrive plus tôt', () => {
  const type = CAT6.unites['furtif']!;
  assert.ok(type.carburant);
  const { max, parTour } = type.carburant;
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 2, y: 2 },
    // Deux fantassins loin de tout, pour que la partie survive à la panne.
    { camp: 0, type: 'infanterie', x: 0, y: 9 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const e = creerPartie(scene, CAT6, 'carburant');
  // La journée 1 est ouverte à la création : une consommation a déjà eu lieu.
  assert.equal(u(e, 'u1').carburant, max - parTour);

  const visible = journeeSuivante(e);
  assert.equal(u(visible, 'u1').carburant, max - 2 * parTour);
  const furtive = journeeSuivante(exiger(e, ordre('u1', [{ x: 2, y: 2 }], { type: 'furtivite' })));
  assert.equal(u(furtive, 'u1').carburant, max - parTour - (parTour + SURCOUT_CARBURANT_FURTIF));

  // Jusqu'à la panne : la journée où `panne_seche` tombe, dans les deux cas.
  const journeeDePanne = (depart: EtatPartie): number => {
    let courant = depart;
    for (let i = 0; i < 80; i += 1) {
      const r = appliquer(courant, { type: 'finTour' }, CAT6);
      assert.ok(r.ok);
      if (!r.ok) break;
      courant = r.etat;
      if (r.evenements.some((ev) => ev.type === 'panne_seche' && ev.uniteId === 'u1')) return courant.journee;
    }
    throw new Error('aucune panne sèche');
  };
  const panneVisible = journeeDePanne(e);
  const panneFurtive = journeeDePanne(exiger(e, ordre('u1', [{ x: 2, y: 2 }], { type: 'furtivite' })));
  // Visible : max / parTour journées (12 sur 60 / 5). Furtive dès la journée 1 :
  // la première consommation était au tarif visible, les suivantes au tarif plein.
  assert.equal(panneVisible, Math.ceil(max / parTour));
  assert.equal(panneFurtive, 1 + Math.ceil((max - parTour) / (parTour + SURCOUT_CARBURANT_FURTIF)));
  assert.ok(panneFurtive < panneVisible);
});

// ---------------------------------------------------------------------------
// Furtivité : combat, fusion, états anciens, rejeu
// ---------------------------------------------------------------------------

test('un tir depuis l’état furtif laisse l’unité furtive, riposte comprise', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 3, y: 3 },
    { camp: 1, type: 'infanterie', x: 3, y: 4 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const e = avec(creerPartie(scene, CAT6, 'tir'), 'u1', { furtive: true });
  const r = appliquer(e, ordre('u1', [{ x: 3, y: 3 }], { type: 'attaquer', cible: { x: 3, y: 4 } }), CAT6);
  assert.ok(r.ok);
  if (!r.ok) return;
  const attaque = r.evenements.find((ev) => ev.type === 'attaque');
  assert.ok(attaque && attaque.type === 'attaque');
  assert.ok(attaque.degats > 0, 'le coup est parti');
  assert.ok(attaque.riposte > 0, 'la riposte est rendue : le contact découvre le tireur, pas le trait');
  assert.equal(u(r.etat, 'u1').furtive, true, 'tirer ne dévoile pas');
  assert.equal(u(r.etat, 'u1').munitions, (CAT6.unites['furtif']?.munitions ?? 0) - 1);
});

test('une fusion garde l’état de furtivité de la cible', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 3, y: 3, pv: 60 },
    { camp: 0, type: 'furtif', x: 3, y: 4, pv: 60 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ]);
  const e = creerPartie(scene, CAT6, 'fusion');
  const fusion = ordre('u1', [{ x: 3, y: 3 }], { type: 'fusionner', avec: 'u2' });
  // Cible furtive, source visible : la survivante reste furtive.
  const a = exiger(avec(e, 'u2', { furtive: true }), fusion);
  assert.equal(a.unites.filter((x) => x.camp === 0).length, 1);
  assert.equal(u(a, 'u2').furtive, true);
  assert.equal(u(a, 'u2').pv, 100);
  // Cible visible, source furtive : la survivante est visible.
  const b = exiger(avec(e, 'u1', { furtive: true }), fusion);
  assert.notEqual(u(b, 'u2').furtive, true);
});

test('un état du moteur 3, sans champ furtive, est accepté et l’unité y est visible', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 5, y: 0 },
    { camp: 1, type: 'helico', x: 5, y: 2 },
  ], { brouillard: true });
  // Un état sérialisé d'avant le catalogue 6 : mêmes clés, jamais `furtive`.
  const ancien = JSON.parse(JSON.stringify(creerPartie(scene, CAT6, 'moteur3'))) as EtatPartie;
  for (const x of ancien.unites) delete x.furtive;
  assert.ok(ancien.unites.every((x) => !('furtive' in x)));
  assert.equal(cacheeAuContact(ancien, CAT6, u(ancien, 'u1')), false);
  assert.ok(unitesVues(ancien, CAT6, 1).some((x) => x.id === 'u1'));
  // Et il se joue : la bascule écrit le champ pour la première fois.
  const cache = exiger(ancien, ordre('u1', [{ x: 5, y: 0 }], { type: 'furtivite' }));
  assert.equal(u(cache, 'u1').furtive, true);
  assert.ok(!unitesVues(cache, CAT6, 1).some((x) => x.id === 'u1'));
});

test('une partie qui contient des ordres furtivite se rejoue à l’identique', () => {
  const scene = scenePersonnalisee(PLAINE, {}, [
    { camp: 0, type: 'furtif', x: 2, y: 2 },
    { camp: 1, type: 'infanterie', x: 2, y: 5 },
    { camp: 1, type: 'infanterie', x: 9, y: 9 },
  ], { brouillard: true });
  const depart = creerPartie(scene, CAT6, 'rejeu-furtif');
  const actions: Action[] = [
    ordre('u1', [{ x: 2, y: 2 }], { type: 'furtivite' }),
    { type: 'finTour' }, { type: 'finTour' },
    ordre('u1', [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }], { type: 'attaquer', cible: { x: 2, y: 5 } }),
    { type: 'finTour' }, { type: 'finTour' },
    ordre('u1', [{ x: 2, y: 4 }], { type: 'furtivite' }),
  ];
  let e = depart;
  for (const a of actions) e = exiger(e, a);
  assert.equal(u(e, 'u1').furtive, false, 'cachée, puis montrée');
  const sauvegarde = enregistrerPartie(e, actions);
  assert.equal(sauvegarde.catalogueVersion, 6);
  const rejoue = rejouer(scene, CAT6, sauvegarde);
  assert.deepEqual(rejoue.refus, []);
  assert.equal(empreinte(rejoue.etat), empreinte(e));
  assert.equal(u(rejoue.etat, 'u1').furtive, false);
});

// ---------------------------------------------------------------------------
// Débarquement : toute la cale en un ordre
// ---------------------------------------------------------------------------

/** Une barge au milieu du détroit, deux fantassins sur chaque rive, embarqués. */
function bargeChargee(graine = 'barge'): EtatPartie {
  const scene = scenePersonnalisee(DETROIT, {}, [
    { camp: 0, type: 'barge', x: 4, y: 1 },
    { camp: 0, type: 'infanterie', x: 4, y: 0 },
    { camp: 0, type: 'infanterie', x: 4, y: 2 },
    { camp: 0, type: 'infanterie', x: 0, y: 3 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ]);
  const e = creerPartie(scene, CAT6, graine);
  const charge = exiger(exiger(e,
    ordre('u2', [{ x: 4, y: 0 }], { type: 'embarquer', transport: 'u1' })),
  ordre('u3', [{ x: 4, y: 2 }], { type: 'embarquer', transport: 'u1' }));
  assert.deepEqual(u(charge, 'u1').cargo, ['u2', 'u3']);
  // Une journée plus tard : tout le monde est prêt, la cale est toujours pleine.
  const pret = journeeSuivante(charge);
  assert.equal(u(pret, 'u1').etat, 'prete');
  assert.equal(u(pret, 'u2').dansTransport, 'u1');
  assert.equal(u(pret, 'u3').dansTransport, 'u1');
  return pret;
}

test('une barge pose ses deux passagers sur deux cases en un ordre, événements dans l’ordre', () => {
  const pret = bargeChargee();
  const r = appliquer(pret, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 4, y: 2 } }],
  }), CAT6);
  assert.ok(r.ok);
  if (!r.ok) return;
  const e = r.etat;
  // Sans `passager`, la cale se vide dans l'ordre d'embarquement.
  assert.deepEqual([u(e, 'u2').x, u(e, 'u2').y], [4, 0]);
  assert.deepEqual([u(e, 'u3').x, u(e, 'u3').y], [4, 2]);
  assert.equal(u(e, 'u2').dansTransport, null);
  assert.equal(u(e, 'u3').dansTransport, null);
  assert.deepEqual(u(e, 'u1').cargo, []);
  assert.equal(u(e, 'u1').etat, 'agi', 'le transport a joué');
  assert.equal(u(e, 'u2').etat, 'agi', 'un débarqué ne se déplace plus ce tour');
  assert.equal(u(e, 'u3').etat, 'agi');
  const debarquements = r.evenements.filter((ev) => ev.type === 'debarquement');
  assert.deepEqual(debarquements, [
    { type: 'debarquement', uniteId: 'u2', transportId: 'u1', vers: { x: 4, y: 0 } },
    { type: 'debarquement', uniteId: 'u3', transportId: 'u1', vers: { x: 4, y: 2 } },
  ]);
});

test('le passager se choisit, et l’adjacence se juge depuis la case d’arrivée', () => {
  const pret = bargeChargee('choix');
  const e = exiger(pret, ordre('u1', [{ x: 4, y: 1 }, { x: 5, y: 1 }], {
    type: 'debarquer', vers: { x: 5, y: 0 }, passager: 'u3', autres: [{ vers: { x: 5, y: 2 }, passager: 'u2' }],
  }));
  assert.deepEqual([u(e, 'u3').x, u(e, 'u3').y], [5, 0]);
  assert.deepEqual([u(e, 'u2').x, u(e, 'u2').y], [5, 2]);
  assert.deepEqual([u(e, 'u1').x, u(e, 'u1').y], [5, 1]);
  assert.deepEqual(u(e, 'u1').cargo, []);
});

test('un passager inconnu ou absent de la cale est un refus', () => {
  const pret = bargeChargee('inconnu');
  const debarquer = (passager: string): Action => ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, passager,
  });
  assert.equal(refuser(pret, debarquer('u99')), 'debarquement_impossible');
  // `u4` est à nous, mais sur la rive : il n'est pas dans la cale.
  assert.equal(refuser(pret, debarquer('u4')), 'debarquement_impossible');
  // Et en second : le premier ne débarque pas non plus.
  assert.equal(refuser(pret, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 4, y: 2 }, passager: 'u4' }],
  })), 'debarquement_impossible');
});

test('une seconde case occupée ou infranchissable refuse tout : le premier n’a pas débarqué', () => {
  const pret = bargeChargee('atomique');
  // Un fantassin ami sur la rive sud : la seconde case est prise.
  const occupee = avec(pret, 'u4', { x: 4, y: 2 });
  assert.equal(refuser(occupee, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 4, y: 2 } }],
  })), 'case_occupee');
  // La mer, pour un fantassin : infranchissable.
  assert.equal(refuser(pret, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 3, y: 1 } }],
  })), 'debarquement_impossible');
  // Non adjacente.
  assert.equal(refuser(pret, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 5, y: 2 } }],
  })), 'debarquement_impossible');
  // Deux demandes sur la même case : la seconde trouve le premier débarqué.
  assert.equal(refuser(pret, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 4, y: 0 } }],
  })), 'case_occupee');
  // Plus de demandes que de passagers.
  assert.equal(refuser(pret, ordre('u1', [{ x: 4, y: 1 }], {
    type: 'debarquer', vers: { x: 4, y: 0 }, autres: [{ vers: { x: 4, y: 2 } }, { vers: { x: 3, y: 1 } }],
  })), 'debarquement_impossible');
  // Après tous ces refus, la cale est intacte et personne n'a bougé.
  assert.deepEqual(u(pret, 'u1').cargo, ['u2', 'u3']);
  assert.equal(u(pret, 'u2').dansTransport, 'u1');
});

test('la forme ancienne, sans passager ni autres, débarque le premier de la cale et lui seul', () => {
  const pret = bargeChargee('ancienne');
  const e = exiger(pret, ordre('u1', [{ x: 4, y: 1 }], { type: 'debarquer', vers: { x: 4, y: 2 } }));
  assert.deepEqual([u(e, 'u2').x, u(e, 'u2').y], [4, 2]);
  assert.equal(u(e, 'u2').dansTransport, null);
  assert.equal(u(e, 'u3').dansTransport, 'u1', 'le second reste à bord');
  assert.deepEqual(u(e, 'u1').cargo, ['u3']);
});

// ---------------------------------------------------------------------------
// La cale ravitaillée
// ---------------------------------------------------------------------------

test('à bord d’un porte-avions, un chasseur fait le plein de munitions et de carburant, jamais de PV', () => {
  const scene = scenePersonnalisee(RADE, { '0,2': 0 }, [
    { camp: 0, type: 'porte_avions', x: 3, y: 1 },
    { camp: 0, type: 'chasseur', x: 3, y: 2 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ]);
  const e = creerPartie(scene, CAT6, 'cale');
  assert.equal(CAT6.unites['porte_avions']?.transport?.ravitaille, true);
  const embarque = exiger(e, ordre('u2', [{ x: 3, y: 2 }], { type: 'embarquer', transport: 'u1' }));
  assert.equal(u(embarque, 'u2').dansTransport, 'u1');
  // Un chasseur rentré à sec et abîmé, sur un porteur lui-même à sec.
  const vide = avec(avec(embarque, 'u2', { munitions: 0, carburant: 10, pv: 50 }), 'u1', { munitions: 0 });
  const lendemain = journeeSuivante(vide);
  const chasseur = CAT6.unites['chasseur']!;
  assert.equal(u(lendemain, 'u2').munitions, chasseur.munitions);
  assert.equal(u(lendemain, 'u2').carburant, chasseur.carburant?.max);
  assert.equal(u(lendemain, 'u2').pv, 50, 'on ne répare pas en mer');
  assert.equal(u(lendemain, 'u2').dansTransport, 'u1');
  // Le porteur, lui, reste à sec en pleine mer : seul le port le sert.
  assert.equal(u(lendemain, 'u1').munitions, 0);
  const aQuai = journeeSuivante(avec(lendemain, 'u1', { x: 0, y: 2 }));
  assert.equal(u(aQuai, 'u1').munitions, CAT6.unites['porte_avions']?.munitions);
});

test('à bord d’une barge, rien ne se remplit ; à bord du camion, si', () => {
  const scene = scenePersonnalisee(DETROIT, {}, [
    { camp: 0, type: 'barge', x: 4, y: 1 },
    { camp: 0, type: 'char_leger', x: 4, y: 0 },
    { camp: 0, type: 'transport', x: 8, y: 2 },
    { camp: 0, type: 'meca', x: 8, y: 3 },
    { camp: 1, type: 'infanterie', x: 9, y: 3 },
  ]);
  const e = creerPartie(scene, CAT6, 'barge-camion');
  assert.notEqual(CAT6.unites['barge']?.transport?.ravitaille, true);
  assert.equal(CAT6.unites['transport']?.transport?.ravitaille, true);
  const charge = exiger(exiger(e,
    ordre('u2', [{ x: 4, y: 0 }], { type: 'embarquer', transport: 'u1' })),
  ordre('u4', [{ x: 8, y: 3 }], { type: 'embarquer', transport: 'u3' }));
  const aSec = avec(avec(charge, 'u2', { munitions: 0, carburant: 10 }), 'u4', { munitions: 0 });
  const lendemain = journeeSuivante(aSec);
  assert.equal(u(lendemain, 'u2').munitions, 0, 'la barge ne fait que porter');
  assert.equal(u(lendemain, 'u2').carburant, 10);
  assert.equal(u(lendemain, 'u4').munitions, CAT6.unites['meca']?.munitions, 'le camion ravitaille sa cale');
});

// ---------------------------------------------------------------------------
// Non-régression : sur une carte terrestre, le 6 joue comme le 5
// ---------------------------------------------------------------------------

test('sur plaine.json, le catalogue 6 joue exactement comme le 5', () => {
  // Pas d'aéroport sur la plaine : le furtif n'y est jamais produit, et rien
  // d'autre n'a changé. Même graine, mêmes actions, même état final — au
  // numéro de catalogue près, qui est la seule différence attendue.
  const jouer = (cat: Catalogue): { etat: EtatPartie; actions: Action[] } => {
    const scene = sceneDeCarte(carte('plaine'), reglagesParDefaut({ limiteJournees: 10 }));
    const depart = creerPartie(scene, cat, 'six-contre-cinq');
    const r = jouerPartie(depart, [strategie('ponderee'), strategie('agressive')], creerRng('six-contre-cinq:ia'), cat);
    return { etat: r.etat, actions: r.actions };
  };
  const cinq = jouer(CAT5);
  const six = jouer(CAT6);
  assert.ok(cinq.actions.length > 10);
  assert.deepEqual(six.actions, cinq.actions);
  const sansVersion = (e: EtatPartie): string => canonique({ ...e, catalogueVersion: 0, journal: [] });
  assert.equal(sansVersion(six.etat), sansVersion(cinq.etat));
});
