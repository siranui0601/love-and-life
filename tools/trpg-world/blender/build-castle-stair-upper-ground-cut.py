import bpy,bmesh,json,pathlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'castle-stair-upper-cut-plan.staged.json').read_text('utf8'))
details=p['currentCastleWestStairTopCut']
name=details['groundObject']
obj=bpy.data.objects.get(name)
assert obj is not None
assert len(obj.data.polygons)==details['sourceGroundFaces']
assert len(obj.data.vertices)==details['sourceGroundVertices']
mesh=next(x for x in p['meshes']if x['name']==name)
oldData=obj.data
new=bpy.data.meshes.new(name+'_stair_open')
new.from_pydata(mesh['vertices'],[],mesh['faces'])
new.update()
for mat in oldData.materials:new.materials.append(mat)
bm=bmesh.new();bm.from_mesh(new)
# Existing b104 ground used mixed windings; recalc affected ground normals only
# and preserve original geometric geometry exactly.
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(new);bm.free()
obj.data=new
bpy.context.scene['castle_stair_upper_cut']='STAGED - requires 3D and view QA'
stage=root/'castle-stair-upper-cut.pending.blend'
if stage.exists():raise RuntimeError('Stage path already exists')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(stage))
print('STAGED_BLENDER_CASTLE_UPPER_STAIR',stage.stat().st_size,'groundFaces',len(new.polygons))
