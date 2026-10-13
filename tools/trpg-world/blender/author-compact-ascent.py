"""Make a real stair gallery through the civic ascent earthwork, B76 -> new version.
Cut passage volumes from intersecting mesh faces rather than painting door markers.
The original freight route stays available; the gallery has three physical access points.
"""
import json,math,pathlib,sys,hashlib
from shapely.geometry import Point,LineString,Polygon,shape,mapping
from shapely.ops import nearest_points,unary_union
from shapely.strtree import STRtree
src,out=map(pathlib.Path,sys.argv[1:3])
if out.exists():raise RuntimeError('Existing version protected')
p=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text())
baseline={r['id']:r for r in p['routes']};old_names={m['name'] for m in p['meshes']}
def center(y,z):return [600+(y-620)/19+9,y,z]
points=[center(650,42),center(656,42)];y=656.;z=42.;rest=[]
run=(190-12-20*2-4*4)/25
for flight in range(25):
    for step in range(1,18):points.append(center(y+run*step/17,z+2.8*step/17))
    y+=run;z+=2.8
    if flight<24:
        length=4 if (flight+1)%5==0 else 2
        if length==4:rest.append(dict(position=center(y+2,z),heightM=z))
        y+=length;points.append(center(y,z))
points.append(center(840,112))
def make_route(name,ps,width,kind):
    length=sum(math.dist(a[:2],b[:2])for a,b in zip(ps,ps[1:]))
    return dict(id=name,points=ps,width=width,kind=kind,z0=ps[0][2],z1=ps[-1][2],lengthM=length,grade=(ps[-1][2]-ps[0][2])/length,role='sheltered-pedestrian',gateTag='G_SOCIAL_STATUS',gateStatus='runtime integration pending; upper district authorization still required')
stair=make_route('civic_wall_gallery_stairs',points,6,'stairs');stair.update(landingCount=26,landingLengthM=2)
def densify(ps):
    result=[]
    for a,b in zip(ps,ps[1:]):
        n=max(1,math.ceil(math.dist(a,b)/2))
        result.extend([[a[k]+(b[k]-a[k])*i/n for k in range(3)] for i in range(n)])
    return result+[ps[-1]]
def flat_link(name,pt,height,target):
    line=LineString([v[:2]for v in baseline[target]['points']]);q=nearest_points(Point(pt[:2]),line)[1]
    return make_route(name,densify([[q.x,q.y,height],pt]),6,'landing')
low=flat_link('civic_wall_gallery_lower',points[0],42,'civic_foot_contour_1')
upper=flat_link('civic_wall_gallery_upper',points[-1],112,'upper_city_contour_1')
ramp=baseline['civic_royal_ramp'];target_z=70
for a,b in zip(ramp['points'],ramp['points'][1:]):
    if a[2]<=target_z<=b[2]:
        t=(target_z-a[2])/(b[2]-a[2]);ramp_portal=[a[k]+(b[k]-a[k])*t for k in range(3)];break
node=min(rest,key=lambda r:abs(r['heightM']-70))['position']
approach=[ramp_portal[0]-15,ramp_portal[1]+1.2,70]
branch=make_route('civic_wall_gallery_mid_exit',densify([node,[node[0]+8,node[1]-.421,70],approach,ramp_portal]),3,'landing')
# Rebuild the northern 44m climb on a shorter wall-side alignment.
north_old=baseline['north_court_wall_stairs']
nline=LineString([(185,1276),(235,1247),(235,1239),(168,1235)])
ns=[]
def north_leg(a,b,z0,z1,start_flat,end_flat):
    line=LineString([a,b]);rise=(z1-z0)/7;run=(line.length-start_flat-end_flat-6*2)/7;dist=start_flat
    if not ns:ns.append([*a,z0])
    q=line.interpolate(dist);ns.append([q.x,q.y,z0])
    for f in range(7):
        for st in range(1,20):
            q=line.interpolate(dist+run*st/19);ns.append([q.x,q.y,z0+rise*(f+st/19)])
        dist+=run
        if f<6:
            dist+=2;q=line.interpolate(dist);ns.append([q.x,q.y,z0+rise*(f+1)])
    ns.append([*b,z1])
