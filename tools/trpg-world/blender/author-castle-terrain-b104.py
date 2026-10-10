"""B104 castle sectional correction: reposition buildings INSIDE the raised
royal plateau, rebuild defensible contour and connecting castle street.
B103 remains immutable and retained for comparison.
"""
import sys,json,pathlib,math
from shapely.geometry import shape,mapping,Point,LineString,Polygon
from shapely.ops import nearest_points,unary_union
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse existing B104')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
def shift(prefix,dx,dy):
 n=0
 for m in p['meshes']:
  if m['name'].startswith('b101_'+prefix):
   for v in m['vertices']:v[0]+=dx;v[1]+=dy
   n+=1
 if not n:raise RuntimeError('Missing group '+prefix)
 return dict(prefix=prefix,dx=dx,dy=dy,meshes=n)
shifts=[]
for group,x,y in [
 ('principal_throne_hall',-71,-39),
 ('eastern_royal_offices',-33,5),
 ('castle_northwest',8,-30),
 ('castle_northeast',-76,-45),
 ('castle_southeast',-26,9),
 ('castle_southern_outer',-45,8),
 ('royal_gate_left',-67,19),
 ('royal_gate_right',-54,19),
 ('royal_ceremony_court',-57,-26),
 ('royal_processional_cloister_west',-40,-18),
 ('royal_processional_cloister_east',-70,-18),
 ('palace_merlon_',-71,-23)]:
 shifts.append(shift(group,x,y))
# Reshape the curtain as one connected geological polygon; the previous
# 1266m2 indents were an arbitrary unsupported mesh artifact.
castle=next(z for z in p['landDomains']if z['id']=='castle')
prior=shape(castle['geometry']).buffer(0)
hull=prior.convex_hull
addition=hull.difference(prior).buffer(0)
castle['geometry']=mapping(hull)
for t in p['terraces']:
 if t['id']=='castle':t['areaM2']=hull.area
def slab(name,poly,z,mat='ground'):
 vv=[];ff=[]
 parts=[poly]if poly.geom_type=='Polygon' else [g for g in getattr(poly,'geoms',[])if g.geom_type=='Polygon']
 for q in parts:
  if q.area<.15:continue
  for tri in constrained_delaunay_triangles(q).geoms:
   if tri.area<.05:continue
   idx=len(vv)
   vv.extend([[x,y,z]for x,y in list(tri.exterior.coords)[:3]])
   ff.append([idx,idx+1,idx+2])
 p['meshes'].append(dict(name=name,vertices=vv,faces=ff,material=mat))
slab('b104_castle_outer_ground_extension',addition,204.02)
vs=[];fs=[]
for a,b in zip(list(hull.exterior.coords),list(hull.exterior.coords)[1:]):
 i=len(vs)
 vs.extend([[a[0],a[1],156],[b[0],b[1],156],[b[0],b[1],204.02],[a[0],a[1],204.02]])
 fs.append([i,i+1,i+2,i+3])
p['meshes'].append(dict(name='b104_castle_integrated_outer_retaining',vertices=vs,faces=fs,material='stone'))
# Rebuild the essential patrol promenade inside the ACTUAL castle polygon.
ringpoly=hull.buffer(-8)
ring=LineString(list(ringpoly.exterior.coords)).simplify(1.2,preserve_topology=True)
contour=[[x,y,204.]for x,y in ring.coords]
if contour[0]!=contour[-1]:contour.append(list(contour[0]))
routes={r['id']:r for r in p['routes']}
def deck(name,pts,width):
 verts=[];faces=[]
 for a,b in zip(pts,pts[1:]):
  dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
  if ln<.02:continue
  nx=-dy/ln*width/2;ny=dx/ln*width/2
  i=len(verts)
  verts.extend([[a[0]+nx,a[1]+ny,204.16],[a[0]-nx,a[1]-ny,204.16],
    [b[0]-nx,b[1]-ny,204.16],[b[0]+nx,b[1]+ny,204.16]])
  faces.append([i,i+1,i+2,i+3])
 return dict(name=name,vertices=verts,faces=faces,material='lane')
def reset(name,pts,width):
 r=routes[name]
 r.update(points=pts,width=width,z0=204.,z1=204.,grade=0,
    lengthM=sum(math.dist(a[:2],b[:2])for a,b in zip(pts,pts[1:])))
 entry=next(x for x in p['meshes']if x['name']==name)
 entry.update(deck(name,pts,width))
reset('castle_contour_1',contour,6.0)
ceremony=[[185.41598367940756,1164.4657851787913,204],
          [160,1090,204],[172,1040,204],[176,992,204],
          [228,976,204],[277,976,204],[326.30043164392305,1001.9063895699181,204]]
reset('castle_lane_1',ceremony,6.0)
ties=[]
for id in ['castle_ring_civic_access','castle_ring_east_ramp_link',
           'castle_ring_west_stair_link','castle_ring_hoist_link']:
 r=routes[id]
 st=r['points'][0]
 near=nearest_points(Point(st[0],st[1]),ring)[1]
 q=[near.x,near.y,204.]
 reset(id,[st,q],4)
 ties.append(dict(id=id,length=round(routes[id]['lengthM'],1)))
# Declared old palace halls are all re-positioned; verify rectangular main body
# itself lies inside the raised castle footprint.
hall=next(m for m in p['meshes']if m['name']=='b101_principal_throne_hall_block')
coords=hall['vertices'][:4]
poly=Polygon([x[:2]for x in coords])
if not hull.buffer(-4).contains(poly):raise RuntimeError('Main hall still crosses castle edge')
report=dict(base=src.name,status='REQUIRES_3D_QA',
   shifts=shifts,castleLandExtensionM2=addition.area,
   newContourM=ring.length,ties=ties,mainHallWithinCastle=True,
   changedMeshNames=['castle_contour_1','castle_lane_1']+
     [r['id']for r in p['routes']if r['id'].startswith('castle_ring_')],
   addMeshNames=['b104_castle_outer_ground_extension','b104_castle_integrated_outer_retaining'],
   limitations=['Need 3D body/head and support tests','Other district retaining failures remain','Long ramps unresolved'])
p['castleTerrainB104']=report
out.mkdir()
for name,value in [('plan.json',p),('parcels.json',d),('castle-terrain-rebuild.json',report)]:
 (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(output=str(out),hullExtension=round(addition.area),transforms=len(shifts),
newContourM=round(ring.length),connections=len(ties))))
