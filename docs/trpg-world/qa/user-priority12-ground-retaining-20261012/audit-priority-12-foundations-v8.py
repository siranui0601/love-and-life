import pathlib,json,math
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
stage=json.loads((root/'user-p0-12-gaps-v8-20261012.staged.plan.json').read_text('utf8'))
meta=stage['userReportedPriority12_20261012']
meshes={m['name']:m for m in stage['meshes']}
def polygons(n):
 m=meshes[n];v=m['vertices'];g=[]
 for face in m['faces']:
  a=[v[i]for i in face]
  if max(q[2]for q in a)-min(q[2]for q in a)>.05:continue
  poly=Polygon([q[:2]for q in a])
  if poly.is_valid and poly.area>.01:g.append(poly)
 return unary_union(g)
native={z:polygons(n)for z,n in [(14,'low_city_ground'),(112,'upper_city_ground'),(42,'civic_foot_ground'),(156,'forecourt_ground'),(70,'mage_east_ground')]}
for f in meta['floors']:
 z=f['height'];native[z]=native[z].union(polygons(f['meshName']))
native[14]=native[14].union(polygons('repair_mage_restored_low_ground_apron_20261012'))
for wall in meta['walls']:
 name=wall['meshNames'][0];m=meshes[name];v=m['vertices']
 points=[]
 for i in range(0,len(v),4):
  c=Point((v[i][0]+v[i+1][0])/2,(v[i][1]+v[i+1][1])/2);points.append(c)
 low=native[wall['minZ']]
 distances=[round(p.distance(low),2)for p in points]
 print('WALL_GROUND_FOOT',wall['tag'],'count',len(points),'maxMissingM',max(distances),
       'unsupported',sum(d>.15 for d in distances),'distanceEach',distances,flush=True)
