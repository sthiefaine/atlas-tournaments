# Sources HD, LOD0 de jeu et mesure sur téléphone

Décision du propriétaire du 14 septembre 2026 : conserver Three.js + WebGPU, garder les sources ultra détaillées, livrer un seul LOD0 optimisé, puis régler les budgets avec des mesures sur téléphone. Le repli WebGL 2 existant reste disponible. Aucune migration de moteur ni LOD supplémentaire.

## Livraison

Quatre modèles actifs approchaient le million de triangles. Ils sont remplacés directement après contrôle technique. Les autres modèles actifs sont déjà légers et restent en place.

- Infanterie : 951 858 → 50 682 triangles ; lot 42,87 → 11,36 Mio.
- Char léger : 957 212 → 55 720 triangles ; lot 36,57 → 9,83 Mio.
- Barge : 934 594 → 41 176 triangles ; lot 37,25 → 4,87 Mio.
- QG : 873 843 → 35 009 triangles ; lot 30,03 → 7,37 Mio.

Les quatre lots passent de **146,72 à 33,42 Mio**, soit **77,2 % de moins**, hors ZIP et rapports. La géométrie passe de 3 717 507 à 182 587 triangles, soit 95,1 % de moins. Ce sont des mesures de fichiers, **pas un gain FPS mesuré**. Les anciens objets adressés par SHA ne sont pas effacés : cette passe réduit les téléchargements des nouveaux clients, pas l’historique Git.

`assets/production/optimisation-lod0.json` porte les valeurs et révisions exactes. Chaque lot contient `maitre.json`, `optimisation.json`, `textures-optimisation.json`, `validation-lot.json` et un ZIP local ignoré par Git. Les alias de livraison, de candidat et de jeu pointent vers les mêmes données immuables, sans PNG embarqué dans les GLB. Les textures hivernales de l’ancien char procédural sont retirées : elles ne correspondent pas aux UV importés. Aucun kit national ou régional n’est produit.

Les maîtres préparés sont copiés sous `assets/sources/<id>/maitre-<sha>/`, ignorés par Git et Docker. `maitre.json` permet de les retrouver depuis les anciennes données immuables ; pour la barge, depuis le commit `7ac3ff3` et le chemin original. Exemple de récupération : `git show 7ac3ff3:public/assets/modeles/unite_barge_base_lod0.glb > /chemin/prive/unite_barge_base_lod0.glb`, puis vérifier son SHA. La source Tripo brute privée et les rapports de préparation précédents sont conservés. Ne pas confondre le SHA de l’upload brut et celui du maître déjà orienté/animé.

## Préparation reproductible

1. Archiver le GLB HD préparé et tous ses PNG ; vérifier chaque SHA avant et après conversion. Ne jamais repartir du précédent modèle réduit.
2. Exécuter `node --import tsx scripts/production/optimiser-lod0.ts <id> <dossier-maitre> <dossier-preparation>`.
3. Exécuter `python scripts/production/textures-lod0.py <id> <dossier-maitre> <dossier-preparation>`, avec Pillow et NumPy dans un environnement Python privé.
4. Ajouter `maitre.json` au dossier de préparation ; contrôler par `npm run controler:asset -- --spec assets/specs/<id>.json --lot <dossier-preparation>`.
5. Exécuter `node --import tsx scripts/production/integrer-lod0-optimise.ts <id> <dossier-preparation>` pour remplacer les quatre bases prises en charge. Il revérifie les maîtres, le modèle actif, le contrôle et l’intégrité des octets avant exposition.

Le réducteur Meshopt QEM verrouille les frontières. Les tronçons de primitives partageant matériaux et attributs sont réunis avant réduction ; les sommets inutilisés sont éliminés avant simplification pour ne pas bloquer artificiellement la grue. Les positions, UV et normales des sommets retenus restent exacts. Nœuds, matériaux, attaches et animations sont conservés ; aucun skin/morph n’est converti par ce script. Un budget impossible à atteindre avec la tolérance choisie provoque un refus, pas une hausse silencieuse de l’erreur. Le codec Meshopt de diffusion reste sans quantification, et le retour décodé est comparé au binaire optimisé avant livraison.

