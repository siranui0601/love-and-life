import json,pathlib,math,hashlib,collections
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
raw=(root/'plan.json').read_bytes();plan=json.loads(raw)
rmNames=[m['name']for m in plan['meshes'] if m['name'].startswith(('current_civic_royal_hoist_','current_royal_hoist_architecture_','current_royal_freight_hoist_'))]
rmNames += ['current_civic_upper_short_support','current_civic_upper_short_rail']
assert len(rmNames)==10,len(rmNames)
plan['meshes']=[m for m in plan['meshes'] if m['name']not in rmNames]
meshes={}
def addgroup(name,mat):
 g={'name':name,'vertices':[],'faces':[],'material':mat};meshes[name]=g;return g
mason=addgroup('repair_civic_gate_stair_bastion_masonry','stone')
cornice=addgroup('repair_civic_gate_stair_bastion_bands','limestone')
glass=addgroup('repair_civic_gate_stair_bastion_lancets','Noble iron')
roof=addgroup('repair_civic_gate_stair_bastion_roof','slate')
stone=addgroup('repair_civic_gate_stair_access_bridges','stone')
rail=addgroup('repair_civic_gate_stair_interior_balustrade','stone')
def add(g,vs,fs):
 j=len(g['vertices']);g['vertices'].extend([list(map(float,v))for v in vs]);g['faces'].extend([[j+i for i in f]for f in fs])
