#!/usr/bin/env python3
"""Revue compacte ; recoupe SHA du lot, du typage et des sources historiques."""
from pathlib import Path
from datetime import datetime,timezone
import json,hashlib,sys
ID='unite_sous_marin_base';source=Path(__file__).resolve().parent;racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
lire=lambda n:json.loads((sortie/n).read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def empreinte(p):return {'nom':p.name,'octets':p.stat().st_size,'sha256':sha(p)}
fab=lire('fabrication.json');geo=lire('mesures-geometrie.json');poses=lire('mesures-poses-glb.json');gab=lire('mesures-gabarits.json');jeux=lire('mesures-jeux.json');natif=lire('mesures-natif-glb.json');lot=lire('validation-lot.json');typage=lire('validation-typage.json');ancien=lire('inspection-ancien-candidat.json')
assert lot['ok'] and typage['ok'] and natif['pariteNumpyDeuxMicrometres']
for p,s in typage['sha256SourcesTs'].items():assert sha(racine/p)==s,f'Typage périmé : {p}'
fichiers=[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.glb','.png']]
sha_glb=next(f['sha256'] for f in fichiers if f['nom'].endswith('.glb'))
assert sha_glb==fab['sha256Glb']==jeux['sha256Glb']==lot['sha256Glb']
assert (source/'README.md').read_bytes()==(sortie/'README.md').read_bytes()
historique=racine/'assets/livraisons'/ID
assert sha(historique/f'{ID}_lod0.glb')==ancien['sha256Glb']
for p in ancien['textures']:assert sha(historique/p['fichier'])==p['sha256']
rayons={g:max(c['rayonMajoreContinu'] for c in cs) for g,cs in gab['clipsParGabarit'].items()}
r={'id':ID,'dateRevueUtc':datetime.now(timezone.utc).isoformat(),'statut':'pret_a_integrer_par_coordinateur','approbationArtistique':False,
 'provenance':{'type':'creation_originale_parametrique','scripts':str(source.relative_to(racine)),'sourceExterneUtilisee':False,'ancienCandidatImporte':False,'bakeHD':False,'ancienCandidat':{'sha256Glb':ancien['sha256Glb'],'triangles':ancien['triangles'],'octetsGlb':ancien['octetsGlb'],'pngInspectes':len(ancien['textures']),'empreintesReverifieesAvantGel':True},'verificationDistanteCommuniquee':{'date':'2026-09-20T15:17:22.723Z','nombreDepots':0,'origine':'Coordinateur, lecture authentifiée réussie ; revalidation avant intégration à sa charge.'},'rapportLocal':'provenance.json'},
 'sha256Glb':sha_glb,'triangles':geo['triangles'],'budgetTriangles':6000,'primitives':geo['primitives'],'materiaux':geo['materiaux'],'dimensionsMetres':poses['bornesStatiques']['dimensions'],'octetsGlb':fab['octetsGlb'],'octetsLot':sum(f['octets'] for f in fichiers),'fichiers':fichiers,'clips':geo['dureesClipsMs'],
 'controles':{'lot':{'ok':lot['ok'],'rapport':'validation-lot.json'},'typage':{'ok':typage['ok'],'rapport':'validation-typage.json'},'geometrieEtPng':'mesures-geometrie.json','posesThree':'mesures-poses-three-glb.json','posesNumpy':'mesures-poses-glb.json','gabaritsABC':'mesures-gabarits.json','chargementNatif':'mesures-natif-glb.json','mecanique':'mesures-jeux.json'},
 'mesuresResume':{'posesParGabarit':sum(c['nombreEchantillons'] for c in poses['clips']),'pariteNumpyThreeNatifToleranceMetres':.000002,'rayonsMajoresABC':rayons,'espaceDeuxVoisinsABC':{g:1-2*r for g,r in rayons.items()},'raccordsIntentionnels':len(jeux['raccords']),'jeuContinuHeliceCouronne':jeux['helice']['jeuContinuToutAngle'],'jeuHeliceSupports':jeux['helice']['separationZSupports'],'jeuRessortAme':jeux['ressort']['jeuAme'],'jeuSpire':jeux['ressort']['separationPortionsDistinctes'],'sondesMarqueur':len(jeux['sondesMarqueur']),'sondesAppuiBerceau':len(jeux['sondesAppuiBerceau']),'racineNonAnimee':not geo['racineAnimee'],'tempsAnimationsMinMaxConserves':geo['bornesTempsAnimationConservees'],'bouclesPoseEtVitesse':True,'horsJeuTientPoseEtMasqueTemoin':geo['horsJeuTientPoseFinale'] and geo['indicateurCacheFinHorsJeu']},
 'correctionsAvantGel':['Extrémités raccourcies de 10 mm pour la marge en gabarit c.','Âme du ressort prolongée dans la collerette haute.','Embase de marqueur approfondie pour suivre la coque vers son bord avant.'],
 'limites':['Aucun rendu, capture, contrôle visuel ni approbation artistique.','Aucun test général, build, téléphone ou FPS.','Clips isolés ; transitions et mélanges exclus.','Sol et jeux aux poses, rayon majoré continûment pour a/b/c.','Distances locales et sondes ponctuelles ; aucune certification globale des collisions.','Plans et dérive rigides, capteurs opaques ; atlas répété.','Aucun HD ni bake ; lisibilité et effets de bouche à apprécier humainement.'],
 'rapports':[empreinte(p) for p in sorted(sortie.iterdir()) if p.suffix in ['.json','.md','.log'] and p.name!='revue-technique.json'],
 'sources':[empreinte(p) for p in sorted(source.iterdir()) if p.is_file()]}
(sortie/'revue-technique.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:r[k] for k in ['id','triangles','primitives','octetsGlb','octetsLot','sha256Glb','mesuresResume']},ensure_ascii=False))
