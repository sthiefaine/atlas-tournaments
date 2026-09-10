# Registre des personnages et capacités — révision 4

## Révision 4 — 10 septembre 2026

**Ce qui est dans le jeu.** Les 34 kits de `doc/refonte/pouvoirs-v4.json` sont transcrits tels quels dans `content/commandants-capacites.json` (`version: 4`) ; la révision 3 est gelée à l’octet dans `content/commandants-capacites-v3.json` et reste servie aux scénarios qui la déclarent (`lireProfilCommandant(cle, 3)`, `chargerCommandantJeu(cle, 3)`, clés `_v3`). Les annotations de conception `archetype` et `familles` sont tombées ; `faiblesse` et `replique` sont gardées. Les 34 kits passent `validerCommander` sans qu’une valeur ait dû être ramenée à la marge, et la forme `paysCode: 'atl'` du document devient `faction`/`organisation` comme en révision 3. `chargerCommandantJeu(cle, 4)` rend passif, pouvoir, super **et faiblesse**, noms sous `commandant.<cle>.pouvoir_v4` / `super_v4`. Le serveur simule désormais avec les commandants du scénario (`commandantsDeSimulation`, `src/serveur/simulation.ts`) au lieu d’une liste vide ; le `cmd_neutre` d’un scénario minimal reste sans commandant. `VERSION_MOTEUR` passe à **7** : `chance` et `etoiles` changent le rejeu, les sauvegardes antérieures sont périmées.

**La faiblesse joue.** Le moteur ne l’appliquait pas : `CommandantMoteur.faiblesse` est posée à la création de l’état comme le passif, permanente, sous la `SourceModificateur` **`faiblesse`** (`src/engine/etat.ts`). Elle coûte réellement — Ariane touche 90 % de ses revenus dès la journée 1, les chenilles de Tomas frappent à 90 % — et elle survit aux tours. Testé dans `tests/engine/commandants-v4.test.ts`.

**Quels scénarios.** `commandantsVersion: 4` et `version` incrémentée sur vingt et un scénarios : `opus1_tutoriel_05` à `_10`, `pacte_du_col`, `couleurs_alliees`, les cinq essais `aube_*` (batteries, nuit, relève, réserves, routes), `aube_convoi_secondaire`, `aube_archives_secondaire`, `aube_essais_drones`, `aube_drone_marin`, `aube_essai_maritime_iem_climat`, `demo`, `archipel_des_deux_rades`, `bras_de_mer`. Les quatre premiers tutoriels (`premier_contact`, `villes_du_bocage`, `chantier_des_usines`, `qg_de_la_presquile`) restent en révision 1 : on n’y a pas de jauge utile. La révision par défaut d’un scénario sans `commandantsVersion` ne change pas (1, ou 2 à partir du catalogue 7). Le banc prêté (`src/app/campagne/bancs.ts`) lit la révision 4 : Tomas prêté au pacte du col joue son kit v4 et porte sa faiblesse.

**Mesures.** `npm run verifier:campagne` : **24/24**, rejeu conforme, aucun ajustement de barres ni de valeur n’a été nécessaire. `scripts/simuler.ts` sur `plaine.json`, 20 parties, graine 1, catalogue 6, **pondérée contre pondérée** pour ne mesurer que les kits (témoin sans commandant : 45/55) : Ariane contre Tomas **95/5** (et 5/95 dans l’autre ordre), Ariane contre Noémie (météo) **100/0**, Ariane contre Awa (réactiver) **95/5**, Ariane contre Devika (prix) **100/0** ; pondérée contre agressive, Ariane l’emporte 100/0 dans les deux ordres. Le motif n’est pas Ariane : les kits qui portent un `soin` sont équilibrés entre eux (Ariane–Samir 65/35 puis 40/60, Nikos–Ariane 40/60), les kits sans soin le sont entre eux (Tomas–Noémie 55/45, Awa–Devika 55/45), et **tout kit sans soin perd 95 à 100 % contre un kit à soin**. C’est l’IA : elle déclenche un pouvoir dès qu’un soin rend trois PV, et ne sait pas juger une météo, un mouvement, un prix ni une réactivation (`doc/04` §7.2, « L’IA joue ses pouvoirs »). Signalé, non corrigé : la campagne tient, et le remède est dans `src/ai/pouvoirs.ts`, pas dans les barres.

**Non fait.** L’IA `ponderee` ne lit toujours pas l’axe de faiblesse adverse (`doc/04` §7.3 le promet). Les clés i18n `_v4` et `faiblesse_v4` / `passif_v4` appartiennent au chantier de l’affichage.


Le registre administratif `/admin/personnages` réunit 37 personnages : les 24 commandants nationaux (12 nations au premier plan), les huit commandants de la faction adverse, Solveig et Wren pour Atlas, et les trois personnages civils Nera, Osmin et Célestin.

Chaque fiche conserve une motivation, une croyance, des liens et des faits historiques datés dans le calendrier fictif. Les commandants disposent d’un profil tactique, d’un contre-jeu, d’un pouvoir et d’un super-pouvoir chiffrés. Les civils conservent un rôle narratif sans devenir artificiellement des commandants.

## Source des capacités

`content/commandants-capacites.json` est la source des profils de révision 3. L’admin et `chargerCommandantJeu` lisent les mêmes effets. Les coûts de jauge et durées sont affichés avec la description ; les effets techniques se déplient pour vérification.

`Scenario.commandantsVersion` sélectionne explicitement une révision (1, 2 ou 3). Son absence conserve le comportement historique lié au catalogue. Les scénarios déjà livrés ne sont pas basculés silencieusement : les tutoriels et leurs sauvegardes gardent leurs règles. Toute modification ultérieure d’une mission pour adopter les nouvelles capacités doit aussi augmenter sa version.

Le catalogue repose sur les modificateurs déjà exécutés par le moteur. Une doctrine narrative autour de l’IEM ou du climat ne crée pas implicitement un nouveau pouvoir de contrôle météorologique. Les réglages sont une première base chiffrée, pas une homologation d’équilibrage humain.

## Secrets

L’admin est un espace auteur et montre les révélations avec leur statut. Le contexte des routines est composé explicitement côté serveur. Les faits `confidentialite: auteur` restent privés ; les faits à jalon ne sont jamais débloqués par un simple numéro d’acte. La parenté cachée et le pivot père-fils ne doivent pas être déduits d’un champ de fonction public. L’API actuelle par acte ne permet pas de forcer le jalon S5E4 : cette autorisation demandera la progression serveur correspondante.

Le fichier des histoires n’est pas servi par la route générique du canon. Les textes publics des capacités ne contiennent ni parentés ni notes d’auteur.

## Les supers des Gris — 10 septembre 2026

`content/commandants-capacites.json` porte les huit supers du scénariste (`doc/refonte/supers-vilains.json`) et, sur chaque Gris, `piece { nom, silhouette }` — champ facultatif de `ProfilCommandant`, lu par l'admin et le carnet, jamais par le moteur ; `scripts/simuler.ts` déclare la faction du camp d'un Gris (`factionsDesCommandants`) et compte ses déclenchements (`compterDeclenchements`), sans quoi les familles `frappe_zone`, `rayon_laser` et `iem` étaient refusées en simulation et invisibles.
Crans retenus par la mesure : Ost 7 barres, Basile 7, Maël 5 barres et 4 PV ; les chaînes `super_v4`, `super_v4_desc` et `replique_super_v4` des huit Gris se réalignent depuis le contenu par le chantier de l'affichage, et `tests/i18n/pouvoirs-v4.test.ts` reste rouge d'ici là.
