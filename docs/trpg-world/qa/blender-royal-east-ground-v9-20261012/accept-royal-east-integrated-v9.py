import json,pathlib,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes()
plan=json.loads(raw)
stage=json.loads((root/'royal-east-integrated-v9.staged.plan.json').read_text('utf8'))
meta=stage['royalEastIntegratedV9']
qa=json.loads((root/'royal-east-integrated-v9.localqa.json').read_text('utf8'))
roads=json.loads((root/'royal-east-integrated-v9.road-qa.json').read_text('utf8'))
assert meta['sourcePlanSHA256']==hashlib.sha256(raw).hexdigest()
assert stage['routes']==plan['routes'],'Route registry changed'
assert qa['status']=='PASS' and qa['rockNonManifoldEdges']==0 and qa['scanPoints']>4700 and not qa['walkwayHits']
assert roads['routesVisited']==1232 and roads['totalFailureRays']==14
assert meta['nativeLowOverlapM2']>200
assert len(meta['intersectingParcelAreaGt10m2'])==1
meta.update(status='ACCEPTED_STRUCTURAL_FIRST_PASS_20261012',
 finalValidation={'rockClosedManifold':True,'eastWalkwaySamples':qa['scanPoints'],
 'eastRouteCollisionCandidates':len(qa['walkwayHits']),'cityRoutes':roads['routesVisited'],
 'cityFloorFailureRays':roads['totalFailureRays'],'newFloorFailureRays':0,
 'visualViews':['east-ground','east-underwall','east-royalhigh','east-ascent-side']},
 knownLimitations=['Full swept capsule not run','Nearby facade and other castle elevations need art pass',
                   'Other city floor failures remain 14','Static ground connections only',
                   '71m2 forecourt parcel overlaps in plan view, below its Z156 level'])
out=root/'royal-east-integrated-v9.accepted.plan.json'
if out.exists():raise RuntimeError('Already accepted, refusing overwrite')
out.write_text(json.dumps(stage,separators=(',',':')),encoding='utf8')
(root/'royal-east-integrated-v9.accepted.study.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False),encoding='utf8')
print('ACCEPTANCE_STAGED',out.stat().st_size,'sourceSHA',meta['sourcePlanSHA256'],flush=True)
