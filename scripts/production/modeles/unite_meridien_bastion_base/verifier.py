#!/usr/bin/env python3
"""Mesures ciblées et typage, sans suite de tests générale, build ou rendu."""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, json, hashlib, sys
ID='unite_meridien_bastion_base'
source=Path(__file__).resolve().parent
racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
python=racine/'tmp/optimisation-lod0/python-env/bin/python'
for script,commande in [('mesurer.py',[str(python)]),('mesurer-poses.ts',['node','--import','tsx']),('mesurer-poses.py',[str(python)]),('mesurer-ressort.py',[str(python)]),('mesurer-jeux.py',[str(python)])]:
 r=subprocess.run(commande+[str(source/script),str(sortie)],cwd=racine,capture_output=True,text=True)
 if r.returncode:print(r.stdout+r.stderr);raise SystemExit(r.returncode)
 print(script+': ok')
fichiers=[p for p in sortie.iterdir() if p.suffix in ['.png','.glb']]
avant={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in fichiers}
commande=['npm','run','--silent','controler:asset','--','--spec',f'assets/specs/{ID}.json','--lot',str(sortie),'--json']
r=subprocess.run(commande,cwd=racine,capture_output=True,text=True)
if r.returncode:print(r.stdout+r.stderr);raise SystemExit(r.returncode)
lot=json.loads(r.stdout)
assert lot['ok'],lot
assert avant=={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in fichiers}
(sortie/'validation-lot.json').write_text(json.dumps(lot,ensure_ascii=False,indent=2)+'\n')
commande=['npm','run','typecheck','--','--incremental','false']
r=subprocess.run(commande,cwd=racine,capture_output=True,text=True)
ts=[*source.glob('*.ts'),racine/'scripts/production/verifier-publication.ts']
rapport={'ok':r.returncode==0,'codeSortie':r.returncode,'commande':' '.join(commande),'dateUtc':datetime.now(timezone.utc).isoformat(),'sortie':r.stdout+r.stderr,'sha256SourcesTs':{str(p.relative_to(racine)):hashlib.sha256(p.read_bytes()).hexdigest() for p in ts},'portee':'Configuration TypeScript du dépôt entière, dont le contrôle de publication ; sans build incrémental ni suite de tests.'}
(sortie/'validation-typage.json').write_text(json.dumps(rapport,ensure_ascii=False,indent=2)+'\n')
if r.returncode:print(r.stdout+r.stderr);raise SystemExit(r.returncode)
print('controler:asset et typecheck : ok')
