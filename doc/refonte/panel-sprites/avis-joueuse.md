# Avis de Claire, joueuse : les sprites d'Atlas Tournament

*Claire, 38 ans. Je joue le soir, sur Switch et sur téléphone, souvent un quart d'heure d'affilée : Fire Emblem (Three Houses, Engage), Mario + Lapins Crétins, Into the Breach, Stardew Valley, Monument Valley, Animal Crossing. Je n'ai jamais joué à Advance Wars, donc je ne vote pas par nostalgie : je juge avec mes yeux, et avec un téléphone où une case fait 7 mm.*

## A. Premier regard

On dirait trois boîtes de jouets différentes vidées sur la même pelouse : des chars en plastique bleu tout ronds, des maquettes grises pleines de crasse, et des soldats en armure de science-fiction, sans visage.
Chaque modèle a été peint avec sa propre boîte de peinture, et ça se voit : vingt-huit gris différents pour trente unités.
À 48 px, la moitié de l'armée bleue est grise : je ne sais pas à qui sont l'hélico, l'artillerie ou la barge, ni même le radar.
Rien n'a de contour, et le gris se noie dans l'ombre (le vert se noiera dans l'herbe).
Pourtant les bons élèves existent (le char moyen, le sous-marin, le chasseur, les arbres du décor) : il faut les copier, pas « uniformiser » le reste.

## B. Les règles communes

Mon principe : une seule boîte de peinture, une seule main, et un téléphone à 7 mm par case pour juge. Chaque règle se mesure par un script, comme `mesures-unites.md`.

1. **Une seule famille, le jouet peint.** Une couleur unie par matériau : aucune texture de salissure, de rouille, de bruit photo ou de camouflage. Toutes les arêtes adoucies (chanfrein ≥ 3 % de la plus grande dimension), aucune pièce plus fine que 5 px à 128 px (2 px à 48 px). *Se vérifie dans les GLB.* Aujourd'hui, l'artillerie, la barge, l'anti-air, l'hélico et le char léger sortent de la famille.
2. **Une palette fermée.** Hors couleur d'équipe, un modèle n'a droit qu'à un anthracite chaud `#3A3836` (chenilles, roues, canons, rotors, dessous de coque), un clair chaud `#CFC8BB` (munitions, outils, caisses, paraboles, marquages), une vitre `#26303A` avec un seul reflet, quatre teintes de peau et un blanc chaud `#FFF1D6` pour les feux. **Le gris moyen et l'orange `#F0761E` sont interdits aux nations : ils appartiennent aux Gris.** *Chaque albédo à ΔE ≤ 3 d'une de ces valeurs.* Adieu les petits feux orange du recon, des chars et des lance-missiles. Monument Valley tient avec une palette courte ; ici, la couleur hors équipe va de `#424647` à `#717172`.
3. **40 à 60 % de couleur d'équipe, dans les quatre vues** (`droite`, `bas`, `haut`, `profil`), mesurés comme dans `mesures-unites.md`. De dos, l'infanterie actuelle est noire. Le masque est porté par des **pièces entières**, jamais peint dans une texture : fini les bords en dents de scie de l'hélico et les taches de l'anti-air. Sous le masque, un seul albédo clair (0,92), plus au besoin une teinte foncée (0,60) pour les grands dessus plats. *À l'écran, le bleu d'un camp a la même valeur sur toutes ses unités (ΔE ≤ 6 sur les faces éclairées).* Aujourd'hui : de 1 % (artillerie) à 75 % (drone intercepteur) ; 15 unités sur 30 sous 20 %, 6 seulement dans la fourchette.
4. **La couleur d'équipe est normalisée avant d'être posée**, pour toutes les nations : clarté L* entre 50 et 72, chroma ≥ 40, teinte conservée. L'ardoise d'Islande `#5B6F86` (chroma 15, à ΔE 15 du gris acier actuel : une armée islandaise serait grise) et le vert de Nouvelle-Zélande `#2F5F4F` (L* 37) sont relevés. Deux camps d'une même carte sont à ΔE ≥ 25, sinon le second reprend sa couleur de camp (la Suisse et le camp rouge sont à ΔE 10). Pour les joueurs daltoniens, le rouge et le vert par défaut diffèrent d'au moins 20 points de clarté (11,5 aujourd'hui). *Un test sur les 24 nations et les 4 camps.*
5. **Un contour sombre et chaud**, `#221F1C`, de 1 px à 48 px (environ 3 px à la cuisson), sur la silhouette extérieure seulement, pales comprises. *Au moins 95 % des pixels de bord à ΔE ≤ 10 de cette couleur.*
6. **Trois tailles, et le prix se voit.** Plus grande dimension de la silhouette en vue `droite` : petite 0,62–0,70 case, moyenne 0,78–0,86, grande 0,92–1,00. Jamais plus d'une case de large, rien plus haut que 0,30 case au-dessus du bord de sa case (pales exceptées). Dans une famille, le plus cher n'est jamais le plus petit. Les classes sont écrites dans les fiches ; les modèles les ignorent : le drone à 3 000 fait 0,80 case comme le chasseur à 20 000, le char léger (1,05) dépasse le char moyen (0,93), le drone ravitailleur couvre plus de pixels que le bombardier, et l'hélico mord de près d'une demi-case sur la case du dessus.
7. **Un signe par unité, qui dépasse.** Chaque unité porte un signe de rôle (canon, tubes, missiles, rotor, outil, antenne, caisses, œil) dans un neutre qui tranche sur la carrosserie et qui sort de la silhouette du corps d'au moins 6 px à 48 px. Même rôle, même signe d'une famille à l'autre : **l'œil de caméra clair** pour ce qui voit loin (recon, drones), **les caisses claires** pour ce qui ravitaille, **les tubes dressés vers le ciel** pour ce qui tire en l'air depuis le sol, **les anneaux** pour ce qui brouille. *À 48 px, deux unités d'un même milieu se recouvrent en silhouette à 75 % au plus (IoU).* Mesuré sur la planche bleue ramenée à 48 px : barge et cuirassé 0,88, char moyen et automate 0,88, les deux lance-missiles 0,87, méca et génie 0,85, anti-air et bastion 0,83.
8. **Tout le monde regarde du même côté, avec les mêmes angles.** En vue `droite`, nez, étrave et bouche du canon vers la droite. Au repos : tir direct à l'horizontale, tir indirect relevé à 35–45°, anti-aérien dressé à 60–70°. Aujourd'hui, l'artillerie vise à gauche, dans sa propre armée.
9. **Des gens, avec un visage.** Proportions de figurine (4 à 4,5 têtes), visage nu d'au moins 5 × 5 px à 128 px en vues `droite` et `bas`, ni masque, ni visière, ni casque intégral ; le couvre-chef est d'équipe. L'infanterie actuelle ressemble plus à un robot que l'automate des Gris.
10. **Une seule lumière, des ombres courtes.** L'armée de droite est un miroir : la lumière principale doit venir d'en haut (élévation ≥ 60°), pour les unités **et** pour les bâtiments et le décor, sinon le miroir éclaire une armée à contre-jour de la carte. Même opacité pour toutes les ombres, et aucune ombre cuite ne sort de sa case de plus de 0,25 case (aujourd'hui, celles des bâtiments assombrissent le terrain voisin, qu'on doit pouvoir lire).
11. **Ce qui vole vole à la même hauteur**, avec la même ombre claire. Rotors à 2–4 pales opaques ; pas de flou de mouvement dans l'image de repos : à 48 px, un disque flou est une tache sale.
12. **Bâtiments : le propriétaire d'un coup d'œil.** Couleur d'équipe sur au moins 30 % des pixels visibles, dont toute la toiture principale (la façade principale s'il n'y a pas de toit dominant), et un drapeau d'au moins 6 × 4 px à 48 px, toujours au même coin. **Neutre : même bâtiment, toiture `#B9BEC7` et mât vide**, jamais de drapeau gris. Un même socle de béton clair pour tous. Le QG est le plus haut bâtiment du jeu.
13. **Les Gris ont une langue, pas une absence de couleur.** Leurs trois unités suivent la règle 3 comme tout le monde, mais leur neutre est le gris moyen `#7A7D80` au lieu de l'anthracite, leurs formes sont à facettes (l'octogone du bastion est la bonne idée), et chacune porte un **œil orange** d'au moins 4 × 4 px à 48 px, qui s'allume la nuit.

## C. Les votes

1. **Style : b.** Le décor et les meilleurs modèles sont déjà des jouets peints, c'est le réalisme sale qui casse tout ; le canon demandait déjà « volumes simples, proportions de figurine, couleurs franches ». Je garde la maquette photographiée, mais celle d'un jouet, pas d'un musée, comme les jouets en plastique de Mario + Lapins Crétins sous leur belle lumière.
2. **Contour : b.** Sans lui, un camp vert disparaît dans l'herbe, un camp rouge sur une case surlignée en rouge, et deux unités collées font une seule tache. Épais, il mangerait l'infanterie ; de la couleur d'équipe, il s'effacerait sur une carrosserie de la même couleur.
3. **Part d'équipe : b.** À 10 %, je ne sais pas à qui est l'unité. À 70 %, canons, missiles et rotors se noient et tous les véhicules deviennent des bonbons. Le corps dit « à qui », le neutre dit « quoi » ; dans Fire Emblem, je n'ai jamais eu à chercher mon camp.
4. **Parties non teintées : autre**, (d) complété d'un clair : un anthracite chaud pour toute la mécanique, un seul clair chaud pour munitions et outils. Plus de gris acier : c'est lui qui rend l'armée terne et froide, qui avale l'ardoise d'Islande, et il doit rester la couleur des Gris.
5. **Proportions : b**, mais seulement sur le signe qui compte (canon, tubes, rotor, outil, tête) : c'est tout ce qui se lit à 7 mm. Le reste se simplifie.
6. **Taille : b**, avec les fourchettes de la règle 6 : je veux voir la grosse menace d'un coup d'œil, et aujourd'hui un drone à 3 000 est aussi gros qu'un chasseur à 20 000.
7. **Socle : b.** Un socle rond et bas, en couleur d'équipe, le même pour les trois fantassins (aujourd'hui : aucun, gris, bleu). C'est lui qui rend le génie lisible ; sous un char, il cacherait la forêt ou la plaine qu'on doit voir.
8. **Infanterie : a.** Une seule figurine, deux fois plus grande que chacune des deux actuelles, avec un visage et une pose. L'écran de combat montre déjà une figurine par point de vie : la carte montre le personnage, le combat montre la troupe.
9. **Bâtiments : b.** Le toit est ce qu'on voit d'en haut, le drapeau est ce que l'infanterie vient planter, et le mât vide dit « libre » sans un mot. Aujourd'hui, c'est (c), et à 48 px un radar bleu, un radar rouge et un radar neutre sont identiques.
10. **Gris : autre.** La couleur de leur camp comme tout le monde (lire les camps passe avant tout), mais leur langue à eux : gris moyen, facettes, œil orange (règle 13). Un badge orange ne peut pas porter un camp : il est à ΔE 13 de l'orange de l'Inde.

