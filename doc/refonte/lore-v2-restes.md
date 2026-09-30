# Les restes de l'ancien registre — 27 septembre 2026

Le lore v2 est canon depuis le 26 septembre 2026 (`BRIEF.md`, « Le lore v2 validé »). Deux lots l'avaient fait passer dans les documents canon et dans le contenu du jeu ; ils avaient laissé, hors de leurs fichiers, des documents et des données qui parlaient encore l'ancien monde — « les Jeux Tactiques ont remplacé les guerres », les affrontements non sanglants, le tournoi, le match, la manche, le marquage, le terrain homologué, le matériel de tournoi, le Tableau des délégations, les Rondes qui datent et l'ancienne distribution des commandants. Cette note dit ce qui a été relevé, corrigé et gardé, et porte la proposition pour la section verrouillée `SENSIBILITE` des prompts.

**Méthode.** Les registres vivants et les documents de référence, que liront les prochains rédacteurs et les routines, sont réécrits. Les notes datées ne réécrivent pas l'histoire : elles portent en tête une seule ligne, « Écrit avant la validation du lore v2 (26 septembre 2026) : le registre de guerre de `BRIEF.md` fait foi. » **Aucune clé n'a changé** — flag, chaîne, scénario, identifiant, gabarit, option —, seulement des valeurs et de la prose. « Nouvelle Ronde » reste le nom de la mécanique de second parcours, « Atlas Tournament » le nom du jeu, « hors jeu » la règle du HUD et du Registre.

## 1. Le relevé

Motifs cherchés dans tout le lot : non sanglant, « ont remplacé les guerres », Jeux Tactiques, tournoi, match, manche, marquage, homologué, Ronde, les prénoms de l'ancienne distribution (Aubertin, Hrefna, Gaudenz, Wieke, Stavros, Mizuki, Naran, Pemba, Prasetyo, Rohan Deshmukh, Idir Benhaddou, Aïssatou Ndiaye, Amani Kiptoo, Tuli Shikongo, Voahangy, Dandara, Facundo Iriarte, Nayra, Xóchitl, Émile Tremblay, Marlee Kirkwood, Hana Whitmore, Sitiveni Naicoro…), et les échos sportifs qui les accompagnent (qualification, mondial, vestiaire, coup d'envoi, maillot, stade, tribune, podium, trophée, interview, feuille de match, rencontre). Compte brut, motifs du critère de fin, avant (`373efc46`) et après :

| Fichiers | Avant | Après |
|---|---:|---:|
| `src/serveur/contexte.ts` | 3 | 6 |
| `content/fils/*.json` (9) | 27 | 16 |
| `content/archetypes.json`, `gabarits-missions.json`, `mecaniques.json` | 8 | 0 |
| `doc/refonte/opus1-hors-serie.md` et `.json` | 49 | 11 |
| `doc/refonte/opus1-tutoriels-final.json` et `.md` | 9 | 4 |
| `doc/refonte/direction-artistique-opus1.md` et `.json` | 40 | 35 |
| `doc/00-vision.md` | 29 | 9 |
| `doc/03-schemas.md` | 43 | 18 |
| `doc/04-gameplay.md` | 47 | 20 |
| `doc/06-pays-de-depart.md` | 74 | 49 |
| `doc/07-france-regions.md` | 45 | 7 |
| `doc/09-i18n.md` | 6 | 1 |
| `doc/12-au-dela-advance-wars.md` | 24 | 0 |
| `doc/13-campagne.md` | 87 | 46 |
| `content/styles/*.json` (19) | 31 | 2 |
| `scripts/lore-html.mjs` | 1 | 2 |
| **Total** | **523** | **226** |

Le compte d'après n'est pas un reste d'ancien monde : c'est ce qui doit rester, et le §3 le range. Les hausses sont voulues : `contexte.ts` cite « match », « manche » et « tournoi » pour dire qu'ils ne disent plus la guerre ; la direction artistique compte des **manches** de vestes et des lunettes **rondes**.

## 2. Ce qui a été corrigé

