"""B75 -> a separate east service-block proposal. Metres; no canon changes.

Run with bundled Python + Shapely: script SOURCE_DIRECTORY NEW_DIRECTORY.
Never replaces an existing version. All writes happen after geometry validation.
"""
import json, math, pathlib, sys, hashlib
from shapely.geometry import shape, box as rectangle, Polygon, Point, LineString, mapping
from shapely.affinity import rotate, translate
from shapely.ops import unary_union, nearest_points
from shapely import constrained_delaunay_triangles

src, out = map(pathlib.Path, sys.argv[1:3])
if out.exists():
    raise RuntimeError('Existing version protected: choose another empty version')
p = json.loads((src/'plan.json').read_text())
data = json.loads((src/'parcels.json').read_text())
block = next(b for b in data['blocks'] if b['id'] == 'low_city_852')
land = shape(block['geometry'])
old_routes = list(p['routes'])
old_mesh_count = len(p['meshes'])
road = {r['id']: LineString([v[:2] for v in r['points']]) for r in p['routes']}
south = road['low_city_contour_1'].intersection(rectangle(1240,-100,1500,20))
north = road['low_city_contour_1'].intersection(rectangle(1250,25,1370,90))
def nearest(pt, line):
    return list(nearest_points(Point(pt), line)[1].coords)[0]
routes = [
    ('east_work_cargo', [nearest((1300,-36),south),(1300,-36),(1312,-20),(1340,-6),(1390,24),(1436,44),nearest((1436,44),road['low_city_lane_5'])], 6, 'service-logistics'),
    ('east_work_life', [nearest((1286,28),north),(1286,28),(1295,17),(1320,20),(1368,45),(1400,40),(1436,44)], 3.2, 'optional-life'),
    ('east_work_court_link', [(1320,20),(1325,7),(1340,-6)], 3.5, 'optional-life'),
]
# Separate shopfront, long repair shed, stock house and open-sided material hall.
buildings = [
    dict(id='repair_hall',x=1286,y=-10,w=15,d=35,a=20,h=7,face='east',door=8,role='cart and timber repair'),
    dict(id='stock_house',x=1335,y=-23,w=31,d=13,a=29,h=9,face='north',door=6,role='dry materials and returned goods'),
    dict(id='commission_rooms',x=1318,y=37,w=29,d=12,a=20,h=10,face='south',door=5,role='orders and household repairs'),
    dict(id='material_hall',x=1362,y=25,w=28,d=12,a=27,h=5,face='south',door=22,role='covered sorting and assembly'),
    dict(id='workers_frontage',x=1393,y=55,w=30,d=10,a=-12,h=9,face='south',door=5,role='small trade and rest frontage'),
    dict(id='east_store',x=1440,y=34,w=28,d=12,a=28,h=8,face='north',door=7,role='gate-side unloading store'),
]
def local(b,x,y,z=14.2):
    a=math.radians(b['a']);c,s=math.cos(a),math.sin(a)
    return [b['x']+x*c-y*s,b['y']+x*s+y*c,z]
for b in buildings:
    b['geometry']=mapping(Polygon([local(b,x,y)[:2] for x,y in [(-b['w']/2,-b['d']/2),(b['w']/2,-b['d']/2),(b['w']/2,b['d']/2),(-b['w']/2,b['d']/2)]]))
    x,y={'north':(0,b['d']/2),'south':(0,-b['d']/2),'east':(b['w']/2,0)}[b['face']]
    door=local(b,x,y)[:2]
    outside=local(b,x+(3 if b['face']=='east' else 0),y+(3 if b['face']=='north' else -3 if b['face']=='south' else 0))[:2]
    inside=local(b,x-(2 if b['face']=='east' else 0),y-(2 if b['face']=='north' else -2 if b['face']=='south' else 0))[:2]
    target_line=min([LineString(v[1]) for v in routes[:3]],key=lambda line:line.distance(Point(outside)))
    routes.append(('east_work_entry_'+b['id'], [nearest(outside,target_line),outside,door,inside], min(4,b['door']-1), 'optional-life'))
    b['entry']=dict(outside=outside,door=door,inside=inside)
