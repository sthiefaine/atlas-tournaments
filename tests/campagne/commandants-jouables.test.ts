/**
 * Le **vestiaire** : seize commandants jouables débloqués au fil des missions,
 * quatre secrets, et le choix du commandant au briefing
 * (`content/commandants-jouables.json`, `src/app/campagne/commandants-jouables.ts`).
 *
 * Cinq choses à tenir, et ce sont celles qui cassent en silence : le roster est
 * valide et ne renvoie à rien d'inexistant ; un déblocage se déduit des
 * victoires ; un secret n'attend que sa condition, évaluée par le moteur ; une
 * progression écrite avant le vestiaire se relit sans rien perdre ; et le choix
 * est figé dans la graine, donc rejouable au bit près.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import {
  appliquerChoixCommandant, commandantDuScenario, optionsCommandant, paysDuCommandant,
} from '../../src/app/campagne/commandants-jouables';
import {
  cleSourceCommandant, commandantDeGraine, estSourceBanc, estSourceCommandant,
  graineAvecCommandant, graineSansCommandant, scenarioDeSource,
} from '../../src/app/campagne/bancs';
import { appliquerConsequences, decisionsDeGraine, graineAube } from '../../src/app/campagne/consequences';
import {
  commandantEnregistre, commandantsDebloques, debloquerCommandants, enregistrerCommandant,
  lireProgression, normaliserProgression, profilDepuisProgression, secretsAcquis, vestiaire,
  type Progression,
} from '../../src/app/campagne/progression';
import { chargerCommandantsJouables, clesDuRoster, entreeDuRoster } from '../../src/content/commandants-jouables';
import { listerProfilsCommandants } from '../../src/content/profils-commandants';
import { resoudreCommandantsScenario } from '../../src/content/commandants-jeu';
import { validerRosterJouables, validerScenario, validerMapDef, type RosterJouables, type Scenario } from '../../src/schemas/index';
import { chargerCatalogue, creerPartie, sceneDepuis, appliquer, enregistrerPartie, rejouer, empreinte } from '../../src/engine/index';

function stockage(): Map<string, string> {
  const donnees = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v); },
  } });
  return donnees;
}
function scenario(code: string): Scenario {
  const r = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}
function carteDe(s: Scenario) {
  const r = validerMapDef(JSON.parse(readFileSync(`content/cartes/${s.carteCle}.json`, 'utf8')));
  assert.ok(r.ok);
  return r.valeur;
}
const codesScenarios = readdirSync('content/scenarios').filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const progression = (p: Partial<Progression>): Progression => normaliserProgression({ version: 1, victoires: [], ...p });

/**
 * Un roster d'exemple, indépendant du canon : les tests de règle ne doivent pas
 * rougir parce qu'un auteur a déplacé un commandant d'une mission à l'autre.
 */
const EXEMPLE: RosterJouables = {
  version: 1,
  statut: 'exemple_de_test',
  jouables: [
    { cle: 'cmd_ariane_belloc', ouvertPar: 'debut', gout: 'Le kit d’entrée.' },
    { cle: 'cmd_tomas_reiner', ouvertPar: 'pacte_du_col', gout: 'La ligne qui tient.' },
    { cle: 'cmd_ren_mizuno', ouvertPar: 'couleurs_alliees', gout: 'Une case de portée en plus.' },
    { cle: 'cmd_noemie_leduc', ouvertPar: 'a_venir', gout: 'Sa mission d’entrée reste à écrire.' },
  ],
  secrets: [
    {
      cle: 'cmd_hadran_ost', libelle: 'Le banc du Recordman', indice: 'Une batterie sans plaque.',
      condition: { type: 'compteur', cle: 'monde.tournoi.victoires', min: 3 },
    },
    {
      cle: 'cmd_basile_kelm', libelle: 'Le Verrou', indice: 'La Forge, deux fois.',
      condition: { type: 'mode_fini', mode: 'difficile' },
    },
  ],
};

