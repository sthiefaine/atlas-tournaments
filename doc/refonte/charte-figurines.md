# La charte des figurines — 23 septembre 2026

« Regarde, il n'y a pas de cohésion graphique, et c'est moche. Mets cinq agents pour décider des sprites de chaque unité et de chaque bâtiment : un joueur invétéré d'Advance Wars, un ado, une femme, une designeuse graphique… » Puis, devant la barge et l'hélicoptère : « on voit encore les triangles des modèles ratés, il faut refaire de zéro, un par un, un agent sur chaque unité. »

Ce document est la synthèse de ce panel et la **charte** que suivent les trente agents d'unité. Les cinq avis complets, dans la voix de chacun, sont dans `panel-sprites/` : Julien, 36 ans, joueur d'Advance Wars sur AWBW chaque semaine ; Noah, 15 ans, joueur sur téléphone ; Claire, 38 ans, joueuse de Fire Emblem et d'Into the Breach qui n'a jamais joué à Advance Wars ; Léa, 31 ans, designeuse graphique, qui a tenu la charte des sprites d'un studio mobile ; et, en cinquième, Marc, 47 ans, artiste technique des sprites précalculés de la génération StarCraft, pour dire ce qui se corrige à la cuisson et ce qui oblige à refaire. Ils ont travaillé seuls, sur les mêmes planches composées exactement comme le jeu (`panel-sprites/dossier.md`) ; ces planches vivaient dans un dossier temporaire et n'ont pas été gardées, les mesures l'ont été (`panel-sprites/mesures-avant.md`). La charte est la décision du propriétaire, déléguée au panel ; elle remplace, pour les modèles, ce que la direction artistique de `BRIEF.md` disait des matières et des couleurs.

## 1. Ce que le panel a vu, et qui se mesure

- **La couleur d'équipe va de 1 % (artillerie) à 75 % (drone intercepteur)** des pixels d'une unité ; 15 unités sur 30 sont sous 20 %, 5 à 6 seulement dans une bande raisonnable. L'unité la moins chère, celle qui capture, est la plus sombre du plateau.
- **Six modèles viennent d'un générateur image-vers-3D** — infanterie, char léger, artillerie, anti-air, barge, QG — et ce sont eux qui montrent des facettes, des textures sales, du kaki, un remorqueur à la place d'une barge. Les vingt-quatre autres sont des générateurs Three.js écrits un par un par des agents différents, chacun avec sa copie des aides et de la palette, qui ont dérivé (le gris d'équipe va de 160 à 188, le graphite de 50 à 62).
- **Aucune règle de taille** : le drone à 3 000 est aussi grand que le chasseur à 20 000, le porte-avions a la taille d'un char, le char léger (1,05 case de large) dépasse le char moyen (0,93), et quinze unités débordent de plus de 0,90 case.
- **Le « char moyen gris qui bouge beaucoup » était le char léger.** Sa tourelle balaie ±14° au repos : 15 à 20 % de ses pixels changent d'une image à l'autre, contre 0,2 à 1 % pour le char moyen. Les deux sont voisins sur le banc, leurs images se chevauchent (le léger déborde de 0,52 case à droite, le moyen de 0,53 à gauche), et l'atelier nomme l'unité **survolée** avant l'unité sélectionnée : en allant vers la colonne, la souris passe sur le char moyen.
- **L'artillerie vise son propre camp** (son tube pointe à l'opposé de sa vue), les rotors sont des disques flous, et l'orange des feux (recon, chars, lance-missiles) mange la signature des Gris.

## 2. Les votes

