# Atelier Gemini → Tripo → Atlas

`/admin/assets/creation` oriente vers les catégories. La bibliothèque filtre les pays, familles et régions (recherche ou variantes de fiche). Chaque fiche propose un prompt concept, puis un prompt six vues utilisant le concept retenu. Une planche doit être découpée avant l’import dans Tripo. Les kits gardent la géométrie de base ; les terrains utilisent un prompt de matière.

Le GLB détaillé est une source, pas un modèle activé. Dépôt brut jusqu’à 150 Mio, versions identifiées par SHA-256, téléchargement authentifié, aucun nom reçu utilisé comme chemin. Les textures doivent être intégrées à la source. Les exports optimisés continuent d’utiliser le contrat du lot final et les PNG partagés. La conversion Blender, l’approbation artistique et le déploiement ne sont pas automatiques.

## Stockage next-upload

Une route dédiée est préparée dans le projet voisin `next-upload` : `/api/atlas-assets/{id}/sources` (GET liste/téléchargement, POST GLB brut). Elle utilise son authentification serveur `UPLOADFILES_WRITE_TOKEN`, exige un GLB autonome, écrit hors du dossier public et ne change pas la limite des uploads ordinaires.

Configuration de production à effectuer dans l’hébergeur, sans envoyer les secrets au navigateur :

- **next-upload** : `ATLAS_SOURCES_DIR=/data/atlas-sources`, dossier situé dans un volume persistant, avec sauvegarde ; réutiliser son `UPLOADFILES_WRITE_TOKEN` existant. Déployer la nouvelle route.
- **Atlas** : `ATLAS_UPLOAD_URL=https://votre-service-upload`, `ATLAS_UPLOAD_TOKEN` contenant le jeton d’écriture du service. Déployer Atlas.
- Le proxy devant les deux services doit accepter 150 Mio et le temps nécessaire au transfert. Les octets traversent Atlas pour garder l’authentification admin et le jeton distant côté serveur.

Alternative locale : `ATLAS_ASSET_SOURCES_DIR` absolu ; par défaut en développement `assets/sources`, ignoré par git. En production, aucun dépôt local n’est proposé sans configuration explicite. Configurer un chemin ne prouve pas qu’il est persistant : le montage reste à vérifier sur l’hébergeur.

La présence des routes ne vaut pas activation du service en ligne. L’URL, les variables et le volume du déploiement restent à confirmer.
