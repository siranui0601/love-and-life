import bpy,json,pathlib
from mathutils import Vector
s=bpy.context.scene
root=pathlib.Path(bpy.data.filepath).parent
assert s.unit_settings.scale_length==1
streets=[o for o in bpy.data.objects if 'widthM' in o]
anchors=[o for o in bpy.data.objects if 'canonical_id' in o]
assert len(streets)==2013 and len(anchors)==12
bpy.ops.object.camera_add(location=(3000,-3800,2900))
camera=bpy.context.object;camera.name='Survey overview';camera.rotation_euler=(Vector((0,100,80))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=4100;camera.data.clip_end=20000;s.camera=camera
for screen in bpy.data.screens:
 for a in screen.areas:
  if a.type=='VIEW_3D':
   a.spaces.active.region_3d.view_distance=4200
   a.spaces.active.region_3d.view_location=Vector((0,100,80))
   a.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
   a.spaces.active.shading.color_type='MATERIAL'
s.render.engine='BLENDER_WORKBENCH';s.display.shading.color_type='MATERIAL';s.display.shading.light='STUDIO'
s.render.resolution_x=1400;s.render.resolution_y=1000;s.render.resolution_percentage=100
s.render.filepath=str(root/'survey-overview-v001.png')
out=root/'survey-review-v001.blend'
if out.exists():raise RuntimeError('Review version already exists')
bpy.ops.wm.save_as_mainfile(filepath=str(out))
bpy.ops.render.render(write_still=True)
(root/'survey-validation.json').write_text(json.dumps({'blender':bpy.app.version_string,'streets':len(streets),'canonicalAnchors':len(anchors),'metresPerUnit':s.unit_settings.scale_length,'status':'existing survey only; authored design not yet accepted'},indent=2))
