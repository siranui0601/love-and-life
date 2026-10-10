"""B95: Create a geographically separate eastern Noble Quarter access from B94.
A 45 degree winch-assisted freight incline and an independently walkable stair
are authored with independent lower/upper road connections.
Not gameplay-certified. Never overwrite an existing design version.
"""
import json, math, pathlib, sys
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

src, out = map(pathlib.Path,sys.argv[1:3])
if out.exists(): raise RuntimeError("Refusing to overwrite existing design: "+str(out))
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
before={m['name'] for m in p['meshes']}
routes={r['id']:r for r in p['routes']}
def near(id,xy):
    ls=LineString([q[:2] for q in routes[id]['points']])
    q=nearest_points(Point(*xy),ls)[1]
    return (q.x,q.y)
def draw(id,points,width,kind):
    pts=[]
    for a,b in zip(points,points[1:]):
        horizontal=math.dist(a[:2],b[:2])
        if kind=='stairs':
            n=max(1,math.ceil(abs(b[2]-a[2])/.16)) if abs(b[2]-a[2])>1e-6 else 1
        else:
            n=max(1,math.ceil(horizontal/.8))
        pts += [[a[k]+(b[k]-a[k])*j/n for k in range(3)] for j in range(n)]
    pts.append(list(points[-1]))
    length=sum(math.dist(a[:2],b[:2]) for a,b in zip(points,points[1:]))
    return dict(id=id,points=pts,width=width,kind=kind,z0=pts[0][2],z1=pts[-1][2],
                lengthM=length,grade=(pts[-1][2]-pts[0][2])/length)
low=near('civic_foot_contour_1_retained_1',(-559,513))
high=near('noble_west_lane_2',(-560,579))
pedlow=near('civic_foot_lane_5',(-574,515))
pedhigh=near('noble_west_lane_2',(-560,574))
freight=draw('noble_east_winch_incline',[
    [*low,42],[-560,521,42],[-560,539,60],[-560,543,60],
    [-560,561,78],[*high,78]],10,'steep_ramp')
foot=draw('noble_east_wall_stair',[
    [*pedlow,42],[-582,520,42],[-590,520,42],
    [-610,552,60],[-606,558,60],[-582,590,78],
    [*pedhigh,78]],4,'stairs')
foot['landingCount']=sum(
    1 for a,b in zip(foot['points'],foot['points'][1:])
    if abs(a[2]-b[2])<1e-6 and math.dist(a[:2],b[:2])>1
)
# A separate pedestrian court makes both circulation systems visible and
# avoids forcing pedestrians through the cargo cable path.
lowercourt=draw('noble_east_haulage_lower_court',[list([*low,42]),[-560,521,42]],11,'landing')
uppercourt=draw('noble_east_haulage_upper_court',[[-560,561,78],[*high,78]],11,'landing')
new=[freight,foot]   # court surfaces belong to main route; do not duplicate graphs

def mesh(name,verts,faces,mat='stone'):
    p['meshes'].append(dict(name='distributed_access_'+name,vertices=verts,faces=faces,material=mat))
def slab(id,a,b,w,bottom=-.25,top=.14,mat='stone'):
    dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
    if L<1e-5:return
    nx=-dy/L;ny=dx/L
    corners=[(a,-w/2),(b,-w/2),(b,w/2),(a,w/2)]
    v=[[q[0]+nx*t,q[1]+ny*t,q[2]+offset] for offset in [bottom,top] for q,t in corners]
    f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
    mesh(id,v,f,mat)
# Reserve an actual clearance envelope and remove only ordinary residences
# that conflict; canonical facilities cannot be silently displaced.
corridors=[LineString([q[:2] for q in r['points']]).buffer(r['width']/2+2,cap_style=2) for r in new]
reserved=unary_union(corridors)
removed=[]
for parcel in d['parcels']:
    if not shape(parcel['geometry']).intersects(reserved):continue
    if parcel.get('canonicalFacilityId'):
        raise RuntimeError('Canonical facility would be touched: '+parcel['id'])
    removed.append(parcel['id'])
