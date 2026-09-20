#!/usr/bin/env python3
"""Rassemble uniquement des faits mesurés et les limites de contrôle."""
from pathlib import Path
import hashlib,json,subprocess
from datetime import datetime,timezone
id='unite_meridien_veilleur_base'
sortie=Path('tmp/production-sequentielle')/id
lire=lambda n:json.loads((sortie/n).read_text())
f=lire('fabrication.json');poses=lire('mesures-poses-glb.json');geometrie=lire('mesures-geometrie.json');jeux=lire('mesures-degagements.json');ressort=lire('mesures-ressort.json');rig=lire('mesures-rig-glb.json')
files=[sortie/f'{id}_lod0.glb',*sorted(sortie.glob(f'{id}_*.png'))]
assert len(files)==6
fichiers=[{'nom':p.name,'octets':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
assert f['sha256Glb']==fichiers[0]['sha256']
assert all(r['exitCode']==0 for r in lire('executions.json')['commandes'])
rapport={'id':id,'date':datetime.now(timezone.utc).isoformat(),'approbationArtistique':False,'source':f['provenance'],'inspectionPrealable':'inspection-ancien-candidat.json','sha256Glb':f['sha256Glb'],'triangles':geometrie['triangles'],'budgetTriangles':6000,'primitives':geometrie['primitives'],'materiaux':geometrie['materiaux'],'octetsGlb':files[0].stat().st_size,'octetsLot':sum(p.stat().st_size for p in files),'fichiers':fichiers,'dimensionsMetres':poses['bornesStatiques']['dimensions'],'hauteurNeutrePatinsMetres':jeux['gardeAuSolNeutreMetres'],'clips':geometrie['dureesClipsMs'],'controleTechnique':'ok','typage':'ok','posesExportees':sum(c['nombreEchantillons'] for c in poses['clips']),'rayonHorizontalMesureMetres':max(c['rayonHorizontalMax'] for c in poses['clips']),'rayonHorizontalMajoreMetres':max(c['rayonHorizontalMajorationContinue'] for c in poses['clips']),'rotorsClonesIndependants':rig['squelettesClonesIndependants'],'jeuEntreDisquesMetres':rig['jeuEntreDisques'],'posesMecaniques':jeux['posesMecaniques'],'nombreDegagementsMecaniques':len(jeux['separationsAnneauxBalayesPiecesMetres']),'jeuMecaniqueMinimalMetres':min(jeux['separationsAnneauxBalayesPiecesMetres'].values()),'jeuRadarAntenneMetres':jeux['jeuMinimalRadarAntenneMetres'],'jeuRadarCapsuleMetres':jeux['jeuVerticalMinimalRadarCapsuleMetres'],'ressort':{'jeuAmeMetres':ressort['jeuAmeBorneInferieureMetres'],'jeuSpiresMetres':ressort['jeuEntreSpiresMetres'],'intersectionsSpires':ressort['intersectionsEntreSpires']},'integration':'À effectuer par le coordinateur ; aucune écriture du spécialiste dans les lots ou alias actifs.','limites':['Création originale paramétrique ; aucun master HD ou bake de transfert.','Gabarit neutre b utilisé par atl seulement.','Aucune inspection à l’œil, capture, image, scène rendue ou approbation artistique.','Aucune suite de tests ni build.','Aucun appareil, benchmark ou FPS téléphone.','Enveloppe de chaque clip majorée continûment ; transitions entre clips non mesurées.','Jeux mécaniques localisés et échantillonnés ; aucune certification complète des collisions internes.','Textes et logs de commande non inclus dans le poids des six fichiers GLB/PNG.']}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','octetsLot','sha256Glb','controleTechnique','typage','rayonHorizontalMajoreMetres']},ensure_ascii=False))
