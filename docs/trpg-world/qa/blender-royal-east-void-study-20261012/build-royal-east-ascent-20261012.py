import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'royal-forecourt-east-ascent-20261012.staged.plan.json').read_text('utf8'))
meta=plan['royalEastAscentSeam20261012']
for name,nv,nf in meta['newMeshes']:
 if bpy.data.objects.get(name):raise RuntimeError('Existing object conflict '+name)
 a=next(m for m in plan['meshes']if m['name']==name)
 mesh=bpy.data.meshes.new(name)
 mesh.from_pydata(a['vertices'],[],a['faces']);mesh.update()
 assert len(mesh.polygons)==nf,(name,len(mesh.polygons),nf)
 ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob)
 mat=bpy.data.materials.get(a['material'])
 if not mat:
  mat=bpy.data.materials.new('Sculptural '+a['material'])
  mat.diffuse_color={'stone':(.5,.49,.45,1),'limestone':(.69,.65,.59,1),'ground':(.48,.48,.44,1)}[a['material']]
 mesh.materials.append(mat)
 print('BUILT',name,len(mesh.polygons),flush=True)
bpy.context.scene['royal_forecourt_west_cliff']='LOCAL PILOT: grounded west cliff wall; route and landscape QA pending'
out=root/'royal-forecourt-east-ascent-20261012.pending.blend'
if out.exists():raise RuntimeError('Refuse overwrite pending')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('PENDING_SAVED',out.stat().st_size,flush=True)
