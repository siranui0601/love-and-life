import bpy,bmesh,pathlib,json
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-sealed.staged.plan.json').read_text('utf8'))
for m in P['meshes']:
 if not m['name'].startswith('work014_'):continue
 mesh=bpy.data.meshes.new(m['name']);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);assert all(e.is_manifold for e in bm.edges)
 bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 obj=bpy.data.objects.new(m['name'],mesh);bpy.context.scene.collection.objects.link(obj)
 mat=bpy.data.materials.get('stone')
 if mat:mesh.materials.append(mat)
out=R/'work014-p0-sealed.pending.blend';assert not out.exists()
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out))
code=(R/'work014-verify-reopened.py').read_text('utf-8-sig').replace('work014-p0-contact.staged.plan.json','work014-p0-sealed.staged.plan.json').replace('work014-p0-contact-roads-qa.json','work014-p0-sealed-roads-qa.json').replace('work014-W03-contact-after.png','work014-W03-sealed-after.png')
exec(compile(code,'sealed-QA','exec'))
