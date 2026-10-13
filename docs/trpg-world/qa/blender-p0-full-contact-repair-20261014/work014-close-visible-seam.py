import pathlib,json,sys,hashlib
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import Polygon,LineString,shape
from shapely.ops import unary_union
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-contact.staged.plan.json').read_text('utf8'))
D={d['id']:shape(d['geometry']) for d in P['landDomains']}
ns={};exec((R/'author-user-F01-F08-v23.py').read_text('utf-8-sig').split('cases=')[0],ns)
seam=LineString([(299.2,1274.9),(307.5,1267.7)]).buffer(1.5,cap_style=2,join_style=2)
print('CONTACTS',seam.area,seam.intersection(D['upper_city']).area,seam.intersection(D['low_city']).area,flush=True)
def flat(m,z):
 ps=[]
 for f in m['faces']:
  v=[m['vertices'][i] for i in f]
  if all(abs(a[2]-z)<.06 for a in v):
   q=Polygon([a[:2] for a in v])
   if q.is_valid and q.area>1e-7:ps.append(q)
 return unary_union(ps)
low=unary_union([flat(m,14) for m in P['meshes'] if any(t in m['name'] for t in ('ground','infill','lowland','mass_v18'))])
print('LOW_MISSING',seam.difference(low).area,flush=True)
assert seam.intersection(D['upper_city']).area>5
assert seam.intersection(low).area>5
for r in P['routes']:
 l=LineString([v[:2] for v in r['points']])
 assert l.distance(seam)>r.get('width',2)/2+1,(r['id'],'seam blocks route')
P['meshes'].append(ns['volume'](seam,'work014_upper_city_retaining_seam',112,13.7))
soil=seam.buffer(1,join_style=2)
assert soil.intersection(low).area>5
P['meshes'].append(ns['volume'](soil,'work014_upper_city_seam_foundation_ground',14,11.4))
P['work014WallBaseRepair']['visibleSeamLengthM']=10.99
P['work014WallBaseRepair']['visibleSeamHighContactM2']=seam.intersection(D['upper_city']).area
P['work014WallBaseRepair']['visibleSeamLowContactM2']=soil.intersection(low).area
out=R/'work014-p0-sealed.staged.plan.json';assert not out.exists()
out.write_text(json.dumps(P,separators=(',',':')),encoding='utf8')
print('SEALED_STAGE_SAVED',flush=True)
