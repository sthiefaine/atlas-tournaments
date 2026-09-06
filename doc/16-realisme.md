# Atlas Tournament — Le plan vers des modèles réalistes

*Plan de travail, écrit le 6 septembre 2026 après l'arbitrage de direction artistique du même jour. Propriétaire du **plan de réalisme** ; le rendu reste à `10-rendu-3d.md`, les assets à `11-assets-spec.md`, et le brief a raison sur tout.*

## 0. La décision qui commande tout

**Plutôt réaliste, mais un ton léger et cartoon** (Thief, 6 septembre 2026). Concrètement, surface par surface :

- **Les matières sont vraies.** Tôle peinte qui accroche la lumière, tissu mat, caoutchouc poussiéreux, verre qui reflète le ciel. C'est du PBR avec un environnement à réfléchir, pas de l'aplat.
- **Les formes restent simples et lisibles.** Volumes ramassés, silhouettes reconnaissables à trente pixels, proportions de figurine (cinq têtes et demie, pas huit). Un char ne montre pas ses boulons, il montre qu'il est en acier.
- **Les couleurs restent franches.** Les palettes nationales saturées, le vert et le rouge du jeu, les visages visibles. Le réalisme est dans la lumière et la matière, jamais dans la grisaille.
- **Aucun réalisme de la violence.** Rien ne change à `01-bible.md` §5 ni à `10-rendu-3d.md` §2 : hors jeu, pas mort ; affaissement, pas explosion.

La référence est une **maquette de diorama photographiée en studio** : chaque pièce a l'air d'être en quelque chose, et l'ensemble a l'air d'un jouet bien fait. Ce document dit comment y arriver en trois lots, du moins cher au plus décisif.

## 1. D'où l'on part

Ce qui est vrai le 6 septembre 2026, et qui fixe le point de départ :