north_leg((185,1276),(235,1247),112,134,5,3)
ns.append([235,1239,134])
north_leg((235,1239),(168,1235),134,156,3,5)
north=make_route('north_court_wall_stairs',ns,4,'stairs');north.update(landingCount=17,landingLengthM=2)
new_routes=[stair,low,upper,branch,north]
for i,r in enumerate(rest):
    a=r['position'];new_routes.append(make_route('civic_wall_gallery_rest_'+str(i),densify([a,[a[0]+(36 if i==3 else 8),a[1],a[2]]]),3,'landing'))
def frame(a,b):
    d=math.dist(a[:2],b[:2]);u=[(b[0]-a[0])/d,(b[1]-a[1])/d];return u,[-u[1],u[0]],d
def offset(a,n,x,z=0):return [a[0]+n[0]*x,a[1]+n[1]*x,a[2]+z]
def mesh(name,v,f,mat='stone'):p['meshes'].append(dict(name='wall_gallery_'+name,vertices=v,faces=f,material=mat))
def strip(name,a,b,lo,hi,zlo,zhi,mat='stone'):
    u,n,d=frame(a,b)
    v=[offset(q,n,x,z)for z in [zlo,zhi]for q,x in [(a,lo),(b,lo),(b,hi),(a,hi)]]
    mesh(name,v,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],mat)
# Passage cutter is a convex sloping prism. Planes use n dot p <= c for inside.
cutters=[]
def cutter(a,b,width=7.2,below=.55,above=5.25):
    u,n,d=frame(a,b);slope=(b[2]-a[2])/d
    # 0.1m overlap removes microscopic seams without changing the stair treads.
    planes=[([-u[0],-u[1],0],-u[0]*a[0]-u[1]*a[1]+.1),([u[0],u[1],0],u[0]*b[0]+u[1]*b[1]+.1),([n[0],n[1],0],n[0]*a[0]+n[1]*a[1]+width/2),([-n[0],-n[1],0],-n[0]*a[0]-n[1]*a[1]+width/2),([-slope*u[0],-slope*u[1],1],a[2]-slope*(u[0]*a[0]+u[1]*a[1])+above),([slope*u[0],slope*u[1],-1],-a[2]+slope*(u[0]*a[0]+u[1]*a[1])+below)]
    footprint=LineString([a[:2],b[:2]]).buffer(width/2+.15,cap_style=3)
    cutters.append((planes,footprint,min(a[2],b[2])-below,max(a[2],b[2])+above))
for r in new_routes:
    for a,b in zip(r['points'],r['points'][1:]):cutter(a,b,5 if r is north else 3.4 if r['width']==3 else 7.2)
tree=STRtree([c[1]for c in cutters])
def split(poly,n,c):
    inside=[];outside=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=sum(n[k]*a[k]for k in range(3))-c;db=sum(n[k]*b[k]for k in range(3))-c
        (inside if da<=1e-8 else outside).append(a)
        if (da< -1e-8 and db>1e-8)or(da>1e-8 and db< -1e-8):
            t=da/(da-db);q=[a[k]+(b[k]-a[k])*t for k in range(3)];inside.append(q);outside.append(q)
    return inside,outside
def subtract(poly,planes):
    retained=[];inside=poly
    for n,c in planes:
        if len(inside)<3:break
        inside,outside=split(inside,n,c)
        if len(outside)>=3:retained.append(outside)
    return retained
changed=[];cut_faces=0
# Replace the old northern long ribbon and its tall separate support completely.
for m in p['meshes']:
    if m['name'] in ['north_court_wall_stairs','north_court_wall_stairs_support','north_court_wall_stairs_treads']:
        m['vertices']=[];m['faces']=[];changed.append(m['name'])
