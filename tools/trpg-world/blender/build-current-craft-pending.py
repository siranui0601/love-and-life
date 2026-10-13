"""Build current craft district into a temporary Blender candidate.
No active current overwrite until all route/floor/collision QA passes.
"""
import bpy,bmesh,json,pathlib,sys
from mathutils import Vector
root=pathlib.Path(sys.argv[sys.argv.index('--')+1])
dst=root/'craft-exploration.pending.blend'
if dst.exists():raise RuntimeError('Pending craft blend exists')
p=json.loads((root/'staged-craft-plan.json').read_text())
study=p['marketRestoredExplorationCurrent']
if bpy.data.collections.get('Current restored market mixed craft district'):raise RuntimeError('Already installed')
coll=bpy.data.collections.new('Current restored market mixed craft district')
bpy.context.scene.collection.children.link(coll)
cols={'road_limestone':(.57,.56,.51),'courtyard_stone':(.67,.65,.58),
'ashlar':(.73,.68,.57),'slate_roof':(.16,.31,.45),'terracotta_roof':(.50,.23,.17),
'dark_window':(.11,.16,.18),'limestone_trim':(.85,.79,.63),'wood':(.39,.23,.13),
'industrial_iron':(.15,.17,.17),'gold':(.73,.53,.20),'dye_basin':(.42,.31,.50),
'garden_grass':(.23,.43,.25),'planter_stone':(.56,.54,.47),'herbs_green':(.35,.60,.26)}
for name in study['newMeshNames']:
 m=next(t for t in p['meshes']if t['name']==name)
 me=bpy.data.meshes.new(name)
 me.from_pydata(m['vertices'],[],m['faces']);me.update()
 bm=bmesh.new();bm.from_mesh(me)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free()
 obj=bpy.data.objects.new(name,me);coll.objects.link(obj)
 key=name.replace('current_craft_','')
 mat=bpy.data.materials.get('CurrentCraft '+key)or bpy.data.materials.new('CurrentCraft '+key)
 mat.diffuse_color=(*cols.get(key,(.75,.75,.70)),1)
 me.materials.append(mat)
scene=bpy.context.scene
scene.render.resolution_x=1320
scene.render.resolution_y=855
scene.render.resolution_percentage=100
shots=[
 ('craft-west-neighborhood',(-825,-130,255),(-540,145,23),570),
 ('craft-east-neighborhood',(-125,-130,235),(-365,145,22),545),
 ('craft-overview',(-680,-400,495),(-423,145,22),900),
 ('craft-west-street-eye',(-585,132,17.8),(-548,156,22),None),
 ('craft-east-street-eye',(-401,133,17.8),(-332,147,25),None)]
for name,xyz,look,scale in shots:
 camera=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,camera)
 scene.collection.objects.link(ob);ob.location=xyz
 ob.rotation_euler=(Vector(look)-ob.location).to_track_quat('-Z','Y').to_euler()
 camera.clip_start=.1;camera.clip_end=18000;camera.lens=28
 if scale:camera.type='ORTHO';camera.ortho_scale=scale
 scene.camera=ob;scene.render.filepath=str(root/(name+'.png'))
 bpy.ops.render.render(write_still=True)
 bpy.data.objects.remove(ob,do_unlink=True)
scene['current_craft_status']='WIP candidate not approved; do not mark exploration completeness'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(dst))
print('CRAFT_CANDIDATE_SAVED',dst.stat().st_size,len(study['newMeshNames']))
