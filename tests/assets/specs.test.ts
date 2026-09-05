/**
 * Le catalogue de spécifications d'assets : chaque unité, chaque kit national,
 * chaque bâtiment de territoire et chaque terrain du canon a sa spécification,
 * et chaque spécification passe son propre validateur.
 *
 * C'est le test qui empêche la dérive la plus coûteuse du pipeline : envoyer au
 * générateur externe un contrat que le dépôt refuserait au retour.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bilanPriorites, bilanSpecs, genererSpecs, nomModele, nomTexture, specUnite, territoires,
  validerAssetSpec, validerLotAssetSpec,
} from '../../src/assets/index';
import {
  chargerArchetypes, chargerPays, chargerRegions, chargerTerrains, chargerUnites,
} from '../../src/content/index';
import { BIOMES, TERRAINS_CAPTURABLES } from '../../src/schemas/types';

const specs = genererSpecs();

test('chaque spécification produite passe le validateur', () => {
  const erreurs: string[] = [];
  for (const spec of specs) {
    const r = validerAssetSpec(spec);
    if (!r.ok) erreurs.push(`${spec.id} : ${r.erreurs.map((e) => `${e.chemin} ${e.message}`).join(' | ')}`);
  }
  assert.deepEqual(erreurs, []);
});

test('le lot complet est valide et sans identifiant en double', () => {
  const r = validerLotAssetSpec(specs);
  assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.erreurs.slice(0, 5), null, 2));
});

test('chaque unité du catalogue a sa géométrie de base', () => {
  const unites = chargerUnites();
  for (const u of unites) {
    const spec = specs.find((s) => s.type === 'unite' && s.cle === `${u.cle}_base`);
    assert.ok(spec, `géométrie de base absente pour l'unité ${u.cle}`);
    assert.equal(spec.id, `unite_${u.cle}_base`);
    // Le masque d'équipe reste sur la base : c'est le repli du placeholder.
    assert.ok(spec.textures.some((t) => t.canal === 'masque_equipe' && t.obligatoire));
    // La silhouette du canon se retrouve dans la description anglaise.
    assert.match(spec.description.en, /Silhouette contract/);
    assert.ok(spec.description.en.includes(u.typeMouvement));
    // Les trois gabarits de forme sont décrits, sinon un kit ne peut rien choisir.
    for (const g of ['A', 'B', 'C']) assert.ok(spec.description.en.includes(`template ${g}`), spec.id);
    assert.equal(spec.priorite, 1, 'une géométrie partagée se produit en premier');
  }
  assert.equal(specs.filter((s) => s.type === 'unite').length, unites.length);
});

test('il y a un kit par couple (nation, unité), homologations comprises', () => {
  const unites = chargerUnites();
  const pays = chargerPays();
  const kits = specs.filter((s) => s.type === 'kit');
  assert.equal(kits.length, pays.length * unites.length);
  for (const p of pays) {
    for (const u of unites) {
      const kit = kits.find((s) => s.id === `kit_${p.code}_${u.cle}`);
      assert.ok(kit, `kit manquant : ${p.code} × ${u.cle}`);
      // Un kit est un jeu de textures complet, pas un masque teinté.
      assert.ok(kit.textures.some((t) => t.canal === 'albedo' && t.obligatoire), kit.id);
      assert.deepEqual(kit.variantes.nations, [p.code], kit.id);
      assert.ok(kit.verification.controles.includes('textures'), kit.id);
      // Le masque d'équipe subsiste, réduit au liseré de socle.
      const masque = kit.textures.find((t) => t.canal === 'masque_equipe');
      assert.ok(masque?.obligatoire, kit.id);
      assert.match(masque.note, /socle/);
      assert.match(kit.description.fr, /gabarit [ABC]/);
    }
  }
});

test('les huit terrains neutres restent partagés par tout le monde', () => {
  const capturables = new Set<string>(TERRAINS_CAPTURABLES);
  const terrains = chargerTerrains().filter((t) => !capturables.has(t.cle));
  for (const t of terrains) {
    const spec = specs.find((s) => s.type === 'terrain' && s.cle === t.cle);
    assert.ok(spec, `spécification absente pour le terrain ${t.cle}`);
    assert.equal(spec.echelle.caseEnMetres, 1);
    assert.equal(spec.priorite, 1);
  }
  assert.equal(specs.filter((s) => s.type === 'terrain').length, terrains.length);
});

test('les bâtiments sont par région pour la France et par pays sinon', () => {
  const capturables = [...TERRAINS_CAPTURABLES];
  const batiments = specs.filter((s) => s.type === 'batiment');
  const regions = chargerRegions('fr');
  const paysSansRegion = chargerPays().filter((p) => chargerRegions(p.code).length === 0);

  for (const region of regions) {
    const slug = region.code.replace('region_fr_', '');
    for (const t of capturables) {
      assert.ok(
        batiments.some((s) => s.id === `batiment_${t}_fr_${slug}`),
        `bâtiment manquant : ${t} en ${region.nom}`,
      );
    }
  }
  for (const p of paysSansRegion) {
    for (const t of capturables) {
      assert.ok(
        batiments.some((s) => s.id === `batiment_${t}_${p.code}`),
        `bâtiment manquant : ${t} pour ${p.code}`,
      );
    }
  }
  // Aucun bâtiment « français » générique : la France est régionale, sans exception.
  assert.equal(batiments.some((s) => s.id === 'batiment_ville_fr'), false);
  assert.equal(batiments.length, capturables.length * (regions.length + paysSansRegion.length));
});

test('un bâtiment porte le masque d’équipe, une carte d’émission et son style local', () => {
  for (const spec of specs.filter((s) => s.type === 'batiment')) {
    assert.ok(spec.textures.some((t) => t.canal === 'masque_equipe' && t.obligatoire), spec.id);
    assert.ok(spec.textures.some((t) => t.canal === 'emission' && t.obligatoire), spec.id);
    assert.ok(spec.animations.some((a) => a.nom === 'capture'), spec.id);
  }
  // La Bretagne a des toits d'ardoise, la Provence des tuiles rondes : deux
  // bâtiments de même type ne peuvent pas porter la même commande.
  const bretagne = specs.find((s) => s.id === 'batiment_ville_fr_bretagne');
  const provence = specs.find((s) => s.id === 'batiment_ville_fr_provence_alpes_cote_azur');
  assert.ok(bretagne && provence);
  assert.notEqual(bretagne.description.fr, provence.description.fr);
  assert.match(bretagne.description.fr, /ardoise/);
});

test('le décor est régional pour la France, national ailleurs, et minéral partout', () => {
  // Les rochers restent par biome : la roche est géologique, pas culturelle.
  for (const b of BIOMES) {
    assert.ok(specs.some((s) => s.id === `decor_rocher_${b}`), `rocher manquant pour ${b}`);
  }
  for (const region of chargerRegions('fr')) {
    const slug = region.code.replace('region_fr_', '');
    assert.ok(
      specs.some((s) => s.id === `decor_arbre_${region.biome}_fr_${slug}`),
      `décor manquant pour ${region.nom}`,
    );
  }
  for (const p of chargerPays().filter((x) => chargerRegions(x.code).length === 0)) {
    for (const b of p.biomes) {
      assert.ok(specs.some((s) => s.id === `decor_arbre_${b}_${p.code}`), `décor manquant : ${b} en ${p.code}`);
    }
  }
});

test('chaque archétype de commandant a son buste', () => {
  const archetypes = chargerArchetypes();
  for (const a of archetypes) {
    const spec = specs.find((s) => s.id === `commandant_${a.cle}`);
    assert.ok(spec, `buste manquant pour ${a.cle}`);
    assert.ok(spec.description.fr.includes(a.temperament), 'le tempérament du canon doit être repris');
  }
  assert.equal(specs.filter((s) => s.type === 'commandant').length, archetypes.length);
});

test('la priorité 1 couvre la France, ses premiers adversaires et le partagé', () => {
  const bilan = bilanPriorites(specs);
  assert.equal(bilan[1] + bilan[2] + bilan[3], specs.length);
  assert.ok(bilan[1] > 0 && bilan[2] > 0 && bilan[3] > 0);
  // Les kits français, luxembourgeois et suisses partent en premier ;
  // ceux de Fidji attendent leur tour.
  for (const code of ['fr', 'lu', 'ch']) {
    assert.equal(specs.find((s) => s.id === `kit_${code}_infanterie`)?.priorite, 1, code);
  }
  assert.equal(specs.find((s) => s.id === 'kit_fj_infanterie')?.priorite, 3);
  // Les dix-huit régions de France sont toutes de priorité 1 : c'est le pays
  // que le joueur traverse avant tout le reste.
  for (const spec of specs.filter((s) => s.id.includes('_fr_'))) {
    assert.equal(spec.priorite, 1, spec.id);
  }
});

test('les territoires sont les 18 régions de France et les 23 autres pays', () => {
  const t = territoires();
  assert.equal(t.filter((x) => x.region !== null).length, 18);
  assert.equal(t.filter((x) => x.region === null).length, 23);
  for (const x of t.filter((y) => y.region !== null)) assert.ok(x.styleRegion, x.region?.code);
  assert.equal(t.some((x) => x.pays.code === 'fr' && x.region === null), false);
});

test('le bilan compte toutes les spécifications', () => {
  const bilan = bilanSpecs(specs);
  const total = Object.values(bilan).reduce((a, b) => a + b, 0);
  assert.equal(total, specs.length);
  assert.equal(bilan.effet, 0, 'aucun effet n’est encore spécifié');
  assert.equal(bilan.kit, chargerPays().length * chargerUnites().length);
});

test('la génération est reproductible et triée par identifiant', () => {
  const encore = genererSpecs();
  assert.deepEqual(encore, specs);
  const ids = specs.map((s) => s.id);
  assert.deepEqual(ids, [...ids].sort());
});

test('les gabarits de nommage produisent les noms attendus', () => {
  const spec = specs.find((s) => s.id === 'unite_char_leger_base');
  assert.ok(spec);
  assert.equal(nomModele(spec, 0), 'unite_char_leger_base_lod0.glb');
  assert.equal(nomModele(spec, 2), 'unite_char_leger_base_lod2.glb');
  assert.equal(nomTexture(spec, 'albedo'), 'unite_char_leger_base_albedo.png');
  assert.equal(nomTexture(spec, 'albedo', 'hiver'), 'unite_char_leger_base_albedo_hiver.png');

  const kit = specs.find((s) => s.id === 'kit_fr_char_leger');
  assert.ok(kit);
  assert.equal(nomTexture(kit, 'albedo'), 'kit_fr_char_leger_albedo.png');
});

test('une spécification amputée est refusée avec un chemin lisible', () => {
  const spec = specs.find((s) => s.id === 'unite_infanterie_base');
  assert.ok(spec);
  const sansMasque = {
    ...spec,
    textures: spec.textures.filter((t) => t.canal !== 'masque_equipe'),
  };
  const r = validerAssetSpec(sansMasque);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.erreurs.some((e) => e.chemin === 'textures'));

  const idFaux = validerAssetSpec({ ...spec, id: 'unite_autre_chose' });
  assert.equal(idFaux.ok, false);
  if (!idFaux.ok) assert.ok(idFaux.erreurs.some((e) => e.chemin === 'id'));

  const sansPriorite = { ...spec } as Record<string, unknown>;
  delete sansPriorite['priorite'];
  assert.equal(validerAssetSpec(sansPriorite).ok, false);

  const prioriteFausse = validerAssetSpec({ ...spec, priorite: 4 });
  assert.equal(prioriteFausse.ok, false);

  const champEnTrop = validerAssetSpec({ ...spec, couleur: '#ffffff' });
  assert.equal(champEnTrop.ok, false);
});

test('une unité inconnue du dépôt reçoit quand même une spécification', () => {
  // Conséquence de l'homologation : le catalogue ne connaît aucune unité par son
  // nom, il compose depuis la `Silhouette` (`BRIEF.md`, arbitrage n° 8).
  const candidate = {
    ...chargerUnites()[0]!,
    cle: 'drone_solaire',
    nom: 'Drone solaire',
    nomCourt: 'Drone',
    traits: ['vision_etendue' as const],
    silhouette: {
      base: 'ailes' as const,
      corps: 'capsule' as const,
      modules: ['panneaux_solaires' as const, 'radar' as const],
      taille: 2 as const,
    },
    domaine: 'air' as const,
  };
  const spec = specUnite(candidate);
  const r = validerAssetSpec(spec);
  assert.equal(r.ok, true, r.ok ? '' : JSON.stringify(r.erreurs, null, 2));
  assert.equal(spec.id, 'unite_drone_solaire_base');
  assert.equal(spec.pivot.poseAuSol, false, 'ce qui vole est modélisé en vol');
  assert.ok(spec.format.noeuds.includes('module_panneaux_solaires'));
});
