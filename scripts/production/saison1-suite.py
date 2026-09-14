"""Cartes et missions écrites pour les étapes françaises 3–6, sans tirage aléatoire."""
import json,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def ecrire(p,d): (ROOT/p).write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
base=json.loads((ROOT/'content/scenarios/opus1_fr_02.json').read_text())
DATE='2026-09-14'; A='cmd_ariane_belloc';T='cmd_tomas_reiner';S='cmd_solveig_tamm';O='cmd_hadran_ost';E='cmd_edran_sorel'
def dit(c,t):return {'locuteur':c,'texte':t,'emotion':'neutre'}
def unite(c,t,x,y):return {'camp':c,'type':t,'x':x,'y':y}
def carte(n,nom,w,h,biome,camps):
 return {'cle':f'carte_opus1_fr_{n:02}','code':f'carte_opus1_fr_{n:02}','version':1,'statut':'en_ligne','source':'atlas_map','creeLe':DATE,'majLe':DATE,'nom':nom,'largeur':w,'hauteur':h,'camps':camps,'biome':biome,'grille':[['P']*w for _ in range(h)],'proprietaires':{},'unitesDepart':[]}
def poser(m,x,y,t,c=None):
 m['grille'][y][x]=t
 if c is not None:m['proprietaires'][f'{x},{y}']=c
def ligne(m,x1,y1,x2,y2,t):
 if x1==x2:
  for y in range(min(y1,y2),max(y1,y2)+1):poser(m,x1,y,t)
 else:
  for x in range(min(x1,x2),max(x1,x2)+1):poser(m,x,y1,t)
def scene(cle,j,reps):return {'cle':cle,'declencheur':{'type':'journee','journee':j},'repliques':reps}
def scenario(n,nom,camps,equipes,limit,fonds,revenus,fonds_ia,brouillard=False):
 s=copy.deepcopy(base);s.update(cle=f'opus1_fr_{n:02}',code=f'opus1_fr_{n:02}',version=1,nom='Saison 1 · '+nom,carteCle=f'carte_opus1_fr_{n:02}',creeLe=DATE,majLe=DATE,date=DATE,commandants=[{'camp':i,'commandantCle':c,**({'ia':'ponderee'} if i else {})}for i,c in enumerate(camps)],equipes=equipes,fondsDepart=fonds,fondsDepartParCamp={str(i):fonds if i==0 else fonds_ia for i in range(len(camps))},revenusParBatiment=revenus,revenusParBatimentParCamp={str(i):revenus for i in range(len(camps))},limiteJournees=limit,brouillard=brouillard,dialogueOuverture=[],dialogueVictoire=[],dialogueDefaite=[],scenesDialogue=[],choix=[])
 s['defaite']=[{'type':'qg_perdu'},{'type':'toutes_unites_hors_jeu'},{'type':'limite_journees','journees':limit}]
 for mode in ['normal','difficile']:
  s['modes'][mode].update(fondsDepart=fonds,fondsDepartIa=fonds_ia+(1500 if mode=='difficile' else 0),revenusParBatiment=revenus,revenusIaParBatiment=revenus,brouillard=brouillard,previsionJournees=2 if mode=='normal' else 1,limiteJournees=limit,dureeVisee=25)
 return s
livraisons=[]
def livrer(s,m,objectif,recit,conclusion,conseil):
 m['grille']=[''.join(row)for row in m['grille']];ecrire('content/cartes/'+m['cle']+'.json',m);ecrire('content/scenarios/'+s['cle']+'.json',s)
 livraisons.append({'scenarioCle':s['cle'],'titre':s['nom'],'biome':m['biome'],'objectif':objectif,'conseil':conseil,'recit':recit,'conclusion':conclusion,'entrainement':False,'tutoriel':[]})
# 3 — route en S, bois latéraux et voie rapide surveillée par deux équipes.
m=carte(3,'La voie de service',18,14,'foret',3)
ligne(m,2,11,8,11,'R');ligne(m,8,5,8,11,'R');ligne(m,8,5,15,5,'R');ligne(m,15,2,15,5,'R')
ligne(m,2,2,2,11,'R');ligne(m,2,2,15,2,'R')
for x in [5,6,11,12]:
 for y in [3,4,7,8,9]:poser(m,x,y,'F')
