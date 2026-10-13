import json,pathlib,sys
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import Point,shape,Polygon,LineString
from shapely.ops import unary_union
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');P=json.loads((R/'work014-p0-sealed.staged.plan.json').read_text('utf8'))
D={d['id']:shape(d['geometry']) for d in P['landDomains']}
line=D['noble_west'].boundary.intersection(Point(-582.82835,1126.03814).buffer(12))
assert line.geom_type=='LineString'
wall=line.buffer(1.5,cap_style=2,join_style=2);soil=wall.buffer(1,join_style=2)
for r in P['routes']:
 l=LineString([p[:2] for p in r['points']])
 assert l.distance(wall)>r.get('width',2)/2+1,r['id']
ns={};exec((R/'author-user-F01-F08-v23.py').read_text('utf-8-sig').split('cases=')[0],ns)
assert wall.intersection(D['noble_west']).area>20
assert soil.intersection(D['low_city']).area>20
for poly,name,hi,lo in [(wall,'work014_noble_west_adjacent_seam',78,13.7),(soil,'work014_noble_west_seam_foundation_ground',14,11.4)]:
 P['meshes'].append(ns['volume'](poly,name,hi,lo))
P['work014WallBaseRepair']['nobleAdjacentSeamLengthM']=line.length
(R/'work014-p0-final.staged.plan.json').write_text(json.dumps(P,separators=(',',':')),encoding='utf8')
print('NOBLE_SEAM_CONTACT',wall.intersection(D['noble_west']).area,soil.intersection(D['low_city']).area,flush=True)
