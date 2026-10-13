"""Repair documented real floor holes and exposed 42->14m retaining edges
in the existing current scene; no new numbered designs or route deletion.
Creates current/staged-ground-plan.json for post-apply verification.
"""
import json,pathlib,math,sys
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
root=pathlib.Path(sys.argv[1])
p=json.loads((root/'plan.json').read_text(encoding='utf8'))
def meshpoly(name):
 m=next(v for v in p['meshes']if v['name']==name)
 triangles=[]
 for face in m['faces']:
  if len(face)<3:continue
  g=Polygon([m['vertices'][i][:2] for i in face])
  if g.is_valid and g.area>1e-4:triangles.append(g)
 return unary_union(triangles)
upper=next(m for m in p['meshes']if m['name']=='upper_city_ground')
dom=__import__('shapely').geometry.shape(next(a['geometry']for a in p['landDomains']if a['id']=='upper_city'))
oldArea=meshpoly('upper_city_ground')
gaps=dom.difference(oldArea).buffer(0)
pieces=[gaps]if gaps.geom_type=='Polygon' else [g for g in getattr(gaps,'geoms',[])if g.geom_type=='Polygon']
addedArea=0;triangles=0;patchInfo=[]
for polygon in sorted(pieces,key=lambda q:-q.area):
 if polygon.area<3:continue
 faces=constrained_delaunay_triangles(polygon)
 vertsBefore=len(upper['vertices'])
 inserted=0;total=0
 for t in faces.geoms:
  if t.area<.001 or not polygon.buffer(.002).covers(t.representative_point()):continue
  coords=list(t.exterior.coords)[:3]
  ids=[]
  for xy in coords:
   ids.append(len(upper['vertices']))
   upper['vertices'].append([float(xy[0]),float(xy[1]),112.0])
  upper['faces'].append(ids)
  total+=t.area;inserted+=1
 addedArea+=total;triangles+=inserted
 patchInfo.append(dict(areaM2=round(total,2),faces=inserted,centroid=[round(polygon.centroid.x),round(polygon.centroid.y)]))
# Recompute actual coverage independently, not just assuming an area estimate.
newArea=meshpoly('upper_city_ground')
after=dom.difference(newArea.buffer(.02))
if after.area>1.5:raise RuntimeError('Floor gap repair incomplete: '+str(after.area))
# western_ascent_noble_service restored upper patches are disconnected from
# the 42m civic plateau; wall support must be physically continuous at exposed rim.
patch=meshpoly('western_ascent_noble_service_restored_civic_ground')
adjacent=[meshpoly(n)for n in ['civic_foot_ground','noble_west_ground']]
barriers=[]
for m in p['meshes']:
 if not ('retain' in m['name'] or 'support' in m['name'] or 'wall' in m['name']):continue
 for f in m['faces']:
  vv=[m['vertices'][i]for i in f]
  zlo=min(q[2]for q in vv);zhi=max(q[2]for q in vv)
  if zlo>24 or zhi<39:continue
  xy=list(dict.fromkeys((round(q[0],2),round(q[1],2))for q in vv))
  if len(xy)==2:
   seg=LineString(xy)
   if seg.length>.02 and seg.distance(patch.boundary)<3:barriers.append(seg)
existing=unary_union(barriers) if barriers else Point(-9999,-9999)
roads=[]
for r in p['routes']:
 if len(r['points'])<2 or min(r['z0'],r['z1'])>45 or max(r['z0'],r['z1'])<39:continue
 ln=LineString([q[:2]for q in r['points']])
 if ln.intersects(patch.boundary.buffer(r['width']/2+3)):roads.append((r,ln))
vv=[];ff=[];builtL=0;skipped=0;piers=0
def cube_quad(a,b,zbottom,ztop,width=.9):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 nx=-dy/L*width/2;ny=dx/L*width/2
 coords=[(a[0]-nx,a[1]-ny),(b[0]-nx,b[1]-ny),(b[0]+nx,b[1]+ny),(a[0]+nx,a[1]+ny)]
 k=len(vv)
 vv.extend([[x,y,z]for z in (zbottom,ztop) for x,y in coords])
 ff.extend([[k+j for j in f]for f in [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]])
def all_boundary(polygon):
 return [polygon.exterior,*list(polygon.interiors)]
counter=0
for g in patch.geoms if hasattr(patch,'geoms')else [patch]:
 for ring in all_boundary(g):
  coords=list(ring.coords)
  for a,b in zip(coords,coords[1:]):
   edge=LineString([a,b]);L=edge.length
   if L<.3:continue
   count=max(1,math.ceil(L/4.5))
   for i in range(count):
    t=i/count;t2=(i+1)/count
    line=LineString([edge.interpolate(t,normalized=True),edge.interpolate(t2,normalized=True)])
    mid=line.interpolate(.5,normalized=True)
    if any(adj.distance(mid)<1.4 for adj in adjacent):skipped+=1;continue
    if existing.distance(mid)<1.75:skipped+=1;continue
    if any(ln.distance(mid)<r['width']/2+2.3 for r,ln in roads):skipped+=1;continue
    A=line.coords[0];B=line.coords[-1]
    cube_quad(A,B,14,42.14,1.45)
    builtL+=line.length
    if counter%5==0:
     # Centerline pilaster holds the curtain wall, rather than random floating
     # fins; one face on each side of the same wall.
     dx=B[0]-A[0];dy=B[1]-A[1];ll=math.hypot(dx,dy)
     cx=mid.x;cy=mid.y
     cube_quad((cx-dx/ll*.95,cy-dy/ll*.95),(cx+dx/ll*.95,cy+dy/ll*.95),14,43.5,3.4)
     piers+=1
    counter+=1
if builtL<80:raise RuntimeError('Insufficient civic restored support, check masks '+str(builtL))
name='current_civic_restored_exposed_cliff_support'
if any(m['name']==name for m in p['meshes']):raise RuntimeError('Already exists')
p['meshes'].append(dict(name=name,vertices=vv,faces=ff,material='stone'))
audit=dict(status='PENDING_BLENDER_MESH_QA',upperGroundAddedM2=round(addedArea,2),upperGroundFacesAdded=triangles,
upperGroundResidualM2=round(after.area,2),patches=patchInfo,
civicPatchBoundaryM=round(patch.boundary.length,2),civicRestoredWallLengthM=round(builtL,2),
civicRestoredWallPiers=piers,civicSkippedSubedges=skipped,changedMeshNames=['upper_city_ground',name],
routesPreserved=len(p['routes']),limitations=['No full actor capsule yet','Wall cover excludes existing walls and active crossings','Need near-camera structural check'])
p['currentStructuralRepair']=audit
(root/'staged-ground-plan.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'staged-ground-QA.json').write_text(json.dumps(audit,indent=2),encoding='utf8')
print('STAGED',json.dumps(audit))
