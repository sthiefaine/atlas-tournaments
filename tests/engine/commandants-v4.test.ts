/**
 * La révision 4 des capacités (10 septembre 2026, `doc/refonte/pouvoirs-v4.md`) :
 * 34 kits façon Advance Wars, une faiblesse chiffrée et permanente par
 * commandant, deux répliques. Ce que ce fichier tient : le catalogue est
 * transcrit tel quel et passe le validateur ; la révision 3 est gelée à
 * l'octet ; les 68 pouvoirs se paient et s'appliquent ; la faiblesse est posée
 * par le moteur et **coûte** réellement ; les scénarios jouables la déclarent,
 * les quatre premiers tutoriels non ; le banc prêté lit la révision 4.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import catalogueV4 from '../../content/commandants-capacites.json';
import catalogueV3 from '../../content/commandants-capacites-v3.json';
import pouvoirsV4 from '../../doc/refonte/pouvoirs-v4.json';
import scenarioAllie from '../../content/scenarios/couleurs_alliees.json';
import { VERSION_CAPACITES_COMMANDANTS, listerProfilsCommandants, lireProfilCommandant } from '../../src/content/profils-commandants';
import { chargerCommandantJeu, resoudreCommandantsScenario, revisionCommandants } from '../../src/content/commandants-jeu';
import {
  VERSION_MOTEUR, appliquer, chargerCatalogue, creerPartie, demandeUneCase, estModificateurDurable, estPoseTerrain,
  sceneDepuis, type CommandantMoteur, type EtatPartie,
} from '../../src/engine/index';
import {
  AXES_FAIBLESSE, BORNES_MODIFICATEUR, validerCommander, validerMapDef, validerScenario,
  type Case, type EffetPouvoir, type Scenario,
} from '../../src/schemas/index';
import { commandantsDeSimulation, scenarioMinimal } from '../../src/serveur/simulation';
import { appliquerConsequences } from '../../src/app/campagne/consequences';
import { cleSourceBanc } from '../../src/app/campagne/bancs';
import { commandantCamille } from '../schemas/exemples';
import { scenePersonnalisee } from './aides';

const cat = chargerCatalogue(8);
const TUTORIELS_SANS_JAUGE = ['premier_contact', 'villes_du_bocage', 'chantier_des_usines', 'qg_de_la_presquile'];

function scenario(code: string): Scenario {
  const r = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  assert.ok(r.ok, `${code} : ${JSON.stringify(r)}`);
  return r.valeur;
}

test('le catalogue est en révision 4, la 3 est gelée à l’octet, et les 34 kits sont ceux de la conception', () => {
  assert.equal(VERSION_CAPACITES_COMMANDANTS, 4);
  assert.equal(catalogueV4.version, 4);
  assert.equal(catalogueV3.version, 3);
  assert.equal(VERSION_MOTEUR, 8, 'l’IEM sur les usines et les superusines changent le rejeu : les sauvegardes du 7 sont périmées');
  const profils = listerProfilsCommandants(4);
  assert.equal(profils.length, 34);
  assert.equal(new Set(profils.map((p) => p.cle)).size, 34);
  assert.equal(profils.filter((p) => p.paysCode).length, 24);
  assert.deepEqual(listerProfilsCommandants(3).map((p) => p.cle).sort(), profils.map((p) => p.cle).sort());
  // Transcription : passif, pouvoir, super, faiblesse et répliques sont ceux du
  // document de conception ; seules les annotations `archetype` et `familles`
  // sont tombées (`pouvoirs-v4.md` §6.12).
  for (const source of pouvoirsV4.commandants) {
    const profil = lireProfilCommandant(source.cle, 4);
    assert.ok(profil, source.cle);
    assert.deepEqual(profil.passif, source.passif, `${source.cle} passif`);
    assert.deepEqual(profil.pouvoir, source.pouvoir, `${source.cle} pouvoir`);
    assert.deepEqual(profil.superPouvoir, source.superPouvoir, `${source.cle} super`);
    assert.deepEqual(profil.faiblesse, source.faiblesse, `${source.cle} faiblesse`);
    assert.deepEqual(profil.replique, source.replique, `${source.cle} réplique`);
    assert.ok(!('archetype' in profil) && !('familles' in profil));
  }
});

test('chaque kit passe le validateur des effets, et sa faiblesse est réellement défavorable', () => {
  for (const profil of listerProfilsCommandants(4)) {
    assert.ok(profil.faiblesse && profil.replique, `${profil.cle} sans faiblesse ou sans réplique`);
    assert.ok(AXES_FAIBLESSE.includes(profil.faiblesse.axe));
    const { quoi, valeur } = profil.faiblesse.effet.modificateur;
    assert.ok(BORNES_MODIFICATEUR[quoi].forme === 'mult' ? valeur < 1 : valeur < 0, `${profil.cle} : faiblesse sans coût`);
    // Le validateur du schéma `Commander` est le seul juge des bornes et des
    // cibles ; on lui présente le kit dans une enveloppe d'exemple.
    const o: Record<string, unknown> = {
      // Un commandant de la faction se présente sous `atl` : c'est ce qui lui
      // ouvre les trois familles réservées (`validerCommander`, 10 septembre 2026).
      ...commandantCamille, code: 'cmd_x_y', cle: 'cmd_x_y', paysCode: profil.paysCode ?? profil.faction ?? 'fr', nom: profil.nom,
      pouvoir: { ...profil.pouvoir, replique: profil.replique.pouvoir },
      superPouvoir: { ...profil.superPouvoir, replique: profil.replique.super },
      faiblesse: profil.faiblesse,
    };
    if (profil.passif) o['passif'] = profil.passif; else delete o['passif'];
    const r = validerCommander(o);
    assert.ok(r.ok, `${profil.cle} : ${r.ok ? '' : JSON.stringify(r.erreurs)}`);
    for (const effet of [profil.passif, profil.faiblesse.effet, ...profil.pouvoir.effets, ...profil.superPouvoir.effets]) {
      if (!effet || !('filtre' in effet)) continue;
      for (const cle of effet.filtre?.types ?? []) assert.ok(cat.unites[cle], `${profil.cle}: ${cle}`);
      for (const t of effet.filtre?.surTerrain ?? []) assert.ok(cat.terrains[t], `${profil.cle}: ${t}`);
    }
  }
});

test('chargerCommandantJeu(cle, 4) rend passif, pouvoir, super et faiblesse sous les clés _v4 ; la 3 n’a pas de faiblesse', () => {
  const ariane = chargerCommandantJeu('cmd_ariane_belloc', 4);
  assert.equal(ariane.pouvoir.nom, 'commandant.cmd_ariane_belloc.pouvoir_v4');
  assert.equal(ariane.superPouvoir.nom, 'commandant.cmd_ariane_belloc.super_v4');
  assert.deepEqual(ariane.passif, { cible: 'mes_unites', modificateur: { quoi: 'attaque', valeur: 1.05 } });
  assert.deepEqual(ariane.faiblesse, { cible: 'economie', modificateur: { quoi: 'fonds', valeur: 0.9 } });
  // « Le peloton » depuis la refonte du 10 septembre 2026 au soir (`pouvoirs-v4.md`,
  // « Ariane à la française ») : +1 de mouvement au sol, et le soin ne reste qu'au super.
  assert.deepEqual(ariane.pouvoir.effets, [{
    cible: 'mes_unites', filtre: { mouvement: ['pied', 'bottes', 'roues', 'chenilles'] }, modificateur: { quoi: 'mouvement', valeur: 1 },
  }]);
  const premierDuSuper = ariane.superPouvoir.effets[0];
  assert.ok(premierDuSuper && 'modificateur' in premierDuSuper && premierDuSuper.modificateur.quoi === 'soin', 'le soin reste au super');
  const v3 = chargerCommandantJeu('cmd_ariane_belloc', 3);
  assert.equal(v3.pouvoir.nom, 'commandant.cmd_ariane_belloc.pouvoir_v3');
  assert.equal(v3.faiblesse, undefined);
  assert.notDeepEqual(v3.pouvoir.effets, ariane.pouvoir.effets);
  assert.throws(() => chargerCommandantJeu('absent', 4), /absent/i);
  // Le catalogue importé n'est jamais muté par un appelant.
  const profil = lireProfilCommandant('cmd_tomas_reiner', 4)!;
  profil.faiblesse!.effet.modificateur.valeur = 0.5;
  assert.equal(chargerCommandantJeu('cmd_tomas_reiner', 4).faiblesse?.modificateur.valeur, 0.9);
});

/** Une case du plateau sur laquelle une pose est légale, pour un effet de pose. */
function caseDePose(etat: EtatPartie, effet: Extract<EffetPouvoir, { poserTerrain: unknown }>): Case {
  for (let y = 0; y < etat.hauteur; y += 1) for (let x = 0; x < etat.largeur; x += 1) {
    const car = etat.grille[y]![x]!;
    const terrain = cat.parCaractere[car];
    if (terrain && effet.poserTerrain.depuis.includes(terrain) && !etat.unites.some((u) => u.x === x && u.y === y)) return { x, y };
  }
  throw new Error(`aucune case ${effet.poserTerrain.depuis.join('/')} sur le plateau`);
}

