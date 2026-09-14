# Bâtiments communs et suite française — 14 septembre 2026

## Livraison 3D

Cinq modèles originaux fabriqués dans le dépôt, en LOD0, avec PNG PBR externes. Ils sont activés dans `public/assets/modeles` après contrôle technique ; aucune approbation artistique n'est revendiquée. Aucun modèle uploadé, dont le QG, n'a été remplacé par cette fabrication.

- `batiment_ville_base` : 1 036 triangles, 1 053 265 octets ; trois maisons, portes, encadrements, banc et éclairage.
- `batiment_usine_base` : 1 164 triangles, 1 061 633 octets ; sheds, portique, palan, rideaux nervurés et pièces de rechange.
- `batiment_port_base` : 900 triangles, 1 035 413 octets ; quai en planches, bollards, cargaison et grue.
- `batiment_aeroport_base` : 996 triangles, 1 039 873 octets ; plateforme, balises et tour vitrée.
- `batiment_radar_base` : 684 triangles, 1 005 025 octets ; local technique, parabole et équipement extérieur.

Total des cinq lots : **5 195 209 octets**, soit 4,95 Mio. Les données distinctes occupent **1 176 486 octets**, soit 1,12 Mio : les textures identiques sont stockées une seule fois. Les alias de fichiers restent ceux des spécifications, y compris leurs saisons. Les GLB ne contiennent aucune copie de PNG. Les archives locales ne sont pas poussées dans git.

Production reproductible : `node --import tsx scripts/production/batiments-base.ts`. Ce script conserve les lots existants et refuse un candidat périmé ; il ne remplace pas silencieusement une nouvelle source importée. Géométrie dans `scripts/production/environnement.ts`, rapports dans `assets/livraisons/batiments-base-septembre.json` et dans chacun des cinq lots.

Les bases communes passent avant les anciens bâtiments nationaux. Le jeu et le carnet partagent une lecture GLB, les géométries et les textures ; leurs matériaux sont distincts pour éviter de les modifier ou de les détruire depuis un autre renderer. La dernière fermeture libère la source. Une marée ne libère plus des modèles que le décor réutilise. Les couleurs de camp passent par le masque, les fenêtres suivent l'ambiance, les clones translucides conservent toutes les cartes. Le radar livré utilise sa propre parabole ; l'ancienne silhouette n'est plus ajoutée par-dessus.

## Quatre étapes supplémentaires

Le parcours local contient maintenant **18 missions** : dix tutoriels, deux matchs officiels de transition et six étapes françaises. Les quatre nouvelles cartes et missions sont accessibles dans l'ordre de campagne ; les anciennes victoires restent conservées.

1. **La voie de service** (`opus1_fr_03`) — 18 × 14, 1 contre 2. Amener le transport désigné en (16:3), coordonnées affichées, avant la fin de J22. Sa perte ou celle du QG fait perdre la mission. Les QG adverses ne remplacent pas l'objectif d'escorte.
2. **Deux rives, un réseau** (`opus1_fr_04`) — 20 × 14, 2 contre 1. Prendre le QG de Solveig avant la fin de J26. Tomas couvre la rive nord ; vision et victoire communes, fonds séparés. Deux ponts, brouillard de guerre, jour permanent.
3. **Le devis orange** (`opus1_fr_05`) — 16 × 14, 1 contre 1. Mettre toutes les unités d'Ost hors jeu avant la fin de J22, sans revenu quotidien. Les réserves sont limitées. Ost est déjà connu du joueur : ce n'est pas une nouvelle première rencontre.
4. **La journée sans crédit** (`opus1_fr_06`) — 17 × 15, 1 contre 2. Garder le QG et une unité jusqu'au début de J9. Relève prévue au sud à J9, après huit journées de défense. Aucun revenu quotidien. Aucun lien familial des adversaires n'est révélé.

À la victoire de FR04, le joueur choisit **Partager les relevés** (reconnaissance du camp joueur à J2 de FR06, arrivée reportée si les cases proches sont occupées) ou **Garder la réserve financière** (1 500 fonds dès le départ de FR06). Ce choix est local au profil, enregistré avec sa version et figé dans la graine de reprise. Le nouveau chiffre est ajouté après les anciennes décisions et les bancs : les anciennes graines gardent leur signification.

Dans les quatre missions, le mode difficile donne 1 500 fonds supplémentaires à chaque camp adverse et réduit la prévision à une journée. L'allié de FR04 garde ses fonds normaux. Les dégâts et déplacements ne sont pas modifiés. Le verrou du difficile reste lié à la vraie finale `opus1_finale_18`, pas à la dernière mission actuellement livrée.

FR02 annonce maintenant le convoi de FR03 (version 2). FR06 mène vers l'enquête sur les batteries de FR07, qui reste à écrire en version jouable. Ces quatre ajouts ne livrent ni les 144 missions nationales ni les 18 finales du plan éditorial.

## Contrôles et limites

- Cinq contrôles techniques de lots réussis, avec protection contre la modification des données pendant le contrôle.
- Validation des JSON des quatre cartes et des scénarios modifiés réussie. Deux répliques de marées dépassant 240 caractères ont été raccourcies ; les 4 PV perdus restent annoncés. `qg_de_la_presquile` passe en version 9.
- Compilation de production réussie avec `NEXT_DIST_DIR=.next-build npm run build` ; avertissement préexistant de dépendances React dans `atelier.tsx`.
- Aucun test de partie, aucune simulation et aucune capture d'écran, conformément à la demande. L'équilibrage humain et l'aspect des modèles en caméra de jeu restent non vérifiés.
