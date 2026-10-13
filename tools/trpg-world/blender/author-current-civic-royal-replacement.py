"""First cliffside concentrated stair access replacing dependency on a 1170m
civic royal cart ramp (old ramp PRESERVED). Site has zero canonical parcels.
5 real 70-step flights, 200mm rises, 328.6mm treads, 4 3m turns and summit
skybridge. Single consolidated flight mesh rather than one object per step.
Not a cargo elevator; cargo link remains old cart ramp until powered hoist exists.
"""
import json,pathlib,math,sys
from shapely.geometry import Point,LineString,Polygon,shape
from shapely.strtree import STRtree
root=pathlib.Path(sys.argv[1])
p=json.loads((root/'plan.json').read_text('utf8'))
q=json.loads((root/'parcels.json').read_text('utf8'))
name='current_civic_upper_short_stair_east'
if any(r['id']==name for r in p['routes']):raise RuntimeError('already installed')
if any(m['name'].startswith('current_civic_upper_short_')for m in p['meshes']):raise RuntimeError('already applied')
center=(628.,670.)
oldRoutes={z:[]for z in(42,112)}
for r in p['routes']:
 if r['z0']==r['z1'] and r['z0']in oldRoutes and len(r['points'])>1:
  oldRoutes[int(r['z0'])].append((r,LineString([v[:2]for v in r['points']])))
dest={}
for z in(42,112):
 _,r,line=min((ln.distance(Point(center)),r,ln)for r,ln in oldRoutes[z])
 hit=line.interpolate(line.project(Point(center)))
 dest[z]=(hit.x,hit.y,r['id'])
n0=dest[112][0]-dest[42][0];n1=dest[112][1]-dest[42][1]
hyp=math.hypot(n0,n1);n=(n0/hyp,n1/hyp);t=(n[1],-n[0])
def xy(u,v):return(center[0]+u*t[0]+v*n[0],center[1]+u*t[1]+v*n[1])
footprint=Polygon([xy(-13.5,-17),xy(13.5,-17),xy(13.5,-2),xy(-13.5,-2)])
objs=[shape(a['geometry'])for a in q['parcels']]
tree=STRtree(objs)
overlap=sum(objs[int(i)].intersection(footprint).area for i in tree.query(footprint))
if overlap>.5:raise RuntimeError('Site intersects canonical parcel '+str(overlap))
vertices={k:[]for k in ('stair','support','bridge','rail','stone')}
faces={k:[]for k in vertices}
def add(k,v,f):
 idx=len(vertices[k])
 vertices[k].extend([[float(s)for s in x]for x in v])
 faces[k].extend([[idx+i for i in face]for face in f])
