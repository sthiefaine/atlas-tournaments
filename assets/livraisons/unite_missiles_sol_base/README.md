# Lance-missiles sol-sol — création originale

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

`unite_missiles_sol_base`, 20 septembre 2026. Porte-caisson original chenillé : deux pistes creuses, dix galets visibles, 92 patins caoutchoutés, plateau bas, cabine avancée +Z, caisson de huit logements sur berceau inclinable et fouet sur ressort. La silhouette remplace les six pneus et le radar du sol-air par des trains continus et une antenne latérale. Tôles à pans cassés, joints, marchepieds, attaches, essieux, rails de recul, grilles et ouvrants ont une fonction. Aucun texte, insigne, nationalité ni dommage.

## Provenance

Création paramétrique Three.js et NumPy/Pillow, sans maître HD, décimation ou transfert de normales. Helpers locaux adaptés des productions précédentes : export, formes élémentaires, atlas analytique de matières et mesures. Aucun maillage ni PNG du candidat historique n'est importé. Les pigments, reliefs de joints et de fixations, peau d'orange de peinture, caoutchouc moulé, brossage et rugosités sont calculés sans lumière, ombre, reflet ou occlusion peinte.

Le coordinateur a confirmé l'absence d'upload par lecture authentifiée le **20 septembre 2026 à 14:11:25 UTC**. Ancien candidat inspecté par code avant création : **1 112 triangles**, **133 664 octets**, SHA-256 `d5560e1609dcbeb4fab3b7df545dcc81732985c9197c7c41223a3d63ed05a08e` ; **dix PNG** inspectés, inchangés. Aucun actif ni kit précédent déclaré. Aucun secret recopié. Le coordinateur revalide les sources avant intégration.

## Reproduction

