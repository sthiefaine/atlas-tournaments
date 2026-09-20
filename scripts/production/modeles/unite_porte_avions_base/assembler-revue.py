#!/usr/bin/env python3
"""Revue compacte liée au lot, aux contrôles et aux rapports détaillés."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys
ID='unite_porte_avions_base';source=Path(__file__).resolve().parent;racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
def lire(n):return json.loads((sortie/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def empreinte(p):return {'nom':p.name,'octets':p.stat().st_size,'sha256':sha(p)}
fab=lire('fabrication.json');geo=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');ga=lire('mesures-gabarit-a.json');jeux=lire('mesures-jeux.json');natif=lire('mesures-natif-glb.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and natif['pariteNumpyDeuxMicrometres']
for p,s in typage['sha256SourcesTs'].items():assert sha(racine/p)==s,f'Typage périmé : {p}'
fichiers=[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
sha_glb=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert sha_glb==fab['sha256Glb']==ga['sha256Glb']==jeux['sha256Glb']==lot['sha256Glb']
assert (source/'README.md').read_bytes()==(sortie/'README.md').read_bytes()
rb=max(c['rayonHorizontalMajorationContinue'] for c in poses['clips']);ra=max(c['rayonHorizontalMajorationContinue'] for c in ga['clips'])
rapport={
 'id':ID,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'statut':'pret_a_integrer_par_coordinateur','approbationArtistique':False,
 'provenance':{'type':'creation_originale_parametrique','scripts':str(source.relative_to(racine)),'sourceExterneUtilisee':False,'ancienCandidatImporte':False,'bakeHD':False,'normales':'Microreliefs de matière analytiques, aucun éclairage dans les pigments.','ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'triangles':ancien['triangles'],'octetsGlb':ancien['octetsGlb'],'pngInspectes':len(ancien['textures']),'inchangé':True},'verificationDistanteCommuniquee':{'date':'2026-09-20T14:27:43.312Z','nombreDepots':0,'origine':'Coordinateur, lecture authentifiée réussie. Revalidation avant intégration à sa charge.'}},
 'sha256Glb':sha_glb,'triangles':geo['triangles'],'budgetTriangles':9000,'primitives':geo['primitives'],'materiaux':geo['materiaux'],'noeuds':geo['noeuds'],'dimensionsMetres':poses['bornesStatiques']['dimensions'],'octetsGlb':fab['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'fichiers':fichiers,'clips':geo['dureesClipsMs'],
 'controles':{'lot':{'ok':lot['ok'],'rapport':'validation-lot.json','dateUtc':lot['dateUtc']},'typage':{'ok':typage['ok'],'rapport':'validation-typage.json','dateUtc':typage['dateUtc']},'geometrieEtPng':'mesures-geometrie.json','posesThree':'mesures-poses-three-glb.json','posesNumpyB':'mesures-poses-glb.json','posesNumpyA':'mesures-gabarit-a.json','chargementNatif':'mesures-natif-glb.json','mecanique':'mesures-jeux.json'},
 'mesuresResume':{'posesParGabarit':sum(c['nombreEchantillons'] for c in poses['clips']),'pariteNumpyThreeNatifToleranceMetres':.000002,'rayonMajoreB':rb,'rayonMajoreA':ra,'espaceDeuxVoisinsB':1-2*rb,'espaceDeuxVoisinsA':1-2*ra,'raccordsIntentionnelsMesures':len(jeux['raccords']),'jeuRadarToit':min(c['radarToitSeparationY'] for c in jeux['posesModules']),'jeuRadarAntenne':min(c['radarAntenneSeparationZ'] for c in jeux['posesModules']),'jeuAntenneToit':min(c['antenneToitSeparationZ'] for c in jeux['posesModules']),'jeuRessortAme':jeux['ressort']['jeuAme'],'separationSpires':jeux['ressort']['separationPortionsDistinctes'],'couplesSpiresSondes':jeux['ressort']['couplesSegmentsSondes'],'niveauAscenseurEtPont':jeux['ascenseur']['niveauPlateformeY'],'sondesAscenseur':len(jeux['ascenseur']['sondes']),'sondesCatapultes':sum(len(c['fondVoieY']) for c in jeux['catapultes']),'sondesPontLibre':len(jeux['sondesPontLibre']),'sondesMarqueur':len(jeux['sondesMarqueur']),'racineNonAnimee':not geo['racineAnimee'],'tempsAnimationsMinMaxConserves':geo['bornesTempsAnimationConservees'],'bouclesPoseEtVitesse':True,'horsJeuTientPoseEtMasqueTemoin':geo['horsJeuTientPoseFinale'] and geo['indicateurCacheFinHorsJeu']},
 'correctionsAvantGel':['Récepteur radar raccordé à son bras prolongé.','Réservations réelles dans le pont pour plateforme affleurante et voies de lancement.','Radar relevé de 4 mm pour dégager son bras du toit.','Roulis de déplacement uniaxial pour raccordement de vitesse.'],
 'limites':['Aucun rendu, capture, contrôle visuel, appréciation artistique à 65 degrés ou 48 px/m.','Aucun test général, build, téléphone ou FPS.','Gabarits a/b et clips isolés uniquement ; c, transitions et mélanges exclus.','Sol mesuré aux poses ; rayon majoré continûment.','Distances localisées et sondes ponctuelles ; aucune certification globale des collisions internes.','Ascenseur et catapultes rigides, vitrages opaques, atlas de matières répété.','PNG non chargés dans le contrôle natif ; références et données contrôlées séparément.','Aucun maître HD ou bake, effets de bouche et lisibilité à apprécier en jeu.','Aucun lot officiel, actif, alias, registre, plan, fichier partagé ou opération Git par le spécialiste.'],
 'rapports':[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.json','.md','.log'] and p.name!='revue-technique.json'],
 'sources':[empreinte(p) for p in sorted(source.iterdir()) if p.is_file()],
}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','primitives','octetsGlb','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
