# Le banc prêté au briefing — choisir son héros (10 septembre 2026)

La demande du propriétaire : « est-ce que pour certaines missions on peut choisir notre héros / nation avec laquelle on va jouer dans la campagne principale, ce qui va peut-être changer le futur, ou faire une mini-branche ». Ce document dit ce qui est livré, comment on ajoute un banc à une épreuve, quelles épreuves en portent, et ce qui n'est pas fait. Le canon est `BRIEF.md` (« Choisir son héros ») et `doc/13-campagne.md` §3.4 bis ; le vocabulaire est `doc/01-bible.md` §4.6.

## Ce que le joueur voit

Sur une épreuve qui propose des bancs, une **partie neuve** ne se monte pas tout de suite : la fenêtre de mission demande d'abord « Choisissez votre banc ». Elle liste, en boutons pleine largeur, le banc du scénario en premier — « Jouer sous vos propres couleurs » — puis chaque banc prêté — « Jouer sous les couleurs du Luxembourg, avec Tomas Reiner ». Sous chaque bouton : le nom du général, son style et le kit **tel qu'il sera joué** (pouvoir et super, lus par `chargerCommandantJeu` à la révision du scénario), et la **suite annoncée** dans l'épreuve suivante. Un appui monte la partie. Une partie en cours reprend sans rien demander : son banc est dans sa graine. « Nouvelle partie » repasse par le choix.

Pendant la partie, le briefing rappelle « Banc prêté : sous les couleurs de… », et le portrait prend la teinte alliée comme à l'exhibition. Dans l'épreuve suivante, la fenêtre de mission liste la conséquence sous « Conséquences », et l'ouverture porte une réplique de plus. Le carnet (`/campagne`) montre la ligne « Vous avez joué sous les couleurs de… » dans le journal, avec le lien vers l'épreuve.

## Comment ça marche