def quad(g,vs):add(g,vs,[[0,1,2,3]])
def box(g,cx,cy,z0,w,l,z1):
 x0,x1=cx-w/2,cx+w/2;y0,y1=cy-l/2,cy+l/2
 vs=[(x,y,z)for z in(z0,z1)for x,y in((x0,y0),(x1,y0),(x1,y1),(x0,y1))]
 add(g,vs,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def segment(g,a,b,r0,r1,z0,z1):
 c=(636.,664.)
 def xy(r,angle):return(c[0]+r*math.cos(angle),c[1]+r*math.sin(angle))
 inner0=xy(r0,a);inner1=xy(r0,b);outer0=xy(r1,a);outer1=xy(r1,b)
 vs=[(*inner0,z0),(*inner1,z0),(*outer1,z0),(*outer0,z0),(*inner0,z1),(*inner1,z1),(*outer1,z1),(*outer0,z1)]
 add(g,vs,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
def nearestangle(a,b):
 m=((a+b)/2+math.pi)%(2*math.pi)-math.pi
 return math.degrees(m)
n=16
# 70m climb is kept inside a thick sixteen-sided fortified tower rather than an exposed steel scaffold.
levels=[14,42,50,56,61,64,70,75,78,84,89,92,98,103,106,108,119.2,122]
portals={'southwest':-138.,'northwest':147.}
gates=collections.Counter()
for i in range(n):
 a=2*math.pi*i/n;b=2*math.pi*(i+1)/n;deg=nearestangle(a,b)
 for low,high in zip(levels,levels[1:]):
  if low>=42 and high<=50 and abs(((deg-portals['southwest']+180)%360)-180)<27:
   gates['lower_southwest']+=1;continue
  if low>=42 and high<=50 and abs(((deg+28+180)%360)-180)<27:
   gates['lower_east']+=1;continue
  if low>=108 and high<=119.2 and abs(((deg-78+180)%360)-180)<24:
   gates['upper_north_entry']+=1;continue
  if low>=108 and high<=119.2 and abs(((deg-portals['northwest']+180)%360)-180)<29:
   gates['upper_west_exit']+=1;continue
  segment(mason,a,b,17.5,19.9,low,high)
 # projecting courses and battlements are wholly outside the inhabited stair.
 for z in (41.5,55,69,83,97,121):
  segment(cornice,a,b,19.7,20.4,z,z+.55)
 for z in (62,76,90,104):
  if i%3 in(0,2):
   th=(a+b)/2
   nx,ny=math.cos(th),math.sin(th);tx,ty=-ny,nx
   x,y=636+nx*20.01,664+ny*20.01
   dx,dy=tx*1.15,ty*1.15
   quad(glass,[(x-dx,y-dy,z),(x+dx,y+dy,z),(x+dx,y+dy,z+4.2),(x-dx,y-dy,z+4.2)])
 # substantial tapering buttresses every second facet; no ground-to-roof iron pylons
 if i%2==0:
  th=a;w=.14
  segment(mason,th-w,th+w,19.4,23.8,14,47)
  segment(mason,th-w,th+w,19.5,21.5,47,119)
for i in range(n):
 a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
 for ang in (a,b):
  pass
 c=(636,664)
 edge=lambda ang,r,z:(c[0]+r*math.cos(ang),c[1]+r*math.sin(ang),z)
 quad(roof,[edge(a,20.6,123),edge(b,20.6,123),edge(b,20.6,125),edge(a,20.6,125)])
 add(roof,[edge(a,20.6,125),edge(b,20.6,125),(636,664,138)],[[0,1,2]])
# Tower base approach receives a real engineered buttress reaching the settled civic terrace.
# Ground at tower XY is absent; bridge masonry is not labeled natural soil.
def beam(g,a,b,width,bottom,top):
 dx=b[0]-a[0];dy=b[1]-a[1];ll=math.hypot(dx,dy)
 if ll<.2:return
 nx=-dy/ll*width/2;ny=dx/ll*width/2
 pts=[(a[0]+nx,a[1]+ny,bottom),(b[0]+nx,b[1]+ny,bottom),
      (b[0]-nx,b[1]-ny,bottom),(a[0]-nx,a[1]-ny,bottom),
      (a[0]+nx,a[1]+ny,top),(b[0]+nx,b[1]+ny,top),
      (b[0]-nx,b[1]-ny,top),(a[0]-nx,a[1]-ny,top)]
 add(g,pts,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
# Main pedestrian passage on the middle tier. The new causeway ties into actual civic_foot_ground at x~683,y647.
passage=[[635,651,42],[655,654,42],[685,647,42]]
walk=addgroup('repair_civic_stairtower_mid_access_road','paving')
for a,b in zip(passage,passage[1:]):
 beam(walk,a,b,4.4,41.94,42.16)
# Masonry load-bearing causeway with broad stone piers; solid deck avoids skintight balancing act.
beam(stone,[648,656],[687,647],10.5,36.6,41.94)
for x,y in ((659,653),(671,649.5)):
 box(stone,x,y,14,7.8,11.4,37.1)
 # wide grounded load bearing piers, not 60m-thin steel rods
beam(stone,[651,656],[685,648],7.8,34.5,36.7)
# northern upper bridge set into the upper-city escarpment.
beam(stone,[602,674],[620,677],10.3,104,111.98)
beam(walk,[602,674],[620,677],4.2,111.94,112.18)
# A short arcade connects the tower upper exit to the existing, preserved grade-112 bridge.
for x,y in ((606,673.5),(614,675.5)):
 box(stone,x,y,98,3.2,10.4,104)
for z in (55,69,83,97,111):
 # Articulated internal stone corbels: horizontal galleries meet the tower's inner wall.
 for i in (1,5,9,13):
  ang=2*math.pi*(i+.5)/16
  px=636+17.5*math.cos(ang);py=664+17.5*math.sin(ang)
  xx=636+13.9*math.cos(ang);yy=664+13.9*math.sin(ang)
  beam(stone,[px,py],[xx,yy],2.2,z-2.1,z-.6)
# Reintroduce safe solid balustrades near the actual path rather than unsupported metal framework.
r=next(x for x in plan['routes']if x['id']=='current_civic_upper_short_stair_east')
interior=r['points'][1:-2]
guardPoints=interior+passage
removedBalustradeSegments=0
for k in range(0,len(interior)-4,7):
 a=interior[k];b=interior[min(k+7,len(interior)-1)]
 if abs(a[2]-b[2])>3 or math.hypot(a[0]-b[0],a[1]-b[1])>13:continue
 dx=b[0]-a[0];dy=b[1]-a[1];L=math.hypot(dx,dy)
 if L<.5:continue
 nx=-dy/L;ny=dx/L
 for sign in(-1,1):
  aa=(a[0]+nx*1.6*sign,a[1]+ny*1.6*sign,a[2])
  bb=(b[0]+nx*1.6*sign,b[1]+ny*1.6*sign,b[2])
  # A sidewall crossing a return-flight centerline blocks actual walking;
  # test ALL floor route points at comparable Z, not only its parent tread segment.
  ux=bb[0]-aa[0];uy=bb[1]-aa[1];den=ux*ux+uy*uy
  crossed=False
  for q in guardPoints:
   t=max(0,min(1,((q[0]-aa[0])*ux+(q[1]-aa[1])*uy)/den))
   mx=aa[0]+t*ux;my=aa[1]+t*uy
   if math.hypot(q[0]-mx,q[1]-my)<1.45 and abs(q[2]-(aa[2]+t*(bb[2]-aa[2])))<2.6:
    crossed=True;break
  if crossed:
   removedBalustradeSegments+=1;continue
  add(rail,[(aa[0],aa[1],aa[2]+.3),(bb[0],bb[1],bb[2]+.3),
        (bb[0],bb[1],bb[2]+1.2),(aa[0],aa[1],aa[2]+1.2)],[[0,1,2,3]])
newRoute=dict(id='repair_civic_stairtower_middle_secondary_access',points=passage,
  width=4.2,kind='life',z0=42,z1=42,
  lengthM=round(sum(math.dist(a,b)for a,b in zip(passage,passage[1:])),3),grade=0)
print('BALUSTRADE_SKIPPED_NEAR_WALKWAY',removedBalustradeSegments,flush=True)
# Different watchtower rooflines break the silo-like silhouette; all are joined to the bastion.
turretData=[(0,121,130),(90,125,136),(270,127,139)]
for angle,eave,apex in turretData:
 rad=math.radians(angle);cx=636+22.5*math.cos(rad);cy=664+22.5*math.sin(rad)
 N=10
 def vertex(ra,ang,z):return(cx+ra*math.cos(ang),cy+ra*math.sin(ang),z)
 for i in range(N):
  a=2*math.pi*i/N;b=2*math.pi*(i+1)/N
  aa=vertex(3.7,a,14);bb=vertex(3.7,b,14)
  aa2=vertex(3.7,a,eave);bb2=vertex(3.7,b,eave)
  quad(mason,[aa,bb,bb2,aa2])
  quad(cornice,[vertex(4.1,a,eave-.35),vertex(4.1,b,eave-.35),
                vertex(4.1,b,eave+.35),vertex(4.1,a,eave+.35)])
  add(roof,[vertex(4.15,a,eave+.7),vertex(4.15,b,eave+.7),(cx,cy,apex)],[[0,1,2]])
  if i%2==0:
   mid=(a+b)/2;x,y,_=vertex(3.74,mid,eave-7)
   quad(glass,[(x,y,eave-9.5),(x,y,eave-6.1),
               (x+.06*math.cos(mid),y+.06*math.sin(mid),eave-6.1),
               (x+.06*math.cos(mid),y+.06*math.sin(mid),eave-9.5)])
print('ORNAMENT_WATCHTOWERS',len(turretData),flush=True)
plan['routes'].append(newRoute)
plan['audit']['routeCount']=len(plan['routes'])
plan['meshes'].extend(g for g in meshes.values()if g['faces'])
plan['hoistOperation']['status']='VISUAL_PROTOTYPE_DECOMMISSIONED'
plan['hoistOperation']['caveats']=list(plan['hoistOperation'].get('caveats',[]))+['The obsolete animated hoist mock-up is omitted; real lift/cargo transport and player control are NOT implemented.']
plan['civicStairTower20261012']=dict(status='VISUAL_AND_ROAD_QA_REQUIRED',basePlanSha256=hashlib.sha256(raw).hexdigest(),
 removed=rmNames,originalRoutePreserved='current_civic_upper_short_stair_east',
 newAccessRoute=newRoute['id'],newMeshes=[(g['name'],len(g['vertices']),len(g['faces']))for g in meshes.values()],
 portalGaps=dict(gates),footing='Engineered stone buttress anchored to civic_foot_ground, upper gallery wall; missing natural low terrace ground NOT filled',
 limitations=['No real freight elevator until implemented','Actor capsule clearance and glass/window overlap not yet validated',
              'The tower sits in a major natural terrain void; cantilever and approach must pass viewpoint inspections'])
out=root/'civic-stairtower-20261012.v6.staged.plan.json'
out.write_text(json.dumps(plan,separators=(',',':')),encoding='utf8')
(root/'civic-stairtower-20261012.v6.study.json').write_text(json.dumps(plan['civicStairTower20261012'],indent=2,ensure_ascii=False),encoding='utf8')
print('STAGE',len(rmNames),'removed',len(meshes),'new',len(plan['routes']),'routes','PORTALS',dict(gates),flush=True)
