# Sprites dessinés directement

Décision du propriétaire, 30 septembre 2026 : supprimer les GLB et fabriquer uniquement des sprites. La chaîne de figurines Blender et de cuisson est arrêtée. Le rendu WebGL 2 existant reste en place.

## Première livraison : trois propositions

Un directeur artistique a défini une famille de dessins originaux : infanterie, hélicoptère, char léger. Les trois PNG et les prompts exacts sont sous `assets/direction-artistique/pilotes-sprites-v1/`. Génération par l’outil natif image_gen, fond transparent, palette cobalt / graphite / os. Le propriétaire a accueilli favorablement cette direction (« c’est beaucoup mieux »). Ce sont des poses de référence ; elles ne sont ni des animations complètes ni des livraisons activées. Le bleu représente le camp, pas une nationalité française.

Le contrôle artistique doit se faire aussi à la taille d’une case (48, 64 et 128 pixels), sur sol clair et sombre : visage et arme du fantassin séparés, rotor / queue / patins de l’hélicoptère distincts, chenilles / tourelle / canon du char lisibles. Les angles des trois propositions restent à harmoniser au contrat de carte. Une grande illustration ne prouve pas cette lisibilité.

Les six déclinaisons France / Chine demandées ensuite sont sous `assets/direction-artistique/variantes-fr-cn-v1/`, avec leur jeu de prompts et les références utilisées. France : bleu, écru et détails rouges discrets ; Chine : vermillon, graphite et sable. Ce sont des propositions d’équipement fictif, sans drapeaux ni insignes réels. La Chine n’a pas de fiche dans le roster actuel : ces dessins ne modifient pas le roster ni la campagne.

## Fabrication après le choix de style

1. Fixer les trois silhouettes, leur palette et l’épaisseur du contour.
2. Dessiner les vues de carte droite / haut / bas et la vue de profil du duel. La gauche peut être le miroir de la droite ; éviter signes ou éclairages asymétriques.
3. Décliner les poses repos, déplacement, tir, touché et hors-jeu, et capture lorsque l’unité le permet. Conserver taille, point d’appui et équipement d’une image à l’autre ; ne pas simuler une animation en faisant simplement glisser l’image entière.
4. Préparer les masques d’équipe séparés, les pivots et les durées, puis assembler des atlas PNG/WebP au contrat du moteur. Les portraits, bâtiments et décors suivent leur propre famille dans ce même manifeste.
5. Contrôler la transparence, les cadres, les pivots, les dimensions, les boucles et le poids ; regarder les images dans la vitrine, puis dans une partie. Finaliser les trois pilotes avant de généraliser au catalogue.

La source de provenance du manifeste peut être un PNG et son SHA-256. Le rendu ne charge jamais `source.fichier` : seules les pages d’images, masques et émissions sont chargées. Les images doivent respecter la projection fixe à 50° et la densité de référence de 128 pixels par case (`src/render2d/contrat.ts`).

## Retrait du parcours 3D

Les GLB/glTF versionnés et leurs alias sont supprimés. Les atlas actuellement affichés et les textures PNG sont conservés pour maintenir le jeu. Le relevé des fichiers retirés est `assets/production/retrait-glb.json`. Les octets retirés du checkout ne sont pas une économie équivalente pour le joueur : son jeu utilisait déjà les sprites. L’historique Git et les sources distantes privées restent conservés.

`/admin/assets` lit le manifeste du jeu et ouvre ses entrées dans `/atelier/unites?id=…`. Les anciens écrans 3D redirigent vers cette bibliothèque ; les endpoints de dépôt et de récupération GLB répondent 410 après authentification. `/api/modeles` est retiré au profit du manifeste public des sprites. Aucun dépôt de nouveaux sprites n’est annoncé tant que le format de livraison des pilotes n’est pas prêt.

Les commandes npm de création, contrôle et cuisson GLB sont retirées. Les scripts, fiches, rapports et essais de cette ancienne chaîne sont des archives ; leurs fichiers décrits ne constituent plus un inventaire actif. Les tests dépendant des livraisons 3D supprimées sont archivés avec le suffixe `.legacy.ts`, hors découverte automatique. Les contrôles du moteur et des atlas restent actifs. Aucune suite de tests ni build n’a été demandée pour ce retrait.
