"""B103: make the royal circulation an actual ring around the palace,
with linked gate, hoist and stair approaches. Relocate the western residential
wing to preserve the eastern castle access landing.
"""
import sys,pathlib,json,math
from shapely.geometry import shape,LineString
from shapely.ops import nearest_points
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Refuse existing B103')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
castle=shape(next(x['geometry']for x in p['landDomains']if x['id']=='castle'))
inner=castle.buffer(-10)
if inner.geom_type=='MultiPolygon':inner=max(inner.geoms,key=lambda g:g.area)
if inner.is_empty or inner.area<30000:raise RuntimeError('Invalid castle inner corridor')
ring=LineString(inner.exterior.coords).simplify(2.6,preserve_topology=True)
points=[list(x)+[204.]for x in list(ring.coords)]
if points[0]!=points[-1]:points.append(list(points[0]))
routes={r['id']:r for r in p['routes']}
old=routes['castle_contour_1']
oldLength=old['lengthM']
old['points']=points
old['lengthM']=ring.length
old['width']=6.5
old['z0']=204.;old['z1']=204.;old['grade']=0
# One continuous curve mesh for the route instead of the inherited wavy loop.
def deck(name,pts,width,z=204.15,mat='lane'):
 verts=[];faces=[]
 for i,(a,b) in enumerate(zip(pts,pts[1:])):
  dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
  if ln<1e-5:continue
  nx=-dy/ln*width*.5;ny=dx/ln*width*.5
  j=len(verts)
  verts.extend([[a[0]+nx,a[1]+ny,z],[a[0]-nx,a[1]-ny,z],
                [b[0]-nx,b[1]-ny,z],[b[0]+nx,b[1]+ny,z]])
  faces.append([j,j+1,j+2,j+3])
 return dict(name=name,vertices=verts,faces=faces,material=mat)
found=next(m for m in p['meshes']if m['name']=='castle_contour_1')
found.update(deck('castle_contour_1',points,old['width']))
# Redistributed castle occupancy, no collision with the central processional path.
changed=[]
for m in p['meshes']:
 if m['name'].startswith('b101_western_residence_wing_'):
  for v in m['vertices']:
   v[0]-=21.;v[1]-=125.
  changed.append(m['name'])
def link(name,sourceId,endpoint):
 r=routes[sourceId];orig=r['points'][endpoint]
 pt=nearest_points(LineString(points).boundary if False else LineString(points),
                  __import__('shapely').geometry.Point(orig[0],orig[1]))[0]
 q=list(pt.coords[0])+[204.]
 start=list(orig)
 if math.dist(start[:2],q[:2])<2:return
 new=[start,q]
 length=math.dist(start[:2],q[:2])
 rr=dict(id=name,points=new,width=4,kind='life',z0=204.,z1=204.,lengthM=length,grade=0)
 p['routes'].append(rr)
 m=deck(name,new,4.25)
 p['meshes'].append(m)
 return dict(name=name,sourceId=sourceId,lengthM=length,start=start,end=q)
ties=[]
for name,source,index in [
 ('castle_ring_civic_access','castle_lane_1',0),
 ('castle_ring_east_ramp_link','castle_east_ramp_landing_1',1),
 ('castle_ring_west_stair_link','castle_wall_stairs_landing_1',1),
 ('castle_ring_hoist_link','castle_hoist_upper_landing',1)]:
 info=link(name,source,index)
 if info:ties.append(info)
p['audit']['routeCount']=len(p['routes'])
report=dict(base=src.name,status='PENDING_COLLISION_QA',
  originalContourLengthM=oldLength,newContourLengthM=ring.length,
  updatedMeshes=['castle_contour_1']+changed,
  insertedMeshes=[x['name']for x in ties],links=ties,
  wingShiftM=[-21,-125],
  intention='Ring follows outer curtain inside plateau; central inner structures remain separate from public circulation',
  limitations=['Need full floor/edge and actual player walking tests',
               'Existing castle outer terrain and long ramps remain WIP'])
p['castleCirculationB103']=report
out.mkdir()
for fname,v in [('plan.json',p),('parcels.json',d),('castle-circulation.json',report)]:
 (out/fname).write_text(json.dumps(v,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(path=str(out),ties=len(ties),newContourLengthM=round(ring.length),
 wingMeshCount=len(changed))))
