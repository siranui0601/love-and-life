"""Review low-density contrast from the actual garden path, at 1.7m eye height."""
import bpy,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);data=json.loads((out/'plan.json').read_text());scene=bpy.context.scene
r=max([r for r in data['routes']if r['kind']=='garden_walk'],key=lambda r:r['lengthM'])
for fraction in [.15,.5,.85]:
 i=int(fraction*(len(r['points'])-1));p=Vector(r['points'][i]);q=Vector(r['points'][min(i+8,len(r['points'])-1)])
 ca=bpy.data.cameras.new('Garden eye');ob=bpy.data.objects.new('Garden eye',ca);scene.collection.objects.link(ob);ob.location=p+Vector((0,0,1.7));ob.rotation_euler=(q-p).to_track_quat('-Z','Y').to_euler();ca.lens=24;ca.clip_end=20000;ca.clip_start=.05;scene.camera=ob;scene.render.filepath=str(out/('Garden-eye-'+str(fraction)+'.png'));bpy.ops.render.render(write_still=True)
