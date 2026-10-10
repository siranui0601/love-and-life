"""Current market restored site: coherent mixed craft neighborhood (WIP).

Ground area only. Preserves canonical parcels, original routes and no new canon
facilities. Replaces barren restored market wedge with 2 linked paths, 2 alleys,
large work-yards and exploratory destination courtyard features. Ground Z=14.
"""
import pathlib,json,math,sys
from shapely.geometry import Polygon,LineString,Point,box
from shapely.ops import unary_union
root=pathlib.Path(sys.argv[1])
p=json.loads((root/'plan.json').read_text(encoding='utf8'))
q=json.loads((root/'parcels.json').read_text(encoding='utf8'))
m=next(m for m in p['meshes'] if m['name']=='western_ascent_market_ascent_restored_ground')
patch=unary_union([Polygon([m['vertices'][i][:2]for i in f])for f in m['faces']]).buffer(0)
if patch.area<31000:raise RuntimeError('Unexpected source patch')
if any(m['name'].startswith('current_craft_')for m in p['meshes']):raise RuntimeError('Existing new craft district - stop')
if any(r['id'].startswith('current_craft_')for r in p['routes']):raise RuntimeError('Existing craft roads - stop')
# Nodes rely on real source road termini, not invented inaccessible gates.
paths=[
 ('current_craft_west_spine',6,[(-492,105),(-509,120),(-539,132),(-568,141),(-598,138),(-617,121)]),
 ('current_craft_east_spine',6,[(-425,90),(-414,108),(-408,131),(-382,143),(-343,148),(-312,153),(-280,161),(-248,170),(-208,177)]),
 ('current_craft_west_yard_lane',4,[(-568,141),(-579,159),(-585,170)]),
 ('current_craft_midway_cutthrough',4,[(-408,131),(-426,145),(-455,149)]),
 ('current_craft_east_garden_path',3,[(-312,153),(-319,138),(-331,123)]),
]
oldIds={r['id']for r in p['routes']}
newRoads=[]
for name,width,xy in paths:
 if name in oldIds:raise RuntimeError('Duplicate road')
 line=LineString(xy)
 if not patch.buffer(3.7).covers(line):print('WARNING_ROAD_OUTSIDE_PATCH',name,round(line.difference(patch.buffer(3.7)).length,1))
 r=dict(id=name,points=[[float(x),float(y),14.]for x,y in xy],width=width,kind='life'if width>=4 else 'alley',
        z0=14,z1=14,lengthM=round(line.length,3),grade=0)
 p['routes'].append(r);newRoads.append(r)
# All pre-existing life routes are protected when laying out workshops.
currentRoads=[]
for r in p['routes']:
 if abs(r['z0']-14)>.01 or abs(r['z1']-14)>.01 or len(r['points'])<2:continue
 line=LineString([v[:2]for v in r['points']])
 if not line.intersects(patch.buffer(40)):continue
 currentRoads.append(line.buffer(r['width']/2+3.0))
roadmask=unary_union(currentRoads)
# Avoid four older market stalls, roofed small service structures, parcels and
# walls. The source patch has zero overlapping residential parcels (verified).
oldStalls=[m for m in p['meshes'] if m['name'].startswith('western_ascent_market_arrival_stall_')]
for m in oldStalls:
 v=m['vertices']
 if not v:continue
 xmin=min(x[0]for x in v)-2;xmax=max(x[0]for x in v)+2
 ymin=min(x[1]for x in v)-2;ymax=max(x[1]for x in v)+2
 roadmask=roadmask.union(box(xmin,ymin,xmax,ymax))
