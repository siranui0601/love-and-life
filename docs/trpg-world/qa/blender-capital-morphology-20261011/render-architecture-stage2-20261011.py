import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=1280;scene.render.resolution_y=800;scene.render.resolution_percentage=85
views=[('upper-charter-close',(485,350,325),(310,650,117),245),
('upper-charter-aerial',(85,345,530),(190,765,112),780),
('northgallery',(35,1095,310),(225,1254,130),290)]
for name,pos,target,scale in views:
 cam=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=10000
 scene.camera=obj;scene.render.filepath=str(root/('arch-stage2-'+name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(obj,do_unlink=True)
 print('RENDERED',name,flush=True)
