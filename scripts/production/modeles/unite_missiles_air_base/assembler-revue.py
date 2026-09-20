#!/usr/bin/env python3
"""Attache les rapports finaux et les sources à l'empreinte du lot contrôlé."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys
ID='unite_missiles_air_base'
source=Path(__file__).resolve().parent;racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
def lire(n):return json.loads((sortie/n).read_text())
def empreinte(p):return {'nom':p.name,'octets':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
fab=lire('fabrication.json');geo=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');jeux=lire('mesures-jeux.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and typage['codeSortie']==0
for p,sha in typage['sha256SourcesTs'].items():assert hashlib.sha256((racine/p).read_bytes()).hexdigest()==sha,f'Typage périmé : {p}'
fichiers=[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
sha=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert sha==fab['sha256Glb']==jeux['sha256Glb']==lot['sha256Glb']
assert (source/'README.md').read_bytes()==(sortie/'README.md').read_bytes()
rayon=max(c['rayonHorizontalMajorationContinue'] for c in poses['clips'])
rapport={
 'id':ID,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'statut':'pret_a_integrer_par_coordinateur','approbationArtistique':False,
 'provenance':{'type':'creation_originale_parametrique','dossierScripts':str(source.relative_to(racine)),'sourceExterneUtilisee':False,'ancienCandidatImporte':False,'bakeHD':False,'helpersAdaptes':'Export, formes élémentaires, recette atlas de matières et mesures des modèles précédents. Aucune géométrie ou PNG de l’ancien candidat réutilisé.','ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'octetsGlb':ancien['octetsGlb'],'triangles':ancien['triangles'],'pngInspectes':len(ancien['textures']),'importe':False},'depotsDistants':{'dateVerificationCommuniquee':'2026-09-20T13:51:44.465Z','nombreDepots':0,'sourceVerification':'Coordinateur ; lecture authentifiée réussie, revalidation avant intégration de son ressort.'}},
 'sha256Glb':sha,'fichiers':fichiers,'octetsGlb':fab['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'triangles':geo['triangles'],'budgetTriangles':9000,'primitives':geo['primitives'],'materiaux':geo['materiaux'],'noeuds':geo['noeuds'],'dimensionsMetres':poses['bornesStatiques']['dimensions'],'bornes':poses['bornesStatiques'],'clips':geo['dureesClipsMs'],
 'controleLot':lot,'controleTypage':typage,
 'mesuresResume':{'roues':jeux['nombreRoues'],'posesGLBRelues':sum(c['nombreEchantillons'] for c in poses['clips']),'rayonEchantillonneMetres':max(c['rayonHorizontalMax'] for c in poses['clips']),'rayonHorizontalMajoreMetres':rayon,'espaceMinimalDeuxVoisinsTousCapsMetres':1-2*rayon,'mesuresDistancesTriangles':len(jeux['distancesTriangles']),'rayonsOuverturesToutesGeometries':sum(c['rayonsVerifies'] for c in jeux['cavites']),'gardeBouePneuAuPointBasMetres':min(r['gardeBouePointBasJeuVertical'] for r in jeux['roues']),'suspensionEngagementMinimumMetres':min(r['engagementMinimal'] for r in jeux['suspensions']),'suspensionJeuRadialMinimumMetres':min(r['jeuRadialMinimal'] for r in jeux['suspensions']),'caissonCabineMinimumEchantillonneMetres':min(r['caissonCabineSeparationZ'] for r in jeux['posesModules']),'caissonRadarMinimumEchantillonneMetres':min(r['caissonRadarSeparationZ'] for r in jeux['posesModules']),'caissonPlancherMinimumEchantillonneMetres':min(r['caissonPlancherSeparationY'] for r in jeux['posesModules'])},
 'mesures':{'geometrie':geo,'poses':poses,'jeuxMecaniques':jeux},
 'porteeRuntime':'Gabarit neutre b=[1,1,1] seulement ; a/c nationaux, déformations et mélanges entre clips non certifiés.',
 'correctionsAvantLivraison':['Budget initial réduit par les segments de roues, la quincaillerie et les doubles chanfreins.','Chanfreins bornés selon la largeur et la profondeur des plaques minces.','Deux coffrets latéraux conservés, axe unique sorti de leur boucle de fabrication.','Pare-brise et vitres latérales alignés sur les vrais pans de cabine.','Rails et axe transversal descendus sous les cellules, lèvres et tubes voisins séparés ; sondes des ouvertures sur tous les triangles du véhicule.'],
 'limites':['Aucun test général ni build.','Aucun rendu, capture, image, contrôle visuel ni approbation artistique.','Aucune mesure de FPS ou essai téléphone.','Six roues rigides, seule la suspension verticale du corps est animée.','Les cinq clips sont mesurés séparément ; transitions runtime non certifiées.','Rayon continu majoré par vitesse, dégagements mobiles échantillonnés ; aucune certification globale des collisions internes.','Sondes de six ouvertures au centre et sur un cercle de 28 mm : contrôle local et ponctuel, pas une preuve de toute la section continue.','Vitrages opaques, atlas de matières répété et microreliefs analytiques ; aucun bake ou transfert HD.','Pas de carte d’émission : témoin ambré non lumineux caché hors jeu.','Effets de tir du moteur, bouche et lisibilité en jeu à apprécier humainement.','Aucun lot officiel, alias, registre, plan ou fichier partagé modifié ; aucune opération Git par le spécialiste.'],
 'rapports':[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.json','.md','.log'] and p.name!='revue-technique.json'],
 'sources':[empreinte(p) for p in sorted(source.iterdir()) if p.is_file()],
}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','primitives','octetsGlb','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
