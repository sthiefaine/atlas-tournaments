# terrain_plaine — herbe en volume

Révision du 12 septembre 2026, à la demande du propriétaire : la végétation appartient désormais au GLB, pas uniquement à la texture. Le propriétaire a ensuite demandé davantage de hauteur et autorisé plus de détail : budgets portés à 2 400/600 triangles, brins à trois segments courbés. La validation artistique de cette seconde passe reste à faire en jeu.

- LOD0 : 1 914 triangles, dont 360 brins courbés et douze trèfles.
- Dimensions : 1 × 0,14 × 1 m, origine centrée au sol, +Y haut, +Z avant.
- Sol parfaitement plat à 0,02 m ; végétation haute de 6 à 12 cm. Le relief général appartient au moteur.
- Deux nœuds : `racine`, `sol`. Deux matériaux PBR : `mat_sol`, `mat_herbe`. Aucune animation, aucune carte transparente.
- Quatre PNG externes référencés par le LOD0 : albédo, normale, rugosité (1024²), occlusion (512²). Aucun éclairage dans l’albédo, dont la palette a été éclaircie. Aucun octet d’image embarqué dans les GLB.

Les bords des textures se raccordent après chaque quart de tour. Les brins restent dans l’emprise de la case ; leurs sommets et les trèfles portent des couleurs de pigment, sans ombre peinte.

Dans Premier contact, le moteur extrait `mat_herbe`, projette chaque sommet sur le terrain continu et regroupe les cases de plaine dans une géométrie. Il emploie toujours le LOD0, quelle que soit la taille de la carte. La couche reçoit l’éclairage, les ombres, les saisons et le brouillard. Elle est cachée en mode tactique. Les anciens bouquets procéduraux sont masqués lorsqu’elle est disponible.

Régénération : `node --import tsx scripts/generer-plaine.ts` ; textures : Python avec NumPy, `scripts/plaine/textures.py`.

Contrôle : `node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test tests/assets/plaine.test.ts tests/render3d/vegetation-plaine.test.ts`.

Les fichiers actifs et les aperçus de l’admin partagent les données par empreinte. Les rapports JSON décrivent la réception technique ; ils ne constituent pas une approbation esthétique.
