# Sprites dessinés directement

**1er octobre 2026 — suppression des halos du paysage.** Après rejet visuel du propriétaire, les ombres ovales ajoutées sous les arbres et la bande d’ombre du pont sont retirées. La forêt garde le même gazon que la plaine : plus de sous-bois ni de voile sombre appliqué à toute la case. Le décor forestier de repli suit aussi cette règle. Les nuances du gazon, le volume peint dans les sprites, les garde-corps, la météo et le brouillard sont conservés ; aucun atlas modifié.

### Raccords du paysage et bâtiments frontaux

**30 septembre 2026 — reprise des raccords du paysage.** La plaine retrouve des variations de turf à trois échelles ; les brins en V répétés sont retirés. Le pont est désormais tracé par le sol avec la même largeur de chaussée et le même marquage que la route, entouré de garde-corps fins ; les PNG de pont restent des références, sans instance superposée en jeu. Trois nouveaux bosquets de deux arbres remplacent les groupes denses en saison tempérée, à une échelle de 0,83–0,93 sans agrandissement près des voisins. Le dessous des montagnes reste herbeux, sans plaque de roche carrée. Ville, usine, aéroport, port et radar sont redessinés de face comme le QG ; désaffectés : même base ternie, sans pavillon. Les deux images de superusine, les unités hors char léger/recon et les variantes hivernales restent à harmoniser. Huit PNG natifs sous `collection-base-v1/carte/`, originaux conservés et prompts dans `raccords-carte.json`. L'atlas courant compte 57 entrées dessinées sur 6 pages (618,832 octets). Aucun changement de règles ni approbation artistique automatique. Contrôles de cette reprise : concordance SHA des huit sources avec le manifeste, typage et compilation de production réussis ; inspection locale des Quatre villes, de la carte d’exhibition et du catalogue. Aucune suite de tests lancée.

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

### Perspective de carte et raccords — Premier contact

Le retour du propriétaire vise la cohérence du plateau, pas la quantité de détail dans une image isolée. La correction conserve les dessins trois-quarts comme références et crée trois vues de carte natives (`carte/`) : char léger et reconnaissance en vue latérale plongeante à axe horizontal, QG à façade frontale alignée sur la grille. Le plan pointe vers ces nouveaux fichiers ; les prompts exacts et leurs références sont dans `perspective-carte.json`. Production par image_gen, sans GLB ni déformation du dessin à l'exécution.

La règle de perspective pour la suite : caméra orthographique, hauteur de vue constante, véhicule parallèle à sa voie ; les bâtiments suivent les axes de la grille. Une vue de vitrine en diagonale ne vaut pas vue de carte. Les unités et bâtiments autres que ces trois références conservent encore leur perspective précédente. Les poses restent fixes, également reprises dans le duel en attendant des profils dédiés.

Les bosquets tempérés reliés par un côté se rapprochent et recouvrent leur joint. Les groupes isolés gardent une emprise plus petite ; le brouillard exclut les voisins inconnus du calcul. La litière du sol traverse les limites entre cases boisées. Le bit graphique `ACCES` trace un passage étroit entre un bâtiment et les routes ou ponts qui arrivent réellement face à lui : la route mène au seuil, sans restaurer le carré de pierre. Les accès suivent la neige ; aucun terrain logique, déplacement, défense ou coût n'est modifié.

Le manifeste conserve 63 entrées dessinées et six pages, pour 745 258 octets. Les trois références haute définition restent dans la fabrication. Typage et inspection locale de Premier contact effectués, sans suite de tests ; cela ne vaut pas approbation du propriétaire.

### Sol continu sous les bâtiments et cohérence des biomes

Le fond transparent du PNG QG était déjà correct ; le carré de pierre venait de `MELANGES.qg` et du forçage des cours dans le nuanceur. Les bâtiments terrestres reprennent maintenant la matière de plaine du biome et ses transitions, sans dalle ajoutée. Le port garde son quai qui dessine la limite terre/mer. Les murs, marches et ouvrages présents dans les dessins restent intacts.

Le terrain adopte un traitement illustré commun : variations de lumière et relief de grain réduits, verts plus francs, quelques traits de brins au sol. Ces traits sont déterministes en coordonnées du monde et anti-crénelés au zoom. `poidsDe` et `tablesPoids` reçoivent le biome : l'herbe de base devient sable au désert ou roche/cendre au volcan. Le duel lit la même table ; aucun faux dallage ni cour déneigée n'est rajouté autour d'un QG. La neige couvre toujours le sol. Ce choix est purement graphique, sans changer la grille tactique ni ses règles. Aucun nouvel atlas ni fichier image chargé en partie.

### Composition de la carte — reprise après retour du propriétaire

