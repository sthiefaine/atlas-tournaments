# CLAUDE.md — passation

Document de passation pour Claude Code. Il dit ce qu'est le projet, où sont les choses, ce qui est vrai aujourd'hui et ce qui ne l'est pas. Quand il contredit `BRIEF.md`, c'est `BRIEF.md` qui a raison.

## Mise à jour — cinq axes et entraînement (5 septembre 2026)

L’état historique ci-dessous doit être lu avec `doc/15-premiers-matchs.md` : six missions sont désormais jouables via `/campagne`, dont quatre tutoriels avant les matchs officiels. Objectifs escorte/relais/survie, génie, dix profils de biomes, styles de l’alliance Luxembourg et HUD adaptatif sont implémentés. Moteur 2, catalogue 2 (compatibilité catalogue 1), générateur 2. Les marées et le raccordement mapgen existaient déjà ; les passages ci-dessous disant le contraire sont obsolètes. La progression est locale au navigateur ; les routines Claude et le parcours Postgres ne sont pas mis en service par cette livraison.

## Mise à jour — grammaire Advance Wars (5 septembre 2026, soir)

Quatre changements d’interface, tous derrière l’interface `Rendu` commune, donc valables en 2D comme en 3D.

1. **Les commandants parlent sur la carte.** `Scenario.scenesDialogue` (`doc/03` §6) déclare des scènes déclenchées par les **événements** du moteur — première attaque, capture, perte, production d’un type d’unité, pouvoir, jalon de relais, journée. Les déclencheurs sont dans `src/render/dialogues.ts` (pur, testé), la boîte de dialogue dans `src/render/dialogue-html.ts` (buste vectoriel, frappe lettre à lettre, letterbox). `dialogueOuverture` se joue désormais **sur la carte une fois cadrée**, plus dans une modale ; la fiche de mission ne porte plus que le titre, l’objectif et le tutoriel. Le tour d’IA **attend** qu’une scène soit refermée. Option `dialogues` de `monterJeu`, **fausse par défaut** : la démo et les tests de fumée ne sont pas concernés.
2. **Vert, j’y vais ; rouge, j’y tire** (`doc/10` §8). Le déplacement passe au vert émeraude, et le rouge devient l’**enveloppe de tir complète** — toutes les cases frappables depuis n’importe quelle arrivée, privées des cases atteignables. L’or reste aux objectifs, le bleu aux chantiers du génie.
3. **Le chemin est une flèche**, coudée, avec pointe et liseré sombre, en 2D comme en 3D où elle épouse le relief.
4. **La prévision de duel** (`doc/04` §5.2 bis) : `prevoirDuel()` rejoue la formule de combat sans tirer d’aléa et sans rien muter ; le HUD montre les deux camps avant confirmation. Conséquence : même face à une cible unique, l’ordre `attaquer` passe par la phase de visée.

Au passage, `tests/schemas/contenu.test.ts` valide enfin `content/scenarios/` — rien ne le faisait —, et `e2e/fumee-3d.spec.ts` ouvre le Bulletin avant d’en lire les prévisions (il était devenu repliable, le test ne le savait pas).

## Mise à jour — l’écran-titre et les réglages (5 septembre 2026, nuit)

`src/app/page.tsx` n’est plus une page de présentation : c’est un **écran-titre de jeu, pensé en portrait d’abord**. La version précédente mesurée sur 390 px plaçait son seul bouton à 711 px du haut et le plateau — la seule chose qui montre le jeu — à 805 px : deux écrans plus bas. Quatre décisions le tiennent, et elles valent pour la suite du site.

