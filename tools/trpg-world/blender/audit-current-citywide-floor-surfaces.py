"""Systemic static floor-support survey across all 1214 authored urban routes.
Treat as anomaly discovery, NOT final player capsule / game navmesh proof.
"""
import bpy,json,math,pathlib,collections,time
from mathutils import Vector
from mathutils.bvhtree import BVHTree
t0=time.time()
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
model=json.loads((root/'plan.json').read_text('utf8'))
pats=('_ground','_floor','_deck','_stair','_bridge','_road','paving','wall_gallery','_landing','_ramp','_treads','_walk','_lane','_contour')
routeMeshNames={r['id']for r in model['routes']}
surfaces=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or not obj.data.polygons:continue
 nm=obj.name.lower()
 if (obj.name in routeMeshNames or any(p in nm for p in pats) or nm in ('current_east_escarpment_rock','current_east_escarpment_stone')) and not any(p in nm for p in ('roof','_window','_rail','_parapet','_support','roofing','_bench')):
  surfaces.append(obj)
vertices=[];faces=[];sources=[]
for ob in surfaces:
 start=len(vertices)
 vertices.extend([ob.matrix_world@v.co for v in ob.data.vertices])
 for q in ob.data.polygons:
  faces.append([start+i for i in q.vertices])
  sources.append(ob.name)
bvh=BVHTree.FromPolygons(vertices,faces)
tested=0;fail=[];byKind=collections.Counter();perZone=collections.Counter()
byKindFailed=collections.Counter();byRouteFailed=collections.Counter();byRouteTotal=collections.Counter()
for r in model['routes']:
 p=r['points'];kind=r.get('kind','unclassified')
 for a,b in zip(p,p[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];dz=b[2]-a[2]
  span=math.hypot(dx,dy)
  if span<.00001:continue
  n=max(1,math.ceil(span/13))
  nx=-dy/span;ny=dx/span
  offsets=(0.,-.75,.75)if r.get('width',2)>2.4 else(0.,)
  for step in range(n):
   u=(step+.5)/n
   x=a[0]+dx*u;y=a[1]+dy*u;z=a[2]+dz*u
   for lateral in offsets:
    src=Vector((x+nx*lateral,y+ny*lateral,z+1.7))
    point,normal,faceId,d=bvh.ray_cast(src,Vector((0,0,-1)),3.3)
    tested+=1;byKind[kind]+=1;byRouteTotal[r['id']]+=1
    ok=point is not None and abs(point.z-z)<.55
    if not ok:
     byKindFailed[kind]+=1
     byRouteFailed[r['id']]+=1
     key=(round(x/20)*20,round(y/20)*20,int(round(z/5)*5))
     perZone[key]+=1
     if len(fail)<400:
      fail.append(dict(route=r['id'],kind=kind,x=round(x,2),y=round(y,2),
                       z=round(z,2),width=r.get('width'),
                       nearestFloorZ=None if point is None else round(point.z,2),
                       lateral=lateral,nearMesh=None if faceId is None else sources[faceId]))
counts=collections.Counter(q['kind']for q in fail)
result=dict(status='ANOMALIES_REQUIRE_TRIAGE',scenario='entire city road center and side support probes',
 timestamp='2026-10-10',routesVisited=len(model['routes']),
 routeLengthKm=round(sum(x.get('lengthM',0)for x in model['routes'])/1000,2),
 candidatesTested=len(surfaces),candidateMeshFaces=len(faces),
 surfaceRays=tested,totalFailureRays=sum(byKindFailed.values()),uniqueRecordedFailures=len(fail),failureExamples=fail,
 failCountsByKind=dict(byKindFailed),
 topFailRoutes=[dict(id=id,failCount=count,rayTotal=byRouteTotal[id])for id,count in byRouteFailed.most_common(40)],
 spatialClusters=[dict(gridX=a[0],gridY=a[1],z=a[2],failRayCount=n) for a,n in perZone.most_common(50)],
 sampleFailureCapped=len(fail)>=400,
 seconds=round(time.time()-t0,1),
 limitations=['Detection scope includes route centrelines with narrow shoulder probes, not full route area',
 'Unmodeled special-purpose walkability surfaces not matching mesh name patterns may cause false positives',
 'No NPC navigation, swept capsule, jumping, stairs comfort or cart movement simulation',
 'Result not a certification of route safety'])
(root/'citywide-floor-anomaly-survey.json').write_text(json.dumps(result,indent=2),encoding='utf8')
print('FLOOR_SWEEP',json.dumps({k:v for k,v in result.items()if k not in ('failureExamples','spatialClusters','limitations')}))
print('TOP_GAP_CLUSTERS',result['spatialClusters'][:20])
print('KIND_FAILURE_EXAMPLES',dict(counts))
