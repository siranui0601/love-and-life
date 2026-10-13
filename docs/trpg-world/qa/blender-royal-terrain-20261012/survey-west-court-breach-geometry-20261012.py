import json,pathlib,math
from shapely.geometry import Polygon,LineString,Point,box
from shapely.ops import unary_union,nearest_points
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'));m={o['name']:o for o in p['meshes']}
def floor(name):
 o=m[name];v=o['vertices'];pp=[]
 for f in o['faces']:
  q=[v[i]for i in f]
  if max(t[2]for t in q)-min(t[2]for t in q)>.1:continue
  poly=Polygon([x[:2]for x in q])
  if poly.is_valid and poly.area>.1:pp.append(poly)
 return unary_union(pp)
fore=floor('forecourt_ground');low=floor('upper_city_ground')
p0=max(fore.geoms,key=lambda x:x.area).exterior
wall=[]
for o in p['meshes']:
 V=o['vertices']
 if not V or not o['faces']:continue
 if min(x[0]for x in V)>10 or max(x[0]for x in V)<-150 or max(x[1]for x in V)<900 or min(x[1]for x in V)>1220:continue
 for f in o['faces']:
  v=[V[i]for i in f]
  if max(q[2]for q in v)-min(q[2]for q in v)<9:continue
  hi=[q for q in v if abs(q[2]-156)<.7]
  if len(hi)==2 and math.dist(hi[0][:2],hi[1][:2])>.1:wall.append(LineString([hi[0][:2],hi[1][:2]]))
walls=unary_union(wall)
missing=p0.intersection(box(-125,960,10,1190)).difference(walls.buffer(2))
lines=[missing]if missing.geom_type=='LineString'else [g for g in missing.geoms if g.geom_type=='LineString']
arr=sorted(lines,key=lambda x:-x.length)
print('GAPS',[(round(s.length,1),tuple(round(z)for z in s.bounds))for s in arr[:20]])
for line in arr[:5]:
 print('LINE',round(line.length,2),'coordN',len(line.coords),'start',tuple(round(x,2)for x in line.coords[0]),'end',tuple(round(x,2)for x in line.coords[-1]))
 for k in range(0,11,2):
  z=line.interpolate(line.length*k/10);near=nearest_points(z,low)[1]
  print(' STEP',k,'xy',(round(z.x),round(z.y)),'lowDist',round(z.distance(low),2),'anchor',tuple(round(a)for a in near.coords[0]))
 for r in p['routes']:
  if min(r.get('z0',0),r.get('z1',0))<112 and max(r.get('z0',0),r.get('z1',0))<112:continue
  lin=LineString([q[:2]for q in r['points']]);dist=line.distance(lin)
  if dist<12:print(' PATH_NEAR',r['id'],'z',r.get('z0'),r.get('z1'),'distance',round(dist,1))
