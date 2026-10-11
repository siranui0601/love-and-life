import json,pathlib,math
from shapely.geometry import Point,LineString,Polygon
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((root/'plan.json').read_text('utf8'))
m={a['name']:a for a in p['meshes']}
v=m['castle_ground']['vertices'];castle=unary_union([Polygon([v[i][:2]for i in f])for f in m['castle_ground']['faces'] if len(f)>2])
pts=list(castle.simplify(.5,preserve_topology=True).exterior.coords)
print('PERIMETER_POINTS',len(pts))
for a,b in zip(pts,pts[1:]):
 if max(a[0],b[0])<155 or min(a[0],b[0])>260 or max(a[1],b[1])<1015 or min(a[1],b[1])>1160:continue
 print('EDGE',tuple(round(x,2)for x in a),tuple(round(x,2)for x in b),'len',round(math.dist(a,b),2))
for r in p['routes']:
 xy=LineString([q[:2]for q in r['points']])
 near=xy.distance(LineString([(164,1052),(247,1114)]))
 if near<60 and (r.get('z0',0)>130 or r.get('z1',0)>130):
  print('ROUTE',r['id'],'nearM',round(near,2),'z',r['z0'],r['z1'],'len',round(r['lengthM']),'start',[round(x,1)for x in r['points'][0]],'end',[round(x,1)for x in r['points'][-1]])
for name in('castle_retaining','repair_royal_cliff_tapered_revetment','b104_castle_integrated_outer_retaining','current_east_escarpment_rock','castle_wall_stairs_support'):
 t=m[name];q=t['vertices']
 print('MESH',name,'bbox',[(round(min(v[i]for v in q)),round(max(v[i]for v in q)))for i in(0,1,2)],'N',len(q))
