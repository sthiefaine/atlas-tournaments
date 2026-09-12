# terrain_plaine — herbe en volume

Révision du 12 septembre 2026, à la demande du propriétaire : la végétation appartient désormais au GLB, pas uniquement à la texture. La validation artistique reste à faire en jeu.

- LOD0 : 798 triangles, dont 240 brins courbés et six trèfles.
- LOD1 : 174 triangles, dont 48 brins et deux trèfles.
- Dimensions : 1 × 0,06 × 1 m, origine centrée au sol, +Y haut, +Z avant.
- Sol parfaitement plat à 0,02 m ; végétation haute de 0,04 m au maximum. Le relief général appartient au moteur.
- Deux nœuds : `racine`, `sol`. Deux matériaux PBR : `mat_sol`, `mat_herbe`. Aucune animation, aucune carte transparente.
- Quatre PNG externes partagés entre les LOD : albédo, normale, rugosité (1024²), occlusion (512²). Aucun éclairage dans l’albédo, dont la palette a été éclaircie. Aucun octet d’image embarqué dans les GLB.

Les bords des textures se raccordent après chaque quart de tour. Les brins restent dans l’emprise de la case ; leurs sommets et les trèfles portent des couleurs de pigment, sans ombre peinte.

Dans Premier contact, le moteur extrait `mat_herbe`, projette chaque sommet sur le terrain continu et regroupe les cases de plaine dans une géométrie. Jusqu’à 144 cases de plaine, il emploie le LOD0 ; au-delà, le LOD1. La couche reçoit l’éclairage, les ombres, les saisons et le brouillard. Elle est cachée en mode tactique. Les anciens bouquets procéduraux sont masqués lorsqu’elle est disponible.

Régénération : `node --import tsx scripts/generer-plaine.ts` ; textures : Python avec NumPy, `scripts/plaine/textures.py`.

Contrôle : `node --import tsx --import ./tests/aides/webgpu-en-node.mjs --test tests/assets/plaine.test.ts tests/render3d/vegetation-plaine.test.ts`.

Les fichiers actifs et les aperçus de l’admin partagent les données par empreinte. Les rapports JSON décrivent la réception technique ; ils ne constituent pas une approbation esthétique.
