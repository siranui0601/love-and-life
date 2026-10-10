"""Fixed macro/eye cameras for wall-attached ascent geometry."""
import bpy,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);plan=json.loads((out/'plan.json').read_text());s=bpy.context.scene
cameras=[('North-gap-context',(1900,2400,1350),(850,1050,60),1700),('Court-ascent-context',(-720,1500,620),(-130,970,145),850),('Civic-ascent-context',(1500,1100,680),(630,800,85),950)]
for ident in ['court_west_ramp','civic_royal_ramp','castle_east_ramp']:
 r=next(r for r in plan['routes']if r['id']==ident);ps=r['points']
 for t in [.25,.65]:
  i=int((len(ps)-1)*t);j=min(len(ps)-1,i+8);p=ps[i];q=ps[j];cameras.append((ident+'-eye-'+str(t),(p[0],p[1],p[2]+1.7),(q[0],q[1],q[2]+1.7),None))
for name,loc,look,scale in cameras:
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);s.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler();ca.clip_end=20000;ca.clip_start=.05
 if scale:ca.type='ORTHO';ca.ortho_scale=scale
 else:ca.lens=24
 s.camera=ob;s.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