1. **Le jeu est le fond, en plein cadre.** L’attract mode (`attract.tsx`) et son repli SVG (`plateau-accueil.tsx`) passent en `position:fixed;inset:0` derrière tout, cadrés en `slice` pour que le fondu entre les deux ne fasse pas sauter l’échelle. Le cadre de la vitrine disparaît au profit d’une **nappe en dégradé** plus d’une vignette : on n’encadre pas une capture de son propre jeu sur son écran-titre. L’attract est désaturé (`saturate(.86) brightness(.82)`) pour que le vert et le rouge du jeu ne disputent pas au signal le rôle de « couleur qui appelle ». Le coût reste cantonné : l’accueil pèse **2,57 ko / 109 ko**, l’attract n’entre jamais dans le rendu initial.
2. **Quatre boutons, ancrés en bas** — Campagne, Jeu libre, Atelier des mondes, Réglages. Au-delà de 560 px du bord inférieur, un pouce n’atteint plus rien : le titre y va, le menu jamais. Mesuré, le bouton Campagne est à 281 px du bas en 844 comme en 667. L’ancrage se fait par `margin-top:auto`, **jamais `position:fixed`** — la rétraction de la barre d’adresse iOS fait sauter un élément fixe. Cinq registres distinguent les boutons et aucun n’est le texte : peinture, hauteur, biseau, ombre, glyphe.
3. **Campagne porte l’état, et le geste unique survit.** Le bouton mène droit à la prochaine épreuve non remportée et affiche sur lui-même la jauge de six segments et le titre de l’épreuve ; la carte de progression entière est absorbée dedans. Une seconde cible, « Carnet », mène au choix libre — sans elle, rejouer une mission depuis l’accueil devient impossible. Le serveur rend l’état neutre (jauge vide, aucun chiffre, destination `/campagne`, vraie dans tous les cas), le client l’enrichit : afficher « 0 sur 6 » deux cents millisecondes à quelqu’un qui a tout gagné serait une affirmation fausse.
4. **Un écran, pas de défilement** — vérifié à 390 × 844, 375 × 667 et 1280 × 800. Ce qui ne tenait pas a été **supprimé**, pas repoussé : le bandeau de marque, le pitch de 190 caractères, les trois liens soulignés, le pied et la frise des vingt-quatre nations. Mais `overflow:hidden` a disparu de `.atlas-accueil`, et `100dvh` est devenu `100svh` : la page ne défile pas parce qu’elle ne dépasse pas, jamais parce qu’on le lui interdit — à 200 % de zoom texte, l’interdit coupait le bas sans recours.

**`/reglages` existe** (`src/app/reglages/`, plus `src/app/preferences.ts`), et ne porte que les trois réglages qui existent réellement dans le code : la peau (`Automatique` / `Relief 3D` / `Plan 2D`, qui n’était accessible que par `?rendu=`), les dialogues des commandants, et la réduction des animations. Pas d’interrupteur inerte : il n’y a pas d’audio dans le jeu, il n’y a donc pas de réglage de son. Deux règles s’y appliquent. Le réglage système reste **maître** sur les animations — l’interrupteur ne peut qu’ajouter la réduction. Et `?rendu=` garde la priorité sur la préférence : une URL est un ordre explicite. « Effacer ma progression » emporte `atlas:qualification:v1` **et** tous les `atlas:partie:*` — n’effacer que le premier laisserait des parties fantômes reprenant au milieu d’une épreuve qu’on croit n’avoir jamais commencée. `preferences.ts` **recopie** `PREFIXE_SAUVEGARDE` plutôt que d’importer `render/jeu.ts`, qui ferait entrer le moteur et les deux rendus dans la page ; `tests/campagne/preferences.test.ts` échoue si les deux divergent, et c’est ce qui rend la copie acceptable — la page pèse 1,34 ko.

L’attract mode a été repris au passage : cadrage serré au lieu de la carte entière, rythme accéléré (330 ms d’intention, 190 ms entre deux actions), caméra qui **suit l’action** par `cadrer()` — qui ne recentre que si la case sort du champ —, et une graine tirée parmi cinq à chaque visite. Chaque partie reste déterministe, c’est le moteur ; mais un écran-titre qui repasse le même match coup pour coup se remarque dès la deuxième ouverture.


## Mise à jour — le terrain qui bouge (5 septembre 2026, nuit)

Les deux rendus **gelaient le terrain au premier jour**. En 3D, la grille était capturée dans une fermeture au montage de `batir()` ; en 2D, la couche de fond était mise en cache sous une clé qui ignorait la journée. Or une mécanique régionale — les marées — **réinterprète** la grille sans jamais l’écrire (`modifTerrain` est une lecture) : la marée changeait dans le moteur et jamais à l’écran. Le génie, qui pose et retire du terrain, souffrait du même gel.

Trois corrections, et une leçon.

