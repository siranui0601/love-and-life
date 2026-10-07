"""Asymmetric terrain-first street proposal. Requires Shapely 2.1+.
Exports editable Blender geometry and an explicitly provisional route audit.
"""
import json,math,sys,pathlib
from shapely.geometry import Polygon,LineString,Point,mapping
from shapely.ops import unary_union,split,nearest_points
from shapely import constrained_delaunay_triangles,set_precision
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
 if kind=='cart_ramp' and len(ps)>2:
  curved=[ps[0]]
  for a,b,c in zip(ps,ps[1:],ps[2:]):
   incoming=math.dist(a,b);outgoing=math.dist(b,c);cut=min(35,incoming*.25,outgoing*.25)
   start=[b[k]+(a[k]-b[k])*cut/incoming for k in range(2)];end=[b[k]+(c[k]-b[k])*cut/outgoing for k in range(2)]
   curved.extend([[(1-t)**2*start[k]+2*(1-t)*t*b[k]+t*t*end[k] for k in range(2)]for t in [j/16 for j in range(17)]])
  ps=curved+[ps[-1]]
 line=LineString(ps)
 if not line.is_simple:raise ValueError('Self-intersecting route: '+name)
 z1=z0 if z1 is None else z1;coords=[]
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
# Wall-following service stairs connect pockets cut off by the original ramps.
for name,ps,a,b in [
 ('west_lower_wall_stairs',[(-882,570),(-901,605),(-899,690),(-875,754)],14,42),
 ('west_noble_wall_stairs',[(-875,754),(-855,840),(-820,835),(-760,800)],42,78),
 ('north_court_wall_stairs',[(185,1276),(340,1270),(355,1260),(350,1245),(168,1235)],112,156)]:
 route(name,ps,4,'stairs',a,b)
# Regular horizontal landings are part of the height profile, not surface decals.
for r in routes:
 if r['kind']!='stairs':continue
 line=LineString([p[:2]for p in r['points']]);rise=r['z1']-r['z0'];flights=math.ceil(abs(rise)/3.06)
 landing=2.5;apron=8;run=(line.length-2*apron-(flights-1)*landing)/flights
 if run<=0:raise ValueError('Stair alignment too short for landings')
 points=[[line.coords[0][0],line.coords[0][1],r['z0']]];distance=apron
 for flight in range(flights):
  z=r['z0']+rise*flight/flights;steps=math.ceil(abs(rise/flights)/.17)
  for step in range(steps+1):
   p=line.interpolate(distance+run*step/steps);points.append([p.x,p.y,z+rise/flights*step/steps])
  distance+=run
  if flight<flights-1:
   distance+=landing;p=line.interpolate(distance);points.append([p.x,p.y,r['z0']+rise*(flight+1)/flights])
 points.append([line.coords[-1][0],line.coords[-1][1],r['z1']])
 r['points']=[p for i,p in enumerate(points) if i==0 or math.dist(p,points[i-1])>1e-6];r['landingCount']=flights+1;r['landingLengthM']=landing
# Preserve the four existing local bridge IDs and their logistics roles.
# The west low bridge alone closes in flood; locations are new morphology proposals.
bridge_specs=[('west_bridge',-850,9,True),('south_bridge',-38,20,False),('news_bridge',550,12,False),('east_bridge',1130,12,False)]
bridges=[]
for ident,x,width,low in bridge_specs:
 crossing=river.intersection(LineString([(x,-2000),(x,0)]));station=river.project(crossing)
 a=river.interpolate(max(0,station-1));b=river.interpolate(min(river.length,station+1));dx=b.x-a.x;dy=b.y-a.y;length=math.hypot(dx,dy);normal=(-dy/length,dx/length)
 def bankpoint(offset):return [crossing.x+normal[0]*offset,crossing.y+normal[1]*offset]
 deck=11.2 if low else 14;span=12 if low else 32
 south=bankpoint(-75);north=bankpoint(75)
 r=route(ident,[bankpoint(-span),bankpoint(span)],width,'bridge',deck);r['bridgeId']=ident;r['floodClosed']=low
 for suffix,start,end,z0,z1 in [('south',south,bankpoint(-span),14,deck),('north',bankpoint(span),north,deck,14)]:
  r=route(ident+'_'+suffix+'_approach',[start,end],width,'river_ramp',z0,z1);r['bridgeId']=ident
 bridges.append(dict(id=ident,stationM=station,position=[crossing.x,crossing.y],normal=normal,widthM=width,deckHeightM=deck,floodClosed=low,south=south,north=north,halfSpanM=span))
