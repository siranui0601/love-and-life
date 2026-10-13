"""A connected forge/work court in a measured residual plot, not scattered fillers.
Canon: comprehensive design row117; capital weapon shop row21, T09/T14 supply.
No new facility ID, guild authority, named NPC or funeral custom is established.
"""
import json,pathlib,sys,math
from shapely.geometry import shape,Point,LineString,Polygon,mapping
from shapely.ops import unary_union,polylabel,nearest_points
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing study protected')
p=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text())
canon=unary_union([shape(q['geometry'])for q in data['parcels']if q.get('canonicalFacilityId')]+[Point(0,-50).buffer(100)])
roads=[(r,LineString([v[:2]for v in r['points']]))for r in p['routes']if r['z0']==r['z1']==14 and r['width']>=5]
options=[];by_block={}
for q in data['parcels']:by_block.setdefault(q.get('blockId'),[]).append(shape(q['geometry']))
domains=unary_union([shape(d['geometry'])for d in p['landDomains']if d['heightM']==14])
for block in data['blocks']:
 if block['heightM']!=14:continue
 geom=shape(block['geometry']);lots=by_block.get(block['id'],[])
 free=geom.difference(unary_union(lots+[canon]))
 pieces=[free]if free.geom_type=='Polygon'else list(getattr(free,'geoms',[]))
 for poly in pieces:
  if poly.geom_type!='Polygon' or poly.area<1600:continue
  c=polylabel(poly,tolerance=1);x,y=c.x,c.y
  if not(600<x<1400 and -350<y<250):continue
  plot=Point(x,y).buffer(26)
  if not poly.covers(plot)or canon.intersects(plot):continue
  candidates=[]
  for road,line in roads:
   q=nearest_points(c,line)[1];d=max(.001,c.distance(q));front=(x+(q.x-x)*24/d,y+(q.y-y)*24/d);entry=LineString([(q.x,q.y),front,(x,y)])
   reserve=plot.union(entry.buffer(2.5))
   if entry.length>140 or canon.intersects(reserve):continue
   # A service court must be reached through a real opening, never through houses.
   removed=[b for b in data['parcels']if any(shape(f).intersects(reserve)for f in b['footprints'])]
   if len(removed)>1 or any(b.get('canonicalFacilityId')for b in removed):continue
   if sum(shape(f).area for b in removed for f in b['footprints'])>400:continue
   # Match floor height along the entire new entry.
   if not domains.buffer(.1).covers(entry.buffer(2.5)):continue
   candidates.append((entry.length+len(removed)*80,road,entry,removed))
  if candidates:
   cost,road,entry,removed=min(candidates,key=lambda q:q[0]);options.append((cost+abs(x-1050)*.05+abs(y)*.1,x,y,block,plot,road,entry,removed))
