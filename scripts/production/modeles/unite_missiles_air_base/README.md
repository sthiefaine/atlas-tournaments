# Lance-missiles sol-air — création originale

`unite_missiles_air_base`, 20 septembre 2026. Camion de compétition original à six roues et pneus larges, cabine avancée +Z, plateau bas, caisson à six logements de marqueurs creux sur berceau inclinable et radar tournant. Les cellules portent une lentille au fond, sans projectile mobile. Panneaux entretenus, caoutchouc moulé, tôles à pans cassés, moyeux, essieux et marchepieds. Aucun texte, insigne, nationalité ni dommage.

## Provenance

Création paramétrique Three.js et Python NumPy/Pillow, sans source HD, décimation ni bake. Les helpers d'export, de formes élémentaires, d'atlas de matières et de mesure des modèles précédents ont été adaptés localement ; aucune géométrie ou PNG du candidat historique n'est importé. Les cartes sont calculées par une recette analytique partagée, sans lumière, ombre ou reflet peint.

Le coordinateur a confirmé l'absence d'upload par lecture authentifiée le **20 septembre 2026 à 13:51:44 UTC**. Ancien candidat relu par code avant production : **884 triangles**, **108 020 octets**, SHA-256 `1241976e5a1980b8cbe56ec9b5f5c0772025d7013e1b7259b03646b486aa53e8` ; **12 PNG inspectés**, inchangés. Aucun maître ou actif antérieur revendiqué. Le coordinateur doit revérifier le dépôt avant intégration ; aucun secret n'est recopié ici.

## Reproduction

Depuis la racine du dépôt, chaque script accepte un dossier de staging facultatif, sauf `inspecter-ancien.py [archive] [staging]` qui accepte d'abord le dossier du candidat historique (par défaut son emplacement d'origine). Après intégration, cette inspection doit utiliser l'archive d'origine ou échouera volontairement sur le SHA attendu.

```sh
node --import tsx scripts/production/modeles/unite_missiles_air_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_air_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_air_base/mesurer.py
node --import tsx scripts/production/modeles/unite_missiles_air_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_air_base/mesurer-poses.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_air_base/mesurer-jeux.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_air_base/verifier.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_air_base/assembler-revue.py
```

`verifier.py` appelle uniquement le contrôle de lot de cette fiche et `npm run typecheck`, enregistre leurs sorties et les SHA TypeScript. Aucune suite de tests ni build.

## Livraison mesurée

Un LOD0 : **8 868 / 9 000 triangles**, **8 primitives**, deux matériaux `mat_corps`/`mat_details`, sept nœuds dont les six imposés et `os_recul`. GLB **647 736 octets**, GLB + cinq PNG **1 818 001 octets**. SHA-256 GLB : `8c6bbd12e3e7664e58048417dea508eec2667a70e686fed6f1f7b0ab03072451`.

Dimensions réelles **0,655 × 0,630681 × 0,911 m**, racine identité, empreinte centrée et six pneus au sol. Cabine +Z, haut +Y. Albedo et normale 1024², rugosité/métal/masque 512² ; PNG externes uniquement. Masque strict 0/255, albédo gris sous le blanc, verre/caoutchouc/métal hors masque. La rugosité lit G et le métal B, identique au PNG métal éditable. Pas de carte d'émission : le témoin ambré est non lumineux et s'escamote hors jeu.

Cinq clips : `repos` 2400 ms, `deplacement` 1000 ms, `tir` 700 ms, `touche` 500 ms et `hors_jeu` 900 ms. Radar balayant un tour au repos/en déplacement, suspension verticale du corps, inclinaison et recul du caisson au tir, tassement puis maintien de la pose hors jeu avec témoin caché. Boucles raccordées en pose et vitesse ; temps FLOAT SCALAR strictement croissants avec bornes min/max conservées. Pas de piste racine.

Contrôles du GLB final : aucune face géométrique ou UV dégénérée, normale inversée ou face superposée dans une primitive ; UV0, normales et tangentes finies. **976 poses** relues indépendamment par Three.js et NumPy, accord à 2 µm. Rayon horizontal échantillonné **0,483450366 m**, majoration continue par vitesse **0,485401619 m** : au moins **29,197 mm** entre deux voisins orientés arbitrairement, pour chaque clip isolé en gabarit neutre `b=[1,1,1]`.

Contrôles mécaniques localisés : **26 distances entre triangles**, six pneus séparés, **7 mm** de garde au garde-boue au tassement maximal, suspensions à fourreaux creux avec **33,500 mm** d'engagement minimal et **3,864 mm** de jeu radial. Les vitres suivent les plans réels de cabine, dos encastré d'environ 2 mm et face extérieure. **102 rayons** dans les six ouvertures atteignent le fond à **414 mm** depuis leur départ, en interrogeant tous les triangles du véhicule. L'axe du berceau reste sous les cellules. Aux poses contrôlées : caisson/cabine ≥ **66,195 mm**, caisson/radar ≥ **87,571 mm**, caisson/plancher ≥ **23,757 mm**.

Le premier calcul dépassait le budget ; les segments des pneus, les boulons et les doubles chanfreins ont été réduits sans retirer les six roues ou les cellules. Chanfreins des tôles minces bornés pour supprimer les faces dégénérées ; vitres recalées sur les vrais plans ; rails et axe abaissés sous les cellules avant livraison. Le contrôle de lot et le typage passent après ces corrections.

## Limites

`approbationArtistique: false`. Aucun rendu, capture, image, contrôle visuel, appréciation à 48 px/m, test général, build, téléphone ou FPS. Les gabarits nationaux `a`/`c`, leurs déformations et les transitions entre clips ne sont pas certifiés. Les distances sont localisées ; raccords mécaniques intentionnels, pas de certification globale des intersections internes. Les roues restent fixes, seule la suspension du corps bouge. Vitrages opaques, atlas de matières répété, aucun transfert HD. Les sondes d'ouverture sont ponctuelles ; l'enveloppe radiale est majorée continûment mais les dégagements mobiles sont échantillonnés. Les effets de tir et leur bouche restent à apprécier en jeu.

Le spécialiste écrit seulement les sources de ce modèle et son staging. Aucun lot officiel, alias, registre, plan ou fichier partagé modifié ; aucune opération Git. Le coordinateur archive, intègre, commit, pousse et vérifie la publication.
