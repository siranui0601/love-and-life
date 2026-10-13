"""Design railings / night lamps for current noble east+west steep stairs.
Never add obstructions to modeled path: buffer check with all nearby roads.
This script updates only current rail-design-current.json; the Blender
script must explicitly apply the plan and overwrite current .blend.
"""
import json,math,pathlib,sys
from shapely.geometry import LineString,Point
from shapely.prepared import prep
root=pathlib.Path(sys.argv[1])
plan=json.loads((root/'plan.json').read_text())
roads=[r for r in plan['routes']if len(r['points'])>1]
target=('noble_east_wall_stair','west_noble_wall_stairs')
result=[]
def XYZat(p,units):
 pts=p['points'];pieces=[math.dist(a[:2],b[:2])for a,b in zip(pts,pts[1:])]
 q=units
 for i,L in enumerate(pieces):
  if q<=L or i==len(pieces)-1:
   t=min(1.,q/max(L,.0001));a=pts[i];b=pts[i+1]
   return tuple(a[j]*(1-t)+b[j]*t for j in range(3)),i
  q-=L
 return tuple(pts[-1]),len(pts)-2
for targetid in target:
 route=next(r for r in roads if r['id']==targetid)
 line=LineString([q[:2] for q in route['points']])
 length=line.length
 near=[]
 for r in roads:
  if r['id']==targetid:continue
  line2=LineString([q[:2]for q in r['points']])
  if not line2.intersects(line.buffer(14)):continue
  near.append((r,line2))
 anchors={side:[]for side in (-1,1)}
 skip=0
 for side in (-1,1):
  # Safety guard goes outside entire 4 m walkable corridor.
  for distance in [6.5+6.0*i for i in range(int((length-13)/6)+1)]:
   xyz,idx=XYZat(route,distance)
   a,b=route['points'][idx:idx+2]
   dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
   if L<.001:continue
   nx=-dy/L;ny=dx/L
   x=xyz[0]+side*3.5*nx;y=xyz[1]+side*3.5*ny;z=xyz[2]
   point=Point(x,y)
   # Avoid guardrails at connecting roads, footpaths, and freight inclines.
   blocked=False
   for neighbor,poly in near:
    if abs(neighbor['z0']-z)>3 and abs(neighbor['z1']-z)>3:continue
    if point.distance(poly)<neighbor['width']/2+1.25:
     blocked=True;break
   if blocked:skip+=1;continue
   if point.distance(line)<2.65:skip+=1;continue
   anchors[side].append(dict(x=round(x,3),y=round(y,3),z=round(z,3),
                   chain=round(distance,1),side=side))
 segments=[]
 for side,bank in anchors.items():
  for a,b in zip(bank,bank[1:]):
   if b['chain']-a['chain']>7.1:continue
   # Guardrail cannot cut corners, turning inward through stair walking area.
   chord=LineString([(a['x'],a['y']),(b['x'],b['y'])])
   if chord.distance(line)<2.64:continue
   if any(abs(r['z0']-a['z'])<=3 or abs(r['z1']-a['z'])<=3
          for r,path in near if chord.distance(path)<r['width']/2+1.1):continue
   segments.append(dict(side=side,a=a,b=b))
 result.append(dict(route=targetid,pathLenM=round(length,1),widthM=route['width'],
                    anchors=anchors,rails=segments,skippedNearCrossings=skip))
report=dict(title='Noble stair protective stone balustrades and lanterns',
 currentOnly=True,design=result,materials=['aged limestone','wrought iron','warm lantern glass'],
 preservedRoadCount=len(roads),
 limitations=['Street-context analytical buffer at 2D XY plus approximate grade',
              '3D collision after applying is mandatory','Scenic handrails are not yet gameplay colliders',
              'No new standalone B117 or other numbered blend files'])
(root/'rail-design-current.json').write_text(json.dumps(report,indent=2),encoding='utf8')
for r in result:print('RAIL_PLAN',r['route'],'anchors',sum(len(x)for x in r['anchors'].values()),'rails',len(r['rails']),'skip',r['skippedNearCrossings'])