| Question | Vétéran | Ado | Joueuse | Designeuse | Technique | Décision |
|---|---|---|---|---|---|---|
| 1. Style | jouet | jouet | jouet | jouet | jouet | **jouet peint** (unanime) |
| 2. Contour | fin sombre | fin sombre | fin sombre | fin sombre | fin, teinté d'équipe | **fin sombre**, cuit |
| 3. Part d'équipe | 40–60 % | 40–60 % | 40–60 % | 40–60 % | 40–60 % | **carrosserie** (unanime) |
| 4. Neutres | foncé commun | foncé + clair | foncé + clair | foncé (+ os) | foncé commun | **graphite + os** |
| 5. Proportions | exagérées | exagérées | sur le signe | entre deux | exagérées | **exagérées sur le signe** |
| 6. Tailles | 3 classes | 3 classes | 3 classes | 3 classes | 3 classes | **trois classes** (unanime) |
| 7. Socle | aucun | aucun (anneau du jeu) | fantassins | aucun | aucun | **aucun dans les modèles** |
| 8. Infanterie | une figurine | une | une | une | une | **une figurine** (unanime) |
| 9. Bâtiments | toit + drapeau | toit + drapeau | toit + drapeau | toit + drapeau | toit + drapeau | **toit + drapeau** (unanime) |
| 10. Les Gris | couleur de camp | camp + langue à eux | camp + langue à eux | camp + langue à eux | couleur de camp | **couleur de camp, plus leur signature** |

## 3. La charte

Chaque règle se mesure ; les seuils vivent dans `scripts/production/figurines/charte.json`, que lit toute la chaîne.

### 3.1 La palette, fermée

Métallicité nulle partout : c'est de la peinture. La matière se dit par la rugosité et le chanfrein, jamais par un bruit.

| Rôle | Couleur | Rugosité | Où | Plafond |
|---|---|---|---|---|
| Équipe | blanc sous masque binaire | 0,35 (laque) | carrosseries, casques, dessus | voir 3.3 |
| Graphite | `#30343b` | 0,6 | châssis, dessous, armes, tubes, rotors, patins | 20–35 %, en bas |
| Caoutchouc | `#222428` | 0,9 | chenilles, pneus | dans la masse sombre |
| Os | `#d8d0bf` | 0,6 | caisses, bidons, missiles, moyeux, bâches, pistes, flottaison | 12 % |
| Acier clair | `#aab0b7` | 0,6 | bouches de canon, rails, charnières | 3 % |
| Verre | `#22313b`, reflet peint `#cfe2ec` au tiers haut | 0,08 | verrières, vitres | 8 % |
| Peaux | `#c48f65` infanterie, `#8d5a3b` méca, `#e3b48f` génie | 0,6 | visages, mains | — |
| Feux | `#f3ead2` | — | phares, jamais d'ambre | 1 % |
| Contour | `#15181d` | — | hors silhouette | — |
| Apprêt — **Gris seulement** | `#8b9097` | 0,6 | superstructures des trois prototypes | 25 % |
| Orange d'essai — **Gris seulement** | `#f0761e`, émissif | — | un œil et un chevron | 4–6 % |
| Bâtiments | enduit `#e2dbcb`, pavé `#8e8778`, bois `#8a6a4a` | 0,6 / 0,9 / 0,9 | murs, socles et quais, pont | — |

Au plus six teintes par unité, équipe comprise. **Le gris moyen et l'orange appartiennent aux Gris** : plus de gris acier ni de feux orange ailleurs, plus de kaki nulle part.

### 3.2 Les formes

- **Jouet peint** : des volumes simples, une couleur unie par pièce, **toute arête chanfreinée** (au moins 1,5 cm) et **lissée** — aucune facette visible à la cuisson.
- **Rien de trop fin** : aucune pièce qui porte le sens sous 5 cm dans sa plus petite dimension (3 cm pour une antenne), soit 2 px à 48 px par case.
- **Au plus sept pièces lisibles**, et le **signe** distinctif est la plus grosse après le corps, **exagéré de ×1,5 à ×2** (canon, tubes, rotor, outil, parabole, tête) : c'est la seule chose qu'on lit à 7 mm.
- **Aucun détail peint** : ni texte, ni chiffre, ni lettre, ni insigne, ni camouflage, ni salissure. Seuls motifs permis : les tirets de piste et le chevron des Gris.
- **Deux masses** : le sombre (graphite, caoutchouc) en bas, l'équipe au-dessus ; la moitié haute plus claire que la moitié basse.

### 3.3 La couleur d'équipe