Les cartes de normales existantes conservent le détail de matière. **Aucun nouveau bake de la géométrie HD n’a été effectué.** La perte de microgéométrie n’est donc pas intégralement transférée dans une nouvelle normale. L’erreur QEM est une estimation, pas une borne de Hausdorff ni une preuve de fidélité artistique. La simplification, même avec coutures verrouillées, doit être jugée sur l’apparence par le propriétaire ; aucun contrôle visuel automatique n’est revendiqué et il ne conditionne pas le remplacement demandé.

Les textures passent de 4K à 2K : albedo filtré en lumière linéaire, normales filtrées puis renormalisées en convention glTF +Y, rugosité et métal conservés en données linéaires. Les masques binaires 512² restent identiques. Aucun éclairage ni ombre ajouté. Le plafonnement tactile existant à 1K avant upload GPU reste actif ; il ne crée pas un autre LOD.

Le catalogue et les prompts administrateur portent la nouvelle règle. Les budgets 55k/60k/50k/40k sont une première enveloppe et non une certification mobile. Anti-air et artillerie reçoivent une enveloppe de 60k/2K pour leurs prochaines préparations ; leurs modèles actifs légers ne sont pas remplacés par leurs candidats HD. La régénération des spécifications resynchronise également le libellé national des bâtiments déjà présent dans le générateur.

## Relevé réel sur téléphone

Ouvrir `/jeu/premier_contact?mesure=1` sur le téléphone, ou **Réglages → Affichage → Mesure des performances**. Le panneau est absent hors de cette option. Cliquer **Mesurer 60 s** une fois la carte prête ; tourner la carte, déplacer une unité et lancer un combat. Le bandeau se replie pendant la mesure. Télécharger ou copier le rapport, qui reste sur l’appareil et n’est envoyé à aucun serveur.

Le relevé distingue repos, action et combat ; il rapporte le nombre d’images, le temps observé, la cadence moyenne, les intervalles médians/P95, les pauses >50/100 ms, le coût CPU P95/max et les appels de dessin. Il inclut le backend réel, le navigateur, la taille réelle du canvas, le commit de build et les transferts GLB/PNG de la page. Les tâches longues sont présentes seulement si le navigateur expose cette API. Les onglets cachés sont exclus et rompent les intervalles ; arrêter ou quitter démonte les observateurs. Aucun second renderer, chargement de modèle ou collecte permanente.

La cadence est celle des dessins soumis par le navigateur ; le coût CPU inclut la première capture du duel. **Aucun temps GPU direct n’est mesuré.** Au repos le tactile dessine volontairement environ dix images/s, l’action vise trente ; le repos ne doit pas déclencher une baisse de budget. Un mode n’ayant aucune image dans le rapport n’a pas été mesuré. Les compteurs de triangles `renderer.info` du repli WebGL ont une limite connue ; le détail par famille décrit la scène entière, hors caméra compris. Les transferts en cache peuvent être nuls et la liste des ressources peut être tronquée par le navigateur.

Pour régler ensuite : comparer au moins deux passages sur le même téléphone, même orientation, même carte et même réglage, en séparant premier chargement et cache chaud. Chercher une cadence active proche de 30 et un P95 proche de 33–40 ms ; les captures initiales lentes restent visibles dans le maximum CPU. Si le CPU est élevé et les appels nombreux, traiter les matériaux/instances. Si le coût augmente avec les pixels ou les textures, réduire résolution/effets. Si la géométrie domine, baisser le budget du modèle concerné et repartir du maître. Ne pas décider sur une moyenne globale mélangeant repos et combat.

## Vérification et limite restante

Quatre contrôles de lot `ok`, décompression Meshopt comparée octet par octet, typage et build de production. Aucune suite de tests, capture ni approbation artistique automatique. **Aucun téléphone n’était connecté lors de cette livraison ; le relevé réel et l’ajustement final du budget sont encore à faire.** Le registre indique explicitement `en_attente_appareil_reel`.
