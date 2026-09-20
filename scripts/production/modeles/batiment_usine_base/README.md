# Usine commune — source originale

Création paramétrique indépendante pour `batiment_usine_base`. Le coordinateur a confirmé la lecture authentifiée distante réussie du 20 septembre 2026 à 16:45:12.134 UTC : aucun dépôt. Aucun maître local dédié identifié. L’ancien actif/candidat SHA `e0ef8956fdd8eb1fb1d45c7dd2ba422ad793536e147ed66be0f030c192a7ee9c` (1 164 triangles, 137 868 octets) et quinze PNG historiques ont été inspectés par code sans réutilisation ni modification.

Halle unique creuse en béton clair, trois sheds dont les verrières regardent −Z, rideau métallique fermé vers +Z. Portique à poutre en I sur le flanc droit, chariot à quatre galets et axes, palan, onze maillons alternés, crochet à section fermée. À gauche : trois caisses, une palette et trois galets de rechange, râtelier et outils. L’approche frontale reste plane et libre au-delà de Z=0,230 m. Le rideau et les rives de toit utilisent le masque équipe blanc sur gris neutre. Aucun symbole ni texte.

Le LOD0 compte **5 572 triangles, six primitives et deux matériaux**, mesure **0,90 × 0,809 × 0,90 m**, et pèse **453 348 octets**. Les cinq PNG portent le total à **1 820 188 octets**. Atlas 4 × 4 avec gouttières et domaines de matière séparés ; béton, tôle, peinture, métal, bois, caoutchouc et verre. Les joints de béton restent exclusivement dans le domaine béton. Normales +Y ; rugosité G, métal B ; émission des verrières et du luminaire uniquement. Grain et microreliefs analytiques, sans bake HD ni éclairage peint.

`racine`, `corps` et `toit` restent fixes. `repos` boucle en 3,2 s et translate le chariot de ±44 mm suivant Z. `capture` dure 1,4 s et translate un petit indicateur de 45 mm suivant X, puis revient au travail. L’extra racine `atlasAnimationsBatiment: true` utilise le runtime existant ; aucun fichier de rendu n’est modifié ici.

Depuis la racine du dépôt, avant remplacement du candidat :

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_usine_base/inspecter-ancien.py
node --import tsx scripts/production/modeles/batiment_usine_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_usine_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_usine_base/mesurer.py
node --import tsx scripts/production/modeles/batiment_usine_base/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/batiment_usine_base.json --lot tmp/production-sequentielle/batiment_usine_base
npm run typecheck -- --incremental false
```

`gltf.ts` reprend l’exporteur local récent, avec min/max conservés sur les temps FLOAT SCALAR. `geometrie.py` lit le binaire final, `mesurer.py` contrôle 76 raccords listés, les sondes de la halle et des verrières, les normales/UV/tangentes, la chaîne et la fermeture du crochet. Quarante poses sont comparées avec GLTFLoader et AnimationMixer, sans moteur de rendu. Les translations LINEAR ont leurs extrêmes aux clés : garde continue chariot/halle 45,500 mm, chariot/butées 154,500 mm, crochet/sol >19 cm. La distance minimale entre surfaces de maillons voisins est 1,357 mm ; la chaîne est stylisée et n’est pas une simulation physique.

Les rapports et SHA sont dans le staging. Mesures ciblées, sans preuve exhaustive de non-intersection ni de visibilité de toutes les unités. Aucun rendu, capture, contrôle visuel, approbation artistique, test général, build ou relevé FPS. Le coordinateur possède l’intégration, l’archivage et Git.
