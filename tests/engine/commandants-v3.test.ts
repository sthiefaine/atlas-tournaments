import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listerProfilsCommandants, lireProfilCommandant } from '../../src/content/profils-commandants';
import { chargerCommandantJeu, resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { appliquer, chargerCatalogue, creerPartie, estModificateurDurable } from '../../src/engine/index';
import { scenePersonnalisee } from './aides';
import scenarioJson from '../../content/scenarios/couleurs_alliees.json';
import { validerScenario } from '../../src/schemas/index';

const cat = chargerCatalogue(0);
test('34 commandants explicites couvrent 24 nations, huit adversaires et deux Atlas', () => {
  const profils = listerProfilsCommandants(3);
  assert.equal(profils.length, 34);
  assert.equal(new Set(profils.map(p => p.cle)).size, 34);
  assert.equal(profils.filter(p => p.paysCode).length, 24);
  for (const p of profils) {
    assert.ok(p.contreJeu.length > 20);
    assert.ok(p.pouvoir.barres < p.superPouvoir.barres);
    assert.notDeepEqual(p.pouvoir.effets, p.superPouvoir.effets);
    for (const effet of [p.passif, ...p.pouvoir.effets, ...p.superPouvoir.effets]) {
      if (!effet || !('modificateur' in effet)) continue;
      for (const cle of effet.filtre?.types ?? []) assert.ok(cat.unites[cle], `${p.cle}: ${cle}`);
    }
  }
});

test('les 68 pouvoirs se paient et expirent au prochain tour propre, après le tour adverse', () => {
  for (const profil of listerProfilsCommandants(3)) for (const niveau of ['normal', 'super'] as const) {
    const commandant = chargerCommandantJeu(profil.cle, 3);
    const scene = scenePersonnalisee(['PPPP', 'PPPP', 'PPPP', 'PPPP'], {}, [
      { camp: 0, type: 'infanterie', x: 0, y: 0 },
      { camp: 1, type: 'infanterie', x: 3, y: 3 },
    ]);
    const etat = creerPartie(scene, cat, profil.cle);
    etat.camps[0]!.jauge = 900;
    etat.camps[0]!.jaugeMax = 900;
    const commandants = [commandant, null];
    const active = appliquer(etat, { type: 'pouvoir', niveau }, cat, commandants);
    assert.ok(active.ok, `${profil.cle}/${niveau}`);
    if (!active.ok) continue;
    const capacite = niveau === 'normal' ? commandant.pouvoir : commandant.superPouvoir;
    assert.equal(active.etat.camps[0]!.jauge, 900 - capacite.barres * 100);
    // Seuls les modificateurs **durables** restent dans l'état : un soin, des
    // dégâts directs, un ravitaillement, une réactivation ou une météo
    // s'appliquent au déclenchement et ne laissent rien (10 septembre 2026).
    const nombre = active.etat.modificateurs.length;
    assert.equal(nombre, capacite.effets.filter(estModificateurDurable).length);
    const adverse = appliquer(active.etat, { type: 'finTour' }, cat, commandants);
    assert.ok(adverse.ok);
    if (!adverse.ok) continue;
    assert.equal(adverse.etat.modificateurs.length, nombre);
    const prochain = appliquer(adverse.etat, { type: 'finTour' }, cat, commandants);
    assert.ok(prochain.ok);
    if (prochain.ok) assert.equal(prochain.etat.modificateurs.length, 0);
  }
});

test('la révision 3 exige une sélection explicite et ses profils sont isolés des mutations', () => {
  const validation = validerScenario(scenarioJson);
  assert.ok(validation.ok);
  if (!validation.ok) return;
  // Le scénario joue la révision 4 depuis le 10 septembre 2026 ; ce que ce test
  // tient, c'est qu'un scénario **sans** révision déclarée garde la sienne.
  const sansRevision = { ...validation.valeur };
  delete sansRevision.commandantsVersion;
  const scenario = { ...sansRevision, catalogueVersion: 0 };
  const anciens = resoudreCommandantsScenario(scenario);
  assert.deepEqual(anciens, resoudreCommandantsScenario({ ...scenario, commandantsVersion: 2 }));
  assert.notDeepEqual(anciens, resoudreCommandantsScenario({ ...scenario, commandantsVersion: 3 }));
  const profil = lireProfilCommandant('cmd_tomas_reiner', 3)!;
  profil.pouvoir.effets.length = 0;
  assert.ok(chargerCommandantJeu(profil.cle, 3).pouvoir.effets.length > 0);
  assert.throws(() => chargerCommandantJeu('absent', 3), /absent/i);
});
