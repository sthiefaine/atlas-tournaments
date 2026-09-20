#!/usr/bin/env python3
"""Assemble la revue à partir des contrôles déjà exécutés ; ne les simule pas."""
from pathlib import Path
from datetime import datetime, timezone
import json, hashlib, sys
identifiant='unite_furtif_base'
sortie=Path(sys.argv[1] if len(sys.argv)>1 else f'tmp/production-sequentielle/{identifiant}')
def lire(n):return json.loads((sortie/n).read_text())
fabrication=lire('fabrication.json');geometrie=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');ressort=lire('mesures-ressort.json');conduits=lire('mesures-conduits.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and typage['codeSortie']==0
fichiers=[{'nom':p.name,'octets':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
sha=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert sha==fabrication['sha256Glb']==conduits['sha256Glb']
rapport={
 'id':identifiant,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'approbationArtistique':False,
 'statut':'pret_a_integrer_apres_reverification_sources_par_coordinateur',
 'provenance':{'type':'creation_originale_parametrique','sourceExterneUtilisee':False,'bakeHD':False,'dossierScripts':f'scripts/production/modeles/{identifiant}','ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'triangles':ancien['triangles'],'octetsGlb':ancien['octetsGlb'],'importe':False},'sourceDistante':'Aucun upload de cette fiche signalé par le coordinateur dans l’inventaire du 20 septembre ; relecture obligatoire avant activation, hors de ce travail de spécialiste.'},
 'fichiers':fichiers,'sha256Glb':sha,'octetsGlb':fabrication['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'triangles':geometrie['triangles'],'budgetTriangles':9000,'primitives':geometrie['primitives'],'materiaux':geometrie['materiaux'],'noeuds':geometrie['noeuds'],
 'dimensionsMetres':poses['bornesStatiques']['dimensions'],'bornes':poses['bornesStatiques'],'controleLot':lot,'controleTypage':typage,
 'mesures':{'geometrie':geometrie,'poses':poses,'ressort':ressort,'conduits':conduits},
 'mesuresResume':{'posesRelues':sum(c['nombreEchantillons'] for c in poses['clips']),'rayonHorizontalMax':max(c['rayonHorizontalMax'] for c in poses['clips']),'rayonHorizontalMajorationContinue':max(c['rayonHorizontalMajorationContinue'] for c in poses['clips']),'espacementMinimumNeutreTousCaps':min(c['espacementMinimumVoisinsTousCaps'] for c in poses['clips']),'jeuAmeMinimum':ressort['jeuAmeBorneInferieureMetres'],'jeuSpiresMinimum':ressort['jeuEntreSpiresMetres'],'conduitsArriereDegagesDeCoque':True},
 'limites':['Aucun test général ni build exécuté.','Aucun rendu, capture, contrôle visuel ou approbation artistique.','Aucun téléphone ni mesure de FPS.','Gabarit neutre runtime uniquement ; déformations nationales non certifiées.','Chaque clip mesuré séparément ; transitions et mélanges entre clips non certifiés.','Contrôles de collisions limités au ressort et aux conduits arrière ; pas de certificat global.','Le raccordement visuel des effets de tir reste à apprécier en jeu.','Les actifs, lots, registres, spécifications et plan n’ont pas été modifiés par le spécialiste ; intégration/publication déléguées au coordinateur.'],
}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','primitives','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
