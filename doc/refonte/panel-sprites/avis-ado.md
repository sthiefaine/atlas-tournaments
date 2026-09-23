# Avis de Noah (15 ans, seconde, joue sur téléphone) — les sprites d'Atlas Tournament

### A. Premier regard

- Même sur la capture du proprio zoomée à fond, on dirait trois jeux collés : des Space Marines tout noirs, des petits chars jouets tout bleus, des camions gris « réalistes »… et les arbres viennent d'un quatrième jeu, tout ronds et mignons.
- Sur la planche à 48 px, mon armée c'est une flaque gris-bleu : je reconnais les avions, le sous-marin et l'étoile, le reste c'est « un truc gris avec des chenilles ».
- La moitié des unités, je sais pas à qui elles sont (artillerie 1 % de couleur, méca 3 %, hélico 7 %), et mon char léger est plus gros que mon char moyen.
- Le QG ressemble à un stand de marché, et les QG France et Luxembourg sont le même pavillon de banlieue.
- En l'état je montre pas ça à mes potes, ça fait jeu de guerre qu'on voit dans les pubs. Mais le char moyen, le sous-marin et les arbres prouvent que le bon style est déjà là : c'est eux qu'il faut copier.

### B. Les règles communes

Des règles qu'on peut vérifier avec une règle graduée, pas des « mettez plus de couleur ». Elles valent pour les quatre vues (droite, bas, haut, profil).

1. **40 à 60 % de couleur d'équipe, d'un seul morceau.** Mesuré comme dans `mesures-unites.md`. Aujourd'hui 6 unités sur 30 sont dans la bande et 15 sont sous 20 %. En plus, réduit à 48 px, le plus gros morceau d'équipe fait au moins 64 px d'un seul tenant (8 × 8). J'ai compté : infanterie 24, méca 7, artillerie 9, hélico, recon et barge vers 45, char léger 54. Le char moyen : 570.
2. **La couleur sur le dessus.** Toits, dessus de tourelle, dessus des ailes, casques, ponts : c'est ce que la caméra voit. Dans la vue « haut », au moins 35 % d'équipe. Les jupes sur le flanc du char lourd, ça compte pas.
3. **Masque sur du blanc, tout ou rien.** Sous le masque, la couleur du modèle est quasi blanche (luminance ≥ 200/255) et le masque vaut 0 ou 1, jamais entre les deux. Sinon l'or tourne moutarde et l'ardoise de l'Islande tourne boue.
4. **Quatre couleurs de modèle, pas une de plus.** Hors équipe, chaque matériau prend une de ces bases : noir chaud `#2B2D31` (chenilles, roues, canons, rotors, patins), gris clair chaud `#D9D4CA` (le reste de la carrosserie, missiles, caisses), vitre `#1F3A48` avec un reflet blanc, et la peau des visages. Interdit : olive/kaki, gris acier moyen, textures sales ou bruitées (la barge), petits feux orange. Vérif : la liste des matériaux de chaque GLB.
5. **Un contour sombre fin, cuit.** `#1A1B1E`, épais d'1/48 de case (≈ 3 px à la cuisson, 1 px à 48 px), seulement autour de la silhouette. Vérif : chaque pixel du bord a un voisin de luminance < 40.
6. **Trois tailles, et la case du dessus reste libre.** Largeur de la silhouette dans la vue « droite » : petite 0,60–0,70 case, moyenne 0,78–0,88, grande 0,95–1,05 (le chiffre de chaque unité est en D). Dans une famille, jamais le petit modèle plus gros que le grand : char léger < moyen < lourd. Et rien, rotors compris, ne dépasse de plus de 0,4 case au-dessus de sa case, sinon ça cache l'unité de derrière.
7. **Un signe par unité, grossi ×1,5 à ×2.** Chaque unité a UN truc exagéré qui dit ce qu'elle fait (colonne « signe » en D), et deux unités n'ont jamais le même. À 48 px, un détail à taille réelle, ça fait un pixel.
8. **Zéro micro-détail, bords arrondis.** Aucune pièce plus petite qu'1/24 de case (≈ 5 px à la cuisson), sauf antennes et canons : rivets, grilles, boulons, câbles, dehors. Toutes les arêtes ont un arrondi visible, comme les arbres.
9. **Des vrais visages.** Chaque fantassin montre un visage d'au moins 3 × 3 px à 48 px, sans visière. C'est dans votre brief, et aujourd'hui seul le génie en a.
10. **Tout le monde vise l'ennemi.** Dans la vue « droite », l'arme principale pointe à droite. Aujourd'hui l'artillerie tire derrière elle (et pareil dans son profil de combat).
11. **Les bateaux se voient sur l'eau.** Une bande de flottaison gris clair sur tout le tour de la coque, et une écume blanche dessinée par le jeu autour. Un bateau bleu foncé sur la mer bleue, c'est invisible.
12. **L'orange, c'est les Gris et personne d'autre.** L'orange `#f0761e` (œil, badge qui brille) n'existe que sur leurs 3 unités et la superusine. Vérif : zéro pixel orange hors masque sur les 27 autres (les petits feux orange du recon, du char moyen, etc. passent en blanc chaud).
13. **Un anneau d'équipe sous chaque unité**, dessiné par le jeu : ellipse de 0,7 case, trait de 2 px à 48 px dans la couleur du camp avec un liseré sombre de 1 px, l'ombre actuelle dedans. Pour ce qui vole, l'anneau reste au sol, autour de l'ombre.
14. **Les bâtiments disent à qui ils sont.** Au moins 30 % de couleur d'équipe (toits ou façade) et un drapeau d'au moins 6 × 4 px à 48 px. Neutre : ces mêmes surfaces en gris `#b9bec7` et un mât vide. J'ai mesuré sur la planche : ville 9 %, aéroport 7 %, radar 4 %, QG France et Luxembourg 7 %, et le meilleur, l'usine, est à 20 %.
15. **Le test de la récré, pour valider.** On montre la planche 48 px sur un vrai téléphone à 5 personnes qui connaissent pas le jeu. Pour chaque unité, au moins 4 sur 5 donnent sa famille (fantassin, char, tir de loin, anti-aérien, transport, hélico, avion, drone, bateau) et son camp en moins de 3 secondes. Tant que c'est pas 30 sur 30, c'est pas fini.

