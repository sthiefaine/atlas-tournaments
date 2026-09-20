# Station radar commune — source originale

Création paramétrique indépendante du candidat historique. La lecture distante authentifiée transmise par le coordinateur, le 20 septembre 2026 à 16:22:21 UTC, ne contient aucun dépôt ; la recherche locale n’a trouvé aucun maître dédié. Ancien actif/candidat : `cf3e5f30e142acbdc4019c1cc30d1317dff872ef25919e7ac571ed34607cf8c5`, 684 triangles, 81 260 octets. Son GLB et ses quinze PNG ont été inspectés par code puis conservés.

Le LOD0 comprend une cabine basse, une dalle avec rampe frontale intégrée, une parabole concave de rayon 245 mm avec dos à 18 mm, couronne, six nervures et récepteur fixé par trois bras. Le moteur pivote autour de Y ; `racine`, `corps` et `toit` restent fixes. L’extra racine `atlasAnimationsBatiment: true` active le raccordement existant des bâtiments : repos 3,2 s, capture 1,4 s par indicateur coulissant, pause du radar neutre, du brouillard et du mode réduit.

4 852 triangles, cinq primitives, deux matériaux ; dimensions 0,860 × 0,757460 × 0,860 m. Le GLB de 311 644 octets et cinq PNG externes totalisent 1 677 244 octets. Les textures ont un atlas 4 × 4 avec gouttières : béton, réflecteur peint, équipe grise, métal, vitres et équipements. Rugosité dans G, métal dans B, normales +Y ; émission seulement sur vitres et indicateurs. Les microreliefs sont analytiques : aucun bake HD ni éclairage dans l’albédo n’est revendiqué.

Reproduction depuis la racine du dépôt :

```sh
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_radar_base/inspecter-ancien.py
npx tsx scripts/production/modeles/batiment_radar_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_radar_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/batiment_radar_base/mesurer.py
npx tsx scripts/production/modeles/batiment_radar_base/mesurer-natif.ts
npm run controler:asset -- --spec assets/specs/batiment_radar_base.json --lot tmp/production-sequentielle/batiment_radar_base
npm run typecheck -- --incremental false
```

`gltf.ts` reprend l’exporteur local du port et conserve min/max des positions et des temps d’animation. `geometrie.py` relit les accesseurs et interpole les quaternions ; `mesurer.py` vérifie 66 raccords, le winding, les 16 sondes de cavité, les UV/normales/tangentes et 40 poses. `mesurer-natif.ts` confirme ces poses avec GLTFLoader sans moteur de rendu. Les majorants continus établissent un rayon mobile de 263,126 mm et une garde parabole/toit de 45,667 mm. La course de capture garde 6 mm devant sa butée.

Les comptes rendus et empreintes se trouvent dans le staging. Contrôles géométriques ciblés seulement, sans certification exhaustive des collisions ni de visibilité. Aucune image, inspection visuelle, approbation artistique, suite de tests, build ou mesure FPS. Le coordinateur est seul responsable de l’archivage, de l’intégration et de Git.