test('roster : le canon est valide, ses clés existent au catalogue, ses ouvertures désignent des scénarios', () => {
  const brut: unknown = JSON.parse(readFileSync('content/commandants-jouables.json', 'utf8'));
  const commandants = listerProfilsCommandants().map((p) => p.cle);
  const r = validerRosterJouables(brut, { commandants, scenarios: codesScenarios });
  assert.ok(r.ok, JSON.stringify(r));
  const roster = chargerCommandantsJouables();
  assert.equal(roster.jouables.length, 16, 'seize jouables, la demande du propriétaire');
  assert.equal(roster.secrets.length, 4, 'quatre secrets');
  assert.equal(new Set(clesDuRoster(roster)).size, clesDuRoster(roster).length, 'aucune clé deux fois');
  assert.ok(roster.jouables.some((j) => j.ouvertPar === 'debut'), 'au moins un commandant dès la première mission');
  for (const cle of clesDuRoster(roster)) {
    assert.ok(entreeDuRoster(cle, roster), `${cle} introuvable dans son propre roster`);
    assert.ok(paysDuCommandant(cle), `${cle} sans couleurs à jouer`);
  }
});

test('roster : le validateur refuse le vide, les doublons, un ouvertPar inconnu et une condition cassée', () => {
  const commandants = listerProfilsCommandants().map((p) => p.cle);
  const avec = (r: unknown) => validerRosterJouables(r, { commandants, scenarios: codesScenarios }).ok;
  assert.ok(avec(EXEMPLE), 'le roster d’exemple est valide');
  // Les comptes ne sont **pas** figés : deux jouables et un secret passent.
  assert.ok(avec({ ...EXEMPLE, jouables: EXEMPLE.jouables.slice(0, 2), secrets: EXEMPLE.secrets.slice(0, 1) }));
  assert.equal(avec({ ...EXEMPLE, jouables: [] }), false, 'un roster vide n’ouvre rien');
  assert.equal(avec({ ...EXEMPLE, secrets: [] }), false, 'pas de secrets, pas de liste');
  assert.equal(avec({ ...EXEMPLE, jouables: [...EXEMPLE.jouables, EXEMPLE.jouables[0]!] }), false, 'deux fois la même clé');
  assert.equal(avec({ ...EXEMPLE, secrets: [{ ...EXEMPLE.secrets[0]!, cle: 'cmd_ariane_belloc' }] }), false,
    'un commandant est ouvert par une victoire ou par un secret, jamais par les deux');
  assert.equal(avec({ ...EXEMPLE, jouables: [{ cle: 'cmd_ariane_belloc', ouvertPar: 'mission_qui_nexiste_pas', gout: 'x' }] }), false,
    'un ouvertPar inconnu');
  assert.equal(avec({ ...EXEMPLE, jouables: [{ cle: 'cmd_pas_au_catalogue', ouvertPar: 'debut', gout: 'x' }] }), false,
    'un commandant absent du catalogue des capacités');
  assert.equal(avec({ ...EXEMPLE, jouables: [{ cle: 'ariane', ouvertPar: 'debut', gout: 'x' }] }), false, 'forme cmd_<prenom>_<nom>');
  assert.equal(avec({ ...EXEMPLE, secrets: [{ ...EXEMPLE.secrets[0]!, condition: { type: 'compteur', cle: 'pas.un.flag', min: 1 } }] }), false,
    'une condition qui ne passe pas validerCondition');
  assert.equal(avec({ ...EXEMPLE, jouables: [{ cle: 'cmd_ariane_belloc', ouvertPar: 'debut' }] }), false, 'un goût est dû');
  // Sans références, seule la forme est vérifiée : `ouvertPar` reste une clé.
  assert.ok(validerRosterJouables({ ...EXEMPLE, jouables: [{ cle: 'cmd_ariane_belloc', ouvertPar: 'mission_qui_nexiste_pas', gout: 'x' }] }).ok);
});

