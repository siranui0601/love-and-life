import bpy,json,pathlib,math
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
meta=json.loads((root/'floor-void-candidates.study.json').read_text('utf8'))
failures=[];details=[]
for s in meta['patches']:
 o=bpy.data.objects.get(s['mesh'])
 if o is None or len(o.data.vertices)!=s['newVertices'] or len(o.data.polygons)!=s['oldFaces']+s['newFaces']:
  failures.append(s['mesh']+':mesh mismatch');continue
 faceIds=range(s['oldFaces'],len(o.data.polygons))
 badNormals=0;badSupport=0;tested=0
 for fid in faceIds:
  f=o.data.polygons[fid]
  if f.normal.z<.98:badNormals+=1
  target=o.matrix_world@f.center
  origin=o.matrix_world.inverted()@(target+Vector((0,0,1.)))
  direction=o.matrix_world.inverted().to_3x3()@Vector((0,0,-1))
  ok,hit,n,poly=o.ray_cast(origin,direction,distance=2.5)
  tested+=1
  if not ok or abs((o.matrix_world@hit).z-target.z)>.02:badSupport+=1
 if badNormals or badSupport:failures.append(str((s['mesh'],badNormals,badSupport)))
 details.append(dict(mesh=s['mesh'],faces=tested,badNormals=badNormals,unsupported=badSupport))
a=json.loads((root/'floor-void-baseline-road-qa.json').read_text('utf8'))
b=json.loads((root/'floor-void-staged-road-qa.json').read_text('utf8'))
for key in ('routesVisited','surfaceRays'):
 if a[key]!=b[key]:failures.append(key+':count differs')
if b['totalFailureRays']>a['totalFailureRays']:failures.append('Road floor regression')
if {(x['route'],x['x'],x['y'],x['z'])for x in b['failureExamples']}-{(x['route'],x['x'],x['y'],x['z'])for x in a['failureExamples']}:failures.append('New route failure')
out=dict(status='LOCAL_PASS'if not failures else'FAIL',scopedNewGroundFaces=sum(x['faces']for x in details),newFloorAreaM2=sum(x['areaSqm']for x in meta['patches']),baselineRoadFailureRays=a['totalFailureRays'],stagedRoadFailureRays=b['totalFailureRays'],meshReports=details,failures=failures,limitations=['No continuous capsule/NPC/cart simulation','No full edge retaining wall or human-eye art signoff','Tests do not certify unrelated city stairs'])
(root/'floor-void-candidates-3d-qa.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf8')
print('PATCHED_FLOOR_QA',json.dumps(out,ensure_ascii=False))
if failures:raise RuntimeError(str(failures))
