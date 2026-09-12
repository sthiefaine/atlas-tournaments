import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validerMapDef, validerScenario, type MapDef, type Scenario } from '../../src/schemas';
import { appliquer, chargerCatalogue, creerPartie, creerRng, sceneDepuis } from '../../src/engine';
import { jouerPartie, strategie } from '../../src/ai/index';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { estLibre } from '../../src/app/jeu/parties-libres';

/**
 * La Forge de la retenue (`doc/refonte/superusine.md`) : une mission d'essai
 * où une superusine adverse fait sortir un automate par journée. Ce test tient
 * la conception à sa parole — dimensions, catalogue, victoire par élimination
 * seule, superusine sur une usine du camp gris, défense de la Forge, deux
 * modes — puis mesure ce qu'une IA en fait, sans prétendre mesurer la
 * difficulté humaine.
 */
function charger(): { scenario: Scenario; carte: MapDef } {
  const vs = validerScenario(JSON.parse(readFileSync('content/scenarios/aube_superusine.json', 'utf8')));
  assert.equal(vs.ok, true, vs.ok ? '' : JSON.stringify(vs.erreurs));
  if (!vs.ok) throw new Error('scénario');
  const vc = validerMapDef(JSON.parse(readFileSync(`content/cartes/${vs.valeur.carteCle}.json`, 'utf8')));
  assert.equal(vc.ok, true, vc.ok ? '' : JSON.stringify(vc.erreurs));
  if (!vc.ok) throw new Error('carte');
  return { scenario: vs.valeur, carte: vc.valeur };
}

const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

test('la Forge : carte 20 × 16, catalogue 9, élimination seule, superusine grise défendue, deux modes', () => {
  const { scenario, carte } = charger();
  assert.equal(carte.largeur, 20);
  assert.equal(carte.hauteur, 16);
  assert.equal(carte.camps, 2);
  assert.equal(scenario.catalogueVersion, 0);
  assert.equal(scenario.statut, 'brouillon');
  // Une mission d'anéantissement exclusif n'ajoute pas une capture gagnante (`doc/17`).
  assert.deepEqual(scenario.victoire, [{ type: 'hors_jeu_total' }]);
  assert.ok(scenario.defaite.some((d) => d.type === 'limite_journees' && d.journees === scenario.limiteJournees));
  assert.ok(scenario.limiteJournees !== null && scenario.limiteJournees >= 30 && scenario.limiteJournees <= 36);
  assert.deepEqual(scenario.factionsParCamp, { 1: 'atl' });
  assert.equal(scenario.commandants.find((c) => c.camp === 1)?.commandantCle, 'cmd_basile_kelm');

  // La superusine est une usine du camp gris : la prendre l'arrête, comme toute usine.
  assert.equal(scenario.superusines?.length, 1);
  const forge = scenario.superusines![0]!;
  assert.equal(forge.camp, 1);
  assert.equal(forge.type, 'meridien_automate');
  assert.equal(carte.grille[forge.y]?.[forge.x], 'U');
  assert.equal(carte.proprietaires[`${forge.x},${forge.y}`], 1);
  assert.equal(forge.depuisJournee, 2);
  assert.equal(forge.chaque, 1);
  assert.ok(forge.max !== undefined && forge.max >= 10 && forge.max <= 14);
  // Une usine ordinaire adverse en plus, et un radar à portée de la Forge.
  const usinesGrises = Object.entries(carte.proprietaires).filter(([k, c]) => c === 1 && carte.grille[Number(k.split(',')[1])]?.[Number(k.split(',')[0])] === 'U');
  assert.equal(usinesGrises.length, 2);
  const radar = Object.entries(carte.proprietaires).find(([k, c]) => c === 1 && carte.grille[Number(k.split(',')[1])]?.[Number(k.split(',')[0])] === 'T');
  assert.ok(radar, 'un radar gris');
  const [rx, ry] = radar![0].split(',').map(Number) as [number, number];
  assert.ok(manhattan({ x: rx, y: ry }, forge) <= 3);
  const bastion = carte.unitesDepart.find((u) => u.camp === 1 && u.type === 'meridien_bastion');
  assert.ok(bastion, 'un Bastion gris');
  assert.ok(manhattan(bastion!, forge) <= 2);
  // Le joueur a une économie réelle : QG, usine, aéroport et des villes.
  const miens = Object.entries(carte.proprietaires).filter(([, c]) => c === 0).map(([k]) => carte.grille[Number(k.split(',')[1])]![Number(k.split(',')[0])]);
  for (const car of ['H', 'U', 'A', 'C']) assert.ok(miens.includes(car), `le joueur part avec ${car}`);
  assert.ok(carte.unitesDepart.every((u) => u.camp !== 0 || !chargerCatalogue(0).unites[u.type]?.factionExclusive), 'rien de méridien chez le joueur');

  // Deux modes : le difficile serre les fonds et la stratégie, jamais la cadence de la Forge (le schéma ne la porte pas).
  assert.ok(scenario.modes);
  assert.equal(scenario.modes!.normal.strategieIa, 'ponderee');
  assert.equal(scenario.modes!.difficile.strategieIa, 'agressive');
  assert.ok(scenario.modes!.difficile.fondsDepartIa > scenario.modes!.normal.fondsDepartIa);
  assert.ok(scenario.modes!.difficile.revenusIaParBatiment > scenario.modes!.normal.revenusIaParBatiment);
  assert.equal(scenario.modes!.normal.fondsDepart, scenario.fondsDepart);
  assert.equal(scenario.modes!.normal.limiteJournees, scenario.limiteJournees);
  // Brouillon non cité par la campagne : il ne se liste pas tout seul, il faut l'ouvrir explicitement.
  assert.equal(estLibre(scenario, []), false);
});

