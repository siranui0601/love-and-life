"""Repair documented royal civic lower-ground 164.84 m² hole in its
existing ground mesh. Maintain all roads and non-hole areas. Stage only.
"""
import json,pathlib,math,hashlib
from shapely.geometry import Polygon,shape,box
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
m=next(q for q in p['meshes']if q['name']=='civic_foot_ground')
dom=shape(next(q['geometry']for q in p['landDomains']if q['id']=='civic_foot'))
G=unary_union([Polygon([m['vertices'][i][:2]for i in f])for f in m['faces']if len(f)>=3])
search=box(540,570,725,770)
missing=dom.intersection(search).difference(G.buffer(.015)).buffer(0)
parts=[missing]if missing.geom_type=='Polygon'else [x for x in missing.geoms if x.geom_type=='Polygon']
found=[x for x in parts if x.area>1]
if len(found)!=1 or not 150<found[0].area<180:raise RuntimeError('Unexpected ground hole; stop '+str([(x.area,x.bounds)for x in found]))
hole=found[0]
new=[]
covered=0
for poly in constrained_delaunay_triangles(hole).geoms:
 if poly.area<.001 or not hole.buffer(.006).covers(poly.representative_point()):continue
 pxy=list(poly.exterior.coords)[:3]
 oriented=(pxy[1][0]-pxy[0][0])*(pxy[2][1]-pxy[0][1])-(pxy[1][1]-pxy[0][1])*(pxy[2][0]-pxy[0][0])
 if oriented<0:pxy=pxy[::-1]
 new.append([[round(v[0],8),round(v[1],8),42.]for v in pxy])
 covered+=poly.area
if not 140<covered<185:raise RuntimeError('Patch missed area '+str(covered))
for tri in new:
 j=len(m['vertices'])
 m['vertices'].extend(tri)
 m['faces'].append([j,j+1,j+2])
G2=unary_union([Polygon([m['vertices'][i][:2]for i in f])for f in m['faces']if len(f)>=3])
remaining=dom.intersection(search).difference(G2.buffer(.015)).area
if remaining>1:raise RuntimeError('Ground residual '+str(remaining))
out=dict(status='PENDING_BLENDER_QA',meshName=m['name'],patchAreaM2=round(covered,3),
 addedFaces=len(new),residualM2=round(remaining,4),holeBoundingBox=[round(x,3) for x in hole.bounds],
 originalGroundVertices=len(m['vertices'])-3*len(new),
 originalGroundFaces=len(m['faces'])-len(new),
 preservedRoutes=len(p['routes']),note='Repair ground mesh itself; not a floating cover')
p['currentRoyalCivicGroundHoleRepair']=out
(root/'royal-civic-floor-repair-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'royal-civic-floor-repair.staged.json').write_text(json.dumps(out,indent=2),encoding='utf8')
print('FLOOR_PATCH_STAGED',json.dumps(out))
