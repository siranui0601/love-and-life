import bpy,bmesh,json,pathlib
from mathutils import Vector
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-final.staged.plan.json').read_text('utf8'))
for m in P['meshes']:
 if not m['name'].startswith('work014_noble'):continue
 mesh=bpy.data.meshes.new(m['name']);mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);assert all(e.is_manifold for e in bm.edges)
 bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
 o=bpy.data.objects.new(m['name'],mesh);bpy.context.scene.collection.objects.link(o)
 mat=bpy.data.materials.get('stone')
 if mat:mesh.materials.append(mat)
bpy.context.scene['UserPriority12']='STRUCTURAL_REPAIR_20261014_CITYWIDE_ACCEPTANCE_INCOMPLETE'
bpy.context.preferences.filepaths.save_version=0
out=R/'work014-p0-final.pending.blend';assert not out.exists()
bpy.ops.wm.save_as_mainfile(filepath=str(out))
code=(R/'work014-full-repair-QA.py').read_text('utf-8-sig').replace('work014-p0-sealed.staged.plan.json','work014-p0-final.staged.plan.json').replace('work014-full-repair-QA.json','work014-final-repair-QA.json')
exec(compile(code,'final-mesh-QA','exec'))
code=(R/'work014-verify-reopened.py').read_text('utf-8-sig').replace('work014-p0-contact.staged.plan.json','work014-p0-final.staged.plan.json').replace('work014-p0-contact-roads-qa.json','work014-final-roads-qa.json').replace('work014-W03-contact-after.png','work014-W03-final.png')
exec(compile(code,'final-road-QA','exec'))
scene=bpy.context.scene
co.location=(-792,1175,148);co.rotation_euler=(Vector((-654.298,1076.59,25))-co.location).to_track_quat('-Z','Y').to_euler()
cam.ortho_scale=275;scene.render.filepath=str(R/'work014-F01-final.png');bpy.ops.render.render(write_still=True)
print('FINAL_BUILD_PASS',flush=True)
