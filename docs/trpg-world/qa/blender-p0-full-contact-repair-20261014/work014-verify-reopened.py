import bpy,json,pathlib
from mathutils import Vector
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
code=(R/'audit-user-p0-multisite-v23-roads.py').read_text('utf-8-sig').replace('user-p0-multisite-v23.staged.plan.json','work014-p0-contact.staged.plan.json').replace('user-p0-multisite-v23.roads-qa.json','work014-p0-contact-roads-qa.json')
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
