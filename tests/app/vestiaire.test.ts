/**
 * Le vestiaire branché sur le canon : la grille du briefing et du carnet
 * (`src/app/campagne/roster.ts`), et l'échange de banc qu'un choix provoque.
 *
 * Le module pur est tenu par `tests/render/roster-commandants.test.ts` ; ce qui
 * se vérifie ici, c'est la jointure — que le roster réel produise seize bancs et
 * quatre silhouettes, que chaque porte se dise en français, que le kit affiché
 * soit **lu au catalogue** et non recopié, et qu'un choix ne repeigne pas les
 * deux camps au passage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';

import { chargerCatalogue } from '../../src/engine/index';
import { chargerCommandantsJouables } from '../../src/content/commandants-jouables';
import { grilleCommandants, porteCommandant, titreEpreuve } from '../../src/app/campagne/roster';
import { appliquerCommandantDeGraine } from '../../src/app/campagne/commandants-jouables';
import { graineAvecCommandant } from '../../src/app/campagne/bancs';
import { debloquerCommandants, enregistrerVictoire, vestiaire } from '../../src/app/campagne/progression';
import { compteRoster, ouvertures } from '../../src/render/roster-commandants';
import { SOURCE_FR, t } from '../../src/i18n/index';
import { validerScenario, type Scenario } from '../../src/schemas/index';
import { appliquerConsequences } from '../../src/app/campagne/consequences';
import { scenarioPourMode } from '../../src/app/jeu/difficulte';

const locale = 'fr';
const tr = (cle: string, params?: Record<string, string | number>) => t(locale, cle, params);
const roster = chargerCommandantsJouables();

function grille(victoires: string[] = [], defaut?: string) {
  return grilleCommandants({
    t: tr, locale, roster, defaut, catalogue: chargerCatalogue(), revision: 4,
    acquis: vestiaire({ version: 1, victoires }, roster),
  });
}

test('le roster du canon donne seize bancs et quatre secrets', () => {
  assert.equal(roster.jouables.length, 16);
  assert.equal(roster.secrets.length, 4);
});

test('une progression vierge n’ouvre que les bancs de début, et les secrets restent muets', () => {
  const fiches = grille();
  const compte = compteRoster(fiches);
  assert.equal(compte.total, 20);
  assert.equal(compte.secrets, 4, 'les quatre secrets sont fermés');
  assert.equal(compte.acquis, roster.jouables.filter((j) => j.ouvertPar === 'debut').length);
  assert.ok(compte.acquis >= 1, 'on ne commence jamais sans banc');

  // Aucun nom, aucune clé de secret dans toute la grille.
  const tout = JSON.stringify(fiches);
  for (const s of roster.secrets) {
    assert.ok(!tout.includes(s.cle), `${s.cle} fuite dans la grille`);
    assert.ok(!tout.includes(s.libelle), `${s.libelle} fuite dans la grille`);
  }
  // Mais les quatre indices, eux, sont là : c'est tout ce qu'un secret montre.
  for (const s of roster.secrets) assert.ok(tout.includes(s.indice), `${s.cle} n’annonce pas son indice`);
});

test('chaque case verrouillée dit une porte en français, jamais un code de scénario', () => {
  const fiches = grille();
  const verrouillees = fiches.filter((f) => f.etat === 'verrouille');
  assert.ok(verrouillees.length >= 10, 'il reste du chemin à faire');
  for (const f of verrouillees) {
    assert.notEqual(f.porte, '', `${f.id} : une case grise muette n’annonce rien à gagner`);
    assert.ok(!/[a-z]+_[a-z0-9_]+/.test(f.porte), `${f.id} : « ${f.porte} » montre un code`);
  }
  // Toutes les portes du roster se disent, y compris celles des essais d'Aube,
  // qui ne sont pas au fil de la campagne.
  for (const j of roster.jouables) {
    if (j.ouvertPar === 'debut') continue;
    const dite = porteCommandant(tr, locale, j.ouvertPar);
    assert.notEqual(dite, '', j.ouvertPar);
    if (j.ouvertPar !== 'a_venir') {
      assert.notEqual(titreEpreuve(locale, j.ouvertPar), '',
        `${j.ouvertPar} n’a pas de titre : la porte se dirait sans nommer l’épreuve`);
    }
  }
});

test('les victoires ouvrent exactement les bancs qu’elles portent', () => {
  const gagne = roster.jouables.filter((j) => j.ouvertPar !== 'debut' && j.ouvertPar !== 'a_venir');
  assert.ok(gagne.length >= 12);
  const cible = gagne[0]!;
  const fiches = grille([cible.ouvertPar]);
  const f = fiches.find((x) => x.id === cible.cle);
  assert.equal(f?.etat, 'jouable', `${cible.ouvertPar} devait ouvrir ${cible.cle}`);
  assert.equal(f?.cle, cible.cle);
  // Et rien d'autre : une victoire n'ouvre pas la campagne entière.
  assert.equal(compteRoster(fiches).acquis, compteRoster(grille()).acquis + 1);
});

test('le kit montré est celui du catalogue, lu sur ses effets', () => {
  const fiches = grille([], 'cmd_ariane_belloc');
  const ariane = fiches[0]!;
  assert.equal(ariane.defaut, true);
  assert.equal(ariane.nom, t(locale, 'commandant.cmd_ariane_belloc.nom'));
  assert.notEqual(ariane.style, '');
  // Passif (ou rien), pouvoir, super, faiblesse : jamais une phrase recopiée,
  // et jamais une clé i18n non résolue.
  assert.ok(ariane.lignes.length >= 2, JSON.stringify(ariane.lignes));
  for (const ligne of ariane.lignes) {
    assert.notEqual(ligne.trim(), '');
    assert.ok(!ligne.includes('{'), `« ${ligne} » garde un paramètre non substitué`);
  }
});

test('toutes les chaînes du vestiaire existent dans le canon', () => {
  const fichiers = [
    'src/app/campagne/roster.ts',
    'src/app/campagne/page.tsx',
    'src/app/jeu/[scenario]/toile.tsx',
    'src/app/jeu/[scenario]/choix-commandant.tsx',
  ];
  const cles = new Set<string>();
  for (const fichier of fichiers) {
    const source = readFileSync(fichier, 'utf8');
    for (const m of source.matchAll(/'((?:vestiaire|epreuve)\.[a-z0-9_.]+)'/g)) cles.add(m[1]!);
  }
  assert.ok(cles.size >= 18, `seulement ${cles.size} clés trouvées`);
  for (const cle of cles) {
    assert.ok(Object.hasOwn(SOURCE_FR, cle), `${cle} n’est pas dans content/i18n/interface.fr.json`);
  }
});

/** Un stockage de papier, comme le fait le test du banc prêté. */
function stockage(): Map<string, string> {
  const donnees = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v); },
  } });
  return donnees;
}

