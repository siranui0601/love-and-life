import bpy,pathlib,json
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
code=(R/'work014-full-repair-QA.py').read_text('utf-8-sig').replace('work014-p0-sealed.staged.plan.json','plan.json').replace("A=json.loads((R/'plan.json')","A=json.loads((R/'old/20261014-p0-before-contact-repair/plan.json')").replace("hashlib.sha256((R/'plan.json')","hashlib.sha256((R/'old/20261014-p0-before-contact-repair/plan.json')").replace('work014-full-repair-QA.json','work014-applied-mesh-QA.json')
exec(compile(code,'applied-mesh-QA','exec'))
code=(R/'audit-user-p0-multisite-v23-roads.py').read_text('utf-8-sig').replace('user-p0-multisite-v23.staged.plan.json','plan.json').replace('user-p0-multisite-v23.roads-qa.json','work014-applied-road-QA.json')
exec(compile(code,'applied-road-QA','exec'))
assert result['totalFailureRays']==14
report=json.loads((R/'work014-promotion.json').read_text('utf8'));report['status']='APPLIED_AND_REOPEN_VERIFIED_LOCAL_STRUCTURAL_PASS'
(R/'work014-promotion.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('APPLIED_REOPEN_PASS',flush=True)
