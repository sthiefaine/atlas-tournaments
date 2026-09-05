// Les matchs d'incarnation (`BRIEF.md`, « Le joueur et le départ ») : le camp du
// joueur prend le général de la nation incarnée, et le catalogue joué est celui que
// l'appelant fournit — le moteur ne charge rien de lui-même.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMP_JOUEUR, commandantsIncarnes, creerPartie, sceneDepuis,
  type CommandantMoteur,
} from '../../src/engine/index';
import { validerScenario, type Cle, type Scenario } from '../../src/schemas/index';
import { scenarioBretagne, scenarioIncarnationCh } from '../schemas/exemples';
import { carte, CAT } from './aides';

/** Un général de moteur minimal : ce qui suffit pour lire une jauge et une clé. */
function general(cle: Cle, barres: number): CommandantMoteur {
  return {
    cle,
    nom: `commandant.${cle}.nom`,
    passif: null,
    pouvoir: {
      nom: `commandant.${cle}.pouvoir`,
      barres: 3,
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.2 } }],
      duree: 'tour_complet',
    },
    superPouvoir: {
      nom: `commandant.${cle}.super`,
      barres,
      effets: [{ cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.4 } }],
      duree: 'tour_complet',
    },
  };
}

/** Le scénario canon, passé par son validateur : le typage vient du schéma. */
function valide(brut: unknown): Scenario {
  const r = validerScenario(brut);
  if (!r.ok) throw new Error(`scénario invalide : ${JSON.stringify(r.erreurs, null, 2)}`);
  return r.valeur;
}

const INCARNATION = valide(scenarioIncarnationCh);
const ORDINAIRE = valide(scenarioBretagne);

const ELSBETH = general('cmd_elsbeth_vonlanthen', 6);
const MAELLE = general('cmd_maelle_kerdraon', 5);
const CAMILLE = general('cmd_camille_aubertin', 6);

test('le camp du joueur prend le général de la nation incarnée', () => {
  const scene = sceneDepuis(INCARNATION, carte('plaine'), [ELSBETH, MAELLE]);
  const etat = creerPartie(scene, CAT, 'incarnation');
  assert.equal(etat.camps[CAMP_JOUEUR]?.commandantCle, INCARNATION.incarnation?.commandantCle);
  // Sa jauge est la sienne, entière : on joue ses pouvoirs, pas ceux du joueur.
  assert.equal(etat.camps[CAMP_JOUEUR]?.jaugeMax, 600);
});

test('le général incarné remonte au camp du joueur même s’il est fourni ailleurs', () => {
  // Garde-fou : `validerScenario` exige déjà le général incarné au camp 0, mais un
  // appelant qui compose sa liste autrement ne doit pas jouer un autre commandant.
  const remis = commandantsIncarnes(INCARNATION, [CAMILLE, ELSBETH]);
  assert.equal(remis[CAMP_JOUEUR]?.cle, 'cmd_elsbeth_vonlanthen');
  const etat = creerPartie(sceneDepuis(INCARNATION, carte('plaine'), [CAMILLE, ELSBETH]), CAT, 'g');
  assert.equal(etat.camps[CAMP_JOUEUR]?.commandantCle, 'cmd_elsbeth_vonlanthen');
});

test('un général introuvable laisse la liste telle quelle, sans lever', () => {
  const inchangee = commandantsIncarnes(INCARNATION, [CAMILLE, MAELLE]);
  assert.equal(inchangee[CAMP_JOUEUR]?.cle, 'cmd_camille_aubertin');
});

test('un scénario sans incarnation garde le commandant du joueur', () => {
  const scene = sceneDepuis(ORDINAIRE, carte('plaine'), [CAMILLE, MAELLE]);
  const etat = creerPartie(scene, CAT, 'ordinaire');
  assert.equal(etat.camps[CAMP_JOUEUR]?.commandantCle, 'cmd_camille_aubertin');
});

test('le catalogue joué est celui que l’appelant fournit', () => {
  // Pour un match d'incarnation, c'est le serveur ou la page qui passe le catalogue
  // de la nation incarnée — unité spéciale comprise. Le moteur ne charge rien.
  const catalogueNation = { ...CAT, version: 9 };
  const etat = creerPartie(sceneDepuis(INCARNATION, carte('plaine'), [ELSBETH, MAELLE]), catalogueNation, 'cat');
  assert.equal(etat.catalogueVersion, 9);
});