test('l’annonce de déblocage ne paraît qu’une fois', () => {
  stockage();
  const porte = roster.jouables.find((j) => j.ouvertPar !== 'debut' && j.ouvertPar !== 'a_venir')!;
  // Le vestiaire de départ est enregistré à la première ouverture ; c'est ce
  // premier appel qui l'annonce, et l'écran de fin ne le voit jamais.
  debloquerCommandants(roster, 'a');
  enregistrerVictoire(porte.ouvertPar, 'a');
  const premier = debloquerCommandants(roster, 'a');
  assert.ok(premier.includes(porte.cle), `${porte.ouvertPar} devait ouvrir ${porte.cle}`);
  // Le second appel — un second `surEtat` sur la même manche, un retour au
  // briefing — ne rend plus rien : sans cela l'annonce se rejouerait à chaque
  // fois qu'on rouvre l'écran de fin.
  assert.deepEqual(debloquerCommandants(roster, 'a'), []);
  // Et la grille ne montre plus l'ouverture, faute de clé à annoncer.
  assert.deepEqual(ouvertures(grille([porte.ouvertPar]), []), []);
});

/** Le scénario du canon qui porte ce code, validé. */
function scenario(code: string): Scenario {
  const r = validerScenario(JSON.parse(readFileSync(`content/scenarios/${code}.json`, 'utf8')));
  assert.ok(r.ok, JSON.stringify(r));
  return r.valeur;
}

test('la clé retenue au briefing devient le banc du joueur, par la graine', () => {
  // C'est le contrat que l'écran consomme : il rend une clé, la page l'écrit
  // dans la graine, et `commandants-jouables.ts` pose le général au camp 0.
  // L'échange lui-même est tenu par les tests de ce module ; ici on vérifie que
  // la grille et la graine parlent bien de la même chose.
  const s = scenario('aube_reserves_1v2');
  assert.equal(s.choixCommandant, 'debloques', 'le canon a changé : ce test vise une épreuve à vestiaire');
  const banc = grille([], undefined).find((f) => f.etat === 'jouable' && !f.defaut)?.cle
    ?? grille([])[0]!.cle;
  const joue = appliquerCommandantDeGraine(s, graineAvecCommandant(`${s.code}:1`, banc));
  assert.equal(joue.commandants.find((c) => c.camp === 0)?.commandantCle, banc);
  // Et tout locuteur du scénario joué est encore au tableau : un banc pris ne
  // laisse jamais parler quelqu'un que la distribution n'a plus.
  const distribution = new Set(joue.commandants.map((c) => c.commandantCle));
  const repliques = [...joue.dialogueOuverture, ...joue.dialogueVictoire, ...joue.dialogueDefaite,
    ...(joue.scenesDialogue ?? []).flatMap((sc) => sc.repliques)];
  for (const r of repliques) assert.ok(distribution.has(r.locuteur), `${r.locuteur} parle sans être au tableau`);
});

test('la politique de choix survit à la préparation du scénario', () => {
  // La page applique le banc **après** `scenarioPourMode` et
  // `appliquerConsequences` : si l'une des deux perdait `choixCommandant` en
  // chemin, `appliquerChoixCommandant` refuserait en silence et le joueur
  // jouerait le commandant du scénario après avoir choisi l'autre.
  const s = scenario('aube_reserves_1v2');
  for (const mode of ['normal', 'difficile'] as const) {
    const prepare = appliquerConsequences(scenarioPourMode(s, mode), [], (cle) => cle);
    assert.equal(prepare.scenario.choixCommandant, 'debloques', mode);
  }
});

test('un scénario qui ouvre le vestiaire ne propose pas de bancs nommés', () => {
  // Le schéma les rend exclusifs ; ce test vérifie que le canon le respecte,
  // parce que la page choisit **un** des deux écrans et taira l'autre.
  for (const nom of readdirSync('content/scenarios').filter((n) => n.endsWith('.json'))) {
    const r = validerScenario(JSON.parse(readFileSync(`content/scenarios/${nom}`, 'utf8')));
    if (!r.ok) continue;
    if (r.valeur.choixCommandant === 'debloques') {
      assert.equal(r.valeur.bancs, undefined, `${nom} propose deux façons de choisir son banc`);
    }
  }
});