- **Ce que lisent les routines** (`c956ad14`). `extraitsBible()` (`src/serveur/contexte.ts`) servait encore « sport de haut niveau, jamais la guerre ; on dit match, manche » : il sert la guerre de l'énergie, l'engagement et le front, ce qu'une victoire prend, la guerre qui tue sans gore, le « hors jeu » du Registre, aucune mort écrite par une routine, l'an 14 et le mot expliqué à sa première apparition. Huit des neuf fils, les archétypes (deux bustes de commandant régénérés, 948 specs à jour), les gabarits (l'exhibition devient un exercice court à charges à blanc) et la mécanique des puys.
- **Les registres de l'opus 1** (`88895c1a`). Hors-série : la borne des quatre disparitions dite dans les mots du lore v2 — jamais sur un front, jamais par une arme, jamais un homicide commis par une personne identifiée —, la règle du Registre au lieu du marquage, le Tableau des belligérants et la plaque posée à plat, cinq titres alignés sur `lore-v2.json`, les 28 situations sans tournoi ni manche ; qui meurt, où, quand et qui reprend le banc ne bougent pas. Exercices et finales : l'école du front à charges à blanc, et les révélations validées. Direction artistique : la tenue de terrain civile au lieu de la sélection sportive, et les **quatre adjointes** du registre (Dafni Rallis, Anju Basnet, Léa Wagener, Nadia Berrada) — 41 fiches.
- **Les documents de conception** (`585bcacc`), numérotation gardée. `00` : la vision de la guerre de l'énergie ; la doctrine du marquage barrée. `03` : Ariane Belloc en exemple de `Commander`, avec son kit de la révision 4 ; la onzième condition `decision` au §15.5, renvoyée à `13-campagne.md` §8.2 ; mission et bataille au lieu de match. `04` : le rappel de ton, la décision aux points (les « quatre manches » ne sont plus qu'une expression, `01-bible.md` §4.3), l'égalité parfaite, où la concession ne change pas de main. `06` : la note de sensibilité d'une guerre fictive, les anecdotes de rivalité dites entre armées, les fonctions et styles des commandants réalignés sur `personnages.json` et `commandants-capacites.json`. `07` : Ariane au §1, la campagne de France région par région au lieu de la qualification, l'étape finale au lieu de la finale nationale, Vantour au Bulletin au lieu du commentateur, les clins d'œil d'avant-bataille. `09` : le principe du §1 aligné sur le glossaire réécrit — « ennemi » se dit dans la fiction depuis le 10 septembre, le glossaire garde « hors jeu » —, l'exemple japonais et le prompt d'amorçage de `atlas_traduction`. `12` : le rapport de bataille, le draft comme déclaration des armes, l'effectif qui dure au lieu du banc de touche. `13` : les quatre fins de `08` §7 — le lot de lancement n'en garantit qu'une, « La couronne électrique » ; la porte d'Ost « par une fin » est tombée avec les fins de l'ancien canon ; les fils et les gabarits en miroir du contenu ; une note date la structure par continents, que le lore v2 ne suit plus.
- **Les anciens prénoms** (`4bfa4833`). Dix-neuf justifications de style citent le commandant du registre par un trait de sa biographie, raisonnement de matières et de couleurs inchangé. Saran Bat croit désormais au féminin — le seul pronom touché dans `content/personnages.json`.
- **L'atlas du lore** (`398008a9`). La page dit « lore v2 validé le 2026-09-26 » (lu dans `lore-v2.json`) ; le commentaire et les replis ne parlent plus d'une proposition.
- **Dix notes datées** (`20d359cb`) portent la ligne d'en-tête : `scenariste.md`, `scenariste-novateur.md`, `roster-jouable.md`, `tutoriels-jouables.md`, `joueur-advance-wars.md`, `banc-prete.md`, `saison1-suite-septembre.md`, `routines.md`, `quetes.md`, `campagne-fr10-12.md`. Ne sont pas marquées les notes dont les seuls échos sont du jargon de partie (« par match » dans les mesures de `pouvoirs-v4.md`, le match comme partie en cours dans `game-design-systemes.md`, `catalogue7.md` et `cadence-reprise.md`) ou de faux amis (lisières rondes, manche à air).

