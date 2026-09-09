#!/usr/bin/env python3
"""Assemble les candidats existants de Premier contact, sans génération ni publication."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import struct
import zipfile
from urllib.parse import unquote, urlsplit

ROOT=Path(__file__).resolve().parents[2]
SORTIE=ROOT/'assets/missions/premier_contact'
ZIP=SORTIE/'premier_contact_glb_textures.zip'

def lire(rel):
    return json.loads((ROOT/rel).read_text())

def sha(b):
    return hashlib.sha256(b).hexdigest()

def document_glb(b):
    if len(b)<20 or b[:4]!=b'glTF' or struct.unpack_from('<I',b,4)[0]!=2:
        raise ValueError('GLB 2.0 attendu')
    n,typ=struct.unpack_from('<II',b,12)
    if typ!=0x4E4F534A or struct.unpack_from('<I',b,8)[0]!=len(b):
        raise ValueError('Structure GLB invalide')
    return json.loads(b[20:20+n])

def verifier_refs(fichiers):
    references=[]
    for nom,b in fichiers.items():
        if not nom.endswith('.glb'):continue
        doc=document_glb(b)
        for bloc in doc.get('images',[])+doc.get('buffers',[]):
            uri=bloc.get('uri')
            if uri is None:continue
            if uri.startswith('data:'):raise ValueError(f'{nom}: contenu embarqué URI non prévu')
            u=urlsplit(uri)
            if u.scheme or u.netloc or u.query or u.fragment:raise ValueError(f'{nom}: URI externe interdite {uri}')
            relatif=PurePosixPath(unquote(u.path))
            if relatif.is_absolute() or '..' in relatif.parts:raise ValueError(f'{nom}: URI non locale {uri}')
            cible=str(PurePosixPath(nom).parent/relatif)
            if cible not in fichiers:raise ValueError(f'{nom}: référence absente {cible}')
            references.append({'modele':nom,'uri':uri,'cible':cible})
    return references

def main():
    scenario=lire('content/scenarios/premier_contact.json')
    carte=lire('content/cartes/'+scenario['carteCle']+'.json')
    depart=sorted({u['type'] for u in carte['unitesDepart']})
    if depart!=['char_leger','infanterie','recon']:raise ValueError('Le roster initial a changé : réviser la sélection du lot.')
    if scenario['paysCode']!='fr':raise ValueError('Le territoire de la mission a changé.')
    commandants={c['camp']:c['commandantCle'] for c in scenario['commandants']}
    if commandants!={0:'cmd_ariane_belloc',1:'cmd_tomas_reiner'}:raise ValueError('Commandants modifiés : réviser les kits par camp.')
    recrutables=['meca','genie']
    unite_types=sorted(set(depart+recrutables))
    selections=[]
    def ajouter(id,categorie,usage,optionnel=False):selections.append(dict(id=id,categorie=categorie,usage=usage,optionnel=optionnel))
    for cle in unite_types:
        ajouter('unite_'+cle+'_base','base_unite','Unité de départ' if cle in depart else 'Recrutable au QG en catalogue 4')
        for pays in ['fr','lu']:ajouter('kit_'+pays+'_'+cle,'kit_national','Camp '+('0, France' if pays=='fr' else '1, Luxembourg'))
    terrains={'P':'plaine','F':'foret','V':'riviere','R':'route','N':'pont'}
    presents=set(''.join(carte['grille']))
    if not presents<=set(terrains)|{'H'}:raise ValueError('Nouveau terrain : sélection à compléter.')
    for car,cle in terrains.items():
        if car in presents:ajouter('terrain_'+cle,'terrain',f'Cases {car} présentes sur la carte')
    ajouter('batiment_qg_fr_ile_de_france','batiment','Choix régional explicite pour le terrain français ; masque neutre pour le QG non possédé')
    ajouter('batiment_qg_lu','batiment','Option de présentation du QG pour le camp Luxembourg',True)
    ajouter('decor_arbre_plaine_fr_ile_de_france','decor','Décor optionnel de plaine ; aucune instance procédurale remplacée automatiquement',True)
    ajouter('decor_arbre_foret_fr_centre_val_de_loire','decor','Décor optionnel de forêt française ; choix régional voisin explicite',True)
    ajouter('decor_rocher_plaine','decor','Décor optionnel de plaine',True)
    fichiers={}
    actifs=[]
    for selection in selections:
        id=selection['id']; dossier=ROOT/'assets/livraisons'/id
        candidats=sorted(p for p in dossier.iterdir() if p.suffix in ['.glb','.png'] and p.name.startswith(id+'_')) if dossier.exists() else []
        source='assets/livraisons/'+id
        if id=='terrain_plaine':
            dossier=ROOT/'public/assets/modeles';source='public/assets/modeles'
            candidats=sorted(p for p in dossier.iterdir() if p.suffix in ['.glb','.png'] and p.name.startswith(id+'_'))
        if not any(p.suffix=='.glb' for p in candidats):raise ValueError(f'GLB absent : {id}')
        liste=[]
        for p in candidats:
            if p.is_symlink():raise ValueError(f'Source symbolique refusée : {p}')
            nom=f'modeles/{id}/{p.name}'
            if nom in fichiers:raise ValueError('Collision '+nom)
            fichiers[nom]=p.read_bytes();liste.append(nom)
        actifs.append(dict(**selection,source=source,etat='livraison_existante_preservee' if id=='terrain_plaine' else 'candidat_non_approuve_artistiquement',fichiers=liste))
    fichiers['mission/scenario.json']=(ROOT/'content/scenarios/premier_contact.json').read_bytes()
    fichiers['mission/carte.json']=(ROOT/'content/cartes'/f"{scenario['carteCle']}.json").read_bytes()
    refs=verifier_refs(fichiers)
    manifest={'version':1,'mission':scenario['cle'],'scenarioVersion':scenario['version'],'catalogueVersion':scenario['catalogueVersion'],'carte':carte['cle'],'statut':'lot_autonome_de_candidats_non_approuves','archive':ZIP.name,'unitesDepart':depart,'unitesRecrutablesSupplementaires':recrutables,'camps':[{'camp':0,'pays':'fr','commandant':commandants[0]},{'camp':1,'pays':'lu','commandant':commandants[1]}],'selectionRegionale':{'batimentFrancais':'fr_ile_de_france','arbreForetOptionnel':'fr_centre_val_de_loire','justification':'Aucun QG français générique dans le catalogue ; choix de présentation explicite, sans modifier la mission.'},'limitations':['Les candidats ne sont pas approuvés artistiquement.','Ce lot ne remplace aucun modèle servi au jeu et ne modifie pas les réglages de chargement.','Les bâtiments et décors constituent une sélection éditoriale ; les accessoires procéduraux du rendu ne sont pas tous des GLB de ce lot.','La plaine est copiée depuis la livraison existante ; aucune nouvelle approbation n’est donnée.','Les géométries communes actuelles sont fournies pour une mission catalogue 4 ; cela ne modifie aucune statistique de ce catalogue.'],'assets':actifs,'fichiers':[{'chemin':n,'octets':len(b),'sha256':sha(b)} for n,b in sorted(fichiers.items())],'references':refs}
    texte=json.dumps(manifest,ensure_ascii=False,indent=2)+'\n'
    readme='''# Premier contact — GLB et textures autonomes

Ce lot rassemble les modèles existants utiles au premier entraînement, **infanterie comprise**. Il contient les cinq bases possibles, leurs kits France/Luxembourg, les cinq terrains présents, deux choix de QG et trois décors optionnels. Les unités initiales sont infanterie, char léger et reconnaissance ; meca et génie couvrent les recrutements possibles au QG.

Décompresser toute l’archive en conservant les sous-dossiers. Chaque GLB référence les PNG voisins par des chemins relatifs. Les niveaux de détail et variantes de texture présents dans les lots sources sont inclus. Un lecteur glTF doit charger ces voisins ; ouvrir le GLB isolé sans ses PNG ne suffit pas.

Les candidats restent **non approuvés artistiquement**. Rien n’est installé dans le jeu par cette archive. Le QG français d’Île-de-France est un choix régional explicite ; les trois décors sont optionnels et ne prétendent pas reproduire exactement le semis procédural de la carte.

Le manifeste donne les identifiants, provenances, empreintes SHA-256 et références de tous les GLB. Le script vérifie également ces références dans le ZIP final. La plaine existante est réutilisée sans modification.

Reproduire depuis la racine du dépôt : `python3 scripts/missions/packager-premier-contact.py`.
'''
    SORTIE.mkdir(parents=True,exist_ok=True)
    (SORTIE/'manifest.json').write_text(texte)
    (SORTIE/'README.md').write_text(readme)
    fichiers['manifest.json']=texte.encode();fichiers['README.md']=readme.encode()
    with zipfile.ZipFile(ZIP,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for nom,b in sorted(fichiers.items()):
            info=zipfile.ZipInfo(nom,(2026,9,9,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o644<<16;z.writestr(info,b)
    with zipfile.ZipFile(ZIP) as z:
        if z.testzip() is not None:raise ValueError('CRC ZIP invalide')
        recu={n:z.read(n) for n in z.namelist()}
    verifier_refs(recu)
    for entree in manifest['fichiers']:
        if sha(recu[entree['chemin']])!=entree['sha256']:raise ValueError('Empreinte divergente '+entree['chemin'])
    validation={'ok':True,'archive':ZIP.name,'sha256':sha(ZIP.read_bytes()),'octets':ZIP.stat().st_size,'assets':len(actifs),'glb':sum(n.endswith('.glb') for n in fichiers),'png':sum(n.endswith('.png') for n in fichiers),'referencesVerifiees':len(refs),'approbationArtistique':False,'activationEnJeu':False}
    (SORTIE/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(validation,ensure_ascii=False))

if __name__=='__main__':main()
