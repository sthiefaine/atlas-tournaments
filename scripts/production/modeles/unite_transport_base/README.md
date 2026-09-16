# Transport chenillé — source reproductible

Création originale du porteur de ravitaillement, sans GLB uploadé disponible. La livraison précédente (844 triangles) a été inspectée par code ; aucun de ses triangles n’est importé. Les helpers géométriques de l’automate servent uniquement à assembler des volumes distincts : cabine avancée, soute vide, banquettes, rampe abaissée et grue latérale repliée. Aucun tube, rack ou tourelle.

```sh
node --import tsx scripts/production/modeles/unite_transport_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_transport_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_transport_base.json --lot tmp/production-sequentielle/unite_transport_base
```

Les scripts acceptent chacun un dossier de sortie facultatif. Python nécessite NumPy et Pillow ; le générateur réutilise Three.js et l’exportateur GLB déjà présents dans le dépôt. Aucun appel externe ni dépendance ajoutée.

5 980 triangles, deux matériaux, cinq primitives et cinq nœuds nommés. Atlas UV0 4 × 4 avec marges, tangentes explicites. Les canaux PNG restent externes : albédo/normale 1024², rugosité/métal/masque 512². Le blanc du masque couvre la cabine et les panneaux de soute ; son albédo est neutre. Les fines nervures du plancher sont analytiques, sans éclairage peint ni bake HD.

Les quatre animations prescrites sont `repos`, `deplacement`, `touche`, `hors_jeu`. La racine ne bouge pas ; le témoin disparaît à la fin du hors-jeu. Chenilles rigides et rampe fixe en position abaissée : pas de défilement de patins ni d’articulation dédiée à la rampe dans cette version.

Le contrôle technique n’est pas une approbation artistique. Aucune capture, inspection visuelle ou mesure réelle sur téléphone.