sites=[
 ('caravan_wheelwright',(-585,110),(32,17),'wagon and timber repairs, accessible cart yard'),
 ('stonecutters_yard',(-545,165),(31,17),'stonecutters and repair supply for upper walls'),
 ('craft_guild_hall',(-505,150),(28,15),'craft charter office and roofed guild courtyard'),
 ('forgehall',(-383,117),(31,16),'craft smithy and working forge'),
 ('dyeing_drying_yard',(-365,130),(20,10),'dyeing and dry-rack courtyard'),
 ('herbal_common',(-265,148),(20,11),'public herb garden and shade courtyard'),
]
used=[];facilities=[];obstacles=roadmask
for key,target,dim,role in sites:
 W,H=dim
 allowed=patch.buffer(-3.0)
 tries=[]
 for dx in (0,-5,5,-10,10,-15,15):
  for dy in (0,-4,4,-8,8,-12,12):
   cx=target[0]+dx;cy=target[1]+dy
   footprint=box(cx-W/2,cy-H/2,cx+W/2,cy+H/2)
   # all buildings within defensible, stable terrain, not roads/old stalls
   if not allowed.covers(footprint):continue
   if obstacles.buffer(1.4).intersects(footprint):continue
   cost=dx*dx+dy*dy
   tries.append((cost,cx,cy,footprint))
 if not tries:
  print('SKIP_UNFIT_SITE',key,target,dim)
  continue
 _,x,y,footprint=min(tries,key=lambda x:x[0])
 obstacles=obstacles.union(footprint.buffer(5))
 used.append(footprint)
 facilities.append(dict(id=key,center=[x,y],size=[W,H],role=role,officialCanonical=False))
if len(facilities)<3:raise RuntimeError('Insufficient site availability; not safe to build')
# Access roads to each workshop gate, rooted in a real arterial. These
# are actual traversable route centerlines, not detached visual doorways.
facilityLinks=[]
allMajor=[LineString([pt[:2]for pt in r['points']])for r in newRoads[:2]]
for site in facilities:
 x,y=site['center'];W,H=site['size']
 options=[]
 for k,line in enumerate(allMajor):
  toward=line.interpolate(line.project(Point(x,y)))
  if toward.y>=y:
   side='north';gate=(x,y+H/2-1.4)
  else:
   side='south';gate=(x,y-H/2+1.4)
  run=LineString([toward.coords[0],(x,y+H/2+3 if side=='north' else y-H/2-3),gate])
  if run.length<2:continue
  if not patch.buffer(4).covers(run):continue
  if any(run.buffer(1.6).intersects(f)for f in used if f!=box(x-W/2,y-H/2,x+W/2,y+H/2)):continue
  options.append((run.length,side,run))
 if not options:
  site['access']='unverified_no_spur'
  continue
 _,side,run=min(options,key=lambda a:a[0])
 site['access']=side
 route=dict(id='current_craft_access_'+site['id'],
            points=[[float(a),float(b),14.]for a,b in run.coords],width=3.2,
            kind='alley',z0=14,z1=14,lengthM=round(run.length,3),grade=0)
 p['routes'].append(route);facilityLinks.append(route)
newRoads.extend(facilityLinks)
# Feature-level paving, geometry mesh layer batching. Keep road/footprint
# physically uninterrupted, and use individual facilities as semantic groups.
geo={}
def add(kind,name,verts,faces):
 group=geo.setdefault(kind,dict(vertices=[],faces=[],records=[]))
 k=len(group['vertices'])
 group['vertices'].extend([[float(x)for x in v]for v in verts])
 group['faces'].extend([[k+i for i in f]for f in faces])
 group['records'].append(name)
def cuboid(kind,name,x,y,z,w,h,depth):
 v=[[x-w/2,y-h/2,z],[x+w/2,y-h/2,z],[x+w/2,y+h/2,z],[x-w/2,y+h/2,z]]
 v+= [[t[0],t[1],z+depth]for t in v]
 faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
 add(kind,name,v,faces)
def roof(name,x,y,z,w,h,rise,mat):
 x0=x-w/2;x1=x+w/2;y0=y-h/2;y1=y+h/2
 v=[[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z],[x,y0,z+rise],[x,y1,z+rise]]
 add(mat,name,v,[[0,1,4],[3,5,2],[0,4,5,3],[4,1,2,5]])
def flatpoly(kind,name,pts,z=14.18):
 if len(pts)<3:return
 add(kind,name,[[x,y,z]for x,y in pts],[list(range(len(pts)))])