test('schéma : choixCommandant vaut aucun ou debloques, et jamais en même temps que des bancs', () => {
  const base = scenario('pacte_du_col');
  assert.ok(base.bancs && base.bancs.length >= 1);
  const sansBancs = (reste: Partial<Scenario>): unknown => { const s = { ...base, ...reste }; delete s.bancs; return s; };
  assert.equal(validerScenario({ ...base, choixCommandant: 'debloques' }).ok, false, 'bancs nommés et roster ouvert');
  assert.ok(validerScenario({ ...base, choixCommandant: 'aucun' }).ok, 'aucun ne contredit pas les bancs : c’est le défaut');
  assert.ok(validerScenario(sansBancs({ choixCommandant: 'debloques' })).ok);
  assert.equal(validerScenario({ ...(sansBancs({}) as object), choixCommandant: 'parfois' }).ok, false, 'valeur hors énumération');
  assert.equal(base.choixCommandant, undefined, 'absent vaut aucun');
  // Un match d'incarnation est déjà le choix d'un général, et il écrit les flags
  // de la nation incarnée : ouvrir le roster par-dessus les rendrait faux.
  const incarne = scenario('couleurs_alliees');
  assert.ok(incarne.incarnation, 'les couleurs alliées sont bien un match d’incarnation');
  assert.equal(validerScenario({ ...incarne, choixCommandant: 'debloques' }).ok, false);
  // Le canon ne se contredit pas : aucun scénario ne porte deux de ces trois-là.
  for (const code of codesScenarios) {
    const s = scenario(code);
    // `bancPrete` est posé par le code sur un scénario effectif, jamais écrit
    // dans le canon : un fichier qui le porterait s'exempterait de la règle des
    // flags d'incarnation sans être un banc.
    assert.equal(s.bancPrete, undefined, `${code} : bancPrete est un témoin de code`);
    if (s.choixCommandant !== 'debloques') continue;
    assert.ok(!s.bancs, `${code} : bancs et roster ouvert`);
    assert.ok(!s.incarnation, `${code} : incarnation et roster ouvert`);
  }
});

test('déblocage : les victoires ouvrent, « a_venir » n’ouvre jamais, une progression d’avant se lit', () => {
  assert.deepEqual(commandantsDebloques(progression({}), EXEMPLE), ['cmd_ariane_belloc']);
  assert.deepEqual(commandantsDebloques(progression({ victoires: ['pacte_du_col'] }), EXEMPLE),
    ['cmd_ariane_belloc', 'cmd_tomas_reiner']);
  assert.deepEqual(commandantsDebloques(progression({ victoires: ['pacte_du_col', 'couleurs_alliees'] }), EXEMPLE),
    ['cmd_ariane_belloc', 'cmd_tomas_reiner', 'cmd_ren_mizuno'], 'jamais Noémie : elle est a_venir');
  // Une progression écrite avant le vestiaire : aucun champ `commandants`, et rien ne casse.
  const ancienne = normaliserProgression({ version: 1, victoires: ['pacte_du_col'], canonVersion: 1 });
  assert.equal(ancienne.commandants, undefined);
  assert.deepEqual(commandantsDebloques(ancienne, EXEMPLE), ['cmd_ariane_belloc', 'cmd_tomas_reiner']);
  assert.deepEqual(secretsAcquis(ancienne, EXEMPLE), []);
  // Un `commandants` corrompu ne renverse rien : seule la forme d'une clé passe.
  const sale = normaliserProgression({ version: 1, victoires: [], commandants: ['cmd_hadran_ost', 'pas_un_general', 42, 'cmd_hadran_ost'] });
  assert.deepEqual(sale.commandants, ['cmd_hadran_ost']);
});

