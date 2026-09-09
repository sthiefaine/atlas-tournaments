# Livrées nationales candidates

`scripts/production/kits.ts` fabrique les 648 kits communs du catalogue 8 : 27 unités communes × 24 nations. Les deux prototypes méridiens restent exclusifs et ne reçoivent aucun kit national.

Le générateur copie le document de la base disponible (candidat technique ou modèle public), conserve son tampon binaire, ses accesseurs, ses UV, ses articulations et ses clips. Il change uniquement les références d’images. Le contrôle de dépôt compare l’empreinte géométrique du kit avec celle de la base utilisée : une réexportation approximativement identique ne suffirait pas.

Les palettes proviennent de `content/styles/<nation>.json`. Les panneaux de la base reçoivent une peinture et un motif abstrait ; le masque restant est un liseré neutre au sein de ces panneaux, conformément au contrat du kit. Les parties hors panneau conservent leurs matières. Les résolutions viennent de chaque spécification : notamment le masque des kits est à 256 pixels, contre 512 sur beaucoup de bases. Les normales et rugosités sont partagées lorsque leurs pixels sont identiques. Aucun symbole national réel n’est ajouté.

Il s’agit de **livrées de travail**, pas d’une interprétation artistique complète des motifs, matières et finitions décrits par chaque style. Leur contrôle technique réussi ne vaut ni approbation artistique ni autorisation de publication. Les candidates issues de silhouettes procédurales restent dépendantes de la validation de leur base.

Les caches sont bornés (douze images décodées, soixante-quatre PNG calculés). Les fichiers identiques sont liés physiquement dans le dossier de préparation pour limiter son poids. Git ne conserve pas cette déduplication physique : la décision de publier ou versionner les binaires doit encore considérer la taille du dépôt et la distribution.

Chaque lot est validé avant écriture, placé dans un répertoire temporaire puis renommé atomiquement. Le rapport de progression est écrit après chaque lot. Une reprise contrôle de nouveau les fichiers existants avec leur base ; elle ne remplace pas silencieusement une livraison devenue incompatible.

## Base historique de l’infanterie

Le contrôle strict a trouvé dans l’infanterie publique un deuxième matériau `mat_details`, alors que sa spécification exige uniquement `mat_corps`. Les deux matériaux avaient les mêmes paramètres PBR et les mêmes textures. Une **copie candidate distincte** a donc été produite dans `assets/livraisons/unite_infanterie_base` : un seul matériau, références des primitives remappées, tampon de géométrie, UV, squelette et clips conservés. Après comparaison par la coordination, les trois GLB publics ont reçu cette même correction technique : les matériaux étaient strictement identiques hors nom, le tampon binaire et toute la structure hors références de matériau étaient conservés. Cette correction ne constitue pas une approbation artistique. Les kits utilisent la copie candidate identique en priorité et sont comparés à elle, jamais à un mélange de plusieurs versions.

Le génie a également nécessité de conserver les pièces qui déterminent ses extrêmes au LOD2 : sa hauteur simplifiée sortait du contrat. Les 29 bases ont été recontrôlées après cette correction, avant le démarrage des livrées.
