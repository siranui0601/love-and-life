import pathlib,json,hashlib,shutil,os,datetime
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-complete.staged.plan.json').read_text('utf8'))
qa=json.loads((R/'work014-complete-repair-QA.json').read_text('utf8'))
roads=json.loads((R/'work014-complete-roads-qa.json').read_text('utf8'))
assert qa['status']=='LOCAL_STRUCTURAL_PASS_NOT_CITYWIDE_ACCEPTANCE'
assert roads['surfaceRays']==174749 and roads['totalFailureRays']==14
expected=P['work014WallBaseRepair']['canonicalSHA256']
assert hashlib.sha256((R/'plan.json').read_bytes()).hexdigest()==expected,'concurrent source modification'
backup=R/'old'/'20261014-p0-before-contact-repair';backup.mkdir(parents=True,exist_ok=False)
for n in ['capital-parcel-review.blend','plan.json']:shutil.copy2(R/n,backup/n)
P['userReportedPriority12_20261012']['status']='STRUCTURAL_REPAIR_20261014_CITYWIDE_ACCEPTANCE_INCOMPLETE'
P['work014WallBaseRepair']['state']='APPLIED_STRUCTURAL_REPAIR_REQUIRES_CITYWIDE_AUDIT'
P['work014WallBaseRepair']['appliedAt']=datetime.datetime.now().astimezone().isoformat()
tempPlan=R/'work014-promote.plan.tmp';tempBlend=R/'work014-promote.blend.tmp'
tempPlan.write_text(json.dumps(P,separators=(',',':')),encoding='utf8')
shutil.copy2(R/'work014-p0-complete.pending.blend',tempBlend)
assert hashlib.sha256((R/'plan.json').read_bytes()).hexdigest()==expected
try:
 os.replace(tempBlend,R/'capital-parcel-review.blend')
 os.replace(tempPlan,R/'plan.json')
except Exception:
 for n in ['capital-parcel-review.blend','plan.json']:shutil.copy2(backup/n,R/n)
 raise
report=dict(status='APPLIED_REOPEN_VERIFICATION_PENDING',backup=str(backup),sourcePlanSHA256=expected,blendSHA256=hashlib.sha256((R/'capital-parcel-review.blend').read_bytes()).hexdigest(),planSHA256=hashlib.sha256((R/'plan.json').read_bytes()).hexdigest(),floorRays=sum(s['actualMeshRays'] for s in qa['siteResults']),floorMissing=sum(s['missing'] for s in qa['siteResults']),routeRays=roads['surfaceRays'],remainingRouteAnomalies=roads['totalFailureRays'])
(R/'work014-promotion.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('PROMOTED',json.dumps(report),flush=True)
