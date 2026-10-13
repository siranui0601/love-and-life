import json,pathlib,math,collections
from shapely.geometry import Polygon,Point,LineString,box,shape
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
ms={x['name']:x for x in p['meshes']}
def surface(n):
 m=ms[n];v=m['vertices'];arr=[]
 for f in m['faces']:
  q=[v[i]for i in f]
  if max(t[2]for t in q)-min(t[2]for t in q)>.05:continue
  poly=Polygon([z[:2]for z in q])
  if poly.is_valid and poly.area>.1:arr.append(poly)
 return unary_union(arr)
fore=max(surface('forecourt_ground').geoms,key=lambda x:x.area)
below=surface('upper_city_ground')
wall=[]
for m in p['meshes']:
 v=m['vertices']
 if not v or not m['faces']:continue
 if max(q[0]for q in v)<275 or min(q[0]for q in v)>495 or max(q[1]for q in v)<840 or min(q[1]for q in v)>1020:continue
 for f in m['faces']:
  vv=[v[i]for i in f]
  if max(q[2]for q in vv)-min(q[2]for q in vv)<10:continue
  hi=[q for q in vv if abs(q[2]-156)<.6]
  if len(hi)==2 and math.dist(hi[0][:2],hi[1][:2])>.1:wall.append(LineString([hi[0][:2],hi[1][:2]]))
target=fore.exterior.intersection(box(275,840,495,1020)).difference(unary_union(wall).buffer(2))
parts=[target]if target.geom_type=='LineString'else [q for q in target.geoms if q.geom_type=='LineString']
for line in sorted(parts,key=lambda g:-g.length)[:12]:
 if line.length<10:continue
 print('GAP',round(line.length,1),'start',tuple(round(x)for x in line.coords[0]),'end',tuple(round(x)for x in line.coords[-1]),'bounds',tuple(round(x)for x in line.bounds))
 for k in(0,2,5,8,10):
  pt=line.interpolate(line.length*k/10);n=nearest_points(pt,below)[1]
  print(' STEP',k,'xy',tuple(round(x)for x in pt.coords[0]),'native112Gap',round(pt.distance(below),1),'nearest',tuple(round(x)for x in n.coords[0]))
 near=[]
 for r in p['routes']:
  if r['z0']<111 and r['z1']<111:continue
  dd=LineString([x[:2]for x in r['points']]).distance(line)
  if dd<15:near.append((r['id'],round(dd,1),r['z0'],r['z1']))
 print(' ROUTES',near[:25])
