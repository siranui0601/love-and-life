import bpy,bmesh,json,pathlib,hashlib
from mathutils import Vector
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((R/'work014-p0-contact.staged.plan.json').read_text('utf8'));meta=P['work014WallBaseRepair']
assert hashlib.sha256((R/'plan.json').read_bytes()).hexdigest()==meta['canonicalSHA256']
m=next(m for m in P['meshes'] if m['name']==meta['mesh'])
ob=bpy.data.objects[m['name']]; old=ob.data
mesh=bpy.data.meshes.new(m['name']+'_contact');mesh.from_pydata(m['vertices'],[],m['faces']);mesh.update()
bm=bmesh.new();bm.from_mesh(mesh);assert sum(not e.is_manifold for e in bm.edges)==0
bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
for mat in old.materials:mesh.materials.append(mat)
ob.data=mesh
out=R/'work014-p0-contact.pending.blend';assert not out.exists()
bpy.context.preferences.filepaths.save_version=0
bpy.context.scene['UserPriority12']='CONTACT_REPAIR_PENDING_FULL_ACCEPTANCE'
bpy.ops.wm.save_as_mainfile(filepath=str(out))
code=(R/'audit-user-p0-multisite-v23-roads.py').read_text('utf8').replace('user-p0-multisite-v23.staged.plan.json','work014-p0-contact.staged.plan.json').replace('user-p0-multisite-v23.roads-qa.json','work014-p0-contact-roads-qa.json')
exec(compile(code,'work014-road-audit','exec'))
assert result['totalFailureRays']==14,result['totalFailureRays']
scene=bpy.context.scene;scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=1100;scene.render.resolution_y=730;scene.render.resolution_percentage=100
cam=bpy.data.cameras.new('W03contact');co=bpy.data.objects.new('W03contact',cam);scene.collection.objects.link(co)
co.location=(480,1360,125);co.rotation_euler=(Vector((350,1228,50))-co.location).to_track_quat('-Z','Y').to_euler()
cam.type='ORTHO';cam.ortho_scale=190;cam.clip_end=3000;scene.camera=co
scene.render.filepath=str(R/'work014-W03-contact-after.png');bpy.ops.render.render(write_still=True)
print('WORK014_SAVED_AND_STATIC_QA_PASS',flush=True)