for x,y in [(10,10),(11,11),(12,10),(4,5),(4,6),(14,8)]:poser(m,x,y,'M')
for x,y,t,c in [(1,12,'H',0),(3,11,'U',0),(2,7,'C',None),(8,8,'C',None),(13,5,'C',None),(14,1,'U',1),(16,1,'H',1),(16,11,'H',2),(14,10,'U',2)]:poser(m,x,y,t,c)
m['unitesDepart']=[unite(0,'transport',2,11),unite(0,'char_leger',4,11),unite(0,'infanterie',3,10),unite(0,'infanterie',2,10),unite(0,'artillerie',3,12),unite(0,'recon',4,12),unite(1,'char_leger',12,3),unite(1,'infanterie',13,3),unite(1,'artillerie',14,3),unite(2,'recon',12,9),unite(2,'infanterie',13,9),unite(2,'char_leger',14,9)]
s=scenario(3,m['nom'],[A,T,S],[[0],[1,2]],22,4500,500,1000)
s['victoire']=[{'type':'proteger','uniteRef':'u1','destination':{'x':15,'y':2}}];s['defaite']=[d for d in s['defaite']if d['type']!='toutes_unites_hors_jeu']+[{'type':'unite_perdue','uniteRef':'u1'}]
s['dialogueOuverture']=[dit(A,'Ces batteries sont attendues au dépôt. Amenez le transport signalé jusqu’à la sortie du nord-est avant la fin de J22. S’il est mis hors jeu, le convoi est perdu.'),dit(T,'Je ferme l’accès du nord. Solveig remonte par le sud-est : deux équipes, mais une seule destination à défendre.'),dit(S,'La grande route vous rapproche de mes véhicules. Le détour ouest est plus long. Choisissez avant de séparer votre escorte.'),dit(A,'Nous n’avons pas besoin de prendre leurs QG. Le chargement doit arriver, c’est tout.')]
s['dialogueVictoire']=[dit(A,'Le dépôt confirme la livraison. Tomas a perdu le match ; il nous propose pourtant son pont pour la prochaine liaison.'),dit(T,'Les batteries sont bien arrivées. À présent, il faut raccorder nos deux rives. Demain je vous couvre.')]
s['dialogueDefaite']=[dit(A,'Le convoi n’est pas arrivé. On reprend avec une escorte resserrée et une route choisie dès le départ.')]
s['scenesDialogue']=[scene('fr03_route',5,[dit(A,'Regardez où se trouve le transport. Un détour encore couvert vaut mieux qu’une route libérée trop loin devant lui.')])]
livrer(s,m,'Amener le transport désigné à la sortie nord-est (16:3) avant la fin de J22. Sa perte fait perdre la mission.','Les batteries promises aux communes prennent la route. Tomas et Solveig disputent les deux accès au dépôt. Ariane vous confie le convoi.','Le convoi passe. Tomas propose de mettre ses moyens en commun pour rétablir la liaison entre les deux rives.','Gardez un véhicule de couverture à portée du transport. Prendre les QG adverses ne remplace pas l’escorte.')
# 4 — deux rives, deux joueurs alliés, deux ponts à coordonner.
m=carte(4,'Deux rives, un réseau',20,14,'foret',3)
ligne(m,9,0,9,13,'V');ligne(m,2,4,17,4,'R');ligne(m,2,10,17,10,'R');poser(m,9,4,'N');poser(m,9,10,'N');ligne(m,17,4,17,10,'R')
for x in [5,6,12,13]:
 for y in [2,3,6,7,8,11]:poser(m,x,y,'F')
for x,y in [(7,6),(7,7),(11,6),(11,7)]:poser(m,x,y,'M')
for x,y,t,c in [(2,11,'H',0),(3,10,'U',0),(2,2,'H',1),(3,4,'U',1),(18,7,'H',2),(16,7,'U',2),(7,10,'C',None),(7,4,'C',None),(12,10,'C',None),(12,4,'C',None),(16,2,'T',None)]:poser(m,x,y,t,c)
m['unitesDepart']=[unite(0,'infanterie',4,10),unite(0,'infanterie',3,11),unite(0,'char_leger',5,10),unite(0,'artillerie',4,11),unite(0,'drone',4,9),unite(1,'char_leger',5,4),unite(1,'infanterie',4,4),unite(1,'artillerie',4,3),unite(2,'char_leger',14,10),unite(2,'artillerie',15,9),unite(2,'infanterie',16,8),unite(2,'char_leger',14,4),unite(2,'infanterie',16,6)]
s=scenario(4,m['nom'],[A,T,S],[[0,1],[2]],26,3500,500,3000,True);s['victoire']=[{'type':'capture_qg'}]
s['dialogueOuverture']=[dit(A,'Tomas tient le nord, nous le sud. Notre objectif commun est le QG de Solveig à l’est. La victoire et la vision sont partagées ; chaque équipe garde ses fonds.'),dit(T,'Je prends le pont du nord. Laissez-moi de la place à sa sortie. Mon artillerie n’avancera pas aussi vite que les chars.'),dit(S,'Deux ponts ne font pas deux victoires. Si vous vous pressez tous au même endroit, je prendrai l’autre rive.')]
s['dialogueVictoire']=[dit(T,'Le réseau est relié. Je peux faire analyser nos relevés par l’équipe commune. Il faut payer le transport des capteurs : on ne pourra pas tout garder en caisse.'),dit(A,'Nous avons assez pour une seule option. Partager les relevés nous apportera une reconnaissance au prochain siège. Garder la réserve nous laissera 1 500 fonds pour le préparer.')]
s['dialogueDefaite']=[dit(A,'Nos deux colonnes se sont isolées. Reprenons avec un passage pour chacune et une réserve près du fleuve.')]
s['scenesDialogue']=[scene('fr04_liaison',4,[dit(T,'Mon secteur reste visible pour vous. Regardez-le avant de décider où envoyer votre drone.')])]
livrer(s,m,'Capturer le QG adverse avec votre coalition avant la fin de J26.','Tomas couvre la rive nord, vous la rive sud. Solveig défend les deux ponts. Les équipes doivent avancer ensemble sans se gêner.','Le QG est pris. Vous choisissez entre une reconnaissance commune à J2 et une réserve de 1 500 fonds pour La journée sans crédit.','Profitez de la vision alliée. Ne bloquez pas les sorties du pont de Tomas.')
# 5 — matériel prêté contesté ; bataille à réserves finies, sans rivière.
m=carte(5,'Le devis orange',16,14,'plaine',2)
ligne(m,2,7,13,7,'R');ligne(m,5,2,5,11,'R');ligne(m,10,2,10,11,'R');ligne(m,5,2,10,2,'R');ligne(m,5,11,10,11,'R')
for x in [7,8]:
 for y in [4,5,8,9]:poser(m,x,y,'M')
