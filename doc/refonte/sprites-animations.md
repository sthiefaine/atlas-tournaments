# La peau 2D — animations, effets, météo, nuit (23 septembre 2026)

Lot H du plan `doc/refonte/plan-sprites-campagne.md` (seconde vague) : « améliorer les animations », « du jeu, fun comme Advance Wars, pas un diaporama ». Le contrat de partition (`render/partition.ts`) et le réalisateur n'ont **pas** bougé : ce lot est un exécutant. Le contrat des sprites (`render2d/contrat.ts`) non plus. **Rien n'a été regardé à l'écran** (consigne) : tout ce qui suit est vérifié par du code, sauf ce que la dernière section dit non vérifié.

## Les fichiers

| Fichier | Ce qu'il fait |
|---|---|
| `src/render2d/animations.ts` | L'interprète : un exécutant par genre (les **23** gestes de la carte), les **pistes** qui composent deux gestes sur une même unité, la marche, le tir, le coup, la sortie, les armes de la faction, le pouvoir. |
| `src/render2d/effets.ts` | Le **pool** d'effets (256 particules, un quart réservé au sol), la **planche** d'images peinte par le code une fois au montage (512², un téléversement), la **secousse** d'écran, les **superpositions** d'un pouvoir (éclat, vague de teinte). |
| `src/render2d/meteo.ts` | La **météo** en espace écran (pluie, averse de tempête, neige, brume, poussière) et l'**étalonnage** d'ambiance (la règle de la nuit). |
| `src/render2d/unites.ts` | Deux champs à l'état visuel : `clipTemps` (le temps de clip imposé par un geste) et `teinte` (le bleu d'une impulsion). |
| `src/render2d/index.ts` | Les branchements : pool, secousse, superpositions, planche, météo dans l'image ; ordre du voile ; étalonnage ; mode tactique du sol. |

## Les principes

**Les pistes.** La cible tire sa riposte pendant qu'elle encaisse : deux gestes tiennent la même unité. Chaque geste écrit sa `Piste` ; l'état visuel en est la composition (`recomposer`) — décalages sommés, opacités et échelles multipliées, éclats cumulés `1 − Π(1 − e)`, clip de plus haute priorité (`hors_jeu` > `touche` > `tir` > `capture` > `deplacement`). Fermer la dernière piste rend l'unité **exactement** au repos : c'est ce qui fait tenir `couper()`.

**L'arrêt sur image est local.** Un coup fige la cible — blanche, immobile, sur la première image de son clip `touche` — et son étoile d'impact pendant `ARRET_IMAGE_MS` (70 ms, jamais plus que la moitié du geste) ; puis les étincelles partent, la fumée monte, la pièce vibre le long du coup en s'amortissant, et l'écran secoue. **La partition n'est pas allongée** : le HUD joue la même partition sur sa propre horloge (chiffres, écran de combat), et un arrêt global décalerait ses chiffres de 70 ms par coup. La riposte en vol continue donc pendant l'arrêt de la cible.

**Tout effet est émis au départ de son geste**, retards compris ; sa vie est une fonction de son âge, et le pool ne fait qu'avancer l'âge — dans l'image, **après** l'avoir posé, sur l'horloge de la boucle (celle des gestes). Un projectile arrive donc à l'heure du coup, image comprise. Aucune allocation par image : chaque particule porte sa pose, réécrite en place (testé). Rien ne se pose au-dessus d'une case cachée, comme un son ne se joue pas.

**Aucun mouvement linéaire.** La marche prend un élan (−0,045 case), accélère, file, freine jusqu'à une vitesse résiduelle et **dépasse** son arrivée de 0,05 case avant de s'y poser à vitesse nulle — position et vitesse continues (`mouvementGlisse`, testé à la demi-milliseconde). Les passages ont chacun leur courbe (`courbePassage`).

## Les gestes

Durées : celles de `DUREES` (moitié en cadence rapide). « Son » : ce que joue la peau, jamais pour une case cachée.

