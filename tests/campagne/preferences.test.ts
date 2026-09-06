// Les préférences locales du joueur : normalisation, valeurs par défaut, les
// deux profils d'un appareil, et le garde-fou qui autorise la recopie de la clé
// de sauvegarde. Aucun DOM ici — on installe un `localStorage` minimal, ce qui
// suffit à ces fonctions.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PREFIXE_SAUVEGARDE, cleSauvegarde } from '../../src/render/index';
import {
  CLE_PROGRESSION, NOM_PROFIL_MAX, PREFERENCES_PAR_DEFAUT, PREFIXE_PARTIE, PROFILS, changerProfilActif,
  cleProgression, cleSauvegardeDe, compterProgression, effacerProgression, ecrirePreferences,
  lirePreferences, lireProfils, normaliserNomProfil, normaliserPreferences, normaliserProfils,
  prefixePartie, profilActif, renommerProfil, stockageDisponible,
} from '../../src/app/preferences';
import { enregistrerVictoire, lireProgression } from '../../src/app/campagne/progression';

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
    removeItem: (k: string): void => {
      if (refuse) throw new Error('SecurityError');
      donnees.delete(k);
    },
    clear: (): void => { donnees.clear(); },
  };
  (globalThis as { localStorage?: unknown }).localStorage = faux;
  return donnees;
}

test('la clé des parties en cours ne peut pas diverger de celle du jeu', () => {
  // `preferences.ts` recopie ce préfixe plutôt que d'importer `render/jeu.ts`,
  // qui ferait entrer le moteur et le rendu dans la page des réglages.
  // La copie n'est acceptable que parce que ce test existe.
  assert.equal(PREFIXE_PARTIE, PREFIXE_SAUVEGARDE);
  // Et le profil A compose exactement la clé que le rendu composerait seul :
  // c'est ce qui rend la progression d'avant les profils lisible sans migration.
  assert.equal(prefixePartie('a'), PREFIXE_SAUVEGARDE);
  assert.equal(cleSauvegardeDe('a', 'premier_contact'), cleSauvegarde('premier_contact'));
  assert.equal(cleProgression('a'), CLE_PROGRESSION);
});

test('le schéma des clés : A sans segment, B sous `p2:`, et aucun préfixe ne couvre l’autre', () => {
  assert.deepEqual([...PROFILS], ['a', 'b']);
  assert.equal(cleProgression('b'), 'atlas:p2:qualification:v1');
  assert.equal(prefixePartie('b'), 'atlas:p2:partie:');
  assert.equal(cleSauvegardeDe('b', 'premier_contact'), 'atlas:p2:partie:premier_contact');
  // Un effacement par `startsWith` ne doit jamais pouvoir mordre sur l'autre profil.
  assert.equal(prefixePartie('b').startsWith(prefixePartie('a')), false);
  assert.equal(prefixePartie('a').startsWith(prefixePartie('b')), false);
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
  // Sans stockage, l'appareil n'a qu'un joueur : le profil A, sans nom.
  assert.equal(profilActif(), 'a');
  assert.equal(changerProfilActif('b'), false);
  assert.equal(profilActif(), 'a');
  assert.equal(effacerProgression(), false);
  assert.deepEqual(compterProgression(), { victoires: 0, parties: 0 });
});

test('la progression d’avant les profils devient le profil A, sans migration', () => {
  const donnees = poserStockage();
  // Un appareil d'avant : la clé historique, aucune clé de profil.
  donnees.set('atlas:qualification:v1', JSON.stringify({ version: 1, victoires: ['premier_contact', 'la_riviere'] }));
  donnees.set('atlas:partie:la_riviere', '{}');
  assert.equal(profilActif(), 'a');
  assert.deepEqual(lireProgression().victoires, ['premier_contact', 'la_riviere']);
  assert.deepEqual(compterProgression('a'), { victoires: 2, parties: 1 });
  assert.equal(donnees.has('atlas:profil:v1'), false, 'lire ne doit rien écrire');
});

test('la bascule de profil change la progression lue et écrite', () => {
  const donnees = poserStockage();
  assert.equal(enregistrerVictoire('premier_contact'), true);
  assert.equal(changerProfilActif('b'), true);
  assert.equal(profilActif(), 'b');
  // Le profil B part de zéro, même si A a déjà gagné — et sans clé en stock,
  // la mémoire de session ne doit pas lui prêter les victoires de A.
  assert.deepEqual(lireProgression().victoires, []);
  assert.equal(enregistrerVictoire('premier_contact'), true);
  assert.equal(enregistrerVictoire('la_riviere'), true);
  assert.deepEqual(JSON.parse(donnees.get('atlas:p2:qualification:v1')!).victoires, ['premier_contact', 'la_riviere']);
  assert.deepEqual(JSON.parse(donnees.get('atlas:qualification:v1')!).victoires, ['premier_contact']);
  assert.equal(changerProfilActif('a'), true);
  assert.deepEqual(lireProgression().victoires, ['premier_contact']);
});

