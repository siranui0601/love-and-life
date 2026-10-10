"""B97: Programmed discovery districts, based on surveyed B96 unassigned lots.
Make true street-connected public commons and market arrival court, upgrade the
existing non-canonical burial study, and add craft-lane discovery cues.
Existing saves and all canonical facility IDs stay untouched.
"""
import sys,json,pathlib,math,random
from shapely.geometry import shape,Point,LineString,Polygon,box,mapping
from shapely.ops import unary_union,nearest_points,polylabel
from shapely import constrained_delaunay_triangles

src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError("Version exists: "+str(out))
p=json.loads((src/'plan.json').read_text(encoding='utf-8'))
d=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
oldmeshes={m['name']for m in p['meshes']}
oldroutes={r['id']for r in p['routes']}
newroutes=[];spaces=[];removed=set();gate_reports=[]
def mesh(name,verts,faces,mat='stone'):
    if not verts or not faces:return
    name='discover_b99_'+name
    if name in oldmeshes:raise RuntimeError('Duplicate mesh '+name)
    p['meshes'].append(dict(name=name,vertices=verts,faces=faces,material=mat))
def slab(name,a,b,width,lo=-.2,hi=.12,mat='lane'):
    dx=b[0]-a[0];dy=b[1]-a[1];l=math.hypot(dx,dy)
    if l<1e-6:return
    nx=-dy/l;ny=dx/l
    corners=[(a,-width/2),(b,-width/2),(b,width/2),(a,width/2)]
    vs=[[q[0]+nx*t,q[1]+ny*t,q[2]+offset]for offset in (lo,hi)for q,t in corners]
    fs=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
    mesh(name,vs,fs,mat)
def rect(name,cx,cy,w,d,z,mat='wood'):
    a=[cx-w/2,cy-d/2,z];b=[cx+w/2,cy-d/2,z]
    c=[cx+w/2,cy+d/2,z];e=[cx-w/2,cy+d/2,z]
    vs=[a,b,c,e];mesh(name,vs,[[0,1,2,3]],mat)
def wall(name,x0,y0,x1,y1,z,thick=0.6,height=2.5,mat='stone'):
    slab(name,[x0,y0,z],[x1,y1,z],thick,0,height,mat)
def path(name,xy,width=3.2,kind='life'):
    if name in oldroutes:raise RuntimeError('duplicate route '+name)
    pts=[[float(x),float(y),14.]for x,y in xy]
    length=sum(math.dist(a[:2],b[:2])for a,b in zip(pts,pts[1:]))
    r=dict(id=name,points=pts,width=width,kind=kind,z0=14,z1=14,lengthM=length,grade=0)
    newroutes.append(r)
    for i,(a,b)in enumerate(zip(pts,pts[1:])):slab(name+'_floor_'+str(i),a,b,width+.4,mat='lane')
    return r
def discs(name,cx,cy,r,z=14.14,mat='stone',segments=16):
    c=[cx,cy,z];rim=[[cx+r*math.cos(2*math.pi*i/segments),cy+r*math.sin(2*math.pi*i/segments),z]for i in range(segments)]
    vs=[c]+rim;faces=[[0,i+1,(i+1)%segments+1]for i in range(segments)]
    mesh(name,vs,faces,mat)
def tree(name,x,y,height=7):
    trunk_r=.36;nt=8
    v=[]
    for z,r in [(14.,trunk_r),(14.+height*.52,trunk_r)]:
        v.extend([[x+math.cos(2*math.pi*i/nt)*r,y+math.sin(2*math.pi*i/nt)*r,z]for i in range(nt)])
    mesh(name+'_trunk',v,[[i,(i+1)%nt,(i+1)%nt+nt,i+nt]for i in range(nt)],'wood')
    base=14.+height*.42;rad=height*.35
    v=[[x+math.cos(2*math.pi*i/nt)*rad,y+math.sin(2*math.pi*i/nt)*rad,base]for i in range(nt)]
    v.append([x,y,14.+height])
    mesh(name+'_canopy',v,[[i,(i+1)%nt,nt]for i in range(nt)],'foliage')
