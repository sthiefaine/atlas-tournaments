# Mobile et formations de combat — 14 septembre 2026

Le propriétaire signale des ralentissements dès Premier contact, aggravés en combat. Il demande ensuite un duel limité aux deux textures de terrain et à des exemplaires de chaque unité, aussi nombreux que ses PV affichés.

## Coûts identifiés dans les fichiers et le code

- Infanterie : 951 858 triangles ; char léger : 957 212 ; QG : 873 843. Chacun utilise trois PNG 4096 × 4096, en plus de ses petites cartes annexes.
- Le premier duel dessinait toute la carte, puis les deux modèles dans une scène supplémentaire à chaque image.
- Le téléphone recevait les mêmes textures 4K, du MSAA et des ombres, avec un ratio de pixels pouvant atteindre 1,4. L'accueil montait également une simulation 3D.

Ce constat vient des métadonnées locales et des chemins de rendu ; ce n'est pas une mesure de FPS sur le téléphone du propriétaire.

## Duel demandé

Chaque côté montre une formation sur l'image de sa propre case : 10 PV = 10 figurines, 6 PV = 6 figurines. Les valeurs viennent de `Geste.duel`, déjà exprimées de 0 à 10. Les pertes retirent les figurines à l'impact ; tir et riposte conservent la chronologie existante. En animations réduites, l'effectif final paraît directement.

Les deux images de figurines sont rendues depuis les modèles déjà présents en mémoire, avec leurs couleurs. Deux autres images cadrent les cases en vue verticale à partir du plateau existant : sol, route, pont, eau et neige. Aucun bâtiment ou accessoire du décor n'est ajouté à la scène de duel. La grille est masquée dans ces images.

Ces quatre images GPU 256 × 256 sont produites une fois par duel dans le renderer de la partie, sans lecture CPU ni nouveau téléchargement. Deux maillages instanciés affichent ensuite les formations ; deux plans portent les textures des cases. À pleine vie, les figurines représentent 40 triangles par image, auxquels s'ajoutent les deux plans et les effets. Le coût des gros modèles est payé à la préparation des images, pas multiplié par vingt à chaque frame. Le plateau reste en mémoire mais n'est plus dessiné derrière le duel.

La représentation est une animation de figurines issues des GLB : recul, rafales, trajectoires et retraits. Elle ne joue pas les articulations des GLB image par image. Les copies privées de matériaux/squelettes, les images du duel, ses instances et ses effets sont libérés à la fermeture ; les géométries et textures de la carte restent à leur propriétaire. Le HDR des cibles intermédiaires préserve les couleurs avant l'application finale de l'exposition.

## Budget tactile automatique

La détection repose sur le pointeur principal tactile (`pointer: coarse`), indépendamment de la largeur d'écran.

- Ratio de pixels plafonné à 1 ; MSAA, passes d'ombres et post-traitement désactivés.
- Boucle de la carte plafonnée à 30 images/s pendant les gestes ; réveils d'ambiance seule espacés de 100 ms. Ce plafond ne promet pas une cadence atteinte et ne modifie pas le moteur de jeu.
- Au plus 260 particules météo et 22 impacts de pluie, contre 2600 réservées et 80 impacts auparavant.
- Textures des modèles redimensionnées à 1024 maximum avant le premier envoi au GPU, quand ImageBitmap le permet. Une image RGBA passant de 4K à 1K contient seize fois moins de texels. Dimensions proportionnelles, espaces couleur, orientation et masques conservés ; aucun fichier du dépôt réécrit, aucun LOD ajouté.
- Accueil statique sur tactile : aucun montage de la démo 3D ni import anticipé de son module. Le jeu conserve ses modèles 3D.

Les originaux restent téléchargés et décodés avant réduction des textures : le poids réseau et le coût initial du décodage ne sont pas supprimés. Les modèles proches d'un million de triangles restent coûteux sur la carte. Aucun gain de FPS réel n'est affirmé sans mesure sur appareil.

## Vérification

Vérification par typage, compilation de production et relecture des changements. Aucune suite de tests, simulation, capture ou revue visuelle : les consignes du propriétaire restent applicables. Les règles de combat, les sauvegardes et les assets sources ne sont pas modifiés.