for m in p['meshes']:
    if m['material'] not in ['ground','stone','primary','lane','stairs']:continue
    coords=m['vertices']
    if not coords:continue
    x0=min(v[0]for v in coords);x1=max(v[0]for v in coords);y0=min(v[1]for v in coords);y1=max(v[1]for v in coords)
    if not ((x1>=530 and x0<=710 and y1>=580 and y0<=1010) or (x1>=140 and x0<=270 and y1>=1210 and y0<=1290)):continue
    vv=[];ff=[];modified=False
    for f in m['faces']:
        poly=[coords[i] for i in f];xy=Polygon([v[:2]for v in poly]).buffer(.001)
        # Vertical faces have zero-area projection: use their boundary envelope.
        if xy.is_empty:xy=LineString([v[:2]for v in poly]).buffer(.001)
        candidates=[int(i)for i in tree.query(xy) if max(v[2]for v in poly)>=cutters[int(i)][2] and min(v[2]for v in poly)<=cutters[int(i)][3]]
        pieces=[poly]
        for i in candidates:
            if m['material']in ['primary','lane','stairs']:
                n,c=cutters[i][0][-1]
                heights=[c-sum(n[k]*v[k]for k in range(3))-.55 for v in poly]
                if min(heights)>-.5 and max(heights)<.65:continue
            pieces=[part for q in pieces for part in subtract(q,cutters[i][0])]
        if pieces!=[poly]:modified=True;cut_faces+=1
        for q in pieces:
            k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
    if modified:m['vertices']=vv;m['faces']=ff;changed.append(m['name'])