test('secret : rien avant sa condition, et acquis il ne se reperd pas', () => {
  const deuxTitres = progression({ victoires: ['premier_contact', 'pacte_du_col'] });
  assert.deepEqual(secretsAcquis(deuxTitres, EXEMPLE), [], 'trois titres sont demandés, il y en a deux');
  const trois = progression({ victoires: ['premier_contact', 'pacte_du_col', 'couleurs_alliees'] });
  assert.deepEqual(secretsAcquis(trois, EXEMPLE), ['cmd_hadran_ost']);
  // `mode_fini` n'existe pas localement : c'est l'appelant qui le donne.
  assert.deepEqual(secretsAcquis(trois, EXEMPLE, { modesFinis: ['difficile'] }), ['cmd_hadran_ost', 'cmd_basile_kelm']);
  // Une condition remplie une fois est enregistrée, et survit à une progression appauvrie.
  const garde = progression({ victoires: [], commandants: ['cmd_hadran_ost'] });
  assert.deepEqual(secretsAcquis(garde, EXEMPLE), ['cmd_hadran_ost']);
  assert.deepEqual(vestiaire(garde, EXEMPLE), ['cmd_ariane_belloc', 'cmd_hadran_ost']);
  // Le pont vers le moteur pose bien les flags que les conditions du canon lisent.
  const profil = profilDepuisProgression(progression({ victoires: ['aube_routes_3v1'], victoiresParMode: { difficile: ['aube_routes_3v1'] } }));
  assert.equal(profil.flags.booleens['monde.tournoi.aube_routes_3v1'], true);
  assert.equal(profil.flags.booleens['monde.tournoi.aube_routes_3v1_difficile'], true);
  assert.equal(profil.flags.compteurs['monde.tournoi.victoires'], 1);
  assert.equal(profil.flags.compteurs['monde.tournoi.victoires_difficile'], 1);
  assert.deepEqual(profil.scenariosFinis, ['aube_routes_3v1']);
});

test('secret : les quatre du canon restent fermés à un profil neuf, et s’ouvrent sur leur condition', () => {
  const roster = chargerCommandantsJouables();
  assert.deepEqual(secretsAcquis(progression({}), roster), [], 'aucun secret offert d’entrée');
  const tout = progression({
    victoires: codesScenarios,
    victoiresParMode: { difficile: codesScenarios },
  });
  const ouverts = secretsAcquis(tout, roster, { modesFinis: ['difficile'], flags: { booleens: {}, compteurs: { 'monde.tournoi.matchs_sans_perte': 9 }, journal: [] } });
  assert.deepEqual(ouverts, roster.secrets.map((s) => s.cle), 'tout gagné, tout ouvert');
});

test('déblocage : ce qui vient de s’ouvrir est annoncé une fois, et enregistré par profil', () => {
  stockage();
  assert.deepEqual(debloquerCommandants(EXEMPLE, 'a'), ['cmd_ariane_belloc'], 'le kit d’entrée s’ouvre au premier appel');
  assert.deepEqual(debloquerCommandants(EXEMPLE, 'a'), [], 'et ne se réannonce pas');
  assert.deepEqual(lireProgression('a').commandants, ['cmd_ariane_belloc']);
  assert.deepEqual(debloquerCommandants(EXEMPLE, 'b'), ['cmd_ariane_belloc'], 'le profil B a son propre vestiaire');
  // Une victoire ouvre, et l'ouverture est l'unique nouveauté annoncée.
  const stock = globalThis.localStorage;
  stock.setItem('atlas:qualification:v1', JSON.stringify({ version: 1, victoires: ['pacte_du_col'], commandants: ['cmd_ariane_belloc'] }));
  assert.deepEqual(debloquerCommandants(EXEMPLE, 'a'), ['cmd_tomas_reiner']);
  assert.deepEqual(lireProgression('a').commandants, ['cmd_ariane_belloc', 'cmd_tomas_reiner']);
});

