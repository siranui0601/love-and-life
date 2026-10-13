import pathlib,json,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
source=(root/'plan.json').read_bytes()
s=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.staged.plan.json').read_text('utf8'))
qa=json.loads((root/'user-p0-12-gaps-eastrock-b-exactsite-qa.json').read_text('utf8'))
local=json.loads((root/'user-p0-12-gaps-eastrock-b.local-qa.json').read_text('utf8'))
wall=json.loads((root/'user-p0-12-gaps-eastrock-b-allwall-clearance.json').read_text('utf8'))
roads=json.loads((root/'user-p0-12-gaps-eastrock-b-20261012.roads-qa.json').read_text('utf8'))
meta=s['userReportedPriority12_20261012']
assert hashlib.sha256(source).hexdigest()==meta['sourcePlanSHA256']
assert qa['status']=='PASS' and len(qa['floorResults'])==9 and len(qa['wallResults'])==4
assert local['status']=='PASS' and local['wallBlockCandidates']==0
assert wall['candidateCount']==0 and wall['sampleCount']==12285 and wall['routeCount']==58
assert roads['routesVisited']==1232 and roads['totalFailureRays']==14
meta['status']='ACCEPTED_USER_P0_12_STRUCTURAL_FIRST_PASS_20261012'
meta['acceptance']={
 'exactSiteQA':'user-p0-12-gaps-eastrock-b-exactsite-qa.json',
 'allWallRoadQA':'user-p0-12-gaps-eastrock-b-allwall-clearance.json',
 'localGroundWallQA':'user-p0-12-gaps-eastrock-b.local-qa.json',
 'wholeCityStaticRoadQA':'user-p0-12-gaps-eastrock-b-20261012.roads-qa.json',
 'floorsReported':9,'wallsReported':4,'sitesUnique':12,
 'wallFootingsTested':82,'exactSiteFloorProbes':153,
 'newWallRoadSamples':12285,'newWallRoadCandidates':0,
 'wholeCityRoutes':1232,'wholeCityStaticFailuresRemaining':14,
 'acceptanceScope':'specified spot geometry and static connection only',
 'notAccepted':['remaining other-city floor gaps','game-engine capsule and NPC traversal','castle palace architectural quality','cosmetic final texturing']}
path=root/'user-p0-12-gaps-eastrock-b-20261012.accepted.plan.json'
assert not path.exists()
path.write_text(json.dumps(s,separators=(',',':')),encoding='utf8')
print('ACCEPTED_STAGED_PLAN',len(s['meshes']),len(s['routes']),path.stat().st_size,flush=True)
