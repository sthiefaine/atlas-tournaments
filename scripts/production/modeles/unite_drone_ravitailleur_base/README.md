# Drone ravitailleur — création originale

`unite_drone_ravitailleur_base`, réalisé le 20 septembre 2026. Drone logistique trapu : deux rotors à quatre pales dans des carénages épais ouverts, châssis bas, capteur vitré avancé, caisse rectangulaire fermée sous le corps, connecteurs protégés et deux patins. Le bras de manutention est replié au-dessus de la caisse. La description spécifique « sans passagers » prime sur la mention générique contradictoire de nacelle d’équipage : le vitrage couvre seulement des capteurs, sans personnage ni cabine de transport. Aucun tube de tir, texte, insigne, drapeau, dommage, kit ou variante.

L’ancien candidat a été inspecté par code avant création : **776 triangles**, **92 732 octets**, SHA-256 `7bdf0646efe807002545e6864894cabd4d03bcf4577132ccdb1cba64e0374d08` ; ses **12 PNG** ont été relus. Aucun ancien GLB ou PNG n’a été modifié ou importé. L’inventaire distant communiqué ne signale aucun upload pour ce modèle ; le coordinateur effectue la dernière vérification avant intégration.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_drone_ravitailleur_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_ravitailleur_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_ravitailleur_base/mesurer.py
node --import tsx scripts/production/modeles/unite_drone_ravitailleur_base/mesurer-poses.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_ravitailleur_base/mesurer-poses.py
node --import tsx scripts/production/modeles/unite_drone_ravitailleur_base/mesurer-rig.ts
npm run controler:asset -- --spec assets/specs/unite_drone_ravitailleur_base.json --lot tmp/production-sequentielle/unite_drone_ravitailleur_base
npm run typecheck
```

Les scripts acceptent un dossier de sortie facultatif. `inspecter-ancien.py [archive]` exige l’empreinte précédente. Les helpers d’export, géométrie, atlas et mesure sont copiés localement et adaptés ; aucune dépendance de génération entre modèles. Les cinq cartes sont régénérées par NumPy/Pillow avec pigments et microreliefs analytiques déterministes, sans éclairage peint ni bake HD.

## Résultat technique

Un LOD0 à **3 008 / 3 500 triangles**, **sept primitives**, deux matériaux exacts `mat_corps` et `mat_details`. Six nœuds obligatoires uniques : `racine`, `corps`, `base`, `socle`, `module_grue`, `module_nacelle`. Deux os supplémentaires uniques : `os_rotor_gauche`, `os_rotor_droit`, inscrits dans une peau réelle sur le maillage `base`. Chaque sommet de rotor porte un poids rigide de 1 vers son propre os. Les rotors tournent autour de +Y à X ±0,225 m, Y 0,605 m, Z 0 ; les carénages restent fixes dans `corps`. Le GLB contient ces animations, sans dépendre d’un rotor procédural du moteur.

Dimensions **0,860 × 0,628 × 0,850 m**, dans les tolérances absolues de 0,09 m. Minimum statique Y **0,057 m** : la figurine est à sa hauteur de vol, conformément à `poseAuSol:false`. Origine au centre de l’emprise au sol, racine fixe identité, +Y haut et +Z avant. GLB **257 576 octets** ; GLB et cinq PNG **1 428 392 octets**. SHA-256 GLB `1fe7fd97653953437e8425d6829afc3500478063489de6c945f62208e936e22c`.

Quatre clips exacts : `repos` **2 400 ms**, `deplacement` **1 000 ms**, `touche` **500 ms**, `hors_jeu` **900 ms**. Repos et déplacement bouclent sans saut de pose. Les deux rotors sont animés dans tous les clips, en sens contraires. Hors-jeu arrête les rotors à **0,513 s**, cache l’indicateur `socle` à **0,52 s**, puis conserve la pose de l’ensemble à partir de **0,57 s**. Le bras tourne autour de sa charnière réelle ; la caisse suit un balancement discret. Aucun clip n’anime `racine`.

UV0, normales et tangentes explicites, finies et cohérentes : zéro triangle géométrique ou UV dégénéré, aucune superposition exacte par primitive, aucune normale opposée à l’orientation des triangles. Albédo et normale tangentielle +Y **1024²** ; rugosité G, métal B et masque **512²**. Masque strict 0/255, panneaux d’équipe strictement gris sous le blanc, surfaces métalliques et optiques hors du masque. PNG externes sans copie embarquée ; carte métal égale au canal B de la carte rugosité. Les bornes des entrées FLOAT SCALAR d’animation sont conservées.

**1 650 poses relues dans le GLB exporté**, indépendamment avec NumPy et Three.js, puis avec le **GLTFLoader natif**, `SkeletonUtils.clone` et `AnimationMixer`. Résultats concordants à 2 µm ; les mesures Three.js recoupent aussi la scène avant export. Le contrôle natif retire seulement les références de cartes en mémoire pour fonctionner sous Node : aucune géométrie ou piste n’est changée et aucun rendu n’est réalisé. Les squelettes clonés sont indépendants et les centres des rotors ne se déplacent pas quand leurs os tournent.

Rayon horizontal maximal échantillonné **0,439711 m**, majoration continue **0,443336 m** : au moins **113,3 mm** entre voisins neutres sous tout cap, pour chaque clip isolé. La majoration ajoute au rayon mesuré la vitesse maximale des translations et rotations multipliée par le demi-pas ; le témoin rétractable est borné séparément. Chaque peau rigide est relue par les matrices `jointWorld × inverseBindMatrix`. Le rayon des pales reste à au moins **8,70 mm** de l’intérieur facetté de son carénage pour toute rotation propre ; ce contrôle local ne certifie pas toutes les collisions internes.

**Portée : GLB neutre et gabarit runtime b=[1,1,1] seulement.** Les étirements runtime a=[.9,.98,1.06] et c=[1.14,1.06,.95] ne sont pas certifiés. Le sol est contrôlé aux poses échantillonnées ; seule l’enveloppe horizontale reçoit une majoration continue.

Contrôle de lot **ok** : six fichiers acceptés, aucun motif. Typage **ok après le dernier fichier TypeScript**. `revue-technique.json` contient les empreintes, dimensions, contrôles et limites avec `approbationArtistique:false`. Une copie du présent README est fournie dans le staging.

## Limites et remise

Aucun test général, build, rendu, capture, contrôle visuel, approbation artistique ou relevé FPS téléphone. Lisibilité à la caméra de jeu non attestée. Atlas de matières répété, vitrage opaque et microreliefs analytiques ; caisse sans contenu modélisé, bras à articulation unique et skin rigide sans simulation physique. Mélanges entre clips et collisions internes globales non certifiés.

Le spécialiste n’a écrit que dans son dossier de scripts et son staging. Les anciens fichiers, actifs publics, spécification et plan sont laissés au coordinateur, qui archive, intègre, commit et pousse. Les modifications concurrentes et la suppression indépendante de `.vscode/settings.json` sont restées intactes.