for x,y in [(3,4),(4,4),(3,9),(4,9),(11,4),(12,4),(11,9),(12,9),(6,6),(9,8)]:poser(m,x,y,'F')
for x,y,t,c in [(1,7,'H',0),(2,9,'U',0),(14,7,'H',1),(13,9,'U',1),(6,2,'C',None),(9,11,'C',None),(4,7,'C',0),(11,7,'C',1)]:poser(m,x,y,t,c)
m['unitesDepart']=[unite(0,'char_leger',3,6),unite(0,'char_leger',3,8),unite(0,'artillerie',2,7),unite(0,'infanterie',4,6),unite(0,'infanterie',4,8),unite(0,'recon',3,10),unite(0,'antiair',2,5),unite(1,'char_moyen',12,7),unite(1,'artillerie',13,6),unite(1,'infanterie',11,6),unite(1,'infanterie',11,8),unite(1,'recon',12,4),unite(1,'drone',12,9)]
s=scenario(5,m['nom'],[A,O],[[0],[1]],22,4500,0,0);s['victoire']=[{'type':'hors_jeu_total'}]
s['dialogueOuverture']=[dit(O,'Content de vous retrouver. Le prêt arrive à son terme. Le matériel revient chez nous, avec les relevés produits pendant son utilisation.'),dit(A,'Le bon signé parle du matériel. Pas de nos relevés. Nous avons demandé l’arbitrage prévu au contrat.'),dit(O,'Et je le respecte. Mettons nos équipes sur le terrain. Si vous gagnez, je vous laisse les équipements.'),dit(A,'Mettez toutes les unités d’Ost hors jeu avant la fin de J22. Aucun revenu quotidien. Gardez vos fonds pour les pièces dont vous avez besoin.')]
s['dialogueVictoire']=[dit(O,'Le résultat est net. Gardez le matériel. Le bureau devra seulement recalculer votre crédit ; cela prend parfois quelques jours.'),dit(A,'Il sourit encore. Prévenez les ateliers : on garde le matériel, mais on suspend les commandes jusqu’à la réponse du bureau.')]
s['dialogueDefaite']=[dit(O,'Je reprends les équipements prévus au contrat. Vos équipages quittent le terrain avec les leurs.'),dit(A,'Nous n’avons pas tenu. Reprenons la disposition : il faut contourner son char moyen, pas tout lui présenter de face.')]
s['scenesDialogue']=[scene('fr05_credit',3,[dit(O,'Toujours pas de réponse du bureau ? Gardez un peu de réserve. Les ateliers n’acceptent pas tous les promesses.')])]
livrer(s,m,'Mettre toutes les unités adverses hors jeu avant la fin de J22. Aucun revenu quotidien.','Ost réclame les relevés collectés avec son matériel prêté. Ariane conteste cette clause. Un arbitrage sur le terrain doit décider qui garde les équipements.','Ost respecte le résultat. Le matériel reste, mais votre ligne de crédit part en réexamen.','Le char moyen est lent à contourner. Préservez les deux chars légers et concentrez les tirs d’artillerie.')
# 6 — tenir huit journées, sans revenu ; conséquence jouable du choix fr04.
m=carte(6,'La journée sans crédit',17,15,'montagne',3)
ligne(m,8,2,8,12,'R');ligne(m,3,7,13,7,'R');ligne(m,3,3,3,11,'R');ligne(m,13,3,13,11,'R')
for y in [4,5,9,10]:
 for x in [5,6,10,11]:poser(m,x,y,'M')
