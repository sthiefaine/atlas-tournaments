/**
 * `lignesPouvoir` : chaque famille d'effet du 10 septembre 2026
 * (`04-gameplay.md` §7.2) se dit en une ligne juste, chiffres et cible
 * compris. Avant, tout effet sans `modificateur` était « modifie le terrain »,
 * ce qui était faux pour un ravitaillement, une réactivation et une météo.
 *
 * Le `t` factice rend la clé et ses paramètres : on vérifie **quelle** clé et
 * **quels** chiffres, pas une phrase française.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { traducteur } from '../../src/i18n/index';
import {
  cibleDite, effetInstantane, libelleDuree, lignesPouvoir, type Traduire,
} from '../../src/render/libelles';
import type { EffetPouvoir } from '../../src/schemas/types';

const t: Traduire = (cle, params) => (params ? `${cle} ${JSON.stringify(params)}` : cle);

test('les modificateurs durables : pour cent ou points, cible tue quand elle va de soi', () => {
  const effets: EffetPouvoir[] = [
    { cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } },
    { cible: 'mes_unites', modificateur: { quoi: 'mouvement', valeur: 1 } },
    { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 1.5 } },
    { cible: 'unites_adverses', modificateur: { quoi: 'defense', valeur: 0.85 } },
  ];
  assert.deepEqual(lignesPouvoir(t, effets), [
    'hud.effet_pourcent {"quoi":"modificateur.attaque","signe":"+","n":20}',
    'hud.effet_points {"quoi":"modificateur.mouvement","signe":"+","n":1}',
    'hud.effet_pourcent {"quoi":"modificateur.fonds","signe":"+","n":50}',
    'effet.pour {"effet":"hud.effet_pourcent {\\"quoi\\":\\"modificateur.defense\\",\\"signe\\":\\"−\\",\\"n\\":15}","cible":"cible.unites_adverses"}',
  ]);
});

test('les trois grandeurs neuves ont leur forme : prix en pour cent, chance et étoiles en points', () => {
  const effets: EffetPouvoir[] = [
    { cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.75 } },
    { cible: 'mes_unites', modificateur: { quoi: 'chance', valeur: 2 } },
    { cible: 'unites_adverses', modificateur: { quoi: 'etoiles', valeur: -1 } },
    { cible: 'mes_unites', modificateur: { quoi: 'carburant', valeur: 0.5 } },
  ];
  assert.deepEqual(lignesPouvoir(t, effets), [
    'hud.effet_pourcent {"quoi":"modificateur.prix","signe":"−","n":25}',
    'hud.effet_points {"quoi":"modificateur.chance","signe":"+","n":2}',
    'effet.pour {"effet":"hud.effet_points {\\"quoi\\":\\"modificateur.etoiles\\",\\"signe\\":\\"−\\",\\"n\\":1}","cible":"cible.unites_adverses"}',
    'hud.effet_pourcent {"quoi":"modificateur.carburant","signe":"−","n":50}',
  ]);
});

test('les instantanés : soin, dégâts directs, ravitaillement, réactivation, météo', () => {
  const effets: EffetPouvoir[] = [
    { cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 2 } },
    { cible: 'toutes_unites', modificateur: { quoi: 'soin', valeur: 1 } },
    { cible: 'unites_adverses', modificateur: { quoi: 'degats_directs', valeur: 1 } },
    { cible: 'mes_unites', ravitailler: { carburant: true, munitions: true } },
    { cible: 'mes_unites', ravitailler: { carburant: true, munitions: false } },
    { cible: 'mes_unites', ravitailler: { carburant: false, munitions: true } },
    { cible: 'mes_unites', reactiver: true },
    { cible: 'terrain', meteo: { valeur: 'neige', journees: 1 } },
    { cible: 'terrain', meteo: { valeur: 'tempete', journees: 2 } },
    {
      cible: 'terrain',
      poserTerrain: { forme: 'pont', depuis: ['mer'], vers: 'pont', casesMax: 2, contigu: true, duree: 'permanent' },
    },
  ];
  assert.deepEqual(lignesPouvoir(t, effets), [
    'effet.soin {"n":2,"cible":"cible.mes_unites"}',
    'effet.soin {"n":1,"cible":"cible.toutes_unites"}',
    'effet.degats_directs {"n":1,"cible":"cible.unites_adverses"}',
    'effet.ravitailler {"cible":"cible.mes_unites"}',
    'effet.ravitailler_carburant {"cible":"cible.mes_unites"}',
    'effet.ravitailler_munitions {"cible":"cible.mes_unites"}',
    'effet.reactiver {"cible":"cible.mes_unites"}',
    'effet.meteo {"meteo":"meteo.neige"}',
    'effet.meteo_deux {"meteo":"meteo.tempete"}',
    'hud.effet_terrain',
  ]);
});

test('un filtre se dit : types nommés par l’appelant, mouvement, terrain, rayon', () => {
  const noms = { unite: (c: string) => `U:${c}`, terrain: (c: string) => `T:${c}` };
  assert.equal(
    cibleDite(t, { cible: 'mes_unites', filtre: { types: ['artillerie', 'roquettes'] } }, noms),
    'cible.precisee {"cible":"cible.mes_unites","filtre":"U:artillerie, U:roquettes"}',
  );
  assert.equal(
    cibleDite(t, { cible: 'unites_adverses', filtre: { mouvement: ['pied'] } }),
    'cible.precisee {"cible":"cible.unites_adverses","filtre":"mouvement.pied"}',
  );
  assert.equal(
    cibleDite(t, { cible: 'mes_unites', filtre: { surTerrain: ['ville', 'usine'], rayon: { centre: 'toutes', cases: 2 } } }, noms),
    'cible.precisee {"cible":"cible.mes_unites","filtre":"filtre.sur_terrain {\\"liste\\":\\"T:ville, T:usine\\"} · filtre.rayon {\\"n\\":2}"}',
  );
  // Sans noms fournis, la clé de canon passe par t() : jamais la clé brute.
  assert.equal(
    cibleDite(t, { cible: 'mes_unites', filtre: { types: ['char_lourd'] } }),
    'cible.precisee {"cible":"cible.mes_unites","filtre":"unite.char_lourd.nom"}',
  );
  // L'économie et le terrain n'ont pas de « pour qui ».
  assert.equal(cibleDite(t, { cible: 'economie' }), '');
  // Un modificateur filtré se dit avec sa cible, même sur « vos unités ».
  assert.deepEqual(
    lignesPouvoir(t, [{ cible: 'mes_unites', filtre: { mouvement: ['chenilles'] }, modificateur: { quoi: 'attaque', valeur: 1.3 } }]),
    ['effet.pour {"effet":"hud.effet_pourcent {\\"quoi\\":\\"modificateur.attaque\\",\\"signe\\":\\"+\\",\\"n\\":30}","cible":"cible.precisee {\\"cible\\":\\"cible.mes_unites\\",\\"filtre\\":\\"mouvement.chenilles\\"}"}'],
  );
});

test('la durée, quand on la donne, ferme la liste ; jamais sur une liste vide', () => {
  const effet: EffetPouvoir = { cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } };
  assert.deepEqual(lignesPouvoir(t, [effet], { duree: 'ce_tour' }).at(-1), 'duree.ce_tour');
  assert.deepEqual(lignesPouvoir(t, [effet], { duree: 'tour_complet' }).at(-1), 'duree.tour_complet');
  assert.deepEqual(lignesPouvoir(t, [effet], { duree: { type: 'journees', n: 2 } }).at(-1), 'duree.journees {"n":2}');
  assert.deepEqual(lignesPouvoir(t, [], { duree: 'ce_tour' }), []);
  assert.equal(libelleDuree(t, 'ce_tour'), 'duree.ce_tour');
});

test('effetInstantane lit la forme des données : soin et dégâts directs le sont, une attaque non', () => {
  assert.equal(effetInstantane({ cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 2 } }), true);
  assert.equal(effetInstantane({ cible: 'unites_adverses', modificateur: { quoi: 'degats_directs', valeur: 1 } }), true);
  assert.equal(effetInstantane({ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }), false);
  assert.equal(effetInstantane({ cible: 'mes_unites', ravitailler: { carburant: true, munitions: false } }), true);
  assert.equal(effetInstantane({ cible: 'mes_unites', reactiver: true }), true);
  assert.equal(effetInstantane({ cible: 'terrain', meteo: { valeur: 'pluie', journees: 1 } }), true);
  assert.equal(effetInstantane({
    cible: 'terrain',
    poserTerrain: { forme: 'pont', depuis: ['mer'], vers: 'pont', casesMax: 1, contigu: false, duree: 'permanent' },
  }), false);
});

test('en français, chaque famille rend une phrase pleine, sans marqueur ni clé', () => {
  const fr = traducteur('fr');
  const lignes = lignesPouvoir(fr, [
    { cible: 'mes_unites', modificateur: { quoi: 'soin', valeur: 2 } },
    { cible: 'economie', modificateur: { quoi: 'prix', valeur: 0.75 } },
    { cible: 'terrain', meteo: { valeur: 'neige', journees: 1 } },
    { cible: 'mes_unites', filtre: { mouvement: ['pied'] }, reactiver: true },
    { cible: 'unites_adverses', modificateur: { quoi: 'etoiles', valeur: -1 } },
  ], { duree: 'ce_tour' });
  assert.deepEqual(lignes, [
    '+2 PV pour vos unités',
    'Prix d’achat −25 %',
    'Neige pendant une journée',
    'Nouveau tour pour vos unités (à pied)',
    'Étoiles de terrain −1 pour les unités adverses',
    'ce tour',
  ]);
  for (const l of lignes) {
    assert.doesNotMatch(l, /[{}]/, `marqueur non substitué : ${l}`);
    assert.doesNotMatch(l, /\b[a-z]+\.[a-z_]+\b/, `clé brute : ${l}`);
  }
});

test('les trois familles de la faction se disent avec leurs chiffres : rayon, PV, nombre, choix', () => {
  const effets: EffetPouvoir[] = [
    { cible: 'terrain', frappe: { pv: 2, rayon: 2 } },
    { cible: 'terrain', frappe: { pv: 3, rayon: 0 } },
    { cible: 'unites_adverses', laser: { pv: 3, nombre: 2, choix: 'plus_avancees' } },
    { cible: 'unites_adverses', laser: { pv: 5, nombre: 1, choix: 'plus_cheres' } },
    { cible: 'terrain', iem: { rayon: 2, abattre: false } },
    { cible: 'terrain', iem: { rayon: 1, abattre: true } },
  ];
  assert.deepEqual(lignesPouvoir(t, effets), [
    'effet.frappe {"pv":2,"rayon":2}',
    'effet.frappe_case {"pv":3}',
    'effet.laser_plus_avancees {"pv":3,"n":2}',
    'effet.laser_plus_cheres_une {"pv":5,"n":1}',
    'effet.iem {"rayon":2}',
    'effet.iem_abattre {"rayon":1}',
  ]);
  // Et en français, la phrase existe et les gabarits se substituent.
  const fr: Traduire = (cle, params) => traducteur('fr')(cle, params);
  for (const ligne of lignesPouvoir(fr, effets)) {
    assert.ok(ligne.length > 0, 'chaque famille a sa chaîne');
    assert.doesNotMatch(ligne, /[{}]/);
  }
  assert.equal(lignesPouvoir(fr, [effets[2]!])[0], 'Rayon : −3 PV à vos 2 unités les plus avancées');
});
