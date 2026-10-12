import bpy,json,pathlib,bmesh
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'royal-east-integrated-v9.staged.plan.json').read_text('utf8'))
meta=plan['royalEastIntegratedV9']
scene=bpy.context.scene
for name in meta['meshNames']:
 original=next(x for x in plan['meshes']if x['name']==name)
 if bpy.data.objects.get(name):raise RuntimeError('Existing object '+name)
 mesh=bpy.data.meshes.new(name)
 mesh.from_pydata(original['vertices'],[],original['faces'])
 mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
 obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
 m=bpy.data.materials.new('v9_'+original['material'])
 m.diffuse_color=(.51,.51,.48,1) if 'rock' in original['material']else (.46,.46,.43,1)
 mesh.materials.append(m)
 print('STAGED_MESH',name,len(mesh.vertices),len(mesh.polygons),flush=True)
scene['royalEastIntegratedV9']='PENDING QA - not promoted to current'
out=root/'royal-east-integrated-v9.pending.blend'
if out.exists():raise RuntimeError('Refuse overwrite existing trial')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('TRIAL_SAVED',out.stat().st_size,flush=True)
