"""Add a slower prospect loop to the wall-base garden, keeping the direct path."""
import json,pathlib,sys,math
from shapely.geometry import shape,Point,LineString
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
src=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing study protected')
plan=json.loads((src/'plan.json').read_text());parcels=json.loads((src/'parcels.json').read_text());garden=shape(plan['landscapeStudy']['geometry'])
r=max([r for r in plan['routes']if r['kind']=='garden_walk'],key=lambda r:r['lengthM']);line=LineString([p[:2]for p in r['points']]);a=line.interpolate(.30,normalized=True);b=line.interpolate(.65,normalized=True);mid=line.interpolate(.48,normalized=True);dx=b.x-a.x;dy=b.y-a.y;length=math.hypot(dx,dy);options=[]
for side in [-1,1]:
 for offset in [55,40,28]:
  c=Point(mid.x-dy/length*offset*side,mid.y+dx/length*offset*side);path=LineString([a,c,b]);court=c.buffer(8)
  if garden.buffer(-3).covers(path.buffer(2).union(court)) and path.is_simple:options.append((offset,path,c));break
if not options:raise RuntimeError('No safe garden loop')
_,path,c=max(options,key=lambda o:o[0]);points=[]
for a,b in zip(list(path.coords),list(path.coords)[1:]):
 n=max(1,math.ceil(math.dist(a,b)/3));points.extend([[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,14]for i in range(n)])
points.append([*path.coords[-1],14]);rid='north_garden_prospect_loop';plan['routes'].append(dict(id=rid,kind='garden_walk',width=3.2,points=points,z0=14,z1=14,lengthM=path.length,grade=0,role='optional-life',beats=['prospect','refuge'],purpose='Slower garden detour with a resting court; direct maintenance walk retained'))
paving=path.buffer(1.6,join_style=2).union(c.buffer(8));v=[];f=[]
for tri in constrained_delaunay_triangles(paving).geoms:
 i=len(v);v.extend([[x,y,14.13]for x,y in list(tri.exterior.coords)[:3]]);f.append([i,i+1,i+2])
plan['meshes'].append(dict(name=rid,vertices=v,faces=f,material='lane'))
plan['landscapeStudy']['trees']=[t for t in plan['landscapeStudy']['trees']if Point(t['position'][:2]).distance(paving)>t['radiusM']+1]
plan['landscapeStudy']['restCourt']={'position':[c.x,c.y,14],'radiusM':8,'routeId':rid,'status':'proposed resting/viewpoint space, no new canonical facility'}
plan['audit']['routeCount']=len(plan['routes']);report=dict(status='REQUIRES_VISUAL_REVIEW',routeId=rid,lengthM=path.length,court=plan['landscapeStudy']['restCourt'],treeCount=len(plan['landscapeStudy']['trees']))
for name,value in [('plan.json',plan),('parcels.json',parcels),('garden-loop-audit.json',report)]: (out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps(report))
