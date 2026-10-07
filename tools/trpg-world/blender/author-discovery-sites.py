"""Grounded discovery destinations in the existing city, with physical paths.
Adds no canonical facility IDs or invented history. Does not simulate NPCs.
"""
import json,sys,pathlib,math
from shapely.geometry import Point,LineString,Polygon,shape
from shapely.ops import nearest_points,unary_union
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing version protected')
plan=json.loads((src/'plan.json').read_text());parcels=json.loads((src/'parcels.json').read_text())
report={'status':'UNACCEPTED','destinations':[],'canonicalIdsAdded':[],'limitations':['NPC schedules and event crowd changes pending','New tower is a spatial proposal, not a new lore institution']}
def box(name,x,y,z,w,d,h,mat='stone'):
 v=[[x+a*w/2,y+b*d/2,z+c*h]for c in [0,1]for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 plan['meshes'].append(dict(name=name,vertices=v,faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material=mat))
def surface(name,poly,z,mat='lane'):
 v=[];f=[]
 for t in constrained_delaunay_triangles(poly).geoms:
  k=len(v);v.extend([[x,y,z]for x,y in list(t.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 plan['meshes'].append(dict(name=name,vertices=v,faces=f,material=mat))
def walk(name,ps,width,kind='life'):
 r=dict(id=name,points=ps,width=width,kind=kind,z0=ps[0][2],z1=ps[-1][2],grade=abs(ps[-1][2]-ps[0][2])/max(.01,LineString([p[:2]for p in ps]).length),lengthM=LineString([p[:2]for p in ps]).length,role='optional-life',beats=['decision','reveal','prospect'])
 plan['routes'].append(r)
 v=[];f=[]
 for i,p in enumerate(ps):
  a=ps[max(0,i-1)];b=ps[min(len(ps)-1,i+1)];dx=b[0]-a[0];dy=b[1]-a[1];d=math.hypot(dx,dy)or 1
  v.extend([[p[0]+sign*(-dy/d)*width/2,p[1]+sign*(dx/d)*width/2,p[2]+.16]for sign in [-1,1]])
  if i:f.append([2*i-2,2*i-1,2*i+1,2*i])
 plan['meshes'].append(dict(name=name,vertices=v,faces=f,material='stairs'if kind=='tower_stairs'else'lane'))
 return r
roads=[(r,LineString([p[:2]for p in r['points']]))for r in plan['routes']]
park=shape(plan['landscapeStudy']['geometry']);burial=Polygon(plan['burialCourtStudy']['plot'])
protected=unary_union([shape(p['geometry'])for p in parcels['parcels']]+[burial.buffer(4)])
# Choose tower from actual free park land close to the existing garden path.
options=[]
for x in range(780,1161,20):
 for y in range(1050,1341,20):
  p=Point(x,y);plot=p.buffer(17)
  if not park.covers(plot)or protected.intersects(plot):continue
  r,line=min([(r,l)for r,l in roads if r['kind']=='garden_walk'],key=lambda q:q[1].distance(p))
  if not 22<line.distance(p)<55:continue
  q=nearest_points(p,line)[1];entry=LineString([(q.x,q.y),(x,y-8)])
  if not park.covers(entry.buffer(2))or protected.intersects(entry.buffer(2)):continue
  if any(l.distance(plot)<r0['width']/2+1 for r0,l in roads if r0['kind']!='garden_walk'):continue
  options.append((abs(x-960)+abs(y-1180),x,y,r,entry))
if not options:raise RuntimeError('No real connected free tower site')
_,x,y,road,entry=min(options,key=lambda q:q[0])
# A modest 18m masonry lookout: external stair circles the shaft twice.
box('garden_watchtower_shaft',x,y,14,12,12,18)
surface('garden_watchtower_base',Point(x,y).buffer(15),14.08)
entry_ps=[[a,b,14]for a,b in entry.coords];walk('garden_watchtower_entry',entry_ps,3)
corners=[(x,y-8),(x+8,y-8),(x+8,y+8),(x-8,y+8),(x-8,y-8),(x,y-8)]
# Eight full side flights after the initial half-side; keep level corner aprons.
track=[(x,y-8),(x+8,y-8),(x+8,y+8),(x-8,y+8),(x-8,y-8),(x+8,y-8),(x+8,y+8),(x-8,y+8),(x-8,y-8),(x,y-8)]
lengths=[math.dist(a,b)for a,b in zip(track,track[1:])];total=sum(lengths);z=14;ps=[[x,y-8,z]];risers=[]
for a,b,length in zip(track,track[1:],lengths):
 landing=min(2.5,length*.2);rise=18*length/total;steps=math.ceil(rise/.17)
 # A horizontal start and end apron surrounds every turn.
 for t in [landing/length]:ps.append([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,z])
 run=length-2*landing
 for j in range(1,steps+1):
  t=(landing+run*j/steps)/length;ps.append([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,z+rise*j/steps])
 z+=rise;ps.append([*b,z]);risers.append({'rise':rise/steps,'tread':run/steps})
# Separate each flight in the graph: stacked XY alignments must retain their
# own heights so top access cannot be confused with the bottom circuit.
start=0
for serial,(a,b) in enumerate(zip(track,track[1:])):
 end=start+1
 while end<len(ps)-1 and math.dist(ps[end][:2],b)>1e-6:end+=1
 walk('garden_watchtower_flight_'+str(serial),ps[start:end+1],2.8,'tower_stairs')
 start=end
# Horizontal treads/risers, and an outside parapet following the same profile.
v=[];f=[];outer=[];of=[]
for a,b in zip(ps,ps[1:]):
 dx=b[0]-a[0];dy=b[1]-a[1];d=math.hypot(dx,dy)
 if d<1e-8:continue
 nx=-dy/d;ny=dx/d;k=len(v)
 v.extend([[a[0]+s*nx*1.4,a[1]+s*ny*1.4,a[2]+.16]for s in[-1,1]]+[[b[0]+s*nx*1.4,b[1]+s*ny*1.4,a[2]+.16]for s in[-1,1]]+[[b[0]+s*nx*1.4,b[1]+s*ny*1.4,b[2]+.16]for s in[-1,1]])
 f.extend([[k,k+1,k+3,k+2],[k+2,k+3,k+5,k+4]])
 # Choose outer face using the tower centre, never place a parapet in the walking strip.
 mx=(a[0]+b[0])/2;my=(a[1]+b[1])/2;sign=1 if (mx-x)*nx+(my-y)*ny>0 else -1
 q=len(outer);outer.extend([[a[0]+sign*nx*1.55,a[1]+sign*ny*1.55,a[2]+.16],[b[0]+sign*nx*1.55,b[1]+sign*ny*1.55,b[2]+.16],[b[0]+sign*nx*1.55,b[1]+sign*ny*1.55,b[2]+1.36],[a[0]+sign*nx*1.55,a[1]+sign*ny*1.55,a[2]+1.36]]);of.append([q,q+1,q+2,q+3])
# Replace diagonal route ribbon with physical treads.
plan['meshes']=[m for m in plan['meshes']if not m['name'].startswith('garden_watchtower_flight_')]
plan['meshes'].append(dict(name='garden_watchtower_stairs',vertices=v,faces=f,material='stairs'))
plan['meshes'].append(dict(name='garden_watchtower_stair_parapet',vertices=outer,faces=of,material='stone'))
deck=Polygon([(x-10,y-10),(x+10,y-10),(x+10,y+10),(x-10,y+10)])
# Opening above the final two flights prevents the viewing deck becoming a roof
# across the climbing route; the final top apron meets the deck outside the cut.
opening=LineString([track[-3],track[-2],(x-2.2,y-8)]).buffer(1.65,cap_style=2,join_style=2)
surface('garden_watchtower_view_deck',deck.difference(opening),32.16)
for side in [-1,1]:
 box('watchtower_deck_side_'+str(side),x+side*10,y,32.16,.5,20,1.2)
 box('watchtower_deck_end_'+str(side),x,y+side*10,32.16,20,.5,1.2)
# Top destination continues physically from the final flight across the deck.
walk('garden_watchtower_deck_walk',[[x,y-8,32],[x,y,32],[x+7,y,32]],2.8)
clear=Point(x,y).buffer(18).union(entry.buffer(6));plan['landscapeStudy']['trees']=[t for t in plan['landscapeStudy']['trees']if Point(t['position'][:2]).distance(clear)>t['radiusM']]
report['destinations'].append(dict(id='garden_watchtower',position=[x,y,14],entryFrom=road['id'],heightM=18,experience='Find a narrow garden branch, climb enclosed turns, recover city orientation from the deck',stairs=risers))
# Central market: leave all road corridors, trading courtyard and logistics approaches open.
market=Point(0,-50).buffer(65);market_roads=[(r,l)for r,l in roads if l.distance(market)<r['width']/2+4]
count=0
for ring,radius in enumerate([37,51]):
 for i in range(14):
  angle=i*math.tau/14+.15*ring;px=radius*math.cos(angle);py=-50+radius*math.sin(angle);plot=Polygon([(px-2.5,py-1.7),(px+2.5,py-1.7),(px+2.5,py+1.7),(px-2.5,py+1.7)])
  if any(l.distance(plot)<r['width']/2+2 for r,l in market_roads):continue
  box('market_stall_counter_'+str(count),px,py,14.16,5,1,.95)
  for sx in [-1,1]:box('market_stall_post_'+str(count)+'_'+str(sx),px+sx*2.2,py,14.16,.2,.2,2.8)
  box('market_stall_canopy_'+str(count),px,py,16.9,5.3,3.5,.15,'primary')
  for j in range(3):box('market_goods_'+str(count)+'_'+str(j),px-1.5+j*1.5,py-.2,15.11,.8,.6,.45,'ground')
  count+=1
report['destinations'].append(dict(id='central_market_stalls',canonicalParent='LOC_CAP_MARKET',stallCount=count,experience='Trade faces existing pedestrian routes; clear centre remains a crowd/information node'))
plan['discoverySitesStudy']=report;plan['audit']['routeCount']=len(plan['routes'])
for name,value in [('plan.json',plan),('parcels.json',parcels),('discovery-sites-audit.json',report)]:(out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps(report))