test('les 68 pouvoirs se paient, s’appliquent — poses comprises — et leurs modificateurs finissent par expirer', () => {
  // Un plateau qui porte tous les terrains de départ de la table des poses.
  const grille = ['PPPWWP', 'PMFVVP', 'PPPSPP', 'PPPPPP'];
  for (const profil of listerProfilsCommandants(4)) for (const niveau of ['normal', 'super'] as const) {
    const commandant = chargerCommandantJeu(profil.cle, 4);
    // Un commandant de la faction joue depuis un camp `atl` : sans quoi le
    // moteur refuse ses familles réservées (`estCampFaction`, 10 septembre 2026).
    const scene = scenePersonnalisee(grille, {}, [
      { camp: 0, type: 'infanterie', x: 0, y: 0 },
      { camp: 0, type: 'char_leger', x: 0, y: 3, pv: 50 },
      { camp: 1, type: 'infanterie', x: 5, y: 3 },
      { camp: 1, type: 'char_leger', x: 5, y: 0 },
    ], profil.faction === 'atl' ? { factionsParCamp: { 0: 'atl' } } : {});
    const etat = creerPartie(scene, cat, profil.cle);
    etat.camps[0]!.jauge = 900;
    etat.camps[0]!.jaugeMax = 900;
    const commandants = [commandant, null];
    const capacite = niveau === 'normal' ? commandant.pouvoir : commandant.superPouvoir;
    const poses = capacite.effets.filter(estPoseTerrain);
    // Une frappe ou une impulsion vise une case : celle du char adverse.
    const cases = poses.length > 0 ? [caseDePose(etat, poses[0]!)]
      : capacite.effets.some(demandeUneCase) ? [{ x: 5, y: 0 }] : undefined;
    const active = appliquer(etat, { type: 'pouvoir', niveau, ...(cases ? { cases } : {}) }, cat, commandants);
    assert.ok(active.ok, `${profil.cle}/${niveau} : ${active.ok ? '' : JSON.stringify(active)}`);
    if (!active.ok) continue;
    assert.equal(active.etat.camps[0]!.jauge, 900 - capacite.barres * 100);
    assert.equal(active.etat.modificateurs.length, capacite.effets.filter(estModificateurDurable).length, `${profil.cle}/${niveau}`);
    assert.equal(active.etat.terrainsPoses.length, poses.length, `${profil.cle}/${niveau} pose`);
    assert.ok(active.evenements.some((e) => e.type === 'pouvoir'));
    // Six tours plus tard, il ne reste rien d'un pouvoir (deux journées au plus)
    // — sauf une pose permanente, qui est faite pour rester.
    let e = active.etat;
    for (let i = 0; i < 6; i += 1) {
      const r = appliquer(e, { type: 'finTour' }, cat, commandants);
      assert.ok(r.ok);
      if (r.ok) e = r.etat;
    }
    assert.equal(e.modificateurs.length, 0, `${profil.cle}/${niveau} : un modificateur survit`);
    const permanentes = poses.filter((p) => p.poserTerrain.duree === 'permanent').length;
    assert.equal(e.terrainsPoses.length, permanentes, `${profil.cle}/${niveau} : pose`);
  }
});

