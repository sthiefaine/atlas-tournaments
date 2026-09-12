# unite_antiair_base — candidat source HD

Source uploadée : `military tank 3d model.glb`, SHA-256 `bd7e4df51bf5a0cdc8b34a95b036f866ccf64d362cbd1580bf4ef55675ffc989`.

950800 triangles de la source conservés ; 950812 triangles livrés. LOD0 uniquement. Normales et UV issus de la source ; mise aux dimensions et préparation des attaches, sans décimation. Cartes PBR 4096² conservées en PNG externes ; masque binaire 512², zones correspondantes neutralisées dans l’albédo.

Poids des fichiers : 59157037 octets. Verdict technique `ok`. Exposition comme candidat dans l’inspecteur, aucune activation en jeu ni approbation artistique automatique.

À vérifier humainement : orientation avant, silhouette, segmentation des pièces mobiles, zones d’équipe et absence d’éclairage déjà présent dans les textures source. Les animations sont rigides ; aucune nouvelle marche squelettique individuelle pour l’infanterie. Le contrôle technique ne démontre pas ces qualités visuelles.

Préparation : `python3 scripts/antiair/preparer-source.py <source.glb>` puis `npm run controler:asset -- --spec assets/specs/unite_antiair_base.json --lot assets/livraisons/unite_antiair_base`.
