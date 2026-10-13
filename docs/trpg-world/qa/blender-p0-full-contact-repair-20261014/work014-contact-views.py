import bpy,pathlib
from mathutils import Vector
R=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
loc=Vector((-792,1175,148));tar=Vector((-654.298,1076.59,25))
rot=(tar-loc).to_track_quat('-Z','Y')
for px,py in [(154,220),(156,205),(160,235),(592,230)]:
 origin=loc+(rot@Vector((1,0,0)))*((px/770-.5)*275)+(rot@Vector((0,1,0)))*((.5-py/511)*275*511/770)
 hit,p,n,i,o,m=bpy.context.scene.ray_cast(bpy.context.evaluated_depsgraph_get(),origin,rot@Vector((0,0,-1)),distance=3000)
 print('F01_VISIBLE',px,py,hit,tuple(p),o.name if o else None,flush=True)
s=bpy.context.scene;s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL'
s.render.resolution_x=1100;s.render.resolution_y=730;s.render.resolution_percentage=70
for tag,eye,target,scale in [('W01',(-270,1040,200),(-120,915,135),180),('W04',(1300,355,160),(1176,493,40),200),('F09',(805,1100,160),(590,925,50),380)]:
 cam=bpy.data.cameras.new(tag);o=bpy.data.objects.new(tag,cam);s.collection.objects.link(o);o.location=eye
 o.rotation_euler=(Vector(target)-Vector(eye)).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=3000;s.camera=o
 s.render.filepath=str(R/('work014-'+tag+'-contact.png'));bpy.ops.render.render(write_still=True)
 print('VIEW',tag,flush=True)