| Ce qui existe | Ce qui manque |
|---|---|
| Un rendu three.js (`r170`) en PBR metallic-roughness, ACES, ombres PCF douces 1024², soleil et lune par saison et phase, particules de météo | **Aucune carte d'environnement** : `scene.environment` est vide, les métaux et les verres ne réfléchissent rien. Aucun post-traitement : pas d'occlusion ambiante, pas de vignettage |
| 540 spécifications `AssetSpec` valides dans `assets/specs/`, dont 165 de priorité 1 ; un lecteur et un validateur de GLB sans dépendance (`src/assets/valider-gltf.ts`) ; un chargeur qui essaie `kit_<pays>_<unite>.glb` puis `unite_<cle>_base.glb` et retombe sur le placeholder | **Aucun `.glb` n'a jamais été produit**, `public/assets/modeles/` n'existe pas, et la boucle de `11-assets-spec.md` §2 n'a jamais été parcourue. Pas de commande en ligne pour valider un fichier livré |
| Des placeholders composés depuis la `Silhouette`, désormais avec figurines à visage pour les unités à pied, la vitrine `/atelier/unites` pour les juger sous six angles | Le chargeur **pose le modèle tel quel** : ni rotation (la spec impose l'avant en `+Z`, le placeholder regarde `+X`), ni gabarit `a/b/c`, ni socle à liseré, ni niveaux de détail. Aucun `AnimationMixer` : les clips livrés ne seraient pas joués |

Trois faits de départ à garder en tête. Le budget par carte (`10-rendu-3d.md` §9.2) est **≈ 210 000 triangles et 27 draw calls** ; tout ce qui suit doit y tenir. Le seuil de lisibilité est **48 px par case** ; à cette taille, le réalisme se lit dans la lumière et les textures, pas dans les polygones. Et le remplacement d'un placeholder est **un changement de fichier**, jamais un `if` : on ne code rien « pour l'infanterie ».

## 2. Lot A — Le moteur : la même scène, mieux éclairée

**But** : que tout ce qui est déjà à l'écran — terrain, décor, bâtiments, placeholders — ait l'air d'être en quelque chose, avant qu'un seul modèle n'arrive. **Ordre de grandeur : deux à trois jours**, mesure comprise.

| # | Quoi | Où | Fait quand |
|---|---|---|---|
| A1 | **Une carte d'environnement.** Un `PMREMGenerator` sur `RoomEnvironment` au montage, posée dans `scene.environment` avec une intensité modulée par l'ambiance (plus faible la nuit, plus froide l'hiver) ; plus tard, une HDRI de studio par phase du jour si la pièce le vaut. C'est le levier au meilleur rapport : il change tous les matériaux d'un coup. | `render3d/scene.ts`, `eclairage.ts` (`ParametresAmbiance` gagne `environnement: { intensite, teinte }`) | Un char léger sur la vitrine montre un reflet sur sa tôle et son verre ; le banc de nuit reste lisible |
| A2 | **Des ombres plus fines.** 2048² sur ordinateur, 1024² sur mobile, `radius` pour adoucir les bords, `normalBias` réglé pour que les figurines ne « flottent » plus au-dessus de leur ombre ; la caméra d'ombre resserrée sur le champ visible plutôt que sur la carte entière. | `eclairage.ts` | Une figurine posée sur un socle porte une ombre de contact nette sous les bottes |
| A3 | **Occlusion ambiante d'écran.** Un `EffectComposer` — `RenderPass`, `GTAOPass`, `OutputPass` — activé seulement au-dessus d'un seuil de performance mesuré, désactivé par le réglage « animations réduites » et **jamais** dans le test de fumée SwiftShader. Le rendu à la demande de la boucle paresseuse est conservé : le composeur ne redessine que quand la scène est sale. | `scene.ts` (le composeur remplace `renderer.render`), `render/boucle.ts` inchangé, `app/reglages` (un réglage « qualité »), `capturer()` doit lire le composeur | Les jonctions bâtiment-sol et les creux entre figurines s'assombrissent ; `e2e/fumee-3d.spec.ts` passe toujours |
| A4 | **Un vignettage léger et un grain.** Un `ShaderPass` final : vignette à 12 %, grain à 2 %, une pointe de saturation. C'est ce qui fait « photo de maquette » plutôt que « fenêtre d'éditeur ». | même composeur | Comparaison avant/après sur les trois photos du banc, à l'œil |
| A5 | **Les matières des placeholders.** Rugosité et métal par rôle revus avec l'environnement en place (le `principal` trop émissif aujourd'hui, le `verre` trop opaque), et un micro-relief synthétisé pour le terrain comme `textures.ts` le fait déjà, étendu aux toits. | `render3d/unites.ts` (`Materiaux`), `textures.ts` | Le banc, ambiance « clair, été, jour » : une capture d'écran de référence remplace `doc/assets/render-3d.png` |
| A6 | **La mesure.** Un relevé triangles, draw calls et millisecondes par image sur la carte 24 × 16 du banc, ordinateur et téléphone, avec et sans A3, consigné ici. | `atelier` (le panneau de performance existe) | La table du §9.2 du doc 10 est remplie avec des chiffres réels au lieu d'ordres de grandeur |

**Ce que le lot A ne fait pas** : il ne rend pas un placeholder beau. Il rend la lumière juste, pour que les vrais modèles du lot B arrivent dans une scène qui leur fait honneur, et pour que le terrain, qui couvre l'écran, cesse d'être plat.

**État au 6 septembre 2026 (soir)** — A1 à A4 sont **faits** ; le détail est dans `10-rendu-3d.md` §6.5 et §9.3.

- **A1, fait.** `RoomEnvironment` préfiltrée une fois au montage (`render3d/environnement.ts`), `environnement: { intensite, teinte }` dans les 48 ambiances, interpolé, l'intensité appliquée par `scene.environmentIntensity` ; la vitrine reçoit la même pièce. *Reste* : la teinte est calculée mais pas appliquée — r170 n'a pas de prise pour teinter une carte préfiltrée sans la recuire — et l'intensité (un tiers de jour) est un ordre de grandeur raisonné, pas jugé à l'œil ; la HDRI par phase du jour n'est pas commencée.
- **A2, fait.** 2048² à la souris, 1024² au doigt, caméra d'ombre resserrée sur le champ visible par une fonction pure (`render3d/ombres.ts`) vérifiée contre la vraie caméra d'ombre de three, biais en multiples du texel. *Reste* : le type d'ombre est resté `PCFSoftShadowMap`, qui ignore `radius` — les bords sont adoucis par son noyau sur un texel devenu dix à cent fois plus fin, pas par un rayon ; le critère de fin (l'ombre de contact sous les bottes) n'a pas été regardé.
- **A3, fait.** `EffectComposer` (`RenderPass` → `GTAOPass` → `OutputPass` → grain) dans `scene.ts`, chargé par `import()` à l'activation, boucle paresseuse conservée, `capturer()` lit l'image composée, réglage « Qualité d'affichage » à trois choix dans `/reglages`, `auto` mesuré sur les dix premières images (seuil 8 ms, GPU compris), jamais sous le rasteriseur logiciel. *Reste* : le seuil et les paramètres de l'occlusion (rayon 0,35 case, résolution logique) sont raisonnés, pas mesurés ; la fumée Playwright doit être relancée après fusion.
- **A4, fait.** Vignette 12 %, grain 2 % par hachage du pixel et du compteur d'images, saturation +8 %, en espace d'affichage après l'`OutputPass`, mêmes conditions d'activation qu'A3. *Reste* : la comparaison avant/après sur les trois photos du banc, à l'œil, n'a pas été faite.
- **A5, fait.** Les sept rôles de `Materiaux` sont des matières réglées avec le studio — tôle peinte à émission presque nulle, acier franc, verre translucide qui n'ombre pas, caoutchouc, peau mate —, la pluie les mouille par jeu de matériaux, et les toits reçoivent un micro-relief synthétisé (tuile, ardoise ou tôle ondulée d'après le style régional, `jeuToit`), cartographié à l'échelle du monde ; le détail est dans `10-rendu-3d.md` §5 et §7.4. *Reste* : les valeurs sont raisonnées et bornées par des tests, pas jugées à l'œil, et la capture de référence du banc qui remplacerait `doc/assets/render-3d.png` reste à faire par la campagne de mesure d'A6.
- **La mesure d'A6** est en place : `Rendu.mesurer()`, `window.__atlas.mesurer()`, `window.__atlasBanc.mesurer()` et `qualite(v)`, et la section « Rendu » du banc. A6 reste à faire : les chiffres de la table, et la capture de référence. Premiers chiffres, sous SwiftShader à 1280 × 800 sur la carte de démonstration : médiane de calibration de 811 ms avec l'environnement contre 524 ms sans, 808 ms avec des ombres 1024² — les ombres ne coûtent rien, l'environnement 35 % d'une image logicielle —, un tour d'IA de 22 s dans les deux versions, 1 000 ms l'image contre 909 avant le lot A ; l'environnement reste, sans palier supplémentaire.

