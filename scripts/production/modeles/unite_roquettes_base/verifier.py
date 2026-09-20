#!/usr/bin/env python3
"""Deux contrôles autorisés seulement : lot de cet asset et typage TypeScript."""
from pathlib import Path
from datetime import datetime, timezone
import subprocess, json, hashlib, sys
ID='unite_roquettes_base'
source=Path(__file__).resolve().parent
racine=source.parents[3]
sortie=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else racine/'tmp/production-sequentielle'/ID
sha=hashlib.sha256((sortie/f'{ID}_lod0.glb').read_bytes()).hexdigest()
cmd=['npm','run','controler:asset','--','--spec',f'assets/specs/{ID}.json','--lot',str(sortie)]
r=subprocess.run(cmd,cwd=racine,text=True,capture_output=True)
(sortie/'controle-lot.log').write_text(r.stdout+r.stderr)
assert r.returncode==0,(r.stdout,r.stderr)
lot=json.loads(r.stdout[r.stdout.index('{'):]);assert lot['ok']
lot.update({'dateUtc':datetime.now(timezone.utc).isoformat(),'commande':' '.join(cmd),'codeSortie':r.returncode,'sha256Glb':sha})
(sortie/'validation-lot.json').write_text(json.dumps(lot,ensure_ascii=False,indent=2)+'\n')
cmd=['npm','run','typecheck','--','--incremental','false'];r=subprocess.run(cmd,cwd=racine,text=True,capture_output=True)
(sortie/'controle-typage.log').write_text(r.stdout+r.stderr)
assert r.returncode==0,(r.stdout,r.stderr)
typage={'ok':True,'dateUtc':datetime.now(timezone.utc).isoformat(),'commande':' '.join(cmd),'codeSortie':r.returncode,'sha256SourcesTs':{str(p.relative_to(racine)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(source.glob('*.ts'))},'suiteTestsExecutee':False,'buildExecute':False}
(sortie/'validation-typage.json').write_text(json.dumps(typage,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'controleLot':lot['ok'],'typage':typage['ok'],'sha256Glb':sha}))
