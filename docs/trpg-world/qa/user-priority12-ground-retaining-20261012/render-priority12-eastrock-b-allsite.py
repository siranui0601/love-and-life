import bpy,json,pathlib
from mathutils import Vector
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
P=json.loads((root/'PRIORITY-12-COORDINATES-20261012.json').read_text('utf8'))
G={ 'F01':14,'F02':42,'F03':14,'F04W01':112,'F05':156,
'F06':112,'F07':112,'F08':14,'F09':14,
'W02':75.1,'W03':30.3,'W04':30.3 }
S=bpy.context.scene;S.render.engine='BLENDER_WORKBENCH'
S.display.shading.light='STUDIO';S.display.shading.color_type='MATERIAL'
S.render.resolution_x=900;S.render.resolution_y=650;S.render.resolution_percentage=65
for tag,x,y,z,kind in P:
 viewz=G[tag]
 eye=Vector((x+70,y-85,viewz+115));target=Vector((x,y,viewz))
 c=bpy.data.cameras.new('p0_site_'+tag)
 cam=bpy.data.objects.new('p0_site_'+tag,c);S.collection.objects.link(cam)
 cam.location=eye;cam.rotation_euler=(target-eye).to_track_quat('-Z','Y').to_euler()
 c.type='ORTHO';c.ortho_scale=108;S.camera=cam
 bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,radius=1.5,location=(x,y,viewz+1.5))
 mark=bpy.context.object
 mat=bpy.data.materials.new('TEMP_P0_ORANGE_'+tag)
 mat.diffuse_color=(.96,.12,.03,1);mark.data.materials.append(mat)
 S.render.filepath=str(root/('QA_SITE_'+tag+'_EASTROCK_B.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(mark,do_unlink=True);bpy.data.objects.remove(cam,do_unlink=True)
 print('P0_VIEW',tag,flush=True)