test('la Forge : la partie se crée, la première machine sort à la journée 2 et s’arrête quand la Forge est prise', () => {
  const { scenario, carte } = charger();
  const cat = chargerCatalogue(scenario.catalogueVersion);
  const commandants = resoudreCommandantsScenario(scenario);
  let etat = creerPartie(sceneDepuis(scenario, carte, commandants), cat, 'aube:superusine:contrat');
  const automates = () => etat.unites.filter((u) => u.type === 'meridien_automate').length;
  assert.equal(automates(), 0);
  let produits = 0;
  for (let i = 0; i < 4; i++) {
    const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    produits += r.evenements.filter((e) => e.type === 'production_automatique').length;
    etat = r.etat;
  }
  assert.equal(etat.journee, 3);
  assert.equal(produits, 1, 'une machine à la journée 2, aucune à la journée 1');
  assert.equal(automates(), 1);
  assert.equal(etat.unites.find((u) => u.type === 'meridien_automate')?.camp, 1);
  // La Forge prise par le joueur : plus rien n'en sort.
  const forge = scenario.superusines![0]!;
  etat.proprietaires[`${forge.x},${forge.y}`] = 0;
  for (let i = 0; i < 4; i++) {
    const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    produits += r.evenements.filter((e) => e.type === 'production_automatique').length;
    etat = r.etat;
  }
  assert.equal(produits, 1);
});

/**
 * Mesure, pas certification (`doc/refonte/superusine.md` §5). Sur la graine de
 * référence, l'IA pondérée des deux côtés va à la limite : le joueur-IA détruit
 * une cinquantaine de pièces grises et ne prend jamais le poste de Basile —
 * il ne le prend pas non plus **sans** Forge, c'est la limite connue de l'IA
 * (« elle va aux points »), pas celle de la mission. La graine 2 finissait par
 * une élimination du joueur-IA à la journée 17 tant que Basile pouvait acheter
 * au menu sur sa Forge ; depuis que la Forge est **inerte** pour tout le monde
 * (décision du propriétaire, 10 septembre 2026 au soir), elle va aussi à la
 * limite. Les deux graines sont rejouées ici, et les automates comptés sur
 * l'événement `production_automatique`.
 */
test('la Forge : l’IA pondérée des deux côtés va à la limite sur les deux graines, la Forge à son plafond', () => {
  const { scenario, carte } = charger();
  const cat = chargerCatalogue(scenario.catalogueVersion);
  const commandants = resoudreCommandantsScenario(scenario);
  const strategies = scenario.commandants.map((c) => strategie(c.ia ?? 'ponderee'));
  const forge = scenario.superusines![0]!;
  const bilans: Record<string, { terminee: boolean; motif: string | null | undefined; journee: number; automates: number; vainqueur: number | null; forgeGrise: boolean }> = {};
  for (const graine of ['aube:superusine:1', 'aube:superusine:2']) {
    const etat0 = creerPartie(sceneDepuis(scenario, carte, commandants), cat, graine);
    const r = jouerPartie(etat0, strategies, creerRng(`${graine}:ia`), cat, commandants, 2000);
    let etat = etat0;
    let automates = 0;
    for (const action of r.actions) {
      const x = appliquer(etat, action, cat, commandants);
      assert.equal(x.ok, true, x.ok ? '' : `rejeu refusé : ${x.motif}`);
      if (!x.ok) return;
      automates += x.evenements.filter((e) => e.type === 'production_automatique').length;
      etat = x.etat;
    }
    bilans[graine] = {
      terminee: r.terminee, motif: etat.partie.motif, journee: r.journees, automates, vainqueur: r.vainqueur,
      forgeGrise: etat.proprietaires[`${forge.x},${forge.y}`] === 1,
    };
  }
  for (const b of Object.values(bilans)) {
    assert.ok(b.terminee, 'la partie se termine');
    assert.equal(b.automates, forge.max, 'la Forge va jusqu’à son plafond : personne ne l’a prise');
    assert.ok(b.forgeGrise, 'la Forge reste grise');
    assert.equal(b.vainqueur, 1, 'l’IA pondérée ne gagne pas cette mission : « dure » se mesure à la main');
  }
  const reference = bilans['aube:superusine:1']!;
  assert.equal(reference.motif, 'limite_journees', JSON.stringify(reference));
  assert.equal(reference.journee, (scenario.limiteJournees ?? 0) + 1);
  const temoin = bilans['aube:superusine:2']!;
  assert.ok(temoin.motif === 'limite_journees' || temoin.motif === 'hors_jeu_total', JSON.stringify(temoin));
});
