# Premiers matchs — livraison des cinq axes

## Parcours jouable

`/campagne` est le point d’entrée. Quatre manches sont des **entraînements au centre Atlas**, chacune sur son propre terrain et son propre biome, puis viennent la qualification du col et l’exhibition sous les couleurs du Luxembourg. Ce petit parcours introduit la Ronde ; il ne remplace pas l’ambition des dix-huit régions françaises.

Le manifeste `content/campagne.json` donne l’ordre, les explications, les objectifs et les tutoriels. Chaque mission possède son scénario et sa carte dans `content/`. Le carnet ouvre l’étape suivante après victoire et conserve une progression **locale au navigateur**, sans base ni classement en ligne. Les URLs directes restent utilisables pour tester une mission.

Refonte du 5 septembre 2026 : les quatre entraînements partageaient deux cartes de plaine vide et faisaient « allumer des balises ». Un tutoriel d’Advance Wars apprend à se battre, à prendre des villes, à recruter, puis à prendre le QG ; c’est désormais l’ordre.

1. **Premier contact** (`premier_contact`, plaine, 12 × 10) : une rivière, un pont, une patrouille en face. Mettre hors jeu les trois unités de Tomas. Déplacer, frapper en premier, riposte, couvert. Le second QG de la carte est neutre : le validateur en exige un par camp, et un QG possédé par l’adversaire rendrait `hors_jeu_total` inaccessible (un QG produit).
2. **Les quatre villes** (`villes_du_bocage`, forêt/bocage, 12 × 10) : quatre villes, deux ponts, une rivière. En tenir trois en même temps. Capture en deux tours, revenus, recrutement au QG, et une ville **désaffectée** qu’une infanterie remet en service en quatre tours.
3. **Le chantier des usines** (`chantier_des_usines`, désert, 12 × 10) : deux usines désaffectées, au centre et à l’est. Le génie les remet en service en deux tours ; Tomas y envoie son infanterie (quatre tours). Production à l’usine, artillerie, char léger, prévision de duel.
4. **Le QG de la presqu’île** (`qg_de_la_presquile`, côte, marées, 12 × 10) : prendre le QG de Tomas. Quarante points de capture, quatre tours d’infanterie intacte ; la grève s’ouvre à marée basse, le pont du sud passe toujours. Bulletin, pouvoir de commandant.
5. **Le pacte du col** (`pacte_du_col`, montagne) : inchangé — ouvrir un passage avec le génie, protéger le char, gagner l’alliance.
6. **Sous les couleurs alliées** (`couleurs_alliees`, montagne, 12 × 10) : incarner Tomas et tenir en même temps les trois **postes d’arbitrage** (des villes) d’une vallée à deux cols. Les balises ont disparu de la campagne ; l’objectif `relais` reste dans le moteur pour les fils de région.

Reiner bénéficie d’une défense passive ×1,1, d’un pouvoir défense ×1,25 et d’un super défense ×1,5 avec mouvement +1. Le rendu 3D reçoit les pays des camps pour leurs styles.

## Règles

- **QG à 40 points** : `seuilCapture` (`src/engine/regles/capture.ts`) double le seuil pour le QG et pour un bâtiment désaffecté ; `SEUIL_CAPTURE` reste l’unité de compte à 20.
- **Bâtiments désaffectés** : `MapDef.desaffectes` → `EtatPartie.desaffectes` (clés de case). Neutres, sans revenu ni production. Remise en service par capture à 40 points : le génie gagne le double de ses PV affichés (deux tours), l’infanterie et la méca le rythme normal (quatre tours). Événement `remise_en_service` (avec la prime : 1 000 fonds, 2 000 pour le génie) puis `capture` acquis. Aucune destruction : un bâtiment ne redevient jamais désaffecté (`doc/04` §6 bis).
- **L’IA ne bouche plus son QG** : elle ne produit sur son QG que si aucun autre producteur n’est libre, ou si un capteur adverse est à huit cases ou moins (`RAYON_MENACE_QG`). Sans cela, une recrue posée chaque journée sur le QG le rendait imprenable, et `capture_qg` n’avait plus de sens. Mesuré sur `relief.json` : le taux de victoire pondérée contre agressive passe de 40/50 à 39/50.
- Escorte : `proteger` porte `uniteRef` et `destination`. L’unité elle-même doit atteindre cette case sans être embarquée.
- Relais : `relais.cases` est une séquence de balises occupées par une unité amie ; la progression est conservée dans l’état et dans les rejeux. Plus aucune mission de campagne ne l’utilise.
- Survie : l’objectif se déclenche après N journées entières, au début de N+1. Éliminer l’adversaire ne court-circuite pas une discipline qui n’autorise pas cette victoire.
- Tenir signifie contrôler les points à l’échéance, pas les conserver N journées consécutives. Pour imposer leur maintien, ajouter une défaite `case_perdue`.
- Génie : case adjacente libre, 1 500 fonds et une action, pour poser un pont sur une rivière ou ouvrir une route en montagne. Les ouvrages sont permanents.

