import json,pathlib,math
from shapely.geometry import Polygon,LineString,shape,box
from shapely.ops import unary_union
r=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');p=json.loads((r/'plan.json').read_text('utf8'))
for zone,z in [('mage_east',70),('civic_foot',42),('low_city',14),('noble_west',78)]:
 dom=shape(next(a['geometry']for a in p['landDomains']if a['id']==zone))
 m=next(x for x in p['meshes']if x['name']==zone+'_ground')
 old=unary_union([Polygon([(m['vertices'][j][0],m['vertices'][j][1])for j in f])for f in m['faces']if len(f)>=3])
 missing=dom.difference(old.buffer(.12));tiles=[];src={}
 for ob in p['meshes']:
  n=ob['name'].lower()
  if ob['name']==zone+'_ground' or any(k in n for k in ['roof','wall','retaining','support','parapet','window','pillar','facade','flag','hoist','fence','rail','building','parcel']):continue
  if not any(k in n for k in ['ground','floor','lane','road','paving','contour','stair','landing','deck','path','court','ramp','bridge','treads']):continue
  v=ob['vertices'];region=missing.bounds
  if not v:continue
  if max(a[0]for a in v)<region[0] or min(a[0]for a in v)>region[2] or max(a[1]for a in v)<region[1] or min(a[1]for a in v)>region[3]:continue
  for f in ob['faces']:
   xyz=[v[j]for j in f]
   if max(a[2]for a in xyz)-min(a[2]for a in xyz)>.36 or abs(sum(a[2]for a in xyz)/len(xyz)-z)>.5:continue
   pp=Polygon([(a[0],a[1])for a in xyz])
   if pp.is_valid and pp.area>.02 and pp.intersects(missing):
    tiles.append(pp);src[n]=src.get(n,0)+pp.intersection(missing).area
 existing=unary_union(tiles) if tiles else Polygon()
 remain=missing.difference(existing.buffer(.25))
 corridors=[]
 for t in p['routes']:
  if abs(t['z1']-t['z0'])<2:continue
  line=LineString([a[:2]for a in t['points']])
  if line.intersects(missing):corridors.append(line.buffer(t.get('width',4)*.5+1.7))
 protected=unary_union(corridors) if corridors else Polygon()
 safe=remain.difference(protected.buffer(.25))
 print('ZONE',zone,'missing',round(missing.area),'existingSeparateFloors',round(missing.intersection(existing).area),'remaining',round(remain.area),'protection',round(protected.intersection(missing).area),'safeCandidate',round(safe.area),'otherFloorFaces',len(tiles),'topSurfaces',sorted(src.items(),key=lambda q:-q[1])[:7])
 for a in sorted([safe]if safe.geom_type=='Polygon'else [e for e in getattr(safe,'geoms',[])if e.geom_type=='Polygon'],key=lambda e:-e.area)[:5]:
  print(' SAFE',round(a.area),tuple(round(u)for u in a.bounds))