def post(name,x,y,base=14.,h=3):
    slab(name,[x,y,base],[x+.16,y,base],.16,0,h,'wood')
def building(name,cx,cy,w,d,z=14,h=5,mat='stone'):
    a=[cx-w/2,cy-d/2,z];b=[cx+w/2,cy-d/2,z]
    slab(name+'_a',a,b,.5,0,h,mat)
    slab(name+'_b',[cx+w/2,cy-d/2,z],[cx+w/2,cy+d/2,z],.5,0,h,mat)
    slab(name+'_c',[cx+w/2,cy+d/2,z],[cx-w/2,cy+d/2,z],.5,0,h,mat)
    slab(name+'_d',[cx-w/2,cy+d/2,z],a,.5,0,h,mat)
    rect(name+'_roof',cx,cy,w+1.5,d+1.5,z+h,'wood')
def free_plot(blockid):
    block=next(b for b in d['blocks']if b['id']==blockid)
    g=shape(block['geometry'])
    lots=[q for q in d['parcels'] if q['blockId']==blockid]
    nearby=[(r,LineString([t[:2]for t in r['points']]))for r in p['routes']
            if abs(r['z0']-14)<.01 and abs(r['z1']-14)<.01 and
            LineString([t[:2]for t in r['points']]).distance(g)<35]
    neg=[shape(q)for q in p['negativeSpaces'] if shape(q).intersects(g)]
    available=g.difference(unary_union([shape(q['geometry'])for q in lots]+neg+
        [l.buffer(r['width']/2+2)for r,l in nearby])).buffer(0)
    polys=([available] if available.geom_type=='Polygon' else
           [part for part in getattr(available,'geoms',[]) if part.geom_type=='Polygon'])
    return max(polys,key=lambda g:g.area),lots,nearby
def gate(blockid,lotlist,plot,roads,rid):
    r,line=next((r,l)for r,l in roads if r['id']==rid)
    a,b=nearest_points(plot.boundary,line)
    seg=LineString([a,b]);buf=seg.buffer(2.6)
    impacted=[q for q in lotlist if buf.intersects(shape(q['geometry']))]
    if any(q.get('canonicalFacilityId')for q in impacted):raise RuntimeError('Canonical gate conflict')
    removed.update(q['id']for q in impacted)
    start=tuple(b.coords[0]);finish=tuple(a.coords[0])
    gate_reports.append(dict(site=blockid,road=rid,roadPoint=start,plotPoint=finish,
        lengthM=seg.length,removedParcels=[q['id']for q in impacted]))
    return start,finish
def pave_polygon(name,poly,z,mat):
    v=[];f=[]
    if poly.is_empty:return
    pieces=[poly]if poly.geom_type=='Polygon'else [g for g in poly.geoms if g.geom_type=='Polygon']
    for piece in pieces:
        triangles=constrained_delaunay_triangles(piece)
        for tri in triangles.geoms:
            i=len(v)
            v.extend([[x,y,z]for x,y in list(tri.exterior.coords)[:3]])
            f.append([i,i+1,i+2])
    mesh(name,v,f,mat)
# 1. A true 7,206 m2 neighbourhood park: the blank is surrounded by frontage
# houses; sacrifice three ordinary parcels to produce two discoverable gates.
park,lots,roads=free_plot('low_city_792')
ga=gate('low_city_792',lots,park,roads,'low_city_lane_161')
gb=gate('low_city_792',lots,park,roads,'interior_life_design-b52_low_city_480')
if not 6500<park.area<8000:raise RuntimeError('Park area changed unexpectedly')
center=polylabel(park,tolerance=.4);px,py=center.coords[0]
# Green field is an intentional park, not an empty parcel with a new label.
pave_polygon('residential_park_lawn',park.buffer(-1.4),14.09,'grass')
path('park_west_gate',[ga[0],ga[1],(1021,-11),(px,py)],3.4)
path('park_east_gate',[gb[0],gb[1],(1081,-27),(1070,5),(px,py)],3.4)
ring=[(px+17*math.cos(2*math.pi*i/10),py+17*math.sin(2*math.pi*i/10))
      for i in range(10)]
