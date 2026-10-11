import bpy,pathlib,sys
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
tag='stage'if 'pending' in bpy.data.filepath else 'baseline'
s=bpy.context.scene;s.render.resolution_x=1100;s.render.resolution_y=750;s.render.resolution_percentage=75
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL'
views=[('mage',(1030,205,270),(1055,425,70),270),('civic',(-620,330,215),(-650,528,42),310),('lowcity',(-540,-95,145),(-540,82,14),310)]
for name,pos,target,scale in views:
 cam=bpy.data.cameras.new(name+'-audit');ob=bpy.data.objects.new(name+'-audit',cam)
 s.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
 cam.type='ORTHO';cam.ortho_scale=scale;cam.clip_end=10000
 s.camera=ob;s.render.filepath=str(root/('floor-void-'+name+'-'+tag+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
 print('PROOF_RENDER',name,tag,flush=True)
