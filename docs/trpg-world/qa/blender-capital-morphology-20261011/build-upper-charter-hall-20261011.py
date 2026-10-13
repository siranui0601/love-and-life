import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'architecture-repair-20261011.stage2.plan.json').read_text('utf8'))
study=plan['upperCharterHall20261011']
cols={'limestone':(.62,.61,.53,1),'slate':(.18,.26,.37,1),'brass':(.65,.53,.25,1),'wood':(.36,.25,.17,1),'water':(.14,.38,.49,1),'grass':(.23,.39,.23,1),'paving':(.52,.53,.46,1)}
for name,nFaces,nVerts in study['newMeshes']:
 if bpy.data.objects.get(name):raise RuntimeError('Already in Blender: '+name)
 spec=next(m for m in plan['meshes']if m['name']==name);material=name.split('_')[-1]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(spec['vertices'],[],spec['faces']);mesh.update()
 obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
 mt=bpy.data.materials.new('Upper Charter Hall '+material);mt.diffuse_color=cols[material];mesh.materials.append(mt)
 if len(mesh.polygons)!=nFaces or len(mesh.vertices)!=nVerts:raise RuntimeError('Count mismatch '+name)
 print('ADDED_BUILDING_PART',name,nFaces,flush=True)
out=root/'architecture-repair-20261011.stage2.pending.blend'
if out.exists():raise RuntimeError('Pending already exists')
bpy.context.scene['architecture_20261011']='PROVISIONAL - urban morphology changed / NAV & all-terrain QA pending'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('STAGE2_READY',out.stat().st_size,flush=True)
