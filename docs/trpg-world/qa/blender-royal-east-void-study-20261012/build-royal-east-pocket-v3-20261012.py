import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'royal-east-pocket-20261012.v3.staged.plan.json').read_text('utf8'))
metadata=plan['royalEastPocketRock20261012']
for name,nv,nf in metadata['newMeshes']:
 m=next(m for m in plan['meshes']if m['name']==name)
 if bpy.data.objects.get(name):raise RuntimeError('Collision '+name)
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 assert len(mesh.polygons)==nf
 obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
 mat=bpy.data.materials.get(m['material'])or bpy.data.materials.new(m['material'])
 if m['material']=='stone':mat.diffuse_color=(.50,.49,.46,1)
 else:mat.diffuse_color=(.49,.51,.48,1)
 mesh.materials.append(mat)
 print('ROCK',name,'faces',nf,flush=True)
out=root/'royal-east-pocket-20261012.v3.pending.blend'
if out.exists():raise RuntimeError('Refusing pending overwrite')
bpy.context.scene['royal_east_pocket_v3']='NOT APPROVED, test render'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('PENDING',out.stat().st_size,flush=True)