1. `Plateau.majTerrain(grille)` remet en place altitudes, splat et routes **sans reconstruire** le plateau : rebâtir coûterait la repeinture des cinq jeux de matières et un recadrage de caméra à chaque journée.
2. La clé du cache 2D et le témoin 3D utilisent `signatureTerrain` — la fonction **du moteur** (`src/engine/hooks.ts`), qui porte déjà journée, climat, terrains posés et état de la mécanique. Une signature réinventée côté rendu serait forcément plus pauvre.
3. **Ce qui repose sur le sol doit se reposer avec lui.** Les unités relisent l’altitude à chaque `maj`, mais le décor était posé une fois pour toutes : `Decor.majRelief()` replace arbres et rochers après une mutation. Les unités s’**orientent** en plus sur la pente (bornée à 13°, suivie à 55 % — suivre le relief au degré près fait culbuter un char sur une berge) et ne descendent jamais sous le plan d’eau : une pièce reprise par la marée patauge, elle ne se noie pas.

4. **Le centre de chaque case est enfin plat.** `10-rendu-3d.md` §4.2 l’exige depuis le début — « sinon une unité posée sur une pente penche et le décalque de surbrillance se déforme » — mais `hauteurEn` était une interpolation bilinéaire pure : la pente traversait le centre de la case. Une maison posée sur une montagne s’enfonçait d’un côté et flottait de l’autre. Une rampe plate sur ±0,28 case reporte le dénivelé **sur la jonction** entre cases ; le plateau y gagne des gradins de jeu plutôt qu’une dune. **Fait depuis** : le second garde-fou de la même règle, « les cases de bâtiment sont plates, elles et leur couronne immédiate ». `REPLI_CENTRE` valait 0,28 pour toutes les cases, or le socle d’un bâtiment fait 0,83 de côté et son liseré de camp va jusqu’à ±0,46 : il débordait du disque plat et se faisait couper par le relief voisin — « la maison est dans la montagne ». Une case bâtie a désormais un repli de **0,5**, donc plate d’un bord à l’autre, et `rampeEntre(t, repliA, repliB)` accepte **deux replis différents** : un bâtiment impose son plateau jusqu’à sa propre frontière sans écraser le relief de sa voisine, qui garde toute sa hauteur dès son côté de la jonction. Aplanir la voisine aurait effacé un relief qui coûte du mouvement et donne de la défense, donc menti sur les règles. Le maillage ayant trois subdivisions par case, la marche tient exactement dans un quad.

7. **Les pierres cessent d’être des dés.** C’était un `DodecahedronGeometry` unique, gris uni, tourné sur trois axes au hasard et **relevé** de 0,06 au-dessus du sol : une caillasse de dés flottant chacun sur une facette d’appui. Trois silhouettes désormais — un bloc, des éclats, une dalle —, chacune érodée par un bruit tiré de la **position arrondie** de ses sommets, faute de quoi les facettes se décousent (la géométrie d’un icosaèdre n’est pas indexée). Elles tournent librement autour de la verticale, s’inclinent à peine, **s’enfoncent** au lieu de se poser, portent une teinte par instance, et se sèment en couronne pour laisser le centre de la case à l’unité qui s’y pose. Un appel de dessin par silhouette, et le placement reste dérivé de l’aléa de case.
5. Une mutation de terrain est devenue un **événement** de 1,4 s : fondu du mélange de matières, glissement des altitudes, écume qui enfle puis retombe. Les normales ne sont recalculées qu’à la fin — les rafraîchir à chaque image coûterait plus que tout le reste pour un gain invisible.

6. **Le rendu n’invente plus le trajet d’un déplacement.** L’événement `deplacement` ne portait que `de` et `vers` : la peau 3D reconstruisait un chemin **en L** et la 2D glissait en **ligne droite**. Les deux traversaient montagnes et unités adverses. L’événement porte désormais `chemin`, celui que `verifierChemin` a validé, tronqué à la case d’arrêt en cas d’interruption sous brouillard. `cheminEnL`, `longueurChemin` et `surChemin` ont quitté `render3d/` pour `src/render/chemin.ts` : les deux peaux en avaient besoin, et `render/` n’a pas le droit d’importer `render3d/` (`02-architecture.md` §5).

**La leçon, pour la suite** : toute donnée dérivée de la grille et calculée au montage est un gel en puissance. Le décor, l’éclairage et les surbrillances lisent `plateau.hauteurEn`, qui est désormais une fermeture **vivante** ; ne pas la remplacer par une valeur.

**Le bandeau de tour attend la fin d’une scène.** Un « à vous de jouer » et une réplique de commandant lancés au même instant se disputent la même seconde ; `annoncerTour` efface le tour déjà annoncé quand une scène est ouverte, de sorte que l’annonce se rejoue juste après la dernière réplique. Les deux arrivent, l’un après l’autre.