def slab(k,a,b,width,zlo,zhi):
 ax,ay=a;bx,by=b
 dx=bx-ax;dy=by-ay;L=math.hypot(dx,dy)
 if L<.0001:return
 nx=-dy/L*(width/2);ny=dx/L*(width/2)
 ring=[(ax+nx,ay+ny),(bx+nx,by+ny),(bx-nx,by-ny),(ax-nx,ay-ny)]
 v=[[x,y,z]for z in (zlo,zhi)for x,y in ring]
 add(k,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def pillar(name,x,y,zlo,zhi,w=1.6,depth=1.6,k='stone'):
 a=(x-w/2,y-depth/2);b=(x+w/2,y-depth/2);c=(x+w/2,y+depth/2);d=(x-w/2,y+depth/2)
 v=[[q[0],q[1],z]for z in (zlo,zhi)for q in (a,b,c,d)]
 add(k,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
# 5x70 risers => 70m in 5 flights; each flight 23m in plan.
route=[[dest[42][0],dest[42][1],42.]]
start=xy(-11.5,-15.5)
route.append([start[0],start[1],42.])
for f in range(5):
 v=-15.5+3*f
 dir=1 if f%2==0 else -1
 riseBase=42+14*f
 for i in range(70):
  startU=-11.5 if dir==1 else 11.5
  x0=startU+dir*(23*i/70)
  x1=startU+dir*(23*(i+1)/70)
  a=xy(x0,v);b=xy(x1,v);top=riseBase+.2*(i+1)
  slab('stair',a,b,2.4,top-.48,top)
  route.append([b[0],b[1],top])
 if f<4:
  # A proper landing loops outside the outer edge of each flight.
  # A direct 2.8m turn deck backtracks over the final 1.4m of treads,
  # producing a 0.8m false riser and an unacceptable overlap.
  endpoint=11.5 if dir>0 else -11.5
  corner=[xy(endpoint,v),xy(endpoint+dir*2.2,v),
          xy(endpoint+dir*2.2,v+3),xy(endpoint,v+3)]
  for A,B in zip(corner,corner[1:]):
   slab('stair',A,B,2.4,route[-1][2]-.48,route[-1][2])
   route.append([B[0],B[1],route[-1][2]])
 # Structural sloping stone under each flight: a continuous stepped
 # buttress wall inset within each flight footprint and outside paths.
 for i in (8,29,50,68):
  u=(-11.5 if dir==1 else 11.5)+dir*(23*i/70)
  point=xy(u,v)
  z=riseBase+.2*i-.50
  if z>42.5:
   pillar('masonry_pier',*point,42.,z,.52,.52,'support')
# Normal grade lower approach follows continuous civic ground.
startLower=xy(-11.5,-15.5)
slab('bridge',dest[42][:2],startLower,3.0,41.96,42.10)
# Top shelf bridge crosses the old retaining wall only at elevation 112,
# above the wall crown: no hole through inhabited platforms below.
topPt=xy(11.5,-3.5)
topOuter=xy(17.5,-3.5)
slab('bridge',topPt,topOuter,2.4,111.92,112.18)
slab('bridge',topOuter,dest[112][:2],3.1,111.92,112.18)
route.append([topOuter[0],topOuter[1],112.])
route.append([dest[112][0],dest[112][1],112.])
# Side rail only at outside face of each flight, away from walking centerline.
for f in range(5):
 v=-15.5+3*f;di=1 if f%2==0 else -1
 a=xy(-11.5,v-1.55);b=xy(11.5,v-1.55)
 z0=42+14*f+1.15;z1=42+14*(f+1)+1.15
 if di<0:z0,z1=z1,z0
 # 3D segmented inclined wrought iron railing in a single mesh.
 for i in range(8):
  s=i/8;e=(i+1)/8
  p0=(a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s)
  p1=(a[0]+(b[0]-a[0])*e,a[1]+(b[1]-a[1])*e)
  zz0=z0+(z1-z0)*s;zz1=z0+(z1-z0)*e
  slab('rail',p0,p1,.13,min(zz0,zz1)-.05,max(zz0,zz1)+.1)
# Old entrance pillars overlapped the footpath at the first and last
# flights. Replace with a meaningful 7m-wide arch through the lower civic
# gallery; the 40/41 gallery wall panels become an actual street gateway.
for yy in (645.5,652.5):
 pillar('gallery_gate_pier',619.1,yy,42.0,48.6,1.2,1.2,'stone')
pillar('gallery_gate_lintel',619.1,649.0,47.5,49.0,1.35,7.8,'stone')
routeList=dict(id=name,points=route,width=2.4,kind='stairs',
               z0=42,z1=112,lengthM=round(sum(math.dist(a,b)for a,b in zip(route,route[1:])),3),grade=0)
p['routes'].append(routeList)
newMeshes=[]
for typ in vertices:
 if not faces[typ]:continue
 meshname='current_civic_upper_short_'+typ
 p['meshes'].append(dict(name=meshname,vertices=vertices[typ],faces=faces[typ],material='court_ashlar'if typ!='rail'else'court_iron'))
 newMeshes.append(meshname)
study=dict(status='PENDING_REAL_MESH_VALIDATION',center=center,
 lowerRoad=dest[42],upperRoad=dest[112],stationLandParcelIntersectionSqm=round(overlap,2),
 routeId=name,routeLength3dM=round(routeList['lengthM'],1),oldCartRampPreserved=True,
 riseM=70,stairFlights=5,steps=350,riserM=.20,treadM=round(23/70,3),
 distinctMeshObjects=newMeshes,caveats=['No working freight/passenger hoist yet',
 'Existing 1,170m carriage route preserved until alternative operates',
 'No in-game actor capsule/navmesh/cargo traffic sim',
 'Visual stairway with roof and court connection still needs human review'])
p['civicUpperShortStairPilot']=study

# High-level freight alternative: an actual modeled hoist shaft and stone
# bridge; in-game vertical motion must be wired separately. DO NOT fake a
# 70m-long walking gradient route through an elevator.
liftX,liftY=605.,692.
pt=Point((liftX,liftY))
liftPlot=pt.buffer(7.2,cap_style=3)
liftOverlap=sum(objs[int(i)].intersection(liftPlot).area for i in tree.query(liftPlot))
if liftOverlap>.5:raise RuntimeError('Lift overlaps parcel: '+str(liftOverlap))
hVert={k:[]for k in ('hoist_masonry','hoist_iron','hoist_platform')}
hFace={k:[]for k in hVert}
def liftAdd(kind,vv,ff):
 ix=len(hVert[kind]);hVert[kind].extend([[float(a)for a in v]for v in vv])
 hFace[kind].extend([[ix+j for j in f]for f in ff])
def liftBox(kind,xy,dim,z):
 x,y=xy;w,d,h=dim
 coords=[(x-w/2,y-d/2),(x+w/2,y-d/2),(x+w/2,y+d/2),(x-w/2,y+d/2)]
 vv=[[x0,y0,z0]for z0 in (z-h/2,z+h/2)for x0,y0 in coords]
 liftAdd(kind,vv,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def liftSlab(kind,a,b,width,low,top):
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy);nx=-dy/L*width/2;ny=dx/L*width/2
 xy=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
 vv=[[x,y,z]for z in (low,top)for x,y in xy]
 liftAdd(kind,vv,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
for sx in (-5.4,5.4):
 for sy in (-5.4,5.4):
  liftBox('hoist_masonry',(liftX+sx,liftY+sy),(2.4,2.4,74),79)
# Open freight cage (no giant sealed tower); two reserved landings at 42
# and 112 m; vertical motion remains an explicit separate game task.
for z in (42.12,112.12):
 liftBox('hoist_platform',(liftX,liftY),(9.0,9.0,.27),z)
 for yy in (liftY-5.5,liftY+5.5):
  liftBox('hoist_iron',(liftX,yy),(10.7,.30,1.25),z+1.0)
for z in range(47,112,8):
 for xx in (liftX-5.0,liftX+5.0):
  liftBox('hoist_iron',(xx,liftY),(.35,10.8,.24),float(z))
# Cargo loading access; north-south approach anchored to real gallery.
lowFoot=(611.,650.);highFoot=(582.,692.)
liftSlab('hoist_platform',lowFoot,(liftX,liftY),6.0,41.92,42.15)
liftSlab('hoist_platform',(liftX,liftY),highFoot,5.0,111.91,112.2)
# Arch supporting elevated bridge, spanning only ~57 m.
for bx in (592.,600.):
 liftBox('hoist_masonry',(bx,692.),(2.,3.4,68.0),77.8)
for by in (666.,680.):
 liftBox('hoist_masonry',(607.,by),(2.,2.,28.0),28.0)
for mat in hVert:
 if hFace[mat]:
  meshname='current_civic_royal_'+mat
  p['meshes'].append(dict(name=meshname,vertices=hVert[mat],faces=hFace[mat],material='court_ashlar'if mat=='hoist_masonry'else ('court_iron'if mat=='hoist_iron'else 'court_paving')))
  newMeshes.append(meshname)
# The old road, its support benches, its enormous cliff skirt, and
# 6 abutments were all one visual mass. Remove as a *set*, not cosmetically.
oldRampRoutes=[r['id'] for r in p['routes']if r['id']=='civic_royal_ramp' or r['id'].startswith('civic_royal_ramp_landing_')]
oldRampMeshes=[m['name']for m in p['meshes']if m['name'].startswith('civic_royal_ramp') or m['name'].startswith('wall_gallery_abutment_civic_royal_ramp_')]
if len(oldRampRoutes)!=3 or len(oldRampMeshes)<5:
 raise RuntimeError('Ramp dependencies changed; refuse destructive removal')
p['routes']=[r for r in p['routes']if r['id'] not in oldRampRoutes]
p['meshes']=[m for m in p['meshes']if m['name']not in oldRampMeshes]
doorPanels=['wall_gallery_civic_wall_gallery_lower_40_wall_-1',
            'wall_gallery_civic_wall_gallery_lower_41_wall_-1']
if not all(any(m['name']==s for m in p['meshes'])for s in doorPanels):
 raise RuntimeError('Gallery source door wall geometry changed')
p['meshes']=[m for m in p['meshes']if m['name']not in doorPanels]
study.update(status='PENDING_3D_ROAD_COLLISION_AND_VISUAL',
  sourceRampRemoved=True,oldRampRemovedRouteIds=oldRampRoutes,
  oldRampRemovedMeshNames=oldRampMeshes,openedGalleryDoorPanels=doorPanels,hoistPosition=(liftX,liftY),
  freightAccessLower=lowFoot,freightAccessUpper=highFoot,
  freightHoistModeled=True,freightHoistGameMotionImplemented=False,
  oldCartRampPreserved=False,
  caveats=['Actual freight hoist platform movement not implemented in Blender static scene',
  'Gallery wall must be verified closed after removing the old ramp abutments',
  'Check upper and lower access and approach for walking collisions',
  'Cargo throughput, lift machinery and game logic need follow-on development'])
p['civicRoyalRampReplacement']=study

p['audit']['routeCount']=len(p['routes'])
(root/'royal-replacement-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'royal-replacement-study.staged.json').write_text(json.dumps(study,indent=2),encoding='utf8')
print('SHORT_STAIR_STAGED',json.dumps({k:v for k,v in study.items()if k not in ('caveats','distinctMeshObjects')}))