## 3. Lot B — Les vrais modèles : parcourir la boucle qui n'a jamais tourné

**But** : remplacer les placeholders par des modèles texturés, un fichier à la fois, dans l'ordre de priorité déjà écrit. **C'est le lot qui change le jeu**, et il a un préalable de code d'une journée avant la première livraison.

### 3.1 B0 — Rendre le chargeur digne d'un vrai modèle (une journée)

Aujourd'hui, un `.glb` posé dans `public/assets/modeles/` s'afficherait, mais mal. Cinq choses à régler **avant** de commander quoi que ce soit, chacune vérifiable sur la vitrine avec un GLB de test (un cube nommé suffit) :

1. **Orientation.** La spec impose l'avant en `+Z` (`11-assets-spec.md` §4.2), le placeholder regarde `+X`. Trancher : le chargeur tourne le modèle de `+π/2` autour de `Y` à l'arrivée, et la spec reste ce qu'elle est. Un test le vérifie avec un GLB minimal. *(Le plan écrivait « −π/2 » ; le test du 6 septembre 2026 a tranché : dans la convention de three, c'est +π/2 qui envoie `+Z` sur `+X`, −π/2 l'enverrait sur `−X`.)*
2. **Échelle et gabarit.** Une case vaut un mètre dans la spec et une unité de scène dans le rendu, donc l'échelle est directe ; mais le gabarit `a/b/c` (`PROPORTIONS` dans `unites.ts`) doit s'appliquer au modèle comme au placeholder.
3. **Socle et liseré d'équipe.** Le modèle livre un nœud `socle` ; le liseré de camp reste dessiné par le rendu (`piecesSocle`) sous le modèle, et le `masque_equipe` du modèle prend la palette de la nation via `teinterModele`, qui ne sait aujourd'hui teinter que des matériaux nommés `equipe*`. À aligner sur la règle du §5.2 : masque plein sur une base, liseré seul sur un kit.
4. **Niveaux de détail.** `THREE.LOD` avec `_lod0`, `_lod1`, `_lod2` aux distances des paliers de zoom ; le chargeur les demande dans l'ordre et se contente de ce qui existe.
5. **La commande de contrôle.** `scripts/controler-asset.ts --spec assets/specs/<id>.json --glb <fichier> [--fichiers <dossier>]` qui appelle `validerGlb` et imprime le verdict `{ ok, motifs }` — le même que la routine contrôle. C'est ce qu'on renvoie au générateur, tel quel.

