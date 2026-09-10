import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerCatalogue } from '../../src/engine/index';
import { ROLES_UNITES } from '../../src/content/roles-unites';
import { IDENTITES_COMMANDANTS } from '../../src/content/identites-commandants';
import { chargerCommandantJeu } from '../../src/content/commandants-jeu';
import { ficheUnite } from '../../src/render/fiche-unite';

test('les 30 rôles sont distincts et accessibles par la fiche du joueur', () => {
  const catalogue = chargerCatalogue(9);
  assert.deepEqual(Object.keys(ROLES_UNITES).sort(), [...catalogue.cles].sort());
  assert.equal(new Set(Object.values(ROLES_UNITES).map(g => g.role)).size, 30);
  for (const cle of catalogue.cles) {
    const fiche = ficheUnite(catalogue, cle)!;
    assert.equal(fiche.guide, ROLES_UNITES[cle]);
    assert.ok(fiche.guide!.achat.length > 20);
    assert.ok(fiche.guide!.limite.length > 20);
    assert.ok(fiche.craint.every(d => d.degats > 0));
  }
});
test('les drones ont des achats distincts et le ravitailleur ne promet aucune attaque', () => {
  const catalogue = chargerCatalogue(9);
  assert.equal(ficheUnite(catalogue, 'drone_ravitailleur')!.forte.length, 0);
  assert.equal(ficheUnite(catalogue, 'drone')!.forte.length, 0);
  assert.ok(ficheUnite(catalogue, 'drone_intercepteur')!.forte.every(d => catalogue.unites[d.unite]!.traits.includes('vol')));
});
test('trois nouveaux profils tactiques ne changent pas les commandants historiques', () => {
  for (const cle of ['cmd_solveig_tamm', 'cmd_wren_osoko', 'cmd_hadran_ost']) {
    assert.deepEqual(chargerCommandantJeu(cle).pouvoir.effets, [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }]);
    assert.notDeepEqual(chargerCommandantJeu(cle, 2).pouvoir.effets, chargerCommandantJeu(cle).pouvoir.effets);
  }
  for (const cle of ['cmd_ariane_belloc', 'cmd_tomas_reiner']) assert.deepEqual(chargerCommandantJeu(cle, 2), chargerCommandantJeu(cle));
  assert.equal(new Set(IDENTITES_COMMANDANTS.map(p => p.style)).size, 5);
});
test('les profils spécialisés filtrent leurs bénéficiaires et Wren privilégie la vision', () => {
  const ost = chargerCommandantJeu('cmd_hadran_ost', 2).pouvoir.effets[0]!;
  assert.deepEqual('filtre' in ost && ost.filtre, { mouvement: ['chenilles'] });
  const solveig = chargerCommandantJeu('cmd_solveig_tamm', 2).pouvoir.effets[0]!;
  assert.deepEqual('filtre' in solveig && solveig.filtre, { types: ['transport', 'transport_air', 'barge'] });
  const wren = chargerCommandantJeu('cmd_wren_osoko', 2).pouvoir.effets[0]!;
  assert.deepEqual('modificateur' in wren && wren.modificateur, { quoi: 'vision', valeur: 2 });
});

test('les pouvoirs spécialisés changent seulement les unités prévues dans le moteur', async () => {
  const { appliquer, creerPartie, visionUnite } = await import('../../src/engine/index');
  const { multiplicateur } = await import('../../src/engine/regles/modificateurs');
  const { scenePersonnalisee } = await import('./aides');
  const cat = chargerCatalogue(8);
  const scene = scenePersonnalisee(Array.from({ length: 10 }, () => 'PPPPPPPPPP'), {}, [
    { camp: 0, type: 'transport', x: 1, y: 1 },
    { camp: 0, type: 'char_leger', x: 2, y: 1 },
    { camp: 0, type: 'infanterie', x: 3, y: 1 },
    { camp: 1, type: 'infanterie', x: 8, y: 8 },
  ]);
  for (const cle of ['cmd_solveig_tamm', 'cmd_hadran_ost', 'cmd_wren_osoko']) {
    const etat = creerPartie(scene, cat, cle);
    etat.camps[0]!.jauge = 900;
    etat.camps[0]!.jaugeMax = 900;
    const avant = visionUnite(etat, cat, etat.unites[2]!);
    const r = appliquer(etat, { type: 'pouvoir', niveau: 'normal' }, cat, [chargerCommandantJeu(cle, 2), null]);
    assert.ok(r.ok);
    if (!r.ok) continue;
    if (cle === 'cmd_solveig_tamm') {
      assert.equal(multiplicateur(r.etat, cat, r.etat.unites[0]!, 'defense'), 1.35);
      assert.equal(multiplicateur(r.etat, cat, r.etat.unites[1]!, 'defense'), 1);
    } else if (cle === 'cmd_hadran_ost') {
      assert.equal(multiplicateur(r.etat, cat, r.etat.unites[1]!, 'attaque'), 1.3);
      assert.equal(multiplicateur(r.etat, cat, r.etat.unites[2]!, 'attaque'), 1);
    } else {
      assert.equal(visionUnite(r.etat, cat, r.etat.unites[2]!), avant + 2);
    }
  }
});
