# Source de l’automate méridien

Création originale paramétrique, non dérivée d’un GLB uploadé ou du placeholder du jeu. Pas de dépendance nouvelle ajoutée au dépôt. `generer.ts` emploie Three.js et l’exportateur GLB existant ; `textures.py` et `mesurer.py` nécessitent Python 3, NumPy et Pillow.

```sh
node --import tsx scripts/production/modeles/unite_meridien_automate_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_automate_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_meridien_automate_base/mesurer.py
npm run controler:asset -- --spec assets/specs/unite_meridien_automate_base.json --lot tmp/production-sequentielle/unite_meridien_automate_base
```

Chaque script accepte un dossier de sortie en argument. Le chemin par défaut est `tmp/production-sequentielle/unite_meridien_automate_base`. La génération écrit un LOD0 unique et cinq PNG externes. Les rapports de fabrication décrivent le maillage et les matières ; la réception technique du lot ne donne aucune approbation artistique.

Géométrie : 5 892 triangles, deux matériaux, huit primitives. Pièces fonctionnelles assemblées sous sept nœuds nommés. UV0 en atlas 4 × 4 avec gouttières ; tangentes explicites. Les normales des surfaces sont mesurées contre l’orientation des triangles, sans contrôle visuel. Les matières décrivent pigment, rugosité, métal et microrelief analytique, sans calcul d’éclairage dans l’albédo.
