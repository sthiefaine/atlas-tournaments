# Dossier du panel — les sprites d'Atlas Tournament (23 septembre 2026)

## La question

Le propriétaire du jeu a regardé l'atelier et a dit, capture à l'appui : **« il n'y a pas de cohésion graphique, et c'est moche »**. Il demande à cinq personnes de **décider à quoi doit ressembler le sprite de chaque unité et de chaque bâtiment**. Vous êtes l'une de ces cinq personnes. On ne vous demande pas d'être aimable : on vous demande pourquoi c'est moche, et quoi faire, unité par unité.

## Le jeu en cinq lignes

Atlas Tournament est un tactique au tour par tour **dans l'esprit d'Advance Wars**, jouable dans un navigateur, d'abord sur **téléphone**. Une guerre fictive entre 24 nations réelles pour l'énergie et les technologies ; un adversaire apatride, « les Gris ». Quatre camps au plus sur une carte (bleu, rouge, vert, or par défaut ; ou la couleur de la nation), les bâtiments sans propriétaire sont gris neutre. On achète des unités dans des usines, aéroports et ports, on capture des villes avec l'infanterie, on prend le QG adverse.

## Ce que vous regardez — les images, à ouvrir avec l'outil Read

Toutes les planches sont **composées exactement comme le jeu** compose ses images (couleur cuite × couleur d'équipe à travers le masque, ombre d'unité posée par le jeu, pivot au centre de la case). Dossier : `/private/tmp/claude-501/-Users-thief-projets-atlas-tournaments/d860024a-57e7-46f2-8dce-b270056777c3/scratchpad/panel/planches/`

1. `../../images/1.webp` (chemin complet : `/private/tmp/claude-501/-Users-thief-projets-atlas-tournaments/d860024a-57e7-46f2-8dce-b270056777c3/images/1.webp`) — **la capture du propriétaire**, l'atelier très zoomé sur ordinateur : une rangée de bâtiments, une rangée d'unités.
2. `01-unites-bleu-128px.png` — les 30 unités, camp bleu, à l'échelle de fabrication (128 px par case).
3. `02-unites-rouge-128px.png` — les mêmes, camp rouge.
4. `03-plateau-telephone-48px.png` — **l'échelle qui compte** : 48 px CSS par case, la taille d'une case sur un téléphone tenu à la main (environ 7 à 8 mm). Bâtiments en haut (bleu, neutre, rouge), armée bleue à gauche, armée rouge à droite qui lui fait face.
5. `04-batiments-128px.png` — les 8 bâtiments, neutre, bleu, rouge.
6. `05-vues-sol-1.png`, `06-vues-2.png`, `07-vues-3.png` — chaque unité sous ses quatre vues : `droite` (la gauche en est le miroir), `bas` (vers le joueur), `haut` (de dos), et `profil` (l'écran de combat, où l'unité est montrée de côté, une figurine par point de vie).
7. `08-decor-ete-128px.png` — le décor (arbres, buissons, rochers) et le pont : ce avec quoi les unités doivent vivre.
8. `mesures-unites.md` — des mesures sur les 30 images : taille de la silhouette en cases, **part de couleur d'équipe** (de 1 % à 75 % !), luminance, saturation et couleur moyenne hors équipe.

## Ce que chaque unité fait (pour juger si sa silhouette le dit)