def lane(name,r):
 pts=r['points'];w=r['width']/2+.25
 for i,(a,b)in enumerate(zip(pts,pts[1:])):
  dx=b[0]-a[0];dy=b[1]-a[1];ln=math.hypot(dx,dy)
  nx=-dy/ln*w;ny=dx/ln*w
  poly=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
  flatpoly('road_limestone',name+'_seg'+str(i),poly,z=14.19)
for r in newRoads:lane(r['id'],r)
# Place purpose-built around a central OPEN workshop court. Three taller wings
# leave readable gap entrances on the road-facing south or east side.
for i,site in enumerate(facilities):
 cx,cy=site['center'];W,H=site['size'];name=site['id']
 if name=='herbal_common':
  # Herb garden intentionally open, with two low walls and access via alley.
  flatpoly('garden_grass',name+'_lawn',[(cx-W/2,cy-H/2),(cx+W/2,cy-H/2),(cx+W/2,cy+H/2),(cx-W/2,cy+H/2)],14.21)
  for n,(ox,oy)in enumerate([(-W*.30,0),(0,0),(W*.30,0)]):
   cuboid('planter_stone',name+'_herbbed'+str(n),cx+ox,cy+oy,14.21,4,3,.45)
   for j in range(5):
    ax=cx+ox+(j-2)*.7
    cuboid('herbs_green',name+'_herbplant'+str(n)+'_'+str(j),ax,cy+oy,14.7,.42,.42,.9)
  cuboid('wood',name+'_community_herbal_bench',cx+W*.23,cy-H*.29,14.3,9,1.1,.8)
  continue
 # Existing workshops are composite with a perceivable central work yard.
 flatpoly('courtyard_stone',name+'_central_court',
 [(cx-W/2,cy-H/2),(cx+W/2,cy-H/2),(cx+W/2,cy+H/2),(cx-W/2,cy+H/2)],14.22)
 # North wing dominates, shorter open arcade wings to left/right, south
 # access remains open for traffic, no exterior perimeter block.
 nw=W-2.5;nh=6.2;h=11+((i*3)%6)
 gateNorth=(site.get('access')=='north')
 rearY=cy-H/2+nh/2 if gateNorth else cy+H/2-nh/2
 gateY=cy+H/2 if gateNorth else cy-H/2
 cuboid('ashlar',name+'_nave',cx,rearY,14.35,nw,nh,h)
 roof(name+'_gabled_high',cx,rearY,14.35+h,nw+1.2,nh+2,5.5 if i%2 else 7,'slate_roof'if i%2==0 else 'terracotta_roof')
 for side,ox in [('left',-W/2+3.15),('right',W/2-3.15)]:
  cuboid('ashlar',name+'_flanking_workshop_'+side,cx+ox,cy,14.3,5.3,H-9,7.5)
  roof(name+'_side_roof_'+side,cx+ox,cy,21.8,6.2,H-7,3.0,'terracotta_roof'if i%2==0 else 'slate_roof')
  for dy in [-H*.16,H*.16]:
   cuboid('dark_window',name+'_lancet_'+side+'_'+str(dy),cx+ox,cy+dy,17.4,1,.12,2.1)
 # open southern courtyard entry + floor from outer roadway
 cuboid('limestone_trim',name+'_gatepost_west',cx-W*.17,gateY,14.21,1.2,1.3,3.2)
 cuboid('limestone_trim',name+'_gatepost_east',cx+W*.17,gateY,14.21,1.2,1.3,3.2)
 # work features adapted by material / function
 if name in ('caravan_wheelwright','stonecutters_yard'):
  for j in range(3):
   cuboid('wood',name+'_timber_or_stone_bales_'+str(j),cx+(j-1)*4,cy,14.3,3.1,2.0,1.1)
  cuboid('industrial_iron',name+'_workbench',cx,cy-3,14.3,8,1.1,1.8)
 elif name=='forgehall':
  cuboid('industrial_iron',name+'_anvil',cx,cy,14.25,3,2,1.45)
  cuboid('limestone_trim',name+'_forge_oven',cx+W*.22,cy+H*.22,14.25,4,3,3.1)
  cuboid('industrial_iron',name+'_smokestack',cx+W*.22,cy+H*.22,17.35,1.1,1.1,7.0)
 elif name=='dyeing_drying_yard':
  for j in range(4):
   cuboid('dye_basin',name+'_dye_vat_'+str(j),cx+(j-1.5)*4,cy,14.26,2.3,2.3,1.2)
  cuboid('wood',name+'_drying_rack',cx,cy-3,14.2,10,1.1,3.1)
 elif name=='craft_guild_hall':
  cuboid('limestone_trim',name+'_charter_dais',cx,cy+1,14.25,6,3,1.5)
  cuboid('gold',name+'_guild_seal',cx,cy+H*.45,17.7,3,.18,3)