## D. Unité par unité

« Garder » : la forme reste, seule la passe commune s'applique (palette, masque, contour, taille). « Retoucher » : une partie de la forme change. « Refaire » : nouveau modèle, dans la langue du char moyen.

| Unité | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe | Classe | Remarque |
|---|---|---|---|---|---|
| Infanterie | refaire | un seul soldat, visage nu sous un casque rond, fusil en travers, **fanion d'équipe** sur le sac (c'est lui qui plante le drapeau) | casque, veste, fanion, socle | petite 0,62 | Deux « marines » sans visage, couleur sur les gants seulement (on dirait des gants de vaisselle) ; l'unité la moins chère est la plus sombre de l'armée. |
| Méca | refaire | un soldat trapu, gilet épais, **gros tube** sur l'épaule qui dépasse devant et derrière | casque, gilet, socle | petite 0,70 | 3 % d'équipe, socle gris : l'unité la moins colorée du jeu. |
| Génie de terrain | retoucher | **casque de chantier** et grande clé levée, caisse à outils claire | casque, bleu de travail, socle | petite 0,66 | Le meilleur des trois (visages, socle coloré) : passer à une figure, garder l'esprit. |
| Recon | retoucher | petite jeep ronde à grosses roues, mât-périscope avec **l'œil clair** | toute la coque (capot, portes, toit) | petite 0,70 | Déjà un joli jouet : inverser, le gris devient la couleur d'équipe. |
| Char léger | refaire | le plus petit char : tourelle ronde, canon court et fin, 4 galets | caisse, tourelle | moyenne 0,78 | Seule maquette « musée » grise de la famille, et plus grande que le char moyen. |
| Char moyen | garder | tourelle carrée, canon moyen, 5 galets | caisse, tourelle (55 %) | moyenne 0,84 | Le modèle étalon : formes, arêtes, part de couleur. |
| Char lourd | retoucher | le plus gros bloc, **canon long et épais** avec frein de bouche, 6 galets | caisse, jupes, tourelle | grande 0,96 | Sympathique mais confondu avec le moyen (IoU 0,77) : grossir, allonger le canon. |
| Anti-air | refaire | **deux canons dressés vers le ciel** sur tourelle ouverte | caisse, tourelle | moyenne 0,84 | Olive, taches façon camouflage, canons invisibles : un char de plus. |
| Artillerie | refaire | long tube relevé à 40° **vers la droite**, bêche arrière | châssis, bouclier | moyenne 0,84 | 1 % d'équipe, texture sale, pseudo-insigne rond, et elle vise son propre camp. |
| Lance-roquettes | retoucher | un bloc de tubes **relevé à 35°**, bouches rondes visibles | camion, flancs du bloc | grande 0,94 | Aujourd'hui un camping-car à caisse grise (9 %). |
| Lance-missiles sol-air | retoucher | **quatre missiles fins à pointe claire, dressés vers le ciel**, petite parabole | camion, cabine | grande 0,94 | Même camping-car que le sol-sol (IoU 0,87). |
| Lance-missiles sol-sol | retoucher | **un seul gros missile clair couché**, qui dépasse devant et derrière | châssis, cabine, bague de nez | grande 1,00 | L'engin terrestre le plus cher doit être le plus impressionnant. |
| Transport | retoucher | benne ouverte avec **deux caisses claires**, rampe, aucune arme | cabine, flancs | moyenne 0,80 | Enlever la petite grue (dépanneuse), ajouter les caisses. |
| Brouilleur mobile | retoucher | mât dressé portant **trois anneaux**, plus haut que la cabine | caisse, cabine | moyenne 0,82 | Trop proche du transport (IoU 0,81) ; sa parabole se confond avec le radar. |
| Hélicoptère | refaire | fuselage fin, **rotor à deux pales** large comme la case, paniers de roquettes | fuselage, dérive | moyenne 0,80 | Gris-noir (7 %), vitres en dents de requin, rotor flou : je ne devine pas son camp. |
| Transport d'assaut | retoucher | gros hélico-bus à **deux rotors** (avant, arrière), porte ouverte | fuselage | moyenne 0,84 | Aujourd'hui plus bleu et plus « important » que l'hélico d'attaque. |
| Chasseur | garder | flèche fine, nez pointu, ailes en flèche | ailes, dérives, dos | grande 0,92 | Joli jouet ; l'agrandir pour qu'il pèse plus qu'un drone. |
| Bombardier | retoucher | **ailes droites très larges**, quatre moteurs, ventre rond | ailes, dos | grande 1,00 | Même taille que le chasseur aujourd'hui : il doit être la baleine du ciel. |
| Chasseur furtif | retoucher | aile volante triangulaire à facettes, **sans dérive** | dessus de l'aile, bord d'attaque anthracite | grande 0,92 | Retirer le « ressort » dressé au milieu, qui fait farces et attrapes. |
| Drone d'observation | refaire | tout petit quadrirotor, **gros œil clair** dessous | corps (bras anthracite) | petite 0,62 | Aujourd'hui un hélicoptère à ressort, aussi grand que le chasseur. |
| Drone intercepteur | retoucher | petite étoile à **deux mini-missiles** clairs | corps (75 → 55 %) | petite 0,66 | L'étoile se reconnaît, c'est rare : la garder, la réduire. |
| Drone ravitailleur | retoucher | petit drone portant **une caisse claire suspendue** | corps | petite 0,68 | Ses rotors carénés ressemblent à des volants de voiture et le rendent plus gros que le bombardier. |
| Barge de débarquement | refaire | bateau plat, **rampe avant abaissée**, pont vide | coque (5 → 50 %) | moyenne 0,86 | Seul navire sale et presque noir, même cas que l'artillerie. |
| Cuirassé | retoucher | coque longue et pointue, **deux tourelles** à canons longs | coque haute, superstructure | grande 1,00 | Aujourd'hui une bouée ovale sur pieds noirs : allonger, enlever les pieds. |
| Porte-avions | refaire | le plus grand pont plat, **piste claire en diagonale**, îlot sur le côté | flancs, îlot | grande 1,00 | Une table basse octogonale sur pieds (11 %), pour 20 000. |
| Sous-marin | garder | cigare rond, kiosque, périscope | coque, kiosque anthracite (63 → 55 %) | moyenne 0,80 | Le plus attachant du lot. |
| Drone marin | retoucher | petit catamaran bas avec **l'œil clair** des drones | flotteurs | petite 0,66 | L'œil commun fait une famille des drones. |
| Veilleur méridien | retoucher | quadrirotor à facettes, **anneau** au-dessus, **œil orange** | plaques du corps (13 → 45 %) | moyenne 0,80 | Aujourd'hui un drone de plus, rien des Gris. |
| Bastion méridien | retoucher | forteresse octogonale sur chenilles, **quatre tubes vers le ciel**, œil orange | plaques supérieures | grande 0,96 | Garder l'octogone ; trop proche de l'anti-air (IoU 0,83). |
| Automate de combat méridien | refaire | un **robot** : torse et tête à l'œil orange au-dessus des chenilles (ou deux jambes), bras-canon | torse, épaules | moyenne 0,84 | Aujourd'hui un char (IoU 0,88 avec le char moyen) : le seul robot doit être le seul à avoir une tête. |

