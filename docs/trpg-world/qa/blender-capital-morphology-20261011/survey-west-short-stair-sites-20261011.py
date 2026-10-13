import json,pathlib,math
from shapely.geometry import Point,shape,box,LineString
from shapely.ops import unary_union
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'));q=json.loads((root/'parcels.json').read_text('utf8'))
routes={z:[(r,LineString([v[:2]for v in r['points']]))for r in p['routes']if r['z0']==r['z1']==z and len(r['points'])>1]for z in (14,42,78)}
parcels={z:unary_union([shape(a['geometry'])for a in q['parcels']if a.get('groundM')==z])for z in(14,42,78)}
for lower,upper in [(14,42),(42,78)]:
 sites=[]
 for x in range(-920,-730,15):
  for y in range(530,865,15):
   pt=Point(x,y)
   near0=min([(line.distance(pt),r['id']) for r,line in routes[lower]],key=lambda a:a[0])
   near1=min([(line.distance(pt),r['id']) for r,line in routes[upper]],key=lambda a:a[0])
   if near0[0]>65 or near1[0]>65:continue
   footprint=box(x-15,y-19,x+15,y+19)
   overlap=parcels[lower].intersection(footprint).area+parcels[upper].intersection(footprint).area
   score=near0[0]+near1[0]+min(250,overlap)*.55
   sites.append((round(score,1),x,y,round(near0[0],1),round(near1[0],1),round(overlap),near0[1],near1[1]))
 print('LEVELS',lower,upper,'SITES',len(sites))
 for q in sorted(sites)[:16]:print('SITE',q)
