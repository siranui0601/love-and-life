import pathlib,json,math,collections
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'plan.json').read_text('utf8'))
ms={a['name']:a for a in plan['meshes']}
def geom(name):
 m=ms[name];V=m['vertices']; ps=[]
 for f in m['faces']:
  vs=[V[i]for i in f]
  if max(v[2]for v in vs)-min(v[2]for v in vs)>.1:continue
  g=Polygon([v[:2]for v in vs])
  if g.is_valid and g.area>.01:ps.append(g)
 return unary_union(ps)
names=['low_city_ground','civic_foot_ground','upper_city_ground','mage_east_ground','mage_quarter_restored_low_ground',
       'western_ascent_noble_service_restored_low_ground']
for name in names:
 if name not in ms:continue
 g=geom(name)
 print('GROUND',name,'area',round(g.area),'parts',len(getattr(g,'geoms',[g])),'bounds',tuple(round(v,1)for v in g.bounds),flush=True)
 for x,y in [(653.45,803.2),(643.45,796),(643.45,803.2),(653.45,796),(1266.7,538.7),(1350,510),(1380,510),(1190,340),(1240,450)]:
  pt=Point(x,y)
  print(' SAMPLE',round(x,1),round(y,1),'cover',g.covers(pt),'distance',round(g.distance(pt),2))
mg=geom('mage_east_ground');lg=geom('mage_quarter_restored_low_ground')
ret=ms['mage_east_retaining'];V=ret['vertices']
edges=[]
for f in ret['faces']:
 coords=[V[i]for i in f]
 top=[v for v in coords if abs(v[2]-70)<.15]
 if len(top)==2 and math.dist(top[0][:2],top[1][:2])>.1:
  edges.append(LineString([top[0][:2],top[1][:2]]))
print('RETAINING_TOP_EDGES',len(edges),'m',round(sum(e.length for e in edges),1))
wall=unary_union(edges)
# Sample unique boundary segments of the elevated ground, identifying missing vertical wall.
per=mg.boundary
boundarylines=[per]if per.geom_type=='LineString'else [x for x in per.geoms if x.geom_type=='LineString']
points=[]
for line in boundarylines:
 for m in [line.interpolate(i*2) for i in range(int(line.length//2)+1)]:
  if m.x<1050 or m.y<280 or m.x>1480 or m.y>600:continue
  distance=wall.distance(m)
  nearLow=lg.distance(m)
  if distance>2.0 and nearLow<100:
   points.append((round(m.x,1),round(m.y,1),round(distance,1),round(nearLow,1)))
print('UNSUPPORTED_NEAR_MAGE_LOW',len(points),'SAMPLES',points[:130])
# Identify long consecutive intervals by geometry and top edge gaps (not claim all are holes)
for name in ('mage_east_ground','mage_quarter_restored_low_ground'):
 g=geom(name)
 print('BOUNDARY',name,'length',round(g.boundary.length,1))
