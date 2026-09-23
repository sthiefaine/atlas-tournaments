# Avis de Marc, artiste technique : les sprites d'Atlas Tournament

*23 septembre 2026. J'ai lu le dossier, ouvert les neuf images et lu `mesures-unites.md`. J'ai aussi lu la chaîne de cuisson (`scripts/sprites/reglages.ts`, `blender/cuire_entree.py`, `image.ts`, sa note `doc/refonte/sprites-cuisson.md`), le contrat, le nuanceur du lot, les générateurs des deux chars, du recon, du méca, du sous-marin et de la ville, et les six `preparer-source.py` des modèles importés. J'ai mesuré les 30 images cuites moi-même : lumière reçue par les zones d'équipe, mouvement au repos, débords de case. J'ai aussi simulé, grossièrement et sur les images finales, quatre retouches de cuisson. Les scripts et les planches sont dans `scratchpad/marc/` : `mesurer.py`, `essai.py`, `essai-{herbe,sable,neige,mer}-x2.png`. Je n'ai rien modifié dans le dépôt.*

## A. Premier regard

1. Ce n'est pas un lot, c'est deux jeux et demi. Six modèles sortent de Tripo (infanterie, char léger, anti-air, artillerie, barge, QG), avec leur surface de scan grise et bruitée. Vingt-cinq générateurs paramétriques font des jouets propres à pans chanfreinés. Et deux fantassins sont posés sur des socles que personne d'autre n'a.
2. La couleur d'équipe va de 1 % (artillerie) à 75 % (drone intercepteur). À 48 px, un tiers de l'armée rouge est grise, donc à personne : dans ce jeu, le gris clair veut justement dire « neutre ».
3. Tout est plus sombre que l'herbe : 28 unités sur 30 ont au plus 2 % de pixels plus clairs qu'elle. Rien n'est cerné, quinze unités font plus de 0,90 case de large, et trois débordent franchement de leur case. On voit des taches sombres qui se touchent.
4. Les navires sont des galets ronds, les deux lance-missiles sont des jumeaux, et le drone d'observation est un hélicoptère de poche.
5. La bonne nouvelle : une seule caméra, une seule lumière, une cuisson propre et mesurée. Le défaut est en amont, dans ce qu'on lui donne à photographier.

## B. Les règles communes

Chaque règle se mesure par du code, sur le GLB ou sur l'image cuite. Sauf mention contraire, les mesures portent sur la vue `droite`, clip `repos`, image 0.