test('la faiblesse est posée à la création de l’état, permanente, sous sa propre source, et elle coûte', () => {
  const ariane = chargerCommandantJeu('cmd_ariane_belloc', 4);
  const tomas = chargerCommandantJeu('cmd_tomas_reiner', 4);
  const unites = [{ camp: 0 as const, type: 'infanterie', x: 1, y: 0 }, { camp: 1 as const, type: 'infanterie', x: 3, y: 1 }];
  const avec = scenePersonnalisee(['CPPP', 'PPPC'], { '0,0': 0, '3,1': 1 }, unites);
  avec.commandants = [ariane, tomas];
  const sans = scenePersonnalisee(['CPPP', 'PPPC'], { '0,0': 0, '3,1': 1 }, unites);
  const etat = creerPartie(avec, cat, 'faiblesse');
  const temoin = creerPartie(sans, cat, 'faiblesse');
  const faiblesses = etat.modificateurs.filter((m) => m.source === 'faiblesse');
  assert.equal(faiblesses.length, 2);
  assert.ok(faiblesses.every((m) => m.expire.type === 'permanent'));
  assert.deepEqual(faiblesses.find((m) => m.camp === 0)?.effet, ariane.faiblesse);
  assert.deepEqual(faiblesses.find((m) => m.camp === 1)?.effet, tomas.faiblesse);
  assert.equal(etat.modificateurs.filter((m) => m.source === 'passif').length, 2);
  // Ariane : « l'atelier coûte », ses revenus sont à 90 % — dès la journée 1.
  const depart = avec.reglages.fondsDepart;
  const revenu = temoin.camps[0]!.fonds - depart;
  assert.ok(revenu > 0);
  assert.equal(etat.camps[0]!.fonds - depart, Math.round(revenu * 0.9));
  // Elle survit aux tours : ce n'est pas un pouvoir.
  let e = etat;
  for (let i = 0; i < 4; i += 1) {
    const r = appliquer(e, { type: 'finTour' }, cat, [ariane, tomas]);
    assert.ok(r.ok);
    if (r.ok) e = r.etat;
  }
  assert.equal(e.modificateurs.filter((m) => m.source === 'faiblesse').length, 2);
  // Sans faiblesse déclarée (révisions 1 à 3), rien n'est posé sous cette source.
  const ancienne = scenePersonnalisee(['CPPP', 'PPPC'], { '0,0': 0, '3,1': 1 }, unites);
  ancienne.commandants = [chargerCommandantJeu('cmd_ariane_belloc', 3), chargerCommandantJeu('cmd_tomas_reiner', 1)];
  assert.equal(creerPartie(ancienne, cat, 'v3').modificateurs.filter((m) => m.source === 'faiblesse').length, 0);
});

