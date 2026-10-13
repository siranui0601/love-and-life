import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
scene=bpy.context.scene
tag='v7'if 'pending' in bpy.data.filepath else 'before'
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=1300;scene.render.resolution_y=870;scene.render.resolution_percentage=80
for name,eye,target,width in [
 ('east-ground',(610,1050,192),(428,1025,150),230),
 ('east-underwall',(520,1020,137),(427,1005,139),160),
 ('east-royalhigh',(680,1170,320),(430,1020,151),315)]:
 cam=bpy.data.cameras.new('qa_'+name);ob=bpy.data.objects.new('qa_'+name,cam)
 scene.collection.objects.link(ob);ob.location=eye
 ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=width;cam.clip_end=5000;scene.camera=ob
 scene.render.filepath=str(root/('qa-'+name+'-'+tag+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
 print('RENDER',name,tag,flush=True)
