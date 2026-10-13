"""A small backcourt market, selected from genuinely connected free block land.
No slave-market institution or canonical IDs are added.
"""
import json,sys,pathlib,math
from shapely.geometry import Point,LineString,shape,mapping
from shapely.ops import unary_union,nearest_points,polylabel
from shapely.strtree import STRtree
from shapely import constrained_delaunay_triangles
src,out=map(pathlib.Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing version protected')
p=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text())
owners=[b for b in data['parcels']for f in b['footprints']]
footprints=[shape(f)for b in data['parcels']for f in b['footprints']];tree=STRtree(footprints)
canonical=unary_union([shape(b['geometry'])for b in data['parcels']if b.get('canonicalFacilityId')])
roads=[(r,LineString([q[:2]for q in r['points']]))for r in p['routes']if r['z0']==r['z1']==14 and r['kind']in['life','secondary','contour']]
def parts(g):
 if g.is_empty:return[]
 if g.geom_type=='Polygon':return[g]
 return[q for v in getattr(g,'geoms',[])for q in parts(v)]
def blocked(g):return canonical.intersects(g)or any(footprints[int(i)].intersects(g)for i in tree.query(g))
options=[]
for b in data['blocks']:
 if b['heightM']!=14 or b['id'].startswith('site_'):continue
 block=shape(b['geometry']);indices=tree.query(block);free=block.difference(unary_union([footprints[int(i)].buffer(2)for i in indices])).difference(canonical)
 for space in parts(free):
  if space.area<500:continue
  c=polylabel(space,tolerance=1)
  if not -900<c.x<800 or not -1100<c.y<-200 or c.distance(space.boundary)<13:continue
  entries=[]
  for r,l in sorted(roads,key=lambda pair:pair[1].distance(c))[:16]:
   q=nearest_points(c,l)[1];path=LineString([(q.x,q.y),(c.x,c.y)])
   if path.length>100 or canonical.intersects(path.buffer(1.8)):continue
   hits=[int(i)for i in tree.query(path.buffer(1.8))if footprints[int(i)].intersects(path.buffer(1.8))]
   removed={owners[i]['id'] for i in hits}
   # Open a deliberately reserved market entrance in at most one modest frontage
   # parcel; never bulldoze a row or any canonical site to fill an interior.
   if len(removed)>1 or sum(footprints[i].area for i in hits)>400:continue
   entries.append((r,path))
  if entries:options.append((min(path.length for _,path in entries)+abs(c.x+500)*.03+abs(c.y+650)*.03,c,entries,b['id']))
if not options:raise RuntimeError('No reachable free backcourt: do not fill an inaccessible void')
_,c,entries,bid=min(options,key=lambda q:q[0]);entries=entries[:1];v=[];f=[]
entrance=entries[0][1].buffer(1.8)
removed={owners[int(i)]['id']for i in tree.query(entrance)if footprints[int(i)].intersects(entrance)}
data['parcels']=[b for b in data['parcels']if b['id']not in removed]
for b in data['blocks']:b['parcelIds']=[i for i in b['parcelIds']if i not in removed]
data['audit']['parcelCount']=len(data['parcels'])
def surface(name,poly):
 vs=[];fs=[]
 for tri in constrained_delaunay_triangles(poly).geoms:
  k=len(vs);vs.extend([[x,y,14.22]for x,y in list(tri.exterior.coords)[:3]]);fs.append([k,k+1,k+2])
 p['meshes'].append(dict(name=name,vertices=vs,faces=fs,material='lane'))
def box(name,x,y,z,w,d,h,mat='stone'):
 vs=[[x+a*w/2,y+b*d/2,z+t*h]for t in[0,1]for a,b in[(-1,-1),(1,-1),(1,1),(-1,1)]]
 p['meshes'].append(dict(name=name,vertices=vs,faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material=mat))
surface('backcourt_market_paving',c.buffer(12))
for i,(r,path)in enumerate(entries):
 ps=[[*xy,14]for xy in path.coords];p['routes'].append(dict(id='backcourt_market_entry_'+str(i),kind='life',points=ps,width=3,role='optional-life',z0=14,z1=14,lengthM=path.length,grade=0,beats=['compression','release','reveal']))
 surface('backcourt_market_entry_'+str(i),path.buffer(1.5))
count=0
for i in range(7):
 angle=i*math.tau/7;point=Point(c.x+8.5*math.cos(angle),c.y+8.5*math.sin(angle));plot=point.buffer(2.5)
 if any(path.distance(plot)<2 for _,path in entries)or blocked(plot):continue
 box('backcourt_counter_'+str(i),point.x,point.y,14.22,3.4,1,.85)
 for sign in[-1,1]:box('backcourt_post_'+str(i)+'_'+str(sign),point.x+sign*1.5,point.y,14.22,.15,.15,2.5)
 box('backcourt_awning_'+str(i),point.x,point.y,16.65,3.8,2.7,.15,'garden')
 # Sealed crates/jars are anonymous spatial dressing, not new canonical items.
 for j in range(2):box('backcourt_stock_'+str(i)+'_'+str(j),point.x-1+j*1.5,point.y,15.07,.7,.6,.4,'ground')
 count+=1
p['backcourtMarketStudy']=dict(status='UNACCEPTED',position=[c.x,c.y,14],blockId=bid,entryRoutes=[r['id']for r,_ in entries],frontageParcelsReplaced=sorted(removed),stallCount=count,experience='Small canopy silhouettes draw players through an alley into a close trading court; distinct from the public central market',canon='Anonymous back-lane goods only. Human trafficking canon remains in crime city.',pending=['NPC merchants, rumors and opening times','Specific goods/legality require canonical item mapping'])
p['audit']['routeCount']=len(p['routes'])
for name,value in [('plan.json',p),('parcels.json',data),('backcourt-market-study.json',p['backcourtMarketStudy'])]:(out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps(p['backcourtMarketStudy']))