rset=set(removed)
d['parcels']=[a for a in d['parcels'] if a['id'] not in rset]
for block in d['blocks']:block['parcelIds']=[id for id in block['parcelIds'] if id not in rset]
d['audit']['parcelCount']=len(d['parcels'])
# Cut the through-wall prism in local stone/ground/stair meshes.
def cutter(a,b,w):
    dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
    if L<1e-6:return None
    u=(dx/L,dy/L);n=(-u[1],u[0]);slope=(b[2]-a[2])/L
    planes=[
       ((-u[0],-u[1],0),-u[0]*a[0]-u[1]*a[1]+.02),
       ((u[0],u[1],0),u[0]*b[0]+u[1]*b[1]+.02),
       ((n[0],n[1],0),n[0]*a[0]+n[1]*a[1]+w/2),
       ((-n[0],-n[1],0),-n[0]*a[0]-n[1]*a[1]+w/2),
       ((-slope*u[0],-slope*u[1],1),a[2]-slope*(u[0]*a[0]+u[1]*a[1])+5),
       ((slope*u[0],slope*u[1],-1),-a[2]+slope*(u[0]*a[0]+u[1]*a[1])+.25)]
    return (planes,LineString([a[:2],b[:2]]).buffer(w/2+.1,cap_style=2),
            min(a[2],b[2])-.25,max(a[2],b[2])+5)
def split(poly,n,c):
    inside=[];outside=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=sum(n[k]*a[k] for k in range(3))-c
        db=sum(n[k]*b[k] for k in range(3))-c
        (inside if da<=1e-8 else outside).append(a)
        if da*db<0 and abs(da)>1e-8 and abs(db)>1e-8:
            t=da/(da-db)
            q=[a[k]+(b[k]-a[k])*t for k in range(3)]
            inside.append(q);outside.append(q)
    return inside,outside
def subtract(poly,planes):
    retained=[];inside=poly
    for normal,lim in planes:
        if len(inside)<3:break
        inside,outside=split(inside,normal,lim)
        if len(outside)>=3:retained.append(outside)
    return retained
# Use the authoring control points, not 0.8m render samples, to keep cutter count small.
control=[
   [ [*low,42],[-560,521,42],[-560,539,60],[-560,543,60],[-560,561,78],[*high,78] ],
   [ [*pedlow,42],[-582,520,42],[-590,520,42],
       [-610,552,60],[-606,558,60],[-582,590,78],[*pedhigh,78] ]]
cut=[x for points,r in zip(control,new) for a,b in zip(points,points[1:])
     if (x:=cutter(a,b,r['width']+.5))]
tree=STRtree([c[1] for c in cut])
changed=[]
zone=reserved.bounds
for m in p['meshes']:
    if not m['vertices'] or m['material'] not in ('ground','stone','primary','lane','stairs'):continue
    v=m['vertices']
    if max(q[0] for q in v)<zone[0]-3 or min(q[0] for q in v)>zone[2]+3:continue
    if max(q[1] for q in v)<zone[1]-3 or min(q[1] for q in v)>zone[3]+3:continue
    vv=[];ff=[];altered=False
    for face in m['faces']:
        poly=[v[i] for i in face]
        geom=LineString([q[:2] for q in poly]).buffer(.001)
        pieces=[poly]
        for idx in tree.query(geom):
            planes,segment_foot,zmin,zmax=cut[int(idx)]
            if max(q[2] for q in poly)<zmin or min(q[2] for q in poly)>zmax:continue
            pieces=[part for piece in pieces for part in subtract(piece,planes)]
        if pieces!=[poly]:altered=True
        for part in pieces:
            start=len(vv);vv.extend(part);ff.append(list(range(start,start+len(part))))
    if altered:
        m['vertices']=vv;m['faces']=ff;changed.append(m['name'])
