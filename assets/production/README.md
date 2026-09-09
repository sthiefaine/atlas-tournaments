# Production des assets

`plan-assets.json` contient une commande complète par spécification, les fichiers attendus et un état de présence au moment de sa génération. Régénérer avec `npm run produire:manifest` après chaque lot. L’admin propose également le téléchargement du JSON et du prompt par asset.

Les générateurs de `scripts/production/` écrivent dans `assets/livraisons/`. Les PNG restent externes et partagés entre les niveaux de détail. Les bases déjà livrées sont conservées. Les kits reprennent la géométrie de leur base.

**Un candidat qui passe les contrôles techniques n’est pas un modèle définitif approuvé.** Les rapports de génération détaillent les refus. Les limites artistiques restent consignées dans chaque lot ; la présence de fichiers ne doit jamais être convertie automatiquement en approbation. La réception existante demeure le chemin d’intégration dans le jeu.

Le catalogue comprend également dix archétypes de portraits de commandants, produits séparément des unités et des paysages. Comme les autres familles, leurs candidats demandent une revue artistique.

## Reproduire la production

Exécuter successivement `npm run produire:unites`, `npm run produire:kits`, `npm run produire:environnement`, `npm run produire:commandants`, puis `npm run produire:manifest` et `npm run produire:bilan`, puis `npm run produire:exposer`. Les lots existants sont contrôlés avant reprise. Un candidat issu d’une version ancienne du générateur doit être archivé avant régénération ; les modèles déjà publiés ne sont pas remplacés par ces commandes.

Les rapports `assets/livraisons/rapport-*.json` conservent les résultats de contrôle. `bilan-unites-kits.json` mesure le poids du premier lot. Les PNG identiques peuvent partager un lien dur local ; leur contenu reste un PNG autonome lors d’une copie ou d’un checkout Git. Les modèles référencent les PNG externes communs à leurs LOD.

Les dossiers de fabrication (`assets/livraisons`) sont exclus du contexte Docker. La commande d’exposition prépare des alias de prévisualisation dans `public/assets/candidats`, vers les données uniques de `public/assets/donnees`. Docker embarque ces prévisualisations dédupliquées et le manifeste. Elles restent séparées des modèles reçus dans `public/assets/modeles` et ne constituent pas une approbation artistique.

Le bilan global (`bilan.json`) vérifie les fichiers requis, les références PNG des GLB et compte les données uniques par SHA-256. Il ne remplace pas les rapports de contrôle strict ni une revue artistique.
