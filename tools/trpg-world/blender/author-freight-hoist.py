"""Wall-side freight hoist study: physical landing roads and a moving platform.
Transport is explicitly separate from walking graph. Runtime control is pending.
"""
import json,pathlib,sys,math
from shapely.geometry import Point,Polygon,LineString,shape,mapping
from shapely.ops import nearest_points
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing version protected')
p=json.loads((src/'plan.json').read_text());ds={d['id']:shape(d['geometry'])for d in p['landDomains']}
upper=ds['castle'];lower=ds['forecourt'];roads=[(r,LineString([q[:2]for q in r['points']]))for r in p['routes']]
lowroads=[(r,l)for r,l in roads if r['z0']==r['z1']==156];highroads=[(r,l)for r,l in roads if r['z0']==r['z1']==204]
options=[]
for d in range(0,int(upper.boundary.length),5):
 q=upper.boundary.interpolate(d);lo,lr=min(lowroads,key=lambda v:v[1].distance(q));anchor=nearest_points(q,lr)[1];dx=anchor.x-q.x;dy=anchor.y-q.y;ln=math.hypot(dx,dy)
 if ln<1:continue
 nx,ny=dx/ln,dy/ln;ux,uy=-ny,nx;cx=q.x+nx*7;cy=q.y+ny*7
 plot=Polygon([(cx+ux*a+nx*b,cy+uy*a+ny*b)for a,b in[(-4,-4.5),(4,-4.5),(4,4.5),(-4,4.5)]])
 if not lower.buffer(.1).covers(plot):continue
 hi,hr=min(highroads,key=lambda v:v[1].distance(q));h=nearest_points(q,hr)[1]
 lowlink=LineString([(cx,cy),(anchor.x,anchor.y)]);highlink=LineString([(cx,cy),(h.x,h.y)])
 if lowlink.length>45 or highlink.length>55:continue
 if not lower.buffer(.2).covers(lowlink.buffer(2.5)):continue
 if any(l.distance(plot)<r['width']/2+1 for r,l in roads if r['z0']!=r['z1']):continue
 # The upper bridge must go directly onto castle ground, not cross an unrelated neighbourhood.
 interior=highlink.difference(plot.buffer(3))
 if not upper.buffer(3).covers(interior.buffer(2.5)):continue
 options.append((lowlink.length+highlink.length,cx,cy,nx,ny,plot,lo,hi,lowlink,highlink))
if not options:raise RuntimeError('No wall-adjacent connected cargo site; do not place arbitrarily')
_,cx,cy,nx,ny,plot,lo,hi,lowlink,highlink=min(options,key=lambda q:q[0]);ux,uy=-ny,nx

def box(name,x,y,z,w,d,h):
 v=[[x+ux*a*w/2+nx*b*d/2,y+uy*a*w/2+ny*b*d/2,z+c*h]for c in[0,1]for a,b in[(-1,-1),(1,-1),(1,1),(-1,1)]]
 p['meshes'].append(dict(name=name,vertices=v,faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material='stone'))
def road(name,line,z):
 ps=[[a,b,z]for a,b in line.coords];p['routes'].append(dict(id=name,kind='service',role='service-logistics',width=5,points=ps,z0=z,z1=z,lengthM=line.length,grade=0))
 v=[];f=[]
 for tri in constrained_delaunay_triangles(line.buffer(2.5,cap_style=2)).geoms:
  k=len(v);v.extend([[x,y,z+.16]for x,y in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 p['meshes'].append(dict(name=name,vertices=v,faces=f,material='lane'))
road('castle_hoist_lower_landing',lowlink,156);road('castle_hoist_upper_landing',highlink,204)
# Space for one laden cart; columns sit outside the landing clearance.
box('castle_hoist_platform',cx,cy,155.86,8,9,.3)
for side in [-1,1]:box('castle_hoist_platform_rail_'+str(side),cx+ux*side*4,cy+uy*side*4,156.16,.3,9,1.2)
for side in[-1,1]:
 box('castle_hoist_guide_'+str(side),cx+ux*side*5,cy+uy*side*5,156,.65,.65,52)
 box('castle_hoist_cable_'+str(side),cx+ux*side*3.2,cy+uy*side*3.2,156,.09,.09,52)
box('castle_hoist_header',cx,cy,207,11,1,1)
box('castle_hoist_counterweight',cx+nx*5,cy+ny*5,204,3,1.5,2)
# A crank/winch station is in the lower loading court; power source is mechanical study.
box('castle_hoist_winch',cx+ux*6,cy+uy*6,156,1.5,2,1.8)
p['verticalTransportStudy']=[dict(id='castle_freight_hoist',kind='counterweighted-winch-study',position=[cx,cy,156],lowerZ=156,upperZ=204,platformM=[8,9],lowerRoad=lo['id'],upperRoad=hi['id'],landingRoads=['castle_hoist_lower_landing','castle_hoist_upper_landing'],travelSeconds=64,walkGraphEdge=False,controlState='RUNTIME_UNIMPLEMENTED',socialAccess='Cargo service permission; does not bypass royal access',experience='Visible loading court and moving platform; walking stairs remain separate')]
p['negativeSpaces'].append(mapping(plot.buffer(8).union(lowlink.buffer(5)).union(highlink.buffer(5))))
p['audit']['routeCount']=len(p['routes']);(out/'plan.json').write_text(json.dumps(p,separators=(',',':')));(out/'freight-hoist-study.json').write_text(json.dumps(p['verticalTransportStudy'],indent=2));print(json.dumps(p['verticalTransportStudy']))
