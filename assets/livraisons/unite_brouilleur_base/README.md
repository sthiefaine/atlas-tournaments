# Brouilleur mobile — création originale

Intégré dans le jeu après contrôle technique ; qualité artistique non vérifiée.

`unite_brouilleur_base`, réalisé le 20 septembre 2026. Six pneus tout-terrain à crampons, cabine avancée, plateau bas, coffrets ventilés, parabole concave à double peau et récepteur porté par trois bras, fouet sur ressort à trois tours. Aucun canon, texte, symbole, livrée nationale ni dommage. +Y haut, +Z avant, origine au centre du sol, racine identité.

Provenance : création Three.js/TypeScript et Python NumPy/Pillow. Helpers locaux d’export, d’atlas et de mesure repris ; aucune géométrie ou texture importée. Ancien candidat inspecté par code : **632 triangles**, **79 508 octets**, SHA-256 `ad807880142fa7768789d7c0361aee2088e09a4a4c91b08ebc4f1de38f144231` ; 12 PNG relus sans modification. Aucun upload identifié dans l’inventaire distant communiqué ; le coordinateur revérifie avant intégration.

## Reproduction

```sh
node --import tsx scripts/production/modeles/unite_brouilleur_base/generer.ts
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_brouilleur_base/textures.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_brouilleur_base/mesurer.py
tmp/optimisation-lod0/python-env/bin/python scripts/production/modeles/unite_brouilleur_base/mesurer-poses.py
npm run controler:asset -- --spec assets/specs/unite_brouilleur_base.json --lot tmp/production-sequentielle/unite_brouilleur_base
npm run typecheck
```

Chaque script accepte un dossier facultatif. `inspecter-ancien.py [archive]` exige l’ancienne empreinte avant lecture.

## Livraison et mesures

Un LOD0 à **5 992 / 6 000 triangles**, **six primitives**, deux matériaux et les six nœuds exacts. Dimensions **0,632 × 0,51641 × 0,85 m**. GLB **422 316 octets**, lot GLB + six PNG **1 592 723 octets**. SHA-256 `16c9253c23c61c1d09507f94b5f682d5ffc588a323f153e9c552450dbf337c77`.

Quatre clips de 2 400/1 000/500/900 ms. Repos et déplacement ferment leurs boucles ; radar et antenne animés dans chaque clip. Hors-jeu abaisse le corps, rabat la parabole et le fouet, cache le seul témoin émissif et tient sa pose de 0,6 à 0,9 s. Aucune piste sur la racine.

UV0, normales et tangentes explicites ; aucune face géométrique ou UV dégénérée, normale inversée ou superposition exacte dans une primitive. Cartes externes 1024²/512², masque strict 0/255, albédo gris sous le blanc, rugosité G et métal B identique au PNG métal. Émission réservée à `socle` et masquée hors-jeu. Microreliefs analytiques sans éclairage peint, aucun bake HD.

**779 poses GLB** relues indépendamment avec NumPy, concordance Three.js à 2 µm. Rayon maximal mesuré 0,497608 m ; majoration continue **0.498427327 m**, soit au moins **3.145 mm** entre voisins sous tout cap pour chaque clip isolé. Radar balayé à 360°, borne continue 0,495762 m. Concavité mesurée 50 mm et épaisseur 12 mm ; ressort au pas de 24 mm, fil de 22,2 mm. Contrôle du lot `ok` (sept fichiers, aucun motif) et typage réussi après la dernière modification TypeScript.

Rapport de synthèse : `tmp/production-sequentielle/unite_brouilleur_base/revue-technique.json`, avec les renvois vers six rapports de fabrication/mesure et le verdict technique. Budget initial 6 712 corrigé ; ressort resserré à trois tours pour supprimer le recouvrement entre spires, liaison supérieure ajoutée.

## Correction du format glTF — 20 septembre 2026

`alleger()` conserve maintenant les bornes `min`/`max` des sept accesseurs FLOAT SCALAR qui portent les temps d’animation. La comparaison avec l’actif précédent démontre **quatorze champs JSON ajoutés seulement**, un **BIN entier identique** et **six PNG identiques à l’octet**. Les bornes sont relues dans les valeurs temporelles du BIN. Le GLB gagne 212 octets ; géométrie, UV, noms, clips et valeurs restent identiques.

`correction-format.json` conserve les deux SHA et poids, le SHA du BIN, les quatorze chemins JSON et les six empreintes PNG. Le contrôle de lot renforcé et `npm run typecheck` passent après correction, sans suite de tests ni rendu. Le présent README est aussi fourni dans le staging.

## Limites

`approbationArtistique: false`. Aucun test général, build, rendu, capture, contrôle visuel, service payant ou FPS téléphone. Lisibilité à 48 px/m à apprécier. Vitrages opaques, atlas de matières répété. Roues fixes ; suspension du corps. Fouet courbe animé par son pied, sans peau souple. Les enveloppes ne certifient pas les intersections internes ou les mélanges entre clips.

Le coordinateur archive, intègre et pousse. Aucune spécification, plan, actif, lot final, commit ou push modifié par le spécialiste.
