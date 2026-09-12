# Barge de transport Tripo

Source fournie par le propriétaire : `tugboat 3d model.glb`, 934 558 triangles, 28,4 Mio. Copie HD conservée localement dans `assets/sources/unite_barge_base`, hors git. Affectation à la barge confirmée explicitement.

Préparation : `python3 scripts/barge/preparer-source.py`, puis `python3 scripts/barge/finaliser.py` (Pillow). La source originale reste nécessaire localement. Aucun rendu ni décimation. Les normales sont stockées en entiers normalisés 16 bits avec `KHR_mesh_quantization`.
- Avant : +Z, rampe ; arrière : cabine. Transformation de la longueur source +X vers +Z.
- Dimensions finales : 0,62 × 0,50 × 0,85 m, origine centrée au sol.
- LOD0 unique : 934 594 triangles, dont les 934 558 triangles source et 36 pour les panneaux d’équipe. GLB : 24 533 164 octets. LOD1 et LOD2 retirés.
- Quatre clips rigides : repos 2,4 s, déplacement 1 s, touche 0,5 s, hors jeu 0,9 s. La racine reste immobile.
- La grue supérieure est séparée pour la structure du modèle, mais reste fixe par rapport à la coque. Pas de rampe articulée ni de séquence de débarquement livrée.
- Les panneaux ajoutés utilisent la bande supérieure de l’atlas, gris neutre et masque binaire. La couleur ne se propage pas aux fenêtres ni au reste de la coque.
- PNG externes partagés, aucun duplicata embarqué entre LOD. Le fichier `metal.png` contient le packing glTF (rugosité G, métal B) ; `rugosite.png` est aussi livré comme canal séparé.
- Albedo et normale en 4096² ; rugosité, métal et masque en 512². Aucun nouvel éclairage peint. L’absence d’éclairage déjà présent dans la source et la qualité artistique ne sont pas certifiées par un test automatique.

Contrôle : `node --import tsx scripts/controler-asset.ts --spec assets/specs/unite_barge_base.json --lot assets/livraisons/unite_barge_base --json`.

Activation technique dans `public/assets/modeles`, comme base partagée des nations sans kit actif. Validation artistique finale à faire par le propriétaire. Les budgets de cette barge et de ses kits sont relevés dans le catalogue ; aucune autre unité ne change de budget. Les kits candidats anciens ne sont pas compatibles avec cette nouvelle géométrie/UV et doivent être régénérés avant activation.