| Clé | Nom | Domaine | Rôle en jeu | Prix | Classe de taille déclarée |
|---|---|---|---|---|---|
| infanterie | Infanterie | terre | la moins chère ; **capture** les bâtiments | 1 000 | 1 (petite) |
| meca | Méca | terre | fantassin lourd avec lance-roquettes, capture, passe partout | 2 800 | 1 |
| genie | Génie de terrain | terre | fantassin qui **remet en service** les bâtiments désaffectés et pose du terrain | 3 500 | 1 |
| recon | Recon | terre | véhicule rapide à roues, grande vision | 3 800 | 1 |
| char_leger | Char léger | terre | le char de base | 6 500 | 2 |
| char_moyen | Char moyen | terre | char plus fort | 10 000 | 2 |
| char_lourd | Char lourd | terre | le plus gros char, lent | 15 000 | 3 |
| antiair | Anti-air | terre | abat hélicoptères et drones | 7 500 | 2 |
| artillerie | Artillerie | terre | **tir indirect** à distance, ne riposte pas au contact | 5 500 | 2 |
| roquettes | Lance-roquettes | terre | tir indirect à longue portée | 14 000 | 3 |
| missiles_air | Lance-missiles sol-air | terre | anti-aérien à distance | 12 000 | 3 |
| missiles_sol | Lance-missiles sol-sol | terre | tir indirect très longue portée | 16 000 | 3 |
| transport | Transport | terre | porte deux fantassins et **ravitaille** | 5 000 | 2 |
| brouilleur | Brouilleur mobile | terre | brouille les drones adverses | 5 000 | 2 |
| helico | Hélicoptère | air | attaque au sol et en l'air | 9 000 | 2 |
| transport_air | Transport d'assaut | air | hélicoptère de transport de troupes | 6 000 | 2 |
| chasseur | Chasseur | air | avion qui ne touche que ce qui vole | 20 000 | 3 |
| bombardier | Bombardier | air | écrase le sol, rien en l'air | 18 000 | 3 |
| furtif | Chasseur furtif | air | chasseur qui peut se rendre invisible | 20 000 | 3 |
| drone | Drone d'observation | air | petit drone qui voit loin | 3 000 | 1 |
| drone_intercepteur | Drone intercepteur | air | drone anti-aérien | 8 500 | 1 |
| drone_ravitailleur | Drone ravitailleur | air | drone qui ravitaille | 6 000 | 1 |
| barge | Barge de débarquement | mer | porte des unités de terre sur la mer | 6 000 | 2 |
| cuirasse | Cuirassé | mer | artillerie de mer, tir indirect | 19 000 | 3 |
| porte_avions | Porte-avions | mer | porte et ravitaille des avions | 20 000 | 3 |
| sous_marin | Sous-marin | mer | invisible sauf au contact | 12 000 | 2 |
| drone_marin | Drone marin | mer | petit drone de surface qui voit loin | 4 500 | 1 |
| meridien_veilleur | Veilleur méridien | air | drone-brouilleur **exclusif aux Gris** | 10 000 | 2 |
| meridien_bastion | Bastion méridien | terre | anti-aérien lourd **exclusif aux Gris** | 14 500 | 3 |
| meridien_automate | Automate de combat méridien | terre | char-robot **exclusif aux Gris**, produit gratuitement par leur superusine | 9 000 | 2 |

Bâtiments (tous capturables, gris neutre sans propriétaire) : **Ville** (revenus, soigne), **Usine** (produit les unités de terre), **Aéroport** (produit l'aérien), **Port** (produit le naval), **Station radar** (voit loin, brouille), **QG** (le prendre gagne la partie) ; deux QG nationaux existent déjà (France, Luxembourg), les 22 autres nations utilisent le QG commun. Il existe aussi un état **désaffecté** (bâtiment hors service qu'on remet en marche) et une **superusine** des Gris, sans image propre aujourd'hui.

## Ce qui est à l'écran autour du sprite (dessiné par le jeu, pas par l'image)

- Une ombre ovale sous chaque unité (plus petite et plus claire sous ce qui vole).
- Une **pastille de points de vie** (1 à 9) quand l'unité est entamée, avec un cadenas quand elle a joué ; une unité qui a joué passe à 60 % d'opacité et se fige.
- Au repos, l'armée du premier camp regarde vers la droite, les autres vers la gauche (les armées se font face, comme dans Advance Wars).
- Surbrillances de cases (vert : où je peux aller ; rouge : où je peux tirer), flèche de chemin, curseur.
- Saison, nuit et météo sont un étalonnage de toute l'image ; la nuit, les fenêtres des bâtiments s'allument.

## Comment les images sont fabriquées (pour que vos décisions soient faisables)