## 3. Ce qui est gardé, et pourquoi

- **Des clés.** Les flags `monde.tournoi.*` (`serie_propre`, `fils_termines`, `matchs_sans_perte`, `pacte_du_col`, `aube_*`), `pays.<xx>.qualifie`, et ceux qui portent un ancien prénom ou un ancien mot (`pays.is.silence_de_hrefna`, `pays.nl.pari_avec_gaudenz`, `pays.in.charriage_avec_marlee`, `pays.gr.cafe_avant_match`, `pays.ke.match_de_trois_heures`, `pays.au.tribune_partagee`) ; l'easter egg `mur_du_vestiaire` ; le gabarit `exhibition` ; le statut d'unité `homologuee` ; la catégorie d'actualité `competition_sportive` ; le locuteur `commentateur` ; la clé `scen_finale_europe`. Un identifiant ne change pas pour un mot.
- **Des noms.** Nouvelle Ronde et match d'incarnation (mécaniques) ; Atlas Tournament ; « hors jeu » ; la Cinquième Manche ; la Commission d'homologation et le front homologué, que la bible emploie ; le vestiaire, l'écran des seize commandants ; la délégation, que la bible prescrit à la place de « gouvernement » (`01-bible.md` §5.2).
- **Des faux amis.** La Manche (la mer), les manches (des vestes), rondes (l'adjectif), le circuit du Mans (`meca_circuit`), la disqualification d'Ost, le « score » de la décision aux points et des défis, le marquage d'un convoi exceptionnel ou d'un hayon (les deux restes des fiches de style).
- **La culture sportive d'un pays réel**, que la charte de sensibilité garde (`01-bible.md` §7.2, « Sport et jeu ») : le maillot du Messager du Rift (Kenya, en accord avec sa fiche de style), le maillot à pois, le rugby, la pelote, le football sur la plage, la course de vingt-quatre heures, le stade en couronne de l'Île-de-France comme repère ; et les catégories d'actualité réelles de la Dépêche (« compétition sportive », « exploit sportif »).
- **Des phrases qui disent l'ancien registre pour le dire tombé** : `contexte.ts`, l'en-tête de `00` et son §6 n° 3 barré, les « quatre manches » de `04` §9.1, le §0 de `opus1-hors-serie.md`, la clé de `13` §7.4 qui « garde son ancien mot ».
- **L'historique voulu** : le tableau des archétypes de `06` §2 et sa note (distribution du 5 septembre), la table « Ancienne distribution » de `06` §5.
- **Par consigne** : `13-campagne.md` §5.2 (« prochain match principal », « un match principal », « une nation de la Ronde », « une suite de matchs ») et §8.2 (« le choix de fin de match de `opus1_fr_04` ») n'ont pas été touchés. À reprendre la prochaine fois que ces deux paragraphes bougent : « prochaine mission principale », « une mission principale », « de la guerre », « une suite de missions », « le choix de fin de mission ».
- **La structure de `13`** (119 missions, trois continents, finales continentales) : elle est la méthode de budget du 5 septembre ; une note la date, elle n'est pas refaite.

## 4. La proposition pour `VERROU_SENSIBILITE`

`src/serveur/prompts.ts` n'est pas modifié : le brief exige qu'un changement de prompt soit versionné et validé par un humain, et une section verrouillée ne se réécrit que par un humain (`05-routines.md` §5.4). Aujourd'hui, les cinq prompts de référence (version 3) disent encore « une guerre d'influence disputée par tournois », « les unités et équipes sont MISES HORS JEU » et « éliminer les unités adverses de la manche, jamais tuer leurs équipages » ; `05-routines.md` §0 bis les déclare en retard sur le registre.

**Le texte proposé**, entre les marqueurs, à la place de l'actuel (les six dernières puces sont inchangées) :

```
<<<VERROU:SENSIBILITE>>>
- La guerre est FICTIVE : la guerre de l'énergie, que les nations se livrent pour
  l'énergie sous toutes ses formes et pour l'avance technique, et qu'Atlas arbitre
  par le Pacte du Terrain. Les pays réels ne servent jamais à raconter un conflit
  réel. La faction inconnue reste fictive et sans nationalité réelle déduite de son
  apparence, de sa langue ou d'un cliché.
- Une victoire prend des sites, des richesses, des savoirs et le terrain tant qu'on
  le tient ; entre les nations, jamais les habitants. La guerre se dit sans gore :
  ni sang, ni corps, ni ruines, ni civils. Au Registre et sur le HUD, une unité est
  MISE HORS JEU.
- Tu n'écris JAMAIS une mort : aucun personnage, aucun équipage ne meurt dans ce que
  tu inventes, et aucune disparition n'y est déclarée, suggérée ni prolongée ;
  traduire fidèlement une phrase écrite à la main n'est pas en inventer une. On date
  en années (« an 14 »), jamais en Rondes.
- Liste noire pour l'actualité : conflit armé réel, politique, élection, religion,
  catastrophe, accident, criminalité, crise, personne réelle nommée ou imitée.
- Liste blanche pour l'actualité : compétition sportive, festival, météo saisonnière,
  découverte scientifique civile, exploration, culture, exploit sportif.
- Une référence scientifique réelle comme ITER reste un fait documenté fourni par
  le serveur. Ne lui attribue ni complot, ni prise de contrôle réelle, ni production
  commerciale imaginaire : l'installation convoitée de la fiction a son propre nom.
- Ne révèle que ce que le contexte autorise à ce stade de la campagne. Les secrets
  non servis, dont doc/14-secrets.md, ne sont jamais demandés ni reconstitués.
- Les nationalités ne déterminent ni la morale ni la personnalité des personnages.
- Lis GET /api/routines/bible/personnages?acte={0..3} pour les faits autorisés. Ne demande pas un acte supérieur à la mission. Les motivations privées et les croyances ne sont accessibles qu’à l’acte III ; une croyance ne vaut jamais fait.
<<<FIN VERROU:SENSIBILITE>>>
```

Trois choix à valider. « La faction inconnue » reste anonyme dans le verrou, parce que `CLARTE_NARRATIVE` ne laisse nommer la Cinquième Manche que si le contexte de mission l'autorise. Les listes d'actualité ne bougent pas : « compétition sportive » et « exploit sportif » sont des catégories d'événements **réels** servis à la Dépêche, pas le monde du jeu. Et la règle « aucune mort » dit « ce que tu inventes » plutôt que « ce que tu produis », sans quoi `atlas_traduction` pourrait adoucir une phrase écrite à la main (« l'équipage n'est pas rentré ») au lieu de la traduire.

**Hors verrou, une ligne du corps de `atlas_lore`** (vers la ligne 144) dit encore « Le ton mêle rivalité sportive, choix difficiles et tension sur l'accès à l'énergie. » Proposé : « Le ton est celui d'une guerre sérieuse, dite sans gore : rivalités, choix difficiles, tension sur l'énergie et l'avance technique. » (la phrase suivante, sur les enjeux concrets, peut rester).

**Version et empreintes.** `DEFAULT_PROMPT_VERSION` passe de **3 à 4**. Empreintes calculées par `empreintesSections` elle-même, identiques sur les cinq corps : `SECURITE` inchangée, `fb8fbf07f5b10b48bbdca84631cf1914c83737874e93cd4a4166a56fa1f35114` ; `SENSIBILITE` v3 `d649e0a52fb3533093e6724bafa0ef899cdb08ac44ec29bd2fea1946db3b79ae` → v4 `edeec16ae23c945897a1d02cdf6a53bc104917e7822859aca04fab1e7cc0606a`. Une candidate de routine portant le verrou v4 est refusée `VERROU_ROMPU` tant que la base sert la v3 (vérifié par `verifierVerrous`) : c'est le comportement attendu, le changement passe par la version de référence et non par une candidate. À la première lecture d'un run, `promptDeRun` écrit la version `max(4, version max + 1)` avec ses nouvelles empreintes et la promeut — sauf si la base sert déjà une version ≥ 4 (un prompt personnalisé), qu'il faudra alors reprendre à la main.

**Ce qu'il faut mettre à jour avec.** `tests/serveur/prompts.test.ts`, le test « les prompts v3 distinguent… » : son nom (v4), `assert.equal(DEFAULT_PROMPT_VERSION, 4)`, `assert.match(corps, /guerre de l'énergie/)` au lieu de `/guerre d'influence/`, et, pour que le recul ne passe pas en silence, `assert.doesNotMatch(corps, /tournois|jamais tuer leurs équipages|rivalité sportive/)`. Rien d'autre ne fixe le texte : `/api/routines/contrat` expose `DEFAULT_PROMPT_VERSION` sans que son test la fige. `doc/05-routines.md` (hors de ce lot) dira la version 4 à la ligne qui dit « version 2 pour Aube ».