# Both banks are traversable. The low-bridge landing pushes the bank walk inland
# to meet the top of its approach, avoiding a same-plan/different-height crossing.
west_station=bridges[0]['stationM']
for side,label in [(-1,'south'),(1,'north')]:
 ps=[]
 stations=sorted(set([river.length*i/180 for i in range(181)]+[west_station]))
 for d in stations:
  c=river.interpolate(d);a=river.interpolate(max(0,d-1));b=river.interpolate(min(river.length,d+1));dx=b.x-a.x;dy=b.y-a.y;length=math.hypot(dx,dy)
  offset=24+51*max(0,1-abs(d-west_station)/135)**2
  ps.append([c.x-dy/length*offset*side,c.y+dx/length*offset*side])
 for i,line in enumerate(parts(LineString(ps).intersection(core.buffer(-15)),'LineString')):route('river_walk_'+label+'_'+str(i),list(line.coords),6,'river_walk',14)
cutters=unary_union([LineString([p[:2]for p in r['points']]).buffer(r['width']/2,join_style=2)for r in routes if r['kind']!='river_walk'])
# Exact flat domains are established before any neighbourhood subdivision.
domains={name:poly.difference(unary_union([q for _,h,q in terraces if h>z])).difference(channel).difference(cutters) for name,z,poly in terraces}
primary=[('west_gate_market',[(-1220,80),(-1050,20),(-500,10),(0,-50)]),('south_gate_market',[(0,-1380),(-100,-950),bridges[1]['south'],bridges[1]['north'],(0,-600),(0,-50)]),('east_gate_market',[(1580,80),(1330,-130),(950,-400),(500,-220),(0,-50)])]
for name,ps in primary:route(name,ps,20,'primary',14)
# Secondary streets follow the two bank settlements and their destinations.
B={b['id']:b for b in bridges}
for ident,ps,width,role in [
 ('west_old_quay',[(-1220,80),(-1070,-80),(-1020,-310),B['west_bridge']['north']],8,'service-logistics'),
 ('west_market_life',[B['west_bridge']['north'],(-760,-250),(-430,-180),(0,-50)],7,'optional-life'),
 ('lower_daily_loop',[B['west_bridge']['south'],(-850,-780),(-630,-890),(-390,-960),B['south_bridge']['south']],7,'optional-life'),
 ('ajin_daily_loop',[B['south_bridge']['south'],(200,-1020),(660,-970),(1010,-720),B['east_bridge']['south']],7,'optional-life'),
 ('news_market',[B['news_bridge']['north'],(420,-320),(160,-180),(0,-50)],8,'information'),
 ('east_quay_gate',[B['east_bridge']['north'],(1250,-100),(1580,80)],9,'service-logistics')]:
 r=route(ident,ps,width,'secondary',14);r['role']=role
