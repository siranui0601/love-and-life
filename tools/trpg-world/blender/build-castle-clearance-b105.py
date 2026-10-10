import bpy,json,pathlib,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1])
target=out/'capital-parcel-review.blend'
if target.exists():raise RuntimeError('Refuse B105 overwrite')
study=json.loads((out/'castle-clearance.json').read_text())
for group in study['shifts']:
 n=0
 for name in group['meshNames']:
  ob=bpy.data.objects.get(name)
  if ob is None:raise RuntimeError('Missing expected '+name)
  ob.location.x+=group['dx'];ob.location.y+=group['dy'];n+=1
 if n!=len(group['meshNames']):raise RuntimeError('Group count differs')
s=bpy.context.scene
cam=bpy.data.cameras.new('B105 castle clearance overview')
ob=bpy.data.objects.new('B105 castle clearance overview',cam)
s.collection.objects.link(ob)
ob.location=(530,630,370)
ob.rotation_euler=(Vector((290,1080,230))-ob.location).to_track_quat('-Z','Y').to_euler()
cam.type='ORTHO';cam.ortho_scale=540;cam.clip_end=20000
s.camera=ob
s.render.resolution_x=1260;s.render.resolution_y=830
s.render.filepath=str(out/'B105-castle-clearance.png')
bpy.ops.render.render(write_still=True)
ob.hide_set(True)
s['status']='B105 palace road clearance candidate, 3D QA required'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
print('B105_SAVED',target.stat().st_size)
