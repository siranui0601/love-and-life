"""Rebuild a new full-city version from the accepted assets and new terrain study.
Every intermediate directory is preserved. Never overwrites an existing study.
"""
import pathlib,sys,subprocess,shutil,os
root=pathlib.Path(sys.argv[1]);scripts=pathlib.Path(__file__).parent
stage=lambda n:root/('design-b'+str(n))
if stage(51).exists():raise RuntimeError('Integrated study directories already exist')
stage(51).mkdir();shutil.copy2(stage(46)/'plan.json',stage(51)/'plan.json')
def run(script,*args):
 print('START',script,*map(str,args),flush=True)
 subprocess.run([sys.executable,str(scripts/script),*map(str,args)],check=True)
 print('DONE',script,flush=True)
run('parcel-city.py',stage(51)/'plan.json')
run('author-capital-sites.py',stage(51),stage(52))
for a,b in [(52,53),(53,54)]:
 run('repair-block-interiors.py',stage(a),stage(b));run('parcel-city.py',stage(b)/'plan.json')
for script,a,b in [('author-orphanage-backlane.py',54,55),('author-garden-loop.py',55,56),('author-burial-court-study.py',56,57),('author-discovery-sites.py',57,58),('author-backcourt-market.py',58,59)]:run(script,stage(a),stage(b))
for flood in [False,True]:run('audit-city-b.py',stage(59)/'plan.json',*(['--flood']if flood else[]))
print('AUTHORING_COMPLETE_NOT_VISUAL_ACCEPTANCE',stage(59),flush=True)