## E. Bâtiment par bâtiment

| Bâtiment | Verdict | Ce qui doit se lire à 48 px | Couleur d'équipe, et le neutre | Remarque |
|---|---|---|---|---|
| Ville | retoucher | deux ou trois maisons serrées, toits pentus, fenêtres qui s'allument la nuit | tous les toits ; neutre : toits `#B9BEC7`, mât vide | Les tuiles rouges sont charmantes, mais c'est le rouge du camp rouge : une ville bleue a des toits rouges. Les ruelles vides se lisent comme des gravats. |
| Usine | garder | **toit en sheds**, cheminée, grande porte roulante | toit et porte ; neutre : gris, mât vide | La plus lisible aujourd'hui ; remplacer le cadre-échafaudage par le toit en sheds, le signe universel de l'usine. |
| Aéroport | refaire | **piste claire** à tirets, tour de contrôle, hangar | toit du hangar, cabine de la tour ; neutre : gris, mât vide | C'est une hélistation : des chasseurs n'en sortent pas. Manche à air orange à retirer. |
| Port | retoucher | quai en U, **grue épaisse**, entrepôt | grue, toit de l'entrepôt ; neutre : grue grise, mât vide | La grue est le bon signe, elle manque de couleur. |
| Station radar | retoucher | **grande parabole claire** sur un bloc | tout le bloc et le pied de la parabole ; neutre : gris, mât vide | Deux liserés fins : le pire cas du plateau, trois états identiques à 48 px. |
| QG | refaire | le plus haut bâtiment : **tour centrale** et le plus grand drapeau (≥ 8 × 5 px) | toit, drapeau ; neutre : gris, mât vide | Un hangar sur terre battue au drapeau toujours gris (non masqué) : rien ne dit « c'est le but de la partie ». |
| QG (France) | refaire | la grammaire du QG commun + **toit mansardé en zinc**, lucarnes | toit, drapeau | Identique au QG luxembourgeois, et plus petit qu'une usine. |
| QG (Luxembourg) | refaire | la grammaire du QG commun + **rempart et tour de forteresse** | toit, drapeau | Aucune différence avec la France aujourd'hui. |
| Désaffecté | à créer | le même bâtiment **sous une bâche claire**, échafaudage, mât couché, fenêtres éteintes | aucune | Surtout pas une ruine : un bâtiment endormi, qu'on a envie de réveiller avec le génie. |
| Superusine des Gris | à créer | une usine plus grande (seule construction qui déborde, jusqu'à 1,2 case), plaques à facettes gris moyen, bras de montage, **œil orange** | toit dans la couleur du camp des Gris | Capturée, **l'œil s'éteint** : « inerte » se lit sans texte. |

## F. Mes trois priorités, et mes refus

1. **La passe commune sur les trente modèles existants** : palette fermée, masque par pièces à 40–60 %, contour, trois tailles, lumière haute (règles 2, 3, 5, 6, 10), vérifiée par un script comme `mesures-unites.md`. C'est ce qui réglera le plus de « moche » pour le moins d'effort : l'armée cessera d'être grise.
2. **Les bâtiments** : toitures d'équipe, mât vide pour le neutre, drapeau toujours au même coin, un QG qui domine. « À qui est ce radar ? », je me pose la question à chaque tour, et aujourd'hui elle n'a pas de réponse à 48 px.
3. **Refaire d'abord les trois fantassins** (une figure, un visage, un socle), puis les modèles hors famille et les sosies, dans la langue du char moyen : artillerie, anti-air, char léger, hélico, barge, porte-avions, drone, automate, et la charge des trois lance-engins.

**Je refuse :**
- la crasse, la rouille, les textures photo et le camouflage, sur quoi que ce soit : un motif fait pour qu'on ne voie pas l'unité, sur un écran de 7 mm, c'est un contresens, et ça rend cette guerre sinistre ;
- une couleur d'équipe réduite à un liseré (sous 20 %) sur une unité ou un bâtiment, et un QG au drapeau gris ;
- des soldats sans visage : on commande des gens, et l'infanterie ne doit pas ressembler aux robots de l'adversaire.
