import json,pathlib,hashlib
from shapely.geometry import Polygon,LineString,shape
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
base=root/'plan.json';raw=base.read_bytes();p=json.loads(raw);stats=[]
for zone,z in [('mage_east',70),('civic_foot',42),('low_city',14)]:
 dom=shape(next(a['geometry']for a in p['landDomains']if a['id']==zone))
 m=next(x for x in p['meshes']if x['name']==zone+'_ground')
 oldN=len(m['vertices']);oldF=len(m['faces'])
 old=unary_union([Polygon([m['vertices'][j][:2]for j in f])for f in m['faces']if len(f)>=3])
 missing=dom.difference(old.buffer(.12))
 tiles=[]
 for ob in p['meshes']:
  n=ob['name'].lower()
  if ob['name']==zone+'_ground' or any(k in n for k in ('roof','wall','retaining','support','parapet','window','pillar','facade','flag','hoist','fence','rail','building','parcel')):continue
  if not any(k in n for k in ('ground','floor','lane','road','paving','contour','stair','landing','deck','path','court','ramp','bridge','treads')):continue
  v=ob['vertices'];rect=missing.bounds
  if not v or max(a[0]for a in v)<rect[0] or min(a[0]for a in v)>rect[2] or max(a[1]for a in v)<rect[1] or min(a[1]for a in v)>rect[3]:continue
  for f in ob['faces']:
   xyz=[v[j]for j in f]
   if max(a[2]for a in xyz)-min(a[2]for a in xyz)>.36 or abs(sum(a[2]for a in xyz)/len(xyz)-z)>.5:continue
   t=Polygon([a[:2]for a in xyz])
   if t.is_valid and t.area>.02 and t.intersects(missing):tiles.append(t)
 existing=unary_union(tiles)if tiles else Polygon()
 remain=missing.difference(existing.buffer(.25))
 protected=[]
 for t in p['routes']:
  if abs(t['z1']-t['z0'])<2:continue
  line=LineString([a[:2]for a in t['points']])
  if line.intersects(missing):protected.append(line.buffer(t.get('width',4)*.5+1.7))
 safe=remain.difference(unary_union(protected).buffer(.25))if protected else remain
 polys=([safe]if safe.geom_type=='Polygon'else [q for q in getattr(safe,'geoms',[])if q.geom_type=='Polygon'])
 polys=[q for q in polys if q.area>15];polys.sort(key=lambda q:-q.area)
 additions=0;area=0.
 for poly in polys:
  for tri in constrained_delaunay_triangles(poly).geoms:
   if tri.area<.015 or not poly.buffer(.0001).covers(tri):continue
   pts=list(tri.exterior.coords)[:3]
   if (pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-(pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0])<0:pts.reverse()
   start=len(m['vertices'])
   m['vertices'].extend([[float(q[0]),float(q[1]),float(z)]for q in pts])
   m['faces'].append([start,start+1,start+2]);additions+=1;area+=tri.area
 meta=dict(mesh=m['name'],z=z,oldVertices=oldN,oldFaces=oldF,newFaces=additions,areaSqm=round(area,2),safeCandidateSqm=round(sum(q.area for q in polys),2),polygons=len(polys),newVertices=len(m['vertices']),routeCount=len(p['routes']))
 if additions==0 or area<50:raise RuntimeError('Invalid new floor '+str(meta))
 stats.append(meta);print('STAGED',meta,flush=True)
out=dict(status='AWAITING_BLENDER_QA',originalPlanSha256=hashlib.sha256(raw).hexdigest(),originalBlend='capital-parcel-review.blend',routes=len(p['routes']),patches=stats)
(root/'floor-void-candidates.plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'floor-void-candidates.study.json').write_text(json.dumps(out,indent=2),encoding='utf8')
print('READY',sum(a['newFaces']for a in stats),sum(a['areaSqm']for a in stats),flush=True)