### C. Les votes

1. **Style : b)** — C'est déjà ce que dit votre brief (« volumes simples, proportions de figurine, couleurs franches ») et c'est le style des arbres et du char moyen : des jouets 3D arrondis comme dans Clash Royale ou Brawl Stars, ça fait 2026, alors que le gris réaliste fait jeu de guerre à pub et que le cel-shading mal fait fait jeu Flash.
2. **Contour : b)** — Sur la planche à 48 px mes unités collées font une seule flaque, et le camp vert a exactement la même clarté que l'herbe (il disparaît) ; un trait fin détache chaque unité comme un sticker, un gros trait ferait vieux jeu Flash.
3. **Part d'équipe : b)** — En dessous je sais pas à qui c'est (artillerie 1 %), au-dessus tout devient un bonbon uni et on voit plus les chenilles et les canons qui disent ce que c'est.
4. **Parties non teintées : e) autre** — Deux neutres communs, comme un Lego : noir chaud `#2B2D31` pour la mécanique (chenilles, roues, canons, rotors) et gris clair chaud `#D9D4CA` pour le reste, parce qu'aucun neutre tout seul marche pour les 24 nations : le gris acier actuel a quasi la même clarté que le bleu de la France, le rouge suisse, l'ardoise de l'Islande et le vert de la Nouvelle-Zélande (j'ai recoloré les planches pour voir, c'est gris sur gris : `…/scratchpad/ado-zoom/rc-islande-48-x2.png` et `rc-nz-48-x2.png`), le beige mange l'or et le noir étouffe le vert foncé, alors qu'avec les deux sur chaque unité, chaque couleur tranche au moins sur l'un des deux.
5. **Proportions : b)** — À 48 px un canon à taille réelle fait un pixel : je veux le canon de l'artillerie deux fois trop long et la parabole du brouilleur deux fois trop grosse, comme un brawler qui a une arme énorme.
6. **Taille : b)** — Je veux voir d'un coup d'œil ce qui est dangereux, comme le Géant à côté des Gobelins dans Clash Royale, mais la petite classe reste à 0,60 case minimum, sinon mon fantassin fait 20 px.
7. **Socle : autre** — Aucun socle en plastique dans les modèles (on vire ceux de la méca et du génie), mais un anneau plat de la couleur du camp dessiné par le jeu sous toutes les unités (règle 13) : c'est le rond sous les brawlers dans Brawl Stars, et c'est grâce à lui que je sais qui est qui en une demi-seconde, même un avion ou un bateau.
8. **Infanterie : a)** — Deux bonshommes collés à 48 px font une tache ; un seul, plus grand, avec une tête et une arme bien visible, ça devient un perso, et l'écran de combat montre déjà une figurine par PV.
9. **Bâtiments : b)** — Un drapeau seul fait 3 px sur téléphone ; le toit en couleur je le vois de l'autre bout de la carte, et le drapeau confirme.
10. **Les Gris : c) autre** — La carrosserie prend la couleur du camp comme tout le monde (quand je joue un secret des Gris, mes unités doivent avoir MA couleur, et une armée grise se confondrait avec les bâtiments neutres et avec l'Islande), mais ils ont une famille de formes à eux — anguleux, hexagonaux, des pattes pour l'automate — et un œil orange qui brille que personne d'autre n'a le droit de porter.

### D. Unité par unité (les 30)

| Unité | Verdict (garder / retoucher / refaire) | Ce qui doit se lire à 48 px (le signe qui la distingue des autres) | Où va la couleur d'équipe | Classe de taille | Remarque |
|---|---|---|---|---|---|
| 1. Infanterie | refaire | UN soldat, grosse tête ronde avec visage, fusil tenu en travers | casque + veste (≈ 50 %) | petite, 0,62 | Deux Space Marines noirs sans visage, 10 % de bleu : une tache sombre. C'est la Shelly du jeu (celle que tout le monde a en premier), elle doit être la plus attachante. |
| 2. Méca | refaire | le même soldat en plus costaud, avec un bazooka énorme sur l'épaule, plus long que lui | casque + armure ; le tube reste noir | petite, 0,66 | 3 % d'équipe sur un socle gris : on dirait une statue de rond-point. On vire le socle. |
| 3. Génie de terrain | retoucher | casque de chantier, énorme clé à molette, sac à outils sur le dos | casque + gilet | petite, 0,62 | Le seul avec des visages : c'est le modèle des trois fantassins. Mais un seul bonhomme, et on vire le disque bleu (ses 58 %, c'est surtout le socle). |
| 4. Recon | retoucher | buggy bas, 4 roues énormes, antenne fouet, petite mitrailleuse | capot + carrosserie | petite, 0,70 | Gris à 8 %, et sa tourelle ressemble à un mug. Il doit avoir l'air rapide : penché vers l'avant. |
| 5. Char léger | refaire | petit char bas, tourelle ronde, canon court et fin | tourelle + dessus de caisse | moyenne, 0,80 | Gris réaliste à 9 %, et plus gros que le char moyen (1,05 case contre 0,93). À refaire dans la famille du char moyen. |
| 6. Char moyen | garder (c'est l'étalon) | char trapu, tourelle carrée, canon moyen au bout épais | tourelle + caisse (ses 55 % sont parfaits) | moyenne, 0,86 | Le seul véhicule qui ressemble déjà à un jouet stylé : les autres copient son style. Juste le contour et les deux neutres. |
| 7. Char lourd | retoucher | le plus gros char : tourelle énorme, double canon épais, chenilles larges | tourelle + dessus de caisse (pas les jupes) | grande, 1,02 | 18 % sur les flancs : de loin, il est gris. Il doit faire peur, genre le P.E.K.K.A. |
| 8. Anti-air | refaire | tourelle ouverte, 4 canons fins levés vers le ciel (60° au moins) | caisse + tourelle | moyenne, 0,84 | Olive camouflage, canons à plat : on dirait un char kaki. Ce qui tire en l'air pointe vers le haut. |
| 9. Artillerie | refaire | un canon énorme levé à 40°, plus long que le véhicule, bêches à l'arrière | châssis + bouclier du canon | moyenne, 0,84 | La pire : 1 % d'équipe, presque noire, et elle vise derrière elle. |
| 10. Lance-roquettes | retoucher | caisson ouvert relevé vers l'avant, qu'on voit rempli de 12 tubes ronds | cabine + flancs du caisson | grande, 0,96 | Une caisse grise fermée : la même tête que les deux lance-missiles. Montrer ce qu'il tire. |
| 11. Lance-missiles sol-air | refaire | 2 missiles fins et clairs dressés presque à la verticale, + un panneau radar | camion (cabine + caisse) | grande, 0,98 | Jumeau du 12, même caisse bleue. Anti-aérien = ça pointe le ciel, comme l'anti-air. |
| 12. Lance-missiles sol-sol | refaire | UN gros missile clair couché sur une longue remorque, levé à 25° vers l'avant | tracteur + remorque | grande, 1,05 | Le camion le plus cher doit avoir la plus grosse arme visible, pas une caisse. |
| 13. Transport | retoucher | camion à chenilles, benne pleine de caisses et de jerricans clairs, rampe à l'arrière | cabine + flancs de la benne | moyenne, 0,82 | Une benne vide, ça dit rien. Les caisses disent « je ravitaille ». |
| 14. Brouilleur mobile | retoucher | un hérisson de 4–5 antennes + une parabole aussi grosse que la cabine | caisse + cabine | moyenne, 0,82 | Sa parabole fait 3 px à 48 px. |
| 15. Hélicoptère | retoucher | hélico fin avec un nez en forme de requin, petites ailes avec deux paniers de roquettes | tout le fuselage (pas le rotor) | moyenne, 0,80 | Le seul qui a une tête à lui (le requin, gardez-le, c'est la forme du nez, pas une peinture). Mais gris foncé avec 7 % de bleu : à qui il est ? |
| 16. Transport d'assaut | retoucher | gros hélico long à DEUX rotors (avant et arrière), porte latérale ouverte | fuselage | moyenne, 0,86 | Là c'est un hélico bleu comme les deux autres. Deux rotors = transport, tout le monde capte. |
| 17. Chasseur | garder | avion pointu, ailes en flèche, une dérive | ailes + dessus du fuselage | grande, 0,96 | Il se lit bien. À agrandir (0,80 aujourd'hui) et à passer aux deux neutres. |
| 18. Bombardier | retoucher | ailes droites très larges (l'unité la plus large du jeu), 4 moteurs, une bombe sous le ventre | ailes + dessus du fuselage | grande, 1,05 | Même taille que le chasseur, on dirait un avion cargo jouet. Il doit paraître deux fois plus large. |
| 19. Chasseur furtif | retoucher | aile volante en pointe de flèche, sans queue | l'aile (descendre de 63 à 55 %) | grande, 0,96 | La pointe de flèche, c'est stylé. Virer le ressort sur le dos. |
| 20. Drone d'observation | refaire | 4 petites hélices en X + un gros œil-caméra rond dessous | corps + bras | petite, 0,62 | Aujourd'hui c'est un mini-hélico : trois hélicos dans le jeu, c'est deux de trop. Un drone, c'est 4 hélices. |
| 21. Drone intercepteur | retoucher | l'étoile à 4 branches, une hélice au bout de chaque branche, 2 petits missiles | le corps de l'étoile (75 → 55 %) | petite, 0,65 | Le shuriken, c'est la silhouette la plus reconnaissable du jeu : on la garde. Avec les hélices, elle devient un drone. |
| 22. Drone ravitailleur | refaire | drone à 4 hélices (la famille des drones) avec une caisse claire pendue dessous | corps + bras | petite, 0,65 | Les deux gros anneaux, on dirait des volants de voiture. |
| 23. Barge de débarquement | refaire | bateau plat, grande rampe à l'avant, pont vide qu'on voit d'en haut | flancs + rampe | moyenne, 0,86 | 5 % de bleu et une texture grise sale : on dirait de la pâte à modeler. Gris foncé sur la mer = invisible. |
| 24. Cuirassé | refaire | coque longue et pointue, 2–3 grosses tourelles en ligne, tour au milieu | tourelles + superstructure | grande, 1,05 | Rond comme une bouée : on dirait un aéroglisseur ou une baignoire. |
| 25. Porte-avions | refaire | le bateau le plus long : pont plat rectangulaire, piste blanche, île sur le côté, un petit avion garé | le pont (piste blanche par-dessus) + l'île | grande, 1,05 | Un octogone gris foncé avec une tour : on dirait une table. |
| 26. Sous-marin | garder | capsule ronde + kiosque haut avec périscope | le dessus de la coque (63 → 55 %) | moyenne, 0,80 | Un jouet de bain, trop bien. Juste monter le kiosque pour le reconnaître de dos. |
| 27. Drone marin | retoucher | petite vedette sans cabine, antenne + dôme caméra, sillage blanc | dessus des flotteurs | petite, 0,65 | Petit et rapide : la vague blanche derrière fait tout. |
| 28. Veilleur méridien | retoucher | drone anguleux (hexagonal) qui porte une grande parabole, œil orange qui brille | corps + bras | moyenne, 0,82 | Il a l'air d'un drone du commerce. Il doit avoir l'air d'un prototype louche. |
| 29. Bastion méridien | refaire | forteresse sur chenilles : gros dôme hexagonal, 4 canons levés, œil orange | dôme + plaques de blindage | grande, 1,02 | Un anti-air version boss. Là, c'est un plateau gris avec des chenilles. |
| 30. Automate de combat méridien | refaire | un ROBOT à 4 pattes (genre Gardien de Zelda), gros œil orange qui brille, un canon | carapace | moyenne, 0,86 | « Char-robot », et c'est un char. Donnez-lui des pattes : la superusine en crache un par tour, ce sera l'unité dont tout le monde se souvient. |

### E. Bâtiment par bâtiment (les 8, plus le désaffecté et la superusine)

| Bâtiment | Verdict | Ce qui doit se lire à 48 px | Où va la couleur d'équipe, et à quoi on voit qu'il est neutre | Remarque |
|---|---|---|---|---|
| Ville | retoucher | 3–4 petites maisons serrées, toits pointus | tous les toits + drapeau ; neutre : toits gris `#b9bec7`, mât vide | Les tuiles c'est joli, mais 9 % d'équipe : un petit rectangle en bas. Les fenêtres qui s'allument la nuit, gardez. |
| Usine | retoucher | grand hangar au toit en dents de scie, cheminée, grande porte | toit en dents de scie + porte ; neutre : tout gris, porte fermée, mât vide | Le cadre bleu en fil de fer au-dessus, on dirait un échafaudage. Les dents de scie, tout le monde sait que c'est une usine. |
| Aéroport | refaire | une vraie piste en travers de la case (pointillés blancs), tour de contrôle, hangar | toit du hangar + haut de la tour + bandes en bout de piste ; neutre : gris, mât vide | Aujourd'hui c'est un héliport, un rond au sol, 7 % d'équipe : les chasseurs atterrissent où ? Manche à air en blanc, pas en orange. |
| Port | retoucher | une grue deux fois plus grosse, un entrepôt, un bout d'eau dans la case | grue + toit de l'entrepôt ; neutre : grue grise, mât vide | La grue, c'est le bon signe, mais à 48 px c'est un H gris. |
| Station radar | retoucher | la grande parabole blanche (à garder telle quelle, meilleur icône de la ligne) | murs + toit + pied de la parabole, qui reste blanche ; neutre : tout gris, mât vide | 4 % d'équipe : impossible de dire à qui elle est. |
| QG | refaire | le bâtiment le plus haut de la carte : tour centrale, remparts, le plus grand drapeau du jeu | toits + tours + grand drapeau ; neutre : gris, mât vide | On dirait un stand de marché posé sur de la terre, et son drapeau reste gris même quand il est pris. Le bâtiment qui fait gagner doit dépasser de sa case. |
| QG France | refaire | petit château aux toits d'ardoise très pentus, façon hôtel de ville parisien, sans aucun symbole | toits + drapeau ; neutre : pareil que le QG | Un pavillon de banlieue. J'ai superposé les deux images : c'est le même que le Luxembourg, zéro différence. |
| QG Luxembourg | refaire | forteresse sur un rocher, tour carrée et remparts | toits + drapeau ; neutre : pareil que le QG | Si deux QG nationaux sont identiques, c'est pas des QG nationaux. |
| Désaffecté (pas d'image) | à faire | le même bâtiment en version fermée : planches en croix sur portes et fenêtres, herbes, lumières éteintes | aucune : mât vide, couleurs désaturées de moitié | On doit lire « cassé mais réparable », pas « détruit ». |
| Superusine des Gris (pas d'image) | à faire | usine géante gris foncé, bandes et cheminées orange qui brillent, tapis roulant d'où sort un automate | toit dans la couleur du camp ; l'orange brille tant qu'elle produit, et s'éteint quand quelqu'un la prend (elle devient inerte) | C'est le boss de la mission, elle doit faire flipper de loin. |

Bonus : le pont est vert sur de l'herbe verte, il disparaît. En bois clair ou en pierre claire.

### F. Vos trois priorités, et ce que vous refusez absolument

**Priorité 1 — La charte, puis on recuit tout.** Les deux neutres, 40–60 % d'équipe sur le dessus, le contour fin et l'anneau (règles 1 à 5 et 13). Même sans toucher aux formes, ça règle le « je sais pas à qui c'est » et ça fait un seul jeu au lieu de trois.

**Priorité 2 — Refaire les silhouettes qui se confondent ou qui mentent**, dans cet ordre : les trois fantassins (un bonhomme avec un visage), l'artillerie, les trois caisses (roquettes, sol-air, sol-sol), les trois hélicos (dont le drone), les bateaux (cuirassé, porte-avions, barge), l'automate. Puis le test de la récré.

**Priorité 3 — Le QG et l'aéroport**, puis les toits en couleur d'équipe sur tous les bâtiments et le mât vide pour le neutre.

**Ce que je refuse :**
- Une unité où la couleur d'équipe est un liseré (moins de 30 %) : si je dois plisser les yeux pour savoir à qui est le char, c'est perdu.
- Le kaki et le « réalisme militaire de documentaire » : sur de l'herbe verte l'olive disparaît, et ça fait jeu à pub.
- Le gros contour noir épais : ça fait vieux jeu Flash.
