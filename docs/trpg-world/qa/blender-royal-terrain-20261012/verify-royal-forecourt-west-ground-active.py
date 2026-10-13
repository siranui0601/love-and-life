import json,pathlib,math
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
m={x['name']:x for x in p['meshes']}
def poly(n):
 ob=m[n];v=ob['vertices'];ps=[]
 for f in ob['faces']:
  q=[v[i]for i in f]
  if max(x[2]for x in q)-min(x[2]for x in q)>.03:continue
  t=Polygon([x[:2]for x in q])
  if t.is_valid and t.area>.01:ps.append(t)
 return unary_union(ps)
native=poly('upper_city_ground')
new=poly('repair_royal_forecourt_west_lower_ground_apron_20261012')
supported=unary_union([native,new])
wall=m['repair_royal_forecourt_west_solid_retaining_20261012']['vertices']
checks=[]
for i in range(0,len(wall),8):
 a=wall[i];b=wall[i+2];pt=Point((a[0]+b[0])/2,(a[1]+b[1])/2)
 checks.append(round(supported.distance(pt),4))
res={'wallBaseSamples':len(checks),'footSupported':sum(d<.2 for d in checks),
 'maxFootGap':max(checks),'newLowGroundArea':round(new.area,1),'nativeLowOverlapArea':round(new.intersection(native).area,1),
 'status':'CLEAR'if max(checks)<.2 and new.intersection(native).area>200 else 'FAIL'}
(root/'royal-forecourt-west-20261012.active-ground-qa.json').write_text(json.dumps(res,indent=2))
print('FOOTING',json.dumps(res),flush=True)
