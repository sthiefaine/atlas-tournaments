# Sprites dessinés directement

Décision du propriétaire, 30 septembre 2026 : supprimer les GLB et fabriquer uniquement des sprites. La chaîne de figurines Blender et de cuisson est arrêtée. Le rendu WebGL 2 existant reste en place.

## Première livraison : trois propositions

Un directeur artistique a défini une famille de dessins originaux : infanterie, hélicoptère, char léger. Les trois PNG et les prompts exacts sont sous `assets/direction-artistique/pilotes-sprites-v1/`. Génération par l’outil natif image_gen, fond transparent, palette cobalt / graphite / os. Le propriétaire a accueilli favorablement cette direction (« c’est beaucoup mieux »). Ce sont des poses de référence ; elles ne sont ni des animations complètes ni des livraisons activées. Le bleu représente le camp, pas une nationalité française.

Le contrôle artistique doit se faire aussi à la taille d’une case (48, 64 et 128 pixels), sur sol clair et sombre : visage et arme du fantassin séparés, rotor / queue / patins de l’hélicoptère distincts, chenilles / tourelle / canon du char lisibles. Les angles des trois propositions restent à harmoniser au contrat de carte. Une grande illustration ne prouve pas cette lisibilité.

Les six déclinaisons France / Chine demandées ensuite sont sous `assets/direction-artistique/variantes-fr-cn-v1/`, avec leur jeu de prompts et les références utilisées. France : bleu, écru et détails rouges discrets ; Chine : vermillon, graphite et sable. Ce sont des propositions d’équipement fictif, sans drapeaux ni insignes réels. La Chine n’a pas de fiche dans le roster actuel : ces dessins ne modifient pas le roster ni la campagne.

## Collection commune

Le propriétaire a approuvé les pilotes et leurs déclinaisons, puis demandé toutes les unités de base, les bâtiments et une proposition de forêt. `assets/direction-artistique/collection-base-v1/plan.json` liste 37 dessins : les 30 unités du catalogue (trois pilotes réutilisés et 27 créations), ville, QG, usine, port, aéroport, radar et forêt mixte. Les PNG transparents et les prompts exacts sont conservés dans ce dossier. Les unités communes reprennent le cobalt, le graphite et l’os ; les trois unités méridiennes utilisent l’argent, le graphite et l’ambre. Aucune nouvelle nation ou variante régionale n’est créée.

Le propriétaire a ensuite approuvé le reste de cette collection à l’exception du drone intercepteur (« le drone intercepteur est à refaire, le reste est bien »). Celui-ci est redessiné avec un fuselage court, une grande voilure, une queue à deux branches et un propulseur arrière ; la précédente silhouette trop proche d’un missile est remplacée dans la collection.

## Biomes, ponts et extension commune

La demande de poursuivre par les biomes et les ponts porte le plan à **98 dessins présents**, dont 61 ajouts :

- Dix accents de biome : plaine, forêt, montagne, désert, jungle, neige, volcanique, côtier, archipel et marais.
- Neuf modules de pont : travée, culée et pile pour les familles pierre, bois et métal.
- Sept études de terrain : plaine, herbe haute, montagne, route, plage, rivière et mer.
- Dix rochers de biome et huit accessoires : haie, buisson, roseaux, touffe, céréales, paille, muret et ponton.
- Sept états de bâtiments : superusine active et inerte, ville/usine/port/aéroport/radar désaffectés.
- Dix portraits d’archétypes génériques existants ; aucune nouvelle identité de héros, révélation ou modification de campagne.

Les 36 dessins approuvés restent identiques. Les nouveaux dessins et la reprise de l’intercepteur n’héritent pas automatiquement de cette approbation. La plaine est une étude de végétation, pas un remplacement du terrain procédural préféré par le propriétaire. Les ponts forment des propositions de pièces : leurs raccords exacts sur la grille ne sont pas encore vérifiés. Les portraits coupés en bas sont cadrés en buste ; aucun décor ni sommet d’arbre livré ne touche le bord selon le relevé alpha.

