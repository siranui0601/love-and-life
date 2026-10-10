"""Fixed cameras for residual-block review; identical before/after framing."""
import bpy,sys,pathlib
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);scene=bpy.context.scene
for name,loc,look,scale in [('East-lowland-blocks',(1750,-1850,850),(800,-900,14),950),('Civic-blocks',(900,-450,900),(150,360,42),800)]:
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.type='ORTHO';ca.ortho_scale=scale;ca.clip_end=20000;scene.camera=ob;scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
