# Avis du panel — Julien, 36 ans, joueur d'Advance Wars (GBA, Dual Strike, Days of Ruin, AWBW chaque semaine)

J'ai tout regardé, puis recomposé les 30 images cuites à 48 px comme le fait le jeu, sur neuf sols et en huit couleurs d'équipe (les quatre camps, France, Islande, Nouvelle-Zélande, Inde). J'ai lu le dépôt sans rien y modifier. Les montages sont dans `scratchpad/julien-crops/` (`montage-equipes-48.png`, `montage-sols-48.png`, `montage-batiments-48-x2.png`).

### A. Premier regard

Six fabricants de maquettes, pas une armée : des jouets bleus (char moyen, missiles), un Sherman gris de musée (char léger), un bloc noir (artillerie), un olive (anti-air). À 48 px, une unité sur deux n'a pas de camp : 15 sur 30 ont moins de 20 % de couleur d'équipe, l'artillerie 1 %. L'autre moitié n'a pas d'identité : cinq camions-boîtes, trois hélicos, sept chars. L'infanterie, qui capture, est la plus petite et la plus sombre. Radar neutre et radar rouge ne diffèrent que d'un trait de 2 px, et le QG ressemble à une grange.

### B. Les règles communes

1. **La couleur d'équipe, c'est la carrosserie, et elle va sur les dessus.** Dans la vue `droite` à 48 px, elle couvre 50 à 65 % des pixels opaques de chaque unité (plancher 45 %, plafond 70 %), et au moins 40 % dans les vues `bas` et `haut`. La caméra à 50° voit surtout les dessus : caisse, tourelle, dessus d'ailes, pont, casque, épaules. Le masque est binaire et la zone est peinte en blanc.
2. **Une palette hors équipe, la même pour les 30.** Mécanique (chenilles, roues, canons, tubes, rotors, coque sous l'eau) : un seul anthracite `#3A3F46`. Munitions et caisses : crème `#E9E4D4`. Vitrages : bleu nuit `#1C2C38` avec un reflet. Peau : une seule teinte. Rien d'autre, ni gris acier ni olive.
3. **L'orange n'appartient qu'aux Gris.** Aucun feu, aucune verrière, aucune manche à air orange ailleurs. Chaque unité des Gris porte son badge : un losange `#F0761E` de 5 px à 48 px, cerclé de noir, toujours au même endroit sur le flanc avant.
4. **Un contour.** Un liseré continu `#14171B` de 1 px CSS à 48 px (environ 3 px sur l'image de 128), pales et antennes comprises. De préférence posé par le rendu, pour rester à 1 px à tous les zooms. C'est lui qui détache le bleu de la mer, le vert de la plaine et l'anthracite de la route.
5. **Chaque unité tient dans sa case.** Rien ne dépasse de plus de 0,47 case de part et d'autre du pivot (le char lourd en est à 0,59), ni de plus de 0,70 case au-dessus pour une unité au sol, 0,80 en vol (l'hélico en est à 0,83). Dans AW, une case égale une unité : on ne se trompe jamais sur ce qu'on pointe. *Sur la planche à 48 px, le pied des unités tombe près de la ligne basse de la case alors que les bâtiments sont centrés : vérifier si ça vient de la planche ou du jeu.*
6. **Trois gabarits.** Petit : 0,55 à 0,65 case de large. Moyen : 0,75 à 0,85. Grand : 0,90 à 0,97. La troupe à pied est à part : 0,45 à 0,55 de large pour 0,65 à 0,75 de haut.
7. **Le signe sort de la silhouette, et par le haut.** Il dépasse du volume d'au moins 20 % de sa largeur, fait au moins 3 px d'épaisseur à 48 px et se lit dans la moitié haute : la moitié basse est cachée par l'unité de devant et par la pastille de PV. Test de l'ombre chinoise : on noircit les 30 silhouettes à 48 px, et cinq joueurs doivent en nommer au moins 27.
8. **L'angle de l'arme dit le rôle.** Au contact, elle est horizontale et vise l'adversaire. En anti-aérien, levée de 60 à 80°. En tir indirect, de 30 à 45°. Une unité de soutien ne montre aucune arme. Le vocabulaire est le même partout : une boule-caméra sur un mât pour la vision, une antenne en arête de poisson pour le brouillage, une caisse crème pour le ravitaillement, et pas de verrière pour un drone.
9. **Rien de plus petit qu'un signe.** Aucun détail sous 6 px sur l'image de 128 : ni trappe, ni rivet, ni échelle, ni câble, ni gueule de requin, ni texte, ni forme qui rappelle un chiffre (l'antenne du recon fait un « 5 » juste à côté de la pastille de PV). Arêtes chanfreinées, peinture mate (rugosité d'au moins 0,6), ni chrome ni texture photo. Le décor aussi : le rocher granité jure avec le rocher lisse, et le pont vert se perd dans l'herbe.
10. **Au repos, on respire, on ne vise pas.** D'une image de `repos` à la suivante, la silhouette bouge d'au plus 1 px à 48 px et moins de 5 % des pixels changent, rotors exceptés. Une tourelle ne pivote jamais au repos. Le char léger change 20 % de ses pixels à l'arrêt et 0,8 % en roulant : c'est l'inverse de ce qu'il faut. Le veilleur, lui, dérive de 4 px.
11. **Des couleurs d'équipe jouables.** Sur une unité, la couleur affichée a une clarté L\* de 45 à 78 et une saturation C\* d'au moins 40 ; sinon, le jeu la corrige. L'Islande `#5B6F86` (C\* 15) rend un char aussi gris qu'un neutre, et la Nouvelle-Zélande `#2F5F4F` (L\* 37) disparaît en forêt. Deux camps d'une même carte sont séparés d'au moins ΔE 30 ; sinon, le second reprend sa couleur de camp (Suisse, Canada et Pérou partagent `#C0392F`). AW n'a jamais mis deux armées de la même couleur sur une carte.
12. **L'état se lit sans transparence.** Une unité qui a joué reste opaque et se désature (saturation −60 %, luminance −20 %), comme dans AW ; à 60 % d'opacité, elle se fond dans le sol et perd son camp. Le sous-marin plongé a sa propre image : kiosque et sillage.
13. **Les bâtiments suivent les mêmes lois.** Toit en couleur d'équipe (au moins 35 % des pixels) et un seul drapeau, celui du jeu. Le neutre se reconnaît au mât nu **et** au gris. Le QG est le plus haut (au moins 1,3 case), et chaque type a un toit que les autres n'ont pas.

### C. Les votes

1. **Style — b)** : le décor est déjà un jouet peint, la seule chose cohérente de la planche, et Re-Boot Camp a montré que ce style marche dès que la couleur d'armée couvre la carrosserie (il ne rate qu'en pastel brillant).
2. **Contour — b)** : sans lui, le bleu se perd sur la mer, le vert sur la plaine et l'anthracite sur la route ; un pixel sombre rendait AW lisible à 16 px, alors qu'un contour épais mangerait les signes.
3. **Part d'équipe — b)**, dans le haut de la fourchette (50 à 65 %), ce qui correspond à AW une fois le contour décompté ; au-delà de 70 %, on sait à qui est l'unité mais plus ce qu'elle est, parce que ses signes (chenilles, canons, rotors) sont la partie non teintée.
4. **Non teinté — d)**, un anthracite commun `#3A3F46` plus du crème pour les munitions : c'est la couleur des chenilles d'AW, et il tranche sur toutes les couleurs de camp sans passer pour l'une d'elles, alors que le gris acier actuel se lit « neutre » ou « Gris ».
5. **Proportions — b)** : à 48 px, une tourelle, un tube ou une roue n'existe que s'il est exagéré, et le char moyen le prouve face au char léger.
6. **Taille — b)**, trois gabarits (0,60 / 0,80 / 0,95 case) et la troupe à pied à part : la taille dit « lourd » avant la forme, à condition de ne jamais mordre chez le voisin.
7. **Socle — a)** : AW n'en a jamais eu besoin puisque la carrosserie dit le camp, et un socle sous deux fantassins sur trois, comme aujourd'hui, cumule les défauts des deux solutions.
8. **Infanterie — a)**, un seul bonhomme trapu aux couleurs de l'équipe, comme dans AW : le groupe, c'est l'écran de combat qui le montre (une figurine par PV), et deux figurines qui se chevauchent font une tache à 48 px.
9. **Bâtiments — b)**, le toit entier, puisque c'est ce que voit la caméra, plus le drapeau du jeu, dont l'absence dit « neutre » même quand la couleur trompe (Islande).
10. **Les Gris — a)**, plus le badge orange fixe et des formes à eux (hexagones, œil unique) : depuis que le joueur peut commander les Gris (les quatre secrets), un match Gris contre Gris existe, et il serait illisible en gris et orange permanents.

