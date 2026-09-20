# Ville commune — source originale

Création paramétrique indépendante de `batiment_ville_base`. Le coordinateur a confirmé une lecture distante authentifiée réussie le 20 septembre 2026 à 17:00:55.074 UTC, sans dépôt. Aucun maître local pertinent identifié. Ancien actif et candidat SHA `18daaaf44f866602c5a2f7eaed89b8789eeafa64dd1a987d0f30eb71442910e5` : 1 036 triangles, 129 500 octets ; quinze PNG historiques inspectés numériquement. Aucune source ou géométrie précédente importée, modifiée ou supprimée.

Trois maisons neutres entourent une cour ouverte vers +Z. La maison du fond a trois niveaux, les ailes deux. Toits fermés à deux pans, rangs de tuiles en relief, faîtières arrondies et rives grises ; fenêtres émissives séparées, encadrements, volets de bois et soubassements. Sur la marge avant gauche, l’auvent protège une table et deux tabourets. Trois jardinières à fond et quatre parois, terre et feuillage ; râtelier à trois arceaux sur la marge avant droite. Aucun emblème, texte ou silhouette humaine.

LOD0 : **4 608 triangles, cinq primitives, deux matériaux**, **0,850 × 0,700849 × 0,854500 m**, **487 896 octets**. Le GLB et les cinq PNG externes pèsent **1 947 859 octets**. La dalle fait 0,85 m de côté ; les tuiles arrière dépassent de 4,5 mm, en restant dans la case de 1 m. Atlas 4 × 4 et gouttières : pierre, enduit, tuile, bois peint, végétation, métal, verre. Masque équipe binaire sur gris neutre, appliqué aux rives, auvent et banderole ; aucune émission sur ces zones. Rugosité en G et métal en B, normales tangentielles +Y. Pigments et microreliefs analytiques sans éclairage, ombre ou occlusion cuits ; aucun bake HD.

`racine`, `corps`, `toit` et la dalle restent fixes. `repos`, 3,2 s, anime seulement un volet ouvert autour de ses charnières (±0,06 rad). `capture`, 1,4 s, fait monter une banderole rigide sans emblème de 30 mm dans ses rails puis la ramène. Le retour supérieur de la banderole offre une surface équipe vue du dessus. L’extra racine `atlasAnimationsBatiment: true` active le lecteur existant, sans changement de runtime dans ce lot.

Commandes reproductibles depuis la racine du dépôt, avant remplacement du candidat :

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_ville_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/batiment_ville_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_ville_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_ville_base/mesurer.py
node --import tsx scripts/production/modeles/batiment_ville_base/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/batiment_ville_base.json --lot tmp/production-sequentielle/batiment_ville_base > tmp/production-sequentielle/batiment_ville_base/validation-lot.log
npm run typecheck -- --incremental false > tmp/production-sequentielle/batiment_ville_base/typecheck.log
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_ville_base/assembler-revue.py --code-typecheck 0
```

Le dernier argument consigne un code réellement constaté, il ne lance pas le typage. `gltf.ts` reprend l’exporteur local récent qui conserve min/max sur les temps FLOAT SCALAR. `geometrie.py` relit les sommets et les animations du GLB final ; `mesurer.py` contrôle les normales, UV, tangentes, 89 raccords listés, la fermeture et le sens des toits et les accessoires posés. Les 36 poses sont concordantes avec GLTFLoader natif et AnimationMixer ; les cartes ne sont retirées qu’en mémoire pour ce chargement sans navigateur.

Cour libre mesurée : X de −0,130 à +0,130 m, Z de −0,100 à +0,425 m, au-dessus de la dalle Y=0,024 m. La borne continue du volet garde au moins 3,758 mm avant cette cour. La banderole conserve au moins 15,232 mm devant le toit et 10,500 mm sous les butées, sur toute sa translation linéaire. La terrasse se trouve sous la projection de l’auvent ; les jardinières sont hors des volumes des maisons. Corrections avant livraison : normales des toits retournées vers l’extérieur, jardinière sortie d’une maison, platines de charnières ajoutées, volet déplacé devant sa charnière, terre abaissée sur le fond des bacs, auvent placé sur la terrasse et rails avancés devant le toit.

Contrôle de lot et typage réussis. Mesures ciblées uniquement, aucune preuve exhaustive de non-intersection ni visibilité de toutes les unités ; transitions en jeu non évaluées. Aucun rendu, capture, contrôle visuel, approbation artistique, test général, build ou mesure FPS téléphone. Intégration et Git appartiennent au coordinateur après gel explicite.
