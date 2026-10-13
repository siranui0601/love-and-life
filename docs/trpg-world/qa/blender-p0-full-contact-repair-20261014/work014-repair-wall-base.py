import pathlib,json,sys,hashlib
sys.path.insert(0,r'C:\Users\inaba\Documents\TRPG-Capital-Blender\python-deps')
from shapely.geometry import Polygon
from shapely.ops import unary_union
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
src=R/'user-p0-multisite-v23.staged.plan.json'
P=json.loads(src.read_text('utf8'));M={m['name']:m for m in P['meshes']}
def flat(m,z):
 out=[]
 for f in m['faces']:
  vs=[m['vertices'][i] for i in f]
  if all(abs(v[2]-z)<.06 for v in vs):
   p=Polygon([v[:2] for v in vs])
   if p.is_valid and p.area>1e-7:out.append(p)
 return unary_union(out)
wall=flat(M['repair_user_p0_W03_retaining_20261012'],14)
low=unary_union([flat(m,14) for m in P['meshes'] if any(t in m['name'] for t in ('ground','infill','lowland','mass_v18'))])
gap=wall.difference(low)
assert 30<gap.area<36,gap.area
old=M['repair_user_p0_W03_TOE_ground_20261012']
base=flat(old,14);extended=unary_union([base,gap.buffer(.35,join_style=2)]).buffer(0)
assert extended.geom_type=='Polygon' and extended.intersection(base).area>500
ns={}
exec((R/'author-user-F01-F08-v23.py').read_text('utf8').split('cases=')[0],ns)
new=ns['volume'](extended,old['name'],14,11.4)
P['meshes']=[new if m['name']==old['name'] else m for m in P['meshes']]
remaining=wall.difference(unary_union([low,flat(new,14)])).area
assert remaining<.002,remaining
P['work014WallBaseRepair']=dict(sourceSHA256=hashlib.sha256(src.read_bytes()).hexdigest(),canonicalSHA256=hashlib.sha256((R/'plan.json').read_bytes()).hexdigest(),mesh=old['name'],unsupportedBeforeM2=gap.area,unsupportedAfterM2=remaining,oldAreaM2=base.area,newAreaM2=extended.area)
out=R/'work014-p0-contact.staged.plan.json';assert not out.exists()
out.write_text(json.dumps(P,separators=(',',':')),encoding='utf8')
(R/'work014-p0-contact-qa.json').write_text(json.dumps(P['work014WallBaseRepair'],indent=2),encoding='utf8')
print(json.dumps(P['work014WallBaseRepair']),flush=True)
