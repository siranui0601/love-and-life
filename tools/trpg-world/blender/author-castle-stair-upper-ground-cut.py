"""Resection the royal castle upper ground to open the historic west
stair without overlaying its last 2 m of treads. Do not overwrite live.
Source plan + actual Blender mesh expected as matching versions.
"""
import json,pathlib,math
from shapely.geometry import Polygon,LineString,MultiPolygon
from shapely import constrained_delaunay_triangles
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'plan.json').read_text('utf8'))
r=next(q for q in p['routes']if q['id']=='castle_wall_stairs')
m=next(q for q in p['meshes']if q['name']=='b104_castle_outer_ground_extension')
parts=[v for v in r['points'] if 200.8<=v[2]<=203.62]
if len(parts)<10 or len(m['faces'])!=438:raise RuntimeError('Unexpected stair or ground input')
center=LineString([v[:2]for v in parts])
opening=center.buffer(2.55,cap_style=2,join_style=2).buffer(0)
if not 14<opening.area<75:raise RuntimeError('Opening unexpectedly large '+str(opening.area))
origFaces=len(m['faces']);origVerts=len(m['vertices'])
old=[]
newFaces=[]
vertIndex={(round(v[0],8),round(v[1],8)):i for i,v in enumerate(m['vertices'])}
removedArea=0
newArea=0
touch=0
def triangles(poly):
 if poly.is_empty:return []
 if poly.geom_type=='Polygon':
  return list(constrained_delaunay_triangles(poly).geoms)
 return [tri for geom in poly.geoms for tri in triangles(geom)]
for face in m['faces']:
 poly=Polygon([m['vertices'][j][:2]for j in face])
 if not poly.is_valid:raise RuntimeError('Invalid old ground polygon')
 intersection=poly.intersection(opening)
 if intersection.area<1e-8:
  old.append(face);continue
 touch+=1
 removedArea+=intersection.area
 diff=poly.difference(opening).buffer(0)
 n_area=0
 for tri in triangles(diff):
  if tri.area<1e-7 or not diff.buffer(1e-6).covers(tri.representative_point()):continue
  verts=list(tri.exterior.coords)[:3]
  orient=(verts[1][0]-verts[0][0])*(verts[2][1]-verts[0][1])-(verts[1][1]-verts[0][1])*(verts[2][0]-verts[0][0])
  if orient<0:verts=verts[::-1]
  ids=[]
  for x,y in verts:
   key=(round(x,8),round(y,8))
   if key not in vertIndex:
    vertIndex[key]=len(m['vertices'])
    m['vertices'].append([key[0],key[1],204.02])
   ids.append(vertIndex[key])
  newFaces.append(ids)
  n_area+=tri.area
  newArea+=tri.area
 if abs(diff.area-n_area)>.008:raise RuntimeError('Patch triangulation missed '+str(diff.area-n_area))
m['faces']=old+newFaces
if not 10<removedArea<70 or touch>90:raise RuntimeError('Unexpected surface amount '+str((touch,removedArea)))
meta=dict(status='PENDING_BLENDER_QA',groundObject='b104_castle_outer_ground_extension',
 sourceGroundFaces=origFaces,sourceGroundVertices=origVerts,
 route='castle_wall_stairs',openCutAreaSqM=round(removedArea,3),
 openedAlongRouteZ=[200.8,203.62],routeWidthM=r['width'],
 originalFacesTouched=touch,untouchedOriginalFaces=len(old),
 replacementGroundFaces=len(newFaces),newGroundVertices=len(m['vertices'])-origVerts,
 protectOtherRoutes=True,
 caveats=['Stair surface is a separate intact Blender mesh','Newly exposed cut lips need fall-edge guard evaluation',
 'Other 14 citywide anomalies require separate inspection'])
p['currentCastleWestStairTopCut']=meta
(root/'castle-stair-upper-cut-plan.staged.json').write_text(json.dumps(p,separators=(',',':')),encoding='utf8')
(root/'castle-stair-upper-cut.study.json').write_text(json.dumps(meta,indent=2),encoding='utf8')
print('CASTLE_STAIR_CUT_STAGED',json.dumps(meta))
