#!/usr/bin/env python3
"""Contrôles ciblés et synthèse de la livraison, sans rendu ni approbation artistique."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess

identifiant='unite_meca_base'
p=Path(f'tmp/production-sequentielle/{identifiant}')
sources=Path(f'scripts/production/modeles/{identifiant}')
f=json.loads((p/'fabrication.json').read_text())
g=json.loads((p/'mesures-geometrie.json').read_text())
r=json.loads((p/'mesures-rig-glb.json').read_text())
a=json.loads((p/'inspection-ancien-candidat.json').read_text())
t=json.loads((p/'textures-fabrication.json').read_text())
fichiers=[{'nom':x.name,'octets':x.stat().st_size,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted(p.iterdir()) if x.suffix in ['.glb','.png']]
assert next(x['sha256'] for x in fichiers if x['nom'].endswith('.glb'))==f['sha256Glb']
commandes=[('controle-lot.log',['npm','run','controler:asset','--','--spec',f'assets/specs/{identifiant}.json','--lot',str(p),'--json']),('typecheck.log',['npm','run','typecheck'])]
resultats={}
for nom,commande in commandes:
    print(' '.join(commande),flush=True)
    execution=subprocess.run(commande,text=True,capture_output=True)
    sortie=execution.stdout+execution.stderr
    (p/nom).write_text(sortie)
    print(sortie,flush=True)
    assert execution.returncode==0,(commande,execution.returncode)
    resultats[nom]={'commande':' '.join(commande),'codeSortie':execution.returncode,'date':datetime.now(timezone.utc).isoformat(),'journal':nom}
    if nom=='controle-lot.log':
        verdict=json.loads(execution.stdout[execution.stdout.index('{'):])
        assert verdict['ok'] and verdict['motifs']==[]
        (p/'validation-lot.json').write_text(json.dumps(verdict,ensure_ascii=False,indent=2)+'\n')
assert next(x['sha256'] for x in fichiers if x['nom'].endswith('.glb'))==hashlib.sha256((p/f'{identifiant}_lod0.glb').read_bytes()).hexdigest()
poids=sum(x['octets'] for x in fichiers)
poses=sum(c['poses'] for c in r['clips'])
rayon=max(c['rayonHorizontalMax'] for c in r['clips'])
jeux={nom:min(c['jeuxMinimumMetres'][nom] for c in r['clips']) for nom in r['neutre']['jeux']}
appui=max(v['erreurSupportMax'] for c in r['clips'] for v in c['appuis'].values())
main=max(c['geste']['mainPoigneeDistanceMax'] for c in r['clips'])
capture=next(c for c in r['clips'] if c['nom']=='capture')
rapport={
 'id':identifiant,'dateRevue':datetime.now(timezone.utc).isoformat(),'approbationArtistique':False,
 'statut':'pret_a_integrer_apres_garde_upload_et_retrait_anciens_kits_par_coordinateur',
 'provenance':{'type':'creation_originale_parametrique','outils':['Three.js','GLTFExporter','Python NumPy Pillow'],'sourcesExternes':[],'geometrieAncienneImportee':False,'texturesAnciennesImportees':False,'ancienCandidat':{'sha256Glb':a['sha256Glb'],'octetsGlb':a['octetsGlb'],'triangles':a['triangles'],'pngInspectes':len(a['png'])},'sourceDistante':'Le coordinateur a revérifié le 20 septembre 2026 : aucun upload pour unite_meca_base, kit_fr_meca et kit_lu_meca. Il conserve la garde au moment de l’activation.'},
 'fichiers':fichiers,'poidsLotOctets':poids,'octetsGlb':f['octetsGlb'],'sha256Glb':f['sha256Glb'],'triangles':f['triangles'],'budgetTriangles':4000,'primitives':f['primitives'],'materiaux':['mat_corps','mat_details'],'dimensionsMetres':r['neutre']['dimensions'],
 'silhouette':{'personnes':['porteuse à cheveux sombres, visière et lanceur à l’épaule gauche','équipier plus grand à cheveux châtains, cadre de recharges et geste de capture'],'appuis':'quatre bottes à quatre crans, deux chaînes de jambes par personne','ancrages':['plaques de tibias épaisses','capsules et cadres dorsaux à trois panneaux','caisson horizontal de marqueurs-fusées, porté à l’épaule extérieure'],'couleursEquipe':'panneaux dorsaux et crêtes des casques'},
 'rig':{'peaux':1,'os':len(r['os']),'clonesIndependants':True,'chargementNatifGLTFLoader':True,'poids':'un os par pièce rigide, chaînes de membres distinctes','racine':'identité, non animée, centre du socle au sol','axes':{'haut':'+Y','avant':'+Z'}},
 'animations':{'dureesMs':g['dureesClipsMs'],'nombrePosesMesurees':poses,'bouclesExactes':g['boucles'],'horsJeuPoseFinaleTenue':g['horsJeuTientPoseFinale'],'horsJeuIndicateurCache':g['indicateurCacheFinHorsJeu'],'rayonHorizontalMaxEchantillonne':rayon,'margeDeuxCasesVoisinesEchantillonneeMetres':1-2*rayon,'jeuxMinimumEchantillonnesMetres':jeux,'definitionJeux':r['definitionJeux'],'mainPoigneeDistanceCentresMaxMetres':main,'capture':capture['geste'],'reculMetres':next(c['reculLocalMetres'] for c in r['clips'] if c['nom']=='tir'),'plateauHauteurMetres':.018,'ecartAppuiMaxEchantillonneMetres':appui,'leveePiedMetres':.016,'piedsEllipsePlateauMaximum':max(c['piedsEllipseMax'] for c in r['clips']),'horsJeuSol':{'minimumY':next(c['enveloppe']['min'][1] for c in r['clips'] if c['nom']=='hors_jeu'),'toleranceNumeriqueMetres':1e-8,'semellesFinales':next(c['final']['semelles'] for c in r['clips'] if c['nom']=='hors_jeu')}},
 'textures':{'albedoEtNormale':[1024,1024],'rugositeMetalMasque':[512,512],'externes':True,'masqueValeurs':g['masqueValeurs'],'ecartGrisEquipe':g['albedoEquipeEcartMax'],'masqueRolesNeutres':g['masqueRolesNeutres'],'rugositeCanal':'G','metalCanal':'B','metalEditableIdentiqueCanalB':True,'normale':'+Y tangent','bakeHD':False,'albedo':'pigments et grain analytique, aucune lumière ou ombre calculée','emission':False,'margeUvAtlasPixels':g['margeAtlasPixelsMinimum']},
 'controleTechnique':{'lot':{'ok':True,'motifs':[],**resultats['controle-lot.log']},'typecheck':{'ok':True,'apresDerniereEditionTypeScript':True,**resultats['typecheck.log']},'trianglesDegeneres':g['trianglesDegeneres'],'uvTrianglesDegeneres':g['uvTrianglesDegeneres'],'trianglesSuperposes':g['trianglesSuperposes'],'normalesInversees':g['normalesInversees'],'normalesEtTangentesUnitaires':True,'tempsAnimationFloatScalarBornesConservees':g['bornesTempsAnimationConservees']},
 'limites':['Aucun rendu, capture, contrôle visuel ou approbation artistique.','Aucun test général ni build.','Pas de bake HD ; géométrie et microreliefs originaux.','Aucun téléphone réel ni relevé FPS.','Mesures de poses échantillonnées, pas de certification continue ni de mélange de clips.','Skin à segments rigides, sans déformation organique continue.','Jeux ciblés et contacts voulus de portage ; collisions internes complètes non certifiées.','Futurs kits nationaux non certifiés ; anciens kits incompatibles à archiver par le coordinateur.','Le respect artistique du ton et la lisibilité à la caméra de jeu restent à apprécier humainement.'],
 'rapports':['inspection-ancien-candidat.json','fabrication.json','textures-fabrication.json','mesures-geometrie.json','mesures-rig-glb.json','validation-lot.json','controle-lot.log','typecheck.log']
}
(p/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
dimensions=' × '.join(f'{v:.6f}' for v in r['neutre']['dimensions'])
readme=f'''# Méca — binôme original d’appui lourd

Création propre à `{identifiant}`, sans import de géométrie ni de texture de l’ancien candidat. Une porteuse aux cheveux sombres porte à l’épaule extérieure un caisson de marqueurs-fusées ; un équipier plus grand, aux cheveux châtains, porte les recharges. Leurs proportions, teints, visages fictifs, coiffures, postures et accessoires diffèrent. Plaques de tibia épaisses, bottes à quatre crans, cadres dorsaux segmentés à trois panneaux, casques à visière et plastrons arrondis donnent les volumes de l’appui lourd. Le caisson est horizontal au repos, dirigé vers +Z, avec trois embouchures obturées. Aucun projectile détaché, inscription, symbole national, marque ou personne réelle.

Un seul LOD0, sans variante saisonnière ni kit. Spécification et budget inchangés. Les anciens `kit_fr_meca` et `kit_lu_meca` ne conviennent pas aux nouveaux UV/nœuds : leur archivage et retrait d’alias appartiennent au coordinateur avant activation. Le coordinateur a reconfirmé l’absence d’upload pour ces trois fiches le 20 septembre 2026. Les actifs n’ont pas été modifiés par ce spécialiste.

## Lot figé

Staging : `{p}`. **{f['triangles']:,} triangles sur 4 000**, **{f['primitives']} primitives**, deux matériaux exacts `mat_corps` / `mat_details`. GLB + cinq PNG : **{poids:,} octets** ; GLB seul **{f['octetsGlb']:,} octets**.

SHA-256 GLB : `{f['sha256Glb']}`.

Dimensions relues : **{dimensions} m**, cible 0,45 × 0,60 × 0,45 m ± 0,06. Racine identité centrée au sol, +Y haut et +Z avant. `base` porte le plateau ovale de 18 mm de haut ; `corps` porte les deux primitives skinnées ; `module_lance_roquettes` est l’os de recul ; `socle` est le témoin escamotable. Les {len(r['os'])} os ont des noms uniques et leurs propres pivots. Les quatre semelles reposent au plateau en pose neutre.

Ancien candidat inspecté sans modification : {a['triangles']:,} triangles, {a['octetsGlb']:,} octets, SHA `{a['sha256Glb']}`. Ses {len(a['png'])} PNG ont été lus numériquement. Aucune de ces données n’entre dans la création.

## Matières et animations

Atlas 4 × 4, UV confinés dans chaque cellule, marge minimale {g['margeAtlasPixelsMinimum']:.2f} pixels en 1024². Albédo et normale 1024² ; rugosité, métal et masque 512². Pigments et microreliefs analytiques originaux : trame du tissu, peinture entretenue, métal brossé, caoutchouc, peau et cheveux. Aucun calcul de lumière ou d’occlusion dans l’albédo, aucun bake HD. Normale +Y tangent, rugosité G et métal B ; le PNG métal séparé reproduit B. Masque strictement 0/255, gris neutre sur les panneaux dorsaux et crêtes des casques ; peau, cheveux, verre, caoutchouc et métal nu sont noirs dans le masque. Le témoin ambre n’utilise pas d’émission.

- `repos`, 2 400 ms : respiration contenue et orientation discrète des têtes ; boucle exacte.
- `deplacement`, 1 000 ms : pas courts, levée du pied jusqu’à 16 mm, résolution des deux segments de jambe, un pied de chaque personne en soutien ; boucle exacte.
- `tir`, 700 ms : recul du caisson de 16 mm, réaction du torse et retour à la pose de travail. La selle et le pont restent attachés au cadre.
- `touche`, 500 ms : brève réaction des torses puis retour, sans dommage ajouté.
- `hors_jeu`, 900 ms : genoux fléchis, torse et tête inclinés, caisson abaissé avec l’épaule et témoin `socle` escamoté. Toutes les pistes tiennent la pose finale ; les semelles restent au plateau.
- `capture`, 1 300 ms : l’équipier lève le bras extérieur et confirme par un petit mouvement de l’avant-bras ; la porteuse incline la tête. Retour exact au repos, base fixe. Le coude se déplace de {capture['geste']['coudeDeplacementMax']*1000:.3f} mm depuis sa vraie position neutre, l’avant-bras tourne jusqu’à {capture['geste']['angleAvantBrasMax']:.3f} rad.

Le skin articule séparément des pièces rigides de vêtement et d’équipement ; il ne promet pas une peau organique continue. Le jeu doit déplacer la racine et conserver la dernière pose de `hors_jeu`.

## Mesures et limites

Contrôle complet du lot et `npm run typecheck` réussis après la dernière édition TypeScript ; sorties réelles conservées en staging. Aucun triangle dégénéré ou strictement dupliqué, aucune UV dégénérée, normales et tangentes unitaires et orthogonales. Temps d’animation FLOAT SCALAR avec min/max conservés, boucles parfaitement jointives, fin de `hors_jeu` tenue.

`GLTFLoader`, `SkeletonUtils.clone` et `AnimationMixer` relisent la géométrie réellement skinnée : **{poses:,} poses**, squelettes indépendants. Rayon horizontal maximal échantillonné **{rayon:.6f} m** ; marge entre deux enveloppes de cases voisines **{1-2*rayon:.6f} m** à tous bearings pour ces poses. Écart maximal du pied en soutien : **{appui*1e6:.3f} micromètres**. Les pieds restent horizontaux et dans l’ellipse du plateau. Le minimum Y global à −2,2×10⁻¹⁰ m relève de l’arrondi flottant (tolérance 10⁻⁸ m).

Jeux minimaux échantillonnés dans le repère des torses : **{jeux['lanceurCasque']*1000:.3f} mm** entre caisson et casque, **{jeux['lanceurEpaule']*1000:.3f} mm** au-dessus de l’épaule, **{jeux['lanceurGant']*1000:.3f} mm** au-dessus du gant porteur. La main reste au contact de sa poignée : distance des centres **{main*1000:.3f} mm**. Les plans séparateurs du bras de capture donnent **{jeux['brasCaptureCasque']*1000:.3f} mm** avec le casque et **{jeux['avantBrasCaptureTorse']*1000:.3f} mm** avec le torse. Les capsules conservatrices des bras intérieurs conservent **{jeux['brasInterieursCapsules']*1000:.3f} mm**. La posture du bras libre a été corrigée à partir de ces mesures. Les raccords selle/caisson, pont/épaule et gant/poignée sont des contacts voulus.

Ces mesures sont échantillonnées. Elles ne certifient pas une enveloppe continue, les mélanges de clips, toutes les collisions internes, les futurs kits nationaux ni la lisibilité artistique. **Aucun test général, build, rendu, capture, contrôle visuel ou approbation artistique. Aucun appareil réel ni relevé FPS téléphone.**

## Reproduction

Depuis la racine du dépôt :

```sh
node --import tsx {sources}/generer.ts
tmp/optimisation-lod0/python-env/bin/python {sources}/textures.py
tmp/optimisation-lod0/python-env/bin/python {sources}/mesurer.py
node --import tsx {sources}/mesurer-rig.ts
tmp/optimisation-lod0/python-env/bin/python {sources}/finaliser.py
```

`finaliser.py` exécute lui-même le contrôle ciblé `npm run controler:asset -- --spec assets/specs/{identifiant}.json --lot {p} --json` puis `npm run typecheck` et exige leur réussite avant de rédiger cette synthèse. `inspecter-ancien.py` demande le SHA historique : après remplacement, lui fournir le dossier archivé correspondant. Les SHA des six fichiers du lot sont dans `revue-technique.json`.
'''
for nombre in [f['triangles'],poids,f['octetsGlb'],a['triangles'],a['octetsGlb'],poses]:
    readme=readme.replace(f'{nombre:,}',f'{nombre:,}'.replace(',', ' '))
for dossier in [p,sources]:(dossier/'README.md').write_text(readme)
print(json.dumps({'id':identifiant,'triangles':f['triangles'],'poidsLotOctets':poids,'sha256Glb':f['sha256Glb'],'poses':poses,'jeuxMm':{k:v*1000 for k,v in jeux.items()},'ecartAppuiMicrometres':appui*1e6},ensure_ascii=False))
