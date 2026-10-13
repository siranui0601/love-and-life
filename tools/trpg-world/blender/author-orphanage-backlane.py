"""A second everyday access to the orphanage, around its wings, on shared streets.
No noble bypass, NPC teleport or new canonical facility is introduced.
"""
import json,pathlib,sys,math
from shapely.geometry import shape,Point,LineString
from shapely.ops import unary_union,nearest_points
from shapely import constrained_delaunay_triangles
src=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing study protected')
plan=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text());fid='LOC_CAP_ORPHANAGE'
p=next(p for p in data['parcels']if p.get('canonicalFacilityId')==fid);a,b=p['frontagePoints'];w=p['frontageM'];depth=p['depthM'];ux=(b[0]-a[0])/w;uy=(b[1]-a[1])/w;cx=(a[0]+b[0])/2;cy=(a[1]+b[1])/2
pt=lambda x,y:(cx+ux*x-uy*y,cy+uy*x+ux*y)
entry=next(r for r in plan['routes']if r['id']==fid+'_public_entry');start=Point(entry['points'][-1][:2]);domain=next(shape(d['geometry'])for d in plan['landDomains']if d['heightM']==14)
forbidden=unary_union([shape(f)for q in data['parcels']if q.get('canonicalFacilityId')for f in q['footprints']]+[shape(g)for g in plan['negativeSpaces']if shape(g).intersection(shape(p['geometry'])).area<.01])
options=[]
for side in [-1,1]:
 corner=Point(pt(side*(w/2+3),depth+3))
 roads=[r for r in plan['routes']if r['z0']==r['z1']==14 and r['id']not in [entry['id'],p['frontageRouteId']] and not r['id'].startswith('LOC_CAP_')]
 for r in roads:
  line=LineString([v[:2]for v in r['points']]);end=nearest_points(corner,line)[1]
  if end.distance(corner)>65:continue
  path=LineString([start,pt(0,5),pt(side*(w/2+3),5),corner,end]);corridor=path.buffer(1.4,join_style=2)
  if not path.is_simple or corridor.difference(domain).area>.01 or corridor.intersection(forbidden).area>.01:continue
  options.append((path.length,path,r['id']))
if not options:raise RuntimeError('No safe rear connection; manual design required')
_,path,target=min(options,key=lambda v:v[0]);corridor=path.buffer(1.4,join_style=2);removed=[];retained=[]
for q in data['parcels']:
 if q['groundM']==14 and not q.get('canonicalFacilityId')and shape(q['geometry']).intersects(corridor.buffer(.8)):removed.append(q['id'])
 else:retained.append(q)
data['parcels']=retained
for block in data['blocks']:block['parcelIds']=[i for i in block['parcelIds']if i not in removed]
rid=fid+'_backlane';ps=[]
for a,b in zip(list(path.coords),list(path.coords)[1:]):
 n=max(1,math.ceil(math.dist(a,b)/2))
 ps.extend([[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,14]for i in range(n)])
ps.append([*path.coords[-1],14])
plan['routes'].append(dict(id=rid,kind='alley',width=2.8,points=ps,z0=14,z1=14,lengthM=path.length,grade=0,role='optional-life',canonicalFacilityId=fid,endStreetIds=[entry['id'],target],beats=['refuge','decision'],purpose='Everyday child/caretaker access, witnesses in T10/T11; no secret information advertised'))
v=[];f=[]
for t in constrained_delaunay_triangles(corridor).geoms:
 i=len(v);v.extend([[x,y,14.16]for x,y in list(t.exterior.coords)[:3]]);f.append([i,i+1,i+2])
plan['meshes'].append(dict(name=rid,vertices=v,faces=f,material='lane'))
report=dict(status='REQUIRES_3D_REVIEW',routeId=rid,lengthM=path.length,connectedStreet=target,removedParcels=removed,canonicalPlotUnchanged=True,limitations=['No NPC schedules or event logic implemented','Rear path is public circulation, not access to noble precincts'])
plan['orphanageBacklane']=report;plan['audit']['routeCount']=len(plan['routes']);data['audit']['parcelCount']=len(retained)
for name,value in [('plan.json',plan),('parcels.json',data),('orphanage-backlane-audit.json',report)]: (out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps(report))
