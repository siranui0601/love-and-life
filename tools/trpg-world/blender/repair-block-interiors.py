"""Split overdeep residential blocks through measured residual land.
Works on saved plan/parcels, preserves canonical sites and authored negative space.
It never labels unassigned leftovers as successful public courtyards.
"""
import json,math,pathlib,sys
from shapely.geometry import shape,Point,LineString,mapping
from shapely.ops import unary_union,nearest_points,polylabel
from shapely import constrained_delaunay_triangles
src=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing study protected')
plan=json.loads((src/'plan.json').read_text(encoding='utf-8'));data=json.loads((src/'parcels.json').read_text(encoding='utf-8'))
def parts(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for q in getattr(g,'geoms',[])for p in parts(q)]
canonical=[p for p in data['parcels']if p.get('canonicalFacilityId')]
plan['facilityParcels']=canonical
protected=unary_union([shape(g)for g in plan['negativeSpaces']]+[shape(p['geometry']).buffer(3)for p in canonical])
plan['negativeSpaces'] += [p['geometry']for p in canonical]
by_block={b['id']:[]for b in data['blocks']}
for p in data['parcels']:
 if not p.get('canonicalFacilityId'):by_block[p['blockId']].append(p)
roads_by_z={}
for r in plan['routes']:
 if abs(r['z0']-r['z1'])<.01:roads_by_z.setdefault(r['z0'],[]).append((r,LineString([p[:2]for p in r['points']])))
domains={d['heightM']:shape(d['geometry'])for d in plan['landDomains']}
review=[];created=[]
for block in data['blocks']:
 parcels=by_block[block['id']]
 if not parcels or any(p.get('canonicalFacilityId')for p in parcels):continue
 # Palace/upper precincts and noble gardens need authored private estate treatment.
 if block['heightM'] not in [14,42,70]:continue
 geom=shape(block['geometry']);residual=geom.difference(unary_union([shape(p['geometry'])for p in parcels]))
 holes=[p for p in parts(residual)if p.area>700]
 if not holes:continue
 hole=max(holes,key=lambda p:p.area);centre=polylabel(hole,tolerance=1);radius=centre.distance(hole.boundary)
 if radius<13:continue
 z=block['heightM'];candidates=[]
 # Test both principal axes. Endpoints snap to real same-level street centrelines.
 rect=list(geom.minimum_rotated_rectangle.exterior.coords)
 for a,b in list(zip(rect,rect[1:]))[:2]:
  length=math.dist(a,b);ux=(b[0]-a[0])/length;uy=(b[1]-a[1])/length
  probe=LineString([(centre.x-ux*5000,centre.y-uy*5000),(centre.x+ux*5000,centre.y+uy*5000)])
  intersect=probe.intersection(geom)
  spans=[intersect]if intersect.geom_type=='LineString'else list(getattr(intersect,'geoms',[]))
  for span in spans:
   if span.geom_type!='LineString' or span.distance(centre)>1:continue
   ends=[];ids=[]
   for endpoint in [Point(span.coords[0]),Point(span.coords[-1])]:
    opts=[(endpoint.distance(line),r,line)for r,line in roads_by_z[z]]
    _,road,line=min(opts,key=lambda v:v[0]);q=nearest_points(endpoint,line)[1]
    if q.distance(endpoint)>12:break
    ends.append(q);ids.append(road['id'])
   if len(ends)!=2 or ends[0].distance(ends[1])<25:continue
   path=LineString([ends[0],centre,ends[1]]);corridor=path.buffer(2,cap_style=2,join_style=2)
   if not path.is_simple or corridor.difference(domains[z].buffer(.05)).area>.01:continue
   if corridor.intersection(protected).area>.01:continue
   # Prevent cutting another block or bridging unrelated land between snapped ends.
   if path.difference(geom.buffer(12)).length>.01:continue
   candidates.append((path.length,path,ids))
 entry=dict(blockId=block['id'],heightM=z,residualAreaM2=round(hole.area,2),residualRadiusM=round(radius,2))
 if not candidates:entry['status']='UNRESOLVED_NO_SAFE_TWO_ENDED_ROUTE';review.append(entry);continue
 _,path,ids=min(candidates,key=lambda p:p[0]);rid='interior_life_'+src.name+'_'+block['id']
 points=[[p.x,p.y,z]for p in [path.interpolate(i/max(2,math.ceil(path.length/4)),normalized=True)for i in range(max(2,math.ceil(path.length/4))+1)]]
 route=dict(id=rid,kind='alley',width=4,points=points,z0=z,z1=z,lengthM=path.length,grade=0,role='optional-life',reason='Overdeep block subdivision; real street-to-street connection',parentBlockId=block['id'],endStreetIds=ids)
 plan['routes'].append(route);created.append(route)
 paving=path.buffer(2,cap_style=2,join_style=2);v=[];f=[]
 for t in constrained_delaunay_triangles(paving).geoms:
  i=len(v);v.extend([[x,y,z+.10]for x,y in list(t.exterior.coords)[:3]]);f.append([i,i+1,i+2])
 plan['meshes'].append(dict(name=rid,vertices=v,faces=f,material='lane'))
 entry.update(status='SUBDIVIDED_REQUIRES_REPARCELLATION',routeId=rid,routeLengthM=round(path.length,2));review.append(entry)
plan['audit']['routeCount']=len(plan['routes']);plan['blockInteriorReview']=review
(out/'plan.json').write_text(json.dumps(plan,separators=(',',':')),encoding='utf-8')
report=dict(status='REQUIRES_VISUAL_AND_COLLISION_REVIEW',affectedBlockCount=len(review),newRouteCount=len(created),unresolvedCount=sum(r['status'].startswith('UNRESOLVED')for r in review),review=review)
(out/'block-interior-audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items()if k!='review'}))