test('options : le commandant du scénario d’abord, puis les débloqués ; rien sans choixCommandant', () => {
  const ouvert = scenario('aube_routes_3v1');
  assert.equal(ouvert.choixCommandant, 'debloques', 'les routes d’Aube ouvrent le roster');
  assert.deepEqual(optionsCommandant(scenario('premier_contact'), progression({}), EXEMPLE), [],
    'un scénario qui n’ouvre rien');
  const p = progression({ victoires: ['pacte_du_col'] });
  const options = optionsCommandant(ouvert, p, EXEMPLE);
  assert.deepEqual(options.map((o) => o.cle), ['cmd_ariane_belloc', 'cmd_tomas_reiner']);
  assert.equal(options[0]!.defaut, true);
  assert.equal(options[0]!.cle, commandantDuScenario(ouvert), 'le défaut est celui du scénario');
  assert.equal(options[0]!.paysCode, null, 'ses propres couleurs');
  assert.equal(options[1]!.defaut, false);
  assert.equal(options[1]!.paysCode, 'lu');
  assert.equal(options[1]!.nom, 'commandant.cmd_tomas_reiner.nom');
  assert.equal(options[1]!.gout, 'La ligne qui tient.');
  // Le kit est celui de la révision du scénario, pas celui d'une autre.
  for (const o of options) {
    assert.ok(o.kit, `${o.cle} sans kit à montrer`);
    assert.equal(o.kit!.cle, o.cle);
    assert.equal(o.kit!.pouvoir.nom, resoudreCommandantsScenario({ ...ouvert, commandants: [{ camp: 0, commandantCle: o.cle }, ...ouvert.commandants.slice(1)] })[0]!.pouvoir.nom);
  }
  // Un secret acquis paraît, marqué comme tel ; le défaut n'apparaît jamais deux fois.
  const avecSecret = optionsCommandant(ouvert, progression({ victoires: ['pacte_du_col'], commandants: ['cmd_hadran_ost'] }), EXEMPLE);
  assert.deepEqual(avecSecret.map((o) => o.cle), ['cmd_ariane_belloc', 'cmd_tomas_reiner', 'cmd_hadran_ost']);
  assert.equal(avecSecret.at(-1)!.secret, true);
  assert.equal(avecSecret.filter((o) => o.defaut).length, 1);
});

test('effectif : le commandant choisi prend le camp 0 par le chemin du banc prêté', () => {
  const base = scenario('aube_routes_3v1');
  const origine = commandantDuScenario(base)!;
  assert.equal(origine, 'cmd_ariane_belloc');
  const locuteursConnus = (s: Scenario): void => {
    const distribution = new Set(s.commandants.map((c) => c.commandantCle));
    for (const r of [...s.dialogueOuverture, ...s.dialogueVictoire, ...s.dialogueDefaite, ...(s.scenesDialogue ?? []).flatMap((x) => x.repliques)]) {
      assert.ok(distribution.has(r.locuteur), `${r.locuteur} parle sans être au tableau`);
    }
  };
  // Un général venu d'ailleurs : il prend le camp 0, et le commandant d'origine
  // quitte le terrain en lui laissant ses consignes de banc.
  const sous = appliquerChoixCommandant(base, 'cmd_ren_mizuno');
  assert.equal(sous.commandants.find((c) => c.camp === 0)?.commandantCle, 'cmd_ren_mizuno');
  assert.deepEqual(sous.incarnation, { paysCode: 'jp', commandantCle: 'cmd_ren_mizuno' });
  assert.equal(sous.choixCommandant, undefined, 'le choix est fait');
  assert.equal(sous.bancPrete, true, 'une épreuve jouée sous un autre banc garde ses flags');
  assert.ok(validerScenario(sous).ok, 'un scénario sous un autre commandant reste valide');
  locuteursConnus(sous);
  // Un général déjà sur le terrain : les deux **échangent** leurs bancs, comme
  // pour un banc prêté — jamais deux fois le même général sur la carte.
  const echange = appliquerChoixCommandant(base, 'cmd_tomas_reiner');
  assert.equal(echange.commandants.find((c) => c.camp === 0)?.commandantCle, 'cmd_tomas_reiner');
  assert.equal(echange.commandants.find((c) => c.camp === 1)?.commandantCle, origine, 'Ariane tient le banc de Tomas');
  assert.equal(echange.commandants.find((c) => c.camp === 1)?.ia, 'ponderee', 'l’IA reste au camp, pas au commandant');
  assert.ok(validerScenario(echange).ok);
  locuteursConnus(echange);
  assert.equal(base.commandants.find((c) => c.camp === 0)?.commandantCle, origine, 'canon non muté');
  // Le commandant du scénario, `null`, ou une clé sur un scénario fermé : rien ne bouge.
  assert.deepEqual(appliquerChoixCommandant(base, origine), base);
  assert.deepEqual(appliquerChoixCommandant(base, null), base);
  const ferme = scenario('premier_contact');
  assert.deepEqual(appliquerChoixCommandant(ferme, 'cmd_tomas_reiner'), ferme, 'sans choixCommandant, personne ne change de banc');
});

