// La page /jeu liste les parties libres. Le calcul est pur et se vérifie ici
// sur le vrai canon, lu sur le disque comme la page le lit ; ni React, ni DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { VERSION_MOTEUR } from '../../src/engine/index';
import { validerMapDef, validerScenario, type MapDef, type Resultat, type Scenario } from '../../src/schemas/index';
import {
  CLE_DEMONSTRATION, estLibre, etatSauvegarde, partiesLibres, vignetteCarte, type CouleurCase,
} from '../../src/app/jeu/parties-libres';
import campagne from '../../content/campagne.json';

/** Lit et valide tous les JSON d'un dossier de `content/`, comme la page. */
function lireDossier<T>(dossier: string, valider: (brut: unknown) => Resultat<T>): T[] {
  const racine = path.resolve(import.meta.dirname, '..', '..', 'content', dossier);
  return readdirSync(racine)
    .filter((n) => n.endsWith('.json'))
    .sort()
    .map((n) => valider(JSON.parse(readFileSync(path.join(racine, n), 'utf8')) as unknown))
    .flatMap((r) => (r.ok ? [r.valeur] : []));
}

const SCENARIOS = lireDossier<Scenario>('scenarios', validerScenario);
const CARTES = new Map(lireDossier<MapDef>('cartes', validerMapDef).map((c) => [c.cle, c]));
const MISSIONS = campagne.missions.map((m) => m.scenarioCle);

test('les parties libres sont les scénarios en ligne qu’aucune épreuve ne cite, la démonstration en tête', () => {
  const parties = partiesLibres(SCENARIOS, CARTES, MISSIONS);
  const cles = parties.map((p) => p.cle);
  assert.equal(cles[0], CLE_DEMONSTRATION, 'la démonstration ouvre la liste');
  for (const m of MISSIONS) assert.ok(!cles.includes(m), `${m} est une épreuve de la campagne, pas une partie libre`);
  // Les deux cartes navales ont enfin leur porte.
  assert.ok(cles.includes('archipel_des_deux_rades'), 'l’archipel');
  assert.ok(cles.includes('bras_de_mer'), 'le bras de mer');
  // Tout scénario en ligne hors campagne y est : la liste suit le dossier, pas
  // une énumération à la main qui vieillirait.
  const attendues = SCENARIOS.filter((s) => estLibre(s, MISSIONS)).map((s) => s.code).sort();
  assert.deepEqual([...cles].sort(), attendues);
  assert.equal(new Set(cles).size, cles.length, 'deux fiches pour la même clé');
  // Après la démonstration, l'ordre est celui des clés : stable d'un rendu à l'autre.
  assert.deepEqual(cles.slice(1), [...cles.slice(1)].sort());
  assert.deepEqual(partiesLibres(SCENARIOS, CARTES, MISSIONS), parties, 'deux calculs, la même liste');
});

test('chaque fiche dit ce que la page affiche : la carte, le catalogue, les camps, l’adversaire', () => {
  for (const p of partiesLibres(SCENARIOS, CARTES, MISSIONS)) {
    const s = SCENARIOS.find((x) => x.code === p.cle)!;
    const c = CARTES.get(s.carteCle)!;
    assert.equal(p.nom, s.nom);
    assert.equal(p.largeur, c.largeur);
    assert.equal(p.hauteur, c.hauteur);
    assert.equal(p.biome, c.biome);
    assert.equal(p.camps, c.camps);
    assert.equal(p.catalogueVersion, s.catalogueVersion);
    assert.equal(p.limiteJournees, s.limiteJournees);
    assert.equal(p.brouillard, s.brouillard);
    assert.equal(p.adversaire?.commandantCle, s.commandants.find((x) => x.camp === 1)?.commandantCle);
    assert.equal(p.demonstration, p.cle === CLE_DEMONSTRATION);
  }
  const archipel = partiesLibres(SCENARIOS, CARTES, MISSIONS).find((p) => p.cle === 'archipel_des_deux_rades')!;
  assert.equal(archipel.catalogueVersion, 6, 'les cartes navales sont en catalogue 6');
  assert.equal(archipel.largeur, 20);
  assert.equal(archipel.hauteur, 14);
  assert.equal(archipel.biome, 'archipel');
  assert.equal(archipel.camps, 2);
  assert.equal(archipel.adversaire?.ia, 'ponderee');
});

test('un brouillon, un scénario sans carte ou une épreuve ne s’affichent pas', () => {
  const demo = SCENARIOS.find((s) => s.code === CLE_DEMONSTRATION)!;
  const brouillon: Scenario = { ...demo, cle: 'essai_prive', code: 'essai_prive', statut: 'brouillon' };
  const sansCarte: Scenario = { ...demo, cle: 'sans_carte', code: 'sans_carte', carteCle: 'carte_qui_manque' };
  const parties = partiesLibres([sansCarte, brouillon, demo], CARTES, MISSIONS);
  assert.deepEqual(parties.map((p) => p.cle), [CLE_DEMONSTRATION]);
  // Citée par la campagne, la démonstration cesserait d'être libre : c'est la
  // liste des épreuves qui décide, pas un champ du scénario.
  assert.equal(estLibre(demo, [...MISSIONS, CLE_DEMONSTRATION]), false);
  assert.equal(partiesLibres([demo], CARTES, [CLE_DEMONSTRATION]).length, 0);
  // Et sans épreuve du tout, les six missions deviendraient des parties libres.
  assert.equal(partiesLibres(SCENARIOS, CARTES, []).length, SCENARIOS.filter((s) => s.statut === 'en_ligne').length);
});

