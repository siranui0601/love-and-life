"""B108 study: pilot short stone staircase and hoist replacing the need to use
1170m civic_royal detour; original ramp retained until route is 3D certified.
No auto-approval. Dedicated steps are ONE watertight mesh rather than one object each.
"""
import json,sys,pathlib,math,shutil
from shapely.geometry import shape,LineString
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('B108 design exists')
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
def mesh(name,vertices,faces,material='stone'):
 obj=dict(name='b108_'+name,vertices=vertices,faces=faces,material=material)
 p['meshes'].append(obj);return obj['name']
def box(name,x0,y0,z0,x1,y1,z1,material):
 v=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]
 fs=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 return mesh(name,v,fs,material)
controls=[
 [610.6,650,42],[656,645,42],
 [639,634,56],[634,639,56],
 [613,628,70],[609,633,70],
 [589,621,84],[585,626,84],
 [603,652,98],[598,656,98],
 [575,632,112],[573.5,631.3,112]]
width=4.5
pts=[]
treads=[];tfaces=[];walls=[];wallfaces=[]
sections=[]; riserCount=0
for index,(a,b) in enumerate(zip(controls,controls[1:])):
 dx=b[0]-a[0];dy=b[1]-a[1];xy=math.hypot(dx,dy)
 dz=b[2]-a[2]
 if xy<.001:continue
 nx=-dy/xy;ny=dx/xy
 n=math.ceil(abs(dz)/.17)if dz>0 else max(1,math.ceil(xy/.9))
 if dz>0: riserCount+=n
 for i in range(n):
  t=i/n;t1=(i+1)/n
  q=[a[j]+(b[j]-a[j])*t for j in range(3)]
  e=[a[j]+(b[j]-a[j])*t1 for j in range(3)]
  z=e[2]if dz>0 else a[2]
  if i==0 and (not pts or pts[-1]!=a):pts.append(list(a))
  pts.append(e)
  v=[]
  for s in [-width/2,width/2]:
   v.extend([[q[0]+nx*s,q[1]+ny*s,z-.18],
             [e[0]+nx*s,e[1]+ny*s,z-.18],
             [e[0]+nx*s,e[1]+ny*s,z+.04],
             [q[0]+nx*s,q[1]+ny*s,z+.04]])
  base=len(treads);treads.extend(v)
  tfaces.extend([[base+j for j in ids]for ids in [
    [3,2,6,7],[0,1,5,4],[0,3,7,4],[1,2,6,5],[0,1,2,3],[4,5,6,7]]])
 # continuous stone railing on either side; do not create a separate
 # object for each riser or baluster.
 for side in [-1,1]:
  a0=[a[0]+nx*side*(width/2+.3),a[1]+ny*side*(width/2+.3)]
  b0=[b[0]+nx*side*(width/2+.3),b[1]+ny*side*(width/2+.3)]
  sz=.33
  ix=-dy/xy*sz;iy=dx/xy*sz
  base=len(walls)
  for zoff in (0,.95):
   for x,y,z in [(a0[0]-ix,a0[1]-iy,a[2]),
                 (a0[0]+ix,a0[1]+iy,a[2]),
                 (b0[0]+ix,b0[1]+iy,b[2]),
                 (b0[0]-ix,b0[1]-iy,b[2])]:
    walls.append([x,y,z+zoff])
  wallfaces.extend([[base+j for j in ids]for ids in
         [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]]])
 sections.append(dict(fromZ=a[2],toZ=b[2],planarLength=round(xy,1),rises=max(0,n if dz else 0)))
routeLength=sum(math.dist(a[:2],b[:2])for a,b in zip(pts,pts[1:]))
mesh('royal_gate_integrated_treads',treads,tfaces,'stairs')
mesh('royal_gate_integrated_parapets',walls,wallfaces,'stone')
route=dict(id='royal_civic_short_stone_stairs',points=pts,width=width,kind='stairs',
 z0=42,z1=112,lengthM=routeLength,grade=70/routeLength)
p['routes'].append(route)
p['audit']['routeCount']=len(p['routes'])
# Rock-faced stepped substructure against the cliff. A wide belt supporting
# the entire staircase — less precarious than independent floating slabs.
supportVs=[];supportFs=[]
for i,(a,b) in enumerate(zip(controls,controls[1:])):
 if b[2]<=a[2]:continue
 dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
 nx=-dy/ln;ny=dx/ln
 for sign in [-1,1]:
  x0,y0=a[0]+nx*sign*(width/2+.7),a[1]+ny*sign*(width/2+.7)
  x1,y1=b[0]+nx*sign*(width/2+.7),b[1]+ny*sign*(width/2+.7)
  j=len(supportVs)
  supportVs.extend([[x0,y0,42],[x1,y1,42],[x1,y1,b[2]],[x0,y0,a[2]]])
  supportFs.append([j,j+1,j+2,j+3])
