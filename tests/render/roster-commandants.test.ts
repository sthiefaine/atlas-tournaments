/**
 * Le vestiaire, côté règle d'affichage (`src/render/roster-commandants.ts`).
 *
 * Quatre choses à tenir, et la deuxième est la seule qu'on ne puisse pas
 * rattraper : la grille montre tout le roster états compris, **un secret fermé
 * ne laisse rien fuir**, le banc du scénario est en tête et reste le défaut, et
 * les deux gestes — clic, clavier — disent la même chose.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { indexChoix } from '../../src/app/navigation-choix';
import {
  actionClic, compteRoster, fichesRoster, gesteClavier, ouvertures,
  type FicheRoster,
} from '../../src/render/roster-commandants';
import type { Condition, RosterJouables } from '../../src/schemas/index';

const CONDITION: Condition = { type: 'flag', cle: 'monde.tournoi.essai' };

/** Un roster de papier : quatre jouables — un d'entrée, deux à gagner, un à venir — et deux secrets. */
const ROSTER: RosterJouables = {
  version: 1,
  statut: 'test',
  jouables: [
    { cle: 'cmd_a', ouvertPar: 'debut', gout: 'Le kit d’entrée.' },
    { cle: 'cmd_b', ouvertPar: 'epreuve_un', gout: 'La défense.' },
    { cle: 'cmd_c', ouvertPar: 'epreuve_deux', gout: 'La vitesse.' },
    { cle: 'cmd_d', ouvertPar: 'a_venir', gout: 'La neige.' },
  ],
  secrets: [
    { cle: 'cmd_secret_un', libelle: 'Le Recordman', indice: 'Douze titres en difficile.', condition: CONDITION },
    { cle: 'cmd_secret_deux', libelle: 'La Rasante', indice: 'Faites taire la forge.', condition: CONDITION },
  ],
};

/** Un descripteur de papier : chaque commandant a un nom, un style et deux lignes. */
const decrire = (cle: string) => ({ nom: `Nom de ${cle}`, style: `Style de ${cle}`, lignes: [`Passif ${cle}`, `Super ${cle}`] });
const direPorte = (ouvertPar: string) => `Porte ${ouvertPar}`;
const grille = (acquis: readonly string[], defaut?: string): FicheRoster[] =>
  fichesRoster({ roster: ROSTER, acquis, defaut, decrire, direPorte });

test('la grille rend tout le roster, et un verrouillé porte sa porte', () => {
  const fiches = grille([]);
  assert.equal(fiches.length, 6, 'quatre jouables et deux secrets, tous montrés');
  const parId = new Map(fiches.map((f) => [f.id, f]));

  // Ouvert d'entrée : jouable sans rien avoir gagné, avec son kit.
  assert.equal(parId.get('cmd_a')?.etat, 'jouable');
  assert.deepEqual(parId.get('cmd_a')?.lignes, ['Passif cmd_a', 'Super cmd_a']);
  assert.equal(parId.get('cmd_a')?.porte, '', 'un banc ouvert n’a pas de porte à dire');

  // Verrouillé : on montre ce qui se gagne — le nom, le style, le kit — et
  // **ce qui l'ouvre**. Une case grise muette n'annonce rien à gagner.
  const b = parId.get('cmd_b');
  assert.equal(b?.etat, 'verrouille');
  assert.equal(b?.nom, 'Nom de cmd_b');
  assert.equal(b?.porte, 'Porte epreuve_un');
  assert.equal(b?.cle, '', 'un verrouillé ne rend aucune clé jouable');
  assert.equal(parId.get('cmd_d')?.porte, 'Porte a_venir');

  assert.deepEqual(compteRoster(fiches), { acquis: 1, total: 6, secrets: 2 });
});

test('une victoire ouvre la case, et la case ouverte donne sa clé', () => {
  const fiches = grille(['cmd_b']);
  const b = fiches.find((f) => f.id === 'cmd_b');
  assert.equal(b?.etat, 'jouable');
  assert.equal(b?.cle, 'cmd_b');
  assert.equal(b?.porte, '', 'une porte franchie ne se dit plus');
  assert.equal(compteRoster(fiches).acquis, 2);
});

test('un secret fermé ne laisse fuir ni nom, ni clé, ni style — seulement son indice', () => {
  const fiches = grille([]);
  const secrets = fiches.filter((f) => f.etat === 'secret');
  assert.equal(secrets.length, 2);
  for (const s of secrets) {
    assert.equal(s.nom, '');
    assert.equal(s.cle, '');
    assert.equal(s.style, '');
    assert.equal(s.gout, '');
    assert.deepEqual(s.lignes, []);
    assert.match(s.id, /^secret_[0-9]+$/, 'l’identifiant lui-même ne nomme personne');
  }
  assert.deepEqual(secrets.map((s) => s.indice), ['Douze titres en difficile.', 'Faites taire la forge.']);

  // Et rien du secret ne traîne ailleurs : ni sa clé, ni son libellé, dans
  // aucun champ de la grille entière. C'est la seule vérification qui compte —
  // un secret dont le nom traîne dans le balisage n'est plus un secret.
  const tout = JSON.stringify(fiches);
  assert.ok(!tout.includes('cmd_secret_un'), tout);
  assert.ok(!tout.includes('Le Recordman'));
  assert.ok(!tout.includes('La Rasante'));
});

