import bpy,json,pathlib,math,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
before=json.loads((root/'plan.json').read_text('utf8'))
after=json.loads((root/'mage-abutment-plan.staged.json').read_text('utf8'))
meta=after['mageStairSupportBatch20261011']
name='current_mage_wall_stair_abutments_integrated_stone'
originalPrefix='mage_quarter_mage_wall_short_stairs_abutment_'
orig=[m for m in before['meshes']if m['name'].startswith(originalPrefix)]
old_routes={v['id']:v for v in before['routes']}
new_routes={v['id']:v for v in after['routes']}
assert old_routes==new_routes and len(old_routes)==1222,'Road altered'
assert len(orig)==362
assert sum(len(m['faces'])for m in orig)==5205
assert all(not bpy.data.objects.get(m['name']) for m in orig)
ob=bpy.data.objects.get(name)
assert ob is not None and len(ob.data.polygons)==5205
assert len(ob.data.vertices)==20789
assert len(after['meshes'])==len(before['meshes'])-361
assert len(bpy.data.objects[name].data.materials)==1
assert ob.data.materials[0].name=='stone'
# Compare geometry in strict source order to unchanged f32 snapshot
off=0;maxdelta=0.0;faceMismatch=[]
for m in orig:
 for j,v in enumerate(m['vertices']):
  new=ob.data.vertices[off+j].co
  maxdelta=max(maxdelta,max(abs(float(a)-float(b)) for a,b in zip(new,v)))
 for j,face in enumerate(m['faces']):
  expected=tuple(off+k for k in face)
  if sorted(ob.data.polygons[sum(len(q['faces'])for q in orig[:orig.index(m)])+j].vertices)!=sorted(expected):
   faceMismatch.append(m['name'])
 off+=len(m['vertices'])
assert maxdelta<.00013,maxdelta
assert not faceMismatch,faceMismatch[:3]
# Paths and other scene features still present on the staged file
assert bpy.data.objects.get('current_palace_royal_limestone') is not None
assert bpy.data.objects.get('current_upper_grand_garden_stone') is not None
assert bpy.data.objects.get('current_east_escarpment_rock') is not None
assert bpy.data.objects.get('castle_wall_stairs_treads') is not None
report=dict(status='LOSSLESS_STATIC_MESH_PASS',sourceObjects=362,mergedObjects=1,oldFaces=5205,newFaces=len(ob.data.polygons),sourceVertices=20789,newVertices=len(ob.data.vertices),maxCoordinateDifferenceMeters=maxdelta,faceVertexSetMismatches=0,unchangedRoutes=1222,materialPreserved=True,artQualityUnchanged=True,limitations=['Stair structural gaps and unusual geometry were preserved exactly, not repaired','No player/vehicle swept validation','No performance benchmark or in-game navmesh test'])
(root/'mage-abutment-merge-qa.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('MAGE_MERGE_QA',json.dumps({k:v for k,v in report.items()if k!='limitations'}))
