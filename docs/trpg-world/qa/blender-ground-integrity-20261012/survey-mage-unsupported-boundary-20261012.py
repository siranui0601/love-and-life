import json,math,pathlib,collections
from shapely.geometry import Polygon,Point,LineString
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((root/'plan.json').read_text('utf8'))
ms={m['name']:m for m in p['meshes']}
def flat(name):
 o=ms[name];v=o['vertices'];faces=[]
 for f in o['faces']:
  vv=[v[i]for i in f]
  if max(x[2]for x in vv)-min(x[2]for x in vv)>.02:continue
  poly=Polygon([x[:2] for x in vv])
  if poly.is_valid and poly.area>.1:faces.append(poly)
 return unary_union(faces)
upper=flat('mage_east_ground');low=flat('mage_quarter_restored_low_ground')
rv=ms['mage_east_retaining']['vertices'];top=[]
for f in ms['mage_east_retaining']['faces']:
 v=[rv[i]for i in f]
 a=[x for x in v if abs(x[2]-70)<.2]
 if len(a)==2 and math.dist(a[0][:2],a[1][:2])>.1:top.append(LineString([a[0][:2],a[1][:2]]))
wall=unary_union(top)
parts=[upper]if upper.geom_type=='Polygon'else list(upper.geoms)
segments=[]
for component_id,part in enumerate(parts):
 for ring in [part.exterior,*part.interiors]:
  coords=list(ring.coords)
  for a,b in zip(coords,coords[1:]):
   l=math.dist(a,b)
   if l<.01:continue
   N=max(1,math.ceil(l/2))
   for j in range(N):
    s=(a[0]+(b[0]-a[0])*j/N,a[1]+(b[1]-a[1])*j/N)
    t=(a[0]+(b[0]-a[0])*(j+1)/N,a[1]+(b[1]-a[1])*(j+1)/N)
    mid=Point((s[0]+t[0])/2,(s[1]+t[1])/2)
    if not(1140<mid.x<1370 and 330<mid.y<570):continue
    distLow=low.distance(mid);distWall=wall.distance(mid)
    if distLow<2.0 and distWall>1.4:
     segments.append(dict(component=component_id,xy=[list(map(lambda x:round(x,2),s)),list(map(lambda x:round(x,2),t))],len=round(l/N,2),lowGap=round(distLow,2),wallGap=round(distWall,2)))
print('TARGET_MISSING_WALL_SEGMENTS',len(segments),'TOTAL_M',round(sum(s['len']for s in segments),2))
print('SAMPLES',segments[:65])
cnt=collections.Counter((round((s['xy'][0][0]+s['xy'][1][0])/40)*40,round((s['xy'][0][1]+s['xy'][1][1])/40)*40)for s in segments)
print('CLUSTERS',cnt.most_common(30))
(root/'mage-wall-missing-edge-survey-20261012.json').write_text(json.dumps(segments,ensure_ascii=False,indent=2),encoding='utf8')
