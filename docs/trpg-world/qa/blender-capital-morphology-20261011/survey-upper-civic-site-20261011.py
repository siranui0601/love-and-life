import json,pathlib,math
from shapely.geometry import box,shape,LineString,Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'));q=json.loads((root/'parcels.json').read_text('utf8'))
dom=shape(next(a['geometry']for a in p['landDomains']if a['id']=='upper_city'))
pcls=[shape(a['geometry'])for a in q['parcels']if a['district']=='upper_city'];built=unary_union(pcls)
roads=[(a,LineString([v[:2]for v in a['points']]))for a in p['routes']if a['z0']==a['z1']==112 and len(a['points'])>1]
roadunion=unary_union([line.buffer(max(2,a.get('width',3)/2)+2)for a,line in roads])
park=Point(200,610).buffer(75)
res=[]
for x in range(-215,390,15):
 for y in range(650,1170,15):
  rect=box(x-33,y-22,x+33,y+22)
  if not dom.buffer(-5).contains(rect):continue
  occ=rect.intersection(built).area;street=rect.intersection(roadunion).area
  if occ>10 or street>12 or rect.intersects(park):continue
  nearest=min(((line.distance(Point(x,y)),a['id'])for a,line in roads),key=lambda z:z[0])
  if nearest[0]>110:continue
  score=round(140-min(110,nearest[0])*1.1-(abs(x-100)+abs(y-850))*.03,2)
  res.append((score,x,y,round(occ),round(street),round(nearest[0],1),nearest[1]))
print('TOP_SITES',len(res))
for a in sorted(res,reverse=True)[:35]:print('SITE',a)