test('les scénarios jouables déclarent la révision 4 ; les quatre premiers tutoriels restent en révision 1', () => {
  const codes = readdirSync('content/scenarios').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  for (const code of codes) {
    const s = scenario(code);
    if (TUTORIELS_SANS_JAUGE.includes(code)) {
      assert.equal(s.commandantsVersion, undefined, `${code} : pas de jauge utile, la révision 1 reste`);
      assert.equal(revisionCommandants(s), 1);
      continue;
    }
    assert.equal(s.commandantsVersion, 4, `${code} joue la révision 4`);
    assert.equal(revisionCommandants(s), 4);
    for (const c of resoudreCommandantsScenario(s)) {
      if (!c) continue;
      assert.match(c.pouvoir.nom, /\.pouvoir_v4$/);
      assert.ok(c.faiblesse, `${code} : ${c.cle} sans faiblesse`);
    }
  }
  // Le schéma accepte 4 et refuse au-delà ; l'absence garde la règle du catalogue.
  assert.ok(validerScenario({ ...scenarioAllie, commandantsVersion: 4 }).ok);
  assert.equal(validerScenario({ ...scenarioAllie, commandantsVersion: 5 }).ok, false);
  assert.equal(revisionCommandants({ catalogueVersion: 6 }), 1);
  assert.equal(revisionCommandants({ catalogueVersion: 7 }), 2);
});

test('le banc prêté lit la révision 4 : Tomas prêté au pacte du col joue son kit et porte sa faiblesse', () => {
  const base = scenario('pacte_du_col');
  const banc = { scenario: cleSourceBanc('pacte_du_col'), scenarioVersion: 1, canonVersion: 1, choix: 'cmd_tomas_reiner' };
  const effectif = appliquerConsequences(base, [banc]).scenario;
  const commandants = resoudreCommandantsScenario(effectif);
  assert.equal(commandants[0]?.cle, 'cmd_tomas_reiner');
  assert.equal(commandants[0]?.pouvoir.nom, 'commandant.cmd_tomas_reiner.pouvoir_v4');
  assert.deepEqual(commandants[0]?.faiblesse, chargerCommandantJeu('cmd_tomas_reiner', 4).faiblesse);
  assert.equal(lireProfilCommandant('cmd_tomas_reiner')?.style, lireProfilCommandant('cmd_tomas_reiner', 4)?.style, 'la fiche du banc lit la 4 par défaut');
  const vm = validerMapDef(JSON.parse(readFileSync(`content/cartes/${effectif.carteCle}.json`, 'utf8')));
  assert.ok(vm.ok);
  const etat = creerPartie(sceneDepuis(effectif, vm.valeur, commandants), chargerCatalogue(effectif.catalogueVersion), 'banc');
  assert.ok(etat.modificateurs.some((m) => m.camp === 0 && m.source === 'faiblesse' && m.effet.filtre?.mouvement?.includes('chenilles')));
  assert.ok(etat.modificateurs.some((m) => m.camp === 1 && m.source === 'faiblesse' && m.effet.modificateur.quoi === 'fonds'));
});

test('le serveur simule avec les commandants du scénario ; un scénario minimal reste sans commandant', () => {
  const s = scenario('demo');
  const kits = commandantsDeSimulation(s);
  assert.equal(kits.length, 2);
  assert.ok(kits.every((k): k is CommandantMoteur => k !== null && k.faiblesse !== undefined && k.faiblesse !== null));
  assert.equal(kits[0]?.pouvoir.nom, 'commandant.cmd_ariane_belloc.pouvoir_v4');
  const vm = validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.carteCle}.json`, 'utf8')));
  assert.ok(vm.ok);
  const minimal = commandantsDeSimulation(scenarioMinimal(vm.valeur, 6));
  assert.deepEqual(minimal, [null, null]);
});
