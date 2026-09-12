# unite_infanterie_base — candidat source HD

Source uploadée : `armored soldier 3d model.glb`, SHA-256 `d98081ee79d3d57c5ce16d8dec70f602a78ec07e63030ee9652aa4b7ac433b84`.

985194 triangles de la source conservés ; 985194 triangles livrés. LOD0 uniquement. Normales et UV issus de la source ; mise aux dimensions et préparation des attaches, sans décimation. Cartes PBR 4096² conservées en PNG externes ; masque binaire 512², zones correspondantes neutralisées dans l’albédo.

Poids des fichiers : 38678057 octets. Verdict technique `ok`. Exposition comme candidat dans l’inspecteur, aucune activation en jeu ni approbation artistique automatique.

À vérifier humainement : orientation avant, silhouette, segmentation des pièces mobiles, zones d’équipe et absence d’éclairage déjà présent dans les textures source. Les animations sont rigides ; aucune nouvelle marche squelettique individuelle pour l’infanterie. Le contrôle technique ne démontre pas ces qualités visuelles.

Préparation : `python3 scripts/infanterie/preparer-source.py <source.glb>` puis `npm run controler:asset -- --spec assets/specs/unite_infanterie_base.json --lot assets/livraisons/unite_infanterie_base`.