## 5. Hors lot : ce qui reste, et où

1. **`content/personnages.json`** — les quatre faits `cmd_tomas_reiner_disparition`, `cmd_samir_el_hadi_disparition`, `cmd_nikos_delis_disparition`, `cmd_mira_karki_disparition` (confidentialité auteur) disent encore « Jamais sur un terrain homologué, jamais par du matériel de tournoi, aucune personne identifiée n'en est l'auteur. » Proposé, la borne de `BRIEF.md` : « Jamais sur un front, jamais par une arme, jamais un homicide commis par une personne identifiée. » Ce lot n'avait le droit que d'un pronom dans ce fichier.
2. **Régénérer** `npm run roster:heros` (Saran au féminin, et les fonctions « de la délégation mongole »… que `personnages.json` a déjà quittées) et `npm run fil:opus1` puis `scripts/fil-opus1-html.mjs` : cinq titres de hors-série et les apprentissages et révélations des exercices et des finales ont changé dans les registres que le fil lit.
3. **`doc/refonte/opus1-nations.json` et `.md`** (l'agent du Luxembourg y travaille) : `opus1_sn_11` s'appelle encore « Le match des garanties » quand `lore-v2.json` l'a validé « Les garanties à l'épreuve » ; le `.md` dit aussi « finir le match », « sa participation au tournoi » et « le terrain de tournoi » (forçage météo).
4. **`content/styles/fr.json`** : la décalcomanie « Trois obliques courtes reprises du maillot de la qualification nationale » et la justification « le damier d'arrivée, qui vient de la course par étapes de sa qualification » — proposé : « reprises de la tenue de l'école du front » et « qui vient de la course par étapes, le style d'Ariane Belloc ». **`content/styles/regions/fr/centre_val_de_loire.json`** : « le style le plus soigné de la qualification » / « of the qualification » → « de la campagne de France » / « of the French campaign ». Aucune spec d'asset ne recopie ces phrases.
5. **`doc/refonte/supers-vilains.json`** : « il part une fois par match » et la réplique de Vantour « Un appareil qui tombe sur un terrain homologué — je n'ai pas de mot pour ça, et j'ai commenté quatre Rondes. » Proposé : « Un appareil qui tombe sur un front déclaré — je n'ai pas de mot pour ça, et j'ai raconté quatorze années de guerre. »
6. **`src/serveur/prompts.ts`** et son test : §4 ci-dessus.

## 6. Vérifié, et non vérifié

**Vérifié par du code** : `npm run typecheck` sans erreur ; ESLint sur `src/serveur/contexte.ts` et `scripts/lore-html.mjs` ; `tests/schemas/*` 264/264 ; `tests/serveur/*` 140 verts sur 142, un sauté, un rouge qui est dans la référence (« API privée : authentification, dépôt brut… ») ; `tests/assets/styles.test.ts` 9/9 ; `generer-specs-assets --verifier` 948 à jour ; `npx tsx scripts/verifier-campagne.ts` 48/48 avec rejeu conforme ; `npm run lore:html` construit la page (200 épisodes, 79 décisions) ; `npm test` 1 897 cas, **31 rouges, les 30 noms de la référence exactement**, un sauté ; les tableaux Markdown des huit documents gardent leurs colonnes ; les §5.2 et §8.2 de `13` sont identiques à l'octet. **Non vérifié** : la lecture à l'écran de la page du lore, et la proposition de verrou, qui n'est pas appliquée.
