# unite_char_leger_base — LOD0 de jeu optimisé

Actif après contrôle technique `ok`. 957,212 → **55,720 triangles**, lot de **9.83 Mio**. Un seul GLB LOD0, PNG externes de 2K maximum. Sources HD et leurs résolutions originales conservées sous SHA-256.

- `maitre.json` : fichiers HD, empreintes et emplacements de récupération (données immuables ou historique Git).
- `optimisation.json` : réduction bornée avec coutures verrouillées, structure/UV/normales/animations conservés ; normales texturées existantes réutilisées, aucun nouveau bake.
- `textures-optimisation.json` : résolutions et poids par canal ; filtrage albedo en linéaire et renormalisation des normales.
- `validation-lot.json` : verdict de ce lot, distinct d’une approbation artistique.

Les anciens rapports de préparation ci-dessous décrivent le maître HD, pas le LOD0 actif. La mesure sur téléphone réel reste à réaliser avec `/jeu/premier_contact?mesure=1`.

---

## Historique de la préparation HD

# Char léger — candidat issu du GLB uploadé

Source : `tank 3d model.glb`, SHA-256 `82f0857a3f0074cbd2aca688ec81c2227f53fa1a1dcbba66d6579f399a513f99`.

957 200 triangles conservés, plus 12 pour le témoin de disponibilité : 957 212 triangles. Un seul LOD0. Normales et UV source préservés, mise aux dimensions 0,62 × 0,50 × 0,85 m ; PNG PBR externes 4096², masque binaire 512². Cinq clips rigides ; racine immobile.

Lot compressé de 38 342 542 octets. GLB Meshopt : 14 209 732 octets au lieu de 28 998 012. PNG inchangés. Le dernier verdict `ok` concernait le lot avant compression ; contrôles non relancés à la demande du propriétaire. Candidat exposé dans l’inspecteur ; le modèle actif reste inchangé. Les anciennes cartes hiver appartiennent à une autre géométrie et ne sont pas incluses. Aucun kit national produit.

Revue humaine requise : orientation avant, silhouette et matières, séparation de la tourelle et zones d’équipe. Les mesures techniques ne prouvent pas ces qualités visuelles ni l’absence de lumière cuite dans les textures source.

Préparation reproductible : `python3 scripts/char_leger/preparer-source.py <source.glb>`, puis `npm run controler:asset -- --spec assets/specs/unite_char_leger_base.json --lot assets/livraisons/unite_char_leger_base`.

Compression : `node --import tsx scripts/production/compresser-source.ts unite_char_leger_base` après préparation du GLB source. Extension `EXT_meshopt_compression` requise ; les chargeurs Atlas sont raccordés. Aucun fallback géométrique non compressé n’est embarqué. Détails dans `compression.json`.