if any(not park.buffer(-1).contains(Point(x,y).buffer(1.8))for x,y in ring):
    raise RuntimeError('Park loop leaves free interior')
path('park_grove_circuit',ring+[ring[0]],2.7)
path('park_grove_spur',[(px,py),ring[0]],2.7)
discs('park_well_basin',px,py,4.7,14.21,'water')
discs('park_well_coping',px,py,5.4,14.12,'stone')
discs('park_well_surface',px,py,4.4,14.25,'water')
rng=random.Random(9702);trees=[]
for i in range(125):
    x=px+rng.uniform(-53,53);y=py+rng.uniform(-58,58);pt=Point(x,y)
    if not park.buffer(-3.5).contains(pt.buffer(3.2)):continue
    if pt.distance(Point(px,py))<24:continue
    if any(pt.distance(Point(a,b))<6 for a,b in trees):continue
    if any(pt.distance(LineString([q[:2]for q in r['points']]))<3.8 for r in newroutes if r['id'].startswith('park_')):continue
    trees.append((x,y))
    tree('park_linden_%02d'%len(trees),x,y,8+rng.random()*3)
    if len(trees)>=24:break
# Low planted beds make the park recognisably green even from above.
beds=[]
for ox,oy in [(-22,12),(-25,-8),(22,15),(23,-15),(-18,33),(17,-34)]:
    x=px+ox;y=py+oy
    if park.buffer(-1).contains(box(x-3,y-1.5,x+3,y+1.5)):
        rect('park_flowerbed_%d'%len(beds),x,y,6,3,14.2,'foliage')
        beds.append((x,y))
for j,theta in enumerate([.2,2.1,4.3]):
    x=px+22*math.cos(theta);y=py+22*math.sin(theta)
    if park.buffer(-1.5).contains(Point(x,y).buffer(2.)):
        slab('park_seat_'+str(j),[x-1.5,y,14],[x+1.5,y,14],.7,0,.55,'wood')
# Pavilion at the far, partially concealed end; alternating blocked and open
# sightlines create an actual discovery rather than a hollow field.
pavilion=(px+7,py+35)
if not park.buffer(-7).contains(Point(pavilion).buffer(6)):pavilion=(px,py-30)
discs('park_pavilion_floor',*pavilion,5.2,14.2,'stone')
for i in range(8):
    ang=i*math.pi/4;post('park_pavilion_post_'+str(i),pavilion[0]+4.5*math.cos(ang),pavilion[1]+4.5*math.sin(ang),14.2,4.2)
discs('park_pavilion_roof',*pavilion,5.5,18.5,'wood')
path('park_pavilion_branch',[ring[2],pavilion],2.4)
# Two visible route-entry thresholds read as actual invitations.
for i,gatepair in enumerate([ga,gb]):
    x,y=gatepair[1]
    post('park_gate_post_%s_L'%i,x-2.1,y)
    post('park_gate_post_%s_R'%i,x+2.1,y)
spaces.append(dict(id='neighbourhood_discovery_park',kind='public_park',
   status='PROPOSAL_NOT_CANON',footprint=mapping(park),
   sizeM2=round(park.area),center=[px,py],entryRoutes=['park_west_gate','park_east_gate'],
   program=['tree grove','covered rest pavilion','shallow water basin','two neighbourhood entries'],
   intendedDiscovery='Closed residential frontage opens to an unexpected green interior, then a concealed pavilion'))
p['negativeSpaces'].append(mapping(park.buffer(-.5)))