mesh('royal_stair_natural_rock_backing',supportVs,supportFs,'stone')
# Meaningful lookout galleries at intermediate landings; plot-compatible stone
# decks and 3D forecourt; no game interaction falsely asserted.
for z,xy in [(56,(634,639)),(70,(609,633)),(84,(585,626)),(98,(598,656))]:
 x,y=xy
 box('royal_stair_belvedere_'+str(z),x-5,y-5,z-.8,x+5,y+5,z+.06,'stone')
# Short near-vertical hoist with public drop-off decks; motor/actor logic not implemented.
hx,hy=593,645
for sign,(z,name) in enumerate([(42,'lower'),(112,'upper')]):
 box('hoist_'+name+'_platform',hx-6,hy-6,z-.8,hx+6,hy+6,z+.1,'stone')
for side,(xx,yy) in enumerate([(hx-7,hy-7),(hx+7,hy+7)]):
 box('hoist_guide_'+str(side),xx-.65,yy-.65,42,xx+.65,yy+.65,116,'wood')
box('royal_hoist_head_machine',hx-10,hy-10,113,hx+10,hy+10,117,'stone')
# cargo lift is not a walkable graph route until gameplay logic exists.
# Inspect optional buildings and remove only ordinary plots conflicting
# with the staircase full envelope.
corridor=LineString([a[:2]for a in controls]).buffer(width/2+1,cap_style=2,join_style=2)
removed=[]
for lot in d['parcels']:
 if not shape(lot['geometry']).intersects(corridor):continue
 if lot.get('canonicalFacilityId'):raise RuntimeError('Canonical property conflict '+lot['id'])
 removed.append(lot['id'])
drop=set(removed)
d['parcels']=[x for x in d['parcels']if x['id']not in drop]
for bl in d['blocks']:bl['parcelIds']=[id for id in bl['parcelIds']if id not in drop]
d['audit']['parcelCount']=len(d['parcels'])
# B107 guard wall intersects new staircase at cliff face; trim entire
# segment prisms within a localized gate excavation envelope.
removedWallFaces=[]
for name in ['b107_upper_city_retaining_reconstruction','b107_upper_city_upper_guard_parapet']:
 m=next(q for q in p['meshes']if q['name']==name)
 # Faces in the same 8-vertex segment-prism group. Remove full group if
 # it penetrates the excavation, keeping the other wall segments untouched.
 group=5 if name.endswith('reconstruction')else 3
 old=m['faces'];deleted=set()
 for j in range(0,len(old),group):
  ids=set(x for face in old[j:j+group]for x in face)
  if not ids:continue
  q=__import__('shapely').geometry.MultiPoint([m['vertices'][n][:2]for n in ids])
  if q.convex_hull.intersects(corridor.buffer(2.)):
   deleted.update(range(j,min(j+group,len(old))))
 m['faces']=[face for i,face in enumerate(old)if i not in deleted]
 removedWallFaces.append(dict(name=name,faces=len(deleted)))
report=dict(base=src.name,status='WIP_REAL_MESH_AND_WALK_VALIDATION_REQUIRED',
 newRoute=route,sections=sections,riserCount=riserCount,routeHorizontalM=routeLength,
 originalCivicRoyalRampLengthM=next(q['lengthM']for q in p['routes']if q['id']=='civic_royal_ramp'),
 removedOrdinaryParcels=removed,cutNewWallFaces=removedWallFaces,
 newMeshNames=[x['name'] for x in p['meshes']if x['name'].startswith('b108_')],
 changedWallNames=[q['name']for q in removedWallFaces],
 semantic='public steep stair with four landings/overlooks plus provisional independent cargo hoist',
 limitations=['Old 1170m ramp deliberately retained until alternative passes full QA',
 'Hoist requires game engine functionality and NPC logistics',
 'Massing/intersurface geometry may be unsafe; inspect Blender and rerun ray tests',
 'Not all original retaining walls were cut; inspect intersection around site'])
p['shortRoyalAccessB108']=report
out.mkdir()
for name,val in [('plan.json',p),('parcels.json',d),('short-access-study.json',report)]:
 (out/name).write_text(json.dumps(val,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(base=src.name,lengthM=round(routeLength),risers=riserCount,
 affectedLots=removed,wallFaces=removedWallFaces)))