# Public space and primary rights-of-way precede block subdivision.
market=Point(0,-50).buffer(65)
negative_spaces=[market,Point(-630,-890).buffer(28),Point(660,-970).buffer(24)]
primary_reserve=unary_union([LineString([p[:2]for p in r['points']]).buffer(r['width']/2,join_style=2)for r in routes if r['kind'] in ['primary','secondary','river_walk','bridge','river_ramp']]+negative_spaces)
# Subdivision is confined to exposed flat land; setbacks reserve wall walks.
# Long block dimensions, not a uniform city grid, determine local cuts.
for name,z,poly in terraces:
 domain=domains[name];street_area=set_precision(domain.buffer(-22,join_style=2).difference(primary_reserve.buffer(4,join_style=2)),.001)
 loops=[];serial=0
 for p in parts(street_area,'Polygon'):
  if p.area<2500:continue
  boundary=LineString(p.exterior.coords);loops.append(boundary)
  route(name+'_contour_'+str(len(loops)),list(boundary.coords),7,'contour',z)
  queue=[(p,0)]
  target=11000 if name=='low_city' else 18000 if name in ['civic_foot','mage_east'] else 35000
  while queue:
   block,depth=queue.pop(0)
   if block.area<target or depth>=16:continue
   rect=list(block.minimum_rotated_rectangle.exterior.coords);a,b=max(zip(rect,rect[1:]),key=lambda ab:round(Point(ab[0]).distance(Point(ab[1])),5))
   dx=round(b[0]-a[0],6);dy=round(b[1]-a[1],6)
   if dx<0 or (dx==0 and dy<0):dx=-dx;dy=-dy
   length=math.hypot(dx,dy);ux,uy=dx/length,dy/length;c=block.centroid;shift=((depth%3)-1)*.035*length
   origin=(round(c.x+ux*shift,3),round(c.y+uy*shift,3));cut=LineString([(origin[0]-uy*5000,origin[1]+ux*5000),(origin[0]+uy*5000,origin[1]-ux*5000)])
   # Pilot lower quarter: inherited plot boundaries bend local routes around a
   # shared court. Ends remain on existing streets, so this is a connected choice.
   pilot=name=='low_city' and -1050<c.x<-200 and -1200<c.y<-740 and depth>=2
   bend_center=None
   if pilot:
    spans=parts(cut.intersection(block),'LineString')
    if len(spans)==1 and spans[0].length>65:
     span=spans[0];mid=span.interpolate(.5,normalized=True);bend=min(16,span.length*.12)
     if depth%2:bend=-bend
     bend_center=Point(mid.x+ux*bend,mid.y+uy*bend)
     q1=span.interpolate(.28,normalized=True);q2=span.interpolate(.72,normalized=True)
     candidate=LineString([cut.coords[0],(q1.x,q1.y),(bend_center.x,bend_center.y),(q2.x+ux*bend*.5,q2.y+uy*bend*.5),cut.coords[-1]])
     # Choose traversal direction consistently; intersection geometry may reverse.
     if Point(cut.coords[0]).distance(Point(span.coords[0]))>Point(cut.coords[0]).distance(Point(span.coords[-1])):
      candidate=LineString([cut.coords[0],(q2.x,q2.y),(bend_center.x,bend_center.y),(q1.x+ux*bend*.5,q1.y+uy*bend*.5),cut.coords[-1]])
     if candidate.is_simple and block.buffer(-10).covers(bend_center):cut=candidate
     else:bend_center=None
   sections=parts(cut.intersection(block),'LineString');children=parts(split(block,cut),'Polygon')
   if len(children)<2 or min(q.area for q in children)<1500:continue
   for line in sections:
    if line.length<25:continue
    serial+=1;r=route(name+'_lane_'+str(serial),list(line.coords),4 if depth>=4 else 6,'alley' if depth>=4 else 'life',z)
    if bend_center is not None:
     r['reviewArea']='lower-quarter-pilot';r['role']='optional-life'if depth<4 else 'desire-path'
     if depth in [2,3]:
      pocket=bend_center.buffer(9).intersection(block.buffer(-2))
      if pocket.area>150:negative_spaces.append(pocket)
   queue.extend((set_precision(q,.001),depth+1)for q in children)
approved_crossings=unary_union([LineString([p[:2]for p in r['points']]).buffer(r['width']/2+.2)for r in routes if r['kind']in ['bridge','river_ramp']])
def crosses_unbridged_water(line):return line.intersection(channel).difference(approved_crossings).length>.05
# Give each block perimeter an explicit frontage connection to nearby main roads.
for r in list(routes):
 if r['kind']!='contour':continue
 line=LineString([p[:2]for p in r['points']])
 for main in [q for q in routes if q['kind'] in ['primary','secondary','river_walk'] and q['z0']==r['z0']]:
  other=LineString([p[:2]for p in main['points']]);a,b=nearest_points(line,other)
  if .05<a.distance(b)<35 and not crosses_unbridged_water(LineString([a,b])):
   route(r['id']+'_frontage_'+main['id'],[[a.x,a.y],[b.x,b.y]],6,'life',r['z0'])
# Connect every ascent endpoint to the nearest same-level neighbourhood street.
# Connections are audited below; they are not silently assumed walkable.
for r in list(routes):
 if r['kind']not in ['cart_ramp','stairs','primary','secondary','river_ramp','river_walk']:continue
 for k,p in enumerate([r['points'][0],r['points'][-1]]):
  candidates=[q for q in routes if q['kind']in ['contour','life','alley','river_walk'] and abs(q['z0']-p[2])<.01]
  if not candidates:continue
  lines=[LineString([v[:2]for v in q['points']])for q in candidates]
  options=[]
  for line in lines:
   q=nearest_points(Point(p[:2]),line)[1];link=LineString([p[:2],[q.x,q.y]])
   if not crosses_unbridged_water(link) and all(not core.covers(t) or height((t.x,t.y))<=p[2]+.01 for t in [link.interpolate(k/20,normalized=True)for k in range(21)]):options.append((q.distance(Point(p[:2])),q))
  if not options:continue
  q=min(options,key=lambda o:o[0])[1]
  if q.distance(Point(p[:2]))>.05:route(r['id']+'_landing_'+str(k),[p[:2],[q.x,q.y]],r['width'],'landing',p[2])
