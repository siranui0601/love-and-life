import json,pathlib,math
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'royal-east-pocket-20261012.v4.staged.plan.json').read_text('utf8'))
m={a['name']:a for a in p['meshes']}
def xy(n):
 a=m[n];v=a['vertices'];ps=[]
 for f in a['faces']:
  t=[v[i]for i in f]
  if max(q[2]for q in t)-min(q[2]for q in t)>.05:continue
  poly=Polygon([q[:2]for q in t])
  if poly.is_valid and poly.area>.01:ps.append(poly)
 return unary_union(ps)
low=xy('upper_city_ground')
new=xy('repair_royal_east_pocket_low_grade_link_20261012')
rock=p['royalEastPocketRock20261012']['rows']
castle=xy('castle_ground');fore=xy('forecourt_ground')
res=dict(lowLinkNativeOverlap=round(low.intersection(new).area,2),
 rockLowToeFailures=[],rimAlignment=[],faceConnections=[])
for y,xh,zh,xl in rock:
 toe=Point(xl,y);rootPoint=Point(xh,y)
 res['rimAlignment'].append(dict(y=y,topZ=zh,toCastleXY=round(rootPoint.distance(castle),1),
 toForecourtXY=round(rootPoint.distance(fore),1)))
 if not new.buffer(.2).covers(toe):res['rockLowToeFailures'].append((y,xl))
print('ROCK_FOOTING',res,flush=True)
(root/'east-royal-pocket-v4-ground-qa.json').write_text(json.dumps(res,indent=2),encoding='utf8')
