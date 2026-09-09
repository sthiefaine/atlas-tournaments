# Essai jouable des drones et du matériel méridien

Le scénario `aube_essais_drones`, statut `brouillon`, expose le catalogue 7 sur `carte_essais_drones`, une carte côtière de 12 × 10. La grille reprend la chaussée de la quête du convoi, avec une clé et des déploiements propres. Il ne demande aucune nouvelle carte de terrain ni aucun asset régional.

Ariane commande le camp 0 : drone intercepteur, drone ravitailleur, deux infanteries, char léger, char lourd et artillerie. Hadran commande le camp 1 : Veilleur méridien, Bastion méridien, hélico et infanterie. `factionsParCamp: { "1": "atl" }` réserve explicitement les deux unités exclusives au seul camp méridien. Le joueur ne reçoit ni faction supplémentaire ni unité exclusive.

Le joueur doit prendre le QG adverse ou mettre son camp hors jeu avant la fin de la quinzième journée. Les budgets sont fixes, 6 000 fonds pour le joueur et zéro pour l’adversaire, dont les unités sont prépositionnées. Pas de renfort caché ni de revenu périodique. Le scénario sert à distinguer interception, ravitaillement, brouillage et défense antiaérienne ; les chars et l’artillerie offrent des réponses au Bastion sans suggérer que les drones remplacent une armée complète.

L’ouverture annonce les rôles et l’exclusivité. La première attaque rappelle de lire la prévision de duel et de couvrir les drones. Cet essai n’attribue pas le matériel méridien au joueur après une victoire. Son raccordement dans la liste `/jeu` appartient au chantier d’interface ; les fichiers de données ne modifient pas cette liste par eux-mêmes.

`tests/app/essais-drones.test.ts` valide le scénario et sa carte, la présence des quatre nouveautés, l’absence d’exclusivité méridienne au camp 0, la correspondance des factions et le premier cycle des camps. Test vert. Simulation bornée, IA pondérée contre pondérée, graine `aube:drones:1` : victoire du joueur par capture du QG à la journée 10, après 135 actions légales et aucun refus. C’est une preuve de solution dans la limite annoncée, pas une homologation de difficulté humaine ni un test exhaustif des capacités individuelles.
