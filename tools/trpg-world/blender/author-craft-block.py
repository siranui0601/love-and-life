"""Replace ordinary residential frontage with a coherent artisan compound.
Uses real block, street and terrain geometry. No canonical institution is invented.
"""
import json,pathlib,sys,math
from shapely.geometry import shape,Point,LineString,Polygon,mapping
from shapely.ops import unary_union,nearest_points
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing version protected')
p=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text())
block=next(b for b in data['blocks']if b['id']=='low_city_852');land=shape(block['geometry']);centre=Point(1228.374,-29.48)
canonical=unary_union([shape(q['geometry']).buffer(3)for q in data['parcels']if q.get('canonicalFacilityId')]+[shape(g)for g in p['negativeSpaces']])
roads=[(r,LineString([v[:2]for v in r['points']]))for r in p['routes']if r['z0']==r['z1']==14]
road,line=next((r,l)for r,l in roads if r['id']=='low_city_contour_1');q=nearest_points(centre,line)[1];d=q.distance(centre);iy=(centre.x-q.x)/d,(centre.y-q.y)/d;ix=(iy[1],-iy[0])
options=[]
for setback in [road['width']/2+2,road['width']/2+5,road['width']/2+9,road['width']/2+14]:
 ox=q.x+iy[0]*setback;oy=q.y+iy[1]*setback
 def world(a,b,z=14):return [ox+ix[0]*a+iy[0]*b,oy+ix[1]*a+iy[1]*b,z]
 for w in [88,80,72]:
  for depth in [88,80,72]:
   plot=Polygon([world(a,b)[:2]for a,b in [(-w/2,0),(w/2,0),(w/2,depth),(-w/2,depth)]])
   if not land.buffer(.02).covers(plot)or canonical.intersects(plot):continue
   entry=LineString([q,Point(world(0,0)[:2]),Point(world(0,36)[:2])])
   reserve=plot.union(entry.buffer(3.5))
   if any(l.distance(plot)<r['width']/2+.8 for r,l in roads if r['id']!=road['id']):continue
   removed=[b for b in data['parcels']if shape(b['geometry']).intersects(reserve)]
   if any(b.get('canonicalFacilityId')for b in removed):continue
   options.append((w*depth-len(removed)*40-setback*30,ox,oy,w,depth,setback,plot,entry,removed))
if not options:raise RuntimeError('No street-facing compound fits this block; redesign site rather than cover streets')
_,ox,oy,w,depth,setback,plot,entry,removed=max(options,key=lambda a:a[0]);ids={b['id']for b in removed}
def world(a,b,z=14):return [ox+ix[0]*a+iy[0]*b,oy+ix[1]*a+iy[1]*b,z]
# Rear loading entrance opens to a second real street, not a dead-end service warp.
rear_options=[]
for rr,ll in roads:
 if rr['id']==road['id'] or rr['width']<6:continue
 back=Point(world(0,depth+2)[:2]);target=nearest_points(back,ll)[1]
 projected=(target.x-ox)*iy[0]+(target.y-oy)*iy[1]
 if projected<depth+5:continue
 link=LineString([world(0,depth-26)[:2],world(0,depth+2)[:2],list(target.coords)[0]])
 domains=unary_union([shape(g['geometry'])for g in p['landDomains']if g['heightM']==14])
 if link.length>110 or canonical.intersects(link.buffer(3))or not domains.buffer(.1).covers(link.buffer(3)):continue
 extra=[b for b in data['parcels']if shape(b['geometry']).intersects(link.buffer(3))]
 if any(b.get('canonicalFacilityId')for b in extra):continue
 rear_options.append((link.length+len(extra)*3,rr,link,extra))
if not rear_options:raise RuntimeError('No safe rear loading street; do not fabricate a shortcut')
_,rear_road,rear_link,extra=min(rear_options,key=lambda a:a[0])
removed=list({b['id']:b for b in removed+extra}.values());ids={b['id']for b in removed}
# Record the exact former plots. Canonical sites and baseline routes stay intact.
data['parcels']=[b for b in data['parcels']if b['id']not in ids]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds']if i not in ids]
data['audit']['parcelCount']=len(data['parcels'])
def mesh(name,vertices,faces,material='stone'):
 p['meshes'].append(dict(name=name,vertices=vertices,faces=faces,material=material))