Le premier raccordement plaçait trois à cinq exemplaires du même arbre dessiné sur les anciens emplacements de figurines. Le résultat était une couronne de petits buissons, sans rapport avec l’échelle des unités. Le placement utilise désormais un bosquet par case tempérée et deux arbres plus grands pour les autres biomes. Deux dessins d’automne alternent selon un hachage stable de la case ; hauteurs et positions varient légèrement, les canopées voisines se rejoignent. Les variantes hivernales restent sur leur chemin existant. Le brouillard cache toujours les décors des cases non découvertes.

Les marcheurs mesurent au plus 60 × 76 pixels, les véhicules 104 × 82, les bâtiments jusqu’à 126 pixels de large. Les ombres d’unités sont renforcées et une ombre de contact accompagne les nouveaux bosquets. L’herbe procédurale reste en place, avec moins de taches orange ; les berges mêlent terre, herbe et quelques galets. La rivière reçoit une sinuosité continue, contenue dans ses cases, et moins d’écume sur les rives. La grille est plus discrète.

Le pont commun remplace le rectangle vert historique : deux sources natives `terrain_pont_eo.png` / `terrain_pont_ns.png`, vues `travers` / `fixe` du même identifiant `terrain_pont`. Leur emprise et leur pivot alignent la chaussée sur les routes. Les sources restent intactes, leurs copies sont adaptées à la projection du plateau lors de l’emballage. Les autres propositions de pont restent des références.

La collection compte 100 références, plus les deux orientations de remplacement du pont. **63 entrées, six pages, 749 980 octets** sont actives. Prompts natifs exacts et provenance : `composition-jeu.json` / `composition-variante.json`. Premier contact a été regardé en situation à deux zooms ; cela ne vaut pas approbation du propriétaire ni mesure de performance sur téléphone. Pas de suite de tests lancée.

### Première activation en poses fixes

Le propriétaire demande pourquoi les dessins ne sont pas encore employés en jeu. Leur animation complète n’est plus une condition préalable à l’affichage : **59 poses fixes sont raccordées** au manifeste partagé. Cela couvre les 30 unités, les 13 bâtiments/états et 16 éléments de paysage (dix biomes, montagne, deux rochers côtiers, buisson, roseaux et touffe). Le plan distingue maintenant chaque entrée active des références restantes.

`npm run sprites:integrer-dessins` (`scripts/sprites/integrer-dessins.ts`) lit le canal alpha, calcule une emprise, réduit une copie à sa taille de case, règle le pivot puis assemble des pages WebP sans perte avec marges de mipmap. Aucune source HD n’est modifiée. Six pages totalisent **597 194 octets (583,20 Kio)**. Les noms incluent une empreinte pour renouveler le cache ; les anciens PNG/WebP conservés ne sont pas nécessaires aux entrées remplacées. Les alias historiques QG FR/LU sont retirés du manifeste pour laisser paraître le nouveau QG.

Les champs facultatifs `dessinStatique` et `pages[].peinture` prolongent le contrat. La peinture cobalt ou ambre est détectée au rendu et prend la couleur du camp, en gardant la luminance du dessin ; les parties neutres et l’alpha restent inchangés. Le carnet Canvas suit les mêmes calculs que WebGL. Cette sélection par couleur est une première solution : elle n’a pas la précision d’un masque peint à la main, et des détails de même teinte peuvent aussi changer de camp.

Une seule pose `repos` est déclarée, sans inventer des images de marche, de tir ou de rotor. Le jeu continue de déplacer les unités et d’afficher ses projectiles, impacts et effets. Les duels emploient explicitement cette pose de trois quarts jusqu’à la production de vrais profils. Les entrées historiques sans `dessinStatique` gardent leur sélection de clips habituelle.

Le placement prend les nouveaux arbres par biome et les nouvelles plantes par genre. L’hiver ou une chute de neige conserve les variantes hivernales historiques ; le pin du biome neige est déjà enneigé. Un changement de météo vers/depuis la neige reconstruit le placement. Le sol procédural et les flocons demeurent indépendants : ils continuent de couvrir la carte. Les nouveaux toits et ponts dessinés n’ont pas encore de calques d’accumulation. Les dessins de pont ne sont pas plaqués de travers sur les voies : ils restent dans la galerie en attendant leurs deux orientations et leurs raccords. Les études de sols et les portraits restent également hors des parties.

Contrôles effectués : lecture complète du manifeste par le chargeur réel, fichiers et dimensions des pages, typage, inspection locale du rendu de Premier contact (infanterie, char, QG, couleurs des deux camps) et du plateau enneigé. Aucune suite de tests, aucun build ni mesure FPS sur téléphone. Rapport versionné : `activation-jeu.json`. Le relevé `verification.json` conserve l’état des références avant activation, avec son ancien SHA de manifeste.

### Suite de la fabrication animée

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
