"""Street-eye and context evidence for the canonical-site pilot, not play testing."""
import bpy,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);plan=json.loads((out/'plan.json').read_text(encoding='utf-8'))
for site in plan['facilityStudy']['facilities']:
 route=next(r for r in plan['routes']if r['id']==site['entryRouteId']);a=Vector(route['points'][0]);b=Vector(route['points'][-1]);direction=(b-a).normalized()
 for label,height,distance in [('eye',1.7,3),('context',45,35)]:
  camera_data=bpy.data.cameras.new(site['id']+label);camera=bpy.data.objects.new(site['id']+label,camera_data);bpy.context.scene.collection.objects.link(camera)
  camera.location=a-direction*distance+Vector((0,0,height));look=b+Vector((0,0,3));camera.rotation_euler=(look-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=24;camera_data.clip_end=10000;camera_data.clip_start=.05
  bpy.context.scene.camera=camera;bpy.context.scene.render.filepath=str(out/(site['id']+'-'+label+'.png'));bpy.ops.render.render(write_still=True)