# Street-frontage production houses and traders: connected addresses, not
# stochastic infill. A shop is eligible only if a small frontage lane connects
# it directly to an existing new craft street; the shop retains a public door.
from shapely.ops import nearest_points
obstacles=obstacles.union(unary_union([
 LineString([v[:2]for v in r['points']]).buffer(r['width']/2+2.2)
 for r in facilityLinks]))
network=unary_union([
 LineString([v[:2]for v in r['points']])for r in newRoads[:5]])
shopCandidates=[]
for x in range(-622,-208,13):
 for y in range(99,195,11):
  w=9.0+((x+y)%3)*1.3
  dep=7.0+((x//13+y//11)%3)*.8
  plot=box(x-w/2,y-dep/2,x+w/2,y+dep/2)
  if not patch.buffer(-2.8).covers(plot):continue
  if obstacles.buffer(1.5).intersects(plot):continue
  pt=Point(x,y)
  d=network.distance(pt)
  if not(7.5<d<19.5):continue
  _,nearest=nearest_points(pt,network)
  dx=nearest.x-x;dy=nearest.y-y
  if abs(dx)>abs(dy):
   side='east'if dx>0 else 'west'
   gap=(x+(w/2+1.2)*(1 if dx>0 else -1),y)
  else:
   side='north'if dy>0 else 'south'
   gap=(x,y+(dep/2+1.2)*(1 if dy>0 else -1))
  link=LineString([nearest.coords[0],gap])
  if not patch.buffer(3.5).covers(link):continue
  if any(link.buffer(.8).intersects(f)for f in used):continue
  score=abs(d-12)+((abs(x*7+y*13)%17)*.09)
  shopCandidates.append((score,x,y,w,dep,plot,link,side))
# Allocate max 18 small plots, preserving alleys/negative space, and prefer
# diverse x locations rather than one homogeneous housing strip.
shops=[];chosen=[];quota={}
for _,x,y,w,dep,plot,link,side in sorted(shopCandidates,key=lambda a:a[0]):
 zone=math.floor((x+650)/67)
 if quota.get(zone,0)>=4:continue
 if obstacles.buffer(2.5).intersects(plot):continue
 if any(link.buffer(.8).intersects(f)for f in used):continue
 if any(link.buffer(1.5).intersects(f)for f in used):continue
 shopname='current_craft_streetfront_'+str(len(shops)+1).zfill(2)
 r=dict(id=shopname+'_shop_path',points=[[float(xx),float(yy),14.]for xx,yy in link.coords],
        width=2.4,kind='alley',z0=14,z1=14,lengthM=round(link.length,3),grade=0)
 p['routes'].append(r);newRoads.append(r)
 lane(shopname+'_shop_path',r)
 obstacles=obstacles.union(plot.buffer(1.5)).union(link.buffer(1.5))
 used.append(plot);quota[zone]=quota.get(zone,0)+1
 z=14.25;h=8.5+((int(abs(x+y))%4)*1.6)
 cuboid('ashlar',shopname+'_workshop',x,y,z,w,dep,h)
 roof(shopname+'_roof',x,y,z+h,w+.6,dep+1.2,3.1+(len(shops)%3),
      'terracotta_roof'if len(shops)%2==0 else 'slate_roof')
 # Low gabled storehouses feature recessed-looking doors, awnings and signs
 # facing the route, without obstructing the main passage.
 dx0=0;dy0=0
 if side=='south':dy0=-dep/2-.09
 if side=='north':dy0=dep/2+.09
 if side=='east':dx0=w/2+.09
 if side=='west':dx0=-w/2-.09
 cuboid('wood',shopname+'_working_door',x+dx0,y+dy0,z,1.8 if side in ('north','south')else .14,
        1.8 if side in ('east','west')else .14,3.6)
 for j,offset in enumerate((-w*.28,w*.28)):
  ax=x+offset if side in ('north','south') else x+dx0
  ay=y+dy0 if side in ('north','south') else y+offset
  cuboid('dark_window',shopname+'_upper_window'+str(j),ax,ay,z+5.2,
         1.1 if side in ('north','south') else .22,
         1.1 if side in ('east','west')else .22,1.8)
 shops.append(dict(name=shopname,center=[x,y],width=w,depth=dep,
                   frontage=side,distanceRoadM=round(network.distance(Point(x,y)),2)))
 if len(shops)>=18:break
# An articulated civic fountain + regional cart-yard, NOT arbitrary leftovers.
# Both are connected to the new two arterial spines.
for feature,(x,y),radius in [
 ('wheelwright_well',(-598,153),3.2),('east_terminal_stone_marker',(-224,161),2)]:
 ring=[]
 for j in range(18):
  th=2*math.pi*j/18;ring.append((x+radius*math.cos(th),y+radius*math.sin(th)))
 flatpoly('courtyard_stone',feature+'_terrace',ring,14.25)
 cuboid('limestone_trim',feature+'_central_plinth',x,y,14.25,1.3,1.3,2.1)
# New road centerline sample continuity and no overlap with official parcels.
newFootprints=unary_union(used)
if any(shape['officialCanonical']for shape in facilities):raise RuntimeError('Cannot canonize proposals')
from shapely.geometry import shape
parcelIntersections=[]
for parcel in q['parcels']:
 g=shape(parcel['geometry'])
 if g.intersects(newFootprints):
  parcelIntersections.append(parcel['id'])
if parcelIntersections:raise RuntimeError('Craft footprint intersects canonical parcels: '+str(parcelIntersections[:5]))
# Aggregate each logical material into one mesh object: avoids hundreds of
# Blender objects while retaining meaningful levels for semantic discovery.
added=[]
for kind,group in geo.items():
 name='current_craft_'+kind
 p['meshes'].append(dict(name=name,vertices=group['vertices'],
   faces=group['faces'],material='craft_'+kind))
 added.append(name)
audit=dict(status='PENDING_3D_QA',site='western_ascent_market_ascent_restored_ground',
 oldPatchAreaM2=round(patch.area,2),newRoadIds=[r['id']for r in newRoads],
 newRoadLengthM=round(sum(r['lengthM']for r in newRoads),2),
 newFacilityNames=[v['id'] for v in facilities],facilitySites=facilities,shopfronts=shops,
 newMeshNames=added,meshBatches=len(added),createdGeometryElements=sum(len(v['records'])for v in geo.values()),
 oldRoutesPreserved=True,parcelOverlapCount=0,
 unfinished=['Architectural interiors require actual access and furnishing',
             'Caravan cargo path game simulation not available',
             'No canonical sheet facility or NPC count modified',
             'Connection to nearby external eastern street remains to be designed',
             'Current roof and yard footprint vs all 3D legacy collision must pass'])
p['marketRestoredExplorationCurrent']=audit
p['audit']['routeCount']=len(p['routes'])
(root/'staged-craft-plan.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'staged-craft-QA.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False),encoding='utf8')
print('STAGED_CRAFT',json.dumps({k:v for k,v in audit.items()if k not in ('facilitySites','unfinished')}))
