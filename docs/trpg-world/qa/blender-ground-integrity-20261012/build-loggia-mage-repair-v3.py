import bpy,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
plan=json.loads((root/'loggia-mage-seam-20261012.v3.staged.plan.json').read_text('utf8'))
meta=plan['currentStructuralSeam20261012']
bad=[n for n in meta['removedMeshNames'] if bpy.data.objects.get(n) is None]
if bad:raise RuntimeError('Missing source objects '+str(bad))
for n in meta['removedMeshNames']:bpy.data.objects.remove(bpy.data.objects[n],do_unlink=True)
for n in meta['changedMeshNames']:
 ob=bpy.data.objects.get(n)
 if not ob:raise RuntimeError('Missing changed object '+n)
 for v in ob.data.vertices:v.co.x-=20
for n,nverts,nfaces in meta['newMeshes']:
 m=next(x for x in plan['meshes'] if x['name']==n)
 mesh=bpy.data.meshes.new(n);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 if len(mesh.polygons)!=nfaces:raise RuntimeError('Face count mismatch '+n)
 ob=bpy.data.objects.new(n,mesh);bpy.context.scene.collection.objects.link(ob)
 mat=bpy.data.materials.get(m['material'])
 if mat:mesh.materials.append(mat)
 else:
  mat=bpy.data.materials.new('Repair '+m['material'])
  mat.diffuse_color=(.59,.57,.51,1) if m['material']=='stone' else (.74,.7,.62,1)
  mesh.materials.append(mat)
 print('ADDED',n,len(mesh.polygons),flush=True)
output=root/'loggia-mage-seam-20261012.v3.pending.blend'
if output.exists():raise RuntimeError('Refuse overwrite existing pending file')
bpy.context.scene['structural_integrity_20261012']='PROVISIONAL_3D_VISUAL_QA_PENDING'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print('STAGED_BLENDER',output.stat().st_size,flush=True)
