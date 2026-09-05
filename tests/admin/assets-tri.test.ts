/**
 * La partie pure de la section « Assets » de l'administration : lecture des
 * filtres d'URL, territoire déduit d'une spécification, filtrage, comptes, et
 * concordance entre le catalogue et `assets/specs/`. Pas de React ici.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { genererSpecs, bilanSpecs } from '../../src/assets/index';
import { chargerPays, chargerRegions } from '../../src/content/index';
import {
  comparerAuDossier, compterParPays, filtrerSpecs, lireFiltres, territoireDe, urlListe,
} from '../../src/app/admin/assets/tri';

const specs = genererSpecs();
const codes = new Set(chargerPays().map((p) => p.code));

test('lireFiltres n’accepte que les listes fermées et ignore le reste', () => {
  const vide = lireFiltres({}, codes);
  assert.deepEqual(vide, { type: null, priorite: null, pays: null, recherche: '' });

  const plein = lireFiltres({ type: 'kit', priorite: '2', pays: 'jp', q: '  Char ' }, codes);
  assert.deepEqual(plein, { type: 'kit', priorite: 2, pays: 'jp', recherche: 'char' });

  // Un lien périmé ne casse rien : la valeur inconnue vaut « pas de filtre ».
  const faux = lireFiltres({ type: 'vaisseau', priorite: '7', pays: 'zz' }, codes);
  assert.deepEqual(faux, { type: null, priorite: null, pays: null, recherche: '' });

  assert.equal(lireFiltres({ pays: 'partage' }, codes).pays, 'partage');
  // Un paramètre répété prend sa première valeur.
  assert.equal(lireFiltres({ type: ['terrain', 'kit'] }, codes).type, 'terrain');
});

test('territoireDe lit la nation et la région dans la forme de la clé', () => {
  const de = (id: string) => {
    const spec = specs.find((s) => s.id === id);
    assert.ok(spec, id);
    return territoireDe(spec, codes);
  };
  assert.deepEqual(de('kit_fr_char_leger'), { pays: 'fr', region: null });
  assert.deepEqual(de('batiment_ville_fr_bretagne'), { pays: 'fr', region: 'bretagne' });
  assert.deepEqual(de('batiment_ville_fr_provence_alpes_cote_azur'), { pays: 'fr', region: 'provence_alpes_cote_azur' });
  assert.deepEqual(de('batiment_ville_jp'), { pays: 'jp', region: null });
  assert.deepEqual(de('decor_arbre_cotier_fr_bretagne'), { pays: 'fr', region: 'bretagne' });
  assert.deepEqual(de('decor_rocher_plaine'), { pays: null, region: null });
  assert.deepEqual(de('unite_char_leger_base'), { pays: null, region: null });
  assert.deepEqual(de('terrain_foret'), { pays: null, region: null });
  assert.deepEqual(de('commandant_veteran'), { pays: null, region: null });
});

test('chaque territoire déduit existe dans le canon', () => {
  const regionsFr = new Set(chargerRegions('fr').map((r) => r.code.replace('region_fr_', '')));
  let sansNation = 0;
  for (const s of specs) {
    const t = territoireDe(s, codes);
    if (t.pays === null) {
      sansNation += 1;
      assert.equal(t.region, null, s.id);
      continue;
    }
    assert.ok(codes.has(t.pays), s.id);
    // Seule la France est régionale aujourd'hui, et toutes ses régions sont connues.
    if (t.region !== null) {
      assert.equal(t.pays, 'fr', s.id);
      assert.ok(regionsFr.has(t.region), `${s.id} : région inconnue ${t.region}`);
    }
    if (s.id.includes('_fr_')) assert.equal(t.pays, 'fr', s.id);
  }
  // Le partagé, c'est exactement : géométries de base, terrains, rochers, bustes.
  const bilan = bilanSpecs(specs);
  const rochers = specs.filter((s) => s.id.startsWith('decor_rocher_')).length;
  assert.equal(sansNation, bilan.unite + bilan.terrain + bilan.commandant + rochers);
});

test('filtrerSpecs combine les filtres et ne réordonne pas', () => {
  assert.equal(filtrerSpecs(specs, lireFiltres({}, codes), codes).length, specs.length);

  const kitsJp = filtrerSpecs(specs, lireFiltres({ type: 'kit', pays: 'jp' }, codes), codes);
  assert.ok(kitsJp.length > 0);
  assert.ok(kitsJp.every((s) => s.type === 'kit' && s.id.startsWith('kit_jp_')));

  const partage1 = filtrerSpecs(specs, lireFiltres({ pays: 'partage', priorite: '1' }, codes), codes);
  assert.ok(partage1.every((s) => s.priorite === 1 && territoireDe(s, codes).pays === null));

  const recherche = filtrerSpecs(specs, lireFiltres({ q: 'bretagne' }, codes), codes);
  assert.ok(recherche.length > 0);
  assert.ok(recherche.every((s) => s.id.includes('bretagne')));

  const ids = filtrerSpecs(specs, lireFiltres({ type: 'batiment' }, codes), codes).map((s) => s.id);
  assert.deepEqual(ids, [...ids].sort());

  assert.deepEqual(filtrerSpecs(specs, lireFiltres({ q: 'introuvable_xyz' }, codes), codes), []);
});

test('compterParPays couvre les 24 nations, le partagé, et fait le total', () => {
  const comptes = compterParPays(specs, codes);
  let total = 0;
  for (const n of comptes.values()) total += n;
  assert.equal(total, specs.length);
  for (const code of codes) assert.ok((comptes.get(code) ?? 0) > 0, code);
  assert.ok((comptes.get('partage') ?? 0) > 0);
  // La France est régionale : elle a plus de bâtiments et de décor que tout autre pays.
  const fr = comptes.get('fr') ?? 0;
  for (const code of codes) if (code !== 'fr') assert.ok(fr > (comptes.get(code) ?? 0), code);
});

test('comparerAuDossier relève les manquants et les intrus', () => {
  const ecart = comparerAuDossier(['a_b', 'c_d'], ['a_b.json', 'x_y.json', 'notes.txt']);
  assert.deepEqual(ecart, { manquants: ['c_d.json'], enTrop: ['x_y.json'] });
});

test('assets/specs/ contient exactement les fichiers que le canon produit', () => {
  const fichiers = readdirSync(path.resolve(__dirname, '../../assets/specs'));
  const ecart = comparerAuDossier(specs.map((s) => s.id), fichiers);
  assert.deepEqual(ecart, { manquants: [], enTrop: [] });
  assert.equal(fichiers.filter((f) => f.endsWith('.json')).length, specs.length);
});

test('urlListe n’écrit que les filtres posés', () => {
  assert.equal(urlListe({}), '/admin/assets');
  assert.equal(urlListe({ type: 'kit', priorite: 1 }), '/admin/assets?type=kit&priorite=1');
  assert.equal(urlListe({ pays: 'partage', recherche: 'ville' }), '/admin/assets?pays=partage&q=ville');
});
