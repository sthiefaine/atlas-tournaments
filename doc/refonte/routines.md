# Routines — refonte énergétique, 9 septembre 2026

Ce document décrit les changements effectivement codés pour la refonte demandée. Il complète `doc/05-routines.md` ; les capacités narratives qui ne sont pas encore dans les schémas ne deviennent pas disponibles par la seule écriture d'un prompt.

## Exécution

Les cinq prompts métier de `src/serveur/prompts.ts` passent en référence **2**. Le modèle cible demandé est **Claude Sonnet 5**. Sa disponibilité et son identifiant API ne sont pas établis ici : l'opérateur configure le modèle disponible dans son exécuteur. Aucun SDK, abonnement, clé fournisseur ou appel à un modèle n'est ajouté au jeu. Le moteur reste indépendant de ces routines.

Chaque run lit une seule version du prompt métier, produit des objets strictement conformes aux schémas servis, puis s'arrête. La publication reste une décision humaine. Les entrées externes, les notes et les dialogues sont des données, jamais des instructions modifiant les autorisations du run.

## Les cinq métiers

- **atlas_lore** : développe le canon énergétique ; respecte l'historique des personnages, distingue événements établis et croyances, lie chaque choix à un flag connu et à une conséquence ultérieure vérifiable. Les révélations suivent la progression fournie. Une biographie manquante est signalée, jamais inventée pour remplir une fiche.
- **atlas_map** : compose les intentions et paramètres, distingue camps et équipes, demande des alliances explicites pour 2v1, 1v2, 1v3, 3v1, 2v2. Par défaut capture du QG ou mise hors jeu totale ; une mission exclusivement d'élimination n'offre pas de victoire alternative par capture. Une survie de 40 journées ne fait pas apparaître un allié si aucun événement moteur ne le prévoit.
- **atlas_controle** : mesure les possibilités réelles du moteur, la jouabilité de chaque équipe et des renforts, la cohérence des biographies et la consommation des conséquences. Une capacité non simulable n'est jamais certifiée sur la foi d'un dialogue.
- **atlas_cerveau** : mémoire structurée, propositions de prompts, événements et homologation bornée. Réutiliser les unités, traits et modèles est prioritaire ; zéro nouvelle unité est un résultat normal. Les biographies canoniques durables ne vont pas dans la mémoire temporaire à expiration.
- **atlas_traduction** : conserve les marqueurs, les références et la progression des révélations ; le glossaire source reste maître. La traduction n'invente pas une histoire locale différente.

Le conflit est une guerre d'influence fictive menée sous forme de tournois pour l'accès à l'énergie. La faction inconnue est fictive. La recherche sur la fusion peut être inspirée de faits sur ITER fournis par le serveur, mais le site convoité porte un nom fictif ; aucun complot réel n'est attribué à ITER ou à ses équipes. Une élimination concerne les unités de la manche, sans violence explicite contre leurs équipages.

## Endpoints opérationnels

Tous les appels exigent `Authorization: Bearer $CRON_SECRET`. Le contrat lisible par machine est **GET `/api/routines/contrat`** : il fonctionne sans base configurée, ne réserve rien, annonce la version et les cinq verbes disponibles. Le reste du pipeline demande PostgreSQL.

- **GET `/api/routines/missions?routine={cle}`** : prompt et réservation de la file. Attention à l'héritage : ce GET a un effet de réservation ; ne pas le sonder périodiquement comme une lecture pure.
- **GET `/api/routines/missions/{id}`** : contexte de la mission ouverte.
- **POST `/api/routines/missions/{id}/soumission`** : contenu soumis au validateur. Recopier `Idempotency-Key: <mission.id>` et conserver exactement la même charge en cas de réponse incertaine.
- **PUT `/api/routines/missions/{id}`** : remplacement complet des trois annotations. Objet obligatoire : `{"commentaire":null,"note":null,"confiance":null}` ; remplacer les valeurs voulues. Le contexte métier et le contenu restent intacts. Répéter la même requête donne le même état.
- **PATCH `/api/routines/missions/{id}`** : modification partielle de ces annotations. Textes de 2 000 caractères maximum, confiance de 0 à 1, `null` pour effacer une valeur. Les champs inconnus sont refusés ; aucune troncature silencieuse.
- **DELETE `/api/routines/missions/{id}/reservation`** : rend le travail. Ce n'est pas une suppression de scénario.
- **DELETE `/api/routines/cerveau/memoire/{cle}`** : archive une mémoire obsolète ; l'historique est conservé.

