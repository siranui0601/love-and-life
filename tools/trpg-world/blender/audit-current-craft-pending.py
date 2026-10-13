"""Actual mesh QA of market restored craft district against old market/stairs
and all added structures. Checks old-route preservation, connections, floor
support, body/head collision, parcel preservation. Local and discrete only.
"""
import bpy,json,pathlib,math,sys,collections
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import LineString,Point
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
p=json.loads((root/'staged-craft-plan.json').read_text('utf8'))
old=json.loads((root/'plan.json').read_text('utf8'))
study=p['marketRestoredExplorationCurrent']
now={r['id']:r for r in p['routes']}
roadBase={r['id']:r for r in old['routes']}
preserved=all(now.get(k)==v for k,v in roadBase.items())
paths=[now[rid]for rid in study['newRoadIds']]
if not preserved:raise RuntimeError('Original street changed; refuse')
if len(p['routes'])!=len(old['routes'])+len(paths):raise RuntimeError('Route count invalid')
roadlines={r['id']:LineString([v[:2]for v in r['points']]) for r in p['routes'] if len(r['points'])>1}
ends=[('current_craft_west_spine','market_ascent_short_lower'),
      ('current_craft_east_spine','market_arrival_court_link')]
links={}
for site in study['facilitySites']:
 aid='current_craft_access_'+site['id']
 if aid not in roadlines:raise RuntimeError('Facility inaccessible '+aid)
 ln=roadlines[aid];dist=min(ln.distance(roadlines['current_craft_west_spine']),ln.distance(roadlines['current_craft_east_spine']))
 links[aid]=round(dist,3)
links.update({a+'->'+b:round(roadlines[a].distance(roadlines[b]),3)for a,b in ends})
if max(links.values())>.65:raise RuntimeError('Detached road link: '+str(links))
def eligible(ob):
 if ob.type!='MESH' or len(ob.data.polygons)==0:return False
 if ob.name.startswith('current_craft_'):
  return ob.name not in ('current_craft_road_limestone','current_craft_courtyard_stone','current_craft_garden_grass')
 if ob.name in ('western_ascent_market_ascent_restored_ground','low_city_ground','civic_foot_ground'):return False
 if 'path' in ob.name or 'ground' in ob.name:return False
 bounds=[ob.matrix_world@Vector(v)for v in ob.bound_box]
 a,b,c=[min(q[i]for q in bounds)for i in range(3)]
 A,B,C=[max(q[i]for q in bounds)for i in range(3)]
 if A<-680 or a>-160 or B<70 or b>240 or C<14.35 or c>45:return False
 if A-a>170 or B-b>160 or len(ob.data.polygons)>50000:return False
 return True
objects=[ob for ob in bpy.data.objects if eligible(ob)]
def bvh(objects):
 vs=[];fs=[];owner=[]
 for obj in objects:
  k=len(vs)
  vs.extend([obj.matrix_world@v.co for v in obj.data.vertices])
  for f in obj.data.polygons:
   fs.append([k+j for j in f.vertices]);owner.append(obj.name)
 return BVHTree.FromPolygons(vs,fs),owner,len(fs)
colliders,owners,meshfaces=bvh(objects)
floors=[]
for name in ('western_ascent_market_ascent_restored_ground','low_city_ground','current_craft_road_limestone','current_craft_courtyard_stone','current_craft_garden_grass'):
 if bpy.data.objects.get(name):floors.append(bpy.data.objects[name])
floorTree,floorOwner,floorFaces=bvh(floors)
hits=[];unsupported=[];rays=0;tests=0;hitsBy=collections.Counter()
for r in paths:
 for a,b in zip(r['points'],r['points'][1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
  if length<.01:continue
  nx=-dy/length;ny=dx/length
  N=max(1,math.ceil(length/1.7))
  for i in range(N):
   t=i/N;u=(i+1)/N
   x=a[0]+dx*t;y=a[1]+dy*t
   X=a[0]+dx*u;Y=a[1]+dy*u
   for offset in (-min(1.,r['width']*.26),0,min(1.,r['width']*.26)):
    px=x+nx*offset;py=y+ny*offset
    ex=X+nx*offset;ey=Y+ny*offset
    src=Vector((px,py,15.05))
    floor,n,j,dist=floorTree.ray_cast(src,Vector((0,0,-1)),1.6)
    tests+=1
    if floor is None or abs(floor.z-14.0)>.50:
     if len(unsupported)<80:unsupported.append(dict(route=r['id'],point=[round(px,2),round(py,2)],z=None if floor is None else round(floor.z,2)))
    for h in (1.0,1.85):
     start=Vector((px,py,14+h));end=Vector((ex,ey,14+h))
     v=end-start
     if v.length<.001:continue
     point,n,idx,d=colliders.ray_cast(start,v.normalized(),v.length)
     rays+=1
     if point is not None and .02<d<v.length-.02:
      hitsBy[(r['id'],owners[idx])]+=1
      if len(hits)<85:hits.append(dict(route=r['id'],obj=owners[idx],at=[round(j,2)for j in point]))
res=dict(status='LOCAL_PASS'if not hits and not unsupported else 'FAIL',
 existingRoutesUnchanged=preserved,linkDistancesM=links,siteCount=len(study['facilitySites']),
 newRoutes=len(paths),newRouteLenM=study['newRoadLengthM'],
 testedColliders=len(objects),colliderFaces=meshfaces,castCount=rays,collisions=sum(hitsBy.values()),
 floorSamples=tests,unsupported=len(unsupported),colliderBreakdown=[(k[0],k[1],v) for k,v in hitsBy.most_common()],
 collisionExamples=hits,floorExamples=unsupported,
 limitations=['Discrete rays not full collision capsule or cart radius',
  'Legacy render-only immense aggregate facades excluded',
  'No player/NPC service loop logic or in-game interaction tests',
  'Facilities provisional and do not modify authoritative TRPG spreadsheet'])
(root/'craft-district-real-qa.json').write_text(json.dumps(res,indent=2),encoding='utf8')
print('CRAFT_QA',json.dumps({k:v for k,v in res.items() if k not in('collisionExamples','floorExamples','colliderBreakdown','limitations','linkDistancesM')}))
if hits:print('BLOCKING',res['colliderBreakdown'][:15])
if unsupported:print('UNSUPPORTED_SAMPLE',unsupported[:10])