**L’entrée en mission est directe** (`src/app/jeu/[scenario]/toile.tsx`) : plus de fiche à valider avant de jouer. Le plateau se monte tout de suite, une partie en cours se reprend d’elle-même, et l’ouverture se joue en dialogue sur la carte. L’objectif est affiché en permanence dans le rappel de mission, en haut à gauche ; le tutoriel, le conseil et « nouvelle partie » sont derrière ce rappel.

Seule `src/app/convocation.tsx` est cliente, parce qu’elle lit `localStorage` ; la page lui passe des **libellés déjà traduits**, comme on le fait pour les rendus. Le sens de l’hydratation est à sens unique : le serveur rend l’état neutre, le client l’enrichit — jamais l’inverse, une bascule « reprendre » → « entrer » se lirait comme une progression perdue.

## Le projet en cinq lignes

Atlas Tournament est un tactique au tour par tour dans l'esprit d'Advance Wars, jouable dans un navigateur. Dans ce monde, les guerres ont été remplacées par des Jeux Tactiques : chaque pays a une équipe et un commandant, et un tournoi fait le tour de la planète tous les quatre ans. Le joueur part de France — tout le monde part de France —, traverse ses 18 régions puis le monde, et ses choix décident de la fin qu'il obtient et de l'état des 24 nations : alliée, rivale, retirée. Une nation alliée peut être **incarnée** — jouée entièrement, avec son général et son catalogue, le temps d'un match — et s'ouvre comme départ pour une Nouvelle Ronde. Techniquement : une seule application Next.js 15 en TypeScript strict, un moteur de règles pur et déterministe, un rendu 3D three.js avec repli vectoriel 2D, et cinq routines Claude qui produisent le contenu sous le contrôle d'un serveur qui ne fait confiance à rien. Rien de généré ne passe en ligne sans un verdict mesuré, et souvent sans un humain.

## À lire d'abord, dans cet ordre

1. **`BRIEF.md`** — le canon. Toutes les décisions prises, y compris les arbitrages du 5 septembre 2026.
2. **`PLAN.md`** — les treize étapes (0 à 12), avec un critère de fin écrit pour chacune.
3. **`doc/README.md`** — l'ordre de lecture des quinze documents de conception, et surtout **qui est propriétaire de quoi**.

**La règle de résolution des conflits, sans exception : le brief a raison sur tous les documents ; le document propriétaire d'un sujet a raison sur tous les autres documents.** `doc/README.md` donne le tableau des propriétaires. Exemple concret : si `PLAN.md` et `doc/11-assets-spec.md` ne disent pas le même nombre de spécifications d'assets, c'est `doc/11` qui fait foi, parce qu'il est propriétaire des assets.

Un document ne se lit **jamais** comme les autres : `doc/14-secrets.md`. Il n'est jamais servi à une routine, jamais résumé dans un prompt, jamais copié dans `content/`.

## L'arborescence