- **45 à 60 %** des pixels en vue `droite` (fantassins 40 à 55 %), **au moins 40 %** en vues `bas` et `haut`.
- Portée par **des pièces entières** et **par les dessus** (caisse, tourelle, ailes, pont, casque) : c'est ce que voit une caméra inclinée à 50°. Des bandes sur les flancs ne comptent pas.
- **D'un seul tenant** : à 48 px, la plus grande zone d'équipe porte au moins 60 % de la couleur d'équipe de l'image.
- **Masque binaire**, 0 ou 1, jamais entre les deux ; sous le masque, la cuisson met du blanc.

### 3.4 Les tailles

Largeur de la silhouette en vue `droite`, contour compris :

| Classe | Largeur | Unités |
|---|---|---|
| Fantassin | 0,45–0,60 case de large, 0,68–0,75 de haut | infanterie, méca, génie |
| Petite | 0,60–0,68 | recon, drone, drone intercepteur, drone ravitailleur, drone marin |
| Moyenne | 0,76–0,84 | char léger (bas de classe), char moyen (haut), anti-air, artillerie, transport, brouilleur, hélicoptère, transport d'assaut, barge, sous-marin, veilleur, automate |
| Grande | 0,88–0,94 | char lourd, lance-roquettes, lance-missiles sol-air et sol-sol, chasseur et furtif (bas de classe), bombardier (haut), cuirassé, porte-avions, bastion |

Rien au-delà de ±0,47 case du pivot : **une unité tient dans sa case**, comme dans Advance Wars. Hauteur au-dessus du pivot : 0,70 case au sol, 0,85 en vol. Dans une famille, le plus cher n'est jamais le plus petit (char léger < moyen < lourd, drones < hélicoptère < avions, drone marin < barge < cuirassé ≤ porte-avions). Altitude du bas de la silhouette au repos : 0,20 m pour ce qui a un rotor, 0,25 m pour les drones, 0,30 m pour les avions.

### 3.5 Les poses et les signes

- En vue `droite`, **nez, étrave et bouche vers la droite** : on vise l'adversaire.
- Au repos : **tir direct à l'horizontale**, **tir indirect relevé de 30 à 45°**, **anti-aérien dressé de 60 à 70°** ; une unité de soutien ne montre **aucune arme**.
- Un vocabulaire commun : la **boule-caméra claire** pour ce qui voit loin (recon, drone, drone marin) ; les **caisses os** pour ce qui ravitaille ; le **mât d'antennes en arête de poisson** pour ce qui brouille (brouilleur, veilleur) — jamais une parabole, qui se confondrait avec la station radar ; les **tubes dressés** pour ce qui tire en l'air.
- Deux unités d'un même milieu ne se recouvrent jamais à plus de 75 à 80 % en ombre chinoise à 48 px.

### 3.6 Le repos

Au plus **3 % des pixels changent** entre deux images de repos d'une unité au sol, **15 %** pour ce qui vole, pales exceptées. **Aucune pièce ne pivote de plus de 2°** — sauf les rotors et une parabole radar qui tourne. Un seul signe de vie : une respiration, une antenne, un rotor.

### 3.7 Les gens

Une **seule figurine** par unité à pied, 4 à 4,5 têtes, la tête au quart de la hauteur, **un visage nu** d'au moins 5 × 5 px à 128 px par case en vues `droite` et `bas`, le couvre-chef et la veste en couleur d'équipe, ni visière ni casque intégral, **aucun socle**. On commande des gens, et l'infanterie ne doit pas ressembler aux robots de l'adversaire. Les trois fantassins ont chacun leur teint : une armée n'est pas une seule personne.

### 3.8 Ce qui vole, ce qui flotte

Rotors à deux, trois ou quatre pales **opaques**, jamais un disque flou. Navires : **coque graphite sous le pont, bande de flottaison os** de 3 à 5 cm, l'équipe ne touche jamais l'eau ; le jeu posera une écume sous eux.

### 3.9 Les Gris

Leurs trois prototypes (veilleur, bastion, automate) prennent **la couleur de leur camp** comme tout le monde — un joueur qui joue un secret des Gris veut ses couleurs, et une armée grise se confondrait avec les bâtiments neutres. Leur signature est ailleurs : **l'apprêt `#8b9097`** au lieu du graphite sur leurs superstructures, des **formes à facettes** (hexagones, octogones, chanfreins marqués), un **œil orange émissif** d'au moins 4 × 4 px à 48 px et un **chevron** orange. Personne d'autre ne porte d'orange.

