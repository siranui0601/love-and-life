"""Replace detached mage earthwork and reconstruct a mixed working neighbourhood.
B82 -> fresh version. Ordinary routes/plots are intentionally replaceable.
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
def mesh(name,v,f,mat='stone'):p['meshes'].append(dict(name='mage_quarter_'+name,vertices=v,faces=f,material=mat))
def slab(name,a,b,width,lo,hi,mat='stone'):
 _,n,_=frame(a,b);v=[[q[0]+n[0]*off,q[1]+n[1]*off,q[2]+z]for z in [lo,hi]for q,off in [(a,-width/2),(b,-width/2),(b,width/2),(a,width/2)]]
 mesh(name,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],mat)
def pave(name,g,z,mat='ground'):
 v=[];f=[]
 for poly in parts(g,'Polygon'):
  for tri in constrained_delaunay_triangles(poly).geoms:
   k=len(v);v.extend([[x,y,z]for x,y in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 mesh(name,v,f,mat)
# Restore the previous bank to the low-level surface, never flatten a terrace.
old_bank=next(m for m in p['meshes']if m['name']=='mage_civic_ramp_graded_bench')
foot=unary_union([Polygon([old_bank['vertices'][i][:2]for i in f]).buffer(0)for f in old_bank['faces']])
foot=foot.union(LineString([q[:2]for q in base['mage_civic_ramp']['points']]).buffer(11))
restore=foot.difference(unary_union([g for z,g in terraces]))
for m in p['meshes']:
 if m['name'].startswith('mage_civic_ramp'):
  m['vertices']=[];m['faces']=[];changed.append(m['name'])
p['routes']=[r for r in p['routes']if not r['id'].startswith('mage_civic_ramp')]
removed_routes.extend([r for r in base if r.startswith('mage_civic_ramp')])
# Two short steep flights, split by a level landing; maximum slope near 45 degrees.
upper_line=LineString([q[:2]for q in base['mage_east_contour_1']['points']])
line=LineString([(1134,343),(1061,343)]);length=line.length;n=math.ceil(length/1.5)
def freight_z(d):
 if d<=3:return 14
 if d<=31:return 14+(d-3)
 if d<=35:return 42
 if d<=63:return 42+(d-35)
 return 70
distances=sorted(set([length*i/n for i in range(n+1)]+[3,31,35,63]))
cart=route('mage_wall_freight',[[line.interpolate(d).x,line.interpolate(d).y,freight_z(d)]for d in distances],10,'steep_ramp');cart['maxLocalGrade']=1.;cart['movementStatus']='Steep haulage proposal; cart traction/runtime pending';new.append(cart)
# Short, open wall-side pedestrian climb, independent of the freight circuit.
a=[1190,340];b=[1041,359.6];line_s=LineString([a,b]);distance=5.;rise=56/19;run=(line_s.length-10-18*2)/19
ps=[[*a,14]]
for flight in range(19):
 z=14+rise*flight;q=line_s.interpolate(distance);ps.append([q.x,q.y,z])
 for step in range(1,19):
  q=line_s.interpolate(distance+run*step/18);ps.append([q.x,q.y,z+rise*step/18])
 distance+=run
 if flight<18:distance+=2
ps.append([*b,70]);ps=[q for i,q in enumerate(ps)if i==0 or math.dist(q,ps[i-1])>1e-7]
stair=dict(id='mage_wall_short_stairs',points=ps,width=4,kind='stairs',z0=14,z1=70,lengthM=line_s.length,grade=56/line_s.length,landingCount=20,landingLengthM=2,gateTag='G_SOCIAL_STATUS',gateStatus='Runtime pending');new.append(stair)
lo_line=LineString([q[:2]for q in base['low_city_lane_78']['points']]);q=nearest_points(Point(a),lo_line)[1]
new.append(route('mage_wall_lower_entry',[[q.x,q.y,14],[*a,14]],6,'landing'))
new.append(route('mage_wall_freight_lower_entry',[[*a,14],[1190,326,14],[1134,343,14]],10,'landing'))
q=nearest_points(Point(1061,378),upper_line)[1]
new.append(route('mage_wall_freight_upper_entry',[[1061,343,70],[1061,378,70],[q.x,q.y,70]],10,'landing'))
q=nearest_points(Point(b),upper_line)[1];new.append(route('mage_wall_upper_entry',[[*b,70],[q.x,q.y,70]],4,'landing'))
# Rebuild a whole former residential/earthwork site around a street perimeter.
site=box(1330,165,1465,305);clipped=[]
for r in list(p['routes']):
 if abs(r['z0']-14)>1e-6 or abs(r['z1']-14)>1e-6:continue
 ls=LineString([q[:2]for q in r['points']])
 if not ls.intersects(site):continue
 if r['id'].startswith('LOC_'):raise RuntimeError('Canonical access requires specific redesign')
 remaining=parts(ls.difference(site),'LineString');p['routes'].remove(r);removed_routes.append(r['id'])
 for m in p['meshes']:
  if m['name']==r['id'] or m['name'].startswith(r['id']+'_support'):
   m['vertices']=[];m['faces']=[];changed.append(m['name'])
 for i,l in enumerate(remaining):
  if l.length>.1:clipped.append(flat(r['id']+'_retained_'+str(i),list(l.coords),r['width']))
new.extend(clipped)
new.extend([flat('mage_lower_quarter_perimeter',list(site.exterior.coords),6),flat('mage_lower_quarter_cargo',[(1465,180),(1420,180),(1420,275),(1465,280)],6),flat('mage_lower_quarter_life',[(1330,199),(1370,199),(1370,275),(1415,275),(1465,280)],3.5),flat('mage_lower_quarter_cross',[(1370,235),(1420,235)],3.5)])
buildings=[dict(id='repair_house',x=1350,y=235,w=20,d=56,h=8,face='east',door=16,role='repair and household supplies'),dict(id='canteen',x=1390,y=289,w=48,d=16,h=8,face='south',door=20,role='food and shared tables'),dict(id='receiving_store',x=1440,y=236,w=20,d=56,h=8,face='west',door=8,role='receiving and dry storage'),dict(id='sorting_hall',x=1390,y=180,w=40,d=16,h=5,face='east',door=10,role='open sorting and returns'),dict(id='daily_stall_a',x=1384,y=215,w=12,d=8,h=4,face='north',door=9,role='daily goods'),dict(id='daily_stall_b',x=1402,y=215,w=12,d=8,h=4,face='north',door=9,role='produce and household trade')]
buildings=[b for b in buildings if not b['id'].startswith('daily_stall')]
for row,y,face in [('south',215,'north'),('north',247,'south')]:
 for i,x in enumerate([1378,1393,1408]):buildings.append(dict(id='daily_stall_'+row+str(i),x=x,y=y,w=12,d=8,h=4,face=face,door=9,role='daily market and household trade'))
for building in buildings:
 x,y,w,h=building['x'],building['y'],building['w'],building['d'];building['geometry']=mapping(box(x-w/2,y-h/2,x+w/2,y+h/2))
 face=building['face'];door={'east':[x+w/2,y],'west':[x-w/2,y],'north':[x,y+h/2],'south':[x,y-h/2]}[face];direction={'east':[1,0],'west':[-1,0],'north':[0,1],'south':[0,-1]}[face]
 outside=[door[k]+direction[k]*3 for k in range(2)];inside=[door[k]-direction[k]*2 for k in range(2)]
 lanes=[r for r in new if r['id']in ['mage_lower_quarter_cargo','mage_lower_quarter_life','mage_lower_quarter_cross']];target=min(lanes,key=lambda r:LineString([q[:2]for q in r['points']]).distance(Point(outside)));q=nearest_points(Point(outside),LineString([q[:2]for q in target['points']]))[1]
 new.append(flat('mage_quarter_entry_'+building['id'],[(q.x,q.y),outside,door,inside],min(4,building['door']-1)))
# Reserve complete compounds and all physically new routes; clear ordinary plots.
reserve=unary_union([site]+[LineString([q[:2]for q in r['points']]).buffer(r['width']/2+1)for r in new if '_retained_'not in r['id']])
removed=[]
for parcel in d['parcels']:
 if not shape(parcel['geometry']).intersects(reserve):continue
 # Grade separated buildings remain if the entire building lies below/above a route.
 affected=shape(parcel['geometry']).intersects(site)
 for r in new:
  if '_retained_'in r['id']:continue
  if not shape(parcel['geometry']).intersects(LineString([q[:2]for q in r['points']]).buffer(r['width']/2+1)):continue
  zs=[q[2]for q in r['points']if Point(q[:2]).distance(shape(parcel['geometry']))<r['width']/2+3]
  if zs and min(zs)<parcel['groundM']+parcel['heightM']+4 and max(zs)+5>parcel['groundM']:affected=True
 if not affected:continue
 if parcel.get('canonicalFacilityId'):raise RuntimeError('Canonical facility cannot be removed')
 removed.append(parcel['id'])
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
 if '_retained_'in r['id'] or r['id'].startswith('mage_lower_')or r['id'].startswith('mage_quarter_entry_'):continue
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
pave('restored_low_ground',restore,14)
pave('quarter_courts',site.difference(unary_union([shape(b['geometry'])for b in buildings]+[LineString([q[:2]for q in r['points']]).buffer(r['width']/2+.1)for r in new])),14.1,'lane')
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
for label,at,z in [('lower',[1190,340],14),('upper',[1041,359.6],70)]:
 slab('stair_'+label+'_apron',[at[0]-2.5,at[1],z],[at[0]+2.5,at[1],z],5,-.4,.15,'stairs')
# Wall-tied masonry under the freight lane and short stair. Never an isolated ribbon.
for r in [cart,stair]:
 for i,(a,b)in enumerate(zip(r['points'],r['points'][1:])):
  _,n,_=frame(a,b);qa=nearest_points(Point(a[:2]),mage.boundary)[1];qb=nearest_points(Point(b[:2]),mage.boundary)[1]
  centre=[(a[k]+b[k])/2 for k in range(3)];q=nearest_points(Point(centre[:2]),mage.boundary)[1];inner=1 if (q.x-centre[0])*n[0]+(q.y-centre[1])*n[1]>0 else -1
  aa=[a[0]-inner*n[0]*(r['width']/2+.2),a[1]-inner*n[1]*(r['width']/2+.2),a[2]-.3];bb=[b[0]-inner*n[0]*(r['width']/2+.2),b[1]-inner*n[1]*(r['width']/2+.2),b[2]-.3]
  v=[aa,bb,[qb.x,qb.y,b[2]-.3],[qa.x,qa.y,a[2]-.3]]
  mesh(r['id']+'_abutment_'+str(i),v+[[v[0],v[1],14]for v in v],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
  pa=[aa[0],aa[1],a[2]];pb=[bb[0],bb[1],b[2]];slab(r['id']+'_parapet_'+str(i),pa,pb,.45,0,1.35)
# Clear existing/new road envelopes out of new stone abutments and parapets.
for r in p['routes']+new:
 for a,b in zip(r['points'],r['points'][1:]):
  if math.dist(a[:2],b[:2])>.001:cutter(a,b,r['width']+.15,below=-.2,above=4.8)
alltree=STRtree([c[1]for c in cutters])
for m in p['meshes']:
 if m['name']in oldnames or not any(k in m['name']for k in ['_abutment_','_parapet_']):continue
 vv=[];ff=[]
 for f in m['faces']:
  poly=[m['vertices'][i]for i in f];pieces=[poly];xy=LineString([q[:2]for q in poly]).buffer(.001)
  for index in alltree.query(xy):
   c=cutters[int(index)]
   if max(v[2]for v in poly)<c[2]or min(v[2]for v in poly)>c[3]:continue
   # Earlier below-floor terrain cutters must not remove the structure underfoot.
   planes=list(c[0]);n,limit=planes[-1];planes[-1]=(n,limit-.55 if int(index)<len(tree.geometries)else limit)
   pieces=[q for face in pieces for q in subtract(face,planes)]
  for q in pieces:
   k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
 m['vertices']=vv;m['faces']=ff
# Complete buildings with actual openings, covered market frontage and interiors.
def cube(name,x,y,z,w,depth,h,mat='stone'):
 slab(name,[x-depth/2,y,z],[x+depth/2,y,z],w,0,h,mat)
for b in buildings:
 x,y,w,dep,h=b['x'],b['y'],b['w'],b['d'],b['h'];pave(b['id']+'_floor',shape(b['geometry']),14.15,'lane')
 for face,length,const,horiz in [('north',w,y+dep/2,True),('south',w,y-dep/2,True),('east',dep,x+w/2,False),('west',dep,x-w/2,False)]:
  opening=b['door'];ranges=[(-length/2,length/2)]if face!=b['face']else[(-length/2,-opening/2),(opening/2,length/2)]
  for j,(lo,hi)in enumerate(ranges):
   aa=[x+lo,const,14.15]if horiz else[const,y+lo,14.15];bb=[x+hi,const,14.15]if horiz else[const,y+hi,14.15];slab(b['id']+'_'+face+str(j),aa,bb,.5,0,h)
  if face==b['face']:
   aa=[x-opening/2,const,18.15]if horiz else[const,y-opening/2,18.15];bb=[x+opening/2,const,18.15]if horiz else[const,y+opening/2,18.15];slab(b['id']+'_lintel',aa,bb,.5,0,h-4)
 mesh(b['id']+'_roof',[[x-w/2,y-dep/2,14.15+h],[x+w/2,y-dep/2,14.15+h],[x+w/2,y+dep/2,14.15+h],[x-w/2,y+dep/2,14.15+h],[x-w/2,y,16+h],[x+w/2,y,16+h]],[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]],'wood')
# Wall brackets support stall awnings without posts crossing diagonal entries.
for b in buildings:
 if not b['id'].startswith('daily_stall'):continue
 direction=1 if b['face']=='north'else -1;yy=b['y']+direction*6
 slab(b['id']+'_awning',[b['x']-6,yy,17.6],[b['x']+6,yy,17.6],3,0,.15,'wood')
 for xx in [-5.5,5.5]:cube(b['id']+'_bracket_'+str(xx),b['x']+xx,b['y']+direction*4.2,17.15,.3,1.5,.45,'wood')
pave('freight_entry_apron',box(1127,336,1141,350),14.15,'primary')
# Seating and sorting remain off the pedestrian cross-link and cargo path.
for x in [1381,1395]:
 cube('table_top_'+str(x),x,263,14.8,1.5,3,.15,'wood')
 for dx in [-1,1]:cube('table_leg_'+str(x)+'_'+str(dx),x+dx,263,14.15,.3,.3,.65,'wood')
 for yy in [261.8,264.2]:cube('bench_'+str(x)+'_'+str(yy),x,yy,14.15,.4,3,.45,'wood')
cube('court_platform',1407,265,14.1,4,8,.15,'wood')
for x in [1429,1448]:cube('receiving_goods_'+str(x),x,256,14.15,2,3,1.5,'wood')
p['routes'].extend(new);p['audit']['routeCount']=len(p['routes']);p['negativeSpaces'].append(mapping(reserve))
p['landDomains'].append(dict(id='restored_mage_bank_lowland',heightM=14,geometry=mapping(restore)))
report=dict(status='REQUIRES_MESH_VISUAL_REVIEW',base='B82',parentGitHEAD='4373f25e213d37176a8e5cb756054625ac1efc6b',changedMeshes=sorted(set(changed)),addedMeshes=[m['name']for m in p['meshes']if m['name']not in oldnames],removedRoutes=removed_routes,replacedParcelIds=removed,restoredGroundAreaM2=restore.area,newRoutes=new,buildings=buildings,siteGeometry=mapping(site),freightLengthM=cart['lengthM'],freightGrade=cart['grade'],stairLengthM=stair['lengthM'],sources=['王都 A1:N35: shops/market, T06 logistics, T09/T14 repairs; read 2026-10-09','B75 handoff and supplied research PDF'],pending=['Actual mesh traversal','Remaining districts and large supports','Social gate and NPC/event runtime','Steep haulage traction, cart turning envelope and lighting'])
p['mageWallQuarterStudy']=report
out.mkdir(parents=True)
for name,value in [('plan.json',p),('parcels.json',d),('mage-wall-quarter-study.json',report)]:
 (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
print(json.dumps({k:report[k]for k in ['status','removedRoutes','restoredGroundAreaM2','freightLengthM','freightGrade','stairLengthM']}));print('REMOVED_PARCELS',len(removed))
