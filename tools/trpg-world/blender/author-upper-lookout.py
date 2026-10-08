"""A small higher lookout chosen from real free land and existing streets.
The garden tower stays a local refuge landmark; this site targets lower-city views.
"""
import json,pathlib,sys,math,copy
from shapely.geometry import Point,LineString,Polygon,shape,mapping
from shapely.ops import nearest_points,unary_union
from shapely.strtree import STRtree
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing version protected')
p=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text());domain=next(shape(d['geometry'])for d in p['landDomains']if d['id']=='mage_east')
owners=[b for b in data['parcels']for f in b['footprints']]
footprints=[shape(f)for b in data['parcels']for f in b['footprints']];tree=STRtree(footprints)
canonical=unary_union([shape(b['geometry'])for b in data['parcels']if b.get('canonicalFacilityId')]+[Point(1050,650).buffer(65)])
roads=[(r,LineString([v[:2]for v in r['points']]))for r in p['routes']if r['z0']==r['z1']==70];options=[]
def blocked(g):return canonical.intersects(g)or any(footprints[int(i)].intersects(g)for i in tree.query(g))
for x in range(800,1321,8):
 for y in range(368,851,8):
  c=Point(x,y);plot=c.buffer(12.5)
  if not domain.covers(plot)or canonical.intersects(plot):continue
  if any(l.distance(plot)<r['width']/2+1 for r,l in roads):continue
  r,l=min(roads,key=lambda q:q[1].distance(c));q=nearest_points(c,l)[1]
  entry=LineString([(q.x,q.y),(x,y-6)])
  if entry.intersects(c.buffer(7)):
   sx=-1 if q.x<x else 1
   entry=LineString([(q.x,q.y),(x+sx*10,y-10),(x,y-10),(x,y-6)])
  reserve=plot.union(entry.buffer(1.2))
  if entry.length>60 or not domain.buffer(.1).covers(entry.buffer(1.2))or canonical.intersects(reserve):continue
  hits=[int(i)for i in tree.query(reserve)if footprints[int(i)].intersects(reserve)]
  removed={owners[i]['id']for i in hits}
  if len(removed)>2 or sum(footprints[i].area for i in hits)>900:continue
  options.append((y+abs(x-1120)*.15+entry.length*.2+len(removed)*30,x,y,r,entry,removed))
