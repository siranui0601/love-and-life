import bpy,math,pathlib,sys,json
from mathutils import Vector
path=pathlib.Path(sys.argv[sys.argv.index('--')+1])
s=bpy.context.scene
s.render.resolution_x=1260;s.render.resolution_y=800
s.render.resolution_percentage=100
views=[
 ('inspection-upper-east-hole',(830,620,395),(590,838,112),520,'ORTHO'),
 ('inspection-civic-restored',( -1110,300,325),(-800,555,42),475,'ORTHO'),
 ('inspection-civic-walk',(-850,400,47),(-815,620,46),0,'PERSP'),
 ('inspection-market-restored',(-820,-30,270),(-400,145,14),720,'ORTHO'),
 ('inspection-castle-current',(630,670,460),(275,1080,221),660,'ORTHO')]
for name,pos,look,scale,kind in views:
 cam=bpy.data.cameras.new(name);obj=bpy.data.objects.new(name,cam);s.collection.objects.link(obj)
 obj.location=pos;obj.rotation_euler=(Vector(look)-obj.location).to_track_quat('-Z','Y').to_euler()
 cam.type=kind;cam.lens=28;cam.clip_end=20000;cam.clip_start=.1
 if kind=='ORTHO':cam.ortho_scale=scale
 s.camera=obj;s.render.filepath=str(path/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(obj,do_unlink=True)
print('INSPECTION_DONE')
