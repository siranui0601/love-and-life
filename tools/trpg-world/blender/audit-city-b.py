"""Reject disconnected streets and inspect grade-separated intersections.
This geometry audit does not certify playability or visual acceptance.
"""
import json,sys,pathlib,math,bisect
from shapely.geometry import LineString,Point
from shapely.strtree import STRtree
source=pathlib.Path(sys.argv[1]);data=json.loads(source.read_text());rs=[r for r in data['routes']if not ('--flood'in sys.argv and r.get('floodClosed'))]
lines=[LineString([p[:2]for p in r['points']])for r in rs];tree=STRtree(lines)
parent=list(range(len(rs)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
def join(a,b):parent[root(a)]=root(b)
def points(g):
 if g.is_empty:return []
 if g.geom_type=='Point':return [g]
 if g.geom_type=='LineString':return [Point(g.coords[0]),Point(g.coords[-1])]
 return [p for q in getattr(g,'geoms',[])for p in points(q)]
distances=[]
for r in rs:
 d=[0]
 for a,b in zip(r['points'],r['points'][1:]):d.append(d[-1]+math.dist(a[:2],b[:2]))
 distances.append(d)
def z(i,p):
 d=lines[i].project(p);ds=distances[i];k=min(len(ds)-2,max(0,bisect.bisect_right(ds,d)-1));a,b=rs[i]['points'][k:k+2]
 return a[2]+(b[2]-a[2])*(d-ds[k])/max(1e-9,ds[k+1]-ds[k])
separated=[];junctions=0
for i,line in enumerate(lines):
 for j in tree.query(line.buffer(.05)):
  j=int(j)
  if j<=i:continue
  ps=points(line.intersection(lines[j]))
  # Floating point coordinates may leave an endpoint below 5cm from its target.
  if not ps and line.distance(lines[j])<.05:
   from shapely.ops import nearest_points
   ps=[nearest_points(line,lines[j])[0]]
  for p in ps:
   dz=abs(z(i,p)-z(j,p))
   if dz<.3:join(i,j);junctions+=1
   else:separated.append({'a':rs[i]['id'],'b':rs[j]['id'],'heightDifferenceM':round(dz,3)})
components={}
for i,r in enumerate(rs):components.setdefault(root(i),[]).append(r['id'])
groups=sorted(components.values(),key=len,reverse=True)
stair_checks=[]
for r in rs:
 if r['kind']!='stairs':continue
 segments=[(math.dist(a[:2],b[:2]),abs(b[2]-a[2])) for a,b in zip(r['points'],r['points'][1:])]
 rises=[rise for run,rise in segments if rise>1e-6];runs=[run for run,rise in segments if rise>1e-6]
 landings=[run for run,rise in segments if rise<1e-6 and run>1]
 stair_checks.append({'id':r['id'],'maxRiserM':max(rises),'minTreadRunM':min(runs),'landingCount':len(landings),'minLandingM':min(landings) if landings else None,'pass':max(rises)<=.170001 and min(runs)>=.28 and len(landings)==r.get('landingCount')})
result={'status':'REQUIRES_3D_REVIEW'if len(groups)==1 and all(s['pass'] for s in stair_checks) else 'FAIL','centrelineConnectivityPass':len(groups)==1,'stairProfileChecks':stair_checks,'routeCount':len(rs),'componentCount':len(groups),'componentSizes':[len(g)for g in groups],'disconnectedGroups':groups[1:],'sameLevelIntersections':junctions,'gradeSeparatedCrossings':separated,'limitations':['Road centreline connectivity only; full-width collisions and ramp transitions require 3D checks.','No event state, social gate, NPC or canonical facility reachability certification.']}
output=source.with_name('connectivity-flood-audit.json'if '--flood'in sys.argv else 'connectivity-audit.json');output.write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items()if k not in ['disconnectedGroups','gradeSeparatedCrossings','limitations','stairProfileChecks']}))
