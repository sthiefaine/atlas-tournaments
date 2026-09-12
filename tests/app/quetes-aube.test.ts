import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validerMapDef, validerScenario } from '../../src/schemas';
import { appliquer, chargerCatalogue, creerPartie, sceneDepuis } from '../../src/engine';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';

for (const quete of ['convoi', 'archives']) {
  test(`quête ${quete} : carte compacte, porteur identifié et victoire classique sous quinze journées`, () => {
    const scenario = validerScenario(JSON.parse(readFileSync(`content/scenarios/aube_${quete}_secondaire.json`, 'utf8')));
    assert.ok(scenario.ok, scenario.ok ? '' : JSON.stringify(scenario.erreurs));
    if (!scenario.ok) return;
    const s = scenario.valeur;
    const carte = validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.carteCle}.json`, 'utf8')));
    assert.ok(carte.ok, carte.ok ? '' : JSON.stringify(carte.erreurs));
    if (!carte.ok) return;
    assert.ok(carte.valeur.largeur >= 10 && carte.valeur.largeur <= 14);
    assert.ok(carte.valeur.hauteur >= 10 && carte.valeur.hauteur <= 14);
    assert.equal(s.catalogueVersion, 0);
    assert.equal(s.limiteJournees, 15);
    assert.deepEqual(s.victoire, [{ type: 'capture_qg' }]);
    const cat = chargerCatalogue(s.catalogueVersion);
    const commandants = resoudreCommandantsScenario(s);
    const etat = creerPartie(sceneDepuis(s, carte.valeur, commandants), cat, 'quetes:contrat');
    const porteur = etat.unites.find(u => u.id === 'u1');
    assert.equal(porteur?.camp, 0);
    assert.equal(porteur?.type, quete === 'convoi' ? 'transport' : 'infanterie');
    const type = cat.unites[porteur!.type]!;
    const terrain = cat.terrains[Object.values(cat.terrains).find(t => t.car === carte.valeur.grille[porteur!.y]?.[porteur!.x])!.cle]!;
    assert.equal(typeof terrain.couts[type.typeMouvement], 'number');
    assert.ok(s.defaite.some(d => d.type === 'unite_perdue' && d.uniteRef === 'u1'));
    assert.ok(s.defaite.some(d => d.type === 'limite_journees' && d.journees === 15));
    // Même en prenant le QG, perdre le dossier n'est pas une réussite de la quête.
    etat.unites = etat.unites.filter(u => u.id !== 'u1');
    const qg = etat.camps.find(c => c.id === 1)?.qgCase;
    assert.ok(qg);
    etat.proprietaires[qg] = 0;
    const r = appliquer(etat, { type: 'finTour' }, cat, commandants);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.etat.partie.terminee, true);
    assert.notEqual(r.etat.partie.vainqueur, 0);
    assert.equal(r.etat.partie.motif, 'unite_protegee_perdue');
  });
}
