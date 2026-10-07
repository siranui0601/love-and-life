"""Parcel frontage follows actual blocks bounded by the shared street network.
Outputs optional review massing; never changes the canonical setting or runtime.
"""
import json,pathlib,sys,math,hashlib
from shapely.geometry import shape,Polygon,LineString,Point,mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union
from shapely.strtree import STRtree
import importlib.util
spec=importlib.util.spec_from_file_location('architecture',pathlib.Path(__file__).with_name('architectural-geometry.py'));arch_geometry=importlib.util.module_from_spec(spec);spec.loader.exec_module(arch_geometry)
src=pathlib.Path(sys.argv[1]);data=json.loads(src.read_text())
def parts(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for q in getattr(g,'geoms',[])for p in parts(q)]
def rand(key):return int(hashlib.sha256(key.encode()).hexdigest()[:8],16)/0xffffffff
landmark_reserves=[shape(d['geometry'])for d in data['landDomains']if d['id']=='castle']+[Point(1050,650).buffer(65)]
reserves=unary_union([shape(g)for g in data['negativeSpaces']]+landmark_reserves);blocks=[];parcels=[]
for domain in data['landDomains']:
 z=domain['heightM'];roads=[r for r in data['routes']if abs(r['z0']-z)<.01 and abs(r['z1']-z)<.01]
 lines=[LineString([p[:2]for p in r['points']])for r in roads]
 if not lines:continue
 tree=STRtree(lines)
 streets=unary_union([l.buffer(r['width']/2+1.2,join_style=2)for l,r in zip(lines,roads)])
 land=shape(domain['geometry']).buffer(-3).difference(streets).difference(reserves)
 ordered=sorted(parts(land),key=lambda p:(round(p.centroid.x,3),round(p.centroid.y,3)))
 for block_index,block in enumerate(ordered):
  if block.area<120:continue
  block=orient(block.simplify(.03,preserve_topology=True),sign=1);bid=domain['id']+'_'+str(block_index);taken=[];bp=[]
  for edge,(a,b)in enumerate(zip(list(block.exterior.coords),list(block.exterior.coords)[1:])):
   length=math.dist(a,b)
   if length<6:continue
   dx=(b[0]-a[0])/length;dy=(b[1]-a[1])/length
   mid=Point((a[0]+b[0])/2,(a[1]+b[1])/2);ri=int(tree.nearest(mid));road=roads[ri]
   if lines[ri].distance(mid)>road['width']/2+3:continue
   x,y=mid.x,mid.y
   district=domain['id']
   if district=='low_city':district='quay'if any(lines[int(j)].distance(mid)<80 and roads[int(j)]['kind']=='river_walk'for j in tree.query(mid.buffer(80)))else 'ajin'if x>350 and y<-600 else 'market'if mid.distance(Point(0,-50))<400 else 'lower'
   spec={'lower':(6,10,11,17,5,10),'ajin':(10,17,16,25,8,15),'market':(8,14,18,28,11,18),'quay':(18,28,22,36,10,16),'noble_west':(32,48,40,62,15,25),'civic_foot':(18,28,24,38,14,23),'mage_east':(19,30,24,38,13,21)}.get(district,(24,38,28,45,13,22))
   lo,hi,dlo,dhi,hlo,hhi=spec;count=max(1,int(length/((lo+hi)/2)))
   weights=[lo+(hi-lo)*rand(f'{bid}:{edge}:front:{k}')for k in range(count)];total=sum(weights);bounds=[0]
   for weight in weights:bounds.append(bounds[-1]+length*weight/total)
   for slot in range(count):
    key=f'{bid}:{edge}:{slot}';start=bounds[slot];end=bounds[slot+1];front=end-start;depth=dlo+(dhi-dlo)*rand(key+'depth')
    corners=[(a[0]+dx*start,a[1]+dy*start),(a[0]+dx*end,a[1]+dy*end),(a[0]+dx*end-dy*depth,a[1]+dy*end+dx*depth),(a[0]+dx*start-dy*depth,a[1]+dy*start+dx*depth)]
    lot=Polygon(corners).intersection(block)
    if taken:lot=lot.difference(unary_union(taken))
    candidates=parts(lot)
    if not candidates:continue
    lot=max(candidates,key=lambda p:p.area)
    if lot.area<45 or lot.area<front*depth*.40:continue
    # A retained frontage is required after clipping neighbours and irregular corners.
    front_line=LineString(corners[:2])
    if lot.boundary.intersection(front_line.buffer(.03)).length<min(5,front*.5):continue
    footprint=lot.buffer(-.5,join_style=2)
    if footprint.is_empty:continue
    footprint=max(parts(footprint),key=lambda p:p.area)
    if footprint.area<32:continue
    architecture='compact-row-house'if district=='lower'else 'warehouse'if district=='quay'else 'shop-house'if district=='market'else 'courtyard-mansion'if district=='noble_west'else 'street-house'
    if district=='noble_west':
     def local_rect(x0,x1,y0,y1):
      return Polygon([(a[0]+dx*(start+x)-dy*y,a[1]+dy*(start+x)+dx*y)for x,y in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]])
     wing_shapes=[local_rect(.8,front-.8,depth*.58,depth-.8),local_rect(.8,7,8,depth*.58),local_rect(front-7,front-.8,8,depth*.58)]
     wings=unary_union(wing_shapes)
     footprint=footprint.intersection(wings)
     if footprint.is_empty or footprint.area<100:continue
    components=[g for w in wing_shapes for g in parts(w.intersection(footprint))if g.area>5]if district=='noble_west'else parts(footprint)
    pid='parcel_'+key.replace(':','_');height=hlo+(hhi-hlo)*rand(key+'height')
    entry=dict(id=pid,blockId=bid,district=district,frontageRouteId=road['id'],heightM=height,groundM=z,garden=mapping(lot.difference(footprint))if district=='noble_west'else None,architecture=architecture,frontageM=front,depthM=depth,frontagePoints=corners[:2],geometry=mapping(lot),footprint=mapping(max(components,key=lambda p:p.area)),footprints=[mapping(g)for g in components])
    entry_line=LineString([(a[0]+dx*(start+front/2),a[1]+dy*(start+front/2)),(a[0]+dx*(start+front/2)-dy*depth,a[1]+dy*(start+front/2)+dx*depth)])
    facade_hits=entry_line.intersection(footprint.boundary)
    hit_points=[g for g in getattr(facade_hits,'geoms',[facade_hits])if g.geom_type=='Point']
    if hit_points:
     door=min(hit_points,key=lambda g:g.distance(Point(entry_line.coords[0])))
     entry['door']={'point':[door.x,door.y,z],'along':[dx,dy],'outward':[dy,-dx]}
    entry['roofs']=[arch_geometry.pitched_roof(g,z+height,district)for g in components]
    if district=='noble_west':
     center=front/2
     walk=local_rect(center-1.8,center+1.8,0,depth*.58).intersection(lot).difference(footprint)
     entry['entryWalk']=mapping(walk)
    parcels.append(entry);bp.append(pid);taken.append(lot)
  courtyard=block.difference(unary_union(taken))if taken else block
  blocks.append(dict(id=bid,heightM=z,areaM2=block.area,geometry=mapping(block),courtyards=mapping(courtyard),parcelIds=bp))
