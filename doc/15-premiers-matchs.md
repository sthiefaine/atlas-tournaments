# Premiers matchs — livraison des cinq axes

## Parcours jouable

`/campagne` est le point d’entrée. Quatre manches sont des **entraînements au centre Atlas**, puis viennent la qualification du col et l’exhibition sous les couleurs du Luxembourg. Ce petit parcours introduit la Ronde ; il ne remplace pas l’ambition des dix-huit régions françaises.

Le manifeste `content/campagne.json` donne l’ordre, les explications, les objectifs et les tutoriels. Chaque mission possède son scénario et sa carte dans `content/`. Le carnet ouvre l’étape suivante après victoire et conserve une progression **locale au navigateur**, sans base ni classement en ligne. Les URLs directes restent utilisables pour tester une mission.

1. Premier fanion : sélectionner, déplacer, capturer en deux actions, passer le tour.
2. Relais des haies : occuper trois balises dans l’ordre, exploiter le couvert.
3. Témoin des marées : conduire une unité précise à sa destination.
4. Tenir la digue : survivre quatre journées complètes.
5. Pacte du col : ouvrir un passage avec le génie, protéger le char, gagner l’alliance.
6. Couleurs alliées : jouer Reiner et la délégation luxembourgeoise.

Les briefings présentent le lore sportif et les commandes. Pendant le match, l’aide peut être repliée ; le prochain objectif est surligné. Les débriefings donnent la suite et permettent de rejouer. Reiner bénéficie d’une défense passive ×1,1, d’un pouvoir défense ×1,25 et d’un super défense ×1,5 avec mouvement +1. Le rendu 3D reçoit les pays des camps pour leurs styles.

## Règles

- Escorte : `proteger` porte `uniteRef` et `destination`. L’unité elle-même doit atteindre cette case sans être embarquée.
- Relais : `relais.cases` est une séquence de balises occupées par une unité amie ; la progression est conservée dans l’état et dans les rejeux.
- Survie : l’objectif se déclenche après N journées entières, au début de N+1. Éliminer l’adversaire ne court-circuite pas une discipline qui n’autorise pas cette victoire.
- Tenir signifie contrôler les points à l’échéance, pas les conserver N journées consécutives. Pour imposer leur maintien, ajouter une défaite `case_perdue`.
- Génie : case adjacente libre, 1 500 fonds et une action, pour poser un pont sur une rivière ou ouvrir une route en montagne. Les ouvrages sont permanents. Aucun système de destruction ou de réparation par points de vie n’est livré.

## Biomes et rendu

Dix profils de génération décrivent leurs décisions tactiques : espaces ouverts, couvert, cols, soutien rare, rivières et passages à marées. Le désert et les plateaux volcaniques n’engendrent plus de forêts ; côtes et archipels activent les marées par défaut. Les réglages explicites des cartes restent prioritaires. Les trois environnements de la campagne sont plaine/bocage, côte et montagne.

La 3D utilise toujours les silhouettes procédurales : textures de sol plus sobres, figurines élargies, socles marqués, forêts dégageant le centre des cases et zones techniques autour des bâtiments. Le HUD s’adapte à la largeur de son conteneur. Aucun modèle 3D externe n’a été ajouté. Les 25 spécifications du génie (base et 24 kits) sont générées et vérifiables.

## Versions et validation

- Moteur 2 : les anciennes sauvegardes ne sont plus proposées en reprise par l’interface ; les conditions d’issue ont changé.
- Catalogue 2 : génie homologué, onze unités. Le catalogue 1 conserve ses dix unités et ses possibilités de production.
- Générateur 2 : profils tactiques et géographie révisés.
- `npm test` développe explicitement la liste des tests, de façon compatible avec Node 20 et 22.
- `npm run verifier:campagne` gagne les six missions par des actions légales, contre l’IA, avec les mêmes commandants et graines que l’interface. Il vérifie les rejeux et leurs empreintes. Cela démontre une solution ; ce n’est pas une mesure de difficulté humaine.

La production de nouvelles missions par les routines Claude et leur publication depuis Postgres restent un chantier distinct. Cette livraison est intégralement jouable depuis le canon local.

## Interface et rendu mobile

Le briefing avance par répliques avant le déploiement. L’objectif et l’aide restent accessibles via le bouton mission, sans panneau persistant sur la carte. Les ordres tactiles se présentent en bas de l’écran ; le pouvoir utilise une jauge segmentée et le changement de tour une bannière temporaire.

La carte se parcourt par glissement (un doigt ou souris gauche), avec pincement et boutons de zoom. Le cadrage initial vise environ 64 pixels par case au centre, le recul est limité pour conserver environ 48 pixels. Les cartes peuvent dépasser le champ. Le bouton cible recentre sur l’unité sélectionnée ou la première unité alliée.

Les unités, les bâtiments et les textures procédurales ont été détaillés. Les rotors et les escouades s’animent au repos ; la préférence de réduction des mouvements désactive ces animations décoratives. Les saisons changent feuillage et neige, la pluie produit des impacts, les fenêtres s’allument la nuit. Les géométries sont partagées ou fusionnées pour limiter les appels de dessin.

`/atelier` permet d’explorer trois cartes, dix palettes de biome et les ambiances jour/nuit/météo. Il ne simule aucune action et n’écrit aucune sauvegarde. Changer de biome y modifie la présentation du terrain existant ; cela ne génère pas une nouvelle carte.
