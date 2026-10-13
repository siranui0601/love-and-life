import json,pathlib,sys
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import LineString,Point,shape,box
from mathutils import Vector
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');P=json.loads((R/'work014-p0-sealed.staged.plan.json').read_text('utf8'))
loc=Vector((-792,1175,148));rot=(Vector((-654.298,1076.59,25))-loc).to_track_quat('-Z','Y')
origin=loc+(rot@Vector((1,0,0)))*((156/770-.5)*275)+(rot@Vector((0,1,0)))*((.5-205/511)*275*511/770)
dir=rot@Vector((0,0,-1));line=LineString([origin[:2],(origin+dir*1000)[:2]])
D={d['id']:shape(d['geometry']) for d in P['landDomains']};g=line.intersection(D['noble_west'].boundary)
print('CROSSINGS',g.wkt,flush=True)
for q in ([g] if g.geom_type=='Point' else list(g.geoms)):
 if q.geom_type!='Point':continue
 print('EDGE',q.wkt,D['noble_west'].boundary.intersection(q.buffer(12)).wkt,flush=True)
 for r in P['routes']:
  l=LineString([p[:2] for p in r['points']])
  if l.distance(q)<12:print('NEAR_ROUTE',r['id'],r.get('width'),r['points'],flush=True)
