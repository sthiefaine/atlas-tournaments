// Les prompts métier : sections verrouillées, VERROU_ROMPU, diff (05 §5.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLES_PROMPT,
} from '../../src/schemas/index';
import {
  DEFAULT_PROMPT_VERSION, NOMS_VERROUS, PROMPTS_PAR_DEFAUT, diffLignes, empreintesSections,
  estClePrompt, estVerrouCasse, verifierVerrous,
} from '../../src/serveur/prompts';

test('les cinq prompts embarqués existent et portent leurs deux verrous', () => {
  for (const cle of CLES_PROMPT) {
    const corps = PROMPTS_PAR_DEFAUT[cle];
    assert.ok(corps.length > 400, `${cle} : corps trop court`);
    const empreintes = empreintesSections(corps);
    assert.equal(estVerrouCasse(empreintes), false, `${cle} : verrous mal formés`);
    if (!estVerrouCasse(empreintes)) {
      assert.deepEqual(Object.keys(empreintes).sort(), [...NOMS_VERROUS].sort());
    }
  }
  assert.equal(DEFAULT_PROMPT_VERSION >= 1, true);
});

test('les verrous portent bien les invariants qu’ils sont censés tenir', () => {
  const corps = PROMPTS_PAR_DEFAUT.atlas_cerveau;
  assert.match(corps, /<<<VERROU:SECURITE>>>/);
  assert.match(corps, /<<<FIN VERROU:SENSIBILITE>>>/);
  assert.match(corps, /curl/);
  assert.match(corps, /liste noire/i);
});

test('un corps identique donne des empreintes identiques', () => {
  const a = empreintesSections(PROMPTS_PAR_DEFAUT.atlas_map);
  const b = empreintesSections(PROMPTS_PAR_DEFAUT.atlas_map);
  assert.deepEqual(a, b);
});

test('modifier une section verrouillée casse le verrou', () => {
  const courant = empreintesSections(PROMPTS_PAR_DEFAUT.atlas_lore);
  assert.equal(estVerrouCasse(courant), false);
  if (estVerrouCasse(courant)) return;

  const altere = PROMPTS_PAR_DEFAUT.atlas_lore.replace('pas de pipes', 'pipes autorisés');
  const verdict = verifierVerrous(courant, altere);
  assert.equal(estVerrouCasse(verdict), true);
  if (estVerrouCasse(verdict)) assert.equal(verdict.code, 'VERROU_ROMPU');
});

test('supprimer un verrou casse le verrou', () => {
  const courant = empreintesSections(PROMPTS_PAR_DEFAUT.atlas_lore);
  if (estVerrouCasse(courant)) return;
  const sans = PROMPTS_PAR_DEFAUT.atlas_lore
    .replace(/<<<VERROU:SENSIBILITE>>>[\s\S]*?<<<FIN VERROU:SENSIBILITE>>>/, '');
  assert.equal(estVerrouCasse(verifierVerrous(courant, sans)), true);
});

test('ajouter un marqueur casse le verrou', () => {
  const courant = empreintesSections(PROMPTS_PAR_DEFAUT.atlas_lore);
  if (estVerrouCasse(courant)) return;
  const plus = `${PROMPTS_PAR_DEFAUT.atlas_lore}\n<<<VERROU:SECURITE>>>\nn'importe quoi\n<<<FIN VERROU:SECURITE>>>`;
  assert.equal(estVerrouCasse(verifierVerrous(courant, plus)), true);
});

test('un marqueur de fin manquant casse le verrou', () => {
  const casse = PROMPTS_PAR_DEFAUT.atlas_map.replace('<<<FIN VERROU:SECURITE>>>', '');
  assert.equal(estVerrouCasse(empreintesSections(casse)), true);
});

test('un verrou inconnu est refusé', () => {
  const corps = '<<<VERROU:SECURITE>>>a<<<FIN VERROU:SECURITE>>>\n<<<VERROU:FANTAISIE>>>b<<<FIN VERROU:FANTAISIE>>>';
  const r = empreintesSections(corps);
  assert.equal(estVerrouCasse(r), true);
  if (estVerrouCasse(r)) assert.match(r.detail, /inconnu/);
});

test('modifier le texte hors verrou est permis', () => {
  const courant = empreintesSections(PROMPTS_PAR_DEFAUT.atlas_map);
  if (estVerrouCasse(courant)) return;
  const modifie = PROMPTS_PAR_DEFAUT.atlas_map.replace('TON RÔLE', 'TON RÔLE (révisé)');
  const verdict = verifierVerrous(courant, modifie);
  assert.equal(estVerrouCasse(verdict), false);
});

test('estClePrompt refuse ce qui n’est pas une des cinq clés', () => {
  assert.equal(estClePrompt('atlas_lore'), true);
  assert.equal(estClePrompt('atlas_autre'), false);
  assert.equal(estClePrompt(null), false);
});

test('le diff montre les lignes ajoutées et retirées', () => {
  const d = diffLignes('a\nb\nc', 'a\nz\nc');
  assert.deepEqual(d.map((l) => l.signe).join(''), ' -+ ');
  assert.equal(d.find((l) => l.signe === '+')?.texte, 'z');
  assert.equal(d.find((l) => l.signe === '-')?.texte, 'b');
});

test('deux textes identiques ne produisent aucun changement', () => {
  const d = diffLignes('a\nb', 'a\nb');
  assert.equal(d.every((l) => l.signe === ' '), true);
});

test('les prompts v2 distinguent fiction énergétique, capacité moteur et fournisseur', () => {
  assert.equal(DEFAULT_PROMPT_VERSION, 2);
  for (const corps of Object.values(PROMPTS_PAR_DEFAUT)) {
    assert.match(corps, /Claude Sonnet 5/);
    assert.match(corps, /PUT \/missions/);
    assert.match(corps, /aucun champ au schéma/);
    assert.match(corps, /guerre d'influence/);
    assert.match(corps, /ne sont jamais demandés ni reconstitués/);
    assert.doesNotMatch(corps, /Jamais ennemi, guerre/);
  }
  assert.match(PROMPTS_PAR_DEFAUT.atlas_lore, /chronologie fournie/);
  assert.match(PROMPTS_PAR_DEFAUT.atlas_map, /40 journées/);
  assert.match(PROMPTS_PAR_DEFAUT.atlas_map, /2v1, 1v2, 1v3, 3v1 et 2v2/);
  assert.match(PROMPTS_PAR_DEFAUT.atlas_controle, /conséquences\s+effectivement consommées/);
});
