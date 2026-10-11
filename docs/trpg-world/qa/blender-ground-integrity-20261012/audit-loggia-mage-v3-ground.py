import json,pathlib,math,collections
from shapely.geometry import Point,Polygon
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'loggia-mage-seam-20261012.v3.staged.plan.json').read_text('utf8'))
ms={x['name']:x for x in plan['meshes']}
def floor(name):
 m=ms[name];v=m['vertices'];ps=[]
 for f in m['faces']:
  xy=[v[i]for i in f]
  if max(t[2]for t in xy)-min(t[2]for t in xy)>.02:continue
  p=Polygon([x[:2]for x in xy])
  if p.is_valid and p.area>.005:ps.append(p)
 return unary_union(ps)
low=unary_union([floor('low_city_ground'),floor('mage_quarter_restored_low_ground'),
                 floor('repair_mage_restored_low_ground_apron_20261012')])
wall=ms['repair_mage_low_terrace_seam_retaining_20261012']
v=wall['vertices'];gaps=[]
for i in range(0,len(v),8):
 a=v[i];b=v[i+2];q=Point((a[0]+b[0])/2,(a[1]+b[1])/2)
 gaps.append(round(low.distance(q),3))
rootPt=Point(599.5,799.6)
upper=floor('upper_city_ground')
rest=next(r for r in plan['routes']if r['id']=='civic_wall_gallery_rest_3')
report=dict(footCount=len(gaps),footsOnGround=sum(g<.1 for g in gaps),
 maxFootGapM=max(gaps),galleryRootInsideTerrace=upper.covers(rootPt),
 galleryRootGroundDistanceM=upper.distance(rootPt),
 galleryRouteEnd=rest['points'][-1],galleryMeters=rest['lengthM'],
 lowApronAreaM2=floor('repair_mage_restored_low_ground_apron_20261012').area,
 caveat='Mathematical XY ground overlap only; does not guarantee all terrain or NPC navigation clearance')
(root/'loggia-mage-seam-20261012.v3-ground-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('GROUND_QA',json.dumps(report),flush=True)
