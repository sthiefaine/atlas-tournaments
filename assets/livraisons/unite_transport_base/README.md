# Livraison — transport commun

Candidat original paramétrique : **5 980 triangles**, **5 primitives**, **1,676,337 octets** pour les six fichiers GLB/PNG. Contrôle technique `ok`, aucune approbation artistique automatique.

La silhouette est celle d’un porteur chenillé : soute ouverte avec plancher antidérapant et banquettes, cabine avancée vitrée, rails d’arrimage, rampe abaissée, grue doublement repliée sur le flanc gauche. Aucune tourelle, aucun tube ni rack. Le modèle mesure **0,620 × 0,500 × 0,879 m** (largeur × hauteur × profondeur), origine centrée au sol, +Y vertical et +Z avant.

Un seul `unite_transport_base_lod0.glb`. Les cinq PNG canoniques restent externes, sans copie embarquée. Couleur d’équipe sur cabine et panneaux de soute ; albédo gris sous le masque binaire. Les matières et le microrelief sont calculés sans lumière ou ombre dans l’albédo. Pas de nouveau bake HD, aucune source HD n’étant disponible.

Ancienne livraison inspectée : 844 triangles, SHA `c782a277bc107f72f37a3d751bb81432d90e06b7c28463891ed9c5224d847c5b`. Le relevé distant du coordinateur du 16 septembre 2026 donne une liste de sources vide. Cette proposition ne remplace donc aucun GLB uploadé. Les scripts reproductibles sont dans `scripts/production/modeles/unite_transport_base`.

Les nœuds `racine`, `corps`, `base`, `socle`, `module_grue` et les quatre clips prescrits sont présents. Les boucles coïncident exactement, la racine n’est jamais animée ; le hors-jeu tasse la caisse et masque le témoin. Normales et tangentes unitaires, UV0 partout, aucun triangle dégénéré ou inversé au contrôle binaire.

Limites : pas de capture ou contrôle visuel, pas de mesure réelle sur téléphone. Les patins ne défilent pas et la rampe reste abaissée, sans nœud d’articulation prévu par cette fiche. L’intégration et le push sont réalisés séparément par le coordinateur après cette réception.
