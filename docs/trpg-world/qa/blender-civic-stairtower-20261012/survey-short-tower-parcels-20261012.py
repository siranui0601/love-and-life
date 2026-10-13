import json,pathlib,math,collections
from shapely.geometry import Point,LineString,shape
p=json.loads((pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')/'plan.json').read_text('utf8'))
par=json.loads((pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')/'parcels.json').read_text('utf8'))
center=Point(636,664)
for radius in(18,20,22):
 disk=center.buffer(radius,resolution=24)
 print('RADIUS',radius)
 arr=[]
 for a in par['parcels']:
  geom=shape(a['geometry'])
  if not geom.intersects(disk):continue
  inter=geom.intersection(disk).area
  if inter>1:arr.append((a['id'],a.get('district'),round(inter,1)))
 print('PARCEL_CROSSING',len(arr),'SAMPLE',arr[:20])
for r in p['routes']:
 if r['id']=='current_civic_upper_short_stair_east':continue
 points=r['points'];hit=[x for x in points if math.hypot(x[0]-636,x[1]-664)<22]
 if hit:
  print('ROUTE_NEAR',r['id'],len(hit),'z',[round(min(a[2]for a in hit),1),round(max(a[2]for a in hit),1)],'examples',[[round(v,1)for v in a]for a in hit[:2]])
