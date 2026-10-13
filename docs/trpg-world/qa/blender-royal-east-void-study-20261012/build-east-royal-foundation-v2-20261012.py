import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'royal-east-ascent-foundation-20261012.v2.staged.plan.json').read_text('utf8'))
new=p['royalEastAscentFoundation20261012']['newMeshes']
for name,nv,nf in new:
 if bpy.data.objects.get(name):raise RuntimeError('Already exists '+name)
 m=next(m for m in p['meshes']if m['name']==name)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 if len(mesh.polygons)!=nf:raise RuntimeError(name)
 obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
 mat=bpy.data.materials.get(m['material']) or bpy.data.materials.new(m['material'])
 mat.diffuse_color=(.58,.56,.51,1)if m['material']=='stone'else(.71,.68,.60,1)
 mesh.materials.append(mat)
 print('MESH',name,nf,flush=True)
out=root/'royal-east-ascent-foundation-20261012.v2.pending.blend'
if out.exists():raise RuntimeError('Refuse to clobber existing trial')
bpy.context.scene['royal_east_ascent_foundation']='VISUAL TRIAL not adopted'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('SAVED_TRIAL',out.stat().st_size,flush=True)
