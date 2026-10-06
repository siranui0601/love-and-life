"""Asymmetric terrain-first street proposal. Requires Shapely 2.1+.
Exports editable Blender geometry and an explicitly provisional route audit.
"""
import json,math,sys,pathlib
from shapely.geometry import Polygon,LineString,Point
from shapely.ops import unary_union,split,nearest_points
from shapely import constrained_delaunay_triangles
out=pathlib.Path(sys.argv[1]);out.parent.mkdir(parents=True,exist_ok=True)
core=Polygon([(-1190,-187),(-1028,-835),(-501,-1280),(268,-1401),(996,-1118),(1482,-592),(1604,96),(1442,825),(996,1351),(308,1554),(-461,1432),(-987,906),(-1230,299)])
terraces=[('low_city',14,core),
 ('civic_foot',42,Polygon([(-750,280),(-480,160),(0,200),(500,260),(780,600),(500,1150),(-400,1200),(-950,900)])),
 ('noble_west',78,Polygon([(-850,600),(-400,500),(-100,700),(-250,1200),(-700,1100)])),
 ('mage_east',70,Polygon([(800,400),(1180,350),(1350,720),(1000,980),(750,850)])),
 ('upper_city',112,Polygon([(-250,560),(200,420),(600,620),(620,1000),(200,1360),(-230,1100)])),
 ('forecourt',156,Polygon([(-120,830),(230,730),(480,840),(420,1150),(120,1280),(-100,1090)])),
 ('castle',204,Polygon([(100,1000),(300,950),(450,1080),(310,1220),(120,1170)]))]
terraces.sort(key=lambda v:v[1])
def height(p):return max(z for _,z,poly in terraces if poly.covers(Point(p)))
def parts(g,kind):
 if g.is_empty:return []
 if g.geom_type==kind:return [g]
 return [p for q in getattr(g,'geoms',[]) for p in parts(q,kind)]
river=LineString([(-1220,-420),(-780,-570),(-400,-550),(-40,-740),(340,-670),(750,-570),(1170,-340),(1510,-170)])
channel=river.buffer(8,join_style=2)
routes=[]
def route(name,ps,width,kind,z0,z1=None):
 line=LineString(ps);z1=z0 if z1 is None else z1;coords=[]
 for i in range(max(2,math.ceil(line.length/4))+1):
  t=i/max(2,math.ceil(line.length/4));p=line.interpolate(t,normalized=True);coords.append([p.x,p.y,z0+(z1-z0)*t])
 r=dict(id=name,kind=kind,width=width,points=coords,z0=z0,z1=z1);routes.append(r);return r
ramps=[('market_ascent',[(-650,100),(-400,100),(-220,160),(-100,250)],14,42),
 ('civic_royal_ramp',[(400,320),(650,430),(710,580),(670,790),(560,880)],42,112),
 ('court_west_ramp',[(-180,680),(-240,840),(-220,1070),(0,1160)],112,156),
 ('castle_east_ramp',[(380,900),(510,1040),(450,1250),(270,1170)],156,204),
 ('noble_service',[(-720,410),(-900,470),(-930,700),(-780,760)],42,78),
 ('mage_civic_ramp',[(1220,60),(1390,120),(1460,310),(1350,510),(1150,510)],14,70)]
for name,ps,a,b in ramps:route(name,ps,14,'cart_ramp',a,b)
for name,ps,a,b in [('market_wall_stairs',[(0,80),(20,180),(0,240)],14,42),('upper_wall_stairs',[(0,350),(180,470),(200,530)],42,112),('court_wall_stairs',[(180,640),(100,770),(180,830)],112,156),('castle_wall_stairs',[(100,940),(130,1030),(200,1080)],156,204)]:route(name,ps,4,'stairs',a,b)
cutters=unary_union([LineString([p[:2]for p in r['points']]).buffer(r['width']/2,join_style=2)for r in routes])
# Exact flat domains are established before any neighbourhood subdivision.
domains={name:poly.difference(unary_union([q for _,h,q in terraces if h>z])).difference(channel).difference(cutters) for name,z,poly in terraces}
primary=[('west_gate_market',[(-1220,80),(-1050,20),(-500,10),(0,-50)]),('south_gate_market',[(0,-1380),(-100,-950),(0,-600),(0,-50)]),('east_gate_market',[(1580,80),(1330,-130),(950,-400),(500,-220),(0,-50)])]
for name,ps in primary:route(name,ps,20,'primary',14)
# Public space and primary rights-of-way precede block subdivision.
market=Point(0,-50).buffer(65)
primary_reserve=unary_union([LineString(ps).buffer(10,join_style=2) for _,ps in primary]+[market])
# Subdivision is confined to exposed flat land; setbacks reserve wall walks.
# Long block dimensions, not a uniform city grid, determine local cuts.
for name,z,poly in terraces:
 domain=domains[name];street_area=domain.buffer(-22,join_style=2).difference(primary_reserve.buffer(4,join_style=2))
 loops=[]
 for p in parts(street_area,'Polygon'):
  if p.area<2500:continue
  boundary=LineString(p.exterior.coords);loops.append(boundary)
  route(name+'_contour_'+str(len(loops)),list(boundary.coords),7,'contour',z)
  queue=[(p,0)];serial=0
  target=11000 if name=='low_city' else 18000 if name in ['civic_foot','mage_east'] else 35000
  while queue:
   block,depth=queue.pop(0)
   if block.area<target or depth>=16:continue
   rect=list(block.minimum_rotated_rectangle.exterior.coords);a,b=max(zip(rect,rect[1:]),key=lambda ab:Point(ab[0]).distance(Point(ab[1])))
   dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy);ux,uy=dx/length,dy/length;c=block.centroid;shift=((depth%3)-1)*.035*length
   origin=(c.x+ux*shift,c.y+uy*shift);cut=LineString([(origin[0]-uy*5000,origin[1]+ux*5000),(origin[0]+uy*5000,origin[1]-ux*5000)])
   sections=parts(cut.intersection(block),'LineString');children=parts(split(block,cut),'Polygon')
   if len(children)<2 or min(q.area for q in children)<1500:continue
   for line in sections:
    if line.length<25:continue
    serial+=1;route(name+'_lane_'+str(serial),list(line.coords),4 if depth>=4 else 6,'alley' if depth>=4 else 'life',z)
   queue.extend((q,depth+1)for q in children)