Et sur la vitrine : un badge « modèle livré / placeholder », le choix du LOD, et un lecteur de clips (repos, déplacement, tir…) pour le lot C.

**Fait le 6 septembre 2026, point par point** (`render3d/modeles.ts`, testé sous Node avec des groupes construits en mémoire et un GLB fabriqué par `tests/assets/glb.ts` ; `10-rendu-3d.md` §7.1, §7.3, §7.5 portent le détail).

1. **Orientation** : `conformerModele` tourne le modèle de **+π/2** autour de Y — le plan écrivait −π/2 ; c'est le signe que three impose pour envoyer `+Z` sur `+X`, vérifié par un test sur un point —, et la spécification reste ce qu'elle est.
2. **Échelle et gabarit** : aucune échelle de taille sur un modèle livré ; `PROPORTIONS` a quitté `unites.ts` pour `modeles.ts` et s'applique au modèle comme au placeholder, sur l'enveloppe `figurine_modele`, **dans le repère du rendu** ; la rotation va sur un groupe intérieur (`orientation`). Relecture du soir : sur un même nœud, three compose T·R·S et l'échelle s'appliquait dans le repère du fichier — la longueur du gabarit tombait sur la largeur du modèle ; un test sur l'emprise monde le tient désormais.
3. **Socle et liseré** : `monterModele` pose sous le modèle le même `piecesSocle` que sous le placeholder, base comme kit ; `teinterModele(objet, camp, { style, kit })` colore `mat_corps` et `mat_details` d'une base avec la palette de la nation (ou du camp), ne touche à rien du corps d'un kit — seuls ses matériaux `equipe*` prennent la couleur du camp —, et mélange dans le shader (`onBeforeCompile`) quand le matériau porte l'image `masque_equipe` du fichier.
4. **Niveaux de détail** : le chargeur demande `_lod0`, `_lod1`, `_lod2` et se contente de ce qui existe (le lod0 obligatoire, arrêt au premier absent) ; `THREE.LOD` aux seuils déduits des paliers de zoom (`SEUILS_LOD`, à mi-chemin entre deux paliers) ; un seul niveau est posé sans seuil ; la vitrine sait forcer un niveau.
5. **La commande de contrôle** : `scripts/controler-asset.ts` (`npm run controler:asset -- --spec … --glb … [--lod n] [--fichiers dossier] [--json]`), testée contre un GLB fabriqué en mémoire et la vraie spécification du char léger, code de sortie 1 sur refus ou fichier illisible, et un avertissement — pas un refus — quand le nom du fichier n'est pas celui du gabarit.
6. **L'inventaire** (le soir) : le chargeur ne sonde plus chaque candidat en 404 — il lit une fois par page `GET /api/modeles`, l'inventaire des fichiers de `public/assets/modeles/` dressé d'après leurs noms (`src/serveur/modeles.ts`), et ne demande que ce qui existe ; sans route, il sonde comme avant. Le remplacement reste un changement de fichier.

La vitrine porte le badge « Modèle livré / Placeholder », le choix du niveau et le lecteur de clips, et `window.__atlasVitrine.modele()` les expose au pilotage. **Rien de tout cela n'a vu un vrai fichier** : aucun `.glb` n'existe, et c'est le pilote B1 qui le fera.

### 3.2 B1 — Un pilote de bout en bout, une seule unité

Une seule pièce traverse toute la boucle avant qu'on en commande cent : **le char léger**, parce qu'il est rigide (pas de squelette), d'encombrement 1, et que sa spec est la plus simple. Étapes :

1. `npx tsx scripts/generer-specs-assets.ts --priorite 1 --sortie /tmp/lot1` ; on prend `unite_char_leger_base.json`.
2. **Production.** Trois voies, à essayer dans cet ordre et à consigner ici :
   - *un générateur image-vers-3D* (le brief nomme ChatGPT 6 Astra ; Meshy, Tripo, Hunyuan3D et Rodin sont les autres candidats) nourri de la `description.en` de la spec et d'une image de référence rendue depuis la vitrine ;
   - *un modeleur humain* sous Blender, à qui la spec se lit comme un cahier des charges ;
   - *un hybride* : le générateur pour la forme, Blender pour tout ce qu'un générateur ne fait pas.
