"""Five sequential walking-height views, with recorded positions and sight probes.
Run inside a massing .blend with -- plan.json. This is not a playable walk test.
"""
import bpy,json,pathlib,sys,math
from mathutils import Vector
source=pathlib.Path(sys.argv[sys.argv.index('--')+1]);plan=json.loads(source.read_text())
routes=[r for r in plan['routes']if r.get('reviewArea')=='lower-quarter-pilot']
if not routes:raise ValueError('No authored pilot route')
def length(r):return sum(math.dist(a,b)for a,b in zip(r['points'],r['points'][1:]))
route=max(routes,key=length);points=[Vector(p)for p in route['points']];total=length(route)
def at(distance):
 for a,b in zip(points,points[1:]):
  run=(b-a).length
  if distance<=run:return a.lerp(b,distance/run)
  distance-=run
 return points[-1].copy()
scene=bpy.context.scene;camera_data=bpy.data.cameras.new('Sequential route review');camera=bpy.data.objects.new('Sequential route review',camera_data);scene.collection.objects.link(camera)
camera_data.lens=24;camera_data.clip_end=10000;camera_data.clip_start=.05
mass=bpy.data.collections['Optional parcel massing - UNACCEPTED'];mass.hide_viewport=False;mass.hide_render=False
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
target=bpy.data.objects['Castle highest tower'].matrix_world.translation+Vector((0,0,28))
evidence=[]
for index,fraction in enumerate([.05,.25,.5,.75,.95]):
 p=at(total*fraction)+Vector((0,0,1.7));q=at(min(total,total*fraction+18))+Vector((0,0,1.7))
 camera.location=p;camera.rotation_euler=(q-p).to_track_quat('-Z','Y').to_euler();scene.camera=camera
 scene.render.filepath=str(source.parent/f'Pilot-walk-{index}.png');bpy.ops.render.render(write_still=True)
 direction=target-p;hit,location,normal,face,ob,matrix=scene.ray_cast(deps,p,direction.normalized(),distance=direction.length)
 evidence.append(dict(fraction=fraction,position=list(p),firstSightHit=ob.name if hit else None))
result=dict(route=route['id'],lengthM=total,views=evidence,limitations='Sequential camera samples only; not player physics or city acceptance.')
source.with_name('pilot-walk-study.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
