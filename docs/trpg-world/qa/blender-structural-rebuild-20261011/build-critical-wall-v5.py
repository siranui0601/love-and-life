import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'structural-rebuild-20261011.v5.staged.plan.json').read_text('utf8'))
meta=plan['structuralIntegrityPass20261011']
before=sum(len(bpy.data.objects.get(x['name']).data.polygons) if bpy.data.objects.get(x['name']) else 0 for x in plan['meshes'] if x['name']=='castle_ground')
assert before==806,before
old=[o for o in bpy.data.objects if o.type=='MESH' and any(o.name.startswith(t)for t in meta['removed'])]
if len(old)!=sum(meta['removed'].values()):raise RuntimeError('Old objects mismatch '+str(len(old)))
for obj in old:bpy.data.objects.remove(obj,do_unlink=True)
newNames=set(meta['newMeshFaces'])
matMap={'stone':'stone','stairs':'stairs'}
for name in newNames:
 spec=next(x for x in plan['meshes']if x['name']==name)
 mesh=bpy.data.meshes.new(name)
 mesh.from_pydata(spec['vertices'],[],spec['faces']);mesh.update()
 ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
 mat=bpy.data.materials.get(spec['material'])
 if mat:mesh.materials.append(mat)
 if len(mesh.polygons)!=meta['newMeshFaces'][name]:raise RuntimeError('Face count '+name)
 print('NEW_OBJECT',name,'faces',len(mesh.polygons),'verts',len(mesh.vertices),flush=True)
file=root/'structural-rebuild-20261011.v5.pending.blend'
if file.exists():raise RuntimeError('Pending file exists; refusing overwrite')
bpy.context.scene['structural_rebuild_20261011']='PROVISIONAL - clip/visual/navigation QA incomplete'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(file))
print('BUILT_PROVISIONAL',file.stat().st_size,flush=True)
