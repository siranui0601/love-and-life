"""Replace long market and noble earthworks with steep wall entrances.
B88 -> fresh version. Ordinary routes/plots are intentionally replaceable.
"""
import json,math,pathlib,sys
from shapely.geometry import Polygon,LineString,Point,box,shape,mapping
from shapely.ops import unary_union,nearest_points
from shapely import constrained_delaunay_triangles
from shapely.strtree import STRtree
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Existing version protected')
p=json.loads((src/'plan.json').read_text());d=json.loads((src/'parcels.json').read_text())
base={r['id']:r for r in p['routes']};oldnames={m['name']for m in p['meshes']};changed=[];removed_routes=[]
mage=Polygon([(800,400),(1180,350),(1350,720),(1000,980),(750,850)])
terraces=[(42,Polygon([(-750,280),(-480,160),(0,200),(500,260),(780,600),(500,1150),(-400,1200),(-950,900)])),(78,Polygon([(-850,600),(-400,500),(-100,700),(-250,1200),(-700,1100)])),(70,mage),(112,Polygon([(-250,560),(200,420),(600,620),(620,1000),(200,1360),(-230,1100)])),(156,Polygon([(-120,830),(230,730),(480,840),(420,1150),(120,1280),(-100,1090)]))]
def parts(g,kind):
 if g.is_empty:return []
 if g.geom_type==kind:return [g]
 return [a for q in getattr(g,'geoms',[])for a in parts(q,kind)]
def route(name,ps,w,kind='life'):
 ls=LineString([q[:2]for q in ps]);samples=[]
 for a,b in zip(ps,ps[1:]):
  if math.dist(a,b)<1e-6:continue
  n=max(1,math.ceil(math.dist(a,b)/2));samples.extend([[a[k]+(b[k]-a[k])*i/n for k in range(3)]for i in range(n)])
 samples.append(ps[-1]);return dict(id=name,points=samples,width=w,kind=kind,z0=ps[0][2],z1=ps[-1][2],lengthM=ls.length,grade=(ps[-1][2]-ps[0][2])/ls.length)
def flat(name,xy,w):return route(name,[[x,y,14]for x,y in xy],w)
def frame(a,b):
 dist=math.dist(a[:2],b[:2]);u=[(b[0]-a[0])/dist,(b[1]-a[1])/dist];return u,[-u[1],u[0]],dist
new=[]
def mesh(name,v,f,mat='stone'):p['meshes'].append(dict(name='western_ascent_'+name,vertices=v,faces=f,material=mat))
def slab(name,a,b,width,lo,hi,mat='stone'):
 _,n,_=frame(a,b);v=[[q[0]+n[0]*off,q[1]+n[1]*off,q[2]+z]for z in [lo,hi]for q,off in [(a,-width/2),(b,-width/2),(b,width/2),(a,width/2)]]
 mesh(name,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],mat)
