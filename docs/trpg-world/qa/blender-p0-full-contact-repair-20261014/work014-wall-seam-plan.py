import json,pathlib,sys
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import Polygon,LineString,shape,box
from shapely.ops import unary_union
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-contact.staged.plan.json').read_text('utf8'))
D={d['id']:shape(d['geometry']) for d in P['landDomains']}
print('DOMAIN',D['upper_city'].boundary.intersection(box(250,1220,360,1365)).wkt)
lines=[]
for m in P['meshes']:
 for f in m['faces']:
  v=[m['vertices'][i] for i in f];q=[]
  for a,b in zip(v,v[1:]+v[:1]):
   if (a[2]-35)*(b[2]-35)<0:
    t=(35-a[2])/(b[2]-a[2]);q.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
  if len(q)==2:lines.append(LineString(q))
edge=D['upper_city'].boundary.intersection(box(270,1235,335,1325))
missing=edge.difference(unary_union(lines).buffer(.25))
print('MISSING',missing.wkt,missing.length)
for r in P['routes']:
 line=LineString([v[:2] for v in r['points']])
 if line.distance(missing)<10:print('ROUTE',r['id'],r.get('width'),r['points'])
