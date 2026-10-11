import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current');scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=1150;scene.render.resolution_y=790;scene.render.resolution_percentage=75
views=[('upper-wall',(40,170,240),(95,430,80),350),('west-noble',(-1070,635,170),(-824,790,60),330),('mage-wall',(1280,205,170),(1160,350,40),250),('court-wall',(-45,545,260),(140,735,130),350)]
for name,pos,target,scale in views:
 cam=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,cam)
 scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=10000
 scene.camera=ob;scene.render.filepath=str(root/('triage-'+name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
 print('DONE',name,flush=True)