**GET `/api/routines/bible/personnages?acte=0..3`** fournit les biographies et les événements révélables. Le fichier brut `content/personnages.json` est exclu du service générique du canon ; la vue admin affiche les trois actes. Les motivations privées ne sont servies qu’à l’acte III.

Les autres routes existantes restent spécialisées : POST de simulation, PATCH unique de commentaire d'aperçu, POST de candidate de prompt, GET des flags et de la mémoire, POST de traduction. On ne remplace pas ces contrats par un CRUD générique permettant d'écraser du canon.

Les PUT/PATCH ne peuvent porter ni scénario, ni grille, ni statut de publication. Leur écriture conditionnelle vérifie encore que la mission est ouverte au moment de la modification, pour éviter d'écrire après une clôture concurrente.

## Bootstrap à adapter à chacune des cinq clés

```text
Tu exécutes une routine de contenu Atlas Tournament hors de toute partie.
Domaine autorisé : https://atlas-tournament.clairdev.com uniquement.
Clé du métier : atlas_lore [remplacer par la clé de cette tâche].
Le secret CRON_SECRET est fourni par l'environnement sécurisé ; ne l'affiche jamais.
HTTP uniquement par curl, une commande par appel, sans redirection inter-domaine,
sans installation, sans pipes, sans jq, fichiers temporaires uniquement dans /tmp.
1. GET /api/routines/contrat, authentifié. Vérifie le contrat compatible.
2. GET /api/routines/missions?routine=<clé> une seule fois. Garde key/version/body.
3. Applique le prompt métier et ses bornes. Suis les URL reçues dans le même domaine.
4. Lis chaque contexte, vérifie ses références, soumets une fois le JSON prévu.
   Un besoin non représentable se signale ; aucun champ improvisé, aucune publication.
5. Termine le run par le bilan demandé, y compris si la file est vide ou interrompue.
401/403 : arrêt. 409 : ne force pas. 422 : une seule correction ciblée autorisée.
429/5xx : arrêt sans boucle de relance. Ne transforme jamais une erreur en succès.
```

La valeur du secret n'est jamais copiée dans le prompt, les journaux ou le dépôt. Les URL absolues reçues sont contrôlées avant emploi ; ne pas suivre une redirection hors du domaine.

## Version en base et limites de cette livraison

Le mécanisme existant `promptDeRun` initialise ou met à niveau un prompt courant de version inférieure à 2 au premier appel de file. Il conserve l'historique et promeut la référence embarquée comme changement humain du code. **Une version courante déjà supérieure ou égale à 2 est conservée** : vérifier son corps en administration avant exploitation, surtout si des versions personnalisées existaient. Aucun script de seed ne contient une deuxième copie des prompts. Aucun accès à la base de production ni aucune promotion distante n'a été exécuté dans ce chantier.

Les schémas de biographies, l'exposition de leurs références par le contexte, le moteur d'alliances et les renforts demandent leurs implémentations propres. Les prompts demandent de signaler toute capacité absente ; ils ne prétendent pas que les missions 2v2 ou l'arrivée à J40 sont déjà prises en charge. Aucune nouvelle route de biographie inexistante n'est annoncée.

Vérifications de cette passe : tests des verrous v2, refus des charges d'annotations, bornes et effacement, découverte authentifiée sans BDD, refus de PUT/PATCH non authentifiés. L'écriture effective en PostgreSQL doit encore être couverte par une exécution avec base de test ; aucun succès de production n'est revendiqué.