test('un secret acquis rejoint la grille comme les autres, avec son nom et son kit', () => {
  const fiches = grille(['cmd_secret_un']);
  const s = fiches.find((f) => f.cle === 'cmd_secret_un');
  assert.equal(s?.etat, 'jouable');
  assert.equal(s?.nom, 'Nom de cmd_secret_un');
  assert.equal(s?.gout, 'Le Recordman');
  assert.equal(s?.indice, '', 'l’indice ne sert plus à rien une fois la porte franchie');
  // L'autre reste fermé, et reste muet.
  assert.equal(fiches.filter((f) => f.etat === 'secret').length, 1);
});

test('le commandant du scénario est en tête, jouable, et marqué comme défaut', () => {
  const fiches = grille([], 'cmd_c');
  assert.equal(fiches[0]?.id, 'cmd_c');
  assert.equal(fiches[0]?.defaut, true);
  assert.equal(fiches[0]?.etat, 'jouable', 'on joue toujours le banc de son épreuve');
  assert.equal(fiches[0]?.cle, 'cmd_c');
  assert.equal(fiches.filter((f) => f.defaut).length, 1);
  // Le reste garde l'ordre du roster : une collection dont les cases sautent à
  // chaque déblocage ne se retient pas.
  assert.deepEqual(fiches.slice(1).map((f) => f.id), ['cmd_a', 'cmd_b', 'cmd_d', 'secret_1', 'secret_2']);
});

test('un banc de scénario absent du roster est ajouté d’office', () => {
  const fiches = grille([], 'cmd_inconnu');
  assert.equal(fiches[0]?.id, 'cmd_inconnu');
  assert.equal(fiches[0]?.etat, 'jouable');
  assert.equal(fiches.length, 7);
});

test('un secret qui est le banc du scénario s’ouvre sans condition, et ne se dédouble pas', () => {
  const fiches = grille([], 'cmd_secret_deux');
  assert.equal(fiches[0]?.cle, 'cmd_secret_deux');
  assert.equal(fiches.length, 6, 'il n’est pas ajouté une seconde fois en tête de grille');
});

test('un clic sélectionne, un second prend ; une case fermée ne répond pas', () => {
  const fiches = grille([], 'cmd_a');
  const a = fiches[0]!;
  const verrouille = fiches.find((f) => f.etat === 'verrouille')!;
  const secret = fiches.find((f) => f.etat === 'secret')!;
  assert.equal(actionClic(a, ''), 'selectionner');
  assert.equal(actionClic(a, 'cmd_a'), 'prendre');
  assert.equal(actionClic(verrouille, verrouille.id), 'rien');
  assert.equal(actionClic(secret, secret.id), 'rien');
});

test('le clavier : les flèches déplacent d’une case, Entrée prend', () => {
  assert.deepEqual(gesteClavier('ArrowRight', 0, 6), { type: 'aller', index: 1 });
  assert.deepEqual(gesteClavier('ArrowDown', 5, 6), { type: 'aller', index: 0 }, 'la grille boucle');
  assert.deepEqual(gesteClavier('ArrowLeft', 0, 6), { type: 'aller', index: 5 });
  assert.deepEqual(gesteClavier('Home', 4, 6), { type: 'aller', index: 0 });
  assert.deepEqual(gesteClavier('End', 0, 6), { type: 'aller', index: 5 });
  assert.deepEqual(gesteClavier('Enter', 2, 6), { type: 'prendre' });
  assert.deepEqual(gesteClavier(' ', 2, 6), { type: 'prendre' });
  assert.equal(gesteClavier('a', 0, 6), null, 'une touche qui n’est pas pour nous laisse passer');
  assert.equal(gesteClavier('ArrowRight', 0, 0), null, 'une grille vide ne va nulle part');
});

test('le clavier de la grille dit exactement ce que dit celui de l’itinéraire', () => {
  // `render` ne peut pas importer `app` : l'arithmétique est écrite deux fois,
  // et c'est ce test qui rend la copie acceptable (même règle que le préfixe de
  // sauvegarde recopié dans `preferences.ts`).
  for (const touche of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End', 'PageUp']) {
    for (const index of [0, 1, 5]) {
      const geste = gesteClavier(touche, index, 6);
      const attendu = indexChoix(touche, index, 6);
      assert.equal(geste?.type === 'aller' ? geste.index : null, attendu, `${touche} depuis ${index}`);
    }
  }
});

test('l’annonce ne montre que les clés qu’on lui donne, jamais une différence recalculée', () => {
  const fiches = grille(['cmd_b', 'cmd_c'], 'cmd_a');
  assert.deepEqual(ouvertures(fiches, ['cmd_c']).map((f) => f.cle), ['cmd_c']);
  assert.deepEqual(ouvertures(fiches, ['cmd_b', 'cmd_c']).map((f) => f.cle), ['cmd_b', 'cmd_c']);
  assert.deepEqual(ouvertures(fiches, []), [], 'rien d’ouvert, rien à annoncer');
  // Une clé encore fermée qu'on annoncerait par erreur ne produit pas de case :
  // l'écran ne peut pas montrer un banc que la grille dit verrouillé.
  assert.deepEqual(ouvertures(grille([]), ['cmd_b']), []);
});