test('une sauvegarde se reprend si elle a joué et si le moteur et le catalogue sont ceux d’aujourd’hui', () => {
  const texte = (v: unknown): string => JSON.stringify(v);
  const ok = { scenarioCle: 'demo', actions: [{ type: 'fin_tour' }], engineVersion: VERSION_MOTEUR, catalogueVersion: 6 };
  assert.equal(etatSauvegarde(null, VERSION_MOTEUR, 6), 'aucune');
  assert.equal(etatSauvegarde('', VERSION_MOTEUR, 6), 'aucune');
  assert.equal(etatSauvegarde('pas du json', VERSION_MOTEUR, 6), 'aucune');
  assert.equal(etatSauvegarde(texte([1, 2]), VERSION_MOTEUR, 6), 'aucune');
  assert.equal(etatSauvegarde(texte({ ...ok, actions: [] }), VERSION_MOTEUR, 6), 'aucune', 'sans action, rien à reprendre');
  assert.equal(etatSauvegarde(texte({ ...ok, actions: 'oui' }), VERSION_MOTEUR, 6), 'aucune');
  assert.equal(etatSauvegarde(texte(ok), VERSION_MOTEUR, 6), 'en_cours');
  assert.equal(etatSauvegarde(texte(ok), VERSION_MOTEUR, 6, 2), 'perimee', 'les actions anciennes ne se rejouent pas sur une mission réécrite');
  assert.equal(etatSauvegarde(texte({ ...ok, scenarioVersion: 2 }), VERSION_MOTEUR, 6, 2), 'en_cours');
  // La règle de la page de jeu : un autre moteur ou un autre catalogue, et la
  // partie repart de zéro — on ne l'annonce donc pas comme reprenable.
  assert.equal(etatSauvegarde(texte({ ...ok, engineVersion: VERSION_MOTEUR - 1 }), VERSION_MOTEUR, 6), 'perimee');
  assert.equal(etatSauvegarde(texte({ ...ok, catalogueVersion: 5 }), VERSION_MOTEUR, 6), 'perimee');
});

// ---------------------------------------------------------------------------
// La vignette : la carte qu'on regarde avant de la choisir
// ---------------------------------------------------------------------------

/** Une teinte lisible dans les assertions, pour ne pas dépendre du canon ici. */
const TEINTES: Readonly<Record<string, string>> = { P: 'vert', F: 'sapin', W: 'bleu', C: 'gris' };
const teinte: CouleurCase = (car, camp) => (camp === null ? TEINTES[car] ?? 'noir' : `camp${camp}`);

/** Le nombre de cases qu'un tracé peint : la somme de ses `h{n}`. */
function casesPeintes(d: string): number {
  return [...d.matchAll(/h(\d+)v1/g)].reduce((n, m) => n + Number(m[1]), 0);
}

test('la vignette fond les cases voisines de même couleur en un seul rectangle', () => {
  const v = vignetteCarte({
    largeur: 4,
    hauteur: 2,
    grille: ['PPFP', 'WWCC'],
    // Une ville tenue par le camp 0 : sur une carte, un bâtiment se lit à la
    // couleur de qui le tient, jamais à celle de son toit.
    proprietaires: { '2,1': 0 },
  }, teinte);
  assert.equal(v.largeur, 4);
  assert.equal(v.hauteur, 2);
  assert.deepEqual(v.couches, [
    { couleur: 'vert', d: 'M0 0h2v1h-2zM3 0h1v1h-1z' },
    { couleur: 'sapin', d: 'M2 0h1v1h-1z' },
    { couleur: 'bleu', d: 'M0 1h2v1h-2z' },
    { couleur: 'camp0', d: 'M2 1h1v1h-1z' },
    { couleur: 'gris', d: 'M3 1h1v1h-1z' },
  ]);
  // L'ordre est celui d'apparition : deux rendus du serveur écrivent le même
  // balisage, donc l'hydratation ne se plaint de rien.
  assert.deepEqual(vignetteCarte({ largeur: 4, hauteur: 2, grille: ['PPFP', 'WWCC'], proprietaires: { '2,1': 0 } }, teinte), v);
});

test('une rangée trop courte laisse un trou plutôt qu’une couleur inventée', () => {
  const v = vignetteCarte({ largeur: 4, hauteur: 1, grille: ['PP'], proprietaires: {} }, teinte);
  assert.deepEqual(v.couches, [{ couleur: 'vert', d: 'M0 0h2v1h-2z' }]);
  assert.equal(v.couches.reduce((n, c) => n + casesPeintes(c.d), 0), 2, 'deux cases connues, deux cases peintes');
});

test('sur le canon, chaque carte se peint entièrement et sans doublon de couleur', () => {
  for (const carte of CARTES.values()) {
    const v = vignetteCarte(carte, teinte);
    const peintes = v.couches.reduce((n, c) => n + casesPeintes(c.d), 0);
    assert.equal(peintes, carte.largeur * carte.hauteur, `${carte.cle} : toutes les cases sont peintes une fois`);
    assert.equal(new Set(v.couches.map((c) => c.couleur)).size, v.couches.length, `${carte.cle} : une couleur, une couche`);
    // La fusion sert à quelque chose : sans elle, il y aurait une case par rectangle.
    const rectangles = v.couches.reduce((n, c) => n + (c.d.match(/z/g)?.length ?? 0), 0);
    assert.ok(rectangles < peintes, `${carte.cle} : ${rectangles} rectangles pour ${peintes} cases`);
  }
});

test('chaque partie libre dit la carte qu’elle joue, et la page sait la retrouver', () => {
  for (const p of partiesLibres(SCENARIOS, CARTES, MISSIONS)) {
    const s = SCENARIOS.find((x) => x.code === p.cle)!;
    assert.equal(p.carteCle, s.carteCle);
    assert.ok(CARTES.has(p.carteCle), `${p.cle} : la carte est dans le canon`);
  }
});
