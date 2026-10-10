import bpy,bmesh,pathlib,json,hashlib
root=pathlib.Path(r'C:\Users\inaba\Documents\TRPG-Capital-Blender\current')
p=json.loads((root/'royal-civic-floor-repair-plan.staged.json').read_text('utf8'))
s=p['currentRoyalCivicGroundHoleRepair']
obj=bpy.data.objects.get('civic_foot_ground')
if not obj:raise RuntimeError('No current civic_foot_ground')
if len(obj.data.vertices)!=s['originalGroundVertices'] or len(obj.data.polygons)!=s['originalGroundFaces']:
 raise RuntimeError('Blender ground mismatch '+str((len(obj.data.vertices),len(obj.data.polygons))))
m=next(x for x in p['meshes']if x['name']=='civic_foot_ground')
old=obj.data;oldMats=list(old.materials)
new=bpy.data.meshes.new('civic-foot-ground-patched-inplace')
new.from_pydata(m['vertices'],[],m['faces']);new.update()
bm=bmesh.new();bm.from_mesh(new)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.faces.ensure_lookup_table()
for face in list(bm.faces)[s['originalGroundFaces']:]:
 if face.normal.z<0:face.normal_flip()
bm.to_mesh(new);bm.free()
obj.data=new
for material in oldMats:new.materials.append(material)
bpy.context.scene['royal_floor_repair_status']='PENDING 3D QA, ground patch164.78m2'
path=root/'royal-civic-floor.pending.blend'
if path.exists():raise RuntimeError('Pending collision')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(path))
print('FLOOR_PENDING_BUILT',path.stat().st_size,len(new.polygons))
