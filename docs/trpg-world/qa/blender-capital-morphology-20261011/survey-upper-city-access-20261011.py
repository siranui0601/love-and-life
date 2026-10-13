import json,pathlib
from shapely.geometry import Point,LineString,shape,box
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((root/'plan.json').read_text('utf8'));q=json.loads((root/'parcels.json').read_text('utf8'))
parcels=unary_union([shape(a['geometry'])for a in q['parcels']if a['district']=='upper_city'])
roads=[(a,LineString([v[:2]for v in a['points']]))for a in p['routes']if a['z0']==a['z1']==112 and len(a['points'])>1]
for id,cx,cy in [('hall',310,650),('forum',-65,710)]:
 edges=[(cx,cy-24),(cx,cy+24),(cx-36,cy),(cx+36,cy)]
 tests=[]
 for x,y in edges:
  for a,road in roads:
   a1,a2=nearest_points(Point(x,y),road)
   walk=LineString([a1,a2]);gap=parcels.intersection(walk.buffer(2.5)).area
   tests.append((round(walk.length,1),round(gap,2),a['id'],(round(a1.x,2),round(a1.y,2)),(round(a2.x,2),round(a2.y,2))))
 print('SITE',id)
 for r in sorted(tests,key=lambda t:(t[1]>0.2,t[0]))[:8]:print('CONNECT',r)