# 2. Smaller market approach square is NOT a second official central market.
court,lots,roads=free_plot('low_city_441')
ca=gate('low_city_441',lots,court,roads,'low_city_contour_1_retained_0')
cb=gate('low_city_441',lots,court,roads,'low_city_lane_2')
if not 2800<court.area<3800:raise RuntimeError('Market court area changed')
mc=polylabel(court,tolerance=.4);mx,my=mc.coords[0]
pave_polygon('approach_market_stone',court.buffer(-.9),14.11,'stone')
path('market_court_west',[ca[0],ca[1],(87,139),(mx,my)],4.2)
path('market_court_east',[cb[0],cb[1],(146,156),(mx,my)],4.2)
# Modest produce and repairs displays face a traversable inner open space.
stalls=[]
all_market_paths=[LineString([q[:2]for q in r['points']])
                  for r in newroutes if r['id'].startswith('market_court_')]
candidates=[]
minx,miny,maxx,maxy=court.bounds
for ix in range(int(minx)+6,int(maxx)-5,8):
    for iy in range(int(miny)+6,int(maxy)-5,8):
        pt=Point(ix,iy)
        outline=box(ix-3.1,iy-2.4,ix+3.1,iy+2.4)
        if not court.buffer(-.65).contains(outline):continue
        if pt.distance(mc)<8:continue
        if min(pt.distance(q)for q in all_market_paths)<5.4:continue
        candidates.append((min(pt.distance(court.boundary),15)+.05*pt.distance(mc),ix,iy))
for score,x,y in sorted(candidates,reverse=True):
    if any(math.hypot(x-u,y-v)<12 for u,v in stalls):continue
    stalls.append((x,y))
    rect('market_food_stall_%d_base'%len(stalls),x,y,6.2,4.8,14.17,'wood')
    for sx in [-2.6,2.6]:
        for sy in [-2.0,2.0]:
            post('market_stall_%d_%d_%d'%(len(stalls),sx,sy),x+sx,y+sy,14.17,2.8)
    rect('market_stall_%d_awning'%len(stalls),x,y,7,5.6,17.05,'cloth')
    if len(stalls)>=7:break
if len(stalls)<3:raise RuntimeError('Market square insufficient stalls: '+str(len(stalls)))
# Clear the public walking spine of bench furniture; seats stay in the green park.
# A small performance notice platform supports non-scripted city happenings.
discs('market_small_notice_dais',mx,my,4,14.19,'stone')
spaces.append(dict(id='market_arrival_micro_square',kind='public_market_forecourt',
  status='PROPOSAL_NOT_CANON',footprint=mapping(court),sizeM2=round(court.area),
  center=[mx,my],entryRoutes=['market_court_west','market_court_east'],
  program=['seasonal produce stalls','sitting area','small announcement circle'],
  intendedDiscovery='A narrow approach widens into a market annex; the central canonical market remains distinct'))
p['negativeSpaces'].append(mapping(court.buffer(-.4)))

# 3. Upgrade pre-existing burial proposal without inventing deity or named dead.
burial=p['burialCourtStudy']
if burial['gate'] != [690,1190,14]:raise RuntimeError('Burial gate moved; resurvey')
for x,y in [(689,1190),(684,1185),(684,1195)]:
    discs('burial_threshold_paving_%s_%s'%(x,y),x,y,3.1,14.12,'stone')
wall('burial_entry_marker_north',690,1193.3,690,1198.3,14,.9,4.2)
wall('burial_entry_marker_south',690,1181.7,690,1186.7,14,.9,4.2)
slab('burial_entry_lintel',[690,1186.3,18.1],[690,1193.7,18.1],1.0,0,1.1,'stone')
for j,(x,y) in enumerate([(624,1208),(628,1207),(633,1208),(637,1208),(650,1211),(660,1211)]):
    rect('burial_quiet_flowerbed_%s'%j,x,y,3.6,1.5,14.17,'foliage')
# A secluded sitting space accessible via the existing burial loop.
loop=next(r for r in p['routes'] if r['id']=='burial_study_loop')
line=LineString([q[:2] for q in loop['points']])
start=nearest_points(Point(627,1203),line)[1]
path('burial_memorial_alcove',[start.coords[0],(627,1203),(624,1208)],2.3)
discs('burial_meditation_pad',622,1208,3.5,14.2,'stone')
tree('burial_cypress_1',620,1214,9);tree('burial_cypress_2',639,1215,8.5)
spaces.append(dict(id='burial_quiet_remembrance_upgrade',kind='memorial_detail',
    status='PROPOSAL_NOT_CANON',center=[650,1190],entryRoutes=['burial_study_entry'],
    program=['legible stone gateway','quiet alcove','flowers','grave markers from existing B96'],
    intendedDiscovery='A planted threshold leads past ordinary graves to a hidden quiet resting place',
    lore='No named deceased, religion or burial rite assigned'))
