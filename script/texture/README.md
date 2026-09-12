# Atelier de prompts — Atlas Tournament

Version 1 • 12 septembre 2026 • prompts préparés pour essais, pas encore validés par une production Gemini → Meshy.

Objectif : des assets beaux **dans le jeu**, depuis une caméra à 65° au-dessus de l’horizontale, à environ 48 pixels par mètre. Le relief lisible, les proportions et les contrastes de matières passent avant les petits détails. Ce dossier contient des prompts à copier ; il ne lance aucun service externe et ne modifie aucun modèle en jeu.

## Choisir le bon fichier

- [01-textures.md](01-textures.md) : texture albedo générique et **prompt complet pour la plaine**, avec un essai de rendu distinct.
- [02-vues-gemini-meshy.md](02-vues-gemini-meshy.md) : planche face/profils/dos/dessus/dessous, puis vues individuelles cohérentes.
- [03-unites.md](03-unites.md) : unité générique, char léger prêt à essayer, infanterie et variantes nationales.
- [04-batiments.md](04-batiments.md) : bâtiment générique et QG prêt à essayer.
- [05-finition-et-iteration.md](05-finition-et-iteration.md) : reprise du GLB, cartes PBR, contrôle technique et boucle d’amélioration.
- [briefs.json](briefs.json) : trois fiches structurées avec les contraintes techniques extraites des spécifications actuelles et les références des prompts.

Les explications sont en français ; les blocs anglais peuvent être collés tels quels après remplacement des champs `{{...}}`. L’anglais est un choix de cohérence de vocabulaire, pas une garantie de meilleur résultat. Les exemples complets n’ont aucun champ à remplir. Ne coller que le bloc utile, sans ajouter toutes les consignes du dossier à chaque génération.

## Parcours recommandé

1. **Texture de terrain** : utiliser le prompt albedo de 01. La texture ne passe pas par Meshy. Pour de vraies touffes en volume, créer un petit asset de végétation distinct ; conserver la dalle de plaine plane.
2. **Unité ou bâtiment** : essayer le concept de 03 ou 04. Retenir un design, puis joindre cette image de référence à chaque demande de vue dans 02. Une vue ne doit jamais devenir une nouvelle proposition de design.
3. Préparer les vues isolées pour Meshy. Générer un premier modèle et regarder sa géométrie sans texture avant de payer une finition détaillée. Ne pas accepter une belle peinture qui dissimule une silhouette fausse.
4. Passer le modèle dans l’étape 05 : échelle, pivot, séparation des pièces, UV, PBR, LOD, animations et validation.
5. Comparer l’asset en jeu à la version de base. **L’approbation artistique vient du propriétaire** ; une conformité technique n’est pas une approbation visuelle. Aucune capture automatique n’est demandée ici ; respecter les consignes de vérification du projet.

## Deux images qui n’ont pas le même usage

Une référence de reconstruction doit montrer les volumes sous une lumière douce. Une albedo décrit uniquement les couleurs de matière, sans ombre ni reflet. Une image « cinématique, éclairage spectaculaire, occlusion forte » peut vendre un concept mais produit une mauvaise albedo. Le relief d’un gazon vient du terrain, des brins géométriques et des normales correspondantes ; une image plane ne peut pas fournir tout cela seule.

## Gemini et Meshy : limites à respecter

La documentation Google conseille de réutiliser les images précédentes comme références pour conserver la cohérence. Les capacités exactes dépendent du modèle choisi ; ce dossier ne présume pas que Gemini exporte une série de PNG séparés, un UV ou un GLB. [Documentation Google](https://ai.google.dev/gemini-api/docs/generate-content/image-generation).

La documentation Meshy consultée le 12 septembre 2026 décrit une image principale et trois vues supplémentaires, et demande de découper les planches en vues individuelles. Préparer face, gauche, dos, droite comme ensemble d’import ; garder dessus et dessous comme références de finition. Vérifier les possibilités de l’interface au moment de l’usage. Ne pas envoyer une planche de six objets dans le champ d’une image unique. [Guide Meshy](https://help.meshy.ai/en/articles/12634481-how-to-use-multi-view), [conseils de cohérence](https://help.meshy.ai/en/articles/16102789-meshy-multi-view-best-practices-angles-and-images).

## Sources de vérité du projet

`../../BRIEF.md` porte le canon narratif courant. `../../assets/specs/<id>.json` porte le contrat technique de chaque asset. Les anciens textes « matériel de compétition » ne doivent pas annuler les décisions plus récentes du lore ; les interdits visuels du lot restent applicables. Les exemples ici restent sans sang, symboles réels, drapeaux réels, marques ni texte lisible.

Les chiffres de `briefs.json` sont un instantané daté. Relire la spécification avant chaque livraison : ne pas recopier le budget ou les animations d’un char sur une infanterie ou un bâtiment. Les prompts ne garantissent ni des raccords exacts, ni la géométrie partagée, ni un budget de triangles : ces propriétés se construisent et se contrôlent après génération.
