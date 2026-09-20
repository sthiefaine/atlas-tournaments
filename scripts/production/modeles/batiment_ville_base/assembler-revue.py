#!/usr/bin/env python3
"""Rassemble les mesures et journaux des contrôles autorisés déjà effectués."""
import argparse,hashlib,json
from pathlib import Path
from datetime import datetime,timezone
ID='batiment_ville_base';OUT=Path('tmp/production-sequentielle')/ID;SOURCE=Path('scripts/production/modeles')/ID
p=argparse.ArgumentParser();p.add_argument('--code-typecheck',required=True,type=int);args=p.parse_args();assert args.code_typecheck==0
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
now=datetime.now(timezone.utc).isoformat()
validation_log=(OUT/'validation-lot.log').read_text();verdict=json.loads(validation_log[validation_log.index('{'):]);assert verdict['ok']
(OUT/'validation-lot.json').write_text(json.dumps(verdict,ensure_ascii=False,indent=2)+'\n')
active=Path('public/assets/modeles')/f'{ID}_lod0.glb';candidat=Path('assets/livraisons')/ID/f'{ID}_lod0.glb';old='18daaaf44f866602c5a2f7eaed89b8789eeafa64dd1a987d0f30eb71442910e5';assert sha(active)==sha(candidat)==old
read=lambda n:json.loads((OUT/n).read_text())
fabrication=read('fabrication.json');mesures=read('mesures.json');native=read('mesures-natif-glb.json');provenance=read('provenance.json')
assets=[{'fichier':f.name,'octets':f.stat().st_size,'sha256':sha(f)} for f in sorted(OUT.iterdir()) if f.suffix in ['.glb','.png']];assert len(assets)==6
assert fabrication['sha256Glb']==mesures['sha256Glb']==sha(OUT/f'{ID}_lod0.glb')
sources=[{'fichier':str(f),'sha256':sha(f)} for f in sorted(SOURCE.iterdir()) if f.suffix in ['.py','.ts','.md']]
log=(OUT/'typecheck.log').read_text();assert 'tsc --noEmit --incremental false' in log and 'error TS' not in log
check={'date':now,'commande':'npm run typecheck -- --incremental false','codeSortie':args.code_typecheck,'journalSha256':sha(OUT/'typecheck.log'),'sourcesTypescript':[{'fichier':str(f),'sha256':sha(f)} for f in SOURCE.glob('*.ts')],'limite':'Contrôle de types, aucune suite de tests ni build.'}
(OUT/'typecheck.json').write_text(json.dumps(check,ensure_ascii=False,indent=2)+'\n')
report={'id':ID,'date':now,'etat':'controle_technique_reussi','source':'creation_originale_parametrique','verificationDistante':provenance['lectureDistanteCommuniquee'],'maitreLocalIdentifie':False,'ancienCandidat':{'sha256':old,'triangles':1036,'octetsGlb':129500,'preserve':True,'actifPreserve':True,'geometrieReutilisee':False},'triangles':fabrication['triangles'],'budgetTriangles':5000,'primitives':mesures['primitives'],'materiaux':2,'octetsGlb':fabrication['octetsGlb'],'octetsLot':sum(x['octets'] for x in assets),'dimensions':fabrication['bornes']['dimensions'],'sha256Glb':fabrication['sha256Glb'],'fichiers':assets,'sources':sources,'controleLot':verdict,'typecheck':'typecheck.json','mesures':{'rapport':'mesures.json','natif':'mesures-natif-glb.json','poses':mesures['animations']['poses'],'pairesRaccordsListees':len(mesures['raccords']),'controleExhaustifCollisions':False,'pariteNumpyNatif':native['pariteNumpyDeuxMicrometres'],'cour':mesures['cour'],'toits':mesures['toits'],'gardeContinueVoletCour':mesures['animations']['gardeContinueVoletCour'],'gardeContinueEnseigneToit':mesures['animations']['gardeContinueEnseigneToit'],'gardeContinueEnseigneButees':mesures['animations']['gardeContinueEnseigneButees']},'pertes':{'decimation':False,'reductionTexture':False,'bakeHD':False,'ancienModeleRemplaceParCreationIndependante':True},'approbationArtistique':False,'controleVisuel':False,'testsGeneraux':False,'build':False,'fpsTelephone':None,'limites':['Mesures ciblées sur les pièces et sondes listées, pas de preuve exhaustive de non-intersection ou visibilité.','Textures retirées en mémoire pour charger sous Node ; cartes et UV contrôlés séparément.','Transitions entre animations non évaluées dans le jeu.','Aucune approbation artistique, capture ou mesure téléphone.']}
(OUT/'revue-technique.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'id':ID,'triangles':report['triangles'],'octetsLot':report['octetsLot'],'sha256Glb':report['sha256Glb'],'controle':'ok','typecheck':'ok'}))