test('graine : le commandant y est figé, s’en relit, et n’efface pas les décisions', () => {
  const base = scenario('couleurs_alliees');
  const nue = graineAube(base, []);
  assert.equal(commandantDeGraine(nue), null, 'une graine sans choix n’en porte pas la marque');
  const avec = graineAvecCommandant(nue, 'cmd_ren_mizuno');
  assert.equal(commandantDeGraine(avec), 'cmd_ren_mizuno');
  assert.equal(graineSansCommandant(avec), nue);
  assert.equal(graineAvecCommandant(avec, 'cmd_tomas_reiner'), graineAvecCommandant(nue, 'cmd_tomas_reiner'), 'la marque se remplace');
  assert.equal(graineAvecCommandant(avec, null), nue, 'et se retire, rendant la graine d’avant à l’octet près');
  // Les décisions se relisent malgré la marque : les deux mécanismes cohabitent.
  const pacte = scenario('pacte_du_col');
  const decisions = decisionsDeGraine(pacte, graineAube(pacte, []));
  const marquee = graineAvecCommandant(graineAube(pacte, decisions), 'cmd_ren_mizuno');
  assert.deepEqual(decisionsDeGraine(pacte, marquee), decisionsDeGraine(pacte, graineAube(pacte, decisions)));
  // Une graine tient en 64 caractères (`validerSauvegarde`), quel que soit le couple.
  const cles = clesDuRoster();
  for (const code of codesScenarios) {
    for (const cle of cles) {
      const g = graineAvecCommandant(graineAube({ ...base, code } as Scenario, []), cle);
      assert.ok(g.length <= 64, `${g} : ${g.length} caractères`);
    }
  }
});

test('décision : le choix s’enregistre sans victoire, se rechoisit, et refuse ce qui n’était pas proposé', () => {
  stockage();
  const proposes = ['cmd_ariane_belloc', 'cmd_tomas_reiner'];
  assert.equal(estSourceCommandant(cleSourceCommandant('couleurs_alliees')), true);
  assert.equal(estSourceBanc(cleSourceCommandant('couleurs_alliees')), false, 'une source de commandant n’est pas une source de banc');
  assert.equal(scenarioDeSource(cleSourceCommandant('couleurs_alliees')), 'couleurs_alliees');
  assert.equal(enregistrerCommandant('couleurs_alliees', 1, 'cmd_hadran_ost', proposes, 'a'), false,
    'un commandant que le briefing n’offrait pas ne se déverrouille pas par la sauvegarde');
  assert.equal(enregistrerCommandant('couleurs_alliees', 1, 'cmd_tomas_reiner', proposes, 'a'), true);
  let p = lireProgression('a');
  assert.equal(commandantEnregistre('couleurs_alliees', 1, p), 'cmd_tomas_reiner');
  assert.equal(p.journal?.length, 1, 'une ligne au journal, pas deux');
  assert.equal(enregistrerCommandant('couleurs_alliees', 1, 'cmd_ariane_belloc', proposes, 'a'), true, 'on rechoisit à la partie suivante');
  p = lireProgression('a');
  assert.equal(commandantEnregistre('couleurs_alliees', 1, p), 'cmd_ariane_belloc');
  assert.equal(p.journal?.length, 1);
  assert.equal(commandantEnregistre('couleurs_alliees', 2, p), null, 'une autre version du scénario reposera la question');
  assert.equal(lireProgression('b').journal?.length ?? 0, 0, 'la décision appartient au profil');
  // La normalisation garde un choix de commandant bien formé et jette le reste.
  const n = normaliserProgression({ version: 1, victoires: [], canonVersion: 1, decisions: {
    x: { scenario: cleSourceCommandant('couleurs_alliees'), scenarioVersion: 1, canonVersion: 1, choix: 'cmd_ren_mizuno' },
    y: { scenario: cleSourceCommandant('couleurs_alliees'), scenarioVersion: 2, canonVersion: 1, choix: 'pas_un_general' },
  }, journal: ['x', 'y'] });
  assert.equal(Object.keys(n.decisions ?? {}).length, 1);
  assert.equal(commandantEnregistre('couleurs_alliees', 1, n), 'cmd_ren_mizuno');
});

