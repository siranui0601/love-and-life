import bpy,json,pathlib
from mathutils import Vector
from mathutils.bvhtree import BVHTree
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'royal-civic-floor-repair-plan.staged.json').read_text('utf8'))
qa=p['currentRoyalCivicGroundHoleRepair']
ob=bpy.data.objects.get('civic_foot_ground')
m=next(x for x in p['meshes']if x['name']=='civic_foot_ground')
start=qa['originalGroundFaces']
if len(ob.data.polygons)!=len(m['faces']):raise RuntimeError('Actual Blender mesh faces differ')
v=[ob.matrix_world@q.co for q in ob.data.vertices]
f=[list(face.vertices)for face in ob.data.polygons]
tree=BVHTree.FromPolygons(v,f)
roadFloor=[ob]
for floor in bpy.data.objects:
 if floor.type=='MESH' and floor.name.startswith('wall_gallery_civic_wall_gallery_lower_') and floor.name.endswith('_floor'):
  roadFloor.append(floor)
roadverts=[];roadfaces=[]
for source in roadFloor:
 k=len(roadverts)
 roadverts.extend([source.matrix_world@v.co for v in source.data.vertices])
 roadfaces.extend([[k+i for i in poly.vertices] for poly in source.data.polygons])
roadTree=BVHTree.FromPolygons(roadverts,roadfaces)
tests=0;bad=[]
for face in m['faces'][start:]:
 tri=[m['vertices'][i]for i in face]
 ctr=[sum(q[i]for q in tri)/3 for i in range(3)]
 point,normal,ix,dist=tree.ray_cast(Vector((ctr[0],ctr[1],44)),Vector((0,0,-1)),3)
 tests+=1
 if point is None or abs(point.z-42)>.05 or normal.z<.8:bad.append(ctr)
# Check actual route under/around repaired ground:
n=0; roadProblems=[]
for route in p['routes']:
 if len(route['points'])<2 or route['z0']!=42 or route['z1']!=42:continue
 for a,b in zip(route['points'],route['points'][1:]):
  if max(a[0],b[0])<660 or min(a[0],b[0])>691 or max(a[1],b[1])<594 or min(a[1],b[1])>622:continue
  for i in range(1,9):
   t=i/9;xx=a[0]+(b[0]-a[0])*t;yy=a[1]+(b[1]-a[1])*t
   hit,norm,faceid,dist=roadTree.ray_cast(Vector((xx,yy,44)),Vector((0,0,-1)),3)
   n+=1
   if hit is None or abs(hit.z-42)>.5:roadProblems.append((route['id'],xx,yy))
report=dict(status='PASS'if not bad and not roadProblems else 'FAIL',
 actualNewFaceSamples=tests,invalidNewFaceCount=len(bad),newFaceExamples=bad[:8],
 neighboringRoadFloorSamples=n,neighborRoadFloorMissing=len(roadProblems),neighborFailExamples=roadProblems[:8],
 areaM2=qa['patchAreaM2'],renderTarget='current local ground replacement',
 caveat='User-reported holes elsewhere, gameplay continuous capsules, citywide floors remain unverified')
(root/'royal-civic-floor-repair-3d-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('ACTUAL_FLOOR_QA',json.dumps(report))
