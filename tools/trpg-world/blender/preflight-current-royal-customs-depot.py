import json,pathlib,math
from shapely.geometry import box,LineString,Point,shape
from shapely.strtree import STRtree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
q=json.loads((root/'parcels.json').read_text('utf8'))
parcel=[shape(qx['geometry'])for qx in q['parcels']];tree=STRtree(parcel)
zone=shape(next(v['geometry']for v in p['landDomains']if v['id']=='civic_foot'))
body=box(701,698,719,712)
approach=LineString([(710,703),(710,698),(716,691),(713,683)])
roads=[]
for r in p['routes']:
 if r['z0']!=42 or r['z1']!=42 or len(r['points'])<2:continue
 line=LineString([v[:2]for v in r['points']])
 if line.distance(body)>70:continue
 roads.append((r,line))
overlap=sum(parcel[int(i)].intersection(body).area for i in tree.query(body))
blockedRoads=[(r['id'],round(line.distance(body),2))for r,line in roads if body.intersects(line.buffer(r['width']/2+2))]
connection=next(r for r in roads if r[0]['id']=='civic_foot_contour_1_retained_0')
near=round(connection[1].distance(Point(713,683)),2)
accessOverlap=sum(parcel[int(i)].intersection(approach.buffer(1.6)).area for i in tree.query(approach.buffer(1.6)))
out=dict(status='PASS'if overlap<.1 and zone.covers(body) and not blockedRoads and near<.5 and accessOverlap<.5 else 'FAIL',
 warehouseFootprint=(701,698,719,712),parcelOverlapM2=round(overlap,3),
 insideCivicDomain=zone.covers(body),blockedExistingRoads=blockedRoads,
 plannedAccessM=round(approach.length,1),roadEndpointOffsetM=near,
 accessParcelOverlapM2=round(accessOverlap,3),plannedRoadID='current_civic_customs_road')
(root/'royal-customs-preflight.json').write_text(json.dumps(out,indent=2))
print('CUSTOMS_PREFLIGHT',json.dumps(out))
