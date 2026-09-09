# Les dix tutoriels jouables — 9 septembre 2026

Le parcours local `content/campagne.json` comprend dix entraînements puis les deux matchs officiels existants, Le pacte du col et Sous les couleurs alliées. Les 144 missions nationales et les 18 finales restent des fiches éditoriales : cette livraison ne les transforme pas en cartes jouables.

## Progression pédagogique

1. Premier contact : déplacer, prévoir le duel, concentrer ses tirs et comprendre la riposte.
2. Les quatre villes : capturer, encaisser des revenus et tenir trois postes simultanément.
3. Le chantier des usines : produire, protéger le génie et remettre deux usines en service.
4. Le QG de la presqu’île : couvrir une capture longue, utiliser les passages côtiers et le transport.
5. La bonne distance : préparer le tir indirect et protéger l’artillerie.
6. Au-delà des arbres : reconnaître avec un drone, lire le brouillard et les IEM, tenir deux postes dont un radar.
7. Le dernier kilomètre : escorter un transport, découvrir le ravitaillement et le drone marin.
8. Coopération en équipe : deux camps alliés contre une défense commune.
9. Postes d’énergie : capturer deux postes sur trois, anticiper la météo annoncée.
10. Synthèse : prendre le QG ou mettre l’armée adverse hors jeu, puis décider du soutien aux matchs officiels.

Les objectifs précis, positions et limites sont ceux des scénarios et du manifeste. Les dialogues expliquent les règles du moteur, sans promettre de mécanisme futur. Les cartes sont distinctes ; aucun modèle 3D supplémentaire n’est nécessaire.

## Adaptations du plan éditorial

Le sixième exercice demande de **conserver simultanément** le radar et une ville : aucune validation mémorisée « radar puis QG » n’est inventée. Le septième exige la survie du transport désigné ; la couverture est un conseil tactique, pas une condition supplémentaire cachée. Au neuvième, capturer une station ne supprime pas un épisode météo déjà programmé. Au dixième, préserver le transport est facultatif et ne conditionne pas le choix final.

Les cinq premiers exercices sont sans brouillard et en jour permanent : désactiver le seul booléen de brouillard ne suffit pas, car la nuit l’impose. Le sixième alterne deux journées de jour et deux de nuit ; les dialogues J2, J3 et J5 annoncent et expliquent cette transition. Les deux difficultés sont déclarées dans le contenu. Les exercices sans économie gardent zéro revenu dans les deux modes ; le validateur des modes accepte désormais zéro, comme le scénario et le moteur. Les aides restent consultables en difficile.

## Choix et anciennes sauvegardes

Après la victoire au dixième exercice, `fonds_immediats` verse 2 000 fonds supplémentaires au joueur dans une nouvelle partie du Pacte du col. `maintenance_partagee` verse 2 000 fonds dans une nouvelle partie de Sous les couleurs alliées. Le choix est enregistré par profil ; la graine garde les conséquences de départ d’une partie, afin qu’une décision ultérieure ne change pas son rejeu.

Les anciennes victoires sont conservées. Un joueur ayant terminé les six anciennes missions reprend au cinquième tutoriel et peut toujours rejouer ses matchs officiels remportés. Les scénarios modifiés augmentent leur version : une partie en cours sur l’ancienne version est signalée comme incompatible, sans effacer les victoires du carnet.

## Vérification

`node --import tsx scripts/verifier-campagne.ts` vérifie les scénarios et cartes, joue les deux modes et compare chaque victoire à son rejeu. Le pilote respecte les équipes et les objectifs multiples. Il démontre une possibilité de victoire ; il ne mesure pas la difficulté ressentie par une personne.

Les tests du carnet contrôlent les dix cartes distinctes, les deux modes et la reprise des anciens profils. Les tests navigateur ouvrent les six nouveaux plateaux et leurs commandes, sans capture ni validation à l’œil.

Réception : les 24 couples mission/mode (dix tutoriels et deux matchs, normal et difficile) ont été remportés par les pilotes, avec rejeu conforme. Les sept tests navigateur du carnet et des six nouveaux plateaux passent.

## GLB de Premier contact et obscurité

La livraison initiale des candidats ne les activait pas dans le jeu. À la demande explicite du propriétaire, cinq bases d’unités et dix kits France/Luxembourg sont publiés sous `/assets/modeles`, par références aux données communes. L’inventaire reconnaît désormais ces liens. Les QG utilisent les GLB livrés ; les cinq sols/voies utilisent leurs textures PBR sur le maillage de relief existant, car une plaque plate ne pourrait pas suivre les pentes et raccords. Les trois décors optionnels de l’archive ne sont pas activés par ce branchement.

Cette activation est technique et autorisée ; elle ne fabrique pas une approbation artistique dans l’admin. Le script `scripts/production/activer-premier-contact.ts` et les rapports `activation-*.json` décrivent les lots servis.
