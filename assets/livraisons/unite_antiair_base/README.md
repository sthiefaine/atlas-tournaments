# Anti-air — candidat LOD0 du 13 septembre 2026

Sept fichiers : un GLB et six PNG externes. **569 911 octets (556,6 Kio)** hors rapports et archive.

- **4 040 triangles / 6 000**, deux matériaux : `mat_corps`, `mat_details`.
- Dimensions au repos : **0,620 × 0,503 × 0,850 m** ; sol Y = 0, empreinte centrée, +Y haut, +Z avant.
- Six nœuds et attaches conservés. Cinq clips, durées et intentions de boucle inchangées ; racine jamais animée. `hors_jeu` replie le radar et masque l’indicateur.
- Tubes, galets et radar davantage subdivisés ; normales lisses sur les courbes, arêtes franches sur les plaques. Les positions et proportions restent identiques.
- Les six PNG existants sont conservés à l’octet près. Atlas logique 16×16 inchangé ; aucun habillage national ajouté. La subdivision modifie la topologie de cette base candidate : les kits existants ne sont pas réécrits ni approuvés par cette commande.
- Masque noir/blanc contrôlé ; albédo gris sous les zones d’équipe ; rugosité en G, métal en B. Aucun PNG embarqué.

## Réception

`validation-lot.json` : **ok**, aucun motif de refus. `reperes.json` contient les mesures projetées des chenilles/coque, des deux tubes séparés et du radar aux vues dessus, trois-quarts et 65°, à 48 px/m. Ces mesures ne prouvent pas la lisibilité artistique.

Candidat intégré dans `/admin/assets/unite_antiair_base`, section **Candidat disponible à inspecter**. Le modèle actif et les kits restent inchangés. Aucune approbation artistique ni absence d’éclairage peint n’est déduite du contrôle technique. La revue humaine des trois vues, matériaux et animations reste à effectuer dans l’inspecteur.

## Reproduction

```sh
node --import tsx scripts/generer-antiair.ts
npm run controler:asset -- --spec assets/specs/unite_antiair_base.json --lot assets/livraisons/unite_antiair_base
node --import tsx scripts/antiair/integrer.ts
```

Le générateur réutilise les PNG du lot, ou ceux du modèle actif si le lot est initialement vide. Le script d’intégration ne publie que ce candidat, après contrôle, par données adressées par empreinte. Il ne remplace pas automatiquement le modèle en jeu.
