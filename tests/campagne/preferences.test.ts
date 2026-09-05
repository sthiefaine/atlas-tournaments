// Les préférences locales du joueur : normalisation, valeurs par défaut, et le
// garde-fou qui autorise la recopie de la clé de sauvegarde. Aucun DOM ici —
// on installe un `localStorage` minimal, ce qui suffit à ces fonctions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PREFIXE_SAUVEGARDE } from '../../src/render/index';
import {
  CLE_PROGRESSION, PREFERENCES_PAR_DEFAUT, PREFIXE_PARTIE, effacerProgression, ecrirePreferences,
  lirePreferences, normaliserPreferences, stockageDisponible,
} from '../../src/app/preferences';

/** Un `localStorage` de test : une carte, et de quoi refuser d'écrire. */
function poserStockage(refuse = false): Map<string, string> {
  const donnees = new Map<string, string>();
  const faux = {
    get length(): number { return donnees.size; },
    key: (i: number): string | null => [...donnees.keys()][i] ?? null,
    getItem: (k: string): string | null => donnees.get(k) ?? null,
    setItem: (k: string, v: string): void => {
      if (refuse) throw new Error('QuotaExceededError');
      donnees.set(k, v);
    },
    removeItem: (k: string): void => { donnees.delete(k); },
    clear: (): void => { donnees.clear(); },
  };
  (globalThis as { localStorage?: unknown }).localStorage = faux;
  return donnees;
}

test('la clé des parties en cours ne peut pas diverger de celle du jeu', () => {
  // `preferences.ts` recopie ce préfixe plutôt que d'importer `render/jeu.ts`,
  // qui ferait entrer le moteur et les deux rendus dans la page des réglages.
  // La copie n'est acceptable que parce que ce test existe.
  assert.equal(PREFIXE_PARTIE, PREFIXE_SAUVEGARDE);
});

test('des préférences absentes, illisibles ou corrompues restent jouables', () => {
  poserStockage();
  assert.deepEqual(lirePreferences(), PREFERENCES_PAR_DEFAUT);
  for (const brut of [null, 42, 'oui', [], { dialogues: 'peut-être' }, { version: 9 }]) {
    const p = normaliserPreferences(brut);
    assert.equal(typeof p.dialogues, 'boolean');
    assert.equal(typeof p.animationsReduites, 'boolean');
    assert.equal(p.version, 1);
  }
  // Une valeur douteuse retombe sur la valeur par défaut, jamais sur elle-même.
  assert.equal(normaliserPreferences({ dialogues: 'oui' }).dialogues, PREFERENCES_PAR_DEFAUT.dialogues);
  assert.equal(normaliserPreferences({ animationsReduites: 'oui' }).animationsReduites, false);
  // Les dialogues sont joués par défaut : c'est ce que raconte une mission.
  assert.equal(PREFERENCES_PAR_DEFAUT.dialogues, true);
  assert.equal(PREFERENCES_PAR_DEFAUT.animationsReduites, false);
});

test('un aller-retour par le stockage rend exactement ce qu’on a écrit', () => {
  poserStockage();
  const voulu = { version: 1 as const, dialogues: false, animationsReduites: true };
  assert.equal(ecrirePreferences(voulu), true);
  assert.deepEqual(lirePreferences(), voulu);
  assert.equal(stockageDisponible(), true);
});

test('un navigateur qui refuse d’écrire ne casse rien, il le dit', () => {
  poserStockage(true);
  assert.equal(ecrirePreferences({ ...PREFERENCES_PAR_DEFAUT, dialogues: false }), false);
  assert.equal(stockageDisponible(), false);
  // Et la lecture reste possible : on joue avec les valeurs par défaut.
  assert.deepEqual(lirePreferences(), PREFERENCES_PAR_DEFAUT);
});

test('effacer la progression emporte aussi les parties en cours, et rien d’autre', () => {
  const donnees = poserStockage();
  donnees.set(CLE_PROGRESSION, JSON.stringify({ version: 1, victoires: ['premier_contact'] }));
  donnees.set(`${PREFIXE_PARTIE}premier_contact`, '{}');
  donnees.set(`${PREFIXE_PARTIE}qg_de_la_presquile`, '{}');
  donnees.set('atlas:reglages:v1', '{"version":1,"dialogues":false}');
  donnees.set('autre-application', 'à ne pas toucher');

  assert.equal(effacerProgression(), true);
  // Une partie fantôme reprendrait au milieu d'une épreuve que le joueur croit
  // n'avoir jamais commencée : les deux familles partent ensemble.
  assert.equal(donnees.has(CLE_PROGRESSION), false);
  assert.equal([...donnees.keys()].some((k) => k.startsWith(PREFIXE_PARTIE)), false);
  // Les réglages survivent : personne ne demande à réactiver les dialogues en
  // effaçant sa campagne. Et on ne touche pas à ce qui n'est pas à nous.
  assert.equal(donnees.get('atlas:reglages:v1'), '{"version":1,"dialogues":false}');
  assert.equal(donnees.get('autre-application'), 'à ne pas toucher');
});
