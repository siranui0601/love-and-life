"""User-requested burial-ground concept, not a canonical facility addition.
A quiet gated side destination with a walkable loop; preserves the existing city.
"""
import json,pathlib,sys,math
from shapely.geometry import Polygon,Point,LineString,shape
from shapely.ops import nearest_points,unary_union
from shapely import constrained_delaunay_triangles
src=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
if (out/'plan.json').exists():raise RuntimeError('Existing study protected')
plan=json.loads((src/'plan.json').read_text());data=json.loads((src/'parcels.json').read_text());plot=Polygon([(610,1160),(690,1160),(690,1220),(610,1220)])
if not shape(plan['landscapeStudy']['geometry']).covers(plot.buffer(2)):raise RuntimeError('Concept outside reserved landscape')
roads=[r for r in plan['routes']if r['kind']=='garden_walk'];gate=Point(690,1190)
r,line=min([(r,LineString([p[:2]for p in r['points']]))for r in roads],key=lambda pair:pair[1].distance(gate));connection=nearest_points(gate,line)[1]
entry=LineString([connection,(740,1230),(713,1210),(705,1190),gate,(674,1190)])
loop=LineString([(674,1190),(674,1182),(626,1182),(626,1205),(674,1205),(674,1190)])
if not shape(plan['landscapeStudy']['geometry']).covers(entry.buffer(2)):raise RuntimeError('Entry outside landscape')
for p in data['parcels']:
 if shape(p['geometry']).intersects(plot.union(entry.buffer(2))):raise RuntimeError('Concept overlaps parcel')
for name,path,width in [('burial_study_entry',entry,3),('burial_study_loop',loop,2.4)]:
 ps=[]
 for a,b in zip(list(path.coords),list(path.coords)[1:]):
  n=max(1,math.ceil(math.dist(a,b)/2));ps.extend([[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n,14]for i in range(n)])
 ps.append([*path.coords[-1],14]);plan['routes'].append(dict(id=name,kind='life',width=width,points=ps,z0=14,z1=14,lengthM=path.length,grade=0,role='optional-life',designStatus='USER_REQUESTED_CONCEPT_NOT_CANON',beats=['compression','refuge','reveal']))
 def surface(name,poly,z,mat):
  v=[];f=[]
  for t in constrained_delaunay_triangles(poly).geoms:
   k=len(v);v.extend([[x,y,z]for x,y in list(t.exterior.coords)[:3]]);f.append([k,k+1,k+2])
  plan['meshes'].append(dict(name=name,vertices=v,faces=f,material=mat))
 surface(name,path.buffer(width/2,join_style=2),14.2,'lane')
# A low enclosure frames entry; the gate is a real 4m gap, not a painted door.
def box(name,x,y,z,w,d,h):
 v=[[x+a*w/2,y+b*d/2,z+c*h]for c in [0,1]for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 plan['meshes'].append(dict(name=name,vertices=v,faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material='stone'))
box('burial_study_west_enclosure',610,1190,14,1,60,1.8);box('burial_study_north_enclosure',650,1220,14,80,1,1.8);box('burial_study_south_enclosure',650,1160,14,80,1,1.8)
for y in [1174,1206]:box('burial_study_gate_flank_'+str(y),690,y,14,1,28,1.8)
# Uninscribed stones avoid inventing named dead, religion, dates or historical events.
for row,y in enumerate([1167,1173,1189,1196,1213]):
 for col,x in enumerate([616,622,634,640,660,666,678,684]):
  p=Point(x,y)
  if min(p.distance(entry),p.distance(loop))<2:continue
  box('burial_study_marker_'+str(row)+'_'+str(col),x,y,14,1,.45,.8+(col%3)*.15)
clear=plot.buffer(3).union(entry.buffer(5));plan['landscapeStudy']['trees']=[t for t in plan['landscapeStudy']['trees']if Point(t['position'][:2]).distance(clear)>t['radiusM']]
for x,y in [(617,1178),(618,1209),(639,1216),(657,1216),(677,1216)]:
 if min(Point(x,y).distance(entry),Point(x,y).distance(loop))>5:
  plan['landscapeStudy']['trees'].append(dict(position=[x,y,14],heightM=8,radiusM=2.5))
plan['burialCourtStudy']=dict(status='PROPOSED_NOT_CANON',source='User suggestion 2026-10-08',plot=list(plot.exterior.coords),gate=[690,1190,14],entryFrom=r['id'],intendedExperience='Quiet side destination: enclosure hides low grave markers until entry; loop enables discovery without becoming a fast shortcut',limitations=['No named dead, religion or new facility ID','No NPC mourning schedule or event added','Concept requires eye-level acceptance'])
plan['audit']['routeCount']=len(plan['routes'])
for name,value in [('plan.json',plan),('parcels.json',data),('burial-court-study.json',plan['burialCourtStudy'])]:(out/name).write_text(json.dumps(value,separators=(',',':')))
print(json.dumps(plan['burialCourtStudy']))
