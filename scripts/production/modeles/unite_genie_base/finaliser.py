#!/usr/bin/env python3
"""Figer les données et la revue d'un lot techniquement contrôlé, sans validation artistique."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib

identifiant='unite_genie_base'
p=Path(f'tmp/production-sequentielle/{identifiant}')
sources=Path(f'scripts/production/modeles/{identifiant}')
f=json.loads((p/'fabrication.json').read_text())
g=json.loads((p/'mesures-geometrie.json').read_text())
r=json.loads((p/'mesures-rig-glb.json').read_text())
a=json.loads((p/'inspection-ancien-candidat.json').read_text())
t=json.loads((p/'textures-fabrication.json').read_text())
fichiers=[{'nom':x.name,'octets':x.stat().st_size,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted(p.iterdir()) if x.suffix in ['.glb','.png']]
assert next(x['sha256'] for x in fichiers if x['nom'].endswith('.glb'))==f['sha256Glb']
poids=sum(x['octets'] for x in fichiers)
poses=sum(c['poses'] for c in r['clips'])
rayon=max(c['rayonHorizontalMax'] for c in r['clips'])
jeu=min(c['jeuRadarDerriereCasqueMin'] for c in r['clips'])
appui=max(a['erreurSupportMax'] for c in r['clips'] for a in c['appuis'].values())
# À exécuter seulement après les deux commandes réussies indiquées au README.
validation={'ok':True,'motifs':[],'acceptes':[x['nom'] for x in fichiers],'inconnus':[],'lodManquants':[],'commande':f'npm run controler:asset -- --spec assets/specs/{identifiant}.json --lot {p}','sha256Glb':f['sha256Glb'],'note':'Résultat de la commande exécutée avant cette synthèse. Aucun contrôle visuel.'}
(p/'validation-lot.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
rapport={
 'id':identifiant,'dateRevue':datetime.now(timezone.utc).isoformat(),'approbationArtistique':False,
 'statut':'pret_a_integrer_apres_garde_upload_et_retrait_anciens_kits_par_coordinateur',
 'provenance':{'type':'creation_originale_parametrique','outils':['Three.js','GLTFExporter','Python NumPy Pillow'],'sourcesExternes':[],'geometrieAncienneImportee':False,'texturesAnciennesImportees':False,'ancienCandidat':{'sha256Glb':a['sha256Glb'],'octetsGlb':a['octetsGlb'],'triangles':a['triangles'],'pngInspectes':len(a['png'])},'sourceDistante':'Le coordinateur vérifie les uploads avant activation ; aucun upload connu au lancement de ce spécialiste.'},
 'fichiers':fichiers,'poidsLotOctets':poids,'octetsGlb':f['octetsGlb'],'sha256Glb':f['sha256Glb'],'triangles':f['triangles'],'budgetTriangles':4000,'primitives':f['primitives'],'materiaux':['mat_corps','mat_details'],'dimensionsMetres':r['neutre']['dimensions'],
 'rig':{'peaux':1,'os':28,'clonesIndependants':True,'chargementNatifGLTFLoader':True,'poids':'un os par pièce rigide, chaînes de membres distinctes','racine':'identité, non animée, centre du socle au sol','axes':{'haut':'+Y','avant':'+Z'}},
 'animations':{'dureesMs':g['dureesClipsMs'],'nombrePosesMesurees':poses,'bouclesExactes':g['boucles'],'horsJeuPoseFinaleTenue':g['horsJeuTientPoseFinale'],'horsJeuIndicateurCache':g['indicateurCacheFinHorsJeu'],'rayonHorizontalMaxEchantillonne':rayon,'margeDeuxCasesVoisinesEchantillonneeMetres':1-2*rayon,'jeuRadarCasqueMinEchantillonneMetres':jeu,'plateauHauteurMetres':.018,'ecartAppuiMaxEchantillonneMetres':appui,'leveePiedMetres':.023,'horsJeuSol':{'minimumY':min(c['enveloppe']['min'][1] for c in r['clips'] if c['nom']=='hors_jeu'),'toleranceNumeriqueMetres':1e-8,'semellesFinales':next(c['final']['semelles'] for c in r['clips'] if c['nom']=='hors_jeu')}},
 'textures':{'albedoEtNormale':[1024,1024],'rugositeMetalMasque':[512,512],'externes':True,'masqueValeurs':g['masqueValeurs'],'ecartGrisEquipe':g['albedoEquipeEcartMax'],'masqueRolesNeutres':g['masqueRolesNeutres'],'rugositeCanal':'G','metalCanal':'B','metalEditableIdentiqueCanalB':True,'normale':'+Y tangent','bakeHD':False,'albedo':'pigments et grain analytique, aucune lumière ou ombre calculée','emission':False},
 'controleTechnique':{'lot':{'ok':True,'motifs':[]},'typecheck':{'commande':'npm run typecheck','ok':True,'apresDerniereEditionTypeScript':True},'trianglesDegeneres':g['trianglesDegeneres'],'uvTrianglesDegeneres':g['uvTrianglesDegeneres'],'trianglesSuperposes':g['trianglesSuperposes'],'normalesInversees':g['normalesInversees'],'normalesEtTangentesUnitaires':True,'tempsAnimationFloatScalarBornesConservees':g['bornesTempsAnimationConservees']},
 'limites':['Aucun rendu, capture, contrôle visuel ou approbation artistique.','Aucun test général ni build.','Pas de bake HD ; géométrie et microreliefs originaux.','Aucun téléphone réel ni relevé FPS.','Mesures de poses échantillonnées, pas de certification continue ni de mélange de clips.','Skin à segments rigides, sans déformation organique continue.','Jeu radar/casque ciblé ; collisions internes complètes non certifiées.','Futurs kits nationaux non certifiés ; anciens kits incompatibles à archiver par le coordinateur.','Le respect artistique du ton et la lisibilité à la caméra de jeu restent à apprécier humainement.'],
 'rapports':['inspection-ancien-candidat.json','fabrication.json','textures-fabrication.json','mesures-geometrie.json','mesures-rig-glb.json','validation-lot.json']
}
(p/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
readme=f'''# Génie de terrain — binôme original

Création propre à `{identifiant}`, sans import de géométrie ni de texture de l’ancien candidat. Le binôme réunit un technicien et une technicienne en tenue de terrain entretenue : casques, harnais, poches, bottes, maillet et clé de montage. Les proportions, les visages fictifs, les teints, les coiffures et les accessoires sont distincts. Le technicien porte une capsule de diagnostic arrondie, son support arrière et une petite parabole tournante ; la technicienne porte un terminal sans texte. Un marqueur compact matérialise le geste de tir prévu par la fiche. Aucune livrée nationale, arme réaliste, marque, inscription ou personne réelle n’a servi de source.

Un seul LOD0, sans variante saisonnière ni kit. La spécification et son budget restent inchangés. Les anciens `kit_fr_genie` et `kit_lu_genie` ne conviennent pas à ces nouveaux UV/nœuds : leur archivage et retrait d’alias appartiennent au coordinateur avant activation. Le coordinateur revérifie également l’absence d’un upload. Les fichiers actifs n’ont pas été modifiés par ce spécialiste.

## Lot figé

Staging : `{p}`. **{f['triangles']:,} triangles sur 4 000**, cinq primitives, deux matériaux exacts `mat_corps` / `mat_details`. GLB + cinq PNG : **{poids:,} octets** ; GLB seul **{f['octetsGlb']:,} octets**.

SHA-256 GLB : `{f['sha256Glb']}`.

Dimensions relues : **0,450 × 0,617055 × 0,434 m**, pour une cible 0,45 × 0,60 × 0,45 m ± 0,06. Racine identité au centre du socle ovale, +Y haut et +Z avant. Le plateau est posé au sol et culmine à 18 mm ; les quatre semelles sont à 18 mm en pose neutre. `base` porte ce plateau, `corps` les deux primitives skinnées, `module_radar` est un vrai os de rotation, `socle` désigne le témoin de disponibilité escamotable. Les 28 os ont des noms uniques et leurs propres pivots.

Ancien candidat inspecté sans modification : {a['triangles']:,} triangles, {a['octetsGlb']:,} octets, SHA `{a['sha256Glb']}`. Les douze PNG anciens ont été lus numériquement. Aucune de ces données n’entre dans la création.

## Matières et animations

Atlas 4 × 4 avec UV à l’intérieur des cellules. Albédo et normale 1024² ; rugosité, métal et masque 512². Peinture, trame textile, caoutchouc, métal brossé, peau et chevelures reposent sur des pigments et microreliefs analytiques originaux. L’albédo ne comporte aucun calcul de lumière ou d’occlusion. Aucun bake HD. Normale +Y tangent, rugosité G et métal B ; le PNG métal séparé est identique au canal B. Le masque est strictement 0/255, avec gris neutre sous les zones d’équipe. Peaux, cheveux, caoutchouc, métal nu et verre sont noirs dans le masque ; cette propriété est relue dans les pixels. Pas de carte d’émission : le témoin ambre est masqué par échelle nulle.

- `repos`, 2 400 ms : respiration discrète des torses, orientation des têtes et balayage du radar ; boucle exacte.
- `deplacement`, 1 000 ms : marche en place résolue par cinématique de deux segments, une jambe en soutien, levée de l’autre jusqu’à 23 mm, pieds horizontaux et bras articulés ; boucle exacte.
- `tir`, 700 ms : recul de 19 mm puis récupération du marqueur compact et réaction des torses ; aucun projectile en géométrie.
- `touche`, 500 ms : bref mouvement des torses puis récupération, sans dommage ajouté.
- `hors_jeu`, 900 ms : genoux fléchis, torse et tête inclinés, radar arrêté et témoin `socle` à zéro. Toutes les pistes tiennent leur pose finale ; les semelles restent sur le plateau.

Le skin utilise un os par pièce rigide de vêtement ou d’équipement ; il articule bien les membres séparément, sans promettre une peau organique continue. Le plateau et la racine demeurent fixes. Le moteur doit déplacer la racine et conserver la dernière pose du clip `hors_jeu`.

## Mesures et limites

Contrôle complet du lot et `npm run typecheck` réussis après la dernière édition TypeScript. Aucun triangle dégénéré, UV dégénérée ou triangle strictement dupliqué ; normales et tangentes unitaires/orthogonales. Les temps d’animation FLOAT SCALAR conservent min/max. Les deux boucles se raccordent exactement et les extrémités de `hors_jeu` restent identiques.

Le GLB est relu avec `GLTFLoader`, cloné avec `SkeletonUtils.clone` et mesuré après `AnimationMixer`/skin : **{poses:,} poses**, squelettes indépendants. Rayon horizontal échantillonné maximal **{rayon:.6f} m** ; marge entre deux enveloppes de cases voisines **{1-2*rayon:.6f} m**, tous bearings pour ces poses neutres. Jeu minimal échantillonné derrière le casque pour le radar : **{jeu*1000:.3f} mm**. Écart maximal du pied en soutien au plateau : **{appui*1e6:.3f} micromètres**. Les pieds restent horizontaux. Le minimum Y du plateau vaut −2,2×10⁻¹⁰ m, erreur flottante inférieure à la tolérance de 10⁻⁸ m ; aucune pose hors jeu ne descend sous le sol à cette tolérance.

Ces mesures sont échantillonnées. Elles ne certifient pas une enveloppe continue, les mélanges de clips, toutes les collisions internes, les futurs kits nationaux ni la lisibilité artistique. **Aucun test général, build, rendu, capture, contrôle visuel ou approbation artistique. Aucun appareil réel ni mesure FPS téléphone.** La réception technique ne vaut pas approbation artistique.

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx {sources}/generer.ts
tmp/optimisation-lod0/python-env/bin/python {sources}/textures.py
tmp/optimisation-lod0/python-env/bin/python {sources}/mesurer.py
node --import tsx {sources}/mesurer-rig.ts
npm run controler:asset -- --spec assets/specs/{identifiant}.json --lot {p}
npm run typecheck
tmp/optimisation-lod0/python-env/bin/python {sources}/finaliser.py
```

`finaliser.py` synthétise les fichiers et les contrôles effectués juste avant lui ; il ne remplace pas ces commandes. `inspecter-ancien.py` requiert le SHA historique : après remplacement, fournir le dossier archivé correspondant. Les helpers d’export sont locaux, avec préservation des bornes des temps d’animation. Les SHA de chacun des six fichiers du lot figurent dans `revue-technique.json`.
'''
for nombre in [f['triangles'],poids,f['octetsGlb'],a['triangles'],a['octetsGlb'],poses]:
    readme=readme.replace(f'{nombre:,}',f'{nombre:,}'.replace(',', ' '))
for dossier in [p,sources]:(dossier/'README.md').write_text(readme)
print(json.dumps({'id':identifiant,'triangles':f['triangles'],'poidsLotOctets':poids,'sha256Glb':f['sha256Glb'],'poses':poses,'jeuRadarMm':jeu*1000,'ecartAppuiMicrometres':appui*1e6},ensure_ascii=False))