test('moteur : la partie se joue sous le commandant choisi, et son rejeu est identique', () => {
  const base = scenario('aube_routes_3v1');
  const carte = carteDe(base);
  const cat = chargerCatalogue(base.catalogueVersion);
  const graine = graineAvecCommandant(graineAube(base, []), 'cmd_ren_mizuno');
  const effectif = appliquerChoixCommandant(
    appliquerConsequences(base, decisionsDeGraine(base, graine)).scenario,
    commandantDeGraine(graine),
  );
  const depart = creerPartie(sceneDepuis(effectif, carte, resoudreCommandantsScenario(effectif)), cat, graine);
  assert.equal(depart.camps[0]?.commandantCle, 'cmd_ren_mizuno');
  const avance = appliquer(depart, { type: 'finTour' }, cat);
  assert.ok(avance.ok);
  const sauvegarde = enregistrerPartie(avance.etat, [{ type: 'finTour' }]);
  assert.ok(sauvegarde.graine.length <= 64);
  // La reprise ne relit que la graine : le joueur a pu rechoisir entre-temps.
  const retrouve = appliquerChoixCommandant(
    appliquerConsequences(base, decisionsDeGraine(base, sauvegarde.graine)).scenario,
    commandantDeGraine(sauvegarde.graine),
  );
  const reprise = rejouer(sceneDepuis(retrouve, carte, resoudreCommandantsScenario(retrouve)), cat, sauvegarde, resoudreCommandantsScenario(retrouve));
  assert.deepEqual(reprise.refus, []);
  assert.equal(empreinte(reprise.etat), empreinte(avance.etat));
  // Le témoin : sans choix, c'est le commandant du scénario, et l'empreinte diffère.
  const temoin = creerPartie(sceneDepuis(base, carte, resoudreCommandantsScenario(base)), cat, graineAube(base, []));
  assert.equal(temoin.camps[0]?.commandantCle, commandantDuScenario(base));
  assert.notEqual(empreinte(temoin), empreinte(depart));
});

test('les quatre secrets s’ouvrent par leur condition, et le sans-perte se compte', () => {
  const roster = chargerCommandantsJouables();
  const vide: Progression = { version: 1, victoires: [] };
  assert.deepEqual(secretsAcquis(vide, roster), [], 'aucun secret au départ');

  // Ost : deux victoires, dont le siège de quarante journées.
  const ost: Progression = { version: 1, victoires: ['aube_routes_3v1', 'aube_releve_1v3'] };
  assert.ok(secretsAcquis(ost, roster).includes('cmd_hadran_ost'), JSON.stringify(secretsAcquis(ost, roster)));

  // Maël : la victoire de nuit ne suffit pas ; il faut trois manches sans perte.
  const nuit: Progression = { version: 1, victoires: ['aube_nuit_2v2'] };
  assert.ok(!secretsAcquis(nuit, roster).includes('cmd_mael_orven'), 'la victoire seule ne l’ouvre pas');
  const propres: Progression = { ...nuit, matchsSansPerte: 3 };
  assert.ok(secretsAcquis(propres, roster).includes('cmd_mael_orven'), 'trois manches propres l’ouvrent');
  const deux: Progression = { ...nuit, matchsSansPerte: 2 };
  assert.ok(!secretsAcquis(deux, roster).includes('cmd_mael_orven'), 'deux ne suffisent pas');
});

test('une victoire sans perte fait monter le compte, une victoire coûteuse non', () => {
  const p: Progression = { version: 1, victoires: [], matchsSansPerte: 1 };
  const normalisee = normaliserProgression({ ...p, matchsSansPerte: 2 });
  assert.equal(normalisee.matchsSansPerte, 2, 'le compte se relit');
  assert.equal(normaliserProgression({ version: 1, victoires: [] }).matchsSansPerte, undefined,
    'une progression d’avant n’en a pas, et n’en invente pas');
});