# Give each block perimeter an explicit frontage connection to nearby main roads.
for r in list(routes):
 if r['kind']!='contour':continue
 line=LineString([p[:2]for p in r['points']])
 for main in [q for q in routes if q['kind']=='primary' and q['z0']==r['z0']]:
  other=LineString([p[:2]for p in main['points']]);a,b=nearest_points(line,other)
  if .05<a.distance(b)<35:
   route(r['id']+'_frontage_'+main['id'],[[a.x,a.y],[b.x,b.y]],6,'life',r['z0'])
# Connect every ascent endpoint to the nearest same-level neighbourhood street.
# Connections are audited below; they are not silently assumed walkable.
for r in list(routes):
 if r['kind']not in ['cart_ramp','stairs','primary']:continue
 for k,p in enumerate([r['points'][0],r['points'][-1]]):
  candidates=[q for q in routes if q['kind']in ['contour','life','alley'] and abs(q['z0']-p[2])<.01]
  if not candidates:continue
  lines=[LineString([v[:2]for v in q['points']])for q in candidates];line=min(lines,key=lambda l:l.distance(Point(p[:2])));q=nearest_points(Point(p[:2]),line)[1]
  if q.distance(Point(p[:2]))>.05:route(r['id']+'_landing_'+str(k),[p[:2],[q.x,q.y]],r['width'],'landing',p[2])
meshes=[]
def mesh(name,v,f,material):meshes.append(dict(name=name,vertices=v,faces=f,material=material))
for name,z,poly in terraces:
 domain=domains[name]
 tris=parts(constrained_delaunay_triangles(domain),'Polygon');v=[];f=[]
 for tri in tris:
  p=list(tri.exterior.coords)[:3];i=len(v);v.extend([[x,y,z]for x,y in p]);f.append([i,i+1,i+2])
 mesh(name+'_ground',v,f,'ground')
 # A boundary has a stone retaining face down to the lower neighbour.
 v=[];f=[]
 for ring in parts(poly.boundary.difference(cutters).difference(channel),'LineString'):
  ps=list(ring.coords)
  for a,b in zip(ps,ps[1:]):
   dx=b[0]-a[0];dy=b[1]-a[1];d=math.hypot(dx,dy)
   if d<.01:continue
   mid=((a[0]+b[0])/2,(a[1]+b[1])/2);side=[(mid[0]+dy/d*.1,mid[1]-dx/d*.1),(mid[0]-dy/d*.1,mid[1]+dx/d*.1)]
   values=[max([h for _,h,q in terraces if h<z and q.covers(Point(p))]+[-4])for p in side];bottom=max(values)
   if bottom>=z:continue
   i=len(v);v.extend([[*a,bottom],[*b,bottom],[*b,z],[*a,z]]);f.append([i,i+1,i+2,i+3])
 mesh(name+'_retaining',v,f,'stone')