# Replace cut high plateau with a ramp deck plus stone support, handrail, and a
# separate pedestrian staircase. Each segment is a real mesh with collision faces.
for r in new:
    if r['kind']=='steep_ramp':
        # Mitered continuous surface: removes longitudinal wedge gaps at joins.
        verts=[];faces=[]
        ps=r['points']
        for i,q in enumerate(ps):
            a=ps[max(0,i-1)];b=ps[min(len(ps)-1,i+1)]
            u0=[q[0]-a[0],q[1]-a[1]];u1=[b[0]-q[0],b[1]-q[1]]
            if math.hypot(*u0)<1e-8:u0=u1
            if math.hypot(*u1)<1e-8:u1=u0
            l0=math.hypot(*u0);l1=math.hypot(*u1)
            n0=[-u0[1]/l0,u0[0]/l0];n1=[-u1[1]/l1,u1[0]/l1]
            n=[n0[0]+n1[0],n0[1]+n1[1]]
            ll=math.hypot(*n);n=[x/ll for x in n]
            extent=(r['width']/2+.65)/max(.25,n[0]*n0[0]+n[1]*n0[1])
            verts.extend([[q[0]+n[0]*extent*side,q[1]+n[1]*extent*side,q[2]+.12]
                          for side in (-1,1)])
            if i:faces.append([2*i-2,2*i-1,2*i+1,2*i])
        mesh('freight_continuous_deck',verts,faces,'lane')
        continue
    for i,(a,b) in enumerate(zip(r['points'],r['points'][1:])):
        if math.dist(a[:2],b[:2])<1e-5:continue
        slab(r['id']+'_deck_'+str(i),a,b,r['width']+.5,mat='stairs')
# Step treads on the pedestrian inclines; rise ≤0.22m per step.
for i,(a,b) in enumerate(zip(control[1],control[1][1:])):
    if b[2]<=a[2]:continue
    n=math.ceil((b[2]-a[2])/.2)
    for j in range(n):
        q=[a[k]+(b[k]-a[k])*j/n for k in range(3)]
        z=b[2] if j==n-1 else a[2]+(b[2]-a[2])*(j+1)/n
        e=[a[k]+(b[k]-a[k])*(j+1)/n for k in range(3)]
        slab('stair_tread_%d_%d'%(i,j),[q[0],q[1],z],[e[0],e[1],z],4.25,-.21,.04,'stairs')
# Timber-and-stone retaining walls, lookout alcove, cable/winch housing.
for j,y in enumerate([530,554,568]):
    slab('haulage_buttress_%02d'%j,[-566,y,42],[-570,y+3,42],1,0,11,'stone')
slab('upper_winching_platform',[-568,572,78],[-551,572,78],9,-1,.25,'wood')
for side in [-1,1]:
    xx=-560+side*5.8
    slab('incline_guard_%s'%side,[xx,528,49],[xx,555,74],.65,-.2,1.1,'wood')
slab('upper_lookout_parapet',[-592,578,78],[-582,578,78],.55,0,1.3,'stone')
# Keep the upper/lower roads exact as before and register the independent links.
p['routes'].extend(new)
p['audit']['routeCount']=len(p['routes'])
p['negativeSpaces'].append(mapping(reserved))
report=dict(status='REQUIRES_3D_REVIEW',base=src.name,site='east noble retaining wall',
    purpose='Distributed access: second eastern freight route + independent stairs',
    newRoutes=new,changedMeshes=sorted(set(changed)),
    addedMeshes=[m['name'] for m in p['meshes'] if m['name'] not in before],
    replacedParcelIds=removed,
    horizontalSeparationFromWestCargoM=260,
    freight=dict(mode='winch-assisted incline',maximumRisePerRun=18,
       riseM=36,widthM=10,localGradeMax=1.0,runtime='NOT IMPLEMENTED'),
    pedestrian=dict(mode='stepped stone approach',riseM=36,widthM=4,runtime='NOT TESTED'),
    outstanding=['Re-run 3D collisions and visual review','B94 west_noble_wall_stairs had 2 floor probe failures',
      'Verify end-to-end pedestrian and cart traversals','Implement traction/cable mechanics'],
    remarks='12 canonical facilities preserved by collision veto; this is not a game-ready route.')
p['distributedAscentsStudy']=report
out.mkdir()
for name,val in [('plan.json',p),('parcels.json',d),('distributed-access-study.json',report)]:
    (out/name).write_text(json.dumps(val,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(base=src.name,output=str(out),newRoutes=len(new),removedParcels=len(removed),
                      modifiedMeshes=len(changed),addedMeshes=len(report['addedMeshes']),
                      freightPathM=freight['lengthM'],footPathM=foot['lengthM'])))
