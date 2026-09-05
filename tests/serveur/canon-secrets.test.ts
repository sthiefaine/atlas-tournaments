// `/api/canon` ne sert que `content/`, et jamais un secret (`doc/14-secrets.md` §0).
// La garantie principale est structurelle — `doc/` est hors du dossier servi — ; celle
// que ce test protège est la seconde barrière, si un fichier de `content/` venait un
// jour à porter un secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';

import { PREFIXES_SECRETS, estSecret } from '../../src/serveur/canon';

test('la route du canon refuse tout chemin de secret', () => {
  for (const p of PREFIXES_SECRETS) {
    assert.equal(estSecret(p), true, p);
    assert.equal(estSecret(`${p}/liste.json`), true);
    assert.equal(estSecret(`${p}.json`), true);
    assert.equal(estSecret(`${p}-2026.json`), true);
    assert.equal(estSecret(`${p}_easter.json`), true);
    assert.equal(estSecret(p.toUpperCase()), true, 'la casse ne contourne rien');
  }
});

test('la route du canon continue de servir le contenu ordinaire', () => {
  for (const chemin of ['unites.json', 'terrains.json', 'fils/fil_plume_regie.json',
    'gabarits-missions.json', 'i18n/glossaire.fr.json']) {
    assert.equal(estSecret(chemin), false, chemin);
  }
});

test('un préfixe de secret n’est pas confondu avec un mot qui commence pareil', () => {
  assert.equal(estSecret('secretariat.json'), false);
  assert.equal(estSecret('cartes/secrets.json'), false, 'seule la racine du canon est filtrée');
});

test('le dossier canon ne contient aujourd’hui aucun fichier de secret', () => {
  const racine = path.resolve(import.meta.dirname, '..', '..', 'content');
  for (const nom of readdirSync(racine)) assert.equal(estSecret(nom), false, `content/${nom}`);
});
