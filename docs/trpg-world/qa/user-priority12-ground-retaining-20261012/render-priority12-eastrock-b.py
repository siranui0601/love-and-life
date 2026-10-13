import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
S=bpy.context.scene;S.render.engine='BLENDER_WORKBENCH';S.display.shading.light='STUDIO';S.display.shading.color_type='MATERIAL'
S.render.resolution_x=960;S.render.resolution_y=640;S.render.resolution_percentage=65
S.render.image_settings.file_format='PNG'
for tag,eye,target,scale,marker in [
 ('F04_SIDE',(-250,945,93),(-127,915,113),170,(-127,915,113)),
 ('F05_SIDE',(330,825,130),(354,961,151),175,(353.602,960.79,156)),
 ('F06_SIDE',(575,1115,76),(424,1127,109),200,(424.202,1126.79,112)),
 ('F09_SIDE',(660,910,36),(585,925,27),165,(584.702,925.49,14)),
 ('W02_SIDE',(685,900,55),(552,878,82),190,(552.002,878.49,75)),
 ('W03_SIDE',(510,1240,50),(355,1226,65),195,(355.702,1226.39,30)),
 ('W04_SIDE',(1155,370,22),(1176,492,44),170,(1175.8,492.69,30))]:
 cam=bpy.data.cameras.new('site_'+tag);o=bpy.data.objects.new('site_'+tag,cam);S.collection.objects.link(o)
 o.location=eye;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=5000;S.camera=o
 # temporary site locator visible only in diagnostic, not saved in model
 bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=6,radius=2.2,location=marker)
 loc=bpy.context.object
 mat=bpy.data.materials.new('diagnostic_orange_'+tag);mat.diffuse_color=(1,.10,.01,1)
 loc.data.materials.append(mat)
 S.render.filepath=str(root/('PRIORITY_'+tag+'_'+('EASTROCK_B'if 'pending' in bpy.data.filepath else 'BEFORE')+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(loc,do_unlink=True);bpy.data.objects.remove(o,do_unlink=True)
 print('SITE_RENDER',tag,flush=True)