3. **Conformation.** Ce qu'aucun générateur ne livre spontanément et qu'il faudra faire dans un passage Blender ou `gltf-transform` **[proposition : ajouter `@gltf-transform/cli` en dépendance de développement]** : renommer les nœuds (`racine`, `corps`, `base`, `socle`, `module_tourelle`), nommer les matériaux (`mat_corps`, `mat_details`), décimer en trois LOD aux budgets du §4.3, peindre le `masque_equipe`, poser le pivot au sol et l'avant en `+Z`.
4. **Contrôle** par `controler-asset.ts` jusqu'à `{ ok: true }` ; chaque motif de refus est une consigne pour l'itération suivante.
5. **Recette humaine** sur la vitrine (six vues) puis sur le banc (à 68°, dans les trois ambiances), selon `11-assets-spec.md` §7.3 : beauté, ressemblance, ton, interdits.
6. Dépôt dans `public/assets/modeles/unite_char_leger_base_lod0.glb` (et `_lod1`, `_lod2`), commit, et le placeholder disparaît **sans une ligne de code**.

**Fini quand** : le char léger livré passe le contrôle, la recette, et tourne sur le banc à côté des placeholders sans jurer avec eux. Le temps réel de ce pilote, mesuré, donne le coût de tout le reste ; c'est la seule estimation qui vaudra quelque chose.

### 3.3 B2 — Le lot de priorité 1, famille par famille

Les 165 spécifications de priorité 1 suffisent à jouer la qualification française. Ordre de commande, imposé par ce qui couvre l'écran :

| Ordre | Famille | Combien | Pourquoi d'abord | Passe de performance |
|---|---|---:|---|---|
| 1 | Terrains | 8 | Ils couvrent l'écran ; leurs textures remplacent le bruit fractal synthétisé | splat map à quatre canaux, budget §9.2 |
| 2 | Bâtiments France et voisins | 80 | Ce qu'on capture, donc ce qu'on regarde | instanciation par région |
| 3 | Décor (arbres, rochers) | 27 | Le fond de chaque case | `InstancedMesh`, trois LOD exigés |
| 4 | Géométries de base des unités | 10 | Le pilote B1 en a fait une ; les neuf autres suivent, dont **l'infanterie, le Méca et le génie avec squelette** (lot C) | 30 unités, ≤ 60 000 triangles |
| 5 | Kits nationaux France, Luxembourg, Suisse | 30 | Le style par nation devient visible : trois nations, trois écoles | textures en `ktx2` si le poids l'exige (`11` §10.1) |
| 6 | Bustes de commandants | 3 | Les dialogues sur la carte | un seul LOD, jamais vu de loin |

Après chaque famille : une passe de performance contre le budget, et une capture de référence du banc dans `doc/assets/`. **Un asset refusé ne remplace jamais son placeholder** ; un asset accepté est commité avec sa spec inchangée.

### 3.4 B3 — Les kits nationaux

Un kit est un jeu de textures **monté sur la géométrie de base** (`11` §5.2 bis), pas un nouveau modèle. La chaîne : la spec `kit_<pays>_<unite>` porte la ligne directrice, la palette, les matières et les ornements de `content/styles/<code>.json` ; le générateur repeint la base et ajoute les nœuds `ornement_<nom>` ; le validateur exige les cartes obligatoires sous leur nom de gabarit. Le liseré de socle reste la seule couleur d'équipe. La vitrine, qui prend une nation en paramètre, est l'endroit où l'on compare les trois écoles côte à côte.

## 4. Lot C — L'animation squelettique

**But** : que les figurines marchent, tirent et s'affaissent, avec les six clips aux noms imposés (`repos`, `deplacement`, `tir`, `touche`, `hors_jeu`, `capture`, `11` §5.4). Il vient **avec** les modèles à pied du lot B et ne se commande pas à part.

