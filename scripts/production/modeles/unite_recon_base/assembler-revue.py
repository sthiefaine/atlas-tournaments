#!/usr/bin/env python3
"""Résumé lié aux empreintes du lot, des scripts et des contrôles détaillés."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys
ID='unite_recon_base';source=Path(__file__).resolve().parent;racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
def lire(n):return json.loads((sortie/n).read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def empreinte(p):return {'nom':p.name,'octets':p.stat().st_size,'sha256':sha(p)}
fab=lire('fabrication.json');geo=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');gab=lire('mesures-gabarits.json');jeux=lire('mesures-jeux.json');natif=lire('mesures-natif-glb.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and natif['pariteNumpyDeuxMicrometres']
for p,s in typage['sha256SourcesTs'].items():assert sha(racine/p)==s,f'Typage périmé : {p}'
fichiers=[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
sha_glb=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert sha_glb==fab['sha256Glb']==jeux['sha256Glb']==lot['sha256Glb']
assert (source/'README.md').read_bytes()==(sortie/'README.md').read_bytes()
rayons={g:max(c['rayonMajoreContinu'] for c in cs) for g,cs in gab['clipsParGabarit'].items()}
rapport={
 'id':ID,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'statut':'pret_a_integrer_par_coordinateur','approbationArtistique':False,
 'provenance':{'type':'creation_originale_parametrique','scripts':str(source.relative_to(racine)),'sourceExterneUtilisee':False,'ancienCandidatImporte':False,'bakeHD':False,'normales':'Microreliefs analytiques de matière ; pigments sans éclairage calculé.','ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'triangles':ancien['triangles'],'octetsGlb':ancien['octetsGlb'],'pngInspectes':len(ancien['textures']),'inchange':True},'verificationDistanteCommuniquee':{'date':'2026-09-20T14:42:34.126Z','nombreDepots':0,'fiches':['unite_recon_base','kit_fr_recon','kit_lu_recon'],'origine':'Coordinateur, lecture authentifiée réussie ; revalidation avant intégration à sa charge.'}},
 'sha256Glb':sha_glb,'triangles':geo['triangles'],'budgetTriangles':3500,'primitives':geo['primitives'],'materiaux':geo['materiaux'],'dimensionsMetres':poses['bornesStatiques']['dimensions'],'octetsGlb':fab['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'fichiers':fichiers,'clips':geo['dureesClipsMs'],
 'controles':{'lot':{'ok':lot['ok'],'rapport':'validation-lot.json'},'typage':{'ok':typage['ok'],'rapport':'validation-typage.json'},'geometrieEtPng':'mesures-geometrie.json','posesThree':'mesures-poses-three-glb.json','posesNumpy':'mesures-poses-glb.json','gabaritsABC':'mesures-gabarits.json','chargementNatif':'mesures-natif-glb.json','mecanique':'mesures-jeux.json'},
 'mesuresResume':{'posesParGabarit':sum(c['nombreEchantillons'] for c in poses['clips']),'pariteNumpyThreeNatifToleranceMetres':.000002,'rayonsMajoresABC':rayons,'espaceDeuxVoisinsABC':{g:1-2*r for g,r in rayons.items()},'distancesLocales':len(jeux['distancesTriangles']),'raccordsIntentionnels':len(jeux['raccords']),'raccordsPneusJantes':len(jeux['raccordsPneusJantes']),'jeuGardeBoueMinimum':min(v for c in jeux['posesModules'] for v in c['pneusGardesBoueJeux'].values()),'jeuSecoursRoue':min(c['secoursRoueCentraleSeparationY'] for c in jeux['posesModules']),'jeuRadarCabine':min(c['radarCabineSeparationZ'] for c in jeux['posesModules']),'sondesMarqueur':len(jeux['sondesMarqueur']),'racineNonAnimee':not geo['racineAnimee'],'tempsAnimationsMinMaxConserves':geo['bornesTempsAnimationConservees'],'bouclesPoseEtVitesse':True,'horsJeuTientPoseEtMasqueTemoin':geo['horsJeuTientPoseFinale'] and geo['indicateurCacheFinHorsJeu']},
 'correctionsAvantGel':['Jantes prolongées et élargies pour fermer les talons, marge polygonale comprise.','Winding des garde-boue orienté vers l’extérieur.'],
 'limites':['Aucun rendu, capture, contrôle visuel ni approbation artistique à 65 degrés ou 48 px/m.','Aucun test général, build, téléphone ou FPS.','Clips isolés ; transitions et mélanges exclus.','Sol et jeux mécaniques mesurés aux poses ; rayon majoré continûment pour a/b/c.','Distances locales et sondes ponctuelles ; aucune certification globale des collisions internes.','Vitrages opaques sans intérieur, atlas répété, suspension simplifiée à bras rigides.','PNG non chargés dans le contrôle natif ; données contrôlées séparément.','Aucun maître HD ou bake. Effets de bouche et lisibilité en jeu à apprécier.','Kits incompatibles à archiver par le coordinateur seulement avant intégration. Aucun fichier partagé ou Git modifié par le spécialiste.'],
 'rapports':[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.json','.md','.log'] and p.name!='revue-technique.json'],
 'sources':[empreinte(p) for p in sorted(source.iterdir()) if p.is_file()],
}
(sortie/'revue-technique.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:rapport[k] for k in ['id','triangles','primitives','octetsGlb','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