- Chaque unité et bâtiment est un **modèle 3D** (GLB). Ils ont été fabriqués **un par un, par des agents différents**, chacun avec son propre script, à partir d'une fiche texte ; aucune palette commune, aucune règle commune sur la part de couleur d'équipe, les proportions ou le niveau de détail. C'est très probablement la cause du manque de cohésion.
- Une **cuisson** (Blender, hors ligne) photographie chaque modèle sous **une seule caméra orthographique fixe**, inclinée à 50°, à 128 px par case, avec **un seul éclairage commun** (principale depuis l'avant-gauche, contour depuis l'arrière, ciel), rendu à 4× puis réduit. Pas de contour (outline) aujourd'hui.
- **La couleur d'équipe** : le modèle porte un masque en niveaux de gris ; à l'écran, `couleur affichée = couleur cuite × mélange(1, couleur d'équipe, masque)`. Donc une zone d'équipe doit être **claire** dans le modèle pour prendre la couleur de l'équipe ; une zone d'équipe plus sombre donne la couleur d'équipe foncée ; un masque à moitié donne une teinte pâle. Tout ce qui n'est pas masqué garde la couleur du modèle quel que soit le camp.
- **Les couleurs d'équipe possibles** : les 4 couleurs de camp (#3f86e0 bleu, #e04b45 rouge, #37b35a vert, #e9b93a or) et la couleur principale de chaque nation, qui va du bleu (#2f5fd0 France) au rouge (#c0392f Suisse, Canada, Pérou), à l'orange (#e2842a Inde), au vert foncé (#2f5f4f Nouvelle-Zélande) et même à un **gris-bleu ardoise (#5b6f86 Islande)**. Le neutre (bâtiment sans propriétaire) est #b9bec7. Votre règle doit marcher pour toutes.
- Tout se change : le modèle (sa forme, ses matières, son masque), l'éclairage de cuisson, un contour ajouté à la cuisson, les réglages de couleur, la taille de chaque unité dans sa case. Le jeu a déjà un « repli » dessiné par le code si une image manque. **Ne vous limitez pas à ce qui est facile** (sauf l'artiste technique, dont c'est le rôle de dire ce qui coûte quoi).

## Le canon actuel, que vous avez le droit de contester

Écrit dans le brief du propriétaire (6 septembre 2026) : « **Plutôt réaliste**, mais un conflit stratégique sérieux, affrontements non sanglants. Le réalisme est celui des **matières et de la lumière**, jamais celui des formes ni de la violence : **volumes simples et lisibles à trente pixels, proportions de figurine, couleurs franches, visages visibles**. La référence est une **maquette de diorama photographiée en studio**. »

Règles dures, non négociables : **aucun drapeau réel, aucun insigne réel, aucun texte lisible, aucune marque, pas de sang**. Un même modèle sert à toutes les nations (seules les couleurs changent). Les Gris : gris moyen et **badge orange #f0761e** du « matériel à l'essai » dans leurs portraits ; leurs trois unités exclusives n'ont aujourd'hui que la couleur de leur camp.

## Ce qu'on vous demande de rendre

Écrivez votre avis **en français, dans votre propre voix** (vous êtes ce personnage, parlez comme lui ou elle), dans le fichier indiqué dans votre consigne, avec **exactement ces sections** :

### A. Premier regard (5 lignes au plus)
Ce qui vous saute aux yeux, sans filtre.

### B. Les règles communes
Les règles qui rendraient l'ensemble cohérent, **concrètes et vérifiables** (par exemple « la couleur d'équipe couvre entre 35 et 50 % de la surface visible de toute unité », pas « plus de couleur »). Entre 6 et 15 règles.

### C. Les votes
Pour chacune de ces dix questions, une lettre et une phrase de raison (vous pouvez répondre « autre : … ») :
1. **Style** — a) garder le rendu actuel (maquette réaliste photographiée) et seulement l'uniformiser ; b) jouet peint / figurine : formes simplifiées, arêtes adoucies, peu de détails, couleurs franches ; c) cel-shading : aplats, ombres en deux ou trois tons, contour sombre, façon illustration ; d) autre.
2. **Contour** — a) aucun ; b) contour sombre fin (environ 1 px à 48 px par case) ; c) contour épais ; d) contour de la couleur de l'équipe.
3. **Part de couleur d'équipe sur une unité** — a) accents (10–20 %) ; b) la carrosserie principale (40–60 %) ; c) presque tout (70 % et plus, façon Advance Wars sur Game Boy Advance).
4. **Couleur des parties non teintées** — a) gris acier actuel ; b) un gris chaud ou beige clair commun ; c) un kaki/olive commun ; d) un gris très foncé, presque noir, commun ; e) autre.
5. **Proportions** — a) réalistes ; b) figurine exagérée (grosses tourelles, canons épais, roues énormes) ; c) entre les deux.
6. **Taille dans la case** — a) toutes les unités environ la même taille ; b) trois classes nettes (petite, moyenne, grande) ; c) autre.
7. **Socle** — a) aucun ; b) un socle pour l'infanterie seulement ; c) un socle pour toutes les unités, comme des pions de plateau.
8. **Infanterie** — a) une seule figurine ; b) un groupe de deux ou trois ; c) autre.
9. **Couleur d'équipe des bâtiments** — a) le toit entier ; b) toit ou façade principale plus drapeau ; c) drapeau et bandeau seulement.
10. **Les unités des Gris** — a) couleur de leur camp comme les autres ; b) toujours gris et orange, le camp ne se lisant que par un liseré ou un drapeau ; c) autre.

### D. Unité par unité (les 30)
Un tableau, une ligne par unité, dans l'ordre des planches :
| Unité | Verdict (garder / retoucher / refaire) | Ce qui doit se lire à 48 px (le signe qui la distingue des autres) | Où va la couleur d'équipe | Classe de taille | Remarque |

### E. Bâtiment par bâtiment (les 8, plus le désaffecté et la superusine s'ils vous inspirent)
| Bâtiment | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe, et à quoi on voit qu'il est neutre | Remarque |

### F. Vos trois priorités, et ce que vous refusez absolument
Les trois choses à faire en premier, dans l'ordre, et une à trois choses que vous refuseriez.

Contraintes de travail : **ne modifiez aucun fichier du dépôt** `/Users/thief/projets/atlas-tournaments` ; n'écrivez que votre propre fichier d'avis. Regardez vraiment les images (toutes), et zoomez mentalement sur la planche à 48 px : c'est elle que le joueur voit. Visez 1 500 à 3 000 mots.