### 3.10 Le contour et la lumière (la cuisson)

- Un **contour** `#15181d` d'environ 3 px à 128 px par case (1 px à 48), autour de la **silhouette seule** — calculé sur la couverture du modèle, jamais sur l'ombre au sol —, jamais dans le masque d'équipe. Opacité : unités 100 %, bâtiments et pont 85 %, décor 60 %. Il détache le bleu de la mer, le vert de la plaine et deux unités voisines.
- **Une lumière symétrique** : la moitié de l'armée est dessinée en miroir, et une lumière d'avant-gauche l'éclairait à contre-jour. La principale vient désormais **de face, du joueur, à 60°** de hauteur ; les flancs ne sont plus noirs (0,45 au lieu de 0,30), le blanc horizontal reste à 1,00. Les ombres tombent derrière les objets.

### 3.11 La couleur d'équipe à l'écran (le rendu)

La couleur multiplie un blanc ombré : trop sombre, elle tombe dans le graphite ; sans chroma, elle devient un gris. Le rendu **projette** donc chaque couleur de nation dans une fenêtre lisible (OKLab L 0,60–0,76, chroma ≥ 0,10) en gardant sa teinte : l'Islande (`#5b6f86`, un gris) devient un bleu glacier `#5283ba`, la Nouvelle-Zélande (`#2f5f4f`) un vert `#339377`, la France `#4578ec`, la Suisse, le Canada et le Pérou `#d44c40`, l'or `#d9aa23`. Et **deux camps d'une même carte** restent à ΔE ≥ 25 l'un de l'autre, sinon le second reprend la couleur de son camp : Suisse, Canada et Pérou partagent aujourd'hui la même couleur.

### 3.12 Les bâtiments

Le **toit entier** (ou la grande surface qui en tient lieu) en couleur d'équipe, **30 à 45 %** de l'image, et **le drapeau du jeu**, toujours au même coin, d'au moins 6 × 4 px à 48 px. **Neutre : le même bâtiment, toit `#b9bec7` et mât nu** — jamais de drapeau gris. Chaque type a un toit que les autres n'ont pas. **Le QG est le plus haut bâtiment du jeu.**

## 4. Ce que le panel n'a pas tranché, et comment je l'ai tranché

- **Le signe du brouillage.** Parabole (ado, designeuse, technique), anneaux (joueuse), arête de poisson (vétéran). Une parabole se lit « radar », et la station radar en porte déjà une : **mât d'antennes en arête de poisson**, pour le brouilleur comme pour le veilleur.
- **L'automate des Gris.** Tout le monde veut un robot ; sur quatre pattes (ado), deux jambes (vétéran, joueuse, designeuse) ou des chenilles (technique) : **deux jambes courtes et trapues**, torse carré, tête-capteur à œil orange, bras-canon. C'est la seule unité à pattes hors fantassins, et la superusine en crache une par jour.
- **Le char lourd.** Double canon (ado, vétéran, designeuse) contre canon unique à frein de bouche (joueuse, technique) : **double canon**, le seul du jeu, qui le sépare du char moyen à 48 px.
- **Le porte-avions.** Pont sombre à piste claire (joueuse, designeuse, technique) ou pont d'équipe (ado, vétéran) : **pont d'équipe, piste os en tirets par-dessus**. Sombre, le pont laissait le navire le plus cher à 40 % d'équipe, et c'est la plus grande surface qu'on voie sur la mer.
- **Le drone intercepteur.** Étoile gardée (ado, vétéran, joueuse) contre fléchette delta (designeuse, technique) : **l'étoile**, la silhouette la plus nette du ciel, ramenée de 75 % à 50 % d'équipe et de 0,76 à 0,64 case, avec deux mini-missiles os dressés.
- **Le contour** cuit (quatre voix) plutôt que posé par le rendu (vétéran) ; sombre et neutre (quatre voix) plutôt que teinté d'équipe (technique) : avec 45 à 60 % d'équipe, le camp se lit sans lui.
- **Le socle** : aucun dans les modèles. L'anneau d'équipe dessiné par le jeu sous chaque unité (ado) n'est pas retenu pour l'instant.

