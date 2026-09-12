# unite_artillerie_base — candidat source HD

Source uploadée : `military cannon vehicle 3d model.glb`, SHA-256 `38a5dbc65010bb45ec2424de7fa9c19b1e6d220ec0beb5339d2a5c35214fad5b`.

941718 triangles de la source conservés ; 941718 triangles livrés. LOD0 uniquement. Normales et UV issus de la source ; mise aux dimensions et préparation des attaches, sans décimation. Cartes PBR 4096² conservées en PNG externes ; masque binaire 512², zones correspondantes neutralisées dans l’albédo.

Poids des fichiers : 48822478 octets. Verdict technique `ok`. Exposition comme candidat dans l’inspecteur, aucune activation en jeu ni approbation artistique automatique.

À vérifier humainement : orientation avant, silhouette, segmentation des pièces mobiles, zones d’équipe et absence d’éclairage déjà présent dans les textures source. Les animations sont rigides ; aucune nouvelle marche squelettique individuelle pour l’infanterie. Le contrôle technique ne démontre pas ces qualités visuelles.

Préparation : `python3 scripts/artillerie/preparer-source.py <source.glb>` puis `npm run controler:asset -- --spec assets/specs/unite_artillerie_base.json --lot assets/livraisons/unite_artillerie_base`.
