import bpy,json,pathlib,bmesh
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'floor-void-candidates.plan.staged.json').read_text('utf8'))
report=json.loads((root/'floor-void-candidates.study.json').read_text('utf8'))
assert len(p['routes'])==report['routes']
for s in report['patches']:
 obj=bpy.data.objects.get(s['mesh'])
 if obj is None or obj.type!='MESH':raise RuntimeError('Object absent '+s['mesh'])
 old=obj.data
 if len(old.vertices)!=s['oldVertices'] or len(old.polygons)!=s['oldFaces']:raise RuntimeError('Concurrent mismatch '+s['mesh'])
 a=next(m for m in p['meshes']if m['name']==s['mesh'])
 new=bpy.data.meshes.new(s['mesh']+'_repaired_20261011')
 new.from_pydata(a['vertices'],[],a['faces']);new.update()
 for mat in old.materials:new.materials.append(mat)
 bm=bmesh.new();bm.from_mesh(new);bm.faces.ensure_lookup_table()
 for face in list(bm.faces)[s['oldFaces']:]:
  if face.normal.z<0:face.normal_flip()
 bm.to_mesh(new);bm.free();obj.data=new
 if len(obj.data.polygons)!=s['oldFaces']+s['newFaces']:raise RuntimeError('Face mismatch '+s['mesh'])
 print('PATCHED_IN_BLENDER',s['mesh'],len(new.vertices),len(new.polygons),flush=True)
out=root/'floor-void-candidates.pending.blend'
if out.exists():raise RuntimeError('Existing pending file, refuse overwrite')
bpy.context.scene['capital_floor_void_patch']='PROVISIONAL: local geometry QA pending; not full city accepted'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('PENDING_SAVED',str(out),out.stat().st_size,flush=True)