meshes=[]
def mesh(name,v,f,material):meshes.append(dict(name=name,vertices=v,faces=f,material=material))
# Pocket courts are walkable paving, not only building-exclusion metadata.
for i,space in enumerate(negative_spaces):
 verts=[];faces=[]
 for tri in parts(constrained_delaunay_triangles(space),'Polygon'):
  k=len(verts);verts.extend([[x,y,14.03]for x,y in list(tri.exterior.coords)[:3]]);faces.append([k,k+1,k+2])
 mesh('public_court_'+str(i),verts,faces,'lane')
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
  a=ps[max(0,i-1)];b=ps[min(len(ps)-1,i+1)]
  d0=(p[0]-a[0],p[1]-a[1]);d1=(b[0]-p[0],b[1]-p[1])
  if math.hypot(*d0)<1e-8:d0=d1
  if math.hypot(*d1)<1e-8:d1=d0
  l0=math.hypot(*d0)or 1;l1=math.hypot(*d1)or 1;n0=(-d0[1]/l0,d0[0]/l0);n1=(-d1[1]/l1,d1[0]/l1)
  nx=n0[0]+n1[0];ny=n0[1]+n1[1];length=math.hypot(nx,ny)or 1;nx/=length;ny/=length
  extent=r['width']/2/max(.25,nx*n0[0]+ny*n0[1])
  for side in [-1,1]:
   x=p[0]+nx*extent*side;y=p[1]+ny*extent*side;v.append([x,y,p[2]+.15])
  if i:f.append([2*i-2,2*i-1,2*i+1,2*i])
 mesh(r['id'],v,f,'primary'if r['kind'] in ['primary','cart_ramp']else 'stairs'if r['kind']=='stairs'else 'lane')
 if r['kind']in ['cart_ramp','stairs','river_ramp']:
  for i in range(1,len(ps)):
   for side in [0,1]:
    a=v[(i-1)*2+side];b=v[i*2+side];za=height(a[:2]);zb=height(b[:2])
    # Two explicitly authored passages under the noble service ramp preserve
    # the lower street and stair. Lift the support's bottom, not the road top.
    if r['id']=='noble_service':
     edge=LineString([a[:2],b[:2]])
     for lower in [q for q in routes if q['id'] in ['west_lower_wall_stairs','west_lower_wall_stairs_landing_0']]:
      lowerline=LineString([p[:2]for p in lower['points']])
      if edge.distance(lowerline)<=lower['width']/2+1:
       nearby=[p[2]for p in lower['points']if edge.distance(Point(p[:2]))<lower['width']/2+6]
       if nearby:
        ceiling=max(nearby)+5
        if ceiling<min(a[2],b[2])-2:za=max(za,ceiling);zb=max(zb,ceiling)
    j=len(walls);walls.extend([a,b,[b[0],b[1],zb],[a[0],a[1],za]]);wf.append([j,j+1,j+2,j+3])
  mesh(r['id']+'_support',walls,wf,'stone')
# Outer fortification: actual width, parapets and wall towers. Gate openings
# are projected from the three primary road endpoints, never arbitrary gaps.
gates=[nearest_points(Point(ps[0]),core.boundary)[1] for _,ps in primary]
gate_corridors=unary_union([LineString([p[:2]for p in r['points']]).buffer(r['width']/2+3,join_style=2)for r in routes if r['kind']=='primary' or r['id'].endswith('_gate_market_landing_0')])
wall_line=core.boundary.difference(gate_corridors)
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
  q=line.interpolate(k);footprint=q.buffer(8,resolution=6)
  if not footprint.intersects(gate_corridors):prism('wall_tower_%s_%s'%(i,k),footprint,14,44)
