# Avis de Léa — designeuse graphique, charte des sprites

*Je juge un système, pas des objets isolés. J'ai regardé la capture du propriétaire et les huit planches, agrandi la planche à 48 px au plus proche voisin (×4), mesuré les couleurs en OKLab — les ΔE ci-dessous sont des distances OKLab ×100 : 2 se voit à peine, 10 se voit de près, 15 se voit à 48 px — et mesuré les douze images du clip de repos de chaque unité.*

## A. Premier regard

- Trois boîtes de jouets renversées sur la même pelouse : maquettes « réalistes » au grain de fonderie (char léger, anti-air, artillerie, barge), jouets laqués (char moyen, missiles, chasseur), découpes plates (furtif, drone intercepteur).
- La couleur d'équipe n'est pas un système : de 1 à 75 %, médiane 20 %, neuf unités sous 12 % ; à 48 px, la moitié de l'armée bleue est grise, donc à personne.
- Le gris est la couleur de « personne », et il est partout : routes, roches, dalles des bâtiments (2,6 ΔE du neutre #b9bec7), Islande (4,9 ΔE du gris des chars).
- Aucun contour, et des couleurs de camp à la clarté de l'herbe (L 0,62–0,68 contre 0,62–0,75) : la silhouette ne tient que par la teinte.
- Les bâtiments sont des dalles grises à toits terre cuite qui se lisent « camp rouge », et le QG, objectif de la partie, une remise basse sur un carré de terre.

## B. Les règles communes

1. **Palette fermée.** Tout matériau d'un GLB a pour albédo une teinte de la charte (§ G.1) à ±3 par canal, ou le blanc de la zone d'équipe. Aucune texture de couleur : ni grain de fonderie, ni rouille, ni salissure, ni camouflage, ni décalque. Le relief vient de la géométrie et de la lumière. *Contrôle : lecture des matériaux au dépôt, comme `validerGlb`.*
2. **Part d'équipe.** 45 à 60 % des pixels opaques de la vue droite (repos, image 0) pour tout véhicule, avion et navire ; 40 à 55 % pour les trois fantassins ; 40 à 50 % pour les trois prototypes des Gris, qui portent en plus leur signature (§ G.5) ; 30 à 45 % pour un bâtiment. Les vues bas, haut et profil à ±10 points de la vue droite. *Contrôle : la mesure de `mesures-unites.md`, étendue aux quatre vues.*
3. **Masque franc.** 97 % des pixels du masque valent 0 ou 255 (±10) ; l'entre-deux n'existe que sur l'anticrénelage. Un masque à moitié donne un pastel qui se lit comme un autre camp. *Contrôle : histogramme du masque.*
4. **Deux masses.** Une masse sombre de 20 à 35 % des pixels (graphite, caoutchouc, dessous), à L ≤ 0,36 sur l'image composée, dans le bas de la silhouette ; la masse d'équipe au-dessus. Luminance moyenne de la moitié haute ≥ celle de la moitié basse + 0,12. Sur n'importe quel sol (L 0,39 en sous-bois, 0,99 sur la neige), l'une des deux masses tranche alors d'au moins 0,2. *Contrôle : sur l'image composée au camp bleu.*
5. **Contour.** Trait extérieur #15181d de 3 px à 128 px par case (≈ 1,1 px à 48), plein, calculé à la cuisson par dilatation de l'alpha de l'objet seul, jamais teinté par l'équipe, jamais autour d'une ombre cuite. Bâtiments : 2 px à 85 % ; décor : 2 px à 60 % ; sol : aucun trait. *Contrôle : anneau de 3 px autour de l'alpha.*
6. **Densité.** Aucune pièce de moins de 8 px à 128 (3 px à 48) dans sa plus petite dimension : on la supprime ou on la fond dans sa voisine. Sept pièces lisibles au plus par unité ; chanfrein de 2 à 3 px sur toute arête vive. *Contrôle : la planche réduite à 48 px ne montre aucune tache isolée sous 2 × 2 px.*
7. **Trois tailles.** Plus grande dimension de la silhouette : 0,62–0,68 case (classe P), 0,74–0,80 (M), 0,86–0,92 (G). Rien de plus large que 0,92 case — il reste 4 px d'herbe entre deux voisines à 48 px ; hauteur au-dessus du pivot ≤ 1 case. *Contrôle : boîte englobante de l'alpha.*
8. **L'angle de l'arme dit la cible.** Tir direct à l'horizontale (±5°), tir indirect au sol entre 30 et 45°, antiaérien entre 60 et 75°, dans toutes les vues. *Contrôle : tangage du nœud d'arme.*
9. **Exagérer le signe, pas le reste.** L'élément qui distingue l'unité (canon, tubes, rotor, parabole, rampe, kiosque, outil) fait au moins 8 px d'épaisseur à 128 et dépasse du corps d'au moins 12 % de la largeur de la silhouette. Le reste garde des proportions de maquette simplifiée. *Contrôle : mesure sur la vue droite.*
10. **Grammaire de famille.** Un seul module de chenille (caoutchouc, cinq galets à moyeu os) en trois longueurs ; un seul pneu (caoutchouc, moyeu os, diamètre ≥ 0,18 case) ; un rotor principal pour l'hélicoptère, deux en tandem pour le transport ; des multirotors pour les seuls drones ; toute coque a une étrave pointue (≤ 70°). Aucun drone n'a de verrière : l'absence de pilote est son signe. *Contrôle : noms de nœuds imposés par la fiche.*
11. **Lumière symétrique.** Une armée sur deux est dessinée en miroir : avec la clé actuelle (azimut −40°), l'armée rouge est éclairée par la droite quand les bâtiments le sont par la gauche. Clé depuis le côté caméra (azimut 0°, élévation 60°), ciel froid en remplissage, contre-jour à 180°. Sur un cube blanc de calibration : dessus 1,00, face tournée vers la caméra 0,80 ± 0,05, flancs 0,65 ± 0,05, flancs gauche et droit égaux à 0,02 près. Ombres cuites ≤ 0,3 case, vers le haut de l'écran ; l'ovale des unités décalé dans la même direction. *Contrôle : le cube, cuit avec chaque lot.*
12. **Un repos calme.** Au repos, un véhicule terrestre ou un navire bouge de 1 px au plus (à 128) et moins de 3 % de ses pixels changent d'une image à l'autre ; seuls rotors et hélices tournent, un appareil flotte de 2 px au plus. Aujourd'hui : char léger 15,6 %, char moyen 0,2 %. *Contrôle : les douze images du clip `repos`.*
13. **Couleur de jeu.** Toute couleur de nation est projetée en OKLCH avant le nuanceur : L entre 0,60 et 0,76, chroma ≥ 0,10, teinte conservée. Sur une carte, deux camps sont à ≥ 15 ΔE l'un de l'autre ; sinon le second prend la couleur de camp par défaut la plus éloignée des autres. *Contrôle : fonction pure, testée sur les 24 nations et les 4 camps.*
14. **Couleurs réservées.** Le gris (chroma < 0,04) entre L 0,55 et 0,85 appartient aux bâtiments neutres et aux Gris. L'orange hors masque n'existe que sur les Gris, et toujours en chevrons ; aucun feu ambre sur une unité nationale (dix en portent aujourd'hui). Ni terre cuite, ni brun, ni rouge hors masque sur un bâtiment. *Contrôle : histogramme des pixels hors masque.*
15. **Bâtiments.** L'équipe sur le plus grand plan tourné vers le ciel (les toits) et un élément de façade ; aucun drapeau cuit, puisque le jeu plante lui-même le pavillon au pied de mât (0,86 ; 0,30) — ce coin reste libre ; la dalle, en pavé #8e8778, ne dépasse pas 25 % de l'image. *Contrôle : masque, et zone du mât vide.*

## C. Les votes

1. **Style — b.** C'est ce que le canon décrit déjà (volumes simples, proportions de figurine, couleurs franches, lumière de studio), et ce sont les maquettes « réalistes » au grain de fonderie qui le trahissent — pas le cel-shading, qui jetterait la photographie de diorama pour un résultat qui, à 48 px, rejoint de toute façon le jouet peint contouré.
2. **Contour — b.** Les couleurs de camp ont la clarté de l'herbe (le vert en est à 8,8 ΔE), donc seul un trait #15181d de 3 px à 128 (≈ 1,1 px à 48) détache une armée de la plaine, sans manger un fantassin comme un trait épais ni se confondre avec les surbrillances vertes et rouges comme un trait coloré.
3. **Part d'équipe — b (45 à 60 %).** Sous 30 % le camp ne se lit pas à 48 px avec quatre camps, au-delà de 65 % la silhouette devient une tache sans mécanique — le drone intercepteur à 75 % est une étoile bleue.
4. **Parties non teintées — d.** Un graphite commun #30343b, jamais noir pur, avec un clair « os » #d8d0bf limité à 12 %, parce que le gris est la couleur de personne (neutre, Islande, Gris), que le beige s'effondre sur l'or, le sable et la neige, le kaki sur l'herbe, et que seul le graphite encadre toutes les couleurs de #2f5f4f à #e9b93a.
5. **Proportions — c.** On exagère ×1,5 à ×2 le seul signe distinctif (canon, tubes, rotor, outil) et on laisse le reste en maquette, car tout exagérer fait « chibi » et contredit le conflit sérieux.
6. **Taille dans la case — b.** Trois classes (0,62–0,68, 0,74–0,80 et 0,86–0,92 case, soit 30, 37 et 43 px à 48 px) font des marches de 15 % qui se voient, et plus rien ne déborde de sa case comme les trois blindés à 1,05 case d'aujourd'hui.
7. **Socle — a.** Un disque coloré sous une unité se lit comme un anneau de sélection et double l'ovale d'ombre que le jeu pose déjà : le plateau est le socle, et l'on retire ceux du méca et du génie.
8. **Infanterie — a.** Une seule figurine de 0,66 case, casque et vareuse à l'équipe, visage visible, parce qu'à deux ou trois chaque homme fait une vingtaine de pixels et l'outil qui distingue fantassin, méca et génie tombe à 2 px — le groupe vit sur l'écran de combat, une figurine par point de vie.
9. **Bâtiments — b.** Les toits entiers et un élément de façade, plus le pavillon que le jeu dessine déjà, parce qu'à 50° le toit est le plus grand plan vu et qu'un neutre se dit alors par des toits #b9bec7 et un mât nu.
10. **Les Gris — c.** Couleur du camp sur 40 à 50 % comme tout le monde — le camp doit se lire partout pareil, même quand un secret des Gris commande ces machines au joueur —, plus une signature fixe qui dit « prototype » : apprêt #8b9097 au lieu du graphite et chevrons orange #f0761e sur 4 à 6 %.

## D. Unité par unité (les 30)

*Garder : la forme reste, seule la charte s'applique (palette, masque, contour). Retoucher : la forme reste, un élément change. Refaire : nouvelle silhouette.*

| Unité | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe | Classe | Remarque |
|---|---|---|---|---|---|
| Infanterie | refaire | un soldat, casque rond, fusil tenu en travers | casque, vareuse, sac (≈ 45 %) | P | Deux silhouettes charbon à 10 %, l'équipe sur les gants et le fusil : l'unité la plus achetée est la moins lisible. |
| Méca | refaire | un soldat trapu, tube à l'épaule dépassant devant et derrière (≥ 40 % de sa largeur) | casque, vareuse, sac | P | 3 %, gris sur socle gris ; socle retiré. |
| Génie | retoucher | casque de chantier à bord plat, pioche à l'épaule (silhouette en T) | casque, gilet | P | Le seul fantassin lisible aujourd'hui (58 %) ; une figure au lieu de deux, sans le disque bleu. |
| Recon | retoucher | quatre grosses roues à moyeu clair, caisse basse, petite tourelle ouverte, antenne | caisse, dessus et flancs | M | 8 %, carrosserie gris clair : c'est elle qui passe à l'équipe. Passe de P à M : à 0,62 case ses roues feraient 4 px. |
| Char léger | refaire | le char de référence : chenilles, tourelle ronde, canon court à l'horizontale | caisse et tourelle (55 %) | M, bas (0,74) | Maquette au grain de fonderie : 9 %, l'unité la plus grise des trente (hors équipe #717172, saturation 0,01), 1,05 case de large, pastilles vert citron sur les galets, et le seul véhicule terrestre qui se balance au repos (15,6 % des pixels changent d'une image à l'autre, 4 px de tangage) : c'est lui que le propriétaire décrit — voir la note. |
| Char moyen | retoucher | le même char, plus fort : tourelle carrée plus haute, canon long à frein de bouche (le « T » au bout), jupes | caisse et tourelle (55 %) | M, haut (0,80) | Le plus proche de la cible : 55 %, immobile au repos (0,2 %). Retirer le « C » en relief sur le toit, qui se lit comme une lettre, et les feux ambre. Voir la note : le panneau disait « Char moyen » sur le char léger. |
| Char lourd | retoucher | le plus large des chars, deux canons côte à côte, chenilles larges à jupes | caisse et tourelle (50 %) | G | 18 % : la caisse grise passe à l'équipe. Léger, moyen, lourd : une famille, une grammaire, trois crans. |
| Anti-air | refaire | tourelle ouverte, canons jumeaux levés à 65°, petite parabole | caisse et tourelle | M | Seul olive de l'armée, réaliste : on lit « un char de plus ». |
| Artillerie | refaire | automoteur à chenilles, un tube long levé à 40°, dépassant de 30 % | caisse et casemate | M | 1 %, charbon, affûts en pattes d'araignée illisibles ; un automoteur se lit, un canon tracté non. |
| Lance-roquettes | retoucher | camion, caisson levé à 35°, face avant os percée de 3 × 4 bouches sombres | cabine, plateau, flancs du caisson | G | 9 %, caisson gris posé à plat. |
| Lance-missiles sol-air | refaire | quatre missiles courts (corps os, pointe) sur rampe levée à 70° | cabine et châssis | G | Une camionnette à caisse bleue, identique au sol-sol. |
| Lance-missiles sol-sol | refaire | le plus long véhicule : huit roues, un ou deux missiles longs couchés à 35° | cabine et châssis | G | Même caisse que le sol-air, sur chenilles : trois lanceurs, une seule boîte. |
| Transport | retoucher | chenillé bas, benne ouverte (la place des passagers), deux bidons os au flanc | cabine et flancs | M | Il ravitaille : les bidons le disent. Aucune arme visible. |
| Brouilleur mobile | retoucher | camion à mât d'antennes haut et parabole pleine inclinée | cabine et caisse | M | La parabole actuelle (anneau et rayons) se lit comme un volant. |
| Hélicoptère | retoucher | fuselage en goutte, poutre de queue, un rotor, deux nacelles d'armes | fuselage (50 %) | M | 7 % ; verrière sombre sur la moitié du nez, frangée en dents de scie qui se lisent gueule de requin (motif de nose-art réel) : verrière ≤ 30 %, frange supprimée. |
| Transport d'assaut | retoucher | fuselage boîte à porte latérale, deux rotors en tandem | fuselage | M | Deux rotors = transport, un rotor = attaque. |
| Chasseur | garder | aile en flèche, double dérive, nez pointu, compact | ailes et dessus du fuselage (55 %) | G | Déjà dans la bonne langue ; feu ambre retiré. |
| Bombardier | garder | plus large que long, ailes droites, deux moteurs en nacelle, gros fuselage | ailes et dessus | G | Idem. |
| Chasseur furtif | retoucher | aile volante à facettes, sans dérive, plate | dessus de l'aile (45 %), arête graphite | G | Antenne en ressort supprimée ; le plus sombre des avions (graphite ≥ 35 %). |
| Drone d'observation | refaire | quadrirotor compact, gros œil (sphère os, lentille sombre) dessous | corps central | P | Aujourd'hui un mini-hélicoptère, confondu avec l'hélico à 48 px. |
| Drone intercepteur | refaire | petite flèche delta à un réacteur, sans verrière | ailes et dessus | P | Une étoile à quatre branches à 75 % : un shuriken, pas un drone. |
| Drone ravitailleur | retoucher | deux soufflantes en disques pleins, gros bidon os suspendu | corps et carénages | P | Les soufflantes en anneaux à rayons se lisent comme des volants ; le bidon est le signe. |
| Barge de débarquement | refaire | coque carrée à fond plat, rampe avant, puits ouvert | flancs de coque (50 %) | M | 5 %, des gravats texturés : l'objet le plus « maquette sale » du lot. |
| Cuirassé | retoucher | étrave pointue, deux tourelles à canons longs levés à 20°, superstructure | œuvres mortes et superstructure (45 %) | G | Coque ovale de baignoire. Pont os : bleu sur mer bleue (10,5 ΔE), c'est le pont clair et le trait qui le détachent. |
| Porte-avions | retoucher | le plus plat et le plus long : pont graphite à deux lignes os, îlot sur le côté | flancs et îlot (40 %) | G | Une poêle octogonale à 11 %. |
| Sous-marin | retoucher | cigare bas, kiosque haut au milieu | dessus de coque et kiosque (50 %) | M | Le kiosque est le signe : le doubler en hauteur. |
| Drone marin | retoucher | petite vedette sans cabine, étrave pointue, mât à œil | dessus de coque | P | Le catamaran se lit comme un pédalo. |
| Veilleur méridien | retoucher | hexacoptère plus gros que le drone, parabole pleine sur le dos, chevrons | corps (40 %), apprêt #8b9097 | M | Signature des Gris. |
| Bastion méridien | retoucher | chenillé lourd, quadruple lanceur levé à 70°, grand panneau radar, chevrons | tourelle et blindage latéral (40 %) | G | Ses deux canons horizontaux en font un char : on les lève. |
| Automate de combat méridien | refaire | un robot : torse humanoïde sur jambes courtes, bras-canon | plastron (40 %), apprêt | M | Aujourd'hui un char de plus ; « char-robot » doit se lire robot, et rimer avec la superusine. |

**Le « Char moyen » gris qui bouge.** Le propriétaire a cliqué une unité que le panneau nommait « Char moyen » et la trouve « quasiment toute grise » et « qui bouge beaucoup ». C'est, mesures à l'appui, le portrait exact du **char léger** : unité la plus achromatique des trente (9 % d'équipe, gris #717172), et seul véhicule terrestre dont le repos se balance — 15,6 % de ses pixels changent d'une image à l'autre, quand le char moyen, bleu à 55 %, est immobile (0,2 %). Sur le banc, les deux sont voisins (colonnes 8 et 9) et le panneau décrit d'abord l'unité sous le curseur, puis la sélection ; le char léger fait 1,05 case de large et son canon déborde sur la case d'à côté. Vraisemblablement, le propriétaire regardait le char léger pendant que le panneau parlait de son voisin. Ce qui m'importe : il ne pouvait pas voir l'erreur, parce que rien, à l'œil, ne distingue « léger » de « moyen » — l'un est une maquette grise, l'autre un jouet bleu : deux mondes, pas deux crans. D'où mes lignes : une grammaire de char, trois crans lus au canon (court, long à frein de bouche, double), 55 % d'équipe sur les trois, et un repos immobile (règle 12). Le balancement, sur un grain de fonderie, devient un scintillement : c'est le « bouge beaucoup ».

## E. Bâtiment par bâtiment

| Bâtiment | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe, et à quoi on voit qu'il est neutre | Remarque |
|---|---|---|---|---|
| Ville | refaire | trois maisons à toits à deux pans, la plus haute au fond, en îlot serré | tous les toits et un auvent ; neutre : toits #b9bec7, murs enduit, mât nu | Les toits terre cuite (#9f593e, à 7,9 ΔE du rouge suisse) se lisent « camp rouge ». Dalle réduite, en pavé. |
| Usine | retoucher | toit en dents de scie (l'icône universelle de l'usine), grande porte, cheminée | les dents de scie et la porte ; neutre : les deux en gris | La porte à l'équipe est la bonne idée ; le cadre en lit de fer et la dalle claire, non. |
| Aéroport | refaire | une piste en diagonale (bande sombre, axe en tirets os), une tour à vigie vitrée | toit du hangar et vigie ; neutre gris | L'hélisurface ronde dit « héliport » ; la manche à air orange (l'orange est aux Gris) part. |
| Port | retoucher | quai droit contre l'eau, grue à flèche (le signe), entrepôt | toit de l'entrepôt et flèche de grue ; neutre gris | Le quai en U se lit comme un « H ». |
| Station radar | retoucher | grande parabole os sur pylône, petit bâtiment | toit du bâtiment et pylône ; neutre gris | La parabole est bonne ; l'équipe tient en deux filets, pris et neutre sont indiscernables à 48 px. |
| QG | refaire | le bâtiment le plus haut de la carte (1,25 à 1,35 case) : corps central à tour, toit à quatre pans | tous les toits et une bande de façade ; neutre gris, mât nu | Remise basse sur terre brune ; drapeau cuit gris, jamais teinté, qui double le pavillon que le jeu plante déjà. |
| QG France, QG Luxembourg | retoucher, ou retirer | le gabarit du QG commun, qui ne diffère que par la ligne de toit (tiers haut) | comme le QG | Identiques entre eux au pixel près (écart moyen 0,2 niveau) : le travail national est invisible. Leur drapeau cuit s'ajoute au pavillon du jeu — deux drapeaux sur la capture : à retirer. Un QG national n'existe que si son toit se reconnaît à 48 px. |
| Désaffecté | variante de cuisson | le même bâtiment, planches os sur les ouvertures, un pan de toit ouvert, aucune fenêtre allumée la nuit | aucune ; plus sombre et poussiéreux que le neutre (valeur −15 %, chroma −50 %), en plus du terni du jeu | Neutre = propre et clair ; désaffecté = sombre et barricadé. |
| Superusine des Gris | à créer | une usine à dents de scie plus haute (1,2 case), presse centrale, gyrophare, chevrons | dents de scie à l'équipe, apprêt, chevrons fixes ; neutre gris | Elle doit rimer avec l'automate qu'elle produit. |
| Pont (hors liste) | retoucher | un tablier de bois #8a6a4a ou de pierre os | — | Vert sur vert (#567842 en moyenne) : il disparaît dans l'herbe. |

## F. Mes trois priorités, et ce que je refuse

1. **Les leviers de cuisson, qui touchent les 101 images d'un coup sans remodeler** : contour (règle 5), lumière symétrique (11), projection des couleurs de jeu et séparation sur la carte (13), masque franc (3). Une recuisson complète, et la cohésion gagne avant la moindre modélisation.
2. **Repeindre tous les GLB par script dans la palette fermée** : textures de couleur supprimées, chaque matériau affecté à une teinte de la charte, masques redessinés jusqu'à 45–60 %, repos immobilisé ; mesurer, recuire. C'est ce qui tue « la moitié de l'armée est grise ».
3. **Remodeler les silhouettes qui ne disent pas ce qu'elles sont**, par ordre d'impact : les trois fantassins (les plus achetés), la famille des chars en une grammaire, les trois lanceurs, anti-air et artillerie, les deux drones, barge et automate ; côté bâtiments, ville, QG et aéroport ; avec les classes de taille.

**Je refuse absolument :**
- une unité sous 30 % d'équipe, et tout gris moyen comme couleur dominante d'une unité : une unité grise est une unité neutre ;
- le « réalisme » par la saleté et le détail — grain de fonderie, rouille, camouflage, rivets d'un pixel : à 48 px c'est du bruit, et au repos ça scintille ;
- un disque ou socle coloré sous les unités, et la terre cuite sur les bâtiments : l'un se lit comme une sélection, l'autre comme le camp rouge.

## G. La charte

### G.1 La palette commune (albédos du modèle, sRGB)

| Rôle | Hex | L OKLab | Où | Plafond |
|---|---|---|---|---|
| Zone d'équipe | #ffffff (blanc du contrat) | — | carrosseries, casques, toits | 45–60 % (fantassins 40–55, bâtiments 30–45) |
| Graphite — neutre sombre, métal peint | #30343b | 0,32 | châssis, dessous, armes, tubes, tenues, menuiseries | 20–35 % |
| Caoutchouc | #222428 | 0,26 | chenilles, pneus, patins, skis | dans la masse sombre |
| Os — neutre clair | #d8d0bf | 0,86 | moyeux, ponts de navire, bâches, bidons, missiles, paraboles | ≤ 12 % |
| Acier clair — métal vif | #aab0b7 | 0,75 | bouches de canon, rails, charnières | ≤ 3 % |
| Verre | #22313b, reflet peint #cfe2ec | 0,30 / 0,90 | verrières, vitres ; le reflet est une bande peinte sur le tiers haut | ≤ 8 % |
| Peau | #c48f65 | 0,69 | visages, mains ; un seul teint pour toutes les nations | — |
| Lampes | #f3ead2 | 0,94 | phares ; jamais d'ambre | ≤ 1 % |
| Contour | #15181d | 0,21 | hors silhouette | — |
| Apprêt — Gris seulement | #8b9097 | 0,65 | superstructures des trois prototypes | ≤ 25 % |
| Accent — orange d'essai, Gris seulement | #f0761e | 0,70 | chevrons | 4–6 % |
| Enduit — bâtiments | #e2dbcb | 0,89 | murs | — |
| Pavé — bâtiments | #8e8778 | 0,63 | socles, quais | ≤ 25 % |
| Bois | #8a6a4a | 0,55 | pont, planches du désaffecté | — |

Matières : métallicité 0 partout (c'est de la peinture) ; rugosité en trois crans — 0,35 laque (zone d'équipe), 0,6 satin (graphite, os, enduit, peau), 0,9 mat (caoutchouc, pavé, bois) — et 0,08 pour le verre ; chanfrein de 0,02 m sur toute arête vive, qui accroche la lumière et dessine la forme à petite taille. Au plus six teintes de la palette par unité, équipe comprise.

### G.2 Les valeurs

- **Le plus clair est en haut.** L ≥ 0,85 est réservé aux plans tournés vers le ciel : dessus des panneaux d'équipe clairs, os, reflets peints, murs. ≤ 8 % des pixels d'une unité.
- **Le plus sombre est en bas.** L ≤ 0,30 est réservé au contour, au caoutchouc, au graphite à l'ombre et aux dessous : le tiers bas de la silhouette d'un véhicule.
- **L'équipe tient le milieu.** Sur l'image composée, un panneau d'équipe va de L 0,39 (flanc à l'ombre) à 0,71 (dessus), toujours au moins 0,16 au-dessus du graphite du même plan.
- **Test du plissement d'yeux** : image composée à 48 px, floutée de 2 px, passée en niveaux de gris — on doit encore lire deux masses, sombre en bas et moyenne en haut, et le signe distinctif.
- **Lumière** : celle de la règle 11, identique pour toutes les entrées, vérifiée par le cube de calibration de chaque lot.

### G.3 Le contour

Dilatation de l'alpha de 12 px au rendu 4× (3 px à 128, ≈ 1,1 px à 48), couleur #15181d, opacité 100 % pour les unités, 85 % pour les bâtiments, 60 % pour le décor ; calculé sur l'alpha de l'objet seul, dans une passe séparée de l'ombre cuite ; masque d'équipe à 0 sur l'anneau. Aucun trait intérieur : les séparations internes viennent des valeurs, graphite contre équipe. La hiérarchie des traits est une hiérarchie de lecture : l'unité a le plus fort parce que c'est elle qu'on joue.

### G.4 La densité de détails

- Plus petite pièce : 8 px à 128, soit 3 px à 48.
- Au plus sept pièces lisibles par unité, et le signe distinctif est la plus grosse après le corps.
- Aucun détail peint : ni texte, ni chiffre, ni lettre, ni insigne, ni flèche, ni camouflage. Seuls motifs permis : les lignes os des ponts d'envol, les tirets d'axe de piste, les chevrons des Gris.
- Pas de texture de couleur : la matière se dit par la rugosité et le chanfrein, jamais par un bruit.

### G.5 La couleur d'équipe, pour toutes les nations

La couleur d'équipe multiplie un blanc ombré : à l'écran, un panneau vaut de 0,92 (dessus) à 0,55 (flanc à l'ombre) de sa couleur. Une couleur trop sombre tombe dans le graphite, une trop claire rejoint le sable, une sans chroma devient un gris. D'où la projection de la règle 13, calculée sur les 24 nations et les 4 camps :

| Couleur | Brute | Jeu | Pourquoi |
|---|---|---|---|
| Bleu, rouge, vert (camps), Inde #e2842a | — | inchangées | déjà dans la fenêtre |
| Or (camp) | #e9b93a, L 0,81 | #d9aa23 | plus clair, il rejoint l'herbe claire et le sable |
| France | #2f5fd0, L 0,52 | #4578ec | à l'ombre, il noircissait |
| Suisse, Canada, Pérou | #c0392f, L 0,54 | #d44c40 | idem ; les trois sont identiques |
| Nouvelle-Zélande | #2f5f4f, L 0,45, C 0,06 | #339377 | brute, à l'ombre elle tombe à L 0,30, la valeur du graphite ; projetée, flanc à l'ombre 0,39 contre graphite 0,23 |
| Islande | #5b6f86, C 0,043 | #5283ba | brute, c'est un gris, dans la bande réservée, à 4,9 ΔE du gris des chars ; projetée, un bleu glacier qui se lit comme une couleur, à 28,8 ΔE du graphite |

Les 28 couleurs de jeu restent dans L 0,60–0,76 et chroma ≥ 0,10, au moins 0,16 au-dessus du graphite sur chaque plan, et à au moins 13 ΔE du neutre #b9bec7 (l'Argentine, la plus proche) : aucune ne peut être prise pour un bâtiment neutre ni pour une pièce grise. Le graphite, le masque et le contour, eux, ne changent jamais : c'est ce qui fait qu'une armée islandaise et une armée indienne sont la même armée, de deux couleurs.

**La séparation sur la carte est obligatoire, pas une option.** Parmi les 378 paires de couleurs de jeu, 140 sont à moins de 15 ΔE : Suisse, Canada et Pérou à 0 ; Mexique, Sénégal et Kenya à moins de 2 ; Inde, Mongolie et Pays-Bas à moins de 4 ; Grèce et camp bleu à 3,1 ; et la capture du propriétaire montre déjà deux bleus voisins. Les quatre couleurs de camp sont à 18 ΔE au moins l'une de l'autre : elles sont le recours de la règle 13.

**Les Gris** gardent la même règle — couleur de camp projetée sur 40 % au moins — plus leur signature fixe : apprêt #8b9097 au lieu du graphite sur la superstructure, chevrons #f0761e. Les Pays-Bas et l'Inde sont à 2,8 et 3,5 ΔE de cet orange : c'est le **motif en chevrons**, jamais la teinte seule, qui signe les Gris ; une nation orange porte des aplats, les Gris des chevrons.

**Une limite que le sprite ne lève pas** : rouge (L 0,62) et vert (L 0,68) ont presque la même clarté, et un joueur deutéranope — environ un homme sur douze — les confond. Il faut un second signe de camp dans l'interface (forme du pavillon, liseré de la pastille de PV) ; la charte ne peut que ne pas aggraver les choses, en gardant le contour et les deux masses identiques pour tous.
