import json,pathlib,collections,math
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');data=json.loads((root/'plan.json').read_text('utf8'))
ms={m['name']:m for m in data['meshes']}
def flat(name):
 m=ms[name];V=m['vertices'];polys=[]
 for f in m['faces']:
  v=[V[i]for i in f]
  if max(x[2]for x in v)-min(x[2]for x in v)>.05:continue
  g=Polygon([x[:2]for x in v])
  if g.is_valid and g.area>.1:polys.append(g)
 return unary_union(polys)
fore=flat('forecourt_ground')
others={n:flat(n)for n in('upper_city_ground','civic_foot_ground','castle_ground','low_city_ground')}
wall=[]
for m in data['meshes']:
 V=m['vertices'];faces=m['faces']
 if not V:continue
 b=(min(x[0]for x in V),min(x[1]for x in V),max(x[0]for x in V),max(x[1]for x in V))
 if b[2]<-150 or b[0]>520 or b[3]<720 or b[1]>1300:continue
 for f in faces:
  v=[V[i]for i in f]
  if max(x[2]for x in v)-min(x[2]for x in v)<10:continue
  a=[x for x in v if abs(x[2]-156)<.6]
  if len(a)!=2:continue
  if math.dist(a[0][:2],a[1][:2])<.1:continue
  wall.append(LineString([a[0][:2],a[1][:2]]))
wh=unary_union(wall)
polys=sorted(list(getattr(fore,'geoms',[fore])),key=lambda q:-q.area)
for i,poly in enumerate(polys):
 print('PART',i,'area',round(poly.area,1),'center',tuple(round(x,1)for x in (poly.centroid.x,poly.centroid.y)),'bounds',tuple(round(x)for x in poly.bounds),'rings',len(poly.interiors),'perimeter',round(poly.boundary.length))
 if i>4:continue
 pts=[]
 for ring in [poly.exterior]:
  d=ring.length
  for j in range(int(d/3)+1):
   p=ring.interpolate(j*3)
   missing=wh.distance(p)>3
   near112=others['upper_city_ground'].distance(p)
   near42=others['civic_foot_ground'].distance(p)
   nearCastle=others['castle_ground'].distance(p)
   pts.append((p.x,p.y,missing,near112,near42,nearCastle))
 runs=[];current=[]
 for idx,t in enumerate(pts):
  if t[2]:current.append(t)
  elif current:
   if len(current)>=5:runs.append(current)
   current=[]
 if len(current)>=5:runs.append(current)
 for r in sorted(runs,key=lambda s:-len(s))[:22]:
  mid=r[len(r)//2];print(' GAP','len',len(r)*3,'start',tuple(round(a) for a in r[0][:2]),'end',tuple(round(a)for a in r[-1][:2]),'mid',tuple(round(a)for a in mid[:2]),'to112',round(mid[3],1),'to42',round(mid[4],1),'castle',round(mid[5],1))