1. **Une seule lumière, rééquilibrée.** Blanc horizontal à 1,00, face tournée vers le joueur à 0,68 ± 0,03 (0,61 aujourd'hui), flanc à l'ombre à 0,45 ± 0,03 (0,30 aujourd'hui). Se mesure sur un cube blanc ajouté à la calibration existante.
2. **La part d'équipe**, c'est-à-dire la part des pixels de silhouette dont le masque vaut au moins 0,5 : 40 à 55 % pour les véhicules, les aéronefs et les navires ; 35 à 50 % pour les fantassins ; 30 à 45 % pour les bâtiments (sans l'ombre portée ni le drapeau du jeu). Tolérance de ±8 points dans les vues `bas` et `haut`. Aujourd'hui, **5 unités sur 30** sont dans la bande.
3. **L'équipe sur les dessus, d'un seul tenant.** Au moins 60 % des pixels d'équipe reçoivent 0,80 de lumière ou plus (on le lit directement : c'est la valeur cuite du blanc). À 48 px, la plus grande zone d'équipe d'un seul tenant porte au moins 60 % de la couleur d'équipe de l'image : pas de bandes sur les flancs. Aujourd'hui, 15 unités sur 30 échouent la première condition (infanterie 7 %, artillerie 2 %, roquettes 3 %, transport 9 %, char léger 10 %).
4. **Un neutre commun.** Hors équipe, cinq matières seulement : caoutchouc `#26282b`, graphite `#45484d`, acier sombre `#6b6f75`, acier clair `#9a9ea3` (10 % des pixels au plus) et verre `#1f3a48` (4 % au plus). Les accents saturés (peaux, feux ambre `#d89b47`, badge des Gris) font 3 % au plus. Mesures : L* moyen hors équipe entre 24 et 36, chroma moyen hors équipe inférieur ou égal à 6, écart de couleur moyenne hors équipe entre deux unités ΔE ≤ 5.
5. **Le gris clair appartient au neutre des bâtiments.** Aucune unité n'a plus de 10 % de pixels hors équipe au-dessus de L* 65. Le recon (20 %) et les roquettes (30 %) échouent aujourd'hui. Seule exception : le gris Méridien des trois unités exclusives des Gris.
6. **Un contour cuit.** Un anneau antialiasé de 2,5 px à 128 px par case (≈ 1 px CSS à 48 px par case) autour de la couche `couverture`, jamais autour de l'ombre portée. Il est cuit à 0,30 sous un masque de 1, si bien qu'à l'écran il vaut couleur d'équipe × 0,30 : `#132843` pour le bleu, `#431715` pour le rouge. Pour un bâtiment neutre, `#b9bec7` × 0,30. Pour le décor, 0,35 × sa propre couleur, à 50 % d'opacité.
7. **Trois gabarits.** Aire de silhouette : 0,25 case² en classe 1, 0,34 en classe 2, 0,45 en classe 3, à ±10 % près. Ce sont les rapports 0,85 / 1 / 1,18 que le rendu applique déjà à l'ombre. Largeur de 0,90 case au plus. Hauteur de 0,95 case au plus au sol, 1,05 en l'air altitude comprise. Contour compris, dans toutes les vues et toutes les images. Aujourd'hui, 15 unités sur 30 dépassent 0,90 case de large, dont trois plus d'une case, et l'infanterie fait 0,15 case².
8. **Rien de trop fin.** Aucune pièce qui porte le sens sous 4 cm (2 px CSS à 48 px par case). Canon de 5 cm de diamètre au moins, roue de 18 cm au moins, tourelle d'au moins 55 % de la largeur de caisse, tête de fantassin au 1/4,5 de sa hauteur. Contrôle : une ouverture morphologique de 1,3 px sur l'image cuite enlève au plus 3 % de la silhouette.
9. **Un signe par unité.** À 48 px, les silhouettes binarisées de deux unités d'un même domaine ne se recouvrent jamais à plus de 80 % (IoU après recentrage). Candidats évidents à l'échec aujourd'hui, à confirmer par la mesure : les deux lance-missiles, les trois engins à rotor sur patins (hélicoptère, transport d'assaut, drone), le char léger et l'anti-air.
10. **Un repos calme.** Entre deux images de `repos`, au plus 3 % des pixels changent pour une unité au sol (26,5 % pour le char léger aujourd'hui), au plus 15 % pour un aéronef hors pales déclarées. Aucune pièce ne tourne de plus de 2°.
11. **Des altitudes normalisées.** Bas de silhouette au repos : 0,20 m pour les rotors, 0,30 m pour les avions, 0,25 m pour les drones à voilure, ±2 cm. Aujourd'hui elles vont de 0 à 0,33 m, au hasard des agents.
12. **Des surfaces de jouet, pas de scan.** Chanfrein d'au moins 1,5 cm sur toute arête de caisse (c'est lui qui fait l'arête claire). Aucune salissure ni grain peint. Contrôle : la variance du laplacien sur les zones hors équipe reste sous 1,5 fois celle du char moyen.
13. **Un navire ne touche jamais l'eau avec sa couleur d'équipe.** Coque graphite sous le pont, ligne de flottaison claire `#d8d2c4` de 3 à 5 cm. Le rendu pose sous tout navire une écume claire à la place de l'ombre. Le bleu de camp contre l'eau de plaine ne fait que ΔE 20.
14. **Une couleur d'équipe bornée, dans le rendu.** La couleur affichée tient dans la fenêtre L* 42 à 78, chroma 30 ou plus. Sinon on prend le premier accent de la nation qui passe, et à défaut la couleur relevée à teinte égale. Deux camps d'une même carte gardent ΔE ≥ 25 entre eux ; sinon le second prend la couleur de son camp. Échouent aujourd'hui : l'Islande `#5b6f86` (chroma 15, gris sur graphite ; elle passe à son accent rouge `#c04a52`, relevé) et la Nouvelle-Zélande `#2f5f4f` (L* 37, qui devient `#008768`).
15. **Une seule fabrication.** Plus aucun modèle image-vers-3D. Tout générateur importe la bibliothèque commune (G.3) et passe la charte (règles 2 à 13, G.4) avant d'entrer au manifeste. Une entrée refusée garde son repli.

## C. Les votes

1. **b.** Jouet peint, photographié. Vingt-cinq modèles sur trente et tout le décor parlent déjà cette langue. Je garde la lumière physique de la cuisson, la meilleure chose du lot, et je sors le « scan ». Le cel-shading demanderait une autre chaîne pour un gain que le contour donne presque en entier.
2. **b**, en variante teintée. Un contour fin (2,5 px à la cuisson), sombre, pris dans la couleur d'équipe à 30 %. C'est le trait d'Advance Wars : il détache l'unité du sol *et* porte le camp, même sur une unité peu peinte. Un contour de pleine couleur d'équipe (d) se fondrait dans la carrosserie.
3. **b.** 40 à 55 %, mesurés sur l'image et placés sur les dessus. À 70 %, la forme se noie : le drone intercepteur à 75 % est un shuriken, et l'Islande n'aurait plus de camp.
4. **d.** Un graphite foncé commun (`#45484d`, chenilles `#26282b`, acier 10 % au plus). Le gris clair veut déjà dire « à personne », le beige disparaît sur le sable et la neige, le kaki se bat avec le camp vert et l'herbe. Le foncé fait sortir toutes les couleurs d'équipe.
5. **b.** Figurine exagérée, mais chiffrée : 4 cm minimum, canons de 5 cm, roues de 18 cm, tourelles à 55 % de la caisse (règle 8).
6. **b.** Trois classes nettes, aux rapports que le rendu applique déjà à l'ombre, et jamais plus de 0,90 case de large.
7. **a.** Aucun socle : l'ellipse d'ombre du rendu *est* le socle. Les deux socles actuels (méca gris, génie bleu) sont précisément deux incohérences.
8. **a.** Une figurine, grande (0,72 case de haut). Deux bonshommes de 0,15 case² ne font que du bruit sur 8 mm, et l'écran de combat montre déjà une figurine par PV.
9. **b.** Le toit entier, ou la grande surface horizontale qui en tient lieu, plus le drapeau du jeu : 30 à 45 % de l'image. Aujourd'hui c'est 4 à 19 %, et la ville aux tuiles rouges se lit « rouge » pour tout le monde.
10. **a.** Couleur de leur camp, comme les autres : à 48 px, le camp prime sur la faction. Leur identité passe par un neutre de faction (gris Méridien `#8f9499` à la place du graphite), une langue de forme (pans coupés, cadres d'essai) et un badge orange de 2 % au plus.

## D. Unité par unité

Les classes sont celles déclarées ; je propose d'en changer deux, signalées par « proposé ». « Rôle 5 promu » veut dire que la tuile d'atlas des panneaux gris passe au masque (G.1).

| Unité | Verdict (garder / retoucher / refaire) | Ce qui doit se lire à 48 px (le signe qui la distingue des autres) | Où va la couleur d'équipe | Classe de taille | Remarque |
|---|---|---|---|---|---|
| 1. Infanterie | refaire | une figurine seule, debout, casque rond, fusil en travers, sac à dos, visage clair | casque, veste, sac (≈ 45 %) | 1, 0,72 case de haut | Groupe Tripo : 10 % d'équipe et 60 % de pixels sous L* 35, soit une tache noire. C'est l'unité la plus nombreuse et celle qui capture : premier refait. |
| 2. Méca | refaire (sur le squelette du génie, un seul corps) | silhouette trapue, tube lance-roquettes sur l'épaule qui dépasse devant et derrière (Ø ≥ 8 cm) | casque, plastron, sac (≈ 45 %) ; tube graphite, bouche en acier | 1, un cran plus large que l'infanterie | 3 % d'équipe (les crêtes de casque) et un socle gris à retirer. |
| 3. Génie | refaire (squelette gardé, un corps, sans socle) | casque de chantier à bord, outil à long manche sur l'épaule | casque, gilet (≈ 45 %) | 1 | Ses 59 % viennent surtout du socle bleu. Le socle part, et la couleur remonte sur le corps. |
| 4. Recon | retoucher (masque, roues) | petit engin à six roues énormes (Ø ≥ 20 cm), capot bas, mât-capteur court | capsule et capot (rôle 5 promu, ≈ 45 %) | 1 | 8 % : sa capsule gris clair se lit « neutre ». |
| 5. Char léger | refaire | le plus petit des chars : caisse basse, tourelle ronde centrée, canon court | dessus de caisse et tourelle (≈ 50 %) | 2 | Tripo, 9 % d'équipe, en bandes sur des flancs qui ne reçoivent que 0,59 de lumière. Surface de scan, gris clair que l'œil prend pour du neutre. **C'est lui qui « bouge beaucoup »** : son `repos` (`scripts/char_leger/preparer-source.py`, l. 79) fait balayer toute la tourelle de ±0,25 rad (±14°) en rampe linéaire. Échantillonné à 5 images/s, cela donne un saut de 4,8° par image, et 26,5 % des pixels changent d'une image à l'autre (1,4 % pour le char moyen). Le retour du propriétaire, « quasiment toute grise » et « bouge beaucoup », décrit cette unité trait pour trait. En attendant le refait, borner ce repos à ±2°. |
| 6. Char moyen | garder (gabarit, contour, rabot léger) | tourelle anguleuse large, canon moyen à frein de bouche | caisse et tourelle (55 %, à ramener à 50 % en passant les jupes au graphite) | 2 | C'est l'étalon du lot : le seul char déjà dans la charte (équipe sur les dessus, lumière reçue 0,84). Au repos, sa tourelle tourne de ±0,014 rad (±0,8°) : il ne bouge pas. Si le panneau a dit « Char moyen » sur une unité grise qui bouge, c'est très probablement le voisin. Dans l'atelier, le char moyen occupe la colonne juste à droite du char léger (`UNITES_BANC`, colonnes 8 et 9), et `vueInspectionBanc` nomme la case sous le curseur **avant** la sélection : en allant vers la colonne de droite, la souris passe sur lui. À faire confirmer par qui tient l'atelier. |
| 7. Char lourd | retoucher (masque, gabarit, canon) | le plus large : double jupe, grosse tourelle, canon long et épais (Ø ≥ 7 cm) | dessus de caisse et tourelle (≈ 50 %) | 3 | 18 %, en bandes sur les flancs : à côté du char moyen, il se lit comme une autre armée. Il n'a que 8 % d'aire de plus que le char léger ; il lui en faut un tiers. |
| 8. Anti-air | refaire | caisse chenillée, tourelle ouverte à deux tubes courts levés à 45°, petit radar | caisse et flancs de tourelle (≈ 45 %) | 2 | Tripo, et kaki (`#5b5f5a`) : la seule unité olive du lot. À 48 px, c'est un char léger de plus. Son radar qui tourne au repos (nœud 4) peut rester, c'est un bon signe. |
| 9. Artillerie | refaire | un long tube unique levé à 30° qui dépasse la caisse, bêches à l'arrière | affût, caisse et bouclier (≈ 45 %) | 2 | 1 % d'équipe, L* 36, lumière reçue 0,48 : invisible dans les deux camps. Le tube levé est tout le signe du tir indirect. |
| 10. Lance-roquettes | retoucher (masque, caisson incliné) | camion portant un caisson de tubes incliné à 25–30°, face avant en grille sombre | cabine et flancs du caisson (≈ 45 %) | 3 | Caisson plat gris clair, 9 % d'équipe, 30 % de pixels plus clairs que l'herbe : aujourd'hui, c'est un camion porte-conteneur. |
| 11. Lance-missiles sol-air | retoucher lourd (module supérieur refait) | 2 × 2 tubes dressés vers le ciel à 60° et un panneau radar | châssis et cabine (≈ 45 %) ; tubes en acier clair | 3 | Un grand bloc bleu sur roues, jumeau du sol-sol. Les deux doivent se distinguer par ce qu'ils portent, pas par les roues contre les chenilles. |
| 12. Lance-missiles sol-sol | retoucher lourd | un gros missile couché sur un érecteur à 20–30°, ogive claire | châssis et érecteur (≈ 45 %) | 3 | Même bloc que le sol-air, et 0,97 case de haut : il couvre la case du dessus. |
| 13. Transport | retoucher (masque, chargement) | chenillé bas à benne ouverte, caisses et jerricans visibles | cabine et ridelles (≈ 45 %) | 2 | 16 %, sur des faces avant (lumière reçue 0,54). La benne pleine dit « ravitaille ». |
| 14. Brouilleur | retoucher (masque, parabole) | camion à roues portant une grande parabole claire (Ø ≥ 0,3 case) | cabine et coffre (≈ 45 %) | 2 | 27 %. La parabole est tout le signe, et aujourd'hui elle est petite et grise dans le gris. |
| 15. Hélicoptère | retoucher | fuselage fin, ailettes à paniers de roquettes, un rotor | fuselage et dérive (≈ 45 %) | 2 | 7 %, et une verrière teintée énorme qui fait un trou noir : la réduire et l'éclaircir. |
| 16. Transport d'assaut | retoucher lourd | cabine-caisse et **deux rotors en tandem** | cabine (≈ 50 %) | 2 | Avec un seul rotor, il se confond avec l'hélicoptère et le drone. Le flou de son rotor change 57 % des pixels au repos : c'est normal, mais à borner. |
| 17. Chasseur | garder (gabarit) | flèche, ailes en flèche, deux dérives | voilure et dérives (45 %) | 2 (proposé ; 3 déclaré) | Déjà dans la charte, mais il fait la même largeur que le bombardier (0,80). |
| 18. Bombardier | retoucher (gabarit, moteurs) | grandes ailes droites, deux moteurs sous les ailes, fuselage épais | voilure (≈ 45 %) | 3 | Doit passer de 0,81 à 0,90 case : c'est le plus gros avion. |
| 19. Chasseur furtif | retoucher (rabot, épaisseur) | aile volante en losange, sans dérive | voilure hors bords d'attaque (≈ 50 %) | 2 (proposé) | 63 %, et plat comme un cerf-volant en papier : bords d'attaque en graphite, bosse centrale. |
| 20. Drone d'observation | refaire | petit avion aux ailes droites très longues, boule-caméra claire sous le nez | fuselage et ailes (≈ 45 %) | 1 | Aujourd'hui, c'est un hélicoptère de poche sur patins, le troisième de la famille. |
| 21. Drone intercepteur | retoucher (forme, rabot) | fléchette delta à trois pointes, deux petits missiles clairs | fuselage et dos des ailes (≈ 50 %) | 1 | 75 % : un shuriken bleu. Trop d'équipe tue la forme. |
| 22. Drone ravitailleur | retoucher (masque, caisse) | deux rotors carénés, une caisse claire suspendue dessous | carénages et corps (≈ 45 %) | 1 | 66 % de ses pixels sont sous L* 35. La caisse claire est le signe « ravitaille ». |
| 23. Barge | refaire | coque plate ouverte, rampe avant relevée, petite passerelle à l'arrière | flancs au-dessus de la flottaison et rampe (≈ 45 %) | 2 | C'est un remorqueur Tripo (`assets/sources/tripo_tugboat`), à 5 % d'équipe : ni barge ni lisible. |
| 24. Cuirassé | refaire la coque | coque longue à étrave pointue (longueur ≥ 2,5 fois la largeur), deux tourelles à canons épais, superstructure au centre | pont et superstructure (≈ 45 %) ; coque graphite, flottaison claire | 3 | Une coque ovale d'aéroglisseur : à 48 px, un jeton rond. |
| 25. Porte-avions | refaire la coque | pont rectangulaire long, îlot à tribord, bande de piste claire en tirets | îlot, bordé du pont et flancs (≈ 40 %) ; pont graphite | 3 | 11 %, un disque sombre. Le pont reste sombre pour que la piste claire se lise. |
| 26. Sous-marin | retoucher | coque en cigare basse et longue, kiosque haut et net | kiosque et dos de coque (≈ 45 %) ; bas de coque graphite | 2 | 64 % : une gélule de bain bleue, et bleue sur la mer bleue. Le kiosque est le signe. |
| 27. Drone marin | retoucher (masque) | petit catamaran bas, mât-capteur | pont et mât (≈ 45 %) ; flotteurs graphite à liseré clair | 1 | 29 %. |
| 28. Veilleur méridien | retoucher | quadrirotor qui porte une parabole claire | corps et bras (≈ 45 %) ; neutre gris Méridien, badge orange ≤ 2 % | 2 | Langue de forme des Gris (C.10). Au repos, les rotors changent 37 % des pixels : à borner. |
| 29. Bastion méridien | retoucher | caisse à pans coupés, affût double à longs tubes et panneau radar ; plus gros que l'anti-air | tourelle et dessus de caisse (≈ 45 %) | 3 | 20 %. Son gris clair actuel (rôle 5) devient le neutre de faction. |
| 30. Automate de combat méridien | refaire le haut | un buste de robot (torse, tête-capteur à œil ambre, deux bras-canons) sur chenilles | torse et épaules (≈ 45 %) | 2 | Aujourd'hui, c'est un char de plus. Un « char-robot » doit se lire robot d'abord. |

## E. Bâtiment par bâtiment

| Bâtiment | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe, et à quoi on voit qu'il est neutre | Remarque |
|---|---|---|---|---|
| Ville | retoucher (masque) | trois maisons à toits pointus autour d'une cour | tous les toits (≈ 35 %) ; neutre : toits gris froid `#b9bec7` sur murs crème, sans drapeau | Les tuiles en terre cuite disent « rouge » quel que soit le propriétaire : c'est le pire défaut des bâtiments. Il se corrige en une ligne, `'equipe':[2]` → `[2,5]` dans `textures.py` (la tuile est le rôle 5). |
| Usine | retoucher | toit en sheds (dents de scie) et cheminée | sheds et portique (≈ 40 %) ; porte roulante en équipe sombre | La plus lisible aujourd'hui (19 %), mais il lui manque le signe « usine » vu du dessus. |
| Aéroport | refaire | bande de piste sombre à tirets clairs, tour de contrôle à cabine vitrée, hangar voûté | toit du hangar et tour (≈ 35 %) | Aujourd'hui, un héliport (une dalle, un cercle), 7 % d'équipe. Or il produit chasseurs et bombardiers. |
| Port | retoucher | quai en U et grue | grue et toit d'un entrepôt (≈ 35 %) | 14 %. La grue fonctionne déjà ; il manque une surface horizontale teintée. |
| Station radar | retoucher | grande parabole claire (le signe) sur un bunker | toit du bunker et pied de la parabole (≈ 30 %) | 4 % : la propriété ne se lit que par le drapeau. |
| QG | refaire | le bâtiment le plus haut de la carte : un corps et une tour centrale à dôme | toits et tour (≈ 40 %) | Tripo : une parcelle de terre brune (la seule du jeu), un fanion gris non teint, une texture d'équipe marbrée. Pas de fanion dans le modèle : le drapeau du jeu suffit. |
| QG France / QG Luxembourg | retoucher (masque) | grande maison à toit en croupe | toit brun → équipe (≈ 35 %) | 6 %. Identiques à 48 px : leur donner chacun un seul signe de toit (mansarde, clocheton) s'ils doivent être nationaux, et retirer leur fanion, qui double celui du jeu. |
| Désaffecté | pas de modèle propre | même image, zones d'équipe forcées au neutre, désaturée (`TEINTE_DESAFFECTE` existe), plus une **bâche générique** posée par la cuisson sur l'enveloppe du toit et des planches sur la porte | aucune couleur d'équipe | Un seul modèle de bâche pour les huit bâtiments. Jamais de ruine. |
| Superusine (Gris) | faire | usine agrandie à la façon des Gris : hall à pans coupés, bras d'assemblage, tapis d'où sort une silhouette d'automate, haute cheminée | toits (≈ 40 %) ; neutre gris Méridien, badge orange ≤ 2 % | 0,95 case de large et 1,1 de haut : il n'y en a qu'une par carte, elle peut dominer. |
| Pavillon du jeu | cuire | drapeau de toile, huit images d'ondulation, masque blanc | tout le tissu | Il est aujourd'hui dessiné à plat par le code : la seule image vectorielle au milieu des photographies. |

## F. Mes trois priorités, et ce que je refuse

1. **La cuisson d'abord : deux jours, aucun modèle touché.** Lumière rééquilibrée, rampe neutre commune, contour sombre teinté d'équipe, gabarits par classe ; côté rendu, la couleur d'équipe bornée et l'écume sous les navires. On recuit tout (82 minutes) et les trente unités gagnent le même jour.
2. **Ramener la part d'équipe dans la bande.** Une table des rôles teints pour les 25 générateurs paramétriques et les bâtiments (toits en équipe, tuiles de la ville comprises). Et des `repos` bornés, la tourelle du char léger d'abord.
3. **Refaire les six modèles Tripo sur une bibliothèque commune, avec la charte branchée avant la première livraison** : infanterie, char léger, artillerie, anti-air, barge, QG.

Je refuse :

- **Tout nouveau modèle image-vers-3D dans le lot**, même « nettoyé » : ce sont eux qui font les deux jeux.
- **Toute correction de look unité par unité dans le rendu** (un coefficient, une teinte ou une échelle par clé d'unité dans `render2d/`). Cela se règle à la source ou à la cuisson, sous la charte, sinon la dérive recommence en silence.
- **Monter à 70 % d'équipe, ou passer au cel-shading maintenant.** Le premier noie les formes et laisse l'Islande sans camp. Le second jette une chaîne de lumière qui marche, pour un gain que le contour donne aux trois quarts.

## G. Comment le fabriquer

### G.1 À la cuisson seule (deux jours de travail, puis 82 minutes de recuisson)

Toutes ces retouches sont dans `scripts/sprites/`. Il faut passer `VERSION_CUISSON` de 1 à 2, puisque le script Blender change.

1. **La lumière.** Dans `reglages.ts`, `ECLAIRAGE` : la principale passe de 2,2 à 1,62 et le ciel de 0,3 à 0,45 ; le contour reste à 0,8. Le blanc horizontal reste à 1,00, la face tournée vers le joueur monte de 0,61 à 0,68 et le flanc à l'ombre de 0,30 à 0,45. Les flancs cessent d'être noirs, et les zones d'équipe mal placées remontent.
2. **La rampe neutre.** Dans `cuire_entree.py`, `modifier_materiaux` : avant le mélange du masque, la couleur de base passe par sa luminance, puis par une rampe à quatre arrêts (caoutchouc, graphite, acier sombre, acier clair, règle 4). On épargne les pixels saturés (saturation > 0,3 : peaux, feux, badge). Cela supprime le kaki de l'anti-air, les bruns de Tripo et l'écart de `#424647` à `#717172`. En revanche, une surface bruitée ne devient pas propre pour autant.
3. **Le contour.** Dans `image.ts`, on part de la couche `couverture` à l'échelle 4 (jamais de l'alpha, qui compte l'ombre au sol), on trace un anneau de 10 px, puis on réduit : 2,5 px antialiasés. Couleur cuite 0,30, masque 1. Aucune ligne de nuanceur ne change, puisque `mix(vec3(1.0), équipe, m)` fait le reste.
4. **Les gabarits.** Dans `cuire_entree.py`, `importer` : `pivot.scale = √(aire cible ÷ aire mesurée)`, avec une table par entrée dans `reglages.ts` calculée sur la cuisson précédente. Canevas et pivots suivent seuls, puisqu'ils sont calculés sur les enveloppes évaluées. La règle « un modèle livré n'est jamais mis à l'échelle » venait de la 3D, qui n'existe plus.
5. **Le masque par rôle.** Les 25 générateurs paramétriques d'unités et les 5 bâtiments partagent le même atlas 4 × 4 : le rôle *r* occupe la tuile (*r* mod 4, *r* div 4), et le masque ne couvre aujourd'hui qu'un ou deux rôles (le 0 pour les unités, 0 et 13 pour le méca et le génie, le 2 pour la ville). Une table `ROLES_EQUIPE` par entrée, appliquée au masque que la cuisson charge déjà elle-même, fait entrer dans la bande le recon, les roquettes, l'hélicoptère, le char lourd, le transport et les tuiles de la ville, sans régénérer un GLB. On reporte ensuite la table dans chaque `textures.py`, pour que le GLB et l'image disent la même chose. Raboter le furtif, l'intercepteur ou le sous-marin, en revanche, demande de changer le rôle de quelques pièces dans `generer.ts`.
6. **Dans le rendu, une demi-journée.** La couleur d'affichage (règle 14) dans `couleurEquipeDe`, l'écume des navires dans `posesUnites`, et le pavillon cuit comme une entrée de plus.

**Ce que ça donne.** Ma simulation est plus grossière que la vraie retouche, puisqu'elle s'applique aux images finales. À 48 px, sur l'herbe, le sable, la neige et la mer, les 30 unités disent leur camp. Le char léger gris et l'artillerie à 1 % se lisent par leur contour bleu nuit ou rouge sombre. Les fantassins passent de 0,15 à 0,25 case². **Ce que ça ne donne pas**, et l'essai le montre aussi. Les Tripo, dont j'ai dû promouvoir l'équipe au hasard de la luminance, sortent tachetés : leurs masques ne se rattrapent pas à la cuisson. Une fois cernés, les navires ronds ressemblent encore plus à des jetons. Et sans la règle 14, l'Islande reste grise sur graphite.

### G.2 Ce qui oblige à reprendre les modèles

- **À refaire** (0,5 à 1 jour chacun avec la bibliothèque) : infanterie, char léger, anti-air, artillerie, barge, QG commun ; le haut de l'automate, le drone d'observation, l'aéroport ; la superusine à créer.
- **À retoucher en forme** (2 à 4 h chacun) : les deux lance-missiles, les rotors en tandem, les coques du cuirassé et du porte-avions, le sous-marin, les moteurs et la taille du bombardier, le caisson des roquettes, la parabole du brouilleur, la verrière de l'hélicoptère, l'intercepteur et le ravitailleur, et un seul corps sans socle pour le méca et le génie.
- **Masque seul** (une ligne, puis régénération, contrôle et 3 à 4 minutes de recuisson) : recon, char lourd, transport, drone marin, veilleur, bastion, usine, port, radar, QG France et Luxembourg.

### G.3 La bibliothèque commune

Aujourd'hui, chaque dossier recopie ses aides et son `gltf.ts` (plusieurs copies identiques de 10 708 octets), et une palette copiée qui a dérivé : le gris d'équipe va de 160 à 188, le graphite de 50 à 62. Je propose `scripts/production/kit/`, importé par les 38 générateurs :

- **`matieres.json`**, la seule palette : rôles, albédo, rugosité, métal, statut (équipe, équipe sombre cuite à 0,55 sous masque, neutre, accent), et l'atlas 4 × 4 figé, du rôle à la tuile. Une deuxième section pour les bâtiments : murs crème, pierre, bois `#8a6a4a`, végétation ; et le pont vert, qui se confond avec l'herbe, y passe au bois.
- **`gltf.ts`** : un seul exporteur.
- **`primitives.ts`** : boîte et panneau chanfreinés (1,5 cm minimum), cylindre dont le nombre de côtés suit le diamètre, tube, carène.
- **`organes.ts`** : train de chenilles, roue, tourelle, canon, rotor, hélice carénée, coque de navire (étrave, flottaison claire), figurine humaine sur squelette (tête au 1/4,5), parabole, érecteur, avec les minima de la règle 8 intégrés.
- **`gabarits.ts`** : les classes et les altitudes (règles 7 et 11).
- **`clips.ts`** : `repos`, `deplacement`, `tir`, `touche` et `hors_jeu` paramétrés par classe, dans les bornes de la règle 10 ; les rotors sont les seuls libres.

Un générateur ne décrit plus que ses pièces, leurs rôles et sa classe.

### G.4 Les contrôles à la livraison

Ce sont les règles 2 à 13, dans `tests/sprites/charte.test.ts`, qui lirait le manifeste comme le fait déjà `manifeste.test.ts`. Ils portent sur toutes les vues et toutes les images, et on y ajoute trois choses :

- un masque binaire, avec au plus 4 % de valeurs intermédiaires hors des bords ;
- un pivot posé au sol à ±2 px ;
- une robustesse de palette : chacune des 28 couleurs d'équipe et le neutre gardent ΔE ≥ 25 entre la zone d'équipe et le neutre moyen.

Côté GLB, `controler:asset` vérifierait les rôles, les dimensions, les altitudes et l'amplitude des clips, pour qu'un modèle faux soit refusé avant même d'être cuit. Un contrôle rouge bloque l'entrée, et le repli reste à l'écran.

### G.5 L'ordre de travail

1. **J1–J2.** G.1, points 1 à 4, plus la couleur d'affichage et l'écume. On recuit tout, et on compare avant et après à 48 px sur les quatre sols.
2. **J3.** La table des rôles ; le rabot du furtif, de l'intercepteur et du sous-marin ; le `repos` du char léger borné à ±2°, car il est en jeu ce soir.
3. **Semaine 1.** La bibliothèque, extraite du char moyen, du transport et de l'automate, les plus propres, et la charte en tests. Ils seront rouges le premier jour : c'est la liste de travail, et elle se vide.
4. **Semaines 1–2.** Les six Tripo, infanterie d'abord : c'est la plus nombreuse, celle qui capture, et le seul endroit où l'on voit des visages. Puis char léger, artillerie, anti-air, barge, QG.
5. **Semaines 2–3.** Les formes, puis les bâtiments : aéroport, QG, superusine, pavillon cuit, bâche du désaffecté.
6. **Ensuite.** Si l'écran de combat agrandit ses figurines, cuire la vue `profil` à 256 px par mètre au lieu de 128, sinon elle sera floue.
