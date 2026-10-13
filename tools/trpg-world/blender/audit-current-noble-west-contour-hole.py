import bpy,json,pathlib,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
current=json.loads((root/'plan.json').read_text('utf8'))
p=json.loads((root/'noble-west-plan.staged.json').read_text('utf8'))
assert p['routes']==current['routes']
r=next(q for q in p['routes']if q['id']=='noble_west_contour_1')
o=bpy.data.objects['noble_west_contour_1']
assert len(o.data.polygons)==579
assert len([m for m in p['meshes']if m['name']=='noble_west_contour_1'])==1
v=[o.matrix_world@vert.co for vert in o.data.vertices]
f=[list(face.vertices)for face in o.data.polygons]
bvh=BVHTree.FromPolygons(v,f)
floorBad=[];bodyBad=[];totalF=0;totalB=0;guardBad=[];guardTest=0
for i in range(455,463):
 a=r['points'][i];b=r['points'][i+1]
 dx=b[0]-a[0];dy=b[1]-a[1];D=math.hypot(dx,dy);nx=-dy/D;ny=dx/D
 n=max(1,math.ceil(D/.5))
 for step in range(n):
  t=(step+.22)/n;u=(step+.7)/n
  x=a[0]+dx*t;y=a[1]+dy*t
  X=a[0]+dx*u;Y=a[1]+dy*u
  for offs in(-2.25,-.75,0,.75,2.25):
   v0=Vector((x+nx*offs,y+ny*offs,79.55))
   hit,nrm,faceId,distance=bvh.ray_cast(v0,Vector((0,0,-1)),2.5)
   totalF+=1
   if hit is None or abs(hit.z-78)>.5:
    if len(floorBad)<30:floorBad.append([i,round(x,2),round(y,2),offs,None if hit is None else round(hit.z,2)])
   for height in(1.0,1.8):
    pp=Vector((x+nx*offs,y+ny*offs,78+height))
    qq=Vector((X+nx*offs,Y+ny*offs,78+height))
    dd=qq-pp
    h,normal,index,dist=bvh.ray_cast(pp,dd.normalized(),dd.length)
    totalB+=1
    if h is not None and .018<dist<dd.length-.018:
     if len(bodyBad)<25:bodyBad.append([i,offs,round(x,2),round(y,2),round(height,2)])
  if 457<=i<=459:
   for offs in(-3.35,3.35):
    pos=Vector((x+nx*offs,y+ny*offs,80.5))
    h,normal,idx,dist=bvh.ray_cast(pos,Vector((0,0,-1)),2.2)
    guardTest+=1
    if h is None or not (78.9<h.z<79.5):
     if len(guardBad)<20:guardBad.append([round(x,2),round(y,2),offs,None if h is None else round(h.z,2)])
results=dict(status='LOCAL_PASS'if not floorBad and not bodyBad and not guardBad else 'FAIL',
 bridgeM=p['nobleWestRoadBridgeRepair']['bridgeLengthM'],
 footProbes=totalF,footFailures=floorBad,
 bodyHeadRays=totalB,bodyFailures=bodyBad,parapetProbes=guardTest,parapetFailures=guardBad,
 preexistingRoadsUnchanged=True,roadMeshFaceCount=len(o.data.polygons),
 caveats=['Game navmesh/capsule simulation not executed','Masonry arch structural load study not performed',
  'Only a 12m west noble stretch and its immediate approaches were evaluated'])
(root/'noble-west-local-qa.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print('NOBLE_WEST_QA',json.dumps({k:v for k,v in results.items()if k not in('footFailures','bodyFailures','parapetFailures','caveats')}))
if floorBad:print('FLOORFAIL',floorBad)
if bodyBad:print('BODYFAIL',bodyBad)
if guardBad:print('GUARDFAIL',guardBad)