### D. Unité par unité (les 30)

| Unité | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe | Classe | Remarque |
|---|---|---|---|---|---|
| 1. Infanterie | refaire | un seul soldat debout, gros casque, fusil en travers, visage clair | casque, veste, pantalon ; arme, bottes et sac en anthracite | pied | Deux soldats anthracite à 10 % : l'unité qui capture est la plus sombre du plateau et disparaît en forêt. |
| 2. Méca | refaire | soldat trapu, gros tube sur l'épaule qui dépasse devant et derrière (1,3 fois le corps) | casque, tenue ; tube anthracite, bout crème | pied | 3 %, deux figurines sur un socle gris. Dans AW, le bazooka en travers suffit à tout dire. |
| 3. Génie | retoucher | soldat qui lève une grosse clé ou une pelle, casque de chantier à bord large | casque, tenue (58 %) | pied | Le seul fantassin lisible, grâce à sa couleur. Garder une figurine sur les deux, retirer le socle, lever l'outil. |
| 4. Recon | retoucher | petite caisse basse, quatre grosses roues, mât court à boule-caméra | toute la caisse | petit | 8 %. L'antenne en boucle dessine un « 5 ». Il a six roues de rover lunaire, quatre suffisent. |
| 5. Char léger | refaire | petite tourelle ronde à l'avant, canon court et fin, galets visibles | caisse et tourelle entières | moyen (0,78) | **Le « char presque tout gris qui bouge beaucoup » que le propriétaire a vu, c'est lui, pas le char moyen.** 9 % d'équipe (3 % de dos), et c'est le seul véhicule de terre qui s'agite au repos : sa tourelle balaie, 20 % de ses pixels changent d'une image à l'autre (1 % pour le char moyen), plus qu'en roulant. Le plus beau modèle du lot, et le plus mal lu. Avec 1,05 case de large, il mord chez ses deux voisins. À refaire dans la famille du char moyen, en plus petit. |
| 6. Char moyen | garder (retouche légère) | grosse tourelle carrée qui couvre la caisse, canon long et épais à frein de bouche | caisse et tourelle (55 %) | moyen (0,85) | **L'étalon : toutes les unités de terre doivent être de sa famille.** Il n'est ni gris (54 à 60 % d'équipe dans toutes ses vues et tous ses clips) ni agité (1,2 % au repos). Si le panneau a dit « Char moyen » sur un char gris qui bougeait, c'est qu'il a nommé le voisin : les deux sprites se chevauchent (léger +0,52 case à droite, moyen −0,53 à gauche), et l'atelier nomme l'unité survolée avant l'unité sélectionnée. C'est la règle 5 prise en défaut. Retouche : ôter les feux orange, ramener le débord gauche à 0,47. |
| 7. Char lourd | retoucher | double canon, tourelle à deux étages, la caisse la plus large | caisse et tourelle entières | grand | 18 %, et seulement sur les jupes. Doit être le grand frère du char moyen. |
| 8. Anti-air | refaire | tourelle ouverte, deux paires de canons levés à 70° | caisse et tourelle | moyen | Le seul olive du lot, 16 %, canons couchés : à 48 px, un char de plus. Des canons tournés vers le ciel, c'est tout son rôle. |
| 9. Artillerie | refaire | long tube levé à 40°, plateforme ouverte, bêche à l'arrière | caisse et bouclier | moyen | 1 % : aucun camp. Son tube pointe à l'opposé de là où elle regarde (vues droite, bas, profil) : l'artillerie bleue vise son propre camp. |
| 10. Lance-roquettes | refaire | caisson levé à 35°, face avant criblée de bouches, sur camion | cabine et caisson, dessus compris | grand | 9 % : le dessus du caisson, c'est-à-dire ce que voit la caméra, est gris. |
| 11. Lance-missiles sol-air | refaire | quatre missiles crème courts, presque verticaux (70°) | camion et berceau | grand | Même boîte bleue que le sol-sol ; seules les roues les séparent, ce qui revient à rien à 48 px. |
| 12. Lance-missiles sol-sol | refaire | un ou deux gros missiles crème couchés à 35° sur un long châssis | châssis et cabine | grand | La pièce de terre la plus chère (16 000) mérite la silhouette la plus spectaculaire, pas une boîte. |
| 13. Transport | retoucher | caisse chenillée sans arme, caisses crème à l'arrière, rampe | toute la caisse | moyen | 16 %. L'absence d'arme dit « soutien », comme pour le VBT d'AW. |
| 14. Brouilleur mobile | retoucher | antenne en arête de poisson qui dépasse de 0,3 case | tout le camion | moyen | Aujourd'hui, un camion de plus avec une petite parabole. |
| 15. Hélicoptère | refaire | fuselage fin, ailettes chargées de roquettes, rotor à deux pales nettes | fuselage et poutre de queue | moyen | 7 %, anthracite, gueule de requin. Le rotor flou fait un halo de fumée. |
| 16. Transport d'assaut | retoucher | deux rotors, avant et arrière, gros fuselage carré | tout le fuselage | moyen | Le jumeau bleu de l'hélico gris : une autre couleur, pas une autre forme. |
| 17. Chasseur | garder (retouche) | ailes en flèche, deux dérives, nez pointu | ailes et dessus du fuselage | moyen (déclaré grand) | Bon. Verrière bleu nuit plutôt qu'orange, et plus petit que le bombardier. |
| 18. Bombardier | refaire | la plus grande envergure du ciel, ailes droites, quatre moteurs | ailes et fuselage | grand | Aujourd'hui, un petit bimoteur de la taille du chasseur. |
| 19. Chasseur furtif | garder (retouche) | aile volante plate à facettes, sans dérive | tout le dessus | moyen (déclaré grand) | La meilleure silhouette du ciel. Ôter les feux orange. |
| 20. Drone d'observation | refaire | croix à quatre rotors, boule-caméra dessous, sans patins | corps et bras | petit | Un mini-hélicoptère, aussi gros que les deux vrais et confondu avec eux. |
| 21. Drone intercepteur | retoucher | étoile à quatre pointes (à garder) et deux petits missiles crème pointés vers le haut | l'étoile (74 %, à ramener vers 65) | petit | La silhouette la plus nette du ciel. La réduire de 0,76 à 0,60 case et lui donner le signe anti-air. |
| 22. Drone ravitailleur | refaire | croix à quatre rotors, caisse crème suspendue | corps et bras | petit | Ses rotors carénés ressemblent à deux volants de voiture : la forme la plus énigmatique de la planche. |
| 23. Barge | refaire | coque plate et basse, grande rampe avant relevée, radier vide | radier et rampe ; flancs anthracite | moyen | 5 % : sur la mer, un rectangle sombre sans camp. |
| 24. Cuirassé | refaire | coque longue à proue pointue, deux tourelles aux canons levés à 35° | pont, tourelles, superstructure | grand | Aujourd'hui, une coque ronde d'aéroglisseur. Un cuirassé est long, et c'est de l'artillerie. |
| 25. Porte-avions | refaire | le plus grand rectangle plat de la carte, îlot latéral, piste en tirets sans chiffres | tout le pont d'envol et l'îlot | grand | 11 % : un palet de hockey sombre. Un pont en couleur d'équipe, rien ne serait plus lisible sur la mer. |
| 26. Sous-marin | retoucher | cigare long et bas sur l'eau, kiosque haut avec périscope | dessus de coque et kiosque | moyen | Bonne couleur (63 %), mais cet œuf passe pour un dirigeable. L'allonger, l'enfoncer à mi-coque, lui donner une image « plongé ». |
| 27. Drone marin | retoucher | petite vedette pointue sans cabine, mât à boule-caméra | pont | petit | Aujourd'hui, un catamaran de 0,80 case ; le ramener à 0,60. |
| 28. Veilleur méridien | retoucher | grande croix à quatre rotors, antenne en arête de poisson dessous, badge orange | corps et bras | moyen | 13 %. C'est le brouilleur du ciel : il prend l'antenne du brouilleur. Il dérive de 4 px au repos. |
| 29. Bastion méridien | retoucher | tourelle hexagonale à quatre canons levés à 70°, badge orange | caisse et tourelle | grand | Son pont gris clair passe en couleur d'équipe ; l'hexagone devient la signature des Gris. |
| 30. Automate de combat méridien | refaire | robot sur deux grosses jambes, torse carré, bras-canon, œil orange unique | torse et blindage des jambes | moyen | Aujourd'hui, un septième char. Un robot a des jambes : ce serait la seule unité à pattes hors fantassins, et la superusine qui en produit un par jour prendrait tout son sens. |

### E. Bâtiment par bâtiment

| Bâtiment | Verdict | Ce qui doit se lire à 48 px | Couleur d'équipe, et comment on voit le neutre | Remarque |
|---|---|---|---|---|
| Ville | retoucher | deux ou trois maisons à toits à deux pans, la seule image faite de plusieurs toits | tous les toits ; neutre : toits gris `#B9BEC7`, mât nu | Les tuiles terre cuite ne changent jamais et couvrent l'essentiel de l'image : bleue, rouge ou neutre, la ville ne se distingue que par un panneau de porte. Dans AW, les villes, c'est ce qu'on compte. |
| Usine | retoucher | toit en dents de scie, haute cheminée, porte roulante | dents de scie et porte ; neutre gris, mât nu | Le cadre ajouré a l'air d'un échafaudage. La dent de scie, c'est l'icône de l'usine partout. |
| Aéroport | refaire | une piste sombre à pointillés, une tour de contrôle, un hangar à toit rond | toit du hangar, haut de la tour ; neutre gris | Le cercle au sol évoque un héliport. La manche à air orange passe en couleur d'équipe. |
| Port | retoucher | grande grue en L, quai en U, entrepôt | toute la grue et le toit de l'entrepôt | Déjà le plus lisible des six, grâce à sa grue colorée : l'agrandir. |
| Station radar | retoucher | grande parabole sur pylône | toute la parabole ; neutre : parabole grise, mât nu | La parabole reste toujours grise, et la couleur tient dans un trait de 2 px. Or c'est le bâtiment qui compte le plus sous brouillard. |
| QG (commun) | refaire | le plus haut bâtiment de la carte (au moins 1,3 case), une tour à toit pointu sous le grand pavillon du jeu | toits et bannière verticale en façade ; jamais neutre | Une remise sur un terre-plein brun, avec un drapeau gris qui ne change jamais : on lit une ferme. |
| QG France | refaire | la règle du QG, plus une touche nationale dans la toiture (toit à la Mansart, lucarnes) | toits et bannière | Identique au QG luxembourgeois, avec un toit brun qui ne prend jamais la couleur. Le modèle porte déjà un drapeau et le jeu en pose un second (on le voit sur la capture) : un seul suffit. |
| QG Luxembourg | refaire | la règle du QG, plus une tour de forteresse crénelée | toits et bannière | Deux QG nationaux identiques, c'est zéro QG national. |
| Désaffecté | refaire (une variante par bâtiment) | le même bâtiment, planches en X aux fenêtres, un pan de toit manquant, mât nu | aucune ; gris terni | Le jeu se contente de ternir : à 48 px, désaffecté et neutre se confondent, alors que l'un rapporte une prime. |
| Superusine (Gris) | créer | une usine géante à triple dent de scie, deux cheminées, un portique, un grand badge orange | dents de scie à la couleur du camp ; badge orange fixe | Une fois capturée, donc inerte, elle garde son badge mais ses cheminées s'éteignent. |

### F. Mes trois priorités, et ce que je refuse

**Priorités :**

1. **La couleur et la palette, avant toute forme.** Repeindre les masques pour que les 30 unités tiennent la règle 1, passer à une palette unique hors équipe, supprimer l'orange hors des Gris, poser le contour et corriger les couleurs de nation (Islande, Nouvelle-Zélande, doublons). C'est une passe de matériaux et une recuisson, sans remodeler. Après ça, je sais à qui est chaque unité, quel que soit le sol : c'est la moitié du problème, et la moins chère.
2. **Les silhouettes des groupes qu'on confond, dans cet ordre.** La troupe à pied (un bonhomme, un accessoire qui dépasse), les camions-boîtes (distingués par l'angle de l'arme), les chars (char léger dans la famille du moyen, anti-air aux canons levés, artillerie tournée dans le bon sens), les voilures tournantes (drones en croix), puis les navires. Chaque lot doit passer le test de l'ombre chinoise à 48 px, sur un vrai téléphone.
3. **Les bâtiments.** Toit entier en couleur d'équipe, un seul drapeau, parabole colorée, QG plus haut que tout, désaffecté à planches.

**Je refuse :**

- Toute unité sous 45 % de couleur d'équipe, aussi belle et détaillée soit-elle. Le char léger est le plus beau modèle du lot et le moins lisible, au point que le propriétaire l'a pris pour un autre.
- Des Gris figés en gris et orange : un match Gris contre Gris existe désormais, et le gris appartient au neutre.
- Le détail de maquette invisible à 48 px, les textures photo, et toute pièce qui bouge au repos. Une tourelle qui balaie à l'arrêt, c'est une unité qui ment sur son état.
