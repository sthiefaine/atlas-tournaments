# Char léger — candidat issu du GLB uploadé

Source : `tank 3d model.glb`, SHA-256 `82f0857a3f0074cbd2aca688ec81c2227f53fa1a1dcbba66d6579f399a513f99`.

957 200 triangles conservés, plus 12 pour le témoin de disponibilité : 957 212 triangles. Un seul LOD0. Normales et UV source préservés, mise aux dimensions 0,62 × 0,50 × 0,85 m ; PNG PBR externes 4096², masque binaire 512². Cinq clips rigides ; racine immobile.

Lot de 53 130 822 octets, verdict technique `ok`. Candidat exposé dans l’inspecteur ; le modèle actif reste inchangé. Les anciennes cartes hiver appartiennent à une autre géométrie et ne sont pas incluses. Aucun kit national produit.

Revue humaine requise : orientation avant, silhouette et matières, séparation de la tourelle et zones d’équipe. Les mesures techniques ne prouvent pas ces qualités visuelles ni l’absence de lumière cuite dans les textures source.

Préparation reproductible : `python3 scripts/char_leger/preparer-source.py <source.glb>`, puis `npm run controler:asset -- --spec assets/specs/unite_char_leger_base.json --lot assets/livraisons/unite_char_leger_base`.
