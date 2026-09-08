// L'ordre en deux temps vu du joueur (`04-gameplay.md` §2) : sous brouillard, un
// chemin qui sort de la vue joue `puis` — on bouge, puis on décide — et le menu
// s'ouvre sur ce qu'il y a **vraiment** à l'arrivée ; une embuscade coupe tout.
// Sur un vrai état de partie, comme `controleur.test.ts` : c'est le moteur qui
// dit ce qu'une déplacée a le droit de faire, jamais le contrôleur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chargerCatalogue, creerPartie, empreinte, uniteParId,
  type Action, type EtatPartie, type EvenementJeu, type Unite,
} from '../../src/engine/index';
import { Controleur } from '../../src/render/controleur';
import type { Case, CleUnite } from '../../src/schemas/index';
import { scenePersonnalisee } from '../engine/aides';

const CAT = chargerCatalogue();
//               012345
const GRILLE = [
  'PPPCPP',
  'PPPPPP',
  'PPPPPP',
];
const c = (x: number, y: number): Case => ({ x, y });

/** Une partie sur la grille, brouillard ou non, et le contrôleur qui journalise ses ordres. */
function monter(
  unites: { camp: 0 | 1; type: CleUnite; x: number; y: number }[], brouillard: boolean,
): { etat: EtatPartie; ctrl: Controleur; actions: Action[]; evenements: EvenementJeu[] } {
  const etat = creerPartie(scenePersonnalisee(GRILLE, {}, unites, { brouillard }), CAT, 'deux-temps');
  const actions: Action[] = [];
  const evenements: EvenementJeu[] = [];
  const ctrl = new Controleur({
    etat, catalogue: CAT, camp: 0,
    ecouteur: { surAction: (a, evts) => { actions.push(a); evenements.push(...evts); } },
  });
  return { etat, ctrl, actions, evenements };
}

/** L'unité du joueur de ce type, dans l'état courant du contrôleur. */
function mienne(ctrl: Controleur, type: CleUnite): Unite {
  const u = ctrl.etat.unites.find((x) => x.camp === 0 && x.type === type);
  assert.ok(u, `pas de ${type} au camp 0`);
  return u;
}

/** Le fantassin du joueur en (0,0), qui voit à deux cases ; l'adversaire loin, en (5,2). */
const DEPART: { camp: 0 | 1; type: CleUnite; x: number; y: number }[] = [
  { camp: 0, type: 'infanterie', x: 0, y: 0 },
  { camp: 1, type: 'infanterie', x: 5, y: 2 },
];

