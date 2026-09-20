# Production des assets

## File de modèles un par un — 16 septembre 2026

`plan-modeles-3d.json` est le plan de travail séquentiel demandé par le propriétaire : 65 modèles communs (30 unités, 6 bâtiments, 9 terrains, 10 décors sans variante nationale et 10 archétypes de commandants). Les déclinaisons nationales sont hors de ce lot ; les régionales restent suspendues. La plaine conserve son rendu procédural par décision antérieure.

Un seul spécialiste 3D prépare un seul modèle à la fois. Le coordinateur contrôle les fichiers, intègre, actualise le plan, fait un commit de ce modèle et le pousse sur `main` avant de lancer le suivant. La présence d'un ancien candidat ne signifie ni travail terminé ni approbation artistique. Les quatre bases livrées le 14 septembre sont identifiées ; l'anti-air puis l'artillerie uploadés sont optimisés et poussés individuellement le 16 septembre. L’automate méridien est la première création originale, sans source déposée ni ancien lot. Le plan ne promet pas de source HD pour les modèles qui n'en ont pas.

Régénération de l'inventaire : `node --import tsx scripts/production/plan-modeles-3d.ts`. Préserver le suivi des travaux déjà commencés et leurs commits. Les sources HD uploadées sont prioritaires et immuables ; le modèle de jeu est un seul LOD0 optimisé, PNG externes. Le spécialiste travaille dans `tmp/production-sequentielle/<id>` puis le coordinateur appelle l'intégrateur seulement après contrôle technique. Aucun test général ni vérification visuelle automatique, conformément aux consignes du propriétaire.

Les rapports de performance sur téléphone restent distincts de cette production et ne sont pas inventés.

Raccordement à vérifier avant les familles suivantes : les unités et bâtiments actifs sont chargés automatiquement ; les terrains fournissent actuellement leurs textures au relief du moteur, sans chargement général de leur maillage. `assets-environnement.ts` ne sélectionne pas les rochers GLB, et les portraits de commandants sont encore vectoriels. Un alias publié pour ces deux dernières familles ne suffit donc pas à annoncer leur affichage en jeu : leur raccordement reste à traiter lors de leurs livraisons.

Reprise du 20 septembre : les 65 fiches du stockage ont été relues ; les cinq fiches avec uploads portent les mêmes révisions que les sources déjà préparées. Le stockage est revérifié juste avant chaque intégration originale. Les secrets restent dans la configuration locale, jamais dans les manifestes.

Pour une création originale, `integrer-creation-originale.ts <id> <dossier>` archive le lot précédent et vérifie que les empreintes actives n'ont pas changé depuis l'inventaire. Il refuse un upload présent ou un ancien kit national encore actif : le chargeur privilégierait ce kit et masquerait la nouvelle base. Aucun kit n'est régénéré dans cette commande. Après intégration, régénérer le plan puis appeler `finaliser-livraison.py <id> <agent>` ; vérifier le typage des nouveaux scripts avant commit. La finalisation ne publie rien : commit et push restent explicites, modèle par modèle.

Pour les anciens kits actifs du génie, de la méca et de la reconnaissance, `retirer-kits-incompatibles.ts <base> <dossier préparé>` inspecte sans mutation. Il exige un remplacement conforme et documenté, compare géométrie/UV/nœuds/clips avec l'ancienne base et refuse un kit différent ou doté d'une source locale. Avec `--appliquer`, il archive puis retire les seuls alias actifs incompatibles ; candidats et données immuables restent conservés. Le rapport rejoint le staging et le lot final. Intégrer la nouvelle base et pousser ces retraits dans le même commit. Aucun retrait n'est fait à l'avance dans la file.

Après le déploiement, `node --import tsx scripts/production/verifier-publication.ts <id>` compare les SHA-256 du GLB et des PNG servis avec le lot actif, puis vérifie sa présence dans `/api/modeles`, l'inventaire utilisé par le jeu. Il ne met à jour le suivi que si tout correspond. Une absence temporaire pendant le build n'est pas une validation ; le code de sortie 2 signale une publication encore non conforme. Ce contrôle réseau n'effectue aucun rendu ni mesure FPS.

`plan-assets.json` contient une commande complète par spécification, les fichiers attendus et un état de présence au moment de sa génération. Régénérer avec `npm run produire:manifest` après chaque lot. L’admin propose également le téléchargement du JSON et du prompt par asset.

Les générateurs de `scripts/production/` écrivent dans `assets/livraisons/`. Les PNG restent externes et partagés entre les niveaux de détail. Les bases déjà livrées sont conservées. Les kits reprennent la géométrie de leur base.

**Un candidat qui passe les contrôles techniques n’est pas un modèle définitif approuvé.** Les rapports de génération détaillent les refus. Les limites artistiques restent consignées dans chaque lot ; la présence de fichiers ne doit jamais être convertie automatiquement en approbation. La réception existante demeure le chemin d’intégration dans le jeu.

Le catalogue comprend également dix archétypes de portraits de commandants, produits séparément des unités et des paysages. Comme les autres familles, leurs candidats demandent une revue artistique.

## Anciens générateurs par famille

Ces commandes historiques ne remplacent pas la file séquentielle ci-dessus. Ne pas les lancer globalement pendant la reprise modèle par modèle.

Exécuter successivement `npm run produire:unites`, `npm run produire:kits`, `npm run produire:environnement`, `npm run produire:commandants`, puis `npm run produire:manifest` et `npm run produire:bilan`, puis `npm run produire:exposer`. Les lots existants sont contrôlés avant reprise. Un candidat issu d’une version ancienne du générateur doit être archivé avant régénération ; les modèles déjà publiés ne sont pas remplacés par ces commandes.

Les rapports `assets/livraisons/rapport-*.json` conservent les résultats de contrôle. `bilan-unites-kits.json` mesure le poids du premier lot. Les PNG identiques peuvent partager un lien dur local ; leur contenu reste un PNG autonome lors d’une copie ou d’un checkout Git. Les modèles référencent les PNG externes communs à leurs LOD.

Les dossiers de fabrication (`assets/livraisons`) sont exclus du contexte Docker. La commande d’exposition prépare des alias de prévisualisation dans `public/assets/candidats`, vers les données uniques de `public/assets/donnees`. Docker embarque ces prévisualisations dédupliquées et le manifeste. Elles restent séparées des modèles reçus dans `public/assets/modeles` et ne constituent pas une approbation artistique.

Le bilan global (`bilan.json`) vérifie les fichiers requis, les références PNG des GLB et compte les données uniques par SHA-256. Il ne remplace pas les rapports de contrôle strict ni une revue artistique.