Les prompts exacts sont conservés par famille dans `prompts-terrains.json`, `prompts-decors.json`, `prompts-batiments-speciaux.json` et `prompts-portraits.json`. `corrections-environnement.json` conserve les reprises de cadrage et de détourage, leurs sorties natives et les essais écartés. `provenance.json` associe chaque création au PNG retenu. `verification.json` relève les dimensions, les empreintes, les marges et le canal alpha des 98 PNG, soit 115 848 008 octets (110,48 Mio) de références HD. Ce poids concerne la bibliothèque de fabrication, pas un téléchargement ajouté aux parties. Des halos RGB visibles dans certains aperçus de génération se trouvent hors de la silhouette avec un alpha nul ; le canal alpha est conservé.

La galerie privée `/admin/assets/dessins` propose catégories avec compteurs, recherche, familles, domaines terre/air/mer, filtre de biome, fonds clair/sombre, formats 48/64/128 pixels et grand aperçu, ainsi que le téléchargement individuel. Le dossier est inclus dans l’image Docker. Le typage et la lecture des PNG sont contrôlés ; aucune suite de tests ni build n’est lancée. Les illustrations complètes restent hors du manifeste public du jeu : elles ne sont pas chargées dans les parties. Leurs proportions de case, leurs orientations et leurs silhouettes à petite taille devront être finalisées avec les animations. Le manifeste des atlas en jeu est inchangé (`6fe23325d4ecc7ea99fddf5edc92197dba9a87dc5cb6b33e8a6f5f292b4e9bf2`).

## Fabrication des sprites de jeu

1. Fixer les trois silhouettes, leur palette et l’épaisseur du contour.
2. Dessiner les vues de carte droite / haut / bas et la vue de profil du duel. La gauche peut être le miroir de la droite ; éviter signes ou éclairages asymétriques.
3. Décliner les poses repos, déplacement, tir, touché et hors-jeu, et capture lorsque l’unité le permet. Conserver taille, point d’appui et équipement d’une image à l’autre ; ne pas simuler une animation en faisant simplement glisser l’image entière.
4. Préparer les masques d’équipe séparés, les pivots et les durées, puis assembler des atlas PNG/WebP au contrat du moteur. Les portraits, bâtiments et décors suivent leur propre famille dans ce même manifeste.
5. Contrôler la transparence, les cadres, les pivots, les dimensions, les boucles et le poids ; regarder les images dans la vitrine, puis dans une partie. Finaliser la livraison animée des trois pilotes avant de généraliser ce travail au catalogue dessiné.

La source de provenance du manifeste peut être un PNG et son SHA-256. Le rendu ne charge jamais `source.fichier` : seules les pages d’images, masques et émissions sont chargées. Les images doivent respecter la projection fixe à 50° et la densité de référence de 128 pixels par case (`src/render2d/contrat.ts`).

Les prompts des premiers pilotes sont conservés tels qu’envoyés : leur vocabulaire de tournoi provient du brief local antérieur à la synchronisation du lore v2. Ceux de la collection commune suivent le canon du 26 septembre (guerre sans gore, armement fictif), sans rétablir la doctrine du marquage.

## Retrait du parcours 3D

Les GLB/glTF versionnés et leurs alias sont supprimés. Les atlas actuellement affichés et les textures PNG sont conservés pour maintenir le jeu. Le relevé des fichiers retirés est `assets/production/retrait-glb.json`. Les octets retirés du checkout ne sont pas une économie équivalente pour le joueur : son jeu utilisait déjà les sprites. L’historique Git et les sources distantes privées restent conservés.

`/admin/assets` lit le manifeste du jeu et ouvre ses entrées dans `/atelier/unites?id=…`. Les anciens écrans 3D redirigent vers cette bibliothèque ; les endpoints de dépôt et de récupération GLB répondent 410 après authentification. `/api/modeles` est retiré au profit du manifeste public des sprites. Aucun dépôt de nouveaux sprites n’est annoncé tant que le format de livraison des pilotes n’est pas prêt.

Les commandes npm de création, contrôle et cuisson GLB sont retirées. Les scripts, fiches, rapports et essais de cette ancienne chaîne sont des archives ; leurs fichiers décrits ne constituent plus un inventaire actif. Les tests dépendant des livraisons 3D supprimées sont archivés avec le suffixe `.legacy.ts`, hors découverte automatique. Les contrôles du moteur et des atlas restent actifs. Aucune suite de tests ni build n’a été demandée pour ce retrait.
