"""B112 explicit standing eye-view QA: public approach viewpoints.
No modification or save of original blend.
"""
import bpy,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
s=bpy.context.scene
s.render.resolution_x=1300;s.render.resolution_y=820
for name,pos,target,lens in [
 ('B112-eye-south-entry',(1080,582,74),(1050,648,93),22),
 ('B112-eye-west-approach',(1005,604,74),(1050,649,96),25),
 ('B112-eye-east-approach',(1117,620,74),(1050,652,94),27),
 ('B112-eye-north-west',(1010,725,75),(1050,651,99),23)]:
 cam=bpy.data.cameras.new(name)
 ob=bpy.data.objects.new(name,cam);s.collection.objects.link(ob)
 ob.location=pos
 ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.clip_start=.1;cam.clip_end=20000;cam.lens=lens
 s.camera=ob
 s.render.filepath=str(out/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
 bpy.data.cameras.remove(cam)
print('EYE_RENDER_DONE')