## 5. Unité par unité

« Nœuds » : ceux que la fiche exige (`assets/specs/unite_<clé>_base.json`) ; un nœud peut être vide, mais il doit exister et porter le rôle dit.

| Unité | Classe | Ce qui se lit à 48 px | Équipe | Pose et repos | Nœuds de la fiche |
|---|---|---|---|---|---|
| Infanterie | fantassin | **un** soldat debout, casque rond, fusil tenu en travers, visage clair ; un petit fanion d'équipe sur le sac (c'est lui qui prend les villes) | casque, veste, pantalon, fanion | respiration ; fusil graphite, sac et bottes graphite | `racine, corps, base, socle` |
| Méca | fantassin | un soldat trapu au gilet épais, **gros tube** sur l'épaule qui dépasse devant et derrière (1,3 fois le corps), bout os | casque, gilet | tube graphite, bout os | `module_lance_roquettes` = le tube |
| Génie | fantassin | **casque de chantier** à bord large, **grande clé** levée, caisse à outils os | casque, bleu de travail | l'outil levé est le signe | `module_radar` = un petit détecteur sur le sac |
| Recon | petite, 0,64–0,68 | caisse basse arrondie, **quatre grosses roues**, mât court à **boule-caméra** os ; penché vers l'avant | toute la caisse | aucune arme ; pas d'antenne en boucle (elle dessinait un « 5 » à côté de la pastille de PV) | `module_radar` = le mât caméra |
| Char léger | moyenne, 0,76–0,79 | le plus petit des chars : **tourelle ronde** basse posée vers l'avant, **canon court et fin**, quatre galets, deux caisses os | caisse et tourelle entières | tourelle **immobile** au repos | `module_tourelle` |
| Char moyen | moyenne, 0,82–0,84 | **l'étalon** : tourelle carrée qui couvre la caisse, canon long et épais à frein de bouche, cinq galets | caisse et tourelle (55 %) | ni feux orange ni débord | `module_tourelle, module_canon_long` |
| Char lourd | grande, 0,90–0,94 | le plus large : tourelle à deux étages, **double canon** épais côte à côte, six galets, jupes | caisse et tourelle entières, pas seulement les jupes | le grand frère du char moyen | `module_tourelle, module_canon_long` |
| Anti-air | moyenne, 0,80–0,84 | tourelle ouverte, **canons jumeaux épais dressés à 65°**, petite parabole radar | caisse et tourelle | la parabole peut tourner lentement | `module_tourelle, module_radar` |
| Artillerie | moyenne, 0,80–0,84 | long tube **relevé à 40° vers la droite**, plateforme ouverte, bêche à l'arrière, bouclier | châssis et bouclier | elle ne vise plus son propre camp | `module_canon_long` |
| Lance-roquettes | grande, 0,88–0,92 | camion à roues, **caisson de tubes relevé à 35°**, face avant criblée de bouches rondes | cabine et caisson, dessus compris | — | `module_lance_roquettes` |
| Lance-missiles sol-air | grande, 0,88–0,92 | camion à roues, **quatre missiles os courts dressés à 70°** sur un berceau, petit panneau radar | camion et berceau | l'angle le sépare du sol-sol | `module_lance_roquettes, module_radar` |
| Lance-missiles sol-sol | grande, 0,92–0,94 | long châssis chenillé, **un gros missile os couché à 30°** qui dépasse devant ; la pièce de terre la plus spectaculaire | châssis et cabine | — | `module_lance_roquettes, module_antenne` |
| Transport | moyenne, 0,78–0,82 | caisse chenillée **sans arme**, benne pleine de **caisses et bidons os**, rampe arrière | cabine et flancs de benne | plus de petite grue de dépanneuse | `module_grue` = la rampe |
| Brouilleur mobile | moyenne, 0,78–0,82 | camion à roues portant un **mât d'antennes en arête de poisson** d'au moins 0,3 case, plus haut que la cabine | cabine et caisse | pas de parabole | `module_radar, module_antenne` |
| Hélicoptère | moyenne, 0,78–0,82 | fuselage fin au nez pointu (une forme, pas des dents peintes), ailettes à **deux paniers de roquettes**, rotor à **deux pales nettes** | fuselage et poutre de queue | vol à 0,20 m ; rotor qui tourne, pales opaques | `module_nacelle` = les paniers |
| Transport d'assaut | moyenne, 0,82–0,84 | gros fuselage carré à **deux rotors en tandem**, porte latérale ouverte | tout le fuselage | vol à 0,20 m ; aucune arme | `module_grue` = le treuil de porte |
| Chasseur | grande, 0,88–0,90 | nez pointu, **ailes en flèche**, deux dérives, verrière de verre | ailes et dessus du fuselage | vol à 0,30 m ; plus d'orange | `racine, corps, base, socle` |
| Bombardier | grande, 0,92–0,94 | **la plus grande envergure du ciel**, ailes droites, quatre moteurs, ventre rond | ailes et dessus | vol à 0,30 m | `module_nacelle` = la soute |
| Chasseur furtif | grande, 0,88–0,90 | **aile volante triangulaire à facettes, sans dérive**, rien de dressé sur le dos | dessus de l'aile ; bord d'attaque graphite | vol à 0,30 m ; ni ressort ni feux orange | `module_antenne` = une antenne plate |
| Drone d'observation | petite, 0,60–0,64 | **quadrirotor en X**, gros **œil-caméra** os dessous, ni patins ni verrière | corps et bras | vol à 0,25 m | `module_antenne` |
| Drone intercepteur | petite, 0,62–0,66 | **l'étoile à quatre branches**, réduite, deux mini-missiles os dressés | l'étoile (≈ 50 %) | vol à 0,25 m | `module_radar` |
| Drone ravitailleur | petite, 0,62–0,66 | quadrirotor en X, **caisse os suspendue** dessous | corps et bras | vol à 0,25 m ; plus de rotors carénés en « volants » | `module_grue, module_nacelle` |
| Barge de débarquement | moyenne, 0,80–0,84 | coque plate et basse, **grande rampe avant relevée**, radier vide, petite passerelle arrière | flancs au-dessus de la flottaison et rampe | coque graphite, flottaison os ; léger tangage | `module_grue` = la charnière de rampe |
| Cuirassé | grande, 0,92–0,94 | coque longue à **proue pointue**, **deux tourelles** aux canons levés à 35°, superstructure au milieu | pont, tourelles, superstructure | plus de bouée ronde sur pieds | `module_tourelle, module_canon_long` |
| Porte-avions | grande, 0,92–0,94 | **le plus grand rectangle plat** de la carte, **piste os en tirets** sans chiffres, îlot sur le côté | pont d'envol et îlot | le navire le plus cher, le plus lisible | `module_antenne, module_radar` = sur l'îlot |
| Sous-marin | moyenne, 0,78–0,80 | **cigare long et bas**, à mi-coque dans l'eau, **kiosque haut** avec périscope | dessus de coque et kiosque | plus d'œuf qui passe pour un dirigeable | `module_antenne` = le périscope |
| Drone marin | petite, 0,60–0,66 | petite vedette pointue **sans cabine**, mât court à **boule-caméra** | pont | coque graphite, flottaison os | `module_radar, module_antenne` |
| Veilleur méridien | moyenne, 0,78–0,82 | hexacoptère **à facettes**, plus gros que le drone, **mât d'antennes en arête de poisson**, œil orange, chevron | corps et bras (≥ 40 %) ; apprêt | vol à 0,25 m ; il ne dérive plus au repos | `module_radar, module_antenne` |
| Bastion méridien | grande, 0,90–0,94 | forteresse chenillée à **tourelle hexagonale**, **quatre canons dressés à 70°**, œil orange, chevron | caisse et tourelle ; apprêt | l'hexagone le sépare de l'anti-air | `module_tourelle, module_radar, module_antenne` |
| Automate de combat méridien | moyenne, 0,80–0,84 | **un robot** sur deux jambes courtes et trapues, torse carré, tête-capteur à **œil orange unique**, **bras-canon** | torse, épaules, blindage des jambes ; apprêt | marche en `deplacement` ; le seul à pattes hors fantassins | `module_tourelle` = le torse, `module_canon_long` = le bras, `module_antenne` |