| Geste | Durée | Ce qui se voit | Son |
|---|---|---|---|
| `glisser` | 120 ms/case | élan, croisière, dépassement, tassement (échelle −5 %, enfoncement) ; cap par segment ; foulée qui suit la **distance** (rebond d'un fantassin, grondement d'une chenille, houle d'un navire, flottement d'un appareil ; clip `deplacement` à 360 ms de clip par case) ; poussière derrière un véhicule, pas d'un fantassin, sillage d'un navire | le pas du matériel, toutes les 280 ms |
| `tirer` | 260 | recul le long du tir (marqueur 0,07, cloche 0,1, missile 0,035, rafale 3 × 0,03) ; vue gauche ou droite seulement ; éclair et étoile de bouche ; projectile selon `profilTir` — **rafale** (3 traçantes), **marqueur** (un obus tendu), **cloche** (obus en arc, traînée, fumée et poussière au départ ; une bombe tombe droit), **missile** (orienté, traînée, souffle arrière) — qui arrive à la fin du geste | `rafale` ×3, `missile`, `canon` |
| `encaisser` | 300 | arrêt sur image 70 ms, puis 5 à 9 étincelles, 1 à 2 fumées, anneau au sol ; vibration 0,05–0,09 case amortie ; secousse d'écran **2 à 4 px** (selon les dégâts) sur 240 ms, amortie au carré | `impact` |
| `sortir` | 420 | clip `hors_jeu`, la pièce chancelle et blanchit par à-coups ; au tiers, **explosion** (boule orange, cœur blanc, gerbe, fumée grise qui monte puis retombe, onde, poussière), secousse 4 px ; puis elle s'efface | `hors_jeu` à l'explosion |
| `apparaitre` | 520 | invisible en attendant ; tombe du bâtiment en prenant sa taille, se pose (tassement, rebond qui dépasse) ; halo et anneau aux couleurs du camp, **nuage de poussière** à l'atterrissage | `production` |
| `hisser` | 1 100 / 460 | le fanion suit les points (l'ancien descend, le nouveau monte en freinant) ; l'unité sautille ; acquise : gerbe de scintillements aux couleurs du camp au sommet du mât, onde au pied ; un cran : halo au pied du mât | `capture` quand les nouvelles couleurs montent |
| `remettre` | 1 200 | poussière aux quatre coins, deux planches qui volent, puis les **lumières reviennent** (éclat chaud, scintillements, onde du camp) | `capture` aux lumières |
| `batir` | 1 400 | poussière ; une pose : trois caisses qui arrivent en cloche, scintillements, onde ; un retrait : fumée grise | `production` |
| `ravitailler` | 600 | trois **caisses** lancées du ravitailleur à la cible, la cible s'allume à chaque réception, halo bleu pâle | — (chaque début de tour en compte beaucoup) |
| `reparer` | 600 | **scintillement** vert (six étoiles), halo vert, deux bouffées d'éclat | — (idem) |
| `embarquer`, `fusionner` | 360, 420 | élan puis rejoint en accélérant, rétrécit et s'efface ; une fusion allume sa partenaire | le bruit du matériel |
| `debarquer` | 360 | sort vite, dépasse, se pose ; poussière | idem |
| `repousser` | 320 | poussé en freinant, un saut, poussière à la réception | idem |
| `voiler`, `devoiler` | 480 | le voile tombe ou se lève, quelques scintillements | — |
| `reveiller` | 520 | éclat, petit bond, anneau et scintillements du camp | — |
| `surprise` | 700 | sursaut, tremblement à la réception, poussière | — |
| `frapper` | 900 | un missile par case du rayon (sur la carte, en vue), du centre au bord ; chacun tombe du ciel avec sa traînée et éclate ; secousse sur toute la salve ; **les deux camps** encaissent ensuite | `missile`, puis `impact` |
| `designer` | 520 | un **réticule** se referme sur la cible, puis le **trait** tombe du ciel (colonne orange, cœur blanc), éclat, anneau, étincelles | `rafale` au trait |
| `sceller` | 800 | un **anneau cyan se referme** du bord au centre, éclat, puis ce qui a un moteur **bleuit** (teinte), crépitements | `pouvoir` |
| `pouvoir` | 2 000 | **éclat d'écran** teinté du camp (0,4 ; 0,55 pour un super), **vague de teinte** depuis le QG — deux pour un super —, chaque unité du camp s'allume et sautille quand la vague la touche, onde, secousse | `pouvoir` |
| `cadrer` | 0 | la caméra, si la case sort du champ | — |

`duel` et `chiffre` n'ont pas d'exécutant : ils sont au HUD (l'écran de combat du lot I).

## La nuit, la brume, la tempête (demande du coordinateur)

Le sol peint la palette de **jour** ; le moteur l'étalonne. Avant ce lot, le voile était peint après les volumes et **avant** les unités : le sol et les bâtiments s'assombrissaient la nuit, pas les figurines, et les surbrillances étaient voilées. Désormais :

1. le **voile** (`c·(1 − a) + V·a`) est peint juste après le sol, **sous** les surbrillances et l'anneau de sélection, qui restent lisibles ;
2. chaque image **du monde** — bâtiments, mâts, drapeaux, décor, figurines — reçoit par instance une teinte `T` et un éclat `e` (`etalonnageAmbiance`) qui rendent **exactement** le blanc voilé, et toute couleur à moins de 0,05 près (écart mesuré sur les 48 ambiances, cent un niveaux par canal : au pire 0,0423, les noirs d'une nuit de brouillard dans le bleu) ; une seule fois — instances fraîches pour les bâtiments et les unités, copies pour le décor du sol ;
3. ne la reçoivent pas : les **pastilles de PV**, les **marques**, les ombres, les effets (de la lumière), la météo (sa propre nuit) ;
4. les **fenêtres des villes** (pages d'émission) s'ajoutent après la teinte, dans le lot : elles ressortent ;
5. le **fond** sous le sol passe lui aussi à la palette de jour : il n'est plus assombri deux fois.

La règle est tenue par `tests/render2d/meteo.test.ts` (cohérence numérique, ce qui est étalonné, figurines contre pastilles et ombres).

## La météo

En espace écran, dans le calque `meteo` (matrice de l'écran), chaque particule une fonction du temps (tirages faits une fois). Plafond 260, **110 au doigt** (`pointer: coarse`) ; cadence au repos 30 images par seconde, 20 au doigt ; **rien** sous animations réduites. Pluie : gouttes couchées par le vent (0°, 10°, 20°, 30° peints), éclaboussures ; tempête : plus dense, plus couchée, plus claire ; neige : flocons qui balancent ; brume : quelques grandes nappes lentes ; canicule : grains de poussière. La nuit assombrit la météo elle-même.

## Mode tactique du sol (demande du coordinateur)

`sol.tactique?.(actif)` est appelé par `modeTactique` **et** après chaque création du sol (il renaît quand le manifeste arrive) : le mode survit.

## Couper, réduire

`couper()` : chaque `terminer` pose l'état final exact (pistes fermées, drapeaux rendus, unités retenues relâchées) ; la peau vide le pool, arrête la secousse et les superpositions. Animations réduites (préférence ou `prefers-reduced-motion`, ou partition sans durée) : aucun effet, aucune secousse, aucune vague, aucune météo ; pas de bruit de pas ; une rafale ne fait qu'un bruit.

## Vérifié, par du code

- **Tests unitaires** : `tests/render2d/animations.test.ts` (9, repris : trois d'entre eux lisaient l'ancienne cadence linéaire), `animations-gestes.test.ts` (45 : les 23 genres au départ, au milieu et **au repos exact** à la fin ; la marche — élan, dépassement, continuité, sur cinq durées ; le cap par segment ; la foulée ; le profil de tir par les données ; le recul et l'arrivée du projectile ; la rafale ; l'arrêt sur image et la secousse — durée, bornes, amortissement ; la sortie ; la production ; la capture ; la **riposte composée** ; la coupure ; les animations réduites ; la frappe, le rayon, l'impulsion, le pouvoir ; les passages), `effets.test.ts` (17 : capacité et recyclage, poignées, trajets, gravité, tenue, montée et fondu, brouillard, caps d'écran, **mêmes objets d'une image à l'autre**, planche sans chevauchement et un seul téléversement, secousse, éclat, vague), `meteo.test.ts` (11 : rien sous réduction, nombre et plafonds, déterminisme, bornes d'écran, vent, nuit, règle de la nuit). Avec le reste de `tests/render2d` (sol compris) et `tests/frontieres.test.ts` : **278 verts**.
- **`e2e/animations-2d.spec.ts`**, contre un serveur à soi (`NEXT_DIST_DIR=.next-anim`, port 3412), **vert sous Chromium (5,4–6,5 s) et WebKit (6,2–8,8 s)** : le char de `premier_contact` glisse (points intermédiaires), attaque l'infanterie d'en face, **recule** dans la fenêtre du tir (entre le tiers de l'écran de combat et la riposte), des **effets** sont dessinés pendant le combat, la figurine se pose exactement au centre de sa case, les effets s'éteignent, la main revient au joueur ; la pluie forcée dessine la famille `meteo`, plus rien sous animations réduites ; aucune erreur de console. L'ancien `e2e/rendu-2d.spec.ts` reste vert avec la nouvelle marche.
- **Quatre témoins, tous tombés** : sans l'exécutant `tirer` → « le recul du tir » ; sans images d'effets (planche qui ne résout rien) → « des effets dessinés pendant le combat » ; météo qui ignore la réduction → `meteo` 412 au lieu de 0 ; météo muette → 0 au lieu de > 0. Un premier témoin **était passé** : la secousse de la riposte sur le char passait pour son recul ; la fenêtre du tir l'a corrigé. Fichiers restaurés octet pour octet (`cmp`).
- `npm run typecheck` et `npx eslint src/render2d tests/render2d e2e/animations-2d.spec.ts` : verts.
- **Coût processeur** (Node, machine calme) : 11,6 µs par image pour 192 particules vivantes, 31 µs pour une tempête (280 poses) — à côté des 16,6 ms d'une image.

## Non vérifié

- Tout le visuel et le « fun » : la force de l'arrêt sur image et de la secousse, la lisibilité des traçantes à 48 px par case, les couleurs des effets, la vague d'un pouvoir, la pluie, la teinte de la nuit sur les images cuites.
- Les clips cuits des unités n'existent pas encore (la cuisson a livré bâtiments et décor) : la foulée cuite (`MARCHE.msClipParCase`, 360 ms de clip par case) et la tenue de la première image de `touche` sont écrites, jamais vues.
- La cadence réelle sur téléphone ; la perception des sons (calés sur les gestes, aucun son neuf).
- L'explosion à la sortie s'écarte de `doc/10` §2 (« elle n'explose pas ») : demandée par le coordinateur au nom du propriétaire (« explosion et fumée qui retombe »), gardée sans sang, sans débris, fumée grise et non noire. À confirmer par le propriétaire.

## Ce que ce lot attend des autres

- **HUD (`render/hud-html.ts`)** : en visée, la prévision du duel (`div.duel-camp`) est posée **sur la case de la cible** (mesuré par `elementFromPoint` à 1280 × 800) : un clic de souris sur la cible touche la prévision, pas la carte, et l'attaque ne part pas. Le spec confirme au clavier (Entrée). À corriger côté HUD.
- **Lot (`render2d/lot.ts`)** : deux ajouts rendraient ce lot plus juste — un mélange **additif** par instance (les éclats et étincelles se peignent aujourd'hui en « par-dessus » prémultiplié), et un **étalonnage par appel de calque** (uniforme) qui remplacerait l'approximation par instance (≤ 0,05) par l'exact.
- **Cuisson** : `tir`, `touche`, `hors_jeu`, `capture` ne sont cuits qu'en vue `droite` ; le tir ne se tourne donc que vers la gauche ou la droite (fait). Une fois les clips d'unités cuits, régler `MARCHE.msClipParCase` à la foulée réelle.
- **Écran de combat (lot I)** : un encart est résolu par le même résolveur que la carte — il peut poser des `effet_*` ; `PoolEffets`, `Secousse` et les profils (`profilTir`, `hauteurImpact`) sont exportés.
- **Moteur 2D** : une unité **retenue** se dessine même sur une case cachée (test existant, « elle sort sous nos yeux ») ; ses effets, eux, ne se posent pas hors de vue — une unité mise hors jeu dans le brouillard s'efface sans explosion.
- **Chaînes i18n** : aucune — ce lot n'affiche aucun texte.