def box(name,a,b,z,width,length,height,material='stone'):
 v=[world(a+dx*width/2,b+dy*length/2,z+dz*height)for dz in [0,1]for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 mesh(name,v,[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material)
def paving(name,geom):
 v=[];f=[]
 for tri in constrained_delaunay_triangles(geom).geoms:
  k=len(v);v.extend([[x,y,14.2]for x,y in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 mesh(name,v,f,'lane')
def walk(name,points,width,role):
 line=LineString(points);ps=[]
 for a,b in zip(list(line.coords),list(line.coords)[1:]):
  n=max(1,math.ceil(math.dist(a,b)/2));ps.extend([[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,14]for i in range(n)])
 ps.append([*line.coords[-1],14]);p['routes'].append(dict(id=name,points=ps,width=width,kind='service'if role=='service-logistics'else'life',z0=14,z1=14,lengthM=line.length,grade=0,role=role,beats=['compression','release','decision','reveal']))
 paving(name,line.buffer(width/2))
def localwalk(name,points,width,role):walk(name,[world(a,b)[:2]for a,b in points],width,role)
def roof(name,a0,a1,b0,b1,eave,height):
 v=[world(a,b,eave)for a,b in [(a0,b0),(a1,b0),(a1,b1),(a0,b1)]]+[world(a,b,eave+height)for a,b in [(a0,(b0+b1)/2),(a1,(b0+b1)/2)]]
 mesh(name,v,[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]],'wood')
reserve=plot.union(entry.buffer(3.5)).union(rear_link.buffer(3));paving('craft_block_ground',reserve)
walk('craft_court_cart_entry',list(entry.coords),7,'service-logistics')
walk('craft_block_rear_loading',list(rear_link.coords),6,'service-logistics')
# Main logistics aisle ends at a broad turning court. The slower foot loop reads workshops.
localwalk('craft_block_cargo_spine',[(0,36),(0,depth-26),(w/2-19,depth-26)],6,'service-logistics')
loopx=w/2-23;loopy=depth-24
localwalk('craft_block_work_loop',[(-loopx,19),(loopx,19),(loopx,loopy),(-loopx,loopy),(-loopx,19)],3.2,'optional-life')
localwalk('craft_block_assembly_entry',[(0,depth-26),(0,depth-18)],4,'optional-life')
# Street-facing display/commission bays flank a 14m public entrance.
for side in [-1,1]:
 a0=-w/2+2 if side<0 else 7;a1=-7 if side<0 else w/2-2;mid=(a0+a1)/2
 box('craft_front_rear_'+str(side),mid,15,14.2,a1-a0,1,9)
 for a in [a0,a1]:box('craft_front_side_'+str(side)+'_'+str(a),a,8,14.2,.6,14,9)
 roof('craft_front_roof_'+str(side),a0-1,a1+1,1,16,23.2,3)
 for a in [mid-5,mid+5]:box('craft_display_'+str(side)+'_'+str(a),a,10,14.2,3,1.2,1.1,'wood')
 start=nearest_points(Point(world(mid,-setback)[:2]),line)[1]
 walk('craft_front_public_'+str(side),[list(start.coords)[0],world(mid,-2)[:2],world(mid,3)[:2],world(mid,7)[:2]],3,'optional-life')
# Left long workshop opens into the pedestrian court; right warehouse opens to loading.
left=-w/2+2;innerleft=-w/2+18;right=w/2-2;innerright=w/2-18
box('craft_forge_outer_wall',left,(22+depth-22)/2,14.2,1,depth-44,10)
for b in [22,depth-22]:box('craft_forge_end_'+str(b),(left+innerleft)/2,b,14.2,innerleft-left,1,10)
roof('craft_forge_roof',left-1,innerleft+1,21,depth-21,24.2,4)
box('craft_warehouse_outer_wall',right,(24+depth-20)/2,14.2,1,depth-44,12)
for b in [24,depth-20]:box('craft_warehouse_end_'+str(b),(right+innerright)/2,b,14.2,right-innerright,1,12)
roof('craft_warehouse_roof',innerright-1,right+1,23,depth-19,26.2,4)
# Rear assembly/service building creates a three-sided yard rather than an isolated prop.
for side in [-1,1]:box('craft_assembly_rear_'+str(side),side*(w/4+1),depth-2,14.2,w/2-6,1,10)
for a in [-w/2+2,w/2-2]:box('craft_assembly_side_'+str(a),a,depth-10,14.2,1,16,10)
roof('craft_assembly_roof',-w/2+1,w/2-1,depth-18,depth-1,24.2,4)
localwalk('craft_block_forge_entry',[(-loopx,36),(innerleft-2,36)],3,'optional-life')
localwalk('craft_block_warehouse_entry',[(loopx,48),(innerright+2,48)],4,'service-logistics')
# Multiple real workstations: none in cargo/foot aisles. Chimneys mark the working quarter.
for i,b in enumerate([31,depth-31]):
 a=left+5
 for side in [-1,1]:box('craft_furnace_side_'+str(i)+'_'+str(side),a+side*1.1,b,14.2,.8,3,2.5)
 box('craft_furnace_back_'+str(i),a,b+1.2,14.2,3,.6,2.5)
 box('craft_furnace_hood_'+str(i),a,b,16.7,3,3,.5)
 box('craft_hearth_'+str(i),a,b+.5,14.3,1.2,.8,.4,'hot')
 box('craft_chimney_'+str(i),a-1,b+1.1,14.2,2,2,22-i*2)
 box('craft_anvil_base_'+str(i),innerleft-5,b,14.2,1.5,1,.8)
 box('craft_anvil_'+str(i),innerleft-5,b,15,2,.7,.45,'iron')
 box('craft_quench_'+str(i),innerleft-5,b+4,14.2,2,1.4,.8)
for i in range(5):box('craft_warehouse_stock_'+str(i),right-5,29+i*7,14.2,3.5,3,2.2,'wood')
# Cart turning apron is physically empty. Notice/inspection bench sits away from circulation.
box('craft_quality_notice',-8,depth-20,14.2,.4,2,2.3,'wood')
box('craft_inspection_bench',-12,depth-20,14.2,4,1.5,1,'wood')
# Rear assembly has an actual 8m loading gate; public and freight choices share the court.

p['negativeSpaces'].append(mapping(reserve));p.setdefault('programmedSpacesStudy',[]).append(dict(id='craft_block',heightM=14,geometry=mapping(reserve),status='PROPOSED_NOT_ACCEPTED',purpose='Street-facing artisan compound with work court and two physical entrances'))
report=dict(status='PROPOSED_NOT_CANON',blockId=block['id'],position=world(0,depth/2),origin=[ox,oy,14],axisX=list(ix),axisY=list(iy),widthM=w,depthM=depth,areaM2=plot.area,entryFrom=road['id'],rearEntryFrom=rear_road['id'],streetSetbackM=setback,replacedParcelIds=sorted(ids),removedRoutes=[],formerParcelAreaM2=sum(shape(b['geometry']).area for b in removed),canonSources=['総合設計書117: identifiable function/culture/history','王都21: T09/T14 weapon supply'],eventDesign={'T09':'local repair/commission versus depleted imported stock','T14':'quality inspection and disputed goods in same working court'},pending=['No canonical weapon shop relocation','No named guild/institution or NPC added','NPC work schedules, production, prices and incident states still pending','Compound remains a morphology proposal, not final art'])
report['cameras']=[dict(name='Craft-block-frontage',position=world(0,-12,15.9),target=world(0,38,18)),dict(name='Craft-block-context',position=world(100,-90,110),target=world(0,depth/2,19),scale=210),dict(name='Craft-block-forge-eye',position=world(innerleft-1,36,15.9),target=world(left+5,31,16)),dict(name='Craft-block-cargo-eye',position=world(0,30,15.9),target=world(innerright,48,19))]
p['craftBlockStudy']=report;p['audit']['routeCount']=len(p['routes'])
for name,value in [('plan.json',p),('parcels.json',data),('craft-block-study.json',report)]:(out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps({k:v for k,v in report.items()if k!='cameras'}))