## 6. Bâtiment par bâtiment (vague suivante)

| Bâtiment | Ce qui se lit à 48 px | Équipe, et le neutre |
|---|---|---|
| Ville | trois ou quatre maisons serrées, toits pentus, fenêtres qui s'allument la nuit | tous les toits ; neutre gris et mât nu (les tuiles rouges se lisaient « camp rouge ») |
| Usine | **toit en dents de scie**, cheminée, grande porte roulante | dents de scie et porte ; plus de cadre-échafaudage |
| Aéroport | **une vraie piste** en travers de la case, tirets os, tour de contrôle, hangar | toit du hangar, cabine de la tour ; plus d'hélistation ni de manche à air orange |
| Port | quai en U, **grue épaisse**, entrepôt | grue et toit de l'entrepôt |
| Station radar | **grande parabole os** sur un bloc | tout le bloc et le pied de la parabole |
| QG commun | **le plus haut bâtiment du jeu** : tour centrale, remparts, le plus grand drapeau | toits et tours ; plus de hangar sur terre battue au drapeau toujours gris |
| QG France, QG Luxembourg | la grammaire du QG, plus un toit mansardé de zinc (France), une forteresse sur un rocher (Luxembourg) | toits, drapeau ; ils étaient identiques |
| Désaffecté | le même bâtiment **endormi** : bâche claire, planches en croix, mât couché, fenêtres éteintes — jamais une ruine | aucune |
| Superusine des Gris | une usine plus grande (jusqu'à 1,2 case), plaques à facettes en apprêt, bras de montage, **œil orange qui s'éteint** quand elle est prise | toit à la couleur du camp |
| Pont | un tablier de bois ou de pierre claire : le pont vert disparaissait dans l'herbe | — |

## 7. La fabrication

Rien n'est retouché : **tout est refait de zéro**, sur une chaîne commune qui rend la cohésion structurelle au lieu d'espérée.

1. **Le socle** (`scripts/production/figurines/`) : une bibliothèque Blender (5.1, sans interface) de primitives chanfreinées et lissées, **un atlas de palette unique** pour les trente unités — chaque pièce reçoit une teinte nommée de la charte, et le masque d'équipe est le même atlas —, les nœuds et les clips des fiches, l'export en GLB aux PNG voisins, le contrôle de la fiche, une cuisson d'essai et **les mesures de cette charte** avec leur verdict. Une commande par unité : `npm run fabriquer:figurine -- --cle <clé>`. Le char léger sert de pilote.
2. **Un agent par unité**, par vagues : chacun n'écrit que `scripts/production/figurines/unites/<clé>.py`, regarde ses planches, itère jusqu'à ce que toutes les règles mesurables passent.
3. **Le coordinateur** relit chaque planche, reporte les dimensions dans les fiches (`src/assets/catalogue.ts`), installe le lot dans `public/assets/modeles/`, recuit, lance les tests, et pousse.
4. **Le rendu** : la couleur d'équipe projetée et les camps séparés (3.11), l'écume sous les navires.
5. **Les bâtiments**, puis la recuisson de tout (lumière et contour changent pour toutes les entrées).

**Ce qui n'est pas vérifié et ne le sera que par un œil humain** : le « test de la récré » que demandent l'ado et le vétéran — montrer la planche à 48 px sur un vrai téléphone à cinq personnes qui ne connaissent pas le jeu, et compter combien nomment la famille et le camp de chaque unité en moins de trois secondes.

## 8. Retenu pour plus tard

- **Une unité qui a joué** reste opaque et se désature, comme dans Advance Wars, au lieu de passer à 60 % d'opacité, où elle se fond dans le sol et perd son camp (vétéran).
- **Un second signe de camp** dans l'interface pour les joueurs daltoniens : le rouge et le vert par défaut ont presque la même clarté (designeuse, joueuse).
- **L'anneau d'équipe** sous chaque unité, dessiné par le jeu (ado).
- **La vue `profil`** cuite à 256 px par mètre si l'écran de combat agrandit ses figurines (technique).
- **Le panneau de l'atelier** qui nomme l'unité survolée avant l'unité cliquée : sur un banc où les unités se touchent, il a nommé la mauvaise.
