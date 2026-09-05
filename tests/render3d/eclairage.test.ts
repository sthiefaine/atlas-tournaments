// L'éclairage 3D : les 48 combinaisons (saison × phase × météo) doivent rendre
// 48 jeux de paramètres **distincts** — sans quoi la nuit d'hiver sous la neige
// ressemblerait à un midi d'été — et **bornés** — sans quoi une carte graphique
// se retrouverait à afficher un soleil à trente fois l'intensité utile.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MS_TRANSITION, melangerParametres, parametresAmbiance, type ParametresAmbiance,
} from '../../src/render3d/eclairage';
import { METEOS, PHASES_JOUR, SAISONS } from '../../src/schemas/index';

/** Les 48 combinaisons, avec leur clé lisible. */
function toutes(): { cle: string; p: ParametresAmbiance }[] {
  const sortie: { cle: string; p: ParametresAmbiance }[] = [];
  for (const saison of SAISONS) {
    for (const phase of PHASES_JOUR) {
      for (const meteo of METEOS) {
        sortie.push({ cle: `${saison}:${phase}:${meteo}`, p: parametresAmbiance(saison, phase, meteo) });
      }
    }
  }
  return sortie;
}

test('les 48 ambiances sont deux à deux distinctes', () => {
  const liste = toutes();
  assert.equal(liste.length, SAISONS.length * PHASES_JOUR.length * METEOS.length);
  assert.equal(liste.length, 48);
  const vues = new Map<string, string>();
  for (const { cle, p } of liste) {
    const empreinte = JSON.stringify(p);
    const deja = vues.get(empreinte);
    assert.equal(deja, undefined, `${cle} rend les mêmes paramètres que ${deja}`);
    vues.set(empreinte, cle);
  }
});

test('les ambiances sont mémorisées : même triplet, même objet', () => {
  assert.equal(
    parametresAmbiance('hiver', 'nuit', 'neige'),
    parametresAmbiance('hiver', 'nuit', 'neige'),
  );
});

test('tous les paramètres restent dans des bornes utilisables', () => {
  const hex = /^#[0-9a-f]{6}$/;
  for (const { cle, p } of toutes()) {
    assert.match(p.soleil.couleur, hex, `${cle} : couleur de soleil`);
    assert.match(p.hemisphere.ciel, hex, `${cle} : ciel hémisphérique`);
    assert.match(p.hemisphere.sol, hex, `${cle} : sol hémisphérique`);
    assert.match(p.ciel, hex, `${cle} : fond`);
    assert.match(p.brouillard.couleur, hex, `${cle} : brouillard`);
    assert.match(p.teinteSol, hex, `${cle} : teinte du sol`);
    assert.match(p.eau.couleur, hex, `${cle} : eau`);

    assert.ok(p.soleil.intensite >= 0 && p.soleil.intensite <= 6, `${cle} : intensité du soleil`);
    assert.ok(p.soleil.elevation >= 12 && p.soleil.elevation <= 82, `${cle} : élévation`);
    assert.ok(p.soleil.azimut >= 0 && p.soleil.azimut < 360, `${cle} : azimut`);
    assert.ok(p.hemisphere.intensite >= 0 && p.hemisphere.intensite <= 3, `${cle} : hémisphérique`);
    assert.ok(p.brouillard.densite >= 0 && p.brouillard.densite <= 0.2, `${cle} : densité`);
    assert.ok(p.exposition >= 0.4 && p.exposition <= 1.8, `${cle} : exposition`);
    for (const [nom, v] of [
      ['neigeSol', p.neigeSol], ['mouille', p.mouille], ['oscillation', p.oscillation],
      ['fenetres', p.fenetres], ['eau.opacite', p.eau.opacite], ['eau.agitation', p.eau.agitation],
    ] as const) {
      assert.ok(v >= 0 && v <= 1, `${cle} : ${nom} hors de [0, 1] (${v})`);
    }
    assert.ok(p.particules.nombre >= 0 && p.particules.nombre <= 4000, `${cle} : particules`);
    assert.ok(p.particules.inclinaison >= 0 && p.particules.inclinaison <= 1, `${cle} : vent`);
  }
});