if not options:raise RuntimeError('No accessible, footprint-clear upper lookout; do not scatter a tower')
_,x,y,road,entry,removed=min(options,key=lambda q:q[0]);data['parcels']=[b for b in data['parcels']if b['id']not in removed]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds']if i not in removed]
data['audit']['parcelCount']=len(data['parcels'])
# Independent 36m tower: real steps/turns, not vertically stretched treads.
zbase=70;height=36;track=[(x,y-6)]
for loop in range(6):track.extend([(x+6,y-6),(x+6,y+6),(x-6,y+6),(x-6,y-6)])
track.append((x+2.5,y-6))
def surface(name,poly,z):
 v=[];f=[]
 for tri in constrained_delaunay_triangles(poly).geoms:
  k=len(v);v.extend([[a,b,z]for a,b in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
 p['meshes'].append(dict(name=name,vertices=v,faces=f,material='stairs'))
def box(name,cx,cy,z,w,d,h):
 v=[[cx+a*w/2,cy+b*d/2,z+c*h]for c in [0,1]for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 p['meshes'].append(dict(name=name,vertices=v,faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material='stone'))
box('upper_watchtower_shaft',x,y,zbase,9,9,height)
surface('upper_watchtower_base',Point(x,y).buffer(12),zbase+.1)
lengths=[math.dist(a,b)for a,b in zip(track,track[1:])];total=sum(lengths);z=zbase;risers=[]
for serial,(a,b,length)in enumerate(zip(track,track[1:],lengths)):
 landing=min(1.9,length*.2);rise=height*length/total;steps=math.ceil(rise/.17);run=length-2*landing
 ps=[[a[0],a[1],z],[a[0]+(b[0]-a[0])*landing/length,a[1]+(b[1]-a[1])*landing/length,z]]
 for j in range(1,steps+1):
  t=(landing+run*j/steps)/length;ps.append([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,z+rise*j/steps])
 ps.append([*b,z+rise]);name='upper_watchtower_flight_'+str(serial)
 p['routes'].append(dict(id=name,points=ps,width=2.1,kind='tower_stairs',z0=z,z1=z+rise,grade=rise/length,lengthM=length,role='optional-life',beats=['reveal','prospect']))
 v=[];f=[];guards=[];gf=[]
 for aa,bb in zip(ps,ps[1:]):
  dx=bb[0]-aa[0];dy=bb[1]-aa[1];d=math.hypot(dx,dy);nx=-dy/d;ny=dx/d;k=len(v)
  v.extend([[aa[0]+sg*nx*1.05,aa[1]+sg*ny*1.05,aa[2]+.16]for sg in [-1,1]]+[[bb[0]+sg*nx*1.05,bb[1]+sg*ny*1.05,aa[2]+.16]for sg in [-1,1]]+[[bb[0]+sg*nx*1.05,bb[1]+sg*ny*1.05,bb[2]+.16]for sg in [-1,1]])
  f.extend([[k,k+1,k+3,k+2],[k+2,k+3,k+5,k+4]])
  mx=(aa[0]+bb[0])/2;my=(aa[1]+bb[1])/2;sign=1 if (mx-x)*nx+(my-y)*ny>0 else -1
  if serial==0 and math.dist(aa[:2],track[0])<3:continue
  k=len(guards);guards.extend([[aa[0]+sign*nx*1.2,aa[1]+sign*ny*1.2,aa[2]+.16],[bb[0]+sign*nx*1.2,bb[1]+sign*ny*1.2,bb[2]+.16],[bb[0]+sign*nx*1.2,bb[1]+sign*ny*1.2,bb[2]+1.36],[aa[0]+sign*nx*1.2,aa[1]+sign*ny*1.2,aa[2]+1.36]]);gf.append([k,k+1,k+2,k+3])
 p['meshes'].extend([dict(name=name,vertices=v,faces=f,material='stairs'),dict(name=name+'_parapet',vertices=guards,faces=gf,material='stone')])
 z+=rise;risers.append(dict(maxRiseM=rise/steps,treadM=run/steps))
 if serial<len(track)-2:surface('upper_watchtower_turn_'+str(serial),Point(*b).buffer(1.05,cap_style=3),z+.16)
deck=Polygon([(x-7.5,y-7.5),(x+7.5,y-7.5),(x+7.5,y+7.5),(x-7.5,y+7.5)])
opening=LineString([track[-3],track[-2],(x+1.7,y-6)]).buffer(1.24,cap_style=2,join_style=2)
surface('upper_watchtower_deck',deck.difference(opening),z+.16)
for side in [-1,1]:
 box('upper_watchtower_deck_side_'+str(side),x+side*7.5,y,z+.16,.4,15,1.2)
 box('upper_watchtower_deck_end_'+str(side),x,y+side*7.5,z+.16,15,.4,1.2)
ps=[[x+2.5,y-6,z],[x+2.5,y,z],[x+5.25,y,z]]
p['routes'].append(dict(id='upper_watchtower_deck_walk',points=ps,width=2.1,kind='life',z0=z,z1=z,grade=0,lengthM=8.75,role='optional-life',beats=['prospect']))
ps=[[*a,70]for a in entry.coords];p['routes'].append(dict(id='upper_watchtower_entry',kind='life',role='optional-life',width=2.4,points=ps,z0=70,z1=70,lengthM=entry.length,grade=0,beats=['decision','reveal','prospect']))
v=[];f=[]
for tri in constrained_delaunay_triangles(entry.buffer(1.2)).geoms:
 k=len(v);v.extend([[a,b,70.16]for a,b in list(tri.exterior.coords)[:3]]);f.append([k,k+1,k+2])
p['meshes'].append(dict(name='upper_watchtower_entry',vertices=v,faces=f,material='lane'))
site=dict(id='mage_river_watchtower',position=[x,y,70],heightM=height,stairs=risers,frontageParcelsReplaced=sorted(removed),entryFrom=road['id'],routeId='upper_watchtower_entry',purpose='Higher terrace lookout toward lower districts and river; requires actual mesh sightline review',status='UNACCEPTED')
reserve=Point(x,y).buffer(12.5).union(entry.buffer(1.2))
p['negativeSpaces'].append(mapping(reserve))
p.setdefault('programmedSpacesStudy',[]).append(dict(id=site['id'],heightM=70,geometry=mapping(reserve),status='PROPOSED_NOT_ACCEPTED',purpose='Lookout base and public entry'))
p['discoverySitesStudy']['destinations'].append(site);p['audit']['routeCount']=len(p['routes'])
for name,value in [('plan.json',p),('parcels.json',data),('upper-lookout-study.json',site)]:(out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps(site))
