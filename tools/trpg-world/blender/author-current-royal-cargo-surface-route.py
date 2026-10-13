import json,pathlib,math
from shapely.geometry import LineString,Point
from shapely.ops import substring,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
lines={r['id']:LineString([v[:2]for v in r['points']])for r in p['routes']if len(r['points'])>=2}
g=lines['civic_wall_gallery_lower'];c=lines['civic_foot_contour_1_retained_0'];depot=lines['current_civic_customs_road']
meet=g.intersection(c)
if meet.geom_type!='Point':raise RuntimeError('Expected unique gallery-contour junction '+meet.geom_type)
gStart=Point(610.578947368421,650)
dStart=Point(713,683)
if g.distance(gStart)>.5 or c.distance(dStart)>.5 or depot.distance(dStart)>.01:raise RuntimeError('Endpoints not close')
gPart=substring(g,g.project(gStart),g.project(meet))
cPart=substring(c,c.project(meet),c.project(dStart))
dPart=depot
coords=list(gPart.coords)+list(cPart.coords)[1:]+list(dPart.coords)
new=LineString(coords)
results=dict(status='PENDING_BLENDER_3D_QA',routeID='royal_customs_to_hoist_existing_streets',
 types=['civic_wall_gallery_lower','civic_foot_contour_1_retained_0','current_civic_customs_road'],
 z=42,widthTestM=2.4,waypoints=[[round(q[0],5),round(q[1],5),42.0]for q in coords],
 segmentLengthsM=[round(gPart.length,2),round(cPart.length,2),round(dPart.length,2)],
 gapAtCustomsM=round(c.distance(dStart),2),geometryLengthM=round(new.length,2),
 caveats=['Only physical path, not NPC AI or freight carry job',
 'No game runtime swept-capsule or cargo transfer implemented'])
(root/'royal-freight-existing-road-surface.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print('FREIGHT_ROAD_PATH',json.dumps({k:v for k,v in results.items()if k!='waypoints'}))