yards=[
    dict(id='repair_court',purpose='cart waiting and open-air repair',geometry=mapping(Polygon([(1295,-14),(1320,-10),(1320,12),(1295,12)]))),
    dict(id='unloading_court',purpose='unloading and inspection, no permanent crowd props',geometry=mapping(Polygon([(1380,8),(1396,2),(1414,20),(1398,29)]))),
    dict(id='rest_pocket',purpose='small sheltered resting pocket off the working road',geometry=mapping(Polygon([(1408,48),(1422,48),(1422,58),(1408,58)]))),
]
building_geoms=[shape(b['geometry']) for b in buildings]
route_geoms=[LineString(v).buffer(w/2) for _,v,w,_ in routes]
reserved=unary_union(building_geoms+route_geoms+[shape(y['geometry']) for y in yards])
canon=[q for q in data['parcels'] if q.get('canonicalFacilityId')]
protected=unary_union([shape(q['geometry']).buffer(3) for q in canon]+[shape(g) for g in p['negativeSpaces']])
if reserved.intersection(protected).area > .01:
    raise RuntimeError('Proposal intersects an existing reserved or canonical site')
domain=unary_union([shape(d['geometry']) for d in p['landDomains'] if d['heightM']==14])
if not domain.buffer(.1).covers(reserved):raise RuntimeError('Outside level-14 terrain')
for i,b in enumerate(buildings):
    g=building_geoms[i]
    if not land.covers(g.buffer(.4)):raise RuntimeError('Building outside block: '+b['id'])
    for j,h in enumerate(building_geoms):
        if i!=j and g.buffer(.5).intersects(h):raise RuntimeError('Building overlap')
    for name,points,w,role in routes[:3]:
        if g.intersects(LineString(points).buffer(w/2+.5)):raise RuntimeError('Building blocks route: '+b['id'])
    for r in old_routes:
        if g.intersects(road[r['id']].buffer(r['width']/2+.4)):raise RuntimeError('Building blocks original route')
removed=[q for q in data['parcels'] if shape(q['geometry']).intersects(reserved.buffer(.4))]
if any(q.get('canonicalFacilityId') for q in removed):raise RuntimeError('Canonical parcel removal')
ids={q['id'] for q in removed}
data['parcels']=[q for q in data['parcels'] if q['id'] not in ids]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds'] if i not in ids]
data['audit']['parcelCount']=len(data['parcels'])
def mesh(name,v,f,mat):p['meshes'].append(dict(name='east_work_'+name,vertices=v,faces=f,material=mat))
def pave(name,g,material='lane'):
    vv=[];ff=[]
    for tri in constrained_delaunay_triangles(g).geoms:
        k=len(vv);vv.extend([[x,y,14.2] for x,y in list(tri.exterior.coords)[:3]]);ff.append([k,k+1,k+2])
    mesh(name,vv,ff,material)
def cube(name,b,x,y,z,w,d,h,mat='stone'):
    vv=[local(b,x+dx*w/2,y+dy*d/2,z+dz*h) for dz in [0,1] for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    mesh(name,vv,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],mat)
for name,points,w,role in routes:
    line=LineString(points);samples=[]
    for a,b in zip(points,points[1:]):
        n=max(1,math.ceil(math.dist(a,b)/2))
        samples.extend([[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,14] for i in range(n)])
    samples.append([*points[-1],14])
    p['routes'].append(dict(id=name,points=samples,width=w,kind='service' if role=='service-logistics' else 'life',z0=14,z1=14,lengthM=line.length,grade=0,role=role))