## Catalogue 3 : drones, brouilleur, station radar

`content/unites.json` passe en `catalogueVersion: 3` ; une unité homologuée déclare sa version d’accueil (`homologation.catalogue`), et `chargerCatalogue(2)` ne voit jamais les unités du 3 — un rejeu du 2 reste exact. Le terrain `radar` (`T`) est le cinquième bâtiment capturable. Règles en `doc/04` §10 bis : drone (3 000, brouillable), drone filaire (12 000, ne se brouille pas), brouilleur mobile (5 000, dix cases), station radar (vision 5, brouillage à douze cases, revenus 500). Un drone brouillé garde un dixième de sa vision ; un drone mis hors jeu au-dessus d’un bâtiment adverse révèle à son camp tout ce que ce camp a produit (`production_revelee`). Les rayons sont ceux demandés par le propriétaire du jeu ; sur une carte de douze cases de large, une station couvre toute la carte. Aucune mission de campagne n’en met encore en jeu : c’est un vocabulaire prêt pour les fils de région et la Dépêche.

## Biomes et rendu

Dix profils de génération décrivent leurs décisions tactiques : espaces ouverts, couvert, cols, soutien rare, rivières et passages à marées. Le désert et les plateaux volcaniques n’engendrent plus de forêts ; côtes et archipels activent les marées par défaut. Les réglages explicites des cartes restent prioritaires. Les quatre environnements de la campagne sont plaine, bocage/forêt, désert, côte, plus la montagne des matchs officiels.

Rendu 3D (5 septembre 2026, soir) : les **voies** sont continues (bout, droite, virage, T, croix), habillées par biome (bitume, sentier, pavés, sable tassé, chaussée déneigée, basalte, planches), et le **pont** est un ouvrage — tablier, parapets, piles, ombre sur l’eau (`src/render3d/textures-voies.ts`, `geometrie.ts`). Chaque biome a son **paysage** (`src/render3d/paysage.ts`, 54 accessoires : haies, moulin, cactus, cocotiers, fumerolles, phare, mangroves…) et sa ligne de rivage. La **capture** hisse les couleurs sur un mât permanent par bâtiment ; un bâtiment occupé devient translucide au lieu de s’aplatir. Un bâtiment désaffecté se lit comme hors service, jamais comme une ruine.

## Versions et validation

- Moteur 3 : les sauvegardes du moteur 2 ne sont plus proposées en reprise ; le seuil du QG et les bâtiments désaffectés changent les règles.
- Catalogue 3 : drones et brouilleur. Le catalogue 2 conserve ses onze unités, le 1 ses dix.
- Générateur 2 : profils tactiques et géographie révisés. Il ne pose ni station radar ni bâtiment désaffecté : c’est une décision de carte écrite à la main, ou de la routine map quand elle sera branchée.
- `npm run verifier:campagne` gagne les six missions par des actions légales, contre l’IA du scénario, avec les mêmes commandants et graines que l’interface. Trois joueurs simples sont essayés dans l’ordre — une heuristique d’objectif, l’IA pondérée, l’IA agressive — et le premier qui gagne fait la démonstration ; le rejeu de sa partie est vérifié à l’empreinte. Cela démontre une solution ; ce n’est pas une mesure de difficulté humaine. Résultat du 5 septembre : contact 6 journées, villes 9, chantier 6, presqu’île 14 (pondérée), col 3, couleurs 11 (pondérée).

La production de nouvelles missions par les routines Claude et leur publication depuis Postgres restent un chantier distinct. Cette livraison est intégralement jouable depuis le canon local.

## Interface et rendu mobile

Le briefing avance par répliques avant le déploiement. L’objectif et l’aide restent accessibles via le bouton mission, sans panneau persistant sur la carte. Les ordres tactiles se présentent en bas de l’écran ; le pouvoir utilise une jauge segmentée et le changement de tour une bannière temporaire. L’ordre « Remettre en service » apparaît à la place de « Capturer » sur un bâtiment désaffecté.

La carte se parcourt par glissement (un doigt ou souris gauche), avec pincement et boutons de zoom. Le cadrage initial vise environ 64 pixels par case au centre, le recul est limité pour conserver environ 48 pixels. Les cartes peuvent dépasser le champ. Le bouton cible recentre sur l’unité sélectionnée ou la première unité alliée.

`/atelier` permet d’explorer trois cartes, dix palettes de biome et les ambiances jour/nuit/météo, et son banc d’essai montre les treize terrains, les cinq bâtiments et les quatorze unités du catalogue 3. `/admin/assets` liste les 681 spécifications d’assets générées depuis le canon, avec leur priorité et leur fiche ; aucune n’est livrée.
