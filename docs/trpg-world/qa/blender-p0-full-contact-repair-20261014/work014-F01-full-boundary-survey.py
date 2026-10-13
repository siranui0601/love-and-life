import pathlib,json,sys
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import shape,Point,LineString,box
from shapely.ops import unary_union,linemerge
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');P=json.loads((R/'work014-p0-final.staged.plan.json').read_text('utf8'))
D={d['id']:shape(d['geometry']) for d in P['landDomains']};lines=[]
for m in P['meshes']:
 if not any(s in m['name'] for s in ('retaining','wall_bedrock','seam')):continue
 for f in m['faces']:
  vs=[m['vertices'][i] for i in f];q=[]
  for a,b in zip(vs,vs[1:]+vs[:1]):
   if (a[2]-35)*(b[2]-35)<0:
    t=(35-a[2])/(b[2]-a[2]);q.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
  if len(q)==2:lines.append(LineString(q))
edge=D['noble_west'].boundary.intersection(box(-720,1030,-450,1210))
missing=edge.difference(unary_union(lines).buffer(2))
parts=list(missing.geoms) if missing.geom_type=='MultiLineString' else [missing]
for g in parts:
 if g.length>1:
  print('GAP',g.length,list(g.coords)[0],list(g.coords)[-1],g.distance(Point(-582.82835,1126.03814)),flush=True)
