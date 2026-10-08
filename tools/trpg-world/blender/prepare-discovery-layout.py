"""Save a separate GUI review copy without replacing the integrated evidence scene."""
import bpy,pathlib,json,sys
from mathutils import Vector
out=pathlib.Path(sys.argv[sys.argv.index('--')+1]);target=out/'capital-discovery-review.blend'
if target.exists():raise RuntimeError('Existing GUI review protected')
plan=json.loads((out/'plan.json').read_text());site=plan['craftBlockStudy'];view=next(c for c in site['cameras']if c['name']=='Craft-block-context')
ca=bpy.data.cameras.new('Craft-block-review');ob=bpy.data.objects.new('Craft-block-review',ca);bpy.context.scene.collection.objects.link(ob)
ob.location=view['position'];look=Vector(view['target']);ob.rotation_euler=(look-ob.location).to_track_quat('-Z','Y').to_euler();ca.type='ORTHO';ca.ortho_scale=view['scale'];ca.clip_end=20000;bpy.context.scene.camera=ob
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type!='VIEW_3D':continue
  space=area.spaces.active;space.clip_end=20000;space.shading.color_type='MATERIAL';space.shading.show_cavity=True;space.overlay.show_overlays=False
  space.region_3d.view_location=look;space.region_3d.view_rotation=ob.rotation_euler.to_quaternion();space.region_3d.view_distance=180;space.region_3d.view_perspective='ORTHO'
bpy.context.scene['review_focus']='Street-facing craft compound. Whole city remains unaccepted; original integrated evidence scene preserved.'
bpy.ops.wm.save_as_mainfile(filepath=str(target));print('GUI_REVIEW_SAVED',target)