# Repair short unintentional seams with masonry reaching the receiving wall.
# Large separations are reported for realignment, not filled with giant platforms.
targets={
'market_ascent':(42,[(-750,280),(-480,160),(0,200),(500,260),(780,600),(500,1150),(-400,1200),(-950,900)]),
'civic_royal_ramp':(112,[(-250,560),(200,420),(600,620),(620,1000),(200,1360),(-230,1100)]),
'noble_service':(78,[(-850,600),(-400,500),(-100,700),(-250,1200),(-700,1100)]),
'mage_civic_ramp':(70,[(800,400),(1180,350),(1350,720),(1000,980),(750,850)])}
seam_repairs=[]
for key,(top,ps) in targets.items():
    wall=Polygon(ps).boundary;m=next(m for m in p['meshes']if m['name']==key+'_terrace_support');count=0
    for j,f in enumerate(m['faces']):
        if len(f)!=4:continue
        a,b=m['vertices'][f[0]],m['vertices'][f[1]]
        qa=nearest_points(Point(a[:2]),wall)[1];qb=nearest_points(Point(b[:2]),wall)[1]
        da=qa.distance(Point(a[:2]));db=qb.distance(Point(b[:2]))
        if max(da,db)>20 or max(da,db)<.01:continue
        poly=Polygon([a[:2],b[:2],(qb.x,qb.y),(qa.x,qa.y)]).buffer(0)
        if poly.is_empty or poly.area<.01:continue
        # The tie meets the wall face, beneath the carriageway surface.
        v=[a,b,[qb.x,qb.y,b[2]],[qa.x,qa.y,a[2]]]
        bottom=min(baseline[key]['z0'],a[2]-.3,b[2]-.3)
        mesh('abutment_'+key+'_'+str(j),v+[[q[0],q[1],bottom]for q in v],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
        count+=1
    seam_repairs.append(dict(route=key,shortGapTieCount=count,maxTieM=20,maxCentrelineWallSeparationM=max(wall.distance(Point(q[:2]))for q in baseline[key]['points'])))
# Northern replacement has a solid masonry connection to the wall instead of
# an independent tall ribbon. Broad inside treads become small stopping shelves.
nwall=Polygon([(-120,830),(230,730),(480,840),(420,1150),(120,1280),(-100,1090)]).boundary
for j,(a,b) in enumerate(zip(ns,ns[1:])):
    qa=nearest_points(Point(a[:2]),nwall)[1];qb=nearest_points(Point(b[:2]),nwall)[1]
    v=[[a[0],a[1],b[2]-.2],[b[0],b[1],b[2]-.2],[qb.x,qb.y,b[2]-.2],[qa.x,qa.y,b[2]-.2]]
    mesh('north_wall_tie_'+str(j),v+[[q[0],q[1],112]for q in v],[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])
    # Solid outside parapet, correctly offset away from the nearest wall.
    u,n,d=frame(a,b);mid=[(a[k]+b[k])/2 for k in range(3)];q=nearest_points(Point(mid[:2]),nwall)[1]
    side=-1 if (q.x-mid[0])*n[0]+(q.y-mid[1])*n[1]>0 else 1
    strip('north_parapet_'+str(j),a,b,side*2.6-.2,side*2.6+.2,0,1.35)

# Route-aware openings in gallery side walls at the intermediate junction.
junction=Point(node[:2]);branch_line=LineString([q[:2]for q in branch['points']])
for r in new_routes:
    for i,(a,b)in enumerate(zip(r['points'],r['points'][1:])):
        base=r['id']+'_'+str(i);u,n,d=frame(a,b)
        # Real horizontal treads and risers; long landings retain their constant z.
        if r['kind']=='stairs':
            aa=[a[0],a[1],b[2]];bb=b
        else:aa=a;bb=b
        neck=r['width']==3 and ('_rest_' not in r['id'] or a[0]<r['points'][0][0]+4)
        half=2.3 if r is north else 1.8 if neck else 3.7
        strip(base+'_floor',aa,bb,-half,half,-.35,.20,'stairs'if r['kind']=='stairs'else'lane')
        open_loggia=r['id']=='civic_wall_gallery_rest_3' and a[0]>r['points'][0][0]+24
        if r is north:continue
        if not open_loggia:strip(base+'_roof',a,b,-4.3,4.3,4.8,5.35)
        for side in [-1,1]:
            wall_offset=2.1 if neck else 4
            wallline=LineString([offset(a,n,side*wall_offset)[:2],offset(b,n,side*wall_offset)[:2]])
            # Keep every physical route intersection open. The roof still bridges it.
            if any(wallline.distance(LineString([q[:2]for q in other['points']]))<3.8 and abs((a[2]+b[2])/2-other['z0'])<2 for other in new_routes if other is not r and other['kind']!='stairs'):continue
            if r is branch and wallline.distance(junction)<5:continue
            strip(base+'_wall_'+str(side),a,b,side*wall_offset-.3,side*wall_offset+.3,-.2,1.35 if open_loggia else 4.8)
# Heavy gate mouths with real apertures at the three routes meeting public streets.
for label,route in [('lower',low),('upper',upper),('middle',branch)]:
    at=route['points'][0] if route is not branch else route['points'][-1]
    near=route['points'][1] if route is not branch else route['points'][-2]
    u,n,d=frame(at,near);b=[at[k]+(near[k]-at[k])*5/d for k in range(3)]
    for side in [-1,1]:strip('portal_'+label+'_'+str(side),at,b,side*4.7-.8,side*4.7+.8,-.2,7)
    strip('portal_'+label+'_crown',at,b,-5.5,5.5,5.4,7)
# Rest rooms share the same cut-volume and circulation construction.
for i,r in enumerate(rest):
    a=r['position'];end=36 if i==3 else 8;u=[a[0]+end-4,a[1]+3.1,a[2]];v=[a[0]+end-1,a[1]+3.1,a[2]]
    strip('rest_'+str(i)+'_end',[a[0]+end+1,a[1]-4.3,a[2]],[a[0]+end+1,a[1]+4.3,a[2]],-.3,.3,-.2,1.35 if i==3 else 4.8)
    if i==3:
        for x in [a[0]+25,a[0]+35]:
            for sy in [-3.6,3.6]:strip('loggia_support_'+str(x)+'_'+str(sy),[x,a[1]+sy-.5,42],[x,a[1]+sy+.5,42],-.5,.5,0,a[2]-42)
    strip('rest_'+str(i)+'_bench',u,v,-.3,.3,.2,.85,'wood')
# Carve side-wall junctions with all passage volumes, including oblique approaches.
for m in p['meshes']:
    if m['name'] in old_names or not m['name'].endswith(('_wall_-1','_wall_1')):continue
    vv=[];ff=[]
    for f in m['faces']:
        poly=[m['vertices'][j]for j in f];xy=LineString([v[:2]for v in poly]).buffer(.001)
        candidates=[int(i)for i in tree.query(xy)if max(v[2]for v in poly)>=cutters[int(i)][2]and min(v[2]for v in poly)<=cutters[int(i)][3]]
        pieces=[poly]
        for i in candidates:pieces=[part for q in pieces for part in subtract(q,cutters[i][0])]
        for q in pieces:
            k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
    m['vertices']=vv;m['faces']=ff
# Existing public roads keep their full physical clearance through gate mouths.
new_cutters=cutters[:]
for old in baseline.values():
    if old['id']=='north_court_wall_stairs':continue
    for a,b in zip(old['points'],old['points'][1:]):
        if math.dist(a[:2],b[:2])<.001:continue
        if old['kind']!='river_walk':cutter(a,b,old['width']+1,.1,4.6)
old_tree=STRtree([c[1]for c in cutters])
for m in p['meshes']:
    if m['name'] in old_names or not (m['name'].endswith(('_wall_-1','_wall_1'))or 'portal_'in m['name']or '_rest_'in m['name']and m['name'].endswith('_end')or 'north_parapet_'in m['name']):continue
    vv=[];ff=[]
    for f in m['faces']:
        poly=[m['vertices'][j]for j in f];xy=LineString([v[:2]for v in poly]).buffer(.001);pieces=[poly]
        for i in old_tree.query(xy):
            if int(i)<len(new_cutters) and not ('_rest_'in m['name'] and m['name'].endswith('_end') or 'north_parapet_'in m['name']):continue
            c=cutters[int(i)]
            if max(v[2]for v in poly)<c[2] or min(v[2]for v in poly)>c[3]:continue
            pieces=[part for q in pieces for part in subtract(q,c[0])]
        for q in pieces:
            k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
    m['vertices']=vv;m['faces']=ff
for m in p['meshes']:
    if not any(k in m['name']for k in ['wall_gallery_abutment_','wall_gallery_north_wall_tie_']):continue
    vv=[];ff=[]
    for f in m['faces']:
        poly=[m['vertices'][j]for j in f];xy=LineString([v[:2]for v in poly]).buffer(.001);pieces=[poly]
        for idx in old_tree.query(xy):
            c=cutters[int(idx)]
            if max(v[2]for v in poly)<c[2]or min(v[2]for v in poly)>c[3]:continue
            planes=list(c[0]);n,limit=planes[-1];planes[-1]=(n,limit-.75)
            pieces=[part for q in pieces for part in subtract(q,planes)]
        for q in pieces:
            k=len(vv);vv.extend(q);ff.append(list(range(k,k+len(q))))
    m['vertices']=vv;m['faces']=ff
cutters=new_cutters

# Real new corridors are reserved; only vertically intersecting ordinary plots may go.
reserve=unary_union([c[1]for c in cutters])
removed=[]
for q in data['parcels']:
    g=shape(q['geometry']);risk=False
    for planes,foot,z0,z1 in cutters:
        if q['groundM']+q['heightM']+3<z0 or q['groundM']>z1:continue
        if g.intersects(foot):risk=True;break
    if risk:
        if q.get('canonicalFacilityId'):raise RuntimeError('Canonical parcel obstructs route; redesign required')
        removed.append(q['id'])
data['parcels']=[q for q in data['parcels']if q['id']not in removed]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds']if i not in removed]
data['audit']['parcelCount']=len(data['parcels'])
p['routes']=[r for r in p['routes']if r['id']!='north_court_wall_stairs'];p['routes'].extend(new_routes);p['negativeSpaces'].append(mapping(reserve));p['audit']['routeCount']=len(p['routes'])
# Open the material hall toward the living court and make its work visible.
work=next(b for b in p['eastServiceBlockStudy']['buildings']if b['id']=='material_hall')
def wlocal(x,y,z):
    a=math.radians(27);return [1362+x*math.cos(a)-y*math.sin(a),25+x*math.sin(a)+y*math.cos(a),z]
for m in p['meshes']:
    if m['name']=='east_work_material_hall_west0':
        m['vertices']=[];m['faces']=[];changed.append(m['name'])
for lo,hi in [(-6,-4),(4,6)]:
    strip('material_hall_west_pier_'+str(lo),wlocal(-14,lo,14.2),wlocal(-14,hi,14.2),-.25,.25,0,5)
strip('material_hall_west_lintel',wlocal(-14,-4,18.2),wlocal(-14,4,18.2),-.25,.25,0,1)
outside=wlocal(-18,0,14);inside=wlocal(-10,0,14)
life=LineString([q[:2]for q in baseline['east_work_life']['points']]);start=nearest_points(Point(outside[:2]),life)[1]
front=make_route('east_work_material_court_entry',densify([[start.x,start.y,14],outside,inside]),3,'life')
front.pop('gateTag',None);front.pop('gateStatus',None);front['role']='public-work-court';p['routes'].append(front)
for i,(a,b)in enumerate(zip(front['points'],front['points'][1:])):strip('material_entry_floor_'+str(i),a,b,-2,2,0,.2,'lane')
# Canopy over the open west door, supported outside the walking width.
strip('material_court_canopy',wlocal(-18,-4.5,18.3),wlocal(-18,4.5,18.3),-2,2,0,.2,'wood')
for y in [-4.2,4.2]:strip('material_canopy_post_'+str(y),wlocal(-19.7,y-.2,14.2),wlocal(-19.7,y+.2,14.2),-.2,.2,0,4.1,'wood')
# Repair benches are kept away from the service-road envelope.
for i,y in enumerate([-3,3]):
    strip('repair_court_bench_'+str(i),[1307,y,14.2],[1311,y,14.2],-.6,.6,0,.85,'wood')
work['additionalOpening']='8m west opening and shaded court entry'
p['courtFrontageStudy']=dict(status='PROPOSED',openingWidthM=8,route=front,worldReason='T06 supply delays and T09/T14 repair/quality disputes can be visible in an existing working court',noNewCanonicalFacility=True)
# Seal the abandoned narrow northern stair trench at the underlying terrace.
for i,(a,b)in enumerate(zip(north_old['points'],north_old['points'][1:])):
    aa=[a[0],a[1],112];bb=[b[0],b[1],112]
    if math.dist(aa,bb)>.001:strip('north_old_trench_fill_'+str(i),aa,bb,-2.1,2.1,-.3,0,'ground')

# Continuous flat corner aprons bridge ribbon joins at full walking width.
for name,at,w in [('north_start',[185,1276,112],5.4),('north_turn_a',[235,1247,134],5.4),('north_turn_b',[235,1239,134],5.4),('middle_turn',approach,3.8)]:
    strip('joint_apron_'+name,[at[0]-w/2,at[1],at[2]],[at[0]+w/2,at[1],at[2]],-w/2,w/2,-.35,.2,'stairs')
for m in p['meshes']:
    if m['name']=='east_work_material_hall_stock_-1':
        old=wlocal(-8.96,0,0);new=wlocal(-6,3.5,0)
        for v in m['vertices']:
            v[0]+=new[0]-old[0];v[1]+=new[1]-old[1]
        changed.append(m['name'])
p['audit']['routeCount']=len(p['routes'])

report=dict(status='REQUIRES_REAL_MESH_AND_VISUAL_REVIEW',baseVersion='B76',sourceGitHEAD='dcf57ccf105af69a1bb6ae4eb9eed635dc8c51b1',changedMeshes=changed,addedMeshes=[m['name']for m in p['meshes']if m['name']not in old_names],cutFaceCount=cut_faces,removedParcelIds=removed,newRoutes=new_routes,restLandings=rest,originalFreightLengthM=ramp['lengthM'],stairLengthM=stair['lengthM'],supportSeamRepairs=seam_repairs,northStairBeforeM=north_old['lengthM'],northStairAfterM=north['lengthM'],middlePortal=ramp_portal,lowerPortal=low['points'][0],upperPortal=upper['points'][0],requiredUpperPermission='G_SOCIAL_STATUS',pending=['Verify holes and junctions in actual mesh','Add readable lighting/window treatment without false vistas','Cart ramp exposure elsewhere remains unresolved','No runtime access-control or controller acceptance'])
p['wallGalleryStudy']=report
out.mkdir(parents=True)
for name,value in [('plan.json',p),('parcels.json',data),('wall-gallery-study.json',report)]:
    (out/name).write_text(json.dumps(value,separators=(',',':')),encoding='utf-8')
print(json.dumps({k:report[k]for k in ['status','changedMeshes','cutFaceCount','removedParcelIds','originalFreightLengthM','stairLengthM','middlePortal','lowerPortal','upperPortal']}))