- **Schéma** — `Scenario.bancs?: BancPrete[]` avec `BancPrete = { commandantCle, paysCode, libelle }` (`src/schemas/types.ts`). `validerScenario` refuse un banc du commandant du camp 0, deux bancs du même général, un libellé qui n'est pas une clé i18n pointée, et `bancs` sur un scénario qui a déjà `incarnation`. Le registre des généraux n'est pas lisible depuis `schemas` (la couche n'importe rien) : c'est `tests/campagne/banc-prete.test.ts` qui exige qu'un banc du canon ait son profil dans `content/commandants-capacites.json`, ses chaînes, et que la table de `bancs.ts` recopie exactement les scénarios.
- **La règle de l'échange** — `src/app/campagne/bancs.ts`, `appliquerBanc(scenario, banc)` : le général prêté prend le camp 0 et le scénario effectif reçoit `incarnation = { paysCode, commandantCle }`, ce que `sceneDepuis`/`commandantsIncarnes` lisent déjà sans qu'une ligne du moteur change. Si le général jouait ailleurs sur le terrain, le commandant du joueur prend sa place (échange d'entraîneurs) ; sinon le commandant du joueur quitte le terrain et ses répliques passent au général prêté, pour que la distribution reste celle des locuteurs. `bancs` disparaît du scénario effectif.
- **La décision** — `enregistrerBanc(scenario, version, choix)` (`progression.ts`) enregistre sous la source `<scenario>:banc` avec le mécanisme des décisions locales ; à la différence des choix de fin de match, elle n'exige aucune victoire et se **remplace** à chaque nouvelle partie de l'épreuve (le journal garde sa ligne à sa place). L'option « propres couleurs » s'enregistre aussi (`PROPRES_COULEURS`) : le carnet le dit.
- **La graine** — `SOURCES_DECISION` (`consequences.ts`) ajoute les sources de banc **après** les choix, un chiffre chacune ; `decisionsDeGraine` relit les graines à deux, quatre, cinq et huit chiffres. Reprendre une partie rejoue exactement le même banc ; `tests/campagne/banc-prete.test.ts` le prouve par `empreinte`.
- **La branche** — `appliquerConsequences(scenario, decisions, traduire?)` applique d'abord les suites venues d'une autre épreuve, puis le banc de l'épreuve elle-même, en dernier. Les répliques ajoutées sont écrites dans `consequences.ts` (`REPLIQUES_BANC`), comme `difficulte.ts` écrit les siennes : c'est du contenu, une à trois phrases, un locuteur présent dans la distribution effective. Les rappels de banc sont traduits par `traduire` (la toile passe `t()`), les rappels de choix restent des textes.
- **Chaînes** — `banc.*` dans `content/i18n/interface.fr.json` : `banc.choisir`, `banc.note`, `banc.jouer` (« Jouer {banc} »), `banc.journal` (« Vous avez joué {banc} »), `banc.en_cours`, `banc.kit`, `banc.propres_couleurs`, `banc.sans_suite`, et par banc `banc.<scenario>.<commandant>` (le complément « sous les couleurs de …, avec … ») et `.effet`.
- **Rendu** — `toile.tsx` monte la partie sur le scénario **effectif** (`commandantsDuScenario(prepare.scenario)`, `paysParCamp` depuis son `incarnation`), et `mission.css` porte `.atlas-bancs`/`.atlas-banc` : coin coupé, épaisseur qui s'écrase, une colonne pleine largeur pour un pouce de 390 px.

## Ajouter un banc à une épreuve

1. Dans `content/scenarios/<code>.json`, ajouter `"bancs": [{ "commandantCle": "cmd_…", "paysCode": "…", "libelle": "banc.<code>.cmd_…" }]` après `commandants`. Le général doit avoir un profil dans `content/commandants-capacites.json` ; `paysCode` vaut `atl` pour un banc de l'Intendance.
2. Recopier l'entrée dans `BANCS_PRETES` (`src/app/campagne/bancs.ts`) avec sa clé `effet` — le test de cohérence échoue tant que les deux ne concordent pas.
3. Écrire les chaînes `banc.<code>.cmd_….` et `.effet` dans `content/i18n/interface.fr.json` (le libellé est un complément : « sous les couleurs de …, avec … »).
4. Écrire la suite dans `appliquerConsequences` : `appliquer(cleSourceBanc('<code>'), 'cmd_…', () => { … })` sur le scénario **suivant** — un renfort, `crediterDe(n)`, `ouvrir(replique)` —, avec un locuteur de la distribution de ce scénario. Si l'épreuve d'origine doit changer une réplique sous ce banc (comme « Tomas tient l'autre banc » au Pacte du col), le faire dans le bloc « le banc de cette épreuve ».
5. Ajouter un cas à `tests/campagne/banc-prete.test.ts`, puis `npm run verifier:campagne` : le pilote joue le défaut, un banc ne doit rien lui casser.

## Les épreuves qui en portent

| Épreuve | Banc | Sur le terrain | Suite, dans l'épreuve suivante |
|---|---|---|---|
| `pacte_du_col` (Qualification) | Tomas Reiner, `lu` | Tomas au camp 0, **Ariane tient son banc** au camp 1 ; Tomas annonce l'échange à l'ouverture | `couleurs_alliees` : un transport de renfort au camp 0 à J2 (case 0,2) et une réplique d'Ariane |
| `aube_batteries_2v1` (essai Aube) | Tomas Reiner, `lu` | Tomas au camp 0, Ariane à l'allié camp 1 | `aube_nuit_2v2` : 1 500 fonds de plus au camp 0 et une réplique de Tomas |
| `aube_nuit_2v2` (essai Aube) | Solveig Tamm, `atl` | Solveig au camp 0, Ariane à sa place au camp 3 (en face) | `aube_routes_3v1` : une réplique d'Ariane sur le convoi |
| `aube_nuit_2v2` (essai Aube) | Wren Osoko, `atl` | Wren au camp 0, Ariane quitte le terrain ; ses consignes passent à Wren | `aube_routes_3v1` : une autre réplique d'Ariane, sur le relevé |

## Vérifié par du code

`tests/campagne/banc-prete.test.ts` (huit tests : schéma, canon, options, décision, graine, échange, moteur et rejeu, branche) ; `npm run typecheck`, `npm run lint`, `verifier:campagne` 24/24, `npm run build`. Rien n'a été regardé à l'écran, par consigne.

## Ce qui n'est pas fait

- Le **catalogue** et le **style visuel** de la nation prêtée : un banc ne prête que le général et ses pouvoirs (`catalogueVersion` reste celui du scénario ; `paysParCamp` prend le code du banc, mais `atl` n'a pas de style, et le Luxembourg n'a pas de modèle propre).
- La **`confiance`** du général ne monte pas : `ProfilCampagne` n'est pas persisté côté client.
- Aucun banc sur les dix tutoriels ni sur l'exhibition (déjà un match d'incarnation) ; aucune `condition` sur un banc — le champ est absent du schéma tant que rien ne l'exige.
- Le pilote de `verifier:campagne` joue toujours le défaut : un banc n'est pas certifié gagnable par simulation.
- La mise en page du choix à 390 px n'a pas été regardée ; elle suit les règles de `.atlas-briefing` sous 600 px (pleine largeur, boutons en colonne).