audit={'blockCount':len(blocks),'parcelCount':len(parcels),'status':'REVIEW_ONLY','buildingFlatRoadOverlapM2':None,'limitations':['Massing only. Doors, courtyard access, roof collision, sight corridors, canonical facility reservations and density acceptance still required.']}
# Construction invariant: no lot escapes its parent block or crosses reserved streets.
B={b['id']:shape(b['geometry'])for b in blocks}
for p in parcels:
 excess=shape(p['geometry']).difference(B[p['blockId']]).area
 if excess>1e-5:raise ValueError('Parcel escapes block: '+p['id'])
# Measure flat-road overlap instead of reporting a presumed construction invariant.
road_by_z={}
for r in data['routes']:
 if abs(r['z0']-r['z1'])<.01:
  pts=r['points']
  for start in range(0,len(pts)-1,12):
   piece=LineString([q[:2]for q in pts[start:start+13]]).buffer(r['width']/2,join_style=2)
   road_by_z.setdefault(round(r['z0'],2),[]).append(piece)
road_by_z={z:(gs,STRtree(gs))for z,gs in road_by_z.items()}
overlap=0
for p in parcels:
 indexed=road_by_z.get(round(p['groundM'],2))
 if indexed is not None:
  gs,tree=indexed
  for f in p['footprints']:
   footprint=shape(f);near=tree.query(footprint)
   if len(near):overlap+=footprint.intersection(unary_union([gs[int(j)]for j in near])).area
audit['buildingFlatRoadOverlapM2']=round(overlap,6)
if overlap>.01:raise ValueError('Buildings overlap flat roads: '+str(overlap))
out=src.with_name('parcels.json');out.write_text(json.dumps(dict(blocks=blocks,parcels=parcels,audit=audit,castleSite=arch_geometry.castle_site(data)),separators=(',',':')));print(json.dumps(audit))
