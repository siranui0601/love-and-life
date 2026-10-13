"""B105 remove final detected castle road obstructions (24 head/body probes)
without changing city connectivity or old saves.
"""
import sys,json,pathlib
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('B105 protected')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
import shutil
out.mkdir()
shifts=[('eastern_royal_offices',-18,0),('western_command_barracks',40,5)]
changes=[]
for prefix,dx,dy in shifts:
 names=[]
 for m in p['meshes']:
  if m['name'].startswith('b101_'+prefix):
   for v in m['vertices']:v[0]+=dx;v[1]+=dy
   names.append(m['name'])
 if not names:raise RuntimeError('No objects matched '+prefix)
 changes.append(dict(prefix=prefix,dx=dx,dy=dy,meshNames=names))
p['castleClearanceB105']=dict(status='LOCAL_QA_PENDING',base=src.name,shifts=changes)
(out/'plan.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf-8')
shutil.copy2(src/'parcels.json',out/'parcels.json')
(out/'castle-clearance.json').write_text(json.dumps(p['castleClearanceB105'],indent=2))
print('B105_SHIFTED',[(x['prefix'],len(x['meshNames']))for x in changes])