def pave(name,g,z,mat='ground'):
 v=[];f=[]
 for poly in parts(g,'Polygon'):
  for tri in constrained_delaunay_triangles(poly).geoms:
   k=len(v);v.extend([[x,y,z]for x,y in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 mesh(name,v,f,mat)

configs=[('market_ascent',14,42,(-492,126),(-492,168),'civic_foot_contour_1',terraces[0][1]),('noble_service',42,78,(-820,560),(-820,612),'noble_west_contour_1',terraces[1][1])]
restores=[];details=[]
for key,z0,z1,a,b,upper_id,wall in configs:
 old=base[key];bank=next(m for m in p['meshes']if m['name']==key+'_graded_bench')
 foot=unary_union([Polygon([bank['vertices'][i][:2]for i in f]).buffer(0)for f in bank['faces']])
 foot=foot.union(LineString([q[:2]for q in old['points']]).buffer(old['width']/2+1))
 restored=foot.difference(unary_union([g for z,g in terraces if z>z0]));restores.append((key,z0,restored))
 for m in p['meshes']:
  if m['name'].startswith(key)or m['name'].startswith('wall_gallery_abutment_'+key):m['vertices']=[];m['faces']=[];changed.append(m['name'])
 removed_routes.extend([r['id']for r in p['routes']if r['id'].startswith(key)])
 p['routes']=[r for r in p['routes']if not r['id'].startswith(key)]
 line=LineString([a,b]);length=line.length;rise=z1-z0;flat_total=length-rise
 lo=8. if key=='noble_service'else 4.;hi=flat_total-lo-4;half=rise/2
 ds=sorted(set([length*i/math.ceil(length/1.5)for i in range(math.ceil(length/1.5)+1)]+[lo,lo+half,lo+half+4,length-hi]))
 def z(d):return z0+min(half,max(0,d-lo))+min(half,max(0,d-lo-half-4))
 ramp=route(key+'_short',[[line.interpolate(d).x,line.interpolate(d).y,z(d)]for d in ds],10,'steep_ramp');ramp['maxLocalGrade']=1.;ramp['movementStatus']='Steep movement proposal; traction/controller pending';new.append(ramp)
 candidates=[r for r in p['routes']if abs(r['z0']-z0)<1e-6 and abs(r['z1']-z0)<1e-6 and r['kind']!='stairs']
 target=min(candidates,key=lambda r:LineString([q[:2]for q in r['points']]).distance(Point(a)));q=nearest_points(Point(a),LineString([q[:2]for q in target['points']]))[1]
 lower=route(key+'_short_lower',[[q.x,q.y,z0],[*a,z0]],10,'landing');new.append(lower)
 upper=next(r for r in p['routes']if r['id']==upper_id);q=nearest_points(Point(b[0],b[1]+15),LineString([q[:2]for q in upper['points']]))[1]
 upperlink=route(key+'_short_upper',[[*b,z1],[b[0],b[1]+15,z1],[q.x,q.y,z1]],10,'landing');new.append(upperlink)
 details.append(dict(id=key,beforeM=old['lengthM'],afterM=length,riseM=rise,lowerM=lower['lengthM'],upperM=upperlink['lengthM'],wall=mapping(wall),z0=z0))
# Reroute the obstructing civic ring segment below the steep entrance.
ring=next(r for r in p['routes']if r['id']=='civic_foot_contour_1')
conflict=box(-838,555,-802,587);ring_line=LineString([q[:2]for q in ring['points']]);remaining=parts(ring_line.difference(conflict),'LineString')
p['routes'].remove(ring);removed_routes.append(ring['id'])
for m in p['meshes']:
 if m['name']==ring['id']:m['vertices']=[];m['faces']=[];changed.append(m['name'])
ends=[]
for i,ls in enumerate(remaining):
 new.append(route('civic_foot_contour_1_retained_'+str(i),[[x,y,42]for x,y in ls.coords],ring['width'],ring['kind']))
 for xy in [ls.coords[0],ls.coords[-1]]:
  if Point(xy).distance(conflict.boundary)<.01:ends.append(xy)
if len(ends)!=2:raise RuntimeError('Review civic ring detour endpoint topology')
new.append(route('civic_noble_entrance_detour',[[*ends[0],42],[ends[0][0],552,42],[ends[1][0],552,42],[*ends[1],42]],ring['width'],'life'))
old=next(r for r in new if r['id']=='noble_service_short_lower');new.remove(old)
ls=LineString([q[:2]for q in new[-1]['points']]);q=nearest_points(Point(-820,560),ls)[1]
new.append(route('noble_service_short_lower',[[q.x,q.y,42],[-820,560,42]],10,'landing'))
next(d for d in details if d['id']=='noble_service')['lowerM']=new[-1]['lengthM']
# The former market embankment becomes a connected street market court.
market_court=box(-465,76,-419,126)
new.append(route('market_arrival_court_link',[[-492,90,14],[-425,90,14]],6,'life'))
stalls=[]
for row,y,sign in [('north',119,-1),('south',81,1)]:
 for i,x in enumerate([-452,-432]):
  name='market_arrival_stall_'+row+str(i);stalls.append(dict(id=name,x=x,y=y,sign=sign))
  new.append(route(name+'_entry',[[x,90,14],[x,y+sign*6,14],[x,y+sign*2,14]],4,'life'))
# Ordinary lots may move; preserve canonical facility footprints.
reserve=unary_union([market_court]+[LineString([q[:2]for q in r['points']]).buffer(r['width']/2+1)for r in new if '_retained_'not in r['id']]);removed=[]
for parcel in d['parcels']:
 geom=shape(parcel['geometry'])
 if geom.intersects(market_court) and parcel['groundM']<20:
  if parcel.get('canonicalFacilityId'):raise RuntimeError('Canonical facility cannot be removed')
  removed.append(parcel['id']);continue
 for r in new:
  if '_retained_'in r['id']:continue
  zs=[q[2]for q in r['points']if Point(q[:2]).distance(geom)<r['width']/2+3]
  if zs and min(zs)<parcel['groundM']+parcel['heightM']+4 and max(zs)+5>parcel['groundM']:
   if parcel.get('canonicalFacilityId'):raise RuntimeError('Canonical facility cannot be removed')
   removed.append(parcel['id']);break
d['parcels']=[q for q in d['parcels']if q['id']not in removed]
for block in d['blocks']:block['parcelIds']=[i for i in block['parcelIds']if i not in removed]
d['audit']['parcelCount']=len(d['parcels'])
cutters=[]
def cutter(a,b,width,below=.35,above=5):
 u,n,length=frame(a,b);slope=(b[2]-a[2])/length
 planes=[([-u[0],-u[1],0],-u[0]*a[0]-u[1]*a[1]+.03),([u[0],u[1],0],u[0]*b[0]+u[1]*b[1]+.03),([n[0],n[1],0],n[0]*a[0]+n[1]*a[1]+width/2),([-n[0],-n[1],0],-n[0]*a[0]-n[1]*a[1]+width/2),([-slope*u[0],-slope*u[1],1],a[2]-slope*(u[0]*a[0]+u[1]*a[1])+above),([slope*u[0],slope*u[1],-1],-a[2]+slope*(u[0]*a[0]+u[1]*a[1])+below)]
 cutters.append((planes,LineString([a[:2],b[:2]]).buffer(width/2+.1,cap_style=3),min(a[2],b[2])-below,max(a[2],b[2])+above))
def split(poly,n,c):
 inside=[];outside=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=sum(n[k]*a[k]for k in range(3))-c;db=sum(n[k]*b[k]for k in range(3))-c
  (inside if da<=1e-8 else outside).append(a)
  if da*db<0 and abs(da)>1e-8 and abs(db)>1e-8:
   t=da/(da-db);q=[a[k]+(b[k]-a[k])*t for k in range(3)];inside.append(q);outside.append(q)
 return inside,outside
def subtract(poly,planes):
 retained=[];inside=poly
 for n,c in planes:
  if len(inside)<3:break
  inside,outside=split(inside,n,c)
  if len(outside)>=3:retained.append(outside)
 return retained

for r in new:
 if '_retained_'in r['id']:continue
 for a,b in zip(r['points'],r['points'][1:]):cutter(a,b,r['width']+.2)
tree=STRtree([c[1]for c in cutters])
for m in list(p['meshes']):
 if not m['vertices']or m['material']not in ['ground','stone','primary','lane','stairs']:continue
 vv=[];ff=[];modified=False
 for f in m['faces']:
  poly=[m['vertices'][i]for i in f];xy=LineString([v[:2]for v in poly]).buffer(.001);pieces=[poly]
  for index in tree.query(xy):
   c=cutters[int(index)]
   if max(v[2]for v in poly)<c[2]or min(v[2]for v in poly)>c[3]:continue
   n,limit=c[0][-1];hs=[limit-sum(n[k]*v[k]for k in range(3))-.35 for v in poly]
   if m['material']in ['primary','lane','stairs'] and min(hs)>-.4 and max(hs)<.6:continue
   pieces=[q for face in pieces for q in subtract(face,c[0])]
  if pieces!=[poly]:modified=True
  for q in pieces:
   k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
 if modified:m['vertices']=vv;m['faces']=ff;changed.append(m['name'])

for key,z0,restored in restores:
 if z0==42:
  pave(key+'_restored_civic_ground',restored.intersection(terraces[0][1]),42)
  pave(key+'_restored_low_ground',restored.difference(terraces[0][1]),14)
 else:pave(key+'_restored_ground',restored,z0)
# Continuous mitered floors remove the wedge gaps of independent ramp tiles.
for r in new:
 if r['kind']=='stairs':
  for i,(a,b)in enumerate(zip(r['points'],r['points'][1:])):slab(r['id']+'_floor_'+str(i),[a[0],a[1],b[2]],b,r['width']+.6,-.4,.15,'stairs')
  continue
 ps=r['points'];v=[];faces=[]
 for i,q in enumerate(ps):
  a=ps[max(0,i-1)];b=ps[min(len(ps)-1,i+1)];u0=[q[0]-a[0],q[1]-a[1]];u1=[b[0]-q[0],b[1]-q[1]]
  if math.hypot(*u0)<1e-8:u0=u1
  if math.hypot(*u1)<1e-8:u1=u0
  l0=math.hypot(*u0);l1=math.hypot(*u1);n0=[-u0[1]/l0,u0[0]/l0];n1=[-u1[1]/l1,u1[0]/l1];n=[n0[0]+n1[0],n0[1]+n1[1]];length=math.hypot(*n);n=[x/length for x in n];extent=(r['width']/2+.3)/max(.25,n[0]*n0[0]+n[1]*n0[1])
  v.extend([[q[0]+n[0]*extent*side,q[1]+n[1]*extent*side,q[2]+.15]for side in [-1,1]])
  if i:faces.append([2*i-2,2*i-1,2*i+1,2*i])
 mesh(r['id']+'_continuous_floor',v,faces,'primary'if r['kind']=='cart_ramp'else'lane')

for r in new:
 if r['id']=='noble_service_short_upper':
  q=r['points'][-1];pave('noble_upper_join_apron',box(q[0]-6,q[1]-6,q[0]+6,q[1]+6),78.15,'lane')
pave('market_arrival_court',market_court,14.1,'lane')
for b in stalls:
 name,x,y,sign=b['id'],b['x'],b['y'],b['sign'];front=y+sign*4;back=y-sign*4
 pave(name+'_floor',box(x-6,y-4,x+6,y+4),14.15,'lane')
 slab(name+'_back',[x-6,back,14.15],[x+6,back,14.15],.4,0,4)
 for xx in [-6,6]:slab(name+'_side_'+str(xx),[x+xx,y-4,14.15],[x+xx,y+4,14.15],.4,0,4)
 slab(name+'_roof',[x-6,y,18.15],[x+6,y,18.15],8.5,0,.2,'wood')
 slab(name+'_awning',[x-6,front+sign,17.8],[x+6,front+sign,17.8],2.5,0,.15,'wood')
 for xx in [-5.5,5.5]:slab(name+'_counter_'+str(xx),[x+xx,front-.4,14.15],[x+xx,front+.4,14.15],.6,0,1,'wood')
for x in [-458,-438]:slab('market_court_bench_'+str(x),[x,100,14.15],[x+3,100,14.15],.5,0,.45,'wood')
start_added=len(p['meshes'])
for r in new:
 for i,(a,b)in enumerate(zip(r['points'],r['points'][1:])):
  if r['kind']=='steep_ramp':
   wall=shape(next(d['wall']for d in details if r['id']==d['id']+'_short')).boundary
   _,n,_=frame(a,b);mid=[(a[k]+b[k])/2 for k in range(3)];q=nearest_points(Point(mid[:2]),wall)[1];side=1 if (q.x-mid[0])*n[0]+(q.y-mid[1])*n[1]>0 else -1
   aa=[a[0]-side*n[0]*5.3,a[1]-side*n[1]*5.3,a[2]-.3];bb=[b[0]-side*n[0]*5.3,b[1]-side*n[1]*5.3,b[2]-.3]
   qa=nearest_points(Point(a[:2]),wall)[1];qb=nearest_points(Point(b[:2]),wall)[1];z0=r['z0']
   v=[aa,bb,[qb.x,qb.y,b[2]-.3],[qa.x,qa.y,a[2]-.3]]
   mesh(r['id']+'_tie_'+str(i),v+[[q[0],q[1],z0-.3]for q in v],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
   slab(r['id']+'_parapet_'+str(i),[a[0]-side*n[0]*5.3,a[1]-side*n[1]*5.3,a[2]],[b[0]-side*n[0]*5.3,b[1]-side*n[1]*5.3,b[2]],.4,.15,1.5)
# Cut old and new passage clearance from newly added structural walls, preserving floors.
cutters=[]
for r in p['routes']+new:
 for a,b in zip(r['points'],r['points'][1:]):
  if math.dist(a[:2],b[:2])>1e-5:cutter(a,b,r['width']+.2,below=-.2,above=4)
tree=STRtree([c[1]for c in cutters])
for m in p['meshes'][start_added:]:
 vv=[];ff=[]
 for f in m['faces']:
  poly=[m['vertices'][i]for i in f];pieces=[poly];xy=LineString([v[:2]for v in poly]).buffer(.001)
  for idx in tree.query(xy):
   c=cutters[int(idx)]
   if max(v[2]for v in poly)<c[2]or min(v[2]for v in poly)>c[3]:continue
   pieces=[q for face in pieces for q in subtract(face,c[0])]
  for q in pieces:k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
 m['vertices']=vv;m['faces']=ff
p['routes'].extend(new);p['audit']['routeCount']=len(p['routes']);p['negativeSpaces'].append(mapping(reserve))
report=dict(status='REQUIRES_MESH_VISUAL_REVIEW',base='B88',parentGitHEAD='1d80ff3ec83f5cb98c8c9e0bd95600a5798a4bd8',changedMeshes=sorted(set(changed)),addedMeshes=[m['name']for m in p['meshes']if m['name']not in oldnames],replacedParcelIds=removed,newRoutes=new,ascents=details,restoredAreasM2={key:g.area for key,z,g in restores},marketArrivalCourt=mapping(market_court),marketStalls=stalls,pending=['Actual mesh and viewpoint review','Steep haulage/controller runtime','Remaining civic ascent and district life'])
p['westernAscentsStudy']=report
out.mkdir(parents=True)
for name,value in [('plan.json',p),('parcels.json',d),('western-ascents-study.json',report)]: (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(ascents=details,removedParcels=len(removed))))
