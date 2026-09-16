# Artillerie — LOD0 issu de la source uploadée

Lot intégré le 16 septembre 2026 ; il remplace directement l’ancienne géométrie active après contrôle technique. La source est **military cannon vehicle 3d model.glb**, SHA `38a5dbc65010bb45ec2424de7fa9c19b1e6d220ec0beb5339d2a5c35214fad5b`. Le fichier brut local et le maître préparé sont archivés immuables dans `assets/sources/unite_artillerie_base/maitre-a1805db53896c9b982def37b101ab3388c4406a67071d76e08f24eb148ab5112/`, hors Git et hors diffusion. `maitre.json` donne les empreintes et les chemins de récupération depuis les données ou l’historique versionné.

## Livraison

Un seul modèle `unite_artillerie_base_lod0.glb`, **54 272 triangles** sur un budget de 60 000, accompagné de cinq PNG externes : albédo, normale, rugosité, métal et masque d’équipe. GLB compressé Meshopt sans quantification : **1 358 764 octets**. Lot GLB + PNG : **9 352 100 octets (8,92 Mio)**, contre 48 822 478 octets pour le maître préparé. Aucune image embarquée, aucun autre LOD.

Le modèle actif au début de la préparation, SHA `fd8fa377c0a435db428fb18a789a501715a0642791185bb533e67444483b8e17`, est l’ancienne géométrie procédurale de 2 840 triangles. Ce lot est dérivé de la source uploadée à 941 718 triangles et ne prend pas cette ancienne géométrie comme source.

## Préservation et pertes

La simplification conserve les coutures et prélève les sommets dans le maître : les **50 903 sommets** résultants retrouvent exactement leurs positions, UV0 et normales. Les nœuds, pivots, matériaux, références d’images et valeurs/cibles des cinq animations sont inchangés. Le masque d’équipe est identique à l’octet près : noir/blanc strict, 1 256 pixels blancs en 512².

Les textures 4K deviennent des PNG 2K ; le masque 512² reste intact. Le filtrage de l’albédo se fait en lumière linéaire, les normales sont renormalisées sans inverser le vert. Les normales existantes sont conservées : **aucun nouveau bake HD vers low-poly** n’est revendiqué. Certains petits reliefs géométriques et les plus petits texels sont réduits. L’estimation interne de simplification atteint 1,660 mm ; elle ne constitue pas une mesure de distance de Hausdorff.

## Réception technique

`npm run controler:asset -- --spec assets/specs/unite_artillerie_base.json --lot tmp/production-sequentielle/unite_artillerie_base` : **ok**, code de sortie 0, aucun refus, six fichiers acceptés. `revue-technique.json` et `integrite.json` consignent les données et limites.

Aucune suite de tests, capture ou inspection visuelle. La silhouette, la segmentation des attaches, l’orientation artistique et l’absence de lumière cuite restent non vérifiées visuellement. Aucune mesure FPS sur téléphone et aucune approbation artistique automatique. La source brute connue est vérifiée par SHA ; la dernière révision distante n’est pas attestée, faute de jeton configuré localement.
