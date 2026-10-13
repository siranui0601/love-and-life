import bpy,pathlib,json
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
study=json.loads((root/'royal-east-integrated-v9.accepted.study.json').read_text('utf8'))
ob=bpy.data.objects.get('repair_royal_east_pocket_integrated_rock_v9')
assert ob and len(ob.data.polygons)==2996
assert study['status']=='ACCEPTED_STRUCTURAL_FIRST_PASS_20261012'
scene=bpy.context.scene
print('OLD_SCENE_TAG',repr(scene.get('royalEastIntegratedV9')),flush=True)
scene['royalEastIntegratedV9']='ACCEPTED_STRUCTURAL_FIRST_PASS_20261012'
scene['royalEastV9Validation']='Closed terrain; 4734 local samples without candidate block; 14 known city anomalies remain; no player capsule QA'
out=root/'royal-east-integrated-v9.accepted-scene.blend'
if out.exists():raise RuntimeError('Refuse accepted-scene overwrite')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(out))
print('ACCEPTED_SCENE_SAVED',out.stat().st_size,flush=True)
