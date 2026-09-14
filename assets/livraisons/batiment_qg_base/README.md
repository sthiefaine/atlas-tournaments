# batiment_qg_base — LOD0 de jeu optimisé

Actif après contrôle technique `ok`. 873,843 → **35,009 triangles**, lot de **7.37 Mio**. Un seul GLB LOD0, PNG externes de 2K maximum. Sources HD et leurs résolutions originales conservées sous SHA-256.

- `maitre.json` : fichiers HD, empreintes et emplacements de récupération (données immuables ou historique Git).
- `optimisation.json` : réduction bornée avec coutures verrouillées, structure/UV/normales/animations conservés ; normales texturées existantes réutilisées, aucun nouveau bake.
- `textures-optimisation.json` : résolutions et poids par canal ; filtrage albedo en linéaire et renormalisation des normales.
- `validation-lot.json` : verdict de ce lot, distinct d’une approbation artistique.

Les anciens rapports de préparation ci-dessous décrivent le maître HD, pas le LOD0 actif. La mesure sur téléphone réel reste à réaliser avec `/jeu/premier_contact?mesure=1`.

---

## Historique de la préparation HD

# QG partagé — source Tripo

Source locale identique à la révision uploadée 71a2d4e7aeab754dfa8edc0e5708d5021e4f4bd88204654a8be20eeb168bb326 ; API sans session : HTTP 403.

873 807 triangles conservés, 36 triangles ajoutés pour parcelle, mât et fanion. Échelle uniforme, normales et UV source conservés. Textures source 4096² sans réduction, export JPEG vers PNG. Albedo neutralisé uniquement aux UV du masque d’équipe. Normale et rugosité source conservées. Émission noire : éclairage des fenêtres restant à peindre. Orientation et qualité artistique non certifiées.

GLB source 27 904 732 octets ; préparé 25 787 164 ; compressé sans quantification 11 309 588. Lot : 31492496 octets. Contrôle technique ok ; activation directe demandée.
