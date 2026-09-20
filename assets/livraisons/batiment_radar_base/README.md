# Station radar commune — livraison technique

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

Lot original : **4 852 triangles, cinq primitives, deux matériaux, 1 677 244 octets** pour le GLB et cinq PNG. Dimensions : **0,860 × 0,757460 × 0,860 m**, pivot au sol, +Y haut, +Z avant. GLB SHA-256 : `f4405bd792fedc0203c8edcb51e72cbc0e03dffead1f9be8ad02e86d1ed1d20f`.

Cabine technique basse et approche frontale libre ; grande parabole concave fermée par un dos et un chant, récepteur fixé, support motorisé. Repos 3,2 s : scan ±0,28 rad ; capture 1,4 s : panneau d’équipe coulissant puis retour. Dalle, murs et toit fixes. L’extra `racine.atlasAnimationsBatiment: true` utilise le raccordement existant, sans parabole procédurale supplémentaire.

`revue-technique.json` réunit provenance, SHA, verdict et limites ; `fabrication.json` compte les pièces ; `textures.json` détaille les cinq PNG ; `mesures.json` contient 66 raccords ciblés, 16 sondes de cavité, les majorants continus et 40 poses ; `mesures-natif-glb.json` confirme leur parité avec GLTFLoader. Garde continue parabole/toit : 45,667 mm. Rayon mobile : 263,126 mm. Garde minimale d’indicateur/butée : 6 mm. Zone avant dégagée à partir de Z=0,140 m, rampe réelle sur toute la largeur.

L’ancien candidat et ses quinze PNG ont été inspectés sans les importer ni les modifier. Absence distante communiquée par le coordinateur à 16:22:21 UTC le 20 septembre 2026 ; aucun maître local dédié. Sources reproductibles : `scripts/production/modeles/batiment_radar_base/`.

Contrôle du lot et typage consignés dans leurs journaux. Aucun rendu, contrôle visuel, approbation artistique, test général, build ou relevé FPS. Les vérifications sont ciblées ; ni l’absence exhaustive d’intersections ni la visibilité de toutes les unités ne sont certifiées.