for x,y in [(6,6),(7,6),(9,6),(10,6),(6,8),(7,8),(9,8),(10,8),(4,12),(12,12)]:poser(m,x,y,'F')
for x,y,t,c in [(8,11,'H',0),(7,11,'U',0),(8,9,'C',0),(2,2,'H',1),(2,4,'U',1),(14,2,'H',2),(14,4,'U',2),(3,9,'C',None),(13,9,'C',None)]:poser(m,x,y,t,c)
m['unitesDepart']=[unite(0,'infanterie',7,10),unite(0,'infanterie',9,10),unite(0,'char_leger',7,9),unite(0,'char_leger',9,9),unite(0,'artillerie',8,10),unite(0,'recon',8,8),unite(0,'transport',8,12),unite(1,'char_leger',3,5),unite(1,'infanterie',3,4),unite(1,'artillerie',2,5),unite(1,'recon',4,6),unite(2,'char_leger',13,5),unite(2,'infanterie',13,4),unite(2,'artillerie',14,5),unite(2,'recon',12,6)]
s=scenario(6,m['nom'],[A,E,O],[[0],[1,2]],12,0,0,0);s['victoire']=[{'type':'survivre','journees':8}]
s['renforts']=[{'journee':9,'unites':[unite(0,'char_leger',7,13),unite(0,'infanterie',9,13)]}]
s['dialogueOuverture']=[dit(A,'Le crédit est gelé. Pas de revenu aujourd’hui ni les jours suivants. La relève entre au sud au début de J9 : gardez le QG et au moins une unité jusque-là.'),dit(E,'Edran Sorel, équipe Méridienne. Je peux faire accélérer votre dossier. Il faudrait me confier l’accès aux relevés.'),dit(A,'Ces relevés ne sont pas une caution. Nous tiendrons avec ce que nous avons.'),dit(O,'Les règles sont publiées. Huit journées. Sorel par l’ouest, moi par l’est.'),dit(A,'Le choix fait après Deux rives, un réseau s’applique ici : une reconnaissance à J2 si vous avez partagé les relevés, ou 1 500 fonds si vous avez gardé la réserve.')]
s['dialogueVictoire']=[dit(A,'La relève est là. Les ateliers ont accepté nos commandes sans la garantie de Sorel.'),dit(E,'Une ligne de crédit ne dit pas tout sur une équipe. Je le reconnais.'),dit(A,'Une patrouille rentre avec ses batteries vides. On va relever son parcours avant de repartir ; la suite de cette enquête reste à venir.')]
s['dialogueDefaite']=[dit(A,'La ligne n’a pas tenu jusqu’à la relève. Reprenons avec des positions plus proches : notre artillerie doit couvrir les deux accès.')]
s['scenesDialogue']=[scene('fr06_releve',7,[dit(A,'Encore deux journées avant l’entrée de la relève. Restez autour du QG ; inutile de poursuivre ceux qui reculent.')])]
livrer(s,m,'Survivre jusqu’au début de J9, avec le QG et au moins une unité. Aucun revenu quotidien.','Le crédit est bloqué. Ost et Edran Sorel ferment les deux routes, tandis que votre relève approche. Les moyens conservés après le match des deux rives servent maintenant.','La relève arrive. Une patrouille rapporte des batteries anormalement vides : la prochaine enquête reste à préparer.','Le choix précédent est effectif ici. Couvrez les accès du QG sans disperser vos soutiens.')
# Ajouter en fin de parcours sans déplacer les missions ni les victoires existantes.
c=json.loads((ROOT/'content/campagne.json').read_text());cles={m['scenarioCle']for m in livraisons};c['missions']=[m for m in c['missions']if m['scenarioCle']not in cles]+livraisons
for m in c['missions']:
 if m['scenarioCle']=='opus1_fr_02':m['conclusion']='Deux villes approvisionnent les ateliers. Les batteries partent maintenant vers le dépôt des communes : vous commandez le convoi de La voie de service.'
ecrire('content/campagne.json',c)
s=json.loads((ROOT/'content/scenarios/opus1_fr_02.json').read_text());s['version']=2;s['majLe']=DATE;s['dialogueVictoire']=[dit(A,'Deux villes approvisionnent les ateliers. Préparez le convoi : nous passons par la voie de service pour livrer les batteries au dépôt des communes.')];ecrire('content/scenarios/opus1_fr_02.json',s)
print(json.dumps({'missions':[m['scenarioCle']for m in livraisons],'parcours':len(c['missions'])}))