Depuis la racine du dépôt, tous les scripts acceptent un dossier de staging facultatif. `inspecter-ancien.py [archive] [staging]` accepte d'abord le dossier du candidat historique ; après intégration, lui passer l'archive d'origine, sinon sa garde SHA refusera le modèle remplacé.

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/unite_missiles_sol_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/mesurer.py
node --import tsx scripts/production/modeles/unite_missiles_sol_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/mesurer-poses.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/mesurer-gabarit-a.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/mesurer-jeux.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/verifier.py
cp scripts/production/modeles/unite_missiles_sol_base/README.md tmp/production-sequentielle/unite_missiles_sol_base/README.md
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_missiles_sol_base/assembler-revue.py
```

`verifier.py` lance le contrôle de lot de cette fiche et `npm run typecheck`, conserve leurs sorties et les SHA des sources TypeScript. Aucun test général ni build.

## Résultat mesuré

Un LOD0 de **8 980 / 9 000 triangles**, huit primitives, deux matériaux `mat_corps` et `mat_details`, sept nœuds dont les six requis et `os_recul`. GLB **667 220 octets**, GLB et cinq PNG **1 837 485 octets**. SHA-256 GLB : `5c34035746fd011133f0daa72e0734073aeb12de142401617055338842ae2980`.

Dimensions réelles **0,652 × 0,631004 × 0,903 m**, racine identité, emprise centrée, bas des deux trains à Y=0, avant +Z et haut +Y. Albedo et normale 1024² ; rugosité, métal et masque 512². PNG externes sans copie embarquée. Masque strict 0/255, gris neutre sous les pixels blancs ; verre, métal et caoutchouc hors masque. Rugosité en G, métal en B identique au PNG métal éditable. Témoin ambré non lumineux, escamoté hors jeu.

Les clips `repos` 2400 ms et `deplacement` 1000 ms oscillent le fouet ; le second anime aussi la suspension verticale. `tir` 700 ms incline le caisson, recule de 13 mm puis récupère la pose. `touche` 500 ms tasse brièvement le corps et bascule légèrement le module. `hors_jeu` 900 ms tasse et parque l'équipement, masque le témoin et tient sa pose finale. Aucune piste sur la racine. Boucles raccordées en pose et vitesse ; temps FLOAT SCALAR strictement croissants avec min/max conservés.

GLB final : normales, UV0 et tangentes finis, aucune face géométrique ou UV dégénérée, aucune normale inversée selon le winding ni face superposée au sein d'une primitive. **976 poses** relues indépendamment avec Three.js et NumPy, accord à 2 µm. En gabarit **b**, rayon horizontal échantillonné **0,496835 m**, majoration continue **0,498268 m**, soit au moins **3,464 mm** entre deux voisins orientés arbitrairement, chaque clip isolé.

Le runtime emploie `a` quand l'unité manque au style : `S(0,9 ; 0,98 ; 1,06) × RY(π/2)` dans `conformerModele`. Mesure séparée de **976 poses** : rayon échantillonné **0,477358 m**, majoration continue **0,478877 m**, espace minimal de deux voisins **42,246 mm**. Les bornes continues utilisent une vitesse maximale de déplacement des sommets et le demi-pas ; le témoin rétractable est borné séparément par sa sphère locale. Le gabarit `c` n'est pas certifié.

## Contrôles mécaniques ciblés

**41 distances localisées entre triangles** sont positives. Galets et pistes sont séparés ; les galets voisins ne se recouvrent plus. Deux trains et 92 patins ; garde chenille/patins au tassement **10,496 mm**. Quatre coulisseaux dans des fourreaux creux : engagement minimal **10,500 mm**, jeu radial **4,347 mm**. Les semelles du caisson sont en contact intentionnel avec les rails et le plancher, sans suspension de la pièce dans le vide.

Le ressort possède trois tours, un fil de 8,4 mm et un fouet de 21 mm. **243 couples de portions** proches en angle mais séparées dans la chaîne ont au moins **11,022 mm** de jeu ; ressort/âme **5,517 mm**. Les collerettes reçoivent les extrémités. Les vitrages sont alignés sur les pans réels de cabine, avec dos encastré de **1,792 à 2,679 mm**.

**136 sondes** dans les huit ouvertures, interrogeant tous les triangles du véhicule, atteignent les fonds à **426 mm** depuis leur origine. Aux deux clés de tir maximal (180 et 240 ms), **272 sondes sortantes** restent libres sur **650 mm**, y compris devant la cabine. Les logements sont ouverts sans projectile. Le caisson se relève pour tirer ; cette mesure ne prétend pas donner la position de l'effet de bouche du moteur.

Débattements des cinq clips : caisson/cabine ≥ **71,037 mm**, caisson/antenne ≥ **11,969 mm**, caisson/plancher ≥ **36,786 mm** ; séparation latérale de l'antenne sous le toit par rapport à la cabine ≥ **10,429 mm**. Ce sont des plans séparateurs des enveloppes aux poses, pas une certification globale des collisions internes.

Corrections avant gel : segments et quincaillerie bornés au budget ; galets internes ramenés à 50 mm de rayon et Y=82 mm pour supprimer leur recouvrement avec les roues terminales ; patins des courbes raccourcis pour faire porter les semelles basses ; plateau suspendu relevé de 20 mm ; semelles du caisson raccordées aux rails ; antenne décalée de 25 mm sur son support pour conserver le jeu latéral à la cabine. Contrôle de lot et typage réussis après les dernières modifications TypeScript.

## Limites

`approbationArtistique: false`. Aucun rendu, capture, image, contrôle visuel, appréciation à 48 px/m, test général, build, téléphone ou FPS. Enveloppes `a` et `b` seulement ; `c`, transitions et mélanges de clips exclus. Chenilles et galets rigides ; suspension corporelle seulement. Distances mécaniques localisées, sondes ponctuelles des ouvertures, aucun contrôle global des intersections. Les pièces de raccord ont des recouvrements intentionnels. Vitrages opaques, atlas de matières répété, pas de maître HD ou nouveau bake. Le comportement des effets de tir, leur bouche et la lisibilité en jeu restent à apprécier humainement.

Le spécialiste écrit uniquement dans les sources de cette fiche et son staging. Aucun lot officiel, actif, alias, registre, plan, fichier partagé ou Git modifié. Le coordinateur archive, intègre, commit, pousse et vérifie la publication.
