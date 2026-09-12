# Haies, buissons et forêts — 12 septembre 2026

Après le rejet esthétique des buissons et haies de la première passe, les volumes sphériques tempérés sont remplacés par un feuillage composé de petites feuilles pliées. Les nouvelles géométries sont produites dans `src/render3d/vegetation-boisee.ts` et partagées entre paysage et arbres.

- Haie : cinq rameaux irréguliers, 140 feuilles pliées, trois tiges ; 596 triangles.
- Buisson : trois rameaux dissymétriques, 84 feuilles ; 336 triangles.
- Feuillu : cinq rameaux, 140 feuilles et un tronc ramifié ; 560 triangles de couronne et 128 de bois.
- Conifère : six niveaux de branches effilées à angles décalés ; 168 triangles de feuillage, 128 de bois.

Les nuances de pigment viennent des couleurs de sommets, sans éclairage peint ni carte transparente. Les feuilles sont double face. Les matériaux existants continuent de gérer saisons, neige, éclairage et brouillard. Trois arbres par case de forêt, placements, rotations et variations de taille sont conservés afin de ne pas remplir davantage le centre des cases. Les palmes tropicales restent distinctes.

La passe concerne les géométries procédurales affichées en jeu ; les GLB de la bibliothèque ne sont pas régénérés. Aucune texture supplémentaire. Les géométries restent mémorisées et instanciées par famille, pas un objet de rendu par feuille.

Contrôles : déterminisme, absence de triangles dégénérés, emprise et hauteur bornées, couleurs valides, tests du rendu et empreintes de scène actualisées. Les empreintes changent dans les cinq scènes de référence parce que les arbres tempérés et leurs matériaux changent ; effectifs et placements restent inchangés. Aucune validation esthétique à l’œil n’a été effectuée, conformément à la consigne du projet.