test('sous brouillard, un chemin qui sort de la vue joue d’abord, puis ouvre le menu sur l’état réel', () => {
  const { ctrl, actions } = monter(DEPART, true);
  const inf = mienne(ctrl, 'infanterie');
  ctrl.clicCase(c(0, 0));
  assert.equal(ctrl.phase, 'selection');

  // Le survol dit si le chemin traverse du noir : la ville (3,0) est à trois
  // cases d'un fantassin qui voit à deux ; (1,0) se voit.
  ctrl.poserCurseur(c(3, 0));
  assert.equal(ctrl.vue.cheminAveugle, true, 'un chemin vers (3,0) sort de la vue');
  ctrl.poserCurseur(c(1, 0));
  assert.equal(ctrl.vue.cheminAveugle, false, 'un chemin vers (1,0) reste en vue');

  // Choisir l'arrivée hors de vue ne demande rien : l'ordre part, avec `puis`.
  ctrl.clicCase(c(3, 0));
  assert.equal(actions.length, 1, 'un seul ordre est parti');
  const ordre = actions[0]!;
  assert.equal(ordre.type, 'ordre');
  if (ordre.type !== 'ordre') return;
  assert.deepEqual(ordre.suite, { type: 'puis' });
  assert.deepEqual(ordre.chemin, [c(0, 0), c(1, 0), c(2, 0), c(3, 0)]);

  // Sans embuscade, l'unité est déplacée, et son menu est déjà ouvert sur sa case.
  const arrivee = uniteParId(ctrl.etat, inf.id);
  assert.ok(arrivee);
  assert.deepEqual({ x: arrivee.x, y: arrivee.y }, c(3, 0));
  assert.equal(arrivee.etat, 'deplacee');
  assert.equal(ctrl.phase, 'action', 'le menu de suites s’ouvre aussitôt');
  const v = ctrl.vue;
  assert.equal(v.selection, inf.id);
  assert.deepEqual(v.chemin, [c(3, 0)], 'plus de chemin : l’unité est où elle est');
  assert.equal(v.cheminAveugle, false);
  assert.ok(v.menu);
  assert.deepEqual(v.menu.ancre, c(3, 0));
  const ids = v.menu.options.map((o) => o.id);
  assert.ok(ids.includes('capturer'), 'la ville est vraiment là, et libre : « capturer » est offert');
  assert.equal(ids[ids.length - 1], 'attendre');
  assert.equal(v.surbrillances.some((s) => s.genre === 'deplacement'), false, 'une déplacée n’ira nulle part');

  // La suite part sans chemin, et le moteur l'accepte : la capture commence.
  ctrl.choisirSuite('capturer');
  assert.equal(actions.length, 2);
  const suite = actions[1]!;
  assert.ok(suite.type === 'ordre' && suite.suite.type === 'capturer');
  if (suite.type !== 'ordre') return;
  assert.deepEqual(suite.chemin, [c(3, 0)]);
  const capteur = uniteParId(ctrl.etat, inf.id);
  assert.equal(capteur?.etat, 'agi');
  assert.ok((capteur?.pointsCapture ?? 0) > 0, 'la capture a commencé');
  assert.equal(ctrl.phase, 'inactif');
});

test('avec une embuscade, aucun menu : l’unité s’arrête sur la dernière case libre et son tour est fini', () => {
  // Un char léger (mouvement 6, vue 3) file vers (5,0) ; un fantassin adverse
  // se tient **sur** son chemin en (4,0), à quatre cases, donc hors de sa vue.
  // Depuis le 8 septembre 2026, une unité seulement voisine du trajet
  // n'interrompt plus rien : on s'arrête quand on se cogne dedans, et c'est
  // exactement ce qui se passe ici — la marche bute et le tour s'achève.
  const { ctrl, actions, evenements } = monter([
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 4, y: 0 },
  ], true);
  const inf = mienne(ctrl, 'char_leger');
  ctrl.clicCase(c(0, 0));
  ctrl.clicCase(c(5, 0));
  assert.equal(actions.length, 1);
  assert.ok(actions[0]!.type === 'ordre' && actions[0]!.suite.type === 'puis');
  const dep = evenements.find((e) => e.type === 'deplacement');
  assert.ok(dep && dep.type === 'deplacement' && dep.interrompu, 'le moteur a signalé l’interruption');

  const surprise = uniteParId(ctrl.etat, inf.id);
  assert.ok(surprise);
  assert.deepEqual({ x: surprise.x, y: surprise.y }, c(3, 0), 'arrêté sur la dernière case libre, devant le fantassin');
  assert.equal(surprise.etat, 'agi', 'surprise : on ne joue plus');
  assert.equal(ctrl.phase, 'inactif');
  assert.equal(ctrl.vue.selection, null);
  assert.equal(ctrl.vue.menu, null);
  // Il ne se resélectionne pas : son tour est fini.
  ctrl.clicCase(c(3, 0));
  assert.equal(ctrl.phase, 'inactif');
  assert.equal(actions.length, 1, 'rien d’autre n’est parti');
});