# One continuous paving mesh avoids coincident overlapping route surfaces.
pave('circulation',unary_union(route_geoms+[shape(y['geometry']) for y in yards]))
for b in buildings:
    w,d,h=b['w'],b['d'],b['h'];name=b['id'];opening=b['door'];oh=4.2 if opening>=6 else 3.1
    for face,length,constant,horizontal in [('north',w,d/2,True),('south',w,-d/2,True),('east',d,w/2,False),('west',d,-w/2,False)]:
        ranges=[(-length/2,length/2)] if face!=b['face'] else [(-length/2,-opening/2),(opening/2,length/2)]
        for j,(lo,hi) in enumerate(ranges):
            cube(name+'_'+face+str(j),b,(lo+hi)/2 if horizontal else constant,constant if horizontal else (lo+hi)/2,14.2,hi-lo if horizontal else .5,.5 if horizontal else hi-lo,h)
        if face==b['face']:
            cube(name+'_lintel',b,0 if horizontal else constant,constant if horizontal else 0,14.2+oh,opening if horizontal else .5,.5 if horizontal else opening,h-oh)
    floor=shape(b['geometry']);pave(name+'_floor',floor)
    v=[local(b,x,y,14.2+h) for x,y in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]]+[local(b,-w/2,0,16.5+h),local(b,w/2,0,16.5+h)]
    mesh(name+'_roof',v,[[0,1,5,4],[4,5,2,3],[0,4,3],[1,2,5]],'wood')
    # Modest facade bands and windows; doors are actual gaps, not painted panels.
    if h>=9:
        for x in [-w*.32,0,w*.32]:cube(name+'_window_'+str(x),b,x,-d/2-.28,20,1.4,.05,1.6,'iron')
# Material stacks remain on the inside back edge of sheds, outside door approaches.
for b in [buildings[1],buildings[3],buildings[5]]:
    for i in [-1,1]:cube(b['id']+'_stock_'+str(i),b,i*b['w']*.32,0,14.2,3,2,1.5,'wood')
rest=dict(x=1415,y=55,a=0)
for i in [-1,1]:cube('rest_bench_'+str(i),rest,i*4,0,14.2,3,.8,.65,'wood')
p['negativeSpaces'].append(mapping(reserved.buffer(.4)))
p.setdefault('programmedSpacesStudy',[]).append(dict(id='east_service_block',heightM=14,geometry=mapping(reserved.buffer(.4)),status='PROPOSED_NOT_ACCEPTED',purpose='Three working/living courts and two distinct circulation choices; remaining open land still requires review'))
report=dict(status='MORPHOLOGY_PROPOSAL_NOT_ACCEPTED',source='B75',blockId=block['id'],sourcePlanSHA256=hashlib.sha256((src/'plan.json').read_bytes()).hexdigest(),sourceGitHEAD='398d991bbfa4f7447d4503faede4ff2e8ec5d0b8',buildings=buildings,yards=yards,replacedParcelIds=sorted(ids),formerParcelAreaM2=sum(shape(q['geometry']).area for q in removed),addedRoutes=[dict(id=n,points=v,width=w,role=r,lengthM=LineString(v).length) for n,v,w,r in routes],removedRoutes=[],canonicalFacilitiesPreserved=len(canon),reservedAreaM2=reserved.area,buildingFootprintM2=sum(g.area for g in building_geoms),oldMeshCount=old_mesh_count,newMeshCount=len(p['meshes']),sources=['TRPG 王都 A1:N35, read 2026-10-08','TRPG 総合設計書 A110:H120, read 2026-10-08','Deep Research supplied PDF, pp8/11-15/22','B75 east-survey.json'],eventIntent={'T06':'Delivery delays can change stored goods and work activity; design hook only','T09_T14':'Repairs and disputed stock can connect to existing weapon supply; no replacement weapon shop','T11_T16_T17':'Ordinary streets remain available when work premises close; runtime conditions not implemented'},pending=['Cart swept-volume and full manual walking validation','Roof egress, NPC schedules and incident runtime','Distant river/castle visibility not certified','Adjacent residual land and repetitive housing still need review'],cameras=[dict(name='East-work-context',position=[1390,-155,160],target=[1350,12,17],scale=330),dict(name='East-work-entry-eye',position=[1285,44,15.9],target=[1295,17,16.4]),dict(name='East-work-court-eye',position=[1320,17,15.9],target=[1362,25,17]),dict(name='East-work-cargo-eye',position=[1300,-36,15.9],target=[1340,-6,17])])
p['eastServiceBlockStudy']=report;p['audit']['routeCount']=len(p['routes'])
# Canonical geometry and every baseline route are preserved verbatim.
assert p['routes'][:len(old_routes)]==old_routes
out.mkdir(parents=True)
for name,value in [('plan.json',p),('parcels.json',data),('east-service-block-study.json',report)]:
    (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['status','replacedParcelIds','reservedAreaM2','buildingFootprintM2','oldMeshCount','newMeshCount']}))
