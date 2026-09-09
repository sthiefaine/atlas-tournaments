# Validation des huit scénarios Aube en mode difficile

Contrôle du 9 septembre 2026. Les scénarios sont lus dans `content/scenarios`, transformés par `scenarioPourMode(scenario, 'difficile')`, puis passent `validerScenario`. Leurs cartes passent `validerMapDef`. Chaque partie est créée avec son catalogue réel et ses commandants, puis jouée par `jouerTour` : ce contrôle ne se contente pas de terminer les tours sans ordres.

Aucun scénario, budget ou réglage de difficulté n’a été modifié pendant cette vérification. Les conséquences narratives d’un profil et les conditions d’accès dans le navigateur ne sont pas appliquées : il s’agit du mode difficile de base.

## Trois premières journées

Graine commune : `aube:difficile:controle:1`. IA pondérée à tous les camps. Borne : trois journées complètes, avec une limite de tours explicite égale à quatre fois le nombre de camps. Les huit parties atteignent la journée 4 sans conclusion prématurée :

- `aube_batteries_2v1` : 80 actions, 9 tours de camp.
- `aube_reserves_1v2` : 83 actions, 9 tours de camp.
- `aube_nuit_2v2` : 96 actions, 12 tours de camp.
- `aube_releve_1v3` : 72 actions, 12 tours de camp.
- `aube_routes_3v1` : 99 actions, 12 tours de camp.
- `aube_convoi_secondaire` : 44 actions, 6 tours de camp.
- `aube_archives_secondaire` : 45 actions, 6 tours de camp.
- `aube_essais_drones` : 52 actions, 6 tours de camp, catalogue 7 ; les autres restent au catalogue 6.

Total : **571 actions légales, aucun refus**. Les huit transformations de difficulté et créations de partie sont valides.

## Deux sièges difficiles complets

Graine : `aube:difficile:siege:1`. Adversaires pondérés. Borne de sécurité : journée 41 incluse et 168 tours de camp maximum ; la partie s’arrête dès son résultat.

- Joueur pondéré : victoire du camp 0 à la journée 41, motif `objectif_survivre`, 71 tours de camp, **587 actions, aucun refus**.
- Joueur agressif : même victoire à la journée 41, 70 tours de camp, **510 actions, aucun refus**.

Les deux stratégies satisfont donc réellement l’objectif de quarante journées sous la transformation difficile, y compris ses renforts additionnels. Aucun ajustement supplémentaire de fonds ou de placement n’a été nécessaire.

Ces contrôles prouvent le chargement, la légalité des actions et deux solutions automatiques au siège difficile. Ils ne démontrent pas une difficulté humaine homogène, la qualité artistique ni l’absence de temps morts dans la fin du siège. Les sept autres scénarios difficiles n’ont ici été joués que pendant leurs trois premières journées : leur victoire complète n’est pas attestée par ce contrôle.