test('un nom de profil fait de 1 à 16 caractères, gardé tel que le joueur l’a voulu', () => {
  poserStockage();
  assert.equal(NOM_PROFIL_MAX, 16);
  assert.equal(normaliserNomProfil('  Simon  '), 'Simon');
  assert.equal(normaliserNomProfil('Jean   Paul'), 'Jean Paul');
  assert.equal(normaliserNomProfil('   '), '');
  assert.equal(normaliserNomProfil(42), '');
  // Seize caractères, pas seize unités UTF-16 : un nom en émojis ne se coupe
  // pas au milieu d'un caractère.
  assert.equal(normaliserNomProfil('abcdefghijklmnopqrstuvwxyz'), 'abcdefghijklmnop');
  assert.equal(Array.from(normaliserNomProfil('🙂'.repeat(20))).length, 16);
  assert.equal(renommerProfil('b', ' Léa '), true);
  assert.deepEqual(lireProfils(), { version: 1, actif: 'a', noms: { a: '', b: 'Léa' } });
  // Renommer ne bascule pas ; basculer ne renomme pas.
  assert.equal(changerProfilActif('b'), true);
  assert.deepEqual(lireProfils(), { version: 1, actif: 'b', noms: { a: '', b: 'Léa' } });
  // Un état corrompu retombe sur A sans nom, jamais sur une erreur.
  for (const brut of [null, 'b', { actif: 'c' }, { actif: 'b', noms: 'Simon' }, { noms: { a: 7 } }]) {
    const p = normaliserProfils(brut);
    assert.ok(p.actif === 'a' || p.actif === 'b');
    assert.equal(typeof p.noms.a, 'string');
    assert.equal(typeof p.noms.b, 'string');
  }
  assert.equal(normaliserProfils({ actif: 'c' }).actif, 'a');
});

test('effacer la progression emporte aussi les parties en cours, et rien d’autre', () => {
  const donnees = poserStockage();
  donnees.set(CLE_PROGRESSION, JSON.stringify({ version: 1, victoires: ['premier_contact'] }));
  donnees.set(`${PREFIXE_PARTIE}premier_contact`, '{}');
  donnees.set(`${PREFIXE_PARTIE}qg_de_la_presquile`, '{}');
  donnees.set('atlas:reglages:v1', '{"version":1,"dialogues":false}');
  donnees.set('autre-application', 'à ne pas toucher');

  assert.deepEqual(compterProgression(), { victoires: 1, parties: 2 });
  assert.equal(effacerProgression(), true);
  // Une partie fantôme reprendrait au milieu d'une épreuve que le joueur croit
  // n'avoir jamais commencée : les deux familles partent ensemble.
  assert.equal(donnees.has(CLE_PROGRESSION), false);
  assert.equal([...donnees.keys()].some((k) => k.startsWith(PREFIXE_PARTIE)), false);
  // Les réglages survivent : personne ne demande à réactiver les dialogues en
  // effaçant sa campagne. Et on ne touche pas à ce qui n'est pas à nous.
  assert.equal(donnees.get('atlas:reglages:v1'), '{"version":1,"dialogues":false}');
  assert.equal(donnees.get('autre-application'), 'à ne pas toucher');
  assert.deepEqual(compterProgression(), { victoires: 0, parties: 0 });
});

test('effacer n’emporte que le profil actif, et laisse les noms', () => {
  const donnees = poserStockage();
  donnees.set('atlas:qualification:v1', JSON.stringify({ version: 1, victoires: ['premier_contact'] }));
  donnees.set('atlas:partie:premier_contact', '{}');
  donnees.set('atlas:p2:qualification:v1', JSON.stringify({ version: 1, victoires: ['premier_contact', 'la_riviere'] }));
  donnees.set('atlas:p2:partie:la_riviere', '{}');
  donnees.set('atlas:p2:partie:le_relief', '{}');
  assert.equal(renommerProfil('b', 'Léa'), true);
  assert.equal(changerProfilActif('b'), true);

  assert.deepEqual(compterProgression(), { victoires: 2, parties: 2 });
  assert.equal(effacerProgression(), true);
  assert.equal(donnees.has('atlas:p2:qualification:v1'), false);
  assert.equal([...donnees.keys()].some((k) => k.startsWith('atlas:p2:partie:')), false);
  // Le profil A n'a pas bougé d'un octet, et B garde son nom : effacer une
  // campagne n'est pas oublier qui joue.
  assert.equal(donnees.has('atlas:qualification:v1'), true);
  assert.equal(donnees.has('atlas:partie:premier_contact'), true);
  assert.deepEqual(lireProfils(), { version: 1, actif: 'b', noms: { a: '', b: 'Léa' } });
  assert.deepEqual(lireProgression().victoires, []);
  assert.equal(changerProfilActif('a'), true);
  assert.deepEqual(lireProgression().victoires, ['premier_contact']);
});
