import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
scene=bpy.context.scene
tag='stage'if 'pending' in bpy.data.filepath else 'before'
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=1150;scene.render.resolution_y=750;scene.render.resolution_percentage=80
views=[
('northgallery',(35,1095,310),(225,1254,130),290),
('magewall',(1290,205,230),(1120,350,50),360),
('lower',(160,-280,440),(-100,-100,20),720),
('ajin',(740,-1090,240),(500,-960,18),440),
('quay',(-570,-800,360),(-850,-350,15),650),
('uppercourt',(25,325,520),(120,790,112),720)]
for name,pos,target,scale in views:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=10000
 scene.camera=ob;scene.render.filepath=str(root/('arch-'+name+'-'+tag+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
 print('RENDERED',name,tag,flush=True)
