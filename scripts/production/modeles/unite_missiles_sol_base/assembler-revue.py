#!/usr/bin/env python3
"""Lie la revue aux fichiers livrés, aux mesures et au dernier typage autorisé."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys
ID='unite_missiles_sol_base';source=Path(__file__).resolve().parent;racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
def lire(n):return json.loads((sortie/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def empreinte(p):return {'nom':p.name,'octets':p.stat().st_size,'sha256':sha(p)}
fab=lire('fabrication.json');geo=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');jeux=lire('mesures-jeux.json');ga=lire('mesures-gabarit-a.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and typage['codeSortie']==0
for p,hash_ts in typage['sha256SourcesTs'].items():assert sha(racine/p)==hash_ts,f'Typage périmé : {p}'
fichiers=[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
empreinte_glb=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert empreinte_glb==fab['sha256Glb']==jeux['sha256Glb']==ga['sha256Glb']==lot['sha256Glb']
assert (source/'README.md').read_bytes()==(sortie/'README.md').read_bytes()
rayon=max(c['rayonHorizontalMajorationContinue'] for c in poses['clips']);rayon_a=max(c['rayonHorizontalMajorationContinue'] for c in ga['clips'])
rapport={
 'id':ID,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'statut':'pret_a_integrer_par_coordinateur','approbationArtistique':False,
 'provenance':{'type':'creation_originale_parametrique','dossierScripts':str(source.relative_to(racine)),'sourceExterneUtilisee':False,'ancienCandidatImporte':False,'bakeHD':False,'helpersAdaptes':'Export, formes élémentaires, atlas analytique de matières et mesures adaptés des modèles précédents. Géométrie originale, aucun candidat ou PNG historique importé.','ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'octetsGlb':ancien['octetsGlb'],'triangles':ancien['triangles'],'pngInspectes':len(ancien['textures']),'importe':False},'depotsDistants':{'dateVerificationCommuniquee':'2026-09-20T14:11:25.178Z','nombreDepots':0,'sourceVerification':'Coordinateur ; lecture authentifiée réussie, revalidation avant intégration à sa charge.'}},
 'sha256Glb':empreinte_glb,'fichiers':fichiers,'octetsGlb':fab['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'triangles':geo['triangles'],'budgetTriangles':9000,'primitives':geo['primitives'],'materiaux':geo['materiaux'],'noeuds':geo['noeuds'],'dimensionsMetres':poses['bornesStatiques']['dimensions'],'bornes':poses['bornesStatiques'],'clips':geo['dureesClipsMs'],
 'controleLot':lot,'controleTypage':typage,
 'mesuresResume':{'trains':len(jeux['trains']),'galets':jeux['nombreGalets'],'patins':sum(x['patins'] for x in jeux['trains']),'posesGLBReluesParGabarit':sum(c['nombreEchantillons'] for c in poses['clips']),'rayonHorizontalMajoreGabaritB':rayon,'rayonHorizontalMajoreGabaritA':rayon_a,'espaceMinimalDeuxVoisinsB':1-2*rayon,'espaceMinimalDeuxVoisinsA':1-2*rayon_a,'mesuresDistancesTriangles':len(jeux['distancesTriangles']),'rayonsOuverturesToutesGeometries':sum(c['rayonsVerifies'] for c in jeux['cavites']),'rayonsTirLibresDevantCabine':sum(c['rayonsLibres'] for c in jeux['passagesTir']),'gardeChenilleMin':min(x['gardeChenilleAuTassement'] for x in jeux['trains']),'suspensionEngagementMinimum':min(x['engagementMinimal'] for x in jeux['suspensions']),'suspensionJeuRadialMinimum':min(x['jeuRadialMinimal'] for x in jeux['suspensions']),'ressortJeuAme':jeux['ressort']['jeuAme'],'ressortSeparationPortions':jeux['ressort']['separationPortionsDistinctes'],'caissonCabineMinimumEchantillonne':min(x['caissonCabineSeparationZ'] for x in jeux['posesModules']),'caissonAntenneMinimumEchantillonne':min(x['caissonAntenneSeparationZ'] for x in jeux['posesModules'])},
 'mesures':{'geometrie':geo,'posesGabaritB':poses,'posesGabaritA':ga,'jeuxMecaniques':jeux},
 'porteeRuntime':'Enveloppes runtime a et b selon conformerModele ; c et mélanges entre clips non certifiés.',
 'correctionsAvantLivraison':['Segments des cellules/galets, boulons et ressort bornés pour rester sous 9000 triangles.','Galets internes de rayon 50 mm à Y=82 mm : recouvrement terminal supprimé, jeu à la piste intérieure.','Patins des courbes raccourcis pour l’appui des semelles basses.','Plateau suspendu relevé de 20 mm pour garder du jeu au tassement maximal.','Semelles de recul ajoutées entre caisson et rails ; antenne déplacée latéralement de 25 mm pour garder un plan séparateur de la cabine.'],
 'limites':['Aucun test général ni build.','Aucun rendu, capture, image, contrôle visuel ni approbation artistique.','Aucune mesure de FPS ou essai téléphone.','Chenilles et galets rigides ; suspension corporelle seulement.','Gabarits a/b et clips isolés ; c et transitions exclus.','Distances locales et passages ponctuels ; aucune certification globale des collisions internes.','Vitrages opaques, atlas de matières répété, aucun maître HD ni bake.','Témoin ambré non lumineux caché hors jeu.','Effets de tir, bouche et lisibilité du modèle en jeu à apprécier humainement.','Aucun lot officiel, actif, alias, registre, plan, fichier partagé ou Git modifié par le spécialiste.'],
 'rapports':[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.json','.md','.log'] and p.name!='revue-technique.json'],
 'sources':[empreinte(p) for p in sorted(source.iterdir()) if p.is_file()],
}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','primitives','octetsGlb','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