if not options:raise RuntimeError('No service-connected residual plot; do not force a forge into housing')
_,x,y,block,plot,road,entry,removed=min(options,key=lambda q:q[0]);angle=math.atan2(entry.coords[0][1]-y,entry.coords[0][0]-x)+math.pi/2;mesh_start=len(p['meshes']);route_start=len(p['routes']);ids={b['id']for b in removed}
data['parcels']=[b for b in data['parcels']if b['id']not in ids]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds']if i not in ids]
data['audit']['parcelCount']=len(data['parcels'])
def box(name,cx,cy,z,w,d,h,material='stone'):
 v=[[cx+a*w/2,cy+b*d/2,z+c*h]for c in [0,1]for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 p['meshes'].append(dict(name=name,vertices=v,faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material=material))
def paving(name,geom,z=14.2):
 v=[];f=[]
 for tri in constrained_delaunay_triangles(geom).geoms:
  k=len(v);v.extend([[a,b,z]for a,b in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 p['meshes'].append(dict(name=name,vertices=v,faces=f,material='lane'))
def walk(name,line,width,role):
 ps=[]
 for a,b in zip(list(line.coords),list(line.coords)[1:]):
  n=max(1,math.ceil(math.dist(a,b)/2));ps.extend([[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,14]for i in range(n)])
 ps.append([*line.coords[-1],14]);p['routes'].append(dict(id=name,points=ps,width=width,kind='service'if role=='service-logistics'else'life',z0=14,z1=14,lengthM=line.length,grade=0,role=role,beats=['decision','release','reveal']))
 paving(name,line.buffer(width/2))
paving('craft_court_shared_floor',plot.union(entry.buffer(2.5)))
walk('craft_court_cart_entry',entry,5,'service-logistics')
loop=LineString([(x-13,y+6),(x+13,y+6),(x+13,y-12),(x-13,y-12),(x-13,y+6)])
walk('craft_court_optional_loop',loop,2.4,'optional-life')
walk('craft_court_workshop_door',LineString([(x,y),(x,y+8)]),3,'optional-life')
# Public approach enters an open working bay; rear wall/sides communicate use.
box('craft_workshop_rear',x,y+15,14.2,20,1,8)
for side in [-1,1]:box('craft_workshop_side_'+str(side),x+side*10,y+12,14.2,1,7,8)
v=[[x-11,y+8,22.2],[x+11,y+8,22.2],[x+11,y+16,22.2],[x-11,y+16,22.2],[x-11,y+12,25],[x+11,y+12,25]]
p['meshes'].append(dict(name='craft_workshop_pitched_roof',vertices=v,faces=[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]],material='stone'))
# Workstations are behind the pedestrian threshold, separate from turning space.
for side in [-1,1]:box('craft_furnace_side_'+str(side),x-6+side*1.1,y+12,14.2,.8,2.5,2.2)
box('craft_furnace_back',x-6,y+13,14.2,3,.5,2.2)
box('craft_furnace_hood',x-6,y+12,16.4,3,2.5,.4)
box('craft_hearth',x-6,y+12.4,14.3,1.2,.8,.4,'hot')
box('craft_chimney',x-7,y+13,14.2,1.8,1.8,15)
box('craft_anvil_base',x+6,y+11,14.2,1.6,1.2,.8);box('craft_anvil',x+6,y+11,15,2,.7,.45,'iron')
box('craft_bellows',x-3.5,y+12,14.2,1.5,1,.9)
box('craft_quench_basin',x+7,y+14,14.2,2,1.2,.8)
# Stock racks frame the entry to work, without blocking the shared 5m cargo lane.
for i in range(3):
 box('craft_stock_'+str(i),x+7+i*2,y-5,14.2,1.4,2,.8+i*.25,'wood')
box('craft_notice_frame',x-8,y+3,14.2,.3,2,2.4)
# Face the open working bay toward the real street, not an arbitrary north.
def orient(v):
 a=v[0]-x;b=v[1]-y;return [x+a*math.cos(angle)-b*math.sin(angle),y+a*math.sin(angle)+b*math.cos(angle),v[2]]
for m in p['meshes'][mesh_start:]:
 if m['name']not in ['craft_court_cart_entry','craft_court_shared_floor']:m['vertices']=[orient(v)for v in m['vertices']]
for r in p['routes'][route_start:]:
 if r['id']!='craft_court_cart_entry':r['points']=[orient(v)for v in r['points']]
report=dict(status='PROPOSED_NOT_CANON',position=[x,y,14],orientationRadians=angle,blockId=block['id'],plot=mapping(plot),entryFrom=road['id'],frontageParcelsReplaced=sorted(ids),roles=['physical artisan work and repair','cargo delivery and visible material stocks','optional working-court detour'],canonSources=['総合設計書117: function/culture/history','王都21: weapon supplies change with T09/T14'],eventDesign={'T09':'Imported Dwarven stock shortages can redirect buyers to local repair','T14':'Material quality dispute/inspection around stock racks; same court remains'},pending=['No NPC schedule, smithing economy or event runtime yet','Local workshop is proposed urban detail, not reassigned LOC_CAP_WEAPON_SHOP','No guild monopoly or cremation lore added'])
reserve=plot.union(entry.buffer(2.5))
p['negativeSpaces'].append(mapping(reserve))
p.setdefault('programmedSpacesStudy',[]).append(dict(id='craft_court',heightM=14,geometry=mapping(reserve),status='PROPOSED_NOT_ACCEPTED',purpose='Open forge court and cargo approach'))
p['craftCourtStudy']=report;p['audit']['routeCount']=len(p['routes'])
for name,value in [('plan.json',p),('parcels.json',data),('craft-court-study.json',report)]:(out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps({k:v for k,v in report.items()if k!='plot'}))
