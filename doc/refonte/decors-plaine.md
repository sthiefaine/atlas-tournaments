# Décors de plaine — première passe du 12 septembre 2026

Les haies et buissons de cette première passe ont ensuite été remplacés : voir `forets-feuillage.md` pour leur état actuel.

Le propriétaire demande d’harmoniser les accessoires posés sur la plaine avec la nouvelle herbe GLB. Cette passe modifie les géométries procédurales réellement utilisées en jeu, dans `src/render3d/paysage.ts`. Elle ne livre pas de nouveaux GLB ou PNG pour la bibliothèque d’assets.

- Haies : petits troncs, masses de feuillage irrégulières, palette du gazon ; 340 triangles.
- Bottes : volume arrondi, deux liens et anneaux de paille sur les faces ; 832 triangles.
- Parcelles : deux sillons fins et douze rosettes feuillues remplacent la grande plaque brune et les cubes. Deux petites marguerites ; 596 triangles.
- Grandes touffes : dix-sept feuilles courbées à trois segments, pigment par feuille, double face ; 85 triangles. Le terrain d’herbe haute utilise la même forme, plus grande et plus dense.
- Buissons ajoutés aux plaines, fougères à proximité des forêts, en réutilisant les formes existantes.

Bottes et parcelles sont moins fréquentes. Les points de placement des accessoires de bocage restent espacés d’au moins 18 cm sur chaque case, hors tapis de gazon et pièces jumelles ; cela limite les amas sans prétendre constituer un test de collision des volumes. Routes et bâtiments restent exclus. Le semis est déterministe, groupé par genre et conserve relief, saisons, brouillard et mode tactique.

Les tests vérifient géométries finies, pose au sol, hauteur maximale, budgets, espacement et contrats de brouillard. L’empreinte de la démo en plaine est révisée pour les deux genres ajoutés et les nouvelles formes ; celles des autres biomes sont conservées. Aucun contrôle visuel n’est effectué, conformément à la consigne du projet.