# Ramps own their footprint. Their side faces meet the original ground height.
for r in routes:
 ps=r['points'];v=[];f=[];walls=[];wf=[]
 for i,p in enumerate(ps):
  a=ps[max(0,i-1)];b=ps[min(len(ps)-1,i+1)];dx=b[0]-a[0];dy=b[1]-a[1];d=math.hypot(dx,dy)or 1
  for side in [-1,1]:
   x=p[0]-dy/d*(r['width']/2)*side;y=p[1]+dx/d*(r['width']/2)*side;v.append([x,y,p[2]+.15])
  if i:f.append([2*i-2,2*i-1,2*i+1,2*i])
 mesh(r['id'],v,f,'primary'if r['kind'] in ['primary','cart_ramp']else 'stairs'if r['kind']=='stairs'else 'lane')
 if r['kind']in ['cart_ramp','stairs']:
  for i in range(1,len(ps)):
   for side in [0,1]:
    a=v[(i-1)*2+side];b=v[i*2+side];za=height(a[:2]);zb=height(b[:2]);j=len(walls);walls.extend([a,b,[b[0],b[1],zb],[a[0],a[1],za]]);wf.append([j,j+1,j+2,j+3])
  mesh(r['id']+'_support',walls,wf,'stone')
# Outer fortification: actual width, parapets and wall towers. Gate openings
# are projected from the three primary road endpoints, never arbitrary gaps.
gates=[nearest_points(Point(ps[0]),core.boundary)[1] for _,ps in primary]
wall_line=core.boundary.difference(unary_union([p.buffer(16) for p in gates]))
def prism(name,poly,bottom,top):
 v=[];f=[]
 for t in parts(constrained_delaunay_triangles(poly),'Polygon'):
  j=len(v);v.extend([[x,y,top]for x,y in list(t.exterior.coords)[:3]]);f.append([j,j+1,j+2])
 for ring in [poly.exterior,*poly.interiors]:
  ps=list(ring.coords)
  for a,b in zip(ps,ps[1:]):
   j=len(v);v.extend([[*a,bottom],[*b,bottom],[*b,top],[*a,top]]);f.append([j,j+1,j+2,j+3])
 mesh(name,v,f,'stone')
for i,line in enumerate(parts(wall_line,'LineString')):
 for j,p in enumerate(parts(line.buffer(4,cap_style=2,join_style=2),'Polygon')):prism('outer_wall_%s_%s'%(i,j),p,14,36)
 for k in range(0,int(line.length),120):
  q=line.interpolate(k);prism('wall_tower_%s_%s'%(i,k),q.buffer(8,resolution=6),14,44)
# Stair treads are discrete geometry; smooth audit centreline is retained separately.
for r in routes:
 if r['kind']!='stairs':continue
 line=LineString([p[:2]for p in r['points']]);n=math.ceil(abs(r['z1']-r['z0'])/.17)
 v=[];f=[]
 for i in range(n):
  a=line.interpolate(i/n,normalized=True);b=line.interpolate((i+1)/n,normalized=True)
  dx=b.x-a.x;dy=b.y-a.y;d=math.hypot(dx,dy)or 1;nx=-dy/d*r['width']/2;ny=dx/d*r['width']/2
  z=r['z0']+(r['z1']-r['z0'])*(i+1)/n+.18;prev=r['z0']+(r['z1']-r['z0'])*i/n+.18
  j=len(v);v.extend([[a.x-nx,a.y-ny,z],[a.x+nx,a.y+ny,z],[b.x+nx,b.y+ny,z],[b.x-nx,b.y-ny,z],[a.x-nx,a.y-ny,prev],[a.x+nx,a.y+ny,prev]])
  f.extend([[j,j+1,j+2,j+3],[j+4,j+5,j+1,j]])
 mesh(r['id']+'_treads',v,f,'stairs')
# Water and scale markers; do not add new canonical facilities.
wv=[];wf=[]
for t in parts(constrained_delaunay_triangles(channel.intersection(core)),'Polygon'):
 j=len(wv);wv.extend([[x,y,8]for x,y in list(t.exterior.coords)[:3]]);wf.append([j,j+1,j+2])
mesh('river_16m_channel',wv,wf,'water')
issues=[]
for r in routes:
 if r['kind']in ['cart_ramp','stairs']:continue
 for p in r['points']:
  if not core.covers(Point(p[:2])):continue
  if height(p[:2])>p[2]+.5:issues.append(dict(route=r['id'],problem='buried',position=p,ground=height(p[:2])));break
for r in routes:
 r['lengthM']=sum(math.dist(a[:2],b[:2])for a,b in zip(r['points'],r['points'][1:]));r['grade']=abs(r['z1']-r['z0'])/r['lengthM']
result=dict(status='UNACCEPTED DESIGN STUDY',coreAreaKm2=core.area/1e6,terraces=[dict(id=n,heightM=z,areaM2=p.area)for n,z,p in terraces],meshes=meshes,routes=routes,audit=dict(routeCount=len(routes),buriedRoutes=issues,maxCartGrade=max(r['grade']for r in routes if r['kind']=='cart_ramp'),pending=['3D intersection validation','landing domain clipping','gates and river bridge structures','all canonical anchors','full route connectivity and events','stair treads and refuges']))
out.write_text(json.dumps(result,separators=(',',':')));print(json.dumps(dict(file=str(out),area=result['coreAreaKm2'],routes=len(routes),buried=len(issues),maxCartGrade=result['audit']['maxCartGrade'])))
