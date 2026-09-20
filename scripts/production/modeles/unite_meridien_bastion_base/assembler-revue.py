#!/usr/bin/env python3
"""Relie mesures et contrôles exécutés à l'empreinte du lot livré."""
from pathlib import Path
from datetime import datetime, timezone
import json, hashlib, sys
ID='unite_meridien_bastion_base'
source=Path(__file__).resolve().parent
racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
def lire(n):return json.loads((sortie/n).read_text())
def empreinte(p):return {'nom':p.name,'octets':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
fab=lire('fabrication.json');geo=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');jeux=lire('mesures-jeux.json');ressort=lire('mesures-ressort.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and typage['codeSortie']==0
for p,sha in typage['sha256SourcesTs'].items():assert hashlib.sha256((racine/p).read_bytes()).hexdigest()==sha, f'Typage périmé pour {p}'
fichiers=[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
sha=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert sha==fab['sha256Glb']==jeux['sha256Glb']
rapport={
 'id':ID,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'statut':'pret_a_integrer_par_coordinateur','approbationArtistique':False,
 'provenance':{'type':'creation_originale_parametrique','dossierScripts':str(source.relative_to(racine)),'sourceExterneUtilisee':False,'bakeHD':False,'ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'octetsGlb':ancien['octetsGlb'],'triangles':ancien['triangles'],'pngInspectes':len(ancien['textures']),'importe':False},'depotsDistants':'Zéro upload du Bastion confirmé à nouveau par le coordinateur le 20 septembre 2026 pendant cette production ; revalidation éventuelle avant mutation relève du coordinateur. Aucun jeton copié.'},
 'sha256Glb':sha,'fichiers':fichiers,'octetsGlb':fab['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'triangles':geo['triangles'],'budgetTriangles':9000,'primitives':geo['primitives'],'materiaux':geo['materiaux'],'noeuds':geo['noeuds'],'dimensionsMetres':poses['bornesStatiques']['dimensions'],'bornes':poses['bornesStatiques'],
 'controleLot':lot,'controleTypage':typage,
 'mesures':{'geometrie':geo,'poses':poses,'jeuxMecaniques':jeux,'ressort':ressort},
 'mesuresResume':{'posesGLBRelues':sum(c['nombreEchantillons'] for c in poses['clips']),'rayonEchantillonneMetres':max(c['rayonHorizontalMax'] for c in poses['clips']),'rayonMajoreParVitesseMetres':max(c['rayonHorizontalMajorationContinue'] for c in poses['clips']),'rayonTousCapsEtTourelleBorneAnalytiqueMetres':jeux['rayonHorizontalMaximumContinu'],'espaceMinimalDeuxVoisinsTousCapsMetres':jeux['espaceMinimumDeuxVoisinsTousCaps'],'mesuresMecaniquesLocalisees':len(jeux['chenillesEtRoues']),'jeuAmeRessortMetres':ressort['jeuAmeBorneInferieureMetres'],'jeuSpiresMetres':ressort['jeuEntreSpiresMetres'],'engagementMinimalSuspensionMetres':jeux['suspension']['engagementMinimalMetres']},
 'porteeRuntime':'Faction atl sans style national : gabarit b [1,1,1], confirmé par le coordinateur. Autres gabarits et déformations non certifiés.',
 'limites':['Aucun test général ni build exécuté.','Aucun rendu, capture, contrôle visuel ni approbation artistique.','Aucune mesure de FPS ni essai téléphone.','Articulations rigides et suspension verticale ; chenilles fixes sans défilement des patins et galets.','Les cinq clips sont mesurés séparément ; leurs mélanges et transitions runtime ne sont pas certifiés.','Les bornes radiales continues concernent les clips et azimuts spécifiés. Les jeux mécaniques sont localisés et ne certifient pas toutes les collisions internes.','Assemblages de support, têtes de moyeux et berceaux raccordés intentionnellement ; les coulisseaux disposent de vrais fourreaux creux.','Microreliefs analytiques en espace tangent, aucun transfert ni bake HD revendiqué.','Aucune émission livrée : le témoin ambré est une surface non lumineuse.','Les effets de tir du moteur et leur origine visuelle restent à apprécier en jeu.','Aucun actif, lot officiel, registre, plan ou fichier partagé modifié par le spécialiste ; intégration et publication restent au coordinateur.'],
 'rapports': [empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.json','.md'] and p.name not in ['revue-technique.json']],
 'sources': [empreinte(p) for p in sorted(source.iterdir()) if p.is_file()],
}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','primitives','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