test('un chemin entièrement visible garde le menu avant, sans rien jouer — et sans brouillard, toujours', () => {
  const { etat, ctrl, actions } = monter(DEPART, true);
  const avant = empreinte(etat);
  const inf = mienne(ctrl, 'infanterie');
  ctrl.clicCase(c(0, 0));
  ctrl.clicCase(c(1, 0));
  assert.equal(ctrl.phase, 'action', 'le menu s’ouvre avant de bouger');
  assert.equal(actions.length, 0, 'rien n’est parti');
  assert.equal(empreinte(ctrl.etat), avant);
  assert.equal(uniteParId(ctrl.etat, inf.id)?.etat, 'prete');
  assert.deepEqual(ctrl.vue.chemin, [c(0, 0), c(1, 0)]);
  assert.ok(ctrl.vue.menu?.options.some((o) => o.id === 'attendre'));
  // Annuler revient au choix de destination, comme toujours.
  ctrl.annuler();
  assert.equal(ctrl.phase, 'selection');

  // Sans brouillard, le même trajet vers la ville reste un ordre en un temps.
  const clair = monter(DEPART, false);
  clair.ctrl.clicCase(c(0, 0));
  clair.ctrl.poserCurseur(c(3, 0));
  assert.equal(clair.ctrl.vue.cheminAveugle, false, 'sans brouillard, rien n’est hors de vue');
  clair.ctrl.clicCase(c(3, 0));
  assert.equal(clair.ctrl.phase, 'action');
  assert.equal(clair.actions.length, 0);
  assert.ok(clair.ctrl.vue.menu?.options.some((o) => o.id === 'capturer'));
});

test('une déplacée resélectionnée rouvre son menu ; Échap le ferme sans rien jouer ; un clic ailleurs aussi', () => {
  const { ctrl, actions } = monter(DEPART, true);
  const inf = mienne(ctrl, 'infanterie');
  ctrl.clicCase(c(0, 0));
  ctrl.clicCase(c(3, 0));
  assert.equal(ctrl.phase, 'action');
  const apresMarche = empreinte(ctrl.etat);

  // Échap : le menu se ferme, l'unité reste déplacée, rien n'est parti.
  ctrl.annuler();
  assert.equal(ctrl.phase, 'inactif');
  assert.equal(ctrl.vue.selection, null);
  assert.equal(uniteParId(ctrl.etat, inf.id)?.etat, 'deplacee');
  assert.equal(empreinte(ctrl.etat), apresMarche);

  // La resélectionner rouvre le menu directement, sans phase de chemin.
  ctrl.clicCase(c(3, 0));
  assert.equal(ctrl.phase, 'action', 'pas de phase `selection` : elle ne bougera plus');
  assert.equal(ctrl.vue.selection, inf.id);
  assert.deepEqual(ctrl.vue.chemin, [c(3, 0)]);
  assert.ok(ctrl.vue.menu?.options.some((o) => o.id === 'capturer'));
  assert.equal(ctrl.vue.surbrillances.length, 0);

  // Un clic ailleurs ferme le menu et fait son travail habituel — ici, rien.
  ctrl.clicCase(c(0, 2));
  assert.equal(ctrl.phase, 'inactif');
  assert.equal(ctrl.vue.selection, null);
  assert.equal(uniteParId(ctrl.etat, inf.id)?.etat, 'deplacee');
  assert.equal(actions.length, 1, 'toujours le seul `puis`');

  // Le clavier : le curseur sur elle, valider rouvre, valider encore choisit la première suite.
  ctrl.clicCase(c(3, 0));
  assert.equal(ctrl.phase, 'action');
  ctrl.choisirSuite('attendre');
  assert.equal(actions.length, 2);
  const attente = actions[1]!;
  assert.ok(attente.type === 'ordre' && attente.suite.type === 'rien');
  if (attente.type !== 'ordre') return;
  assert.deepEqual(attente.chemin, [c(3, 0)], 'la suite se donne sur place');
  assert.equal(uniteParId(ctrl.etat, inf.id)?.etat, 'agi');
  assert.equal(ctrl.phase, 'inactif');
});