test('la saison, la phase et la météo se lisent chacune dans les paramètres', () => {
  // La nuit baisse le soleil et allume les fenêtres, quelle que soit la météo.
  for (const meteo of METEOS) {
    const jour = parametresAmbiance('ete', 'jour', meteo);
    const nuit = parametresAmbiance('ete', 'nuit', meteo);
    assert.ok(nuit.soleil.intensite < jour.soleil.intensite, `nuit plus sombre (${meteo})`);
    assert.ok(nuit.fenetres > jour.fenetres, `fenêtres allumées la nuit (${meteo})`);
    assert.notEqual(nuit.soleil.couleur, jour.soleil.couleur);
  }
  // La saison change la couleur du soleil et la teinte du sol, de jour comme de nuit.
  for (const phase of PHASES_JOUR) {
    const couleurs = new Set(SAISONS.map((s) => parametresAmbiance(s, phase, 'clair').soleil.couleur));
    assert.equal(couleurs.size, SAISONS.length, `quatre soleils distincts (${phase})`);
    const sols = new Set(SAISONS.map((s) => parametresAmbiance(s, phase, 'clair').teinteSol));
    assert.equal(sols.size, SAISONS.length, `quatre sols distincts (${phase})`);
  }
  // L'hiver pose de la neige même par ciel clair ; la neige en pose davantage.
  assert.ok(parametresAmbiance('hiver', 'jour', 'clair').neigeSol > 0);
  assert.equal(parametresAmbiance('ete', 'jour', 'clair').neigeSol, 0);
  assert.equal(parametresAmbiance('ete', 'jour', 'neige').neigeSol, 1);
  // La météo se lit dans le brouillard, les particules et l'humidité.
  const densites = new Set(METEOS.map((m) => parametresAmbiance('ete', 'jour', m).brouillard.densite));
  assert.equal(densites.size, METEOS.length, 'six densités de brouillard distinctes');
  assert.equal(parametresAmbiance('ete', 'jour', 'clair').particules.calque, 'aucune');
  assert.equal(parametresAmbiance('ete', 'jour', 'pluie').particules.calque, 'pluie');
  assert.equal(parametresAmbiance('ete', 'jour', 'neige').particules.calque, 'neige');
  assert.equal(parametresAmbiance('ete', 'jour', 'brouillard').particules.calque, 'brume');
  assert.equal(parametresAmbiance('ete', 'jour', 'canicule').particules.calque, 'poussiere');
  const pluie = parametresAmbiance('ete', 'jour', 'pluie');
  const tempete = parametresAmbiance('ete', 'jour', 'tempete');
  assert.ok(tempete.particules.inclinaison > pluie.particules.inclinaison, 'la tempête couche la pluie');
  assert.ok(tempete.oscillation > pluie.oscillation, 'la tempête agite les arbres');
  assert.ok(pluie.mouille > 0.5, 'la pluie mouille les matières');
  assert.equal(parametresAmbiance('ete', 'jour', 'canicule').mouille, 0);
  assert.ok(
    parametresAmbiance('ete', 'jour', 'brouillard').brouillard.densite
    > parametresAmbiance('ete', 'jour', 'tempete').brouillard.densite,
    'le brouillard est ce qui bouche le plus',
  );
});

test('la transition d’ambiance interpole sans jamais sortir des bornes', () => {
  assert.ok(MS_TRANSITION > 0 && MS_TRANSITION <= 2000);
  const a = parametresAmbiance('ete', 'jour', 'clair');
  const b = parametresAmbiance('hiver', 'nuit', 'neige');
  // Aux extrémités on retrouve les bornes (au flottant près sur les nombres).
  const debut = melangerParametres(a, b, 0);
  const fin = melangerParametres(a, b, 1);
  assert.equal(debut.ciel, a.ciel);
  assert.equal(debut.particules.calque, a.particules.calque);
  assert.ok(Math.abs(debut.soleil.intensite - a.soleil.intensite) < 1e-9);
  assert.ok(Math.abs(debut.neigeSol - a.neigeSol) < 1e-9);
  assert.equal(fin.ciel, b.ciel);
  assert.equal(fin.particules.calque, b.particules.calque);
  assert.ok(Math.abs(fin.soleil.intensite - b.soleil.intensite) < 1e-9);
  assert.ok(Math.abs(fin.brouillard.densite - b.brouillard.densite) < 1e-9);
  for (const t of [-1, 0.25, 0.5, 0.75, 2]) {
    const m = melangerParametres(a, b, t);
    const bas = Math.min(a.soleil.intensite, b.soleil.intensite);
    const haut = Math.max(a.soleil.intensite, b.soleil.intensite);
    assert.ok(m.soleil.intensite >= bas - 1e-9 && m.soleil.intensite <= haut + 1e-9);
    assert.ok(m.neigeSol >= 0 && m.neigeSol <= 1);
    assert.match(m.ciel, /^#[0-9a-f]{6}$/);
  }
  // À mi-chemin, le calque de particules a déjà basculé sur la cible.
  assert.equal(melangerParametres(a, b, 0.6).particules.calque, 'neige');
});
