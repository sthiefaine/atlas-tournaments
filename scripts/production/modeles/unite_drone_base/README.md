# Drone d’observation — création originale

`unite_drone_base`, réalisé le 20 septembre 2026. Petit drone sans pilote : plateau bas octogonal, batteries latérales, nacelle optique avancée opaque, objectif et capteurs stéréo en relief, train à patins et rotor quadripale sur mât. Fouet épais sur ressort à deux tours. Aucun texte, insigne, drapeau réel ni dommage ; aucune queue ou cabine habitée. +Y haut, +Z avant, racine fixe identité, aérien `poseAuSol:false`.

Ancien candidat inspecté par code avant création : **512 triangles**, **63 048 octets**, SHA-256 `0fe3811f7ef306039c5b2fd96d4c8b13c7f95cbf331d20824a690275e3e5cdea` ; **10 PNG** relus. Aucun de ces fichiers n’a été modifié ou importé. Aucun upload signalé dans l’inventaire distant communiqué ; contrôle ultime réservé au coordinateur.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_drone_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_base/mesurer.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_drone_base/mesurer-poses.py
npm run controler:asset -- --spec assets/specs/unite_drone_base.json --lot tmp/production-sequentielle/unite_drone_base
npm run typecheck
```

Scripts autonomes dans `scripts/production/modeles/unite_drone_base/`, helpers locaux copiés. Chaque script accepte un dossier facultatif ; `inspecter-ancien.py [archive]` exige l’ancienne empreinte. Textures procédurales reproductibles NumPy/Pillow ; aucune dépendance vers un autre modèle, aucun service externe, aucun bake HD.

## Résultat technique

Un LOD0 à **3 188 / 3 500 triangles**, **cinq primitives**, deux matériaux exacts, cinq nœuds exacts. Dimensions **0,896 × 0,684365 × 0,896 m**, conformes aux tolérances ; le bas du train est à 0,072635 m au repos statique. GLB **220 500 octets**, GLB + cinq PNG **1,389,892 octets**. SHA-256 `706f28c6f7bfba4e451b6961397e8f27483fbe9e9ecc39ef3864981ea469f219`.

Quatre clips exacts de 2 400 / 1 000 / 500 / 900 ms ; aucune animation `tir`. `base` anime les quatre pales dans le GLB, y compris repos ; le runtime n’a pas à relancer un rotor procédural. Repos/déplacement ferment leurs boucles. Hors-jeu abaisse le corps sur ses patins, arrête le rotor à 0,594 s, masque le seul indicateur `socle`, puis conserve sa pose après 0,6 s ; point bas final à 3 mm du sol. Racine jamais animée.

UV0, normales et tangentes explicites, finies, unitaires/orthogonales. Aucune face géométrique ou UV dégénérée, normale inversée ou superposition exacte dans une primitive. Albédo et normale +Y 1024², rugosité G et métal B avec PNG métal correspondant 512², masque 512² strict 0/255 ; gris strict sous le blanc. PNG externes sans copie embarquée ni saison, pigments sans éclairage peint et microreliefs analytiques.

**849 poses du GLB** reconstituées avec NumPy indépendamment de Three.js, résultats concordants à 2 µm. Rayon horizontal maximal mesuré **0,466159 m**, majoration continue **0,468183 m**, soit au moins **63,6 mm** entre deux voisins neutres sous tout cap, pour chaque clip isolé. Rotor traité analytiquement sur toute sa rotation par `rho + |y| sin(theta)` ; autres pièces majorées par vitesse d’articulation et demi-pas. **Portée : GLB neutre et gabarit b=[1,1,1] seulement**. Les déformations runtime `a=[.9,.98,1.06]` et `c=[1.14,1.06,.95]` ne sont pas certifiées par cette mesure.

Contrôle du lot **ok**, six fichiers et aucun motif ; typage final **ok** après la dernière modification TypeScript. `revue-technique.json` porte `id:unite_drone_base` et `approbationArtistique:false` dans le staging avec ce README.

## Limites et remise

Aucun test général, build, rendu, capture, contrôle visuel, appréciation artistique ou FPS téléphone. Lisibilité à caméra de jeu non attestée. Verres opaques sans intérieur, atlas de matières répété. Mouvement rigide du fouet au pied et des patins ; arrêt de rotor sans simulation physique. Mélanges entre clips, intersections internes et gabarits nationaux non certifiés.

Le coordinateur archive, intègre, commit et pousse. Aucune spécification, plan, actif public, lot final ou modification Git n’a été écrit par ce spécialiste hors sources/staging du drone. La suppression indépendante de `.vscode/settings.json` est laissée intacte.