test('les suites d’une déplacée obéissent aux règles « après mouvement » : l’artillerie ne tire plus, le char si', () => {
  // Sans brouillard, pour que la cible se voie : c'est l'état `deplacee` posé à
  // la main qui dit au moteur — et donc au contrôleur — que l'unité a bougé.
  const { etat, ctrl } = monter([
    { camp: 0, type: 'artillerie', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 2, y: 0 },
  ], false);
  // Prête, sur place : la cible à deux cases est dans sa portée, « attaquer » est là.
  ctrl.clicCase(c(0, 0));
  ctrl.clicCase(c(0, 0));
  assert.equal(ctrl.phase, 'action');
  assert.ok(ctrl.vue.menu?.options.some((o) => o.id === 'attaquer'), 'une artillerie immobile tire');

  // Déplacée : la même cible, la même case, et « attaquer » a disparu (`a_bouge`).
  const art = etat.unites.find((u) => u.camp === 0 && u.type === 'artillerie');
  assert.ok(art);
  art.etat = 'deplacee';
  const deplacee = new Controleur({ etat, catalogue: CAT, camp: 0 });
  deplacee.clicCase(c(0, 0));
  assert.equal(deplacee.phase, 'action', 'une déplacée rouvre directement son menu');
  assert.deepEqual(deplacee.vue.menu?.options.map((o) => o.id), ['attendre']);
  assert.equal(deplacee.vue.surbrillances.length, 0);
  assert.equal(deplacee.vue.cheminAveugle, false);

  // Un char déplacé tire encore : la visée s'ouvre ; Échap y revient au menu, pas au chemin.
  const chars = monter([
    { camp: 0, type: 'char_leger', x: 0, y: 0 },
    { camp: 1, type: 'infanterie', x: 1, y: 0 },
  ], false);
  const char = chars.etat.unites.find((u) => u.camp === 0 && u.type === 'char_leger');
  assert.ok(char);
  char.etat = 'deplacee';
  const ctrlChar = new Controleur({
    etat: chars.etat, catalogue: CAT, camp: 0, ecouteur: { surAction: (a) => chars.actions.push(a) },
  });
  ctrlChar.clicCase(c(0, 0));
  assert.ok(ctrlChar.vue.menu?.options.some((o) => o.id === 'attaquer'));
  ctrlChar.choisirSuite('attaquer');
  assert.equal(ctrlChar.phase, 'cible');
  assert.deepEqual(ctrlChar.vue.visee?.depuis, c(0, 0));
  ctrlChar.annuler();
  assert.equal(ctrlChar.phase, 'action', 'depuis la visée, Échap revient au menu');
  ctrlChar.annuler();
  assert.equal(ctrlChar.phase, 'inactif', 'depuis le menu, Échap le ferme');
  ctrlChar.clicCase(c(0, 0));
  ctrlChar.choisirSuite('attaquer');
  ctrlChar.clicCase(c(1, 0));
  assert.equal(chars.actions.length, 1, 'le tir est parti, sur place');
  const tir = chars.actions[0]!;
  assert.ok(tir.type === 'ordre' && tir.suite.type === 'attaquer');
  if (tir.type !== 'ordre') return;
  assert.deepEqual(tir.chemin, [c(0, 0)]);
  assert.equal(uniteParId(ctrlChar.etat, char.id)?.etat, 'agi');
});

test('la fin de tour perd la suite d’une déplacée : elle passe `agi`, et le contrôleur ne la retient pas', () => {
  const { ctrl } = monter(DEPART, true);
  const inf = mienne(ctrl, 'infanterie');
  ctrl.clicCase(c(0, 0));
  ctrl.clicCase(c(3, 0));
  assert.equal(uniteParId(ctrl.etat, inf.id)?.etat, 'deplacee');
  ctrl.finTour();
  assert.equal(ctrl.etat.campCourant, 1);
  assert.equal(uniteParId(ctrl.etat, inf.id)?.etat, 'agi');
  assert.equal(ctrl.phase, 'inactif');
  assert.equal(ctrl.vue.selection, null);
});