```
src/app/          Next.js App Router. La seule couche qui a le droit de tout importer.
                  Pages : `/` (accueil provisoire), `/jeu/[scenario]`, `/admin/*`.
                  API : /api/health, /api/canon, /api/i18n, /api/admin, /api/routines/*.
src/engine/       Le moteur, pur et déterministe : (état, action) → état. Règles, RNG seedé,
                  rejeu, climat, mécaniques régionales par hooks, déblocages. Zéro dépendance.
src/ai/           L'IA de jeu : une fonction d'évaluation et trois stratégies (pondérée,
                  agressive, défensive). C'est elle qui certifie les cartes.
src/mapgen/       Le générateur : ParametresCarte + graine → MapDef, symétrie, vérifications,
                  aperçu texte. Deux appels avec la même graine donnent la même carte.
src/render/       Le socle de rendu commun aux deux peaux : interface `Rendu`, boucle paresseuse,
                  caméra, entrées, HUD HTML, ambiance, sauvegarde locale, et la peau 2D vectorielle.
src/render3d/     La peau 3D three.js : scène, terrain, éclairage par saison/phase/météo, unités
                  et décor instanciés, surbrillances, animations, textures.
src/assets/       Le format `AssetSpec`, le catalogue qui le compose depuis le canon, les styles
                  nationaux, et les validateurs (spec et glTF binaire, sans dépendance).
src/content/      Les chargeurs typés du canon JSON.
src/schemas/      Les types partagés et les validateurs écrits à la main, sans dépendance.
src/i18n/         `t()`, l'ordre de repli des langues, et la table des chaînes d'interface source.
src/db/           Drizzle : le schéma, le client, et un fichier de requêtes typées par table.
src/serveur/      La logique serveur testable en Node : auth, cycle de contenu, file de missions,
                  contrôle, simulation, dépêche, traduction, canon, prompts, sonde.

content/          Le canon JSON, servi en lecture seule par /api/canon.
                  unites, terrains, degats, mecaniques, archetypes, flags, gabarits-missions ;
                  pays/ (24), regions/fr/ (18), styles/ (24 + regions/fr/ 18), fils/ (9),
                  cartes/, scenarios/, i18n/ (chaînes et glossaire français).
assets/specs/     540 AssetSpec générées depuis le canon, versionnées.
scripts/          migrate.mjs, simuler.ts, controler-carte.ts, apercu-carte.ts,
                  generer-specs-assets.ts, extraire-chaines.ts.
drizzle/          Les migrations SQL numérotées. Un fichier appliqué ne se modifie jamais.
tests/            tsx --test, un dossier par couche, plus frontieres.test.ts.
e2e/              Deux tests de fumée Playwright (2D et 3D), sur le port 3400.
doc/              Les quinze documents de conception, plus doc/assets/ (démos de rendu).
apercus/          Les PNG de relecture produits par apercu-carte.ts. Ignoré par git.
```

## Les règles d'import

`tests/frontieres.test.ts` les fait respecter mécaniquement : il lit les imports de chaque fichier de `src/` et échoue sur la moindre violation. La table des couches autorisées est **dans le test**, et c'est elle qui fait foi.

- `engine`, `ai`, `mapgen` ne connaissent que `schemas` et `content`. Jamais `render`, jamais `db`, jamais `app`.
- `render` peut importer `engine`, `schemas`, `content`, `i18n`. `render3d` ajoute `render` et `assets` — jamais l'inverse.
- `serveur` peut importer le jeu et `db` ; `app` peut tout importer ; `schemas` n'importe rien.

**Les interdits dans les couches pures** (`engine`, `ai`, `mapgen`, `schemas`, `content`) sont vérifiés par le même test, par simple recherche de motif : `window`, `document`, `fetch(`, `Date.now(`, `Math.random(`. Le moteur ne lit jamais l'horloge — pas même pour évaluer un déblocage : la date lui est **donnée** par l'appelant, et c'est le serveur qui la fixe. Le hasard passe exclusivement par le RNG seedé de `src/engine/rng.ts` et ses flux dérivés. `render/` et `render3d/` ont le droit d'appeler `Date.now()`, et seulement pour cadencer une animation.

## Les conventions

- **Tout est en français** : le code, les commentaires, les noms de fichiers, les identifiants. Un commentaire dit *pourquoi*, pas *quoi*.
- **Les clés sont en minuscules sans accent**, avec des tirets bas : `carte_plaine_symetrique`, `pays.fr.qualifie`, `hud.fin_de_tour`. Les regex qui les valident sont dans `src/schemas/types.ts` et testées par `tests/schemas/regex.test.ts`.
- **Le moteur ne connaît aucune unité par son nom.** Les dix unités sont des données (`content/unites.json`) avec leurs traits et leur `Silhouette` ; une unité homologuée demain doit fonctionner sans une ligne de code moteur.
- **Aucun texte en dur dans le rendu.** Tout libellé passe par une clé et `t()`. Un rendu n'appelle même pas `t()` : on lui donne les rares libellés déjà traduits. `npm run extraire-chaines` reconstruit `content/i18n/` et un test échoue sur tout littéral affichable trouvé hors d'un appel à `t()`.
- **Tout contenu est validé par `src/schemas/valider.ts`**, à l'entrée du serveur comme au chargement du canon. Ces validateurs sont écrits à la main, sans aucune dépendance, et ils sont la seule porte : le serveur recalcule et refuse ce qu'il n'a pas lui-même soumis.
- **Déterminisme** : même graine + mêmes actions = même état, au bit près. C'est ce qui permet à la routine contrôle de certifier une carte, et c'est le premier invariant à ne pas casser.

## Les commandes

| Commande | Ce qu'elle fait |
|---|---|
| `npm run dev` | le site en développement, **port 3400** |
| `npm run build` | `next build` — n'exige **aucune** variable d'environnement |
| `npm start` | migrations puis Next (c'est ce que lance le Dockerfile) |
| `npm run typecheck` | `tsc --noEmit`, TypeScript strict |
| `npm run lint` | ESLint |
| `npm test` | 639 tests `tsx --test` |
| `npm run test:e2e` | les deux specs Playwright ; le spec 3D porte ses propres drapeaux SwiftShader |
| `npm run migrate` | applique `drizzle/*.sql` une fois chacun, copie de sécurité `pg_dump` avant |
| `npm run simuler -- --carte tests/engine/cartes/plaine.json --parties 50 --graine 1` | N parties IA contre IA |
| `npm run controler -- --carte <fichier>` | le verdict exact de la routine contrôle, hors ligne |
| `npm run apercu -- --params '{"largeur":16,"hauteur":12}' --graine 7 --sortie apercus/c.png` | une carte en PNG et en texte |
| `npx tsx scripts/generer-specs-assets.ts --verifier` | vérifie que `assets/specs/` n'a pas dérivé du canon |
| `npm run extraire-chaines` | extrait les chaînes ; marche à blanc sans `DATABASE_URL` |

## L'état réel, étape par étape

| Étape | État | Ce qui est là, ce qui manque |
|---|---|---|
| 0 — Socle | **fait** | Next 15, TS strict, `tsx --test`, Playwright, Drizzle, `migrate.mjs`, `.env.example`, CI. La CI ne lance **ni `lint` ni Playwright**. |
| 1 — Moteur | **fait** | Règles, RNG, rejeu, climat, hooks de mécaniques, IA à trois stratégies, `simuler.ts`. |
| 2 — Générateur + contrôle | **fait** | `mapgen/`, vérifications, campagne multi-climats, `ReviewVerdict` motivé, `controler-carte.ts`, `apercu-carte.ts`. La campagne des 200 cartes aléatoires du critère de fin n'a pas été relue à l'œil. |
| 3 — Rendu | **fait** | Interface `Rendu` commune, peau 2D, peau 3D, HUD HTML, repli WebGL, `?rendu=2d`, deux specs de fumée. Le seuil de 48 px par case n'est pas exercé sur tous les couples (carte × écran). |
| 4 — Assets 3D | **partiel** | 540 specs générées et valides, validateur glTF écrit. **Aucun `.glb` réel n'existe** : tout est placeholder. La boucle avec le générateur externe n'a jamais été parcourue. |
| 5 — Serveur et admin | **partiel** | Toutes les routes, le cycle, les prompts versionnés, la file, l'admin, la sonde — **écrits et testés hors base**. Aucune base n'a jamais été branchée. |
| 6 — Routines en ligne + i18n | **à faire** | Aucune tâche planifiée Claude n'existe. Côté i18n, seul `fr` a un bundle ; `en` est déclaré en base par la migration mais **aucun bundle `en` n'existe**. |
| 7 — France, 18 régions | **partiel** | Les 18 fiches sont dans `content/regions/fr/` et leurs styles aussi. **Aucune mécanique régionale n'est implémentée dans le moteur** : il n'y a que le contrat de hooks et une mécanique de test. |
| 8 — Lore et 24 nations | **partiel** | Les 24 fiches `Country` sont dans `content/pays/`. Pas de prologue, pas de routine lore, rien en base. Pas d'écran de choix du pays, et il n'en faut pas au premier parcours : tout le monde part de France (`BRIEF.md`, révision du 5 septembre au soir) ; les 24 fiches sont des **relations**, puis des départs débloqués en Nouvelle Ronde. |
| 9 — Voyage et campagne | **partiel** | `deblocages.ts` (dix conditions, `confiance` comprise), `content/fils/` (9 fils), `content/gabarits-missions.json`, le type `ProfilCampagne` et son validateur. Les **matchs d'incarnation** existent au schéma (`Scenario.incarnation`) et dans le moteur (`sceneDepuis` place le général incarné au camp du joueur) ; le **co-commandant passif** et la **montée de la confiance** ne sont pas implémentés — c'est le serveur qui devra recalculer `confiance` comme il recalcule `relations`. Pas de carte du monde, pas de carnet, pas de persistance de profil, aucune mission écrite. |
| 10 — Cerveau et jeu vivant | **partiel** | Les routes et la logique de dépêche, d'homologation, de mémoire et de prompts existent. Rien n'a tourné. **La mise en ligne à 18 h n'est pas câblée** (voir ci-dessous). |
| 11 — Paquet naval | **à faire** | Rien. Huit pays portent une spécialité de repli terrestre en attendant. |
| 12 — Finition | **à faire** | Rien. Huit des neuf langues restent `en_preparation`. |

## Les manques connus, nommément

Ils sont listés ici parce qu'ils se voient mal dans le code, pas parce qu'ils sont graves.

1. **Aucune base n'est branchée ni testée en réel.** Tout `src/db/` et une bonne partie de `src/serveur/` n'ont jamais parlé à un Postgres. Le test `tests/serveur/migrations.test.ts` est **sauté** faute de `DATABASE_URL` (c'est le seul des 629 qui l'est). `npm run migrate` sans base va proprement jusqu'à `ECONNREFUSED` et rend 1.
2. **`scripts/migrate.mjs` ne lit pas `.env`.** Il attend `DATABASE_URL` dans l'environnement, ce qui est juste en production (Coolify l'injecte) mais surprend en local : `npm run migrate` répondra `DATABASE_URL manquante` même avec un `.env` rempli. Lancer `node --env-file=.env scripts/migrate.mjs`, ou ajouter le drapeau au script — c'est une décision à prendre, pas un oubli à corriger en silence.
3. **La mise en ligne de la Dépêche à 18 h n'est pas câblée.** `armer()` passe la dépêche en `valide` sur décision humaine, et la requête `enLigne()` ne sert que le statut `en_ligne` : **rien ne fait la transition à l'heure dite**. Il manque le déclencheur (huitième tâche planifiée, ou évaluation paresseuse à la lecture — à trancher).
4. **Aucun bundle `en`.** `src/i18n/` ne connaît que `SOURCE_FR`. Les huit autres langues sont des lignes en base, sans glossaire ni traduction. Le repli `langue → en → fr` fonctionne, mais il tombe toujours sur `fr`.
5. **Aucun modèle 3D réel.** Les unités, terrains, bâtiments et décors sont des placeholders composés depuis la `Silhouette`. Les silhouettes **`rail`, `ailes` et `coque`** sont écrites dans `src/render3d/pieces.ts` mais **aucune unité du catalogue ne les utilise** : elles n'ont jamais été vues à l'écran.
6. **L'IA va souvent aux points.** Sur 50 parties de `plaine.json`, 28 finissent par `limite_journees`, donc par une décision aux points, contre 22 par élimination. C'est jouable et déterministe, mais ce n'est pas une IA qui cherche à gagner : elle capture et échange, et laisse le chronomètre trancher.
7. **« Parties non terminées » n'a pas la même définition à deux endroits.** `src/serveur/controle/verdict.ts` dit — et c'est la définition canonique — qu'une partie non terminée est une partie **sans vainqueur**. `scripts/simuler.ts` compte en plus toutes celles qui ont atteint `limite_journees`, même décidées aux points. D'où l'écart déroutant entre `simuler` (28 non terminées, 0 nul) et `controler` (0 sans résultat). Aligner le script sur le serveur, ou renommer sa ligne.
8. **Le moteur ignore trois mécaniques promises par les documents** : les **cartes de terrain** (`doc/04` §7.5), les **co-commandants** (passif seul + barre de jauge, y compris le commandant d'origine du joueur pendant un **match d'incarnation**, et la jauge entière d'un général à confiance 3) et les **spécialités**. Elles existent dans `src/schemas/` — types et validateurs —, pas dans `src/engine/`. De l'incarnation, le moteur ne tient aujourd'hui qu'une chose, et c'est la bonne : le camp du joueur prend le général incarné, et le catalogue joué est celui que l'appelant lui passe.
9. **Les 24 unités spéciales n'ont aucune spécification.** Ce sont des modèles uniques, pas des kits ; il faut d'abord qu'elles entrent au catalogue d'unités (`doc/11` §10.3).
10. **Le validateur glTF ne vérifie pas les textures livrées** : il voit qu'une carte obligatoire est présente, pas sa résolution ni le caractère binaire du masque d'équipe (`doc/11` §10.4).
11. **Les assets de type `effet`** (impacts, poussière, halo de pouvoir) existent comme type, sans aucune spécification produite.
12. **Le générateur de cartes n'est pas branché sur le serveur** : `src/serveur/generation.ts` et la partie catalogue de `src/serveur/simulation.ts` lèvent une erreur « pas encore branché ».
13. **L'accueil ne mène pas encore au monde.** L'écran-titre est fait (ci-dessus), mais il n'y a toujours ni choix du pays, ni carte du monde — le carnet, lui, existe. Et « Atelier des mondes » promet un éditeur alors que c'est un **visualiseur** de biomes, saisons et météo : sa sous-ligne le dit, le nom continue de mentir.

## Les prochaines actions, dans l'ordre

1. **Brancher la base Coolify.** `cp .env.example .env`, y mettre la vraie `DATABASE_URL` — elle n'est **jamais** commitée, `.env` est dans `.gitignore` —, plus `ADMIN_PASSWORD`, `AUTH_SECRET` (`openssl rand -hex 32`), `CRON_SECRET` et `SITE_URL`.
2. **Premier `npm run migrate`**, puis un second immédiatement : la migration doit être rejouable sans rien faire. Vérifier `/api/health` en `200`, et que `tests/serveur/migrations.test.ts` cesse d'être sauté.
3. **Créer les tâches planifiées Claude** avec les prompts bootstrap prêts à coller : `doc/05-routines.md` §2.6 (contrôle), §3.6 (map), §4.6 (lore), §5.9 (cerveau), et `doc/09-i18n.md` §8.7 (traduction). Le récapitulatif des sept tâches et de leurs crons UTC est en `doc/05` §7.1. Commencer par `atlas_map` et `atlas_controle` seuls, une semaine, et regarder le taux de rejet par motif avant d'ouvrir les autres.
4. **Semer les 24 pays en base** depuis `content/pays/*.json`, avec les 18 régions et les styles. Il n'existe aucun script pour cela : c'est un `scripts/semer.ts` à écrire, qui valide chaque fiche par `src/schemas/valider.ts` avant l'insertion, et qui est **rejouable**.
5. **Ouvrir `en`** : écrire `content/i18n/glossaire.en.json` (sans lui, le serveur ne sert aucun lot), lancer `npm run extraire-chaines` avec la base, laisser `atlas_traduction` remplir la file, relire l'échantillon humain.
6. **Câbler la mise en ligne de 18 h** (manque n° 3) et faire le test qui fait rater une échéance : le vide vaut mieux qu'une erreur.
7. **Passer le rendu 3D sur de vraies textures.** Envoyer au générateur externe les **premières specs par priorité 1** — les 165 qui suffisent à jouer la qualification française : terrains d'abord (ils couvrent l'écran), puis bâtiments, puis décor, puis unités, puis bustes. Un asset refusé ne remplace **jamais** son placeholder. Après chaque famille livrée, une passe de performance contre le budget de `doc/10` §9.2.
8. **Ensuite seulement**, les mécaniques régionales françaises (étape 7), qui sont le premier gros morceau de code moteur restant.

## Le déploiement

Coolify, image construite depuis le `Dockerfile` à la racine (Node 22 Alpine, trois étages, `postgresql18-client` installé pour le `pg_dump` d'avant migration — un client de majeure inférieure au serveur refuserait de tourner, et `migrate.mjs` le signale sans bloquer).

- `npm start` = `node scripts/migrate.mjs && next start -p ${PORT:-3000}`. Les migrations passent **avant** que Next n'écoute.
- `HEALTHCHECK` sur `/api/health` : `200` quand la base répond, `503` sinon (`non_configuree` ou `muette`). Aucune requête n'est faite à l'import d'un module — c'est ce qui garantit que `next build` n'a besoin d'aucune variable d'environnement.
- `/api/health/routines` est la sonde « homme mort » : `500` dès qu'une routine dépasse trois fois sa cadence nominale. Une routine qui n'a jamais tourné n'est pas en panne. À brancher sur la supervision externe.
- Variables à poser dans Coolify : `DATABASE_URL`, `ADMIN_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`, `SITE_URL`, et si l'on veut s'écarter des valeurs par défaut `DEPECHE_TZ` (`Europe/Paris`), `DEPECHE_HEURE` (`18:00`), `BACKUP_DIR` (`.backups`, à monter sur un volume en production, sinon la copie de sécurité meurt avec le conteneur).
- Le conteneur embarque `content/` et `drizzle/`, lus au démarrage. Une modification du canon est donc un déploiement, pas une écriture en base.