# River banks and bridge superstructure share the same centreline geometry.
bridge_openings=unary_union([LineString([p[:2]for p in r['points']]).buffer(r['width']/2+1)for r in routes if r['kind'] in ['bridge','river_ramp']])
for side in [-1,1]:
 line=river.offset_curve(8*side,join_style=2).intersection(core).difference(bridge_openings)
 for j,part in enumerate(parts(line,'LineString')):
  v=[];f=[]
  for a,b in zip(list(part.coords),list(part.coords)[1:]):
   i=len(v);v.extend([[*a,7],[*b,7],[*b,14],[*a,14]]);f.append([i,i+1,i+2,i+3])
  mesh('river_bank_'+str(side)+'_'+str(j),v,f,'stone')
for b in bridges:
 c=b['position'];nx,ny=b['normal'];half=b['halfSpanM'];line=LineString([(c[0]-nx*half,c[1]-ny*half),(c[0]+nx*half,c[1]+ny*half)])
 prism(b['id']+'_deck',line.buffer(b['widthM']/2,cap_style=2),b['deckHeightM']-1,b['deckHeightM']+.10)
 for side in [-1,1]:
  q=Point(c[0]+nx*11*side,c[1]+ny*11*side)
  # Abutments stay outside the16m channel, below the deck walking surface.
  prism(b['id']+'_abutment_'+str(side),q.buffer(2,resolution=4),6,b['deckHeightM']-1)
# Stair treads are discrete geometry; smooth audit centreline is retained separately.
for r in routes:
 if r['kind']!='stairs':continue
 v=[];f=[]
 for pa,pb in zip(r['points'],r['points'][1:]):
  a=Point(pa[:2]);b=Point(pb[:2]);dx=b.x-a.x;dy=b.y-a.y;d=math.hypot(dx,dy)or 1;nx=-dy/d*r['width']/2;ny=dx/d*r['width']/2
  z=pb[2]+.18;prev=pa[2]+.18
  j=len(v);v.extend([[a.x-nx,a.y-ny,z],[a.x+nx,a.y+ny,z],[b.x+nx,b.y+ny,z],[b.x-nx,b.y-ny,z],[a.x-nx,a.y-ny,prev],[a.x+nx,a.y+ny,prev]])
  f.append([j,j+1,j+2,j+3])
  if abs(z-prev)>.0001:f.append([j+4,j+5,j+1,j])
 mesh(r['id']+'_treads',v,f,'stairs')
# Water and scale markers; do not add new canonical facilities.
wv=[];wf=[]
for t in parts(constrained_delaunay_triangles(channel.intersection(core)),'Polygon'):
 j=len(wv);wv.extend([[x,y,8]for x,y in list(t.exterior.coords)[:3]]);wf.append([j,j+1,j+2])
mesh('river_16m_channel',wv,wf,'water')
issues=[]
for r in routes:
 if r['kind']in ['cart_ramp','stairs','river_ramp','bridge']:continue
 for p in r['points']:
  if not core.covers(Point(p[:2])):continue
  if height(p[:2])>p[2]+.5:issues.append(dict(route=r['id'],problem='buried',position=p,ground=height(p[:2])));break
for r in routes:
 r['lengthM']=sum(math.dist(a[:2],b[:2])for a,b in zip(r['points'],r['points'][1:]));r['grade']=abs(r['z1']-r['z0'])/r['lengthM']
assert len({r['id']for r in routes})==len(routes),'Duplicate route IDs'
water_violations=[r['id']for r in routes if crosses_unbridged_water(LineString([p[:2]for p in r['points']]))]
land_domains=[dict(id=n,heightM=z,geometry=mapping(domains[n]))for n,z,_ in terraces]
result=dict(landDomains=land_domains,negativeSpaces=[mapping(g)for g in negative_spaces],bridges=bridges,status='UNACCEPTED DESIGN STUDY',coreAreaKm2=core.area/1e6,terraces=[dict(id=n,heightM=z,areaM2=p.area)for n,z,p in terraces],meshes=meshes,routes=routes,audit=dict(unbridgedWaterCrossings=water_violations,routeCount=len(routes),buriedRoutes=issues,maxCartGrade=max(r['grade']for r in routes if r['kind']=='cart_ramp'),pending=['3D intersection validation','landing domain clipping','gates and river bridge structures','all canonical anchors','full route connectivity and events','stair full-width collision and refuges']))
out.write_text(json.dumps(result,separators=(',',':')));print(json.dumps(dict(file=str(out),area=result['coreAreaKm2'],routes=len(routes),buried=len(issues),maxCartGrade=result['audit']['maxCartGrade'])))