# 4. The established large forge/repair compound receives a craft trail cue.
# This is an interpretive viewpoint, not yet a simulated commercial service.
craft=p['craftBlockStudy']
for i,(x,y) in enumerate([(1219.5,26.0),(1228.0,20.0)]):
    slab('craft_work_notice_'+str(i),[x,y,14],[x+2,y+.3,14],.5,0,2.3,'wood')
spaces.append(dict(id='forge_discovery_cue',kind='existing_craft_compound_support',
    status='PROPOSAL_NOT_CANON',center=craft['position'][:2],
    relatedExistingRoutes=[craft['entryFrom'],craft['rearEntryFrom']],
    program=['workshop wayfinding boards','existing forge/repair/loading blocks retained'],
    intendedDiscovery='Street frontage exposes real work behind it; rear cargo access is an alternate viewpoint'))

# Ground-level circulation is a *volume*, not a drawn centreline.
# Remove ordinary lots hit by the entire 4-5m public path envelope, including
# bends between the public street gates and the interior court.
clearance_report=[]
for route in newroutes:
    if not route['id'].startswith(('park_','market_court_')):
        continue
    clearance=LineString([q[:2] for q in route['points']]).buffer(route['width']/2+.85,
                                                                  cap_style=2,join_style=2)
    affected=[lot for lot in d['parcels']
              if lot['id'] not in removed and
              shape(lot['geometry']).intersects(clearance)]
    if any(lot.get('canonicalFacilityId') for lot in affected):
        raise RuntimeError('Cannot demolish canonical property for '+route['id'])
    removed.update(lot['id'] for lot in affected)
    if affected:
        clearance_report.append(dict(route=route['id'],lots=[lot['id']for lot in affected]))
if len(removed)>35:
    raise RuntimeError('Excessive demolition; revisit path alignment: '+str(len(removed)))
# Never delete a canonical facility; do not resurrect removed parcel buildings.
for q in d['parcels']:
    if q['id'] in removed and q.get('canonicalFacilityId'):
        raise RuntimeError('Attempted canonical parcel removal: '+q['id'])
d['parcels']=[q for q in d['parcels'] if q['id'] not in removed]
for b in d['blocks']:
    b['parcelIds']=[i for i in b['parcelIds'] if i not in removed]
d['audit']['parcelCount']=len(d['parcels'])
p['routes'].extend(newroutes)
p['audit']['routeCount']=len(p['routes'])
report=dict(status='REQUIRES_BLENDER_RENDER_AND_TRAVERSAL',base=src.name,
    sites=spaces,entryGates=gate_reports,removedOrdinaryParcels=sorted(removed),
    newRoutes=newroutes,addedMeshes=[m['name']for m in p['meshes']if m['name']not in oldmeshes],
    changedMeshes=[],canonicalFacilitiesUnmodified=True,clearanceDemolition=clearance_report,
    limitations=['B96 noble east staircase and cargo route have existing floor failures',
     'No schedules, quests, goods, religious canon, social gate implementation',
     'Visual and actual floor/collision/manual walk QA still required'])
p['discoveryDistrictsB99']=report
out.mkdir()
for name,val in [('plan.json',p),('parcels.json',d),('discovery-districts.json',report)]:
    (out/name).write_text(json.dumps(val,separators=(',',':')),encoding='utf-8')
print(json.dumps(dict(output=str(out),sites=[(s['id'],s.get('sizeM2'))for s in spaces],
                          removedParcels=len(removed),newRoutes=len(newroutes),
                          addedMeshes=len(report['addedMeshes']),parkTrees=len(trees),
                          marketStalls=len(stalls)),ensure_ascii=False))
