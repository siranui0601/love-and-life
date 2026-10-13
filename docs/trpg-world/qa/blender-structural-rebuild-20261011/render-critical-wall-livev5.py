import bpy,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
tag='livev5'
s=bpy.context.scene;s.render.resolution_x=1280;s.render.resolution_y=800;s.render.resolution_percentage=75
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL'
views=[
('civic-gallery',(850,505,270),(615,760,85),355),
('mage-freight',(1290,150,230),(1110,346,45),300),
('castle-south',(0,610,450),(275,1090,163),610),
('castle-east',(720,710,410),(275,1080,172),620)]
for n,pos,target,scale in views:
 cam=bpy.data.cameras.new('compare'+n);o=bpy.data.objects.new('compare'+n,cam)
 s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=10000
 s.camera=o;s.render.filepath=str(root/('critical-'+n+'-'+tag+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(o,do_unlink=True)
 print('RENDER',n,tag,flush=True)