1. **Un `AnimationMixer` par unité chargée** dans `render3d/unites.ts`, avancé par la boucle existante (`avancer`), qui n'anime aujourd'hui que les rotors et la respiration des placeholders.
2. **Le mariage avec les événements** dans `render3d/animations.ts` : `deplacement` en boucle pendant que l'unité glisse sur son chemin ; `tir` à l'attaque, `touche` à la riposte, `hors_jeu` à la mise hors jeu, `capture` pendant les deux temps d'une capture ; `repos` en boucle le reste du temps, avec un fondu de 150 ms entre deux clips. Un clip absent retombe sur `repos`, sans erreur : le validateur l'a déjà signalé à la livraison.
3. **La règle d'or tient** : l'état logique est en avance, l'animation rattrape ; un clic pendant un clip coupe le clip.
4. **Le coût** : un `SkinnedMesh` ne s'instancie pas. Trente unités à pied, c'est trente draw calls de plus, ce qui reste dans le budget de 27 par carte **seulement si** les autres familles sont instanciées (B2). À mesurer en A6, et à trancher : squelette pour tous, ou animation par transformation de nœuds (roues, tourelles, rotors) pour les véhicules et squelette pour les seules figurines. La seconde voie est la proposition.
5. **La production des clips** : un générateur ne les fournit pas. C'est un passage Blender avec un rig d'humanoïde simple et six actions exportées dans le GLB ; les figurines partagent le même squelette, donc les six clips se font **une fois** et se réappliquent aux trois modèles à pied.

**État au 6 septembre 2026.** Les points 1 à 3 sont **faits**, côté code : `creerLecteurClips` (`render3d/modeles.ts`) tient un `AnimationMixer` par unité chargée, avancé par `avancer()` du calque ; `animations.ts` pose le clip logique de chaque geste dans `EtatVisuel.clip` — `deplacement`, `tir`, `touche` (riposte comprise, après le tir), `hors_jeu`, `capture` sur les deux temps et sur une remise en service —, le calque fond d'un clip à l'autre en 150 ms, un clip absent retombe sur `repos` sans erreur, et la règle d'or tient : `terminer` remet `repos`, un clic qui coupe un geste laisse l'état juste. Les clips qui ne bouclent pas sont ajustés à la durée du geste (`10` §7.3). Le point 4 est **tranché** : un seul mécanisme, le mixer joue aussi bien un squelette qu'une transformation de nœuds nommés — une tourelle, un rotor, une roue sont des pistes comme les autres — ; le coût des `SkinnedMesh` se mesure en A6. Le point 5 reste entier : aucun clip n'existe, et ce code n'a joué que ceux des tests.

## 5. Ordre, jalons et critères de fin

| Jalon | Contenu | Critère de fin |
|---|---|---|
| **J1** | Lot A entier | Capture de référence du banc dans les trois ambiances ; chiffres réels dans la table du §9.2 ; fumée Playwright verte |
| **J2** | B0 + B1 | Le char léger livré, contrôlé, recetté, commité ; le temps du pilote consigné ici |
| **J3** | B2 familles 1 à 3 | Terrains, bâtiments et décor de priorité 1 en place ; passe de performance après chaque famille |
| **J4** | B2 famille 4 + lot C | Les dix bases, dont les trois à pied animées ; l'infanterie marche sur le banc |
| **J5** | B2 familles 5 et 6 | Trois kits nationaux comparables sur la vitrine ; trois bustes ; la qualification française se joue sans un placeholder |

**Ce qui ne change pas, quel que soit le jalon** : aucune unité connue par son nom ; le remplacement est un fichier ; un refus ne remplace rien ; le budget de `10` §9.2 est la borne ; les interdits de `01-bible.md` §5 sont recopiés dans chaque spec et relus à chaque recette.

## 6. Risques, nommés

1. **Les générateurs image-vers-3D ne respectent ni les noms de nœuds, ni le masque, ni les LOD.** C'est prévu : l'étape de conformation (B1.3) existe pour ça, et c'est elle qui coûtera du temps humain. Si elle coûte plus que le modelage lui-même, on passe au modeleur pour les unités et on garde le générateur pour le décor.
2. **Le photoréalisme mange la lisibilité.** Une texture trop détaillée à 48 px par case devient du bruit. La recette se fait **au zoom par défaut**, pas en gros plan ; la vitrine sert à juger la pièce, le banc à juger le jeu.
3. **Le post-traitement sur mobile.** L'occlusion ambiante peut coûter plus qu'elle ne rapporte sur un téléphone ; d'où le seuil mesuré et le réglage de qualité en A3, jamais un réglage inerte.
4. **Le ton.** Un générateur nourri du mot « réaliste » produit volontiers du militaire boueux. La `description.en` de chaque spec dit « tournament athletes », « marker launcher », « unlettered team-colour zones » ; on ne réécrit pas ces descriptions pour flatter un générateur, on change de générateur.
5. **La dérive du canon.** `npx tsx scripts/generer-specs-assets.ts --verifier` en intégration continue reste la garde : une spec livrée puis modifiée par le canon doit être recommandée, pas rafistolée.
